import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useLayout } from "../shared";
import { paletteFrom } from "./theme";

/**
 * Nền game show: gradient rực từ accent, tia sáng xoay chậm (repeating-conic-gradient),
 * lưới chấm trôi chéo, vignette tối ở mép. Toàn CSS gradient — không blur, không filter.
 */
export const QuizBackground: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit, portrait } = useLayout();
  const pal = paletteFrom(accent);
  const diag = Math.hypot(width, height);
  const dot = 46 * unit;
  const drift = (frame * 0.6 * unit) % dot;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: pal.deep }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(155deg, ${pal.light} 0%, ${pal.base} 42%, ${pal.deep} 100%)`,
        }}
      />
      {/* Tia sáng xoay quanh tâm hơi lệch lên trên */}
      <div
        style={{
          position: "absolute",
          width: diag * 1.2,
          height: diag * 1.2,
          left: width / 2 - diag * 0.6,
          top: height * (portrait ? 0.36 : 0.45) - diag * 0.6,
          transform: `rotate(${frame * 0.12}deg)`,
          backgroundImage:
            "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.075) 0deg 9deg, rgba(255,255,255,0) 9deg 22.5deg)",
          maskImage: "radial-gradient(closest-side, black 0%, rgba(0,0,0,0.6) 45%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(closest-side, black 0%, rgba(0,0,0,0.6) 45%, transparent 85%)",
        }}
      />
      {/* Lưới chấm trôi chéo */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.16) ${2.6 * unit}px, transparent ${3.2 * unit}px)`,
          backgroundSize: `${dot}px ${dot}px`,
          backgroundPosition: `${drift}px ${drift}px`,
          maskImage: "linear-gradient(180deg, black 0%, rgba(0,0,0,0.35) 55%, black 100%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, rgba(0,0,0,0.35) 55%, black 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(120% 90% at 50% 40%, transparent 55%, ${pal.darker} 130%)`,
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};
