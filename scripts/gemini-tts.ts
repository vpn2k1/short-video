/**
 * Giọng đọc Gemini TTS — đọc CẢ KỊCH BẢN trong một lượt gọi, rồi tự tách thành từng câu.
 *
 * Vì sao không đọc từng câu: gói miễn phí giới hạn số lượt gọi mỗi phút/ngày, video 20 câu là 20 lượt —
 * hết hạn mức rất nhanh. Đọc một lượt còn cho giọng liền mạch, cùng một nhịp và cảm xúc.
 *
 * Tách câu: dặn model ngừng hẳn giữa các dòng, tìm các khoảng lặng trong audio, rồi chọn đúng (số câu − 1)
 * điểm cắt bằng quy hoạch động — ưu tiên khoảng lặng dài và nằm gần vị trí ước lượng theo số ký tự
 * (dấu phẩy cũng tạo khoảng lặng ngắn, nên không lấy bừa N−1 khoảng dài nhất).
 * Kịch bản dài chia thành vài lượt theo ranh giới câu (CHUNK_CHARS) để không vượt giới hạn một lượt.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import { classifyProviderError, providerError, ProviderError } from "./provider-error";
import { recordCall } from "./usage";

export const GEMINI_TTS_MODELS = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"] as const;
export const DEFAULT_GEMINI_TTS_MODEL = GEMINI_TTS_MODELS[0];

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const SAMPLE_RATE = 24_000;
const FRAME_MS = 10;
/** ~2.500 ký tự ≈ 3 phút đọc — một lượt đủ dài mà vẫn xa giới hạn ngữ cảnh 32k token. */
const CHUNK_CHARS = 2_500;
/** Khoảng lặng ngắn hơn chừng này là hơi thở/dấu phẩy, không xét làm điểm cắt. */
const MIN_GAP_MS = 120;
/** Mỗi clip giữ lại chút lặng hai đầu cho khỏi cụt; khoảng nghỉ giữa câu do timeline tự thêm (GAP_MS). */
const LEAD_PAD_MS = 40;
const TAIL_PAD_MS = 140;
/** Đợi hạn mức theo phút tự hồi lại nếu Gemini bảo đợi không quá chừng này. */
const MAX_AUTO_WAIT_S = 65;

type Log = (line: string) => void;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (body: string) => {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; details?: unknown } };
    // Gemini để retryDelay trong details — giữ lại để báo đúng số giây phải đợi.
    return `${parsed.error?.message ?? body}${parsed.error?.details ? ` ${JSON.stringify(parsed.error.details)}` : ""}`;
  } catch {
    return body;
  }
};

const waitSeconds = (message: string) => {
  const match = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"|retry in\s+([\d.]+)s/i.exec(message);
  const seconds = match ? Number(match[1] ?? match[2]) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
};

