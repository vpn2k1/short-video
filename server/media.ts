/**
 * Thư viện media cho trình chỉnh sửa: ảnh, video, âm thanh đang có trong public/.
 * Chỉ quét các thư mục người dùng dùng tới — không lộ file khác của project.
 */
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { moveToAppTrash } from "./app-trash";

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

/** Thư mục tài nguyên hiện trong tab 🗂 Tài nguyên của Thư viện — thêm giọng đọc so với trình chỉnh sửa. */
export const LIBRARY_ROOTS = ["uploads", "images", "videos", "music", "sfx", "voices"] as const;

/**
 * Nhạc nền và hiệu ứng có sẵn của app (sinh bởi scripts/make-audio-assets.sh, có trong git) — khoá trong
 * Thư viện: không chọn, không xoá được. Mất chúng thì chip Nhạc nền và tiếng chuyển cảnh hỏng.
 */
export const BUILTIN_MEDIA = new Set([
  "music/calm.mp3", "music/dramatic.mp3", "music/placeholder.mp3", "music/tense.mp3", "music/upbeat.mp3",
  "music/warm.mp3", "sfx/ding.mp3", "sfx/pop.mp3", "sfx/riser.mp3", "sfx/thud.mp3", "sfx/whoosh.mp3",
]);

export type LibraryMediaItem = MediaItem & {
  /** Tài nguyên mặc định của app — khoá, không xoá được. */
  builtIn: boolean;
  /** Thư mục gốc: uploads | images | videos | music | sfx | voices. */
  root: (typeof LIBRARY_ROOTS)[number];
  /** Thư mục chứa file, tính từ public/ (vd "images/shared", "voices/pin-iphone"). */
  folder: string;
  /** Video đang dùng file này — xoá file sẽ làm hỏng các video đó. */
  usedBy: { slug: string; title: string }[];
};

/**
 * Đường dẫn tài nguyên → video đang dùng. Quét chữ thô của props/script/multi/ai-clips của mọi
 * video: file nào xuất hiện nguyên văn trong đó là đang dùng. Không tính chat.json — đó là lịch sử,
 * video hiện tại không còn đọc nó.
 */
const mediaUsage = () => {
  const videosDir = path.join(process.cwd(), "videos");
  const usage = new Map<string, { slug: string; title: string }[]>();
  if (!fs.existsSync(videosDir)) return usage;
  for (const entry of fs.readdirSync(videosDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    let text = "";
    let title = slug;
    // Các bản đã lưu (versions/v<n>.json, bản nháp) cũng dùng tài nguyên — xoá đi thì mở lại bản cũ bị thiếu hình.
    const versionsDir = path.join(videosDir, slug, "versions");
    const versionFiles = fs.existsSync(versionsDir)
      ? fs.readdirSync(versionsDir).filter((name) => name.endsWith(".json")).map((name) => path.join("versions", name))
      : [];
    for (const file of ["props.json", "script.json", "multi.json", "ai-clips.json", ...versionFiles]) {
      const abs = path.join(videosDir, slug, file);
      if (!fs.existsSync(abs)) continue;
      const raw = fs.readFileSync(abs, "utf8");
      text += raw;
      if (file === "props.json" || file === "script.json" || file === "multi.json") {
        try {
          title = (JSON.parse(raw) as { title?: string }).title || title;
        } catch {
          // file hỏng — vẫn tính tham chiếu theo chữ thô
        }
      }
    }
    for (const match of text.matchAll(/"((?:uploads|images|videos|music|sfx|voices)\/[^"]+)"/g)) {
      const list = usage.get(match[1]) ?? [];
      if (!list.some((v) => v.slug === slug)) list.push({ slug, title });
      usage.set(match[1], list);
    }
  }
  return usage;
};

/** Mọi tài nguyên cho Thư viện, kèm video đang dùng từng file. Mới nhất trước. */
export const listLibraryMedia = () => {
  const publicDir = path.join(process.cwd(), "public");
  const usage = mediaUsage();
  const items: LibraryMediaItem[] = [];

  const walk = (root: LibraryMediaItem["root"], rel: string, depth: number) => {
    const abs = path.join(publicDir, rel);
    if (!fs.existsSync(abs) || depth > 3) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const childRel = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        walk(root, childRel, depth + 1);
        continue;
      }
      const kind = KIND.find(([re]) => re.test(entry.name))?.[1];
      if (!kind) continue;
      const stat = fs.statSync(path.join(publicDir, childRel));
      items.push({
        path: childRel, name: entry.name, kind, bytes: stat.size, at: stat.mtimeMs,
        root, folder: rel, usedBy: usage.get(childRel) ?? [], builtIn: BUILTIN_MEDIA.has(childRel),
      });
    }
  };

  for (const root of LIBRARY_ROOTS) walk(root, root, 0);
  items.sort((a, b) => b.at - a.at);
  return { items };
};

