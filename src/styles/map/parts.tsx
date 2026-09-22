/**
 * Các mảnh vẽ trên màn (toạ độ màn hình, không theo zoom camera): ghim, nhãn địa danh, máy bay, bưu thiếp, viên
 * quãng đường, con dấu "ĐÃ ĐẾN!", vòng khoanh, la bàn, khung viền bản đồ.
 */
import { AbsoluteFill, interpolate } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { seeded } from "../shared";
import { chars, clamp, deep, MAP, pad2, UI, upper } from "./geo";

export type Rect = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Ghim
// ---------------------------------------------------------------------------
/** Ghim giọt nước: đầu tròn màu nhấn, lõi trắng có số thứ tự điểm dừng; mũi ghim đúng toạ độ (x, y). */
export const Pin: React.FC<{ x: number; y: number; size: number; color: string; n: number; drop: number; ripple: number }> = ({
  x, y, size, color, n, drop, ripple,
}) => {
  if (drop <= 0) return null;
  const w = size * 2.4;
  const h = size * 3.3;
  const lift = (1 - drop) * size * 5;
  return (
    <>
      {/* Bóng dưới chân ghim, nhỏ và mờ khi ghim còn trên cao. */}
      <div
        style={{
          position: "absolute",
          left: x - size * 0.8,
          top: y - size * 0.28,
          width: size * 1.6,
          height: size * 0.56,
          borderRadius: "50%",
          backgroundColor: "rgba(40, 25, 10, 0.32)",
          filter: `blur(${size * 0.12}px)`,
          scale: String(0.4 + drop * 0.6),
          opacity: drop,
        }}
      />
      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: "absolute",
            left: x - size * 2.2,
            top: y - size * 0.9,
            width: size * 4.4,
            height: size * 1.8,
            borderRadius: "50%",
            border: `${size * 0.1}px solid ${color}`,
            scale: String(0.2 + ripple * 0.8),
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      <svg
        width={w}
        height={h}
        viewBox="-12 -31 24 33"
        style={{ position: "absolute", left: x - w / 2, top: y - h + (h * 2) / 33 - lift, opacity: Math.min(1, drop * 3), overflow: "visible" }}
      >
        <path d="M 0 0 C -3 -6 -10.5 -10 -10.5 -19 A 10.5 10.5 0 1 1 10.5 -19 C 10.5 -10 3 -6 0 0 Z" fill={color} stroke={MAP.paper} strokeWidth={1.6} />
        <path d="M 0 0 C -3 -6 -10.5 -10 -10.5 -19" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={1.2} />
        <circle cx={0} cy={-19} r={6.6} fill={MAP.paper} />
        <text x={0} y={-18.6} textAnchor="middle" dominantBaseline="central" fontFamily={UI} fontWeight={800} fontSize={n >= 10 ? 6.4 : 8} fill={deep(color, 0.25)}>
          {n}
        </text>
      </svg>
    </>
  );
};

/** Độ cao từ mũi ghim tới tâm đầu ghim, theo `size` — để canh nhãn ngang đầu ghim. */
export const pinHead = (size: number) => size * 1.9;

// ---------------------------------------------------------------------------
// Nhãn địa danh
// ---------------------------------------------------------------------------
/** Tách "Đà Lạt · Ngày 2" thành tên chính và dòng phụ. */
export const splitTag = (tag: string) => {
  const parts = tag.normalize("NFC").split(/\s*[·•|—–]\s*/).map((s) => s.trim()).filter(Boolean);
  return { main: parts[0] ?? tag.trim(), sub: parts.slice(1).join(" · ") || null };
};

/**
 * Nhãn của điểm đang đứng: thẻ giấy trắng viền mực, tên địa danh đậm, dòng phụ màu nhấn.
 * `anchor` "left" = mép trái thẻ ở (x, y giữa); "center" = tâm trên của thẻ ở (x, y).
 */
