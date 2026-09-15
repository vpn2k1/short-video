import { AbsoluteFill, CalculateMetadataFunction } from "remotion";
import { FPS, msToFrames, OUTRO_FRAMES, TITLE_FRAMES } from "../../constants";
import { ASPECTS, DEFAULT_ASPECT, type AspectId } from "../../aspects";
import type { ShortProps } from "./schema";
import { Soundtrack } from "../../audio/Soundtrack";
import { TextOverlays } from "../../components/TextOverlays";
import { CustomCaptions } from "../../components/CustomCaptions";
import { usesCustomCaptions } from "../../components/captionLook";
import { WatermarkOverlay } from "../../components/WatermarkOverlay";
import { STYLE_COMPONENTS } from "../../styles/registry";
import { CaptionStyle } from "../../styles/caption";
import { FONTS } from "../../styles/shared";
import type { StyleId } from "../../styles/meta";

/** Duration follows the caption track, so editing captions in the Studio resizes the video. */
export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = ({
  props,
}) => {
  // Xét cả mốc kết thúc của cảnh: với bản thu sẵn, audio có thể còn chạy sau
  // câu cuối (khoảng lặng đuôi) — chỉ nhìn caption là cắt mất phần đó.
  const lastEndMs = Math.max(
    props.captions.reduce((max, caption) => Math.max(max, caption.endMs), 0),
    props.scenes.reduce((max, scene) => Math.max(max, scene.endMs), 0),
    // Âm thanh thêm tay kéo dài quá câu cuối thì video dài theo.
    (props.audioClips ?? []).reduce((max, clip) => Math.max(max, clip.startMs + clip.durationMs), 0),
    (props.texts ?? []).reduce((max, text) => Math.max(max, text.endMs), 0),
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

/**
 * Phần hình do phong cách quyết định (src/styles/), phần tiếng dùng chung.
 * Cùng một props.json đổi `style` là ra video khác hẳn mà timing không lệch.
 */
export const Short: React.FC<ShortProps> = (props) => {
  const Style = STYLE_COMPONENTS[props.style as StyleId] ?? CaptionStyle;
  // Phụ đề tuỳ chỉnh: phong cách vẽ hình như thường nhưng không vẽ phụ đề của nó; lớp chung vẽ thay.
  // Âm thanh và độ dài video vẫn theo props.captions đầy đủ.
  const custom = usesCustomCaptions(props);
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      <Style {...(custom ? { ...props, captions: [] } : props)} />
      {custom ? <CustomCaptions props={props} /> : null}
      <TextOverlays texts={props.texts ?? []} />
      {props.watermark ? <WatermarkOverlay watermark={props.watermark} /> : null}
      <Soundtrack
        captions={props.captions}
        voiceoverTrack={props.voiceoverTrack}
        music={props.music}
        sfx={props.sfx}
        musicVolume={props.musicVolume}
        voiceVolume={props.voiceVolume}
        audioClips={props.audioClips}
      />
    </AbsoluteFill>
  );
};
