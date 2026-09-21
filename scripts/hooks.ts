/**
 * Thử A/B hook: viết thêm vài câu mở đầu khác nhau cho MỘT kịch bản có sẵn, mỗi câu một kiểu hook
 * (tò mò, thách thức, ngược thường thức…). Chế độ hàng loạt dựng mỗi hook thành một video riêng —
 * phần còn lại giữ nguyên từng chữ — để đăng thử xem câu mở nào giữ người xem lâu hơn.
 *
 *   generateHooks(script, 3)  →  ["…", "…", "…"]
 *
 * Công cụ Hook trong khung chat thì ngược lại: người dùng chọn công thức (hook-library.ts), AI viết mỗi công thức
 * vài câu cho đúng video đang mở để so rồi chọn một câu thay câu mở đầu.
 *
 *   generateTemplateHooks(script, ["know", "dont-do"], 2)  →  [{ template: "know", text, why }, …]
 */
import { askJson, parseJson, type JsonReply } from "./llm-json";
import { type ProviderChoice } from "./generate-script";
import { HOOK_TYPES, hookTemplate, type HookTemplate } from "./hook-library";
import { allLines, type VideoScript } from "../src/compositions/Short/script";

/** Giới hạn độ dài một câu trong kịch bản (videoScriptSchema). */
const MAX_LINE = 90;

/** Bỏ dấu đầu dòng, số thứ tự ("1. ", "2) ") và ngoặc kép model hay thêm — giữ số thuộc về câu ("3 điều…"). */
const clean = (text: string) => text.trim().replace(/^(?:[-*•]\s*|\d+[.)]\s+)/, "").replace(/^["“]|["”]$/g, "").trim();

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
    .map(clean)
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

/** Công cụ Hook: chọn tối đa bấy nhiêu công thức mỗi lượt — nhiều hơn thì model nhỏ viết ẩu, khó so. */
export const MAX_TOOL_TEMPLATES = 6;
/** Mỗi công thức viết mấy câu. */
export const MAX_PER_TEMPLATE = 3;

export type TemplateHook = { template: string; formula: string; text: string; why: string };

const TEMPLATE_SYSTEM = (templates: HookTemplate[], per: number) => `Bạn viết câu MỞ ĐẦU (hook) cho video ngắn TikTok/Reels/Shorts.
Nhận kịch bản của một video đã có. Với MỖI công thức dưới đây, viết ${per} câu hook khác nhau để thay câu đầu tiên của video.

CÔNG THỨC (id — công thức — câu mẫu chỉ để hiểu kiểu viết, KHÔNG chép):
${templates.map((t) => `- ${t.id} — ${t.formula} — ví dụ: ${t.example}`).join("\n")}

Luật:
- Bám đúng công thức nhưng viết cho ĐÚNG chủ đề video này. Không chép câu mẫu.
- Viết bằng ngôn ngữ của kịch bản. Tối đa 12 từ, tối đa ${MAX_LINE} ký tự, một câu, đọc thành tiếng tự nhiên.
- ĐÚNG với nội dung video: phần sau của video phải trả lời được điều hook hứa. Không bịa số liệu, tên riêng.
- Nối liền được với câu thứ hai của kịch bản (câu đó giữ nguyên). Không lặp ý câu thứ hai.
- Không chào hỏi, không giới thiệu kênh, không emoji, không dấu ngoặc kép, không đánh số.
- "why": một câu ngắn (tối đa 15 từ) nói vì sao câu này khiến người xem dừng lướt.
Chỉ trả về MỘT object JSON: {"hooks":[{"template":"<id>","text":"...","why":"..."}]}`;

export const generateTemplateHooks = async (
  script: VideoScript,
  templateIds: string[],
  per = 2,
  provider: ProviderChoice = "auto",
): Promise<TemplateHook[]> => {
  const templates = [...new Set(templateIds)].map(hookTemplate).filter((t): t is HookTemplate => t !== null)
    .slice(0, MAX_TOOL_TEMPLATES);
  if (templates.length === 0) throw new Error("Chọn ít nhất một công thức hook.");
  const count = Math.max(1, Math.min(MAX_PER_TEMPLATE, Math.round(per)));
  const known = new Map(templates.map((t) => [t.id, t]));
  const lines = allLines(script);
  const user = [
    `Tiêu đề: ${script.title}`,
    `Câu mở đầu hiện tại: ${lines[0] ?? ""}`,
    `Câu thứ hai (giữ nguyên): ${lines[1] ?? "(không có)"}`,
    "",
    "TOÀN BỘ LỜI:",
    lines.join("\n").slice(0, 5000),
  ].join("\n");

  const read = (reply: JsonReply) => {
    const parsed = parseJson<unknown>(reply);
    const list = Array.isArray(parsed) ? parsed : (parsed as { hooks?: unknown })?.hooks;
    if (!Array.isArray(list)) throw new Error(`${reply.who} trả về sai cấu trúc — cần {"hooks":[…]}.`);
    const hooks = list.flatMap((item) => {
      const raw = item as { template?: unknown; text?: unknown; why?: unknown };
      const template = known.get(String(raw?.template ?? "")) ?? (templates.length === 1 ? templates[0] : null);
      const text = clean(String(typeof item === "string" ? item : raw?.text ?? ""));
      if (!template || !text) return [];
      return [{
        template: template.id,
        formula: template.formula,
        text: text.length <= MAX_LINE ? text : `${text.slice(0, MAX_LINE - 1).trim()}…`,
        why: clean(String(raw?.why ?? "")).slice(0, 160),
      }];
    });
    if (hooks.length === 0) throw new Error(`${reply.who} không trả về câu hook nào.`);
    return hooks;
  };

  const { value } = await askJson(
    provider,
    {
      system: TEMPLATE_SYSTEM(templates, count),
      user,
      schema: {
        type: "object",
        properties: {
          hooks: {
            type: "array",
            items: {
              type: "object",
              properties: { template: { type: "string" }, text: { type: "string" }, why: { type: "string" } },
              required: ["template", "text", "why"],
            },
          },
        },
        required: ["hooks"],
      },
      temperature: 0.9,
      maxTokens: 2000,
      slowHint: "chọn ít công thức hơn",
    },
    read,
    "Công cụ Hook cần AI viết câu mở đầu — điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí).",
  );

  // Bỏ câu trùng câu gốc hoặc trùng nhau, mỗi công thức giữ tối đa `count` câu, xếp theo thứ tự đã chọn.
  const seen = new Set([same(lines[0] ?? "")]);
  const perTemplate = new Map<string, number>();
  const fresh = value.filter((hook) => {
    const key = same(hook.text);
    const used = perTemplate.get(hook.template) ?? 0;
    if (seen.has(key) || used >= count) return false;
    seen.add(key);
    perTemplate.set(hook.template, used + 1);
    return true;
  });
  if (fresh.length === 0) throw new Error("AI chỉ trả lại câu mở đầu cũ — bấm Viết lại.");
  const order = templates.map((t) => t.id);
  return fresh.sort((a, b) => order.indexOf(a.template) - order.indexOf(b.template));
};
