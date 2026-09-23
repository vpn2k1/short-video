/**
 * Phong cách "Bảng trắng": trang sổ tay, chữ bút dạ viết dần, gạch chân và khoanh
 * tròn vẽ tay. Mỗi cảnh là một trang giấy; sang cảnh mới thì trang mới trượt đè
 * lên như lật vở. Xem skill `.claude/skills/style-whiteboard/SKILL.md`.
 *
 * Thứ tự lớp: các trang (giấy → nhãn → ảnh/hình vẽ → chữ) → trang tiêu đề → nhiễu giấy.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { activeIndexAt, Grain, useLayout } from "../shared";
import { PaperSheet, type SheetLayout } from "./paper";
import { PunchNote, Polaroid, StatNote, StickyNote, TagBox } from "./pieces";
import { estimateLines, HAND, INK, PENCIL, roughLine, textWidth, TURN_FRAMES } from "./sketch";
import { DrawnPath, findPunch, punchEndFraction, WrittenText } from "./written";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const TURN = Easing.bezier(0.7, 0, 0.3, 1);

/** Không có cảnh nào → coi cả video là một trang trống. */
const FALLBACK_SCENE: Scene = {
  image: null,
  visual: null,
  tag: null,
  punch: null,
  trimStartMs: 0,
  volume: 0,
  crop: null,
  ...noMotion(),
  startMs: 0,
  endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };

type PageLayout = SheetLayout & {
  textLeft: number;
  contentRight: number;
  headerTop: number;
  media: Rect;
  captionWithMedia: Rect;
  captionAlone: Rect;
};

/** Dọc (9:16, 3:4) xếp ảnh trên chữ dưới; vuông/ngang chia hai cột chữ trái, ảnh phải. */
const usePageLayout = (): PageLayout => {
  const { width, height, safe, unit } = useLayout();
  const stacked = height / width >= 1.2;
  const marginX = Math.round(safe.side * 0.75);
  const textLeft = safe.side + 16 * unit;
  const contentRight = width - safe.side;
  const headerTop = safe.top + 10 * unit;
  const bodyTop = headerTop + 130 * unit;
  const bodyBottom = height - safe.bottom;
  const bodyH = bodyBottom - bodyTop;
  const fullW = contentRight - textLeft;
  const captionAlone = { x: textLeft, y: bodyTop, w: fullW, h: bodyH };
  if (stacked) {
    const mediaH = bodyH * 0.55;
    const gap = 28 * unit;
    return {
      width, height, unit, marginX, stacked, safe, textLeft, contentRight, headerTop,
      media: { x: textLeft, y: bodyTop, w: fullW, h: mediaH },
      captionWithMedia: { x: textLeft, y: bodyTop + mediaH + gap, w: fullW, h: bodyH - mediaH - gap },
      captionAlone,
    };
  }
  // Khung gần vuông thì cột chữ rộng hơn một chút, kẻo chữ phải co quá nhỏ.
  const split = textLeft + fullW * (width / height < 1.3 ? 0.58 : 0.52);
  const gap = 40 * unit;
  return {
    width, height, unit, marginX, stacked, safe, textLeft, contentRight, headerTop,
    media: { x: split + gap / 2, y: bodyTop, w: contentRight - split - gap / 2, h: bodyH },
    captionWithMedia: { x: textLeft, y: bodyTop, w: split - textLeft - gap / 2, h: bodyH },
    captionAlone,
  };
};

