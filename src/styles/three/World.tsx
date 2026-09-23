import { useLoader, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useLayoutEffect, useMemo } from "react";
import { interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { isMediaCrop } from "../../scenes/CropBox";
import { arriveAt, usePanelBox } from "../depth/Stage";
import { activeIndexAt, useLayout } from "../shared";
import {
  CAMERA_Z,
  clamp,
  FOV,
  poseAt,
  poseVisible,
  pxPerUnit,
  SLAB_DEPTH,
  textureable,
  type Palette,
  type Pose,
} from "./three";

/**
 * Ánh sáng môi trường "phòng studio" dựng bằng code (RoomEnvironment → PMREM) — kim loại, sơn bóng có chỗ để phản
 * chiếu mà không cần file HDR tải về.
 */
const StudioEnvironment: React.FC = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

/** Tâm khung tấm ảnh (usePanelBox) đổi ra toạ độ thế giới — cùng một khung với phụ đề/câu nhấn. */
const usePanelWorld = (scene: Scene | null) => {
  const { width, height } = useLayout();
  const box = usePanelBox(scene);
  const k = pxPerUnit(height);
  return { k, w: box.w / k, h: box.h / k, x: (box.cx - width / 2) / k, y: -(box.cy - height / 2) / k };
};

/** Ảnh phủ kín mặt trước (cover), tôn trọng vùng crop; `zoom` > 1 là phóng chậm kiểu Ken Burns. */
const fitTexture = (texture: THREE.Texture, cardAspect: number, scene: Scene, zoom: number) => {
  const image = texture.image as { width: number; height: number };
  const imageAspect = image.width / Math.max(1, image.height);
  const crop = scene.crop && isMediaCrop(scene.crop) ? scene.crop : { x: 0, y: 0, w: 1, h: 1 };
  const regionAspect = (crop.w * imageAspect) / crop.h;
  let uw = crop.w;
  let vh = crop.h;
  if (regionAspect > cardAspect) uw = (crop.w * cardAspect) / regionAspect;
  else vh = (crop.h * regionAspect) / cardAspect;
  uw /= zoom;
  vh /= zoom;
  const u0 = crop.x + (crop.w - uw) / 2;
  const top = crop.y + (crop.h - vh) / 2;
  texture.repeat.set(uw, vh);
  // Toạ độ v của texture tính từ đáy ảnh.
  texture.offset.set(u0, 1 - top - vh);
};

/**
 * Tấm ảnh: khối hộp dày SLAB_DEPTH — mặt trước dán ảnh (không nhận ánh đèn, không tone map: giữ đúng màu ảnh gốc;
 * đèn làm ảnh cháy sáng), bốn cạnh kim loại màu nhấn, mặt sau kim loại tối. `texture` null = mặt trước tối bóng như
 * màn hình chưa bật (clip video vẽ DOM đè lên).
 */
const Slab: React.FC<{ scene: Scene; pose: Pose; texture: THREE.Texture | null; palette: Palette; zoom: number }> = ({
  scene,
  pose,
  texture,
  palette,
  zoom,
}) => {
  const panel = usePanelWorld(scene);
  const map = useMemo(() => {
    if (!texture) return null;
    const own = texture.clone();
    own.colorSpace = THREE.SRGBColorSpace;
    own.needsUpdate = true;
    return own;
  }, [texture]);
  useLayoutEffect(() => () => map?.dispose(), [map]);
  if (map) fitTexture(map, panel.w / panel.h, scene, zoom);
  return (
    <group position={[panel.x, panel.y, 0]}>
      <mesh
        position={[pose.x, pose.y, pose.z]}
        rotation={[pose.rx, pose.ry, pose.rz]}
        scale={pose.scale}
        castShadow
      >
        <boxGeometry args={[panel.w, panel.h, SLAB_DEPTH]} />
        {[0, 1, 2, 3].map((i) => (
          <meshPhysicalMaterial key={i} attach={`material-${i}`} color={palette.key} metalness={1} roughness={0.22} clearcoat={1} />
        ))}
        {map ? (
          <meshBasicMaterial attach="material-4" map={map} toneMapped={false} />
        ) : (
          <meshPhysicalMaterial attach="material-4" color="#05060a" roughness={0.15} metalness={0.2} clearcoat={1} />
        )}
        {/* Lưng tấm: kim loại tối cùng sắc màu nhấn — lúc xoay tới còn đọc được là một tấm kim loại, không phải khối đen. */}
        <meshPhysicalMaterial attach="material-5" color={`hsl(${palette.hue}, 35%, 24%)`} metalness={0.9} roughness={0.3} clearcoat={1} />
      </mesh>
    </group>
  );
};

/** Vật chính khi cảnh không có ảnh (và ở màn tiêu đề): nút xoắn kim loại bóng, xoay liên tục. */
const Hero: React.FC<{ scene: Scene | null; pose: Pose; palette: Palette; size: number }> = ({ scene, pose, palette, size }) => {
  const frame = useCurrentFrame();
  const panel = usePanelWorld(scene);
  return (
    <group position={[panel.x, panel.y, 0]}>
      <mesh
        position={[pose.x, pose.y, pose.z]}
        rotation={[pose.rx + frame * 0.012, pose.ry + frame * 0.02, pose.rz]}
        scale={pose.scale * size}
        castShadow
      >
        <torusKnotGeometry args={[0.62, 0.22, 220, 32, 2, 3]} />
        <meshPhysicalMaterial color={palette.key} metalness={1} roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
    </group>
  );
};

type Shape = { kind: "icosa" | "octa" | "sphere" | "torus" | "box"; angle: number; radius: number; y: number; size: number; speed: number; tint: "key" | "second" | "chrome" };

const SHAPES: Shape[] = [
  { kind: "icosa", angle: 0.4, radius: 2.9, y: 1.9, size: 0.34, speed: 0.006, tint: "second" },
  { kind: "sphere", angle: 2.2, radius: 3.2, y: -1.4, size: 0.3, speed: 0.005, tint: "chrome" },
  { kind: "torus", angle: 3.6, radius: 3.0, y: 1.2, size: 0.3, speed: -0.007, tint: "key" },
  { kind: "octa", angle: 5.0, radius: 3.4, y: -0.6, size: 0.36, speed: 0.0045, tint: "chrome" },
  { kind: "box", angle: 1.3, radius: 4.4, y: 2.6, size: 0.26, speed: -0.004, tint: "key" },
  { kind: "sphere", angle: 4.3, radius: 4.8, y: 0.3, size: 0.22, speed: 0.006, tint: "second" },
];

/**
 * Khối hình học kim loại/sơn bóng trôi quanh tấm ảnh theo quỹ đạo nghiêng, tự xoay. Quỹ đạo dẹt theo trục sâu và
 * lệch ra sau nên hiếm khi che tấm ảnh.
 */
const FloatingShapes: React.FC<{ palette: Palette; centerY: number }> = ({ palette, centerY }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {SHAPES.map((s, i) => {
        const a = s.angle + frame * s.speed;
        const color = s.tint === "key" ? palette.key : s.tint === "second" ? palette.second : "#dfe3ea";
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * s.radius, centerY + s.y + Math.sin(frame / 40 + i) * 0.18, Math.sin(a) * s.radius * 0.55 - 2]}
            rotation={[frame * 0.013 + i, frame * 0.017 + i * 2, 0]}
            scale={s.size}
            castShadow
          >
            {s.kind === "icosa" ? <icosahedronGeometry args={[1, 0]} /> : null}
            {s.kind === "octa" ? <octahedronGeometry args={[1, 0]} /> : null}
            {s.kind === "sphere" ? <sphereGeometry args={[1, 48, 32]} /> : null}
            {s.kind === "torus" ? <torusGeometry args={[1, 0.38, 32, 96]} /> : null}
            {s.kind === "box" ? <boxGeometry args={[1.3, 1.3, 1.3]} /> : null}
            <meshPhysicalMaterial
              color={color}
              metalness={s.tint === "chrome" ? 1 : 0.35}
              roughness={s.tint === "chrome" ? 0.08 : 0.25}
              clearcoat={1}
              clearcoatRoughness={0.08}
              flatShading={s.kind === "icosa" || s.kind === "octa"}
            />
          </mesh>
        );
      })}
    </>
  );
};

