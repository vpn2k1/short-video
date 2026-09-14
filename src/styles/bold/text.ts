/**
 * Tách từ, gom cụm 2–4 từ, dò punch và tính cỡ chữ cho phong cách "Phụ đề từng từ".
 *
 * Không có @remotion/layout-utils trong project nên đo bằng canvas 2D — đồng bộ,
 * xác định, dùng đúng font hệ thống lúc render. Kết quả được cache theo chuỗi.
 */
import { FONTS } from "../shared";

export const WORD_FONT = FONTS.sans;
export const WORD_WEIGHT = 900;
/** Chữ in hoa tiếng Việt có dấu chồng (Ấ, Ễ) — dòng cao hơn chữ Latin. */
export const LINE_HEIGHT = 1.2;
/** Khoảng cách giữa hai từ, tính theo em. */
export const GAP_EM = 0.26;
/** Từ punch to hơn chữ thường. */
export const PUNCH_SCALE = 1.1;
/** Bán kính viền đen, tính theo em. */
export const OUTLINE_EM = 0.075;
/** Cụm nên gọn trong chừng này ký tự. */
const GROUP_CHARS = 16;

export const YELLOW = "#FFD93D";
export const GREEN = "#22C55E";

export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

/** Bề rộng chuỗi ở cỡ 100px. Nhân tuyến tính cho cỡ khác. */
export const measureAt100 = (text: string, weight: number = WORD_WEIGHT, family: string = WORD_FONT) => {
  const key = `${weight}|${family}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = [...text].length * 62; // dự phòng khi không có DOM (Node)
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
  /** Vị trí ký tự đầu trong câu gốc (NFC) — để rải thời điểm xuất hiện. */
  offset: number;
  /** Chỉ số từ trong câu. */
  index: number;
  punch: boolean;
};

const lower = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi");
const cleanPunch = (s: string) => lower(s).trim().replace(/[.,!?;:…]+$/u, "");

/** Tách câu thành từ, đánh dấu các từ thuộc cụm punch (không phân biệt hoa thường). */
export const splitWords = (text: string, punchText: string | null): Word[] => {
  const source = text.normalize("NFC");
  const words: Word[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    words.push({ text: upper(m[0]), offset: m.index, index: words.length, punch: false });
  }
  if (punchText) {
    const needle = cleanPunch(punchText);
    const at = needle ? lower(source).indexOf(needle) : -1;
    if (at >= 0) {
      const end = at + needle.length;
      for (const w of words) {
        if (w.offset < end && w.offset + w.text.length > at) w.punch = true;
      }
    }
  }
  return words;
};

export const hasPunch = (text: string, punchText: string) => {
  const needle = cleanPunch(punchText);
  return needle.length > 0 && lower(text).includes(needle);
};

const ENDS_CLAUSE = /[.,!?;:…—–)]$/u;
const charsOf = (group: Word[]) => group.reduce((n, w, i) => n + [...w.text].length + (i > 0 ? 1 : 0), 0);

/**
 * Gom từ thành cụm 2–4 từ: ngắt sau dấu câu, ngắt khi quá 4 từ hoặc quá ~16 ký tự.
 * Từ lẻ loi cuối câu được nhập vào cụm trước nếu vẫn gọn.
 */
export const groupWords = (words: Word[]): Word[][] => {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  let chars = 0;
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
    chars = 0;
  };
  for (const w of words) {
    const len = [...w.text].length;
    if (cur.length > 0) {
      const next = chars + 1 + len;
      if (cur.length >= 4 || (cur.length >= 2 && next > GROUP_CHARS) || (cur.length === 1 && next > GROUP_CHARS + 8)) {
        flush();
      }
    }
    chars = cur.length === 0 ? len : chars + 1 + len;
    cur.push(w);
    if (ENDS_CLAUSE.test(w.text)) flush();
  }
  flush();
  for (let i = groups.length - 1; i > 0; i--) {
    const g = groups[i];
    const prev = groups[i - 1];
    if (
      g.length === 1 &&
      prev.length < 4 &&
      !ENDS_CLAUSE.test(prev[prev.length - 1].text) &&
      charsOf(prev) + 1 + charsOf(g) <= GROUP_CHARS + 5
    ) {
      prev.push(g[0]);
      groups.splice(i, 1);
    }
  }
  return groups;
};

/**
 * Cỡ chữ lớn nhất để các từ xếp vừa `maxWidth` trong tối đa `maxLines` dòng.
 * Mô phỏng flex-wrap; cộng phần viền đen và hệ số an toàn canvas/DOM.
 */
type FitItem = { text: string; punch: boolean };

const widths100 = (items: FitItem[]) =>
  items.map((it) => (measureAt100(it.text) + OUTLINE_EM * 200) * (it.punch ? PUNCH_SCALE : 1) * 1.05);

const linesFor = (widths: number[], maxWidth: number, size: number) => {
  const k = size / 100;
  const gap = GAP_EM * size;
  let lines = 1;
  let x = 0;
  for (const w100 of widths) {
    const w = w100 * k;
    if (x > 0 && x + gap + w > maxWidth) {
      lines++;
      x = w;
    } else {
      x += (x > 0 ? gap : 0) + w;
    }
  }
  return lines;
};

/** Số dòng các từ chiếm ở cỡ `size` (mô phỏng flex-wrap). */
export const lineCount = (items: FitItem[], maxWidth: number, size: number) =>
  items.length === 0 ? 0 : linesFor(widths100(items), maxWidth, size);

export const fitWords = (items: FitItem[], maxWidth: number, maxLines: number, maxSize: number, minSize: number) => {
  if (items.length === 0) return maxSize;
  const widths = widths100(items);
  const widest = Math.max(...widths);
  let size = maxSize;
  while (size > minSize && (linesFor(widths, maxWidth, size) > maxLines || (widest * size) / 100 > maxWidth)) size *= 0.95;
  size = Math.max(size, minSize);
  // Một từ quá dài vẫn phải lọt bề ngang, kể cả khi nhỏ hơn minSize.
  if ((widest * size) / 100 > maxWidth) size = (maxWidth * 100) / widest;
  return Math.floor(size);
};

/** Viền đen dày bằng nhiều lớp text-shadow (giữ nguyên dấu tiếng Việt) + bóng đổ mềm. */
export const outlineShadow = (size: number, drop = true) => {
  const r = OUTLINE_EM * size;
  // Blur rất nhỏ để mép viền không răng cưa ở các đường cong.
  const soft = Math.max(1, size * 0.014).toFixed(1);
  const parts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    parts.push(`${(Math.cos(a) * r).toFixed(1)}px ${(Math.sin(a) * r).toFixed(1)}px ${soft}px #000`);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    parts.push(`${(Math.cos(a) * r * 0.55).toFixed(1)}px ${(Math.sin(a) * r * 0.55).toFixed(1)}px 0 #000`);
  }
  if (drop) parts.push(`0px ${(size * 0.1).toFixed(1)}px ${(size * 0.16).toFixed(1)}px rgba(0,0,0,0.6)`);
  return parts.join(", ");
};

