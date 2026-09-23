/**
 * Phong cách "Truyện tranh" — xem skill style-comic.
 *
 * Thứ tự lớp: trang giấy halftone → các khung truyện (ảnh + tag + visual + hình nổ punch)
 * → hộp lời dẫn vàng → bìa truyện mở đầu.
 * Đổi cảnh là "đập trang": khung mới to hơn đập xuống đè lên khung cũ, trang rung nhẹ,
 * khung cũ mờ đi sau vài frame. Timeline tuyệt đối, không TransitionSeries.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { CaptionPosition, Scene, ShortProps } from "../../compositions/Short/schema";
import { seeded, useCaptionClock, useLayout } from "../shared";
import { NarrationBox, PUNCH_FRAMES, PunchBurst, TagLabel, VisualBit } from "./Bits";
import { Cover } from "./Cover";
import { Page } from "./Page";
import { panelFrame, PanelArt } from "./Panel";
import { clamp, comicPalette, YELLOW } from "./palette";

/** Số frame khung cũ còn nằm dưới khung mới đang đập xuống. */
const SLAM_OUT = 8;

type Layout = ReturnType<typeof useLayout>;

/**
 * Khung dọc: khung truyện chiếm phần trên, hộp lời dẫn treo dưới mép khung.
 * Khung vuông/ngang: khung truyện gần kín vùng an toàn, hộp lời dẫn đè lên mép dưới.
 * captionPosition "center": khung kín vùng nội dung, hộp lời dẫn ở giữa khung.
 */
const computeLayout = (L: Layout, captionPosition: CaptionPosition) => {
  const { width: W, height: H, safe, unit: u } = L;
  const stacked = W / H < 0.8;
  const side = stacked ? Math.max(56 * u, safe.side * 0.55) : safe.side;
  const top = safe.top + 56 * u; // chừa chỗ tag nhô lên trên khung
  // Hộp lời dẫn treo từ mép khung xuống, được phép lấn nhẹ vào safe.bottom.
  const captionRoom = stacked && captionPosition === "bottom" ? 190 * u : 0;
  const bottom = H - safe.bottom - captionRoom - (stacked ? 0 : 30 * u);
  return {
    stacked,
    panel: { left: side, top, width: W - 2 * side, height: bottom - top },
    captionMaxWidth: stacked ? W - 2 * side : Math.min((W - 2 * side) * 0.72, 1300 * u),
  };
};

