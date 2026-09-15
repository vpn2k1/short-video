/**
 * Khung truyện: viền mực dày, lề trắng, bóng khối cứng. Bên trong là ảnh/video được
 * "in" lại (tương phản + bão hoà cao, chấm halftone đổ bóng góc) hoặc tia tốc độ khi
 * cảnh không có ảnh.
 */
import { AbsoluteFill, Img, Sequence, staticFile } from "remotion";
import type { SceneCrop } from "../../compositions/Short/schema";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { INK, WHITE } from "./palette";

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Viền + lề trắng + bóng khối của một khung truyện. */
export const panelFrame = (u: number): React.CSSProperties => ({
  border: `${10 * u}px solid ${INK}`,
  boxSizing: "border-box",
  boxShadow: `0 0 0 ${12 * u}px ${WHITE}, ${18 * u}px ${20 * u}px 0 ${12 * u}px ${INK}`,
  backgroundColor: INK,
});

/** Tia tốc độ toả tròn cho cảnh không ảnh. */
export const SpeedRays: React.FC<{ a: string; b: string; frame: number; seedRot?: number }> = ({ a, b, frame, seedRot = 0 }) => (
  <AbsoluteFill style={{ backgroundColor: b, overflow: "hidden" }}>
    <div
      style={{
        position: "absolute",
        left: "-50%",
        top: "-50%",
        width: "200%",
        height: "200%",
        backgroundImage: `repeating-conic-gradient(from ${(seedRot + frame * 0.35).toFixed(2)}deg at 50% 50%, ${a} 0deg 6deg, ${b} 6deg 15deg)`,
      }}
    />
    <AbsoluteFill
      style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${WHITE} 0%, rgba(255,255,255,0.85) 14%, transparent 48%)` }}
    />
  </AbsoluteFill>
);

type Props = {
  image: string | null;
  crop: SceneCrop | null;
  trimStartMs: number;
  /** Tốc độ phát của cảnh video. */
  speed?: number;
  volume: number;
  sceneStart: number;
  /** 0..1 tiến độ cảnh — phóng chậm bên trong khung. */
  progress: number;
  frame: number;
  rayA: string;
  rayB: string;
  unit: number;
};

export const PanelArt: React.FC<Props> = ({ image, crop, trimStartMs, speed, volume, sceneStart, progress, frame, rayA, rayB, unit }) => {
  if (!image) {
    return <SpeedRays a={rayA} b={rayB} frame={frame} seedRot={sceneStart * 7} />;
  }
  const isVideo = VIDEO_EXT.test(image);
  const dot = 11 * unit;
  const halftoneMask = "radial-gradient(ellipse at 100% 100%, black 0%, rgba(0,0,0,0.5) 35%, transparent 70%)";
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: INK }}>
      <AbsoluteFill
        style={{
          transform: `scale(${1.03 + progress * 0.07})`,
          // Màu "mực in": gắt, rực. Filter tĩnh — rẻ, không làm chậm render.
          filter: "brightness(1.12) contrast(1.1) saturate(1.4)",
        }}
      >
        {isVideo ? (
          <Sequence from={sceneStart} layout="none">
            <ClipVideo src={image} trimStartMs={trimStartMs} speed={speed} volume={volume} crop={crop} />
          </Sequence>
        ) : (
          <CropBox crop={crop}>
            <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </CropBox>
        )}
      </AbsoluteFill>
      {/* Chấm halftone đổ bóng ở góc dưới phải, như vùng tối in lưới. */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(20,18,16,0.55) 0 ${dot * 0.32}px, transparent ${dot * 0.32 + 1}px)`,
          backgroundSize: `${dot}px ${dot}px`,
          mixBlendMode: "multiply",
          maskImage: halftoneMask,
          WebkitMaskImage: halftoneMask,
        }}
      />
      {/* Viền trong mảnh cho cảm giác khung vẽ tay. */}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 0 ${3 * unit}px rgba(255,255,255,0.35)` }} />
    </AbsoluteFill>
  );
};
