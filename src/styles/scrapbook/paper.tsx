/**
 * Đồ thủ công của bảng kỷ niệm: nền bần (corkboard), băng keo washi, đinh ghim, hình vẽ tay (tim, sao, mũi tên).
 * Tất cả vẽ bằng CSS/SVG, không cần file ảnh.
 */
import { AbsoluteFill, interpolate } from "remotion";
import { HAND, INK } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Màu băng keo washi — pastel, xoay vòng theo cảnh. */
export const TAPE_COLORS = ["#f6c6d0", "#bfe3d0", "#fbe29a", "#c9d8f5", "#f7cfa8", "#d9c8ef"];

// ---------------------------------------------------------------------------
// Nền bần
// ---------------------------------------------------------------------------
/** Bảng bần nâu ấm: hạt li ti + mảng loang lớn, viền tối dần. Tĩnh — không đổi theo frame. */
export const Cork: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#b88752" }}>
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
      <filter id="sb-cork-grain">
        <feTurbulence type="fractalNoise" baseFrequency={0.32} numOctaves={2} seed={7} stitchTiles="stitch" />
        {/* Chỉ giữ các hạt đậm: kênh alpha dốc đứng → chấm nâu sẫm rời rạc. */}
        <feColorMatrix type="matrix" values="0 0 0 0 0.32  0 0 0 0 0.19  0 0 0 0 0.08  0 0 0 -9 4.6" />
      </filter>
      <filter id="sb-cork-light">
        <feTurbulence type="fractalNoise" baseFrequency={0.4} numOctaves={1} seed={3} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.86  0 0 0 0 0.66  0 0 0 -9 4.3" />
      </filter>
      <filter id="sb-cork-blotch">
        <feTurbulence type="fractalNoise" baseFrequency={0.012} numOctaves={3} seed={11} />
        <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.27  0 0 0 0 0.12  0 0 0 1.1 -0.45" />
      </filter>
      <rect width="100%" height="100%" filter="url(#sb-cork-blotch)" />
      <rect width="100%" height="100%" filter="url(#sb-cork-light)" opacity={0.55} />
      <rect width="100%" height="100%" filter="url(#sb-cork-grain)" opacity={0.8} />
    </svg>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(45, 22, 5, 0.5) 100%)" }} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Băng keo washi
// ---------------------------------------------------------------------------
/** clip-path răng cưa hai đầu — như băng keo xé tay. */
const tornEnds = (depth: number, teeth = 5) => {
  const pts: string[] = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const y = (i / (teeth * 2)) * 100;
    pts.push(`${i % 2 ? depth : 0}px ${y.toFixed(1)}%`);
  }
  const right: string[] = [];
  for (let i = teeth * 2; i >= 0; i--) {
    const y = (i / (teeth * 2)) * 100;
    right.push(`calc(100% - ${i % 2 ? depth : 0}px) ${y.toFixed(1)}%`);
  }
  return `polygon(${[...pts, ...right].join(", ")})`;
};

export const WashiTape: React.FC<{
  /** Bề rộng; bỏ trống khi có chữ = co theo chữ. */
  width?: number;
  height: number;
  color: string;
  unit: number;
  /** 0 sọc chéo, 1 chấm bi, 2 trơn. */
  pattern?: number;
  text?: string | null;
  fontSize?: number;
  style?: React.CSSProperties;
}> = ({ width, height, color, unit, pattern = 0, text, fontSize, style }) => {
  const overlay =
    pattern === 0
      ? `repeating-linear-gradient(-45deg, rgba(255,255,255,0.38) 0 ${7 * unit}px, transparent ${7 * unit}px ${16 * unit}px)`
      : pattern === 1
        ? `radial-gradient(circle, rgba(255,255,255,0.55) ${3.2 * unit}px, transparent ${3.8 * unit}px) 0 0 / ${18 * unit}px ${18 * unit}px`
        : "linear-gradient(transparent, transparent)";
  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        boxSizing: "border-box",
        padding: text ? `0 ${height * 0.5}px` : 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${overlay}, linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.04)), ${color}`,
        opacity: 0.93,
        clipPath: tornEnds(5 * unit),
        boxShadow: `0 ${2 * unit}px ${5 * unit}px rgba(0,0,0,0.12)`,
        fontFamily: HAND,
        fontSize,
        lineHeight: 1,
        color: INK,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {text ?? null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Đinh ghim
// ---------------------------------------------------------------------------
export const PushPin: React.FC<{ size: number; color: string; style?: React.CSSProperties }> = ({ size, color, style }) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 100 120" style={{ position: "absolute", overflow: "visible", ...style }}>
    {/* Bóng đổ lệch xuống phải */}
    <ellipse cx={62} cy={70} rx={30} ry={24} fill="rgba(30, 15, 0, 0.28)" />
    <circle cx={50} cy={50} r={32} fill={color} />
    <circle cx={50} cy={50} r={32} fill="url(#sb-pin-shade)" />
    <circle cx={50} cy={50} r={17} fill={color} stroke="rgba(0,0,0,0.18)" strokeWidth={2} />
    <ellipse cx={40} cy={38} rx={10} ry={7} fill="rgba(255,255,255,0.65)" />
    <defs>
      <radialGradient id="sb-pin-shade" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="rgba(255,255,255,0.25)" />
        <stop offset="1" stopColor="rgba(0,0,0,0.35)" />
      </radialGradient>
    </defs>
  </svg>
);

// ---------------------------------------------------------------------------
// Hình vẽ tay
// ---------------------------------------------------------------------------
export type DoodleKind = "heart" | "star" | "arrow" | "swirl";

const DOODLE_PATHS: Record<DoodleKind, string> = {
  heart: "M 50 88 C 20 64, 6 46, 14 28 C 22 12, 44 14, 50 32 C 56 14, 80 10, 88 28 C 95 46, 80 64, 50 88 Z",
  star: "M 50 8 L 61 38 L 93 39 L 67 58 L 77 90 L 50 71 L 23 90 L 33 58 L 7 39 L 39 38 Z",
  arrow: "M 8 70 C 30 40, 55 30, 88 34 M 70 18 L 90 34 L 72 50",
  swirl: "M 50 50 C 50 42, 62 42, 62 52 C 62 64, 44 66, 40 52 C 36 36, 58 28, 70 40 C 84 56, 68 80, 48 78",
};

/** Hình vẽ bằng bút dạ, nét hiện dần từ `start` trong 12 frame. */
export const Doodle: React.FC<{
  kind: DoodleKind; size: number; color: string; frame: number; start: number; style?: React.CSSProperties;
}> = ({ kind, size, color, frame, start, style }) => {
  const t = interpolate(frame, [start, start + 12], [0, 1], clamp);
  if (t <= 0) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", overflow: "visible", ...style }}>
      <path
        d={DOODLE_PATHS[kind]}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - t}
      />
    </svg>
  );
};
