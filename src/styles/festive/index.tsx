/**
 * Phong cách "Lễ hội Tết": nền đỏ son có hoạ tiết mây vàng mờ, viền lá vàng đôi có hoa văn góc, hai lồng đèn đỏ
 * đung đưa ở góc trên, cánh mai vàng / đào hồng rơi lả tả, ánh kim chợt loé. Ảnh của cảnh nằm trong khung vàng
 * bo tròn viền đôi, phóng chậm. Phụ đề chữ tròn trắng ngà trên dải lụa đỏ thẫm có hai trục cuộn vàng ở phần ba dưới.
 * `tag` là con dấu đỏ chữ vàng đóng lên mép trên khung ảnh; `punch` bắn pháo hoa sau dải lụa, cụm từ chuyển vàng
 * phát sáng và nảy lên, mưa xu vàng + bao lì xì; `visual` stat là bao lì xì có con số, badge là đồng xu mạ vàng.
 * Cảnh không ảnh thành tấm thiệp chúc: khung vàng lớn, cành mai/đào vẽ dần, lời chúc chữ có chân cỡ lớn ở giữa.
 * Xem skill `.claude/skills/style-festive/SKILL.md`.
 *
 * Dọc (9:16, 3:4, 1:1): khung ảnh trên, dải lụa dưới. Ngang (16:9, 2:1): khung ảnh trái, dải lụa ở cột phải.
 *
 * Thứ tự lớp: nền đỏ → cảnh (cũ dưới, mới hiện lên trên) → cành hoa cột phải (ngang) → cánh hoa rơi → pháo hoa →
 * mưa xu → bao lì xì / đồng xu của cảnh → phụ đề → con dấu → màn tiêu đề → lồng đèn → ánh kim.
 */
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, useLayout } from "../shared";
import { findPunch } from "../whiteboard/written";
import {
  BlossomBranch, Burst, Cloud, CoinMedal, EnvelopeCard, FallingPetals, Flower, FoilDefs, Lantern, LuckyRain, RedBackdrop, Sparkles,
} from "./Decor";
import {
  clamp, CREAM, EASE_OUT, FESTIVE_FONTS, GOLD, GOLD_DEEP, GOLD_FOIL, GOLD_LIGHT, POP, RED, RED_BRIGHT, RED_DARK, RED_DEEP, ROUND, SERIF,
  sizeFor, upper,
} from "./palette";

/** Số frame cảnh mới hiện lên trên cảnh cũ. */
const FADE_FRAMES = 14;
/** Số frame một chùm pháo hoa. */
const BURST_FRAMES = 38;

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };

type FestiveLayout = {
  /** Ngang: khung ảnh trái, dải lụa cột phải. */
  split: boolean;
  unit: number;
  width: number;
  height: number;
  /** Khung ảnh. */
  panel: Rect;
  /** Vùng dải lụa phụ đề (dải canh giữa vùng này). */
  cap: Rect;
  /** Tấm thiệp khi cảnh không ảnh — gộp khung ảnh + vùng phụ đề. */
  card: Rect;
  lantern: { w: number; xs: [number, number] };
};

const useFestiveLayout = (): FestiveLayout => {
  const { width, height, safe, unit } = useLayout();
  if (width / height >= 1.2) {
    const top = Math.max(safe.top, 70 * unit) + 20 * unit;
    const bottom = height - Math.max(safe.bottom, 80 * unit);
    const px = 160 * unit;
    const pw = width * 0.5;
    const x0 = px + pw + 70 * unit;
    const x1 = width - 150 * unit;
    const panel = { x: px, y: top, w: pw, h: bottom - top };
    return {
      split: true, unit, width, height, panel,
      cap: { x: x0, y: top + panel.h * 0.28, w: x1 - x0, h: panel.h * 0.5 },
      card: { x: px, y: top, w: x1 - px, h: panel.h },
      lantern: { w: 84 * unit, xs: [78 * unit, width - 78 * unit] },
    };
  }
  const tall = height / width > 1.5;
  const side = Math.max(safe.side * 0.72, 80 * unit);
  const panelTop = safe.top + (tall ? 190 : 110) * unit;
  const bottom = height - safe.bottom;
  const capH = (tall ? 380 : 270) * unit;
  const gap = 34 * unit;
  const w = width - side * 2;
  return {
    split: false, unit, width, height,
    panel: { x: side, y: panelTop, w, h: bottom - capH - gap - panelTop },
    cap: { x: side - 14 * unit, y: bottom - capH, w: w + 28 * unit, h: capH },
    card: { x: side, y: panelTop, w, h: bottom - panelTop },
    lantern: { w: (tall ? 112 : 84) * unit, xs: [78 * unit, width - 78 * unit] },
  };
};

// ---------------------------------------------------------------------------
// Khung ảnh / tấm thiệp của một cảnh
// ---------------------------------------------------------------------------

