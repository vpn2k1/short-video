/**
 * Các mảnh in trên trang tạp chí: măng-sét (tên tạp chí), dòng số báo, hộp chuyên mục, con số trang bìa,
 * dòng tít nhấn, tem tròn "MỚI!", mã vạch + giá, và khối tít phụ đề. Mỗi mảnh nhận sẵn frame và mốc hiện,
 * không tự đọc đồng hồ cảnh — Page.tsx quyết định khi nào trang nào đang ở trên bàn.
 */
import { Easing, interpolate } from "remotion";
import { FONTS, seeded } from "../shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Chậm, sang: vào nhanh, đậu êm, không nảy. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Tem và dòng tít nảy nhẹ như dán lên bìa. */
export const POP = Easing.out(Easing.back(1.7));

export const PAPER = "#f3eee6";
export const INK = "#141414";
/** Vàng tem "MỚI!" — cố định, không theo accent để luôn tách khỏi hộp màu nhấn. */
export const BURST = "#ffd60a";

/** Tít có chân (Playfair Display, đóng gói). Nạp bằng useFontReady ở index.tsx. */
export const SERIF = FONTS.playfair;
/** Chữ nhỏ: chuyên mục, số báo, chú thích (Be Vietnam Pro, đủ dấu khi in hoa). */
export const SANS = FONTS.bevietnam;

/** In hoa tiếng Việt bằng JS — CSS text-transform dễ tách móc Ư/Ơ. */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");
export const pad2 = (n: number) => String(n).padStart(2, "0");

/* ------------------------------------------------------------ đo chữ */

let canvas: HTMLCanvasElement | null = null;
/** Bề rộng chữ ở 100px — chỉ đúng khi font đã nạp (`ready`), nên kết quả không cache. */
const measure100 = (text: string, font: string, ready: boolean) => {
  if (!ready || typeof document === "undefined") return [...text].length * 72;
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [...text].length * 72;
  ctx.font = font;
  return ctx.measureText(text).width;
};

/* ------------------------------------------------------------ măng-sét */

/**
 * Tên tạp chí chạy ngang đầu trang, căng vừa bề rộng (đo bằng canvas), chữ có chân rất đậm tương phản cao.
 * `drop` 0→1: rơi từ trên xuống lúc bìa dựng (chỉ trang đầu có title).
 */
export const Masthead: React.FC<{
  text: string;
  top: number;
  width: number;
  maxSize: number;
  color: string;
  unit: number;
  ready: boolean;
  drop: number;
}> = ({ text, top, width, maxSize, color, unit, ready, drop }) => {
  const avail = width * 0.86;
  const w100 = measure100(text, `900 100px ${SERIF}`, ready);
  const size = Math.min(maxSize, (avail / Math.max(1, w100)) * 100);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width,
        top,
        textAlign: "center",
        fontFamily: SERIF,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.08,
        color,
        whiteSpace: "nowrap",
        textShadow: color === INK ? "none" : `0 ${3 * unit}px ${18 * unit}px rgba(0,0,0,0.35)`,
        translate: `0px ${((1 - drop) * -size * 1.8).toFixed(1)}px`,
        opacity: interpolate(drop, [0, 0.25], [0, 1], clamp),
      }}
    >
      {text}
    </div>
  );
};

/** Chiều cao khối măng-sét để các mảnh bên dưới xếp theo — cùng công thức cỡ chữ với Masthead. */
export const mastheadHeight = (text: string, width: number, maxSize: number, ready: boolean) => {
  const w100 = measure100(text, `900 100px ${SERIF}`, ready);
  return Math.min(maxSize, ((width * 0.86) / Math.max(1, w100)) * 100) * 1.08;
};

