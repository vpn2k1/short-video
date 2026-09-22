/**
 * Nền sân khấu, huy hiệu micro, cột nhạc nhỏ, nhãn đoạn và màn tên bài của phong cách "Karaoke".
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { clamp, useLevels } from "../music";
import { activeIndexAt, Grain, seeded, useLayout } from "../shared";
import { LYRIC_FONT, outlineShadow, type Palette } from "./karaoke";

const FADE_FRAMES = 12;

/* ------------------------------------------------------------ nền */

/** Không ảnh: sân khấu tối, ba luồng đèn quét chậm, đốm sáng bokeh nhún theo bass. */
const Stage: React.FC<{ palette: Palette; seed: string }> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height, unit } = useLayout();
  const { bass, kick } = useLevels();
  const beams = [-1, 0, 1].map((k) => ({
    angle: k * 22 + 9 * Math.sin(frame / 55 + k * 1.9),
    x: 50 + k * 26,
    hue: (palette.hue + k * 40 + 360) % 360,
  }));
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${palette.stageTop} 0%, ${palette.stageBottom} 100%)`, overflow: "hidden" }}>
      {beams.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: -height * 0.05,
            width: width * 0.5,
            height: height * 1.1,
            marginLeft: -width * 0.25,
            transformOrigin: "50% 0%",
            rotate: `${b.angle}deg`,
            background: `linear-gradient(180deg, hsla(${b.hue}, 90%, 70%, ${0.2 + bass * 0.18}) 0%, transparent 75%)`,
            clipPath: "polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)",
            filter: `blur(${18 * unit}px)`,
            mixBlendMode: "screen",
          }}
        />
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const size = seeded(`${seed}-bk-s${i}`, 60, 220) * unit;
        const x = seeded(`${seed}-bk-x${i}`, 0, width);
        const drift = (frame * seeded(`${seed}-bk-v${i}`, 0.25, 0.8) * unit) % (height + size * 2);
        const y = ((seeded(`${seed}-bk-y${i}`, 0, height) - drift + height * 2) % (height + size * 2)) - size;
        const hue = (palette.hue + seeded(`${seed}-bk-h${i}`, -50, 50) + 360) % 360;
        const s = 1 + kick * 0.25 * seeded(`${seed}-bk-k${i}`, 0.3, 1);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              scale: String(s),
              background: `radial-gradient(circle, hsla(${hue}, 100%, 75%, ${0.35 + bass * 0.3}) 0%, hsla(${hue}, 100%, 60%, 0.08) 60%, transparent 72%)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
      {/* Sàn sân khấu hắt sáng theo bass. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 30% at 50% 100%, hsla(${palette.hue}, 100%, 60%, ${0.25 + bass * 0.35}) 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />
      <Grain opacity={0.1} />
    </AbsoluteFill>
  );
};

const SceneLayer: React.FC<{ scene: Scene; index: number; palette: Palette }> = ({ scene, index, palette }) => {
  const frame = useCurrentFrame();
  const { kick } = useLevels();
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  if (!scene.image) return <Stage palette={palette} seed={`s${index}`} />;
  const zoom = interpolate(frame, [start, end + 30], [1.03, 1.1], clamp) + kick * 0.012;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "brightness(0.8) saturate(1.1)" }}>
        <SceneMedia scene={scene} from={start} zoom={zoom} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Cảnh hiện tại (hoà từ cảnh trước), tối dần phía dưới cho lời dễ đọc. */
export const Backdrop: React.FC<{ scenes: Scene[]; palette: Palette }> = ({ scenes, palette }) => {
  const frame = useCurrentFrame();
  const index = Math.max(0, activeIndexAt(scenes, frame));
  const scene = scenes[index];
  const start = scene ? msToFrames(scene.startMs) : 0;
  const fadeIn = index > 0 ? interpolate(frame, [start, start + FADE_FRAMES], [0, 1], clamp) : 1;
  const prev = index > 0 && fadeIn < 1 ? scenes[index - 1] : null;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.stageTop }}>
      {prev ? <SceneLayer scene={prev} index={index - 1} palette={palette} /> : null}
      {scene ? (
        <AbsoluteFill style={{ opacity: fadeIn }}>
          <SceneLayer scene={scene} index={index} palette={palette} />
        </AbsoluteFill>
      ) : (
        <Stage palette={palette} seed="empty" />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 18%, transparent 45%, rgba(0,0,0,0.72) 100%)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ góc trên */

const MicIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3" fill={color} />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v4" />
  </svg>
);

/** Cột nhạc nhỏ: 5 cột theo phổ, cho người xem thấy nhạc đang chạy. */
export const MiniBars: React.FC<{ height: number; color: string; unit: number }> = ({ height, color, unit }) => {
  const { bands } = useLevels();
  const picks = [2, 6, 11, 17, 24];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 * unit, height }}>
      {picks.map((b, i) => (
        <div
          key={i}
          style={{ width: 6 * unit, height: Math.max(0.12, bands[b] ?? 0) * height, borderRadius: 3 * unit, backgroundColor: color }}
        />
      ))}
    </div>
  );
};

