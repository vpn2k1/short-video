/**
 * Chữ "được viết ra": từng từ lộ dần từ trái sang phải bằng clip-path, theo thứ
 * tự ký tự — nên câu xuống dòng tới đâu thì nét viết chạy tới đó, không cần đo dòng.
 * Cụm `punch` đổi sang màu nhấn và có gạch chân bút dạ vẽ bằng stroke-dashoffset.
 */
import { interpolateColors } from "remotion";
import { HAND, INK, scribbleUnderline, textWidth } from "./sketch";

/** Nét SVG tự vẽ: progress 0 → chưa có gì, 1 → vẽ xong. */
export const DrawnPath: React.FC<{
  d: string;
  progress: number;
  color: string;
  width: number;
  opacity?: number;
}> = ({ d, progress, color, width, opacity = 1 }) => {
  // progress 0 vẫn để lại chấm tròn do linecap — không vẽ gì cả.
  if (progress <= 0) return null;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - Math.min(1, progress)}
      opacity={opacity}
    />
  );
};

/** Chuẩn hoá để so khớp cụm nhấn với lời thoại (NFC + chữ thường). */
const normalize = (text: string) => text.normalize("NFC");

type WordSpan = { word: string; start: number; end: number };

const splitWords = (text: string): WordSpan[] => {
  const words: WordSpan[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    words.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return words;
};

/**
 * Vị trí [từ đầu, từ cuối] của cụm nhấn trong câu, hoặc null nếu câu không chứa
 * nguyên văn cụm đó (không phân biệt hoa thường).
 */
export const findPunch = (text: string, punch: string): [number, number] | null => {
  const hay = normalize(text).toLowerCase();
  const needle = normalize(punch).trim().toLowerCase();
  if (!needle) return null;
  const at = hay.indexOf(needle);
  if (at < 0) return null;
  const words = splitWords(normalize(text));
  let first = -1;
  let last = -1;
  words.forEach((w, i) => {
    if (w.end > at && w.start < at + needle.length) {
      if (first < 0) first = i;
      last = i;
    }
  });
  return first < 0 ? null : [first, last];
};

/**
 * Tỉ lệ ký tự (0..1) tính tới hết cụm nhấn — dùng để nét viết chạy tới đúng cụm
 * nhấn vào lúc giọng đọc nhắc tới nó. null nếu câu không chứa cụm.
 */
export const punchEndFraction = (text: string, punch: string): number | null => {
  const range = findPunch(text, punch);
  if (!range) return null;
  const words = splitWords(normalize(text));
  const lengths = words.map((w) => [...w.word].length);
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const upTo = lengths.slice(0, range[1] + 1).reduce((a, b) => a + b, 0);
  return upTo / total;
};

export type PunchState = {
  text: string;
  accent: string;
  /** 0 → màu mực, 1 → màu nhấn. */
  colorT: number;
  /** Tiến độ vẽ gạch chân. */
  draw: number;
};

type Props = {
  text: string;
  fontSize: number;
  /** 0..1 — phần câu đã viết ra. */
  progress: number;
  maxWidth: number;
  seed: string;
  color?: string;
  align?: "left" | "center";
  lineHeight?: number;
  punch?: PunchState | null;
};

export const WrittenText: React.FC<Props> = ({
  text,
  fontSize,
  progress,
  maxWidth,
  seed,
  color = INK,
  align = "left",
  lineHeight = 1.3,
  punch = null,
}) => {
  const clean = normalize(text);
  const words = splitWords(clean);
  const total = words.reduce((sum, w) => sum + [...w.word].length, 0) || 1;
  const revealed = progress * total;
  const range = punch ? findPunch(clean, punch.text) : null;

  let cursor = 0;
  const wordNodes = words.map((w, i) => {
    const length = [...w.word].length;
    const local = Math.max(0, Math.min(1, (revealed - cursor) / length));
    cursor += length;
    const inPunch = range !== null && i >= range[0] && i <= range[1];
    const wordColor =
      inPunch && punch ? interpolateColors(punch.colorT, [0, 1], [color, punch.accent]) : color;
    return (
      <span
        key={`w-${i}`}
        style={{
          display: "inline-block",
          color: wordColor,
          visibility: local <= 0 ? "hidden" : "visible",
          // Lề âm trên/dưới để dấu tiếng Việt chồng cao (Ữ, Ẫ) và dấu nặng không bị cắt.
          clipPath:
            local >= 1 ? undefined : `inset(-60% ${((1 - local) * 100).toFixed(2)}% -45% -12%)`,
        }}
      >
        {w.word}
      </span>
    );
  });

  // Chèn khoảng trắng thường giữa các từ để trình duyệt tự ngắt dòng.
  const withSpaces = (from: number, to: number) => {
    const out: React.ReactNode[] = [];
    for (let i = from; i <= to; i++) {
      if (i > from) out.push(" ");
      out.push(wordNodes[i]);
    }
    return out;
  };

  let body: React.ReactNode;
  if (range && punch) {
    const phrase = words.slice(range[0], range[1] + 1).map((w) => w.word).join(" ");
    const phraseWidth = Math.min(textWidth(phrase, fontSize), maxWidth);
    const wobble = fontSize * 0.05;
    const svgHeight = fontSize * 0.5;
    const pop = 1 + Math.sin(Math.min(1, punch.draw) * Math.PI) * 0.05;
    body = (
      <>
        {range[0] > 0 ? [...withSpaces(0, range[0] - 1), " "] : null}
        <span
          style={{
            position: "relative",
            display: "inline-block",
            whiteSpace: phraseWidth < maxWidth * 0.95 ? "nowrap" : "normal",
            maxWidth,
            scale: String(pop),
          }}
        >
          {withSpaces(range[0], range[1])}
          <svg
            width={phraseWidth}
            height={svgHeight}
            style={{
              position: "absolute",
              left: 0,
              top: `calc(100% - ${(fontSize * 0.2).toFixed(1)}px)`,
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <DrawnPath
              d={scribbleUnderline(phraseWidth, svgHeight * 0.35, `${seed}-punch`, wobble)}
              progress={punch.draw}
              color={punch.accent}
              width={Math.max(3, fontSize * 0.085)}
              opacity={0.9}
            />
          </svg>
        </span>
        {range[1] < words.length - 1 ? [" ", ...withSpaces(range[1] + 1, words.length - 1)] : null}
      </>
    );
  } else {
    body = words.length > 0 ? withSpaces(0, words.length - 1) : null;
  }

  return (
    <div
      style={{
        fontFamily: HAND,
        fontSize,
        lineHeight,
        color,
        textAlign: align,
        maxWidth,
        overflowWrap: "anywhere",
      }}
    >
      {body}
    </div>
  );
};
