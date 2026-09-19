/**
 * Tự soát một video đã render — phần ĐO ĐƯỢC của quy trình /review-video (.claude/commands/review-video.md),
 * chạy máy, không gọi AI: đủ hình và tiếng, độ dài, âm lượng (LUFS, đỉnh), khoảng lặng, màn đen, phụ đề.
 *
 *   await checkVideo("slug")  →  { score: 8, issues: [{ level: "warn", text: "…" }], stats: {…} }
 *
 * Một lượt ffmpeg cho mọi số đo âm thanh và hình (ebur128 + silencedetect + blackdetect), video 60 giây mất
 * khoảng 2 giây. Chạy bất đồng bộ để không chặn server trong lúc cả loạt đang soát.
 *
 * Kết quả lưu ở videos/<slug>/qa.json kèm mtime của mp4 — render lại thì tự coi là cũ.
 */
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { ASPECTS, DEFAULT_ASPECT, type AspectId } from "../src/aspects";

const run = promisify(execFile);

export type QaLevel = "error" | "warn";
export type QaIssue = { level: QaLevel; text: string };
export type QaResult = {
  score: number;
  issues: QaIssue[];
  stats: { seconds: number; lufs: number | null; peak: number | null };
  checkedAt: number;
  /** mtime của mp4 lúc soát. */
  source: number;
};

/** Mốc đo: đăng lên mạng xã hội thường chuẩn hoá về khoảng -14 LUFS; lệch quá xa là nghe rõ to/nhỏ hơn video khác. */
const LUFS_QUIET = -20;
const LUFS_LOUD = -11;
const PEAK_MAX = -1;
/** Dòng phụ đề dài hơn thế thì trên khung dọc thành 3 dòng, che hình (review-video.md). */
const CAPTION_MAX = 42;
/** Tốc độ đọc: phụ đề chạy theo giọng nên người xem vừa nghe vừa đọc — quá 22 ký tự mỗi giây mới là đọc không kịp. */
const READ_CPS = 22;

const videoDir = (slug: string) => path.join(process.cwd(), "videos", slug);
const mp4Path = (slug: string) => path.join(process.cwd(), "out", `${slug}.mp4`);
const qaPath = (slug: string) => path.join(videoDir(slug), "qa.json");

const readJson = (file: string) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

type Place = { x?: number; y?: number; size?: number; width?: number };
type Caption = { text: string; startMs: number; endMs: number; track?: number; style?: Place | null };
type TextOverlay = { text: string; y?: number; size?: number; maxWidth?: number };
type Props = {
  aspect?: string;
  captions?: Caption[];
  captionLook?: Place | null;
  texts?: TextOverlay[];
  music?: string | null;
  voiceoverTrack?: string | null;
};

const probe = async (file: string) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", file,
  ]);
  const info = JSON.parse(stdout) as { streams?: { codec_type?: string }[]; format?: { duration?: string } };
  const types = new Set((info.streams ?? []).map((s) => s.codec_type));
  return { video: types.has("video"), audio: types.has("audio"), seconds: Number(info.format?.duration) || 0 };
};

/** Một lượt ffmpeg: loudness, khoảng lặng, màn đen. Kết quả nằm trong stderr. */
const measure = async (file: string, hasAudio: boolean) => {
  const graph = [
    hasAudio ? "[0:a]ebur128=peak=true:framelog=quiet,silencedetect=n=-45dB:d=2[a]" : null,
    "[0:v]scale=320:-2,blackdetect=d=0.5:pix_th=0.10[v]",
  ].filter(Boolean).join(";");
  const args = ["-hide_banner", "-nostats", "-i", file, "-filter_complex", graph];
  if (hasAudio) args.push("-map", "[a]", "-f", "null", "-");
  args.push("-map", "[v]", "-f", "null", "-");
  const { stderr } = await run("ffmpeg", args, { maxBuffer: 32 * 1024 * 1024 });
  const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
  const num = (re: RegExp, text: string) => {
    const m = re.exec(text);
    return m ? Number(m[1]) : null;
  };
  const silences: { start: number; end: number }[] = [];
  const starts = [...stderr.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  starts.forEach((start, i) => silences.push({ start: Math.max(0, start), end: ends[i] ?? Infinity }));
  const blacks = [...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)]
    .map((m) => ({ start: Number(m[1]), end: Number(m[2]) }));
  return {
    lufs: hasAudio ? num(/I:\s+(-?[\d.]+) LUFS/, summary) : null,
    peak: hasAudio ? num(/Peak:\s+(-?[\d.]+|-inf) dBFS/, summary) : null,
    silences,
    blacks,
  };
};

