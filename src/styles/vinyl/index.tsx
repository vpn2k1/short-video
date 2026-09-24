/**
 * Phong cách "Đĩa than" — xem skill `.claude/skills/style-vinyl/SKILL.md`.
 *
 * Đĩa than quay 33⅓ vòng/phút, nhãn đĩa là ảnh/clip của cảnh; quanh đĩa là vòng 64 cột phổ nhạc nhảy theo
 * chính file nhạc (bass ở đỉnh) và cung mảnh báo tiến độ bài; cần đọc đĩa tựa rãnh ngoài. Lời hiện từng câu
 * dưới đĩa: từ chưa hát mờ, hát tới đâu sáng tới đó, từ đang hát to lên màu nhấn. Câu nhấn: vòng sóng lan ra
 * từ mép đĩa. Mở đầu: bìa đĩa có tên bài, đĩa ló ra bên phải rồi trượt vào giữa khi bìa rút đi.
 * Khung ngang: đĩa bên trái, lời bên phải.
 *
 * Thứ tự lớp: nền → vòng phổ → đĩa → cần đĩa → vòng sóng → thanh trên → nhãn đoạn + lời → bìa đĩa (mở đầu).
 */
import { Fragment } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene, ShortProps } from "../../compositions/Short/schema";
import { ensureFonts, useFontReady } from "../../fonts/load";
import { fitLine } from "../karaoke/karaoke";
import { clamp, introEndFrame, mainLines, MusicLevels, punchMask, sungPart, timedWords, useLevels } from "../music";
import { activeIndexAt, useLayout } from "../shared";
import { Backdrop, Disc, FONT, paletteFor, Shockwave, Sleeve, SpectrumRing, ToneArm, VINYL_FONTS, type Palette } from "./parts";
import { useVt } from "../../i18n/video";

/** Câu dứt rồi mà câu sau còn xa hơn chừng này (ms) thì tắt lời cho đoạn nhạc dạo. */
const IDLE_MS = 2500;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const sceneOf = (scenes: Scene[], ms: number) => {
  for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].startMs <= ms) return scenes[i];
  return null;
};

/** Vị trí đĩa và vùng lời theo tỉ lệ khung. */
const useGeometry = () => {
  const { width, height, safe, unit } = useLayout();
  const stacked = height / width >= 1.2;
  if (stacked) {
    const r = width * 0.3;
    const cy = safe.top + 110 * unit + r + 140 * unit;
    const lyricsTop = cy + r + 175 * unit;
    return { stacked, r, cx: width / 2, cy, lyrics: { x: safe.side * 0.7, w: width - safe.side * 1.4, top: lyricsTop, bottom: height - safe.bottom * 0.7, size: 64 * unit } };
  }
  const r = Math.min(height * 0.3, width * 0.19);
  const cx = safe.side + r + 150 * unit;
  const lx = cx + r + 190 * unit;
  return { stacked, r, cx, cy: height / 2, lyrics: { x: lx, w: width - lx - safe.side, top: safe.top + 80 * unit, bottom: height - safe.bottom, size: (width / height > 1.4 ? 60 : 50) * unit } };
};

/* ------------------------------------------------------------ lời */

