import { zColor } from "@remotion/zod-types";
import { z } from "zod";
import { ASPECT_IDS, DEFAULT_ASPECT } from "../../aspects";
import { DEFAULT_STYLE, STYLE_IDS } from "../../styles/meta";
import { FONT_IDS } from "../../fonts/catalog";
import { VIDEO_LANGUAGES } from "../../i18n/video";

/** Font phụ đề/văn bản — khoá của src/fonts/catalog.ts (font hệ thống + font đóng gói, đều có dấu tiếng Việt). */
export const CAPTION_FONTS = FONT_IDS;
/** Kiểu chữ có sẵn cho phụ đề, giống các mẫu chữ của CapCut. */
export const CAPTION_PRESETS = ["plain", "shadow", "outline", "box", "highlight", "neon", "pop3d"] as const;

/**
 * Kiểu phụ đề chỉnh trong trình chỉnh sửa. Dùng dạng partial ở hai chỗ: `captionLook` của video
 * (chung mọi câu) và `style` của từng câu (ghi đè riêng). Xem src/components/captionLook.ts.
 */
export const captionLookSchema = z.object({
  font: z.enum(CAPTION_FONTS),
  /** Cỡ chữ tính ở cạnh ngắn 1080px — tự co theo tỉ lệ khung hình. */
  size: z.number().min(16).max(240),
  weight: z.number().min(100).max(900),
  color: z.string(),
  /** Màu phụ của preset: viền, khối nền, ánh neon, bóng 3D. */
  accent: z.string(),
  preset: z.enum(CAPTION_PRESETS),
  /** Tâm khối chữ, % theo chiều ngang / dọc khung hình. */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  uppercase: z.boolean(),
  italic: z.boolean(),
  /** Bề rộng khung bọc chữ, % khung hình — chữ dài hơn thì tự xuống dòng. */
  width: z.number().min(10).max(100),
  /** Căn các dòng trong khung chữ. */
  align: z.enum(["left", "center", "right"]),
});

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  /** staticFile() path of this line's voiceover, if one was generated. */
  audio: z.string().nullable().default(null),
  /** Kiểu chữ riêng của câu này, ghi đè `captionLook` của video. Không có = theo kiểu chung. */
  style: captionLookSchema.partial().nullish(),
  /**
   * Hàng phụ đề trong trình chỉnh sửa (0 = Phụ đề 1). Nhiều hàng hiện cùng lúc, hàng sau đặt cao hơn.
   * Không có = hàng đầu tiên.
   */
  track: z.number().int().min(0).optional(),
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
  /**
   * Tốc độ phát (0.25–4, không có = 1). Thời lượng trên timeline = đoạn file dùng ÷ tốc độ; trimStartMs
   * tính theo thời gian của file gốc. Xem clipSpeed trong server/editor/ops.ts.
   */
  speed: z.number().min(0.25).max(4).optional(),
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
  /**
   * Kiểu chữ giống phụ đề tuỳ chỉnh (font, preset, màu phụ, in hoa, nghiêng). Văn bản tạo trước khi có các
   * trường này để trống — vẽ như cũ theo `background`/`shadow`. Xem textLook trong captionLook.ts.
   */
  font: z.enum(CAPTION_FONTS).nullish(),
  preset: z.enum(CAPTION_PRESETS).nullish(),
  accent: z.string().nullish(),
  italic: z.boolean().nullish(),
  uppercase: z.boolean().nullish(),
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

/**
 * Một mốc chuyển động. Dùng CHUNG cho cảnh trên track chính và lớp đè — cùng tên trường nên
 * trình chỉnh sửa dùng đúng một bộ điều khiển cho cả hai. Xem src/compositions/Short/overlayMotion.ts.
 */
