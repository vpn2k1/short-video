import { interpolate, useCurrentFrame } from "remotion";
import { FONTS, useLayout } from "../shared";
import { EASE_BACK, GREEN, GREEN_DARK, INK, paletteFrom, ramp, type SceneInfo } from "./theme";

/** Kích thước một hàng lựa chọn — index.tsx dùng cùng công thức để tính trước chiều cao thẻ. */
export const choiceMetrics = (fontSize: number, unit: number) => {
  const letterD = Math.round(fontSize * 1.5);
  const padX = 18 * unit;
  const padY = 14 * unit;
  const gapInner = 22 * unit;
  const gapRows = 16 * unit;
  return { letterD, padX, padY, gapInner, gapRows };
};

/** Chiều rộng còn lại cho chữ lựa chọn trong hàng rộng `rowW` (chừa chỗ ✓ bên phải). */
/** Bề rộng trung bình một ký tự (theo cỡ chữ) của chữ lựa chọn weight 700 — đo từ still "Do you have a reservation?". */
export const CHOICE_CHAR_W = 0.5;

export const choiceTextWidth = (rowW: number, fontSize: number, unit: number) => {
  const m = choiceMetrics(fontSize, unit);
  return rowW - m.padX * 2 - m.letterD - m.gapInner * 2 - m.letterD * 0.55;
};

/**
 * Danh sách lựa chọn A/B/C trên thẻ câu hỏi. Mỗi hàng nảy vào lúc giọng đọc tới nó; tới revealFrame
 * hàng đúng chuyển xanh + ✓ và nhún, hàng sai mờ đi (không lật thẻ — người xem thấy ngay mình chọn đúng chưa).
 */
export const OptionRows: React.FC<{ info: SceneInfo; accent: string; fontSize: number }> = ({ info, accent, fontSize }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pal = paletteFrom(accent);
  const m = choiceMetrics(fontSize, unit);
  const reveal = info.revealFrame;
  // So frame thay vì r > 0: EASE_BACK(0) ra ~2e-16 do sai số, sẽ lộ đáp án sớm.
  const revealed = reveal !== null && frame >= reveal;
  const r = revealed ? ramp(frame, reveal, 12) : 0;
  const pop = reveal === null ? 0 : Math.sin(Math.min(1, Math.max(0, (frame - reveal) / 14)) * Math.PI);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m.gapRows, width: "100%" }}>
      {info.options.map((o, k) => {
        const inP = ramp(frame, o.frame, 12, EASE_BACK);
        const good = o.correct && revealed;
        const dim = !o.correct && revealed;
        return (
          <div
            key={k}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: m.gapInner,
              padding: `${m.padY}px ${m.padX}px`,
              paddingRight: m.padX + m.letterD * 0.55 + m.gapInner,
              borderRadius: m.letterD / 2 + m.padY,
              boxSizing: "border-box",
              backgroundColor: good ? GREEN : "#f3f0fc",
              backgroundImage: good ? `linear-gradient(160deg, #4ade80 0%, ${GREEN} 50%, ${GREEN_DARK} 100%)` : undefined,
              border: `${4 * unit}px solid ${good ? GREEN_DARK : "#e2dcf5"}`,
              boxShadow: good ? `0 ${6 * unit}px 0 #0f5f2c` : `0 ${5 * unit}px 0 #ddd6f1`,
              opacity: Math.min(1, inP * 2) * (dim ? interpolate(r, [0, 1], [1, 0.4], { extrapolateRight: "clamp" }) : 1),
              transform: `translateX(${(1 - inP) * 80 * unit}px) scale(${(0.9 + 0.1 * inP) * (o.correct ? 1 + pop * 0.06 : 1)})`,
            }}
          >
            <div
              style={{
                flex: "none",
                width: m.letterD,
                height: m.letterD,
                borderRadius: "50%",
                backgroundColor: good ? "#ffffff" : dim ? "#b9b2cf" : pal.base,
                color: good ? GREEN_DARK : "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONTS.sans,
                fontWeight: 900,
                fontSize: fontSize * 0.95,
                lineHeight: 1,
              }}
            >
              {o.letter}
            </div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontWeight: 700,
                fontSize,
                lineHeight: 1.2,
                color: good ? "#ffffff" : INK,
                textAlign: "left",
                overflowWrap: "break-word",
                minWidth: 0,
                textDecoration: dim ? "line-through" : undefined,
                textDecorationThickness: dim ? 3 * unit : undefined,
                textDecorationColor: "rgba(29,23,64,0.45)",
              }}
            >
              {o.text}
            </div>
            {good ? (
              <svg
                width={m.letterD * 0.55}
                height={m.letterD * 0.55}
                viewBox="0 0 100 100"
                style={{ position: "absolute", right: m.padX, top: "50%", marginTop: -m.letterD * 0.275, overflow: "visible" }}
              >
                <path
                  d="M18 54 L42 76 L84 28"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={110}
                  strokeDashoffset={110 * (1 - ramp(frame, (reveal as number) + 4, 9))}
                />
              </svg>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

/** Bảng xếp loại cuối video: viên số câu (accent) + lời nhận xét, mỗi hàng nảy vào lúc được đọc. */
export const ScoreRows: React.FC<{ info: SceneInfo; accent: string; fontSize: number }> = ({ info, accent, fontSize }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pal = paletteFrom(accent);
  const m = choiceMetrics(fontSize, unit);
  const rangeW = Math.max(...info.scores.map((s) => [...s.range].length)) * fontSize * 0.56 + 40 * unit;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: m.gapRows, width: "100%" }}>
      {info.scores.map((s, k) => {
        const inP = ramp(frame, s.frame, 12, EASE_BACK);
        return (
          <div
            key={k}
            style={{
              display: "flex",
              alignItems: "center",
              gap: m.gapInner,
              padding: `${m.padY}px ${m.padX}px`,
              borderRadius: m.letterD / 2 + m.padY,
              backgroundColor: "#f3f0fc",
              border: `${4 * unit}px solid #e2dcf5`,
              opacity: Math.min(1, inP * 2),
              transform: `translateX(${(1 - inP) * 80 * unit}px) scale(${0.9 + 0.1 * inP})`,
            }}
          >
            <div
              style={{
                flex: "none",
                minWidth: rangeW,
                height: m.letterD,
                padding: `0 ${16 * unit}px`,
                boxSizing: "border-box",
                borderRadius: m.letterD,
                backgroundColor: k === 0 ? GREEN : pal.base,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONTS.sans,
                fontWeight: 900,
                fontSize: fontSize * 0.9,
                whiteSpace: "nowrap",
              }}
            >
              {s.range}
            </div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontWeight: 800,
                fontSize,
                lineHeight: 1.2,
                color: INK,
                textAlign: "left",
                minWidth: 0,
                overflowWrap: "break-word",
              }}
            >
              {s.verdict}
            </div>
          </div>
        );
      })}
    </div>
  );
};
