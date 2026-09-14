/**
 * Watermark lấy từ ô Cài đặt (WATERMARK_*). KHÔNG lưu vào props.json — gắn vào props
 * lúc render và lúc xem trước, nên bật/tắt một chỗ là áp dụng cho mọi video, kể cả
 * video làm từ trước.
 */
import { WATERMARK_POSITIONS, type ShortProps } from "../src/compositions/Short/schema";

export const WATERMARK_MAX_LENGTH = 60;

export const watermarkFromSettings = (): ShortProps["watermark"] => {
  const text = process.env.WATERMARK_TEXT?.trim();
  if (process.env.WATERMARK_ENABLED !== "on" || !text) return null;
  return {
    text: text.slice(0, WATERMARK_MAX_LENGTH),
    position: WATERMARK_POSITIONS.find((p) => p === process.env.WATERMARK_POSITION) ?? "top-right",
    opacity: 0.7,
  };
};
