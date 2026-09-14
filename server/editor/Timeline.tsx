import { useRef } from "react";
import type { ShortProps } from "../../src/compositions/Short/schema";
import { fmt } from "./api";
import * as ops from "./ops";

export type EditPhase = "start" | "live" | "end";

type Props = {
  props: ShortProps;
  durationMs: number;
  timeMs: number;
  playing: boolean;
  pxPerSec: number;
  selection: ops.Selection;
  canUndo: boolean;
  canRedo: boolean;
  onSelect: (selection: ops.Selection) => void;
  onSeek: (ms: number) => void;
  onEdit: (next: ShortProps, phase: EditPhase) => void;
  onTogglePlay: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddCaption: () => void;
  onAddText: () => void;
  onTrimHead: () => void;
  onTrimTail: () => void;
  onZoom: (pxPerSec: number) => void;
};

type Drag = {
  kind: "caption" | "clip" | "text" | "scene" | "scene-edge" | "seek";
  index: number;
  edge: "move" | "l" | "r";
  x0: number;
  y0: number;
  base: ShortProps;
  latest: ShortProps;
  /** Kéo cảnh: vị trí sẽ thả vào. */
  target: number;
};

const ROW_H = 38;
const tickStep = (pxPerSec: number) => (pxPerSec >= 140 ? 1 : pxPerSec >= 60 ? 2 : pxPerSec >= 30 ? 5 : 10);

/**
 * Timeline nhiều track kiểu CapCut: kéo thân khối để dời, kéo mép để cắt/kéo dài,
 * kéo thước để tua. Văn bản có nhiều hàng — kéo lên/xuống để đổi hàng, nhiều văn bản
 * cùng thời điểm nằm ở các hàng khác nhau.
 */
