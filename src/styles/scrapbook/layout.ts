/**
 * Bố cục bảng kỷ niệm theo khung hình thật:
 *  - Dọc / vuông: ảnh polaroid lớn ở trên, thẻ ghi chú (lời) ghim phía dưới, đè nhẹ lên dải trắng của ảnh.
 *  - Ngang: polaroid bên trái, thẻ ghi chú bên phải.
 * Ảnh của cảnh đã qua lùi về các "chỗ trống" quanh mép bảng, thu nhỏ — bảng đầy dần theo video.
 */
import type { useLayout } from "../shared";
import { CARD_LINE_HEIGHT, fitLines, HAND, lineCount } from "./text";

export type Rect = { x: number; y: number; w: number; h: number };
export type Slot = { x: number; y: number; rot: number };

export type Board = {
  stacked: boolean;
  /** Khung ngoài của polaroid đang kể. */
  hero: Rect;
  /** Viền trắng ba cạnh và dải trắng đáy của polaroid. */
  border: number;
  strip: number;
  /** Thẻ ghi chú chứa lời — null khi không có lời (phụ đề tuỳ chỉnh do composition vẽ). */
  card: (Rect & { size: number; lines: number; padTop: number; padX: number }) | null;
  /** Tâm các chỗ ảnh cũ lùi về, và góc nghiêng ở đó. */
  slots: Slot[];
  /** Tỉ lệ thu nhỏ của ảnh cũ. */
  oldScale: number;
};

/** Tỉ lệ viền theo bề rộng polaroid: viền 3.5%, dải đáy 15%. */
const BORDER = 0.035;
const STRIP = 0.15;

export const buildBoard = (layout: ReturnType<typeof useLayout>, captions: { text: string }[], ready: boolean): Board => {
  const { width, height, safe, unit } = layout;
  const stacked = height / width >= 0.95;

  // --- Thẻ ghi chú: một cỡ chữ chung cho mọi câu để thẻ không co giãn khi đổi câu. ---
  let card: Board["card"] = null;
  if (captions.length > 0) {
    const w = stacked ? width - 2 * Math.max(60 * unit, safe.side * 0.55) : width * 0.44;
    const padX = 42 * unit;
    const padTop = 58 * unit;
    const padBottom = 30 * unit;
    // Chừa 3% bề rộng — trình duyệt ngắt dòng hơi khác canvas.
    const inner = (w - padX * 2) * 0.97;
    const maxLines = stacked ? 3 : 4;
    const base = (stacked ? 72 : 68) * unit;
    const min = 44 * unit;
    const size = Math.min(...captions.map((c) => fitLines(c.text, base, min, inner, maxLines, HAND, 400, ready)));
    const lines = Math.max(1, ...captions.map((c) => lineCount(c.text, size, inner, HAND, 400, ready)));
    const h = padTop + lines * size * CARD_LINE_HEIGHT + padBottom;
    if (stacked) {
      const bottom = height - safe.bottom - 16 * unit;
      card = { x: (width - w) / 2, y: bottom - h, w, h, size, lines, padTop, padX };
    } else {
      const right = width - safe.side - 10 * unit;
      card = { x: right - w, y: (height - h) / 2 + 20 * unit, w, h, size, lines, padTop, padX };
    }
  }

  // --- Polaroid: to nhất có thể trong vùng của nó, ảnh không bẹt hơn 4:3 và không cao quá 1:1.28. ---
  const top = safe.top + 44 * unit;
  let bottomLimit: number;
  let targetW: number;
  if (stacked) {
    bottomLimit = card ? card.y + width * 0.76 * STRIP * 0.45 : height - safe.bottom - 20 * unit;
    targetW = width * 0.76;
  } else {
    bottomLimit = height - safe.bottom - 24 * unit;
    targetW = width * 0.36;
  }
  const availH = bottomLimit - top;
  // Cao ngoài = W·(viền + dải) + ảnh, ảnh cao = 0.93W·r. r = 0.75 là ảnh bẹt nhất cho phép.
  const frameK = BORDER + STRIP;
  const W = Math.min(targetW, availH / (frameK + (1 - BORDER * 2) * 0.75));
  const border = W * BORDER;
  const strip = W * STRIP;
  const photoW = W - border * 2;
  const photoH = Math.min(availH - border - strip, photoW * 1.28);
  const H = border + photoH + strip;
  const centerX = stacked ? width / 2 : safe.side + (width * 0.52 - safe.side) / 2;
  const hero = { x: centerX - W / 2, y: top + (availH - H) / 2, w: W, h: H };

  const slots: Slot[] = stacked
    ? [
      { x: 0.16, y: 0.12, rot: -11 }, { x: 0.85, y: 0.15, rot: 9 }, { x: 0.09, y: 0.46, rot: 7 },
      { x: 0.91, y: 0.5, rot: -8 }, { x: 0.18, y: 0.9, rot: 10 }, { x: 0.83, y: 0.9, rot: -6 },
    ]
    : [
      { x: 0.07, y: 0.2, rot: -10 }, { x: 0.63, y: 0.12, rot: 8 }, { x: 0.94, y: 0.22, rot: -7 },
      { x: 0.06, y: 0.82, rot: 9 }, { x: 0.6, y: 0.9, rot: -9 }, { x: 0.94, y: 0.84, rot: 6 },
    ];

  return {
    stacked,
    hero,
    border,
    strip,
    card,
    slots: slots.map((s) => ({ x: s.x * width, y: s.y * height, rot: s.rot })),
    oldScale: stacked ? 0.5 : 0.48,
  };
};
