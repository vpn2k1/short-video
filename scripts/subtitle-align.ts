/**
 * Khớp phụ đề tự động với âm thanh thật.
 *
 * whisper.cpp 1.5.5 cho hai thứ, mỗi thứ chỉ đúng một nửa (đã đo trên clip tiếng Việt và tiếng Anh):
 *  - Chữ theo câu (--max-len + --split-on-word): đúng câu, không vỡ dấu tiếng Việt — nhưng mép đoạn
 *    nuốt luôn khoảng lặng (câu đầu tính từ 0s dù 0,7s sau mới có tiếng), và trần tính theo byte nên
 *    thỉnh thoảng vẫn cắt đôi một câu ("…phòng ngủ tối" / "và mát.").
 *  - Thời gian từng từ: lệch với tiếng thật (từ dài 0ms, từ nằm giữa khoảng lặng) và vỡ UTF-8 tiếng Việt.
 *
 * Nên lấy CHỮ từ whisper, lấy RANH GIỚI NÓI/LẶNG từ chính âm thanh (ffmpeg silencedetect): gộp câu bị
 * cắt đôi, co mép phụ đề vào đúng lúc bắt đầu/ngừng nói, câu dài chia dòng ≤ 42 ký tự rồi rải thời gian
 * theo phần có tiếng — ranh giới dòng rơi gần một chỗ ngừng thì dời vào đúng chỗ ngừng đó.
 *
 * Video có nhạc nền/tiếng ồn thì silencedetect không thấy chỗ lặng nào, và mép đoạn của whisper tự nó
 * sai cả chục giây (đoạn sau bắt đầu ngay lúc đoạn trước dứt, dù giữa là 8 giây tiếng xe). Khi có mốc
 * DTW từng từ (transcribeSentences), đầu đoạn và đầu mỗi dòng lấy theo mốc đó; khoảng lặng vẫn dùng
 * để tinh chỉnh mép nếu nó thật sự nằm sát mép.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import type { Caption } from "../src/compositions/Short/schema";

const run = promisify(execFile);

export type Span = { startMs: number; endMs: number };
/** Mốc DTW: từ bắt đầu ở ký tự thứ `at` của câu được nói lúc `ms` (tính từ đầu wav). */
export type Mark = { at: number; ms: number };
export type Segment = Span & { text: string; marks?: Mark[] };

/** Dưới ngưỡng này và kéo dài ít nhất SILENCE_MIN_S giây thì coi là ngừng nói. */
const SILENCE_DB = -35;
const SILENCE_MIN_S = 0.3;
/** Mép đoạn của whisper lệch vài trăm ms so với tiếng thật — nới ra khi tìm phần có tiếng. */
const EDGE_TOLERANCE_MS = 300;
/** Hai đoạn cách nhau ít hơn thế và đoạn trước chưa hết câu → là một câu bị cắt đôi. */
const JOIN_GAP_MS = 300;
/** Dòng phụ đề ngắn nhất để kịp đọc. */
const MIN_LINE_MS = 700;
/** Ranh giới dòng cách một chỗ ngừng trong câu chừng này thì dời vào đúng chỗ ngừng. */
const SNAP_MS = 400;
/** Đoạn ngắn hơn thế là tiếng lách cách, không phải lời nói. */
const MIN_SPEECH_MS = 80;
/**
 * Mốc DTW của whisper.cpp trễ hơn lúc thật sự cất tiếng 0,1–0,4 giây, câu một từ sau quãng nghỉ tới 0,6
 * giây (đo trên 8 clip hội thoại tiếng Anh có nhạc nền, so với đường năng lượng) — lùi lại chừng này để
 * phụ đề không hiện muộn. Hiện sớm một chút dễ đọc hơn hiện muộn.
 */
