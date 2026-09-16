/**
 * Bảng màu của phong cách chữ động — suy ra từ `accent` và `background`.
 * Mỗi cảnh một nền phẳng; màu chữ và màu khối nhấn luôn chọn theo độ tương phản
 * (WCAG) so với nền đó nên accent sáng hay tối đều đọc được.
 */

type Rgb = [number, number, number];

const parseHex = (hex: string): Rgb | null => {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
};

const toHex = ([r, g, b]: Rgb) =>
  "#" +
  [r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
    .join("");

const luminance = (hex: string) => {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const rgbToHsl = ([r, g, b]: Rgb): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
};

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

/** Màu có tương phản cao nhất với nền trong danh sách ứng viên. */
const best = (bg: string, candidates: string[]) =>
  candidates.reduce((a, b) => (contrast(b, bg) > contrast(a, bg) ? b : a));

export type Swatch = {
  /** Màu nền phẳng của cảnh. */
  bg: string;
  /** Màu chữ chính. */
  fg: string;
  /** Màu khối nhấn (punch, thanh tag, thanh tiến độ). */
  hi: string;
  /** Màu chữ nằm trên khối nhấn. */
  hiFg: string;
  /** Nền tối → ảnh texture hoà kiểu screen, nền sáng → multiply. */
  dark: boolean;
};

export const buildPalette = (accentHex: string, backgroundHex: string): Swatch[] => {
  const accent = parseHex(accentHex) ? toHex(parseHex(accentHex)!) : "#ff4d2e";
  const bgIn = parseHex(backgroundHex) ? toHex(parseHex(backgroundHex)!) : "#111111";

  // Gần đen: dùng background nếu nó đủ tối, không thì than chì.
  const ink = luminance(bgIn) < 0.03 ? bgIn : "#121212";
  // Trắng ngà ấm, tránh trắng tinh chói mắt.
  const paper = "#f4efe6";
  // Màu bổ túc: xoay hue 180°, giữ bão hoà vừa, độ sáng trung bình để khác hẳn accent.
  const [h, s] = rgbToHsl(parseHex(accent)!);
  const complement = toHex(hslToRgb((h + 180) % 360, Math.max(0.45, Math.min(0.8, s)), 0.5));

  const textFor = (bg: string) => best(bg, [ink, paper]);

  const swatch = (bg: string): Swatch => {
    const fg = textFor(bg);
    // Khối nhấn ưu tiên accent; nếu accent chìm trên nền này thì lấy màu tương phản nhất.
    const hi = bg !== accent && contrast(accent, bg) >= 2.6 ? accent : best(bg, [ink, paper, complement]);
    // Chữ trên khối: ưu tiên accent khi khối là mực/giấy và đọc được, không thì đen/ngà.
    const hiFg = hi !== accent && contrast(accent, hi) >= 3.2 ? accent : textFor(hi);
    return { bg, fg, hi, hiFg, dark: luminance(bg) < 0.18 };
  };

  return [swatch(ink), swatch(accent), swatch(paper), swatch(complement)];
};
