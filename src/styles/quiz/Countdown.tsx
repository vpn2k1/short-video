import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { FONTS, useLayout } from "../shared";
import { AMBER, EASE_BACK, EASE_OUT, GREEN, GREEN_DARK, INK, paletteFrom, RED, ramp, type SceneInfo } from "./theme";

const FPS = 30;

/**
 * Đĩa tròn vắt qua mép dưới thẻ câu hỏi, có ba trạng thái:
 *  1. Chờ: "?" accent nhịp thở nhẹ.
 *  2. Đếm ngược (info.countdown): vòng SVG cạn dần bằng stroke-dashoffset, màu vàng hổ phách → đỏ,
 *     số 3/2/1 bật phóng mỗi lần đổi, giây cuối rung nhẹ.
 *  3. Lật đáp án: đĩa xanh ✓ bật nảy.
 */
export const CountdownDisc: React.FC<{ cx: number; cy: number; size: number; info: SceneInfo; accent: string }> = ({
  cx,
  cy,
  size,
  info,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pal = paletteFrom(accent);
  const enterP = ramp(frame, info.enter + 8, 14, EASE_BACK);
  const stroke = 16 * unit;
  const r = size / 2 - stroke / 2 - 10 * unit;
  const circ = 2 * Math.PI * r;

  const reveal = info.revealFrame;
  const revealed = reveal !== null && frame >= reveal;
  const cd = info.countdown;
  const counting = cd !== null && frame >= cd.from && frame < cd.to;

  let content: React.ReactNode;
  let ringColor = AMBER;
  let drain = 0;
  let discScale = interpolate(enterP, [0, 1], [0, 1]);
  let shake = 0;
  let face = "#ffffff";

  if (revealed) {
    const pop = ramp(frame, reveal as number, 12, EASE_BACK);
    discScale = interpolate(pop, [0, 1], [0.55, 1]);
    face = GREEN;
    content = (
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100" style={{ overflow: "visible" }}>
        <path
          d="M22 54 L42 73 L80 30"
          fill="none"
          stroke="#ffffff"
          strokeWidth={15}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={100}
          strokeDashoffset={100 * (1 - ramp(frame, (reveal as number) + 3, 9, EASE_OUT))}
        />
      </svg>
    );
  } else if (counting && cd) {
    const remaining = cd.to - frame;
    const n = Math.min(3, Math.ceil(remaining / FPS));
    const sinceTick = Math.min(n * FPS - remaining, frame - cd.from);
    const tick = ramp(sinceTick, 0, 10, EASE_OUT);
    const p = (frame - cd.from) / Math.max(1, cd.to - cd.from);
    drain = p;
    ringColor = interpolateColors(p, [0, 0.55, 1], [AMBER, "#f97316", RED]);
    discScale = 1 + (1 - tick) * 0.12;
    shake = n === 1 ? Math.sin(frame * 2.2) * 3 * unit : 0;
    content = (
      <div
        key={n}
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 900,
          fontSize: size * 0.5,
          lineHeight: 1,
          color: n === 1 ? RED : INK,
          transform: `scale(${1.6 - 0.6 * tick})`,
          opacity: 0.3 + 0.7 * tick,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {n}
      </div>
    );
  } else {
    const breathe = 1 + Math.sin(frame / 9) * 0.06;
    content = (
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 900,
          fontSize: size * 0.52,
          lineHeight: 1,
          color: pal.base,
          transform: `scale(${breathe})`,
        }}
      >
        ?
      </div>
    );
  }

  const showRing = counting || (!revealed && cd !== null && frame < cd.from);

  return (
    <div
      style={{
        position: "absolute",
        left: cx - size / 2 + shake,
        top: cy - size / 2,
        width: size,
        height: size,
        transform: `scale(${discScale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          backgroundColor: face,
          border: `${7 * unit}px solid ${revealed ? "#ffffff" : pal.deep}`,
          boxShadow: `0 ${8 * unit}px 0 ${revealed ? GREEN_DARK : "rgba(20,8,40,0.25)"}, 0 ${22 * unit}px ${40 * unit}px -${10 * unit}px rgba(20,8,40,0.6)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {content}
      </div>
      {showRing ? (
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(29,23,64,0.1)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * drain}
          />
        </svg>
      ) : null}
    </div>
  );
};
