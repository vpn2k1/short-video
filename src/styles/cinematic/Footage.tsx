import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { TITLE_FRAMES, msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { Grain, seeded, useLayout } from "../shared";
import { BARS_IN_FRAMES, barHeight, clamp, DIP_FRAMES, DISSOLVE_FRAMES, EASE, punchPresence } from "./cine";

/** "image" của cảnh có thể là video người dùng tải lên. */
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
const GRADE_ID = "cine-grade";
/** Chỉnh màu tĩnh: bộ lọc SVG teal–cam + chút tương phản. Không blur, không đổi theo frame. */
const GRADE = `url(#${GRADE_ID}) contrast(1.04) saturate(0.94) brightness(1.02)`;

/**
 * Bảng màu teal–cam: bóng tối kéo về xanh lục lam (nâng B/G ở đầu thấp),
 * vùng sáng kéo về cam (tăng R, hạ B ở đầu cao). Tông trung tính giữ nguyên.
 */
const GradeFilter: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <filter id={GRADE_ID} colorInterpolationFilters="sRGB">
      <feComponentTransfer>
        <feFuncR type="table" tableValues="0 0.19 0.49 0.8 1" />
        <feFuncG type="table" tableValues="0.02 0.25 0.5 0.76 0.96" />
        <feFuncB type="table" tableValues="0.06 0.3 0.49 0.66 0.84" />
      </feComponentTransfer>
    </filter>
  </svg>
);

