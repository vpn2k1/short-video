/**
 * Ảnh bìa cho video đã làm: composition "Cover" (src/compositions/Cover) với tiêu đề, phụ đề phụ, tên kênh,
 * màu nhấn của chính video, nền là hình cảnh đầu tiên.
 *
 *   await makeCover("slug")  →  "/out/covers/slug.jpg"
 *
 * Cảnh đầu là clip (video AI, clip Pexels, video tải lên) thì cắt một khung ở giây thứ 1 của CHÍNH clip đó —
 * không cắt từ mp4 đã render vì khung đó dính phụ đề và thẻ tiêu đề.
 */
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { renderCover } from "./render";

const run = promisify(execFile);

const videoDir = (slug: string) => path.join(process.cwd(), "videos", slug);
const mp4Path = (slug: string) => path.join(process.cwd(), "out", `${slug}.mp4`);
/** Ba bố cục bìa (src/compositions/Cover) — "bottom" là bìa chính, giữ tên file cũ <slug>.jpg. */
export const COVER_LAYOUTS = ["bottom", "center", "band"] as const;
export type CoverLayout = (typeof COVER_LAYOUTS)[number];
const coverName = (slug: string, layout: CoverLayout) => (layout === "bottom" ? `${slug}.jpg` : `${slug}-${layout}.jpg`);
export const coverPath = (slug: string, layout: CoverLayout = "bottom") => path.join(process.cwd(), "out", "covers", coverName(slug, layout));

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

const readJson = (file: string) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

type Media = { image?: string | null; src?: string; startMs?: number };

/**
 * Ảnh nền cho bìa, tính từ public/: ảnh xuất hiện sớm nhất, hoặc một khung cắt từ clip sớm nhất.
 * Xét cả lớp chồng (overlays) — video làm trong trình chỉnh sửa để ảnh/clip ở đó, cảnh nền thì trống.
 */
const backgroundFor = async (slug: string, scenes: Media[], overlays: Media[]) => {
  const media = [...scenes.map((s) => ({ path: s.image, at: s.startMs ?? 0 })), ...overlays.map((o) => ({ path: o.src, at: o.startMs ?? 0 }))]
    .filter((m): m is { path: string; at: number } => Boolean(m.path))
    .sort((a, b) => a.at - b.at)
    .map((m) => m.path);
  const still = media.find((m) => IMAGE_RE.test(m) && fs.existsSync(path.join(process.cwd(), "public", m)));
  if (still) return still;
  const clip = media.find((m) => VIDEO_RE.test(m) && fs.existsSync(path.join(process.cwd(), "public", m)));
  if (!clip) return null;
  const rel = path.posix.join("thumbs", `cover-bg-${slug}.jpg`);
  const abs = path.join(process.cwd(), "public", rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  try {
    await run("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", path.join(process.cwd(), "public", clip), "-frames:v", "1", "-q:v", "2", abs]);
    return fs.existsSync(abs) ? rel : null;
  } catch {
    return null;
  }
};

export const makeCover = async (slug: string, layout: CoverLayout = "bottom") => {
  const props = readJson(path.join(videoDir(slug), "props.json"));
  const script = readJson(path.join(videoDir(slug), "script.json"));
  if (!props && !script) throw new Error("Video này chưa có dữ liệu để làm ảnh bìa.");
  const source = props ?? script;
  const image = await backgroundFor(slug, (props?.scenes ?? script?.scenes ?? []) as Media[], (props?.overlays ?? []) as Media[]);
  const out = coverPath(slug, layout);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await renderCover({
    title: String(source.title ?? slug).trim() || slug,
    subtitle: String(source.subtitle ?? "").trim(),
    handle: String(source.handle ?? "").trim(),
    accent: /^#[0-9a-f]{6}$/i.test(source.accent ?? "") ? source.accent : "#e8590c",
    background: /^#[0-9a-f]{6}$/i.test(source.background ?? "") ? source.background : "#0b0b12",
    image,
    aspect: String(props?.aspect ?? "9:16"),
    layout,
  }, out);
  return `/out/covers/${coverName(slug, layout)}?t=${Math.round(fs.statSync(out).mtimeMs)}`;
};

/** Bìa đã có và còn mới hơn bản mp4 hiện tại (sửa lời, đổi tiêu đề rồi dựng lại thì phải làm lại bìa). */
export const freshCover = (slug: string, layout: CoverLayout = "bottom") => {
  const out = coverPath(slug, layout);
  if (!fs.existsSync(out)) return null;
  const mp4 = mp4Path(slug);
  const coverTime = fs.statSync(out).mtimeMs;
  if (fs.existsSync(mp4) && fs.statSync(mp4).mtimeMs > coverTime) return null;
  return `/out/covers/${coverName(slug, layout)}?t=${Math.round(coverTime)}`;
};

/** Mọi bố cục bìa còn mới của một video: [{ layout, url }]. */
export const freshCovers = (slug: string) =>
  COVER_LAYOUTS.map((layout) => ({ layout, url: freshCover(slug, layout) })).filter((c): c is { layout: CoverLayout; url: string } => Boolean(c.url));
