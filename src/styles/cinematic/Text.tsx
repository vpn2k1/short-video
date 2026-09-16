import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, CaptionPosition, Scene } from "../../compositions/Short/schema";
import { fitFontSize, FONTS, useCaptionClock, useLayout, useSceneClock } from "../shared";
import {
  barHeight,
  clamp,
  EASE,
  isWide,
  PUNCH_HOLD,
  PUNCH_IN,
  PUNCH_OUT,
  punchPresence,
  sceneAppear,
  sceneFadeOut,
  upperVi,
} from "./cine";

const WHITE = "#f5f1e8";
const softShadow = (unit: number) =>
  `0 ${2 * unit}px ${6 * unit}px rgba(0,0,0,0.75), 0 0 ${28 * unit}px rgba(0,0,0,0.45)`;

/* -------------------------------------------------------------- captions */

/** Phụ đề serif, hoa thường tự nhiên, ngay trên viền đen dưới (hoặc giữa khung). */
export const CineCaptions: React.FC<{
  captions: Caption[];
  scenes: Scene[];
  position: CaptionPosition;
  showTitle: boolean;
}> = ({ captions, scenes, position, showTitle }) => {
  const frame = useCurrentFrame();
  const { caption, index, localFrame, durationFrames } = useCaptionClock(captions);
  const { unit, width, height, safe, captionBottom } = useLayout();
  if (!caption) return null;
  if (showTitle && frame < TITLE_FRAMES - 4) return null;

  const wide = isWide(width, height);
  const isLast = index === captions.length - 1;
  const fadeIn = interpolate(localFrame, [0, 10], [0, 1], { ...clamp, easing: EASE });
  const fadeOut = isLast ? interpolate(localFrame, [durationFrames + 6, durationFrames + 18], [1, 0], clamp) : 1;
  // Tiêu đề trailer đang giữ thì phụ đề nhường chỗ.
  const yieldToPunch = 1 - punchPresence(scenes, frame);
  const text = caption.text.normalize("NFC");
  const fontSize = Math.round(Math.max(wide ? 44 : 50, fitFontSize(text, wide ? 58 : 66, 0.75)) * unit);
  const maxWidth = wide ? Math.min(width * 0.64, width - safe.side * 2) : width - safe.side * 2;
  const bottom = Math.max(captionBottom, barHeight(width, height) + 44 * unit);

  const block = (
    <div
      style={{
        width: maxWidth,
        fontFamily: FONTS.serif,
        fontSize,
        lineHeight: 1.3,
        color: WHITE,
        textAlign: "center",
        textWrap: "balance",
        textShadow: softShadow(unit),
        opacity: fadeIn * fadeOut * yieldToPunch,
        translate: `0px ${(1 - fadeIn) * 16 * unit}px`,
      }}
    >
      {text}
    </div>
  );

  if (position === "center") {
    return <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>{block}</AbsoluteFill>;
  }
  return <div style={{ position: "absolute", left: (width - maxWidth) / 2, bottom }}>{block}</div>;
};

/* ------------------------------------------------------------------- tag */

/** Dòng chương/địa điểm "— HỘI AN, 2026": góc trên-trái trong khung hình, hiện sau đầu cảnh. */
export const ChapterTag: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  if (!scene?.tag) return null;
  const appear = sceneAppear(index, startFrame, showTitle, 14);
  if (frame < appear) return null;

  const wide = isWide(width, height);
  const t = interpolate(frame, [appear, appear + 22], [0, 1], { ...clamp, easing: EASE });
  const opacity =
    t * sceneFadeOut(frame, appear + 22, endFrame) * (1 - punchPresence(scenes, frame));
  const size = (wide ? 30 : 34) * unit;
  const top = Math.max(safe.top, barHeight(width, height)) + (wide ? 36 : 44) * unit;

  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top,
        maxWidth: width - safe.side * 2,
        opacity,
        translate: `${(1 - t) * -18 * unit}px 0px`,
        display: "flex",
        alignItems: "center",
        gap: 16 * unit,
        fontFamily: FONTS.serif,
        fontSize: size,
        color: "rgba(245,241,232,0.92)",
        textShadow: softShadow(unit),
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 44 * unit * t, height: Math.max(1, 1.5 * unit), backgroundColor: "rgba(245,241,232,0.85)" }} />
      <span>{upperVi(scene.tag)}</span>
    </div>
  );
};

/* ----------------------------------------------------------------- punch */