export const PlaceLabel: React.FC<{
  tag: string; x: number; y: number; anchor: "left" | "center"; maxW: number; size: number; accent: string; t: number; unit: number;
}> = ({ tag, x, y, anchor, maxW, size, accent, t, unit }) => {
  if (t <= 0) return null;
  const { main, sub } = splitTag(tag);
  const padX = size * 0.5;
  // Tên dài: co chữ cho vừa tối đa 2 dòng.
  let s = size;
  while (Math.ceil((chars(main) * s * 0.6) / (maxW - padX * 2)) > 2 && s > size * 0.5) s *= 0.93;
  const oneLine = chars(main) * s * 0.6 <= maxW - padX * 2;
  const subSize = Math.max(22 * unit, s * 0.46);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: maxW,
        translate: anchor === "left" ? "0 -50%" : "-50% 0",
        transformOrigin: anchor === "left" ? "0% 50%" : "50% 0%",
        scale: String(0.5 + t * 0.5),
        opacity: Math.min(1, t * 2),
        padding: `${s * 0.22}px ${padX}px ${s * 0.26}px`,
        borderRadius: 14 * unit,
        backgroundColor: MAP.paper,
        border: `${3 * unit}px solid ${MAP.ink}`,
        boxShadow: `${5 * unit}px ${6 * unit}px 0 rgba(45, 36, 25, 0.28)`,
        textAlign: anchor === "left" ? "left" : "center",
        whiteSpace: oneLine ? "nowrap" : "normal",
      }}
    >
      <div style={{ fontFamily: UI, fontWeight: 800, fontSize: s, lineHeight: 1.22, color: MAP.ink, paddingTop: s * 0.06 }}>{main}</div>
      {sub ? (
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: subSize, lineHeight: 1.3, color: deep(accent, 0.2), marginTop: s * 0.02, whiteSpace: "nowrap" }}>{sub}</div>
      ) : null}
    </div>
  );
};

/** Nhãn nhỏ của điểm đã qua — chỉ tên chính, cắt nếu dài. */
export const SmallLabel: React.FC<{ tag: string; x: number; y: number; unit: number; opacity: number }> = ({ tag, x, y, unit, opacity }) => {
  const { main } = splitTag(tag);
  const text = chars(main) > 18 ? `${Array.from(main).slice(0, 17).join("")}…` : main;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "0 -50%",
        padding: `${4 * unit}px ${12 * unit}px ${5 * unit}px`,
        borderRadius: 8 * unit,
        backgroundColor: "rgba(255, 253, 247, 0.82)",
        fontFamily: UI,
        fontWeight: 700,
        fontSize: 25 * unit,
        lineHeight: 1.25,
        color: MAP.muted,
        whiteSpace: "nowrap",
        opacity,
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Máy bay
// ---------------------------------------------------------------------------
const PLANE = "M 27 0 C 27 -3 23 -4.2 19 -4.2 L 7 -4.2 L -5 -23 L -11.5 -23 L -3.5 -4.2 L -15 -4.2 L -21 -12 L -26 -12 L -22.5 0 L -26 12 L -21 12 L -15 4.2 L -3.5 4.2 L -11.5 23 L -5 23 L 7 4.2 L 19 4.2 C 23 4.2 27 3 27 0 Z";

/** Máy bay nhìn từ trên, mũi hướng theo `angle` (radian); bóng đổ lệch xuống dưới như đang bay cao. */
export const Plane: React.FC<{ x: number; y: number; angle: number; size: number; color: string; opacity: number; lift: number }> = ({
  x, y, angle, size, color, opacity, lift,
}) => {
  if (opacity <= 0) return null;
  const deg = (angle * 180) / Math.PI;
  const box = size * 1.6;
  return (
    <svg width={box} height={box} viewBox="-30 -30 60 60" style={{ position: "absolute", left: x - box / 2, top: y - box / 2, opacity, overflow: "visible" }}>
      <path d={PLANE} transform={`translate(${6 + lift * 8} ${9 + lift * 10}) rotate(${deg}) scale(0.9)`} fill="rgba(40, 25, 10, 0.25)" />
      <path d={PLANE} transform={`rotate(${deg}) scale(${1 + lift * 0.12})`} fill={color} stroke={MAP.paper} strokeWidth={2.4} strokeLinejoin="round" />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Bưu thiếp
// ---------------------------------------------------------------------------
/** Tem thư răng cưa: nền màu nhấn, núi + mặt trời trắng, số chặng. */
const PostStamp: React.FC<{ size: number; accent: string; n: number; id: string }> = ({ size, accent, n, id }) => {
  const teeth = 7;
  const holes: React.ReactNode[] = [];
  for (let i = 0; i <= teeth; i++) {
    const p = 4 + (i * 52) / teeth;
    holes.push(<circle key={`t${i}`} cx={p} cy={4} r={2.2} />, <circle key={`b${i}`} cx={p} cy={68} r={2.2} />);
  }
  for (let i = 0; i <= teeth + 2; i++) {
    const p = 4 + (i * 64) / (teeth + 2);
    holes.push(<circle key={`l${i}`} cx={4} cy={p} r={2.2} />, <circle key={`r${i}`} cx={56} cy={p} r={2.2} />);
  }
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 60 72" style={{ display: "block", filter: `drop-shadow(0 ${size * 0.02}px ${size * 0.04}px rgba(0,0,0,0.3))` }}>
      <defs>
        <mask id={id}>
          <rect x={0} y={0} width={60} height={72} fill="#fff" />
          <g fill="#000">{holes}</g>
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <rect x={0} y={0} width={60} height={72} fill={MAP.paper} />
        <rect x={8} y={8} width={44} height={56} fill={accent} />
        <circle cx={38} cy={24} r={6} fill={MAP.paper} opacity={0.9} />
        <path d="M 8 56 L 22 34 L 30 44 L 38 32 L 52 52 L 52 64 L 8 64 Z" fill={deep(accent, 0.35)} />
        <path d="M 18 40 L 22 34 L 26 39" fill="none" stroke={MAP.paper} strokeWidth={1.8} strokeLinejoin="round" />
        <text x={14} y={20} fontFamily={UI} fontWeight={800} fontSize={10} fill={MAP.paper}>{pad2(n)}</text>
      </g>
    </svg>
  );
};

/** Dấu bưu điện: hai vòng tròn + các vạch lượn sóng, mực đen mờ. */
const PostMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size * 1.9} height={size} viewBox="0 0 95 50" style={{ display: "block" }}>
    <g fill="none" stroke="rgba(30, 24, 18, 0.55)" strokeWidth={1.8}>
      <circle cx={25} cy={25} r={21} />
      <circle cx={25} cy={25} r={15} strokeWidth={1.1} />
      {[14, 22, 30, 38].map((y) => <path key={y} d={`M 50 ${y} q 6 -4 12 0 t 12 0 t 12 0 t 8 0`} />)}
    </g>
  </svg>
);