export const Timeline: React.FC<Props> = (p) => {
  const drag = useRef<Drag | null>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const pxPerMs = p.pxPerSec / 1000;
  const width = Math.max(p.durationMs * pxPerMs + 240, 640);
  const props = p.props;
  // Luôn chừa một hàng trống ở dưới cùng để kéo văn bản xuống tạo lớp mới.
  const textRows = ops.textTrackCount(props) + 1;

  const msAt = (clientX: number) => {
    const rect = tracksRef.current?.getBoundingClientRect();
    return rect ? Math.max(0, Math.min(p.durationMs, (clientX - rect.left) / pxPerMs)) : 0;
  };

  const begin = (e: React.PointerEvent<HTMLElement>, kind: Drag["kind"], index: number, edge: Drag["edge"]) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      // Giữ sự kiện khi kéo ra ngoài khối. Có môi trường không cho bắt con trỏ
      // (một số thiết bị cảm ứng, sự kiện giả lập) — khi đó vẫn kéo được trong vùng timeline.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* bỏ qua */
    }
    drag.current = { kind, index, edge, x0: e.clientX, y0: e.clientY, base: props, latest: props, target: index };
    if (kind === "seek") {
      p.onSeek(msAt(e.clientX));
      return;
    }
    p.onSelect(kind === "scene-edge" || kind === "scene" ? { type: "scene", index } : { type: kind, index });
    p.onEdit(props, "start");
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "seek") {
      p.onSeek(msAt(e.clientX));
      return;
    }
    const raw = (e.clientX - d.x0) / pxPerMs;
    const tolerance = 8 / pxPerMs;
    let next = d.base;

    if (d.kind === "caption") {
      const c = d.base.captions[d.index];
      const edges = ops.snapEdges(d.base, `caption-${d.index}`, p.timeMs);
      if (d.edge === "move") next = ops.moveCaption(d.base, d.index, ops.snapTo(c.startMs + raw, edges, tolerance) - c.startMs);
      else if (d.edge === "l") next = ops.resizeCaption(d.base, d.index, "l", ops.snapTo(c.startMs + raw, edges, tolerance) - c.startMs);
      else next = ops.resizeCaption(d.base, d.index, "r", ops.snapTo(c.endMs + raw, edges, tolerance) - c.endMs);
    } else if (d.kind === "scene") {
      // Kéo quá 4px mới tính là đổi chỗ — bấm thường chỉ để chọn cảnh.
      const s = d.base.scenes[d.index];
      const center = s.startMs + (Math.abs(e.clientX - d.x0) < 4 ? 0 : raw) + (s.endMs - s.startMs) / 2;
      d.target = d.base.scenes.filter((x, k) => k !== d.index && (x.startMs + x.endMs) / 2 < center).length;
      next = ops.reorderScene(d.base, d.index, d.target).props;
    } else if (d.kind === "text") {
      const t = d.base.texts[d.index];
      const edges = ops.snapEdges(d.base, `text-${d.index}`, p.timeMs);
      if (d.edge === "move") {
        const track = Math.min(textRows, Math.max(0, t.track + Math.round((e.clientY - d.y0) / ROW_H)));
        next = ops.moveText(d.base, d.index, ops.snapTo(t.startMs + raw, edges, tolerance) - t.startMs, track);
      } else if (d.edge === "l") next = ops.resizeText(d.base, d.index, "l", ops.snapTo(t.startMs + raw, edges, tolerance) - t.startMs);
      else next = ops.resizeText(d.base, d.index, "r", ops.snapTo(t.endMs + raw, edges, tolerance) - t.endMs);
    } else if (d.kind === "clip") {
      const c = d.base.audioClips[d.index];
      const end = c.startMs + c.durationMs;
      const edges = ops.snapEdges(d.base, `clip-${d.index}`, p.timeMs);
      if (d.edge === "move") next = ops.moveClip(d.base, d.index, ops.snapTo(c.startMs + raw, edges, tolerance) - c.startMs);
      else if (d.edge === "l") next = ops.resizeClip(d.base, d.index, "l", ops.snapTo(c.startMs + raw, edges, tolerance) - c.startMs);
      else next = ops.resizeClip(d.base, d.index, "r", ops.snapTo(end + raw, edges, tolerance) - end);
    } else {
      const s = d.base.scenes[d.index];
      const edges = ops.snapEdges(d.base, `scene-${d.index}`, p.timeMs);
      next = ops.moveSceneEdge(d.base, d.index, ops.snapTo(s.endMs + raw, edges, tolerance) - s.endMs);
    }
    d.latest = next;
    p.onEdit(next, "live");
  };

  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    // Cảnh vừa đổi chỗ: lựa chọn đi theo cảnh sang vị trí mới.
    if (d.kind === "scene") p.onSelect({ type: "scene", index: d.target });
    if (d.kind !== "seek") p.onEdit(d.latest, "end");
  };

  const sel = p.selection;
  const isSelected = (type: string, index: number) => sel !== null && "index" in sel && sel.type === type && sel.index === index;
  const step = tickStep(p.pxPerSec);
  const ticks: number[] = [];
  for (let t = 0; t <= p.durationMs / 1000 + step; t += step) ticks.push(t);
  const box = (startMs: number, endMs: number) => ({ left: startMs * pxPerMs, width: Math.max(6, (endMs - startMs) * pxPerMs) });

  return (
    <div className="tl" style={{ height: 230 + textRows * ROW_H }}>
      <div className="tl-bar">
        <button className="tl-play" onClick={p.onTogglePlay} title="Phát / dừng (Space)">{p.playing ? "⏸" : "▶"}</button>
        <span className="tl-time">{fmt(p.timeMs)} <i>/ {fmt(p.durationMs)}</i></span>
        <span className="tl-sep" />
        <button onClick={p.onSplit} title="Tách mục đang chọn (hoặc cảnh) tại đầu phát — phím S">✂️ Tách</button>
        <button onClick={p.onDelete} disabled={!sel} title="Xoá mục đang chọn — phím Delete">🗑 Xoá</button>
        <button onClick={p.onTrimHead} title="Cắt bỏ từ đầu video tới đầu phát">⇤ Cắt đầu</button>
        <button onClick={p.onTrimTail} title="Cắt bỏ từ đầu phát tới hết video">Cắt đuôi ⇥</button>
        <span className="tl-sep" />
        <button onClick={p.onAddText} title="Thêm văn bản tự do tại đầu phát — phím T">＋ Văn bản</button>
        <button onClick={p.onAddCaption} title="Thêm một câu phụ đề tại đầu phát">＋ Phụ đề</button>
        <span className="tl-sep" />
        <button onClick={p.onUndo} disabled={!p.canUndo} title="Hoàn tác (⌘/Ctrl+Z)">↶</button>
        <button onClick={p.onRedo} disabled={!p.canRedo} title="Làm lại (⇧⌘Z / Ctrl+Y)">↷</button>
        <span className="tl-grow" />
        <label className="tl-zoom" title="Phóng to timeline">
          −
          <input type="range" min={20} max={320} value={p.pxPerSec} onChange={(e) => p.onZoom(Number(e.target.value))} />
          ＋
        </label>
      </div>

      <div className="tl-scroll">
        <div className="tl-grid" style={{ width: width + 96 }}>
          <div className="tl-labels">
            <div className="tl-label ruler" />
            <div className="tl-label">🎞 Cảnh</div>
            {Array.from({ length: textRows }, (_, k) => (
              <div key={`lt${k}`} className="tl-label text">🅣 Văn bản {k + 1}</div>
            ))}
            <div className="tl-label">💬 Phụ đề</div>
            <div className="tl-label">🎙 Giọng</div>
            <div className="tl-label">♪ Nhạc</div>
            <div className="tl-label">🔊 Âm thanh</div>
          </div>

          <div
            className="tl-tracks"
            ref={tracksRef}
            style={{ width }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <div className="tl-ruler" onPointerDown={(e) => begin(e, "seek", 0, "move")}>
              {ticks.map((t) => (
                <span key={t} className="tick" style={{ left: t * p.pxPerSec }}>{t}s</span>
              ))}
            </div>

            {/* Cảnh: nối liền nhau, kéo mép phải để dời ranh giới */}
            <div className="tl-row" onPointerDown={() => p.onSelect(null)}>
              {props.scenes.map((s, k) => (
                <div
                  key={`s${k}`}
                  className={`blk scene ${isSelected("scene", k) ? "on" : ""} ${drag.current?.kind === "scene" && drag.current.target === k ? "dragging" : ""}`}
                  style={box(s.startMs, s.endMs)}
                  onPointerDown={(e) => begin(e, "scene", k, "move")}
                  title={`${s.image ?? "Không có ảnh"}\nKéo để đổi thứ tự cảnh · kéo mép phải để đổi độ dài`}
                >
                  {s.image && !ops.isVideo(s.image) ? <img src={`/public/${s.image}`} alt="" draggable={false} /> : null}
                  <span>{ops.isVideo(s.image) ? "🎬 " : ""}Cảnh {k + 1}{s.tag ? ` · ${s.tag}` : ""}</span>
                  <div className="h r" onPointerDown={(e) => begin(e, "scene-edge", k, "r")} />
                </div>
              ))}
            </div>

            {/* Văn bản tự do: mỗi hàng một lớp */}
            {Array.from({ length: textRows }, (_, row) => (
              <div key={`tr${row}`} className="tl-row text-row" onPointerDown={() => p.onSelect(null)}>
                {props.texts.map((t, k) =>
                  t.track === row ? (
                    <div
                      key={`t${k}`}
                      className={`blk text ${isSelected("text", k) ? "on" : ""}`}
                      style={box(t.startMs, t.endMs)}
                      onPointerDown={(e) => begin(e, "text", k, "move")}
                      title={`${t.text}\nKéo ngang để dời thời gian, kéo dọc để đổi hàng`}
                    >
                      <div className="h l" onPointerDown={(e) => begin(e, "text", k, "l")} />
                      <span>🅣 {t.text.replace(/\n/g, " ⏎ ")}</span>
                      <div className="h r" onPointerDown={(e) => begin(e, "text", k, "r")} />
                    </div>
                  ) : null,
                )}
                {row === textRows - 1 && props.texts.length === 0 ? (
                  <button className="tl-empty" onPointerDown={(e) => { e.stopPropagation(); p.onAddText(); }}>
                    ＋ Thêm văn bản tại đầu phát
                  </button>
                ) : null}
              </div>
            ))}

            <div className="tl-row" onPointerDown={() => p.onSelect(null)}>
              {props.captions.map((c, k) => (
                <div
                  key={`c${k}`}
                  className={`blk caption ${isSelected("caption", k) ? "on" : ""}`}
                  style={box(c.startMs, c.endMs)}
                  onPointerDown={(e) => begin(e, "caption", k, "move")}
                  title={c.text}
                >
                  <div className="h l" onPointerDown={(e) => begin(e, "caption", k, "l")} />
                  <span>{c.text}</span>
                  <div className="h r" onPointerDown={(e) => begin(e, "caption", k, "r")} />
                </div>
              ))}
            </div>

            {/* Giọng đọc đi theo phụ đề — dời phụ đề là dời giọng */}
            <div className="tl-row voice" onPointerDown={() => p.onSelect(null)}>
              {props.captions.map((c, k) =>
                c.audio ? (
                  <div
                    key={`v${k}`}
                    className={`blk voice ${isSelected("caption", k) ? "on" : ""}`}
                    style={box(c.startMs, c.endMs)}
                    title="Giọng đọc của câu — kéo khối phụ đề phía trên để dời"
                    onPointerDown={(e) => { e.stopPropagation(); p.onSelect({ type: "caption", index: k }); }}
                  >
                    <span>〰〰</span>
                  </div>
                ) : null,
              )}
            </div>

            <div className="tl-row" onPointerDown={() => p.onSelect(null)}>
              {props.music ? (
                <div
                  className={`blk music ${sel?.type === "music" ? "on" : ""}`}
                  style={box(0, p.durationMs)}
                  onPointerDown={(e) => { e.stopPropagation(); p.onSelect({ type: "music" }); }}
                >
                  <span>♪ {props.music.split("/").pop()} · {Math.round(props.musicVolume * 100)}%</span>
                </div>
              ) : (
                <button
                  className="tl-empty"
                  onPointerDown={(e) => { e.stopPropagation(); p.onSelect({ type: "music" }); }}
                >
                  ＋ Chọn nhạc nền
                </button>
              )}
            </div>

            <div className="tl-row" onPointerDown={() => p.onSelect(null)}>
              {props.audioClips.map((c, k) => (
                <div
                  key={`a${k}`}
                  className={`blk clip ${isSelected("clip", k) ? "on" : ""}`}
                  style={box(c.startMs, c.startMs + c.durationMs)}
                  onPointerDown={(e) => begin(e, "clip", k, "move")}
                  title={c.src}
                >
                  <div className="h l" onPointerDown={(e) => begin(e, "clip", k, "l")} />
                  <span>🔊 {c.label ?? c.src.split("/").pop()}</span>
                  <div className="h r" onPointerDown={(e) => begin(e, "clip", k, "r")} />
                </div>
              ))}
              {props.audioClips.length === 0 ? <span className="tl-hint">Thêm âm thanh từ thư viện bên trái</span> : null}
            </div>

            <div className="tl-end" style={{ left: p.durationMs * pxPerMs }} title="Hết video" />
            <div className="tl-playhead" style={{ left: p.timeMs * pxPerMs }}><i /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
