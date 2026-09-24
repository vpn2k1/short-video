/**
 * Nhịp thời gian và tiện ích thuần cho phong cách "Băng VHS".
 * Mọi thứ ngẫu nhiên đều qua seeded() — cùng frame cùng hình, render song song không lệch.
 */
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { FONTS, seeded } from "../shared";
import type { VideoLanguage } from "../../i18n/video";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** "image" của cảnh có thể là video người dùng tải lên. */
export const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Màn hình xanh của đầu máy video khi chưa có tín hiệu. */
export const BLUE_SCREEN = "#1a2fbf";
export const OSD_WHITE = "#f4f6ff";
export const REC_RED = "#ff2d3d";
export const SUB_YELLOW = "#ffe95c";

/**
 * Chỉnh màu băng từ: nhạt màu, ngả ấm, tương phản thấp, nhoè rất nhẹ.
 * Filter TĨNH (không đổi theo frame) nên Chrome không phải tính lại chuỗi filter phức tạp.
 */
export const gradeFor = (unit: number) =>
  `saturate(0.78) sepia(0.16) contrast(0.94) brightness(0.9) blur(${(0.6 * unit).toFixed(2)}px)`;

/** Tách chữ theo ký tự hiển thị (NFC) để gõ chữ không cắt đôi dấu tiếng Việt. */
export const glyphs = (text: string) => Array.from(text.normalize("NFC"));

export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/**
 * SF Mono / Menlo không có đủ chữ tiếng Việt có dấu — Chrome lấy từng glyph từ font khác
 * nên chữ lệch nét, lệch baseline. Chuỗi thuần ASCII (số, giờ, "REC", "SP") dùng mono;
 * có dấu thì dùng sans.
 */
export const osdFont = (text: string) => (/^[\x20-\x7E]*$/.test(text) ? FONTS.mono : FONTS.sans);

/* ------------------------------------------------------------ đồng hồ giả */

const pad = (n: number) => String(n).padStart(2, "0");

/** Ngày quay giả (1988–1999) và giờ bắt đầu, suy từ tiêu đề — cùng video luôn cùng ngày. */
const MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export const tapeClock = (title: string, frame: number, fps: number, language?: VideoLanguage) => {
  const key = `retro-date-${title}`;
  const day = Math.floor(seeded(`${key}-d`, 1, 29));
  const month = Math.floor(seeded(`${key}-m`, 1, 13));
  const year = Math.floor(seeded(`${key}-y`, 1988, 2000));
  const startSec = Math.floor(seeded(`${key}-t`, 17 * 3600, 22 * 3600));
  const total = startSec + Math.floor(frame / fps);
  return {
    date: language === "en" ? `${MONTHS_EN[month - 1]} ${pad(day)} ${year}` : `${pad(day)} THG ${pad(month)} ${year}`,
    time: `${pad(Math.floor(total / 3600) % 24)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`,
  };
};

/* ------------------------------------------------------------ nhiễu, giật */

/** Rung ngang nhẹ: cứ 3 frame bốc thăm một lần, phần lớn thời gian đứng yên. */
export const jitterAt = (frame: number, unit: number) => {
  const step = Math.floor(frame / 3);
  if (seeded(`retro-jit-on-${step}`) < 0.45) return 0;
  const big = seeded(`retro-jit-big-${step}`) > 0.93 ? 3 : 1;
  return seeded(`retro-jit-${step}`, -2.5, 2.5) * big * unit;
};

const GLITCH_BLOCK = 42;

/** Giật hình 1–2 frame, tối đa một lần mỗi ~1,4 s, khoảng một nửa số khối có. */
export const glitchAt = (frame: number) => {
  const block = Math.floor(frame / GLITCH_BLOCK);
  if (seeded(`retro-gl-${block}`) > 0.5) return null;
  const start = block * GLITCH_BLOCK + Math.floor(seeded(`retro-gl-at-${block}`, 4, GLITCH_BLOCK - 4));
  const length = seeded(`retro-gl-len-${block}`) > 0.5 ? 2 : 1;
  if (frame < start || frame >= start + length) return null;
  return {
    seed: `${block}-${frame}`,
    strength: seeded(`retro-gl-s-${frame}`, 0.5, 1),
    dir: seeded(`retro-gl-dir-${frame}`) > 0.5 ? 1 : -1,
  };
};

/** Cú nhiễu trắng ở điểm cắt cảnh (và cuối title). */
export const BURST_FRAMES = 6;

export const burstAt = (frame: number, scenes: Scene[], showTitle: boolean) => {
  const cuts: number[] = showTitle ? [TITLE_FRAMES] : [];
  scenes.forEach((scene, i) => {
    if (i === 0) return;
    const cut = msToFrames(scene.startMs);
    if (showTitle && cut < TITLE_FRAMES + BURST_FRAMES) return;
    cuts.push(cut);
  });
  const half = BURST_FRAMES / 2;
  for (const cut of cuts) {
    const d = frame - cut;
    if (d >= -half && d < half) {
      return { cut, d, amount: 0.35 + 0.65 * (1 - Math.abs(d) / half) };
    }
  }
  return null;
};

/* ------------------------------------------------------------ số liệu */

/**
 * Tách "80%", "+30K", "1.200", "2,5 triệu" thành tiền tố / giá trị / hậu tố, và hàm in số
 * giữ đúng dấu phân cách gốc. Nhóm sau dấu có đúng 3 chữ số = phân cách hàng nghìn.
 */
export const parseStat = (raw: string) => {
  const m = raw.normalize("NFC").match(/^(\D*?)(\d+(?:[.,]\d+)*)(.*)$/u);
  if (!m) return null;
  const prefix = m[1] ?? "";
  const num = m[2] ?? "0";
  const suffix = m[3] ?? "";
  const groups = num.split(/[.,]/);
  const seps: string[] = num.match(/[.,]/g) ?? [];
  let decSep = "";
  let thouSep = "";
  let decimals = 0;
  if (seps.length > 0) {
    const last = seps[seps.length - 1];
    const lastGroup = groups[groups.length - 1];
    if (new Set(seps).size > 1 || lastGroup.length !== 3) {
      decSep = last;
      decimals = lastGroup.length;
      thouSep = seps.length > 1 ? seps[0] : "";
    } else {
      thouSep = seps[0];
    }
  }
  const intDigits = decSep ? groups.slice(0, -1).join("") : groups.join("");
  const value = Number(intDigits + (decSep ? `.${groups[groups.length - 1]}` : ""));
  const format = (v: number) => {
    const [i, d] = v.toFixed(decimals).split(".");
    const int = thouSep ? i.replace(/\B(?=(\d{3})+(?!\d))/g, thouSep) : i;
    return d ? `${int}${decSep}${d}` : int;
  };
  return { prefix, value, suffix, format };
};