/** Tiêu đề trailer: hình tối lại, cụm từ serif lớn giữa khung, thu 1.04 → 1, giữ ~1.2 s. */
export const TrailerCard: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { unit, width, height, safe } = useLayout();
  const wide = isWide(width, height);

  const active = scenes.find((scene) => {
    if (!scene.punch) return false;
    const at = msToFrames(scene.punch.atMs);
    return frame >= at && frame <= at + PUNCH_IN + PUNCH_HOLD + PUNCH_OUT;
  });
  if (!active?.punch) return null;

  const at = msToFrames(active.punch.atMs);
  const total = PUNCH_IN + PUNCH_HOLD + PUNCH_OUT;
  const opacity = interpolate(
    frame,
    [at, at + PUNCH_IN, at + PUNCH_IN + PUNCH_HOLD, at + total],
    [0, 1, 1, 0],
    clamp,
  );
  const scale = interpolate(frame, [at, at + total], [1.04, 1], clamp);
  const rule = interpolate(frame, [at + 3, at + PUNCH_IN + 14], [0, 1], { ...clamp, easing: EASE });
  const text = upperVi(active.punch.text);
  const maxWidth = wide ? width * 0.7 : width - safe.side * 2;
  const fontSize = Math.round(fitFontSize(text, (wide ? 132 : 128) * unit, 0.5));

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity }}>
      <div
        style={{
          width: maxWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          scale: `${scale}`,
        }}
      >
        <div style={{ width: 120 * unit * rule, height: Math.max(1, 1.5 * unit), backgroundColor: "rgba(245,241,232,0.7)" }} />
        <div
          style={{
            marginTop: 38 * unit,
            marginBottom: 30 * unit,
            fontFamily: FONTS.serif,
            fontSize,
            lineHeight: 1.22,
            color: WHITE,
            textAlign: "center",
            textWrap: "balance",
            textShadow: `0 ${4 * unit}px ${30 * unit}px rgba(0,0,0,0.7)`,
          }}
        >
          {text}
        </div>
        <div style={{ width: 120 * unit * rule, height: Math.max(1, 1.5 * unit), backgroundColor: "rgba(245,241,232,0.7)" }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- visual */

/** stat: con số serif lớn nét mảnh + chú thích nghiêng; badge: thẻ chương "CHƯƠNG I" giữa khung. */
export const CineVisual: React.FC<{ scenes: Scene[]; showTitle: boolean; position: CaptionPosition }> = ({
  scenes,
  showTitle,
  position,
}) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  if (!scene?.visual) return null;
  const wide = isWide(width, height);
  const square = !wide && height / width < 1.2;
  const centered = position === "center";
  /** Mép trên vùng visual khi phụ đề nằm giữa: ngay dưới dòng tag. */
  const upperTop = Math.max(safe.top, barHeight(width, height)) + 110 * unit;
  const visual = scene.visual;
  const appear = sceneAppear(index, startFrame, showTitle, visual.type === "badge" ? 8 : 20);
  if (frame < appear) return null;

  const t = interpolate(frame, [appear, appear + 26], [0, 1], { ...clamp, easing: EASE });
  const yieldToPunch = 1 - punchPresence(scenes, frame);
  const text = visual.text.normalize("NFC");
  const caption = visual.caption?.normalize("NFC") ?? null;

  if (visual.type === "badge") {
    // Thẻ chương giữ ~2 s rồi lui, để lại khung hình cho phụ đề.
    const hold = interpolate(frame, [appear + 62, appear + 80], [1, 0], clamp);
    const opacity = t * hold * yieldToPunch * sceneFadeOut(frame, appear + 26, endFrame);
    if (opacity <= 0) return null;
    const size = fitFontSize(upperVi(text), (wide ? 66 : 70) * unit, 0.6);
    return (
      <AbsoluteFill
        style={{
          justifyContent: centered ? "flex-start" : "center",
          alignItems: "center",
          paddingTop: centered ? upperTop : 0,
          opacity,
        }}
      >
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: 0.35 }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            scale: `${1.03 - 0.03 * t}`,
            translate: `0px ${wide || centered ? 0 : -height * 0.04}px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 * unit }}>
            <div style={{ width: 70 * unit * t, height: Math.max(1, 1.5 * unit), backgroundColor: "rgba(245,241,232,0.75)" }} />
            <div style={{ fontFamily: FONTS.serif, fontSize: size, color: WHITE, textShadow: softShadow(unit), whiteSpace: "nowrap" }}>
              {upperVi(text)}
            </div>
            <div style={{ width: 70 * unit * t, height: Math.max(1, 1.5 * unit), backgroundColor: "rgba(245,241,232,0.75)" }} />
          </div>
          {caption ? (
            <div
              style={{
                marginTop: 20 * unit,
                fontFamily: FONTS.serif,
                fontStyle: "italic",
                fontSize: 40 * unit,
                color: "rgba(245,241,232,0.85)",
                textShadow: softShadow(unit),
              }}
            >
              {caption}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }

  const opacity = t * yieldToPunch * sceneFadeOut(frame, appear + 26, endFrame);
  // Phụ đề giữa khung thì con số lên trên (dưới tag) và nhỏ lại để không chồng phụ đề.
  const baseSize = centered ? (wide || square ? 150 : 260) : wide ? 250 : square ? 200 : 300;
  const numberSize = fitFontSize(text, baseSize * unit, 0.45);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: centered ? upperTop : wide ? height * 0.22 : height * 0.27,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.serif,
          fontWeight: 400,
          fontSize: numberSize,
          lineHeight: 1,
          // Georgia không có nét mảnh: làm "mảnh" bằng màu trong suốt nhẹ + viền sáng mảnh.
          color: "rgba(245,241,232,0.9)",
          textShadow: `0 ${6 * unit}px ${40 * unit}px rgba(0,0,0,0.55)`,
          scale: `${1.05 - 0.05 * t}`,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      {caption ? (
        <div
          style={{
            marginTop: 18 * unit,
            display: "flex",
            alignItems: "center",
            gap: 20 * unit,
            fontFamily: FONTS.serif,
            fontStyle: "italic",
            fontSize: 42 * unit,
            color: "rgba(245,241,232,0.88)",
            textShadow: softShadow(unit),
            opacity: interpolate(frame, [appear + 10, appear + 28], [0, 1], clamp),
          }}
        >
          <div style={{ width: 36 * unit, height: Math.max(1, 1.5 * unit), backgroundColor: "rgba(245,241,232,0.7)" }} />
          {caption}
          <div style={{ width: 36 * unit, height: Math.max(1, 1.5 * unit), backgroundColor: "rgba(245,241,232,0.7)" }} />
        </div>
      ) : null}
    </div>
  );
};

/* ----------------------------------------------------------------- title */

/** Mở đầu: màn đen, "@handle trình bày", tít serif hiện dần, phụ đề nghiêng, rồi mở vào hình. */
export const CineTitle: React.FC<{ title: string; subtitle: string; handle: string }> = ({ title, subtitle, handle }) => {
  const frame = useCurrentFrame();
  const { unit, width, height, safe } = useLayout();
  const wide = isWide(width, height);
  const black = interpolate(frame, [TITLE_FRAMES - 14, TITLE_FRAMES], [1, 0], clamp);
  const textOut = interpolate(frame, [TITLE_FRAMES - 20, TITLE_FRAMES - 8], [1, 0], clamp);
  const handleIn = interpolate(frame, [2, 16], [0, 1], { ...clamp, easing: EASE });
  const titleIn = interpolate(frame, [10, 34], [0, 1], { ...clamp, easing: EASE });
  const subIn = interpolate(frame, [22, 40], [0, 1], { ...clamp, easing: EASE });
  const text = title.normalize("NFC");
  const maxWidth = wide ? width * 0.66 : width - safe.side * 2;
  const titleSize = fitFontSize(text, (wide ? 104 : 112) * unit, 0.55);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: black }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: textOut }}>
        {handle ? (
          <div
            style={{
              fontFamily: FONTS.serif,
              fontStyle: "italic",
              fontSize: 32 * unit,
              color: "rgba(245,241,232,0.7)",
              marginBottom: 36 * unit,
              opacity: handleIn,
            }}
          >
            {`${handle.normalize("NFC")} trình bày`}
          </div>
        ) : null}
        <div
          style={{
            width: maxWidth,
            fontFamily: FONTS.serif,
            fontSize: titleSize,
            lineHeight: 1.15,
            color: WHITE,
            textAlign: "center",
            textWrap: "balance",
            opacity: titleIn,
            scale: `${1.03 - 0.03 * titleIn}`,
          }}
        >
          {text}
        </div>
        {subtitle ? (
          <>
            <div
              style={{
                marginTop: 36 * unit,
                width: 90 * unit * subIn,
                height: Math.max(1, 1.5 * unit),
                backgroundColor: "rgba(245,241,232,0.6)",
              }}
            />
            <div
              style={{
                marginTop: 26 * unit,
                maxWidth,
                fontFamily: FONTS.serif,
                fontStyle: "italic",
                fontSize: 40 * unit,
                lineHeight: 1.3,
                color: "rgba(245,241,232,0.82)",
                textAlign: "center",
                opacity: subIn,
              }}
            >
              {subtitle.normalize("NFC")}
            </div>
          </>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
