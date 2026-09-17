/**
 * Bố cục trình chỉnh sửa: độ rộng hai khung bên (kéo thanh chia) và thu phóng khung xem trước.
 * Tách khỏi Editor.tsx vì chỉ là chuyện giao diện, không đụng tới props của video.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// ---------- độ rộng khung thư viện / thuộc tính ----------

export const PANEL_DEFAULT = 300;
const PANEL_MIN = 220;
const PANEL_MAX = 760;
/** Khung xem trước không được hẹp hơn mức này khi kéo rộng khung bên. */
const STAGE_MIN = 360;
const PANEL_KEY = "editorPanels";

export type PanelId = "lib" | "insp";
type Widths = Record<PanelId, number>;

const readWidths = (): Widths => {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_KEY) ?? "{}") as Partial<Widths>;
    const pick = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(PANEL_MAX, Math.max(PANEL_MIN, v)) : PANEL_DEFAULT);
    return { lib: pick(saved.lib), insp: pick(saved.insp) };
  } catch {
    return { lib: PANEL_DEFAULT, insp: PANEL_DEFAULT };
  }
};

/**
 * Kéo thanh chia để đổi độ rộng một khung. `side`: thanh nằm bên trái hay phải khung xem trước —
 * kéo sang phải làm khung bên trái rộng ra, khung bên phải hẹp lại. Nhấp đúp về mặc định.
 */
export const usePanelWidths = (mainRef: React.RefObject<HTMLElement | null>, ready: boolean) => {
  const [widths, setWidths] = useState<Widths>(readWidths);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const save = (next: Widths) => {
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify(next));
    } catch {
      /* bỏ qua */
    }
  };

  const clampFor = (panel: PanelId, value: number, current: Widths) => {
    const total = mainRef.current?.clientWidth ?? Infinity;
    const other = current[panel === "lib" ? "insp" : "lib"];
    const max = Math.min(PANEL_MAX, total - other - STAGE_MIN);
    return Math.round(Math.max(PANEL_MIN, Math.min(Math.max(PANEL_MIN, max), value)));
  };

  const startDrag = (panel: PanelId, side: "left" | "right") => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const base = widthsRef.current;
    document.body.classList.add("ed-resizing");
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const value = clampFor(panel, base[panel] + (side === "left" ? dx : -dx), base);
      setWidths((w) => (w[panel] === value ? w : { ...w, [panel]: value }));
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      document.body.classList.remove("ed-resizing");
      save(widthsRef.current);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const reset = (panel: PanelId) => {
    const next = { ...widthsRef.current, [panel]: PANEL_DEFAULT };
    setWidths(next);
    save(next);
  };

  // Cửa sổ thu nhỏ: co khung bên lại để khung xem trước không bị ép mất.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setWidths((w) => {
        const lib = clampFor("lib", w.lib, w);
        const insp = clampFor("insp", w.insp, { ...w, lib });
        return lib === w.lib && insp === w.insp ? w : { lib, insp };
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return { widths, startDrag, reset };
};

// ---------- thu phóng khung xem trước ----------

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 8;

/**
 * Thu phóng khung xem trước. zoom = 1 là vừa khung; lớn hơn thì khung cuộn được.
 * Kích thước Player đặt bằng px thật (không dùng transform) để Player, lớp kéo chữ và
 * khung crop vẫn đo đúng toạ độ.
 * `ready`: khung xem trước đã có trong DOM (trình chỉnh sửa hiện màn chờ khi đang tải dự án).
 */
export const useStageZoom = (aspect: number, ready: boolean) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [fit, setFit] = useState<{ width: number; height: number } | null>(null);
  /** Điểm cần giữ nguyên dưới con trỏ sau khi đổi mức zoom. */
  const anchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);

  // Kích thước "vừa khung" theo vùng xem trước (trừ padding).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const measure = () => {
      const style = getComputedStyle(view);
      const w = view.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const h = view.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (w <= 0 || h <= 0) return;
      const width = Math.min(w, h * aspect);
      const next = { width: Math.floor(width), height: Math.floor(width / aspect) };
      setFit((f) => (f && f.width === next.width && f.height === next.height ? f : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    return () => observer.disconnect();
  }, [aspect, ready]);

  const zoomTo = useCallback((next: number, at?: { x: number; y: number }) => {
    const view = viewRef.current;
    const box = playerBoxRef.current;
    let value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    if (Math.abs(value - 1) < 0.04) value = 1; // hít về "vừa khung"
    if (value === zoomRef.current) return;
    if (view && box) {
      const rect = box.getBoundingClientRect();
      const viewRect = view.getBoundingClientRect();
      const cx = at?.x ?? viewRect.left + viewRect.width / 2;
      const cy = at?.y ?? viewRect.top + viewRect.height / 2;
      anchor.current = { fx: (cx - rect.left) / rect.width, fy: (cy - rect.top) / rect.height, cx, cy };
    }
    zoomRef.current = value;
    setZoom(value);
  }, []);

  const zoomBy = useCallback((factor: number, at?: { x: number; y: number }) => zoomTo(zoomRef.current * factor, at), [zoomTo]);

  // Sau khi Player đổi kích thước: cuộn để điểm dưới con trỏ đứng yên.
  useLayoutEffect(() => {
    const a = anchor.current;
    const view = viewRef.current;
    const box = playerBoxRef.current;
    anchor.current = null;
    if (!a || !view || !box) return;
    const rect = box.getBoundingClientRect();
    view.scrollLeft += rect.left + a.fx * rect.width - a.cx;
    view.scrollTop += rect.top + a.fy * rect.height - a.cy;
  }, [zoom]);

  // ⌘/Ctrl + lăn chuột, hoặc chụm hai ngón trên trackpad (trình duyệt báo là wheel kèm ctrlKey).
  // Listener gắn tay với passive: false — React gắn wheel dạng passive nên không chặn được zoom cả trang.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // Một nấc chuột (~100px) ≈ ×1.27; chụm trackpad gửi nhiều sự kiện nhỏ nên mượt.
      const delta = Math.max(-40, Math.min(40, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
      zoomBy(Math.exp(-delta * 0.006), { x: e.clientX, y: e.clientY });
    };
    view.addEventListener("wheel", onWheel, { passive: false });
    return () => view.removeEventListener("wheel", onWheel);
  }, [zoomBy, ready]);

  /**
   * Kéo để di chuyển khi đang phóng to: chuột giữa ở bất kỳ đâu, hoặc chuột trái trên nền tối.
   * Trả về true nếu đã nhận xử lý; `onClick` chạy khi chỉ bấm nền mà không kéo.
   */
  const beginPan = (e: React.PointerEvent<HTMLDivElement>, onClick: () => void) => {
    const view = viewRef.current;
    const onBackground = e.target === e.currentTarget;
    if (!view || !(e.button === 1 || (e.button === 0 && onBackground))) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const left0 = view.scrollLeft;
    const top0 = view.scrollTop;
    let moved = false;
    view.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      view.classList.add("panning");
      view.scrollLeft = left0 - dx;
      view.scrollTop = top0 - dy;
    };
    const up = () => {
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerup", up);
      view.removeEventListener("pointercancel", up);
      view.classList.remove("panning");
      if (!moved && e.button === 0) onClick();
    };
    view.addEventListener("pointermove", move);
    view.addEventListener("pointerup", up);
    view.addEventListener("pointercancel", up);
  };

  const playerSize = fit
    ? { width: Math.round(fit.width * zoom), height: Math.round(fit.height * zoom) }
    : null;

  return { viewRef, playerBoxRef, zoom, zoomTo, zoomBy, beginPan, playerSize };
};
