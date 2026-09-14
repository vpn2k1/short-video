import { zColor } from "@remotion/zod-types";
import { z } from "zod";
import { ASPECT_IDS, DEFAULT_ASPECT } from "../../aspects";
import { DEFAULT_STYLE, STYLE_IDS } from "../../styles/meta";

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

/** Câu nhấn của cảnh và thời điểm (ms tuyệt đối) nó xuất hiện — bám theo lời đọc. */
export const scenePunchSchema = z.object({
  text: z.string().min(1),
  atMs: z.number().min(0),
});

/**
 * Một đoạn âm thanh người dùng thêm trong trình chỉnh sửa: nhạc, hiệu ứng, file thu sẵn.
 * Nằm trên timeline tuyệt đối như caption — không phụ thuộc cảnh.
 */
export const audioClipSchema = z.object({
  /** staticFile() path, ví dụ "uploads/1234-nhac.mp3" hoặc "sfx/whoosh.mp3". */
  src: z.string().min(1),
  startMs: z.number().min(0),
  /** Bỏ qua bao nhiêu ms đầu của file. */
  trimStartMs: z.number().min(0).default(0),
  /** Thời lượng phát (sau khi cắt đầu). */
  durationMs: z.number().min(1),
  volume: z.number().min(0).max(2).default(1),
  label: z.string().nullable().default(null),
});

/**
 * Chữ tự do đặt ở vị trí bất kỳ — nhiều chữ hiện cùng lúc ở nhiều chỗ, độc lập với
 * phụ đề và cảnh. Vẽ trên cùng, áp dụng cho mọi phong cách.
 */
export const textOverlaySchema = z.object({
  /** Có thể nhiều dòng (xuống dòng bằng \n). */
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  /** Tâm của khối chữ, % theo chiều ngang / dọc khung hình. */
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(30),
  /** Cỡ chữ tính ở cạnh ngắn 1080px — tự co theo tỉ lệ khung hình. */
  size: z.number().min(12).max(400).default(72),
  color: z.string().default("#ffffff"),
  /** Màu khối nền sau chữ; null = không có khối. */
  background: z.string().nullable().default(null),
  weight: z.number().min(100).max(900).default(800),
  align: z.enum(["left", "center", "right"]).default("center"),
  /** Bề rộng tối đa, % khung hình — chữ dài tự xuống dòng. */
  maxWidth: z.number().min(10).max(100).default(80),
  shadow: z.boolean().default(true),
  animation: z.enum(["none", "fade", "pop", "slide", "typewriter"]).default("pop"),
  /** Hàng trên timeline của trình chỉnh sửa — không ảnh hưởng hình. */
  track: z.number().int().min(0).default(0),
});

/**
 * Crop kiểu CapCut: vùng [x, x+w] × [y, y+h] tính theo ẢNH/VIDEO GỐC (0–1), xoay/lật
 * vùng đó rồi lấp đầy (cover) hoặc vừa (contain) khung chứa. Xem src/scenes/CropBox.tsx.
 */
export const mediaCropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.02).max(1),
  h: z.number().min(0.02).max(1),
  /** Tỉ lệ rộng/cao của file gốc — lưu lúc crop để render không phải đọc kích thước file. */
  mediaAspect: z.number().positive(),
  /** Tỉ lệ đã chọn trong khung crop ("free", "frame", "original", "9:16"…) — để mở lại đúng lựa chọn. */
  ratio: z.string().default("free"),
  /** Độ xoay, chiều kim đồng hồ. */
  rotate: z.number().min(-180).max(180).default(0),
  flipH: z.boolean().default(false),
  flipV: z.boolean().default(false),
  fit: z.enum(["cover", "contain"]).default("cover"),
});

/**
 * Crop đời đầu: vùng vuông tính theo KHUNG CHỨA, x/y góc trên trái, size = rộng = cao.
 * Vẫn đọc và vẽ như cũ để video đã crop không đổi; mở khung crop là chuyển sang kiểu mới.
 */
export const legacyCropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().min(0.05).max(1),
});

/** Một cảnh: khoảng thời gian dùng chung một hình nền. */
export const sceneSchema = z.object({
  /** staticFile() path của ảnh, hoặc null để chỉ dùng nền gradient. */
  image: z.string().nullable(),
  /** Hình vẽ bằng code, chồng lên ảnh (nếu có). */
  visual: sceneVisualSchema.nullable().default(null),
  /** Nhãn ngắn hiện suốt cảnh (năm, con số, địa danh…). Phong cách tự quyết cách vẽ. */
  tag: z.string().nullable().default(null),
  /** Một cụm từ đắt nhất của cảnh, hiện đúng lúc giọng đọc tới nó. */
  punch: scenePunchSchema.nullable().default(null),
  /** Cảnh là video: bỏ qua bao nhiêu ms đầu clip (cắt đầu trong trình chỉnh sửa). */
  trimStartMs: z.number().min(0).default(0),
  /** Âm lượng tiếng gốc của clip video, 0 = tắt tiếng (mặc định — giọng đọc là chính). */
  volume: z.number().min(0).max(1).default(0),
  /** Chỉ lấy một vùng của ảnh/video — chỉnh trong khung crop của trình chỉnh sửa. */
  crop: z.union([mediaCropSchema, legacyCropSchema]).nullable().default(null),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
});

export const WATERMARK_POSITIONS = ["top-right", "top-left", "bottom-right", "bottom-left"] as const;

/** Chữ watermark cố định ở một góc suốt video. */
export const watermarkSchema = z.object({
  text: z.string().min(1).max(60),
  position: z.enum(WATERMARK_POSITIONS).default("top-right"),
  opacity: z.number().min(0.1).max(1).default(0.7),
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
  /** Phong cách hình ảnh — xem src/styles/meta.ts. Dữ liệu giống nhau, chỉ cách vẽ khác. */
  style: z.enum(STYLE_IDS).default(DEFAULT_STYLE),
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
  /** Âm lượng nhạc nền khi không có giọng (vẫn tự hạ khi có giọng đọc). */
  musicVolume: z.number().min(0).max(1).default(0.5),
  /** Hệ số âm lượng giọng đọc. */
  voiceVolume: z.number().min(0).max(2).default(1),
  /** Âm thanh thêm tay trong trình chỉnh sửa. */
  audioClips: z.array(audioClipSchema).default([]),
  /** Chữ tự do thêm trong trình chỉnh sửa. */
  texts: z.array(textOverlaySchema).default([]),
  /**
   * Watermark. Server gắn theo ô Cài đặt lúc render/xem trước (scripts/watermark.ts),
   * nên props.json đã lưu thường để null.
   */
  watermark: watermarkSchema.nullable().default(null),
});

export type Caption = z.infer<typeof captionSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneVisual = z.infer<typeof sceneVisualSchema>;
export type ScenePunch = z.infer<typeof scenePunchSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;
export type SceneCrop = NonNullable<Scene["crop"]>;
export type CaptionPosition = ShortProps["captionPosition"];
export type ShortProps = z.infer<typeof shortSchema>;
