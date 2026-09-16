/**
 * Dịch phụ đề sang ngôn ngữ khác sau khi phiên âm.
 *
 * Hai loại model:
 *  - Trên mạng, dùng lại key đã điền trong Cài đặt: Gemini, Groq, OpenRouter (có gói miễn phí), ChatGPT, Claude.
 *    Gửi cả khối câu kèm số thứ tự, nhận lại JSON — model hiểu ngữ cảnh cả đoạn và giữ đúng số câu, nên thời
 *    gian phụ đề giữ nguyên.
 *  - AI có sẵn trong app (llama-server + Qwen2.5 1.5B kèm bộ cài): không cần cài gì, dịch theo khối JSON.
 *    Model nhỏ — dịch được câu đơn giản, kém hơn model trên mạng và TranslateGemma.
 *  - Trên máy: Ollama, mặc định TranslateGemma 4B (Google, dựng trên Gemma 3, chuyên dịch 55 ngôn ngữ).
 *    TranslateGemma chỉ nhận đúng một mẫu prompt và trả chữ thuần — dịch từng câu. Model Ollama khác thì dịch
 *    theo khối JSON như model trên mạng.
 *
 * Đã đo trên key Gemini miễn phí (15/09/2026): gemini-flash-lite-latest dịch 4 câu trong ~1,3s, đủ câu và đúng
 * thứ tự; gemini-flash-latest hay trả 503 "high demand" nên chỉ làm dự phòng. Không dặn "giữ mọi chi tiết"
 * thì bản Lite từng bỏ mất một cụm ("cả năm") — luật đó nằm trong prompt dưới đây.
 */
import Anthropic from "@anthropic-ai/sdk";
import { COMPAT_PROVIDERS, DEFAULT_OLLAMA_HOST } from "./generate-script";
import { LOCAL_AI_LABEL, LOCAL_MODEL_NAME, localAiAvailable, localChat } from "./local-ai";

export const TRANSLATE_LANGUAGES = [
  { code: "vi", label: "Tiếng Việt", name: "Vietnamese" },
  { code: "en", label: "Tiếng Anh", name: "English" },
  { code: "zh-Hans", label: "Tiếng Trung (giản thể)", name: "Chinese" },
  { code: "ja", label: "Tiếng Nhật", name: "Japanese" },
  { code: "ko", label: "Tiếng Hàn", name: "Korean" },
  { code: "th", label: "Tiếng Thái", name: "Thai" },
  { code: "id", label: "Tiếng Indonesia", name: "Indonesian" },
  { code: "es", label: "Tiếng Tây Ban Nha", name: "Spanish" },
  { code: "fr", label: "Tiếng Pháp", name: "French" },
  { code: "de", label: "Tiếng Đức", name: "German" },
] as const;

export type TranslateLanguage = (typeof TRANSLATE_LANGUAGES)[number]["code"];
export type TranslateEngine = "gemini" | "groq" | "openrouter" | "openai" | "anthropic" | "local" | "ollama";

/** Thứ tự cũng là thứ tự chọn sẵn: model trên mạng có key trước, AI có sẵn trong app sau. */
export const TRANSLATE_ENGINES: TranslateEngine[] = ["gemini", "groq", "openrouter", "openai", "anthropic", "local", "ollama"];

export const isTranslateLanguage = (value: unknown): value is TranslateLanguage =>
  TRANSLATE_LANGUAGES.some((l) => l.code === value);
export const isTranslateEngine = (value: unknown): value is TranslateEngine =>
  TRANSLATE_ENGINES.includes(value as TranslateEngine);

/** TranslateGemma 4B: ~3,3 GB, máy 8 GB RAM chạy được. Bản 12b (~8,1 GB) dịch tốt hơn, cần 16 GB RAM trở lên. */
export const DEFAULT_TRANSLATE_OLLAMA_MODEL = "translategemma:4b";

/** Gemini: bản Lite nhanh và ổn định hơn; bí danh Flash chỉ làm dự phòng vì hay quá tải. */
const GEMINI_TRANSLATE_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
const CLAUDE_TRANSLATE_MODEL = "claude-sonnet-5";
/** Số câu mỗi lần gửi — đủ ngữ cảnh mà model miễn phí vẫn trả đủ câu. */
const BATCH = 30;
const OLLAMA_TIMEOUT_MS = 10 * 60_000;

