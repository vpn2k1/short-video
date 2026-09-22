/**
 * Màu, nhịp và hình học của phong cách "So sánh đối đầu". Hàm thuần, không React.
 *
 * Khung chia hai phe bằng một đường nối chéo có răng cưa:
 *  - Dọc (height > width): phe A ở trên, phe B ở dưới.
 *  - Ngang / vuông: phe A bên trái, phe B bên phải.
 * Mọi vị trí đều suy từ `seamAt()` — đường chéo gốc (chưa tính răng cưa) — nên đổi độ chéo
 * hay biên độ răng cưa là bố cục tự khớp.
 */
import { Easing, interpolate } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";

export const DISPLAY = FONT_CATALOG.anton.stack;
export const BODY = FONT_CATALOG.bevietnam.stack;
/** Nền tối dưới ảnh và trong hộp chữ. */
export const NIGHT = "#0b0b12";

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
/** Đập xuống: vọt quá một chút rồi dừng. */
export const SLAM = Easing.out(Easing.back(1.6));

/** Số frame ảnh mới trượt vào phe của nó. */
export const ENTER_FRAMES = 14;
/** Số frame phe kia tối dần khi lượt chuyển sang phe này. */
export const DIM_FRAMES = 10;
/** Số frame phe A nuốt trọn khung ở cảnh kết luận. */
export const VERDICT_FRAMES = 18;

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

const toHsl = ([r, g, b]: [number, number, number]) => {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return { h: h * 60, s, l };
};

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;

/**
 * Hai màu phe. A = accent (giữ nguyên), B = màu đối bù (xoay hue 180°), ép đủ bão hoà và sáng vừa để hai
 * phe luôn tương phản. Accent xám/đen/trắng (không có hue) → B là xanh lam điện.
 */
export const sideColors = (accent: string) => {
  const rgb = parseHex(accent);
  if (!rgb) return { a: accent, b: "#2f8cff" };
  const { h, s } = toHsl(rgb);
  if (s < 0.15) return { a: accent, b: "#2f8cff" };
  return { a: accent, b: hsl(h + 180, Math.max(0.72, s), 0.56) };
};

/** Chữ đặt trên nền màu phe: đen nếu màu sáng, trắng nếu màu tối. Màu hsl() của phe B luôn sáng vừa → trắng. */
export const inkOn = (color: string) => {
  const rgb = parseHex(color);
  if (!rgb) return "#ffffff";
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return lum > 0.62 ? NIGHT : "#ffffff";
};

// ---------------------------------------------------------------------------
// Hình học đường nối
// ---------------------------------------------------------------------------
export type Geo = {
  W: number;
  H: number;
  u: number;
  portrait: boolean;
  /** Độ lệch của đường chéo mỗi đầu so với tâm. */
  tilt: number;
  /** Biên độ răng cưa. */
  amp: number;
  /** Số răng cưa trên cả chiều dài. */
  teeth: number;
  /** Bán kính huy hiệu VS. */
  emblemR: number;
};

export const makeGeo = (W: number, H: number, u: number): Geo => {
  const portrait = H > W;
  return {
    W,
    H,
    u,
    portrait,
    tilt: (portrait ? 70 : 60) * u,
    amp: 20 * u,
    teeth: portrait ? 9 : 11,
    emblemR: (portrait ? 92 : 84) * u,
  };
};

/**
 * Vị trí đường chéo gốc (chưa răng cưa) theo trục chính tại toạ độ ngang `c`.
 * Dọc: trả y tại x = c (trái thấp, phải cao). Ngang: trả x tại y = c (trên lệch phải, dưới lệch trái).
 */
export const seamAt = (g: Geo, c: number, offset = 0) =>
  g.portrait
    ? g.H / 2 + offset + g.tilt * (1 - (2 * c) / g.W)
    : g.W / 2 + offset + g.tilt * (1 - (2 * c) / g.H);

/** Các điểm răng cưa của đường nối, đi theo trục ngang (dọc: trái → phải; ngang: trên → dưới). */
export const seamPoints = (g: Geo, offset = 0): [number, number][] => {
  const cross = g.portrait ? g.W : g.H;
  const pts: [number, number][] = [];
  const n = g.teeth * 2;
  for (let i = -1; i <= n + 1; i++) {
    const c = (i / n) * cross;
    const main = seamAt(g, c, offset) + (i % 2 === 0 ? -g.amp : g.amp);
    pts.push(g.portrait ? [c, main] : [main, c]);
  }
  return pts;
};

const poly = (pts: [number, number][]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;

/** clip-path của một phe trên lớp phủ toàn khung. */
export const sideClip = (g: Geo, side: 0 | 1, offset = 0) => {
  const pts = seamPoints(g, offset);
  const far = 4 * Math.max(g.W, g.H);
  if (g.portrait) {
    return side === 0
      ? poly([[-far, -far], [g.W + far, -far], ...[...pts].reverse()])
      : poly([...pts, [g.W + far, g.H + far], [-far, g.H + far]]);
  }
  return side === 0
    ? poly([[-far, -far], ...pts, [-far, g.H + far]])
    : poly([...pts, [g.W + far, g.H + far], [g.W + far, -far]]);
};

export type Rect = { x: number; y: number; w: number; h: number };

/** Khung bao của một phe — ảnh đặt vừa khung này (cover) để chủ thể nằm giữa phe chứ không giữa màn hình. */
export const sideBounds = (g: Geo, side: 0 | 1, offset = 0): Rect => {
  const lo = seamAt(g, g.portrait ? g.W : g.H, offset) - g.amp;
  const hi = seamAt(g, 0, offset) + g.amp;
  if (g.portrait) {
    return side === 0
      ? { x: 0, y: 0, w: g.W, h: Math.min(g.H, Math.max(1, hi)) }
      : { x: 0, y: Math.max(0, lo), w: g.W, h: Math.max(1, g.H - Math.max(0, lo)) };
  }
  return side === 0
    ? { x: 0, y: 0, w: Math.min(g.W, Math.max(1, hi)), h: g.H }
    : { x: Math.max(0, lo), y: 0, w: Math.max(1, g.W - Math.max(0, lo)), h: g.H };
};

/** Khoảng đẩy đường nối để phe A nuốt trọn khung (cảnh kết luận). */
export const verdictOffset = (g: Geo) => (g.portrait ? g.H : g.W) / 2 + g.tilt + g.amp * 2 + 40 * g.u;

// ---------------------------------------------------------------------------
// Chữ
// ---------------------------------------------------------------------------
/** In hoa tiếng Việt bằng JS (CSS text-transform làm lệch móc Ư/Ơ với font hẹp). */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Ước số dòng khi chữ xuống dòng trong bề rộng `width`. */
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

/** Co cỡ chữ tới khi câu vừa `maxLines` dòng trong bề rộng `width` (không nhỏ hơn `min`). */
export const fitText = (text: string, base: number, width: number, maxLines: number, charWidth: number, min = base * 0.55) => {
  let size = base;
  while (size > min && estimateLines(text, size, width, charWidth) > maxLines) size *= 0.94;
  size = Math.max(min, size);
  return { size: Math.round(size), lines: estimateLines(text, size, width, charWidth) };
};
