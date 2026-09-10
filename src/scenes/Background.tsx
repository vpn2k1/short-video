import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  accent: string;
  background: string;
};

/**
 * Nền gốc: màu nền + hai vệt sáng trôi chậm. Lớp dưới cùng — ảnh của cảnh
 * (nếu có) và lớp Scrim sẽ nằm đè lên trên.
 */
export const Background: React.FC<Props> = ({ accent, background }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const blobA = {
    x: 50 + Math.sin(t * 0.45) * 18,
    y: 32 + Math.cos(t * 0.32) * 12,
  };
  const blobB = {
    x: 45 + Math.cos(t * 0.28) * 22,
    y: 74 + Math.sin(t * 0.37) * 14,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {/* Tint via layer opacity, not by appending alpha to the color string —
          `accent` may be any CSS color the Studio picker produces. */}
      <AbsoluteFill
        style={{
          opacity: 0.4,
          backgroundImage: `radial-gradient(circle at ${blobA.x}% ${blobA.y}%, ${accent} 0%, transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.33,
          backgroundImage: `radial-gradient(circle at ${blobB.x}% ${blobB.y}%, #4d7cff 0%, transparent 58%)`,
        }}
      />
    </AbsoluteFill>
  );
};