const DTW_LEAD_MS = 300;
/** Trước đó chừng này nữa mà có chỗ hết lặng thật thì đó mới là lúc bắt đầu nói. */
const ONSET_LOOKBACK_MS = 400;
/**
 * Mốc DTW chỉ cho lúc bắt đầu một từ — thời gian nói hết từ ước theo số chữ, trong khoảng này, cộng từ
 * mốc gốc (chưa lùi): độ trễ của DTW thành phần dư, phụ đề nán lại chút chứ không tắt trước khi dứt tiếng.
 */
const MS_PER_CHAR = 90;
const WORD_MS: [number, number] = [250, 900];
/**
 * Từ đầu đoạn cách từ kế lâu hơn thời gian nói nó chừng này, mà không có dấu ngắt để ngừng ở đó → DTW
 * đã kéo mốc của nó về đầu quãng nhạc dạo phía trước ("Is" ở 0,08s, "the" ở 2,82s, tiếng nói từ 2,5s).
 */
const STRAY_FIRST_MS = 1000;

const wordMs = (chars: number) => Math.min(Math.max(chars * MS_PER_CHAR, WORD_MS[0]), WORD_MS[1]);

/**
 * Câu whisper tự bịa khi chỉ có tiếng ồn ("Hãy đăng ký kênh để xem những video mới nhất") không có tiếng
 * nào để DTW khớp vào: mọi từ dồn về cùng một mốc. Nói thật thì không ai đọc 4 từ trong vài chục ms.
 */
const hallucinated = (marks: Mark[]) =>
  marks.length >= 4 && marks[marks.length - 1].ms - marks[0].ms < 30 * (marks.length - 1);

