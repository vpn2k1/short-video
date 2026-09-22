/**
 * Bố cục đồ hoạ truyền hình của phong cách "Thể thao" — tính MỘT lần từ toàn bộ dữ liệu để các bảng không nhảy
 * giữa các câu: dải phụ đề giữ chỗ bằng câu cao nhất, bảng tên và bảng số đặt trên nó theo chỗ đã giữ.
 *
 *   Dọc (9:16):   bảng tỉ số góc trên trái · câu nhấn giữa-trên · (bảng số → bảng tên → dải phụ đề → ticker) chồng ở đáy.
 *   Ngang/vuông:  bảng tỉ số góc trên trái · bảng số góc trên phải · câu nhấn giữa · bảng tên + dải phụ đề + ticker ở đáy trái.
 */
import type { Caption, Scene } from "../../compositions/Short/schema";
import { fitText } from "./theme";

export type Safe = { top: number; bottom: number; side: number };

export type SportLayout = {
  W: number;
  H: number;
  u: number;
  portrait: boolean;
  /** Lề trái / phải của khối đồ hoạ. */
  left: number;
  right: number;
  /** Bảng tỉ số. */
  bug: { x: number; y: number; h: number };
  /** Dải phụ đề: bề rộng cố định, đáy nằm ngay trên ticker. */
  bar: {
    x: number;
    w: number;
    /** Toạ độ đáy dải phụ đề. */
    bottom: number;
    /** Chiều cao giữ chỗ (câu cao nhất). */
    maxH: number;
    /** Nắp chéo trái (màu accent) / phải (trắng) và độ xiên. */
    capL: number;
    capR: number;
    slant: number;
    padX: number;
    padY: number;
    /** Bề rộng thật cho chữ. */
    textW: number;
    base: number;
    min: number;
  };
  ticker: { y: number; h: number };
  /** Bảng tên: đáy của nó. */
  tag: { x: number; bottom: number; h: number; maxW: number };
  /** Bảng số liệu: neo góc (trái-dưới ở khung dọc, phải-trên ở khung ngang). */
  stat: { x: number; y: number; w: number; anchor: "bottom" | "top"; align: "left" | "right" };
  /** Câu nhấn: tâm và khung tối đa. */
  punch: { cx: number; cy: number; maxW: number; maxH: number };
};

/** Cỡ chữ phụ đề và số dòng của một câu trong dải phụ đề. */
export const captionFit = (text: string, L: SportLayout) =>
  fitText(text, L.bar.base, L.bar.textW, 3, 0.47, L.bar.min);

export const LINE_HEIGHT = 1.3;

export const barHeight = (text: string, L: SportLayout) => {
  const { size, lines } = captionFit(text, L);
  return lines * size * LINE_HEIGHT + L.bar.padY * 2;
};

export const statHeight = (u: number, hasCaption: boolean, percent: boolean) =>
  (percent ? 190 : 170) * u + (hasCaption ? 0 : -36 * u);

export const makeLayout = (W: number, H: number, u: number, safe: Safe, captions: Caption[], scenes: Scene[]): SportLayout => {
  const portrait = H > W;
  const left = portrait ? 56 * u : safe.side;
  const right = portrait ? safe.side : safe.side;
  const barW = portrait ? W - left - right : Math.min(W - left - right, 1240 * u);
  const capL = 34 * u;
  const capR = 22 * u;
  const slant = 26 * u;
  const padX = 30 * u;
  const tickerH = 44 * u;
  const tickerY = H - safe.bottom - tickerH;

  const L: SportLayout = {
    W,
    H,
    u,
    portrait,
    left,
    right,
    bug: { x: left, y: safe.top + (portrait ? 0 : 0), h: 62 * u },
    bar: {
      x: left,
      w: barW,
      bottom: tickerY,
      maxH: 0,
      capL,
      capR,
      slant,
      padX,
      padY: 20 * u,
      textW: barW - capL - capR - slant * 2 - padX * 2,
      base: (portrait ? 58 : 50) * u,
      min: (portrait ? 34 : 30) * u,
    },
    ticker: { y: tickerY, h: tickerH },
    tag: { x: left, bottom: 0, h: 78 * u, maxW: Math.min(barW, 760 * u) },
    stat: { x: 0, y: 0, w: 0, anchor: "bottom", align: "left" },
    punch: { cx: W / 2, cy: 0, maxW: 0, maxH: 0 },
  };

  const maxBar = captions.reduce((m, c) => Math.max(m, barHeight(c.text, L)), 0);
  L.bar.maxH = Math.max(maxBar, captions.length ? 0 : 0);
  const hasTag = scenes.some((s) => s.tag);
  L.tag.bottom = tickerY - L.bar.maxH - 16 * u;
  const tagTop = hasTag ? L.tag.bottom - L.tag.h : L.tag.bottom;

  if (portrait) {
    const statW = Math.min(barW, 720 * u);
    L.stat = { x: left, y: tagTop - 22 * u, w: statW, anchor: "bottom", align: "left" };
    const hasStat = scenes.some((s) => s.visual);
    const statTop = hasStat ? L.stat.y - statHeight(u, true, true) : tagTop;
    // Câu nhấn nằm ở khoảng giữa bảng tỉ số và khối đồ hoạ đáy, lệch lên trên một chút cho khỏi đè mặt người.
    const top = L.bug.y + L.bug.h + 40 * u;
    const bottom = statTop - 30 * u;
    L.punch = { cx: W / 2, cy: Math.min(H * 0.36, (top + bottom) / 2), maxW: W - 2 * 70 * u, maxH: Math.max(160 * u, Math.min(H * 0.24, bottom - top)) };
  } else {
    const statW = Math.min(W * 0.32, 560 * u);
    L.stat = { x: W - right - statW, y: safe.top, w: statW, anchor: "top", align: "right" };
    const top = safe.top + 60 * u;
    const bottom = tagTop - 30 * u;
    L.punch = { cx: W / 2, cy: Math.max(top + H * 0.14, Math.min(H * 0.47, (top + bottom) / 2 + 40 * u)), maxW: W * 0.62, maxH: Math.max(150 * u, Math.min(H * 0.3, bottom - top)) };
  }
  return L;
};
