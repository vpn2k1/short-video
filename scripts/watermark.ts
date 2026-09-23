/**
 * Watermark lấy từ ô Cài đặt (WATERMARK_*). KHÔNG lưu vào props.json — gắn vào props
 * lúc render và lúc xem trước, nên bật/tắt một chỗ là áp dụng cho mọi video, kể cả
 * video làm từ trước.
 */
import { WATERMARK_POSITIONS, type ShortProps, type WatermarkPosition } from "../src/compositions/Short/schema";

export const WATERMARK_MAX_LENGTH = 60;

/** Điểm kéo thả mặc định (% khung hình) khi chưa kéo lần nào. */
export const DEFAULT_WATERMARK_XY = { x: 50, y: 10 };

/** Vị trí đã lưu → vị trí hiện hành. Bản cũ lưu 4 góc ("top-right"…) thì về cạnh trên/dưới tương ứng. */
export const watermarkPosition = (raw: string | undefined): WatermarkPosition => {
  const known = WATERMARK_POSITIONS.find((p) => p === raw);
  if (known) return known;
  if (raw?.startsWith("bottom-")) return "bottom";
  return "top";
};

/** "x,y" theo % (vd "72.5,8") → toạ độ; sai định dạng thì null. */
export const parseWatermarkXY = (raw: string | undefined): { x: number; y: number } | null => {
  const m = raw?.trim().match(/^(\d{1,3}(?:\.\d+)?),(\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const [x, y] = [Number(m[1]), Number(m[2])];
  return x <= 100 && y <= 100 ? { x, y } : null;
};

export const watermarkFromSettings = (): ShortProps["watermark"] => {
  const text = process.env.WATERMARK_TEXT?.trim();
  if (process.env.WATERMARK_ENABLED !== "on" || !text) return null;
  return {
    text: text.slice(0, WATERMARK_MAX_LENGTH),
    position: watermarkPosition(process.env.WATERMARK_POSITION),
    ...(parseWatermarkXY(process.env.WATERMARK_XY) ?? DEFAULT_WATERMARK_XY),
    opacity: 0.7,
  };
};
