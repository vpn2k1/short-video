/**
 * Màu, font, hình học màn hình và vài hàm nhỏ của phong cách "Story điện thoại".
 *
 * Mọi thứ trong màn hình story vẽ trên một "canvas ảo" rộng 1080px (cao 1920px khi đặt trong điện thoại,
 * hoặc cao theo đúng khung khi 9:16 toàn màn hình) rồi thu phóng cả khối bằng scale — nhờ vậy nhãn dán,
 * thanh tiến độ, thanh trả lời giữ đúng tỉ lệ như trên điện thoại thật ở mọi tỉ lệ khung hình.
 */
import { createContext, useContext } from "react";
import { FONT_CATALOG } from "../../fonts/catalog";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Chữ giao diện và nhãn dán chữ: không chân, đậm, đủ dấu tiếng Việt, đóng gói sẵn (chạy cả Windows). */
export const UI = FONT_CATALOG.bevietnam.stack;
/** Chữ tròn mập cho nhãn dán kiểu GIF của câu nhấn. */
export const GIF = FONT_CATALOG.baloo.stack;
export const STORY_FONTS = ["bevietnam", "baloo"];

/** Bề rộng canvas ảo của màn hình story. */
export const VW = 1080;

export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** "image" của cảnh có thể là video người dùng tải lên. */
export const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/* ------------------------------------------------------------ hình học */

export type Geo = {
  /** Chiều cao canvas ảo (px ảo, bề rộng luôn là VW). */
  vh: number;
  /** Mép trên của thanh tiến độ. */
  top: number;
  /** Khoảng từ đáy canvas tới đáy thanh "Gửi tin nhắn". */
  bottom: number;
  /** true = màn hình nằm trong khung điện thoại giữa nền mờ (16:9, 1:1, 3:4). */
  phone: boolean;
};

export const GeoContext = createContext<Geo>({ vh: 1920, top: 110, bottom: 170, phone: false });
export const useGeo = () => useContext(GeoContext);

/** Đáy phần đầu story (thanh tiến độ + avatar) — nhãn dán phía trên bắt đầu từ đây. */
export const headerBottom = (geo: Geo) => geo.top + 26 + 104;

/* ------------------------------------------------------------ thời gian */

/** Frame đầu tiên phần tử của cảnh được phép hiện: cảnh đầu phải đợi màn mở đầu xong. */
export const appearAt = (index: number, startFrame: number, showTitle: boolean) =>
  index <= 0 && showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;

/** Frame câu nhấn của cảnh hiện ra, hoặc null khi cảnh không có câu nhấn. */
export const punchFrame = (scene: Scene, index: number, showTitle: boolean) =>
  scene.punch ? Math.max(msToFrames(scene.punch.atMs), appearAt(index, msToFrames(scene.startMs), showTitle) + 6) : null;

/** Câu nhấn kết bằng "?" → nhãn dán thăm dò ý kiến; còn lại → nhãn GIF + mưa emoji. */
export const isPoll = (text: string) => /[?？]\s*$/.test(text.trim());

/* ------------------------------------------------------------ màu */

const rgbOf = (hex: string): [number, number, number] | null => {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/** Sắc độ (0–360) của accent; accent xám/không đọc được → hồng story mặc định. */
export const hueOf = (hex: string) => {
  const rgb = rgbOf(hex);
  if (!rgb) return 330;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return 330;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};

/** Màu nhấn đã kiểm tra: accent không đọc được thì về hồng. */
export const safeAccent = (hex: string) => (rgbOf(hex) ? hex : "#ff3d7f");

/** Chữ trắng hay đen trên nền màu `bg` — accent vàng/xanh nhạt thì chữ đen mới đọc được. */
export const inkOn = (bg: string) => {
  const rgb = rgbOf(bg);
  if (!rgb) return "#fff";
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#111" : "#fff";
};

/** Vòng story quanh avatar: accent → cam → hồng → tím. */
export const ringGradient = (accent: string, from = 210) =>
  `conic-gradient(from ${from}deg, ${accent}, #ffb13d, #ff3d7f, #a93dff, ${accent})`;

/** Chữ gradient của nhãn vị trí / nhắc tên. */
export const textGradient = (accent: string) => `linear-gradient(95deg, ${accent} 0%, #ff3d7f 55%, #a93dff 100%)`;

/**
 * Nền chế độ "Tạo" (cảnh không ảnh): gradient chéo hai màu, xoay sắc độ theo số cảnh để các khung chữ
 * liên tiếp không giống hệt nhau.
 */
export const createGradient = (accent: string, index: number) => {
  const h = (hueOf(accent) + index * 38) % 360;
  return `linear-gradient(155deg, hsl(${h}, 88%, 62%) 0%, hsl(${(h + 34) % 360}, 82%, 52%) 52%, hsl(${(h + 70) % 360}, 72%, 38%) 100%)`;
};

/* ------------------------------------------------------------ chữ */

/** Chữ cái đầu của handle cho avatar ("@ban_than" → "B"). */
export const initialOf = (handle: string, fallback: string) => {
  const name = handle.normalize("NFC").replace(/^@+/, "").trim() || fallback.normalize("NFC").trim();
  const first = Array.from(name).find((c) => /\p{L}|\p{N}/u.test(c));
  return first ? first.toLocaleUpperCase("vi") : "•";
};

/** Tên hiển thị trên đầu story: bỏ "@", quá dài thì cắt "…". */
export const displayHandle = (handle: string) => {
  const name = Array.from(handle.normalize("NFC").replace(/^@+/, "").trim() || "tin_cua_ban");
  return name.length > 22 ? `${name.slice(0, 21).join("")}…` : name.join("");
};

/** Cỡ chữ co theo độ dài: tới `short` ký tự giữ nguyên, dài hơn co theo căn bậc hai, không dưới `min`. */
export const shrink = (text: string, base: number, short: number, min = 0.58) => {
  const length = Array.from(text.normalize("NFC")).length;
  return Math.round(base * (length <= short ? 1 : Math.max(min, Math.sqrt(short / length))));
};

/** Emoji cho mưa cảm xúc của câu nhấn, chọn theo nghĩa câu. */
export const reactionEmoji = (text: string) => {
  const t = text.normalize("NFC").toLocaleLowerCase("vi");
  if (/cười|hài|vui|lầy|hề|haha/.test(t)) return ["😂", "🤣", "😆"];
  if (/yêu|thương|đẹp|xinh|dễ thương|cute|mê/.test(t)) return ["😍", "🥰", "❤️"];
  if (/sốc|bất ngờ|trời|không ngờ|choáng|sợ/.test(t)) return ["😱", "😮", "🤯"];
  if (/ngon|đói|ăn|món/.test(t)) return ["🤤", "😋", "🔥"];
  if (/buồn|khóc|tiếc|mệt/.test(t)) return ["🥲", "😢", "🫶"];
  return ["🔥", "👏", "😍"];
};
