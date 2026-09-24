/**
 * Đồ bếp vẽ bằng code cho phong cách "Công thức nấu ăn": mặt bàn gỗ, khăn caro, lá thơm, và các biểu tượng nhỏ
 * (đồng hồ hẹn giờ, cân, muỗng, lửa, dĩa, phới…). Không dùng file ảnh nào — chạy như nhau trên macOS và Windows.
 */
import { AbsoluteFill } from "remotion";
import { seeded, useLayout } from "../shared";

export const PAPER = "#fffaf0";
export const INK = "#3d2b1f";
/** Màu nhấn pha nâu đậm — chữ màu nhấn trên giấy vẫn đủ tương phản dù accent sáng. */
export const deep = (accent: string, amount = 78) => `color-mix(in srgb, ${accent} ${amount}%, #2a1200)`;
/** Màu nhấn pha giấy kem — nền nhạt cho vạch bút dạ, ô danh sách. */
export const tint = (accent: string, amount = 18) => `color-mix(in srgb, ${accent} ${amount}%, ${PAPER})`;

// ---------------------------------------------------------------------------
// Mặt bàn gỗ
// ---------------------------------------------------------------------------
const Leaf: React.FC<{ x: number; y: number; size: number; rotate: number }> = ({ x, y, size, rotate }) => (
  <svg
    width={size}
    height={size}
    viewBox="-50 -50 100 100"
    style={{ position: "absolute", left: x - size / 2, top: y - size / 2, rotate: `${rotate.toFixed(1)}deg`, overflow: "visible", filter: "drop-shadow(0 3px 3px rgba(30, 15, 0, 0.35))" }}
  >
    <path d="M 0 -46 C 30 -30 34 18 0 46 C -34 18 -30 -30 0 -46 Z" fill="#5f9440" />
    <path d="M 0 -40 L 0 44 M 0 -12 L 14 -24 M 0 6 L -15 -8 M 0 22 L 13 10" stroke="#3f6e2a" strokeWidth={3} strokeLinecap="round" fill="none" />
  </svg>
);

/** Ván gỗ dọc có vân + khăn caro màu nhấn + vài lá húng rải ở mép (phần lộ ra quanh tấm thẻ công thức). */
export const KitchenTable: React.FC<{ accent: string }> = ({ accent }) => {
  const { width, height, unit, portrait } = useLayout();
  const plank = Math.round(250 * unit);
  const check = Math.round(46 * unit);
  const cloth = `color-mix(in srgb, ${accent} 50%, transparent)`;
  const napkin = 760 * unit;
  // Lá rải ở dải bàn lộ ra: dưới thẻ (dọc) hoặc hai mép trái/phải (ngang).
  const leaves = Array.from({ length: 5 }, (_, i) => ({
    x: portrait ? width * seeded(`rc-lx${i}`, 0.45, 0.95) : i % 2 ? width * seeded(`rc-lx${i}`, 0.005, 0.03) : width * seeded(`rc-lx${i}`, 0.97, 0.995),
    y: portrait ? height * seeded(`rc-ly${i}`, 0.935, 0.985) : height * seeded(`rc-ly${i}`, 0.2, 0.9),
    size: seeded(`rc-ls${i}`, 60, 96) * unit,
    rotate: seeded(`rc-lr${i}`, -160, 160),
  }));
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#a06c43",
        backgroundImage: [
          // Khe giữa các tấm ván.
          `repeating-linear-gradient(90deg, transparent 0 ${plank - 5 * unit}px, rgba(45, 22, 6, 0.55) ${plank - 5 * unit}px ${plank}px)`,
          // Tấm ván sáng tối xen kẽ.
          `repeating-linear-gradient(90deg, rgba(255, 220, 170, 0.08) 0 ${plank}px, rgba(60, 30, 10, 0.1) ${plank}px ${plank * 2}px)`,
        ].join(", "),
      }}
    >
      {/* Vân gỗ: nhiễu kéo dài theo chiều dọc */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: 0.55, mixBlendMode: "multiply" }}>
        <filter id="rc-wood" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={`${(0.05 / unit).toFixed(4)} ${(0.004 / unit).toFixed(4)}`} numOctaves={3} seed={7} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.19  0 0 0 0 0.07  1.8 0 0 0 -0.62" />
        </filter>
        <rect width="100%" height="100%" filter="url(#rc-wood)" />
      </svg>
      {/* Khăn caro nằm chéo dưới thẻ, lộ một góc */}
      <div
        style={{
          position: "absolute",
          width: napkin,
          height: napkin,
          left: portrait ? -napkin * 0.45 : -napkin * 0.55,
          top: portrait ? height - napkin * 0.42 : height - napkin * 0.5,
          rotate: "-14deg",
          backgroundColor: "#fdf6ea",
          backgroundImage: `linear-gradient(90deg, ${cloth} 50%, transparent 50%), linear-gradient(0deg, ${cloth} 50%, transparent 50%)`,
          backgroundSize: `${check}px ${check}px`,
          boxShadow: `0 ${8 * unit}px ${24 * unit}px rgba(30, 12, 0, 0.4)`,
          borderRadius: 6 * unit,
        }}
      />
      {leaves.map((l, i) => <Leaf key={i} {...l} />)}
      {/* Ánh đèn bếp ấm từ trên + tối dần ra mép */}
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(ellipse at 45% 35%, rgba(255, 214, 150, 0.25), transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(30, 12, 0, 0.5) 100%)" }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Biểu tượng (viewBox 48×48, nét tròn). `color` là màu nét.
// ---------------------------------------------------------------------------
type IconProps = { size: number; color: string; frame?: number };

