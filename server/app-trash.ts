/**
 * Thùng rác của app: video và tài nguyên bị xoá được dời vào .trash/<id>/files trong thư mục làm việc,
 * kèm meta.json ghi chỗ cũ — xem và khôi phục ngay trong Thư viện › 🗑 Thùng rác.
 *
 * "Xoá vĩnh viễn", "Dọn sạch" và mục quá TRASH_DAYS ngày không huỷ file ngay mà chuyển tiếp sang Thùng rác
 * của hệ điều hành (scripts/trash.ts) — bấm nhầm vẫn còn một đường lấy lại.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { moveToTrash } from "../scripts/trash";

export const TRASH_DAYS = 30;
const DAY_MS = 86_400_000;
const ID_RE = /^[0-9a-z]{6,12}-[0-9a-f]{8}$/;
const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i;
const VIDEO_RE = /\.(mp4|mov|webm)$/i;

const trashDir = () => path.join(process.cwd(), ".trash");

type TrashFile = {
  /** Chỗ cũ, tính từ thư mục làm việc (dấu /). */
  from: string;
  /** Tên trong .trash/<id>/files. */
  stored: string;
};

type TrashEntry = {
  id: string;
  kind: "video" | "media";
  title: string;
  deletedAt: number;
  bytes: number;
  files: TrashFile[];
  slug?: string;
  mediaKind?: "image" | "video" | "audio";
  /** Ảnh bìa nằm ngoài thùng rác (vd /public/images/…) — còn file thì dùng làm ảnh xem trước. */
  preview?: string | null;
};

const dirBytes = (target: string): number => {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.size;
  return fs.readdirSync(target).reduce((sum, name) => sum + dirBytes(path.join(target, name)), 0);
};

/** rename trong cùng ổ; khác ổ (EXDEV) thì chép rồi xoá bản gốc. */
const move = (from: string, to: string) => {
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
};

const relFromCwd = (abs: string) => path.relative(process.cwd(), abs).split(path.sep).join("/");

/** Đường dẫn gốc của một file trong meta.json — chặn meta hỏng/bị sửa trỏ ra ngoài thư mục làm việc. */
const originalPath = (from: string) => {
  const root = path.resolve(process.cwd());
  const abs = path.resolve(root, from);
  if (!abs.startsWith(root + path.sep) || abs.startsWith(trashDir() + path.sep)) {
    throw new Error(`đường dẫn không hợp lệ: ${from}`);
  }
  return abs;
};

const errorCode = (error: unknown) => (error as NodeJS.ErrnoException).code ?? (error as Error).message;

const readEntry = (id: string): TrashEntry | null => {
  if (!ID_RE.test(id)) return null;
  try {
    const entry = JSON.parse(fs.readFileSync(path.join(trashDir(), id, "meta.json"), "utf8")) as TrashEntry;
    return entry.id === id && Array.isArray(entry.files) ? entry : null;
  } catch {
    return null;
  }
};

/**
 * Số mục và dung lượng trong thùng rác — chỉ đọc (không dọn mục hết hạn như listTrash), cho hộp Dọn dung lượng.
 * `base`: thư mục làm việc (kiểm thử truyền thư mục tạm).
 */
export const trashUsage = (base = process.cwd()) => {
  const root = path.join(base, ".trash");
  let items = 0;
  let bytes = 0;
  for (const id of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    if (!ID_RE.test(id)) continue;
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(root, id, "meta.json"), "utf8")) as TrashEntry;
      items++;
      bytes += Number(entry.bytes) || 0;
    } catch {
      // mục hỏng — listTrash cũng bỏ qua
    }
  }
  return { items, bytes };
};

/** Thư mục files/ của một mục — cho route xem trước ảnh/video. null nếu id sai. */
export const trashFilesDir = (id: string) => (readEntry(id) ? path.join(trashDir(), id, "files") : null);

/**
 * Dời các file/thư mục vào một mục thùng rác. Hỏng giữa chừng thì trả những file đã dời về chỗ cũ rồi
 * ném lỗi — không để một nửa video nằm trong thùng rác, nửa còn lại ở ngoài.
 */
export const moveToAppTrash = (
  targets: string[],
  info: Pick<TrashEntry, "kind" | "title" | "slug" | "mediaKind" | "preview">,
): TrashEntry => {
  const existing = targets.filter((target) => fs.existsSync(target));
  if (existing.length === 0) throw new Error("không tồn tại");
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const dir = path.join(trashDir(), id);
  const filesDir = path.join(dir, "files");
  fs.mkdirSync(filesDir, { recursive: true });

  const files: TrashFile[] = [];
  let bytes = 0;
  try {
    existing.forEach((abs, i) => {
      const stored = `${i}-${path.basename(abs)}`;
      const size = dirBytes(abs);
      move(abs, path.join(filesDir, stored));
      files.push({ from: relFromCwd(abs), stored });
      bytes += size;
    });
  } catch (error) {
    const stuck: TrashFile[] = [];
    for (const file of files) {
      try {
        move(path.join(filesDir, file.stored), path.join(process.cwd(), file.from));
      } catch {
        stuck.push(file);
      }
    }
    if (stuck.length === 0) {
      fs.rmSync(dir, { recursive: true, force: true });
    } else {
      // Không trả về được: giữ mục trong thùng rác (có meta) để người dùng vẫn khôi phục được.
      fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id, ...info, deletedAt: Date.now(), bytes, files: stuck }, null, 2));
    }
    throw error;
  }

  const entry: TrashEntry = { id, ...info, deletedAt: Date.now(), bytes, files };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(entry, null, 2));
  return entry;
};

