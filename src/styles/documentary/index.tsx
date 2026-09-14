import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { Footage, FilmLook } from "./Footage";
import { Clipping, DocCaptions, DocTitle, DocVisual, PlaceTag } from "./Overlays";

/**
 * Phong cách "Phim tài liệu": ảnh toàn khung Ken Burns, chỉnh màu ấm, hạt phim,
 * nhãn địa điểm gõ máy chữ, mẩu báo cắt cho câu nhấn. Xem skill style-documentary.
 * Thứ tự lớp: footage → lớp phim → số liệu/đóng dấu → mẩu báo → nhãn → title → phụ đề.
 */
export const DocumentaryStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  background,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => (
  <AbsoluteFill style={{ backgroundColor: "#050403" }}>
    <Footage scenes={scenes} background={background} />
    <FilmLook scenes={scenes} />
    <DocVisual scenes={scenes} showTitle={showTitle} />
    <Clipping scenes={scenes} />
    <PlaceTag scenes={scenes} showTitle={showTitle} />

    {!showTitle ? null : (
      <Sequence durationInFrames={TITLE_FRAMES}>
        <DocTitle title={title} subtitle={subtitle} handle={handle} />
      </Sequence>
    )}

    <DocCaptions captions={captions} scenes={scenes} position={captionPosition} />
  </AbsoluteFill>
);
