/**
 * Gợi ý nội dung bài đăng cho video đã làm xong: tiêu đề, caption, hashtag riêng cho TikTok, YouTube,
 * Facebook, Instagram — viết từ đúng lời trong video, không bịa thêm.
 *
 * Đọc props.json (có cả chỉnh tay trong trình chỉnh sửa), không có thì script.json. Kết quả lưu ở
 * videos/<slug>/post-copy.json kèm dấu vân tay nội dung — video sửa lời sau đó thì báo gợi ý đã cũ.
 * Gọi AI qua llm-json.ts: dùng đúng các nhà cung cấp đang có key, kể cả AI có sẵn trong app.
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { askJson, parseJson, type JsonReply } from "./llm-json";
import { providerLabel, type ProviderChoice, type ScriptProvider } from "./generate-script";

export type PostPlatform = "tiktok" | "youtube" | "facebook" | "instagram";

export type PostCopy = {
  tiktok: { caption: string; hashtags: string[] };
  youtube: { title: string; description: string; hashtags: string[] };
  facebook: { caption: string; hashtags: string[] };
  instagram: { caption: string; hashtags: string[] };
};

export type SavedPostCopy = PostCopy & {
  generatedAt: number;
  provider: ScriptProvider;
  providerLabel: string;
  /** Vân tay lời video lúc viết gợi ý. */
  source: string;
};

type VideoText = { title: string; subtitle: string; handle: string; lines: string[]; seconds: number; vertical: boolean };

const videoDir = (slug: string) => path.join(process.cwd(), "videos", slug);
const cachePath = (slug: string) => path.join(videoDir(slug), "post-copy.json");

const readJsonFile = (file: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** Lời thật của video: phụ đề trong props.json, không có thì các câu trong script.json. */
const videoText = (slug: string): VideoText | null => {
  const props = readJsonFile(path.join(videoDir(slug), "props.json"));
  const script = readJsonFile(path.join(videoDir(slug), "script.json"));
  const captions = Array.isArray(props?.captions) ? (props.captions as { text?: unknown; endMs?: unknown }[]) : [];
  const scenes = Array.isArray(script?.scenes) ? (script.scenes as { lines?: unknown }[]) : [];
  const lines = captions.length
    ? captions.map((c) => String(c.text ?? "").trim())
    : scenes.flatMap((s) => (Array.isArray(s.lines) ? s.lines.map((l) => String(l).trim()) : []));
  const text = lines.filter(Boolean);
  const title = String(props?.title ?? script?.title ?? "").trim();
  if (text.length === 0 && !title) return null;
  const aspect = String(props?.aspect ?? "9:16");
  const [w, h] = aspect.split(":").map(Number);
  return {
    title,
    subtitle: String(props?.subtitle ?? script?.subtitle ?? "").trim(),
    handle: String(props?.handle ?? script?.handle ?? "").trim(),
    lines: text,
    seconds: Math.round(Math.max(0, ...captions.map((c) => Number(c.endMs) || 0)) / 1000),
    vertical: !(w > h),
  };
};

const fingerprint = (text: VideoText) =>
  createHash("sha1").update(JSON.stringify([text.title, text.subtitle, text.lines])).digest("hex").slice(0, 16);

const SYSTEM = `Bạn là người viết nội dung mạng xã hội cho video ngắn. Nhận lời thoại của MỘT video đã làm xong,
viết nội dung bài đăng cho từng nền tảng.

Luật chung:
- Viết bằng ngôn ngữ của lời thoại (lời tiếng Việt thì viết tiếng Việt có dấu).
- CHỈ dựa vào nội dung video. Không bịa số liệu, tên riêng, lời hứa không có trong video.
- Câu đầu phải gây tò mò nhưng không giật tít sai sự thật, không tiết lộ hết nội dung.
- Hashtag: không dấu cách, không dấu tiếng Việt (vd "meoNgu", "khoahoc"), trộn hashtag rộng và hẹp,
  không lặp lại, không kèm ký tự #.
- Không dùng quá 2 emoji mỗi caption.

Từng nền tảng:
- tiktok.caption: 1-2 câu, tối đa 150 ký tự, kết bằng câu hỏi hoặc lời rủ bình luận. hashtags: 3-5.
- youtube.title: tối đa 70 ký tự, có từ khoá chính ở đầu, không viết hoa toàn bộ.
  youtube.description: 2-4 câu tóm tắt giá trị video + lời kêu gọi đăng ký/xem thêm. hashtags: 3-5.
- facebook.caption: 2-4 câu, giọng trò chuyện, có câu hỏi mở để mọi người bình luận. hashtags: 2-3.
- instagram.caption: dòng đầu là hook ngắn; xuống dòng; 2-3 câu nội dung; dòng cuối kêu gọi lưu/chia sẻ.
  hashtags: 5-10.

Chỉ trả về MỘT object JSON đúng cấu trúc:
{"tiktok":{"caption":"","hashtags":[]},"youtube":{"title":"","description":"","hashtags":[]},
 "facebook":{"caption":"","hashtags":[]},"instagram":{"caption":"","hashtags":[]}}`;

const SCHEMA = (() => {
  const tags = { type: "array", items: { type: "string" } };
  const caption = { type: "object", properties: { caption: { type: "string" }, hashtags: tags }, required: ["caption", "hashtags"] };
  return {
    type: "object",
    properties: {
      tiktok: caption,
      youtube: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" }, hashtags: tags },
        required: ["title", "description", "hashtags"],
      },
      facebook: caption,
      instagram: caption,
    },
    required: ["tiktok", "youtube", "facebook", "instagram"],
  };
})();

