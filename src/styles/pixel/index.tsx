/**
 * Phong cách "Game 8-bit" — xem skill `.claude/skills/style-pixel/SKILL.md`.
 *
 * Màn hình game RPG 8/16-bit: HUD tim + thanh XP + xu ở trên, cửa sổ game viền pixel dày chứa ảnh/clip
 * đã điểm ảnh hoá (không ảnh thì phong cảnh pixel), hộp thoại RPG gõ chữ ở dưới, câu nhấn nảy như popup
 * arcade, số liệu là "ITEM GET!" có rương báu, đổi cảnh bằng màn tan điểm ảnh. Mở đầu: màn hình tiêu đề
 * "NHẤN START".
 * Thứ tự lớp: nền → cửa sổ game (ảnh, bảng vật phẩm, popup, tan điểm ảnh) + nhãn màn → HUD → hộp thoại
 * → màn tiêu đề → tan điểm ảnh toàn khung lúc rời màn tiêu đề.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ.
 */
import { AbsoluteFill, interpolate, Sequence, useVideoConfig } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { useSceneClock } from "../shared";
import { Dialog } from "./Dialog";
import { Hud } from "./Hud";
import { PixelDissolve } from "./parts";
import { clamp, coinsAt, HUD_BG, INK, onTwos, snap, useStage } from "./pixel";
import { TitleScreen } from "./Title";
import { DISSOLVE, PixelateFilter, Viewport } from "./Viewport";

export const PixelStyle: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, captionPosition, showTitle }) => {
  ensureFonts(["bungee", "lexend"]);
  const { durationInFrames } = useVideoConfig();
  const { frame, index, scene, startFrame } = useSceneClock(scenes);
  const hasDialog = captions.length > 0;
  const stage = useStage(captionPosition, hasDialog);
  const { width, height, P, unit, viewport, dialog, hud, stacked } = stage;
  const gameStart = showTitle ? TITLE_FRAMES : 0;
  const { total, last } = coinsAt(frame, captions, scenes, gameStart);
  const punches = scenes.flatMap((s) => (s.punch ? [s.punch.text] : []));
  const innerH = viewport.h - P * 8;
  // Popup câu nhấn: khi hộp thoại đè lên cửa sổ thì đẩy popup lên phần còn thấy được.
  const overlap = !stacked || captionPosition === "center";
  const visibleH = overlap && hasDialog && captionPosition === "bottom" ? dialog.y - viewport.y - P * 4 - snap(40 * unit, P) : innerH;
  const punchY = overlap && hasDialog ? (captionPosition === "center" ? innerH * 0.22 : visibleH * 0.48) : innerH * 0.46;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: HUD_BG,
        backgroundImage: `radial-gradient(${"#1c2150"} ${P / 2}px, transparent ${P / 2 + 0.5}px)`,
        backgroundSize: `${P * 6}px ${P * 6}px`,
        overflow: "hidden",
      }}
    >
      <PixelateFilter block={P * 1.2} />
      <Viewport
        scenes={scenes}
        scene={scene}
        index={index}
        startFrame={startFrame}
        frame={frame}
        rect={viewport}
        P={P}
        unit={unit}
        accent={accent}
        firstAppear={gameStart}
        punchY={punchY}
        visibleH={visibleH}
      />
      <Hud
        rect={hud}
        P={P}
        unit={unit}
        progress={Math.min(1, frame / Math.max(1, durationInFrames - 1))}
        coins={total}
        sinceCoin={frame - last}
        enter={interpolate(onTwos(frame), [gameStart, gameStart + 10], [0, 1], clamp)}
      />
      {hasDialog ? (
        <Dialog
          captions={captions}
          punches={punches}
          frame={frame}
          appear={gameStart}
          rect={dialog}
          P={P}
          unit={unit}
        />
      ) : null}
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <TitleScreen title={title} subtitle={subtitle} accent={accent} />
        </Sequence>
      ) : null}
      {showTitle && frame >= TITLE_FRAMES - DISSOLVE && frame < TITLE_FRAMES + DISSOLVE ? (
        <PixelDissolve
          w={width}
          h={height}
          cols={14}
          color={INK}
          reveal={frame >= TITLE_FRAMES}
          t={
            frame < TITLE_FRAMES
              ? interpolate(onTwos(frame), [TITLE_FRAMES - DISSOLVE, TITLE_FRAMES - 1], [0.08, 1], clamp)
              : interpolate(onTwos(frame), [TITLE_FRAMES, TITLE_FRAMES + DISSOLVE - 1], [0, 0.92], clamp)
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