const LIBRARY_PATH = new RegExp(`^(${LIBRARY_ROOTS.join("|")})/[^\\0]+$`);

/**
 * Chuyển tài nguyên đã chọn vào Thùng rác của app (không xoá hẳn). Tài nguyên mặc định của app luôn bị từ chối.
 * Mặc định bỏ qua file đang được video dùng; `force` (người dùng đã xác nhận cảnh báo) thì chuyển cả
 * những file đó — video dùng chúng sẽ thiếu hình/tiếng khi dựng lại.
 * Thư mục con rỗng sau đó được dọn luôn (không đụng thư mục gốc).
 */
export const deleteLibraryMedia = (value: unknown, force = false) => {
  const paths = Array.isArray(value) ? [...new Set(value)] : [];
  if (paths.length === 0 || paths.length > 1000) {
    throw new Error("Danh sách tài nguyên cần xoá không hợp lệ.");
  }
  const publicDir = path.join(process.cwd(), "public");
  const usage = mediaUsage();
  const deleted: string[] = [];
  const trashIds: string[] = [];
  const skipped: { path: string; reason: string }[] = [];
  let freedBytes = 0;

  for (const rel of paths) {
    if (typeof rel !== "string" || !LIBRARY_PATH.test(rel) || rel.split("/").includes("..")) {
      skipped.push({ path: String(rel), reason: "đường dẫn không hợp lệ" });
      continue;
    }
    const root = path.join(publicDir, rel.split("/")[0]);
    const abs = path.resolve(publicDir, rel);
    if (!abs.startsWith(root + path.sep)) {
      skipped.push({ path: rel, reason: "đường dẫn không hợp lệ" });
      continue;
    }
    if (BUILTIN_MEDIA.has(rel)) {
      skipped.push({ path: rel, reason: "tài nguyên mặc định của app" });
      continue;
    }
    const users = usage.get(rel) ?? [];
    if (users.length > 0 && !force) {
      skipped.push({ path: rel, reason: `đang dùng trong "${users[0].title}"${users.length > 1 ? ` và ${users.length - 1} video khác` : ""}` });
      continue;
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      skipped.push({ path: rel, reason: "không tồn tại" });
      continue;
    }
    try {
      const entry = moveToAppTrash([abs], {
        kind: "media",
        title: path.basename(abs),
        mediaKind: KIND.find(([re]) => re.test(abs))?.[1],
      });
      freedBytes += entry.bytes;
      deleted.push(rel);
      trashIds.push(entry.id);
      for (let dir = path.dirname(abs); dir.startsWith(root + path.sep); dir = path.dirname(dir)) {
        if (fs.readdirSync(dir).length > 0) break;
        fs.rmdirSync(dir);
      }
    } catch (error) {
      skipped.push({ path: rel, reason: `lỗi: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}` });
    }
  }
  return { deleted, skipped, freedBytes, trashIds };
};

const VIDEO_PATH = /^(uploads|videos|images)\/[\w./-]+\.(mp4|mov|webm)$/i;

/**
 * Tách tiếng của một video trong public/ ra file mp3 ở public/uploads/.
 * Chạy ffmpeg bất đồng bộ — không chặn server trong lúc xử lý video dài.
 */
/**
 * Cắt một khung hình của video thành ảnh JPG trong public/uploads — "đóng băng" khung đang xem.
 * `atMs` tính theo file gốc (đã cộng phần cắt đầu và tốc độ phát ở phía trình chỉnh sửa).
 */
export const captureFrame = async (src: unknown, atMs: unknown) => {
  if (typeof src !== "string" || !VIDEO_PATH.test(src) || src.includes("..")) {
    throw new Error("File video không hợp lệ.");
  }
  const publicDir = path.join(process.cwd(), "public");
  const input = path.join(publicDir, src);
  if (!fs.existsSync(input)) {
    throw new Error("Không thấy file video.");
  }
  const ms = Math.max(0, Math.round(Number(atMs)));
  if (!Number.isFinite(ms)) {
    throw new Error("Mốc thời gian không hợp lệ.");
  }

  const base = path.basename(src, path.extname(src)).replace(/[^\w-]+/g, "-").slice(0, 40);
  const rel = `uploads/${Date.now()}-${base}-frame-${ms}.jpg`;
  const output = path.join(publicDir, rel);
  fs.mkdirSync(path.join(publicDir, "uploads"), { recursive: true });
  // -ss trước -i: ffmpeg tua nhanh rồi giải mã đúng khung — nhanh với video dài.
  await run("ffmpeg", ["-y", "-v", "error", "-ss", (ms / 1000).toFixed(3), "-i", input, "-frames:v", "1", "-q:v", "2", output]);
  if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
    fs.rmSync(output, { force: true });
    throw new Error("Không cắt được ảnh ở mốc này — thử dời đầu phát vào giữa clip.");
  }
  return { path: rel };
};

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
