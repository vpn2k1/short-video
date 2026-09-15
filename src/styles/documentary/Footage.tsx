import { ClipVideo } from "../../scenes/ClipVideo";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { Grain, seeded, useLayout } from "../shared";

/** Độ dài cross-fade giữa hai cảnh (frame). */
export const FADE_FRAMES = 16;
/** "image" của cảnh có thể là video người dùng tải lên. */
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
/** Chỉnh màu điện ảnh: bớt bão hoà, ngả nâu ấm, tăng tương phản. Filter tĩnh, không blur. */
const GRADE = "saturate(0.72) sepia(0.22) contrast(1.12) brightness(0.9)";

/** Nền khi cảnh không có ảnh: gradient tối như giấy ảnh cũ, hạt dày. */
const PaperDark: React.FC<{ background: string; seed: string }> = ({ background, seed }) => (
  <AbsoluteFill
    style={{
      backgroundColor: background,
      backgroundImage: `radial-gradient(ellipse at ${Math.round(seeded(`${seed}-px`, 25, 75))}% ${Math.round(
        seeded(`${seed}-py`, 25, 60),
      )}%, rgba(120,88,52,0.55) 0%, rgba(40,30,22,0.6) 45%, rgba(0,0,0,0.9) 100%)`,
    }}
  >
    <Grain opacity={0.35} animated={false} baseFrequency={0.6} />
  </AbsoluteFill>
);

/**
 * Lớp hình của mọi cảnh: ảnh/video toàn khung, Ken Burns theo seed, chỉnh màu,
 * cross-fade + nhúng tối ở điểm cắt. Không dùng TransitionSeries vì nó rút ngắn
 * timeline và làm lệch mốc phụ đề neo theo frame tuyệt đối.
 */
export const Footage: React.FC<{ scenes: Scene[]; background: string }> = ({ scenes, background }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#050403" }}>
      {scenes.map((scene, index) => {
        const start = msToFrames(scene.startMs);
        const end = Math.max(start + 1, msToFrames(scene.endMs));
        const isLast = index === scenes.length - 1;

        // Cảnh đầu có sẵn từ frame 0; cảnh cuối giữ tới hết video. Tách nhánh để
        // dãy mốc interpolate luôn tăng nghiêm ngặt.
        let opacity = 1;
        if (index > 0) {
          opacity = interpolate(frame, [start - FADE_FRAMES, start], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
        }
        if (!isLast) {
          // Cảnh sau vẽ đè lên nên chỉ cần tắt cảnh trước sau khi cảnh sau đã hiện đủ.
          opacity *= interpolate(frame, [end, end + 1], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
        }
        if (opacity <= 0) {
          return null;
        }

        const key = `doc-scene-${index}`;
        const progress = interpolate(frame, [start - FADE_FRAMES, end + FADE_FRAMES], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.sin),
        });
        // Hướng pan và chiều zoom khác nhau mỗi cảnh nhưng xác định theo seed.
        const zoomIn = seeded(`${key}-zoom`) > 0.4;
        const fromScale = zoomIn ? 1.06 : 1.2;
        const toScale = zoomIn ? 1.2 : 1.06;
        const dx = seeded(`${key}-dx`, -3, 3);
        const dy = seeded(`${key}-dy`, -2.5, 2.5);
        const scale = fromScale + (toScale - fromScale) * progress;
        const tx = -dx + 2 * dx * progress;
        const ty = -dy + 2 * dy * progress;

        let content: React.ReactNode;
        if (!scene.image) {
          content = <PaperDark background={background} seed={key} />;
        } else if (VIDEO_EXT.test(scene.image)) {
          content = (
            <Sequence from={Math.max(0, start - FADE_FRAMES)}>
              <AbsoluteFill style={{ transform: `scale(${1 + (scale - 1) * 0.5})`, filter: GRADE }}>
                <ClipVideo
                  src={scene.image}
                  trimStartMs={scene.trimStartMs} speed={scene.speed}
                  volume={scene.volume}
                  crop={scene.crop}
                />
              </AbsoluteFill>
            </Sequence>
          );
        } else {
          content = (
            <Img
              src={staticFile(scene.image)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: GRADE,
                transform: `translate(${tx}%, ${ty}%) scale(${scale})`,
              }}
            />
          );
        }

        return (
          <AbsoluteFill key={key} style={{ opacity, overflow: "hidden" }}>
            {content}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Lớp "phim": tint ấm, vignette, rò sáng mềm, nhấp nháy nhẹ, hạt phim, nhúng tối
 * ở điểm cắt, letterbox (ngang) hoặc gradient tối trên/dưới (dọc).
 */
export const FilmLook: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { width, height } = useLayout();
  const landscape = width / height > 1.2;

  // Nhúng tối quanh mỗi điểm cắt (bỏ cảnh đầu).
  let dip = 0;
  let leakBoost = 0;
  scenes.forEach((scene, index) => {
    if (index === 0) return;
    const cut = msToFrames(scene.startMs);
    dip = Math.max(
      dip,
      interpolate(frame, [cut - FADE_FRAMES, cut - FADE_FRAMES / 2, cut + 6], [0, 0.55, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
    leakBoost = Math.max(
      leakBoost,
      interpolate(frame, [cut - FADE_FRAMES, cut, cut + 24], [0, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  });

  // Nhấp nháy như máy chiếu: đổi mỗi 2 frame, biên độ rất nhỏ.
  const flicker = seeded(`flicker-${Math.floor(frame / 2)}`, 0, 0.05);
  const leakX = 70 + Math.sin(frame / 90) * 18;
  const leakY = 20 + Math.cos(frame / 110) * 12;
  const leakOpacity = 0.14 + Math.sin(frame / 37) * 0.04 + leakBoost * 0.4;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Tint ấm kiểu phim nhựa */}
      <AbsoluteFill style={{ backgroundColor: "#7a4a1e", mixBlendMode: "soft-light", opacity: 0.35 }} />
      {/* Rò sáng: gradient cam trôi chậm, sáng lên ở điểm cắt */}
      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          opacity: leakOpacity,
          backgroundImage: `radial-gradient(ellipse 55% 45% at ${leakX}% ${leakY}%, rgba(255,150,60,0.9) 0%, rgba(255,90,30,0.35) 40%, rgba(0,0,0,0) 75%)`,
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 75% at 50% 48%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0.8) 100%)",
        }}
      />
      {/* Chữ đọc được: gradient tối trên/dưới */}
      <AbsoluteFill
        style={{
          backgroundImage: landscape
            ? "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "#fff3e0", opacity: flicker, mixBlendMode: "overlay" }} />
      <Grain opacity={0.16} baseFrequency={0.85} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: dip }} />
      {landscape ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: height * 0.05, backgroundColor: "#000" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.05, backgroundColor: "#000" }} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
