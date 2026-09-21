import Anthropic from "@anthropic-ai/sdk";
import { describeProviderError, isProviderUnavailable } from "./provider-error";
import { freeMode, recordCall } from "./usage";
import { z } from "zod";
import { listImagesFor } from "./images";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { allLines, MAX_SCRIPT_SCENES, videoScriptSchema, type VideoScript } from "../src/compositions/Short/script";
import { DEFAULT_STYLE, isStyleId, type StyleId } from "../src/styles/meta";
import { styleSection } from "./style-guides";
import { textToScript } from "./text-script";
import { hookSection, HOOK_TYPES } from "./hook-library";
import {
  CHAPTER_LINES, lengthLabel, lengthSection, needsChapters, OVERRIDE_NOTE, planFor, resolveLength,
  type LengthChoice, type LengthTarget,
} from "./video-length";
import { LOCAL_AI_LABEL, LOCAL_MODEL_NAME, LocalAiStartError, localAiAvailable, localChat } from "./local-ai";

/** Người dùng chọn một phong cách cụ thể, hoặc để AI tự chọn theo nội dung. */
export type StyleChoice = StyleId | "auto";

const SYSTEM = `Bạn là copywriter chuyên viết kịch bản video — từ video ngắn TikTok/Reels/Shorts tới video
kiến thức, kể chuyện dài nhiều phút. Độ dài theo mục ĐỘ DÀI VIDEO bên dưới.

Quy tắc:
- Viết bằng ngôn ngữ của prompt người dùng. Nếu prompt tiếng Việt, viết tiếng Việt.
- "title": hook ngắn, tối đa 6 từ, đọc là muốn xem tiếp, KHÁC câu hook đầu tiên (không lặp lại nhau). Không dùng dấu chấm cuối câu.
- "subtitle": một dòng làm rõ lợi ích cho người xem.
- "scenes": chia nội dung thành cảnh. Mỗi cảnh là một ý lớn, dùng chung một hình nền.
  Số cảnh và số câu theo mục ĐỘ DÀI VIDEO.
- "scenes[].lines": các câu phụ đề, mỗi câu là MỘT ý trọn vẹn dài 4-12 từ.
- "scenes[].image": chọn từ DANH SÁCH ẢNH bên dưới, hoặc null nếu không ảnh nào hợp.
  Chỉ dùng đúng tên trong danh sách, KHÔNG tự bịa tên file.
- "scenes[].visual": hình vẽ bằng code, bạn TỰ TẠO được, không cần file ảnh.
  Dùng nó khi cảnh có một con số hoặc một bước đáng làm nổi bật:
    { "type": "stat",  "text": "7-9",     "caption": "giờ ngủ mỗi đêm" }
    { "type": "badge", "text": "Bước 1",  "caption": "Cố định giờ đi ngủ" }
  "text" tối đa 16 ký tự, ngắn và đập vào mắt. "caption" giải thích, có thể null.
  Đặt null nếu cảnh không có con số hay bước nào đáng nêu — đừng nhồi cho đủ.
  Người xem đọc câu này trên màn hình điện thoại trong khoảng 1-4 giây,
  nên câu dài quá sẽ bị đọc không kịp. Câu cuối là call-to-action.
- "accent": màu nhấn nổi bật trên nền tối, dùng cho chữ phụ đề và thanh tiến độ.
- "background": màu nền tối (độ sáng thấp) để chữ trắng đọc rõ.
- "handle": tên kênh dạng @tenkenh, suy ra từ chủ đề nếu người dùng không nêu.
- "scenes[].tag": nhãn rất ngắn (≤18 ký tự) hiện suốt cảnh — năm, con số, địa danh, "Bước 1"… hoặc null.
- "scenes[].punch": cụm từ đắt nhất của cảnh, CHÉP NGUYÊN VĂN từ một câu trong "lines" của chính
  cảnh đó (≤48 ký tự), sẽ hiện nổi bật đúng lúc giọng đọc tới. null nếu không có cụm nào đáng nhấn.
- "style": id phong cách hình ảnh — xem mục PHONG CÁCH HÌNH ẢNH bên dưới. Nội dung (số cảnh,
  độ dài câu, tag, punch, visual) phải bám theo phong cách đó.

Chất lượng nội dung — quan trọng hơn mọi quy tắc trình bày ở trên:
- Chỉ nói điều đúng và kiểm chứng được. KHÔNG bịa số liệu, tỉ lệ phần trăm, nghiên cứu, trích dẫn, tên người, năm.
  Không chắc con số thì thay bằng chi tiết cụ thể chắc chắn đúng (cách làm, tình huống, ví dụ) — đừng thay bằng chữ mơ
  hồ như "đáng kể", "rất nhiều". "visual" dạng "stat" chỉ dùng con số có thật.
- Mỗi câu phải có nghĩa khi đọc riêng và là tiếng Việt tự nhiên như người bản xứ nói: không lặp từ, không ghép chữ
  lộn xộn, không văn dịch máy.
- Cụ thể hơn chung chung: một ví dụ thật, một chi tiết thật đáng nhớ hơn ba câu khuyên chung chung. Không câu lấp chỗ.
- Hook: xem mục HOOK bên dưới — bắt buộc với mọi video.
- Mạch ý liền: câu sau nối tiếp câu trước, cảnh sau không nhắc lại cảnh trước.
- Câu đố, đố mẹo: chỉ dùng câu có đáp án đúng và hợp lý — nghe đáp án người xem phải thấy "à, đúng rồi". Đố mẹo phải là
  chơi chữ hoặc lý lẽ khớp với câu hỏi; không chắc thì đổi sang câu hỏi kiến thức có đáp án rõ ràng.

HOOK — câu đọc đầu tiên quyết định người xem ở lại hay lướt qua. BẮT BUỘC với mọi video:
- Câu đầu của cảnh đầu là hook: tối đa 12 từ, vào thẳng điều hấp dẫn nhất. Không chào hỏi, không giới thiệu bản thân
  hay kênh, không "Hôm nay mình sẽ…", "Trong video này…", không mở bằng "Bạn có biết…?" (quá nhàm), không câu chung
  chung ai nói cũng được. Câu thứ hai không lặp lại ý câu đầu.
- Chọn MỘT kiểu hook hợp nội dung nhất:
  • Tò mò — hé một nửa, giấu nửa kia: "Có một món Việt người nước ngoài sợ nhất khi thử."
  • Ngạc nhiên — một dữ kiện thật khiến người ta khựng lại: "Bạch tuộc có tới ba quả tim."
  • Ngược thường thức — đảo điều ai cũng tin: "Uống thật nhiều nước chưa chắc đã tốt."
  • Câu hỏi chạm đúng vấn đề của người xem: "Ngủ đủ tám tiếng mà sáng dậy vẫn mệt?"
  • Mở giữa câu chuyện: "Cô ấy bấm gửi tin nhắn, rồi hối hận ngay giây sau."
  • Thách thức: "Đúng hết năm câu này là cao thủ địa lý."
  • Hậu quả, cái giá: "Thói quen sạc này đang làm pin điện thoại chai nhanh hơn."
- Hook phải ĐÚNG sự thật, và phần sau của video phải trả lời được điều hook hứa. Không câu view bằng thông tin sai,
  không số liệu bịa.
- Câu thứ hai giữ nhịp: hé lý do phải xem tới cuối ("…và điều thứ ba là thứ bạn làm mỗi ngày").

Không giải thích, không thêm emoji vào "lines".`;