const ENGINE_LABELS: Record<TranslateEngine, string> = {
  gemini: "Gemini (Google) — miễn phí",
  groq: "Groq — miễn phí",
  openrouter: "OpenRouter — model miễn phí",
  openai: "ChatGPT (OpenAI)",
  anthropic: "Claude (Anthropic)",
  local: `${LOCAL_AI_LABEL} (${LOCAL_MODEL_NAME}) — không cần mạng`,
  ollama: "Ollama — trên máy, không cần mạng",
};

const ollamaHost = () => (process.env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).replace(/\/+$/, "");
export const translateOllamaModel = () => process.env.TRANSLATE_OLLAMA_MODEL || DEFAULT_TRANSLATE_OLLAMA_MODEL;

const keyOf = (engine: Exclude<TranslateEngine, "ollama" | "local">) =>
  engine === "anthropic" ? "ANTHROPIC_API_KEY" : COMPAT_PROVIDERS[engine].keyEnv;

export const translateEngineLabel = (engine: TranslateEngine) => ENGINE_LABELS[engine];
export const translateLanguageLabel = (code: TranslateLanguage) => TRANSLATE_LANGUAGES.find((l) => l.code === code)?.label ?? code;

/** Tên biến key còn thiếu của model dịch trên mạng; null nếu dùng được (model trên máy kiểm lúc chạy). */
export const missingTranslateKey = (engine: TranslateEngine) =>
  engine === "ollama" || engine === "local" || process.env[keyOf(engine)] ? null : keyOf(engine);

/** Tên model trên Ollama so khớp cả khi không ghi tag (translategemma = translategemma:latest). */
const sameOllamaModel = (installed: string, wanted: string) =>
  installed === wanted || installed === `${wanted}:latest`;

export type OllamaStatus = "ready" | "not-running" | "no-model";

export type TranslateEngineInfo = {
  id: TranslateEngine;
  label: string;
  /** Dùng được ngay. */
  ready: boolean;
  /** Mạng: tên biến key còn thiếu. Ollama: trạng thái máy. */
  missingKey?: string;
  ollama?: { status: OllamaStatus; host: string; model: string; installed: string[] };
};

/** Trạng thái các model dịch — Ollama được hỏi thật (tối đa 1,5 giây). */
export const translateEngines = async (): Promise<TranslateEngineInfo[]> => {
  const host = ollamaHost();
  const model = translateOllamaModel();
  let installed: string[] | null = null;
  try {
    const response = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const body = (await response.json()) as { models?: { name: string }[] };
      installed = (body.models ?? []).map((m) => m.name);
    }
  } catch {
    // chưa cài hoặc chưa mở Ollama
  }
  const status: OllamaStatus = installed === null
    ? "not-running"
    : installed.some((name) => sameOllamaModel(name, model)) ? "ready" : "no-model";

  return TRANSLATE_ENGINES.map((id) => {
    if (id === "ollama") {
      return { id, label: ENGINE_LABELS[id], ready: status === "ready", ollama: { status, host, model, installed: installed ?? [] } };
    }
    if (id === "local") return { id, label: ENGINE_LABELS[id], ready: localAiAvailable() };
    const env = keyOf(id);
    const ready = Boolean(process.env[env]);
    return { id, label: ENGINE_LABELS[id], ready, ...(ready ? {} : { missingKey: env }) };
  });
};

const languageName = (code: string) => TRANSLATE_LANGUAGES.find((l) => l.code === code)?.name ?? code;

const batchPrompt = (to: TranslateLanguage, from?: string) =>
  `You translate subtitles of a short vertical video (TikTok/Reels/Shorts)` +
  `${from ? ` from ${languageName(from)}` : ""} into ${languageName(to)}.
Rules:
- Translate every item. Keep the same number of items, the same order and the same "i".
- Keep every fact, number, name and detail. Do not drop, merge, split or add content.
- Natural spoken ${languageName(to)}, short lines that are easy to read on a phone.
- If an item is already in ${languageName(to)}, return it unchanged.
Return ONLY a JSON object: {"lines":[{"i":0,"text":"..."}]}`;

