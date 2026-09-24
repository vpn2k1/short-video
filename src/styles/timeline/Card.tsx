/**
 * Thẻ của mốc đang xem: ảnh/clip bo góc phóng chậm, dòng "MỐC 03 / 05", lời đọc có chân bên dưới (dọc) hoặc
 * bên phải (ngang/vuông). Câu nhấn được bút dạ màu nhấn quét qua. Không có ảnh thì khung ảnh thành tấm
 * "mốc chữ": năm thật lớn trên nền màu nhấn nhạt.
 */
import { interpolate } from "remotion";
import type { Scene, SceneVisual } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { alpha, BODY, clamp, DISPLAY, fitOneLine, OUT, ramp, splitPunch, UI, type Theme } from "./theme";
import { useVideoLanguage, useVt, videoLocale, type VideoLanguage } from "../../i18n/video";

export type Rect = { x: number; y: number; w: number; h: number };

export type CardLayout = {
  /** "stack": ảnh trên, chữ dưới (khung dọc). "row": ảnh trái, chữ phải (khung ngang/vuông). */
  mode: "stack" | "row";
  rect: Rect;
  pad: number;
  gap: number;
  /** Chiều cao (stack) hoặc bề rộng (row) của phần ảnh. */
  media: number;
  captionFont: number;
  eyebrowFont: number;
};

export type CardLine = { text: string; start: number } | null;