/** Kiểu hook gợi ý cho "Tự động" — thư viện hook (scripts/hook-library.ts) giữ danh sách này. */
export { HOOK_TYPES };


const EDIT_RULES = `

Bạn đang SỬA một kịch bản có sẵn theo yêu cầu của người dùng.
- Chỉ đổi những gì người dùng yêu cầu; phần còn lại giữ nguyên từng chữ.
- Cách người dùng gọi tên: "câu" là MỘT phần tử trong scenes[].lines (lời đọc), đánh số liên tục
  qua mọi cảnh — "câu đầu" là scenes[0].lines[0], "câu cuối" là câu cuối của cảnh cuối.
  "cảnh 2" là scenes[1]. "tiêu đề" là "title", "phụ đề phụ"/"dòng mô tả" là "subtitle".
  Người dùng không nhắc tới tiêu đề thì KHÔNG đổi "title" và "subtitle".
- Nếu người dùng tải file lên kèm yêu cầu, hiểu là họ muốn dùng file đó ở cảnh phù hợp.`;

export type ScriptProvider = "anthropic" | "openai" | "gemini" | "groq" | "openrouter" | "ollama" | "local";
/** Lựa chọn trong giao diện: "auto" = theo Cài đặt, còn lại là một nhà cung cấp cụ thể. */
export type ProviderChoice = ScriptProvider | "auto";

type CompatProvider = Exclude<ScriptProvider, "anthropic" | "ollama" | "local">;

/**
 * Ollama: model chạy ngay trên máy — không cần key, không cần mạng. Bật khi chọn "Ollama"
 * trong Cài đặt hoặc điền tên model.
 *
 * Mặc định qwen2.5:1.5b (~1 GB, ngữ cảnh 32K): chạy được trên máy 8 GB RAM, không có chế độ
 * "suy nghĩ" nên trả lời nhanh và bám JSON schema; đủ cho kịch bản ngắn và sửa đơn giản.
 * Máy khoẻ hơn: qwen2.5:3b (~1,9 GB) viết tiếng Việt tốt hơn rõ.
 * Tránh qwen3/qwen3.5 cho việc này: bật suy nghĩ mặc định, chậm hơn nhiều với cùng kết quả.
 */
export const OLLAMA_LABEL = "Ollama (trên máy)";
export const DEFAULT_OLLAMA_MODEL = "qwen2.5:1.5b";
export const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";
/** Model nhỏ trên CPU/GPU máy cá nhân chậm hơn API nhiều — cho đủ thời gian. */
const OLLAMA_TIMEOUT_MS = 10 * 60_000;
/**
 * Mặc định Ollama chỉ giữ ~4K token ngữ cảnh và cắt âm thầm phần thừa. Prompt sửa kịch bản
 * (luật + hướng dẫn phong cách + kịch bản JSON) dài hơn thế, bị cắt là model quên luật.
 */
const OLLAMA_CONTEXT = 16_384;
/** Kịch bản JSON thật chỉ ~600–1.500 token; vượt mức này là model đang lặp lại chính nó. */
const OLLAMA_MAX_TOKENS = 4_096;

/** Model OpenAI mặc định khi người dùng không điền — cần hỗ trợ structured output. */
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

/**
 * Nhà cung cấp dùng chung API chat completions kiểu OpenAI — chỉ khác địa chỉ, key và model.
 * Gemini, Groq, OpenRouter có gói miễn phí (giới hạn số lượt mỗi phút/ngày).
 */
