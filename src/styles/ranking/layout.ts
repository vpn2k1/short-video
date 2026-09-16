/**
 * Bố cục + nhịp thời gian của "Top xếp hạng", tính một lần từ khung hình và TOÀN BỘ dữ liệu
 * để thẻ, bảng xếp hạng, phụ đề không nhảy kích thước khi đổi câu/cảnh.
 *
 *  - Dọc (9:16, 3:4): bảng xếp hạng là dải ngang trên cùng → thẻ ảnh lớn → câu nhấn → phụ đề.
 *  - Ngang / vuông: thẻ ảnh + phụ đề ở cột trái, bảng xếp hạng dọc ở cột phải.
 */
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, CaptionPosition, Scene } from "../../compositions/Short/schema";
import { useLayout } from "../shared";
import { fitText, type Fitted, rankItems, upper } from "./theme";

export const CAPTION_LH = 1.24;
export const NAME_LH = 1.18;

/** Thẻ trượt vào (frame tính từ `enter` của cảnh): từ -3 tới +7. */
export const WHIP_IN_FROM = -3;
export const WHIP_IN_LEN = 10;
/** Thẻ cũ bắt đầu văng ra trước điểm cắt 5 frame, trong 8 frame. */
export const WHIP_OUT_LEAD = 5;
export const WHIP_OUT_LEN = 8;
/** Mốc cục bộ của một cảnh. */
export const BEAT = {
  slam: 2,
  slamLen: 9,
  dock: 20,
  dockLen: 12,
  bar: 24,
  barLen: 12,
  /** Bảng xếp hạng lật tên khi thanh tên đã vào. */
  reveal: 28,
  stat: 34,
};

/** Ưu tiên một dòng (co tới `minOne`), không vừa mới chia hai dòng. */
const fitPreferOne = (text: string, width: number, max: number, minOne: number, minTwo: number, weight: number): Fitted => {
  const one = fitText(text, width, 1, max, minOne, weight);
  if (one.lines.length === 1 && !one.lines[0].endsWith("…")) return one;
  return fitText(text, width, 2, max, minTwo, weight);
};

