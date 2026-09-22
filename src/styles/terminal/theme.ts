/**
 * Màu, font và hàm thuần của phong cách "Màn hình code". Không có React ở đây.
 */
import { Easing, interpolate } from "remotion";

/** Bảng màu kiểu editor tối (GitHub Dark) — accent của video chỉ dùng cho câu nhấn, số liệu và tiêu đề. */
export const C = {
  desk: "#07090d",
  body: "rgba(11, 14, 19, 0.95)",
  bar: "#161b22",
  line: "rgba(255, 255, 255, 0.1)",
  text: "#e6edf3",
  dim: "#7d8590",
  green: "#3fb950",
  amber: "#e3b341",
  blue: "#58a6ff",
  red: "#ff7b72",
};

/**
 * Chữ "code": không có font monospace đóng gói nào có dấu tiếng Việt, nên dùng stack mono của hệ điều hành
 * (Menlo trên macOS, Consolas / Courier New trên Windows — đều có đủ dấu), cuối cùng là Be Vietnam Pro đóng gói:
 * máy nào thiếu một ký tự có dấu thì trình duyệt mượn riêng ký tự đó từ Be Vietnam Pro chứ không ra ô vuông.
 */
export const MONO = 'Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", "Courier New", "Be Vietnam Pro", monospace';
/** Tiêu đề chữ lớn — font đậm đóng gói, in hoa bằng JS. */
export const DISPLAY = '"Be Vietnam Pro", sans-serif';

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Bật ra có vượt nhẹ — cửa sổ mở. */
export const POP = Easing.bezier(0.34, 1.5, 0.64, 1);

/** 0→1 trong `length` frame từ `from`, kẹp hai đầu. length ≥ 1 nên mốc luôn tăng nghiêm ngặt. */
export const ramp = (frame: number, from: number, length: number, easing: (t: number) => number = EASE_OUT) =>
  interpolate(frame, [from, from + Math.max(1, length)], [0, 1], { ...clamp, easing });

export const withAlpha = (color: string, alpha: number) => {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
};

const parseHex = (color: string): [number, number, number] | null => {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/** Màu chữ đọc được trên nền accent (dòng câu nhấn đảo màu). */
export const inkOn = (color: string) => {
  const rgb = parseHex(color);
  if (!rgb) return "#0b0e13";
  const [r, g, b] = rgb.map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#0b0e13" : "#ffffff";
};

/** Accent quá tối thì chữ accent trên nền đen không đọc được — làm sáng lên. */
export const brightAccent = (color: string) => {
  const rgb = parseHex(color);
  if (!rgb) return C.green;
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  if (lum >= 0.35) return color;
  const k = 0.45;
  return `rgb(${rgb.map((v) => Math.round(v + (255 - v) * k)).join(", ")})`;
};

/** "Sai lầm nguy hiểm khi tắm biển" → "sai-lam-nguy-hiem" — tên lệnh npm run ở màn mở đầu. */
export const slugify = (text: string, words = 4) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, words)
    .join("-") || "video";

/** Chuẩn hoá tiếng Việt về dạng dựng sẵn (NFC) để đếm ký tự khi gõ không tách dấu khỏi chữ. */
export const chars = (text: string) => Array.from(text.normalize("NFC"));
