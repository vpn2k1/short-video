import { ClipVideo } from "../../scenes/ClipVideo";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene, SceneVisual } from "../../compositions/Short/schema";
import { FONTS, useLayout } from "../shared";
import { contrast, type Swatch } from "./palette";
import { hasPunch, measureAt100, upper, WORD_FONT, WORD_WEIGHT } from "./text";
import { KineticWords } from "./Words";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SNAP = Easing.bezier(0.16, 1, 0.3, 1);
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Ảnh/video của cảnh chỉ là texture mờ đen trắng — không bao giờ tranh chỗ với chữ. */
const Texture: React.FC<{ scene: Scene; swatch: Swatch }> = ({ scene, swatch }) => {
  const frame = useCurrentFrame();
  if (!scene.image) return null;
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  const zoom = interpolate(frame, [start, end], [1.04, 1.12], clamp);
  const media: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "grayscale(1) contrast(1.35)",
  };
  return (
    <AbsoluteFill
      style={{
        opacity: swatch.dark ? 0.2 : 0.16,
        mixBlendMode: swatch.dark ? "screen" : "multiply",
        scale: zoom,
        maskImage: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,1) 70%)",
        WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,1) 70%)",
      }}
    >
      {VIDEO_EXT.test(scene.image) ? (
        <Sequence from={start}>
          <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} style={media} />
        </Sequence>
      ) : (
        <Img src={staticFile(scene.image)} style={media} />
      )}
    </AbsoluteFill>
  );
};

/** Nhãn nhỏ đầu vùng an toàn: thanh màu nhấn chạy ra rồi chữ trượt theo. */
const Tag: React.FC<{ text: string; appear: number; swatch: Swatch; counter: string | null }> = ({
  text,
  appear,
  swatch,
  counter,
}) => {
  const frame = useCurrentFrame();
  const { unit, safe, width } = useLayout();
  const t = frame - appear;
  const bar = interpolate(t, [0, 8], [0, 1], { ...clamp, easing: SNAP });
  const slide = interpolate(t, [3, 12], [1, 0], { ...clamp, easing: SNAP });
  const barColor = contrast(swatch.hi, swatch.bg) >= 2.2 ? swatch.hi : swatch.fg;
  return (
    <div
      style={{
        position: "absolute",
        top: safe.top,
        left: safe.side,
        width: width - safe.side * 2,
        height: 64 * unit,
        display: "flex",
        alignItems: "center",
        gap: 22 * unit,
        fontFamily: FONTS.sans,
        fontWeight: 800,
        fontSize: 36 * unit,
        letterSpacing: "0.16em",
        color: swatch.fg,
      }}
    >
      <div style={{ width: 84 * unit, height: 14 * unit, backgroundColor: barColor, scale: `${bar} 1`, transformOrigin: "0% 50%" }} />
      <div style={{ overflow: "hidden", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 }}>
        <div style={{ translate: `0px ${slide * 110}%`, textOverflow: "ellipsis", overflow: "hidden" }}>{upper(text)}</div>
      </div>
      <div style={{ flex: 1, height: 3 * unit, backgroundColor: swatch.fg, opacity: 0.25, scale: `${bar} 1`, transformOrigin: "0% 50%" }} />
      {counter ? <div style={{ opacity: 0.6 * bar, fontSize: 30 * unit, fontVariantNumeric: "tabular-nums" }}>{counter}</div> : null}
    </div>
  );
};

/** Tách "80%" → 80 và "%". Hỗ trợ "1.200", "2,5", "+30K", "12 triệu". */
const parseStat = (text: string) => {
  const m = text.match(/^(\D*?)(\d[\d.,]*)(.*)$/u);
  if (!m) return null;
  const [, prefix, raw, suffix] = m;
  const grouped = raw.match(/^\d{1,3}([.,])\d{3}(\1\d{3})*$/);
  if (grouped) {
    return { prefix, suffix, value: Number(raw.replace(/[.,]/g, "")), decimals: 0, sep: grouped[1], decSep: "" };
  }
  const decMatch = raw.match(/^(\d+)([.,])(\d+)$/);
  if (decMatch) {
    return { prefix, suffix, value: Number(`${decMatch[1]}.${decMatch[3]}`), decimals: decMatch[3].length, sep: "", decSep: decMatch[2] };
  }
  const plain = raw.replace(/[.,]+$/, "");
  return { prefix, suffix: raw.slice(plain.length) + suffix, value: Number(plain), decimals: 0, sep: "", decSep: "" };
};

