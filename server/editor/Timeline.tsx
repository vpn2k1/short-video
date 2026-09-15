import { useEffect, useRef, useState } from "react";
import type { ShortProps } from "../../src/compositions/Short/schema";
import * as ops from "./ops";

export type EditPhase = "start" | "live" | "end";

/** Kiểu dữ liệu khi kéo một file từ thư viện thả xuống timeline. */
export const MEDIA_DRAG_TYPE = "application/x-short-media";

type Props = {
  props: ShortProps;
  durationMs: number;
  timeMs: number;
  pxPerSec: number;
  selection: ops.Selection;
  canUndo: boolean;
  canRedo: boolean;
  onSelect: (selection: ops.Selection) => void;
  onSeek: (ms: number) => void;
  onEdit: (next: ShortProps, phase: EditPhase) => void;
  onSplit: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddText: () => void;
  onTrimHead: () => void;
  onTrimTail: () => void;
  onZoom: (pxPerSec: number) => void;
  /** Tách âm thanh của cảnh video ra track riêng. */
  onDetachAudio: (sceneIndex: number) => void;
  /** Thả file từ thư viện: sceneIndex có = thả lên một cảnh (thay hình của cảnh đó). */
  onDropMedia: (path: string, atMs: number, sceneIndex: number | null) => void;
  /** Tăng lên là thu phóng vừa khung (phím Shift+Z). */
  fitRequest: number;
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
const MAIN_H = 64;
const LABEL_W = 110;
const ZOOM_MIN = 20;
const ZOOM_MAX = 320;
const tickStep = (pxPerSec: number) => (pxPerSec >= 140 ? 1 : pxPerSec >= 60 ? 2 : pxPerSec >= 30 ? 5 : 10);
const timecode = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const ICONS = {
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  split: "M12 3v18M8 8l-4 4 4 4M16 8l4 4-4 4",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5",
  trimL: "M4 4v16M20 12H9M13 8l-4 4 4 4",
  trimR: "M20 4v16M4 12h11M11 8l4 4-4 4",
  audio: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
} as const;

const Icon: React.FC<{ name: keyof typeof ICONS }> = ({ name }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONS[name]} />
  </svg>
);

const Tool: React.FC<{ icon: keyof typeof ICONS; label?: string; title: string; onClick: () => void; disabled?: boolean }> = ({
  icon, label, title, onClick, disabled,
}) => (
  <button className="tl-tool" onClick={onClick} disabled={disabled} title={title} aria-label={label ?? title}>
    <Icon name={icon} />
    {label ? <span>{label}</span> : null}
  </button>
);

/**
 * Timeline nhiều track kiểu CapCut: track cảnh cao có hình thu nhỏ, kéo thân khối để dời, kéo mép để
 * cắt/kéo dài, bấm chỗ trống hoặc thước để tua, kéo file từ thư viện thả vào. Văn bản và phụ đề có nhiều
 * hàng — kéo lên/xuống để đổi hàng.
 */
