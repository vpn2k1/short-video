/**
 * Phong cách "Công thức nấu ăn": tấm thẻ công thức trên mặt bàn gỗ trong bếp. Mỗi cảnh là một bước — huy hiệu
 * "BƯỚC n" to, tên bước, hàng chấm tiến độ tích dần các bước đã xong, ảnh món bo góc phóng chậm, lời hướng dẫn chữ
 * tròn. Con số (`visual`) là viên nhãn có đồng hồ/cân; câu nhấn là tờ giấy nhớ "Mẹo:" kèm mũi tên vẽ tay.
 * Cảnh không ảnh thành danh sách nguyên liệu tích từng dòng. Sang cảnh mới thì thẻ mới được đặt đè lên từ bên phải.
 * Xem skill `.claude/skills/style-recipe/SKILL.md`.
 *
 * Thứ tự lớp: mặt bàn → thẻ cũ (lúc chuyển) → thẻ mới (giấy → ảnh → viên số → giấy nhớ → chữ) → thẻ tiêu đề → nhiễu.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";
import { ensureFonts } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, seeded, useLayout } from "../shared";
import { findPunch } from "../whiteboard/written";
import {
  BasketIcon, CheckIcon, chipIconFor, deep, ForkIcon, iconFor, INK, KitchenTable, PAPER, SpoonIcon, tint, WhiskIcon,
} from "./kitchen";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const POP = Easing.out(Easing.back(1.8));
const DEAL = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Số frame đặt thẻ bước mới lên bàn. */
const DEAL_FRAMES = 18;
/** Số frame nhấc thẻ tiêu đề khỏi bàn ở cuối phần mở đầu. */
const LIFT_FRAMES = 16;

const ROUND = FONT_CATALOG.baloo.stack;
const BODY = FONT_CATALOG.nunito.stack;
const HAND = FONT_CATALOG.patrick.stack;

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };

/** In hoa bằng JS theo tiếng Việt — không dùng CSS text-transform (móc Ư/Ơ dễ lệch). */
const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");
const chars = (text: string) => [...text].length;

/** Cảnh "nguyên liệu / chuẩn bị" đầu video và cảnh "thành phẩm" cuối video không tính là một bước nấu. */
const PREP = /nguyên liệu|chuẩn bị|thành phần|cần có|sơ chế trước/i;
const DONE = /thành phẩm|hoàn thành|thưởng thức|trình bày|kết quả|xong/i;

type StepLabel = { kind: "step"; n: number } | { kind: "prep" } | { kind: "done" };

const stepLabels = (scenes: Scene[]): StepLabel[] => {
  let n = 0;
  return scenes.map((s, i) => {
    if (i === 0 && s.tag && PREP.test(s.tag) && scenes.length > 1) return { kind: "prep" };
    if (i === scenes.length - 1 && i > 0 && s.tag && DONE.test(s.tag)) return { kind: "done" };
    n += 1;
    return { kind: "step", n };
  });
};

// ---------------------------------------------------------------------------
// Bố cục thẻ
// ---------------------------------------------------------------------------
type Geometry = {
  stacked: boolean;
  card: Rect;
  header: Rect;
  /** Vạch kẻ chia đầu thẻ và thân thẻ (null khi đầu thẻ nằm cạnh ảnh). */
  divider: { x: number; y: number; w: number } | null;
  photo: Rect | null;
  text: Rect;
};

const useGeometry = (hasMedia: boolean): Geometry => {
  const { width, height, safe, unit } = useLayout();
  const stacked = height / width >= 1.2;
  if (stacked) {
    const mx = Math.min(safe.side * 0.45, 60 * unit);
    const card = { x: mx, y: Math.max(36 * unit, safe.top * 0.65), w: width - mx * 2, h: 0 };
    card.h = height - safe.bottom * 0.6 - card.y;
    const left = Math.max(safe.side, card.x + 44 * unit);
    const w = width - left * 2;
    const top = Math.max(safe.top, card.y) + 40 * unit;
    const bottom = height - safe.bottom - 10 * unit;
    const headerH = 150 * unit;
    const header = { x: left, y: top, w, h: headerH };
    const bodyTop = top + headerH + 56 * unit;
    const divider = { x: left, y: top + headerH + 28 * unit, w };
    if (!hasMedia) return { stacked, card, header, divider, photo: null, text: { x: left, y: bodyTop, w, h: bottom - bodyTop } };
    const photoH = Math.min((bottom - bodyTop) * 0.58, w * 0.95);
    const photo = { x: left, y: bodyTop, w, h: photoH };
    const textTop = bodyTop + photoH + 72 * unit;
    return { stacked, card, header, divider, photo, text: { x: left, y: textTop, w, h: bottom - textTop } };
  }
  const card = { x: Math.max(40 * unit, safe.side * 0.55), y: Math.max(30 * unit, safe.top * 0.6), w: 0, h: 0 };
  card.w = width - card.x * 2;
  card.h = height - Math.max(30 * unit, safe.bottom * 0.5) - card.y;
  const pad = 50 * unit;
  const left = card.x + pad;
  const top = card.y + pad;
  const right = card.x + card.w - pad;
  const bottom = Math.min(card.y + card.h - pad, height - safe.bottom);
  const w = right - left;
  const headerH = 150 * unit;
  if (!hasMedia) {
    const bodyTop = top + headerH + 56 * unit;
    return {
      stacked,
      card,
      header: { x: left, y: top, w, h: headerH },
      divider: { x: left, y: top + headerH + 28 * unit, w },
      photo: null,
      text: { x: left, y: bodyTop, w, h: bottom - bodyTop },
    };
  }
  const photoW = w * 0.5;
  const colX = left + photoW + 56 * unit;
  const colW = right - colX;
  const bodyTop = top + headerH + 56 * unit;
  return {
    stacked,
    card,
    header: { x: colX, y: top, w: colW, h: headerH },
    divider: { x: colX, y: top + headerH + 28 * unit, w: colW },
    photo: { x: left, y: top, w: photoW, h: bottom - top },
    text: { x: colX, y: bodyTop, w: colW, h: bottom - bodyTop },
  };
};

