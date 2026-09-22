/**
 * Nền ảnh bìa nhoè, ô ảnh bìa, cột nhạc nhỏ và nút điều khiển của phong cách "Lời nhạc cuộn".
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { clamp, clock, initialsOf, useLevels } from "../music";
import { activeIndexAt, Grain, useLayout } from "../shared";
import { FONT, type Palette } from "./layout";

const FADE_FRAMES = 20;

/** Cảnh đang chạy và cảnh trước nó trong lúc hoà (ảnh bìa đổi theo cảnh). */
export const useSceneMix = (scenes: Scene[]) => {
  const frame = useCurrentFrame();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index] ?? null;
  const start = scene ? msToFrames(scene.startMs) : 0;
  const mix = index > 0 ? interpolate(frame, [start, start + FADE_FRAMES], [0, 1], clamp) : 1;
  return { scene, prev: index > 0 && mix < 1 ? scenes[index - 1] : null, mix };
};

/* ------------------------------------------------------------ nền */

/** Không ảnh: bốn mảng màu lớn nhoè trôi chậm, phồng nhẹ theo bass. */
const MeshGradient: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const { bass } = useLevels();
  const size = Math.max(width, height) * 0.75;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.base, overflow: "hidden" }}>
      {palette.blobs.map((color, i) => {
        const x = width * (0.5 + 0.34 * Math.sin(frame / (90 + i * 23) + i * 1.7));
        const y = height * (0.45 + 0.3 * Math.cos(frame / (110 + i * 17) + i * 2.3));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
              scale: String(1 + bass * 0.12),
              opacity: 0.85,
              filter: `blur(${60 * unit}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Ảnh/clip của cảnh phóng to, nhoè mạnh, đậm màu — như nền ảnh bìa của app nghe nhạc. */
const BlurredArt: React.FC<{ scene: Scene; palette: Palette }> = ({ scene, palette }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const { bass } = useLevels();
  if (!scene.image) return <MeshGradient palette={palette} />;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.base, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          scale: String(1.6 + bass * 0.06),
          rotate: `${Math.sin(frame / 160) * 8}deg`,
          filter: `blur(${70 * unit}px) saturate(1.8) brightness(0.62)`,
        }}
      >
        <SceneMedia scene={scene} from={msToFrames(scene.startMs)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Backdrop: React.FC<{ scenes: Scene[]; palette: Palette }> = ({ scenes, palette }) => {
  const { scene, prev, mix } = useSceneMix(scenes);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.base }}>
      {prev ? <BlurredArt scene={prev} palette={palette} /> : null}
      <AbsoluteFill style={{ opacity: mix }}>{scene ? <BlurredArt scene={scene} palette={palette} /> : <MeshGradient palette={palette} />}</AbsoluteFill>
      {/* Tối nhẹ cho chữ trắng nổi, tối hơn ở hai đầu. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.55) 100%)" }} />
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ ảnh bìa */

/** Ô ảnh bìa: ảnh/clip của cảnh; cảnh không ảnh thì mảng màu + chữ viết tắt của handle + nốt nhạc. */
export const Artwork: React.FC<{ scenes: Scene[]; handle: string; palette: Palette; size: number; radius: number }> = ({
  scenes,
  handle,
  palette,
  size,
  radius,
}) => {
  const { scene, prev, mix } = useSceneMix(scenes);
  const face = (s: Scene | null) =>
    s?.image ? (
      <SceneMedia scene={s} from={msToFrames(s.startMs)} />
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: `linear-gradient(135deg, ${palette.blobs[0]} 0%, ${palette.blobs[2]} 55%, ${palette.blobs[3]} 100%)`,
          color: "rgba(255,255,255,0.92)",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: size * 0.34,
        }}
      >
        {initialsOf(handle || "♪")}
      </div>
    );
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        boxShadow: `0 ${size * 0.06}px ${size * 0.18}px rgba(0,0,0,0.45)`,
        backgroundColor: palette.base,
      }}
    >
      {prev ? <div style={{ position: "absolute", inset: 0 }}>{face(prev)}</div> : null}
      <div style={{ position: "absolute", inset: 0, opacity: mix }}>{face(scene)}</div>
    </div>
  );
};

/* ------------------------------------------------------------ nhỏ */

/** Biểu tượng "đang phát": 3 cột nhảy theo phổ. */
export const PlayingBars: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const { bands } = useLevels();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: size * 0.14, height: size, width: size }}>
      {[3, 10, 20].map((b, i) => (
        <div key={i} style={{ flex: 1, height: `${Math.max(18, (bands[b] ?? 0) * 100)}%`, borderRadius: size * 0.08, backgroundColor: color }} />
      ))}
    </div>
  );
};

/** Thanh tiến độ bài + thời gian đã phát / tổng. */
export const Progress: React.FC<{ width: number; unit: number; fontSize: number }> = ({ width, unit, fontSize }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const text = { fontFamily: FONT, fontWeight: 600, fontSize, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" } as const;
  return (
    <div style={{ width }}>
      <div style={{ position: "relative", height: 7 * unit, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${p * 100}%`, backgroundColor: "rgba(255,255,255,0.85)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 * unit }}>
        <span style={text}>{clock((frame / fps) * 1000)}</span>
        <span style={text}>-{clock(((durationInFrames - frame) / fps) * 1000)}</span>
      </div>
    </div>
  );
};

/** ⏮ ⏸ ⏭ — hàng nút của trình phát cỡ lớn (chỉ để nhìn). */
export const Controls: React.FC<{ size: number }> = ({ size }) => {
  const { kick } = useLevels();
  const icon = (d: string, s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff">
      <path d={d} />
    </svg>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: size * 1.1 }}>
      {icon("M6 5h2v14H6zM20 5v14L9 12z", size * 0.8)}
      <div style={{ scale: String(1 + kick * 0.06) }}>{icon("M7 4h4v16H7zM13 4h4v16h-4z", size * 1.15)}</div>
      {icon("M16 5h2v14h-2zM4 5v14l11-7z", size * 0.8)}
    </div>
  );
};