const fmt = (s: number) => `${s.toFixed(1)}s`;

/**
 * Chữ người dùng tự đặt vị trí (phụ đề kéo chỗ khác, kiểu riêng từng câu, chữ tự do) mà lấn vào vùng nền tảng che:
 * đỉnh (avatar, tên nhạc) và đáy (caption của nền tảng, nút thích/chia sẻ) — src/aspects.ts. Đọc thẳng vị trí trong
 * props thay vì đo pixel: đo pixel thì ảnh nền sáng cũng bị tính là "có chữ". Phong cách mặc định đã canh sẵn vùng
 * an toàn nên chỉ xét chỗ có toạ độ chỉnh tay.
 */
const unsafePlacements = (props: Props) => {
  const aspect = ASPECTS[(props.aspect as AspectId) ?? DEFAULT_ASPECT] ?? ASPECTS[DEFAULT_ASPECT];
  const { width: W, height: H, safe } = aspect;
  const scale = Math.min(W, H) / 1080;
  /** Khối chữ cao bao nhiêu px: số dòng ước theo bề rộng chữ trung bình ~0,55 cỡ chữ. */
  const block = (text: string, size: number, widthPct: number) => {
    const px = size * scale;
    const perLine = Math.max(1, Math.floor((widthPct / 100) * W / (px * 0.55)));
    const lines = text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
    return lines * px * 1.2;
  };
  // Vị trí phụ đề mặc định (captionLook y 80%) nằm sát mép vùng che — dung sai ~2,5% chiều cao để chỉ báo chỗ lấn rõ.
  const tolerance = 48;
  const offends = (yPct: number, height: number) => {
    const center = (yPct / 100) * H;
    return center - height / 2 < safe.top - tolerance ? "top" : center + height / 2 > H - safe.bottom + tolerance ? "bottom" : null;
  };
  const found: string[] = [];
  const look = props.captionLook;
  const lines = (props.captions ?? []).filter((c) => c.text.trim());
  if (look?.y !== undefined) {
    const longest = lines.reduce((a, c) => (c.text.length > a.length ? c.text : a), "");
    const where = offends(look.y, block(longest, look.size ?? 72, look.width ?? 80));
    if (where) found.push(`phụ đề đặt ${where === "top" ? "quá cao" : "quá thấp"} (y ${look.y}%)`);
  }
  const ownStyle = lines.filter((c) => c.style?.y !== undefined && offends(c.style.y!, block(c.text, c.style.size ?? look?.size ?? 72, c.style.width ?? look?.width ?? 80)));
  if (ownStyle.length) found.push(`${ownStyle.length} câu phụ đề có vị trí riêng lấn vùng che (vd. “${ownStyle[0].text.slice(0, 40)}”)`);
  const texts = (props.texts ?? []).filter((t) => t.text.trim() && offends(t.y ?? 30, block(t.text, t.size ?? 72, t.maxWidth ?? 80)));
  if (texts.length) found.push(`${texts.length} chữ tự do lấn vùng che (vd. “${texts[0].text.replace(/\s+/g, " ").slice(0, 40)}”)`);
  return found;
};