/** Tấm giấy thẻ công thức: kem, bo góc, dải màu nhấn trên đầu, bóng đổ xuống bàn. */
const CardPaper: React.FC<{ card: Rect; accent: string; unit: number }> = ({ card, accent, unit }) => (
  <div
    style={{
      position: "absolute",
      left: card.x,
      top: card.y,
      width: card.w,
      height: card.h,
      borderRadius: 30 * unit,
      backgroundColor: PAPER,
      backgroundImage: `linear-gradient(180deg, ${accent} 0 ${14 * unit}px, transparent ${14 * unit}px), radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(190, 140, 80, 0.16) 100%)`,
      boxShadow: `0 ${16 * unit}px ${40 * unit}px rgba(35, 15, 0, 0.45), 0 ${2 * unit}px ${4 * unit}px rgba(35, 15, 0, 0.25)`,
      overflow: "hidden",
    }}
  />
);

// ---------------------------------------------------------------------------
// Đầu thẻ: huy hiệu bước + tên bước + chấm tiến độ
// ---------------------------------------------------------------------------
const StepBadge: React.FC<{ label: StepLabel; size: number; accent: string; t: number }> = ({ label, size, accent, t }) => {
  const small = label.kind === "step" ? "BƯỚC" : label.kind === "prep" ? upper("chuẩn bị") : "XONG!";
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        backgroundColor: accent,
        border: `${size * 0.045}px solid ${PAPER}`,
        boxShadow: `0 0 0 ${size * 0.025}px ${deep(accent)}, 0 ${size * 0.06}px ${size * 0.12}px rgba(60, 25, 0, 0.35)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        scale: String(t),
        rotate: `${((1 - t) * -30).toFixed(1)}deg`,
      }}
    >
      <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: size * (label.kind === "prep" ? 0.15 : 0.17), lineHeight: 1, marginTop: size * 0.06 }}>{small}</div>
      {label.kind === "step" ? (
        <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: size * (label.n >= 10 ? 0.44 : 0.54), lineHeight: 1, marginTop: -size * 0.02, textShadow: `0 ${size * 0.02}px 0 ${deep(accent, 70)}` }}>
          {label.n}
        </div>
      ) : label.kind === "prep" ? (
        <div style={{ marginTop: size * 0.03 }}><BasketIcon size={size * 0.42} color="#ffffff" /></div>
      ) : (
        <div style={{ marginTop: size * 0.03 }}><CheckIcon size={size * 0.44} color="#ffffff" /></div>
      )}
    </div>
  );
};

/** Nét biểu tượng trong chấm tiến độ (viewBox 48): rổ cho cảnh chuẩn bị, cờ cho cảnh thành phẩm. */
const DOT_ICON = {
  prep: "M 15 20 L 21 9 M 33 20 L 27 9 M 6 20 L 42 20 L 37 40 L 11 40 Z",
  done: "M 14 42 L 14 7 M 14 8 L 36 8 L 30 16 L 36 24 L 14 24",
} as const;

/**
 * Hàng chấm tiến độ: bước đã xong đặc màu nhấn có dấu tích, bước hiện tại viền đậm, bước sau mờ.
 * Số trong chấm trùng số trên huy hiệu — cảnh chuẩn bị / thành phẩm là chấm nhỏ hơn có rổ / cờ, không mang số.
 */
const Progress: React.FC<{ labels: StepLabel[]; index: number; width: number; frame: number; tickAt: number; accent: string; unit: number }> = ({
  labels, index, width, frame, tickAt, accent, unit,
}) => {
  const total = labels.length;
  if (total <= 1) return null;
  const size = Math.min(46 * unit, width / (total * 1.55));
  const gap = total > 1 ? (width - size * total) / (total - 1) : 0;
  const step = Math.min(gap, size * 1.2);
  const rowW = size * total + step * (total - 1);
  // Dấu tích của bước vừa xong vẽ dần khi thẻ mới đặt xuống.
  const tick = interpolate(frame, [tickAt, tickAt + 10], [0, 1], clamp);
  const pulse = 1 + Math.sin(frame / 6) * 0.06;
  return (
    <svg width={rowW} height={size * 1.2} viewBox={`0 ${-size * 0.1} ${rowW} ${size * 1.2}`} style={{ display: "block", overflow: "visible" }}>
      {Array.from({ length: total - 1 }, (_, i) => (
        <line
          key={`l-${i}`}
          x1={i * (size + step) + size}
          x2={(i + 1) * (size + step)}
          y1={size / 2}
          y2={size / 2}
          stroke={i < index ? accent : "rgba(61, 43, 31, 0.2)"}
          strokeWidth={4 * unit}
          strokeDasharray={i < index ? undefined : `${6 * unit} ${6 * unit}`}
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: total }, (_, i) => {
        const cx = i * (size + step) + size / 2;
        const done = i < index;
        const current = i === index;
        const draw = i === index - 1 ? tick : 1;
        const label = labels[i];
        // Chấm chuẩn bị / thành phẩm nhỏ hơn chấm bước nấu.
        const r = (size / 2 - 2 * unit) * (label.kind === "step" ? 1 : 0.8);
        const muted = current ? deep(accent) : "rgba(61, 43, 31, 0.4)";
        return (
          <g key={`d-${i}`} transform={`translate(${cx} ${size / 2}) scale(${current ? pulse : 1})`}>
            <circle
              r={r}
              fill={done ? accent : current ? PAPER : "rgba(61, 43, 31, 0.06)"}
              stroke={done ? accent : current ? accent : "rgba(61, 43, 31, 0.28)"}
              strokeWidth={(current ? 5 : 3) * unit}
            />
            {done ? (
              <path
                d={`M ${-r * 0.42} 0 L ${-r * 0.1} ${r * 0.32} L ${r * 0.45} ${-r * 0.32}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth={5 * unit}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - draw}
              />
            ) : label.kind !== "step" ? (
              <path
                d={DOT_ICON[label.kind]}
                transform={`scale(${((r * 1.2) / 48).toFixed(4)}) translate(-24 -24)`}
                fill="none"
                stroke={muted}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <text
                y={size * 0.02}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={ROUND}
                fontWeight={800}
                fontSize={size * 0.5}
                fill={muted}
              >
                {label.n}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const Header: React.FC<{
  rect: Rect; scene: Scene; label: StepLabel; labels: StepLabel[]; index: number; frame: number; appear: number; accent: string; unit: number; printed: boolean;
}> = ({ rect, scene, label, labels, index, frame, appear, accent, unit, printed }) => {
  const badge = Math.min(rect.h, rect.w * 0.3);
  const restW = rect.w - badge - 30 * unit;
  const tag = scene.tag?.normalize("NFC") ?? null;
  // Tên bước: to nhất có thể trong 1 dòng, dài quá thì co và cho xuống 2 dòng.
  let tagSize = 66 * unit;
  while (tag && chars(tag) * tagSize * 0.5 > restW * 1.9 && tagSize > 34 * unit) tagSize *= 0.93;
  // Thẻ in sẵn: huy hiệu nảy nhẹ như đóng dấu khi thẻ vừa chạm bàn; thẻ đầu: huy hiệu bật vào, tên bước trượt vào.
  const badgeT = printed
    ? 1 + Math.sin(interpolate(frame, [appear - 2, appear + 10], [0, Math.PI], clamp)) * 0.12
    : interpolate(frame, [appear, appear + 12], [0, 1], { ...clamp, easing: POP });
  const tagT = printed ? 1 : interpolate(frame, [appear + 4, appear + 14], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "center", gap: 30 * unit }}>
      <StepBadge label={label} size={badge} accent={accent} t={badgeT} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 * unit }}>
        {tag ? (
          <div
            style={{
              fontFamily: ROUND,
              fontWeight: 800,
              fontSize: tagSize,
              lineHeight: 1.05,
              color: INK,
              opacity: tagT,
              translate: `${((1 - tagT) * 30 * unit).toFixed(1)}px 0`,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              paddingTop: tagSize * 0.08,
            }}
          >
            {tag}
          </div>
        ) : null}
        <Progress labels={labels} index={index} width={restW} frame={frame} tickAt={appear + 6} accent={accent} unit={unit} />
      </div>
    </div>
  );
};

