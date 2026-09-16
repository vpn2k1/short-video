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
  writeChat,
  type ChatMessage,
  type ChatSettings,
} from "./chat";
import { runRenderStage } from "./pipeline";
import { allLines, parseScript, type VideoScript } from "../src/compositions/Short/script";
import { captionLookSchema, shortSchema, type Caption, type CaptionLook } from "../src/compositions/Short/schema";
import { ASPECT_IDS, aspectFor } from "../src/aspects";
import { DEFAULT_CAPTION_LOOK } from "../src/components/captionLook";
import { findVoice } from "../scripts/voices";
import { slugify } from "../scripts/slug";
import { textToScript } from "../scripts/text-script";
import { transcribeSentences } from "../scripts/transcribe";
import { alignCaptions, detectSilences } from "../scripts/subtitle-align";
import {
  isTranslateLanguage, missingTranslateKey, translateLanguageLabel, translateLines,
  TRANSLATE_ENGINES, type TranslateEngine, type TranslateLanguage,
} from "../scripts/translate";

export type BatchSource = "ideas" | "custom" | "media" | "variants" | "subs";

/** Tuỳ chọn của nguồn "subs": video nói tiếng gì, và kiểu phụ đề chung cho cả loạt. */
export type SubsOptions = {
  /** Mã ngôn ngữ whisper ("vi", "en"…) hoặc "auto" để tự nhận. */
  spoken: string;
  look: Partial<CaptionLook>;
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
  variant?: { from: string; aspect?: string; voice?: string; lang?: TranslateLanguage };
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

const variantItems = (
  from: string,
  aspects: string[],
  voices: string[],
  langs: TranslateLanguage[],
  settings: ChatSettings,
) => {
  if (!isSlug(from)) throw new Error("Chọn video gốc để nhân bản.");
  const scriptPath = path.join(videoDir(from), "script.json");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `“${from}” chưa có kịch bản nên không nhân biến thể được. Chọn video do AI viết lời hoặc do bạn dán lời vào.`,
    );
  }
  const sourceTitle = (readJson(scriptPath) as { title?: string } | null)?.title ?? from;
  const aspectList = aspects.length ? aspects : [settings.aspect];
  const voiceList = voices.length ? voices : [settings.voice];
  const langList: (TranslateLanguage | undefined)[] = langs.length ? langs : [undefined];

  const items: BatchItem[] = [];
  for (const lang of langList) {
    for (const aspect of aspectList) {
      for (const voice of voiceList) {
        const label = [
          lang ? translateLanguageLabel(lang) : null,
          aspectList.length > 1 || aspect !== settings.aspect ? aspect : null,
          voiceList.length > 1 || voice !== settings.voice ? (voice ? `giọng ${voice}` : "không giọng") : null,
        ].filter(Boolean).join(" · ");
        items.push(
          newItem(`${sourceTitle}${label ? ` — ${label}` : ""}`, {
            variant: { from, aspect, voice, lang },
            override: { aspect, voice },
          }),
        );
        if (items.length >= MAX_ITEMS) return items;
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
  variants?: { from?: unknown; aspects?: unknown; voices?: unknown; languages?: unknown };
  /** Nguồn subs: ngôn ngữ nói, các ngôn ngữ phụ đề ("" = giữ nguyên), kiểu phụ đề chung. */
  subs?: { spoken?: unknown; languages?: unknown; look?: unknown };
  /** Tạo xong chạy luôn. */
  start?: unknown;
};

export const createBatch = (body: CreateBatchInput) => {
  const source: BatchSource =
    body.source === "media" || body.source === "variants" || body.source === "custom" || body.source === "subs"
      ? body.source : "ideas";
  const settings = normalizeSettings(body.settings, DEFAULT_SETTINGS);
  const mediaModel: WhisperModel = body.mediaModel === "small" ? "small" : "medium";

  let items: BatchItem[] = [];
  let subs: SubsOptions | undefined;
  if (source === "subs") {
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
    subs = { spoken, look: parseLook(raw.look) };
    const files = (Array.isArray(body.items) ? body.items : []).map(String);
    for (const file of files) {
      checkMediaFile(file);
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
    items = variantItems(String(v.from ?? ""), aspects, voices, languages, settings);
  }

  if (items.length === 0) {
    throw new Error(
      source === "media" || source === "subs"
        ? "Chưa chọn file audio hoặc video nào."
        : source === "variants"
          ? "Chưa chọn biến thể nào — tích ít nhất một tỉ lệ, một giọng hoặc một ngôn ngữ."
          : source === "custom"
            ? "Chưa ô nào có nội dung. Nhập lời hoặc ý tưởng vào ít nhất một ô."
            : "Chưa có ý tưởng nào. Mỗi dòng một video.",
    );
  }
  // Nguồn audio-video không gọi AI viết lời; đừng bắt người dùng có key mới chạy được.
  if (source === "ideas") assertSettingsUsable(settings);
  if (source === "variants") assertSettingsUsable({ ...settings, mode: "text" });

  const batch: Batch = {
    id: `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`,
    name: String(body.name ?? "").trim().slice(0, 60) ||
      (source === "media" ? "Từ file thu sẵn" : source === "subs" ? "Thêm phụ đề"
        : source === "variants" ? "Biến thể" : items[0].input.slice(0, 40)),
    createdAt: Date.now(),
    source,
    settings,
    review: body.review !== false,
    mediaModel,
    ...(subs ? { subs } : {}),
    state: "idle",
    items,
  };
  save(batch);
  if (body.start) startBatch(batch.id);
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

const summary = (batch: Batch) => ({
  id: batch.id,
  name: batch.name,
  createdAt: batch.createdAt,
  source: batch.source,
  state: batch.state,
  review: batch.review,
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

export const readBatch = (id: unknown) => {
  const batch = require_(id);
  return { ...batch, counts: counts(batch) };
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

// ---------- điều khiển ----------

export const startBatch = (id: unknown) => {
  const batch = require_(id);
  if (batch.source === "ideas") assertSettingsUsable(batch.settings);
  batch.state = "running";
  // Chạy lại loạt đã dừng: những mục lỗi không tự thử lại, phải bấm "Chạy lại".
  save(batch);
  pump();
  return summary(batch);
};

export const pauseBatch = (id: unknown) => {
  const batch = require_(id);
  // Mục đang chạy vẫn chạy nốt — dừng ngang chỉ để lại file dở.
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
  if (item.file || item.variant) {
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
  if (alsoVideo && slugs.length > 0) {
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
export const restyleSubs = (id: unknown, rawLook: unknown) => {
  const batch = require_(id);
  if (batch.source !== "subs" || !batch.subs) throw new Error("Loạt này không phải loạt thêm phụ đề.");
  const look = parseLook(rawLook);
  batch.subs.look = look;
  let rerender = 0;
  for (const item of batch.items) {
    const propsPath = item.slug ? path.join(videoDir(item.slug), "props.json") : "";
    if (!propsPath || !fs.existsSync(propsPath)) continue;
    const props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
    props.captionLook = look;
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
      await prepare(batch, item, log);
      item.status = batch.review ? "review" : "ready";
    } else {
      await build(batch, item, log);
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

const prepare = async (batch: Batch, item: BatchItem, log: (line: string) => void) => {
  if (item.file) return prepareMedia(batch, item, log);
  if (item.variant) return prepareVariant(batch, item, log);

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
  if (lang) {
    const engine = pickTranslateEngine();
    if (!engine) {
      throw new Error(
        "Chưa có model dịch. Điền key Gemini, Groq, OpenRouter (có gói miễn phí) trong Cài đặt, hoặc bỏ tích ngôn ngữ.",
      );
    }
    log(`Đang dịch sang ${translateLanguageLabel(lang)}…`);
    script = await translateScript(source, lang, engine, log);
  }

  // Tên thư mục: tiêu đề gốc rút ngắn + hậu tố cho biết đây là biến thể nào, để đừng
  // ra "…-2", "…-3" không đọc được là bản nào.
  const suffix = [lang, item.variant!.aspect?.replace(":", "x"), item.variant!.voice || "khong-giong"]
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
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height:stream_side_data=rotation:stream_tags=rotate",
      "-of", "json", file,
    ], { encoding: "utf8" });
    const stream = JSON.parse(out).streams?.[0];
    if (!stream?.width || !stream?.height) return null;
    const rotation = Math.abs(Number(stream.side_data_list?.[0]?.rotation ?? stream.tags?.rotate ?? 0)) % 180;
    const [w, h] = rotation === 90 ? [stream.height, stream.width] : [stream.width, stream.height];
    return aspectFor(w, h).id;
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
  if (item.subLang) {
    const engine = pickTranslateEngine();
    if (!engine) throw new Error("Chưa có model dịch — điền key Gemini, Groq hoặc OpenRouter trong Cài đặt.");
    log(`Dịch ${captions.length} dòng phụ đề sang ${translateLanguageLabel(item.subLang)}…`);
    const translated = await translateLines(
      captions.map((caption) => caption.text),
      { to: item.subLang, from: spoken === "auto" ? undefined : spoken, engine },
      log,
    );
    captions = captions.map((caption, i) => ({ ...caption, text: translated[i]?.trim() || caption.text }));
  }

  // Chuẩn hoá về mp3 48kHz stereo cho khớp phần còn lại của soundtrack.
  const trackRel = path.posix.join("voices", slug, "track.mp3");
  const trackAbs = path.join(process.cwd(), "public", trackRel);
  fs.mkdirSync(path.dirname(trackAbs), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", source, "-ar", "48000", "-ac", "2", trackAbs]);
  const durationMs = audioDurationMs(trackAbs);

  // File hình thì giữ luôn hình gốc làm cảnh; file chỉ có tiếng thì nền trơn.
  const visual = /\.(mp4|mov|webm)$/i.test(item.file!) ? item.file! : null;
  // Thêm phụ đề cho video có sẵn: giữ đúng khung của video gốc, không ép về khung trong cài đặt.
  const aspect = batch.subs && visual ? videoAspect(source) ?? settings.aspect : settings.aspect;
  const props = shortSchema.parse({
    title: captions[0]?.text.slice(0, 60) ?? path.basename(item.file!),
    subtitle: "",
    handle: "@kenh",
    accent: "#e8590c",
    background: "#0b0b12",
    captions,
    aspect,
    style: "plain",
    scenes: [{ image: visual, visual: null, startMs: 0, endMs: durationMs }],
    captionPosition: "bottom",
    ...(batch.subs ? { captionLook: batch.subs.look } : {}),
    // Audio nói ngay từ giây 0 — title card sẽ đè lên chính câu đầu.
    showTitle: false,
    voiceoverTrack: trackRel,
    music: settings.music,
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
    ? `${baseName}${item.subLang ? ` ${item.subLang}` : ""}`
    : props.title;
  item.scenes = 1;
  item.lines = captions.map((caption) => caption.text).slice(0, 40);
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

  // Nguồn file thu sẵn không có kịch bản — render thẳng từ props.json đã phiên âm.
  if (item.file) {
    log("__STEP__ render");
    const result = await runRenderStage(slug, undefined, log);
    item.mp4 = `${result.mp4}?t=${Date.now()}`;
    item.poster = makePoster(slug, path.join(process.cwd(), "out", `${slug}.mp4`));
    appendAssistant(slug, {
      role: "assistant",
      at: Date.now(),
      text: `Đã dựng “${item.title ?? slug}” từ file thu sẵn · ${(result.durationInFrames / 30).toFixed(1)}s`,
      mp4: item.mp4,
      aspect: settings.aspect,
    });
    return;
  }

  const scriptPath = path.join(videoDir(slug), "script.json");
  if (!fs.existsSync(scriptPath)) throw new Error(`${slug} chưa có kịch bản.`);
  const script = parseScript(JSON.parse(fs.readFileSync(scriptPath, "utf8")));
  const result = await buildFromScript(slug, script, settings, log);

  item.mp4 = result.mp4;
  item.images = result.images;
  item.poster = result.mp4
    ? makePoster(slug, path.join(process.cwd(), "out", `${slug}.mp4`))
    : undefined;
  item.title = script.title;
  item.scenes = script.scenes.length;
  appendAssistant(slug, { role: "assistant", at: Date.now(), ...result });
};

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
      const srt = batch.source === "subs" ? srtFor(item.slug!) : null;
      if (srt) yield { name: mp4Name.replace(/\.mp4$/, ".srt"), read: () => Buffer.from(srt, "utf8") };
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
const srtFor = (slug: string) => {
  const props = readJson(path.join(videoDir(slug), "props.json")) as { captions?: Caption[] } | null;
  const captions = (props?.captions ?? []).filter((c) => c.text.trim());
  if (captions.length === 0) return null;
  return captions
    .map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text.trim()}\n`)
    .join("\n");
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
  const header = ["STT", "Tiêu đề", "Trạng thái", "Nội dung đã nhập", "Lời đọc", "File", "Khung", "Phong cách"];
  const rows = batch.items.map((item, index) => {
    const settings = item.override ?? batch.settings;
    const script = item.slug
      ? readJson(path.join(videoDir(item.slug), "script.json")) as { style?: string } | null
      : null;
    return [
      index + 1,
      item.title ?? "",
      BATCH_STATUS_TEXT[item.status] ?? item.status,
      item.input,
      (item.lines ?? []).join(" "),
      item.status === "done" ? exportName(item, index) : "",
      settings.aspect,
      script?.style ?? "",
    ].map(csvCell).join(",");
  });
  return `﻿${header.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
};

const BATCH_STATUS_TEXT: Record<ItemStatus, string> = {
  queued: "chờ", preparing: "đang chuẩn bị", review: "chờ duyệt", ready: "chờ dựng",
  building: "đang dựng", done: "xong", error: "lỗi", skipped: "bỏ qua",
};
