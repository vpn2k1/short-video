/**
 * Phong cách "Tối giản sang trọng": trang tạp chí in trên giấy ngà, lề rộng. Ảnh của cảnh đặt như một bản in
 * trong phòng tranh — viền chỉ mảnh, lớp passe-partout, phóng vào rất chậm. Phụ đề chữ có chân canh giữa, hiện
 * từng dòng và trôi nhẹ lên, kẹp giữa hai gạch vàng mảnh. Chuyển cảnh là hoà tan dài, không nảy.
 * Xem skill `.claude/skills/style-luxury/SKILL.md`.
 *
 * Dọc (9:16, 3:4, 1:1): monogram trên cùng → bản in → kicker (`tag`) → phụ đề. Ngang (16:9, 2:1): bản in bên trái,
 * cột chữ bên phải. Cảnh không ảnh: dọc thành trang chữ thuần có dấu ngoặc kép lớn; ngang thì bản in thay bằng
 * dấu ngoặc kép / con số.
 *
 * Thứ tự lớp: trang của cảnh (cảnh cũ dưới, cảnh mới hoà tan lên trên) → gạch vàng + phụ đề → monogram →
 * trang tiêu đề → nhiễu giấy + viền tối nhẹ.
 */
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { ensureFonts, useFontReady } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, useLayout } from "../shared";
import { findPunch } from "../whiteboard/written";
import { fitLines, measure, SANS, SERIF, upper, wrap, type Line } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Mọi chuyển động đều chậm và êm — không nảy, không vượt quá đích. */
const GLIDE = Easing.bezier(0.25, 0.1, 0.25, 1);
const DISSOLVE = Easing.bezier(0.45, 0, 0.55, 1);
/** Số frame hoà tan giữa hai cảnh. */
const DISSOLVE_FRAMES = 26;

const CREAM = "#f4efe6";
/** Lớp passe-partout quanh ảnh — sáng hơn giấy một chút. */
const MAT = "#faf7f1";
const INK = "#2a2520";
const MUTED = "#8c7f6d";
const GOLD = "#b08d57";
const HAIR = "rgba(70, 56, 40, 0.34)";
const LINE_HEIGHT = 1.36;

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };

type LuxLayout = {
  /** Ngang: bản in trái, cột chữ phải. */
  split: boolean;
  unit: number;
  mono: { cx: number; cy: number; size: number };
  /** Khung bản in. */
  frame: Rect;
  /** Vùng kicker + phụ đề khi cảnh có bản in. */
  text: Rect;
  /** Trang chữ thuần (dọc, cảnh không ảnh). */
  page: Rect;
};

const useLuxLayout = (): LuxLayout => {
  const { width, height, safe, unit } = useLayout();
  const monoSize = 66 * unit;
  if (width / height >= 1.2) {
    const top = Math.max(safe.top, 84 * unit);
    const bottom = Math.max(safe.bottom, 84 * unit);
    const fx = Math.max(safe.side, 110 * unit);
    const fh = height - top - bottom;
    const fw = Math.min(fh * 0.8, width * 0.42);
    const x0 = fx + fw + 120 * unit;
    const x1 = width - fx;
    const textTop = top + monoSize + 60 * unit;
    const text = { x: x0, y: textTop, w: x1 - x0, h: height - bottom - textTop };
    return {
      split: true, unit,
      mono: { cx: (x0 + x1) / 2, cy: top + monoSize / 2, size: monoSize },
      frame: { x: fx, y: top, w: fw, h: fh },
      text,
      page: text,
    };
  }
  const side = Math.max(safe.side, 96 * unit);
  const frameTop = safe.top + monoSize + 48 * unit;
  const bottom = height - safe.bottom;
  const frameH = (bottom - frameTop) * (height / width > 1.5 ? 0.6 : 0.54);
  const textTop = frameTop + frameH + 44 * unit;
  return {
    split: false, unit,
    mono: { cx: width / 2, cy: safe.top + monoSize / 2 + 6 * unit, size: monoSize },
    frame: { x: side, y: frameTop, w: width - side * 2, h: frameH },
    text: { x: side, y: textTop, w: width - side * 2, h: bottom - textTop },
    page: { x: side, y: frameTop, w: width - side * 2, h: bottom - frameTop },
  };
};

