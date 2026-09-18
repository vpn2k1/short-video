/**
 * Các món dán lên trang: khung nhãn vẽ tay, ảnh polaroid dán băng keo, giấy note
 * vàng, con số được khoanh tròn, và ghi chú cụm nhấn dự phòng.
 * Mọi chuyển động tính từ `appear` (frame tuyệt đối trang bắt đầu diễn).
 */
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import type { SceneCrop } from "../../compositions/Short/schema";
import { Easing, Img, interpolate, Sequence, staticFile } from "remotion";
import { seeded } from "../shared";
import { HAND, INK, PENCIL, roughBox, roughEllipse, STICKY, textWidth } from "./sketch";
import { DrawnPath, WrittenText } from "./written";

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Rơi xuống hơi nảy. */
const DROP = Easing.bezier(0.34, 1.45, 0.64, 1);

// ---------------------------------------------------------------------------
// Nhãn trong khung vẽ tay
// ---------------------------------------------------------------------------
export const TagBox: React.FC<{
  text: string;
  x: number;
  y: number;
  unit: number;
  maxWidth: number;
  appear: number;
  frame: number;
  accent: string;
  seed: string;
}> = ({ text, x, y, unit, maxWidth, appear, frame, accent, seed }) => {
  const padX = 28 * unit;
  const padY = 10 * unit;
  let fontSize = 50 * unit;
  const natural = textWidth(text, fontSize);
  if (natural + padX * 2 > maxWidth) fontSize *= (maxWidth - padX * 2) / natural;
  const w = Math.min(maxWidth, textWidth(text, fontSize) + padX * 2);
  const h = fontSize * 1.3 + padY * 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        rotate: `${seeded(`${seed}-tag-rot`, -3, 1).toFixed(2)}deg`,
      }}
    >
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <DrawnPath
          d={roughBox(w, h, `${seed}-tag`, 5 * unit)}
          progress={interpolate(frame, [appear, appear + 16], [0, 1], clamp)}
          color={accent}
          width={5 * unit}
        />
      </svg>
      <div style={{ position: "absolute", left: padX, top: padY, whiteSpace: "nowrap" }}>
        <WrittenText
          text={text}
          fontSize={fontSize}
          progress={interpolate(frame, [appear + 6, appear + 20], [0, 1], clamp)}
          maxWidth={w}
          seed={`${seed}-tagtext`}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ảnh polaroid dán băng keo