/** Dòng số báo dưới măng-sét: "SỐ 01 ——— ẤN BẢN ĐẶC BIỆT · 02/05". */
export const IssueLine: React.FC<{
  left: string;
  right: string;
  top: number;
  side: number;
  width: number;
  color: string;
  unit: number;
  opacity: number;
}> = ({ left, right, top, side, width, color, unit, opacity }) => {
  const size = 22 * unit;
  const text: React.CSSProperties = {
    fontFamily: SANS,
    fontWeight: 700,
    fontSize: size,
    letterSpacing: "0.14em",
    color,
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={{
        position: "absolute",
        left: side,
        width: width - side * 2,
        top,
        display: "flex",
        alignItems: "center",
        gap: 18 * unit,
        opacity,
      }}
    >
      <div style={text}>{left}</div>
      <div style={{ flex: 1, height: Math.max(1, 2 * unit), backgroundColor: color, opacity: 0.7 }} />
      <div style={text}>{right}</div>
    </div>
  );
};

/* ------------------------------------------------------------ chuyên mục */

/** Hộp chuyên mục màu nhấn ("LÀM ĐẸP", "XU HƯỚNG"): mở ra từ trái như dải băng in. */
export const TagBox: React.FC<{ text: string; accent: string; unit: number; progress: number }> = ({
  text,
  accent,
  unit,
  progress,
}) => (
  <div
    style={{
      display: "inline-block",
      backgroundColor: accent,
      color: "#fff",
      fontFamily: SANS,
      fontWeight: 800,
      fontSize: 32 * unit,
      letterSpacing: "0.1em",
      lineHeight: 1.25,
      padding: `${10 * unit}px ${22 * unit}px ${9 * unit}px`,
      whiteSpace: "nowrap",
      clipPath: `inset(0 ${((1 - progress) * 100).toFixed(1)}% 0 0)`,
    }}
  >
    {upper(text)}
  </div>
);

/* ------------------------------------------------------------ con số bìa */