export const overlayKeyframeSchema = z.object({
  /** Mốc thời gian trong video, ms. */
  atMs: z.number().min(0),
  x: z.number().min(-50).max(150),
  y: z.number().min(-50).max(150),
  width: z.number().min(2).max(400),
  rotate: z.number().min(-180).max(180),
  opacity: z.number().min(0).max(1),
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
  /**
   * Cảnh là video: tốc độ phát (0.25–4, không có = 1). Độ dài cảnh trên timeline = đoạn clip dùng ÷ tốc độ;
   * trimStartMs tính theo thời gian của clip gốc.
   */
  speed: z.number().min(0.25).max(4).optional(),
  /** Chỉ lấy một vùng của ảnh/video — chỉnh trong khung crop của trình chỉnh sửa. */
  crop: z.union([mediaCropSchema, legacyCropSchema]).nullable().default(null),
  /**
   * Vị trí / thu phóng / xoay / độ mờ của hình trong khung — cùng ý nghĩa và cùng tên trường với lớp đè
   * (xem mediaOverlaySchema) nên cảnh và lớp chỉnh bằng đúng một bộ điều khiển.
   * Giá trị mặc định (50, 50, 100, 0, 1) = vẽ y như trước khi có các trường này.
   */
  x: z.number().min(-50).max(150).default(50),
  y: z.number().min(-50).max(150).default(50),
  /** Mức thu phóng, % khung hình: 100 = đúng khung như cũ. */
  width: z.number().min(2).max(400).default(100),
  rotate: z.number().min(-180).max(180).default(0),
  opacity: z.number().min(0).max(1).default(1),
  /** Mốc chuyển động — rỗng = đứng yên theo x/y/width/rotate/opacity ở trên. */
  keyframes: z.array(overlayKeyframeSchema).default([]),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
});

/**
 * Một lớp video/ảnh chồng lên track chính (picture-in-picture kiểu CapCut).
 *
 * Khác `scenes`: cảnh nối liền nhau trên MỘT track và lấp kín khung hình, còn lớp chồng đặt
 * tự do trên timeline (nhiều lớp đè nhau được) và có khối riêng trên khung hình — kéo để dời,
 * kéo tay nắm góc để thu phóng, kéo tay nắm trên để xoay.
 */
/**
 * Một mốc chuyển động của lớp đè (keyframe): chụp lại vị trí, cỡ, góc xoay và độ mờ tại một thời điểm.
 * Chụp cả bộ thay vì từng thuộc tính riêng — dễ hiểu khi dùng và khỏi phải trộn nhiều đường cong.
 */
export const mediaOverlaySchema = z.object({
  /** staticFile() path của ảnh hoặc video, ví dụ "uploads/1234-clip.mp4". */
  src: z.string().min(1),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  /** Lớp là video: bỏ qua bao nhiêu ms đầu clip. */
  trimStartMs: z.number().min(0).default(0),
  /** Tiếng gốc của clip, 0 = tắt. Ảnh thì không dùng. */
  volume: z.number().min(0).max(1).default(0),
  /** Tốc độ phát (0.25–4, không có = 1) — như `speed` của cảnh. */
  speed: z.number().min(0.25).max(4).optional(),
  /**
   * Hàng video trên timeline: 0 là hàng ngay trên track chính, số lớn hơn nằm cao hơn và
   * VẼ TRÊN các hàng thấp hơn — hai lớp đè nhau thì hàng cao thắng.
   */
  track: z.number().int().min(0).default(0),
  /** Tâm khối, % khung hình. Cho ra ngoài một chút để kéo khối lệch khỏi khung. */
  x: z.number().min(-50).max(150).default(50),
  y: z.number().min(-50).max(150).default(50),
  /** Bề rộng khối, % chiều rộng khung hình — đây là mức thu phóng. */
  width: z.number().min(2).max(400).default(45),
  /** Tỉ lệ rộng/cao của khối. Mặc định lấy theo file nên hình không méo. */
  aspect: z.number().positive().default(16 / 9),
  rotate: z.number().min(-180).max(180).default(0),
  opacity: z.number().min(0).max(1).default(1),
  /** Bo góc khối, % cạnh ngắn của khối. */
  radius: z.number().min(0).max(50).default(0),
  /** Hình lấp đầy khối (cover — cắt bớt) hay nằm gọn trong khối (contain). */
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** Chỉ lấy một vùng của ảnh/video — cùng khung crop với cảnh. */
  crop: z.union([mediaCropSchema, legacyCropSchema]).nullable().default(null),
  /** Hiện dần ở đầu và mất dần ở cuối, ms mỗi bên. 0 = hiện/mất đột ngột. */
  fadeMs: z.number().min(0).max(4000).default(0),
  /**
   * Mốc chuyển động. Rỗng = lớp đứng yên theo x/y/width/rotate/opacity ở trên.
   * Có từ 2 mốc trở lên thì lớp chạy mượt giữa các mốc (nội suy tuyến tính); ngoài mốc đầu/cuối thì giữ nguyên.
   */
  keyframes: z.array(overlayKeyframeSchema).default([]),
});

