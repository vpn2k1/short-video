/**
 * Làm nhiều video một lượt: một danh sách đầu vào + một bộ cài đặt dùng chung.
 *
 * Bốn nguồn đầu vào, cùng một hàng đợi:
 *   ideas    — mỗi dòng một ý tưởng (AI viết lời) hoặc một kịch bản dán sẵn
 *   custom   — mỗi video một ô riêng: lời riêng, và đặt được phong cách/khung/giọng riêng
 *   media    — mỗi file audio/video thu sẵn thành một video, phụ đề tự phiên âm
 *   variants — một kịch bản có sẵn nhân ra nhiều tỉ lệ / giọng / ngôn ngữ
 *   subs     — gắn phụ đề cho nhiều video có sẵn: mỗi file × mỗi ngôn ngữ phụ đề một video,
 *              kiểu phụ đề chung cho cả loạt, đổi kiểu một lần là dựng lại tất cả
 *   edit     — sửa hàng loạt video ĐÃ CÓ trong Thư viện (chọn nhiều ở đó): đổi nhạc, tên kênh, màu
 *              mà giữ chỉnh sửa tay, hoặc dựng lại từ kịch bản với phong cách/giọng/khung/lời mới.
 *              Mỗi video ra một bản mới, bản cũ vẫn còn (server/versions.ts)
 *
 * Mỗi mục chạy hai bước tách rời: **chuẩn bị** (viết kịch bản, hoặc phiên âm) rồi **dựng**
 * (giọng → hình → render). Bật "chốt duyệt" thì cả loạt dừng sau bước chuẩn bị để người
 * dùng đọc lại lời trước khi đốt thời gian render — kịch bản mất vài giây, render mất cả phút.
 *
 * Giới hạn chạy cùng lúc là chỗ dễ sai nhất: render và phiên âm ăn trọn CPU nên chỉ cho MỘT
 * việc nặng chạy một lúc (chạy song song chỉ làm cả hai cùng chậm); gọi AI viết lời là chờ
 * mạng nên cho vài cái song song.
 *
 * Mỗi mục xong là một video bình thường trong videos/<slug>/ kèm chat.json, nên mở lại,
 * sửa tiếp hay xoá đi đều giống video làm bằng tay.
 */
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { WhisperModel } from "@remotion/install-whisper-cpp";
import {
  assertSettingsUsable,
  buildFromScript,
  DEFAULT_SETTINGS,
  freshSlug,
  isSlug,
  normalizeSettings,
  prepareScript,
  deleteProjects,
  readChat,
  resolveMusicChoice,
  writeChat,
  type ChatMessage,
  type ChatSettings,
} from "./chat";
import { runRenderStage } from "./pipeline";
import { versionsDir } from "./versions";
import { allLines, parseScript, type VideoScript } from "../src/compositions/Short/script";
import { captionLookSchema, mediaCropSchema, shortSchema, type Caption, type CaptionLook } from "../src/compositions/Short/schema";
import type { MediaCrop } from "../src/scenes/CropBox";
import { ASPECT_IDS, ASPECTS, aspectFor, type AspectId } from "../src/aspects";
import { DEFAULT_CAPTION_LOOK } from "../src/components/captionLook";
import { findVoice } from "../scripts/voices";
import { slugify } from "../scripts/slug";
import { scriptToText, textToScript } from "../scripts/text-script";
import { transcribeSentences } from "../scripts/transcribe";
import { generatePostCopy, getPostCopy, type PostPlatform, type SavedPostCopy } from "../scripts/post-copy";
import { generateHooks } from "../scripts/hooks";
import { checkVideo, savedCheck } from "../scripts/qa-video";
import { coverPath, freshCover, makeCover } from "../scripts/cover";
import { renderShort } from "../scripts/render";
import { brandVideo, isBrandFile } from "../scripts/brand";
import type { ProviderChoice, StyleChoice } from "../scripts/generate-script";
import { alignCaptions, detectSilences } from "../scripts/subtitle-align";
import {
  isTranslateLanguage, missingTranslateKey, translateLanguageLabel, translateLines,
  TRANSLATE_ENGINES, type TranslateEngine, type TranslateLanguage,
} from "../scripts/translate";

export type BatchSource = "ideas" | "custom" | "media" | "variants" | "subs" | "edit";

/**
 * Sửa hàng loạt video có sẵn. Hai cách, vì chúng giữ lại những thứ khác nhau:
 *  - "props":   ghi thẳng vào props.json đang dùng rồi render lại. Giữ mọi chỉnh sửa trong trình chỉnh sửa
 *               (cắt cảnh, phụ đề sửa tay…) và giữ nguyên giọng đã đọc, nên chỉ đổi được thứ không đụng lời:
 *               nhạc nền, tên kênh, màu nhấn.
 *  - "rebuild": sửa script.json rồi dựng lại từ đầu (giọng → hình → render). Đổi được phong cách, giọng, khung
 *               và thay chữ trong lời (giọng đọc lại câu mới), nhưng props.json được tạo lại — chỉnh sửa tay
 *               của bản đang dùng không mang sang bản mới.
 * Trường để trống (undefined) = giữ như video đang có.
 */
export type EditKind = "props" | "rebuild";

/** Số liệu một video trên một nền tảng. `watch` = tỉ lệ xem hết, %. Ô bỏ trống = chưa có số. */
export type PostStats = { views?: number; watch?: number; likes?: number; comments?: number; shares?: number };
const STAT_KEYS = ["views", "watch", "likes", "comments", "shares"] as const;
export type EditPlan = {
  kind: EditKind;
  /** Đường dẫn nhạc, "random", hoặc null = bỏ nhạc. */
  music?: string | null;
  handle?: string;
  accent?: string;
  style?: StyleChoice;
  /** "" = bỏ giọng đọc. */
  voice?: string;
  aspect?: string;
  /** Thay chữ trong lời (chỉ "rebuild" — lời đổi thì giọng phải đọc lại). */
  replace?: { find: string; to: string }[];
};

/** Tuỳ chọn của nguồn "subs": video nói tiếng gì, và kiểu phụ đề chung cho cả loạt. */
export type SubsOptions = {
  /** Mã ngôn ngữ whisper ("vi", "en"…) hoặc "auto" để tự nhận. */
  spoken: string;
  /** Kiểu phụ đề. Loạt nhiều hàng: kiểu của hàng đầu tiên (= tracks[0].look). */
  look: Partial<CaptionLook>;
  /** Cắt khung chung cho mọi video; không có = giữ nguyên khung gốc. */
  crop?: SubsCrop;
  /**
   * Nhiều ngôn ngữ trong CÙNG một video: mỗi phần tử là một hàng phụ đề hiện cùng lúc, có kiểu và vị trí riêng
   * (hàng i → caption.track = i). Không có = mỗi ngôn ngữ ra một video riêng (BatchItem.subLang).
   */
  tracks?: SubsTrack[];
};

/** Một hàng phụ đề của loạt nhiều hàng. `lang` = "" là giữ nguyên tiếng đang nói. */
export type SubsTrack = { lang: "" | TranslateLanguage; look: Partial<CaptionLook> };

/**
 * Cắt khung chung của loạt phụ đề — chọn bằng đúng khung crop của trình chỉnh sửa trên video mẫu (video đầu tiên).
 * `frame`: khung video ra ("original" = giữ khung gốc của từng video). `crop`: vùng cắt trên video mẫu (MediaCrop).
 * Video khác tỉ lệ với video mẫu thì tự tính lại vùng cắt, giữ tâm và độ lớn tương đối (subsCropFor).
 */
export type SubsCrop = { frame: AspectId | "original"; crop: MediaCrop };

const parseCrop = (raw: unknown): SubsCrop | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { frame?: unknown; crop?: unknown };
  const frame = r.frame === "original" || ASPECT_IDS.includes(r.frame as AspectId) ? (r.frame as SubsCrop["frame"]) : null;
  const crop = mediaCropSchema.safeParse(r.crop);
  return frame && crop.success ? { frame, crop: crop.data } : undefined;
};

const aspectRatioOf = (id: AspectId) => ASPECTS[id].width / ASPECTS[id].height;
const clampRange = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Giống CropOverlay: tỉ lệ pixel của lựa chọn tỉ lệ; null = tự do. */
const cropRatioValue = (id: string, frameAspect: number, mediaAspect: number) => {
  if (id === "free") return null;
  if (id === "frame") return frameAspect;
  if (id === "original") return mediaAspect;
  const [a, b] = id.split(":").map(Number);
  return a > 0 && b > 0 ? a / b : null;
};

/** Giống CropOverlay: vùng lớn nhất có tỉ lệ `ratio` nằm gọn trong file có tỉ lệ `mediaAspect`. */
const largestCropRect = (ratio: number, mediaAspect: number) => {
  let w = 1;
  let h = mediaAspect / ratio;
  if (h > 1) {
    w = 1 / h;
    h = 1;
  }
  return { w, h };
};

/** Khung video ra và vùng cắt cho một video `width`×`height` theo cắt khung chung của loạt. */
export const subsCropFor = (opt: SubsCrop, width: number, height: number): { aspect: AspectId; crop: MediaCrop } => {
  const media = width / height;
  const aspect = opt.frame === "original" ? aspectFor(width, height).id : opt.frame;
  const base = opt.crop;
  const round = (n: number) => Math.round(n * 10000) / 10000;
  if (Math.abs(base.mediaAspect - media) < 0.01) return { aspect, crop: base };

  const ratio = cropRatioValue(base.ratio, aspectRatioOf(aspect), media);
  let rect: { x: number; y: number; w: number; h: number };
  if (ratio === null) {
    // Tự do: giữ nguyên vùng theo tỉ lệ 0–1 của file.
    rect = { x: base.x, y: base.y, w: base.w, h: base.h };
  } else {
    // Khoá tỉ lệ: độ lớn so với vùng lớn nhất trên video mẫu → áp cùng độ lớn lên video này, giữ tâm.
    const sampleFrame = opt.frame === "original" ? aspectRatioOf(aspectFor(base.mediaAspect * 1000, 1000).id) : aspectRatioOf(aspect);
    const sampleRatio = cropRatioValue(base.ratio, sampleFrame, base.mediaAspect) ?? ratio;
    const scale = Math.min(1, base.w / largestCropRect(sampleRatio, base.mediaAspect).w);
    const largest = largestCropRect(ratio, media);
    const w = largest.w * scale;
    const h = largest.h * scale;
    const cx = base.x + base.w / 2;
    const cy = base.y + base.h / 2;
    rect = { w, h, x: clampRange(cx - w / 2, 0, 1 - w), y: clampRange(cy - h / 2, 0, 1 - h) };
  }
  return {
    aspect,
    crop: { ...base, x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h), mediaAspect: round(media) },
  };
};

/** Ngôn ngữ nói chọn được — mã whisper. "auto" để whisper tự đoán (chậm hơn một chút, đôi khi đoán sai). */
export const SPOKEN_LANGUAGES = [
  { code: "auto", label: "Tự nhận" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "Tiếng Anh" },
  { code: "zh", label: "Tiếng Trung" },
  { code: "ja", label: "Tiếng Nhật" },
  { code: "ko", label: "Tiếng Hàn" },
  { code: "th", label: "Tiếng Thái" },
  { code: "id", label: "Tiếng Indonesia" },
  { code: "es", label: "Tiếng Tây Ban Nha" },
  { code: "fr", label: "Tiếng Pháp" },
  { code: "de", label: "Tiếng Đức" },
] as const;

export type ItemStatus =
  /** chờ tới lượt chuẩn bị */
  | "queued"
  /** đang viết kịch bản / đang phiên âm */
  | "preparing"
  /** đã có lời, đang chờ người duyệt */
  | "review"
  /** đã duyệt, chờ tới lượt dựng */
  | "ready"
  /** đang dựng: giọng → hình → render */
  | "building"
  | "done"
  | "error"
  /** người dùng bỏ qua mục này */
  | "skipped";

export type BatchItem = {
  id: string;
  /** Ý tưởng / kịch bản dán vào / mô tả biến thể — dòng hiện trên bảng. */
  input: string;
  /** Nguồn audio-video thu sẵn, đường dẫn tính từ public/. */
  file?: string;
  /** Nguồn subs: phụ đề dịch sang ngôn ngữ này. Không có = giữ nguyên ngôn ngữ đang nói. */
  subLang?: TranslateLanguage;
  /** Đổi kiểu phụ đề trong lúc mục đang dựng — dựng xong thì dựng lại lần nữa với kiểu mới. */
  restyle?: boolean;
  /** Biến thể: lấy từ video nào và đổi gì. */
  /** hook: bản thử A/B thứ mấy — 0 = giữ câu mở đầu gốc, k > 0 = câu hook thứ k do AI viết (batch.hooks). */
  variant?: { from: string; aspect?: string; voice?: string; lang?: TranslateLanguage; hook?: number };
  /** Nguồn edit: mục này là video có sẵn (item.slug), sửa theo batch.edit. */
  edit?: EditKind;
  /** Cài đặt riêng của mục này, đè lên cài đặt chung của loạt. */
  override?: Partial<ChatSettings>;
  slug?: string;
  status: ItemStatus;
  /** Bước đang chạy: script | voice | images | render. */
  step?: string;
  /** % của bước đang chạy. */
  progress: number;
  title?: string;
  /** Vài câu đầu để duyệt ngay trên bảng, không phải mở từng video. */
  lines?: string[];
  scenes?: number;
  mp4?: string;
  /** Ảnh bìa cắt từ mp4 — ô hiện ảnh này, bấm mới phát video. */
  poster?: string;
  images?: string[];
  error?: string;
  log: string[];
  startedAt?: number;
  finishedAt?: number;
};

