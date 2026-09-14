/**
 * Các mảnh cắt dán nhỏ: nhãn highlighter (tag), câu nhấn (punch), giấy nhớ/con dấu
 * (visual), dòng lời đọc nhỏ ở đáy và trang tít kiểu báo mở đầu.
 */
import { interpolate, spring } from "remotion";
import type { Caption, SceneVisual } from "../../compositions/Short/schema";
import { FONTS, fitFontSize, seeded } from "../shared";
import { HIGHLIGHT, INK, PAPER_LIGHT } from "./palette";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * In hoa tiếng Việt bằng JS thay cho CSS text-transform: chuẩn hoá NFC trước để dấu
 * chồng (Ừ, Ể, Ữ…) là một glyph dựng sẵn, không bị tách dấu móc/hở chữ.
 */
export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi").normalize("NFC");

/** Chữ đậm dạng "nén" cho mảnh dán: SF heavy có đủ glyph tiếng Việt dựng sẵn. */
const HEAVY: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontWeight: 900,
  fontStretch: "condensed",
  letterSpacing: "-0.01em",
};

/** Nền highlighter quét từ trái sang, lặp cho từng dòng khi chữ xuống dòng. */
const sweep = (progress: number, color = HIGHLIGHT): React.CSSProperties => ({
  backgroundImage: `linear-gradient(100deg, ${color} 0%, ${color} 96%, transparent 100%)`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "0 78%",
  backgroundSize: `${progress * 100}% 64%`,
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
});

/** Nhãn vàng nghiêng, bật ra sau hero vài frame. */
export const Tag: React.FC<{ text: string; f: number; fps: number; unit: number; sceneIndex: number }> = ({
  text,
  f,
  fps,
  unit,
  sceneIndex,
}) => {
  const s = spring({ frame: f, fps, config: { damping: 9, stiffness: 170 } });
  if (f < 0) return null;
  const rot = seeded(`vox-tag-${sceneIndex}`, -7, -2);
  return (
    <div
      style={{
        display: "inline-block",
        backgroundColor: HIGHLIGHT,
        color: INK,
        ...HEAVY,
        fontSize: fitFontSize(text, 60 * unit, 0.7),
        lineHeight: 1.2,
        padding: `${10 * unit}px ${26 * unit}px ${8 * unit}px`,
        whiteSpace: "nowrap",
        boxShadow: `${4 * unit}px ${6 * unit}px 0 rgba(28,25,22,0.85)`,
        transform: `scale(${Math.max(0, s)}) rotate(${rot + (1 - s) * -20}deg)`,
        transformOrigin: "20% 60%",
      }}
    >
      {upperVi(text)}
    </div>
  );
};

