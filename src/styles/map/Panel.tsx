/**
 * Bảng phụ đề dưới đáy (thẻ giấy sạch: "CHẶNG 02 / 05" + chấm hành trình + câu đang đọc, cụm nhấn quét bút dạ)
 * và khung tiêu đề cartouche của phần mở đầu.
 */
import { Easing, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { findPunch } from "../whiteboard/written";
import { chars, clamp, deep, MAP, mix, pad2, SERIF, UI, upper } from "./geo";
import type { Rect } from "./parts";
import { splitTag } from "./parts";

// ---------------------------------------------------------------------------
// Bảng phụ đề
// ---------------------------------------------------------------------------
/** Chữ của câu; các từ thuộc cụm nhấn đổi màu và được bút dạ màu nhấn quét lần lượt trong 12 frame từ `at`. */
const Marked: React.FC<{ text: string; range: [number, number] | null; at: number; frame: number; size: number; accent: string }> = ({
  text, range, at, frame, size, accent,
}) => {
  const words = text.split(/\s+/).filter(Boolean);
  const span = range ? range[1] - range[0] + 1 : 1;
  return (
    <>
      {words.map((word, i) => {
        const hit = range !== null && i >= range[0] && i <= range[1];
        const k = hit ? i - range![0] : 0;
        const sweep = hit ? interpolate(frame, [at + (k / span) * 12, at + ((k + 1) / span) * 12], [0, 100], clamp) : 0;
        return (
          <span key={`w-${i}`}>
            {i > 0 ? " " : ""}
            <span
              style={
                hit
                  ? {
                    color: sweep > 0 ? deep(accent, 0.45) : undefined,
                    backgroundImage: `linear-gradient(${mix(accent, "#ffffff", 0.62)}, ${mix(accent, "#ffffff", 0.62)})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${sweep.toFixed(1)}% 46%`,
                    backgroundPosition: "0 86%",
                    padding: `0 ${size * 0.06}px`,
                    margin: `0 ${-size * 0.06}px`,
                    borderRadius: size * 0.08,
                  }
                  : undefined
              }
            >
              {word}
            </span>
          </span>
        );
      })}
    </>
  );
};

export const CaptionPanel: React.FC<{
  rect: Rect;
  caption: Caption | null;
  /** Cảnh chứa câu đang đọc — để lấy cụm nhấn. */
  scene: Scene | null;
  stop: number;
  total: number;
  frame: number;
  base: number;
  accent: string;
  unit: number;
  /** 0..1 — bảng trượt lên sau phần mở đầu. */
  show: number;
}> = ({ rect, caption, scene, stop, total, frame, base, accent, unit, show }) => {
  if (show <= 0) return null;
  const pad = 30 * unit;
  const headH = 40 * unit;
  const textW = rect.w - pad * 2 - 14 * unit;
  const textH = rect.h - pad * 2 - headH - 10 * unit;
  const text = caption ? caption.text.normalize("NFC").trim() : "";
  const lineHeight = 1.32;
  let size = base;
  while (text && Math.ceil((chars(text) * size * 0.56) / textW) * size * lineHeight > textH && size > 28 * unit) size *= 0.94;
  const start = caption ? msToFrames(caption.startMs) : 0;
  const enter = interpolate(frame, [start, start + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const punch = scene?.punch ?? null;
  const range = punch && text ? findPunch(text, punch.text) : null;
  const at = punch ? Math.max(start, msToFrames(punch.atMs)) : 0;
  // Chấm hành trình: tối đa 12 chấm; nhiều hơn thì thành thanh tiến độ.
  const dots = total <= 12;
  const trackW = Math.min(rect.w * 0.42, total * 34 * unit);
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        boxSizing: "border-box",
        padding: `${pad * 0.8}px ${pad}px ${pad}px ${pad + 14 * unit}px`,
        borderRadius: 26 * unit,
        backgroundColor: "rgba(255, 253, 247, 0.96)",
        boxShadow: `0 ${12 * unit}px ${30 * unit}px rgba(40, 25, 10, 0.3), 0 0 0 ${2 * unit}px rgba(45, 36, 25, 0.12)`,
        overflow: "hidden",
        translate: `0 ${((1 - show) * 60 * unit).toFixed(1)}px`,
        opacity: show,
      }}
    >
      {/* Dải màu nhấn mép trái */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 12 * unit, backgroundColor: accent }} />
      <div style={{ height: headH, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 * unit }}>
        <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 26 * unit, lineHeight: 1.4, letterSpacing: "0.1em", color: deep(accent, 0.2), whiteSpace: "nowrap", paddingTop: 4 * unit }}>
          {upper("chặng")} {pad2(stop)}
          <span style={{ color: MAP.muted, letterSpacing: "0.04em" }}> / {pad2(total)}</span>
        </div>
        {total > 1 ? (
          <svg width={trackW} height={24 * unit} viewBox={`0 0 ${trackW} ${24 * unit}`} style={{ flexShrink: 0 }}>
            <line x1={10 * unit} x2={trackW - 10 * unit} y1={12 * unit} y2={12 * unit} stroke="rgba(45, 36, 25, 0.2)" strokeWidth={3 * unit} strokeDasharray={`${5 * unit} ${5 * unit}`} />
            <line
              x1={10 * unit}
              x2={10 * unit + ((trackW - 20 * unit) * (stop - 1)) / Math.max(1, total - 1)}
              y1={12 * unit}
              y2={12 * unit}
              stroke={accent}
              strokeWidth={4 * unit}
            />
            {dots
              ? Array.from({ length: total }, (_, i) => {
                const cx = 10 * unit + ((trackW - 20 * unit) * i) / Math.max(1, total - 1);
                const done = i < stop;
                return <circle key={i} cx={cx} cy={12 * unit} r={(i === stop - 1 ? 9 : 6) * unit} fill={done ? accent : MAP.paper} stroke={done ? accent : "rgba(45, 36, 25, 0.35)"} strokeWidth={2.5 * unit} />;
              })
              : null}
          </svg>
        ) : null}
      </div>
      <div style={{ height: textH + 10 * unit, display: "flex", alignItems: "center" }}>
        {text ? (
          <div
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: size,
              lineHeight,
              color: MAP.ink,
              opacity: enter,
              translate: `0 ${((1 - enter) * 16 * unit).toFixed(1)}px`,
              paddingTop: size * 0.04,
            }}
          >
            <Marked text={text} range={range} at={at} frame={frame} size={size} accent={accent} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Khung tiêu đề cartouche