export type Batch = {
  id: string;
  name: string;
  createdAt: number;
  source: BatchSource;
  settings: ChatSettings;
  /** Dừng sau bước chuẩn bị để người dùng duyệt lời. */
  review: boolean;
  /** Model whisper cho nguồn audio-video. */
  mediaModel: WhisperModel;
  subs?: SubsOptions;
  edit?: EditPlan;
  /** Thử A/B hook: số câu hook mới cần viết, và các câu đã viết (viết một lần cho cả loạt để các bản khác nhau). */
  hooks?: { count: number; lines?: string[] };
  /** Đoạn mở đầu / kết thúc chung đã gắn lần gần nhất (đường dẫn trong public/). */
  brand?: { intro: string | null; outro: string | null };
  /** Kết quả sau khi đăng, người dùng tự nhập: nền tảng → id mục → số liệu. */
  results?: Partial<Record<PostPlatform, Record<string, PostStats>>>;
  /** Lịch đăng: mốc đăng (ms) của từng mục theo id, và bài đăng của nền tảng nào đưa vào lịch. */
  postPlan?: { slots: Record<string, number>; platforms: PostPlatform[] };
  /** Hẹn giờ chạy (ms): loạt nằm chờ ở "idle" tới lúc đó thì tự chạy — app phải đang mở. */
  startAt?: number;
  state: "idle" | "running" | "paused" | "done";
  items: BatchItem[];
};

/** Nhiều hơn thế thì một loạt chạy hết ngày; cần nữa thì tạo loạt thứ hai. */
const MAX_ITEMS = 50;
const LOG_LINES = 60;

/** Render và phiên âm ăn trọn CPU — chạy song song chỉ làm cả hai cùng chậm. */
const HEAVY_LIMIT = 1;
/** Gọi AI viết lời là chờ mạng, vài cái song song thì cả loạt xong sớm hơn hẳn. */
const LIGHT_LIMIT = 2;

const MEDIA_RE = /\.(mp4|mov|webm|mp3|wav|m4a|aac|ogg)$/i;

const batchesDir = () => path.join(process.cwd(), "data", "batches");
const batchFile = (id: string) => path.join(batchesDir(), `${id}.json`);
const videoDir = (slug: string) => path.join(process.cwd(), "videos", slug);

const isBatchId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9-]{6,40}$/.test(value);

/** Loạt đang mở trong process này. Đọc từ đĩa một lần rồi giữ trong bộ nhớ. */
const cache = new Map<string, Batch>();

const readJson = (file: string) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;

/**
 * Server tắt giữa chừng: mục đang chạy dở không có tiến trình nào nối lại được,
 * nên đưa về trạng thái chờ và để loạt ở "tạm dừng" — người dùng bấm Chạy tiếp.
 */
const revive = (batch: Batch): Batch => {
  for (const item of batch.items) {
    if (item.status === "preparing") {
      item.status = "queued";
      item.progress = 0;
    } else if (item.status === "building") {
      item.status = "ready";
      item.progress = 0;
    }
  }
  if (batch.state === "running") batch.state = "paused";
  return batch;
};

const load = (id: string): Batch | null => {
  const cached = cache.get(id);
  if (cached) return cached;
  const raw = readJson(batchFile(id)) as Batch | null;
  if (!raw) return null;
  const batch = revive(raw);
  cache.set(id, batch);
  return batch;
};

const save = (batch: Batch) => {
  fs.mkdirSync(batchesDir(), { recursive: true });
  fs.writeFileSync(batchFile(batch.id), JSON.stringify(batch, null, 2));
  cache.set(batch.id, batch);
};

const require_ = (id: unknown): Batch => {
  if (!isBatchId(id)) throw new Error("Mã loạt không hợp lệ.");
  const batch = load(id);
  if (!batch) throw new Error("Không thấy loạt video này.");
  return batch;
};

// ---------- tạo loạt ----------

const cleanLines = (value: unknown) => {
  const text = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    // Bỏ số thứ tự và gạch đầu dòng khi dán từ Word, Sheets hay ChatGPT.
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean);
  return [...new Set(lines)].slice(0, MAX_ITEMS);
};

const newItem = (input: string, extra: Partial<BatchItem> = {}): BatchItem => ({
  id: randomUUID().slice(0, 8),
  input,
  status: "queued",
  progress: 0,
  log: [],
  ...extra,
});

/**
 * Kịch bản dán sẵn: mỗi video là một khối, ngăn nhau bằng dòng trống kép hoặc dòng "---".
 * Chế độ AI thì mỗi dòng là một ý tưởng.
 */
const splitPastedScripts = (text: string) =>
  String(text ?? "")
    .split(/\n\s*(?:-{3,}|={3,})\s*\n|\n{3,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

/** Tối đa bao nhiêu bản hook (tính cả bản gốc) — hơn nữa thì khó đo bản nào hơn. */
const MAX_HOOKS = 5;
const HOOK_LETTERS = "ABCDE";

const variantItems = (
  from: string,
  aspects: string[],
  voices: string[],
  langs: TranslateLanguage[],
  settings: ChatSettings,
  /** Tổng số bản hook, tính cả bản gốc; 0 hoặc 1 = không thử hook. */
  hooks = 0,
  /** Không chọn khung/giọng thì giữ khung, giọng của chính video gốc (nhân cả loạt) thay vì cài đặt chung. */
  ownDefaults = false,
) => {
  if (!isSlug(from)) throw new Error("Chọn video gốc để nhân bản.");
  const scriptPath = path.join(videoDir(from), "script.json");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `“${from}” chưa có kịch bản nên không nhân biến thể được. Chọn video do AI viết lời hoặc do bạn dán lời vào.`,
    );
  }
  const sourceTitle = (readJson(scriptPath) as { title?: string } | null)?.title ?? from;
  const base = ownDefaults ? readChat(from).settings : settings;
  const aspectList = aspects.length ? aspects : [base.aspect];
  const voiceList = voices.length ? voices : [base.voice];
  const langList: (TranslateLanguage | undefined)[] = langs.length ? langs : [undefined];
  const hookList: (number | undefined)[] = hooks > 1 ? [...Array(Math.min(hooks, MAX_HOOKS)).keys()] : [undefined];

  const items: BatchItem[] = [];
  for (const hook of hookList) {
    for (const lang of langList) {
      for (const aspect of aspectList) {
        for (const voice of voiceList) {
          const label = [
            hook === undefined ? null : `hook ${HOOK_LETTERS[hook]}${hook === 0 ? " (gốc)" : ""}`,
            lang ? translateLanguageLabel(lang) : null,
            aspectList.length > 1 || aspect !== base.aspect ? aspect : null,
            voiceList.length > 1 || voice !== base.voice ? (voice ? `giọng ${voice}` : "không giọng") : null,
          ].filter(Boolean).join(" · ");
          items.push(
            newItem(`${sourceTitle}${label ? ` — ${label}` : ""}`, {
              variant: { from, aspect, voice, lang, ...(hook === undefined ? {} : { hook }) },
              override: { aspect, voice },
            }),
          );
          if (items.length >= MAX_ITEMS) return items;
        }
      }
    }
  }
  return items;
};

export type CreateBatchInput = {
  source?: unknown;
  name?: unknown;
  /**
   * ideas: cả khối văn bản hoặc mảng dòng · custom: mảng { text, settings } — mỗi ô một video
   * · media: mảng đường dẫn từ public/.
   */
  items?: unknown;
  text?: unknown;
  settings?: Partial<ChatSettings>;
  review?: unknown;
  mediaModel?: unknown;
  variants?: { from?: unknown; aspects?: unknown; voices?: unknown; languages?: unknown; hooks?: unknown };
  /** Nguồn subs: ngôn ngữ nói, các ngôn ngữ phụ đề ("" = giữ nguyên), kiểu phụ đề chung. */
  subs?: { spoken?: unknown; languages?: unknown; look?: unknown; crop?: unknown; layout?: unknown; tracks?: unknown };
  /** Nguồn edit: items là danh sách slug video có sẵn; đây là thay đổi áp cho tất cả. */
  edit?: Record<string, unknown>;
  /** Tạo xong chạy luôn. */
  start?: unknown;
  /** Hẹn giờ chạy (ms từ epoch). Có thì không chạy ngay dù `start`. */
  startAt?: unknown;
};

export const createBatch = (body: CreateBatchInput) => {
  const source: BatchSource =
    body.source === "media" || body.source === "variants" || body.source === "custom" || body.source === "subs" ||
    body.source === "edit"
      ? body.source : "ideas";
  const settings = normalizeSettings(body.settings, DEFAULT_SETTINGS);
  const mediaModel: WhisperModel = body.mediaModel === "small" ? "small" : "medium";

  let items: BatchItem[] = [];
  let subs: SubsOptions | undefined;
  let edit: EditPlan | undefined;
  let hookPlan: Batch["hooks"];
  if (source === "edit") {
    edit = parseEditPlan(body.edit);
    items = editItems(body.items, edit);
  } else if (source === "subs") {
    const raw = body.subs ?? {};
    const spoken = SPOKEN_LANGUAGES.some((l) => l.code === raw.spoken) ? String(raw.spoken) : "auto";
    const wanted = Array.isArray(raw.languages) ? raw.languages : [""];
    // "" = giữ nguyên tiếng đang nói; trùng với tiếng đang nói thì cũng là giữ nguyên, khỏi dịch.
    const languages = [...new Set(wanted
      .map((code) => (code === "" || code === spoken ? "" : code))
      .filter((code): code is "" | TranslateLanguage => code === "" || isTranslateLanguage(code)))];
    if (languages.length === 0) throw new Error("Chọn ít nhất một ngôn ngữ phụ đề.");
    if (languages.some(Boolean) && !pickTranslateEngine()) {
      throw new Error("Dịch phụ đề cần model dịch — điền key Gemini, Groq hoặc OpenRouter (có gói miễn phí) trong Cài đặt, hoặc chỉ chọn “Giữ nguyên”.");
    }
    const crop = parseCrop(raw.crop);
    // "stack": mọi ngôn ngữ thành các hàng phụ đề trong cùng một video, mỗi hàng kiểu riêng.
    const tracks = raw.layout === "stack" && languages.length > 1 ? parseTracks(raw.tracks, languages, spoken, raw.look) : null;
    subs = { spoken, look: tracks ? tracks[0].look : parseLook(raw.look), ...(crop ? { crop } : {}), ...(tracks ? { tracks } : {}) };
    const files = (Array.isArray(body.items) ? body.items : []).map(String);
    for (const file of files) {
      checkMediaFile(file);
      if (tracks) {
        if (items.length >= MAX_ITEMS) break;
        items.push(newItem(`${uploadName(file)} · ${tracks.map((t) => subsLangLabel(t.lang, spoken)).join(" + ")}`, { file }));
        continue;
      }
      for (const lang of languages) {
        if (items.length >= MAX_ITEMS) break;
        items.push(newItem(
          lang ? `${uploadName(file)} · ${translateLanguageLabel(lang)}` : uploadName(file),
          { file, ...(lang ? { subLang: lang } : {}) },
        ));
      }
    }
  } else if (source === "ideas") {
    const raw = body.items ?? body.text;
    items = (settings.mode === "text"
      ? splitPastedScripts(Array.isArray(raw) ? raw.join("\n\n") : String(raw ?? ""))
      : cleanLines(raw)
    ).map((line) => newItem(line));
  } else if (source === "custom") {
    // Mỗi ô là một video độc lập: lời riêng, và cài đặt riêng đè lên cài đặt chung của loạt.
    const cards = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS);
    for (const raw of cards) {
      const card = (raw ?? {}) as { text?: unknown; settings?: Partial<ChatSettings> };
      const text = String(card.text ?? "").trim();
      if (!text) continue;
      const own = normalizeSettings(card.settings, settings);
      assertSettingsUsable(own);
      items.push(newItem(text, { override: own }));
    }
  } else if (source === "media") {
    const files = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS);
    items = files.map((value) => {
      const file = String(value);
      checkMediaFile(file);
      return newItem(path.basename(file), { file });
    });
  } else {
    const v = body.variants ?? {};
    const aspects = (Array.isArray(v.aspects) ? v.aspects : [])
      .map(String).filter((a) => ASPECT_IDS.includes(a as never));
    const voices = (Array.isArray(v.voices) ? v.voices : [])
      .map(String).filter((key) => key === "" || Boolean(findVoice(key)));
    const languages = (Array.isArray(v.languages) ? v.languages : [])
      .filter(isTranslateLanguage);
    const hooks = Math.max(0, Math.min(MAX_HOOKS, Math.round(Number(v.hooks) || 0)));
    // Nhân cả loạt: `from` là danh sách video gốc (các video đã xong của một loạt) — mỗi gốc × mỗi biến thể.
    // Thử hook chỉ cho một gốc: câu hook viết chung một lần cho cả loạt, nhiều gốc thì không dùng chung được.
    const froms = Array.isArray(v.from) ? [...new Set(v.from.map(String))] : [String(v.from ?? "")];
    if (froms.length > 1 && hooks > 1) throw new Error("Thử hook chỉ làm cho một video gốc mỗi lần.");
    for (const from of froms) {
      items.push(...variantItems(from, aspects, voices, languages, settings, hooks, froms.length > 1).slice(0, MAX_ITEMS - items.length));
      if (items.length >= MAX_ITEMS) break;
    }
    if (hooks > 1) hookPlan = { count: hooks - 1 };
  }

  if (items.length === 0) {
    throw new Error(
      source === "media" || source === "subs"
        ? "Chưa chọn file audio hoặc video nào."
        : source === "variants"
          ? "Chưa chọn biến thể nào — tích ít nhất một tỉ lệ, một giọng, một ngôn ngữ, hoặc chọn số hook để thử."
          : source === "custom"
            ? "Chưa ô nào có nội dung. Nhập lời hoặc ý tưởng vào ít nhất một ô."
            : "Chưa có ý tưởng nào. Mỗi dòng một video.",
    );
  }
  // Hẹn giờ: chỉ nhận mốc trong tương lai (quá 30 giây) và trong vòng một tuần.
  const at = Number(body.startAt);
  const startAt = Number.isFinite(at) && at > Date.now() + 30_000 && at < Date.now() + 7 * 86_400_000 ? Math.round(at) : undefined;
  if (body.startAt !== undefined && body.startAt !== null && !startAt) {
    throw new Error("Giờ hẹn phải ở tương lai và trong vòng 7 ngày.");
  }
  // Nguồn audio-video không gọi AI viết lời; đừng bắt người dùng có key mới chạy được.
  if (source === "ideas") assertSettingsUsable(settings);
  if (source === "variants") assertSettingsUsable({ ...settings, mode: "text" });

  const batch: Batch = {
    id: `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`,
    name: String(body.name ?? "").trim().slice(0, 60) ||
      (source === "media" ? "Từ file thu sẵn" : source === "subs" ? "Thêm phụ đề"
        : source === "variants" ? "Biến thể" : source === "edit" ? `Sửa ${items.length} video`
          : items[0].input.slice(0, 40)),
    createdAt: Date.now(),
    source,
    settings,
    // Sửa hàng loạt: lời thường không đổi nên mặc định chạy thẳng; các nguồn khác mặc định dừng cho duyệt lời.
    review: source === "edit" ? body.review === true : body.review !== false,
    mediaModel,
    ...(subs ? { subs } : {}),
    ...(edit ? { edit } : {}),
    ...(hookPlan ? { hooks: hookPlan } : {}),
    ...(startAt ? { startAt } : {}),
    state: "idle",
    items,
  };
  save(batch);
  if (body.start && !startAt) startBatch(batch.id);
  return summary(batch);
};

