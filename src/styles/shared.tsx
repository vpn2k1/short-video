/**
 * Công cụ dùng chung cho mọi phong cách. Mỗi phong cách là một component nhận
 * nguyên ShortProps và tự vẽ MỌI lớp hình (nền, ảnh, chữ, title card, tiến độ).
 * Âm thanh KHÔNG thuộc phong cách — composition Short lo phần đó.
 *
 * Quy tắc Remotion áp cho mọi phong cách:
 *  - Mọi chuyển động suy từ useCurrentFrame(); không Date.now/Math.random/timer.
 *    Cần ngẫu nhiên thì dùng random(seed) của remotion — cùng seed cùng kết quả.
 *  - interpolate cần dãy mốc tăng NGHIÊM NGẶT.
 *  - Kích thước tính theo useLayout().unit để chạy đúng mọi tỉ lệ khung hình.
 */
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_CATALOG, type FontId } from "../fonts/catalog";
import { layoutFor } from "../aspects";
import { msToFrames } from "../constants";
import type { Caption, Scene } from "../compositions/Short/schema";

/** Chỉ số phần tử cuối cùng đã bắt đầu tại frame hiện tại; -1 nếu chưa có. */
export const activeIndexAt = (items: { startMs: number }[], frame: number) => {
  let active = -1;
  for (let i = 0; i < items.length; i++) {
    if (frame >= msToFrames(items[i].startMs)) active = i;
  }
  return active;
};

/** Cảnh đang chạy và đồng hồ cục bộ của nó. */
export const useSceneClock = (scenes: Scene[]) => {
  const frame = useCurrentFrame();
  const index = activeIndexAt(scenes, frame);
  const scene = index >= 0 ? scenes[index] : null;
  const startFrame = scene ? msToFrames(scene.startMs) : 0;
  const endFrame = scene ? msToFrames(scene.endMs) : 0;
  return {
    frame,
    index,
    scene,
    startFrame,
    endFrame,
    /** Frame tính từ đầu cảnh. */
    localFrame: frame - startFrame,
    durationFrames: Math.max(1, endFrame - startFrame),
  };
};

/**
 * Câu phụ đề đang hiện. Giữ câu cho tới khi câu sau bắt đầu để phụ đề không nháy tắt.
 */
export const useCaptionClock = (captions: Caption[]) => {
  const frame = useCurrentFrame();
  const index = activeIndexAt(captions, frame);
  const caption = index >= 0 ? captions[index] : null;
  const startFrame = caption ? msToFrames(caption.startMs) : 0;
  const endFrame = caption ? msToFrames(caption.endMs) : 0;
  return {
    index,
    caption,
    startFrame,
    localFrame: frame - startFrame,
    durationFrames: Math.max(1, endFrame - startFrame),
  };
};

/**
 * Bố cục theo khung hình thật. `unit` = cạnh ngắn / 1080 — nhân mọi kích thước
 * (font, padding, độ dày nét) với unit để 9:16, 1:1, 16:9 đều cân.
 */
export const useLayout = () => {
  const { width, height, fps } = useVideoConfig();
  const { safe, captionBottom } = layoutFor(width, height);
  return {
    width,
    height,
    fps,
    safe,
    captionBottom,
    portrait: height > width,
    unit: Math.min(width, height) / 1080,
  };
};

/** Ngẫu nhiên xác định theo khoá — dùng cho góc nghiêng, vị trí rải rác… */
export const seeded = (key: string | number, min = 0, max = 1) =>
  min + random(String(key)) * (max - min);

/** Cỡ chữ co theo độ dài — câu dài không tràn, câu ngắn thì to. */
export const fitFontSize = (text: string, base: number, minScale = 0.55) => {
  const length = [...text].length;
  const scale = length <= 14 ? 1 : Math.max(minScale, 14 / length);
  return Math.round(base * scale);
};

/**
 * Hạt phim / nhiễu giấy. SVG feTurbulence đổi seed theo frame nên hạt "sống",
 * nhưng vẫn xác định (cùng frame cùng hình).
 */
export const Grain: React.FC<{ opacity?: number; animated?: boolean; baseFrequency?: number }> = ({
  opacity = 0.12,
  animated = true,
  baseFrequency = 0.9,
}) => {
  const frame = useCurrentFrame();
  const seed = animated ? Math.floor(frame / 2) % 12 : 1;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Font stack đã kiểm là có đủ dấu tiếng Việt khi render trên macOS.
 *
 * CẢNH BÁO chữ IN HOA: móc của Ư/Ơ (ĐỪNG, THƯỜNG, ƯU) dễ bị tách rời và giãn cách sai,
 * nhất là với `condensed` (Avenir Next Condensed), letter-spacing hoặc scaleX. In hoa
 * bằng JS `text.normalize("NFC").toLocaleUpperCase("vi")` thay vì CSS text-transform,
 * và luôn render still kiểm các chữ "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" trước khi coi là xong.
 */
export const FONTS = Object.fromEntries(
  Object.entries(FONT_CATALOG).map(([id, info]) => [id, info.stack]),
) as { [K in FontId]: (typeof FONT_CATALOG)[K]["stack"] };
