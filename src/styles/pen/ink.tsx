/**
 * Chữ viết bằng bút máy: tự ngắt dòng bằng cách đo chữ (canvas) để biết chính xác ngòi bút đang ở đâu,
 * lộ dần từng dòng bằng clip-path theo đúng bề rộng đã đo, và cây bút máy bám theo mép chữ vừa viết.
 *
 * Đo chữ chỉ đúng khi font Dancing Script đã nạp — index.tsx gọi useFontReady trước khi dựng bố cục.
 */
import { interpolate } from "remotion";
import { FONT_CATALOG } from "../../fonts/catalog";
import { seeded } from "../shared";

/** Dancing Script (đóng gói, đủ dấu tiếng Việt) — nét bút máy nghiêng, liền. */
export const SCRIPT = FONT_CATALOG.dancing.stack;
export const SCRIPT_WEIGHT = 600;
export const INK = "#1b2a5a";
export const PAPER = "#f7f0e1";
export const LINE_HEIGHT = 1.32;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------------------
// Đo chữ
// ---------------------------------------------------------------------------
let canvas: HTMLCanvasElement | null = null;
const cache = new Map<string, number>();

/** Bề rộng (px) của `text` viết bằng SCRIPT ở cỡ `size`. `ready` = font đã nạp (khác khoá cache). */
export const measure = (text: string, size: number, ready: boolean) => {
  if (!text) return 0;
  const key = `${ready ? 1 : 0}|${size.toFixed(2)}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let width = [...text].length * size * 0.42;
  if (typeof document !== "undefined") {
    canvas ??= document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `${SCRIPT_WEIGHT} ${size}px ${SCRIPT}`;
      width = ctx.measureText(text).width;
    }
  }
  cache.set(key, width);
  return width;
};

const chars = (text: string) => [...text.normalize("NFC")];

// ---------------------------------------------------------------------------
// Ngắt dòng
// ---------------------------------------------------------------------------
export type InkLine = {
  text: string;
  /** Bề rộng đo được. */
  width: number;
  /** Vị trí ký tự đầu/cuối (theo code point) trong cả khối. */
  from: number;
  to: number;
};

/** Ngắt theo từ cho vừa `maxWidth`. Khoảng trắng giữa hai dòng không tính là ký tự của dòng nào. */
export const wrap = (text: string, size: number, maxWidth: number, ready: boolean): InkLine[] => {
  const words = text.normalize("NFC").split(/\s+/).filter(Boolean);
  const lines: InkLine[] = [];
  let current = "";
  let from = 0;
  let cursor = 0;
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next, size, ready) > maxWidth) {
      lines.push({ text: current, width: measure(current, size, ready), from, to: cursor });
      cursor += 1; // khoảng trắng
      from = cursor;
      current = word;
    } else {
      current = next;
    }
    cursor = from + chars(current).length;
  }
  if (current) lines.push({ text: current, width: measure(current, size, ready), from, to: cursor });
  return lines;
};

// ---------------------------------------------------------------------------
// Một khối chữ đã đặt chỗ trên trang
// ---------------------------------------------------------------------------
export type InkBlock = {
  key: string;
  lines: InkLine[];
  /** Góc trên trái của dòng đầu. */
  x: number;
  y: number;
  size: number;
  align: "left" | "center";
  /** Bề rộng vùng — để căn giữa. */
  boxWidth: number;
  color: string;
  /** Frame bắt đầu / viết xong. */
  start: number;
  end: number;
  /** Cụm nhấn trong khối: vị trí ký tự [from, to) và frame gạch chân. */
  punch: { from: number; to: number; at: number; color: string } | null;
};

export const blockHeight = (lines: number, size: number) => lines * size * LINE_HEIGHT;

const lineLeft = (block: InkBlock, line: InkLine) =>
  block.x + (block.align === "center" ? (block.boxWidth - line.width) / 2 : 0);

const lineTop = (block: InkBlock, index: number) => block.y + index * block.size * LINE_HEIGHT;

/** Số ký tự đã viết (có phần lẻ) tại frame. */
const writtenChars = (block: InkBlock, frame: number) => {
  const total = block.lines.at(-1)?.to ?? 0;
  if (block.end <= block.start) return frame >= block.start ? total : 0;
  return interpolate(frame, [block.start, block.end], [0, total], clamp);
};

/** Bề rộng phần đã viết của một dòng khi đã viết `count` ký tự (có phần lẻ) của dòng đó. */
const partialWidth = (line: InkLine, count: number, size: number, ready: boolean) => {
  const list = chars(line.text);
  if (count <= 0) return 0;
  if (count >= list.length) return line.width;
  const whole = Math.floor(count);
  const base = measure(list.slice(0, whole).join(""), size, ready);
  const next = measure(list.slice(0, whole + 1).join(""), size, ready);
  return base + (next - base) * (count - whole);
};

/** Mép chữ đang viết — chỗ ngòi bút chạm giấy. */
export const nibAt = (block: InkBlock, frame: number, ready: boolean) => {
  const done = writtenChars(block, frame);
  let index = block.lines.findIndex((line) => done < line.to);
  if (index < 0) index = block.lines.length - 1;
  const line = block.lines[index];
  const width = partialWidth(line, done - line.from, block.size, ready);
  return {
    x: lineLeft(block, line) + width,
    // Ngòi chạm quanh chân chữ thường.
    y: lineTop(block, index) + block.size * 0.98,
  };
};

export const InkText: React.FC<{ block: InkBlock; frame: number; ready: boolean }> = ({ block, frame, ready }) => {
  const done = writtenChars(block, frame);
  const { size } = block;
  return (
    <>
      {block.lines.map((line, index) => {
        const count = done - line.from;
        if (count <= 0) return null;
        const shown = partialWidth(line, count, size, ready);
        const left = lineLeft(block, line);
        const top = lineTop(block, index);
        const list = chars(line.text);
        // Cắt dòng thành [trước][cụm nhấn][sau] để tô màu cụm nhấn.
        const p = block.punch;
        const a = p ? Math.max(0, Math.min(list.length, p.from - line.from)) : 0;
        const b = p ? Math.max(a, Math.min(list.length, p.to - line.from)) : 0;
        const colorT = p ? interpolate(frame, [p.at, p.at + 6], [0, 1], clamp) : 0;
        const underline = p && b > a ? interpolate(frame, [p.at + 2, p.at + 16], [0, 1], clamp) : 0;
        const x0 = measure(list.slice(0, a).join(""), size, ready);
        const x1 = measure(list.slice(0, b).join(""), size, ready);
        return (
          <div
            key={`${block.key}-l${index}`}
            style={{
              position: "absolute",
              left,
              top,
              width: line.width,
              height: size * LINE_HEIGHT,
              whiteSpace: "pre",
              fontFamily: SCRIPT,
              fontWeight: SCRIPT_WEIGHT,
              fontSize: size,
              lineHeight: LINE_HEIGHT,
              color: block.color,
              // Mực hơi loang vào giấy.
              textShadow: `0 0 ${(size * 0.02).toFixed(2)}px rgba(27, 42, 90, 0.45)`,
              // Nét Dancing Script vươn ra ngoài bề rộng đo — lề âm hai bên để không bị cắt.
              clipPath: count >= list.length ? undefined : `inset(-60% ${(line.width - shown).toFixed(1)}px -60% -${(size * 0.4).toFixed(1)}px)`,
            }}
          >
            {p && b > a ? (
              <>
                {list.slice(0, a).join("")}
                <span style={{ color: interpolateInk(block.color, p.color, colorT) }}>{list.slice(a, b).join("")}</span>
                {list.slice(b).join("")}
                {underline > 0 ? (
                  <svg
                    width={x1 - x0 + size * 0.3}
                    height={size * 0.5}
                    style={{ position: "absolute", left: x0 - size * 0.1, top: size * 1.02, overflow: "visible" }}
                  >
                    <path
                      d={wavyLine(x1 - x0 + size * 0.2, size * 0.18, size * 0.07, `${block.key}-${index}`)}
                      fill="none"
                      stroke={p.color}
                      strokeWidth={Math.max(2, size * 0.06)}
                      strokeLinecap="round"
                      pathLength={1}
                      strokeDasharray="1 1"
                      strokeDashoffset={1 - underline}
                    />
                  </svg>
                ) : null}
              </>
            ) : (
              line.text
            )}
          </div>
        );
      })}
    </>
  );
};

/** Pha hai màu hex theo t — mực xanh chuyển dần sang mực màu nhấn. */
const interpolateInk = (from: string, to: string, t: number) => {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const [a, b] = [parse(from), parse(to)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(", ")})`;
};