/**
 * Bưu thiếp ảnh: viền trắng, bo góc, nghiêng nhẹ theo seed, tem góc trên phải + dấu bưu điện. Bật ra từ phía ghim
 * (`origin`, toạ độ màn), lúc rời cảnh thì thu nhỏ về ghim.
 */
export const Postcard: React.FC<{
  rect: Rect; scene: Scene; index: number; from: number; zoom: number; t: number; exit: number; origin: { x: number; y: number }; accent: string; unit: number;
}> = ({ rect, scene, index, from, zoom, t, exit, origin, accent, unit }) => {
  if (t <= 0 || exit >= 1) return null;
  const tilt = seeded(`map-card-${index}`, 1.5, 3.5) * (index % 2 === 0 ? -1 : 1);
  const border = Math.max(12 * unit, Math.min(rect.w, rect.h) * 0.035);
  const ox = ((origin.x - rect.x) / rect.w) * 100;
  const oy = ((origin.y - rect.y) / rect.h) * 100;
  const scale = (0.25 + t * 0.75) * (1 - exit * 0.8);
  const stamp = Math.min(rect.w, rect.h) * 0.2;
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        padding: border,
        boxSizing: "border-box",
        borderRadius: 16 * unit,
        backgroundColor: MAP.paper,
        boxShadow: `0 ${14 * unit}px ${34 * unit}px rgba(40, 25, 10, 0.38), 0 ${2 * unit}px ${4 * unit}px rgba(40, 25, 10, 0.2)`,
        transformOrigin: `${ox.toFixed(1)}% ${oy.toFixed(1)}%`,
        scale: String(scale),
        rotate: `${(tilt + (1 - t) * 14 * (index % 2 === 0 ? -1 : 1)).toFixed(2)}deg`,
        opacity: Math.min(1, t * 2.5) * (1 - exit),
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: 8 * unit, overflow: "hidden", backgroundColor: "#d9cfbd" }}>
        <SceneMedia scene={scene} from={from} zoom={zoom} />
      </div>
      <div style={{ position: "absolute", right: border * 0.7, top: border * 0.7, rotate: "4deg" }}>
        <PostStamp size={stamp} accent={accent} n={index + 1} id={`map-stamp-${index}`} />
      </div>
      <div style={{ position: "absolute", right: border * 0.7 + stamp * 0.55, top: border * 0.7 + stamp * 0.55, rotate: "-8deg", opacity: 0.85 }}>
        <PostMark size={stamp * 0.62} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Viên quãng đường / thời gian gắn vào chặng
