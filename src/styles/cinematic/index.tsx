import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { Footage, Letterbox, LensLook } from "./Footage";
import { ChapterTag, CineCaptions, CineTitle, CineVisual, TrailerCard } from "./Text";

/**
 * Phong cách "Điện ảnh": viền đen, chỉnh màu teal–cam, dolly chậm, phụ đề chữ có chân,
 * câu nhấn hiện như tiêu đề trailer. Xem skill style-cinematic.
 * Thứ tự lớp: footage → ống kính → visual → tag → tiêu đề trailer → phụ đề → title → viền đen.
 * `accent` không dùng; `background` chỉ pha nhẹ vào nền cảnh không có ảnh.
 */
export const CinematicStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  background,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Footage scenes={scenes} background={background} />
    <LensLook scenes={scenes} showTitle={showTitle} />
    <CineVisual scenes={scenes} showTitle={showTitle} position={captionPosition} />
    <ChapterTag scenes={scenes} showTitle={showTitle} />
    <TrailerCard scenes={scenes} />
    <CineCaptions captions={captions} scenes={scenes} position={captionPosition} showTitle={showTitle} />

    {!showTitle ? null : (
      <Sequence durationInFrames={TITLE_FRAMES}>
        <CineTitle title={title} subtitle={subtitle} />
      </Sequence>
    )}

    <Letterbox />
  </AbsoluteFill>
);
