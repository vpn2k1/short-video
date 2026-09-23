/**
 * Mô hình chữ của thẻ bài đăng: tách từ, gán frame xuất hiện theo lời đọc, tự xuống dòng
 * bằng canvas (đo đúng font lúc render), chọn cỡ chữ vừa vùng an toàn, số tương tác.
 *
 * Dòng được chia sẵn trong code rồi vẽ `white-space: pre` — chiều cao thẻ là CHÍNH XÁC,
 * nên thẻ cao dần mượt theo từng dòng mới mà chữ không bao giờ tràn.
 */
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { FONTS, seeded } from "../shared";

export const SOCIAL_FONT = FONTS.sans;
export const BODY_WEIGHT = 500;
export const PUNCH_WEIGHT = 700;
export const HEADLINE_WEIGHT = 800;

// ---------------------------------------------------------------- đo chữ

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

/** Bề rộng chuỗi ở cỡ 100px. */
export const measure100 = (text: string, weight: number) => {
  const key = `${weight}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = [...text].length * 54; // dự phòng khi không có DOM
  if (typeof document !== "undefined") {
    if (!ctx) ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `${weight} 100px ${SOCIAL_FONT}`;
      width = ctx.measureText(text).width;
    }
  }
  widthCache.set(key, width);
  return width;
};

/** Hệ số an toàn giữa canvas và DOM. */
const SAFETY = 1.04;

export type Word = {
  text: string;
  /** Chỉ số caption trong cảnh. */
  caption: number;
  /** Vị trí ký tự trong toàn thân bài (sau NFC). */
  start: number;
  end: number;
  punch: boolean;
  /** Frame tuyệt đối từ hiện ra. */
  appear: number;
};

export type Line = { words: Word[]; appear: number };

const nfc = (s: string) => s.normalize("NFC");

/** Greedy wrap, dùng chung cho thân bài và tiêu đề. */
const wrapBy = <T extends { text: string }>(items: T[], widthOf: (t: T) => number, space: number, maxWidth: number) => {
  const lines: T[][] = [];
  let current: T[] = [];
  let w = 0;
  for (const item of items) {
    const iw = widthOf(item);
    const next = current.length ? w + space + iw : iw;
    if (current.length && next > maxWidth) {
      lines.push(current);
      current = [item];
      w = iw;
    } else {
      current.push(item);
      w = next;
    }
  }
  if (current.length) lines.push(current);
  return lines;
};

/** Chia chữ thường (tiêu đề, phụ đề) thành dòng. */
export const wrapText = (text: string, fontSize: number, weight: number, maxWidth: number) => {
  const k = (fontSize / 100) * SAFETY;
  const words = nfc(text).split(/\s+/).filter(Boolean).map((t) => ({ text: t }));
  return wrapBy(words, (x) => measure100(x.text, weight) * k, measure100(" ", weight) * k, maxWidth).map((l) =>
    l.map((x) => x.text).join(" "),
  );
};

export type PunchMatch = { start: number; end: number } | null;

/**
 * Thân bài của một cảnh: mọi caption nối liền thành một đoạn. Từ trong mỗi câu hiện dần
 * theo vị trí ký tự trên ~70% thời lượng câu — khớp nhịp giọng đọc.
 */
export const tokenize = (captions: Caption[], punchText: string | null, minAppear: number) => {
  const words: Word[] = [];
  let offset = 0;
  const pieces: string[] = [];
  captions.forEach((c, ci) => {
    const text = nfc(c.text).trim();
    const startF = Math.max(minAppear, msToFrames(c.startMs));
    const endF = Math.max(startF + 1, msToFrames(c.endMs));
    const span = Math.max(3, Math.round((endF - startF) * 0.7));
    const total = Math.max(1, [...text].length);
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const local = [...text.slice(0, m.index)].length;
      const len = [...m[0]].length;
      words.push({
        text: m[0],
        caption: ci,
        start: offset + local,
        end: offset + local + len,
        punch: false,
        appear: startF + Math.round((local / total) * span),
      });
    }
    pieces.push(text);
    offset += [...text].length + 1;
  });

  const body = [...pieces.join(" ")];
  let match: PunchMatch = null;
  if (punchText) {
    const needle = [...nfc(punchText).trim().toLocaleLowerCase("vi")];
    const hay = body.map((ch) => ch.toLocaleLowerCase("vi"));
    if (needle.length) {
      for (let i = 0; i + needle.length <= hay.length; i++) {
        let ok = true;
        for (let j = 0; j < needle.length; j++) {
          if (hay[i + j] !== needle[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          match = { start: i, end: i + needle.length };
          break;
        }
      }
    }
  }
  if (match) {
    for (const w of words) {
      w.punch = w.start < match.end && w.end > match.start;
    }
  }
  return { words, match };
};

export const wrapWords = (words: Word[], fontSize: number, maxWidth: number): Line[] => {
  const k = (fontSize / 100) * SAFETY;
  const lines = wrapBy(
    words,
    (w) => measure100(w.text, w.punch ? PUNCH_WEIGHT : BODY_WEIGHT) * k,
    measure100(" ", BODY_WEIGHT) * k,
    maxWidth,
  );
  return lines.map((ws) => ({ words: ws, appear: Math.min(...ws.map((w) => w.appear)) }));
};

export const LINE_RATIO = 1.36;

/** Cỡ chữ lớn nhất (bước 2px) mà toàn bộ thân bài vẫn nằm gọn trong maxHeight. */
export const fitBody = (words: Word[], maxWidth: number, maxHeight: number, base: number, min: number) => {
  let size = base;
  let lines = wrapWords(words, size, maxWidth);
  while (size > min && lines.length * size * LINE_RATIO > maxHeight) {
    size = Math.max(min, size - 2);
    lines = wrapWords(words, size, maxWidth);
  }
  return { fontSize: size, lineH: Math.round(size * LINE_RATIO), lines };
};

// ---------------------------------------------------------------- dữ liệu phụ

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
export const isVideo = (src: string | null | undefined) => Boolean(src && VIDEO_EXT.test(src));

/** "SỰ THẬT #1" → "r/sự-thật-#1". Tag đã có dạng "r/…" thì giữ. */
export const communityOf = (tag: string | null) => {
  if (!tag || !tag.trim()) return null;
  const slug = nfc(tag)
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/^r\//, "")
    .replace(/\s+/g, "-");
  return `r/${slug}`;
};

/** Tên người đăng: luôn ẩn danh (tên kênh chỉ hiện qua watermark trong Cài đặt). */
export const AUTHOR_NAME = "Ẩn danh";

export const initialOf = (name: string) => ([...name][0] ?? "?").toLocaleUpperCase("vi");

/** Định dạng kiểu Việt: 950, 1,2K, 12K, 1,5 Tr. */
export const formatCount = (n: number) => {
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return k < 10 ? `${(Math.floor(k * 10) / 10).toString().replace(".", ",")}K` : `${Math.floor(k)}K`;
  }
  const m = v / 1_000_000;
  return `${(Math.floor(m * 10) / 10).toString().replace(".", ",")} Tr`;
};

export type Counts = { likes: number; comments: number; shares: number };

/**
 * Số tương tác tăng dần xuyên suốt video, xác định theo tiêu đề: cảnh i đếm từ mốc
 * i/n tới (i+1)/n của tổng, ease-out trong thời lượng cảnh.
 */
export const countsAt = (title: string, index: number, total: number, progress: number): Counts => {
  const base = seeded(`${title}|likes`, 1800, 42000);
  const cRatio = seeded(`${title}|comments`, 0.06, 0.16);
  const sRatio = seeded(`${title}|shares`, 0.02, 0.07);
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - p) ** 3;
  const n = Math.max(1, total);
  const from = index < 0 ? 0 : 0.04 + (0.96 * index) / n;
  const to = index < 0 ? 0.04 : 0.04 + (0.96 * (index + 1)) / n;
  const likes = base * (from + (to - from) * eased);
  return { likes, comments: likes * cRatio, shares: likes * sRatio };
};

export const hoursAgo = (title: string) => Math.round(seeded(`${title}|hours`, 1, 9));

/** Caption thuộc cảnh: bắt đầu trong [startMs, endMs). Cảnh cuối nhận cả phần đuôi. */
export const captionsOfScene = (captions: Caption[], scenes: Scene[], index: number) => {
  const scene = scenes[index];
  const last = index === scenes.length - 1;
  return captions.filter((c) => c.startMs >= scene.startMs && (last || c.startMs < scene.endMs));
};