/** Con số bìa kiểu "5 bí quyết": số có chân khổng lồ + chú thích in hoa đậm xếp dòng bên cạnh. */
export const StatLine: React.FC<{
  value: string;
  caption: string | null;
  color: string;
  accent: string;
  unit: number;
  progress: number;
  maxWidth: number;
  shadow: boolean;
  /** Khung thấp (1:1, 3:4): số nhỏ lại, chú thích hẹp để nằm gọn một hàng. */
  compact?: boolean;
}> = ({ value, caption, color, accent, unit, progress, maxWidth, shadow, compact = false }) => {
  const len = [...value].length;
  const size = (compact ? 160 : 250) * unit * Math.max(0.42, Math.min(1, 3.2 / Math.max(1, len)));
  const glow = shadow ? `0 ${4 * unit}px ${24 * unit}px rgba(0,0,0,0.45)` : "none";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        columnGap: 22 * unit,
        maxWidth,
        opacity: interpolate(progress, [0, 0.3], [0, 1], clamp),
        translate: `${((1 - progress) * -60 * unit).toFixed(1)}px 0px`,
      }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.92,
          color,
          textShadow: glow,
          whiteSpace: "nowrap",
        }}
      >
        {value.normalize("NFC")}
      </div>
      {caption ? (
        <div
          style={{
            maxWidth: (compact ? 250 : 340) * unit,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: (compact ? 30 : 38) * unit,
            lineHeight: 1.18,
            color,
            textShadow: glow,
            borderTop: `${6 * unit}px solid ${accent}`,
            paddingTop: 10 * unit,
          }}
        >
          {upper(caption)}
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------ dòng tít nhấn */

/** Câu nhấn thành dòng tít bìa: khối màu nhấn nghiêng nhẹ, chữ trắng in hoa rất đậm, bật lên đúng lúc đọc. */
export const PunchLine: React.FC<{ text: string; accent: string; unit: number; progress: number; maxWidth: number }> = ({
  text,
  accent,
  unit,
  progress,
  maxWidth,
}) => {
  const len = [...text].length;
  const size = Math.max(40, 66 * Math.min(1, 16 / Math.max(1, len))) * unit;
  return (
    <div
      style={{
        display: "inline-block",
        maxWidth,
        backgroundColor: accent,
        color: "#fff",
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.18,
        padding: `${14 * unit}px ${26 * unit}px ${12 * unit}px`,
        boxShadow: `${10 * unit}px ${10 * unit}px 0 rgba(0,0,0,0.28)`,
        transformOrigin: "0% 50%",
        rotate: "-2.5deg",
        scale: String(interpolate(progress, [0, 1], [0.55, 1])),
        opacity: interpolate(progress, [0, 0.2], [0, 1], clamp),
      }}
    >
      {upper(text)}
    </div>
  );
};

/* ------------------------------------------------------------ tem tròn */

/** Đa giác răng cưa của tem "MỚI!" — 26 cánh, tính một lần. */
const BURST_POINTS = (() => {
  const spikes = 26;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 50 : 43;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

/** Tem tròn răng cưa màu vàng — "MỚI!", "BƯỚC 1"… Xoay vào khi dán, rồi lắc rất nhẹ. */
export const Burst: React.FC<{
  text: string;
  caption: string | null;
  size: number;
  unit: number;
  progress: number;
  frame: number;
}> = ({ text, caption, size, unit, progress, frame }) => {
  const label = upper(text);
  const len = [...label].length;
  const fontSize = size * Math.min(0.24, 0.62 / Math.max(2.4, len * 0.62));
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        scale: String(progress),
        rotate: `${(interpolate(progress, [0, 1], [-40, 11]) + Math.sin(frame / 22) * 2).toFixed(2)}deg`,
        filter: `drop-shadow(${6 * unit}px ${8 * unit}px 0 rgba(0,0,0,0.25))`,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <polygon points={BURST_POINTS} fill={BURST} />
        <circle cx="50" cy="50" r="38" fill="none" stroke={INK} strokeWidth="0.8" strokeDasharray="2 1.6" />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: size * 0.14,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: INK,
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize, lineHeight: 1.05 }}>{label}</div>
        {caption ? (
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: Math.max(15 * unit, size * 0.075),
              lineHeight: 1.15,
              marginTop: size * 0.03,
            }}
          >
            {caption.normalize("NFC")}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ mã vạch */

/** Góc mã vạch + giá như bìa báo sạp. Vạch rải theo seed — mọi frame giống nhau. */
export const Barcode: React.FC<{ issue: string; unit: number; opacity: number }> = ({ issue, unit, opacity }) => {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < 34; i++) {
    const w = Math.round(seeded(`mag-bar-${i}`, 1, 4.4));
    bars.push({ x, w });
    x += w + Math.round(seeded(`mag-gap-${i}`, 1, 3.2));
  }
  return (
    <div
      style={{
        backgroundColor: "#fff",
        padding: `${10 * unit}px ${12 * unit}px ${8 * unit}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6 * unit,
        opacity,
        boxShadow: `0 ${4 * unit}px ${14 * unit}px rgba(0,0,0,0.25)`,
      }}
    >
      <svg viewBox={`0 0 ${x} 40`} width={150 * unit} height={58 * unit} preserveAspectRatio="none">
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={0} width={b.w} height={i % 11 === 0 ? 40 : 34} fill={INK} />
        ))}
      </svg>
      <div
        style={{
          width: 150 * unit,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 17 * unit,
          color: INK,
          letterSpacing: "0.04em",
        }}
      >
        <span>{issue}</span>
        <span>35.000₫</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ tít phụ đề */

/** Cỡ tít theo độ dài câu: câu ngắn to như tít bìa, câu dài co lại nhưng vẫn đọc được trên điện thoại. */
export const headlineSize = (text: string, wide: boolean) => {
  const len = [...text].length;
  const [max, min] = wide ? [86, 54] : [104, 60];
  const t = Math.min(1, Math.max(0, (len - 16) / 44));
  return max - (max - min) * t;
};

/** Tìm cụm nhấn nguyên văn trong câu (không phân biệt hoa thường). */
export const splitPunch = (text: string, punch: string | null): [string, string, string] | null => {
  if (!punch) return null;
  const needle = punch.normalize("NFC").trim();
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (!needle || at < 0) return null;
  return [text.slice(0, at), text.slice(at, at + needle.length), text.slice(at + needle.length)];
};
