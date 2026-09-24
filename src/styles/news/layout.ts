/**
 * Bố cục bản tin tính một lần từ khung hình + TOÀN BỘ dữ liệu, để các dải không
 * nhảy kích thước khi câu hoặc cảnh đổi giữa chừng.
 *
 * Xếp từ đáy lên: vùng nền tảng chiếm (safe.bottom) → ticker → dải dưới (lower third)
 * → thanh NÓNG. Chữ luôn nằm trong safe.side; nền các dải được phép tràn mép.
 */
import type { Caption, Scene } from "../../compositions/Short/schema";
import { useLayout } from "../shared";
import { fitText, measure, nfc, upper, type Fitted } from "./theme";
import { translateVideoText, useVt, type VideoLanguage } from "../../i18n/video";

export const CAPTION_LH = 1.28;
export const HEADLINE_LH = 1.2;
export const UPPER_LH = 1.3;
export const DEFAULT_CATEGORY = "TIN NÓNG";

/** Ưu tiên một dòng (TV), không vừa mới cho xuống hai dòng. */
const fitPreferOne = (text: string, width: number, max: number, minOne: number, minTwo: number, weight: number): Fitted => {
  const one = fitText(text, width, 1, max, minOne, weight);
  if (one.lines.length === 1 && !one.lines[0].endsWith("…")) return one;
  return fitText(text, width, 2, max, minTwo, weight);
};

export const useNewsLayout = (title: string, captions: Caption[], scenes: Scene[]) => {
  const base = useLayout();
  const { width, height, safe, unit } = base;
  const stacked = height > width * 1.1;
  const u = unit;
  const vt = useVt();
  const defaultCategory = vt(DEFAULT_CATEGORY);

  const left = safe.side;
  const contentW = width - safe.side * 2;

  // Ticker
  const tickerH = Math.round((stacked ? 72 : 58) * u);
  const tickerFont = Math.round((stacked ? 34 : 28) * u);
  const tickerBottom = safe.bottom;

  // Góc trên
  const bugH = Math.round((stacked ? 88 : 72) * u);
  const bugTop = safe.top + Math.round((stacked ? 16 : 8) * u);

  // Nhãn chuyên mục (chữ in hoa, không giãn chữ)
  const catFont = Math.round((stacked ? 36 : 32) * u);
  const catPadX = Math.round((stacked ? 24 : 22) * u);
  const catPadY = Math.round((stacked ? 8 : 6) * u);
  const catLabels = [defaultCategory, ...scenes.map((s) => (s.tag ? upper(s.tag) : defaultCategory))];
  const catMaxW = contentW * (stacked ? 0.9 : 0.34);
  const catWidthFor = (label: string) =>
    Math.min(catMaxW, measure(label, catFont, 900) * 1.06 + catPadX * 2);
  const catRowW = Math.max(...catLabels.map(catWidthFor));

  // Tiêu đề (headline)
  const headPadX = Math.round((stacked ? 28 : 26) * u);
  const headPadY = Math.round((stacked ? 14 : 10) * u);
  const headTextW = (stacked ? contentW : contentW - catRowW) - headPadX * 2;
  const headline = stacked
    ? fitText(title || defaultCategory, headTextW, 2, 58 * u, 38 * u, 800)
    : fitPreferOne(title || defaultCategory, headTextW, 50 * u, 38 * u, 32 * u, 800);
  const headH = Math.round(Math.max(1, headline.lines.length) * headline.size * HEADLINE_LH + headPadY * 2);
  const catH = stacked ? Math.round(catFont * UPPER_LH + catPadY * 2) : headH;

  // Dải phụ đề trắng
  const capPadX = Math.round((stacked ? 28 : 26) * u);
  const capPadY = Math.round((stacked ? 16 : 12) * u);
  const capTextW = contentW - capPadX * 2 - 8 * u;
  const capMax = (stacked ? 50 : 40) * u;
  const capMin = (stacked ? 34 : 28) * u;
  const fittedCaptions = captions.map((c) => fitText(c.text, capTextW, 2, capMax, capMin, 700));
  const capContentH = fittedCaptions.reduce(
    (max, f) => Math.max(max, Math.max(1, f.lines.length) * f.size * CAPTION_LH),
    capMax * CAPTION_LH,
  );
  const capH = Math.round(capContentH + capPadY * 2);

  const lowerGap = Math.round((stacked ? 24 : 16) * u);
  const lowerBottom = tickerBottom + tickerH + lowerGap;
  const lowerH = (stacked ? catH : 0) + headH + capH;

  // Thanh NÓNG
  const punchGap = Math.round((stacked ? 22 : 14) * u);
  const nongFont = Math.round((stacked ? 40 : 34) * u);
  const nongPadX = Math.round(20 * u);
  const nongW = measure(vt("NÓNG"), nongFont, 900) * 1.08 + nongPadX * 2;
  const punchPadY = Math.round((stacked ? 14 : 10) * u);
  const punchTextW = contentW - nongW - 24 * u;
  const punchMax = (stacked ? 62 : 50) * u;
  const punchMin = (stacked ? 38 : 32) * u;
  const fitPunch = (text: string) =>
    fitPreferOne(upper(text), punchTextW, punchMax, (stacked ? 46 : 38) * u, punchMin, 900);
  const punchH = Math.round(
    scenes.reduce((max, s) => {
      if (!s.punch) return max;
      const f = fitPunch(s.punch.text);
      return Math.max(max, f.lines.length * f.size * UPPER_LH);
    }, nongFont * UPPER_LH) +
      punchPadY * 2,
  );
  const punchBottom = lowerBottom + lowerH + punchGap;

  // Hộp số liệu / chip
  const statW = Math.round(stacked ? Math.min(contentW * 0.66, 560 * u) : Math.min(contentW * 0.4, 460 * u));
  const statTop = bugTop + bugH + Math.round((stacked ? 60 : 36) * u);

  return {
    ...base,
    vt,
    defaultCategory,
    stacked,
    left,
    contentW,
    tickerH,
    tickerFont,
    tickerBottom,
    bugH,
    bugTop,
    catFont,
    catPadX,
    catPadY,
    catH,
    catRowW,
    catWidthFor,
    headPadX,
    headPadY,
    headline,
    headH,
    capPadX,
    capPadY,
    capH,
    fittedCaptions,
    lowerBottom,
    lowerH,
    nongFont,
    nongPadX,
    nongW,
    punchPadY,
    punchH,
    punchBottom,
    fitPunch,
    statW,
    statTop,
  };
};

export type NewsLayout = ReturnType<typeof useNewsLayout>;

/** Chuỗi chạy của ticker: tiêu đề • phụ đề • chuyên mục. */
export const tickerItems = (title: string, subtitle: string, scenes: Scene[], language?: VideoLanguage) => {
  const items: string[] = [];
  const push = (text: string | null | undefined) => {
    const t = text ? nfc(text).trim() : "";
    if (t && !items.some((i) => i.toLocaleLowerCase("vi") === t.toLocaleLowerCase("vi"))) items.push(t);
  };
  push(title);
  push(subtitle);
  scenes.forEach((s) => push(s.tag ? upper(s.tag) : null));
  if (items.length === 0) items.push(translateVideoText(language, "TIN NÓNG"));
  return items;
};