// ---------- đọc ----------

const counts = (batch: Batch) => {
  const by = (...status: ItemStatus[]) => batch.items.filter((i) => status.includes(i.status)).length;
  return {
    total: batch.items.length,
    done: by("done"),
    error: by("error"),
    review: by("review"),
    running: by("preparing", "building"),
    waiting: by("queued", "ready"),
    skipped: by("skipped"),
  };
};

/** Tên file như người dùng đặt: bỏ dấu thời gian mà /api/upload gắn vào đầu ("1789…-clip.mp4"). */
const uploadName = (file: string) => path.basename(file).replace(/^\d{10,}-/, "");

const checkMediaFile = (file: string) => {
  if (!MEDIA_RE.test(file) || file.includes("..")) {
    throw new Error(`File không dùng được: ${file} — cần mp4, mov, webm, mp3, wav, m4a, aac hoặc ogg.`);
  }
  if (!fs.existsSync(path.join(process.cwd(), "public", file))) {
    throw new Error(`Không thấy file: ${file}`);
  }
};

/** Kiểu phụ đề gửi từ trình duyệt: chỉ giữ trường hợp lệ, trường thiếu lấy mặc định. */
const parseLook = (raw: unknown): Partial<CaptionLook> => {
  const parsed = captionLookSchema.partial().safeParse(raw ?? {});
  if (!parsed.success) throw new Error("Kiểu phụ đề không hợp lệ.");
  return { ...DEFAULT_CAPTION_LOOK, ...parsed.data };
};

/**
 * Các hàng phụ đề theo đúng thứ tự `languages` (đã chuẩn hoá). Kiểu lấy từ `raw` theo mã ngôn ngữ;
 * hàng nào không gửi kiểu thì dùng kiểu chung, đặt cao dần theo hàng để khỏi đè lên nhau.
 */
const parseTracks = (raw: unknown, languages: ("" | TranslateLanguage)[], spoken: string, fallback: unknown): SubsTrack[] => {
  const sent = (Array.isArray(raw) ? raw : []) as { lang?: unknown; look?: unknown }[];
  return languages.map((lang, index) => {
    const match = sent.find((t) => (t?.lang === "" || t?.lang === spoken ? "" : t?.lang) === lang);
    if (match?.look) return { lang, look: parseLook(match.look) };
    const base = parseLook(fallback);
    return { lang, look: { ...base, y: Math.max(3, (base.y ?? 80) - index * 14) } };
  });
};

/** Tên hàng phụ đề cho người đọc: "" = tiếng đang nói. */
const subsLangLabel = (lang: "" | TranslateLanguage, spoken: string) =>
  lang ? translateLanguageLabel(lang) : SPOKEN_LANGUAGES.find((l) => l.code === spoken && l.code !== "auto")?.label ?? "Gốc";

const summary = (batch: Batch) => ({
  id: batch.id,
  name: batch.name,
  createdAt: batch.createdAt,
  source: batch.source,
  state: batch.state,
  review: batch.review,
  ...(batch.startAt ? { startAt: batch.startAt } : {}),
  counts: counts(batch),
});

export const listBatches = () => {
  if (!fs.existsSync(batchesDir())) return { batches: [] };
  const batches = fs
    .readdirSync(batchesDir())
    .filter((name) => name.endsWith(".json"))
    .map((name) => load(name.replace(/\.json$/, "")))
    .filter((batch): batch is Batch => Boolean(batch))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(summary);
  return { batches };
};

/**
 * Tình trạng chỉnh sửa của từng video đã xong — sửa từng video trong trình chỉnh sửa rồi mới tải cả loạt:
 * - edited: đã xuất ít nhất một lần từ trình chỉnh sửa (gói tải về lấy bản đó — out/<slug>.mp4 + props.json).
 * - draft: còn thay đổi đang sửa dở CHƯA xuất — gói tải về chưa có phần này.
 * Video đã được xuất lại thì làm mới link video và ảnh bìa để ô trên bảng không hiện bản cũ.
 */
const refreshEdits = (batch: Batch) => {
  let changed = false;
  const items = batch.items.map((item) => {
    if (item.status !== "done" || !item.slug) return item;
    const mp4 = path.join(process.cwd(), "out", `${item.slug}.mp4`);
    if (!fs.existsSync(mp4)) return item;
    const edited = readChat(item.slug).messages.some((m) => m.role === "assistant" && (m as { edited?: boolean }).edited);
    const dir = versionsDir(item.slug);
    const draft = fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(".draft.json"));
    const mtime = Math.round(fs.statSync(mp4).mtimeMs);
    const poster = item.poster ? path.join(process.cwd(), "public", item.poster) : "";
    if (edited && (!poster || !fs.existsSync(poster) || fs.statSync(poster).mtimeMs < mtime)) {
      item.poster = makePoster(item.slug, mp4);
      item.mp4 = `/out/${item.slug}.mp4?t=${mtime}`;
      changed = true;
    }
    // Kết quả tự soát (scripts/qa-video.ts) — chỉ khi còn khớp bản mp4 hiện tại, sửa rồi xuất lại thì phải soát lại.
    return {
      ...item, edited, draft,
      qa: savedCheck(item.slug), cover: freshCover(item.slug), exports: exportsOf(item.slug), branded: freshBrand(item.slug),
    };
  });
  if (changed) save(batch);
  return items;
};

/**
 * Gom lỗi theo nguyên nhân để xử lý cả nhóm một lần: loạt 30 video mà 12 cái dính hết hạn mức thì chỉ cần
 * một nút "Chạy lại 12", không phải đọc từng câu lỗi. Dựa vào tiền tố emoji của scripts/provider-error.ts
 * (⏳ 📅 💳 🔑 🔥 📏) và vài câu lỗi quen thuộc của app.
 */
export type ErrorGroup = "wait" | "quota" | "key" | "content" | "missing" | "other";

export const errorGroup = (message: string): ErrorGroup => {
  if (/⏳|🔥|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|network|timed? ?out|quá tải/i.test(message)) return "wait";
  if (/📅|💳|hết lượt|hết tiền|credit|quota/i.test(message)) return "quota";
  if (/🔑|Chưa có (key|AI nào|model)|Cần key|cần key|thiếu key|key sai|API key|401|403/i.test(message)) return "key";
  if (/Không thấy file|không còn|chưa có kịch bản|không có kịch bản|chưa dựng lần nào|ENOENT/i.test(message)) return "missing";
  if (/📏|sai cấu trúc|JSON|không trả về|trả thiếu|quá dài|không hiểu|cú pháp|không nghe ra/i.test(message)) return "content";
  return "other";
};

export const readBatch = (id: unknown) => {
  const batch = require_(id);
  const items = refreshEdits(batch).map((item) =>
    item.status === "error" && item.error ? { ...item, errorGroup: errorGroup(item.error) } : item);
  return { ...batch, items, counts: counts(batch), postCopy: batchPostCopyStatus(batch) };
};

export const deleteBatch = (id: unknown) => {
  const batch = require_(id);
  if (batch.items.some((item) => item.status === "preparing" || item.status === "building")) {
    throw new Error("Loạt này đang chạy — bấm Tạm dừng rồi xoá.");
  }
  fs.rmSync(batchFile(batch.id), { force: true });
  cache.delete(batch.id);
  return { ok: true };
};

// ---------- hẹn giờ ----------

/**
 * Mỗi 30 giây xem có loạt nào tới giờ hẹn thì chạy. Đọc từ đĩa (listBatches nạp mọi loạt vào cache) để loạt hẹn
 * từ trước khi khởi động lại app vẫn chạy. Lỡ giờ vì app tắt thì mở app lên là chạy bù ngay.
 */
const scheduleTick = () => {
  const now = Date.now();
  try {
    if (!fs.existsSync(batchesDir())) return;
    for (const name of fs.readdirSync(batchesDir())) {
      if (!name.endsWith(".json")) continue;
      const batch = load(name.replace(/\.json$/, ""));
      if (batch?.startAt && batch.startAt <= now && batch.state === "idle") startBatch(batch.id);
    }
  } catch (error) {
    console.warn("Hẹn giờ loạt:", errorText(error));
  }
};
setInterval(scheduleTick, 30_000).unref();
setTimeout(scheduleTick, 3_000).unref();

// ---------- điều khiển ----------

export const startBatch = (id: unknown) => {
  const batch = require_(id);
  // Bấm "Chạy ngay" trước giờ hẹn, hoặc tới giờ hẹn: giờ hẹn hết tác dụng.
  delete batch.startAt;
  if (batch.source === "ideas") assertSettingsUsable(batch.settings);
  batch.state = "running";
  // Chạy lại loạt đã dừng: những mục lỗi không tự thử lại, phải bấm "Chạy lại".
  save(batch);
  pump();
  return summary(batch);
};

export const pauseBatch = (id: unknown) => {
  const batch = require_(id);
  // Mục đang chạy vẫn chạy nốt — dừng ngang chỉ để lại file dở. Loạt đang hẹn giờ thì huỷ hẹn.
  delete batch.startAt;
  batch.state = "paused";
  save(batch);
  return summary(batch);
};

const pickItems = (batch: Batch, ids: unknown, when: (item: BatchItem) => boolean) => {
  const list = Array.isArray(ids) ? ids.map(String) : null;
  return batch.items.filter((item) => (list ? list.includes(item.id) : true) && when(item));
};

/** Duyệt lời: mục đang chờ duyệt chuyển sang hàng đợi dựng. */
export const approveItems = (id: unknown, ids: unknown) => {
  const batch = require_(id);
  const picked = pickItems(batch, ids, (item) => item.status === "review");
  for (const item of picked) {
    item.status = "ready";
    item.error = undefined;
  }
  if (picked.length > 0 && batch.state !== "running") batch.state = "running";
  save(batch);
  pump();
  return { approved: picked.length, ...summary(batch) };
};

/** Chạy lại: mục lỗi (hoặc mục đã xong muốn làm lại) quay về đầu hàng đợi. */
export const retryItems = (id: unknown, ids: unknown) => {
  const batch = require_(id);
  const picked = pickItems(batch, ids, (item) =>
    item.status === "error" || item.status === "done" || item.status === "skipped");
  for (const item of picked) {
    // Đã có kịch bản rồi thì chạy lại từ bước dựng, khỏi gọi AI viết lại lời.
    const hasScript = item.slug
      ? fs.existsSync(path.join(videoDir(item.slug), item.file ? "props.json" : "script.json"))
      : false;
    item.status = hasScript ? (batch.review ? "review" : "ready") : "queued";
    item.error = undefined;
    item.progress = 0;
    item.step = undefined;
  }
  if (picked.length > 0) batch.state = "running";
  save(batch);
  pump();
  return { retried: picked.length, ...summary(batch) };
};

/**
 * Sửa nội dung một mục rồi làm lại từ đầu — bấm vào ô video trên bảng là ra ô nhập này.
 *
 * Xoá cả script.json lẫn props.json của video cũ trước khi chạy lại. Còn script.json thì
 * bước chuẩn bị hiểu lời mới là "yêu cầu sửa kịch bản cũ", trong khi ý người dùng là làm
 * hẳn video khác; còn props.json mà không còn kịch bản thì nó lại tưởng đây là video dựng
 * từ file audio và từ chối. Thư mục giữ nguyên nên không đẻ ra video rác trong Thư viện.
 */
