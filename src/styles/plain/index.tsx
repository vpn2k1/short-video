import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FPS, msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { overlayTransformAt } from "../../compositions/Short/overlayMotion";
import { MediaMotion } from "../../components/MediaMotion";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { TitleCard } from "../../components/TitleCard";
import { FONTS, useCaptionClock, useLayout } from "../shared";

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/**
 * Phong cách "Video gốc": ảnh/video giữ nguyên, vừa khung (không cắt xén), cắt cảnh
 * gọn không chuyển cảnh, không lớp phủ. Dành cho chỉnh sửa clip người dùng tải lên —
 * mọi thứ khác (chữ, âm thanh) thêm trong trình chỉnh sửa.
 */
export const PlainStyle: React.FC<ShortProps> = ({
  scenes,
  captions,
  title,
  subtitle,
  accent,
  background,
  showTitle,
  captionPosition,
}) => {
  const frame = useCurrentFrame();
  const clock = useCaptionClock(captions);
  const { unit, captionBottom } = useLayout();
  // Khác các phong cách khác: phụ đề tắt đúng lúc hết câu — video gốc hay có khoảng lặng.
  const caption = clock.caption && clock.localFrame < clock.durationFrames ? clock.caption : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {scenes.map((scene, index) => {
        const from = msToFrames(scene.startMs);
        const durationInFrames = Math.max(1, msToFrames(scene.endMs) - from);
        return (
          <Sequence key={`plain-${index}`} name={`Cảnh ${index + 1}`} from={from} durationInFrames={durationInFrames}>
            {!scene.image ? (
              <AbsoluteFill style={{ backgroundColor: background }} />
            ) : (
              // Vị trí / thu phóng / xoay / độ mờ của cảnh — kéo trên khung xem trước, chạy theo keyframe.
              <MediaMotion transform={overlayTransformAt(scene, (frame / FPS) * 1000)}>
                {VIDEO_EXT.test(scene.image) ? (
                  <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} objectFit="contain" />
                ) : (
                  <CropBox crop={scene.crop}>
                    <Img src={staticFile(scene.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </CropBox>
                )}
              </MediaMotion>
            )}
          </Sequence>
        );
      })}

      {!showTitle ? null : (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
            <TitleCard title={title} subtitle={subtitle} accent={accent} />
          </AbsoluteFill>
        </Sequence>
      )}

      {!caption ? null : (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            padding: `0 ${60 * unit}px`,
            ...(captionPosition === "center" ? { top: "50%", transform: "translateY(-50%)" } : { bottom: captionBottom }),
          }}
        >
          <span
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 700,
              fontSize: 58 * unit,
              lineHeight: 1.25,
              color: "#fff",
              textAlign: "center",
              whiteSpace: "pre-wrap",
              textShadow: "0 3px 12px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.9)",
            }}
          >
            {caption.text}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
