/**
 * Độ dài video khi AI viết kịch bản.
 *
 * Thứ tự ưu tiên: ô chọn độ dài trong giao diện → độ dài nêu trong câu prompt → mặc định
 * video ngắn 15–30 giây. Xem skill `long-video`.
 */

/** Giá trị ô chọn: "auto" = đọc từ prompt, "free" = không giới hạn, còn lại là số giây. */
export const LENGTH_CHOICES = ["auto", "15", "30", "60", "180", "300", "600", "free"] as const;
export type LengthChoice = (typeof LENGTH_CHOICES)[number];

export const isLengthChoice = (value: unknown): value is LengthChoice =>
  typeof value === "string" && (LENGTH_CHOICES as readonly string[]).includes(value);

export type LengthTarget = {
  /** Số giây nhắm tới; null = không nhắm số nào (mặc định ngắn, hoặc không giới hạn). */
  seconds: number | null;
  /** Không giới hạn: viết đủ ý rồi dừng. */
  free: boolean;
  source: "ui" | "prompt" | "default";
};

/** Nhịp đo từ các video đã dựng: ~3 giây một câu, đã tính khoảng nghỉ. */
export const SECONDS_PER_LINE = 3;
/** Title card (~2,3s) + outro (1s) — không có lời đọc. */
const SILENT_SECONDS = 3;
/**
 * Một lần gọi AI viết tối đa chừng này câu. Model nhỏ/gói miễn phí viết 100 câu JSON một lượt là
 * hỏng (Groq trả 400, Ollama bị cắt) — video dài hơn thì viết theo chương.
 */
export const CHAPTER_LINES = 20;
/** Quá số câu này thì chia chương thay vì viết một lượt. */
const SINGLE_CALL_MAX_LINES = 30;
const MIN_SECONDS = 5;
const MAX_SECONDS = 60 * 60;

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const MINUTE = String.raw`(?:phút|phut|p|min|mins|minute|minutes)`;
const SECOND = String.raw`(?:giây|giay|s|sec|secs|second|seconds)`;
/** Chữ đứng trước con số cho biết đó là độ dài video, không phải "tập 3 phút mỗi ngày". */
const CONTEXT = /(video|clip|dài|thời lượng|độ dài|khoảng|tầm|chừng|trong|tối đa|tối thiểu|ít nhất|length|long)\s*[:\-–]?\s*$/i;
const FREE = /(không giới hạn|ko giới hạn|k giới hạn|dài bao nhiêu cũng được|càng dài càng (tốt|được)|không cần ngắn|unlimited|no limit)/i;

const toNumber = (text: string) => Number(text.replace(",", "."));

/** Đọc độ dài trong câu prompt: "5 phút", "5p", "90 giây", "1 phút 30", "nửa phút", "không giới hạn". */
export const lengthFromPrompt = (prompt: string): { seconds: number | null; free: boolean } | null => {
  const text = prompt.toLocaleLowerCase("vi");
  if (FREE.test(text)) return { seconds: null, free: true };

  const pattern = new RegExp(
    String.raw`${NUMBER}\s*${MINUTE}(?:\s*${NUMBER}\s*(?:${SECOND})?)?(?![\p{L}])|${NUMBER}\s*${SECOND}(?![\p{L}])|nửa\s*phút`,
    "giu",
  );
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 24), match.index);
    if (!CONTEXT.test(before)) continue;
    const seconds = match[0].startsWith("nửa")
      ? 30
      : match[1]
        ? toNumber(match[1]) * 60 + (match[2] ? toNumber(match[2]) : 0)
        : toNumber(match[3]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return { seconds: Math.round(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds))), free: false };
    }
  }
  return null;
};

/** Ô chọn thắng; "Tự động" thì đọc prompt; không có gì thì mặc định. */
export const resolveLength = (choice: LengthChoice | undefined, prompt: string): LengthTarget => {
  if (choice && choice !== "auto") {
    return choice === "free"
      ? { seconds: null, free: true, source: "ui" }
      : { seconds: Number(choice), free: false, source: "ui" };
  }
  const fromPrompt = lengthFromPrompt(prompt);
  if (fromPrompt) return { ...fromPrompt, source: "prompt" };
  return { seconds: null, free: false, source: "default" };
};

export type LengthPlan = {
  lines: number;
  scenes: number;
  linesPerScene: number;
  /** 1 = viết một lượt. */
  chapters: number;
};

/** Quy số giây ra số câu, số cảnh, số chương. */
export const planFor = (seconds: number): LengthPlan => {
  const lines = Math.max(3, Math.round((seconds - SILENT_SECONDS) / SECONDS_PER_LINE));
  // Video ngắn đổi hình nhanh; video dài mỗi hình giữ ~12s (4 câu) — quá 15s là đơn điệu.
  const linesPerScene = seconds <= 45 ? 2 : seconds <= 90 ? 3 : 4;
  const scenes = Math.max(1, Math.ceil(lines / linesPerScene));
  const chapters = lines > SINGLE_CALL_MAX_LINES ? Math.ceil(lines / CHAPTER_LINES) : 1;
  return { lines, scenes, linesPerScene, chapters };
};

/** Video này có cần viết theo chương không. */
export const needsChapters = (target: LengthTarget) =>
  target.free || (target.seconds !== null && planFor(target.seconds).chapters > 1);

const describe = (seconds: number) =>
  seconds < 60
    ? `${seconds} giây`
    : seconds % 60 === 0
      ? `${seconds / 60} phút`
      : `${Math.floor(seconds / 60)} phút ${seconds % 60} giây`;

export const lengthLabel = (target: LengthTarget) =>
  target.free ? "không giới hạn" : target.seconds ? describe(target.seconds) : "ngắn 15–30 giây";

export const OVERRIDE_NOTE =
  "Số cảnh/số câu ghi trong hướng dẫn phong cách bên dưới là cho video ngắn 15–30 giây. Mục ĐỘ DÀI này " +
  "THẮNG các con số đó: giữ giọng văn, độ dài từng câu và cách dùng tag/punch/visual của phong cách, " +
  "chỉ tăng hoặc giảm SỐ LƯỢNG cảnh và câu.";

/** Đoạn system prompt về độ dài. */
export const lengthSection = (target: LengthTarget) => {
  if (target.free) {
    return (
      "\n\nĐỘ DÀI VIDEO: KHÔNG GIỚI HẠN. Đây không phải video ngắn — viết đủ sâu để trình bày trọn chủ đề, " +
      "đừng cắt ý cho vừa 30 giây; nhưng cũng không kéo dài lê thê hay lặp ý. Mỗi cảnh 3–4 câu.\n" +
      OVERRIDE_NOTE
    );
  }
  if (target.seconds === null) {
    return (
      "\n\nĐỘ DÀI VIDEO: người dùng không nêu → video ngắn 15–30 giây: 2–4 cảnh, mỗi cảnh 2–3 câu, " +
      "tổng 5–8 câu."
    );
  }
  const plan = planFor(target.seconds);
  return (
    `\n\nĐỘ DÀI VIDEO: khoảng ${describe(target.seconds)}${target.seconds > 60 ? " — đây là video DÀI, không phải short" : ""}. ` +
    `Mỗi câu đọc mất ~${SECONDS_PER_LINE} giây, nên viết khoảng ${plan.lines} câu, chia thành khoảng ` +
    `${plan.scenes} cảnh, mỗi cảnh ${plan.linesPerScene} câu. Đây là yêu cầu cứng — thiếu câu là video hụt độ dài.\n` +
    OVERRIDE_NOTE
  );
};
