/**
 * Chế độ chat: mỗi video là một cuộc hội thoại. Tin nhắn đầu tạo video, các tin
 * sau sửa lại — mỗi lượt chạy trọn pipeline kịch bản → giọng → render.
 *
 * Lưu ở videos/<slug>/chat.json cạnh script.json để mở lại vẫn thấy lịch sử.
 */
import fs from "fs";
import path from "path";
import {
  allLines, lineDurationMs, MAX_SCRIPT_SCENES, parseScript, pauseAfterLine, scriptToProps, videoScriptSchema,
  type VideoScript, type VoiceoverClip,
} from "../src/compositions/Short/script";
import { shortSchema, type Scene, type ShortProps } from "../src/compositions/Short/schema";
import { ASPECT_IDS, ASPECTS, type AspectId } from "../src/aspects";
import { generateAiVideo, isVideoModelChoice, videoModelCatalog } from "../scripts/ai-video";
import { TITLE_FRAMES } from "../src/constants";
import { continueScript, editScript, generateScript, PAID_SCRIPT_PROVIDERS, seriesBaseTitle, isScriptProvider, providerLabel, scriptProvider, type ProviderChoice, type ScriptProvider, type StyleChoice } from "../scripts/generate-script";
import { SECONDS_PER_LINE, isLengthChoice, type LengthChoice } from "../scripts/video-length";
import { isHookChoice } from "../scripts/hook-library";
import { moveToAppTrash } from "./app-trash";
import { FREE_MEDIA_GROUP } from "./keys";
import { isStyleId, MUSIC_STYLES, randomStyle, RANDOM_STYLE, STYLES, type StyleId } from "../src/styles/meta";
import { guessStyle, textToScript } from "../scripts/text-script";
import { reviewScript } from "../scripts/review-script";
import { ENGINE_LABELS, generateVoiceover, missingEngineKey } from "../scripts/tts";
import { AUTO_VOICE, findVoice, resolveVoice } from "../scripts/voices";
import { isVideoLanguage, type VideoLanguage } from "../src/i18n/video";
import { freeMode } from "../scripts/usage";
import {
  RANDOM_MUSIC, chooseStockForScene, downloadStockChoice, prefetchStockForScene, randomFreesoundMusic, type StockChoice,
} from "../scripts/stock";
import { mapLimit } from "../scripts/concurrency";
import { alignLyrics, lyricLines, LYRICS_MIN_LINES } from "../scripts/lyrics-align";
import { captionScenes, extractTrack, isAudioFile, isVideoFile, transcribeCached } from "./audio-video";
import { listAudio } from "./api";
import { cloudflareImageAvailable } from "../scripts/cloudflare-image";
import { ART_STYLES, composeImagePrompt, imageLookFor, isArtStyle, writeImagePrompts, writeStockQueries, type StockPlan, type ArtStyle } from "../scripts/image-prompts";
import { renderScene, renderShort } from "../scripts/render";
import { assertImagesExist } from "../scripts/images";
import { slugify } from "../scripts/slug";
import { startJob } from "./jobs";
import { runRenderStage } from "./pipeline";
import { applyVoice } from "./editor/ops";
import { execFile } from "child_process";
import { promisify } from "util";
import { transcribeSentences } from "../scripts/transcribe";
import { alignCaptions, detectSilences } from "../scripts/subtitle-align";
import type { Caption } from "../src/compositions/Short/schema";
import {
  isTranslateEngine, isTranslateLanguage, missingTranslateKey, translateEngineLabel, translateLanguageLabel, translateLines,
  TRANSLATE_ENGINES, type TranslateEngine,
} from "../scripts/translate";
import { fetchSceneImages } from "./api";
import { assertDiskSpace, errorText, RENDER_MIN_FREE } from "./disk";
import {
  assignVersions, latestEditableVersion, versionDraftPath, versionPropsPath, versionVideosDir,
} from "./versions";

export type ChatSettings = {
  /** Tạo video (có giọng + nhạc) hay bộ ảnh tĩnh, mỗi cảnh một ảnh. */
  kind: "video" | "image";
  /** Phong cách hình ảnh, "auto" = AI chọn theo nội dung, "random" = mỗi video mới bốc thăm một phong cách. */
  style: StyleChoice | typeof RANDOM_STYLE;
  /** "ai" = AI viết kịch bản từ ý tưởng; "text" = dùng nguyên văn kịch bản dán vào, không cần key. */
  mode: "ai" | "text";
  aspect: string;
  /** key trong VOICES, "" = không giọng. */
  voice: string;
  music: string | null;
  /** Hình của cảnh: "" = ảnh như cũ; "auto" hoặc key model = tạo clip AI cho từng cảnh. */
  video: string;
  /** AI viết kịch bản cho video này: "auto" = theo Cài đặt, hoặc một nhà cung cấp cụ thể. */
  provider: ProviderChoice;
  /** Hình cho cảnh chưa có ảnh: không hình / thư viện / tìm Pexels / AI vẽ. */
  images: ImageSource;
  /** Kiểu vẽ khi AI vẽ ảnh hoặc tạo clip (3D, hoạt hình…): "auto" = theo phong cách video. */
  art: ArtStyle;
  /** Độ dài AI viết: "auto" = đọc từ prompt (không nêu thì video ngắn), "free" = không giới hạn, còn lại là số giây. */
  length: LengthChoice;
  /** Công thức câu mở đầu (scripts/hook-library.ts): "auto" = AI chọn kiểu theo nội dung, hoặc id một mẫu. */
  hook: string;
  /** Ảnh/clip ghim vào câu mở đầu (đường dẫn trong public/); "" = để AI chọn hình như các cảnh khác. */
  hookMedia: string;
  /** Ngôn ngữ nội dung video: lời AI viết, giọng đọc, chữ in sẵn trong khung phong cách (src/i18n/video.tsx). */
  language: VideoLanguage;
};

/**
 * Nguồn hình của cảnh:
 *  - "none": không hình — video chỉ có chữ trên nền màu.
 *  - "library": ảnh trong thư viện hoặc file bạn tải lên (AI chọn trong danh sách).
 *  - "pexels": ảnh thật miễn phí từ Pexels/Pixabay (cần một trong hai key; giữ tên cũ cho dữ liệu đã lưu).
 *  - "stock-video": clip video thật miễn phí từ Pexels/Pixabay cho từng cảnh.
 *  - "ai": Gemini vẽ ảnh cho từng cảnh (cần GEMINI_API_KEY, tính tiền theo ảnh).
 */
export type ImageSource = "none" | "library" | "pexels" | "stock-video" | "ai";

const isImageSource = (value: unknown): value is ImageSource =>
  value === "none" || value === "library" || value === "pexels" || value === "stock-video" || value === "ai";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  at: number;
  attachments?: string[];
  mp4?: string;
  images?: string[];
  aspect?: string;
  style?: string;
  scenes?: { lines: string[]; image: string | null }[];
  error?: boolean;
  /** Số bản (xem server/versions.ts) — mỗi kết quả video một bản, giữ riêng video và props. */
  version?: number;
  /** Kết quả cũ từ trước khi có bản: video đã bị bản sau ghi đè, không xem/sửa lại được. */
  stale?: boolean;
  /** Xuất từ trình chỉnh sửa; `from` = bản được mở ra để sửa (null = dự án chưa từng xuất). */
  edited?: boolean;
  from?: number | null;
  /** Lượt bị dừng giữa chừng vì server tắt (đóng app, mất điện) — không phải lỗi của pipeline. */
  interrupted?: boolean;
  /** Việc gì bị dừng: lượt chat, video nhiều cảnh hay lần xuất từ trình chỉnh sửa — giao diện chọn nút chạy lại. */
  interruptedKind?: "turn" | "multi" | "render";
};

/** Lời đang gõ mà chưa gửi — lưu trên đĩa để tắt app, mất điện hay mất kết nối vẫn còn. */
export type ChatDraft = { text: string; attachments: string[]; at: number };

/** Video làm tiếp từ video khác (nút "Làm tiếp"): `from` = phần ngay trước, `part` = số phần của video này. */
export type ChatSeries = { from: string; part: number };

/**
 * `draft` bỏ trống khi ghi = giữ bản nháp đang có trên đĩa; `null` = xoá bản nháp.
 * `series` bỏ trống khi ghi = giữ nguyên như trên đĩa.
 */
type Chat = { messages: ChatMessage[]; settings: ChatSettings; draft?: ChatDraft | null; series?: ChatSeries | null };

/**
 * Nhạc nền hợp lệ: file trong public/music, hoặc public/music/stock (tải từ 🆓 Kho free / Freesound) —
 * đúng các thư mục listAudio liệt kê. Không nhận đường dẫn khác để khỏi trỏ ra ngoài thư mục nhạc.
 */
const isMusicPath = (value: unknown): value is string =>
  typeof value === "string" && (value === RANDOM_MUSIC || /^music\/(stock\/)?[\w.-]+$/.test(value));

/**
 * Đổi lựa chọn nhạc nền thành file thật lúc dựng video. "🎲 Nhạc ngẫu nhiên": bốc một bản trên Freesound (cần key);
 * Freesound lỗi/không có key thì bốc một bản trong thư viện nhạc — không để video hỏng vì thiếu nhạc.
 * Cài đặt vẫn giữ "random" nên lần dựng sau lại ra bản khác; props.json lưu đúng file đã dùng.
 */
export const resolveMusicChoice = async (music: string | null, log: (line: string) => void) => {
  if (music !== RANDOM_MUSIC) return music;
  const fromFreesound = await randomFreesoundMusic(log);
  if (fromFreesound) return fromFreesound.path;
  const library = listAudio().music.filter((m) => !/placeholder/i.test(m.name));
  if (library.length === 0) {
    log("🎲 Không lấy được nhạc ngẫu nhiên — video không có nhạc nền.");
    return null;
  }
  const track = library[Math.floor(Math.random() * library.length)];
  log(`🎲 Nhạc ngẫu nhiên (thư viện): ${track.name}`);
  return track.path;
};

export const DEFAULT_SETTINGS: ChatSettings = { kind: "video", style: "auto", mode: "ai", aspect: "9:16", voice: AUTO_VOICE, music: null, video: "", provider: "auto", images: "library", art: "auto", length: "auto", hook: "auto", hookMedia: "", language: "vi" };

/** Ảnh đã dựng của một video: out/scenes/<slug>-<cảnh>.png, theo thứ tự cảnh. */
const sceneImages = (slug: string) => {
  const dir = path.join(process.cwd(), "out", "scenes");
  if (!fs.existsSync(dir)) return [];
  const pattern = new RegExp(`^${slug}-(\\d+)\\.png$`);
  return fs
    .readdirSync(dir)
    .map((name) => ({ name, match: name.match(pattern) }))
    .filter((x) => x.match)
    .sort((a, b) => Number(a.match![1]) - Number(b.match![1]))
    .map(({ name }) =>
      `/out/scenes/${name}?t=${Math.round(fs.statSync(path.join(dir, name)).mtimeMs)}`);
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Đường dẫn file đính kèm, tính từ public/. Không cho ../ */
const MEDIA_RE = /^(uploads|images|videos)\/[\w./-]+\.(jpe?g|png|webp|avif|mp4|mov|webm)$/i;
/** File đính kèm ở ô tạo video: ảnh, video, hoặc âm thanh (dựng video từ chính file đó — buildFromAudio). */
const ATTACHMENT_RE = /^(uploads|images|videos)\/[\w./-]+\.(jpe?g|png|webp|avif|mp4|mov|webm|mp3|wav|m4a|aac|ogg)$/i;

export const isSlug = (value: unknown): value is string =>
  typeof value === "string" && SLUG_RE.test(value);

const videoDir = (slug: string) => path.join(process.cwd(), "videos", slug);
const chatPath = (slug: string) => path.join(videoDir(slug), "chat.json");

/** slug → jobId của lượt đang chạy. Một video chỉ chạy một lượt một lúc. */
const running = new Map<string, string>();

/**
 * `running` chỉ sống trong bộ nhớ. Server tắt ngang (đóng app, mất điện) thì không ai biết lượt đó
 * chưa xong — nên ghi thêm một file đánh dấu, xong việc mới xoá. Lần sau đọc video mà còn file này
 * (và tiến trình ghi nó không còn chạy) nghĩa là lượt đó đã bị gián đoạn.
 */
type RunKind = "turn" | "multi" | "render" | "subtitles" | "voice";
const runMarkerPath = (slug: string) => path.join(videoDir(slug), ".running.json");

/** Loại việc + lúc bắt đầu của lượt đang chạy — cho ô Tiến trình (server/activity.ts). */
const runningMeta = new Map<string, { jobId: string; kind: RunKind; startedAt: number }>();

export type FinishedRun = { slug: string; jobId: string; kind: RunKind; startedAt: number; finishedAt: number };
/**
 * Lượt vừa xong (mới nhất trước, giữ 30 phút / 30 lượt): ô Tiến trình báo xong/lỗi cả khi người dùng đang ở
 * video khác, hay mở trang sau khi lượt đã xong.
 */
const finishedRuns: FinishedRun[] = [];
const FINISHED_KEEP_MS = 30 * 60_000;

/** Mọi lượt đang chạy và vừa xong trong server này. */
export const runActivity = () => {
  const cutoff = Date.now() - FINISHED_KEEP_MS;
  while (finishedRuns.length && finishedRuns[finishedRuns.length - 1].finishedAt < cutoff) finishedRuns.pop();
  return {
    running: [...runningMeta].map(([slug, meta]) => ({ slug, ...meta })),
    finished: [...finishedRuns],
  };
};

const markRunning = (slug: string, jobId: string, kind: RunKind) => {
  running.set(slug, jobId);
  runningMeta.set(slug, { jobId, kind, startedAt: Date.now() });
  try {
    fs.mkdirSync(videoDir(slug), { recursive: true });
    fs.writeFileSync(runMarkerPath(slug), JSON.stringify({ kind, pid: process.pid, at: Date.now() }));
  } catch {
    // không ghi được dấu thì chỉ mất khả năng báo gián đoạn, không chặn việc chính
  }
};

const clearRunning = (slug: string) => {
  running.delete(slug);
  const meta = runningMeta.get(slug);
  runningMeta.delete(slug);
  if (meta) {
    finishedRuns.unshift({ slug, ...meta, finishedAt: Date.now() });
    finishedRuns.length = Math.min(finishedRuns.length, 30);
  }
  fs.rmSync(runMarkerPath(slug), { force: true });
};

const processAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: tiến trình còn sống nhưng của người dùng khác.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Lượt tạo/sửa/xuất bị dừng giữa chừng → thêm một tin báo, để người dùng thấy và chạy lại. */
const INTERRUPT_NOTICE: Partial<Record<RunKind, string>> = {
  turn: "Lượt này bị dừng giữa chừng — app bị tắt, mất điện hoặc mất kết nối khi đang xử lý. Lời bạn gửi vẫn còn, bấm ↻ Thử lại để chạy lại.",
  multi: "Video nhiều cảnh bị dừng giữa chừng — app bị tắt hoặc mất điện khi đang dựng. Danh sách cảnh vẫn còn, bấm 🎬 Sửa cảnh rồi tạo lại.",
  render: "Lần xuất video từ trình chỉnh sửa bị dừng giữa chừng — phần chỉnh sửa vẫn còn, mở ✂️ Chỉnh sửa và xuất lại.",
};

/** Lượt của video đang chạy ở một server khác còn sống (bản web và bản desktop dùng chung thư mục). */
const runningElsewhere = (slug: string) => {
  if (running.has(slug) || !fs.existsSync(runMarkerPath(slug))) return false;
  try {
    const { pid } = JSON.parse(fs.readFileSync(runMarkerPath(slug), "utf8")) as { pid?: number };
    return Boolean(pid && pid !== process.pid && processAlive(pid));
  } catch {
    return false;
  }
};

const recoverInterrupted = (slug: string) => {
  if (running.has(slug) || !fs.existsSync(runMarkerPath(slug))) return;
  let marker: { kind?: RunKind; pid?: number } = {};
  try {
    marker = JSON.parse(fs.readFileSync(runMarkerPath(slug), "utf8"));
  } catch {
    // file dở do mất điện đúng lúc ghi — vẫn coi là bị gián đoạn
  }
  // Một server khác (vd. bản web và bản desktop cùng thư mục) vẫn đang chạy lượt này.
  if (marker.pid && marker.pid !== process.pid && processAlive(marker.pid)) return;
  fs.rmSync(runMarkerPath(slug), { force: true });
  const kind = marker.kind ?? "turn";
  const notice = INTERRUPT_NOTICE[kind];
  if (!notice || !fs.existsSync(chatPath(slug))) return;
  const chat = JSON.parse(fs.readFileSync(chatPath(slug), "utf8")) as Chat;
  chat.messages = [...(chat.messages ?? []), {
    role: "assistant", at: Date.now(), error: true, interrupted: true,
    interruptedKind: kind as "turn" | "multi" | "render", text: notice,
  }];
  fs.writeFileSync(chatPath(slug), JSON.stringify(chat, null, 2));
};

/**
 * Chặn tạo trùng khi bấm Gửi nhiều lần: video đã có slug thì `running` lo,
 * nhưng video mới mỗi lần bấm lại sinh slug mới. Nhớ lượt vừa mở trong ít giây,
 * cùng nội dung + file đính kèm thì trả lại đúng video đó thay vì tạo cái nữa.
 */
const NEW_TURN_WINDOW_MS = 15_000;
const recentNew = new Map<string, { slug: string; jobId: string; at: number }>();

const newTurnKey = (prompt: string, attachments: string[]) =>
  `${prompt}\n\u0000${attachments.join("\u0000")}`;

const recentNewTurn = (key: string) => {
  const hit = recentNew.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > NEW_TURN_WINDOW_MS || running.get(hit.slug) !== hit.jobId) {
    recentNew.delete(key);
    return null;
  }
  return hit;
};

