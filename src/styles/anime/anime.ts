/**
 * Màu, chữ và các hàm tiện ích của phong cách "Anime".
 * Mọi "ngẫu nhiên" đi qua seeded() — cùng frame cùng hình, render song song không lệch.
 */
import { Easing } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Chữ đậm kiểu tiêu đề anime: Montserrat 900 — có đủ dấu tiếng Việt, đóng gói sẵn (chạy cả Windows). */
export const HEAVY = FONT_CATALOG.montserrat.stack;
export const ANIME_FONTS = ["montserrat"];

/** Trắng hơi ấm của chữ, vàng nắng cho cụm nhấn, xanh trời cho dải phụ, hồng anh đào cho cánh hoa. */
export const WHITE = "#ffffff";
export const SUN = "#ffe45c";
export const SKY = "#3fa9ff";
export const SAKURA = "#ffc2d6";
/** Màu mực tối của bóng đổ dưới chữ. */
export const INK = "#141026";

/** Bật ra quá đà rồi về đúng cỡ — dùng cho mọi "scale-pop". */
export const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);

export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Tách chữ theo ký tự hiển thị (NFC) để không cắt đôi dấu tiếng Việt. */
export const glyphs = (text: string) => Array.from(text.normalize("NFC"));

/* ------------------------------------------------------------ bảng màu */

const hsl = (hex: string): { h: number; s: number; l: number } | null => {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
};

export type Palette = {
  /** Màu nhấn chính: viền chữ phụ đề, dải tag, khối câu nhấn. Luôn đủ tối để chữ trắng nổi. */
  main: string;
  /** Bản tối hơn — bóng khối dưới dải, viền chữ trên khối màu. */
  deep: string;
  /** Bản sáng — quầng sáng, tia tốc độ. */
  light: string;
  hue: number;
};

/**
 * Bảng màu suy từ `accent`. Accent sáng (vàng, hồng pastel) bị kéo tối xuống ~46% để viền chữ trắng vẫn
 * tương phản; accent xám/trắng/đen không có sắc độ → đỏ hồng anh đào (345°).
 */
export const paletteFor = (accent: string): Palette => {
  const c = hsl(accent);
  const hue = !c || c.s < 0.15 ? 345 : Math.round(c.h);
  const sat = !c || c.s < 0.15 ? 88 : Math.round(Math.max(70, c.s * 100));
  return {
    main: `hsl(${hue}, ${sat}%, 48%)`,
    deep: `hsl(${hue}, ${sat}%, 26%)`,
    light: `hsl(${hue}, 100%, 78%)`,
    hue,
  };
};

/* ------------------------------------------------------------ chữ viền */

/**
 * Chữ trắng viền màu dày kiểu phụ đề anime: stroke vẽ DƯỚI phần tô (paint-order) nên nét chữ không bị ăn mỏng,
 * cộng một bóng đổ cứng màu mực để chữ nổi cả trên nền trắng.
 */
export const outlined = (size: number, stroke: string, fill = WHITE, weight = 0.2): React.CSSProperties => ({
  color: fill,
  WebkitTextStroke: `${(size * weight).toFixed(1)}px ${stroke}`,
  paintOrder: "stroke fill",
  textShadow: `0 ${(size * 0.07).toFixed(1)}px 0 ${INK}, 0 ${(size * 0.1).toFixed(1)}px ${(size * 0.18).toFixed(1)}px rgba(10,8,30,0.45)`,
});

/* ------------------------------------------------------------ nhịp */

/** Số frame của nhát chém đổi cảnh. */
export const SLASH_FRAMES = 10;

/** Frame đầu tiên phần tử của cảnh được phép hiện: cảnh đầu phải đợi màn hình tiêu đề rút. */
export const showFrom = (index: number, startFrame: number, showTitle: boolean) =>
  index <= 0 && showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;

/** Frame câu nhấn "đập" xuống (kẹp sau màn hình tiêu đề). */
export const punchFrame = (scene: Scene, showTitle: boolean) =>
  Math.max(msToFrames(scene.punch?.atMs ?? scene.startMs), showTitle ? TITLE_FRAMES : 0);

/**
 * Rung khung khi câu nhấn đập xuống: 14 frame, biên độ giảm dần, hướng bốc thăm theo seed từng frame.
 * Trả [dx, dy] theo đơn vị unit.
 */
export const shakeAt = (frame: number, at: number, key: string): [number, number] => {
  const t = frame - at;
  if (t < 0 || t >= 14) return [0, 0];
  const amp = 16 * Math.pow(1 - t / 14, 1.6);
  return [seeded(`${key}-x-${t}`, -1, 1) * amp, seeded(`${key}-y-${t}`, -1, 1) * amp];
};

/* ------------------------------------------------------------ câu nhấn */

/** Vị trí cụm nhấn trong câu (so không phân biệt hoa thường) — [đầu, cuối) hoặc null. */
export const punchRange = (text: string, punch: string): [number, number] | null => {
  const hay = text.normalize("NFC").toLocaleLowerCase("vi");
  const needle = punch.normalize("NFC").trim().toLocaleLowerCase("vi");
  if (!needle || hay.length !== text.normalize("NFC").length) return null;
  const at = hay.indexOf(needle);
  return at < 0 ? null : [at, at + needle.length];
};

/**
 * Cỡ chữ để một khối chữ in hoa Montserrat 900 (mỗi ký tự ~0.74em) vừa `maxWidth` trong tối đa `maxLines`
 * dòng. Ước lượng thô nhưng đủ an toàn: chừa 2 ký tự mỗi dòng cho chỗ ngắt từ.
 */
export const fitHeavy = (text: string, base: number, maxWidth: number, maxLines: number, charW = 0.74) => {
  const length = Math.max(1, glyphs(text).length);
  const longestWord = Math.max(1, ...text.split(/\s+/).map((w) => glyphs(w).length));
  let best = base;
  for (let lines = 1; lines <= maxLines; lines++) {
    const perLine = Math.ceil(length / lines) + (lines > 1 ? 2 : 0);
    const size = Math.min(base, maxWidth / (Math.max(perLine, longestWord) * charW));
    if (lines === 1) best = size;
    else best = Math.max(best, size);
    if (size >= base) break;
  }
  return Math.round(best);
};
