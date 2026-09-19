/**
 * Phiên âm một file audio thành caption có timestamp, bằng whisper.cpp chạy local.
 * Tải whisper.cpp + model một lần, sau đó chạy hoàn toàn offline, không cần API key.
 *
 *   npx tsx scripts/transcribe.ts <file-audio> --name <slug> [--model small|medium|large-v3-turbo]
 */
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
  type Language,
  type WhisperModel,
} from "@remotion/install-whisper-cpp";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Mark, Segment } from "./subtitle-align";

const WHISPER_VERSION = "1.5.5";
const whisperDir = () => path.resolve(process.cwd(), "whisper.cpp");

/** whisper.cpp chỉ nhận wav 16kHz mono. */
export const toWhisperWav = (input: string, output: string) => {
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", input,
    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
    output,
  ]);
};

export const transcribeFile = async ({
  audioPath,
  model,
  language,
}: {
  audioPath: string;
  model: WhisperModel;
  language: Language;
}) => {
  const to = whisperDir();

  process.stdout.write("  cài whisper.cpp…\n");
  await installWhisperCpp({ to, version: WHISPER_VERSION });

  process.stdout.write(`  tải model ${model}…\n`);
  await downloadWhisperModel({ model, folder: to });

  const wav = path.join(
    path.dirname(audioPath),
    `${path.basename(audioPath, path.extname(audioPath))}.16k.wav`,
  );
  toWhisperWav(audioPath, wav);

  process.stdout.write("  phiên âm…\n");
  const output = await transcribe({
    model,
    whisperPath: to,
    whisperCppVersion: WHISPER_VERSION,
    inputPath: wav,
    // false: token-level không cho timing tốt hơn ở đây mà còn làm vỡ UTF-8 thêm.
    tokenLevelTimestamps: false,
    language,
  });

  fs.unlinkSync(wav);
  // toCaptions khai báo kiểu cho output token-level, nhưng chạy được với cả
  // output theo câu — ở đây ta cố tình dùng tokenLevelTimestamps: false vì
  // token-level làm vỡ UTF-8 tiếng Việt mà không cho timing tốt hơn.
  return toCaptions({
    whisperCppOutput: output as unknown as Parameters<
      typeof toCaptions
    >[0]["whisperCppOutput"],
  }).captions;
};

/** Bộ đầu chú ý cho DTW mà whisper.cpp 1.5.5 có sẵn — large-v3-turbo ra đời sau nên chạy không DTW. */
const DTW_PRESETS: Partial<Record<WhisperModel, string>> = {
  tiny: "tiny", "tiny.en": "tiny.en", base: "base", "base.en": "base.en",
  small: "small", "small.en": "small.en", medium: "medium", "medium.en": "medium.en",
  "large-v1": "large.v1", "large-v2": "large.v2", "large-v3": "large.v3",
};

/** Token đặc biệt của whisper ("[_BEG_]", "[_TT_140]") — không phải chữ. */
const SPECIAL_TOKEN = /^\[_[A-Z]+(_\d+)?\]$/;

type WhisperToken = { text: string; t_dtw: number };

/**
 * Mốc DTW của một đoạn: đầu mỗi từ trong `text` ứng với giây nào. Token của whisper cắt giữa chữ
 * có dấu (vỡ thành U+FFFD) nhưng dấu cách đứng đầu token thì luôn nguyên — nên token mở đầu bằng
 * dấu cách là đầu một từ, đếm khớp với số từ trong câu. Không khớp (tiếng Nhật/Trung không có dấu
 * cách) thì quy vị trí token ra vị trí chữ theo tỉ lệ độ dài.
 */
export const dtwMarks = (text: string, tokens: WhisperToken[]): Mark[] => {
  const timed = tokens.filter((t) => !SPECIAL_TOKEN.test(t.text) && t.t_dtw >= 0);
  if (timed.length === 0 || !text) return [];
  const wordStarts = [...text.matchAll(/\S+/g)].map((m) => m.index!);
  const firstOfWord = timed.filter((t, i) => i === 0 || /^\s/.test(t.text));
  if (wordStarts.length > 1 && firstOfWord.length === wordStarts.length) {
    return wordStarts.map((at, i) => ({ at, ms: firstOfWord[i].t_dtw * 10 }));
  }
  const joined = timed.map((t) => t.text).join("");
  const lead = joined.length - joined.trimStart().length;
  const scale = text.length / Math.max(1, joined.trim().length);
  const marks: Mark[] = [];
  let cursor = 0;
  for (const token of timed) {
    const start = cursor + token.text.length - token.text.trimStart().length;
    cursor += token.text.length;
    if (!token.text.trim()) continue;
    marks.push({ at: Math.min(text.length, Math.max(0, Math.round((start - lead) * scale))), ms: token.t_dtw * 10 });
  }
  return marks;
};

/**
 * Phiên âm theo CÂU cho phụ đề tự động: whisper tự cắt đoạn ở ranh giới từ (--split-on-word), trần
 * --max-len rộng để câu thường không bị cắt đôi (trần tính theo byte — chữ Việt có dấu 2–3 byte).
 * Chữ đúng câu, không vỡ dấu. Mốc đầu/cuối đoạn của whisper thì thô — gặp nhạc nền hay tiếng ồn,
 * một câu 3 từ có thể bị tính từ lúc câu trước dứt tới 10 giây sau — nên xin thêm mốc DTW (--dtw):
 * lúc bắt đầu từng từ, lấy từ chính sự chú ý của model lên âm thanh. Khớp lại bằng alignCaptions.
 * Đã đo: whisper 1.5.5 medium, clip tiếng Việt 21,6s → 5 đoạn trong 7,4s, không có ký tự U+FFFD.
 */
export const transcribeSentences = async ({
  audioPath,
  model,
  language,
}: {
  audioPath: string;
  model: WhisperModel;
  language: Language;
}) => {
  const to = whisperDir();
  await installWhisperCpp({ to, version: WHISPER_VERSION });
  await downloadWhisperModel({ model, folder: to });

  const wav = path.join(
    path.dirname(audioPath),
    `${path.basename(audioPath, path.extname(audioPath))}.16k.wav`,
  );
  toWhisperWav(audioPath, wav);
  const dtw = DTW_PRESETS[model];
  try {
    const output = await transcribe({
      model,
      whisperPath: to,
      whisperCppVersion: WHISPER_VERSION,
      inputPath: wav,
      // false: bật cờ này thư viện ép --max-len 1 (mỗi đoạn một token) — tự truyền --dtw bên dưới.
      tokenLevelTimestamps: false,
      language,
      printOutput: false,
      // Truyền thẳng cờ: tuỳ chọn splitOnWord của thư viện gắn thêm chữ "true" sau cờ.
      additionalArgs: ["--max-len", "160", "--split-on-word", ...(dtw ? ["--dtw", dtw] : [])],
    });
    const items = output.transcription as unknown as { text: string; offsets: { from: number; to: number }; tokens?: WhisperToken[] }[];
    return items
      .map((item): Segment => {
        const text = item.text.replace(/\s+/g, " ").trim();
        const marks = dtw ? dtwMarks(text, item.tokens ?? []) : [];
        return { text, startMs: item.offsets.from, endMs: item.offsets.to, ...(marks.length ? { marks } : {}) };
      })
      .filter((c) => c.text);
  } finally {
    fs.rmSync(wav, { force: true });
  }
};
