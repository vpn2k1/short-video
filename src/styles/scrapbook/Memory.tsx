/**
 * Một "kỷ niệm" = một cảnh trên bảng: tấm polaroid (hoặc vé kỷ niệm khi cảnh không có ảnh), thứ giữ nó trên bảng
 * (băng keo washi ghi nhãn, hai mẩu băng keo góc, hoặc đinh ghim), hình vẽ tay ở dải trắng, và đồ dán của cảnh:
 * nhãn tròn (`visual`) góc trên trái, giấy note (`punch`) bên phải.
 *
 * Vẽ theo toạ độ cục bộ (0..w, 0..h) — index.tsx lo vị trí, rơi xuống và lùi ra mép bảng.
 */
import { Easing, interpolate } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { seeded } from "../shared";
import { Doodle, PushPin, TAPE_COLORS, WashiTape, type DoodleKind } from "./paper";
import { HAND, INK, inkOn, PHOTO_PAPER, ROUND, SCRIPT, shade } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Dán mạnh tay: vượt quá rồi nảy về. */
const SLAP = Easing.spring({ damping: 11, stiffness: 180 });

type Props = {
  scene: Scene;
  index: number;
  w: number;
  h: number;
  /** Viền / dải trắng của polaroid (vé kỷ niệm không dùng). */
  border: number;
  strip: number;
  appear: number;
  frame: number;
  unit: number;
  accent: string;
  title: string;
};

