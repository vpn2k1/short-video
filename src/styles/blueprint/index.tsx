/**
 * Phong cách "Bản vẽ kỹ thuật" — xem skill `.claude/skills/style-blueprint/SKILL.md`.
 *
 * Tờ giấy can xanh có lưới, nếp gấp, khung viền chia ô và khung tên ở góc dưới phải. Mỗi cảnh là một "tờ" của bản vẽ:
 * ảnh/clip đặt như ảnh tham chiếu trong khung nét trắng (đổi sang tông xanh–trắng), dấu canh góc, đường kích thước tự
 * vẽ; phụ đề là mục GHI CHÚ đánh số gõ ra từng dòng; `tag` là ký hiệu mặt cắt; `punch` được khoanh đám mây sửa đổi màu
 * cam an toàn; số liệu là đường kích thước lớn |←— 120 m —→|. Cảnh không ảnh → sơ đồ kỹ thuật vẽ bằng nét SVG.
 * Sang cảnh: một vạch quét dọc lướt qua tờ giấy, xoá bản cũ và để lộ bản mới đang được vẽ lại.
 *  - Dọc / vuông: ký hiệu mặt cắt → khung ảnh → số liệu → ghi chú → khung tên.
 *  - Ngang (≥ 1.3): khung ảnh cột trái; cột phải là số liệu, ghi chú, khung tên.
 *
 * Thứ tự lớp: giấy → khung viền → cảnh cũ (lúc quét) → cảnh mới → màn tiêu đề → khung tên → vạch quét → nhiễu giấy.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { activeIndexAt, Grain, useLayout } from "../shared";
import { DetailBadge, ReferenceFrame, SectionTag, StatDimension, Stroke, type Box } from "./Drawing";
import { NotesBlock, type NoteItem } from "./Notes";
import { BlueprintPaper, DrawingBorder, ScaleBar, TitleBlock } from "./Sheet";
import { accentOn, C, clamp, EASE_IN_OUT, fitSize, LABEL, MONO, NOTE, ramp, upper } from "./theme";
import { useVt } from "../../i18n/video";

/** Số frame vạch quét lướt qua tờ giấy khi sang cảnh. */
const WIPE = 16;

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Layout = {
  wide: boolean;
  inset: number;
  tag: { x: number; y: number; w: number };
  frame: Box;
  visual: Box;
  notes: Box;
  notesNoVisual: Box;
  titleBlock: Box;
  scale: { x: number; y: number; w: number } | null;
  noteSize: number;
};

const useSheetLayout = (): Layout => {
  const { width, height, safe, unit } = useLayout();
  const wide = width / height >= 1.3;
  const inset = 40 * unit;
  const tbRight = width - Math.max(inset + 16 * unit, safe.side * 0.55);
  const tbBottom = height - Math.max(inset + 16 * unit, safe.bottom * 0.5);
  const visualH = 170 * unit;
  if (wide) {
    const side = safe.side + 10 * unit;
    const frameTop = safe.top + 150 * unit;
    const frameH = height - Math.max(inset + 16 * unit, safe.bottom) - 44 * unit - frameTop;
    const frameW = Math.min(frameH * 1.3, width * 0.5);
    const colX = side + frameW + 44 * unit + 70 * unit;
    const colW = tbRight - colX;
    const tbH = 150 * unit;
    const titleBlock = { x: colX, y: tbBottom - tbH, w: colW, h: tbH };
    const colTop = safe.top + 10 * unit;
    const notesBottom = titleBlock.y - 36 * unit;
    return {
      wide,
      inset,
      tag: { x: side - 4 * unit, y: safe.top, w: frameW },
      frame: { x: side, y: frameTop, w: frameW, h: frameH },
      visual: { x: colX, y: colTop, w: colW, h: visualH },
      notes: { x: colX, y: colTop + visualH + 30 * unit, w: colW, h: notesBottom - colTop - visualH - 30 * unit },
      notesNoVisual: { x: colX, y: colTop + 20 * unit, w: colW, h: notesBottom - colTop - 20 * unit },
      titleBlock,
      scale: null,
      noteSize: 42 * unit,
    };
  }
  const side = Math.max(70 * unit, safe.side * 0.7);
  const square = height / width < 1.2;
  const tbH = (square ? 124 : 150) * unit;
  const tbW = Math.min(width - side * 2, (square ? 560 : 640) * unit);
  const titleBlock = { x: tbRight - tbW, y: tbBottom - tbH, w: tbW, h: tbH };
  const frameTop = safe.top + 150 * unit;
  const avail = titleBlock.y - 30 * unit - frameTop;
  const frameH = avail * (square ? 0.48 : 0.54);
  const frame = { x: side, y: frameTop, w: width - side * 2 - 44 * unit, h: frameH };
  const below = frame.y + frame.h + 62 * unit;
  const notesBottom = titleBlock.y - 30 * unit;
  const vh = square ? visualH * 0.8 : visualH;
  const scaleW = Math.min(titleBlock.x - side - 40 * unit, 250 * unit);
  return {
    wide,
    inset,
    tag: { x: side - 4 * unit, y: safe.top - 6 * unit, w: width - side * 2 },
    frame,
    visual: { x: side, y: below, w: width - side * 2, h: vh },
    notes: { x: side, y: below + vh + 22 * unit, w: width - side * 2, h: notesBottom - below - vh - 22 * unit },
    notesNoVisual: { x: side, y: below, w: width - side * 2, h: notesBottom - below },
    titleBlock,
    scale: scaleW >= 120 * unit ? { x: side, y: titleBlock.y + titleBlock.h - 58 * unit, w: scaleW } : null,
    noteSize: (square ? 38 : 48) * unit,
  };
};

