/**
 * Chữ của "Album kỷ niệm": font, màu mực, đo chữ bằng canvas để biết một câu chiếm mấy dòng.
 *
 * Đo chỉ đúng khi font đã nạp — index.tsx gọi useFontReady trước; `ready` nằm trong khoá cache nên đo lại
 * ngay khi font thật về.
 */
import { FONT_CATALOG } from "../../fonts/catalog";

/** Patrick Hand — chữ viết tay bút bi, rõ ràng, đủ dấu tiếng Việt. Dùng cho lời, nhãn băng keo, giấy note. */
export const HAND = FONT_CATALOG.patrick.stack;
/** Dancing Script — chữ ký nghiêng, chỉ cho tiêu đề bìa album và vé kỷ niệm. */
export const SCRIPT = FONT_CATALOG.dancing.stack;
/** Baloo 2 — chữ tròn đậm cho nhãn dán (con số, huy hiệu). */
export const ROUND = FONT_CATALOG.baloo.stack;

export const INK = "#2b2733";
export const PHOTO_PAPER = "#fbf8f2";
export const CARD_PAPER = "#fffdf6";
export const CARD_LINE_HEIGHT = 1.24;

let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, number>();

/** Bề rộng (px) của `text` ở cỡ `size` với `font` (CSS font-family) và `weight`. */
export const measure = (text: string, size: number, font: string, weight: number, ready: boolean) => {
  if (!text) return 0;
  const key = `${ready ? 1 : 0}|${font}|${weight}|${size.toFixed(2)}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let width = [...text].length * size * 0.45;
  if (typeof document !== "undefined") {
    canvas ??= document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `${weight} ${size}px ${font}`;
      width = ctx.measureText(text).width;
    }
  }
  cache.set(key, width);
  return width;
};

/** Số dòng khi ngắt theo từ cho vừa `maxWidth`. */
export const lineCount = (text: string, size: number, maxWidth: number, font: string, weight: number, ready: boolean) => {
  const words = text.normalize("NFC").split(/\s+/).filter(Boolean);
  let lines = 0;
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next, size, font, weight, ready) > maxWidth) {
      lines += 1;
      current = word;
    } else {
      current = next;
    }
  }
  return lines + (current ? 1 : 0);
};

/** Cỡ lớn nhất (≤ base) để `text` nằm gọn trong `maxLines` dòng; không co dưới `min`. */
export const fitLines = (
  text: string, base: number, min: number, maxWidth: number, maxLines: number, font: string, weight: number, ready: boolean,
) => {
  let size = base;
  while (size > min && lineCount(text, size, maxWidth, font, weight, ready) > maxLines) size *= 0.94;
  return Math.max(min, size);
};

/** Cụm nhấn nằm ở đâu trong câu (vị trí trong chuỗi NFC), hoặc null nếu không có nguyên văn. */
export const punchSpan = (text: string, punch: string): [number, number] | null => {
  const hay = text.normalize("NFC");
  const needle = punch.normalize("NFC").trim();
  if (!needle) return null;
  const at = hay.toLowerCase().indexOf(needle.toLowerCase());
  return at < 0 ? null : [at, at + needle.length];
};

/** Độ sáng tương đối của màu hex — chọn chữ trắng hay mực trên nền màu nhấn. */
export const luminance = (hex: string) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.3;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Chữ đọc được trên nền `hex`. */
export const inkOn = (hex: string) => (luminance(hex) > 0.45 ? INK : "#ffffff");

/** Pha màu hex với đen (amount < 0) hoặc trắng (amount > 0). */
export const shade = (hex: string, amount: number) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  const out = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c + (target - c) * k).toString(16).padStart(2, "0");
  });
  return `#${out.join("")}`;
};
