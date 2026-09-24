/**
 * Đồ hoạ theo cảnh của phong cách "Thể thao": bảng tên cầu thủ/đội/vòng đấu (tag), bảng thống kê (visual)
 * và cú nổ kiểu pha quay chậm (punch). Vị trí lấy từ `layout.ts`.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SceneVisual } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import { parseStat } from "../tech/theme";
import type { SportLayout } from "./layout";
import { COND, DISPLAY, EASE_IN, EASE_OUT, fitText, INK, inkOn, PANEL, ramp, SNAP, splitTag, upper, withAlpha } from "./theme";
import { useVt } from "../../i18n/video";

// ---------------------------------------------------------------------------
// Bảng tên
// ---------------------------------------------------------------------------
/** Biểu tượng quả bóng cho bảng tên không có số áo ("VÒNG 3", "Man City"). */
const Ball: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100">
    <circle r={44} fill="none" stroke={color} strokeWidth={8} />
    <polygon points="0,-18 17,-6 11,15 -11,15 -17,-6" fill={color} />
    {[-90, -18, 54, 126, 198].map((a) => {
      const r = (a * Math.PI) / 180;
      return <line key={a} x1={Math.cos(r) * 19} y1={Math.sin(r) * 19} x2={Math.cos(r) * 42} y2={Math.sin(r) * 42} stroke={color} strokeWidth={7} />;
    })}
  </svg>
);

