import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { activeIndexAt, useLayout } from "../shared";
import { Static } from "./Noise";
import { burstAt, glitchAt, gradeFor, jitterAt, VIDEO_EXT } from "./vhs";

/** Phóng nhẹ để lúc rung/giật ngang không lộ mép khung. */
const OVERSCAN = 1.06;

/** Một kênh màu của ảnh: nhân với màu kênh rồi dời ngang. */
const Channel: React.FC<{
  src: string;
  crop: Scene["crop"];
  color: string;
  dx: number;
  blend: React.CSSProperties["mixBlendMode"];
}> = ({ src, crop, color, dx, blend }) => (
  <AbsoluteFill style={{ translate: `${dx}px 0px`, mixBlendMode: blend, isolation: "isolate" }}>
    <CropBox crop={crop}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </CropBox>
    <AbsoluteFill style={{ backgroundColor: color, mixBlendMode: "multiply" }} />
  </AbsoluteFill>
);

/** Cảnh không có ảnh: nền băng trắng xanh đen, tuyết nhiễu mờ. */
const NoSignal: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#03050d",
        backgroundImage:
          "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(38,52,120,0.75) 0%, rgba(12,18,48,0.85) 55%, rgba(2,3,8,1) 100%)",
      }}
    >
      <Static id={`nosig-${index}`} seed={Math.floor(frame / 2) % 10} opacity={0.1} frequency="0.8 0.6" blend="screen" />
    </AbsoluteFill>
  );
};

/**
 * Hình của cảnh đang chạy: ảnh/video toàn khung, chỉnh màu VHS, lệch màu đỏ/xanh,
 * rung ngang. Chỉ vẽ cảnh hiện tại — điểm cắt được che bằng cú nhiễu trắng.
 *
 * Ảnh: hai bản sao (kênh đỏ và kênh lục-lam) dời ngược nhau rồi `screen` lại — đúng
 * màu gốc ở vùng không lệch. Video: KHÔNG giải mã clip nhiều lần; một filter SVG
 * (feColorMatrix → feOffset → feBlend) tách kênh trên chính khung hình đã giải mã.
 */
export const Footage: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  if (scenes.length === 0) return <NoSignal index={0} />;

  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const start = msToFrames(scene.startMs);

  const glitch = glitchAt(frame);
  const burst = burstAt(frame, scenes, false);
  let shift = jitterAt(frame, unit);
  let split = 2.5 * unit;
  if (glitch) {
    shift += glitch.dir * 22 * unit * glitch.strength;
    split = 9 * unit;
  }
  if (burst) {
    shift += (burst.d % 2 === 0 ? 1 : -1) * 16 * unit * burst.amount;
    split = Math.max(split, 12 * unit * burst.amount);
  }
  const grade = gradeFor(unit);
  const frameStyle: React.CSSProperties = { scale: `${OVERSCAN}`, translate: `${shift}px 0px` };

  let content: React.ReactNode;
  if (!scene.image) {
    content = <NoSignal index={index} />;
  } else if (VIDEO_EXT.test(scene.image)) {
    const filterId = `retro-rgb-${index}`;
    const dx = Math.round(split * 2) / 2;
    content = (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <svg width="0" height="0" style={{ position: "absolute" }} xmlns="http://www.w3.org/2000/svg">
          <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={-dx} dy="0" result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feOffset in="gb" dx={dx} dy="0" result="gbo" />
            <feBlend in="ro" in2="gbo" mode="screen" />
          </filter>
        </svg>
        <AbsoluteFill style={{ ...frameStyle, filter: `url(#${filterId}) ${grade}` }}>
          <Sequence from={start}>
            <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} />
          </Sequence>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  } else {
    content = (
      <AbsoluteFill style={{ backgroundColor: "#000", isolation: "isolate" }}>
        <AbsoluteFill style={{ ...frameStyle, filter: grade, backgroundColor: "#000", isolation: "isolate" }}>
          <Channel src={scene.image} crop={scene.crop} color="#00ffff" dx={split} blend="normal" />
          <Channel src={scene.image} crop={scene.crop} color="#ff0000" dx={-split} blend="screen" />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {content}
      {/* Nâng vùng đen lên xanh tím nhạt như băng từ, không có đen tuyền. */}
      <AbsoluteFill style={{ backgroundColor: "#1e1a36", mixBlendMode: "screen", opacity: 0.55 }} />
      {/* Ngả ấm nhẹ */}
      <AbsoluteFill style={{ backgroundColor: "#8a5a2a", mixBlendMode: "soft-light", opacity: 0.3 }} />
    </AbsoluteFill>
  );
};
