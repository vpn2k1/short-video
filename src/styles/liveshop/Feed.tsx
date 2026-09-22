import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, seeded, useLayout } from "../shared";
import { ProductSilhouette } from "./Icons";
import { alpha, clamp, shade } from "./live";

/** Số frame hoà cảnh cũ sang cảnh mới — livestream là một máy quay liền, nên chỉ hoà rất nhanh. */
const FADE_FRAMES = 6;

/**
 * Phông chụp sản phẩm khi cảnh không có ảnh: tường sáng ngả màu accent, quầng đèn tròn phía sau,
 * vài đốm bokeh, bục tròn với bóng sản phẩm chờ ảnh ở giữa.
 */
export const Studio: React.FC<{ accent: string; id: string; product?: boolean }> = ({ accent, id, product = true }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const wall = shade(accent, 0.86);
  const deep = shade(accent, 0.55);
  const size = Math.min(width, height) * 0.62;
  return (
    <AbsoluteFill style={{ backgroundColor: wall, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at 50% 42%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.55) 18%, transparent 42%)`,
            `radial-gradient(ellipse 120% 60% at 50% 110%, ${alpha(deep, 0.75)} 0%, transparent 70%)`,
            `linear-gradient(180deg, ${shade(accent, 0.92)} 0%, ${wall} 55%, ${shade(accent, 0.7)} 100%)`,
          ].join(", "),
        }}
      />
      {/* Vòng đèn tròn phía sau, hơi thở rất chậm. */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - size * 0.62,
          top: height * 0.42 - size * 0.62,
          width: size * 1.24,
          height: size * 1.24,
          borderRadius: "50%",
          border: `${18 * unit}px solid rgba(255,255,255,${0.55 + 0.08 * Math.sin(frame / 25)})`,
          boxShadow: `0 0 ${80 * unit}px rgba(255,255,255,0.7), inset 0 0 ${60 * unit}px rgba(255,255,255,0.5)`,
        }}
      />
      {Array.from({ length: 9 }, (_, i) => {
        const r = seeded(`${id}-bk-r-${i}`, 30, 90) * unit;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: seeded(`${id}-bk-x-${i}`, 0, width) - r,
              top: seeded(`${id}-bk-y-${i}`, 0, height * 0.7) - r + Math.sin(frame / 40 + i) * 8 * unit,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              backgroundColor: i % 3 === 0 ? alpha(accent, 0.18) : "rgba(255,255,255,0.35)",
              filter: `blur(${6 * unit}px)`,
            }}
          />
        );
      })}
      {product ? (
        <div style={{ position: "absolute", left: width / 2 - size / 2, top: height * 0.42 - size * 0.42 }}>
          <ProductSilhouette size={size} tone={shade(accent, 0.62)} rim="#ffffff" />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Một cảnh: ảnh/video toàn khung như máy quay live — hơi rung tay, sáng và tươi hơn một chút. */
const CameraLayer: React.FC<{ scene: Scene; index: number; accent: string }> = ({ scene, index, accent }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  if (!scene.image) return <Studio accent={accent} id={`s${index}`} />;
  const zoom = interpolate(frame, [start, end + 30], [1.06, 1.12], clamp);
  // Rung tay: hai sóng sin lệch pha, biên độ nhỏ — đủ "sống" mà không chóng mặt.
  const dx = (Math.sin(frame / 31 + index) * 7 + Math.sin(frame / 11) * 2) * unit;
  const dy = (Math.cos(frame / 37 + index * 2) * 6 + Math.cos(frame / 13) * 1.5) * unit;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{
          translate: `${dx}px ${dy}px`,
          rotate: `${Math.sin(frame / 53) * 0.25}deg`,
          filter: "saturate(1.12) contrast(1.04) brightness(1.03)",
        }}
      >
        <SceneMedia scene={scene} from={start} zoom={zoom} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Nền cả video: cảnh hiện tại (hoà nhanh từ cảnh trước), rồi hai dải tối trên/dưới để chữ giao diện đọc được
 * trên mọi ảnh.
 */
export const Feed: React.FC<{ scenes: Scene[]; accent: string }> = ({ scenes, accent }) => {
  const frame = useCurrentFrame();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const start = scene ? msToFrames(scene.startMs) : 0;
  const fadeIn = index > 0 ? interpolate(frame, [start, start + FADE_FRAMES], [0, 1], clamp) : 1;
  const prev = index > 0 && fadeIn < 1 ? scenes[index - 1] : null;
  return (
    <AbsoluteFill>
      {!scene ? <Studio accent={accent} id="empty" product={false} /> : null}
      {prev ? <CameraLayer scene={prev} index={index - 1} accent={accent} /> : null}
      {scene ? (
        <AbsoluteFill style={{ opacity: fadeIn }}>
          <CameraLayer scene={scene} index={index} accent={accent} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill
        style={{
          background: [
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.18) 14%, transparent 24%)",
            "linear-gradient(0deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.3) 28%, transparent 50%)",
          ].join(", "),
        }}
      />
    </AbsoluteFill>
  );
};
