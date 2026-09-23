import type { CSSProperties } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { aspectFor } from "../aspects";
import type { ShortProps } from "../compositions/Short/schema";
import { FONTS } from "../styles/shared";

type Watermark = NonNullable<ShortProps["watermark"]>;

/**
 * Chỗ đặt khối chữ theo vị trí đã chọn. Năm vị trí có sẵn bám vùng an toàn của tỉ lệ khung hình để nút
 * của nền tảng không che mất; "custom" đặt tâm khối chữ đúng điểm người dùng kéo tới (% khung hình).
 */
const placement = (watermark: Watermark, width: number, height: number): CSSProperties => {
  const { safe } = aspectFor(width, height);
  const centerX: CSSProperties = { left: "50%", transform: "translateX(-50%)" };
  const middleY: CSSProperties = { top: "50%", transform: "translateY(-50%)" };
  switch (watermark.position) {
    case "top":
      return { top: safe.top, ...centerX };
    case "bottom":
      // Nửa dưới của dải đáy như 4 góc dưới bản cũ — cao hơn thì đè lên phụ đề (phụ đề nằm ngay trên dải đáy).
      return { bottom: safe.bottom * 0.5, ...centerX };
    case "center":
      return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    case "left":
      return { left: safe.side, ...middleY };
    case "right":
      return { right: safe.side, ...middleY };
    case "custom":
      return { left: `${watermark.x}%`, top: `${watermark.y}%`, transform: "translate(-50%, -50%)" };
  }
};

/** Watermark bật trong ô Cài đặt: chữ cố định suốt video, trên mọi lớp khác. */
export const WatermarkOverlay: React.FC<{ watermark: Watermark }> = ({ watermark }) => {
  const { width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          ...placement(watermark, width, height),
          maxWidth: width * 0.9,
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
