import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { FONTS, useLayout } from "../shared";
import { fitWords, GAP_EM, LINE_HEIGHT, outlineShadow, splitWords, WORD_FONT, WORD_WEIGHT, YELLOW } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SNAP = Easing.bezier(0.16, 1, 0.3, 1);
/** Đệm ngang của thanh highlight (mỗi bên), theo em. */
const BAR_PAD_EM = 0.14;

/**
 * Title card: tiêu đề in hoa cỡ lớn bật từng từ, thanh vàng quét sau từ cuối,
 * phụ đề trượt lên; co lại và tắt trong 10 frame cuối — trước khi phụ đề chạy.
 */
export const TitleIntro: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit, portrait } = useLayout();
  if (frame >= TITLE_FRAMES) return null;

  const words = splitWords(title, null);
  if (words.length === 0) return null;
  const boxW = width - safe.side * 2;
  const lastIndex = words.length - 1;
  const size = fitWords(
    words.map((w, i) => ({ text: w.text, punch: i === lastIndex })),
    boxW,
    3,
    (portrait ? 150 : 130) * unit,
    56 * unit,
  );

  const stagger = Math.min(3, 18 / words.length);
  const lastAppear = 2 + lastIndex * stagger;
  const bar = interpolate(frame, [lastAppear + 3, lastAppear + 9], [0, 1], { ...clamp, easing: SNAP });
  const subStart = lastAppear + 8;
  const exit = interpolate(frame, [TITLE_FRAMES - 10, TITLE_FRAMES - 2], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  const showSub = subtitle.trim() !== "" && subtitle.normalize("NFC").trim().toLocaleLowerCase("vi") !== title.normalize("NFC").trim().toLocaleLowerCase("vi");
  const subSize = (portrait ? 48 : 42) * unit;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: 0.5 * (1 - exit) }} />
      <div
        style={{
          position: "absolute",
          left: safe.side,
          top: safe.top,
          width: boxW,
          height: height - safe.top - safe.bottom,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 36 * unit,
          opacity: 1 - exit,
          scale: 1 - exit * 0.12,
        }}
      >
        <div
          style={{
            width: boxW,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            columnGap: GAP_EM * size,
            fontFamily: WORD_FONT,
            fontWeight: WORD_WEIGHT,
            fontSize: size,
            lineHeight: LINE_HEIGHT,
            color: "#ffffff",
          }}
        >
          {words.map((w, i) => {
            const t = frame - (2 + i * stagger);
            const isLast = i === lastIndex;
            return (
              <span
                key={i}
                style={{
                  position: "relative",
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  marginLeft: isLast ? `${BAR_PAD_EM}em` : 0,
                  marginRight: isLast ? `${BAR_PAD_EM}em` : 0,
                  opacity: interpolate(t, [0, 1], [0, 1], clamp),
                  scale: interpolate(t, [0, 3, 6], [0.6, 1.08, 1], { ...clamp, easing: [SNAP, Easing.inOut(Easing.quad)] }),
                  transformOrigin: "50% 65%",
                }}
              >
                {isLast ? (
                  <span
                    style={{
                      position: "absolute",
                      left: `-${BAR_PAD_EM}em`,
                      right: `-${BAR_PAD_EM}em`,
                      top: "0.08em",
                      bottom: "0.02em",
                      backgroundColor: YELLOW,
                      borderRadius: 0.08 * size,
                      boxShadow: `0 ${0.08 * size}px ${0.16 * size}px rgba(0,0,0,0.5)`,
                      scale: `${bar} 1`,
                      transformOrigin: "0% 50%",
                      rotate: "-2deg",
                    }}
                  />
                ) : null}
                <span
                  style={{
                    position: "relative",
                    color: isLast && bar > 0.5 ? "#000000" : "#ffffff",
                    textShadow: isLast && bar > 0.5 ? "none" : outlineShadow(size),
                  }}
                >
                  {w.text}
                </span>
              </span>
            );
          })}
        </div>

        {showSub ? (
          <div
            style={{
              maxWidth: boxW,
              textAlign: "center",
              fontFamily: FONTS.sans,
              fontWeight: 800,
              fontSize: subSize,
              lineHeight: 1.3,
              color: "#ffffff",
              textShadow: outlineShadow(subSize * 0.7),
              opacity: interpolate(frame, [subStart, subStart + 4], [0, 1], clamp),
              translate: `0px ${interpolate(frame, [subStart, subStart + 8], [30 * unit, 0], { ...clamp, easing: SNAP })}px`,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
