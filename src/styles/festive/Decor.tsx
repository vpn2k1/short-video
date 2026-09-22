/**
 * Hoạ tiết của phong cách "Lễ hội Tết" — toàn bộ vẽ bằng SVG, không cần file ảnh:
 * nền đỏ có hoạ tiết mây (tường vân), viền lá vàng có hoa văn góc, lồng đèn đỏ đung đưa, cánh mai/đào rơi,
 * ánh kim lấp lánh, pháo hoa, mưa xu vàng + bao lì xì, cành mai/đào, bao lì xì và đồng xu cho con số.
 *
 * Mọi thứ ngẫu nhiên đều qua seeded() — cùng frame luôn ra cùng hình.
 */
import { AbsoluteFill, interpolate } from "remotion";
import { seeded } from "../shared";
import {
  clamp, CREAM, DAO, DAO_CORE, GOLD, GOLD_DEEP, GOLD_FOIL, GOLD_LIGHT, MAI, MAI_CORE, RED, RED_BRIGHT, RED_DARK, RED_DEEP,
  ROUND, SERIF, upper,
} from "./palette";

// ---------------------------------------------------------------------------
// Nền đỏ + mây + viền vàng
// ---------------------------------------------------------------------------

/** Một cụm mây tường vân (hộp 120 × 70): thân mây + các đuôi xoắn ốc. */
const CLOUD = [
  "M20 60 C6 60 4 42 18 40 C14 26 32 18 42 28 C46 12 70 10 76 26 C84 16 104 20 102 36 C116 36 118 58 102 60 Z",
  "M42 28 C40 38 52 42 56 34 C58 28 50 26 48 32",
  "M76 26 C74 36 88 40 90 32 C91 27 84 26 83 31",
  "M18 40 C22 48 32 46 32 40",
  "M102 60 C112 66 122 60 118 52",
];

