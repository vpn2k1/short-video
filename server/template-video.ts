/**
 * Chức năng riêng "Tạo video theo mẫu": chọn 1 nhân vật có sẵn (người que, hoạt hình…), dán lời —
 * server tự chọn hành động/biểu cảm cho nhân vật theo từ khoá trong từng câu, không cần AI/API key.
 *
 * Tái dùng đúng pipeline render có sẵn (scriptToProps + renderShort — xem server/pipeline.ts):
 * script.json → props.json (có thêm 1 overlay nhân vật với keyframes) → out/<slug>.mp4.
 */
import fs from "fs";
import path from "path";
import { freshSlug } from "./chat";
import { startJob } from "./jobs";
import { generateVoiceover } from "../scripts/tts";
import { findVoice } from "../scripts/voices";
import { renderShort } from "../scripts/render";
import { assertImagesExist } from "../scripts/images";
import { assertDiskSpace, RENDER_MIN_FREE } from "./disk";
import { parseScript, scriptToProps, type VideoScript } from "../src/compositions/Short/script";
import { shortSchema, type OverlayKeyframe, type ShortProps } from "../src/compositions/Short/schema";
import { TITLE_FRAMES } from "../src/constants";

/** Một hành động = một mẫu chuyển động lặp lại (x/y/rotate tương đối), độ dài 1 vòng tính bằng ms. */
type ActionPattern = { loopMs: number; frames: Array<Pick<OverlayKeyframe, "atMs" | "x" | "y" | "rotate">> };

const ACTIONS: Record<string, ActionPattern> = {
  idle: { loopMs: 1000, frames: [{ atMs: 0, x: 0, y: 0, rotate: 0 }, { atMs: 1000, x: 0, y: 0, rotate: 0 }] },
  happy: {
    loopMs: 500,
    frames: [{ atMs: 0, x: 0, y: 0, rotate: -4 }, { atMs: 250, x: 0, y: -4, rotate: 4 }, { atMs: 500, x: 0, y: 0, rotate: -4 }],
  },
  jump: {
    loopMs: 600,
    frames: [{ atMs: 0, x: 0, y: 0, rotate: 0 }, { atMs: 200, x: 0, y: -14, rotate: 0 }, { atMs: 400, x: 0, y: 0, rotate: 0 }, { atMs: 600, x: 0, y: 0, rotate: 0 }],
  },
  wave: {
    loopMs: 500,
    frames: [{ atMs: 0, x: 0, y: 0, rotate: 0 }, { atMs: 250, x: 0, y: 0, rotate: 8 }, { atMs: 500, x: 0, y: 0, rotate: 0 }],
  },
  sad: { loopMs: 1200, frames: [{ atMs: 0, x: 0, y: 0, rotate: -2 }, { atMs: 1200, x: 0, y: 2, rotate: -2 }] },
};

/** Từ khoá tiếng Việt → hành động. Quét theo thứ tự, câu không khớp gì thì "idle". */
const ACTION_KEYWORDS: Array<{ action: keyof typeof ACTIONS; words: string[] }> = [
  { action: "happy", words: ["vui", "cười", "hạnh phúc", "thích quá", "tuyệt"] },
  { action: "sad", words: ["buồn", "khóc", "thất vọng", "chán"] },
  { action: "jump", words: ["nhảy", "nhún", "bật lên"] },
  { action: "wave", words: ["vẫy tay", "chào", "xin chào", "tạm biệt"] },
];

export const detectAction = (text: string): keyof typeof ACTIONS => {
  const lower = text.toLocaleLowerCase("vi");
  for (const { action, words } of ACTION_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return action;
  }
  return "idle";
};

export type CharacterTemplate = {
  id: string;
  name: string;
  description: string;
  /** staticFile() path của ảnh nhân vật, đặt trong public/templates/characters/. */
  image: string;
  background: string;
  accent: string;
};

/** shortcut: 1 ảnh demo (người que vẽ bằng code) — thay bằng ảnh thật trong public/templates/characters/ khi có. */
export const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: "stickman",
    name: "Người que",
    description: "Nhân vật người que đơn giản, tự đổi hành động theo lời đọc.",
    image: "templates/characters/demo-stickman.png",
    background: "#87CEEB",
    accent: "#1a1a1a",
  },
];

export const listTemplates = () => ({ templates: CHARACTER_TEMPLATES });

const findTemplate = (id: unknown) => CHARACTER_TEMPLATES.find((t) => t.id === id);

