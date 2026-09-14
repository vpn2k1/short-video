/**
 * Chế độ chat: mỗi video là một cuộc hội thoại. Tin nhắn đầu tạo video, các tin
 * sau sửa lại — mỗi lượt chạy trọn pipeline kịch bản → giọng → render.
 *
 * Lưu ở videos/<slug>/chat.json cạnh script.json để mở lại vẫn thấy lịch sử.
 */
import fs from "fs";
import path from "path";
import {
  allLines, lineDurationMs, parseScript, scriptToProps, type VideoScript, type VoiceoverClip,
} from "../src/compositions/Short/script";
import { shortSchema, type ShortProps } from "../src/compositions/Short/schema";
import { ASPECT_IDS, ASPECTS, type AspectId } from "../src/aspects";
import { generateAiVideo, isVideoModelChoice, videoModelCatalog } from "../scripts/ai-video";
import { TITLE_FRAMES } from "../src/constants";
import { editScript, generateScript, scriptProvider, type StyleChoice } from "../scripts/generate-script";
import { isStyleId, STYLES } from "../src/styles/meta";
import { textToScript } from "../scripts/text-script";
import { generateVoiceover } from "../scripts/tts";
import { findVoice } from "../scripts/voices";
import { renderScene, renderShort } from "../scripts/render";
import { assertImagesExist } from "../scripts/images";
import { slugify } from "../scripts/slug";
import { startJob } from "./jobs";
import { runRenderStage } from "./pipeline";
import { applyVoice } from "./editor/ops";
import { execFile } from "child_process";
import { promisify } from "util";
import { transcribeFile } from "../scripts/transcribe";
import { groupIntoLines } from "../scripts/group-captions";
import type { Caption } from "../src/compositions/Short/schema";

export type ChatSettings = {
  /** Tạo video (có giọng + nhạc) hay bộ ảnh tĩnh, mỗi cảnh một ảnh. */
  kind: "video" | "image";
  /** Phong cách hình ảnh, "auto" = AI chọn theo nội dung. */
  style: StyleChoice;
  /** "ai" = AI viết kịch bản từ ý tưởng; "text" = dùng nguyên văn kịch bản dán vào, không cần key. */
  mode: "ai" | "text";
  aspect: string;
  /** key trong VOICES, "" = không giọng. */
  voice: string;
  music: string | null;
  /** Hình của cảnh: "" = ảnh như cũ; "auto" hoặc key model = tạo clip AI cho từng cảnh. */
  video: string;
};

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
};

type Chat = { messages: ChatMessage[]; settings: ChatSettings };

const DEFAULT_SETTINGS: ChatSettings = { kind: "video", style: "auto", mode: "ai", aspect: "9:16", voice: "linh", music: null, video: "" };

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

export const isSlug = (value: unknown): value is string =>
  typeof value === "string" && SLUG_RE.test(value);

const videoDir = (slug: string) => path.join(process.cwd(), "videos", slug);
const chatPath = (slug: string) => path.join(videoDir(slug), "chat.json");

/** slug → jobId của lượt đang chạy. Một video chỉ chạy một lượt một lúc. */
const running = new Map<string, string>();

