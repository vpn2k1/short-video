import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { FONTS, useLayout } from "../shared";
import type { Swatch } from "./palette";
import { chunkWords, fitChunks, LINE_HEIGHT, splitWords, WORD_FONT, WORD_GAP_EM, WORD_WEIGHT } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SNAP = Easing.bezier(0.16, 1, 0.3, 1);

/** Title card: từng từ tiêu đề đập xuống, phụ đề gõ chữ, rồi cả tấm cuốn lên. */
export const TitleIntro: React.FC<{ title: string; subtitle: string; handle: string; swatch: Swatch }> = ({
  title,
  subtitle,
  handle,
  swatch,
}) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit, portrait } = useLayout();
  if (frame >= TITLE_FRAMES) return null;

  const boxW = width - safe.side * 2;
  const boxH = (height - safe.top - safe.bottom) * (portrait ? 0.5 : 0.55);
  const chunks = chunkWords(splitWords(title, null));
  const size = fitChunks(chunks, boxW, boxH, (portrait ? 210 : 170) * unit, 40 * unit);

  const stagger = Math.min(5, 26 / Math.max(1, chunks.length));
  const lastAppear = 3 + (chunks.length - 1) * stagger;
  const subStart = lastAppear + 8;
  const subChars = [...subtitle.normalize("NFC")];
  const typeEnd = TITLE_FRAMES - 12;
  const typed = Math.floor(
    interpolate(frame, [subStart, Math.max(subStart + 1, Math.min(typeEnd, subStart + subChars.length / 1.3))], [0, subChars.length], clamp),
  );
  const cursorOn = Math.floor(frame / 4) % 2 === 0 || typed < subChars.length;

  // Thoát: tấm title cuốn lên từ đáy, lộ cảnh đầu phía dưới.
  const exit = interpolate(frame, [TITLE_FRAMES - 9, TITLE_FRAMES - 1], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.7, 0, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: swatch.bg, clipPath: `inset(0 0 ${exit * 100}% 0)` }}>
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
          gap: 40 * unit,
          translate: `0px ${-exit * 120 * unit}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            columnGap: WORD_GAP_EM * size,
            fontFamily: WORD_FONT,
            fontWeight: WORD_WEIGHT,
            fontSize: size,
            lineHeight: LINE_HEIGHT,
            color: swatch.fg,
          }}
        >
          {chunks.map((chunk, i) => {
            const t = frame - (3 + i * stagger);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  opacity: interpolate(t, [0, 2], [0, 1], clamp),
                  scale: interpolate(t, [0, 5, 8], [2.6, 0.93, 1], { ...clamp, easing: [SNAP, Easing.out(Easing.quad)] }),
                  rotate: `${interpolate(t, [0, 6], [i % 2 === 0 ? -8 : 7, 0], { ...clamp, easing: SNAP })}deg`,
                }}
              >
                {chunk.words[0].text}
              </span>
            );
          })}
        </div>

        {subtitle ? (
          <div style={{ minHeight: 70 * unit }}>
            <span
              style={{
                display: "inline",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                backgroundColor: typed > 0 ? swatch.hi : "transparent",
                color: swatch.hiFg,
                padding: `${4 * unit}px ${16 * unit}px`,
                fontFamily: FONTS.sans,
                fontWeight: 800,
                fontSize: (portrait ? 50 : 44) * unit,
                lineHeight: 1.5,
              }}
            >
              {subChars.slice(0, typed).join("")}
              <span style={{ opacity: cursorOn && frame >= subStart ? 1 : 0 }}>▌</span>
            </span>
          </div>
        ) : null}
      </div>

      {handle ? (
        <div
          style={{
            position: "absolute",
            left: safe.side,
            bottom: safe.bottom,
            fontFamily: FONTS.sans,
            fontWeight: 700,
            fontSize: 32 * unit,
            letterSpacing: "0.06em",
            color: swatch.fg,
            opacity: interpolate(frame, [subStart, subStart + 8], [0, 0.7], clamp),
          }}
        >
          {handle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
