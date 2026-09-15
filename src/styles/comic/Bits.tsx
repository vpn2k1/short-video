/**
 * Các mảnh chữ của trang truyện: hộp lời dẫn vàng (caption), nhãn dán góc khung (tag),
 * huy hiệu nổ số liệu và băng rôn chương (visual), hình nổ BÙM! (punch).
 */
import { Easing, interpolate, spring } from "remotion";
import type { SceneVisual } from "../../compositions/Short/schema";
import { FONTS, seeded } from "../shared";
import { burstPoints, clamp, fitBlock, INK, outline, upperVi, WHITE, YELLOW } from "./palette";

/**
 * Chữ in hoa kiểu lettering truyện tranh. Dùng SF (FONTS.sans), KHÔNG Avenir Next: bản
 * Heavy/Bold của Avenir tách móc Ư/Ơ ("CHƯ ƠNG", "MƠ I") — đã render thử.
 */
export const LETTER: React.CSSProperties = { fontFamily: FONTS.sans, fontWeight: 800, textWrap: "balance" };
export const HEAVY: React.CSSProperties = { fontFamily: FONTS.sans, fontWeight: 900, textWrap: "balance" };

/** Hộp lời dẫn vàng viền đen, bóng khối cứng. Bật nhẹ mỗi khi đổi câu. */
export const NarrationBox: React.FC<{
  text: string;
  index: number;
  localFrame: number;
  unit: number;
  maxWidth: number;
  fps: number;
}> = ({ text, index, localFrame, unit: u, maxWidth, fps }) => {
  const upper = upperVi(text.trim());
  if (!upper) return null;
  const padX = 34 * u;
  const fontSize = fitBlock(upper, {
    maxWidth: maxWidth - 2 * padX - 20 * u,
    maxHeight: 3 * 60 * u * 1.18,
    base: 60 * u,
    charW: 0.64,
    lineH: 1.18,
    min: 30 * u,
  });
  const s = spring({ frame: localFrame, fps, config: { damping: 11, stiffness: 220 } });
  const rot = seeded(`comic-cap-${index}`, -1.6, 1.6);
  return (
    <div
      style={{
        maxWidth,
        boxSizing: "border-box",
        backgroundColor: YELLOW,
        color: INK,
        border: `${6 * u}px solid ${INK}`,
        boxShadow: `${10 * u}px ${12 * u}px 0 ${INK}`,
        padding: `${16 * u}px ${padX}px ${18 * u}px`,
        ...LETTER,
        fontSize,
        lineHeight: 1.18,
        textAlign: "center",
        transform: `scale(${0.82 + 0.18 * s}) rotate(${rot}deg)`,
        opacity: interpolate(localFrame, [0, 2], [0, 1], clamp),
      }}
    >
      {upper}
    </div>
  );
};

/** Nhãn vàng nghiêng dán ở góc khung ("LÚC 5 GIỜ CHIỀU"). */
export const TagLabel: React.FC<{ text: string; f: number; fps: number; unit: number; sceneIndex: number }> = ({
  text,
  f,
  fps,
  unit: u,
  sceneIndex,
}) => {
  if (f < 0) return null;
  const s = spring({ frame: f, fps, config: { damping: 9, stiffness: 190 } });
  const rot = seeded(`comic-tag-${sceneIndex}`, -7, -3);
  const upper = upperVi(text);
  return (
    <div
      style={{
        display: "inline-block",
        backgroundColor: YELLOW,
        color: INK,
        border: `${5 * u}px solid ${INK}`,
        boxShadow: `${7 * u}px ${8 * u}px 0 ${INK}`,
        padding: `${8 * u}px ${24 * u}px ${10 * u}px`,
        ...HEAVY,
        fontSize: fitBlock(upper, { maxWidth: 520 * u, maxHeight: 60 * u, base: 50 * u, charW: 0.66, lineH: 1.1, min: 30 * u }),
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        transform: `scale(${Math.max(0, s)}) rotate(${rot + (1 - s) * -25}deg)`,
        transformOrigin: "10% 50%",
      }}
    >
      {upper}
    </div>
  );
};

