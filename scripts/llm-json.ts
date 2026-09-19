/**
 * Hỏi một câu, nhận lại MỘT object JSON — dùng cho các việc nhẹ bên cạnh việc viết kịch bản:
 * nghĩ ý tưởng hàng loạt (ideas.ts), chuẩn hoá lời dán vào (normalize-script.ts).
 *
 * Dùng lại đúng những nhà cung cấp đã có key của generate-script.ts, nhưng gọi kiểu văn bản
 * thuần nên model nhỏ và model miễn phí cũng làm được — không cần structured output nặng.
 */
import Anthropic from "@anthropic-ai/sdk";
import { describeProviderError } from "./provider-error";
import { recordCall } from "./usage";
import {
  COMPAT_PROVIDERS,
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
  providerLabel,
  scriptProviders,
  type ProviderChoice,
  type ScriptProvider,
} from "./generate-script";
import { LOCAL_AI_LABEL, localChat } from "./local-ai";

const OLLAMA_TIMEOUT_MS = 5 * 60_000;

export type JsonAsk = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** JSON Schema — chỉ model trên máy (Ollama, AI có sẵn) cần; các nhà cung cấp OpenAI-compat chỉ cần bật chế độ JSON. */
  schema?: Record<string, unknown>;
  /** Nhắc gì khi Ollama chạy quá lâu, ví dụ "thử ít ý tưởng hơn". */
  slowHint?: string;
};

/** Lời đáp thô + tên model đã trả lời, để thông báo lỗi chỉ đúng chỗ cần sửa. */
export type JsonReply = { raw: string; who: string };

const stripFence = (text: string) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

/** Đọc object JSON trong lời đáp; model nào trả rác thì báo tên model đó. */
export const parseJson = <T>({ raw, who }: JsonReply): T => {
  try {
    return JSON.parse(stripFence(raw)) as T;
  } catch {
    throw new Error(`${who} không trả về JSON hợp lệ.`);
  }
};

const errorMessage = async (response: Response) => {
  const detail = await response.text();
  try {
    const parsed = JSON.parse(detail);
    return String(
      (Array.isArray(parsed) ? parsed[0] : parsed).error?.message ?? parsed.error ?? detail,
    ).slice(0, 300);
  } catch {
    return detail.slice(0, 300);
  }
};

const compatAsk = async (
  provider: Exclude<ScriptProvider, "anthropic" | "ollama" | "local">,
  ask: JsonAsk,
): Promise<JsonReply> => {
  const config = COMPAT_PROVIDERS[provider];
  const models = [
    process.env[config.modelEnv] || config.defaultModel,
    ...(process.env[config.modelEnv] ? [] : config.fallbackModels ?? []),
  ];
  let lastError = `${config.label}: chưa có model nào để gọi.`;
  for (const model of models) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env[config.keyEnv]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: ask.temperature ?? 0.9,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ask.system },
          { role: "user", content: ask.user },
        ],
      }),
    });
    if (!response.ok) {
      recordCall(config.label, false);
      lastError = describeProviderError(`${config.label} (${model})`, response.status, await errorMessage(response));
      // Quá tải / hết lượt → thử model dự phòng; lỗi khác (key sai…) thì dừng luôn.
      if (response.status >= 500 || response.status === 429) continue;
      break;
    }
    recordCall(config.label, true);
    const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
    return { raw: body.choices?.[0]?.message?.content ?? "", who: `${config.label} (${model})` };
  }
  throw new Error(lastError);
};

const claudeAsk = async (ask: JsonAsk): Promise<JsonReply> => {
  const client = new Anthropic();
  const model = process.env.CLAUDE_MODEL || "claude-opus-5";
  const response = await client.messages.create({
    model,
    max_tokens: ask.maxTokens ?? 4000,
    system: ask.system,
    messages: [{ role: "user", content: ask.user }],
  });
  return {
    raw: response.content.map((block) => (block.type === "text" ? block.text : "")).join(""),
    who: `Claude (${model})`,
  };
};

const ollamaAsk = async (ask: JsonAsk): Promise<JsonReply> => {
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  const host = (process.env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: ask.temperature ?? 0.9 },
        ...(ask.schema ? { format: ask.schema } : {}),
        messages: [
          { role: "system", content: ask.system },
          { role: "user", content: ask.user },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      const hint = ask.slowHint ? ` — ${ask.slowHint}` : "";
      throw new Error(`Ollama (${model}) nghĩ quá ${OLLAMA_TIMEOUT_MS / 60_000} phút${hint}.`);
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
  return { raw: body.message?.content ?? "", who: `Ollama (${model})` };
};

const localAsk = async (ask: JsonAsk): Promise<JsonReply> => {
  const { text } = await localChat({
    system: ask.system,
    user: ask.user,
    schema: ask.schema,
    json: !ask.schema,
    temperature: ask.temperature ?? 0.9,
    maxTokens: ask.maxTokens ?? 4000,
  });
  return { raw: text, who: LOCAL_AI_LABEL };
};

/**
 * Hỏi lần lượt những nhà cung cấp đang có key cho tới khi một cái trả lời đúng.
 * `read` vừa đọc vừa kiểm tra lời đáp — ném lỗi là coi như nhà cung cấp đó hỏng, thử cái sau.
 */
export const askJson = async <T>(
  choice: ProviderChoice,
  ask: JsonAsk,
  read: (reply: JsonReply) => T,
  noKeyError: string,
): Promise<{ value: T; provider: ScriptProvider }> => {
  const providers = scriptProviders(choice);
  if (providers.length === 0) {
    throw new Error(
      choice !== "auto" ? `Chưa có key cho ${providerLabel(choice)} — điền trong Cài đặt.` : noKeyError,
    );
  }

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const reply =
        provider === "anthropic"
          ? await claudeAsk(ask)
          : provider === "ollama"
            ? await ollamaAsk(ask)
            : provider === "local"
              ? await localAsk(ask)
              : await compatAsk(provider, ask);
      return { value: read(reply), provider };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(failures.join(" · "));
};
