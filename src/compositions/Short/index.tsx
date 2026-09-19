import { AbsoluteFill, CalculateMetadataFunction } from "remotion";
import { FPS } from "../../constants";
import { ASPECTS, DEFAULT_ASPECT, type AspectId } from "../../aspects";
import type { ShortProps } from "./schema";
import { videoDurationInFrames } from "./duration";
import { Soundtrack } from "../../audio/Soundtrack";
import { MediaOverlays } from "../../components/MediaOverlays";
import { TextOverlays } from "../../components/TextOverlays";
import { CustomCaptions } from "../../components/CustomCaptions";
import { usesCustomCaptions } from "../../components/captionLook";
import { WatermarkOverlay } from "../../components/WatermarkOverlay";
import { STYLE_COMPONENTS, STYLE_TOP_LAYERS } from "../../styles/registry";
import { CaptionStyle } from "../../styles/caption";
import { FONTS } from "../../styles/shared";
import { ensureFonts, fontsUsedBy } from "../../fonts/load";
import type { StyleId } from "../../styles/meta";

/** Duration follows the timeline items (see videoDurationInFrames), so editing in the Studio resizes the video. */
export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = ({
  props,
}) => {
  return {
    durationInFrames: videoDurationInFrames(props),
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
  const StyleTop = STYLE_TOP_LAYERS[props.style as StyleId];
  // Phụ đề tuỳ chỉnh: phong cách vẽ hình như thường nhưng không vẽ phụ đề của nó; lớp chung vẽ thay.
  // Âm thanh và độ dài video vẫn theo props.captions đầy đủ.
  const custom = usesCustomCaptions(props);
  // Font đóng gói mà phụ đề/văn bản dùng — Remotion đợi nạp xong mới chụp khung hình.
  ensureFonts(fontsUsedBy(props));
  const styleProps = custom ? { ...props, captions: [] } : props;
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      <Style {...styleProps} />
      <MediaOverlays overlays={props.overlays ?? []} />
      {StyleTop ? <StyleTop {...styleProps} /> : null}
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
