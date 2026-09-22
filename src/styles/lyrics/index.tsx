/**
 * Phong cách "Lời nhạc cuộn" — xem skill `.claude/skills/style-lyrics/SKILL.md`.
 *
 * Lời đồng bộ kiểu app nghe nhạc: nền là ảnh/clip của cảnh phóng to nhoè đậm màu (không ảnh thì các mảng màu
 * trôi), trình phát nhỏ ở trên (ảnh bìa, tên bài, handle, thanh tiến độ), lời bài hát xếp thành danh sách chữ
 * lớn canh trái cuộn lên theo câu đang hát — câu đang hát sáng dần từng từ, câu khác mờ và nhoè theo khoảng
 * cách, đoạn nhạc dạo dài hiện "• • •" sáng dần. Khung dọc có đoạn dạo đầu: màn "Đang phát" cỡ lớn rồi ảnh
 * bìa thu về góc trên. Nhịp nền đo từ chính file nhạc (src/styles/music.tsx).
 *
 * Thứ tự lớp: nền → danh sách lời → số liệu → trình phát (nhỏ / lớn).
 */
import { Fragment } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene, ShortProps } from "../../compositions/Short/schema";
import { ensureFonts, useFontReady } from "../../fonts/load";
import { clamp, introEndFrame, mainLines, MusicLevels, punchMask, sungPart, timedWords, useLevels } from "../music";
import { activeIndexAt, useLayout } from "../shared";
import { buildRows, FONT, LINE_HEIGHT, LYRICS_FONTS, paletteFor, scrollAt, WEIGHT, wrapWords, type Palette, type Row } from "./layout";
import { Artwork, Backdrop, Controls, PlayingBars, Progress } from "./parts";

type Rect = { x: number; y: number; s: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Vị trí các khối theo tỉ lệ khung. `stacked` = khung dọc: trình phát trên, lời dưới. */
const useGeometry = () => {
  const { width, height, safe, unit } = useLayout();
  const stacked = height / width >= 1.2;
  if (stacked) {
    const side = safe.side * 0.75;
    const artS = 124 * unit;
    const mini: Rect = { x: side, y: safe.top, s: artS };
    const bigS = Math.min(width - side * 2.8, height * 0.4);
    const full: Rect = { x: (width - bigS) / 2, y: safe.top + 110 * unit, s: bigS };
    const lyricsTop = safe.top + artS + 130 * unit;
    const lyricsBottom = height - safe.bottom * 0.55;
    return {
      stacked,
      side,
      mini,
      full,
      miniText: { x: mini.x + artS + 28 * unit, y: mini.y + 8 * unit, w: width - (mini.x + artS + 28 * unit) - side - 64 * unit },
      progress: { x: side, y: mini.y + artS + 30 * unit, w: width - side * 2 },
      lyrics: { x: side, top: lyricsTop, bottom: lyricsBottom, w: width - side * 2, size: 70 * unit, anchor: lyricsTop + (lyricsBottom - lyricsTop) * 0.26 },
    };
  }
  // Ngang / vuông: trình phát bên trái, lời bên phải.
  const panelW = width * (width / height > 1.4 ? 0.34 : 0.4);
  const artS = Math.min(panelW - safe.side * 0.5, height - safe.top - safe.bottom - 290 * unit);
  const art: Rect = { x: safe.side, y: (height - artS - 220 * unit) / 2, s: artS };
  const lx = safe.side + panelW + 60 * unit;
  const top = safe.top + 10 * unit;
  const bottom = height - safe.bottom;
  return {
    stacked,
    side: safe.side,
    mini: art,
    full: art,
    miniText: { x: art.x, y: art.y + artS + 26 * unit, w: artS },
    progress: { x: art.x, y: art.y + artS + 150 * unit, w: artS },
    lyrics: { x: lx, top, bottom, w: width - lx - safe.side, size: (width / height > 1.4 ? 58 : 50) * unit, anchor: top + (bottom - top) * 0.32 },
  };
};

/* ------------------------------------------------------------ lời */

const sceneOf = (scenes: Scene[], ms: number) => {
  for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].startMs <= ms) return scenes[i];
  return null;
};

