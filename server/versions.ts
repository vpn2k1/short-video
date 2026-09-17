/**
 * Các bản của một video: mỗi lần dựng xong (AI viết, sửa bằng prompt, xuất từ trình chỉnh sửa…)
 * là một bản có số, giữ riêng file video và props lúc đó — bản sau không ghi đè bản trước.
 *
 *   videos/<slug>/props.json             props đang dùng (bản mới nhất; pipeline AI đọc/ghi file này)
 *   videos/<slug>/versions/v<n>.json     props của bản n — trình chỉnh sửa mở bản nào thì đọc bản đó
 *   videos/<slug>/versions/v<n>.draft.json   thay đổi đang sửa dở trên bản n (chưa xuất)
 *   out/<slug>.mp4                       bản mới nhất (thư viện, tải xuống, hàng loạt vẫn dùng)
 *   out/versions/<slug>/v<n>.mp4         video của bản n
 *
 * Xuất từ trình chỉnh sửa luôn tạo bản MỚI ("chỉnh từ bản n"), bản gốc giữ nguyên.
 */
import fs from "fs";
import path from "path";

const videoDir = (slug: string) => path.join(process.cwd(), "videos", slug);

export const versionsDir = (slug: string) => path.join(videoDir(slug), "versions");
export const versionPropsPath = (slug: string, n: number) => path.join(versionsDir(slug), `v${n}.json`);
export const versionDraftPath = (slug: string, n: number) => path.join(versionsDir(slug), `v${n}.draft.json`);
export const versionVideosDir = (slug: string) => path.join(process.cwd(), "out", "versions", slug);
const versionMp4Path = (slug: string, n: number) => path.join(versionVideosDir(slug), `v${n}.mp4`);

export const parseVersion = (value: unknown): number | null => {
  const n = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isInteger(n) && n > 0 && n < 100_000 ? n : null;
};

/** Phần tin nhắn liên quan tới bản — khớp ChatMessage trong chat.ts. */
type VersionedMessage = {
  role: "user" | "assistant";
  at: number;
  mp4?: string;
  error?: boolean;
  /** Số bản, gán khi kết quả được ghi vào chat. */
  version?: number;
  /** Video cũ từ trước khi có bản: file đã bị bản sau ghi đè, không còn xem hay sửa được. */
  stale?: boolean;
};

/** Chép (APFS: nhân bản tức thì, không tốn thêm ổ đĩa) — ổ không hỗ trợ thì chép thường. */
const cloneFile = (from: string, to: string) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to, fs.constants.COPYFILE_FICLONE);
};

/**
 * Gán số bản cho kết quả video chưa có số, và lưu riêng video + props của kết quả mới nhất.
 * Gọi ngay trước khi ghi chat.json — lúc đó props.json và out/<slug>.mp4 đúng là của kết quả vừa dựng.
 * Kết quả cũ hơn chưa có số (dữ liệu trước khi có tính năng này) dùng chung một file đã bị ghi đè → stale.
 * Trả về true nếu có thay đổi.
 */
export const assignVersions = (slug: string, messages: VersionedMessage[]) => {
  const results = messages.filter((m) => m.role === "assistant" && m.mp4 && !m.error);
  const pending = results.filter((m) => !m.version);
  if (pending.length === 0) return false;

  let next = Math.max(0, ...results.map((m) => m.version ?? 0));
  const last = results[results.length - 1];
  const latestMp4 = path.join(process.cwd(), "out", `${slug}.mp4`);
  const props = path.join(videoDir(slug), "props.json");
  for (const message of pending) {
    message.version = ++next;
    if (message !== last || !fs.existsSync(latestMp4)) {
      message.stale = true;
      continue;
    }
    cloneFile(latestMp4, versionMp4Path(slug, next));
    if (fs.existsSync(props)) cloneFile(props, versionPropsPath(slug, next));
    message.mp4 = `/out/versions/${slug}/v${next}.mp4?t=${Date.now()}`;
  }
  return true;
};

/** Bản mới nhất còn mở được trong trình chỉnh sửa. */
export const latestEditableVersion = (slug: string, messages: VersionedMessage[]) => {
  const versions = messages
    .filter((m) => m.version && !m.stale && fs.existsSync(versionPropsPath(slug, m.version)))
    .map((m) => m.version as number);
  return versions.length > 0 ? Math.max(...versions) : null;
};