const stripFence = (text: string) => text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

/** Đọc {"lines":[{i,text}]} và kiểm đủ câu, đúng thứ tự — sai thì ném lỗi để thử lại. */
const readLines = (raw: string, count: number, who: string) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    throw new Error(`${who} không trả về JSON hợp lệ.`);
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { lines?: unknown }).lines;
  if (!Array.isArray(list)) throw new Error(`${who} trả về sai cấu trúc.`);
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const item = list.find((x) => Number((x as { i?: unknown })?.i) === i) as { text?: unknown } | undefined;
    if (typeof item?.text !== "string" || !item.text.trim()) {
      throw new Error(`${who} trả thiếu câu ${i + 1}/${count}.`);
    }
    texts.push(item.text.trim());
  }
  return texts;
};

const errorMessage = async (response: Response) => {
  const detail = await response.text();
  try {
    const parsed = JSON.parse(detail);
    return String((Array.isArray(parsed) ? parsed[0] : parsed).error?.message ?? parsed.error ?? detail).slice(0, 300);
  } catch {
    return detail.slice(0, 300);
  }
};

/** Gemini, Groq, OpenRouter, ChatGPT — API chat completions kiểu OpenAI. */
const translateCompatible = async (
  engine: "gemini" | "groq" | "openrouter" | "openai",
  items: string[],
  to: TranslateLanguage,
  from: string | undefined,
) => {
  const config = COMPAT_PROVIDERS[engine];
  // Gemini luôn dùng cặp model đã đo cho việc dịch, không theo model viết kịch bản trong Cài đặt.
  const custom = engine === "gemini" ? undefined : process.env[config.modelEnv];
  const models = custom
    ? [custom]
    : engine === "gemini" ? GEMINI_TRANSLATE_MODELS : [config.defaultModel, ...(config.fallbackModels ?? [])];
  const content = JSON.stringify(items.map((text, i) => ({ i, text })));

  let lastError = `${config.label}: chưa có model nào để gọi.`;
  for (const model of models) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env[config.keyEnv]}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: batchPrompt(to, from) },
          { role: "user", content },
        ],
      }),
    });
    if (!response.ok) {
      lastError = `${config.label} (${model}) báo lỗi ${response.status}: ${await errorMessage(response)}`;
      // Quá tải / hết lượt → thử model dự phòng; lỗi khác (key sai…) thì dừng.
      if (response.status >= 500 || response.status === 429) continue;
      break;
    }
    const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
    return readLines(body.choices?.[0]?.message?.content ?? "", items.length, `${config.label} (${model})`);
  }
  throw new Error(lastError);
};

const translateClaude = async (items: string[], to: TranslateLanguage, from: string | undefined) => {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: CLAUDE_TRANSLATE_MODEL,
    max_tokens: 16000,
    system: batchPrompt(to, from),
    messages: [{ role: "user", content: JSON.stringify(items.map((text, i) => ({ i, text }))) }],
  });
  const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  return readLines(text, items.length, "Claude");
};

/** Gọi /api/chat của Ollama, không stream — mỗi lần chỉ một câu hoặc một khối nhỏ. */
const ollamaChat = async (model: string, messages: { role: string; content: string }[], format?: unknown) => {
  const host = ollamaHost();
  let response: Response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      body: JSON.stringify({ model, stream: false, messages, ...(format ? { format } : {}), options: { temperature: 0.2 } }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`Ollama (${model}) dịch quá ${OLLAMA_TIMEOUT_MS / 60_000} phút — thử đoạn ngắn hơn.`);
    }
    throw new Error(`Không kết nối được Ollama ở ${host} — mở app Ollama (hoặc chạy "ollama serve") rồi thử lại.`);
  }
  if (!response.ok) {
    const message = await errorMessage(response);
    if (response.status === 404 || /not found/i.test(message)) {
      throw new Error(`Máy chưa có model ${model} — chạy "ollama pull ${model}" rồi thử lại.`);
    }
    throw new Error(`Ollama (${model}) báo lỗi ${response.status}: ${message}`);
  }
  const body = (await response.json()) as { message?: { content?: string } };
  return body.message?.content ?? "";
};

