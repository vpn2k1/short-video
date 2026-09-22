/**
 * Các mảnh giao diện "bảng điện": thanh đầu (mã, giá, % thay đổi), bảng Mở/Cao/Thấp/KL, chip mã (tag),
 * ô số liệu đếm nhảy + sparkline (visual stat), ô khuyến nghị (visual badge), bong bóng chú thích giá (punch),
 * khung phụ đề, dải mã chạy.
 */
import { Easing, interpolate, random } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";
import {
  clamp, DOWN, fmtPct, fmtPrice, INK, LINE, MUTED, PANEL, parseStat, type Piece, type TickerItem, UP, upper,
} from "./market";

export const DATA = FONT_CATALOG.roboto.stack;
export const TEXT = FONT_CATALOG.lexend.stack;
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const POP = Easing.out(Easing.back(1.8));

const arrow = (up: boolean) => (up ? "▲" : "▼");

/** Thanh đầu: chấm LIVE + đồng hồ phiên, mã chính, giá hiện tại và % so với tham chiếu. */
export const Header: React.FC<{
  unit: number;
  x: number;
  y: number;
  w: number;
  h: number;
  symbol: string;
  clock: string;
  price: string;
  pct: number;
  frame: number;
  flash: number;
}> = ({ unit, x, y, w, h, symbol, clock, price, pct, frame, flash }) => {
  const up = pct >= 0;
  const color = up ? UP : DOWN;
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `${2 * unit}px solid ${LINE}`,
        fontFamily: DATA,
        color: INK,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 * unit }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 * unit, fontSize: 22 * unit, color: MUTED, fontWeight: 500 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8 * unit,
              padding: `${3 * unit}px ${10 * unit}px`,
              borderRadius: 4 * unit,
              backgroundColor: "rgba(234, 57, 67, 0.16)",
              color: "#ff6b74",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ width: 10 * unit, height: 10 * unit, borderRadius: 99, backgroundColor: "#ff4d57", opacity: blink ? 1 : 0.25 }} />
            LIVE
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{clock}</span>
        </div>
        <div style={{ fontSize: 46 * unit, fontWeight: 800, letterSpacing: "0.02em", lineHeight: 1.1 }}>{symbol}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 * unit }}>
        <div style={{ fontSize: 46 * unit, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{price}</div>
        <div
          style={{
            fontSize: 24 * unit,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            padding: `${4 * unit}px ${12 * unit}px`,
            borderRadius: 5 * unit,
            color: flash > 0.01 ? "#03110b" : color,
            backgroundColor: flash > 0.01 ? color : `${color}22`,
          }}
        >
          {arrow(up)} {fmtPct(pct)}
        </div>
      </div>
    </div>
  );
};

/** Bảng Mở cửa / Cao nhất / Thấp nhất / Khối lượng — dọc (khung đứng) hoặc ngang (khung ngang). */
export const Ohlc: React.FC<{
  unit: number;
  x: number;
  y: number;
  w: number;
  row: boolean;
  items: { label: string; value: string; color?: string }[];
  opacity: number;
}> = ({ unit, x, y, w, row, items, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      display: row ? "grid" : "flex",
      // khung ngang hẹp (1:1) không đủ chỗ cho 4 ô một hàng → lưới 2×2
      gridTemplateColumns: row ? `repeat(${w >= 560 * unit ? 4 : 2}, 1fr)` : undefined,
      rowGap: row ? 14 * unit : undefined,
      flexDirection: "column",
      gap: row ? undefined : 8 * unit,
      fontFamily: DATA,
      opacity,
    }}
  >
    {items.map((it, i) => (
      <div
        key={it.label}
        style={{
          paddingLeft: row && i % (w >= 560 * unit ? 4 : 2) > 0 ? 18 * unit : 0,
          borderLeft: row && i % (w >= 560 * unit ? 4 : 2) > 0 ? `${1.5 * unit}px solid ${LINE}` : undefined,
          whiteSpace: "nowrap",
          paddingBottom: row ? 0 : 8 * unit,
          borderBottom: row ? undefined : `${1.5 * unit}px solid ${LINE}`,
        }}
      >
        <div style={{ fontSize: 19 * unit, color: MUTED, fontWeight: 500, letterSpacing: "0.04em", lineHeight: 1.5 }}>{upper(it.label)}</div>
        <div style={{ fontSize: 30 * unit, color: it.color ?? INK, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
          {it.value}
        </div>
      </div>
    ))}
  </div>
);

/** Chip mã kiểu bảng điện cho `tag`: "◆ VN-INDEX" có vạch màu nhấn bên trái. */
export const TagChip: React.FC<{ unit: number; x: number; y: number; maxW: number; text: string; accent: string; t: number }> = ({
  unit, x, y, maxW, text, accent, t,
}) => {
  const label = upper(text);
  const size = Math.round((label.length > 12 ? Math.max(22, 30 - (label.length - 12)) : 30) * unit);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: maxW,
        display: "flex",
        alignItems: "center",
        gap: 10 * unit,
        padding: `${10 * unit}px ${18 * unit}px ${10 * unit}px ${14 * unit}px`,
        backgroundColor: PANEL,
        border: `${1.5 * unit}px solid ${accent}66`,
        borderLeft: `${7 * unit}px solid ${accent}`,
        borderRadius: 6 * unit,
        fontFamily: DATA,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.3,
        color: INK,
        letterSpacing: "0.03em",
        opacity: t,
        transform: `translateX(${((1 - t) * -30 * unit).toFixed(1)}px)`,
        boxShadow: `0 ${8 * unit}px ${24 * unit}px rgba(0,0,0,0.45)`,
      }}
    >
      <span style={{ color: accent, fontSize: size * 0.7 }}>◆</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
};