const LyricLine: React.FC<{ line: Caption; punch: Scene["punch"]; ms: number; size: number; align: "center" | "left"; palette: Palette }> = ({
  line,
  punch,
  ms,
  size,
  align,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const { kick } = useLevels();
  const words = timedWords(line);
  const mask = punchMask(line.text, words, punch?.text);
  return (
    <div style={{ textAlign: align, textWrap: "balance", fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.3, color: "#fff" }}>
      {words.map((w, i) => {
        const p = sungPart(w, ms);
        const singing = p > 0 && p < 1;
        const since = frame - msToFrames(w.startMs);
        // Từ vừa tới: nảy từ 0.8 lên trong 6 frame; từ đang hát to hơn một chút và nhún theo cú trống.
        const pop = since >= 0 ? interpolate(since, [0, 6], [0.8, 1], clamp) : 1;
        const scale = pop * (singing ? 1.07 + kick * 0.05 : 1);
        const hot = mask[i] && p > 0;
        return (
          <Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                scale: String(scale),
                opacity: p > 0 ? 1 : 0.26,
                color: hot || singing ? (hot ? palette.accent2 : palette.accent) : "#fff",
                textShadow: hot || singing ? `0 0 ${22 * unit}px ${hot ? palette.accent2 : palette.accent}` : "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {w.text}
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </div>
  );
};

const Lyrics: React.FC<{ lines: Caption[]; scenes: Scene[]; palette: Palette; opacity: number }> = ({ lines, scenes, palette, opacity }) => {
  const frame = useCurrentFrame();
  const { fps, unit, safe } = useLayout();
  const g = useGeometry();
  // Cỡ chữ đo bằng canvas — đo lúc font chưa về là nhớ nhầm bề rộng của font dự phòng.
  const fontReady = useFontReady("bevietnam");
  if (!fontReady || opacity <= 0) return null;
  const ms = (frame / fps) * 1000;
  const index = activeIndexAt(lines, frame);
  const current = lines[index];
  const next = lines[index + 1];
  // Câu hát xong mà câu sau còn xa: tắt lời (đoạn dạo). Còn dưới IDLE_MS thì hiện sẵn câu sau, mờ — như
  // trước câu đầu tiên.
  const between = !!current && ms > current.endMs + 400;
  const idle = between && (!next || next.startMs - ms > IDLE_MS);
  const shown = index < 0 ? 0 : between && next && !idle ? index + 1 : index;
  const line = lines[shown];
  if (!line) return null;
  const appearMs = shown === index ? line.startMs : Math.max(current ? current.endMs + 400 : 0, line.startMs - IDLE_MS);
  const since = msToFrames(appearMs);
  const t = index < 0 ? 1 : interpolate(frame, [since, since + 8], [0, 1], clamp);
  const fadeOut = idle && current ? interpolate(ms, [current.endMs + 400, current.endMs + 700], [1, 0], clamp) : 1;
  const scene = sceneOf(scenes, line.startMs);
  const align = g.stacked ? "center" : "left";
  const size = fitLine(line.text, g.lyrics.w, g.lyrics.size, 38 * unit);
  return (
    <div
      style={{
        position: "absolute",
        left: g.lyrics.x,
        top: g.lyrics.top,
        width: g.lyrics.w,
        height: g.lyrics.bottom - g.lyrics.top,
        display: "flex",
        flexDirection: "column",
        justifyContent: g.stacked ? "flex-start" : "center",
        alignItems: g.stacked ? "center" : "flex-start",
        gap: 22 * unit,
        opacity: opacity * fadeOut,
      }}
    >
      {scene?.tag ? (
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 24 * unit,
            letterSpacing: 4 * unit,
            color: palette.accent,
            padding: `${6 * unit}px ${16 * unit}px`,
            border: `${2 * unit}px solid ${palette.accent}`,
            borderRadius: 999,
          }}
        >
          ♪ {scene.tag.normalize("NFC").toLocaleUpperCase("vi")}
        </span>
      ) : null}
      <div key={shown} style={{ opacity: t, translate: `0 ${(1 - t) * 18 * unit}px`, width: "100%", maxHeight: g.lyrics.bottom - g.lyrics.top - safe.bottom * 0.1 }}>
        <LyricLine line={line} punch={scene?.punch ?? null} ms={ms} size={size} align={align} palette={palette} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ thanh trên, số liệu */

const TopBar: React.FC<{ title: string; palette: Palette }> = ({ title, palette }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const { safe, unit, width } = useLayout();
  const blink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0.35;
  const one = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
  return (
    <div style={{ position: "absolute", top: safe.top, left: safe.side * 0.7, width: width - safe.side * 1.4, display: "flex", alignItems: "center", gap: 18 * unit }}>
      <span
        style={{
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 8 * unit,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 22 * unit,
          letterSpacing: 2 * unit,
          color: "#fff",
          padding: `${6 * unit}px ${14 * unit}px`,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      >
        <span style={{ width: 12 * unit, height: 12 * unit, borderRadius: "50%", backgroundColor: palette.accent, opacity: blink }} />
        {vt("ĐANG PHÁT")}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...one, fontFamily: FONT, fontWeight: 800, fontSize: 32 * unit, color: "#fff" }}>{title.normalize("NFC")}</div>
      </div>
    </div>
  );
};

const StatChip: React.FC<{ scenes: Scene[]; palette: Palette }> = ({ scenes, palette }) => {
  const frame = useCurrentFrame();
  const { safe, unit } = useLayout();
  const scene = scenes[activeIndexAt(scenes, frame)];
  if (!scene?.visual) return null;
  const start = msToFrames(scene.startMs);
  const t = interpolate(frame, [start + 4, start + 16], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        top: safe.top + 84 * unit,
        right: safe.side * 0.7,
        opacity: t,
        display: "flex",
        alignItems: "baseline",
        gap: 10 * unit,
        padding: `${6 * unit}px ${18 * unit}px`,
        borderRadius: 999,
        backgroundColor: "rgba(0,0,0,0.45)",
        border: `${2 * unit}px solid ${palette.accent}`,
      }}
    >
      <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 34 * unit, color: palette.accent }}>{scene.visual.text}</span>
      {scene.visual.caption ? <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22 * unit, color: "rgba(255,255,255,0.85)" }}>{scene.visual.caption}</span> : null}
    </div>
  );
};

