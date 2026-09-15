/**
 * Nền trang truyện: giấy ngà, hai lớp chấm halftone tô màu theo accent (dày ở hai góc
 * đối nhau, thưa dần), vài nét hành động chéo vụt qua mỗi lần lật trang.
 * Toàn bộ là CSS gradient + SVG tĩnh — không filter động.
 */
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { seeded, useLayout } from "../shared";
import { clamp, comicPalette, INK, PAPER } from "./palette";

const Dots: React.FC<{ color: string; cell: number; radius: number; mask: string; opacity: number; shift: number }> = ({
  color,
  cell,
  radius,
  mask,
  opacity,
  shift,
}) => {
  const dot = `radial-gradient(circle at 50% 50%, ${color} 0 ${radius}px, transparent ${radius + 1}px)`;
  return (
    <AbsoluteFill
      style={{
        // Hai lớp lệch nửa ô → lưới chéo 45° như bản in thật.
        backgroundImage: `${dot}, ${dot}`,
        backgroundSize: `${cell}px ${cell}px`,
        backgroundPosition: `${shift}px ${shift}px, ${shift + cell / 2}px ${shift + cell / 2}px`,
        maskImage: mask,
        WebkitMaskImage: mask,
        opacity,
      }}
    />
  );
};

export const Page: React.FC<{ accent: string; pageIndex: number; sinceTurn: number; frame: number }> = ({
  accent,
  pageIndex,
  sinceTurn,
  frame,
}) => {
  const { width: W, height: H, unit: u } = useLayout();
  const pal = comicPalette(accent, Math.max(0, pageIndex));
  const cell = Math.round(26 * u);
  const drift = (frame * 0.25 * u) % cell;

  // Nét hành động: vụt vào khi lật trang rồi trôi chậm.
  const whoosh = interpolate(sinceTurn, [0, 14], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const diag = Math.hypot(W, H);
  const lines = Array.from({ length: 11 }, (_, i) => {
    const k = `comic-line-${pageIndex}-${i}`;
    const along = seeded(`${k}-t`, -0.5, 0.5) * diag;
    const across = (i / 10 - 0.5) * diag * 0.95 + seeded(`${k}-o`, -40, 40) * u;
    const len = seeded(`${k}-l`, 0.12, 0.34) * diag;
    return { along, across, len, w: seeded(`${k}-w`, 3, 9) * u, k };
  });
  const angle = -32;

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, overflow: "hidden" }}>
      <Dots
        color={pal.dots}
        cell={cell}
        radius={cell * 0.3}
        opacity={0.75}
        shift={drift}
        mask="linear-gradient(145deg, black 0%, rgba(0,0,0,0.55) 30%, transparent 62%)"
      />
      <Dots
        color={pal.dotsAlt}
        cell={cell}
        radius={cell * 0.24}
        opacity={0.6}
        shift={-drift}
        mask="linear-gradient(325deg, black 0%, rgba(0,0,0,0.5) 28%, transparent 58%)"
      />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${W / 2} ${H / 2}) rotate(${angle})`}>
          {lines.map((l) => {
            const x = l.along - whoosh * diag * 0.4 + ((frame * 0.6 * u) % (diag * 0.02));
            return (
              <line
                key={l.k}
                x1={x}
                y1={l.across}
                x2={x + l.len * (1 + whoosh * 1.5)}
                y2={l.across}
                stroke={INK}
                strokeWidth={l.w}
                strokeLinecap="round"
                opacity={0.1 + whoosh * 0.12}
              />
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
