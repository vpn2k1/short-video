import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, useLayout } from "../shared";
import { clamp, ENTER_FRAMES, EXIT_FRAMES, VOID, type Palette } from "./depth";
import { Cube } from "./Space";

/** Khung hình là ngang (16:9, 2:1) hay vuông (1:1, 3:4). */
export const useShape = () => {
  const { width, height } = useLayout();
  const wide = width / height > 1.2;
  return { wide, square: !wide && height / width < 1.45 };
};

/**
 * Kích thước và tâm tấm kính theo khung hình — dọc chừa đáy cho phụ đề. Khung ngang có số liệu/nhãn (vẽ ở cột trái)
 * thì tấm kính dời sang phải.
 */
export const usePanelBox = (scene?: Scene | null) => {
  const { width, height } = useLayout();
  const { wide, square } = useShape();
  if (wide) {
    const side = Boolean(scene?.visual);
    const w = width * (side ? 0.42 : 0.46);
    return { w, h: Math.min(w * 0.62, height * 0.6), cx: width * (side ? 0.62 : 0.5), cy: height * 0.43 };
  }
  if (square) {
    const w = width * 0.62;
    return { w, h: Math.min(w * 0.92, height * 0.5), cx: width / 2, cy: height * 0.42 };
  }
  const w = width * 0.78;
  return { w, h: Math.min(w * 1.28, height * 0.5), cx: width / 2, cy: height * 0.4 };
};

/** Frame cảnh bắt đầu bay tới: cảnh đầu bay vào đúng lúc màn tiêu đề lao qua camera. */
export const arriveAt = (scene: Scene, index: number, showTitle: boolean) => {
  const start = msToFrames(scene.startMs);
  return index === 0 && showTitle ? Math.max(start, TITLE_FRAMES - 14) : start;
};

/** Tiến độ bay tới (0 → 1, có nảy nhẹ) của cảnh đang chạy — Space dùng để tăng tốc sao và sàn lúc chuyển cảnh. */
export const useArrival = (scenes: Scene[], showTitle: boolean) => {
  const frame = useCurrentFrame();
  const { fps } = useLayout();
  const index = activeIndexAt(scenes, frame);
  if (index < 0) return 1;
  const at = arriveAt(scenes[index], index, showTitle);
  return spring({ frame: frame - at, fps, config: { damping: 16, mass: 0.9 }, durationInFrames: ENTER_FRAMES + 8 });
};

type Pose = { x: number; y: number; z: number; rotX: number; rotY: number; opacity: number };

