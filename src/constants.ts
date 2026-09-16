export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Frames of tail padding after the last caption ends. */
export const OUTRO_FRAMES = 30;

/** Length of the intro title card. Lives here, not in the component tree, so
 *  Node-side scripts can import it without pulling in browser-only packages. */
export const TITLE_FRAMES = 70;

export const msToFrames = (ms: number) => Math.round((ms / 1000) * FPS);

/**
 * Kích thước MẶC ĐỊNH. Kích thước thật của từng video nằm ở props.aspect và do
 * calculateMetadata quyết định — xem src/aspects.ts. Hai hằng số này chỉ dùng
 * làm giá trị khởi tạo cho composition và cho script xử lý ảnh khi chưa biết aspect.
 */