// ---------------------------------------------------------------------------
// Khối phụ đề của một trang
// ---------------------------------------------------------------------------
const CaptionBlock: React.FC<{
  captions: Caption[];
  zone: Rect;
  top: boolean;
  large: boolean;
  frame: number;
  unit: number;
  punch: Scene["punch"];
  accent: string;
  seed: string;
}> = ({ captions, zone, top, large, frame, unit, punch, accent, seed }) => {
  const active = activeIndexAt(captions, frame);
  if (active < 0) return null;
  const current = captions[active];
  const previous = active > 0 ? captions[active - 1] : null;
  const lineHeight = 1.3;

  // Cỡ chữ: câu ngắn to, câu dài nhỏ dần; rồi co tiếp tới khi vừa chiều cao vùng.
  // Trang không có ảnh/hình vẽ thì chữ là nhân vật chính → to hơn.
  const base = (large ? 96 : 80) * unit * Math.min(1, Math.sqrt(zone.w / 840));
  // Cỡ lớn nhất mà khối chữ (đã tự xuống dòng) chiếm tối đa 62% chiều cao vùng —
  // phần còn lại dành cho câu trước mờ phía trên.
  const heightOf = (text: string, size: number) => estimateLines(text, size, zone.w) * size * lineHeight;
  let fontSize = base;
  while (heightOf(current.text, fontSize) > zone.h * 0.62 && fontSize > 22 * unit) fontSize *= 0.94;

  const prevSize = Math.min(fontSize * 0.6, 44 * unit);
  const gap = 20 * unit;
  const showPrevious =
    previous !== null && heightOf(current.text, fontSize) + heightOf(previous.text, prevSize) + gap <= zone.h * 0.95;

  const start = msToFrames(current.startMs);
  const duration = Math.max(1, msToFrames(current.endMs) - start);
  const writeEnd = start + Math.max(6, Math.round(duration * 0.6));

  // Câu chứa cụm nhấn: nét viết chạy tới hết cụm đúng lúc giọng đọc tới nó, rồi
  // viết nốt phần còn lại — gạch chân không bao giờ vẽ trước khi chữ hiện ra.
  const punchAt = punch ? msToFrames(punch.atMs) : -1;
  const fraction = punch ? punchEndFraction(current.text, punch.text) : null;
  let progress: number;
  if (fraction !== null && punchAt > start && punchAt < writeEnd + duration) {
    const reachAt = Math.max(start + 2, punchAt);
    const finishAt = Math.max(writeEnd, reachAt + 4);
    progress = interpolate(frame, [start, reachAt, finishAt], [0, fraction, 1], clamp);
  } else {
    progress = interpolate(frame, [start, writeEnd], [0, 1], clamp);
  }

  const punchFor = (text: string) => {
    if (!punch || !findPunch(text, punch.text)) return null;
    const at = msToFrames(punch.atMs);
    return {
      text: punch.text,
      accent,
      colorT: interpolate(frame, [at, at + 6], [0, 1], clamp),
      draw: interpolate(frame, [at + 2, at + 18], [0, 1], clamp),
    };
  };

  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        height: zone.h,
        display: "flex",
        flexDirection: "column",
        justifyContent: top ? "flex-start" : "center",
        gap,
      }}
    >
      {showPrevious && previous ? (
        <div style={{ opacity: interpolate(frame, [start, start + 8], [0.85, 0.4], clamp) }}>
          <WrittenText
            text={previous.text}
            fontSize={prevSize}
            progress={1}
            maxWidth={zone.w}
            color={PENCIL}
            seed={`${seed}-c${active - 1}`}
            punch={punchFor(previous.text)}
          />
        </div>
      ) : null}
      <WrittenText
        // key đổi theo câu để React không giữ lại trạng thái style của câu trước.
        key={`cap-${active}`}
        text={current.text}
        fontSize={fontSize}
        lineHeight={lineHeight}
        progress={progress}
        maxWidth={zone.w}
        seed={`${seed}-c${active}`}
        punch={punchFor(current.text)}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Một trang = một cảnh
