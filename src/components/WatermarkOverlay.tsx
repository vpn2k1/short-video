import { AbsoluteFill, useVideoConfig } from "remotion";
import { aspectFor } from "../aspects";
import type { ShortProps } from "../compositions/Short/schema";
import { FONTS } from "../styles/shared";

/**
 * Watermark bật trong ô Cài đặt: chữ cố định ở một góc suốt video, trên mọi lớp khác.
 * Đặt trong vùng an toàn của tỉ lệ khung hình để nút của nền tảng không che mất.
 */
export const WatermarkOverlay: React.FC<{ watermark: NonNullable<ShortProps["watermark"]> }> = ({ watermark }) => {
  const { width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  const { safe } = aspectFor(width, height);
  const [vertical, horizontal] = watermark.position.split("-") as ["top" | "bottom", "left" | "right"];

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          [vertical]: vertical === "top" ? safe.top : safe.bottom * 0.5,
          [horizontal]: safe.side,
          maxWidth: width - safe.side * 2,
          fontFamily: FONTS.sans,
          fontSize: 34 * unit,
          fontWeight: 700,
          letterSpacing: 0.5 * unit,
          color: "#ffffff",
          opacity: watermark.opacity,
          textShadow: `0 ${2 * unit}px ${6 * unit}px rgba(0, 0, 0, 0.65)`,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {watermark.text}
      </div>
    </AbsoluteFill>
  );
};
