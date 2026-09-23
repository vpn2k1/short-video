/**
 * Phong cách "Sách truyện": sách tranh thiếu nhi. Mỗi cảnh là một trang — tranh minh hoạ trong khung bo tròn
 * viền trắng, dải ruy băng tên trang, chữ tròn to bên dưới; từ đang đọc sáng màu nhấn và nảy lên như ngón tay
 * dò theo chữ. Sang cảnh mới thì góc trang cuộn lên lộ trang sau. Xem skill `.claude/skills/style-storybook/SKILL.md`.
 *
 * Thứ tự lớp: khung bìa → trang mới → trang cũ đang cuộn → nếp gập → trang bìa truyện → nhiễu giấy.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";
import { ensureFonts } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, seeded, useLayout } from "../shared";
import { findPunch } from "../whiteboard/written";
import { curlAt, polygonCss, polygonSvg } from "./curl";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CURL = Easing.bezier(0.4, 0, 0.3, 1);
const POP = Easing.out(Easing.back(2.2));
/** Số frame cuộn một trang. */
const CURL_FRAMES = 22;

const ROUND = FONT_CATALOG.baloo.stack;
const SCRIPT = FONT_CATALOG.dancing.stack;
const PAGE = "#fff7e8";
const INK = "#4a3426";

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };

/** Màu pastel của khung bìa: màu nhấn pha trắng. */
const pastel = (accent: string, amount = 38) => `color-mix(in srgb, ${accent} ${amount}%, #fff8ec)`;

// ---------------------------------------------------------------------------
// Trang giấy + hoạ tiết
// ---------------------------------------------------------------------------
const Star: React.FC<{ x: number; y: number; size: number; color: string; rotate?: number; opacity?: number }> = ({
  x, y, size, color, rotate = 0, opacity = 1,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="-50 -50 100 100"
    style={{ position: "absolute", left: x - size / 2, top: y - size / 2, rotate: `${rotate.toFixed(1)}deg`, opacity, overflow: "visible" }}
  >
    <path
      d="M 0 -48 L 13 -15 L 48 -13 L 20 9 L 30 44 L 0 24 L -30 44 L -20 9 L -48 -13 L -13 -15 Z"
      fill={color}
      stroke="#ffffff"
      strokeWidth={6}
      strokeLinejoin="round"
    />
  </svg>
);

/** Giấy trang sách với vài ngôi sao, chấm tròn nhấp nháy ở mép — seed theo trang. */
const PagePaper: React.FC<{ seed: string; frame: number; accent: string }> = ({ seed, frame, accent }) => {
  const { width, height, unit } = useLayout();
  const inset = 26 * unit;
  const dots = Array.from({ length: 7 }, (_, i) => {
    // Rải quanh mép, tránh giữa trang.
    const edge = i % 4;
    const along = seeded(`${seed}-a${i}`, 0.08, 0.92);
    const depth = seeded(`${seed}-d${i}`, 0.03, 0.08);
    const x = edge === 0 ? along * width : edge === 1 ? width * (1 - depth) : edge === 2 ? along * width : width * depth;
    const y = edge === 0 ? height * depth : edge === 1 ? along * height : edge === 2 ? height * (1 - depth) : along * height;
    const twinkle = 0.75 + Math.sin(frame / 9 + i * 1.7) * 0.25;
    return { x, y, size: seeded(`${seed}-s${i}`, 22, 44) * unit * twinkle, star: i % 3 !== 0, rot: seeded(`${seed}-r${i}`, -30, 30) };
  });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset,
          borderRadius: 38 * unit,
          backgroundColor: PAGE,
          backgroundImage: "radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(210, 160, 110, 0.18) 100%)",
          boxShadow: `inset 0 0 0 ${4 * unit}px rgba(255, 255, 255, 0.7), 0 ${6 * unit}px ${24 * unit}px rgba(90, 50, 20, 0.25)`,
        }}
      />
      {dots.map((d, i) =>
        d.star ? (
          <Star key={i} x={d.x} y={d.y} size={d.size} color={i % 2 ? "#ffd166" : pastel(accent, 70)} rotate={d.rot} />
        ) : (
          <div key={i} style={{ position: "absolute", left: d.x - d.size / 4, top: d.y - d.size / 4, width: d.size / 2, height: d.size / 2, borderRadius: "50%", backgroundColor: pastel(accent, 55) }} />
        ),
      )}
    </AbsoluteFill>
  );
};

