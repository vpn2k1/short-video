/**
 * Bố cục và nhịp cuộn của phong cách "Lời nhạc cuộn".
 *
 * Danh sách hàng: mỗi câu hát một hàng (có thể nhiều dòng), nhãn đoạn khi sang cảnh có tag, và hàng "• • •"
 * trước câu nằm sau một đoạn nhạc dạo dài. Hàng đang hát đứng ở mốc ~30% vùng lời; đổi hàng thì cả danh sách
 * cuộn lên trong SCROLL_MS, hàng bên dưới cuộn trễ hơn một chút như lời đồng bộ của app nghe nhạc.
 */
import { FONT_CATALOG } from "../../fonts/catalog";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { measureAt100 } from "../kinetic/text";
import { accentHue } from "../music";
import { wordTokens } from "../tokens";

export const LYRICS_FONTS = ["bevietnam"];
export const FONT = FONT_CATALOG.bevietnam.stack;
export const WEIGHT = 800;
export const LINE_HEIGHT = 1.22;

/** Khoảng lặng trước câu dài hơn chừng này (ms) thì chèn hàng "• • •". */
export const DOTS_GAP_MS = 4000;
/** Hàng "• • •" thành hàng đang hát sau khi câu trước dứt chừng này (ms). */
const DOTS_AFTER_MS = 600;
const SCROLL_MS = 560;
/** Mỗi hàng bên dưới hàng đang hát cuộn trễ thêm chừng này (ms). */
const STAGGER_MS = 45;

export type Palette = { hue: number; base: string; blobs: string[]; accent: string };

export const paletteFor = (accent: string): Palette => {
  const hue = accentHue(accent, 265);
  return {
    hue,
    base: `hsl(${hue}, 40%, 9%)`,
    blobs: [0, 42, -48, 150].map((d, i) => `hsl(${(hue + d + 360) % 360}, ${[85, 75, 80, 60][i]}%, ${[48, 42, 38, 30][i]}%)`),
    accent: `hsl(${hue}, 100%, 78%)`,
  };
};

/* ------------------------------------------------------------ hàng */

export type Row =
  | { kind: "line"; index: number; y: number; h: number }
  | { kind: "dots"; before: number; y: number; h: number; fromMs: number; toMs: number }
  | { kind: "tag"; text: string; y: number; h: number };

/**
 * Tự ngắt dòng một câu theo số đo canvas: trả số thứ tự dòng của từng từ. Mỗi dòng vẽ bằng nowrap đúng như
 * ở đây, nên chiều cao hàng luôn khớp danh sách — để trình duyệt tự ngắt thì chỉ cần lệch vài pixel so với
 * canvas là hàng này đè lên hàng dưới hoặc hở một khoảng. Canvas đo chữ này rộng hơn DOM vài phần trăm nên
 * cho vượt 3%: dòng thật vẫn nằm trong bề rộng, cùng lắm lấn vài pixel vào lề.
 */
export const wrapWords = (words: string[], size: number, maxWidth: number) => {
  const k = size / 100;
  const space = measureAt100(" ", FONT, WEIGHT) * k;
  const rowOf: number[] = [];
  let row = 0;
  let x = 0;
  for (const word of words) {
    const w = measureAt100(word.normalize("NFC"), FONT, WEIGHT) * k;
    if (x > 0 && x + space + w > maxWidth * 1.03) {
      row++;
      x = w;
    } else {
      x += (x > 0 ? space : 0) + w;
    }
    rowOf.push(row);
  }
  return rowOf;
};

/** Số dòng của một câu — tách từ y như lúc vẽ (timedWords dùng wordTokens). */
const wrapCount = (text: string, size: number, maxWidth: number) =>
  (wrapWords(wordTokens(text.normalize("NFC")).map((t) => t.text), size, maxWidth).at(-1) ?? 0) + 1;

const sceneAt = (scenes: Scene[], ms: number) => {
  for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].startMs <= ms) return scenes[i];
  return null;
};

export const buildRows = (lines: Caption[], scenes: Scene[], size: number, maxWidth: number): Row[] => {
  const rows: Row[] = [];
  const gap = size * 0.42;
  let y = 0;
  let lastScene: Scene | null = null;
  lines.forEach((line, i) => {
    const before = i > 0 ? line.startMs - lines[i - 1].endMs : 0;
    if (i > 0 && before >= DOTS_GAP_MS) {
      const h = size * 0.9;
      rows.push({ kind: "dots", before: i, y, h, fromMs: lines[i - 1].endMs + DOTS_AFTER_MS, toMs: line.startMs });
      y += h + gap;
    }
    const scene = sceneAt(scenes, line.startMs);
    if (scene && scene !== lastScene && scene.tag) {
      const h = size * 0.5;
      rows.push({ kind: "tag", text: scene.tag, y, h });
      y += h + gap * 0.5;
    }
    lastScene = scene;
    const h = wrapCount(line.text, size, maxWidth) * size * LINE_HEIGHT;
    rows.push({ kind: "line", index: i, y, h });
    y += h + gap;
  });
  return rows;
};

/* ------------------------------------------------------------ cuộn */

type Focus = { row: number; atMs: number };

/**
 * Hàng đang hát theo thời gian: câu bắt đầu thì hàng câu đó; đoạn dạo dài thì hàng "• • •".
 * Trước câu đầu tiên: hàng đầu tiên, từ 0 ms.
 */
const focusEvents = (rows: Row[], lines: Caption[]): Focus[] => {
  const events: Focus[] = [];
  rows.forEach((row, r) => {
    if (row.kind === "line") events.push({ row: r, atMs: lines[row.index].startMs });
    if (row.kind === "dots") events.push({ row: r, atMs: row.fromMs });
  });
  return events.sort((a, b) => a.atMs - b.atMs);
};

const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export type Scroll = {
  /** Hàng đang hát. */
  focus: number;
  /** Độ lệch cuộn (px) cho hàng r — hàng dưới trễ hơn. */
  offsetFor: (r: number) => number;
  /** 0..1: mức "đang là hàng hát" của hàng r (để chuyển độ sáng/cỡ chữ mượt khi đổi hàng). */
  activeness: (r: number) => number;
};

export const scrollAt = (rows: Row[], lines: Caption[], ms: number): Scroll => {
  const events = focusEvents(rows, lines);
  let k = -1;
  for (let i = 0; i < events.length; i++) if (events[i].atMs <= ms) k = i;
  const firstRow = rows.findIndex((r) => r.kind === "line");
  const current = k >= 0 ? events[k] : { row: Math.max(0, firstRow), atMs: -Infinity };
  const previous = k >= 1 ? events[k - 1] : null;
  const y = (r: number) => rows[r]?.y ?? 0;
  const progress = (r: number) => {
    const delay = Math.max(0, Math.min(6, r - current.row)) * STAGGER_MS;
    return easeOut((ms - current.atMs - delay) / SCROLL_MS);
  };
  return {
    focus: current.row,
    offsetFor: (r) => (previous ? y(previous.row) + (y(current.row) - y(previous.row)) * progress(r) : y(current.row)),
    activeness: (r) => {
      const t = easeOut((ms - current.atMs) / (SCROLL_MS * 0.8));
      if (r === current.row) return previous ? t : 1;
      if (previous && r === previous.row) return 1 - t;
      return 0;
    },
  };
};
