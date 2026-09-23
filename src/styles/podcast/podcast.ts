/**
 * Hằng số, màu, tách từ và đồng hồ lời nói dùng chung cho phong cách "Podcast".
 * Mọi hàm ở đây là hàm thuần theo frame — cùng frame cùng kết quả, không ngẫu nhiên thật.
 */
import { interpolate } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";
import { seeded } from "../shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Font đóng gói: Be Vietnam Pro cho giao diện + lời trích, Playfair cho dấu ngoặc kép lớn. */
export const PODCAST_FONTS = ["bevietnam", "playfair"] as const;
export const SANS = FONT_CATALOG.bevietnam.stack;
export const SERIF = FONT_CATALOG.playfair.stack;

/** Phòng thu tối ấm. */
export const STUDIO = "#140e0b";
export const CREAM = "#fff4ea";
export const MUTED = "rgba(255, 236, 220, 0.56)";
export const FAINT = "rgba(255, 236, 220, 0.14)";
export const LIVE_RED = "#ff3b30";

/** Trộn màu nhấn với màu khác — color-mix chạy tốt trong Chrome của Remotion. */
export const mix = (accent: string, amount: number, other = STUDIO) => `color-mix(in srgb, ${accent} ${amount}%, ${other})`;
/** Màu nhấn trong suốt một phần. */
export const alpha = (accent: string, amount: number) => `color-mix(in srgb, ${accent} ${amount}%, transparent)`;

