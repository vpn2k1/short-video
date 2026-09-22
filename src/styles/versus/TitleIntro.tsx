/**
 * Title card "So sánh đối đầu": hai nửa màu phe lao vào từ hai phía, đập nhau ở đường nối (chớp trắng + rung),
 * huy hiệu VS đập xuống, tiêu đề in hoa trên dải tối phía trên huy hiệu, dòng phụ và handle phía dưới.
 * Cuối title card hai nửa màu mờ đi, lộ ra ảnh hai phe nằm sẵn bên dưới — cùng một đường nối nên không bị giật.
 *
 * Tách hai lớp để kẹp đường nối + huy hiệu ở giữa: IntroPanels (dưới) và IntroText (trên).
 */
import { AbsoluteFill } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { SolidSide } from "./Stage";
import { BODY, DISPLAY, EASE_IN, fitText, inkOn, NIGHT, ramp, sideClip, upper, withAlpha, type Geo } from "./theme";

/** Frame hai nửa chạm nhau. */
export const CLASH_FRAME = 12;

export const introOut = (frame: number) => ramp(frame, TITLE_FRAMES - 16, 14, EASE_IN);

/**
 * Tên hai phe cỡ lớn trên hai nửa màu: dọc — A ở đỉnh, B ở đáy (tránh tiêu đề/dòng phụ quanh huy hiệu);
 * ngang — dưới đáy mỗi nửa.
 */
const IntroLabel: React.FC<{ g: Geo; safe: { top: number; bottom: number; side: number }; side: 0 | 1; text: string; color: string }> = ({
  g,
  safe,
  side,
  text,
  color,
}) => {
  const { u, W } = g;
  const label = upper(text);
  const boxW = g.portrait ? W - safe.side * 2 : W / 2 - safe.side - g.emblemR;
  const size = Math.min((g.portrait ? 170 : 120) * u, boxW / Math.max(1, [...label].length * 0.5));
  const place: React.CSSProperties = g.portrait
    ? { left: 0, right: 0, ...(side === 0 ? { top: safe.top + 30 * u } : { bottom: safe.bottom + 10 * u }) }
    : { bottom: safe.bottom, ...(side === 0 ? { left: 0, width: W / 2 } : { right: 0, width: W / 2 }) };
  return (
    <div style={{ position: "absolute", ...place, display: "flex", justifyContent: "center", top: g.portrait ? place.top : undefined }}>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: size,
          lineHeight: 1.15,
          paddingTop: size * 0.06,
          color: inkOn(color) === "#ffffff" ? "#ffffff" : NIGHT,
          transform: "skewX(-8deg)",
          whiteSpace: "nowrap",
          textShadow: `${8 * u}px ${8 * u}px 0 rgba(0,0,0,0.3)`,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const IntroPanels: React.FC<{
  g: Geo;
  frame: number;
  safe: { top: number; bottom: number; side: number };
  colors: [string, string];
  labels: [string | null, string | null];
}> = ({ g, frame, safe, colors, labels }) => {
  const out = introOut(frame);
  if (out >= 1) return null;
  const inP = ramp(frame, 0, CLASH_FRAME, EASE_IN);
  const flash = frame >= CLASH_FRAME ? 1 - ramp(frame, CLASH_FRAME, 10) : 0;
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {([0, 1] as const).map((s) => (
        <AbsoluteFill key={s} style={{ clipPath: sideClip(g, s) }}>
          <AbsoluteFill style={{ transform: `translateX(${(1 - inP) * (s === 0 ? -1 : 1) * g.W}px)` }}>
            <SolidSide color={colors[s]} label="" u={g.u} w={g.W} h={g.H} side={s} />
            {labels[s] ? <IntroLabel g={g} safe={safe} side={s} text={labels[s] as string} color={colors[s]} /> : null}
          </AbsoluteFill>
        </AbsoluteFill>
      ))}
      {flash > 0 ? <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: flash * 0.85 }} /> : null}
    </AbsoluteFill>
  );
};

export const IntroText: React.FC<{
  g: Geo;
  frame: number;
  safe: { top: number; bottom: number; side: number };
  cx: number;
  cy: number;
  title: string;
  subtitle: string;
  handle: string;
}> = ({ g, frame, safe, cx, cy, title, subtitle, handle }) => {
  const out = introOut(frame);
  if (out >= 1) return null;
  const { u, W, H, emblemR } = g;
  const textW = W - safe.side * 2;
  const titleText = upper(title);
  const titleFit = fitText(titleText, (g.portrait ? 92 : 80) * u, textW - 40 * u, 3, 0.64, 48 * u);
  const titleIn = ramp(frame, CLASH_FRAME + 6, 9);
  const subIn = ramp(frame, CLASH_FRAME + 14, 10);
  const handleIn = ramp(frame, CLASH_FRAME + 20, 10);
  const slab = (color: string): React.CSSProperties => ({
    backgroundColor: color,
    padding: `${4 * u}px ${18 * u}px`,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  });
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {/* Tiêu đề: đáy khối cách huy hiệu một khoảng, đè lên cả hai phe ở khung ngang. */}
      <div
        style={{
          position: "absolute",
          left: safe.side,
          width: textW,
          bottom: H - (cy - emblemR - 34 * u),
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          opacity: titleIn,
          transform: `scale(${1.35 - 0.35 * titleIn}) translateY(${-out * 40 * u}px)`,
        }}
      >
        <div
          style={{
            fontFamily: BODY,
            fontWeight: 900,
            fontSize: titleFit.size,
            lineHeight: 1.32,
            color: "#ffffff",
            maxWidth: textW,
          }}
        >
          <span style={slab(withAlpha(NIGHT, 0.9))}>{titleText}</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: safe.side,
          width: textW,
          top: cy + emblemR + 34 * u,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20 * u,
          textAlign: "center",
          transform: `translateY(${out * 40 * u}px)`,
        }}
      >
        {subtitle ? (
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 700,
              fontSize: fitText(subtitle, 44 * u, textW, 2, 0.56, 30 * u).size,
              lineHeight: 1.35,
              color: "#ffffff",
              opacity: subIn,
              transform: `translateY(${(1 - subIn) * 24 * u}px)`,
            }}
          >
            <span style={slab(withAlpha(NIGHT, 0.75))}>{subtitle}</span>
          </div>
        ) : null}
        {handle ? (
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 700,
              fontSize: 30 * u,
              color: "#ffffff",
              opacity: 0.9 * handleIn,
              textShadow: `0 ${2 * u}px ${10 * u}px rgba(0,0,0,0.8)`,
            }}
          >
            {handle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