export const Cloud: React.FC<{ x: number; y: number; scale: number; opacity: number; stroke?: string }> = ({
  x, y, scale, opacity, stroke = GOLD,
}) => (
  <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})`} opacity={opacity}>
    {CLOUD.map((d, i) => (
      <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </g>
);

/** Hoa văn góc: xoắn vuông (hồi văn) + chấm tròn — vẽ cho góc trên trái, lật cho ba góc còn lại. */
const CornerFret: React.FC<{ size: number }> = ({ size }) => {
  const s = size / 80;
  return (
    <g transform={`scale(${s.toFixed(3)})`} fill="none" stroke="url(#fe-foil)" strokeLinecap="square">
      <path d="M8 72 L8 8 L72 8" strokeWidth={5} />
      <path d="M20 58 L20 20 L58 20 L58 44 L34 44 L34 32 L46 32" strokeWidth={3.4} />
      <circle cx={72} cy={8} r={4} fill={GOLD} stroke="none" />
      <circle cx={8} cy={72} r={4} fill={GOLD} stroke="none" />
    </g>
  );
};

/** Gradient lá vàng dùng chung cho mọi SVG có id "fe-foil" — mỗi SVG tự khai báo để không phụ thuộc thứ tự vẽ. */
export const FoilDefs: React.FC<{ id?: string }> = ({ id = "fe-foil" }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={GOLD_DEEP} />
      <stop offset="0.3" stopColor={GOLD} />
      <stop offset="0.5" stopColor={GOLD_LIGHT} />
      <stop offset="0.7" stopColor={GOLD} />
      <stop offset="1" stopColor={GOLD_DEEP} />
    </linearGradient>
  </defs>
);

/**
 * Nền cả khung: đỏ son sáng giữa, thẫm ra mép; các cụm mây vàng mờ rải theo lưới lệch hàng, trôi ngang rất chậm;
 * viền lá vàng đôi ở mép kèm hoa văn góc.
 */
export const RedBackdrop: React.FC<{ width: number; height: number; unit: number; frame: number }> = ({ width, height, unit, frame }) => {
  const cell = 300 * unit;
  const cols = Math.ceil(width / cell) + 2;
  const rows = Math.ceil(height / (cell * 0.62)) + 1;
  const drift = ((frame * 0.25 * unit) % cell) - cell;
  const clouds: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cell + (r % 2 ? cell / 2 : 0) + drift + seeded(`fe-cx-${r}-${c}`, -20, 20) * unit;
      const y = r * cell * 0.62 + seeded(`fe-cy-${r}-${c}`, -16, 16) * unit;
      clouds.push(<Cloud key={`${r}-${c}`} x={x} y={y} scale={1.5 * unit} opacity={0.13} />);
    }
  }
  const m = 26 * unit;
  const corner = 92 * unit;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${RED_BRIGHT} 0%, ${RED} 38%, ${RED_DEEP} 82%, ${RED_DARK} 100%)` }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <FoilDefs />
        {clouds}
        {/* Viền lá vàng: nét dày ngoài + chỉ mảnh trong. */}
        <rect x={m} y={m} width={width - m * 2} height={height - m * 2} fill="none" stroke="url(#fe-foil)" strokeWidth={5 * unit} />
        <rect
          x={m + 13 * unit} y={m + 13 * unit} width={width - (m + 13 * unit) * 2} height={height - (m + 13 * unit) * 2}
          fill="none" stroke={GOLD} strokeOpacity={0.7} strokeWidth={1.6 * unit}
        />
        {[
          `translate(${m} ${m})`,
          `translate(${width - m} ${m}) scale(-1 1)`,
          `translate(${m} ${height - m}) scale(1 -1)`,
          `translate(${width - m} ${height - m}) scale(-1 -1)`,
        ].map((t, i) => (
          <g key={i} transform={t}>
            <CornerFret size={corner} />
          </g>
        ))}
      </svg>
      {/* Tối nhẹ ở mép cho các lớp trên nổi bật. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(40, 0, 4, 0.45) 100%)" }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Lồng đèn
// ---------------------------------------------------------------------------

/**
 * Lồng đèn đỏ treo từ mép trên (hộp 120 × 260: dây 0–70, chóp vàng, thân tròn, đáy vàng, tua rua).
 * Xoay quanh điểm treo ở đỉnh nên đung đưa như thật.
 */
export const Lantern: React.FC<{ x: number; top: number; width: number; rotate: number; drop: number; glow: number; id: string }> = ({
  x, top, width, rotate, drop, glow, id,
}) => {
  const h = width * (260 / 120);
  return (
    <div
      style={{
        position: "absolute", left: x - width / 2, top, width, height: h,
        transformOrigin: "50% 0%", rotate: `${rotate.toFixed(2)}deg`, translate: `0 ${drop.toFixed(1)}px`,
      }}
    >
      <svg width={width} height={h} viewBox="0 0 120 260" style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={`${id}-body`} cx="0.42" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#ff5a3c" />
            <stop offset="0.45" stopColor={RED_BRIGHT} />
            <stop offset="1" stopColor={RED_DEEP} />
          </radialGradient>
          <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffb347" stopOpacity={0.55} />
            <stop offset="1" stopColor="#ffb347" stopOpacity={0} />
          </radialGradient>
          <FoilDefs id={`${id}-foil`} />
        </defs>
        {/* Quầng sáng ấm sau thân đèn, thở nhẹ. */}
        <circle cx={60} cy={137} r={95} fill={`url(#${id}-glow)`} opacity={glow} />
        <line x1={60} y1={-400} x2={60} y2={72} stroke={GOLD_DEEP} strokeWidth={2.4} />
        <rect x={38} y={70} width={44} height={15} rx={3} fill={`url(#${id}-foil)`} />
        <ellipse cx={60} cy={137} rx={54} ry={56} fill={`url(#${id}-body)`} />
        {/* Nan đèn: các cung vàng dọc thân. */}
        {[-36, -18, 0, 18, 36].map((dx) => (
          <path
            key={dx}
            d={`M60 82 Q${60 + dx * 1.5} 137 60 192`}
            fill="none" stroke={GOLD} strokeOpacity={dx === 0 ? 0.55 : 0.4} strokeWidth={1.6}
          />
        ))}
        {/* Đai vàng ngang giữa thân. */}
        <ellipse cx={60} cy={137} rx={54} ry={8} fill="none" stroke={GOLD} strokeOpacity={0.55} strokeWidth={2} />
        <ellipse cx={46} cy={112} rx={14} ry={22} fill="#fff" opacity={0.12} />
        <rect x={38} y={189} width={44} height={14} rx={3} fill={`url(#${id}-foil)`} />
        {/* Tua rua: nút vàng + các sợi đỏ. */}
        <circle cx={60} cy={210} r={5} fill={GOLD} />
        {[-10, -5, 0, 5, 10].map((dx) => (
          <line key={dx} x1={60 + dx * 0.3} y1={213} x2={60 + dx} y2={256} stroke={dx === 0 ? GOLD : RED_BRIGHT} strokeWidth={2.4} strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hoa mai / hoa đào
// ---------------------------------------------------------------------------

/** Một bông 5 cánh ở (0,0), bán kính r. */
export const Flower: React.FC<{ r: number; color: string; core: string; rotate?: number }> = ({ r, color, core, rotate = 0 }) => (
  <g transform={`rotate(${rotate.toFixed(1)})`}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx={0} cy={-r * 0.55} rx={r * 0.4} ry={r * 0.56} fill={color} transform={`rotate(${a})`} />
    ))}
    <circle r={r * 0.26} fill={core} />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <circle key={a} cx={0} cy={-r * 0.36} r={r * 0.06} fill={core} transform={`rotate(${a})`} />
    ))}
  </g>
);

