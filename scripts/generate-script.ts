import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { listImagesFor } from "./images";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { videoScriptSchema, type VideoScript } from "../src/compositions/Short/script";
import { DEFAULT_STYLE, isStyleId, type StyleId } from "../src/styles/meta";
import { styleSection } from "./style-guides";
import { textToScript } from "./text-script";

/** Người dùng chọn một phong cách cụ thể, hoặc để AI tự chọn theo nội dung. */
export type StyleChoice = StyleId | "auto";

const SYSTEM = `Bạn là copywriter chuyên viết kịch bản video ngắn dọc (TikTok/Reels/Shorts).

Quy tắc:
- Viết bằng ngôn ngữ của prompt người dùng. Nếu prompt tiếng Việt, viết tiếng Việt.
- "title": hook ngắn, tối đa 6 từ, đọc là muốn xem tiếp. Không dùng dấu chấm cuối câu.
- "subtitle": một dòng làm rõ lợi ích cho người xem.
- "scenes": chia nội dung thành cảnh. Mỗi cảnh là một ý lớn, dùng chung một hình nền.
  Video short-form nên có 2-4 cảnh; mỗi cảnh 2-3 câu.
- "scenes[].lines": các câu phụ đề, mỗi câu là MỘT ý trọn vẹn dài 4-12 từ.
  Tổng 5-8 câu cho video 15-30 giây. Chỉ dài hơn khi người dùng yêu cầu rõ.
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

Không giải thích, không thêm emoji vào "lines".`;

const EDIT_RULES = `

Bạn đang SỬA một kịch bản có sẵn theo yêu cầu của người dùng.
- Chỉ đổi những gì người dùng yêu cầu; phần còn lại giữ nguyên từng chữ.
- Cách người dùng gọi tên: "câu" là MỘT phần tử trong scenes[].lines (lời đọc), đánh số liên tục
  qua mọi cảnh — "câu đầu" là scenes[0].lines[0], "câu cuối" là câu cuối của cảnh cuối.
  "cảnh 2" là scenes[1]. "tiêu đề" là "title", "phụ đề phụ"/"dòng mô tả" là "subtitle".
  Người dùng không nhắc tới tiêu đề thì KHÔNG đổi "title" và "subtitle".
- Nếu người dùng tải file lên kèm yêu cầu, hiểu là họ muốn dùng file đó ở cảnh phù hợp.`;

export type ScriptProvider = "anthropic" | "openai" | "gemini" | "groq" | "openrouter" | "ollama";

type CompatProvider = Exclude<ScriptProvider, "anthropic" | "ollama">;

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

/** Thứ tự khi "Tự động": trả phí trước (viết tốt hơn), miễn phí sau, máy mình cuối cùng. */
const PROVIDER_ORDER: ScriptProvider[] = ["anthropic", "openai", "gemini", "groq", "openrouter", "ollama"];

const hasScriptKey = (provider: ScriptProvider) => {
  if (provider === "ollama") {
    return Boolean(process.env.OLLAMA_MODEL) || process.env.SCRIPT_PROVIDER === "ollama";
  }
  return Boolean(process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : COMPAT_PROVIDERS[provider].keyEnv]);
};

/** Tên hiển thị của nhà cung cấp viết kịch bản. */
export const providerLabel = (provider: ScriptProvider) =>
  provider === "anthropic" ? "Claude" : provider === "ollama" ? OLLAMA_LABEL : COMPAT_PROVIDERS[provider].label;

/**
 * Nhà cung cấp dùng để viết kịch bản. SCRIPT_PROVIDER cụ thể thì chỉ dùng đúng nó
 * (thiếu key → null); "auto" (mặc định) thì lấy cái đầu tiên có key theo PROVIDER_ORDER.
 * null = chưa có key nào dùng được.
 */
export const scriptProvider = (): ScriptProvider | null => scriptProviders()[0] ?? null;

/**
 * Các nhà cung cấp sẽ thử, theo thứ tự. Chọn cụ thể → chỉ đúng nó. "Tự động" → mọi
 * nhà cung cấp có key: cái đầu hết lượt/hết tiền thì chuyển sang cái sau.
 */
const scriptProviders = (): ScriptProvider[] => {
  const pick = process.env.SCRIPT_PROVIDER as ScriptProvider | "auto" | undefined;
  if (pick && pick !== "auto" && PROVIDER_ORDER.includes(pick)) {
    return hasScriptKey(pick) ? [pick] : [];
  }
  return PROVIDER_ORDER.filter(hasScriptKey);
};

/** Lỗi hết lượt / hết tiền / key không có quyền — thử nhà cung cấp khác thì có thể được. */
class ProviderUnavailable extends Error {}

const unavailable = (status: number | undefined, message: string) =>
  status === 429 || status === 402 || status === 401 || status === 403 ||
  // Quá tải tạm thời (Gemini hay trả 503 "high demand") — nhà cung cấp khác vẫn có thể chạy.
  status === 500 || status === 502 || status === 503 ||
  /credit|quota|billing|insufficient|exceeded|rate.?limit|denied|permission|high demand|overloaded|unavailable/i.test(message);

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