/** Ruy băng tên trang, hai đuôi cắt chữ V. */
const Ribbon: React.FC<{ text: string; cx: number; y: number; unit: number; accent: string; t: number }> = ({ text, cx, y, unit, accent, t }) => {
  const size = Math.min(52 * unit, (620 * unit) / Math.max(6, [...text].length) * 1.4);
  const h = size * 1.7;
  const tail = h * 0.55;
  const darker = `color-mix(in srgb, ${accent} 75%, #3a1a00)`;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: y,
        transform: `translate(-50%, -50%) scale(${(0.5 + t * 0.5).toFixed(3)}) rotate(${((1 - t) * -8).toFixed(1)}deg)`,
        opacity: t,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div style={{ width: tail, height: h * 0.8, marginTop: h * 0.3, backgroundColor: darker, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 40% 50%)", marginRight: -tail * 0.3 }} />
      <div
        style={{
          position: "relative",
          height: h,
          padding: `0 ${size * 0.9}px`,
          display: "grid",
          placeItems: "center",
          backgroundColor: accent,
          borderRadius: 10 * unit,
          boxShadow: `0 ${5 * unit}px ${12 * unit}px rgba(90, 40, 0, 0.3)`,
          fontFamily: ROUND,
          fontWeight: 800,
          fontSize: size,
          color: "#ffffff",
          whiteSpace: "nowrap",
          textShadow: `0 ${2 * unit}px 0 ${darker}`,
        }}
      >
        {text}
      </div>
      <div style={{ width: tail, height: h * 0.8, marginTop: h * 0.3, backgroundColor: darker, clipPath: "polygon(0 0, 100% 0, 60% 50%, 100% 100%, 0 100%)", marginLeft: -tail * 0.3 }} />
    </div>
  );
};

