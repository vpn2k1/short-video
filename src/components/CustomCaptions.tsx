import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames } from "../constants";
import type { Caption, CaptionLook, ShortProps } from "../compositions/Short/schema";
import { FONTS } from "../styles/shared";
import { fontInfo } from "../fonts/catalog";
import { activeCaptionIndices, captionDisplayText, resolveCaptionLook } from "./captionLook";

/** Viền chữ bằng một vòng text-shadow — -webkit-text-stroke ăn vào nét và làm dính dấu tiếng Việt. */
const ring = (width: number, color: string) =>
  Array.from({ length: 16 }, (_, k) => {
    const angle = (k / 16) * Math.PI * 2;
    return `${(Math.cos(angle) * width).toFixed(3)}em ${(Math.sin(angle) * width).toFixed(3)}em 0 ${color}`;
  }).join(", ");

/**
 * Kiểu CSS của chữ theo preset. `fontSize` tính sẵn theo khung (px). Dùng chung cho video và khung
 * kéo thả trong trình chỉnh sửa để khung khớp chữ.
 */
export const captionTextStyle = (look: CaptionLook, fontSize: number): React.CSSProperties => {
  const base: React.CSSProperties = {
    fontFamily: FONTS[look.font],
    // Font một độ đậm (Anton, Pacifico…): không tự làm đậm giả — nét dày lên sẽ dính dấu tiếng Việt.
    ...(fontInfo(look.font).singleWeight ? { fontSynthesis: "none" } : {}),
    fontSize,
    fontWeight: look.weight,
    fontStyle: look.italic ? "italic" : "normal",
    color: look.color,
    lineHeight: 1.25,
  };
  const accent = look.accent;
  switch (look.preset) {
    case "shadow":
      return { ...base, textShadow: "0 0.06em 0.3em rgba(0,0,0,0.75), 0 0 0.06em rgba(0,0,0,0.9)" };
    case "outline":
      return { ...base, textShadow: ring(0.07, accent) };
    case "box":
      return { ...base, backgroundColor: accent, padding: "0.14em 0.5em", borderRadius: "0.22em" };
    case "highlight":
      // Nền ôm từng dòng (áp cho span bên trong) — box-decoration-break để dòng nào cũng có mép bo.
      return {
        ...base,
        backgroundColor: accent,
        padding: "0.04em 0.3em",
        borderRadius: "0.16em",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      };
    case "neon":
      return { ...base, textShadow: `0 0 0.06em ${accent}, 0 0 0.22em ${accent}, 0 0 0.55em ${accent}` };
    case "pop3d":
      return { ...base, textShadow: `0.04em 0.04em 0 ${accent}, 0.08em 0.08em 0 ${accent}, 0.12em 0.12em 0.2em rgba(0,0,0,0.45)` };
    default:
      return base;
  }
};

/** Một câu phụ đề tuỳ chỉnh: vị trí, khung chữ, kiểu chữ, bật nhẹ khi xuất hiện. */
const CaptionLine: React.FC<{ props: ShortProps; caption: Caption }> = ({ props, caption }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;

  const look = resolveCaptionLook(props, caption);
  const enter = spring({ frame: frame - msToFrames(caption.startMs), fps, config: { damping: 14, mass: 0.5 } });
  const fontSize = look.size * unit;
  const textStyle = captionTextStyle(look, fontSize);
  const text = captionDisplayText(caption.text, look);
  const perLine = look.preset === "highlight";

  return (
    <div
      style={{
        position: "absolute",
        left: `${look.x}%`,
        top: `${look.y}%`,
        transform: `translate(-50%, -50%) scale(${(0.92 + 0.08 * enter).toFixed(4)})`,
        opacity: Math.min(1, enter * 1.6),
        width: "max-content",
        maxWidth: `${look.width}%`,
        textAlign: look.align,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        ...(perLine ? { fontSize, lineHeight: 1.5 } : textStyle),
      }}
    >
      {perLine ? <span style={textStyle}>{text}</span> : text}
    </div>
  );
};

/**
 * Phụ đề tuỳ chỉnh (font, màu, preset, vị trí từng câu) — vẽ thay cho phụ đề của phong cách khi video
 * có `captionLook`, câu mang `style` riêng, hoặc có nhiều hàng phụ đề. Mỗi hàng hiện câu đang phát của
 * hàng đó trong đúng [startMs, endMs): tắt trong khoảng lặng.
 */
export const CustomCaptions: React.FC<{ props: ShortProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const indices = activeCaptionIndices(
    props.captions,
    (c) => frame >= msToFrames(c.startMs) && frame < Math.max(msToFrames(c.startMs) + 1, msToFrames(c.endMs)),
  );
  if (indices.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {indices.map((index) => (
        <CaptionLine key={`caption-${index}`} props={props} caption={props.captions[index]} />
      ))}
    </AbsoluteFill>
  );
};