/** Đường kẻ gạch đứt giữa đầu thẻ và thân thẻ, có chấm tròn hai đầu như thẻ công thức in sẵn. */
const Divider: React.FC<{ at: { x: number; y: number; w: number }; accent: string; unit: number }> = ({ at, accent, unit }) => (
  <div
    style={{
      position: "absolute",
      left: at.x,
      top: at.y - 2 * unit,
      width: at.w,
      height: 4 * unit,
      backgroundImage: `repeating-linear-gradient(90deg, ${tint(accent, 55)} 0 ${16 * unit}px, transparent ${16 * unit}px ${28 * unit}px)`,
      borderRadius: 2 * unit,
    }}
  />
);

// ---------------------------------------------------------------------------
// Ảnh món, viên con số, giấy nhớ mẹo
// ---------------------------------------------------------------------------
const Photo: React.FC<{ rect: Rect; scene: Scene; from: number; zoom: number; unit: number; t: number }> = ({ rect, scene, from, zoom, unit, t }) => (
  <div
    style={{
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      borderRadius: 32 * unit,
      overflow: "hidden",
      backgroundColor: "#e9dcc6",
      boxShadow: `0 ${10 * unit}px ${26 * unit}px rgba(60, 30, 5, 0.3), 0 0 0 ${2 * unit}px rgba(60, 30, 5, 0.08)`,
      opacity: t,
      scale: String(0.94 + t * 0.06),
    }}
  >
    <SceneMedia scene={scene} from={from} zoom={zoom} />
  </div>
);