const endsSentence = (text: string) => /[.!?…]["')\]»]?$/.test(text.trim());
/** Chú thích âm thanh của whisper — "(clock ticking)", "[Music]", "♪ ♪" — không phải lời nói. */
const NON_SPEECH = /^[[(♪*].*[\])♪*]$/;

/** Khoảng lặng trong file wav, tính bằng ms từ đầu file. */
export const detectSilences = async (wav: string): Promise<Span[]> => {
  // Không dùng -v error: silencedetect in kết quả ở mức info.
  const { stderr } = await run(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", wav, "-af", `silencedetect=noise=${SILENCE_DB}dB:d=${SILENCE_MIN_S}`, "-f", "null", "-"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  const spans: Span[] = [];
  let start: number | null = null;
  for (const match of stderr.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    const ms = Math.max(0, Math.round(parseFloat(match[2]) * 1000));
    if (match[1] === "start") start = ms;
    else if (start !== null) {
      spans.push({ startMs: start, endMs: ms });
      start = null;
    }
  }
  // Lặng tới hết file thì ffmpeg không in silence_end.
  if (start !== null) spans.push({ startMs: start, endMs: Number.POSITIVE_INFINITY });
  return spans;
};

/** Phần có tiếng = phần bù của các khoảng lặng trong [0, durationMs]. */
export const speechSpans = (silences: Span[], durationMs: number): Span[] => {
  const spans: Span[] = [];
  let cursor = 0;
  for (const silence of [...silences].sort((a, b) => a.startMs - b.startMs)) {
    if (silence.startMs > cursor) spans.push({ startMs: cursor, endMs: Math.min(silence.startMs, durationMs) });
    cursor = Math.max(cursor, silence.endMs);
  }
  if (cursor < durationMs) spans.push({ startMs: cursor, endMs: durationMs });
  return spans.filter((s) => s.endMs - s.startMs >= MIN_SPEECH_MS);
};

/** Ngắt dòng đều nhau thay vì dòng đầu dài, dòng cuối cụt. */
const wrapBalanced = (text: string, maxChars: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const count = Math.ceil(text.length / maxChars);
  const target = text.length / count;
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && (next.length > maxChars || (current.length >= target && lines.length < count - 1))) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/** Chia một đoạn thành các dòng ≤ maxChars: ưu tiên hết câu, rồi dấu phẩy/chấm phẩy, cuối cùng mới cắt theo từ. */
export const splitText = (text: string, maxChars = 42): string[] => {
  const out: string[] = [];
  // Số thứ tự "1." / "2)" không phải hết câu — dính vào câu phía sau thay vì thành một dòng riêng.
  const sentences = text.trim().split(/(?<=[.!?…])\s+/).reduce<string[]>((acc, part) => {
    const previous = acc[acc.length - 1];
    if (previous !== undefined && /^\d{1,3}[.)]$/.test(previous)) acc[acc.length - 1] = `${previous} ${part}`;
    else acc.push(part);
    return acc;
  }, []);
  for (const sentence of sentences) {
    if (!sentence) continue;
    if (sentence.length <= maxChars) {
      out.push(sentence);
      continue;
    }
    const lines: string[] = [];
    let buffer = "";
    const flush = () => {
      if (!buffer) return;
      lines.push(...(buffer.length > maxChars ? wrapBalanced(buffer, maxChars) : [buffer]));
      buffer = "";
    };
    for (const clause of sentence.split(/(?<=[,;:–—])\s+/)) {
      const next = buffer ? `${buffer} ${clause}` : clause;
      if (buffer && next.length > maxChars) {
        flush();
        buffer = clause;
      } else {
        buffer = next;
      }
    }
    flush();
    // Dòng cuối cụt vài chữ ("và mát.") thì trả về dòng trước nếu không quá dài.
    const last = lines[lines.length - 1];
    if (lines.length > 1 && last.length < 10 && lines[lines.length - 2].length + 1 + last.length <= maxChars * 1.25) {
      lines.splice(-2, 2, `${lines[lines.length - 2]} ${last}`);
    }
    out.push(...lines);
  }
  return out;
};

/**
 * Rải các dòng lên phần có tiếng của một đoạn, theo độ dài chữ — hoặc theo mốc DTW nếu có: dòng bắt đầu
 * lúc nói chữ đầu của nó (`starts`), và tắt sau chữ cuối (`ends`) chứ không đợi tới dòng sau khi giữa hai
 * dòng là một quãng nhạc. Ranh giới dòng gần một chỗ ngừng thì dòng trước kết thúc đúng lúc ngừng, dòng
 * sau bắt đầu đúng lúc nói lại.
 */
const placeLines = (lines: string[], active: Span[], timing?: { starts: number[]; ends: number[] }): Span[] => {
  const total = active.reduce((sum, span) => sum + span.endMs - span.startMs, 0);
  const timeAt = (fraction: number) => {
    let left = fraction * total;
    for (const span of active) {
      const length = span.endMs - span.startMs;
      if (left <= length) return span.startMs + left;
      left -= length;
    }
    return active[active.length - 1].endMs;
  };
  const weights = lines.map((line) => line.length + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const last = active[active.length - 1].endMs;

  const result: Span[] = [];
  let start = active[0].startMs;
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i === lines.length - 1) {
      result.push({ startMs: start, endMs: last });
      break;
    }
    acc += weights[i];
    const t = timing ? Math.min(Math.max(timing.starts[i + 1], start), last) : timeAt(acc / weightSum);
    let end = t;
    let nextStart = t;
    for (let g = 0; g < active.length - 1; g++) {
      const gapStart = active[g].endMs;
      const gapEnd = active[g + 1].startMs;
      if (gapStart > start && t >= gapStart - SNAP_MS && t <= gapEnd + SNAP_MS) {
        end = gapStart;
        nextStart = gapEnd;
        break;
      }
    }
    if (timing) end = Math.min(end, Math.max(timing.ends[i], start));
    result.push({ startMs: start, endMs: end });
    start = nextStart;
  }
  return result;
};

/** Từ (tới dấu cách kế tiếp) bắt đầu ở vị trí `at`. */
const wordAt = (text: string, at: number) => /^\S*/.exec(text.slice(at))![0];

