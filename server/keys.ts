/**
 * API key và lựa chọn AI do người dùng điền trong ô Cài đặt — KHÔNG đọc từ .env.
 *
 * Lưu ở data/api-keys.json (gitignore, quyền 600). Lúc khởi động nạp vào
 * process.env và xoá biến cùng tên lỡ nạp từ .env, để chỉ một nguồn có hiệu lực.
 * Mọi chỗ trong code đọc process.env lúc gọi, nên lưu xong dùng được ngay.
 *
 * Không bao giờ trả giá trị key bí mật về trình duyệt — chỉ "đã có" và 4 ký tự cuối.
 */
import fs from "fs";
import path from "path";
import {
  COMPAT_PROVIDERS,
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OPENAI_MODEL,
} from "../scripts/generate-script";
import { PROVIDERS, VIDEO_MODELS } from "../scripts/ai-video";
import { DEFAULT_TRANSLATE_OLLAMA_MODEL } from "../scripts/translate";
import { WATERMARK_MAX_LENGTH } from "../scripts/watermark";

type Field = {
  name: string;
  label: string;
  help: string;
  group: string;
  type: "secret" | "text" | "select";
  url?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Chữ tự do (có dấu cách, tiếng Việt) — không kiểm tra kiểu key/model. */
  freeText?: boolean;
  maxLength?: number;
  /** Chỉ hiện ô này khi ô `name` đang chọn `value`. */
  showIf?: { name: string; value: string };
};

const WATERMARK_ON = { name: "WATERMARK_ENABLED", value: "on" };