/** Viên nhãn trắng: vòng tròn màu nhấn có biểu tượng + con số + chú thích nhỏ. */
const StatPill: React.FC<{ visual: NonNullable<Scene["visual"]>; x: number; cy: number; maxW: number; frame: number; t: number; accent: string; unit: number }> = ({
  visual, x, cy, maxW, frame, t, accent, unit,
}) => {
  const Icon = iconFor(`${visual.text} ${visual.caption ?? ""}`, visual.type === "badge");
  const h = 104 * unit;
  const textSize = Math.min(54 * unit, (maxW - h * 1.3) / Math.max(3, chars(visual.text) * 0.56));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: cy - h / 2,
        height: h,
        maxWidth: maxW,
        display: "flex",
        alignItems: "center",
        gap: 18 * unit,
        padding: `0 ${34 * unit}px 0 ${10 * unit}px`,
        borderRadius: h / 2,
        backgroundColor: "#ffffff",
        boxShadow: `0 ${8 * unit}px ${20 * unit}px rgba(60, 30, 5, 0.3)`,
        scale: String(t),
        rotate: `${((1 - t) * -12 - 2).toFixed(1)}deg`,
        transformOrigin: "left center",
        opacity: Math.min(1, t * 2),
      }}
    >
      <div style={{ width: h - 20 * unit, height: h - 20 * unit, borderRadius: "50%", backgroundColor: accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon size={h * 0.56} color="#ffffff" frame={frame} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: textSize, lineHeight: 1, color: INK, whiteSpace: "nowrap", paddingTop: textSize * 0.12 }}>{visual.text}</div>
        {visual.caption ? (
          <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 26 * unit, lineHeight: 1.15, color: "rgba(61, 43, 31, 0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {visual.caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Giấy nhớ vàng dán băng keo: "Mẹo:" + câu nhấn viết tay, mũi tên vẽ tay chỉ vào món (hoặc vào danh sách).
 * `arrow` là hướng mũi tên: "left" chỉ xuống-trái, "up" chỉ lên-trái.
 */
const TipSticker: React.FC<{ text: string; x: number; y: number; w: number; t: number; arrow: "left" | "up"; accent: string; unit: number; seed: string }> = ({
  text, x, y, w, t, arrow, accent, unit, seed,
}) => {
  const n = chars(text);
  const size = Math.max(34 * unit, Math.min(50 * unit, (w * 2.9) / Math.max(12, n)));
  const tilt = seeded(`${seed}-tip`, 2, 5);
  const draw = interpolate(t, [0.5, 1], [0, 1], clamp);
  const aw = 150 * unit;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        rotate: `${(tilt + (1 - t) * 14).toFixed(1)}deg`,
        scale: String(0.6 + t * 0.4),
        opacity: Math.min(1, t * 2.5),
        transformOrigin: "70% 0%",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: `${30 * unit}px ${26 * unit}px ${24 * unit}px`,
          backgroundColor: "#ffe483",
          backgroundImage: "linear-gradient(180deg, rgba(255, 255, 255, 0.35), transparent 30%), linear-gradient(135deg, transparent 88%, rgba(160, 110, 0, 0.18) 88%)",
          boxShadow: `0 ${10 * unit}px ${18 * unit}px rgba(60, 30, 0, 0.35)`,
          borderRadius: `${4 * unit}px ${4 * unit}px ${22 * unit}px ${4 * unit}px`,
          fontFamily: HAND,
          fontSize: size,
          lineHeight: 1.12,
          color: INK,
        }}
      >
        {/* Băng keo mờ */}
        <div style={{ position: "absolute", left: "50%", top: -16 * unit, width: 130 * unit, height: 38 * unit, translate: "-50% 0", rotate: "-4deg", backgroundColor: "rgba(250, 244, 228, 0.78)", backgroundImage: "repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.04) 0 3px, transparent 3px 7px)", clipPath: "polygon(0 8%, 4% 0, 8% 10%, 12% 0, 88% 0, 92% 12%, 96% 0, 100% 10%, 100% 92%, 96% 100%, 92% 88%, 88% 100%, 12% 100%, 8% 90%, 4% 100%, 0 90%)", boxShadow: `0 ${1 * unit}px ${3 * unit}px rgba(0, 0, 0, 0.12)` }} />
        <span style={{ color: deep(accent, 85), fontSize: size * 1.08 }}>Mẹo: </span>
        {text}
      </div>
      <svg
        width={aw}
        height={aw}
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          overflow: "visible",
          ...(arrow === "left" ? { left: -aw * 0.95, bottom: -aw * 0.72 } : { left: -aw * 0.95, top: -aw * 0.3 }),
        }}
      >
        <path
          d={arrow === "left" ? "M 92 20 C 70 22 40 30 22 78" : "M 92 80 C 70 78 40 70 22 22"}
          fill="none"
          stroke={deep(accent, 85)}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - draw}
        />
        <path
          d={arrow === "left" ? "M 8 62 L 22 80 L 38 64" : "M 8 38 L 22 20 L 38 36"}
          fill="none"
          stroke={deep(accent, 85)}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={draw >= 0.95 ? 1 : 0}
        />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Lời hướng dẫn: câu đang đọc, cụm nhấn quét bút dạ
