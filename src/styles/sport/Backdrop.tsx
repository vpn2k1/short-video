/**
 * Nền của phong cách "Thể thao": ảnh/clip toàn khung tăng tương phản + đẩy máy nhanh đầu cảnh; không ảnh thì
 * sân vận động ban đêm vẽ bằng SVG (đèn pha, khán đài, sân cỏ kẻ vạch). Kèm vệt sọc chéo quét qua khi đổi cảnh.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, seeded, useLayout } from "../shared";
import { EASE_OUT, INK, ramp, WIPE_FRAMES, withAlpha } from "./theme";

/**
 * Sân vận động ban đêm: khán đài lấm tấm đèn flash, hai cột đèn pha rọi chùm sáng xuống sân, sân cỏ cắt sọc
 * theo phối cảnh với vạch giữa sân + vòng tròn trung tâm. `push` 0→1 phóng rất chậm cho nền không chết.
 */
export const Stadium: React.FC<{ accent: string; id: string; push?: number }> = ({ accent, id, push = 0 }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, unit: u, portrait } = useLayout();
  const horizon = H * (portrait ? 0.5 : 0.52);
  const standTop = H * (portrait ? 0.26 : 0.18);
  const stripes = 12;
  const yAt = (t: number) => horizon + (H - horizon) * Math.pow(t, 1.7);
  // Bề rộng sân ở đường chân trời và ở đáy khung (phối cảnh: xa hẹp, gần rộng).
  const farHalf = W * (portrait ? 0.62 : 0.46);
  const nearHalf = W * (portrait ? 1.7 : 1.1);
  const halfAt = (y: number) => farHalf + ((y - horizon) / (H - horizon)) * (nearHalf - farHalf);
  const cx = W / 2;
  const lineW = 4 * u;
  const lineColor = "rgba(235,255,240,0.55)";
  // Vòng tròn giữa sân: elip dẹt theo phối cảnh.
  const circleY = yAt(0.42);
  const circleRx = halfAt(circleY) * 0.3;
  const circleRy = (yAt(0.62) - yAt(0.24)) / 2;
  // Chùm đèn pha lắc nhẹ, thở theo sin.
  const sway = Math.sin(frame / 40) * 0.04;
  const glow = 0.75 + 0.25 * Math.sin(frame / 23);
  const towers = [
    { x: W * 0.1, y: standTop - 70 * u, dir: 1 },
    { x: W * 0.9, y: standTop - 70 * u, dir: -1 },
  ];
  // Đèn flash lấm tấm trên khán đài — vị trí cố định theo seed, nháy theo frame.
  const flashes = Array.from({ length: 46 }, (_, i) => {
    const x = seeded(`sf-x-${i}`) * W;
    const y = standTop + 20 * u + seeded(`sf-y-${i}`) * (horizon - standTop - 50 * u);
    const phase = Math.floor(seeded(`sf-p-${i}`) * 40);
    const on = (frame + phase) % 40 < 2;
    return { x, y, on, r: (1.5 + seeded(`sf-r-${i}`) * 2.5) * u };
  });
  const gid = `sport-std-${id}`;

  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(1 + 0.06 * push) }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#04060b" />
              <stop offset="0.6" stopColor="#0b1422" />
              <stop offset="1" stopColor="#13243a" />
            </linearGradient>
            <linearGradient id={`${gid}-stand`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d1320" />
              <stop offset="1" stopColor="#1b2536" />
            </linearGradient>
            <pattern id={`${gid}-crowd`} width={18 * u} height={14 * u} patternUnits="userSpaceOnUse">
              <circle cx={4 * u} cy={5 * u} r={3 * u} fill="rgba(255,255,255,0.07)" />
              <circle cx={13 * u} cy={10 * u} r={3 * u} fill="rgba(255,255,255,0.05)" />
              <circle cx={10 * u} cy={3 * u} r={2 * u} fill={withAlpha(accent, 0.12)} />
            </pattern>
            <linearGradient id={`${gid}-beam`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,245,0.34)" />
              <stop offset="1" stopColor="rgba(255,255,245,0)" />
            </linearGradient>
            <radialGradient id={`${gid}-lamp`}>
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.35" stopColor="#fffbe8" stopOpacity="0.7" />
              <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${gid}-grass`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0f3a22" />
              <stop offset="1" stopColor="#1c6b3a" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${gid}-sky)`} />
          {/* Khán đài: khối dốc + hạt người + mép mái. */}
          <rect x={0} y={standTop} width={W} height={horizon - standTop} fill={`url(#${gid}-stand)`} />
          <rect x={0} y={standTop} width={W} height={horizon - standTop} fill={`url(#${gid}-crowd)`} />
          {[0.33, 0.66].map((t) => (
            <rect key={t} x={0} y={standTop + (horizon - standTop) * t} width={W} height={3 * u} fill="rgba(0,0,0,0.35)" />
          ))}
          <rect x={0} y={standTop - 10 * u} width={W} height={10 * u} fill="#05080f" />
          {flashes.map((f, i) => (f.on ? <circle key={i} cx={f.x} cy={f.y} r={f.r * 2.4} fill={`url(#${gid}-lamp)`} /> : null))}
          {/* Biển quảng cáo chạy quanh sân: dải accent mảnh ở chân khán đài. */}
          <rect x={0} y={horizon - 22 * u} width={W} height={22 * u} fill={withAlpha(accent, 0.55)} />
          <rect x={0} y={horizon - 22 * u} width={W} height={3 * u} fill="rgba(255,255,255,0.35)" />
          {/* Sân cỏ cắt sọc theo phối cảnh. */}
          <polygon
            points={`${cx - farHalf},${horizon} ${cx + farHalf},${horizon} ${cx + nearHalf},${H} ${cx - nearHalf},${H}`}
            fill={`url(#${gid}-grass)`}
          />
          {Array.from({ length: stripes }, (_, i) => {
            if (i % 2 === 1) return null;
            const y0 = yAt(i / stripes);
            const y1 = yAt((i + 1) / stripes);
            return (
              <polygon
                key={i}
                points={`${cx - halfAt(y0)},${y0} ${cx + halfAt(y0)},${y0} ${cx + halfAt(y1)},${y1} ${cx - halfAt(y1)},${y1}`}
                fill="rgba(255,255,255,0.045)"
              />
            );
          })}
          {/* Vạch biên xa, vạch giữa sân, vòng tròn trung tâm, chấm giữa sân. */}
          <line x1={cx - farHalf} y1={horizon + 2 * u} x2={cx + farHalf} y2={horizon + 2 * u} stroke={lineColor} strokeWidth={lineW * 0.7} />
          <line x1={cx} y1={horizon} x2={cx} y2={H} stroke={lineColor} strokeWidth={lineW} />
          <ellipse cx={cx} cy={circleY} rx={circleRx} ry={circleRy} fill="none" stroke={lineColor} strokeWidth={lineW} />
          <ellipse cx={cx} cy={circleY} rx={7 * u} ry={4 * u} fill={lineColor} />
          {/* Cột đèn pha + chùm sáng. */}
          {towers.map((t, i) => {
            const spread = W * (portrait ? 0.55 : 0.4);
            const aim = t.x + t.dir * W * (0.38 + sway * t.dir);
            return (
              <g key={i}>
                <polygon
                  points={`${t.x - 30 * u},${t.y} ${t.x + 30 * u},${t.y} ${aim + spread / 2},${H} ${aim - spread / 2},${H}`}
                  fill={`url(#${gid}-beam)`}
                  opacity={0.55 * glow}
                  style={{ mixBlendMode: "screen" }}
                />
                <rect x={t.x - 3 * u} y={t.y} width={6 * u} height={standTop - t.y} fill="#070a12" />
                <rect x={t.x - 46 * u} y={t.y - 34 * u} width={92 * u} height={38 * u} rx={4 * u} fill="#0a0e17" />
                {Array.from({ length: 8 }, (_, k) => (
                  <circle key={k} cx={t.x - 36 * u + (k % 4) * 24 * u} cy={t.y - 24 * u + Math.floor(k / 4) * 18 * u} r={7 * u} fill="#fffdf2" />
                ))}
                <circle cx={t.x} cy={t.y - 15 * u} r={150 * u} fill={`url(#${gid}-lamp)`} opacity={0.55 * glow} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
      {/* Sương đèn ở chân khán đài ngả màu accent + vignette. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 22% at 50% ${(horizon / H) * 100}%, ${withAlpha(accent, 0.2)} 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />
      <Grain opacity={0.08} baseFrequency={0.85} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 95% 85% at 50% 45%, transparent 45%, rgba(2,4,9,0.72) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Một cảnh: ảnh/clip toàn khung, tăng tương phản; đầu cảnh đẩy máy nhanh rồi trườn chậm. */
const SceneLayer: React.FC<{ scene: Scene; index: number; accent: string; enter: number }> = ({ scene, index, accent, enter }) => {
  const frame = useCurrentFrame();
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  const creep = interpolate(frame, [start, end + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kick = ramp(frame, enter, 14, EASE_OUT);
  if (!scene.image) return <Stadium accent={accent} id={`s${index}`} push={creep} />;
  // Đẩy nhanh 1.00 → 1.08 trong 14 frame đầu (cú zoom của máy quay thể thao), rồi trườn tới 1.13.
  const zoom = 1 + 0.08 * kick + 0.05 * creep;
  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(zoom), filter: "contrast(1.16) saturate(1.2) brightness(0.96)" }}>
        <SceneMedia scene={scene} from={start} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Ảnh cảnh đang chạy + lớp tối trên/dưới cho đồ hoạ dễ đọc. */
export const Backdrop: React.FC<{ scenes: Scene[]; accent: string; firstEnter: number }> = ({ scenes, accent, firstEnter }) => {
  const frame = useCurrentFrame();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const enter = index === 0 ? firstEnter : scene ? msToFrames(scene.startMs) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {scene ? <SceneLayer key={index} scene={scene} index={index} accent={accent} enter={enter} /> : <Stadium accent={accent} id="empty" />}
      {/* Tối nhẹ phía trên (bảng tỉ số) và đậm hơn phía dưới (dải phụ đề). */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(4,6,12,0.55) 0%, rgba(4,6,12,0) 20%, rgba(4,6,12,0) 50%, rgba(4,6,12,0.55) 78%, rgba(4,6,12,0.82) 100%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 100% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)" }} />
    </AbsoluteFill>
  );
};

/**
 * Vệt sọc chéo quét ngang khung ở mỗi mốc cắt (`cuts`, frame tuyệt đối). Tâm vệt đi qua giữa khung đúng frame cắt,
 * lõi tối đủ rộng che kín cả khung ngay khoảnh khắc đó nên đường cắt không lộ. Viền trước: vạch trắng + khối accent;
 * phía sau: ba vệt accent mờ dần tạo cảm giác nhoè chuyển động.
 */
export const StripeWipes: React.FC<{ cuts: number[]; accent: string }> = ({ cuts, accent }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, unit: u } = useLayout();
  const half = WIPE_FRAMES / 2;
  const cut = cuts.find((c) => frame >= c - half && frame < c + half);
  if (cut === undefined) return null;
  const s = H * Math.tan((18 * Math.PI) / 180); // độ xiên ngang của vệt trên cả chiều cao
  // Các sọc tính theo toạ độ giữa chiều cao, từ mép trước (phải) ra sau (trái), [độ lệch so với mép trước, bề rộng].
  const core = W + s + 60 * u;
  const bands: { off: number; w: number; fill: string; opacity?: number }[] = [
    { off: 0, w: 16 * u, fill: "#ffffff" },
    { off: 16 * u, w: 110 * u, fill: accent },
    { off: 126 * u, w: 10 * u, fill: INK },
    { off: 136 * u, w: 18 * u, fill: "#ffffff" },
    { off: 154 * u, w: core, fill: INK },
    { off: 154 * u + core, w: 70 * u, fill: accent },
    { off: 224 * u + core + 30 * u, w: 46 * u, fill: accent, opacity: 0.55 },
    { off: 300 * u + core + 50 * u, w: 30 * u, fill: accent, opacity: 0.3 },
    { off: 380 * u + core + 70 * u, w: 18 * u, fill: accent, opacity: 0.14 },
  ];
  const total = 400 * u + core + 70 * u;
  // Tâm lõi đi qua W/2 đúng frame cắt; chạy tuyến tính (nhanh đều) cho cảm giác cú quét mạnh.
  const coreCenterOff = 154 * u + core / 2;
  const lead = interpolate(frame, [cut - half, cut + half], [-s / 2 - 10 * u, W + total + s / 2 + 10 * u], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leadAtCut = W / 2 + coreCenterOff;
  // Căn để đúng frame cắt tâm lõi nằm giữa khung: dời cả đường đi một khoảng cố định.
  const mid = (-s / 2 - 10 * u + W + total + s / 2 + 10 * u) / 2;
  const x0 = lead + (leadAtCut - mid);
  const par = (xRight: number, w: number) => {
    const xl = xRight - w;
    return `${xl + s / 2},0 ${xRight + s / 2},0 ${xRight - s / 2},${H} ${xl - s / 2},${H}`;
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="sport-wipe-hatch" width={24 * u} height={24 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <rect width={24 * u} height={24 * u} fill="transparent" />
            <rect width={8 * u} height={24 * u} fill="rgba(255,255,255,0.035)" />
          </pattern>
        </defs>
        {bands.map((b, i) => (
          <polygon key={i} points={par(x0 - b.off, b.w)} fill={b.fill} opacity={b.opacity ?? 1} />
        ))}
        <polygon points={par(x0 - 154 * u, core)} fill="url(#sport-wipe-hatch)" />
        <polygon points={par(x0 - 154 * u, core)} fill={withAlpha(accent, 0.08)} />
      </svg>
    </AbsoluteFill>
  );
};