/** "#Mẹo ngủ" → "MeoNgu": bỏ dấu, bỏ ký tự lạ, gộp từ. */
const cleanTag = (tag: unknown) =>
  String(tag ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/^#+/, "")
    .split(/\s+/)
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, 40);

const tagsOf = (value: unknown, max: number, extra: string[] = []) => {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,]+/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...list, ...extra]) {
    const tag = cleanTag(raw);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(`#${tag}`);
  }
  return out.slice(0, max);
};

const textOf = (value: unknown, max: number) =>
  // Model nhỏ hay tự chèn hashtag vào caption dù đã tách riêng — bỏ ở cuối câu cho khỏi trùng.
  String(value ?? "").replace(/(\s#[^\s#]+)+\s*$/u, "").trim().slice(0, max);

const readCopy = (vertical: boolean) => (reply: JsonReply): PostCopy => {
  const raw = parseJson<Record<string, Record<string, unknown> | undefined>>(reply);
  const part = (key: PostPlatform) => raw?.[key] ?? {};
  const copy: PostCopy = {
    tiktok: { caption: textOf(part("tiktok").caption, 300), hashtags: tagsOf(part("tiktok").hashtags, 5) },
    youtube: {
      title: textOf(part("youtube").title, 100).replace(/[<>]/g, ""),
      description: textOf(part("youtube").description, 1500).replace(/[<>]/g, ""),
      // Video dọc ngắn: thêm #Shorts để YouTube xếp đúng kệ.
      hashtags: tagsOf(part("youtube").hashtags, 5, vertical ? ["Shorts"] : []),
    },
    facebook: { caption: textOf(part("facebook").caption, 1000), hashtags: tagsOf(part("facebook").hashtags, 3) },
    instagram: { caption: textOf(part("instagram").caption, 2000), hashtags: tagsOf(part("instagram").hashtags, 10) },
  };
  if (!copy.tiktok.caption || !copy.youtube.title || !copy.facebook.caption || !copy.instagram.caption) {
    throw new Error(`${reply.who} trả thiếu nội dung cho một nền tảng.`);
  }
  return copy;
};

/** Gợi ý đã lưu (nếu có) và cho biết lời video đã đổi sau lần viết đó chưa. */
export const getPostCopy = (slug: string) => {
  const saved = readJsonFile(cachePath(slug)) as SavedPostCopy | null;
  const text = videoText(slug);
  return { copy: saved, stale: Boolean(saved && text && saved.source !== fingerprint(text)), hasText: Boolean(text) };
};

export const generatePostCopy = async (slug: string, provider: ProviderChoice = "auto") => {
  const text = videoText(slug);
  if (!text) throw new Error("Video này chưa có lời hay phụ đề nào để AI đọc — thêm phụ đề trước.");
  const user = [
    `Tiêu đề trong video: ${text.title || "(không có)"}`,
    text.subtitle ? `Mô tả phụ: ${text.subtitle}` : "",
    text.handle ? `Tên kênh: ${text.handle}` : "",
    `Khung hình: ${text.vertical ? "dọc (Shorts/Reels/TikTok)" : "ngang"}${text.seconds ? `, dài khoảng ${text.seconds} giây` : ""}`,
    "",
    "LỜI THOẠI:",
    // Video dài: đủ ý để tóm tắt mà không làm model nhỏ tràn ngữ cảnh.
    text.lines.join("\n").slice(0, 6000),
  ].filter((line) => line !== "").join("\n");

  const { value, provider: chosen } = await askJson(
    provider,
    { system: SYSTEM, user, schema: SCHEMA, temperature: 0.7, maxTokens: 2000, slowHint: "thử lại, hoặc dùng AI trên mạng" },
    readCopy(text.vertical),
    "Chưa có AI nào để viết gợi ý bài đăng. Điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí).",
  );
  const saved: SavedPostCopy = {
    ...value,
    generatedAt: Date.now(),
    provider: chosen,
    providerLabel: providerLabel(chosen),
    source: fingerprint(text),
  };
  fs.writeFileSync(cachePath(slug), JSON.stringify(saved, null, 2));
  return { copy: saved, stale: false, hasText: true };
};
