import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { VoiceoverClip } from "../src/compositions/Short/script";
import { VOICES } from "./voices";

export type TtsEngine = "elevenlabs" | "everai" | "say";

/** Tên hiển thị của từng nguồn giọng — dùng chung cho CLI, API, giao diện. */
export const ENGINE_LABELS: Record<TtsEngine, string> = {
  elevenlabs: "ElevenLabs",
  everai: "EverAI",
  say: "miễn phí",
};

const ENGINE_KEYS: Partial<Record<TtsEngine, string>> = {
  elevenlabs: "ELEVENLABS_API_KEY",
  everai: "EVERAI_API_KEY",
};

/** Tên biến key còn thiếu cho engine này, hoặc null nếu dùng được ngay. */
export const missingEngineKey = (engine: TtsEngine) => {
  const name = ENGINE_KEYS[engine];
  return name && !process.env[name] ? name : null;
};

/** Public dir is where Remotion's staticFile() resolves from. */
const publicDir = () => path.resolve(process.cwd(), "public");

const durationMs = (file: string) => {
  const seconds = execFileSync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf8" },
  ).trim();
  return Math.round(parseFloat(seconds) * 1000);
};

const toMp3 = (input: string, output: string) => {
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", input,
    "-ar", "48000", "-ac", "2",
    "-af", "loudnorm=I=-16:TP=-2:LRA=11",
    output,
  ]);
};

/**
 * Windows không có `say` — dùng SAPI sẵn trong máy qua PowerShell. Tìm giọng theo tên,
 * không có thì lấy giọng đầu tiên cùng ngôn ngữ (giọng Việt cần cài gói giọng nói vi-VN).
 * Chữ và đường dẫn đi qua biến môi trường để khỏi phải escape trong lệnh PowerShell.
 */
const windowsSpeak = (text: string, wav: string, voice: string) => {
  const lang = VOICES.find((v) => v.engine === "say" && v.id === voice)?.lang ?? "vi";
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Speech",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$all = $s.GetInstalledVoices() | Where-Object { $_.Enabled }",
    "$v = $all | Where-Object { $_.VoiceInfo.Name -like \"*$env:TTS_VOICE*\" } | Select-Object -First 1",
    "if (-not $v) { $v = $all | Where-Object { $_.VoiceInfo.Culture.Name -like \"$env:TTS_LANG*\" } | Select-Object -First 1 }",
    "if (-not $v) { throw \"Windows chua co giong doc ngon ngu $env:TTS_LANG. Cai goi giong noi trong Settings > Time & Language > Speech, hoac dung giong ElevenLabs.\" }",
    "$s.SelectVoice($v.VoiceInfo.Name)",
    "$s.SetOutputToWaveFile($env:TTS_OUT)",
    "$s.Speak($env:TTS_TEXT)",
    "$s.Dispose()",
  ].join("\n");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, TTS_TEXT: text, TTS_OUT: wav, TTS_VOICE: voice, TTS_LANG: lang },
  });
};

const sayToFile = (text: string, output: string, voice: string) => {
  if (process.platform === "win32") {
    const wav = `${output}.wav`;
    windowsSpeak(text, wav, voice);
    toMp3(wav, output);
    fs.unlinkSync(wav);
    return;
  }
  const aiff = `${output}.aiff`;
  execFileSync("say", ["-v", voice, "-o", aiff, text]);
  toMp3(aiff, output);
  fs.unlinkSync(aiff);
};

const elevenLabsToFile = async (
  text: string,
  output: string,
  voiceId: string,
  modelId: string,
) => {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 402 && detail.includes("library voices")) {
      throw new Error(
        `Voice ${voiceId} là library voice — gói Free của ElevenLabs không gọi được qua API. ` +
          "Dùng một giọng premade, hoặc nâng cấp gói.",
      );
    }
    throw new Error(`ElevenLabs trả về ${response.status}: ${detail}`);
  }

  const raw = `${output}.raw.mp3`;
  fs.writeFileSync(raw, Buffer.from(await response.arrayBuffer()));
  toMp3(raw, output);
  fs.unlinkSync(raw);
};

const EVERAI_API = "https://www.everai.vn/api/v1/tts";
const EVERAI_POLL_MS = 1000;
const EVERAI_TIMEOUT_MS = 180_000;

type EverAiResponse = {
  status: number;
  error_code?: string | number;
  error_message?: string;
  result?: { request_id: string; status: string; audio_link?: string; audio_expired?: boolean };
};

const everAiCall = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.EVERAI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  let body: EverAiResponse | undefined;
  try {
    body = JSON.parse(text) as EverAiResponse;
  } catch {
    // body lỗi dạng HTML/chữ thường — báo nguyên văn bên dưới.
  }
  if (!response.ok || !body || body.status !== 1 || !body.result) {
    const detail = body?.error_message ?? text.slice(0, 200);
    throw new Error(`EverAI trả về ${response.status}: ${detail}`);
  }
  return body.result;
};