export const readChat = (slug: string): Chat & { slug: string; jobId: string | null } => {
  recoverInterrupted(slug);
  let chat: Chat = { messages: [], settings: { ...DEFAULT_SETTINGS }, draft: null, series: null };
  if (fs.existsSync(chatPath(slug))) {
    const raw = JSON.parse(fs.readFileSync(chatPath(slug), "utf8"));
    chat = {
      messages: raw.messages ?? [], settings: { ...DEFAULT_SETTINGS, ...raw.settings }, draft: raw.draft ?? null,
      series: raw.series ?? null,
    };
  } else {
    // Video làm từ trước khi có chat: dựng một tin nhắn từ những gì đang có.
    const props = readJson(path.join(videoDir(slug), "props.json"));
    const mp4 = path.join(process.cwd(), "out", `${slug}.mp4`);
    if (props) {
      chat.settings.aspect = props.aspect ?? chat.settings.aspect;
      chat.settings.music = props.music ?? null;
    }
    if (fs.existsSync(mp4)) {
      chat.messages.push({
        role: "assistant",
        text: `Video có sẵn: "${props?.title ?? slug}"`,
        at: fs.statSync(mp4).mtimeMs,
        mp4: `/out/${slug}.mp4?t=${Math.round(fs.statSync(mp4).mtimeMs)}`,
        aspect: chat.settings.aspect,
      });
    }
  }
  // Video làm trước khi có "bản": đánh số một lần. Đang dựng thì để lượt đó tự ghi, không chen vào.
  if (!running.has(slug) && chat.messages.some((m) => m.mp4 && !m.error && !m.version)) {
    writeChat(slug, chat);
  }
  return { slug, ...chat, jobId: running.get(slug) ?? null };
};

/** Ghi chat.json — kết quả video mới được đánh số bản và lưu riêng ngay tại đây (sửa `messages` tại chỗ). */
export const writeChat = (slug: string, chat: Chat) => {
  fs.mkdirSync(videoDir(slug), { recursive: true });
  assignVersions(slug, chat.messages);
  // Job chạy xong ghi lại chat — đừng xoá lời người dùng gõ dở trong lúc chờ.
  const onDisk = chat.draft === undefined || chat.series === undefined ? readJson(chatPath(slug)) : null;
  const draft = chat.draft === undefined ? onDisk?.draft ?? null : chat.draft;
  const series = chat.series === undefined ? onDisk?.series ?? null : chat.series;
  const { messages, settings } = chat;
  fs.writeFileSync(chatPath(slug), JSON.stringify({ messages, settings, ...(series ? { series } : {}), ...(draft ? { draft } : {}) }, null, 2));
};

const readJson = (file: string) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;

/** Slug chưa dùng, suy từ prompt: "pin-iphone", "pin-iphone-2"… */
export const freshSlug = (prompt: string) => {
  const base = slugify(prompt, 40);
  let slug = base;
  for (let n = 2; fs.existsSync(videoDir(slug)); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
};

/**
 * Dự án tạo thẳng trong trình chỉnh sửa (✂️ Edit video) — không kịch bản, không AI.
 * Mỗi file đính kèm thành một cảnh dài đúng thời lượng (trình duyệt đo và gửi lên).
 */
export const createEditorProject = (body: unknown) => {
  const { title, aspect, media } = (body ?? {}) as { title?: unknown; aspect?: unknown; media?: unknown };
  const name = typeof title === "string" && title.trim() ? title.trim().slice(0, 60) : "Video mới";
  const aspectId = typeof aspect === "string" && ASPECT_IDS.includes(aspect as never) ? aspect : "9:16";
  const items = Array.isArray(media) ? media : [];
  if (items.length > 50) {
    throw new Error("Tối đa 50 file mỗi lần.");
  }

  const frameAspect = ASPECTS[aspectId as AspectId].width / ASPECTS[aspectId as AspectId].height;

  // Mỗi file là MỘT VIDEO trên timeline, nối tiếp nhau ở hàng Video 1. Không có "track chính":
  // video nào cũng dời/thu nhỏ/đè lên nhau được, thu nhỏ hết thì thấy nền đen của khung đã chọn.
  let cursor = 0;
  const overlays = items.map((item) => {
    const file = (item as { path?: unknown })?.path;
    if (typeof file !== "string" || !MEDIA_RE.test(file) || file.includes("..")) {
      throw new Error(`File không hợp lệ: ${String(file)}`);
    }
    if (!fs.existsSync(path.join(process.cwd(), "public", file))) {
      throw new Error(`Không thấy file: ${file}`);
    }
    const raw = Number((item as { durationMs?: unknown }).durationMs);
    const duration = Math.round(Math.min(3_600_000, Math.max(500, Number.isFinite(raw) ? raw : 3000)));
    const video = /\.(mp4|mov|webm)$/i.test(file);
    const overlay = {
      src: file,
      startMs: cursor,
      endMs: cursor + duration,
      trimStartMs: 0,
      volume: video ? 1 : 0,
      track: 0,
      // Phủ kín khung, không cắt hình — thấy trọn clip, chỗ trống là nền đen.
      x: 50, y: 50, width: 100, aspect: Math.round(frameAspect * 1000) / 1000,
      rotate: 0, opacity: 1, radius: 0, fit: "contain" as const,
      crop: null, fadeMs: 0, keyframes: [],
    };
    cursor += duration;
    return overlay;
  });

  // Một cảnh rỗng trải dài cả video: nền đen phía sau mọi video (hàng Cảnh không hiện trong timeline).
  const scenes = [{
    image: null as string | null, visual: null, tag: null, punch: null,
    trimStartMs: 0, volume: 0, startMs: 0, endMs: Math.max(5000, cursor),
  }];

  const props = shortSchema.parse({
    title: name, subtitle: "", accent: "#ff6b2c", background: "#000000",
    captions: [], aspect: aspectId, style: "plain", scenes, overlays,
    captionPosition: "bottom", showTitle: false, voiceoverTrack: null, music: null, sfx: false,
  });

  let slug = freshSlug(name);
  // "new" là đường dẫn màn hình tạo dự án của trình chỉnh sửa.
  if (slug === "new") slug = freshSlug(`${name} video`);
  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(props, null, 2));
  writeChat(slug, {
    messages: [{
      role: "assistant",
      at: Date.now(),
      text: `✂️ “${name}” được tạo trong trình chỉnh sửa (${scenes.length} cảnh). Bấm “Chỉnh sửa” để tiếp tục.`,
    }],
    settings: { ...DEFAULT_SETTINGS, style: "plain", mode: "text", aspect: aspectId },
  });
  return { slug };
};

const runFile = promisify(execFile);

/**
 * Tự tạo phụ đề bằng whisper.cpp từ tiếng của video/âm thanh trên timeline.
 * Mỗi nguồn được cắt đúng phần đang dùng (trimStart + độ dài), phiên âm, rồi dời
 * mốc thời gian về vị trí của nó trên timeline.
 */
export const startAutoSubtitles = (slug: string, body: unknown, requested: number | null = null) => {
  const opts = (body ?? {}) as {
    source?: unknown; index?: unknown; language?: unknown; quality?: unknown; replace?: unknown;
    translate?: { to?: unknown; engine?: unknown; keepOriginal?: unknown } | null;
  };
  const language = opts.language === "en" || opts.language === "auto" ? opts.language : "vi";
  // medium đúng tên riêng tiếng Việt hơn hẳn; small nhanh gấp ~3 lần.
  const model = opts.quality === "fast" ? "small" : "medium";
  const replace = opts.replace !== false;
  // Dịch sau khi phiên âm (tuỳ chọn). Kiểm key trước để khỏi chờ phiên âm xong mới báo thiếu.
  let translate: { to: Parameters<typeof translateLanguageLabel>[0]; engine: Parameters<typeof translateEngineLabel>[0]; keepOriginal: boolean } | null = null;
  if (opts.translate && isTranslateLanguage(opts.translate.to)) {
    if (!isTranslateEngine(opts.translate.engine)) throw new Error("Chọn model dịch.");
    const missing = missingTranslateKey(opts.translate.engine);
    if (missing) throw new Error(`Chưa có key ${missing} để dịch — điền trong ⚙ Cài đặt, hoặc chọn model dịch khác.`);
    translate = { to: opts.translate.to, engine: opts.translate.engine, keepOriginal: opts.translate.keepOriginal === true };
  }
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi xong đã.");
  }
  const { props, version } = readEditorProps(slug, requested);
  const videoFile = (src: string | null) => Boolean(src && /\.(mp4|mov|webm)$/i.test(src));

  // speed: tốc độ phát — đoạn file dùng dài durationMs × speed; thời gian phụ đề ÷ speed để khớp timeline.
  type Segment = { src: string; startMs: number; trimStartMs: number; durationMs: number; speed: number; label: string };
  const segments: Segment[] = [];
  if (opts.source === "scene") {
    const i = Number(opts.index);
    const s = props.scenes[i];
    if (!s || !videoFile(s.image)) throw new Error("Chọn một cảnh là video để tạo phụ đề.");
    segments.push({ src: s.image as string, startMs: s.startMs, trimStartMs: s.trimStartMs, durationMs: s.endMs - s.startMs, speed: s.speed ?? 1, label: `cảnh ${i + 1}` });
  } else if (opts.source === "clip") {
    const i = Number(opts.index);
    const c = props.audioClips[i];
    if (!c) throw new Error("Đoạn âm thanh không tồn tại.");
    segments.push({ src: c.src, startMs: c.startMs, trimStartMs: c.trimStartMs, durationMs: c.durationMs, speed: c.speed ?? 1, label: c.label ?? "âm thanh" });
  } else {
    // Cả video: cảnh video còn tiếng gốc + âm thanh thêm tay (trừ nhạc nền và hiệu ứng).
    props.scenes.forEach((s, i) => {
      if (videoFile(s.image) && s.volume > 0) {
        segments.push({ src: s.image as string, startMs: s.startMs, trimStartMs: s.trimStartMs, durationMs: s.endMs - s.startMs, speed: s.speed ?? 1, label: `cảnh ${i + 1}` });
      }
    });
    (props.overlays ?? []).forEach((o, i) => {
      if (videoFile(o.src) && o.volume > 0) {
        segments.push({ src: o.src, startMs: o.startMs, trimStartMs: o.trimStartMs, durationMs: o.endMs - o.startMs, speed: o.speed ?? 1, label: `lớp video ${i + 1}` });
      }
    });
    props.audioClips.forEach((c) => {
      if (!/^(music|sfx)\//.test(c.src)) {
        segments.push({ src: c.src, startMs: c.startMs, trimStartMs: c.trimStartMs, durationMs: c.durationMs, speed: c.speed ?? 1, label: c.label ?? "âm thanh" });
      }
    });
  }
  if (segments.length === 0) {
    throw new Error("Không có video còn tiếng hoặc âm thanh nào để phiên âm. Chọn riêng một cảnh/đoạn âm thanh rồi thử lại.");
  }

  const job = startJob(async (log) => {
    const tmp = path.join(process.cwd(), "out", ".subtitles");
    fs.mkdirSync(tmp, { recursive: true });
    try {
      let created: Caption[] = [];
      for (const [k, seg] of segments.entries()) {
        log(`Đang phiên âm ${seg.label} (${k + 1}/${segments.length}, model ${model})…`);
        const wav = path.join(tmp, `${Date.now()}-${k}.wav`);
        // Video không có luồng âm thanh làm ffmpeg báo lỗi — coi như không có tiếng.
        await runFile("ffmpeg", [
          "-y", "-v", "error",
          "-ss", (seg.trimStartMs / 1000).toFixed(3), "-t", ((seg.durationMs * seg.speed) / 1000).toFixed(3),
          "-i", path.join(process.cwd(), "public", seg.src),
          "-vn", "-ac", "1", "-ar", "16000", wav,
        ], { maxBuffer: 16 * 1024 * 1024 }).catch(() => undefined);
        // Đoạn lấy nằm ngoài độ dài file (hoặc file không có tiếng) → wav rỗng, bỏ qua.
        if (!fs.existsSync(wav) || fs.statSync(wav).size < 16000) {
          fs.rmSync(wav, { force: true });
          log(`  ${seg.label}: không có tiếng, bỏ qua`);
          continue;
        }
        try {
          // Chữ theo câu từ whisper, mép phụ đề theo khoảng lặng thật của chính đoạn âm thanh này —
          // phụ đề hiện khi bắt đầu nói, tắt khi ngừng. Xem scripts/subtitle-align.ts.
          const sentences = await transcribeSentences({ audioPath: wav, model, language });
          const silences = await detectSilences(wav);
          const lines = alignCaptions(sentences, silences, seg.durationMs * seg.speed)
            .map((line) => ({
              ...line,
              startMs: Math.round(seg.startMs + line.startMs / seg.speed),
              endMs: Math.round(seg.startMs + line.endMs / seg.speed),
            }));
          created.push(...lines);
          log(`  ${seg.label}: ${lines.length} câu`);
        } finally {
          fs.rmSync(wav, { force: true });
        }
      }

      // Dịch giữ nguyên thời gian từng câu, chỉ thay chữ. Giữ bản gốc = song ngữ: gốc một hàng, bản dịch hàng kế trên.
      let original: Caption[] = [];
      if (translate && created.length > 0) {
        log(`Đang dịch ${created.length} câu sang ${translateLanguageLabel(translate.to)} bằng ${translateEngineLabel(translate.engine)}…`);
        const texts = await translateLines(
          created.map((c) => c.text),
          { to: translate.to, from: language === "auto" ? undefined : language, engine: translate.engine },
          log,
        );
        if (translate.keepOriginal) original = created;
        created = created.map((c, k) => ({ ...c, text: texts[k] }));
      }

      const latest = readEditorProps(slug, version).props;
      const keep = replace
        ? latest.captions.filter((c) => !segments.some((seg) => c.startMs < seg.startMs + seg.durationMs && c.endMs > seg.startMs))
        : latest.captions;
      // Phụ đề vừa tạo nằm ở một hàng phụ đề riêng (Phụ đề 2, 3…), không trộn vào hàng đang có.
      // Dồn số các hàng còn lại cho liền nhau trước (lỡ "thay phụ đề cũ" xoá hết một hàng) để timeline không hở hàng.
      const usedTracks = [...new Set(keep.map((c) => c.track ?? 0))].sort((a, b) => a - b);
      const compacted = keep.map((c) => {
        const track = usedTracks.indexOf(c.track ?? 0);
        return { ...c, track: track > 0 ? track : undefined };
      });
      const originalTrack = original.length > 0 ? usedTracks.length : undefined;
      const track = usedTracks.length + (original.length > 0 ? 1 : 0);
      const onTrack = (captions: Caption[], row: number) => captions.map((c) => ({ ...c, track: row > 0 ? row : undefined }));
      const next = shortSchema.parse({
        ...latest,
        captions: [...compacted, ...onTrack(original, originalTrack ?? 0), ...onTrack(created, track)]
          .sort((a, b) => a.startMs - b.startMs),
      });
      writeEditorProps(slug, version, next);
      log(`Xong: ${created.length} câu phụ đề ở hàng Phụ đề ${track + 1}.`);
      return {
        props: next,
        count: created.length,
        track,
        originalTrack,
        translatedTo: translate && created.length > 0 ? translateLanguageLabel(translate.to) : undefined,
      };
    } finally {
      clearRunning(slug);
    }
  });
  markRunning(slug, job.id, "subtitles");
  return { jobId: job.id };
};

