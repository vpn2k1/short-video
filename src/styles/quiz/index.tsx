import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { activeIndexAt, FONTS, fitFontSize, useLayout } from "../shared";
import { QuizBackground } from "./Background";
import { Confetti } from "./Confetti";
import { CountdownDisc } from "./Countdown";
import { ImageFrame, type Rect } from "./ImageFrame";
import { BadgeRibbon, EndStrip, Flash, ProgressDots, StatSticker, SubtitleStrip } from "./Overlays";
import { QuestionCard } from "./QuestionCard";
import { analyzeScenes, ANSWER_CHAR_W, answerFontSize, EASE_BACK, EASE_IN, estimateLines, ramp, upper } from "./theme";
import { TitleIntro } from "./TitleIntro";
import { useVideoLanguage } from "../../i18n/video";

/**
 * Phong cách "Câu đố" — xem skill style-quiz.
 *
 * Mỗi cảnh là một câu hỏi. Bố cục tính bằng số (không flex) vì confetti, đĩa đồng hồ và
 * dải phụ đề cần toạ độ tuyệt đối:
 *  - Dọc/vuông: chấm tiến độ → khung ảnh (co giãn) → thẻ câu hỏi đè mép dưới ảnh → đĩa
 *    đồng hồ vắt mép dưới thẻ → dải phụ đề → dải kêu gọi bình luận.
 *  - Ngang: khung ảnh cột trái cao hết vùng an toàn; cột phải xếp như trên, căn giữa dọc.
 * Chiều cao thẻ và dải phụ đề tính từ TOÀN BỘ dữ liệu nên bố cục không nhảy giữa các câu.
 */