export const readChat = (slug: string): Chat & { slug: string; jobId: string | null } => {
  let chat: Chat = { messages: [], settings: { ...DEFAULT_SETTINGS } };
  if (fs.existsSync(chatPath(slug))) {
    const raw = JSON.parse(fs.readFileSync(chatPath(slug), "utf8"));
    chat = { messages: raw.messages ?? [], settings: { ...DEFAULT_SETTINGS, ...raw.settings } };
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
  return { slug, ...chat, jobId: running.get(slug) ?? null };
};

const writeChat = (slug: string, chat: Chat) => {
  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(chatPath(slug), JSON.stringify(chat, null, 2));
};

const readJson = (file: string) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;

/** Slug chưa dùng, suy từ prompt: "pin-iphone", "pin-iphone-2"… */
const freshSlug = (prompt: string) => {
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

  let cursor = 0;
  const scenes = items.map((item) => {
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
    const scene = {
      image: file, visual: null, tag: null, punch: null,
      trimStartMs: 0, volume: video ? 1 : 0,
      startMs: cursor, endMs: cursor + duration,
    };
    cursor += duration;
    return scene;
  });
  if (scenes.length === 0) {
    scenes.push({ image: null as unknown as string, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, startMs: 0, endMs: 5000 });
  }

  const props = shortSchema.parse({
    title: name, subtitle: "", handle: "@kenh", accent: "#ff6b2c", background: "#000000",
    captions: [], aspect: aspectId, style: "plain", scenes,
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
export const startAutoSubtitles = (slug: string, body: unknown) => {
  const opts = (body ?? {}) as { source?: unknown; index?: unknown; language?: unknown; quality?: unknown; replace?: unknown };
  const language = opts.language === "en" || opts.language === "auto" ? opts.language : "vi";
  // medium đúng tên riêng tiếng Việt hơn hẳn; small nhanh gấp ~3 lần.
  const model = opts.quality === "fast" ? "small" : "medium";
  const replace = opts.replace !== false;
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi xong đã.");
  }
  const { props } = readEditorProps(slug);
  const videoFile = (src: string | null) => Boolean(src && /\.(mp4|mov|webm)$/i.test(src));

  type Segment = { src: string; startMs: number; trimStartMs: number; durationMs: number; label: string };
  const segments: Segment[] = [];
  if (opts.source === "scene") {
    const i = Number(opts.index);
    const s = props.scenes[i];
    if (!s || !videoFile(s.image)) throw new Error("Chọn một cảnh là video để tạo phụ đề.");
    segments.push({ src: s.image as string, startMs: s.startMs, trimStartMs: s.trimStartMs, durationMs: s.endMs - s.startMs, label: `cảnh ${i + 1}` });
  } else if (opts.source === "clip") {
    const i = Number(opts.index);
    const c = props.audioClips[i];
    if (!c) throw new Error("Đoạn âm thanh không tồn tại.");
    segments.push({ src: c.src, startMs: c.startMs, trimStartMs: c.trimStartMs, durationMs: c.durationMs, label: c.label ?? "âm thanh" });
  } else {
    // Cả video: cảnh video còn tiếng gốc + âm thanh thêm tay (trừ nhạc nền và hiệu ứng).
    props.scenes.forEach((s, i) => {
      if (videoFile(s.image) && s.volume > 0) {
        segments.push({ src: s.image as string, startMs: s.startMs, trimStartMs: s.trimStartMs, durationMs: s.endMs - s.startMs, label: `cảnh ${i + 1}` });
      }
    });
    props.audioClips.forEach((c) => {
      if (!/^(music|sfx)\//.test(c.src)) {
        segments.push({ src: c.src, startMs: c.startMs, trimStartMs: c.trimStartMs, durationMs: c.durationMs, label: c.label ?? "âm thanh" });
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
      const created: Caption[] = [];
      for (const [k, seg] of segments.entries()) {
        log(`Đang phiên âm ${seg.label} (${k + 1}/${segments.length}, model ${model})…`);
        const wav = path.join(tmp, `${Date.now()}-${k}.wav`);
        // Video không có luồng âm thanh làm ffmpeg báo lỗi — coi như không có tiếng.
        await runFile("ffmpeg", [
          "-y", "-v", "error",
          "-ss", (seg.trimStartMs / 1000).toFixed(3), "-t", (seg.durationMs / 1000).toFixed(3),
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
          const tokens = await transcribeFile({ audioPath: wav, model, language });
          const shifted = tokens.map((t) => ({ ...t, startMs: t.startMs + seg.startMs, endMs: t.endMs + seg.startMs }));
          const segEnd = seg.startMs + seg.durationMs;
          const lines = groupIntoLines(shifted)
            .filter((line) => line.text.trim() && line.startMs < segEnd)
            .map((line) => ({ ...line, endMs: Math.min(line.endMs, segEnd) }));
          created.push(...lines);
          log(`  ${seg.label}: ${lines.length} câu`);
        } finally {
          fs.rmSync(wav, { force: true });
        }
      }

      const latest = readEditorProps(slug).props;
      const keep = replace
        ? latest.captions.filter((c) => !segments.some((seg) => c.startMs < seg.startMs + seg.durationMs && c.endMs > seg.startMs))
        : latest.captions;
      const next = shortSchema.parse({ ...latest, captions: [...keep, ...created].sort((a, b) => a.startMs - b.startMs) });
      fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(next, null, 2));
      log(`Xong: ${created.length} câu phụ đề.`);
      return { props: next, count: created.length };
    } finally {
      running.delete(slug);
    }
  });
  running.set(slug, job.id);
  return { jobId: job.id };
};

/** Dữ liệu cho trình chỉnh sửa — props đã điền mặc định cho các trường mới. */
export const readEditorProps = (slug: string) => {
  const propsPath = path.join(videoDir(slug), "props.json");
  if (!fs.existsSync(propsPath)) {
    throw new Error("Video này chưa được dựng — tạo video trước rồi mới chỉnh sửa được.");
  }
  const props = shortSchema.parse(JSON.parse(fs.readFileSync(propsPath, "utf8")));
  const script = readJson(path.join(videoDir(slug), "script.json"));
  return { slug, props, title: script?.title ?? props.title, running: running.has(slug) };
};

/** Xuất mp4 từ props.json đã chỉnh — không đụng kịch bản hay giọng đọc. */
export const startEditorRender = (slug: string) => {
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi xong đã.");
  }
  readEditorProps(slug);
  const job = startJob(async (log) => {
    try {
      log("__STEP__ render");
      const result = await runRenderStage(slug, undefined, log);
      const chat = readChat(slug);
      const props = readJson(path.join(videoDir(slug), "props.json"));
      const message: ChatMessage = {
        role: "assistant",
        at: Date.now(),
        text: `Đã xuất bản chỉnh sửa · ${(result.durationInFrames / 30).toFixed(1)}s`,
        mp4: `${result.mp4}?t=${Date.now()}`,
        aspect: props?.aspect ?? "9:16",
        style: props?.style,
      };
      writeChat(slug, { messages: [...chat.messages, message], settings: chat.settings });
      return message;
    } finally {
      running.delete(slug);
    }
  });
  running.set(slug, job.id);
  return { jobId: job.id };
};

/**
 * Đổi giọng toàn bộ (index bỏ trống) hoặc đọc lại một câu, từ trình chỉnh sửa.
 * Giữ mốc bắt đầu của từng câu; câu dài ra thì phần phía sau lùi lại (xem ops.applyVoice).
 */
export const startVoiceChange = (slug: string, body: unknown) => {
  const { voice, index } = (body ?? {}) as { voice?: unknown; index?: unknown };
  const chosen = typeof voice === "string" ? findVoice(voice) : undefined;
  if (!chosen) {
    throw new Error("Chọn một giọng đọc hợp lệ.");
  }
  if (chosen.engine === "elevenlabs" && !process.env.ELEVENLABS_API_KEY) {
    throw new Error("Giọng này cần API key ElevenLabs — điền trong Cài đặt, hoặc chọn giọng macOS miễn phí.");
  }
  if (running.has(slug)) {
    throw new Error("Video này đang được xử lý — đợi xong đã.");
  }
  const { props } = readEditorProps(slug);
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
      );
      const next = shortSchema.parse(applyVoice(props, indexes, clips));
      fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(next, null, 2));
      if (index === undefined || index === null) {
        const chat = readChat(slug);
        writeChat(slug, { messages: chat.messages, settings: { ...chat.settings, voice: chosen.key } });
      }
      log(`Xong: ${clips.length} câu.`);
      return { props: next, voice: chosen.key };
    } finally {
      running.delete(slug);
    }
  });
  running.set(slug, job.id);
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
  const files = [videoDir(slug), path.join(process.cwd(), "out", `${slug}.mp4`)];
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

