/**
 * Hằng số và phép tính dùng chung của phong cách "Điện ảnh": viền đen, nhịp chuyển cảnh,
 * cửa sổ thời gian của tiêu đề trailer (punch).
 */
import { Easing, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Easing chậm, êm — không lò xo, không nảy. */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** Số frame viền đen trượt vào ở đầu video. */
export const BARS_IN_FRAMES = 20;
/** Nửa độ dài nhúng đen quanh điểm cắt (frame). */
export const DIP_FRAMES = 12;
/** Cảnh sau hoà vào trong khoảng [cut - DISSOLVE, cut + DISSOLVE]. */
export const DISSOLVE_FRAMES = 6;

/** Tiêu đề trailer: hiện, giữ ~1.2 s, tắt. */
export const PUNCH_IN = 9;
export const PUNCH_HOLD = 36;
export const PUNCH_OUT = 12;

/** Khung ngang (16:9, 2:1) dùng bố cục ngang. */
export const isWide = (width: number, height: number) => width / height > 1.2;

/**
 * Chiều cao MỖI dải viền đen (px) khi đã trượt vào hết.
 * Ngang: ép khung hình về 2.39:1. Dọc: 10% chiều cao. Vuông/3:4: 8%.
 */
export const barHeight = (width: number, height: number) => {
  if (isWide(width, height)) {
    return Math.max(0, (height - width / 2.39) / 2);
  }
  return height * (height / width > 1.5 ? 0.1 : 0.08);
};

/** Frame nội dung của cảnh bắt đầu được phép hiện (cảnh đầu có title thì đợi title tắt). */
export const sceneAppear = (index: number, startFrame: number, showTitle: boolean, delay: number) =>
  index === 0 && showTitle ? TITLE_FRAMES + delay : startFrame + delay;

/** Mờ dần cuối cảnh, khớp nhúng đen; an toàn khi cảnh rất ngắn. */
export const sceneFadeOut = (frame: number, from: number, endFrame: number) => {
  const outStart = Math.max(from + 1, endFrame - DIP_FRAMES);
  return interpolate(frame, [outStart, outStart + 8], [1, 0], clamp);
};

/**
 * Mức hiện của tiêu đề trailer tại frame (0–1) — lớn nhất trong mọi cảnh có punch.
 * Dùng để làm tối hình và ẩn các lớp khác trong lúc tiêu đề đang giữ.
 */
export const punchPresence = (scenes: Scene[], frame: number) => {
  let presence = 0;
  for (const scene of scenes) {
    if (!scene.punch) continue;
    const at = msToFrames(scene.punch.atMs);
    if (frame < at - 1 || frame > at + PUNCH_IN + PUNCH_HOLD + PUNCH_OUT) continue;
    presence = Math.max(
      presence,
      interpolate(
        frame,
        [at, at + PUNCH_IN, at + PUNCH_IN + PUNCH_HOLD, at + PUNCH_IN + PUNCH_HOLD + PUNCH_OUT],
        [0, 1, 1, 0],
        clamp,
      ),
    );
  }
  return presence;
};

/** In hoa an toàn cho tiếng Việt — KHÔNG dùng CSS text-transform. */
export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");
