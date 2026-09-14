import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Grain, useLayout } from "../shared";
import { CYAN, VIOLET, withAlpha } from "./theme";

/**
 * Nền: gradient navy gần đen, ma trận chấm trôi chậm, sàn lưới phối cảnh,
 * hai quả cầu sáng. Không dùng filter blur — quầng sáng là radial-gradient tĩnh
 * nên render nhanh.
 */
export const TechBackground: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const t = frame / 30;
  const cell = Math.round(56 * unit);
  const gridCell = Math.round(120 * unit);
  const orbA = Math.max(width, height) * 0.42;
  const orbB = Math.max(width, height) * 0.38;

  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          "radial-gradient(120% 90% at 50% 18%, #0e1a36 0%, #070c1c 48%, #03050c 100%)",
        overflow: "hidden",
      }}
    >
      {/* Quả cầu sáng theo accent, trôi chậm quanh góc trên trái */}
      <div
        style={{
          position: "absolute",
          width: orbA * 2,
          height: orbA * 2,
          left: width * (0.18 + 0.05 * Math.sin(t * 0.35)) - orbA,
          top: height * (0.22 + 0.04 * Math.cos(t * 0.28)) - orbA,
          borderRadius: "50%",
          backgroundImage: `radial-gradient(circle, ${withAlpha(accent, 0.3)} 0%, ${withAlpha(accent, 0.1)} 32%, transparent 68%)`,
        }}
      />
      {/* Quả cầu cyan/tím phía dưới phải */}
      <div
        style={{
          position: "absolute",
          width: orbB * 2,
          height: orbB * 2,
          left: width * (0.82 + 0.04 * Math.cos(t * 0.31)) - orbB,
          top: height * (0.72 + 0.05 * Math.sin(t * 0.25)) - orbB,
          borderRadius: "50%",
          backgroundImage: `radial-gradient(circle, ${withAlpha(CYAN, 0.2)} 0%, ${withAlpha(VIOLET, 0.12)} 34%, transparent 68%)`,
        }}
      />

      {/* Ma trận chấm, mờ dần ra rìa */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, rgba(160,190,255,0.22) ${1.3 * unit}px, transparent ${1.9 * unit}px)`,
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: `${-(frame * 0.4 * unit) % cell}px ${-(frame * 0.25 * unit) % cell}px`,
          maskImage: "radial-gradient(ellipse 75% 60% at 50% 40%, black 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 60% at 50% 40%, black 10%, transparent 75%)",
        }}
      />

      {/* Sàn lưới phối cảnh ở nửa dưới */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.42,
          perspective: 700 * unit,
          perspectiveOrigin: "50% 0%",
          overflow: "hidden",
          maskImage: "linear-gradient(180deg, transparent 0%, black 55%, black 100%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 55%, black 100%)",
          opacity: 0.55,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -width,
            width: width * 3,
            top: 0,
            height: height * 1.6,
            transformOrigin: "50% 0%",
            transform: "rotateX(72deg)",
            backgroundImage: `linear-gradient(${withAlpha(CYAN, 0.35)} ${Math.max(1, unit * 1.5)}px, transparent ${Math.max(1, unit * 1.5)}px), linear-gradient(90deg, ${withAlpha(CYAN, 0.28)} ${Math.max(1, unit * 1.5)}px, transparent ${Math.max(1, unit * 1.5)}px)`,
            backgroundSize: `${gridCell}px ${gridCell}px`,
            backgroundPosition: `0px ${(frame * 1.2 * unit) % gridCell}px`,
          }}
        />
      </div>

      {/* Viền tối để mắt dồn vào giữa */}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
