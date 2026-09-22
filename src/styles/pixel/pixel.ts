/**
 * Bảng màu, nhịp và bố cục cho phong cách "Game 8-bit". Hàm thuần + một hook bố cục.
 * Mọi chuyển động của phong cách đều "nhảy ô": vị trí làm tròn theo lưới P, thời gian bước theo 2 frame —
 * trượt mượt là mất chất game cũ.
 */
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";
import { useLayout } from "../shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Bungee: khối vuông, đủ dấu tiếng Việt — dùng cho HUD, tiêu đề, popup. Luôn in hoa bằng JS trước khi đưa vào. */
export const BLOCK = FONT_CATALOG.bungee.stack;
/** Lexend: chữ hội thoại — nét đều, dễ đọc trên điện thoại, dấu không dính. */
export const TEXT = FONT_CATALOG.lexend.stack;

export const INK = "#05060f";
export const BOX = "#141a4a";
export const BOX_EDGE = "#8fa2ff";
export const WHITE = "#ffffff";
export const GOLD = "#ffd84a";
export const GOLD_DARK = "#c77a12";
export const HUD_BG = "#0d0f24";

/** Ba bảng màu phong cảnh pixel luân phiên theo cảnh: ngày, hoàng hôn, đêm. */
export const SKIES = [
  {
    sky: ["#3b7dd8", "#4c8fe3", "#62a3ee", "#80bbf4", "#a8d6fa"],
    sun: "#ffe26a",
    cloud: "#ffffff",
    far: "#6cb85f",
    near: "#3f8f47",
    ground: "#7a4a2a",
    grass: "#5cc74e",
    stars: false,
  },
  {
    sky: ["#2b1d4f", "#55276a", "#95386e", "#d95b5a", "#f39c55"],
    sun: "#ffd35a",
    cloud: "#ffb3a0",
    far: "#6b3d6e",
    near: "#3f2750",
    ground: "#24162f",
    grass: "#8a4a7a",
    stars: false,
  },
  {
    sky: ["#070a24", "#0e1540", "#162058", "#1e2b70", "#283a88"],
    sun: "#f4f1c8",
    cloud: "#3a4b8f",
    far: "#1c3a5a",
    near: "#122a42",
    ground: "#0b1624",
    grass: "#1f5a4a",
    stars: true,
  },
] as const;

/** Cỡ một "điểm ảnh" của giao diện — viền, bước nhảy, bóng chữ đều là bội số của nó. */
export const pixelOf = (unit: number) => Math.max(3, Math.round(6 * unit));

/** Làm tròn theo lưới điểm ảnh. */
export const snap = (v: number, grid: number) => Math.round(v / grid) * grid;

/** Bước thời gian theo 2 frame — chuyển động giật cục như sprite cũ. */
export const onTwos = (frame: number) => frame - (((frame % 2) + 2) % 2);

export const glyphs = (text: string) => Array.from(text.normalize("NFC"));

/** In hoa tiếng Việt bằng JS — không dùng CSS text-transform (Ư/Ơ dễ vỡ móc). */
export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Viền chữ khối: 8 bóng cứng lệch đúng 1 điểm ảnh + bóng đổ chéo 2 điểm. Không blur. */
export const hardOutline = (s: number, color: string, drop = 2) => {
  const o = [
    [s, 0], [-s, 0], [0, s], [0, -s], [s, s], [-s, -s], [s, -s], [-s, s],
  ].map(([x, y]) => `${x}px ${y}px 0 ${color}`);
  if (drop > 0) o.push(`${s * drop}px ${s * drop}px 0 ${color}`);
  return o.join(", ");
};

/** Góc bậc thang một nấc — khung pixel không bao giờ bo tròn. */
export const notch = (n: number) =>
  `polygon(${n}px 0, calc(100% - ${n}px) 0, calc(100% - ${n}px) ${n}px, 100% ${n}px, 100% calc(100% - ${n}px), ` +
  `calc(100% - ${n}px) calc(100% - ${n}px), calc(100% - ${n}px) 100%, ${n}px 100%, ${n}px calc(100% - ${n}px), ` +
  `0 calc(100% - ${n}px), 0 ${n}px, ${n}px ${n}px)`;

/** Vị trí [đầu, cuối) của cụm nhấn trong câu, tính theo ký tự NFC; null nếu câu không chứa. */
export const punchSpan = (text: string, punch: string | undefined | null): [number, number] | null => {
  if (!punch) return null;
  const hay = glyphs(text).join("").toLocaleLowerCase("vi");
  const needle = glyphs(punch.trim()).join("").toLocaleLowerCase("vi");
  if (!needle) return null;
  const at = hay.indexOf(needle);
  return at < 0 ? null : [at, at + needle.length];
};

/**
 * Xu trong HUD: +10 mỗi câu thoại, +100 mỗi câu nhấn. Trả về số xu và frame của lần cộng gần nhất
 * (để đồng xu nảy lên đúng lúc).
 */
export const coinsAt = (frame: number, captions: Caption[], scenes: Scene[], from: number) => {
  const events: { at: number; value: number }[] = [
    ...captions.map((c) => ({ at: Math.max(from, msToFrames(c.startMs)), value: 10 })),
    ...scenes.filter((s) => s.punch).map((s) => ({ at: Math.max(from, msToFrames(s.punch!.atMs)), value: 100 })),
  ];
  let total = 0;
  let last = -Infinity;
  for (const e of events) {
    if (frame >= e.at) {
      total += e.value;
      last = Math.max(last, e.at);
    }
  }
  return { total, last };
};

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Bố cục màn chơi. Khung dọc (≥ 1.3): HUD → cửa sổ game → hộp thoại tách riêng bên dưới.
 * Khung vuông/ngang: cửa sổ game phủ gần kín, hộp thoại đè lên đáy cửa sổ như JRPG.
 */
export const useStage = (captionPosition: "bottom" | "center", hasDialog: boolean) => {
  const layout = useLayout();
  const { width, height, safe, unit } = layout;
  const P = pixelOf(unit);
  const stacked = height / width >= 1.3;
  const side = snap(Math.max(safe.side * 0.5, 36 * unit), P);
  const hud: Rect = { x: side, y: safe.top, w: width - side * 2, h: snap(78 * unit, P) };
  const vpTop = hud.y + hud.h + snap(46 * unit, P);
  const bottom = height - safe.bottom;
  const dialogH = snap((stacked ? 350 : 250) * unit, P);
  const centered = captionPosition === "center";

  let viewport: Rect;
  let dialog: Rect;
  if (stacked && !centered && hasDialog) {
    dialog = { x: side, y: bottom - dialogH, w: width - side * 2, h: dialogH };
    viewport = { x: side, y: vpTop, w: width - side * 2, h: dialog.y - snap(58 * unit, P) - vpTop };
  } else {
    viewport = { x: side, y: vpTop, w: width - side * 2, h: bottom - vpTop };
    const dw = Math.min(viewport.w - 2 * snap(30 * unit, P), snap(1300 * unit, P));
    const dy = centered ? viewport.y + viewport.h / 2 - dialogH / 2 : bottom - snap(30 * unit, P) - dialogH;
    dialog = { x: snap(width / 2 - dw / 2, P), y: snap(dy, P), w: dw, h: dialogH };
  }
  return { ...layout, P, stacked, hud, viewport, dialog };
};
