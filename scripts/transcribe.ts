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

/**
 * Phiên âm theo CÂU cho phụ đề tự động: whisper tự cắt đoạn ở ranh giới từ (--split-on-word), trần
 * --max-len rộng để câu thường không bị cắt đôi (trần tính theo byte — chữ Việt có dấu 2–3 byte).
 * Chữ đúng câu, không vỡ dấu; thời gian thì thô — khớp lại bằng alignCaptions (subtitle-align.ts).
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
  try {
    const output = await transcribe({
      model,
      whisperPath: to,
      whisperCppVersion: WHISPER_VERSION,
      inputPath: wav,
      tokenLevelTimestamps: false,
      language,
      printOutput: false,
      // Truyền thẳng cờ: tuỳ chọn splitOnWord của thư viện gắn thêm chữ "true" sau cờ.
      additionalArgs: ["--max-len", "160", "--split-on-word"],
    });
    return toCaptions({
      whisperCppOutput: output as unknown as Parameters<typeof toCaptions>[0]["whisperCppOutput"],
    }).captions
      .map((c) => ({ text: c.text.trim(), startMs: c.startMs, endMs: c.endMs }))
      .filter((c) => c.text);
  } finally {
    fs.rmSync(wav, { force: true });
  }
};