/** Tách lời thành câu — mỗi câu một cảnh, không cần ảnh nền (chỉ màu nền của mẫu). */
const textToScenes = (text: string) =>
  text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => ({ lines: [line], image: null, visual: null, tag: null, punch: null }));

/** Dựng dãy keyframe tuyệt đối cho overlay nhân vật: mỗi câu lặp mẫu hành động của nó trong đúng khoảng [startMs, endMs). */
const buildCharacterKeyframes = (
  captions: ShortProps["captions"],
  actionsPerCaption: Array<keyof typeof ACTIONS>,
): OverlayKeyframe[] => {
  const out: OverlayKeyframe[] = [];
  captions.forEach((cap, i) => {
    const pattern = ACTIONS[actionsPerCaption[i]];
    const span = cap.endMs - cap.startMs;
    for (let offset = 0; offset < span; offset += pattern.loopMs) {
      for (const f of pattern.frames) {
        const atMs = cap.startMs + offset + f.atMs;
        if (atMs > cap.endMs) continue;
        out.push({ atMs, x: 50 + f.x, y: 55 + f.y, width: 55, rotate: f.rotate, opacity: 1 });
      }
    }
  });
  if (out.length === 0) out.push({ atMs: 0, x: 50, y: 55, width: 55, rotate: 0, opacity: 1 });
  return out;
};

export type TemplateVideoInput = {
  templateId?: unknown;
  title?: unknown;
  text?: unknown;
  voice?: unknown;
  music?: unknown;
  aspect?: unknown;
};

export const createTemplateVideo = (body: unknown) => {
  const input = (body ?? {}) as TemplateVideoInput;
  const template = findTemplate(input.templateId);
  if (!template) throw new Error("Chưa chọn mẫu nhân vật.");
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) throw new Error("Dán lời cho video trước đã.");
  const scenes = textToScenes(text);
  if (scenes.length === 0) throw new Error("Không đọc được câu nào từ lời đã dán.");

  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 60) : scenes[0].lines[0].slice(0, 60);
  const voiceKey = typeof input.voice === "string" ? input.voice : "";
  const music = typeof input.music === "string" && input.music ? input.music : null;
  const aspect = typeof input.aspect === "string" ? input.aspect : "9:16";

  const script: VideoScript = parseScript({
    style: "plain",
    title,
    subtitle: template.name,
    accent: template.accent,
    background: template.background,
    scenes,
  });

  const slug = freshSlug(title);
  const dir = path.join(process.cwd(), "videos", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(script, null, 2));

  const job = startJob(async (log) => {
    const lines = scenes.map((s) => s.lines[0]);
    const voice = voiceKey ? findVoice(voiceKey) : undefined;
    let voiceover;
    if (voice) {
      log(`Sinh giọng đọc — ${voiceKey}…`);
      voiceover = await generateVoiceover(lines, slug, voice.engine, voice.id, { log });
    }

    const props = scriptToProps(script, {
      startAtFrame: TITLE_FRAMES,
      voiceover,
      music,
      aspect,
      captionPosition: "bottom",
    });

    const actionsPerCaption = props.captions.map((c) => detectAction(c.text));
    props.overlays = [
      {
        src: template.image,
        startMs: 0,
        endMs: props.captions.at(-1)?.endMs ?? 3000,
        trimStartMs: 0,
        volume: 0,
        track: 0,
        x: 50,
        y: 55,
        width: 55,
        aspect: 4 / 5,
        rotate: 0,
        opacity: 1,
        radius: 0,
        fit: "contain",
        crop: null,
        fadeMs: 0,
        keyframes: buildCharacterKeyframes(props.captions, actionsPerCaption),
      },
    ];

    const parsed = shortSchema.parse(props);
    fs.writeFileSync(path.join(dir, "props.json"), JSON.stringify(parsed, null, 2));
    assertImagesExist(parsed);
    assertDiskSpace(RENDER_MIN_FREE, "xuất video");

    const output = path.join(process.cwd(), "out", `${slug}.mp4`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    log("Render…");
    const { durationInFrames } = await renderShort(parsed, output, undefined, (percent) => log(`__PROGRESS__ ${percent}`));
    log(`Xong: out/${slug}.mp4 (${durationInFrames} frame)`);
    return { slug, mp4: `/out/${slug}.mp4`, durationInFrames };
  });

  return { slug, jobId: job.id };
};
