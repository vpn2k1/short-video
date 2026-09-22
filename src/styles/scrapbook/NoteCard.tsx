/**
 * Thẻ ghi chú kẻ dòng ghim trên bảng — chỗ đọc lời. Một thẻ suốt video, câu mới được "viết" lên từ trái sang phải;
 * cụm nhấn của cảnh được tô bút dạ vàng đúng lúc giọng đọc tới.
 */
import { interpolate } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import type { Board } from "./layout";
import { TAPE_COLORS, WashiTape } from "./paper";
import { CARD_LINE_HEIGHT, CARD_PAPER, HAND, INK, lineCount, punchSpan } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const NoteCard: React.FC<{
  card: NonNullable<Board["card"]>;
  caption: Caption | null;
  captionIndex: number;
  scene: Scene | null;
  /** Frame thẻ được ghim lên bảng. */
  appear: number;
  frame: number;
  unit: number;
  ready: boolean;
}> = ({ card, caption, captionIndex, scene, appear, frame, unit, ready }) => {
  const enter = interpolate(frame, [appear, appear + 12], [0, 1], { ...clamp, easing: (t) => 1 - (1 - t) ** 3 });
  if (enter <= 0) return null;
  const { size, padTop, padX } = card;
  const lineH = size * CARD_LINE_HEIGHT;

  // Câu mới: viết dần từ trái sang phải (mask có mép mềm) trong ~12 frame.
  const start = caption ? Math.max(appear, msToFrames(caption.startMs)) : 0;
  const duration = caption ? Math.max(1, msToFrames(caption.endMs) - start) : 1;
  const write = caption ? interpolate(frame, [start, start + Math.min(14, Math.max(4, duration * 0.45))], [0, 1], clamp) : 0;
  const edge = write * 118 - 8;

  // Cụm nhấn trong câu: tô bút dạ vàng từ trái sang phải lúc atMs.
  const text = caption ? caption.text.normalize("NFC") : "";
  const span = caption && scene?.punch ? punchSpan(text, scene.punch.text) : null;
  const punchAt = scene?.punch ? Math.max(start + 2, msToFrames(scene.punch.atMs)) : 0;
  const mark = span ? interpolate(frame, [punchAt, punchAt + 9], [0, 1], clamp) : 0;
  // Câu ít dòng hơn thẻ: đẩy xuống nguyên số dòng để chữ vẫn nằm đúng trên dòng kẻ.
  const lines = caption ? lineCount(text, size, (card.w - padX * 2) * 0.97, HAND, 400, ready) : card.lines;
  const offset = Math.floor(Math.max(0, card.lines - lines) / 2) * lineH;

  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: card.w,
        height: card.h,
        rotate: `${(-0.9 + (1 - enter) * -4).toFixed(2)}deg`,
        translate: `0 ${((1 - enter) * 70 * unit).toFixed(1)}px`,
        opacity: enter,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: CARD_PAPER,
          backgroundImage: [
            // Dòng đỏ đầu thẻ + các dòng kẻ xanh nhạt bám đúng chân chữ.
            `linear-gradient(transparent ${padTop - 16 * unit}px, rgba(220, 70, 80, 0.55) ${padTop - 16 * unit}px, rgba(220, 70, 80, 0.55) ${padTop - 13 * unit}px, transparent ${padTop - 13 * unit}px)`,
            `repeating-linear-gradient(180deg, transparent 0 ${lineH - 2.5 * unit}px, rgba(90, 140, 210, 0.3) ${lineH - 2.5 * unit}px ${lineH}px)`,
          ].join(", "),
          backgroundPosition: `0 0, 0 ${padTop + size * 0.06}px`,
          backgroundSize: `100% 100%, 100% calc(100% - ${padTop}px)`,
          backgroundRepeat: "no-repeat",
          borderRadius: 4 * unit,
          boxShadow: `0 ${10 * unit}px ${24 * unit}px rgba(40, 20, 0, 0.38), 0 ${2 * unit}px ${3 * unit}px rgba(40, 20, 0, 0.2)`,
        }}
      />
      <WashiTape
        width={Math.min(230 * unit, card.w * 0.3)}
        height={52 * unit}
        color={TAPE_COLORS[2]}
        unit={unit}
        pattern={0}
        style={{ left: card.w / 2 - Math.min(115 * unit, card.w * 0.15), top: -30 * unit, rotate: `${seeded("sb-card-tape", -4, 4).toFixed(1)}deg` }}
      />
      {caption ? (
        <div
          key={captionIndex}
          style={{
            position: "absolute",
            left: padX,
            right: padX,
            top: padTop + offset,
            textAlign: "center",
            fontFamily: HAND,
            fontSize: size,
            lineHeight: CARD_LINE_HEIGHT,
            color: INK,
            WebkitMaskImage: `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + 8}%)`,
            maskImage: `linear-gradient(90deg, #000 ${edge}%, transparent ${edge + 8}%)`,
          }}
        >
          <div style={{ margin: 0 }}>
            {span ? (
              <>
                {text.slice(0, span[0])}
                <span
                  style={{
                    backgroundImage: "linear-gradient(100deg, rgba(255, 214, 20, 0.7), rgba(255, 200, 0, 0.62))",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${(mark * 100).toFixed(1)}% 78%`,
                    backgroundPosition: "0 70%",
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                    borderRadius: 6 * unit,
                    padding: `0 ${4 * unit}px`,
                  }}
                >
                  {text.slice(span[0], span[1])}
                </span>
                {text.slice(span[1])}
              </>
            ) : (
              text
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