export const Nameplate: React.FC<{ L: SportLayout; tag: string; accent: string; enter: number; exit: number }> = ({ L, tag, accent, enter, exit }) => {
  const frame = useCurrentFrame();
  const { u } = L;
  const pop = ramp(frame, enter, 10, SNAP);
  const slide = ramp(frame, enter + 4, 12, EASE_OUT);
  const out = ramp(frame, exit - 8, 8, EASE_IN);
  if (pop <= 0 || out >= 1) return null;
  const h = L.tag.h;
  const { num, name } = splitTag(tag);
  const blockW = h * (num && num.length > 1 ? 1.3 : 1.08);
  const s = 16 * u;
  const nameText = upper(name || tag);
  const fit = fitText(nameText, 46 * u, L.tag.maxW - blockW - 60 * u, 1, 0.5, 24 * u);
  const numFit = num ? fitText(num, h * 0.72, blockW - 20 * u, 1, 0.55, 30 * u).size : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: L.tag.x,
        top: L.tag.bottom - h,
        height: h,
        display: "flex",
        alignItems: "stretch",
        opacity: 1 - out,
        translate: `${-out * 40 * u}px 0px`,
        filter: `drop-shadow(0 ${6 * u}px ${12 * u}px rgba(0,0,0,0.5))`,
      }}
    >
      {/* Tên: tấm trắng trượt ra từ sau khối số, vạch accent ở đáy. */}
      <div
        style={{
          position: "relative",
          order: 2,
          marginLeft: -s,
          height: h,
          clipPath: `inset(0px ${(1 - slide) * 100}% 0px 0px)`,
        }}
      >
        <div
          style={{
            height: h,
            display: "flex",
            alignItems: "center",
            padding: `0 ${36 * u}px 0 ${s + 22 * u}px`,
            backgroundColor: "#ffffff",
            clipPath: `polygon(0 0, 100% 0, calc(100% - ${s}px) 100%, 0 100%)`,
          }}
        >
          <div style={{ fontFamily: DISPLAY, fontSize: fit.size, lineHeight: 1.2, paddingTop: fit.size * 0.06, color: INK, whiteSpace: "nowrap" }}>{nameText}</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: s, bottom: 0, height: 7 * u, backgroundColor: accent }} />
      </div>
      {/* Khối số áo: nghiêng, bật lên. */}
      <div
        style={{
          order: 1,
          position: "relative",
          zIndex: 1,
          width: blockW,
          height: h,
          scale: String(pop),
          backgroundColor: accent,
          clipPath: `polygon(${s}px 0, 100% 0, calc(100% - ${s}px) 100%, 0 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {num ? (
          <div style={{ display: "flex", alignItems: "flex-start", color: inkOn(accent), fontFamily: DISPLAY, lineHeight: 1, paddingTop: 4 * u }}>
            <span style={{ fontSize: numFit * 0.42, marginTop: numFit * 0.08, marginRight: 2 * u, opacity: 0.8 }}>#</span>
            <span style={{ fontSize: numFit }}>{num}</span>
          </div>
        ) : (
          <Ball size={h * 0.5} color={inkOn(accent)} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bảng thống kê
// ---------------------------------------------------------------------------
export const StatGraphic: React.FC<{
  L: SportLayout;
  visual: SceneVisual;
  accent: string;
  enter: number;
  exit: number;
  /** Tạm ẩn trong khoảng này (khung ngang: nhường chỗ cho câu nhấn). */
  yieldFrom?: number;
  yieldUntil?: number;
}> = ({ L, visual, accent, enter, exit, yieldFrom = 1e7, yieldUntil = 1e7 + 1 }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const { u } = L;
  const inP = ramp(frame, enter, 12, EASE_OUT);
  const hide = ramp(frame, yieldFrom, 6, EASE_OUT) - ramp(frame, Math.max(yieldFrom + 7, yieldUntil), 10, EASE_OUT);
  const out = Math.max(ramp(frame, exit - 8, 8, EASE_IN), hide);
  if (inP <= 0 || out >= 1) return null;
  const w = L.stat.w;
  const fromRight = L.stat.align === "right";
  const pos: React.CSSProperties = {
    position: "absolute",
    left: L.stat.x,
    width: w,
    ...(L.stat.anchor === "bottom" ? { bottom: L.H - L.stat.y } : { top: L.stat.y }),
    opacity: inP * (1 - out),
    translate: `${(1 - inP) * (fromRight ? 80 : -80) * u}px 0px`,
    display: "flex",
    flexDirection: "column",
    alignItems: fromRight ? "flex-end" : "flex-start",
    filter: `drop-shadow(0 ${8 * u}px ${16 * u}px rgba(0,0,0,0.5))`,
  };
  const label = visual.caption ? upper(visual.caption) : null;

  if (visual.type === "badge") {
    const text = upper(visual.text);
    const size = fitText(text, 64 * u, w - 80 * u, 1, 0.5, 30 * u).size;
    return (
      <div style={pos}>
        <div
          style={{
            backgroundColor: accent,
            padding: `${10 * u}px ${40 * u}px ${6 * u}px`,
            clipPath: `polygon(${18 * u}px 0, 100% 0, calc(100% - ${18 * u}px) 100%, 0 100%)`,
            fontFamily: DISPLAY,
            fontSize: size,
            lineHeight: 1.2,
            color: inkOn(accent),
            whiteSpace: "nowrap",
            scale: String(ramp(frame, enter, 10, SNAP)),
          }}
        >
          {text}
        </div>
        {label ? (
          <div
            style={{
              marginTop: 6 * u,
              backgroundColor: withAlpha(INK, 0.9),
              padding: `${8 * u}px ${20 * u}px`,
              fontFamily: COND,
              fontWeight: 600,
              fontSize: 26 * u,
              lineHeight: 1.3,
              color: "#fff",
              maxWidth: w,
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    );
  }

  // Số liệu: đếm lên 30 frame; có "%" (≤ 100) thì vẽ thanh so sánh hai phía kiểu thống kê kiểm soát bóng.
  const parsed = parseStat(visual.text);
  const t = ramp(frame, enter + 4, 30, EASE_OUT);
  const shown = parsed ? `${parsed.prefix}${parsed.format(parsed.value * t)}${parsed.suffix}` : visual.text;
  const percent = parsed !== null && /^\s*%/.test(parsed.suffix) && parsed.value <= 100 && parsed.prefix.trim() === "";
  const numSize = fitText(visual.text, (percent ? 104 : 124) * u, w - (percent ? 200 : 60) * u, 1, 0.52, 54 * u).size;
  const rest = percent && parsed ? `${parsed.format(Math.max(0, 100 - parsed.value * t))}%` : "";
  return (
    <div style={pos}>
      <div style={{ width: w, backgroundColor: withAlpha(PANEL, 0.94), borderTop: `${6 * u}px solid ${accent}`, padding: `${16 * u}px ${24 * u}px ${20 * u}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 * u }}>
          <div style={{ width: 10 * u, height: 26 * u, backgroundColor: accent, transform: "skewX(-14deg)" }} />
          <div style={{ fontFamily: COND, fontWeight: 600, fontSize: 26 * u, lineHeight: 1.35, color: "rgba(255,255,255,0.86)" }}>{label ?? vt("THỐNG KÊ")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 * u }}>
          <div style={{ fontFamily: DISPLAY, fontSize: numSize, lineHeight: 1.15, color: "#ffffff", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {shown}
          </div>
          {percent ? (
            <div style={{ fontFamily: DISPLAY, fontSize: numSize * 0.46, lineHeight: 1.2, color: "rgba(255,255,255,0.5)", paddingBottom: numSize * 0.12 }}>{rest}</div>
          ) : null}
        </div>
        {percent && parsed ? (
          <div style={{ display: "flex", height: 16 * u, marginTop: 8 * u, gap: 4 * u }}>
            <div style={{ width: `${parsed.value * t}%`, backgroundColor: accent, transform: "skewX(-20deg)" }} />
            <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.22)", transform: "skewX(-20deg)" }} />
          </div>
        ) : (
          <div style={{ height: 8 * u, marginTop: 6 * u, width: `${t * 100}%`, background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0)})` }} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Câu nhấn: cú nổ kiểu "GOAL!"
// ---------------------------------------------------------------------------
export const PunchBurst: React.FC<{ L: SportLayout; text: string; accent: string; at: number; until: number }> = ({ L, text, accent, at, until }) => {
  const frame = useCurrentFrame();
  const { u } = L;
  if (frame < at || frame >= until + 10) return null;
  const words = upper(text);
  const land = ramp(frame, at, 6, EASE_OUT);
  const fade = ramp(frame, at, 3, EASE_OUT);
  const out = ramp(frame, until, 10, EASE_IN);
  const base = Math.min(L.punch.maxH * (L.portrait ? 0.62 : 0.42), (L.portrait ? 200 : 150) * u);
  const fit = fitText(words, base, L.punch.maxW - 60 * u, 2, 0.5, 64 * u);
  const size = fit.size;
  const scale = (2.3 - 1.3 * land) * (1 + 0.18 * out);
  const opacity = fade * (1 - out);
  // Tia sáng nổ + vệt tốc độ: hình sao nhiều cánh màu accent xoay chậm, các vệt ngang bay ra hai bên.
  const burstR = Math.min(Math.max(size * fit.lines * 1.25, size * 2.2), L.punch.maxH * 0.8);
  const burstScale = ramp(frame, at + 1, 8, SNAP) * (1 + 0.03 * Math.sin((frame - at) / 4));
  const spikes = 18;
  const pts = Array.from({ length: spikes * 2 }, (_, i) => {
    const r = i % 2 === 0 ? burstR * (0.95 + seeded(`sp-${i}`) * 0.25) : burstR * 0.62;
    const a = (i / (spikes * 2)) * Math.PI * 2 + (frame - at) * 0.004;
    return `${Math.cos(a) * r * 1.45},${Math.sin(a) * r * 0.78}`;
  }).join(" ");
  const streakT = Math.max(0, frame - at);
  const streaks = Array.from({ length: 16 }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const y = (seeded(`st-y-${i}`) - 0.5) * burstR * 1.3;
    const len = (0.35 + seeded(`st-l-${i}`) * 0.6) * burstR;
    const x = side * (burstR * 0.55 + ((streakT * (26 + seeded(`st-v-${i}`) * 30) * u) % (burstR * 1.6)));
    return { x, y, len, side, w: (3 + seeded(`st-w-${i}`) * 7) * u };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div style={{ position: "absolute", left: L.punch.cx, top: L.punch.cy, width: 0, height: 0 }}>
        <svg
          width={burstR * 4}
          height={burstR * 3}
          viewBox={`${-burstR * 2} ${-burstR * 1.5} ${burstR * 4} ${burstR * 3}`}
          style={{ position: "absolute", left: -burstR * 2, top: -burstR * 1.5, overflow: "visible", rotate: "-6deg" }}
        >
          <g transform={`scale(${burstScale})`}>
            <polygon points={pts} fill={withAlpha(accent, 0.9)} />
            <polygon points={pts} fill="none" stroke="#fff" strokeWidth={5 * u} transform="scale(0.9)" opacity={0.7} />
          </g>
          {streaks.map((s, i) => (
            <rect
              key={i}
              x={s.side > 0 ? s.x : s.x - s.len}
              y={s.y - s.w / 2}
              width={s.len}
              height={s.w}
              rx={s.w / 2}
              fill={i % 3 === 0 ? accent : "#ffffff"}
              opacity={0.85 * (1 - ramp(frame, at + 14, 20))}
            />
          ))}
        </svg>
        {/* Bóng mờ phóng to phía sau — nhoè chuyển động lúc chữ lao vào. */}
        {land < 1
          ? [1.5, 1.22].map((k) => (
              <div key={k} style={{ ...wordBox(L.punch.maxW - 60 * u), scale: String(scale * k), opacity: 0.25 * (1 - land) }}>
                <PunchWords text={words} size={size} accent={accent} u={u} />
              </div>
            ))
          : null}
        <div style={{ ...wordBox(L.punch.maxW - 60 * u), scale: String(scale) }}>
          <PunchWords text={words} size={size} accent={accent} u={u} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const wordBox = (maxW: number): React.CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  translate: "-50% -50%",
  width: "max-content",
  maxWidth: maxW,
});

const PunchWords: React.FC<{ text: string; size: number; accent: string; u: number }> = ({ text, size, accent, u }) => (
  <div
    style={{
      fontFamily: DISPLAY,
      fontSize: size,
      lineHeight: 1.18,
      paddingTop: size * 0.08,
      textAlign: "center",
      color: "#ffffff",
      transform: "rotate(-6deg) skewX(-12deg)",
      WebkitTextStroke: `${Math.max(3, size * 0.05)}px ${INK}`,
      paintOrder: "stroke fill",
      textShadow: `${size * 0.05}px ${size * 0.05}px 0 ${accent}, ${size * 0.1}px ${size * 0.1}px 0 ${INK}, 0 0 ${40 * u}px rgba(0,0,0,0.5)`,
      whiteSpace: "pre-wrap",
      textWrap: "balance",
    }}
  >
    {text}
  </div>
);

/** Chip "▶ PHÁT LẠI" + viền accent quanh khung trong lúc câu nhấn đang hiện. */
export const ReplayFrame: React.FC<{ L: SportLayout; accent: string; at: number; until: number; safeTop: number }> = ({ L, accent, at, until, safeTop }) => {
  // Luôn ở góc trên phải — khung ngang/vuông thì bảng số ở góc đó tạm ẩn trong lúc câu nhấn hiện.
  const frame = useCurrentFrame();
  const vt = useVt();
  const { u } = L;
  const inP = ramp(frame, at, 6, EASE_OUT);
  const out = ramp(frame, until, 10, EASE_IN);
  if (frame < at || out >= 1) return null;
  const o = inP * (1 - out);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: o }}>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 0 ${8 * u}px ${accent}, inset 0 0 ${60 * u}px ${withAlpha(accent, 0.45)}` }} />
      <div
        style={{
          position: "absolute",
          right: L.right,
          top: safeTop,
          display: "flex",
          alignItems: "center",
          gap: 10 * u,
          backgroundColor: withAlpha(INK, 0.9),
          padding: `${10 * u}px ${18 * u}px`,
          borderLeft: `${8 * u}px solid ${accent}`,
          fontFamily: COND,
          fontWeight: 700,
          fontSize: 28 * u,
          lineHeight: 1.2,
          color: "#fff",
          translate: `${(1 - inP) * 60 * u}px 0px`,
        }}
      >
        <svg width={20 * u} height={22 * u} viewBox="0 0 20 22">
          <polygon points="0,0 20,11 0,22" fill={accent} />
        </svg>
        {vt("PHÁT LẠI")}
      </div>
    </AbsoluteFill>
  );
};
