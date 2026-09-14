/**
 * Tờ giấy sổ tay: nền kem, dòng kẻ xanh, lề đỏ, lỗ đục và vài hình vẽ nguệch
 * ngoạc bằng bút chì. Hoàn toàn tĩnh — mỗi trang một seed nên các trang hơi khác nhau.
 */
import { AbsoluteFill } from "remotion";
import { seeded } from "../shared";
import { doodlePath, MARGIN_RED, PAPER, PENCIL, RULE } from "./sketch";

export type SheetLayout = {
  width: number;
  height: number;
  unit: number;
  marginX: number;
  stacked: boolean;
  safe: { top: number; bottom: number; side: number };
};

export const PaperSheet: React.FC<{ seed: string; layout: SheetLayout }> = ({ seed, layout }) => {
  const { width, height, unit, marginX, stacked, safe } = layout;
  const gap = Math.round(64 * unit);
  const ruleWidth = Math.max(1.5, 2 * unit);
  const holeCount = stacked ? 5 : 3;
  const holeSize = 30 * unit;

  // Hình nguệch ngoạc chỉ nằm ở dải trên/dưới ngoài vùng an toàn — không đè nội dung.
  const bands = [
    { top: 0, bottom: safe.top },
    { top: height - safe.bottom, bottom: height },
  ].filter((b) => b.bottom - b.top >= 50 * unit);
  const doodles = bands.length
    ? Array.from({ length: 5 }, (_, k) => {
        const band = bands[Math.floor(seeded(`${seed}-band-${k}`, 0, bands.length * 0.999))];
        const bandHeight = band.bottom - band.top;
        const size = Math.min(bandHeight * 0.55, 74 * unit);
        // Chia chiều ngang thành 5 ô để các hình không chồng nhau.
        const slotWidth = (width - marginX - 80 * unit) / 5;
        return {
          key: k,
          size,
          x: marginX + 40 * unit + slotWidth * k + seeded(`${seed}-x-${k}`, 0, Math.max(0, slotWidth - size)),
          y: band.top + seeded(`${seed}-y-${k}`, bandHeight * 0.2, Math.max(bandHeight * 0.2, bandHeight * 0.8 - size)),
          rotate: seeded(`${seed}-r-${k}`, -25, 25),
          kind: Math.floor(seeded(`${seed}-k-${k}`, 0, 4.999)),
        };
      })
    : [];

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, boxShadow: `inset 0 0 ${140 * unit}px rgba(120, 95, 50, 0.13)` }}>
      {/* Dòng kẻ ngang */}
      <AbsoluteFill
        style={{
          top: Math.round(safe.top * 0.5),
          backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent ${gap - ruleWidth}px, ${RULE} ${gap - ruleWidth}px, ${RULE} ${gap}px)`,
        }}
      />
      {/* Lề đỏ: hai nét mảnh */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: marginX, width: Math.max(1.5, 2.5 * unit), backgroundColor: MARGIN_RED }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: marginX + 7 * unit, width: Math.max(1, 1.2 * unit), backgroundColor: MARGIN_RED, opacity: 0.6 }} />
      {/* Lỗ đục sổ */}
      {Array.from({ length: holeCount }, (_, k) => (
        <div
          key={`hole-${k}`}
          style={{
            position: "absolute",
            left: marginX * 0.45 - holeSize / 2,
            top: (height * (k + 0.5)) / holeCount - holeSize / 2,
            width: holeSize,
            height: holeSize,
            borderRadius: "50%",
            background: "radial-gradient(circle at 40% 35%, #cfc8b8 0%, #e6e0d2 70%)",
            boxShadow: `inset ${2 * unit}px ${3 * unit}px ${5 * unit}px rgba(0,0,0,0.22)`,
          }}
        />
      ))}
      {/* Hình vẽ bút chì */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {doodles.map((d) => (
          <g
            key={`doodle-${d.key}`}
            transform={`translate(${d.x.toFixed(1)} ${d.y.toFixed(1)}) rotate(${d.rotate.toFixed(1)} ${(d.size / 2).toFixed(1)} ${(d.size / 2).toFixed(1)}) scale(${(d.size / 100).toFixed(3)})`}
          >
            <path
              d={doodlePath(d.kind, `${seed}-d${d.key}`)}
              fill="none"
              stroke={PENCIL}
              strokeWidth={(3.2 * 100) / Math.max(1, d.size) * unit}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.42}
            />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
