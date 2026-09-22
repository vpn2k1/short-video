/**
 * Bảng màu, font và tiện ích chung của phong cách "Lễ hội Tết".
 *
 * Đỏ – vàng cố định: `accent` và `background` của video bị bỏ qua, vì màu nhấn tuỳ ý (xanh, tím…) phá không khí Tết.
 */
import { Easing } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Chuyển động vui, dứt khoát — vào nhanh, dừng êm. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Bật lên có nảy nhẹ (con dấu đóng, chữ nhấn, lồng đèn thả xuống). */
export const POP = Easing.spring({ damping: 11, stiffness: 170 });

/** Đỏ son làm nền, đỏ thẫm cho dải lụa, đỏ tươi cho con dấu / bao lì xì. */
export const RED = "#b3121b";
export const RED_DEEP = "#6f0710";
export const RED_DARK = "#4a040a";
export const RED_BRIGHT = "#d81f26";
/** Vàng kim: sáng / chính / đậm (cho gradient lá vàng). */
export const GOLD_LIGHT = "#fff0b3";
export const GOLD = "#f2c14e";
export const GOLD_DEEP = "#b8801f";
/** Chữ trắng ngà ấm trên nền đỏ. */
export const CREAM = "#fff5e0";
/** Hoa mai vàng, hoa đào hồng. */
export const MAI = "#ffd23f";
export const MAI_CORE = "#e07b12";
export const DAO = "#ffb0c6";
export const DAO_CORE = "#d9467a";

/** Lá vàng: dải sáng – tối xen kẽ như giấy nhũ. */
export const GOLD_FOIL = `linear-gradient(135deg, ${GOLD_DEEP} 0%, ${GOLD} 22%, ${GOLD_LIGHT} 42%, ${GOLD} 60%, ${GOLD_DEEP} 82%, ${GOLD} 100%)`;

/** Playfair Display — tiêu đề, lời chúc trên thiệp, con số. */
export const SERIF = FONT_CATALOG.playfair.stack;
/** Baloo 2 — phụ đề trên dải lụa, con dấu: tròn, đậm, dễ đọc trên điện thoại. */
export const ROUND = FONT_CATALOG.baloo.stack;
export const FESTIVE_FONTS = ["playfair", "baloo"];

/** In hoa đúng dấu tiếng Việt — KHÔNG dùng CSS text-transform. */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Cỡ chữ co theo số ký tự: tới `fit` ký tự giữ nguyên, dài hơn thì co theo căn bậc hai, không nhỏ hơn `min`. */
export const sizeFor = (text: string, base: number, fit: number, min = 0.6) => {
  const length = [...text.normalize("NFC")].length;
  return length <= fit ? base : base * Math.max(min, Math.sqrt(fit / length));
};