/* ------------------------------------------------------------ ghép */

const Body: React.FC<ShortProps> = ({ title, accent, captions, scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useLayout();
  const g = useGeometry();
  const palette = paletteFor(accent);
  const lines = mainLines(captions);
  // Mở đầu: bìa đĩa che bên trái, đĩa ló ra bên phải; 20 frame cuối bìa rút sang trái, đĩa trượt vào giữa.
  const introEnd = introEndFrame(lines, showTitle, fps, 500);
  const t = introEnd > 20 ? easeInOut(interpolate(frame, [introEnd - 20, introEnd], [0, 1], clamp)) : 1;
  const sleeveSize = g.r * 2.04;
  const peek = g.r * 0.62;
  const cx = g.cx + peek * (1 - t);
  const sleeveX = g.cx - g.r * 1.02 - peek * 0.45 - t * (width * 0.9);
  // Câu nhấn của cảnh đang chạy: vòng sóng lan ra đúng lúc hát tới.
  const scene = scenes[activeIndexAt(scenes, frame)];
  const punchAt = scene?.punch ? msToFrames(scene.punch.atMs) : -1;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.base }}>
      <Backdrop scenes={scenes} palette={palette} cx={cx} cy={g.cy} r={g.r} />
      <SpectrumRing cx={cx} cy={g.cy} r={g.r} palette={palette} />
      <Disc cx={cx} cy={g.cy} r={g.r} scenes={scenes} title={title} palette={palette} />
      <div style={{ opacity: t }}>
        <ToneArm cx={cx} cy={g.cy} r={g.r} />
      </div>
      {punchAt >= 0 ? <Shockwave cx={cx} cy={g.cy} r={g.r} at={punchAt} color={palette.accent2} /> : null}
      <div style={{ opacity: t }}>
        <TopBar title={title} palette={palette} />
      </div>
      {t >= 1 ? <StatChip scenes={scenes} palette={palette} /> : null}
      <Lyrics lines={lines} scenes={scenes} palette={palette} opacity={t} />
      {t < 1 ? <Sleeve x={sleeveX} y={g.cy - sleeveSize / 2} size={sleeveSize} scenes={scenes} title={title} palette={palette} /> : null}
    </AbsoluteFill>
  );
};

export const VinylStyle: React.FC<ShortProps> = (props) => {
  ensureFonts(VINYL_FONTS);
  return (
    <MusicLevels props={props}>
      <Body {...props} />
    </MusicLevels>
  );
};
