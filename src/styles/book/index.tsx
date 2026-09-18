/**
 * Phong cách "Mở sách": cuốn sách bìa da trên bàn dưới ánh đèn. Đầu video bìa sách mở ra; mỗi cảnh là một
 * trang in — tranh minh hoạ có khung, chữ có chân canh đều hai bên, chữ cái đầu chương cỡ lớn, số trang.
 * Sang cảnh mới thì trang lật 3D quanh gáy sách. Xem skill `.claude/skills/style-book/SKILL.md`.
 *
 * Dọc (9:16, 4:5, 1:1): nhìn gần trang phải, gáy sách ở mép trái. Ngang (16:9): sách mở hai trang —
 * tranh trang trái, chữ trang phải; mặt sau tờ đang lật chính là trang trái của cảnh sau.
 *
 * Thứ tự lớp: bàn → trang trái → trang phải (cảnh hiện tại) → tờ đang lật → bìa → nhiễu giấy.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Caption, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";
import { ensureFonts } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, Grain, useLayout } from "../shared";
import { findPunch } from "../whiteboard/written";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const TURN = Easing.bezier(0.45, 0, 0.25, 1);
/** Số frame lật một trang / mở bìa. */
const TURN_FRAMES = 20;
const COVER_FRAMES = 24;

const SERIF = FONT_CATALOG.lora.stack;
const DISPLAY = FONT_CATALOG.playfair.stack;
const PAPER = "#f3ead5";
const PAPER_BACK = "#e9dfc6";
const INK = "#2b2118";
const FADED = "#7a6a55";

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Rect = { x: number; y: number; w: number; h: number };

type BookLayout = {
  spread: boolean;
  unit: number;
  /** Trang phải (toạ độ khung hình); trang trái đối xứng qua gáy khi `spread`. */
  page: Rect;
  spine: number;
  /** Vùng nội dung trong trang, toạ độ tính từ góc trên trái của trang. */
  inset: { top: number; bottom: number; side: number; gutter: number };
};

const useBookLayout = (): BookLayout => {
  const { width, height, safe, unit } = useLayout();
  const spread = width / height >= 1.3;
  if (spread) {
    const pageH = height * 0.9;
    const pageW = Math.min(width * 0.44, pageH * 0.72);
    const spine = width / 2;
    return {
      spread, unit, spine,
      page: { x: spine, y: (height - pageH) / 2, w: pageW, h: pageH },
      inset: { top: Math.max(56 * unit, safe.top - (height - pageH) / 2), bottom: Math.max(70 * unit, safe.bottom - (height - pageH) / 2), side: 54 * unit, gutter: 50 * unit },
    };
  }
  const spine = width * 0.075;
  const top = height * 0.03;
  const page = { x: spine, y: top, w: width * 0.965 - spine, h: height - top * 2 };
  return {
    spread, unit, spine, page,
    inset: {
      top: Math.max(70 * unit, safe.top - top),
      bottom: Math.max(90 * unit, safe.bottom - top),
      side: Math.max(46 * unit, width - safe.side - (page.x + page.w)),
      gutter: Math.max(50 * unit, safe.side - spine),
    },
  };
};

