/**
 * Phong cách "Thư tay": tờ giấy viết thư trên mặt bàn gỗ, cây bút máy viết từng chữ bằng mực xanh đen,
 * câu nhấn đổi sang mực màu nhấn kèm gạch chân lượn sóng. Mỗi cảnh là một tờ thư; sang cảnh mới thì tờ mới
 * được đặt đè lên. Xem skill `.claude/skills/style-pen/SKILL.md`.
 *
 * Thứ tự lớp: mặt bàn → các tờ thư (giấy → ảnh kẹp → ghi chú → chữ → bút) → tờ tiêu đề → nhiễu giấy.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { useFontReady } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, seeded, useLayout } from "../shared";
import { findPunch } from "../whiteboard/written";
import {
  blockHeight, FountainPen, INK, InkText, LINE_HEIGHT, nibAt, PAPER, SCRIPT, SCRIPT_WEIGHT, wrap, type InkBlock,
} from "./ink";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SETTLE = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Số frame đặt tờ thư mới lên. */
const PLACE_FRAMES = 16;
/** Bút di chuyển tới chỗ bắt đầu câu mới trước khi viết. */
const TRAVEL_FRAMES = 4;

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };

/** Vị trí ký tự của cụm nhấn trong câu (theo code point), hoặc null. */
const punchRange = (text: string, punch: string): [number, number] | null => {
  if (!findPunch(text, punch)) return null;
  const hay = text.normalize("NFC").toLowerCase();
  const needle = punch.normalize("NFC").trim().toLowerCase();
  const at = hay.indexOf(needle);
  if (at < 0) return null;
  const from = [...hay.slice(0, at)].length;
  return [from, from + [...needle].length];
};

// ---------------------------------------------------------------------------
// Bố cục một tờ thư
// ---------------------------------------------------------------------------
type Sheet = { rect: Rect; tilt: number };

const useSheet = (): Sheet => {
  const { width, height } = useLayout();
  const mx = width * 0.035;
  const my = height * 0.022;
  return { rect: { x: mx, y: my, w: width - mx * 2, h: height - my * 2 }, tilt: -0.5 };
};

const Paper: React.FC<{ sheet: Sheet; unit: number; seed: string }> = ({ sheet, unit, seed }) => {
  const { rect } = sheet;
  // Vết ố nhẹ, cố định theo seed để mỗi tờ hơi khác.
  const spotX = seeded(`${seed}-sx`, 20, 80);
  const spotY = seeded(`${seed}-sy`, 15, 85);
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        backgroundColor: PAPER,
        backgroundImage: [
          `radial-gradient(ellipse at ${spotX.toFixed(0)}% ${spotY.toFixed(0)}%, rgba(190, 150, 90, 0.10), transparent 45%)`,
          "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(150, 110, 60, 0.22) 100%)",
        ].join(", "),
        borderRadius: 4 * unit,
        boxShadow: `0 ${10 * unit}px ${40 * unit}px rgba(20, 10, 0, 0.55), 0 ${2 * unit}px ${4 * unit}px rgba(20, 10, 0, 0.3)`,
      }}
    />
  );
};

