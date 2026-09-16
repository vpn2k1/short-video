/**
 * AI có sẵn trong app — chạy trên máy, không cần key, không cần mạng, không phải cài gì thêm.
 *
 * Bộ cài kèm sẵn llama-server (llama.cpp) và một model GGUF nhỏ (desktop/fetch-local-ai.sh):
 *   vendor/llama/<mac-arm64|win-x64|linux-x64>/llama-server[.exe]
 *   vendor/models/qwen2.5-1.5b-instruct-q4_k_m.gguf
 * App đóng gói truyền LOCAL_AI_DIR trỏ vào thư mục vendor trong app (không chép sang workspace
 * vì model nặng ~1 GB); chạy từ mã nguồn thì dùng ./vendor.
 *
 * llama-server chỉ được bật khi có việc, trên một cổng trống của 127.0.0.1, và tự tắt sau vài phút
 * rảnh để trả ~1,5 GB RAM cho lúc render video. Server Node thoát thì tắt theo.
 */
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";

export const LOCAL_AI_LABEL = "AI có sẵn trong app";
export const LOCAL_MODEL_FILE = "qwen2.5-1.5b-instruct-q4_k_m.gguf";
export const LOCAL_MODEL_NAME = "Qwen2.5 1.5B";

/** Ngữ cảnh đủ cho prompt sửa kịch bản (luật + hướng dẫn phong cách + kịch bản JSON). */
const CONTEXT = 16_384;
/** Máy yếu (Windows không GPU) nạp model 1 GB từ ổ cứng chậm có thể mất cả phút. */
const START_TIMEOUT_MS = 3 * 60_000;
const IDLE_MS = 5 * 60_000;
export const LOCAL_TIMEOUT_MS = 10 * 60_000;

const PLATFORM_DIR = `${process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux"}-${process.arch}`;

const vendorDir = () => process.env.LOCAL_AI_DIR || path.join(process.cwd(), "vendor");
const binaryPath = () =>
  path.join(vendorDir(), "llama", PLATFORM_DIR, process.platform === "win32" ? "llama-server.exe" : "llama-server");
const modelPath = () => path.join(vendorDir(), "models", LOCAL_MODEL_FILE);

/** Bản cài có kèm đủ runtime và model cho máy này. */
export const localAiAvailable = () => fs.existsSync(binaryPath()) && fs.existsSync(modelPath());

/** llama-server không bật được (thiếu file, thiếu RAM, nạp model quá lâu) — khác với lỗi khi model đang trả lời. */
export class LocalAiStartError extends Error {}

type Running = { child: ChildProcess; url: string; ready: Promise<void> };
let running: Running | null = null;
/** Đang bật — hai yêu cầu tới cùng lúc dùng chung một lần bật, không sinh hai llama-server. */
let launching: Promise<Running> | null = null;
let busy = 0;
let idleTimer: NodeJS.Timeout | null = null;
let exitHooked = false;

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });

export const stopLocalAi = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  // SIGKILL: SIGTERM làm llama-server chờ các kết nối HTTP keep-alive đóng hết mới thoát, có khi vài phút.
  // Model chỉ đọc, không có gì cần lưu.
  running?.child.kill("SIGKILL");
  running = null;
};

/** Tắt llama-server cùng server Node — không để model chiếm RAM sau khi đóng app. */
const hookExit = () => {
  if (exitHooked) return;
  exitHooked = true;
  process.on("exit", stopLocalAi);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      stopLocalAi();
      process.exit(0);
    });
  }
};