export const KEY_FIELDS: Field[] = [
  {
    name: "SCRIPT_PROVIDER",
    label: "AI viết kịch bản",
    help: "Chỉ cần MỘT key. Tự động: Claude → ChatGPT → Gemini → Groq → OpenRouter → Ollama, lấy cái đầu tiên có key. Gemini, Groq, OpenRouter có gói miễn phí. Ollama chạy ngay trên máy: không key, không cần mạng.",
    group: "Viết kịch bản",
    type: "select",
    options: [
      { value: "auto", label: "Tự động" },
      { value: "anthropic", label: "Claude (Anthropic)" },
      { value: "openai", label: "ChatGPT (OpenAI)" },
      { value: "gemini", label: "Gemini (Google) — miễn phí" },
      { value: "groq", label: "Groq — miễn phí" },
      { value: "openrouter", label: "OpenRouter — model miễn phí" },
      { value: "ollama", label: "Ollama — chạy trên máy, không cần mạng" },
    ],
  },
  {
    name: "OLLAMA_MODEL",
    label: "Model Ollama (trên máy)",
    help: `Cài Ollama (ollama.com/download — có bản Windows, macOS, Linux), mở Terminal hoặc PowerShell chạy "ollama pull ${DEFAULT_OLLAMA_MODEL}". Điền tên model là bật Ollama; bỏ trống mà chọn Ollama ở trên thì dùng ${DEFAULT_OLLAMA_MODEL}. Mặc định nhẹ (~1 GB, máy 8 GB RAM chạy được). Máy khoẻ hơn điền qwen2.5:3b (~1,9 GB) để viết tiếng Việt tốt hơn.`,
    group: "Viết kịch bản",
    type: "text",
    url: "https://ollama.com/download",
    placeholder: DEFAULT_OLLAMA_MODEL,
  },
  {
    name: "OLLAMA_HOST",
    label: "Địa chỉ Ollama",
    help: `Bỏ trống để dùng ${DEFAULT_OLLAMA_HOST} (Ollama trên chính máy này).`,
    group: "Viết kịch bản",
    type: "text",
    placeholder: DEFAULT_OLLAMA_HOST,
  },
  {
    name: "TRANSLATE_OLLAMA_MODEL",
    label: "Model dịch trên máy (Ollama)",
    help: `Dùng khi chọn Ollama ở mục "Dịch phụ đề sang" lúc tạo phụ đề. Bỏ trống để dùng ${DEFAULT_TRANSLATE_OLLAMA_MODEL} (~3,3 GB, máy 8 GB RAM chạy được). Máy 16 GB RAM trở lên: translategemma:12b (~8,1 GB) dịch tốt hơn. Tải bằng lệnh "ollama pull <tên model>". Dịch trên mạng không cần ô này — dùng lại key Gemini, Groq, OpenRouter, ChatGPT hoặc Claude đã điền.`,
    group: "Dịch phụ đề",
    type: "text",
    url: "https://ollama.com/library/translategemma",
    placeholder: DEFAULT_TRANSLATE_OLLAMA_MODEL,
  },
  {
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic (Claude)",
    help: "Viết và sửa kịch bản bằng Claude.",
    group: "Viết kịch bản",
    type: "secret",
    url: "https://console.anthropic.com/settings/keys",
  },
  {
    name: "OPENAI_API_KEY",
    label: "OpenAI (ChatGPT)",
    help: "Viết và sửa kịch bản bằng ChatGPT — dùng thay cho Claude.",
    group: "Viết kịch bản",
    type: "secret",
    url: "https://platform.openai.com/api-keys",
  },
  {
    name: "OPENAI_MODEL",
    label: "Model ChatGPT",
    help: `Bỏ trống để dùng ${DEFAULT_OPENAI_MODEL}. Model phải hỗ trợ structured output.`,
    group: "Viết kịch bản",
    type: "text",
    placeholder: DEFAULT_OPENAI_MODEL,
  },
  {
    name: "GEMINI_SCRIPT_MODEL",
    label: "Model Gemini (miễn phí)",
    help: `Dùng key Google Gemini ở mục "Giọng đọc & hình ảnh" bên dưới. Bỏ trống để dùng ${COMPAT_PROVIDERS.gemini.defaultModel} — bản Flash mới nhất, có gói miễn phí.`,
    group: "Viết kịch bản",
    type: "text",
    placeholder: COMPAT_PROVIDERS.gemini.defaultModel,
  },
  {
    name: "GROQ_API_KEY",
    label: "Groq (miễn phí)",
    help: "Gói miễn phí không cần thẻ, giới hạn theo phút/ngày. Viết nhanh.",
    group: "Viết kịch bản",
    type: "secret",
    url: "https://console.groq.com/keys",
  },
  {
    name: "GROQ_MODEL",
    label: "Model Groq",
    help: `Bỏ trống để dùng ${COMPAT_PROVIDERS.groq.defaultModel}. Model phải hỗ trợ structured output.`,
    group: "Viết kịch bản",
    type: "text",
    placeholder: COMPAT_PROVIDERS.groq.defaultModel,
  },
  {
    name: "OPENROUTER_API_KEY",
    label: "OpenRouter (model miễn phí)",
    help: "Một key dùng nhiều model; model miễn phí giới hạn khoảng 200 lượt/ngày.",
    group: "Viết kịch bản",
    type: "secret",
    url: "https://openrouter.ai/settings/keys",
  },
  {
    name: "OPENROUTER_MODEL",
    label: "Model OpenRouter",
    help: `Bỏ trống để dùng ${COMPAT_PROVIDERS.openrouter.defaultModel} (tự chọn một model miễn phí). Muốn cố định thì điền id có đuôi ":free".`,
    group: "Viết kịch bản",
    type: "text",
    placeholder: COMPAT_PROVIDERS.openrouter.defaultModel,
  },
  {
    name: "ELEVENLABS_API_KEY",
    label: "ElevenLabs",
    help: "Tuỳ chọn — giọng đọc AI. Không có thì dùng giọng miễn phí có sẵn trong máy (macOS: giọng Linh; Windows: giọng nói của Windows, cần cài gói tiếng Việt).",
    group: "Giọng đọc & hình ảnh",
    type: "secret",
    url: "https://elevenlabs.io/app/settings/api-keys",
  },
  {
    name: "EVERAI_API_KEY",
    label: "EverAI",
    help: "Tuỳ chọn — giọng đọc AI tiếng Việt bản xứ (Kiều Nhi, Thuỳ Trang, Lê Hoàng). Tính theo credit/ký tự.",
    group: "Giọng đọc & hình ảnh",
    type: "secret",
    url: "https://everai.vn/api",
  },
  {
    name: "EVERAI_MODEL_ID",
    label: "Model EverAI",
    help: "Bỏ trống để dùng everai-v1.6. Khác: everai-v1.5, everai-v1.5-turbo, everai-v1.",
    group: "Giọng đọc & hình ảnh",
    type: "text",
    placeholder: "everai-v1.6",
  },
  {
    name: "PEXELS_API_KEY",
    label: "Pexels",
    help: "Tuỳ chọn — tìm ảnh stock miễn phí.",
    group: "Giọng đọc & hình ảnh",
    type: "secret",
    url: "https://www.pexels.com/api/",
  },
  {
    name: "GEMINI_API_KEY",
    label: "Google Gemini",
    help: "Tuỳ chọn — viết kịch bản miễn phí (Gemini Flash). Sinh ảnh AI và video Veo KHÔNG có gói miễn phí (giới hạn free = 0) — cần bật thanh toán cho dự án Google của key.",
    group: "Giọng đọc & hình ảnh",
    type: "secret",
    url: "https://aistudio.google.com/apikey",
  },
  {
    name: "AI_VIDEO_MODEL",
    label: "Model tạo video",
    help: "Model mặc định khi bấm ✨ AI trong trình chỉnh sửa. Tự động: model rẻ nhất có key. Chọn model thiếu key thì tự dùng model khác.",
    group: "Tạo video bằng AI",
    type: "select",
    options: [
      { value: "auto", label: "Tự động" },
      ...VIDEO_MODELS.map((m) => ({
        value: m.key,
        label: `${m.label} — ${PROVIDERS[m.provider].label}${m.usdPerSecond ? ` · ~$${m.usdPerSecond}/giây` : ""}`,
      })),
    ],
  },
  {
    name: "FAL_KEY",
    label: "fal.ai",
    help: "Một key dùng Seedance, Kling, Wan, Veo. Tài khoản mới thường được tặng credit dùng thử.",
    group: "Tạo video bằng AI",
    type: "secret",
    url: "https://fal.ai/dashboard/keys",
  },
  {
    name: "REPLICATE_API_TOKEN",
    label: "Replicate",
    help: "Một token dùng Veo, Seedance, Kling, Wan. Trả trước theo lượt chạy.",
    group: "Tạo video bằng AI",
    type: "secret",
    url: "https://replicate.com/account/api-tokens",
  },
  {
    name: "WATERMARK_ENABLED",
    label: "Watermark",
    help: "Bật để in chữ watermark lên mọi video và ảnh khi xuất — kể cả video làm từ trước. Trình chỉnh sửa xem trước được.",
    group: "Watermark",
    type: "select",
    options: [
      { value: "off", label: "Tắt" },
      { value: "on", label: "Bật" },
    ],
  },
  {
    name: "WATERMARK_TEXT",
    label: "Chữ watermark",
    help: `Tên kênh, @handle hoặc website — tối đa ${WATERMARK_MAX_LENGTH} ký tự.`,
    group: "Watermark",
    type: "text",
    placeholder: "@kenhcuaban",
    freeText: true,
    maxLength: WATERMARK_MAX_LENGTH,
    showIf: WATERMARK_ON,
  },
  {
    name: "WATERMARK_POSITION",
    label: "Vị trí watermark",
    help: "Video dọc: góc dưới dễ bị nút like/share và mô tả của TikTok/Reels che.",
    group: "Watermark",
    type: "select",
    options: [
      { value: "top-right", label: "Góc trên phải" },
      { value: "top-left", label: "Góc trên trái" },
      { value: "bottom-right", label: "Góc dưới phải" },
      { value: "bottom-left", label: "Góc dưới trái" },
    ],
    showIf: WATERMARK_ON,
  },
];

