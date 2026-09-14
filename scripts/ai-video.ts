/**
 * Sinh video clip bằng AI từ prompt — nhiều nhà cung cấp, chọn model trong Cài đặt.
 *
 * Mọi API đều bất đồng bộ: gửi yêu cầu → hỏi lại định kỳ → tải mp4 về public/.
 * Tham số của từng model lấy từ schema chính thức (Gemini docs, fal OpenAPI,
 * Replicate schema) — model khác nhau nhận tên trường và kiểu giá trị khác nhau
 * (ví dụ Veo trên fal nhận duration "8s", Kling nhận "5"), nên KHÔNG gộp chung.
 *
 * Tiếng AI tạo kèm clip bị tắt khi model cho phép: rẻ hơn, và giọng đọc là chính.
 */
import fs from "fs";
import path from "path";
import { slugify } from "./slug";

export type Provider = "gemini" | "fal" | "replicate";

export const PROVIDERS: Record<Provider, { label: string; env: string }> = {
  gemini: { label: "Google Gemini (Veo)", env: "GEMINI_API_KEY" },
  fal: { label: "fal.ai", env: "FAL_KEY" },
  replicate: { label: "Replicate", env: "REPLICATE_API_TOKEN" },
};

type Ratio = "9:16" | "16:9" | "1:1" | "3:4" | "4:3";

type Request = { prompt: string; ratio: Ratio; seconds: number };

export type VideoModel = {
  /** Khoá lưu trong Cài đặt: "<provider>:<model id>". */
  key: string;
  provider: Provider;
  model: string;
  label: string;
  /** Độ dài clip model nhận (giây). */
  durations: number[];
  ratios: Ratio[];
  /** USD/giây ở 720p theo bảng giá chính thức — chỉ ghi khi đã kiểm tra. */
  usdPerSecond?: number;
  input: (r: Request) => Record<string, unknown>;
};

