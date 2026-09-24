/**
 * Nét vẽ của phong cách "Bản vẽ kỹ thuật": khung ảnh tham chiếu (ảnh chuyển sang tông giấy can), dấu canh góc,
 * đường kích thước có mũi tên tự vẽ, số chỉ dẫn trên ảnh, hình vẽ kỹ thuật khi cảnh không có ảnh,
 * ký hiệu mặt cắt cho `tag`, kích thước lớn cho số liệu và nhãn chi tiết cho badge.
 *
 * Nét tự vẽ dùng pathLength = 1 + strokeDashoffset: progress 0 → chưa có gì, 1 → vẽ xong.
 */
import { AbsoluteFill } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { seeded } from "../shared";
import { C, LABEL, MONO, NOTE, POP, ramp, sub, upper } from "./theme";
import { useVt } from "../../i18n/video";

export type Box = { x: number; y: number; w: number; h: number };

/** Một nét SVG tự vẽ. */
export const Stroke: React.FC<{
  d: string;
  t: number;
  width: number;
  color?: string;
  dash?: string;
  opacity?: number;
}> = ({ d, t, width, color = C.ink, dash, opacity = 1 }) => {
  if (t <= 0) return null;
  // Nét đứt (đường khuất, đường tâm) không dùng được mẹo dashoffset — cho hiện dần bằng độ mờ.
  if (dash) {
    return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} opacity={opacity * Math.min(1, t * 1.4)} />;
  }
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - Math.min(1, t)}
      opacity={opacity}
    />
  );
};

const rectPath = (b: Box) => `M${b.x},${b.y} H${b.x + b.w} V${b.y + b.h} H${b.x} Z`;

/** Mũi tên kích thước kiểu kỹ thuật: tam giác hẹp, đặc. `angle` = hướng mũi nhọn (rad). */
const Arrow: React.FC<{ x: number; y: number; angle: number; size: number; opacity: number; color?: string }> = ({
  x,
  y,
  angle,
  size,
  opacity,
  color = C.ink,
}) => {
  const back = (a: number) => [x - Math.cos(angle + a) * size, y - Math.sin(angle + a) * size];
  const [x1, y1] = back(0.3);
  const [x2, y2] = back(-0.3);
  return <path d={`M${x},${y} L${x1},${y1} L${x2},${y2} Z`} fill={color} opacity={opacity} />;
};

/**
 * Đường kích thước: hai đường gióng từ vật ra, đường kích thước có mũi tên hai đầu vẽ từ giữa ra, số đo ở giữa.
 * `side`: phía đặt đường so với đoạn đo (trên / phải).
 */