/** Cảnh này vẽ thành trang chữ thuần (chỉ khi dọc và không có ảnh). */
const isPage = (scene: Scene, layout: LuxLayout) => !layout.split && !scene.image;

/** Kicker in hoa giãn chữ: cao bao nhiêu (để chừa chỗ), cỡ chữ. */
const kickerSize = (unit: number) => 25 * unit;
const TAG_RESERVE = (unit: number) => kickerSize(unit) * 1.4 + 40 * unit;

// ---------------------------------------------------------------------------
// Monogram
// ---------------------------------------------------------------------------
const Monogram: React.FC<{ letter: string; size: number; unit: number; draw: number; letterT: number }> = ({
  letter, size, unit, draw, letterT,
}) => {
  const stroke = Math.max(1, 1.6 * unit * (size / (66 * unit)) ** 0.4);
  const r = size / 2 - stroke;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {draw > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={GOLD}
            strokeWidth={stroke}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - Math.min(1, draw)}
            // Nét tròn bắt đầu vẽ từ đỉnh.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontFamily: SERIF,
          fontWeight: 400,
          fontSize: size * 0.46,
          lineHeight: 1,
          // Playfair đặt chữ hoa hơi cao so với hộp chữ — hạ xuống cho cân trong vòng tròn.
          paddingTop: size * 0.04,
          color: INK,
          opacity: letterT,
        }}
      >
        {letter}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Kicker, trang trí, con số
// ---------------------------------------------------------------------------
const Kicker: React.FC<{ text: string; size: number; color?: string; style?: React.CSSProperties }> = ({ text, size, color = MUTED, style }) => (
  <div
    style={{
      fontFamily: SANS,
      fontWeight: 500,
      fontSize: size,
      lineHeight: 1.3,
      letterSpacing: "0.3em",
      // letter-spacing chèn thêm khoảng sau chữ cuối — bù bên trái để khối vẫn nằm giữa.
      paddingLeft: "0.3em",
      color,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {upper(text)}
  </div>
);

/** Dấu ngoặc kép lớn (cảnh không ảnh), hoặc con số / nhãn của `visual`. */
const Ornament: React.FC<{ visual: Scene["visual"]; box: Rect; unit: number; t: number; ready: boolean }> = ({ visual, box, unit, t, ready }) => {
  if (visual) {
    const base = Math.min(box.h * 0.62, 260 * unit);
    const size = Math.min(base, (box.w * 0.86 / Math.max(1, measure(visual.text, base, ready))) * base);
    return (
      <div
        style={{
          position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 * unit,
          opacity: t, translate: `0 ${((1 - t) * 18 * unit).toFixed(1)}px`,
        }}
      >
        <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: size, lineHeight: 1, color: INK, letterSpacing: "-0.01em" }}>{visual.text}</div>
        <div style={{ width: 60 * unit, height: Math.max(1, 1.5 * unit), backgroundColor: GOLD }} />
        {visual.caption ? <Kicker text={visual.caption} size={kickerSize(unit) * 0.92} /> : null}
      </div>
    );
  }
  const size = Math.min(box.h * 1.3, 380 * unit);
  return (
    <div
      style={{
        position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "visible",
        display: "grid", placeItems: "center", opacity: t * 0.7,
      }}
    >
      <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: size, lineHeight: 1, height: size * 0.5, color: GOLD, scale: String(0.96 + t * 0.04) }}>
        “
      </div>
    </div>
  );
};

