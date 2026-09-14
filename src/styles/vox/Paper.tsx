/**
 * Nền giấy kẻ ô: giấy ngà ấm, lưới mảnh, hai vệt màu loang đổi theo cảnh,
 * vài cụm chấm halftone, hạt giấy. Toàn bộ vẽ bằng CSS — không ảnh, không blur động.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { Grain, seeded, useLayout } from "../shared";
import { GRID, PAPER, scenePalette } from "./palette";

const FADE = 15;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Một vệt loang: radial-gradient trong khung bo méo — mềm sẵn, không cần filter blur. */
const Splash: React.FC<{
  color: string;
  x: number;
  y: number;
  size: number;
  seedKey: string;
  drift: number;
}> = ({ color, x, y, size, seedKey, drift }) => {
  const r = (k: string) => Math.round(seeded(`${seedKey}-${k}`, 35, 65));
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size * seeded(`${seedKey}-h`, 0.7, 1),
        borderRadius: `${r("a")}% ${100 - r("a")}% ${r("b")}% ${100 - r("b")}% / ${r("c")}% ${r("d")}% ${100 - r("d")}% ${100 - r("c")}%`,
        backgroundImage: `radial-gradient(closest-side, ${color} 0%, ${color} 45%, transparent 100%)`,
        opacity: 0.5,
        mixBlendMode: "multiply",
        transform: `translate(${Math.sin(drift) * size * 0.03}px, ${Math.cos(drift * 0.8) * size * 0.03}px) rotate(${seeded(`${seedKey}-rot`, 0, 360)}deg)`,
      }}
    />
  );
};

/** Cụm chấm halftone, mép mờ dần bằng mask. */
const Halftone: React.FC<{ color: string; x: number; y: number; size: number; dot: number }> = ({
  color,
  x,
  y,
  size,
  dot,
}) => {
  const mask = "radial-gradient(circle at 50% 50%, black 0%, rgba(0,0,0,0.6) 35%, transparent 70%)";
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        backgroundImage: `radial-gradient(circle, ${color} 0 32%, transparent 36%)`,
        backgroundSize: `${dot}px ${dot}px`,
        opacity: 0.32,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
};

export const Paper: React.FC<{ scenes: Scene[]; accent: string }> = ({ scenes, accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const short = Math.min(width, height);
  const cell = Math.round(46 * unit);
  const line = Math.max(1, 1.6 * unit);

  // Không có cảnh nào vẫn cần vệt màu: dùng một "cảnh ảo" phủ cả video.
  const layers = scenes.length > 0 ? scenes : [{ startMs: 0, endMs: 1e9 } as Scene];

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, overflow: "hidden" }}>
      {/* Lưới kẻ ô */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${GRID} ${line}px, transparent ${line}px), linear-gradient(90deg, ${GRID} ${line}px, transparent ${line}px)`,
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: `${(width % cell) / 2}px ${(height % cell) / 2}px`,
        }}
      />

      {layers.map((scene, index) => {
        const start = msToFrames(scene.startMs);
        const end = msToFrames(scene.endMs);
        // Hai interpolate riêng (vào/ra) để dãy mốc luôn tăng nghiêm ngặt kể cả cảnh ngắn.
        const fadeIn = index === 0 ? 1 : interpolate(frame, [start, start + FADE], [0, 1], clamp);
        const fadeOut = interpolate(frame, [end, end + FADE], [1, 0], clamp);
        const opacity = Math.min(fadeIn, fadeOut);
        if (opacity <= 0) {
          return null;
        }
        const pal = scenePalette(accent, index);
        const k = `vox-bg-${index}`;
        const drift = (frame / 30) * 0.4 + seeded(`${k}-ph`, 0, 6);
        return (
          <AbsoluteFill key={k} style={{ opacity }}>
            <Splash
              color={pal.splashA}
              seedKey={`${k}-a`}
              x={width * seeded(`${k}-ax`, 0.1, 0.4)}
              y={height * seeded(`${k}-ay`, 0.08, 0.35)}
              size={short * seeded(`${k}-as`, 0.8, 1.1)}
              drift={drift}
            />
            <Splash
              color={pal.splashB}
              seedKey={`${k}-b`}
              x={width * seeded(`${k}-bx`, 0.6, 0.92)}
              y={height * seeded(`${k}-by`, 0.6, 0.9)}
              size={short * seeded(`${k}-bs`, 0.75, 1.05)}
              drift={drift + 2}
            />
            {[0, 1, 2].map((d) => (
              <Halftone
                key={d}
                color={pal.dots}
                x={width * seeded(`${k}-d${d}x`, 0.05, 0.95)}
                y={height * seeded(`${k}-d${d}y`, 0.05, 0.95)}
                size={short * seeded(`${k}-d${d}s`, 0.22, 0.4)}
                dot={Math.round(seeded(`${k}-d${d}p`, 14, 22) * unit)}
              />
            ))}
          </AbsoluteFill>
        );
      })}

      {/* Mép giấy sẫm nhẹ cho có chiều sâu */}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(90, 64, 30, 0.16) 100%)",
        }}
      />
      <Grain opacity={0.16} baseFrequency={0.8} />
    </AbsoluteFill>
  );
};