export const editItem = (id: unknown, body: unknown) => {
  const batch = require_(id);
  const { itemId, text, settings } = (body ?? {}) as {
    itemId?: unknown; text?: unknown; settings?: Partial<ChatSettings>;
  };
  const item = batch.items.find((i) => i.id === String(itemId));
  if (!item) throw new Error("Không thấy ô này trong loạt.");
  if (item.file || item.variant || item.edit) {
    throw new Error("Ô này dựng từ file thu sẵn hoặc từ video gốc — sửa trong chính video đó.");
  }
  if (item.status === "preparing" || item.status === "building") {
    throw new Error("Ô này đang chạy — đợi xong rồi sửa.");
  }
  const next = String(text ?? "").trim();
  if (!next) throw new Error("Nhập nội dung trước đã.");

  const own = normalizeSettings(settings, batch.settings);
  assertSettingsUsable(own);

  item.input = next;
  item.override = own;
  if (item.slug) {
    for (const file of ["script.json", "props.json"]) {
      fs.rmSync(path.join(videoDir(item.slug), file), { force: true });
    }
    fs.rmSync(path.join(process.cwd(), "public", "thumbs", `${item.slug}.jpg`), { force: true });
  }
  Object.assign(item, {
    status: "queued" as ItemStatus,
    error: undefined, progress: 0, step: undefined,
    title: undefined, lines: undefined, scenes: undefined, mp4: undefined, images: undefined,
    poster: undefined,
    log: [], finishedAt: undefined,
  });
  batch.state = "running";
  save(batch);
  pump();
  return summary(batch);
};

/** Kịch bản đã viết của một mục (script.json) — null nếu mục chưa tới bước viết lời hoặc dựng từ file thu sẵn. */
const itemScript = (item: BatchItem): VideoScript | null => {
  if (!item.slug || item.file) return null;
  const file = path.join(videoDir(item.slug), "script.json");
  return fs.existsSync(file) ? parseScript(JSON.parse(fs.readFileSync(file, "utf8"))) : null;
};

/** Toàn bộ lời của một mục dạng văn bản (cú pháp dán sẵn) để sửa ngay trên bảng. */
export const readItemScript = (id: unknown, itemId: unknown) => {
  const batch = require_(id);
  const item = batch.items.find((i) => i.id === String(itemId));
  if (!item) throw new Error("Không thấy ô này trong loạt.");
  const script = itemScript(item);
  return script ? { text: scriptToText(script), title: script.title, scenes: script.scenes.length } : { text: null };
};

/**
 * Lưu lời người dùng sửa (hoặc dán đè) cho một mục rồi dựng lại từ lời đó — KHÔNG gọi AI viết lại.
 * Giữ phong cách, màu, handle của kịch bản cũ và ảnh từng cảnh theo thứ tự (cảnh mới thêm thì tìm ảnh mới).
 * Mục đang chờ duyệt: `approve` = lưu rồi duyệt luôn; không thì vẫn chờ duyệt. Mục đã xong/lỗi/bỏ qua: dựng lại.
 */
export const saveItemScript = (id: unknown, body: unknown) => {
  const batch = require_(id);
  const { itemId, text, settings, approve } = (body ?? {}) as {
    itemId?: unknown; text?: unknown; settings?: Partial<ChatSettings>; approve?: unknown;
  };
  const item = batch.items.find((i) => i.id === String(itemId));
  if (!item) throw new Error("Không thấy ô này trong loạt.");
  if (item.status === "preparing" || item.status === "building") {
    throw new Error("Ô này đang chạy — đợi xong rồi sửa.");
  }
  if (item.edit === "props") {
    throw new Error("Loạt này giữ nguyên lời và chỉnh sửa tay của video — muốn sửa lời thì mở video trong trình chỉnh sửa.");
  }
  const old = itemScript(item);
  if (!old || !item.slug) throw new Error("Ô này chưa có lời để sửa — dùng Viết lại từ ý tưởng.");

  const own = settings ? normalizeSettings(settings, batch.settings) : itemSettings(batch, item);
  const style = own.style === "auto" ? old.style : own.style;
  // Ảnh đã dùng: props.json (ảnh tìm lúc dựng nằm ở đây) rồi mới tới script.json.
  const props = readJson(path.join(videoDir(item.slug), "props.json")) as { scenes?: { image?: string | null }[] } | null;
  const previousImages = old.scenes.map((scene, i) => props?.scenes?.[i]?.image ?? scene.image ?? null);
  const parsed = textToScript(String(text ?? ""), { style, previousImages }).script;
  const script = parseScript({
    ...old, style, title: parsed.title, subtitle: parsed.subtitle,
    // "! …" đọc lại luôn là con số; cảnh cũ là huy hiệu cùng chữ thì giữ huy hiệu.
    scenes: parsed.scenes.map((scene, i) => {
      const was = old.scenes[i]?.visual;
      return was?.type === "badge" && scene.visual?.type === "stat" && scene.visual.text === was.text
        ? { ...scene, visual: { ...scene.visual, type: "badge" as const } }
        : scene;
    }),
  });
  fs.writeFileSync(path.join(videoDir(item.slug), "script.json"), JSON.stringify(script, null, 2));

  if (settings) item.override = own;
  Object.assign(item, previewOf(script));
  item.error = undefined;
  if (item.status === "review") {
    if (approve === true) item.status = "ready";
  } else {
    Object.assign(item, {
      status: "ready" as ItemStatus, progress: 0, step: undefined,
      mp4: undefined, images: undefined, poster: undefined, log: [], finishedAt: undefined,
    });
  }
  if (item.status === "ready") batch.state = "running";
  save(batch);
  pump();
  return summary(batch);
};

/** Bỏ qua: không dựng mục này nữa. Video đã tạo (nếu có) vẫn nằm trong Thư viện. */
export const skipItems = (id: unknown, ids: unknown) => {
  const batch = require_(id);
  const picked = pickItems(batch, ids, (item) =>
    item.status !== "preparing" && item.status !== "building" && item.status !== "done");
  for (const item of picked) {
    item.status = "skipped";
    item.progress = 0;
  }
  save(batch);
  refreshState(batch);
  return { skipped: picked.length, ...summary(batch) };
};

/** Xoá hẳn mục khỏi loạt, kèm video của nó nếu đã tạo (đưa vào thùng rác của app). */
export const removeItems = (id: unknown, ids: unknown, alsoVideo = false) => {
  const batch = require_(id);
  const picked = pickItems(batch, ids, (item) =>
    item.status !== "preparing" && item.status !== "building");
  const gone = new Set(picked.map((item) => item.id));
  const slugs = picked
    .map((item) => item.slug)
    .filter((slug): slug is string => Boolean(slug) && fs.existsSync(videoDir(slug as string)));
  // Loạt sửa hàng loạt trỏ vào video người dùng đã có từ trước — bỏ khỏi loạt không bao giờ xoá video đó.
  if (alsoVideo && slugs.length > 0 && batch.source !== "edit") {
    // Video đi vào thùng rác của app, không xoá thẳng — người dùng khôi phục được.
    deleteProjects(slugs);
  }
  batch.items = batch.items.filter((item) => !gone.has(item.id));
  save(batch);
  refreshState(batch);
  return { removed: picked.length, ...summary(batch) };
};

/**
 * Đổi kiểu phụ đề chung của loạt "subs": ghi vào props.json của mọi video đã phiên âm, rồi dựng lại
 * những video đã xong. Mục chưa phiên âm tự lấy kiểu mới khi tới lượt; mục đang dựng thì dựng xong
 * sẽ dựng lại lần nữa.
 */
export const restyleSubs = (id: unknown, rawLook: unknown, rawLooks?: unknown) => {
  const batch = require_(id);
  if (batch.source !== "subs" || !batch.subs) throw new Error("Loạt này không phải loạt thêm phụ đề.");
  // Loạt nhiều hàng: mỗi hàng một kiểu; hàng 0 là kiểu chung của video, hàng sau ghi vào `style` từng câu.
  const tracks = batch.subs.tracks;
  const looks = tracks
    ? tracks.map((track, k) => parseLook(Array.isArray(rawLooks) && rawLooks[k] ? rawLooks[k] : k === 0 && rawLook ? rawLook : track.look))
    : null;
  const look = looks ? looks[0] : parseLook(rawLook);
  batch.subs.look = look;
  if (tracks && looks) tracks.forEach((track, k) => { track.look = looks[k]; });
  let rerender = 0;
  for (const item of batch.items) {
    const propsPath = item.slug ? path.join(videoDir(item.slug), "props.json") : "";
    if (!propsPath || !fs.existsSync(propsPath)) continue;
    const props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
    props.captionLook = look;
    if (looks) {
      props.captions = (props.captions as Caption[]).map((caption) => {
        const k = caption.track ?? 0;
        return k > 0 && looks[k] ? { ...caption, style: looks[k] } : caption;
      });
    }
    fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
    if (item.status === "building") {
      item.restyle = true;
    } else if (item.status === "done" || item.status === "error") {
      Object.assign(item, { status: "ready" as ItemStatus, error: undefined, progress: 0, step: undefined });
      rerender += 1;
    }
  }
  if (rerender > 0 || batch.items.some((item) => item.restyle)) batch.state = "running";
  save(batch);
  pump();
  return { rerender, ...summary(batch) };
};

// ---------- bộ chạy ----------

let heavy = 0;
let light = 0;

const refreshState = (batch: Batch) => {
  if (batch.state === "paused" || batch.state === "idle") return;
  const busy = batch.items.some((item) =>
    item.status === "queued" || item.status === "preparing" ||
    item.status === "ready" || item.status === "building");
  const waitingReview = batch.items.some((item) => item.status === "review");
  // Còn mục chờ duyệt thì loạt vẫn "đang chạy" — chỉ là đang chờ người, không chờ máy.
  batch.state = busy || waitingReview ? "running" : "done";
  save(batch);
};

/** Mục dùng CPU nặng: phiên âm (nguồn file) và mọi bước dựng. */
const isHeavyPrepare = (item: BatchItem) => Boolean(item.file);