/** Cảnh không có ảnh: gradient tối sâu, một vầng sáng trôi chậm như ánh đèn xa. */
const DarkStage: React.FC<{ background: string; seed: string }> = ({ background, seed }) => {
  const frame = useCurrentFrame();
  const phase = seeded(`${seed}-phase`, 0, Math.PI * 2);
  const x = 50 + Math.sin(frame / 80 + phase) * 22;
  const y = 42 + Math.cos(frame / 110 + phase) * 12;
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070a" }}>
      {/* `background` pha rất nhẹ để giữ màu thương hiệu mà vẫn tối. */}
      <AbsoluteFill style={{ backgroundColor: background, opacity: 0.18 }} />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(ellipse 60% 40% at ${x}% ${y}%, rgba(255,176,110,0.28) 0%, rgba(255,140,80,0.08) 40%, rgba(0,0,0,0) 72%), radial-gradient(ellipse 80% 60% at ${100 - x}% ${100 - y}%, rgba(40,110,130,0.3) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Ảnh/video của mọi cảnh: toàn khung, dolly đẩy/lia chậm theo seed, hoà cảnh qua màu đen.
 * Không dùng TransitionSeries — timeline phải giữ mốc tuyệt đối để khớp phụ đề.
 */
export const Footage: React.FC<{ scenes: Scene[]; background: string }> = ({ scenes, background }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <GradeFilter />
      {scenes.map((scene, index) => {
        const start = msToFrames(scene.startMs);
        const end = Math.max(start + 1, msToFrames(scene.endMs));
        const isLast = index === scenes.length - 1;

        let opacity = 1;
        if (index > 0) {
          opacity = interpolate(frame, [start - DISSOLVE_FRAMES, start + DISSOLVE_FRAMES], [0, 1], clamp);
        }
        if (!isLast) {
          // Cảnh sau vẽ đè lên; tắt cảnh trước khi cảnh sau đã hiện đủ.
          opacity *= interpolate(frame, [end + DISSOLVE_FRAMES, end + DISSOLVE_FRAMES + 1], [1, 0], clamp);
        }
        if (opacity <= 0) return null;

        const key = `cine-scene-${index}`;
        const progress = interpolate(frame, [start - DIP_FRAMES, end + DIP_FRAMES], [0, 1], {
          ...clamp,
          easing: Easing.inOut(Easing.sin),
        });
        // Dolly: phần lớn cảnh đẩy vào, thỉnh thoảng lùi ra; lia ngang/dọc nhẹ.
        const pushIn = seeded(`${key}-push`) > 0.25;
        const scale = pushIn ? 1.06 + 0.1 * progress : 1.16 - 0.1 * progress;
        const dx = seeded(`${key}-dx`, -2.2, 2.2);
        const dy = seeded(`${key}-dy`, -1.4, 1.4);
        const tx = -dx + 2 * dx * progress;
        const ty = -dy + 2 * dy * progress;

        let content: React.ReactNode;
        if (!scene.image) {
          content = <DarkStage background={background} seed={key} />;
        } else if (VIDEO_EXT.test(scene.image)) {
          content = (
            <Sequence from={Math.max(0, start - DISSOLVE_FRAMES)}>
              <AbsoluteFill style={{ transform: `translate(${tx * 0.5}%, ${ty * 0.5}%) scale(${1 + (scale - 1) * 0.6})` }}>
                <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} />
              </AbsoluteFill>
            </Sequence>
          );
        } else {
          content = (
            <AbsoluteFill style={{ transform: `translate(${tx}%, ${ty}%) scale(${scale})` }}>
              <CropBox crop={scene.crop}>
                <Img src={staticFile(scene.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </CropBox>
            </AbsoluteFill>
          );
        }

        return (
          <AbsoluteFill key={key} style={{ opacity, overflow: "hidden", filter: scene.image ? GRADE : undefined }}>
            {content}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Lớp "ống kính": ám màu, vignette mờ, hạt phim, nhúng đen ở điểm cắt, vệt sáng anamorphic
 * mảnh khi vào cảnh, và làm tối hình khi tiêu đề trailer hiện.
 */
export const LensLook: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const { unit, height } = useLayout();

  let dip = 0;
  let streak = 0;
  let streakY = 46;
  scenes.forEach((scene, index) => {
    const cut = index === 0 ? (showTitle ? TITLE_FRAMES - 6 : -100) : msToFrames(scene.startMs);
    if (index > 0) {
      dip = Math.max(dip, interpolate(frame, [cut - DIP_FRAMES, cut, cut + DIP_FRAMES], [0, 0.88, 0], clamp));
    }
    const s = interpolate(frame, [cut - 2, cut + 4, cut + 28], [0, 1, 0], clamp);
    if (s > streak) {
      streak = s;
      streakY = seeded(`cine-streak-${index}`, 34, 58);
    }
  });

  const punch = punchPresence(scenes, frame);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Ám lạnh nhẹ ở vùng tối, giữ đen sâu */}
      <AbsoluteFill style={{ backgroundColor: "#0f3440", mixBlendMode: "soft-light", opacity: 0.35 }} />
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse 90% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 85%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {/* Nền tối dịu phía dưới cho phụ đề đọc được */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 82%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      <Grain opacity={0.1} baseFrequency={0.95} />
      {streak > 0 ? (
        <div
          style={{
            position: "absolute",
            left: "-10%",
            right: "-10%",
            top: (height * streakY) / 100,
            height: Math.max(1, 3 * unit),
            opacity: streak,
            mixBlendMode: "screen",
            backgroundImage:
              "linear-gradient(90deg, rgba(90,170,255,0) 0%, rgba(120,190,255,0.55) 30%, rgba(230,245,255,1) 50%, rgba(120,190,255,0.55) 70%, rgba(90,170,255,0) 100%)",
            boxShadow: `0 0 ${18 * unit}px ${4 * unit}px rgba(90,160,255,0.45)`,
          }}
        />
      ) : null}
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: Math.max(dip, punch * 0.62) }} />
    </AbsoluteFill>
  );
};

/** Hai dải viền đen trượt vào trong 20 frame đầu, nằm trên mọi lớp. */
export const Letterbox: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useLayout();
  const bar = barHeight(width, height) * interpolate(frame, [0, BARS_IN_FRAMES], [0, 1], { ...clamp, easing: EASE });
  if (bar <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, backgroundColor: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, backgroundColor: "#000" }} />
    </AbsoluteFill>
  );
};
