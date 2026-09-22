/**
 * Hình học của phong cách "Bản đồ hành trình": vị trí các điểm dừng, đường đi cong giữa chúng, đất liền vẽ bằng
 * nhiễu có seed, núi/sóng trang trí, và camera. Không có React ở đây — toàn hàm thuần, cùng seed cùng bản đồ.
 *
 * Toạ độ "bản đồ" là đơn vị ảo (không phải pixel). Camera đổi sang màn hình: màn = tâm + (điểm − camera) × zoom.
 */
import { Easing } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";
import { seeded } from "../shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Camera bay: tăng tốc rồi hạ cánh mềm. */
export const FLY = Easing.bezier(0.6, 0, 0.3, 1);
export const POP = Easing.out(Easing.back(1.7));
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Tên địa danh, lời đọc, nhãn: Be Vietnam Pro. Tiêu đề trong khung cartouche: Playfair Display — giọng bản đồ cổ. */
export const UI = FONT_CATALOG.bevietnam.stack;
export const SERIF = FONT_CATALOG.playfair.stack;

/** Bảng màu giấy bản đồ: biển xanh xám nhạt, đất màu giấy kem, nét bờ biển nâu mực. */
export const MAP = {
  sea: "#cfdcd3",
  seaLine: "rgba(74, 110, 104, 0.32)",
  land: "#f3e7c9",
  landShade: "#eadbb5",
  coast: "#7a5f3e",
  grid: "rgba(70, 88, 84, 0.22)",
  ink: "#2d2419",
  muted: "rgba(45, 36, 25, 0.62)",
  paper: "#fffdf7",
} as const;

export type Pt = { x: number; y: number };

/** In hoa bằng JS theo tiếng Việt — không dùng CSS text-transform (móc Ư/Ơ dễ lệch). */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");
/** Số có 2 chữ số: 2 → "02". */
export const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
export const chars = (text: string) => Array.from(text.normalize("NFC")).length;

