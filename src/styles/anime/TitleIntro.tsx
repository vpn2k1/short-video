import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { seeded, useLayout } from "../shared";
import { clamp, fitHeavy, glyphs, HEAVY, OUT, outlined, POP, SKY, SUN, upperVi, WHITE, type Palette } from "./anime";
import { Sparkle } from "./Overlays";
import { Petals, SkyBackdrop } from "./Sky";

/** Số frame nhát chém rút màn hình tiêu đề ở cuối. */
const EXIT_FRAMES = 9;

/**
 * Thẻ tiêu đề kiểu opening anime: bầu trời + tia nắng, chớp trắng mở màn, tiêu đề in hoa đập xuống TỪNG CHỮ
 * (mỗi chữ scale 2.6 → 1, quá đà), rung nhẹ khi chữ cuối chạm; dòng phụ nằm trên dải ruy băng màu nhấn lao vào
 * từ trái, cánh hoa bay, lấp lánh. 9 frame cuối một nhát chém chéo rút cả thẻ, lộ cảnh đầu.
 */
export const AnimeTitle: React.FC<{ title: string; subtitle: string; palette: Palette }> = ({
  title,
  subtitle,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { unit, width: W, height: H, safe } = useLayout();
  const wide = W / H > 1.2;
  const square = !wide && H / W < 1.45;

  const upper = upperVi(title.trim() || " ");
  const words = upper.split(/\s+/).filter(Boolean);
  const count = Math.max(1, glyphs(upper.replace(/\s+/g, "")).length);
  // Đập hết chữ trong ~22 frame, tối đa 2 frame mỗi chữ.
  const step = Math.min(2, 22 / count);
  const letterStart = 6;
  const landed = letterStart + Math.ceil(count * step) + 5;

  const maxWidth = wide ? W * 0.72 : W - safe.side * 2 + 20 * unit;
  const base = (wide ? 130 : square ? 120 : 136) * unit;
  const titleSize = Math.max(56 * unit, fitHeavy(upper, base, maxWidth, 3, 0.66));

  // Rung khi chữ cuối chạm.
  const shakeT = frame - landed;
  const amp = shakeT >= 0 && shakeT < 10 ? 12 * unit * (1 - shakeT / 10) : 0;
  const sx = amp * seeded(`anime-title-sx-${shakeT}`, -1, 1);
  const sy = amp * seeded(`anime-title-sy-${shakeT}`, -1, 1);

  const flash = interpolate(frame, [0, 6], [0.9, 0], clamp);
  const ribbonAt = Math.min(landed + 2, TITLE_FRAMES - 26);
  const ribbon = interpolate(frame, [ribbonAt, ribbonAt + 9], [-110, 0], { ...clamp, easing: OUT });
  const subIn = interpolate(frame, [ribbonAt + 4, ribbonAt + 11], [0, 1], clamp);
  const subSize = Math.min((wide ? 44 : 46) * unit, fitHeavy(subtitle.normalize("NFC"), 46 * unit, maxWidth - 120 * unit, 2, 0.6));

  // Nhát chém rút: phần còn lại của thẻ là bên PHẢI mép chém.
  const exitP = interpolate(frame, [TITLE_FRAMES - EXIT_FRAMES, TITLE_FRAMES], [0, 1], { ...clamp, easing: OUT });
  const T = H * 0.32;
  const e = -T + exitP * (W + 2 * T);
  const clip = exitP > 0 ? `polygon(${(e + T).toFixed(1)}px 0px, ${W + 10}px 0px, ${W + 10}px ${H}px, ${(e - T).toFixed(1)}px ${H}px)` : undefined;

  let order = 0;
  const sparkles = [
    { x: 0.14, y: 0.3, r: 30, d: 0 },
    { x: 0.86, y: 0.24, r: 24, d: 3 },
    { x: 0.8, y: 0.66, r: 34, d: 6 },
    { x: 0.2, y: 0.72, r: 20, d: 9 },
  ];

  return (
    <AbsoluteFill style={{ clipPath: clip }}>
      <SkyBackdrop palette={palette} id="title" seed={99} />
      <Petals count={16} seed="anime-title-petal" />
      <AbsoluteFill style={{ translate: `${sx}px ${sy}px`, alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: maxWidth, display: "flex", flexDirection: "column", alignItems: "center", gap: 34 * unit }}>
          <div
            style={{
              fontFamily: HEAVY,
              fontWeight: 900,
              fontSize: titleSize,
              lineHeight: 1.25,
              textAlign: "center",
              textWrap: "balance",
              rotate: "-4deg",
            }}
          >
            {words.map((word, wi) => (
              <span key={wi}>
                <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                  {glyphs(word).map((ch, ci) => {
                    const at = letterStart + order * step;
                    order += 1;
                    const t = frame - at;
                    return (
                      <span
                        key={ci}
                        style={{
                          display: "inline-block",
                          opacity: interpolate(t, [0, 1.5], [0, 1], clamp),
                          scale: String(interpolate(t, [0, 5], [2.6, 1], { ...clamp, easing: POP })),
                          ...outlined(titleSize, palette.main, WHITE, 0.16),
                        }}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </span>
                {wi < words.length - 1 ? " " : null}
              </span>
            ))}
          </div>
          {subtitle.trim() ? (
            <div style={{ position: "relative", rotate: "-4deg", maxWidth: maxWidth + 40 * unit }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  translate: `${12 * unit}px ${12 * unit}px`,
                  backgroundColor: SKY,
                  transform: `translateX(${ribbon}%) skewX(-16deg)`,
                }}
              />
              <div
                style={{
                  position: "relative",
                  backgroundColor: palette.main,
                  border: `${5 * unit}px solid ${WHITE}`,
                  transform: `translateX(${ribbon}%) skewX(-16deg)`,
                  padding: `${12 * unit}px ${48 * unit}px ${14 * unit}px`,
                }}
              >
                <div
                  style={{
                    transform: "skewX(16deg)",
                    opacity: subIn,
                    fontFamily: HEAVY,
                    fontWeight: 800,
                    fontSize: subSize,
                    lineHeight: 1.3,
                    textAlign: "center",
                    textWrap: "balance",
                    color: WHITE,
                    textShadow: `0 ${3 * unit}px 0 ${palette.deep}`,
                  }}
                >
                  {subtitle.normalize("NFC").trim()}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      {sparkles.map((s, i) => {
        const t = frame - landed - s.d;
        const pop = interpolate(t, [0, 6], [0, 1], { ...clamp, easing: POP });
        return (
          <Sparkle
            key={i}
            x={W * s.x}
            y={H * s.y}
            r={s.r * unit * pop * (0.8 + 0.2 * Math.sin((frame + i * 5) / 3))}
            opacity={t < 0 ? 0 : 1}
            color={i % 2 ? SUN : WHITE}
            rotate={frame * 2}
          />
        );
      })}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
      {exitP > 0 && exitP < 1 ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <line x1={e + T} y1={0} x2={e - T} y2={H} stroke="#fff" strokeWidth={60 * unit} strokeOpacity={0.3} />
          <line x1={e + T} y1={0} x2={e - T} y2={H} stroke="#fff" strokeWidth={16 * unit} />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
