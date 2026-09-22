/**
 * Phong cách "Tranh màu nước": giấy vẽ cold-press trắng ngà, mỗi cảnh là một bức tranh màu nước loang ra từ các
 * vệt cọ (mặt nạ SVG nhiễu turbulence nở dần ~26 frame), mép loang viền màu đậm kiểu nước đọng khi khô, ảnh hơi
 * nhạt màu và phủ một lớp màu nhấn pha nước. Góc tranh có đốm vẩy màu và vết loang tròn. Phụ đề viết tay (Dancing
 * Script; câu dài chuyển sang Lora) canh giữa trên nền giấy, hiện từng từ như mực thấm. Sang cảnh: tranh cũ co lại,
 * nhoè và phai như bị rửa trôi trong khi tranh mới loang lên trên. Xem skill `.claude/skills/style-watercolor/SKILL.md`.
 *
 * Dọc (9:16, 3:4, 1:1): tranh phía trên, nhãn + phụ đề phía dưới. Ngang (16:9, 2:1): tranh bên trái, cột chữ bên phải.
 *
 * Thứ tự lớp: giấy → các cảnh (cảnh cũ dưới, cảnh mới loang lên trên) → phụ đề → trang tiêu đề → vân giấy nhân lên
 * tất cả (ảnh cũng ăn vân giấy) → viền tối ấm rất nhẹ.
 */
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { useFontReady } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, seeded, useLayout } from "../shared";
import { findPunch } from "../whiteboard/written";
import {
  blobGrow, blobsFor, Blossom, Branch, BrushStroke, INK, INK_SOFT, maskUri, PAPER, paletteFor, PaperTexture,
  Splatter, WashFilter, washColor, type Corner, type Palette,
} from "./paint";
import {
  balance, fitLines, measure, SCRIPT, SCRIPT_BOLD, SCRIPT_FACE, SERIF, SERIF_FACE, wrap, type Face, type Line,
} from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Màu nước lan nhanh rồi chậm dần — không nảy. */
const SOAK = Easing.bezier(0.22, 0.61, 0.36, 1);
const WASH = Easing.bezier(0.45, 0, 0.7, 1);
/** Số frame tranh loang hết, và số frame tranh cũ bị rửa trôi. */
const REVEAL_FRAMES = 26;
const OUT_FRAMES = 24;

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };
type WcLayout = { split: boolean; unit: number; width: number; height: number; paint: Rect; text: Rect };

const useWcLayout = (): WcLayout => {
  const { width, height, safe, unit } = useLayout();
  if (width / height >= 1.2) {
    const top = Math.max(40 * unit, safe.top * 0.7);
    const paint = { x: 44 * unit, y: top, w: width * 0.56, h: height - top * 2 };
    const x0 = paint.x + paint.w + 56 * unit;
    const x1 = width - Math.max(safe.side, 90 * unit);
    // Cột chữ gom vào giữa chiều cao để nhãn nằm ngay trên phụ đề, không trôi lên mép trên.
    const textTop = Math.max(safe.top + 30 * unit, height * 0.24);
    const text = { x: x0, y: textTop, w: x1 - x0, h: Math.min(height - safe.bottom - textTop, height * 0.56) };
    return { split: true, unit, width, height, paint, text };
  }
  // Tranh được phép tràn qua vùng an toàn trên/hai bên (chỉ là hình), chữ thì nằm gọn trong vùng an toàn.
  const top = Math.max(40 * unit, safe.top * 0.6);
  const bottom = height - safe.bottom;
  const paintH = (bottom - top) * (height / width > 1.5 ? 0.63 : 0.56);
  const paint = { x: 36 * unit, y: top, w: width - 72 * unit, h: paintH };
  const side = Math.max(safe.side, 90 * unit);
  const textTop = top + paintH + 20 * unit;
  return { split: false, unit, width, height, paint, text: { x: side, y: textTop, w: width - side * 2, h: bottom - textTop } };
};

/** Nhãn (`tag`): cỡ chữ và phần chiều cao chừa trên cùng vùng chữ. */
const tagSize = (unit: number) => 44 * unit;
const TAG_RESERVE = (unit: number) => tagSize(unit) * 1.7 + 22 * unit;