export const COMPAT_PROVIDERS: Record<CompatProvider, {
  label: string;
  baseUrl: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  /** Model dự phòng khi model mặc định quá tải — chỉ dùng khi người dùng không tự điền model. */
  fallbackModels?: string[];
}> = {
  openai: {
    label: "ChatGPT", baseUrl: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: DEFAULT_OPENAI_MODEL,
  },
  gemini: {
    // Bí danh luôn trỏ bản Flash mới nhất — dòng Flash nằm trong gói miễn phí.
    label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_SCRIPT_MODEL", defaultModel: "gemini-flash-latest",
    // Flash hay báo 503 "high demand" từng lúc; bản Lite nhẹ hơn, cũng nằm trong gói miễn phí.
    fallbackModels: ["gemini-flash-lite-latest"],
  },
  groq: {
    label: "Groq", baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", defaultModel: "openai/gpt-oss-120b",
  },
  openrouter: {
    // Bộ định tuyến tự chọn một model miễn phí hỗ trợ structured output.
    label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL", defaultModel: "openrouter/free",
  },
};

/**
 * Nhà cung cấp không chịu được prompt lớn: model chạy trên máy (Ollama, AI có sẵn — ngữ cảnh nhỏ) và gói miễn phí Groq
 * (8.000 token/phút). Hướng dẫn của cả 16 phong cách là ~7.000 token, cộng lời đáp là vượt hạn mức
 * (Groq trả 413). Với các nhà cung cấp này, khi phong cách để "Tự động" thì đoán phong cách bằng từ
 * khoá trước rồi chỉ gửi hướng dẫn của phong cách đó (~1.200 token).
 */
const SMALL_PROMPT: ScriptProvider[] = ["ollama", "local", "groq"];

/**
 * Thứ tự khi "Tự động": trả phí trước (viết tốt hơn), miễn phí sau, máy mình cuối cùng. AI có sẵn trong
 * app luôn dùng được nên đứng chót — chưa điền key nào thì video vẫn viết được bằng nó.
 */
const PROVIDER_ORDER: ScriptProvider[] = ["anthropic", "openai", "gemini", "groq", "openrouter", "ollama", "local"];

const hasScriptKey = (provider: ScriptProvider) => {
  if (provider === "ollama") {
    return Boolean(process.env.OLLAMA_MODEL) || process.env.SCRIPT_PROVIDER === "ollama";
  }
  if (provider === "local") return localAiAvailable();
  return Boolean(process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : COMPAT_PROVIDERS[provider].keyEnv]);
};

export const isScriptProvider = (value: unknown): value is ScriptProvider =>
  typeof value === "string" && PROVIDER_ORDER.includes(value as ScriptProvider);

/** Model sẽ dùng cho một nhà cung cấp: ô Model trong Cài đặt, không điền thì lấy mặc định. */
const providerModel = (provider: ScriptProvider, claudeModel: string) =>
  provider === "anthropic"
    ? claudeModel
    : provider === "ollama"
      ? process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
      : provider === "local"
        ? LOCAL_MODEL_NAME
        : process.env[COMPAT_PROVIDERS[provider].modelEnv] || COMPAT_PROVIDERS[provider].defaultModel;

/**
 * Mọi nhà cung cấp viết kịch bản cho giao diện chọn: nhãn, model đang dùng, đã có key chưa.
 * Thứ tự đúng thứ tự thử khi "Tự động".
 */
export const scriptProviderCatalog = (claudeModel = "claude-opus-5") =>
  PROVIDER_ORDER.map((id) => ({
    id,
    label: providerLabel(id),
    model: providerModel(id, claudeModel),
    available: hasScriptKey(id) && !(freeMode() && PAID_SCRIPT_PROVIDERS.includes(id)),
    /** Chỉ có gói trả tiền — chế độ Miễn phí tắt đi. */
    paid: PAID_SCRIPT_PROVIDERS.includes(id),
    /** Prompt phải gọn (ngữ cảnh nhỏ / hạn mức token thấp) — phong cách "Tự động" đoán bằng từ khoá. */
    smallPrompt: SMALL_PROMPT.includes(id),
  }));

/** Tên hiển thị của nhà cung cấp viết kịch bản. */
export const providerLabel = (provider: ScriptProvider) =>
  provider === "anthropic"
    ? "Claude"
    : provider === "ollama" ? OLLAMA_LABEL : provider === "local" ? LOCAL_AI_LABEL : COMPAT_PROVIDERS[provider].label;

/**
 * Nhà cung cấp dùng để viết kịch bản. SCRIPT_PROVIDER cụ thể thì chỉ dùng đúng nó
 * (thiếu key → null); "auto" (mặc định) thì lấy cái đầu tiên có key theo PROVIDER_ORDER.
 * null = chưa có key nào dùng được.
 */
export const scriptProvider = (choice?: ProviderChoice): ScriptProvider | null => scriptProviders(choice)[0] ?? null;

/**
 * Các nhà cung cấp sẽ thử, theo thứ tự. Chọn cụ thể → chỉ đúng nó. "Tự động" → mọi
 * nhà cung cấp có key: cái đầu hết lượt/hết tiền thì chuyển sang cái sau.
 */
/** Nhà cung cấp chỉ có gói trả tiền — chế độ Miễn phí bỏ qua. */
export const PAID_SCRIPT_PROVIDERS: ScriptProvider[] = ["anthropic", "openai"];

export const scriptProviders = (choice?: ProviderChoice): ScriptProvider[] => {
  const all = scriptProvidersIgnoringCost(choice);
  return freeMode() ? all.filter((p) => !PAID_SCRIPT_PROVIDERS.includes(p)) : all;
};

const scriptProvidersIgnoringCost = (choice?: ProviderChoice): ScriptProvider[] => {
  // Người dùng chọn cho riêng video này thì thắng cài đặt chung.
  const pick = choice && choice !== "auto"
    ? choice
    : (process.env.SCRIPT_PROVIDER as ScriptProvider | "auto" | undefined);
  if (pick && pick !== "auto" && PROVIDER_ORDER.includes(pick)) {
    return hasScriptKey(pick) ? [pick] : [];
  }
  return PROVIDER_ORDER.filter(hasScriptKey);
};

