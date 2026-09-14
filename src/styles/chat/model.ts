/**
 * Biến captions + scenes thành dòng thời gian tin nhắn, kèm kích thước từng mục.
 *
 * Mọi thứ ở đây là hàm thuần: cùng props + cùng kích thước khung → cùng kết quả.
 * Chữ được tự xuống dòng bằng canvas (đo đúng font lúc render) rồi vẽ từng dòng với
 * `white-space: nowrap`, nên chiều cao bong bóng là CHÍNH XÁC chứ không phải ước lượng —
 * danh sách cuộn bằng translateY mà bong bóng không bao giờ chồng nhau.
 */
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import { CHAT_FONT } from "./theme";

// ---------------------------------------------------------------- người nói

/**
 * Tên được coi là "tôi" → bong bóng xanh bên phải. So không phân biệt hoa thường.
 * "Em"/"Anh" cố ý KHÔNG có trong danh sách: trong chuyện tình cảm đó thường là người kia.
 */
export const ME_NAMES = ["tôi", "mình", "tui", "tớ", "tao", "tau", "me", "i", "bản thân"];

const SPEAKER_LINE = /^([^:\s][^:]{0,15}):\s*(.*)$/su;

export type ParsedLine = { speaker: string | null; text: string; nameOnly: boolean };

const norm = (s: string) => s.normalize("NFC").trim().toLocaleLowerCase("vi");

/** "Minh: ừ" → { speaker: "Minh", text: "ừ" }. Giờ "23:14", URL, câu dài có dấu hai chấm không tính. */
export const parseLine = (raw: string): ParsedLine => {
  const text = raw.normalize("NFC").trim();
  const m = text.match(SPEAKER_LINE);
  if (m) {
    const name = m[1].trim();
    const rest = m[2].trim();
    const words = name.split(/\s+/).length;
    const looksLikeName = !/^\d+$/.test(name) && words <= 3 && !rest.startsWith("//");
    if (looksLikeName) return { speaker: name, text: rest, nameOnly: rest.length === 0 };
  }
  return { speaker: null, text, nameOnly: false };
};

export const isMe = (speaker: string) => ME_NAMES.includes(norm(speaker));

// ---------------------------------------------------------------- đo chữ

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

