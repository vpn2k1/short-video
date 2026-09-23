import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { arriveAt, usePanelBox } from "../depth/Stage";
import { SceneMedia } from "../media";
import { activeIndexAt, useLayout } from "../shared";
import { clamp, EXIT_FRAMES, focalPx, poseAt, poseVisible, pxPerUnit, textureable, type Pose } from "./three";

/**
 * Mặt trước bằng DOM cho tấm không dán được lên WebGL (clip video, crop xoay/lật): cùng khung `usePanelBox`, cùng
 * tư thế `poseAt`, trong một khung CSS có `perspective` = tiêu cự của camera Three.js và gốc phối cảnh ở giữa khung
 * — nên trùng khít với tấm 3D phía dưới (tấm đó để mặt trước tối). Trục y và góc quay quanh X, Z của CSS ngược chiều
 * Three.js (CSS trục y hướng xuống). Mặt sau ẩn: lúc tấm đang xoay quá 90° thì thấy lưng kim loại của khối 3D.
 */
const DomFace: React.FC<{ scene: Scene; pose: Pose; opacity: number }> = ({ scene, pose, opacity }) => {
  const { height } = useLayout();
  const box = usePanelBox(scene);
  const k = pxPerUnit(height);
  return (
    <div
      style={{
        position: "absolute",
        left: box.cx - box.w / 2,
        top: box.cy - box.h / 2,
        width: box.w,
        height: box.h,
        overflow: "hidden",
        backfaceVisibility: "hidden",
        opacity,
        transform: [
          `translate3d(${pose.x * k}px, ${-pose.y * k}px, ${pose.z * k}px)`,
          `rotateX(${(-pose.rx * 180) / Math.PI}deg)`,
          `rotateY(${(pose.ry * 180) / Math.PI}deg)`,
          `rotateZ(${(-pose.rz * 180) / Math.PI}deg)`,
          `scale(${pose.scale})`,
        ].join(" "),
      }}
    >
      <SceneMedia scene={scene} from={msToFrames(scene.startMs)} zoom={1.04} />
      {/* Vệt bóng kính chéo và viền trong, để mặt DOM không "phẳng" hơn mặt ảnh WebGL bên cạnh. */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.14), transparent 35%, transparent 70%, rgba(0,0,0,0.25))" }} />
    </div>
  );
};

export const MediaFaces: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const { height, fps } = useLayout();
  const index = activeIndexAt(scenes, frame);
  if (index < 0) return null;
  const items = [index - 1, index].filter((i) => i >= 0).flatMap((i) => {
    const scene = scenes[i];
    if (!scene.image || textureable(scene)) return [];
    const next = scenes[i + 1];
    const leavingAt = next ? arriveAt(next, i + 1, showTitle) : null;
    if (!poseVisible(frame, scene, i, showTitle, leavingAt)) return [];
    const pose = poseAt(frame, fps, scene, i, showTitle, leavingAt);
    // DOM luôn vẽ trên canvas — nên chỉ "bật màn hình" khi tấm đã tới gần VÀ tấm cảnh trước (WebGL, ở gần camera hơn)
    // đã văng đi gần hết; trước đó thấy mặt tối của khối 3D bay tới.
    const arrive = arriveAt(scene, i, showTitle);
    const near = interpolate(pose.z, [-5, -1.5], [0, 1], clamp);
    const clear = i > 0 ? interpolate(frame, [arrive + EXIT_FRAMES * 0.55, arrive + EXIT_FRAMES * 0.85], [0, 1], clamp) : 1;
    return [{ i, scene, pose, opacity: Math.min(near, clear) }];
  });
  if (!items.length) return null;
  return (
    <AbsoluteFill style={{ perspective: focalPx(height), perspectiveOrigin: "50% 50%" }}>
      {items.map(({ i, scene, pose, opacity }) => (
        <DomFace key={i} scene={scene} pose={pose} opacity={opacity} />
      ))}
    </AbsoluteFill>
  );
};
