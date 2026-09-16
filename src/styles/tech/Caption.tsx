import { useCurrentFrame } from "remotion";
import type { Caption } from "../../compositions/Short/schema";
import { FONTS, useCaptionClock, useLayout } from "../shared";
import { CYAN, INK, ramp } from "./theme";

type Props = {
  captions: Caption[];
  fontSize: number;
  padX: number;
  padY: number;
  align: "center" | "left";
  /** Ẩn phụ đề trước frame này (title card đang chiếm màn hình). */
  hideBefore: number;
};

/**
 * Phụ đề trong viên kính. Chữ sáng dần theo tiến độ đọc (ước theo số ký tự),
 * từ đang đọc ánh cyan; một vạch mảnh ở đáy viên chạy theo thời lượng câu.
 */
export const TechCaption: React.FC<Props> = ({ captions, fontSize, padX, padY, align, hideBefore }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const { index, caption, localFrame, durationFrames } = useCaptionClock(captions);
  if (!caption || frame < hideBefore || !caption.text.trim()) return null;

  const enter = ramp(localFrame, 0, 8);
  // Kết thúc sáng chữ trước khi câu hết một chút cho khớp nhịp đọc.
  const progress = Math.min(1, Math.max(0, localFrame / Math.max(1, durationFrames * 0.9)));
  const words = caption.text.trim().split(/\s+/);
  const total = words.reduce((sum, w) => sum + [...w].length + 1, 0);
  let before = 0;

  return (
    <div
      key={index}
      style={{
        position: "relative",
        maxWidth: "100%",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16 * unit}px)`,
        padding: `${padY}px ${padX}px`,
        boxSizing: "border-box",
        borderRadius: 30 * unit,
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
        backgroundColor: "rgba(6,11,26,0.72)",
        border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.14)`,
        boxShadow: `inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.14), 0 ${20 * unit}px ${40 * unit}px -${16 * unit}px rgba(0,0,0,0.7)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize,
          fontWeight: 600,
          lineHeight: 1.3,
          textAlign: align,
          color: INK,
          overflowWrap: "break-word",
        }}
      >
        {words.map((word, i) => {
          const len = [...word].length + 1;
          const lit = Math.min(1, Math.max(0, (progress - before / total) / (len / total)));
          before += len;
          const active = lit > 0 && lit < 1;
          return (
            <span
              key={i}
              style={{
                opacity: 0.4 + 0.6 * lit,
                color: active ? "#c8f7ff" : INK,
                textShadow: active ? `0 0 ${16 * unit}px rgba(34,211,238,0.65)` : "none",
              }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: Math.max(1, 3 * unit),
          width: `${progress * 100}%`,
          backgroundImage: `linear-gradient(90deg, transparent, ${CYAN})`,
        }}
      />
    </div>
  );
};
