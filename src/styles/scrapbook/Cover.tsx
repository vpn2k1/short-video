/**
 * Bìa album mở đầu video: bìa vải bố màu nhấn sẫm, gáy bên trái, đường chỉ khâu, bọc góc đồng, nhãn giấy dán
 * giữa bìa có tiêu đề viết tay và dòng phụ; ảnh đầu tiên cài hờ ở góc bìa.
 * Cuối phần tiêu đề bìa lật mở sang trái (xoay 3D quanh gáy), lộ bảng kỷ niệm bên dưới.
 *
 * Frame 0 đã có đủ bìa + tiêu đề (làm ảnh đại diện được) — chỉ các chi tiết phụ hiện dần.
 */
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import type { useLayout } from "../shared";
import { Doodle } from "./paper";
import { CARD_PAPER, fitLines, HAND, INK, PHOTO_PAPER, SCRIPT, shade } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Bìa bắt đầu lật trước khi hết phần tiêu đề, xong sau đó ít frame — nối liền với ảnh đầu rơi xuống. */
export const COVER_OPEN_START = TITLE_FRAMES - 12;
export const COVER_OPEN_END = TITLE_FRAMES + 12;

const Corner: React.FC<{ size: number; style: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", ...style }}>
    <defs>
      <linearGradient id="sb-brass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f3dca0" />
        <stop offset="0.45" stopColor="#c89b45" />
        <stop offset="1" stopColor="#8a6424" />
      </linearGradient>
    </defs>
    <path d="M 0 0 L 100 0 L 0 100 Z" fill="url(#sb-brass)" />
    <path d="M 12 12 L 70 12 M 12 12 L 12 70" stroke="rgba(90,60,20,0.45)" strokeWidth={3} fill="none" />
  </svg>
);