// ---------------------------------------------------------------------------
const Page: React.FC<{
  scene: Scene;
  index: number;
  count: number;
  captions: Caption[];
  appear: number;
  frame: number;
  layout: PageLayout;
  accent: string;
}> = ({ scene, index, count, captions, appear, frame, layout, accent }) => {
  const { unit, media: m } = layout;
  const seed = `wb-page-${index}`;
  const punchInText = scene.punch ? captions.some((c) => findPunch(c.text, scene.punch!.text)) : true;
  const fallbackPunch = scene.punch && !punchInText && !scene.visual ? scene.punch : null;
  const hasImage = Boolean(scene.image);
  const hasVisual = Boolean(scene.visual) || fallbackPunch !== null;
  const hasMedia = hasImage || hasVisual;
  const both = hasImage && hasVisual;

  // Vị trí ảnh và hình vẽ trong vùng media.
  const photoW = both
    ? Math.min((m.w * 0.64) / 1.07, (m.h * 0.78) / 0.98)
    : Math.min((m.w * 0.9) / 1.07, (m.h * 0.92) / 0.98);
  const photoCenter = both ? { x: m.x + m.w * 0.4, y: m.y + m.h * 0.42 } : { x: m.x + m.w / 2, y: m.y + m.h / 2 };
  const visualCenter = both ? { x: m.x + m.w * 0.72, y: m.y + m.h * 0.74 } : { x: m.x + m.w / 2, y: m.y + m.h / 2 };
  const stickySize = both ? Math.min(m.w, m.h) * 0.4 : Math.min(m.w, m.h) * 0.62;
  const statW = both ? m.w * 0.5 : m.w * 0.9;
  const statH = both ? m.h * 0.38 : m.h * 0.7;

  return (
    <AbsoluteFill>
      <PaperSheet seed={seed} layout={layout} />

      {scene.tag ? (
        <TagBox
          text={scene.tag}
          x={layout.textLeft}
          y={layout.headerTop}
          unit={unit}
          maxWidth={(layout.contentRight - layout.textLeft) * 0.7}
          appear={appear}
          frame={frame}
          accent={accent}
          seed={seed}
        />
      ) : null}

      {count > 1 ? (
        <div
          style={{
            position: "absolute",
            right: layout.width - layout.contentRight,
            top: layout.headerTop + 14 * unit,
            fontFamily: HAND,
            fontSize: 44 * unit,
            color: PENCIL,
            rotate: "4deg",
            opacity: interpolate(frame, [appear + 4, appear + 14], [0, 1], clamp),
          }}
        >
          {index + 1}/{count}
        </div>
      ) : null}

      {scene.image ? (
        <Polaroid
          src={scene.image}
          trimStartMs={scene.trimStartMs} speed={scene.speed}
          volume={scene.volume}
          crop={scene.crop}
          photoW={photoW}
          cx={photoCenter.x}
          cy={photoCenter.y}
          unit={unit}
          appear={appear + 4}
          frame={frame}
          seed={seed}
        />
      ) : null}

      {scene.visual?.type === "badge" ? (
        <StickyNote
          text={scene.visual.text}
          caption={scene.visual.caption}
          cx={visualCenter.x}
          cy={visualCenter.y}
          size={stickySize}
          unit={unit}
          appear={appear + (hasImage ? 16 : 6)}
          frame={frame}
          seed={seed}
        />
      ) : null}

      {scene.visual?.type === "stat" ? (
        <StatNote
          text={scene.visual.text}
          caption={scene.visual.caption}
          cx={visualCenter.x}
          cy={visualCenter.y}
          boxW={statW}
          boxH={statH}
          unit={unit}
          appear={appear + (hasImage ? 16 : 6)}
          frame={frame}
          accent={accent}
          seed={seed}
          card={hasImage}
        />
      ) : null}

      {fallbackPunch ? (
        <PunchNote
          text={fallbackPunch.text}
          cx={visualCenter.x}
          cy={visualCenter.y}
          maxWidth={both ? m.w * 0.55 : m.w * 0.9}
          unit={unit}
          atFrame={Math.max(appear, msToFrames(fallbackPunch.atMs))}
          frame={frame}
          accent={accent}
          seed={seed}
        />
      ) : null}

      <CaptionBlock
        captions={captions}
        zone={hasMedia ? layout.captionWithMedia : layout.captionAlone}
        top={hasMedia && layout.stacked}
        large={!hasMedia}
        frame={frame}
        unit={unit}
        punch={scene.punch}
        accent={accent}
        seed={seed}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Trang tiêu đề
// ---------------------------------------------------------------------------
const TitlePage: React.FC<{
  title: string;
  subtitle: string;
  accent: string;
  frame: number;
  layout: PageLayout;
}> = ({ title, subtitle, accent, frame, layout }) => {
  const { width, unit, safe, stacked } = layout;
  const maxWidth = width - safe.side * 2 - 60 * unit;
  let fontSize = (stacked ? 116 : 104) * unit;
  while (estimateLines(title, fontSize, maxWidth) > 3 && fontSize > 44 * unit) fontSize *= 0.9;
  const underlineW = Math.min(textWidth(title, fontSize), maxWidth) * 0.92;
  const underlineH = 54 * unit;
  const subtitleSize = Math.min(fontSize * 0.46, 58 * unit);
  const exit = interpolate(frame, [TITLE_FRAMES, TITLE_FRAMES + TURN_FRAMES], [0, 1], { ...clamp, easing: TURN });

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${(-exit * width * 1.1).toFixed(1)}px) rotate(${(-exit * 3).toFixed(2)}deg)`,
        transformOrigin: "100% 100%",
        boxShadow: exit > 0 ? `${30 * unit}px 0 ${60 * unit}px rgba(30, 25, 15, 0.35)` : undefined,
      }}
    >
      <PaperSheet seed="wb-title" layout={layout} />
      <AbsoluteFill
        style={{
          top: safe.top,
          bottom: safe.bottom,
          left: safe.side,
          right: safe.side,
          width: "auto",
          height: "auto",
          alignItems: "center",
          justifyContent: "center",
          gap: 10 * unit,
        }}
      >
        <WrittenText
          text={title}
          fontSize={fontSize}
          lineHeight={1.2}
          align="center"
          progress={interpolate(frame, [4, 34], [0, 1], clamp)}
          maxWidth={maxWidth}
          seed="wb-title"
        />
        <svg width={underlineW} height={underlineH} style={{ overflow: "visible" }}>
          <DrawnPath
            d={roughLine(0, underlineW, underlineH * 0.3, "wb-title-u1", 5 * unit)}
            progress={interpolate(frame, [30, 42], [0, 1], clamp)}
            color={accent}
            width={8 * unit}
          />
          <DrawnPath
            d={roughLine(underlineW * 0.06, underlineW * 0.97, underlineH * 0.72, "wb-title-u2", 5 * unit)}
            progress={interpolate(frame, [38, 50], [0, 1], clamp)}
            color={accent}
            width={6 * unit}
          />
        </svg>
        {subtitle ? (
          <WrittenText
            text={subtitle}
            fontSize={subtitleSize}
            align="center"
            color="#4a5168"
            progress={interpolate(frame, [44, 62], [0, 1], clamp)}
            maxWidth={maxWidth}
            seed="wb-subtitle"
          />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
export const WhiteboardStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  showTitle,
}) => {
  const frame = useCurrentFrame();
  const layout = usePageLayout();
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  // Mỗi câu thuộc trang đang mở lúc câu bắt đầu.
  const pageOf = captions.map((c) => Math.max(0, activeIndexAt(pages, msToFrames(c.startMs))));

  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      {pages.map((scene, index) => {
        const start = index === 0 ? 0 : msToFrames(scene.startMs);
        const nextStart = index < pages.length - 1 ? msToFrames(pages[index + 1].startMs) : Infinity;
        // Trang sau đã phủ kín thì bỏ trang này khỏi cây render.
        if (frame < start || frame >= nextStart + TURN_FRAMES) return null;

        const slideIn =
          index === 0 ? 1 : interpolate(frame, [start, start + TURN_FRAMES], [0, 1], { ...clamp, easing: TURN });
        const slideOut =
          nextStart === Infinity
            ? 0
            : interpolate(frame, [nextStart, nextStart + TURN_FRAMES], [0, 1], { ...clamp, easing: TURN });
        // Trang đầu có title card phủ lên thì chỉ bắt đầu diễn khi title lật đi.
        const appear = index === 0 && showTitle ? Math.max(start, TITLE_FRAMES) : start;

        return (
          <AbsoluteFill
            key={`page-${index}`}
            style={{
              transform: `translateX(${((1 - slideIn) * layout.width * 1.06 - slideOut * layout.width * 0.12).toFixed(1)}px) rotate(${((1 - slideIn) * 2.5).toFixed(2)}deg)`,
              transformOrigin: "0% 100%",
              boxShadow: slideIn < 1 ? `${-24 * layout.unit}px 0 ${60 * layout.unit}px rgba(30, 25, 15, 0.35)` : undefined,
            }}
          >
            <Page
              scene={scene}
              index={index}
              count={pages.length}
              captions={captions.filter((_, i) => pageOf[i] === index)}
              appear={appear}
              frame={frame}
              layout={layout}
              accent={accent}
            />
            {slideOut > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(30, 25, 15, ${(slideOut * 0.2).toFixed(3)})` }} /> : null}
          </AbsoluteFill>
        );
      })}

      {showTitle && frame < TITLE_FRAMES + TURN_FRAMES ? (
        <TitlePage title={title} subtitle={subtitle} accent={accent} frame={frame} layout={layout} />
      ) : null}

      <Grain opacity={0.06} animated={false} baseFrequency={0.75} />
    </AbsoluteFill>
  );
};