// ---------------------------------------------------------------------------
const RULER = "M -11 -6 L 11 -6 L 11 6 L -11 6 Z M -6 -6 L -6 -1 M -1 -6 L -1 1.5 M 4 -6 L 4 -1";
const CLOCK = "M 0 -10 A 10 10 0 1 1 -0.01 -10 Z M 0 -5.5 L 0 0 L 4.5 2.5";
const FLAG = "M -6 11 L -6 -11 M -6 -10 L 9 -10 L 5 -4.5 L 9 1 L -6 1";

const iconFor = (text: string) => {
  if (/\d\s*(km|m|dặm|cây số|mét)\b/i.test(text) || /km|cây số/i.test(text)) return RULER;
  if (/ngày|giờ|tiếng|phút|đêm|tuần|tháng|năm|\d\s*h\b/i.test(text)) return CLOCK;
  return FLAG;
};

export const statSize = (visual: NonNullable<Scene["visual"]>, unit: number) => {
  const text = 46 * unit;
  const w = Math.max(chars(visual.text) * text * 0.62, visual.caption ? chars(visual.caption) * 24 * unit * 0.6 : 0) + 150 * unit;
  return { w: Math.min(w, 600 * unit), h: visual.caption ? 112 * unit : 92 * unit };
};

/**
 * Viên mực đậm: vòng màu nhấn có biểu tượng (thước cho km, đồng hồ cho ngày/giờ, cờ cho còn lại) + con số + chú
 * thích. Nối với điểm trên chặng (`anchor`) bằng một vạch mảnh và chấm tròn.
 */