// ---------------------------------------------------------------------------
/** Câu mới nhất đã bắt đầu trong danh sách câu của cảnh; -1 nếu chưa có. */
const latest = (captions: Caption[], frame: number) => activeIndexAt(captions, frame);

/** Chữ của một câu; các từ thuộc cụm nhấn đổi màu nhấn và được bút dạ quét lần lượt trong 12 frame từ `punchAt`. */
const MarkedWords: React.FC<{ text: string; range: [number, number] | null; punchAt: number; frame: number; size: number; accent: string }> = ({
  text, range, punchAt, frame, size, accent,
}) => {
  const words = text.split(/\s+/).filter(Boolean);
  const span = range ? range[1] - range[0] + 1 : 1;
  return (
    <>
      {words.map((word, i) => {
        const inPunch = range !== null && i >= range[0] && i <= range[1];
        const sweep = inPunch
          ? interpolate(frame, [punchAt + ((i - range![0]) / span) * 12, punchAt + ((i - range![0] + 1) / span) * 12], [0, 100], clamp)
          : 0;
        return (
          <span key={`w-${i}`}>
            {i > 0 ? " " : ""}
            <span
              style={
                inPunch
                  ? {
                    color: sweep > 0 ? deep(accent, 88) : undefined,
                    backgroundImage: `linear-gradient(${tint(accent, 45)}, ${tint(accent, 45)})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${sweep.toFixed(1)}% 42%`,
                    backgroundPosition: "0 88%",
                    padding: `0 ${size * 0.06}px`,
                    margin: `0 ${-size * 0.06}px`,
                    borderRadius: size * 0.08,
                  }
                  : undefined
              }
            >
              {word}
            </span>
          </span>
        );
      })}
    </>
  );
};

const Instruction: React.FC<{ captions: Caption[]; zone: Rect; frame: number; appear: number; punch: Scene["punch"]; accent: string; unit: number }> = ({
  captions, zone, frame, appear, punch, accent, unit,
}) => {
  const k = latest(captions, frame);
  if (k < 0) return null;
  const caption = captions[k];
  const start = Math.max(appear, msToFrames(caption.startMs));
  if (frame < start) return null;
  const text = caption.text.normalize("NFC");
  const range = punch ? findPunch(text, punch.text) : null;
  const punchAt = punch ? Math.max(start, msToFrames(punch.atMs)) : 0;
  const lineHeight = 1.28;
  let size = 76 * unit;
  while (Math.ceil((chars(text) * size * 0.56) / zone.w) * size * lineHeight > zone.h && size > 34 * unit) size *= 0.94;
  const enter = interpolate(frame, [start, start + 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.w, height: zone.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 800,
          fontSize: size,
          lineHeight,
          color: INK,
          textAlign: "center",
          opacity: enter,
          translate: `0 ${((1 - enter) * 24 * unit).toFixed(1)}px`,
        }}
      >
        <MarkedWords text={text} range={range} punchAt={punchAt} frame={frame} size={size} accent={accent} />
      </div>
    </div>
  );
};

/** Cảnh không ảnh: các câu của cảnh thành danh sách nguyên liệu, mỗi dòng có ô tích khi giọng đọc qua dòng sau. */
/** Cỡ chữ vừa cả danh sách trong `maxH`: mỗi dòng = ô tích + chữ, dòng dài tự xuống dòng. */
const checklistFit = (captions: Caption[], w: number, maxH: number, unit: number) => {
  const pad = 34 * unit;
  const innerW = w - pad * 2;
  const heightAt = (s: number) =>
    captions.reduce((sum, c) => sum + Math.max(1, Math.ceil((chars(c.text) * s * 0.55) / (innerW - s * 1.5))) * s * 1.25 + s * 0.9, 0) - s * 0.9 + pad * 2;
  let size = 62 * unit;
  while (heightAt(size) > maxH && size > 30 * unit) size *= 0.94;
  return { size, pad, height: Math.min(maxH, heightAt(size)) };
};

