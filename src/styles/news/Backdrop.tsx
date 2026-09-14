import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { Scenes } from "../../scenes/Scenes";
import { seeded, useLayout } from "../shared";
import { NAVY, NAVY_DEEP, withAlpha } from "./theme";

/**
 * Trường quay ảo khi cảnh không có ảnh: navy sâu, lưới mảnh trôi chậm, vệt sáng chéo
 * quét ngang, vòng tròn đồng tâm mờ. Không dùng filter blur — chỉ gradient.
 */
const Studio: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const cell = Math.round(64 * unit);
  const ringR = Math.max(width, height) * 0.36;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: NAVY,
        backgroundImage: `radial-gradient(110% 70% at 28% 18%, #1c3a7a 0%, ${NAVY} 46%, ${NAVY_DEEP} 100%)`,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(60% 45% at 15% 95%, ${withAlpha(accent, 0.28)} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(140,180,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(140,180,255,0.07) 1px, transparent 1px)",
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: `${-(frame * 0.5 * unit) % cell}px 0px`,
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={`ring-${i}`}
          style={{
            position: "absolute",
            width: ringR * 2 * (0.55 + i * 0.25),
            height: ringR * 2 * (0.55 + i * 0.25),
            left: width * 0.78 - ringR * (0.55 + i * 0.25),
            top: height * 0.38 - ringR * (0.55 + i * 0.25),
            borderRadius: "50%",
            border: `${Math.max(1, 2 * unit)}px dashed rgba(160,200,255,${0.1 - i * 0.025})`,
            transform: `rotate(${frame * (i % 2 === 0 ? 0.25 : -0.18)}deg)`,
          }}
        />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const bandW = seeded(`news-streak-w-${i}`, 120, 280) * unit;
        const speed = seeded(`news-streak-v-${i}`, 3, 7) * unit;
        const span = width + height + bandW * 2;
        const x = ((seeded(`news-streak-x-${i}`, 0, span) + frame * speed) % span) - height * 0.5 - bandW;
        return (
          <div
            key={`streak-${i}`}
            style={{
              position: "absolute",
              top: -height * 0.25,
              left: x,
              width: bandW,
              height: height * 1.5,
              transform: "rotate(22deg)",
              backgroundImage: `linear-gradient(90deg, transparent 0%, rgba(190,220,255,${seeded(`news-streak-a-${i}`, 0.05, 0.11)}) 50%, transparent 100%)`,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Hình của mọi cảnh (ảnh/video toàn khung, Ken Burns, cross-fade) trên nền trường quay. */
export const Backdrop: React.FC<{ scenes: Scene[]; accent: string }> = ({ scenes, accent }) => (
  <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
    <Studio accent={accent} />
    <Scenes scenes={scenes} />
    {/* Tối trên cho logo/đồng hồ, tối dưới cho dải tin đọc được */}
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 45%, rgba(3,8,22,0.55) 68%, rgba(3,8,22,0.88) 100%)",
      }}
    />
  </AbsoluteFill>
);
