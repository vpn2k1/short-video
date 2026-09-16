import { useEffect, useRef, useState } from "react";
import type { ShortProps } from "../../src/compositions/Short/schema";
import * as ops from "./ops";

export type EditPhase = "start" | "live" | "end";

/** Kiểu dữ liệu khi kéo một file từ thư viện thả xuống timeline. */
export const MEDIA_DRAG_TYPE = "application/x-short-media";

/** Nơi thả file từ thư viện: thay hình một cảnh, thành một video ở hàng nào đó, hay nối vào cuối. */
export type DropTarget =
  /** Thả lên một khối cảnh: thay hình của cảnh đó. */
  | { kind: "scene"; index: number }
  /** Thả lên một khối video có sẵn: thay hình của khối đó. */
  | { kind: "replace"; index: number }
  /** Thả vào chỗ trống của một hàng Video: thành video mới ở hàng đó, tại mốc đã thả. */
  | { kind: "overlay"; track: number }
  /** Thả ra ngoài mọi hàng video: nối vào cuối hàng Video 1. */
  | { kind: "end" };

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
  /** Cắt khung hình tại đầu phát thành ảnh (thêm vào thư viện + chèn thành cảnh mới). */
  onFreezeFrame: () => void;
  /** Thả file từ thư viện xuống timeline. */
  onDropMedia: (path: string, atMs: number, target: DropTarget) => void;
  /** Kéo khối cảnh lên một hàng video chồng: đưa hình của cảnh lên lớp riêng. */
  onLiftScene: (sceneIndex: number, track: number) => void;
  /** Ghim / xoá mốc chuyển động (keyframe) tại đầu phát cho cảnh hoặc lớp đang chọn. */
  onSetKeyframe: (sel: ops.MotionSel) => void;
  onDeleteKeyframe: (sel: ops.MotionSel) => void;
  /** Tăng lên là thu phóng vừa khung (phím Shift+Z). */
  fitRequest: number;
};

type Drag = {
  kind: "caption" | "clip" | "text" | "scene" | "scene-edge" | "overlay" | "seek";
  index: number;
  edge: "move" | "l" | "r";
  x0: number;
  y0: number;
  base: ShortProps;
  latest: ShortProps;
  /** Kéo cảnh: vị trí sẽ thả vào. */
  target: number;
  /** Kéo cảnh lên vùng hàng Video: hàng sẽ thả lên (null = vẫn đang ở hàng Cảnh). */
  lift: number | null;
};

const ROW_H = 38;
const MAIN_H = 64;
const RULER_H = 26;
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
  diamond: "M12 3.2 20.8 12 12 20.8 3.2 12z",
  prevKey: "M5 5v14M11 12l9-7v14z",
  nextKey: "M19 5v14M13 12l-9-7v14z",
  camera: "M3 8.5A2 2 0 0 1 5 6.5h2l1.4-2h7.2L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
} as const;

const Icon: React.FC<{ name: keyof typeof ICONS; filled?: boolean }> = ({ name, filled }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden
  >
    <path d={ICONS[name]} />
  </svg>
);