// ---------------------------------------------------------------------------
// Nhãn vệt cọ
// ---------------------------------------------------------------------------
const TagLabel: React.FC<{ text: string; zone: Rect; unit: number; from: number; frame: number; palette: Palette; id: string; ready: boolean }> = ({
  text, zone, unit, from, frame, palette, id, ready,
}) => {
  const size = tagSize(unit);
  const face = SCRIPT_BOLD;
  const tw = Math.min(measure(text, size, face, ready), zone.w - 80 * unit);
  const fontSize = Math.min(size, size * ((zone.w - 80 * unit) / Math.max(1, measure(text, size, face, ready))));
  const w = tw + 90 * unit;
  const h = size * 1.35;
  const draw = interpolate(frame, [from + 8, from + 26], [0, 1], { ...clamp, easing: SOAK });
  const textT = interpolate(frame, [from + 16, from + 32], [0, 1], { ...clamp, easing: SOAK });
  return (
    <div style={{ position: "absolute", left: zone.x + zone.w / 2 - w / 2, top: zone.y, width: w, height: h }}>
      <BrushStroke id={id} w={w} h={h} color={palette.wash} draw={draw} opacity={0.55} seed={9} style={{ left: -h * 0.35, top: -h * 0.35 }} />
      <div
        style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          fontFamily: SCRIPT, fontWeight: 700, fontSize, lineHeight: 1, color: INK, whiteSpace: "nowrap",
          opacity: textT, filter: `blur(${((1 - textT) * 4 * unit).toFixed(2)}px)`,
          // Dancing Script đặt chữ hơi cao trong hộp — hạ xuống cho nằm giữa nét cọ.
          paddingTop: fontSize * 0.08,
        }}
      >
        {text.normalize("NFC")}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Con số trong vết loang tròn
