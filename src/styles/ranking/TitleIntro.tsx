import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { seeded } from "../shared";
import { RankGlyph } from "./Card";
import { Crown, Sparkles } from "./Gold";
import type { RankLayout } from "./layout";
import {
  backOut,
  EASE_IN,
  EASE_OUT,
  fitText,
  FONT,
  GOLD,
  GOLD_GRADIENT,
  INK,
  ramp,
  STAGE,
  textOn,
  WHITE,
  withAlpha,
} from "./theme";

/**
 * Mở đầu: chữ "TOP" rơi xuống, số N cuộn như máy đánh bạc 1 → N rồi đập dừng, hàng ô hạng
 * N…1 xếp chồng vào (ô #1 vàng có vương miện), tiêu đề / phụ đề / handle lần lượt hiện.
 * Cuối cùng cả cụm văng sang trái đúng lúc thẻ cảnh đầu văng vào.
 * Đặt trong <Sequence durationInFrames={TITLE_FRAMES}>.
 */
export const TitleIntro: React.FC<{ L: RankLayout; title: string; subtitle: string; handle: string; accent: string }> = ({
  L,
  title,
  subtitle,
  handle,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { unit: u, width, height, strip, safe } = L;
  const n = Math.max(1, L.count);
  const scale = strip ? 1 : 0.8;
  const s = u * scale;

  // Văng ra frame 59–68; thẻ cảnh đầu bắt đầu văng vào từ frame 65 (introEnd - 3).
  const out = ramp(frame, TITLE_FRAMES - 11, 9, EASE_IN);
  const exitX = -out * width * 1.15;

  const topP = ramp(frame, 0, 9, (t) => t);
  const numFont = (strip ? 400 : 330) * u;
  const rollP = ramp(frame, 6, 22, EASE_OUT);
  const land = ramp(frame, 27, 10, (t) => t);
  const landScale = 1 + 0.12 * Math.sin(land * Math.PI) * (1 - land);
  const lineH = numFont * 1.0;

  const tile = 92 * s;
  const tileGap = 14 * s;
  const tiles = Array.from({ length: n }, (_, k) => n - k); // N … 1

  const contentW = width - Math.max(safe.side, 60 * u) * 2;
  const head = fitText(title, contentW, 3, 78 * s, 46 * s, 900);
  const sub = subtitle.trim() && subtitle.trim() !== title.trim() ? fitText(subtitle, contentW, 2, 42 * s, 30 * s, 600) : null;
  const handleP = ramp(frame, 44, 10);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: withAlpha(STAGE, 0.55 * (1 - out)) }} />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: strip ? height * 0.08 : 0,
          transform: `translateX(${exitX}px) skewX(${out * 10}deg)`,
          opacity: 1 - out * 0.4,
        }}
      >
        {/* TOP + số cuộn */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 * s, position: "relative" }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 150 * s,
              lineHeight: 1,
              color: WHITE,
              opacity: topP,
              transform: `translateY(${(1 - backOut(topP, 1.4)) * -120 * u}px)`,
              filter: `drop-shadow(0 ${10 * u}px 0 ${accent})`,
            }}
          >
            TOP
          </div>
          <div
            style={{
              position: "relative",
              height: lineH,
              width: numFont * (String(n).length * 0.62 + 0.08),
              overflow: "hidden",
              transform: `scale(${landScale})`,
            }}
          >
            <div style={{ position: "absolute", left: 0, right: 0, top: -rollP * (n - 1) * lineH }}>
              {Array.from({ length: n }).map((_, i) => (
                <div
                  key={`roll-${i}`}
                  style={{
                    height: lineH,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT,
                    fontWeight: 900,
                    fontSize: numFont,
                    lineHeight: 1,
                    backgroundImage: GOLD_GRADIENT,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: "absolute", inset: -60 * u }}>
            <Sparkles seed="rk-title" count={10} width={numFont * 2.2} height={numFont + 120 * u} unit={u} from={28} />
          </div>
        </div>

        {/* Ô hạng N … 1 */}
        <div style={{ display: "flex", gap: tileGap, marginTop: 26 * s, marginBottom: 40 * s }}>
          {tiles.map((rank, k) => {
            const p = ramp(frame, 12 + k * 4, 9, (t) => t);
            const gold = rank === 1;
            const tilt = seeded(`rk-tile-${k}`, -10, 10) * (1 - p);
            return (
              <div
                key={`tile-${rank}`}
                style={{
                  position: "relative",
                  width: tile,
                  height: tile,
                  borderRadius: tile * 0.26,
                  backgroundImage: gold ? GOLD_GRADIENT : `linear-gradient(160deg, ${accent} 0%, ${withAlpha(accent, 0.78)} 100%)`,
                  border: `${3 * u}px solid ${gold ? "#FFF1B8" : "rgba(255,255,255,0.8)"}`,
                  boxShadow: `0 ${10 * u}px ${20 * u}px rgba(0,0,0,0.45)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: Math.min(1, p * 2.5),
                  transform: `translateY(${(1 - backOut(p, 1.8)) * -160 * u}px) rotate(${tilt}deg)`,
                }}
              >
                {gold ? (
                  <div style={{ position: "absolute", left: "50%", bottom: "84%", transform: "translateX(-50%) rotate(-10deg)" }}>
                    <Crown width={tile * 0.62} id="rk-title-crown" />
                  </div>
                ) : null}
                <RankGlyph rank={rank} size={tile * 0.52} gold={false} shadow="none" style={{ color: gold ? INK : textOn(accent) }} />
              </div>
            );
          })}
        </div>

        {/* Tiêu đề */}
        {head.lines.map((line, i) => {
          const p = ramp(frame, 24 + i * 4, 11);
          return (
            <div
              key={`h-${i}`}
              style={{
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: head.size,
                lineHeight: 1.18,
                color: WHITE,
                whiteSpace: "nowrap",
                textAlign: "center",
                opacity: p,
                transform: `translateY(${(1 - p) * 40 * u}px)`,
                textShadow: `0 ${6 * u}px ${18 * u}px rgba(0,0,0,0.6)`,
              }}
            >
              {line}
            </div>
          );
        })}
        {sub
          ? sub.lines.map((line, i) => {
              const p = ramp(frame, 36 + i * 3, 10);
              return (
                <div
                  key={`s-${i}`}
                  style={{
                    marginTop: i === 0 ? 14 * s : 0,
                    fontFamily: FONT,
                    fontWeight: 600,
                    fontSize: sub.size,
                    lineHeight: 1.3,
                    color: GOLD,
                    whiteSpace: "nowrap",
                    opacity: p,
                    transform: `translateY(${(1 - p) * 24 * u}px)`,
                  }}
                >
                  {line}
                </div>
              );
            })
          : null}
        {handle.trim() ? (
          <div
            style={{
              marginTop: 30 * s,
              padding: `${8 * s}px ${24 * s}px`,
              borderRadius: 99,
              border: `${2 * u}px solid rgba(255,255,255,0.35)`,
              backgroundColor: "rgba(255,255,255,0.08)",
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 32 * s,
              lineHeight: 1.3,
              color: WHITE,
              whiteSpace: "nowrap",
              opacity: handleP,
              transform: `scale(${0.8 + 0.2 * handleP})`,
            }}
          >
            {handle.trim()}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