/** Huy hiệu micro + handle ở góc trên trái, cột nhạc nhỏ ở góc trên phải. */
export const TopBar: React.FC<{ handle: string; palette: Palette; opacity: number }> = ({ handle, palette, opacity }) => {
  const { safe, unit, width } = useLayout();
  const label = handle.trim() || "KARAOKE";
  return (
    <div
      style={{
        position: "absolute",
        top: safe.top,
        left: safe.side * 0.6,
        right: safe.side * 0.6,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12 * unit,
          padding: `${10 * unit}px ${22 * unit}px ${10 * unit}px ${14 * unit}px`,
          borderRadius: 999,
          backgroundColor: "rgba(8,10,24,0.55)",
          border: `${2 * unit}px solid hsla(${palette.hue}, 100%, 65%, 0.7)`,
          maxWidth: width * 0.62,
        }}
      >
        <div style={{ width: 46 * unit, height: 46 * unit, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: palette.sung }}>
          <MicIcon size={26 * unit} color="#0b1030" />
        </div>
        <span
          style={{
            fontFamily: LYRIC_FONT,
            fontWeight: 800,
            fontSize: 30 * unit,
            color: "#fff",
            letterSpacing: 1 * unit,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>
      <MiniBars height={40 * unit} color={palette.sung} unit={unit} />
    </div>
  );
};

/* ------------------------------------------------------------ nhãn đoạn, số liệu */

/** "♪ ĐIỆP KHÚC" — nhãn đoạn của cảnh, nằm trên khối lời. */
export const TagPill: React.FC<{ text: string; since: number; palette: Palette; align: "left" | "center" }> = ({ text, since, palette, align }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const t = interpolate(frame, [since, since + 10], [0, 1], clamp);
  return (
    <div style={{ display: "flex", justifyContent: align === "left" ? "flex-start" : "center", opacity: t, translate: `0 ${(1 - t) * 14 * unit}px` }}>
      <span
        style={{
          fontFamily: LYRIC_FONT,
          fontWeight: 800,
          fontSize: 26 * unit,
          letterSpacing: 3 * unit,
          color: "#0b1030",
          backgroundColor: palette.sung,
          padding: `${6 * unit}px ${18 * unit}px`,
          borderRadius: 999,
          boxShadow: `0 0 ${24 * unit}px hsla(${palette.hue}, 100%, 60%, 0.6)`,
        }}
      >
        ♪ {text.normalize("NFC").toLocaleUpperCase("vi")}
      </span>
    </div>
  );
};

/** Số liệu / nhãn của cảnh: viên nhỏ dưới thanh trên cùng. */
export const StatPill: React.FC<{ text: string; caption: string | null; since: number; palette: Palette }> = ({ text, caption, since, palette }) => {
  const frame = useCurrentFrame();
  const { safe, unit, fps } = useLayout();
  const pop = spring({ frame: frame - since - 6, fps, config: { damping: 14, stiffness: 160 } });
  return (
    <div
      style={{
        position: "absolute",
        top: safe.top + 86 * unit,
        right: safe.side * 0.6,
        display: "flex",
        alignItems: "baseline",
        gap: 10 * unit,
        padding: `${8 * unit}px ${20 * unit}px`,
        borderRadius: 18 * unit,
        backgroundColor: "rgba(8,10,24,0.62)",
        border: `${2 * unit}px solid rgba(255,255,255,0.18)`,
        scale: String(0.6 + pop * 0.4),
        opacity: pop,
        transformOrigin: "100% 0%",
      }}
    >
      <span style={{ fontFamily: LYRIC_FONT, fontWeight: 900, fontSize: 40 * unit, color: palette.sung }}>{text}</span>
      {caption ? <span style={{ fontFamily: LYRIC_FONT, fontWeight: 600, fontSize: 24 * unit, color: "rgba(255,255,255,0.85)" }}>{caption}</span> : null}
    </div>
  );
};

/* ------------------------------------------------------------ màn tên bài */

/** Màn tên bài kiểu băng karaoke: "♪ KARAOKE ♪", tên bài lớn viền đậm, dòng phụ, người trình bày. */
export const TitleCard: React.FC<{ title: string; subtitle: string; handle: string; palette: Palette; end: number }> = ({
  title,
  subtitle,
  handle,
  palette,
  end,
}) => {
  const frame = useCurrentFrame();
  const { unit, width, safe } = useLayout();
  const { kick } = useLevels();
  const fadeOut = end > 20 ? interpolate(frame, [end - 10, end], [1, 0], clamp) : 1;
  const inT = interpolate(frame, [0, 16], [0, 1], clamp);
  const size = Math.min(96 * unit, (width - safe.side * 2) / Math.max(6, [...title].length * 0.34));
  return (
    <AbsoluteFill style={{ opacity: fadeOut * inT, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(4,6,18,0.45)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 * unit, maxWidth: width - safe.side * 2, scale: String(0.94 + inT * 0.06 + kick * 0.015) }}>
        <span style={{ fontFamily: LYRIC_FONT, fontWeight: 800, fontSize: 30 * unit, letterSpacing: 8 * unit, color: palette.sung }}>♪ KARAOKE ♪</span>
        <span
          style={{
            fontFamily: LYRIC_FONT,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 1.28,
            textAlign: "center",
            color: "#fff",
            textShadow: `${outlineShadow(palette.outline, 5 * unit)}, 0 0 ${40 * unit}px hsla(${palette.hue}, 100%, 60%, 0.7)`,
          }}
        >
          {title.normalize("NFC")}
        </span>
        {subtitle ? (
          <span style={{ fontFamily: LYRIC_FONT, fontWeight: 600, fontSize: 32 * unit, color: "rgba(255,255,255,0.88)", textAlign: "center", textShadow: outlineShadow(palette.outline, 3 * unit) }}>
            {subtitle.normalize("NFC")}
          </span>
        ) : null}
        {handle ? (
          <span style={{ fontFamily: LYRIC_FONT, fontWeight: 700, fontSize: 28 * unit, color: palette.sung, textShadow: outlineShadow(palette.outline, 3 * unit) }}>
            {handle}
          </span>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