const pump = () => {
  for (const batch of cache.values()) {
    if (batch.state !== "running") continue;

    // Dựng trước: xong sớm cái nào người dùng có video cái đó.
    for (const item of batch.items) {
      if (heavy >= HEAVY_LIMIT) break;
      if (item.status === "ready") void run(batch, item, "build");
    }
    for (const item of batch.items) {
      if (item.status !== "queued") continue;
      if (isHeavyPrepare(item) ? heavy >= HEAVY_LIMIT : light >= LIGHT_LIMIT) continue;
      void run(batch, item, "prepare");
    }
    refreshState(batch);
  }
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const run = async (batch: Batch, item: BatchItem, phase: "prepare" | "build") => {
  const usesHeavy = phase === "build" || isHeavyPrepare(item);
  if (usesHeavy) heavy += 1; else light += 1;

  item.status = phase === "prepare" ? "preparing" : "building";
  item.progress = 0;
  item.error = undefined;
  item.startedAt = item.startedAt ?? Date.now();
  save(batch);

  const log = (line: string) => {
    const progress = line.match(/^__PROGRESS__ (\d+)/);
    if (progress) {
      item.progress = Math.min(100, Number(progress[1]));
      return;
    }
    const step = line.match(/^__STEP__ (\w+)/);
    if (step) {
      item.step = step[1];
      item.progress = 0;
      return;
    }
    if (line.startsWith("__")) return;
    item.log.push(line);
    if (item.log.length > LOG_LINES) item.log.splice(0, item.log.length - LOG_LINES);
  };

  try {
    if (phase === "prepare") {
      const keep = await prepare(batch, item, log);
      item.status = keep === false ? "skipped" : batch.review ? "review" : "ready";
    } else {
      await build(batch, item, log);
      await autoCheck(item, log);
      item.status = "done";
      item.finishedAt = Date.now();
      if (item.restyle) {
        // Kiểu phụ đề đổi trong lúc đang dựng — bản vừa xong là kiểu cũ, xếp hàng dựng lại.
        item.restyle = false;
        item.status = "ready";
      }
    }
    item.progress = 0;
    item.step = undefined;
  } catch (error) {
    item.status = "error";
    item.error = errorText(error);
    item.finishedAt = Date.now();
    log(`Lỗi: ${item.error}`);
  } finally {
    if (usesHeavy) heavy -= 1; else light -= 1;
    save(batch);
    refreshState(batch);
    pump();
  }
};

// ---------- bước 1: chuẩn bị ----------

const itemSettings = (batch: Batch, item: BatchItem) =>
  item.override ? normalizeSettings(item.override, batch.settings) : batch.settings;

const previewOf = (script: VideoScript) => ({
  title: script.title,
  scenes: script.scenes.length,
  lines: allLines(script).slice(0, 40),
});

/** Trả về false = mục này không có gì để làm (ví dụ không chứa chữ cần thay) — đánh dấu bỏ qua, khỏi render. */
const prepare = async (batch: Batch, item: BatchItem, log: (line: string) => void): Promise<boolean | void> => {
  if (item.file) return prepareMedia(batch, item, log);
  if (item.variant) return prepareVariant(batch, item, log);
  if (item.edit) return prepareEdit(batch, item, log);

  const settings = itemSettings(batch, item);
  // Dán cả kịch bản: đặt tên thư mục theo tiêu đề, không theo cả khối văn bản.
  let name = item.input;
  if (settings.mode === "text") {
    try {
      name = textToScript(item.input, { style: settings.style }).script.title;
    } catch {
      // lỗi cú pháp sẽ lộ ra ở prepareScript ngay bên dưới, kèm thông báo rõ hơn
    }
  }
  const slug = item.slug ?? freshSlug(name);
  item.slug = slug;
  // Ghi chat.json ngay để video hiện trong Thư viện và mở lại được như video làm tay.
  writeChat(slug, {
    messages: [{ role: "user", text: item.input, at: Date.now() }],
    settings,
  });

  log("__STEP__ script");
  const { script } = await prepareScript(slug, item.input, [], settings, log);
  Object.assign(item, previewOf(script));
};

/** Biến thể: chép kịch bản gốc sang video mới, dịch nếu đổi ngôn ngữ. */
const prepareVariant = async (batch: Batch, item: BatchItem, log: (line: string) => void) => {
  const { from, lang } = item.variant!;
  const settings = itemSettings(batch, item);
  const sourcePath = path.join(videoDir(from), "script.json");
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Video gốc “${from}” không còn kịch bản.`);
  }
  const source = parseScript(JSON.parse(fs.readFileSync(sourcePath, "utf8")));

  log("__STEP__ script");
  let script = source;
  const hook = item.variant!.hook;
  if (hook) {
    const hooks = await batchHooks(batch, source, settings, log);
    const line = hooks[hook - 1];
    if (!line) throw new Error(`AI chỉ viết được ${hooks.length} câu hook — bỏ qua bản này hoặc bấm Chạy lại.`);
    script = JSON.parse(JSON.stringify(source)) as VideoScript;
    script.scenes[0].lines[0] = line;
    log(`Hook ${HOOK_LETTERS[hook]}: ${line}`);
  }
  if (lang) {
    const engine = pickTranslateEngine();
    if (!engine) {
      throw new Error(
        "Chưa có model dịch. Điền key Gemini, Groq, OpenRouter (có gói miễn phí) trong Cài đặt, hoặc bỏ tích ngôn ngữ.",
      );
    }
    log(`Đang dịch sang ${translateLanguageLabel(lang)}…`);
    script = await translateScript(script, lang, engine, log);
  }

  // Tên thư mục: tiêu đề gốc rút ngắn + hậu tố cho biết đây là biến thể nào, để đừng
  // ra "…-2", "…-3" không đọc được là bản nào.
  const suffix = [hook === undefined ? null : `hook-${HOOK_LETTERS[hook].toLowerCase()}`,
    lang, item.variant!.aspect?.replace(":", "x"), item.variant!.voice || "khong-giong"]
    .filter(Boolean).join(" ");
  const slug = item.slug ?? freshSlug(`${source.title.slice(0, 28)} ${suffix}`.trim());
  item.slug = slug;
  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(path.join(videoDir(slug), "script.json"), JSON.stringify(script, null, 2));
  writeChat(slug, {
    messages: [{
      role: "user",
      text: `Bản ${item.input.replace(/^.*? — /, "")} của “${source.title}”`,
      at: Date.now(),
    }],
    settings,
  });
  Object.assign(item, previewOf(script));
};

/**
 * Câu hook dùng chung cho cả loạt: viết MỘT lần rồi lưu vào batch.hooks, để mọi bản (khác khung, khác giọng)
 * cùng hook B thì đúng là cùng một câu. Hai mục chạy song song cùng chờ một lượt gọi AI, không gọi hai lần.
 */
const hookJobs = new Map<string, Promise<string[]>>();

const batchHooks = async (batch: Batch, source: VideoScript, settings: ChatSettings, log: (line: string) => void) => {
  const plan = batch.hooks;
  if (!plan) throw new Error("Loạt này không thử hook.");
  if (plan.lines?.length) return plan.lines;
  let job = hookJobs.get(batch.id);
  if (!job) {
    log(`AI đang viết ${plan.count} câu hook khác nhau…`);
    job = generateHooks(source, plan.count, settings.provider)
      .then((lines) => {
        plan.lines = lines;
        save(batch);
        return lines;
      })
      .finally(() => hookJobs.delete(batch.id));
    hookJobs.set(batch.id, job);
  }
  return job;
};

const pickTranslateEngine = (): TranslateEngine | null =>
  TRANSLATE_ENGINES.find((engine) => !missingTranslateKey(engine)) ?? null;

/** Cắt cho vừa giới hạn của schema — bản dịch dài hơn bản gốc là chuyện thường. */
const fit = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`);

const translateScript = async (
  script: VideoScript,
  to: TranslateLanguage,
  engine: TranslateEngine,
  log: (line: string) => void,
): Promise<VideoScript> => {
  // Gom mọi chuỗi cần dịch vào MỘT lượt gọi: giữ đúng thứ tự, và model thấy cả ngữ cảnh video.
  const draft: VideoScript = JSON.parse(JSON.stringify(script));
  const slots: { get: () => string; set: (value: string) => void }[] = [
    { get: () => draft.title, set: (v) => (draft.title = fit(v, 60)) },
    { get: () => draft.subtitle, set: (v) => (draft.subtitle = fit(v, 90)) },
  ];
  draft.scenes.forEach((scene) => {
    scene.lines.forEach((_, i) => {
      slots.push({ get: () => scene.lines[i], set: (v) => (scene.lines[i] = fit(v, 90)) });
    });
    if (scene.tag) slots.push({ get: () => scene.tag!, set: (v) => (scene.tag = fit(v, 18)) });
    if (scene.punch) slots.push({ get: () => scene.punch!, set: (v) => (scene.punch = fit(v, 48)) });
    if (scene.visual?.caption) {
      slots.push({ get: () => scene.visual!.caption!, set: (v) => (scene.visual!.caption = fit(v, 40)) });
    }
  });

  const translated = await translateLines(slots.map((slot) => slot.get()), { to, from: "vi", engine }, log);
  slots.forEach((slot, i) => slot.set(translated[i] ?? slot.get()));
  return parseScript(draft);
};

/**
 * Phiên âm có nhớ: loạt phụ đề nhiều ngôn ngữ dùng chung một bản phiên âm cho mọi ngôn ngữ của
 * cùng một file — phiên âm là bước nặng nhất, không làm lại cho từng bản dịch.
 * Nhớ trên đĩa (data/batches/transcripts) để khởi động lại server hay bấm Chạy lại cũng không mất.
 */
const transcriptMemory = new Map<string, Caption[]>();

const transcribeCached = async (
  source: string,
  file: string,
  spoken: string,
  model: WhisperModel,
  log: (line: string) => void,
): Promise<Caption[]> => {
  const stat = fs.statSync(source);
  const key = slugify(`${file} ${stat.size} ${stat.mtimeMs} ${spoken} ${model}`, 120);
  const cacheFile = path.join(batchesDir(), "transcripts", `${key}.json`);
  const hit = transcriptMemory.get(key) ?? readJson(cacheFile);
  if (hit) {
    log(`Dùng lại bản phiên âm của ${path.basename(source)}.`);
    return hit;
  }
  log(`Phiên âm ${path.basename(source)} bằng whisper ${model} (chạy trên máy)…`);
  const sentences = await transcribeSentences({ audioPath: source, model, language: spoken as never });
  const silences = await detectSilences(source);
  const captions = alignCaptions(sentences, silences, audioDurationMs(source)) as Caption[];
  log(`${sentences.length} câu → ${captions.length} dòng phụ đề`);
  transcriptMemory.set(key, captions);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(captions));
  return captions;
};

/** Khung gần nhất với kích thước thật của video (tính cả video quay dọc bị xoay). */
const videoAspect = (file: string): string | null => {
  const size = videoSize(file);
  return size ? aspectFor(size.width, size.height).id : null;
};

/** Kích thước hiển thị của video (đã tính xoay dọc từ điện thoại). */
const videoSize = (file: string): { width: number; height: number } | null => {
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height:stream_side_data=rotation:stream_tags=rotate",
      "-of", "json", file,
    ], { encoding: "utf8" });
    const stream = JSON.parse(out).streams?.[0];
    if (!stream?.width || !stream?.height) return null;
    const rotation = Math.abs(Number(stream.side_data_list?.[0]?.rotation ?? stream.tags?.rotate ?? 0)) % 180;
    const [width, height] = rotation === 90 ? [stream.height, stream.width] : [stream.width, stream.height];
    return { width, height };
  } catch {
    return null;
  }
};

const audioDurationMs = (file: string) =>
  Math.round(
    parseFloat(
      execFileSync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", file,
      ], { encoding: "utf8" }).trim(),
    ) * 1000,
  );

/**
 * File thu sẵn → props.json: phiên âm bằng whisper.cpp rồi khớp mép phụ đề với khoảng lặng
 * thật. Giống scripts/audio-to-video.ts, nhưng chạy trong server và báo tiến độ ra bảng.
 */
const prepareMedia = async (batch: Batch, item: BatchItem, log: (line: string) => void) => {
  const settings = itemSettings(batch, item);
  const source = path.join(process.cwd(), "public", item.file!);
  if (!fs.existsSync(source)) throw new Error(`Không thấy file: ${item.file}`);

  const baseName = path.basename(uploadName(item.file!), path.extname(item.file!));
  const slug = item.slug ?? freshSlug(item.subLang ? `${baseName} ${item.subLang}` : baseName);
  item.slug = slug;
  // Giữ chỗ tên thư mục NGAY: phiên âm mất hàng chục giây, trong lúc đó mục khác
  // gọi freshSlug sẽ thấy tên này còn trống và cùng ghi đè lên nhau.
  fs.mkdirSync(videoDir(slug), { recursive: true });

  log("__STEP__ script");
  const spoken = batch.subs?.spoken ?? "vi";
  let captions = await transcribeCached(source, item.file!, spoken, batch.mediaModel, log);
  if (captions.length === 0) {
    throw new Error("Không nghe ra câu nào trong file này — kiểm tra lại file có tiếng nói không.");
  }
  const translate = async (lines: Caption[], lang: TranslateLanguage) => {
    const engine = pickTranslateEngine();
    if (!engine) throw new Error("Chưa có model dịch — điền key Gemini, Groq hoặc OpenRouter trong Cài đặt.");
    log(`Dịch ${lines.length} dòng phụ đề sang ${translateLanguageLabel(lang)}…`);
    const translated = await translateLines(
      lines.map((caption) => caption.text),
      { to: lang, from: spoken === "auto" ? undefined : spoken, engine },
      log,
    );
    return lines.map((caption, i) => ({ ...caption, text: translated[i]?.trim() || caption.text }));
  };
  const tracks = batch.subs?.tracks;
  if (tracks) {
    // Mỗi hàng một bản (gốc hoặc dịch), cùng mốc thời gian; hàng sau mang kiểu riêng của nó.
    const original = captions;
    const rows: Caption[] = [];
    for (const [k, track] of tracks.entries()) {
      const lines = track.lang ? await translate(original, track.lang) : original;
      rows.push(...lines.map((caption) => (k === 0 ? caption : { ...caption, track: k, style: track.look })));
    }
    captions = rows;
  } else if (item.subLang) {
    captions = await translate(captions, item.subLang);
  }

  // Chuẩn hoá về mp3 48kHz stereo cho khớp phần còn lại của soundtrack.
  const trackRel = path.posix.join("voices", slug, "track.mp3");
  const trackAbs = path.join(process.cwd(), "public", trackRel);
  fs.mkdirSync(path.dirname(trackAbs), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", source, "-ar", "48000", "-ac", "2", trackAbs]);
  const durationMs = audioDurationMs(trackAbs);

  // File hình thì giữ luôn hình gốc làm cảnh; file chỉ có tiếng thì nền trơn.
  const visual = /\.(mp4|mov|webm)$/i.test(item.file!) ? item.file! : null;
  // Thêm phụ đề cho video có sẵn: giữ đúng khung của video gốc, không ép về khung trong cài đặt —
  // trừ khi loạt có cắt khung chung, lúc đó mọi video ra đúng tỉ lệ đã chọn.
  const size = batch.subs?.crop && visual ? videoSize(source) : null;
  const cut = batch.subs?.crop && size ? subsCropFor(batch.subs.crop, size.width, size.height) : null;
  const crop = cut?.crop ?? null;
  const aspect = cut ? cut.aspect
    : batch.subs && visual ? videoAspect(source) ?? settings.aspect : settings.aspect;
  const props = shortSchema.parse({
    title: captions[0]?.text.slice(0, 60) ?? path.basename(item.file!),
    subtitle: "",
    handle: "@kenh",
    accent: "#e8590c",
    background: "#0b0b12",
    captions,
    aspect,
    style: "plain",
    scenes: [{ image: visual, visual: null, startMs: 0, endMs: durationMs, ...(crop ? { crop } : {}) }],
    captionPosition: "bottom",
    ...(batch.subs ? { captionLook: batch.subs.look } : {}),
    // Audio nói ngay từ giây 0 — title card sẽ đè lên chính câu đầu.
    showTitle: false,
    voiceoverTrack: trackRel,
    music: await resolveMusicChoice(settings.music, log),
    sfx: false,
  });
  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(props, null, 2));
  writeChat(slug, {
    messages: [{
      role: "user",
      text: `Dựng video từ file ${path.basename(item.file!)}`,
      at: Date.now(),
      attachments: [item.file!],
    }],
    settings: { ...settings, mode: "text" },
  });

  // Loạt phụ đề: đặt tên theo file + ngôn ngữ, để file tải về đọc là biết bản nào.
  item.title = batch.subs
    ? `${baseName}${tracks ? ` ${tracks.map((t) => t.lang || spoken).join("+")}` : item.subLang ? ` ${item.subLang}` : ""}`
    : props.title;
  item.scenes = 1;
  // Bảng duyệt chỉ hiện hàng đầu — các hàng sau là bản dịch cùng câu.
  item.lines = captions.filter((caption) => !caption.track).map((caption) => caption.text).slice(0, 40);
};