const Svg: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
    {children}
  </svg>
);

/** Đồng hồ hẹn giờ — kim quay theo frame. */
export const TimerIcon: React.FC<IconProps> = ({ size, color, frame = 0 }) => {
  const a = ((frame * 6) % 360) * (Math.PI / 180);
  return (
    <Svg size={size}>
      <circle cx={24} cy={27} r={15} stroke={color} strokeWidth={3.5} />
      <path d="M 20 6 L 28 6 M 24 6 L 24 12 M 37 13 L 40 10" stroke={color} strokeWidth={3.5} />
      <path d={`M 24 27 L ${(24 + Math.sin(a) * 10).toFixed(2)} ${(27 - Math.cos(a) * 10).toFixed(2)}`} stroke={color} strokeWidth={3.5} />
      <circle cx={24} cy={27} r={2} fill={color} />
    </Svg>
  );
};

/** Cân nhà bếp. */
export const ScaleIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <path d="M 8 14 Q 24 22 40 14" stroke={color} strokeWidth={3.5} />
    <path d="M 24 18 L 24 22" stroke={color} strokeWidth={3.5} />
    <path d="M 11 22 L 37 22 L 40 41 L 8 41 Z" stroke={color} strokeWidth={3.5} />
    <circle cx={24} cy={32} r={5} stroke={color} strokeWidth={3} />
    <path d="M 24 32 L 26.5 29.5" stroke={color} strokeWidth={2.5} />
  </Svg>
);

/** Muỗng. */
export const SpoonIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <ellipse cx={17} cy={16} rx={8} ry={11} transform="rotate(-40 17 16)" stroke={color} strokeWidth={3.5} />
    <path d="M 23 23 L 40 42" stroke={color} strokeWidth={4} />
  </Svg>
);

/** Ngọn lửa — nhiệt độ, mức lửa. */
export const FlameIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <path d="M 24 5 C 30 14 37 19 37 29 C 37 37 31 43 24 43 C 17 43 11 37 11 29 C 11 22 16 18 18 12 C 20 17 22 19 24 20 C 25 14 24 9 24 5 Z" stroke={color} strokeWidth={3.5} />
    <path d="M 24 43 C 20 43 18 39 18 36 C 18 32 22 30 24 26 C 26 30 30 32 30 36 C 30 39 28 43 24 43 Z" stroke={color} strokeWidth={3} />
  </Svg>
);

/** Dấu tích trong vòng tròn — nhãn chữ ngắn. */
export const CheckIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <circle cx={24} cy={24} r={17} stroke={color} strokeWidth={3.5} />
    <path d="M 16 24 L 22 30 L 33 18" stroke={color} strokeWidth={4} />
  </Svg>
);