const Checklist: React.FC<{ captions: Caption[]; zone: Rect; frame: number; appear: number; end: number; punch: Scene["punch"]; accent: string; unit: number }> = ({
  captions, zone, frame, appear, end, punch, accent, unit,
}) => {
  if (captions.length === 0) return null;
  const items = captions.map((c) => c.text.normalize("NFC"));
  const { size, pad, height: listH } = checklistFit(captions, zone.w, zone.h, unit);
  const box = size * 0.95;
  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        minHeight: listH,
        padding: pad,
        boxSizing: "border-box",
        borderRadius: 26 * unit,
        backgroundColor: tint(accent, 8),
        border: `${3 * unit}px dashed ${tint(accent, 45)}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: size * 0.9,
      }}
    >
      {captions.map((c, k) => {
        const start = Math.max(appear + k * 3, msToFrames(c.startMs));
        const tickAt = k + 1 < captions.length ? msToFrames(captions[k + 1].startMs) : Math.min(end - 12, msToFrames(c.endMs) + 6);
        const t = interpolate(frame, [start, start + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const tick = interpolate(frame, [tickAt, tickAt + 8], [0, 1], clamp);
        const range = punch ? findPunch(items[k], punch.text) : null;
        const current = t > 0 && tick <= 0;
        return (
          <div key={`i-${k}`} style={{ display: "flex", alignItems: "flex-start", gap: size * 0.5, opacity: t === 0 ? 0.22 : 0.22 + t * 0.78, translate: `${((1 - t) * 20 * unit).toFixed(1)}px 0` }}>
            <svg width={box} height={box} viewBox="0 0 40 40" style={{ flexShrink: 0, marginTop: size * 0.18 }}>
              <rect x={3} y={3} width={34} height={34} rx={9} fill={tick > 0 ? accent : PAPER} stroke={tick > 0 ? accent : current ? accent : "rgba(61, 43, 31, 0.35)"} strokeWidth={4} />
              <path d="M 11 21 L 18 28 L 30 13" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - tick} />
            </svg>
            <div
              style={{
                fontFamily: BODY,
                fontWeight: current ? 800 : 700,
                fontSize: size,
                lineHeight: 1.25,
                color: INK,
                opacity: tick > 0 ? 1 - tick * 0.3 : 1,
              }}
            >
              <MarkedWords text={items[k]} range={range} punchAt={punch ? Math.max(start, msToFrames(punch.atMs)) : 0} frame={frame} size={size} accent={accent} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Một thẻ bước = một cảnh
// ---------------------------------------------------------------------------
const StepCard: React.FC<{
  scene: Scene; index: number; labels: StepLabel[]; captions: Caption[]; from: number; appear: number; end: number; frame: number; accent: string;
  /** Thẻ được đặt lên bàn với đầu thẻ + ảnh in sẵn (mọi thẻ trừ thẻ đầu). */
  printed: boolean;
}> = ({ scene, index, labels, captions, from, appear, end, frame, accent, printed }) => {
  const { unit } = useLayout();
  const label = labels[index];
  const geo = useGeometry(Boolean(scene.image));
  const seed = `rc-${index}`;
  const photoT = printed ? 1 : interpolate(frame, [appear, appear + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const statT = interpolate(frame, [appear + 10, appear + 22], [0, 1], { ...clamp, easing: POP });
  const tipAt = scene.punch ? Math.max(appear + 8, msToFrames(scene.punch.atMs)) : 0;
  const tipT = interpolate(frame, [tipAt, tipAt + 14], [0, 1], { ...clamp, easing: POP });
  const zoom = interpolate(frame, [from, Math.max(from + 1, end)], [1.02, 1.12], clamp);
  const photo = geo.photo;
  // Giấy nhớ: góc trên phải ảnh (mũi tên chỉ vào món); không ảnh thì góc dưới phải danh sách (chỉ lên danh sách).
  const tipW = Math.min(photo ? photo.w * (geo.stacked ? 0.5 : 0.62) : geo.text.w * 0.46, 430 * unit);
  const tip = photo
    ? { x: photo.x + photo.w - tipW + 26 * unit, y: photo.y + 22 * unit, arrow: "left" as const }
    : { x: geo.text.x + geo.text.w - tipW - 10 * unit, y: 0, arrow: "up" as const };
  // Không ảnh: danh sách + giấy nhớ bên dưới được canh giữa như một khối.
  const tipRoom = scene.punch && !photo ? 240 * unit : 0;
  const fit = checklistFit(captions, geo.text.w, geo.text.h - tipRoom, unit);
  const listZone = { x: geo.text.x, y: geo.text.y + (geo.text.h - tipRoom - fit.height) / 2, w: geo.text.w, h: fit.height };
  if (!photo) tip.y = listZone.y + listZone.h - 24 * unit;
  // Viên con số: đè mép dưới ảnh (dọc), nằm trong góc dưới ảnh (ngang), hoặc ngay dưới đầu thẻ khi không ảnh.
  const statPos = photo
    ? { x: photo.x + 26 * unit, cy: geo.stacked ? photo.y + photo.h : photo.y + photo.h - 80 * unit, maxW: photo.w * 0.8 }
    : { x: geo.text.x + geo.text.w - Math.min(geo.text.w * 0.5, 460 * unit), cy: geo.divider ? geo.divider.y : geo.text.y, maxW: Math.min(geo.text.w * 0.5, 460 * unit) };
  return (
    <AbsoluteFill>
      <CardPaper card={geo.card} accent={accent} unit={unit} />
      <Header rect={geo.header} scene={scene} label={label} labels={labels} index={index} frame={frame} appear={appear} accent={accent} unit={unit} printed={printed} />
      {geo.divider ? <Divider at={geo.divider} accent={accent} unit={unit} /> : null}
      {photo ? <Photo rect={photo} scene={scene} from={from} zoom={zoom} unit={unit} t={photoT} /> : null}
      {photo ? (
        <Instruction captions={captions} zone={geo.text} frame={frame} appear={appear} punch={scene.punch} accent={accent} unit={unit} />
      ) : (
        <Checklist captions={captions} zone={listZone} frame={frame} appear={appear} end={end} punch={scene.punch} accent={accent} unit={unit} />
      )}
      {scene.visual && statT > 0 ? <StatPill visual={scene.visual} x={statPos.x} cy={statPos.cy} maxW={statPos.maxW} frame={frame} t={statT} accent={accent} unit={unit} /> : null}
      {scene.punch && tipT > 0 ? (
        <TipSticker text={scene.punch.text} x={tip.x} y={tip.y} w={tipW} t={tipT} arrow={tip.arrow} accent={accent} unit={unit} seed={seed} />
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Thẻ tiêu đề: tên món, dòng phụ thành các chip, handle, dĩa · muỗng · phới
// ---------------------------------------------------------------------------
const TitleCard: React.FC<{ title: string; subtitle: string; handle: string; hero: Scene | null; accent: string; frame: number }> = ({
  title, subtitle, handle, hero, accent, frame,
}) => {
  const { unit, height } = useLayout();
  const geo = useGeometry(false);
  const { card, stacked } = geo;
  const innerW = card.w - 120 * unit;
  const innerH = geo.text.y + geo.text.h - geo.header.y;
  const plate = hero?.image ? (stacked ? Math.min(innerW * 0.62, innerH * 0.36, 540 * unit) : Math.min(innerH * 0.42, 400 * unit)) : 0;
  let size = (stacked ? 118 : 104) * unit;
  while (Math.ceil((chars(title) * size * 0.52) / innerW) > (stacked ? 3 : 2) && size > 54 * unit) size *= 0.93;
  const chips = subtitle.split(/\s*[·•|]\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const iconsT = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: POP });
  const plateT = interpolate(frame, [4, 22], [0, 1], { ...clamp, easing: POP });
  const titleT = interpolate(frame, [10, 24], [0, 1], { ...clamp, easing: POP });
  // Nhấc thẻ lên khỏi bàn ở cuối phần mở đầu.
  const lift = interpolate(frame, [TITLE_FRAMES - LIFT_FRAMES, TITLE_FRAMES], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const chipSize = 38 * unit;
  return (
    <AbsoluteFill style={{ translate: `0 ${(-lift * height * 1.15).toFixed(1)}px`, rotate: `${(-lift * 7).toFixed(2)}deg` }}>
      <CardPaper card={card} accent={accent} unit={unit} />
      <div
        style={{
          position: "absolute",
          left: card.x + 60 * unit,
          width: innerW,
          top: geo.header.y,
          height: innerH,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: (stacked ? 34 : 22) * unit,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 * unit, opacity: iconsT, scale: String(0.7 + iconsT * 0.3) }}>
          <ForkIcon size={56 * unit} color={deep(accent)} />
          <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: 40 * unit, color: deep(accent), lineHeight: 1, paddingTop: 6 * unit }}>{upper("công thức")}</div>
          <SpoonIcon size={52 * unit} color={deep(accent)} />
          <WhiskIcon size={56 * unit} color={deep(accent)} />
        </div>
        {plate > 0 && hero ? (
          <div
            style={{
              width: plate,
              height: plate,
              flexShrink: 0,
              borderRadius: "50%",
              padding: plate * 0.06,
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
              boxShadow: `inset 0 0 0 ${plate * 0.012}px rgba(60, 30, 5, 0.12), 0 ${14 * unit}px ${30 * unit}px rgba(60, 30, 5, 0.35)`,
              scale: String(plateT),
              rotate: `${((1 - plateT) * -40).toFixed(1)}deg`,
            }}
          >
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
              <SceneMedia scene={hero} from={0} zoom={interpolate(frame, [0, TITLE_FRAMES], [1.05, 1.15], clamp)} />
            </div>
          </div>
        ) : null}
        <div
          style={{
            fontFamily: ROUND,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.08,
            color: INK,
            opacity: titleT,
            scale: String(0.8 + titleT * 0.2),
            paddingTop: size * 0.08,
          }}
        >
          {title}
        </div>
        <svg width={260 * unit} height={24 * unit} viewBox="0 0 260 24" style={{ opacity: titleT }}>
          <path d="M 4 12 Q 20 2 36 12 T 68 12 T 100 12 T 132 12 T 164 12 T 196 12 T 228 12 T 256 12" fill="none" stroke={accent} strokeWidth={5} strokeLinecap="round" />
        </svg>
        {chips.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 * unit }}>
            {chips.map((chip, i) => {
              const Icon = chipIconFor(chip);
              const t = interpolate(frame, [20 + i * 4, 32 + i * 4], [0, 1], { ...clamp, easing: POP });
              return (
                <div
                  key={`c-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12 * unit,
                    padding: `${12 * unit}px ${28 * unit}px ${12 * unit}px ${16 * unit}px`,
                    borderRadius: 999,
                    backgroundColor: tint(accent, 16),
                    border: `${3 * unit}px solid ${tint(accent, 45)}`,
                    scale: String(t),
                  }}
                >
                  <Icon size={chipSize * 1.2} color={deep(accent)} frame={frame} />
                  <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: chipSize, color: INK, lineHeight: 1.1 }}>{chip}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {handle ? (
          <div style={{ fontFamily: HAND, fontSize: 44 * unit, color: "rgba(61, 43, 31, 0.75)", opacity: interpolate(frame, [26, 36], [0, 1], clamp) }}>
            {handle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
export const RecipeStyle: React.FC<ShortProps> = ({ title, subtitle, handle, accent, captions, scenes, showTitle }) => {
  ensureFonts(["baloo", "nunito", "patrick"]);
  const frame = useCurrentFrame();
  const { width } = useLayout();
  const steps = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const labels = stepLabels(steps);
  const stepOf = captions.map((c) => Math.max(0, activeIndexAt(steps, msToFrames(c.startMs))));
  const titleEnd = showTitle ? TITLE_FRAMES : 0;
  const active = Math.max(0, activeIndexAt(steps, frame));
  const startOf = (i: number) => (i === 0 ? 0 : msToFrames(steps[i].startMs));
  const endOf = (i: number) => (i + 1 < steps.length ? msToFrames(steps[i + 1].startMs) : Math.max(startOf(i) + 1, msToFrames(steps[i].endMs)));
  const card = (i: number) => (
    <StepCard
      scene={steps[i]}
      index={i}
      labels={labels}
      captions={captions.filter((_, k) => stepOf[k] === i)}
      from={startOf(i)}
      appear={i === 0 ? (showTitle ? titleEnd - 6 : 4) : startOf(i) + DEAL_FRAMES - 6}
      end={endOf(i)}
      frame={frame}
      accent={accent}
      printed={i > 0}
    />
  );
  const dealing = active > 0 && frame < startOf(active) + DEAL_FRAMES;
  const dealT = dealing ? interpolate(frame, [startOf(active), startOf(active) + DEAL_FRAMES], [0, 1], { ...clamp, easing: DEAL }) : 1;
  const tiltOf = (i: number) => seeded(`rc-tilt-${i}`, -1.1, 1.1);
  // Thẻ đầu (không có thẻ tiêu đề) trượt nhẹ lên lúc mở video.
  const firstT = !showTitle && active === 0 ? interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: DEAL }) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#8a5a36", overflow: "hidden" }}>
      <KitchenTable accent={accent} />
      {dealing ? (
        <AbsoluteFill style={{ rotate: `${tiltOf(active - 1).toFixed(2)}deg`, filter: `brightness(${(1 - dealT * 0.12).toFixed(3)})` }}>{card(active - 1)}</AbsoluteFill>
      ) : null}
      <AbsoluteFill
        style={{
          rotate: `${(tiltOf(active) + (1 - dealT) * 9).toFixed(2)}deg`,
          translate: `${((1 - dealT) * width * 1.1).toFixed(1)}px ${((1 - firstT) * 60).toFixed(1)}px`,
          opacity: firstT,
        }}
      >
        {card(active)}
      </AbsoluteFill>
      {showTitle && frame < TITLE_FRAMES ? (
        <TitleCard title={title} subtitle={subtitle} handle={handle} hero={steps.find((s) => s.image) ?? null} accent={accent} frame={frame} />
      ) : null}
      <Grain opacity={0.06} animated={false} baseFrequency={0.8} />
    </AbsoluteFill>
  );
};
