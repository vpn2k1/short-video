import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { Footage } from "./Footage";
import { VhsLook } from "./Look";
import { Osd } from "./Osd";
import { RetroCaptions, RetroPunch, RetroVisual } from "./Text";
import { RetroTitle } from "./TitleIntro";

/**
 * Phong cách "Băng VHS" — xem skill style-retro.
 *
 * Footage máy quay thập niên 80–90: màu nhạt ấm, lệch màu đỏ/xanh, rung ngang,
 * OSD REC/pin/ngày giờ, phụ đề TV cũ, giật tín hiệu cho câu nhấn, màn hình xanh mở đầu.
 * Thứ tự lớp: footage → số liệu → punch → phụ đề → OSD → title → lớp băng từ (trên cùng,
 * để scanline và cú nhiễu phủ cả chữ như tín hiệu thật).
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
export const RetroStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Footage scenes={scenes} />
    <RetroVisual scenes={scenes} showTitle={showTitle} />
    <RetroPunch scenes={scenes} captionPosition={captionPosition} />
    <RetroCaptions captions={captions} position={captionPosition} showTitle={showTitle} />
    <Osd scenes={scenes} title={title} showTitle={showTitle} />
    {showTitle ? (
      <Sequence durationInFrames={TITLE_FRAMES}>
        <RetroTitle title={title} subtitle={subtitle} />
      </Sequence>
    ) : null}
    <VhsLook scenes={scenes} showTitle={showTitle} />
  </AbsoluteFill>
);