/** Cấu trúc {"lines":[{i,text}]} cho model trên máy — schema buộc model nhỏ trả đúng khuôn. */
const LINES_SCHEMA = {
  type: "object",
  properties: {
    lines: { type: "array", items: { type: "object", properties: { i: { type: "integer" }, text: { type: "string" } }, required: ["i", "text"] } },
  },
  required: ["lines"],
};

/** Mẫu prompt chính thức của TranslateGemma — hai dòng trống trước đoạn cần dịch. */
const translateGemmaPrompt = (text: string, to: TranslateLanguage, from: string) => {
  const source = `${languageName(from)} (${from})`;
  const target = `${languageName(to)} (${to})`;
  return `You are a professional ${source} to ${target} translator. Your goal is to accurately convey the meaning and ` +
    `nuances of the original ${languageName(from)} text while adhering to ${languageName(to)} grammar, vocabulary, ` +
    `and cultural sensitivities. Produce only the ${languageName(to)} translation, without any additional explanations ` +
    `or commentary. Please translate the following ${languageName(from)} text into ${languageName(to)}:\n\n\n${text}`;
};

const translateOllama = async (
  items: string[],
  to: TranslateLanguage,
  from: string | undefined,
  log: (line: string) => void,
  done: number,
  total: number,
) => {
  const model = translateOllamaModel();
  if (/translategemma/i.test(model)) {
    const out: string[] = [];
    for (const [k, text] of items.entries()) {
      // TranslateGemma cần biết ngôn ngữ nguồn; "Tự nhận" thì đoán theo dấu tiếng Việt.
      const source = from ?? (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text) ? "vi" : "en");
      const result = (await ollamaChat(model, [{ role: "user", content: translateGemmaPrompt(text, to, source) }])).trim();
      out.push(result || text);
      log(`  Đã dịch ${done + k + 1}/${total} câu`);
    }
    return out;
  }
  const raw = await ollamaChat(model, [
    { role: "system", content: batchPrompt(to, from) },
    { role: "user", content: JSON.stringify(items.map((text, i) => ({ i, text }))) },
  ], LINES_SCHEMA);
  return readLines(raw, items.length, `Ollama (${model})`);
};

/** AI có sẵn trong app — dịch theo khối JSON, schema ép đúng cấu trúc {"lines":[{i,text}]}. */
const translateLocal = async (items: string[], to: TranslateLanguage, from: string | undefined) => {
  const { text } = await localChat({
    system: batchPrompt(to, from),
    user: JSON.stringify(items.map((text, i) => ({ i, text }))),
    schema: LINES_SCHEMA,
    temperature: 0.2,
  });
  return readLines(text, items.length, LOCAL_AI_LABEL);
};

/**
 * Dịch danh sách câu, trả mảng cùng độ dài và cùng thứ tự. `from` bỏ trống = để model tự nhận ngôn ngữ nguồn.
 * Mỗi khối trả thiếu câu thì thử lại một lần trước khi báo lỗi.
 */
export const translateLines = async (
  texts: string[],
  { to, from, engine }: { to: TranslateLanguage; from?: string; engine: TranslateEngine },
  log: (line: string) => void,
): Promise<string[]> => {
  const missing = missingTranslateKey(engine);
  if (missing) {
    throw new Error(`Chưa có key ${missing} — điền trong ⚙ Cài đặt, hoặc chọn model dịch khác.`);
  }
  const out: string[] = [];
  for (let start = 0; start < texts.length; start += BATCH) {
    const chunk = texts.slice(start, start + BATCH);
    const run = () =>
      engine === "ollama"
        ? translateOllama(chunk, to, from, log, start, texts.length)
        : engine === "local"
          ? translateLocal(chunk, to, from)
          : engine === "anthropic"
            ? translateClaude(chunk, to, from)
            : translateCompatible(engine, chunk, to, from);
    let result: string[];
    try {
      result = await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/thiếu câu|JSON|cấu trúc/.test(message)) throw error;
      log(`  ${message} Thử lại…`);
      result = await run();
    }
    out.push(...result);
    if (engine !== "ollama") log(`  Đã dịch ${out.length}/${texts.length} câu`);
  }
  return out;
};
