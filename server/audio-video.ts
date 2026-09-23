/**
 * Dựng video từ file thu sẵn (âm thanh hoặc video): phiên âm có nhớ, chuẩn hoá đường tiếng, và chia lời thành nhiều
 * cảnh. Dùng chung cho ô tạo video (đính kèm file âm thanh — server/chat.ts › buildFromAudio) và loạt "File thu sẵn"
 * (server/batch.ts › prepareMedia).
 *
 * Chia cảnh là chỗ quyết định phong cách có "hiện ra" hay không: cả video một cảnh thì truyện tranh chỉ có một khung,
 * bản đồ một điểm dừng, dòng thời gian một mốc — trông như Video gốc. Nhiều cảnh thì phong cách có nhịp chuyển cảnh,
 * và file âm thanh có chỗ gắn hình cho từng đoạn lời.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { WhisperModel } from "@remotion/install-whisper-cpp";
import { slugify } from "../scripts/slug";
import { alignCaptions, detectSilences } from "../scripts/subtitle-align";
import { transcribeSentences } from "../scripts/transcribe";
import type { Caption } from "../src/compositions/Short/schema";

export const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg)$/i;
export const isAudioFile = (file: string) => AUDIO_RE.test(file);
export const isVideoFile = (file: string) => /\.(mp4|mov|webm)$/i.test(file);

export const audioDurationMs = (file: string) =>
  Math.round(
    parseFloat(
      execFileSync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", file,
      ], { encoding: "utf8" }).trim(),
    ) * 1000,
  );

/**
 * Phiên âm có nhớ: loạt phụ đề nhiều ngôn ngữ dùng chung một bản phiên âm cho mọi ngôn ngữ của
 * cùng một file — phiên âm là bước nặng nhất, không làm lại cho từng bản dịch.
 * Nhớ trên đĩa (data/batches/transcripts) để khởi động lại server hay bấm Chạy lại cũng không mất.
 */
const transcriptMemory = new Map<string, Caption[]>();

export const transcribeCached = async (
  source: string,
  file: string,
  spoken: string,
  model: WhisperModel,
  log: (line: string) => void,
): Promise<Caption[]> => {
  const stat = fs.statSync(source);
  // "dtw": bản phiên âm có mốc từng từ — bản cũ khớp phụ đề sai với video có nhạc nền, không dùng lại.
  // Tên file để cuối: tên dài bị cắt ở 120 ký tự thì chỉ mất đuôi tên, không mất ngôn ngữ/model.
  const key = slugify(`dtw ${stat.size} ${stat.mtimeMs} ${spoken} ${model} ${file}`, 120);
  const cacheFile = path.join(process.cwd(), "data", "batches", "transcripts", `${key}.json`);
  const hit = transcriptMemory.get(key) ?? (fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : null);
  if (hit) {
    log(`Dùng lại bản phiên âm của ${path.basename(source)}.`);
    return hit;
  }
  log(`Phiên âm ${path.basename(source)} bằng whisper ${model} (chạy trên máy)…`);
  const sentences = await transcribeSentences({ audioPath: source, model, language: spoken as never });
  const silences = await detectSilences(source);
  const captions = alignCaptions(sentences, silences, audioDurationMs(source)) as Caption[];
  log(`${sentences.length} câu → ${captions.length} dòng phụ đề`);
  transcriptMemory.set(key, captions);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(captions));
  return captions;
};

/** Chuẩn hoá tiếng của file về mp3 48kHz stereo (khớp phần còn lại của soundtrack). Trả đường dẫn trong public/. */
export const extractTrack = (source: string, slug: string) => {
  const trackRel = path.posix.join("voices", slug, "track.mp3");
  const trackAbs = path.join(process.cwd(), "public", trackRel);
  fs.mkdirSync(path.dirname(trackAbs), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", source, "-ar", "48000", "-ac", "2", trackAbs]);
  return { trackRel, durationMs: audioDurationMs(trackAbs) };
};

export type CaptionScene = { startMs: number; endMs: number; lines: string[] };

/** Trần số cảnh — trùng MAX_SCRIPT_SCENES; file rất dài thì mỗi cảnh dài ra thay vì vượt trần. */
const MAX_SCENES = 200;

/**
 * Gom phụ đề (hàng chính) thành cảnh: mỗi cảnh ít nhất ~5 giây, cắt ở chỗ ngừng nói hoặc sau 4 câu, không quá ~12
 * giây. Cảnh đầu bắt đầu từ 0, cảnh sau bắt đầu đúng câu đầu của nó, cảnh cuối kéo tới hết file — không hở khoảng nào.
 */
export const captionScenes = (captions: Caption[], durationMs: number): CaptionScene[] => {
  const rows = captions.filter((caption) => !caption.track).sort((a, b) => a.startMs - b.startMs);
  if (rows.length === 0) return [{ startMs: 0, endMs: durationMs, lines: [] }];
  const minMs = Math.max(5000, durationMs / MAX_SCENES);
  const maxMs = Math.max(12_000, minMs * 2);
  const PAUSE_MS = 700;

  const groups: Caption[][] = [[rows[0]]];
  for (let k = 1; k < rows.length; k++) {
    const group = groups[groups.length - 1];
    const elapsed = rows[k].startMs - group[0].startMs;
    const pause = rows[k].startMs - rows[k - 1].endMs;
    const cut = elapsed >= maxMs || (elapsed >= minMs && (pause >= PAUSE_MS || group.length >= 4));
    if (cut) groups.push([rows[k]]);
    else group.push(rows[k]);
  }
  return groups.map((group, k) => ({
    startMs: k === 0 ? 0 : group[0].startMs,
    endMs: k === groups.length - 1 ? Math.max(durationMs, group[group.length - 1].endMs) : groups[k + 1][0].startMs,
    lines: group.map((caption) => caption.text),
  }));
};