/** Chỉ giữ mốc của từ có đọc thành tiếng — gạch "-" mở lượt thoại hay "♪" không có tiếng nào để khớp. */
const spokenMarks = (text: string, marks: Mark[]) => marks.filter((mark) => /[\p{L}\p{N}]/u.test(wordAt(text, mark.at)));

/**
 * Mép một đoạn theo mốc DTW: đầu = lúc bắt đầu từ đầu tiên; cuối = lúc bắt đầu từ cuối + thời gian
 * ước theo số chữ của nó, nhưng không quá mép cuối whisper đưa — mốc của từ cuối câu hay bị DTW
 * kéo lệch vào khoảng im phía sau ("minutes" ở 5,98s trong khi câu dứt từ 4,93s).
 */
const timedSpan = (segment: Segment, marks: Mark[]): Span => {
  const [first, second] = marks;
  const firstWord = wordAt(segment.text, first.at);
  const stray = second && !/[.,;:!?…]$/.test(firstWord) && second.ms - first.ms > wordMs(firstWord.length) + STRAY_FIRST_MS;
  const firstMs = stray ? second.ms - wordMs(firstWord.length) : first.ms;
  const startMs = Math.max(0, firstMs - DTW_LEAD_MS, segment.startMs - EDGE_TOLERANCE_MS);
  const last = marks[marks.length - 1];
  const estimate = Math.max(last.ms, startMs) + wordMs(segment.text.length - last.at);
  return { startMs, endMs: segment.endMs > startMs ? Math.min(segment.endMs, estimate) : estimate };
};

/** Lúc dòng `line` (ở vị trí `at` trong câu) bắt đầu và dứt tiếng, theo mốc DTW. */
const lineTiming = (line: string, at: number, marks: Mark[]) => {
  const nearest = marks.reduce((best, mark) => (Math.abs(mark.at - at) < Math.abs(best.at - at) ? mark : best));
  const inside = marks.filter((mark) => mark.at >= at && mark.at < at + line.length);
  const lastWord = inside[inside.length - 1];
  return {
    start: nearest.ms - DTW_LEAD_MS,
    end: lastWord ? lastWord.ms + wordMs(at + line.length - lastWord.at) : Number.POSITIVE_INFINITY,
  };
};

/**
 * Đoạn whisper (thời gian tính từ đầu wav) + khoảng lặng thật → phụ đề đúng câu, đúng lúc nói.
 * Không đo được khoảng lặng (nhạc nền lớn, tiếng ồn) thì dựa vào mốc DTW, không có mốc thì giữ
 * nguyên thời gian của whisper.
 */
