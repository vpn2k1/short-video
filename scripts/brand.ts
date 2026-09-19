/**
 * Gắn đoạn mở đầu / kết thúc chung (logo, lời kêu gọi theo dõi…) vào một video đã render — ghép bằng ffmpeg,
 * không render lại. Mỗi đoạn được co và đệm viền về đúng khung của video chính, đưa về 30 fps; đoạn không có
 * tiếng (ảnh tĩnh, clip câm) được lót im lặng để ghép nối tiếng hình không lệch nhau.
 *
 *   await brandVideo("out/x.mp4", "out/exports/x/brand.mp4", { intro: "uploads/logo.png", outro: "uploads/cta.mp4" })
 */
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const run = promisify(execFile);

/** Ảnh tĩnh hiện bao lâu. */
const STILL_SECONDS = 2.5;
/** Đoạn mở đầu/kết thúc dài hơn thế thì cắt bớt — thương hiệu ngắn gọn thì người xem mới ở lại. */
const MAX_SECONDS = 15;
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

export const isBrandFile = (rel: string) => IMAGE_RE.test(rel) || VIDEO_RE.test(rel);

const probe = async (file: string) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", file,
  ]);
  const info = JSON.parse(stdout) as { streams?: { codec_type?: string; width?: number; height?: number }[]; format?: { duration?: string } };
  const video = info.streams?.find((s) => s.codec_type === "video");
  return {
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    audio: Boolean(info.streams?.some((s) => s.codec_type === "audio")),
    seconds: Number(info.format?.duration) || 0,
  };
};

export const brandVideo = async (main: string, output: string, parts: { intro?: string | null; outro?: string | null }) => {
  const publicDir = path.join(process.cwd(), "public");
  const size = await probe(main);
  if (!size.width || !size.height) throw new Error("Không đọc được kích thước video.");
  const { width: W, height: H } = size;

  // [đường dẫn tuyệt đối, là ảnh tĩnh?]
  const segments: { file: string; still: boolean }[] = [];
  for (const rel of [parts.intro, null, parts.outro]) {
    if (rel === null) {
      segments.push({ file: main, still: false });
      continue;
    }
    if (!rel) continue;
    const abs = path.join(publicDir, rel);
    if (!abs.startsWith(publicDir) || !fs.existsSync(abs)) throw new Error(`Không thấy file ${rel}.`);
    if (!isBrandFile(rel)) throw new Error(`${path.basename(rel)} không phải ảnh hay video.`);
    segments.push({ file: abs, still: IMAGE_RE.test(rel) });
  }

  const args = ["-v", "error", "-y"];
  const filters: string[] = [];
  const labels: string[] = [];
  for (const [i, seg] of segments.entries()) {
    const info = seg.still ? { audio: false, seconds: STILL_SECONDS } : await probe(seg.file);
    const seconds = seg.file === main ? info.seconds : Math.min(info.seconds || STILL_SECONDS, MAX_SECONDS);
    if (seg.still) args.push("-loop", "1", "-t", String(STILL_SECONDS));
    else if (seg.file !== main) args.push("-t", String(seconds));
    args.push("-i", seg.file);
    filters.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,` +
      `setsar=1,fps=30,format=yuv420p[v${i}]`,
    );
    filters.push(info.audio
      ? `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${seconds}[a${i}]`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${seconds}[a${i}]`);
    labels.push(`[v${i}][a${i}]`);
  }
  filters.push(`${labels.join("")}concat=n=${segments.length}:v=1:a=1[v][a]`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await run("ffmpeg", [
    ...args,
    "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    output,
  ], { maxBuffer: 16 * 1024 * 1024 });
  return output;
};
