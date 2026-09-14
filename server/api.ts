import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { allLines, parseScript, scriptToProps } from "../src/compositions/Short/script";
import { shortSchema, type ShortProps } from "../src/compositions/Short/schema";
import { TITLE_FRAMES } from "../src/constants";
import { generateScript } from "../scripts/generate-script";
import { generateVoiceover, type TtsEngine } from "../scripts/tts";
import { fetchAccountVoices, findVoice, VOICES } from "../scripts/voices";
import { renderScene, renderShort } from "../scripts/render";
import { assertImagesExist, listAllImages } from "../scripts/images";
import { downloadPhoto, searchPhotos, writeCredits } from "../scripts/pexels";
import { generateImage } from "../scripts/gemini-image";
import { slugify } from "../scripts/slug";
import {
  generateMusic, generateSfx, MOODS, SFX_KINDS,
  type Mood, type SfxKind,
} from "../scripts/make-audio";

const root = () => process.cwd();
const videosDir = () => path.join(root(), "videos");
const outDir = () => path.join(root(), "out");

export type Log = (line: string) => void;

export const listVideos = () => {
  if (!fs.existsSync(videosDir())) {
    return [];
  }
  return fs
    .readdirSync(videosDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(videosDir(), entry.name);
      const propsPath = path.join(dir, "props.json");
      const mp4 = path.join(outDir(), `${entry.name}.mp4`);
      let title = entry.name;
      let scenes = 0;
      let captions = 0;
      if (fs.existsSync(propsPath)) {
        try {
          const props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
          title = props.title ?? title;
          scenes = props.scenes?.length ?? 0;
          captions = props.captions?.length ?? 0;
        } catch {
          // props hỏng thì vẫn liệt kê, chỉ thiếu thông tin
        }
      }
      return {
        slug: entry.name,
        title,
        scenes,
        captions,
        hasScript: fs.existsSync(path.join(dir, "script.json")),
        hasProps: fs.existsSync(propsPath),
        mp4: fs.existsSync(mp4) ? `/out/${entry.name}.mp4` : null,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
};

export const readVideo = (slug: string) => {
  const dir = path.join(videosDir(), slug);
  const read = (name: string) => {
    const file = path.join(dir, name);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  };
  return { slug, script: read("script.json"), props: read("props.json") };
};

export const writeScript = (slug: string, script: unknown) => {
  const parsed = parseScript(script);
  const dir = path.join(videosDir(), slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "script.json"),
    JSON.stringify(parsed, null, 2),
  );
  return parsed;
};

export const writeProps = (slug: string, props: unknown) => {
  const parsed = shortSchema.parse(props);
  const dir = path.join(videosDir(), slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "props.json"),
    JSON.stringify(parsed, null, 2),
  );
  return parsed;
};

export const voiceCatalog = async (live: boolean) => {
  const catalog = VOICES.map((voice) => ({
    key: voice.key,
    label: `${voice.key} — ${voice.gender}, ${voice.lang}`,
    engine: voice.engine,
    lang: voice.lang,
    paidPlan: Boolean(voice.paidPlan),
  }));
  if (!live || !process.env.ELEVENLABS_API_KEY) {
    return { catalog, account: null };
  }
  try {
    return { catalog, account: await fetchAccountVoices(process.env.ELEVENLABS_API_KEY) };
  } catch (error) {
    return {
      catalog,
      account: null,
      accountError: error instanceof Error ? error.message : String(error),
    };
  }
};

/** prompt → script.json. Cần ANTHROPIC_API_KEY. */
export const createFromPrompt = async (
  prompt: string,
  name: string | undefined,
  log: Log,
) => {
  const slug = slugify(name && name.trim() ? name : prompt);
  log(`Sinh kịch bản cho "${prompt}"…`);
  const script = await generateScript(prompt, slug);
  writeScript(slug, script);
  log(`Xong: ${script.scenes.length} cảnh, ${allLines(script).length} câu`);
  return { slug, script };
};

