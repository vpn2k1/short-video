/**
 * Nền sau thẻ: ảnh/video của cảnh toàn khung, tối đi. Ảnh tĩnh được làm mờ TĨNH (không đổi
 * theo frame để trình duyệt không phải raster lại blur); video không blur — chỉ phóng nhẹ và
 * phủ lớp tối, vì blur trên từng frame video rất đắt. Không có ảnh → gradient tối ám `accent`.
 */
import { AbsoluteFill, Img, interpolate, Sequence, staticFile } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { isVideo } from "./model";

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return `rgba(0,0,0,${a})`;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const SceneLayer: React.FC<{ scene: Scene; unit: number }> = ({ scene, unit }) => {
  if (!scene.image) return null;
  if (isVideo(scene.image)) {
    const from = msToFrames(scene.startMs);
    const dur = Math.max(1, msToFrames(scene.endMs) - from);
    return (
      <Sequence from={from} durationInFrames={dur} layout="none">
        <AbsoluteFill style={{ transform: "scale(1.06)" }}>
          <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} />
        </AbsoluteFill>
      </Sequence>
    );
  }
  return (
    <AbsoluteFill style={{ transform: "scale(1.12)", filter: `blur(${Math.round(16 * unit)}px) saturate(1.1)` }}>
      <CropBox crop={scene.crop}>
        <Img src={staticFile(scene.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </CropBox>
    </AbsoluteFill>
  );
};

export const Backdrop: React.FC<{
  scenes: Scene[];
  index: number;
  frame: number;
  accent: string;
  unit: number;
}> = ({ scenes, index, frame, accent, unit }) => {
  const scene = index >= 0 ? scenes[index] : null;
  const prev = index > 0 ? scenes[index - 1] : null;
  const startF = scene ? msToFrames(scene.startMs) : 0;
  // Ảnh → ảnh: hoà 10 frame cho mềm; có video thì cắt thẳng (khỏi giải mã hai clip).
  const fade =
    prev?.image && scene?.image && !isVideo(prev.image) && !isVideo(scene.image)
      ? interpolate(frame, [startF, startF + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0f14", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(75% 55% at 25% 18%, ${withAlpha(accent, 0.42)} 0%, transparent 70%), radial-gradient(70% 55% at 85% 88%, ${withAlpha(accent, 0.22)} 0%, transparent 72%), linear-gradient(180deg, #151a22 0%, #07090c 100%)`,
        }}
      />
      {prev && fade < 1 ? (
        <AbsoluteFill>
          <SceneLayer scene={prev} unit={unit} />
        </AbsoluteFill>
      ) : null}
      {scene ? (
        <AbsoluteFill style={{ opacity: fade }}>
          <SceneLayer scene={scene} unit={unit} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill
        style={{
          background: "radial-gradient(90% 70% at 50% 50%, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.66) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
