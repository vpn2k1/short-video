/**
 * Màu, font, easing và các hàm thuần của phong cách "Dòng thời gian".
 * Không có React ở đây để dễ đọc và dễ kiểm.
 */
import { Easing, interpolate } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Cuộn camera: tăng tốc rồi dừng mềm, như tay kéo trang. */
export const SCROLL = Easing.bezier(0.65, 0, 0.35, 1);
/** Vào nhanh, dừng mềm. */
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Số frame camera trượt từ mốc này sang mốc sau. */
export const SCROLL_FRAMES = 22;

/** Năm / con số: Montserrat đậm. Lời đọc: Lora có chân — giọng sách sử. Chữ nhỏ giao diện: Be Vietnam Pro. */
export const DISPLAY = FONT_CATALOG.montserrat.stack;
export const BODY = FONT_CATALOG.lora.stack;
export const UI = FONT_CATALOG.bevietnam.stack;

export type Theme = {
  dark: boolean;
  bg: string;
  grid: string;
  ink: string;
  muted: string;
  card: string;
  cardEdge: string;
  track: string;
  shadow: string;
};

/** Giấy ngà (nền sáng) và bảng đá xám (nền tối) — chọn theo độ sáng của `background`. */
const PAPER: Theme = {
  dark: false,
  bg: "#f3eee4",
  grid: "rgba(70, 58, 40, 0.07)",
  ink: "#1c222b",
  muted: "rgba(28, 34, 43, 0.5)",
  card: "#fffdf8",
  cardEdge: "rgba(70, 58, 40, 0.1)",
  track: "rgba(28, 34, 43, 0.16)",
  shadow: "rgba(60, 45, 25, 0.16)",
};

const SLATE: Theme = {
  dark: true,
  bg: "#161c25",
  grid: "rgba(255, 255, 255, 0.045)",
  ink: "#eef1f5",
  muted: "rgba(238, 241, 245, 0.5)",
  card: "#1f2733",
  cardEdge: "rgba(255, 255, 255, 0.08)",
  track: "rgba(238, 241, 245, 0.16)",
  shadow: "rgba(0, 0, 0, 0.4)",
};

const rgbOf = (color: string): [number, number, number] | null => {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};

export const themeFor = (background: string): Theme => {
  const rgb = rgbOf(background);
  if (!rgb) return SLATE;
  const [r, g, b] = rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? PAPER : SLATE;
};

/** Màu nhấn pha trong suốt — màu không đọc được thì dùng color-mix. */
export const alpha = (color: string, a: number) => {
  const rgb = rgbOf(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
};

/** Nội suy 0→1 có kẹp hai đầu; length ≥ 1 nên dãy mốc luôn tăng nghiêm ngặt. */
export const ramp = (frame: number, from: number, length: number, easing: (t: number) => number = OUT) =>
  interpolate(frame, [from, from + Math.max(1, length)], [0, 1], { ...clamp, easing });

/**
 * Vị trí camera trên trục, tính bằng "số mốc": 0 = đứng ở mốc đầu, 2.5 = giữa mốc 3 và 4.
 * Mỗi lần sang cảnh cộng thêm một bước trượt SCROLL_FRAMES — cảnh ngắn hơn bước trượt thì các bước chồng
 * lên nhau nhưng tổng vẫn đúng, không nhảy.
 */
export const scrollPosition = (frame: number, starts: number[]) => {
  let p = 0;
  for (let i = 1; i < starts.length; i++) p += ramp(frame, starts[i], SCROLL_FRAMES, SCROLL);
  return p;
};

/** Ước lượng số dòng khi xuống dòng theo từ — `factor` = bề rộng trung bình một ký tự / cỡ chữ. */
export const estimateLines = (text: string, fontSize: number, width: number, factor = 0.52) => {
  const perLine = Math.max(4, Math.floor(width / (fontSize * factor)));
  let lines = 1;
  let used = 0;
  for (const word of text.trim().split(/\s+/)) {
    const len = [...word].length;
    if (used === 0) used = len;
    else if (used + 1 + len <= perLine) used += 1 + len;
    else {
      lines += 1;
      used = len;
    }
    // Một từ dài hơn cả dòng thì tự gãy.
    while (used > perLine) {
      lines += 1;
      used -= perLine;
    }
  }
  return lines;
};

/** Cỡ chữ lớn nhất để một cụm ngắn (năm, con số) nằm gọn trên một dòng. */
export const fitOneLine = (text: string, base: number, width: number, factor = 0.66) =>
  Math.min(base, width / Math.max(1, [...text].length * factor));

/** Nhãn của mốc: tag nếu có, không thì số thứ tự "01", "02"… */
export const nodeLabel = (scene: Scene, index: number) =>
  scene.tag?.trim() || String(index + 1).padStart(2, "0");

/** Câu thoại thuộc cảnh nào: cảnh đang chạy lúc câu bắt đầu (câu đứng trước cảnh đầu thì về cảnh đầu). */
export const captionsByScene = (captions: Caption[], scenes: Scene[]) => {
  const out: Caption[][] = scenes.map(() => []);
  if (scenes.length === 0) return out;
  for (const c of captions) {
    let owner = 0;
    for (let i = 0; i < scenes.length; i++) if (c.startMs >= scenes[i].startMs) owner = i;
    out[owner].push(c);
  }
  return out;
};

/** Frame xuất hiện của câu nhấn — kẹp vào trong cảnh để không hiện trước khi thẻ vào. */
export const punchFrame = (scene: Scene, enterFrame: number) => {
  if (!scene.punch) return null;
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs) - 6);
  return Math.min(end, Math.max(enterFrame + 8, msToFrames(scene.punch.atMs)));
};

/** Tách câu thành [trước, cụm nhấn, sau] nếu câu chứa nguyên văn cụm nhấn (không phân biệt hoa thường). */
export const splitPunch = (text: string, punch: string | null | undefined): [string, string, string] | null => {
  if (!punch) return null;
  const hay = text.normalize("NFC");
  const needle = punch.normalize("NFC").trim();
  if (!needle) return null;
  const at = hay.toLocaleLowerCase("vi").indexOf(needle.toLocaleLowerCase("vi"));
  if (at < 0) return null;
  return [hay.slice(0, at), hay.slice(at, at + needle.length), hay.slice(at + needle.length)];
};
