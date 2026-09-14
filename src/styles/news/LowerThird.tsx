import { interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { useCaptionClock, useSceneClock } from "../shared";
import { CAPTION_LH, DEFAULT_CATEGORY, HEADLINE_LH, UPPER_LH, type NewsLayout } from "./layout";
import { EASE_IN, EASE_INOUT, EASE_OUT, fitText, FONT, INK, NAVY, RED, ramp, upper, WHITE, withAlpha, YELLOW } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Gạt từ trái sang phải: 0 = ẩn hết, 1 = hiện đủ. */
const wipe = (p: number) => `inset(-2px ${((1 - p) * 100).toFixed(3)}% -2px 0)`;

/** Nhãn chuyên mục đỏ, chữ in hoa bằng JS, co chữ nếu nhãn dài hơn ô. */
const CategoryBox: React.FC<{ L: NewsLayout; label: string; width: number; height: number; p: number }> = ({
  L,
  label,
  width,
  height,
  p,
}) => {
  const fitted = fitText(label, width - L.catPadX * 2, 1, L.catFont, L.catFont * 0.6, 900);
  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        boxSizing: "border-box",
        backgroundColor: RED,
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 55%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${L.catPadX}px`,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: fitted.size,
        lineHeight: UPPER_LH,
        color: WHITE,
        whiteSpace: "nowrap",
        clipPath: wipe(p),
      }}
    >
      {fitted.lines[0] ?? label}
    </div>
  );
};

/**
 * Dải dưới màn hình: nhãn chuyên mục (tag cảnh) + thanh tiêu đề (title) + dải trắng
 * phụ đề. Dọc thì xếp chồng, ngang/vuông thì nhãn nằm bên trái thanh tiêu đề.
 */
export const LowerThird: React.FC<{
  L: NewsLayout;
  title: string;
  subtitle: string;
  captions: Caption[];
  scenes: Scene[];
  accent: string;
  enterFrame: number;
}> = ({ L, subtitle, captions, scenes, accent, enterFrame }) => {
  const frame = useCurrentFrame();
  const { scene, index: sceneIndex, startFrame: sceneStart } = useSceneClock(scenes);
  const { caption, index: capIndex, startFrame: capStartFrame } = useCaptionClock(captions);
  if (frame < enterFrame) return null;

  const { unit, stacked, headline } = L;
  const label = scene?.tag ? upper(scene.tag) : DEFAULT_CATEGORY;
  const catEnter = sceneIndex <= 0 ? enterFrame : Math.max(sceneStart, enterFrame);
  const catP = ramp(frame, catEnter, 8, EASE_INOUT);
  const headP = ramp(frame, enterFrame + 3, 10, EASE_INOUT);
  const stripP = ramp(frame, enterFrame + 7, 10, EASE_INOUT);

  // Phụ đề: câu đang đọc; chưa có câu nào thì dùng phụ đề video.
  const capText = caption ? caption.text : subtitle;
  const capFitted =
    caption && capIndex >= 0
      ? L.fittedCaptions[capIndex]
      : fitText(capText, L.contentW - L.capPadX * 2 - 8 * unit, 2, (stacked ? 50 : 40) * unit, (stacked ? 34 : 28) * unit, 700);
  const capStart = Math.max(caption ? capStartFrame : enterFrame, enterFrame + 10);
  const capP = ramp(frame, capStart, 7, EASE_OUT);
  const showCap = frame >= capStart && capText.trim().length > 0;

  const catWidth = stacked ? L.catWidthFor(label) : L.catRowW;

  const headlineBar = (
    <div
      style={{
        position: "relative",
        flex: stacked ? undefined : 1,
        width: stacked ? "100%" : undefined,
        height: L.headH,
        boxSizing: "border-box",
        padding: `${L.headPadY}px ${L.headPadX}px`,
        backgroundColor: withAlpha(NAVY, 0.96),
        backgroundImage: `linear-gradient(90deg, ${withAlpha(accent, 0.35)} 0%, rgba(11,27,63,0) 55%)`,
        borderTop: `${Math.max(2, 4 * unit)}px solid ${accent}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        clipPath: wipe(headP),
      }}
    >
      {headline.lines.map((line, i) => (
        <div
          key={`h-${i}`}
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: headline.size,
            lineHeight: HEADLINE_LH,
            color: WHITE,
            whiteSpace: "nowrap",
            opacity: ramp(frame, enterFrame + 8 + i * 3, 8),
            transform: `translateX(${(1 - ramp(frame, enterFrame + 8 + i * 3, 10)) * -24 * unit}px)`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: L.left,
        bottom: L.lowerBottom,
        width: L.contentW,
        height: L.lowerH,
        display: "flex",
        flexDirection: "column",
        filter: `drop-shadow(0 ${8 * unit}px ${14 * unit}px rgba(0,0,0,0.45))`,
      }}
    >
      {stacked ? (
        <>
          <div style={{ height: L.catH, display: "flex" }}>
            <CategoryBox key={`cat-${sceneIndex}`} L={L} label={label} width={catWidth} height={L.catH} p={catP} />
          </div>
          {headlineBar}
        </>
      ) : (
        <div style={{ display: "flex", height: L.headH }}>
          <CategoryBox key={`cat-${sceneIndex}`} L={L} label={label} width={catWidth} height={L.headH} p={catP} />
          {headlineBar}
        </div>
      )}

      <div
        style={{
          position: "relative",
          height: L.capH,
          boxSizing: "border-box",
          backgroundColor: WHITE,
          borderLeft: `${Math.max(3, 8 * unit)}px solid ${RED}`,
          padding: `${L.capPadY}px ${L.capPadX}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          clipPath: wipe(stripP),
          overflow: "hidden",
        }}
      >
        {showCap ? (
          <div key={`cap-${capIndex}`} style={{ clipPath: wipe(capP) }}>
            {capFitted.lines.map((line, i) => (
              <div
                key={`c-${i}`}
                style={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: capFitted.size,
                  lineHeight: CAPTION_LH,
                  color: INK,
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        ) : null}
        {/* Mép gạt màu vàng chạy theo lúc câu mới vào */}
        {showCap && capP < 1 ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `calc(${L.capPadX}px + ${(capP * 100).toFixed(3)}% - ${capP * L.capPadX * 2}px)`,
              width: 8 * unit,
              backgroundColor: YELLOW,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

/** Thời lượng thanh NÓNG (frame) — khoảng 1,5 giây. */
export const PUNCH_FRAMES = 45;

/** Thanh đỏ toàn khung "NÓNG" + câu nhấn, đập vào ngay trên dải dưới đúng lúc giọng đọc tới. */
export const PunchFlash: React.FC<{ L: NewsLayout; scenes: Scene[]; enterFrame: number }> = ({ L, scenes, enterFrame }) => {
  const frame = useCurrentFrame();
  const { unit, width } = L;

  let at = -1;
  let text = "";
  for (const s of scenes) {
    if (!s.punch || !s.punch.text.trim()) continue;
    const start = Math.max(msToFrames(s.punch.atMs), enterFrame + 12);
    if (frame >= start && frame < start + PUNCH_FRAMES && start > at) {
      at = start;
      text = s.punch.text;
    }
  }
  if (at < 0) return null;

  const fitted = L.fitPunch(text);
  const slam = ramp(frame, at, 7, EASE_OUT);
  const out = ramp(frame, at + PUNCH_FRAMES - 8, 8, EASE_IN);
  const flash = interpolate(frame, [at, at + 1, at + 5], [0, 0.8, 0], clamp);
  const textIn = ramp(frame, at + 2, 8, EASE_OUT);
  const shake = Math.sin(frame * 2.7) * 5 * unit * (1 - ramp(frame, at + 6, 8));
  const contentH = L.punchH - L.punchPadY * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width,
        bottom: L.punchBottom,
        height: L.punchH,
        transform: `translateX(${(1 - slam) * -width + out * width + shake}px) scaleY(${1.25 - 0.25 * slam})`,
        overflow: "hidden",
        boxShadow: `0 ${8 * unit}px ${20 * unit}px rgba(0,0,0,0.45)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: RED,
          backgroundImage: `repeating-linear-gradient(-45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) ${14 * unit}px, rgba(0,0,0,0) ${14 * unit}px, rgba(0,0,0,0) ${28 * unit}px)`,
          backgroundPosition: `${(frame * 2 * unit) % (40 * unit)}px 0px`,
          borderTop: `${Math.max(2, 4 * unit)}px solid ${YELLOW}`,
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: L.left,
          top: L.punchPadY,
          height: contentH,
          display: "flex",
          alignItems: "center",
          gap: 24 * unit,
        }}
      >
        <div
          style={{
            width: L.nongW,
            height: L.nongFont * UPPER_LH + 10 * unit,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: WHITE,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: L.nongFont,
            lineHeight: UPPER_LH,
            color: RED,
          }}
        >
          NÓNG
        </div>
        <div
          style={{
            opacity: textIn,
            transform: `scale(${1.12 - 0.12 * textIn})`,
            transformOrigin: "0% 50%",
          }}
        >
          {fitted.lines.map((line, i) => (
            <div
              key={`p-${i}`}
              style={{
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: fitted.size,
                lineHeight: UPPER_LH,
                color: WHITE,
                whiteSpace: "nowrap",
                textShadow: `0 ${2 * unit}px ${6 * unit}px rgba(0,0,0,0.35)`,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, backgroundColor: WHITE, opacity: flash }} />
    </div>
  );
};
