import { zColor } from "@remotion/zod-types";
import { z } from "zod";
import { ASPECT_IDS, DEFAULT_ASPECT } from "../../aspects";

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  /** staticFile() path of this line's voiceover, if one was generated. */
  audio: z.string().nullable().default(null),
});

/**
 * Hình vẽ bằng code cho một cảnh — không cần file ảnh nào.
 * "badge" là nhãn bước ("BƯỚC 1"), "stat" là con số lớn ("50%").
 */
export const sceneVisualSchema = z.object({
  type: z.enum(["badge", "stat"]),
  text: z.string().min(1).max(16),
  caption: z.string().min(1).max(40).nullable(),
});

/** Một cảnh: khoảng thời gian dùng chung một hình nền. */
export const sceneSchema = z.object({
  /** staticFile() path của ảnh, hoặc null để chỉ dùng nền gradient. */
  image: z.string().nullable(),
  /** Hình vẽ bằng code, chồng lên ảnh (nếu có). */
  visual: sceneVisualSchema.nullable().default(null),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
});

export const shortSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  handle: z.string(),
  accent: zColor(),
  background: zColor(),
  captions: z.array(captionSchema),
  /** Tỉ lệ khung hình — quyết định width/height và vùng an toàn. */
  aspect: z.enum(ASPECT_IDS as [string, ...string[]]).default(DEFAULT_ASPECT),
  // Có default để props.json sinh trước khi thêm cảnh vẫn render được.
  scenes: z.array(sceneSchema).default([]),
  /** Vị trí phụ đề: đáy màn hình hay chính giữa. */
  captionPosition: z.enum(["bottom", "center"]).default("bottom"),
  /**
   * Hiện title card ở đầu video. Tắt khi audio có sẵn bắt đầu nói ngay từ giây 0 —
   * lúc đó title card sẽ đè lên chính câu đầu tiên.
   */
  showTitle: z.boolean().default(true),
  /**
   * Một file voiceover cho TOÀN BỘ video — dùng khi audio là bản thu sẵn.
   * Khác với caption.audio (mỗi câu một file, dùng khi sinh bằng TTS).
   */
  voiceoverTrack: z.string().nullable().default(null),
  /** staticFile() path of the background music bed, or null for no music. */
  music: z.string().nullable().default(null),
  /** Play a whoosh on every caption change. */
  sfx: z.boolean().default(false),
});

export type Caption = z.infer<typeof captionSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneVisual = z.infer<typeof sceneVisualSchema>;
export type CaptionPosition = ShortProps["captionPosition"];
export type ShortProps = z.infer<typeof shortSchema>;
