/**
 * Màu, chữ khối và nhịp camera của phong cách "Không gian 3D".
 * Mọi "ngẫu nhiên" đi qua seeded() — cùng frame cùng hình, render song song không lệch.
 */
import { Easing } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = { ...clamp, easing: Easing.out(Easing.cubic) } as const;

/** Chữ khối: Montserrat biến thiên 100–900, đủ dấu tiếng Việt, đóng gói sẵn (chạy cả Windows). */
export const HEAVY = FONT_CATALOG.montserrat.stack;
/** Phụ đề: Be Vietnam Pro — nét đậm mà vẫn dễ đọc ở câu dài. */
export const BODY = FONT_CATALOG.bevietnam.stack;
export const DEPTH_FONTS = ["montserrat", "bevietnam"];

/** Khoảng không: gần đen, ngả xanh tím. */
export const VOID = "#04050d";

/** Số frame cảnh mới bay tới / cảnh cũ bay qua camera. */
export const ENTER_FRAMES = 24;
export const EXIT_FRAMES = 18;

/* ------------------------------------------------------------ bảng màu */

const hueOf = (hex: string): { h: number; s: number } | null => {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s };
};

export type Palette = {
  hue: number;
  /** Mặt chữ nhấn, viền kính, lưới sàn. */
  key: string;
  /** Thành khối (phần "dày" của chữ và tấm kính) — cùng sắc độ, tối hơn nhiều. */
  side: string;
  /** Quầng sáng. */
  glow: (alpha: number) => string;
  /** Trời: đỉnh → chân trời. */
  skyTop: string;
  skyHorizon: string;
};

/** Mọi màu suy từ `accent`; accent xám/trắng/đen → tím điện (265°). */
export const paletteFor = (accent: string): Palette => {
  const c = hueOf(accent);
  const hue = !c || c.s < 0.15 ? 265 : Math.round(c.h);
  return {
    hue,
    key: `hsl(${hue}, 95%, 64%)`,
    side: `hsl(${hue}, 70%, 24%)`,
    glow: (alpha) => `hsla(${hue}, 100%, 62%, ${alpha})`,
    skyTop: `hsl(${(hue + 25) % 360}, 55%, 6%)`,
    skyHorizon: `hsl(${hue}, 65%, 16%)`,
  };
};

/* ------------------------------------------------------------ chữ khối */

/**
 * Chữ nổi khối bằng text-shadow: `layers` lớp cùng màu thành xếp chồng chéo xuống phải (mỗi lớp `step` px),
 * lớp gần mặt chữ sáng hơn một chút để có cảm giác cạnh vát, rồi một bóng mềm rơi xuống "sàn".
 * Kích thước theo cỡ chữ nên chữ to chữ nhỏ đều cân.
 */
export const extrude = (side: string, size: number, layers = 8, shadowAlpha = 0.55) => {
  const step = Math.max(0.8, size / 70);
  const out: string[] = [];
  for (let i = 1; i <= layers; i++) {
    out.push(`${(i * step * 0.45).toFixed(1)}px ${(i * step).toFixed(1)}px 0 ${side}`);
  }
  const far = layers * step;
  out.push(`${(far * 0.6).toFixed(1)}px ${(far * 1.6).toFixed(1)}px ${(far * 1.4).toFixed(1)}px rgba(0,0,0,${shadowAlpha})`);
  return out.join(", ");
};

/** Viền tối rất mảnh quanh mặt chữ — đọc được cả trên ảnh sáng mà không mất vẻ khối. */
export const rim = (size: number) => `${Math.max(1, size / 60).toFixed(1)}px rgba(0,0,0,0.55)`;
