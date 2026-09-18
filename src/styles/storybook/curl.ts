/**
 * Lật trang cuộn góc: góc dưới phải của trang cũ bị kéo lên, gập theo một đường thẳng chạy dần về góc trên trái.
 * Phần đã gập lộ trang mới bên dưới; nếp gấp (mặt sau tờ giấy) là phần bị cắt phản chiếu qua đường gập.
 * Toàn hình học phẳng nên vẽ bằng clip-path + SVG, không cần 3D.
 */
export type Point = [number, number];

/** Cắt đa giác, giữ phần có f(p) >= 0 (Sutherland–Hodgman với một nửa mặt phẳng). */
const clipHalf = (poly: Point[], f: (p: Point) => number): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
};

export type Curl = {
  /** Phần trang cũ còn nằm phẳng (clip-path). */
  kept: Point[];
  /** Nếp gập — mặt sau tờ giấy, nằm đè lên phần còn lại. */
  flap: Point[];
  /** Hai đầu đường gập (để vẽ bóng dọc nếp). */
  fold: [Point, Point] | null;
};

/** `t` 0 → trang phẳng, 1 → đã lật hết. */
export const curlAt = (width: number, height: number, t: number): Curl => {
  const rect: Point[] = [[0, 0], [width, 0], [width, height], [0, height]];
  // Hướng kéo: từ góc dưới phải về phía trên trái, hơi dốc để nếp gập nghiêng như tay lật.
  const len = Math.hypot(width * 0.7, height);
  const n: Point = [(width * 0.7) / len, height / len];
  const corner: Point = [width, height];
  const s = (p: Point) => (corner[0] - p[0]) * n[0] + (corner[1] - p[1]) * n[1];
  // Hết trang khi đường gập qua góc trên trái.
  const d = t * s([0, 0]) * 1.02;
  const kept = clipHalf(rect, (p) => s(p) - d);
  const removed = clipHalf(rect, (p) => d - s(p));
  const flap = removed.map((p): Point => {
    const k = 2 * (d - s(p));
    return [p[0] - k * n[0], p[1] - k * n[1]];
  });
  // Đường gập = các điểm của phần bị cắt nằm đúng trên đường s = d.
  const onFold = removed.filter((p) => Math.abs(s(p) - d) < 0.5);
  return { kept, flap, fold: onFold.length >= 2 ? [onFold[0], onFold[onFold.length - 1]] : null };
};

export const polygonCss = (points: Point[]) =>
  points.length < 3 ? "polygon(0 0, 0 0, 0 0)" : `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;

export const polygonSvg = (points: Point[]) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
