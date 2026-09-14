import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { fitFontSize, FONTS, seeded, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { Static } from "./Noise";
import { osdShadow, osdSize } from "./Osd";
import { clamp, glyphs, osdFont, OSD_WHITE, parseStat, SUB_YELLOW, upperVi } from "./vhs";

/** Bóng chữ lệch màu đỏ/xanh như tín hiệu analog. */
const rgbShadow = (d: number, alpha = 0.6) =>
  `${-d}px 0 rgba(255,40,70,${alpha}), ${d}px 0 rgba(0,225,255,${alpha})`;

/* -------------------------------------------------------------- phụ đề */

/**
 * Phụ đề TV cũ: chữ vàng trên hộp đen trong suốt. Hộp mở ra như một dòng quét
 * (3 frame) rồi chữ gõ vào. Phần chưa gõ vẫn chiếm chỗ (trong suốt) nên dòng không nhảy.
 */
export const RetroCaptions: React.FC<{
  captions: Caption[];
  position: "bottom" | "center";
  showTitle: boolean;
}> = ({ captions, position, showTitle }) => {
  const frame = useCurrentFrame();
  const { caption, index, localFrame, durationFrames } = useCaptionClock(captions);
  const { unit, safe, width, height, captionBottom } = useLayout();
  if (!caption || (showTitle && frame < TITLE_FRAMES)) return null;

  const wide = width / height > 1.2;
  const chars = glyphs(caption.text);
  const text = chars.join("");
  const typeFrames = Math.min(12, Math.max(4, Math.round(durationFrames * 0.35)));
  const typed = Math.min(chars.length, Math.ceil((chars.length * (localFrame + 1)) / typeFrames));
  const open = interpolate(localFrame, [0, 3], [0.08, 1], clamp);
  const isLast = index === captions.length - 1;
  const fadeOut = isLast ? interpolate(localFrame, [durationFrames + 6, durationFrames + 14], [1, 0], clamp) : 1;
  const fontSize = Math.max((wide ? 42 : 48) * unit, fitFontSize(text, (wide ? 58 : 66) * unit, 0.5));
  const maxWidth = wide ? Math.min(width * 0.62, width - safe.side * 2) : width - safe.side * 2;

  const placement: React.CSSProperties =
    position === "center" ? { top: height / 2, translate: "0px -50%" } : { bottom: captionBottom };

  return (
    <div
      style={{
        position: "absolute",
        left: (width - maxWidth) / 2,
        width: maxWidth,
        display: "flex",
        justifyContent: "center",
        opacity: fadeOut,
        ...placement,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.66)",
          padding: `${12 * unit}px ${26 * unit}px`,
          scale: `1 ${open}`,
          fontFamily: FONTS.sans,
          fontWeight: 700,
          fontSize,
          lineHeight: 1.3,
          color: SUB_YELLOW,
          textAlign: "center",
          textWrap: "balance",
          textShadow: rgbShadow(2 * unit, 0.55),
        }}
      >
        {chars.slice(0, typed).join("")}
        <span style={{ color: "transparent", textShadow: "none" }}>{chars.slice(typed).join("")}</span>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- punch */

/** Số frame cụm punch đứng trên màn hình. */
const PUNCH_FRAMES = 32;

/** Cú giật tín hiệu: chớp nhiễu, cụm từ cỡ lớn giữa khung, bóng đỏ/xanh lệch mạnh và rung. */
export const RetroPunch: React.FC<{ scenes: Scene[]; captionPosition: "bottom" | "center" }> = ({
  scenes,
  captionPosition,
}) => {
  const { frame, scene, index } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  if (!scene?.punch) return null;
  const at = msToFrames(scene.punch.atMs);
  const local = frame - at;
  if (local < 0 || local >= PUNCH_FRAMES) return null;

  const wide = width / height > 1.2;
  const square = !wide && height / width < 1.2;
  const text = scene.punch.text.normalize("NFC");
  const fontSize = fitFontSize(text, (wide ? 120 : square ? 104 : 132) * unit, 0.42);
  const shaky = local < 10 ? 1 : 0.25;
  const jx = seeded(`retro-punch-x-${index}-${Math.floor(frame / 2)}`, -9, 9) * unit * shaky;
  const jy = seeded(`retro-punch-y-${index}-${Math.floor(frame / 2)}`, -3, 3) * unit * shaky;
  const split = interpolate(local, [0, 8, PUNCH_FRAMES], [18, 7, 5], clamp) * unit;
  const skew = local < 6 && seeded(`retro-punch-sk-${index}-${frame}`) > 0.5 ? seeded(`retro-punch-skv-${frame}`, -12, 12) : 0;
  const opacity = interpolate(local, [0, 1, PUNCH_FRAMES - 4, PUNCH_FRAMES], [0.6, 1, 1, 0], clamp);
  const scale = interpolate(local, [0, 4], [1.25, 1], clamp);
  const maxWidth = wide ? width * 0.7 : width - safe.side * 2;
  // Phụ đề đang ở giữa khung → đẩy punch lên phần ba trên.
  const centerY = captionPosition === "center" ? height * (square ? 0.34 : 0.32) : height * 0.47;

  return (
    <>
      {local < 3 ? (
        <AbsoluteFill style={{ backgroundColor: `rgba(255,255,255,${0.22 - local * 0.07})` }}>
          <Static id="punch" seed={frame % 9} opacity={0.45 - local * 0.12} frequency="0.6 0.9" />
        </AbsoluteFill>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: (width - maxWidth) / 2,
          width: maxWidth,
          top: centerY,
          translate: `${jx}px calc(-50% + ${jy}px)`,
          display: "flex",
          justifyContent: "center",
          opacity,
          scale: `${scale}`,
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.45)",
            padding: `${10 * unit}px ${30 * unit}px`,
            fontFamily: FONTS.sans,
            fontWeight: 900,
            fontSize,
            lineHeight: 1.18,
            color: "#ffffff",
            textAlign: "center",
            textWrap: "balance",
            transform: `skewX(${skew}deg)`,
            textShadow: `${rgbShadow(split, 0.9)}, 0 0 ${24 * unit}px rgba(255,255,255,0.35)`,
          }}
        >
          {text}
        </div>
      </div>
    </>
  );
};

/* -------------------------------------------------------------- visual */

/** Số liệu kiểu bộ đếm băng VCR (đếm lên) hoặc nhãn "VIDEO 1" nền xanh. */
export const RetroVisual: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  if (!scene?.visual) return null;
  const appear = index === 0 && showTitle ? TITLE_FRAMES + 8 : startFrame + 8;
  if (frame < appear) return null;

  const wide = width / height > 1.2;
  const square = !wide && height / width < 1.2;
  const visual = scene.visual;
  const local = frame - appear;
  // Tắt 4 frame trước cảnh sau (cú nhiễu che phần còn lại).
  const fade = interpolate(frame, [Math.max(appear + 1, endFrame - 6), Math.max(appear + 2, endFrame - 2)], [1, 0], clamp);
  const flicker = local < 4 ? (local % 2 === 0 ? 0.4 : 1) : 1;
  const osdTop = safe.top + 14 * unit;
  const tagRoom = scene.tag ? osdSize(unit) * 2.6 : osdSize(unit) * 1.5;
  const captionText = visual.caption ? visual.caption.normalize("NFC") : null;

  if (visual.type === "badge") {
    const text = upperVi(visual.text);
    const size = 46 * unit;
    return (
      <div
        style={{
          position: "absolute",
          right: safe.side,
          top: osdTop + osdSize(unit) * 1.5,
          opacity: fade * flicker,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10 * unit,
        }}
      >
        <div
          style={{
            backgroundColor: "#2446e8",
            border: `${Math.max(2, 3 * unit)}px solid rgba(255,255,255,0.9)`,
            padding: `${6 * unit}px ${22 * unit}px`,
            fontFamily: osdFont(text),
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.2,
            color: OSD_WHITE,
            textShadow: rgbShadow(1.5 * unit, 0.5),
            boxShadow: `${4 * unit}px ${4 * unit}px 0 rgba(0,0,0,0.6)`,
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
        {captionText ? (
          <div
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 600,
              fontSize: size * 0.62,
              color: OSD_WHITE,
              textShadow: osdShadow(unit),
              maxWidth: width * 0.45,
              textAlign: "right",
            }}
          >
            {captionText}
          </div>
        ) : null}
      </div>
    );
  }

  const text = visual.text.normalize("NFC");
  const parsed = parseStat(text);
  const progress = interpolate(local, [0, 36], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const shown = parsed ? `${parsed.prefix}${parsed.format(parsed.value * progress)}${parsed.suffix}` : text;
  const boxWidth = wide ? width * 0.42 : width - safe.side * 2;
  const maxSize = (wide ? 170 : square ? 140 : 200) * unit;
  // Mono: mỗi ký tự ~0.6em. Hậu tố có dấu (triệu) đi font sans nhưng ước lượng như nhau.
  const numberSize = Math.min(maxSize, (boxWidth - 40 * unit) / (Math.max(3, [...text].length) * 0.62));
  const top = wide ? height * 0.3 : osdTop + tagRoom + 20 * unit;

  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top,
        width: boxWidth,
        opacity: fade * flicker,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8 * unit,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 30 * unit,
          color: OSD_WHITE,
          textShadow: osdShadow(unit),
          whiteSpace: "nowrap",
        }}
      >
        {progress < 1 ? "▶▶ COUNTER" : "■ COUNTER"}
      </div>
      <div
        style={{
          display: "grid",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: `${4 * unit}px ${20 * unit}px`,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: numberSize,
          lineHeight: 1.1,
          color: OSD_WHITE,
          whiteSpace: "nowrap",
          textShadow: `${rgbShadow(3 * unit, 0.7)}, 0 0 ${16 * unit}px rgba(255,255,255,0.45)`,
        }}
      >
        {/* Chuỗi cuối (ẩn) giữ bề rộng hộp; số đang đếm canh phải trong cùng ô. */}
        <span style={{ gridArea: "1 / 1", visibility: "hidden" }}>
          <StatText value={text} />
        </span>
        <span style={{ gridArea: "1 / 1", textAlign: "right" }}>
          <StatText value={shown} />
        </span>
      </div>
      {captionText ? (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontWeight: 700,
            fontSize: (wide || square ? 34 : 40) * unit,
            lineHeight: 1.25,
            color: OSD_WHITE,
            textShadow: osdShadow(unit),
            opacity: interpolate(local, [10, 16], [0, 1], clamp),
          }}
        >
          {captionText}
        </div>
      ) : null}
    </div>
  );
};

/** Phần ASCII đi mono, phần có dấu (vd "triệu") đi sans để không lệch nét. */
const StatText: React.FC<{ value: string }> = ({ value }) => {
  const parts = value.match(/[\x20-\x7E]+|[^\x20-\x7E]+/g) ?? [];
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} style={{ fontFamily: osdFont(part) }}>
          {part}
        </span>
      ))}
    </>
  );
};