export const MilestoneCard: React.FC<{
  scene: Scene;
  index: number;
  total: number;
  label: string;
  layout: CardLayout;
  line: CardLine;
  punchAt: number | null;
  /** Frame bắt đầu và độ dài cảnh — cho ảnh phóng chậm và clip phát đúng lúc. */
  start: number;
  duration: number;
  frame: number;
  unit: number;
  accent: string;
  theme: Theme;
  style: React.CSSProperties;
}> = ({ scene, index, total, label, layout, line, punchAt, start, duration, frame, unit, accent, theme, style }) => {
  const vt = useVt();
  const { mode, rect, pad, gap, media, captionFont, eyebrowFont } = layout;
  const row = mode === "row";
  const radius = 34 * unit;
  const innerRadius = 22 * unit;
  const mediaW = row ? media : rect.w - pad * 2;
  const mediaH = row ? rect.h - pad * 2 : media;
  const zoom = interpolate(frame, [start, start + Math.max(1, duration)], [1.02, 1.1], clamp);
  const visual = scene.visual;
  // Khung ngang: con số nằm ở chân cột chữ. Khung dọc: chồng lên góc dưới ảnh. Không có ảnh: giữa tấm mốc chữ.
  const statInText = row && visual?.type === "stat" && scene.image !== null;

  const eyebrow = vt("Mốc {n} / {total}", { n: String(index + 1).padStart(2, "0"), total: String(total).padStart(2, "0") }).toLocaleUpperCase("vi");

  const mediaBox = (
    <div
      style={{
        position: "relative",
        width: mediaW,
        height: mediaH,
        borderRadius: innerRadius,
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: theme.dark ? "#0e131a" : "#e9e2d4",
      }}
    >
      {scene.image ? (
        <SceneMedia scene={scene} from={start} zoom={zoom} />
      ) : (
        <TextMilestone label={label} visual={visual} w={mediaW} h={mediaH} unit={unit} accent={accent} theme={theme} frame={frame} start={start} />
      )}
      {scene.image && visual?.type === "badge" ? (
        <Badge visual={visual} unit={unit} accent={accent} frame={frame} start={start} />
      ) : null}
      {scene.image && visual?.type === "stat" && !statInText ? (
        <div style={{ position: "absolute", left: 24 * unit, bottom: 24 * unit, maxWidth: mediaW - 48 * unit }}>
          <StatBlock visual={visual} unit={unit} accent={accent} theme={theme} frame={frame} start={start} maxW={mediaW - 48 * unit} base={112 * unit} panel />
        </div>
      ) : null}
      {/* Viền trong mảnh cho ảnh sáng khỏi lẫn vào nền thẻ. */}
      <div style={{ position: "absolute", inset: 0, borderRadius: innerRadius, boxShadow: `inset 0 0 0 ${Math.max(1, unit)}px ${theme.cardEdge}` }} />
    </div>
  );

  const lineIn = line ? ramp(frame, line.start, 10) : 0;
  const parts = line ? splitPunch(line.text, scene.punch?.text) : null;
  const sweep = punchAt === null ? 0 : ramp(frame, punchAt, 14, OUT);
  const marker = alpha(accent, theme.dark ? 0.85 : 0.32);

  const textBox = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 14 * unit, paddingTop: row ? 10 * unit : 0 }}>
      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: eyebrowFont, lineHeight: 1.2, letterSpacing: 2 * unit, color: accent, display: "flex", alignItems: "center", gap: 14 * unit }}>
        <div style={{ width: 28 * unit, height: 3 * unit, borderRadius: 2 * unit, backgroundColor: accent }} />
        {eyebrow}
      </div>
      {line ? (
        <div
          style={{
            fontFamily: BODY,
            fontWeight: 500,
            fontSize: captionFont,
            lineHeight: 1.32,
            color: theme.ink,
            opacity: lineIn,
            translate: `0 ${(1 - lineIn) * 14 * unit}px`,
            overflowWrap: "break-word",
          }}
        >
          {parts ? (
            <>
              {parts[0]}
              <span
                style={{
                  fontWeight: 700,
                  backgroundImage: `linear-gradient(${marker}, ${marker})`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "0 85%",
                  backgroundSize: `${(sweep * 100).toFixed(2)}% 52%`,
                  padding: "0 0.06em",
                  margin: "0 -0.06em",
                }}
              >
                {parts[1]}
              </span>
              {parts[2]}
            </>
          ) : (
            line.text
          )}
        </div>
      ) : null}
      {statInText && visual ? (
        <div style={{ marginTop: "auto" }}>
          <div style={{ height: 2 * unit, backgroundColor: theme.track, marginBottom: 18 * unit }} />
          <StatBlock visual={visual} unit={unit} accent={accent} theme={theme} frame={frame} start={start} maxW={rect.w - media - pad * 2 - gap} base={120 * unit} />
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        boxSizing: "border-box",
        padding: pad,
        borderRadius: radius,
        backgroundColor: theme.card,
        boxShadow: `0 ${18 * unit}px ${50 * unit}px ${theme.shadow}, 0 ${2 * unit}px ${6 * unit}px ${theme.shadow}, inset 0 0 0 ${Math.max(1, unit)}px ${theme.cardEdge}`,
        display: "flex",
        flexDirection: row ? "row" : "column",
        gap,
        ...style,
      }}
    >
      {mediaBox}
      {textBox}
    </div>
  );
};

/** "1.000", "250", "85%"… → đếm dần từ 0. Số thập phân hay chữ thì hiện nguyên. */
const countUp = (text: string, t: number, language?: VideoLanguage) => {
  const m = text.match(/^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(?![\d,])(.*)$/);
  if (!m) return text;
  const target = Number(m[2].replace(/\./g, ""));
  const value = Math.round(target * t);
  const shown = m[2].includes(".") ? value.toLocaleString(videoLocale(language)) : String(value);
  return `${m[1]}${shown}${m[3]}`;
};

