import { execFileSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type { VoiceoverClip } from "../src/compositions/Short/script";
import { geminiTtsToWavs } from "./gemini-tts";
import { LOCAL_DEFAULT_VOICE, LOCAL_VOICE_MODEL, localTtsToWavs, localVoiceAvailable } from "./vieneu-tts";
import { VOICES } from "./voices";
import { describeProviderError, ProviderError, shouldFallBack } from "./provider-error";

export type TtsEngine = "elevenlabs" | "gemini" | "say" | "local";

/** Tên hiển thị của từng nguồn giọng — dùng chung cho CLI, API, giao diện. */
export const ENGINE_LABELS: Record<TtsEngine, string> = {
  elevenlabs: "ElevenLabs",
  gemini: "Gemini",
  say: "miễn phí",
  local: "có sẵn trong app",
};

const ENGINE_KEYS: Partial<Record<TtsEngine, string>> = {
  elevenlabs: "ELEVENLABS_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/** Tên biến key còn thiếu cho engine này, hoặc null nếu dùng được ngay. */
export const missingEngineKey = (engine: TtsEngine) => {
  const name = ENGINE_KEYS[engine];
  return name && !process.env[name] ? name : null;
};

/** Public dir is where Remotion's staticFile() resolves from. */
const publicDir = () => path.resolve(process.cwd(), "public");

/** Bộ nhớ câu đã đọc: public/voices/.cache/<hash>.mp3 — thư mục bắt đầu bằng dấu chấm nên thư viện không hiện. */
const CACHE_MAX_FILES = 3000;
const cacheDir = () => path.join(publicDir(), "voices", ".cache");
const cachePath = (engine: TtsEngine, voiceTag: string, text: string) =>
  path.join(cacheDir(), `${createHash("sha1").update([engine, voiceTag, text.replace(/\s+/g, " ").trim()].join("\u0000")).digest("hex")}.mp3`);

const rememberClip = (file: string, target: string) => {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.copyFileSync(file, target, fs.constants.COPYFILE_FICLONE);
    const entries = fs.readdirSync(cacheDir());
    if (entries.length > CACHE_MAX_FILES) {
      // Quá nhiều thì bỏ bớt những câu lâu không dùng nhất.
      entries
        .map((name) => ({ name, at: fs.statSync(path.join(cacheDir(), name)).mtimeMs }))
        .sort((a, b) => a.at - b.at)
        .slice(0, entries.length - CACHE_MAX_FILES)
        .forEach(({ name }) => fs.rmSync(path.join(cacheDir(), name), { force: true }));
    }
  } catch {
    // bộ nhớ đệm hỏng thì lần sau đọc lại, không ảnh hưởng video đang làm
  }
};

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
    throw new Error(describeProviderError("ElevenLabs", response.status, detail, "hoặc chọn giọng miễn phí có sẵn trong máy"));
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

export type VoiceoverOptions = {
  log?: (line: string) => void;
  /** Giọng đã chọn hết lượt/lỗi hạn mức nên đọc bằng giọng miễn phí khác — câu báo cho người dùng. */
  onFallback?: (note: string) => void;
};

/**
 * Giọng miễn phí thay thế khi giọng trên mạng hết lượt: giọng có sẵn trong app (VieNeu, tiếng Việt)
 * → giọng của hệ điều hành. null = không có gì thay được.
 */
const fallbackVoice = (lang: "vi" | "en"): { engine: TtsEngine; id: string; label: string } | null => {
  if (lang === "vi" && localVoiceAvailable()) return { engine: "local", id: LOCAL_DEFAULT_VOICE, label: `giọng ${LOCAL_DEFAULT_VOICE} có sẵn trong app` };
  if (process.platform === "darwin") return lang === "vi"
    ? { engine: "say", id: "Linh", label: "giọng Linh của macOS" }
    : { engine: "say", id: "Samantha", label: "giọng Samantha của macOS" };
  if (process.platform === "win32") return { engine: "say", id: "", label: "giọng đọc của Windows" };
  return null;
};

export const generateVoiceover = async (
  lines: string[],
  slug: string,
  engine: TtsEngine,
  /** Ghi đè lựa chọn giọng: voice_id của ElevenLabs, tên giọng của Gemini/`say`, hoặc tên giọng VieNeu có sẵn trong app. */
  voiceOverride?: string,
  options: VoiceoverOptions = {},
): Promise<VoiceoverClip[]> => {
  if (engine === "gemini") {
    try {
      return await synthesizeVoiceover(lines, slug, engine, voiceOverride);
    } catch (error) {
      const lang = VOICES.find((v) => v.engine === "gemini" && v.id === voiceOverride)?.lang ?? "vi";
      const fallback = shouldFallBack(error) ? fallbackVoice(lang) : null;
      if (!fallback) throw error;
      const reason = {
        rate_limit: "hết lượt theo phút", daily_quota: "hết lượt miễn phí trong ngày", credit: "hết tiền/credit",
        auth: "key bị từ chối", overloaded: "máy chủ quá tải", too_large: "yêu cầu quá lớn", other: "lỗi",
      }[(error as ProviderError).kind];
      const note = `↪ Giọng Gemini ${reason} — đã đọc bằng ${fallback.label}. Chi tiết trong ⚙ Cài đặt › 📊 Hôm nay.`;
      (options.log ?? ((line: string) => process.stdout.write(`${line}\n`)))(note);
      options.onFallback?.(note);
      return synthesizeVoiceover(lines, slug, fallback.engine, fallback.id || undefined);
    }
  }
  return synthesizeVoiceover(lines, slug, engine, voiceOverride);
};

const synthesizeVoiceover = async (
  lines: string[],
  slug: string,
  engine: TtsEngine,
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
  if (engine === "gemini" && !voiceOverride) {
    throw new Error("Giọng Gemini cần tên giọng (ví dụ Kore) — chọn một giọng Gemini trong danh sách.");
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
  const clipName = (i: number) => `line-${String(i + 1).padStart(2, "0")}.mp3`;

  // Câu đã đọc trước đó (cùng giọng, cùng model, cùng chữ) lấy lại từ bộ nhớ — sửa một câu không phải
  // đọc lại cả video, không tốn thêm lượt gọi giọng trên mạng.
  const voiceTag = engine === "elevenlabs" ? `${voiceId}|${modelId}`
    : engine === "gemini" ? `${voiceOverride}|${process.env.GEMINI_TTS_MODEL ?? ""}|${process.env.GEMINI_TTS_STYLE ?? ""}`
      : engine === "say" ? `${sayVoice}|${process.platform}`
        : `${LOCAL_VOICE_MODEL}|${voiceOverride ?? LOCAL_DEFAULT_VOICE}`;
  const cached = lines.map((text) => cachePath(engine, voiceTag, text));
  const todo = lines.map((_, i) => i).filter((i) => !fs.existsSync(cached[i]));
  if (todo.length < lines.length) {
    process.stdout.write(`     Dùng lại ${lines.length - todo.length}/${lines.length} câu đã đọc trước đó.\n`);
  }

  // Giọng trong app đọc cả loạt trong một tiến trình con (nạp model một lần), rồi đổi sang mp3 ở vòng dưới.
  if (engine === "local" && todo.length > 0) {
    await localTtsToWavs(todo.map((i) => ({ text: lines[i], out: path.join(absDir, `${clipName(i)}.wav`) })), voiceOverride);
  }
  // Gemini đọc các câu còn thiếu trong một lượt gọi rồi tự tách câu (tiết kiệm hạn mức gói miễn phí) — xem gemini-tts.ts.
  if (engine === "gemini" && todo.length > 0) {
    await geminiTtsToWavs(todo.map((i) => ({ text: lines[i], out: path.join(absDir, `${clipName(i)}.wav`) })), voiceOverride as string);
  }

  for (let i = 0; i < lines.length; i++) {
    const name = clipName(i);
    const abs = path.join(absDir, name);

    if (!todo.includes(i)) {
      fs.copyFileSync(cached[i], abs, fs.constants.COPYFILE_FICLONE);
      try {
        const now = new Date();
        fs.utimesSync(cached[i], now, now); // đánh dấu vừa dùng — dọn bộ nhớ thì bỏ câu lâu không dùng trước
      } catch {
        // không quan trọng
      }
    } else {
      if (engine === "local" || engine === "gemini") {
        toMp3(`${abs}.wav`, abs);
        fs.unlinkSync(`${abs}.wav`);
      } else if (engine === "say") {
        sayToFile(lines[i], abs, sayVoice);
      } else {
        await elevenLabsToFile(lines[i], abs, voiceId, modelId);
      }
      rememberClip(abs, cached[i]);
    }

    const ms = durationMs(abs);
    process.stdout.write(`     ${name}  ${(ms / 1000).toFixed(2)}s\n`);
    clips.push({ src: path.join(relDir, name), durationMs: ms });
  }

  return clips;
};