export const useRankLayout = (
  scenes: Scene[],
  captions: Caption[],
  captionPosition: CaptionPosition,
  showTitle: boolean,
) => {
  const base = useLayout();
  const { width, height, safe, unit: u, captionBottom } = base;
  const strip = height > width * 1.15;
  const items = rankItems(scenes);
  const count = Math.max(1, items.length);

  /* ---------------- nhịp */
  // Thẻ đầu chỉ văng vào khi cụm "TOP N" đã gần ra hết — không để số hạng đè lên chữ mở đầu.
  const introEnd = showTitle ? TITLE_FRAMES - 2 : 0;
  const enters = scenes.map((s) => Math.max(msToFrames(s.startMs), introEnd));
  // Mốc vào phải tăng dần kể cả khi dữ liệu có cảnh chồng nhau.
  for (let i = 1; i < enters.length; i++) enters[i] = Math.max(enters[i], enters[i - 1] + WHIP_OUT_LEN + 2);

  /* ---------------- phụ đề */
  const capFontMax = (strip ? 54 : 44) * u;
  const capFontMin = (strip ? 38 : 30) * u;
  const capPadX = (strip ? 36 : 30) * u;
  const capPadY = (strip ? 20 : 16) * u;

  let boardX = 0;
  let boardY = 0;
  let boardW = 0;
  let boardH = 0;
  let cardX = 0;
  let cardY = 0;
  let cardW = 0;
  let capW = 0;
  let capCenterX = 0;

  if (strip) {
    const sideX = Math.round(Math.max(48 * u, safe.side * 0.5));
    boardX = sideX;
    boardY = safe.top + 12 * u;
    boardW = width - sideX * 2;
    boardH = 136 * u;
    cardX = sideX;
    cardY = boardY + boardH + 30 * u;
    cardW = width - sideX * 2;
    capW = width - Math.max(80 * u, safe.side * 0.75) * 2;
    capCenterX = width / 2;
  } else {
    const square = width < height * 1.3;
    boardW = (square ? 330 : 500) * u;
    boardX = width - safe.side - boardW;
    boardY = safe.top + 10 * u;
    cardX = safe.side;
    cardY = boardY;
    cardW = boardX - (square ? 30 : 40) * u - cardX;
    capW = cardW;
    capCenterX = cardX + cardW / 2;
  }

  const capTextW = capW - capPadX * 2;
  const fittedCaptions = captions.map((c) => fitText(c.text, capTextW, 2, capFontMax, capFontMin, 800));
  const capMaxH = capFontMax * CAPTION_LH * 2 + capPadY * 2;
  const capStripBottom = height - captionBottom;

  /* ---------------- thanh tên + câu nhấn */
  const barH = (strip ? 112 : 92) * u;
  const barOverlap = (strip ? 38 : 30) * u;
  const barInset = (strip ? 26 : 22) * u;
  const punchH = (strip ? 96 : 78) * u;
  const gap = (strip ? 24 : 20) * u;

  let imgH: number;
  if (strip) {
    const barBottom = capStripBottom - capMaxH - gap - punchH - gap;
    imgH = barBottom - barH + barOverlap - cardY;
  } else {
    const barBottom = capStripBottom - capMaxH - gap;
    imgH = barBottom - barH + barOverlap - cardY;
    boardH = capStripBottom - boardY;
  }
  imgH = Math.max(200 * u, imgH);
  const barY = cardY + imgH - barOverlap;
  // Phụ đề "center": giữa khung nhưng luôn nằm trên thanh tên, không che tên món.
  const capCenterY = Math.min(height / 2, barY - gap - capMaxH / 2);
  const barX = cardX + barInset;
  const barW = cardW - barInset * 2;
  const barPadX = (strip ? 34 : 28) * u;
  // Vạch màu dọc bên trái thanh tên.
  const barChip = 12 * u;
  const barTextW = barW - barPadX * 2 - barChip - 18 * u;
  const fittedNames = items.map((it) =>
    fitPreferOne(upper(it.name || `TOP ${it.rank}`), barTextW, (strip ? 62 : 50) * u, (strip ? 44 : 36) * u, (strip ? 34 : 28) * u, 900),
  );

  /* ---------------- số hạng */
  const bigFont = Math.min(imgH * 0.62, cardW * (strip ? 0.44 : 0.3));
  const badgeSize = (strip ? 156 : 122) * u;
  const badgeInset = (strip ? 26 : 22) * u;

  /* ---------------- bảng xếp hạng */
  const boardHeaderH = strip ? 0 : 70 * u;
  const rowGap = (strip ? 12 : 12) * u;
  const rowW = strip ? (boardW - rowGap * (count - 1)) / count : boardW;
  const rowH = strip ? boardH : Math.min(132 * u, (boardH - boardHeaderH - rowGap * count) / count);
  const rowRankW = strip ? 0 : rowH * 0.78;
  const rowPadX = (strip ? 14 : 18) * u;
  const rowTextW = strip ? rowW - rowPadX * 2 : rowW - rowRankW - rowPadX * 2 - 12 * u;
  const rowFontMax = (strip ? 28 : 34) * u;
  const rowFontMin = (strip ? 18 : 22) * u;
  const fittedRows = items.map((it) =>
    fitPreferOne(it.name || `Hạng ${it.rank}`, rowTextW, rowFontMax, rowFontMax * 0.8, rowFontMin, 800),
  );

  /* ---------------- câu nhấn */
  const punchFontMax = (strip ? 56 : 44) * u;
  const punchPadX = (strip ? 40 : 30) * u;
  const punchMaxW = strip ? width - Math.max(70 * u, safe.side * 0.6) * 2 : cardW - 40 * u;
  const fitPunch = (text: string) => fitText(upper(text), punchMaxW - punchPadX * 2, 1, punchFontMax, punchFontMax * 0.6, 900);

  return {
    ...base,
    strip,
    items,
    count,
    introEnd,
    enters,
    board: { x: boardX, y: boardY, w: boardW, h: boardH, headerH: boardHeaderH, rowGap, rowW, rowH, rowRankW, rowPadX },
    fittedRows,
    card: { x: cardX, y: cardY, w: cardW, imgH, radius: (strip ? 46 : 34) * u },
    bar: { x: barX, y: barY, w: barW, h: barH, padX: barPadX, chip: barChip },
    fittedNames,
    bigFont,
    badge: { size: badgeSize, inset: badgeInset },
    caption: {
      w: capW,
      centerX: capCenterX,
      bottom: capStripBottom,
      centered: captionPosition === "center",
      centerY: capCenterY,
      padX: capPadX,
      padY: capPadY,
      maxH: capMaxH,
    },
    fittedCaptions,
    punch: { h: punchH, padX: punchPadX, gap, fontMax: punchFontMax },
    fitPunch,
  };
};

export type RankLayout = ReturnType<typeof useRankLayout>;

/** Cảnh đang đứng trên sân khấu theo mốc `enters` (đã tính phần mở đầu); -1 nếu chưa có. */
export const currentAt = (L: RankLayout, frame: number) => {
  let current = -1;
  L.enters.forEach((enter, i) => {
    if (frame >= enter) current = i;
  });
  return current;
};

/** Hệ số lệch ngang của thẻ cảnh `i` tại `frame`: 0 = đứng yên, -1 = văng hết sang trái, +1 = còn ở bên phải. */
export const whipOffset = (L: RankLayout, i: number, frame: number) => {
  const enter = L.enters[i];
  const inP = Math.min(1, Math.max(0, (frame - (enter + WHIP_IN_FROM)) / WHIP_IN_LEN));
  const next = L.enters[i + 1];
  let outP = 0;
  if (next !== undefined) {
    outP = Math.min(1, Math.max(0, (frame - (next - WHIP_OUT_LEAD)) / WHIP_OUT_LEN));
  }
  return { inP, outP, visible: inP > 0 && outP < 1 };
};
