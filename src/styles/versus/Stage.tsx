/**
 * Sân đấu: hai phe cắt theo đường nối răng cưa, đường nối phát sáng hai màu và huy hiệu VS ở giữa.
 */
import { AbsoluteFill } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { BODY, DISPLAY, inkOn, NIGHT, seamPoints, upper, withAlpha, type Geo, type Rect } from "./theme";

/** Nền phe khi cảnh không có ảnh: màu phe đậm dần, sọc chéo, tên phe cỡ lớn. */
export const SolidSide: React.FC<{ color: string; label: string | null; u: number; w: number; h: number; side: 0 | 1 }> = ({
  color,
  label,
  u,
  w,
  h,
  side,
}) => {
  // null → chữ cái phe; "" → không vẽ chữ (dùng cho title card khi chưa có tên phe).
  const text = label === null ? (side === 0 ? "A" : "B") : upper(label);
  // Chữ nền to nhất có thể mà vẫn nằm gọn trong phe (Anton ~0.47em mỗi ký tự).
  const size = Math.min(h * 0.42, (w * 0.8) / Math.max(1, [...text].length * 0.47), 300 * u);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        backgroundImage: [
          `repeating-linear-gradient(${side === 0 ? 135 : 45}deg, rgba(0,0,0,0.10) 0 ${22 * u}px, transparent ${22 * u}px ${44 * u}px)`,
          `radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(0,0,0,0.55) 100%)`,
        ].join(", "),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: size,
          lineHeight: 1.15,
          paddingTop: size * 0.06,
          // Chữ nền mờ như hình in chìm — phụ đề và con dấu đè lên vẫn đọc rõ.
          color: inkOn(color) === "#ffffff" ? "rgba(255,255,255,0.4)" : withAlpha(NIGHT, 0.35),
          textShadow: `${10 * u}px ${10 * u}px 0 rgba(0,0,0,0.25)`,
          transform: "skewX(-8deg)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Ảnh / clip / nền màu của một cảnh trong khung bao `rect` của phe. */
export const SideMedia: React.FC<{
  scene: Scene;
  from: number;
  rect: Rect;
  color: string;
  side: 0 | 1;
  u: number;
  zoom: number;
  shiftX: number;
}> = ({ scene, from, rect, color, side, u, zoom, shiftX }) => (
  <div
    style={{
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      overflow: "hidden",
      transform: `translateX(${shiftX}px)`,
      backgroundColor: NIGHT,
    }}
  >
    {scene.image ? (
      <SceneMedia scene={scene} from={from} zoom={zoom} />
    ) : (
      <SolidSide color={color} label={scene.tag} u={u} w={rect.w} h={rect.h} side={side} />
    )}
  </div>
);

/** Đường nối răng cưa: quầng sáng trắng, viền màu hai phe, lõi trắng. */
export const Seam: React.FC<{ g: Geo; offset: number; colorA: string; colorB: string; glow: number; opacity: number }> = ({
  g,
  offset,
  colorA,
  colorB,
  glow,
  opacity,
}) => {
  const line = (d: number) =>
    seamPoints(g, offset + d)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  const side = 7 * g.u;
  return (
    <svg width={g.W} height={g.H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity }}>
      <defs>
        <filter id="versus-seam-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={10 * g.u} />
        </filter>
      </defs>
      <polyline points={line(0)} fill="none" stroke="#ffffff" strokeOpacity={0.55 * glow} strokeWidth={30 * g.u} strokeLinejoin="miter" filter="url(#versus-seam-glow)" />
      <polyline points={line(-side)} fill="none" stroke={colorA} strokeWidth={9 * g.u} strokeLinejoin="miter" />
      <polyline points={line(side)} fill="none" stroke={colorB} strokeWidth={9 * g.u} strokeLinejoin="miter" />
      <polyline points={line(0)} fill="none" stroke="#ffffff" strokeWidth={6 * g.u} strokeLinejoin="miter" />
    </svg>
  );
};

/** Huy hiệu VS tròn ở tâm đường nối, kèm chip "VÒNG n/m" bên dưới. */
export const Emblem: React.FC<{
  cx: number;
  cy: number;
  r: number;
  u: number;
  colorA: string;
  colorB: string;
  scale: number;
  pulse: number;
  opacity: number;
  round: string | null;
}> = ({ cx, cy, r, u, colorA, colorB, scale, pulse, opacity, round }) => {
  if (opacity <= 0.001 || scale <= 0.001) return null;
  const vs = r * 1.02;
  return (
    <div style={{ position: "absolute", left: cx - r, top: cy - r, width: r * 2, height: r * 2, opacity, transform: `scale(${scale})` }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          backgroundImage: `linear-gradient(135deg, ${colorA} 0%, ${colorA} 48%, ${colorB} 52%, ${colorB} 100%)`,
          boxShadow: `0 0 ${(26 + 22 * pulse) * u}px rgba(255,255,255,${0.35 + 0.35 * pulse}), 0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.6)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 9 * u,
          borderRadius: "50%",
          backgroundColor: NIGHT,
          border: `${4 * u}px solid #ffffff`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: vs,
            lineHeight: 1,
            paddingTop: vs * 0.04,
            color: "#ffffff",
            transform: "skewX(-10deg)",
            textShadow: `${-4 * u}px 0 0 ${colorA}, ${4 * u}px 0 0 ${colorB}, 0 0 ${18 * u}px rgba(255,255,255,0.6)`,
          }}
        >
          VS
        </div>
      </div>
      {round ? (
        <div
          style={{
            position: "absolute",
            // Chip vắt qua mép dưới huy hiệu như dải ruy băng — không lấn thêm chỗ của phe B.
            top: r * 2 - 18 * u,
            left: r - 150 * u,
            width: 300 * u,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 800,
              fontSize: 22 * u,
              lineHeight: 1,
              padding: `${9 * u}px ${16 * u}px`,
              borderRadius: 999,
              color: "#ffffff",
              backgroundColor: withAlpha(NIGHT, 0.85),
              border: `${2 * u}px solid rgba(255,255,255,0.7)`,
              whiteSpace: "nowrap",
            }}
          >
            {round}
          </div>
        </div>
      ) : null}
    </div>
  );
};