const previewOf = (entry: TrashEntry) => {
  if (entry.preview?.startsWith("/public/") && !entry.preview.includes("..")) {
    const abs = path.join(process.cwd(), entry.preview.split("?")[0]);
    if (fs.existsSync(abs)) return { url: entry.preview, video: false };
  }
  const url = (file: TrashFile) => `/api/trash/file/${entry.id}/${encodeURIComponent(file.stored)}`;
  const isFile = (file: TrashFile) => {
    try {
      return fs.statSync(path.join(trashDir(), entry.id, "files", file.stored)).isFile();
    } catch {
      return false;
    }
  };
  const image = entry.files.find((f) => IMAGE_RE.test(f.stored) && isFile(f));
  if (image) return { url: url(image), video: false };
  const video = entry.files.find((f) => VIDEO_RE.test(f.stored) && isFile(f));
  return video ? { url: url(video), video: true } : null;
};

/** Chuyển cả mục sang Thùng rác của hệ điều hành. */
const discard = (id: string) => moveToTrash(path.join(trashDir(), id));

/** Mục quá TRASH_DAYS ngày tự chuyển sang Thùng rác của hệ điều hành. */
const purgeExpired = () => {
  const root = trashDir();
  if (!fs.existsSync(root)) return;
  const cutoff = Date.now() - TRASH_DAYS * DAY_MS;
  for (const id of fs.readdirSync(root)) {
    const entry = readEntry(id);
    if (entry && entry.deletedAt < cutoff) {
      try {
        discard(id);
      } catch {
        // thử lại lần sau
      }
    }
  }
};

export const listTrash = () => {
  purgeExpired();
  const root = trashDir();
  const entries = fs.existsSync(root)
    ? fs.readdirSync(root).map(readEntry).filter((e): e is TrashEntry => e !== null)
    : [];
  const items = entries
    .sort((a, b) => b.deletedAt - a.deletedAt)
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      slug: entry.slug ?? null,
      mediaKind: entry.mediaKind ?? null,
      deletedAt: entry.deletedAt,
      expiresAt: entry.deletedAt + TRASH_DAYS * DAY_MS,
      bytes: entry.bytes,
      /** Chỗ cũ đã có file khác — khôi phục sẽ bị bỏ qua để không ghi đè. */
      conflict: entry.files.some((file) => {
        try {
          return fs.existsSync(originalPath(file.from));
        } catch {
          return true;
        }
      }),
      preview: previewOf(entry),
    }));
  return { items, days: TRASH_DAYS };
};

const parseIds = (value: unknown) => {
  const ids = Array.isArray(value) ? [...new Set(value)] : [];
  if (ids.length === 0 || ids.length > 1000 || !ids.every((id) => typeof id === "string" && ID_RE.test(id))) {
    throw new Error("Danh sách mục trong thùng rác không hợp lệ.");
  }
  return ids as string[];
};

/** Trả các mục về đúng chỗ cũ. Chỗ cũ đã có file khác thì bỏ qua cả mục — không ghi đè. */
export const restoreTrash = (value: unknown) => {
  const restored: { id: string; kind: TrashEntry["kind"]; slug: string | null; title: string }[] = [];
  const skipped: { id: string; title: string; reason: string }[] = [];

  for (const id of parseIds(value)) {
    const entry = readEntry(id);
    if (!entry) {
      skipped.push({ id, title: id, reason: "không còn trong thùng rác" });
      continue;
    }
    const filesDir = path.join(trashDir(), id, "files");
    let targets: string[];
    try {
      targets = entry.files.map((file) => originalPath(file.from));
    } catch (error) {
      skipped.push({ id, title: entry.title, reason: (error as Error).message });
      continue;
    }
    const clash = entry.files.find((_, i) => fs.existsSync(targets[i]));
    if (clash) {
      skipped.push({ id, title: entry.title, reason: `đã có ${clash.from}` });
      continue;
    }

    const done: number[] = [];
    try {
      entry.files.forEach((file, i) => {
        fs.mkdirSync(path.dirname(targets[i]), { recursive: true });
        move(path.join(filesDir, file.stored), targets[i]);
        done.push(i);
      });
    } catch (error) {
      // Giữ mục nguyên vẹn: đưa các file vừa khôi phục vào lại thùng rác.
      for (const i of done) {
        try {
          move(targets[i], path.join(filesDir, entry.files[i].stored));
        } catch {
          // để ở chỗ cũ — vẫn là dữ liệu của người dùng, không mất
        }
      }
      skipped.push({ id, title: entry.title, reason: `lỗi: ${errorCode(error)}` });
      continue;
    }

    // Chỉ dọn khi files/ đã rỗng — không bao giờ xoá dữ liệu còn sót lại.
    if (!fs.existsSync(filesDir) || fs.readdirSync(filesDir).length === 0) {
      fs.rmSync(path.join(trashDir(), id), { recursive: true, force: true });
    }
    restored.push({ id, kind: entry.kind, slug: entry.slug ?? null, title: entry.title });
  }
  return { restored, skipped };
};

/** Xoá vĩnh viễn khỏi app (chuyển sang Thùng rác của hệ điều hành). "all" = dọn sạch. */
export const deleteTrash = (value: unknown) => {
  const root = trashDir();
  const ids = value === "all"
    ? (fs.existsSync(root) ? fs.readdirSync(root).filter((id) => readEntry(id)) : [])
    : parseIds(value);
  const deleted: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  let freedBytes = 0;
  for (const id of ids) {
    const entry = readEntry(id);
    if (!entry) {
      skipped.push({ id, reason: "không còn trong thùng rác" });
      continue;
    }
    try {
      discard(id);
      deleted.push(id);
      freedBytes += entry.bytes;
    } catch (error) {
      skipped.push({ id, reason: `lỗi: ${errorCode(error)}` });
    }
  }
  return { deleted, skipped, freedBytes };
};
