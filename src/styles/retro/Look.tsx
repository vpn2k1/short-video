import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { Grain, seeded, useLayout } from "../shared";
import { Static } from "./Noise";
import { burstAt, glitchAt } from "./vhs";

/** Chu kỳ dải nhiễu tracking cuộn từ trên xuống (frame). */
const TRACKING_PERIOD = 300;

/**
 * Lớp "băng từ" phủ trên cùng: scanline, dải tracking cuộn xuống, hạt, vignette bo góc
 * CRT, vệt giật 1–2 frame và cú nhiễu trắng ở điểm cắt cảnh / cuối title.
 * Không có filter động toàn khung — chỉ gradient, nhiễu SVG và khối màu.
 */
export const VhsLook: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const { unit, height } = useLayout();

  // Scanline: số nguyên pixel để không sinh vân moiré.
  const line = Math.max(1, Math.round(1.2 * unit));
  const period = Math.max(2, Math.round(3 * unit));

  const bandHeight = height * 0.075;
  const cycle = (frame % TRACKING_PERIOD) / TRACKING_PERIOD;
  const bandTop = -bandHeight * 1.5 + cycle * (height + bandHeight * 3);

  const glitch = glitchAt(frame);
  const burst = burstAt(frame, scenes, showTitle);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Scanline */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(180deg, rgba(0,0,0,0.26) 0px, rgba(0,0,0,0.26) ${line}px, rgba(0,0,0,0) ${line}px, rgba(0,0,0,0) ${period}px)`,
        }}
      />

      {/* Dải tracking: vệt sáng rè ngang trôi chậm xuống */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: bandTop,
          height: bandHeight,
          overflow: "hidden",
          mixBlendMode: "screen",
        }}
      >
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(210,220,255,0.07) 35%, rgba(255,255,255,0.16) 62%, rgba(255,255,255,0) 100%)",
          }}
        />
        <Static id="track" seed={frame % 16} opacity={0.32} frequency="0.004 0.45" contrast={3} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "64%",
            height: Math.max(1, 2 * unit),
            backgroundColor: "rgba(255,255,255,0.35)",
          }}
        />
      </div>

      <Grain opacity={0.14} baseFrequency={0.85} />

      {/* Vệt giật: vài thanh ngang lệch màu */}
      {glitch
        ? [0, 1, 2].map((i) => {
            const top = seeded(`retro-bar-y-${glitch.seed}-${i}`, 0.05, 0.95) * height;
            const h = seeded(`retro-bar-h-${glitch.seed}-${i}`, 4, 26) * unit;
            const colors = ["rgba(255,40,90,0.45)", "rgba(40,230,255,0.45)", "rgba(255,255,255,0.35)"];
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${seeded(`retro-bar-x-${glitch.seed}-${i}`, -20, 30)}%`,
                  width: `${seeded(`retro-bar-w-${glitch.seed}-${i}`, 40, 100)}%`,
                  top,
                  height: h,
                  backgroundColor: colors[i],
                  mixBlendMode: "screen",
                }}
              />
            );
          })
        : null}

      {/* Nhiễu trắng ở điểm cắt: tuyết + dải sáng + đổi màu thoáng qua */}
      {burst ? (
        <AbsoluteFill>
          <Static id="burst" seed={(frame % 20) + 3} opacity={0.2 + 0.5 * burst.amount} frequency="0.55 0.95" contrast={4.5} />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: seeded(`retro-burst-y-${frame}`, 0.1, 0.8) * height,
              height: height * seeded(`retro-burst-h-${frame}`, 0.03, 0.09),
              backgroundColor: "rgba(255,255,255,0.45)",
              mixBlendMode: "screen",
            }}
          />
          <AbsoluteFill
            style={{
              backgroundColor: burst.d % 2 === 0 ? "#ff00b4" : "#00ff9c",
              mixBlendMode: "screen",
              opacity: 0.18 * burst.amount,
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* Vignette + bo góc màn hình CRT */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 85%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          borderRadius: 64 * unit,
          boxShadow: `0 0 0 ${120 * unit}px #000, inset 0 0 ${60 * unit}px rgba(0,0,0,0.6)`,
        }}
      />
    </AbsoluteFill>
  );
};
