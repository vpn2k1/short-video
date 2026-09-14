import { AbsoluteFill, CalculateMetadataFunction, Sequence } from "remotion";
import { FPS, msToFrames, OUTRO_FRAMES, TITLE_FRAMES } from "../../constants";
import { ASPECTS, DEFAULT_ASPECT, type AspectId } from "../../aspects";
import { Background } from "../../scenes/Background";
import { Scenes, Scrim } from "../../scenes/Scenes";
import { SceneVisual } from "../../scenes/SceneVisual";
import { Captions } from "../../captions/Captions";
import { ProgressBar } from "../../components/ProgressBar";
import type { ShortProps } from "./schema";
import { Soundtrack } from "../../audio/Soundtrack";
import { TitleCard } from "../../components/TitleCard";

/** Duration follows the caption track, so editing captions in the Studio resizes the video. */
export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = ({
  props,
}) => {
  // Xét cả mốc kết thúc của cảnh: với bản thu sẵn, audio có thể còn chạy sau
  // câu cuối (khoảng lặng đuôi) — chỉ nhìn caption là cắt mất phần đó.
  const lastEndMs = Math.max(
    props.captions.reduce((max, caption) => Math.max(max, caption.endMs), 0),
    props.scenes.reduce((max, scene) => Math.max(max, scene.endMs), 0),
  );

  return {
    durationInFrames: Math.max(
      TITLE_FRAMES,
      msToFrames(lastEndMs) + OUTRO_FRAMES,
    ),
    fps: FPS,
    ...(({ width, height }) => ({ width, height }))(
      ASPECTS[(props.aspect as AspectId) ?? DEFAULT_ASPECT] ?? ASPECTS[DEFAULT_ASPECT],
    ),
  };
};

export const Short: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  background,
  captions,
  scenes,
  captionPosition,
  showTitle,
  voiceoverTrack,
  music,
  sfx,
}) => {
  return (
    <AbsoluteFill
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Thứ tự lớp: nền gradient → ảnh của cảnh → lớp tối → chữ. */}
      <Background accent={accent} background={background} />
      <Scenes scenes={scenes} />
      <Scrim />
      <SceneVisual scenes={scenes} accent={accent} />

      {!showTitle ? null : (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <TitleCard title={title} subtitle={subtitle} accent={accent} />
        </Sequence>
      )}

      <Captions
        captions={captions}
        accent={accent}
        position={captionPosition}
      />
      <Soundtrack
        captions={captions}
        voiceoverTrack={voiceoverTrack}
        music={music}
        sfx={sfx}
      />
      {/* <Watermark handle={handle} /> — đang tắt, xem ghi chú trong hội thoại */}
      <ProgressBar accent={accent} />
    </AbsoluteFill>
  );
};
