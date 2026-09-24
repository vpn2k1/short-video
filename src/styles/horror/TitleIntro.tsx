import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { fitFontSize, FONTS, seeded, useLayout } from "../shared";
import { Dust, Fog } from "./Atmos";
import { BLOOD, BLOOD_GLOW, BONE, clamp, EASE, isWide, NIGHT } from "./look";
import { useVt } from "../../i18n/video";

/**
 * Mở đầu: bóng tối có sương, dòng "— Chuyện có thật? —" mờ, tiêu đề hiện dần ra khỏi bóng tối
 * kèm vài nhịp chập chờn, dòng phụ đỏ máu. Cuối cùng cả khung tan vào cảnh đầu.
 * Đặt trong <Sequence durationInFrames={TITLE_FRAMES}>.
 */
export const HorrorTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const { unit, width, height, safe } = useLayout();
  const wide = isWide(width, height);

  const titleText = title.normalize("NFC");
  const showSub = Boolean(subtitle) && subtitle.normalize("NFC") !== titleText;
  const titleSize = fitFontSize(titleText, (wide ? 104 : 108) * unit, 0.5);
  const maxWidth = wide ? width * 0.68 : width - safe.side * 2;

  const kicker = interpolate(frame, [2, 16], [0, 0.7], clamp);
  // Tiêu đề: lên dần 8→34, vài frame bốc thăm tối sụp như đèn chập.
  const rise = interpolate(frame, [8, 34], [0, 1], { ...clamp, easing: EASE });
  const dip = frame >= 10 && frame < 40 && seeded(`hz-title-${frame}`) < 0.2 ? 0.3 : 1;
  const blur = interpolate(frame, [8, 30], [10, 0], clamp) * unit;
  const subIn = interpolate(frame, [30, 42], [0, 1], { ...clamp, easing: EASE });
  const out = interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES], [1, 0], { ...clamp, easing: EASE });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill
        style={{
          backgroundColor: NIGHT,
          backgroundImage: "radial-gradient(ellipse 70% 50% at 50% 46%, rgba(40,58,52,0.55) 0%, rgba(4,7,6,0) 70%)",
        }}
      />
      <Fog strength={0.9} />
      <Dust />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: `0 ${safe.side}px` }}>
        <div
          style={{
            fontFamily: FONTS.lora,
            fontStyle: "italic",
            fontSize: (wide ? 30 : 34) * unit,
            color: BONE,
            opacity: kicker,
            marginBottom: 34 * unit,
            textShadow: `0 0 ${14 * unit}px rgba(0,0,0,0.9)`,
          }}
        >
          {vt("— Chuyện có thật? —")}
        </div>
        <div
          style={{
            maxWidth,
            fontFamily: FONTS.playfair,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.16,
            color: BONE,
            textAlign: "center",
            textWrap: "balance",
            opacity: rise * dip,
            filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
            scale: `${interpolate(frame, [8, TITLE_FRAMES], [1.04, 1], clamp)}`,
            textShadow: `0 ${3 * unit}px ${6 * unit}px rgba(0,0,0,0.95), 0 0 ${40 * unit}px rgba(150,180,170,0.18)`,
          }}
        >
          {titleText}
        </div>
        {showSub ? (
          <div
            style={{
              marginTop: 34 * unit,
              maxWidth,
              fontFamily: FONTS.lora,
              fontWeight: 600,
              fontStyle: "italic",
              fontSize: (wide ? 40 : 44) * unit,
              lineHeight: 1.3,
              color: BLOOD,
              textAlign: "center",
              textWrap: "balance",
              opacity: subIn,
              textShadow: `0 ${2 * unit}px ${4 * unit}px rgba(0,0,0,0.95), 0 0 ${18 * unit}px ${BLOOD_GLOW}`,
            }}
          >
            {subtitle.normalize("NFC")}
          </div>
        ) : null}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 80% 65% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.9) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