export const StatBadge: React.FC<{
  visual: NonNullable<Scene["visual"]>; box: Rect; anchor: { x: number; y: number }; t: number; accent: string; unit: number;
}> = ({ visual, box, anchor, t, accent, unit }) => {
  if (t <= 0) return null;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const icon = iconFor(`${visual.text} ${visual.caption ?? ""}`);
  const circle = box.h - 22 * unit;
  let textSize = 46 * unit;
  const room = box.w - circle - 60 * unit;
  while (chars(visual.text) * textSize * 0.62 > room && textSize > 26 * unit) textSize *= 0.94;
  const lineT = interpolate(t, [0, 0.6], [0, 1], clamp);
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={anchor.x + (cx - anchor.x) * lineT}
          y2={anchor.y + (cy - anchor.y) * lineT}
          stroke={MAP.ink}
          strokeWidth={3 * unit}
          strokeDasharray={`${3 * unit} ${6 * unit}`}
          strokeLinecap="round"
        />
        <circle cx={anchor.x} cy={anchor.y} r={9 * unit * Math.min(1, t * 3)} fill={MAP.paper} stroke={MAP.ink} strokeWidth={3.5 * unit} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 16 * unit,
          padding: `0 ${26 * unit}px 0 ${11 * unit}px`,
          borderRadius: box.h / 2,
          backgroundColor: MAP.ink,
          boxShadow: `0 ${8 * unit}px ${18 * unit}px rgba(40, 25, 10, 0.35)`,
          scale: String(interpolate(t, [0.2, 1], [0.3, 1], clamp)),
          opacity: interpolate(t, [0.2, 0.5], [0, 1], clamp),
        }}
      >
        <svg width={circle} height={circle} viewBox="-18 -18 36 36" style={{ flexShrink: 0 }}>
          <circle r={18} fill={accent} />
          <path d={icon} fill="none" stroke={MAP.paper} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontFamily: UI, fontWeight: 800, fontSize: textSize, lineHeight: 1.1, color: MAP.paper, whiteSpace: "nowrap", paddingTop: textSize * 0.08 }}>{visual.text}</div>
          {visual.caption ? (
            <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 24 * unit, lineHeight: 1.3, color: "rgba(255, 253, 247, 0.72)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {visual.caption}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Câu nhấn: con dấu cao su + vòng khoanh quanh ghim
// ---------------------------------------------------------------------------
/** Con dấu cao su (dòng nhỏ `top` + chữ lớn `text`) đóng xuống: phóng to → đập xuống, nghiêng, viền đôi màu nhấn, in chồng (multiply). */
export const RubberStamp: React.FC<{ text: string; top: string; x: number; y: number; width: number; t: number; accent: string; unit: number }> = ({
  text, top, x, y, width, t, accent, unit,
}) => {
  if (t <= 0) return null;
  const ink = deep(accent, 0.12);
  const main = upper(text);
  let size = 64 * unit;
  while (Math.ceil((chars(main) * size * 0.66) / (width - 60 * unit)) > 2 && size > 28 * unit) size *= 0.93;
  const scale = interpolate(t, [0, 0.55, 0.75, 1], [2.2, 0.92, 1.04, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        translate: "-50% -50%",
        rotate: "-11deg",
        scale: String(scale),
        opacity: interpolate(t, [0, 0.35], [0, 1], clamp),
        padding: `${14 * unit}px ${22 * unit}px ${16 * unit}px`,
        border: `${6 * unit}px solid ${ink}`,
        outline: `${2.5 * unit}px solid ${ink}`,
        outlineOffset: `${5 * unit}px`,
        borderRadius: 12 * unit,
        textAlign: "center",
        color: ink,
        backgroundColor: "rgba(255, 250, 240, 0.86)",
        boxShadow: `0 ${6 * unit}px ${16 * unit}px rgba(40, 25, 10, 0.25)`,
      }}
    >
      <div style={{ fontFamily: UI, fontWeight: 800, fontSize: Math.min(24 * unit, (width - 70 * unit) / (chars(top) * 0.82)), lineHeight: 1.35, letterSpacing: "0.12em", paddingTop: 4 * unit, whiteSpace: "nowrap" }}>
        {upper(top)}
      </div>
      <div style={{ fontFamily: UI, fontWeight: 900, fontSize: size, lineHeight: 1.34, paddingTop: size * 0.1 }}>{main}</div>
    </div>
  );
};

/** Vòng khoanh tay quanh ghim, vẽ dần bằng dashoffset. */
export const CircleMark: React.FC<{ x: number; y: number; r: number; draw: number; color: string; unit: number; seed: string }> = ({ x, y, r, draw, color, unit, seed }) => {
  if (draw <= 0) return null;
  const wob = seeded(seed, -0.08, 0.08);
  const d = `M ${r * 0.95} ${-r * 0.2} C ${r * 1.02} ${r * 0.7} ${-r * 0.8} ${r * (0.95 + wob)} ${-r * 1.02} ${r * 0.05} C ${-r * 1.1} ${-r * 0.85} ${r * 0.6} ${-r * 1.05} ${r * 1.0} ${-r * 0.3} C ${r * 1.08} ${-r * 0.05} ${r * 0.9} ${r * 0.3} ${r * 0.62} ${r * 0.5}`;
  return (
    <svg style={{ position: "absolute", left: x, top: y, overflow: "visible" }} width={1} height={1}>
      <path d={d} fill="none" stroke={color} strokeWidth={7 * unit} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={0.9} />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// La bàn và khung viền
// ---------------------------------------------------------------------------
/** La bàn 8 cánh, chữ "B" (Bắc) trên đỉnh; kim rung nhẹ. */
export const Compass: React.FC<{ x: number; y: number; r: number; frame: number; accent: string; opacity: number }> = ({ x, y, r, frame, accent, opacity }) => {
  const wiggle = Math.sin(frame / 18) * 3;
  const long = [0, 90, 180, 270];
  const short = [45, 135, 225, 315];
  return (
    <svg width={r * 2.6} height={r * 2.6} viewBox="-65 -65 130 130" style={{ position: "absolute", left: x - r * 1.3, top: y - r * 1.3, opacity }}>
      <circle r={46} fill="rgba(255, 253, 247, 0.55)" stroke={MAP.ink} strokeWidth={1.6} />
      <circle r={40} fill="none" stroke={MAP.ink} strokeWidth={0.8} strokeDasharray="2 3" />
      <g transform={`rotate(${wiggle.toFixed(2)})`}>
        {short.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M 0 -30 L 5 0 L 0 0 Z" fill={MAP.ink} />
            <path d="M 0 -30 L -5 0 L 0 0 Z" fill={MAP.paper} stroke={MAP.ink} strokeWidth={0.8} />
          </g>
        ))}
        {long.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M 0 -52 L 8 0 L 0 0 Z" fill={a === 0 ? accent : MAP.ink} />
            <path d="M 0 -52 L -8 0 L 0 0 Z" fill={MAP.paper} stroke={a === 0 ? accent : MAP.ink} strokeWidth={1} />
          </g>
        ))}
        <circle r={4} fill={MAP.paper} stroke={MAP.ink} strokeWidth={1.4} />
      </g>
      <text x={0} y={-56} textAnchor="middle" fontFamily={UI} fontWeight={800} fontSize={13} fill={MAP.ink}>B</text>
    </svg>
  );
};