const Tool: React.FC<{
  icon: keyof typeof ICONS;
  label?: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  /** Đang bật (ví dụ đầu phát đứng đúng một mốc chuyển động): tô đặc biểu tượng và đổi màu nút. */
  active?: boolean;
}> = ({ icon, label, title, onClick, disabled, active }) => (
  <button
    className={`tl-tool ${active ? "on" : ""}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={label ?? title}
    aria-pressed={active === undefined ? undefined : active}
  >
    <Icon name={icon} filled={active} />
    {label ? <span>{label}</span> : null}
  </button>
);

/**
 * Timeline nhiều track kiểu CapCut: track cảnh cao có hình thu nhỏ, kéo thân khối để dời, kéo mép để
 * cắt/kéo dài, bấm chỗ trống hoặc thước để tua, kéo file từ thư viện thả vào. Văn bản và phụ đề có nhiều
 * hàng — kéo lên/xuống để đổi hàng.
 *
 * Không có "track chính": mọi video thêm vào là một khối trên một hàng Video (Video 1 dưới cùng, hàng
 * trên đè lên hàng dưới), đặt tự do trên timeline nên đè nhau được. Kéo thân để dời, kéo dọc để đổi
 * hàng, kéo mép để cắt; vị trí và mức thu phóng trên khung hình chỉnh bằng StageOverlay ở khu xem
 * trước — thu nhỏ hết thì thấy nền đen của khung đã chọn.
 *
 * Hàng "Cảnh" chỉ hiện với dự án sinh từ kịch bản (hình do phong cách vẽ); kéo một khối cảnh LÊN một
 * hàng Video là tách hình đó thành một video riêng.
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
  // Các hàng Video nằm trên hàng Cảnh. Luôn chừa một hàng trống ở trên cùng để kéo lên tạo hàng mới.
  const overlays = ops.overlaysOf(props);
  const overlayRows = ops.overlayTrackCount(props) + 1;
  /**
   * Hàng "Cảnh" là hình do phong cách vẽ (dự án sinh từ kịch bản). Khi cảnh đã gộp hết vào các hàng
   * Video và chỉ còn một cảnh rỗng làm nền đen thì ẩn hàng đó đi — trên timeline chỉ còn video, một
   * loại duy nhất.
   */
  const showScenes = ops.sceneRowVisible(props);
  /** Hàng video chồng cao nhất vẽ ở trên cùng — đổi giữa "hàng thứ mấy tính từ trên" và số track. */
  const rowToTrack = (rowFromTop: number) => overlayRows - 1 - rowFromTop;

  const msAt = (clientX: number) => {
    const rect = tracksRef.current?.getBoundingClientRect();
    return rect ? Math.max(0, Math.min(p.durationMs, (clientX - rect.left) / pxPerMs)) : 0;
  };

  /**
   * Hàng Video dưới con trỏ, hay null nếu con trỏ đang ở thước / hàng Cảnh / thấp hơn.
   * Dùng hình học thật của timeline (thước 26px rồi các hàng chồng) nên kéo thả không lệch khi cuộn.
   */
  const overlayTrackAt = (clientY: number) => {
    const rect = tracksRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const y = clientY - rect.top - RULER_H;
    if (y < 0 || y >= overlayRows * ROW_H) return null;
    return rowToTrack(Math.floor(y / ROW_H));
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
    drag.current = { kind, index, edge, x0: e.clientX, y0: e.clientY, base: props, latest: props, target: index, lift: null };
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

  /**
   * Xử lý một vị trí con trỏ. Gọi qua `move` (một lần mỗi khung hình) chứ không gọi trực tiếp:
   * pointermove bắn tới 120 lần/giây, mà mỗi lần lại vẽ lại cả timeline + khung xem trước.
   */
  const apply = (clientX: number, clientY: number) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "seek") {
      p.onSeek(msAt(clientX));
      return;
    }
    const raw = (clientX - d.x0) / pxPerMs;
    const tolerance = 8 / pxPerMs;
    let next = d.base;

    if (d.kind === "caption") {
      const c = d.base.captions[d.index];
      const edges = ops.snapEdges(d.base, `caption-${d.index}`, p.timeMs);
      if (d.edge === "move") {
        // Kéo dọc qua hàng khác là đổi hàng phụ đề; kéo xuống dưới hàng cuối là tạo hàng mới.
        const track = Math.min(captionRows, Math.max(0, (c.track ?? 0) + Math.round((clientY - d.y0) / ROW_H)));
        next = ops.moveCaption(d.base, d.index, ops.snapTo(c.startMs + raw, edges, tolerance) - c.startMs, track);
      }
      else if (d.edge === "l") next = ops.resizeCaption(d.base, d.index, "l", ops.snapTo(c.startMs + raw, edges, tolerance) - c.startMs);
      else next = ops.resizeCaption(d.base, d.index, "r", ops.snapTo(c.endMs + raw, edges, tolerance) - c.endMs);
    } else if (d.kind === "scene") {
      // Kéo khối cảnh lên một hàng video chồng: thả ra là hình của cảnh lên lớp riêng, không đổi thứ tự.
      d.lift = d.base.scenes[d.index]?.image ? overlayTrackAt(clientY) : null;
      if (d.lift !== null) {
        d.latest = d.base;
        p.onEdit(d.base, "live");
        return;
      }
      // Kéo quá 4px mới tính là đổi chỗ — bấm thường chỉ để chọn cảnh.
      const s = d.base.scenes[d.index];
      const center = s.startMs + (Math.abs(clientX - d.x0) < 4 ? 0 : raw) + (s.endMs - s.startMs) / 2;
      const target = d.base.scenes.filter((x, k) => k !== d.index && (x.startMs + x.endMs) / 2 < center).length;
      // Chưa rơi sang chỗ khác thì không cần tính lại — reorderScene dựng lại cả phụ đề/chữ/âm thanh.
      if (target === d.target && d.latest !== d.base) return;
      d.target = target;
      next = ops.reorderScene(d.base, d.index, d.target).props;
    } else if (d.kind === "overlay") {
      const o = ops.overlaysOf(d.base)[d.index];
      const edges = ops.snapEdges(d.base, `overlay-${d.index}`, p.timeMs);
      if (d.edge === "move") {
        // Kéo ngang để dời thời gian, kéo dọc để đổi hàng — hai lớp khác hàng thì đè nhau được.
        const track = overlayTrackAt(clientY) ?? (clientY > d.y0 ? 0 : overlayRows - 1);
        next = ops.moveOverlay(d.base, d.index, ops.snapTo(o.startMs + raw, edges, tolerance) - o.startMs, track);
      } else if (d.edge === "l") next = ops.resizeOverlay(d.base, d.index, "l", ops.snapTo(o.startMs + raw, edges, tolerance) - o.startMs);
      else next = ops.resizeOverlay(d.base, d.index, "r", ops.snapTo(o.endMs + raw, edges, tolerance) - o.endMs);
    } else if (d.kind === "text") {
      const t = d.base.texts[d.index];
      const edges = ops.snapEdges(d.base, `text-${d.index}`, p.timeMs);
      if (d.edge === "move") {
        const track = Math.min(textRows, Math.max(0, t.track + Math.round((clientY - d.y0) / ROW_H)));
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

  /** Vị trí con trỏ mới nhất chờ xử lý ở khung hình tới. */
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frameRequest = useRef(0);

  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    pending.current = { x: e.clientX, y: e.clientY };
    if (frameRequest.current) return;
    frameRequest.current = requestAnimationFrame(() => {
      frameRequest.current = 0;
      const at = pending.current;
      pending.current = null;
      if (at) apply(at.x, at.y);
    });
  };

  /** Xử lý ngay vị trí còn chờ — gọi trước khi chốt, để không mất đoạn kéo cuối. */
  const flush = () => {
    if (frameRequest.current) {
      cancelAnimationFrame(frameRequest.current);
      frameRequest.current = 0;
    }
    const at = pending.current;
    pending.current = null;
    if (at) apply(at.x, at.y);
  };

  const end = () => {
    flush();
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.kind === "scene" && d.lift !== null) {
      // Đóng phiên kéo trước (props không đổi) rồi mới đưa cảnh lên lớp — để một bước hoàn tác.
      p.onEdit(d.base, "end");
      p.onLiftScene(d.index, d.lift);
      return;
    }
    // Cảnh vừa đổi chỗ: lựa chọn đi theo cảnh sang vị trí mới.
    if (d.kind === "scene") p.onSelect({ type: "scene", index: d.target });
    // Lớp vừa dời mà rơi đúng chỗ lớp khác đang chiếm trên cùng hàng: đẩy lên hàng trống.
    if (d.kind === "overlay" && d.edge === "move") {
      p.onEdit(ops.settleOverlay(d.latest, d.index), "end");
      return;
    }
    if (d.kind !== "seek") p.onEdit(d.latest, "end");
  };

  const sel = p.selection;
  const isSelected = (type: string, index: number) => sel !== null && "index" in sel && sel.type === type && sel.index === index;
  const step = tickStep(p.pxPerSec);
  const ticks: number[] = [];
  for (let t = 0; t <= p.durationMs / 1000 + step; t += step) ticks.push(t);
  const box = (startMs: number, endMs: number) => ({ left: startMs * pxPerMs, width: Math.max(6, (endMs - startMs) * pxPerMs) });
  const selectedVideo = sel?.type === "scene" && ops.isVideo(props.scenes[sel.index]?.image) ? sel.index : null;

  // ---- mốc chuyển động của mục đang chọn: dùng chung cho cảnh và video trên timeline ----
  const motionSel = ops.motionSelOf(sel);
  const motionItem = motionSel ? ops.motionItem(props, motionSel) : null;
  const motionKeys = motionItem ? ops.overlayKeyframesOf(motionItem) : [];
  const keyHere = motionItem ? ops.overlayKeyframeAt(motionItem, p.timeMs) : null;
  const prevKey = [...motionKeys].reverse().find((k) => k.atMs < p.timeMs - ops.KEYFRAME_SNAP_MS);
  const nextKey = motionKeys.find((k) => k.atMs > p.timeMs + ops.KEYFRAME_SNAP_MS);
  const motionName = motionSel ? ops.motionLabel(props, motionSel) : "";
  const height = 46 + RULER_H + (showScenes ? MAIN_H : 0) + (overlayRows + textRows + captionRows + 3) * ROW_H + 16;

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
        <Tool
          icon="camera"
          label="Cắt ảnh"
          title="Lấy đúng khung hình đang xem thành ảnh: thêm vào thư viện và chèn thành cảnh mới — phím P"
          onClick={p.onFreezeFrame}
        />
        <span className="tl-sep" />
        <Tool
          icon="prevKey"
          title={prevKey ? `Về mốc chuyển động trước (${(prevKey.atMs / 1000).toFixed(1)}s)` : "Không có mốc nào phía trước"}
          onClick={() => prevKey && p.onSeek(prevKey.atMs)}
          disabled={!prevKey}
        />
        <Tool
          icon="diamond"
          label={keyHere ? "Bỏ mốc" : "Ghim mốc"}
          active={Boolean(keyHere)}
          title={
            !motionSel
              ? "Chọn một video trên timeline rồi ghim mốc chuyển động tại đầu phát"
              : keyHere
                ? `Xoá mốc chuyển động ${(keyHere.atMs / 1000).toFixed(1)}s của ${motionName}`
                : `Ghim mốc chuyển động cho ${motionName} tại đầu phát — dời đầu phát, kéo/thu phóng hình rồi ghim tiếp để nó chạy`
          }
          onClick={() => motionSel && (keyHere ? p.onDeleteKeyframe(motionSel) : p.onSetKeyframe(motionSel))}
          disabled={!motionSel}
        />
        <Tool
          icon="nextKey"
          title={nextKey ? `Tới mốc chuyển động sau (${(nextKey.atMs / 1000).toFixed(1)}s)` : "Không có mốc nào phía sau"}
          onClick={() => nextKey && p.onSeek(nextKey.atMs)}
          disabled={!nextKey}
        />
        {selectedVideo !== null ? (
          <Tool
            icon="audio"
            label="Tách âm thanh"
            title="Tách âm thanh của cảnh đang chọn ra track riêng — video tắt tiếng gốc"
            onClick={() => p.onDetachAudio(selectedVideo)}
          />
        ) : null}
        <span className="tl-grow" />
        {dropAt !== null ? (
          <span className="tl-drop-note">Thả lên một hàng Video để đặt đúng chỗ · lên một khối có sẵn để thay hình · chỗ khác để nối vào cuối</span>
        ) : null}
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
            {Array.from({ length: overlayRows }, (_, row) => (
              <div key={`lo${row}`} className="tl-label overlay"><i>🎬</i><span>Video {rowToTrack(row) + 1}</span></div>
            ))}
            {showScenes ? <div className="tl-label main"><i>🎞</i><span>Cảnh</span></div> : null}
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
              // Làm tròn về pixel: dragover bắn liên tục, đổi state từng phần nghìn giây là vẽ lại vô ích.
              const at = Math.round(msAt(e.clientX) * pxPerMs) / pxPerMs;
              setDropAt((prev) => (prev !== null && Math.abs(prev - at) < 0.5 / pxPerMs ? prev : at));
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null);
            }}
            onDrop={(e) => {
              setDropAt(null);
              const path = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
              if (!path) return;
              e.preventDefault();
              // Thả trúng một khối video có sẵn: thay hình của khối đó (giống thả lên một cảnh).
              const overlayEl = (e.target as HTMLElement).closest<HTMLElement>("[data-overlay]");
              if (overlayEl) {
                p.onDropMedia(path, msAt(e.clientX), { kind: "replace", index: Number(overlayEl.dataset.overlay) });
                return;
              }
              const track = overlayTrackAt(e.clientY);
              if (track !== null) {
                p.onDropMedia(path, msAt(e.clientX), { kind: "overlay", track });
                return;
              }
              const sceneEl = (e.target as HTMLElement).closest<HTMLElement>("[data-scene]");
              p.onDropMedia(path, msAt(e.clientX), sceneEl ? { kind: "scene", index: Number(sceneEl.dataset.scene) } : { kind: "end" });
            }}
          >
            <div className="tl-ruler" onPointerDown={(e) => begin(e, "seek", 0, "move")}>
              {ticks.map((t) => (
                <span key={t} className="tick" style={{ left: t * p.pxPerSec }}>{timecode(t)}</span>
              ))}
            </div>

            {/* Các hàng Video: mỗi khối là một video, đặt tự do, kéo dọc để đổi hàng, hàng cao vẽ trên */}
            {Array.from({ length: overlayRows }, (_, row) => {
              const track = rowToTrack(row);
              return (
                <div
                  key={`or${row}`}
                  className={`tl-row overlay-row ${drag.current?.kind === "scene" && drag.current.lift === track ? "lift" : ""}`}
                  data-overlay-track={track}
                  onPointerDown={onEmpty}
                >
                  {overlays.map((o, k) =>
                    o.track === track ? (
                      <div
                        key={`o${k}`}
                        data-overlay={k}
                        className={`blk overlay ${isSelected("overlay", k) ? "on" : ""}`}
                        style={box(o.startMs, o.endMs)}
                        onPointerDown={(e) => begin(e, "overlay", k, "move")}
                        title={`${o.src}\nKéo ngang để dời, kéo dọc để đổi hàng, kéo mép để cắt · kéo trên khung xem trước để đặt vị trí và thu phóng`}
                      >
                        {ops.isVideo(o.src) ? (
                          <video className="blk-film" src={`/public/${o.src}#t=${(o.trimStartMs / 1000 + 0.1).toFixed(2)}`} muted playsInline preload="metadata" />
                        ) : (
                          <div className="blk-film" style={{ backgroundImage: `url("/public/${o.src}")` }} />
                        )}
                        <div className="h l" onPointerDown={(e) => begin(e, "overlay", k, "l")} />
                        {/* Mốc chuyển động — bấm khối rồi mở tab Chuyển động để ghim/xoá. */}
                        {ops.overlayKeyframesOf(o).map((kf) => (
                          <i
                            key={`kf${kf.atMs}`}
                            className="kf"
                            style={{ left: (kf.atMs - o.startMs) * pxPerMs }}
                            title={`Mốc chuyển động ${(kf.atMs / 1000).toFixed(1)}s`}
                          />
                        ))}
                        <span>
                          {ops.isVideo(o.src) ? "🎬 " : "🖼 "}{o.src.split("/").pop()}
                          {ops.clipSpeed(o) !== 1 ? ` · ${ops.clipSpeed(o)}x` : ""} · {Math.round(o.width)}%
                        </span>
                        <div className="h r" onPointerDown={(e) => begin(e, "overlay", k, "r")} />
                      </div>
                    ) : null,
                  )}
                  {row === overlayRows - 1 && overlays.length === 0 ? (
                    <span className="tl-hint">Kéo ảnh/video từ thư viện vào đây — mỗi hàng là một video, hàng trên đè lên hàng dưới</span>
                  ) : null}
                </div>
              );
            })}

            {/* Hàng Cảnh (hình của phong cách): nối liền nhau, kéo để đổi thứ tự, kéo mép phải để đổi độ dài */}
            {showScenes ? (
            <div className="tl-row main" onPointerDown={onEmpty}>
              {props.scenes.map((s, k) => (
                <div
                  key={`s${k}`}
                  data-scene={k}
                  className={`blk scene ${isSelected("scene", k) ? "on" : ""} ${
                    drag.current?.kind === "scene" && drag.current.lift !== null && drag.current.index === k
                      ? "lifting"
                      : drag.current?.kind === "scene" && drag.current.target === k
                        ? "dragging"
                        : ""
                  }`}
                  style={box(s.startMs, s.endMs)}
                  onPointerDown={(e) => begin(e, "scene", k, "move")}
                  title={`${s.image ?? "Chưa có ảnh"}\nKéo để đổi thứ tự · kéo LÊN một hàng Video để tách thành video riêng · kéo mép phải để đổi độ dài · thả ảnh/video vào để thay`}
                >
                  {s.image ? (
                    ops.isVideo(s.image) ? (
                      <video className="blk-film" src={`/public/${s.image}#t=${(s.trimStartMs / 1000 + 0.1).toFixed(2)}`} muted playsInline preload="metadata" />
                    ) : (
                      <div className="blk-film" style={{ backgroundImage: `url("/public/${s.image}")` }} />
                    )
                  ) : null}
                  {/* Mốc chuyển động của cảnh — giống video trên timeline: ghim bằng nút ◆ trên thanh trên. */}
                  {ops.overlayKeyframesOf(s).map((kf) => (
                    <i
                      key={`skf${kf.atMs}`}
                      className="kf"
                      style={{ left: (kf.atMs - s.startMs) * pxPerMs }}
                      title={`Mốc chuyển động ${(kf.atMs / 1000).toFixed(1)}s`}
                    />
                  ))}
                  <span className="blk-name">
                    {ops.isVideo(s.image) ? "🎬 " : ""}Cảnh {k + 1}{s.tag ? ` · ${s.tag}` : ""}
                    {ops.clipSpeed(s) !== 1 ? ` · ${ops.clipSpeed(s)}x` : ""}
                    {s.width !== 100 ? ` · ${Math.round(s.width)}%` : ""} · {((s.endMs - s.startMs) / 1000).toFixed(1)}s
                  </span>
                  <div className="h r" onPointerDown={(e) => begin(e, "scene-edge", k, "r")} />
                </div>
              ))}
            </div>
            ) : null}

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
