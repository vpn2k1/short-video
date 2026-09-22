import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { Grain, seeded, useLayout } from "../shared";
import { flickerAt, scareShake } from "./look";

/**
 * Sương trôi: một lớp nhiễu SVG tần số thấp (feTurbulence → kênh alpha) đung đưa ngang thật chậm,
 * dồn về đáy khung bằng mask, cộng hai mảng sương gradient mềm trôi ngược chiều. Seed cố định —
 * sương "trôi" nhờ dời vị trí chứ không đổi hình, nên không lấp lánh.
 */
export const Fog: React.FC<{ strength?: number }> = ({ strength = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const svgWidth = width * 1.5;
  const sway = Math.sin(frame * 0.0045) * width * 0.22;
  const drift = (key: string, speed: number) => Math.sin(frame * speed + seeded(key, 0, 6.28));

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: strength }}>
      <div
        style={{
          position: "absolute",
          left: -width * 0.25,
          top: 0,
          width: svgWidth,
          height,
          translate: `${-sway}px 0px`,
          opacity: 0.42,
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 10%, rgba(0,0,0,0.35) 50%, #000 92%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0) 10%, rgba(0,0,0,0.35) 50%, #000 92%)",
        }}
      >
        <svg width={svgWidth} height={height} xmlns="http://www.w3.org/2000/svg">
          <filter id="hz-fog" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={`${(0.0026 / unit).toFixed(5)} ${(0.0065 / unit).toFixed(5)}`} numOctaves={3} seed={7} />
            {/* Độ sáng nhiễu → độ đục, màu xám lục nhạt. */}
            <feColorMatrix type="matrix" values="0 0 0 0 0.72  0 0 0 0 0.8  0 0 0 0 0.77  1.9 0 0 0 -0.72" />
          </filter>
          <rect width="100%" height="100%" filter="url(#hz-fog)" />
        </svg>
      </div>
      {/* Hai mảng sương mềm trôi ngược chiều nhau. */}
      <div
        style={{
          position: "absolute",
          left: width * (0.05 + 0.12 * drift("hz-fa", 0.006)) - width * 0.4,
          top: height * 0.55,
          width: width * 1.2,
          height: height * 0.5,
          background: "radial-gradient(closest-side, rgba(170,190,182,0.2), rgba(170,190,182,0))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width * (0.35 - 0.1 * drift("hz-fb", 0.005)),
          top: height * 0.2,
          width: width * 1.1,
          height: height * 0.45,
          background: "radial-gradient(closest-side, rgba(150,172,164,0.12), rgba(150,172,164,0))",
        }}
      />
    </AbsoluteFill>
  );
};

const DUST = 34;

/** Bụi lơ lửng trong vệt sáng: chấm nhợt trôi chậm lên chéo, chập chờn sáng tối. */
export const Dust: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: DUST }, (_, i) => {
        const vx = seeded(`hz-dvx-${i}`, -0.35, 0.35) * unit;
        const vy = seeded(`hz-dvy-${i}`, -0.5, -0.12) * unit;
        const wobble = Math.sin(frame * seeded(`hz-dw-${i}`, 0.02, 0.05) + i) * 14 * unit;
        const rawX = seeded(`hz-dx-${i}`) * width + vx * frame + wobble;
        const rawY = seeded(`hz-dy-${i}`) * height + vy * frame;
        const x = ((rawX % width) + width) % width;
        const y = ((rawY % height) + height) % height;
        const size = seeded(`hz-ds-${i}`, 1.6, 4.6) * unit;
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * seeded(`hz-dt-${i}`, 0.04, 0.11) + i * 1.7));
        const near = seeded(`hz-dn-${i}`) > 0.8;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: near ? size * 1.8 : size,
              height: near ? size * 1.8 : size,
              borderRadius: "50%",
              backgroundColor: "rgba(214,224,216,0.9)",
              opacity: twinkle * (near ? 0.35 : 0.55),
              boxShadow: `0 0 ${size * 2}px rgba(200,220,210,0.5)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Vignette nặng + đèn chập chờn + hạt phim + chớp tối của cú hù. Không chạm tới chữ. */
export const Shade: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const flicker = flickerAt(frame);
  const scare = scareShake(scenes, frame, unit);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 62% at 50% 44%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 68%, rgba(0,0,0,0.94) 100%)",
        }}
      />
      {/* Đáy tối dần để phụ đề trắng ngà luôn đọc được trên ảnh sáng. */}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 78%, rgba(0,0,0,0.7) 100%)" }} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: flicker }} />
      <Grain opacity={0.2} />
      {scare.dark > 0 ? <AbsoluteFill style={{ backgroundColor: "#050000", opacity: scare.dark }} /> : null}
    </AbsoluteFill>
  );
};