export const Dimension: React.FC<{
  from: [number, number];
  to: [number, number];
  offset: number;
  label: string;
  t: number;
  unit: number;
  vertical?: boolean;
}> = ({ from, to, offset, label, t, unit, vertical = false }) => {
  if (t <= 0) return null;
  const sw = Math.max(1, 1.4 * unit);
  const ext = offset + 14 * unit * Math.sign(offset);
  // Điểm trên đường kích thước.
  const a: [number, number] = vertical ? [from[0] + offset, from[1]] : [from[0], from[1] + offset];
  const b: [number, number] = vertical ? [to[0] + offset, to[1]] : [to[0], to[1] + offset];
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const grow = sub(t, 0.25, 0.55);
  const pa: [number, number] = [mx + (a[0] - mx) * grow, my + (a[1] - my) * grow];
  const pb: [number, number] = [mx + (b[0] - mx) * grow, my + (b[1] - my) * grow];
  const extT = sub(t, 0, 0.35);
  const labelT = sub(t, 0.6, 0.4);
  const font = 19 * unit;
  const boxW = label.length * font * 0.64 + 16 * unit;
  const boxH = font * 1.5;
  const angle = vertical ? Math.PI / 2 : 0;
  const ext1 = vertical ? `M${from[0] + 6 * unit * Math.sign(offset)},${from[1]} h${(ext - 6 * unit * Math.sign(offset)) * extT}` : `M${from[0]},${from[1] + 6 * unit * Math.sign(offset)} v${(ext - 6 * unit * Math.sign(offset)) * extT}`;
  const ext2 = vertical ? `M${to[0] + 6 * unit * Math.sign(offset)},${to[1]} h${(ext - 6 * unit * Math.sign(offset)) * extT}` : `M${to[0]},${to[1] + 6 * unit * Math.sign(offset)} v${(ext - 6 * unit * Math.sign(offset)) * extT}`;
  return (
    <g>
      <path d={ext1} stroke={C.soft} strokeWidth={sw} />
      <path d={ext2} stroke={C.soft} strokeWidth={sw} />
      {grow > 0 ? <path d={`M${pa[0]},${pa[1]} L${pb[0]},${pb[1]}`} stroke={C.ink} strokeWidth={sw} /> : null}
      {grow > 0.98 ? (
        <>
          <Arrow x={a[0]} y={a[1]} angle={angle + Math.PI} size={16 * unit} opacity={1} />
          <Arrow x={b[0]} y={b[1]} angle={angle} size={16 * unit} opacity={1} />
        </>
      ) : null}
      {labelT > 0 ? (
        <g opacity={labelT} transform={`translate(${mx}, ${my}) rotate(${vertical ? -90 : 0})`}>
          <rect x={-boxW / 2} y={-boxH / 2} width={boxW} height={boxH} fill={C.paper} />
          <text x={0} y={0} fill={C.ink} fontFamily={MONO} fontSize={font} textAnchor="middle" dominantBaseline="central">
            {label}
          </text>
        </g>
      ) : null}
    </g>
  );
};

/** Dấu canh góc: vòng tròn có chữ thập, đặt chéo ra ngoài bốn góc khung. */
const RegMark: React.FC<{ x: number; y: number; r: number; t: number; sw: number }> = ({ x, y, r, t, sw }) => (
  <g opacity={t} transform={`rotate(${(1 - t) * -90}, ${x}, ${y})`}>
    <circle cx={x} cy={y} r={r * 0.55} fill="none" stroke={C.ink} strokeWidth={sw} />
    <path d={`M${x - r},${y} H${x + r} M${x},${y - r} V${y + r}`} stroke={C.ink} strokeWidth={sw} />
  </g>
);

/** Số chỉ dẫn (bóng tròn có số) trên ảnh, nối bằng đường dẫn tới một chấm — ứng với ghi chú cùng số. */
const Balloon: React.FC<{ n: number; frame: Box; t: number; unit: number; seed: string }> = ({ n, frame, t, unit, seed }) => {
  if (t <= 0) return null;
  // Rải vị trí theo lưới 3 cột để các bóng không chồng nhau.
  const col = (n - 1) % 3;
  const bx = frame.x + frame.w * (0.18 + col * 0.32 + seeded(`${seed}-bx`, -0.05, 0.05));
  const by = frame.y + frame.h * (0.2 + seeded(`${seed}-by`, 0, 0.55));
  const dx = seeded(`${seed}-dx`, 0.5, 1) * (col === 2 ? -1 : 1) * 70 * unit;
  const dy = seeded(`${seed}-dy`, 0.4, 1) * 60 * unit;
  const r = 24 * unit;
  const pop = Math.min(1.12, POP(Math.min(1, t)));
  const lead = sub(t, 0.3, 0.7);
  const sw = Math.max(1, 1.8 * unit);
  // Đường dẫn bắt đầu ở mép bóng, chạy tới chấm.
  const len = Math.hypot(dx, dy) || 1;
  const sx = bx + (dx / len) * r;
  const sy = by + (dy / len) * r;
  return (
    <g>
      {lead > 0 ? (
        <>
          <path d={`M${sx},${sy} L${sx + (bx + dx - sx) * lead},${sy + (by + dy - sy) * lead}`} stroke={C.ink} strokeWidth={sw} />
          <circle cx={bx + dx} cy={by + dy} r={5 * unit * lead} fill={C.ink} />
        </>
      ) : null}
      <g transform={`translate(${bx}, ${by}) scale(${pop})`}>
        <circle r={r} fill={C.paperDeep} stroke={C.ink} strokeWidth={sw * 1.2} />
        <text fill={C.ink} fontFamily={LABEL} fontWeight={700} fontSize={25 * unit} textAnchor="middle" dominantBaseline="central">
          {n}
        </text>
      </g>
    </g>
  );
};

