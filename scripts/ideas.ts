/**
 * Nghĩ danh sách ý tưởng video từ một chủ đề — đầu vào cho chế độ làm hàng loạt.
 *
 *   generateIdeas("mẹo tiết kiệm pin iPhone", 10)  →  ["...", "...", …]
 *
 * Gọi AI qua llm-json.ts: dùng lại đúng những nhà cung cấp đã có key của generate-script.ts.
 */
import { askJson, parseJson, type JsonReply } from "./llm-json";
import type { ProviderChoice, ScriptProvider } from "./generate-script";

/** Nhiều hơn thế thì model bắt đầu lặp ý; cần nữa thì chạy thêm một lượt với chủ đề khác. */
export const MAX_IDEAS = 50;

const systemPrompt = (count: number) =>
  `Bạn lên danh sách ý tưởng video ngắn (TikTok/Reels/Shorts) bằng tiếng Việt.
Luật:
- Trả đúng ${count} ý tưởng, không thừa không thiếu.
- Mỗi ý tưởng là MỘT câu mô tả nội dung của MỘT video, 6-16 từ, cụ thể và làm được ngay.
- Khác nhau rõ rệt: khác góc nhìn, khác ví dụ, khác con số. Không diễn đạt lại cùng một ý.
- Không đánh số, không emoji, không dấu ngoặc kép trong câu.
Chỉ trả về MỘT object JSON: {"ideas":["...","..."]}`;

/** Đọc {"ideas":[...]}, chấp nhận cả mảng trần và {"ideas":[{"text":…}]}. */
const readIdeas = (reply: JsonReply) => {
  const parsed = parseJson<unknown>(reply);
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { ideas?: unknown; lines?: unknown }).ideas ?? (parsed as { lines?: unknown }).lines;
  if (!Array.isArray(list)) {
    throw new Error(`${reply.who} trả về sai cấu trúc — cần {"ideas":[…]}.`);
  }
  const ideas = list
    .map((item) =>
      typeof item === "string"
        ? item
        : String((item as { text?: unknown; idea?: unknown })?.text ?? (item as { idea?: unknown })?.idea ?? ""),
    )
    // Model hay thêm "1. " dù đã dặn không đánh số.
    .map((text) => text.trim().replace(/^[-*\d.)\s]+/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter(Boolean);
  if (ideas.length === 0) {
    throw new Error(`${reply.who} không trả về ý tưởng nào.`);
  }
  return [...new Set(ideas)];
};

/** So khớp ý tưởng trùng: bỏ hoa thường, dấu câu và khoảng trắng thừa. */
const sameIdea = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Chủ đề → danh sách ý tưởng. Nhà cung cấp nào hết lượt thì thử cái tiếp theo có key,
 * giống hệt lúc viết kịch bản.
 *
 * `avoid`: ý tưởng đã đưa ra ở lượt trước (nút "Đổi ý tưởng") — dặn model nghĩ ý khác và bỏ câu trùng.
 */
export const generateIdeas = async (
  topic: string,
  count: number,
  provider: ProviderChoice = "auto",
  avoid: string[] = [],
): Promise<{ ideas: string[]; provider: ScriptProvider }> => {
  const want = Math.max(1, Math.min(MAX_IDEAS, Math.round(count)));
  const avoidList = avoid.map((line) => line.trim()).filter(Boolean).slice(0, MAX_IDEAS);
  const { value, provider: chosen } = await askJson(
    provider,
    {
      system: systemPrompt(want),
      user: avoidList.length
        ? `Chủ đề: ${topic}\n\nNhững ý tưởng dưới đây đã có — nghĩ ${want} ý tưởng KHÁC hẳn, không lặp lại, không diễn đạt lại:\n${avoidList.map((line) => `- ${line}`).join("\n")}`
        : `Chủ đề: ${topic}`,
      schema: {
        type: "object",
        properties: { ideas: { type: "array", items: { type: "string" } } },
        required: ["ideas"],
      },
      slowHint: "thử ít ý tưởng hơn",
    },
    readIdeas,
    "Chưa có AI nào để nghĩ ý tưởng. Điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí), hoặc tự gõ mỗi dòng một ý tưởng.",
  );
  // Model nhỏ hay chép lại ý cũ dù đã dặn: bỏ câu trùng, trừ khi bỏ xong không còn gì.
  const seen = new Set(avoidList.map(sameIdea));
  const fresh = value.filter((idea) => !seen.has(sameIdea(idea)));
  // Model trả dư thì cắt; trả thiếu vẫn dùng — người dùng thấy danh sách và tự thêm được.
  return { ideas: (fresh.length ? fresh : value).slice(0, want), provider: chosen };
};
