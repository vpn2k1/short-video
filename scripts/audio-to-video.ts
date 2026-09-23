/**
 * Video từ file audio có sẵn — giọng thật của bạn, không dùng TTS.
 *
 *   npx tsx scripts/audio-to-video.ts giong.mp3 --name bai-noi
 *   npx tsx scripts/audio-to-video.ts giong.mp3 --name x --title "Hook" --sub center
 *   npx tsx scripts/audio-to-video.ts bai-hat.mp3 --name x --style karaoke --title "Tên bài"
 *
 * Phiên âm bằng whisper.cpp chạy local (offline, không API key) theo câu, rồi khớp mép phụ đề
 * với khoảng lặng thật của file (scripts/subtitle-align.ts) — phụ đề hiện khi nói, tắt khi ngừng.
 * --style chọn phong cách (mặc định caption); bài hát thì karaoke / lyrics / vinyl — xem src/styles/music.tsx.
 */
import type { WhisperModel } from "@remotion/install-whisper-cpp";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { assertImagesExist } from "./images";
import { renderShort } from "./render";
import { slugify } from "./slug";
import { alignCaptions, detectSilences } from "./subtitle-align";
import { transcribeSentences } from "./transcribe";
import { OUTRO_FRAMES, FPS } from "../src/constants";
import { shortSchema, type ShortProps } from "../src/compositions/Short/schema";
import { isStyleId, MUSIC_STYLES, STYLE_IDS, type StyleId } from "../src/styles/meta";

const args = process.argv.slice(2);

const positional: string[] = [];
let name: string | undefined;
let title: string | undefined;
let subtitle = "";
let accent = "#e8590c";
let background = "#0b0b12";
// medium là mặc định cho tiếng Việt: small sai tên riêng và từ ghép quá nhiều.
// large-v3-turbo KHÔNG dùng được — whisper.cpp 1.5.5 không có DTW preset cho nó,
// mà bản mới hơn cần cmake để build (máy này chưa có).
let model: WhisperModel = "medium";
let language = "vi";
let music: string | null = null;
let captionPosition: "bottom" | "center" = "bottom";
let style: StyleId | undefined;

const flags: Record<string, (value: string) => void> = {
  "--name": (v) => (name = slugify(v)),
  "--title": (v) => (title = v),
  "--subtitle": (v) => (subtitle = v),
  "--accent": (v) => (accent = v),
  "--background": (v) => (background = v),
  "--model": (v) => (model = v as WhisperModel),
  "--lang": (v) => (language = v),
  "--music": (v) => (music = v === "none" ? null : v),
  "--style": (v) => {
    if (!isStyleId(v)) {
      console.error(`--style chỉ nhận: ${STYLE_IDS.join(" | ")}`);
      process.exit(1);
    }
    style = v;
  },
  "--sub": (v) => {
    if (v !== "bottom" && v !== "center") {
      console.error("--sub chỉ nhận: bottom | center");
      process.exit(1);
    }
    captionPosition = v;
  },
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const handler = flags[arg];
  if (handler) {
    i += 1;
    if (!args[i]) {
      console.error(`${arg} cần một giá trị đi kèm.`);
      process.exit(1);
    }
    handler(args[i]);
  } else if (arg.startsWith("--")) {
    console.error(`Không hiểu flag: ${arg}`);
    process.exit(1);
  } else {
    positional.push(arg);
  }
}

const audioInput = positional[0];
if (!audioInput) {
  console.error(
    'Thiếu file audio.\n  npx tsx scripts/audio-to-video.ts giong.mp3 --name bai-noi',
  );
  process.exit(1);
}
if (!fs.existsSync(audioInput)) {
  console.error(`Không thấy file: ${audioInput}`);
  process.exit(1);
}

const slug = name ?? slugify(path.basename(audioInput, path.extname(audioInput)));
const videoDir = path.resolve(process.cwd(), "videos", slug);
const trackRel = path.posix.join("voices", slug, "track.mp3");
const trackAbs = path.resolve(process.cwd(), "public", trackRel);

const audioDurationMs = (file: string) =>
  Math.round(
    parseFloat(
      execFileSync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file,
      ], { encoding: "utf8" }).trim(),
    ) * 1000,
  );

const main = async () => {
  console.log(`\n1/4  Phiên âm ${path.basename(audioInput)} (model ${model})`);
  const sentences = await transcribeSentences({
    audioPath: path.resolve(audioInput),
    model,
    language: language as never,
  });
  const silences = await detectSilences(path.resolve(audioInput));
  const captions = alignCaptions(sentences, silences, audioDurationMs(path.resolve(audioInput)));
  console.log(`     ${sentences.length} câu → ${captions.length} dòng phụ đề (khớp ${silences.length} khoảng lặng)`);

  console.log("2/4  Chép audio vào public/");
  fs.mkdirSync(path.dirname(trackAbs), { recursive: true });
  // Chuẩn hoá về mp3 48kHz stereo cho khớp phần còn lại của soundtrack.
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", path.resolve(audioInput),
    "-ar", "48000", "-ac", "2",
    trackAbs,
  ]);

  const durationMs = audioDurationMs(trackAbs);

  // Bài hát: tên bài lấy theo tên file ("nang-am-xa-dan.mp3" → "nang am xa dan") thay vì câu hát đầu.
  const song = style !== undefined && MUSIC_STYLES.has(style);
  const fileTitle = path.basename(audioInput, path.extname(audioInput)).replace(/[-_]+/g, " ").trim();
  const props: ShortProps = shortSchema.parse({
    title: title ?? (song ? fileTitle : captions[0]?.text) ?? "Video",
    subtitle,
    accent,
    background,
    captions,
    ...(style ? { style } : {}),
    // Một cảnh phủ toàn bộ; thêm ảnh bằng cách sửa props.json rồi render lại.
    scenes: [{ image: null, visual: null, startMs: 0, endMs: durationMs }],
    captionPosition,
    // Audio nói ngay từ giây 0 — title card sẽ đè lên câu đầu.
    showTitle: false,
    voiceoverTrack: trackRel,
    music,
    sfx: false,
  });

  fs.mkdirSync(videoDir, { recursive: true });
  const propsPath = path.join(videoDir, "props.json");
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
  console.log(`3/4  Props: ${path.relative(process.cwd(), propsPath)}`);

  assertImagesExist(props);

  console.log("4/4  Render");
  const output = path.resolve(process.cwd(), `out/${slug}.mp4`);
  const { durationInFrames } = await renderShort(props, output);
  console.log(
    `\nXong: out/${slug}.mp4 (${durationInFrames} frame, ${(durationInFrames / FPS).toFixed(1)}s; audio ${(durationMs / 1000).toFixed(1)}s + ${OUTRO_FRAMES} frame outro)\n`,
  );
};

main().catch((error) => {
  console.error(`\nLỗi: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