const SceneLayer: React.FC<{
  scene: Scene;
  index: number;
  frame: number;
  enterAt: number;
  start: number;
  /** Frame khung kế tiếp đập xuống; null nếu là cảnh cuối. */
  nextEnter: number | null;
  L: Layout;
  box: ReturnType<typeof computeLayout>;
  accent: string;
}> = ({ scene, index, frame, enterAt, start, nextEnter, L, box, accent }) => {
  const { fps, unit: u } = L;
  const { panel } = box;
  const f = frame - enterAt;
  const pal = comicPalette(accent, index);
  const end = Math.max(start + 1, msToFrames(scene.endMs));

  // Đập trang: to → nén → nảy → yên; nghiêng ngẫu nhiên cố định theo cảnh.
  const baseRot = seeded(`comic-rot-${index}`, -2, 2);
  const dir = index % 2 === 0 ? 1 : -1;
  const scale = interpolate(f, [0, 5, 9, 13], [1.35, 0.95, 1.025, 1], clamp);
  const rot = interpolate(f, [0, 5, 13], [baseRot + dir * 7, baseRot - dir * 1.2, baseRot], clamp);
  const fadeIn = interpolate(f, [0, 2], [0, 1], clamp);
  const fadeOut = nextEnter === null ? 1 : interpolate(frame, [nextEnter + 2, nextEnter + SLAM_OUT], [1, 0], clamp);

  // Punch bám mốc giọng đọc, kẹp vào trong cảnh để kịp nổ hết trước khi lật trang.
  let punchF = -1;
  if (scene.punch) {
    const at = msToFrames(scene.punch.atMs);
    const latest = (nextEnter ?? end + PUNCH_FRAMES) - PUNCH_FRAMES;
    const punchStart = Math.max(enterAt + 6, Math.min(at, latest));
    punchF = frame - punchStart;
  }
  // Khung giật theo cú nổ.
  const hit = punchF >= 0 && punchF < 12 ? interpolate(punchF, [0, 12], [1, 0], clamp) : 0;
  const hitX = Math.sin(punchF * 3.1) * 12 * u * hit;
  const hitY = Math.cos(punchF * 2.3) * 8 * u * hit;

  const progress = interpolate(frame, [start, Math.max(start + 1, nextEnter ?? end)], [0, 1], clamp);
  const noImage = !scene.image;

  const burstH = box.stacked ? Math.min(panel.width, panel.height) * 0.9 : panel.height * 0.86;
  const burstW = box.stacked ? Math.min(panel.width * 1.02, burstH * 1.06) : Math.min(panel.width * 0.7, burstH * 1.45);

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <div
        style={{
          position: "absolute",
          left: panel.left,
          top: panel.top,
          width: panel.width,
          height: panel.height,
          transform: `translate(${hitX}px, ${hitY}px) scale(${scale}) rotate(${rot}deg)`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, ...panelFrame(u) }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <PanelArt
              image={scene.image}
              crop={scene.crop}
              trimStartMs={scene.trimStartMs} speed={scene.speed}
              volume={scene.volume}
              sceneStart={start}
              progress={progress}
              frame={frame}
              rayA={pal.hot}
              rayB={index % 2 === 0 ? YELLOW : pal.coolLight}
              unit={u}
            />
          </div>
        </div>

        {scene.visual ? (
          <div
            style={
              noImage
                ? { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }
                : scene.visual.type === "stat"
                  ? { position: "absolute", right: -40 * u, top: -60 * u }
                  : { position: "absolute", right: -10 * u, top: -40 * u }
            }
          >
            <VisualBit
              visual={scene.visual}
              f={f - 12}
              fps={fps}
              unit={u}
              sceneIndex={index}
              cool={pal.cool}
              hot={pal.hot}
              hotDark={pal.hotDark}
              scale={noImage ? 1.6 : 1}
            />
          </div>
        ) : null}

        {scene.tag ? (
          <div style={{ position: "absolute", left: -22 * u, top: -38 * u }}>
            <TagLabel text={scene.tag} f={f - 6} fps={fps} unit={u} sceneIndex={index} />
          </div>
        ) : null}
      </div>

      {scene.punch ? (
        <div
          style={{
            position: "absolute",
            left: panel.left + panel.width / 2 - burstW / 2,
            top: panel.top + panel.height * (box.stacked ? 0.47 : 0.5) - burstH / 2,
          }}
        >
          <PunchBurst text={scene.punch.text} f={punchF} fps={fps} unit={u} w={burstW} h={burstH} hot={pal.hot} sceneIndex={index} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const ComicStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  const L = useLayout();
  const frame = useCurrentFrame();
  const cap = useCaptionClock(captions);
  const { unit: u, height: H } = L;
  const box = computeLayout(L, captionPosition);
  const { panel } = box;

  // Cảnh đầu chờ bìa lật đi rồi mới đập xuống (nhưng không trễ quá cảnh).
  const enters = scenes.map((scene, i) => {
    const start = msToFrames(scene.startMs);
    const end = Math.max(start + 1, msToFrames(scene.endMs));
    return i === 0 && showTitle ? Math.min(Math.max(start, TITLE_FRAMES - 8), end - 1) : start;
  });
  let active = -1;
  enters.forEach((e, i) => {
    if (frame >= e) active = i;
  });
  const sinceTurn = active >= 0 ? frame - enters[active] : 1000;

  // Cả trang rung nhẹ lúc khung mới đập xuống.
  const slam = sinceTurn < 10 ? (1 - sinceTurn / 10) * 10 * u : 0;
  const slamX = Math.sin(sinceTurn * 2.7) * slam;
  const slamY = Math.cos(sinceTurn * 3.3) * slam * 0.7;

  const captionBox = cap.caption ? (
    <NarrationBox
      key={cap.index}
      text={cap.caption.text}
      index={cap.index}
      localFrame={cap.localFrame}
      unit={u}
      maxWidth={box.captionMaxWidth}
      fps={L.fps}
    />
  ) : null;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Page accent={accent} pageIndex={active} sinceTurn={sinceTurn} frame={frame} />

      <AbsoluteFill style={{ transform: `translate(${slamX}px, ${slamY}px)` }}>
        {scenes.map((scene, index) => {
          const enterAt = enters[index];
          const nextEnter = index + 1 < scenes.length ? enters[index + 1] : null;
          if (frame < enterAt || (nextEnter !== null && frame >= nextEnter + SLAM_OUT)) {
            return null;
          }
          return (
            <SceneLayer
              key={`comic-scene-${index}`}
              scene={scene}
              index={index}
              frame={frame}
              enterAt={enterAt}
              start={msToFrames(scene.startMs)}
              nextEnter={nextEnter}
              L={L}
              box={box}
              accent={accent}
            />
          );
        })}
      </AbsoluteFill>

      {captionBox ? (
        captionPosition === "center" ? (
          <div
            style={{
              position: "absolute",
              left: panel.left,
              top: panel.top,
              width: panel.width,
              height: panel.height,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {captionBox}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: panel.left,
              width: panel.width,
              display: "flex",
              justifyContent: "center",
              ...(box.stacked
                ? { top: panel.top + panel.height - 40 * u }
                : { bottom: H - (panel.top + panel.height) - 50 * u }),
            }}
          >
            {captionBox}
          </div>
        )
      ) : null}

      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <Cover title={title} subtitle={subtitle} accent={accent} firstScene={scenes[0] ?? null} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