/**
 * Trình chỉnh sửa mở bản nào: `requested` nếu có, không thì bản mới nhất. Dự án chưa từng xuất
 * (tạo trong trình chỉnh sửa, chưa có bản) thì sửa thẳng props.json.
 */
const editorVersion = (slug: string, requested: number | null) => {
  const latest = latestEditableVersion(slug, readChat(slug).messages);
  if (requested === null) return { version: latest, latest };
  if (!fs.existsSync(versionPropsPath(slug, requested))) {
    throw new Error(`Bản ${requested} không còn dữ liệu để chỉnh sửa (video làm trước khi app lưu riêng từng bản).`);
  }
  return { version: requested, latest };
};

/** File trình chỉnh sửa đọc/ghi: bản nháp của bản đang mở → props của bản đó → props.json. */
const editorFile = (slug: string, version: number | null) => {
  if (version === null) return path.join(videoDir(slug), "props.json");
  const draft = versionDraftPath(slug, version);
  return fs.existsSync(draft) ? draft : versionPropsPath(slug, version);
};

/** Dữ liệu cho trình chỉnh sửa — props đã điền mặc định cho các trường mới. */
export const readEditorProps = (slug: string, requested: number | null = null) => {
  const { version, latest } = editorVersion(slug, requested);
  const file = editorFile(slug, version);
  if (!fs.existsSync(file)) {
    throw new Error("Video này chưa được dựng — tạo video trước rồi mới chỉnh sửa được.");
  }
  const props = shortSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const script = readJson(path.join(videoDir(slug), "script.json"));
  // Giọng đọc gần nhất của video (lúc tạo, hoặc lần "Đổi giọng toàn bộ" sau cùng) — ô chọn giọng mở ra đúng giọng này.
  // Đọc thẳng chat.json: readChat có ghi lại file, không nên chạy mỗi lần mở trình chỉnh sửa.
  const voice = readJson(chatPath(slug))?.settings?.voice;
  return {
    slug, props, title: script?.title ?? props.title, running: running.has(slug),
    version, latest, hasDraft: version !== null && fs.existsSync(versionDraftPath(slug, version)),
    // "Tự động" → giọng cụ thể máy này đang chọn cho ngôn ngữ của video, để ô chọn giọng có đúng một mục.
    voice: typeof voice === "string" && voice ? resolveVoice(voice, props.language).voice?.key ?? null : null,
  };
};

/** Lưu thay đổi đang sửa: bản đã xuất thì vào bản nháp (bản gốc giữ nguyên), chưa có bản thì props.json. */
export const writeEditorProps = (slug: string, requested: number | null, props: unknown) => {
  const { version } = editorVersion(slug, requested);
  const parsed = shortSchema.parse(props);
  const file = version === null ? path.join(videoDir(slug), "props.json") : versionDraftPath(slug, version);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
  return { version };
};

/** Bỏ mọi thay đổi chưa xuất trên một bản — quay về đúng bản đã xuất. */
export const discardEditorDraft = (slug: string, requested: number | null) => {
  const { version } = editorVersion(slug, requested);
  if (version !== null) fs.rmSync(versionDraftPath(slug, version), { force: true });
  return readEditorProps(slug, version);
};

/** Xuất mp4 từ bản đang sửa thành một BẢN MỚI — bản được mở ra sửa giữ nguyên. */
export const startEditorRender = (slug: string, requested: number | null = null) => {
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi xong đã.");
  }
  const { props, version } = readEditorProps(slug, requested);
  // Kiểm tra ngay lúc bấm xuất — báo trong hộp xuất luôn, không đợi job chạy.
  assertDiskSpace(RENDER_MIN_FREE, "xuất video");
  const job = startJob(async (log) => {
    try {
      // Bản mới nhất = bản vừa xuất: pipeline (đổi giọng, AI sửa tiếp…) đọc props.json.
      fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(props, null, 2));
      log("__STEP__ render");
      const result = await runRenderStage(slug, undefined, log);
      const chat = readChat(slug);
      const message: ChatMessage = {
        role: "assistant",
        at: Date.now(),
        text: `Đã xuất từ trình chỉnh sửa${version !== null ? ` (chỉnh từ bản ${version})` : ""} · ${(result.durationInFrames / 30).toFixed(1)}s`,
        mp4: `${result.mp4}?t=${Date.now()}`,
        aspect: props.aspect ?? "9:16",
        style: props.style,
        edited: true,
        from: version,
      };
      writeChat(slug, { messages: [...chat.messages, message], settings: chat.settings });
      // Thay đổi đã thành bản mới — bản gốc trở lại như lúc xuất. Nhưng xuất có thể chạy nền trong khi người dùng sửa
      // tiếp: bản nháp đã khác lúc bấm xuất thì GIỮ, không thì mất những gì vừa sửa.
      if (version !== null) {
        const draft = versionDraftPath(slug, version);
        const unchanged = (() => {
          try {
            return JSON.stringify(shortSchema.parse(JSON.parse(fs.readFileSync(draft, "utf8")))) === JSON.stringify(props);
          } catch {
            return true;   // không còn bản nháp / đọc lỗi — xoá như cũ
          }
        })();
        if (unchanged) fs.rmSync(draft, { force: true });
      }
      return message;
    } finally {
      clearRunning(slug);
    }
  });
  markRunning(slug, job.id, "render");
  return { jobId: job.id };
};

/**
 * Đổi giọng toàn bộ (index bỏ trống) hoặc đọc lại một câu, từ trình chỉnh sửa.
 * Giữ mốc bắt đầu của từng câu; câu dài ra thì phần phía sau lùi lại (xem ops.applyVoice).
 */
export const startVoiceChange = (slug: string, body: unknown, requested: number | null = null) => {
  const { voice, index } = (body ?? {}) as { voice?: unknown; index?: unknown };
  const chosen = typeof voice === "string" ? findVoice(voice) : undefined;
  if (!chosen) {
    throw new Error("Chọn một giọng đọc hợp lệ.");
  }
  if (missingEngineKey(chosen.engine)) {
    throw new Error(`Giọng này cần API key ${ENGINE_LABELS[chosen.engine]} — điền trong Cài đặt, hoặc chọn giọng miễn phí có sẵn trong máy.`);
  }
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi xong đã.");
  }
  const { props, version } = readEditorProps(slug, requested);
  let indexes: number[];
  if (index === undefined || index === null) {
    indexes = props.captions.map((_, i) => i).filter((i) => props.captions[i].text.trim());
  } else if (typeof index === "number" && Number.isInteger(index) && props.captions[index]?.text.trim()) {
    indexes = [index];
  } else {
    throw new Error("Câu cần đọc không tồn tại hoặc đang trống.");
  }
  if (indexes.length === 0) {
    throw new Error("Chưa có câu phụ đề nào để đọc.");
  }

  const job = startJob(async (log) => {
    try {
      log(`Đang đọc ${indexes.length} câu bằng giọng ${chosen.key}…`);
      // Thư mục mới mỗi lần: không ghi đè file giọng đang dùng — hoàn tác vẫn nghe được bản cũ.
      const clips = await generateVoiceover(
        indexes.map((i) => props.captions[i].text),
        `${slug}/edit-${Date.now()}`,
        chosen.engine,
        chosen.id,
        { log },
      );
      const next = shortSchema.parse(applyVoice(props, indexes, clips));
      writeEditorProps(slug, version, next);
      if (index === undefined || index === null) {
        const chat = readChat(slug);
        writeChat(slug, { messages: chat.messages, settings: { ...chat.settings, voice: chosen.key } });
      }
      log(`Xong: ${clips.length} câu.`);
      return { props: next, voice: chosen.key };
    } finally {
      clearRunning(slug);
    }
  });
  markRunning(slug, job.id, "voice");
  return { jobId: job.id };
};

/** Ảnh tĩnh đầu tiên (không phải video) mà cảnh nào đó đang dùng và file còn tồn tại. */
const firstSceneImage = (
  props: { scenes?: { image?: string | null }[] } | null,
  script: { scenes?: { image?: string | null }[] } | null,
) => {
  const image = [...(props?.scenes ?? []), ...(script?.scenes ?? [])]
    .map((scene) => scene.image)
    .find((file): file is string =>
      typeof file === "string" &&
      !/\.(mp4|mov|webm)$/i.test(file) &&
      !file.includes("..") &&
      fs.existsSync(path.join(process.cwd(), "public", file)));
  return image ? `/public/${image}` : null;
};

/** Danh sách cho thư viện: mọi video, mới nhất trước. */
const dirBytes = (target: string): number => {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.size;
  return fs.readdirSync(target).reduce((sum, name) => sum + dirBytes(path.join(target, name)), 0);
};

/**
 * Mọi file sinh ra riêng cho một video: thư mục dự án, bản render, ảnh/clip từng cảnh,
 * giọng đọc. KHÔNG gồm file người dùng tải lên hay clip AI trong thư viện chung —
 * video khác có thể đang dùng.
 */
const projectFiles = (slug: string) => {
  const files = [videoDir(slug), path.join(process.cwd(), "out", `${slug}.mp4`), versionVideosDir(slug)];
  const scenes = path.join(process.cwd(), "out", "scenes");
  if (fs.existsSync(scenes)) {
    const own = new RegExp(`^${slug}-\\d+\\.(png|mp4)$`);
    files.push(...fs.readdirSync(scenes).filter((n) => own.test(n)).map((n) => path.join(scenes, n)));
  }
  const voices = path.join(process.cwd(), "public", "voices");
  if (fs.existsSync(voices)) {
    // voices/<slug> và các bản cũ voices/<slug>-<8 hex>; bỏ qua tên trùng một video khác.
    const own = new RegExp(`^${slug}(-[0-9a-f]{8})?$`);
    files.push(
      ...fs.readdirSync(voices)
        .filter((n) => own.test(n) && (n === slug || !fs.existsSync(videoDir(n))))
        .map((n) => path.join(voices, n)),
    );
  }
  return files.filter((f) => fs.existsSync(f));
};

/**
 * Chuyển các video đã chọn vào Thùng rác của app (Thư viện › 🗑 Thùng rác) — khôi phục được, không xoá hẳn.
 * Mỗi video là một mục: dời trọn hoặc không dời gì (file bị khoá trên Windows thì bỏ qua cả video).
 * Video đang dựng thì bỏ qua.
 */
