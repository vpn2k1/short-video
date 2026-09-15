import { interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { FONTS, fitFontSize, useLayout } from "../shared";
import { EASE_BACK, EASE_IN, INK, paletteFrom, ramp, upper, YELLOW } from "./theme";

/**
 * Title card game show: bong bóng "?" vàng khổng lồ nhịp đập, tiêu đề in hoa trắng viền bóng
 * bật vào, subtitle trong viên thuốc trắng, handle nhỏ phía trên. Phóng to + mờ ra ở cuối.
 * Dùng trong <Sequence durationInFrames={TITLE_FRAMES}>.
 */
export const TitleIntro: React.FC<{ title: string; subtitle: string; handle: string; accent: string }> = ({
  title,
  subtitle,
  handle,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit, portrait } = useLayout();
  const pal = paletteFrom(accent);
  const contentW = width - safe.side * 2;
  const bubbleIn = ramp(frame, 0, 14, EASE_BACK);
  const titleIn = ramp(frame, 8, 14, EASE_BACK);
  const subIn = ramp(frame, 18, 12, EASE_BACK);
  const handleIn = ramp(frame, 24, 10);
  const out = ramp(frame, TITLE_FRAMES - 12, 12, EASE_IN);
  const beat = 1 + Math.abs(Math.sin(frame / 5)) * 0.08;
  const bubble = (portrait ? 300 : 230) * unit;
  const titleText = upper(title);
  const titleSize = Math.min(fitFontSize(titleText, (portrait ? 118 : 104) * unit, 0.5), contentW / 7);

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
        transform: `scale(${1 + out * 0.15})`,
      }}
    >
      {handle ? (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontWeight: 700,
            fontSize: 32 * unit,
            color: "rgba(255,255,255,0.85)",
            marginBottom: 24 * unit,
            opacity: handleIn,
          }}
        >
          {handle}
        </div>
      ) : null}
      <div
        style={{
          width: bubble,
          height: bubble,
          borderRadius: "50%",
          backgroundColor: YELLOW,
          border: `${10 * unit}px solid #ffffff`,
          boxShadow: `0 ${14 * unit}px 0 #c99a06, 0 ${40 * unit}px ${60 * unit}px -${20 * unit}px rgba(20,8,40,0.6)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${interpolate(bubbleIn, [0, 1], [0, 1]) * beat}) rotate(${Math.sin(frame / 8) * 8}deg)`,
          marginBottom: 40 * unit,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontWeight: 900,
            fontSize: bubble * 0.72,
            lineHeight: 1,
            color: INK,
            marginTop: bubble * 0.04,
          }}
        >
          ?
        </div>
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 900,
          fontSize: titleSize,
          lineHeight: 1.14,
          paddingTop: titleSize * 0.12,
          color: "#ffffff",
          textShadow: `0 ${8 * unit}px 0 ${pal.darker}, 0 ${16 * unit}px ${30 * unit}px rgba(20,8,40,0.45)`,
          maxWidth: contentW,
          opacity: Math.min(1, titleIn * 2),
          transform: `scale(${interpolate(titleIn, [0, 1], [0.6, 1])})`,
        }}
      >
        {titleText}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 34 * unit,
            maxWidth: contentW,
            padding: `${14 * unit}px ${34 * unit}px`,
            borderRadius: 40 * unit,
            backgroundColor: "#ffffff",
            color: pal.deep,
            fontFamily: FONTS.sans,
            fontWeight: 800,
            fontSize: 44 * unit,
            lineHeight: 1.25,
            boxShadow: `0 ${7 * unit}px 0 rgba(20,8,40,0.25)`,
            opacity: Math.min(1, subIn * 2),
            transform: `translateY(${(1 - subIn) * 30 * unit}px)`,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
