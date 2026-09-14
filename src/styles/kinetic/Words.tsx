import { Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption } from "../../compositions/Short/schema";
import { seeded, useLayout } from "../shared";
import type { Swatch } from "./palette";
import {
  chunkWords,
  fitChunks,
  LINE_HEIGHT,
  PUNCH_PAD_EM,
  PUNCH_SCALE,
  splitWords,
  WORD_FONT,
  WORD_GAP_EM,
  WORD_WEIGHT,
} from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SNAP = Easing.bezier(0.16, 1, 0.3, 1);

/** Số frame của một cú bật chữ. */
const ENTER_FRAMES = 7;
/** Từ cuối xuất hiện ở ~70% thời lượng câu, phần còn lại để người xem đọc hết. */
const SPREAD = 0.7;

type Kind = "slam" | "up" | "rotate";

/**
 * Chọn kiểu bật cho từng khối — xác định theo seed, có nhịp: từ đầu câu luôn "slam",
 * không để ba từ liên tiếp cùng kiểu.
 */
const kindsFor = (count: number, seedKey: string): Kind[] => {
  const kinds: Kind[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      kinds.push("slam");
      continue;
    }
    const r = seeded(`${seedKey}-${i}`);
    let k: Kind = r < 0.5 ? "up" : r < 0.78 ? "rotate" : "slam";
    if (kinds.length >= 2 && kinds[i - 1] === k && kinds[i - 2] === k) {
      k = k === "up" ? "rotate" : "up";
    }
    kinds.push(k);
  }
  return kinds;
};

type Props = {
  caption: Caption;
  captionIndex: number;
  /** Frame câu kế tiếp bắt đầu — để chữ cũ bay ra; null nếu là câu cuối. */
  nextStartFrame: number | null;
  punch: { text: string; atFrame: number } | null;
  swatch: Swatch;
  width: number;
  height: number;
  maxSize: number;
};

