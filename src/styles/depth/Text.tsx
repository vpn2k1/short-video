import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { parseStat } from "../retro/vhs";
import { punchRange, upperVi } from "../neon/neon";
import { activeIndexAt, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { BODY, clamp, easeOut, extrude, HEAVY, rim, type Palette } from "./depth";
import { Cube } from "./Space";
import { arriveAt, usePanelBox, useShape } from "./Stage";

/** Frame phần tử của cảnh được phép hiện: đợi tấm kính bay tới gần xong. */
const shownFrom = (scene: Scene, index: number, showTitle: boolean, delay: number) =>
  arriveAt(scene, index, showTitle) + delay;

/* -------------------------------------------------------------- phụ đề */

/**
 * Phụ đề chữ khối trắng, thành màu tối của accent. Mỗi câu mới lật lên từ dưới (rotateX -75° → 0) có nảy,
 * như tấm biển dựng đứng dậy. Cụm nhấn đổi mặt chữ sang màu nhấn khi giọng đọc tới nó.
 */
export const DepthCaptions: React.FC<{
  captions: Caption[];
  scenes: Scene[];
  position: "bottom" | "center";
  showTitle: boolean;
  palette: Palette;
}> = ({ captions, scenes, position, showTitle, palette }) => {
  const frame = useCurrentFrame();
  const { caption, startFrame } = useCaptionClock(captions);
  const { unit, safe, width, height, fps, captionBottom } = useLayout();
  const { wide, square } = useShape();
  if (!caption || (showTitle && frame < TITLE_FRAMES)) return null;

  const text = caption.text.normalize("NFC");
  const length = [...text].length;
  const base = (wide ? 60 : square ? 58 : 68) * unit;
  const fontSize = Math.round(base * (length <= 24 ? 1 : Math.max(0.66, Math.sqrt(24 / length))));

  const onAt = showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;
  const pop = spring({ frame: frame - onAt, fps, config: { damping: 13, mass: 0.6 } });
  const sceneIndex = activeIndexAt(scenes, startFrame);
  const punch = sceneIndex >= 0 ? scenes[sceneIndex]?.punch : null;
  const range = punch && frame >= msToFrames(punch.atMs) ? punchRange(text, punch.text) : null;
  const parts = range
    ? [
        { text: text.slice(0, range[0]), hot: false },
        { text: text.slice(range[0], range[1]), hot: true },
        { text: text.slice(range[1]), hot: false },
      ].filter((p) => p.text.length > 0)
    : [{ text, hot: false }];

  const boxWidth = wide ? width * 0.72 : width - safe.side * 2 + 40 * unit;
  const placement: React.CSSProperties =
    position === "center" ? { top: height / 2, translate: "0 -50%" } : { bottom: captionBottom - (wide ? 0 : 10 * unit) };

  return (
    <div
      style={{
        position: "absolute",
        left: (width - boxWidth) / 2,
        width: boxWidth,
        display: "flex",
        justifyContent: "center",
        perspective: 900 * unit,
        ...placement,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 800,
          fontSize,
          lineHeight: 1.3,
          textAlign: "center",
          textWrap: "balance",
          color: "#ffffff",
          WebkitTextStroke: rim(fontSize),
          textShadow: extrude(palette.side, fontSize, 7),
          transformOrigin: "50% 100%",
          transform: `rotateX(${interpolate(pop, [0, 1], [-75, 0])}deg) translateY(${interpolate(pop, [0, 1], [30 * unit, 0])}px)`,
          opacity: interpolate(pop, [0, 0.3], [0, 1], clamp),
        }}
      >
        {parts.map((p, i) => (
          <span key={i} style={p.hot ? { color: palette.key } : undefined}>
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- punch */

/**
 * Câu nhấn: khối chữ in hoa lớn màu nhấn, thành dày, lật từ nằm ngang (rotateX 90°) và lao từ sâu ra trước tấm kính,
 * nảy khi dừng rồi xoay qua lại rất chậm. Sau lưng một tấm bảng kính tối để đọc được trên ảnh.
 */
export const DepthPunch: React.FC<{
  scenes: Scene[];
  captionPosition: "bottom" | "center";
  showTitle: boolean;
  palette: Palette;
}> = ({ scenes, captionPosition, showTitle, palette }) => {
  const { frame, scene, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe, fps } = useLayout();
  const { wide, square } = useShape();
  if (!scene?.punch) return null;
  const at = Math.max(msToFrames(scene.punch.atMs), showTitle ? TITLE_FRAMES : 0);
  const end = Math.max(endFrame, at + 40);
  const local = frame - at;
  if (local < 0 || frame >= end) return null;

  const fly = spring({ frame: local, fps, config: { damping: 11, mass: 0.8 } });
  const out = interpolate(frame, [end - 8, end], [1, 0], clamp);
  const text = upperVi(scene.punch.text.trim());
  const length = [...text].length;
  const base = (wide ? 100 : square ? 92 : 112) * unit;
  const fontSize = Math.round(base * (length <= 10 ? 1 : Math.max(0.45, Math.sqrt(10 / length))));
  const maxWidth = wide ? width * 0.55 : width - safe.side * 2 + 60 * unit;
  const hasVisual = Boolean(scene.visual);
  const centerY = captionPosition === "center"
    ? height * (hasVisual ? 0.72 : 0.28)
    : height * (hasVisual ? (wide ? 0.55 : 0.5) : 0.4);
  const sway = Math.sin(local / 30) * 6 * fly;

  return (
    <AbsoluteFill style={{ perspective: 1100 * unit, perspectiveOrigin: `50% ${centerY}px` }}>
      <div
        style={{
          position: "absolute",
          left: (width - maxWidth) / 2,
          width: maxWidth,
          top: centerY,
          translate: "0 -50%",
          display: "flex",
          justifyContent: "center",
          transformStyle: "preserve-3d",
          transform: `translateZ(${interpolate(fly, [0, 1], [-900 * unit, 60 * unit])}px) rotateX(${interpolate(fly, [0, 1], [90, 0])}deg) rotateY(${sway}deg)`,
          opacity: interpolate(fly, [0, 0.15], [0, 1], clamp) * out,
        }}
      >
        <div
          style={{
            padding: `${18 * unit}px ${40 * unit}px ${30 * unit}px`,
            borderRadius: 26 * unit,
            background: `linear-gradient(160deg, rgba(10,10,28,0.72), hsla(${palette.hue}, 60%, 12%, 0.72))`,
            border: `${2 * unit}px solid ${palette.glow(0.7)}`,
            boxShadow: `0 0 ${50 * unit}px ${palette.glow(0.45)}, 0 ${24 * unit}px ${60 * unit}px rgba(0,0,0,0.55)`,
          }}
        >
          <div
            style={{
              fontFamily: HEAVY,
              fontWeight: 900,
              fontSize,
              lineHeight: 1.12,
              textAlign: "center",
              textWrap: "balance",
              color: palette.key,
              WebkitTextStroke: rim(fontSize),
              textShadow: extrude(palette.side, fontSize, 10, 0.7),
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- tag */

/** Nhãn cảnh ở góc trái trên: khối lập phương nhỏ xoay liên tục + chữ khối in hoa trượt ra từ sau khối. */
export const DepthTag: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({ scenes, showTitle, palette }) => {
  const { frame, scene, index } = useSceneClock(scenes);
  const { unit, safe, fps } = useLayout();
  const { wide } = useShape();
  if (!scene?.tag) return null;
  const on = shownFrom(scene, index, showTitle, 10);
  if (frame < on) return null;
  const pop = spring({ frame: frame - on, fps, config: { damping: 14, mass: 0.6 } });
  const slide = interpolate(frame - on, [4, 18], [0, 1], easeOut);
  const size = (wide ? 32 : 36) * unit;
  const cube = size * 1.5;
  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top + 14 * unit,
        display: "flex",
        alignItems: "center",
        gap: 22 * unit,
        perspective: 600 * unit,
      }}
    >
      <div style={{ width: cube, height: cube, scale: String(pop), transformStyle: "preserve-3d" }}>
        <Cube size={cube} rotateX={-20} rotateY={frame * 2.2} palette={palette} />
      </div>
      <div
        style={{
          fontFamily: HEAVY,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          color: "#ffffff",
          WebkitTextStroke: rim(size),
          textShadow: extrude(palette.side, size, 5),
          clipPath: `inset(-40% ${(1 - slide) * 100}% -60% -10%)`,
          translate: `${interpolate(slide, [0, 1], [-30 * unit, 0])}px 0`,
        }}
      >
        {upperVi(scene.tag)}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- visual */

/**
 * Số liệu: con số khối cỡ lớn lật vào rồi đếm lên, chú thích bên dưới. Nhãn (badge): chữ khối in hoa trên tấm
 * kính màu nhấn nghiêng 3D. Dọc/vuông: phía trên tấm ảnh; ngang: cột trái.
 */
export const DepthVisual: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({ scenes, showTitle, palette }) => {
  const { frame, scene, index, endFrame } = useSceneClock(scenes);
  const { unit, safe, width, height, fps } = useLayout();
  const { wide, square } = useShape();
  const panel = usePanelBox(scene);
  if (!scene?.visual) return null;
  const on = shownFrom(scene, index, showTitle, 14);
  if (frame < on) return null;
  const local = frame - on;
  const end = Math.max(endFrame, on + 30);
  if (frame >= end) return null;
  const pop = spring({ frame: local, fps, config: { damping: 12, mass: 0.7 } });
  const out = interpolate(frame, [end - 8, end], [1, 0], clamp);

  const visual = scene.visual;
  const boxWidth = wide ? width * 0.26 : width - safe.side * 2;
  const tagRoom = scene.tag ? 100 * unit : 10 * unit;
  const box: React.CSSProperties = wide
    ? { left: safe.side, top: Math.max(height * 0.2, safe.top + tagRoom + 20 * unit), width: boxWidth }
    : { left: (width - boxWidth) / 2, top: Math.max(safe.top + tagRoom, panel.cy - panel.h / 2 - (square ? 120 : 170) * unit), width: boxWidth };
  const flip = `rotateX(${interpolate(pop, [0, 1], [-80, 0])}deg)`;
  const captionText = visual.caption ? visual.caption.normalize("NFC") : null;
  const captionSize = (wide || square ? 34 : 40) * unit;
  const captionEl = captionText ? (
    <div
      style={{
        fontFamily: BODY,
        fontWeight: 700,
        fontSize: captionSize,
        lineHeight: 1.3,
        textAlign: "center",
        textWrap: "balance",
        color: "#eef0ff",
        textShadow: `0 ${3 * unit}px ${10 * unit}px rgba(0,0,0,0.85)`,
        opacity: interpolate(local, [10, 20], [0, 1], clamp),
      }}
    >
      {captionText}
    </div>
  ) : null;

  if (visual.type === "badge") {
    const size = (wide ? 50 : square ? 52 : 60) * unit;
    return (
      <div style={{ position: "absolute", ...box, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * unit, perspective: 800 * unit, opacity: out }}>
        <div
          style={{
            transform: `${flip} rotateY(${Math.sin(frame / 40) * 10}deg)`,
            padding: `${12 * unit}px ${36 * unit}px ${18 * unit}px`,
            borderRadius: 20 * unit,
            background: `linear-gradient(150deg, ${palette.key}, ${palette.side})`,
            boxShadow: `0 ${10 * unit}px 0 ${palette.side}, 0 ${24 * unit}px ${40 * unit}px rgba(0,0,0,0.55), 0 0 ${40 * unit}px ${palette.glow(0.4)}`,
          }}
        >
          <div style={{ fontFamily: HEAVY, fontWeight: 900, fontSize: size, lineHeight: 1.2, whiteSpace: "nowrap", color: "#fff", textShadow: extrude("rgba(0,0,0,0.35)", size, 4, 0.3) }}>
            {upperVi(visual.text)}
          </div>
        </div>
        {captionEl}
      </div>
    );
  }

  const text = visual.text.normalize("NFC");
  const parsed = parseStat(text);
  const progress = interpolate(local, [6, 36], [0, 1], easeOut);
  const shown = parsed ? `${parsed.prefix}${parsed.format(parsed.value * progress)}${parsed.suffix}` : text;
  const maxSize = (wide ? 160 : square ? 150 : 190) * unit;
  // Montserrat 900: mỗi ký tự ~0.78em.
  const numberSize = Math.min(maxSize, boxWidth / (Math.max(2, [...text].length) * 0.78));

  return (
    <div style={{ position: "absolute", ...box, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 * unit, perspective: 900 * unit, opacity: out }}>
      <div
        style={{
          display: "grid",
          fontFamily: HEAVY,
          fontWeight: 900,
          fontSize: numberSize,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          transform: `${flip} rotateY(${Math.sin(frame / 45) * 8}deg)`,
        }}
      >
        {/* Chuỗi cuối (ẩn) giữ bề rộng; số đang đếm canh giữa cùng ô nên không nhảy. */}
        <span style={{ gridArea: "1 / 1", visibility: "hidden" }}>{text}</span>
        <span
          style={{
            gridArea: "1 / 1",
            textAlign: "center",
            color: palette.key,
            WebkitTextStroke: rim(numberSize),
            textShadow: extrude(palette.side, numberSize, 12, 0.7),
          }}
        >
          {shown}
        </span>
      </div>
      {captionEl}
    </div>
  );
};
