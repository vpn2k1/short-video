import { useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneVisual } from "../../compositions/Short/schema";
import { FONTS, useLayout } from "../shared";
import { CYAN, EASE_OUT, INK, parseStat, ramp, withAlpha } from "./theme";

/** Thanh tiến độ mảnh phát sáng, chạy suốt video. */
export const ProgressLine: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { unit } = useLayout();
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
  const h = Math.max(2, 4 * unit);
  return (
    <div
      style={{
        position: "relative",
        height: h,
        borderRadius: h,
        backgroundColor: "rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progress * 100}%`,
          borderRadius: h,
          backgroundImage: `linear-gradient(90deg, ${accent}, ${CYAN})`,
          boxShadow: `0 0 ${12 * unit}px ${withAlpha(CYAN, 0.7)}`,
        }}
      />
      {/* Đầu sáng */}
      <div
        style={{
          position: "absolute",
          top: h / 2 - 5 * unit,
          left: `calc(${progress * 100}% - ${5 * unit}px)`,
          width: 10 * unit,
          height: 10 * unit,
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          boxShadow: `0 0 ${14 * unit}px ${CYAN}`,
        }}
      />
    </div>
  );
};

/** Chip nhãn trạng thái: chấm accent nhấp nháy + chữ mono. */
export const TagChip: React.FC<{ text: string; accent: string; opacity: number; shift: number }> = ({
  text,
  accent,
  opacity,
  shift,
}) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pulse = (frame % 36) / 36;
  const dot = 14 * unit;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        opacity,
        transform: `translateX(${shift * 40 * unit}px)`,
        display: "flex",
        alignItems: "center",
        gap: 14 * unit,
        padding: `${12 * unit}px ${22 * unit}px`,
        borderRadius: 999,
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))",
        backgroundColor: "rgba(8,14,32,0.6)",
        border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.16)`,
        fontFamily: FONTS.mono,
        fontSize: 28 * unit,
        fontWeight: 600,
        letterSpacing: 1.5 * unit,
        color: INK,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          width: dot,
          height: dot,
          borderRadius: "50%",
          backgroundColor: accent,
          boxShadow: `0 0 0 ${pulse * 12 * unit}px ${withAlpha(accent, 0.45 * (1 - pulse))}, 0 0 ${10 * unit}px ${accent}`,
          flexShrink: 0,
        }}
      />
      {text}
    </div>
  );
};

/**
 * Câu nhấn: chữ gradient accent → cyan, quầng sáng phía sau, một vệt sáng quét qua
 * lúc vừa hiện. Vào bằng fade + trượt nhẹ, không phóng to, không blur chữ chính.
 */
export const Punch: React.FC<{
  text: string;
  accent: string;
  fontSize: number;
  appearFrame: number;
  sceneOpacity: number;
  align: "center" | "left";
}> = ({ text, accent, fontSize, appearFrame, sceneOpacity, align }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const appear = ramp(frame, appearFrame, 12);
  const opacity = appear * sceneOpacity;
  if (opacity <= 0) return null;
  const sheen = -30 + 160 * ramp(frame, appearFrame + 4, 26);
  const common: React.CSSProperties = {
    fontFamily: FONTS.sans,
    fontSize,
    fontWeight: 800,
    lineHeight: 1.08,
    letterSpacing: -0.02 * fontSize,
    textAlign: align,
    width: "100%",
    // Chừa chỗ cho dấu tiếng Việt ở dòng trên cùng.
    paddingTop: fontSize * 0.08,
  };
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        opacity,
        transform: `translateY(${(1 - appear) * 24 * unit}px)`,
      }}
    >
      <div
        style={{
          ...common,
          position: "absolute",
          left: 0,
          bottom: 0,
          color: withAlpha(accent, 0.55),
          filter: `blur(${22 * unit}px)`,
        }}
      >
        {text}
      </div>
      <div
        style={{
          ...common,
          position: "relative",
          color: "transparent",
          backgroundImage: `linear-gradient(105deg, transparent ${sheen - 12}%, rgba(255,255,255,0.85) ${sheen}%, transparent ${sheen + 12}%), linear-gradient(90deg, ${accent} 0%, ${CYAN} 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Chiều cao panel stat — bố cục dùng để chừa chỗ khi panel lấn ra ngoài thẻ. */
export const STAT_PANEL_HEIGHT = 150;

/** Panel stat (bộ đếm + vòng tiến độ) hoặc badge viền neon. */
export const VisualPanel: React.FC<{
  visual: SceneVisual;
  accent: string;
  id: string;
  enterFrame: number;
  sceneOpacity: number;
  /** Bề rộng tối đa panel được chiếm — số và chú thích co lại cho vừa. */
  maxWidth: number;
}> = ({ visual, accent, id, enterFrame, sceneOpacity, maxWidth }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const appear = ramp(frame, enterFrame, 14);
  const opacity = appear * sceneOpacity;
  if (opacity <= 0) return null;
  const motion: React.CSSProperties = {
    opacity,
    transform: `translateY(${(1 - appear) * 30 * unit}px) scale(${0.92 + 0.08 * appear})`,
  };

  if (visual.type === "badge") {
    return (
      <div style={{ ...motion, display: "flex", alignItems: "center", gap: 20 * unit }}>
        <div
          style={{
            padding: `${14 * unit}px ${34 * unit}px`,
            borderRadius: 999,
            border: `${Math.max(1, 2.5 * unit)}px solid ${accent}`,
            backgroundColor: withAlpha(accent, 0.12),
            boxShadow: `0 0 ${26 * unit}px ${withAlpha(accent, 0.55)}, inset 0 0 ${18 * unit}px ${withAlpha(accent, 0.3)}`,
            fontFamily: FONTS.mono,
            fontSize: 36 * unit,
            fontWeight: 700,
            letterSpacing: 3 * unit,
            color: "#ffffff",
            textShadow: `0 0 ${12 * unit}px ${withAlpha(accent, 0.9)}`,
            whiteSpace: "nowrap",
          }}
        >
          {visual.text.toUpperCase()}
        </div>
        {visual.caption ? (
          <div
            style={{
              fontSize: 28 * unit,
              fontWeight: 600,
              color: "rgba(234,242,255,0.85)",
              maxWidth: 360 * unit,
              lineHeight: 1.25,
              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            }}
          >
            {visual.caption}
          </div>
        ) : null}
      </div>
    );
  }

  const parsed = parseStat(visual.text);
  const count = ramp(frame, enterFrame + 8, 42, EASE_OUT);
  const fraction = parsed && parsed.suffix.trim().startsWith("%") ? Math.min(1, parsed.value / 100) : 1;
  const ringSize = 104 * unit;
  const stroke = 9 * unit;
  const r = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Chỗ còn lại cho cột chữ sau khi trừ vòng tròn, khoảng cách và padding.
  const textRoom = Math.max(120 * unit, maxWidth - ringSize - 26 * unit - 64 * unit);
  const numberSize = Math.min(70 * unit, textRoom / ([...visual.text].length * 0.62));
  const captionSize = Math.min(24 * unit, textRoom / Math.max(1, [...(visual.caption ?? "")].length * 0.62));

  return (
    <div
      style={{
        ...motion,
        maxWidth,
        display: "flex",
        alignItems: "center",
        gap: 26 * unit,
        height: STAT_PANEL_HEIGHT * unit,
        boxSizing: "border-box",
        padding: `0 ${40 * unit}px 0 ${24 * unit}px`,
        borderRadius: 32 * unit,
        backgroundImage: "linear-gradient(135deg, rgba(28,42,78,0.95) 0%, rgba(9,15,34,0.94) 100%)",
        border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.18)`,
        boxShadow: `0 ${24 * unit}px ${50 * unit}px -${12 * unit}px rgba(0,0,0,0.7), 0 0 ${40 * unit}px ${withAlpha(accent, 0.25)}, inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.2)`,
        whiteSpace: "nowrap",
      }}
    >
      <svg width={ringSize} height={ringSize} style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accent} />
            <stop offset="100%" stopColor={CYAN} />
          </linearGradient>
        </defs>
        <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * fraction * count} ${circumference}`}
        />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: numberSize,
            fontWeight: 800,
            lineHeight: 1.05,
            color: INK,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -1 * unit,
          }}
        >
          {parsed ? (
            <>
              {parsed.prefix}
              {parsed.format(parsed.value * count)}
              <span style={{ color: CYAN }}>{parsed.suffix}</span>
            </>
          ) : (
            visual.text
          )}
        </div>
        {visual.caption ? (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: Math.max(16 * unit, captionSize),
              color: "rgba(234,242,255,0.65)",
              letterSpacing: 1 * unit,
              marginTop: 4 * unit,
            }}
          >
            {visual.caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};
