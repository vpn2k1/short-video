import { ChapterMarker } from "../../components/ChapterMarker";
import type { ShortProps } from "../Short/schema";
import { Short } from "../Short";

export { calculateShortMetadata as calculateLongVideoMetadata } from "../Short";

/**
 * Video dài: dùng lại toàn bộ bộ khung của Short, thêm nhãn chương ở đầu mỗi cảnh.
 * Không fork cây render — sửa Short là cả hai cùng được.
 */
export const LongVideo: React.FC<ShortProps> = (props) => (
  <>
    <Short {...props} />
    <ChapterMarker scenes={props.scenes} accent={props.accent} />
  </>
);