/** Nhãn tròn răng cưa: con số / chữ ngắn, hoặc câu nhấn không có trong lời. */
const Sticker: React.FC<{ text: string; caption: string | null; cx: number; cy: number; size: number; unit: number; accent: string; t: number }> = ({
  text, caption, cx, cy, size, unit, accent, t,
}) => {
  const teeth = 18;
  const path = Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 ? 44 : 50;
    const a = (Math.PI * i) / teeth;
    return `${i ? "L" : "M"} ${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }).join(" ") + " Z";
  // Chữ ngắn to hết cỡ; chữ dài xuống dòng trong vòng tròn.
  const textSize = size * Math.min(0.3, 0.52 / Math.sqrt(Math.max(1, [...text].length)));
  return (
    <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size, scale: String(t), rotate: `${((1 - t) * 90 - 8).toFixed(1)}deg` }}>
      <svg width={size} height={size} viewBox="-52 -52 104 104" style={{ position: "absolute", inset: 0, filter: `drop-shadow(0 ${4 * unit}px ${6 * unit}px rgba(90, 40, 0, 0.3))` }}>
        <path d={path} fill={accent} stroke="#ffffff" strokeWidth={4} strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", inset: size * 0.14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#ffffff", fontFamily: ROUND, fontWeight: 800, lineHeight: 1.05 }}>
        <div style={{ fontSize: textSize }}>{text}</div>
        {caption ? <div style={{ fontSize: Math.max(18 * unit, textSize * 0.36), fontWeight: 600, marginTop: 4 * unit }}>{caption}</div> : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chữ đọc theo: từ đang đọc sáng màu nhấn
// ---------------------------------------------------------------------------
const ReadAlong: React.FC<{ captions: Caption[]; zone: Rect; frame: number; appear: number; punch: Scene["punch"]; accent: string; unit: number }> = ({
  captions, zone, frame, appear, punch, accent, unit,
}) => {
  const active = activeIndexAt(captions, frame);
  if (active < 0) return null;
  const caption = captions[active];
  const start = Math.max(appear, msToFrames(caption.startMs));
  if (frame < start) return null;
  const end = Math.max(start + 1, msToFrames(caption.endMs));
  const words = caption.text.normalize("NFC").split(/\s+/).filter(Boolean);
  // Mốc từng từ: chia 90% thời lượng câu theo độ dài từ (từ dài đọc lâu hơn).
  const weights = words.map((w) => [...w].length + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const marks = weights.map((w) => {
    const at = start + (acc / total) * (end - start) * 0.9;
    acc += w;
    return at;
  });
  const range = punch ? findPunch(caption.text, punch.text) : null;
  const punchAt = punch ? msToFrames(punch.atMs) : 0;

  // Cỡ chữ: câu ngắn to, câu dài nhỏ dần cho vừa vùng chữ (Baloo ~0.52em mỗi ký tự).
  const chars = [...caption.text].length;
  const lineHeight = 1.25;
  let size = 88 * unit;
  while (Math.ceil((chars * size * 0.52 * 1.15) / zone.w) * size * lineHeight > zone.h && size > 34 * unit) size *= 0.94;
  const enter = interpolate(frame, [start, start + 8], [0, 1], { ...clamp, easing: POP });

  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        height: zone.h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: ROUND,
          fontWeight: 700,
          fontSize: size,
          lineHeight,
          textAlign: "center",
          color: INK,
          opacity: enter,
          transform: `scale(${(0.9 + enter * 0.1).toFixed(3)})`,
        }}
      >
        {words.map((word, k) => {
          const on = frame >= marks[k] && (k === words.length - 1 || frame < marks[k + 1]);
          const read = frame >= marks[k];
          const inPunch = range !== null && k >= range[0] && k <= range[1];
          const punchOn = inPunch && frame >= punchAt;
          const bounce = on ? Math.sin(interpolate(frame, [marks[k], marks[k] + 8], [0, Math.PI], clamp)) : 0;
          const wiggle = punchOn ? Math.sin((frame - punchAt) / 2.2) * interpolate(frame, [punchAt, punchAt + 24], [7, 0], clamp) : 0;
          return (
            <span key={`w-${k}`}>
              {k > 0 ? " " : ""}
              <span
                style={{
                  display: "inline-block",
                  color: on || punchOn ? accent : INK,
                  opacity: read ? 1 : 0.38,
                  fontWeight: punchOn ? 800 : 700,
                  transform: `translateY(${(-bounce * size * 0.12).toFixed(1)}px) scale(${(1 + bounce * 0.1 + (punchOn ? 0.06 : 0)).toFixed(3)}) rotate(${wiggle.toFixed(1)}deg)`,
                  textShadow: on ? `0 0 ${(size * 0.25).toFixed(1)}px ${pastel(accent, 60)}` : undefined,
                }}
              >
                {word}
              </span>
            </span>
          );
        })}
      </div>
      {/* Sao bắn ra lúc tới câu nhấn */}
      {range && frame >= punchAt && frame < punchAt + 24
        ? Array.from({ length: 8 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 8 + 0.3;
          const t = interpolate(frame, [punchAt, punchAt + 24], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
          const r = zone.w * 0.2 + t * zone.w * 0.32;
          return (
            <Star
              key={`b-${i}`}
              x={zone.w / 2 + Math.cos(a) * r}
              y={zone.h / 2 + Math.sin(a) * r * 0.55}
              size={(26 + (i % 3) * 8) * unit}
              color={i % 2 ? "#ffd166" : accent}
              rotate={t * 180}
              opacity={1 - t}
            />
          );
        })
        : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Một trang = một cảnh
// ---------------------------------------------------------------------------
const Page: React.FC<{ scene: Scene; index: number; captions: Caption[]; printAt: number; appear: number; frame: number; accent: string }> = ({
  scene, index, captions, printAt, appear, frame, accent,
}) => {
  const layout = useLayout();
  const { width, height, safe, unit } = layout;
  const stacked = height / width >= 1.2;
  const left = safe.side + 10 * unit;
  const right = width - safe.side - 10 * unit;
  const top = safe.top + 30 * unit;
  const bottom = height - safe.bottom;
  const contentW = right - left;
  const seed = `sb-page-${index}`;
  const punchInText = scene.punch ? captions.some((c) => findPunch(c.text, scene.punch!.text)) : true;
  const stickerText = scene.visual ? scene.visual.text : scene.punch && !punchInText ? scene.punch.text : null;
  const stickerAt = scene.visual ? appear + 12 : scene.punch ? Math.max(appear, msToFrames(scene.punch.atMs)) : appear;

  let art: Rect | null = null;
  let text: Rect;
  if (stacked) {
    const artH = scene.image ? Math.min((bottom - top) * 0.56, contentW * 1.05) : stickerText ? (bottom - top) * 0.3 : 0;
    if (scene.image) art = { x: left, y: top, w: contentW, h: artH };
    const textTop = top + (artH > 0 ? artH + 50 * unit : 0);
    text = { x: left, y: textTop, w: contentW, h: bottom - textTop };
  } else {
    const split = left + contentW * (scene.image || stickerText ? 0.54 : 0);
    if (scene.image) art = { x: left, y: top, w: split - left - 30 * unit, h: bottom - top };
    text = { x: split + (scene.image ? 30 * unit : 0), y: top, w: right - split - (scene.image ? 30 * unit : 0), h: bottom - top };
  }
  const float = Math.sin(frame / 24 + index) * 6 * unit;
  const ribbonT = interpolate(frame, [printAt, printAt + 10], [0, 1], { ...clamp, easing: POP });
  const stickerT = interpolate(frame, [stickerAt, stickerAt + 12], [0, 1], { ...clamp, easing: POP });
  // Có tranh: nhãn nhỏ đè góc tranh. Không tranh: nhãn là hình chính của trang.
  const stickerSize = art
    ? Math.min(contentW * 0.36, 300 * unit)
    : stacked
      ? Math.min(contentW * 0.62, (text.y - top - (scene.tag ? 60 * unit : 0)) * 0.95, 480 * unit)
      : Math.min((text.x - left) * 0.8, (bottom - top) * 0.7);
  // Chừa chỗ cho ruy băng ở đầu trang khi nhãn là hình chính.
  const ribbonRoom = scene.tag ? 60 * unit : 0;
  const stickerPos = art
    ? { x: art.x + art.w - stickerSize * 0.35, y: art.y + art.h - stickerSize * 0.3 }
    : stacked
      ? { x: width / 2, y: top + ribbonRoom + (text.y - top - ribbonRoom) / 2 }
      : { x: left + (text.x - left) / 2, y: height / 2 + ribbonRoom / 2 };

  return (
    <AbsoluteFill>
      <PagePaper seed={seed} frame={frame} accent={accent} />
      {art ? (
        <div
          style={{
            position: "absolute",
            left: art.x,
            top: art.y + float,
            width: art.w,
            height: art.h,
            borderRadius: 44 * unit,
            overflow: "hidden",
            border: `${10 * unit}px solid #ffffff`,
            boxShadow: `0 ${10 * unit}px ${26 * unit}px rgba(90, 50, 20, 0.28)`,
            backgroundColor: pastel(accent, 25),
            rotate: `${seeded(`${seed}-tilt`, -1.4, 1.4).toFixed(2)}deg`,
          }}
        >
          <SceneMedia scene={scene} from={printAt} zoom={interpolate(frame, [printAt, printAt + 300], [1.03, 1.12], clamp)} />
        </div>
      ) : null}
      {scene.tag ? <Ribbon text={scene.tag} cx={art ? art.x + art.w / 2 : stacked ? width / 2 : text.x + text.w / 2} y={art ? art.y + float : top} unit={unit} accent={accent} t={ribbonT} /> : null}
      {stickerText && stickerT > 0 ? (
        <Sticker text={stickerText} caption={scene.visual?.caption ?? null} cx={stickerPos.x} cy={stickerPos.y} size={stickerSize} unit={unit} accent={accent} t={stickerT} />
      ) : null}
      <ReadAlong captions={captions} zone={text} frame={frame} appear={appear} punch={scene.punch} accent={accent} unit={unit} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Bìa truyện