/** Bề rộng chuỗi ở cỡ 100px, đo bằng canvas với đúng font render. */
export const measure100 = (text: string, weight: number) => {
  const key = `${weight}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = [...text].length * 52; // dự phòng khi không có DOM
  if (typeof document !== "undefined") {
    if (!ctx) ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `${weight} 100px ${CHAT_FONT}`;
      width = ctx.measureText(text).width;
    }
  }
  widthCache.set(key, width);
  return width;
};

export type Word = { text: string; bold: boolean };
export type Line = { words: Word[]; width: number };

/** Hệ số an toàn giữa canvas và DOM. */
const SAFETY = 1.03;

/** Tự xuống dòng theo bề rộng; từ dài hơn cả dòng thì cắt theo ký tự. */
export const wrapWords = (words: Word[], fontSize: number, maxWidth: number, weight = 400, boldWeight = 700): Line[] => {
  const k = (fontSize / 100) * SAFETY;
  const w = (word: Word) => measure100(word.text, word.bold ? boldWeight : weight) * k;
  const space = measure100(" ", weight) * k;
  const pieces: Word[] = [];
  for (const word of words) {
    if (w(word) <= maxWidth) {
      pieces.push(word);
      continue;
    }
    let chunk = "";
    for (const ch of [...word.text]) {
      if (chunk && w({ text: chunk + ch, bold: word.bold }) > maxWidth) {
        pieces.push({ text: chunk, bold: word.bold });
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    if (chunk) pieces.push({ text: chunk, bold: word.bold });
  }
  const lines: Line[] = [];
  let current: Line = { words: [], width: 0 };
  for (const piece of pieces) {
    const pw = w(piece);
    const next = current.words.length ? current.width + space + pw : pw;
    if (current.words.length && next > maxWidth) {
      lines.push(current);
      current = { words: [piece], width: pw };
    } else {
      current = { words: [...current.words, piece], width: next };
    }
  }
  if (current.words.length) lines.push(current);
  return lines.length ? lines : [{ words: [{ text: " ", bold: false }], width: 0 }];
};

/** Tách từ, đánh dấu từ thuộc cụm punch (so khớp không phân biệt hoa thường). */
export const splitWords = (text: string, punch: string | null): { words: Word[]; matched: boolean } => {
  const source = text.normalize("NFC");
  const found: { text: string; start: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) found.push({ text: m[0], start: m.index });
  let at = -1;
  let end = -1;
  if (punch) {
    const needle = norm(punch).replace(/[.,!?;:…]+$/u, "");
    at = needle ? norm(source).indexOf(needle) : -1;
    end = at + needle.length;
  }
  return {
    words: found.map((f) => ({ text: f.text, bold: at >= 0 && f.start < end && f.start + f.text.length > at })),
    matched: at >= 0,
  };
};

// ---------------------------------------------------------------- kích thước

export type Metrics = ReturnType<typeof metricsFor>;

/** Mọi kích thước của giao diện theo u (1 = màn hình chat rộng 840px). */
export const metricsFor = (u: number, listW: number) => ({
  u,
  listW,
  fontSize: 40 * u,
  lineH: 52 * u,
  padX: 30 * u,
  padY: 17 * u,
  radius: 40 * u,
  tailRadius: 10 * u,
  bubbleMaxW: listW * 0.74,
  gapSame: 7 * u,
  gapOther: 26 * u,
  gapSystem: 30 * u,
  typingW: 150 * u,
  typingH: 86 * u,
  nameSize: 27 * u,
  nameH: 40 * u,
  reactionSize: 74 * u,
  reactionTop: 38 * u,
  mediaW: listW * 0.56,
  mediaRatio: 4 / 5,
  pillSize: 26 * u,
  pillH: 58 * u,
  narrationSize: 31 * u,
  narrationLineH: 42 * u,
  statMax: 200 * u,
  statCaptionSize: 30 * u,
  statCaptionH: 44 * u,
});

// ---------------------------------------------------------------- dòng thời gian

export type Side = "left" | "right" | "center";

type Base = {
  key: string;
  appear: number;
  /** Frame bắt đầu hiện "đang gõ…"; null = không có. */
  typingStart: number | null;
  side: Side;
  speaker: string | null;
  height: number;
  width: number;
  gapBefore: number;
  sceneIndex: number;
};

export type TextItem = Base & {
  kind: "text";
  lines: Line[];
  plain: string;
  showName: boolean;
  /** Bong bóng cuối của một lượt → góc đuôi nhọn. */
  tail: boolean;
  reaction: { emoji: string; at: number } | null;
};
export type NarrationItem = Base & { kind: "narration"; lines: Line[] };
export type PillItem = Base & { kind: "divider" | "badge"; text: string; caption: string | null };
export type MediaItem = Base & { kind: "media"; scene: Scene; sceneStart: number; tail: boolean };
export type StatItem = Base & { kind: "stat"; text: string; caption: string | null; statSize: number };

export type ChatItem = TextItem | NarrationItem | PillItem | MediaItem | StatItem;

export type Conversation = {
  items: ChatItem[];
  contact: string;
  group: boolean;
};

const MIN_GAP_FRAMES = 6;
const TYPING_MAX = 18;
const TYPING_MIN = 6;
const REACTIONS = ["‼️", "😱", "😮", "❤️"];

type Msg = { index: number; caption: Caption; speaker: string | null; text: string; sceneIndex: number };

const sceneIndexAtMs = (scenes: Scene[], ms: number) => {
  let idx = -1;
  // Dung sai 60ms: caption đầu cảnh hay lệch vài ms so với mốc cảnh.
  for (let i = 0; i < scenes.length; i++) if (ms + 60 >= scenes[i].startMs) idx = i;
  return idx;
};

export const buildConversation = (
  captions: Caption[],
  scenes: Scene[],
  title: string,
  introEnd: number,
  m: Metrics,
): Conversation => {
  // ---- 1. người nói của từng caption ----
  const msgs: Msg[] = [];
  let pending: string | null = null;
  let previous: string | null = null;
  let lastScene = -1;
  captions.forEach((caption, index) => {
    const parsed = parseLine(caption.text);
    const sceneIndex = sceneIndexAtMs(scenes, caption.startMs);
    const firstOfScene = sceneIndex !== lastScene;
    lastScene = sceneIndex;
    if (parsed.nameOnly) {
      pending = parsed.speaker;
      return;
    }
    let speaker: string | null;
    if (parsed.speaker) speaker = parsed.speaker;
    else if (pending) speaker = pending;
    // Câu không tên đứng đầu một cảnh mới (sau cảnh đầu) là lời dẫn chuyển thời gian.
    else if (firstOfScene && sceneIndex > 0) speaker = null;
    else speaker = previous;
    pending = null;
    previous = speaker;
    if (!parsed.text) return;
    msgs.push({ index, caption, speaker, text: parsed.text, sceneIndex });
  });

  // ---- 2. bên trái / phải ----
  const order: string[] = [];
  const display = new Map<string, string>();
  for (const msg of msgs) {
    if (!msg.speaker) continue;
    const k = norm(msg.speaker);
    if (!display.has(k)) {
      display.set(k, msg.speaker);
      order.push(k);
    }
  }
  const hasMe = order.some((k) => ME_NAMES.includes(k));
  const sideOf = (speaker: string | null): Side => {
    if (!speaker) return "center";
    const k = norm(speaker);
    if (hasMe) return ME_NAMES.includes(k) ? "right" : "left";
    return order.indexOf(k) === 1 ? "right" : "left";
  };
  const group = order.length >= 3;
  const leftSpeakers = order.filter((k) => sideOf(k) === "left");
  const contact = leftSpeakers.length === 1 ? display.get(leftSpeakers[0])! : title || "Tin nhắn";

  // ---- 3. sự kiện theo thứ tự thời gian ----
  type Event =
    | { type: "msg"; desired: number; rank: number; msg: Msg }
    | { type: "scene"; desired: number; rank: number; kind: "divider" | "badge" | "media" | "stat"; sceneIndex: number };
  const events: Event[] = [];
  // Cảnh mở đầu bằng lời dẫn ("Sáng hôm sau…") trong vòng 2 giây: mốc thời gian → lời dẫn → ảnh/số.
  const leadNarration = new Map<number, Msg>();
  scenes.forEach((scene, si) => {
    const first = msgs.find((x) => x.sceneIndex === si);
    if (first && !first.speaker && first.caption.startMs - scene.startMs < 2000) leadNarration.set(si, first);
  });
  scenes.forEach((scene, si) => {
    const start = msToFrames(scene.startMs);
    const lead = leadNarration.get(si);
    const push = (kind: "divider" | "badge" | "media" | "stat", r: number) =>
      events.push({
        type: "scene",
        desired: kind !== "divider" && lead ? msToFrames(lead.caption.startMs) : start,
        rank: si * 10 + r,
        kind,
        sceneIndex: si,
      });
    if (scene.tag) push("divider", 0);
    if (scene.visual?.type === "badge") push("badge", 1);
    if (scene.image) push("media", 2);
    if (scene.visual?.type === "stat") push("stat", 3);
  });
  msgs.forEach((msg) =>
    events.push({
      type: "msg",
      desired: msToFrames(msg.caption.startMs),
      rank: leadNarration.get(msg.sceneIndex) === msg ? msg.sceneIndex * 10 + 0.5 : 100000 + msg.index,
      msg,
    }),
  );
  events.sort((a, b) => a.desired - b.desired || a.rank - b.rank);

  // ---- 4. dựng mục + frame xuất hiện ----
  const items: ChatItem[] = [];
  let lastAppear = -Infinity;
  const firstSpeakerOfScene = (si: number) => msgs.find((x) => x.sceneIndex === si && x.speaker)?.speaker ?? null;

  for (const ev of events) {
    const appear = Math.max(ev.desired, introEnd, lastAppear + MIN_GAP_FRAMES);
    if (ev.type === "msg") {
      const { msg } = ev;
      const side = sideOf(msg.speaker);
      const typingStart = Math.max(appear - TYPING_MAX, lastAppear + 4, introEnd);
      const base = {
        key: `m${msg.index}`,
        appear,
        typingStart: side !== "center" && appear - typingStart >= TYPING_MIN ? typingStart : null,
        side,
        speaker: msg.speaker,
        sceneIndex: msg.sceneIndex,
        gapBefore: 0,
      };
      if (side === "center") {
        const lines = wrapWords(splitWords(msg.text, null).words, m.narrationSize, m.listW * 0.8, 500);
        items.push({ ...base, kind: "narration", lines, height: lines.length * m.narrationLineH + 8 * m.u, width: m.listW });
      } else {
        const scene = scenes[msg.sceneIndex];
        const { words } = splitWords(msg.text, scene?.punch?.text ?? null);
        const lines = wrapWords(words, m.fontSize, m.bubbleMaxW - m.padX * 2);
        items.push({
          ...base,
          kind: "text",
          lines,
          plain: msg.text,
          showName: false,
          tail: false,
          reaction: null,
          height: 0,
          width: Math.min(m.bubbleMaxW, Math.max(...lines.map((l) => l.width)) + m.padX * 2 + 2),
        });
      }
    } else {
      const scene = scenes[ev.sceneIndex];
      const speaker = firstSpeakerOfScene(ev.sceneIndex);
      const side: Side = speaker ? sideOf(speaker) : "right";
      const base = {
        key: `s${ev.sceneIndex}-${ev.kind}`,
        appear,
        typingStart: null,
        sceneIndex: ev.sceneIndex,
        gapBefore: 0,
      };
      if (ev.kind === "divider" || ev.kind === "badge") {
        const text = ev.kind === "divider" ? (scene.tag as string) : (scene.visual?.text ?? "");
        const caption = ev.kind === "badge" ? (scene.visual?.caption ?? null) : null;
        items.push({ ...base, kind: ev.kind, text, caption, side: "center", speaker: null, height: m.pillH, width: m.listW });
      } else if (ev.kind === "media") {
        items.push({
          ...base,
          kind: "media",
          scene,
          sceneStart: msToFrames(scene.startMs),
          side,
          speaker,
          tail: false,
          width: m.mediaW,
          height: m.mediaW / m.mediaRatio,
        });
      } else {
        const text = scene.visual?.text ?? "";
        const caption = scene.visual?.caption ?? null;
        const fit = ((m.bubbleMaxW * 0.96) / Math.max(1, measure100(text, 800) * SAFETY)) * 100;
        const statSize = Math.min(m.statMax, fit);
        items.push({
          ...base,
          kind: "stat",
          text,
          caption,
          statSize,
          side,
          speaker,
          width: m.bubbleMaxW,
          height: statSize * 1.08 + (caption ? m.statCaptionH : 0),
        });
      }
    }
    lastAppear = appear;
  }

  // ---- 5. punch → chữ đậm + thả cảm xúc ----
  scenes.forEach((scene, si) => {
    if (!scene.punch) return;
    const inScene = items.filter((it): it is TextItem => it.kind === "text" && it.sceneIndex === si);
    const needle = scene.punch.text;
    const target =
      inScene.find((it) => splitWords(it.plain, needle).matched) ??
      [...inScene].reverse().find((it) => it.appear <= msToFrames(scene.punch!.atMs)) ??
      inScene[0];
    if (!target) return;
    target.reaction = {
      emoji: REACTIONS[Math.floor(seeded(`chat-reaction-${si}-${needle}`, 0, 2))],
      at: Math.max(msToFrames(scene.punch.atMs), target.appear + 8),
    };
  });

  // ---- 6. nhóm lượt, tên người gửi, khoảng cách, chiều cao ----
  const isBubble = (it: ChatItem | undefined): it is TextItem | MediaItem | StatItem =>
    Boolean(it && (it.kind === "text" || it.kind === "media" || it.kind === "stat"));
  items.forEach((it, i) => {
    const prev = items[i - 1];
    const next = items[i + 1];
    const sameAsPrev = isBubble(it) && isBubble(prev) && prev.side === it.side && norm(prev.speaker ?? "") === norm(it.speaker ?? "");
    const sameAsNext = isBubble(it) && isBubble(next) && next.side === it.side && norm(next.speaker ?? "") === norm(it.speaker ?? "");
    if (i === 0) it.gapBefore = 0;
    else if (!isBubble(it) || !isBubble(prev)) it.gapBefore = m.gapSystem;
    else it.gapBefore = sameAsPrev ? m.gapSame : m.gapOther;
    if (it.kind === "text") {
      it.tail = !sameAsNext;
      it.showName = group && it.side === "left" && !sameAsPrev;
      it.height =
        it.lines.length * m.lineH + m.padY * 2 + (it.showName ? m.nameH : 0) + (it.reaction ? m.reactionTop : 0);
    }
    if (it.kind === "media") it.tail = !sameAsNext;
  });

  return { items, contact, group };
};

// ---------------------------------------------------------------- cuộn

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Chiều cao mục đang chiếm trong danh sách tại frame (0 khi chưa tới lượt). */
export const slotHeight = (it: ChatItem, frame: number, m: Metrics) => {
  if (it.typingStart !== null) {
    const typingH = m.typingH + (it.kind === "text" && it.showName ? m.nameH : 0);
    if (frame < it.typingStart) return 0;
    if (frame < it.appear) return (typingH + it.gapBefore) * easeOut((frame - it.typingStart) / 6);
    return it.gapBefore + typingH + (it.height - typingH) * easeOut((frame - it.appear) / 7);
  }
  if (frame < it.appear) return 0;
  return (it.height + it.gapBefore) * easeOut((frame - it.appear) / 7);
};