// ---------- sửa hàng loạt video có sẵn ----------

const HEX = /^#[0-9a-f]{6}$/i;

const parseEditPlan = (raw: Record<string, unknown> | undefined): EditPlan => {
  const r = raw ?? {};
  const kind: EditKind = r.kind === "rebuild" ? "rebuild" : "props";
  const plan: EditPlan = { kind };
  // Nhạc: normalizeSettings đã biết luật đường dẫn nhạc hợp lệ — mượn nó thay vì chép lại.
  if (r.music !== undefined) {
    const music = normalizeSettings({ music: r.music as string | null }, { ...DEFAULT_SETTINGS, music: "__keep__" }).music;
    if (music === "__keep__") throw new Error("Nhạc nền không hợp lệ.");
    plan.music = music;
  }
  if (typeof r.handle === "string" && r.handle.trim()) plan.handle = r.handle.trim().slice(0, 30);
  if (typeof r.accent === "string" && r.accent.trim()) {
    if (!HEX.test(r.accent.trim())) throw new Error("Màu nhấn phải có dạng #rrggbb.");
    plan.accent = r.accent.trim();
  }
  if (kind === "rebuild") {
    const own = normalizeSettings(
      { style: r.style, voice: r.voice, aspect: r.aspect } as Partial<ChatSettings>,
      { ...DEFAULT_SETTINGS, style: "__keep__" as never, voice: "__keep__", aspect: "__keep__" },
    );
    if (r.style !== undefined && own.style !== ("__keep__" as never)) plan.style = own.style;
    if (r.voice !== undefined && own.voice !== "__keep__") plan.voice = own.voice;
    if (r.aspect !== undefined && own.aspect !== "__keep__") plan.aspect = own.aspect;
    const pairs = Array.isArray(r.replace) ? r.replace : [];
    const replace = pairs
      .map((pair) => pair as { find?: unknown; to?: unknown })
      .map((pair) => ({ find: String(pair.find ?? ""), to: String(pair.to ?? "") }))
      .filter((pair) => pair.find.trim() && pair.find !== pair.to)
      .slice(0, 20);
    if (replace.length) plan.replace = replace;
  }
  const { kind: _kind, ...changes } = plan;
  if (Object.keys(changes).length === 0) throw new Error("Chưa chọn thay đổi nào để áp cho các video.");
  return plan;
};

/** Mô tả ngắn những gì đã đổi — ghi vào lịch sử chat của từng video. */
const editSummary = (plan: EditPlan | undefined) => {
  if (!plan) return "";
  const parts: string[] = [];
  if (plan.style) parts.push(`phong cách ${plan.style}`);
  if (plan.voice !== undefined) parts.push(plan.voice ? `giọng ${plan.voice}` : "bỏ giọng");
  if (plan.aspect) parts.push(`khung ${plan.aspect}`);
  if (plan.replace) parts.push(plan.replace.map((r) => `“${r.find}” → “${r.to}”`).join(", "));
  if (plan.music !== undefined) {
    parts.push(plan.music === null ? "bỏ nhạc" : plan.music === "random" ? "nhạc ngẫu nhiên" : `nhạc ${path.basename(plan.music)}`);
  }
  if (plan.handle) parts.push(`tên kênh ${plan.handle}`);
  if (plan.accent) parts.push(`màu ${plan.accent}`);
  return parts.join(" · ");
};

/** Mỗi video được chọn là một mục; báo lỗi ngay nếu video không sửa được theo cách đã chọn. */
const editItems = (raw: unknown, plan: EditPlan): BatchItem[] => {
  const slugs = [...new Set((Array.isArray(raw) ? raw : []).map(String))].filter(isSlug).slice(0, MAX_ITEMS);
  const need = plan.kind === "rebuild" ? "script.json" : "props.json";
  const missing: string[] = [];
  const items: BatchItem[] = [];
  for (const slug of slugs) {
    if (!fs.existsSync(path.join(videoDir(slug), need))) {
      missing.push(slug);
      continue;
    }
    const script = readJson(path.join(videoDir(slug), "script.json")) as { title?: string } | null;
    const props = readJson(path.join(videoDir(slug), "props.json")) as { title?: string } | null;
    items.push(newItem(script?.title ?? props?.title ?? slug, { slug, edit: plan.kind }));
  }
  if (missing.length) {
    throw new Error(plan.kind === "rebuild"
      ? `${missing.length} video không có kịch bản (dựng từ file thu sẵn hoặc nhiều cảnh) nên không dựng lại được — bỏ chọn chúng, hoặc dùng cách “Giữ chỉnh sửa”.`
      : `${missing.length} video chưa dựng lần nào nên chưa có gì để sửa — bỏ chọn chúng.`);
  }
  return items;
};

/** Thay chữ trong mọi chuỗi người xem thấy của kịch bản. Trả về số chỗ đã thay. */
const replaceInScript = (script: VideoScript, pairs: { find: string; to: string }[]) => {
  let count = 0;
  const swap = (text: string, max: number) => {
    let out = text;
    for (const { find, to } of pairs) {
      const parts = out.split(find);
      count += parts.length - 1;
      out = parts.join(to);
    }
    return fit(out, max);
  };
  script.title = swap(script.title, 60);
  script.subtitle = swap(script.subtitle, 90);
  for (const scene of script.scenes) {
    scene.lines = scene.lines.map((line) => swap(line, 90));
    if (scene.tag) scene.tag = swap(scene.tag, 18);
    if (scene.punch) scene.punch = swap(scene.punch, 48);
    if (scene.visual?.caption) scene.visual.caption = swap(scene.visual.caption, 40);
  }
  return count;
};

const prepareEdit = async (batch: Batch, item: BatchItem, log: (line: string) => void) => {
  const plan = batch.edit;
  const slug = item.slug;
  if (!plan || !slug) throw new Error("Mục sửa hàng loạt thiếu thông tin.");
  if (!fs.existsSync(videoDir(slug))) throw new Error("Video này không còn trong Thư viện.");
  log("__STEP__ script");
  const chat = readChat(slug);
  const settings = normalizeSettings({
    ...chat.settings,
    ...(plan.music !== undefined ? { music: plan.music } : {}),
    ...(plan.style ? { style: plan.style } : {}),
    ...(plan.voice !== undefined ? { voice: plan.voice } : {}),
    ...(plan.aspect ? { aspect: plan.aspect } : {}),
  }, chat.settings);
  // Bước dựng đọc cài đặt từ item.override; chat.json cũng ghi theo để lần sửa bằng prompt sau dùng đúng giọng, khung mới.
  item.override = settings;

  if (plan.kind === "props") {
    const propsPath = path.join(videoDir(slug), "props.json");
    const props = readJson(propsPath);
    if (!props) throw new Error("Video này chưa dựng lần nào nên chưa có gì để sửa.");
    if (plan.music !== undefined) props.music = await resolveMusicChoice(plan.music, log);
    if (plan.handle) props.handle = plan.handle;
    if (plan.accent) props.accent = plan.accent;
    // Kiểm tra cho chắc nhưng ghi nguyên object: parse của zod bỏ mất trường lạ mà trình chỉnh sửa có thể đã thêm.
    shortSchema.parse(props);
    fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
    log(`Đã đổi: ${editSummary(plan)}`);
    const captions = (props.captions ?? []) as Caption[];
    item.title = props.title;
    item.scenes = Array.isArray(props.scenes) ? props.scenes.length : undefined;
    item.lines = captions.filter((caption) => !caption.track).map((caption) => caption.text).slice(0, 40);
  } else {
    const scriptPath = path.join(videoDir(slug), "script.json");
    if (!fs.existsSync(scriptPath)) throw new Error("Video này không có kịch bản nên không dựng lại được.");
    const script = parseScript(JSON.parse(fs.readFileSync(scriptPath, "utf8")));
    if (plan.replace) {
      const count = replaceInScript(script, plan.replace);
      const others = plan.style || plan.voice !== undefined || plan.aspect || plan.music !== undefined || plan.handle || plan.accent;
      if (count === 0 && !others) {
        log("Không có chữ nào cần thay trong video này — bỏ qua, không dựng lại.");
        Object.assign(item, previewOf(script));
        return false;
      }
      log(`Thay ${count} chỗ trong lời.`);
    }
    if (plan.style && plan.style !== "auto") script.style = plan.style;
    if (plan.handle) script.handle = plan.handle;
    if (plan.accent) script.accent = plan.accent;
    fs.writeFileSync(scriptPath, JSON.stringify(parseScript(script), null, 2));
    Object.assign(item, previewOf(script));
  }
  writeChat(slug, { messages: chat.messages, settings });
  return true;
};

// ---------- bước 2: dựng ----------

const appendAssistant = (slug: string, message: ChatMessage) => {
  const chat = readChat(slug);
  chat.messages.push(message);
  writeChat(slug, { messages: chat.messages, settings: chat.settings });
};

/**
 * Ảnh bìa cắt từ mp4 bằng ffmpeg. Để ô trong bảng hiện ảnh thay vì gắn thẻ <video>: một loạt
 * 50 video mà mỗi ô một thẻ video là 50 lần tải metadata, cuộn tới đâu khựng tới đó.
 * Ghi vào public/thumbs/ — thư mục này không nằm trong Thư viện nên không lẫn vào tài nguyên.
 */
const makePoster = (slug: string, mp4: string) => {
  const rel = path.posix.join("thumbs", `${slug}.jpg`);
  const output = path.join(process.cwd(), "public", rel);
  try {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    execFileSync("ffmpeg", [
      "-y", "-v", "error",
      // -ss trước -i: tua nhanh rồi mới giải mã. 1 giây để qua khỏi khung đen đầu video.
      "-ss", "1", "-i", mp4,
      "-frames:v", "1", "-q:v", "4", "-vf", "scale=360:-2",
      output,
    ]);
    return fs.existsSync(output) && fs.statSync(output).size > 0 ? rel : undefined;
  } catch {
    // Không có ảnh bìa thì ô vẫn phát được video — đừng vì thế mà báo cả mục là lỗi.
    return undefined;
  }
};

const build = async (batch: Batch, item: BatchItem, log: (line: string) => void) => {
  const slug = item.slug;
  if (!slug) throw new Error("Mục này chưa chuẩn bị xong.");
  const settings = itemSettings(batch, item);

  // Nguồn file thu sẵn không có kịch bản, và sửa hàng loạt kiểu giữ chỉnh sửa — render thẳng từ props.json.
  if (item.file || item.edit === "props") {
    log("__STEP__ render");
    const result = await runRenderStage(slug, undefined, log);
    item.mp4 = `${result.mp4}?t=${Date.now()}`;
    item.poster = makePoster(slug, path.join(process.cwd(), "out", `${slug}.mp4`));
    const props = readJson(path.join(videoDir(slug), "props.json")) as { aspect?: string } | null;
    appendAssistant(slug, {
      role: "assistant",
      at: Date.now(),
      text: item.edit
        ? `Đã sửa hàng loạt: ${editSummary(batch.edit)} · ${(result.durationInFrames / 30).toFixed(1)}s`
        : `Đã dựng “${item.title ?? slug}” từ file thu sẵn · ${(result.durationInFrames / 30).toFixed(1)}s`,
      mp4: item.mp4,
      aspect: props?.aspect ?? settings.aspect,
    });
    return;
  }

  const scriptPath = path.join(videoDir(slug), "script.json");
  if (!fs.existsSync(scriptPath)) throw new Error(`${slug} chưa có kịch bản.`);
  const script = parseScript(JSON.parse(fs.readFileSync(scriptPath, "utf8")));
  const result = await buildFromScript(slug, script, settings, log, Boolean(item.edit));
  if (item.edit) result.text = `Đã sửa hàng loạt: ${editSummary(batch.edit)} · ${result.text}`;

  item.mp4 = result.mp4;
  item.images = result.images;
  item.poster = result.mp4
    ? makePoster(slug, path.join(process.cwd(), "out", `${slug}.mp4`))
    : undefined;
  item.title = script.title;
  item.scenes = script.scenes.length;
  appendAssistant(slug, { role: "assistant", at: Date.now(), ...result });
};

// ---------- tự soát chất lượng ----------

/**
 * Soát ngay sau khi render xong, vẫn trong suất "việc nặng" của mục đó — một lượt ffmpeg vài giây.
 * Soát lỗi thì chỉ ghi log: video đã render xong, không vì bước soát mà đánh dấu lỗi cả mục.
 */
const autoCheck = async (item: BatchItem, log: (line: string) => void) => {
  if (!item.slug || !fs.existsSync(path.join(process.cwd(), "out", `${item.slug}.mp4`))) return;
  log("__STEP__ check");
  try {
    const qa = await checkVideo(item.slug);
    log(`Tự soát: ${qa.score}/10${qa.issues.length ? ` — ${qa.issues.length} điểm cần xem` : ""}`);
  } catch (error) {
    log(`Không soát được: ${errorText(error)}`);
  }
};

/** Soát lại cả loạt (loạt làm trước khi có tính năng này, hoặc video đã sửa rồi xuất lại). Chạy nền, lần lượt. */
type CheckRun = { running: boolean; total: number; done: number };
const checkRuns = new Map<string, CheckRun>();

export const startBatchCheck = (id: unknown) => {
  const batch = require_(id);
  const current = checkRuns.get(batch.id);
  if (current?.running) return { run: current };
  const slugs = doneItems(batch).map(({ item }) => item.slug!).filter((slug) => !savedCheck(slug));
  const run: CheckRun = { running: slugs.length > 0, total: slugs.length, done: 0 };
  checkRuns.set(batch.id, run);
  void (async () => {
    for (const slug of slugs) {
      try {
        await checkVideo(slug);
      } catch {
        // video lỗi file thì bỏ qua — ô đó hiện "chưa soát", bấm lại được
      }
      run.done++;
    }
    run.running = false;
  })();
  return { run };
};

