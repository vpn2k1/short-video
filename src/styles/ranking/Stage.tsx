import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Grain, seeded } from "../shared";
import { currentAt, type RankLayout } from "./layout";
import { GOLD, ramp, STAGE, STAGE_2, withAlpha } from "./theme";

/**
 * Sân khấu tối: đèn rọi từ trên nhuộm màu `accent` (chuyển vàng ở cảnh #1), hai luồng sáng
 * đung đưa, sàn hắt sáng, lưới chấm mờ, vignette. Chỉ gradient — không blur động.
 */
export const Stage: React.FC<{ L: RankLayout; accent: string }> = ({ L, accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = L;
  const current = currentAt(L, frame);

  // Độ "vàng" của sân khấu: vào khi cảnh #1 lên, ra khi cảnh sau nó (nếu có) lên.
  let gold = 0;
  L.items.forEach((item, i) => {
    if (item.rank !== 1) return;
    const inP = ramp(frame, L.enters[i] - 2, 14);
    const next = L.enters[i + 1];
    const outP = next === undefined ? 0 : ramp(frame, next - 4, 10);
    gold = Math.max(gold, inP * (1 - outP));
  });
  const onFirst = current >= 0 && L.items[current]?.rank === 1;
  const beamColor = onFirst ? GOLD : accent;
  const dot = Math.round(34 * unit);

  return (
    <AbsoluteFill style={{ backgroundColor: STAGE, overflow: "hidden" }}>
      <AbsoluteFill
        style={{ backgroundImage: `linear-gradient(180deg, ${STAGE_2} 0%, ${STAGE} 55%, #040509 100%)` }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(75% 50% at 50% -6%, ${withAlpha(accent, 0.5)} 0%, ${withAlpha(accent, 0.12)} 45%, transparent 75%)`,
          opacity: 1 - gold * 0.85,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(75% 50% at 50% -6%, ${withAlpha(GOLD, 0.55)} 0%, ${withAlpha(GOLD, 0.14)} 45%, transparent 75%)`,
          opacity: gold,
        }}
      />
      {/* Luồng đèn rọi */}
      {[-1, 1].map((side) => {
        const sway = Math.sin(frame / 38 + side) * 5;
        return (
          <div
            key={`beam-${side}`}
            style={{
              position: "absolute",
              top: -height * 0.05,
              left: width / 2 + side * width * 0.16 - width * 0.14,
              width: width * 0.28,
              height: height * 1.2,
              transformOrigin: "50% 0%",
              transform: `rotate(${side * -18 + sway}deg)`,
              backgroundImage: `linear-gradient(180deg, ${withAlpha(beamColor, 0.22)} 0%, ${withAlpha(beamColor, 0.05)} 45%, transparent 80%)`,
              clipPath: "polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)",
            }}
          />
        );
      })}
      {/* Sàn hắt sáng */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(80% 26% at 50% 104%, ${withAlpha(onFirst ? GOLD : accent, 0.3)} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.2px, transparent 1.6px)",
          backgroundSize: `${dot}px ${dot}px`,
          backgroundPosition: `${(frame * 0.3 * unit) % dot}px 0px`,
        }}
      />
      <AbsoluteFill
        style={{ backgroundImage: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)" }}
      />
      <Grain opacity={0.06} animated={false} />
      <WhipStreaks L={L} accent={accent} />
    </AbsoluteFill>
  );
};

/** Vệt gió quét ngang quanh mỗi điểm đổi cảnh (và lúc phần mở đầu văng đi). */
const WhipStreaks: React.FC<{ L: RankLayout; accent: string }> = ({ L, accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = L;
  const cuts = L.enters.filter((e, i) => i > 0 || e > 0);
  const cut = cuts.find((e) => frame >= e - 7 && frame <= e + 8);
  if (cut === undefined) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 9 }).map((_, i) => {
        const key = `rk-streak-${cut}-${i}`;
        const delay = seeded(`${key}-d`, -6, 2);
        const len = seeded(`${key}-l`, 260, 820) * unit;
        const p = ramp(frame, cut + delay, 10);
        if (p <= 0 || p >= 1) return null;
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              top: seeded(`${key}-y`, 0.12, 0.88) * height,
              left: width + len - p * (width + len * 2.4),
              width: len,
              height: seeded(`${key}-t`, 3, 10) * unit,
              borderRadius: 99,
              backgroundImage: `linear-gradient(90deg, ${i % 3 === 0 ? accent : "#ffffff"} 0%, rgba(255,255,255,0) 100%)`,
              opacity: 0.7 * Math.sin(p * Math.PI),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