/** Một cánh hoa lẻ (giọt nước). */
const Petal: React.FC<{ r: number; color: string }> = ({ r, color }) => (
  <path d={`M0 ${-r} C${r * 0.8} ${-r * 0.5} ${r * 0.55} ${r * 0.7} 0 ${r} C${-r * 0.55} ${r * 0.7} ${-r * 0.8} ${-r * 0.5} 0 ${-r} Z`} fill={color} />
);

/**
 * Cánh mai vàng + đào hồng rơi lả tả khắp khung, lặp vô hạn theo frame. Vài phần là bông nguyên, còn lại là cánh lẻ.
 */
export const FallingPetals: React.FC<{ width: number; height: number; unit: number; frame: number; count?: number; opacity?: number }> = ({
  width, height, unit, frame, count = 22, opacity = 0.92,
}) => {
  const span = height + 200 * unit;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const speed = seeded(`fe-pv-${i}`, 1.3, 2.8) * unit;
        const y = ((frame * speed + seeded(`fe-po-${i}`) * span) % span) - 100 * unit;
        const sway = Math.sin(frame / seeded(`fe-pp-${i}`, 22, 40) + i) * seeded(`fe-pa-${i}`, 20, 70) * unit;
        const x = seeded(`fe-px-${i}`) * width + sway;
        const mai = i % 2 === 0;
        const whole = i % 3 === 0;
        const r = seeded(`fe-ps-${i}`, whole ? 16 : 11, whole ? 26 : 18) * unit;
        const rot = frame * seeded(`fe-pr-${i}`, -3, 3) + i * 40;
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={opacity}>
            {whole ? (
              <Flower r={r} color={mai ? MAI : DAO} core={mai ? MAI_CORE : DAO_CORE} rotate={rot} />
            ) : (
              <g transform={`rotate(${rot.toFixed(1)}) scale(1 ${(0.55 + 0.45 * Math.abs(Math.cos(frame / 14 + i))).toFixed(3)})`}>
                <Petal r={r} color={mai ? MAI : DAO} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Cành mai (hoặc đào) vẽ bằng nét: thân cong + nhánh con + bông hoa + nụ. Gốc ở (0,0), vươn sang phải-lên.
 * `grow` 0→1: nét cành vẽ dần rồi hoa nở theo.
 */
export const BlossomBranch: React.FC<{ scale: number; kind: "mai" | "dao"; grow: number; transform?: string }> = ({
  scale, kind, grow, transform = "",
}) => {
  const color = kind === "mai" ? MAI : DAO;
  const core = kind === "mai" ? MAI_CORE : DAO_CORE;
  const flowers: [number, number, number][] = [
    [120, -58, 17], [190, -96, 14], [238, -86, 11], [78, -30, 12], [160, -120, 10], [262, -128, 12], [132, -12, 9],
  ];
  return (
    <g transform={`${transform} scale(${scale.toFixed(3)})`}>
      <path
        d="M0 0 C60 -10 110 -50 170 -90 C200 -110 240 -118 280 -140"
        fill="none" stroke="#4d2410" strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - grow}
      />
      <path
        d="M110 -50 C130 -40 150 -20 170 -14 M170 -90 C175 -110 170 -130 158 -140 M220 -108 C240 -96 256 -92 272 -94"
        fill="none" stroke="#4d2410" strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1"
        strokeDashoffset={1 - Math.max(0, grow * 1.4 - 0.4)}
      />
      {flowers.map(([x, y, r], i) => {
        const t = interpolate(grow, [0.3 + i * 0.07, 0.6 + i * 0.07], [0, 1], clamp);
        return t > 0 ? (
          <g key={i} transform={`translate(${x} ${y}) scale(${t.toFixed(3)})`}>
            {i % 4 === 3 ? <circle r={r * 0.55} fill={color} stroke={core} strokeWidth={1.5} /> : <Flower r={r} color={color} core={core} rotate={i * 23} />}
          </g>
        ) : null;
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Ánh kim, pháo hoa, mưa xu + lì xì
// ---------------------------------------------------------------------------

const starPath = (s: number) =>
  `M0 ${-s} L${s * 0.2} ${-s * 0.2} L${s} 0 L${s * 0.2} ${s * 0.2} L0 ${s} L${-s * 0.2} ${s * 0.2} L${-s} 0 L${-s * 0.2} ${-s * 0.2} Z`;

/** Ánh kim bốn cánh chợt loé ở vài chỗ rải rác, mỗi chỗ một nhịp. */
export const Sparkles: React.FC<{ width: number; height: number; unit: number; frame: number; count?: number }> = ({
  width, height, unit, frame, count = 12,
}) => (
  <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    <defs>
      <radialGradient id="fe-glint">
        <stop offset="0" stopColor={GOLD_LIGHT} stopOpacity={0.8} />
        <stop offset="1" stopColor={GOLD_LIGHT} stopOpacity={0} />
      </radialGradient>
    </defs>
    {Array.from({ length: count }, (_, i) => {
      const period = seeded(`fe-sp-${i}`, 50, 95);
      // Mỗi chu kỳ loé ở một chỗ mới — không nhấp nháy mãi một điểm.
      const cycle = Math.floor((frame + seeded(`fe-so-${i}`) * period) / period);
      const phase = ((frame + seeded(`fe-so-${i}`) * period) % period) / period;
      const flash = Math.max(0, Math.sin(phase * Math.PI * 2)) ** 6;
      if (flash < 0.02) return null;
      const x = seeded(`fe-sx-${i}-${cycle}`, 0.05, 0.95) * width;
      const y = seeded(`fe-sy-${i}-${cycle}`, 0.04, 0.96) * height;
      const s = seeded(`fe-ss-${i}`, 14, 26) * unit * (0.4 + flash * 0.6);
      return (
        <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={flash}>
          <circle r={s * 1.1} fill="url(#fe-glint)" />
          <path d={starPath(s)} fill={GOLD_LIGHT} />
          <path d={starPath(s * 0.45)} fill="#fff" transform="rotate(45)" />
        </g>
      );
    })}
  </svg>
);

const BURST_COLORS = [GOLD, GOLD_LIGHT, "#ff6a4d", DAO, "#fff"];

/**
 * Một chùm pháo hoa tại (cx, cy): các tia toả tròn, đầu tia là chấm sáng kéo vệt, rơi nhẹ theo trọng lực rồi tắt.
 * `t` 0→1 là tiến trình của chùm (≈ 36 frame).
 */
export const Burst: React.FC<{ cx: number; cy: number; radius: number; t: number; seed: string; unit: number }> = ({
  cx, cy, radius, t, seed, unit,
}) => {
  if (t <= 0 || t >= 1) return null;
  const n = 26;
  const spread = 1 - (1 - t) ** 3;
  const fade = t < 0.08 ? t / 0.08 : 1 - Math.max(0, (t - 0.5) / 0.5);
  const fall = radius * 0.22 * t * t;
  return (
    <g opacity={fade}>
      {t < 0.25 ? <circle cx={cx} cy={cy} r={radius * 0.1 * (1 - t / 0.25)} fill={GOLD_LIGHT} opacity={0.8} /> : null}
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + seeded(`${seed}-a-${i}`, -0.08, 0.08);
        const reach = radius * seeded(`${seed}-r-${i}`, 0.72, 1) * spread;
        const tail = reach * (0.45 + t * 0.3);
        const color = BURST_COLORS[Math.floor(seeded(`${seed}-c-${i}`) * BURST_COLORS.length)];
        const hx = cx + Math.cos(a) * reach;
        const hy = cy + Math.sin(a) * reach + fall;
        const tx = cx + Math.cos(a) * tail;
        const ty = cy + Math.sin(a) * tail + fall * 0.6;
        const dot = (4 + seeded(`${seed}-d-${i}`) * 3) * unit * (1 - t * 0.55);
        // Lúc mới nổ các tia còn chụm ở tâm — chưa vẽ để khỏi thành một cục rối.
        if (reach < radius * 0.18) return null;
        return (
          <g key={i}>
            <line x1={tx} y1={ty} x2={hx} y2={hy} stroke={color} strokeWidth={dot * 0.55} strokeLinecap="round" opacity={0.75} />
            <circle cx={hx} cy={hy} r={dot} fill={color} />
            {/* Tia phụ ngắn hơn giữa các tia chính. */}
            {i % 2 === 0 ? (
              <circle cx={cx + Math.cos(a + Math.PI / n) * reach * 0.6} cy={cy + Math.sin(a + Math.PI / n) * reach * 0.6 + fall * 0.5} r={dot * 0.6} fill={GOLD_LIGHT} />
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

/** Đồng xu vàng lỗ vuông (0,0), bán kính r. */
const Coin: React.FC<{ r: number }> = ({ r }) => (
  <g>
    <circle r={r} fill={GOLD} stroke={GOLD_DEEP} strokeWidth={r * 0.12} />
    <circle r={r * 0.72} fill="none" stroke={GOLD_DEEP} strokeWidth={r * 0.06} opacity={0.7} />
    <rect x={-r * 0.24} y={-r * 0.24} width={r * 0.48} height={r * 0.48} fill={RED_DEEP} stroke={GOLD_DEEP} strokeWidth={r * 0.06} />
    <ellipse cx={-r * 0.35} cy={-r * 0.4} rx={r * 0.22} ry={r * 0.12} fill="#fff" opacity={0.45} transform="rotate(-35)" />
  </g>
);

/** Bao lì xì nhỏ (0,0), cao 2r. */
const MiniEnvelope: React.FC<{ r: number }> = ({ r }) => (
  <g>
    <rect x={-r * 0.72} y={-r} width={r * 1.44} height={r * 2} rx={r * 0.12} fill={RED_BRIGHT} stroke={GOLD} strokeWidth={r * 0.08} />
    <path d={`M${-r * 0.72} ${-r * 0.55} L0 ${-r * 0.1} L${r * 0.72} ${-r * 0.55}`} fill="none" stroke={GOLD} strokeWidth={r * 0.1} />
    <circle cy={-r * 0.1} r={r * 0.22} fill={GOLD} />
  </g>
);

/**
 * Mưa xu vàng + bao lì xì rơi từ trên xuống, xoay lật, bắt đầu ở frame `start` và kéo dài ~80 frame.
 */
export const LuckyRain: React.FC<{ width: number; height: number; unit: number; frame: number; start: number; seed: string }> = ({
  width, height, unit, frame, start, seed,
}) => {
  const local = frame - start;
  if (local < 0 || local > 90) return null;
  const fade = interpolate(local, [64, 90], [1, 0], clamp);
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: 20 }, (_, i) => {
        const delay = seeded(`${seed}-ld-${i}`, 0, 16);
        const t = local - delay;
        if (t < 0) return null;
        const speed = seeded(`${seed}-lv-${i}`, 16, 28) * unit;
        const x = seeded(`${seed}-lx-${i}`, 0.04, 0.96) * width + Math.sin(t / 9 + i) * 18 * unit;
        const y = -60 * unit + t * speed + 0.06 * t * t * unit;
        const r = seeded(`${seed}-lr-${i}`, 16, 26) * unit;
        const spin = t * seeded(`${seed}-ls-${i}`, -9, 9);
        const flip = Math.cos(t / 5 + i);
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${spin.toFixed(1)}) scale(${flip.toFixed(3)} 1)`} opacity={fade}>
            {i % 3 === 0 ? <MiniEnvelope r={r} /> : <Coin r={r * 0.8} />}
          </g>
        );
      })}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Con số: bao lì xì (stat) và đồng xu mạ vàng (badge)
// ---------------------------------------------------------------------------

/** Bao lì xì lớn: nắp chữ V viền vàng, khuy tròn vàng, con số vàng lớn giữa bao, chú thích trắng ngà bên dưới. */
export const EnvelopeCard: React.FC<{ width: number; text: string; caption: string | null; unit: number }> = ({ width, text, caption, unit }) => {
  const h = width * 1.36;
  const numSize = Math.min(width * 0.42, (width * 0.8) / Math.max(1, [...text].length * 0.68));
  return (
    <div
      style={{
        position: "relative", width, height: h, borderRadius: width * 0.06, overflow: "hidden",
        background: `linear-gradient(160deg, ${RED_BRIGHT} 0%, ${RED} 55%, ${RED_DEEP} 100%)`,
        boxShadow: `0 ${18 * unit}px ${40 * unit}px rgba(40, 0, 4, 0.55), 0 0 0 ${3 * unit}px ${GOLD}, 0 0 ${30 * unit}px rgba(255, 200, 80, 0.35)`,
      }}
    >
      <svg width={width} height={h} viewBox={`0 0 100 ${136}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <FoilDefs id="fe-env-foil" />
        <path d="M0 0 L100 0 L100 26 L50 50 L0 26 Z" fill={RED_DEEP} />
        <path d="M0 26 L50 50 L100 26" fill="none" stroke="url(#fe-env-foil)" strokeWidth={2.2} />
        <rect x={5} y={5} width={90} height={126} rx={4} fill="none" stroke={GOLD} strokeOpacity={0.55} strokeWidth={0.8} />
      </svg>
      {/* Khuy tròn vàng ở mũi nắp. */}
      <div
        style={{
          position: "absolute", left: width / 2 - width * 0.1, top: h * (50 / 136) - width * 0.1, width: width * 0.2, height: width * 0.2,
          borderRadius: "50%", background: GOLD_FOIL, boxShadow: `0 ${3 * unit}px ${8 * unit}px rgba(0,0,0,0.3)`,
        }}
      />
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: h * 0.47, bottom: h * 0.06,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 * unit,
        }}
      >
        <div
          style={{
            fontFamily: SERIF, fontWeight: 800, fontSize: numSize, lineHeight: 1.1, color: GOLD, whiteSpace: "nowrap",
            textShadow: `0 ${2 * unit}px 0 ${GOLD_DEEP}, 0 0 ${18 * unit}px rgba(255, 210, 90, 0.55)`,
          }}
        >
          {text}
        </div>
        {caption ? (
          <div
            style={{
              // Chú thích dài xuống 2 dòng; cỡ chữ co theo số ký tự mỗi dòng (Baloo ~0.55em/ký tự) để luôn nằm gọn
              // trong bao, chừa lề 12% mỗi bên — không bao giờ bị cắt ở mép bao.
              fontFamily: ROUND, fontWeight: 600,
              fontSize: Math.min(width * 0.1, (width * 0.76) / (Math.max(1, Math.ceil([...caption].length / ([...caption].length > 14 ? 2 : 1))) * 0.55)),
              lineHeight: 1.22, color: CREAM, textAlign: "center", boxSizing: "border-box", width: "100%",
              padding: `0 ${width * 0.12}px`, overflowWrap: "anywhere",
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Đồng xu mạ vàng lớn: vành răng cưa, vòng trong đỏ, chữ vàng in hoa. Chú thích nằm dưới đồng xu. */
export const CoinMedal: React.FC<{ size: number; text: string; caption: string | null; unit: number }> = ({ size, text, caption, unit }) => {
  const label = upper(text);
  const fs = Math.min(size * 0.26, (size * 0.62) / Math.max(1, [...label].length * 0.55));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * unit }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <FoilDefs id="fe-coin-foil" />
          {/* Vành răng cưa. */}
          <path
            d={Array.from({ length: 32 }, (_, i) => {
              const a = (i / 32) * Math.PI * 2;
              const rr = i % 2 ? 46 : 50;
              return `${i ? "L" : "M"}${(50 + Math.cos(a) * rr).toFixed(2)} ${(50 + Math.sin(a) * rr).toFixed(2)}`;
            }).join(" ") + " Z"}
            fill="url(#fe-coin-foil)"
            style={{ filter: `drop-shadow(0 ${4 * unit}px ${10 * unit}px rgba(40,0,4,0.5))` }}
          />
          <circle cx={50} cy={50} r={39} fill={RED} stroke={GOLD_DEEP} strokeWidth={1.5} />
          <circle cx={50} cy={50} r={35} fill="none" stroke={GOLD} strokeWidth={0.8} strokeDasharray="2 2" />
        </svg>
        <div
          style={{
            position: "absolute", inset: 0, display: "grid", placeItems: "center",
            fontFamily: ROUND, fontWeight: 800, fontSize: fs, lineHeight: 1, color: GOLD, paddingTop: fs * 0.12,
            textShadow: `0 ${2 * unit}px 0 ${RED_DARK}`, whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>
      {caption ? (
        <div
          style={{
            fontFamily: ROUND, fontWeight: 700, fontSize: 30 * unit, lineHeight: 1.25, color: CREAM, textAlign: "center",
            padding: `${6 * unit}px ${20 * unit}px`, borderRadius: 40 * unit, backgroundColor: "rgba(74, 4, 10, 0.8)",
            border: `${2 * unit}px solid ${GOLD}`, maxWidth: size * 1.6,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};
