import { AbsoluteFill, Easing, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { activeIndexAt, seeded, useCaptionClock, useSceneClock, useLayout } from "../shared";
import { SceneLayer } from "./Layer";
import { buildPalette } from "./palette";
import { TitleIntro } from "./TitleIntro";

/** Số frame của cú chuyển nền giữa hai cảnh. */
const TRANSITION_FRAMES = 14;

/**
 * Phong cách "Chữ động" — xem skill style-kinetic.
 *
 * Lời đọc chính là hình: câu đang đọc in hoa cỡ lớn, từng từ bật vào theo nhịp.
 * Mỗi cảnh một nền màu phẳng (mực → accent → giấy → màu bổ túc). Đổi cảnh bằng
 * cú lộ nền (vòng tròn / gạt chéo / trượt): cảnh mới vẽ đè lên cảnh cũ và bị cắt
 * bằng clip-path, nên chữ cũng đổi màu đúng theo mép chuyển — chỉ hai lớp được vẽ
 * trong lúc chuyển, còn lại chỉ một lớp.
 */
export const KineticStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  background,
  captions,
  scenes,
  showTitle,
}) => {
  const { frame, index: rawSceneIndex } = useSceneClock(scenes);
  const { caption, index: captionIndex } = useCaptionClock(captions);
  const { width, height } = useLayout();

  const palette = buildPalette(accent, background);
  const sceneIndex = scenes.length === 0 ? -1 : Math.max(0, rawSceneIndex);
  const scene = sceneIndex >= 0 ? scenes[sceneIndex] : null;
  const introEnd = showTitle ? TITLE_FRAMES - 6 : 0;
  const swatchFor = (i: number) => palette[Math.max(0, i) % palette.length];

  const common = {
    sceneCount: scenes.length,
    scenes,
    caption,
    captionIndex,
    captions,
    introEnd,
    fallbackText: title,
  };

  // Chuyển cảnh: chỉ khi cảnh hiện tại không phải cảnh đầu và đang trong cửa sổ chuyển.
  const sceneStart = scene ? msToFrames(scene.startMs) : 0;
  const inTransition = sceneIndex > 0 && frame < sceneStart + TRANSITION_FRAMES;
  const prevCaptionIndex = inTransition ? activeIndexAt(captions, sceneStart - 1) : -1;
  let clipPath: string | undefined;
  let translate: string | undefined;
  if (inTransition) {
    const p = interpolate(frame, [sceneStart, sceneStart + TRANSITION_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.75, 0, 0.2, 1),
    });
    const kind = sceneIndex % 3;
    if (kind === 1) {
      // Vòng tròn nở từ một điểm cố định theo seed.
      const cx = Math.round(seeded(`kin-cx-${sceneIndex}`, 20, 80));
      const cy = Math.round(seeded(`kin-cy-${sceneIndex}`, 25, 75));
      const radius = Math.hypot(width, height) * p;
      clipPath = `circle(${radius}px at ${cx}% ${cy}%)`;
    } else if (kind === 2) {
      // Gạt chéo từ trái sang phải.
      const e = -30 + p * 160;
      clipPath = `polygon(0% 0%, ${e + 30}% 0%, ${e}% 100%, 0% 100%)`;
    } else {
      // Tấm nền mới trượt lên từ đáy.
      translate = `0px ${(1 - p) * height}px`;
    }
  }

  return (
    <AbsoluteFill>
      {inTransition ? (
        // Lớp cũ giữ câu đang hiện ngay trước mốc cắt (thường đã bay ra hết), để không
        // vẽ trùng câu mới ở hai bố cục khác nhau.
        <SceneLayer
          {...common}
          caption={prevCaptionIndex >= 0 ? captions[prevCaptionIndex] : null}
          captionIndex={prevCaptionIndex}
          scene={scenes[sceneIndex - 1]}
          sceneIndex={sceneIndex - 1}
          swatch={swatchFor(sceneIndex - 1)}
        />
      ) : null}
      <SceneLayer
        {...common}
        scene={scene}
        sceneIndex={sceneIndex}
        swatch={swatchFor(sceneIndex)}
        clipPath={clipPath}
        translate={translate}
      />
      {showTitle ? <TitleIntro title={title} subtitle={subtitle} handle={handle} swatch={palette[1]} /> : null}
    </AbsoluteFill>
  );
};
