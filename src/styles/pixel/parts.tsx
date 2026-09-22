/**
 * Mảnh ghép pixel dùng chung: khung góc bậc thang, lấp lánh, đồng xu, rương báu, phong cảnh pixel
 * và màn "tan điểm ảnh" khi đổi cảnh. Hình vẽ bằng <rect> với shapeRendering="crispEdges" — không bo, không mờ.
 */
import { seeded } from "../shared";
import { GOLD, GOLD_DARK, INK, notch, SKIES, type Rect } from "./pixel";

/** Khung pixel nhiều lớp viền (ngoài → trong), mỗi lớp dày đúng một điểm ảnh P, góc bậc thang. */
export const PixelBox: React.FC<{
  rect: Rect;
  P: number;
  rings: string[];
  fill: string;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ rect, P, rings, fill, style, innerStyle, children }) => (
  <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...style }}>
    {rings.map((color, i) => (
      <div key={i} style={{ position: "absolute", inset: i * P, backgroundColor: color, clipPath: notch(P) }} />
    ))}
    <div
      style={{
        position: "absolute",
        inset: rings.length * P,
        backgroundColor: fill,
        clipPath: notch(P),
        overflow: "hidden",
        ...innerStyle,
      }}
    >
      {children}
    </div>
  </div>
);

/** Lưới ô → danh sách <rect>, mỗi ký tự một ô ("." = trống). */
const Sprite: React.FC<{ rows: string[]; colors: Record<string, string>; size: number; style?: React.CSSProperties }> = ({
  rows,
  colors,
  size,
  style,
}) => {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      width={size}
      height={(size * rows.length) / cols}
      viewBox={`0 0 ${cols} ${rows.length}`}
      shapeRendering="crispEdges"
      style={{ display: "block", overflow: "visible", ...style }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (colors[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={colors[ch]} /> : null)),
      )}
    </svg>
  );
};

/** Ngôi sao lấp lánh hình chữ thập 5×5. */
export const Sparkle: React.FC<{ size: number; color: string; style?: React.CSSProperties }> = ({ size, color, style }) => (
  <Sprite size={size} colors={{ x: color, o: "#ffffff" }} rows={["..x..", "..x..", "xxoxx", "..x..", "..x.."]} style={style} />
);

/** Đồng xu 8×8. */
export const Coin: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Sprite
    size={size}
    colors={{ k: INK, g: GOLD, d: GOLD_DARK, w: "#fff6c4" }}
    rows={["..kkkk..", ".kggggk.", "kgwggddk", "kgwgddgk", "kgwgddgk", "kgggddgk", ".kddddk.", "..kkkk.."]}
    style={style}
  />
);

/** Trái tim 7×6 cho HUD. */
export const Heart: React.FC<{ size: number; full: boolean; style?: React.CSSProperties }> = ({ size, full, style }) => (
  <Sprite
    size={size}
    colors={{ k: INK, r: full ? "#ff3b5c" : "#3a2a4a", w: full ? "#ffb3c1" : "#4a3a5a" }}
    rows={[".kk.kk.", "kwrkrrk", "krrrrrk", ".krrrk.", "..krk..", "...k..."]}
    style={style}
  />
);

/** Rương báu 14×11; `open` 0..1 nhấc nắp lên từng nấc, lộ ánh vàng bên trong. */
export const Chest: React.FC<{ size: number; open: number }> = ({ size, open }) => {
  const lift = Math.round(open * 3);
  const lid = ["..kkkkkkkkkk..", ".kbbbbbbbbbbk.", "kbbbbggbbbbbbk", "kggggggggggggk"];
  const body = ["kbbbbgkkgbbbbk", "kbbbbgyygbbbbk", "kbbbbbggbbbbbk", "kbbbbbbbbbbbbk", "kggggggggggggk", "kbbbbbbbbbbbbk", "kkkkkkkkkkkkkk"];
  const colors = { k: INK, b: "#8a4b22", g: GOLD, y: "#fff6c4" };
  const cell = size / 14;
  return (
    <div style={{ position: "relative", width: size, height: cell * 14 }}>
      {open > 0 ? (
        <div
          style={{
            position: "absolute",
            left: cell * 2,
            right: cell * 2,
            top: cell * (3 - lift + 3),
            height: cell * (lift + 1),
            backgroundColor: "#fff3a6",
            boxShadow: `0 ${-cell * 2}px 0 ${cell}px rgba(255, 230, 120, 0.45)`,
          }}
        />
      ) : null}
      <div style={{ position: "absolute", left: 0, top: cell * (3 - lift) }}>
        <Sprite size={size} colors={colors} rows={lid} />
      </div>
      <div style={{ position: "absolute", left: 0, top: cell * 7 }}>
        <Sprite size={size} colors={colors} rows={body} />
      </div>
    </div>
  );
};

/**
 * Phong cảnh pixel cho cảnh không có ảnh: trời phân dải, mặt trời/trăng, mây trôi từng ô, hai lớp đồi, mặt đất.
 * Lưới ô vuông ~27px × unit; mây dịch 1 ô mỗi 10 frame.
 */
