/**
 * Bầu trời anime vẽ bằng CSS/SVG (nền khi cảnh không có ảnh và nền màn hình tiêu đề), tia nắng, vệt loé sáng
 * và cánh hoa anh đào trôi. Không feTurbulence, không ảnh — nhẹ và xác định theo frame.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { seeded, useLayout } from "../shared";
import { SAKURA, type Palette } from "./anime";

/** Một đám mây: các hình tròn chồng nhau trên một đáy phẳng, mặt dưới hơi ngả xanh như mây mùa hè. */
const Cloud: React.FC<{ x: number; y: number; w: number; id: string }> = ({ x, y, w, id }) => {
  const h = w * 0.34;
  const puffs = [
    [0.18, 0.62, 0.2],
    [0.36, 0.42, 0.26],
    [0.58, 0.36, 0.3],
    [0.78, 0.55, 0.22],
    [0.9, 0.7, 0.14],
    [0.06, 0.78, 0.12],
  ];
  return (
    <g>
      <defs>
        <linearGradient id={`anime-cloud-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={y - w * 0.3} x2={0} y2={y + h}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f3f8ff" />
          <stop offset="1" stopColor="#c9dcf5" />
        </linearGradient>
      </defs>
      <g fill={`url(#anime-cloud-${id})`}>
        {puffs.map(([px, py, r], i) => (
          <circle key={i} cx={x + px * w} cy={y + py * h} r={r * w} />
        ))}
        <rect x={x} y={y + h * 0.6} width={w} height={h * 0.4} rx={h * 0.2} />
      </g>
    </g>
  );
};

/**
 * Bầu trời xanh sâu → trắng xanh gần chân trời → ửng nắng ấm, mặt trời loé góc trên, tia nắng quay rất chậm,
 * mây trôi ngang. `id` để các bản vẽ cùng lúc (cảnh cũ/cảnh mới) không đụng id gradient SVG.
 */
export const SkyBackdrop: React.FC<{ palette: Palette; id: string; seed?: number }> = ({ palette, id, seed = 0 }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, unit } = useLayout();
  const portrait = H > W;
  // Mỗi cảnh không ảnh có bố cục mây riêng, cố định theo seed.
  const clouds = Array.from({ length: portrait ? 5 : 6 }, (_, i) => {
    const w = seeded(`anime-cloud-w-${seed}-${i}`, 0.34, 0.62) * (portrait ? W * 1.1 : W * 0.6);
    const baseX = seeded(`anime-cloud-x-${seed}-${i}`, -0.3, 1.0) * W;
    const speed = seeded(`anime-cloud-v-${seed}-${i}`, 0.25, 0.7) * unit;
    const y = H * (0.42 + (i / (portrait ? 5 : 6)) * 0.5) + seeded(`anime-cloud-y-${seed}-${i}`, -0.04, 0.04) * H;
    const span = W + w * 1.4;
    const x = ((((baseX + frame * speed + w * 0.7) % span) + span) % span) - w * 0.7;
    return { x, y, w };
  });
  const sunX = W * 0.78;
  const sunY = H * (portrait ? 0.14 : 0.16);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #1c5fd0 0%, #3d8ff0 30%, #8cc8ff 58%, #d8ecff 76%, #ffe6cf 100%)`,
        overflow: "hidden",
      }}
    >
      {/* Tia nắng: dải conic mảnh quanh mặt trời, quay 1 vòng mỗi ~2 phút. */}
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${frame * 0.05}deg at ${sunX}px ${sunY}px, rgba(255,255,255,0.16) 0deg 5deg, rgba(255,255,255,0) 5deg 17deg)`,
          maskImage: `radial-gradient(circle at ${sunX}px ${sunY}px, black 0%, rgba(0,0,0,0.5) 35%, transparent 75%)`,
          WebkitMaskImage: `radial-gradient(circle at ${sunX}px ${sunY}px, black 0%, rgba(0,0,0,0.5) 35%, transparent 75%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${sunX}px ${sunY}px, rgba(255,255,255,0.95) 0%, rgba(255,250,225,0.7) ${60 * unit}px, rgba(255,240,200,0.18) ${220 * unit}px, transparent ${520 * unit}px)`,
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {clouds.map((c, i) => (
          <Cloud key={i} x={c.x} y={c.y} w={c.w} id={`${id}-${i}`} />
        ))}
      </svg>
      {/* Ánh màu nhấn hắt nhẹ từ đáy cho hợp tông cả video. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 35% at 50% 105%, hsla(${palette.hue}, 90%, 70%, 0.35), transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Loé sáng mềm (bloom/light-leak): hai quầng ấm trôi chậm ở góc, pha screen. Đặt trên ảnh để có cảm giác
 * "key visual" nắng chiếu. `strength` 0..1.
 */
export const LightLeak: React.FC<{ strength?: number; palette: Palette }> = ({ strength = 1, palette }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 70) * 8;
  const pulse = 0.85 + 0.15 * Math.sin(frame / 45);
  return (
    <AbsoluteFill
      style={{
        opacity: strength * pulse,
        mixBlendMode: "screen",
        pointerEvents: "none",
        background: [
          `radial-gradient(ellipse 55% 40% at ${88 + drift * 0.5}% ${6 + drift * 0.3}%, rgba(255,236,190,0.55) 0%, rgba(255,200,150,0.18) 45%, transparent 72%)`,
          `radial-gradient(ellipse 45% 30% at ${6 - drift * 0.4}% ${96 - drift * 0.2}%, hsla(${palette.hue}, 100%, 75%, 0.28) 0%, transparent 70%)`,
          `linear-gradient(115deg, transparent 55%, rgba(255,255,255,0.06) 62%, transparent 70%)`,
        ].join(", "),
      }}
    />
  );
};

/** Cánh hoa anh đào: hình giọt có khía ở đầu, tô gradient hồng. */
const PETAL_PATH = "M0,-10 C6,-9 9,-2 7,5 C5,10 1,11 0,9 C-1,11 -5,10 -7,5 C-9,-2 -6,-9 0,-10 Z";

/**
 * Cánh hoa trôi chéo xuống, lắc qua lại và lật (scaleX dao động) như cánh thật. Vị trí suy thuần từ frame —
 * rơi hết khung thì vòng lại từ trên. `count` và `opacity` nhỏ để không lấn chữ.
 */
export const Petals: React.FC<{ count?: number; opacity?: number; seed?: string }> = ({
  count = 12,
  opacity = 0.85,
  seed = "anime-petal",
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, unit } = useLayout();
  const petals = Array.from({ length: count }, (_, i) => {
    const size = seeded(`${seed}-s-${i}`, 1.1, 2.3) * unit;
    const fall = seeded(`${seed}-v-${i}`, 1.4, 2.8) * unit;
    const wind = seeded(`${seed}-w-${i}`, 0.6, 1.6) * unit;
    const span = H + 80 * unit;
    const y = ((seeded(`${seed}-y-${i}`) * span + frame * fall) % span) - 40 * unit;
    const lap = Math.floor((seeded(`${seed}-y-${i}`) * span + frame * fall) / span);
    const x0 = seeded(`${seed}-x-${i}-${lap}`) * (W + 100 * unit) - 50 * unit;
    const sway = Math.sin(frame / seeded(`${seed}-p-${i}`, 14, 26) + i) * 28 * unit;
    const x = x0 - frame * wind * 0.5 + sway + ((y / span) * W) / 5;
    const spin = frame * seeded(`${seed}-r-${i}`, -3, 3) + seeded(`${seed}-r0-${i}`, 0, 360);
    const flip = Math.cos(frame / seeded(`${seed}-f-${i}`, 8, 16) + i);
    return { x: ((x % (W + 100 * unit)) + W + 100 * unit) % (W + 100 * unit) - 50 * unit, y, size, spin, flip, i };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`${seed}-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff2f7" />
            <stop offset="0.55" stopColor={SAKURA} />
            <stop offset="1" stopColor="#f58fb4" />
          </linearGradient>
        </defs>
        {petals.map((p) => (
          <g
            key={p.i}
            transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.spin.toFixed(1)}) scale(${(p.size * Math.max(0.25, Math.abs(p.flip))).toFixed(2)} ${p.size.toFixed(2)})`}
          >
            <path d={PETAL_PATH} fill={`url(#${seed}-grad)`} opacity={0.95} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