/** Lỗi hết lượt / hết tiền / key không có quyền — thử nhà cung cấp khác thì có thể được. */
class ProviderUnavailable extends Error {}

/** Hết lượt/hết tiền/key sai/quá tải/prompt quá lớn — nhà cung cấp khác (nếu có key) vẫn có thể chạy. */
const unavailable = isProviderUnavailable;

/** Danh sách ảnh/video model được phép gán vào "image". File tải lên xếp đầu. */
const mediaSection = (images: string[], uploads: string[]) => {
  const rest = images.filter((i) => !uploads.includes(i));
  const parts: string[] = [];
  if (uploads.length > 0) {
    parts.push(
      "FILE NGƯỜI DÙNG VỪA TẢI LÊN — ưu tiên dùng, mỗi file ít nhất một cảnh " +
        '(file video cũng gán vào "image"):\n' +
        uploads.map((u) => `- ${u}`).join("\n"),
    );
  }
  if (rest.length > 0) {
    parts.push(`DANH SÁCH ẢNH có thể dùng:\n${rest.map((i) => `- ${i}`).join("\n")}`);
  }
  return parts.length === 0
    ? '\n\nDANH SÁCH ẢNH: (trống) — đặt "image" là null cho mọi cảnh.'
    : `\n\n${parts.join("\n\n")}`;
};

export type ScriptOptions = {
  /** Ô chọn độ dài; "auto" (mặc định) = đọc độ dài trong câu prompt. */
  length?: LengthChoice;
  /** Báo tiến độ ra UI — video dài viết theo chương, mất nhiều lượt gọi AI. */
  log?: (line: string) => void;
  /** Công thức mở đầu người dùng chọn (scripts/hook-library.ts); "auto" hoặc bỏ trống = AI tự chọn kiểu. */
  hook?: string;
};

export const generateScript = async (
  prompt: string,
  /** Video slug — quyết định thư mục ảnh nào được đưa cho model chọn. */
  slug?: string,
  model = "claude-opus-5",
  /** Đường dẫn (tính từ public/) của ảnh/video người dùng đính kèm. */
  uploads: string[] = [],
  style: StyleChoice = "auto",
  /** Nhà cung cấp cho riêng lượt này; "auto" = theo Cài đặt. */
  provider: ProviderChoice = "auto",
  options: ScriptOptions = {},
): Promise<VideoScript> => {
  const images = [...uploads, ...listImagesFor(slug)];
  const target = resolveLength(options.length, prompt);
  options.log?.(`Độ dài: ${lengthLabel(target)}${target.source === "ui" ? " (ô chọn)" : target.source === "prompt" ? " (theo prompt)" : ""}`);
  if (needsChapters(target)) {
    return generateLong(prompt, target, images, uploads, model, style, provider, options.log, options.hook);
  }
  // Phong cách gửi cho model: "Tự động" + nhà cung cấp prompt gọn thì đoán bằng từ khoá
  // (như chế độ Nguyên văn) để không phải kèm hướng dẫn cả 16 phong cách. Tính theo từng nhà cung
  // cấp vì "Tự động" có thể chuyển sang nhà cung cấp khác giữa lượt.
  // Đợi rồi thử lại khi chạm giới hạn theo phút: làm hàng loạt, lượt soát của video trước (scripts/review-script.ts) cộng
  // lượt viết của video sau hay vượt hạn mức token/phút của gói miễn phí (Groq ~8.000).
  return withRateLimitRetry(() => callModel(
    (chosen) => SYSTEM + hookSection(options.hook, prompt) + lengthSection(target) + styleSection(styleFor(style, prompt, chosen)) + mediaSection(images, uploads),
    prompt, model, images, style, provider,
  ), options.log);
};

const styleFor = (style: StyleChoice, prompt: string, provider: ScriptProvider) =>
  style === "auto" && SMALL_PROMPT.includes(provider)
    ? textToScript(prompt, { style: "auto" }).script.style
    : style;

const OUTLINE_RULES = `

BƯỚC NÀY CHỈ LẬP DÀN Ý cho một video dài — lời đọc sẽ viết riêng từng chương ở bước sau.
- Mỗi phần tử của "scenes" là MỘT CHƯƠNG, không phải một cảnh.
- "scenes[].tag": tên chương thật ngắn (≤18 ký tự).
- "scenes[].lines": 1-2 câu tóm tắt chương này nói về gì (dàn ý, không phải lời đọc).
- Các chương đi theo mạch: mở bằng hook, thân triển khai từng ý không trùng nhau, chương cuối kết và kêu gọi.
- "image", "visual", "punch": null. "title", "subtitle", "handle", "accent", "background", "style" viết như video thật.`;

const CHAPTER_RULES = `

BẠN ĐANG VIẾT MỘT CHƯƠNG của video dài — các chương sẽ được nối liền thành một video.
- Chỉ viết đúng nội dung chương được giao, không lấn sang chương khác.
- Chương đầu: câu đầu là hook. Chương giữa: không chào lại, không tóm tắt chương trước, nối mạch tự nhiên.
- Chỉ chương cuối mới có call-to-action. Chương khác kết bằng câu dẫn sang ý tiếp theo.
- "title", "subtitle", "handle", "accent", "background", "style": chép nguyên từ dàn ý.`;

