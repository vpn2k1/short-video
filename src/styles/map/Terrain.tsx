/**
 * Lớp bản đồ (toạ độ bản đồ, đi theo camera): biển, lưới kinh vĩ tuyến, đất liền có vòng sóng quanh bờ kiểu bản đồ
 * cổ, núi, sóng, và các chặng đường. Nét vẽ chia cho zoom nên dày đúng bằng nhau trên màn ở mọi mức zoom.
 */
import { AbsoluteFill } from "remotion";
import { useLayout } from "../shared";
import { legPath, MAP, mix, type Camera, type World } from "./geo";

/** Ba vòng sóng quanh bờ, cách nhau 11px trên màn: vẽ từ ngoài vào, mỗi vòng = nét màu sóng rồi nét màu biển đè lên. */
const RINGS = [3, 2, 1];

export const Terrain: React.FC<{
  world: World;
  cam: Camera;
  accent: string;
  /** Chặng đang đi (index điểm đích) và tiến độ vẽ 0..1; các chặng trước đã vẽ xong. */
  active: number;
  draw: number;
  /** 0..1 — độ hiện của đường dự kiến (chấm mờ) cho các chặng chưa đi. */
  plan: number;
  /** Ghim cuối cùng đã cắm; các điểm sau vẽ vòng rỗng mờ (điểm dự kiến). */
  reached: number;
}> = ({ world, cam, accent, active, draw, plan, reached }) => {
  const { width, height, unit } = useLayout();
  const px = (v: number) => (v * unit) / cam.z;
  const { bounds, blobs } = world;
  const gridStep = 300;
  const gx0 = Math.floor((bounds.minX - 2400) / gridStep) * gridStep;
  const gx1 = bounds.maxX + 2400;
  const gy0 = Math.floor((bounds.minY - 2400) / gridStep) * gridStep;
  const gy1 = bounds.maxY + 2400;
  const lines: React.ReactNode[] = [];
  for (let x = gx0; x <= gx1; x += gridStep) lines.push(<line key={`gx${x}`} x1={x} x2={x} y1={gy0} y2={gy1} />);
  for (let y = gy0; y <= gy1; y += gridStep) lines.push(<line key={`gy${y}`} x1={gx0} x2={gx1} y1={y} y2={y} />);
  const routeInk = mix(accent, MAP.ink, 0.45);

  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${cam.f.x.toFixed(2)} ${cam.f.y.toFixed(2)}) scale(${cam.z.toFixed(5)}) translate(${(-cam.c.x).toFixed(2)} ${(-cam.c.y).toFixed(2)})`}>
          {/* Lưới kinh vĩ tuyến gạch đứt mờ */}
          <g stroke={MAP.grid} strokeWidth={px(1.6)} strokeDasharray={`${px(10)} ${px(8)}`}>{lines}</g>

          {/* Vòng sóng quanh bờ: nét dày của mọi mảng đất gộp lại thành đường bao chung, nên chỗ các mảng chồng nhau không lộ nét. */}
          {RINGS.map((k) => (
            <g key={`ring${k}`} fill="none" strokeLinejoin="round">
              <g stroke={MAP.seaLine} strokeWidth={px(k * 22 + 2.2)}>{blobs.map((b, i) => <path key={i} d={b.d} />)}</g>
              <g stroke={MAP.sea} strokeWidth={px(k * 22 - 2.2)}>{blobs.map((b, i) => <path key={i} d={b.d} />)}</g>
            </g>
          ))}
          {/* Bờ biển: nét nâu mực, nửa trong bị phần đất đè lên → chỉ còn đường bao ngoài. */}
          <g fill="none" stroke={MAP.coast} strokeWidth={px(6)} strokeLinejoin="round">{blobs.map((b, i) => <path key={i} d={b.d} />)}</g>
          <g fill={MAP.land}>{blobs.map((b, i) => <path key={i} d={b.d} />)}</g>
          {/* Sóng trên biển */}
          <g fill="none" stroke={MAP.seaLine} strokeWidth={px(2.4)} strokeLinecap="round">
            {world.waves.map((w, i) => (
              <path key={i} transform={`translate(${w.p.x} ${w.p.y}) scale(${(w.s * unit) / cam.z})`} d="M -22 0 q 5.5 -7 11 0 t 11 0 t 11 0 t 11 0" />
            ))}
          </g>
          {/* Núi: tam giác nét mực, sườn phải gạch bóng */}
          <g fill="none" stroke={mix(MAP.coast, MAP.land, 0.2)} strokeWidth={px(2.6)} strokeLinecap="round" strokeLinejoin="round">
            {world.mountains.map((m, i) => (
              <g key={i} transform={`translate(${m.p.x} ${m.p.y}) scale(${(m.s * unit) / cam.z})`}>
                <path d="M -26 12 L -6 -16 L 14 12" fill={MAP.landShade} />
                <path d="M 2 12 L 18 -6 L 34 12" fill={MAP.landShade} />
                <path d="M -6 -16 L -1 -2 M -2 -9 L 3 4 M 18 -6 L 22 4" />
              </g>
            ))}
          </g>

          {/* Đường dự kiến: chấm mờ cho các chặng chưa tới */}
          {plan > 0 ? (
            <g fill="none" stroke={MAP.ink} strokeOpacity={0.3 * plan} strokeWidth={px(4)} strokeLinecap="round" strokeDasharray={`0 ${px(14)}`}>
              {world.legs.map((leg, i) => (leg && i > active ? <path key={i} d={legPath(leg)} /> : null))}
            </g>
          ) : null}

          {plan > 0 ? (
            <g fill={MAP.paper} fillOpacity={0.7 * plan} stroke={MAP.ink} strokeOpacity={0.4 * plan} strokeWidth={px(3)}>
              {world.pins.map((p, i) => (i > reached ? <circle key={i} cx={p.x} cy={p.y} r={px(9)} /> : null))}
            </g>
          ) : null}

          {/* Chặng đã đi và chặng đang đi: viền giấy trắng + nét gạch màu nhấn đậm. Chặng đang đi lộ dần qua mask. */}
          <defs>
            {world.legs.map((leg, i) =>
              leg && i === active ? (
                <mask key={i} id={`map-leg-${i}`} maskUnits="userSpaceOnUse" x={-1e5} y={-1e5} width={2e5} height={2e5}>
                  <path d={legPath(leg)} fill="none" stroke="#fff" strokeWidth={px(40)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
                </mask>
              ) : null,
            )}
          </defs>
          {world.legs.map((leg, i) => {
            if (!leg || i > active || (i === active && draw <= 0)) return null;
            const mask = i === active && draw < 1 ? `url(#map-leg-${i})` : undefined;
            return (
              <g key={i} mask={mask} fill="none" strokeLinecap="round">
                <path d={legPath(leg)} stroke={MAP.paper} strokeOpacity={0.85} strokeWidth={px(13)} />
                <path d={legPath(leg)} stroke={routeInk} strokeWidth={px(6.5)} strokeDasharray={`${px(20)} ${px(13)}`} />
              </g>
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