/** Xoá hẳn các video đã chọn. Video đang dựng thì bỏ qua. */
export const deleteProjects = (value: unknown) => {
  const slugs = Array.isArray(value) ? [...new Set(value)] : [];
  if (slugs.length === 0 || slugs.length > 500 || !slugs.every(isSlug)) {
    throw new Error("Danh sách video cần xoá không hợp lệ.");
  }
  const deleted: string[] = [];
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
    for (const file of files) {
      freedBytes += dirBytes(file);
      fs.rmSync(file, { recursive: true, force: true });
    }
    deleted.push(slug);
  }
  return { deleted, skipped, freedBytes };
};

export const listProjects = () => {
  const root = path.join(process.cwd(), "videos");
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SLUG_RE.test(e.name))
    .map((e) => {
      const slug = e.name;
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
      const status = running.has(slug)
        ? "running"
        : lastReply?.error
          ? "error"
          : hasMp4 || images.length > 0
            ? "done"
            : "draft";
      return {
        slug,
        title: script?.title ?? props?.title ?? slug,
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
        /** "running" | "error" | "done" | "draft" — cho thanh lịch sử. */
        status,
        /** Có props.json — mở được trình chỉnh sửa. */
        editable: Boolean(props),
        /** Tạo từ tab 🎬 Nhiều cảnh — mở lại được danh sách cảnh. */
        multi: fs.existsSync(multiPath(slug)),
        /** Số lần người dùng nhắn (tạo + sửa). */
        edits: turns.filter((m) => m.role === "user").length,
        /** Dung lượng xoá được (render, ảnh cảnh, giọng đọc, dự án). */
        bytes: projectFiles(slug).reduce((sum, f) => sum + dirBytes(f), 0),
        updated,
      };
    })
    .sort((a, b) => b.updated - a.updated);
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
  if (!prompt) throw new Error("Nhập nội dung trước đã.");

  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  for (const file of attachments) {
    if (typeof file !== "string" || !MEDIA_RE.test(file) || file.includes("..")) {
      throw new Error(`File đính kèm không hợp lệ: ${String(file)}`);
    }
    if (!fs.existsSync(path.join(process.cwd(), "public", file))) {
      throw new Error(`Không thấy file đính kèm: ${file}`);
    }
  }

  let slug: string;
  if (input.slug === undefined || input.slug === null || input.slug === "") {
    // Dán cả kịch bản: đặt tên theo tiêu đề, không phải theo cả khối văn bản.
    let nameSource = prompt;
    if (input.settings?.mode === "text") {
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
  const s = input.settings ?? {};
  const settings: ChatSettings = {
    kind: s.kind === "image" || s.kind === "video" ? s.kind : chat.settings.kind,
    style: s.style === "auto" || isStyleId(s.style) ? s.style : chat.settings.style,
    mode: s.mode === "ai" || s.mode === "text" ? s.mode : chat.settings.mode,
    aspect: typeof s.aspect === "string" && ASPECT_IDS.includes(s.aspect as never)
      ? s.aspect : chat.settings.aspect,
    voice: typeof s.voice === "string" && (s.voice === "" || findVoice(s.voice))
      ? s.voice : chat.settings.voice,
    music: typeof s.music === "string" && /^music\/[\w.-]+$/.test(s.music)
      ? s.music : s.music === null ? null : chat.settings.music,
    video: typeof s.video === "string" && (s.video === "" || isVideoModelChoice(s.video))
      ? s.video : chat.settings.video,
  };

  if (settings.kind === "video" && settings.video && !videoModelCatalog().defaultModel) {
    throw new Error(
      "Chọn hình Video AI nhưng chưa có key tạo video. Thêm key Gemini, fal.ai hoặc Replicate trong Cài đặt, hoặc đổi chip Hình về 🖼 Ảnh.",
    );
  }
  if (settings.mode === "ai" && !scriptProvider()) {
    throw new Error(
      "Chưa có API key viết kịch bản. Điền trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí), hoặc chọn 📝 Dùng nguyên văn để dán kịch bản — không cần key.",
    );
  }
  if (settings.mode === "text") {
    // Báo lỗi cú pháp ngay, trước khi ghi tin nhắn và chạy nền.
    textToScript(prompt, { style: settings.style, uploads: attachments as string[] });
  }

  const messages = chat.messages;
  messages.push({ role: "user", text: prompt, at: Date.now(), attachments: attachments as string[] });
  writeChat(slug, { messages, settings });

  const job = startJob(async (log) => {
    try {
      const result = await runPipeline(slug, prompt, attachments as string[], settings, log);
      messages.push({ role: "assistant", at: Date.now(), ...result });
      writeChat(slug, { messages, settings });
      return result;
    } catch (error) {
      messages.push({
        role: "assistant", at: Date.now(), error: true,
        text: error instanceof Error ? error.message : String(error),
      });
      writeChat(slug, { messages, settings });
      throw error;
    } finally {
      running.delete(slug);
    }
  });
  running.set(slug, job.id);
  return { slug, jobId: job.id };
};

const runPipeline = async (
  slug: string,
  prompt: string,
  uploads: string[],
  settings: ChatSettings,
  log: (line: string) => void,
) => {
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
  if (settings.mode === "text") {
    log("Dựng từ kịch bản bạn dán vào — không dùng AI…");
    const previous = existing ? parseScript(existing) : null;
    const parsed = textToScript(prompt, {
      style: settings.style,
      uploads,
      previousImages: previous?.scenes.map((s) => s.image),
      previousStyle: previous?.style,
    });
    script = parsed.script;
    for (const note of parsed.notes) log(note);
  } else if (existing) {
    log("Đang sửa kịch bản theo yêu cầu…");
    script = await editScript(parseScript(existing), prompt, slug, uploads, undefined, settings.style);
  } else {
    log("Đang viết kịch bản…");
    script = await generateScript(prompt, slug, undefined, uploads, settings.style);
  }
  fs.mkdirSync(videoDir(slug), { recursive: true });
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  log(`Kịch bản: ${script.scenes.length} cảnh, ${allLines(script).length} câu`);

  const sceneSummary = script.scenes.map((sc) => ({ lines: sc.lines, image: sc.image }));
  const styleMeta = STYLES[script.style] ?? STYLES.caption;
  const styleLabel = `${styleMeta.emoji} ${styleMeta.label}`;
  log(`Phong cách: ${styleLabel}${settings.style === "auto" ? " (AI chọn)" : ""}`);

  // ---- chế độ ảnh: mỗi cảnh một ảnh tĩnh, không giọng, không nhạc ----
  // Không ghi props.json — giữ nguyên props của bản video (nếu có).
  if (settings.kind === "image") {
    const props = shortSchema.parse(
      scriptToProps(script, { startAtFrame: TITLE_FRAMES, aspect: settings.aspect }),
    );
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
      text: `${existing ? "Đã sửa" : "Đã tạo"} ${total} ảnh "${script.title}" · ${styleLabel}`,
      style: script.style,
      images: sceneImages(slug),
      aspect: settings.aspect,
      scenes: sceneSummary,
    };
  }

  // ---- giọng đọc ----
  log("__STEP__ voice");
  const voice = settings.voice ? findVoice(settings.voice) : undefined;
  let voiceover;
  if (voice) {
    log(`Đang đọc bằng giọng ${voice.key}…`);
    voiceover = await generateVoiceover(allLines(script), slug, voice.engine, voice.id);
  } else {
    log("Không dùng giọng đọc.");
  }

  const props = shortSchema.parse(
    scriptToProps(script, {
      startAtFrame: TITLE_FRAMES,
      voiceover,
      music: settings.music,
      captionPosition: "bottom",
      aspect: settings.aspect,
    }),
  );
  const aiNote = settings.video ? await addAiClips(slug, script, props, settings, log) : "";
  fs.writeFileSync(path.join(videoDir(slug), "props.json"), JSON.stringify(props, null, 2));
  assertImagesExist(props);

  // ---- render ----
  log("__STEP__ render");
  const output = path.join(process.cwd(), "out", `${slug}.mp4`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const { durationInFrames } = await renderShort(props, output, undefined,
    (percent) => log(`__PROGRESS__ ${percent}`));

  const seconds = (durationInFrames / 30).toFixed(1);
  return {
    text: `${existing ? "Đã sửa" : "Đã tạo"} "${script.title}" · ${styleLabel} · ${script.scenes.length} cảnh · ${seconds}s${aiNote ? `\n${aiNote}` : ""}`,
    style: script.style,
    mp4: `/out/${slug}.mp4?t=${Date.now()}`,
    aspect: settings.aspect,
    scenes: sceneSummary,
  };
};

/** Mô tả cho model video, suy từ lời đọc của cảnh — không gọi thêm AI viết prompt. */
const sceneVideoPrompt = (script: VideoScript, index: number) =>
  [
    `B-roll footage for a short video titled "${script.title}".`,
    `Show visually what this narration describes: "${script.scenes[index].lines.join(" ")}".`,
    "Realistic, cinematic camera movement.",
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
  fs.writeFileSync(cachePath, JSON.stringify({ ...cache, [cacheKey]: result.path }, null, 2));
  return result.path;
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Tạo clip AI làm nền cho từng cảnh, trừ cảnh đang dùng file người dùng tải lên.
 * Lỗi thì dừng tạo tiếp (thường là key/billing, sẽ lặp lại ở mọi cảnh) và các cảnh
 * còn lại giữ ảnh. Trả ghi chú lỗi, "" nếu ổn.
 */
const addAiClips = async (
  slug: string,
  script: VideoScript,
  props: ShortProps,
  settings: ChatSettings,
  log: (line: string) => void,
) => {
  const total = props.scenes.length;
  for (let i = 0; i < total; i++) {
    const scene = props.scenes[i];
    if (scene.image?.startsWith("uploads/")) {
      log(`Cảnh ${i + 1}/${total}: giữ file bạn tải lên.`);
      continue;
    }
    log(`Cảnh ${i + 1}/${total}: video AI…`);
    try {
      scene.image = await cachedAiClip(slug, {
        prompt: sceneVideoPrompt(script, i),
        model: settings.video,
        seconds: Math.ceil((scene.endMs - scene.startMs) / 1000),
        aspect: settings.aspect,
      }, log);
    } catch (error) {
      log(`Không tạo được video AI: ${errorText(error)}`);
      return `⚠ Dừng tạo video AI ở cảnh ${i + 1} — các cảnh còn lại dùng ảnh. ${errorText(error)}`;
    }
  }
  return "";
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

const MAX_MULTI_SCENES = 20;

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
    voice: typeof b.voice === "string" && (b.voice === "" || findVoice(b.voice)) ? b.voice : "",
    music: typeof b.music === "string" && /^music\/[\w.-]+$/.test(b.music) ? b.music : null,
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
      running.delete(slug);
    }
  });
  running.set(slug, job.id);
  return { slug, jobId: job.id };
};

const MULTI_GAP_MS = 150;
/** Câu đầu của cảnh vào sau khi hình đã hiện một chút. */
const MULTI_LEAD_MS = 300;

const runMultiScene = async (slug: string, input: MultiInput, log: (line: string) => void) => {
  log("__STEP__ voice");
  const sceneLines = input.scenes.map((s) => s.narration.split(/\n+/).map((l) => l.trim()).filter(Boolean));
  const lines = sceneLines.flat();
  const voice = input.voice ? findVoice(input.voice) : undefined;
  let voiceover: VoiceoverClip[] | undefined;
  if (voice && lines.length > 0) {
    log(`Đang đọc ${lines.length} câu bằng giọng ${voice.key}…`);
    voiceover = await generateVoiceover(lines, slug, voice.engine, voice.id);
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
      atMs += durationMs + MULTI_GAP_MS;
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
    title: input.title, subtitle: "", handle: "@kenh", accent: "#ff6b2c", background: "#000000",
    captions, aspect: input.aspect, style: "plain", scenes,
    captionPosition: "bottom", showTitle: false, voiceoverTrack: null, music: input.music, sfx: false,
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
