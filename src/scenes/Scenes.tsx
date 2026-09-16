import { ClipVideo } from "./ClipVideo";
import { CropBox } from "./CropBox";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS, msToFrames } from "../constants";
import { overlayTransformAt } from "../compositions/Short/overlayMotion";
import { MediaMotion } from "../components/MediaMotion";
import type { Scene } from "../compositions/Short/schema";

/** Độ dài cross-fade giữa hai cảnh, tính bằng giây. */
const CROSSFADE_SECONDS = 0.5;
/** Ken Burns: ảnh tĩnh phóng chậm cho đỡ chết cứng. */
const KEN_BURNS_ZOOM = 0.08;
/** "image" của cảnh có thể là video người dùng tải lên. */
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

type Props = {
  scenes: Scene[];
};

/**
 * Lớp hình nền theo cảnh. Mỗi cảnh có ảnh riêng, chồng lên nhau và cross-fade
 * ở điểm giao — không dùng TransitionSeries vì nó rút ngắn timeline, làm lệch
 * mốc phụ đề và voiceover vốn neo theo frame tuyệt đối.
 */
export const Scenes: React.FC<Props> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = Math.max(1, Math.round(fps * CROSSFADE_SECONDS));

  return (
    <AbsoluteFill>
      {scenes.map((scene, index) => {
        if (!scene.image) {
          return null;
        }

        const start = msToFrames(scene.startMs);
        const end = msToFrames(scene.endMs);

        // Cảnh đầu hiện sẵn từ frame 0 nên chỉ có fade-out. Các cảnh sau fade
        // cả hai đầu. Tách hai nhánh vì interpolate đòi dãy mốc tăng nghiêm ngặt —
        // gộp lại sẽ sinh hai mốc trùng nhau ở cảnh đầu và ném lỗi lúc render.
        const opacity =
          index === 0
            ? interpolate(frame, [end, end + fadeFrames], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : interpolate(
                frame,
                [start - fadeFrames, start, end, end + fadeFrames],
                [0, 1, 1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

        if (opacity <= 0) {
          return null;
        }

        const progress = interpolate(frame, [start, end], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Video người dùng tải lên: bắt đầu phát từ đầu cảnh, tắt tiếng (voiceover
        // và nhạc nền là tiếng chính), lặp nếu clip ngắn hơn cảnh.
        // Vị trí / thu phóng / xoay / độ mờ chỉnh tay của cảnh (kéo trên khung xem trước, keyframe).
        const motion = overlayTransformAt(scene, (frame / FPS) * 1000);

        if (VIDEO_EXT.test(scene.image)) {
          return (
            <AbsoluteFill key={`scene-${index}`} style={{ opacity }}>
              <MediaMotion transform={motion}>
                <Sequence from={start}>
                  <ClipVideo
                    src={scene.image}
                    trimStartMs={scene.trimStartMs} speed={scene.speed}
                    volume={scene.volume}
                    crop={scene.crop}
                  />
                </Sequence>
              </MediaMotion>
            </AbsoluteFill>
          );
        }

        return (
          <AbsoluteFill key={`scene-${index}`} style={{ opacity }}>
            <MediaMotion transform={motion}>
              <CropBox crop={scene.crop}>
                <Img
                  src={staticFile(scene.image)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: `scale(${1 + progress * KEN_BURNS_ZOOM})`,
                  }}
                />
              </CropBox>
            </MediaMotion>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Lớp tối phủ trên ảnh để chữ trắng luôn đọc được, dù ảnh sáng hay tối.
 * Nằm trên Scenes, dưới phụ đề.
 */
export const Scrim: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 26%, rgba(0,0,0,0.2) 58%, rgba(0,0,0,0.7) 100%)",
    }}
  />
);
