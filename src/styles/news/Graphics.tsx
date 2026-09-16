import { interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { useSceneClock } from "../shared";
import { CAPTION_LH, UPPER_LH, type NewsLayout } from "./layout";
import {
  EASE_IN,
  EASE_INOUT,
  EASE_OUT,
  fitText,
  FONT,
  measure,
  NAVY,
  nfc,
  parseStat,
  RED,
  ramp,
  upper,
  WHITE,
  withAlpha,
  YELLOW,
} from "./theme";

/** Lộ từ phải sang trái. */
const wipeFromRight = (p: number) => `inset(-2px 0 -2px ${((1 - p) * 100).toFixed(3)}%)`;

/**
 * Đồ hoạ số liệu (stat) hoặc chip chuyên mục (badge) ở góc trên phải,
 * sống theo cảnh hiện tại.
 */
export const SceneGraphic: React.FC<{ L: NewsLayout; scenes: Scene[]; accent: string; enterFrame: number }> = ({
  L,
  scenes,
  accent,
  enterFrame,
}) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  if (!scene || !scene.visual) return null;
  const { unit, stacked } = L;
  const visual = scene.visual;

  const enter = index === 0 ? Math.max(startFrame, enterFrame) + 8 : startFrame + 8;
  if (frame < enter) return null;
  const isLast = index === scenes.length - 1;
  const a = ramp(frame, enter, 10, EASE_INOUT);
  const o = isLast ? 0 : ramp(frame, Math.max(enter + 11, endFrame - 8), 8, EASE_IN);
  const motion: React.CSSProperties = {
    position: "absolute",
    right: L.safe.side,
    top: L.statTop,
    opacity: 1 - o,
    transform: `translateX(${o * 80 * unit}px)`,
    filter: `drop-shadow(0 ${8 * unit}px ${16 * unit}px rgba(0,0,0,0.5))`,
  };

  if (visual.type === "badge") {
    const chipFont = Math.round((stacked ? 44 : 38) * unit);
    const chip = fitText(upper(visual.text), L.statW - 56 * unit, 1, chipFont, chipFont * 0.6, 900);
    const cap = visual.caption ? fitText(visual.caption, L.statW - 40 * unit, 2, 32 * unit, 24 * unit, 600) : null;
    return (
      <div style={{ ...motion, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div
          style={{
            padding: `${8 * unit}px ${24 * unit}px`,
            backgroundColor: accent,
            borderLeft: `${Math.max(3, 10 * unit)}px solid ${RED}`,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: chip.size,
            lineHeight: UPPER_LH,
            color: WHITE,
            whiteSpace: "nowrap",
            clipPath: wipeFromRight(a),
          }}
        >
          {chip.lines[0]}
        </div>
        {cap ? (
          <div
            style={{
              marginTop: 6 * unit,
              padding: `${8 * unit}px ${18 * unit}px`,
              backgroundColor: withAlpha(NAVY, 0.92),
              clipPath: wipeFromRight(ramp(frame, enter + 5, 10, EASE_INOUT)),
              textAlign: "right",
            }}
          >
            {cap.lines.map((line, i) => (
              <div
                key={`b-${i}`}
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: cap.size,
                  lineHeight: CAPTION_LH,
                  color: WHITE,
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const padX = 26 * unit;
  const innerW = L.statW - padX * 2 - 8 * unit;
  const text = nfc(visual.text);
  const parsed = parseStat(text);
  const count = ramp(frame, enter + 4, 36, EASE_OUT);
  const numberSize = Math.min((stacked ? 150 : 120) * unit, (innerW * 0.94) / Math.max(1, measure(text, 1, 900)));
  const cap = visual.caption ? fitText(visual.caption, innerW, 2, 34 * unit, 24 * unit, 600) : null;
  const labelFont = Math.round(26 * unit);

  return (
    <div style={{ ...motion, width: L.statW }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            padding: `${4 * unit}px ${18 * unit}px`,
            backgroundColor: RED,
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: labelFont,
            lineHeight: UPPER_LH,
            color: WHITE,
            clipPath: wipeFromRight(a),
          }}
        >
          SỐ LIỆU
        </div>
      </div>
      <div
        style={{
          boxSizing: "border-box",
          width: L.statW,
          padding: `${14 * unit}px ${padX}px ${20 * unit}px`,
          backgroundColor: withAlpha(NAVY, 0.94),
          borderLeft: `${Math.max(3, 8 * unit)}px solid ${accent}`,
          clipPath: wipeFromRight(ramp(frame, enter + 3, 10, EASE_INOUT)),
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: numberSize,
            lineHeight: 1.12,
            color: WHITE,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {parsed ? (
            <>
              {parsed.prefix}
              {parsed.format(parsed.value * count)}
              <span style={{ color: YELLOW }}>{parsed.suffix}</span>
            </>
          ) : (
            text
          )}
        </div>
        <div
          style={{
            marginTop: 8 * unit,
            marginBottom: 10 * unit,
            height: Math.max(2, 5 * unit),
            width: `${ramp(frame, enter + 8, 20) * 100}%`,
            backgroundColor: accent,
          }}
        />
        {cap
          ? cap.lines.map((line, i) => (
              <div
                key={`s-${i}`}
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: cap.size,
                  lineHeight: CAPTION_LH,
                  color: "rgba(255,255,255,0.88)",
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            ))
          : null}
      </div>
    </div>
  );
};

/** Nửa độ dài cú gạt chuyển cảnh (frame) — tổng ~10 frame, tâm đúng điểm cắt. */
const WIPE_HALF = 5;

/** Vệt chéo accent + đỏ quét ngang khung ở đầu mỗi cảnh (trừ cảnh đầu), che điểm cắt. */
export const SceneWipes: React.FC<{ L: NewsLayout; scenes: Scene[]; accent: string }> = ({ L, scenes, accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = L;
  const barW = width * 0.5 + height * 0.2;

  return (
    <>
      {scenes.map((scene, i) => {
        if (i === 0) return null;
        const cut = msToFrames(scene.startMs);
        if (frame < cut - WIPE_HALF || frame > cut + WIPE_HALF) return null;
        const p = interpolate(frame, [cut - WIPE_HALF, cut + WIPE_HALF], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE_INOUT,
        });
        const travel = width + barW * 2 + height * 0.5;
        const x = -barW - height * 0.25 + p * travel;
        const common: React.CSSProperties = {
          position: "absolute",
          top: -height * 0.1,
          height: height * 1.2,
          transform: "skewX(-18deg)",
        };
        return (
          <div key={`wipe-${i}`} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <div style={{ ...common, left: x - barW * 0.32, width: barW * 0.3, backgroundColor: RED }} />
            <div style={{ ...common, left: x, width: barW, backgroundColor: accent }} />
            <div style={{ ...common, left: x + barW, width: Math.max(3, 10 * unit), backgroundColor: WHITE }} />
          </div>
        );
      })}
    </>
  );
};