/** Ảnh/clip đổi sang tông giấy can: xám hoá tăng tương phản, bóng tối thành xanh đậm, vùng sáng thành trắng xanh. */
const BlueprintMedia: React.FC<{ scene: Scene; from: number; zoom: number; unit: number }> = ({ scene, from, zoom, unit }) => (
  <AbsoluteFill style={{ overflow: "hidden", backgroundColor: C.paperDeep }}>
    <AbsoluteFill style={{ filter: "grayscale(1) contrast(1.5) brightness(0.9)" }}>
      <SceneMedia scene={scene} from={from} zoom={zoom} />
    </AbsoluteFill>
    <AbsoluteFill style={{ backgroundColor: "#0a3572", mixBlendMode: "screen" }} />
    <AbsoluteFill style={{ backgroundColor: "#9fcaf6", mixBlendMode: "multiply" }} />
    {/* Lưới mảnh in chồng lên ảnh cho giống bản in can. */}
    <AbsoluteFill
      style={{
        backgroundImage: `repeating-linear-gradient(90deg, rgba(230,244,255,0.10) 0px, rgba(230,244,255,0.10) 1px, transparent 1px, transparent ${(27 * unit).toFixed(1)}px), repeating-linear-gradient(0deg, rgba(230,244,255,0.10) 0px, rgba(230,244,255,0.10) 1px, transparent 1px, transparent ${(27 * unit).toFixed(1)}px)`,
      }}
    />
  </AbsoluteFill>
);

