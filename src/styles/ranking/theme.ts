/**
 * Màu, easing, in hoa, đo chữ và tách dữ liệu xếp hạng của phong cách "Top xếp hạng".
 * Không có React ở đây.
 *
 * Đo chữ bằng canvas 2D (đồng bộ, xác định, đúng font hệ thống lúc render), cache theo chuỗi.
 */
import { Easing, interpolate } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { FONTS } from "../shared";

export const FONT = FONTS.sans;

export const STAGE = "#07080E";
export const STAGE_2 = "#11131F";
export const INK = "#12131A";
export const WHITE = "#FFFFFF";
export const GOLD = "#FFC93C";
export const GOLD_DEEP = "#E89B0C";
export const GOLD_LIGHT = "#FFF1B8";
/** Gradient vàng cho số hạng #1, vương miện, thanh tên và viên câu nhấn. */
export const GOLD_GRADIENT = `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 38%, ${GOLD_DEEP} 72%, #B86E00 100%)`;

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

/** Nảy quá đích rồi về 1 — kiểu back-out, dùng cho các cú "bật". */
export const backOut = (t: number, overshoot = 1.9) => {
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
};

/** In hoa tiếng Việt bằng JS — KHÔNG dùng CSS text-transform (móc Ư/Ơ bị tách rời). */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");
export const nfc = (text: string) => text.normalize("NFC");

export const withAlpha = (color: string, alpha: number) => {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return color;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Màu chữ đọc được trên nền `color`: nền sáng → mực đen, nền tối → trắng. */
export const textOn = (color: string) => {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return WHITE;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? INK : WHITE;
};

/* ------------------------------------------------------------ đo chữ */

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

/** Bề rộng chuỗi ở cỡ 100px. */
const measureAt100 = (text: string, weight: number) => {
  const key = `${weight}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = [...text].length * 60; // dự phòng khi không có DOM
  if (typeof document !== "undefined") {
    if (!ctx) ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `${weight} 100px ${FONT}`;
      width = ctx.measureText(text).width;
    }
  }
  widthCache.set(key, width);
  return width;
};

export const measure = (text: string, size: number, weight = 800) => (measureAt100(text, weight) * size) / 100;

/** Canvas và DOM lệch vài phần trăm — chia dòng với bề rộng hụt đi một chút. */
const SAFETY = 0.94;

const wrapLines = (text: string, size: number, maxWidth: number, weight: number) => {
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
 * Cân dòng: tìm bề rộng hẹp nhất vẫn giữ nguyên số dòng, để không còn một chữ mồ côi
 * ở dòng cuối ("…ngừng / đập.").
 */
const balance = (text: string, size: number, maxWidth: number, weight: number, lines: string[]) => {
  if (lines.length < 2) return lines;
  let lo = maxWidth * 0.4;
  let hi = maxWidth;
  let best = lines;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const attempt = wrapLines(text, size, mid, weight);
    if (attempt.length === lines.length) {
      best = attempt;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
};

/**
 * Cỡ chữ lớn nhất (max → min) để chữ gọn trong `maxLines` dòng.
 * Nhỏ nhất vẫn tràn thì cắt dòng cuối kèm "…" — không bao giờ tràn khung.
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
    if (lines.length <= maxLines && widest <= maxWidth * SAFETY) {
      return { size: Math.floor(size), lines: balance(clean, size, maxWidth, weight, lines) };
    }
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

/* ------------------------------------------------------------ dữ liệu xếp hạng */

export type RankItem = {
  /** Chỉ số cảnh. */
  index: number;
  rank: number;
  /** Tên món (đã bỏ tiền tố hạng), có thể rỗng. */
  name: string;
  scene: Scene;
};

/** "#3 Bánh mì", "# 3 Bánh mì", "3. Phở", "3) Phở", "Top 3: Phở", "3 - Phở" → hạng + tên. */
const RANK_PREFIX = /^\s*(?:top\s*)?#?\s*(\d{1,2})\s*(?:[.):\-–—]\s*)?/i;

export const parseTag = (tag: string | null): { rank: number | null; name: string } => {
  if (!tag) return { rank: null, name: "" };
  const clean = nfc(tag).trim();
  const match = clean.match(RANK_PREFIX);
  // "2 triệu" hay "10 món" không phải hạng: số phải đứng riêng (có # / dấu câu) hoặc cả tag chỉ là số.
  if (match && (/[#.):\-–—]/.test(match[0]) || /^top/i.test(match[0]) || match[0].trim() === clean)) {
    return { rank: Number(match[1]), name: clean.slice(match[0].length).trim() };
  }
  return { rank: null, name: clean };
};

/**
 * Mỗi cảnh một hạng. Tag có số ở đầu thì lấy số đó; không thì đếm ngược theo thứ tự cảnh
 * (cảnh đầu = hạng cao nhất = số cảnh, cảnh cuối = #1). Tên trống → dùng câu nhấn.
 */
export const rankItems = (scenes: Scene[]): RankItem[] =>
  scenes.map((scene, index) => {
    const parsed = parseTag(scene.tag);
    const rank = parsed.rank ?? scenes.length - index;
    const name = parsed.name || (scene.punch ? nfc(scene.punch.text).trim() : "");
    return { index, rank: Math.max(0, rank), name, scene };
  });

export const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