/** Lời có chữ tiếng Việt — hướng dẫn đọc viết cùng thứ tiếng với lời để giọng không ngả sang giọng Việt khi đọc tiếng Anh. */
const VIETNAMESE = /[ăâđêôơưàáạảãầấậẩẫằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/iu;

/** Hướng dẫn cách đọc + lời thoại. Model TTS không đọc phần hướng dẫn, chỉ đọc phần sau "LỜI ĐỌC". */
const buildPrompt = (lines: string[], style: string) =>
  VIETNAMESE.test(lines.join(" "))
    ? [
      "HƯỚNG DẪN (không đọc phần này):",
      style.trim() || "Giọng tự nhiên, rõ ràng, nhịp vừa phải, như người dẫn video ngắn trên mạng xã hội.",
      "Đọc nguyên văn phần lời bên dưới, không thêm, bỏ hay đổi chữ nào.",
      "Mỗi dòng là một câu: đọc hết dòng rồi NGỪNG HẲN khoảng một giây mới đọc dòng tiếp theo.",
      "",
      "LỜI ĐỌC:",
      ...lines,
    ].join("\n")
    : [
      "INSTRUCTIONS (do not read this part):",
      style.trim() || "Natural, clear voice at a moderate pace, like the host of a short social-media video.",
      "Read the script below word for word — do not add, drop or change any word.",
      "Each line is one sentence: finish the line, then PAUSE for about one second before the next line.",
      "",
      "SCRIPT:",
      ...lines,
    ].join("\n");

/** Một lượt gọi → PCM 16-bit mono 24 kHz. Tự thử lại khi quá tải / hết hạn mức phút (đợi ngắn). */
const synthesize = async (lines: string[], voice: string, log: Log) => {
  const custom = process.env.GEMINI_TTS_MODEL;
  const models = custom ? [custom] : [...GEMINI_TTS_MODELS];
  const style = process.env.GEMINI_TTS_STYLE ?? "";
  let lastError: Error = new Error("Gemini TTS: chưa có model nào để gọi.");

  for (const model of models) {
    const label = `Gemini TTS (${model})`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY as string, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(lines, style) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });

      recordCall("Gemini TTS", response.ok, response.ok ? lines.join(" ").length : 0);
      if (!response.ok) {
        const message = errorText(await response.text());
        lastError = providerError(label, response.status, message, "hoặc chọn giọng miễn phí có sẵn trong app");
        const kind = classifyProviderError(response.status, message);
        // Model không có / không được dùng với key này → thử model kế tiếp.
        if (response.status === 404 || (response.status === 400 && /not found|not supported/i.test(message))) break;
        const wait = waitSeconds(message);
        if (kind === "rate_limit" && wait !== null && wait <= MAX_AUTO_WAIT_S && attempt < 3) {
          log(`     Gemini TTS hết hạn mức theo phút — tự đợi ${wait} giây rồi đọc tiếp…`);
          await sleep(wait * 1000 + 500);
          continue;
        }
        if (kind === "overloaded" && attempt < 3) {
          await sleep(3000 * attempt);
          continue;
        }
        // Hạn mức miễn phí tính riêng từng model — model này hết lượt thì thử model kế tiếp.
        if (kind === "daily_quota" || kind === "rate_limit") {
          if (model !== models[models.length - 1]) log(`     ${model} hết lượt — thử ${models[models.indexOf(model) + 1]}…`);
          break;
        }
        throw lastError;
      }

      const body = (await response.json()) as {
        candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { data?: string } }[] } }[];
        promptFeedback?: { blockReason?: string };
      };
      const data = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (data) return Buffer.from(data, "base64");
      // Preview đôi khi trả về rỗng (finishReason OTHER) — thử lại là được.
      lastError = new ProviderError(
        `${label} không trả về audio (${body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason ?? "không rõ lý do"}).`,
        "overloaded",
      );
      if (attempt < 3) await sleep(1500);
    }
  }
  throw lastError;
};

// ---------- tách câu ----------

/** Âm lượng từng khung 10 ms (dBFS). */
const frameLevels = (pcm: Buffer) => {
  const samplesPerFrame = (SAMPLE_RATE * FRAME_MS) / 1000;
  const frames = Math.floor(pcm.length / 2 / samplesPerFrame);
  const levels = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let s = 0; s < samplesPerFrame; s++) {
      const v = pcm.readInt16LE((f * samplesPerFrame + s) * 2) / 32768;
      sum += v * v;
    }
    levels[f] = 10 * Math.log10(sum / samplesPerFrame + 1e-10);
  }
  return levels;
};

/** Ngưỡng lặng theo chính file: nền ồn (bách phân vị 10) + 12 dB, kẹp trong [-55, -30]. */
const silenceThreshold = (levels: Float64Array) => {
  const sorted = [...levels].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? -60;
  return Math.min(-30, Math.max(-55, floor + 12));
};

type Gap = { startMs: number; endMs: number };

const findGaps = (levels: Float64Array, threshold: number): Gap[] => {
  const gaps: Gap[] = [];
  let start = -1;
  for (let f = 0; f <= levels.length; f++) {
    const quiet = f < levels.length && levels[f] < threshold;
    if (quiet && start < 0) start = f;
    if (!quiet && start >= 0) {
      if ((f - start) * FRAME_MS >= MIN_GAP_MS) gaps.push({ startMs: start * FRAME_MS, endMs: f * FRAME_MS });
      start = -1;
    }
  }
  return gaps;
};

/**
 * Chọn (texts.length − 1) điểm cắt tăng dần. Điểm = độ dài khoảng lặng − độ lệch so với vị trí ước lượng
 * theo tỉ lệ ký tự. Không đủ khoảng lặng thì cắt thẳng tại vị trí ước lượng (báo trong log).
 */
