/**
 * Chữ và bảng của phong cách "So sánh đối đầu": bảng tên phe (tag), bảng điểm (visual), con dấu phán quyết
 * (punch) và hộp phụ đề. Mọi thứ đặt tuyệt đối theo `layout.ts`, không tự tìm chỗ.
 */
import type { SceneVisual } from "../../compositions/Short/schema";
import { parseStat } from "../tech/theme";
import { plateHeight, type CaptionSpot, type PlateSpot } from "./layout";
import { BODY, DISPLAY, EASE_OUT, fitText, inkOn, NIGHT, ramp, upper, withAlpha } from "./theme";

// ---------------------------------------------------------------------------
// Bảng tên + bảng điểm
// ---------------------------------------------------------------------------

/** Chiều cao giữ chỗ cho bảng điểm/nhãn của một visual. */
export const scoreHeight = (visual: SceneVisual, maxW: number, u: number) => {
  if (visual.type === "badge") return 64 * u + (visual.caption ? 40 * u : 0);
  const num = fitText(visual.text, 118 * u, maxW - 40 * u, 1, 0.5, 60 * u).size;
  const label = visual.caption ? fitText(visual.caption, 28 * u, maxW - 40 * u, 2, 0.56, 22 * u) : null;
  return num * 1.12 + 30 * u + (label ? label.lines * label.size * 1.25 + 6 * u : 0);
};

