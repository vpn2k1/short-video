/**
 * Tờ giấy can của phong cách "Bản vẽ kỹ thuật": nền xanh có lưới ô chính/phụ, nếp gấp giấy, tối góc; khung viền đôi
 * có vạch chia ô (1 2 3… / A B C…) như bản vẽ thật; khung tên ở góc dưới phải và thước tỉ lệ bên cạnh.
 */
import { AbsoluteFill } from "remotion";
import { C, LABEL, MONO, upper } from "./theme";

/** Nền giấy can: lưới 2 cấp, nếp gấp ngang/dọc, tối góc. Không động — giấy phải đứng yên để nét vẽ nổi lên. */
export const BlueprintPaper: React.FC<{ width: number; height: number; unit: number }> = ({ width, height, unit }) => {
  const minor = 27 * unit;
  const major = minor * 5;
  const hair = Math.max(1, 1.2 * unit).toFixed(2);
  const bold = Math.max(1, 1.8 * unit).toFixed(2);
  const line = (dir: "90deg" | "0deg", px: number, w: string, color: string) =>
    `repeating-linear-gradient(${dir}, ${color} 0px, ${color} ${w}px, transparent ${w}px, transparent ${px.toFixed(2)}px)`;
  // Nếp gấp: tờ giấy gấp làm tư (dọc) hoặc làm ba (ngang) — một vệt sáng cạnh một vệt tối.
  const folds = height > width ? [0.5] : [0.34, 0.67];
  const crease = (pos: number, vertical: boolean) => {
    const p = (pos * 100).toFixed(1);
    const dir = vertical ? "90deg" : "180deg";
    return `linear-gradient(${dir}, transparent calc(${p}% - ${(26 * unit).toFixed(1)}px), rgba(0,0,0,0.13) calc(${p}% - 1px), rgba(255,255,255,0.10) ${p}%, rgba(255,255,255,0.03) calc(${p}% + ${(10 * unit).toFixed(1)}px), transparent calc(${p}% + ${(30 * unit).toFixed(1)}px))`;
  };
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 45% 38%, #15508f 0%, ${C.paper} 55%, ${C.paperDeep} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: [
            line("90deg", major, bold, "rgba(220,238,255,0.16)"),
            line("0deg", major, bold, "rgba(220,238,255,0.16)"),
            line("90deg", minor, hair, "rgba(220,238,255,0.065)"),
            line("0deg", minor, hair, "rgba(220,238,255,0.065)"),
          ].join(", "),
          backgroundPosition: `${(width / 2) % major}px ${(height / 2) % major}px`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: [
            ...folds.map((f) => crease(f, false)),
            crease(0.5, true),
          ].join(", "),
        }}
      />
      {/* Tối bốn góc như bản in cũ dưới đèn. */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(2, 16, 40, 0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Khung bản vẽ: viền ngoài mảnh + viền trong đậm, giữa hai viền là số/chữ chia ô. `inset` = mép viền trong.
 */
export const DrawingBorder: React.FC<{ width: number; height: number; unit: number; inset: number }> = ({
  width,
  height,
  unit,
  inset,
}) => {
  const outer = inset * 0.45;
  const cols = width > height ? 8 : 4;
  const rows = width > height ? 4 : 8;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;
  const font = 15 * unit;
  const mid = (outer + inset) / 2;
  const sw = Math.max(1, 1.3 * unit);
  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <rect x={outer} y={outer} width={width - outer * 2} height={height - outer * 2} fill="none" stroke={C.faint} strokeWidth={sw} />
        <rect x={inset} y={inset} width={innerW} height={innerH} fill="none" stroke={C.ink} strokeWidth={sw * 2.2} opacity={0.85} />
        {Array.from({ length: cols - 1 }, (_, i) => {
          const x = inset + ((i + 1) * innerW) / cols;
          return (
            <g key={`c${i}`} stroke={C.faint} strokeWidth={sw}>
              <line x1={x} y1={outer} x2={x} y2={inset} />
              <line x1={x} y1={height - inset} x2={x} y2={height - outer} />
            </g>
          );
        })}
        {Array.from({ length: rows - 1 }, (_, i) => {
          const y = inset + ((i + 1) * innerH) / rows;
          return (
            <g key={`r${i}`} stroke={C.faint} strokeWidth={sw}>
              <line x1={outer} y1={y} x2={inset} y2={y} />
              <line x1={width - inset} y1={y} x2={width - outer} y2={y} />
            </g>
          );
        })}
        <g fill={C.soft} fontFamily={MONO} fontSize={font} textAnchor="middle" dominantBaseline="central">
          {Array.from({ length: cols }, (_, i) => {
            const x = inset + ((i + 0.5) * innerW) / cols;
            return (
              <g key={`n${i}`}>
                <text x={x} y={mid}>{i + 1}</text>
                <text x={x} y={height - mid}>{i + 1}</text>
              </g>
            );
          })}
          {Array.from({ length: rows }, (_, i) => {
            const y = inset + ((i + 0.5) * innerH) / rows;
            const letter = String.fromCharCode(65 + i);
            return (
              <g key={`l${i}`}>
                <text x={mid} y={y}>{letter}</text>
                <text x={width - mid} y={y}>{letter}</text>
              </g>
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

type Box = { x: number; y: number; w: number; h: number };

/** Cỡ chữ để một dòng vừa bề ngang ô (Lexend in hoa ≈ 0.72 em mỗi ký tự); co tối đa còn 62%, dài hơn thì "…". */
const fitLine = (text: string, size: number, width: number, charW = 0.72) =>
  size * Math.max(0.62, Math.min(1, width / Math.max(1, Array.from(text).length * charW * size)));

/** Một ô của khung tên: nhãn nhỏ phía trên, giá trị bên dưới. */
const Cell: React.FC<{
  label: string;
  value: string;
  unit: number;
  size: number;
  style?: React.CSSProperties;
  accent?: string;
}> = ({ label, value, unit, size, style, accent }) => (
  <div
    style={{
      padding: `${6 * unit}px ${12 * unit}px`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      minWidth: 0,
      overflow: "hidden",
      ...style,
    }}
  >
    <div style={{ fontFamily: MONO, fontSize: 12.5 * unit, color: C.soft, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{label}</div>
    <div
      style={{
        fontFamily: LABEL,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.3,
        color: accent ?? C.ink,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        paddingTop: 2 * unit,
      }}
    >
      {value}
    </div>
  </div>
);

/**
 * Khung tên bản vẽ ở góc dưới phải: tên bản vẽ (tiêu đề video), số bản vẽ, tỉ lệ, người vẽ (handle), tờ n/m.
 * `sheet` đổi theo cảnh đang chạy.
 */
export const TitleBlock: React.FC<{
  box: Box;
  unit: number;
  title: string;
  handle: string;
  sheet: number;
  sheets: number;
  accent: string;
  opacity: number;
}> = ({ box, unit, title, handle, sheet, sheets, accent, opacity }) => {
  const line = `${Math.max(1, 1.6 * unit).toFixed(2)}px solid ${C.ink}`;
  const thin = `${Math.max(1, 1 * unit).toFixed(2)}px solid ${C.faint}`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const t = upper(title || "BẢN VẼ");
  const size = 21 * unit;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        border: line,
        borderWidth: Math.max(1, 2.4 * unit),
        backgroundColor: C.fill,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "1.25fr 1fr",
        opacity,
        boxShadow: `0 0 0 ${(5 * unit).toFixed(1)}px rgba(9, 45, 94, 0.55)`,
      }}
    >
      <Cell
        label="TÊN BẢN VẼ"
        value={t}
        unit={unit}
        size={fitLine(t, size, (box.w * 2) / 3 - 26 * unit)}
        style={{ gridColumn: "1 / 3", borderRight: thin, borderBottom: thin }}
      />
      <Cell label="BẢN VẼ SỐ" value="01" unit={unit} size={size * 1.25} style={{ borderBottom: thin }} accent={accent} />
      <Cell label="NGƯỜI VẼ" value={handle || "—"} unit={unit} size={fitLine(handle || "—", size * 0.9, box.w / 3 - 26 * unit, 0.7)} style={{ borderRight: thin }} />
      <Cell label="TỈ LỆ" value="1:1" unit={unit} size={size} style={{ borderRight: thin }} />
      <Cell label="TỜ" value={`${pad(sheet)} / ${pad(Math.max(sheet, sheets))}`} unit={unit} size={size} />
    </div>
  );
};

/** Thước tỉ lệ đen trắng xen kẽ, đặt cạnh khung tên. */
export const ScaleBar: React.FC<{ x: number; y: number; w: number; unit: number; opacity: number }> = ({ x, y, w, unit, opacity }) => {
  const h = 12 * unit;
  const segs = 5;
  const sw = Math.max(1, 1.3 * unit);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, opacity }}>
      <div style={{ fontFamily: MONO, fontSize: 13 * unit, color: C.soft, letterSpacing: "0.08em", marginBottom: 6 * unit }}>THƯỚC TỈ LỆ (m)</div>
      <svg width={w} height={h + 22 * unit} style={{ overflow: "visible" }}>
        {Array.from({ length: segs }, (_, i) => (
          <rect
            key={i}
            x={(i * w) / segs}
            y={0}
            width={w / segs}
            height={h}
            fill={i % 2 === 0 ? C.ink : "none"}
            stroke={C.ink}
            strokeWidth={sw}
            opacity={0.85}
          />
        ))}
        <g fill={C.soft} fontFamily={MONO} fontSize={12 * unit} textAnchor="middle">
          {Array.from({ length: segs + 1 }, (_, i) => (
            <text key={i} x={(i * w) / segs} y={h + 17 * unit}>
              {i}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
};