export const batchCheckStatus = (id: unknown) => ({ run: checkRuns.get(require_(id).id) ?? null });

// ---------- ảnh bìa (scripts/cover.ts) ----------

type CoverRun = { running: boolean; total: number; done: number; failed: number; error?: string };
const coverRuns = new Map<string, CoverRun>();

/** Làm ảnh bìa cho video đã xong chưa có bìa (hoặc bìa cũ hơn bản mp4). `force` = làm lại tất cả. */
export const startBatchCovers = (id: unknown, force = false) => {
  const batch = require_(id);
  const current = coverRuns.get(batch.id);
  if (current?.running) return { run: current };
  const slugs = doneItems(batch).map(({ item }) => item.slug!).filter((slug) => force || !freshCover(slug));
  const run: CoverRun = { running: slugs.length > 0, total: slugs.length, done: 0, failed: 0 };
  coverRuns.set(batch.id, run);
  void (async () => {
    for (const slug of slugs) {
      try {
        await makeCover(slug);
        run.done++;
      } catch (error) {
        run.failed++;
        run.error = errorText(error);
      }
    }
    run.running = false;
  })();
  return { run };
};

export const batchCoversStatus = (id: unknown) => ({ run: coverRuns.get(require_(id).id) ?? null });

// ---------- xuất thêm khung hình ----------

/**
 * Bản khác khung của video đã xong (vd. loạt 9:16 xuất thêm 1:1 cho Facebook, 16:9 cho YouTube): render lại
 * từ props.json hiện có — giữ lời, giọng, chỉnh sửa tay — chỉ đổi `aspect`. Không tạo video mới trong Thư viện;
 * file nằm ở out/exports/<slug>/<khung>.mp4 và vào gói Tải tất cả trong thư mục theo khung.
 */
const exportPath = (slug: string, aspect: string) =>
  path.join(process.cwd(), "out", "exports", slug, `${aspect.replace(":", "x")}.mp4`);

/** Bản xuất còn mới hơn bản mp4 chính (sửa video rồi xuất lại thì bản khác khung cũng phải làm lại). */
const freshExport = (slug: string, aspect: string) => {
  const file = exportPath(slug, aspect);
  const main = path.join(process.cwd(), "out", `${slug}.mp4`);
  return fs.existsSync(file) && (!fs.existsSync(main) || fs.statSync(file).mtimeMs >= fs.statSync(main).mtimeMs);
};

/** Các khung đã xuất (còn mới) của một video — hiện trên ô, và cho gói tải về. */
const exportsOf = (slug: string) => ASPECT_IDS.filter((aspect) => freshExport(slug, aspect));

type ExportRun = { running: boolean; total: number; done: number; failed: number; error?: string; current?: string };
const exportRuns = new Map<string, ExportRun>();

export const startBatchExports = (id: unknown, rawAspects: unknown) => {
  const batch = require_(id);
  const current = exportRuns.get(batch.id);
  if (current?.running) return { run: current };
  // Render ăn trọn CPU: chạy chen với loạt đang dựng chỉ làm cả hai cùng chậm.
  if (batch.items.some((item) => item.status === "building" || item.status === "preparing")) {
    throw new Error("Loạt đang dựng — đợi dựng xong (hoặc Tạm dừng) rồi xuất thêm khung.");
  }
  const aspects = (Array.isArray(rawAspects) ? rawAspects : []).map(String).filter((a) => ASPECT_IDS.includes(a as never));
  if (aspects.length === 0) throw new Error("Chọn ít nhất một khung hình để xuất.");
  const jobs: { slug: string; aspect: string }[] = [];
  for (const { item } of doneItems(batch)) {
    const props = readJson(path.join(videoDir(item.slug!), "props.json")) as { aspect?: string } | null;
    if (!props) continue;
    for (const aspect of aspects) {
      // Khung gốc của video đã có sẵn ở bản chính.
      if (aspect !== (props.aspect ?? "9:16") && !freshExport(item.slug!, aspect)) jobs.push({ slug: item.slug!, aspect });
    }
  }
  const run: ExportRun = { running: jobs.length > 0, total: jobs.length, done: 0, failed: 0 };
  exportRuns.set(batch.id, run);
  void (async () => {
    for (const { slug, aspect } of jobs) {
      run.current = `${slug} · ${aspect}`;
      heavy += 1;
      try {
        const props = shortSchema.parse(JSON.parse(fs.readFileSync(path.join(videoDir(slug), "props.json"), "utf8")));
        const out = exportPath(slug, aspect);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        await renderShort({ ...props, aspect: aspect as AspectId }, out);
        run.done++;
      } catch (error) {
        run.failed++;
        run.error = errorText(error);
      } finally {
        heavy -= 1;
      }
    }
    run.running = false;
    run.current = undefined;
    pump();
  })();
  return { run };
};

export const batchExportsStatus = (id: unknown) => ({ run: exportRuns.get(require_(id).id) ?? null });

// ---------- đoạn mở đầu / kết thúc chung (scripts/brand.ts) ----------

const brandPath = (slug: string) => path.join(process.cwd(), "out", "exports", slug, "brand.mp4");

/** Bản có mở đầu/kết thúc còn mới hơn bản mp4 chính. */
const freshBrand = (slug: string) => {
  const file = brandPath(slug);
  const main = path.join(process.cwd(), "out", `${slug}.mp4`);
  return fs.existsSync(file) && (!fs.existsSync(main) || fs.statSync(file).mtimeMs >= fs.statSync(main).mtimeMs);
};

type BrandRun = { running: boolean; total: number; done: number; failed: number; error?: string };
const brandRuns = new Map<string, BrandRun>();

const brandFile = (value: unknown) => {
  const rel = typeof value === "string" ? value.trim().replace(/^\/+/, "") : "";
  if (!rel) return null;
  if (rel.includes("..") || !isBrandFile(rel) || !fs.existsSync(path.join(process.cwd(), "public", rel))) {
    throw new Error(`File ${rel} không dùng được — chọn ảnh hoặc video trong thư viện.`);
  }
  return rel;
};

/** Gắn mở đầu/kết thúc cho MỌI video đã xong (đổi file thì làm lại hết cho đồng bộ). Ghép bằng ffmpeg, vài giây mỗi video. */
export const startBatchBrand = (id: unknown, body: unknown) => {
  const batch = require_(id);
  const current = brandRuns.get(batch.id);
  if (current?.running) return { run: current };
  const raw = (body ?? {}) as { intro?: unknown; outro?: unknown };
  const brand = { intro: brandFile(raw.intro), outro: brandFile(raw.outro) };
  if (!brand.intro && !brand.outro) throw new Error("Chọn ít nhất một đoạn mở đầu hoặc kết thúc.");
  batch.brand = brand;
  save(batch);
  const slugs = doneItems(batch).map(({ item }) => item.slug!);
  const run: BrandRun = { running: slugs.length > 0, total: slugs.length, done: 0, failed: 0 };
  brandRuns.set(batch.id, run);
  void (async () => {
    for (const slug of slugs) {
      try {
        await brandVideo(path.join(process.cwd(), "out", `${slug}.mp4`), brandPath(slug), brand);
        run.done++;
      } catch (error) {
        run.failed++;
        run.error = errorText(error);
      }
    }
    run.running = false;
  })();
  return { run };
};

export const batchBrandStatus = (id: unknown) => ({ run: brandRuns.get(require_(id).id) ?? null });

// ---------- xuất cả loạt ----------

/**
 * Tên file cho từng video trong gói tải về: "01-tieu-de.mp4" — giữ đúng thứ tự trong loạt
 * để người dùng đăng lần lượt không phải dò lại.
 */
const exportName = (item: BatchItem, index: number) =>
  `${String(index + 1).padStart(2, "0")}-${slugify(item.title ?? item.input, 50) || "video"}.mp4`;

const doneItems = (batch: Batch) =>
  batch.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === "done" && item.slug &&
      fs.existsSync(path.join(process.cwd(), "out", `${item.slug}.mp4`)));

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

const crc32 = (buffer: Buffer) => {
  let c = -1;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

/**
 * Gói zip "store" (không nén) viết tay, khoảng 60 dòng.
 *
 * Hai lý do không gọi lệnh `zip` của hệ điều hành: Windows không có sẵn lệnh đó, và mp4 vốn
 * đã nén nên nén lại chỉ tốn CPU mà gần như không giảm dung lượng. Trả về từng mảnh để server
 * ghi thẳng ra response — mỗi lúc chỉ giữ MỘT video trong bộ nhớ, loạt 50 video không làm phình RAM.
 */
export function* batchZip(id: unknown): Generator<Buffer> {
  const batch = require_(id);
  const files = doneItems(batch);
  if (files.length === 0) throw new Error("Chưa có video nào xong để tải.");

  const central: Buffer[] = [];
  let offset = 0;
  // Zip lưu giờ theo định dạng MS-DOS; dùng một mốc cố định cho gọn, không ai đọc tới.
  const time = 0;
  const date = 0x2821; // 2000-01-01

  // Loạt phụ đề: kèm file .srt cạnh mỗi video, để đăng lên nền tảng nào cho bật/tắt phụ đề cũng được.
  const entries = function* () {
    for (const { item, index } of files) {
      const mp4Name = exportName(item, index);
      yield { name: mp4Name, read: () => fs.readFileSync(path.join(process.cwd(), "out", `${item.slug}.mp4`)) };
      const copy = freshCopy(item.slug!);
      if (copy) yield { name: mp4Name.replace(/\.mp4$/, ".txt"), read: () => Buffer.from(postCopyText(copy), "utf8") };
      if (freshCover(item.slug!)) yield { name: mp4Name.replace(/\.mp4$/, ".jpg"), read: () => fs.readFileSync(coverPath(item.slug!)) };
      if (freshBrand(item.slug!)) yield { name: `co-mo-dau-ket-thuc/${mp4Name}`, read: () => fs.readFileSync(brandPath(item.slug!)) };
      // Bản khác khung: mỗi khung một thư mục, cùng tên file để dễ đối chiếu.
      for (const aspect of exportsOf(item.slug!)) {
        yield { name: `${aspect.replace(":", "x")}/${mp4Name}`, read: () => fs.readFileSync(exportPath(item.slug!, aspect)) };
      }
      if (batch.source !== "subs") {
        // Mọi loạt đều kèm .srt — YouTube, Facebook nhận phụ đề bật/tắt được, tốt cho người xem lẫn tìm kiếm.
        const srt = srtFor(item.slug!);
        if (srt) yield { name: mp4Name.replace(/\.mp4$/, ".srt"), read: () => Buffer.from(srt, "utf8") };
        continue;
      }
      // Loạt nhiều hàng: hàng đầu là <tên>.srt, các hàng sau <tên>.<mã ngôn ngữ>.srt.
      const tracks = batch.subs?.tracks ?? [{ lang: "" as const }];
      for (const [k, track] of tracks.entries()) {
        const srt = srtFor(item.slug!, k);
        const suffix = k === 0 ? "" : `.${track.lang || batch.subs?.spoken || "goc"}`;
        if (srt) yield { name: mp4Name.replace(/\.mp4$/, `${suffix}.srt`), read: () => Buffer.from(srt, "utf8") };
      }
    }
  };

  for (const [i, entryInfo] of [...entries()].entries()) {
    const data = entryInfo.read();
    const name = Buffer.from(entryInfo.name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);        // cần bản giải nén 2.0
    local.writeUInt16LE(0x0800, 6);    // cờ: tên file mã UTF-8
    local.writeUInt16LE(0, 8);         // phương thức 0 = store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    yield Buffer.concat([local, name, data]);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(0, 30);        // extra + comment
    entry.writeUInt16LE(0, 34);        // đĩa số 0
    entry.writeUInt16LE(0, 36);        // thuộc tính trong
    entry.writeUInt32LE(0, 38);        // thuộc tính ngoài
    entry.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([entry, name]));

    offset += local.length + name.length + data.length;
    void i;
  }

  const directory = Buffer.concat(central);
  yield directory;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  yield end;
}

const srtTime = (ms: number) => {
  const t = Math.max(0, Math.round(ms));
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(t / 3600000))}:${pad(Math.floor(t / 60000) % 60)}:${pad(Math.floor(t / 1000) % 60)},${pad(t % 1000, 3)}`;
};

/** Phụ đề SRT lấy từ props.json — đúng bản đang gắn trong video (kể cả đã sửa trong trình chỉnh sửa). */
/** File .srt của một hàng phụ đề (mặc định hàng đầu). */
const srtFor = (slug: string, track = 0) => {
  const props = readJson(path.join(videoDir(slug), "props.json")) as { captions?: Caption[] } | null;
  const captions = (props?.captions ?? []).filter((c) => c.text.trim() && (c.track ?? 0) === track);
  if (captions.length === 0) return null;
  return captions
    .map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text.trim()}\n`)
    .join("\n");
};

// ---------- lịch đăng ----------

