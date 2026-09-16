import { useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { FONTS, fitFontSize, useLayout } from "../shared";
import { CYAN, EASE_IN, INK, ramp, withAlpha } from "./theme";

/**
 * Title card: dòng mono (handle) gõ từng ký tự, tiêu đề gradient lớn, vạch sáng
 * nở ra, phụ đề mờ dần vào. Dùng trong <Sequence durationInFrames={TITLE_FRAMES}>.
 */
export const TitleIntro: React.FC<{ title: string; subtitle: string; handle: string; accent: string }> = ({
  title,
  subtitle,
  handle,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit, portrait } = useLayout();
  const contentW = width - safe.side * 2;
  const overline = handle ? `> ${handle}` : "> intro";
  const chars = [...overline];
  const typed = Math.floor(ramp(frame, 3, chars.length * 1.4, (x) => x) * chars.length);
  const caretOn = Math.floor(frame / 8) % 2 === 0;
  const titleIn = ramp(frame, 10, 18);
  const lineIn = ramp(frame, 18, 22);
  const subIn = ramp(frame, 26, 14);
  const out = ramp(frame, TITLE_FRAMES - 16, 14, EASE_IN);
  const titleSize = fitFontSize(title, (portrait ? 124 : 116) * unit, 0.5);

  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top,
        width: contentW,
        height: height - safe.top - safe.bottom,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        opacity: 1 - out,
        transform: `translateY(${-out * 30 * unit}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 32 * unit,
          letterSpacing: 2 * unit,
          color: withAlpha(CYAN, 0.9),
          marginBottom: 30 * unit,
          whiteSpace: "pre",
        }}
      >
        {chars.slice(0, typed).join("")}
        <span style={{ opacity: caretOn ? 1 : 0, color: accent }}>▍</span>
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: titleSize,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: -0.025 * titleSize,
          paddingTop: titleSize * 0.1,
          maxWidth: contentW,
          color: "transparent",
          backgroundImage: `linear-gradient(100deg, #ffffff 0%, #d6e4ff 45%, ${CYAN} 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 34 * unit}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 34 * unit,
          marginBottom: 30 * unit,
          height: Math.max(2, 3 * unit),
          width: lineIn * Math.min(contentW * 0.7, 520 * unit),
          borderRadius: 4 * unit,
          backgroundImage: `linear-gradient(90deg, transparent, ${accent} 20%, ${CYAN} 80%, transparent)`,
          boxShadow: `0 0 ${16 * unit}px ${withAlpha(CYAN, 0.7)}`,
        }}
      />
      {subtitle ? (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 44 * unit,
            fontWeight: 500,
            lineHeight: 1.3,
            color: INK,
            opacity: 0.75 * subIn,
            maxWidth: contentW,
            transform: `translateY(${(1 - subIn) * 16 * unit}px)`,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