/** In hoa bằng JS theo tiếng Việt — không dùng CSS text-transform (móc Ư/Ơ dễ lệch). */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** m:ss từ số frame. */
export const clock = (frames: number, fps: number) => {
  const s = Math.max(0, Math.floor(frames / fps));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Số tập: lấy "Tập 12"/"Ep 12"/"#12" nếu tiêu đề hoặc dòng phụ có ghi, không thì suy cố định từ tiêu đề
 * (cùng tiêu đề luôn ra cùng số) cho giống một tập trong chuỗi.
 */
export const episodeNumber = (title: string, subtitle: string) => {
  const m = `${title} ${subtitle}`.match(/(?:tập|ep\.?|episode|số|#)\s*(\d{1,3})/i);
  if (m) return Number(m[1]);
  return Math.floor(seeded(`ep-${title}`, 3, 48));
};

export type Word = { text: string; at: number };

/**
 * Tách câu thành từ và ước lượng lúc đọc tới mỗi từ: chia thời lượng câu theo độ dài từ (+2 cho quãng nghỉ),
 * để từ dài chiếm nhiều thời gian hơn. Kết thúc sớm hơn 8% cuối câu để chữ sáng hết trước khi đổi câu.
 */
export const wordTimes = (text: string, startFrame: number, endFrame: number): Word[] => {
  const words = text.normalize("NFC").split(/\s+/).filter(Boolean);
  const weights = words.map((w) => [...w].length + 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(1, endFrame - startFrame) * 0.92;
  let acc = 0;
  return words.map((w, i) => {
    const at = startFrame + (acc / total) * span;
    acc += weights[i];
    return { text: w, at };
  });
};

/** Khung thời gian (frame) của một câu; endFrame luôn > startFrame. */
export const captionFrames = (c: Caption) => {
  const start = msToFrames(c.startMs);
  return { start, end: Math.max(start + 1, msToFrames(c.endMs)) };
};

/**
 * Mức "đang nói" 0..1 tại frame — lái sóng âm và vòng sáng ảnh đại diện. Trong câu thì cao và nảy lên ở mỗi
 * từ mới, ngoài câu thì tắt dần về 0 (khoảng lặng giữa hai câu sóng êm lại).
 */
export const speechLevel = (captions: Caption[], frame: number) => {
  let level = 0;
  for (const c of captions) {
    const { start, end } = captionFrames(c);
    if (frame < start - 3 || frame >= end + 8) continue;
    const a = Math.min(3, (end - start) / 3);
    const ramp = interpolate(frame, [start - 3, start + a, end - a, end + 8], [0, 1, 1, 0], clamp);
    let pulse = 0;
    for (const w of wordTimes(c.text, start, end)) {
      if (w.at <= frame) pulse = Math.exp(-(frame - w.at) / 5);
    }
    level = Math.max(level, ramp * (0.62 + 0.38 * pulse));
  }
  return level;
};

/** Chiều cao cột sóng thứ i (0..1). Giữa hàng cao hơn hai đầu; lặng thì chỉ còn gợn nhỏ. */
export const barHeight = (i: number, n: number, frame: number, level: number) => {
  const env = 0.4 + 0.6 * Math.sin((Math.PI * (i + 0.5)) / n);
  const wob = 0.5 + 0.5 * Math.sin(frame * 0.47 + i * 1.73 + seeded(`pw-${i}`) * 6.28);
  const wob2 = 0.5 + 0.5 * Math.sin(frame * 0.21 - i * 0.57 + seeded(`pv-${i}`) * 6.28);
  const active = level * env * (0.28 + 0.72 * wob * (0.55 + 0.45 * wob2));
  const idle = 0.07 + 0.04 * (0.5 + 0.5 * Math.sin(frame * 0.09 + i * 0.61));
  return Math.min(1, Math.max(idle, active));
};

/** Vị trí [từ đầu, từ cuối] của cụm nhấn trong danh sách từ, hoặc null nếu câu không chứa nguyên văn. */
export const punchRange = (words: Word[], punch: string): [number, number] | null => {
  const norm = (s: string) => s.normalize("NFC").toLowerCase();
  const needle = norm(punch).trim();
  if (!needle) return null;
  let pos = 0;
  const spans = words.map((w) => {
    const s = { start: pos, end: pos + w.text.length };
    pos += w.text.length + 1;
    return s;
  });
  const at = norm(words.map((w) => w.text).join(" ")).indexOf(needle);
  if (at < 0) return null;
  let first = -1;
  let last = -1;
  spans.forEach((s, i) => {
    if (s.end > at && s.start < at + needle.length) {
      if (first < 0) first = i;
      last = i;
    }
  });
  return first < 0 ? null : [first, last];
};

export const EMPTY_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null,
  x: 50, y: 50, width: 100, rotate: 0, opacity: 1, keyframes: [], startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

// ---------------------------------------------------------------------------
// Bố cục
// ---------------------------------------------------------------------------
export type Rect = { x: number; y: number; w: number; h: number };

export type Geometry = {
  stacked: boolean;
  card: Rect;
  header: Rect;
  media: Rect;
  wave: Rect;
  scrub: Rect;
  /** Khối lời trích (thẻ trích dẫn). */
  quote: Rect;
  /** Lề trong của thẻ trích dẫn. */
  quotePad: number;
};

/**
 * Dọc (cao/rộng ≥ 1.2): thẻ tập ở trên (đầu thẻ → ảnh → sóng → thanh tiến độ), thẻ trích dẫn ở dưới.
 * Ngang / vuông: thẻ tập bên trái, thẻ trích dẫn bên phải.
 */
export const geometry = (width: number, height: number, safe: { top: number; bottom: number; side: number }, unit: number): Geometry => {
  const stacked = height / width >= 1.2;
  const pad = 30 * unit;
  const gap = 22 * unit;
  const headerH = 84 * unit;
  const waveH = (stacked ? 118 : 104) * unit;
  const scrubH = 62 * unit;
  if (stacked) {
    const mx = 56 * unit;
    const cardTop = Math.max(safe.top * 0.72, 60 * unit);
    const bottom = height - safe.bottom;
    const quoteH = (height / width > 1.6 ? 430 : 320) * unit;
    const cardBottom = bottom - quoteH - 34 * unit;
    const card = { x: mx, y: cardTop, w: width - mx * 2, h: cardBottom - cardTop };
    const inner = { x: card.x + pad, w: card.w - pad * 2 };
    const header = { x: inner.x, y: card.y + pad, w: inner.w, h: headerH };
    const mediaH = card.h - pad * 2 - headerH - waveH - scrubH - gap * 3;
    const media = { x: inner.x, y: header.y + headerH + gap, w: inner.w, h: mediaH };
    const wave = { x: inner.x, y: media.y + mediaH + gap, w: inner.w, h: waveH };
    const scrub = { x: inner.x, y: wave.y + waveH + gap, w: inner.w, h: scrubH };
    const quote = { x: mx, y: cardBottom + 34 * unit, w: width - mx * 2, h: quoteH };
    return { stacked, card, header, media, wave, scrub, quote, quotePad: Math.max(44 * unit, safe.side - mx) };
  }
  const top = Math.max(safe.top, 50 * unit);
  const bottom = height - Math.max(safe.bottom * 0.8, 60 * unit);
  const cardH = bottom - top;
  const mediaH = cardH - pad * 2 - headerH - waveH - scrubH - gap * 3;
  // Vuông: thu hẹp thẻ tập để cột trích dẫn đủ rộng.
  const mediaW = Math.min(mediaH * 1.3, width * (width / height < 1.2 ? 0.37 : 0.4));
  const card = { x: safe.side, y: top, w: mediaW + pad * 2, h: cardH };
  const inner = { x: card.x + pad, w: mediaW };
  const header = { x: inner.x, y: card.y + pad, w: inner.w, h: headerH };
  const media = { x: inner.x, y: header.y + headerH + gap, w: mediaW, h: mediaH };
  const wave = { x: inner.x, y: media.y + mediaH + gap, w: mediaW, h: waveH };
  const scrub = { x: inner.x, y: wave.y + waveH + gap, w: mediaW, h: scrubH };
  const qx = card.x + card.w + 44 * unit;
  const quote = { x: qx, y: top, w: width - safe.side * 0.7 - qx, h: cardH };
  return { stacked, card, header, media, wave, scrub, quote, quotePad: 44 * unit };
};