/** Hai người — khẩu phần. */
export const PeopleIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <circle cx={18} cy={17} r={6} stroke={color} strokeWidth={3.5} />
    <path d="M 7 38 C 7 30 12 26 18 26 C 24 26 29 30 29 38" stroke={color} strokeWidth={3.5} />
    <circle cx={33} cy={19} r={5} stroke={color} strokeWidth={3} />
    <path d="M 32 27 C 37 27 41 31 41 37" stroke={color} strokeWidth={3} />
  </Svg>
);

/** Lá — chip dòng phụ không rõ loại. */
export const LeafIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <path d="M 10 38 C 8 20 20 8 40 8 C 40 28 28 40 10 38 Z" stroke={color} strokeWidth={3.5} />
    <path d="M 10 38 L 28 20" stroke={color} strokeWidth={3} />
  </Svg>
);

/** Rổ nguyên liệu — nhãn "Chuẩn bị". */
export const BasketIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <path d="M 15 20 L 21 8 M 33 20 L 27 8" stroke={color} strokeWidth={3.5} />
    <path d="M 6 20 L 42 20 L 37 40 L 11 40 Z" stroke={color} strokeWidth={3.5} />
    <path d="M 18 26 L 19 34 M 24 26 L 24 34 M 30 26 L 29 34" stroke={color} strokeWidth={3} />
  </Svg>
);

/** Dĩa, muỗng gỗ, phới lồng — hàng biểu tượng trên đầu thẻ công thức. */
export const ForkIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <path d="M 16 5 L 16 16 M 24 5 L 24 16 M 32 5 L 32 16 M 16 16 C 16 22 32 22 32 16 M 24 21 L 24 44" stroke={color} strokeWidth={3.5} />
  </Svg>
);

export const WhiskIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg size={size}>
    <path d="M 24 30 C 12 22 14 4 24 4 C 34 4 36 22 24 30 Z M 24 30 C 19 22 19 8 24 4 C 29 8 29 22 24 30 Z M 24 30 L 24 44" stroke={color} strokeWidth={3} />
  </Svg>
);

/** Chọn biểu tượng theo nội dung con số: "15 phút" → đồng hồ, "200g" → cân, "2 muỗng" → muỗng, "180 độ" → lửa. */
export const iconFor = (text: string, badge: boolean): React.FC<IconProps> => {
  const t = text.normalize("NFC").toLowerCase();
  if (/phút|giờ|giây|tiếng|min|\d\s*(h|s)\b|\b(?:hours?|hrs?|sec(?:ond)?s?)\b/.test(t)) return TimerIcon;
  if (/độ|°|lửa|nhiệt|nóng|\b(?:degrees?|heat|fire|flame|hot|oven)\b/.test(t)) return FlameIcon;
  if (/\d\s*(g|kg|gr|gram|gam|lạng|cân|ký)\b|\d(g|kg)|\d\s*(?:grams|oz|ounces?|lbs?|pounds?)\b/.test(t)) return ScaleIcon;
  if (/muỗng|thìa|ml|lít|\d\s*l\b|chén|bát|ly|cốc|cup|tbsp|tsp|spoon|\b(?:liters?|litres?|bowls?|glass(?:es)?)\b/.test(t)) return SpoonIcon;
  if (/người|phần|suất|\b(?:serves|servings?|people|persons?|portions?)\b/.test(t)) return PeopleIcon;
  return badge ? CheckIcon : SpoonIcon;
};

/** Biểu tượng cho chip dòng phụ ở thẻ tiêu đề. */
export const chipIconFor = (text: string): React.FC<IconProps> => {
  const t = text.normalize("NFC").toLowerCase();
  if (/người|phần|suất|\b(?:serves|servings?|people|persons?|portions?)\b/.test(t)) return PeopleIcon;
  if (/phút|giờ|tiếng|\b(?:min(?:ute)?s?|hours?|hrs?)\b/.test(t)) return TimerIcon;
  if (/dễ|khó|trung bình|độ khó|lửa|cay|\b(?:easy|hard|medium|difficult\w*|spicy)\b/.test(t)) return FlameIcon;
  return LeafIcon;
};