export const fetchSceneImages = async (
  slug: string,
  queries: string[],
  sources: ("pexels" | "gemini")[],
  log: Log,
) => {
  const dir = path.join(root(), "public/images", slug);
  fs.mkdirSync(dir, { recursive: true });
  const credits: string[] = [];
  const files: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const base = `${String(i + 1).padStart(2, "0")}-${slugify(query, 32)}`;
    let done = false;
    const errors: string[] = [];

    for (const source of sources) {
      if (done) break;
      try {
        if (source === "pexels") {
          const photos = await searchPhotos(query, 5);
          if (photos.length === 0) {
            errors.push("pexels: không có kết quả");
            continue;
          }
          const result = await downloadPhoto(photos[0], path.join(dir, `${base}.jpg`));
          credits.push(result.credit);
          files.push(`images/${slug}/${base}.jpg`);
          log(`[pexels] ${base}.jpg — ${result.credit}`);
        } else {
          await generateImage(
            `${query}. Vertical 9:16 background image for a short-form video. ` +
              "No text, no words, no letters, no logos. " +
              "Keep the lower half darker so white subtitle text stays readable.",
            path.join(dir, `${base}.png`),
          );
          files.push(`images/${slug}/${base}.png`);
          log(`[gemini] ${base}.png`);
        }
        done = true;
      } catch (error) {
        errors.push(`${source}: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (!done) {
      log(`KHÔNG lấy được ảnh cho "${query}": ${errors.join(" | ")}`);
    }
  }

  writeCredits(dir, credits);
  return { files, images: listAllImages() };
};

export const buildAndRender = async (
  slug: string,
  options: {
    voice?: string;
    music?: string | null;
    sfx?: boolean;
    captionPosition?: "bottom" | "center";
    composition?: string;
    regenerateVoice: boolean;
  },
  log: Log,
) => {
  const dir = path.join(videosDir(), slug);
  const scriptPath = path.join(dir, "script.json");
  const propsPath = path.join(dir, "props.json");

  let props: ShortProps;

  if (options.regenerateVoice && fs.existsSync(scriptPath)) {
    const script = parseScript(JSON.parse(fs.readFileSync(scriptPath, "utf8")));
    const lines = allLines(script);
    const voice = options.voice ? findVoice(options.voice) : undefined;
    const engine: TtsEngine | "none" = voice ? voice.engine : "none";

    let voiceover;
    if (engine !== "none") {
      log(`Sinh voiceover — ${options.voice} (${engine})…`);
      voiceover = await generateVoiceover(lines, slug, engine, voice?.id);
      log(`${voiceover.length} clip`);
    }

    props = scriptToProps(script, {
      startAtFrame: TITLE_FRAMES,
      voiceover,
      music: options.music ?? null,
      sfx: options.sfx ?? false,
      captionPosition: options.captionPosition ?? "bottom",
    });
    writeProps(slug, props);
  } else {
    if (!fs.existsSync(propsPath)) {
      throw new Error(`Chưa có ${slug}/props.json. Bật "sinh lại giọng" để tạo.`);
    }
    props = shortSchema.parse(JSON.parse(fs.readFileSync(propsPath, "utf8")));
  }

  assertImagesExist(props);

  const output = path.join(outDir(), `${slug}.mp4`);
  fs.mkdirSync(outDir(), { recursive: true });
  log("Render…");
  const { durationInFrames } = await renderShort(
    props,
    output,
    options.composition,
    (percent) => log(`__PROGRESS__ ${percent}`),
  );

  const seconds = (durationInFrames / 30).toFixed(1);
  log(`Xong: out/${slug}.mp4 (${durationInFrames} frame, ${seconds}s)`);
  return { mp4: `/out/${slug}.mp4`, durationInFrames };
};

/** Tìm ảnh Pexels, trả về thumbnail cho UI chọn — chưa tải gì về máy. */
export const searchPexels = async (query: string) => {
  const photos = await searchPhotos(query, 12);
  return photos.map((photo) => ({
    id: photo.id,
    thumb: photo.src.medium ?? photo.src.small,
    width: photo.width,
    height: photo.height,
    photographer: photo.photographer,
    url: photo.url,
  }));
};

/** Tải đúng tấm người dùng chọn về public/images/<slug>/. */
export const pickPexels = async (slug: string, query: string, id: number) => {
  const photos = await searchPhotos(query, 12);
  const photo = photos.find((p) => p.id === id);
  if (!photo) {
    throw new Error("Không tìm lại được ảnh đó. Tìm lại rồi chọn tiếp.");
  }
  const dir = path.join(root(), "public/images", slug);
  const file = path.join(dir, `pexels-${id}.jpg`);
  const result = await downloadPhoto(photo, file);
  writeCredits(dir, [result.credit]);
  return { image: `images/${slug}/pexels-${id}.jpg`, credit: result.credit };
};

const hasAudio = (file: string) => {
  try {
    return execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type",
        "-of", "csv=p=0", file],
      { encoding: "utf8" },
    ).trim().length > 0;
  } catch {
    return false;
  }
};

/**
 * Nối nhiều mp4 thành một. Phải mã hoá lại chứ không copy stream được:
 * video thiếu audio sẽ làm lệch cặp stream khi ghép, nên chỗ nào thiếu thì
 * chèn im lặng để mọi đoạn có đủ cả video lẫn audio.
 */
export const concatVideos = async (slugs: string[], name: string, log: Log) => {
  if (slugs.length < 2) {
    throw new Error("Cần ít nhất 2 video để nối.");
  }
  const files = slugs.map((slug) => path.join(outDir(), `${slug}.mp4`));
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length > 0) {
    throw new Error(
      `Chưa render: ${missing.map((f) => path.basename(f)).join(", ")}`,
    );
  }

  const inputs: string[] = [];
  const parts: string[] = [];
  files.forEach((file, i) => {
    inputs.push("-i", file);
    parts.push(`[${i}:v:0]`);
    if (hasAudio(file)) {
      parts.push(`[${i}:a:0]`);
    } else {
      log(`${path.basename(file)} không có tiếng — chèn im lặng`);
      inputs.push("-f", "lavfi", "-t", "0.1", "-i", "anullsrc=r=48000:cl=stereo");
      parts.push(`[${files.length + i}:a:0]`);
    }
  });

  const output = path.join(outDir(), `${name}.mp4`);
  log(`Nối ${slugs.length} video → out/${name}.mp4 (mã hoá lại, mất một lúc)…`);

  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    ...inputs,
    "-filter_complex",
    `${parts.join("")}concat=n=${files.length}:v=1:a=1[v][a]`,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-r", "30", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    output,
  ], { maxBuffer: 64 * 1024 * 1024 });

  const seconds = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", output],
    { encoding: "utf8" },
  ).trim();

  log(`Xong: out/${name}.mp4 (${Number(seconds).toFixed(1)}s)`);
  return { mp4: `/out/${name}.mp4`, seconds: Number(seconds) };
};

/** Nhạc và tiếng động đang có trong public/, để UI đổ vào dropdown. */
export const listAudio = () => {
  const scan = (dir: string) => {
    const abs = path.join(root(), "public", dir);
    if (!fs.existsSync(abs)) return [];
    return fs
      .readdirSync(abs)
      .filter((f) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(f))
      .sort()
      .map((f) => ({ path: `${dir}/${f}`, name: f }));
  };
  return { music: scan("music"), sfx: scan("sfx"), moods: MOODS, sfxKinds: SFX_KINDS };
};

/** Sinh bằng ffmpeg — offline, miễn phí. */
export const makeAudioLocal = (
  kind: "music" | "sfx",
  which: string,
  seconds: number,
  log: Log,
) => {
  if (kind === "music") {
    if (!MOODS.includes(which as Mood)) {
      throw new Error(`Mood không hợp lệ. Chọn: ${MOODS.join(", ")}`);
    }
    const file = path.join(root(), "public/music", `${which}.mp3`);
    generateMusic(which as Mood, Math.min(180, Math.max(5, seconds)), file);
    log(`Đã sinh music/${which}.mp3 (${seconds}s)`);
    return { path: `music/${which}.mp3` };
  }
  if (!SFX_KINDS.includes(which as SfxKind)) {
    throw new Error(`Loại sfx không hợp lệ. Chọn: ${SFX_KINDS.join(", ")}`);
  }
  const file = path.join(root(), "public/sfx", `${which}.mp3`);
  generateSfx(which as SfxKind, file);
  log(`Đã sinh sfx/${which}.mp3`);
  return { path: `sfx/${which}.mp3` };
};

/**
 * Sinh bằng ElevenLabs theo mô tả ngữ cảnh. Cần key có quyền
 * `music_generation` / `sound_generation` — mặc định key mới KHÔNG có.
 */
export const makeAudioElevenLabs = async (
  kind: "music" | "sfx",
  prompt: string,
  seconds: number,
  name: string,
  log: Log,
) => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("Thiếu ELEVENLABS_API_KEY trong .env");
  }

  const isMusic = kind === "music";
  const url = isMusic
    ? "https://api.elevenlabs.io/v1/music"
    : "https://api.elevenlabs.io/v1/sound-generation";
  const body = isMusic
    ? { prompt, music_length_ms: Math.round(Math.min(120, Math.max(10, seconds)) * 1000) }
    : { text: prompt, duration_seconds: Math.min(22, Math.max(0.5, seconds)) };

  log(`Gọi ElevenLabs ${isMusic ? "music" : "sound-generation"}…`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    const scope = isMusic ? "music_generation" : "sound_generation";
    if (detail.includes(scope)) {
      throw new Error(
        `Key ElevenLabs thiếu quyền "${scope}". Vào dashboard ElevenLabs, sửa quyền của ` +
          "API key rồi thử lại — không cần tạo key mới.",
      );
    }
    throw new Error(`ElevenLabs trả về ${response.status}: ${detail.slice(0, 200)}`);
  }

  const dir = path.join(root(), "public", isMusic ? "music" : "sfx");
  fs.mkdirSync(dir, { recursive: true });
  const safe = slugify(name || prompt, 40);
  const file = path.join(dir, `${safe}.mp3`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));

  // Chuẩn hoá về cùng mức với phần còn lại của soundtrack.
  const temp = `${file}.norm.mp3`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", file,
    "-af", `loudnorm=I=${isMusic ? -18 : -16}:TP=-2:LRA=11`,
    "-ac", "2", "-ar", "48000", temp]);
  fs.renameSync(temp, file);

  const rel = `${isMusic ? "music" : "sfx"}/${safe}.mp3`;
  log(`Đã lưu ${rel}`);
  return { path: rel };
};

/** Mọi ảnh/video đã render, gộp từ mọi cuộc — thư viện chung. */
export const gallery = () => {
  const items: {
    file: string; slug: string; kind: "image" | "video";
    scene: number | null; bytes: number; at: number;
  }[] = [];

  const scan = (dir: string, scene: boolean) => {
    const abs = path.join(outDir(), dir);
    if (!fs.existsSync(abs)) return;
    for (const name of fs.readdirSync(abs)) {
      const full = path.join(abs, name);
      if (!fs.statSync(full).isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (![".mp4", ".png", ".jpg"].includes(ext)) continue;
      const base = path.basename(name, ext);
      const m = scene ? base.match(/^(.*)-(\d+)$/) : null;
      items.push({
        file: `/out/${dir ? dir + "/" : ""}${name}`,
        slug: m ? m[1] : base,
        kind: ext === ".mp4" ? "video" : "image",
        scene: m ? Number(m[2]) : null,
        bytes: fs.statSync(full).size,
        at: fs.statSync(full).mtimeMs,
      });
    }
  };

  scan("", false);
  scan("scenes", true);
  return items.sort((a, b) => b.at - a.at);
};

/** Render một cảnh thành file riêng trong out/scenes/. */
export const renderOneScene = async (
  slug: string,
  index: number,
  kind: "image" | "video",
  log: Log,
) => {
  const propsPath = path.join(videosDir(), slug, "props.json");
  if (!fs.existsSync(propsPath)) {
    throw new Error(`${slug} chưa có props.json — chạy bước Giọng đọc trước.`);
  }
  const props = shortSchema.parse(JSON.parse(fs.readFileSync(propsPath, "utf8")));
  assertImagesExist(props);

  const dir = path.join(outDir(), "scenes");
  fs.mkdirSync(dir, { recursive: true });
  const ext = kind === "image" ? "png" : "mp4";
  const output = path.join(dir, `${slug}-${index + 1}.${ext}`);

  log(`Render cảnh ${index + 1} (${kind})…`);
  const result = await renderScene(props, index, kind, output,
    (percent) => log(`__PROGRESS__ ${percent}`));

  log(`Xong: out/scenes/${path.basename(output)}`);
  return { file: `/out/scenes/${path.basename(output)}`, kind, ...result };
};

/** Đổi cài đặt chung của một cuộc: tỉ lệ, loại đầu ra. */
export const updateSettings = (
  slug: string,
  patch: { aspect?: string; kind?: "image" | "video" },
) => {
  const propsPath = path.join(videosDir(), slug, "props.json");
  if (fs.existsSync(propsPath) && patch.aspect) {
    const props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
    props.aspect = patch.aspect;
    fs.writeFileSync(propsPath, JSON.stringify(shortSchema.parse(props), null, 2));
  }
  const metaPath = path.join(videosDir(), slug, "meta.json");
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
    : {};
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify({ ...meta, ...patch }, null, 2));
  return { ...meta, ...patch };
};

export const readSettings = (slug: string) => {
  const metaPath = path.join(videosDir(), slug, "meta.json");
  const propsPath = path.join(videosDir(), slug, "props.json");
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
    : {};
  const props = fs.existsSync(propsPath)
    ? JSON.parse(fs.readFileSync(propsPath, "utf8"))
    : null;
  return { kind: meta.kind ?? "video", aspect: props?.aspect ?? meta.aspect ?? "9:16" };
};

export const probe = (file: string) => {
  try {
    return execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height",
        "-show_entries", "format=duration,size", "-of", "json", file],
      { encoding: "utf8" },
    );
  } catch {
    return null;
  }
};