/** Hình vẽ kỹ thuật thay ảnh: cặp bánh răng, khối lập phương trục đo, hoặc mặt bích có tâm chữ thập. */
const Diagram: React.FC<{ box: Box; kind: number; t: number; unit: number }> = ({ box, kind, t, unit }) => {
  const sw = Math.max(1, 2.4 * unit);
  const thin = Math.max(1, 1.3 * unit);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const s = Math.min(box.w, box.h);
  const centerDash = `${(22 * unit).toFixed(1)} ${(6 * unit).toFixed(1)} ${(4 * unit).toFixed(1)} ${(6 * unit).toFixed(1)}`;
  const hidden = `${(10 * unit).toFixed(1)} ${(7 * unit).toFixed(1)}`;
  const p = (a: number, len = 0.4) => sub(t, a, len);

  if (kind === 0) {
    // Cặp bánh răng ăn khớp.
    const gear = (gx: number, gy: number, r: number, teeth: number, phase: number) => {
      const step = (Math.PI * 2) / teeth;
      const rin = r * 0.86;
      const pts: string[] = [];
      for (let i = 0; i < teeth; i++) {
        const a = i * step + phase;
        const at = (rad: number, ang: number) => `${(gx + Math.cos(ang) * rad).toFixed(1)},${(gy + Math.sin(ang) * rad).toFixed(1)}`;
        pts.push(at(rin, a), at(r, a + step * 0.14), at(r, a + step * 0.4), at(rin, a + step * 0.54));
      }
      return `M${pts.join(" L")} Z`;
    };
    const circle = (x: number, y: number, r: number) => `M${x - r},${y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
    const r1 = s * 0.3;
    const r2 = s * 0.2;
    const g1x = cx - s * 0.16;
    const g1y = cy + s * 0.04;
    const g2x = g1x + (r1 + r2) * 0.9 * Math.cos(-0.5);
    const g2y = g1y + (r1 + r2) * 0.9 * Math.sin(-0.5);
    return (
      <g>
        <Stroke d={`M${g1x - r1 * 1.25},${g1y} H${g1x + r1 * 1.25} M${g1x},${g1y - r1 * 1.25} V${g1y + r1 * 1.25}`} t={p(0)} width={thin} color={C.soft} dash={centerDash} />
        <Stroke d={`M${g2x - r2 * 1.3},${g2y} H${g2x + r2 * 1.3} M${g2x},${g2y - r2 * 1.3} V${g2y + r2 * 1.3}`} t={p(0.05)} width={thin} color={C.soft} dash={centerDash} />
        <Stroke d={gear(g1x, g1y, r1, 18, 0)} t={p(0.1, 0.55)} width={sw} />
        <Stroke d={gear(g2x, g2y, r2, 12, 0.2)} t={p(0.25, 0.5)} width={sw} />
        <Stroke d={circle(g1x, g1y, r1 * 0.3)} t={p(0.4)} width={sw} />
        <Stroke d={circle(g2x, g2y, r2 * 0.32)} t={p(0.45)} width={sw} />
        <Stroke d={circle(g1x, g1y, r1 * 0.72)} t={p(0.5)} width={thin} color={C.soft} dash={hidden} />
        <text x={g1x + r1 * 0.2} y={g1y + r1 + 44 * unit} fill={C.soft} fontFamily={MONO} fontSize={18 * unit} opacity={p(0.7, 0.3)}>
          Z=18 · m=2
        </text>
      </g>
    );
  }

  if (kind === 1) {
    // Khối lập phương vẽ trục đo, cạnh khuất nét đứt.
    const a = s * 0.3;
    const c30 = Math.cos(Math.PI / 6);
    const v = (x: number, y: number) => `${(cx + x).toFixed(1)},${(cy + y).toFixed(1)}`;
    const top = [v(0, -a), v(a * c30, -a / 2), v(0, 0), v(-a * c30, -a / 2)];
    const down = (pt: [number, number]) => v(pt[0], pt[1] + a);
    const visible = [
      `M${top[0]} L${top[1]} L${top[2]} L${top[3]} Z`,
      `M${top[3]} L${down([-a * c30, -a / 2])} L${down([0, 0])} L${down([a * c30, -a / 2])} L${top[1]}`,
      `M${top[2]} L${down([0, 0])}`,
    ];
    const hiddenPath = `M${down([0, -a])} L${top[0]} M${down([0, -a])} L${down([-a * c30, -a / 2])} M${down([0, -a])} L${down([a * c30, -a / 2])}`;
    return (
      <g>
        <Stroke d={visible[0]} t={p(0, 0.4)} width={sw} />
        <Stroke d={visible[1]} t={p(0.2, 0.45)} width={sw} />
        <Stroke d={visible[2]} t={p(0.35, 0.3)} width={sw} />
        <Stroke d={hiddenPath} t={p(0.55, 0.3)} width={thin} color={C.soft} dash={hidden} />
        <text x={cx + a * c30 + 22 * unit} y={cy + a * 0.35} fill={C.soft} fontFamily={MONO} fontSize={19 * unit} opacity={p(0.7, 0.3)}>
          a = 300
        </text>
      </g>
    );
  }

  // Mặt bích: vòng ngoài, lỗ tâm, 6 lỗ bu lông, đường tâm chữ thập, chú thích bán kính.
  const R = s * 0.34;
  const circle = (x: number, y: number, r: number) => `M${x - r},${y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
  return (
    <g>
      <Stroke d={`M${cx - R * 1.3},${cy} H${cx + R * 1.3} M${cx},${cy - R * 1.3} V${cy + R * 1.3}`} t={p(0)} width={thin} color={C.soft} dash={centerDash} />
      <Stroke d={circle(cx, cy, R)} t={p(0.05, 0.5)} width={sw} />
      <Stroke d={circle(cx, cy, R * 0.38)} t={p(0.25, 0.4)} width={sw} />
      <Stroke d={circle(cx, cy, R * 0.7)} t={p(0.35, 0.4)} width={thin} color={C.soft} dash={centerDash} />
      {Array.from({ length: 6 }, (_, i) => {
        const ang = (i * Math.PI) / 3 + Math.PI / 6;
        return <Stroke key={i} d={circle(cx + Math.cos(ang) * R * 0.7, cy + Math.sin(ang) * R * 0.7, R * 0.09)} t={p(0.45 + i * 0.05, 0.2)} width={sw} />;
      })}
      <Stroke d={`M${cx},${cy} L${cx + R * 0.72},${cy - R * 0.72} h${60 * unit}`} t={p(0.7, 0.2)} width={thin} />
      <text x={cx + R * 0.74} y={cy - R * 0.72 - 10 * unit} fill={C.ink} fontFamily={MONO} fontSize={19 * unit} opacity={p(0.85, 0.15)}>
        R 120
      </text>
    </g>
  );
};

/**
 * Khung ảnh tham chiếu của một cảnh: nét khung tự vẽ, ảnh lộ dần sau vạch quét, dấu canh bốn góc, đường kích thước
 * ngang phía trên và dọc bên phải, số chỉ dẫn cho từng câu ghi chú. `t` = tiến độ vẽ (frame tính từ lúc bắt đầu vẽ).
 */
export const ReferenceFrame: React.FC<{
  scene: Scene;
  index: number;
  box: Box;
  local: number;
  appear: number;
  unit: number;
  width: number;
  height: number;
  balloons: number[];
  frame: number;
}> = ({ scene, index, box, local, appear, unit, width, height, balloons, frame }) => {
  const vt = useVt();
  const sw = Math.max(1, 2.6 * unit);
  const border = ramp(local, 0, 16);
  const reveal = ramp(local, 8, 16);
  const marks = ramp(local, 12, 10);
  const dimH = ramp(local, 14, 18, (x) => x);
  const dimV = ramp(local, 20, 18, (x) => x);
  const inner: Box = { x: box.x + 9 * unit, y: box.y + 9 * unit, w: box.w - 18 * unit, h: box.h - 18 * unit };
  const hasMedia = !!scene.image;
  const off = 30 * unit;
  const num = String(index + 1).padStart(2, "0");
  // Số đo "mm" suy từ kích thước khung — mỗi khung một số, nhìn như số đo thật.
  const mmW = Math.round(box.w / unit / 10) * 10;
  const mmH = Math.round(box.h / unit / 10) * 10;
  const scanY = inner.y + inner.h * reveal;
  return (
    <AbsoluteFill>
      {hasMedia ? (
        <div
          style={{
            position: "absolute",
            left: inner.x,
            top: inner.y,
            width: inner.w,
            height: inner.h,
            clipPath: `inset(0 0 ${((1 - reveal) * 100).toFixed(2)}% 0)`,
          }}
        >
          <BlueprintMedia scene={scene} from={appear} zoom={1.03 + 0.07 * Math.min(1, Math.max(0, local) / 300)} unit={unit} />
        </div>
      ) : null}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {!hasMedia ? <Diagram box={inner} kind={index % 3} t={ramp(local, 10, 50, (x) => x)} unit={unit} /> : null}
        {hasMedia && reveal > 0 && reveal < 1 ? (
          <line x1={inner.x - 12 * unit} x2={inner.x + inner.w + 12 * unit} y1={scanY} y2={scanY} stroke={C.ink} strokeWidth={sw} opacity={0.9} />
        ) : null}
        <Stroke d={rectPath(box)} t={border} width={sw} />
        <Stroke d={rectPath(inner)} t={ramp(local, 5, 14)} width={Math.max(1, 1.1 * unit)} color={C.soft} />
        {[
          [box.x - 22 * unit, box.y - 22 * unit],
          [box.x + box.w + 22 * unit, box.y - 22 * unit],
          [box.x + box.w + 22 * unit, box.y + box.h + 22 * unit],
          [box.x - 22 * unit, box.y + box.h + 22 * unit],
        ].map(([x, y], i) => (
          <RegMark key={i} x={x} y={y} r={15 * unit} t={marks} sw={Math.max(1, 1.5 * unit)} />
        ))}
        <Dimension from={[box.x, box.y]} to={[box.x + box.w, box.y]} offset={-off - 12 * unit} label={`${mmW}`} t={dimH} unit={unit} />
        <Dimension from={[box.x + box.w, box.y]} to={[box.x + box.w, box.y + box.h]} offset={off + 12 * unit} label={`${mmH}`} t={dimV} unit={unit} vertical />
        {balloons.map((start, k) => (
          <Balloon key={k} n={k + 1} frame={inner} t={ramp(frame, start, 10, (x) => x)} unit={unit} seed={`bp-${index}-${k}`} />
        ))}
      </svg>
      {/* Chú thích hình dưới khung, như "HÌNH 01 — ẢNH THAM CHIẾU". */}
      <div
        style={{
          position: "absolute",
          left: box.x,
          top: box.y + box.h + 12 * unit,
          fontFamily: MONO,
          fontSize: 17 * unit,
          letterSpacing: "0.08em",
          color: C.soft,
          opacity: marks,
          whiteSpace: "nowrap",
        }}
      >
        {`${vt("HÌNH {n}", { n: num })} — ${hasMedia ? (/\.(mp4|mov|webm)$/i.test(scene.image ?? "") ? vt("VIDEO THAM CHIẾU") : vt("ẢNH THAM CHIẾU")) : vt("SƠ ĐỒ NGUYÊN LÝ")}`}
      </div>
    </AbsoluteFill>
  );
};

/** Ký hiệu mặt cắt cho `tag`: vòng tròn chia đôi (chữ mặt cắt / số tờ) có mũi tên hướng nhìn, bên cạnh là nhãn. */
export const SectionTag: React.FC<{
  x: number;
  y: number;
  maxW: number;
  tag: string;
  letter: string;
  sheet: number;
  t: number;
  unit: number;
  accent: string;
}> = ({ x, y, maxW, tag, letter, sheet, t, unit, accent }) => {
  const vt = useVt();
  if (t <= 0) return null;
  const r = 36 * unit;
  const sw = Math.max(1, 2.2 * unit);
  const ring = sub(t, 0, 0.5);
  const textT = sub(t, 0.35, 0.5);
  const text = upper(tag);
  const size = Math.max(22 * unit, Math.min(36 * unit, ((maxW - r * 3.2) / Math.max(8, text.length)) * 1.55));
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 20 * unit, maxWidth: maxW }}>
      <svg width={r * 2 + 30 * unit} height={r * 2 + 4 * unit} style={{ flexShrink: 0, overflow: "visible" }}>
        <g transform={`translate(${r + 2 * unit}, ${r + 2 * unit})`}>
          <Stroke d={`M${-r},0 a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`} t={ring} width={sw} />
          <Stroke d={`M${-r},0 H${r}`} t={sub(t, 0.3, 0.3)} width={sw} />
          {/* Mũi tên hướng nhìn của mặt cắt. */}
          <path d={`M${r + 4 * unit},${-r * 0.2} l${24 * unit},${r * 0.2} l${-24 * unit},${r * 0.2} Z`} fill={accent} opacity={textT} />
          <g opacity={textT} fontFamily={LABEL} textAnchor="middle" dominantBaseline="central" fill={C.ink}>
            <text y={-r * 0.45} fontSize={28 * unit} fontWeight={700}>
              {letter}
            </text>
            <text y={r * 0.47} fontSize={19 * unit} fontWeight={500}>
              {String(sheet).padStart(2, "0")}
            </text>
          </g>
        </g>
      </svg>
      <div style={{ minWidth: 0, opacity: textT, translate: `${(1 - textT) * -16 * unit}px 0` }}>
        <div style={{ fontFamily: MONO, fontSize: 16 * unit, color: accent, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
          {vt("MẶT CẮT {x}-{x}", { x: letter })}
        </div>
        <div
          style={{
            fontFamily: LABEL,
            fontWeight: 600,
            fontSize: size,
            lineHeight: 1.3,
            color: C.ink,
            letterSpacing: "0.04em",
            paddingTop: 4 * unit,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderBottom: `${Math.max(1, 1.6 * unit)}px solid ${C.ink}`,
            paddingBottom: 3 * unit,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

/** Số liệu kiểu đường kích thước: |←—— 120 m ——→| — hai nửa đường chạy từ con số ra hai đầu. */
export const StatDimension: React.FC<{
  box: Box;
  text: string;
  caption: string | null;
  t: number;
  unit: number;
  accent: string;
}> = ({ box, text, caption, t, unit, accent }) => {
  if (t <= 0) return null;
  const numT = sub(t, 0, 0.4);
  const lineT = sub(t, 0.2, 0.6);
  const capT = sub(t, 0.55, 0.45);
  const len = Array.from(text).length;
  const size = Math.min(box.h * 0.62, (box.w * 0.62) / Math.max(2, len * 0.62), 118 * unit);
  const sw = Math.max(1, 2.4 * unit);
  const tick = size * 0.72;
  const half = (dir: 1 | -1) => (
    <div style={{ flex: 1, height: tick, position: "relative" }}>
      {/* vạch gióng ở đầu mút */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [dir === -1 ? "left" : "right"]: 0,
          width: sw,
          backgroundColor: C.ink,
          opacity: sub(t, 0.7, 0.2),
        }}
      />
      <svg
        width="100%"
        height={tick}
        viewBox={`0 0 100 ${tick}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <line
          x1={dir === -1 ? 100 - 100 * lineT : 0}
          x2={dir === -1 ? 100 : 100 * lineT}
          y1={tick / 2}
          y2={tick / 2}
          stroke={accent}
          strokeWidth={sw}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {lineT > 0.95 ? (
        <svg
          width={22 * unit}
          height={18 * unit}
          style={{ position: "absolute", top: tick / 2 - 9 * unit, [dir === -1 ? "left" : "right"]: sw }}
        >
          <path d={dir === -1 ? `M0,${9 * unit} L${22 * unit},${3 * unit} L${22 * unit},${15 * unit} Z` : `M${22 * unit},${9 * unit} L0,${3 * unit} L0,${15 * unit} Z`} fill={accent} />
        </svg>
      ) : null}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 * unit }}>
        {half(-1)}
        <div
          style={{
            fontFamily: LABEL,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.1,
            color: C.ink,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            opacity: numT,
            scale: String(0.85 + 0.15 * numT),
            textShadow: `0 0 ${(18 * unit).toFixed(0)}px rgba(170, 215, 255, 0.35)`,
          }}
        >
          {text}
        </div>
        {half(1)}
      </div>
      {caption ? (
        <div
          style={{
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 21 * unit,
            letterSpacing: "0.1em",
            color: C.soft,
            marginTop: 8 * unit,
            opacity: capT,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {upper(caption)}
        </div>
      ) : null}
    </div>
  );
};

/** Badge: nhãn chi tiết khung đôi ("BƯỚC 2") kèm chú thích bên cạnh. */
export const DetailBadge: React.FC<{
  box: Box;
  text: string;
  caption: string | null;
  t: number;
  unit: number;
  accent: string;
}> = ({ box, text, caption, t, unit, accent }) => {
  const vt = useVt();
  if (t <= 0) return null;
  const inT = sub(t, 0, 0.5);
  const capT = sub(t, 0.4, 0.5);
  const size = Math.min(box.h * 0.42, 54 * unit);
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", alignItems: "center", gap: 24 * unit }}>
      <div
        style={{
          flexShrink: 0,
          border: `${Math.max(1, 3 * unit)}px solid ${C.ink}`,
          outline: `${Math.max(1, 1.2 * unit)}px solid ${C.ink}`,
          outlineOffset: 5 * unit,
          padding: `${8 * unit}px ${22 * unit}px`,
          fontFamily: LABEL,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.3,
          letterSpacing: "0.06em",
          color: accent,
          backgroundColor: C.fill,
          opacity: inT,
          scale: String(0.9 + 0.1 * inT),
          whiteSpace: "nowrap",
        }}
      >
        {upper(text)}
      </div>
      {caption ? (
        <div style={{ minWidth: 0, opacity: capT }}>
          <div style={{ fontFamily: MONO, fontSize: 15 * unit, letterSpacing: "0.12em", color: C.soft }}>{vt("CHI TIẾT")}</div>
          <div style={{ fontFamily: NOTE, fontWeight: 500, fontSize: size * 0.62, lineHeight: 1.35, color: C.ink }}>{caption}</div>
        </div>
      ) : null}
    </div>
  );
};
