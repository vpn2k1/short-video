/**
 * Trục thời gian: vạch nền, vạch màu nhấn chạy theo tiến độ, các mốc và nhãn năm.
 * Mọi vị trí tính theo "số mốc" (xem scrollPosition): mốc i nằm ở anchor + (i − p) × spacing, nên camera
 * cuộn chỉ là đổi p — mốc cũ trôi lên/sang trái, mờ đi nhưng vẫn giữ năm.
 */
import { interpolate } from "remotion";
import { alpha, clamp, DISPLAY, fitOneLine, OUT, ramp, type Theme } from "./theme";

export type AxisGeometry = {
  vertical: boolean;
  /** Toạ độ ngang (trục dọc) hoặc dọc (trục ngang) của đường trục. */
  line: number;
  /** Vị trí của mốc đang xem dọc theo trục. */
  anchor: number;
  spacing: number;
  /** Chiều dài khung dọc theo trục. */
  length: number;
};

export const Axis: React.FC<{
  geo: AxisGeometry;
  labels: string[];
  /** Vị trí camera (số mốc). */
  p: number;
  /** Đầu vạch màu nhấn (số mốc). */
  fill: number;
  /** 0→1: trục vẽ dần lúc mở đầu. */
  drawIn: number;
  /** 0→1: mốc và nhãn hiện ra (sau trang tiêu đề). */
  contentIn: number;
  /** Frame bật tia sáng ở từng mốc (lúc câu nhấn xuất hiện), null nếu cảnh không có câu nhấn. */
  sparks: (number | null)[];
  frame: number;
  unit: number;
  /** Bề rộng tối đa của nhãn năm lớn (mốc đang xem) và nhãn nhỏ (mốc cũ). */
  bigMax: number;
  smallMax: number;
  bigBase: number;
  smallBase: number;
  accent: string;
  theme: Theme;
}> = ({ geo, labels, p, fill, drawIn, contentIn, sparks, frame, unit, bigMax, smallMax, bigBase, smallBase, accent, theme }) => {
  const { vertical, line, anchor, spacing, length } = geo;
  const at = (world: number) => anchor + (world - p) * spacing;
  const thick = 6 * unit;
  const last = labels.length - 1;

  // Trục bắt đầu nửa bước trước mốc đầu, kết thúc sau mốc cuối một đoạn ngắn.
  const startPos = at(-0.5);
  // Trục chạy tiếp tới mép khung — dòng thời gian chưa kết thúc.
  const endPos = Math.max(at(last + 0.75), length + thick);
  const trackEnd = startPos + (endPos - startPos) * drawIn;
  const fillEnd = Math.min(trackEnd, at(fill));

  /** Đoạn thẳng dọc theo trục từ a tới b. */
  const segment = (a: number, b: number, color: string, key: string, extra?: React.CSSProperties) => {
    const lo = Math.max(-thick, Math.min(a, b));
    const hi = Math.min(length + thick, Math.max(a, b));
    if (hi <= lo) return null;
    return (
      <div
        key={key}
        style={{
          position: "absolute",
          backgroundColor: color,
          borderRadius: thick,
          ...(vertical
            ? { left: line - thick / 2, top: lo, width: thick, height: hi - lo }
            : { top: line - thick / 2, left: lo, height: thick, width: hi - lo }),
          ...extra,
        }}
      />
    );
  };

  const pos = (along: number, across = 0): React.CSSProperties =>
    vertical ? { left: line + across, top: along } : { left: along, top: line + across };

  return (
    <>
      {segment(startPos, trackEnd, theme.track, "track")}
      {segment(startPos, fillEnd, accent, "fill", { boxShadow: `0 0 ${14 * unit}px ${alpha(accent, 0.45)}` })}
      {/* Đầu vạch tiến độ: chấm sáng nhỏ chạy dọc trục. */}
      {contentIn > 0 && fillEnd > startPos ? (
        <div
          style={{
            position: "absolute",
            ...pos(fillEnd),
            width: 14 * unit,
            height: 14 * unit,
            marginLeft: -7 * unit,
            marginTop: -7 * unit,
            borderRadius: "50%",
            backgroundColor: accent,
            boxShadow: `0 0 0 ${5 * unit}px ${alpha(accent, 0.22)}`,
            opacity: contentIn,
          }}
        />
      ) : null}

      {labels.map((label, i) => {
        const along = at(i);
        if (along < -spacing || along > length + spacing) return null;
        const d = i - p;
        const focus = interpolate(Math.abs(d), [0, 1], [1, 0], clamp);
        const reached = d <= 0.02;
        // Mốc đi qua rồi thì tô đặc; mốc sắp tới là vòng rỗng mờ, chưa có năm (không lộ trước).
        const edgeFade = interpolate(along, [-spacing * 0.2, spacing * 0.5], [0, 1], clamp);
        const nodeOpacity = contentIn * edgeFade * (reached ? 1 : 0.7);
        const r = (reached ? 11 + 9 * focus : 9) * unit;

        const labelOpacity =
          contentIn * edgeFade * interpolate(d, [-4, -3, -1, 0, 0.55, 1], [0, 0.4, 0.5, 1, 0, 0], clamp);
        const big = fitOneLine(label, bigBase, bigMax);
        const small = fitOneLine(label, smallBase, smallMax);
        const size = small + (big - small) * focus;

        const spark = sparks[i];
        const sparkT = spark === null ? -1 : frame - spark;
        const pulse = sparkT >= 0 ? interpolate(sparkT, [0, 5, 16], [1, 1.45, 1], clamp) : 1;

        return (
          <div key={i}>
            {/* Quầng sáng của mốc đang xem. */}
            {focus > 0.01 ? (
              <div
                style={{
                  position: "absolute",
                  ...pos(along),
                  width: 64 * unit,
                  height: 64 * unit,
                  marginLeft: -32 * unit,
                  marginTop: -32 * unit,
                  borderRadius: "50%",
                  backgroundColor: alpha(accent, 0.18),
                  opacity: nodeOpacity * focus,
                  scale: String(0.6 + 0.4 * focus),
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                ...pos(along),
                width: r * 2,
                height: r * 2,
                marginLeft: -r,
                marginTop: -r,
                borderRadius: "50%",
                boxSizing: "border-box",
                backgroundColor: reached ? accent : theme.bg,
                border: reached ? `${4 * unit}px solid ${theme.bg}` : `${3 * unit}px solid ${theme.track}`,
                boxShadow: reached ? `0 0 0 ${2.5 * unit}px ${alpha(accent, 0.9 * focus + 0.35 * (1 - focus))}` : undefined,
                opacity: nodeOpacity * (reached ? 0.55 + 0.45 * focus : 1),
                scale: String(pulse),
              }}
            />
            {sparkT >= 0 && sparkT < 24 ? <Spark x={pos(along).left as number} y={pos(along).top as number} t={sparkT} unit={unit} accent={accent} /> : null}
            {labelOpacity > 0.001 ? (
              <div
                style={{
                  position: "absolute",
                  ...(vertical
                    ? { left: line + (34 + 14 * focus) * unit, top: along, translate: "0 -50%" }
                    : { left: along - 10 * unit, top: line - 34 * unit, translate: "0 -100%" }),
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: size,
                  lineHeight: 1.1,
                  letterSpacing: -0.02 * size,
                  whiteSpace: "nowrap",
                  color: focus > 0.5 ? theme.ink : theme.muted,
                  opacity: labelOpacity,
                  // Lúc mới tới mốc, năm lớn trượt vào từ phía trục.
                  ...(vertical
                    ? { marginLeft: (1 - focus) * 18 * unit }
                    : { marginTop: (1 - focus) * 14 * unit }),
                }}
              >
                {label}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
};

/** Tia sáng nhỏ bật ra quanh mốc lúc câu nhấn xuất hiện. */
const Spark: React.FC<{ x: number; y: number; t: number; unit: number; accent: string }> = ({ x, y, t, unit, accent }) => {
  const grow = ramp(t, 0, 12);
  const fade = interpolate(t, [8, 24], [1, 0], clamp);
  const inner = (18 + 22 * grow) * unit;
  const outer = inner + interpolate(t, [0, 6, 24], [4, 20, 6], clamp) * unit;
  const ring = (20 + 44 * ramp(t, 0, 18, OUT)) * unit;
  const size = 160 * unit;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible", opacity: fade }}
    >
      <circle r={ring} fill="none" stroke={accent} strokeWidth={3 * unit} opacity={0.6} />
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <line
            key={k}
            x1={Math.cos(a) * inner}
            y1={Math.sin(a) * inner}
            x2={Math.cos(a) * outer}
            y2={Math.sin(a) * outer}
            stroke={accent}
            strokeWidth={5 * unit}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};