/** Hình nổ SVG: viền đen, lớp bóng khối, lõi màu thứ hai tuỳ chọn. */
export const BurstShape: React.FC<{
  seedKey: string;
  spikes: number;
  outer?: number;
  inner?: number;
  jitter?: number;
  fill: string;
  core?: string;
  stroke: number;
  shadow: number;
}> = ({ seedKey, spikes, outer = 49, inner = 33, jitter = 5, fill, core, stroke, shadow }) => {
  const pts = burstPoints(seedKey, spikes, outer - jitter, inner, jitter);
  const corePts = core ? burstPoints(`${seedKey}-core`, spikes, (outer - jitter) * 0.74, inner * 0.78, jitter * 0.6) : null;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <polygon points={pts} fill={INK} transform={`translate(${shadow} ${shadow})`} />
      <polygon points={pts} fill={fill} stroke={INK} strokeWidth={stroke} strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      {corePts ? <polygon points={corePts} fill={core} stroke={INK} strokeWidth={stroke * 0.55} vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
};

/** Huy hiệu nổ tròn (stat) hoặc băng rôn chương (badge). */
export const VisualBit: React.FC<{
  visual: SceneVisual;
  f: number;
  fps: number;
  unit: number;
  sceneIndex: number;
  cool: string;
  hot: string;
  hotDark: string;
  /** Hệ số phóng — cảnh không ảnh cho visual to ở giữa khung. */
  scale?: number;
}> = ({ visual, f, fps, unit: u, sceneIndex, cool, hot, hotDark, scale = 1 }) => {
  if (f < 0) return null;
  const k = `comic-visual-${sceneIndex}`;

  if (visual.type === "stat") {
    const size = 300 * u * scale;
    const s = spring({ frame: f, fps, config: { damping: 8, stiffness: 160 } });
    const rot = seeded(k, 3, 8);
    const spin = interpolate(f, [0, 20], [-140, 0], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
    const num = visual.text;
    // Số + chú thích phải nằm gọn trong lõi trắng (~70% đường kính), chừa chỗ cho viền chữ.
    const numSize = fitBlock(num, {
      maxWidth: size * 0.5,
      maxHeight: visual.caption ? size * 0.27 : size * 0.4,
      base: 120 * u * scale,
      charW: 0.64,
      lineH: 1,
    });
    return (
      <div style={{ position: "relative", width: size, height: size, transform: `scale(${Math.max(0, s)}) rotate(${rot + spin}deg)` }}>
        <BurstShape seedKey={k} spikes={22} outer={50} inner={43} jitter={2} fill={cool} core={WHITE} stroke={6 * u * scale} shadow={3} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: INK,
            gap: 10 * u * scale,
          }}
        >
          <div style={{ ...HEAVY, fontSize: numSize, lineHeight: 1, color: hot, whiteSpace: "nowrap", textShadow: outline(4 * u * scale, INK, 5 * u * scale) }}>
            {num}
          </div>
          {visual.caption ? (
            <div
              style={{
                ...HEAVY,
                fontSize: fitBlock(upperVi(visual.caption), { maxWidth: size * 0.46, maxHeight: size * 0.17, base: 30 * u * scale, charW: 0.68, lineH: 1.08 }),
                lineHeight: 1.08,
                textAlign: "center",
                maxWidth: size * 0.5,
              }}
            >
              {upperVi(visual.caption)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Băng rôn: thân chữ nhật, hai đuôi gập sẫm hơn phía sau.
  const s = spring({ frame: f, fps, config: { damping: 10, stiffness: 150 } });
  const text = upperVi(visual.text);
  const fontSize = fitBlock(text, { maxWidth: 380 * u * scale, maxHeight: 60 * u * scale, base: 52 * u * scale, charW: 0.66, lineH: 1.05 });
  const h = 90 * u * scale;
  const tail = 52 * u * scale;
  const rot = seeded(k, -6, -2);
  const border = 5 * u * scale;
  const tailStyle = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: h * 0.32,
    [side]: -tail * 0.78,
    width: tail * 1.2,
    height: h,
    backgroundColor: hotDark,
    border: `${border}px solid ${INK}`,
    boxSizing: "border-box",
    clipPath:
      side === "left"
        ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 34% 50%)"
        : "polygon(0 0, 100% 0, 66% 50%, 100% 100%, 0 100%)",
  });
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `scaleX(${interpolate(s, [0, 1], [0.1, 1])}) scaleY(${Math.max(0, s)}) rotate(${rot}deg)`,
        opacity: interpolate(f, [0, 3], [0, 1], clamp),
      }}
    >
      <div style={{ position: "relative", padding: `0 ${tail * 0.5}px` }}>
        <div style={tailStyle("left")} />
        <div style={tailStyle("right")} />
        <div
          style={{
            position: "relative",
            height: h,
            display: "flex",
            alignItems: "center",
            padding: `0 ${34 * u * scale}px`,
            backgroundColor: hot,
            border: `${border}px solid ${INK}`,
            boxSizing: "border-box",
            boxShadow: `${8 * u}px ${9 * u}px 0 ${INK}`,
            ...HEAVY,
            fontSize,
            lineHeight: 1,
            color: WHITE,
            whiteSpace: "nowrap",
            textShadow: outline(3.5 * u * scale, INK, 4 * u * scale),
          }}
        >
          {text}
        </div>
      </div>
      {visual.caption ? (
        <div
          style={{
            marginTop: 10 * u * scale,
            backgroundColor: WHITE,
            border: `${4 * u * scale}px solid ${INK}`,
            padding: `${4 * u}px ${16 * u}px`,
            ...LETTER,
            fontSize: 30 * u * scale,
            lineHeight: 1.15,
            color: INK,
            maxWidth: 460 * u * scale,
            textAlign: "center",
          }}
        >
          {upperVi(visual.caption)}
        </div>
      ) : null}
    </div>
  );
};

