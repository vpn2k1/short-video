/**
 * Thử A/B hook: viết thêm vài câu mở đầu khác nhau cho MỘT kịch bản có sẵn, mỗi câu một kiểu hook
 * (tò mò, thách thức, ngược thường thức…). Chế độ hàng loạt dựng mỗi hook thành một video riêng —
 * phần còn lại giữ nguyên từng chữ — để đăng thử xem câu mở nào giữ người xem lâu hơn.
 *
 *   generateHooks(script, 3)  →  ["…", "…", "…"]
 */
import { askJson, parseJson, type JsonReply } from "./llm-json";
import { type ProviderChoice } from "./generate-script";
import { HOOK_TYPES } from "./hook-library";
import { allLines, type VideoScript } from "../src/compositions/Short/script";

/** Giới hạn độ dài một câu trong kịch bản (videoScriptSchema). */
const MAX_LINE = 90;

const SYSTEM = (count: number) => `Bạn viết câu MỞ ĐẦU (hook) cho video ngắn TikTok/Reels/Shorts.
Nhận kịch bản của một video đã có. Viết ${count} câu hook KHÁC NHAU để thay cho câu đầu tiên của video.

Luật:
- Mỗi câu một kiểu hook khác nhau, lấy lần lượt trong: ${HOOK_TYPES.join(", ")}.
- Viết bằng ngôn ngữ của kịch bản. Tối đa ${MAX_LINE} ký tự, một câu, đọc thành tiếng tự nhiên.
- ĐÚNG với nội dung video: phần sau của video phải trả lời được điều hook hứa. Không bịa số liệu, tên riêng.
- Nối liền được với câu thứ hai của kịch bản (câu đó giữ nguyên).
- Khác hẳn câu mở đầu hiện tại và khác nhau, không chỉ đổi vài chữ.
- Không emoji, không dấu ngoặc kép, không đánh số.
Chỉ trả về MỘT object JSON: {"hooks":["...","..."]}`;

const readHooks = (reply: JsonReply) => {
  const parsed = parseJson<unknown>(reply);
  const list = Array.isArray(parsed) ? parsed : (parsed as { hooks?: unknown })?.hooks;
  if (!Array.isArray(list)) throw new Error(`${reply.who} trả về sai cấu trúc — cần {"hooks":[…]}.`);
  const hooks = list
    .map((item) => String(typeof item === "string" ? item : (item as { text?: unknown })?.text ?? ""))
    .map((text) => text.trim().replace(/^[-*\d.)\s]+/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter(Boolean)
    .map((text) => (text.length <= MAX_LINE ? text : `${text.slice(0, MAX_LINE - 1).trim()}…`));
  if (hooks.length === 0) throw new Error(`${reply.who} không trả về câu hook nào.`);
  return hooks;
};

const same = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const generateHooks = async (script: VideoScript, count: number, provider: ProviderChoice = "auto") => {
  const lines = allLines(script);
  const user = [
    `Tiêu đề: ${script.title}`,
    `Câu mở đầu hiện tại: ${lines[0] ?? ""}`,
    `Câu thứ hai (giữ nguyên): ${lines[1] ?? "(không có)"}`,
    "",
    "TOÀN BỘ LỜI:",
    lines.join("\n").slice(0, 5000),
  ].join("\n");
  const { value } = await askJson(
    provider,
    {
      system: SYSTEM(count),
      user,
      schema: { type: "object", properties: { hooks: { type: "array", items: { type: "string" } } }, required: ["hooks"] },
      temperature: 0.9,
      slowHint: "thử ít hook hơn",
    },
    readHooks,
    "Thử hook cần AI viết câu mở đầu — điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí).",
  );
  // Model hay trả lại chính câu gốc hoặc hai câu na ná nhau — bỏ trùng.
  const seen = new Set([same(lines[0] ?? "")]);
  const fresh = value.filter((hook) => {
    const key = same(hook);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (fresh.length === 0) throw new Error("AI chỉ trả lại câu mở đầu cũ — bấm Thử lại.");
  return fresh.slice(0, count);
};