const PLATFORMS: PostPlatform[] = ["tiktok", "youtube", "facebook", "instagram"];
const PLATFORM_LABEL: Record<PostPlatform, string> = { tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook", instagram: "Instagram" };

/**
 * Lưu lịch đăng. Trình duyệt tính sẵn mốc từng video (nó biết múi giờ người dùng); server chỉ kiểm tra rồi giữ lại
 * để ô video hiện "Đăng: T7 19/09 19:30", CSV có cột lịch, và xuất được file .ics.
 */
export const savePostPlan = (id: unknown, body: unknown) => {
  const batch = require_(id);
  const raw = (body ?? {}) as { slots?: unknown; platforms?: unknown };
  const ids = new Set(batch.items.map((item) => item.id));
  const slots: Record<string, number> = {};
  for (const [itemId, at] of Object.entries((raw.slots ?? {}) as Record<string, unknown>)) {
    const ms = Number(at);
    if (ids.has(itemId) && Number.isFinite(ms) && ms > 0) slots[itemId] = Math.round(ms);
  }
  if (Object.keys(slots).length === 0) {
    delete batch.postPlan;
  } else {
    const platforms = (Array.isArray(raw.platforms) ? raw.platforms : []).filter((p): p is PostPlatform => PLATFORMS.includes(p as PostPlatform));
    batch.postPlan = { slots, platforms: platforms.length ? platforms : ["tiktok"] };
  }
  save(batch);
  return { postPlan: batch.postPlan ?? null };
};

/**
 * Đọc số người dùng gõ hoặc dán từ trang thống kê: "12.345" / "12,345" (phân cách hàng nghìn), "45,5" / "45.5"
 * (thập phân), "12,3K", "1.2M", "1,5 tr", "38%". Không đọc được hoặc âm → null.
 */
export const parseStat = (raw: unknown): number | null => {
  let text = String(raw ?? "").trim().toLowerCase().replace(/%$/, "").trim();
  if (!text) return null;
  const unit = /(k|n|nghìn|ngàn|m|tr|triệu|b|tỷ)$/.exec(text)?.[1];
  if (unit) text = text.slice(0, -unit.length).trim();
  // Dấu . hoặc , đứng trước đúng 3 chữ số ở cuối cụm = phân cách hàng nghìn; còn lại là dấu thập phân.
  text = text.replace(/\s/g, "").replace(/[.,](?=\d{3}(?:[.,]|$))/g, "").replace(",", ".");
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  const mul = !unit ? 1 : /^(k|n|nghìn|ngàn)$/.test(unit) ? 1e3 : /^(m|tr|triệu)$/.test(unit) ? 1e6 : 1e9;
  return n * mul;
};

/**
 * Lưu số liệu sau khi đăng của một nền tảng (ghi đè đúng các ô gửi lên). Số âm, chữ hay tỉ lệ ngoài 0–100 bị bỏ.
 * Ô trống = xoá số đó; video không còn số nào thì bỏ khỏi bảng.
 */
export const saveResults = (id: unknown, body: unknown) => {
  const batch = require_(id);
  const raw = (body ?? {}) as { platform?: unknown; rows?: unknown };
  const platform = PLATFORMS.find((p) => p === raw.platform);
  if (!platform) throw new Error("Chọn nền tảng trước đã.");
  const ids = new Set(batch.items.map((item) => item.id));
  const table: Record<string, PostStats> = {};
  for (const [itemId, row] of Object.entries((raw.rows ?? {}) as Record<string, Record<string, unknown>>)) {
    if (!ids.has(itemId)) continue;
    const stats: PostStats = {};
    for (const key of STAT_KEYS) {
      const value = parseStat(row?.[key]);
      if (value === null) continue;
      if (key === "watch" && value > 100) continue;
      stats[key] = key === "watch" ? Math.round(value * 10) / 10 : Math.round(value);
    }
    if (Object.keys(stats).length) table[itemId] = stats;
  }
  batch.results = { ...(batch.results ?? {}), [platform]: table };
  if (Object.keys(table).length === 0) delete batch.results[platform];
  save(batch);
  return { results: batch.results };
};

/** Chuỗi trong file .ics: thoát \ ; , và xuống dòng; gấp dòng dài 75 byte theo RFC 5545. */
const icsText = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsFold = (line: string) => {
  const out: string[] = [];
  let rest = Buffer.from(line, "utf8");
  while (rest.length > 75) {
    // Không cắt giữa một ký tự UTF-8 nhiều byte (byte tiếp nối có dạng 10xxxxxx).
    let cut = out.length ? 74 : 75;
    while (cut > 0 && (rest[cut] & 0xc0) === 0x80) cut--;
    out.push(rest.subarray(0, cut).toString("utf8"));
    rest = rest.subarray(cut);
  }
  out.push(rest.toString("utf8"));
  return out.join("\r\n ");
};
const icsTime = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** File lịch: mỗi video đã lên lịch một sự kiện 15 phút, nhắc trước 15 phút, mô tả là bài đăng dán sẵn. */
export const batchCalendar = (id: unknown) => {
  const batch = require_(id);
  const plan = batch.postPlan;
  if (!plan) throw new Error("Loạt này chưa có lịch đăng.");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AI Video Studio//Lich dang//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  batch.items.forEach((item, index) => {
    const at = plan.slots[item.id];
    if (!at) return;
    const copy = item.slug ? freshCopy(item.slug) : null;
    const desc = [
      `File: ${exportName(item, index)}`,
      ...plan.platforms.map((p) => {
        if (!copy) return "";
        const part = copy[p] as { caption?: string; title?: string; description?: string; hashtags: string[] };
        const body = p === "youtube" ? `${part.title}\n${part.description}` : part.caption;
        return `— ${PLATFORM_LABEL[p]} —\n${body}\n${part.hashtags.join(" ")}`;
      }).filter(Boolean),
      copy ? "" : "(Chưa có bài đăng — bấm Viết bài đăng trong loạt rồi xuất lại lịch.)",
    ].filter(Boolean).join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${batch.id}-${item.id}@ai-video-studio`,
      `DTSTAMP:${icsTime(Date.now())}`,
      `DTSTART:${icsTime(at)}`,
      `DTEND:${icsTime(at + 15 * 60_000)}`,
      icsFold(`SUMMARY:${icsText(`Đăng ${plan.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}: ${item.title ?? item.input.slice(0, 60)}`)}`),
      icsFold(`DESCRIPTION:${icsText(desc)}`),
      "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT15M", icsFold(`DESCRIPTION:${icsText(`Sắp tới giờ đăng: ${item.title ?? ""}`)}`), "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return { name: `${slugify(batch.name, 40) || "loat-video"}-lich-dang.ics`, body: `${lines.join("\r\n")}\r\n` };
};

/** Số video đã xong và tên file gói tải về — UI hỏi trước khi hiện nút. */
export const batchExportInfo = (id: unknown) => {
  const batch = require_(id);
  return { ready: doneItems(batch).length, name: `${slugify(batch.name, 40) || "loat-video"}.zip` };
};

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

/**
 * Bảng theo dõi để đăng bài: mỗi video một dòng, kèm lời đọc để dán làm mô tả.
 * Có BOM ở đầu vì Excel không đoán được UTF-8 nếu thiếu — tiếng Việt sẽ vỡ hết dấu.
 */
export const batchCsv = (id: unknown) => {
  const batch = require_(id);
  const header = [
    "STT", "Tiêu đề", "Trạng thái", "Nội dung đã nhập", "Lời đọc", "File", "Khung", "Phong cách",
    "TikTok", "YouTube — tiêu đề", "YouTube — mô tả", "Facebook", "Instagram",
    "Điểm tự soát", "Cần xem", "Lịch đăng",
    ...PLATFORMS.filter((p) => batch.results?.[p]).flatMap((p) => [`${PLATFORM_LABEL[p]} — lượt xem`, `${PLATFORM_LABEL[p]} — % xem hết`]),
  ];
  const rows = batch.items.map((item, index) => {
    const settings = item.override ?? batch.settings;
    const script = item.slug
      ? readJson(path.join(videoDir(item.slug), "script.json")) as { style?: string } | null
      : null;
    const copy = item.status === "done" && item.slug ? freshCopy(item.slug) : null;
    const qa = item.status === "done" && item.slug ? savedCheck(item.slug) : null;
    const withTags = (text: string, tags: string[]) => [text, tags.join(" ")].filter(Boolean).join(" ");
    return [
      index + 1,
      item.title ?? "",
      BATCH_STATUS_TEXT[item.status] ?? item.status,
      item.input,
      (item.lines ?? []).join(" "),
      item.status === "done" ? exportName(item, index) : "",
      settings.aspect,
      script?.style ?? "",
      copy ? withTags(copy.tiktok.caption, copy.tiktok.hashtags) : "",
      copy?.youtube.title ?? "",
      copy ? withTags(copy.youtube.description, copy.youtube.hashtags) : "",
      copy ? withTags(copy.facebook.caption, copy.facebook.hashtags) : "",
      copy ? withTags(copy.instagram.caption, copy.instagram.hashtags) : "",
      qa ? `${qa.score}/10` : "",
      qa ? qa.issues.map((issue) => issue.text).join(" | ") : "",
      batch.postPlan?.slots[item.id] ? new Date(batch.postPlan.slots[item.id]).toLocaleString("vi-VN") : "",
      ...PLATFORMS.filter((p) => batch.results?.[p]).flatMap((p) => [
        batch.results![p]![item.id]?.views ?? "", batch.results![p]![item.id]?.watch ?? "",
      ]),
    ].map(csvCell).join(",");
  });
  return `﻿${header.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
};

const BATCH_STATUS_TEXT: Record<ItemStatus, string> = {
  queued: "chờ", preparing: "đang chuẩn bị", review: "chờ duyệt", ready: "chờ dựng",
  building: "đang dựng", done: "xong", error: "lỗi", skipped: "bỏ qua",
};

// ---------- bài đăng cho cả loạt ----------

/**
 * Viết tiêu đề, caption, hashtag (scripts/post-copy.ts) cho mọi video đã xong trong loạt.
 *
 * Chạy lần lượt từng video chứ không song song: đây là việc chờ mạng nhưng key miễn phí (Gemini, Groq)
 * giới hạn số lượt mỗi phút — bắn cả loạt cùng lúc là dính lỗi hạn mức ngay giữa chừng.
 * Trạng thái chỉ giữ trong bộ nhớ: tắt app giữa chừng thì những video đã viết xong vẫn còn
 * post-copy.json, bấm lại chỉ viết tiếp phần còn thiếu.
 */
type PostCopyRun = {
  running: boolean; total: number; done: number; failed: number; error?: string;
  /** Đang đợi hết hạn mức của AI, tính bằng giây. */
  waiting?: number;
};
const postCopyRuns = new Map<string, PostCopyRun>();

/** Gợi ý đã lưu và còn khớp lời video (sửa lời sau đó thì coi như chưa có). */
const freshCopy = (slug: string): SavedPostCopy | null => {
  const { copy, stale } = getPostCopy(slug);
  return copy && !stale ? copy : null;
};

/** Nội dung file .txt cạnh video trong gói tải về — dán thẳng lên từng nền tảng. */
const postCopyText = (copy: SavedPostCopy) => {
  const block = (label: string, ...parts: (string | string[])[]) =>
    `== ${label} ==\n${parts.map((p) => (Array.isArray(p) ? p.join(" ") : p)).filter(Boolean).join("\n\n")}`;
  return [
    block("TikTok", copy.tiktok.caption, copy.tiktok.hashtags),
    block("YouTube", copy.youtube.title, copy.youtube.description, copy.youtube.hashtags),
    block("Facebook", copy.facebook.caption, copy.facebook.hashtags),
    block("Instagram", copy.instagram.caption, copy.instagram.hashtags),
  ].join("\n\n") + "\n";
};

const batchPostCopyStatus = (batch: Batch) => {
  const files = doneItems(batch);
  const ready = files.filter(({ item }) => freshCopy(item.slug!)).length;
  const run = postCopyRuns.get(batch.id);
  return { ready, videos: files.length, run: run ?? null };
};

export const readBatchPostCopy = (id: unknown) => batchPostCopyStatus(require_(id));

/** `force` = viết lại cả những video đã có gợi ý; mặc định chỉ viết video chưa có hoặc đã sửa lời. */
export const startBatchPostCopy = (id: unknown, provider: ProviderChoice = "auto", force = false) => {
  const batch = require_(id);
  if (postCopyRuns.get(batch.id)?.running) return batchPostCopyStatus(batch);
  const slugs = doneItems(batch)
    .map(({ item }) => item.slug!)
    .filter((slug) => force || !freshCopy(slug));
  if (slugs.length === 0) {
    postCopyRuns.delete(batch.id);
    return batchPostCopyStatus(batch);
  }
  const run: PostCopyRun = { running: true, total: slugs.length, done: 0, failed: 0 };
  postCopyRuns.set(batch.id, run);
  void (async () => {
    for (const slug of slugs) {
      // Hết hạn mức theo phút (429) là chuyện thường khi viết cả loạt bằng key miễn phí: đợi đúng số giây
      // nhà cung cấp báo rồi thử lại, tối đa hai lần, thay vì bỏ qua video đó.
      for (let attempt = 0; ; attempt++) {
        try {
          await generatePostCopy(slug, provider);
          run.done++;
          delete run.waiting;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (attempt < 2 && /hết hạn mức|429/.test(message)) {
            const seconds = Math.min(65, Number(/Đợi khoảng (\d+) giây/.exec(message)?.[1] ?? 20) + 3);
            run.waiting = seconds;
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
            continue;
          }
          run.failed++;
          run.error = message;
          delete run.waiting;
          break;
        }
      }
      // Không có AI nào dùng được thì video sau cũng lỗi y hệt — dừng luôn cho khỏi chờ.
      if (run.error && /Chưa có AI nào/.test(run.error)) break;
    }
    run.running = false;
  })();
  return batchPostCopyStatus(batch);
};