const ScoreBoard: React.FC<{
  visual: SceneVisual;
  color: string;
  maxW: number;
  u: number;
  frame: number;
  countFrom: number;
  align: "left" | "right" | "center";
}> = ({ visual, color, maxW, u, frame, countFrom, align }) => {
  const labelFit = visual.caption ? fitText(visual.caption, 28 * u, maxW - 40 * u, 2, 0.56, 22 * u) : null;
  if (visual.type === "badge") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center", gap: 6 * u }}>
        <div
          style={{
            fontFamily: BODY,
            fontWeight: 800,
            fontSize: 32 * u,
            lineHeight: 1,
            padding: `${14 * u}px ${24 * u}px`,
            borderRadius: 999,
            color: "#fff",
            backgroundColor: withAlpha(NIGHT, 0.82),
            border: `${4 * u}px solid ${color}`,
            whiteSpace: "nowrap",
          }}
        >
          {upper(visual.text)}
        </div>
        {visual.caption ? (
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24 * u, color: "#fff", textShadow: `0 ${2 * u}px ${8 * u}px rgba(0,0,0,0.8)`, maxWidth: maxW }}>
            {visual.caption}
          </div>
        ) : null}
      </div>
    );
  }
  const numSize = fitText(visual.text, 118 * u, maxW - 40 * u, 1, 0.5, 60 * u).size;
  const parsed = parseStat(visual.text);
  const t = ramp(frame, countFrom, 32);
  const shown = parsed ? `${parsed.prefix}${parsed.format(parsed.value * t)}${parsed.suffix}` : visual.text;
  return (
    <div
      style={{
        maxWidth: maxW,
        padding: `${12 * u}px ${20 * u}px ${16 * u}px`,
        backgroundColor: withAlpha(NIGHT, 0.84),
        borderRadius: 10 * u,
        boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.45), inset 0 0 0 ${2 * u}px ${withAlpha("#ffffff", 0.08)}`,
        borderBottom: `${6 * u}px solid ${color}`,
        textAlign: align === "center" ? "center" : align,
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: numSize,
          lineHeight: 1.12,
          color: "#fff",
          whiteSpace: "nowrap",
          textShadow: `0 0 ${24 * u}px ${color}`,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {shown}
      </div>
      {labelFit && visual.caption ? (
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: labelFit.size, lineHeight: 1.25, color: withAlpha("#ffffff", 0.82), marginTop: 6 * u }}>
          {visual.caption}
        </div>
      ) : null}
    </div>
  );
};

export const PlateStack: React.FC<{
  spot: PlateSpot;
  W: number;
  H: number;
  u: number;
  frame: number;
  tag: string | null;
  visual: SceneVisual | null;
  color: string;
  /** Frame cảnh vào — bảng trượt vào sau đó một chút. */
  enter: number;
  /** 1 = phe đang nói, 0 = phe đang chờ. */
  active: number;
  /** Hệ số ẩn chung (title card, cảnh kết luận…). */
  opacity: number;
  /** Chiều trượt vào: -1 từ trái, +1 từ phải. */
  from: -1 | 1;
}> = ({ spot, W, H, u, frame, tag, visual, color, enter, active, opacity, from }) => {
  if ((!tag && !visual) || opacity <= 0.001) return null;
  const inP = ramp(frame, enter + 3, 12);
  const plateH = plateHeight(u);
  const tagText = tag ? upper(tag) : "";
  const tagSize = tag ? fitText(tagText, 58 * u, spot.maxW - 56 * u, 1, 0.47, 30 * u).size : 0;
  const ink = inkOn(color);

  const plate = tag ? (
    <div
      key="plate"
      style={{
        height: plateH,
        display: "flex",
        alignItems: "center",
        padding: `0 ${30 * u}px`,
        maxWidth: spot.maxW,
        backgroundColor: color,
        transform: "skewX(-12deg)",
        boxShadow: `${8 * u}px ${8 * u}px 0 ${NIGHT}, 0 0 ${34 * u * (0.4 + 0.6 * active)}px ${withAlpha("#000000", 0.45)}`,
        border: `${3 * u}px solid rgba(255,255,255,0.9)`,
      }}
    >
      <div
        style={{
          transform: "skewX(12deg)",
          fontFamily: DISPLAY,
          fontSize: tagSize,
          // Anton cao: chừa đỉnh cho dấu chồng (Ờ, Ể) để không chạm mép bảng.
          lineHeight: 1.15,
          paddingTop: tagSize * 0.06,
          color: ink,
          whiteSpace: "nowrap",
        }}
      >
        {tagText}
      </div>
    </div>
  ) : null;

  const score = visual ? (
    <ScoreBoard
      key="score"
      visual={visual}
      color={color}
      maxW={spot.maxW}
      u={u}
      frame={frame}
      countFrom={enter + 10}
      align={spot.align}
    />
  ) : null;

  const items = spot.grow === "up" ? [score, plate] : [plate, score];
  const position: React.CSSProperties =
    spot.align === "left"
      ? { left: spot.x }
      : spot.align === "right"
        ? { right: W - spot.x }
        : { left: 0, right: 0 };
  return (
    <div
      style={{
        position: "absolute",
        ...position,
        ...(spot.grow === "up" ? { bottom: H - spot.y } : { top: spot.y }),
        display: "flex",
        flexDirection: "column",
        alignItems: spot.align === "left" ? "flex-start" : spot.align === "right" ? "flex-end" : "center",
        gap: 14 * u,
        opacity: opacity * inP * (0.72 + 0.28 * active),
        transform: `translateX(${(1 - inP) * from * 80 * u}px) scale(${0.9 + 0.1 * active})`,
        transformOrigin: spot.align === "left" ? "left center" : spot.align === "right" ? "right center" : "center",
      }}
    >
      {items}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Con dấu phán quyết
// ---------------------------------------------------------------------------
export const Stamp: React.FC<{
  text: string;
  cx: number;
  cy: number;
  maxW: number;
  maxH: number;
  u: number;
  frame: number;
  at: number;
  color: string;
  tilt: number;
  opacity: number;
}> = ({ text, cx, cy, maxW, maxH, u, frame, at, color, tilt, opacity }) => {
  if (frame < at || opacity <= 0.001) return null;
  const label = upper(text);
  const base = Math.min(150 * u, maxH * 0.62);
  const fit0 = fitText(label, base, maxW * 0.9 - 64 * u, 3, 0.5, 40 * u);
  // Không cao quá vùng trống: khung dấu = số dòng × cỡ chữ + viền, đệm.
  const fit = { ...fit0, size: Math.max(36 * u, Math.min(fit0.size, (maxH - 70 * u) / (fit0.lines * 1.12))) };
  // Rơi từ to xuống đúng cỡ trong 7 frame (tăng tốc = cú đập), rồi nảy nhẹ.
  const drop = ramp(frame, at, 7, (t) => t * t);
  const settle = ramp(frame, at + 7, 8, EASE_OUT);
  const scale = drop < 1 ? 2.4 - 1.4 * drop : 1 + 0.06 * Math.sin(settle * Math.PI);
  const ring = ramp(frame, at + 6, 14, EASE_OUT);
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        width: 0,
        height: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      {/* Vòng sóng chấn động lúc con dấu chạm. */}
      {ring > 0 && ring < 1 ? (
        <div
          style={{
            position: "absolute",
            width: fit.size * 4 * (0.6 + ring),
            height: fit.size * 4 * (0.6 + ring),
            borderRadius: "50%",
            border: `${10 * u * (1 - ring)}px solid ${color}`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
      <div
        style={{
          flexShrink: 0,
          maxWidth: maxW,
          padding: `${12 * u}px ${26 * u}px ${8 * u}px`,
          border: `${8 * u}px solid ${color}`,
          outline: `${3 * u}px solid ${color}`,
          outlineOffset: 7 * u,
          borderRadius: 14 * u,
          backgroundColor: withAlpha(NIGHT, 0.78),
          color: "#ffffff",
          fontFamily: DISPLAY,
          fontSize: fit.size,
          lineHeight: 1.12,
          textAlign: "center",
          textShadow: `0 0 ${18 * u}px ${color}, ${4 * u}px ${4 * u}px 0 ${withAlpha("#000000", 0.6)}`,
          transform: `rotate(${tilt}deg) scale(${scale})`,
          opacity: Math.min(1, drop * 3),
          boxShadow: `0 ${14 * u}px ${40 * u}px rgba(0,0,0,0.55)`,
          whiteSpace: "pre-wrap",
          width: "max-content",
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phụ đề
// ---------------------------------------------------------------------------

/** Cỡ chữ và chiều cao hộp phụ đề cho một câu trong bề rộng `boxW`. */
export const captionFit = (text: string, boxW: number, u: number, portrait: boolean) => {
  const padX = 30 * u;
  const padY = 20 * u;
  const base = (portrait ? 56 : 48) * u;
  const fit = fitText(text, base, boxW - padX * 2, 4, 0.54, base * 0.62);
  return { ...fit, padX, padY, height: fit.lines * fit.size * 1.26 + padY * 2 + 8 * u };
};

/** Tách câu thành [trước, cụm nhấn, sau] để tô cụm nhấn màu phe. */
const splitPunch = (text: string, punch: string | null): [string, string, string] => {
  if (!punch) return [text, "", ""];
  const hay = text.normalize("NFC");
  const at = hay.toLocaleLowerCase("vi").indexOf(punch.normalize("NFC").trim().toLocaleLowerCase("vi"));
  if (at < 0) return [hay, "", ""];
  const end = at + punch.normalize("NFC").trim().length;
  return [hay.slice(0, at), hay.slice(at, end), hay.slice(end)];
};

export const CaptionBox: React.FC<{
  text: string;
  spot: CaptionSpot;
  H: number;
  u: number;
  portrait: boolean;
  frame: number;
  start: number;
  color: string;
  punch: string | null;
  /** Hướng trượt vào theo trục dọc: -1 từ trên, +1 từ dưới. */
  from: -1 | 1;
}> = ({ text, spot, H, u, portrait, frame, start, color, punch, from }) => {
  const boxW = spot.right - spot.left;
  const fit = captionFit(text, boxW, u, portrait);
  const inP = ramp(frame, start, 8);
  const [before, hit, after] = splitPunch(text, punch);
  const hitOn = ramp(frame, start + 4, 6);
  return (
    <div
      style={{
        position: "absolute",
        left: spot.left,
        width: boxW,
        ...(spot.anchor === "top" ? { top: spot.y } : { bottom: H - spot.y }),
        display: "flex",
        justifyContent: "center",
        opacity: inP,
        transform: `translateY(${(1 - inP) * from * 36 * u}px)`,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: boxW,
          padding: `${fit.padY}px ${fit.padX}px`,
          backgroundColor: withAlpha(NIGHT, 0.86),
          borderRadius: 12 * u,
          boxShadow: `0 ${12 * u}px ${36 * u}px rgba(0,0,0,0.5)`,
          borderTop: `${8 * u}px solid ${color}`,
          fontFamily: BODY,
          fontWeight: 800,
          fontSize: fit.size,
          lineHeight: 1.26,
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        {before}
        {hit ? (
          <span
            style={{
              color: hitOn > 0.5 ? `color-mix(in srgb, ${color} 78%, #ffffff)` : "#ffffff",
              textShadow: hitOn > 0.5 ? `0 0 ${16 * u}px ${withAlpha("#000000", 0.6)}` : undefined,
            }}
          >
            {hit}
          </span>
        ) : null}
        {after}
      </div>
    </div>
  );
};