/** Nhãn kiểu phòng tranh dán trong bản in: con số lớn mảnh + chú thích kicker. */
const LabelCard: React.FC<{ visual: NonNullable<Scene["visual"]>; frame: Rect; unit: number; t: number; ready: boolean }> = ({
  visual, frame, unit, t, ready,
}) => {
  // Nhãn chữ (badge) nhỏ hơn con số — là dòng chú thích, không phải tiêu đề.
  // Khung thấp (1:1) thì nhãn nhỏ lại để không che hết ảnh.
  const base = Math.min((visual.type === "stat" ? 92 : 58) * unit, frame.h * (visual.type === "stat" ? 0.14 : 0.09));
  const size = Math.min(base, (frame.w * 0.6 / Math.max(1, measure(visual.text, base, ready))) * base);
  return (
    <div
      style={{
        position: "absolute",
        left: frame.x + frame.w / 2,
        top: frame.y + frame.h - 56 * unit,
        translate: `-50% ${(-100 + (1 - t) * 8).toFixed(1)}%`,
        padding: `${22 * unit}px ${46 * unit}px ${24 * unit}px`,
        backgroundColor: "rgba(250, 247, 241, 0.94)",
        border: `${Math.max(1, 1.2 * unit)}px solid ${HAIR}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10 * unit,
        opacity: t,
        boxShadow: `0 ${10 * unit}px ${30 * unit}px rgba(60, 40, 20, 0.12)`,
      }}
    >
      <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: size, lineHeight: 1, color: INK, whiteSpace: "nowrap" }}>{visual.text}</div>
      {visual.caption ? <Kicker text={visual.caption} size={kickerSize(unit) * 0.8} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Trang của một cảnh
// ---------------------------------------------------------------------------
const SceneLayer: React.FC<{ scene: Scene; from: number; until: number; layout: LuxLayout; frame: number; ready: boolean }> = ({
  scene, from, until, layout, frame, ready,
}) => {
  const { unit, frame: box, text } = layout;
  const tagT = interpolate(frame, [from + 10, from + 36], [0, 1], { ...clamp, easing: GLIDE });
  const ornT = interpolate(frame, [from + 6, from + 40], [0, 1], { ...clamp, easing: GLIDE });
  const cardT = interpolate(frame, [from + 20, from + 46], [0, 1], { ...clamp, easing: GLIDE });

  if (isPage(scene, layout)) {
    const { page } = layout;
    const ornament = { x: page.x, y: page.y + page.h * 0.08, w: page.w, h: page.h * 0.24 };
    return (
      <AbsoluteFill style={{ backgroundColor: CREAM }}>
        <Ornament visual={scene.visual} box={ornament} unit={unit} t={ornT} ready={ready} />
        {scene.tag ? (
          <div style={{ position: "absolute", left: page.x, width: page.w, top: page.y + page.h * 0.34, display: "flex", justifyContent: "center", opacity: tagT }}>
            <Kicker text={scene.tag} size={kickerSize(unit)} color={GOLD} />
          </div>
        ) : null}
      </AbsoluteFill>
    );
  }

  const mat = 20 * unit;
  const hair = Math.max(1, 1.2 * unit);
  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {/* Bản in: viền chỉ mảnh → passe-partout → ảnh có viền trong. */}
      <div
        style={{
          position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h,
          boxSizing: "border-box", padding: mat, backgroundColor: MAT,
          border: `${hair}px solid ${HAIR}`,
          boxShadow: `0 ${24 * unit}px ${60 * unit}px rgba(70, 50, 25, 0.10), 0 ${2 * unit}px ${6 * unit}px rgba(70, 50, 25, 0.06)`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", outline: `${hair}px solid rgba(70, 56, 40, 0.18)`, backgroundColor: "#ebe4d7" }}>
          {scene.image ? (
            <div style={{ position: "absolute", inset: 0, filter: "saturate(0.86) contrast(0.97) sepia(0.06)" }}>
              <SceneMedia scene={scene} from={from} zoom={interpolate(frame, [from, until + DISSOLVE_FRAMES], [1, 1.07], clamp)} />
            </div>
          ) : (
            <Ornament visual={scene.visual} box={{ x: 0, y: 0, w: box.w - mat * 2, h: box.h - mat * 2 }} unit={unit} t={ornT} ready={ready} />
          )}
        </div>
      </div>
      {scene.image && scene.visual ? <LabelCard visual={scene.visual} frame={box} unit={unit} t={cardT} ready={ready} /> : null}
      {scene.tag ? (
        <div style={{ position: "absolute", left: text.x, width: text.w, top: text.y, display: "flex", justifyContent: "center", opacity: tagT }}>
          <Kicker text={scene.tag} size={kickerSize(unit)} color={GOLD} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Phụ đề
// ---------------------------------------------------------------------------
type Block = {
  size: number;
  lines: Line[];
  /** Câu nhấn không có trong lời: in thêm một dòng nghiêng vàng dưới cùng. */
  extra: Line[];
  extraSize: number;
  zone: Rect;
  cy: number;
  height: number;
  page: boolean;
  /** Chỉ số từ [đầu, cuối] của câu nhấn trong câu, và frame nó được nhấn. */
  punch: [number, number] | null;
  punchAt: number;
};

const blockFor = (
  caption: Caption, scene: Scene, layout: LuxLayout, ready: boolean, extraPunch: string | null,
): Omit<Block, "punchAt"> => {
  const { unit } = layout;
  const page = isPage(scene, layout);
  let zone: Rect;
  if (page) {
    const p = layout.page;
    zone = { x: p.x, y: p.y + p.h * 0.42, w: p.w, h: p.h * 0.58 };
  } else {
    const t = layout.text;
    const reserve = scene.tag ? TAG_RESERVE(unit) : 0;
    zone = { x: t.x, y: t.y + reserve, w: t.w, h: t.h - reserve };
  }
  const rules = 2 * (30 * unit + 4 * unit);
  const extraSize = (page ? 50 : 42) * unit;
  const extra = extraPunch ? wrap(extraPunch, extraSize, zone.w * 0.9, ready, 400) : [];
  const extraH = extra.length > 0 ? extra.length * extraSize * LINE_HEIGHT + 18 * unit : 0;
  const base = (page ? 74 : layout.split ? 60 : 58) * unit;
  const { size, lines } = fitLines(
    caption.text, base, 30 * unit, zone.w * (page ? 0.92 : 0.94), zone.h - rules - extraH, LINE_HEIGHT, page ? 6 : 4, ready,
  );
  const height = lines.length * size * LINE_HEIGHT + extraH;
  const punch = scene.punch ? findPunch(caption.text, scene.punch.text) : null;
  // Trang chữ: khối phụ đề bám mép trên vùng (ngay dưới kicker) để cả trang là một cụm liền; bản in: canh giữa vùng.
  const cy = page ? zone.y + rules / 2 + height / 2 : zone.y + zone.h / 2;
  return { size, lines, extra, extraSize, zone, cy, height, page, punch };
};

const CaptionLines: React.FC<{ block: Block; start: number; frame: number; unit: number; opacity: number; drift: number }> = ({
  block, start, frame, unit, opacity, drift,
}) => {
  const { size, lines, zone, cy, height, punch, punchAt } = block;
  const top = cy - height / 2;
  const lh = size * LINE_HEIGHT;
  const lineIn = (k: number) => interpolate(frame, [start + 6 + k * 6, start + 26 + k * 6], [0, 1], { ...clamp, easing: GLIDE });
  // Câu nhấn được đánh dấu khi giọng đọc tới — nhưng không trước khi dòng chứa nó hiện xong.
  const punchLine = punch ? lines.findIndex((l) => l.words.some((w) => w.index >= punch[0] && w.index <= punch[1])) : -1;
  const at = Math.max(punchAt, start + 26 + Math.max(0, punchLine) * 6);
  const punchT = interpolate(frame, [at, at + 22], [0, 1], { ...clamp, easing: GLIDE });

  const lineStyle = (k: number, y: number): React.CSSProperties => ({
    position: "absolute",
    left: zone.x,
    width: zone.w,
    top: y,
    textAlign: "center",
    whiteSpace: "nowrap",
    opacity: lineIn(k) * opacity,
    translate: `0 ${((1 - lineIn(k)) * 18 * unit + drift).toFixed(1)}px`,
  });

  return (
    <>
      {lines.map((line, k) => {
        // Gom các từ liền nhau cùng loại (nhấn / thường) thành một đoạn để gạch chân chạy liền qua khoảng trắng.
        const segments: { text: string; punch: boolean }[] = [];
        for (const w of line.words) {
          const isPunch = punch !== null && w.index >= punch[0] && w.index <= punch[1];
          const last = segments[segments.length - 1];
          if (last && last.punch === isPunch) last.text += ` ${w.text}`;
          else segments.push({ text: w.text, punch: isPunch });
        }
        return (
          <div key={k} style={{ ...lineStyle(k, top + k * lh), fontFamily: SERIF, fontWeight: 400, fontSize: size, lineHeight: LINE_HEIGHT, color: INK }}>
            {segments.map((seg, s) => (
              <span key={s}>
                {s > 0 ? " " : ""}
                <span
                  style={
                    seg.punch
                      ? {
                        fontStyle: "italic",
                        color: interpolateColors(punchT, [0, 1], [INK, GOLD]),
                        backgroundImage: `linear-gradient(${GOLD}, ${GOLD})`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "0 96%",
                        backgroundSize: `${(punchT * 100).toFixed(1)}% ${Math.max(1, size * 0.035).toFixed(1)}px`,
                        paddingBottom: size * 0.02,
                        // Chữ nghiêng giả ngả sang phải, ăn vào khoảng trắng sau — chừa thêm một chút.
                        // margin (không phải padding) để gạch chân không kéo dài sang khoảng trống.
                        marginLeft: "0.04em",
                        marginRight: "0.18em",
                      }
                      : undefined
                  }
                >
                  {seg.text}
                </span>
              </span>
            ))}
          </div>
        );
      })}
      {block.extra.map((line, k) => {
        const t = interpolate(frame, [punchAt, punchAt + 22], [0, 1], { ...clamp, easing: GLIDE });
        return (
          <div
            key={`x-${k}`}
            style={{
              position: "absolute", left: zone.x, width: zone.w, textAlign: "center", whiteSpace: "nowrap",
              top: top + lines.length * lh + 18 * unit + k * block.extraSize * LINE_HEIGHT,
              fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: block.extraSize, lineHeight: LINE_HEIGHT,
              color: GOLD, opacity: t * opacity, translate: `0 ${((1 - t) * 14 * unit + drift).toFixed(1)}px`,
            }}
          >
            {line.words.map((w) => w.text).join(" ")}
          </div>
        );
      })}
    </>
  );
};

/** Hai gạch vàng mảnh kẹp khối phụ đề — kéo từ giữa ra, rồi dời êm theo chiều cao câu mới. */
const Rules: React.FC<{ zone: Rect; top: number; bottom: number; unit: number; grow: number; opacity: number }> = ({
  zone, top, bottom, unit, grow, opacity,
}) => {
  const w = 110 * unit;
  const h = Math.max(1, 1.4 * unit);
  const rule = (y: number): React.CSSProperties => ({
    position: "absolute", left: zone.x + zone.w / 2 - w / 2, top: y, width: w, height: h,
    backgroundColor: GOLD, opacity, scale: `${grow.toFixed(3)} 1`,
  });
  return (
    <>
      <div style={rule(top)} />
      <div style={rule(bottom)} />
    </>
  );
};

const CaptionLayer: React.FC<{
  captions: Caption[]; scenes: Scene[]; layout: LuxLayout; frame: number; ready: boolean; gate: number;
}> = ({ captions, scenes, layout, frame, ready, gate }) => {
  const current = activeIndexAt(captions, frame);
  if (current < 0 || gate <= 0) return null;
  const { unit } = layout;
  const sceneOf = (c: Caption) => scenes[Math.max(0, activeIndexAt(scenes, msToFrames(c.startMs)))];

  const make = (i: number): Block => {
    const caption = captions[i];
    const scene = sceneOf(caption);
    // Câu nhấn không nằm nguyên văn trong câu nào của cảnh → in thêm thành dòng nghiêng dưới câu đang đọc lúc atMs.
    let extra: string | null = null;
    const punchAt = scene.punch ? msToFrames(scene.punch.atMs) : Number.MAX_SAFE_INTEGER;
    if (scene.punch) {
      const inScene = captions.some((c) => sceneOf(c) === scene && findPunch(c.text, scene.punch!.text));
      const owner = activeIndexAt(captions, punchAt);
      if (!inScene && (owner === i || (owner < 0 && i === 0))) extra = scene.punch.text;
    }
    return { ...blockFor(caption, scene, layout, ready, extra), punchAt };
  };

  const start = msToFrames(captions[current].startMs);
  const cur = make(current);
  const prev = current > 0 ? make(current - 1) : null;
  const outT = interpolate(frame, [start, start + 10], [1, 0], { ...clamp, easing: GLIDE });
  const showPrev = prev && outT > 0;

  // Gạch vàng: cùng kiểu trang thì dời êm từ vị trí cũ sang mới; câu đầu hoặc đổi kiểu trang thì kéo ra từ giữa.
  const gap = 34 * unit;
  const edges = (b: Block) => [b.cy - b.height / 2 - gap, b.cy + b.height / 2 + gap - 1.4 * unit];
  const [ct, cb] = edges(cur);
  const fresh = !prev || prev.page !== cur.page || prev.zone.y !== cur.zone.y;
  const move = interpolate(frame, [start, start + 18], [0, 1], { ...clamp, easing: GLIDE });
  let rules: React.ReactNode;
  if (fresh) {
    const grow = interpolate(frame, [start + 4, start + 30], [0, 1], { ...clamp, easing: GLIDE });
    rules = (
      <>
        {prev ? <Rules zone={prev.zone} top={edges(prev)[0]} bottom={edges(prev)[1]} unit={unit} grow={1} opacity={outT * gate} /> : null}
        <Rules zone={cur.zone} top={ct} bottom={cb} unit={unit} grow={grow} opacity={grow * gate} />
      </>
    );
  } else {
    const [pt, pb] = edges(prev!);
    rules = <Rules zone={cur.zone} top={pt + (ct - pt) * move} bottom={pb + (cb - pb) * move} unit={unit} grow={1} opacity={gate} />;
  }

  return (
    <AbsoluteFill>
      {rules}
      {showPrev ? (
        <CaptionLines
          block={prev}
          start={msToFrames(captions[current - 1].startMs)}
          frame={frame}
          unit={unit}
          opacity={outT * gate}
          drift={-(1 - outT) * 12 * unit}
        />
      ) : null}
      <CaptionLines block={cur} start={start} frame={frame} unit={unit} opacity={gate} drift={0} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Trang tiêu đề
// ---------------------------------------------------------------------------
const TitlePage: React.FC<{ title: string; subtitle: string; letter: string; frame: number; ready: boolean }> = ({
  title, subtitle, letter, frame, ready,
}) => {
  const { width, height, safe, unit, portrait } = useLayout();
  const out = interpolate(frame, [TITLE_FRAMES - 18, TITLE_FRAMES], [1, 0], { ...clamp, easing: DISSOLVE });
  const maxW = Math.min(width - Math.max(safe.side, 96 * unit) * 2, 1300 * unit);
  const { size, lines } = fitLines(title, (portrait ? 108 : 96) * unit, 48 * unit, maxW, height * 0.3, 1.18, 4, ready);
  const monoSize = 150 * unit;
  const draw = interpolate(frame, [0, 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const letterT = interpolate(frame, [12, 32], [0, 1], { ...clamp, easing: GLIDE });
  const ruleT = interpolate(frame, [28, 50], [0, 1], { ...clamp, easing: GLIDE });
  const subT = interpolate(frame, [34, 52], [0, 1], { ...clamp, easing: GLIDE });
  const subLines = subtitle ? wrap(upper(subtitle), 30 * unit, maxW * 0.62, ready) : [];

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM, opacity: out, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", translate: `0 ${(-(1 - out) * 10 * unit).toFixed(1)}px` }}>
        <Monogram letter={letter} size={monoSize} unit={unit} draw={draw} letterT={letterT} />
        <div style={{ height: 56 * unit }} />
        {lines.map((line, k) => {
          const t = interpolate(frame, [14 + k * 6, 38 + k * 6], [0, 1], { ...clamp, easing: GLIDE });
          return (
            <div
              key={k}
              style={{
                fontFamily: SERIF, fontWeight: 400, fontSize: size, lineHeight: 1.18, color: INK, whiteSpace: "nowrap",
                opacity: t, translate: `0 ${((1 - t) * 22 * unit).toFixed(1)}px`,
              }}
            >
              {line.words.map((w) => w.text).join(" ")}
            </div>
          );
        })}
        <div style={{ height: 44 * unit }} />
        <div style={{ width: 120 * unit, height: Math.max(1, 1.5 * unit), backgroundColor: GOLD, scale: `${ruleT.toFixed(3)} 1` }} />
        <div style={{ height: 40 * unit }} />
        {subLines.map((line, k) => (
          <Kicker
            key={k}
            text={line.words.map((w) => w.text).join(" ")}
            size={26 * unit}
            style={{ opacity: subT, translate: `0 ${((1 - subT) * 12 * unit).toFixed(1)}px`, lineHeight: 1.7 }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
export const LuxuryStyle: React.FC<ShortProps> = ({ title, subtitle, captions, scenes, showTitle }) => {
  ensureFonts(["montserrat"]);
  const ready = useFontReady("playfair");
  const frame = useCurrentFrame();
  const layout = useLuxLayout();
  const { unit } = layout;
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const active = Math.max(0, activeIndexAt(pages, frame));
  const startOf = (i: number) => (i === 0 ? 0 : msToFrames(pages[i].startMs));
  const endOf = (i: number) => (i === pages.length - 1 ? Math.max(startOf(i) + 1, msToFrames(pages[i].endMs)) : startOf(i + 1));

  // Monogram: chữ cái đầu của tiêu đề.
  const source = (title.trim() || "·").normalize("NFC");
  const letter = upper([...source][0] ?? "·");

  // Sau trang tiêu đề: trang cảnh đầu hiện dần lên dưới lớp tiêu đề đang tan.
  const reveal = showTitle ? interpolate(frame, [TITLE_FRAMES - 20, TITLE_FRAMES + 6], [0, 1], { ...clamp, easing: DISSOLVE }) : 1;
  const gate = showTitle ? interpolate(frame, [TITLE_FRAMES - 8, TITLE_FRAMES + 4], [0, 1], clamp) : 1;
  const monoT = showTitle ? interpolate(frame, [TITLE_FRAMES - 4, TITLE_FRAMES + 20], [0, 1], { ...clamp, easing: GLIDE }) : 1;
  const monoDraw = showTitle ? interpolate(frame, [TITLE_FRAMES - 4, TITLE_FRAMES + 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;

  // Cảnh cũ nằm yên bên dưới cho tới khi cảnh mới hoà tan xong.
  const dissolving = active > 0 && frame < startOf(active) + DISSOLVE_FRAMES;
  const layers = dissolving ? [active - 1, active] : [active];

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM, overflow: "hidden" }}>
      {layers.map((i) => (
        <AbsoluteFill
          key={`scene-${i}`}
          style={{
            opacity: i === 0
              ? reveal
              : interpolate(frame, [startOf(i), startOf(i) + DISSOLVE_FRAMES], [0, 1], { ...clamp, easing: DISSOLVE }),
          }}
        >
          <SceneLayer scene={pages[i]} from={startOf(i)} until={endOf(i)} layout={layout} frame={frame} ready={ready} />
        </AbsoluteFill>
      ))}

      <CaptionLayer captions={captions} scenes={pages} layout={layout} frame={frame} ready={ready} gate={gate} />

      <div
        style={{
          position: "absolute",
          left: layout.mono.cx - layout.mono.size / 2,
          top: layout.mono.cy - layout.mono.size / 2,
          opacity: monoT,
        }}
      >
        <Monogram letter={letter} size={layout.mono.size} unit={unit} draw={monoDraw} letterT={monoT} />
      </div>

      {showTitle && frame < TITLE_FRAMES ? (
        <TitlePage title={title} subtitle={subtitle} letter={letter} frame={frame} ready={ready} />
      ) : null}

      {/* Giấy: sáng giữa, ngả ấm ra mép, hạt giấy tĩnh rất nhẹ. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 58%, rgba(120, 92, 55, 0.12) 100%)", pointerEvents: "none" }} />
      <Grain opacity={0.22} animated={false} baseFrequency={0.85} />
    </AbsoluteFill>
  );
};