/** Sparkline nhỏ tự vẽ theo chiều của con số. */
const Sparkline: React.FC<{ w: number; h: number; up: boolean; progress: number; seed: string; unit: number }> = ({
  w, h, up, progress, seed, unit,
}) => {
  const n = 22;
  const vals: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    v += (up ? 0.5 : -0.5) + (random(`${seed}-${i}`) - 0.5) * 1.6;
    vals.push(v);
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const count = Math.max(2, Math.round(progress * n));
  const d = vals
    .slice(0, count)
    .map((val, i) => `${i ? "L" : "M"}${((i / (n - 1)) * w).toFixed(1)},${(h - ((val - min) / Math.max(0.01, max - min)) * h).toFixed(1)}`)
    .join(" ");
  const color = up ? UP : DOWN;
  return (
    <svg width={w} height={h + 8 * unit} style={{ overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={4 * unit} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/** `visual` stat: số cực lớn đếm nhảy, mũi tên ▲/▼, chú thích, sparkline. */
export const StatPanel: React.FC<{
  unit: number;
  x: number;
  y: number;
  maxW: number;
  text: string;
  caption: string | null;
  up: boolean;
  local: number;
  opacity: number;
  seed: string;
}> = ({ unit, x, y, maxW, text, caption, up, local, opacity, seed }) => {
  const enter = interpolate(local, [0, 16], [0, 1], { ...clamp, easing: OUT });
  const count = interpolate(local, [6, 42], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const stat = parseStat(text);
  const shown = stat ? `${stat.prefix}${stat.format(stat.value * count)}${stat.suffix}` : text;
  const color = up ? UP : DOWN;
  const len = [...text].length;
  const size = Math.round(Math.min(150, Math.max(84, 150 - Math.max(0, len - 4) * 11)) * unit);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: maxW,
        padding: `${20 * unit}px ${28 * unit}px ${22 * unit}px`,
        backgroundColor: PANEL,
        border: `${1.5 * unit}px solid ${color}55`,
        borderRadius: 14 * unit,
        boxShadow: `0 ${14 * unit}px ${40 * unit}px rgba(0,0,0,0.55), inset 0 0 ${40 * unit}px ${color}14`,
        fontFamily: DATA,
        opacity: enter * opacity,
        transform: `translateY(${((1 - enter) * 30 * unit).toFixed(1)}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 * unit, fontSize: 22 * unit, fontWeight: 700, color, letterSpacing: "0.06em" }}>
        <span>{arrow(up)}</span>
        <span>{up ? "TĂNG TRƯỞNG" : "SỤT GIẢM"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 22 * unit }}>
        <div
          style={{
            fontSize: size,
            fontWeight: 800,
            color: INK,
            lineHeight: 1.08,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            textShadow: `0 0 ${30 * unit}px ${color}55`,
          }}
        >
          {shown}
        </div>
        <div style={{ paddingBottom: size * 0.2 }}>
          <Sparkline w={120 * unit} h={size * 0.42} up={up} progress={count} seed={seed} unit={unit} />
        </div>
      </div>
      {caption ? (
        <div style={{ fontFamily: TEXT, fontSize: 30 * unit, fontWeight: 500, color: MUTED, lineHeight: 1.4, marginTop: 4 * unit }}>{caption}</div>
      ) : null}
    </div>
  );
};

/** `visual` badge: ô khuyến nghị kiểu bảng xếp hạng — nhãn chữ lớn trong viền màu nhấn. */
export const BadgePanel: React.FC<{
  unit: number;
  x: number;
  y: number;
  maxW: number;
  text: string;
  caption: string | null;
  accent: string;
  local: number;
  opacity: number;
}> = ({ unit, x, y, maxW, text, caption, accent, local, opacity }) => {
  const enter = interpolate(local, [0, 14], [0, 1], { ...clamp, easing: POP });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: maxW,
        display: "flex",
        alignItems: "center",
        gap: 20 * unit,
        padding: `${16 * unit}px ${24 * unit}px`,
        backgroundColor: PANEL,
        border: `${1.5 * unit}px solid ${LINE}`,
        borderRadius: 14 * unit,
        opacity: Math.min(1, enter) * opacity,
        transform: `scale(${(0.85 + 0.15 * enter).toFixed(3)})`,
        transformOrigin: "0% 50%",
        boxShadow: `0 ${14 * unit}px ${40 * unit}px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        style={{
          fontFamily: DATA,
          fontWeight: 800,
          fontSize: 44 * unit,
          lineHeight: 1.25,
          color: accent,
          padding: `${6 * unit}px ${18 * unit}px`,
          border: `${3 * unit}px solid ${accent}`,
          borderRadius: 8 * unit,
          whiteSpace: "nowrap",
        }}
      >
        {upper(text)}
      </div>
      {caption ? <div style={{ fontFamily: TEXT, fontSize: 30 * unit, fontWeight: 500, color: INK, lineHeight: 1.35 }}>{caption}</div> : null}
    </div>
  );
};

/**
 * Bong bóng chú thích giá gắn vào đỉnh cú vọt: khối màu tăng/giảm, chữ đậm, mũi nhọn chỉ xuống điểm.
 * `anchorX` đã kẹp để bong bóng không tràn khung; mũi nhọn vẫn nằm đúng điểm.
 */
export const PunchBubble: React.FC<{
  unit: number;
  px: number;
  py: number;
  anchorX: number;
  maxW: number;
  text: string;
  up: boolean;
  t: number;
  opacity: number;
  size: number;
}> = ({ unit, px, py, anchorX, maxW, text, up, t, opacity, size }) => {
  const color = up ? UP : DOWN;
  const gap = 34 * unit;
  return (
    <>
      {/* vạch dọc đánh dấu sự kiện */}
      <div
        style={{
          position: "absolute",
          left: px - 1 * unit,
          top: py,
          width: 2 * unit,
          height: 2000 * unit,
          backgroundImage: `linear-gradient(${color}, ${color}00 60%)`,
          opacity: 0.55 * opacity * Math.min(1, t),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: px - 13 * unit,
          top: py - 13 * unit,
          width: 26 * unit,
          height: 26 * unit,
          transform: "rotate(45deg)",
          border: `${4 * unit}px solid ${color}`,
          backgroundColor: "#060a12",
          opacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: anchorX,
          top: py - gap,
          maxWidth: maxW,
          transform: `translate(-50%, -100%) scale(${Math.max(0, t).toFixed(3)})`,
          transformOrigin: `${(50 + ((px - anchorX) / maxW) * 100).toFixed(1)}% 100%`,
          opacity,
          backgroundColor: color,
          color: up ? "#02140c" : "#fff",
          fontFamily: TEXT,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.3,
          padding: `${14 * unit}px ${26 * unit}px`,
          borderRadius: 14 * unit,
          boxShadow: `0 0 ${40 * unit}px ${color}99, 0 ${12 * unit}px ${30 * unit}px rgba(0,0,0,0.5)`,
          textAlign: "center",
          width: "max-content",
        }}
      >
        <span style={{ fontFamily: DATA, fontSize: size * 0.7, marginRight: size * 0.3 }}>{arrow(up)}</span>
        {text}
      </div>
      {/* mũi nhọn */}
      <div
        style={{
          position: "absolute",
          left: px - 14 * unit,
          top: py - gap - 1,
          width: 0,
          height: 0,
          borderLeft: `${14 * unit}px solid transparent`,
          borderRight: `${14 * unit}px solid transparent`,
          borderTop: `${18 * unit}px solid ${color}`,
          opacity: opacity * Math.min(1, Math.max(0, t)),
        }}
      />
    </>
  );
};

/** Khung phụ đề kiểu ô dữ liệu: nhãn "BẢN TIN" + giờ, chữ Lexend, con số tô màu, cụm nhấn nền xanh. */
export const CaptionPanel: React.FC<{
  unit: number;
  x: number;
  bottom: number;
  w: number;
  minH: number;
  pieces: Piece[];
  punchOn: number;
  fontSize: number;
  clock: string;
  counter: string;
  enter: number;
  panelIn: number;
  accent: string;
}> = ({ unit, x, bottom, w, minH, pieces, punchOn, fontSize, clock, counter, enter, panelIn, accent }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: bottom,
      width: w,
      minHeight: minH,
      transform: `translateY(-100%) translateY(${((1 - panelIn) * 40 * unit).toFixed(1)}px)`,
      opacity: panelIn,
      backgroundColor: "rgba(8, 13, 24, 0.92)",
      border: `${1.5 * unit}px solid ${LINE}`,
      borderRadius: 16 * unit,
      boxShadow: `0 ${20 * unit}px ${60 * unit}px rgba(0,0,0,0.6)`,
      padding: `${18 * unit}px ${30 * unit}px ${24 * unit}px ${36 * unit}px`,
      overflow: "hidden",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 7 * unit, backgroundColor: accent }} />
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontFamily: DATA,
        fontSize: 20 * unit,
        fontWeight: 600,
        color: MUTED,
        letterSpacing: "0.08em",
        marginBottom: 10 * unit,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>
        <span style={{ color: accent }}>■</span> BẢN TIN · {clock}
      </span>
      <span>{counter}</span>
    </div>
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: TEXT,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.36,
        color: INK,
        opacity: enter,
        transform: `translateY(${((1 - enter) * 14 * unit).toFixed(1)}px)`,
      }}
    >
      <div>
      {pieces.map((p, i) => {
        const color = p.kind === "up" ? UP : p.kind === "down" ? DOWN : undefined;
        const hot = p.punch && punchOn > 0;
        return (
          <span
            key={`pc-${i}`}
            style={{
              color: hot ? (p.kind === "down" ? "#fff" : "#02140c") : color,
              fontWeight: color || hot ? 800 : undefined,
              backgroundColor: hot ? `rgba(22, 199, 132, ${(0.95 * punchOn).toFixed(3)})` : undefined,
              borderRadius: hot ? 6 * unit : undefined,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              padding: hot ? `0 ${6 * unit}px` : undefined,
              fontVariantNumeric: color ? "tabular-nums" : undefined,
            }}
          >
            {p.text}
          </span>
        );
      })}
      </div>
    </div>
  </div>
);

