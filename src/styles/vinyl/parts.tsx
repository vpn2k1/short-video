/**
 * Đĩa than, vòng phổ nhạc, cần đọc đĩa, bìa đĩa và nền của phong cách "Đĩa than".
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { accentHue, BANDS, clamp, useLevels } from "../music";
import { activeIndexAt, Grain, seeded, useLayout } from "../shared";

export const VINYL_FONTS = ["bevietnam"];
export const FONT = FONT_CATALOG.bevietnam.stack;

/** 33⅓ vòng/phút. */
const DEG_PER_SECOND = (100 / 3 / 60) * 360;

export type Palette = { hue: number; base: string; accent: string; accent2: string };

export const paletteFor = (accent: string): Palette => {
  const hue = accentHue(accent, 330);
  return { hue, base: `hsl(${hue}, 30%, 6%)`, accent: `hsl(${hue}, 100%, 64%)`, accent2: `hsl(${(hue + 55) % 360}, 100%, 66%)` };
};

/* ------------------------------------------------------------ nền */

/** Nền tối: ảnh cảnh nhoè rất tối (nếu có), quầng màu sau đĩa phồng theo bass, bụi bay chậm. */
export const Backdrop: React.FC<{ scenes: Scene[]; palette: Palette; cx: number; cy: number; r: number }> = ({ scenes, palette, cx, cy, r }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const { bass, kick } = useLevels();
  const scene = scenes[Math.max(0, activeIndexAt(scenes, frame))];
  const glow = r * 2.6 * (1 + kick * 0.08);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.base, overflow: "hidden" }}>
      {scene?.image ? (
        <AbsoluteFill style={{ scale: "1.5", filter: `blur(${60 * unit}px) saturate(1.5) brightness(0.32)` }}>
          <SceneMedia scene={scene} from={msToFrames(scene.startMs)} />
        </AbsoluteFill>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: cx - glow / 2,
          top: cy - glow / 2,
          width: glow,
          height: glow,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${palette.accent} 0%, transparent 62%)`,
          opacity: 0.22 + bass * 0.3,
        }}
      />
      {Array.from({ length: 22 }, (_, i) => {
        const size = seeded(`dust-s${i}`, 2, 6) * unit;
        const speed = seeded(`dust-v${i}`, 0.2, 0.7) * unit;
        const x = seeded(`dust-x${i}`, 0, width) + Math.sin(frame / 40 + i) * 12 * unit;
        const y = (seeded(`dust-y${i}`, 0, height) - frame * speed + height * 4) % height;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: "50%", backgroundColor: "#fff", opacity: seeded(`dust-o${i}`, 0.15, 0.5) }} />
        );
      })}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 45%, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
      <Grain opacity={0.09} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ đĩa */

/** Nhãn đĩa: ảnh/clip của cảnh; không ảnh thì nhãn in màu có tên bài (nửa trên) và handle (nửa dưới). Quay cùng đĩa. */
const Label: React.FC<{ scenes: Scene[]; title: string; handle: string; palette: Palette; size: number }> = ({ scenes, title, handle, palette, size }) => {
  const frame = useCurrentFrame();
  const scene = scenes[Math.max(0, activeIndexAt(scenes, frame))];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", position: "relative", boxShadow: "0 0 0 3px rgba(0,0,0,0.6)" }}>
      {scene?.image ? (
        <SceneMedia scene={scene} from={msToFrames(scene.startMs)} />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${size * 0.16}px ${size * 0.16}px ${size * 0.2}px`,
            boxSizing: "border-box",
            background: `radial-gradient(circle at 35% 30%, ${palette.accent2} 0%, ${palette.accent} 45%, hsl(${palette.hue}, 70%, 22%) 100%)`,
            boxShadow: `inset 0 0 0 ${size * 0.035}px rgba(0,0,0,0.18)`,
            color: "#fff",
            fontFamily: FONT,
            textAlign: "center",
          }}
        >
          <span style={{ fontWeight: 900, fontSize: size * 0.1, lineHeight: 1.15, maxWidth: "100%", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {title.normalize("NFC").toLocaleUpperCase("vi")}
          </span>
          <span style={{ fontWeight: 700, fontSize: size * 0.07, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{handle}</span>
        </div>
      )}
    </div>
  );
};

