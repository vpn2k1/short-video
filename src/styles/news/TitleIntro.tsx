import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { seeded } from "../shared";
import { CAPTION_LH, HEADLINE_LH, UPPER_LH, type NewsLayout } from "./layout";
import { EASE_IN, EASE_INOUT, EASE_OUT, fitText, FONT, INK, NAVY, NAVY_DEEP, RED, ramp, WHITE, withAlpha } from "./theme";

const wipe = (p: number) => `inset(-2px ${((1 - p) * 100).toFixed(3)}% -2px 0)`;

/**
 * Mở đầu bản tin: khối đỏ "TIN NÓNG" đập vào kèm vệt gió, thanh tiêu đề dựng dần
 * từng dòng, dải trắng phụ đề; cuối cùng cả cụm trượt xuống nhường chỗ dải dưới.
 * Đặt trong <Sequence durationInFrames={TITLE_FRAMES}>.
 */
export const TitleIntro: React.FC<{ L: NewsLayout; title: string; subtitle: string; accent: string }> = ({
  L,
  title,
  subtitle,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { unit, width, height, stacked, contentW, left } = L;

  const out = ramp(frame, TITLE_FRAMES - 12, 12, EASE_IN);
  const slam = ramp(frame, 0, 8, EASE_OUT);
  const shake = Math.sin(frame * 2.9) * 7 * unit * (1 - ramp(frame, 7, 9));
  const barP = ramp(frame, 10, 12, EASE_INOUT);
  const subP = ramp(frame, 28, 10, EASE_INOUT);

  const tagFont = Math.round((stacked ? 76 : 62) * unit);
  const padX = 30 * unit;
  const padY = 18 * unit;
  const head = fitText(title || L.vt("TIN NÓNG"), contentW - padX * 2, 3, (stacked ? 80 : 68) * unit, 42 * unit, 800);
  const sub =
    subtitle.trim() && subtitle.trim() !== title.trim()
      ? fitText(subtitle, contentW - padX * 2, 2, (stacked ? 42 : 36) * unit, 28 * unit, 600)
      : null;
  const top = height * (stacked ? 0.34 : 0.26);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: withAlpha(NAVY_DEEP, 0.5 * (1 - out)) }} />

      {/* Vệt gió quét ngang qua khối TIN NÓNG */}
      {Array.from({ length: 7 }).map((_, i) => {
        const delay = seeded(`news-swoosh-d-${i}`, 0, 7);
        const len = seeded(`news-swoosh-l-${i}`, 220, 640) * unit;
        const thick = seeded(`news-swoosh-t-${i}`, 3, 9) * unit;
        const y = top + seeded(`news-swoosh-y-${i}`, -50, tagFont * 1.6 + 50) * unit;
        const p = ramp(frame, delay, 13, EASE_OUT);
        if (p <= 0 || p >= 1) return null;
        return (
          <div
            key={`sw-${i}`}
            style={{
              position: "absolute",
              top: y,
              left: width + len - p * (width + len * 2.2),
              width: len,
              height: thick,
              backgroundImage: `linear-gradient(90deg, ${i % 2 === 0 ? WHITE : RED} 0%, rgba(255,255,255,0) 100%)`,
              opacity: 0.85 * (1 - p),
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left,
          top,
          width: contentW,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          opacity: 1 - out,
          transform: `translateY(${out * height * 0.2}px)`,
          filter: `drop-shadow(0 ${10 * unit}px ${18 * unit}px rgba(0,0,0,0.5))`,
        }}
      >
        <div
          style={{
            padding: `${6 * unit}px ${30 * unit}px`,
            backgroundColor: RED,
            backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: tagFont,
            lineHeight: UPPER_LH,
            color: WHITE,
            whiteSpace: "nowrap",
            opacity: ramp(frame, 0, 3),
            transform: `translateX(${(1 - slam) * -140 * unit + shake}px) scale(${1.7 - 0.7 * slam})`,
            transformOrigin: "0% 100%",
          }}
        >
          {L.vt("TIN NÓNG")}
        </div>

        <div
          style={{
            width: contentW,
            boxSizing: "border-box",
            padding: `${padY}px ${padX}px`,
            backgroundColor: withAlpha(NAVY, 0.97),
            backgroundImage: `linear-gradient(90deg, ${withAlpha(accent, 0.35)} 0%, rgba(11,27,63,0) 60%)`,
            borderTop: `${Math.max(3, 6 * unit)}px solid ${accent}`,
            clipPath: wipe(barP),
          }}
        >
          {head.lines.map((line, i) => {
            const lp = ramp(frame, 16 + i * 5, 10, EASE_OUT);
            return (
              <div
                key={`t-${i}`}
                style={{
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: head.size,
                  lineHeight: HEADLINE_LH,
                  color: WHITE,
                  whiteSpace: "nowrap",
                  opacity: lp,
                  transform: `translateX(${(1 - lp) * -40 * unit}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>

        {sub ? (
          <div
            style={{
              width: contentW,
              boxSizing: "border-box",
              padding: `${12 * unit}px ${padX}px`,
              backgroundColor: WHITE,
              borderLeft: `${Math.max(3, 8 * unit)}px solid ${RED}`,
              clipPath: wipe(subP),
            }}
          >
            {sub.lines.map((line, i) => (
              <div
                key={`s-${i}`}
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: sub.size,
                  lineHeight: CAPTION_LH,
                  color: INK,
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
