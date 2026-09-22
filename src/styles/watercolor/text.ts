/**
 * Đo và ngắt dòng cho phong cách "Tranh màu nước". Phụ đề hiện TỪNG TỪ và câu nhấn cần biết từ nào nằm ở dòng nào,
 * nên tự ngắt bằng canvas thay vì để trình duyệt ngắt.
 *
 * Đo bằng canvas 2D (đồng bộ, cache theo chuỗi). Chỉ đúng khi font đã nạp — index.tsx gọi useFontReady cho cả
 * Dancing Script lẫn Lora và truyền `ready` vào để khoá cache đổi khi font về.
 */
import { FONT_CATALOG } from "../../fonts/catalog";

/** Dancing Script (đóng gói, đủ dấu) — nét bút lông mềm cho phụ đề ngắn, tiêu đề, con số. */
export const SCRIPT = FONT_CATALOG.dancing.stack;
/** Lora (đóng gói, đủ dấu) — chữ có chân dịu cho câu dài, dòng phụ, chú thích. */
export const SERIF = FONT_CATALOG.lora.stack;

export type Face = { family: string; weight: number; italic?: boolean };
export const SCRIPT_FACE: Face = { family: SCRIPT, weight: 600 };
export const SCRIPT_BOLD: Face = { family: SCRIPT, weight: 700 };
export const SERIF_FACE: Face = { family: SERIF, weight: 500 };

let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, number>();

/** Bề rộng (px) của `text` ở cỡ `size`. */
export const measure = (text: string, size: number, face: Face, ready: boolean) => {
  if (!text) return 0;
  const key = `${ready ? 1 : 0}|${face.family}|${face.weight}|${face.italic ? 1 : 0}|${size.toFixed(2)}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // Dự phòng khi không có DOM: chữ viết tay trung bình ~0.45em mỗi ký tự, chữ có chân ~0.52em.
  let width = [...text].length * size * (face.family === SCRIPT ? 0.45 : 0.52);
  if (typeof document !== "undefined") {
    canvas ??= document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `${face.italic ? "italic " : ""}${face.weight} ${size}px ${face.family}`;
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
export const wrap = (text: string, size: number, maxWidth: number, face: Face, ready: boolean): Line[] => {
  const words = text.normalize("NFC").split(/\s+/).filter(Boolean);
  const lines: Line[] = [];
  let current: Line["words"] = [];
  const join = (list: Line["words"]) => list.map((w) => w.text).join(" ");
  words.forEach((word, index) => {
    const next = [...current, { text: word, index }];
    if (current.length > 0 && measure(join(next), size, face, ready) > maxWidth) {
      lines.push({ words: current, width: measure(join(current), size, face, ready) });
      current = [{ text: word, index }];
    } else {
      current = next;
    }
  });
  if (current.length > 0) lines.push({ words: current, width: measure(join(current), size, face, ready) });
  return lines;
};

/**
 * Cỡ chữ lớn nhất (≤ `base`) để câu vừa khung `w × h`, không quá `maxLines` dòng, và không từ nào rộng hơn khung.
 * Giảm dần từng 6%. `fits` = false khi đã co tới `min` mà vẫn tràn — nơi gọi đổi sang font khác.
 */
export const fitLines = (
  text: string, base: number, min: number, w: number, h: number, lineHeight: number, maxLines: number, face: Face, ready: boolean,
) => {
  const over = (size: number, lines: Line[]) =>
    lines.length > maxLines || lines.length * size * lineHeight > h || lines.some((l) => l.width > w);
  let size = base;
  let lines = wrap(text, size, w, face, ready);
  while (size > min && over(size, lines)) {
    size = Math.max(min, size * 0.94);
    lines = wrap(text, size, w, face, ready);
  }
  return { size, lines: balance(text, size, w, lines, face, ready), fits: !over(size, lines) };
};

/**
 * Cân dòng: giữ nguyên số dòng nhưng thu hẹp bề rộng ngắt tới mức nhỏ nhất có thể — tránh một từ mồ côi ở dòng cuối
 * ("Có những buổi chiều rất / lặng" → "Có những buổi / chiều rất lặng").
 */
export const balance = (text: string, size: number, w: number, lines: Line[], face: Face, ready: boolean): Line[] => {
  if (lines.length < 2) return lines;
  let lo = w * 0.4;
  let hi = w;
  let best = lines;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const next = wrap(text, size, mid, face, ready);
    if (next.length <= lines.length && next.every((l) => l.width <= mid + 0.5)) {
      best = next;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
};

/** In hoa đúng dấu tiếng Việt — KHÔNG dùng CSS text-transform. */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");