const start = async (): Promise<Running> => {
  if (!localAiAvailable()) {
    throw new LocalAiStartError(`Bản cài này không kèm ${LOCAL_AI_LABEL} (thiếu ${fs.existsSync(binaryPath()) ? modelPath() : binaryPath()}).`);
  }
  hookExit();
  const port = await freePort();
  const bin = binaryPath();
  const child = spawn(
    bin,
    [
      "--model", modelPath(),
      "--host", "127.0.0.1",
      "--port", String(port),
      "--ctx-size", String(CONTEXT),
      "--parallel", "1",
      "--no-webui",
    ],
    {
      cwd: path.dirname(bin),
      // Linux: thư viện .so nằm cạnh file chạy.
      env: process.platform === "linux"
        ? { ...process.env, LD_LIBRARY_PATH: [path.dirname(bin), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") }
        : process.env,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );

  // Giữ mấy dòng log cuối để báo lỗi có nghĩa khi llama-server không chạy được.
  let tail: string[] = [];
  child.stderr?.on("data", (chunk: Buffer) => {
    tail = [...tail, ...chunk.toString().split("\n").filter((l) => l.trim())].slice(-12);
  });

  const url = `http://127.0.0.1:${port}`;
  const self: Running = {
    child,
    url,
    ready: new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new LocalAiStartError(`${message}${tail.length ? `\n${tail.join("\n")}` : ""}`));
      };
      child.on("error", (error) => fail(`Không chạy được ${LOCAL_AI_LABEL}: ${error.message}`));
      child.on("exit", (code) => {
        if (running === self) running = null;
        fail(`${LOCAL_AI_LABEL} dừng khi đang khởi động (mã ${code}).`);
      });
      const started = Date.now();
      const poll = async () => {
        if (settled) return;
        try {
          // /health trả 503 trong lúc nạp model, 200 khi sẵn sàng.
          const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
          if (response.ok) {
            settled = true;
            return resolve();
          }
        } catch {
          // chưa mở cổng
        }
        if (Date.now() - started > START_TIMEOUT_MS) {
          return fail(`${LOCAL_AI_LABEL} nạp model quá ${START_TIMEOUT_MS / 60_000} phút.`);
        }
        setTimeout(poll, 400);
      };
      poll();
    }),
  };
  return self;
};

/** Bật llama-server nếu chưa chạy; giữ nó sống trong lúc có việc. */
const acquire = async () => {
  busy++;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  try {
    if (!running) {
      launching ??= start().finally(() => { launching = null; });
      running = await launching;
    }
    const current = running;
    await current.ready;
    return current.url;
  } catch (error) {
    release();
    throw error;
  }
};

const release = () => {
  busy = Math.max(0, busy - 1);
  if (busy > 0 || !running) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(stopLocalAi, IDLE_MS);
  idleTimer.unref();
};

export type LocalChat = {
  system: string;
  user: string;
  /** JSON Schema — llama.cpp đổi thành grammar, model buộc phải trả đúng cấu trúc. */
  schema?: unknown;
  /** Không có schema mà vẫn cần một object JSON. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
};

/**
 * Hỏi model trên máy qua API chat completions kiểu OpenAI của llama-server.
 * `truncated` = model viết chạm trần token (thường là model nhỏ đang lặp lại).
 */
export const localChat = async (ask: LocalChat): Promise<{ text: string; truncated: boolean }> => {
  const url = await acquire();
  try {
    let response: Response;
    try {
      response = await fetch(`${url}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(LOCAL_TIMEOUT_MS),
        body: JSON.stringify({
          // Stream để header về ngay — không stream mà sinh lâu quá 5 phút thì fetch của Node tự cắt.
          stream: true,
          temperature: ask.temperature ?? 0.4,
          max_tokens: ask.maxTokens ?? 4096,
          messages: [
            { role: "system", content: ask.system },
            { role: "user", content: ask.user },
          ],
          ...(ask.schema
            ? { response_format: { type: "json_schema", json_schema: { name: "output", schema: ask.schema } } }
            : ask.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (error) {
      throw timeoutOr(error);
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      let message = detail;
      try {
        message = (JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? detail;
      } catch {
        // không phải JSON — giữ nguyên text
      }
      throw new Error(`${LOCAL_AI_LABEL} báo lỗi ${response.status}: ${message}`);
    }

    // Server-sent events: mỗi dòng "data: {choices:[{delta:{content}, finish_reason}]}", kết thúc "data: [DONE]".
    let text = "";
    let finish: string | null = null;
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
          const data = line.trim().replace(/^data:\s*/, "");
          if (!line.trim().startsWith("data:") || !data || data === "[DONE]") continue;
          const chunk = JSON.parse(data) as {
            choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
            error?: { message?: string };
          };
          if (chunk.error) throw new Error(`${LOCAL_AI_LABEL} báo lỗi: ${chunk.error.message}`);
          text += chunk.choices?.[0]?.delta?.content ?? "";
          finish = chunk.choices?.[0]?.finish_reason ?? finish;
        }
        if (done) break;
      }
    } catch (error) {
      throw timeoutOr(error);
    }
    return { text, truncated: finish === "length" };
  } finally {
    release();
  }
};

const timeoutOr = (error: unknown) =>
  error instanceof Error && error.name === "TimeoutError"
    ? new Error(`${LOCAL_AI_LABEL} chạy quá ${LOCAL_TIMEOUT_MS / 60_000} phút — thử lại với yêu cầu ngắn hơn.`)
    : error instanceof Error ? error : new Error(String(error));
