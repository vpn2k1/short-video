/**
 * Kiểu phụ đề tuỳ chỉnh (kiểu CapCut): giá trị mặc định, nhãn cho giao diện, mẫu nhanh và cách tính kiểu
 * cuối cùng của một câu. File thuần dữ liệu — composition và trình chỉnh sửa dùng chung.
 *
 * Kiểu cuối cùng = mặc định ← `captionLook` của video (chung) ← `style` của câu (riêng).
 */
import type { Caption, CaptionLook, ShortProps, TextOverlay } from "../compositions/Short/schema";

export const DEFAULT_CAPTION_LOOK: CaptionLook = {
  font: "sans",
  size: 64,
  weight: 800,
  color: "#ffffff",
  accent: "#000000",
  preset: "outline",
  x: 50,
  y: 80,
  uppercase: false,
  italic: false,
  width: 86,
  align: "center",
};

/**
 * Kiểu của một văn bản tự do, cùng dạng với phụ đề để dùng chung bảng chỉnh và cách vẽ.
 * Văn bản cũ chưa có preset: suy từ `background` (nền khối) / `shadow` (bóng mờ) như cách vẽ trước đây.
 */
export const textLook = (t: TextOverlay): CaptionLook => ({
  font: t.font ?? "sans",
  size: t.size,
  weight: t.weight,
  color: t.color,
  accent: t.accent ?? t.background ?? "#000000",
  preset: t.preset ?? (t.background ? "box" : t.shadow ? "shadow" : "plain"),
  x: t.x,
  y: t.y,
  uppercase: t.uppercase ?? false,
  italic: t.italic ?? false,
  width: t.maxWidth,
  align: t.align,
});

/** Đổi phần kiểu (dạng phụ đề) thành trường của văn bản tự do: `width` ↔ `maxWidth`. */
export const textPatch = (patch: Partial<CaptionLook>): Partial<TextOverlay> => {
  const { width, ...rest } = patch;
  return { ...rest, ...(width !== undefined ? { maxWidth: width } : {}) };
};

export const CAPTION_FONT_LABELS: Record<CaptionLook["font"], string> = {
  sans: "Hệ thống",
  rounded: "Tròn",
  serif: "Có chân",
  mono: "Máy chữ",
  condensed: "Hẹp",
};

export const CAPTION_PRESET_LABELS: Record<CaptionLook["preset"], string> = {
  plain: "Thường",
  shadow: "Bóng mờ",
  outline: "Viền",
  box: "Nền khối",
  highlight: "Nền theo dòng",
  neon: "Neon",
  pop3d: "3D",
};

/** Mẫu nhanh: một cú bấm đổi cả preset, màu chữ, màu phụ, độ đậm. */
export const CAPTION_TEMPLATES: { label: string; look: Partial<CaptionLook> }[] = [
  { label: "Trắng viền đen", look: { preset: "outline", color: "#ffffff", accent: "#000000", weight: 800 } },
  { label: "Vàng viền đen", look: { preset: "outline", color: "#ffd400", accent: "#000000", weight: 900 } },
  { label: "Nền đen", look: { preset: "box", color: "#ffffff", accent: "#000000", weight: 700 } },
  { label: "Nền vàng", look: { preset: "highlight", color: "#111111", accent: "#ffd400", weight: 800 } },
  { label: "Bóng mờ", look: { preset: "shadow", color: "#ffffff", accent: "#000000", weight: 700 } },
  { label: "Neon hồng", look: { preset: "neon", color: "#ffffff", accent: "#ff2e97", weight: 800 } },
  { label: "Neon xanh", look: { preset: "neon", color: "#e6fdff", accent: "#00d1ff", weight: 800 } },
  { label: "3D đỏ", look: { preset: "pop3d", color: "#ffffff", accent: "#e11d48", weight: 900 } },
];

/**
 * Phong cách dùng phụ đề làm NỘI DUNG (bong bóng chat, thẻ bài đăng, câu hỏi, bảng xếp hạng) — thay
 * bằng phụ đề tuỳ chỉnh sẽ hỏng bố cục, nên ở các phong cách này kiểu tuỳ chỉnh không áp dụng.
 */
export const CONTENT_CAPTION_STYLES = new Set(["chat", "social", "quiz", "ranking"]);

export const canCustomizeCaptions = (style: string) => !CONTENT_CAPTION_STYLES.has(style);

/** Hàng phụ đề của một câu (0 = Phụ đề 1). */
export const captionTrack = (caption: Pick<Caption, "track">) => caption.track ?? 0;

/** Mỗi hàng phụ đề sau đặt cao hơn hàng trước chừng này % khung — hai hàng hiện cùng lúc không chồng lên nhau. */
export const CAPTION_TRACK_GAP = 12;

/**
 * Video đang dùng phụ đề tuỳ chỉnh: có kiểu chung, có câu mang kiểu riêng, hoặc có từ hai hàng phụ đề
 * (phụ đề của phong cách chỉ vẽ được một câu mỗi lúc).
 */
export const usesCustomCaptions = (p: Pick<ShortProps, "style" | "captionLook" | "captions">) =>
  canCustomizeCaptions(p.style) &&
  (p.captionLook != null || p.captions.some((c) => c.style != null || captionTrack(c) > 0));

/** Kiểu cuối cùng của một câu. Câu ở hàng sau chưa có vị trí dọc riêng thì tự đặt cao hơn theo hàng. */
export const resolveCaptionLook = (
  p: Pick<ShortProps, "captionLook" | "captionPosition">,
  caption: Pick<Caption, "style" | "track"> | null,
): CaptionLook => {
  const look: CaptionLook = {
    ...DEFAULT_CAPTION_LOOK,
    ...(p.captionPosition === "center" ? { y: 50 } : {}),
    ...(p.captionLook ?? {}),
    ...(caption?.style ?? {}),
  };
  const track = caption ? captionTrack(caption) : 0;
  if (track > 0 && caption?.style?.y === undefined) look.y = Math.max(0, look.y - track * CAPTION_TRACK_GAP);
  return look;
};

/** Câu đang hiện của từng hàng (mỗi hàng tối đa một câu — câu bắt đầu sau cùng thắng). */
export const activeCaptionIndices = (captions: Caption[], isActive: (caption: Caption) => boolean) => {
  const byTrack = new Map<number, number>();
  captions.forEach((caption, index) => {
    if (isActive(caption) && caption.text.trim()) {
      const current = byTrack.get(captionTrack(caption));
      if (current === undefined || captions[current].startMs <= caption.startMs) byTrack.set(captionTrack(caption), index);
    }
  });
  return [...byTrack.values()];
};

/** Chữ hiển thị: in hoa bằng JS theo quy tắc tiếng Việt — CSS text-transform làm lệch móc Ư/Ơ. */
export const captionDisplayText = (text: string, look: CaptionLook) =>
  look.uppercase ? text.normalize("NFC").toLocaleUpperCase("vi") : text;
