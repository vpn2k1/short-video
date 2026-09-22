/**
 * Trang tiêu đề: trục đang vẽ dần (do lớp trục chung lo), một mốc lớn bật ra, khoảng năm "1945 → Hôm nay",
 * tiêu đề, dòng phụ và handle trượt vào cạnh mốc. Hết trang thì chữ trôi đi theo hướng cuộn của trục.
 */
import { interpolate } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { alpha, BODY, clamp, DISPLAY, estimateLines, ramp, UI, type Theme } from "./theme";

export const TitleIntro: React.FC<{
  title: string;
  subtitle: string;
  handle: string;
  range: string | null;
  vertical: boolean;
  /** Vị trí mốc tiêu đề trên trục (trục dọc: chỉ dùng x, y tự canh theo dòng đầu), và khối chữ. */
  node: { x: number; y: number };
  block: { x: number; y: number; w: number; h: number };
  frame: number;
  unit: number;
  accent: string;
  theme: Theme;
}> = ({ title, subtitle, handle, range, vertical, node, block, frame, unit, accent, theme }) => {
  const exit = interpolate(frame, [TITLE_FRAMES - 18, TITLE_FRAMES - 4], [0, 1], clamp);
  if (exit >= 1) return null;
  const pop = ramp(frame, 6, 12);
  const show = (from: number) => ramp(frame, from, 14);

  // Tiêu đề: cỡ lớn nhất sao cho không quá 4 dòng và cao không quá nửa khối.
  let titleSize = 104 * unit;
  while (titleSize > 48 * unit && (estimateLines(title, titleSize, block.w, 0.64) > 4 || estimateLines(title, titleSize, block.w, 0.64) * titleSize * 1.08 > block.h * 0.55)) {
    titleSize *= 0.93;
  }
  const shift = exit * 80 * unit;

  // Trục dọc: ước lượng chiều cao khối chữ để đặt mốc tiêu đề ngang dòng đầu (khoảng năm hoặc tiêu đề).
  const gap = 26 * unit;
  const titleLines = estimateLines(title, titleSize, block.w, 0.64);
  const subLines = subtitle ? estimateLines(subtitle, 44 * unit, block.w, 0.5) : 0;
  const rows = [
    range ? 34 * unit * 1.25 : 0,
    titleLines * titleSize * 1.08,
    6 * unit,
    subLines * 44 * unit * 1.3,
    handle ? 30 * unit * 1.25 : 0,
  ].filter((h) => h > 0);
  const total = rows.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
  const top = block.y + (block.h - total) / 2;
  const nodeAt = vertical ? { x: node.x, y: top + (range ? 34 * unit * 0.62 : titleSize * 0.55) } : node;

  const rise = (t: number): React.CSSProperties => ({
    opacity: t * (1 - exit),
    translate: vertical ? `0 ${(1 - t) * 30 * unit - shift}px` : `${-shift}px ${(1 - t) * 30 * unit}px`,
  });

  return (
    <>
      {/* Mốc tiêu đề trên trục. */}
      <div
        style={{
          position: "absolute",
          left: nodeAt.x - 26 * unit,
          top: nodeAt.y - 26 * unit,
          width: 52 * unit,
          height: 52 * unit,
          borderRadius: "50%",
          boxSizing: "border-box",
          backgroundColor: accent,
          border: `${7 * unit}px solid ${theme.bg}`,
          boxShadow: `0 0 0 ${4 * unit}px ${accent}, 0 0 0 ${18 * unit}px ${alpha(accent, 0.16)}`,
          scale: String(pop),
          opacity: 1 - exit,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: block.x,
          top: block.y,
          width: block.w,
          height: block.h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap,
        }}
      >
        {range ? (
          <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 34 * unit, lineHeight: 1.25, letterSpacing: 1 * unit, color: accent, ...rise(show(10)) }}>
            {range}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: titleSize,
            lineHeight: 1.08,
            letterSpacing: -0.02 * titleSize,
            color: theme.ink,
            ...rise(show(13)),
          }}
        >
          {title}
        </div>
        <div style={{ width: 120 * unit * show(20), height: 6 * unit, borderRadius: 3 * unit, backgroundColor: accent, opacity: 1 - exit }} />
        {subtitle ? (
          <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 44 * unit, lineHeight: 1.3, color: theme.ink, ...rise(show(20)), opacity: 0.75 * show(20) * (1 - exit) }}>
            {subtitle}
          </div>
        ) : null}
        {handle ? (
          <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 30 * unit, lineHeight: 1.25, color: theme.muted, ...rise(show(27)) }}>{handle}</div>
        ) : null}
      </div>
    </>
  );
};