/** Câu đang đọc: tách từ, chữ in hoa cỡ lớn, mỗi từ bật vào đúng nhịp lời đọc. */
export const KineticWords: React.FC<Props> = ({
  caption,
  captionIndex,
  nextStartFrame,
  punch,
  swatch,
  width,
  height,
  maxSize,
}) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();

  const words = splitWords(caption.text, punch?.text ?? null);
  const chunks = chunkWords(words);
  const size = fitChunks(chunks, width, height, maxSize, 34 * unit);
  const gap = WORD_GAP_EM * size;

  const start = msToFrames(caption.startMs);
  const end = Math.max(start + 1, msToFrames(caption.endMs));
  const textLength = Math.max(1, caption.text.normalize("NFC").length);
  const appearOf = (offset: number) => start + (offset / textLength) * SPREAD * (end - start);

  const kinds = kindsFor(chunks.length, `kinetic-${captionIndex}-${caption.text.length}`);

  // Chữ cũ bay lên và mờ đi trong 4 frame trước câu mới.
  const exit =
    nextStartFrame === null ? 0 : interpolate(frame, [nextStartFrame - 4, nextStartFrame], [0, 1], clamp);

  // Cả khối phóng rất chậm trong suốt câu cho chữ không đứng chết.
  const drift = interpolate(frame, [start, end + 30], [1, 1.035], clamp);

  return (
    <div
      style={{
        width,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        alignContent: "flex-start",
        columnGap: gap,
        rowGap: 0,
        fontFamily: WORD_FONT,
        fontWeight: WORD_WEIGHT,
        fontSize: size,
        lineHeight: LINE_HEIGHT,
        color: swatch.fg,
        scale: drift,
        transformOrigin: "0% 50%",
        opacity: 1 - exit,
        translate: `0px ${-exit * size * 0.35}px`,
      }}
    >
      {chunks.map((chunk, i) => {
        const kind = kinds[i];
        const baseAppear = appearOf(chunk.words[0].offset);
        const appear = Math.max(start, chunk.punch && punch ? Math.min(baseAppear, punch.atFrame) : baseAppear);
        const t = frame - appear;

        if (!chunk.punch) {
          const opacity = interpolate(t, [0, 2], [0, 1], clamp);
          const style: React.CSSProperties =
            kind === "slam"
              ? {
                  scale: interpolate(t, [0, ENTER_FRAMES * 0.7, ENTER_FRAMES], [2.3, 0.94, 1], {
                    ...clamp,
                    easing: [SNAP, Easing.out(Easing.quad)],
                  }),
                }
              : kind === "up"
                ? {
                    translate: `0px ${interpolate(t, [0, ENTER_FRAMES], [size * 0.55, 0], { ...clamp, easing: SNAP })}px`,
                  }
                : {
                    rotate: `${interpolate(t, [0, ENTER_FRAMES], [seeded(`rot-${captionIndex}-${i}`) < 0.5 ? -28 : 24, 0], { ...clamp, easing: SNAP })}deg`,
                    scale: interpolate(t, [0, ENTER_FRAMES], [0.55, 1], { ...clamp, easing: SNAP }),
                  };
          return (
            <span
              key={`w-${i}`}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                opacity,
                transformOrigin: kind === "rotate" ? "0% 100%" : "50% 60%",
                ...style,
              }}
            >
              {chunk.words[0].text}
            </span>
          );
        }

        // Từ punch: bật mạnh, khối nền chạy ngang đúng lúc lời đọc tới (lần lượt từng từ
        // của cụm), rung và nảy nhẹ. Khối lòi sang nửa khoảng trống hai bên để các từ
        // liền nhau trên cùng dòng nối thành một dải.
        const prevPunch = i > 0 && chunks[i - 1].punch;
        const nextPunch = i + 1 < chunks.length && chunks[i + 1].punch;
        let runIndex = 0;
        for (let j = i - 1; j >= 0 && chunks[j].punch; j--) runIndex++;
        const cluster = Math.min(appear, ...chunks.slice(i - runIndex, i + 1).map((c) => appearOf(c.words[0].offset)));
        // Nảy và rung dùng chung một mốc cho cả cụm (các từ không lệch nhau);
        // chỉ khối nền chạy lần lượt từng từ.
        const hit = Math.max(start, punch ? Math.max(punch.atFrame, cluster) : appear);
        const b = frame - hit;
        const blockScale = interpolate(b - runIndex * 2, [0, 4], [0, 1], { ...clamp, easing: SNAP });
        const pulse = interpolate(b, [0, 4, 12], [1, 1.12, 1], clamp);
        const shake = b >= 0 && b < 10 ? Math.sin(b * 2.6) * 9 * unit * (1 - b / 10) : 0;
        // Lòi quá nửa khoảng trống một chút để hai khối chồng lên nhau, không hở đường chỉ.
        const punchGap = Math.ceil(gap / 2) + 4;
        const pad = `${PUNCH_PAD_EM}em`;
        return (
          <span
            key={`p-${i}`}
            style={{
              position: "relative",
              display: "inline-block",
              whiteSpace: "nowrap",
              fontSize: size * PUNCH_SCALE,
              // Chừa chỗ cho phần khối lòi ra ở hai đầu cụm để không dính chữ bên cạnh.
              marginLeft: prevPunch ? 0 : pad,
              marginRight: nextPunch ? 0 : pad,
              color: blockScale > 0.5 ? swatch.hiFg : swatch.hi,
              opacity: interpolate(t, [0, 2], [0, 1], clamp),
              scale:
                interpolate(t, [0, ENTER_FRAMES * 0.7, ENTER_FRAMES], [2.4, 0.95, 1], {
                  ...clamp,
                  easing: [SNAP, Easing.out(Easing.quad)],
                }) * pulse,
              translate: `${shake}px 0px`,
              transformOrigin: "50% 55%",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: prevPunch ? -punchGap : `-${PUNCH_PAD_EM}em`,
                right: nextPunch ? -punchGap : `-${PUNCH_PAD_EM}em`,
                // Khối kế sau vẽ đè khối trước, phần chồng cùng màu nên không thấy.
                top: Math.round(size * PUNCH_SCALE * 0.1),
                bottom: Math.round(size * PUNCH_SCALE * 0.02),
                backgroundColor: swatch.hi,
                scale: `${blockScale} 1`,
                transformOrigin: "0% 50%",
              }}
            />
            <span style={{ position: "relative" }}>{chunk.words[0].text}</span>
          </span>
        );
      })}
    </div>
  );
};
