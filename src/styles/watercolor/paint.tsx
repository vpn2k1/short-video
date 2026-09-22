/**
 * Đồ nghề vẽ màu nước cho phong cách "Tranh màu nước": bảng màu suy từ accent, bộ lọc SVG loang mép (nhiễu
 * turbulence làm mép răng cưa mềm + viền đậm màu ở mép như nước đọng khi khô), mặt nạ loang để hé ảnh, vệt cọ,
 * đốm vẩy màu, vết loang tròn, hoa, cành lá, và mặt giấy vân nổi.
 *
 * Mọi thứ xác định: vị trí/màu lấy từ seeded(), độ lớn lấy từ tiến độ truyền vào — không Math.random.
 * id của <filter> phải duy nhất trong trang (nhiều SVG cùng lúc) — nơi gọi truyền `id` riêng.
 */
import { AbsoluteFill, interpolateColors } from "remotion";
import { seeded } from "../shared";

// ---------------------------------------------------------------------------
// Bảng màu
// ---------------------------------------------------------------------------
export const PAPER = "#f6f1e6";
export const INK = "#3a3244";
export const INK_SOFT = "#7a6f80";

const mix = (a: string, b: string, t: number) => interpolateColors(t, [0, 1], [a, b]);

/** Độ sáng tương đối (0..1) của một màu CSS bất kỳ. */
const luminance = (color: string) => {
  const parts = (interpolateColors(0, [0, 1], [color, color]).match(/[\d.]+/g) ?? ["0", "0", "0"]).map(Number);
  const [r, g, b] = parts.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export type Palette = {
  /** Màu nhấn gốc của video. */
  accent: string;
  /** Màu nhấn pha nước — dùng cho mảng loang. */
  wash: string;
  /** Màu nhấn đủ đậm để viết chữ lên giấy (câu nhấn, con số). */
  pigment: string;
  /** Các màu loang phụ: màu nhấn, xanh lam, vàng đất, hồng, xanh lá mạ. */
  washes: string[];
  rose: string;
  leaf: string;
};

export const paletteFor = (accent: string): Palette => {
  const lum = luminance(accent);
  const wash = mix(accent, "#ffffff", 0.32);
  return {
    accent,
    wash,
    // Màu sáng (vàng, xanh nõn) pha đậm hơn nhiều để chữ vẫn đọc được trên giấy.
    pigment: mix(accent, "#2a2230", lum > 0.5 ? 0.55 : lum > 0.25 ? 0.35 : 0.15),
    washes: [wash, "#86a9c6", "#e0ad73", "#d9929f", "#93b28c"],
    rose: mix(accent, "#e59aa8", 0.55),
    leaf: "#7f9f78",
  };
};

/** Màu loang thứ k của cảnh — xoay vòng có seed để mỗi cảnh một phối màu. */
export const washColor = (palette: Palette, key: string | number, k: number) => {
  const offset = Math.floor(seeded(`wc-pal-${key}`, 0, palette.washes.length));
  return palette.washes[(offset + k) % palette.washes.length];
};

// ---------------------------------------------------------------------------
// Bộ lọc loang mép
// ---------------------------------------------------------------------------
/**
 * Lọc "màu nước": nhiễu làm mép lượn răng cưa, rồi viền mép đậm hơn lòng (nước mang hạt màu dạt ra mép khi khô).
 * Viền đậm lấy bằng arithmetic: 1.7·ảnh − 0.95·ảnh_mờ — lòng mảng còn ~0.75, mép lên ~1.2 lần.
 * Mảng màu phải có fill-opacity < 1 để còn chỗ đậm lên ở mép.
 */
export const WashFilter: React.FC<{ id: string; seed: number; frequency: number; displace: number; soft: number; rim?: boolean }> = ({
  id, seed, frequency, displace, soft, rim = true,
}) => (
  <filter id={id} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={4} seed={seed} result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale={displace} xChannelSelector="R" yChannelSelector="G" result="warp" />
    {/* Lượt nhiễu mịn thứ hai: mép xơ như giấy thấm, không tròn trịa. */}
    <feTurbulence type="fractalNoise" baseFrequency={frequency * 5} numOctaves={2} seed={seed + 1} result="fine" />
    <feDisplacementMap in="warp" in2="fine" scale={displace * 0.28} xChannelSelector="G" yChannelSelector="R" result="shape" />
    {rim ? (
      <>
        <feGaussianBlur in="shape" stdDeviation={soft} result="blur" />
        <feComposite in="shape" in2="blur" operator="arithmetic" k1={0} k2={1.7} k3={-0.95} k4={0} result="rim" />
        <feGaussianBlur in="rim" stdDeviation={Math.max(0.6, soft * 0.18)} />
      </>
    ) : (
      <feGaussianBlur in="shape" stdDeviation={soft} />
    )}
  </filter>
);

// ---------------------------------------------------------------------------
// Mặt nạ loang hé ảnh
// ---------------------------------------------------------------------------
export type Blob = { cx: number; cy: number; rx: number; ry: number; rot: number; delay: number };

/**
 * Các vệt màu tạo nên hình loang của một bức tranh trong khung w×h: một mảng lớn giữa + các mảng vệ tinh quanh
 * mép, lệch theo seed. Mép ngoài cùng cách mép khung ≥ 3% để nhiễu không chạm khung (mép thẳng trông giả).
 */
export const blobsFor = (key: string, w: number, h: number): Blob[] => {
  const m = Math.min(w, h);
  const out: Blob[] = [
    { cx: w * seeded(`${key}-mx`, 0.46, 0.54), cy: h * seeded(`${key}-my`, 0.46, 0.54), rx: w * 0.36, ry: h * 0.34, rot: seeded(`${key}-rot`, -12, 12), delay: 0 },
  ];
  // Vệt vệ tinh quanh mép: tròn to nhỏ lẫn lộn, xen vài vệt dài như một lần quét cọ.
  const count = 9;
  const turn = seeded(`${key}-turn`, 0, Math.PI * 2);
  for (let k = 0; k < count; k++) {
    const a = turn + (k / count) * Math.PI * 2 + seeded(`${key}-a${k}`, -0.3, 0.3);
    const stroke = k % 3 === 1;
    const ry = m * (stroke ? seeded(`${key}-r${k}`, 0.08, 0.11) : seeded(`${key}-r${k}`, 0.11, 0.2));
    const rx = ry * (stroke ? seeded(`${key}-sx${k}`, 2.2, 3) : seeded(`${key}-sx${k}`, 1, 1.35));
    const reach = Math.max(rx, ry);
    // Vệt dài xoay theo tiếp tuyến mép để không đâm ra ngoài khung.
    const rot = stroke ? (a * 180) / Math.PI + 90 + seeded(`${key}-o${k}`, -20, 20) : seeded(`${key}-o${k}`, 0, 180);
    const pull = stroke ? ry : reach;
    const dx = Math.cos(a) * Math.max(0, w * 0.5 - pull - w * 0.04) * seeded(`${key}-p${k}`, 0.8, 1);
    const dy = Math.sin(a) * Math.max(0, h * 0.5 - pull - h * 0.04) * seeded(`${key}-q${k}`, 0.8, 1);
    out.push({
      cx: w * 0.5 + dx,
      cy: h * 0.5 + dy,
      rx: Math.min(rx, w * 0.42),
      ry,
      rot,
      delay: seeded(`${key}-d${k}`, 0.06, 0.45),
    });
  }
  return out;
};

/** Bán kính một vệt tại tiến độ loang p (0..1) — vệt nào có delay thì loang muộn hơn, chậm dần về cuối. */
export const blobGrow = (b: Blob, p: number) => {
  const t = Math.min(1, Math.max(0, (p - b.delay) / (1 - b.delay)));
  return 1 - (1 - t) ** 3;
};

const n = (v: number) => v.toFixed(1);

/**
 * Mặt nạ loang dạng data-URI SVG (dùng cho CSS mask-image — mask ảnh/clip HTML chắc chắn chạy trên Chrome).
 * Vẽ ở nửa độ phân giải: mép vốn mềm, rẻ hơn 4 lần khi rasterize mỗi frame.
 */
export const maskUri = (w: number, h: number, blobs: Blob[], scale: (b: Blob) => number, displace: number, soft: number, seed: number) => {
  const shapes = blobs
    .map((b) => ({ b, s: scale(b) }))
    .filter(({ s }) => s > 0.01)
    .map(({ b, s }) => `<ellipse cx="${n(b.cx)}" cy="${n(b.cy)}" rx="${n(b.rx * s)}" ry="${n(b.ry * s)}" transform="rotate(${n(b.rot)} ${n(b.cx)} ${n(b.cy)})"/>`)
    .join("");
  const freq = (1.1 / Math.min(w, h)).toFixed(5);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w / 2)}" height="${n(h / 2)}" viewBox="0 0 ${n(w)} ${n(h)}">` +
    `<filter id="m" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="${seed}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="${n(displace)}" xChannelSelector="R" yChannelSelector="G" result="w"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(6 / Math.min(w, h)).toFixed(5)}" numOctaves="2" seed="${seed + 1}" result="f"/>` +
    `<feDisplacementMap in="w" in2="f" scale="${n(displace * 0.3)}" xChannelSelector="G" yChannelSelector="R"/>` +
    `<feGaussianBlur stdDeviation="${n(soft)}"/></filter>` +
    `<g fill="#fff" filter="url(#m)">${shapes}</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

// ---------------------------------------------------------------------------
// Vệt cọ ngang (nhãn, tiêu đề)
// ---------------------------------------------------------------------------
/** Đường bao một nét cọ ngang: mép trên/dưới gợn, hai đầu thuôn và xơ. */
const brushOutline = (w: number, h: number, key: string) => {
  const steps = 10;
  const top: [number, number][] = [];
  const bottom: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Hai đầu nét thu hẹp (cọ chạm giấy và nhấc lên).
    const pinch = Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.92 + 0.04))) * 1.6);
    const half = (h / 2) * (0.55 + 0.45 * pinch) * seeded(`${key}-h${i}`, 0.86, 1);
    const mid = h / 2 + seeded(`${key}-m${i}`, -0.06, 0.06) * h;
    top.push([t * w, mid - half]);
    bottom.push([t * w, mid + half * seeded(`${key}-b${i}`, 0.8, 1)]);
  }
  const smooth = (pts: [number, number][]) => {
    let d = "";
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      d += ` Q ${n(x0)} ${n(y0)} ${n((x0 + x1) / 2)} ${n((y0 + y1) / 2)}`;
    }
    const [lx, ly] = pts[pts.length - 1];
    return `${d} L ${n(lx)} ${n(ly)}`;
  };
  const rb = [...bottom].reverse();
  return `M ${n(top[0][0])} ${n(top[0][1])}${smooth(top)} L ${n(rb[0][0])} ${n(rb[0][1])}${smooth(rb)} Z`;
};

/**
 * Một nét cọ màu nước nằm ngang, vẽ dần từ trái sang phải theo `draw` (0..1).
 * Vài vệt xước sáng (lông cọ khô) chạy dọc nét để không trông như khối phẳng.
 */
export const BrushStroke: React.FC<{
  id: string; w: number; h: number; color: string; draw: number; opacity?: number; seed?: number; style?: React.CSSProperties;
}> = ({ id, w, h, color, draw, opacity = 0.62, seed = 3, style }) => {
  const pad = h * 0.35;
  const edge = Math.min(100, draw * 112);
  const mask = `linear-gradient(90deg, #000 ${Math.max(0, edge - 12).toFixed(1)}%, transparent ${edge.toFixed(1)}%)`;
  return (
    <svg
      width={w + pad * 2}
      height={h + pad * 2}
      viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
      style={{ position: "absolute", overflow: "visible", WebkitMaskImage: mask, maskImage: mask, ...style }}
    >
      <defs>
        <WashFilter id={id} seed={seed} frequency={Math.max(2.4 / h, 0.012)} displace={Math.min(h * 0.22, 34)} soft={Math.min(h * 0.12, 7)} />
      </defs>
      <g filter={`url(#${id})`}>
        <path d={brushOutline(w, h, id)} fill={color} fillOpacity={opacity} />
        {[0.3, 0.52, 0.7].map((y, k) => (
          <path
            key={k}
            d={`M ${n(w * seeded(`${id}-s${k}`, 0.45, 0.7))} ${n(h * y)} L ${n(w * 1.02)} ${n(h * (y + seeded(`${id}-t${k}`, -0.05, 0.05)))}`}
            stroke={PAPER}
            strokeOpacity={0.28}
            strokeWidth={h * 0.035}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Đốm vẩy màu + vết loang tròn ở góc
// ---------------------------------------------------------------------------
export type Corner = { x: number; y: number; color: string; key: string };

/**
 * Cụm đốm màu vẩy từ đầu cọ + một vết loang tròn lớn nhạt (kiểu "bông cải" khi nhỏ nước vào màu ướt).
 * `t` (0..1) = tiến độ nở.
 */
export const Splatter: React.FC<{ corner: Corner; unit: number; t: number; id: string }> = ({ corner, unit, t, id }) => {
  const { x, y, color, key } = corner;
  const size = 520 * unit;
  const bloomR = seeded(`${key}-br`, 80, 130) * unit;
  const dots = Array.from({ length: 13 }, (_, k) => {
    const a = seeded(`${key}-da${k}`, 0, Math.PI * 2);
    const d = seeded(`${key}-dd${k}`, 0.35, 1) ** 0.8 * size * 0.42;
    const r = seeded(`${key}-dr${k}`, 2.5, k < 3 ? 16 : 9) * unit;
    const delay = seeded(`${key}-dl${k}`, 0, 0.5);
    const g = Math.min(1, Math.max(0, (t - delay) / 0.4));
    return { cx: Math.cos(a) * d, cy: Math.sin(a) * d, r: r * (0.4 + 0.6 * g), o: g };
  });
  const grow = 1 - (1 - t) ** 3;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible" }}
    >
      <defs>
        <WashFilter id={`${id}-b`} seed={Math.floor(seeded(`${key}-sd`, 1, 90))} frequency={0.022 / unit} displace={26 * unit} soft={9 * unit} />
        <WashFilter id={`${id}-d`} seed={5} frequency={0.08 / unit} displace={5 * unit} soft={1.6 * unit} />
        <radialGradient id={`${id}-g`}>
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="70%" stopColor={color} stopOpacity={0.34} />
          <stop offset="100%" stopColor={color} stopOpacity={0.5} />
        </radialGradient>
      </defs>
      <g filter={`url(#${id}-b)`} opacity={grow * 0.85}>
        <circle cx={seeded(`${key}-bx`, -30, 30) * unit} cy={seeded(`${key}-by`, -30, 30) * unit} r={bloomR * (0.55 + 0.45 * grow)} fill={`url(#${id}-g)`} />
      </g>
      <g filter={`url(#${id}-d)`}>
        {dots.map((d, k) => (
          <circle key={k} cx={d.cx} cy={d.cy} r={d.r} fill={color} fillOpacity={0.55 * d.o} />
        ))}
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Hoa năm cánh + cành lá
// ---------------------------------------------------------------------------
/** Một bông hoa năm cánh vẽ màu nước, nở theo `t`. */
export const Blossom: React.FC<{ x: number; y: number; r: number; color: string; center: string; t: number; id: string; rot?: number }> = ({
  x, y, r, color, center, t, id, rot = 0,
}) => {
  const grow = 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
  if (grow <= 0) return null;
  const size = r * 3;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible", opacity: Math.min(1, grow * 1.4) }}
    >
      <defs>
        <WashFilter id={id} seed={11} frequency={3 / r} displace={r * 0.12} soft={r * 0.1} />
      </defs>
      <g filter={`url(#${id})`} transform={`rotate(${n(rot + (1 - grow) * -40)}) scale(${n(0.3 + 0.7 * grow)})`}>
        {[0, 1, 2, 3, 4].map((k) => (
          <ellipse key={k} cx={0} cy={-r * 0.5} rx={r * 0.34} ry={r * 0.52} transform={`rotate(${k * 72})`} fill={color} fillOpacity={0.5} />
        ))}
        <circle r={r * 0.2} fill={center} fillOpacity={0.8} />
      </g>
    </svg>
  );
};

/** Cành cây mảnh với lá, vẽ dần theo `t` — mô-típ cho cảnh không ảnh. Gốc ở góc dưới trái của khung w×h. */
export const Branch: React.FC<{ w: number; h: number; t: number; leaf: string; stem: string; id: string; flip?: boolean }> = ({
  w, h, t, leaf, stem, id, flip = false,
}) => {
  // Đường cong bậc ba của cành.
  const p0 = [w * 0.04, h * 0.98];
  const p1 = [w * 0.28, h * 0.62];
  const p2 = [w * 0.52, h * 0.3];
  const p3 = [w * 0.96, h * 0.1];
  const at = (s: number) => {
    const u = 1 - s;
    const a = u * u * u, b = 3 * u * u * s, c = 3 * u * s * s, d = s * s * s;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  };
  const tangent = (s: number) => {
    const [x1, y1] = at(Math.max(0, s - 0.01));
    const [x2, y2] = at(Math.min(1, s + 0.01));
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  };
  const stemDraw = Math.min(1, t / 0.6);
  const len = Math.min(w, h) * 0.26;
  const leaves = [0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.9].map((s, k) => {
    const [x, y] = at(s);
    const side = k % 2 === 0 ? -1 : 1;
    const g = Math.min(1, Math.max(0, (t - s * 0.6 - 0.1) / 0.3));
    return { x, y, angle: tangent(s) + side * seeded(`${id}-la${k}`, 38, 58), g: 1 - (1 - g) ** 2, l: len * seeded(`${id}-ll${k}`, 0.75, 1.1) * (1 - s * 0.35) };
  });
  const leafPath = (l: number) => `M 0 0 Q ${n(l * 0.45)} ${n(-l * 0.32)} ${n(l)} 0 Q ${n(l * 0.45)} ${n(l * 0.32)} 0 0 Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", overflow: "visible", scale: flip ? "-1 1" : undefined }}>
      <defs>
        <WashFilter id={`${id}-l`} seed={23} frequency={5 / len} displace={len * 0.08} soft={len * 0.06} />
        <WashFilter id={`${id}-s`} seed={31} frequency={0.05} displace={3} soft={1} rim={false} />
      </defs>
      <path
        d={`M ${n(p0[0])} ${n(p0[1])} C ${n(p1[0])} ${n(p1[1])} ${n(p2[0])} ${n(p2[1])} ${n(p3[0])} ${n(p3[1])}`}
        fill="none"
        stroke={stem}
        strokeOpacity={0.75}
        strokeWidth={Math.max(2, len * 0.07)}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - stemDraw}
        filter={`url(#${id}-s)`}
      />
      <g filter={`url(#${id}-l)`}>
        {leaves.map((lf, k) =>
          lf.g > 0 ? (
            <path
              key={k}
              d={leafPath(lf.l * lf.g)}
              transform={`translate(${n(lf.x)} ${n(lf.y)}) rotate(${n(lf.angle)})`}
              fill={k % 3 === 1 ? "#6f8f6a" : leaf}
              fillOpacity={0.72}
            />
          ) : null,
        )}
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Mặt giấy
// ---------------------------------------------------------------------------
/**
 * Vân giấy cold-press: nhiễu fractal chiếu sáng xiên (feDiffuseLighting) thành các gợn nổi, nén về dải sáng rồi
 * nhân (multiply) lên MỌI lớp bên dưới — ảnh cũng ăn vân giấy như màu vẽ thật. Thêm thớ sợi kéo dài ngang rất nhạt.
 * Tĩnh hoàn toàn (không đổi theo frame) để trình duyệt khỏi vẽ lại.
 */
export const PaperTexture: React.FC<{ unit: number; opacity?: number }> = ({ unit, opacity = 1 }) => (
  <AbsoluteFill style={{ mixBlendMode: "multiply", opacity, pointerEvents: "none" }}>
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <filter id="wc-paper" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={0.05 / unit} numOctaves={4} seed={7} result="noise" />
        <feDiffuseLighting in="noise" surfaceScale={1.4} diffuseConstant={1} lightingColor="#ffffff" result="lit">
          <feDistantLight azimuth={225} elevation={52} />
        </feDiffuseLighting>
        <feComponentTransfer>
          <feFuncR type="linear" slope={0.2} intercept={0.82} />
          <feFuncG type="linear" slope={0.2} intercept={0.81} />
          <feFuncB type="linear" slope={0.2} intercept={0.78} />
        </feComponentTransfer>
      </filter>
      <filter id="wc-fiber" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="turbulence" baseFrequency={`${(0.0025 / unit).toFixed(5)} ${(0.09 / unit).toFixed(5)}`} numOctaves={2} seed={3} />
        <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  2.6 0 0 0 -1.5" />
      </filter>
      <rect width="100%" height="100%" filter="url(#wc-paper)" />
      <rect width="100%" height="100%" filter="url(#wc-fiber)" opacity={0.18} />
    </svg>
  </AbsoluteFill>
);