export const Landscape: React.FC<{
  w: number;
  h: number;
  variant: number;
  frame: number;
  seed: string;
  unit: number;
  /** Sao chỉ rải từ đỉnh tới mức này (tỉ lệ chiều cao) — màn tiêu đề hạ thấp để sao không lọt dưới chữ trông như dấu. */
  starMax?: number;
}> = ({ w, h, variant, frame, seed, unit, starMax = 0.3 }) => {
  const pal = SKIES[((variant % SKIES.length) + SKIES.length) % SKIES.length];
  // Ô ~27px ở cạnh ngắn 1080 — khung ngang có nhiều cột hơn chứ không phóng ô to ra.
  const cols = Math.max(24, Math.round(w / (27 * unit)));
  const cell = w / cols;
  const rows = Math.ceil(h / cell);
  const horizon = Math.round(rows * 0.6);
  const groundY = Math.round(rows * 0.82);
  const band = horizon / pal.sky.length;
  const phase = seeded(`${seed}-p`, 0, 6);

  const sunR = 3;
  const sunX = Math.round(cols * seeded(`${seed}-sx`, 0.62, 0.8));
  const sunY = Math.round(horizon * 0.32);
  const sun = [] as React.ReactNode[];
  for (let dy = -sunR; dy <= sunR; dy++) {
    const half = Math.round(Math.sqrt(sunR * sunR - dy * dy + 0.5));
    sun.push(<rect key={`s${dy}`} x={sunX - half} y={sunY + dy} width={half * 2 + 1} height={1.02} fill={pal.sun} />);
  }

  const drift = Math.floor(frame / 10);
  const clouds = [0, 1, 2].map((i) => {
    const span = cols + 12;
    const cx = ((Math.round(seeded(`${seed}-c${i}`, 0, span)) + drift * (i % 2 ? 1 : 2) / 2) % span) - 6;
    const cy = Math.round(horizon * (0.12 + i * 0.2));
    const x = Math.round(cx);
    return (
      <g key={`c${i}`} fill={pal.cloud} opacity={0.9}>
        <rect x={x} y={cy} width={7} height={2} />
        <rect x={x + 2} y={cy - 1} width={3} height={1} />
        <rect x={x - 1} y={cy + 1} width={9} height={1} />
      </g>
    );
  });

  const hill = (key: string, base: number, amp: number, freq: number, color: string) =>
    Array.from({ length: cols }, (_, c) => {
      const top = Math.round(base - amp * (0.6 + 0.4 * Math.sin(c * freq + phase)) - amp * 0.35 * Math.sin(c * freq * 2.7 + phase * 2));
      return <rect key={`${key}${c}`} x={c} y={top} width={1.02} height={rows - top} fill={color} />;
    });

  const stars = pal.stars
    ? Array.from({ length: Math.round(cols * 0.5) }, (_, i) => {
      const on = (Math.floor(frame / 12) + i) % 5 !== 0;
      return on ? (
        <rect key={`st${i}`} x={Math.floor(seeded(`${seed}-x${i}`, 0, cols))} y={Math.floor(seeded(`${seed}-y${i}`, rows - h / cell, rows - h / cell + (h / cell) * starMax))} width={1} height={1} fill="#ffffff" opacity={i % 3 ? 0.9 : 0.5} />
      ) : null;
    })
    : null;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 ${rows - h / cell} ${cols} ${h / cell}`}
      shapeRendering="crispEdges"
      style={{ position: "absolute", inset: 0, display: "block" }}
    >
      {pal.sky.map((color, i) => (
        <rect key={`b${i}`} x={0} y={Math.floor(i * band)} width={cols} height={Math.ceil(band) + 1} fill={color} />
      ))}
      <rect x={0} y={horizon} width={cols} height={rows - horizon} fill={pal.sky[pal.sky.length - 1]} />
      {stars}
      {sun}
      {clouds}
      {hill("f", horizon + 1, 6, 0.32, pal.far)}
      {hill("n", groundY - 1, 4, 0.45, pal.near)}
      <rect x={0} y={groundY} width={cols} height={rows - groundY} fill={pal.ground} />
      {Array.from({ length: cols }, (_, c) => (
        <rect key={`g${c}`} x={c} y={groundY - (c % 3 === 0 ? 1 : 0)} width={1.02} height={c % 3 === 0 ? 2 : 1} fill={pal.grass} />
      ))}
      {Array.from({ length: Math.ceil(cols / 2) }, (_, c) => (
        <rect key={`d${c}`} x={c * 2 + ((c * 7) % 3)} y={groundY + 2 + (c % 3)} width={1} height={1} fill={INK} opacity={0.25} />
      ))}
    </svg>
  );
};

/**
 * Tan điểm ảnh: lưới ô tối phủ dần theo đường chéo + xen kẽ bàn cờ + chút ngẫu nhiên có seed.
 * `cover` 0→1 phủ kín; `cover` 1→0 (pha lộ) các ô biến mất theo cùng thứ tự.
 */
export const PixelDissolve: React.FC<{ w: number; h: number; t: number; reveal: boolean; color?: string; cols?: number }> = ({
  w,
  h,
  t,
  reveal,
  color = INK,
  cols = 12,
}) => {
  if ((!reveal && t <= 0) || (reveal && t >= 1)) return null;
  const cell = w / cols;
  const rows = Math.ceil(h / cell);
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const order = 0.55 * ((c / cols + r / rows) / 2) + 0.3 * seeded(`pxd-${c}-${r}`) + 0.15 * ((c + r) % 2);
      const on = reveal ? order >= t : order < t;
      if (on) cells.push(<rect key={`${c}-${r}`} x={c} y={r} width={1.02} height={1.02} fill={color} />);
    }
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${cols} ${h / cell}`} shapeRendering="crispEdges" style={{ position: "absolute", inset: 0 }}>
      {cells}
    </svg>
  );
};