export const deleteProjects = (value: unknown) => {
  const slugs = Array.isArray(value) ? [...new Set(value)] : [];
  if (slugs.length === 0 || slugs.length > 500 || !slugs.every(isSlug)) {
    throw new Error("Danh sách video cần xoá không hợp lệ.");
  }
  const deleted: string[] = [];
  const trashIds: string[] = [];
  const skipped: { slug: string; reason: string }[] = [];
  let freedBytes = 0;
  for (const slug of slugs) {
    if (running.has(slug)) {
      skipped.push({ slug, reason: "đang dựng" });
      continue;
    }
    const files = projectFiles(slug);
    if (files.length === 0) {
      skipped.push({ slug, reason: "không tồn tại" });
      continue;
    }
    const props = readJson(path.join(videoDir(slug), "props.json"));
    const script = readJson(path.join(videoDir(slug), "script.json"));
    try {
      const entry = moveToAppTrash(files, {
        kind: "video",
        title: script?.title ?? props?.title ?? slug,
        slug,
        preview: firstSceneImage(props, script),
      });
      freedBytes += entry.bytes;
      deleted.push(slug);
      trashIds.push(entry.id);
    } catch (error) {
      skipped.push({ slug, reason: `không chuyển được (${(error as NodeJS.ErrnoException).code ?? (error as Error).message})` });
    }
  }
  return { deleted, skipped, freedBytes, trashIds };
};

export const listProjects = () => {
  const root = path.join(process.cwd(), "videos");
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SLUG_RE.test(e.name))
    .map((e) => {
      const slug = e.name;
      recoverInterrupted(slug);
      const props = readJson(path.join(videoDir(slug), "props.json"));
      const script = readJson(path.join(videoDir(slug), "script.json"));
      const chatFile = readJson(chatPath(slug));
      const settings = chatFile?.settings;
      const turns: ChatMessage[] = chatFile?.messages ?? [];
      const kind = settings?.kind === "image" ? "image" : "video";
      const images = sceneImages(slug);
      const mp4 = path.join(process.cwd(), "out", `${slug}.mp4`);
      const hasMp4 = fs.existsSync(mp4);
      const video = hasMp4 ? `/out/${slug}.mp4?t=${Math.round(fs.statSync(mp4).mtimeMs)}` : null;
      const updated = Math.max(
        hasMp4 ? fs.statSync(mp4).mtimeMs : 0,
        fs.statSync(videoDir(slug)).mtimeMs,
        // Tin nhắn mới (kể cả lượt lỗi) cũng tính là vừa làm — đẩy lên đầu lịch sử.
        fs.existsSync(chatPath(slug)) ? fs.statSync(chatPath(slug)).mtimeMs : 0,
      );
      const lastReply = [...turns].reverse().find((m) => m.role === "assistant");
      const multiInput = readJson(multiPath(slug)) as { title?: unknown } | null;
      const draft = chatFile?.draft as ChatDraft | null | undefined;
      const firstUser = turns.find((m) => m.role === "user")?.text;
      const status = running.has(slug) || runningElsewhere(slug)
        ? "running"
        : lastReply?.interrupted && turns.at(-1) === lastReply
          ? "interrupted"
          : lastReply?.error
            ? "error"
            : hasMp4 || images.length > 0
              ? "done"
              : "draft";
      return {
        slug,
        title: script?.title ?? props?.title ??
          (typeof multiInput?.title === "string" && multiInput.title.trim() ? multiInput.title.trim() : null) ??
          (firstUser ?? draft?.text)?.replace(/\s+/g, " ").trim().slice(0, 60) ?? slug,
        aspect: settings?.aspect ?? props?.aspect ?? "9:16",
        kind,
        style: isStyleId(props?.style) ? props.style : isStyleId(script?.style) ? script.style : "caption",
        mp4: video,
        /** Thứ hiện trên thẻ thư viện: ảnh đầu (chế độ ảnh) hoặc video. */
        cover: kind === "image" ? images[0] ?? null : video,
        /** Ảnh cảnh đầu — làm bìa thẻ thư viện, hiện ngay mà không phải tải video. */
        thumb: firstSceneImage(props, script),
        images: images.length,
        running: running.has(slug),
        /** "running" | "interrupted" | "error" | "done" | "draft" — cho thanh lịch sử. */
        status,
        /** Có lời gõ dở chưa gửi. */
        hasDraft: Boolean(draft?.text || draft?.attachments?.length),
        /** Có props.json — mở được trình chỉnh sửa. */
        editable: Boolean(props),
        /** Có script.json — nhân được biến thể (đổi tỉ lệ, giọng, ngôn ngữ) trong chế độ hàng loạt. */
        scripted: Boolean(script),
        /** Tạo từ tab 🎬 Nhiều cảnh — mở lại được danh sách cảnh. */
        multi: fs.existsSync(multiPath(slug)),
        /** Làm tiếp từ video khác: { from, part } — giao diện nối các phần với nhau. */
        series: (chatFile?.series ?? null) as ChatSeries | null,
        /** Số lần người dùng nhắn (tạo + sửa). */
        edits: turns.filter((m) => m.role === "user").length,
        /** Dung lượng xoá được (render, ảnh cảnh, giọng đọc, dự án). */
        bytes: projectFiles(slug).reduce((sum, f) => sum + dirBytes(f), 0),
        updated,
      };
    })
    .sort((a, b) => b.updated - a.updated);
};

/**
 * Lọc cài đặt người dùng gửi lên: giá trị nào không hợp lệ thì giữ của `base`.
 * Dùng chung cho chat và cho chế độ hàng loạt để hai nơi không lệch luật nhau.
 */
export const normalizeSettings = (
  patch: Partial<ChatSettings> | undefined,
  base: ChatSettings = DEFAULT_SETTINGS,
): ChatSettings => {
  const s = patch ?? {};
  return {
    kind: s.kind === "image" || s.kind === "video" ? s.kind : base.kind,
    style: s.style === "auto" || s.style === RANDOM_STYLE || isStyleId(s.style) ? s.style : base.style,
    mode: s.mode === "ai" || s.mode === "text" ? s.mode : base.mode,
    aspect: typeof s.aspect === "string" && ASPECT_IDS.includes(s.aspect as never)
      ? s.aspect : base.aspect,
    voice: typeof s.voice === "string" && (s.voice === "" || s.voice === AUTO_VOICE || findVoice(s.voice))
      ? s.voice : base.voice,
    music: isMusicPath(s.music)
      ? s.music : s.music === null ? null : base.music,
    video: typeof s.video === "string" && (s.video === "" || isVideoModelChoice(s.video))
      ? s.video : base.video,
    provider: s.provider === "auto" || isScriptProvider(s.provider) ? s.provider : base.provider,
    images: isImageSource(s.images) ? s.images : base.images,
    // Cuộc chat cũ lưu trước khi có kiểu vẽ thì không có trường này.
    art: isArtStyle(s.art) ? s.art : base.art ?? "auto",
    // Cuộc chat cũ lưu trước khi có ô độ dài thì không có trường này.
    length: isLengthChoice(s.length) ? s.length : base.length ?? "auto",
    // Cuộc chat cũ lưu trước khi có thư viện hook thì không có trường này.
    hook: isHookChoice(s.hook) ? s.hook : base.hook ?? "auto",
    hookMedia: typeof s.hookMedia === "string" && (s.hookMedia === "" || MEDIA_RE.test(s.hookMedia))
      ? s.hookMedia : base.hookMedia ?? "",
    // Cuộc chat cũ lưu trước khi có ô ngôn ngữ thì không có trường này — video cũ đều là tiếng Việt.
    language: isVideoLanguage(s.language) ? s.language : base.language ?? "vi",
  };
};

/** Thiếu key cho lựa chọn đang bật thì báo ngay, trước khi chạy nền. */
export const assertSettingsUsable = (settings: ChatSettings) => {
  if (freeMode()) {
    if (settings.kind === "video" && settings.video) {
      throw new Error("💚 Chế độ Miễn phí đang bật — video AI tính tiền nên đã tắt. Đổi chip Hình về 🖼 Ảnh, hoặc tắt chế độ này trong ⚙ Cài đặt.");
    }
    if (settings.images === "ai" && !cloudflareImageAvailable()) {
      throw new Error("💚 Chế độ Miễn phí đang bật — AI vẽ ảnh bằng Gemini tính tiền. Thêm key Cloudflare (FLUX miễn phí ~100 ảnh/ngày) trong ⚙ Cài đặt, hoặc chọn ảnh/clip miễn phí.");
    }
    if (settings.mode === "ai" && PAID_SCRIPT_PROVIDERS.includes(settings.provider as ScriptProvider)) {
      throw new Error(`💚 Chế độ Miễn phí đang bật — ${providerLabel(settings.provider as ScriptProvider)} tính tiền. Chọn AI "Tự động" (dùng Gemini, Groq, OpenRouter, AI trên máy) hoặc tắt chế độ này trong ⚙ Cài đặt.`);
    }
  }
  if (settings.kind === "video" && settings.video && !videoModelCatalog().defaultModel) {
    throw new Error(
      "Chọn hình Video AI nhưng chưa có key tạo video. Thêm key Gemini, fal.ai hoặc Replicate trong Cài đặt, hoặc đổi chip Hình về 🖼 Ảnh.",
    );
  }
  if ((settings.images === "pexels" || settings.images === "stock-video") && !process.env.PEXELS_API_KEY && !process.env.PIXABAY_API_KEY) {
    throw new Error(
      `Chọn ảnh/clip miễn phí nhưng chưa có key Pexels hoặc Pixabay. Lấy key miễn phí rồi điền vào ⚙ Cài đặt › ${FREE_MEDIA_GROUP}, ` +
        "hoặc đổi nút Hình ảnh sang 🖼 Ảnh của tôi / 🚫 Không hình.",
    );
  }
  if (settings.images === "ai" && !process.env.GEMINI_API_KEY && !cloudflareImageAvailable()) {
    throw new Error(
      "Chọn AI vẽ ảnh nhưng chưa có key Gemini. Điền GEMINI_API_KEY trong ⚙ Cài đặt, hoặc đổi nút Hình ảnh sang " +
        "🔍 Tìm ảnh Pexels / 🖼 Ảnh của tôi.",
    );
  }
  if (settings.mode === "ai" && !scriptProvider(settings.provider)) {
    throw new Error(
      settings.provider !== "auto"
        ? `Chưa có key cho ${providerLabel(settings.provider)} — điền trong Cài đặt, hoặc chọn AI khác ở ô tuỳ chọn.`
        : "Chưa có AI viết kịch bản. Điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí), chọn Ollama để chạy AI ngay trên máy không cần key, hoặc chọn 📝 Lời có sẵn để dán kịch bản.",
    );
  }
};

const MAX_DRAFT_CHARS = 50_000;

/** Video chỉ gồm bản nháp — xoá hết lời thì xoá luôn thư mục, khỏi rác trong lịch sử. */
const onlyDraft = (slug: string) => {
  const dir = videoDir(slug);
  if (!fs.existsSync(dir) || running.has(slug)) return false;
  const files = fs.readdirSync(dir);
  if (files.some((f) => f !== "chat.json" && f !== "multi.json")) return false;
  return (readJson(chatPath(slug))?.messages ?? []).length === 0;
};

/**
 * Lưu lời đang gõ trong ô chat. Chưa có video thì tạo một video nháp (hiện trong lịch sử), gửi đi
 * thì bản nháp thành tin nhắn. Trả slug để giao diện gắn các lần lưu sau và lần gửi vào đúng video đó.
 */
export const saveChatDraft = (body: unknown) => {
  const input = (body ?? {}) as { slug?: unknown; text?: unknown; attachments?: unknown; settings?: Partial<ChatSettings> };
  const text = typeof input.text === "string" ? input.text.slice(0, MAX_DRAFT_CHARS) : "";
  const attachments = (Array.isArray(input.attachments) ? input.attachments : [])
    .filter((f): f is string => typeof f === "string" && ATTACHMENT_RE.test(f) && !f.includes(".."))
    .slice(0, 20);
  const empty = !text.trim() && attachments.length === 0;

  let slug: string;
  if (input.slug === undefined || input.slug === null || input.slug === "") {
    if (empty) return { slug: null };
    // Chỉ đính kèm file âm thanh, chưa gõ gì: đặt tên theo file.
    const audio = attachments.find(isAudioFile);
    slug = freshSlug(text.trim().split("\n")[0] || (audio ? path.basename(audio, path.extname(audio)).replace(/^\d+-/, "") : "ban nhap"));
  } else if (isSlug(input.slug)) {
    slug = input.slug;
  } else {
    throw new Error("Tên video không hợp lệ.");
  }

  if (empty && !fs.existsSync(videoDir(slug))) return { slug: null };
  if (empty && onlyDraft(slug) && !fs.existsSync(multiPath(slug))) {
    fs.rmSync(videoDir(slug), { recursive: true, force: true });
    return { slug: null };
  }
  const chat = readChat(slug);
  writeChat(slug, {
    messages: chat.messages,
    settings: normalizeSettings(input.settings, chat.settings),
    draft: empty ? null : { text, attachments, at: Date.now() },
  });
  return { slug };
};

/**
 * Lưu danh sách cảnh đang soạn ở tab 🎬 Nhiều cảnh (chưa bấm Tạo). Chỉ kiểm hình dạng thô —
 * bản nháp được phép thiếu lời, thiếu hình; kiểm đầy đủ lúc bấm Tạo (parseMulti).
 */
export const saveMultiDraft = (body: unknown) => {
  const { slug: rawSlug, ...input } = (body ?? {}) as Record<string, unknown>;
  const scenes = Array.isArray(input.scenes) ? input.scenes.slice(0, 50) : [];
  const title = typeof input.title === "string" ? input.title.slice(0, 200) : "";
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const empty = !title.trim() && scenes.every((scene) => {
    const s = (scene ?? {}) as Record<string, unknown>;
    return !text(s.prompt) && !text(s.narration) && !s.media;
  });
  const payload = JSON.stringify({ ...input, title, scenes });
  if (payload.length > 500_000) throw new Error("Bản nháp quá lớn.");

  let slug: string;
  if (rawSlug === undefined || rawSlug === null || rawSlug === "") {
    if (empty) return { slug: null };
    slug = freshSlug(title.trim() || "video nhieu canh");
  } else if (isSlug(rawSlug)) {
    slug = rawSlug;
  } else {
    throw new Error("Tên video không hợp lệ.");
  }
  if (empty && !fs.existsSync(videoDir(slug))) return { slug: null };
  if (empty && onlyDraft(slug)) {
    fs.rmSync(videoDir(slug), { recursive: true, force: true });
    return { slug: null };
  }
  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(multiPath(slug), JSON.stringify(JSON.parse(payload), null, 2));
  return { slug };
};

export type TurnInput = {
  slug?: unknown;
  prompt?: unknown;
  attachments?: unknown;
  settings?: Partial<ChatSettings>;
};

/**
 * Nhận một tin nhắn, kiểm tra đầu vào rồi chạy pipeline trong nền.
 * Trả về ngay slug + jobId để UI theo dõi qua SSE.
 */