export const QuizStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit } = useLayout();
  // Vuông cũng xếp hàng ngang: xếp dọc thì ảnh bị ép thành dải mỏng (đã render thử 1:1).
  const wide = width / height >= 0.95;
  const square = wide && width / height < 1.2;
  const language = useVideoLanguage();
  const infos = analyzeScenes(scenes, captions, showTitle, language);
  const hidden = new Set(infos.flatMap((i) => i.hiddenCaptions));
  const current = Math.max(0, activeIndexAt(scenes, frame));

  const X = safe.side;
  const contentW = width - safe.side * 2;
  const top = safe.top;
  const bottomLimit = height - safe.bottom;
  const gapImage = (square ? 44 : 70) * unit;
  const imgColW = wide ? contentW * (square ? 0.4 : 0.44) : 0;
  // Cột chứa thẻ câu hỏi.
  const colX = wide ? X + imgColW + gapImage : X;
  const colW = wide ? contentW - imgColW - gapImage : contentW;

  // --- Kích thước chữ & giữ chỗ ---
  const dotsH = 38 * unit;
  const endH = 84 * unit;
  const endCy = bottomLimit - endH / 2;
  const ringD = (square ? 130 : wide ? 150 : 170) * unit;
  const pillH = 64 * unit;
  const cardPadTop = pillH * 0.6 + 12 * unit;
  const cardPadBottom = ringD / 2 + 16 * unit;
  const cardPadX = 44 * unit;
  const textW = colW - cardPadX * 2;

  const questionBase = (square ? 60 : wide ? 70 : 80) * unit;
  const questionSize = (text: string) => {
    let size = fitFontSize(text, questionBase, 0.66);
    while (size > 30 * unit && estimateLines(text, size, textW) > 4) size = Math.round(size * 0.92);
    return size;
  };
  const answerBase = (square ? 80 : wide ? 104 : 116) * unit;
  const cardBody = infos.reduce((max, info) => {
    const q = questionSize(info.question);
    const qH = estimateLines(info.question, q, textW) * q * 1.22 + q * 0.1;
    const a = info.answer ? upper(info.answer) : "";
    const aSize = answerFontSize(a, answerBase, textW);
    const aH = a ? Math.min(3, estimateLines(a, aSize, textW, ANSWER_CHAR_W)) * aSize * 1.12 + aSize * 0.08 + 50 * unit : 0;
    return Math.max(max, qH, aH);
  }, 140 * unit);
  const cardH = cardPadTop + cardBody + cardPadBottom + 16 * unit;

  const stripFont = Math.round(Math.min(44 * unit, colW / 17));
  const stripLines = Math.min(
    3,
    captions.reduce(
      (max, c, i) => (hidden.has(i) ? max : Math.max(max, estimateLines(c.text, stripFont, colW - 66 * unit, 0.56))),
      0,
    ),
  );
  const stripH = stripLines > 0 ? stripLines * stripFont * 1.28 + 38 * unit : 0;
  const stripInColumn = captionPosition !== "center" && stripH > 0;

  // --- Xếp từ dưới lên ---
  const dotsY = top;
  let stripCy = endCy - endH / 2 - 22 * unit - stripH / 2;
  let cardBottom = stripInColumn ? stripCy - stripH / 2 - 28 * unit - ringD / 2 : endCy - endH / 2 - 30 * unit - ringD / 2;
  let cardY = cardBottom - cardH;

  let image: Rect;
  if (wide) {
    // Căn giữa khối thẻ + phụ đề trong khoảng trống giữa chấm tiến độ và dải kết.
    const availTop = dotsY + dotsH + 50 * unit + pillH / 2;
    const free = cardY - availTop;
    if (free > 0) {
      cardY -= free / 2;
      cardBottom -= free / 2;
      stripCy -= free / 2;
    }
    image = { x: X, y: top + 10 * unit, w: imgColW, h: bottomLimit - top - 20 * unit };
  } else {
    const imageY = dotsY + dotsH + 44 * unit;
    image = { x: X + 14 * unit, y: imageY, w: contentW - 28 * unit, h: Math.max(160 * unit, cardY + 70 * unit - imageY) };
  }
  const card: Rect = { x: colX, y: cardY, w: colW, h: cardH };
  // "center": dải phụ đề nằm giữa khung ảnh — dời xuống dưới sticker stat (góc trên phải) cho khỏi đè.
  const stripCenter = stripInColumn
    ? { cx: colX + colW / 2, cy: stripCy, w: colW }
    : { cx: image.x + image.w / 2, cy: image.y + Math.max(image.h * 0.5, 330 * unit), w: image.w - 40 * unit };

  // Sticker stat: ~46% bề rộng ảnh, nhưng không hẹp hơn 250u — ảnh cột hẹp (1:1) làm chú thích vỡ 3 dòng.
  const stickerW = Math.min(300 * unit, Math.max(image.w * 0.46, 250 * unit));
  const chromeIn = showTitle ? ramp(frame, TITLE_FRAMES - 12, 12) : 1;
  const last = infos[infos.length - 1];
  const lastReveal = [...infos].reverse().find((i) => i.revealFrame !== null)?.revealFrame ?? null;
  const endFrom = last
    ? lastReveal !== null && lastReveal >= last.start
      ? lastReveal + 40
      : Math.max(last.enter + 20, last.end - 75)
    : Number.POSITIVE_INFINITY;

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans, overflow: "hidden" }}>
      <QuizBackground accent={accent} />

      <ProgressDots infos={infos} current={current} x={colX} width={colW} y={dotsY} accent={accent} opacity={chromeIn} />

      {infos.map((info, i) => {
        const isLast = i === infos.length - 1;
        if (frame < info.enter) return null;
        const outP = isLast ? 0 : ramp(frame, info.end, 10, EASE_IN);
        if (outP >= 1) return null;
        const imgIn = ramp(frame, info.enter, 16, EASE_BACK);
        const cardIn = ramp(frame, info.enter + 4, 16, EASE_BACK);
        const exit = `translateX(${-outP * width * 0.7}px) rotate(${-outP * 8}deg)`;
        const { visual } = info.scene;
        const discCx = card.x + card.w / 2;
        const discCy = card.y + card.h;
        return (
          <AbsoluteFill key={i} style={{ opacity: 1 - outP * 0.6 }}>
            <AbsoluteFill
              style={{
                transform: `${exit} translateY(${(1 - imgIn) * -60 * unit}px) scale(${0.85 + 0.15 * imgIn})`,
                opacity: Math.min(1, imgIn * 2),
              }}
            >
              <ImageFrame rect={image} info={info} accent={accent} />
              {visual?.type === "badge" ? (
                <BadgeRibbon visual={visual} x={image.x - 22 * unit} y={image.y + 34 * unit} enter={info.enter + 14} opacity={1} />
              ) : null}
            </AbsoluteFill>
            <AbsoluteFill
              style={{
                transform: `${exit} translateY(${(1 - cardIn) * 140 * unit}px)`,
                opacity: Math.min(1, cardIn * 2),
              }}
            >
              <QuestionCard
                rect={card}
                info={info}
                accent={accent}
                questionSize={questionSize(info.question)}
                answerBase={answerBase}
                padBottom={cardPadBottom}
              />
              <CountdownDisc cx={discCx} cy={discCy} size={ringD} info={info} accent={accent} />
            </AbsoluteFill>
            {visual?.type === "stat" ? (
              <AbsoluteFill style={{ transform: exit }}>
                <StatSticker
                  visual={visual}
                  width={stickerW}
                  x={image.x + image.w - stickerW + 18 * unit}
                  y={image.y + 26 * unit}
                  enter={info.enter + 18}
                  opacity={1}
                />
              </AbsoluteFill>
            ) : null}
            {info.revealFrame !== null ? (
              <>
                <Flash at={info.revealFrame} />
                <Confetti x={discCx} y={discCy - card.h * 0.35} at={info.revealFrame} seedKey={`quiz-${i}`} />
              </>
            ) : null}
          </AbsoluteFill>
        );
      })}

      <SubtitleStrip
        captions={captions}
        hidden={hidden}
        cx={stripCenter.cx}
        cy={stripCenter.cy}
        maxWidth={stripCenter.w}
        fontSize={stripFont}
        hideBefore={showTitle ? TITLE_FRAMES - 6 : 0}
      />

      <EndStrip cx={colX + colW / 2} cy={endCy} from={endFrom} maxWidth={colW} />

      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <TitleIntro title={title} subtitle={subtitle} accent={accent} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
