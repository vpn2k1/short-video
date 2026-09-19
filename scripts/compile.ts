/**
 * Gộp nhiều video ngắn thành MỘT video dài (vd. loạt 5 tập → một video tổng hợp cho YouTube), ghép bằng ffmpeg:
 * mỗi phần mở bằng một thẻ chương (ảnh tĩnh, im lặng), video khác khung được đặt giữa trên nền là chính nó phóng to
 * làm mờ — không viền đen. Trả kèm mốc chương "00:00 Phần 1: …" để dán vào mô tả YouTube.
 *
 *   await compileVideos([{ card: "a.jpg", video: "b.mp4", title: "Phần 1: …" }, …], "out/x.mp4", 1920, 1080)
 */
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const run = promisify(execFile);

/** Thẻ chương hiện bao lâu. */
export const CARD_SECONDS = 2.5;

export type CompilePart = { card: string | null; video: string; title: string };

const probe = async (file: string) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", file,
  ]);
  const info = JSON.parse(stdout) as { streams?: { codec_type?: string; width?: number; height?: number }[]; format?: { duration?: string } };
  const v = info.streams?.find((s) => s.codec_type === "video");
  return {
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    audio: Boolean(info.streams?.some((s) => s.codec_type === "audio")),
    seconds: Number(info.format?.duration) || 0,
  };
};

/** "83.4" → "1:23"; quá một giờ thì "1:02:03" — đúng dạng YouTube nhận làm chương. */
export const chapterClock = (seconds: number) => {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

export const compileVideos = async (parts: CompilePart[], output: string, W: number, H: number) => {
  const args = ["-v", "error", "-y"];
  const filters: string[] = [];
  const labels: string[] = [];
  const chapters: string[] = [];
  let input = 0;
  let clock = 0;
  const addSegment = (vFilter: string, aFilter: string) => {
    filters.push(vFilter, aFilter);
    labels.push(`[v${labels.length}][a${labels.length}]`);
  };
  for (const part of parts) {
    chapters.push(`${chapterClock(clock)} ${part.title}`);
    if (part.card) {
      const i = input++;
      const k = labels.length;
      args.push("-loop", "1", "-t", String(CARD_SECONDS), "-i", part.card);
      addSegment(
        `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${k}]`,
        `anullsrc=r=48000:cl=stereo,atrim=duration=${CARD_SECONDS}[a${k}]`,
      );
      clock += CARD_SECONDS;
    }
    const info = await probe(part.video);
    const i = input++;
    const k = labels.length;
    args.push("-i", part.video);
    const same = info.width && Math.abs(info.width / info.height - W / H) < 0.02;
    addSegment(
      same
        ? `[${i}:v]scale=${W}:${H},setsar=1,fps=30,format=yuv420p[v${k}]`
        // Khác khung: nền là chính video phóng kín rồi làm mờ, video thật đặt giữa.
        : `[${i}:v]split[bg${k}][fg${k}];[bg${k}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:4,eq=brightness=-0.08[bgb${k}];` +
          `[fg${k}]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgs${k}];[bgb${k}][fgs${k}]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30,format=yuv420p[v${k}]`,
      info.audio
        ? `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${info.seconds}[a${k}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${info.seconds}[a${k}]`,
    );
    clock += info.seconds;
  }
  filters.push(`${labels.join("")}concat=n=${labels.length}:v=1:a=1[v][a]`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await run("ffmpeg", [
    ...args,
    "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    output,
  ], { maxBuffer: 32 * 1024 * 1024 });
  return { seconds: clock, chapters: chapters.join("\n") };
};