/** Khung vàng bo tròn viền đôi: dải lá vàng ngoài → rãnh đỏ → chỉ vàng trong. Hoa thị vàng ở bốn góc. */
const GoldFrame: React.FC<{ box: Rect; unit: number; children: React.ReactNode }> = ({ box, unit, children }) => {
  const r = 30 * unit;
  const rosette = 26 * unit;
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h }}>
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: r, background: GOLD_FOIL, padding: 7 * unit, boxSizing: "border-box",
          boxShadow: `0 0 ${46 * unit}px rgba(255, 196, 80, 0.42), 0 ${22 * unit}px ${50 * unit}px rgba(40, 0, 4, 0.6)`,
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: r - 7 * unit, backgroundColor: RED_DEEP, padding: 6 * unit, boxSizing: "border-box" }}>
          <div
            style={{
              position: "relative", width: "100%", height: "100%", borderRadius: r - 13 * unit, overflow: "hidden",
              boxShadow: `0 0 0 ${2.5 * unit}px ${GOLD}`, backgroundColor: RED_DARK,
            }}
          >
            {children}
          </div>
        </div>
      </div>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        {[
          [rosette * 0.35, rosette * 0.35], [box.w - rosette * 0.35, rosette * 0.35],
          [rosette * 0.35, box.h - rosette * 0.35], [box.w - rosette * 0.35, box.h - rosette * 0.35],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <Flower r={rosette} color={GOLD} core={RED_BRIGHT} rotate={i * 18} />
          </g>
        ))}
      </svg>
    </div>
  );
};

