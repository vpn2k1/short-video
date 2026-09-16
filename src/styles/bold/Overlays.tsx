import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneVisual } from "../../compositions/Short/schema";
import { FONTS, useLayout } from "../shared";
import { formatStat, measureAt100, OUTLINE_EM, outlineShadow, parseStat, upper, WORD_FONT, WORD_WEIGHT, YELLOW } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SNAP = Easing.bezier(0.16, 1, 0.3, 1);

const isDark = (hex: string) => {
  const m = hex.trim().match(/^#?([0-9a-f]{6})/i);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.3;
};

/** Nền khi cảnh không có ảnh: tối, một quầng accent mờ phía trên, viền tối. */
export const Backdrop: React.FC<{ accent: string; background: string }> = ({ accent, background }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: isDark(background) ? background : "#0c0c10" }}>
      <AbsoluteFill
        style={{
          opacity: 0.24 + Math.sin(frame / 45) * 0.04,
          backgroundImage: `radial-gradient(ellipse 80% 55% at 50% 36%, ${accent} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Thanh tiến độ mảnh ở mép trên vùng an toàn. */
export const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { width, safe, unit } = useLayout();
  const w = width - safe.side * 2;
  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top - 4 * unit,
        width: w,
        height: 8 * unit,
        borderRadius: 8 * unit,
        backgroundColor: "rgba(255,255,255,0.22)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: w * interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], clamp),
          height: "100%",
          backgroundColor: YELLOW,
        }}
      />
    </div>
  );
};

/** Nhãn nhỏ: pill trắng chữ đen, ngay dưới thanh tiến độ. */
export const Tag: React.FC<{ text: string; appear: number }> = ({ text, appear }) => {
  const frame = useCurrentFrame();
  const { width, safe, unit } = useLayout();
  const t = frame - appear;
  if (t < 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top + 30 * unit,
        width: width - safe.side * 2,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          backgroundColor: "#ffffff",
          color: "#000000",
          borderRadius: 999,
          padding: `${10 * unit}px ${30 * unit}px ${8 * unit}px`,
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 36 * unit,
          lineHeight: 1.3,
          boxShadow: `0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,0.35)`,
          opacity: interpolate(t, [0, 2], [0, 1], clamp),
          scale: interpolate(t, [0, 4, 7], [0.5, 1.08, 1], { ...clamp, easing: [SNAP, Easing.inOut(Easing.quad)] }),
        }}
      >
        {upper(text)}
      </div>
    </div>
  );
};

/** Vùng hình vẽ ở một phần ba trên: con số đếm lên hoặc nhãn vàng. */
export const Visual: React.FC<{ visual: SceneVisual; appear: number; hasTag: boolean }> = ({ visual, appear, hasTag }) => {
  const frame = useCurrentFrame();
  const { width, safe, unit, portrait } = useLayout();
  const t = frame - appear;
  if (t < 0) return null;
  const boxW = width - safe.side * 2;
  const top = safe.top + (hasTag ? 130 : 60) * unit + (portrait ? 60 * unit : 0);
  const pop = interpolate(t, [0, 4, 8], [0.5, 1.1, 1], { ...clamp, easing: [SNAP, Easing.inOut(Easing.quad)] });
  const opacity = interpolate(t, [0, 2], [0, 1], clamp);
  const captionSize = (portrait ? 46 : 40) * unit;

  const captionEl = visual.caption ? (
    <div
      style={{
        marginTop: 12 * unit,
        maxWidth: boxW,
        textAlign: "center",
        fontFamily: WORD_FONT,
        fontWeight: 800,
        fontSize: captionSize,
        lineHeight: 1.3,
        color: "#ffffff",
        textShadow: outlineShadow(captionSize * 0.8),
        opacity: interpolate(t, [6, 10], [0, 1], clamp),
        translate: `0px ${interpolate(t, [6, 12], [16 * unit, 0], { ...clamp, easing: SNAP })}px`,
      }}
    >
      {upper(visual.caption)}
    </div>
  ) : null;

  if (visual.type === "badge") {
    const size = (portrait ? 64 : 54) * unit;
    return (
      <div style={{ position: "absolute", left: safe.side, top, width: boxW, display: "flex", flexDirection: "column", alignItems: "center", opacity }}>
        <div
          style={{
            maxWidth: boxW,
            backgroundColor: YELLOW,
            color: "#000000",
            borderRadius: 999,
            padding: `${14 * unit}px ${44 * unit}px ${10 * unit}px`,
            fontFamily: WORD_FONT,
            fontWeight: WORD_WEIGHT,
            fontSize: size,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            border: `${5 * unit}px solid #000`,
            boxShadow: `0 ${10 * unit}px ${24 * unit}px rgba(0,0,0,0.45)`,
            scale: pop,
            rotate: `${interpolate(t, [0, 8], [-10, -3], { ...clamp, easing: SNAP })}deg`,
          }}
        >
          {upper(visual.text)}
        </div>
        {captionEl}
      </div>
    );
  }

  const parsed = parseStat(visual.text);
  const count = interpolate(t, [2, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const finalText = upper(visual.text);
  const shown = parsed ? upper(`${parsed.prefix}${formatStat(parsed.value * count, parsed)}${parsed.suffix}`) : finalText;
  const maxStat = (portrait ? 300 : 220) * unit;
  const size = Math.floor(Math.min(maxStat, ((boxW * 100) / (measureAt100(finalText) + OUTLINE_EM * 200)) * 0.92));
  return (
    <div style={{ position: "absolute", left: safe.side, top, width: boxW, display: "flex", flexDirection: "column", alignItems: "center", opacity }}>
      <div
        style={{
          fontFamily: WORD_FONT,
          fontWeight: WORD_WEIGHT,
          fontSize: size,
          lineHeight: 1.1,
          color: YELLOW,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          textShadow: outlineShadow(size),
          scale: pop,
          transformOrigin: "50% 60%",
        }}
      >
        {shown}
      </div>
      {captionEl}
    </div>
  );
};
