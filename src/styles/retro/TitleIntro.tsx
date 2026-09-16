import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { fitFontSize, FONTS, useLayout } from "../shared";
import { osdShadow, osdSize } from "./Osd";
import { BLUE_SCREEN, clamp, glyphs, OSD_WHITE } from "./vhs";

/**
 * Mở đầu: màn hình xanh của đầu video, "▶ PLAY" nháy, tiêu đề gõ chữ, bộ đếm băng chạy.
 * Cú nhiễu chuyển sang hình nằm ở VhsLook (burst tại TITLE_FRAMES).
 * Đặt trong <Sequence durationInFrames={TITLE_FRAMES}>.
 */
export const RetroTitle: React.FC<{ title: string; subtitle: string; handle: string }> = ({ title, subtitle, handle }) => {
  const frame = useCurrentFrame();
  const { unit, safe, width, height, fps } = useLayout();
  const wide = width / height > 1.2;
  const size = osdSize(unit);

  // 0–2: đen, sau đó bật xanh.
  const on = interpolate(frame, [0, 3], [0, 1], clamp);
  const titleChars = glyphs(title);
  const typed = Math.min(titleChars.length, Math.max(0, Math.floor((frame - 8) / 1.1)));
  const subIn = interpolate(frame, [30, 38], [0, 1], clamp);
  const playOn = frame < 8 || Math.floor(frame / 15) % 2 === 0;
  const seconds = Math.floor(frame / fps);
  const counter = `0:00:${String(seconds).padStart(2, "0")}`;
  const titleText = titleChars.join("");
  const titleSize = fitFontSize(titleText, (wide ? 104 : 112) * unit, 0.45);
  const showSub = subtitle && subtitle.normalize("NFC") !== titleText;
  const out = interpolate(frame, [TITLE_FRAMES - 3, TITLE_FRAMES], [1, 0.4], clamp);

  const osd: React.CSSProperties = {
    position: "absolute",
    fontFamily: FONTS.mono,
    fontSize: size,
    lineHeight: 1.15,
    color: OSD_WHITE,
    textShadow: osdShadow(unit),
    whiteSpace: "nowrap",
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: out }}>
      <AbsoluteFill
        style={{
          opacity: on,
          backgroundColor: BLUE_SCREEN,
          backgroundImage: "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(80,110,255,0.35) 0%, rgba(0,0,40,0.25) 100%)",
        }}
      >
        <div style={{ ...osd, left: safe.side, top: safe.top + 14 * unit, opacity: playOn ? 1 : 0 }}>▶ PLAY</div>
        <div style={{ ...osd, right: safe.side, top: safe.top + 14 * unit }}>SP</div>
        <div style={{ ...osd, left: safe.side, bottom: safe.bottom + 14 * unit, fontSize: size * 0.9 }}>{counter}</div>

        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: `0 ${safe.side}px`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 800,
              fontSize: titleSize,
              lineHeight: 1.15,
              color: OSD_WHITE,
              textAlign: "center",
              textWrap: "balance",
              maxWidth: wide ? width * 0.7 : width - safe.side * 2,
              textShadow: `${-3 * unit}px 0 rgba(255,50,80,0.55), ${3 * unit}px 0 rgba(0,230,255,0.55), 0 0 ${14 * unit}px rgba(255,255,255,0.35)`,
            }}
          >
            {titleChars.slice(0, typed).join("")}
            <span style={{ color: "transparent", textShadow: "none" }}>{titleChars.slice(typed).join("")}</span>
          </div>
          {showSub ? (
            <div
              style={{
                marginTop: 30 * unit,
                fontFamily: FONTS.sans,
                fontWeight: 600,
                fontSize: 44 * unit,
                lineHeight: 1.25,
                color: OSD_WHITE,
                textAlign: "center",
                textWrap: "balance",
                opacity: subIn,
                maxWidth: wide ? width * 0.6 : width - safe.side * 2,
                textShadow: osdShadow(unit),
              }}
            >
              {subtitle.normalize("NFC")}
            </div>
          ) : null}
          {handle ? (
            <div
              style={{
                marginTop: 26 * unit,
                fontFamily: FONTS.mono,
                fontSize: 32 * unit,
                color: "rgba(244,246,255,0.8)",
                opacity: subIn,
                textShadow: osdShadow(unit),
              }}
            >
              {handle}
            </div>
          ) : null}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