/** Nền trong tấm thiệp: đỏ thẫm có mây vàng mờ + cành mai (dưới trái) và cành đào (trên phải) vẽ dần. */
const CardFace: React.FC<{ box: Rect; unit: number; grow: number }> = ({ box, unit, grow }) => {
  const s = Math.min(box.w, box.h) / 620;
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, ${RED} 0%, ${RED_DEEP} 70%, ${RED_DARK} 100%)` }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {[0.12, 0.62].map((fy, r) =>
          [0.08, 0.58].map((fx, c) => (
            <Cloud key={`${r}-${c}`} x={box.w * (fx + (r ? 0.12 : 0))} y={box.h * fy} scale={1.6 * unit} opacity={0.1} />
          )),
        )}
        <BlossomBranch scale={s * 1.25} kind="mai" grow={grow} transform={`translate(${-6 * unit} ${box.h + 4 * unit})`} />
        <BlossomBranch scale={s * 1.05} kind="dao" grow={grow} transform={`translate(${box.w + 6 * unit} ${-4 * unit}) rotate(180)`} />
      </svg>
    </div>
  );
};

/** Con số của cảnh: bao lì xì (stat) hoặc đồng xu mạ vàng (badge). */
const VisualMark: React.FC<{ visual: NonNullable<Scene["visual"]>; size: number; unit: number }> = ({ visual, size, unit }) =>
  visual.type === "stat"
    ? <EnvelopeCard width={size} text={visual.text} caption={visual.caption} unit={unit} />
    : <CoinMedal size={size} text={visual.text} caption={visual.caption} unit={unit} />;

/** Chiều cao của VisualMark theo bề rộng — để đặt vừa khung. */
const visualHeight = (visual: NonNullable<Scene["visual"]>, size: number, unit: number) =>
  visual.type === "stat" ? size * 1.36 : size + (visual.caption ? 70 * unit : 0);

/**
 * Một cảnh, vẽ làm hai lượt: `base` (khung ảnh / tấm thiệp) nằm dưới cánh hoa rơi và mưa xu; `mark` (bao lì xì /
 * đồng xu của `visual`) vẽ lại phía trên để cánh hoa, xu rơi không che mất con số và chú thích.
 */
const SceneLayer: React.FC<{ scene: Scene; from: number; until: number; layout: FestiveLayout; frame: number; part: "base" | "mark" }> = ({
  scene, from, until, layout, frame, part,
}) => {
  const { unit, panel, card } = layout;
  const visT = interpolate(frame, [from + 12, from + 30], [0, 1], { ...clamp, easing: POP });
  if (!scene.image) {
    // Tấm thiệp: con số (nếu có) nằm phần trên, lời chúc do lớp phụ đề vẽ ở giữa.
    const grow = interpolate(frame, [from + 4, from + 50], [0, 1], { ...clamp, easing: EASE_OUT });
    const vw = scene.visual ? cardVisualWidth(layout, scene.visual) : 0;
    const vy = cardVisualTop(layout);
    return (
      <AbsoluteFill>
        {part === "base" ? (
          <GoldFrame box={card} unit={unit}>
            <CardFace box={card} unit={unit} grow={grow} />
          </GoldFrame>
        ) : null}
        {part === "mark" && scene.visual ? (
          <div
            style={{
              position: "absolute", left: card.x + card.w / 2 - vw / 2, top: vy,
              opacity: Math.min(1, visT * 2), scale: String(0.6 + 0.4 * visT), rotate: `${(-4 * (1 - visT) + (scene.visual.type === "stat" ? -3 : 0)).toFixed(2)}deg`,
            }}
          >
            <VisualMark visual={scene.visual} size={vw} unit={unit} />
          </div>
        ) : null}
      </AbsoluteFill>
    );
  }
  const vw = scene.visual ? Math.min(210 * unit, (panel.h * 0.52) / (scene.visual.type === "stat" ? 1.36 : 1.3)) : 0;
  const vh = scene.visual ? visualHeight(scene.visual, vw, unit) : 0;
  return (
    <AbsoluteFill>
      {part === "base" ? (
        <GoldFrame box={panel} unit={unit}>
          <SceneMedia scene={scene} from={from} zoom={interpolate(frame, [from, until + FADE_FRAMES], [1, 1.08], clamp)} />
          {/* Ấm màu nhẹ + tối mép trong để ảnh hoà vào khung đỏ vàng. */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(60, 4, 8, 0.45) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255, 150, 60, 0.06)", mixBlendMode: "multiply" }} />
        </GoldFrame>
      ) : null}
      {part === "mark" && scene.visual ? (
        <div
          style={{
            position: "absolute",
            left: panel.x + panel.w - vw - 34 * unit,
            top: panel.y + panel.h - vh - 34 * unit,
            opacity: Math.min(1, visT * 2),
            scale: String(0.5 + 0.5 * visT),
            rotate: `${(6 - 10 * (1 - visT)).toFixed(2)}deg`,
            transformOrigin: "50% 100%",
          }}
        >
          <VisualMark visual={scene.visual} size={vw} unit={unit} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Mép trên của con số trong tấm thiệp (chừa chỗ con dấu). */
const cardVisualTop = (layout: FestiveLayout) => layout.card.y + (layout.split ? 110 : 130) * layout.unit;

/** Bề rộng con số trong tấm thiệp — thiệp thấp (1:1) thì nhỏ lại, chừa chỗ cho lời chúc. */
const cardVisualWidth = (layout: FestiveLayout, visual: NonNullable<Scene["visual"]>) => {
  const { card, unit } = layout;
  const maxH = card.h * (layout.split ? 0.4 : 0.34);
  return Math.min(250 * unit, card.w * 0.34, visual.type === "stat" ? maxH / 1.36 : maxH - (visual.caption ? 70 * unit : 0));
};

/** Vùng lời chúc trong tấm thiệp — dưới con số nếu có. */
const cardTextZone = (layout: FestiveLayout, visual: Scene["visual"]): Rect => {
  const { card, unit } = layout;
  const top = card.y + 110 * unit;
  const bottom = card.y + card.h - 90 * unit;
  const side = layout.split ? 0.16 : 0.1;
  if (!visual) return { x: card.x + card.w * side, y: top, w: card.w * (1 - side * 2), h: bottom - top };
  const vw = cardVisualWidth(layout, visual);
  const vTop = cardVisualTop(layout) + visualHeight(visual, vw, unit) + 30 * unit;
  return { x: card.x + card.w * side, y: vTop, w: card.w * (1 - side * 2), h: Math.max(160 * unit, bottom - vTop) };
};

// ---------------------------------------------------------------------------
// Con dấu (tag)
// ---------------------------------------------------------------------------

/** Con dấu đỏ chữ vàng, viền vàng đôi — đóng xuống mép trên khung ảnh / tấm thiệp. */
const Seal: React.FC<{ text: string; cx: number; cy: number; unit: number; t: number; maxW: number }> = ({ text, cx, cy, unit, t, maxW }) => {
  const label = upper(text);
  // Tới 3 ký tự ("TẾT", "LỘC"): dấu vuông; dài hơn: dấu chữ nhật.
  const short = [...label].length <= 3;
  const fs = short ? 58 * unit : sizeFor(label, 44 * unit, 12, 0.62);
  return (
    <div
      style={{
        position: "absolute", left: cx, top: cy, translate: "-50% -50%",
        opacity: Math.min(1, t * 3), scale: String(1.7 - 0.7 * t), rotate: `${(-4 - 8 * (1 - t)).toFixed(2)}deg`,
      }}
    >
      <div
        style={{
          minWidth: short ? 128 * unit : undefined, height: short ? 128 * unit : undefined, maxWidth: maxW,
          padding: short ? 0 : `${14 * unit}px ${30 * unit}px ${10 * unit}px`,
          display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
          borderRadius: 12 * unit, background: `linear-gradient(145deg, ${RED_BRIGHT}, ${RED} 60%, ${RED_DEEP})`,
          border: `${4 * unit}px solid ${GOLD}`,
          boxShadow: `inset 0 0 0 ${6 * unit}px ${RED_BRIGHT}, inset 0 0 0 ${7.5 * unit}px ${GOLD}, 0 ${10 * unit}px ${24 * unit}px rgba(40, 0, 4, 0.55), 0 0 ${22 * unit}px rgba(255, 190, 70, 0.35)`,
          fontFamily: ROUND, fontWeight: 800, fontSize: fs, lineHeight: 1.3, color: GOLD, textAlign: "center",
          textShadow: `0 ${2 * unit}px 0 ${RED_DARK}`,
          paddingTop: short ? fs * 0.12 : undefined,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phụ đề: dải lụa (cảnh có ảnh) hoặc lời chúc trên thiệp (cảnh không ảnh)
// ---------------------------------------------------------------------------

/** Chữ của câu, cụm nhấn chuyển vàng phát sáng và nảy lên lúc `at`. */
const Words: React.FC<{ text: string; punch: [number, number] | null; at: number; frame: number; base: string; unit: number }> = ({
  text, punch, at, frame, base, unit,
}) => {
  const words = text.normalize("NFC").split(/\s+/).filter(Boolean);
  const p = interpolate(frame, [at, at + 8], [0, 1], clamp);
  const pop = interpolate(frame, [at, at + 7, at + 18], [1, 1.14, 1], { ...clamp, easing: EASE_OUT });
  return (
    <>
      {words.map((w, i) => {
        const hit = punch !== null && i >= punch[0] && i <= punch[1];
        return (
          <span key={i}>
            {i > 0 ? " " : ""}
            <span
              style={
                hit
                  ? {
                    display: "inline-block",
                    // Chữ nảy to ra lấn vào khoảng trắng — chừa thêm hai bên.
                    margin: "0 0.05em",
                    color: interpolateColors(p, [0, 1], [base, GOLD_LIGHT]),
                    scale: String(pop),
                    textShadow: `0 0 ${(18 * p * unit).toFixed(1)}px rgba(255, 200, 70, ${(0.9 * p).toFixed(2)}), 0 ${2 * unit}px 0 ${GOLD_DEEP}`,
                  }
                  : undefined
              }
            >
              {w}
            </span>
          </span>
        );
      })}
    </>
  );
};

/** Dải lụa đỏ thẫm viền vàng, hai trục cuộn vàng hai đầu. `open` 0→1: trải từ giữa ra. */
const Ribbon: React.FC<{ zone: Rect; unit: number; open: number; opacity: number; children: React.ReactNode }> = ({
  zone, unit, open, opacity, children,
}) => {
  const rod = 26 * unit;
  return (
    <div
      style={{
        position: "absolute", left: zone.x, width: zone.w, top: zone.y + zone.h / 2, translate: "0 -50%",
        opacity, scale: `${(0.12 + 0.88 * open).toFixed(3)} 1`,
      }}
    >
      <div
        style={{
          position: "relative", margin: `0 ${rod * 0.55}px`, minHeight: 150 * unit, boxSizing: "border-box",
          padding: `${26 * unit}px ${46 * unit}px ${24 * unit}px`, display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(180deg, #9a0d16 0%, ${RED_DEEP} 55%, #5a050c 100%)`,
          borderTop: `${4 * unit}px solid ${GOLD}`, borderBottom: `${4 * unit}px solid ${GOLD}`,
          boxShadow: `0 ${16 * unit}px ${36 * unit}px rgba(40, 0, 4, 0.55)`,
        }}
      >
        {/* Chỉ vàng mảnh trong + hoạ tiết mây mờ hai đầu. */}
        <div style={{ position: "absolute", inset: `${9 * unit}px ${14 * unit}px`, border: `${1.5 * unit}px solid rgba(242, 193, 78, 0.55)`, pointerEvents: "none" }} />
        {children}
      </div>
      {[0, 1].map((side) => (
        <div
          key={side}
          style={{
            position: "absolute", top: -16 * unit, bottom: -16 * unit, width: rod, [side ? "right" : "left"]: 0, borderRadius: rod / 2,
            background: `linear-gradient(90deg, ${GOLD_DEEP} 0%, ${GOLD_LIGHT} 40%, ${GOLD} 60%, ${GOLD_DEEP} 100%)`,
            boxShadow: `0 ${6 * unit}px ${14 * unit}px rgba(40, 0, 4, 0.5)`,
          }}
        />
      ))}
    </div>
  );
};

