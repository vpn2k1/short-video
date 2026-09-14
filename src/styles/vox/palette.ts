/**
 * Màu cho phong cách Vox: giấy, highlighter, mực, và cặp màu loang đổi theo cảnh.
 * Hàm thuần — không đụng React.
 */
import { seeded } from "../shared";

export const PAPER = "#F3EBDC";
export const PAPER_LIGHT = "#FBF7EE";
export const INK = "#1C1916";
export const HIGHLIGHT = "#FFE14D";
export const GRID = "rgba(64, 104, 148, 0.15)";

/** Hex (#rgb hoặc #rrggbb) → hue 0..360. Hex hỏng thì trả hue cam mặc định. */
export const hueOf = (hex: string): number => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}/i.test(h)) {
    return 24;
  }
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) {
    return 24;
  }
  let hue: number;
  if (max === r) {
    hue = ((g - b) / d) % 6;
  } else if (max === g) {
    hue = (b - r) / d + 2;
  } else {
    hue = (r - g) / d + 4;
  }
  return (hue * 60 + 360) % 360;
};

const wrap = (h: number) => ((h % 360) + 360) % 360;

/**
 * Cặp màu loang của một cảnh: A bám accent (lệch nhẹ), B là màu bù lệch ngẫu nhiên.
 * Cùng accent + cùng chỉ số cảnh → cùng màu (seeded).
 */
export const scenePalette = (accent: string, index: number) => {
  const base = hueOf(accent);
  const hueA = wrap(base + seeded(`vox-hueA-${index}`, -28, 28));
  const hueB = wrap(base + 180 + seeded(`vox-hueB-${index}`, -50, 50));
  return {
    splashA: `hsl(${hueA.toFixed(0)}, 82%, 64%)`,
    splashB: `hsl(${hueB.toFixed(0)}, 68%, 66%)`,
    dots: `hsl(${hueB.toFixed(0)}, 45%, 32%)`,
    note: `hsl(${hueB.toFixed(0)}, 80%, 84%)`,
    stamp: `hsl(${hueA.toFixed(0)}, 72%, 38%)`,
  };
};
