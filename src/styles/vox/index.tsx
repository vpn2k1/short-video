/**
 * Phong cách "Cắt dán tài liệu" (kiểu Vox). Xem skill style-vox.
 *
 * Thứ tự lớp: giấy kẻ ô → các cảnh (hero + tag + visual + punch) → trang tít → dòng lời đọc.
 * Mỗi cảnh sống trong [start, end + EXIT]: cảnh cũ văng ra trong lúc cảnh mới đang vào,
 * nên không dùng TransitionSeries (nó rút ngắn timeline, lệch mốc voiceover).
 */
import { AbsoluteFill, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene, ShortProps } from "../../compositions/Short/schema";
import { seeded, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { CaptionLine, Punch, Tag, TitlePage, VisualBit } from "./Bits";
import { entranceStyle, idleTransform, pickEntrance } from "./entrances";
import { Hero, heroBox, heroKind } from "./Hero";
import { Paper } from "./Paper";
import { scenePalette } from "./palette";

/** Số frame cảnh cũ văng ra sau khi hết cảnh. */
const EXIT = 10;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Layout = ReturnType<typeof useLayout>;

/**
 * Bố cục: khung dọc (9:16, 3:4) xếp hero trên – punch dưới; khung vuông/ngang xếp
 * hero cột trái – punch cột phải. Mọi số đo nhân unit.
 */
const computeLayout = (L: Layout, hasPunch: boolean) => {
  const { width: W, height: H, safe, unit: u } = L;
  const short = Math.min(W, H);
  const stacked = W / H < 0.8;
  const contentTop = safe.top + 60 * u; // chừa chỗ tag nhô lên trên hero
  const contentBottom = H - safe.bottom - 120 * u; // chừa chỗ dòng lời đọc
  const contentH = contentBottom - contentTop;

  // Cảnh không có punch: hero đứng giữa vùng nội dung, không để trống nửa màn hình.
  if (!hasPunch) {
    const size = Math.min(0.7 * short, W - 2 * safe.side - 60 * u, contentH / 0.95);
    return {
      stacked,
      size,
      heroCx: W / 2,
      heroCy: (contentTop + contentBottom) / 2,
      punch: { left: safe.side, top: contentTop, width: W - 2 * safe.side, height: contentH },
      align: "center" as const,
    };
  }

  if (stacked) {
    const punchRoom = 320 * u;
    const size = Math.min(0.7 * short, W - 2 * safe.side - 20 * u, (contentH - punchRoom) / 0.95);
    const heroH = size * 0.9;
    const heroCy = contentTop + heroH / 2 + Math.max(0, (contentH - punchRoom - heroH) * 0.45);
    const punchTop = heroCy + heroH / 2 + 50 * u;
    return {
      stacked,
      size,
      heroCx: W / 2,
      heroCy,
      punch: { left: safe.side, top: punchTop, width: W - 2 * safe.side, height: contentBottom - punchTop },
      align: "center" as const,
    };
  }

  const split = W * 0.56;
  const size = Math.min(0.7 * short, split - safe.side - 40 * u, contentH / 0.95);
  const left = split + 30 * u;
  return {
    stacked,
    size,
    heroCx: safe.side + (split - safe.side) / 2,
    heroCy: (contentTop + contentBottom) / 2,
    punch: { left, top: contentTop, width: W - safe.side - left, height: contentH },
    align: "left" as const,
  };
};

const SceneLayer: React.FC<{
  scene: Scene;
  index: number;
  frame: number;
  enterAt: number;
  end: number;
  start: number;
  L: Layout;
  accent: string;
  title: string;
}> = ({ scene, index, frame, enterAt, end, start, L, accent, title }) => {
  const { fps, unit: u } = L;
  const box = computeLayout(L, Boolean(scene.punch));
  const f = frame - enterAt;
  const exit = interpolate(frame, [end, end + EXIT], [0, 1], clamp);

  const kind = heroKind(scene.image);
  const { w, h } = heroBox(kind, box.size);
  const entrance = entranceStyle(pickEntrance(index, title), f, fps, u);
  const idle = idleTransform(frame, f, fps, u, `hero-${index}`);
  const baseRot = kind === "cutout" ? seeded(`vox-rot-${index}`, -3, 3) : seeded(`vox-rot-${index}`, -4.5, 4.5);
  const pal = scenePalette(accent, index);

  // Punch hiện đúng mốc giọng đọc; mốc lệch khỏi cảnh thì kẹp vào trong cảnh.
  let punchF = -1;
  if (scene.punch) {
    const at = msToFrames(scene.punch.atMs);
    const punchStart = Math.max(enterAt + 8, Math.min(at, end - 20));
    punchF = frame - punchStart;
  }

  // Cảnh cũ văng ra: trượt xuống, nghiêng, mờ dần.
  const exitStyle: React.CSSProperties = {
    opacity: 1 - exit,
    transform: `translate(${exit * -60 * u}px, ${exit * 140 * u}px) rotate(${exit * -7}deg) scale(${1 - exit * 0.12})`,
  };

  return (
    <AbsoluteFill style={exitStyle}>
      <div
        style={{
          position: "absolute",
          left: box.heroCx - w / 2,
          top: box.heroCy - h / 2,
          width: w,
          height: h,
          transform: `${idle} rotate(${baseRot}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: entrance.transform,
            transformOrigin: entrance.transformOrigin,
            opacity: entrance.opacity,
          }}
        >
          <Hero
            image={scene.image}
            kind={kind}
            w={w}
            h={h}
            unit={u}
            sceneIndex={index}
            sceneStart={start}
            title={title}
            trimStartMs={scene.trimStartMs} speed={scene.speed}
            volume={scene.volume}
            crop={scene.crop}
          />
          {scene.visual ? (
            <div
              style={{
                position: "absolute",
                // Ảnh cắt nền thường còn nhiều viền trong suốt: kéo mảnh dán vào trong.
                right: kind === "cutout" ? w * 0.08 : -40 * u,
                ...(scene.visual.type === "badge" ? { bottom: -30 * u } : { top: -60 * u }),
              }}
            >
              <VisualBit
                visual={scene.visual}
                f={f - 14}
                fps={fps}
                unit={u}
                sceneIndex={index}
                note={pal.note}
                stamp={pal.stamp}
              />
            </div>
          ) : null}
          {scene.tag ? (
            <div
              style={{
                position: "absolute",
                left: kind === "cutout" ? w * 0.14 : -34 * u,
                top: kind === "cutout" ? h * 0.06 : -48 * u,
              }}
            >
              <Tag text={scene.tag} f={f - 7} fps={fps} unit={u} sceneIndex={index} />
            </div>
          ) : null}
        </div>
      </div>

      {scene.punch ? (
        <div
          style={{
            position: "absolute",
            left: box.punch.left,
            top: box.punch.top,
            width: box.punch.width,
            height: box.punch.height,
            display: "flex",
            alignItems: "center",
            justifyContent: box.align === "left" ? "flex-start" : "center",
          }}
        >
          <Punch
            text={scene.punch.text}
            f={punchF}
            fps={fps}
            frame={frame}
            unit={u}
            width={box.punch.width}
            align={box.align}
            sceneIndex={index}
          />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const VoxStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  captions,
  scenes,
  showTitle,
}) => {
  const L = useLayout();
  const { frame } = useSceneClock(scenes);
  const cap = useCaptionClock(captions);
  const { unit: u, safe, width } = L;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Paper scenes={scenes} accent={accent} />

      {scenes.map((scene, index) => {
        const start = msToFrames(scene.startMs);
        const end = Math.max(start + 1, msToFrames(scene.endMs));
        if (frame < start || frame >= end + EXIT) {
          return null;
        }
        // Cảnh đầu chờ trang tít rút đi rồi mới vào (nhưng không trễ quá cảnh).
        const enterAt =
          index === 0 && showTitle ? Math.min(Math.max(start, TITLE_FRAMES - 8), end - 1) : start;
        return (
          <SceneLayer
            key={`vox-scene-${index}`}
            scene={scene}
            index={index}
            frame={frame}
            enterAt={enterAt}
            start={start}
            end={end}
            L={L}
            accent={accent}
            title={title}
          />
        );
      })}

      {showTitle && frame < TITLE_FRAMES ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `0 ${safe.side}px` }}>
          <TitlePage
            title={title}
            subtitle={subtitle}
            handle={handle}
            f={frame}
            total={TITLE_FRAMES}
            fps={L.fps}
            unit={u}
            maxWidth={Math.min(width - 2 * safe.side, 1100 * u)}
          />
        </AbsoluteFill>
      ) : null}

      {cap.caption ? (
        <div
          style={{
            position: "absolute",
            left: safe.side,
            right: safe.side,
            bottom: safe.bottom + 24 * u,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CaptionLine
            key={cap.index}
            caption={cap.caption}
            localFrame={cap.localFrame}
            unit={u}
            maxWidth={width - 2 * safe.side}
          />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