/** Đĩa than quay 33⅓ vòng/phút: rãnh đĩa, nhãn ảnh bìa, lỗ giữa. Vệt bóng loáng đứng yên — chỉ đĩa quay. */
export const Disc: React.FC<{ cx: number; cy: number; r: number; scenes: Scene[]; title: string; handle: string; palette: Palette }> = ({
  cx,
  cy,
  r,
  scenes,
  title,
  handle,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const angle = (frame / fps) * DEG_PER_SECOND;
  const label = r * 0.72;
  return (
    <div style={{ position: "absolute", left: cx - r, top: cy - r, width: r * 2, height: r * 2 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          rotate: `${angle}deg`,
          background: [
            "repeating-radial-gradient(circle, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1.5px, transparent 4px)",
            "radial-gradient(circle, #151515 0%, #0a0a0a 60%, #111 100%)",
          ].join(", "),
          boxShadow: `0 ${r * 0.06}px ${r * 0.2}px rgba(0,0,0,0.6), inset 0 0 0 ${r * 0.015}px #1c1c1c`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Label scenes={scenes} title={title} handle={handle} palette={palette} size={label} />
      </div>
      {/* Bóng loáng đứng yên trên mặt đĩa. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background:
            "conic-gradient(from 20deg, transparent 0deg, rgba(255,255,255,0.13) 22deg, transparent 50deg, transparent 180deg, rgba(255,255,255,0.09) 205deg, transparent 235deg)",
          mixBlendMode: "screen",
          WebkitMaskImage: `radial-gradient(circle, transparent ${(label / 2 / r) * 100}%, #000 ${(label / 2 / r) * 100 + 1}%)`,
          maskImage: `radial-gradient(circle, transparent ${(label / 2 / r) * 100}%, #000 ${(label / 2 / r) * 100 + 1}%)`,
        }}
      />
      {/* Lỗ giữa. */}
      <div style={{ position: "absolute", left: r - r * 0.035, top: r - r * 0.035, width: r * 0.07, height: r * 0.07, borderRadius: "50%", backgroundColor: "#0b0b0b", boxShadow: "inset 0 0 3px rgba(255,255,255,0.4)" }} />
    </div>
  );
};

/* ------------------------------------------------------------ vòng phổ */

const RING_BARS = 64;

/**
 * 64 cột phổ toả ra quanh đĩa, đối xứng hai bên: bass ở đỉnh, treble ở đáy. Thêm một cung mảnh sát mép đĩa
 * là tiến độ bài hát.
 */
export const SpectrumRing: React.FC<{ cx: number; cy: number; r: number; palette: Palette }> = ({ cx, cy, r, palette }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { unit } = useLayout();
  const { bands } = useLevels();
  const inner = r + 22 * unit;
  const maxLen = 118 * unit;
  const box = (inner + maxLen + 20 * unit) * 2;
  const o = box / 2;
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const track = r + 8 * unit;
  const arc = 2 * Math.PI * track;
  return (
    <svg width={box} height={box} style={{ position: "absolute", left: cx - o, top: cy - o, overflow: "visible" }}>
      <defs>
        <linearGradient id="vinyl-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.accent2} />
        </linearGradient>
      </defs>
      {Array.from({ length: RING_BARS }, (_, k) => {
        const half = RING_BARS / 2;
        const band = Math.round(((k < half ? k : RING_BARS - 1 - k) / (half - 1)) * (BANDS - 1));
        const level = Math.pow(Math.max(0, Math.min(1, bands[band] ?? 0)), 1.35);
        const a = (k / RING_BARS) * Math.PI * 2 - Math.PI / 2;
        const len = 6 * unit + level * maxLen;
        return (
          <line
            key={k}
            x1={o + Math.cos(a) * inner}
            y1={o + Math.sin(a) * inner}
            x2={o + Math.cos(a) * (inner + len)}
            y2={o + Math.sin(a) * (inner + len)}
            stroke="url(#vinyl-ring)"
            strokeWidth={9 * unit}
            strokeLinecap="round"
            opacity={0.55 + level * 0.45}
          />
        );
      })}
      <circle cx={o} cy={o} r={track} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={3 * unit} />
      <circle
        cx={o}
        cy={o}
        r={track}
        fill="none"
        stroke="#fff"
        strokeWidth={3 * unit}
        strokeLinecap="round"
        strokeDasharray={`${arc * progress} ${arc}`}
        transform={`rotate(-90 ${o} ${o})`}
      />
    </svg>
  );
};

/** Vòng sóng lan ra từ mép đĩa lúc câu nhấn vào. */
export const Shockwave: React.FC<{ cx: number; cy: number; r: number; at: number; color: string }> = ({ cx, cy, r, at, color }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const t = interpolate(frame, [at, at + 22], [0, 1], clamp);
  if (frame < at || t >= 1) return null;
  const radius = r + 30 * unit + t * 260 * unit;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - radius,
        top: cy - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: "50%",
        border: `${(10 - t * 8) * unit}px solid ${color}`,
        opacity: 1 - t,
        boxShadow: `0 0 ${30 * unit}px ${color}`,
      }}
    />
  );
};

