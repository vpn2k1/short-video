/**
 * Màu, easing, đo chữ và các hàm thuần của phong cách "Bản tin nóng".
 * Không có React ở đây.
 *
 * Đo chữ bằng canvas 2D (đồng bộ, xác định, dùng đúng font hệ thống lúc render) —
 * project không có @remotion/layout-utils. Kết quả cache theo chuỗi.
 */
import { Easing, interpolate } from "remotion";
import { FONTS } from "../shared";

export const RED = "#D71920";
export const RED_DARK = "#9E0F14";
export const NAVY = "#0B1B3F";
export const NAVY_DEEP = "#050D22";
export const YELLOW = "#FFC400";
export const INK = "#10131A";
export const WHITE = "#FFFFFF";

export const FONT = FONTS.sans;
export const MONO = FONTS.mono;

/** Vào nhanh, dừng gắt — kiểu đồ hoạ truyền hình. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const EASE_INOUT = Easing.bezier(0.75, 0, 0.2, 1);

/** Nội suy 0→1 có kẹp hai đầu. Dãy mốc luôn tăng nghiêm ngặt vì length ≥ 1. */
export const ramp = (frame: number, from: number, length: number, easing: (t: number) => number = EASE_OUT) =>
  interpolate(frame, [from, from + Math.max(1, length)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/**
 * In hoa tiếng Việt bằng JS — KHÔNG dùng CSS text-transform (móc Ư/Ơ bị tách rời).
 */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

export const nfc = (text: string) => text.normalize("NFC");

export const withAlpha = (color: string, alpha: number) => {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return color;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* ------------------------------------------------------------ đo chữ */

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

/** Bề rộng chuỗi ở cỡ 100px. Nhân tuyến tính cho cỡ khác. */
export const measureAt100 = (text: string, weight = 800, family: string = FONT) => {
  const key = `${weight}|${family}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = [...text].length * 58; // dự phòng khi không có DOM
  if (typeof document !== "undefined") {
    if (!ctx) ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `${weight} 100px ${family}`;
      width = ctx.measureText(text).width;
    }
  }
  widthCache.set(key, width);
  return width;
};

export const measure = (text: string, size: number, weight = 800, family: string = FONT) =>
  (measureAt100(text, weight, family) * size) / 100;

/** Canvas và DOM lệch nhau vài phần trăm — chia dòng với bề rộng hụt đi một chút. */
const SAFETY = 0.95;

/** Chia dòng tham lam theo từ, giống trình duyệt. Từ dài hơn cả dòng vẫn đứng riêng một dòng. */
export const wrapLines = (text: string, size: number, maxWidth: number, weight = 800) => {
  const words = nfc(text).trim().split(/\s+/).filter(Boolean);
  const limit = maxWidth * SAFETY;
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, size, weight) > limit) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export type Fitted = { size: number; lines: string[] };

/**
 * Cỡ chữ lớn nhất (giữa max và min) để chữ nằm gọn trong `maxLines` dòng.
 * Nhỏ nhất vẫn tràn thì cắt bớt dòng cuối và thêm "…" — không bao giờ tràn khung.
 */
export const fitText = (
  text: string,
  maxWidth: number,
  maxLines: number,
  maxSize: number,
  minSize: number,
  weight = 800,
): Fitted => {
  const clean = nfc(text).trim();
  if (!clean) return { size: maxSize, lines: [] };
  let size = maxSize;
  for (;;) {
    const lines = wrapLines(clean, size, maxWidth, weight);
    const widest = Math.max(...lines.map((l) => measure(l, size, weight)));
    if (lines.length <= maxLines && widest <= maxWidth * SAFETY) return { size: Math.floor(size), lines };
    if (size <= minSize) break;
    size = Math.max(minSize, size * 0.94);
  }
  size = Math.floor(minSize);
  const lines = wrapLines(clean, size, maxWidth, weight);
  if (lines.length <= maxLines) return { size, lines };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.includes(" ") && measure(`${last}…`, size, weight) > maxWidth * SAFETY) {
    last = last.slice(0, last.lastIndexOf(" "));
  }
  kept[maxLines - 1] = `${last}…`;
  return { size, lines: kept };
};

/* ------------------------------------------------------------ số liệu */

export type ParsedStat = {
  prefix: string;
  value: number;
  suffix: string;
  format: (v: number) => string;
};

/**
 * Tách con số đầu tiên trong chuỗi stat: "80%", "+30K", "1.200", "2,5 triệu".
 * "1.000" / "1,000" (nhóm 3 chữ số) là phân cách hàng nghìn; "2,5" / "2.5" là thập phân.
 * Không có số → null, khi đó vẽ chữ tĩnh.
 */
export const parseStat = (text: string): ParsedStat | null => {
  const match = text.match(/^(\D*?)(\d+(?:[.,]\d+)*)(.*)$/);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;

  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
    const sep = raw.match(/[.,]/)?.[0] ?? ".";
    const value = Number(raw.replace(/[.,]/g, ""));
    return {
      prefix,
      value,
      suffix,
      format: (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, sep),
    };
  }

  const decimal = raw.match(/^(\d+)([.,])(\d+)$/);
  if (decimal) {
    const places = decimal[3].length;
    const value = Number(`${decimal[1]}.${decimal[3]}`);
    return { prefix, value, suffix, format: (v) => v.toFixed(places).replace(".", decimal[2]) };
  }

  if (!/^\d+$/.test(raw)) return null;
  return { prefix, value: Number(raw), suffix, format: (v) => String(Math.round(v)) };
};
