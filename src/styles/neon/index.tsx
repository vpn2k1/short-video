/**
 * Phong cách "Đêm neon" — xem skill `.claude/skills/style-neon/SKILL.md`.
 *
 * Phố đêm: ảnh/video tối đi, ngả xanh đêm – tím hồng; không ảnh thì tường gạch. Phụ đề là chữ ống neon
 * màu chính (suy từ accent) bật lên chập chờn mỗi câu; câu nhấn là biển hiệu chữ viết liền màu ống phụ
 * (màu bù); tag là biển "OPEN" nhỏ ở góc; số liệu là con số neon lớn. Sương mù màu và vệt phản chiếu quét chéo.
 *
 * Thứ tự lớp: nền (cảnh + sương + phản chiếu) → số liệu → tag → câu nhấn → phụ đề → màn hình tiêu đề.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { Backdrop } from "./Backdrop";
import { NEON_FONTS, NIGHT, paletteFor } from "./neon";
import { NeonCaptions, NeonPunch, NeonTag, NeonVisual } from "./Signs";
import { NeonTitle } from "./TitleIntro";

export const NeonStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  ensureFonts(NEON_FONTS);
  const palette = paletteFor(accent);
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <Backdrop scenes={scenes} palette={palette} />
      <NeonVisual scenes={scenes} showTitle={showTitle} palette={palette} />
      <NeonTag scenes={scenes} showTitle={showTitle} palette={palette} />
      <NeonPunch scenes={scenes} captionPosition={captionPosition} showTitle={showTitle} palette={palette} />
      <NeonCaptions captions={captions} scenes={scenes} position={captionPosition} showTitle={showTitle} palette={palette} />
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <NeonTitle title={title} subtitle={subtitle} palette={palette} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