/** Ảnh cũ viền trắng, kẹp ghim vào tờ thư. */
const ClippedPhoto: React.FC<{ scene: Scene; box: Rect; appear: number; frame: number; unit: number; seed: string }> = ({
  scene, box, appear, frame, unit, seed,
}) => {
  const t = interpolate(frame, [appear, appear + 14], [0, 1], { ...clamp, easing: SETTLE });
  if (t <= 0) return null;
  const border = 14 * unit;
  const tilt = seeded(`${seed}-tilt`, -3.2, -1.2);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        padding: border,
        paddingBottom: border * 2.4,
        boxSizing: "border-box",
        backgroundColor: "#fdfaf2",
        boxShadow: `0 ${6 * unit}px ${18 * unit}px rgba(40, 25, 10, 0.35)`,
        opacity: t,
        transform: `translateY(${((1 - t) * -40 * unit).toFixed(1)}px) rotate(${(tilt + (1 - t) * -4).toFixed(2)}deg) scale(${(1.04 - t * 0.04).toFixed(3)})`,
      }}
    >
      <div style={{ width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#d8cdb8", filter: "sepia(0.18) saturate(0.9)" }}>
        <SceneMedia scene={scene} from={appear} zoom={interpolate(frame, [appear, appear + 240], [1.02, 1.1], clamp)} />
      </div>
      {/* Ghim giấy */}
      <svg
        width={46 * unit}
        height={120 * unit}
        viewBox="0 0 46 120"
        style={{ position: "absolute", left: box.w * 0.14, top: -40 * unit, overflow: "visible" }}
      >
        <path
          d="M 12 110 L 12 18 A 11 11 0 0 1 34 18 L 34 96 A 7 7 0 0 1 20 96 L 20 30"
          fill="none"
          stroke="#9aa0a8"
          strokeWidth={4.5}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

/** Ghi chú bên lề bằng mực màu nhấn: con số / nhãn ngắn, hoặc câu nhấn không có trong lời. */
const MarginNote: React.FC<{
  text: string; caption: string | null; box: Rect; appear: number; frame: number; unit: number; accent: string; seed: string;
}> = ({ text, caption, box, appear, frame, unit, accent, seed }) => {
  const t = interpolate(frame, [appear, appear + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  if (t <= 0) return null;
  // Chữ ngắn ("80%") to hết cỡ; chữ dài được xuống dòng, cỡ theo diện tích ô.
  const size = Math.min(box.h * 0.5, Math.sqrt((box.w * box.h * 0.7) / Math.max(1, [...text].length)), 180 * unit);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SCRIPT,
        fontWeight: 700,
        color: accent,
        textAlign: "center",
        rotate: `${seeded(`${seed}-note`, -5, 4).toFixed(1)}deg`,
        scale: String(0.6 + t * 0.4),
        opacity: t,
      }}
    >
      <div style={{ fontSize: size, lineHeight: 1.1, maxWidth: box.w }}>{text}</div>
      {caption ? <div style={{ fontSize: Math.max(30 * unit, size * 0.3), color: INK, fontWeight: 500, maxWidth: box.w }}>{caption}</div> : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Một tờ thư = một cảnh
// ---------------------------------------------------------------------------
type PageBuild = { blocks: InkBlock[]; photo: Rect | null; note: Rect | null; tagBlock: InkBlock | null };

const buildPage = (
  scene: Scene,
  captions: Caption[],
  appear: number,
  layout: ReturnType<typeof useLayout>,
  accent: string,
  ready: boolean,
  seed: string,
): PageBuild => {
  const { width, height, safe, unit } = layout;
  const stacked = height / width >= 1.2;
  const left = safe.side + 24 * unit;
  const right = width - safe.side - 24 * unit;
  const top = safe.top + 10 * unit;
  const bottom = height - safe.bottom;
  const contentW = right - left;

  // Dòng đề ngày tháng / nơi chốn ở góc trên phải.
  let tagBlock: InkBlock | null = null;
  let headerBottom = top;
  if (scene.tag) {
    const size = 50 * unit;
    const lines = wrap(scene.tag, size, contentW * 0.75, ready).slice(0, 2);
    const w = Math.max(...lines.map((l) => l.width));
    tagBlock = {
      key: `${seed}-tag`, lines, x: right - w, y: top, size, align: "left", boxWidth: w, color: INK,
      start: appear, end: appear + 12, punch: null,
    };
    headerBottom = top + blockHeight(lines.length, size) + 18 * unit;
  }

  const hasPhoto = Boolean(scene.image);
  const punchInText = scene.punch ? captions.some((c) => punchRange(c.text, scene.punch!.text)) : true;
  const noteText = scene.visual ? scene.visual.text : scene.punch && !punchInText ? scene.punch.text : null;
  const hasNote = noteText !== null;

  // Vùng ảnh / ghi chú và vùng chữ.
  let photo: Rect | null = null;
  let note: Rect | null = null;
  let textZone: Rect;
  if (stacked) {
    const mediaH = hasPhoto ? Math.min((bottom - headerBottom) * 0.42, contentW * 0.72) : hasNote ? (bottom - headerBottom) * 0.22 : 0;
    if (hasPhoto) {
      const w = contentW * (hasNote ? 0.66 : 0.8);
      photo = { x: left + (hasNote ? 0 : (contentW - w) / 2), y: headerBottom + 20 * unit, w, h: mediaH };
      if (hasNote) note = { x: left + w + 10 * unit, y: headerBottom + mediaH * 0.25, w: contentW - w - 10 * unit, h: mediaH * 0.6 };
    } else if (hasNote) {
      note = { x: left, y: headerBottom, w: contentW, h: mediaH };
    }
    const textTop = headerBottom + (mediaH > 0 ? mediaH + 60 * unit : 30 * unit);
    textZone = { x: left, y: textTop, w: contentW, h: bottom - textTop };
  } else {
    const split = left + contentW * (hasPhoto || hasNote ? 0.56 : 1);
    if (hasPhoto) {
      photo = { x: split + 40 * unit, y: headerBottom + 20 * unit, w: right - split - 40 * unit, h: (bottom - headerBottom) * (hasNote ? 0.62 : 0.85) };
      if (hasNote) note = { x: split + 40 * unit, y: photo.y + photo.h + 30 * unit, w: photo.w, h: bottom - photo.y - photo.h - 30 * unit };
    } else if (hasNote) {
      note = { x: split + 40 * unit, y: headerBottom, w: right - split - 40 * unit, h: bottom - headerBottom };
    }
    textZone = { x: left, y: headerBottom + 20 * unit, w: split - left, h: bottom - headerBottom - 20 * unit };
  }

  // Cỡ chữ: vừa cả những câu của tờ này (cỡ không đổi khi câu mới xuất hiện).
  const gap = 0.35;
  const heightAt = (size: number) =>
    captions.reduce((sum, c) => sum + blockHeight(wrap(c.text, size, textZone.w, ready).length, size) + size * gap, 0);
  // Dancing Script có chữ thường thấp — cỡ phải lớn hơn font thường mới đọc rõ trên điện thoại.
  let size = (hasPhoto || hasNote ? 100 : 124) * unit;
  while (heightAt(size) > textZone.h && size > 40 * unit) size *= 0.94;
  // Vẫn không vừa thì chỉ giữ những câu cuối — câu cũ nhất trượt khỏi tờ.
  let first = 0;
  while (first < captions.length - 1 && captions.slice(first).reduce((s, c) => s + blockHeight(wrap(c.text, size, textZone.w, ready).length, size) + size * gap, 0) > textZone.h) first += 1;

  const blocks: InkBlock[] = [];
  let y = textZone.y;
  captions.forEach((caption, index) => {
    if (index < first) return;
    const lines = wrap(caption.text, size, textZone.w, ready);
    const start = Math.max(appear, msToFrames(caption.startMs)) + (index > first ? TRAVEL_FRAMES : 0);
    const duration = Math.max(1, msToFrames(caption.endMs) - start);
    const range = scene.punch ? punchRange(caption.text, scene.punch.text) : null;
    blocks.push({
      key: `${seed}-c${index}`,
      lines,
      x: textZone.x,
      y,
      size,
      align: "left",
      boxWidth: textZone.w,
      color: INK,
      start,
      end: start + Math.max(8, Math.round(duration * 0.8)),
      punch: range && scene.punch
        ? { from: range[0], to: range[1], at: Math.max(start + 4, msToFrames(scene.punch.atMs)), color: accent }
        : null,
    });
    y += blockHeight(lines.length, size) + size * gap;
  });

  return { blocks, photo, note, tagBlock };
};

/** Trạng thái cây bút: ngòi đang ở đâu, nhấc lên bao nhiêu. */
const penState = (blocks: InkBlock[], frame: number, ready: boolean, size: number) => {
  if (blocks.length === 0) return null;
  // Khối đang viết, hoặc khối viết xong gần nhất.
  let index = blocks.findIndex((b) => frame < b.end);
  if (index < 0) index = blocks.length - 1;
  const block = blocks[index];
  if (frame < block.start) {
    // Đang chờ câu mới: nằm ở cuối câu trước (nhấc lên), trong TRAVEL_FRAMES cuối thì bay tới đầu câu mới.
    const prev = index > 0 ? blocks[index - 1] : null;
    const target = nibAt(block, block.start, ready);
    if (!prev) return { ...target, lift: 1 };
    const rest = nibAt(prev, prev.end, ready);
    const t = interpolate(frame, [block.start - TRAVEL_FRAMES, block.start], [0, 1], clamp);
    return { x: rest.x + (target.x - rest.x) * t, y: rest.y + (target.y - rest.y) * t, lift: 1 - t * 0.6 };
  }
  const nib = nibAt(block, frame, ready);
  const writing = frame < block.end;
  const lift = writing ? 0 : interpolate(frame, [block.end, block.end + 6], [0, 1], clamp);
  // Tay lắc nhẹ theo nhịp nét chữ khi đang viết.
  const wobble = writing ? Math.sin(frame * 2.1) * size * 0.07 : 0;
  return { x: nib.x, y: nib.y + wobble, lift };
};

const Page: React.FC<{
  scene: Scene; index: number; captions: Caption[]; appear: number; frame: number; accent: string;
  sheet: Sheet; ready: boolean; showPen: boolean;
}> = ({ scene, index, captions, appear, frame, accent, sheet, ready, showPen }) => {
  const layout = useLayout();
  const { unit } = layout;
  const seed = `pen-page-${index}`;
  const page = buildPage(scene, captions, appear, layout, accent, ready, seed);
  const all = page.tagBlock ? [page.tagBlock, ...page.blocks] : page.blocks;
  const pen = showPen ? penState(page.blocks, frame, ready, page.blocks[0]?.size ?? 60 * unit) : null;

  return (
    <AbsoluteFill style={{ rotate: `${sheet.tilt}deg` }}>
      <Paper sheet={sheet} unit={unit} seed={seed} />
      {page.photo ? <ClippedPhoto scene={scene} box={page.photo} appear={appear + 2} frame={frame} unit={unit} seed={seed} /> : null}
      {page.note ? (
        <MarginNote
          text={scene.visual ? scene.visual.text : scene.punch!.text}
          caption={scene.visual?.caption ?? null}
          box={page.note}
          appear={scene.visual ? appear + 12 : Math.max(appear, msToFrames(scene.punch!.atMs))}
          frame={frame}
          unit={unit}
          accent={accent}
          seed={seed}
        />
      ) : null}
      {all.map((block) => <InkText key={block.key} block={block} frame={frame} ready={ready} />)}
      {pen ? (
        // Bút đưa vào khi tờ thư đã nằm yên.
        <FountainPen x={pen.x} y={pen.y} length={440 * unit} lift={pen.lift} accent={accent} opacity={interpolate(frame, [appear - 6, appear], [0, 1], clamp)} />
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Tờ tiêu đề: bút viết tiêu đề, gạch hoa mỹ, dòng phụ
// ---------------------------------------------------------------------------
const TitleSheet: React.FC<{
  title: string; subtitle: string; accent: string; frame: number; sheet: Sheet; ready: boolean;
}> = ({ title, subtitle, accent, frame, sheet, ready }) => {
  const layout = useLayout();
  const { width, height, safe, unit } = layout;
  const boxW = width - safe.side * 2 - 40 * unit;
  let size = 128 * unit;
  let lines = wrap(title, size, boxW, ready);
  while (lines.length > 3 && size > 60 * unit) {
    size *= 0.9;
    lines = wrap(title, size, boxW, ready);
  }
  const subSize = Math.min(size * 0.48, 60 * unit);
  const subLines = subtitle ? wrap(subtitle, subSize, boxW, ready) : [];
  const flourishH = size * 0.6;
  const totalH = blockHeight(lines.length, size) + flourishH + (subLines.length ? blockHeight(subLines.length, subSize) : 0);
  const y0 = (height - totalH) / 2 - 40 * unit;
  const x0 = (width - boxW) / 2;

  const titleBlock: InkBlock = {
    key: "pen-title", lines, x: x0, y: y0, size, align: "center", boxWidth: boxW, color: INK,
    start: 4, end: 4 + Math.min(34, Math.max(16, (lines.at(-1)?.to ?? 10) * 1.6)), punch: null,
  };
  const subBlock: InkBlock | null = subLines.length
    ? {
      key: "pen-sub", lines: subLines, x: x0, y: y0 + blockHeight(lines.length, size) + flourishH, size: subSize,
      align: "center", boxWidth: boxW, color: "#3c4a70", start: titleBlock.end + 10, end: titleBlock.end + 30, punch: null,
    }
    : null;
  const blocks = [titleBlock, subBlock].filter((b): b is InkBlock => b !== null);

  // Nét lượn hoa mỹ dưới tiêu đề.
  const fw = Math.min(boxW * 0.7, Math.max(...lines.map((l) => l.width)) * 0.9);
  const fy = y0 + blockHeight(lines.length, size) + flourishH * 0.25;
  const flourish = interpolate(frame, [titleBlock.end, titleBlock.end + 12], [0, 1], clamp);
  const pen = penState(blocks, frame, ready, size * 0.5);

  return (
    <AbsoluteFill style={{ rotate: `${sheet.tilt}deg` }}>
      <Paper sheet={sheet} unit={unit} seed="pen-title" />
      {blocks.map((block) => <InkText key={block.key} block={block} frame={frame} ready={ready} />)}
      {flourish > 0 ? (
        <svg width={fw} height={flourishH} style={{ position: "absolute", left: (width - fw) / 2, top: fy - flourishH * 0.3, overflow: "visible" }}>
          <path
            d={`M 0 ${flourishH * 0.35} C ${fw * 0.2} ${-flourishH * 0.1}, ${fw * 0.3} ${flourishH * 0.8}, ${fw * 0.5} ${flourishH * 0.35} S ${fw * 0.8} ${-flourishH * 0.05}, ${fw} ${flourishH * 0.3}`}
            fill="none"
            stroke={accent}
            strokeWidth={Math.max(3, size * 0.045)}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - flourish}
          />
        </svg>
      ) : null}
      {pen ? <FountainPen x={pen.x} y={pen.y} length={440 * unit} lift={pen.lift} accent={accent} /> : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
export const PenStyle: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const ready = useFontReady("dancing");
  const sheet = useSheet();
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const pageOf = captions.map((c) => Math.max(0, activeIndexAt(pages, msToFrames(c.startMs))));
  const titleEnd = showTitle ? TITLE_FRAMES : 0;
  const active = Math.max(0, activeIndexAt(pages, frame));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#2a1d14",
        backgroundImage: [
          "repeating-linear-gradient(88deg, rgba(255, 220, 170, 0.035) 0 3px, transparent 3px 22px)",
          "radial-gradient(ellipse at 50% 40%, #5a3d27 0%, #2a1d14 75%)",
        ].join(", "),
        overflow: "hidden",
        fontFamily: SCRIPT,
        fontWeight: SCRIPT_WEIGHT,
        lineHeight: LINE_HEIGHT,
      }}
    >
      {pages.map((scene, index) => {
        const start = index === 0 ? 0 : msToFrames(scene.startMs);
        const nextStart = index < pages.length - 1 ? msToFrames(pages[index + 1].startMs) : Infinity;
        // Tờ sau đã đặt xong đè kín thì bỏ tờ này khỏi cây render.
        if (frame < start || frame >= nextStart + PLACE_FRAMES) return null;
        const place = index === 0 ? 1 : interpolate(frame, [start, start + PLACE_FRAMES], [0, 1], { ...clamp, easing: SETTLE });
        const covered = nextStart === Infinity ? 0 : interpolate(frame, [nextStart, nextStart + PLACE_FRAMES], [0, 1], clamp);
        const appear = index === 0 ? Math.max(start, titleEnd) : start + PLACE_FRAMES;
        const drift = seeded(`pen-drift-${index}`, -1.2, 1.2);
        return (
          <AbsoluteFill
            key={`page-${index}`}
            style={{
              transform: `translate(${((1 - place) * layout.width * 0.35).toFixed(1)}px, ${((1 - place) * layout.height * 0.9).toFixed(1)}px) rotate(${((1 - place) * 7 + drift * place).toFixed(2)}deg)`,
              transformOrigin: "50% 100%",
            }}
          >
            <Page
              scene={scene}
              index={index}
              captions={captions.filter((_, i) => pageOf[i] === index)}
              appear={appear}
              frame={frame}
              accent={accent}
              sheet={sheet}
              ready={ready}
              showPen={index === active && frame >= titleEnd}
            />
            {covered > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(20, 10, 0, ${(covered * 0.25).toFixed(3)})` }} /> : null}
          </AbsoluteFill>
        );
      })}

      {showTitle && frame < TITLE_FRAMES + PLACE_FRAMES ? (
        <AbsoluteFill
          style={{
            // Tờ tiêu đề được nhấc lên trượt đi, lộ tờ thư đầu tiên bên dưới.
            transform: `translate(${(interpolate(frame, [TITLE_FRAMES, TITLE_FRAMES + PLACE_FRAMES], [0, -1.1], { ...clamp, easing: SETTLE }) * layout.width).toFixed(1)}px, 0) rotate(${interpolate(frame, [TITLE_FRAMES, TITLE_FRAMES + PLACE_FRAMES], [0, -6], clamp).toFixed(2)}deg)`,
            transformOrigin: "0% 100%",
          }}
        >
          <TitleSheet title={title} subtitle={subtitle} accent={accent} frame={frame} sheet={sheet} ready={ready} />
        </AbsoluteFill>
      ) : null}

      <Grain opacity={0.07} animated={false} baseFrequency={0.8} />
    </AbsoluteFill>
  );
};
