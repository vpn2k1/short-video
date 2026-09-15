/**
 * Màu, chữ và hình học dùng chung cho phong cách Truyện tranh. Hàm thuần — không React.
 */
import { seeded } from "../shared";

export const INK = "#141210";
export const PAPER = "#FFF4DA";
export const YELLOW = "#FFE14D";
export const WHITE = "#FFFFFF";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * In hoa tiếng Việt bằng JS (KHÔNG dùng CSS text-transform/letter-spacing): chuẩn hoá NFC
 * để Ư/Ơ/Ừ… là glyph dựng sẵn, móc không bị tách.
 */
export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi").normalize("NFC");

/** Hex → hue 0..360. Hex hỏng thì trả hue đỏ cam. */
export const hueOf = (hex: string): number => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}/i.test(h)) {
    return 12;
  }
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) {
    return 12;
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
 * Bảng màu in 4 màu của một trang: `hot` bám accent (nổ, băng rôn), `cool` là màu bù
 * (huy hiệu số liệu), `dots` cho chấm halftone nền. Lệch hue nhẹ theo trang.
 */
export const comicPalette = (accent: string, index: number) => {
  const base = hueOf(accent);
  const hue = wrap(base + seeded(`comic-hue-${index}`, -14, 14));
  const comp = wrap(base + 180 + seeded(`comic-comp-${index}`, -30, 30));
  return {
    hot: `hsl(${hue.toFixed(0)}, 88%, 52%)`,
    hotLight: `hsl(${hue.toFixed(0)}, 95%, 62%)`,
    hotDark: `hsl(${hue.toFixed(0)}, 80%, 34%)`,
    cool: `hsl(${comp.toFixed(0)}, 80%, 60%)`,
    coolLight: `hsl(${comp.toFixed(0)}, 85%, 72%)`,
    dots: `hsl(${hue.toFixed(0)}, 85%, 62%)`,
    dotsAlt: `hsl(${comp.toFixed(0)}, 70%, 64%)`,
  };
};

/**
 * Viền chữ đậm bằng một vòng text-shadow (bền hơn -webkit-text-stroke với glyph có dấu
 * ghép), cộng thêm bóng khối cứng lệch xuống phải nếu `depth` > 0.
 */
export const outline = (width: number, color = INK, depth = 0, depthColor = INK) => {
  const ring = (dx: number, dy: number, c: string) => {
    const parts: string[] = [];
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      parts.push(`${(dx + Math.cos(a) * width).toFixed(2)}px ${(dy + Math.sin(a) * width).toFixed(2)}px 0 ${c}`);
    }
    return parts;
  };
  const shadows = ring(0, 0, color);
  if (depth > 0) {
    shadows.push(...ring(depth, depth, depthColor));
  }
  return shadows.join(", ");
};

/**
 * Cỡ chữ lớn nhất để khối chữ vừa hộp: không từ nào tràn ngang, tổng số dòng vừa chiều cao.
 * Ước lượng bề rộng ký tự theo em (`charW`) — đủ chính xác cho chữ in hoa đậm.
 */
export const fitBlock = (
  text: string,
  opts: { maxWidth: number; maxHeight: number; base: number; charW?: number; lineH?: number; min?: number },
) => {
  const { maxWidth, maxHeight, base, charW = 0.68, lineH = 1.12, min = 0 } = opts;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return base;
  let fs = base;
  for (let k = 0; k < 40; k++) {
    const cw = fs * charW;
    const longest = Math.max(...words.map((w) => [...w].length)) * cw;
    let lines = 1;
    let cur = 0;
    for (const w of words) {
      const ww = [...w].length * cw;
      const next = cur === 0 ? ww : cur + fs * 0.3 + ww;
      if (next > maxWidth && cur > 0) {
        lines++;
        cur = ww;
      } else {
        cur = next;
      }
    }
    if (longest <= maxWidth && lines * fs * lineH <= maxHeight) return Math.max(min, fs);
    fs *= 0.94;
  }
  return Math.max(min, fs);
};

/**
 * Đa giác hình nổ (starburst) trong hệ toạ độ 0..100: xen kẽ đỉnh nhọn và chân,
 * bán kính lệch ngẫu nhiên cố định theo khoá.
 */
export const burstPoints = (key: string, spikes: number, outer: number, inner: number, jitter: number) => {
  const pts: string[] = [];
  const offset = seeded(`${key}-rot`, 0, Math.PI * 2);
  for (let i = 0; i < spikes * 2; i++) {
    const isTip = i % 2 === 0;
    const a = offset + (i / (spikes * 2)) * Math.PI * 2 + seeded(`${key}-a${i}`, -0.06, 0.06);
    const r = isTip ? outer + seeded(`${key}-r${i}`, -jitter, jitter) : inner + seeded(`${key}-r${i}`, -jitter * 0.3, jitter * 0.3);
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
};