// ---------------------------------------------------------------------------
// Ảnh polaroid
// ---------------------------------------------------------------------------
const Photo: React.FC<Props> = ({ scene, index, w, h, border, strip, appear, frame, unit, accent }) => {
  const doodles: DoodleKind[] = ["heart", "star", "swirl"];
  const doodle = doodles[Math.floor(seeded(`sb-doodle-${index}`, 0, 3))];
  const doodleSize = strip * 0.5;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: PHOTO_PAPER,
        backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.7), rgba(235,228,212,0.35))",
        padding: border,
        paddingBottom: strip,
        boxSizing: "border-box",
        borderRadius: 3 * unit,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          backgroundColor: "#d9d0bf",
          // Ảnh in hơi ấm, có quầng tối nhẹ như ảnh lấy liền.
          filter: "saturate(1.05) contrast(1.03) sepia(0.08)",
          boxShadow: `inset 0 0 ${3 * unit}px rgba(0,0,0,0.35)`,
          position: "relative",
        }}
      >
        <SceneMedia scene={scene} from={appear} zoom={interpolate(frame, [appear, appear + 300], [1.03, 1.12], clamp)} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, rgba(40,20,0,0) 40%, rgba(40,20,0,0.07) 70%, rgba(40,20,0,0.2) 100%)" }} />
      </div>
      <Doodle
        kind={doodle}
        size={doodleSize}
        color={accent}
        frame={frame}
        start={appear + 18}
        style={{ right: border * 2, bottom: (strip - doodleSize) * 0.62, rotate: `${seeded(`sb-dr-${index}`, -14, 14).toFixed(1)}deg` }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Vé kỷ niệm — thay ảnh khi cảnh không có hình
// ---------------------------------------------------------------------------
const Ticket: React.FC<Props & { headline: string }> = ({ index, w, h, appear, frame, unit, accent, headline }) => {
  const stubW = w * 0.24;
  const notch = Math.min(w, h) * 0.07;
  const mainW = w - stubW;
  const len = [...headline].length;
  const size = Math.min(h * 0.3, Math.max(46 * unit, Math.sqrt((mainW * 0.82 * h * 0.42) / Math.max(1, len)) * 1.25));
  const number = String(index + 1).padStart(2, "0");
  // Khấc tròn hai đầu đường răng cưa: mask khoét hai nửa hình tròn ở mép trên/dưới.
  const mask = `radial-gradient(circle at ${stubW}px 0, transparent ${notch}px, #000 ${notch + 0.5}px) top / 100% 51% no-repeat, radial-gradient(circle at ${stubW}px 100%, transparent ${notch}px, #000 ${notch + 0.5}px) bottom / 100% 51% no-repeat`;
  return (
    <div style={{ position: "absolute", inset: 0, filter: `drop-shadow(0 ${3 * unit}px ${4 * unit}px rgba(0,0,0,0.2))` }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          WebkitMask: mask,
          mask,
          borderRadius: 10 * unit,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: stubW,
            height: "100%",
            backgroundColor: accent,
            backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.12))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: inkOn(accent),
          }}
        >
          <div style={{ rotate: "-90deg", fontFamily: ROUND, fontWeight: 800, fontSize: stubW * 0.34, whiteSpace: "nowrap", lineHeight: 1 }}>
            Nº {number}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            height: "100%",
            backgroundColor: "#fdf3dc",
            backgroundImage: `repeating-linear-gradient(0deg, rgba(160,120,60,0.06) 0 ${2 * unit}px, transparent ${2 * unit}px ${9 * unit}px)`,
            borderLeft: `${4 * unit}px dashed rgba(90, 60, 30, 0.45)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: `${h * 0.08}px ${mainW * 0.07}px`,
            boxSizing: "border-box",
            gap: h * 0.04,
            color: INK,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: HAND, fontSize: Math.min(h * 0.1, 44 * unit), color: shade(accent, -0.25), lineHeight: 1 }}>
            {"Vé kỷ niệm".toLocaleUpperCase("vi")}
          </div>
          <div style={{ fontFamily: SCRIPT, fontWeight: 700, fontSize: size, lineHeight: 1.08, maxWidth: "100%", overflowWrap: "break-word" }}>
            {headline}
          </div>
          <div style={{ width: "70%", borderTop: `${3 * unit}px solid rgba(90,60,30,0.35)` }} />
        </div>
      </div>
      <Doodle kind="star" size={h * 0.14} color={accent} frame={frame} start={appear + 16} style={{ right: w * 0.05, top: h * 0.08, rotate: "12deg" }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thứ giữ ảnh trên bảng
// ---------------------------------------------------------------------------
const Fixing: React.FC<Props & { label: string | null }> = ({ index, w, appear, frame, unit, accent, label }) => {
  const t = interpolate(frame, [appear + 8, appear + 16], [0, 1], { ...clamp, easing: SLAP });
  if (t <= 0) return null;
  const color = TAPE_COLORS[index % TAPE_COLORS.length];
  const pattern = index % 3;
  const pop = { opacity: Math.min(1, t * 3), scale: String(1.25 - 0.25 * t) };
  if (label) {
    const fontSize = Math.min(50 * unit, w * 0.075);
    const tapeH = fontSize * 1.75;
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: -tapeH * 0.55, display: "flex", justifyContent: "center", ...pop }}>
        <WashiTape
          height={tapeH}
          color={color}
          unit={unit}
          pattern={pattern === 1 ? 2 : pattern}
          text={label}
          fontSize={fontSize}
          style={{ position: "relative", maxWidth: w * 1.05, rotate: `${seeded(`sb-tr-${index}`, -4, 4).toFixed(1)}deg` }}
        />
      </div>
    );
  }
  if (seeded(`sb-fix-${index}`) < 0.45) {
    const size = 64 * unit;
    return <PushPin size={size} color={accent} style={{ left: w / 2 - size / 2, top: -size * 0.42, ...pop }} />;
  }
  const tw = Math.min(200 * unit, w * 0.3);
  const th = 56 * unit;
  return (
    <>
      <WashiTape width={tw} height={th} color={color} unit={unit} pattern={pattern} style={{ left: -tw * 0.28, top: th * 0.15, rotate: "-38deg", ...pop }} />
      <WashiTape width={tw} height={th} color={color} unit={unit} pattern={pattern} style={{ right: -tw * 0.28, top: th * 0.15, rotate: "38deg", ...pop }} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Đồ dán của cảnh
// ---------------------------------------------------------------------------
/** Nhãn dán tròn: `stat` = hình tròn, `badge` = hoa hồng răng cưa. Viền trắng như sticker bế. */
const Sticker: React.FC<Props> = ({ scene, index, w, appear, frame, unit, accent }) => {
  const visual = scene.visual!;
  const t = interpolate(frame, [appear + 14, appear + 26], [0, 1], { ...clamp, easing: SLAP });
  if (t <= 0) return null;
  const D = Math.min(w * 0.36, 290 * unit);
  const fg = inkOn(accent);
  const len = [...visual.text].length;
  const size = Math.min(D * 0.36, (D * 0.78) / Math.max(1, len * 0.56));
  const rot = seeded(`sb-st-${index}`, -14, -4);
  // Hoa hồng 16 cánh cho badge.
  const petals = 16;
  const rosette = Array.from({ length: petals * 2 }, (_, i) => {
    const a = (i / (petals * 2)) * Math.PI * 2;
    const r = i % 2 ? 44 : 50;
    return `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
  }).join(" ");
  return (
    <div
      style={{
        position: "absolute",
        left: -D * 0.2,
        top: -D * 0.14,
        width: D,
        height: D,
        rotate: `${(rot + (1 - t) * 20).toFixed(2)}deg`,
        scale: String(1.5 - 0.5 * t),
        opacity: Math.min(1, t * 3),
        filter: `drop-shadow(0 ${4 * unit}px ${6 * unit}px rgba(0,0,0,0.3))`,
      }}
    >
      <svg width={D} height={D} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0 }}>
        {visual.type === "badge" ? (
          <>
            <polygon points={rosette} fill="#fff" transform="translate(50 50) scale(1.04) translate(-50 -50)" />
            <polygon points={rosette} fill={accent} transform="translate(50 50) scale(0.94) translate(-50 -50)" />
            <circle cx={50} cy={50} r={36} fill="none" stroke={fg} strokeOpacity={0.5} strokeWidth={1.2} strokeDasharray="3 2.5" />
          </>
        ) : (
          <>
            <circle cx={50} cy={50} r={50} fill="#fff" />
            <circle cx={50} cy={50} r={45} fill={accent} />
          </>
        )}
        {/* Bóng sáng như giấy dán bóng */}
        <ellipse cx={36} cy={28} rx={20} ry={9} fill="rgba(255,255,255,0.22)" transform="rotate(-25 36 28)" />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: D * 0.12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: fg,
        }}
      >
        <div style={{ fontFamily: ROUND, fontWeight: 800, fontSize: size, lineHeight: 1, whiteSpace: "nowrap" }}>{visual.text}</div>
        {visual.caption ? (
          <div style={{ fontFamily: HAND, fontSize: Math.max(22 * unit, D * 0.1), lineHeight: 1.05, marginTop: D * 0.03, maxWidth: D * 0.7 }}>
            {visual.caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Giấy note vàng dán đè góc phải, chữ viết tay — đập xuống đúng lúc giọng đọc tới câu nhấn. */
const StickyNote: React.FC<Props> = ({ scene, index, w, h, appear, frame, unit }) => {
  const punch = scene.punch!;
  const at = Math.max(appear + 6, msToFrames(punch.atMs));
  const t = interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: SLAP });
  if (t <= 0) return null;
  const S = Math.min(w * 0.46, 370 * unit);
  const text = punch.text.trim();
  const len = [...text].length;
  const size = Math.min(S * 0.24, Math.sqrt((S * 0.78 * S * 0.62) / Math.max(1, len)) * 1.45);
  const rot = seeded(`sb-pn-${index}`, 3, 8);
  return (
    <div
      style={{
        position: "absolute",
        left: w - S * 0.82,
        top: h * 0.42 - S / 2,
        width: S,
        height: S,
        rotate: `${(rot + (1 - t) * 14).toFixed(2)}deg`,
        scale: String(1.6 - 0.6 * t),
        opacity: Math.min(1, t * 3),
        // Góc dưới cong lên: bóng đậm ở hai góc dưới.
        filter: `drop-shadow(0 ${6 * unit}px ${7 * unit}px rgba(40,20,0,${(0.2 + (1 - Math.min(1, t)) * 0.2).toFixed(2)}))`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#ffe45e",
          backgroundImage: [
            "linear-gradient(180deg, rgba(0,0,0,0.06) 0%, transparent 16%)",
            "linear-gradient(135deg, rgba(255,255,255,0.3), transparent 45%, rgba(170,120,0,0.12) 100%)",
          ].join(", "),
          clipPath: "polygon(0 0, 100% 0, 100% 94%, 94% 100%, 0 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${S * 0.16}px ${S * 0.1}px ${S * 0.1}px`,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontFamily: HAND, fontSize: size, lineHeight: 1.08, color: INK, textAlign: "center", overflowWrap: "break-word", maxWidth: "100%" }}>
          {text}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
export const Memory: React.FC<Props> = (props) => {
  const { scene, title } = props;
  // Không ảnh: nhãn cảnh (hoặc tiêu đề) thành dòng chữ lớn trên vé, băng keo không ghi chữ nữa.
  const headline = scene.tag ?? title;
  return (
    <>
      {scene.image ? <Photo {...props} /> : <Ticket {...props} headline={headline} />}
      <Fixing {...props} label={scene.image ? scene.tag : null} />
      {scene.visual ? <Sticker {...props} /> : null}
      {scene.punch ? <StickyNote {...props} /> : null}
    </>
  );
};
