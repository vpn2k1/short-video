import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames } from "../constants";
import type { TextOverlay } from "../compositions/Short/schema";
import { captionDisplayText, textLook } from "./captionLook";
import { captionTextStyle } from "./CustomCaptions";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Chữ tự do thêm trong trình chỉnh sửa. Lớp trên cùng, không phụ thuộc phong cách,
 * nên cùng một lúc có thể hiện nhiều chữ ở nhiều vị trí. Kiểu chữ (font, preset, căn, bề rộng khung)
 * dùng chung với phụ đề tuỳ chỉnh — xem captionLook.ts.
 */
export const TextOverlays: React.FC<{ texts: TextOverlay[] }> = ({ texts }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {texts.map((t, i) => {
        const start = msToFrames(t.startMs);
        const end = Math.max(start + 1, msToFrames(t.endMs));
        if (frame < start || frame >= end || !t.text.trim()) return null;
        const local = frame - start;

        const enter =
          t.animation === "pop"
            ? spring({ frame: local, fps, config: { damping: 12, mass: 0.5 } })
            : t.animation === "fade" || t.animation === "slide"
              ? interpolate(local, [0, 8], [0, 1], clamp)
              : 1;
        // Mờ dần 6 frame cuối — chữ quá ngắn thì bỏ để dãy mốc interpolate luôn tăng.
        const exitFrames = Math.min(6, Math.floor((end - start) / 3));
        const exit = exitFrames > 0 ? interpolate(frame, [end - exitFrames, end], [1, 0], clamp) : 1;

        let transform = "translate(-50%, -50%)";
        if (t.animation === "pop") transform += ` scale(${0.7 + 0.3 * enter})`;
        if (t.animation === "slide") transform += ` translateY(${((1 - enter) * 40 * unit).toFixed(1)}px)`;

        const look = textLook(t);
        const full = captionDisplayText(t.text, look);
        const chars = Array.from(full);
        const shown =
          t.animation === "typewriter"
            ? chars.slice(0, Math.ceil(interpolate(local, [0, Math.max(1, chars.length * 1.2)], [0, chars.length], clamp))).join("")
            : full;
        const fontSize = look.size * unit;
        const textStyle = captionTextStyle(look, fontSize);
        const perLine = look.preset === "highlight";

        return (
          <div
            key={`text-${i}`}
            style={{
              position: "absolute",
              left: `${t.x}%`,
              top: `${t.y}%`,
              transform,
              opacity: Math.min(1, t.animation === "pop" ? enter * 1.5 : enter) * exit,
              width: "max-content",
              maxWidth: `${look.width}%`,
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              textAlign: look.align,
              ...(perLine ? { fontSize, lineHeight: 1.5 } : textStyle),
            }}
          >
            {perLine ? <span style={textStyle}>{shown}</span> : shown}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
