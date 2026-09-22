/**
 * HUD trên cùng: 3 tim, thanh XP chia nấc đầy dần theo tiến độ video, bộ đếm xu (+10 mỗi câu, +100 mỗi câu nhấn —
 * đồng xu nảy lên mỗi lần cộng).
 */
import { interpolate } from "remotion";
import { Coin, Heart, PixelBox } from "./parts";
import { BLOCK, clamp, GOLD, HUD_BG, INK, onTwos, WHITE, type Rect } from "./pixel";

const SEGMENTS = 12;

export const Hud: React.FC<{
  rect: Rect;
  P: number;
  unit: number;
  progress: number;
  coins: number;
  sinceCoin: number;
  enter: number;
}> = ({ rect, P, unit, progress, coins, sinceCoin, enter }) => {
  const size = 30 * unit;
  const bump = interpolate(onTwos(sinceCoin), [0, 2, 6], [0, -P * 2, 0], clamp);
  const fill = progress * SEGMENTS;
  const innerH = rect.h - P * 4;
  const barH = Math.round(innerH * 0.52 / P) * P;
  // HUD rơi xuống từ trên theo nấc khi vào game.
  const drop = Math.round(((1 - enter) * -(rect.h + rect.y)) / (P * 2)) * P * 2;
  return (
    <PixelBox
      rect={rect}
      P={P}
      rings={[INK, WHITE]}
      fill={HUD_BG}
      style={{ translate: `0 ${drop}px` }}
      innerStyle={{ display: "flex", alignItems: "center", padding: `0 ${P * 3}px`, gap: P * 3 }}
    >
      <div style={{ display: "flex", gap: P }}>
        {[0, 1, 2].map((i) => (
          <Heart key={i} size={P * 7} full />
        ))}
      </div>
      <div style={{ fontFamily: BLOCK, fontSize: size, lineHeight: 1, color: GOLD }}>XP</div>
      <div style={{ flex: 1, display: "flex", gap: Math.max(2, P / 2), height: barH, padding: Math.max(2, P / 2), backgroundColor: INK }}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const f = Math.max(0, Math.min(1, fill - i));
          return (
            <div key={i} style={{ flex: 1, backgroundColor: "#2a3060", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(f * 4) * 25}%`, backgroundColor: "#4ade6b" }} />
              <div style={{ position: "absolute", left: 0, top: 0, height: Math.max(2, P / 2), width: `${Math.round(f * 4) * 25}%`, backgroundColor: "#b8ffc6" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: P }}>
        <div style={{ translate: `0 ${bump}px` }}>
          <Coin size={P * 7} />
        </div>
        <div style={{ fontFamily: BLOCK, fontSize: size, lineHeight: 1, color: WHITE, fontVariantNumeric: "tabular-nums" }}>
          ×{String(Math.min(99999, coins)).padStart(4, "0")}
        </div>
      </div>
    </PixelBox>
  );
};