/** Một "tờ" của bản vẽ = một cảnh: khung ảnh, ký hiệu mặt cắt, số liệu, ghi chú. */
const SheetScene: React.FC<{
  scene: Scene;
  index: number;
  appear: number;
  items: NoteItem[];
  layout: Layout;
  accent: string;
}> = ({ scene, index, appear, items, layout, accent }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const local = frame - appear;
  const letter = String.fromCharCode(65 + (index % 26));
  const visual = scene.visual;
  const visualT = interpolate(local, [18, 44], [0, 1], clamp);
  const notesBox = visual ? layout.notes : layout.notesNoVisual;
  return (
    <AbsoluteFill>
      {scene.tag ? (
        <SectionTag
          x={layout.tag.x}
          y={layout.tag.y}
          maxW={layout.tag.w}
          tag={scene.tag}
          letter={letter}
          sheet={index + 1}
          t={interpolate(local, [4, 28], [0, 1], clamp)}
          unit={unit}
          accent={accent}
        />
      ) : null}
      <ReferenceFrame
        scene={scene}
        index={index}
        box={layout.frame}
        local={local}
        appear={appear}
        unit={unit}
        width={width}
        height={height}
        balloons={items.map((it) => it.start)}
        frame={frame}
      />
      {visual?.type === "stat" ? (
        <StatDimension box={layout.visual} text={visual.text} caption={visual.caption} t={visualT} unit={unit} accent={accent} />
      ) : null}
      {visual?.type === "badge" ? (
        <DetailBadge box={layout.visual} text={visual.text} caption={visual.caption} t={visualT} unit={unit} accent={accent} />
      ) : null}
      <NotesBlock
        items={items}
        box={notesBox}
        frame={frame}
        unit={unit}
        base={layout.noteSize}
        accent={accent}
        punch={scene.punch ? { text: scene.punch.text, at: msToFrames(scene.punch.atMs) } : null}
        sceneIndex={index}
        opacity={ramp(frame, appear + 6, 8)}
      />
    </AbsoluteFill>
  );
};

