/**
 * Thư viện media cho trình chỉnh sửa: ảnh, video, âm thanh đang có trong public/.
 * Chỉ quét các thư mục người dùng dùng tới — không lộ file khác của project.
 */
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const run = promisify(execFile);

const ROOTS = ["uploads", "images", "videos", "music", "sfx"];
const KIND: [RegExp, "image" | "video" | "audio"][] = [
  [/\.(jpe?g|png|webp|avif)$/i, "image"],
  [/\.(mp4|mov|webm)$/i, "video"],
  [/\.(mp3|wav|m4a|aac|ogg)$/i, "audio"],
];

export type MediaItem = {
  /** Đường dẫn tính từ public/ — dùng thẳng cho staticFile(). */
  path: string;
  name: string;
  kind: "image" | "video" | "audio";
  bytes: number;
  at: number;
};

export const listMedia = () => {
  const publicDir = path.join(process.cwd(), "public");
  const items: MediaItem[] = [];

  const walk = (rel: string, depth: number) => {
    const abs = path.join(publicDir, rel);
    if (!fs.existsSync(abs) || depth > 3) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const childRel = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        walk(childRel, depth + 1);
        continue;
      }
      const kind = KIND.find(([re]) => re.test(entry.name))?.[1];
      if (!kind) continue;
      const stat = fs.statSync(path.join(publicDir, childRel));
      items.push({ path: childRel, name: entry.name, kind, bytes: stat.size, at: stat.mtimeMs });
    }
  };

  for (const root of ROOTS) walk(root, 0);
  // Tương thích: trả thêm danh sách phẳng, mới nhất trước.
  // Giọng đọc sinh tự động (public/voices) cố ý không liệt kê — không phải thứ để kéo vào timeline.
  items.sort((a, b) => b.at - a.at);
  return { items };
};

const VIDEO_PATH = /^(uploads|videos|images)\/[\w./-]+\.(mp4|mov|webm)$/i;

/**
 * Tách tiếng của một video trong public/ ra file mp3 ở public/uploads/.
 * Chạy ffmpeg bất đồng bộ — không chặn server trong lúc xử lý video dài.
 */
export const extractAudio = async (src: unknown) => {
  if (typeof src !== "string" || !VIDEO_PATH.test(src) || src.includes("..")) {
    throw new Error("File video không hợp lệ.");
  }
  const publicDir = path.join(process.cwd(), "public");
  const input = path.join(publicDir, src);
  if (!fs.existsSync(input)) {
    throw new Error("Không thấy file video.");
  }

  const streams = await run("ffprobe", [
    "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", input,
  ]);
  if (!streams.stdout.trim()) {
    throw new Error("Video này không có âm thanh để tách.");
  }

  const base = path.basename(src, path.extname(src)).replace(/[^\w-]+/g, "-").slice(0, 40);
  const rel = `uploads/${Date.now()}-${base}-am-thanh.mp3`;
  fs.mkdirSync(path.join(publicDir, "uploads"), { recursive: true });
  await run(
    "ffmpeg",
    ["-y", "-v", "error", "-i", input, "-vn", "-ac", "2", "-ar", "48000", "-b:a", "192k", path.join(publicDir, rel)],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const duration = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path.join(publicDir, rel),
  ]);
  return { path: rel, durationMs: Math.round(parseFloat(duration.stdout.trim()) * 1000) || 0 };
};
