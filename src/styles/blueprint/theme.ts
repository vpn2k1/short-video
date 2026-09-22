/**
 * Màu, font và hàm thuần của phong cách "Bản vẽ kỹ thuật". Không có React ở đây.
 */
import { Easing, interpolate } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";

/** Bảng màu giấy can xanh: nền xanh bản vẽ, nét trắng hơi ngả xanh, nét phụ xanh nhạt. */
export const C = {
  paper: "#0d3d7c",
  paperDeep: "#072a58",
  ink: "#eef6ff",
  soft: "#a9cdf2",
  faint: "rgba(214, 234, 255, 0.55)",
  /** Nền chữ nhật che lưới dưới ô chữ (khung tên, nhãn). */
  fill: "rgba(9, 45, 94, 0.92)",
};

/** Chữ nhãn, tiêu đề: Lexend — nét đều, hình học, giống chữ kẻ kỹ thuật. In hoa bằng JS. */
export const LABEL = FONT_CATALOG.lexend.stack;
/** Lời ghi chú (phụ đề): Roboto — gọn, dễ đọc trên điện thoại. */
export const NOTE = FONT_CATALOG.roboto.stack;
/**
 * Số đo: stack mono của hệ điều hành (Menlo / Consolas / Courier New đều đủ dấu), cuối cùng là Lexend đóng gói
 * để ký tự nào máy thiếu thì mượn riêng ký tự đó chứ không ra ô vuông.
 */
export const MONO = 'Menlo, Consolas, "DejaVu Sans Mono", "Courier New", "Lexend", monospace';

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const POP = Easing.out(Easing.back(1.7));

/** 0→1 trong `length` frame từ `from`, kẹp hai đầu. length ≥ 1 nên mốc luôn tăng nghiêm ngặt. */
export const ramp = (frame: number, from: number, length: number, easing: (t: number) => number = EASE) =>
  Number.isFinite(from) ? interpolate(frame, [from, from + Math.max(1, length)], [0, 1], { ...clamp, easing }) : 0;

/** In hoa theo tiếng Việt — không dùng CSS text-transform (móc Ư/Ơ dễ lệch). */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Tách ký tự dạng dựng sẵn (NFC) để gõ từng chữ không tách dấu khỏi chữ. */
export const chars = (text: string) => Array.from(text.normalize("NFC"));

const parseHex = (color: string): [number, number, number] | null => {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/**
 * Màu nhấn trên nền xanh: chỉ nhận màu "an toàn" cam–vàng (hue 18°–60°, đủ đậm). Đỏ trên xanh rung mắt và khó đọc,
 * xanh/tím/xám thì chìm vào giấy can — mọi màu khác đổi sang cam an toàn.
 */
export const SAFETY = "#ffa62b";
export const accentOn = (color: string) => {
  const rgb = parseHex(color);
  if (!rgb) return SAFETY;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.35 || max < 0.7) return SAFETY;
  // Chỉ cần xét trường hợp đỏ là kênh lớn nhất (cam, vàng).
  if (max !== r) return SAFETY;
  const hue = (60 * ((g - b) / (max - min)) + 360) % 360;
  return hue >= 18 && hue <= 60 ? color : SAFETY;
};

export const withAlpha = (color: string, alpha: number) => {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
};

/**
 * Ước lượng số dòng khi chữ xuống dòng theo từ trong bề ngang `width` (bề rộng một ký tự ≈ `charW` × cỡ chữ).
 * Không đo bằng canvas: chỉ cần đủ gần để chọn cỡ chữ không tràn khung.
 */
export const estimateLines = (text: string, size: number, width: number, charW: number) => {
  const perLine = Math.max(4, Math.floor(width / (size * charW)));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const len = chars(word).length;
    if (used === 0) used = len;
    else if (used + 1 + len <= perLine) used += 1 + len;
    else {
      lines += 1;
      used = len;
    }
    // Từ dài hơn cả dòng thì tự bẻ.
    while (used > perLine) {
      lines += 1;
      used -= perLine;
    }
  }
  return lines;
};

/** Cỡ chữ lớn nhất trong khoảng [min, max] để khối chữ không quá `maxLines` dòng. */
export const fitSize = (text: string, max: number, min: number, width: number, maxLines: number, charW: number) => {
  let size = max;
  while (size > min && estimateLines(text, size, width, charW) > maxLines) size *= 0.94;
  return Math.max(min, size);
};

/** Tiến độ con 0→1 trong một đoạn [from, from+length] của tiến độ cha t (0→1) — có ease ra. */
export const sub = (t: number, from: number, length: number) => {
  const x = Math.min(1, Math.max(0, (t - from) / Math.max(1e-6, length)));
  return EASE(x);
};