export const startTurn = (input: TurnInput) => {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  // Đính kèm file âm thanh: dựng từ lời trong file, không cần gõ gì.
  const audio = attachments.find((file): file is string => typeof file === "string" && isAudioFile(file));
  if (!prompt && !audio) throw new Error("Nhập nội dung trước đã.");

  for (const file of attachments) {
    if (typeof file !== "string" || !ATTACHMENT_RE.test(file) || file.includes("..")) {
      throw new Error(`File đính kèm không hợp lệ: ${String(file)}`);
    }
    if (!fs.existsSync(path.join(process.cwd(), "public", file))) {
      throw new Error(`Không thấy file đính kèm: ${file}`);
    }
  }

  let slug: string;
  let dedupeKey: string | null = null;
  if (input.slug === undefined || input.slug === null || input.slug === "") {
    dedupeKey = newTurnKey(prompt, attachments as string[]);
    const recent = recentNewTurn(dedupeKey);
    if (recent) return { slug: recent.slug, jobId: recent.jobId };

    // Dán cả kịch bản: đặt tên theo tiêu đề, không phải theo cả khối văn bản. Từ âm thanh: theo lời gõ kèm, không thì tên file.
    let nameSource = prompt || path.basename(audio!, path.extname(audio!)).replace(/^\d+-/, "");
    if (input.settings?.mode === "text" && !audio) {
      try {
        nameSource = textToScript(prompt, { style: "auto" }).script.title;
      } catch {
        // lỗi cú pháp sẽ được báo rõ ở bước kiểm tra phía dưới
      }
    }
    slug = freshSlug(nameSource);
  } else if (isSlug(input.slug)) {
    slug = input.slug;
  } else {
    throw new Error("Tên video không hợp lệ.");
  }
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi lượt trước xong đã.");
  }

  const chat = readChat(slug);
  const settings = normalizeSettings(input.settings, chat.settings);
  // Từ âm thanh không cần AI viết lời (lời là lời trong file) — chỉ kiểm phần hình.
  assertSettingsUsable(audio || audioSourceOf(slug) ? { ...settings, mode: "text" } : settings);
  if (settings.mode === "text" && !audio) {
    // Báo lỗi cú pháp ngay, trước khi ghi tin nhắn và chạy nền.
    textToScript(prompt, { style: settings.style === RANDOM_STYLE ? "auto" : settings.style, uploads: attachments as string[] });
  }

  const job = launchTurn(slug, prompt, attachments as string[], settings, chat.messages);
  if (dedupeKey) recentNew.set(dedupeKey, { slug, jobId: job.id, at: Date.now() });
  return { slug, jobId: job.id };
};

/** Ghi tin nhắn người dùng rồi chạy pipeline (kịch bản → dựng) trong nền. */
const launchTurn = (
  slug: string,
  prompt: string,
  attachments: string[],
  settings: ChatSettings,
  messages: ChatMessage[],
  series?: ChatSeries,
) => {
  messages.push({ role: "user", text: prompt || "Dựng video từ file âm thanh này", at: Date.now(), attachments });
  writeChat(slug, { messages, settings, draft: null, ...(series ? { series } : {}) });

  const job = startJob(async (log) => {
    try {
      const result = await runPipeline(slug, prompt, attachments, settings, log);
      messages.push({ role: "assistant", at: Date.now(), ...result });
      writeChat(slug, { messages, settings });
      return result;
    } catch (error) {
      messages.push({
        role: "assistant", at: Date.now(), error: true,
        text: errorText(error),
      });
      writeChat(slug, { messages, settings });
      throw error;
    } finally {
      clearRunning(slug);
    }
  });
  markRunning(slug, job.id, "turn");
  return job;
};

/**
 * "Làm tiếp": video mới là phần sau của video `slug` — AI viết tiếp ngay chỗ video đó dừng, dựng bằng đúng cài đặt
 * của nó (phong cách, giọng, khung, hình, nhạc), nên cảnh và lời nối liền. `direction`: hướng đi cho phần sau, có thể trống.
 */
export const startContinuation = (body: unknown) => {
  const input = (body ?? {}) as { slug?: unknown; direction?: unknown };
  if (!isSlug(input.slug)) throw new Error("Tên video không hợp lệ.");
  const from = input.slug;
  const source = readJson(path.join(videoDir(from), "script.json"));
  if (!source) {
    throw new Error("Video này không có kịch bản (dựng từ audio, nhiều cảnh hoặc trình chỉnh sửa) nên chưa làm tiếp được.");
  }
  if (running.has(from)) throw new Error("Video này đang được xử lý — đợi xong rồi làm tiếp.");

  const previous = parseScript(source);
  const sourceChat = readChat(from);
  const part = (sourceChat.series?.part ?? 1) + 1;
  // Nhạc "ngẫu nhiên" thì lấy đúng bản phần trước đã dùng — hai phần nối nhau nghe cùng một nhạc.
  const usedMusic = readJson(path.join(videoDir(from), "props.json"))?.music;
  const settings = normalizeSettings({
    mode: "ai",
    style: previous.style,
    ...(sourceChat.settings.music === RANDOM_MUSIC && isMusicPath(usedMusic) ? { music: usedMusic } : {}),
  }, sourceChat.settings);
  assertSettingsUsable(settings);

  const direction = typeof input.direction === "string" ? input.direction.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  const base = seriesBaseTitle(previous.title);
  const prompt = `Làm tiếp phần ${part} của “${base}”${direction ? `: ${direction}` : ""}`;
  // Bấm hai lần liền (mạng chậm) thì trả lại đúng video vừa tạo.
  const dedupeKey = newTurnKey(`${from}\n${prompt}`, []);
  const recent = recentNewTurn(dedupeKey);
  if (recent) return { slug: recent.slug, jobId: recent.jobId };

  const slug = freshSlug(`${base} phan ${part}`);
  const job = launchTurn(slug, prompt, [], settings, [], { from, part });
  recentNew.set(dedupeKey, { slug, jobId: job.id, at: Date.now() });
  return { slug, jobId: job.id };
};

/** Giữ punch khi tách cảnh: punch phải nằm nguyên văn trong một câu của chính cảnh đó (videoScriptSchema). */
const punchIn = (punch: string | null, lines: string[]) =>
  punch && lines.some((line) => line.includes(punch)) ? punch : null;

/**
 * Ghim ảnh/clip người dùng chọn làm hình mở đầu vào câu hook. Cảnh đầu nhiều câu thì tách câu hook thành cảnh
 * riêng, để hình chỉ phủ đúng 1–3 giây đầu thay vì cả cảnh; các cảnh sau giữ nguyên.
 */
export const withHookMedia = (script: VideoScript, media: string, log: (line: string) => void = () => {}): VideoScript => {
  if (!fs.existsSync(path.join(process.cwd(), "public", media))) {
    log(`⚠ Không thấy hình mở đầu ${media} — bỏ qua, cảnh đầu lấy hình như các cảnh khác.`);
    return script;
  }
  const [first, ...rest] = script.scenes;
  const split = first.lines.length > 1 && script.scenes.length < MAX_SCRIPT_SCENES;
  const hookLines = split ? first.lines.slice(0, 1) : first.lines;
  const scenes = [
    { ...first, lines: hookLines, image: media, visual: split ? null : first.visual, punch: punchIn(first.punch, hookLines) },
    ...(split
      ? [{ ...first, lines: first.lines.slice(1), image: null, punch: punchIn(first.punch, first.lines.slice(1)) }]
      : []),
    ...rest,
  ];
  log(`Hình mở đầu: ${media}${split ? " — tách câu hook thành cảnh riêng" : ""}`);
  return videoScriptSchema.parse({ ...script, scenes });
};

/**
 * Bước 1 — kịch bản: viết mới, sửa kịch bản cũ, hoặc dựng từ lời dán vào. Ghi script.json
 * rồi dừng. Tách riêng khỏi bước dựng để chế độ hàng loạt duyệt được kịch bản trước khi render:
 * kịch bản mất vài giây và gần như miễn phí, render mất cả phút cho mỗi video.
 */
export const prepareScript = async (
  slug: string,
  prompt: string,
  uploads: string[],
  settings: ChatSettings,
  log: (line: string) => void,
): Promise<{ script: VideoScript; existed: boolean }> => {
  const scriptPath = path.join(videoDir(slug), "script.json");
  const existing = readJson(scriptPath);
  if (!existing && fs.existsSync(path.join(videoDir(slug), "props.json"))) {
    throw new Error(fs.existsSync(multiPath(slug))
      ? "Video nhiều cảnh không sửa bằng prompt — bấm “Sửa cảnh” để mở lại tab 🎬 Nhiều cảnh, hoặc dùng trình chỉnh sửa."
      : "Video này dựng từ file audio, không có kịch bản nên chưa sửa bằng prompt được.");
  }

  // ---- kịch bản ----
  log("__STEP__ script");
  let script: VideoScript;
  // "Ngẫu nhiên" chỉ bốc thăm cho video mới — sửa lời hay làm tiếp phần sau thì giữ phong cách đang có (như "auto").
  const continuing = Boolean(readJson(chatPath(slug))?.series);
  const style: StyleChoice = settings.style !== RANDOM_STYLE ? settings.style
    : existing || continuing ? "auto" : randomStyle(settings.mode === "text");
  if (settings.style === RANDOM_STYLE && style !== "auto") log(`Phong cách ngẫu nhiên: ${STYLES[style].emoji} ${STYLES[style].label}`);
  if (settings.mode === "text") {
    log("Dựng từ kịch bản bạn dán vào — không dùng AI…");
    const previous = existing ? parseScript(existing) : null;
    const parsed = textToScript(prompt, {
      style,
      uploads,
      previousImages: previous?.scenes.map((s) => s.image),
      previousStyle: previous?.style,
    });
    script = parsed.script;
    for (const note of parsed.notes) log(note);
  } else if (existing) {
    log(`Đang sửa kịch bản theo yêu cầu (${providerLabel(scriptProvider(settings.provider) ?? "gemini")} viết)…`);
    script = await editScript(parseScript(existing), prompt, slug, uploads, undefined, style, settings.provider,
      { length: settings.length, log, language: settings.language });
  } else {
    const series = readJson(chatPath(slug))?.series as ChatSeries | undefined;
    let partTitle: string | null = null;
    const previous = series ? readJson(path.join(videoDir(series.from), "script.json")) : null;
    if (series && !previous) throw new Error("Không còn kịch bản của phần trước (video đó đã bị xoá?) nên không viết tiếp được.");
    if (series && previous) {
      const before = parseScript(previous);
      log(`Đang viết phần ${series.part}, nối tiếp “${before.title}” (${providerLabel(scriptProvider(settings.provider) ?? "gemini")} viết)…`);
      script = await continueScript(before, series.part, prompt, slug, uploads, undefined, style, settings.provider,
        { length: settings.length, log, language: settings.language });
      partTitle = script.title;
    } else {
      log(`Đang viết kịch bản bằng ${providerLabel(scriptProvider(settings.provider) ?? "gemini")}…`);
      script = await generateScript(prompt, slug, undefined, uploads, style, settings.provider,
        { length: settings.length, hook: settings.hook, log, language: settings.language });
    }
    // Lượt soát: bắt dữ kiện sai, câu đố vô lý, số liệu bịa rồi sửa đúng chỗ đó (scripts/review-script.ts).
    script = await reviewScript(script, prompt, { slug, provider: settings.provider, log, language: settings.language });
    // Bản soát có thể viết lại tiêu đề — phần tiếp giữ đúng "Tên loạt (Phần n)".
    if (partTitle) script = { ...script, title: partTitle };
  }
  if (settings.hookMedia) script = withHookMedia(script, settings.hookMedia, log);
  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  log(`Kịch bản: ${script.scenes.length} cảnh, ${allLines(script).length} câu`);
  return { script, existed: Boolean(existing) };
};

/**
 * Bước 2 — dựng: giọng đọc → hình → render, đọc kịch bản đã có nên chạy lại không gọi AI viết lời.
 */
