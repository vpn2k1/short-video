import { z } from "zod";
import { FPS, OUTRO_FRAMES } from "../../constants";
import { noMotion, type Caption, type CaptionPosition, type Scene, type ShortProps } from "./schema";
import { DEFAULT_STYLE, isStyleId, STYLE_IDS } from "../../styles/meta";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * What the LLM is asked to produce. Deliberately narrower than `shortSchema`:
 * the model writes copy, it does not invent frame timings. Plain zod only —
 * this schema gets converted to JSON Schema for the API's structured output.
 */
/** Một cảnh trong kịch bản: vài câu phụ đề dùng chung một hình nền. */
export const scriptSceneSchema = z.object({
  lines: z.array(z.string().min(1).max(90)).min(1).max(12),
  /** Tên file trong public/images/, ví dụ "images/pin.jpg". null = chỉ nền gradient. */
  image: z.string().nullable(),
  /**
   * Hình vẽ bằng code — không cần file ảnh. Model tự tạo được phần này,
   * khác với "image" vốn phải có file người dùng bỏ vào sẵn.
   */
  visual: z
    .object({
      type: z.enum(["badge", "stat"]),
      text: z.string().min(1).max(16),
      caption: z.string().min(1).max(40).nullable(),
    })
    .nullable(),
  /** Nhãn ngắn hiện suốt cảnh: năm, con số, địa danh, "?"… null nếu không có. */
  tag: z.string().min(1).max(18).nullable(),
  /** Cụm từ đắt nhất của cảnh — PHẢI nằm nguyên văn trong một câu của `lines`. */
  punch: z.string().min(1).max(48).nullable(),
});

/**
 * Trần an toàn số cảnh của một kịch bản — không phải mục tiêu. 200 cảnh × ~12s ≈ 40 phút.
 * Độ dài thật do người dùng chọn (scripts/video-length.ts); video dài được AI viết theo chương.
 */
export const MAX_SCRIPT_SCENES = 200;

export const videoScriptSchema = z.object({
  /** Phong cách hình ảnh. Người dùng chọn cụ thể thì server ghi đè giá trị này. */
  style: z.enum(STYLE_IDS),
  title: z.string().min(1).max(60),
  subtitle: z.string().min(1).max(90),
  handle: z.string().min(1).max(30),
  accent: z.string().regex(HEX_COLOR),
  background: z.string().regex(HEX_COLOR),
  // Bound an toàn, không phải hướng dẫn phong cách — độ dài mong muốn nằm ở system prompt.
  scenes: z.array(scriptSceneSchema).min(1).max(MAX_SCRIPT_SCENES),
});

export type VideoScript = z.infer<typeof videoScriptSchema>;
export type ScriptScene = z.infer<typeof scriptSceneSchema>;

/** Kịch bản đời đầu chỉ có `lines` phẳng — đọc thành một cảnh không ảnh. */
const legacyScriptSchema = videoScriptSchema
  .omit({ scenes: true })
  .extend({ lines: z.array(z.string().min(1).max(90)).min(1).max(60) });

/** Kịch bản viết trước khi có phong cách/tag/punch: điền giá trị mặc định cho đủ schema. */
const withStyleDefaults = (raw: unknown) => {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    style: isStyleId(r.style) ? r.style : DEFAULT_STYLE,
    ...(Array.isArray(r.scenes)
      ? {
          scenes: r.scenes.map((s: Record<string, unknown>) => ({
            ...s,
            tag: s.tag ?? null,
            punch: s.punch ?? null,
          })),
        }
      : {}),
  };
};

export const parseScript = (input: unknown): VideoScript => {
  const raw = withStyleDefaults(input);
  const asScenes = videoScriptSchema.safeParse(raw);
  if (asScenes.success) {
    return asScenes.data;
  }

  const legacy = legacyScriptSchema.safeParse(raw);
  if (legacy.success) {
    const { lines, ...rest } = legacy.data;
    return { ...rest, scenes: [{ lines, image: null, visual: null, tag: null, punch: null }] };
  }

  // Báo lỗi theo schema mới — đó mới là cái người dùng nên viết.
  throw new Error(asScenes.error.message);
};

/** Mọi câu trong kịch bản, phẳng theo đúng thứ tự phát. */
export const allLines = (script: VideoScript) =>
  script.scenes.flatMap((scene) => scene.lines);

/** Narration pace used to derive caption durations from word count. */
const WORDS_PER_MINUTE = 150;
const MIN_LINE_MS = 1200;
const MAX_LINE_MS = 4500;
const GAP_MS = 150;

export const lineDurationMs = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  const raw = (words / WORDS_PER_MINUTE) * 60 * 1000;
  return Math.min(MAX_LINE_MS, Math.max(MIN_LINE_MS, Math.round(raw)));
};

export type VoiceoverClip = {
  /** staticFile() path, e.g. "voiceover/abc123/line-01.mp3" */
  src: string;
  durationMs: number;
};