const veoGemini = (model: string, label: string, usdPerSecond: number): VideoModel => ({
  key: `gemini:${model}`,
  provider: "gemini",
  model,
  label,
  durations: [4, 6, 8],
  ratios: ["9:16", "16:9"],
  usdPerSecond,
  input: (r) => ({
    instances: [{ prompt: r.prompt }],
    parameters: { aspectRatio: r.ratio, durationSeconds: r.seconds, resolution: "720p" },
  }),
});

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Thứ tự = thứ tự ưu tiên khi chọn "Tự động" (rẻ trước). */
export const VIDEO_MODELS: VideoModel[] = [
  veoGemini("veo-3.1-lite-generate-preview", "Veo 3.1 Lite", 0.05),
  veoGemini("veo-3.1-fast-generate-preview", "Veo 3.1 Fast", 0.1),
  veoGemini("veo-3.1-generate-preview", "Veo 3.1", 0.4),

  {
    key: "fal:bytedance/seedance-2.0/fast/text-to-video",
    provider: "fal",
    model: "bytedance/seedance-2.0/fast/text-to-video",
    label: "Seedance 2.0 Fast",
    durations: range(4, 15),
    ratios: ["9:16", "16:9", "1:1", "3:4", "4:3"],
    input: (r) => ({
      prompt: r.prompt, aspect_ratio: r.ratio, duration: String(r.seconds),
      resolution: "720p", generate_audio: false,
    }),
  },
  {
    key: "fal:fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    provider: "fal",
    model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    label: "Kling 2.5 Turbo Pro",
    durations: [5, 10],
    ratios: ["9:16", "16:9", "1:1"],
    input: (r) => ({ prompt: r.prompt, aspect_ratio: r.ratio, duration: String(r.seconds) }),
  },
  {
    key: "fal:fal-ai/kling-video/v3/pro/text-to-video",
    provider: "fal",
    model: "fal-ai/kling-video/v3/pro/text-to-video",
    label: "Kling 3 Pro",
    durations: range(3, 15),
    ratios: ["9:16", "16:9", "1:1"],
    input: (r) => ({
      prompt: r.prompt, aspect_ratio: r.ratio, duration: String(r.seconds), generate_audio: false,
    }),
  },
  {
    key: "fal:fal-ai/wan-25-preview/text-to-video",
    provider: "fal",
    model: "fal-ai/wan-25-preview/text-to-video",
    label: "Wan 2.5",
    durations: [5, 10],
    ratios: ["9:16", "16:9", "1:1"],
    input: (r) => ({
      prompt: r.prompt, aspect_ratio: r.ratio, duration: String(r.seconds), resolution: "720p",
    }),
  },
  {
    key: "fal:fal-ai/veo3.1/fast",
    provider: "fal",
    model: "fal-ai/veo3.1/fast",
    label: "Veo 3.1 Fast",
    durations: [4, 6, 8],
    ratios: ["9:16", "16:9"],
    input: (r) => ({
      prompt: r.prompt, aspect_ratio: r.ratio, duration: `${r.seconds}s`,
      resolution: "720p", generate_audio: false,
    }),
  },

  {
    key: "replicate:google/veo-3.1-lite",
    provider: "replicate",
    model: "google/veo-3.1-lite",
    label: "Veo 3.1 Lite",
    durations: [4, 6, 8],
    ratios: ["9:16", "16:9"],
    input: (r) => ({ prompt: r.prompt, aspect_ratio: r.ratio, duration: r.seconds, resolution: "720p" }),
  },
  {
    key: "replicate:google/veo-3.1-fast",
    provider: "replicate",
    model: "google/veo-3.1-fast",
    label: "Veo 3.1 Fast",
    durations: [4, 6, 8],
    ratios: ["9:16", "16:9"],
    input: (r) => ({
      prompt: r.prompt, aspect_ratio: r.ratio, duration: r.seconds,
      resolution: "720p", generate_audio: false,
    }),
  },
  {
    key: "replicate:bytedance/seedance-2.0-fast",
    provider: "replicate",
    model: "bytedance/seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    durations: [5, 8, 10],
    ratios: ["9:16", "16:9", "1:1", "3:4", "4:3"],
    input: (r) => ({
      prompt: r.prompt, aspect_ratio: r.ratio, duration: r.seconds,
      resolution: "720p", generate_audio: false,
    }),
  },
  {
    key: "replicate:kwaivgi/kling-v3-video",
    provider: "replicate",
    model: "kwaivgi/kling-v3-video",
    label: "Kling 3 (720p)",
    durations: [5, 10],
    ratios: ["9:16", "16:9", "1:1"],
    input: (r) => ({
      prompt: r.prompt, aspect_ratio: r.ratio, duration: r.seconds,
      mode: "standard", generate_audio: false,
    }),
  },
  {
    key: "replicate:wan-video/wan-2.5-t2v-fast",
    provider: "replicate",
    model: "wan-video/wan-2.5-t2v-fast",
    label: "Wan 2.5 Fast",
    durations: [5, 10],
    ratios: ["9:16", "16:9"],
    input: (r) => ({
      prompt: r.prompt, size: r.ratio === "9:16" ? "720*1280" : "1280*720", duration: r.seconds,
    }),
  },
];

const hasKey = (provider: Provider) => Boolean(process.env[PROVIDERS[provider].env]);

/** Danh sách cho UI: model nào dùng được ngay với key hiện có. */
export const videoModelCatalog = () => {
  const models = VIDEO_MODELS.map((m) => ({
    key: m.key,
    label: m.label,
    provider: m.provider,
    providerLabel: PROVIDERS[m.provider].label,
    env: PROVIDERS[m.provider].env,
    durations: m.durations,
    ratios: m.ratios,
    usdPerSecond: m.usdPerSecond ?? null,
    available: hasKey(m.provider),
  }));
  return { models, defaultModel: pickModel()?.key ?? null };
};

