/**
 * Phong cách "Karaoke" — xem skill `.claude/skills/style-karaoke/SKILL.md`.
 *
 * Màn hình băng karaoke: ảnh/clip của cảnh làm nền MV (không ảnh thì sân khấu đèn quét + bokeh nhún theo
 * bass), hai ô lời ở một phần ba dưới — câu chẵn ô trên canh trái, câu lẻ ô dưới canh phải. Chữ trắng viền
 * đậm, phần đã hát đổi sang màu nhấn chạy từ trái sang phải theo tiếng hát. Trước câu đầu và sau đoạn nhạc
 * dạo dài có 4 chấm đếm ngược. Nhịp nền đo từ chính file nhạc (src/styles/music.tsx).
 *
 * Thứ tự lớp: nền → thanh trên (micro + cột nhạc) → số liệu → nhãn đoạn + chấm đếm → hai ô lời → màn tên bài.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { Fragment } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene, ShortProps } from "../../compositions/Short/schema";
import { ensureFonts, useFontReady } from "../../fonts/load";
import { clamp, introEndFrame, mainLines, MusicLevels, punchMask, sungPart, timedWords } from "../music";
import { activeIndexAt, useLayout } from "../shared";
import {
  boardAt,
  DOT_STEP_MS,
  DOTS,
  fitLine,
  KARAOKE_FONTS,
  LEAD_MS,
  LINE_HEIGHT,
  LYRIC_FONT,
  LYRIC_WEIGHT,
  outlineShadow,
  paletteFor,
  type Palette,
} from "./karaoke";
import { Backdrop, StatPill, TagPill, TitleCard, TopBar } from "./parts";

const sceneOf = (scenes: Scene[], ms: number) => {
  for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].startMs <= ms) return scenes[i];
  return null;
};

/**
 * Một câu trong ô: từng từ hai lớp — trắng bên dưới, màu nhấn bên trên lộ dần theo phần đã hát. Giữa các từ
 * là dấu cách thật để trình duyệt ngắt dòng và chia đều hai hàng (text-wrap: balance).
 */
const LyricLine: React.FC<{
  line: Caption;
  punch: Scene["punch"];
  ms: number;
  size: number;
  align: "left" | "right";
  palette: Palette;
}> = ({ line, punch, ms, size, align, palette }) => {
  const frame = useCurrentFrame();
  const { fps, unit } = useLayout();
  const words = timedWords(line);
  const mask = punchMask(line.text, words, punch?.text);
  const outline = outlineShadow(palette.outline, Math.max(3, size * 0.075));
  return (
    <div style={{ textAlign: align, textWrap: "balance", fontFamily: LYRIC_FONT, fontWeight: LYRIC_WEIGHT, fontSize: size, lineHeight: LINE_HEIGHT }}>
      {words.map((w, i) => {
        const p = sungPart(w, ms);
        const isPunch = mask[i];
        // Cụm nhấn nảy lên đúng lúc hát tới và giữ quầng sáng.
        const pop = isPunch && ms >= w.startMs ? spring({ frame: frame - msToFrames(w.startMs), fps, config: { damping: 8, stiffness: 180 } }) : 0;
        const glow = isPunch && p > 0 ? `, 0 0 ${28 * unit}px ${palette.sung}` : "";
        return (
          <Fragment key={i}>
            <span
              style={{
                position: "relative",
                display: "inline-block",
                whiteSpace: "pre",
                // Phóng to không đẩy chữ bên cạnh ra — từ nhấn chừa sẵn lề hai bên để lúc nảy không đè chữ khác.
                margin: isPunch ? "0 0.06em" : undefined,
                scale: String(1 + pop * 0.05),
                transformOrigin: "50% 70%",
              }}
            >
              <span style={{ color: "#ffffff", textShadow: outline }}>{w.text}</span>
              {p > 0 ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    color: isPunch ? `hsl(${palette.hue}, 100%, 78%)` : palette.sung,
                    textShadow: outline + glow,
                    // Chưa hát hết thì cắt mép phải; nới trên/dưới/trái để không cắt dấu và viền.
                    clipPath: p >= 1 ? undefined : `inset(-45% ${((1 - p) * 100).toFixed(2)}% -45% -12%)`,
                  }}
                >
                  {w.text}
                </span>
              ) : null}
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </div>
  );
};

/** 4 chấm đếm ngược trước câu, tắt dần từ trái sang phải — chấm cuối tắt đúng lúc câu bắt đầu. */
const Countdown: React.FC<{ startMs: number; ms: number; palette: Palette; size: number }> = ({ startMs, ms, palette, size }) => (
  <div style={{ display: "flex", gap: size * 0.55, alignItems: "center" }}>
    {Array.from({ length: DOTS }, (_, k) => {
      const on = ms < startMs - (DOTS - 1 - k) * DOT_STEP_MS;
      return (
        <div
          key={k}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: on ? palette.sung : "rgba(255,255,255,0.18)",
            boxShadow: on ? `0 0 ${size * 0.7}px ${palette.sung}` : "none",
            border: `${Math.max(2, size * 0.12)}px solid ${palette.outline}`,
          }}
        />
      );
    })}
  </div>
);