export const AlbumCover: React.FC<{
  title: string;
  subtitle: string;
  accent: string;
  firstScene: Scene | null;
  frame: number;
  layout: ReturnType<typeof useLayout>;
  ready: boolean;
}> = ({ title, subtitle, accent, firstScene, frame, layout, ready }) => {
  const { width, height, unit, portrait } = layout;
  const open = interpolate(frame, [COVER_OPEN_START, COVER_OPEN_END], [0, 1], { ...clamp, easing: Easing.bezier(0.55, 0, 0.35, 1) });
  if (open >= 1) return null;

  // Bìa: dọc thì gần kín khung, ngang thì là cuốn album khổ ngang giữa khung.
  const coverW = portrait ? width * 0.9 : Math.min(width * 0.72, height * 1.25);
  const coverH = portrait ? Math.min(height * 0.86, coverW * 1.55) : height * 0.84;
  const cx = (width - coverW) / 2;
  const cy = (height - coverH) / 2;
  const spine = coverW * 0.075;
  const base = shade(accent, -0.5);

  // Nhãn giấy giữa bìa.
  const labelW = (coverW - spine) * 0.78;
  const labelPad = 44 * unit;
  const titleSize = fitLines(title, (portrait ? 118 : 96) * unit, 56 * unit, labelW - labelPad * 2, portrait ? 3 : 2, SCRIPT, 700, ready);
  const subSize = Math.min(52 * unit, titleSize * 0.5);

  const settle = interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  const subIn = interpolate(frame, [10, 22], [0, 1], clamp);
  const photoIn = interpolate(frame, [6, 24], [0, 1], { ...clamp, easing: Easing.spring({ damping: 12 }) });
  const photoW = (coverW - spine) * (portrait ? 0.4 : 0.2);
  const hasPhoto = Boolean(firstScene?.image);

  return (
    <AbsoluteFill style={{ perspective: 2600 * unit }}>
      {/* Bóng bìa đổ xuống bảng, nhạt dần khi bìa mở */}
      <AbsoluteFill style={{ backgroundColor: `rgba(25, 12, 2, ${(0.35 * (1 - open)).toFixed(3)})` }} />
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: coverW,
          height: coverH,
          transformOrigin: "0% 50%",
          transform: `rotateY(${(-105 * open).toFixed(2)}deg) scale(${(1.03 - 0.03 * settle).toFixed(4)})`,
          backfaceVisibility: "hidden",
        }}
      >
        {/* Vải bố: sợi ngang + sợi dọc + loang sáng */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: `${10 * unit}px ${22 * unit}px ${22 * unit}px ${10 * unit}px`,
            backgroundColor: base,
            backgroundImage: [
              "radial-gradient(ellipse at 38% 30%, rgba(255,255,255,0.16), transparent 60%)",
              `repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 ${1.5 * unit}px, transparent ${1.5 * unit}px ${4 * unit}px)`,
              `repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 ${1.5 * unit}px, transparent ${1.5 * unit}px ${4 * unit}px)`,
              "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.35) 100%)",
            ].join(", "),
            boxShadow: `0 ${24 * unit}px ${60 * unit}px rgba(20, 8, 0, 0.6), inset 0 0 ${4 * unit}px rgba(255,255,255,0.15)`,
            overflow: "hidden",
          }}
        >
          {/* Gáy */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: spine,
              background: `linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.12) 55%, rgba(0,0,0,0.35) 88%, rgba(0,0,0,0.1))`,
            }}
          />
          {/* Chỉ khâu viền */}
          <div
            style={{
              position: "absolute",
              left: spine + 22 * unit,
              top: 26 * unit,
              right: 26 * unit,
              bottom: 26 * unit,
              border: `${3.5 * unit}px dashed rgba(255, 236, 200, 0.55)`,
              borderRadius: 14 * unit,
            }}
          />
        </div>
        <Corner size={coverW * 0.12} style={{ right: -1, top: -1, rotate: "90deg" }} />
        <Corner size={coverW * 0.12} style={{ right: -1, bottom: -1, rotate: "180deg" }} />

        {/* Ảnh đầu tiên cài hờ ở góc trên */}
        {hasPhoto && photoIn > 0 ? (
          <div
            style={{
              position: "absolute",
              right: coverW * 0.08,
              top: coverH * (portrait ? 0.06 : 0.07),
              width: photoW,
              height: photoW * 1.12,
              padding: photoW * 0.05,
              paddingBottom: photoW * 0.17,
              boxSizing: "border-box",
              backgroundColor: PHOTO_PAPER,
              boxShadow: `0 ${6 * unit}px ${14 * unit}px rgba(0,0,0,0.4)`,
              rotate: `${(9 + (1 - photoIn) * 10).toFixed(2)}deg`,
              translate: `0 ${((1 - photoIn) * -60 * unit).toFixed(1)}px`,
              opacity: Math.min(1, photoIn * 2),
            }}
          >
            <div style={{ width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#d9d0bf" }}>
              <SceneMedia scene={firstScene!} from={0} zoom={1.05} />
            </div>
          </div>
        ) : null}

        {/* Nhãn giấy */}
        <div
          style={{
            position: "absolute",
            left: spine + (coverW - spine - labelW) / 2,
            top: coverH * (portrait ? 0.4 : 0.36),
            width: labelW,
            padding: `${labelPad * 0.9}px ${labelPad}px ${labelPad * 0.8}px`,
            boxSizing: "border-box",
            backgroundColor: CARD_PAPER,
            backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.6), rgba(230,215,185,0.35))",
            border: `${3 * unit}px solid ${shade(accent, -0.35)}`,
            outline: `${2 * unit}px solid ${shade(accent, -0.35)}`,
            outlineOffset: -12 * unit,
            borderRadius: 6 * unit,
            boxShadow: `0 ${6 * unit}px ${14 * unit}px rgba(0,0,0,0.35)`,
            rotate: "-1.5deg",
            textAlign: "center",
            color: INK,
          }}
        >
          <div style={{ fontFamily: SCRIPT, fontWeight: 700, fontSize: titleSize, lineHeight: 1.12 }}>{title}</div>
          <div style={{ position: "relative", height: 56 * unit, margin: `${10 * unit}px 0` }}>
            <Doodle kind="heart" size={50 * unit} color={accent} frame={frame} start={8} style={{ left: labelW / 2 - labelPad - 25 * unit, top: 2 * unit }} />
          </div>
          {subtitle ? (
            <div style={{ fontFamily: HAND, fontSize: subSize, lineHeight: 1.2, opacity: subIn, color: shade(INK, 0.15) }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
