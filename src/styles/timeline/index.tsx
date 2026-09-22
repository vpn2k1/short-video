/**
 * Phong cách "Dòng thời gian" — xem skill `.claude/skills/style-timeline/SKILL.md`.
 *
 * Mỗi cảnh là một mốc trên trục thời gian; `tag` là năm ghi lớn cạnh mốc. Camera cuộn dọc trục tới mốc đang
 * đọc, mốc cũ trôi đi nhưng vẫn giữ năm (mờ), vạch màu nhấn chạy dài theo tiến độ. Ảnh của cảnh nằm trong
 * thẻ gắn vào mốc, lời đọc ngay dưới/cạnh ảnh.
 *
 * Bố cục:
 *  - Dọc: trục dọc sát lề trái, mốc đang xem ở 1/5 trên; thẻ bên phải trục — ảnh trên, chữ dưới.
 *  - Ngang/vuông: trục ngang phía trên, năm nằm trên mốc; thẻ rộng bên dưới — ảnh trái, chữ phải.
 *
 * Thứ tự lớp: nền giấy kẻ ô → trục + mốc + năm → gạch nối → thẻ (cũ ra, mới vào) → trang tiêu đề.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { activeIndexAt, Grain, useLayout } from "../shared";
import { Axis, type AxisGeometry } from "./Axis";
import { MilestoneCard, type CardLayout, type CardLine } from "./Card";
import {
  alpha,
  captionsByScene,
  clamp,
  estimateLines,
  nodeLabel,
  punchFrame,
  ramp,
  SCROLL,
  scrollPosition,
  themeFor,
} from "./theme";
import { TitleIntro } from "./TitleIntro";

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

export const TimelineStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  background,
  captions,
  scenes: rawScenes,
  showTitle,
}) => {
  ensureFonts(["montserrat", "lora", "bevietnam"]);
  const frame = useCurrentFrame();
  const { width, height, safe, unit } = useLayout();
  const theme = themeFor(background);
  const vertical = height > width;
  const scenes = rawScenes.length > 0 ? rawScenes : [FALLBACK_SCENE];
  const labels = scenes.map(nodeLabel);
  const starts = scenes.map((s) => msToFrames(s.startMs));

  // Nhịp mở đầu: có trang tiêu đề thì trục vẽ dần, mốc và thẻ vào lúc tiêu đề trôi đi.
  const contentStart = showTitle ? TITLE_FRAMES - 14 : 0;
  const contentIn = showTitle ? ramp(frame, contentStart, 16) : 1;
  const drawIn = showTitle ? ramp(frame, 0, 30, SCROLL) : 1;
  const hideCaptionsBefore = showTitle ? TITLE_FRAMES - 10 : 0;

  // ---------------------------------------------------------------- hình học
  const geo: AxisGeometry = vertical
    ? {
        vertical: true,
        line: Math.max(safe.side * 0.72, 60 * unit),
        anchor: safe.top + 250 * unit,
        spacing: 170 * unit,
        length: height,
      }
    : (() => {
        const spacing = Math.min(340 * unit, width * 0.2);
        return { vertical: false, line: safe.top + 170 * unit, anchor: safe.side + spacing * 0.95 + 20 * unit, spacing, length: width };
      })();

  const rect = vertical
    ? (() => {
        const x = geo.line + 54 * unit;
        const y = geo.anchor + 84 * unit;
        return { x, y, w: width - safe.side - x, h: height - safe.bottom - y };
      })()
    : (() => {
        const y = geo.line + 64 * unit;
        return { x: safe.side, y, w: width - safe.side * 2, h: height - safe.bottom - y };
      })();

  const pad = (vertical ? 22 : 24) * unit;
  const gap = (vertical ? 24 : 40) * unit;
  const eyebrowFont = 26 * unit;
  const eyebrowH = eyebrowFont * 1.2 + 14 * unit;
  // Khung gần vuông: ảnh nhường chỗ cho cột chữ để lời đọc không bị bé.
  const mediaRow = Math.min((rect.h - pad * 2) * 1.45, (rect.w - pad * 2) * (width / height < 1.4 ? 0.46 : 0.56));
  const textW = vertical ? rect.w - pad * 2 : rect.w - pad * 2 - gap - mediaRow;

  // Lời đọc: cỡ chữ lớn nhất sao cho câu dài nhất không quá số dòng cho phép. Không có phụ đề (kiểu phụ đề
  // tuỳ chỉnh đang bật) thì thẻ hiện câu nhấn thay lời.
  const byScene = captionsByScene(captions, scenes);
  const texts = captions.length > 0 ? captions.map((c) => c.text) : scenes.flatMap((s) => (s.punch ? [s.punch.text] : []));
  const statRoom = !vertical && scenes.some((s) => s.visual?.type === "stat" && s.image) ? 210 * unit : 0;
  const captionBase = vertical ? 50 * unit : Math.max(38 * unit, Math.min(60 * unit, textW / 10));
  const maxLines = vertical ? 4 : Math.max(3, Math.floor((rect.h - pad * 2 - eyebrowH - statRoom) / (captionBase * 1.32)));
  const longest = (size: number) => texts.reduce((m, t) => Math.max(m, estimateLines(t, size, textW, 0.53)), 0);
  let captionFont = captionBase;
  while (captionFont > 32 * unit && longest(captionFont) > maxLines) captionFont *= 0.94;
  const lines = texts.length > 0 ? Math.min(6, longest(captionFont)) : 0;
  const textH = eyebrowH + lines * captionFont * 1.32 + 6 * unit;

  const layout: CardLayout = {
    mode: vertical ? "stack" : "row",
    rect,
    pad,
    gap,
    media: vertical ? rect.h - pad * 2 - gap - textH : mediaRow,
    captionFont,
    eyebrowFont,
  };

  // ---------------------------------------------------------------- thời gian
  const p = scrollPosition(frame, starts);
  const active = Math.max(0, activeIndexAt(scenes, frame));
  const enterOf = (i: number) => (i === 0 ? Math.max(starts[0], contentStart) : starts[i]);
  const endOf = (i: number) => (i + 1 < scenes.length ? starts[i + 1] : Math.max(starts[i] + 1, msToFrames(scenes[i].endMs)));
  const progress = interpolate(frame, [enterOf(active), Math.max(enterOf(active) + 1, endOf(active))], [0, 1], clamp);
  // Vạch màu nhấn chạy tới mốc sau đúng lúc hết cảnh; cảnh cuối chỉ chạy quá một đoạn ngắn.
  const fill = active + progress * (active === scenes.length - 1 ? 0.6 : 1);
  const sparks = scenes.map((s, i) => punchFrame(s, enterOf(i)));

  const lineFor = (i: number): CardLine => {
    let line: CardLine = null;
    for (const c of byScene[i]) {
      const start = msToFrames(c.startMs);
      if (start <= frame && frame >= hideCaptionsBefore) line = { text: c.text, start: Math.max(start, hideCaptionsBefore) };
    }
    if (captions.length === 0 && scenes[i].punch && sparks[i] !== null && frame >= (sparks[i] as number)) {
      line = { text: scenes[i].punch!.text, start: sparks[i] as number };
    }
    return line;
  };

  // Lưới nền trôi chậm hơn trục một chút — cảm giác chiều sâu khi cuộn.
  const gridSize = 64 * unit;
  const drift = -p * geo.spacing * 0.35;

  const ranged = scenes.filter((s) => s.tag?.trim());
  const range =
    ranged.length >= 2 && ranged[0].tag!.trim() !== ranged[ranged.length - 1].tag!.trim()
      ? `${ranged[0].tag!.trim()} — ${ranged[ranged.length - 1].tag!.trim()}`
      : null;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.grid} ${Math.max(1, unit)}px, transparent ${Math.max(1, unit)}px), linear-gradient(90deg, ${theme.grid} ${Math.max(1, unit)}px, transparent ${Math.max(1, unit)}px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: vertical ? `0 ${drift}px` : `${drift}px 0`,
        }}
      />
      <AbsoluteFill
        style={{
          background: theme.dark
            ? `radial-gradient(ellipse at 70% 30%, ${alpha(accent, 0.1)} 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.35) 100%)`
            : `radial-gradient(ellipse at 70% 30%, ${alpha(accent, 0.07)} 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(120,90,50,0.14) 100%)`,
        }}
      />

      <Axis
        geo={geo}
        labels={labels}
        p={p}
        fill={fill}
        drawIn={drawIn}
        contentIn={contentIn}
        sparks={sparks}
        frame={frame}
        unit={unit}
        bigBase={(vertical ? 124 : 92) * unit}
        bigMax={vertical ? width - safe.side * 0.6 - geo.line - 40 * unit : width - safe.side - geo.anchor}
        smallBase={(vertical ? 46 : 40) * unit}
        smallMax={vertical ? width - safe.side - geo.line - 40 * unit : geo.spacing - 40 * unit}
        accent={accent}
        theme={theme}
      />

      {/* Gạch nối mốc đang xem với thẻ. */}
      <div
        style={{
          position: "absolute",
          backgroundColor: accent,
          borderRadius: 3 * unit,
          opacity: contentIn,
          ...(vertical
            ? { left: geo.line + 12 * unit, top: rect.y + 64 * unit, width: rect.x - geo.line - 12 * unit, height: 4 * unit }
            : { left: geo.anchor - 2 * unit, top: geo.line + 22 * unit, width: 4 * unit, height: rect.y - geo.line - 22 * unit }),
        }}
      />

      {scenes.map((scene, i) => {
        const d = i - p;
        if (Math.abs(d) >= 1) return null;
        // Thẻ cũ tắt trong nửa đầu cú cuộn, thẻ mới hiện trong nửa sau — hai thẻ không bao giờ chồng mờ lên nhau.
        const out = interpolate(d, [-0.45, -0.05], [0, 1], clamp);
        const inn = interpolate(d, [0, 0.5], [1, 0], clamp);
        const offset = d * (vertical ? 260 : 320) * unit + (1 - contentIn) * 60 * unit;
        return (
          <MilestoneCard
            key={i}
            scene={scene}
            index={i}
            total={scenes.length}
            label={labels[i]}
            layout={layout}
            line={lineFor(i)}
            punchAt={sparks[i]}
            start={starts[i]}
            duration={endOf(i) - starts[i]}
            frame={frame}
            unit={unit}
            accent={accent}
            theme={theme}
            style={{
              opacity: Math.min(out, inn) * contentIn,
              translate: vertical ? `0 ${offset}px` : `${offset}px 0`,
              scale: String(1 - 0.05 * Math.abs(d)),
            }}
          />
        );
      })}

      {showTitle && frame < TITLE_FRAMES ? (
        <TitleIntro
          title={title}
          subtitle={subtitle}
          handle={handle}
          range={range}
          vertical={vertical}
          node={vertical ? { x: geo.line, y: 0 } : { x: geo.anchor, y: geo.line }}
          block={
            vertical
              ? { x: geo.line + 60 * unit, y: safe.top + 80 * unit, w: width - safe.side - geo.line - 60 * unit, h: height - safe.bottom - safe.top - 80 * unit }
              : { x: geo.anchor - 14 * unit, y: geo.line + 70 * unit, w: width - safe.side - geo.anchor, h: height - safe.bottom - geo.line - 70 * unit }
          }
          frame={frame}
          unit={unit}
          accent={accent}
          theme={theme}
        />
      ) : null}

      <Grain opacity={theme.dark ? 0.08 : 0.1} animated={false} />
    </AbsoluteFill>
  );
};
