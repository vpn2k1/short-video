/**
 * Trạng thái từng bước của pipeline cho một video, và chạy riêng từng bước.
 *
 * "stale" tính bằng mtime: script mới hơn props nghĩa là props đã cũ, props mới
 * hơn mp4 nghĩa là bản render đã cũ. Đây là thứ khó thấy nhất khi làm thủ công —
 * sửa chữ xong quên render lại là chuyện thường.
 */
import fs from "fs";
import path from "path";
import { allLines, parseScript, scriptToProps } from "../src/compositions/Short/script";
import { shortSchema, type ShortProps } from "../src/compositions/Short/schema";
import { TITLE_FRAMES } from "../src/constants";
import { generateVoiceover, type TtsEngine } from "../scripts/tts";
import { findVoice } from "../scripts/voices";
import { renderShort } from "../scripts/render";
import { assertImagesExist } from "../scripts/images";
import { assertDiskSpace, RENDER_MIN_FREE } from "./disk";

export type StageState = "done" | "missing" | "stale" | "skipped";

export type Stage = {
  id: "script" | "voice" | "images" | "audio" | "render";
  label: string;
  state: StageState;
  detail: string;
  /** Bước này chạy riêng được không. */
  runnable: boolean;
};

const root = () => process.cwd();
const mtime = (file: string) =>
  fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;

const readJson = (file: string) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;

export const pipelineStatus = (slug: string): Stage[] => {
  const dir = path.join(root(), "videos", slug);
  const scriptPath = path.join(dir, "script.json");
  const propsPath = path.join(dir, "props.json");
  const mp4 = path.join(root(), "out", `${slug}.mp4`);

  const script = readJson(scriptPath);
  const props: ShortProps | null = readJson(propsPath);

  const tScript = mtime(scriptPath);
  const tProps = mtime(propsPath);
  const tMp4 = mtime(mp4);

  // --- Kịch bản ---
  const scriptStage: Stage = script
    ? {
        id: "script", label: "Kịch bản", state: "done", runnable: true,
        detail: `${script.scenes?.length ?? 0} cảnh · ${
          script.scenes?.reduce((n: number, s: { lines: string[] }) => n + s.lines.length, 0) ?? 0
        } câu`,
      }
    : props
      ? { id: "script", label: "Kịch bản", state: "skipped", runnable: false,
          detail: "dựng từ audio — không có script.json" }
      : { id: "script", label: "Kịch bản", state: "missing", runnable: true,
          detail: "chưa có" };

  // --- Giọng đọc ---
  const clips = props?.captions?.filter((c) => c.audio) ?? [];
  const track = props?.voiceoverTrack;
  const audioFiles = [...clips.map((c) => c.audio as string), ...(track ? [track] : [])];
  const missingAudio = audioFiles.filter(
    (rel) => !fs.existsSync(path.join(root(), "public", rel)),
  );

  let voiceStage: Stage;
  if (!props) {
    voiceStage = { id: "voice", label: "Giọng đọc", state: "missing", runnable: Boolean(script),
      detail: "chưa sinh" };
  } else if (audioFiles.length === 0) {
    voiceStage = { id: "voice", label: "Giọng đọc", state: "skipped", runnable: Boolean(script),
      detail: "video không lời" };
  } else if (missingAudio.length > 0) {
    voiceStage = { id: "voice", label: "Giọng đọc", state: "missing", runnable: Boolean(script),
      detail: `thiếu ${missingAudio.length} file audio` };
  } else if (tScript > tProps) {
    voiceStage = { id: "voice", label: "Giọng đọc", state: "stale", runnable: Boolean(script),
      detail: "kịch bản đã sửa sau khi sinh giọng" };
  } else {
    voiceStage = { id: "voice", label: "Giọng đọc", state: "done", runnable: Boolean(script),
      detail: track ? "1 track cho cả video" : `${clips.length} clip` };
  }

  // --- Ảnh ---
  const scenes = props?.scenes ?? script?.scenes ?? [];
  const withImage = scenes.filter((s: { image?: string | null }) => s.image);
  const missingImages = withImage.filter(
    (s: { image: string }) => !fs.existsSync(path.join(root(), "public", s.image)),
  );
  const imageStage: Stage =
    withImage.length === 0
      ? { id: "images", label: "Ảnh", state: "skipped", runnable: true,
          detail: "chỉ dùng nền gradient" }
      : missingImages.length > 0
        ? { id: "images", label: "Ảnh", state: "missing", runnable: true,
            detail: `thiếu ${missingImages.length}/${withImage.length} file` }
        : { id: "images", label: "Ảnh", state: "done", runnable: true,
            detail: `${withImage.length}/${scenes.length} cảnh có ảnh` };

  // --- Nhạc nền ---
  const music = props?.music;
  const audioStage: Stage = !music
    ? { id: "audio", label: "Nhạc nền", state: "skipped", runnable: true, detail: "không nhạc" }
    : fs.existsSync(path.join(root(), "public", music))
      ? { id: "audio", label: "Nhạc nền", state: "done", runnable: true,
          detail: path.basename(music) }
      : { id: "audio", label: "Nhạc nền", state: "missing", runnable: true,
          detail: `thiếu file ${music}` };

  // --- Render ---
  const renderStage: Stage = !fs.existsSync(mp4)
    ? { id: "render", label: "Render", state: "missing", runnable: Boolean(props),
        detail: "chưa render" }
    : tProps > tMp4
      ? { id: "render", label: "Render", state: "stale", runnable: true,
          detail: "props đã đổi sau lần render cuối" }
      : { id: "render", label: "Render", state: "done", runnable: true,
          detail: `${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB` };

  return [scriptStage, voiceStage, imageStage, audioStage, renderStage];
};