const formatStat = (n: number, p: NonNullable<ReturnType<typeof parseStat>>) => {
  if (p.decimals > 0) return n.toFixed(p.decimals).replace(".", p.decSep);
  const s = String(Math.round(n));
  return p.sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, p.sep) : s;
};

/** Con số khổng lồ đếm lên, hoặc nhãn viền bo tròn. */
const Visual: React.FC<{ visual: SceneVisual; appear: number; swatch: Swatch; width: number; height: number }> = ({
  visual,
  appear,
  swatch,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const t = frame - appear;
  const pop = interpolate(t, [0, 5, 9], [1.9, 0.96, 1], { ...clamp, easing: [SNAP, Easing.out(Easing.quad)] });
  const opacity = interpolate(t, [0, 2], [0, 1], clamp);
  const numberColor = contrast(swatch.hi, swatch.bg) >= 2.6 ? swatch.hi : swatch.fg;

  if (visual.type === "badge") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 24 * unit, opacity, scale: pop, transformOrigin: "0% 50%", maxWidth: width }}>
        <div
          style={{
            border: `${5 * unit}px solid ${swatch.fg}`,
            borderRadius: 999,
            padding: `${10 * unit}px ${34 * unit}px`,
            fontFamily: FONTS.sans,
            fontWeight: 800,
            fontSize: 42 * unit,
            letterSpacing: "0.08em",
            color: swatch.fg,
            whiteSpace: "nowrap",
          }}
        >
          {upper(visual.text)}
        </div>
        {visual.caption ? (
          <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 34 * unit, color: swatch.fg, opacity: 0.75 }}>
            {visual.caption}
          </div>
        ) : null}
      </div>
    );
  }

  const parsed = parseStat(visual.text);
  const count = interpolate(t, [2, 26], [0, 1], { ...clamp, easing: SNAP });
  const shown = parsed ? `${parsed.prefix}${formatStat(parsed.value * count, parsed)}${parsed.suffix}` : visual.text;
  const finalText = upper(visual.text);
  const captionH = visual.caption ? 90 * unit : 0;
  // Cỡ số: lấp đầy chiều cao dành cho nó nhưng không vượt bề ngang.
  const size = Math.max(
    40 * unit,
    Math.min((height - captionH) / 0.95, (width / (measureAt100(finalText) / 100)) * 0.92, 520 * unit),
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width, height, opacity }}>
      <div
        style={{
          fontFamily: WORD_FONT,
          fontWeight: WORD_WEIGHT,
          fontSize: size,
          lineHeight: 0.95,
          color: numberColor,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          scale: pop,
          transformOrigin: "0% 60%",
        }}
      >
        {upper(shown)}
      </div>
      {visual.caption ? (
        <div
          style={{
            marginTop: 14 * unit,
            display: "flex",
            alignItems: "center",
            gap: 18 * unit,
            fontFamily: FONTS.sans,
            fontWeight: 800,
            fontSize: 38 * unit,
            letterSpacing: "0.1em",
            color: swatch.fg,
            opacity: interpolate(t, [10, 16], [0, 1], clamp),
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <div style={{ width: 48 * unit, height: 8 * unit, backgroundColor: numberColor, flexShrink: 0 }} />
          {upper(visual.caption)}
        </div>
      ) : null}
    </div>
  );
};

type LayerProps = {
  scene: Scene | null;
  sceneIndex: number;
  sceneCount: number;
  scenes: Scene[];
  swatch: Swatch;
  caption: Caption | null;
  captionIndex: number;
  captions: Caption[];
  /** Mốc sớm nhất cho tag/visual bật vào (sau title card nếu có). */
  introEnd: number;
  /** Chữ dự phòng khi không có phụ đề nào. */
  fallbackText: string;
  clipPath?: string;
  translate?: string;
};