const chooseCuts = (gaps: Gap[], texts: string[], speechStartMs: number, speechEndMs: number, log: Log) => {
  const cutsNeeded = texts.length - 1;
  if (cutsNeeded === 0) return [];
  const total = texts.reduce((sum, t) => sum + t.length, 0) || 1;
  const span = speechEndMs - speechStartMs;
  let acc = 0;
  const expected = texts.slice(0, -1).map((t) => {
    acc += t.length;
    return speechStartMs + (span * acc) / total;
  });
  // Bỏ khoảng lặng dính đầu/cuối — đó là lặng trước và sau cả đoạn, không phải giữa hai câu.
  const inner = gaps.filter((g) => g.startMs > speechStartMs && g.endMs < speechEndMs);

  if (inner.length < cutsNeeded) {
    log(`     ⚠ Chỉ thấy ${inner.length}/${cutsNeeded} chỗ ngừng giữa các câu — tách theo ước lượng, nên soát lại phụ đề.`);
    return expected;
  }

  // dp[i][j]: điểm tốt nhất khi điểm cắt thứ j dùng khoảng lặng i.
  const n = inner.length;
  const score = (i: number, j: number) => {
    const g = inner[i];
    const mid = (g.startMs + g.endMs) / 2;
    return (g.endMs - g.startMs) - 0.35 * Math.abs(mid - expected[j]);
  };
  const dp = Array.from({ length: n }, () => new Float64Array(cutsNeeded).fill(-Infinity));
  const from = Array.from({ length: n }, () => new Int32Array(cutsNeeded).fill(-1));
  for (let i = 0; i < n; i++) dp[i][0] = score(i, 0);
  for (let j = 1; j < cutsNeeded; j++) {
    let best = -Infinity;
    let bestIndex = -1;
    for (let i = j; i < n; i++) {
      if (dp[i - 1][j - 1] > best) {
        best = dp[i - 1][j - 1];
        bestIndex = i - 1;
      }
      if (bestIndex >= 0) {
        dp[i][j] = best + score(i, j);
        from[i][j] = bestIndex;
      }
    }
  }
  let last = -1;
  for (let i = cutsNeeded - 1; i < n; i++) {
    if (last < 0 || dp[i][cutsNeeded - 1] > dp[last][cutsNeeded - 1]) last = i;
  }
  const picked: number[] = [];
  for (let j = cutsNeeded - 1, i = last; j >= 0; i = from[i][j], j--) picked.unshift(i);
  return picked.map((i) => (inner[i].startMs + inner[i].endMs) / 2);
};

/** Cắt [startMs, endMs] của PCM, gọt lặng hai đầu (giữ một chút đệm). */
const slice = (pcm: Buffer, levels: Float64Array, threshold: number, startMs: number, endMs: number) => {
  let first = Math.floor(startMs / FRAME_MS);
  let last = Math.min(levels.length, Math.ceil(endMs / FRAME_MS)) - 1;
  while (first < last && levels[first] < threshold) first++;
  while (last > first && levels[last] < threshold) last--;
  const from = Math.max(startMs, first * FRAME_MS - LEAD_PAD_MS);
  const to = Math.min(endMs, (last + 1) * FRAME_MS + TAIL_PAD_MS);
  const byte = (ms: number) => Math.floor((ms * SAMPLE_RATE) / 1000) * 2;
  return pcm.subarray(byte(from), byte(to));
};

const writeWav = (pcm: Buffer, out: string) => {
  const raw = `${out}.pcm`;
  fs.writeFileSync(raw, pcm);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", raw, out]);
  fs.unlinkSync(raw);
};

/** Gom câu thành từng lượt gọi, mỗi lượt không quá CHUNK_CHARS ký tự. */
const chunk = <T extends { text: string }>(items: T[]) => {
  const groups: T[][] = [];
  let current: T[] = [];
  let chars = 0;
  for (const item of items) {
    if (current.length > 0 && chars + item.text.length > CHUNK_CHARS) {
      groups.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += item.text.length + 1;
  }
  if (current.length > 0) groups.push(current);
  return groups;
};

/** Đọc mọi câu, ghi mỗi câu một file WAV ở `out`. */
export const geminiTtsToWavs = async (
  items: { text: string; out: string }[],
  voice: string,
  log: Log = (line) => process.stdout.write(`${line}\n`),
) => {
  const groups = chunk(items.map((item) => ({ ...item, text: item.text.replace(/\s+/g, " ").trim() })));
  for (const [k, group] of groups.entries()) {
    log(`     Gemini TTS đọc ${group.length} câu${groups.length > 1 ? ` (lượt ${k + 1}/${groups.length})` : " trong một lượt"}…`);
    const pcm = await synthesize(group.map((g) => g.text), voice, log);
    const levels = frameLevels(pcm);
    const threshold = silenceThreshold(levels);
    const gaps = findGaps(levels, threshold);
    const totalMs = levels.length * FRAME_MS;
    const speechStartMs = gaps[0]?.startMs === 0 ? gaps[0].endMs : 0;
    const tail = gaps[gaps.length - 1];
    const speechEndMs = tail && tail.endMs >= totalMs ? tail.startMs : totalMs;
    if (speechEndMs - speechStartMs < 200) {
      throw new Error("Gemini TTS trả về audio im lặng — thử lại, hoặc chọn giọng khác.");
    }
    const cuts = chooseCuts(gaps, group.map((g) => g.text), speechStartMs, speechEndMs, log);
    const bounds = [0, ...cuts, totalMs];
    group.forEach((item, i) => writeWav(slice(pcm, levels, threshold, bounds[i], bounds[i + 1]), item.out));
  }
};