const StatBlock: React.FC<{
  visual: SceneVisual;
  unit: number;
  accent: string;
  theme: Theme;
  frame: number;
  start: number;
  maxW: number;
  base: number;
  panel?: boolean;
}> = ({ visual, unit, accent, theme, frame, start, maxW, base, panel }) => {
  const language = useVideoLanguage();
  const t = ramp(frame, start + 10, 16);
  const count = ramp(frame, start + 10, 24);
  const size = fitOneLine(visual.text, base, maxW - (panel ? 56 * unit : 0), 0.68);
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4 * unit,
        opacity: t,
        translate: `0 ${(1 - t) * 24 * unit}px`,
        ...(panel
          ? {
              padding: `${18 * unit}px ${28 * unit}px ${20 * unit}px`,
              borderRadius: 20 * unit,
              backgroundColor: alpha(theme.dark ? "#161c25" : "#fffdf8", 0.94),
              boxShadow: `0 ${8 * unit}px ${24 * unit}px rgba(0,0,0,0.25)`,
              borderLeft: `${6 * unit}px solid ${accent}`,
            }
          : null),
      }}
    >
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: size, lineHeight: 1.05, letterSpacing: -0.03 * size, color: accent, whiteSpace: "nowrap" }}>
        {countUp(visual.text, count, language)}
      </div>
      {visual.caption ? (
        <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 28 * unit, lineHeight: 1.3, color: theme.ink, opacity: 0.8, maxWidth: maxW }}>
          {visual.caption}
        </div>
      ) : null}
    </div>
  );
};

/** Nhãn bước dán góc trên ảnh — in hoa bằng JS để giữ đúng dấu. */
const Badge: React.FC<{ visual: SceneVisual; unit: number; accent: string; frame: number; start: number }> = ({ visual, unit, accent, frame, start }) => {
  const t = ramp(frame, start + 8, 12);
  return (
    <div
      style={{
        position: "absolute",
        left: 22 * unit,
        top: 22 * unit,
        display: "flex",
        flexDirection: "column",
        gap: 2 * unit,
        padding: `${10 * unit}px ${20 * unit}px`,
        borderRadius: 14 * unit,
        backgroundColor: accent,
        color: "#ffffff",
        boxShadow: `0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,0.25)`,
        opacity: t,
        scale: String(0.85 + 0.15 * t),
        transformOrigin: "left top",
      }}
    >
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34 * unit, lineHeight: 1.15 }}>
        {visual.text.normalize("NFC").toLocaleUpperCase("vi")}
      </div>
      {visual.caption ? <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 22 * unit, opacity: 0.9 }}>{visual.caption}</div> : null}
    </div>
  );
};

/** Cảnh không có ảnh: năm cực lớn màu nhấn trên nền kẻ ô, hoặc con số nếu cảnh có stat. */
const TextMilestone: React.FC<{
  label: string;
  visual: SceneVisual | null;
  w: number;
  h: number;
  unit: number;
  accent: string;
  theme: Theme;
  frame: number;
  start: number;
}> = ({ label, visual, w, h, unit, accent, theme, frame, start }) => {
  const t = ramp(frame, start + 4, 18);
  const drift = interpolate(frame - start, [0, 300], [0, -30 * unit], clamp);
  const giant = Math.min(h * 0.5, fitOneLine(label, 380 * unit, w * 0.84, 0.7));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: alpha(accent, theme.dark ? 0.14 : 0.1),
        backgroundImage: `linear-gradient(${alpha(accent, 0.12)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(accent, 0.12)} 1px, transparent 1px)`,
        backgroundSize: `${48 * unit}px ${48 * unit}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10 * unit,
        overflow: "hidden",
      }}
    >
      {visual?.type === "stat" ? (
        <>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: Math.min(56 * unit, fitOneLine(label, 56 * unit, w * 0.8)), color: theme.muted, opacity: t }}>{label}</div>
          <StatBlock visual={visual} unit={unit} accent={accent} theme={theme} frame={frame} start={start} maxW={w * 0.84} base={Math.min(200 * unit, h * 0.4)} />
        </>
      ) : (
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: giant,
            lineHeight: 1,
            letterSpacing: -0.04 * giant,
            color: accent,
            // Bóng chữ viền lệch phía sau — như dấu mộc in hai lần.
            textShadow: `${10 * unit}px ${10 * unit}px 0 ${alpha(accent, 0.22)}`,
            whiteSpace: "nowrap",
            opacity: t,
            translate: `${drift}px 0`,
            scale: String(0.92 + 0.08 * t),
          }}
        >
          {label}
        </div>
      )}
      {visual?.type === "badge" ? <Badge visual={visual} unit={unit} accent={accent} frame={frame} start={start} /> : null}
    </div>
  );
};
