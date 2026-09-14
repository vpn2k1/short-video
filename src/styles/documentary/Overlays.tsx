import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { fitFontSize, FONTS, Grain, seeded, useCaptionClock, useLayout, useSceneClock } from "../shared";
import { FADE_FRAMES } from "./Footage";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Tách chữ theo ký tự hiển thị (NFC) để gõ máy không cắt đôi dấu tiếng Việt. */
const glyphs = (text: string) => Array.from(text.normalize("NFC"));

/** Cảnh landscape rộng (16:9, 2:1) dùng bố cục ngang. */
const useIsWide = () => {
  const { width, height } = useLayout();
  return width / height > 1.2;
};

/** Mờ dần ở cuối cảnh, khớp với lúc cảnh sau bắt đầu cross-fade; an toàn khi cảnh rất ngắn. */
const sceneFadeOut = (frame: number, from: number, endFrame: number) => {
  const outStart = Math.max(from + 1, endFrame - FADE_FRAMES);
  return interpolate(frame, [outStart, outStart + 10], [1, 0], clamp);
};

/* ------------------------------------------------------------------ tag */

/** Nhãn địa điểm/ngày: chấm đỏ, vạch mảnh, chữ máy đánh chữ hiện dần. */
export const PlaceTag: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, safe, height } = useLayout();
  const wide = useIsWide();
  if (!scene || !scene.tag) return null;

  // Cảnh đầu có title card thì đợi title tắt rồi mới gõ.
  const appear = index === 0 && showTitle ? TITLE_FRAMES + 4 : startFrame + 9;
  if (frame < appear) return null;

  const chars = glyphs(scene.tag);
  const typed = Math.min(chars.length, Math.floor((frame - appear - 6) / 1.6) + 1);
  const typing = typed < chars.length;
  const cursorOn = typing || Math.floor((frame - appear) / 12) % 2 === 0;
  const rule = interpolate(frame, [appear, appear + 10], [0, 1], { ...clamp, easing: EASE_OUT });
  const opacity = interpolate(frame, [appear, appear + 4], [0, 1], clamp) * sceneFadeOut(frame, appear, endFrame);
  const size = (wide ? 30 : 34) * unit;

  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top + (wide ? height * 0.05 : 0) + 8 * unit,
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 12 * unit,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 * unit }}>
        <div
          style={{
            width: 14 * unit,
            height: 14 * unit,
            borderRadius: "50%",
            backgroundColor: "#e0412b",
            boxShadow: `0 0 ${10 * unit}px rgba(224,65,43,0.8)`,
            opacity: interpolate(frame, [appear, appear + 3], [0, 1], clamp),
          }}
        />
        <div
          style={{
            width: 90 * unit * rule,
            height: Math.max(1, 2 * unit),
            backgroundColor: "rgba(255,244,225,0.85)",
          }}
        />
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: size,
          letterSpacing: 0.08 * size,
          color: "#f6ecd8",
          textShadow: `0 ${2 * unit}px ${8 * unit}px rgba(0,0,0,0.85)`,
          whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}
      >
        {chars.slice(0, Math.max(0, typed)).join("")}
        <span style={{ opacity: cursorOn ? 1 : 0, color: "#e9b872" }}>▍</span>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- captions */

