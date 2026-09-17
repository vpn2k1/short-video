/**
 * Công cụ crop của trình chỉnh sửa, đóng gói riêng (/editor/crop.js) cho các trang không dùng React —
 * trang 🔤 Thêm phụ đề dùng đúng khung crop này để cắt khung chung cho cả loạt video.
 *
 *   window.CropTool.open(el, { src, frameAspect, initial, onApply, onCancel }) → { close() }
 *   window.CropTool.preview(el, { src, crop, frameAspect }) → { close() }
 */
import { createRoot } from "react-dom/client";
import type { SceneCrop } from "../../src/compositions/Short/schema";
import { CropBox } from "../../src/scenes/CropBox";
import { CropOverlay } from "./CropOverlay";

type OpenOptions = {
  /** Đường dẫn trong public/ của video mẫu. */
  src: string;
  frameAspect: number;
  initial: SceneCrop | null;
  onApply: (crop: SceneCrop | null) => void;
  onCancel: () => void;
};

const VIDEO = /\.(mp4|mov|webm)$/i;

const mount = (el: HTMLElement, node: React.ReactNode) => {
  const root = createRoot(el);
  root.render(node);
  return { close: () => root.unmount() };
};

const CropTool = {
  open: (el: HTMLElement, o: OpenOptions) =>
    mount(el, (
      <CropOverlay
        src={o.src}
        trimStartMs={500}
        frameAspect={o.frameAspect}
        defaultFit="cover"
        initial={o.initial}
        onApply={o.onApply}
        onCancel={o.onCancel}
      />
    )),

  /** Khung xem trước kết quả — vẽ bằng đúng CropBox mà video render dùng. */
  preview: (el: HTMLElement, o: { src: string; crop: SceneCrop | null; frameAspect: number }) => {
    const url = `/public/${o.src}`;
    const fill: React.CSSProperties = { width: "100%", height: "100%", objectFit: o.crop ? "cover" : "contain", display: "block" };
    return mount(el, (
      <div style={{ width: "100%", aspectRatio: String(o.frameAspect), background: "#000", borderRadius: 8, overflow: "hidden" }}>
        <CropBox crop={o.crop}>
          {VIDEO.test(o.src) ? <video src={`${url}#t=0.5`} muted playsInline preload="auto" style={fill} /> : <img src={url} alt="" style={fill} />}
        </CropBox>
      </div>
    ));
  },
};

(window as unknown as { CropTool: typeof CropTool }).CropTool = CropTool;
