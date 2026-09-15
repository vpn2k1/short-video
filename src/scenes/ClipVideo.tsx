import { Video } from "@remotion/media";
import { staticFile } from "remotion";
import { msToFrames } from "../constants";
import type { SceneCrop } from "../compositions/Short/schema";
import { CropBox } from "./CropBox";

type Props = {
  src: string;
  /** Bỏ qua bao nhiêu ms đầu clip — chỉnh trong trình chỉnh sửa. */
  trimStartMs?: number;
  /** Tiếng gốc của clip, 0 = tắt. */
  volume?: number;
  /**
   * Tốc độ phát (không có = 1). trimStartMs vẫn tính theo thời gian clip gốc — @remotion/media lấy
   * thời điểm trong file = thời gian phát × playbackRate + trimBefore.
   */
  speed?: number;
  /** Chỉ lấy một vùng khung hình của clip. */
  crop?: SceneCrop | null;
  objectFit?: "cover" | "contain";
  style?: React.CSSProperties;
};

/**
 * Video làm nền cảnh — dùng chung cho mọi phong cách để cắt đầu clip, âm lượng và crop
 * chỉnh trong trình chỉnh sửa có tác dụng ở mọi nơi. Lặp nếu clip ngắn hơn cảnh.
 * Đặt trong <Sequence from={đầu cảnh}> để clip bắt đầu đúng lúc cảnh bắt đầu.
 */
export const ClipVideo: React.FC<Props> = ({
  src,
  trimStartMs = 0,
  volume = 0,
  speed = 1,
  crop = null,
  objectFit = "cover",
  style,
}) => (
  <CropBox crop={crop}>
    <Video
      src={staticFile(src)}
      loop
      muted={volume <= 0}
      volume={() => Math.max(0, volume)}
      playbackRate={speed}
      trimBefore={trimStartMs > 0 ? msToFrames(trimStartMs) : undefined}
      objectFit={objectFit}
      style={{ width: "100%", height: "100%", ...style }}
    />
  </CropBox>
);