/** Phụ đề serif thanh lịch ở một phần ba dưới. Cụm punch trong câu được in nghiêng ấm. */
export const DocCaptions: React.FC<{ captions: Caption[]; scenes: Scene[]; position: "bottom" | "center" }> = ({
  captions,
  scenes,
  position,
}) => {
  const frame = useCurrentFrame();
  const { caption, index, localFrame, durationFrames } = useCaptionClock(captions);
  const { scene } = useSceneClock(scenes);
  const { unit, safe, width, height, captionBottom } = useLayout();
  const wide = useIsWide();
  if (!caption) return null;

  const isLast = index === captions.length - 1;
  const fadeIn = interpolate(localFrame, [0, 9], [0, 1], { ...clamp, easing: EASE_OUT });
  const fadeOut = isLast ? interpolate(localFrame, [durationFrames + 6, durationFrames + 16], [1, 0], clamp) : 1;
  const text = caption.text.normalize("NFC");
  // Câu ngắn to hơn, câu dài co lại nhưng không nhỏ hơn mức đọc được trên điện thoại.
  const fontSize = Math.round(
    (wide ? Math.max(50, fitFontSize(text, 76, 0.5)) : Math.max(58, fitFontSize(text, 92, 0.5))) * unit,
  );

  // Làm nổi cụm punch nếu nó nằm nguyên văn trong câu và giọng đọc đã tới.
  const punch = scene?.punch;
  let body: React.ReactNode = text;
  if (punch && frame >= msToFrames(punch.atMs) - 2) {
    const needle = punch.text.normalize("NFC");
    const at = text.toLowerCase().indexOf(needle.toLowerCase());
    if (at >= 0 && needle.length > 0) {
      body = (
        <>
          {text.slice(0, at)}
          <span style={{ fontStyle: "italic", color: "#f2d29b" }}>{text.slice(at, at + needle.length)}</span>
          {text.slice(at + needle.length)}
        </>
      );
    }
  }

  const maxWidth = wide ? Math.min(width * 0.68, width - safe.side * 2) : width - safe.side * 2;
  const placement: React.CSSProperties =
    position === "center" && !wide
      ? { top: height * 0.62 }
      : { bottom: captionBottom - (wide ? 40 * unit : 0) };

  return (
    <div
      style={{
        position: "absolute",
        left: (width - maxWidth) / 2,
        width: maxWidth,
        ...placement,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: fadeIn * fadeOut,
        translate: `0px ${(1 - fadeIn) * 14 * unit}px`,
      }}
    >
      <div
        style={{
          width: 56 * unit,
          height: Math.max(1, 2 * unit),
          backgroundColor: "rgba(233,184,114,0.9)",
          marginBottom: 18 * unit,
        }}
      />
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize,
          lineHeight: 1.28,
          color: "#fbf6ec",
          textAlign: "center",
          textWrap: "balance",
          textShadow: `0 ${2 * unit}px ${4 * unit}px rgba(0,0,0,0.9), 0 0 ${24 * unit}px rgba(0,0,0,0.65)`,
        }}
      >
        {body}
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------- punch */

/** Mép giấy xé: đa giác răng cưa ngẫu nhiên nhưng xác định theo seed. */
const tornClip = (seed: string) => {
  const steps = 18;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) pts.push(`${(i / steps) * 100}% ${seeded(`${seed}-t${i}`, 0, 4.5)}%`);
  for (let i = 1; i <= 6; i++) pts.push(`${100 - seeded(`${seed}-r${i}`, 0, 1.6)}% ${(i / 7) * 100}%`);
  for (let i = steps; i >= 0; i--) pts.push(`${(i / steps) * 100}% ${100 - seeded(`${seed}-b${i}`, 0, 5)}%`);
  for (let i = 6; i >= 1; i--) pts.push(`${seeded(`${seed}-l${i}`, 0, 1.6)}% ${(i / 7) * 100}%`);
  return `polygon(${pts.join(", ")})`;
};