export const buildFromScript = async (
  slug: string,
  script: VideoScript,
  settings: ChatSettings,
  log: (line: string) => void,
  /** Kịch bản đã có từ trước hay vừa viết — chỉ đổi chữ "Đã sửa" / "Đã tạo" trong câu trả lời. */
  existed = false,
  /**
   * Bản phụ đề dịch: giọng đọc lời của kịch bản GỐC (cùng số câu, câu thứ i ↔ câu thứ i), còn phụ đề và chữ trên
   * hình lấy từ `script` đã dịch. Giọng có bộ nhớ theo chữ nên đọc lại lời gốc không tốn thêm lượt gọi.
   */
  voiceScript?: VideoScript,
  /** Ghi đè vào props trước khi render: object (nhận diện kênh…) hoặc hàm sửa tại chỗ (thêm hàng phụ đề dịch…). */
  patch?: Partial<ShortProps> | ((props: ShortProps) => void),
) => {
  const sceneSummary = script.scenes.map((sc) => ({ lines: sc.lines, image: sc.image }));
  const styleMeta = STYLES[script.style] ?? STYLES.caption;
  const styleLabel = `${styleMeta.emoji} ${styleMeta.label}`;
  log(`Phong cách: ${styleLabel}${settings.style === "auto" ? " (AI chọn)" : settings.style === RANDOM_STYLE ? " (ngẫu nhiên)" : ""}`);

  // ---- chế độ ảnh: mỗi cảnh một ảnh tĩnh, không giọng, không nhạc ----
  // Không ghi props.json — giữ nguyên props của bản video (nếu có).
  if (settings.kind === "image") {
    await findSceneImages(slug, script, settings, log);
    const props = shortSchema.parse(
      scriptToProps(script, { startAtFrame: TITLE_FRAMES, aspect: settings.aspect, language: settings.language }),
    );
    clearSceneImages(props, settings, log);
    assertImagesExist(props);

    log("__STEP__ render");
    const dir = path.join(process.cwd(), "out", "scenes");
    fs.mkdirSync(dir, { recursive: true });
    const total = script.scenes.length;
    // Lần trước nhiều cảnh hơn thì xoá ảnh thừa, không để lẫn vào kết quả mới.
    for (const old of sceneImages(slug)) {
      const n = Number(old.match(/-(\d+)\.png/)?.[1]);
      if (n > total) fs.rmSync(path.join(dir, `${slug}-${n}.png`), { force: true });
    }
    for (let i = 0; i < total; i++) {
      log(`Đang dựng ảnh ${i + 1}/${total}…`);
      await renderScene(props, i, "image", path.join(dir, `${slug}-${i + 1}.png`));
      log(`__PROGRESS__ ${Math.round(((i + 1) / total) * 100)}`);
    }
    return {
      text: `${existed ? "Đã sửa" : "Đã tạo"} ${total} ảnh "${script.title}" · ${styleLabel}`,
      style: script.style,
      images: sceneImages(slug),
      aspect: settings.aspect,
      scenes: sceneSummary,
    };
  }

  // ---- giọng đọc + hình, chạy cùng lúc ----
  // Hình chỉ cần kịch bản (độ dài cảnh ước theo số câu), không cần giọng — tìm và tải trong lúc đang đọc giọng thay vì
  // đợi đọc xong mới bắt đầu. Clip AI thì cần độ dài thật của cảnh nên vẫn đợi giọng.
  log("__STEP__ voice");
  const imagesTask = settings.video ? null : findSceneImages(slug, script, settings, log);
  // Giọng lỗi trước thì lỗi đó được báo; việc tìm hình vẫn chạy nốt (hình tìm được lưu vào kịch bản, lần chạy lại dùng
  // luôn) — đánh dấu đã xử lý để lỗi của nó (nếu có) không làm sập tiến trình khi không còn ai đợi.
  imagesTask?.catch(() => {});
  if (settings.voice && settings.voice !== AUTO_VOICE && !findVoice(settings.voice)) {
    // Giọng đã bị gỡ khỏi app (ví dụ EverAI) — báo rõ thay vì âm thầm làm video không tiếng.
    throw new Error(`Giọng "${settings.voice}" không còn trong app — chọn giọng khác ở mục Giọng đọc rồi thử lại.`);
  }
  // "Tự động", giọng máy này không có (không phải máy nào cũng có giọng Linh), hay giọng chỉ đọc tiếng Việt trong video
  // tiếng Anh → giọng tốt nhất máy này đọc được ngôn ngữ của video (scripts/voices.ts resolveVoice).
  const { voice, note: languageNote = "" } = resolveVoice(settings.voice, settings.language);
  if (languageNote) log(languageNote);
  let voiceover;
  let voiceNote = "";
  if (voice) {
    log(`Đang đọc bằng giọng ${voice.key}…`);
    const spoken = allLines(voiceScript ?? script);
    if (voiceScript && spoken.length !== allLines(script).length) {
      throw new Error("Bản dịch lệch số câu so với bản gốc — bấm Chạy lại để dịch lại.");
    }
    voiceover = await generateVoiceover(spoken, slug, voice.engine, voice.id, {
      log, onFallback: (note) => { voiceNote = note; }, language: settings.language,
    });
  } else {
    log("Không dùng giọng đọc.");
  }

  const music = await resolveMusicChoice(settings.music, log);
  const props = shortSchema.parse(
    scriptToProps(script, {
      startAtFrame: TITLE_FRAMES,
      voiceover,
      music,
      captionPosition: "bottom",
      aspect: settings.aspect,
      language: settings.language,
    }),
  );
  if (typeof patch === "function") patch(props);
  else if (patch) Object.assign(props, patch);
  let aiNote: string;
  if (imagesTask) {
    aiNote = await imagesTask;
    // Hình vừa tìm nằm trong script — props dựng trước khi tìm xong thì gán lại theo cảnh.
    props.scenes.forEach((scene, i) => { scene.image ??= script.scenes[i]?.image ?? null; });
    aiNote = clearSceneImages(props, settings, log) || aiNote;
  } else {
    aiNote = await addAiClips(slug, script, props, settings, log);
  }
  fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(props, null, 2));
  assertImagesExist(props);

  // ---- render ----
  log("__STEP__ render");
  const output = path.join(process.cwd(), "out", `${slug}.mp4`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const { durationInFrames } = await renderShort(props, output, undefined,
    (percent) => log(`__PROGRESS__ ${percent}`));

  const seconds = (durationInFrames / 30).toFixed(1);
  // Ghi rõ giọng và nhạc thật sự đã dùng — chọn nhầm (ví dụ chỉ bấm nghe thử) thì thấy ngay.
  const audioLine = [
    voice ? `🎙 giọng ${voice.key}` : "🔇 không giọng đọc",
    music ? `🎵 ${path.basename(music).replace(/\.\w+$/, "")}${settings.music === RANDOM_MUSIC ? " (ngẫu nhiên)" : ""}` : "không nhạc nền",
  ].join(" · ");
  return {
    text: `${existed ? "Đã sửa" : "Đã tạo"} "${script.title}" · ${styleLabel} · ${script.scenes.length} cảnh · ${seconds}s\n${audioLine}${aiNote ? `\n${aiNote}` : ""}${languageNote ? `\n${languageNote}` : ""}${voiceNote ? `\n${voiceNote}` : ""}`,
    style: script.style,
    mp4: `/out/${slug}.mp4?t=${Date.now()}`,
    aspect: settings.aspect,
    scenes: sceneSummary,
  };
};

/**
 * Cảnh cho video dựng từ file thu sẵn. Lời được chia thành nhiều cảnh (server/audio-video.ts › captionScenes) để phong
 * cách có nhịp chuyển cảnh — cả video một cảnh thì truyện tranh chỉ một khung, bản đồ một điểm dừng.
 * - File video: mỗi cảnh chiếu tiếp đúng đoạn đó của video gốc (trimStartMs) nên hình vẫn liền mạch. Phong cách Video gốc
 *   thì giữ một cảnh như trước.
 * - File âm thanh: ảnh/clip người dùng đính kèm gắn lần lượt vào các cảnh đầu, cảnh còn lại tìm hình theo nút Hình ảnh.
 */
export const mediaScenes = async (input: {
  slug: string;
  file: string;
  captions: Caption[];
  durationMs: number;
  style: StyleId;
  title: string;
  settings: ChatSettings;
  log: (line: string) => void;
  /** Ảnh/clip người dùng đính kèm (chỉ dùng với file âm thanh). */
  own?: string[];
}): Promise<{ scenes: Partial<Scene>[]; note: string }> => {
  const { file, captions, durationMs, style, title, settings, log } = input;
  if (isVideoFile(file) && style === "plain") return { scenes: [{ image: file, visual: null, startMs: 0, endMs: durationMs }], note: "" };
  const parts = captionScenes(captions, durationMs);
  if (isVideoFile(file)) {
    log(`Chia video thành ${parts.length} cảnh theo lời.`);
    return {
      scenes: parts.map((part) => ({ image: file, visual: null, trimStartMs: part.startMs, startMs: part.startMs, endMs: part.endMs })),
      note: "",
    };
  }
  log(`Chia lời thành ${parts.length} cảnh để gắn hình.`);
  const own = input.own ?? [];
  // Kịch bản tạm chỉ để tìm hình (từ khoá theo lời từng cảnh) — không ghi ra script.json.
  const script: VideoScript = {
    style, title: title.slice(0, 60) || "Video", subtitle: "", accent: "#ff6b2c", background: "#0b0b12",
    scenes: parts.map((part, k) => ({
      lines: part.lines.length ? part.lines : [title || "…"], image: own[k] ?? null, visual: null, tag: null, punch: null,
    })),
  };
  if (own.length) log(`Dùng ${Math.min(own.length, parts.length)} ảnh/clip bạn đính kèm cho ${own.length >= parts.length ? "mọi" : "các"} cảnh đầu.`);
  const note = await findSceneImages(input.slug, script, settings, log, false);
  return {
    scenes: parts.map((part, k) => ({ image: script.scenes[k].image, visual: null, startMs: part.startMs, endMs: part.endMs })),
    note,
  };
};

/**
 * "Từ âm thanh có sẵn": dựng video từ file âm thanh người dùng đính kèm — phiên âm thành phụ đề đúng mốc giờ, chia lời
 * thành cảnh, tìm hình cho từng cảnh, rồi dựng với chính tiếng trong file. Không gọi AI viết lời, không đọc giọng.
 * Không có kịch bản (chỉ props.json) nên sửa tiếp trong trình chỉnh sửa, như video dựng từ file ở Hàng loạt.
 */
const buildFromAudio = async (
  slug: string,
  prompt: string,
  audio: string,
  uploads: string[],
  settings: ChatSettings,
  log: (line: string) => void,
) => {
  const source = path.join(process.cwd(), "public", audio);
  if (!fs.existsSync(source)) throw new Error(`Không thấy file: ${audio}`);
  fs.mkdirSync(videoDir(slug), { recursive: true });

  log("__STEP__ script");
  const heard = await transcribeCached(source, audio, "auto", "medium", log);
  if (heard.length === 0) throw new Error("Không nghe ra câu nào trong file này — kiểm tra lại file có tiếng nói không.");
  const { trackRel, durationMs } = extractTrack(source, slug);
  // Lời dán kèm (bài hát, lời thoại đúng chính tả): chữ phụ đề theo lời dán, mốc theo phiên âm — whisper hay nghe sai
  // lời bài hát có nhạc nền. Lượt sau không dán lại thì dùng lời đã dán ở lượt trước.
  const lyrics = pastedLyricsOf(slug, prompt);
  const captions = lyrics ? alignLyrics(lyrics, heard, durationMs) : heard;
  if (lyrics) log(`Phụ đề theo ${lyrics.length} dòng lời bạn dán — khớp mốc thời gian với tiếng trong file.`);
  const fileName = path.basename(audio, path.extname(audio)).replace(/^\d+-/, "").replace(/[-_]+/g, " ").trim();
  // Lượt sau của cùng video: lời vẫn là lời trong file, chữ gõ kèm là yêu cầu sửa chứ không phải tiêu đề — giữ tiêu đề cũ.
  const previous = readJson(path.join(videoDir(slug), "props.json")) as { title?: string } | null;

  // Phong cách: chọn cụ thể thì theo đó; Tự động đoán theo lời (như khi dán lời có sẵn); Ngẫu nhiên bốc thăm.
  const lines = captions.filter((caption) => !caption.track).map((caption) => caption.text);
  const style: StyleId = settings.style === RANDOM_STYLE ? randomStyle(true)
    : settings.style === "auto"
      ? guessStyle(lines.join("\n"), [{ lines, image: null, visual: null, tag: null, punch: null }])
      : settings.style;
  // Bài hát: tên bài là tên file. Còn lại: lời người dùng gõ kèm, không có thì câu đầu.
  const title = (
    lyrics ? (MUSIC_STYLES.has(style) ? fileName : lines[0])
      : previous?.title || prompt || (MUSIC_STYLES.has(style) ? fileName : lines[0])
  ).slice(0, 60) || fileName;
  const styleMeta = STYLES[style] ?? STYLES.caption;
  const styleLabel = `${styleMeta.emoji} ${styleMeta.label}`;
  log(`Phong cách: ${styleLabel}${settings.style === "auto" ? " (tự chọn theo lời)" : settings.style === RANDOM_STYLE ? " (ngẫu nhiên)" : ""}`);

  log("__STEP__ voice");
  const own = uploads.filter((file) => file !== audio && !isAudioFile(file));
  const { scenes, note } = await mediaScenes({ slug, file: audio, captions, durationMs, style, title, settings, log, own });
  const music = await resolveMusicChoice(settings.music, log);
  const props = shortSchema.parse({
    title, subtitle: "", accent: "#ff6b2c", background: "#0b0b12",
    captions, aspect: settings.aspect, style, scenes,
    captionPosition: "bottom",
    // Tiếng nói ngay từ giây 0 — title card sẽ đè lên chính câu đầu.
    showTitle: false,
    voiceoverTrack: trackRel,
    music,
    sfx: false,
  });
  fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(props, null, 2));
  assertImagesExist(props);

  log("__STEP__ render");
  const output = path.join(process.cwd(), "out", `${slug}.mp4`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const { durationInFrames } = await renderShort(props, output, undefined, (percent) => log(`__PROGRESS__ ${percent}`));
  const audioLine = [
    `🎙 tiếng trong file ${fileName} (không đọc giọng)`,
    music ? `🎵 ${path.basename(music).replace(/\.\w+$/, "")}` : "không nhạc nền",
  ].join(" · ");
  return {
    text: `${previous ? "Đã dựng lại" : "Đã tạo"} "${title}" từ âm thanh · ${styleLabel} · ${scenes.length} cảnh · ${(durationInFrames / 30).toFixed(1)}s\n${audioLine}${note ? `\n${note}` : ""}` +
      (previous ? "\nLời lấy từ file nên yêu cầu bằng chữ không đổi được lời — đổi phong cách, hình, khung, nhạc ở các chip rồi gửi; sửa chữ phụ đề trong trình chỉnh sửa." : ""),
    style,
    mp4: `/out/${slug}.mp4?t=${Date.now()}`,
    aspect: settings.aspect,
  };
};

/**
 * Lời người dùng dán kèm file âm thanh (từ LYRICS_MIN_LINES dòng): lượt này nếu có, không thì lượt gần nhất đã dán.
 * null = không dán — phụ đề theo phiên âm.
 */
const pastedLyricsOf = (slug: string, prompt: string) => {
  const turns = (readJson(chatPath(slug))?.messages as ChatMessage[] | undefined) ?? [];
  for (const text of [prompt, ...[...turns].reverse().filter((m) => m.role === "user").map((m) => m.text)]) {
    const lines = lyricLines(text ?? "");
    if (lines.length >= LYRICS_MIN_LINES) return lines;
  }
  return null;
};

/**
 * File âm thanh mà video này được dựng từ đó — null nếu video có kịch bản (dựng bằng lời). Lượt đầu bị ngắt giữa chừng
 * (chưa có gì) vẫn tính: gửi lại mà quên đính kèm thì dựng từ đúng file cũ, không để AI coi câu chữ là ý tưởng.
 */
const audioSourceOf = (slug: string) => {
  if (fs.existsSync(path.join(videoDir(slug), "script.json"))) return null;
  const turns = readJson(chatPath(slug))?.messages as ChatMessage[] | undefined;
  return [...(turns ?? [])].reverse().flatMap((m) => (m.role === "user" ? m.attachments ?? [] : [])).find(isAudioFile) ?? null;
};

/** Một lượt chat = kịch bản rồi dựng luôn, không dừng giữa chừng. Đính kèm file âm thanh thì dựng từ chính file đó. */
const runPipeline = async (
  slug: string,
  prompt: string,
  uploads: string[],
  settings: ChatSettings,
  log: (line: string) => void,
) => {
  // Video dựng từ file âm thanh (không có kịch bản): lượt sau dựng lại từ đúng file đó theo các chip hiện tại.
  const audio = uploads.find(isAudioFile) ?? audioSourceOf(slug);
  if (audio) {
    if (settings.kind === "image") throw new Error("File âm thanh chỉ dựng được video — đổi Tạo ra sang Video.");
    return buildFromAudio(slug, prompt, audio, uploads, settings, log);
  }
  const { script, existed } = await prepareScript(slug, prompt, uploads, settings, log);
  return buildFromScript(slug, script, settings, log, existed);
};