type CapInfo = {
  caption: Caption;
  scene: Scene;
  sceneIndex: number;
  card: boolean;
  start: number;
  punch: [number, number] | null;
  punchAt: number;
  /** Câu nhấn không nằm nguyên văn trong câu nào của cảnh: in thêm thành dòng vàng. */
  extra: string | null;
};

const CaptionLayer: React.FC<{
  captions: Caption[]; pages: Scene[]; layout: FestiveLayout; frame: number; gate: number; titleEnd: number;
}> = ({ captions, pages, layout, frame, gate, titleEnd }) => {
  const current = activeIndexAt(captions, frame);
  if (current < 0 || gate <= 0) return null;
  const { unit, split } = layout;
  const sceneIndexOf = (c: Caption) => Math.max(0, activeIndexAt(pages, msToFrames(c.startMs)));

  const info = (i: number): CapInfo => {
    const caption = captions[i];
    const sceneIndex = sceneIndexOf(caption);
    const scene = pages[sceneIndex];
    const start = Math.max(msToFrames(caption.startMs), titleEnd);
    const punchAt = scene.punch ? Math.max(msToFrames(scene.punch.atMs), start + 4) : 1e9;
    const punch = scene.punch ? findPunch(caption.text, scene.punch.text) : null;
    let extra: string | null = null;
    if (scene.punch) {
      const inScene = captions.some((c) => sceneIndexOf(c) === sceneIndex && findPunch(c.text, scene.punch!.text));
      const owner = activeIndexAt(captions, msToFrames(scene.punch.atMs));
      if (!inScene && (owner === i || (owner < 0 && i === 0))) extra = scene.punch.text;
    }
    return { caption, scene, sceneIndex, card: !scene.image, start, punch, punchAt, extra };
  };

  const cur = info(current);
  const prev = current > 0 ? info(current - 1) : null;
  const textIn = interpolate(frame, [cur.start, cur.start + 9], [0, 1], { ...clamp, easing: EASE_OUT });

  if (cur.card) {
    const zone = cardTextZone(layout, cur.scene.visual);
    // Vùng thấp (thiệp 1:1 có con số) thì hạ cỡ gốc để 3 dòng vẫn vừa.
    const size = sizeFor(cur.caption.text, Math.min((split ? 76 : 84) * unit, zone.h * 0.3), 26, 0.5);
    const orn = interpolate(frame, [cur.start, cur.start + 16], [0, 1], { ...clamp, easing: EASE_OUT });
    const extraT = interpolate(frame, [cur.punchAt, cur.punchAt + 10], [0, 1], { ...clamp, easing: POP });
    return (
      <div
        style={{
          position: "absolute", left: zone.x, top: zone.y, width: zone.w, height: zone.h, opacity: gate,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 * unit,
        }}
      >
        <Divider unit={unit} t={orn} />
        <div
          style={{
            fontFamily: SERIF, fontWeight: 700, fontSize: size, lineHeight: 1.36, color: CREAM, textAlign: "center",
            textShadow: `0 ${3 * unit}px ${10 * unit}px rgba(40, 0, 4, 0.7), 0 0 ${24 * unit}px rgba(74, 4, 10, 0.9)`,
            opacity: textIn, translate: `0 ${((1 - textIn) * 20 * unit).toFixed(1)}px`,
          }}
        >
          <Words text={cur.caption.text} punch={cur.punch} at={cur.punchAt} frame={frame} base={CREAM} unit={unit} />
        </div>
        {cur.extra ? (
          <div
            style={{
              fontFamily: SERIF, fontWeight: 800, fontSize: size * 0.8, lineHeight: 1.3, color: GOLD_LIGHT, textAlign: "center",
              opacity: Math.min(1, extraT * 2), scale: String(0.7 + 0.3 * extraT),
              textShadow: `0 0 ${18 * unit}px rgba(255, 200, 70, 0.8), 0 ${2 * unit}px 0 ${GOLD_DEEP}`,
            }}
          >
            {cur.extra}
          </div>
        ) : null}
        <Divider unit={unit} t={orn} />
      </div>
    );
  }

  // Dải lụa: trải ra khi câu đầu tiên của một chuỗi cảnh có ảnh bắt đầu; các câu sau chỉ đổi chữ.
  const fresh = !prev || prev.card;
  const open = fresh ? interpolate(frame, [cur.start, cur.start + 14], [0, 1], { ...clamp, easing: EASE_OUT }) : 1;
  const zone = layout.cap;
  const size = sizeFor(cur.caption.text, (split ? 54 : 60) * unit, 48, 0.64);
  const extraT = interpolate(frame, [cur.punchAt, cur.punchAt + 10], [0, 1], { ...clamp, easing: POP });
  return (
    <>
      <Ribbon zone={zone} unit={unit} open={open} opacity={gate * Math.min(1, open * 3)}>
        <div
          style={{
            position: "relative", fontFamily: ROUND, fontWeight: 700, fontSize: size, lineHeight: 1.32, color: CREAM, textAlign: "center",
            textShadow: `0 ${2 * unit}px ${6 * unit}px rgba(30, 0, 4, 0.7)`,
            opacity: fresh ? Math.max(0, open * 2 - 1) * textIn : textIn,
            translate: `0 ${((1 - textIn) * 14 * unit).toFixed(1)}px`,
          }}
        >
          <Words text={cur.caption.text} punch={cur.punch} at={cur.punchAt} frame={frame} base={CREAM} unit={unit} />
        </div>
      </Ribbon>
      {cur.extra ? (
        <div
          style={{
            position: "absolute", left: zone.x, width: zone.w, top: zone.y - 6 * unit, display: "flex", justifyContent: "center",
            opacity: gate * Math.min(1, extraT * 2), scale: String(0.6 + 0.4 * extraT), translate: "0 -50%",
          }}
        >
          <div
            style={{
              fontFamily: ROUND, fontWeight: 800, fontSize: size * 0.9, lineHeight: 1.3, color: RED_DARK, textAlign: "center",
              padding: `${8 * unit}px ${30 * unit}px ${4 * unit}px`, borderRadius: 60 * unit, background: GOLD_FOIL,
              boxShadow: `0 0 ${26 * unit}px rgba(255, 200, 70, 0.7), 0 ${8 * unit}px ${18 * unit}px rgba(40, 0, 4, 0.5)`,
            }}
          >
            {cur.extra}
          </div>
        </div>
      ) : null}
    </>
  );
};