/** Mẩu báo cắt: giấy ngà, tít serif đậm, nghiêng nhẹ, rơi xuống đúng lúc giọng đọc tới. */
export const Clipping: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const { frame, scene, index, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  const wide = useIsWide();
  if (!scene || !scene.punch) return null;

  const at = msToFrames(scene.punch.atMs);
  if (frame < at) return null;

  const seed = `doc-punch-${index}`;
  const t = interpolate(frame, [at, at + 12], [0, 1], { ...clamp, easing: EASE_OUT });
  const opacity = interpolate(frame, [at, at + 5], [0, 1], clamp) * sceneFadeOut(frame, at + 12, endFrame);
  const rotate = seeded(`${seed}-rot`, 1.5, 3.2) * (index % 2 === 0 ? -1 : 1);
  const text = scene.punch.text.normalize("NFC");
  // Khung vuông (1:1) không đủ cao để xếp con số trên, mẩu báo giữa, phụ đề dưới:
  // khi cảnh có stat thì dời mẩu báo sang phải và thu nhỏ.
  const squareWithStat = !wide && height / width < 1.2 && scene.visual?.type === "stat";
  const cardWidth = wide
    ? Math.min(width * 0.36, 700 * unit)
    : squareWithStat
      ? width * 0.5
      : Math.min(width - safe.side * 2, 780 * unit);
  const fontSize = Math.round(fitFontSize(text, (wide || squareWithStat ? 80 : 96) * unit, 0.5));

  const position: React.CSSProperties = wide
    ? { right: safe.side + 20 * unit, top: height * 0.2 }
    : squareWithStat
      ? { right: safe.side, top: height * 0.36 }
      : { left: (width - cardWidth) / 2, top: height * 0.4 };

  return (
    <div
      style={{
        position: "absolute",
        width: cardWidth,
        ...position,
        opacity,
        rotate: `${rotate + (1 - t) * 6}deg`,
        scale: `${1.12 - 0.12 * t}`,
        translate: `0px ${(1 - t) * -60 * unit}px`,
        filter: `drop-shadow(0 ${14 * unit}px ${18 * unit}px rgba(0,0,0,0.55))`,
      }}
    >
      <div
        style={{
          position: "relative",
          clipPath: tornClip(seed),
          backgroundColor: "#ece2cc",
          backgroundImage:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(120,90,50,0.08), rgba(120,90,50,0.22))",
          padding: `${44 * unit}px ${40 * unit}px ${46 * unit}px`,
          overflow: "hidden",
        }}
      >
        <Grain opacity={0.5} animated={false} baseFrequency={0.75} />
        <div style={{ position: "relative" }}>
          <div
            style={{
              borderTop: `${Math.max(2, 4 * unit)}px solid #2a241c`,
              borderBottom: `${Math.max(1, 1.5 * unit)}px solid #2a241c`,
              height: 5 * unit,
              marginBottom: 18 * unit,
            }}
          />
          <div
            style={{
              fontFamily: FONTS.serif,
              fontWeight: 700,
              fontSize,
              lineHeight: 1.08,
              color: "#1e1a15",
              letterSpacing: -0.01 * fontSize,
              textAlign: "center",
              textWrap: "balance",
            }}
          >
            {text}
          </div>
          <div
            style={{
              marginTop: 18 * unit,
              display: "flex",
              flexDirection: "column",
              gap: 8 * unit,
            }}
          >
            {[1, 0.92, 0.6].map((w, i) => (
              <div key={i} style={{ height: 6 * unit, width: `${w * 100}%`, backgroundColor: "rgba(40,34,26,0.18)" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- visual */

/** Con số lớn serif + vạch mảnh + chú thích chữ nhỏ; hoặc nhãn đóng dấu mực. */
export const DocVisual: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  const wide = useIsWide();
  if (!scene || !scene.visual) return null;

  const appear = index === 0 && showTitle ? TITLE_FRAMES + 14 : startFrame + 18;
  if (frame < appear) return null;
  const t = interpolate(frame, [appear, appear + 14], [0, 1], { ...clamp, easing: EASE_OUT });
  const fade = sceneFadeOut(frame, appear + 14, endFrame);
  const visual = scene.visual;
  const text = visual.text.normalize("NFC");

  if (visual.type === "badge") {
    const s = interpolate(frame, [appear, appear + 6], [1.7, 1], { ...clamp, easing: Easing.in(Easing.quad) });
    const size = 44 * unit;
    return (
      <div
        style={{
          position: "absolute",
          right: safe.side,
          top: safe.top + (wide ? height * 0.05 : 0) + 30 * unit,
          opacity: interpolate(frame, [appear, appear + 3], [0, 0.9], clamp) * fade,
          scale: `${s}`,
          rotate: `${seeded(`doc-badge-${index}`, -9, -4)}deg`,
          border: `${4 * unit}px double #d8452f`,
          padding: `${10 * unit}px ${22 * unit}px`,
          color: "#e2513a",
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: size,
          letterSpacing: 0.12 * size,
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.1,
          mixBlendMode: "screen",
        }}
      >
        {text}
        {visual.caption ? (
          <div style={{ fontSize: size * 0.45, letterSpacing: 0.2 * size * 0.45, marginTop: 4 * unit }}>
            {visual.caption.normalize("NFC")}
          </div>
        ) : null}
      </div>
    );
  }

  const square = !wide && height / width < 1.2;
  const numberSize = fitFontSize(text, (wide ? 200 : square ? 170 : 230) * unit, 0.45);
  const box = wide
    ? { left: safe.side, top: height * 0.3, width: width * 0.4 }
    : { left: safe.side, top: safe.top + 130 * unit, width: width - safe.side * 2 };
  return (
    <div style={{ position: "absolute", ...box, opacity: fade }}>
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: numberSize,
          lineHeight: 1,
          color: "#fbf3e2",
          opacity: t,
          translate: `0px ${(1 - t) * 30 * unit}px`,
          textShadow: `0 ${4 * unit}px ${24 * unit}px rgba(0,0,0,0.7)`,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 20 * unit,
          width: 260 * unit * t,
          height: Math.max(1, 2 * unit),
          backgroundColor: "#e9b872",
        }}
      />
      {visual.caption ? (
        <div
          style={{
            marginTop: 16 * unit,
            fontFamily: FONTS.serif,
            fontVariant: "small-caps",
            fontSize: 38 * unit,
            letterSpacing: 0.12 * 38 * unit,
            color: "#efe3cb",
            opacity: interpolate(frame, [appear + 8, appear + 18], [0, 1], clamp),
            textShadow: `0 ${2 * unit}px ${8 * unit}px rgba(0,0,0,0.8)`,
          }}
        >
          {visual.caption.normalize("NFC")}
        </div>
      ) : null}
    </div>
  );
};

/* ----------------------------------------------------------------- title */

/** Mở đầu: làm tối ảnh đầu, dòng máy chữ với handle, tít serif hiện lên, phụ đề small caps. */
export const DocTitle: React.FC<{ title: string; subtitle: string; handle: string }> = ({ title, subtitle, handle }) => {
  const frame = useCurrentFrame();
  const { unit, width, safe } = useLayout();
  const wide = useIsWide();
  const out = interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES], [1, 0], clamp);
  const over = glyphs(handle ? `${handle}  ·  phim tài liệu` : "phim tài liệu");
  const typed = Math.min(over.length, Math.max(0, Math.floor((frame - 2) / 1.2)));
  const titleIn = interpolate(frame, [8, 30], [0, 1], { ...clamp, easing: EASE_OUT });
  const subIn = interpolate(frame, [22, 40], [0, 1], { ...clamp, easing: EASE_OUT });
  const text = title.normalize("NFC");
  const titleSize = fitFontSize(text, (wide ? 120 : 132) * unit, 0.5);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ backgroundColor: "rgba(8,6,4,0.62)" }} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: `0 ${safe.side}px`,
          paddingBottom: wide ? 0 : 120 * unit,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28 * unit,
            letterSpacing: 0.18 * 28 * unit,
            textTransform: "uppercase",
            color: "#e9b872",
            marginBottom: 34 * unit,
            whiteSpace: "nowrap",
          }}
        >
          {over.slice(0, typed).join("")}
          <span style={{ opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0 }}>▍</span>
        </div>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: titleSize,
            lineHeight: 1.08,
            color: "#fbf6ec",
            textAlign: "center",
            textWrap: "balance",
            maxWidth: wide ? width * 0.7 : width - safe.side * 2,
            opacity: titleIn,
            translate: `0px ${(1 - titleIn) * 26 * unit}px`,
            textShadow: `0 ${4 * unit}px ${30 * unit}px rgba(0,0,0,0.8)`,
          }}
        >
          {text}
        </div>
        <div
          style={{
            marginTop: 34 * unit,
            width: 180 * unit * subIn,
            height: Math.max(1, 2 * unit),
            backgroundColor: "rgba(233,184,114,0.9)",
          }}
        />
        {subtitle ? (
          <div
            style={{
              marginTop: 26 * unit,
              fontFamily: FONTS.serif,
              fontVariant: "small-caps",
              fontSize: 40 * unit,
              letterSpacing: 0.14 * 40 * unit,
              color: "#efe3cb",
              textAlign: "center",
              opacity: subIn,
              maxWidth: wide ? width * 0.7 : width - safe.side * 2,
            }}
          >
            {subtitle.normalize("NFC")}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
