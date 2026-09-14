/**
 * Hằng số màu, easing và các hàm thuần của phong cách "tech".
 * Không có React ở đây để dễ đọc và dễ kiểm.
 */
import { Easing, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";

/** Màu bổ trợ cho accent: xanh cyan và tím. */
export const CYAN = "#22d3ee";
export const VIOLET = "#8b5cf6";
export const INK = "#eaf2ff";

/** Vào nhanh, dừng mềm. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Ra tăng tốc dần. */
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

/** Số frame cảnh trượt vào / trượt ra. */
export const ENTER_FRAMES = 16;
export const EXIT_FRAMES = 12;

/** Nội suy 0→1 có kẹp hai đầu. `from` < `from + length` luôn đúng vì length ≥ 1. */
export const ramp = (
  frame: number,
  from: number,
  length: number,
  easing: (t: number) => number = EASE_OUT,
) =>
  interpolate(frame, [from, from + Math.max(1, length)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** "#rgb" / "#rrggbb" → rgba(). Màu không đọc được thì trả nguyên. */
export const withAlpha = (color: string, alpha: number) => {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return color;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Cửa sổ thời gian của một cảnh. Cảnh đầu vào sau title card (nếu có).
 * Cảnh cuối không có lối ra — giữ tới hết video.
 */
export const sceneWindow = (scenes: Scene[], index: number, showTitle: boolean) => {
  const scene = scenes[index];
  const start = msToFrames(scene.startMs);
  const end = msToFrames(scene.endMs);
  const enter = index === 0 ? Math.max(start, showTitle ? TITLE_FRAMES - 14 : 0) : start;
  const isLast = index === scenes.length - 1;
  return { start, end, enter, exit: isLast ? Number.POSITIVE_INFINITY : Math.max(end, enter + 1) };
};

/** Trạng thái chuyển cảnh: in/out 0→1, cảnh hiện khi opacity > 0. */
export const sceneTransition = (
  frame: number,
  window: { enter: number; exit: number },
) => {
  const inP = ramp(frame, window.enter, ENTER_FRAMES, EASE_OUT);
  const outP = Number.isFinite(window.exit) ? ramp(frame, window.exit, EXIT_FRAMES, EASE_IN) : 0;
  return {
    inP,
    outP,
    opacity: inP * (1 - outP),
    /** Hệ số dịch ngang: +1 là còn ở bên phải, -1 là đã trôi sang trái. */
    shift: 1 - inP - outP,
    scale: 0.94 + 0.06 * inP - 0.03 * outP,
  };
};

export type ParsedStat = {
  prefix: string;
  value: number;
  suffix: string;
  format: (v: number) => string;
};

/**
 * Tách con số đầu tiên trong chuỗi stat: "80%", "2,5x", "1.000.000₫", "+30 triệu".
 * "1.000" / "1,000" (nhóm 3 chữ số) là phân cách hàng nghìn; "2,5" / "2.5" là thập phân.
 * Không có số → null, khi đó vẽ chữ tĩnh.
 */
export const parseStat = (text: string): ParsedStat | null => {
  const match = text.match(/^(\D*?)(\d+(?:[.,]\d+)*)(.*)$/);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;

  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
    const sep = raw.match(/[.,]/)?.[0] ?? ".";
    const value = Number(raw.replace(/[.,]/g, ""));
    return {
      prefix,
      value,
      suffix,
      format: (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, sep),
    };
  }

  const decimal = raw.match(/^(\d+)([.,])(\d+)$/);
  if (decimal) {
    const places = decimal[3].length;
    const value = Number(`${decimal[1]}.${decimal[3]}`);
    return {
      prefix,
      value,
      suffix,
      format: (v) => v.toFixed(places).replace(".", decimal[2]),
    };
  }

  if (!/^\d+$/.test(raw)) return null;
  return { prefix, value: Number(raw), suffix, format: (v) => String(Math.round(v)) };
};

/** Ước số dòng khi chữ xuống dòng trong khung rộng `width` — để giữ chỗ cố định, bố cục không nhảy. */
export const estimateLines = (text: string, fontSize: number, width: number, charWidth = 0.52) => {
  const perLine = Math.max(6, Math.floor(width / (fontSize * charWidth)));
  return Math.max(1, Math.ceil([...text].length / perLine));
};
