/**
 * "Chuẩn hoá lời": đoạn văn người dùng dán vào → đúng cú pháp kịch bản của app.
 *
 *   normalizeScript("hôm nay mình kể các bạn nghe...", { style: "caption" })
 *     → "# …\n> …\n\n[Mẹo 1]\n…"
 *
 * Khác generate-script.ts: KHÔNG viết nội dung mới — chỉ cắt câu, chia cảnh, đặt tiêu đề,
 * đánh dấu câu nhấn và con số theo đúng cú pháp mà text-script.ts đọc được. Cần 1 API key
 * (hoặc Ollama chạy trên máy) vì phải nhờ model đọc hiểu đoạn văn.
 */
import { askJson, parseJson, type JsonReply } from "./llm-json";
import { providerModels, type ProviderChoice, type ScriptProvider } from "./generate-script";
import { MAX_LINE, MAX_SCENES, textToScript } from "./text-script";
import { STYLES, type StyleId } from "../src/styles/meta";

/** Dài hơn thì model bắt đầu cắt bớt nội dung — video ngắn cũng không cần đến thế. */
export const MAX_INPUT = 12_000;

const RULES = `Cú pháp kịch bản (chỉ dùng đúng những dấu này):
# Tiêu đề            dòng đầu tiên, tối đa 60 ký tự, không có dấu chấm cuối
> Dòng phụ           tuỳ chọn, ngay dưới tiêu đề, tối đa 90 ký tự
(dòng trống)         hết một cảnh, sang cảnh mới
[Nhãn cảnh]          tuỳ chọn, đứng đầu cảnh, tối đa 18 ký tự
**cụm được nhấn**    tối đa MỘT cụm mỗi cảnh, tối đa 48 ký tự, nằm gọn trong một câu của cảnh đó
! 80% | chú thích    con số lớn: phần số tối đa 16 ký tự, chú thích tối đa 40 ký tự, tối đa một dòng mỗi cảnh

Luật:
- Giữ nguyên nội dung, số liệu, tên riêng và ngôn ngữ của người dùng. Được cắt câu dài, bỏ chữ thừa, sửa chính tả và dấu câu. TUYỆT ĐỐI không bịa thêm thông tin, không thêm lời kêu gọi mới.
- Không thêm câu mới: mỗi dòng phải bắt nguồn từ một câu có sẵn trong bản gốc. Thà ít dòng còn hơn viết thêm.
- Dòng "! …" chỉ dùng con số đã có trong bản gốc; chú thích là chữ của bản gốc, không bịa nguồn hay năm ("theo nghiên cứu 2022" là sai). Không có số nào đáng làm nổi thì bỏ hẳn dòng này.
- Mỗi dòng (ngoài tiêu đề, dòng phụ, nhãn, con số) là MỘT câu đọc, tối đa ${MAX_LINE} ký tự. Câu dài thì tách thành nhiều dòng.
- Tối đa ${MAX_SCENES} cảnh, mỗi cảnh 2-4 dòng. Đoạn ngắn thì ít cảnh cũng được.
- Câu đầu tiên là hook: ngắn, gây tò mò, lấy từ chính nội dung người dùng.
- Không đánh số dòng, không gạch đầu dòng, không emoji, không markdown nào khác ngoài **…**.
- Không viết lời giải thích hay ghi chú nào ngoài kịch bản.

Chỉ trả về MỘT object JSON: {"script":"<toàn bộ kịch bản, xuống dòng bằng \\n>"}`;

const systemPrompt = (style: StyleId | "auto") => {
  if (style === "auto") return `Bạn biên tập lời cho video.\n\n${RULES}`;
  const meta = STYLES[style];
  return `Bạn biên tập lời cho video phong cách "${meta.label}" — ${meta.summary}\n\n${RULES}

Mẫu viết đúng kiểu này:
${meta.exampleScript}`;
};

/** Đọc {"script":"…"}, chấp nhận cả mảng dòng và vài tên khoá model hay tự đặt. */
const readScript = (reply: JsonReply, style: StyleId | "auto") => {
  const parsed = parseJson<Record<string, unknown>>(reply);
  const raw = typeof parsed === "string"
    ? parsed
    : parsed?.script ?? parsed?.text ?? parsed?.content ?? parsed?.lines;
  const text = (Array.isArray(raw) ? raw.map(String).join("\n") : String(raw ?? ""))
    .replace(/\\n/g, "\n")   // model đôi khi trả \n dạng chữ trong JSON đã parse
    .trim();
  if (!text) throw new Error(`${reply.who} trả về sai cấu trúc — cần {"script":"…"}.`);
  // Bản chuẩn hoá phải dựng được ngay; không thì coi như model này hỏng, thử model khác.
  const { notes } = textToScript(text, { style });
  return { text, notes };
};

export const normalizeScript = async (
  input: string,
  options: {
    style: StyleId | "auto";
    provider?: ProviderChoice;
    /** Model chọn trong popup Chuẩn hoá lời — phải thuộc danh sách của `provider` (providerModels). */
    model?: string;
  },
): Promise<{ text: string; notes: string[]; provider: ScriptProvider; model: string }> => {
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text) throw new Error("Chưa có lời nào để chuẩn hoá — dán nội dung vào ô nhập trước.");
  if (text.length > MAX_INPUT) {
    throw new Error(`Đoạn dài ${text.length} ký tự — tối đa ${MAX_INPUT}. Cắt bớt rồi chuẩn hoá từng phần.`);
  }

  const provider = options.provider ?? "auto";
  const model = options.model && provider !== "auto" && providerModels(provider).includes(options.model)
    ? options.model : undefined;
  const { value, provider: used, model: usedModel } = await askJson(
    provider,
    {
      system: systemPrompt(options.style),
      user: `Chuẩn hoá đoạn sau thành kịch bản:\n\n${text}`,
      // Việc này là biên tập, không phải nghĩ ý mới — nhiệt độ thấp để bám sát bản gốc.
      temperature: 0.3,
      schema: {
        type: "object",
        properties: { script: { type: "string" } },
        required: ["script"],
      },
      slowHint: "chuẩn hoá từng đoạn ngắn hơn",
    },
    (reply) => readScript(reply, options.style),
    "Chưa có AI nào để chuẩn hoá lời. Điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí), chọn Ollama để chạy trên máy không cần key, hoặc tự viết theo mẫu ở «Xem cách viết lời».",
    { model },
  );
  return { ...value, provider: used, model: usedModel };
};