/** Một cảnh hoàn chỉnh: nền phẳng + texture + tag + visual + chữ + thanh tiến độ. */
export const SceneLayer: React.FC<LayerProps> = ({
  scene,
  sceneIndex,
  sceneCount,
  scenes,
  swatch,
  caption,
  captionIndex,
  captions,
  introEnd,
  fallbackText,
  clipPath,
  translate,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { width, height, safe, unit, portrait } = useLayout();

  const sceneStart = scene ? msToFrames(scene.startMs) : 0;
  const appear = Math.max(sceneStart + 4, introEnd);

  const hasTag = Boolean(scene?.tag);
  const visual = scene?.visual ?? null;

  // Hộp nội dung trong vùng an toàn.
  const top = safe.top + (hasTag ? 64 * unit + 44 * unit : 24 * unit);
  const bottom = height - safe.bottom;
  const left = safe.side;
  const boxW = width - safe.side * 2;
  const boxH = bottom - top;

  let statBox: { x: number; y: number; w: number; h: number } | null = null;
  let textBox = { x: left, y: top, w: boxW, h: boxH };
  let badgeH = 0;
  if (visual?.type === "stat") {
    if (portrait) {
      const h = Math.round(boxH * 0.34);
      statBox = { x: left, y: top, w: boxW, h };
      textBox = { x: left, y: top + h + 40 * unit, w: boxW, h: boxH - h - 40 * unit };
    } else {
      const w = Math.round(boxW * 0.38);
      statBox = { x: left, y: top, w, h: boxH };
      textBox = { x: left + w + 70 * unit, y: top, w: boxW - w - 70 * unit, h: boxH };
    }
  } else if (visual?.type === "badge") {
    // Pill cao ~90u + khoảng thở cho dấu mũ/dấu sắc của dòng chữ đầu.
    badgeH = 150 * unit;
  }

  // Punch: cụm nào nằm trong câu này, ưu tiên cảnh có atMs gần giữa câu nhất.
  let punch: { text: string; atFrame: number } | null = null;
  if (caption) {
    const mid = (caption.startMs + caption.endMs) / 2;
    let bestDist = Infinity;
    for (const s of scenes) {
      if (!s.punch || !hasPunch(caption.text, s.punch.text)) continue;
      const dist = Math.abs(s.punch.atMs - mid);
      if (dist < bestDist) {
        bestDist = dist;
        punch = { text: s.punch.text, atFrame: msToFrames(s.punch.atMs) };
      }
    }
  }

  const next = captionIndex >= 0 && captionIndex + 1 < captions.length ? captions[captionIndex + 1] : null;
  const maxSize = (statBox ? (portrait ? 140 : 120) : portrait ? 185 : 160) * unit;
  const shownCaption: Caption | null =
    caption ?? (captions.length === 0 && fallbackText ? { text: fallbackText, startMs: 0, endMs: 1000, audio: null } : null);

  return (
    <AbsoluteFill style={{ backgroundColor: swatch.bg, clipPath, translate, overflow: "hidden" }}>
      {scene ? <Texture scene={scene} swatch={swatch} /> : null}

      {scene?.tag ? (
        <Tag
          text={scene.tag}
          appear={appear - 4}
          swatch={swatch}
          counter={sceneCount > 1 ? `${String(sceneIndex + 1).padStart(2, "0")}/${String(sceneCount).padStart(2, "0")}` : null}
        />
      ) : null}

      {visual && statBox ? (
        <div style={{ position: "absolute", left: statBox.x, top: statBox.y, width: statBox.w, height: statBox.h }}>
          <Visual visual={visual} appear={appear} swatch={swatch} width={statBox.w} height={statBox.h} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: textBox.x,
          top: textBox.y,
          width: textBox.w,
          height: textBox.h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {visual?.type === "badge" ? (
          <div style={{ height: badgeH, flexShrink: 0 }}>
            <Visual visual={visual} appear={appear} swatch={swatch} width={textBox.w} height={badgeH} />
          </div>
        ) : null}
        {shownCaption ? (
          <KineticWords
            key={`c-${captionIndex}`}
            caption={shownCaption}
            captionIndex={captionIndex}
            nextStartFrame={next ? msToFrames(next.startMs) : null}
            punch={punch}
            swatch={swatch}
            width={textBox.w}
            height={textBox.h - badgeH}
            maxSize={maxSize}
          />
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 8 * unit,
          width: width * interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], clamp),
          backgroundColor: contrast(swatch.hi, swatch.bg) >= 2 ? swatch.hi : swatch.fg,
        }}
      />
    </AbsoluteFill>
  );
};
