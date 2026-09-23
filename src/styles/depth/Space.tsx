import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Grain, seeded, useLayout } from "../shared";
import { VOID, type Palette } from "./depth";

/**
 * Khối lập phương CSS 3D: 6 mặt, mỗi mặt một ô vuông `size` đẩy ra `size/2` theo trục của nó.
 * `wire` = chỉ khung (nét màu nhấn), không thì mặt kính mờ có viền. Đặt trong phần tử có `perspective`.
 */
export const Cube: React.FC<{
  size: number;
  rotateX: number;
  rotateY: number;
  palette: Palette;
  wire?: boolean;
  label?: string;
  labelSize?: number;
}> = ({ size, rotateX, rotateY, palette, wire = false, label, labelSize = 0 }) => {
  const half = size / 2;
  const faces = [
    `rotateY(0deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      }}
    >
      {faces.map((transform, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            transform,
            border: `${Math.max(1.5, size / 40)}px solid ${palette.key}`,
            borderRadius: size * 0.06,
            background: wire
              ? "transparent"
              : `linear-gradient(135deg, ${palette.glow(0.42)}, hsla(${palette.hue}, 60%, 18%, 0.55))`,
            // Khung dây không có quầng: 6 mặt × nhiều khối × bóng mờ là phần tốn nhất khi render.
            boxShadow: wire ? undefined : `0 0 ${size / 8}px ${palette.glow(0.55)}, inset 0 0 ${size / 6}px ${palette.glow(0.4)}`,
            backfaceVisibility: "visible",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {label && i < 4 ? (
            <span style={{ color: "#fff", fontWeight: 800, fontSize: labelSize, lineHeight: 1, whiteSpace: "nowrap" }}>{label}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

/**
 * Sàn lưới phối cảnh vẽ bằng SVG: đường ngang ở độ sâu z = 1, 2, 3… (trừ phần lẻ trôi theo frame nên như đang bay trên
 * sàn), đường dọc hội tụ về điểm tụ ở chân trời. Chiếu phối cảnh tính sẵn bằng JS — rẻ hơn nhiều so với một mặt phẳng
 * DOM khổng lồ xoay 3D tô gradient lặp. Mờ dần về chân trời bằng gradient.
 */
const FloorGrid: React.FC<{ palette: Palette; speed: number }> = ({ palette, speed }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const horizon = height * 0.6;
  const depth = height - horizon;
  const cell = 150 * unit;
  // Mỗi frame trôi `speed` px (ở mép dưới khung) — đổi ra phần lẻ của một ô.
  const drift = ((frame * speed * unit) / cell) % 1;
  const y = (z: number) => horizon + depth / z;
  const x = (xw: number, z: number) => width / 2 + (xw * cell) / z;
  const rows = Array.from({ length: 40 }, (_, k) => 1 + k - drift).filter((z) => z > 0.3);
  const columns = Array.from({ length: 61 }, (_, j) => j - 30);
  const line = Math.max(1.5, 2.5 * unit);
  const gid = "depth-floor-fade";
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1={horizon} x2="0" y2={height}>
          <stop offset="0" stopColor={palette.key} stopOpacity="0" />
          <stop offset="0.3" stopColor={palette.key} stopOpacity="0.45" />
          <stop offset="1" stopColor={palette.key} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gid})`} strokeWidth={line}>
        {rows.map((z) => (
          <line key={`r${z}`} x1={0} x2={width} y1={y(z)} y2={y(z)} />
        ))}
        {columns.map((xw) => (
          <line key={`c${xw}`} x1={x(xw, 0.3)} y1={y(0.3)} x2={x(xw, 60)} y2={y(60)} />
        ))}
      </g>
    </svg>
  );
};

/**
 * Sao/bụi sáng bay về phía camera: mỗi hạt có vị trí gốc và độ sâu theo seed, độ sâu tăng theo frame rồi quay vòng.
 * Chiếu phối cảnh thẳng từ tâm: càng gần càng to, càng xa tâm. Một SVG cho cả đàn — không box-shadow từng hạt.
 */
const Starfield: React.FC<{ count: number; speed: number; palette: Palette }> = ({ count, speed, palette }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const cx = width / 2;
  const cy = height * 0.42;
  const stars = Array.from({ length: count }, (_, i) => {
    const angle = seeded(`depth-star-a-${i}`, 0, Math.PI * 2);
    const spread = seeded(`depth-star-r-${i}`, 0.08, 1);
    const z = (seeded(`depth-star-z-${i}`) + frame * speed * 0.0025) % 1;
    const k = 1 / (1.08 - z);
    const dist = spread * Math.max(width, height) * 0.09 * k;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: (0.6 + 1.6 * z * z) * unit,
      alpha: Math.min(1, z * 1.6) * (z > 0.94 ? (1 - z) / 0.06 : 1),
      tinted: i % 5 === 0,
      i,
    };
  });
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      {stars.map((s) => (
        <g key={s.i} opacity={s.alpha}>
          <circle cx={s.x} cy={s.y} r={s.r * 3} fill={s.tinted ? palette.key : "#c8d7ff"} opacity={0.18} />
          <circle cx={s.x} cy={s.y} r={s.r} fill={s.tinted ? palette.key : "#eef2ff"} />
        </g>
      ))}
    </svg>
  );
};

/** Ba khối khung dây trôi quanh rìa khung, xoay chậm — lấp khoảng trống, tạo chiều sâu. */
const DriftingCubes: React.FC<{ palette: Palette; big?: boolean }> = ({ palette, big = false }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const cubes = [
    { x: 0.14, y: 0.2, s: 90, sp: 0.6 },
    { x: 0.86, y: 0.3, s: 70, sp: -0.8 },
    { x: 0.78, y: 0.64, s: 110, sp: 0.5 },
  ];
  return (
    <AbsoluteFill style={{ perspective: 1200 * unit }}>
      {cubes.map((c, i) => {
        const size = c.s * unit * (big ? 1.4 : 1);
        const bob = Math.sin(frame / 45 + i * 2) * 14 * unit;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: width * c.x - size / 2,
              top: height * c.y - size / 2 + bob,
              transformStyle: "preserve-3d",
              opacity: 0.75,
            }}
          >
            <Cube size={size} rotateX={frame * c.sp * 0.7 + i * 30} rotateY={frame * c.sp + i * 50} palette={palette} wire />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Khoảng không phía sau mọi cảnh: trời gradient, quầng chân trời, sàn lưới trôi, sao bay tới, khối khung dây.
 * `rush` > 1 khi đang chuyển cảnh — sao và sàn chạy nhanh hơn như camera tăng tốc.
 */
export const Space: React.FC<{ palette: Palette; rush?: number; cubes?: "small" | "big" | "none" }> = ({
  palette,
  rush = 1,
  cubes = "small",
}) => {
  const frame = useCurrentFrame();
  const pulse = 0.85 + 0.15 * Math.sin(frame / 50);
  return (
    <AbsoluteFill style={{ backgroundColor: VOID }}>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${palette.skyTop} 0%, ${palette.skyHorizon} 58%, ${VOID} 62%, ${VOID} 100%)` }} />
      {/* Quầng sáng ở chân trời — nơi sàn gặp trời. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 16% at 50% 60%, ${palette.glow(0.42 * pulse)} 0%, transparent 70%)`,
        }}
      />
      <FloorGrid palette={palette} speed={4 * rush} />
      <Starfield count={70} speed={rush} palette={palette} />
      {cubes !== "none" ? <DriftingCubes palette={palette} big={cubes === "big"} /> : null}
      <Grain opacity={0.08} baseFrequency={0.85} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 50%, rgba(2,2,8,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};