/** Model trong Cài đặt nếu có key; "Tự động"/trống → model đầu tiên có key. */
const pickModel = (key?: string) => {
  const wanted = key && key !== "auto" ? key : process.env.AI_VIDEO_MODEL;
  if (wanted && wanted !== "auto") {
    const model = VIDEO_MODELS.find((m) => m.key === wanted);
    if (model && hasKey(model.provider)) return model;
  }
  return VIDEO_MODELS.find((m) => hasKey(m.provider));
};

/** Tỉ lệ model hỗ trợ gần nhất với khung video — phần dư bị cắt khi phủ khung. */
const closestRatio = (ratios: Ratio[], width: number, height: number) => {
  const target = Math.log(width / height);
  const value = (r: Ratio) => {
    const [w, h] = r.split(":").map(Number);
    return Math.abs(Math.log(w / h) - target);
  };
  return [...ratios].sort((a, b) => value(a) - value(b))[0];
};

/** Độ dài ngắn nhất phủ đủ cảnh; không có thì lấy dài nhất — clip ngắn hơn cảnh sẽ lặp lại. */
const fitDuration = (durations: number[], seconds: number) => {
  const sorted = [...durations].sort((a, b) => a - b);
  return sorted.find((d) => d >= seconds) ?? sorted[sorted.length - 1];
};

/** "auto" hoặc key một model trong danh sách. */
export const isVideoModelChoice = (value: string) =>
  value === "auto" || VIDEO_MODELS.some((m) => m.key === value);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const POLL_MS = 5000;
const TIMEOUT_MS = 15 * 60 * 1000;

const failText = async (label: string, response: Response) =>
  new Error(`${label} trả về ${response.status}: ${(await response.text()).slice(0, 300)}`);

type Log = (line: string) => void;

/** Chờ tới khi check() trả giá trị khác undefined, có giới hạn thời gian. */
const poll = async <T>(check: () => Promise<T | undefined>, log: Log, label: string) => {
  const started = Date.now();
  for (;;) {
    const result = await check();
    if (result !== undefined) return result;
    if (Date.now() - started > TIMEOUT_MS) {
      throw new Error(`${label}: quá 15 phút chưa xong — thử lại sau.`);
    }
    log(`${label}: đang tạo… ${Math.round((Date.now() - started) / 1000)}s`);
    await sleep(POLL_MS);
  }
};

/** Trả về URL tải video (và header cần gửi kèm khi tải). */
const runGemini = async (m: VideoModel, r: Request, log: Log) => {
  const key = process.env.GEMINI_API_KEY as string;
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const start = await fetch(`${base}/models/${m.model}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(m.input(r)),
  });
  if (!start.ok) {
    const error = await failText("Gemini", start);
    if (start.status === 429 || /billing|FAILED_PRECONDITION/i.test(error.message)) {
      throw new Error(`${error.message}\nVeo không có gói miễn phí — cần bật thanh toán cho key Gemini.`);
    }
    throw error;
  }
  const { name } = (await start.json()) as { name: string };

  type Operation = {
    done?: boolean;
    error?: { message?: string };
    response?: {
      generateVideoResponse?: {
        generatedSamples?: { video?: { uri?: string } }[];
        raiMediaFilteredReasons?: string[];
      };
    };
  };
  const op = await poll(async () => {
    const res = await fetch(`${base}/${name}`, { headers: { "x-goog-api-key": key } });
    if (!res.ok) throw await failText("Gemini", res);
    const body = (await res.json()) as Operation;
    return body.done ? body : undefined;
  }, log, m.label);

  if (op.error) throw new Error(`Gemini: ${op.error.message ?? "lỗi không rõ"}`);
  const result = op.response?.generateVideoResponse;
  const uri = result?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    const reasons = result?.raiMediaFilteredReasons?.join("; ");
    throw new Error(`Gemini không trả video${reasons ? ` — bị bộ lọc nội dung chặn: ${reasons}` : ""}.`);
  }
  return { url: uri, headers: { "x-goog-api-key": key } };
};

const runFal = async (m: VideoModel, r: Request, log: Log) => {
  const headers = { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" };
  const start = await fetch(`https://queue.fal.run/${m.model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(m.input(r)),
  });
  if (!start.ok) throw await failText("fal.ai", start);
  // Dùng đúng URL fal trả về: model id nhiều tầng thì đường dẫn status khác model id.
  const { status_url, response_url } = (await start.json()) as { status_url: string; response_url: string };

  await poll(async () => {
    const res = await fetch(status_url, { headers });
    if (!res.ok && res.status !== 202) throw await failText("fal.ai", res);
    const body = (await res.json()) as { status?: string; error?: string };
    if (body.error) throw new Error(`fal.ai: ${body.error}`);
    return body.status === "COMPLETED" ? true : undefined;
  }, log, m.label);

  const res = await fetch(response_url, { headers });
  if (!res.ok) throw await failText("fal.ai", res);
  const body = (await res.json()) as { video?: { url?: string } };
  if (!body.video?.url) throw new Error("fal.ai không trả video.");
  return { url: body.video.url, headers: {} };
};