/** Gạch chân lượn sóng vẽ tay, cố định theo seed. */
const wavyLine = (width: number, y: number, amp: number, seed: string) => {
  const steps = Math.max(4, Math.round(width / (amp * 7)));
  let d = `M 0 ${(y + seeded(`${seed}-0`, -amp, amp) * 0.3).toFixed(1)}`;
  for (let i = 1; i <= steps; i++) {
    const x = (width * i) / steps;
    const cx = (width * (i - 0.5)) / steps;
    const dir = i % 2 === 0 ? 1 : -1;
    d += ` Q ${cx.toFixed(1)} ${(y + dir * amp * seeded(`${seed}-${i}`, 0.7, 1.3)).toFixed(1)} ${x.toFixed(1)} ${(y + seeded(`${seed}-e${i}`, -amp, amp) * 0.25).toFixed(1)}`;
  }
  return d;
};

// ---------------------------------------------------------------------------
// Cây bút máy
// ---------------------------------------------------------------------------

/**
 * Bút máy nằm nghiêng, ngòi ở gốc toạ độ, thân chéo lên phải. `lift` 0 = ngòi chạm giấy, 1 = nhấc lên
 * (bóng đổ xa và mờ hơn). Vẽ bằng SVG thuần nên không cần file ảnh.
 */