const Lyrics: React.FC<{ lines: Caption[]; scenes: Scene[]; palette: Palette; hidden: boolean }> = ({ lines, scenes, palette, hidden }) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit, portrait, fps } = useLayout();
  const ms = (frame / fps) * 1000;
  const board = boardAt(lines, ms);
  // Cỡ chữ đo bằng canvas — đo lúc font chưa về là nhớ nhầm bề rộng của font dự phòng.
  const fontReady = useFontReady("bevietnam");
  if (!fontReady || hidden || board.opacity <= 0) return null;

  const side = safe.side * 0.7;
  const maxWidth = width - side * 2;
  const base = (portrait ? 76 : 68) * unit;
  const min = 42 * unit;
  // Mỗi ô cao đủ hai hàng ở cỡ gốc: câu một hàng thì ô trên dồn đáy, ô dưới dồn đỉnh — hai câu luôn sát nhau.
  const slotH = base * LINE_HEIGHT * 2;
  const gap = 22 * unit;
  const bottom = height - safe.bottom - (portrait ? 30 : 16) * unit;
  const tops = [bottom - slotH * 2 - gap, bottom - slotH];

  const shown = board.slots.map((s) => s.line).filter((l) => l >= 0);
  const firstShown = shown.length ? Math.min(...shown) : -1;
  const headScene = firstShown >= 0 ? sceneOf(scenes, lines[firstShown].startMs) : null;
  const countdown = board.countdown >= 0 ? lines[board.countdown] : null;

  return (
    <AbsoluteFill style={{ opacity: board.opacity }}>
      {/* Hàng đầu khối lời: nhãn đoạn bên trái, chấm đếm ngược ngay sau. */}
      <div style={{ position: "absolute", left: side, right: side, top: tops[0] - 62 * unit, height: 44 * unit, display: "flex", alignItems: "center", gap: 20 * unit }}>
        {headScene?.tag ? <TagPill text={headScene.tag} since={msToFrames(headScene.startMs)} palette={palette} align="left" /> : null}
        {countdown ? <Countdown startMs={countdown.startMs} ms={ms} palette={palette} size={24 * unit} /> : null}
      </div>
      {board.slots.map((slot, s) => {
        if (slot.line < 0) return null;
        const line = lines[slot.line];
        const since = msToFrames(slot.since);
        const t = interpolate(frame, [since, since + 7], [0, 1], clamp);
        return (
          <div
            key={`${s}-${slot.line}`}
            style={{
              position: "absolute",
              left: side,
              right: side,
              top: tops[s],
              height: slotH,
              display: "flex",
              flexDirection: "column",
              justifyContent: s === 0 ? "flex-end" : "flex-start",
              opacity: t,
              translate: `0 ${(1 - t) * 16 * unit}px`,
            }}
          >
            <LyricLine
              line={line}
              punch={sceneOf(scenes, line.startMs)?.punch ?? null}
              ms={ms}
              size={fitLine(line.text, maxWidth, base, min)}
              align={s === 0 ? "left" : "right"}
              palette={palette}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const StatLayer: React.FC<{ scenes: Scene[]; palette: Palette; hidden: boolean }> = ({ scenes, palette, hidden }) => {
  const frame = useCurrentFrame();
  const scene = scenes[activeIndexAt(scenes, frame)];
  if (hidden || !scene?.visual) return null;
  return <StatPill text={scene.visual.text} caption={scene.visual.caption} since={msToFrames(scene.startMs)} palette={palette} />;
};

const Body: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useLayout();
  const palette = paletteFor(accent);
  const lines = mainLines(captions);
  const introEnd = introEndFrame(lines, showTitle, fps, LEAD_MS);
  const inIntro = frame < introEnd;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.stageTop }}>
      <Backdrop scenes={scenes} palette={palette} />
      <TopBar palette={palette} opacity={1} />
      <StatLayer scenes={scenes} palette={palette} hidden={inIntro} />
      <Lyrics lines={lines} scenes={scenes} palette={palette} hidden={inIntro} />
      {inIntro ? <TitleCard title={title} subtitle={subtitle} palette={palette} end={introEnd} /> : null}
    </AbsoluteFill>
  );
};

export const KaraokeStyle: React.FC<ShortProps> = (props) => {
  ensureFonts(KARAOKE_FONTS);
  return (
    <MusicLevels props={props}>
      <Body {...props} />
    </MusicLevels>
  );
};
