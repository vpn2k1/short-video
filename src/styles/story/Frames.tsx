/**
 * Nền của từng khung story: ảnh/clip tràn màn hình phóng chậm, cảnh không ảnh thành nền gradient chế độ "Tạo".
 * Sang cảnh là cú xoay khối lập phương ngắn như vuốt sang story kế. Thêm nền mờ phía sau điện thoại (16:9, 1:1)
 * và màn "khay story" của phần mở đầu.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene, ShortProps } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, seeded } from "../shared";
import { Avatar } from "./Chrome";
import { clamp, createGradient, UI, VIDEO_EXT } from "./theme";
import { useVt } from "../../i18n/video";

/** Số frame của cú xoay lập phương khi sang cảnh. */
export const CUBE_FRAMES = 12;

/** Nền chế độ "Tạo": gradient + vài đốm sáng mềm trôi chậm. */
export const CreateBackground: React.FC<{ accent: string; index: number }> = ({ accent, index }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 70 + index) * 4;
  return (
    <AbsoluteFill style={{ background: createGradient(accent, index) }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(circle at ${24 + drift}% ${20 - drift}%, rgba(255,255,255,0.28) 0%, transparent 38%)`,
            `radial-gradient(circle at ${82 - drift}% ${78 + drift}%, rgba(255,255,255,0.16) 0%, transparent 42%)`,
          ].join(", "),
        }}
      />
      <Grain opacity={0.08} animated={false} />
    </AbsoluteFill>
  );
};

/** Một khung story: ảnh/clip phủ kín, phóng 1.0 → 1.08 suốt cảnh; không ảnh thì nền "Tạo". */
const Frame: React.FC<{ scene: Scene; index: number; accent: string }> = ({ scene, index, accent }) => {
  const frame = useCurrentFrame();
  if (!scene.image) return <CreateBackground accent={accent} index={index} />;
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  const zoom = interpolate(frame, [start, end + 20], [1.0, 1.08], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <SceneMedia scene={scene} from={start} zoom={zoom} />
    </AbsoluteFill>
  );
};

/**
 * Các khung story theo thời gian. Trong CUBE_FRAMES đầu mỗi cảnh (trừ cảnh đầu), khung cũ xoay quanh mép phải
 * trượt sang trái, khung mới xoay quanh mép trái trượt vào — như mặt khối lập phương.
 */
export const Frames: React.FC<{ scenes: Scene[]; accent: string }> = ({ scenes, accent }) => {
  const frame = useCurrentFrame();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  if (!scene) return <CreateBackground accent={accent} index={0} />;
  const start = msToFrames(scene.startMs);
  const p = index > 0 ? interpolate(frame, [start, start + CUBE_FRAMES], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;
  const prev = p < 1 ? scenes[index - 1] : null;
  return (
    <AbsoluteFill style={{ perspective: 2600, backgroundColor: "#000", overflow: "hidden" }}>
      {prev ? (
        <AbsoluteFill
          style={{
            transformOrigin: "right center",
            transform: `translateX(${-p * 100}%) rotateY(${-p * 90}deg)`,
            backfaceVisibility: "hidden",
          }}
        >
          <Frame scene={prev} index={index - 1} accent={accent} />
          <AbsoluteFill style={{ backgroundColor: "#000", opacity: p * 0.55 }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill
        style={{
          transformOrigin: "left center",
          transform: p < 1 ? `translateX(${(1 - p) * 100}%) rotateY(${(1 - p) * 90}deg)` : undefined,
          backfaceVisibility: "hidden",
        }}
      >
        <Frame scene={scene} index={index} accent={accent} />
        {p < 1 ? <AbsoluteFill style={{ backgroundColor: "#000", opacity: (1 - p) * 0.55 }} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Nền phía sau điện thoại (16:9, 1:1, 3:4): bản mờ của ảnh cảnh đang chạy, tối đi, có quầng màu nhấn.
 * Cảnh là clip hoặc không ảnh → gradient "Tạo" mờ (khỏi giải mã video hai lần).
 */
export const PhoneBackdrop: React.FC<{ scenes: Scene[]; accent: string }> = ({ scenes, accent }) => {
  const frame = useCurrentFrame();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const still = scene?.image && !VIDEO_EXT.test(scene.image) ? scene : null;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b10", overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "blur(46px) brightness(0.5) saturate(1.3)", scale: "1.25" }}>
        {still ? <SceneMedia scene={still} from={msToFrames(still.startMs)} /> : <CreateBackground accent={accent} index={index} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 45% 70% at 50% 50%, ${accent}33 0%, transparent 70%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Tâm avatar của khay story (px ảo) — vòng mở story nở ra từ đây. */
export const trayCenter = (vh: number) => ({ x: 540, y: vh * 0.44 });

/**
 * Màn mở đầu phần 1: "khay story" — avatar lớn với vòng gradient đang xoay tải và dòng "Tin mới · 2 giờ trước".
 * Frame 14 ngón tay chạm (avatar lún xuống), từ frame 18 story nở ra thành vòng tròn từ avatar (xem index.tsx).
 */
export const StoryTray: React.FC<{ vh: number; avatar: ShortProps["avatar"]; accent: string; firstImage: Scene | null }> = ({
  vh,
  avatar,
  accent,
  firstImage,
}) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const c = trayCenter(vh);
  const size = 290;
  const enter = interpolate(frame, [0, 10], [0.7, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  const tap = interpolate(frame, [12, 15, 20], [1, 0.9, 1.04], clamp);
  const spin = interpolate(frame, [0, 34], [0, 520], { ...clamp, easing: Easing.in(Easing.quad) });
  const touch = interpolate(frame, [10, 13, 18, 22], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b10", overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "blur(40px) brightness(0.42) saturate(1.2)", scale: "1.3" }}>
        {firstImage ? <SceneMedia scene={firstImage} from={0} /> : <CreateBackground accent={accent} index={0} />}
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: c.x - size / 2,
          top: c.y - size / 2,
          scale: String(enter * tap),
        }}
      >
        <Avatar size={size} avatar={avatar} accent={accent} spin={spin} />
        {/* Vệt chạm của ngón tay. */}
        <div
          style={{
            position: "absolute",
            left: size * 0.5 - 70,
            top: size * 0.5 - 70,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.55)",
            opacity: touch * 0.6,
            scale: String(0.6 + touch * 0.5),
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: c.y + size / 2 + 36,
          textAlign: "center",
          fontFamily: UI,
          color: "#fff",
          opacity: interpolate(frame, [3, 12], [0, 1], clamp),
          translate: `0 ${interpolate(frame, [3, 12], [20, 0], clamp)}px`,
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 700 }}>{vt("Tin mới")}</div>
        <div style={{ fontSize: 36, fontWeight: 500, opacity: 0.7, marginTop: 8 }}>{vt("2 giờ trước")}</div>
      </div>
      {/* Hàng avatar nhỏ mờ hai bên cho ra khay story. */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            left: c.x + side * 420 - 80,
            top: c.y - 80,
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: "5px solid rgba(255,255,255,0.28)",
            background: `hsla(${seeded(`tray-${side}`, 0, 360)}, 45%, 55%, 0.35)`,
            opacity: interpolate(frame, [4, 12], [0, 0.7], clamp),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/**
 * Chỉ ở khung ngang (16:9, 2:1): các story trước/sau là thẻ nhỏ mờ hai bên điện thoại, như trình xem story
 * trên máy tính — lấp khoảng trống hai bên và cho người xem thấy còn bao nhiêu khung. Thẻ có ảnh tĩnh của
 * cảnh (clip / không ảnh → gradient "Tạo"), avatar và "2 giờ" ở giữa. Đổi cảnh thì cả dãy trượt theo.
 */
export const NeighborCards: React.FC<{
  scenes: Scene[];
  accent: string;
  avatar: ShortProps["avatar"];
  /** Tâm điện thoại và nửa bề rộng thân máy (px thật). */
  cx: number;
  cy: number;
  half: number;
  cardH: number;
}> = ({ scenes, accent, avatar, cx, cy, half, cardH }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const start = scenes[index] ? msToFrames(scenes[index].startMs) : 0;
  // Trượt một nấc sang trái trong cú xoay cảnh.
  const slide = index > 0 ? interpolate(frame, [start, start + CUBE_FRAMES], [1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const cardW = (cardH * 9) / 16;
  const gap = cardW * 0.22;
  const out: React.ReactNode[] = [];
  for (let d = -3; d <= 3; d++) {
    if (d === 0) continue;
    const i = index + d;
    if (i < 0 || i >= scenes.length) continue;
    const scene = scenes[i];
    const pos = d + slide;
    const x = cx + Math.sign(pos) * (half + gap + cardW / 2) + (pos - Math.sign(pos)) * (cardW + gap) - cardW / 2;
    const still = scene.image && !VIDEO_EXT.test(scene.image) ? scene : null;
    out.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: cy - cardH / 2,
          width: cardW,
          height: cardH,
          borderRadius: cardW * 0.07,
          overflow: "hidden",
          opacity: interpolate(Math.abs(pos), [0.5, 1, 3], [0, 0.8, 0.35], clamp),
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
        }}
      >
        {still ? <SceneMedia scene={still} from={msToFrames(still.startMs)} /> : <CreateBackground accent={accent} index={i} />}
        <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.42)" }} />
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: cardW * 0.06 }}>
          <Avatar size={cardW * 0.3} avatar={avatar} accent={accent} />
          <div style={{ fontFamily: UI, fontWeight: 500, fontSize: cardW * 0.065, color: "rgba(255,255,255,0.75)" }}>{vt("2 giờ")}</div>
        </AbsoluteFill>
      </div>,
    );
  }
  return <>{out}</>;
};