export const checkVideo = async (slug: string): Promise<QaResult> => {
  const file = mp4Path(slug);
  if (!fs.existsSync(file)) throw new Error("Video chưa render nên chưa soát được.");
  const props = (readJson(path.join(videoDir(slug), "props.json")) ?? {}) as Props;
  const issues: QaIssue[] = [];
  const error = (text: string) => issues.push({ level: "error", text });
  const warn = (text: string) => issues.push({ level: "warn", text });

  const info = await probe(file);
  if (!info.video) error("File không có hình — render hỏng, dựng lại video này.");
  const captions = (props.captions ?? []).filter((c) => c.text.trim() && !c.track);
  const voiced = Boolean(props.voiceoverTrack) || (props.captions ?? []).some((c) => (c as { audio?: string | null }).audio);
  if (!info.audio && (voiced || props.music)) error("File không có tiếng dù video có giọng đọc hoặc nhạc — render lại.");

  const [w, h] = String(props.aspect ?? "9:16").split(":").map(Number);
  const vertical = !(w > h);
  if (vertical && info.seconds > 180) error(`Dài ${fmt(info.seconds)} — TikTok, Reels, Shorts đều không nhận video dọc quá 3 phút.`);
  else if (vertical && info.seconds > 61) warn(`Dài ${fmt(info.seconds)} — quá 60 giây, YouTube Shorts cũ và nhiều kệ Reels không xếp vào mục video ngắn.`);

  const m = info.video ? await measure(file, info.audio) : { lufs: null, peak: null, silences: [], blacks: [] };
  if (m.lufs !== null && Number.isFinite(m.lufs)) {
    if (m.lufs < LUFS_QUIET) warn(`Âm lượng nhỏ (${m.lufs} LUFS) — nghe nhỏ hơn hẳn video khác trên bảng tin; nên khoảng -14 đến -16.`);
    else if (m.lufs > LUFS_LOUD) warn(`Âm lượng quá to (${m.lufs} LUFS) — nền tảng sẽ tự hạ, dễ méo; nên khoảng -14 đến -16.`);
  }
  if (m.peak !== null && m.peak > PEAK_MAX) warn(`Đỉnh âm ${m.peak} dBFS — sát ngưỡng méo tiếng (nên dưới ${PEAK_MAX}).`);

  // Chỉ soát khoảng lặng khi video có tiếng thật — video chỉ có chữ thì im lặng là cố ý.
  if (voiced || props.music) {
    const gaps = m.silences.filter((s) => s.start > 0.3 && Math.min(s.end, info.seconds) < info.seconds - 1.5);
    if (gaps.length) {
      warn(`${gaps.length} khoảng im lặng từ 2 giây trở lên (${gaps.slice(0, 3).map((g) => `${fmt(g.start)}–${fmt(Math.min(g.end, info.seconds))}`).join(", ")}) — dễ làm người xem lướt đi.`);
    }
  }
  const longBlack = m.blacks.filter((b) => b.end - b.start >= 1 || (b.start > 0.2 && b.end < info.seconds - 0.5));
  if (longBlack.length) {
    warn(`Màn hình đen ${longBlack.map((b) => `${fmt(b.start)}–${fmt(b.end)}`).slice(0, 3).join(", ")} — cảnh thiếu ảnh hoặc ảnh lỗi.`);
  }

  // ---- phụ đề ----
  if (voiced && captions.length === 0) warn("Có giọng đọc nhưng không có phụ đề — phần lớn người xem tắt tiếng.");
  if ((props.captions ?? []).some((c) => c.text.includes("\uFFFD"))) error("Phụ đề có ký tự lỗi (�) — sai mã chữ, sửa lại câu đó.");
  const long = captions.filter((c) => c.text.length > CAPTION_MAX);
  if (long.length) warn(`${long.length} dòng phụ đề dài hơn ${CAPTION_MAX} ký tự — chiếm 3 dòng, che hình. Ví dụ: “${long[0].text.slice(0, 60)}”`);
  const fast = captions.filter((c) => c.endMs > c.startMs && c.text.length / ((c.endMs - c.startMs) / 1000) > READ_CPS && c.text.length > 12);
  if (fast.length) warn(`${fast.length} dòng phụ đề hiện quá nhanh, đọc không kịp. Ví dụ: “${fast[0].text.slice(0, 60)}”`);
  const unsafe = unsafePlacements(props);
  if (unsafe.length) {
    warn(`Chữ nằm trong vùng TikTok/Reels che (tên kênh ở đỉnh, nút và caption ở đáy): ${unsafe.join("; ")} — kéo vào giữa trong trình chỉnh sửa.`);
  }
  const first = captions[0];
  if (first && first.startMs > 3000) warn(`Câu đầu tiên tới giây ${fmt(first.startMs / 1000)} mới xuất hiện — 3 giây đầu quyết định người xem có ở lại.`);

  const errors = issues.filter((i) => i.level === "error").length;
  const warns = issues.length - errors;
  const result: QaResult = {
    score: Math.max(0, 10 - errors * 3 - warns),
    issues,
    stats: { seconds: Math.round(info.seconds * 10) / 10, lufs: m.lufs, peak: m.peak },
    checkedAt: Date.now(),
    source: Math.round(fs.statSync(file).mtimeMs),
  };
  fs.writeFileSync(qaPath(slug), JSON.stringify(result, null, 2));
  return result;
};

/** Kết quả soát đã lưu, nếu còn khớp bản mp4 hiện tại (render lại sau đó thì null). */
export const savedCheck = (slug: string): QaResult | null => {
  const saved = readJson(qaPath(slug)) as QaResult | null;
  if (!saved || !fs.existsSync(mp4Path(slug))) return null;
  return saved.source === Math.round(fs.statSync(mp4Path(slug)).mtimeMs) ? saved : null;
};