/** Gói miễn phí giới hạn lượt/phút — video dài gọi AI nhiều lượt liền nhau nên đợi rồi thử lại. */
const withRateLimitRetry = async <T>(run: () => Promise<T>, log?: (line: string) => void): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Hết lượt trong ngày thì đợi cũng vô ích — báo luôn.
      if (attempt >= 4 || message.includes("trong ngày") || !/429|rate.?limit|try again in|quá tải|high demand|503/i.test(message)) throw error;
      const hinted = Number(message.match(/try again in ([\d.]+)s/i)?.[1]);
      const waitSeconds = Math.min(90, Math.ceil(Number.isFinite(hinted) && hinted > 0 ? hinted + 1 : 15 * attempt));
      log?.(`AI đang giới hạn lượt — đợi ${waitSeconds}s rồi thử lại (${attempt}/3)…`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    }
  }
};

/**
 * Video dài: lập dàn ý chương trước, rồi viết từng chương (≤ CHAPTER_LINES câu một lượt) và nối lại.
 * Một lượt 100 câu thì model nhỏ/gói miễn phí hỏng JSON hoặc từ chối; từng chương 20 câu thì ổn.
 */
const generateLong = async (
  prompt: string,
  target: LengthTarget,
  images: string[],
  uploads: string[],
  model: string,
  style: StyleChoice,
  provider: ProviderChoice,
  log?: (line: string) => void,
  hook?: string,
): Promise<VideoScript> => {
  const plan = target.seconds !== null ? planFor(target.seconds) : null;
  const chapterCount = plan
    ? plan.chapters
    : "tự chọn 3-10 chương tuỳ độ rộng của chủ đề";
  log?.(plan
    ? `Video dài: ~${plan.lines} câu, ${plan.scenes} cảnh — AI viết theo ${plan.chapters} chương.`
    : "Không giới hạn độ dài — AI lập dàn ý chương trước rồi viết từng chương.");

  log?.("Đang lập dàn ý chương…");
  const outline = await withRateLimitRetry(() => callModel(
    (chosen) => SYSTEM + OUTLINE_RULES + styleSection(styleFor(style, prompt, chosen)),
    `${prompt}\n\nSố chương: ${chapterCount}.`,
    model, [], style, provider,
  ), log);
  const chapters = outline.scenes;
  log?.(`Dàn ý: ${chapters.length} chương — ${chapters.map((c, i) => c.tag ?? `Chương ${i + 1}`).join(" · ")}`);

  const outlineText = chapters
    .map((c, i) => `${i + 1}. ${c.tag ?? `Chương ${i + 1}`}: ${c.lines.join(" ")}`)
    .join("\n");
  // Chia đều số câu cho các chương; không giới hạn thì mỗi chương một lượt đầy đủ.
  const linesEach = plan ? Math.max(4, Math.round(plan.lines / chapters.length)) : CHAPTER_LINES;
  const perScene = plan?.linesPerScene ?? 4;

  const scenes: VideoScript["scenes"] = [];
  for (const [i, chapter] of chapters.entries()) {
    log?.(`Đang viết chương ${i + 1}/${chapters.length}: ${chapter.tag ?? ""}…`);
    const previous = allLines({ ...outline, scenes }).slice(-2);
    const sceneCount = Math.max(1, Math.ceil(linesEach / perScene));
    const chapterLength =
      `\n\nĐỘ DÀI CHƯƠNG NÀY: khoảng ${linesEach} câu, chia thành khoảng ${sceneCount} cảnh, mỗi cảnh ${perScene} câu. ` +
      `Đây là yêu cầu cứng.\n${OVERRIDE_NOTE}`;
    const content =
      `CHỦ ĐỀ VIDEO: ${prompt}\n\n` +
      `DÀN Ý (title "${outline.title}", subtitle "${outline.subtitle}", handle "${outline.handle}", ` +
      `accent "${outline.accent}", background "${outline.background}", style "${outline.style}"):\n${outlineText}\n\n` +
      (previous.length ? `Hai câu cuối của chương trước: ${previous.map((l) => `"${l}"`).join(" ")}\n\n` : "") +
      `VIẾT CHƯƠNG ${i + 1}/${chapters.length}${i === 0 ? " (chương đầu)" : i === chapters.length - 1 ? " (chương cuối)" : ""}: ` +
      `${chapter.tag ?? ""} — ${chapter.lines.join(" ")}\n` +
      `Viết khoảng ${linesEach} câu, chia thành khoảng ${sceneCount} cảnh, mỗi cảnh ${perScene} câu.`;
    const part = await withRateLimitRetry(() => callModel(
      () => SYSTEM + (i === 0 ? hookSection(hook, prompt) : "") + chapterLength + CHAPTER_RULES + styleSection(outline.style) + mediaSection(images, uploads),
      content, model, images, outline.style, provider,
    ), log);
    scenes.push(...part.scenes);
  }

  const script = videoScriptSchema.parse({ ...outline, scenes: scenes.slice(0, MAX_SCRIPT_SCENES) });
  log?.(`Ghép ${chapters.length} chương: ${script.scenes.length} cảnh, ${allLines(script).length} câu.`);
  return style === "auto" ? script : { ...script, style };
};

