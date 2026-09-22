import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { activeIndexAt, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { parseStat } from "../retro/vhs";
import {
  clamp,
  core,
  deadTube,
  flicker,
  hum,
  neon,
  powerOff,
  punchRange,
  SCRIPT,
  textGlow,
  TUBE,
  tubeBorder,
  upperVi,
  type Palette,
} from "./neon";

/** Khung hình là ngang (16:9, 2:1) hay vuông (1:1, 3:4). */
const useShape = () => {
  const { width, height } = useLayout();
  const wide = width / height > 1.2;
  return { wide, square: !wide && height / width < 1.45 };
};

/** Frame đầu tiên phần tử của cảnh được phép sáng: cảnh đầu phải đợi màn hình tiêu đề tắt. */
const litFrom = (index: number, startFrame: number, showTitle: boolean) =>
  index <= 0 && showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;

/* -------------------------------------------------------------- phụ đề */

/**
 * Phụ đề là chữ ống neon màu chính: lõi trắng nóng, quầng nhiều lớp. Mỗi câu mới "bật công tắc" —
 * chập chờn 10 frame rồi sáng hẳn. Dưới chữ sáng luôn có một bản "ống tắt" mờ nên lúc chập chờn
 * vẫn thấy hình chữ như biển hiệu thật. Cụm nhấn của cảnh đổi sang màu ống phụ khi giọng đọc tới nó.
 */
export const NeonCaptions: React.FC<{
  captions: Caption[];
  scenes: Scene[];
  position: "bottom" | "center";
  showTitle: boolean;
  palette: Palette;
}> = ({ captions, scenes, position, showTitle, palette }) => {
  const frame = useCurrentFrame();
  const { caption, index, startFrame } = useCaptionClock(captions);
  const { unit, safe, width, height, captionBottom } = useLayout();
  const { wide, square } = useShape();
  if (!caption || (showTitle && frame < TITLE_FRAMES)) return null;

  const text = caption.text.normalize("NFC");
  const length = [...text].length;
  const base = (wide ? 62 : square ? 60 : 72) * unit;
  const fontSize = Math.round(base * (length <= 22 ? 1 : Math.max(0.66, Math.sqrt(22 / length))));

  // Câu bắt đầu khi title còn chiếu: đếm nhấp nháy từ lúc title tắt.
  const onAt = showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;
  const key = `neon-cap-${index}`;
  const isLast = index === captions.length - 1;
  const offAt = isLast ? msToFrames(caption.endMs) + 18 : Number.MAX_SAFE_INTEGER;
  const lit = flicker(frame - onAt, key, 10) * hum(frame, `neon-cap`) * powerOff(frame, offAt, key);
  if (frame >= offAt) return null;

  // Cụm nhấn của cảnh chứa câu này (cảnh tính theo lúc câu bắt đầu).
  const sceneIndex = activeIndexAt(scenes, startFrame);
  const punch = sceneIndex >= 0 ? scenes[sceneIndex]?.punch : null;
  const range = punch && frame >= msToFrames(punch.atMs) ? punchRange(text, punch.text) : null;
  const parts: { text: string; hue: number }[] = range
    ? [
        { text: text.slice(0, range[0]), hue: palette.primary },
        { text: text.slice(range[0], range[1]), hue: palette.secondary },
        { text: text.slice(range[1]), hue: palette.primary },
      ].filter((p) => p.text.length > 0)
    : [{ text, hue: palette.primary }];

  const boxWidth = wide ? width * 0.7 : width - safe.side * 2;
  const placement: React.CSSProperties =
    position === "center"
      ? { top: height / 2, translate: "0 -50%" }
      : { bottom: captionBottom - (wide ? 0 : 20 * unit) };
  const common: React.CSSProperties = {
    gridArea: "1 / 1",
    fontFamily: TUBE,
    fontWeight: 700,
    fontSize,
    lineHeight: 1.32,
    textAlign: "center",
    textWrap: "balance",
  };

  return (
    <div
      style={{
        position: "absolute",
        left: (width - boxWidth) / 2,
        width: boxWidth,
        display: "flex",
        justifyContent: "center",
        ...placement,
      }}
    >
      <div style={{ position: "relative", display: "grid", padding: `${14 * unit}px ${26 * unit}px` }}>
        {/* Mảng tối mềm sau chữ để đọc được trên ảnh sáng. */}
        <div
          style={{
            position: "absolute",
            inset: `${-30 * unit}px ${-50 * unit}px`,
            background: "radial-gradient(closest-side, rgba(4,2,12,0.72), rgba(4,2,12,0.45) 60%, transparent)",
          }}
        />
        <div style={{ ...common, position: "relative", color: deadTube(palette.primary) }}>{text}</div>
        <div style={{ ...common, position: "relative", opacity: lit }}>
          {parts.map((p, i) => (
            <span key={i} style={{ color: core(p.hue), textShadow: textGlow(p.hue, fontSize, lit) }}>
              {p.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- punch */

/**
 * Câu nhấn: biển hiệu neon chữ viết liền màu ống phụ, khung ống bo tròn. Đúng `atMs` biển "rè" lên —
 * chập chờn 16 frame rồi sáng đều, hơi nghiêng như treo trên tường; sáng tới hết cảnh rồi chớp tắt.
 */
export const NeonPunch: React.FC<{
  scenes: Scene[];
  captionPosition: "bottom" | "center";
  showTitle: boolean;
  palette: Palette;
}> = ({ scenes, captionPosition, showTitle, palette }) => {
  const { frame, scene, index, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  const { wide, square } = useShape();
  if (!scene?.punch) return null;
  const at = Math.max(msToFrames(scene.punch.atMs), showTitle ? TITLE_FRAMES : 0);
  const end = Math.max(endFrame, at + 40);
  const local = frame - at;
  if (local < 0 || frame >= end) return null;

  const key = `neon-punch-${index}`;
  const lit = flicker(local, key, 16) * hum(frame, key) * powerOff(frame, end, key);
  const hue = palette.secondary;
  const text = scene.punch.text.normalize("NFC").trim();
  const length = [...text].length;
  const base = (wide ? 92 : square ? 84 : 100) * unit;
  const fontSize = Math.round(base * (length <= 12 ? 1 : Math.max(0.5, Math.sqrt(12 / length))));
  const maxWidth = wide ? width * 0.5 : width - safe.side * 2;

  const hasVisual = Boolean(scene.visual);
  let centerY: number;
  if (wide) centerY = height * (captionPosition === "center" ? 0.24 : 0.42);
  else if (captionPosition === "center") centerY = height * (hasVisual ? 0.73 : 0.3);
  else centerY = height * (hasVisual ? (square ? 0.52 : 0.5) : 0.4);
  const centerX = wide && hasVisual ? width * 0.62 : width / 2;
  const tilt = index % 2 === 0 ? -3 : 2.5;

  return (
    <AbsoluteFill>
      {/* Ánh biển hiệu hắt lên xung quanh. */}
      <div
        style={{
          position: "absolute",
          left: centerX - maxWidth * 0.75,
          top: centerY - fontSize * 2.2,
          width: maxWidth * 1.5,
          height: fontSize * 4.4,
          background: `radial-gradient(closest-side, ${neon(hue, 50, 0.32 * lit)}, transparent)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: centerX - maxWidth / 2,
          width: maxWidth,
          top: centerY,
          translate: "0 -50%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            rotate: `${tilt}deg`,
            borderRadius: 34 * unit,
            padding: `${14 * unit}px ${44 * unit}px ${22 * unit}px`,
            backgroundColor: "rgba(8,4,18,0.62)",
            ...tubeBorder(hue, unit, 5, lit),
          }}
        >
          <div
            style={{
              fontFamily: SCRIPT,
              fontWeight: 400,
              fontSize,
              lineHeight: 1.45,
              textAlign: "center",
              textWrap: "balance",
              color: lit > 0.3 ? core(hue) : deadTube(hue),
              textShadow: lit > 0.3 ? textGlow(hue, fontSize, lit) : "none",
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

/**
 * Nhãn cảnh: biển neon nhỏ kiểu "OPEN" ở góc trái trên — ống bo tròn màu chính, chấm đèn màu phụ,
 * chữ in hoa. Bật (chập chờn) lúc vào cảnh, thỉnh thoảng sụt sáng một frame.
 */
export const NeonTag: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({
  scenes,
  showTitle,
  palette,
}) => {
  const { frame, scene, index, startFrame } = useSceneClock(scenes);
  const { unit, safe } = useLayout();
  const { wide } = useShape();
  if (!scene?.tag) return null;
  const on = litFrom(index, startFrame, showTitle) + 4;
  if (frame < on) return null;
  const key = `neon-tag-${index}`;
  const lit = flicker(frame - on, key, 12) * hum(frame, key);
  const size = (wide ? 30 : 34) * unit;
  const text = upperVi(scene.tag);
  const hue = palette.primary;
  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top + 18 * unit,
        display: "flex",
        alignItems: "center",
        gap: 14 * unit,
        borderRadius: 999,
        padding: `${10 * unit}px ${28 * unit}px ${10 * unit}px ${22 * unit}px`,
        backgroundColor: "rgba(8,4,18,0.55)",
        ...tubeBorder(hue, unit, 3.5, lit),
      }}
    >
      <div
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: 999,
          backgroundColor: lit > 0.3 ? core(palette.secondary) : deadTube(palette.secondary),
          boxShadow: `0 0 ${8 * unit}px ${neon(palette.secondary, 60, lit)}, 0 0 ${18 * unit}px ${neon(palette.secondary, 50, 0.7 * lit)}`,
        }}
      />
      <div
        style={{
          fontFamily: TUBE,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          color: lit > 0.3 ? core(hue) : deadTube(hue),
          textShadow: lit > 0.3 ? textGlow(hue, size, lit) : "none",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- visual */

/**
 * Số liệu: con số neon cỡ lớn đếm lên, gạch ống màu phụ, chú thích trắng bên dưới.
 * Nhãn (badge): chữ in hoa trong khung ống chữ nhật bo góc. Dọc/vuông: giữa phía trên; ngang: cột trái.
 */
export const NeonVisual: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({
  scenes,
  showTitle,
  palette,
}) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, safe, width, height } = useLayout();
  const { wide, square } = useShape();
  if (!scene?.visual) return null;
  const on = litFrom(index, startFrame, showTitle) + 8;
  if (frame < on) return null;
  const local = frame - on;
  const key = `neon-vis-${index}`;
  const end = Math.max(endFrame, on + 30);
  const lit = flicker(local, key, 12) * hum(frame, key) * powerOff(frame, end, key);
  if (frame >= end) return null;

  const visual = scene.visual;
  const hue = palette.primary;
  const boxWidth = wide ? width * 0.3 : width - safe.side * 2;
  const tagRoom = scene.tag ? 110 * unit : 20 * unit;
  const box: React.CSSProperties = wide
    ? { left: safe.side, top: Math.max(height * 0.16, safe.top + tagRoom + 16 * unit), width: boxWidth }
    : { left: (width - boxWidth) / 2, top: safe.top + tagRoom + (square ? 0 : 30 * unit), width: boxWidth };
  const captionText = visual.caption ? visual.caption.normalize("NFC") : null;
  const captionSize = (wide || square ? 36 : 42) * unit;
  const captionEl = captionText ? (
    <div
      style={{
        fontFamily: TUBE,
        fontWeight: 700,
        fontSize: captionSize,
        lineHeight: 1.3,
        textAlign: "center",
        textWrap: "balance",
        color: "#f6f2ff",
        textShadow: `0 0 ${10 * unit}px rgba(0,0,0,0.9), 0 0 ${18 * unit}px ${neon(hue, 50, 0.45)}`,
        opacity: interpolate(local, [12, 20], [0, 1], clamp),
      }}
    >
      {captionText}
    </div>
  ) : null;

  if (visual.type === "badge") {
    const text = upperVi(visual.text);
    const size = (wide ? 52 : square ? 54 : 62) * unit;
    return (
      <div style={{ position: "absolute", ...box, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 * unit }}>
        <div
          style={{
            borderRadius: 22 * unit,
            padding: `${12 * unit}px ${38 * unit}px`,
            backgroundColor: "rgba(8,4,18,0.55)",
            ...tubeBorder(hue, unit, 4.5, lit),
          }}
        >
          <div
            style={{
              fontFamily: TUBE,
              fontWeight: 700,
              fontSize: size,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              color: lit > 0.3 ? core(hue) : deadTube(hue),
              textShadow: lit > 0.3 ? textGlow(hue, size, lit) : "none",
            }}
          >
            {text}
          </div>
        </div>
        {captionEl}
      </div>
    );
  }

  const text = visual.text.normalize("NFC");
  const parsed = parseStat(text);
  const progress = interpolate(local, [4, 34], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const shown = parsed ? `${parsed.prefix}${parsed.format(parsed.value * progress)}${parsed.suffix}` : text;
  const maxSize = (wide ? 170 : square ? 160 : 210) * unit;
  // Comfortaa đậm: mỗi ký tự ~0.72em.
  const numberSize = Math.min(maxSize, boxWidth / (Math.max(2, [...text].length) * 0.72));

  return (
    <div style={{ position: "absolute", ...box, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * unit }}>
      <div
        style={{
          display: "grid",
          fontFamily: TUBE,
          fontWeight: 700,
          fontSize: numberSize,
          lineHeight: 1.15,
          whiteSpace: "nowrap",
        }}
      >
        {/* Chuỗi cuối (ẩn) giữ bề rộng; số đang đếm canh giữa cùng ô nên không nhảy. */}
        <span style={{ gridArea: "1 / 1", color: deadTube(hue) }}>{text}</span>
        <span
          style={{
            gridArea: "1 / 1",
            textAlign: "center",
            opacity: lit,
            color: core(hue),
            textShadow: textGlow(hue, numberSize * 0.8, lit),
          }}
        >
          {shown}
        </span>
      </div>
      <div
        style={{
          width: Math.min(boxWidth * 0.5, 320 * unit),
          height: 6 * unit,
          borderRadius: 999,
          backgroundColor: lit > 0.3 ? core(palette.secondary) : deadTube(palette.secondary),
          boxShadow: `0 0 ${6 * unit}px ${neon(palette.secondary, 60, lit)}, 0 0 ${18 * unit}px ${neon(palette.secondary, 50, 0.8 * lit)}`,
          scale: `${interpolate(local, [6, 20], [0, 1], clamp)} 1`,
        }}
      />
      {captionEl}
    </div>
  );
};
