/**
 * Các lớp chữ của phong cách "Anime": phụ đề trắng viền màu bật scale-pop, thẻ tên nhân vật/chương trên dải
 * chéo, khung "impact" của câu nhấn (tia tốc độ toả tròn + khối màu nghiêng + lấp lánh), đồng hồ sức mạnh.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { activeIndexAt, seeded, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { parseStat } from "../retro/vhs";
import {
  clamp,
  fitHeavy,
  glyphs,
  HEAVY,
  INK,
  OUT,
  outlined,
  POP,
  punchFrame,
  punchRange,
  showFrom,
  SKY,
  SUN,
  upperVi,
  WHITE,
  type Palette,
} from "./anime";

/** Khung hình là ngang (16:9, 2:1) hay vuông (1:1, 3:4). */
const useShape = () => {
  const { width, height } = useLayout();
  const wide = width / height > 1.2;
  return { wide, square: !wide && height / width < 1.45 };
};

/** Ngôi sao lấp lánh 4 cánh (tâm 0,0, bán kính 1). */
const SPARKLE = "M0,-1 C0.12,-0.12 0.12,-0.12 1,0 C0.12,0.12 0.12,0.12 0,1 C-0.12,0.12 -0.12,0.12 -1,0 C-0.12,-0.12 -0.12,-0.12 0,-1 Z";

export const Sparkle: React.FC<{ x: number; y: number; r: number; opacity?: number; color?: string; rotate?: number }> = ({
  x,
  y,
  r,
  opacity = 1,
  color = WHITE,
  rotate = 0,
}) => (
  <svg
    width={r * 2.4}
    height={r * 2.4}
    viewBox="-1.2 -1.2 2.4 2.4"
    style={{ position: "absolute", left: x - r * 1.2, top: y - r * 1.2, opacity, rotate: `${rotate}deg`, overflow: "visible" }}
  >
    <path d={SPARKLE} fill={color} style={{ filter: `drop-shadow(0 0 0.25px ${color})` }} />
    <circle r={0.16} fill="#fff" />
  </svg>
);

/* -------------------------------------------------------------- phụ đề */

/**
 * Phụ đề kiểu sub anime: chữ trắng Montserrat 900 viền màu nhấn dày, bóng mực cứng; mỗi câu mới bật
 * scale-pop 1.28 → 1 trong 6 frame. Cụm nhấn của cảnh chuyển vàng nắng khi giọng đọc tới nó.
 */