/** Sửa kịch bản có sẵn bằng một câu yêu cầu. */
export const editScript = async (
  current: VideoScript,
  instruction: string,
  slug: string,
  uploads: string[] = [],
  model = "claude-opus-5",
  /** "auto" khi sửa = giữ phong cách hiện tại, trừ khi người dùng yêu cầu đổi. */
  style: StyleChoice = "auto",
  provider: ProviderChoice = "auto",
  options: ScriptOptions = {},
): Promise<VideoScript> => {
  // Ảnh cảnh cũ đang dùng (kể cả file tải lên ở lượt trước) vẫn hợp lệ khi sửa.
  const inUse = current.scenes.map((s) => s.image).filter((i): i is string => Boolean(i));
  const images = [...new Set([...uploads, ...inUse, ...listImagesFor(slug)])];
  const changing = style !== "auto" && style !== current.style;

  // Sửa thường ("đổi câu đầu") giữ nguyên độ dài. Chỉ tính lại độ dài khi câu sửa nêu độ dài,
  // hoặc ô chọn độ dài lệch hẳn (>30%) so với kịch bản đang có.
  const target = resolveLength(options.length, instruction);
  const currentLines = allLines(current).length;
  const wanted = target.seconds !== null ? planFor(target.seconds).lines : null;
  const lengthChanges =
    (target.source === "prompt" && (target.free || wanted !== null)) ||
    (target.source === "ui" && wanted !== null && Math.abs(wanted - currentLines) > currentLines * 0.3);

  // Kéo dài thành video nhiều chương: viết lại theo chương, lấy bản cũ làm nội dung gốc.
  if (lengthChanges && needsChapters(target) && (target.free || (wanted ?? 0) > currentLines * 1.3)) {
    options.log?.(`Kéo dài kịch bản lên ${lengthLabel(target)} — viết lại theo chương.`);
    return generateLong(
      `${instruction}\n\nVideo hiện có tên "${current.title}". Nội dung bản cũ (mở rộng từ đây, giữ chủ đề):\n` +
        allLines(current).join(" "),
      target, images, uploads, model, changing ? style : current.style, provider, options.log,
    );
  }

  return callModel(
    () =>
      SYSTEM + EDIT_RULES +
      (lengthChanges
        ? lengthSection(target)
        : `\n\nĐỘ DÀI VIDEO: giữ đúng độ dài hiện tại (${current.scenes.length} cảnh, ${currentLines} câu) trừ khi yêu cầu sửa nói khác.`) +
      styleSection(style === "auto" ? current.style : style) + mediaSection(images, uploads),
    `KỊCH BẢN HIỆN TẠI:\n${JSON.stringify(current, null, 2)}\n\n` +
      (changing
        ? `Người dùng đã đổi phong cách sang "${style}" — điều chỉnh tag, punch, visual và nhịp câu cho hợp phong cách mới.\n\n`
        : "") +
      `YÊU CẦU SỬA:\n${instruction}`,
    model,
    images,
    style,
    provider,
  );
};

const callModel = async (
  /** Prompt hệ thống dựng theo nhà cung cấp — mỗi nhà cung cấp chịu được độ dài khác nhau. */
  system: (provider: ScriptProvider) => string,
  content: string,
  claudeModel: string,
  allowedImages: string[],
  style: StyleChoice,
  /** Nhà cung cấp người dùng chọn cho lượt này ("auto" = theo Cài đặt). */
  choice: ProviderChoice = "auto",
): Promise<VideoScript> => {
  const providers = scriptProviders(choice);
  if (providers.length === 0) {
    throw new Error(
      choice !== "auto"
        ? `Chưa có key cho ${providerLabel(choice)} — điền trong Cài đặt, hoặc chọn AI khác ở ô tuỳ chọn.`
        : "Chưa có API key viết kịch bản — điền Claude, ChatGPT hoặc một key miễn phí (Gemini, Groq, OpenRouter) trong Cài đặt.",
    );
  }
  let raw: unknown;
  const skipped: string[] = [];
  for (const provider of providers) {
    try {
      const text = system(provider);
      raw = provider === "anthropic"
        ? await callClaude(text, content, claudeModel)
        : provider === "ollama"
          ? await callOllama(text, content)
          : provider === "local"
            ? await callLocal(text, content)
            : await callCompatible(provider, text, content);
      break;
    } catch (error) {
      // Hết lượt/hết tiền và còn nhà cung cấp khác có key → thử tiếp; lỗi khác thì báo ngay.
      if (!(error instanceof ProviderUnavailable) || provider === providers[providers.length - 1]) {
        throw skipped.length
          ? new Error(`${skipped.join("\n")}\n${error instanceof Error ? error.message : error}`)
          : error;
      }
      skipped.push(error.message);
    }
  }
  const script = tidyScript(raw, allowedImages);
  // Người dùng chọn cụ thể thì luôn thắng lựa chọn của model.
  return style === "auto" ? script : { ...script, style };
};

