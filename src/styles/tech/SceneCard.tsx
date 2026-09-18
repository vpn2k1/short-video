import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { FONTS, useLayout } from "../shared";
import { CYAN, VIOLET, withAlpha } from "./theme";

/** "image" của cảnh có thể là video người dùng tải lên. */
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

type Props = {
  scene: Scene;
  index: number;
  total: number;
  accent: string;
  /** Frame bắt đầu cảnh — video phát từ đây. */
  start: number;
  /** Frame cảnh bắt đầu hiện (để tính Ken Burns). */
  enter: number;
  end: number;
};

/**
 * Thẻ kính nổi chứa ảnh/video của cảnh. Nghiêng 3D nhẹ theo sin của frame,
 * ảnh bên trong dịch ngược chiều nghiêng để tạo parallax.
 * "Kính" là nền bán trong suốt + viền 1px + gradient highlight — không backdrop-filter.
 */
export const SceneCard: React.FC<Props> = ({ scene, index, total, accent, start, enter, end }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const t = frame / 30;
  // Pha lệch theo index để hai cảnh liền nhau không nghiêng giống hệt.
  const rotX = Math.sin(t * 0.9 + index * 1.7) * 2.6;
  const rotY = Math.cos(t * 0.7 + index * 2.3) * 3.4;
  const progress = Math.min(1, Math.max(0, (frame - enter) / Math.max(1, end - enter)));
  const radius = 36 * unit;
  const label = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <AbsoluteFill style={{ perspective: 1800 * unit }}>
      {/* Quầng sáng màu phía sau thẻ — radial-gradient tĩnh thay cho box-shadow blur lớn */}
      <div
        style={{
          position: "absolute",
          inset: `-${14}%`,
          backgroundImage: `radial-gradient(closest-side, ${withAlpha(accent, 0.32)} 0%, ${withAlpha(VIOLET, 0.14)} 55%, transparent 100%)`,
          transform: `translate(${rotY * 6 * unit}px, ${-rotX * 6 * unit}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          overflow: "hidden",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          backgroundColor: "rgba(12, 20, 40, 0.75)",
          border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.18)`,
          boxShadow: `0 ${30 * unit}px ${70 * unit}px -${20 * unit}px rgba(0,0,0,0.7)`,
        }}
      >
        {scene.image ? (
          <div
            style={{
              position: "absolute",
              inset: "-5%",
              transform: `translate(${-rotY * 5 * unit}px, ${rotX * 5 * unit}px) scale(${1.02 + progress * 0.05})`,
            }}
          >
            {VIDEO_EXT.test(scene.image) ? (
              <Sequence from={start}>
                <ClipVideo
                  src={scene.image}
                  trimStartMs={scene.trimStartMs} speed={scene.speed}
                  volume={scene.volume}
                  crop={scene.crop}
                />
              </Sequence>
            ) : (
              <CropBox crop={scene.crop}>
                <Img
                  src={staticFile(scene.image)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </CropBox>
            )}
          </div>
        ) : (
          <EmptyScreen accent={accent} index={index} />
        )}

        {/* Tối nhẹ ở đáy + highlight chéo góc trên trái = mặt kính */}
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(3,6,14,0.35) 0%, rgba(3,6,14,0) 22%, rgba(3,6,14,0) 60%, rgba(3,6,14,0.55) 100%)",
          }}
        />
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${125 + rotY * 3}deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 22%, transparent 42%)`,
          }}
        />
        {/* Viền sáng bên trong */}
        <AbsoluteFill
          style={{
            borderRadius: radius,
            boxShadow: `inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.28), inset 0 0 0 ${Math.max(1, unit)}px rgba(255,255,255,0.05)`,
          }}
        />
        {/* Nhãn số cảnh kiểu giao diện */}
        <div
          style={{
            position: "absolute",
            top: 26 * unit,
            right: 30 * unit,
            fontFamily: FONTS.mono,
            fontSize: 22 * unit,
            letterSpacing: 2 * unit,
            color: "rgba(234,242,255,0.8)",
            padding: `${6 * unit}px ${14 * unit}px`,
            borderRadius: 999,
            backgroundColor: "rgba(5,10,24,0.55)",
            border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.14)`,
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Cảnh không có ảnh: màn hình trừu tượng — lưới mảnh, vòng tròn đồng tâm, số cảnh mờ. */
const EmptyScreen: React.FC<{ accent: string; index: number }> = ({ accent, index }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pulse = (frame / 45) % 1;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(80% 70% at 30% 20%, ${withAlpha(accent, 0.28)} 0%, transparent 60%), radial-gradient(70% 60% at 80% 90%, ${withAlpha(CYAN, 0.2)} 0%, transparent 65%), linear-gradient(160deg, #0b1430 0%, #060a18 100%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: `${48 * unit}px ${48 * unit}px`,
        }}
      />
      {[0, 1, 2].map((ring) => {
        const p = (pulse + ring / 3) % 1;
        const size = (120 + p * 520) * unit;
        return (
          <div
            key={ring}
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: "50%",
              border: `${Math.max(1, 2 * unit)}px solid ${withAlpha(CYAN, 0.4 * (1 - p))}`,
            }}
          />
        );
      })}
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 180 * unit,
          fontWeight: 700,
          color: "rgba(234,242,255,0.08)",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};
