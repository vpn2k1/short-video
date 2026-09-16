import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { FONTS, fitFontSize, useLayout } from "../shared";
import { TechBackground } from "./Background";
import { TechCaption } from "./Caption";
import { ProgressLine, Punch, STAT_PANEL_HEIGHT, TagChip, VisualPanel } from "./Overlays";
import { SceneCard } from "./SceneCard";
import { estimateLines, INK, ramp, sceneTransition, sceneWindow } from "./theme";
import { TitleIntro } from "./TitleIntro";

/**
 * Phong cách "Công nghệ tối giản" — xem skill style-tech.
 *
 * Bố cục:
 *  - Dọc (height > width): thanh tiến độ → chip tag → thẻ kính → câu nhấn → phụ đề.
 *  - Ngang/vuông: thanh tiến độ trên cùng; cột trái (tag, câu nhấn, phụ đề), thẻ kính bên phải.
 * Chiều cao vùng câu nhấn và phụ đề tính trước từ TOÀN BỘ dữ liệu, nên bố cục
 * không nhảy khi chữ đổi giữa chừng.
 */
export const TechStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  captions,
  scenes,
  showTitle,
}) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit } = useLayout();
  const wide = width >= height;
  const contentW = width - safe.side * 2;
  const contentH = height - safe.top - safe.bottom;
  const gap = 28 * unit;
  const columnGap = 80 * unit;

  const cardW = wide ? contentW * (width / height >= 1.6 ? 0.47 : 0.46) : contentW;
  const textW = wide ? contentW - cardW - columnGap : contentW;
  const align = wide ? "left" : "center";

  // Phụ đề: cỡ chữ theo bề rộng cột, giữ chỗ đủ cho câu dài nhất (tối đa 4 dòng).
  const captionFont = Math.round(Math.min(50 * unit, textW / 14.5));
  const padX = 34 * unit;
  const padY = 22 * unit;
  // Hệ số bề rộng ký tự 0.56 hơi dư so với thực tế (600 weight) để không thiếu dòng.
  const captionLines = Math.min(
    5,
    captions.reduce((max, c) => Math.max(max, estimateLines(c.text, captionFont, textW - padX * 2, 0.56)), 0),
  );
  const captionAreaH = captionLines > 0 ? captionLines * captionFont * 1.3 + padY * 2 + 4 * unit : 0;

  // Câu nhấn: cỡ chữ co theo độ dài từng câu, giữ chỗ cho câu chiếm nhiều dòng nhất.
  const punchBase = wide ? Math.min(96 * unit, textW / 7) : 92 * unit;
  // Khung dọc rộng đủ cho 2 dòng nên co ít hơn; khung ngang cột hẹp thì co mạnh hơn.
  const punchSize = (text: string) => fitFontSize(text, punchBase, wide ? 0.55 : 0.68);
  const punchAreaH = scenes.reduce((max, s) => {
    if (!s.punch) return max;
    const size = punchSize(s.punch.text);
    const lines = Math.min(3, estimateLines(s.punch.text, size, textW, 0.62));
    // + paddingTop (dấu tiếng Việt) + dư một chút cho sai số ước lượng.
    return Math.max(max, lines * size * 1.08 + size * 0.3);
  }, 0);

  const hasVisual = scenes.some((s) => s.visual);
  const tagRowH = 62 * unit;
  const hideCaptionsBefore = showTitle ? TITLE_FRAMES - 10 : 0;

  const windows = scenes.map((_, i) => sceneWindow(scenes, i, showTitle));
  const states = windows.map((w) => sceneTransition(frame, w));
  const visibleIndices = states.map((s, i) => (s.opacity > 0.001 ? i : -1)).filter((i) => i >= 0);

  const tagRow = (
    <div style={{ position: "relative", height: tagRowH, flexShrink: 0 }}>
      {visibleIndices.map((i) =>
        scenes[i].tag ? (
          <TagChip
            key={i}
            text={scenes[i].tag as string}
            accent={accent}
            opacity={states[i].opacity}
            shift={states[i].shift}
          />
        ) : null,
      )}
      {handle ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            height: tagRowH,
            display: "flex",
            alignItems: "center",
            fontFamily: FONTS.mono,
            fontSize: 24 * unit,
            letterSpacing: 1.5 * unit,
            color: INK,
            // Title card đã có handle — tránh hiện hai lần.
            opacity: 0.45 * (showTitle ? ramp(frame, TITLE_FRAMES - 12, 12) : 1),
          }}
        >
          {handle}
        </div>
      ) : null}
    </div>
  );

  // Khung ngang: cột trái còn trống phía trên → đặt tiêu đề video mờ làm "đầu trang".
  const headline =
    wide && title ? (
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: Math.round(Math.min(46 * unit, textW / 12)),
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: -0.5 * unit,
          color: INK,
          opacity: 0.32 * (showTitle ? ramp(frame, TITLE_FRAMES - 12, 14) : 1),
          flexShrink: 0,
          paddingTop: 10 * unit,
          borderTop: `${Math.max(1, unit)}px solid rgba(255,255,255,0.12)`,
        }}
      >
        {title}
      </div>
    ) : null;

  const cardArea = (
    <div
      style={{
        position: "relative",
        flex: wide ? undefined : 1,
        width: wide ? cardW : "100%",
        height: wide ? "100%" : undefined,
        minHeight: 0,
        flexShrink: 0,
        marginBottom: !wide && hasVisual ? STAT_PANEL_HEIGHT * unit * 0.5 : 0,
      }}
    >
      {visibleIndices.map((i) => {
        const s = states[i];
        return (
          <AbsoluteFill
            key={i}
            style={{
              opacity: s.opacity,
              transform: `translateX(${s.shift * 90 * unit}px) scale(${s.scale})`,
            }}
          >
            <SceneCard
              scene={scenes[i]}
              index={i}
              total={scenes.length}
              accent={accent}
              start={windows[i].start}
              enter={windows[i].enter}
              end={windows[i].end}
            />
          </AbsoluteFill>
        );
      })}
      {visibleIndices.map((i) => {
        const visual = scenes[i].visual;
        if (!visual) return null;
        return (
          <div
            key={`v${i}`}
            style={{
              position: "absolute",
              display: "flex",
              justifyContent: wide ? "flex-start" : "center",
              ...(wide
                ? { left: -40 * unit, right: 0, bottom: 50 * unit }
                : { left: 0, right: 0, bottom: -STAT_PANEL_HEIGHT * unit * 0.5 }),
            }}
          >
            <VisualPanel
              visual={visual}
              accent={accent}
              id={`tech-ring-${i}`}
              maxWidth={wide ? cardW + 40 * unit - 30 * unit : contentW}
              enterFrame={windows[i].enter + 8}
              sceneOpacity={1 - states[i].outP}
            />
          </div>
        );
      })}
    </div>
  );

  const punchArea =
    punchAreaH > 0 ? (
      <div style={{ position: "relative", height: punchAreaH, flexShrink: 0, width: "100%" }}>
        {visibleIndices.map((i) => {
          const punch = scenes[i].punch;
          if (!punch) return null;
          return (
            <Punch
              key={i}
              text={punch.text}
              accent={accent}
              fontSize={punchSize(punch.text)}
              appearFrame={Math.max(msToFrames(punch.atMs), windows[i].enter + 6)}
              sceneOpacity={1 - states[i].outP}
              align={align}
            />
          );
        })}
      </div>
    ) : null;

  const captionArea =
    captionAreaH > 0 ? (
      <div
        style={{
          height: captionAreaH,
          flexShrink: 0,
          width: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: wide ? "flex-start" : "center",
        }}
      >
        <TechCaption
          captions={captions}
          fontSize={captionFont}
          padX={padX}
          padY={padY}
          align={align}
          hideBefore={hideCaptionsBefore}
        />
      </div>
    ) : null;

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans, color: INK }}>
      <TechBackground accent={accent} />

      <div
        style={{
          position: "absolute",
          left: safe.side,
          top: safe.top,
          width: contentW,
          height: contentH,
          display: "flex",
          flexDirection: "column",
          gap,
        }}
      >
        <ProgressLine accent={accent} />
        {wide ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row", gap: columnGap }}>
            <div style={{ width: textW, display: "flex", flexDirection: "column", gap }}>
              {tagRow}
              {headline}
              <div style={{ flex: 1 }} />
              {punchArea}
              {captionArea}
            </div>
            {cardArea}
          </div>
        ) : (
          <>
            {tagRow}
            {cardArea}
            {punchArea}
            {captionArea}
          </>
        )}
      </div>

      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <TitleIntro title={title} subtitle={subtitle} handle={handle} accent={accent} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