const callClaude = async (
  system: string,
  content: string,
  model: string,
): Promise<VideoScript> => {
  const client = new Anthropic();

  let response;
  try {
    response = await client.messages.parse({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content }],
      output_config: {
        format: zodOutputFormat(videoScriptSchema),
      },
    });
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : undefined;
    const message = error instanceof Error ? error.message : String(error);
    recordCall("Claude", false);
    if (unavailable(status, message)) {
      throw new ProviderUnavailable(describeProviderError("Claude", status, message));
    }
    throw error;
  }

  recordCall("Claude", true);
  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude từ chối yêu cầu này: ${response.stop_details?.explanation ?? "không rõ lý do"}`,
    );
  }

  if (!response.parsed_output) {
    throw new Error(
      "Claude không trả về JSON hợp lệ theo schema. Thử diễn đạt lại prompt.",
    );
  }

  return response.parsed_output;
};

/**
 * JSON Schema cho structured output chế độ strict của OpenAI: mọi object phải
 * liệt kê đủ `required` và cấm thuộc tính thừa. Bỏ các ràng buộc độ dài/pattern —
 * giới hạn đó được áp lại bằng tidyScript + zod sau khi nhận kết quả.
 */
const openAISchema = () => {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (["$schema", "minLength", "maxLength", "minItems", "maxItems", "pattern"].includes(key)) {
        continue;
      }
      out[key] = strip(value);
    }
    if (out.type === "object" && out.properties) {
      out.required = Object.keys(out.properties as object);
      out.additionalProperties = false;
    }
    return out;
  };
  return strip(z.toJSONSchema(videoScriptSchema));
};

/** ChatGPT, Gemini, Groq, OpenRouter — cùng API chat completions kiểu OpenAI. */
const callCompatible = async (provider: CompatProvider, system: string, content: string): Promise<unknown> => {
  const config = COMPAT_PROVIDERS[provider];
  const custom = process.env[config.modelEnv];
  const models = custom ? [custom] : [config.defaultModel, ...(config.fallbackModels ?? [])];
  const schema = openAISchema();
  const send = (model: string, responseFormat: Record<string, unknown>, systemText: string) =>
    fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env[config.keyEnv]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemText },
          { role: "user", content },
        ],
        response_format: responseFormat,
        // gpt-oss trên Groq suy luận trước khi trả lời, suy luận dài ăn hết giới hạn token đầu ra → JSON bị cắt
        // giữa chừng, Groq báo 400 "Failed to validate JSON". Viết kịch bản không cần suy luận sâu.
        ...(provider === "groq" && /gpt-oss/i.test(model) ? { reasoning_effort: "low" } : {}),
      }),
    });

  let model = models[0];
  let response: Response | undefined;
  for (model of models) {
    response = await send(
      model,
      { type: "json_schema", json_schema: { name: "video_script", strict: true, schema } },
      system,
    );
    // Model không nhận json_schema (hay gặp ở model miễn phí), hoặc viết ra JSON sai schema / bị cắt
    // (Groq "json_validate_failed"): thử lại chế độ JSON thường, đưa schema vào prompt.
    // tidyScript + zod vẫn kiểm lại kết quả như mọi nhà cung cấp.
    if (response.status === 400 && /response_format|json_schema|schema|structured|json_validate_failed|validate JSON/i.test(await response.clone().text())) {
      response = await send(
        model,
        { type: "json_object" },
        `${system}\n\nChỉ trả về MỘT object JSON đúng JSON Schema sau, không kèm chữ nào khác:\n${JSON.stringify(schema)}`,
      );
    }
    // Quá tải tạm thời → thử model dự phòng của cùng nhà cung cấp; lỗi khác thì dừng ở đây.
    if (response.status < 500) break;
  }
  if (!response) throw new Error(`${config.label}: chưa có model nào để gọi.`);

  recordCall(config.label, response.ok);
  if (!response.ok) {
    const detail = await response.text();
    let message = detail.slice(0, 300);
    try {
      const parsed = JSON.parse(detail);
      message = (Array.isArray(parsed) ? parsed[0] : parsed).error?.message ?? message;
    } catch {
      // không phải JSON — giữ nguyên text
    }
    const text = describeProviderError(`${config.label} (${model})`, response.status, message);
    if (/json_validate_failed|validate JSON|max completion tokens/i.test(message)) {
      throw new Error(`${config.label} (${model}) viết kịch bản bị cắt giữa chừng hoặc sai cấu trúc — bấm thử lại, ` +
        "hoặc chọn AI khác / đổi model trong ⚙ Cài đặt.");
    }
    if (unavailable(response.status, message)) throw new ProviderUnavailable(text);
    throw new Error(text);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  };
  const message = body.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`${config.label} từ chối yêu cầu này: ${message.refusal}`);
  }
  // Vài model bọc JSON trong ```json … ``` dù đã yêu cầu JSON thuần.
  const text = (message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${config.label} (${model}) không trả về JSON hợp lệ. Thử lại, hoặc đổi model trong Cài đặt.`);
  }
};

/**
 * Ollama trên máy. Dùng API gốc /api/chat thay vì lối tương thích OpenAI, vì chỉ API gốc
 * đặt được num_ctx; `format` nhận JSON Schema để model trả đúng cấu trúc kịch bản.
 */
