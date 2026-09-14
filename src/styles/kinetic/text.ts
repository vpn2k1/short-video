/**
 * Tách từ, dò cụm punch và tính cỡ chữ vừa khung cho phong cách chữ động.
 *
 * Không có @remotion/layout-utils trong project nên đo bằng canvas 2D — đồng bộ,
 * xác định, và dùng đúng font hệ thống lúc render. Kết quả được cache theo chuỗi.
 */
import { FONTS } from "../shared";

export const WORD_FONT = FONTS.sans;
export const WORD_WEIGHT = 900;
/** Chữ in hoa tiếng Việt có dấu chồng (Ấ, Ệ) — cần dòng cao hơn chữ Latin thường. */
export const LINE_HEIGHT = 1.16;
/** Khoảng cách giữa hai từ, tính theo em. */
export const WORD_GAP_EM = 0.26;
/** Cụm punch to hơn chữ thường. */
export const PUNCH_SCALE = 1.14;
/** Đệm ngang của khối punch, tính theo em (mỗi bên). */
export const PUNCH_PAD_EM = 0.14;

export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

/** Bề rộng chuỗi ở cỡ 100px. Nhân tuyến tính cho cỡ khác. */
export const measureAt100 = (text: string, family: string = WORD_FONT, weight: number = WORD_WEIGHT) => {
  const key = `${weight}|${family}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = [...text].length * 55; // dự phòng khi không có DOM (Node)
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

export type Word = {
  /** Chữ đã in hoa. */
  text: string;
  /** Vị trí ký tự đầu trong câu gốc — dùng để rải thời điểm xuất hiện. */
  offset: number;
  punch: boolean;
};

/** Một khối xếp hàng: từ thường hoặc cả cụm punch dính liền. */
export type Chunk = {
  words: Word[];
  punch: boolean;
  /** Chỉ số từ đầu tiên trong câu. */
  firstIndex: number;
};

const strip = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi");

/** Tách câu thành từ, đánh dấu các từ thuộc cụm punch (so khớp không phân biệt hoa thường). */
export const splitWords = (text: string, punchText: string | null): Word[] => {
  const source = text.normalize("NFC");
  const words: Word[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    words.push({ text: upper(m[0]), offset: m.index, punch: false });
  }
  if (punchText) {
    const needle = strip(punchText).trim().replace(/[.,!?;:…]+$/u, "");
    const at = needle ? strip(source).indexOf(needle) : -1;
    if (at >= 0) {
      const end = at + needle.length;
      for (const w of words) {
        const wEnd = w.offset + w.text.length;
        if (w.offset < end && wEnd > at) w.punch = true;
      }
    }
  }
  return words;
};

export const hasPunch = (text: string, punchText: string) => {
  const needle = strip(punchText).trim().replace(/[.,!?;:…]+$/u, "");
  return needle.length > 0 && strip(text).includes(needle);
};

/**
 * Mỗi từ một khối. Từ punch cũng tách riêng (khối nền của chúng tự nối liền khi
 * cùng dòng) — gộp cả cụm thành một khối thì khi gãy dòng nó phình ra hết bề ngang.
 */
export const chunkWords = (words: Word[]): Chunk[] =>
  words.map((w, i) => ({ words: [w], punch: w.punch, firstIndex: i }));

/** Bề rộng một khối ở cỡ 100px (từ punch đã nhân scale và cộng lề hai đầu — tính dư cho chắc). */
const chunkWidth100 = (chunk: Chunk) =>
  chunk.punch
    ? (measureAt100(chunk.words[0].text) + PUNCH_PAD_EM * 2 * 100) * PUNCH_SCALE
    : measureAt100(chunk.words[0].text);

/**
 * Cỡ chữ lớn nhất để các khối xếp vừa hộp (maxWidth × maxHeight).
 * Mô phỏng đúng cách flex-wrap xuống dòng; khối punch quá dài được phép tự gãy dòng
 * bên trong nên tính bằng số dòng nó chiếm.
 */
export const fitChunks = (chunks: Chunk[], maxWidth: number, maxHeight: number, maxSize: number, minSize: number) => {
  if (chunks.length === 0) return maxSize;
  // Hệ số an toàn: canvas và DOM lệch nhau vài phần trăm.
  const widths = chunks.map((c) => chunkWidth100(c) * 1.05);
  const usable = maxWidth;
  const fits = (size: number) => {
    const k = size / 100;
    const gap = WORD_GAP_EM * size;
    let lines = 1;
    let x = 0;
    // Dòng có từ punch cao hơn PUNCH_SCALE lần.
    let height = 0;
    let lineScale = 1;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i] * k;
      if (w > usable) return false;
      if (x > 0 && x + gap + w > usable) {
        height += lineScale;
        lines++;
        lineScale = 1;
        x = w;
      } else {
        x += (x > 0 ? gap : 0) + w;
      }
      if (chunks[i].punch) lineScale = PUNCH_SCALE;
    }
    height += lineScale;
    return height * size * LINE_HEIGHT <= maxHeight && lines > 0;
  };
  let size = maxSize;
  while (size > minSize && !fits(size)) size *= 0.94;
  return Math.max(minSize, Math.floor(size));
};