/** Sinh lại giọng và ghi props.json — KHÔNG render. */
export const runVoiceStage = async (
  slug: string,
  options: {
    voice?: string;
    music?: string | null;
    sfx?: boolean;
    captionPosition?: "bottom" | "center";
  },
  log: (line: string) => void,
) => {
  const dir = path.join(root(), "videos", slug);
  const scriptPath = path.join(dir, "script.json");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `${slug} không có script.json — video dựng từ audio thì sửa thẳng props.json.`,
    );
  }

  const script = parseScript(JSON.parse(fs.readFileSync(scriptPath, "utf8")));
  const lines = allLines(script);
  const voice = options.voice ? findVoice(options.voice) : undefined;
  const engine: TtsEngine | "none" = voice ? voice.engine : "none";

  let voiceover;
  if (engine !== "none") {
    log(`Sinh voiceover — ${options.voice} (${engine}) cho ${lines.length} câu…`);
    voiceover = await generateVoiceover(lines, slug, engine, voice?.id);
  } else {
    log("Không chọn giọng — timing suy từ số ký tự.");
  }

  const props = scriptToProps(script, {
    startAtFrame: TITLE_FRAMES,
    voiceover,
    music: options.music ?? null,
    sfx: options.sfx ?? false,
    captionPosition: options.captionPosition ?? "bottom",
  });

  fs.writeFileSync(
    path.join(dir, "props.json"),
    JSON.stringify(shortSchema.parse(props), null, 2),
  );
  log(`props.json cập nhật: ${props.captions.length} câu`);
  return { captions: props.captions.length };
};

/** Render từ props.json có sẵn — KHÔNG đụng giọng. */
export const runRenderStage = async (
  slug: string,
  composition: string | undefined,
  log: (line: string) => void,
) => {
  const propsPath = path.join(root(), "videos", slug, "props.json");
  if (!fs.existsSync(propsPath)) {
    throw new Error(`${slug} chưa có props.json — chạy bước Giọng đọc trước.`);
  }
  const props = shortSchema.parse(JSON.parse(fs.readFileSync(propsPath, "utf8")));
  assertImagesExist(props);
  assertDiskSpace(RENDER_MIN_FREE, "xuất video");

  const output = path.join(root(), "out", `${slug}.mp4`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  log("Render…");
  const { durationInFrames } = await renderShort(
    props, output, composition,
    (percent) => log(`__PROGRESS__ ${percent}`),
  );
  log(`Xong: out/${slug}.mp4 (${durationInFrames} frame, ${(durationInFrames / 30).toFixed(1)}s)`);
  return { mp4: `/out/${slug}.mp4`, durationInFrames };
};
