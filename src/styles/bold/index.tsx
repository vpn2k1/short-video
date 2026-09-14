import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { Caption, Scene, ShortProps } from "../../compositions/Short/schema";
import { Scenes, Scrim } from "../../scenes/Scenes";
import { seeded, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { Backdrop, Progress, Tag, Visual } from "./Overlays";
import { fitWords, groupWords, GREEN, hasPunch, LINE_HEIGHT, lineCount, PUNCH_SCALE, splitWords, YELLOW } from "./text";
import { TitleIntro } from "./TitleIntro";
import { WordGroup, type ShownWord } from "./Words";

/** Từ cuối câu xuất hiện ở ~85% thời lượng câu. */
const SPREAD = 0.85;
/** Mức phóng "jump-cut" của nền ở cụm lẻ. */
const PUNCH_IN = 1.05;

/** Cụm punch nằm trong câu này — ưu tiên cảnh có atMs gần giữa câu nhất. */
const punchFor = (caption: Caption, scenes: Scene[]) => {
  const mid = (caption.startMs + caption.endMs) / 2;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const s of scenes) {
    if (!s.punch || !hasPunch(caption.text, s.punch.text)) continue;
    const dist = Math.abs(s.punch.atMs - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = s.punch.text;
    }
  }
  return best;
};

/**
 * Phong cách "Phụ đề từng từ" (kiểu Hormozi) — xem skill style-bold.
 *
 * Ảnh/video toàn khung, mỗi lúc chỉ một cụm 2–4 từ in hoa rất đậm viền đen,
 * từ đang đọc tô vàng, từ punch xanh lá. Mỗi cụm mới nền giật phóng 1.00 ↔ 1.05.
 * Thứ tự lớp: nền tối → ảnh → scrim → hình vẽ → tag → phụ đề → title → tiến độ.
 */
export const BoldStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  background,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit, portrait, captionBottom } = useLayout();
  const { scene, startFrame: sceneStart } = useSceneClock(scenes);
  const { caption, index: captionIndex, startFrame, durationFrames } = useCaptionClock(captions);

  const introEnd = showTitle ? TITLE_FRAMES : 0;
  const inIntro = frame < introEnd;
  const boxW = width - safe.side * 2;
  const maxSize = (portrait ? 112 : 100) * unit;
  const minSize = 52 * unit;

  // Cụm đang hiện + chỉ số cụm toàn video (cho cú giật nền).
  let shown: ShownWord[] = [];
  let groupKey = "";
  let globalGroup = -1;
  let fitItems: { text: string; punch: boolean }[] = [];
  let maxLines = 2;
  if (!inIntro && caption) {
    let before = 0;
    for (let i = 0; i < captionIndex; i++) before += groupWords(splitWords(captions[i].text, null)).length;
    const words = splitWords(caption.text, punchFor(caption, scenes));
    const groups = groupWords(words);
    const len = Math.max(1, caption.text.normalize("NFC").length);
    const appearOf = (offset: number) => startFrame + (offset / len) * SPREAD * durationFrames;
    let gi = 0;
    for (let g = 0; g < groups.length; g++) {
      if (frame >= appearOf(groups[g][0].offset)) gi = g;
    }
    let activeWord = 0;
    for (const w of words) {
      if (frame >= appearOf(w.offset)) activeWord = w.index;
    }
    const group = groups[gi] ?? [];
    shown = group.map((w) => ({
      text: w.text,
      appear: appearOf(w.offset),
      punch: w.punch,
      color: w.punch ? GREEN : w.index === activeWord ? YELLOW : "#ffffff",
    }));
    fitItems = group;
    groupKey = `c${captionIndex}-g${gi}`;
    globalGroup = before + gi;
  } else if (!inIntro && captions.length === 0 && title.trim()) {
    // Không có phụ đề: tiêu đề làm chữ chính, từ cuối tô vàng.
    const words = splitWords(title, null);
    shown = words.map((w, i) => ({
      text: w.text,
      appear: introEnd + i * 2,
      punch: false,
      color: i === words.length - 1 ? YELLOW : "#ffffff",
    }));
    fitItems = words;
    groupKey = "title";
    maxLines = 3;
  }

  // Ưu tiên cả cụm trên MỘT dòng (chỉ co tới 72%) — tránh một từ lẻ rơi xuống dòng hai.
  const oneLine = maxLines === 2 && fitItems.length ? fitWords(fitItems, boxW, 1, maxSize, maxSize * 0.72) : 0;
  const oneLineOk = oneLine > 0 && lineCount(fitItems, boxW, oneLine) === 1;
  const size = !shown.length ? maxSize : oneLineOk ? oneLine : fitWords(fitItems, boxW, maxLines, maxSize, minSize);
  const hasPunchWord = shown.some((w) => w.punch);
  // Chiều cao hai dòng — neo tâm khối chữ để cụm một dòng/hai dòng không nhảy quá xa.
  const blockH = 2 * size * LINE_HEIGHT * (hasPunchWord ? PUNCH_SCALE : 1);
  const centerY =
    captionPosition === "center" ? height / 2 : height - captionBottom - (portrait ? 60 * unit : 0) - blockH / 2;

  const zoom = globalGroup >= 0 && globalGroup % 2 === 1 ? PUNCH_IN : 1;
  const origin = `${Math.round(seeded(`bold-ox-${globalGroup}`, 40, 60))}% ${Math.round(seeded(`bold-oy-${globalGroup}`, 35, 55))}%`;

  const sceneAppear = Math.max(sceneStart, introEnd);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: zoom, transformOrigin: origin }}>
        <Backdrop accent={accent} background={background} />
        <Scenes scenes={scenes} />
      </AbsoluteFill>
      <Scrim />

      {scene?.visual && !inIntro ? (
        <Visual key={`v-${scene.startMs}`} visual={scene.visual} appear={sceneAppear} hasTag={Boolean(scene.tag)} />
      ) : null}
      {scene?.tag && !inIntro ? <Tag key={`t-${scene.startMs}`} text={scene.tag} appear={sceneAppear} /> : null}

      {shown.length ? (
        <div
          key={groupKey}
          style={{
            position: "absolute",
            left: safe.side,
            width: boxW,
            top: centerY,
            height: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WordGroup words={shown} size={size} width={boxW} />
        </div>
      ) : null}

      {showTitle ? <TitleIntro title={title} subtitle={subtitle} handle={handle} /> : null}
      <Progress />
    </AbsoluteFill>
  );
};
