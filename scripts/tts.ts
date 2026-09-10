import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { VoiceoverClip } from "../src/compositions/Short/script";

export type TtsEngine = "elevenlabs" | "say";

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

const sayToFile = (text: string, output: string, voice: string) => {
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

  if (engine === "elevenlabs" && !process.env.ELEVENLABS_API_KEY) {
    throw new Error(
      "Thiếu ELEVENLABS_API_KEY. Đặt biến môi trường, hoặc chạy với --tts say để dùng giọng macOS.",
    );
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
    } else {
      await elevenLabsToFile(lines[i], abs, voiceId, modelId);
    }

    const ms = durationMs(abs);
    process.stdout.write(`     ${name}  ${(ms / 1000).toFixed(2)}s\n`);
    clips.push({ src: path.join(relDir, name), durationMs: ms });
  }

  return clips;
};