export const AnimeCaptions: React.FC<{
  captions: Caption[];
  scenes: Scene[];
  position: "bottom" | "center";
  showTitle: boolean;
  palette: Palette;
}> = ({ captions, scenes, position, showTitle, palette }) => {
  const frame = useCurrentFrame();
  const { caption, startFrame } = useCaptionClock(captions);
  const { unit, safe, width, height, captionBottom } = useLayout();
  const { wide, square } = useShape();
  if (!caption || (showTitle && frame < TITLE_FRAMES)) return null;
  const text = caption.text.normalize("NFC").trim();
  if (!text) return null;

  const boxWidth = wide ? width * 0.72 : width - safe.side * 2 + 40 * unit;
  const base = (wide ? 70 : square ? 66 : 78) * unit;
  // Chữ hoa thường Montserrat 900 ~0.6em mỗi ký tự; tối đa 3 dòng.
  const fontSize = Math.max(Math.round(base * 0.58), fitHeavy(text, base, boxWidth - 40 * unit, 3, 0.6));

  const onAt = showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;
  const local = frame - onAt;
  const scale = interpolate(local, [0, 6], [1.28, 1], { ...clamp, easing: POP });
  const opacity = interpolate(local, [0, 2], [0, 1], clamp);

  // Cụm nhấn của cảnh chứa câu này (cảnh tính theo lúc câu bắt đầu).
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

  // Giữa khung mà cảnh có số liệu phía trên (dọc/vuông): hạ phụ đề xuống cho khỏi đè số liệu.
  const sceneNow = activeIndexAt(scenes, frame);
  const visualAbove = !wide && Boolean(sceneNow >= 0 && scenes[sceneNow]?.visual);
  const centerY = visualAbove ? height * (square ? 0.56 : 0.58) : height / 2;
  const placement: React.CSSProperties =
    position === "center" ? { top: centerY, translate: "0 -50%" } : { bottom: captionBottom - (wide ? 10 : 30) * unit };

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
      <div
        style={{
          fontFamily: HEAVY,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.3,
          textAlign: "center",
          textWrap: "balance",
          scale: String(scale),
          opacity,
          ...outlined(fontSize, palette.main),
        }}
      >
        {parts.map((p, i) => (
          <span key={i} style={p.hot ? { color: SUN, WebkitTextStroke: `${(fontSize * 0.2).toFixed(1)}px ${palette.deep}` } : undefined}>
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------- tag */

/**
 * Thẻ giới thiệu nhân vật/chương: dải màu nhấn nghiêng lao vào từ trái (dải xanh trời mỏng đi trước làm
 * nền), chữ trắng in hoa trượt theo sau, một vạch trắng quét ngang khi dải dừng. 12 frame cuối cảnh rút sang trái.
 */
export const AnimeTag: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({ scenes, showTitle, palette }) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, safe, height } = useLayout();
  const { wide } = useShape();
  if (!scene?.tag?.trim()) return null;
  const on = showFrom(index, startFrame, showTitle) + 4;
  if (frame < on) return null;
  const local = frame - on;
  const isLast = index === scenes.length - 1;
  const outAt = isLast ? Number.MAX_SAFE_INTEGER : Math.max(on + 24, endFrame - 10);

  const text = upperVi(scene.tag.trim());
  const size = Math.min((wide ? 46 : 52) * unit, fitHeavy(text, 52 * unit, (wide ? 900 : 760) * unit, 1));
  const bandIn = interpolate(local, [0, 9], [-110, 0], { ...clamp, easing: OUT });
  const backIn = interpolate(local, [-2, 7], [-120, 0], { ...clamp, easing: OUT });
  const textIn = interpolate(local, [3, 12], [-60 * unit, 0], { ...clamp, easing: OUT });
  const textOpacity = interpolate(local, [3, 8], [0, 1], clamp);
  const out = interpolate(frame, [outAt, outAt + 8], [0, -120], clamp);
  const sheen = interpolate(local, [9, 20], [-30, 130], clamp);
  const top = wide ? safe.top + 40 * unit : Math.max(safe.top + 50 * unit, height * 0.1);

  return (
    <div style={{ position: "absolute", left: 0, top, translate: `${out}% 0` }}>
      {/* Dải xanh trời phía sau, lệch xuống. */}
      <div
        style={{
          position: "absolute",
          left: -40 * unit,
          top: 18 * unit,
          right: -30 * unit,
          bottom: -14 * unit,
          backgroundColor: SKY,
          transform: `translateX(${backIn}%) skewX(-18deg)`,
        }}
      />
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          transform: `translateX(${bandIn}%) skewX(-18deg)`,
          backgroundColor: palette.main,
          boxShadow: `${8 * unit}px ${8 * unit}px 0 ${palette.deep}`,
          padding: `${14 * unit}px ${60 * unit}px ${14 * unit}px ${safe.side + 10 * unit}px`,
          marginLeft: -40 * unit,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sheen}%`,
            width: "18%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
          }}
        />
        <div
          style={{
            transform: `skewX(18deg) translateX(${textIn}px)`,
            opacity: textOpacity,
            display: "flex",
            alignItems: "center",
            gap: 18 * unit,
          }}
        >
          <div style={{ width: 10 * unit, height: size * 0.9, backgroundColor: WHITE, transform: "skewX(-18deg)" }} />
          <div
            style={{
              fontFamily: HEAVY,
              fontWeight: 900,
              fontSize: size,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              color: WHITE,
              textShadow: `0 ${3 * unit}px 0 ${palette.deep}`,
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- punch */

/**
 * Khung "impact" của câu nhấn. Đúng `atMs`: nền tối đi, tia tốc độ toả tròn bắn ra từ tâm (đổi nét mỗi 2 frame
 * cho "sống"), khối màu nhấn nghiêng đập xuống (scale 2.2 → 1, quá đà) chứa cụm nhấn in hoa cỡ lớn, lấp lánh
 * nảy quanh khối. Tia tốc độ tắt sau ~24 frame; khối giữ tới hết cảnh (ít nhất 45 frame) rồi thu nhỏ biến mất.
 * Rung khung do index.tsx áp cho cả màn hình.
 */
export const AnimePunch: React.FC<{
  scenes: Scene[];
  captionPosition: "bottom" | "center";
  showTitle: boolean;
  palette: Palette;
}> = ({ scenes, captionPosition, showTitle, palette }) => {
  const { frame, scene, index, endFrame } = useSceneClock(scenes);
  const { unit, width: W, height: H, safe } = useLayout();
  const { wide, square } = useShape();
  if (!scene?.punch?.text.trim()) return null;
  const at = punchFrame(scene, showTitle);
  const end = Math.max(endFrame, at + 45);
  const local = frame - at;
  if (local < 0 || frame >= end) return null;

  const text = upperVi(scene.punch.text.trim());
  const hasVisual = Boolean(scene.visual);
  const maxWidth = wide ? W * (hasVisual ? 0.5 : 0.62) : W - safe.side * 2;
  // Có số liệu phía trên thì khối nhỏ lại để không chạm số liệu và phụ đề.
  const base = (wide ? 120 : square ? 104 : 132) * unit * (hasVisual && !wide ? (square ? 0.7 : 0.8) : 1);
  const fontSize = Math.max(44 * unit, fitHeavy(text, base, maxWidth - 90 * unit, glyphs(text).length > 22 ? 3 : 2));

  let cy: number;
  if (wide) cy = H * (captionPosition === "center" ? 0.26 : 0.42);
  // Phụ đề giữa khung: khối nhấn chiếm chỗ của số liệu (số liệu nhường, xem AnimeVisual).
  else if (captionPosition === "center") cy = H * (hasVisual ? (square ? 0.34 : 0.28) : 0.3);
  else cy = H * (hasVisual ? (square ? 0.54 : 0.53) : 0.42);
  const cx = wide && hasVisual ? W * 0.63 : W / 2;

  const burst = interpolate(local, [0, 3, 18, 26], [0, 1, 0.75, 0], clamp);
  const dim = interpolate(local, [0, 2, 20, 30], [0, 0.45, 0.3, 0], clamp);
  const slam = interpolate(local, [0, 7], [2.2, 1], { ...clamp, easing: POP });
  const exit = interpolate(frame, [end - 6, end], [1, 0], clamp);
  const blockOpacity = interpolate(local, [0, 2], [0, 1], clamp) * exit;
  const tilt = index % 2 === 0 ? -5 : 4;

  // Tia tốc độ: nêm mảnh từ vòng ngoài vào vòng trong; vòng trong nở ra theo thời gian. Đổi bộ nêm mỗi 2 frame.
  const R = Math.hypot(W, H);
  const inner = interpolate(local, [0, 20], [0.12, 0.34], clamp) * Math.min(W, H);
  const set = Math.floor(local / 2);
  const rays = Array.from({ length: 64 }, (_, i) => {
    const a = ((i + seeded(`anime-ray-${index}-${set}-${i}`, -0.4, 0.4)) / 64) * Math.PI * 2;
    const w = seeded(`anime-ray-w-${index}-${set}-${i}`, 0.004, 0.018);
    const r0 = inner * seeded(`anime-ray-r-${index}-${set}-${i}`, 1, 1.6);
    const p = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`;
    return { d: `M${p(a - w, R)} L${p(a, r0)} L${p(a + w, R)} Z`, light: i % 4 === 0 };
  });

  const sparkles = Array.from({ length: 6 }, (_, i) => {
    const ang = (i / 6) * Math.PI * 2 + seeded(`anime-spk-a-${index}-${i}`, -0.3, 0.3);
    const dist = seeded(`anime-spk-d-${index}-${i}`, 0.42, 0.56) * maxWidth;
    const delay = 4 + i * 2;
    const t = local - delay;
    const pop = interpolate(t, [0, 5], [0, 1], { ...clamp, easing: POP });
    const twinkle = 0.75 + 0.25 * Math.sin((frame + i * 7) / 3);
    return {
      x: cx + Math.cos(ang) * dist,
      y: cy + Math.sin(ang) * dist * 0.55,
      r: seeded(`anime-spk-r-${index}-${i}`, 18, 34) * unit * pop * twinkle,
      o: (t < 0 ? 0 : 1) * exit,
      color: i % 3 === 0 ? SUN : WHITE,
    };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: INK, opacity: dim }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: burst }}>
        {rays.map((r, i) => (
          <path key={i} d={r.d} fill={r.light ? palette.light : WHITE} opacity={r.light ? 0.9 : 0.8} />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx - maxWidth / 2,
          width: maxWidth,
          top: cy,
          translate: "0 -50%",
          display: "flex",
          justifyContent: "center",
          opacity: blockOpacity,
        }}
      >
        <div style={{ position: "relative", rotate: `${tilt}deg`, scale: String(slam * (0.85 + 0.15 * exit)) }}>
          {/* Khối xanh trời lệch phía sau + khối màu nhấn chính, cả hai nghiêng kiểu thẻ tiêu đề anime. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              translate: `${16 * unit}px ${16 * unit}px`,
              backgroundColor: SKY,
              transform: "skewX(-12deg)",
            }}
          />
          <div
            style={{
              position: "relative",
              backgroundColor: palette.main,
              transform: "skewX(-12deg)",
              border: `${6 * unit}px solid ${WHITE}`,
              padding: `${14 * unit}px ${44 * unit}px ${18 * unit}px`,
              boxShadow: `0 0 ${40 * unit}px ${palette.light}`,
            }}
          >
            <div
              style={{
                transform: "skewX(12deg)",
                fontFamily: HEAVY,
                fontWeight: 900,
                fontSize,
                lineHeight: 1.22,
                textAlign: "center",
                textWrap: "balance",
                ...outlined(fontSize, palette.deep, WHITE, 0.14),
              }}
            >
              {text}
            </div>
          </div>
        </div>
      </div>
      {sparkles.map((s, i) => (
        <Sparkle key={i} x={s.x} y={s.y} r={s.r} opacity={s.o} color={s.color} rotate={frame * 2 + i * 20} />
      ))}
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- visual */

/**
 * Số liệu = "chỉ số sức mạnh": con số lớn trắng viền màu, quầng sáng, đếm lên 30 frame; dưới là thanh đo
 * 12 vạch nghiêng sáng dần (số có % thì dừng đúng tỉ lệ, số khác thì đầy vạch), chú thích trắng bên dưới.
 * Nhãn (badge): chữ in hoa trong khối màu nghiêng có lấp lánh. Dọc/vuông: giữa phía trên; ngang: cột trái.
 */
export const AnimeVisual: React.FC<{
  scenes: Scene[];
  captionPosition: "bottom" | "center";
  showTitle: boolean;
  palette: Palette;
}> = ({ scenes, captionPosition, showTitle, palette }) => {
  const { frame, scene, index, startFrame } = useSceneClock(scenes);
  const { unit, safe, width, height } = useLayout();
  const { wide, square } = useShape();
  if (!scene?.visual) return null;
  const on = showFrom(index, startFrame, showTitle) + 8;
  if (frame < on) return null;
  const local = frame - on;
  const visual = scene.visual;

  const boxWidth = wide ? width * 0.32 : width - safe.side * 2;
  const tagRoom = scene.tag ? (square ? 110 : 150) * unit : 20 * unit;
  const tagTop = wide ? safe.top + 40 * unit : Math.max(safe.top + 50 * unit, height * 0.1);
  const box: React.CSSProperties = wide
    ? { left: safe.side, top: Math.max(height * 0.2, tagTop + tagRoom), width: boxWidth }
    : { left: (width - boxWidth) / 2, top: tagTop + tagRoom + (square ? 0 : 20 * unit), width: boxWidth };

  const pop = interpolate(local, [0, 7], [0.4, 1], { ...clamp, easing: POP });
  // Dọc/vuông + phụ đề giữa khung: không đủ chỗ cho cả ba — câu nhấn đập xuống thì số liệu nhường chỗ.
  const yieldAt = !wide && captionPosition === "center" && scene.punch ? punchFrame(scene, showTitle) : Number.MAX_SAFE_INTEGER;
  const fade = interpolate(local, [0, 3], [0, 1], clamp) * interpolate(frame, [yieldAt, yieldAt + 4], [1, 0], clamp);
  const captionText = visual.caption?.normalize("NFC").trim();
  const captionSize = (wide || square ? 40 : 46) * unit;
  const captionEl = captionText ? (
    <div
      style={{
        fontFamily: HEAVY,
        fontWeight: 900,
        fontSize: captionSize,
        lineHeight: 1.3,
        textAlign: "center",
        textWrap: "balance",
        opacity: interpolate(local, [10, 18], [0, 1], clamp),
        ...outlined(captionSize, palette.deep, WHITE, 0.14),
      }}
    >
      {captionText}
    </div>
  ) : null;

  if (visual.type === "badge") {
    const text = upperVi(visual.text);
    const size = Math.min((wide ? 58 : 64) * unit, fitHeavy(text, 64 * unit, boxWidth - 100 * unit, 1));
    return (
      <div style={{ position: "absolute", ...box, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * unit, opacity: fade }}>
        <div style={{ position: "relative", scale: String(pop), rotate: "-3deg" }}>
          <div
            style={{
              transform: "skewX(-14deg)",
              backgroundColor: palette.main,
              border: `${5 * unit}px solid ${WHITE}`,
              boxShadow: `${10 * unit}px ${10 * unit}px 0 ${SKY}, 0 0 ${36 * unit}px ${palette.light}`,
              padding: `${10 * unit}px ${44 * unit}px ${12 * unit}px`,
            }}
          >
            <div
              style={{
                transform: "skewX(14deg)",
                fontFamily: HEAVY,
                fontWeight: 900,
                fontSize: size,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                color: WHITE,
                textShadow: `0 ${4 * unit}px 0 ${palette.deep}`,
              }}
            >
              {text}
            </div>
          </div>
          <Sparkle x={-10 * unit} y={-8 * unit} r={22 * unit * (0.8 + 0.2 * Math.sin(frame / 4))} color={SUN} rotate={frame * 3} />
        </div>
        {captionEl}
      </div>
    );
  }

  const text = visual.text.normalize("NFC");
  const parsed = parseStat(text);
  const progress = interpolate(local, [2, 32], [0, 1], { ...clamp, easing: OUT });
  const shown = parsed ? `${parsed.prefix}${parsed.format(parsed.value * progress)}${parsed.suffix}` : text;
  const percent = parsed && parsed.suffix.trim().startsWith("%") ? Math.min(1, Math.max(0, parsed.value / 100)) : 1;
  const fill = percent * progress;
  const maxSize = (wide ? 170 : square ? 130 : 200) * unit;
  const numberSize = Math.min(maxSize, (boxWidth * 0.9) / (Math.max(2, glyphs(text).length) * 0.72));
  const segments = 12;
  const meterWidth = Math.min(boxWidth * 0.86, 640 * unit);
  // Quầng sáng thở nhẹ sau khi đếm xong.
  const glow = 0.8 + 0.2 * Math.sin(frame / 6);

  return (
    <div style={{ position: "absolute", ...box, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * unit, opacity: fade }}>
      <div style={{ display: "grid", scale: String(pop), fontFamily: HEAVY, fontWeight: 900, fontSize: numberSize, lineHeight: 1.12, whiteSpace: "nowrap" }}>
        {/* Chuỗi cuối (ẩn) giữ bề rộng; số đang đếm canh giữa cùng ô nên không nhảy. */}
        <span style={{ gridArea: "1 / 1", visibility: "hidden" }}>{text}</span>
        <span
          style={{
            gridArea: "1 / 1",
            textAlign: "center",
            fontStyle: "italic",
            ...outlined(numberSize, palette.main, WHITE, 0.12),
            filter: `drop-shadow(0 0 ${(22 * unit * glow).toFixed(1)}px ${palette.light})`,
          }}
        >
          {shown}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 * unit, width: meterWidth, transform: "skewX(-20deg)" }}>
        {Array.from({ length: segments }, (_, i) => {
          const lit = fill * segments > i + 0.5;
          const t = i / (segments - 1);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 26 * unit,
                border: `${3 * unit}px solid ${WHITE}`,
                backgroundColor: lit ? (t < 0.5 ? SKY : t < 0.85 ? palette.main : SUN) : "rgba(20,16,38,0.55)",
                boxShadow: lit ? `0 0 ${14 * unit}px ${t < 0.5 ? SKY : palette.light}` : "none",
              }}
            />
          );
        })}
      </div>
      {captionEl}
    </div>
  );
};