export const alignCaptions = (
  segments: Segment[],
  silences: Span[],
  durationMs: number,
  maxChars = 42,
): Caption[] => {
  // 1. Bỏ đoạn rỗng và chú thích âm thanh; gộp câu bị cắt đôi (mốc DTW của đoạn sau dời theo chữ).
  const merged: Segment[] = [];
  for (const raw of segments) {
    const text = raw.text.replace(/\s+/g, " ").trim();
    if (!text || NON_SPEECH.test(text)) continue;
    const previous = merged[merged.length - 1];
    if (previous && !endsSentence(previous.text) && raw.startMs - previous.endMs < JOIN_GAP_MS) {
      const offset = previous.text.length + 1;
      previous.marks = previous.marks && raw.marks?.length
        ? [...previous.marks, ...raw.marks.map((mark) => ({ at: mark.at + offset, ms: mark.ms }))]
        : undefined;
      previous.text = `${previous.text} ${text}`;
      previous.endMs = Math.max(previous.endMs, raw.endMs);
    } else {
      merged.push({ text, startMs: raw.startMs, endMs: raw.endMs, marks: raw.marks?.length ? [...raw.marks] : undefined });
    }
  }
  // Chỉ giữ mốc của chữ có tiếng; câu whisper tự bịa (mọi mốc dồn một chỗ) bỏ luôn.
  const kept = merged.filter((segment) => {
    const marks = segment.marks && spokenMarks(segment.text, segment.marks);
    segment.marks = marks?.length ? marks : undefined;
    return !segment.marks || !hallucinated(segment.marks);
  });

  // 2. Mép từng đoạn: theo mốc DTW nếu có, không thì mép của whisper.
  const spans = kept.map((segment) => (segment.marks ? timedSpan(segment, segment.marks) : { startMs: segment.startMs, endMs: segment.endMs }));

  const speech = speechSpans(silences, durationMs);
  const captions: Caption[] = [];
  kept.forEach((segment, index) => {
    const { startMs, endMs } = spans[index];
    const marks = segment.marks;
    // 3. Phần có tiếng của đoạn: nới mép theo sai số, nhưng không lấn sang đoạn kề.
    const lo = Math.max(0, startMs - (marks ? ONSET_LOOKBACK_MS : EDGE_TOLERANCE_MS), index > 0 ? spans[index - 1].endMs : 0);
    const hi = Math.min(
      durationMs,
      endMs + EDGE_TOLERANCE_MS,
      index < kept.length - 1 ? spans[index + 1].startMs : Number.POSITIVE_INFINITY,
    );
    let active = speech
      .map((span) => ({ startMs: Math.max(span.startMs, lo), endMs: Math.min(span.endMs, hi) }))
      .filter((span) => span.endMs - span.startMs >= MIN_SPEECH_MS);
    if (marks && active.length > 0) {
      // Mốc DTW đã gần tiếng thật: chỉ theo khoảng lặng khi chỗ lặng nằm ngay trong phần nới. Phần có
      // tiếng tràn qua hết phần nới (nhạc nền, tiếng ồn) thì mép nới không nói lên gì — giữ mốc DTW.
      if (active[0].startMs === lo && lo < startMs) active[0].startMs = Math.min(startMs, active[0].endMs);
      const tail = active[active.length - 1];
      if (tail.endMs === hi && hi > endMs) tail.endMs = Math.max(endMs, tail.startMs);
      active = active.filter((span) => span.endMs - span.startMs >= MIN_SPEECH_MS);
    }
    if (active.length === 0) {
      active = [{ startMs, endMs: Math.min(Math.max(endMs, startMs + MIN_LINE_MS), durationMs) }];
    }

    // 4. Chia dòng và rải thời gian — có mốc DTW thì mỗi dòng theo đúng lúc nói chữ của nó.
    const lines = splitText(segment.text, maxChars);
    let timing: { starts: number[]; ends: number[] } | undefined;
    if (marks) {
      timing = { starts: [], ends: [] };
      let from = 0;
      for (const line of lines) {
        const found = segment.text.indexOf(line, from);
        const at = found >= 0 ? found : from;
        from = at + line.length + 1;
        const { start, end } = lineTiming(line, at, marks);
        timing.starts.push(start);
        timing.ends.push(end);
      }
    }
    placeLines(lines, active, timing).forEach((span, i) => {
      captions.push({ text: lines[i], startMs: Math.round(span.startMs), endMs: Math.round(span.endMs), audio: null });
    });
  });

  // 5. Dòng quá ngắn thì kéo dài cho kịp đọc, nhưng không đè lên dòng sau.
  captions.sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < captions.length; i++) {
    const nextStart = i < captions.length - 1 ? captions[i + 1].startMs : durationMs;
    if (captions[i].endMs - captions[i].startMs < MIN_LINE_MS) {
      captions[i].endMs = Math.round(Math.min(captions[i].startMs + MIN_LINE_MS, nextStart));
    }
    if (captions[i].endMs > nextStart) captions[i].endMs = nextStart;
  }
  return captions.filter((c) => c.endMs > c.startMs);
};
