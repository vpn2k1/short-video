/**
 * Sinh nhạc nền và tiếng động bằng ffmpeg — offline, miễn phí, không API key.
 *
 *   npx tsx scripts/make-audio.ts music calm 30
 *   npx tsx scripts/make-audio.ts sfx whoosh
 *
 * Đây là nhạc TỔNG HỢP: hợp âm giữ dài + tremolo, không phải nhạc thu. Đủ dùng
 * làm nền dưới lời nói, nhưng nghe kỹ vẫn ra chất máy — thay bằng track thật
 * khi làm bản đăng.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

export type Mood = "calm" | "upbeat" | "dramatic" | "warm" | "tense";
export type SfxKind = "whoosh" | "pop" | "ding" | "riser" | "thud";

/** Tần số các nốt (Hz) cho từng hợp âm, quãng thấp để không đè lời nói. */
const CHORDS: Record<Mood, { notes: number[]; tremolo: number; lowpass: number; lufs: number }> = {
  // Am9 — trầm, mở, hợp nội dung bình thản
  calm: { notes: [220, 261.63, 329.63, 493.88], tremolo: 0.25, lowpass: 2200, lufs: -18 },
  // Cmaj9 — sáng, nhịp rung nhanh hơn tạo cảm giác chuyển động
  upbeat: { notes: [261.63, 329.63, 392, 493.88], tremolo: 1.6, lowpass: 3200, lufs: -16 },
  // Dm — tối, trầm sâu, rung chậm
  dramatic: { notes: [146.83, 174.61, 220, 293.66], tremolo: 0.15, lowpass: 1400, lufs: -17 },
  // Fmaj7 — ấm, dày
  warm: { notes: [174.61, 220, 261.63, 329.63], tremolo: 0.35, lowpass: 2600, lufs: -18 },
  // quãng nghịch — tạo căng thẳng
  tense: { notes: [130.81, 185, 233.08, 277.18], tremolo: 0.6, lowpass: 1800, lufs: -17 },
};

const publicDir = () => path.resolve(process.cwd(), "public");

export const generateMusic = (mood: Mood, seconds: number, outFile: string) => {
  const spec = CHORDS[mood];
  const inputs: string[] = [];
  const filters: string[] = [];

  // Nốt trầm nhất to nhất, các nốt trên nhỏ dần — nếu để bằng nhau sẽ đục.
  spec.notes.forEach((hz, i) => {
    inputs.push("-f", "lavfi", "-i", `sine=frequency=${hz}:duration=${seconds}`);
    filters.push(`[${i}]volume=${(0.3 / (i + 1) + 0.06).toFixed(3)}[n${i}]`);
  });

  const mix = spec.notes.map((_, i) => `[n${i}]`).join("");
  const chain =
    `${filters.join(";")};${mix}amix=inputs=${spec.notes.length}:normalize=0,` +
    `tremolo=f=${spec.tremolo}:d=0.35,lowpass=f=${spec.lowpass},` +
    `afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, seconds - 2)}:d=2,` +
    `loudnorm=I=${spec.lufs}:TP=-2:LRA=11[out]`;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-v", "error", ...inputs,
    "-filter_complex", chain, "-map", "[out]",
    "-ac", "2", "-ar", "48000", outFile,
  ]);
  return outFile;
};

const SFX: Record<SfxKind, string[]> = {
  // Nhiễu hồng lọc dải + fade hai đầu — nghe như luồng gió chuyển cảnh
  whoosh: ["-f", "lavfi", "-i", "anoisesrc=d=0.4:c=pink:a=0.9:r=48000",
    "-af", "highpass=f=600,lowpass=f=6000,afade=t=in:st=0:d=0.12,afade=t=out:st=0.12:d=0.28,loudnorm=I=-16:TP=-2:LRA=11"],
  // Sine ngắn tắt nhanh — tiếng bấm nhẹ
  pop: ["-f", "lavfi", "-i", "sine=frequency=520:duration=0.18",
    "-af", "afade=t=out:st=0.02:d=0.16,loudnorm=I=-18:TP=-2:LRA=11"],
  // Hai sine quãng tám, ngân dài — tiếng báo hoàn thành
  ding: ["-f", "lavfi", "-i", "sine=frequency=880:duration=1.2",
    "-f", "lavfi", "-i", "sine=frequency=1760:duration=1.2",
    "-filter_complex", "[0]volume=0.7[a];[1]volume=0.3[b];[a][b]amix=inputs=2:normalize=0,afade=t=out:st=0.1:d=1.1,loudnorm=I=-17:TP=-2:LRA=11[out]",
    "-map", "[out]"],
  // Nhiễu quét lên — dựng cao trào trước điểm nhấn
  riser: ["-f", "lavfi", "-i", "anoisesrc=d=1.5:c=white:a=0.8:r=48000",
    "-af", "highpass=f=200,volume='min(1,t/1.5)':eval=frame,lowpass=f=8000,loudnorm=I=-17:TP=-2:LRA=11"],
  // Sine trầm tắt nhanh — tiếng đặt xuống
  thud: ["-f", "lavfi", "-i", "sine=frequency=70:duration=0.35",
    "-af", "afade=t=out:st=0.05:d=0.3,loudnorm=I=-16:TP=-2:LRA=11"],
};

export const generateSfx = (kind: SfxKind, outFile: string) => {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-v", "error", ...SFX[kind], "-ac", "2", "-ar", "48000", outFile]);
  return outFile;
};

export const MOODS = Object.keys(CHORDS) as Mood[];
export const SFX_KINDS = Object.keys(SFX) as SfxKind[];

if (process.argv[1]?.endsWith("make-audio.ts")) {
  const [kind, which, secs] = process.argv.slice(2);
  if (kind === "music" && MOODS.includes(which as Mood)) {
    const file = path.join(publicDir(), "music", `${which}.mp3`);
    generateMusic(which as Mood, Number(secs ?? 30), file);
    console.log("→", path.relative(process.cwd(), file));
  } else if (kind === "sfx" && SFX_KINDS.includes(which as SfxKind)) {
    const file = path.join(publicDir(), "sfx", `${which}.mp3`);
    generateSfx(which as SfxKind, file);
    console.log("→", path.relative(process.cwd(), file));
  } else {
    console.error(`music <${MOODS.join("|")}> [giây]  |  sfx <${SFX_KINDS.join("|")}>`);
    process.exit(1);
  }
}