/** Khung viền bản đồ: nét đôi mực + dải chia độ đen trắng xen kẽ ở mép, góc vuông nhỏ. */
export const Neatline: React.FC<{ width: number; height: number; unit: number }> = ({ width, height, unit }) => {
  const m = 22 * unit;
  const band = 10 * unit;
  const seg = 60 * unit;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height}>
        <rect x={m} y={m} width={width - m * 2} height={height - m * 2} fill="none" stroke={MAP.ink} strokeWidth={3 * unit} opacity={0.7} />
        <rect
          x={m + band / 2 + 1.5 * unit}
          y={m + band / 2 + 1.5 * unit}
          width={width - m * 2 - band - 3 * unit}
          height={height - m * 2 - band - 3 * unit}
          fill="none"
          stroke={MAP.ink}
          strokeWidth={band}
          strokeDasharray={`${seg} ${seg}`}
          opacity={0.16}
        />
        <rect x={m + band + 3 * unit} y={m + band + 3 * unit} width={width - (m + band + 3 * unit) * 2} height={height - (m + band + 3 * unit) * 2} fill="none" stroke={MAP.ink} strokeWidth={1.4 * unit} opacity={0.6} />
        {[
          [m, m], [width - m, m], [m, height - m], [width - m, height - m],
        ].map(([cx, cy], i) => (
          <rect key={i} x={cx - band} y={cy - band} width={band * 2} height={band * 2} fill={MAP.paper} stroke={MAP.ink} strokeWidth={2 * unit} opacity={0.85} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** Viền tối mép giấy + ánh sáng giữa — cho bản đồ giống tờ giấy thật. */
export const PaperVignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: "radial-gradient(ellipse at 50% 45%, rgba(255, 248, 225, 0.18) 0%, transparent 45%, rgba(92, 64, 30, 0.26) 100%)",
    }}
  />
);

/** Nếp gấp giấy (dọc 1/3, 2/3, ngang 1/2): đậm lúc mở bản đồ, sau đó còn vệt mờ. */
export const FoldCreases: React.FC<{ strength: number }> = ({ strength }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity: strength }}>
    {[33.33, 66.66].map((p) => (
      <div
        key={p}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${p}%`,
          width: "3%",
          translate: "-50% 0",
          background: "linear-gradient(90deg, transparent, rgba(80, 55, 25, 0.16) 48%, rgba(255, 250, 235, 0.35) 52%, transparent)",
        }}
      />
    ))}
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "50%",
        height: "2.4%",
        translate: "0 -50%",
        background: "linear-gradient(180deg, transparent, rgba(80, 55, 25, 0.14) 48%, rgba(255, 250, 235, 0.32) 52%, transparent)",
      }}
    />
  </AbsoluteFill>
);