/** Gạch vàng có hình thoi giữa — trang trí trên/dưới lời chúc. */
const Divider: React.FC<{ unit: number; t: number }> = ({ unit, t }) => (
  <svg width={260 * unit} height={24 * unit} viewBox="0 0 260 24" style={{ opacity: t, scale: `${(0.3 + 0.7 * t).toFixed(3)} 1`, flexShrink: 0 }}>
    <path d="M10 12 L112 12 M148 12 L250 12" stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
    <path d="M130 2 L140 12 L130 22 L120 12 Z" fill={GOLD} />
    <circle cx={106} cy={12} r={3} fill={GOLD} />
    <circle cx={154} cy={12} r={3} fill={GOLD} />
  </svg>
);

/** Khung ngang: cột chữ bên phải có cành đào rủ từ trên và cành mai vươn từ dưới, kẹp dải lụa ở giữa. */
const ColumnBranches: React.FC<{ layout: FestiveLayout; opacity: number; frame: number }> = ({ layout, opacity, frame }) => {
  const { cap, panel, unit, width, height } = layout;
  const sway = Math.sin(frame / 30) * 1.5;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}>
      <BlossomBranch scale={unit * 1.3} kind="dao" grow={1} transform={`translate(${cap.x + cap.w + 20 * unit} ${panel.y + 30 * unit}) rotate(${168 + sway})`} />
      <BlossomBranch scale={unit * 1.3} kind="mai" grow={1} transform={`translate(${cap.x - 10 * unit} ${panel.y + panel.h - 20 * unit}) rotate(${-8 - sway})`} />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Pháo hoa + mưa xu cho câu nhấn