/** Tách "80%" → 80 và "%". Hỗ trợ "1.200", "2,5 triệu", "+30K". */
export const parseStat = (text: string) => {
  const m = text.match(/^(\D*?)(\d[\d.,]*)(.*)$/u);
  if (!m) return null;
  const [, prefix, raw, suffix] = m;
  const grouped = raw.match(/^\d{1,3}([.,])\d{3}(\1\d{3})*$/);
  if (grouped) {
    return { prefix, suffix, value: Number(raw.replace(/[.,]/g, "")), decimals: 0, sep: grouped[1], decSep: "" };
  }
  const dec = raw.match(/^(\d+)([.,])(\d+)$/);
  if (dec) {
    return { prefix, suffix, value: Number(`${dec[1]}.${dec[3]}`), decimals: dec[3].length, sep: "", decSep: dec[2] };
  }
  const plain = raw.replace(/[.,]+$/, "");
  return { prefix, suffix: raw.slice(plain.length) + suffix, value: Number(plain), decimals: 0, sep: "", decSep: "" };
};

export const formatStat = (n: number, p: NonNullable<ReturnType<typeof parseStat>>) => {
  if (p.decimals > 0) return n.toFixed(p.decimals).replace(".", p.decSep);
  const s = String(Math.round(n));
  return p.sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, p.sep) : s;
};