/** Model dịch truy vấn ảnh: ưu tiên AI người dùng chọn viết lời, sau đó engine nào có key. */
const pickTranslateEngine = (provider: ProviderChoice): TranslateEngine | null => {
  const order = [...(isTranslateEngine(provider) ? [provider] : []), ...TRANSLATE_ENGINES];
  return order.find((engine) => !missingTranslateKey(engine)) ?? null;
};

/**
 * Truy vấn ảnh cho từng cảnh cần hình.
 * - AI vẽ: nhờ model viết kịch bản tả cụ thể từng cảnh bằng tiếng Anh, cùng một phong cách (scripts/image-prompts.ts).
 *   Trước đây gửi nguyên "tiêu đề. lời đọc" tiếng Việt — FLUX không hiểu, ra ảnh lạc đề (hồ nước cho video cá heo).
 *   Không viết được thì lùi về bản dịch tiếng Anh của lời đọc.
 * - Pexels/Pixabay: tìm theo từ khoá nên dịch sang tiếng Anh, không dịch được thì vẫn tìm bằng nguyên văn.
 */
const sceneImageQueries = async (
  script: VideoScript,
  indexes: number[],
  settings: ChatSettings,
  log: (line: string) => void,
) => {
  const text = indexes.map((i) => script.scenes[i].lines.join(" ").slice(0, 120));
  if (settings.images === "ai") {
    try {
      const written = await writeImagePrompts(script, indexes, { provider: settings.provider, style: script.style, art: settings.art });
      log(`Mô tả hình cho ${indexes.length} cảnh (${providerLabel(written.provider)}) — ${
        settings.art !== "auto"
          ? `kiểu vẽ ${ART_STYLES[settings.art].label}`
          : `${written.look.kind === "photo" ? "ảnh chụp thật" : "tranh vẽ"} theo phong cách ${STYLES[script.style]?.label ?? script.style}`
      }`);
      return written.prompts.map((prompt) => composeImagePrompt(prompt, written.look.look));
    } catch (error) {
      log(`Không viết được mô tả hình (${error instanceof Error ? error.message : error}) — vẽ theo bản dịch lời đọc.`);
    }
  }
  // Video tiếng Anh: lời đã là tiếng Anh, kho ảnh tìm bằng tiếng Anh — ghép tiêu đề giữ chủ thể, không cần dịch.
  if (settings.language === "en") {
    const queries = text.map((line) => `${script.title}, ${line}`);
    return settings.images === "ai" ? queries.map((query) => composeImagePrompt(query, imageLookFor(script.style, settings.art).look)) : queries;
  }
  const engine = pickTranslateEngine(settings.provider);
  if (!engine) {
    log("Không có model dịch — tìm Pexels bằng nguyên văn, kết quả có thể kém.");
    return text;
  }
  try {
    // Dịch kèm tiêu đề: Pexels tìm theo từ khoá nên câu như "chúng ghi nhớ rất lâu" mất chủ thể
    // và trả về ảnh sai hẳn chủ đề. Ghép tiêu đề vào để giữ chủ thể ("cá heo") trong truy vấn.
    const [title, ...lines] = await translateLines([script.title, ...text], { to: "en", from: "vi", engine }, () => {});
    const queries = lines.map((query, k) => [title.trim(), (query ?? "").trim() || text[k]].filter(Boolean).join(", "));
    return settings.images === "ai" ? queries.map((query) => composeImagePrompt(query, imageLookFor(script.style, settings.art).look)) : queries;
  } catch (error) {
    log(`Không dịch được truy vấn (${error instanceof Error ? error.message : error}) — tìm bằng nguyên văn.`);
    return text;
  }
};

/**
 * Truy vấn tìm ảnh/clip kho cho các cảnh: AI nêu chủ thể chụp được của từng cảnh (2-4 từ tiếng Anh) kèm từ khoá để
 * chấm kết quả (writeStockQueries). AI lỗi thì lùi về bản dịch lời đọc như trước — vẫn chạy được, chỉ kém chính xác.
 */
const sceneStockPlans = async (
  script: VideoScript,
  indexes: number[],
  settings: ChatSettings,
  log: (line: string) => void,
): Promise<StockPlan[]> => {
  // Câu đố: chỉ đưa phần hỏi — thấy câu "Đáp án là nước mắm" thì AI tìm luôn ảnh nước mắm, lộ đáp án (đã gặp,
  // dù đã dặn đừng). Bỏ câu chứa đáp án (punch) và các câu sau nó.
  const video = script.style !== "quiz" ? script : {
    ...script,
    scenes: script.scenes.map((scene) => {
      const needle = scene.punch?.toLocaleLowerCase("vi");
      const at = needle ? scene.lines.findIndex((l) => l.toLocaleLowerCase("vi").includes(needle)) : -1;
      return { lines: at > 0 ? scene.lines.slice(0, at) : scene.lines };
    }),
  };
  // Video dài: chia lô và hỏi song song — một lượt 150 cảnh thì câu trả lời dài quá, model hay cắt giữa chừng.
  const chunks: number[][] = [];
  for (let k = 0; k < indexes.length; k += STOCK_PLAN_CHUNK) chunks.push(indexes.slice(k, k + STOCK_PLAN_CHUNK));
  const planned = await mapLimit(chunks, 3, async (chunk) => {
    try {
      const { plans, provider } = await writeStockQueries(video, chunk, { provider: settings.provider });
      log(`Từ khoá tìm hình (${providerLabel(provider)}): ${plans.map((p, k) => `cảnh ${chunk[k] + 1} "${p.queries[0]}"`).join(" · ")}`);
      return plans;
    } catch (error) {
      const which = chunks.length > 1 ? ` cho cảnh ${chunk[0] + 1}–${chunk[chunk.length - 1] + 1}` : "";
      log(`Không chọn được từ khoá tìm hình${which} (${error instanceof Error ? error.message : error}) — tìm theo bản dịch lời đọc.`);
      return (await sceneImageQueries(script, chunk, settings, log)).map((query) => ({ queries: [query], keywords: [] }));
    }
  });
  return planned.flat();
};

/** Số cảnh mỗi lượt hỏi AI từ khoá tìm hình. */
const STOCK_PLAN_CHUNK = 30;

/** "Không hình": bỏ hình AI tự gán cho các cảnh (giữ hình mở đầu người dùng tự chọn). Trả ghi chú, "" nếu không đổi gì. */
const clearSceneImages = (props: ShortProps, settings: ChatSettings, log: (line: string) => void) => {
  if (settings.images !== "none") return "";
  const had = props.scenes.filter((scene) => scene.image).length;
  props.scenes.forEach((scene, i) => {
    if (i === 0 && settings.hookMedia && scene.image === settings.hookMedia) return;
    scene.image = null;
  });
  log("Không dùng hình — video chỉ có chữ.");
  return had > 0 ? "🚫 Không dùng hình — video chỉ có chữ." : "";
};

/** Kho ảnh tìm cùng lúc tối đa chừng này cảnh (Pixabay tự giãn nhịp gọi trong scripts/stock.ts), tải file cũng vậy. */
const STOCK_PARALLEL = 4;
/** AI vẽ cùng lúc tối đa chừng này ảnh — gói miễn phí giới hạn lượt/phút. */
const DRAW_PARALLEL = 3;

/**
 * Hình cho những cảnh chưa có ảnh, theo nút Hình ảnh — ghi thẳng vào `script` (và script.json), chỉ cần kịch bản nên
 * chạy song song với giọng đọc được. Không tự đổi nguồn: chọn AI vẽ mà lỗi thì báo lỗi chứ không âm thầm lấy Pexels,
 * và ngược lại.
 *
 * Kho miễn phí làm theo lượt để video dài không phải đợi từng cảnh: (1) AI chọn từ khoá cho mọi cảnh trong một lần gọi,
 * (2) tìm trước cho mọi cảnh cùng lúc, (3) chọn hình lần lượt theo thứ tự cảnh — kết quả đã có sẵn nên gần như tức
 * thì, và thứ tự cố định giữ cho việc chống trùng ảnh giữa các cảnh ổn định, (4) tải các hình đã chọn song song.
 */
const findSceneImages = async (
  slug: string,
  script: VideoScript,
  settings: ChatSettings,
  log: (line: string) => void,
  /** Ghi hình tìm được vào script.json — tắt với video dựng từ file thu sẵn (không có kịch bản). */
  persist = true,
) => {
  if (settings.images === "none" || settings.images === "library") return "";

  const need = script.scenes.map((scene, i) => ({ scene, i })).filter(({ scene }) => !scene.image);
  if (need.length === 0) return "";

  const ai = settings.images === "ai";
  /** Cảnh (đánh số từ 1) mà kho không có hình nào dùng được — liệt kê trong câu trả lời để người dùng tự đổi. */
  const weakFit = new Set<number>();
  /** Cảnh chỉ có ảnh cùng chủ đề, không đúng thứ đang nói — vẫn dùng nhưng nên xem lại. */
  const similarFit = new Set<number>();
  const clips = settings.images === "stock-video";
  const label = ai ? "AI vẽ" : clips ? "kho clip miễn phí" : "kho ảnh miễn phí";
  log(ai ? `Đang để ${cloudflareImageAvailable() ? "FLUX (Cloudflare, miễn phí)" : "Gemini"} vẽ ${need.length} ảnh…` : `Đang tìm ${need.length} ${clips ? "clip" : "ảnh"} miễn phí (Pexels, Pixabay)…`);
  let perQuery: (string | null)[];
  if (ai) {
    const queries = await sceneImageQueries(script, need.map(({ i }) => i), settings, log);
    perQuery = (await fetchSceneImages(slug, queries, ["gemini"], log, DRAW_PARALLEL)).perQuery;
  } else {
    const plans = await sceneStockPlans(script, need.map(({ i }) => i), settings, log);
    // Chưa có giọng đọc nên độ dài cảnh ước theo số câu — chỉ dùng để ưu tiên clip đủ dài.
    const seconds = need.map(({ scene }) => Math.max(2, scene.lines.length * SECONDS_PER_LINE));
    const kinds = clips ? (["video", "image"] as const) : (["image"] as const);

    // (2) Tìm trước cho mọi cảnh cùng lúc.
    if (need.length > 1) log(`Tìm hình cho ${need.length} cảnh cùng lúc…`);
    await mapLimit(plans, STOCK_PARALLEL, (plan, k) => prefetchStockForScene(kinds[0], plan, seconds[k]));

    // (3) Chọn theo thứ tự cảnh. Không lặp cùng một ảnh/clip giữa các cảnh; clip hết thì lùi về ảnh cho cảnh đó.
    const used = new Set<string>();
    const chosen: { k: number; what: string; choice: Extract<StockChoice, { found: true }> }[] = [];
    for (const [k, plan] of plans.entries()) {
      const n = need[k].i + 1;
      // Kho có trả kết quả nhưng lệch hẳn chủ đề — khác hẳn với lỗi mạng hay hết lượt, nên báo khác nhau.
      let noGood = false;
      let picked = false;
      for (const kind of kinds) {
        const what = kind === "video" ? "clip" : "ảnh";
        try {
          const choice = await chooseStockForScene(kind, plan, seconds[k], used);
          if (!choice) continue;
          if (!choice.found) {
            const fit = choice.total ? ` · khớp ${choice.matched}/${choice.total} từ khoá` : "";
            noGood = true;
            log(`[${what}] cảnh ${n}: kho không có ${what} đúng "${choice.query}"${fit} — bỏ qua.`);
            continue;
          }
          chosen.push({ k, what, choice });
          picked = true;
          break;
        } catch (error) {
          log(`Không lấy được ${what} cho "${plan.queries[0]}": ${error instanceof Error ? error.message : error}`);
        }
      }
      if (!picked && noGood) weakFit.add(n);
    }

    // (4) Tải các hình đã chọn song song.
    perQuery = need.map(() => null);
    // Tải hỏng (Pixabay chặn chống bot cả link file) thì chọn hình kế tiếp cho cảnh đó — kho vừa chặn đã bị gác trong
    // scripts/stock.ts nên lần chọn lại lấy từ kho khác. Trước đây cảnh bỏ trống luôn dù Pexels có sẵn ảnh hợp.
    await mapLimit(chosen, STOCK_PARALLEL, async ({ k, what, choice }) => {
      const n = need[k].i + 1;
      let current: typeof choice | null = choice;
      for (let attempt = 1; current; attempt++) {
        const { pick, similar } = current;
        try {
          const file = await downloadStockChoice(current);
          if (!file.found) return;
          perQuery[k] = file.path;
          if (similar) similarFit.add(n);
          const fit = pick.total ? ` · khớp ${pick.matched}/${pick.total} từ khoá` : "";
          log(`[${what}] cảnh ${n} ("${pick.query}"${fit})${similar ? " · ảnh cùng chủ đề, không đúng chủ thể" : ""}: ${file.credit}`);
          return;
        } catch (error) {
          const retry = attempt < 3;
          log(`Không tải được ${what} cho cảnh ${n}: ${error instanceof Error ? error.message : error}${retry ? " — thử hình khác." : ""}`);
          if (!retry) return;
          const next = await chooseStockForScene(what === "clip" ? "video" : "image", plans[k], seconds[k], used).catch(() => null);
          current = next?.found ? next : null;
        }
      }
    });
  }

  let filled = 0;
  need.forEach(({ scene }, k) => {
    const file = perQuery[k];
    if (!file) return;
    scene.image = file;
    filled += 1;
  });
  if (filled > 0 && persist) fs.writeFileSync(path.join(videoDir(slug), "script.json"), JSON.stringify(script, null, 2));

  const missing = need.length - filled;
  // Nói rõ cảnh nào trống vì kho không có gì đúng chủ đề — chỉ đếm "x/y cảnh có hình" thì lỗi này đi qua âm thầm.
  // Còn key vẽ ảnh thì mách luôn — chủ đề hiếm (loài vật lạ, đồ vật đặc thù) kho miễn phí thường chịu, AI vẽ thì được.
  const canDraw = !ai && (cloudflareImageAvailable() || Boolean(process.env.GEMINI_API_KEY));
  const list = (scenes: Set<number>) => [...scenes].sort((a, b) => a - b).join(", ");
  const weakNote = weakFit.size
    ? ` · kho không có hình đúng cho ${weakFit.size === 1 ? "cảnh" : "các cảnh"} ${list(weakFit)}` +
      ` — để nền trơn, tự chọn hình trong Chỉnh sửa${canDraw ? " hoặc đổi nút Hình ảnh sang AI vẽ" : ""}`
    : "";
  // Ảnh cùng chủ đề nhưng không đúng thứ đang nói (kho miễn phí không có loài/vật đó) — nói rõ để người dùng soát.
  const similarNote = similarFit.size
    ? ` · ${similarFit.size === 1 ? "cảnh" : "các cảnh"} ${list(similarFit)} chỉ có ảnh cùng chủ đề, không đúng thứ đang nói — xem lại trong Chỉnh sửa`
    : "";
  // Cảnh trống vì lý do khác (lỗi mạng, hết lượt) đếm riêng — không gộp vào "kho không có hình đúng".
  const others = missing - weakFit.size;
  if (filled === 0) return `⚠ Không lấy được ảnh nào từ ${label} — các cảnh dùng nền trơn.${weakNote}`;
  return `🖼 ${filled}/${need.length} cảnh có hình từ ${label}` +
    (others > 0 ? ` · ${others} cảnh không có ảnh` : "") + similarNote + weakNote +
    (ai ? "" : " · ghi nguồn trong public/uploads/stock/CREDITS.txt");
};

