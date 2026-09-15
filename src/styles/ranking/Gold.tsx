import { useCurrentFrame } from "remotion";
import { seeded } from "../shared";
import { GOLD, GOLD_DEEP, GOLD_LIGHT } from "./theme";

/** Vương miện vàng. Kích thước theo `width`, cao = 0.72 × width. */
export const Crown: React.FC<{ width: number; id: string; style?: React.CSSProperties }> = ({ width, id, style }) => (
  <svg width={width} height={width * 0.72} viewBox="0 0 100 72" style={{ overflow: "visible", ...style }}>
    <defs>
      <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GOLD_LIGHT} />
        <stop offset="45%" stopColor={GOLD} />
        <stop offset="100%" stopColor={GOLD_DEEP} />
      </linearGradient>
    </defs>
    <path
      d="M8 60 L2 16 L28 36 L50 4 L72 36 L98 16 L92 60 Z"
      fill={`url(#${id}-g)`}
      stroke="#7A4A00"
      strokeWidth={3}
      strokeLinejoin="round"
    />
    <rect x={8} y={60} width={84} height={10} rx={3} fill={`url(#${id}-g)`} stroke="#7A4A00" strokeWidth={3} />
    <circle cx={2} cy={14} r={5} fill={GOLD_LIGHT} stroke="#7A4A00" strokeWidth={2.5} />
    <circle cx={50} cy={4} r={6} fill={GOLD_LIGHT} stroke="#7A4A00" strokeWidth={2.5} />
    <circle cx={98} cy={14} r={5} fill={GOLD_LIGHT} stroke="#7A4A00" strokeWidth={2.5} />
    <circle cx={50} cy={46} r={6} fill="#E8364F" stroke="#7A4A00" strokeWidth={2} />
    <circle cx={28} cy={50} r={4} fill="#3FA7FF" stroke="#7A4A00" strokeWidth={2} />
    <circle cx={72} cy={50} r={4} fill="#3FA7FF" stroke="#7A4A00" strokeWidth={2} />
  </svg>
);

/** Ngôi sao 4 cánh. */
const Star: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="-10 -10 20 20" style={{ display: "block" }}>
    <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10 Z" fill={color} />
  </svg>
);

/**
 * Lấp lánh xác định rải trong một vùng: vị trí, cỡ, pha nhấp nháy theo seed.
 * `from` = frame (tuyệt đối) bắt đầu hiện.
 */
export const Sparkles: React.FC<{
  seed: string;
  count: number;
  width: number;
  height: number;
  unit: number;
  from: number;
}> = ({ seed, count, width, height, unit, from }) => {
  const frame = useCurrentFrame();
  const t = frame - from;
  if (t < 0) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const key = `${seed}-${i}`;
        const phase = seeded(`${key}-p`, 0, Math.PI * 2);
        const speed = seeded(`${key}-v`, 0.12, 0.22);
        const tw = Math.max(0, Math.sin(t * speed + phase));
        const appear = Math.min(1, t / (4 + i));
        const size = seeded(`${key}-s`, 18, 46) * unit * (0.35 + 0.65 * tw * tw) * appear;
        if (size < 1) return null;
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              left: seeded(`${key}-x`, -0.04, 1.04) * width - size / 2,
              top: seeded(`${key}-y`, -0.04, 1.04) * height - size / 2,
              opacity: 0.25 + 0.75 * tw,
              transform: `rotate(${t * 2 + seeded(`${key}-r`, 0, 90)}deg)`,
              filter: `drop-shadow(0 0 ${6 * unit}px ${GOLD})`,
            }}
          >
            <Star size={size} color={i % 3 === 0 ? "#ffffff" : GOLD_LIGHT} />
          </div>
        );
      })}
    </>
  );
};

/** Chiếc cúp nhỏ cho tiêu đề bảng xếp hạng. */
export const Trophy: React.FC<{ size: number; color?: string }> = ({ size, color = GOLD }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
    <path
      d="M14 6h20v12c0 6-4.5 10.5-10 10.5S14 24 14 18V6Z M14 10H6v3c0 5 3.5 8.5 8.6 8.9 M34 10h8v3c0 5-3.5 8.5-8.6 8.9"
      fill="none"
      stroke={color}
      strokeWidth={3.4}
      strokeLinejoin="round"
    />
    <path d="M14 6h20v12c0 6-4.5 10.5-10 10.5S14 24 14 18V6Z" fill={color} />
    <path d="M21 28h6v7h-6z M14 36h20v6H14z" fill={color} />
  </svg>
);