// ---------------------------------------------------------------------------
// Giấy
// ---------------------------------------------------------------------------
/** Tờ giấy một trang. `side` = phía của trang so với gáy — bóng gáy nằm phía đó. */
const PaperSheet: React.FC<{ side: "right" | "left"; back?: boolean; unit: number; children?: React.ReactNode }> = ({
  side, back = false, unit, children,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: back ? PAPER_BACK : PAPER,
      backgroundImage: [
        // Bóng gáy sách + mép ngoài hơi ngả màu.
        `linear-gradient(${side === "right" ? "90deg" : "270deg"}, rgba(60, 35, 10, 0.32) 0%, rgba(60, 35, 10, 0.08) 5%, transparent 12%, transparent 92%, rgba(120, 80, 30, 0.12) 100%)`,
        "radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(140, 100, 50, 0.16) 100%)",
      ].join(", "),
      borderRadius: side === "right" ? `0 ${6 * unit}px ${6 * unit}px 0` : `${6 * unit}px 0 0 ${6 * unit}px`,
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

/** Mép các trang xếp chồng bên dưới tờ trên cùng. */
const PageStack: React.FC<{ rect: Rect; side: "right" | "left"; unit: number }> = ({ rect, side, unit }) => (
  <>
    {[3, 2, 1].map((k) => (
      <div
        key={k}
        style={{
          position: "absolute",
          left: side === "right" ? rect.x : rect.x - k * 3 * unit,
          top: rect.y + k * 2 * unit,
          width: rect.w + k * 3 * unit,
          height: rect.h,
          backgroundColor: k % 2 ? "#e3d7bb" : "#efe5cc",
          borderRadius: 6 * unit,
          boxShadow: k === 3 ? `0 ${14 * unit}px ${40 * unit}px rgba(0, 0, 0, 0.6)` : undefined,
        }}
      />
    ))}
  </>
);

// ---------------------------------------------------------------------------
// Nội dung trang
// ---------------------------------------------------------------------------
type Word = { text: string; caption: number; start: number; end: number };

/** Chữ trong trang: mọi câu của trang được xếp sẵn (câu chưa đọc tàng hình) nên dòng không nhảy khi câu mới hiện. */
const Prose: React.FC<{
  captions: Caption[]; zone: Rect; frame: number; appear: number; punch: Scene["punch"]; accent: string; unit: number; dropCap: boolean;
}> = ({ captions, zone, frame, appear, punch, accent, unit, dropCap }) => {
  if (captions.length === 0) return null;
  // Cỡ chữ: vừa cả trang. Lora trung bình ~0.5em mỗi ký tự; nhân 1.12 bù chỗ trống cuối dòng và chữ hoa đầu chương.
  const chars = captions.reduce((n, c) => n + [...c.text].length + 1, 0);
  const lineHeight = 1.5;
  const fits = (size: number) => Math.ceil((chars * size * 0.5 * 1.12) / zone.w + (dropCap ? 1.2 : 0)) * size * lineHeight <= zone.h;
  let size = 88 * unit;
  while (!fits(size) && size > 26 * unit) size *= 0.95;

  const words: Word[] = [];
  captions.forEach((caption, index) => {
    const start = Math.max(appear, msToFrames(caption.startMs));
    const duration = Math.max(1, msToFrames(caption.endMs) - start);
    const list = caption.text.normalize("NFC").split(/\s+/).filter(Boolean);
    list.forEach((word, k) => {
      // Chữ "thấm" ra theo nhịp đọc: rải các từ trong nửa đầu câu.
      const at = start + (k / Math.max(1, list.length)) * duration * 0.55;
      words.push({ text: word, caption: index, start: at, end: at + 6 });
    });
  });
  const punchWords = new Set<number>();
  if (punch) {
    captions.forEach((caption, index) => {
      const range = findPunch(caption.text, punch.text);
      if (!range) return;
      const offset = words.findIndex((w) => w.caption === index);
      for (let k = range[0]; k <= range[1]; k++) punchWords.add(offset + k);
    });
  }
  const punchT = punch ? interpolate(frame, [msToFrames(punch.atMs), msToFrames(punch.atMs) + 10], [0, 1], clamp) : 0;
  const first = words[0];
  const firstChars = first ? [...first.text] : [];

  return (
    <div
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.w,
        height: zone.h,
        fontFamily: SERIF,
        fontSize: size,
        lineHeight,
        color: INK,
        textAlign: "justify",
        hyphens: "none",
      }}
    >
      {dropCap && first ? (
        <span
          style={{
            float: "left",
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: size * lineHeight * 2.35,
            lineHeight: 0.82,
            marginTop: size * 0.12,
            marginRight: size * 0.18,
            color: accent,
            opacity: interpolate(frame, [first.start, first.end], [0, 1], clamp),
          }}
        >
          {firstChars[0]}
        </span>
      ) : null}
      {words.map((word, index) => {
        const text = index === 0 && dropCap ? firstChars.slice(1).join("") : word.text;
        const t = interpolate(frame, [word.start, word.end], [0, 1], clamp);
        const isPunch = punchWords.has(index);
        return (
          <span key={`w-${index}`}>
            {index > 0 ? " " : ""}
            <span
              style={{
                opacity: t,
                filter: t < 1 ? `blur(${((1 - t) * size * 0.06).toFixed(2)}px)` : undefined,
                fontStyle: isPunch && punchT > 0 ? "italic" : undefined,
                color: isPunch ? `color-mix(in srgb, ${accent} ${(punchT * 100).toFixed(0)}%, ${INK})` : undefined,
                // Gạch chân bút chì kéo dài theo punchT.
                backgroundImage: isPunch ? `linear-gradient(${accent}, ${accent})` : undefined,
                backgroundSize: isPunch ? `${(punchT * 100).toFixed(1)}% ${Math.max(2, size * 0.07).toFixed(1)}px` : undefined,
                backgroundPosition: "0 92%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {text}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Tranh minh hoạ in trong trang: khung đôi mảnh. */
const Plate: React.FC<{ scene: Scene; box: Rect; appear: number; frame: number; unit: number }> = ({ scene, box, appear, frame, unit }) => (
  <div
    style={{
      position: "absolute",
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      padding: 8 * unit,
      boxSizing: "border-box",
      border: `${2 * unit}px solid rgba(43, 33, 24, 0.55)`,
      opacity: frame >= appear ? 1 : 0,
    }}
  >
    <div style={{ width: "100%", height: "100%", overflow: "hidden", outline: `${1 * unit}px solid rgba(43, 33, 24, 0.4)`, filter: "sepia(0.12) contrast(0.96)" }}>
      <SceneMedia scene={scene} from={appear} zoom={interpolate(frame, [appear, appear + 300], [1, 1.08], clamp)} />
    </div>
  </div>
);

/** Con số / nhãn / câu nhấn không có trong lời — in như câu trích dẫn giữa trang. */
const PullQuote: React.FC<{ text: string; caption: string | null; box: Rect; appear: number; frame: number; unit: number; accent: string }> = ({
  text, caption, box, appear, frame, unit, accent,
}) => {
  const t = interpolate(frame, [appear, appear + 12], [0, 1], clamp);
  const size = Math.min(box.h * 0.5, (box.w / Math.max(4, [...text].length)) * 1.5, 150 * unit);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6 * unit,
        textAlign: "center",
        opacity: t,
        transform: `translateY(${((1 - t) * 14 * unit).toFixed(1)}px)`,
      }}
    >
      <div style={{ width: box.w * 0.3, height: 2 * unit, backgroundColor: accent }} />
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: size, lineHeight: 1.1, color: accent }}>{text}</div>
      {caption ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: Math.max(28 * unit, size * 0.3), color: FADED }}>{caption}</div> : null}
      <div style={{ width: box.w * 0.3, height: 2 * unit, backgroundColor: accent }} />
    </div>
  );
};

/** Trang chữ (trang phải). Dọc thì tranh cũng nằm ở đây; ngang thì tranh sang trang trái. */
const TextPage: React.FC<{
  scene: Scene; index: number; captions: Caption[];
  /** Tranh, tiêu đề chương in sẵn từ lúc trang lộ ra; lời hiện theo giọng đọc từ `appear`. */
  printAt: number; appear: number; frame: number; layout: BookLayout; accent: string; bookTitle: string;
}> = ({ scene, index, captions, printAt, appear, frame, layout, accent, bookTitle }) => {
  const { page, inset, unit, spread } = layout;
  const left = inset.gutter;
  const right = page.w - inset.side;
  const contentW = right - left;
  const headerH = 70 * unit;
  let y = inset.top;

  // Tiêu đề chương.
  const chapter = scene.tag ? (
    <div
      style={{
        position: "absolute",
        left,
        top: y,
        width: contentW,
        textAlign: "center",
        fontFamily: DISPLAY,
        fontSize: 40 * unit,
        letterSpacing: 1 * unit,
        color: accent,
        opacity: interpolate(frame, [printAt, printAt + 1], [0, 1], clamp),
      }}
    >
      {scene.tag}
      <div style={{ margin: `${8 * unit}px auto 0`, width: contentW * 0.25, height: 1.5 * unit, backgroundColor: "rgba(43, 33, 24, 0.45)" }} />
    </div>
  ) : null;
  if (scene.tag) y += headerH + 20 * unit;

  const bottom = page.h - inset.bottom;
  const punchInText = scene.punch ? captions.some((c) => findPunch(c.text, scene.punch!.text)) : true;
  const quoteText = scene.visual ? scene.visual.text : scene.punch && !punchInText ? scene.punch.text : null;
  const plate = !spread && scene.image ? { x: left, y, w: contentW, h: Math.min((bottom - y) * 0.42, contentW * 0.72) } : null;
  if (plate) y += plate.h + 34 * unit;
  const quote = quoteText !== null ? { x: left, y, w: contentW, h: Math.min(220 * unit, (bottom - y) * 0.3) } : null;
  if (quote) y += quote.h + 20 * unit;

  return (
    <>
      <div style={{ position: "absolute", left, top: inset.top * 0.45, width: contentW, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 26 * unit, color: FADED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {bookTitle}
      </div>
      {chapter}
      {plate ? <Plate scene={scene} box={plate} appear={printAt} frame={frame} unit={unit} /> : null}
      {quote && quoteText ? (
        <PullQuote
          text={quoteText}
          caption={scene.visual?.caption ?? null}
          box={quote}
          appear={scene.visual ? appear + 10 : Math.max(appear, msToFrames(scene.punch!.atMs))}
          frame={frame}
          unit={unit}
          accent={accent}
        />
      ) : null}
      <Prose
        captions={captions}
        zone={{ x: left, y, w: contentW, h: bottom - y }}
        frame={frame}
        appear={appear}
        punch={scene.punch}
        accent={accent}
        unit={unit}
        dropCap={Boolean(scene.tag) || index === 0}
      />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: inset.bottom * 0.4, textAlign: "center", fontFamily: SERIF, fontSize: 28 * unit, color: FADED }}>
        — {index * 2 + (spread ? 2 : 1)} —
      </div>
    </>
  );
};

/** Trang trái khi mở hai trang: tranh cả trang, hoặc hoa văn nếu cảnh không có ảnh. */
const PicturePage: React.FC<{ scene: Scene; index: number; printAt: number; frame: number; layout: BookLayout; accent: string }> = ({
  scene, index, printAt, frame, layout, accent,
}) => {
  const { page, inset, unit } = layout;
  const box = { x: inset.side, y: inset.top, w: page.w - inset.side - inset.gutter, h: page.h - inset.top - inset.bottom };
  return (
    <>
      {scene.image ? (
        <Plate scene={scene} box={box} appear={printAt} frame={frame} unit={unit} />
      ) : (
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontSize: 120 * unit, color: accent, opacity: 0.5 }}>
          ❦
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: inset.bottom * 0.4, textAlign: "center", fontFamily: SERIF, fontSize: 28 * unit, color: FADED }}>
        — {index * 2 + 1} —
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Bìa
// ---------------------------------------------------------------------------
const Cover: React.FC<{ title: string; subtitle: string; handle: string; accent: string; unit: number; w: number; h: number }> = ({
  title, subtitle, handle, accent, unit, w, h,
}) => {
  const gold = "#d9b86a";
  let size = 110 * unit;
  const perLine = (w * 0.74) / (size * 0.55);
  if ([...title].length / perLine > 3) size *= Math.sqrt((perLine * 3) / [...title].length);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: `${4 * unit}px ${14 * unit}px ${14 * unit}px ${4 * unit}px`,
        backgroundColor: `color-mix(in srgb, ${accent} 32%, #1c0f08)`,
        backgroundImage: [
          "linear-gradient(90deg, rgba(0, 0, 0, 0.45) 0%, rgba(255, 255, 255, 0.06) 4%, transparent 9%)",
          "radial-gradient(ellipse at 40% 30%, rgba(255, 255, 255, 0.10), transparent 60%)",
        ].join(", "),
        boxShadow: `inset 0 0 ${60 * unit}px rgba(0, 0, 0, 0.55)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26 * unit,
        padding: `0 ${w * 0.12}px`,
        boxSizing: "border-box",
        textAlign: "center",
        color: gold,
      }}
    >
      {/* Viền mạ vàng hai nét */}
      <div style={{ position: "absolute", inset: 34 * unit, border: `${3 * unit}px solid ${gold}`, borderRadius: 8 * unit, opacity: 0.8 }} />
      <div style={{ position: "absolute", inset: 48 * unit, border: `${1.5 * unit}px solid ${gold}`, borderRadius: 6 * unit, opacity: 0.6 }} />
      <div style={{ fontFamily: DISPLAY, fontSize: 60 * unit, lineHeight: 1 }}>❦</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, lineHeight: 1.12, textShadow: `0 ${2 * unit}px ${2 * unit}px rgba(0, 0, 0, 0.5)` }}>{title}</div>
      <div style={{ width: w * 0.3, height: 2 * unit, backgroundColor: gold, opacity: 0.8 }} />
      {subtitle ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: Math.min(size * 0.42, 50 * unit), color: "#ecd9a6" }}>{subtitle}</div> : null}
      {handle ? (
        <div style={{ position: "absolute", bottom: 90 * unit, left: 0, right: 0, fontFamily: SERIF, fontSize: 32 * unit, letterSpacing: 3 * unit, opacity: 0.85 }}>
          {handle}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
export const BookStyle: React.FC<ShortProps> = ({ title, subtitle, handle, accent, captions, scenes, showTitle }) => {
  ensureFonts(["lora", "playfair"]);
  const frame = useCurrentFrame();
  const { width, height } = useLayout();
  const layout = useBookLayout();
  const { page, unit, spread } = layout;
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const pageOf = captions.map((c) => Math.max(0, activeIndexAt(pages, msToFrames(c.startMs))));
  const titleEnd = showTitle ? TITLE_FRAMES : 0;
  const active = Math.max(0, activeIndexAt(pages, frame));
  const startOf = (i: number) => (i === 0 ? 0 : msToFrames(pages[i].startMs));
  const appearOf = (i: number) => (i === 0 ? Math.max(0, titleEnd) : startOf(i) + Math.round(TURN_FRAMES * 0.6));
  const captionsOf = (i: number) => captions.filter((_, k) => pageOf[k] === i);

  const leftRect = { ...page, x: page.x - page.w };
  const pageBox = (rect: Rect): React.CSSProperties => ({ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h });
  const textPage = (i: number) => (
    <TextPage scene={pages[i]} index={i} captions={captionsOf(i)} printAt={startOf(i)} appear={appearOf(i)} frame={frame} layout={layout} accent={accent} bookTitle={title} />
  );
  const picturePage = (i: number) => <PicturePage scene={pages[i]} index={i} printAt={startOf(i)} frame={frame} layout={layout} accent={accent} />;

  // Tờ đang lật: từ cảnh trước sang cảnh `active`.
  const turning = active > 0 && frame < startOf(active) + TURN_FRAMES ? active - 1 : -1;
  const angle = turning >= 0 ? interpolate(frame, [startOf(active), startOf(active) + TURN_FRAMES], [0, -180], { ...clamp, easing: TURN }) : 0;
  // Trang trái đứng yên: cảnh trước cho tới khi tờ lật nằm xuống hẳn.
  const leftIndex = turning >= 0 ? turning : active;

  // Bìa: sách trượt vào, rồi bìa mở quanh gáy.
  const coverAngle = showTitle ? interpolate(frame, [TITLE_FRAMES - 6, TITLE_FRAMES - 6 + COVER_FRAMES], [0, -180], { ...clamp, easing: TURN }) : -180;
  const enter = showTitle ? interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  // Dọc: sách đóng nằm giữa khung, mở ra thì trượt về đúng chỗ (gáy sát mép trái).
  const closedShift = spread ? -page.w / 2 : 0;
  const shiftX = closedShift * interpolate(coverAngle, [-180, -90, 0], [0, 0.6, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#140d08",
        backgroundImage: [
          "radial-gradient(ellipse at 50% 30%, rgba(255, 190, 110, 0.20), transparent 60%)",
          "repeating-linear-gradient(90deg, rgba(255, 210, 160, 0.03) 0 2px, transparent 2px 26px)",
        ].join(", "),
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          perspective: 2600 * unit,
          transform: `translateX(${shiftX.toFixed(1)}px) translateY(${((1 - enter) * height * 0.08).toFixed(1)}px) scale(${(0.94 + enter * 0.06).toFixed(3)})`,
          opacity: enter,
        }}
      >
        <PageStack rect={page} side="right" unit={unit} />
        {spread ? <PageStack rect={leftRect} side="left" unit={unit} /> : null}

        {/* Trang trái (chỉ khi mở hai trang) */}
        {spread && coverAngle <= -90 ? (
          <div style={pageBox(leftRect)}>
            <PaperSheet side="left" unit={unit}>{picturePage(leftIndex)}</PaperSheet>
          </div>
        ) : null}
        {/* Dọc: mép trang trái lấp ló bên kia gáy */}
        {!spread ? (
          <div style={{ position: "absolute", left: page.x - width * 0.2, top: page.y, width: width * 0.2, height: page.h }}>
            <PaperSheet side="left" unit={unit} />
          </div>
        ) : null}

        {/* Trang phải của cảnh hiện tại */}
        <div style={pageBox(page)}>
          <PaperSheet side="right" unit={unit}>{textPage(active)}</PaperSheet>
        </div>

        {/* Tờ đang lật: mặt trước là trang chữ cảnh trước, mặt sau là trang tranh cảnh mới */}
        {turning >= 0 ? (
          <div style={{ ...pageBox(page), transformStyle: "preserve-3d", transformOrigin: "0% 50%", transform: `rotateY(${angle.toFixed(2)}deg)` }}>
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
              <PaperSheet side="right" unit={unit}>{textPage(turning)}</PaperSheet>
              <AbsoluteFill style={{ backgroundColor: `rgba(40, 25, 10, ${(interpolate(angle, [-90, 0], [0.35, 0], clamp)).toFixed(3)})` }} />
            </div>
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              <PaperSheet side="left" back={!spread} unit={unit}>{spread ? picturePage(active) : null}</PaperSheet>
              <AbsoluteFill style={{ backgroundColor: `rgba(40, 25, 10, ${(interpolate(angle, [-180, -90], [0, 0.3], clamp)).toFixed(3)})` }} />
            </div>
          </div>
        ) : null}

        {/* Bìa sách */}
        {coverAngle > -180 ? (
          <div style={{ ...pageBox(page), transformStyle: "preserve-3d", transformOrigin: "0% 50%", transform: `rotateY(${coverAngle.toFixed(2)}deg)` }}>
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
              <Cover title={title} subtitle={subtitle} handle={handle} accent={accent} unit={unit} w={page.w} h={page.h} />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                backgroundColor: `color-mix(in srgb, ${accent} 20%, #2a1a10)`,
                borderRadius: `${14 * unit}px ${4 * unit}px ${4 * unit}px ${14 * unit}px`,
              }}
            />
          </div>
        ) : null}
      </AbsoluteFill>

      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.45) 100%)", pointerEvents: "none" }} />
      <Grain opacity={0.06} animated={false} baseFrequency={0.8} />
    </AbsoluteFill>
  );
};
