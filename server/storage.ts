/**
 * Dọn dung lượng: chỉ những thứ SINH LẠI ĐƯỢC — bản xuất thêm, ảnh bìa, ảnh xem trước, bản phiên âm lưu tạm, file
 * còn sót của video đã xoá, và (có cảnh báo) bộ nhớ giọng đọc. Không đụng video, bản cũ trong lịch sử, file tải lên,
 * đoạn cắt từ video dài — video vẫn trỏ tới chúng.
 *
 * Xoá thẳng, không qua thùng rác: mọi mục ở đây sinh lại được (render lại, soát lại, đọc lại giọng). Video bị xoá
 * đã được dời mp4, bản cũ, giọng đọc vào thùng rác của app (chat.ts › projectFiles) nên "file sót" không gồm chúng.
 */
import fs from "fs";
import path from "path";

type Category = {
  id: string;
  label: string;
  desc: string;
  /** Có cái giá khi sinh lại (tốn lượt gọi) — không chọn sẵn. */
  warn?: string;
  paths: () => string[];
};

/** Thư mục làm việc — kiểm thử đặt STORAGE_ROOT để chạy trên thư mục tạm. */
const root = () => process.env.STORAGE_ROOT ?? process.cwd();
const videoExists = (slug: string) => fs.existsSync(path.join(root(), "videos", slug));
const list = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).map((name) => path.join(dir, name)) : []);

/**
 * File sót = KHÔNG video nào khớp tên. Xét cả tên đầy đủ lẫn tên đã bỏ hậu tố: slug thật có thể kết thúc bằng "-1"
 * hay 8 ký tự hex ("video-prompt-secon-1") — chỉ xét tên đã cắt thì sẽ xoá nhầm file của video đang có.
 */
const noVideo = (name: string, suffix: RegExp) => !videoExists(name) && !videoExists(name.replace(suffix, ""));

const CATEGORIES: Category[] = [
  {
    id: "exports",
    label: "Bản xuất thêm",
    desc: "Bản khác khung, bản có mở đầu/kết thúc, video tổng hợp của loạt — bấm lại nút tương ứng là có lại.",
    paths: () => list(path.join(root(), "out", "exports")),
  },
  {
    id: "covers",
    label: "Ảnh bìa",
    desc: "Ảnh bìa ba bố cục — bấm Tạo ảnh bìa là có lại.",
    paths: () => list(path.join(root(), "out", "covers")),
  },
  {
    id: "thumbs",
    label: "Ảnh xem trước",
    desc: "Ảnh nhỏ trên các ô của màn Hàng loạt — tự tạo lại khi cần.",
    paths: () => list(path.join(root(), "public", "thumbs")),
  },
  {
    id: "transcripts",
    label: "Bản phiên âm lưu tạm",
    desc: "Whisper nghe lại file nếu cần — tốn thời gian máy, không tốn tiền.",
    paths: () => list(path.join(root(), "data", "batches", "transcripts")),
  },
  {
    id: "orphans",
    label: "File sót của video đã xoá",
    desc: "Video trong Thư viện không còn nữa (kể cả thùng rác) nhưng file render, ảnh cảnh, giọng đọc vẫn nằm lại.",
    paths: () => [
      ...list(path.join(root(), "out")).filter((f) => f.endsWith(".mp4") && !videoExists(path.basename(f, ".mp4"))),
      ...list(path.join(root(), "out", "versions")).filter((f) => !videoExists(path.basename(f))),
      ...list(path.join(root(), "out", "scenes")).filter((f) => noVideo(path.basename(f).replace(/\.(png|mp4)$/, ""), /-\d+$/)),
      ...list(path.join(root(), "public", "voices"))
        // Thư mục bắt đầu bằng "." hay "_" là của app (.cache bộ nhớ giọng, _samples mẫu nghe thử), không phải của video.
        .filter((f) => !/^[._]/.test(path.basename(f)) && fs.statSync(f).isDirectory() && noVideo(path.basename(f), /-[0-9a-f]{8}$/)),
    ],
  },
  {
    id: "voiceCache",
    label: "Bộ nhớ giọng đọc",
    desc: "Câu đã đọc được nhớ lại để sửa lời không phải đọc lại cả video.",
    warn: "Xoá thì lần sau phải đọc lại — giọng ElevenLabs, Gemini tốn thêm lượt gọi / ký tự.",
    paths: () => list(path.join(root(), "public", "voices", ".cache")),
  },
];

const sizeOf = (file: string): number => {
  try {
    const stat = fs.statSync(file);
    if (!stat.isDirectory()) return stat.size;
    return fs.readdirSync(file).reduce((sum, name) => sum + sizeOf(path.join(file, name)), 0);
  } catch {
    return 0;
  }
};

export const storageReport = () => ({
  categories: CATEGORIES.map((c) => {
    const paths = c.paths();
    return { id: c.id, label: c.label, desc: c.desc, warn: c.warn ?? null, files: paths.length, bytes: paths.reduce((sum, f) => sum + sizeOf(f), 0) };
  }),
});

export const cleanStorage = (body: unknown) => {
  const raw = ((body ?? {}) as { ids?: unknown }).ids;
  const ids = new Set(Array.isArray(raw) ? raw.map(String) : []);
  let freed = 0;
  let removed = 0;
  for (const c of CATEGORIES) {
    if (!ids.has(c.id)) continue;
    for (const file of c.paths()) {
      // Chặn chắc: chỉ xoá bên trong out/, public/thumbs, public/voices, data/batches/transcripts.
      const rel = path.relative(root(), file);
      if (rel.startsWith("..") || !/^(out|public[\\/](thumbs|voices)|data[\\/]batches[\\/]transcripts)([\\/]|$)/.test(rel)) continue;
      freed += sizeOf(file);
      fs.rmSync(file, { recursive: true, force: true });
      removed++;
    }
  }
  return { freed, removed, ...storageReport() };
};
