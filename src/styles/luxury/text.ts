/**
 * Đo và ngắt dòng chữ có chân cho phong cách "Tối giản sang trọng". Phụ đề hiện TỪNG DÒNG nên phải biết trước
 * dòng nào chứa từ nào — tự ngắt bằng canvas thay vì để trình duyệt ngắt.
 *
 * Project không có @remotion/layout-utils nên đo bằng canvas 2D (đồng bộ, cache theo chuỗi). Chỉ đúng khi Playfair
 * đã nạp — index.tsx gọi useFontReady("playfair") và truyền `ready` vào để khoá cache đổi khi font về.
 */
import { FONT_CATALOG } from "../../fonts/catalog";

/** Playfair Display (đóng gói, đủ dấu) — phụ đề, tiêu đề, con số. */
export const SERIF = FONT_CATALOG.playfair.stack;
/** Montserrat (đóng gói) — dòng kicker in hoa giãn chữ. */
export const SANS = FONT_CATALOG.montserrat.stack;

let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, number>();

/** Bề rộng (px) của `text` viết bằng SERIF ở cỡ `size`. */
export const measure = (text: string, size: number, ready: boolean, weight = 400) => {
  if (!text) return 0;
  const key = `${ready ? 1 : 0}|${weight}|${size.toFixed(2)}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // Dự phòng khi không có DOM (server): Playfair trung bình ~0.5em mỗi ký tự.
  let width = [...text].length * size * 0.5;
  if (typeof document !== "undefined") {
    canvas ??= document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `${weight} ${size}px ${SERIF}`;
      width = ctx.measureText(text).width;
    }
  }
  cache.set(key, width);
  return width;
};

export type Line = {
  /** Các từ của dòng, kèm chỉ số từ trong cả câu (khớp với findPunch — tách theo khoảng trắng). */
  words: { text: string; index: number }[];
  width: number;
};

/** Ngắt theo từ cho vừa `maxWidth`. */
export const wrap = (text: string, size: number, maxWidth: number, ready: boolean, weight = 400): Line[] => {
  const words = text.normalize("NFC").split(/\s+/).filter(Boolean);
  const lines: Line[] = [];
  let current: Line["words"] = [];
  const join = (list: Line["words"]) => list.map((w) => w.text).join(" ");
  words.forEach((word, index) => {
    const next = [...current, { text: word, index }];
    if (current.length > 0 && measure(join(next), size, ready, weight) > maxWidth) {
      lines.push({ words: current, width: measure(join(current), size, ready, weight) });
      current = [{ text: word, index }];
    } else {
      current = next;
    }
  });
  if (current.length > 0) lines.push({ words: current, width: measure(join(current), size, ready, weight) });
  return lines;
};

/**
 * Cỡ chữ lớn nhất (≤ `base`) để câu vừa khung `w × h` và không quá `maxLines` dòng.
 * Giảm dần từng 6% — câu ngắn giữ cỡ to, câu dài co lại nhưng không nhỏ hơn `min`.
 */
export const fitLines = (
  text: string, base: number, min: number, w: number, h: number, lineHeight: number, maxLines: number, ready: boolean, weight = 400,
) => {
  let size = base;
  let lines = wrap(text, size, w, ready, weight);
  while (size > min && (lines.length > maxLines || lines.length * size * lineHeight > h)) {
    size = Math.max(min, size * 0.94);
    lines = wrap(text, size, w, ready, weight);
  }
  return { size, lines };
};

/** In hoa đúng dấu tiếng Việt — KHÔNG dùng CSS text-transform. */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");