export const Timeline: React.FC<Props> = (p) => {
  const drag = useRef<Drag | null>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Đang kéo file từ thư viện: vị trí sẽ thả (ms). */
  const [dropAt, setDropAt] = useState<number | null>(null);
  const pxPerMs = p.pxPerSec / 1000;
  const width = Math.max(p.durationMs * pxPerMs + 240, 640);
  const props = p.props;
  // Luôn chừa một hàng trống ở dưới cùng để kéo văn bản xuống tạo lớp mới.
  const textRows = ops.textTrackCount(props) + 1;
  // Mỗi hàng phụ đề một dòng (Phụ đề 1, 2…).
  const captionRows = ops.captionTrackCount(props);

  const msAt = (clientX: number) => {
    const rect = tracksRef.current?.getBoundingClientRect();
    return rect ? Math.max(0, Math.min(p.durationMs, (clientX - rect.left) / pxPerMs)) : 0;
  };

  const zoomTo = (value: number) => p.onZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value))));
  const fit = () => {
    const available = (scrollRef.current?.clientWidth ?? 900) - LABEL_W - 48;
    zoomTo((available / Math.max(1, p.durationMs)) * 1000);
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    if (p.fitRequest > 0) fitRef.current();
  }, [p.fitRequest]);

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

  /** Bấm chỗ trống trên một hàng: bỏ chọn và tua tới đó (kéo tiếp để tua liên tục) — giống CapCut. */
  const onEmpty = (e: React.PointerEvent<HTMLElement>) => {
    p.onSelect(null);
    begin(e, "seek", 0, "move");
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
      if (d.edge === "move") {
        // Kéo dọc qua hàng khác là đổi hàng phụ đề; kéo xuống dưới hàng cuối là tạo hàng mới.
        const track = Math.min(captionRows, Math.max(0, (c.track ?? 0) + Math.round((e.clientY - d.y0) / ROW_H)));
        next = ops.moveCaption(d.base, d.index, ops.snapTo(c.startMs + raw, edges, tolerance) - c.startMs, track);
      }
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
  const selectedVideo = sel?.type === "scene" && ops.isVideo(props.scenes[sel.index]?.image) ? sel.index : null;
  const height = 46 + 26 + MAIN_H + (textRows + captionRows + 3) * ROW_H + 16;

  return (
    <div className={`tl ${dropAt !== null ? "dropping" : ""}`} style={{ height }}>
      <div className="tl-bar">
        <Tool icon="undo" title="Hoàn tác (⌘/Ctrl+Z)" onClick={p.onUndo} disabled={!p.canUndo} />
        <Tool icon="redo" title="Làm lại (⇧⌘Z / Ctrl+Y)" onClick={p.onRedo} disabled={!p.canRedo} />
        <span className="tl-sep" />
        <Tool icon="split" label="Tách" title="Tách mục đang chọn (hoặc cảnh) tại đầu phát — phím S hoặc ⌘/Ctrl+B" onClick={p.onSplit} />
        <Tool icon="trash" label="Xoá" title="Xoá mục đang chọn — phím Delete" onClick={p.onDelete} disabled={!sel} />
        <Tool icon="trimL" label="Cắt trái" title="Xoá phần từ đầu video tới đầu phát — phím Q" onClick={p.onTrimHead} />
        <Tool icon="trimR" label="Cắt phải" title="Xoá phần từ đầu phát tới hết video — phím W" onClick={p.onTrimTail} />
        {selectedVideo !== null ? (
          <Tool
            icon="audio"
            label="Tách âm thanh"
            title="Tách âm thanh của cảnh đang chọn ra track riêng — video tắt tiếng gốc"
            onClick={() => p.onDetachAudio(selectedVideo)}
          />
        ) : null}
        <span className="tl-grow" />
        {dropAt !== null ? <span className="tl-drop-note">Thả lên một cảnh để thay hình · thả chỗ khác để thêm</span> : null}
        <Tool icon="fit" label="Vừa khung" title="Thu phóng để thấy cả video — Shift+Z" onClick={fit} />
        <div className="tl-zoom" title="Thu phóng timeline (phím − / +)">
          <button onClick={() => zoomTo(p.pxPerSec * 0.8)} aria-label="Thu nhỏ timeline"><Icon name="minus" /></button>
          <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} value={p.pxPerSec} onChange={(e) => zoomTo(Number(e.target.value))} aria-label="Thu phóng" />
          <button onClick={() => zoomTo(p.pxPerSec * 1.25)} aria-label="Phóng to timeline"><Icon name="plus" /></button>
        </div>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-grid" style={{ width: width + LABEL_W }}>
          <div className="tl-labels" style={{ width: LABEL_W, flexBasis: LABEL_W }}>
            <div className="tl-label ruler" />
            <div className="tl-label main"><i>🎞</i><span>Video</span></div>
            {Array.from({ length: textRows }, (_, k) => (
              <div key={`lt${k}`} className="tl-label text"><i>T</i><span>Văn bản {k + 1}</span></div>
            ))}
            {Array.from({ length: captionRows }, (_, k) => (
              <div key={`lc${k}`} className="tl-label caption"><i>💬</i><span>Phụ đề {k + 1}</span></div>
            ))}
            <div className="tl-label voice"><i>🎙</i><span>Giọng đọc</span></div>
            <div className="tl-label music"><i>♪</i><span>Nhạc nền</span></div>
            <div className="tl-label clip"><i>🔊</i><span>Âm thanh</span></div>
          </div>

          <div
            className="tl-tracks"
            ref={tracksRef}
            style={{ width }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(MEDIA_DRAG_TYPE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDropAt(msAt(e.clientX));
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null);
            }}
            onDrop={(e) => {
              setDropAt(null);
              const path = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
              if (!path) return;
              e.preventDefault();
              const sceneEl = (e.target as HTMLElement).closest<HTMLElement>("[data-scene]");
              p.onDropMedia(path, msAt(e.clientX), sceneEl ? Number(sceneEl.dataset.scene) : null);
            }}
          >
            <div className="tl-ruler" onPointerDown={(e) => begin(e, "seek", 0, "move")}>
              {ticks.map((t) => (
                <span key={t} className="tick" style={{ left: t * p.pxPerSec }}>{timecode(t)}</span>
              ))}
            </div>

            {/* Cảnh: nối liền nhau, kéo để đổi thứ tự, kéo mép phải để đổi độ dài */}
            <div className="tl-row main" onPointerDown={onEmpty}>
              {props.scenes.map((s, k) => (
                <div
                  key={`s${k}`}
                  data-scene={k}
                  className={`blk scene ${isSelected("scene", k) ? "on" : ""} ${drag.current?.kind === "scene" && drag.current.target === k ? "dragging" : ""}`}
                  style={box(s.startMs, s.endMs)}
                  onPointerDown={(e) => begin(e, "scene", k, "move")}
                  title={`${s.image ?? "Chưa có ảnh"}\nKéo để đổi thứ tự · kéo mép phải để đổi độ dài · thả ảnh/video vào để thay`}
                >
                  {s.image ? (
                    ops.isVideo(s.image) ? (
                      <video className="blk-film" src={`/public/${s.image}#t=${(s.trimStartMs / 1000 + 0.1).toFixed(2)}`} muted playsInline preload="metadata" />
                    ) : (
                      <div className="blk-film" style={{ backgroundImage: `url("/public/${s.image}")` }} />
                    )
                  ) : null}
                  <span className="blk-name">
                    {ops.isVideo(s.image) ? "🎬 " : ""}Cảnh {k + 1}{s.tag ? ` · ${s.tag}` : ""}
                    {ops.clipSpeed(s) !== 1 ? ` · ${ops.clipSpeed(s)}x` : ""} · {((s.endMs - s.startMs) / 1000).toFixed(1)}s
                  </span>
                  <div className="h r" onPointerDown={(e) => begin(e, "scene-edge", k, "r")} />
                </div>
              ))}
            </div>

            {/* Văn bản tự do: mỗi hàng một lớp */}
            {Array.from({ length: textRows }, (_, row) => (
              <div key={`tr${row}`} className="tl-row text-row" onPointerDown={onEmpty}>
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
                      <span>T {t.text.replace(/\n/g, " ⏎ ")}</span>
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

            {/* Phụ đề: mỗi hàng một lớp — kéo lên/xuống để đổi hàng */}
            {Array.from({ length: captionRows }, (_, row) => (
              <div key={`cr${row}`} className="tl-row" onPointerDown={onEmpty}>
                {props.captions.map((c, k) =>
                  (c.track ?? 0) === row ? (
                    <div
                      key={`c${k}`}
                      className={`blk caption ${isSelected("caption", k) ? "on" : ""}`}
                      style={box(c.startMs, c.endMs)}
                      onPointerDown={(e) => begin(e, "caption", k, "move")}
                      title={`${c.text}\nKéo ngang để dời thời gian, kéo dọc để đổi hàng phụ đề`}
                    >
                      <div className="h l" onPointerDown={(e) => begin(e, "caption", k, "l")} />
                      <span>{c.text}</span>
                      <div className="h r" onPointerDown={(e) => begin(e, "caption", k, "r")} />
                    </div>
                  ) : null,
                )}
              </div>
            ))}

            {/* Giọng đọc đi theo phụ đề — dời phụ đề là dời giọng */}
            <div className="tl-row voice" onPointerDown={onEmpty}>
              {props.captions.map((c, k) =>
                c.audio ? (
                  <div
                    key={`v${k}`}
                    className={`blk voice ${isSelected("caption", k) ? "on" : ""}`}
                    style={box(c.startMs, c.endMs)}
                    title="Giọng đọc của câu — kéo khối phụ đề phía trên để dời"
                    onPointerDown={(e) => { e.stopPropagation(); p.onSelect({ type: "caption", index: k }); }}
                  >
                    <span className="wave" />
                  </div>
                ) : null,
              )}
            </div>

            <div className="tl-row" onPointerDown={onEmpty}>
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

            <div className="tl-row" onPointerDown={onEmpty}>
              {props.audioClips.map((c, k) => (
                <div
                  key={`a${k}`}
                  className={`blk clip ${isSelected("clip", k) ? "on" : ""}`}
                  style={box(c.startMs, c.startMs + c.durationMs)}
                  onPointerDown={(e) => begin(e, "clip", k, "move")}
                  title={c.src}
                >
                  <div className="h l" onPointerDown={(e) => begin(e, "clip", k, "l")} />
                  <span>🔊 {c.label ?? c.src.split("/").pop()}{ops.clipSpeed(c) !== 1 ? ` · ${ops.clipSpeed(c)}x` : ""}</span>
                  <div className="h r" onPointerDown={(e) => begin(e, "clip", k, "r")} />
                </div>
              ))}
              {props.audioClips.length === 0 ? <span className="tl-hint">Kéo âm thanh từ thư viện thả vào đây</span> : null}
            </div>

            <div className="tl-end" style={{ left: p.durationMs * pxPerMs }} title="Hết video" />
            {dropAt !== null ? <div className="tl-drop" style={{ left: dropAt * pxPerMs }} /> : null}
            <div className="tl-playhead" style={{ left: p.timeMs * pxPerMs }}><i /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