const LineRow: React.FC<{
  line: Caption;
  punch: Scene["punch"];
  ms: number;
  active: number;
  dist: number;
  size: number;
  maxWidth: number;
  palette: Palette;
}> = ({ line, punch, ms, active, dist, size, maxWidth, palette }) => {
  const { unit } = useLayout();
  const words = timedWords(line);
  const mask = punchMask(line.text, words, punch?.text);
  const rowOf = wrapWords(words.map((w) => w.text), size, maxWidth);
  const blur = (1 - active) * Math.min(2.6, dist * 0.9) * unit;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: WEIGHT,
        fontSize: size,
        lineHeight: LINE_HEIGHT,
        color: "#fff",
        scale: String(0.955 + 0.045 * active),
        transformOrigin: "0% 50%",
        filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      {Array.from({ length: (rowOf.at(-1) ?? 0) + 1 }, (_, row) => (
        <div key={row} style={{ whiteSpace: "nowrap" }}>
          {words.map((w, i) => {
            if (rowOf[i] !== row) return null;
            const p = active > 0 ? sungPart(w, ms) : 0;
            // Câu khác: mờ đều. Câu đang hát: từ chưa tới mờ, hát tới đâu sáng tới đó và nhích lên một chút.
            const opacity = lerp(0.3, 0.4 + 0.6 * p, active);
            const hot = mask[i] && p > 0;
            return (
              <Fragment key={i}>
                {i > 0 && rowOf[i - 1] === row ? " " : null}
                <span
                  style={{
                    display: "inline-block",
                    opacity,
                    translate: `0 ${(-4 * unit * p * active).toFixed(2)}px`,
                    color: hot ? palette.accent : "#fff",
                    textShadow: hot ? `0 0 ${24 * unit}px ${palette.accent}` : p > 0.95 && active > 0.5 ? `0 0 ${14 * unit}px rgba(255,255,255,0.35)` : undefined,
                  }}
                >
                  {w.text}
                </span>
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** "• • •" của đoạn nhạc dạo: ba chấm sáng dần theo thời gian còn lại, thở nhẹ theo nhịp. */
const DotsRow: React.FC<{ row: Extract<Row, { kind: "dots" }>; ms: number; active: number; size: number }> = ({ row, ms, active, size }) => {
  const frame = useCurrentFrame();
  const { kick } = useLevels();
  const progress = Math.max(0, Math.min(1, (ms - row.fromMs) / Math.max(1, row.toMs - row.fromMs)));
  const d = size * 0.3;
  return (
    <div style={{ display: "flex", gap: d * 0.8, alignItems: "center", height: row.h, opacity: active, scale: String(1 + 0.07 * Math.sin(frame / 7) + kick * 0.1), transformOrigin: "0% 50%" }}>
      {[0, 1, 2].map((k) => (
        <div key={k} style={{ width: d, height: d, borderRadius: "50%", backgroundColor: "#fff", opacity: 0.3 + 0.7 * Math.max(0, Math.min(1, progress * 3 - k)) }} />
      ))}
    </div>
  );
};

const LyricsList: React.FC<{ lines: Caption[]; scenes: Scene[]; palette: Palette; opacity: number }> = ({ lines, scenes, palette, opacity }) => {
  const frame = useCurrentFrame();
  const { fps, unit } = useLayout();
  const g = useGeometry();
  // Số dòng mỗi câu đo bằng canvas — đo lúc font chưa về là nhớ nhầm bề rộng của font dự phòng.
  const fontReady = useFontReady("bevietnam");
  if (!fontReady || opacity <= 0 || lines.length === 0) return null;
  const { size } = g.lyrics;
  const ms = (frame / fps) * 1000;
  const rows = buildRows(lines, scenes, size, g.lyrics.w);
  const scroll = scrollAt(rows, lines, ms);
  const fade = "linear-gradient(180deg, transparent 0%, #000 7%, #000 84%, transparent 100%)";
  return (
    <div
      style={{
        position: "absolute",
        left: g.lyrics.x,
        top: g.lyrics.top,
        width: g.lyrics.w,
        height: g.lyrics.bottom - g.lyrics.top,
        overflow: "hidden",
        opacity,
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    >
      {rows.map((row, r) => {
        const y = g.lyrics.anchor - g.lyrics.top + row.y - scroll.offsetFor(r);
        if (y + row.h < -200 * unit || y > g.lyrics.bottom - g.lyrics.top + 100 * unit) return null;
        const active = scroll.activeness(r);
        const dist = Math.abs(r - scroll.focus);
        return (
          <div key={r} style={{ position: "absolute", left: 0, top: y, width: g.lyrics.w }}>
            {row.kind === "line" ? (
              <LineRow line={lines[row.index]} punch={sceneOf(scenes, lines[row.index].startMs)?.punch ?? null} ms={ms} active={active} dist={dist} size={size} maxWidth={g.lyrics.w} palette={palette} />
            ) : row.kind === "dots" ? (
              <DotsRow row={row} ms={ms} active={active} size={size} />
            ) : (
              <div style={{ height: row.h, display: "flex", alignItems: "flex-end", fontFamily: FONT, fontWeight: 800, fontSize: size * 0.34, letterSpacing: size * 0.05, color: palette.accent, opacity: 0.8 }}>
                {row.text.normalize("NFC").toLocaleUpperCase("vi")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------ trình phát */

const Player: React.FC<{ title: string; handle: string; scenes: Scene[]; palette: Palette; t: number }> = ({ title, handle, scenes, palette, t }) => {
  const { unit, width } = useLayout();
  const g = useGeometry();
  const e = easeInOut(t);
  const art = { x: lerp(g.full.x, g.mini.x, e), y: lerp(g.full.y, g.mini.y, e), s: lerp(g.full.s, g.mini.s, e) };
  const radius = lerp(g.stacked ? 28 : 22, 16, e) * unit;
  const fullAlpha = g.stacked ? Math.max(0, 1 - t * 1.8) : 0;
  // Chữ của trình phát nhỏ chỉ hiện khi ảnh bìa đã gần về góc — hiện sớm là đè lên ảnh đang co.
  const miniAlpha = g.stacked ? Math.max(0, (t - 0.75) / 0.25) : 1;
  const one = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;
  const name = title.normalize("NFC");
  return (
    <>
      <div style={{ position: "absolute", left: art.x, top: art.y }}>
        <Artwork scenes={scenes} handle={handle} palette={palette} size={art.s} radius={radius} />
      </div>
      {/* Trình phát nhỏ (khung dọc sau đoạn dạo) — ở khung ngang đây là khối chữ dưới ảnh bìa. */}
      <div style={{ position: "absolute", left: g.miniText.x, top: g.miniText.y, width: g.miniText.w, opacity: miniAlpha }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 * unit }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...one, fontFamily: FONT, fontWeight: 800, fontSize: (g.stacked ? 36 : 40) * unit, color: "#fff" }}>{name}</div>
            <div style={{ ...one, fontFamily: FONT, fontWeight: 600, fontSize: (g.stacked ? 28 : 30) * unit, color: "rgba(255,255,255,0.65)", marginTop: 4 * unit }}>{handle}</div>
          </div>
          {g.stacked ? null : <PlayingBars size={30 * unit} color="rgba(255,255,255,0.8)" />}
        </div>
      </div>
      {g.stacked ? (
        <div style={{ position: "absolute", left: width - g.side - 40 * unit, top: g.mini.y + 30 * unit, opacity: miniAlpha }}>
          <PlayingBars size={36 * unit} color="rgba(255,255,255,0.8)" />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: g.progress.x, top: g.progress.y, opacity: miniAlpha }}>
        <Progress width={g.progress.w} unit={unit} fontSize={22 * unit} />
      </div>
      {/* Màn "Đang phát" cỡ lớn trong đoạn dạo đầu (chỉ khung dọc). */}
      {fullAlpha > 0 ? (
        <div style={{ position: "absolute", left: g.full.x, top: g.full.y + g.full.s + 56 * unit, width: g.full.s, opacity: fullAlpha }}>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 56 * unit, lineHeight: 1.25, color: "#fff" }}>{name}</div>
          <div style={{ ...one, fontFamily: FONT, fontWeight: 600, fontSize: 34 * unit, color: "rgba(255,255,255,0.7)", marginTop: 8 * unit }}>{handle}</div>
          <div style={{ marginTop: 40 * unit }}>
            <Progress width={g.full.s} unit={unit} fontSize={24 * unit} />
          </div>
          <div style={{ marginTop: 44 * unit }}>
            <Controls size={64 * unit} />
          </div>
        </div>
      ) : null}
    </>
  );
};

/** Số liệu / nhãn của cảnh: viên nhỏ ở góc phải, ngay trên vùng lời. */
const StatChip: React.FC<{ scenes: Scene[]; palette: Palette; opacity: number }> = ({ scenes, palette, opacity }) => {
  const frame = useCurrentFrame();
  const { unit, width } = useLayout();
  const g = useGeometry();
  const scene = scenes[activeIndexAt(scenes, frame)];
  if (!scene?.visual || opacity <= 0) return null;
  const start = msToFrames(scene.startMs);
  const t = interpolate(frame, [start + 4, start + 16], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        right: width - g.lyrics.x - g.lyrics.w,
        top: g.lyrics.top - 56 * unit,
        opacity: opacity * t,
        display: "flex",
        alignItems: "baseline",
        gap: 10 * unit,
        padding: `${6 * unit}px ${18 * unit}px`,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.14)",
        border: `${1.5 * unit}px solid rgba(255,255,255,0.22)`,
      }}
    >
      <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 32 * unit, color: palette.accent }}>{scene.visual.text}</span>
      {scene.visual.caption ? <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22 * unit, color: "rgba(255,255,255,0.8)" }}>{scene.visual.caption}</span> : null}
    </div>
  );
};

const Body: React.FC<ShortProps> = ({ title, handle, accent, captions, scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useLayout();
  const g = useGeometry();
  const palette = paletteFor(accent);
  const lines = mainLines(captions);
  // Khung dọc: đoạn dạo đầu là màn "Đang phát" lớn, ảnh bìa thu về góc trên trong 20 frame cuối.
  const introEnd = g.stacked ? introEndFrame(lines, showTitle, fps, 900) : 0;
  const t = introEnd > 20 ? interpolate(frame, [introEnd - 20, introEnd], [0, 1], clamp) : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.base }}>
      <Backdrop scenes={scenes} palette={palette} />
      <LyricsList lines={lines} scenes={scenes} palette={palette} opacity={t} />
      <StatChip scenes={scenes} palette={palette} opacity={t} />
      <Player title={title} handle={handle} scenes={scenes} palette={palette} t={t} />
    </AbsoluteFill>
  );
};

export const LyricsStyle: React.FC<ShortProps> = (props) => {
  ensureFonts(LYRICS_FONTS);
  return (
    <MusicLevels props={props}>
      <Body {...props} />
    </MusicLevels>
  );
};
