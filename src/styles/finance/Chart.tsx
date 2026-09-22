/**
 * Biểu đồ giá nền: lưới mảnh, đường giá + vùng tô tự vẽ từ trái sang phải suốt video, cột khối lượng,
 * đường tham chiếu, trục giá bên phải với nhãn giá hiện tại, điểm đầu nhấp nháy.
 */
import { AbsoluteFill } from "remotion";
import { fmtPrice, INK, LINE, MUTED, priceOf, type Series, valueAt } from "./market";

export type Plot = {
  x0: number;
  x1: number;
  /** Dải dọc của đường giá (giá cao nhất ↔ thấp nhất). */
  yTop: number;
  yBot: number;
  /** Dải cột khối lượng. */
  volTop: number;
  volBot: number;
  duration: number;
};

export const xOf = (p: Plot, frame: number) => p.x0 + (Math.min(frame, p.duration - 1) / Math.max(1, p.duration - 1)) * (p.x1 - p.x0);
export const yOf = (p: Plot, s: Series, v: number) => p.yBot - ((v - s.min) / Math.max(0.001, s.max - s.min)) * (p.yBot - p.yTop);

/**
 * Màu đường theo giá so với tham chiếu, có trễ ±0,35% để không nháy đỏ-xanh khi giá lượn quanh mốc.
 * Quét từ đầu tới frame hiện tại nên vẫn xác định.
 */
export const trendUp = (s: Series, frame: number) => {
  let up = true;
  const last = Math.min(s.values.length - 1, Math.floor(frame / s.step));
  for (let i = 0; i <= last; i++) {
    if (up && s.values[i] < -0.35) up = false;
    else if (!up && s.values[i] > 0.35) up = true;
  }
  const v = valueAt(s, frame);
  if (up && v < -0.35) up = false;
  else if (!up && v > 0.35) up = true;
  return up;
};

export const PriceChart: React.FC<{
  series: Series;
  plot: Plot;
  frame: number;
  color: string;
  unit: number;
  width: number;
  height: number;
  axisFont: number;
}> = ({ series: s, plot: p, frame, color, unit, width, height, axisFont }) => {
  const head = Math.min(frame, p.duration - 1);
  const last = Math.min(s.values.length - 1, Math.floor(head / s.step));
  const pts: [number, number][] = [];
  for (let i = 0; i <= last; i++) pts.push([xOf(p, i * s.step), yOf(p, s, s.values[i])]);
  const hv = valueAt(s, head);
  const hx = xOf(p, head);
  const hy = yOf(p, s, hv);
  pts.push([hx, hy]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${hx.toFixed(1)},${p.volBot.toFixed(1)} L${p.x0.toFixed(1)},${p.volBot.toFixed(1)} Z`;

  // Mốc giá trên trục: 5 vạch đều trong dải đường giá.
  const levels = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = p.yTop + t * (p.yBot - p.yTop);
    const v = s.max - t * (s.max - s.min);
    return { y, label: fmtPrice(priceOf(s, v)) };
  });
  const refY = yOf(p, s, 0);
  const barGap = (p.x1 - p.x0) / Math.max(1, s.values.length - 1);
  const volMax = Math.max(...s.volumes);
  const pillH = axisFont * 1.7;
  const axisX = p.x1 + 12 * unit;
  const pulse = (frame % 30) / 30;

  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="fin-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.34} />
            <stop offset="55%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id="fin-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={6 * unit} />
          </filter>
        </defs>
        {/* Vạch mốc giá ngang + trục bên phải */}
        {levels.map((l, i) => (
          <line key={`lv-${i}`} x1={p.x0} x2={p.x1} y1={l.y} y2={l.y} stroke={LINE} strokeWidth={1.5 * unit} strokeDasharray={`${6 * unit} ${8 * unit}`} />
        ))}
        <line x1={p.x1} x2={p.x1} y1={p.yTop - 60 * unit} y2={p.volBot} stroke={LINE} strokeWidth={1.5 * unit} />
        {/* Đường tham chiếu (giá mở cửa) */}
        {refY > p.yTop - 4 && refY < p.yBot + 4 ? (
          <line x1={p.x0} x2={p.x1} y1={refY} y2={refY} stroke="rgba(245, 190, 70, 0.55)" strokeWidth={2 * unit} strokeDasharray={`${3 * unit} ${7 * unit}`} />
        ) : null}
        {/* Cột khối lượng */}
        {s.volumes.slice(0, last + 1).map((vol, i) => {
          const h = (vol / volMax) * (p.volBot - p.volTop);
          const upBar = i === 0 || s.values[i] >= s.values[i - 1];
          return (
            <rect
              key={`vol-${i}`}
              x={xOf(p, i * s.step) - barGap * 0.3}
              y={p.volBot - h}
              width={Math.max(1, barGap * 0.6)}
              height={h}
              fill={upBar ? "rgba(22, 199, 132, 0.32)" : "rgba(234, 57, 67, 0.32)"}
            />
          );
        })}
        <path d={area} fill="url(#fin-area)" />
        <path d={line} fill="none" stroke={color} strokeWidth={9 * unit} strokeOpacity={0.35} filter="url(#fin-glow)" strokeLinejoin="round" />
        <path d={line} fill="none" stroke={color} strokeWidth={4.5 * unit} strokeLinejoin="round" strokeLinecap="round" />
        {/* Giá hiện tại: vạch đứt tới trục */}
        <line x1={hx} x2={p.x1} y1={hy} y2={hy} stroke={color} strokeOpacity={0.7} strokeWidth={2 * unit} strokeDasharray={`${5 * unit} ${6 * unit}`} />
        <circle cx={hx} cy={hy} r={(12 + pulse * 26) * unit} fill={color} fillOpacity={0.35 * (1 - pulse)} />
        <circle cx={hx} cy={hy} r={10 * unit} fill={color} stroke={INK} strokeWidth={3 * unit} />
      </svg>
      {levels.map((l, i) =>
        Math.abs(l.y - hy) < pillH ? null : (
          <div
            key={`lab-${i}`}
            style={{
              position: "absolute",
              left: axisX,
              top: l.y - axisFont * 0.7,
              fontSize: axisFont,
              lineHeight: 1.4,
              color: MUTED,
              fontFamily: "inherit",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {l.label}
          </div>
        ),
      )}
      <div
        style={{
          position: "absolute",
          left: p.x1,
          top: hy - pillH / 2,
          height: pillH,
          display: "flex",
          alignItems: "center",
          padding: `0 ${12 * unit}px`,
          borderRadius: 6 * unit,
          backgroundColor: color,
          color: "#03110b",
          fontSize: axisFont,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          boxShadow: `0 0 ${18 * unit}px ${color}88`,
        }}
      >
        {fmtPrice(priceOf(s, hv))}
      </div>
    </AbsoluteFill>
  );
};
