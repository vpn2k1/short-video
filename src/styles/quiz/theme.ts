/**
 * Hằng số màu, easing và các hàm thuần của phong cách "quiz" (Câu đố).
 * Không có React ở đây — phần phân tích câu hỏi/đáp án nằm cả ở file này để dễ kiểm.
 */
import { Easing, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { fitFontSize, punchLines } from "../shared";
import { translateVideoText, type VideoLanguage } from "../../i18n/video";

export const INK = "#1d1740";
export const WHITE = "#ffffff";
export const GREEN = "#22c55e";
export const GREEN_DARK = "#15803d";
export const AMBER = "#f59e0b";
export const RED = "#ef4444";
export const YELLOW = "#ffd43b";

/** Bảng màu confetti — cố định, không phụ thuộc accent để luôn rực. */
export const CONFETTI = ["#ffd43b", "#22c55e", "#3b82f6", "#ef4444", "#ffffff", "#a855f7", "#f97316"];

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
/** Vào có nảy nhẹ quá đích — cảm giác game show. */
export const EASE_BACK = Easing.out(Easing.back(1.8));

/** Nội suy 0→1 có kẹp. length ≥ 1 nên dãy mốc luôn tăng nghiêm ngặt. */
export const ramp = (
  frame: number,
  from: number,
  length: number,
  easing: (t: number) => number = EASE_OUT,
) =>
  interpolate(frame, [from, from + Math.max(1, length)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** In hoa tiếng Việt an toàn — KHÔNG dùng CSS text-transform. */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

const parseHex = (color: string): [number, number, number] | null => {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

export const withAlpha = (color: string, alpha: number) => {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
};

/** accent → HSL để dựng gradient nền rực từ một màu bất kỳ. */
const toHsl = (color: string): [number, number, number] => {
  const rgb = parseHex(color);
  if (!rgb) return [265, 80, 55];
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};

/**
 * Bảng màu suy từ accent: sáng/đậm/tối cùng tông, lệch hue một chút cho gradient sống.
 * Bão hoà ép tối thiểu 70% — accent xám vẫn ra nền game show rực.
 */
export const paletteFrom = (accent: string) => {
  const [h, s0, l0] = toHsl(accent);
  const s = Math.max(70, s0);
  const l = Math.min(58, Math.max(42, l0));
  // Tông ấm/xanh lá (cam, vàng, lục) đậm dần về phía đỏ; tông lạnh đậm về phía tím.
  // Lệch sai chiều thì cam → vàng rêu, rất bẩn.
  const shift = h > 15 && h < 190 ? -26 : 26;
  return {
    light: `hsl(${h - shift * 0.4}, ${s}%, ${l + 8}%)`,
    base: `hsl(${h}, ${s}%, ${l}%)`,
    deep: `hsl(${h + shift}, ${Math.min(100, s + 5)}%, ${l - 16}%)`,
    darker: `hsl(${h + shift * 1.3}, ${Math.min(100, s + 5)}%, ${Math.max(12, l - 28)}%)`,
  };
};

/**
 * Cỡ chữ đáp án (in hoa, weight 900): ưu tiên vừa MỘT dòng trong `width`, không nhỏ hơn
 * 60% cỡ gốc; dài hơn nữa thì cho xuống dòng. Hệ số 0.72/ký tự đo từ still "MÀU XANH LAM".
 * Người dùng tự xuống dòng ("\n") thì tính theo dòng dài nhất.
 */
export const ANSWER_CHAR_W = 0.72;
export const answerFontSize = (text: string, base: number, width: number) => {
  const longest = punchLines(text).reduce((a, b) => ([...b].length > [...a].length ? b : a), "");
  const len = Math.max(1, [...longest].length);
  const byLength = fitFontSize(longest, base, 0.5);
  const oneLine = width / (len * ANSWER_CHAR_W);
  return Math.round(Math.min(byLength, Math.max(oneLine, base * 0.6)));
};

/** Ước số dòng khi chữ xuống dòng trong khung rộng `width`. */
export const estimateLines = (text: string, fontSize: number, width: number, charWidth = 0.54): number => {
  // Có "\n" tự ngắt: mỗi đoạn tự xuống dòng riêng.
  if (text.includes("\n")) {
    return text.split("\n").reduce((sum, part) => sum + estimateLines(part, fontSize, width, charWidth), 0);
  }
  const perLine = Math.max(4, Math.floor(width / (fontSize * charWidth)));
  // Ngắt theo từ: cộng dồn từng từ, xuống dòng khi tràn.
  const words = text.trim().split(/\s+/);
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const len = [...word].length;
    if (used === 0) used = len;
    else if (used + 1 + len <= perLine) used += 1 + len;
    else {
      lines += 1;
      used = len;
    }
  }
  return lines;
};

const norm = (text: string) => text.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();

/** Câu kiểu "Suy nghĩ 3 giây nhé…", "Bạn đoán được không?" — dòng chờ trước đáp án. */
const PAUSE_RE = /(suy nghĩ|nghĩ kỹ|đoán|giây|đếm ngược|3\s*[,.…]?\s*2\s*[,.…]?\s*1|bình luận|chốt đáp án|trả lời đi|bạn chọn|\b(?:think|guess|seconds?|count ?down|comment|lock (?:it )?in|your answer|pick one|choose)\b)/i;

export type QuizOption = {
  letter: string;
  text: string;
  /** Frame lựa chọn bắt đầu được đọc. */
  frame: number;
  correct: boolean;
};

export type ScoreRow = { range: string; verdict: string; frame: number };

/** "A. I'd like noodles", "B) Fever", "C: …" — chữ cái A–F đứng đầu, theo sau là . ) : hoặc gạch. */
const OPTION_RE = /^\s*([A-Fa-f])\s*[.):\-–]\s+(.+)$/;
/** "9–10 câu: Excellent! 🌟", "0-4 câu: Keep practicing!" — dòng xếp loại theo số câu đúng. */
const SCORE_RE = /^\s*\**\s*(\d+\s*[–\-—]\s*\d+|\d+\+?)\s*(câu|questions?|correct)?\s*\**\s*[:：]\s*\**\s*(.+?)\s*\**\s*$/i;

/** Đáp án đúng trong các lựa chọn: punch mở đầu bằng chữ cái ("A. …") hoặc chứa/khớp chữ của lựa chọn. */
const correctOption = (options: { letter: string; text: string }[], punch: string) => {
  const lead = punch.match(OPTION_RE);
  if (lead) {
    const byLetter = options.findIndex((o) => o.letter === lead[1].toUpperCase());
    if (byLetter >= 0) return byLetter;
  }
  const p = norm(punch);
  const exact = options.findIndex((o) => norm(o.text) === p);
  if (exact >= 0) return exact;
  return options.findIndex((o) => p.includes(norm(o.text)) || norm(o.text).includes(p));
};

export type SceneInfo = {
  scene: Scene;
  index: number;
  /** Frame bắt đầu / kết thúc cảnh theo dữ liệu. */
  start: number;
  end: number;
  /** Frame cảnh bắt đầu hiện (cảnh đầu chờ title card). */
  enter: number;
  /** Nhãn câu: tag, hoặc "CÂU n/N". */
  label: string;
  /** Chữ câu hỏi trên thẻ. */
  question: string;
  /** Câu dẫn tình huống trước câu hỏi (chỉ khi cảnh có các lựa chọn A/B/C) — hiện nhỏ phía trên câu hỏi. */
  context: string | null;
  /** Lựa chọn trắc nghiệm "A. …", "B. …" — mỗi lựa chọn nảy vào lúc được đọc. Rỗng = câu hỏi thường. */
  options: QuizOption[];
  /** Bảng xếp loại cuối video ("9–10 câu: Excellent!") — rỗng nếu cảnh không có. */
  scores: ScoreRow[];
  /** Frame câu hỏi bắt đầu được đọc — thẻ hiện chữ từ đây. */
  questionFrame: number;
  /** Frame lật đáp án; null nếu cảnh không có punch. */
  revealFrame: number | null;
  answer: string | null;
  /** Đồng hồ đếm ngược: [from, to) — null khi cửa sổ quá ngắn hoặc không có punch. */
  countdown: { from: number; to: number } | null;
  /** Chỉ số (toàn cục) các caption KHÔNG hiện ở dải phụ đề (câu hỏi đã nằm trên thẻ, câu đáp án). */
  hiddenCaptions: number[];
};

/** Đồng hồ không bắt đầu sớm hơn 0.8 s sau khi cảnh vào; dài tối đa 3 s. */
const COUNTDOWN_MIN_LEAD = 24;
const COUNTDOWN_MAX = 90;
/** Ngắn hơn chừng này (≈ 0.4 s) thì bỏ đồng hồ — nháy một con số vô nghĩa. */
const COUNTDOWN_MIN = 12;
/**
 * Khoảng lặng trước câu đáp án dài ít nhất chừng này (≈ 2 s) thì đếm trong khoảng lặng đó. Video dựng từ khi
 * timeline chừa QUIZ_THINK_MS (3 s) đều có; video cũ các câu dính liền nhau thì đếm kiểu cũ.
 */
const QUIET_MIN = 60;

/**
 * Suy cấu trúc câu đố từ caption của cảnh:
 *   [dòng mở (hook)…] [câu hỏi…] [dòng chờ] [câu đáp án chứa punch] [dòng kết…]
 * Câu hỏi = khối liền kề kết thúc ở câu có "?" cuối cùng trước đáp án; các dòng liền
 * trước không kết thúc bằng . ! được coi là phần đầu của câu hỏi (câu dài tách 2 dòng).
 */
export const analyzeScenes = (
  scenes: Scene[],
  captions: Caption[],
  showTitle: boolean,
  language?: VideoLanguage,
): SceneInfo[] => {
  const infos = scenes.map((scene, index) => {
    const start = msToFrames(scene.startMs);
    const end = Math.max(start + 1, msToFrames(scene.endMs));
    const enter = index === 0 ? Math.max(start, showTitle ? TITLE_FRAMES - 12 : 0) : start;

    const own = captions
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.startMs >= scene.startMs && c.startMs < scene.endMs && c.text.trim());

    const punch = scene.punch;
    let answerPos = -1;
    if (punch) {
      const p = norm(punch.text);
      answerPos = own.findIndex(({ c }) => punch.atMs >= c.startMs && punch.atMs <= c.endMs + 200 && norm(c.text).includes(p));
      // Câu chứa punch cuối cùng — lựa chọn "A. …" có thể trùng chữ với punch, câu đáp án đứng sau nó.
      if (answerPos < 0) answerPos = own.map(({ c }) => norm(c.text).includes(p)).lastIndexOf(true);
      if (answerPos < 0) answerPos = own.findIndex(({ c }) => punch.atMs >= c.startMs && punch.atMs <= c.endMs);
    }

    const pre = answerPos >= 0 ? own.slice(0, answerPos) : punch ? own.filter(({ c }) => c.startMs < punch.atMs) : own;

    // Trắc nghiệm: các dòng "A. …" "B. …" trước đáp án lên thẻ thành lựa chọn; câu hỏi chỉ tính từ các dòng trước
    // lựa chọn đầu tiên (lựa chọn có thể có "?" — "Do you have a reservation?" — không được nhầm là câu hỏi).
    const firstOption = pre.findIndex(({ c }) => OPTION_RE.test(c.text));
    const optionItems = firstOption >= 0 ? pre.slice(firstOption).filter(({ c }) => OPTION_RE.test(c.text)) : [];
    const hasOptions = optionItems.length >= 2;
    const rawOptions = hasOptions
      ? optionItems.map(({ c }) => {
          const m = c.text.match(OPTION_RE)!;
          return { letter: m[1].toUpperCase(), text: m[2].trim(), frame: Math.max(enter, msToFrames(c.startMs)) };
        })
      : [];
    const correctAt = hasOptions && punch ? correctOption(rawOptions, punch.text) : -1;
    const options: QuizOption[] = rawOptions.map((o, k) => ({ ...o, correct: k === correctAt }));

    // Bảng xếp loại cuối video: cần ít nhất 2 dòng khớp mẫu, cảnh không có punch. Câu hỏi = các dòng trước bảng.
    const scoreCandidates = punch ? [] : own.filter(({ c }) => SCORE_RE.test(c.text));
    const scoreItems = scoreCandidates.length >= 2 ? scoreCandidates : [];
    const scores: ScoreRow[] = scoreItems.map(({ c }) => {
      const m = c.text.match(SCORE_RE)!;
      const range = m[1].replace(/\s+/g, "").replace(/-/g, "–");
      return { range: m[2] ? `${range} ${m[2]}` : range, verdict: m[3], frame: Math.max(enter, msToFrames(c.startMs)) };
    });

    let body = hasOptions
      ? pre.slice(0, firstOption)
      : scoreItems.length
        ? own.filter(({ c }) => c.startMs < scoreItems[0].c.startMs)
        : pre;
    // Dòng chờ ngay trước đáp án (trắc nghiệm: dòng chờ nằm sau các lựa chọn, đã không thuộc body).
    if (punch && !hasOptions && body.length >= 2) {
      const last = body[body.length - 1].c.text;
      const hasQuestionBefore = body.slice(0, -1).some(({ c }) => c.text.includes("?"));
      // Dòng có "?" chỉ là dòng chờ khi trước nó đã có câu hỏi ("Bạn đoán được không?").
      const isPause = last.includes("?")
        ? PAUSE_RE.test(last) && hasQuestionBefore
        : PAUSE_RE.test(last) || hasQuestionBefore;
      if (isPause) body = body.slice(0, -1);
    }

    let qEnd = -1;
    for (let k = body.length - 1; k >= 0; k--) {
      if (body[k].c.text.includes("?")) {
        qEnd = k;
        break;
      }
    }
    if (qEnd < 0) qEnd = body.length - 1;
    let qStart = qEnd;
    while (qStart > 0 && !/[.!…]["”]?\s*$/.test(body[qStart - 1].c.text.trim())) qStart--;
    const questionItems = qEnd >= 0 ? body.slice(qStart, qEnd + 1) : [];
    // Câu dẫn tình huống ("Bạn đang ở nhà hàng…") đi kèm câu hỏi trắc nghiệm; câu hook kết thúc bằng "!" thì không.
    const contextItems = hasOptions
      ? body.slice(0, Math.max(0, qStart)).filter(({ c }) => !/!["”]?\s*$/.test(c.text.trim()))
      : [];
    const context = contextItems.length ? contextItems.map(({ c }) => c.text.trim()).join(" ") : null;

    const fallback = own[0]?.c.text ?? "?";
    const question = questionItems.length ? questionItems.map(({ c }) => c.text.trim()).join(" ") : fallback;
    const firstShown = contextItems[0] ?? questionItems[0];
    const questionFrame = Math.max(enter, firstShown ? msToFrames(firstShown.c.startMs) : enter);

    let revealFrame = punch ? Math.max(msToFrames(punch.atMs), enter + 10) : null;

    let countdown: SceneInfo["countdown"] = null;
    // Khoảng lặng giữa câu trước đáp án và câu đáp án: đếm 3·2·1 đúng giây thật trong đó (không đè lên lời đọc),
    // đếm xong thì lật thẻ ngay lúc giọng bắt đầu đọc đáp án.
    const quietFrom = answerPos > 0 ? msToFrames(own[answerPos - 1].c.endMs) : null;
    const quietTo = answerPos > 0 ? msToFrames(own[answerPos].c.startMs) : null;
    if (revealFrame !== null && quietFrom !== null && quietTo !== null && quietTo - quietFrom >= QUIET_MIN) {
      const from = Math.max(enter + COUNTDOWN_MIN_LEAD, quietFrom, quietTo - COUNTDOWN_MAX);
      if (quietTo - from >= COUNTDOWN_MIN) {
        countdown = { from, to: quietTo };
        revealFrame = quietTo;
      }
    } else if (revealFrame !== null) {
      const from = Math.max(enter + COUNTDOWN_MIN_LEAD, revealFrame - COUNTDOWN_MAX);
      if (revealFrame - from >= COUNTDOWN_MIN) countdown = { from, to: revealFrame };
    }

    const hiddenCaptions = [...contextItems, ...questionItems, ...(hasOptions ? optionItems : []), ...(scores.length ? scoreItems : [])].map(
      ({ i }) => i,
    );
    if (answerPos >= 0) hiddenCaptions.push(own[answerPos].i);

    return {
      scene,
      index,
      start,
      end,
      enter,
      label: "",
      question,
      context,
      options,
      scores,
      questionFrame,
      revealFrame,
      answer: punch ? punch.text.trim() : null,
      countdown,
      hiddenCaptions,
    } satisfies SceneInfo;
  });
  // Đánh số câu bỏ qua cảnh bảng xếp loại.
  const questionTotal = infos.filter((i) => !i.scores.length).length;
  let questionNumber = 0;
  for (const info of infos) {
    if (!info.scores.length) questionNumber += 1;
    info.label = upper(
      info.scene.tag?.trim() ||
        (info.scores.length
          ? translateVideoText(language, "KẾT QUẢ")
          : translateVideoText(language, "CÂU {n}/{total}", { n: questionNumber, total: questionTotal })),
    );
  }
  return infos;
};

/** Tách số đầu tiên của stat ("73%", "9/10", "2,5 triệu") để đếm lên; không có số → null. */
export const parseStat = (text: string) => {
  const match = text.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;
  const decimal = raw.match(/^(\d+)([.,])(\d+)$/);
  const value = Number(raw.replace(",", "."));
  const places = decimal ? decimal[3].length : 0;
  return {
    prefix,
    value,
    suffix,
    /** % → meter dừng ở đúng tỉ lệ. */
    ratio: suffix.trim().startsWith("%") ? Math.min(1, value / 100) : null,
    format: (v: number) => (places ? v.toFixed(places).replace(".", decimal![2]) : String(Math.round(v))),
  };
};

const EMOJI_RE = /\p{Extended_Pictographic}/u;
export const hasEmoji = (text: string) => EMOJI_RE.test(text);