/** Giấy nhớ (stat) hoặc con dấu (badge). */
export const VisualBit: React.FC<{
  visual: SceneVisual;
  f: number;
  fps: number;
  unit: number;
  sceneIndex: number;
  note: string;
  stamp: string;
}> = ({ visual, f, fps, unit, sceneIndex, note, stamp }) => {
  if (f < 0) return null;
  const k = `vox-visual-${sceneIndex}`;
  if (visual.type === "badge") {
    // Con dấu: đập xuống to rồi co lại, mực hơi loang.
    const scale = interpolate(f, [0, 5, 9], [2, 0.94, 1], clamp);
    const rot = seeded(k, -14, -6);
    return (
      <div
        style={{
          display: "inline-block",
          color: stamp,
          border: `${7 * unit}px double ${stamp}`,
          borderRadius: 10 * unit,
          padding: `${8 * unit}px ${24 * unit}px`,
          ...HEAVY,
          fontSize: fitFontSize(visual.text, 66 * unit, 0.6),
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          // Nền giấy gần đục: con dấu phải đọc được cả khi đè lên ảnh tối.
          backgroundColor: "rgba(251,247,238,0.9)",
          boxShadow: `${3 * unit}px ${6 * unit}px ${10 * unit}px rgba(40,28,10,0.25)`,
          opacity: interpolate(f, [0, 3], [0, 1], clamp),
          transform: `scale(${scale}) rotate(${rot}deg)`,
          textAlign: "center",
        }}
      >
        {upperVi(visual.text)}
        {visual.caption ? (
          <div style={{ fontSize: 26 * unit, fontWeight: 600, letterSpacing: 0 }}>{visual.caption}</div>
        ) : null}
      </div>
    );
  }
  const s = spring({ frame: f, fps, config: { damping: 10, stiffness: 130 } });
  const size = 270 * unit;
  const rot = seeded(k, 4, 9);
  return (
    <div
      style={{
        position: "relative",
        width: size,
        minHeight: size,
        backgroundColor: note,
        boxShadow: `${4 * unit}px ${12 * unit}px ${16 * unit}px rgba(40,28,10,0.28)`,
        padding: `${30 * unit}px ${20 * unit}px ${22 * unit}px`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6 * unit,
        color: INK,
        transform: `translateY(${(1 - s) * -80 * unit}px) scale(${0.6 + 0.4 * s}) rotate(${rot + (1 - s) * 25}deg)`,
        opacity: interpolate(f, [0, 3], [0, 1], clamp),
      }}
    >
      <div
        style={{
          ...HEAVY,
          fontSize: fitFontSize(visual.text, 124 * unit, 0.4),
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {visual.text}
      </div>
      {visual.caption ? (
        <div
          style={{
            fontFamily: FONTS.serif,
            fontStyle: "italic",
            fontSize: 30 * unit,
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          {visual.caption}
        </div>
      ) : null}
      {/* ghim băng dính nhỏ */}
      <div
        style={{
          position: "absolute",
          top: -18 * unit,
          left: size / 2 - 55 * unit,
          width: 110 * unit,
          height: 38 * unit,
          backgroundColor: "rgba(255,255,255,0.55)",
          transform: `rotate(${-rot * 0.8}deg)`,
        }}
      />
    </div>
  );
};

/** Ước lượng cỡ chữ condensed in hoa để vừa cột: không từ nào tràn, tối đa ~3 dòng. */
const fitColumn = (text: string, base: number, colWidth: number) => {
  const words = text.split(/\s+/);
  const longest = Math.max(4, ...words.map((w) => [...w].length));
  const total = Math.max(4, [...text].length);
  return Math.min(fitFontSize(text, base, 0.5), colWidth / (longest * 0.62), (3 * colWidth) / (total * 0.6));
};

/** Câu nhấn: chữ đậm condensed, highlighter quét phía sau, bật ra đúng lúc giọng đọc tới. */
export const Punch: React.FC<{
  text: string;
  f: number;
  fps: number;
  frame: number;
  unit: number;
  width: number;
  align: "center" | "left";
  sceneIndex: number;
}> = ({ text, f, fps, frame, unit, width, align, sceneIndex }) => {
  if (f < 0) return null;
  const s = spring({ frame: f, fps, config: { damping: 9, stiffness: 180 } });
  const progress = interpolate(f, [3, 15], [0, 1], { ...clamp });
  const baseRot = seeded(`vox-punch-${sceneIndex}`, -3.5, -1);
  const idle = Math.sin(((frame + sceneIndex * 37) / (fps * 3.7)) * Math.PI * 2) * 0.7;
  const fontSize = fitColumn(text, 118 * unit, width);
  return (
    <div
      style={{
        width,
        textAlign: align,
        transform: `scale(${0.35 + 0.65 * s}) rotate(${baseRot + (1 - s) * -10 + idle}deg)`,
        transformOrigin: align === "left" ? "0% 50%" : "50% 50%",
        opacity: interpolate(f, [0, 2], [0, 1], clamp),
      }}
    >
      <span
        style={{
          // SF heavy: Avenir Next Condensed ghép dấu móc (Ừ, Ở) bị hở. In hoa bằng upperVi, không CSS.
          ...HEAVY,
          fontSize,
          lineHeight: 1.26,
          color: INK,
          padding: `0 ${14 * unit}px`,
          ...sweep(progress),
        }}
      >
        {upperVi(text)}
      </span>
    </div>
  );
};

/** Dòng lời đọc nhỏ, khiêm tốn ở đáy — cho người xem tắt tiếng, không phải phụ đề to. */
export const CaptionLine: React.FC<{
  caption: Caption;
  localFrame: number;
  unit: number;
  maxWidth: number;
}> = ({ caption, localFrame, unit, maxWidth }) => {
  const text = caption.text.trim();
  if (!text) return null;
  const len = [...text].length;
  const inner = maxWidth - 48 * unit;
  const fontSize = Math.max(28 * unit, Math.min(38 * unit, inner / (len * 0.5)));
  const t = interpolate(localFrame, [0, 7], [0, 1], { ...clamp });
  return (
    <div
      style={{
        maxWidth,
        display: "inline-flex",
        alignItems: "center",
        gap: 14 * unit,
        backgroundColor: "rgba(251, 247, 238, 0.92)",
        color: "#2B2622",
        fontFamily: FONTS.sans,
        fontWeight: 500,
        fontSize,
        lineHeight: 1.3,
        padding: `${10 * unit}px ${22 * unit}px`,
        boxShadow: `0 ${3 * unit}px ${8 * unit}px rgba(40,28,10,0.14)`,
        opacity: t,
        transform: `translateY(${(1 - t) * 14 * unit}px)`,
      }}
    >
      <div style={{ width: 10 * unit, height: 10 * unit, backgroundColor: INK, flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
};

/** Trang tít mở đầu kiểu báo in, dán trên tờ giấy trắng, highlighter vàng quét qua tít. */
export const TitlePage: React.FC<{
  title: string;
  subtitle: string;
  handle: string;
  f: number;
  total: number;
  fps: number;
  unit: number;
  maxWidth: number;
}> = ({ title, subtitle, handle, f, total, fps, unit, maxWidth }) => {
  const s = spring({ frame: f, fps, config: { damping: 11, stiffness: 120 } });
  const out = interpolate(f, [total - 10, total], [0, 1], { ...clamp });
  const sweepP = interpolate(f, [12, 30], [0, 1], { ...clamp });
  const subT = interpolate(f, [18, 28], [0, 1], { ...clamp });
  const headline = fitFontSize(title, 124 * unit, 0.5);
  return (
    <div
      style={{
        width: maxWidth,
        backgroundColor: PAPER_LIGHT,
        padding: `${46 * unit}px ${50 * unit}px ${54 * unit}px`,
        boxSizing: "border-box",
        boxShadow: `${8 * unit}px ${20 * unit}px ${36 * unit}px rgba(40,28,10,0.3)`,
        color: INK,
        transform: `translateY(${(1 - s) * 260 * unit - out * 900 * unit}px) rotate(${-1.8 + (1 - s) * 8 + out * -12}deg)`,
        opacity: interpolate(f, [0, 4], [0, 1], clamp) * (1 - out * 0.4),
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20 * unit,
          fontFamily: FONTS.mono,
          fontSize: 24 * unit,
          letterSpacing: 0,
          borderTop: `${6 * unit}px solid ${INK}`,
          borderBottom: `${2 * unit}px solid ${INK}`,
          padding: `${10 * unit}px 0`,
          marginBottom: 30 * unit,
        }}
      >
        <span>{upperVi(handle || "Hồ sơ")}</span>
        <span>{upperVi("Giải thích")}</span>
      </div>
      <div
        style={{
          fontFamily: FONTS.serif,
          fontWeight: 700,
          fontSize: headline,
          lineHeight: 1.18,
          letterSpacing: -1 * unit,
        }}
      >
        <span style={{ padding: `0 ${8 * unit}px`, ...sweep(sweepP) }}>{title}</span>
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 26 * unit,
            fontFamily: FONTS.serif,
            fontStyle: "italic",
            fontSize: 44 * unit,
            lineHeight: 1.3,
            opacity: subT,
            transform: `translateY(${(1 - subT) * 20 * unit}px)`,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
