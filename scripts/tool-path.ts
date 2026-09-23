/**
 * ffmpeg/ffprobe cho lúc chạy từ mã nguồn (npm start) — máy chưa chắc đã cài, nhất là Windows.
 * Import đầu tiên trong server/index.ts: mọi execFile("ffmpeg" | "ffprobe") sau đó (kể cả tiến trình con) đều tìm thấy.
 *
 * Thêm bản đi kèm node_modules vào CUỐI PATH — máy đã cài ffmpeg riêng thì vẫn dùng bản đó.
 * App desktop tự làm việc này (đặt lên đầu PATH) trong desktop/main.cjs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** Tên gói @remotion/compositor-* (chứa ffprobe) theo nền tảng. */
const COMPOSITOR: Record<string, string> = {
  "win32-x64": "win32-x64-msvc",
  "linux-x64": "linux-x64-gnu",
  "linux-arm64": "linux-arm64-gnu",
};

const modules = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "node_modules");
const compositor = COMPOSITOR[`${process.platform}-${process.arch}`];
// macOS: ffprobe của Remotion cần DYLD_LIBRARY_PATH trỏ vào thư mục của nó, mà đặt biến đó cho cả server sẽ làm
// ffmpeg Homebrew nạp nhầm libav* — máy Mac chạy từ mã nguồn dùng ffmpeg/ffprobe cài bằng Homebrew.
const dirs = [
  path.join(modules, "ffmpeg-static"),
  ...(compositor ? [path.join(modules, "@remotion", `compositor-${compositor}`)] : []),
].filter((dir) => fs.existsSync(dir));

// Windows: process.env không phân biệt hoa thường, "Path" và "PATH" là một.
const current = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
const missing = dirs.filter((dir) => !current.includes(dir));
if (missing.length) process.env.PATH = [...current, ...missing].join(path.delimiter);
