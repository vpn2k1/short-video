/**
 * Màu, camera và tư thế tấm ảnh của phong cách "Cảnh 3D thật" (Three.js).
 *
 * Camera cố định ở (0, 0, CAMERA_Z) nhìn về gốc, góc nhìn dọc FOV độ. Mọi kích thước trên màn hình quy về
 * "đơn vị thế giới" qua pxPerUnit(): tại mặt phẳng z = 0, một đơn vị = pxPerUnit pixel. Nhờ vậy tấm ảnh 3D đặt
 * đúng khung mà phong cách "Không gian 3D" dùng (usePanelBox), và clip video — vẽ bằng DOM có CSS 3D vì không
 * dán được lên khối WebGL mà vẫn giữ cắt đầu/tốc độ/tiếng — trùng khít với tấm 3D nhờ cùng một phép chiếu.
 */
import { Easing, interpolate, spring } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";
import { isMediaCrop } from "../../scenes/CropBox";
import { arriveAt } from "../depth/Stage";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = { ...clamp, easing: Easing.out(Easing.cubic) } as const;

/** Chữ: Lexend biến thiên 100–900, nét tròn hiện đại, đủ dấu tiếng Việt, đóng gói sẵn. */
export const SANS = FONT_CATALOG.lexend.stack;
export const THREE_FONTS = ["lexend"];

export const FOV = 35;
export const CAMERA_Z = 10;
/** Số frame tấm ảnh cũ văng ra khỏi khung khi cảnh mới xoay tới. */
export const EXIT_FRAMES = 22;
/** Độ dày tấm ảnh, đơn vị thế giới. */
export const SLAB_DEPTH = 0.14;

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
export const isVideo = (src: string | null) => Boolean(src && VIDEO_EXT.test(src));

/** Pixel trên mỗi đơn vị thế giới tại mặt phẳng z = 0 (cũng là tiêu cự CSS perspective chia CAMERA_Z). */
export const focalPx = (height: number) => height / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
export const pxPerUnit = (height: number) => focalPx(height) / CAMERA_Z;

/* ------------------------------------------------------------ bảng màu */

const hueOf = (hex: string): { h: number; s: number } | null => {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s };
};

export type Palette = {
  hue: number;
  /** Màu nhấn đậm: thành tấm ảnh, khối kim loại chính, chữ nhấn. */
  key: string;
  /** Màu phụ (lệch 150° cho đỡ chói): khối thứ hai, ánh đèn viền. */
  second: string;
  /** Nền studio (DOM, sau canvas) và màu sương mù — phải cùng tông để vật ở xa tan vào nền. */
  backdrop: string;
  fog: string;
  glow: (alpha: number) => string;
};

/** Mọi màu suy từ `accent`; accent xám/trắng/đen → xanh hoàng hôn (220°). */
export const paletteFor = (accent: string): Palette => {
  const c = hueOf(accent);
  const hue = !c || c.s < 0.15 ? 220 : Math.round(c.h);
  const second = (hue + 150) % 360;
  return {
    hue,
    key: `hsl(${hue}, 85%, 58%)`,
    second: `hsl(${second}, 80%, 62%)`,
    backdrop: `radial-gradient(ellipse 90% 70% at 50% 38%, hsl(${hue}, 40%, 22%) 0%, hsl(${hue}, 45%, 9%) 55%, hsl(${hue}, 50%, 4%) 100%)`,
    fog: `hsl(${hue}, 45%, 8%)`,
    glow: (alpha) => `hsla(${hue}, 95%, 62%, ${alpha})`,
  };
};

/* ------------------------------------------------------------ tư thế tấm ảnh */

export type Pose = {
  x: number;
  y: number;
  z: number;
  /** Góc Euler thứ tự XYZ của Three.js, radian. */
  rx: number;
  ry: number;
  rz: number;
  scale: number;
};

/**
 * Tư thế tấm ảnh của cảnh `index` tại `frame` (đơn vị thế giới, gốc là tâm khung `usePanelBox`).
 * Tới: bay từ sâu -14, xoay gần nửa vòng quanh trục đứng (hướng xen kẽ) rồi dừng nghiêng nhẹ, có nảy.
 * Trong cảnh: đẩy máy chậm tới, lắc lư, bồng bềnh. Đi (khi cảnh sau tới): văng lên chéo ra ngoài khung, xoay lộn.
 */
export const poseAt = (
  frame: number,
  fps: number,
  scene: Scene,
  index: number,
  showTitle: boolean,
  leavingAt: number | null,
): Pose => {
  const at = arriveAt(scene, index, showTitle);
  const end = Math.max(at + 1, msToFrames(scene.endMs));
  const dir = index % 2 === 0 ? 1 : -1;
  const enter = spring({ frame: frame - at, fps, config: { damping: 15, mass: 1 }, durationInFrames: 34 });
  const base: Pose = {
    x: 0,
    y: Math.sin(frame / 38 + index) * 0.06,
    z: interpolate(enter, [0, 1], [-14, 0]) + interpolate(frame, [at, end + EXIT_FRAMES], [0, 0.7], clamp),
    rx: -0.05 + Math.sin(frame / 64) * 0.035,
    ry: interpolate(enter, [0, 1], [dir * Math.PI * 0.95, dir * -0.14]) + Math.sin(frame / 52 + index) * 0.07,
    rz: interpolate(enter, [0, 1], [dir * 0.25, 0]),
    scale: 1,
  };
  if (leavingAt === null || frame < leavingAt) return base;
  const t = interpolate(frame, [leavingAt, leavingAt + EXIT_FRAMES], [0, 1], clamp);
  const e = t * t;
  return {
    ...base,
    x: -dir * 7 * e,
    y: base.y + 2.2 * e,
    z: base.z + 2.5 * e,
    ry: base.ry - dir * 1.6 * e,
    rz: dir * 0.7 * e,
  };
};

/** Tấm ảnh còn cần vẽ không (đã tới, chưa văng hẳn ra ngoài). */
export const poseVisible = (frame: number, scene: Scene, index: number, showTitle: boolean, leavingAt: number | null) =>
  frame >= arriveAt(scene, index, showTitle) && (leavingAt === null || frame < leavingAt + EXIT_FRAMES);

/**
 * Tấm ảnh dán được thẳng lên khối WebGL: ảnh tĩnh, không crop hoặc crop chỉ cắt vùng (không xoay/lật, không kiểu cũ).
 * Còn lại (clip video, crop xoay/lật) vẽ bằng DOM CSS 3D trùng vị trí.
 */
export const textureable = (scene: Scene) => {
  if (!scene.image || isVideo(scene.image)) return false;
  if (!scene.crop) return true;
  return isMediaCrop(scene.crop) && scene.crop.rotate === 0 && !scene.crop.flipH && !scene.crop.flipV && scene.crop.fit === "cover";
};
