import {
  FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SceneCrop } from "../../src/compositions/Short/schema";
import { CropBox, isMediaCrop, type MediaCrop } from "../../src/scenes/CropBox";

type Props = {
  /** Đường dẫn trong public/ của ảnh/video cảnh. */
  src: string;
  /** Mốc đầu clip đang dùng — khung crop hiện đúng khung hình đó. */
  trimStartMs: number;
  /** Tỉ lệ rộng/cao của video đang làm. */
  frameAspect: number;
  /** Lấp đầy hay vừa khung khi cảnh chưa từng crop — theo phong cách. */
  defaultFit: MediaCrop["fit"];
  initial: SceneCrop | null;
  onApply: (crop: SceneCrop | null) => void;
  onCancel: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "tl" | "t" | "tr" | "r" | "br" | "b" | "bl" | "l";
type Drag = { handle: Handle | "move"; x0: number; y0: number; base: Rect };

const HANDLES: Handle[] = ["tl", "t", "tr", "r", "br", "b", "bl", "l"];
const MIN = 0.05;
const VIDEO = /\.(mp4|mov|webm)$/i;

const RATIOS: { id: string; label: string }[] = [
  { id: "free", label: "Tự do" },
  { id: "frame", label: "Khung video" },
  { id: "original", label: "Gốc" },
  { id: "9:16", label: "9:16" },
  { id: "16:9", label: "16:9" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "3:4", label: "3:4" },
  { id: "4:3", label: "4:3" },
  { id: "2:1", label: "2:1" },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 10000) / 10000;
/** Đưa góc về (-180, 180]. */
const normalizeDeg = (deg: number) => {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
};

/** Tỉ lệ rộng/cao (pixel) của lựa chọn; null = tự do. */
const ratioValue = (id: string, frameAspect: number, mediaAspect: number) => {
  if (id === "free") return null;
  if (id === "frame") return frameAspect;
  if (id === "original") return mediaAspect;
  const [a, b] = id.split(":").map(Number);
  return a > 0 && b > 0 ? a / b : null;
};

/** Vùng lớn nhất có tỉ lệ `ratio`, giữ tâm cũ, nằm gọn trong file gốc. */
const largestRect = (ratio: number, mediaAspect: number, center = { x: 0.5, y: 0.5 }): Rect => {
  let w = 1;
  let h = mediaAspect / ratio;
  if (h > 1) {
    w = 1 / h;
    h = 1;
  }
  return { w, h, x: clamp(center.x - w / 2, 0, 1 - w), y: clamp(center.y - h / 2, 0, 1 - h) };
};

/**
 * Kéo một điểm của khung. Toạ độ 0–1 theo file gốc; `ratio` là tỉ lệ pixel cần giữ.
 * Có khoá tỉ lệ thì cạnh đối diện (hoặc tâm, khi kéo cạnh giữa) đứng yên.
 */
const resizeRect = (base: Rect, handle: Handle, dx: number, dy: number, ratio: number | null, mediaAspect: number): Rect => {
  let left = base.x;
  let top = base.y;
  let right = base.x + base.w;
  let bottom = base.y + base.h;
  if (handle.includes("l")) left = clamp(left + dx, 0, right - MIN);
  if (handle.includes("r")) right = clamp(right + dx, left + MIN, 1);
  if (handle.includes("t")) top = clamp(top + dy, 0, bottom - MIN);
  if (handle.includes("b")) bottom = clamp(bottom + dy, top + MIN, 1);
  if (ratio === null) {
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  // Chiều cao theo toạ độ 0–1 ứng với một đơn vị chiều rộng khi giữ tỉ lệ pixel.
  const k = mediaAspect / ratio;
  let w = right - left;
  let h = bottom - top;
  if (handle === "l" || handle === "r") h = w * k;
  else if (handle === "t" || handle === "b") w = h / k;
  else if (w * k > h) h = w * k;
  else w = h / k;

  const anchorX = handle.includes("l") ? base.x + base.w : handle.includes("r") ? base.x : base.x + base.w / 2;
  const anchorY = handle.includes("t") ? base.y + base.h : handle.includes("b") ? base.y : base.y + base.h / 2;
  const maxW = handle.includes("l") ? anchorX : handle.includes("r") ? 1 - anchorX : 2 * Math.min(anchorX, 1 - anchorX);
  const maxH = handle.includes("t") ? anchorY : handle.includes("b") ? 1 - anchorY : 2 * Math.min(anchorY, 1 - anchorY);
  const shrink = Math.min(1, maxW / w, maxH / h);
  w *= shrink;
  h *= shrink;

  return {
    w,
    h,
    x: handle.includes("l") ? anchorX - w : handle.includes("r") ? anchorX : anchorX - w / 2,
    y: handle.includes("t") ? anchorY - h : handle.includes("b") ? anchorY : anchorY - h / 2,
  };
};

const fill: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

/**
 * Khung crop kiểu CapCut, phủ khu xem trước: hiện TOÀN BỘ file gốc, kéo 8 điểm hoặc kéo
 * giữa để dời, chọn tỉ lệ, xoay, lật, lấp đầy/vừa khung; bên phải là kết quả xem trước.
 * Enter áp dụng · Esc huỷ (Esc do trình chỉnh sửa xử lý).
 */
export const CropOverlay: React.FC<Props> = ({ src, trimStartMs, frameAspect, defaultFit, initial, onApply, onCancel }) => {
  const saved = isMediaCrop(initial) ? initial : null;
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ratio, setRatio] = useState(saved?.ratio ?? "frame");
  const [rotate, setRotate] = useState(saved?.rotate ?? 0);
  const [flipH, setFlipH] = useState(saved?.flipH ?? false);
  const [flipV, setFlipV] = useState(saved?.flipV ?? false);
  const [fit, setFit] = useState<MediaCrop["fit"]>(saved?.fit ?? defaultFit);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const isVideo = VIDEO.test(src);
  const url = `/public/${src}`;
  const frameUrl = isVideo ? `${url}#t=${(trimStartMs / 1000).toFixed(2)}` : url;

  const onMeta = (width: number, height: number) => {
    if (!width || !height) {
      setError("Không đọc được kích thước ảnh/video.");
      return;
    }
    const aspect = width / height;
    setNatural({ w: width, h: height });
    setMediaAspect(aspect);
    setRect((current) => {
      if (current) return current;
      // Giữ vùng đã lưu nếu file vẫn là file lúc crop (cùng tỉ lệ); không thì dựng vùng mới.
      if (saved && Math.abs(saved.mediaAspect - aspect) < 0.01) {
        return { x: saved.x, y: saved.y, w: saved.w, h: saved.h };
      }
      return largestRect(ratioValue(ratio, frameAspect, aspect) ?? frameAspect, aspect);
    });
  };

  const draft: MediaCrop | null = rect && mediaAspect
    ? {
        x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h),
        mediaAspect: round(mediaAspect), ratio, rotate, flipH, flipV, fit,
      }
    : null;

  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && draftRef.current) {
        e.preventDefault();
        onApply(draftRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onApply]);

  const pickRatio = (id: string) => {
    setRatio(id);
    const value = mediaAspect ? ratioValue(id, frameAspect, mediaAspect) : null;
    if (value && rect && mediaAspect) {
      setRect(largestRect(value, mediaAspect, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }));
    }
  };

  const reset = () => {
    if (!mediaAspect) return;
    setRatio("frame");
    setRotate(0);
    setFlipH(false);
    setFlipV(false);
    setFit(defaultFit);
    setRect(largestRect(frameAspect, mediaAspect));
  };

  const begin = (e: React.PointerEvent<HTMLElement>, handle: Drag["handle"]) => {
    if (!rect) return;
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* môi trường không cho bắt con trỏ */
    }
    drag.current = { handle, x0: e.clientX, y0: e.clientY, base: rect };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = mediaRef.current?.getBoundingClientRect();
    if (!d || !box || !mediaAspect) return;
    const dx = (e.clientX - d.x0) / box.width;
    const dy = (e.clientY - d.y0) / box.height;
    if (d.handle === "move") {
      setRect({ ...d.base, x: clamp(d.base.x + dx, 0, 1 - d.base.w), y: clamp(d.base.y + dy, 0, 1 - d.base.h) });
    } else {
      setRect(resizeRect(d.base, d.handle, dx, dy, ratioValue(ratio, frameAspect, mediaAspect), mediaAspect));
    }
  };

  const end = () => {
    drag.current = null;
  };

  // Thanh xoay chỉnh phần lẻ ±45°, nút 90° chỉnh phần chẵn — như CapCut.
  const quarter = Math.round(rotate / 90) * 90;
  const fine = rotate - quarter;

  return (
    <div className="cr" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cr-main">
        <div className="cr-src">
          <div
            className="cr-media"
            ref={mediaRef}
            style={{ ["--ar" as string]: mediaAspect ?? 1 }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            {isVideo ? (
              <video
                src={frameUrl}
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => onMeta(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
                onError={() => setError("Không mở được video.")}
              />
            ) : (
              <img
                src={url}
                alt=""
                draggable={false}
                onLoad={(e) => onMeta(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                onError={() => setError("Không mở được ảnh.")}
              />
            )}
            {rect ? (
              <div
                className="cr-rect"
                style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                onPointerDown={(e) => begin(e, "move")}
                title="Kéo để dời vùng · kéo điểm trắng để đổi cỡ"
              >
                <i className="cr-grid" />
                {HANDLES.map((h) => (
                  <span key={h} className={`cr-h ${h}`} onPointerDown={(e) => begin(e, h)} />
                ))}
              </div>
            ) : null}
          </div>
          {error ? <p className="cr-msg err">{error}</p> : !rect ? <p className="cr-msg">Đang tải…</p> : null}
        </div>

        <div className="cr-side">
          <b>Xem trước</b>
          <div className="cr-preview" style={{ aspectRatio: String(frameAspect) }}>
            {draft ? (
              <CropBox crop={draft}>
                {isVideo ? <video src={frameUrl} muted playsInline preload="auto" style={fill} /> : <img src={url} alt="" style={fill} />}
              </CropBox>
            ) : null}
          </div>
          {natural && rect ? (
            <small>
              Lấy {Math.round(rect.w * natural.w)}×{Math.round(rect.h * natural.h)} px
              <br />từ {natural.w}×{natural.h} px
            </small>
          ) : null}
          <small>Enter áp dụng · Esc huỷ</small>
        </div>
      </div>

      <div className="cr-tools">
        <div className="cr-ratios" role="group" aria-label="Tỉ lệ vùng crop">
          {RATIOS.map((r) => (
            <button key={r.id} className={ratio === r.id ? "on" : ""} aria-pressed={ratio === r.id} onClick={() => pickRatio(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="cr-row">
          <label className="cr-rotate">
            Xoay
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={fine}
              onChange={(e) => setRotate(normalizeDeg(quarter + Number(e.target.value)))}
            />
            <output>{rotate}°</output>
          </label>
          <button title="Xoay trái 90°" onClick={() => setRotate(normalizeDeg(rotate - 90))}><RotateCcw size={16} aria-hidden /> 90°</button>
          <button title="Xoay phải 90°" onClick={() => setRotate(normalizeDeg(rotate + 90))}><RotateCw size={16} aria-hidden /> 90°</button>
          <button className={flipH ? "on" : ""} aria-pressed={flipH} onClick={() => setFlipH((v) => !v)}><FlipHorizontal2 size={16} aria-hidden /> Lật ngang</button>
          <button className={flipV ? "on" : ""} aria-pressed={flipV} onClick={() => setFlipV((v) => !v)}><FlipVertical2 size={16} aria-hidden /> Lật dọc</button>
          <div className="cr-fit" role="group" aria-label="Cách đặt vào khung">
            <button className={fit === "cover" ? "on" : ""} aria-pressed={fit === "cover"} onClick={() => setFit("cover")} title="Phóng cho kín khung, phần thừa bị cắt">
              Lấp đầy
            </button>
            <button className={fit === "contain" ? "on" : ""} aria-pressed={fit === "contain"} onClick={() => setFit("contain")} title="Hiện trọn vùng crop, có thể có viền">
              Vừa khung
            </button>
          </div>
          <span className="cr-spacer" />
          <button onClick={reset} disabled={!mediaAspect}>Đặt lại</button>
          <button onClick={() => onApply(null)}>Bỏ crop</button>
          <button onClick={onCancel}>Huỷ</button>
          <button className="primary" disabled={!draft} onClick={() => draft && onApply(draft)}>Áp dụng</button>
        </div>
      </div>
    </div>
  );
};
