import { msToFrames, OUTRO_FRAMES, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "./schema";

type TimelineItems = Pick<ShortProps, "captions" | "scenes"> &
  Partial<Pick<ShortProps, "audioClips" | "texts" | "overlays">>;

const hasTimelineVideo = (props: TimelineItems) => (props.overlays ?? []).length > 0;

/**
 * Mốc kết thúc của thứ cuối cùng trên timeline — video dài tới đây (xem videoDurationInFrames).
 *
 * Cảnh không mang hình KHI đã có lớp video thì không tính: đó là nền rỗng mà trình chỉnh sửa trải
 * sau các video (dự án mới, hoặc sau khi gộp cảnh thành video — unifyScenes). Hàng Cảnh khi ấy bị
 * ẩn nên không ai kéo được nó, mà nó vẫn giữ độ dài clip lúc đầu — thu ngắn video trên timeline thì
 * video không ngắn lại. Chưa có lớp nào (bản thu sẵn chỉ có tiếng, chữ động không ảnh…) thì cảnh vẫn
 * tính như cũ: với bản thu sẵn, mép cảnh là mép audio, còn khoảng lặng đuôi sau câu cuối.
 */
export const lastItemEndMs = (props: TimelineItems) => {
  const overlays = props.overlays ?? [];
  const scenesCount = !hasTimelineVideo(props) || props.scenes.some((scene) => scene.image);
  return Math.max(
    props.captions.reduce((max, caption) => Math.max(max, caption.endMs), 0),
    scenesCount ? props.scenes.reduce((max, scene) => Math.max(max, scene.endMs), 0) : 0,
    // Âm thanh thêm tay kéo dài quá câu cuối thì video dài theo.
    (props.audioClips ?? []).reduce((max, clip) => Math.max(max, clip.startMs + clip.durationMs), 0),
    (props.texts ?? []).reduce((max, text) => Math.max(max, text.endMs), 0),
    // Lớp video chồng kéo dài quá cảnh cuối thì video dài theo.
    overlays.reduce((max, overlay) => Math.max(max, overlay.endMs), 0),
  );
};

/**
 * Số frame của video — dùng chung cho calculateShortMetadata (lúc xuất) và videoMeta của trình chỉnh
 * sửa, để hai bên không bao giờ lệch nhau.
 *
 * Video dựng tự động có thêm OUTRO_FRAMES sau thứ cuối cùng cho giọng đọc và nhạc kịp dứt. Dự án đã có
 * khối video trên timeline thì dừng đúng ở mép thứ cuối cùng, như CapCut: thu ngắn video là video hết
 * ở đó, không còn một đoạn đen ở cuối.
 */
export const videoDurationInFrames = (props: TimelineItems) =>
  Math.max(TITLE_FRAMES, msToFrames(lastItemEndMs(props)) + (hasTimelineVideo(props) ? 0 : OUTRO_FRAMES));