/** Cần đọc đĩa ở góc trên phải, đầu kim tựa lên rãnh ngoài; rung rất nhẹ theo cú trống. */
export const ToneArm: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => {
  const { kick } = useLevels();
  const { unit } = useLayout();
  const px = cx + r * 1.08;
  const py = cy - r * 0.98;
  const needleA = (32 * Math.PI) / 180;
  const nx = cx + Math.sin(needleA) * r * 0.8;
  const ny = cy - Math.cos(needleA) * r * 0.8;
  const ex = px + (nx - px) * 0.35 + 40 * unit;
  const ey = py + (ny - py) * 0.7;
  const w = 12 * unit;
  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", rotate: `${kick * 0.8}deg`, transformOrigin: `${px}px ${py}px` }}
      width={1}
      height={1}
    >
      <polyline points={`${px},${py} ${ex},${ey} ${nx},${ny}`} fill="none" stroke="#d9d9d9" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`${px},${py} ${ex},${ey} ${nx},${ny}`} fill="none" stroke="#8a8a8a" strokeWidth={w * 0.35} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={nx - 22 * unit} y={ny - 14 * unit} width={44 * unit} height={30 * unit} rx={6 * unit} fill="#2b2b2b" stroke="#bdbdbd" strokeWidth={2 * unit} transform={`rotate(32 ${nx} ${ny})`} />
      <circle cx={px} cy={py} r={34 * unit} fill="#1e1e1e" stroke="#9c9c9c" strokeWidth={4 * unit} />
      <circle cx={px} cy={py} r={12 * unit} fill="#bdbdbd" />
    </svg>
  );
};

/* ------------------------------------------------------------ bìa đĩa */

/** Bìa đĩa vuông cho màn mở đầu: ảnh cảnh đầu (hoặc mảng màu), tên bài lớn + handle ở chân bìa. */
export const Sleeve: React.FC<{ x: number; y: number; size: number; scenes: Scene[]; title: string; handle: string; palette: Palette }> = ({
  x,
  y,
  size,
  scenes,
  title,
  handle,
  palette,
}) => {
  const cover = scenes.find((s) => s.image) ?? null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size * 0.02,
        overflow: "hidden",
        boxShadow: `0 ${size * 0.04}px ${size * 0.12}px rgba(0,0,0,0.7)`,
        background: `linear-gradient(150deg, hsl(${palette.hue}, 70%, 40%) 0%, hsl(${(palette.hue + 40) % 360}, 70%, 22%) 60%, #0c0c0c 100%)`,
      }}
    >
      {cover ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <SceneMedia scene={cover} from={msToFrames(cover.startMs)} />
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75) 100%)" }} />
      <div style={{ position: "absolute", left: size * 0.07, right: size * 0.07, bottom: size * 0.07 }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size * 0.1, lineHeight: 1.22, color: "#fff" }}>{title.normalize("NFC")}</div>
        {handle ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: size * 0.05, color: "rgba(255,255,255,0.8)", marginTop: size * 0.02 }}>{handle}</div> : null}
      </div>
    </div>
  );
};