const NAMES = KEY_FIELDS.map((f) => f.name);
const fieldOf = (name: string) => KEY_FIELDS.find((f) => f.name === name);
const storePath = () => path.join(process.cwd(), "data", "api-keys.json");

const readStore = (): Record<string, string> => {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), "utf8"));
    return Object.fromEntries(
      Object.entries(raw).filter(([k, v]) => NAMES.includes(k) && typeof v === "string" && v),
    ) as Record<string, string>;
  } catch {
    return {};
  }
};

const writeStore = (store: Record<string, string>) => {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), { mode: 0o600 });
  // `mode` chỉ áp khi tạo file mới — file có sẵn thì phải chmod riêng.
  fs.chmodSync(storePath(), 0o600);
};

const applyStore = (store: Record<string, string>) => {
  for (const name of NAMES) {
    if (store[name]) process.env[name] = store[name];
    else delete process.env[name];
  }
};

/** Gọi một lần lúc khởi động, SAU khi đã nạp .env (cho các cài đặt không phải key). */
export const loadKeys = () => {
  if (!fs.existsSync(storePath())) {
    // Lần đầu chạy: chuyển key đang có trong .env sang, để người dùng không phải
    // dán lại. Từ đây về sau .env không còn được đọc cho các mục này.
    const migrated = Object.fromEntries(
      NAMES.filter((n) => process.env[n]).map((n) => [n, process.env[n] as string]),
    );
    writeStore(migrated);
  }
  applyStore(readStore());
};