/**
 * Giá trị chuyển động mặc định của một cảnh — hình đúng khung, không xoay, không mờ, không mốc nào.
 * Dùng khi dựng cảnh bằng code để khỏi lặp lại 6 trường ở mọi chỗ.
 */
export const noMotion = (): Pick<Scene, "x" | "y" | "width" | "rotate" | "opacity" | "keyframes"> =>
  ({ x: 50, y: 50, width: 100, rotate: 0, opacity: 1, keyframes: [] });

/** Trên / dưới / giữa / trái / phải bám vùng an toàn; "custom" = điểm người dùng kéo thả (x, y). */
export const WATERMARK_POSITIONS = ["top", "bottom", "center", "left", "right", "custom"] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

/** Chữ watermark (tên kênh, website…) cố định suốt video — nội dung và vị trí theo ô Cài đặt. */
export const watermarkSchema = z.object({
  text: z.string().min(1).max(60),
  position: z.enum(WATERMARK_POSITIONS).default("top"),
  /** Tâm khối chữ theo % bề rộng / chiều cao khung — chỉ dùng khi position = "custom". */
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(10),
  opacity: z.number().min(0.1).max(1).default(0.7),
});

export const shortSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  accent: zColor(),
  background: zColor(),
  captions: z.array(captionSchema),
  /** Tỉ lệ khung hình — quyết định width/height và vùng an toàn. */
  aspect: z.enum(ASPECT_IDS as [string, ...string[]]).default(DEFAULT_ASPECT),
  /** Phong cách hình ảnh — xem src/styles/meta.ts. Dữ liệu giống nhau, chỉ cách vẽ khác. */
  style: z.enum(STYLE_IDS).default(DEFAULT_STYLE),
  /** Ngôn ngữ nội dung — chữ in sẵn trong khung phong cách theo ngôn ngữ này (src/i18n/video.tsx). */
  language: z.enum(VIDEO_LANGUAGES).default("vi"),
  // Có default để props.json sinh trước khi thêm cảnh vẫn render được.
  scenes: z.array(sceneSchema).default([]),
  /**
   * Các lớp video/ảnh chồng lên track chính — thêm và chỉnh trong trình chỉnh sửa.
   * Nhiều lớp đè nhau được; hàng (`track`) cao vẽ trên.
   */
  overlays: z.array(mediaOverlaySchema).default([]),
  /** Vị trí phụ đề: đáy màn hình hay chính giữa. */
  captionPosition: z.enum(["bottom", "center"]).default("bottom"),
  /**
   * Kiểu phụ đề tuỳ chỉnh chung cho mọi câu (font, màu, preset, vị trí). Có giá trị — hoặc có câu mang
   * `style` riêng — thì composition tự vẽ phụ đề thay cho phụ đề của phong cách. Không có = theo phong cách.
   */
  captionLook: captionLookSchema.partial().nullish(),
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
  /**
   * Avatar của phong cách Story (vòng tròn đầu story): ảnh đại diện kênh (đường dẫn trong public/) và màu nền của chữ
   * "S" khi không có ảnh. null / trường null = mặc định (chữ "S" trên màu nhấn của video).
   * Như watermark: server gắn theo ô Cài đặt lúc render/xem trước (scripts/watermark.ts), props.json để null.
   */
  avatar: z
    .object({ image: z.string().nullable(), background: zColor().nullable() })
    .nullable()
    .default(null),
});

export type Caption = z.infer<typeof captionSchema>;
export type CaptionLook = z.infer<typeof captionLookSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneVisual = z.infer<typeof sceneVisualSchema>;
export type ScenePunch = z.infer<typeof scenePunchSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type MediaOverlay = z.infer<typeof mediaOverlaySchema>;
export type OverlayKeyframe = z.infer<typeof overlayKeyframeSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;
export type SceneCrop = NonNullable<Scene["crop"]>;
export type CaptionPosition = ShortProps["captionPosition"];
export type ShortProps = z.infer<typeof shortSchema>;