// ---------------------------------------------------------------------------
const StatBloom: React.FC<{
  visual: NonNullable<Scene["visual"]>; cx: number; cy: number; r: number; t: number; palette: Palette; id: string; unit: number; ready: boolean;
}> = ({ visual, cx, cy, r, t, palette, id, unit, ready }) => {
  if (t <= 0) return null;
  const grow = SOAK(t);
  const size = r * 3;
  const face = SCRIPT_BOLD;
  const base = visual.type === "stat" ? r * 0.78 : r * 0.46;
  const numSize = Math.min(base, (r * 1.5 / Math.max(1, measure(visual.text, base, face, ready))) * base);
  const capSize = Math.max(20 * unit, r * 0.14);
  const capFace: Face = { ...SERIF_FACE, italic: true };
  const capLines = visual.caption
    ? balance(visual.caption, capSize, r * 1.55, wrap(visual.caption, capSize, r * 1.55, capFace, ready), capFace, ready).slice(0, 2)
    : [];
  const textT = interpolate(t, [0.35, 1], [0, 1], clamp);
  const second = washColor(palette, id, 1);
  return (
    <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ position: "absolute", overflow: "visible" }}>
        <defs>
          <WashFilter id={id} seed={17} frequency={1.6 / r} displace={r * 0.16} soft={r * 0.07} />
          <radialGradient id={`${id}-g`}>
            <stop offset="0%" stopColor={palette.wash} stopOpacity={0.2} />
            <stop offset="75%" stopColor={palette.wash} stopOpacity={0.36} />
            <stop offset="100%" stopColor={palette.wash} stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <g filter={`url(#${id})`} transform={`scale(${(0.55 + 0.45 * grow).toFixed(3)})`} opacity={Math.min(1, grow * 1.5)}>
          {/* Lót giấy dưới màu để số vẫn đọc được khi vết loang đè lên ảnh. */}
          <circle r={r * 0.98} fill={PAPER} fillOpacity={0.8} />
          <circle cx={r * 0.28} cy={r * 0.22} r={r * 0.7} fill={second} fillOpacity={0.3} />
          <circle r={r} fill={`url(#${id}-g)`} />
        </g>
      </svg>
      <div
        style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: textT, filter: `blur(${((1 - textT) * 5 * unit).toFixed(2)}px)`,
        }}
      >
        <div style={{ fontFamily: SCRIPT, fontWeight: 700, fontSize: numSize, lineHeight: 1.1, color: palette.pigment, whiteSpace: "nowrap" }}>
          {visual.text.normalize("NFC")}
        </div>
        {capLines.map((line, k) => (
          <div key={k} style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: capSize, lineHeight: 1.35, color: INK, whiteSpace: "nowrap" }}>
            {line.words.map((w) => w.text).join(" ")}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bức tranh của một cảnh
// ---------------------------------------------------------------------------
const ScenePainting: React.FC<{
  scene: Scene; index: number; frame: number; reveal: number; out: number; from: number; clipFrom: number; until: number;
  layout: WcLayout; palette: Palette; ready: boolean;
}> = ({ scene, index, frame, reveal, out, from, clipFrom, until, layout, palette, ready }) => {
  const { paint: box, unit, split } = layout;
  const m = Math.min(box.w, box.h);
  const key = `wc-${index}-${scene.image ?? "wash"}`;
  const id = `wc${index}`;
  const blobs = blobsFor(key, box.w, box.h);
  const seed = Math.floor(seeded(`${key}-seed`, 1, 200));
  // Rửa trôi: các vệt co lại, nhoè thêm và phai.
  const shrink = 1 - 0.4 * WASH(out);
  const scale = (b: (typeof blobs)[number]) => blobGrow(b, reveal) * shrink;
  const fade = 1 - WASH(out);
  const zoom = interpolate(frame, [from, Math.max(from + 1, until + OUT_FRAMES)], [1.02, 1.09], clamp);

  const halo = (
    <svg width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} style={{ position: "absolute", left: box.x, top: box.y, overflow: "visible" }}>
      <defs>
        <WashFilter id={`${id}-halo`} seed={seed} frequency={1.3 / m} displace={m * (0.1 + 0.08 * out)} soft={m * 0.025} />
      </defs>
      <g filter={`url(#${id}-halo)`}>
        {blobs.map((b, k) => {
          const s = scale(b) * (scene.image ? 1.1 : 1.02);
          return s > 0.01 ? (
            <ellipse
              key={k}
              cx={b.cx} cy={b.cy} rx={b.rx * s} ry={b.ry * s}
              transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}
              fill={washColor(palette, key, k % 3)}
              fillOpacity={scene.image ? 0.42 : 0.26}
            />
          ) : null;
        })}
      </g>
    </svg>
  );

  // Hai góc có đốm vẩy + vết loang, đổi cặp góc theo cảnh.
  // Cảnh có ảnh + con số: con số nằm góc dưới phải, nên đốm màu dời lên hai góc trên.
  const corners: Corner[] = (scene.image && scene.visual
    ? [[0.07, 0.06], [0.93, 0.08]]
    : index % 2 === 0
      ? [[0.93, 0.06], [0.07, 0.95]]
      : [[0.07, 0.06], [0.93, 0.95]]
  ).map(([fx, fy], k) => ({ x: box.x + box.w * fx, y: box.y + box.h * fy, color: washColor(palette, key, k + 2), key: `${key}-c${k}` }));
  const splat = interpolate(frame, [from + 4, from + 40], [0, 1], clamp);

  const visual = scene.visual;
  const visualT = interpolate(frame, [from + 14, from + 40], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {halo}
      {scene.image ? (
        <div
          style={{
            position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden",
            WebkitMaskImage: maskUri(box.w, box.h, blobs, scale, m * (0.09 + 0.1 * out), m * 0.004, seed),
            WebkitMaskSize: "100% 100%",
            WebkitMaskRepeat: "no-repeat",
            filter: out > 0 ? `blur(${(WASH(out) * 7 * unit).toFixed(2)}px)` : undefined,
          }}
        >
          <div style={{ position: "absolute", inset: 0, filter: "saturate(0.7) contrast(0.92) brightness(1.07)" }}>
            <SceneMedia scene={scene} from={clipFrom} zoom={zoom} />
          </div>
          {/* Lớp màu nhấn pha nước + sương sáng: ảnh mơ, nhạt như tranh. */}
          <AbsoluteFill style={{ backgroundColor: palette.wash, mixBlendMode: "multiply", opacity: 0.2 }} />
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 45%, ${PAPER} 100%)`, opacity: 0.35 }} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: box.x + m * 0.02, top: box.y + box.h - (visual ? m * 0.34 : m * 0.62) - m * 0.04 }}>
          <Branch
            id={`${id}-br`}
            w={visual ? m * 0.34 : m * 0.62}
            h={visual ? m * 0.34 : m * 0.62}
            t={interpolate(frame, [from + 8, from + 56], [0, 1], clamp)}
            leaf={palette.leaf}
            stem="#8a7458"
          />
        </div>
      )}
      {corners.map((c, k) => (
        <Splatter key={k} corner={c} unit={unit} t={splat} id={`${id}-sp${k}`} />
      ))}
      {!scene.image ? (
        <Blossom
          x={box.x + box.w * 0.8} y={box.y + box.h * (split ? 0.22 : 0.2)} r={m * 0.07}
          color={palette.rose} center="#d9a441" t={interpolate(frame, [from + 20, from + 46], [0, 1], clamp)} id={`${id}-bl`} rot={18}
        />
      ) : null}
      {visual ? (
        scene.image ? (
          <StatBloom
            visual={visual} cx={box.x + box.w * 0.79} cy={box.y + box.h * 0.8} r={Math.min(m * 0.3, Math.max(m * 0.19, 130 * unit))}
            t={visualT} palette={palette} id={`${id}-st`} unit={unit} ready={ready}
          />
        ) : (
          <StatBloom
            visual={visual} cx={box.x + box.w * 0.52} cy={box.y + box.h * 0.46} r={m * 0.29}
            t={visualT} palette={palette} id={`${id}-st`} unit={unit} ready={ready}
          />
        )
      ) : null}
      {scene.tag ? (
        <TagLabel text={scene.tag} zone={layout.text} unit={unit} from={from} frame={frame} palette={palette} id={`${id}-tag`} ready={ready} />
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Phụ đề viết tay
// ---------------------------------------------------------------------------
type Block = {
  size: number;
  face: Face;
  lineHeight: number;
  lines: Line[];
  zone: Rect;
  top: number;
  /** Câu nhấn không có trong lời: thêm một dòng màu nhấn dưới câu. */
  extra: Line[];
  extraSize: number;
  punch: [number, number] | null;
  punchAt: number;
};

const blockFor = (caption: Caption, scene: Scene, layout: WcLayout, ready: boolean, extraPunch: string | null, punchAt: number): Block => {
  const { unit, split } = layout;
  const t = layout.text;
  const reserve = scene.tag ? TAG_RESERVE(unit) : 0;
  const zone = { x: t.x, y: t.y + reserve, w: t.w, h: t.h - reserve };
  const extraSize = (split ? 60 : 64) * unit;
  const extra = extraPunch ? wrap(extraPunch, extraSize, zone.w * 0.92, SCRIPT_BOLD, ready).slice(0, 2) : [];
  const extraH = extra.length * extraSize * 1.4 + (extra.length ? 10 * unit : 0);
  // Câu ngắn: chữ viết tay lớn. Co tới 54px mà vẫn tràn → câu dài, chuyển sang Lora cho dễ đọc.
  let face: Face = SCRIPT_FACE;
  let lineHeight = 1.42;
  let fit = fitLines(caption.text, (split ? 76 : 84) * unit, 54 * unit, zone.w * 0.94, zone.h - extraH, lineHeight, 3, face, ready);
  if (!fit.fits) {
    face = SERIF_FACE;
    lineHeight = 1.48;
    fit = fitLines(caption.text, 50 * unit, 28 * unit, zone.w * 0.94, zone.h - extraH, lineHeight, 6, face, ready);
  }
  const height = fit.lines.length * fit.size * lineHeight + extraH;
  // Hơi lệch lên trên giữa vùng — mắt đọc gần tranh hơn.
  // Có nhãn: phụ đề nằm ngay dưới nhãn thành một cụm; không nhãn thì canh giữa vùng.
  const top = scene.tag ? zone.y + 14 * unit : Math.max(zone.y, zone.y + zone.h * 0.46 - height / 2);
  const punch = scene.punch ? findPunch(caption.text, scene.punch.text) : null;
  return { size: fit.size, face, lineHeight, lines: fit.lines, zone, top, extra, extraSize, punch, punchAt };
};

/** Nét cọ gạch chân dưới cụm nhấn — vẽ dần từ trái sang. */
const Underline: React.FC<{ width: number; size: number; draw: number; color: string; id: string }> = ({ width, size, draw, color, id }) =>
  draw > 0 ? (
    <BrushStroke
      id={id}
      w={width * 1.06}
      h={size * 0.16}
      color={color}
      draw={draw}
      opacity={0.7}
      seed={13}
      style={{ left: -width * 0.03 - size * 0.16 * 0.35, top: size * 1.08 - size * 0.16 * 0.35 }}
    />
  ) : null;

const CaptionBlock: React.FC<{
  block: Block; start: number; end: number; frame: number; unit: number; opacity: number; palette: Palette; id: string; ready: boolean;
}> = ({ block, start, end, frame, unit, opacity, palette, id, ready }) => {
  const { size, face, lineHeight, lines, zone, top, punch } = block;
  const total = lines.reduce((acc, l) => acc + l.words.length, 0);
  const dur = Math.max(1, end - start);
  // Từng từ thấm ra trong ~55% thời lượng câu, nhưng không nhanh quá 2 hay chậm quá 7 frame mỗi từ.
  const stagger = Math.min(7, Math.max(2, (dur * 0.55) / Math.max(1, total)));
  const wordT = (index: number) => interpolate(frame, [start + index * stagger, start + index * stagger + 14], [0, 1], { ...clamp, easing: SOAK });
  const lh = size * lineHeight;
  const punchWeight = face.family === SCRIPT ? 700 : 600;
  const at = punch ? Math.max(block.punchAt, start + punch[1] * stagger + 10) : Number.MAX_SAFE_INTEGER;
  const punchT = interpolate(frame, [at, at + 14], [0, 1], { ...clamp, easing: SOAK });
  const drawT = interpolate(frame, [at + 2, at + 22], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });

  const word = (text: string, index: number, isPunch: boolean) => {
    const t = wordT(index);
    const target = isPunch ? interpolateColors(punchT, [0, 1], [INK, palette.pigment]) : INK;
    return (
      <span
        key={index}
        style={{
          display: "inline-block",
          opacity: t,
          color: interpolateColors(t, [0, 1], [palette.wash, target]),
          filter: t < 1 ? `blur(${((1 - t) * 5 * unit).toFixed(2)}px)` : undefined,
          textShadow: t < 1 ? `0 0 ${((1 - t) * 16 * unit).toFixed(1)}px ${palette.wash}` : undefined,
          translate: `0 ${((1 - t) * 6 * unit).toFixed(1)}px`,
          fontWeight: isPunch ? punchWeight : face.weight,
        }}
      >
        {text}
      </span>
    );
  };

  return (
    <>
      {lines.map((line, k) => {
        // Gom các từ liền nhau cùng loại (nhấn / thường) để gạch chân chạy liền qua khoảng trắng.
        const segments: { words: Line["words"]; punch: boolean }[] = [];
        for (const w of line.words) {
          const isPunch = punch !== null && w.index >= punch[0] && w.index <= punch[1];
          const last = segments[segments.length - 1];
          if (last && last.punch === isPunch) last.words.push(w);
          else segments.push({ words: [w], punch: isPunch });
        }
        return (
          <div
            key={k}
            style={{
              position: "absolute", left: zone.x - zone.w * 0.03, width: zone.w * 1.06, top: top + k * lh, textAlign: "center", whiteSpace: "nowrap",
              fontFamily: face.family, fontSize: size, lineHeight, color: INK, opacity,
            }}
          >
            {segments.map((seg, s) => {
              const words = seg.words.flatMap((w, j) => (j > 0 ? [" ", word(w.text, w.index, seg.punch)] : [word(w.text, w.index, seg.punch)]));
              return (
                <span key={s}>
                  {s > 0 ? " " : ""}
                  {seg.punch ? (
                    // Khoảng trắng nằm ngoài cụm nhấn; chừa thêm 0.1em để nét gạch không chạm từ kế bên.
                    <span style={{ position: "relative", display: "inline-block", margin: "0 0.1em" }}>
                      <Underline
                        width={measure(seg.words.map((w) => w.text).join(" "), size, { ...face, weight: punchWeight }, ready)}
                        size={size}
                        draw={drawT}
                        color={palette.accent}
                        id={`${id}-u${k}-${s}`}
                      />
                      {words}
                    </span>
                  ) : (
                    words
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
      {block.extra.map((line, k) => {
        const t = interpolate(frame, [block.punchAt, block.punchAt + 16], [0, 1], { ...clamp, easing: SOAK });
        const draw = interpolate(frame, [block.punchAt + 6, block.punchAt + 26], [0, 1], clamp);
        const text = line.words.map((w) => w.text).join(" ");
        return (
          <div
            key={`x-${k}`}
            style={{
              position: "absolute", left: zone.x, width: zone.w, textAlign: "center", whiteSpace: "nowrap",
              top: top + lines.length * lh + 10 * unit + k * block.extraSize * 1.4,
              fontFamily: SCRIPT, fontWeight: 700, fontSize: block.extraSize, lineHeight: 1.4, color: palette.pigment,
              opacity: t * opacity, filter: t < 1 ? `blur(${((1 - t) * 5 * unit).toFixed(2)}px)` : undefined,
            }}
          >
            <span style={{ position: "relative", display: "inline-block" }}>
              <Underline width={line.width} size={block.extraSize} draw={draw} color={palette.accent} id={`${id}-xu${k}`} />
              {text}
            </span>
          </div>
        );
      })}
    </>
  );
};

const CaptionLayer: React.FC<{
  captions: Caption[]; scenes: Scene[]; layout: WcLayout; frame: number; ready: boolean; gate: number; palette: Palette; lastFrame: number;
}> = ({ captions, scenes, layout, frame, ready, gate, palette, lastFrame }) => {
  const current = activeIndexAt(captions, frame);
  if (current < 0 || gate <= 0) return null;
  const { unit } = layout;
  const sceneOf = (c: Caption) => scenes[Math.max(0, activeIndexAt(scenes, msToFrames(c.startMs)))];
  const startOf = (i: number) => msToFrames(captions[i].startMs);
  const endOf = (i: number) => (i + 1 < captions.length ? startOf(i + 1) : Math.max(startOf(i) + 1, Math.min(lastFrame, msToFrames(captions[i].endMs))));

  const make = (i: number): Block => {
    const caption = captions[i];
    const scene = sceneOf(caption);
    const punchAt = scene.punch ? msToFrames(scene.punch.atMs) : Number.MAX_SAFE_INTEGER;
    // Câu nhấn không nằm nguyên văn trong câu nào của cảnh → thêm thành dòng riêng dưới câu đang đọc lúc atMs.
    let extra: string | null = null;
    if (scene.punch) {
      const inScene = captions.some((c) => sceneOf(c) === scene && findPunch(c.text, scene.punch!.text));
      const owner = activeIndexAt(captions, punchAt);
      if (!inScene && (owner === i || (owner < 0 && i === 0))) extra = scene.punch.text;
    }
    return blockFor(caption, scene, layout, ready, extra, punchAt);
  };

  const start = startOf(current);
  const outT = interpolate(frame, [start, start + 9], [1, 0], { ...clamp, easing: WASH });
  return (
    <AbsoluteFill style={{ opacity: gate }}>
      {current > 0 && outT > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: outT, filter: `blur(${((1 - outT) * 6 * unit).toFixed(2)}px)` }}>
          <CaptionBlock
            block={make(current - 1)} start={startOf(current - 1)} end={endOf(current - 1)} frame={frame} unit={unit}
            opacity={1} palette={palette} id={`wcc${current - 1}`} ready={ready}
          />
        </div>
      ) : null}
      <CaptionBlock block={make(current)} start={start} end={endOf(current)} frame={frame} unit={unit} opacity={1} palette={palette} id={`wcc${current}`} ready={ready} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Trang tiêu đề
// ---------------------------------------------------------------------------
const TitlePage: React.FC<{ title: string; subtitle: string; handle: string; frame: number; palette: Palette; ready: boolean }> = ({
  title, subtitle, handle, frame, palette, ready,
}) => {
  const { width, height, safe, unit, portrait } = useLayout();
  const out = interpolate(frame, [TITLE_FRAMES - 16, TITLE_FRAMES], [1, 0], { ...clamp, easing: WASH });
  const side = Math.max(safe.side, 80 * unit);
  const maxW = Math.min(width - side * 2, 1400 * unit);
  const face = SCRIPT_BOLD;
  const lh = 1.3;
  const { size, lines } = fitLines(title, (portrait ? 128 : 116) * unit, 56 * unit, maxW, height * 0.32, lh, 3, face, ready);
  const blockH = lines.length * size * lh;
  const widest = Math.max(...lines.map((l) => l.width), 1);
  const strokeW = Math.min(width * 0.96, widest + 240 * unit);
  const strokeH = blockH + 90 * unit;
  const cy = height * (portrait ? 0.42 : 0.4);
  const top = cy - blockH / 2;
  const draw = interpolate(frame, [2, 24], [0, 1], { ...clamp, easing: SOAK });
  const draw2 = interpolate(frame, [8, 30], [0, 1], { ...clamp, easing: SOAK });
  const subFace: Face = { ...SERIF_FACE, italic: true };
  const subSize = (portrait ? 42 : 38) * unit;
  const subLines = subtitle ? wrap(subtitle, subSize, maxW * 0.86, subFace, ready).slice(0, 3) : [];
  const subT = interpolate(frame, [30, 46], [0, 1], { ...clamp, easing: SOAK });
  const handleT = interpolate(frame, [38, 54], [0, 1], { ...clamp, easing: SOAK });
  const subTop = cy + strokeH / 2 + 30 * unit;

  const r = 46 * unit;
  const blossoms = [
    { x: width / 2 - strokeW / 2 + r * 0.6, y: cy - strokeH / 2 - r * 0.2, s: 1.1, c: palette.rose },
    { x: width / 2 - strokeW / 2 + r * 2.1, y: cy - strokeH / 2 + r * 0.5, s: 0.62, c: palette.wash },
    { x: width / 2 + strokeW / 2 - r * 0.8, y: cy + strokeH / 2 - r * 0.1, s: 1.25, c: palette.rose },
    { x: width / 2 + strokeW / 2 - r * 2.4, y: cy + strokeH / 2 + r * 0.55, s: 0.7, c: "#e8b7c0" },
    { x: width / 2 + strokeW / 2 - r * 0.2, y: cy + strokeH / 2 - r * 1.5, s: 0.5, c: palette.wash },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, opacity: out, filter: out < 1 ? `blur(${((1 - out) * 8 * unit).toFixed(2)}px)` : undefined }}>
      <BrushStroke id="wct-s2" w={strokeW * 0.82} h={strokeH * 0.7} color={washColor(palette, "title", 1)} draw={draw2} opacity={0.3} seed={21}
        style={{ left: width / 2 - strokeW * 0.36 - strokeH * 0.7 * 0.35, top: cy - strokeH * 0.12 - strokeH * 0.7 * 0.35 }} />
      <BrushStroke id="wct-s1" w={strokeW} h={strokeH} color={palette.wash} draw={draw} opacity={0.42} seed={5}
        style={{ left: width / 2 - strokeW / 2 - strokeH * 0.35, top: cy - strokeH / 2 - strokeH * 0.35 }} />
      {blossoms.map((b, k) => (
        <Blossom key={k} x={b.x} y={b.y} r={r * b.s} color={b.c} center="#d9a441" t={interpolate(frame, [10 + k * 5, 36 + k * 5], [0, 1], clamp)} id={`wct-b${k}`} rot={k * 23} />
      ))}
      {lines.map((line, k) => {
        // Viết tay: mặt nạ quét từ trái sang phải, mép mềm như mực đang chảy theo ngòi.
        const p = interpolate(frame, [10 + k * 9, 36 + k * 9], [-10, 110], { ...clamp, easing: Easing.inOut(Easing.quad) });
        const mask = `linear-gradient(90deg, #000 ${p.toFixed(1)}%, transparent ${(p + 10).toFixed(1)}%)`;
        return (
          <div
            key={k}
            style={{
              position: "absolute", left: 0, width, top: top + k * size * lh, textAlign: "center", whiteSpace: "nowrap",
              fontFamily: SCRIPT, fontWeight: 700, fontSize: size, lineHeight: lh, color: INK,
            }}
          >
            <span style={{ display: "inline-block", WebkitMaskImage: mask, maskImage: mask, padding: `0 ${(size * 0.12).toFixed(1)}px` }}>
              {line.words.map((w) => w.text).join(" ")}
            </span>
          </div>
        );
      })}
      {subLines.map((line, k) => (
        <div
          key={k}
          style={{
            position: "absolute", left: 0, width, top: subTop + k * subSize * 1.45, textAlign: "center", whiteSpace: "nowrap",
            fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: subSize, lineHeight: 1.45, color: INK_SOFT,
            opacity: subT, translate: `0 ${((1 - subT) * 10 * unit).toFixed(1)}px`,
          }}
        >
          {line.words.map((w) => w.text).join(" ")}
        </div>
      ))}
      {handle ? (
        <div
          style={{
            position: "absolute", left: 0, width, top: subTop + subLines.length * subSize * 1.45 + 34 * unit, textAlign: "center",
            fontFamily: SERIF, fontWeight: 500, fontSize: 28 * unit, letterSpacing: "0.08em", color: palette.pigment, opacity: handleT * 0.9,
          }}
        >
          ~ {handle.normalize("NFC")} ~
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
export const WatercolorStyle: React.FC<ShortProps> = ({ title, subtitle, handle, accent, captions, scenes, showTitle }) => {
  const scriptReady = useFontReady("dancing");
  const serifReady = useFontReady("lora");
  const ready = scriptReady && serifReady;
  const frame = useCurrentFrame();
  const layout = useWcLayout();
  const palette = paletteFor(accent);
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const active = Math.max(0, activeIndexAt(pages, frame));

  // Mốc bắt đầu loang của từng cảnh. Cảnh đầu loang ngay dưới trang tiêu đề đang tan.
  const revealAt: number[] = [];
  pages.forEach((p, i) => {
    const own = i === 0 ? (showTitle ? TITLE_FRAMES - 18 : 0) : msToFrames(p.startMs);
    revealAt.push(i === 0 ? own : Math.max(own, revealAt[i - 1] + 1));
  });
  const endOf = (i: number) => (i + 1 < pages.length ? revealAt[i + 1] : Math.max(revealAt[i] + 1, msToFrames(pages[i].endMs)));
  const lastFrame = endOf(pages.length - 1);

  const washing = active > 0 && frame < revealAt[active] + OUT_FRAMES;
  const layers = washing ? [active - 1, active] : [active];
  const gate = showTitle ? interpolate(frame, [TITLE_FRAMES - 10, TITLE_FRAMES + 2], [0, 1], clamp) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, overflow: "hidden" }}>
      {layers.map((i) => {
        const reveal = interpolate(frame, [revealAt[i], revealAt[i] + REVEAL_FRAMES], [0, 1], clamp);
        const out = i < active ? interpolate(frame, [revealAt[active], revealAt[active] + OUT_FRAMES], [0, 1], clamp) : 0;
        return (
          <ScenePainting
            key={`scene-${i}`}
            scene={pages[i]}
            index={i}
            frame={frame}
            reveal={reveal}
            out={out}
            from={revealAt[i]}
            clipFrom={msToFrames(pages[i].startMs)}
            until={endOf(i)}
            layout={layout}
            palette={palette}
            ready={ready}
          />
        );
      })}

      <CaptionLayer captions={captions} scenes={pages} layout={layout} frame={frame} ready={ready} gate={gate} palette={palette} lastFrame={lastFrame} />

      {showTitle && frame < TITLE_FRAMES ? (
        <TitlePage title={title} subtitle={subtitle} handle={handle} frame={frame} palette={palette} ready={ready} />
      ) : null}

      <PaperTexture unit={layout.unit} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 62%, rgba(140, 110, 80, 0.12) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