const mask = (value: string) =>
  value.length >= 12 ? `••••${value.slice(-4)}` : "••••";

export const keyStatus = () => ({
  keys: KEY_FIELDS.map((field) => {
    const value = process.env[field.name] ?? "";
    return field.type === "secret"
      ? { ...field, set: value.length > 0, preview: value ? mask(value) : "" }
      : { ...field, set: value.length > 0, value };
  }),
});

/**
 * patch: tên → giá trị mới; null = xoá.
 * Key bí mật: chuỗi rỗng bị bỏ qua (giữ key cũ). Ô thường/ô chọn: chuỗi rỗng = xoá.
 */
export const saveKeys = (patch: unknown) => {
  if (!patch || typeof patch !== "object") {
    throw new Error("Dữ liệu không hợp lệ");
  }

  const store = readStore();
  for (const [name, raw] of Object.entries(patch)) {
    const field = fieldOf(name);
    if (!field) {
      throw new Error(`Không nhận mục lạ: ${name}`);
    }
    if (raw === null) {
      delete store[name];
      continue;
    }
    if (typeof raw !== "string") {
      throw new Error(`${name} phải là chuỗi`);
    }
    const value = raw.trim();
    if (!value) {
      if (field.type !== "secret") delete store[name];
      continue;
    }
    if (field.type === "select" && !field.options?.some((o) => o.value === value)) {
      throw new Error(`${field.label}: lựa chọn không hợp lệ`);
    }
    if (field.freeText) {
      if (/[\u0000-\u001f\u007f]/.test(value)) {
        throw new Error(`${field.label} không được xuống dòng hay chứa ký tự điều khiển.`);
      }
      if (field.maxLength && value.length > field.maxLength) {
        throw new Error(`${field.label} dài quá ${field.maxLength} ký tự.`);
      }
    } else if (!/^[\x21-\x7e]+$/.test(value)) {
      // Key/model thật chỉ gồm ký tự in được, không khoảng trắng — dán nhầm thì báo sớm.
      throw new Error(`${field.label} chứa ký tự không hợp lệ — dán lại cho đúng.`);
    }
    store[name] = value;
  }

  if (store.WATERMARK_ENABLED === "on" && !store.WATERMARK_TEXT) {
    throw new Error("Đã bật watermark — nhập chữ watermark, hoặc chọn Tắt.");
  }

  writeStore(store);
  applyStore(store);
  return keyStatus();
};
