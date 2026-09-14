import { Easing, interpolate, useCurrentFrame } from "remotion";
import { useLayout } from "../shared";
import { GAP_EM, LINE_HEIGHT, outlineShadow, PUNCH_SCALE, WORD_FONT, WORD_WEIGHT } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type ShownWord = {
  /** Chữ đã in hoa. */
  text: string;
  /** Frame (có thể lẻ) từ bật vào. */
  appear: number;
  color: string;
  punch: boolean;
};

/**
 * Một cụm từ: chữ trắng viền đen dày, mỗi từ bật 0.6 → 1.08 → 1 trong 6 frame.
 * Cỡ chữ tính trên cả cụm nên khi thêm từ chữ không co giãn.
 */
export const WordGroup: React.FC<{ words: ShownWord[]; size: number; width: number }> = ({ words, size, width }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  return (
    <div
      style={{
        width,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        columnGap: GAP_EM * size,
        rowGap: 0,
        fontFamily: WORD_FONT,
        fontWeight: WORD_WEIGHT,
        fontSize: size,
        lineHeight: LINE_HEIGHT,
        // Chừa chỗ trên cho dấu chồng của dòng đầu (Ễ, Ấ) và viền.
        paddingTop: 6 * unit,
      }}
    >
      {words.map((w, i) => {
        const t = frame - w.appear;
        // Chỉ xếp từ đã tới lượt: cụm lớn dần từ giữa, không chừa ô trống lệch tâm.
        if (t < 0) return null;
        const fontSize = w.punch ? size * PUNCH_SCALE : size;
        return (
          <span
            key={`${i}-${w.text}`}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              fontSize,
              color: w.color,
              textShadow: outlineShadow(fontSize),
              opacity: interpolate(t, [0, 1], [0, 1], clamp),
              scale: interpolate(t, [0, 3, 6], [0.6, 1.08, 1], {
                ...clamp,
                easing: [Easing.out(Easing.cubic), Easing.inOut(Easing.quad)],
              }),
              transformOrigin: "50% 65%",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