/** Cảnh `index` còn trên màn hình không, và tư thế của nó. */
const useCardPose = (scenes: Scene[], index: number, showTitle: boolean) => {
  const frame = useCurrentFrame();
  const { fps } = useLayout();
  const scene = scenes[index];
  const next = scenes[index + 1];
  const leavingAt = next ? arriveAt(next, index + 1, showTitle) : null;
  return {
    visible: poseVisible(frame, scene, index, showTitle, leavingAt),
    pose: poseAt(frame, fps, scene, index, showTitle, leavingAt),
  };
};

const Card: React.FC<{
  scenes: Scene[];
  index: number;
  showTitle: boolean;
  palette: Palette;
  textures: Map<string, THREE.Texture>;
}> = ({ scenes, index, showTitle, palette, textures }) => {
  const frame = useCurrentFrame();
  const { visible, pose } = useCardPose(scenes, index, showTitle);
  if (!visible) return null;
  const scene = scenes[index];
  if (!scene.image) return <Hero scene={scene} pose={pose} palette={palette} size={1} />;
  const at = arriveAt(scene, index, showTitle);
  const zoom = interpolate(frame, [at, at + 600], [1.02, 1.12], clamp);
  const texture = textureable(scene) ? textures.get(scene.image) ?? null : null;
  return <Slab scene={scene} pose={pose} texture={texture} palette={palette} zoom={zoom} />;
};