export type PropsOptions = {
  startAtFrame: number;
  /** Một clip cho mỗi câu, phẳng theo thứ tự phát. Có thì timing bám theo audio. */
  voiceover?: VoiceoverClip[];
  music?: string | null;
  sfx?: boolean;
  captionPosition?: CaptionPosition;
  aspect?: string;
  /** Ghi đè phong cách trong kịch bản (người dùng chọn cụ thể thay vì "Tự động"). */
  style?: string;
};

/**
 * Mốc xuất hiện của câu nhấn: tìm câu chứa nó rồi nội suy theo vị trí ký tự trong
 * câu. TTS sinh mỗi câu một clip nên không có timestamp từng từ — nội suy theo ký
 * tự lệch vài trăm ms là cùng, đủ để chữ bật lên "đúng lúc nói tới".
 */
const punchTiming = (punch: string, sceneCaptions: Caption[], sceneStartMs: number, sceneEndMs: number) => {
  const needle = punch.toLocaleLowerCase("vi");
  for (const caption of sceneCaptions) {
    const at = caption.text.toLocaleLowerCase("vi").indexOf(needle);
    if (at >= 0) {
      const ratio = at / Math.max(1, caption.text.length);
      return Math.round(caption.startMs + ratio * (caption.endMs - caption.startMs));
    }
  }
  // Model đổi chữ so với câu gốc: hiện ở khoảng 1/3 cảnh.
  return Math.round(sceneStartMs + (sceneEndMs - sceneStartMs) * 0.33);
};

/**
 * Trải các câu của mọi cảnh lên một timeline bắt đầu sau intro.
 *
 * Cảnh chỉ gom nhóm các câu để đổi hình nền — nó KHÔNG cắt hay dịch timeline.
 * Nhờ vậy mốc thời gian của phụ đề và của voiceover luôn là frame tuyệt đối,
 * chữ và tiếng không thể lệch nhau.
 */
export const scriptToProps = (
  script: VideoScript,
  options: PropsOptions,
): ShortProps => {
  const {
    startAtFrame,
    voiceover,
    music = null,
    sfx = false,
    captionPosition = "bottom",
    aspect = "9:16",
    style,
  } = options;

  const lines = allLines(script);

  if (voiceover && voiceover.length !== lines.length) {
    throw new Error(
      `Số clip voiceover (${voiceover.length}) không khớp số câu (${lines.length}).`,
    );
  }

  let cursorMs = Math.round((startAtFrame / FPS) * 1000) + GAP_MS;
  let lineIndex = 0;

  const captions: Caption[] = [];
  const scenes: Scene[] = [];

  for (const scriptScene of script.scenes) {
    const sceneStartMs = cursorMs;

    for (const text of scriptScene.lines) {
      const clip = voiceover?.[lineIndex];
      const startMs = cursorMs;
      const endMs = startMs + (clip ? clip.durationMs : lineDurationMs(text));
      cursorMs = endMs + GAP_MS;
      lineIndex += 1;
      captions.push({ text, startMs, endMs, audio: clip ? clip.src : null });
    }

    const sceneCaptions = captions.slice(captions.length - scriptScene.lines.length);
    scenes.push({
      image: scriptScene.image,
      visual: scriptScene.visual,
      trimStartMs: 0,
      volume: 0,
      crop: null,
      ...noMotion(),
      tag: scriptScene.tag ?? null,
      punch: scriptScene.punch
        ? {
            text: scriptScene.punch,
            atMs: punchTiming(scriptScene.punch, sceneCaptions, sceneStartMs, cursorMs),
          }
        : null,
      startMs: sceneStartMs,
      // Cảnh cuối kéo dài tới hết video; các cảnh khác chạm cảnh kế tiếp.
      endMs: cursorMs,
    });
  }

  // Cảnh đầu bắt đầu từ frame 0 để hình nền có mặt ngay ở title card.
  if (scenes.length > 0) {
    scenes[0].startMs = 0;
  }

  return {
    title: script.title,
    subtitle: script.subtitle,
    handle: script.handle,
    accent: script.accent,
    background: script.background,
    captions,
    aspect,
    style: isStyleId(style) ? style : script.style ?? DEFAULT_STYLE,
    scenes,
    captionPosition,
    showTitle: true,
    voiceoverTrack: null,
    music,
    sfx,
    musicVolume: 0.5,
    voiceVolume: 1,
    audioClips: [],
    texts: [],
    overlays: [],
    watermark: null,
  };
};

/** Total frames the generated props will render to — same math as calculateShortMetadata. */
export const scriptDurationInFrames = (props: ShortProps) => {
  const lastEndMs = props.captions.reduce(
    (max, caption) => Math.max(max, caption.endMs),
    0,
  );
  return Math.round((lastEndMs / 1000) * FPS) + OUTRO_FRAMES;
};
