import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { FONTS, seeded, useLayout } from "../shared";
import { paletteFrom, type SceneInfo } from "./theme";

/** "image" của cảnh có thể là video người dùng tải lên. */
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Khung ảnh bo góc viền trắng dày như ảnh dán trên bảng game show, nghiêng nhẹ theo seed.
 * Ken Burns nhẹ 1.04→1.12. Không có ảnh → ô kính mờ với dấu "?" khổng lồ lắc lư.
 */
export const ImageFrame: React.FC<{ rect: Rect; info: SceneInfo; accent: string }> = ({ rect, info, accent }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const { scene, index, start, enter, end } = info;
  const tilt = seeded(`quiz-tilt-${index}`, -1.6, 1.6);
  const progress = Math.min(1, Math.max(0, (frame - enter) / Math.max(1, end - enter)));
  const border = 12 * unit;
  const radius = 40 * unit;
  // Hướng Ken Burns đổi theo cảnh.
  const panX = (index % 2 === 0 ? -1 : 1) * progress * 2.2;
  const pal = paletteFrom(accent);

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        transform: `rotate(${tilt}deg)`,
        borderRadius: radius,
        backgroundColor: "#ffffff",
        padding: border,
        boxSizing: "border-box",
        boxShadow: `0 ${26 * unit}px ${50 * unit}px -${18 * unit}px rgba(20,8,40,0.55)`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: radius - border,
          overflow: "hidden",
          backgroundColor: pal.darker,
        }}
      >
        {scene.image ? (
          <AbsoluteFill style={{ transform: `scale(${1.04 + progress * 0.08}) translateX(${panX}%)` }}>
            {VIDEO_EXT.test(scene.image) ? (
              <Sequence from={start}>
                <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} />
              </Sequence>
            ) : (
              <CropBox crop={scene.crop}>
                <Img src={staticFile(scene.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </CropBox>
            )}
          </AbsoluteFill>
        ) : (
          <EmptyTile accent={accent} index={index} />
        )}
        {/* Tối nhẹ đáy để thẻ câu hỏi đè lên có chiều sâu */}
        <AbsoluteFill
          style={{
            backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(10,4,30,0.35) 100%)",
          }}
        />
      </div>
    </div>
  );
};

const EmptyTile: React.FC<{ accent: string; index: number }> = ({ accent, index }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pal = paletteFrom(accent);
  const swing = Math.sin(frame / 14 + index) * 7;
  const bob = Math.sin(frame / 20 + index) * 14 * unit;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(160deg, ${pal.base} 0%, ${pal.darker} 100%)`,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 18px, transparent 18px, transparent 40px)",
          backgroundPosition: `${frame * 0.8}px 0px`,
        }}
      />
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 900,
          fontSize: 420 * unit,
          lineHeight: 1,
          color: "rgba(255,255,255,0.92)",
          textShadow: `0 ${16 * unit}px 0 rgba(0,0,0,0.18)`,
          transform: `translateY(${bob}px) rotate(${swing}deg)`,
        }}
      >
        ?
      </div>
    </AbsoluteFill>
  );
};
