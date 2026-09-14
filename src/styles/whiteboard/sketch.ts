/**
 * Công cụ vẽ tay cho phong cách bảng trắng: bảng màu, font, đo chữ và các hàm
 * sinh đường SVG hơi méo (gạch chân, khoanh tròn, khung) theo seed cố định.
 * Cùng seed → cùng nét, nên mỗi frame render ra giống hệt nhau.
 */
import { seeded, FONTS } from "../shared";

/** Màu mực bút dạ, bút chì, giấy, dòng kẻ. */
export const INK = "#1d2540";
export const PENCIL = "#6c7386";
export const PAPER = "#fbf8f0";
export const RULE = "rgba(86, 138, 205, 0.28)";
export const MARGIN_RED = "rgba(214, 70, 70, 0.55)";
export const STICKY = "#ffe36e";

/**
 * Marker Felt đã kiểm là đủ dấu tiếng Việt (ắ ồ ữ ệ ỡ, cả chữ hoa Ặ Ữ Ở) khi
 * render trên macOS. Noteworthy Bold mất dấu trăng ở chữ hoa, Chalkboard SE xếp
 * dấu chồng lệch — đừng đổi sang hai font đó. Máy không có Marker Felt thì rơi
 * về FONTS.rounded.
 */
export const HAND = `"Marker Felt", ${FONTS.rounded}`;

/** Số frame lật trang giữa hai cảnh. */
export const TURN_FRAMES = 14;

type Point = [number, number];

// ---------------------------------------------------------------------------
// Đo chữ bằng canvas của trình duyệt. Font hệ thống nên không cần chờ tải.
// ---------------------------------------------------------------------------
let canvas: HTMLCanvasElement | null = null;
const widthCache = new Map<string, number>();

/** Bề rộng (px) của một dòng chữ viết tay ở cỡ `fontSize`. */
export const textWidth = (text: string, fontSize: number, weight = 400) => {
  const key = `${weight}|${fontSize}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  let width = [...text].length * fontSize * 0.5;
  if (typeof document !== "undefined") {
    canvas = canvas ?? document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `${weight} ${fontSize}px ${HAND}`;
      width = ctx.measureText(text).width;
    }
  }
  widthCache.set(key, width);
  return width;
};

/** Ước số dòng khi chữ tự xuống dòng trong bề rộng `maxWidth`. */
export const estimateLines = (text: string, fontSize: number, maxWidth: number) => {
  if (!text) return 0;
  // Nhân 1.08 bù cho chỗ trống cuối dòng do ngắt theo từ.
  return Math.max(1, Math.ceil((textWidth(text, fontSize) * 1.08) / Math.max(1, maxWidth)));
};

// ---------------------------------------------------------------------------
// Sinh đường SVG
// ---------------------------------------------------------------------------

/** Nối các điểm bằng đường cong Catmull-Rom → cubic bézier cho nét mềm như tay. */
export const smoothPath = (points: Point[]) => {
  if (points.length < 2) return "";
  const f = (n: number) => n.toFixed(1);
  let d = `M ${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
};

/** Nét ngang hơi lượn từ x1 tới x2 quanh độ cao y, cuối nét hơi hất lên. */
export const roughLine = (x1: number, x2: number, y: number, seed: string, wobble: number) => {
  const steps = 6;
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([
      x1 + (x2 - x1) * t + seeded(`${seed}-x${i}`, -wobble, wobble) * 0.5,
      y + seeded(`${seed}-y${i}`, -wobble, wobble) - t * wobble * 0.8,
    ]);
  }
  return smoothPath(points);
};

/**
 * Gạch chân kiểu bút dạ: một nét đi sang phải rồi một nét quay lại ngắn hơn,
 * thấp hơn — gộp trong một path để dashoffset vẽ liền hai nét.
 */
export const scribbleUnderline = (width: number, y: number, seed: string, wobble: number) => {
  const forward = roughLine(0, width, y, `${seed}-a`, wobble);
  const back = roughLine(width * 0.94, width * 0.1, y + wobble * 2.2, `${seed}-b`, wobble);
  // Nét quay lại bắt đầu bằng "M" riêng; nối vào path đầu thành hai nét trong một path.
  return `${forward} ${back}`;
};

/** Vòng khoanh tay: đi hơn một vòng, bán kính trôi dần để đầu và cuối không trùng. */
export const roughEllipse = (cx: number, cy: number, rx: number, ry: number, seed: string) => {
  const steps = 30;
  const start = seeded(`${seed}-start`, -2.5, -1.9);
  const sweep = Math.PI * 2 + seeded(`${seed}-sweep`, 0.35, 0.6);
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = start + sweep * t;
    const drift = 0.95 + t * 0.1 + seeded(`${seed}-r${i}`, -0.025, 0.025);
    points.push([cx + Math.cos(angle) * rx * drift, cy + Math.sin(angle) * ry * drift]);
  }
  return smoothPath(points);
};

/** Khung chữ nhật vẽ tay: góc hơi tròn, nét cuối vượt quá điểm đầu một chút. */
export const roughBox = (w: number, h: number, seed: string, wobble: number) => {
  const j = (k: string) => seeded(`${seed}-${k}`, -wobble, wobble);
  const points: Point[] = [
    [j("a") + w * 0.04, j("b")],
    [w * 0.5, j("c")],
    [w + j("d"), j("e")],
    [w + j("f"), h * 0.5],
    [w + j("g"), h + j("h")],
    [w * 0.5, h + j("i")],
    [j("k"), h + j("l")],
    [j("m"), h * 0.5],
    [j("n") + w * 0.02, j("o") + wobble],
    [w * 0.22, j("p") - wobble * 0.6],
  ];
  return smoothPath(points);
};

/** Hình vẽ nguệch ngoạc nhỏ trong ô 100×100 — rải lên lề giấy. */
export const doodlePath = (kind: number, seed: string) => {
  const j = (k: string) => seeded(`${seed}-${k}`, -4, 4);
  switch (kind % 5) {
    case 0: {
      // Ngôi sao năm cánh vẽ một nét.
      const points: string[] = [];
      for (let i = 0; i <= 5; i++) {
        const angle = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        points.push(`${(50 + Math.cos(angle) * 44 + j(`s${i}`)).toFixed(1)} ${(52 + Math.sin(angle) * 44 + j(`t${i}`)).toFixed(1)}`);
      }
      return `M ${points.join(" L ")}`;
    }
    case 1:
      // Mũi tên cong.
      return `${smoothPath([[6, 80], [30, 40 + j("a")], [62, 30 + j("b")], [92, 40]])} M 74 26 L 93 40 L 76 56`;
    case 2: {
      // Xoắn ốc.
      const points: Point[] = [];
      for (let i = 0; i <= 26; i++) {
        const angle = i * 0.55;
        const r = 4 + i * 1.65;
        points.push([50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r]);
      }
      return smoothPath(points);
    }
    case 3:
      // Dấu tích.
      return smoothPath([[10, 52], [36, 80 + j("a")], [90, 14]]);
    default:
      // Tia lấp lánh ba nét.
      return `M 50 6 L ${50 + j("a")} 94 M 8 50 L 92 ${50 + j("b")} M 22 22 L 78 78`;
  }
};