// ---------------------------------------------------------------------------
/** Hoa văn góc khung (vẽ cho góc trên trái, xoay cho các góc khác): cung lõm + chấm, kiểu bản đồ cổ. */
const Corner: React.FC<{ size: number; rot: number; style: React.CSSProperties }> = ({ size, rot, style }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ position: "absolute", rotate: `${rot}deg`, ...style }}>
    <path d="M 2 18 A 16 16 0 0 0 18 2" fill="none" stroke={MAP.ink} strokeWidth={2.2} />
    <circle cx={6.5} cy={6.5} r={3.2} fill={MAP.ink} />
  </svg>
);

export const TitleCartouche: React.FC<{
  title: string; subtitle: string; accent: string; frame: number; width: number; cy: number; cx: number; unit: number; tall: boolean;
}> = ({ title, subtitle, accent, frame, width, cy, cx, unit, tall }) => {
  const unroll = interpolate(frame, [12, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const titleT = interpolate(frame, [22, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const subT = interpolate(frame, [28, 38], [0, 1], clamp);
  const exit = interpolate(frame, [TITLE_FRAMES - 20, TITLE_FRAMES - 4], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (unroll <= 0 || exit >= 1) return null;
  const innerW = width - 110 * unit;
  let size = (tall ? 96 : 84) * unit;
  while (Math.ceil((chars(title) * size * 0.54) / innerW) > 3 && size > 46 * unit) size *= 0.93;
  const kicker = upper("hành trình");
  const sub = subtitle.normalize("NFC").trim();
  // Dòng phụ dạng "Hà Nội · Huế · Sài Gòn" hiện thành chuỗi điểm dừng có chấm tròn giữa.
  const stops = sub ? splitTag(sub) : null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - width / 2,
        top: cy,
        width,
        translate: `0 calc(-50% + ${(-exit * 140 * unit).toFixed(1)}px)`,
        opacity: 1 - exit,
        scale: String(1 - exit * 0.08),
      }}
    >
      <div
        style={{
          position: "relative",
          padding: `${44 * unit}px ${55 * unit}px ${50 * unit}px`,
          backgroundColor: "#fbf3de",
          backgroundImage: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.6), transparent 70%)",
          border: `${4 * unit}px solid ${MAP.ink}`,
          outline: `${1.5 * unit}px solid ${MAP.ink}`,
          outlineOffset: `${-14 * unit}px`,
          borderRadius: 10 * unit,
          boxShadow: `0 ${18 * unit}px ${40 * unit}px rgba(40, 25, 10, 0.4)`,
          textAlign: "center",
          transformOrigin: "50% 50%",
          scale: `1 ${unroll.toFixed(3)}`,
        }}
      >
        <Corner size={40 * unit} rot={0} style={{ left: 18 * unit, top: 18 * unit }} />
        <Corner size={40 * unit} rot={90} style={{ right: 18 * unit, top: 18 * unit }} />
        <Corner size={40 * unit} rot={180} style={{ right: 18 * unit, bottom: 18 * unit }} />
        <Corner size={40 * unit} rot={270} style={{ left: 18 * unit, bottom: 18 * unit }} />
        <div style={{ opacity: titleT }}>
          <div style={{ fontFamily: UI, fontWeight: 800, fontSize: 26 * unit, lineHeight: 1.4, letterSpacing: "0.3em", color: deep(accent, 0.2), paddingTop: 6 * unit }}>
            ✦ {kicker} ✦
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 800,
              fontSize: size,
              lineHeight: 1.18,
              color: MAP.ink,
              marginTop: 10 * unit,
              paddingTop: size * 0.06,
              translate: `0 ${((1 - titleT) * 20 * unit).toFixed(1)}px`,
            }}
          >
            {title}
          </div>
        </div>
        {stops ? (
          <div style={{ opacity: subT, marginTop: 22 * unit }}>
            <svg width={220 * unit} height={16 * unit} viewBox="0 0 220 16" style={{ display: "block", margin: "0 auto" }}>
              <path d="M 4 8 L 90 8 M 130 8 L 216 8" stroke={MAP.ink} strokeWidth={1.6} strokeDasharray="6 5" />
              <path d="M 110 0 L 114 8 L 110 16 L 106 8 Z" fill={accent} />
            </svg>
            <div style={{ fontFamily: UI, fontWeight: 600, fontSize: (tall ? 38 : 34) * unit, lineHeight: 1.4, color: MAP.muted, marginTop: 12 * unit }}>
              {sub}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
