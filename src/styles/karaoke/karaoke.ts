/**
 * Màu, chữ và luật chia dòng của phong cách "Karaoke".
 */
import { FONT_CATALOG } from "../../fonts/catalog";
import type { Caption } from "../../compositions/Short/schema";
import { measureAt100 } from "../kinetic/text";
import { accentHue } from "../music";

export const KARAOKE_FONTS = ["bevietnam"];
export const LYRIC_FONT = FONT_CATALOG.bevietnam.stack;
export const LYRIC_WEIGHT = 800;
export const LINE_HEIGHT = 1.34;

/** Hiện cặp câu trước câu đầu / sau đoạn dạo giữa bao lâu (ms) — đủ cho 4 chấm đếm ngược. */
export const LEAD_MS = 2500;
/** Câu dứt rồi mà câu sau còn xa hơn HOLD_MS + LEAD_MS → dọn màn cho đoạn nhạc dạo. */
export const HOLD_MS = 1500;
/** Chấm đếm ngược: mỗi chấm tắt cách nhau bao lâu. */
export const DOT_STEP_MS = 500;
export const DOTS = 4;

export type Palette = {
  hue: number;
  /** Màu chữ đã hát. */
  sung: string;
  /** Viền chữ. */
  outline: string;
  /** Hai màu nền sân khấu (trên, dưới). */
  stageTop: string;
  stageBottom: string;
};

/** Màu nhấn quyết định màu chữ đã hát; accent xám/đen/trắng → xanh karaoke kinh điển. */
export const paletteFor = (accent: string): Palette => {
  const hue = accentHue(accent, 205);
  return {
    hue,
    sung: `hsl(${hue}, 100%, 63%)`,
    outline: `hsl(${(hue + 20) % 360}, 70%, 9%)`,
    stageTop: `hsl(${(hue + 230) % 360}, 55%, 7%)`,
    stageBottom: `hsl(${hue}, 70%, 16%)`,
  };
};

/** Viền chữ bằng 16 lớp bóng — chạy mọi trình duyệt, không cần paint-order. */
export const outlineShadow = (color: string, width: number, drop = true) => {
  const layers: string[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    layers.push(`${(Math.cos(a) * width).toFixed(1)}px ${(Math.sin(a) * width).toFixed(1)}px 0 ${color}`);
  }
  if (drop) layers.push(`0 ${(width * 1.4).toFixed(1)}px ${(width * 3).toFixed(1)}px rgba(0,0,0,0.55)`);
  return layers.join(", ");
};

/**
 * Cỡ chữ của một câu: ưu tiên nằm trọn MỘT hàng (karaoke đọc theo hàng), chịu co tới 72% cỡ gốc;
 * dài hơn nữa thì xuống hai hàng (chia đều bằng text-wrap: balance). Đo bằng canvas nên lệch DOM vài
 * phần trăm — chừa 6–12%.
 */
export const fitLine = (text: string, maxWidth: number, base: number, min: number) => {
  const w100 = measureAt100(text.normalize("NFC"), LYRIC_FONT, LYRIC_WEIGHT);
  const oneRow = (maxWidth * 0.94) / (w100 / 100);
  if (oneRow >= base * 0.72) return Math.floor(Math.min(base, oneRow));
  const twoRows = (maxWidth * 2 * 0.88) / (w100 / 100);
  return Math.max(min, Math.min(base, Math.floor(twoRows)));
};

/* ------------------------------------------------------------ hai ô lời */

export type SlotState = {
  /** Câu trong ô, -1 = trống. */
  line: number;
  /** Lúc ô bắt đầu hiện câu này (ms) — cho hiệu ứng hiện vào. */
  since: number;
};

export type Board = {
  slots: [SlotState, SlotState];
  /** Độ hiện của cả khối lời (dọn màn lúc nhạc dạo). */
  opacity: number;
  /** Câu đang chờ vào (hiện chấm đếm ngược), -1 = không có. */
  countdown: number;
};

/**
 * Karaoke kinh điển: hai ô, câu chẵn ô trên, câu lẻ ô dưới. Đang hát câu a thì ô kia hiện sẵn câu a+1;
 * câu a+1 vào thì ô của câu a đổi sang a+2. Trước câu đầu và sau đoạn nhạc dạo dài, cặp câu hiện trước
 * LEAD_MS kèm chấm đếm ngược; giữa đoạn dạo thì dọn màn.
 */
export const boardAt = (lines: Caption[], ms: number): Board => {
  const n = lines.length;
  const empty: Board = { slots: [{ line: -1, since: 0 }, { line: -1, since: 0 }], opacity: 0, countdown: -1 };
  if (n === 0) return empty;
  let a = -1;
  for (let i = 0; i < n; i++) if (lines[i].startMs <= ms) a = i;

  const cleared = (i: number) => i === 0 || lines[i].startMs - lines[i - 1].endMs > HOLD_MS + LEAD_MS;
  let focus: number;
  let leadIn: boolean;
  let opacity = 1;
  if (a === -1) {
    focus = 0;
    leadIn = true;
    opacity = ms >= lines[0].startMs - LEAD_MS ? 1 : 0;
  } else if (a + 1 < n && ms > lines[a].endMs + HOLD_MS && cleared(a + 1)) {
    const next = lines[a + 1].startMs;
    if (next - ms > LEAD_MS) {
      // Giữa đoạn dạo: câu vừa hát mờ dần rồi màn trống.
      focus = a;
      leadIn = false;
      opacity = Math.max(0, 1 - (ms - lines[a].endMs - HOLD_MS) / 300);
    } else {
      focus = a + 1;
      leadIn = true;
    }
  } else {
    focus = a;
    leadIn = false;
  }

  const other = focus + 1 < n ? focus + 1 : focus - 1;
  const appear = (line: number) => {
    if (line < 0) return 0;
    if (leadIn) return lines[focus].startMs - LEAD_MS;
    if (line === focus + 1) return lines[focus].startMs;
    if (line === focus) return cleared(focus) ? lines[focus].startMs - LEAD_MS : lines[Math.max(0, focus - 1)].startMs;
    return lines[Math.max(0, line)].startMs;
  };
  const slots: [SlotState, SlotState] = [
    { line: -1, since: 0 },
    { line: -1, since: 0 },
  ];
  slots[focus % 2] = { line: focus, since: appear(focus) };
  if (other >= 0 && other !== focus) slots[other % 2] = { line: other, since: appear(other) };
  return { slots, opacity, countdown: leadIn && ms < lines[focus].startMs ? focus : -1 };
};
