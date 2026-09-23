/**
 * Màu, font, nhịp và đo chữ của phong cách "Thể thao". Hàm thuần, không React.
 */
import { Easing, interpolate } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";

/** Font đóng gói: Anton cho số/nhãn in hoa, Oswald cho phụ đề và dòng chữ đồ hoạ. */
export const SPORT_FONTS = ["anton", "oswald"] as const;
export const DISPLAY = FONT_CATALOG.anton.stack;
export const COND = FONT_CATALOG.oswald.stack;

/** Nền tối của mọi bảng đồ hoạ (xanh đen sân vận động ban đêm). */
export const INK = "#0a0e17";
export const PANEL = "#121826";
/** Đỏ đèn LIVE — cố định, không theo accent. */
export const LIVE_RED = "#ff2d3d";

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
/** Bật ra quá tay một chút rồi dừng — nhãn, bảng số. */
export const SNAP = Easing.out(Easing.back(1.7));

/** Số frame vệt sọc chéo quét qua khung khi đổi cảnh (tâm vệt trùng frame cắt cảnh). */
export const WIPE_FRAMES = 16;
/** Số frame khung rung khi câu nhấn nổ. */
export const SHAKE_FRAMES = 6;
/** Câu nhấn giữ trên màn hình tối đa bao nhiêu frame rồi rút (để ảnh và phụ đề thoáng lại). */
export const PUNCH_HOLD = 66;

/** Nội suy 0→1 có kẹp hai đầu; `length` ≥ 1 nên mốc luôn tăng nghiêm ngặt. */
export const ramp = (frame: number, from: number, length: number, easing: (t: number) => number = EASE_OUT) =>
  interpolate(frame, [from, from + Math.max(1, length)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

// ---------------------------------------------------------------------------
// Màu
// ---------------------------------------------------------------------------
const parseHex = (color: string): [number, number, number] | null => {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

export const withAlpha = (color: string, alpha: number) => {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
};

/** Chữ đặt trên nền accent: đen nếu accent sáng (vàng, xanh chuối), trắng nếu tối. */
export const inkOn = (color: string) => {
  const rgb = parseHex(color);
  if (!rgb) return "#ffffff";
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return lum > 0.62 ? INK : "#ffffff";
};

// ---------------------------------------------------------------------------
// Chữ
// ---------------------------------------------------------------------------
/** In hoa tiếng Việt bằng JS — KHÔNG dùng CSS text-transform với font hẹp (móc Ư/Ơ bị tách). */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Ước số dòng khi chữ xuống dòng theo từ trong bề rộng `width`. */
export const estimateLines = (text: string, fontSize: number, width: number, charWidth: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const max = width / (fontSize * charWidth);
  let lines = 1;
  let used = 0;
  for (const w of words) {
    const len = [...w].length;
    if (used === 0) used = len;
    else if (used + 1 + len <= max) used += 1 + len;
    else {
      lines++;
      used = len;
    }
  }
  return lines;
};

/** Co cỡ chữ tới khi câu vừa `maxLines` dòng (không nhỏ hơn `min`). */
export const fitText = (text: string, base: number, width: number, maxLines: number, charWidth: number, min = base * 0.55) => {
  let size = base;
  while (size > min && estimateLines(text, size, width, charWidth) > maxLines) size *= 0.94;
  size = Math.max(min, size);
  return { size: Math.round(size), lines: estimateLines(text, size, width, charWidth) };
};

/**
 * Tách tag kiểu bảng tên cầu thủ: "#10 · Quang Hải" → { num: "10", name: "Quang Hải" }.
 * Không có số áo ("VÒNG 3", "Man City") → num null, cả tag là tên.
 */
export const splitTag = (tag: string): { num: string | null; name: string } => {
  const m = tag.trim().match(/^#\s*(\d{1,3})\s*[·•|:\-–—.]?\s*(.*)$/);
  if (m) return { num: m[1], name: m[2].trim() };
  return { num: null, name: tag.trim() };
};

/** Đồng hồ trận "45:12" từ số giây. */
export const clockText = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