const runReplicate = async (m: VideoModel, r: Request, log: Log) => {
  const headers = {
    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
  const start = await fetch(`https://api.replicate.com/v1/models/${m.model}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ input: m.input(r) }),
  });
  if (!start.ok) throw await failText("Replicate", start);
  const { id } = (await start.json()) as { id: string };

  type Prediction = { status: string; output?: string | string[]; error?: string };
  const done = await poll(async () => {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers });
    if (!res.ok) throw await failText("Replicate", res);
    const body = (await res.json()) as Prediction;
    if (body.status === "failed" || body.status === "canceled") {
      throw new Error(`Replicate: ${body.error ?? body.status}`);
    }
    return body.status === "succeeded" ? body : undefined;
  }, log, m.label);

  const url = Array.isArray(done.output) ? done.output[0] : done.output;
  if (!url) throw new Error("Replicate không trả video.");
  return { url, headers: {} };
};

type Runner = (m: VideoModel, r: Request, log: Log) =>
  Promise<{ url: string; headers: Record<string, string> }>;

const RUNNERS: Record<Provider, Runner> = {
  gemini: runGemini,
  fal: runFal,
  replicate: runReplicate,
};

/**
 * Sinh một clip và lưu vào public/videos/ai/. Trả đường dẫn dùng cho staticFile().
 * width/height: khung video đang làm — chọn tỉ lệ model hỗ trợ gần nhất.
 */
export const generateAiVideo = async (
  options: { prompt: string; model?: string; seconds?: number; width: number; height: number },
  log: Log,
) => {
  const prompt = options.prompt.trim();
  if (!prompt) throw new Error("Thiếu mô tả video.");

  const model = pickModel(options.model);
  if (!model) {
    throw new Error(
      "Chưa có key tạo video. Thêm GEMINI_API_KEY, FAL_KEY hoặc REPLICATE_API_TOKEN trong ⚙ Cài đặt.",
    );
  }
  if (options.model && options.model !== "auto" && options.model !== model.key) {
    log(`Model đã chọn thiếu key — dùng ${model.label} (${PROVIDERS[model.provider].label}).`);
  }

  const request: Request = {
    prompt,
    ratio: closestRatio(model.ratios, options.width, options.height),
    seconds: fitDuration(model.durations, options.seconds ?? 5),
  };
  const cost = model.usdPerSecond ? ` · ước tính $${(model.usdPerSecond * request.seconds).toFixed(2)}` : "";
  log(`${model.label} (${PROVIDERS[model.provider].label}) · ${request.ratio} · ${request.seconds}s${cost}`);

  const { url, headers } = await RUNNERS[model.provider](model, request, log);

  log("Tải video về…");
  const res = await fetch(url, { headers });
  if (!res.ok) throw await failText("Tải video", res);

  const rel = `videos/ai/${Date.now()}-${slugify(prompt, 40)}.mp4`;
  const file = path.join(process.cwd(), "public", rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  log(`Đã lưu ${rel}`);
  return { path: rel, model: model.key, seconds: request.seconds, ratio: request.ratio };
};