/**
 * Mô tả cho model video, suy từ lời đọc của cảnh — không gọi thêm AI viết prompt.
 * Kiểu vẽ khác ảnh thật (3D, hoạt hình…) thì clip là phim hoạt hình theo kiểu đó.
 */
const sceneVideoPrompt = (script: VideoScript, index: number, art: ArtStyle) =>
  [
    `B-roll footage for a short video titled "${script.title}".`,
    `Show visually what this narration describes: "${script.scenes[index].lines.join(" ")}".`,
    art === "auto" || art === "photo"
      ? "Realistic, cinematic camera movement."
      : `Animated in this style: ${ART_STYLES[art].look}. Smooth camera movement.`,
    "No on-screen text, subtitles, captions, letters, watermarks or logos.",
  ].join(" ");

/**
 * Một clip AI, nhớ theo (model, độ dài, prompt) trong ai-clips.json — dựng lại với
 * cùng nội dung thì dùng lại clip cũ, không tốn tiền tạo lại.
 */
const cachedAiClip = async (
  slug: string,
  options: { prompt: string; model: string; seconds: number; aspect: string },
  log: (line: string) => void,
) => {
  const cachePath = path.join(videoDir(slug), "ai-clips.json");
  const cache: Record<string, string> = readJson(cachePath) ?? {};
  const cacheKey = `${options.model}|${options.seconds}|${options.prompt}`;
  const cached = cache[cacheKey];
  if (cached && fs.existsSync(path.join(process.cwd(), "public", cached))) {
    log("Dùng lại clip AI đã tạo.");
    return cached;
  }
  const aspect = ASPECTS[options.aspect as AspectId] ?? ASPECTS["9:16"];
  const result = await generateAiVideo(
    { prompt: options.prompt, model: options.model, seconds: options.seconds, width: aspect.width, height: aspect.height },
    log,
  );
  fs.mkdirSync(videoDir(slug), { recursive: true });
  // Đọc lại ngay trước khi ghi: nhiều clip tạo song song, ghi đè bằng bản đọc lúc đầu là mất clip vừa xong của cảnh khác.
  fs.writeFileSync(cachePath, JSON.stringify({ ...(readJson(cachePath) ?? {}), [cacheKey]: result.path }, null, 2));
  return result.path;
};


/** Số clip AI tạo cùng lúc — mỗi clip mất vài phút ở máy chủ, đợi lần lượt thì video dài rất lâu. */
const AI_CLIP_PARALLEL = 3;

/**
 * Tạo clip AI làm nền cho từng cảnh, trừ cảnh đang dùng file người dùng tải lên. Tạo vài clip cùng lúc.
 * Lỗi thì thôi bắt đầu clip mới (thường là key/billing, sẽ lặp lại ở mọi cảnh) — clip đang tạo dở vẫn chạy nốt — và
 * các cảnh còn lại giữ ảnh. Trả ghi chú lỗi, "" nếu ổn.
 */
const addAiClips = async (
  slug: string,
  script: VideoScript,
  props: ShortProps,
  settings: ChatSettings,
  log: (line: string) => void,
) => {
  const total = props.scenes.length;
  /** Cảnh lỗi (đánh số từ 0) — có rồi thì không bắt đầu clip mới. */
  const failed: { scene: number; error: unknown }[] = [];
  await mapLimit(props.scenes, AI_CLIP_PARALLEL, async (scene, i) => {
    if (scene.image?.startsWith("uploads/")) {
      log(`Cảnh ${i + 1}/${total}: giữ file bạn tải lên.`);
      return;
    }
    if (failed.length) return;
    log(`Cảnh ${i + 1}/${total}: video AI…`);
    try {
      scene.image = await cachedAiClip(slug, {
        prompt: sceneVideoPrompt(script, i, settings.art),
        model: settings.video,
        seconds: Math.ceil((scene.endMs - scene.startMs) / 1000),
        aspect: settings.aspect,
      }, log);
    } catch (error) {
      log(`Không tạo được video AI ở cảnh ${i + 1}: ${errorText(error)}`);
      failed.push({ scene: i, error });
    }
  });
  const stop = failed.sort((a, b) => a.scene - b.scene)[0];
  return stop ? `⚠ Dừng tạo video AI ở cảnh ${stop.scene + 1} — các cảnh chưa có clip dùng ảnh. ${errorText(stop.error)}` : "";
};

// ---------- video nhiều cảnh: mỗi cảnh một prompt ----------

export type MultiScene = {
  /** Mô tả hình cho model video. */
  prompt: string;
  /** Lời đọc/phụ đề, mỗi dòng một câu. Có thể trống. */
  narration: string;
  /** "" = không dùng model; "auto" hoặc key model = tạo clip AI. */
  model: string;
  /** Độ dài tối thiểu của cảnh — lời đọc dài hơn thì cảnh dài theo lời. */
  seconds: number;
  /** Ảnh/video người dùng tải lên, dùng khi không dùng model (hoặc khi tạo clip lỗi). */
  media: string | null;
};

export type MultiInput = {
  title: string;
  aspect: string;
  voice: string;
  music: string | null;
  scenes: MultiScene[];
};

const multiPath = (slug: string) => path.join(videoDir(slug), "multi.json");

/** Thông tin đã nhập của một video nhiều cảnh — để mở lại và dựng tiếp. */
export const readMulti = (slug: string) => readJson(multiPath(slug)) as MultiInput | null;

/** Trần an toàn, không phải mục tiêu: 100 cảnh × 15s ≈ 25 phút. */
const MAX_MULTI_SCENES = 100;

const parseMulti = (body: unknown): MultiInput & { slug?: string } => {
  const b = (body ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(b.scenes) ? b.scenes : [];
  if (raw.length === 0) throw new Error("Thêm ít nhất một cảnh.");
  if (raw.length > MAX_MULTI_SCENES) throw new Error(`Tối đa ${MAX_MULTI_SCENES} cảnh mỗi video.`);

  const scenes = raw.map((item, i): MultiScene => {
    const s = (item ?? {}) as Record<string, unknown>;
    const prompt = typeof s.prompt === "string" ? s.prompt.trim().slice(0, 2000) : "";
    const narration = typeof s.narration === "string" ? s.narration.trim().slice(0, 1000) : "";
    const model = typeof s.model === "string" && (s.model === "" || isVideoModelChoice(s.model)) ? s.model : "";
    const media = typeof s.media === "string" && s.media ? s.media : null;
    if (media && (!MEDIA_RE.test(media) || media.includes("..") ||
        !fs.existsSync(path.join(process.cwd(), "public", media)))) {
      throw new Error(`Cảnh ${i + 1}: file không hợp lệ.`);
    }
    if (model && !prompt) throw new Error(`Cảnh ${i + 1}: nhập prompt cho model video.`);
    if (!model && !narration && !media) {
      throw new Error(`Cảnh ${i + 1} đang trống — chọn model, thêm lời đọc hoặc tải ảnh/video lên.`);
    }
    const seconds = Math.round(Math.min(15, Math.max(2, Number(s.seconds) || 5)));
    return { prompt, narration, model, seconds, media };
  });

  let slug: string | undefined;
  if (b.slug !== undefined && b.slug !== null && b.slug !== "") {
    if (!isSlug(b.slug)) throw new Error("Tên video không hợp lệ.");
    slug = b.slug;
  }
  return {
    slug,
    title: typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 60) : "Video nhiều cảnh",
    aspect: typeof b.aspect === "string" && ASPECT_IDS.includes(b.aspect as never) ? b.aspect : "9:16",
    voice: typeof b.voice === "string" && (b.voice === "" || b.voice === AUTO_VOICE || findVoice(b.voice)) ? b.voice : "",
    music: isMusicPath(b.music) ? b.music : null,
    scenes,
  };
};

/**
 * Nhận danh sách cảnh, chạy nền: giọng đọc → clip AI từng cảnh → render.
 * Kết quả ghi vào chat.json như một lượt chat, nên hiện trong lịch sử và thư viện.
 * Có slug = dựng lại video nhiều cảnh đã có; clip không đổi prompt được dùng lại.
 */
export const startMultiScene = (body: unknown) => {
  const { slug: existingSlug, ...input } = parseMulti(body);
  if (input.scenes.some((s) => s.model) && !videoModelCatalog().defaultModel) {
    throw new Error(
      "Có cảnh chọn model video nhưng chưa có key tạo video. Thêm key trong Cài đặt, hoặc chọn 🚫 Không dùng model.",
    );
  }

  let slug: string;
  if (existingSlug) {
    if (!fs.existsSync(multiPath(existingSlug))) throw new Error("Không thấy video nhiều cảnh này.");
    slug = existingSlug;
  } else {
    slug = freshSlug(input.title);
  }
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi lượt trước xong đã.");
  }

  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(multiPath(slug), JSON.stringify(input, null, 2));

  const chat = readChat(slug);
  const messages = chat.messages;
  const aiScenes = input.scenes.filter((s) => s.model).length;
  messages.push({
    role: "user",
    at: Date.now(),
    text: `🎬 ${input.title} — ${input.scenes.length} cảnh${aiScenes ? `, ${aiScenes} cảnh video AI` : ""}`,
  });
  const settings: ChatSettings = {
    ...chat.settings, kind: "video", style: "plain", mode: "text",
    aspect: input.aspect, voice: input.voice, music: input.music,
  };
  writeChat(slug, { messages, settings });

  const job = startJob(async (log) => {
    try {
      const result = await runMultiScene(slug, input, log);
      messages.push({ role: "assistant", at: Date.now(), ...result });
      writeChat(slug, { messages, settings });
      return result;
    } catch (error) {
      messages.push({ role: "assistant", at: Date.now(), error: true, text: errorText(error) });
      writeChat(slug, { messages, settings });
      throw error;
    } finally {
      clearRunning(slug);
    }
  });
  markRunning(slug, job.id, "multi");
  return { slug, jobId: job.id };
};

/** Câu đầu của cảnh vào sau khi hình đã hiện một chút. */
const MULTI_LEAD_MS = 300;

const runMultiScene = async (slug: string, input: MultiInput, log: (line: string) => void) => {
  log("__STEP__ voice");
  const sceneLines = input.scenes.map((s) => s.narration.split(/\n+/).map((l) => l.trim()).filter(Boolean));
  const lines = sceneLines.flat();
  const { voice, note: voiceNote } = resolveVoice(input.voice);
  if (voiceNote) log(voiceNote);
  let voiceover: VoiceoverClip[] | undefined;
  if (voice && lines.length > 0) {
    log(`Đang đọc ${lines.length} câu bằng giọng ${voice.key}…`);
    voiceover = await generateVoiceover(lines, slug, voice.engine, voice.id, { log });
  } else {
    log(lines.length > 0 ? "Không dùng giọng đọc — chỉ hiện phụ đề." : "Không có lời đọc.");
  }

  // Cảnh nối tiếp nhau; mỗi cảnh dài bằng số giây đã chọn, hoặc dài hơn nếu lời đọc dài hơn.
  const captions: ShortProps["captions"] = [];
  let cursorMs = 0;
  let lineIndex = 0;
  const timing = input.scenes.map((scene, i) => {
    const startMs = cursorMs;
    let atMs = startMs + MULTI_LEAD_MS;
    for (const text of sceneLines[i]) {
      const clip = voiceover?.[lineIndex++];
      const durationMs = clip ? clip.durationMs : lineDurationMs(text);
      captions.push({ text, startMs: atMs, endMs: atMs + durationMs, audio: clip?.src ?? null });
      atMs += durationMs + pauseAfterLine(text);
    }
    const endMs = Math.max(startMs + scene.seconds * 1000, sceneLines[i].length ? atMs + MULTI_LEAD_MS : 0);
    cursorMs = endMs;
    return { startMs, endMs };
  });

  const total = input.scenes.length;
  let aiNote = "";
  const scenes = input.scenes.map((scene, i) => ({
    image: scene.media,
    visual: null,
    tag: null,
    punch: null,
    trimStartMs: 0,
    // Clip tự quay không lời đọc thì giữ tiếng gốc; còn lại tắt để giọng đọc là chính.
    volume: scene.media && /\.(mp4|mov|webm)$/i.test(scene.media) && !scene.model && sceneLines[i].length === 0 ? 1 : 0,
    ...timing[i],
  }));

  for (let i = 0; i < total; i++) {
    const scene = input.scenes[i];
    if (!scene.model) continue;
    if (aiNote) break;
    log(`Cảnh ${i + 1}/${total}: video AI…`);
    try {
      scenes[i].image = await cachedAiClip(slug, {
        prompt: scene.prompt,
        model: scene.model,
        seconds: Math.ceil((timing[i].endMs - timing[i].startMs) / 1000),
        aspect: input.aspect,
      }, log);
    } catch (error) {
      log(`Không tạo được video AI: ${errorText(error)}`);
      aiNote = `⚠ Dừng tạo video AI ở cảnh ${i + 1} — cảnh đó và các cảnh AI sau dùng file tải lên hoặc nền trơn. ${errorText(error)}`;
    }
  }

  const props = shortSchema.parse({
    title: input.title, subtitle: "", accent: "#ff6b2c", background: "#000000",
    captions, aspect: input.aspect, style: "plain", scenes,
    captionPosition: "bottom", showTitle: false, voiceoverTrack: null, music: await resolveMusicChoice(input.music, log), sfx: false,
  });
  fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(props, null, 2));
  assertImagesExist(props);

  log("__STEP__ render");
  const output = path.join(process.cwd(), "out", `${slug}.mp4`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const { durationInFrames } = await renderShort(props, output, undefined,
    (percent) => log(`__PROGRESS__ ${percent}`));

  return {
    text: `Đã tạo "${input.title}" · ${total} cảnh · ${(durationInFrames / 30).toFixed(1)}s${aiNote ? `\n${aiNote}` : ""}`,
    style: "plain",
    mp4: `/out/${slug}.mp4?t=${Date.now()}`,
    aspect: input.aspect,
  };
};
