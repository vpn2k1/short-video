import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { useShape } from "../depth/Stage";
import { useLayout } from "../shared";
import { clamp, SANS, type Palette } from "./three";

/**
 * Chữ của màn tiêu đề (vật 3D — nút xoắn crôm — do World vẽ phía trên). Tiêu đề crôm hiện TỪNG TỪ: mỗi từ trồi lên
 * từ nhoè, vệt sáng quét qua cả dòng khi đủ chữ; dòng phụ trên viên kính mờ. 12 frame cuối cả khối
 * mờ và thu nhỏ khi tấm ảnh đầu tiên xoay tới.
 */
export const ThreeTitle: React.FC<{ title: string; subtitle: string; palette: Palette }> = ({ title, subtitle, palette }) => {
  const frame = useCurrentFrame();
  const { unit, width, height, safe, fps } = useLayout();
  const { wide, square } = useShape();
  const words = title.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  const step = Math.min(4, 24 / Math.max(1, words.length));
  const length = [...title.trim()].length;
  const base = (wide ? 104 : square ? 100 : 116) * unit;
  const size = Math.round(base * (length <= 14 ? 1 : Math.max(0.55, Math.sqrt(14 / length))));
  const wordsDone = 10 + words.length * step;
  const shine = interpolate(frame, [wordsDone, wordsDone + 20], [0, 1], clamp);
  const sub = spring({ frame: frame - wordsDone - 2, fps, config: { damping: 16 } });
  const leave = interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES], [0, 1], clamp);
  const boxWidth = wide ? width * 0.7 : width - safe.side * 2 + 40 * unit;
  const top = wide ? height * 0.62 : square ? height * 0.6 : height * 0.56;

  return (
    <AbsoluteFill style={{ opacity: 1 - leave, scale: String(1 - leave * 0.12) }}>
      <div
        style={{
          position: "absolute",
          left: (width - boxWidth) / 2,
          width: boxWidth,
          top,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26 * unit,
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: size, lineHeight: 1.12, textAlign: "center", textWrap: "balance" }}>
          {words.map((word, i) => {
            const rise = spring({ frame: frame - 10 - i * step, fps, config: { damping: 14, mass: 0.6 } });
            return (
              <span key={i}>
                <span
                  style={{
                    display: "inline-block",
                    backgroundImage: [
                      `linear-gradient(105deg, transparent ${shine * 130 - 30}%, rgba(255,255,255,0.95) ${shine * 130 - 18}%, transparent ${shine * 130 - 6}%)`,
                      `linear-gradient(180deg, #ffffff 0%, #dfe6f2 38%, ${i === words.length - 1 ? palette.key : "#b9c3d6"} 62%, #f4f7ff 100%)`,
                    ].join(", "),
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    filter: `drop-shadow(0 ${5 * unit}px 0 hsla(${palette.hue}, 60%, 18%, 0.9)) drop-shadow(0 ${16 * unit}px ${26 * unit}px rgba(0,0,0,0.55)) blur(${interpolate(rise, [0, 0.7], [10 * unit, 0], clamp)}px)`,
                    translate: `0 ${interpolate(rise, [0, 1], [50 * unit, 0])}px`,
                    opacity: interpolate(rise, [0, 0.4], [0, 1], clamp),
                  }}
                >
                  {word}
                </span>
                {i < words.length - 1 ? " " : null}
              </span>
            );
          })}
        </div>
        {subtitle.trim() ? (
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: (wide ? 38 : 42) * unit,
              lineHeight: 1.3,
              textAlign: "center",
              color: "#eef2ff",
              padding: `${10 * unit}px ${30 * unit}px`,
              borderRadius: 999,
              background: "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 45%, rgba(10,12,24,0.35))",
              backdropFilter: `blur(${16 * unit}px)`,
              border: `${1.5 * unit}px solid rgba(255,255,255,0.28)`,
              opacity: sub,
              translate: `0 ${interpolate(sub, [0, 1], [24 * unit, 0])}px`,
            }}
          >
            {subtitle.normalize("NFC").trim()}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
