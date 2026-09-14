import { useCurrentFrame } from "remotion";
import type { NewsLayout } from "./layout";
import { UPPER_LH } from "./layout";
import { EASE_OUT, FONT, MONO, measure, NAVY, NAVY_DEEP, RED, ramp, WHITE, withAlpha, YELLOW, INK } from "./theme";

/** Logo kênh (khối vuông màu accent) + nhãn ● TRỰC TIẾP nhấp nháy. */
export const StationBug: React.FC<{ L: NewsLayout; handle: string; accent: string }> = ({ L, handle, accent }) => {
  const frame = useCurrentFrame();
  const { unit, bugH } = L;
  const enter = ramp(frame, 0, 10);
  const logo = handle.trim() ? handle.trim().normalize("NFC") : "TIN";
  const logoPad = 14 * unit;
  const logoMaxW = 300 * unit;
  const logoFont = Math.min(bugH * 0.36, ((logoMaxW - logoPad * 2) * 0.95) / Math.max(1, measure(logo, 1, 900)));
  const logoW = Math.max(bugH, measure(logo, logoFont, 900) * 1.06 + logoPad * 2);
  const liveFont = Math.round(bugH * 0.32);
  const blinkOn = frame % 30 < 18;

  return (
    <div
      style={{
        position: "absolute",
        left: L.left,
        top: L.bugTop,
        height: bugH,
        display: "flex",
        alignItems: "center",
        gap: 14 * unit,
        opacity: enter,
        transform: `translateX(${(1 - enter) * -60 * unit}px)`,
      }}
    >
      <div
        style={{
          width: logoW,
          height: bugH,
          backgroundColor: accent,
          backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.18) 100%)",
          borderBottom: `${Math.max(2, 6 * unit)}px solid ${RED}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: logoFont,
          lineHeight: 1,
          color: WHITE,
          whiteSpace: "nowrap",
          boxShadow: `0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,0.45)`,
        }}
      >
        {logo}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10 * unit,
          height: liveFont * UPPER_LH + 12 * unit,
          padding: `0 ${16 * unit}px`,
          backgroundColor: RED,
          borderRadius: 6 * unit,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: liveFont,
          lineHeight: UPPER_LH,
          color: WHITE,
          whiteSpace: "nowrap",
          boxShadow: `0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,0.45)`,
        }}
      >
        <div
          style={{
            width: liveFont * 0.45,
            height: liveFont * 0.45,
            borderRadius: "50%",
            backgroundColor: WHITE,
            opacity: blinkOn ? 1 : 0.15,
          }}
        />
        TRỰC TIẾP
      </div>
    </div>
  );
};

/** Đồng hồ HH:MM bắt đầu 07:30 và chạy theo thời gian video; dấu hai chấm nhấp nháy. */
export const Clock: React.FC<{ L: NewsLayout }> = ({ L }) => {
  const frame = useCurrentFrame();
  const { unit, bugH, fps } = L;
  const enter = ramp(frame, 4, 10);
  const total = 7 * 3600 + 30 * 60 + Math.floor(frame / fps);
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const size = Math.round(bugH * 0.42);
  const colonOn = frame % 30 < 15;

  return (
    <div
      style={{
        position: "absolute",
        right: L.safe.side,
        top: L.bugTop + (bugH - (size * 1.2 + 14 * unit)) / 2,
        display: "flex",
        alignItems: "center",
        padding: `${7 * unit}px ${16 * unit}px`,
        backgroundColor: withAlpha(NAVY_DEEP, 0.82),
        borderLeft: `${Math.max(2, 6 * unit)}px solid ${RED}`,
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.2,
        color: WHITE,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "pre",
        opacity: enter,
        transform: `translateX(${(1 - enter) * 60 * unit}px)`,
        boxShadow: `0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,0.45)`,
      }}
    >
      {hh}
      <span style={{ opacity: colonOn ? 1 : 0.2 }}>:</span>
      {mm}
    </div>
  );
};

const SEP = " • ";

/**
 * Chữ chạy ở đáy vùng nội dung. Mỗi vòng là một ô rộng đúng bề rộng đo bằng canvas
 * (+ khoảng đệm), đặt tuyệt đối theo chu kỳ → lặp liền mạch dù đo lệch vài px.
 */
export const Ticker: React.FC<{ L: NewsLayout; items: string[]; accent: string }> = ({ L, items, accent }) => {
  const frame = useCurrentFrame();
  const { unit, width, tickerH, tickerFont, tickerBottom } = L;
  const enter = ramp(frame, 0, 12, EASE_OUT);
  const text = items.join(SEP);
  const gapW = 90 * unit;
  const cycleW = Math.max(200 * unit, measure(text, tickerFont, 600) * 1.03 + gapW);
  const labelFont = Math.round(tickerFont * 0.95);
  const labelW = Math.round(measure("MỚI", labelFont, 900) * 1.08 + 32 * unit);
  const labelLeft = L.left;
  const stripLeft = labelLeft + labelW;
  const stripW = width - stripLeft;
  const speed = 3.4 * unit;
  const offset = (frame * speed) % cycleW;
  const count = Math.ceil(stripW / cycleW) + 1;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: tickerBottom,
        height: tickerH,
        transform: `translateY(${(1 - enter) * (tickerH + 20 * unit)}px)`,
        opacity: enter,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: withAlpha(NAVY, 0.94),
          borderTop: `${Math.max(2, 4 * unit)}px solid ${accent}`,
          boxSizing: "border-box",
        }}
      />
      <div style={{ position: "absolute", left: stripLeft, width: stripW, top: 0, bottom: 0, overflow: "hidden" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={`tick-${i}`}
            style={{
              position: "absolute",
              top: 0,
              height: tickerH,
              left: 24 * unit + i * cycleW - offset,
              width: cycleW,
              display: "flex",
              alignItems: "center",
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: tickerFont,
              lineHeight: 1.3,
              color: WHITE,
              whiteSpace: "pre",
            }}
          >
            {text}
            <span
              style={{
                position: "absolute",
                right: gapW / 2 - tickerFont * 0.2,
                color: YELLOW,
              }}
            >
              •
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: labelLeft,
          top: 0,
          height: tickerH,
          width: labelW,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: YELLOW,
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: labelFont,
          lineHeight: UPPER_LH,
          color: INK,
          boxShadow: `${8 * unit}px 0 ${14 * unit}px rgba(0,0,0,0.35)`,
        }}
      >
        MỚI
      </div>
      {/* Phần trái nhãn MỚI: khối đỏ nhỏ cho đầy mép */}
      <div style={{ position: "absolute", left: 0, top: 0, height: tickerH, width: labelLeft, backgroundColor: RED }} />
    </div>
  );
};
