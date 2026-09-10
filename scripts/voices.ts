import type { TtsEngine } from "./tts";

export type Voice = {
  /** Tên gõ ở CLI: --voice laura */
  key: string;
  engine: TtsEngine;
  /** voice_id của ElevenLabs, hoặc tên giọng của macOS `say`. */
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

  // ---- Tiếng Anh, macOS (miễn phí, offline) ----
  { key: "mac-samantha", engine: "say", id: "Samantha", lang: "en", gender: "nữ", note: "macOS, giọng Mỹ" },
  { key: "mac-daniel", engine: "say", id: "Daniel", lang: "en", gender: "nam", note: "macOS, giọng Anh" },
  { key: "mac-karen", engine: "say", id: "Karen", lang: "en", gender: "nữ", note: "macOS, giọng Úc" },
];

export const findVoice = (key: string) =>
  VOICES.find((voice) => voice.key === key.toLowerCase());

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
      const cost = v.engine === "say" ? "miễn phí" : "ElevenLabs";
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