/** Màn tiêu đề: nét vẽ khung tiêu đề, tên bản vẽ chữ kỹ thuật lớn, dòng phụ; cuối màn thì nhạt đi. */
const TitleSheet: React.FC<{ title: string; subtitle: string; accent: string; end: number }> = ({
  title,
  subtitle,
  accent,
  end,
}) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const { width, height, unit, safe } = useLayout();
  const wide = width / height >= 1.3;
  const side = wide ? safe.side + 60 * unit : Math.max(80 * unit, safe.side * 0.72);
  const w = Math.min(width - side * 2, 1150 * unit);
  const x = (width - w) / 2;
  const padX = 44 * unit;
  const text = upper(title || vt("BẢN VẼ"));
  const size = fitSize(text, (wide ? 96 : 100) * unit, 50 * unit, w - padX * 2, 3, 0.7);
  const lines = Math.min(3, Math.ceil((Array.from(text).length * size * 0.7) / (w - padX * 2)));
  const h = 150 * unit + lines * size * 1.3 + (subtitle ? 120 * unit : 30 * unit);
  const y = (wide ? height * 0.48 : height * 0.43) - h / 2;
  const box = { x, y, w, h };
  const sw = Math.max(1, 3 * unit);
  const out = ramp(frame, end - 12, 10, EASE_IN_OUT);
  const titleReveal = ramp(frame, 12, 22);
  const sub = ramp(frame, 28, 12);
  const dim = interpolate(frame, [20, 40], [0, 1], clamp);
  const off = 44 * unit;
  return (
    <AbsoluteFill style={{ opacity: 1 - out, translate: `0 ${(-out * 24 * unit).toFixed(1)}px` }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={C.fill} opacity={ramp(frame, 0, 12) * 0.7} />
        <Stroke d={`M${box.x},${box.y} H${box.x + box.w} V${box.y + box.h} H${box.x} Z`} t={ramp(frame, 0, 18)} width={sw} />
        <Stroke
          d={`M${box.x + 12 * unit},${box.y + 12 * unit} H${box.x + box.w - 12 * unit} V${box.y + box.h - 12 * unit} H${box.x + 12 * unit} Z`}
          t={ramp(frame, 5, 18)}
          width={Math.max(1, 1.2 * unit)}
          color={C.soft}
        />
        {/* Đường kích thước phía trên khung tiêu đề. */}
        {dim > 0 ? (
          <g opacity={dim}>
            <path d={`M${box.x},${box.y - 8 * unit} V${box.y - off - 12 * unit} M${box.x + box.w},${box.y - 8 * unit} V${box.y - off - 12 * unit}`} stroke={C.soft} strokeWidth={Math.max(1, 1.3 * unit)} />
            <path
              d={`M${box.x + box.w / 2 - (box.w / 2) * dim},${box.y - off} H${box.x + box.w / 2 + (box.w / 2) * dim}`}
              stroke={C.ink}
              strokeWidth={Math.max(1, 1.4 * unit)}
            />
            <path d={`M${box.x},${box.y - off} l${16 * unit},${-5 * unit} v${10 * unit} Z M${box.x + box.w},${box.y - off} l${-16 * unit},${-5 * unit} v${10 * unit} Z`} fill={C.ink} opacity={dim > 0.95 ? 1 : 0} />
            <rect x={box.x + box.w / 2 - 110 * unit} y={box.y - off - 15 * unit} width={220 * unit} height={30 * unit} fill={C.paper} />
            <text x={box.x + box.w / 2} y={box.y - off} fill={C.ink} fontFamily={MONO} fontSize={19 * unit} textAnchor="middle" dominantBaseline="central">
              {vt("TỈ LỆ")} 1:1
            </text>
          </g>
        ) : null}
        {/* Dấu tâm hai bên khung. */}
        {[box.x - 30 * unit, box.x + box.w + 30 * unit].map((cx, i) => (
          <g key={i} opacity={ramp(frame, 10, 10)} stroke={C.ink} strokeWidth={Math.max(1, 1.5 * unit)}>
            <circle cx={cx} cy={box.y + box.h / 2} r={9 * unit} fill="none" />
            <path d={`M${cx - 17 * unit},${box.y + box.h / 2} h${34 * unit} M${cx},${box.y + box.h / 2 - 17 * unit} v${34 * unit}`} />
          </g>
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          left: box.x + padX,
          top: box.y + 44 * unit,
          width: box.w - padX * 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 19 * unit, letterSpacing: "0.16em", color: accent, opacity: ramp(frame, 8, 10) }}>
          {vt("BẢN VẼ KỸ THUẬT · SỐ 01")}
        </div>
        <div
          style={{
            marginTop: 18 * unit,
            fontFamily: LABEL,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.3,
            letterSpacing: "0.03em",
            color: C.ink,
            clipPath: `inset(-20% ${((1 - titleReveal) * 100).toFixed(2)}% -20% 0)`,
            textShadow: `0 0 ${(22 * unit).toFixed(0)}px rgba(170, 215, 255, 0.3)`,
          }}
        >
          {text}
        </div>
        <div
          style={{
            marginTop: 20 * unit,
            height: Math.max(1, 2 * unit),
            width: `${(titleReveal * 100).toFixed(1)}%`,
            backgroundColor: C.soft,
          }}
        />
        {subtitle ? (
          <div
            style={{
              marginTop: 20 * unit,
              fontFamily: NOTE,
              fontWeight: 400,
              fontSize: (wide ? 36 : 40) * unit,
              lineHeight: 1.4,
              color: C.soft,
              opacity: sub,
              translate: `0 ${((1 - sub) * 10 * unit).toFixed(1)}px`,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Gán mỗi câu phụ đề cho cảnh chứa thời điểm câu bắt đầu (câu trước cảnh đầu thuộc cảnh đầu). */
const itemsByScene = (captions: Caption[], scenes: Scene[], appearOf: (i: number) => number) => {
  const out: NoteItem[][] = scenes.map(() => []);
  for (const c of captions) {
    if (!c.text.trim()) continue;
    const i = Math.max(0, activeIndexAt(scenes, msToFrames(c.startMs)));
    const start = Math.max(msToFrames(c.startMs), appearOf(i) + 8);
    out[i].push({ text: c.text.trim(), start, end: Math.max(start + 1, msToFrames(c.endMs)) });
  }
  return out;
};

export const BlueprintStyle: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, showTitle }) => {
  ensureFonts(["lexend", "roboto"]);
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const layout = useSheetLayout();
  const warm = accentOn(accent);
  const sheets = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const titleEnd = showTitle ? TITLE_FRAMES : 0;
  const startOf = (i: number) => (i === 0 ? 0 : msToFrames(sheets[i].startMs));
  // Cảnh đầu vẽ ngay khi màn tiêu đề nhạt đi; cảnh sau vẽ khi vạch quét đã đi được một đoạn.
  const appearOf = (i: number) => (i === 0 ? (showTitle ? titleEnd - 6 : 0) : startOf(i) + 5);
  const items = itemsByScene(captions, sheets, appearOf);
  const active = Math.max(0, activeIndexAt(sheets, frame));
  const wipeStart = active > 0 ? startOf(active) : -Infinity;
  const wiping = active > 0 && frame < wipeStart + WIPE;
  const w = wiping ? interpolate(frame, [wipeStart, wipeStart + WIPE], [0, 1], { ...clamp, easing: EASE_IN_OUT }) : 1;
  const scanX = w * (width + 60 * unit) - 30 * unit;
  const render = (i: number) => (
    <SheetScene key={i} scene={sheets[i]} index={i} appear={appearOf(i)} items={items[i]} layout={layout} accent={warm} />
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, overflow: "hidden" }}>
      <BlueprintPaper width={width} height={height} unit={unit} />
      <DrawingBorder width={width} height={height} unit={unit} inset={layout.inset} />
      {wiping ? (
        <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${Math.max(0, scanX).toFixed(1)}px)` }}>{render(active - 1)}</AbsoluteFill>
      ) : null}
      {frame >= appearOf(0) || active > 0 ? (
        <AbsoluteFill style={wiping ? { clipPath: `inset(0 ${Math.max(0, width - scanX).toFixed(1)}px 0 0)` } : undefined}>
          {render(active)}
        </AbsoluteFill>
      ) : null}
      {showTitle && frame < titleEnd ? <TitleSheet title={title} subtitle={subtitle} accent={warm} end={titleEnd} /> : null}
      {layout.scale ? <ScaleBar x={layout.scale.x} y={layout.scale.y} w={layout.scale.w} unit={unit} opacity={ramp(frame, 6, 14)} /> : null}
      <TitleBlock
        box={layout.titleBlock}
        unit={unit}
        title={title}
        sheet={active + 1}
        sheets={sheets.length}
        accent={warm}
        opacity={ramp(frame, 4, 14)}
      />
      {wiping ? (
        // Vạch quét: một nét trắng sáng có quầng, kéo theo dải mờ như bóng thước kẻ.
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: scanX - 2 * unit,
            width: Math.max(2, 4 * unit),
            backgroundColor: C.ink,
            boxShadow: `0 0 ${(24 * unit).toFixed(0)}px ${(6 * unit).toFixed(0)}px rgba(190, 225, 255, 0.55), ${(-60 * unit).toFixed(0)}px 0 ${(70 * unit).toFixed(0)}px rgba(190, 225, 255, 0.12)`,
          }}
        />
      ) : null}
      <Grain opacity={0.07} animated={false} baseFrequency={0.75} />
    </AbsoluteFill>
  );
};
