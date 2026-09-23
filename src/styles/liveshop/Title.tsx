import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { Avatar } from "./Chrome";
import { alpha, clamp, fitLines, LIVE_RED, NUM, POP, shade, SLAM, SMOOTH, UI, type Geo } from "./live";

/** Mốc của màn chờ: mỗi số đếm lùi đứng 11 frame, rồi "LIVE" đập xuống. */
const COUNT_AT = 22;
const COUNT_STEP = 11;
const LIVE_AT = COUNT_AT + COUNT_STEP * 3;

/**
 * Màn chờ phiên live (khi `showTitle`): nền tối ngả accent đè lên cảnh đầu, ảnh đại diện chủ phòng có hai vòng đỏ
 * toả ra, tiêu đề phiên live chữ đậm, dòng phụ thành viên thuốc, rồi "Bắt đầu sau 3 · 2 · 1" — số
 * Montserrat nảy từng nhịp — và nhãn LIVE đỏ đập xuống. 8 frame cuối cả màn phóng nhẹ và mờ đi để lộ giao diện live.
 */
export const LiveTitle: React.FC<{ geo: Geo; title: string; subtitle: string; accent: string; ready: boolean }> = ({
  geo,
  title,
  subtitle,
  accent,
  ready,
}) => {
  const frame = useCurrentFrame();
  const { u, width, height, wide, square } = geo;
  const out = interpolate(frame, [TITLE_FRAMES - 8, TITLE_FRAMES], [0, 1], { ...clamp, easing: SMOOTH });
  const avatarIn = interpolate(frame, [0, 14], [0, 1], { ...clamp, easing: POP });
  const titleIn = interpolate(frame, [6, 18], [0, 1], { ...clamp, easing: SMOOTH });
  const subIn = interpolate(frame, [12, 22], [0, 1], { ...clamp, easing: SMOOTH });
  const avatar = (wide ? 150 : square ? 150 : 200) * u;
  const textW = wide ? width * 0.62 : width - 120 * u;
  const cleanTitle = title.normalize("NFC").trim();
  const { size: titleSize } = fitLines(cleanTitle, (wide ? 76 : 84) * u, 46 * u, textW, 3, UI, 900, ready);
  const chips = subtitle
    .normalize("NFC")
    .split(/\s*[·|•]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const step = frame < COUNT_AT ? -1 : Math.floor((frame - COUNT_AT) / COUNT_STEP);
  const counting = step >= 0 && step < 3;
  const inStep = counting ? frame - COUNT_AT - step * COUNT_STEP : 0;
  const numPop = interpolate(inStep, [0, 7], [1.7, 1], { ...clamp, easing: POP });
  const numFade = interpolate(inStep, [0, 3, COUNT_STEP - 2, COUNT_STEP], [0, 1, 1, 0.2], clamp);
  const live = interpolate(frame, [LIVE_AT, LIVE_AT + 10], [0, 1], { ...clamp, easing: SLAM });
  const ring = (k: number) => ((frame + k * 16) % 32) / 32;

  return (
    <AbsoluteFill style={{ opacity: 1 - out, scale: String(1 + out * 0.06), fontFamily: UI }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at 50% 36%, ${alpha(accent, 0.55)} 0%, transparent 55%)`,
            `linear-gradient(180deg, ${alpha(shade(accent, -0.75), 0.9)} 0%, rgba(12,10,18,0.94) 100%)`,
          ].join(", "),
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 * u, width: textW, translate: `0px ${-height * 0.03}px` }}>
          <div style={{ position: "relative", width: avatar, height: avatar, scale: String(avatarIn) }}>
            {[0, 1].map((k) => (
              <div
                key={k}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `${5 * u}px solid ${LIVE_RED}`,
                  scale: String(1 + ring(k) * 0.55),
                  opacity: 1 - ring(k),
                }}
              />
            ))}
            <div style={{ position: "absolute", inset: -8 * u, borderRadius: "50%", border: `${6 * u}px solid ${LIVE_RED}` }} />
            <Avatar accent={accent} size={avatar} ring={5 * u} />
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: -20 * u,
                translate: "-50% 0px",
                padding: `${4 * u}px ${16 * u}px`,
                borderRadius: 10 * u,
                backgroundColor: LIVE_RED,
                color: "#fff",
                fontWeight: 900,
                fontSize: 26 * u,
                letterSpacing: 2 * u,
                border: `${3 * u}px solid #fff`,
                whiteSpace: "nowrap",
              }}
            >
              {live > 0 ? "LIVE" : "SẮP LIVE"}
            </div>
          </div>
          <div
            style={{
              marginTop: 18 * u,
              fontWeight: 900,
              fontSize: titleSize,
              lineHeight: 1.2,
              color: "#fff",
              textAlign: "center",
              textWrap: "balance",
              opacity: titleIn,
              translate: `0px ${(1 - titleIn) * 24 * u}px`,
              textShadow: `0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.45)`,
            }}
          >
            {cleanTitle}
          </div>
          {chips.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 * u, opacity: subIn }}>
              {chips.map((chip, i) => (
                <div
                  key={i}
                  style={{
                    padding: `${8 * u}px ${22 * u}px`,
                    borderRadius: 999,
                    backgroundColor: i === 0 ? "#fff" : "rgba(255,255,255,0.16)",
                    color: i === 0 ? LIVE_RED : "#fff",
                    fontWeight: 800,
                    fontSize: 30 * u,
                    lineHeight: 1.3,
                    border: `${2 * u}px solid rgba(255,255,255,0.5)`,
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ height: 150 * u, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 * u }}>
            {counting ? (
              <>
                <span style={{ fontWeight: 700, fontSize: 32 * u, color: "rgba(255,255,255,0.8)" }}>Bắt đầu sau</span>
                <span
                  style={{
                    fontFamily: NUM,
                    fontWeight: 900,
                    fontSize: 120 * u,
                    lineHeight: 1,
                    color: "#fff",
                    scale: String(numPop),
                    opacity: numFade,
                    textShadow: `0 0 ${30 * u}px ${alpha(accent, 0.9)}`,
                    display: "inline-block",
                    minWidth: 80 * u,
                    textAlign: "center",
                  }}
                >
                  {3 - step}
                </span>
              </>
            ) : live > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16 * u,
                  padding: `${14 * u}px ${40 * u}px`,
                  borderRadius: 20 * u,
                  background: `linear-gradient(90deg, ${LIVE_RED}, #ff5a3c)`,
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 64 * u,
                  letterSpacing: 4 * u,
                  scale: String(interpolate(live, [0, 1], [2, 1])),
                  opacity: Math.min(1, live * 2),
                  boxShadow: `0 ${10 * u}px ${40 * u}px ${alpha(LIVE_RED, 0.6)}`,
                }}
              >
                <div style={{ width: 24 * u, height: 24 * u, borderRadius: "50%", backgroundColor: "#fff" }} />
                LIVE
              </div>
            ) : null}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
