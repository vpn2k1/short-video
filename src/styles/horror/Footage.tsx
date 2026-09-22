import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, useLayout } from "../shared";
import { clamp, driftAt, EASE, GRADE, NIGHT, SCENE_IN, SCENE_OUT, scareShake } from "./look";

/** Phóng sẵn để rung tay, rung cú hù không lộ mép khung. */
const OVERSCAN = 1.08;
/** Đẩy máy chậm: phóng thêm chừng này suốt một cảnh. */
const PUSH = 0.1;

/**
 * Cảnh không có ảnh: phòng tối đen, một khung cửa sổ (cảnh chẵn) hoặc cánh cửa hé (cảnh lẻ)
 * hắt ánh trăng lạnh xuống sàn. Vẽ bằng SVG theo đúng kích thước khung nên mọi tỉ lệ đều cân.
 */
const DarkRoom: React.FC<{ index: number }> = ({ index }) => {
  const { width, height } = useLayout();
  const s = Math.min(width, height);
  const cx = width / 2;
  const door = index % 2 === 1;
  const id = `hz-room-${index}`;

  // Cửa sổ vòm: đáy ở ~52% chiều cao, rộng 38% cạnh ngắn.
  const w = s * (door ? 0.3 : 0.38);
  const h = door ? Math.min(height * 0.52, w * 2.4) : w * 1.3;
  const bottom = height * (door ? 0.66 : 0.52);
  const top = bottom - h;
  const left = cx - w / 2;
  const right = cx + w / 2;
  const floor = height * 0.98;

  return (
    <AbsoluteFill style={{ backgroundColor: NIGHT }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`${id}-halo`} cx={cx} cy={top + h * 0.45} r={s * 0.7} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6f8f86" stopOpacity={0.32} />
            <stop offset="45%" stopColor="#23332f" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#000" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${id}-pane`} x1="0" y1={top} x2="0" y2={bottom} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#b9cdc6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#5c7770" stopOpacity={0.38} />
          </linearGradient>
          <linearGradient id={`${id}-beam`} x1="0" y1={bottom} x2="0" y2={floor} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9fb8b0" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#9fb8b0" stopOpacity={0} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-200%" y="-10%" width="500%" height="120%">
            <feGaussianBlur stdDeviation={s * 0.01} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={s * 0.004} />
          </filter>
        </defs>
        <rect width={width} height={height} fill={`url(#${id}-halo)`} />
        {/* Vệt sáng đổ xuống sàn, loe dần. */}
        <polygon
          points={
            door
              ? `${right - w * 0.1},${bottom} ${right},${bottom} ${right + w * 1.4},${floor} ${right - w * 0.2},${floor}`
              : `${left},${bottom} ${right},${bottom} ${right + w * 0.9},${floor} ${left - w * 0.9},${floor}`
          }
          fill={`url(#${id}-beam)`}
        />
        {door ? (
          <g>
            {/* Khung cửa tối gần như chìm vào tường; ánh sáng chỉ lọt qua khe hé bên phải và dưới chân. */}
            <rect x={left} y={top} width={w} height={h} fill="#020303" stroke="#1f2b28" strokeWidth={s * 0.01} />
            <rect
              x={right - w * 0.07}
              y={top + s * 0.006}
              width={w * 0.06}
              height={h - s * 0.012}
              fill={`url(#${id}-pane)`}
              filter={`url(#${id}-glow)`}
            />
            <rect x={left} y={bottom - s * 0.006} width={w} height={s * 0.008} fill="#9fb8b0" opacity={0.35} filter={`url(#${id}-glow)`} />
            <circle cx={left + w * 0.8} cy={top + h * 0.52} r={s * 0.007} fill="#3d4a46" />
          </g>
        ) : (
          <g filter={`url(#${id}-soft)`}>
            <path
              d={`M ${left} ${bottom} L ${left} ${top + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${right} ${top + w / 2} L ${right} ${bottom} Z`}
              fill={`url(#${id}-pane)`}
              stroke="#0e1513"
              strokeWidth={s * 0.014}
            />
            {/* Song cửa hình chữ thập. */}
            <line x1={cx} y1={top} x2={cx} y2={bottom} stroke="#0b100f" strokeWidth={s * 0.012} />
            <line x1={left} y1={top + h * 0.56} x2={right} y2={top + h * 0.56} stroke="#0b100f" strokeWidth={s * 0.012} />
            {/* Cành cây khô in bóng lên kính. */}
            <path
              d={`M ${right + w * 0.1} ${top + h * 0.2} Q ${cx + w * 0.1} ${top + h * 0.3} ${cx - w * 0.2} ${top + h * 0.26} M ${cx + w * 0.12} ${top + h * 0.29} Q ${cx} ${top + h * 0.4} ${cx - w * 0.12} ${top + h * 0.47}`}
              fill="none"
              stroke="#0a0f0e"
              strokeWidth={s * 0.006}
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Hình của cảnh đang chạy: ảnh/video toàn khung, rút màu ám lục lạnh, đẩy máy chậm + rung tay rất
 * nhẹ. Chỉ vẽ cảnh hiện tại — điểm cắt là một nhịp nhúng đen (tối dần cuối cảnh, sáng dần đầu cảnh).
 * Cú hù: rung vài frame + tách màu đỏ/lục-lam bằng filter SVG trên chính khung hình (ảnh hay video
 * đều chỉ giải mã một lần).
 */
export const Footage: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  if (scenes.length === 0) return <DarkRoom index={0} />;

  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  const local = frame - start;

  const push = interpolate(frame, [start, end], [0, PUSH], clamp);
  const drift = driftAt(frame, index, unit);
  const shake = scareShake(scenes, frame, unit);
  const fadeIn = interpolate(local, [0, SCENE_IN], [0, 1], { ...clamp, easing: EASE });
  // Cảnh ngắn: điểm bắt đầu tối dần không được sớm hơn lúc sáng xong.
  const outStart = Math.max(start + SCENE_IN + 1, end - SCENE_OUT);
  const fadeOut = interpolate(frame, [outStart, outStart + SCENE_OUT], [1, 0], clamp);
  const lit = fadeIn * fadeOut;

  const filterId = `hz-rgb-${index}`;
  const dx = Math.round(shake.split * 2) / 2;
  const media = scene.image ? (
    <SceneMedia scene={scene} from={start} />
  ) : (
    <DarkRoom index={index} />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {dx > 0 ? (
        <svg width="0" height="0" style={{ position: "absolute" }} xmlns="http://www.w3.org/2000/svg">
          <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={-dx} dy="0" result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feOffset in="gb" dx={dx} dy="0" result="gbo" />
            <feBlend in="ro" in2="gbo" mode="screen" />
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill
        style={{
          opacity: lit,
          scale: `${OVERSCAN + push}`,
          translate: `${drift.x + shake.x}px ${drift.y + shake.y}px`,
          rotate: `${drift.rot}deg`,
          filter: dx > 0 ? `url(#${filterId}) ${GRADE}` : GRADE,
        }}
      >
        {media}
      </AbsoluteFill>
      {/* Ám lục lạnh: nhân màu xám lục rồi nâng vùng đen lên lục thẫm, không có đen tuyền ấm. */}
      <AbsoluteFill style={{ backgroundColor: "#8fb0a4", mixBlendMode: "multiply", opacity: 0.85 * lit }} />
      <AbsoluteFill style={{ backgroundColor: "#0c1a16", mixBlendMode: "screen", opacity: 0.7 * lit }} />
    </AbsoluteFill>
  );
};
