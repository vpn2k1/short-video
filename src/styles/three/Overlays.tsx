import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { arriveAt, usePanelBox, useShape } from "../depth/Stage";
import { punchRange, upperVi } from "../neon/neon";
import { parseStat } from "../retro/vhs";
import { activeIndexAt, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { clamp, easeOut, SANS, type Palette } from "./three";

/**
 * Chữ mạ crôm: gradient bạc – trắng – màu nhấn tô vào nét chữ, vệt sáng quét ngang theo `shine` (0..1),
 * bóng đổ mềm bằng drop-shadow (text-shadow không dùng được với chữ tô gradient).
 */
const chrome = (palette: Palette, shine: number): React.CSSProperties => ({
  backgroundImage: [
    `linear-gradient(105deg, transparent ${shine * 130 - 30}%, rgba(255,255,255,0.95) ${shine * 130 - 18}%, transparent ${shine * 130 - 6}%)`,
    `linear-gradient(180deg, #ffffff 0%, #dfe6f2 38%, ${palette.key} 62%, #f4f7ff 100%)`,
  ].join(", "),
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
  // Viền tối mảnh: mặt crôm trắng bạc biến mất trên ảnh nền sáng (ảnh sản phẩm nền trắng) nếu không có nó.
  WebkitTextStroke: `0.025em hsla(${palette.hue}, 55%, 12%, 0.85)`,
  filter: `drop-shadow(0 6px 0 hsla(${palette.hue}, 60%, 18%, 0.9)) drop-shadow(0 18px 28px rgba(0,0,0,0.55))`,
});

/** Kính mờ: nền tối trong, làm nhoè canvas phía sau, viền sáng mảnh, ánh màu nhấn. */
const glass = (palette: Palette, unit: number): React.CSSProperties => ({
  background: "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 45%, rgba(10,12,24,0.35))",
  backdropFilter: `blur(${18 * unit}px) saturate(1.4)`,
  WebkitBackdropFilter: `blur(${18 * unit}px) saturate(1.4)`,
  border: `${1.5 * unit}px solid rgba(255,255,255,0.28)`,
  boxShadow: `0 ${18 * unit}px ${50 * unit}px rgba(0,0,0,0.45), inset 0 ${1.5 * unit}px 0 rgba(255,255,255,0.35), 0 0 ${40 * unit}px ${palette.glow(0.18)}`,
});

/* -------------------------------------------------------------- phụ đề */

/**
 * Phụ đề trắng trên tấm kính mờ bo tròn. Mỗi câu mới nổi lên (scale 0.9 → 1, nhoè → nét). Cụm nhấn đổi sang
 * màu nhấn khi giọng đọc tới nó.
 */
export const ThreeCaptions: React.FC<{
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
  const base = (wide ? 52 : square ? 52 : 60) * unit;
  const fontSize = Math.round(base * (length <= 26 ? 1 : Math.max(0.7, Math.sqrt(26 / length))));
  const onAt = showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;
  const pop = spring({ frame: frame - onAt, fps, config: { damping: 16, mass: 0.6 } });
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

  const boxWidth = wide ? width * 0.68 : width - safe.side * 2 + 40 * unit;
  const placement: React.CSSProperties =
    position === "center" ? { top: height / 2, translate: "0 -50%" } : { bottom: captionBottom - (wide ? 0 : 10 * unit) };

  return (
    <div style={{ position: "absolute", left: (width - boxWidth) / 2, width: boxWidth, display: "flex", justifyContent: "center", ...placement }}>
      <div
        style={{
          ...glass(palette, unit),
          borderRadius: 30 * unit,
          padding: `${16 * unit}px ${32 * unit}px ${18 * unit}px`,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize,
          lineHeight: 1.32,
          textAlign: "center",
          textWrap: "balance",
          color: "#ffffff",
          textShadow: `0 ${2 * unit}px ${8 * unit}px rgba(0,0,0,0.5)`,
          scale: String(interpolate(pop, [0, 1], [0.9, 1])),
          opacity: interpolate(pop, [0, 0.4], [0, 1], clamp),
          filter: `blur(${interpolate(pop, [0, 0.6], [8 * unit, 0], clamp)}px)`,
        }}
      >
        {parts.map((p, i) => (
          <span key={i} style={p.hot ? { color: palette.key, fontWeight: 800 } : undefined}>
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- punch */

/**
 * Câu nhấn: chữ crôm in hoa cỡ lớn, lao ra từ nhoè (scale 1.7 → 1), một vệt sáng quét qua mặt chữ, nghiêng 3D
 * nhẹ theo nhịp. Nằm trước tấm ảnh.
 */
export const ThreePunch: React.FC<{
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

  const hit = spring({ frame: local, fps, config: { damping: 12, mass: 0.7 } });
  const out = interpolate(frame, [end - 8, end], [1, 0], clamp);
  const shine = interpolate(local, [6, 30], [0, 1], clamp);
  const text = upperVi(scene.punch.text.trim());
  const length = [...text].length;
  const base = (wide ? 104 : square ? 96 : 116) * unit;
  const fontSize = Math.round(base * (length <= 10 ? 1 : Math.max(0.45, Math.sqrt(10 / length))));
  const maxWidth = wide ? width * 0.6 : width - safe.side * 2 + 60 * unit;
  const hasVisual = Boolean(scene.visual);
  const centerY = captionPosition === "center"
    ? height * (hasVisual ? 0.72 : 0.28)
    : height * (hasVisual ? (wide ? 0.56 : 0.5) : 0.42);

  return (
    <AbsoluteFill style={{ perspective: 1000 * unit }}>
      {/* Vùng tối mềm sau chữ — đọc được cả khi tấm ảnh phía sau rất sáng. */}
      <div
        style={{
          position: "absolute",
          left: (width - maxWidth * 1.2) / 2,
          width: maxWidth * 1.2,
          top: centerY - fontSize * 1.9,
          height: fontSize * 3.8,
          background: "radial-gradient(closest-side, rgba(4,6,14,0.62), rgba(4,6,14,0.3) 60%, transparent)",
          opacity: interpolate(hit, [0, 0.5], [0, 1], clamp) * out,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: (width - maxWidth) / 2,
          width: maxWidth,
          top: centerY,
          translate: "0 -50%",
          textAlign: "center",
          textWrap: "balance",
          transform: `rotateX(${Math.sin(local / 26) * 6}deg) rotateY(${Math.sin(local / 34) * 9}deg)`,
          scale: String(interpolate(hit, [0, 1], [1.7, 1])),
          opacity: interpolate(hit, [0, 0.3], [0, 1], clamp) * out,
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize,
            lineHeight: 1.12,
            ...chrome(palette, shine),
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- tag */

/** Nhãn cảnh: viên kính mờ ở góc trái trên, chấm sáng màu nhấn, chữ in hoa — trượt vào khi tấm ảnh tới. */
export const ThreeTag: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({ scenes, showTitle, palette }) => {
  const { frame, scene, index } = useSceneClock(scenes);
  const { unit, safe, fps } = useLayout();
  const { wide } = useShape();
  if (!scene?.tag) return null;
  const on = arriveAt(scene, index, showTitle) + 12;
  if (frame < on) return null;
  const slide = spring({ frame: frame - on, fps, config: { damping: 16 } });
  const size = (wide ? 28 : 32) * unit;
  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top + 14 * unit,
        display: "flex",
        alignItems: "center",
        gap: 14 * unit,
        padding: `${10 * unit}px ${26 * unit}px ${10 * unit}px ${18 * unit}px`,
        borderRadius: 999,
        ...glass(palette, unit),
        translate: `${interpolate(slide, [0, 1], [-60 * unit, 0])}px 0`,
        opacity: slide,
      }}
    >
      <div
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: 999,
          background: `radial-gradient(circle at 35% 30%, #ffffff, ${palette.key} 55%, hsl(${palette.hue}, 70%, 25%))`,
          boxShadow: `0 0 ${14 * unit}px ${palette.glow(0.8)}`,
        }}
      />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1.2, whiteSpace: "nowrap", color: "#ffffff" }}>
        {upperVi(scene.tag)}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- visual */

/**
 * Số liệu: con số crôm cỡ lớn đếm lên, vệt sáng quét qua, chú thích trên kính mờ. Nhãn: chữ in hoa trên viên kính
 * có viền màu nhấn. Dọc/vuông: phía trên tấm ảnh; ngang: cột trái (tấm ảnh dời sang phải).
 */
export const ThreeVisual: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({ scenes, showTitle, palette }) => {
  const { frame, scene, index, endFrame } = useSceneClock(scenes);
  const { unit, safe, width, height, fps } = useLayout();
  const { wide, square } = useShape();
  const panel = usePanelBox(scene);
  if (!scene?.visual) return null;
  const on = arriveAt(scene, index, showTitle) + 16;
  if (frame < on) return null;
  const local = frame - on;
  const end = Math.max(endFrame, on + 30);
  if (frame >= end) return null;
  const pop = spring({ frame: local, fps, config: { damping: 13, mass: 0.7 } });
  const out = interpolate(frame, [end - 8, end], [1, 0], clamp);

  const visual = scene.visual;
  const boxWidth = wide ? width * 0.26 : width - safe.side * 2;
  const tagRoom = scene.tag ? 100 * unit : 10 * unit;
  const box: React.CSSProperties = wide
    ? { left: safe.side, top: Math.max(height * 0.22, safe.top + tagRoom + 20 * unit), width: boxWidth }
    : { left: (width - boxWidth) / 2, top: Math.max(safe.top + tagRoom, panel.cy - panel.h / 2 - (square ? 120 : 170) * unit), width: boxWidth };
  const captionText = visual.caption ? visual.caption.normalize("NFC") : null;
  const captionSize = (wide || square ? 30 : 36) * unit;
  const captionEl = captionText ? (
    <div
      style={{
        ...glass(palette, unit),
        borderRadius: 999,
        padding: `${6 * unit}px ${20 * unit}px`,
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: captionSize,
        lineHeight: 1.3,
        textAlign: "center",
        color: "#eef2ff",
        opacity: interpolate(local, [10, 20], [0, 1], clamp),
      }}
    >
      {captionText}
    </div>
  ) : null;
  const wrap: React.CSSProperties = {
    position: "absolute",
    ...box,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12 * unit,
    opacity: out * interpolate(pop, [0, 0.3], [0, 1], clamp),
    scale: String(interpolate(pop, [0, 1], [0.7, 1])),
  };

  if (visual.type === "badge") {
    const size = (wide ? 46 : square ? 48 : 56) * unit;
    return (
      <div style={wrap}>
        <div
          style={{
            ...glass(palette, unit),
            border: `${2.5 * unit}px solid ${palette.key}`,
            borderRadius: 22 * unit,
            padding: `${10 * unit}px ${34 * unit}px`,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            color: "#ffffff",
          }}
        >
          {upperVi(visual.text)}
        </div>
        {captionEl}
      </div>
    );
  }

  const text = visual.text.normalize("NFC");
  const parsed = parseStat(text);
  const progress = interpolate(local, [6, 36], [0, 1], easeOut);
  const shown = parsed ? `${parsed.prefix}${parsed.format(parsed.value * progress)}${parsed.suffix}` : text;
  const maxSize = (wide ? 150 : square ? 140 : 180) * unit;
  // Lexend 900: mỗi ký tự ~0.72em.
  const numberSize = Math.min(maxSize, boxWidth / (Math.max(2, [...text].length) * 0.72));
  return (
    <div style={wrap}>
      <div style={{ display: "grid", fontFamily: SANS, fontWeight: 900, fontSize: numberSize, lineHeight: 1.1, whiteSpace: "nowrap" }}>
        <span style={{ gridArea: "1 / 1", visibility: "hidden" }}>{text}</span>
        <span style={{ gridArea: "1 / 1", textAlign: "center", ...chrome(palette, interpolate(local, [20, 44], [0, 1], clamp)) }}>{shown}</span>
      </div>
      {captionEl}
    </div>
  );
};
