/**
 * Phong cách "Không gian 3D" — xem skill `.claude/skills/style-depth/SKILL.md`.
 *
 * Mọi thứ trong một khoảng không có chiều sâu thật (CSS 3D, không cần WebGL — render nhanh trên mọi máy): trời tối
 * ngả màu nhấn, sàn lưới phối cảnh trôi về phía camera, sao bay tới, khối khung dây xoay. Ảnh/clip của cảnh là một
 * tấm kính có độ dày bay tới từ xa, lắc lư nhẹ, rồi lao qua camera khi sang cảnh sau. Chữ là chữ khối nổi.
 *
 * Thứ tự lớp: không gian → tấm kính → số liệu → tag → câu nhấn → phụ đề → màn hình tiêu đề.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { AbsoluteFill, interpolate, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { DEPTH_FONTS, paletteFor, VOID } from "./depth";
import { Space } from "./Space";
import { Stage, useArrival } from "./Stage";
import { DepthCaptions, DepthPunch, DepthTag, DepthVisual } from "./Text";
import { DepthTitle } from "./TitleIntro";

export const DepthStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  ensureFonts(DEPTH_FONTS);
  const palette = paletteFor(accent);
  // Lúc tấm kính mới đang bay tới, sao và sàn chạy nhanh hơn như camera tăng tốc.
  const arrival = useArrival(scenes, showTitle);
  const rush = 1 + 3 * interpolate(arrival, [0, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: VOID }}>
      <Space palette={palette} rush={rush} />
      <Stage scenes={scenes} showTitle={showTitle} palette={palette} />
      <DepthVisual scenes={scenes} showTitle={showTitle} palette={palette} />
      <DepthTag scenes={scenes} showTitle={showTitle} palette={palette} />
      <DepthPunch scenes={scenes} captionPosition={captionPosition} showTitle={showTitle} palette={palette} />
      <DepthCaptions captions={captions} scenes={scenes} position={captionPosition} showTitle={showTitle} palette={palette} />
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <DepthTitle title={title} subtitle={subtitle} palette={palette} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
