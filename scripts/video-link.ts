/**
 * "Lấy video từ link": dán link một video (YouTube, TikTok, Facebook, Instagram, Bilibili… — mọi trang yt-dlp đọc
 * được) → xem thông tin → tải về public/uploads/links/ để chỉnh sửa hoặc thêm phụ đề.
 *
 * Khác mục Bilibili (tự tìm tư liệu tác giả cho phép), ở đây người dùng tự mang link tới — thường là video của chính
 * họ đăng ở nơi khác. App không đoán được quyền dùng nên người dùng phải xác nhận có quyền trước khi tải; lời xác nhận
 * được lưu cạnh file (link gốc, người đăng, lúc tải) để ghi nguồn khi đăng.
 */
import { spawn } from "child_process";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { ytDlpDownload, ytDlpPath } from "./bilibili";
import { slugify } from "./slug";

/** Link http(s) một dòng, không khoảng trắng. */
export const isVideoLink = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 2000 && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(value.trim());

/** Video dài hơn thế thì bắt chọn một đoạn — tải cả phim vài giờ vừa lâu vừa đầy ổ. */
export const MAX_LINK_SECONDS = 2 * 60 * 60;

export type LinkInfo = {
  url: string;
  title: string;
  site: string;
  uploader: string | null;
  /** Giây; null = trang không cho biết. */
  duration: number | null;
  thumbnail: string | null;
  width: number | null;
  height: number | null;
};

/** Chạy yt-dlp, trả trọn stdout — `-J` in cả thông tin video trên một dòng rất dài, không đọc theo dòng được. */
const ytDlpJson = (args: string[]) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(ytDlpPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => { err = (err + chunk.toString("utf8")).slice(-4000); });
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(error.code === "ENOENT" ? new Error("Thiếu yt-dlp — bản cài đặt bị thiếu file, hoặc chạy từ mã nguồn thì cài bằng \"brew install yt-dlp\".") : error));
    child.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out).toString("utf8")) : reject(new Error(err.trim() || `yt-dlp thoát mã ${code}`))));
  });

const cache = new Map<string, { at: number; info: LinkInfo }>();
const CACHE_MS = 30 * 60_000;

/** Đọc thông tin video bằng yt-dlp (không tải). Link danh sách phát, phát trực tiếp thì báo lỗi dễ hiểu. */
export const linkInfo = async (raw: string): Promise<LinkInfo> => {
  const url = raw.trim();
  if (!isVideoLink(url)) throw new Error("Link không hợp lệ — dán đầy đủ link video, bắt đầu bằng http:// hoặc https://.");
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.info;

  let out: string;
  try {
    out = await ytDlpJson(["-J", "--no-playlist", "--no-warnings", "--socket-timeout", "30", url]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Unsupported URL/i.test(message)) throw new Error("Trang này chưa hỗ trợ tải video — thử link khác, hoặc tải file về máy rồi kéo thả vào.");
    if (/\bprivate\b|log ?in|sign in|cookies|members[- ]only|age[- ]restrict|confirm your age/i.test(message)) {
      throw new Error("Video này cần đăng nhập hoặc đang để riêng tư nên không tải được — tải file về máy rồi kéo thả vào.");
    }
    if (/timed out|timeout|Connection|resolve|Temporary failure/i.test(message)) throw new Error("Không kết nối được tới trang video — kiểm tra mạng rồi thử lại.");
    throw new Error(`Không đọc được video từ link này: ${message.split("\n").find((l) => /ERROR/.test(l))?.replace(/^ERROR:\s*/, "") ?? message.split("\n")[0]}`);
  }
  const data = JSON.parse(out) as Record<string, unknown>;
  if (data._type === "playlist") throw new Error("Link này là danh sách phát — mở một video trong đó rồi dán link của riêng video đó.");
  if (data.is_live === true || data.live_status === "is_live") throw new Error("Video đang phát trực tiếp — đợi phát xong rồi dán lại link.");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const info: LinkInfo = {
    url: str(data.webpage_url) ?? url,
    title: (str(data.title) ?? "Video").slice(0, 200),
    site: str(data.extractor_key) ?? str(data.extractor) ?? new URL(url).hostname,
    uploader: str(data.uploader) ?? str(data.channel),
    duration: num(data.duration),
    thumbnail: str(data.thumbnail),
    width: num(data.width),
    height: num(data.height),
  };
  cache.set(url, { at: Date.now(), info });
  return info;
};

export type LinkDownload = {
  url: string;
  /** Giây, null = từ đầu / tới hết. */
  start: number | null;
  end: number | null;
  maxHeight: 720 | 1080;
  /** Người dùng xác nhận video là của họ hoặc được phép dùng. */
  confirmed: boolean;
};

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Tải video (hoặc một đoạn) về public/uploads/links/, kèm file ghi nguồn. Trả đường dẫn trong public/. */
export const downloadLink = async (input: LinkDownload, log: (line: string) => void) => {
  if (!input.confirmed) throw new Error("Cần xác nhận video là của bạn hoặc bạn được phép dùng.");
  log("Đọc thông tin video…");
  const info = await linkInfo(input.url);
  const total = info.duration ?? 0;
  const start = input.start !== null && input.start > 0 ? (total ? Math.min(input.start, total) : input.start) : null;
  const end = input.end !== null && (!total || input.end < total) ? input.end : null;
  if (start !== null && end !== null && end - start < 1) throw new Error("Đoạn cần tải phải dài ít nhất 1 giây.");
  const length = (end ?? total) - (start ?? 0);
  if (total && length > MAX_LINK_SECONDS) {
    throw new Error(`Video dài ${clock(total)} — chọn một đoạn tối đa ${MAX_LINK_SECONDS / 3600} giờ (ô Từ/Đến) rồi tải lại.`);
  }

  const id = crypto.createHash("sha1").update(info.url).digest("hex").slice(0, 10);
  const range = start !== null || end !== null ? `-${Math.round(start ?? 0)}-${Math.round(end ?? total)}` : "";
  const base = `${slugify(info.title, 40) || "video"}-${id}${range}`;
  const dir = path.join(process.cwd(), "public", "uploads", "links");
  await ytDlpDownload({
    url: info.url, dir, base, height: input.maxHeight === 720 ? 720 : 1080, start, end, duration: total,
    what: start !== null || end !== null ? `đoạn ${clock(start ?? 0)}–${clock(end ?? total)}` : "cả video",
    site: info.site, log,
  });

  const credit = `Video: ${info.title}${info.uploader ? ` — ${info.uploader}` : ""} — ${info.site} (${info.url})`;
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify({
    source: "link",
    url: info.url,
    site: info.site,
    title: info.title,
    uploader: info.uploader,
    range: { start: start ?? 0, end: end ?? total },
    confirmedByUserAt: new Date().toISOString(),
    credit,
  }, null, 2));
  log("Xong.");
  return { path: `uploads/links/${base}.mp4`, title: info.title, credit, width: info.width, height: info.height };
};