export const generateScript = async (
  prompt: string,
  /** Video slug — quyết định thư mục ảnh nào được đưa cho model chọn. */
  slug?: string,
  model = "claude-opus-5",
  /** Đường dẫn (tính từ public/) của ảnh/video người dùng đính kèm. */
  uploads: string[] = [],
  style: StyleChoice = "auto",
): Promise<VideoScript> => {
  const images = [...uploads, ...listImagesFor(slug)];
  // Model nhỏ trên máy: kèm hướng dẫn của cả 16 phong cách là vượt ngữ cảnh và làm model rối.
  // Đoán phong cách bằng từ khoá trước (như chế độ Nguyên văn), chỉ gửi hướng dẫn phong cách đó.
  const chosen = style === "auto" && scriptProvider() === "ollama"
    ? textToScript(prompt, { style: "auto" }).script.style
    : style;
  return callModel(
    SYSTEM + styleSection(chosen) + mediaSection(images, uploads),
    prompt, model, images, chosen,
  );
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
): Promise<VideoScript> => {
  // Ảnh cảnh cũ đang dùng (kể cả file tải lên ở lượt trước) vẫn hợp lệ khi sửa.
  const inUse = current.scenes.map((s) => s.image).filter((i): i is string => Boolean(i));
  const images = [...new Set([...uploads, ...inUse, ...listImagesFor(slug)])];
  const changing = style !== "auto" && style !== current.style;
  return callModel(
    SYSTEM + EDIT_RULES + styleSection(style === "auto" ? current.style : style) + mediaSection(images, uploads),
    `KỊCH BẢN HIỆN TẠI:\n${JSON.stringify(current, null, 2)}\n\n` +
      (changing
        ? `Người dùng đã đổi phong cách sang "${style}" — điều chỉnh tag, punch, visual và nhịp câu cho hợp phong cách mới.\n\n`
        : "") +
      `YÊU CẦU SỬA:\n${instruction}`,
    model,
    images,
    style,
  );
};

const callModel = async (
  system: string,
  content: string,
  claudeModel: string,
  allowedImages: string[],
  style: StyleChoice,
): Promise<VideoScript> => {
  const providers = scriptProviders();
  if (providers.length === 0) {
    throw new Error(
      "Chưa có API key viết kịch bản — điền Claude, ChatGPT hoặc một key miễn phí (Gemini, Groq, OpenRouter) trong Cài đặt.",
    );
  }
  let raw: unknown;
  const skipped: string[] = [];
  for (const provider of providers) {
    try {
      raw = provider === "anthropic"
        ? await callClaude(system, content, claudeModel)
        : provider === "ollama"
          ? await callOllama(system, content)
          : await callCompatible(provider, system, content);
      break;
    } catch (error) {
      // Hết lượt/hết tiền và còn nhà cung cấp khác có key → thử tiếp; lỗi khác thì báo ngay.
      if (!(error instanceof ProviderUnavailable) || provider === providers[providers.length - 1]) {
        throw skipped.length
          ? new Error(`${skipped.join(" · ")} · ${error instanceof Error ? error.message : error}`)
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
    if (unavailable(status, message)) {
      throw new ProviderUnavailable(`Claude báo lỗi ${status ?? ""}: ${message} — hết lượt hoặc hết tiền trong tài khoản.`);
    }
    throw error;
  }

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
    // Model không nhận json_schema (hay gặp ở model miễn phí): thử lại chế độ JSON thường,
    // đưa schema vào prompt. tidyScript + zod vẫn kiểm lại kết quả như mọi nhà cung cấp.
    if (response.status === 400 && /response_format|json_schema|schema|structured/i.test(await response.clone().text())) {
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

  if (!response.ok) {
    const detail = await response.text();
    let message = detail.slice(0, 300);
    try {
      const parsed = JSON.parse(detail);
      message = (Array.isArray(parsed) ? parsed[0] : parsed).error?.message ?? message;
    } catch {
      // không phải JSON — giữ nguyên text
    }
    const text = `${config.label} (${model}) báo lỗi ${response.status}: ${message}`;
    if (unavailable(response.status, message)) {
      const reason = response.status >= 500 || /high demand|overloaded|unavailable/i.test(message)
        ? "máy chủ đang quá tải tạm thời — thử lại sau ít phút"
        : response.status === 401 || response.status === 403 || /denied|permission/i.test(message)
          ? "key sai hoặc tài khoản bị từ chối quyền — kiểm tra key, hoặc tạo key ở tài khoản khác"
          : "hết lượt hoặc hết tiền trong tài khoản. Gói miễn phí giới hạn theo phút/ngày: đợi một lúc, hoặc thêm key nhà cung cấp khác";
      throw new ProviderUnavailable(`${text} — ${reason}.`);
    }
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
        .slice(0, 12)
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