/** Dải mã chạy dưới đáy: mỗi mục rộng cố định nên vòng lặp liền mạch không cần đo chữ. */
export const Ticker: React.FC<{ unit: number; y: number; width: number; h: number; items: TickerItem[]; frame: number; accent: string }> = ({
  unit, y, width, h, items, frame, accent,
}) => {
  const itemW = 330 * unit;
  const total = itemW * items.length;
  const copies = Math.ceil(width / total) + 1;
  const shift = (frame * 3.2 * unit) % total;
  const row = Array.from({ length: copies }, () => items).flat();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: y,
        width,
        height: h,
        overflow: "hidden",
        backgroundColor: "rgba(4, 7, 14, 0.94)",
        borderTop: `${2 * unit}px solid ${accent}`,
        borderBottom: `${1.5 * unit}px solid ${LINE}`,
        fontFamily: DATA,
      }}
    >
      <div style={{ position: "absolute", left: -shift, top: 0, height: h, display: "flex", alignItems: "center" }}>
        {row.map((it, i) => {
          const up = it.pct >= 0;
          return (
            <div
              key={`tk-${i}`}
              style={{ width: itemW, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 12 * unit, fontSize: 26 * unit, paddingLeft: 20 * unit }}
            >
              <span style={{ color: INK, fontWeight: 800 }}>{it.sym}</span>
              <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{fmtPrice(it.price)}</span>
              <span style={{ color: up ? UP : DOWN, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {arrow(up)} {fmtPct(it.pct).replace(/^[+−]/, "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
