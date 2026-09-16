/**
 * "Sticker" chính của cảnh: ảnh cắt nền (.png), ảnh chụp/video có viền trắng + băng dính,
 * hoặc mẩu báo cắt khi cảnh không có ảnh. Kích thước khung do index.tsx tính.
 */
import { ClipVideo } from "../../scenes/ClipVideo";
import type { SceneCrop } from "../../compositions/Short/schema";
import { Img, Sequence, staticFile } from "remotion";
import { FONTS, seeded } from "../shared";
import { INK, PAPER_LIGHT } from "./palette";

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
const CUTOUT_EXT = /\.png$/i;

export type HeroKind = "cutout" | "photo" | "video" | "clipping";

export const heroKind = (image: string | null): HeroKind => {
  if (!image) return "clipping";
  if (VIDEO_EXT.test(image)) return "video";
  if (CUTOUT_EXT.test(image)) return "cutout";
  return "photo";
};

/** Khung (rộng × cao) của hero theo loại, từ cạnh gốc S. */
export const heroBox = (kind: HeroKind, size: number) => {
  if (kind === "cutout") return { w: size, h: size };
  if (kind === "clipping") return { w: size * 0.92, h: size * 0.78 };
  return { w: size, h: size * 0.9 };
};

/** Mép giấy xé: đa giác răng cưa ngẫu nhiên nhưng cố định theo khoá. */
const tornClip = (key: string, teeth = 22, depth = 2.4) => {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    top.push(`${x.toFixed(2)}% ${seeded(`${key}-t${i}`, 0, depth).toFixed(2)}%`);
    bottom.push(`${(100 - x).toFixed(2)}% ${(100 - seeded(`${key}-b${i}`, 0, depth)).toFixed(2)}%`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
};

/** Mẩu băng dính mờ, hai đầu răng cưa. */
export const Tape: React.FC<{ unit: number; rotate: number; style?: React.CSSProperties }> = ({
  unit,
  rotate,
  style,
}) => (
  <div
    style={{
      position: "absolute",
      width: 190 * unit,
      height: 56 * unit,
      backgroundColor: "rgba(236, 226, 196, 0.78)",
      boxShadow: `0 ${2 * unit}px ${4 * unit}px rgba(0,0,0,0.08)`,
      clipPath:
        "polygon(0% 8%, 3% 0%, 97% 4%, 100% 14%, 97% 30%, 100% 50%, 97% 70%, 100% 88%, 96% 100%, 4% 96%, 0% 86%, 3% 66%, 0% 48%, 3% 28%)",
      transform: `rotate(${rotate}deg)`,
      ...style,
    }}
  />
);

type Props = {
  image: string | null;
  kind: HeroKind;
  w: number;
  h: number;
  unit: number;
  sceneIndex: number;
  sceneStart: number;
  title: string;
  /** Clip video: cắt đầu và tiếng gốc chỉnh trong trình chỉnh sửa. */
  trimStartMs?: number;
  /** Tốc độ phát của cảnh video. */
  speed?: number;
  volume?: number;
  crop?: SceneCrop | null;
};

export const Hero: React.FC<Props> = ({ image, kind, w, h, unit, sceneIndex, sceneStart, title, trimStartMs, speed, volume, crop }) => {
  const key = `vox-hero-${sceneIndex}`;

  if (kind === "cutout" && image) {
    // Viền sticker trắng bám theo silhouette: 4 bóng trắng không nhoè theo 4 hướng
    // cộng dồn thành viền, thêm một bóng tối mềm để nhấc khỏi mặt giấy.
    const e = Math.max(2, Math.round(7 * unit));
    return (
      <Img
        src={staticFile(image)}
        style={{
          width: w,
          height: h,
          objectFit: "contain",
          filter: [
            `drop-shadow(${e}px 0 0 #fff)`,
            `drop-shadow(-${e}px 0 0 #fff)`,
            `drop-shadow(0 ${e}px 0 #fff)`,
            `drop-shadow(0 -${e}px 0 #fff)`,
            `drop-shadow(${6 * unit}px ${16 * unit}px ${14 * unit}px rgba(40, 28, 10, 0.38))`,
          ].join(" "),
        }}
      />
    );
  }

  if (kind === "clipping") {
    // Không có ảnh: mẩu báo cắt — tên video làm măng-sét, số cảnh to, dòng chữ giả.
    const lines = [0.96, 0.88, 0.93, 0.7, 0.9, 0.82];
    return (
      <div style={{ width: w, height: h, filter: `drop-shadow(${6 * unit}px ${14 * unit}px ${12 * unit}px rgba(40,28,10,0.3))` }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: PAPER_LIGHT,
            clipPath: tornClip(key),
            padding: `${46 * unit}px ${50 * unit}px`,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 16 * unit,
            color: INK,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.serif,
              fontWeight: 700,
              fontSize: 34 * unit,
              letterSpacing: 0,
              borderTop: `${5 * unit}px solid ${INK}`,
              borderBottom: `${2 * unit}px solid ${INK}`,
              padding: `${8 * unit}px 0`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {(title || "Hồ sơ").normalize("NFC").toLocaleUpperCase("vi")}
          </div>
          <div style={{ display: "flex", gap: 30 * unit, flex: 1, minHeight: 0 }}>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontWeight: 700,
                fontSize: 220 * unit,
                lineHeight: 0.9,
                color: INK,
              }}
            >
              {String(sceneIndex + 1).padStart(2, "0")}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 * unit }}>
              {lines.map((l, i) => (
                <div
                  key={i}
                  style={{ height: 13 * unit, width: `${l * 100}%`, backgroundColor: "rgba(28,25,22,0.22)", borderRadius: 3 * unit }}
                />
              ))}
            </div>
          </div>
          {lines.slice(0, 3).map((l, i) => (
            <div
              key={`b${i}`}
              style={{ height: 13 * unit, width: `${(l - 0.05) * 100}%`, backgroundColor: "rgba(28,25,22,0.18)", borderRadius: 3 * unit }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Ảnh chụp hoặc video: viền trắng dày, bóng mềm, băng dính.
  const border = 20 * unit;
  const tapeRot = seeded(`${key}-tape`, -8, 8);
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        backgroundColor: "#fff",
        padding: border,
        boxSizing: "border-box",
        boxShadow: `${6 * unit}px ${18 * unit}px ${34 * unit}px rgba(40, 28, 10, 0.32), 0 0 0 ${1 * unit}px rgba(0,0,0,0.05)`,
      }}
    >
      <div style={{ width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#ddd" }}>
        {kind === "video" && image ? (
          <Sequence from={sceneStart} layout="none">
            <ClipVideo src={image} trimStartMs={trimStartMs} speed={speed} volume={volume} crop={crop} />
          </Sequence>
        ) : image ? (
          <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
      </div>
      <Tape unit={unit} rotate={tapeRot} style={{ left: w / 2 - 95 * unit, top: -26 * unit }} />
    </div>
  );
};