/**
 * EverAI xử lý bất đồng bộ: POST tạo yêu cầu, rồi hỏi lại theo request_id tới khi
 * "done" mới có audio_link. Không dùng callback_url vì server chạy local.
 */
const everAiToFile = async (text: string, output: string, voiceCode: string) => {
  const created = await everAiCall(EVERAI_API, {
    method: "POST",
    body: JSON.stringify({
      response_type: "indirect",
      input_text: text,
      voice_code: voiceCode,
      model_id: process.env.EVERAI_MODEL_ID || "everai-v1.6",
      audio_type: "mp3",
      bitrate: 128,
      speed_rate: 1.0,
      pitch_rate: 1.0,
    }),
  });

  const deadline = Date.now() + EVERAI_TIMEOUT_MS;
  let job = created;
  while (job.status !== "done") {
    if (/fail|error/i.test(job.status)) {
      throw new Error(`EverAI không đọc được câu này (trạng thái ${job.status}).`);
    }
    if (Date.now() > deadline) {
      throw new Error(`EverAI xử lý quá ${EVERAI_TIMEOUT_MS / 1000}s — thử lại sau.`);
    }
    await new Promise((resolve) => setTimeout(resolve, EVERAI_POLL_MS));
    job = await everAiCall(`${EVERAI_API}/${created.request_id}`);
  }
  if (!job.audio_link || job.audio_expired) {
    throw new Error("EverAI báo xong nhưng không có file audio.");
  }

  const audio = await fetch(job.audio_link);
  if (!audio.ok) {
    throw new Error(`Không tải được audio EverAI: ${audio.status}`);
  }
  const raw = `${output}.raw.mp3`;
  fs.writeFileSync(raw, Buffer.from(await audio.arrayBuffer()));
  toMp3(raw, output);
  fs.unlinkSync(raw);
};

/**
 * Pick the account's first voice when ELEVENLABS_VOICE_ID isn't set, and always
 * say out loud which voice was used — an unannounced default is how you end up
 * publishing a video in the wrong voice.
 */
const resolveElevenLabsVoice = async () => {
  const fromEnv = process.env.ELEVENLABS_VOICE_ID;
  if (fromEnv) {
    return fromEnv;
  }

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
  });
  if (!response.ok) {
    throw new Error(`Không lấy được danh sách voice: ${response.status}`);
  }

  const body = (await response.json()) as {
    voices?: { voice_id: string; name: string }[];
  };
  const first = body.voices?.[0];
  if (!first) {
    throw new Error(
      "Tài khoản ElevenLabs không có voice nào. Đặt ELEVENLABS_VOICE_ID.",
    );
  }
  process.stdout.write(
    `     ELEVENLABS_VOICE_ID chưa đặt — dùng "${first.name}" (${first.voice_id})\n`,
  );
  return first.voice_id;
};

export const generateVoiceover = async (
  lines: string[],
  slug: string,
  engine: TtsEngine,
  /** Ghi đè lựa chọn giọng: voice_id của ElevenLabs, hoặc tên giọng của `say`. */
  voiceOverride?: string,
): Promise<VoiceoverClip[]> => {
  const relDir = path.join("voices", slug);
  const absDir = path.join(publicDir(), relDir);
  fs.mkdirSync(absDir, { recursive: true });

  const missing = missingEngineKey(engine);
  if (missing) {
    throw new Error(
      `Thiếu ${missing}. Điền trong Cài đặt, hoặc chạy với --tts say để dùng giọng macOS.`,
    );
  }
  if (engine === "everai" && !voiceOverride) {
    throw new Error("Giọng EverAI cần voice_code — chọn một giọng EverAI trong danh sách.");
  }

  const voiceId =
    engine === "elevenlabs"
      ? (voiceOverride ?? (await resolveElevenLabsVoice()))
      : "";
  // eleven_multilingual_v2 KHÔNG liệt kê tiếng Việt trong /v1/models — nó vẫn phát ra
  // âm nhưng không được huấn luyện cho ngôn ngữ này. eleven_v3 có hỗ trợ chính thức.
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_v3";
  const sayVoice = voiceOverride ?? process.env.SAY_VOICE ?? "Linh";

  const clips: VoiceoverClip[] = [];

  for (let i = 0; i < lines.length; i++) {
    const name = `line-${String(i + 1).padStart(2, "0")}.mp3`;
    const abs = path.join(absDir, name);

    if (engine === "say") {
      sayToFile(lines[i], abs, sayVoice);
    } else if (engine === "everai") {
      await everAiToFile(lines[i], abs, voiceOverride as string);
    } else {
      await elevenLabsToFile(lines[i], abs, voiceId, modelId);
    }

    const ms = durationMs(abs);
    process.stdout.write(`     ${name}  ${(ms / 1000).toFixed(2)}s\n`);
    clips.push({ src: path.join(relDir, name), durationMs: ms });
  }

  return clips;
};
