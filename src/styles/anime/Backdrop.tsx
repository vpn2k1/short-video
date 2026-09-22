import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, seeded, useLayout } from "../shared";
import { clamp, OUT, SLASH_FRAMES, type Palette } from "./anime";
import { LightLeak, SkyBackdrop } from "./Sky";

/**
 * Một cảnh: ảnh/video toàn khung, màu tươi kiểu key visual (bão hoà + tương phản nhẹ), đẩy máy chậm
 * 1.06 → 1.16 suốt cảnh; không ảnh thì bầu trời vẽ tay.
 */
const SceneLayer: React.FC<{ scene: Scene; index: number; palette: Palette }> = ({ scene, index, palette }) => {
  const frame = useCurrentFrame();
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  if (!scene.image) return <SkyBackdrop palette={palette} id={`s${index}`} seed={index} />;
  const zoom = interpolate(frame, [start, end + 20], [1.06, 1.16], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1330", overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "saturate(1.22) contrast(1.06) brightness(1.03)" }}>
        <SceneMedia scene={scene} from={start} zoom={zoom} />
      </AbsoluteFill>
      {/* Lớp "cel": đẩy vùng tối về xanh tím, vùng sáng ửng ấm — tông phim hoạt hình. */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(40,70,190,0.22) 0%, rgba(255,170,140,0.12) 100%)",
          mixBlendMode: "soft-light",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Nhát chém đổi cảnh: cảnh mới lộ ra sau một đường chéo quét trái → phải trong SLASH_FRAMES frame.
 * Mép chém là lưỡi sáng trắng + viền màu nhấn, quanh nó là tia tốc độ bay ngang, giữa nhát có một chớp trắng.
 * Tất cả suy từ `p` (0..1) — xác định.
 */
const SlashEdge: React.FC<{ p: number; seed: number; palette: Palette }> = ({ p, seed, palette }) => {
  const { width: W, height: H, unit } = useLayout();
  const T = H * 0.32;
  const e = -T + p * (W + 2 * T);
  const env = Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
  // Tia tốc độ: vạch ngang mảnh, mỗi vạch một hàng y, độ dài và pha riêng; chạy nhanh hơn mép chém.
  const streaks = Array.from({ length: 26 }, (_, i) => {
    const y = seeded(`anime-slash-y-${seed}-${i}`) * H;
    const len = seeded(`anime-slash-l-${seed}-${i}`, 0.25, 0.7) * W;
    const edgeX = e + T - (2 * T * y) / H;
    const lead = seeded(`anime-slash-o-${seed}-${i}`, -0.35, 0.15) * W;
    const thick = seeded(`anime-slash-t-${seed}-${i}`, 2, 7) * unit;
    return { y, x2: edgeX + lead, x1: edgeX + lead - len, thick, white: i % 3 !== 0 };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`anime-streak-${seed}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`anime-streak-c-${seed}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={palette.light} stopOpacity="0" />
            <stop offset="1" stopColor={palette.light} stopOpacity="1" />
          </linearGradient>
        </defs>
        <g opacity={env}>
          {streaks.map((s, i) => (
            <rect
              key={i}
              x={s.x1}
              y={s.y - s.thick / 2}
              width={Math.max(1, s.x2 - s.x1)}
              height={s.thick}
              rx={s.thick / 2}
              fill={`url(#${s.white ? `anime-streak-${seed}` : `anime-streak-c-${seed}`})`}
            />
          ))}
          {/* Viền màu nhấn đi trước, lưỡi trắng ngay mép. */}
          <line x1={e + T + 26 * unit} y1={0} x2={e - T + 26 * unit} y2={H} stroke={palette.main} strokeWidth={22 * unit} />
          <line x1={e + T} y1={0} x2={e - T} y2={H} stroke="#fff" strokeWidth={16 * unit} />
          <line x1={e + T} y1={0} x2={e - T} y2={H} stroke="#fff" strokeWidth={60 * unit} strokeOpacity={0.25} />
        </g>
      </svg>
      {/* Chớp trắng giữa nhát chém. */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(p, [0.25, 0.5, 0.95], [0, 0.55, 0], clamp) }} />
    </AbsoluteFill>
  );
};

/** Đa giác phần cảnh mới đã lộ (bên trái mép chém). */
const revealClip = (p: number, W: number, H: number) => {
  const T = H * 0.32;
  const e = -T + p * (W + 2 * T);
  return `polygon(0px 0px, ${(e + T).toFixed(1)}px 0px, ${(e - T).toFixed(1)}px ${H}px, 0px ${H}px)`;
};

/**
 * Nền của cả video: cảnh hiện tại (cảnh trước vẫn vẽ bên dưới trong lúc chém), loé sáng mềm, viền tối nhẹ.
 * Chữ vẽ đè lên sau.
 */
export const Backdrop: React.FC<{ scenes: Scene[]; palette: Palette }> = ({ scenes, palette }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useLayout();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const start = scene ? msToFrames(scene.startMs) : 0;
  const p = index > 0 ? interpolate(frame, [start, start + SLASH_FRAMES], [0, 1], { ...clamp, easing: OUT }) : 1;
  const prev = index > 0 && p < 1 ? scenes[index - 1] : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1330" }}>
      {scene ? (
        <>
          {prev ? <SceneLayer scene={prev} index={index - 1} palette={palette} /> : null}
          <AbsoluteFill style={{ clipPath: p < 1 ? revealClip(p, W, H) : undefined }}>
            <SceneLayer scene={scene} index={index} palette={palette} />
          </AbsoluteFill>
        </>
      ) : (
        <SkyBackdrop palette={palette} id="empty" />
      )}
      <LightLeak palette={palette} strength={scene?.image ? 1 : 0.6} />
      {/* Viền tối rất nhẹ + đáy tối dần để phụ đề trắng luôn đọc được. */}
      <AbsoluteFill
        style={{
          background: [
            "linear-gradient(180deg, transparent 55%, rgba(12,10,40,0.35) 80%, rgba(12,10,40,0.55) 100%)",
            "radial-gradient(ellipse 95% 85% at 50% 45%, transparent 60%, rgba(10,8,35,0.35) 100%)",
          ].join(", "),
        }}
      />
      {prev ? <SlashEdge p={p} seed={index} palette={palette} /> : null}
    </AbsoluteFill>
  );
};