/** Số frame hình nổ tồn tại (vào + giữ + ra). */
export const PUNCH_FRAMES = 42;

/**
 * Hình nổ BÙM!: bật to quá đà rồi co lại, rung, tia tốc độ bắn ra, cụm từ in hoa khổng lồ
 * viền đen ở giữa; giữ ~1 giây rồi phồng lên tan biến.
 */
export const PunchBurst: React.FC<{
  text: string;
  f: number;
  fps: number;
  unit: number;
  w: number;
  h: number;
  hot: string;
  sceneIndex: number;
}> = ({ text, f, unit: u, w, h, hot, sceneIndex }) => {
  if (f < 0 || f >= PUNCH_FRAMES) return null;
  const k = `comic-punch-${sceneIndex}`;
  const pop = interpolate(f, [0, 4, 8, 12], [0.15, 1.18, 0.94, 1], clamp);
  const out = interpolate(f, [PUNCH_FRAMES - 7, PUNCH_FRAMES], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const baseRot = seeded(`${k}-rot`, -6, 6);
  const rot = interpolate(f, [0, 10], [baseRot - 22, baseRot], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const shakeAmp = interpolate(f, [2, 14], [14, 0], clamp) * u;
  const shakeX = Math.sin(f * 2.9) * shakeAmp;
  const shakeY = Math.cos(f * 3.7) * shakeAmp * 0.6;
  const breathe = 1 + Math.sin(f * 0.5) * 0.012;

  const upper = upperVi(text);
  const fontSize = fitBlock(upper, {
    maxWidth: w * 0.6,
    maxHeight: h * 0.46,
    base: 170 * u,
    charW: 0.7,
    lineH: 1.12,
    min: 44 * u,
  });

  // Tia tốc độ: tam giác mảnh toả từ tâm, dài dần trong 8 frame đầu.
  const reach = interpolate(f, [1, 9], [0.5, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // Toạ độ theo nửa khung (r = 0.5 là mép hình nổ): tia ngắn quanh viền, không quét qua tag/visual.
  const rays = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2 + seeded(`${k}-ray${i}`, -0.08, 0.08);
    const r0 = 0.46 + seeded(`${k}-r0${i}`, 0, 0.04);
    const r1 = (r0 + seeded(`${k}-r1${i}`, 0.08, 0.17)) * reach + r0 * (1 - reach);
    const half = seeded(`${k}-hw${i}`, 0.012, 0.028);
    const p = (r: number, da: number) => `${(Math.cos(a + da) * r * w).toFixed(1)},${(Math.sin(a + da) * r * h).toFixed(1)}`;
    return `${p(r0, -half)} ${p(r1, 0)} ${p(r0, half)}`;
  });

  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        transform: `translate(${shakeX}px, ${shakeY}px) scale(${(pop + out * 0.25) * breathe}) rotate(${rot}deg)`,
        opacity: 1 - out,
      }}
    >
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g transform={`translate(${w / 2} ${h / 2})`} opacity={interpolate(f, [0, 2, 20, 30], [0, 1, 1, 0.35], clamp)}>
          {rays.map((pts, i) => (
            <polygon key={i} points={pts} fill={INK} />
          ))}
        </g>
      </svg>
      <BurstShape seedKey={k} spikes={15} outer={50} inner={31} jitter={6} fill={hot} core={YELLOW} stroke={9 * u} shadow={2.2} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${w * 0.2}px`,
        }}
      >
        <div
          style={{
            ...HEAVY,
            fontSize,
            lineHeight: 1.12,
            color: WHITE,
            textAlign: "center",
            textShadow: outline(Math.max(3, fontSize * 0.055), INK, fontSize * 0.07),
            transform: "rotate(-3deg)",
          }}
        >
          {upper}
        </div>
      </div>
    </div>
  );
};
