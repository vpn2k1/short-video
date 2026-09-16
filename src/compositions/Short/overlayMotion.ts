import type { OverlayKeyframe } from "./schema";

/** Các thuộc tính chạy được theo keyframe. */
export type OverlayTransform = Pick<OverlayKeyframe, "x" | "y" | "width" | "rotate" | "opacity">;

/**
 * Mọi thứ có chuyển động: CẢNH trên track chính và LỚP đè đều khớp hình này, nên cùng dùng
 * các hàm dưới đây — một bộ logic chuyển động cho cả hai.
 */
export type MotionTarget = OverlayTransform & { keyframes?: OverlayKeyframe[] };

export const overlayKeyframes = (o: MotionTarget): OverlayKeyframe[] =>
  [...(o.keyframes ?? [])].sort((a, b) => a.atMs - b.atMs);

/** Giá trị tĩnh — dùng khi chưa có mốc nào, và làm gốc khi ghim mốc đầu tiên. */
export const overlayBase = (o: MotionTarget): OverlayTransform =>
  ({ x: o.x, y: o.y, width: o.width, rotate: o.rotate, opacity: o.opacity });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Vị trí/cỡ/góc/độ mờ của cảnh hoặc lớp tại thời điểm `ms`.
 *
 * Không có mốc → giá trị tĩnh. Một mốc → đứng yên ở mốc đó. Nhiều mốc → nội suy tuyến tính giữa hai
 * mốc gần nhất; trước mốc đầu và sau mốc cuối thì giữ nguyên mốc đó (không ngoại suy để lớp khỏi bay
 * ra khỏi khung).
 */
export const overlayTransformAt = (o: MotionTarget, ms: number): OverlayTransform => {
  const keys = overlayKeyframes(o);
  if (keys.length === 0) return overlayBase(o);
  const pick = ({ x, y, width, rotate, opacity }: OverlayKeyframe): OverlayTransform => ({ x, y, width, rotate, opacity });
  if (keys.length === 1 || ms <= keys[0].atMs) return pick(keys[0]);
  const last = keys[keys.length - 1];
  if (ms >= last.atMs) return pick(last);

  const next = keys.findIndex((k) => k.atMs > ms);
  const a = keys[next - 1];
  const b = keys[next];
  // Hai mốc cùng thời điểm: nhảy thẳng sang mốc sau, không chia cho 0.
  const span = b.atMs - a.atMs;
  const t = span <= 0 ? 1 : (ms - a.atMs) / span;
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    width: lerp(a.width, b.width, t),
    rotate: lerp(a.rotate, b.rotate, t),
    opacity: lerp(a.opacity, b.opacity, t),
  };
};