/** Một tấm: mặt kính chứa ảnh/clip + 6 lớp thành phía sau làm độ dày, viền sáng, vệt bóng kính quét theo góc xoay. */
const Panel: React.FC<{ scene: Scene; pose: Pose; palette: Palette; from: number }> = ({ scene, pose, palette, from }) => {
  const { unit } = useLayout();
  const box = usePanelBox(scene);
  const radius = 30 * unit;
  const sheen = interpolate(pose.rotY, [-40, 40], [120, -20], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: box.cx - box.w / 2,
        top: box.cy - box.h / 2,
        width: box.w,
        height: box.h,
        transformStyle: "preserve-3d",
        transform: `translate3d(${pose.x}px, ${pose.y}px, ${pose.z}px) rotateX(${pose.rotX}deg) rotateY(${pose.rotY}deg)`,
        opacity: pose.opacity,
      }}
    >
      {/* Độ dày: các lớp thành lùi dần ra sau, sáng dần về phía mặt kính như cạnh được chiếu sáng. 3 lớp cách 6u là
          đủ dày mà vẫn nhẹ — mỗi lớp là một mặt 3D phải ghép riêng. */}
      {Array.from({ length: 3 }, (_, k) => (
        <div
          key={k}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            // Màu tính sẵn thay cho filter: brightness() trên 6 lớp lớn làm render chậm hẳn.
            backgroundColor: `hsl(${palette.hue}, 70%, ${32 - k * 5}%)`,
            transform: `translateZ(${-(k + 1) * 6 * unit}px)`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: VOID,
          border: `${2.5 * unit}px solid rgba(255,255,255,0.55)`,
          // Một quầng vừa phải: bóng mờ bán kính lớn trên phần tử xoay 3D là phần tốn nhất khi render.
          boxShadow: `0 0 ${36 * unit}px ${palette.glow(0.45)}`,
        }}
      >
        <SceneMedia scene={scene} from={from} zoom={1.05} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.2) 47%, rgba(255,255,255,0.05) 53%, transparent 62%)",
            backgroundSize: "250% 100%",
            backgroundPosition: `${sheen}% 0`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${40 * unit}px rgba(0,0,0,0.45)` }} />
      </div>
    </div>
  );
};

/** Cảnh không ảnh: khối kính lớn xoay chậm giữa khung thay cho tấm ảnh. */
const GlassCube: React.FC<{ scene: Scene; pose: Pose; palette: Palette }> = ({ scene, pose, palette }) => {
  const frame = useCurrentFrame();
  const box = usePanelBox(scene);
  const size = Math.min(box.w, box.h) * 0.55;
  return (
    <div
      style={{
        position: "absolute",
        left: box.cx - size / 2,
        top: box.cy - size / 2,
        transformStyle: "preserve-3d",
        transform: `translate3d(${pose.x}px, ${pose.y}px, ${pose.z}px)`,
        opacity: pose.opacity,
      }}
    >
      <Cube size={size} rotateX={-18 + Math.sin(frame / 60) * 8} rotateY={frame * 0.9 + pose.rotY} palette={palette} />
    </div>
  );
};

/**
 * Tư thế của cảnh `index` tại frame hiện tại. Bay tới: từ sâu -2400 lại, xoay 55° theo hướng xen kẽ trái/phải,
 * nảy nhẹ khi dừng. Trong cảnh: đẩy máy chậm tới, lắc lư ±4°, bồng bềnh. Bay đi (khi cảnh sau tới): lao qua
 * camera về phía ngược hướng, mờ dần trong EXIT_FRAMES.
 */
const usePose = (scene: Scene, index: number, showTitle: boolean, leavingAt: number | null): Pose => {
  const frame = useCurrentFrame();
  const { fps, unit, width } = useLayout();
  const at = arriveAt(scene, index, showTitle);
  const end = Math.max(at + 1, msToFrames(scene.endMs));
  const dir = index % 2 === 0 ? 1 : -1;
  const enter = spring({ frame: frame - at, fps, config: { damping: 16, mass: 0.9 }, durationInFrames: ENTER_FRAMES + 8 });
  const dolly = interpolate(frame, [at, end + EXIT_FRAMES], [0, 160 * unit], clamp);
  const base: Pose = {
    x: 0,
    y: Math.sin(frame / 40 + index) * 9 * unit,
    z: interpolate(enter, [0, 1], [-2400 * unit, 0]) + dolly,
    rotX: 5 + Math.sin(frame / 70) * 2,
    rotY: interpolate(enter, [0, 1], [55 * dir, -9 * dir]) + Math.sin(frame / 55 + index) * 4,
    opacity: interpolate(enter, [0, 0.2], [0, 1], clamp),
  };
  if (leavingAt === null || frame < leavingAt) return base;
  const t = interpolate(frame, [leavingAt, leavingAt + EXIT_FRAMES], [0, 1], clamp);
  const ease = t * t;
  return {
    ...base,
    x: -dir * width * 0.75 * ease,
    z: base.z + 1500 * unit * ease,
    rotY: base.rotY - dir * 45 * ease,
    opacity: base.opacity * (1 - t),
  };
};

const SceneBody: React.FC<{ scenes: Scene[]; index: number; showTitle: boolean; palette: Palette }> = ({
  scenes,
  index,
  showTitle,
  palette,
}) => {
  const scene = scenes[index];
  const next = scenes[index + 1];
  const leavingAt = next ? arriveAt(next, index + 1, showTitle) : null;
  const pose = usePose(scene, index, showTitle, leavingAt);
  if (pose.opacity <= 0.001) return null;
  return scene.image ? (
    <Panel scene={scene} pose={pose} palette={palette} from={msToFrames(scene.startMs)} />
  ) : (
    <GlassCube scene={scene} pose={pose} palette={palette} />
  );
};

/**
 * Sân khấu 3D: cảnh đang chạy, cộng cảnh trước trong EXIT_FRAMES đầu (đang bay qua camera). Một khung phối cảnh
 * chung nên cảnh cũ và mới cùng một không gian.
 */
export const Stage: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({ scenes, showTitle, palette }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const index = activeIndexAt(scenes, frame);
  const box = usePanelBox(index >= 0 ? scenes[index] : null);
  if (index < 0) return null;
  const prevVisible = index > 0 && frame < arriveAt(scenes[index], index, showTitle) + EXIT_FRAMES;
  return (
    <AbsoluteFill style={{ perspective: 1600 * unit, perspectiveOrigin: `50% ${box.cy}px` }}>
      {/* Ánh tấm kính hắt xuống sàn. */}
      <div
        style={{
          position: "absolute",
          left: box.cx - box.w * 0.6,
          top: box.cy + box.h * 0.42,
          width: box.w * 1.2,
          height: box.h * 0.35,
          background: `radial-gradient(closest-side, ${palette.glow(0.3)}, transparent)`,
        }}
      />
      {prevVisible ? <SceneBody scenes={scenes} index={index - 1} showTitle={showTitle} palette={palette} /> : null}
      <SceneBody scenes={scenes} index={index} showTitle={showTitle} palette={palette} />
    </AbsoluteFill>
  );
};