// ---------------------------------------------------------------------------

const PunchFx: React.FC<{ pages: Scene[]; layout: FestiveLayout; frame: number; titleEnd: number; startOf: (i: number) => number }> = ({
  pages, layout, frame, titleEnd, startOf,
}) => {
  const { unit, width, height } = layout;
  const bursts: React.ReactNode[] = [];
  pages.forEach((scene, i) => {
    if (!scene.punch) return;
    const at = Math.max(msToFrames(scene.punch.atMs), titleEnd, startOf(i));
    if (frame < at || frame > at + 14 + BURST_FRAMES) return;
    const zone = scene.image ? layout.cap : cardTextZone(layout, scene.visual);
    const cx = zone.x + zone.w / 2;
    const cy = zone.y + zone.h / 2;
    const spots: [number, number, number][] = scene.image
      ? [[cx - zone.w * 0.3, cy - zone.h * 0.5, 210], [cx + zone.w * 0.3, cy - zone.h * 0.38, 175], [cx, cy - zone.h * 0.85, 235]]
      : [
        [layout.card.x + layout.card.w * (layout.split ? 0.13 : 0.2), zone.y + zone.h * 0.18, 150],
        [layout.card.x + layout.card.w * (layout.split ? 0.87 : 0.8), zone.y + zone.h * 0.26, 140],
        [cx, zone.y + 10 * unit, 170],
      ];
    spots.forEach(([x, y, r], k) => {
      const t = (frame - at - k * 7) / BURST_FRAMES;
      bursts.push(<Burst key={`${i}-${k}`} cx={x} cy={y} radius={r * unit} t={t} seed={`fe-b-${i}-${k}`} unit={unit} />);
    });
  });
  if (bursts.length === 0) return null;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "screen" }}>
      {bursts}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Màn tiêu đề
// ---------------------------------------------------------------------------

const TITLE_BURSTS: [number, number, number, number][] = [
  // [frame, x (tỉ lệ bề rộng), y (tỉ lệ chiều cao), bán kính]
  [4, 0.24, 0.2, 230], [11, 0.76, 0.27, 200], [19, 0.5, 0.12, 260], [28, 0.28, 0.8, 190], [34, 0.72, 0.76, 210],
];