export const FountainPen: React.FC<{ x: number; y: number; length: number; lift: number; accent: string; opacity?: number }> = ({
  x, y, length: L, lift, accent, opacity = 1,
}) => {
  const w = L * 0.085;
  const shadowX = L * (0.02 + lift * 0.06);
  const shadowY = L * (0.03 + lift * 0.08);
  const blur = L * (0.012 + lift * 0.03);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - lift * L * 0.05,
        width: 0,
        height: 0,
        transform: "rotate(-38deg)",
        transformOrigin: "0 0",
        opacity,
        filter: `drop-shadow(${shadowX.toFixed(1)}px ${shadowY.toFixed(1)}px ${blur.toFixed(1)}px rgba(40, 25, 10, ${(0.42 - lift * 0.12).toFixed(2)}))`,
        pointerEvents: "none",
      }}
    >
      <svg width={L * 1.02} height={w * 1.6} viewBox={`0 ${-w * 0.8} ${L * 1.02} ${w * 1.6}`} style={{ position: "absolute", left: 0, top: -w * 0.8, overflow: "visible" }}>
        <defs>
          <linearGradient id="pen-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a4a55" />
            <stop offset="0.35" stopColor="#1c1c22" />
            <stop offset="1" stopColor="#08080b" />
          </linearGradient>
          <linearGradient id="pen-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7e3a1" />
            <stop offset="0.5" stopColor="#c9a24a" />
            <stop offset="1" stopColor="#7d5f1d" />
          </linearGradient>
        </defs>
        {/* Ngòi vàng có khe mực */}
        <path d={`M 0 0 L ${L * 0.15} ${-w * 0.42} L ${L * 0.15} ${w * 0.42} Z`} fill="url(#pen-gold)" />
        <line x1={L * 0.012} y1={0} x2={L * 0.1} y2={0} stroke="#5a4210" strokeWidth={Math.max(1, w * 0.06)} />
        <circle cx={L * 0.1} cy={0} r={w * 0.07} fill="#5a4210" />
        {/* Cổ bút */}
        <path d={`M ${L * 0.14} ${-w * 0.36} L ${L * 0.3} ${-w * 0.46} L ${L * 0.3} ${w * 0.46} L ${L * 0.14} ${w * 0.36} Z`} fill="url(#pen-body)" />
        <rect x={L * 0.295} y={-w * 0.52} width={L * 0.03} height={w * 1.04} rx={w * 0.08} fill="url(#pen-gold)" />
        {/* Thân bút — tông màu nhấn rất tối */}
        <rect x={L * 0.32} y={-w * 0.5} width={L * 0.6} height={w} rx={w * 0.45} fill="url(#pen-body)" />
        <rect x={L * 0.32} y={-w * 0.5} width={L * 0.6} height={w} rx={w * 0.45} fill={accent} opacity={0.22} />
        <rect x={L * 0.34} y={-w * 0.36} width={L * 0.56} height={w * 0.14} rx={w * 0.07} fill="#ffffff" opacity={0.16} />
        <rect x={L * 0.66} y={-w * 0.54} width={L * 0.035} height={w * 1.08} rx={w * 0.08} fill="url(#pen-gold)" />
        {/* Kẹp bút */}
        <rect x={L * 0.7} y={-w * 0.72} width={L * 0.2} height={w * 0.16} rx={w * 0.08} fill="url(#pen-gold)" />
        <rect x={L * 0.9} y={-w * 0.46} width={L * 0.05} height={w * 0.92} rx={w * 0.4} fill="url(#pen-body)" />
      </svg>
    </div>
  );
};