/** Màn tiêu đề: nút xoắn lớn giữa khung phía trên, xoay chậm, lùi vào sâu và biến mất khi tấm ảnh đầu bay tới. */
const TitleHero: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useLayout();
  const grow = spring({ frame, fps, config: { damping: 14, mass: 1 } });
  const leave = interpolate(frame, [TITLE_FRAMES - 16, TITLE_FRAMES], [0, 1], clamp);
  if (leave >= 1) return null;
  const pose: Pose = {
    x: 0,
    y: 0.9 + Math.sin(frame / 30) * 0.08,
    z: interpolate(leave, [0, 1], [0, -9]),
    rx: 0.3,
    ry: 0,
    rz: 0,
    scale: grow * (1 - leave * 0.6),
  };
  return <Hero scene={null} pose={pose} palette={palette} size={1.15} />;
};

/**
 * Toàn bộ phần WebGL: studio (môi trường, đèn, sương, sàn bóng), khối trôi, tấm ảnh của cảnh đang chạy và cảnh
 * trước (đang văng ra), vật chính của màn tiêu đề. Nền là DOM phía sau (canvas trong suốt).
 */
export const World: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette }> = ({ scenes, showTitle, palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useLayout();
  const urls = useMemo(
    () => [...new Set(scenes.filter(textureable).map((s) => s.image as string))],
    [scenes],
  );
  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0 }}
      camera={{ fov: FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 80 }}
      // "percentage" = PCFShadowMap. Mặc định của R3F là PCFSoftShadowMap — three 0.186 đã bỏ, in cảnh báo mỗi tab.
      shadows="percentage"
      gl={{ antialias: true, alpha: true }}
    >
      <StudioEnvironment />
      <fog attach="fog" args={[palette.fog, 11, 26]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[3, 6, 7]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <pointLight position={[-3.5, 1.5, 3]} intensity={30} distance={14} color={palette.key} />
      <pointLight position={[3, -1, -3]} intensity={24} distance={12} color={palette.second} />
      <Scenery scenes={scenes} showTitle={showTitle} palette={palette} urls={urls} frame={frame} />
    </ThreeCanvas>
  );
};

/** Phần phụ thuộc ảnh — tách riêng để useLoader (Suspense) chỉ chặn phần này lúc tải ảnh. */
const Scenery: React.FC<{ scenes: Scene[]; showTitle: boolean; palette: Palette; urls: string[]; frame: number }> = ({
  scenes,
  showTitle,
  palette,
  urls,
  frame,
}) => {
  const loaded = useLoader(THREE.TextureLoader, urls.map((u) => staticFile(u)));
  const textures = useMemo(() => new Map(urls.map((u, i) => [u, loaded[i]])), [urls, loaded]);
  const index = activeIndexAt(scenes, frame);
  // Sàn và quỹ đạo khối theo khung chuẩn (không theo cảnh) — khỏi nhảy khi cảnh sau dời tấm ảnh sang phải.
  const panel = usePanelWorld(null);
  const floorY = panel.y - panel.h / 2 - 0.9;
  return (
    <>
      <mesh position={[0, floorY, -4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        {/* Lambert: chỉ tán xạ + nhận bóng, không phản chiếu môi trường — vật liệu PBR ở góc nhìn xiên phản chiếu
            phòng studio sáng (Fresnel) làm cả nửa dưới khung xám bạc. */}
        <meshLambertMaterial color="#0b0c12" />
      </mesh>
      <FloatingShapes palette={palette} centerY={panel.y} />
      {showTitle && frame < TITLE_FRAMES ? <TitleHero palette={palette} /> : null}
      {index > 0 ? <Card scenes={scenes} index={index - 1} showTitle={showTitle} palette={palette} textures={textures} /> : null}
      {index >= 0 ? <Card scenes={scenes} index={index} showTitle={showTitle} palette={palette} textures={textures} /> : null}
    </>
  );
};
