import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, useLayout } from "../shared";
import { clamp, neon, NIGHT, type Palette } from "./neon";

/** Số frame hoà cảnh cũ sang cảnh mới. */
const FADE_FRAMES = 10;

/**
 * Tường gạch ban đêm vẽ bằng SVG pattern — nền khi cảnh không có ảnh và nền màn hình tiêu đề.
 * Hai hàng gạch so le, mạch vữa tối; ánh neon hắt lên tường là một quầng màu ống chính phía trên.
 */
export const BrickWall: React.FC<{ palette: Palette; id: string; spill?: number }> = ({ palette, id, spill = 1 }) => {
  const { unit } = useLayout();
  const bw = 150 * unit;
  const bh = 56 * unit;
  const gap = 5 * unit;
  const pid = `neon-brick-${id}`;
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id={pid} width={bw} height={bh * 2} patternUnits="userSpaceOnUse">
            <rect width={bw} height={bh * 2} fill="#0a0810" />
            <rect x={gap / 2} y={gap / 2} width={bw - gap} height={bh - gap} rx={3 * unit} fill="#2a1a24" />
            <rect x={-bw / 2 + gap / 2} y={bh + gap / 2} width={bw - gap} height={bh - gap} rx={3 * unit} fill="#24161f" />
            <rect x={bw / 2 + gap / 2} y={bh + gap / 2} width={bw - gap} height={bh - gap} rx={3 * unit} fill="#2d1c26" />
            {/* Mép trên gạch bắt sáng một chút cho có khối. */}
            <rect x={gap / 2} y={gap / 2} width={bw - gap} height={2 * unit} fill="rgba(255,255,255,0.05)" />
            <rect x={bw / 2 + gap / 2} y={bh + gap / 2} width={bw - gap} height={2 * unit} fill="rgba(255,255,255,0.04)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
      </svg>
      <Grain opacity={0.18} animated={false} baseFrequency={0.7} />
      {/* Ánh neon hắt lên tường: ống chính trên, ống phụ loang dưới. */}
      <AbsoluteFill
        style={{
          opacity: spill,
          background: [
            `radial-gradient(ellipse 80% 45% at 50% 30%, ${neon(palette.primary, 50, 0.45)} 0%, transparent 70%)`,
            `radial-gradient(ellipse 70% 40% at 50% 95%, ${neon(palette.secondary, 45, 0.28)} 0%, transparent 70%)`,
          ].join(", "),
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 35%, rgba(0,0,0,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Một cảnh: ảnh/video tối đi, ngả xanh đêm – tím hồng; không ảnh thì tường gạch. */
const SceneLayer: React.FC<{ scene: Scene; index: number; palette: Palette }> = ({ scene, index, palette }) => {
  const frame = useCurrentFrame();
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  if (!scene.image) return <BrickWall palette={palette} id={`s${index}`} />;
  // Đẩy máy rất chậm: ảnh tĩnh phóng 1.04 → 1.12 suốt cảnh.
  const zoom = interpolate(frame, [start, end + 30], [1.04, 1.12], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "brightness(0.62) contrast(1.15) saturate(1.25)" }}>
        <SceneMedia scene={scene} from={start} zoom={zoom} />
      </AbsoluteFill>
      {/* Chỉnh màu đêm: nhân xanh đậm để đẩy vùng sáng về lam, rồi phủ tím hồng lên vùng sáng. */}
      <AbsoluteFill style={{ backgroundColor: "#3a3fb8", mixBlendMode: "multiply", opacity: 0.75 }} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${neon(palette.primary, 45, 0.35)} 0%, transparent 45%, ${neon(palette.secondary, 40, 0.25)} 100%)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Nền của cả video: cảnh hiện tại (và cảnh trước trong FADE_FRAMES đầu để hoà), sương mù màu,
 * vệt phản chiếu quét chéo, hạt, vignette. Chữ vẽ đè lên sau.
 */
export const Backdrop: React.FC<{ scenes: Scene[]; palette: Palette }> = ({ scenes, palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useLayout();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const start = scene ? msToFrames(scene.startMs) : 0;
  const fadeIn = index > 0 ? interpolate(frame, [start, start + FADE_FRAMES], [0, 1], clamp) : 1;
  const prev = index > 0 && fadeIn < 1 ? scenes[index - 1] : null;

  // Vệt phản chiếu: dải sáng chéo trôi qua khung mỗi 150 frame, như đèn xe lướt trên kính.
  const cycle = 150;
  const sweep = (frame % cycle) / cycle;
  const diag = Math.hypot(width, height);
  const sweepX = interpolate(sweep, [0, 1], [-0.6 * diag, 1.1 * diag]);
  // Sương mù trôi chậm.
  const drift = Math.sin(frame / 90) * 6;

  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      {scene ? (
        <>
          {prev ? <SceneLayer scene={prev} index={index - 1} palette={palette} /> : null}
          <AbsoluteFill style={{ opacity: fadeIn }}>
            <SceneLayer scene={scene} index={index} palette={palette} />
          </AbsoluteFill>
        </>
      ) : (
        <BrickWall palette={palette} id="empty" />
      )}
      {/* Sương mù neon */}
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(ellipse 60% 35% at ${20 + drift}% 12%, ${neon(palette.primary, 55, 0.22)} 0%, transparent 70%)`,
            `radial-gradient(ellipse 55% 30% at ${82 - drift}% 88%, ${neon(palette.secondary, 55, 0.2)} 0%, transparent 70%)`,
          ].join(", "),
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill style={{ overflow: "hidden", mixBlendMode: "screen", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: sweepX,
            top: -diag * 0.25,
            width: diag * 0.12,
            height: diag * 1.5,
            rotate: "25deg",
            background: "linear-gradient(90deg, transparent, rgba(190,210,255,0.07) 40%, rgba(255,255,255,0.11) 50%, rgba(190,210,255,0.07) 60%, transparent)",
          }}
        />
      </AbsoluteFill>
      <Grain opacity={0.1} baseFrequency={0.85} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 45%, rgba(3,2,10,0.7) 100%)" }} />
    </AbsoluteFill>
  );
};
