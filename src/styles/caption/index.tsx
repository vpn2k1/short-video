import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { Background } from "../../scenes/Background";
import { Scenes, Scrim } from "../../scenes/Scenes";
import { SceneVisual } from "../../scenes/SceneVisual";
import { Captions } from "../../captions/Captions";
import { ProgressBar } from "../../components/ProgressBar";
import { TitleCard } from "../../components/TitleCard";
import type { ShortProps } from "../../compositions/Short/schema";

/**
 * Phong cách gốc: ảnh nền + phụ đề nổi bật từng câu. Xem skill style-caption.
 * Thứ tự lớp: nền gradient → ảnh của cảnh → lớp tối → hình vẽ → title → phụ đề → tiến độ.
 */
export const CaptionStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  background,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => (
  <AbsoluteFill>
    <Background accent={accent} background={background} />
    <Scenes scenes={scenes} />
    <Scrim />
    <SceneVisual scenes={scenes} accent={accent} />

    {!showTitle ? null : (
      <Sequence durationInFrames={TITLE_FRAMES}>
        <TitleCard title={title} subtitle={subtitle} accent={accent} />
      </Sequence>
    )}

    <Captions captions={captions} accent={accent} position={captionPosition} />
    <ProgressBar accent={accent} />
  </AbsoluteFill>
);