const callOllama = async (system: string, content: string): Promise<unknown> => {
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  const host = (process.env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).replace(/\/+$/, "");
  /**
   * Quá giờ phải nói là quá giờ. fetch() chỉ ném lỗi khác (TypeError "fetch failed") khi chưa tới
   * được server — lúc đó mới báo "chưa mở Ollama"; lỗi giữa chừng khi đọc thì giữ nguyên.
   */
  const failure = (error: unknown, connecting: boolean) => {
    if (error instanceof Error && error.name === "TimeoutError") {
      return new Error(`Ollama (${model}) chạy quá ${OLLAMA_TIMEOUT_MS / 60_000} phút — thử lại với yêu cầu ngắn hơn.`);
    }
    if (connecting) {
      return new ProviderUnavailable(
        `Không kết nối được Ollama ở ${host} — mở app Ollama (hoặc chạy "ollama serve") rồi thử lại.`,
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  };

  let response: Response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        // Stream để Ollama gửi header ngay. Không stream mà sinh lâu quá 5 phút thì fetch của
        // Node (undici headersTimeout) tự cắt, trông y như mất kết nối.
        stream: true,
        format: openAISchema(),
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        options: { num_ctx: OLLAMA_CONTEXT, num_predict: OLLAMA_MAX_TOKENS, temperature: 0.4 },
      }),
    });
  } catch (error) {
    throw failure(error, true);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    let message = detail;
    try {
      message = (JSON.parse(detail) as { error?: string }).error ?? detail;
    } catch {
      // không phải JSON — giữ nguyên text
    }
    if (response.status === 404 || /not found/i.test(message)) {
      throw new Error(`Máy chưa có model ${model} — chạy "ollama pull ${model}" rồi thử lại.`);
    }
    throw new Error(`Ollama (${model}) báo lỗi ${response.status}: ${message}`);
  }

  // Mỗi dòng là một mẩu JSON { message: { content }, done, done_reason } — ghép phần chữ lại.
  type Chunk = { message?: { content?: string }; done?: boolean; done_reason?: string; error?: string };
  let output = "";
  let last: Chunk | null = null;
  try {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = reader ? await reader.read() : { value: undefined, done: true };
      if (value) buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as Chunk;
        if (chunk.error) throw new Error(`Ollama (${model}) báo lỗi: ${chunk.error}`);
        output += chunk.message?.content ?? "";
        if (chunk.done) last = chunk;
      }
      if (done) break;
    }
  } catch (error) {
    throw failure(error, false);
  }

  if (last?.done_reason === "length") {
    throw new Error(
      `Ollama (${model}) viết quá dài và bị cắt — model nhỏ đang lặp lại. Gửi lại, rút gọn yêu cầu, hoặc dùng model lớn hơn (qwen2.5:3b).`,
    );
  }
  const text = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Ollama (${model}) không trả về JSON hợp lệ. Thử lại, hoặc dùng model lớn hơn (qwen2.5:3b).`);
  }
};

/** AI có sẵn trong app (llama-server kèm bộ cài) — cùng cách gọi như Ollama: schema ép cấu trúc, ngữ cảnh gọn. */
const callLocal = async (system: string, content: string): Promise<unknown> => {
  let reply: { text: string; truncated: boolean };
  try {
    reply = await localChat({ system, user: content, schema: openAISchema(), temperature: 0.4, maxTokens: OLLAMA_MAX_TOKENS });
  } catch (error) {
    // Không bật được model (máy thiếu RAM…) — "Tự động" còn nhà cung cấp khác thì thử tiếp.
    throw error instanceof LocalAiStartError ? new ProviderUnavailable(error.message) : error;
  }
  if (reply.truncated) {
    throw new Error(
      `${LOCAL_AI_LABEL} viết quá dài và bị cắt — model nhỏ đang lặp lại. Gửi lại, rút gọn yêu cầu, hoặc dùng AI trên mạng (Gemini, Groq miễn phí).`,
    );
  }
  const text = reply.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${LOCAL_AI_LABEL} không trả về JSON hợp lệ. Thử lại, hoặc dùng AI trên mạng (Gemini, Groq miễn phí).`);
  }
};

/**
 * Áp lại giới hạn của schema lên kết quả model và bỏ tên ảnh bịa. Model hay vượt
 * vài ký tự hoặc chế tên file — sửa nhẹ còn hơn làm hỏng cả lượt tạo video.
 */
const tidyScript = (raw: unknown, allowedImages: string[]): VideoScript => {
  const clip = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : value;
  /** Như clip nhưng cắt ở ranh giới từ — nhãn ngắn mà đứt giữa chữ trông như lỗi. */
  const clipWords = (value: unknown, max: number) => {
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max + 1);
    const space = cut.lastIndexOf(" ");
    return (space > 0 ? cut.slice(0, space) : text.slice(0, max)).trim();
  };
  /** Model nhỏ hay trả "#FFF", "#ff2e63ff" hay "red" — sai một ô màu không đáng bỏ cả kịch bản. */
  const hexColor = (value: unknown, fallback: string) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-f]{6}$/i.test(text)) return text;
    const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
    const withAlpha = text.match(/^#([0-9a-f]{6})[0-9a-f]{2}$/i);
    return withAlpha ? `#${withAlpha[1]}` : fallback;
  };
  const r = (raw ?? {}) as Record<string, unknown>;
  // Model nhỏ hay lặp nguyên một cảnh nhiều lần — bỏ cảnh trùng hệt lời với cảnh đã có.
  const scenes = Array.isArray(r.scenes)
    ? r.scenes
        .filter((scene, i, all) =>
          all.findIndex((other) => JSON.stringify(other?.lines) === JSON.stringify(scene?.lines)) === i)
        .slice(0, MAX_SCRIPT_SCENES)
    : r.scenes;

  const tidy = {
    ...r,
    style: isStyleId(r.style) ? r.style : DEFAULT_STYLE,
    accent: hexColor(r.accent, "#ff2e63"),
    background: hexColor(r.background, "#0b0b12"),
    title: clip(r.title, 60),
    subtitle: clip(r.subtitle, 90),
    handle: clip(r.handle, 30),
    scenes: Array.isArray(scenes)
      ? scenes.map((scene: Record<string, unknown>) => {
          const visual = scene.visual as Record<string, unknown> | null | undefined;
          const lines = Array.isArray(scene.lines)
            ? scene.lines.map((l) => clip(l, 90)).filter(Boolean).slice(0, 12)
            : scene.lines;
          // punch phải có nguyên văn trong câu thì mới canh được lúc xuất hiện.
          const punch = clip(scene.punch, 48);
          const punchOk = typeof punch === "string" && punch.length > 0 && Array.isArray(lines) &&
            lines.some((l) => String(l).toLocaleLowerCase("vi").includes(punch.toLocaleLowerCase("vi")));
          return {
            lines,
            tag: clipWords(scene.tag, 18) || null,
            punch: punchOk ? punch : null,
            image: typeof scene.image === "string" && allowedImages.includes(scene.image)
              ? scene.image
              : null,
            visual: visual && clip(visual.text, 16)
              ? {
                  type: visual.type,
                  text: clip(visual.text, 16),
                  caption: clip(visual.caption, 40) || null,
                }
              : null,
          };
        })
      : scenes,
  };

  const parsed = videoScriptSchema.safeParse(tidy);
  if (!parsed.success) {
    throw new Error(`Kịch bản AI trả về không đúng định dạng: ${parsed.error.message.slice(0, 300)}`);
  }
  return parsed.data;
};
