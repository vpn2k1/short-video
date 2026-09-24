import { execFileSync } from "child_process";
import { ENGINE_LABELS, missingEngineKey, type TtsEngine } from "./tts";
import { freeMode } from "./usage";
import { localVoiceAvailable } from "./vieneu-tts";

export type Voice = {
  /** Tên gõ ở CLI: --voice laura */
  key: string;
  engine: TtsEngine;
  /** voice_id của ElevenLabs, tên giọng Gemini (Kore…), tên giọng của macOS `say`, hoặc tên giọng VieNeu có sẵn trong app (Ngọc Huyền…). */
  id: string;
  lang: "vi" | "en";
  gender: "nữ" | "nam" | "khác";
  note: string;
  /** Gói Free của ElevenLabs chặn library voice qua API. */
  paidPlan?: boolean;
};

export const VOICES: Voice[] = [
  // ---- Tiếng Việt ----
  {
    key: "linh",
    engine: "say",
    id: "Linh",
    lang: "vi",
    gender: "nữ",
    note: "giọng Việt bản xứ, miễn phí, offline — mặc định cho nội dung tiếng Việt",
  },
  // VieNeu-TTS v3 Turbo: có sẵn trong app, offline, mọi hệ điều hành (scripts/setup-local.ts). id = tên giọng preset.
  { key: "ngoc-huyen", engine: "local", id: "Ngọc Huyền", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  { key: "truc-ly", engine: "local", id: "Trúc Ly", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  { key: "mai-anh", engine: "local", id: "Mai Anh", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Bắc, tin tức" },
  { key: "thuy-dung", engine: "local", id: "Thùy Dung", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Nam, tin tức" },
  { key: "ngoc-tran", engine: "local", id: "Ngọc Trân", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Trung, tự nhiên" },
  { key: "ngoc-linh", engine: "local", id: "Ngọc Linh", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Bắc, kể chuyện" },
  { key: "doan-trang", engine: "local", id: "Đoan Trang", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  { key: "thuc-doan", engine: "local", id: "Thục Đoan", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Nam, kể chuyện" },
  { key: "my-duyen", engine: "local", id: "Mỹ Duyên", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Nam, đọc truyện" },
  { key: "quynh-anh", engine: "local", id: "Quỳnh Anh", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Bắc, đọc truyện" },
  { key: "kim-thanh", engine: "local", id: "Kim Thanh", lang: "vi", gender: "nữ", note: "có sẵn trong app, miền Nam, đọc truyện" },
  { key: "adam-bua", engine: "local", id: "Adam bựa", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  { key: "anh-khoi", engine: "local", id: "Anh Khôi", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, kể chuyện" },
  { key: "minh-quan-pro", engine: "local", id: "Minh Quân Pro", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  { key: "thien-tam-duc", engine: "local", id: "Thiền Tâm Đức", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, kể chuyện" },
  { key: "quang-son", engine: "local", id: "Quang Sơn", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Trung, tự nhiên" },
  { key: "minh-duc", engine: "local", id: "Minh Đức", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, tin tức" },
  { key: "pham-tuyen", engine: "local", id: "Phạm Tuyên", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  { key: "thai-son", engine: "local", id: "Thái Sơn", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Nam, kể chuyện" },
  { key: "xuan-vinh", engine: "local", id: "Xuân Vĩnh", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  { key: "thanh-binh", engine: "local", id: "Thanh Bình", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, kể chuyện" },
  { key: "minh-triet", engine: "local", id: "Minh Triết", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Nam, tin tức" },
  { key: "duc-tri", engine: "local", id: "Đức Trí", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Nam, đọc truyện" },
  { key: "adam-vi", engine: "local", id: "Adam", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Nam, tự nhiên" },
  { key: "manh-dung", engine: "local", id: "Mạnh Dũng", lang: "vi", gender: "nam", note: "có sẵn trong app, miền Bắc, tự nhiên" },
  {
    key: "giang",
    engine: "elevenlabs",
    id: "CQAD6iKxS73fEAGjSwt5",
    lang: "vi",
    gender: "nữ",
    note: "kể chuyện, trẻ",
    paidPlan: true,
  },
  {
    key: "do-trinh",
    engine: "elevenlabs",
    id: "CxJbDdwqY48MY3gPVYwe",
    lang: "vi",
    gender: "nam",
    note: "kể chuyện, trẻ",
    paidPlan: true,
  },
  // Gemini TTS: dùng key Gemini, có gói miễn phí. Giọng đa ngôn ngữ — đọc tiếng Việt lẫn tiếng Anh.
  { key: "gemini-kore", engine: "gemini", id: "Kore", lang: "vi", gender: "nữ", note: "Gemini, rõ ràng, chắc giọng" },
  { key: "gemini-sulafat", engine: "gemini", id: "Sulafat", lang: "vi", gender: "nữ", note: "Gemini, ấm áp, kể chuyện" },
  { key: "gemini-leda", engine: "gemini", id: "Leda", lang: "vi", gender: "nữ", note: "Gemini, trẻ trung" },
  { key: "gemini-charon", engine: "gemini", id: "Charon", lang: "vi", gender: "nam", note: "Gemini, thuyết minh" },
  { key: "gemini-puck", engine: "gemini", id: "Puck", lang: "vi", gender: "nam", note: "Gemini, sôi nổi" },
  { key: "gemini-orus", engine: "gemini", id: "Orus", lang: "vi", gender: "nam", note: "Gemini, chắc giọng" },

  // ---- Tiếng Anh, ElevenLabs ----
  { key: "laura", engine: "elevenlabs", id: "FGY2WhTYpPnrIDTdsKH5", lang: "en", gender: "nữ", note: "trẻ, social media" },
  { key: "sarah", engine: "elevenlabs", id: "EXAVITQu4vr4xnSDxMaL", lang: "en", gender: "nữ", note: "trẻ, giải trí" },
  { key: "jessica", engine: "elevenlabs", id: "cgSgspJ2msm6clMCkdW9", lang: "en", gender: "nữ", note: "trẻ, hội thoại" },
  { key: "alice", engine: "elevenlabs", id: "Xb7hH8MSUJpSbSDYk0k2", lang: "en", gender: "nữ", note: "giảng giải" },
  { key: "matilda", engine: "elevenlabs", id: "XrExE9yKIg1WjnnlVkGX", lang: "en", gender: "nữ", note: "giảng giải" },
  { key: "bella", engine: "elevenlabs", id: "hpp4J3VqNfWAUOO0d1Us", lang: "en", gender: "nữ", note: "giảng giải" },
  { key: "lily", engine: "elevenlabs", id: "pFZP5JQG7iQjIQuC4Bku", lang: "en", gender: "nữ", note: "giảng giải" },
  { key: "liam", engine: "elevenlabs", id: "TX3LPaxmHKxFdv7VOQHJ", lang: "en", gender: "nam", note: "trẻ, social media" },
  { key: "brian", engine: "elevenlabs", id: "nPczCjzI2devNBz1zQrb", lang: "en", gender: "nam", note: "social media" },
  { key: "roger", engine: "elevenlabs", id: "CwhRBWXzGAHq8TQ4Fs17", lang: "en", gender: "nam", note: "hội thoại" },
  { key: "george", engine: "elevenlabs", id: "JBFqnCBsd6RMkjVDRZzb", lang: "en", gender: "nam", note: "kể chuyện" },
  { key: "charlie", engine: "elevenlabs", id: "IKne3meq5aSn9XLyUdCD", lang: "en", gender: "nam", note: "trẻ, hội thoại" },
  { key: "will", engine: "elevenlabs", id: "bIHbv24MWmeRgasZH58o", lang: "en", gender: "nam", note: "trẻ, hội thoại" },
  { key: "eric", engine: "elevenlabs", id: "cjVigY5qzO86Huf0OWal", lang: "en", gender: "nam", note: "hội thoại" },
  { key: "chris", engine: "elevenlabs", id: "iP95p4xoKVk53GoZ742B", lang: "en", gender: "nam", note: "hội thoại" },
  { key: "daniel", engine: "elevenlabs", id: "onwK4e9ZLuTAKqWW03F9", lang: "en", gender: "nam", note: "giảng giải" },
  { key: "adam", engine: "elevenlabs", id: "pNInz6obpgDQGcFmaJgB", lang: "en", gender: "nam", note: "social media" },
  { key: "bill", engine: "elevenlabs", id: "pqHfZKP75CvOlQylNhV4", lang: "en", gender: "nam", note: "lớn tuổi, quảng cáo" },
  { key: "river", engine: "elevenlabs", id: "SAz9YHcvj6GT2YYXdXww", lang: "en", gender: "khác", note: "hội thoại" },
  { key: "callum", engine: "elevenlabs", id: "N2lVS1w4EtoT3dr4eOWO", lang: "en", gender: "nam", note: "nhân vật hoạt hình" },
  { key: "harry", engine: "elevenlabs", id: "SOYHLrjzK2X1ezoPC6cr", lang: "en", gender: "nam", note: "nhân vật hoạt hình" },

  // ---- Tiếng Anh, Gemini (gói miễn phí) ----
  { key: "gemini-zephyr", engine: "gemini", id: "Zephyr", lang: "en", gender: "nữ", note: "Gemini, tươi sáng" },
  { key: "gemini-fenrir", engine: "gemini", id: "Fenrir", lang: "en", gender: "nam", note: "Gemini, hào hứng" },

  // ---- Tiếng Anh, macOS (miễn phí, offline) ----
  { key: "mac-samantha", engine: "say", id: "Samantha", lang: "en", gender: "nữ", note: "macOS, giọng Mỹ" },
  { key: "mac-daniel", engine: "say", id: "Daniel", lang: "en", gender: "nam", note: "macOS, giọng Anh" },
  { key: "mac-karen", engine: "say", id: "Karen", lang: "en", gender: "nữ", note: "macOS, giọng Úc" },
];

export const findVoice = (key: string) =>
  VOICES.find((voice) => voice.key === key.toLowerCase());

/**
 * Giọng của hệ điều hành đang có trên máy này — macOS: `say -v ?`, Windows: giọng SAPI đã bật. Hỏi một lần rồi nhớ.
 * Không phải máy nào cũng có giọng Linh (macOS phải tải thêm, Windows cần gói giọng vi-VN, Linux không có `say`).
 */
let systemVoiceCache: { names: string[]; langs: string[] } | null = null;
const systemVoices = () => {
  if (systemVoiceCache) return systemVoiceCache;
  const found = { names: [] as string[], langs: [] as string[] };
  try {
    if (process.platform === "darwin") {
      // "Linh                vi_VN    # Xin chào! …" — tên có thể có dấu cách ("Bad News").
      for (const line of execFileSync("say", ["-v", "?"], { encoding: "utf8", timeout: 5000 }).split("\n")) {
        const m = /^(.+?)\s+([a-z]{2,3})_[A-Za-z]{2,4}\s+#/.exec(line);
        if (m) { found.names.push(m[1].trim()); found.langs.push(m[2]); }
      }
    } else if (process.platform === "win32") {
      const script = "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | " +
        "Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo.Name + '|' + $_.VoiceInfo.Culture.Name }";
      const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", timeout: 15000 });
      for (const line of out.split(/\r?\n/)) {
        const [name, culture] = line.split("|");
        if (name && culture) { found.names.push(name.trim()); found.langs.push(culture.trim().slice(0, 2).toLowerCase()); }
      }
    }
  } catch {
    // Không hỏi được thì coi như máy không có giọng hệ thống — Tự động chọn giọng khác.
  }
  systemVoiceCache = found;
  return found;
};

/**
 * Giọng này đọc được ngay trên máy này không: đủ key, đã cài giọng trong app, hoặc hệ điều hành có giọng đó.
 * Windows đọc giọng `say` bằng SAPI — tìm theo tên, không có thì lấy giọng cùng ngôn ngữ (scripts/tts.ts windowsSpeak).
 */
export const voiceUsable = (voice: Voice) => {
  if (voice.paidPlan || missingEngineKey(voice.engine)) return false;
  if (freeMode() && voice.engine === "elevenlabs") return false;
  if (voice.engine === "local") return localVoiceAvailable();
  if (voice.engine === "say") {
    const { names, langs } = systemVoices();
    if (process.platform === "darwin") return names.includes(voice.id);
    if (process.platform === "win32") return names.some((n) => n.includes(voice.id)) || langs.includes(voice.lang);
    return false;
  }
  return true;
};

/** Giá trị "Tự động" của ô Giọng: server chọn giọng tốt nhất máy này đang có, theo ngôn ngữ video. */
export const AUTO_VOICE = "auto";

/**
 * Thứ tự ưu tiên khi chọn tự động: giọng trong app (offline, tự nhiên) → Gemini (gói miễn phí) → ElevenLabs (tính theo
 * ký tự) → giọng hệ điều hành (máy móc hơn, nhưng máy nào cũng thử được).
 */
const ENGINE_ORDER: Record<string, number> = { local: 0, gemini: 1, elevenlabs: 2, say: 3 };

/** Giọng tự động cho một ngôn ngữ trên máy này; undefined = máy chưa có giọng nào đọc được ngôn ngữ đó. */
export const voiceForLanguage = (lang: string) =>
  VOICES
    .filter((v) => v.lang === lang && voiceUsable(v))
    .sort((a, b) => (ENGINE_ORDER[a.engine] ?? 9) - (ENGINE_ORDER[b.engine] ?? 9))[0]?.key;

export const vietnameseOnly = (voice: Voice) => voice.lang === "vi" && (voice.engine === "local" || voice.engine === "say");

/** voice_id của ElevenLabs là 20 ký tự chữ-số. */
export const isElevenLabsVoiceId = (value: string) =>
  /^[A-Za-z0-9]{20}$/.test(value);

/** Đọc danh sách giọng THẬT trong tài khoản — không bao giờ lệch với catalog tĩnh. */
export const fetchAccountVoices = async (apiKey: string) => {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });
  if (!response.ok) {
    throw new Error(
      `Không lấy được danh sách giọng: ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as {
    voices?: {
      voice_id: string;
      name: string;
      category?: string;
      labels?: Record<string, string>;
    }[];
  };

  return (body.voices ?? []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name.split(" - ")[0],
    category: voice.category ?? "?",
    lang: voice.labels?.language ?? "?",
    gender: voice.labels?.gender ?? "?",
    useCase: voice.labels?.use_case ?? "",
    // Gói Free chặn library voice qua API; premade thì luôn gọi được.
    paidPlan: (voice.category ?? "") !== "premade",
  }));
};

export const formatVoiceList = () => {
  const lines: string[] = [];
  for (const lang of ["vi", "en"] as const) {
    lines.push(
      lang === "vi" ? "\n=== Tiếng Việt ===" : "\n=== Tiếng Anh ===",
    );
    for (const v of VOICES.filter((voice) => voice.lang === lang)) {
      const cost = ENGINE_LABELS[v.engine];
      const warn = v.paidPlan ? "  [cần gói trả phí]" : "";
      lines.push(
        `  ${v.key.padEnd(14)} ${v.gender.padEnd(5)} ${cost.padEnd(11)} ${v.note}${warn}`,
      );
    }
  }
  lines.push(
    "\nDùng:  --voice <tên>     ví dụ: --voice linh, --voice laura",
  );
  return lines.join("\n");
};

/**
 * Giọng thật sẽ dùng cho một video: "" = không giọng; "auto" = giọng tự động theo ngôn ngữ; giọng cụ thể mà máy này
 * không đọc được (không có giọng Linh, thiếu key, chưa cài giọng trong app) hoặc chỉ đọc tiếng Việt trong video tiếng
 * Anh thì cũng lùi về giọng tự động. `note` = câu báo cho người dùng khi phải đổi hoặc không có giọng nào.
 */
export const resolveVoice = (key: string, language: "vi" | "en" = "vi"): { voice?: Voice; note?: string } => {
  if (!key) return {};
  const chosen = key === AUTO_VOICE ? undefined : findVoice(key);
  if (chosen && voiceUsable(chosen) && !(language === "en" && vietnameseOnly(chosen))) return { voice: chosen };
  const auto = findVoice(voiceForLanguage(language) ?? "");
  const why = !chosen ? ""
    : language === "en" && vietnameseOnly(chosen) ? `Giọng ${chosen.key} chỉ đọc tiếng Việt`
      : `Máy này không dùng được giọng ${chosen.key}`;
  if (!auto) {
    return {
      note: `🔇 ${why ? `${why} và máy` : "Máy"} chưa có giọng đọc ${language === "en" ? "tiếng Anh" : "tiếng Việt"} nào — ` +
        "video không có tiếng. Thêm key Gemini (miễn phí) trong ⚙ Cài đặt, hoặc cài giọng có sẵn trong app (npm run setup).",
    };
  }
  return { voice: auto, note: why ? `🎙 ${why} — dùng giọng ${auto.key}.` : undefined };
};
