import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { listImagesFor } from "./images";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { videoScriptSchema, type VideoScript } from "../src/compositions/Short/script";
import { DEFAULT_STYLE, isStyleId, type StyleId } from "../src/styles/meta";
import { styleSection } from "./style-guides";

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
- Nếu người dùng tải file lên kèm yêu cầu, hiểu là họ muốn dùng file đó ở cảnh phù hợp.`;

export type ScriptProvider = "anthropic" | "openai" | "gemini" | "groq" | "openrouter";

type CompatProvider = Exclude<ScriptProvider, "anthropic">;

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
}> = {
  openai: {
    label: "ChatGPT", baseUrl: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: DEFAULT_OPENAI_MODEL,
  },
  gemini: {
    // Bí danh luôn trỏ bản Flash mới nhất — dòng Flash nằm trong gói miễn phí.
    label: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_SCRIPT_MODEL", defaultModel: "gemini-flash-latest",
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

/** Thứ tự khi "Tự động": trả phí trước (viết tốt hơn), miễn phí sau. */
const PROVIDER_ORDER: ScriptProvider[] = ["anthropic", "openai", "gemini", "groq", "openrouter"];

const hasScriptKey = (provider: ScriptProvider) =>
  Boolean(process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : COMPAT_PROVIDERS[provider].keyEnv]);

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
  /credit|quota|billing|insufficient|exceeded|rate.?limit|denied|permission/i.test(message);

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
  return callModel(
    SYSTEM + styleSection(style) + mediaSection(images, uploads),
    prompt, model, images, style,
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
  const model = process.env[config.modelEnv] || config.defaultModel;
  const schema = openAISchema();
  const send = (responseFormat: Record<string, unknown>, systemText: string) =>
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

  let response = await send(
    { type: "json_schema", json_schema: { name: "video_script", strict: true, schema } },
    system,
  );
  // Model không nhận json_schema (hay gặp ở model miễn phí): thử lại chế độ JSON thường,
  // đưa schema vào prompt. tidyScript + zod vẫn kiểm lại kết quả như mọi nhà cung cấp.
  if (response.status === 400 && /response_format|json_schema|schema|structured/i.test(await response.clone().text())) {
    response = await send(
      { type: "json_object" },
      `${system}\n\nChỉ trả về MỘT object JSON đúng JSON Schema sau, không kèm chữ nào khác:\n${JSON.stringify(schema)}`,
    );
  }

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
      const reason = response.status === 401 || response.status === 403 || /denied|permission/i.test(message)
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
  const r = (raw ?? {}) as Record<string, unknown>;
  const scenes = Array.isArray(r.scenes) ? r.scenes.slice(0, 12) : r.scenes;

  const tidy = {
    ...r,
    style: isStyleId(r.style) ? r.style : DEFAULT_STYLE,
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