// ---------------------------------------------------------------------------
// Màu
// ---------------------------------------------------------------------------
const parseHex = (hex: string): [number, number, number] | null => {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Trộn hai màu hex theo t (0 = a, 1 = b). Màu không đọc được thì dùng đỏ cam bản đồ. */
export const mix = (a: string, b: string, t: number) => {
  const ca = parseHex(a) ?? [224, 82, 58];
  const cb = parseHex(b) ?? [224, 82, 58];
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/** Màu nhấn đậm hơn cho chữ/viền trên nền giấy sáng. */
export const deep = (accent: string, t = 0.35) => mix(accent, "#1d140c", t);

// ---------------------------------------------------------------------------
// Hành trình
// ---------------------------------------------------------------------------
/** Khoảng cách trung bình giữa hai điểm dừng (đơn vị bản đồ). */
export const STEP = 520;

export type Leg = { from: Pt; ctrl: Pt; to: Pt };

export type Blob = { c: Pt; r: number; d: string };

export type World = {
  pins: Pt[];
  /** legs[i] là chặng đi TỚI điểm i (legs[0] = null). */
  legs: (Leg | null)[];
  blobs: Blob[];
  mountains: { p: Pt; s: number }[];
  waves: { p: Pt; s: number }[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

/** Điểm trên đường cong bậc hai tại t. */
export const bezierAt = (leg: Leg, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * leg.from.x + 2 * u * t * leg.ctrl.x + t * t * leg.to.x,
    y: u * u * leg.from.y + 2 * u * t * leg.ctrl.y + t * t * leg.to.y,
  };
};

/** Góc tiếp tuyến (radian) của đường cong tại t. */
export const bezierAngle = (leg: Leg, t: number) => {
  const dx = 2 * (1 - t) * (leg.ctrl.x - leg.from.x) + 2 * t * (leg.to.x - leg.ctrl.x);
  const dy = 2 * (1 - t) * (leg.ctrl.y - leg.from.y) + 2 * t * (leg.to.y - leg.ctrl.y);
  return Math.atan2(dy, dx);
};

export const legPath = (leg: Leg) => `M ${leg.from.x.toFixed(1)} ${leg.from.y.toFixed(1)} Q ${leg.ctrl.x.toFixed(1)} ${leg.ctrl.y.toFixed(1)} ${leg.to.x.toFixed(1)} ${leg.to.y.toFixed(1)}`;

/**
 * Đường bờ một mảng đất: vòng tròn bán kính r bị méo bởi tổng vài sóng sin có pha theo seed — giống "nhiễu" nhưng
 * khép kín và mượt. 72 đỉnh là đủ mịn ở mọi mức zoom camera dùng.
 */
const blobPath = (c: Pt, r: number, key: string) => {
  const harmonics = [
    [2, 0.16], [3, 0.12], [5, 0.075], [8, 0.045], [13, 0.028], [21, 0.014],
  ].map(([k, a], i) => ({ k, a: a * seeded(`${key}-a${i}`, 0.6, 1.3), ph: seeded(`${key}-p${i}`, 0, Math.PI * 2) }));
  const N = 72;
  let d = "";
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const f = harmonics.reduce((s, h) => s + h.a * Math.sin(h.k * th + h.ph), 1);
    const x = c.x + Math.cos(th) * r * f;
    const y = c.y + Math.sin(th) * r * f;
    d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Dựng cả bản đồ cho n điểm dừng. Hành trình luôn đi về phía đông-bắc (lên phải) có lượn: điểm trước nằm dưới-trái
 * điểm hiện tại, nên bưu thiếp (trên / phải) và bảng phụ đề (dưới) không bao giờ che chặng vừa đi.
 */
export const buildWorld = (n: number, seed: string): World => {
  const count = Math.max(1, n);
  const pins: Pt[] = [{ x: 0, y: 0 }];
  const legs: (Leg | null)[] = [null];
  let heading = -0.5;
  for (let i = 1; i < count; i++) {
    heading = Math.max(-1.05, Math.min(0.12, -0.5 + seeded(`${seed}-h${i}`, -0.5, 0.5) + (heading + 0.5) * 0.35));
    const len = STEP * seeded(`${seed}-l${i}`, 0.88, 1.12);
    const from = pins[i - 1];
    const to = { x: from.x + Math.cos(heading) * len, y: from.y + Math.sin(heading) * len };
    // Điểm điều khiển lệch vuông góc để chặng cong nhẹ, lúc lồi lúc lõm.
    const bend = seeded(`${seed}-b${i}`, 0.12, 0.26) * (i % 2 === 0 ? 1 : -1) * len;
    const ctrl = { x: (from.x + to.x) / 2 - Math.sin(heading) * bend, y: (from.y + to.y) / 2 + Math.cos(heading) * bend };
    pins.push(to);
    legs.push({ from, ctrl, to });
  }

  const xs = pins.map((p) => p.x);
  const ys = pins.map((p) => p.y);
  const bounds = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };

  // Đất liền: một mảng quanh mỗi điểm dừng (lệch tâm, bán kính khác nhau nên bờ biển lúc gần lúc xa), một mảng nhỏ
  // giữa mỗi chặng (thỉnh thoảng bỏ để chặng bay qua biển), và vài hòn đảo rải quanh.
  const centers: { c: Pt; r: number }[] = [];
  pins.forEach((p, i) => {
    const a = seeded(`${seed}-oa${i}`, 0, Math.PI * 2);
    const off = seeded(`${seed}-oo${i}`, 60, 220);
    centers.push({ c: { x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off }, r: seeded(`${seed}-r${i}`, 330, 500) });
  });
  legs.forEach((leg, i) => {
    if (!leg || seeded(`${seed}-gap${i}`) < 0.3) return;
    const m = bezierAt(leg, 0.5);
    centers.push({ c: m, r: seeded(`${seed}-mr${i}`, 200, 320) });
  });
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 800);
  for (let k = 0; k < 10; k++) {
    const c = {
      x: seeded(`${seed}-ix${k}`, bounds.minX - 900, bounds.maxX + 900),
      y: seeded(`${seed}-iy${k}`, bounds.minY - 900, bounds.maxY + 900),
    };
    // Đảo không mọc đè lên điểm dừng (điểm dừng phải nằm trên mảng đất riêng của nó).
    if (pins.some((p) => dist(p, c) < 420)) continue;
    centers.push({ c, r: seeded(`${seed}-ir${k}`, 60, 180) * (span > 2000 ? 1.3 : 1) });
  }
  const blobs = centers.map((b, i) => ({ ...b, d: blobPath(b.c, b.r, `${seed}-blob${i}`) }));

  const onLand = (p: Pt, margin: number) => blobs.some((b) => dist(p, b.c) < b.r * margin);
  const nearRoute = (p: Pt, gap: number) =>
    pins.some((q) => dist(p, q) < gap) ||
    legs.some((leg) => leg && [0.25, 0.5, 0.75].some((t) => dist(p, bezierAt(leg, t)) < gap * 0.8));

  // Núi: vài cụm trên đất, tránh xa điểm dừng và đường đi.
  const mountains: World["mountains"] = [];
  pins.forEach((p, i) => {
    for (let k = 0; k < 5; k++) {
      const a = seeded(`${seed}-ma${i}-${k}`, 0, Math.PI * 2);
      const r = seeded(`${seed}-md${i}-${k}`, 150, 360);
      const q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
      if (onLand(q, 0.7) && !nearRoute(q, 170) && !pins.some((pp) => dist(q, pp) < 250)) mountains.push({ p: q, s: seeded(`${seed}-ms${i}-${k}`, 0.8, 1.3) });
    }
  });
  // Sóng: nét "〰" nhỏ trên biển.
  const waves: World["waves"] = [];
  for (let k = 0; k < 40; k++) {
    const q = {
      x: seeded(`${seed}-wx${k}`, bounds.minX - 800, bounds.maxX + 800),
      y: seeded(`${seed}-wy${k}`, bounds.minY - 800, bounds.maxY + 800),
    };
    if (!onLand(q, 1.35)) waves.push({ p: q, s: seeded(`${seed}-ws${k}`, 0.8, 1.2) });
  }

  return { pins, legs, blobs, mountains, waves, bounds };
};

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
export type Camera = { c: Pt; z: number; f: Pt };

export const toScreen = (cam: Camera, p: Pt): Pt => ({ x: cam.f.x + (p.x - cam.c.x) * cam.z, y: cam.f.y + (p.y - cam.c.y) * cam.z });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Bay camera từ a sang b: tâm và điểm neo trượt theo t, zoom lùi ra giữa đường (dip) rồi sà vào. */
export const blendCamera = (a: Camera, b: Camera, t: number, dip = 0.22): Camera => ({
  c: { x: lerp(a.c.x, b.c.x, t), y: lerp(a.c.y, b.c.y, t) },
  f: { x: lerp(a.f.x, b.f.x, t), y: lerp(a.f.y, b.f.y, t) },
  z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), t)) * (1 - dip * Math.sin(Math.PI * t)),
});