// ---------------------------------------------------------------------------
const CoverPage: React.FC<{ title: string; subtitle: string; accent: string; frame: number }> = ({ title, subtitle, accent, frame }) => {
  const { width, safe, unit } = useLayout();
  const maxW = width - safe.side * 2;
  let size = 130 * unit;
  while (Math.ceil(([...title].length * size * 0.55) / maxW) > 3 && size > 56 * unit) size *= 0.92;
  const titleT = interpolate(frame, [8, 22], [0, 1], { ...clamp, easing: POP });
  const moonT = interpolate(frame, [0, 18], [0, 1], { ...clamp, easing: POP });
  return (
    <AbsoluteFill>
      <PagePaper seed="sb-cover" frame={frame} accent={accent} />
      {/* Trăng khuyết + mây */}
      <svg width={220 * unit} height={220 * unit} viewBox="0 0 100 100" style={{ position: "absolute", left: width / 2 - 110 * unit, top: safe.top, scale: String(moonT), rotate: `${((1 - moonT) * -40).toFixed(1)}deg` }}>
        <path d="M 62 12 A 40 40 0 1 0 88 72 A 32 32 0 1 1 62 12 Z" fill="#ffd166" stroke="#ffffff" strokeWidth={3} />
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `0 ${safe.side}px`, gap: 18 * unit, textAlign: "center" }}>
        <div style={{ fontFamily: SCRIPT, fontWeight: 700, fontSize: 60 * unit, color: pastel(accent, 85), opacity: interpolate(frame, [4, 14], [0, 1], clamp) }}>
          Ngày xửa ngày xưa…
        </div>
        <div
          style={{
            fontFamily: ROUND,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.08,
            color: accent,
            WebkitTextStroke: `${(size * 0.1).toFixed(1)}px #ffffff`,
            paintOrder: "stroke fill",
            textShadow: `0 ${6 * unit}px ${14 * unit}px rgba(90, 50, 20, 0.25)`,
            transform: `scale(${(0.6 + titleT * 0.4).toFixed(3)})`,
            opacity: titleT,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontFamily: ROUND, fontWeight: 600, fontSize: Math.min(size * 0.42, 52 * unit), color: INK, opacity: interpolate(frame, [20, 30], [0, 1], clamp) }}>
            {subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Trang cũ đang cuộn góc: phần còn phẳng + nếp gập mặt sau + bóng. */
const Curling: React.FC<{ t: number; children: React.ReactNode }> = ({ t, children }) => {
  const { width, height, unit } = useLayout();
  const curl = curlAt(width, height, t);
  return (
    <>
      {/* Bóng trang cũ đổ lên trang mới dọc nếp gập */}
      {/* filter phải nằm ngoài clip-path, không thì bóng bị cắt theo */}
      <AbsoluteFill style={{ filter: `drop-shadow(${-8 * unit}px ${-6 * unit}px ${18 * unit}px rgba(60, 30, 10, 0.35))` }}>
        <AbsoluteFill style={{ clipPath: polygonCss(curl.kept) }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id="sb-flap" gradientUnits="userSpaceOnUse" x1={curl.fold?.[0][0] ?? 0} y1={curl.fold?.[0][1] ?? 0} x2={width * 0.2} y2={height * 0.2}>
            <stop offset="0" stopColor="#e8d9c0" />
            <stop offset="0.5" stopColor="#fbf2e2" />
            <stop offset="1" stopColor="#f1e4cc" />
          </linearGradient>
          <filter id="sb-flap-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx={-6 * unit} dy={-6 * unit} stdDeviation={10 * unit} floodColor="#3c1e0a" floodOpacity={0.35} />
          </filter>
        </defs>
        {curl.flap.length >= 3 ? <polygon points={polygonSvg(curl.flap)} fill="url(#sb-flap)" filter="url(#sb-flap-shadow)" /> : null}
      </svg>
    </>
  );
};

// ---------------------------------------------------------------------------
export const StorybookStyle: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, showTitle }) => {
  ensureFonts(["baloo", "dancing"]);
  const frame = useCurrentFrame();
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const pageOf = captions.map((c) => Math.max(0, activeIndexAt(pages, msToFrames(c.startMs))));
  const titleEnd = showTitle ? TITLE_FRAMES : 0;
  const active = Math.max(0, activeIndexAt(pages, frame));
  const startOf = (i: number) => (i === 0 ? 0 : msToFrames(pages[i].startMs));
  const page = (i: number) => (
    <Page
      scene={pages[i]}
      index={i}
      captions={captions.filter((_, k) => pageOf[k] === i)}
      printAt={i === 0 ? titleEnd : startOf(i)}
      appear={i === 0 ? titleEnd : startOf(i) + Math.round(CURL_FRAMES * 0.5)}
      frame={frame}
      accent={accent}
    />
  );
  // Trang cũ đang cuộn đi (cảnh trước), hoặc bìa truyện lúc hết phần tiêu đề.
  const curling = active > 0 && frame < startOf(active) + CURL_FRAMES ? active - 1 : -1;
  const curlT = curling >= 0 ? interpolate(frame, [startOf(active), startOf(active) + CURL_FRAMES], [0, 1], { ...clamp, easing: CURL }) : 0;
  const coverT = showTitle ? interpolate(frame, [TITLE_FRAMES - 4, TITLE_FRAMES - 4 + CURL_FRAMES], [0, 1], { ...clamp, easing: CURL }) : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: pastel(accent, 45),
        backgroundImage: "radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.35) 0 12%, transparent 13%), radial-gradient(circle at 85% 90%, rgba(255, 255, 255, 0.25) 0 14%, transparent 15%)",
        overflow: "hidden",
      }}
    >
      {page(active)}
      {curling >= 0 ? <Curling t={curlT}>{page(curling)}</Curling> : null}
      {coverT < 1 ? (
        coverT <= 0 ? (
          <AbsoluteFill>
            <CoverPage title={title} subtitle={subtitle} accent={accent} frame={frame} />
          </AbsoluteFill>
        ) : (
          <Curling t={coverT}>
            <CoverPage title={title} subtitle={subtitle} accent={accent} frame={frame} />
          </Curling>
        )
      ) : null}
      <Grain opacity={0.05} animated={false} baseFrequency={0.85} />
    </AbsoluteFill>
  );
};