// ---------------------------------------------------------------------------
export const Polaroid: React.FC<{
  src: string;
  photoW: number;
  cx: number;
  cy: number;
  unit: number;
  appear: number;
  frame: number;
  seed: string;
  /** Clip video: cắt đầu và tiếng gốc chỉnh trong trình chỉnh sửa. */
  trimStartMs?: number;
  /** Tốc độ phát của cảnh video. */
  speed?: number;
  volume?: number;
  crop?: SceneCrop | null;
}> = ({ src, photoW, cx, cy, unit, appear, frame, seed, trimStartMs, speed, volume, crop }) => {
  const photoH = photoW * 0.78;
  const s = photoW / 600;
  const pad = 22 * s;
  const bottom = 86 * s;
  const totalW = photoW + pad * 2;
  const totalH = photoH + pad + bottom;
  const drop = interpolate(frame, [appear, appear + 20], [0, 1], { ...clamp, easing: DROP });
  const opacity = interpolate(frame, [appear, appear + 5], [0, 1], clamp);
  const sway = Math.sin((frame - appear) / 38) * 0.7;
  const rotation = seeded(`${seed}-pol-rot`, -3.5, 3.5) + sway + (1 - drop) * -7;
  const zoom = 1 + interpolate(frame, [appear, appear + 300], [0, 0.06], clamp);
  const tapeW = totalW * 0.3;
  const tapeH = 52 * s;
  const tape: React.CSSProperties = {
    position: "absolute",
    top: -tapeH * 0.45,
    width: tapeW,
    height: tapeH,
    backgroundColor: "rgba(238, 226, 184, 0.72)",
    clipPath: "polygon(3% 0, 97% 6%, 100% 48%, 96% 100%, 2% 94%, 0 45%)",
  };

  return (
    <div
      style={{
        position: "absolute",
        left: cx - totalW / 2,
        top: cy - totalH / 2,
        width: totalW,
        height: totalH,
        opacity,
        backgroundColor: "#fffefa",
        boxShadow: `0 ${16 * unit}px ${36 * unit}px rgba(45, 32, 15, 0.28), 0 ${2 * unit}px ${4 * unit}px rgba(0,0,0,0.12)`,
        transform: `translateY(${((1 - drop) * -140 * unit).toFixed(1)}px) rotate(${rotation.toFixed(2)}deg)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: pad,
          top: pad,
          width: photoW,
          height: photoH,
          overflow: "hidden",
          backgroundColor: "#d9d4ca",
        }}
      >
        {VIDEO_EXT.test(src) ? (
          // Clip người dùng tải lên: phát từ lúc ảnh xuất hiện, tắt tiếng, lặp nếu ngắn.
          <Sequence from={appear} layout="none">
            <ClipVideo src={src} trimStartMs={trimStartMs} speed={speed} volume={volume} crop={crop} />
          </Sequence>
        ) : (
          <div style={{ width: "100%", height: "100%", scale: String(zoom) }}>
            <CropBox crop={crop}>
              <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </CropBox>
          </div>
        )}
      </div>
      <div style={{ ...tape, left: -tapeW * 0.28, rotate: "-34deg" }} />
      <div style={{ ...tape, right: -tapeW * 0.28, rotate: "36deg" }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Giấy note vàng (visual "badge")
// ---------------------------------------------------------------------------
export const StickyNote: React.FC<{
  text: string;
  caption: string | null;
  cx: number;
  cy: number;
  size: number;
  unit: number;
  appear: number;
  frame: number;
  seed: string;
}> = ({ text, caption, cx, cy, size, unit, appear, frame, seed }) => {
  const inner = size * 0.82;
  const base = size * (caption ? 0.26 : 0.3);
  const fontSize = Math.max(size * 0.14, Math.min(base, (inner * base) / Math.max(1, textWidth(text, base))));
  const captionSize = size * 0.11;
  const pop = interpolate(frame, [appear, appear + 14], [0, 1], { ...clamp, easing: DROP });
  const rotation = seeded(`${seed}-sticky-rot`, -6, 6) + (1 - pop) * 12;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        opacity: interpolate(frame, [appear, appear + 4], [0, 1], clamp),
        scale: String(1.3 - pop * 0.3),
        rotate: `${rotation.toFixed(2)}deg`,
        background: `linear-gradient(165deg, #fff3a6 0%, ${STICKY} 55%, #f4d24e 100%)`,
        boxShadow: `0 ${14 * unit}px ${26 * unit}px rgba(70, 52, 0, 0.26)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: size * 0.03,
        padding: size * 0.09,
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -size * 0.06,
          left: size * 0.3,
          width: size * 0.4,
          height: size * 0.12,
          backgroundColor: "rgba(255, 255, 255, 0.45)",
          rotate: "-3deg",
        }}
      />
      <WrittenText
        text={text}
        fontSize={fontSize}
        align="center"
        lineHeight={1.2}
        progress={interpolate(frame, [appear + 6, appear + 22], [0, 1], clamp)}
        maxWidth={inner}
        seed={`${seed}-sticky`}
      />
      {caption ? (
        <WrittenText
          text={caption}
          fontSize={captionSize}
          align="center"
          lineHeight={1.2}
          color="#5d5638"
          progress={interpolate(frame, [appear + 18, appear + 34], [0, 1], clamp)}
          maxWidth={inner}
          seed={`${seed}-sticky-cap`}
        />
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Con số được khoanh tròn (visual "stat")
// ---------------------------------------------------------------------------
export const StatNote: React.FC<{
  text: string;
  caption: string | null;
  cx: number;
  cy: number;
  boxW: number;
  boxH: number;
  unit: number;
  appear: number;
  frame: number;
  accent: string;
  seed: string;
  /** Có ảnh bên cạnh thì đặt trên một tấm thẻ giấy cho khỏi lẫn vào ảnh. */
  card: boolean;
}> = ({ text, caption, cx, cy, boxW, boxH, unit, appear, frame, accent, seed, card }) => {
  const padding = card ? 26 * unit : 0;
  const innerW = boxW - padding * 2;
  const captionSize = caption ? Math.min(46 * unit, innerW * 0.1) : 0;
  const captionH = caption ? captionSize * 1.25 * 2 : 0;
  const numberBoxH = (boxH - padding * 2 - captionH) / 1.45;
  const fontSize = Math.max(
    30 * unit,
    Math.min(numberBoxH, (innerW * 0.66 * 100) / Math.max(1, textWidth(text, 100))),
  );
  const tw = textWidth(text, fontSize);
  const rx = tw / 2 + fontSize * 0.3;
  const ry = fontSize * 0.64;
  const svgW = rx * 2 + fontSize * 0.3;
  const svgH = ry * 2 + fontSize * 0.3;
  const pop = interpolate(frame, [appear, appear + 12], [0, 1], { ...clamp, easing: DROP });
  return (
    <div
      style={{
        position: "absolute",
        left: cx - boxW / 2,
        top: cy - boxH / 2,
        width: boxW,
        height: boxH,
        padding,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(frame, [appear, appear + 4], [0, 1], clamp),
        rotate: `${(seeded(`${seed}-stat-rot`, -3, 3) + (1 - pop) * 6).toFixed(2)}deg`,
        scale: String(1.15 - pop * 0.15),
        ...(card
          ? {
              backgroundColor: "#fffdf6",
              boxShadow: `0 ${12 * unit}px ${26 * unit}px rgba(45, 32, 15, 0.24)`,
              backgroundImage: `linear-gradient(180deg, transparent ${18 * unit}px, rgba(214,70,70,0.35) ${18 * unit}px, rgba(214,70,70,0.35) ${20 * unit}px, transparent ${20 * unit}px)`,
            }
          : {}),
      }}
    >
      <div style={{ position: "relative", height: fontSize * 1.45, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg
          width={svgW}
          height={svgH}
          style={{ position: "absolute", left: `calc(50% - ${(svgW / 2).toFixed(1)}px)`, top: `calc(50% - ${(svgH / 2).toFixed(1)}px)`, overflow: "visible" }}
        >
          <DrawnPath
            d={roughEllipse(svgW / 2, svgH / 2, rx, ry, `${seed}-stat`)}
            progress={interpolate(frame, [appear + 8, appear + 28], [0, 1], clamp)}
            color={accent}
            width={Math.max(4, fontSize * 0.055)}
          />
        </svg>
        <div style={{ whiteSpace: "nowrap", position: "relative" }}>
          <WrittenText
            text={text}
            fontSize={fontSize}
            lineHeight={1.2}
            progress={interpolate(frame, [appear, appear + 10], [0, 1], clamp)}
            maxWidth={innerW}
            seed={`${seed}-statnum`}
          />
        </div>
      </div>
      {caption ? (
        <WrittenText
          text={caption}
          fontSize={captionSize}
          align="center"
          lineHeight={1.25}
          color={PENCIL}
          progress={interpolate(frame, [appear + 22, appear + 38], [0, 1], clamp)}
          maxWidth={innerW}
          seed={`${seed}-statcap`}
        />
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Cụm nhấn không khớp nguyên văn lời thoại → viết riêng thành ghi chú
// ---------------------------------------------------------------------------
export const PunchNote: React.FC<{
  text: string;
  cx: number;
  cy: number;
  maxWidth: number;
  unit: number;
  atFrame: number;
  frame: number;
  accent: string;
  seed: string;
}> = ({ text, cx, cy, maxWidth, unit, atFrame, frame, accent, seed }) => {
  const fontSize = Math.max(48 * unit, Math.min(104 * unit, (maxWidth * 0.9 * 100) / Math.max(1, textWidth(text, 100))));
  return (
    <div
      style={{
        position: "absolute",
        left: cx - maxWidth / 2,
        top: cy,
        width: maxWidth,
        translate: "0 -50%",
        display: "flex",
        justifyContent: "center",
        fontFamily: HAND,
        color: INK,
      }}
    >
      <WrittenText
        text={text}
        fontSize={fontSize}
        align="center"
        progress={interpolate(frame, [atFrame - 6, atFrame + 10], [0, 1], clamp)}
        maxWidth={maxWidth}
        seed={`${seed}-note`}
        punch={{
          text,
          accent,
          colorT: interpolate(frame, [atFrame, atFrame + 6], [0, 1], clamp),
          draw: interpolate(frame, [atFrame + 6, atFrame + 22], [0, 1], clamp),
        }}
      />
    </div>
  );
};
