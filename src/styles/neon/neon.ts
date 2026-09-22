/**
 * Màu, ánh sáng và nhịp nhấp nháy của phong cách "Đêm neon".
 * Mọi "ngẫu nhiên" đi qua seeded() — cùng frame cùng hình, render song song không lệch.
 */
import { FONT_CATALOG } from "../../fonts/catalog";
import { seeded } from "../shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** "image" của cảnh có thể là video người dùng tải lên. */
export const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Chữ tròn nét đều như ống neon uốn — có đủ dấu tiếng Việt, đóng gói sẵn (chạy cả Windows). */
export const TUBE = FONT_CATALOG.comfortaa.stack;
/** Chữ viết liền kiểu biển hiệu quán bar — chỉ cho câu nhấn, luôn vẽ cả cụm trong MỘT span. */
export const SCRIPT = FONT_CATALOG.pacifico.stack;
export const NEON_FONTS = ["comfortaa", "pacifico"];

/** Tường gạch đêm: gần đen, ngả tím. */
export const NIGHT = "#07060d";

export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Tách chữ theo ký tự hiển thị (NFC) để thắp từng chữ không cắt đôi dấu tiếng Việt. */
export const glyphs = (text: string) => Array.from(text.normalize("NFC"));

/* ------------------------------------------------------------ bảng màu */

/** Sắc độ (0–360) và độ bão hoà (0–1) của một màu hex. */
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
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s };
};

export type Palette = { primary: number; secondary: number };

/**
 * Hai màu ống neon suy từ `accent`: ống chính (phụ đề, tag, số liệu) giữ sắc độ của accent, đẩy bão hoà
 * tối đa; ống phụ (câu nhấn) là màu tương phản nhưng chỉ chọn trong hai màu "phố đêm" kinh điển —
 * xanh cyan hoặc hồng cánh sen. Lấy màu bù thẳng thì đỏ ra xanh lá, trông như đèn Giáng sinh.
 * Accent xám/trắng/đen không có sắc độ → cặp hồng cánh sen + cyan.
 */
export const paletteFor = (accent: string): Palette => {
  const c = hueOf(accent);
  const primary = !c || c.s < 0.15 ? 315 : Math.round(c.h);
  // Đỏ/cam/vàng và tím/hồng → cyan; xanh lá/cyan → hồng cánh sen; xanh dương → hồng nóng.
  const secondary = primary >= 70 && primary < 200 ? 318 : primary >= 200 && primary < 260 ? 328 : 188;
  return { primary, secondary };
};

/** Màu ống neon ở độ sáng l (%). */
export const neon = (hue: number, l = 60, a = 1) => `hsla(${hue}, 100%, ${l}%, ${a})`;

/** Lõi ống đang sáng: trắng pha rất nhẹ màu ống. */
export const core = (hue: number) => `hsl(${hue}, 100%, 95%)`;

/** Ống tắt: thuỷ tinh mờ, không phát sáng — vẫn thấy hình chữ như biển hiệu ban ngày. */
export const deadTube = (hue: number) => `hsla(${hue}, 30%, 45%, 0.28)`;

/**
 * Quầng sáng nhiều lớp quanh chữ: lõi trắng → viền màu → quầng rộng. `glow` 0..1 co quầng lại
 * khi ống đang chập chờn. Kích thước theo cỡ chữ để chữ to chữ nhỏ đều cân.
 */
export const textGlow = (hue: number, size: number, glow = 1) => {
  const k = size / 64;
  return [
    `0 0 ${(1.5 * k).toFixed(1)}px ${neon(hue, 92)}`,
    `0 0 ${(5 * k).toFixed(1)}px ${neon(hue, 65, glow)}`,
    `0 0 ${(12 * k).toFixed(1)}px ${neon(hue, 55, glow)}`,
    `0 0 ${(26 * k).toFixed(1)}px ${neon(hue, 50, 0.85 * glow)}`,
    `0 0 ${(52 * k).toFixed(1)}px ${neon(hue, 50, 0.55 * glow)}`,
  ].join(", ");
};

/** Ống viền (khung biển hiệu): lõi sáng + quầng trong + quầng ngoài. */
export const tubeBorder = (hue: number, unit: number, thick = 5, glow = 1): React.CSSProperties => ({
  border: `${(thick * unit).toFixed(1)}px solid ${glow > 0.3 ? neon(hue, 88) : deadTube(hue)}`,
  boxShadow: [
    `0 0 ${(4 * unit).toFixed(1)}px ${neon(hue, 60, glow)}`,
    `0 0 ${(16 * unit).toFixed(1)}px ${neon(hue, 55, 0.9 * glow)}`,
    `0 0 ${(40 * unit).toFixed(1)}px ${neon(hue, 50, 0.5 * glow)}`,
    `inset 0 0 ${(6 * unit).toFixed(1)}px ${neon(hue, 60, 0.9 * glow)}`,
    `inset 0 0 ${(26 * unit).toFixed(1)}px ${neon(hue, 50, 0.35 * glow)}`,
  ].join(", "),
});

/* ------------------------------------------------------------ nhấp nháy */

/**
 * Độ sáng (0..1) của một ống vừa bật, `local` frame tính từ lúc bật. Trong `length` frame đầu ống
 * chập chờn — xác suất sáng tăng dần theo thời gian, frame 0 luôn tối — rồi sáng hẳn. Tắt thì vẫn
 * còn chút ánh (0.12) như ống chưa nguội.
 */
export const flicker = (local: number, key: string, length = 10) => {
  if (local < 0) return 0;
  if (local >= length) return 1;
  if (local === 0) return 0.08;
  const chance = 0.25 + (0.75 * local) / length;
  return seeded(`${key}-${local}`) < chance ? 1 : 0.12;
};

/**
 * Tiếng rè của ống đã sáng: dao động rất nhẹ, thỉnh thoảng (~1 lần mỗi 4 s) sụt sáng 1 frame.
 * Mỗi ống một `key` riêng để không cùng nhịp.
 */
export const hum = (frame: number, key: string) => {
  const phase = seeded(`${key}-phase`, 0, Math.PI * 2);
  const base = 0.95 + 0.05 * Math.sin(frame * 0.8 + phase);
  const block = Math.floor(frame / 120);
  const at = block * 120 + Math.floor(seeded(`${key}-drop-${block}`, 10, 110));
  const drop = seeded(`${key}-dropon-${block}`) < 0.5 && frame === at;
  return drop ? 0.35 : base;
};

/** Tắt dần ở cuối: 3 frame chớp rồi tối. Trả 1 khi còn xa `end`. */
export const powerOff = (frame: number, end: number, key: string) => {
  const left = end - frame;
  if (left <= 0) return 0;
  if (left > 4) return 1;
  return seeded(`${key}-off-${left}`) < 0.5 ? 0.5 : 0.15;
};

/* ------------------------------------------------------------ câu nhấn */

/** Vị trí cụm nhấn trong câu (so không phân biệt hoa thường) — [đầu, cuối) hoặc null. */
export const punchRange = (text: string, punch: string): [number, number] | null => {
  const hay = text.normalize("NFC").toLocaleLowerCase("vi");
  const needle = punch.normalize("NFC").trim().toLocaleLowerCase("vi");
  if (!needle || hay.length !== text.normalize("NFC").length) return null;
  const at = hay.indexOf(needle);
  return at < 0 ? null : [at, at + needle.length];
};