const TitleIntro: React.FC<{ title: string; subtitle: string; handle: string; layout: FestiveLayout; frame: number }> = ({
  title, subtitle, handle, layout, frame,
}) => {
  const { unit, width, height, split } = layout;
  const out = interpolate(frame, [TITLE_FRAMES - 14, TITLE_FRAMES], [1, 0], clamp);
  const unroll = interpolate(frame, [8, 32], [0, 1], { ...clamp, easing: EASE_OUT });
  const subT = interpolate(frame, [30, 44], [0, 1], { ...clamp, easing: EASE_OUT });
  const handleT = interpolate(frame, [38, 52], [0, 1], clamp);
  const scrollW = split ? Math.min(1060 * unit, width * 0.6) : Math.min(width - 150 * unit * 2, 860 * unit);
  const titleSize = sizeFor(title, (split ? 96 : 100) * unit, 16, 0.5);
  const rodW = scrollW + 60 * unit;
  const rod = (
    <div style={{ position: "relative", width: rodW, height: 30 * unit, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: 15 * unit,
          background: `linear-gradient(180deg, ${GOLD_DEEP} 0%, ${GOLD_LIGHT} 40%, ${GOLD} 60%, ${GOLD_DEEP} 100%)`,
          boxShadow: `0 ${8 * unit}px ${18 * unit}px rgba(40, 0, 4, 0.5)`,
        }}
      />
      {[0, 1].map((s) => (
        <div
          key={s}
          style={{
            position: "absolute", top: -7 * unit, width: 44 * unit, height: 44 * unit, borderRadius: "50%", [s ? "right" : "left"]: -14 * unit,
            background: GOLD_FOIL, boxShadow: `0 ${4 * unit}px ${10 * unit}px rgba(40, 0, 4, 0.5)`,
          }}
        />
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <RedBackdrop width={width} height={height} unit={unit} frame={frame} />
      <FallingPetals width={width} height={height} unit={unit} frame={frame + 400} count={18} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
        {TITLE_BURSTS.map(([f, fx, fy, r], i) => (
          <Burst key={i} cx={fx * width} cy={fy * height} radius={r * unit} t={(frame - f) / BURST_FRAMES} seed={`fe-tb-${i}`} unit={unit} />
        ))}
      </svg>
      {/* Hai lồng đèn nhỏ phía trong, thả xuống sau hai lồng đèn góc. */}
      {[0.3, 0.7].map((fx, i) => (
        <Lantern
          key={i} id={`fe-tl-${i}`} x={fx * width} top={-60 * unit} width={(split ? 70 : 86) * unit}
          rotate={Math.sin(frame / 14 + i * 2) * 4}
          drop={interpolate(frame, [8 + i * 5, 30 + i * 5], [-320 * unit, split ? -40 * unit : 20 * unit], { ...clamp, easing: POP })}
          glow={0.8}
        />
      ))}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", scale: String(1 + (1 - out) * 0.04) }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", translate: `0 ${(split ? 0 : -30 * unit).toFixed(1)}px` }}>
          {rod}
          <div style={{ width: scrollW, maxHeight: unroll * 1400 * unit, overflow: "hidden", flexShrink: 0 }}>
            <div
              style={{
                position: "relative", width: scrollW, boxSizing: "border-box", padding: `${54 * unit}px ${56 * unit}px ${50 * unit}px`,
                background: `linear-gradient(180deg, ${RED_DEEP} 0%, #8e0c14 50%, ${RED_DEEP} 100%)`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 20 * unit,
              }}
            >
              <div style={{ position: "absolute", inset: 14 * unit, border: `${2 * unit}px solid ${GOLD}`, opacity: 0.8 }} />
              <div style={{ position: "absolute", inset: 22 * unit, border: `${1 * unit}px solid ${GOLD}`, opacity: 0.45 }} />
              <svg width={scrollW} height={40 * unit} viewBox={`0 0 ${scrollW} ${40 * unit}`} style={{ flexShrink: 0 }}>
                <FoilDefs id="fe-title-foil" />
                <g transform={`translate(${scrollW / 2} ${20 * unit})`}>
                  <Flower r={16 * unit} color={GOLD} core={RED_BRIGHT} />
                  <path d={`M${-40 * unit} 0 L${-150 * unit} 0 M${40 * unit} 0 L${150 * unit} 0`} stroke="url(#fe-title-foil)" strokeWidth={3 * unit} strokeLinecap="round" />
                </g>
              </svg>
              <div
                style={{
                  position: "relative", fontFamily: SERIF, fontWeight: 800, fontSize: titleSize, lineHeight: 1.28, color: GOLD, textAlign: "center",
                  textShadow: `0 ${3 * unit}px 0 ${GOLD_DEEP}, 0 0 ${28 * unit}px rgba(255, 200, 70, 0.5)`,
                }}
              >
                {title}
              </div>
              {subtitle ? (
                <div
                  style={{
                    position: "relative", fontFamily: ROUND, fontWeight: 600, fontSize: sizeFor(subtitle, 40 * unit, 30, 0.7), lineHeight: 1.35,
                    color: CREAM, textAlign: "center", opacity: subT, translate: `0 ${((1 - subT) * 14 * unit).toFixed(1)}px`,
                  }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
          {rod}
        </div>
      </AbsoluteFill>
      {handle ? (
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: layout.height - (layout.card.y + layout.card.h) + 10 * unit,
            display: "flex", justifyContent: "center", opacity: handleT,
          }}
        >
          <div
            style={{
              fontFamily: ROUND, fontWeight: 700, fontSize: 32 * unit, lineHeight: 1.3, color: RED_DARK,
              padding: `${6 * unit}px ${28 * unit}px ${2 * unit}px`, borderRadius: 40 * unit, background: GOLD_FOIL,
              boxShadow: `0 ${6 * unit}px ${16 * unit}px rgba(40, 0, 4, 0.5)`,
            }}
          >
            {handle}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
export const FestiveStyle: React.FC<ShortProps> = ({ title, subtitle, handle, captions, scenes, showTitle }) => {
  ensureFonts(FESTIVE_FONTS);
  const frame = useCurrentFrame();
  const layout = useFestiveLayout();
  const { unit, width, height, panel, card } = layout;
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const active = Math.max(0, activeIndexAt(pages, frame));
  const startOf = (i: number) => (i === 0 ? 0 : msToFrames(pages[i].startMs));
  const endOf = (i: number) => (i === pages.length - 1 ? Math.max(startOf(i) + 1, msToFrames(pages[i].endMs)) : Math.max(startOf(i) + 1, startOf(i + 1)));

  // Nội dung cảnh (phụ đề, con dấu, câu nhấn) chờ màn tiêu đề tan.
  const titleEnd = showTitle ? TITLE_FRAMES - 8 : 0;
  const gate = showTitle ? interpolate(frame, [TITLE_FRAMES - 10, TITLE_FRAMES + 2], [0, 1], clamp) : 1;

  // Cảnh cũ nằm yên bên dưới cho tới khi cảnh mới hiện xong.
  const fading = active > 0 && frame < startOf(active) + FADE_FRAMES;
  const layers = fading ? [active - 1, active] : [active];

  const scene = pages[active];
  const sealFrom = Math.max(startOf(active), titleEnd);
  const sealT = interpolate(frame, [sealFrom + 4, sealFrom + 18], [0, 1], { ...clamp, easing: POP });
  const sealBox = scene.image ? panel : card;

  const punchStarts = pages
    .map((s, i) => (s.punch ? Math.max(msToFrames(s.punch.atMs), titleEnd, startOf(i)) : -1))
    .filter((f) => f >= 0 && frame >= f && frame <= f + 90);

  const lanternH = layout.lantern.w * (260 / 120);
  const sceneLayers = (part: "base" | "mark") =>
    layers.map((i) => (
      <AbsoluteFill
        key={`${part}-${i}`}
        style={
          i === active && fading
            ? {
              opacity: interpolate(frame, [startOf(i), startOf(i) + FADE_FRAMES], [0, 1], { ...clamp, easing: EASE_OUT }),
              scale: String(interpolate(frame, [startOf(i), startOf(i) + FADE_FRAMES], [0.97, 1], { ...clamp, easing: EASE_OUT })),
            }
            : undefined
        }
      >
        <SceneLayer scene={pages[i]} from={startOf(i)} until={endOf(i)} layout={layout} frame={frame} part={part} />
      </AbsoluteFill>
    ));
  return (
    <AbsoluteFill style={{ backgroundColor: RED, overflow: "hidden" }}>
      <RedBackdrop width={width} height={height} unit={unit} frame={frame} />

      {sceneLayers("base")}

      {layout.split ? <ColumnBranches layout={layout} opacity={scene.image ? 1 : 0} frame={frame} /> : null}
      <FallingPetals width={width} height={height} unit={unit} frame={frame} count={layout.split ? 26 : 22} />
      <PunchFx pages={pages} layout={layout} frame={frame} titleEnd={titleEnd} startOf={startOf} />
      {/* Mưa xu nằm dưới chữ để không che lời. */}
      {punchStarts.map((f) => (
        <LuckyRain key={f} width={width} height={height} unit={unit} frame={frame} start={f} seed={`fe-rain-${f}`} />
      ))}
      {sceneLayers("mark")}
      <CaptionLayer captions={captions} pages={pages} layout={layout} frame={frame} gate={gate} titleEnd={titleEnd} />

      {scene.tag ? (
        <Seal
          text={scene.tag} cx={sealBox.x + sealBox.w / 2} cy={sealBox.y + 6 * unit} unit={unit} t={sealT * gate}
          maxW={sealBox.w * 0.8}
        />
      ) : null}


      {showTitle && frame < TITLE_FRAMES ? (
        <TitleIntro title={title} subtitle={subtitle} handle={handle} layout={layout} frame={frame} />
      ) : null}

      {/* Hai lồng đèn góc: thả xuống đầu video rồi đung đưa lệch nhịp nhau. */}
      {layout.lantern.xs.map((x, i) => (
        <Lantern
          key={i} id={`fe-lan-${i}`} x={x} top={-lanternH * 0.12} width={layout.lantern.w}
          rotate={Math.sin(frame / 17 + i * 1.7) * 5}
          drop={interpolate(frame, [2 + i * 4, 28 + i * 4], [-lanternH * 1.2, 0], { ...clamp, easing: POP })}
          glow={0.7 + 0.3 * Math.sin(frame / 11 + i)}
        />
      ))}

      <Sparkles width={width} height={height} unit={unit} frame={frame} count={layout.split ? 14 : 12} />
    </AbsoluteFill>
  );
};
