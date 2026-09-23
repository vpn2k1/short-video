/**
 * Đồ hoạ truyền hình cố định của phong cách "Thể thao": bảng tỉ số góc trên trái (đồng hồ trận,
 * chấm LIVE, vạch tiến độ), dải phụ đề nắp chéo hai đầu, ticker chữ chạy mảnh bên dưới.
 */
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import { barHeight, captionFit, LINE_HEIGHT, type SportLayout } from "./layout";
import { clockText, COND, EASE_OUT, INK, inkOn, LIVE_RED, PANEL, ramp, upper, withAlpha } from "./theme";

// ---------------------------------------------------------------------------
// Bảng tỉ số
// ---------------------------------------------------------------------------
export const ScoreBug: React.FC<{ L: SportLayout; title: string; accent: string; enter: number }> = ({
  L,
  title,
  accent,
  enter,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { u } = L;
  const p = ramp(frame, enter, 14, EASE_OUT);
  if (p <= 0) return null;
  const h = L.bug.h;
  const sk = 10 * u;
  // Đồng hồ trận chạy theo thời gian thật, bắt đầu ở một phút "giữa trận" cố định theo tiêu đề;
  // vạch dưới bảng là tiến độ video.
  const kickoff = 60 * Math.round(seeded(`kick-${title}`, 12, 74));
  const clock = clockText(kickoff + Math.max(0, frame - enter) / fps);
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
  const half = kickoff / 60 + frame / fps / 60 >= 45 ? "HIỆP 2" : "HIỆP 1";
  const blink = Math.floor(frame / 15) % 2 === 0;
  const cell: React.CSSProperties = {
    height: h,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `skewX(-${sk / u}deg)`,
  };
  const unskew: React.CSSProperties = { transform: `skewX(${sk / u}deg)`, display: "flex", alignItems: "center" };
  return (
    <div
      style={{
        position: "absolute",
        left: L.bug.x + 8 * u,
        top: L.bug.y,
        opacity: p,
        translate: `${(1 - p) * -60 * u}px 0px`,
        filter: `drop-shadow(0 ${6 * u}px ${14 * u}px rgba(0,0,0,0.5))`,
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ ...cell, backgroundColor: PANEL, padding: `0 ${22 * u}px`, borderTop: `${2 * u}px solid rgba(255,255,255,0.12)` }}>
          <div style={{ ...unskew, fontFamily: COND, fontWeight: 600, fontSize: 38 * u, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {clock}
          </div>
        </div>
        <div style={{ ...cell, backgroundColor: "#ffffff", padding: `0 ${18 * u}px` }}>
          <div style={{ ...unskew, gap: 9 * u }}>
            <div
              style={{
                width: 14 * u,
                height: 14 * u,
                borderRadius: 99,
                backgroundColor: LIVE_RED,
                opacity: blink ? 1 : 0.35,
                boxShadow: `0 0 ${10 * u}px ${LIVE_RED}`,
              }}
            />
            <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 28 * u, color: INK, lineHeight: 1 }}>LIVE</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 * u, marginTop: 6 * u, marginLeft: -4 * u }}>
        <div
          style={{
            fontFamily: COND,
            fontWeight: 600,
            fontSize: 20 * u,
            lineHeight: 1,
            color: "#fff",
            backgroundColor: withAlpha(INK, 0.85),
            padding: `${5 * u}px ${10 * u}px`,
            transform: `skewX(-${sk / u}deg)`,
          }}
        >
          <div style={{ transform: `skewX(${sk / u}deg)` }}>{half}</div>
        </div>
        <div style={{ width: 170 * u, height: 6 * u, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 3 * u, overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", backgroundColor: accent }} />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dải phụ đề (lower third)
// ---------------------------------------------------------------------------
/** Đa giác dải phụ đề: hai đầu cắt chéo song song. */
const slantPoly = (w: number, h: number, s: number) => `polygon(${s}px 0px, ${w}px 0px, ${w - s}px ${h}px, 0px ${h}px)`;

/** Tách câu thành các đoạn, đoạn trùng câu nhấn tô màu accent. Khoảng trắng nằm NGOÀI đoạn tô. */
const splitPunch = (text: string, punch: string | null): { t: string; hit: boolean }[] => {
  if (!punch) return [{ t: text, hit: false }];
  const at = text.toLocaleLowerCase("vi").indexOf(punch.toLocaleLowerCase("vi"));
  if (at < 0) return [{ t: text, hit: false }];
  return [
    { t: text.slice(0, at), hit: false },
    { t: text.slice(at, at + punch.length), hit: true },
    { t: text.slice(at + punch.length), hit: false },
  ].filter((p) => p.t.length > 0);
};

export const LowerThird: React.FC<{
  L: SportLayout;
  caption: Caption | null;
  index: number;
  startFrame: number;
  enter: number;
  accent: string;
  punch: string | null;
}> = ({ L, caption, index, startFrame, enter, accent, punch }) => {
  const frame = useCurrentFrame();
  const { u, bar } = L;
  if (!caption || frame < enter) return null;
  const h = barHeight(caption.text, L);
  // Cả dải quét vào từ trái một lần (lúc đồ hoạ lên sóng); mỗi câu mới chữ trồi lên từ dưới, nắp accent chớp sáng.
  const open = ramp(frame, enter, 12, EASE_OUT);
  const t0 = Math.max(startFrame, enter);
  const swap = ramp(frame, t0 - 2, 8, EASE_OUT);
  const flash = 1 - ramp(frame, t0, 10);
  const { size } = captionFit(caption.text, L);
  const top = bar.bottom - h;
  const s = bar.slant;
  const parts = splitPunch(caption.text, punch);
  return (
    <div style={{ position: "absolute", left: bar.x, top, width: bar.w, height: h, clipPath: `inset(0px ${(1 - open) * 100}% 0px 0px)` }}>
      {/* Bóng đổ dưới dải. */}
      <div style={{ position: "absolute", inset: 0, translate: `${6 * u}px ${8 * u}px`, backgroundColor: "rgba(0,0,0,0.45)", clipPath: slantPoly(bar.w, h, s) }} />
      {/* Thân dải tối, vạch sáng mảnh ở mép trên. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: slantPoly(bar.w, h, s),
          background: `linear-gradient(180deg, #1a2233 0%, ${INK} 100%)`,
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3 * u, backgroundColor: "rgba(255,255,255,0.18)" }} />
      </div>
      {/* Nắp chéo trái màu accent, chớp trắng khi đổi câu. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: bar.capL + s,
          height: h,
          clipPath: slantPoly(bar.capL + s, h, s),
          backgroundColor: accent,
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundColor: "#fff", opacity: 0.85 * flash }} />
      </div>
      {/* Nắp chéo phải trắng + vạch accent mảnh. */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: bar.capR + s,
          height: h,
          clipPath: slantPoly(bar.capR + s, h, s),
          backgroundColor: "#ffffff",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: bar.capR + s - 4 * u,
          top: 0,
          width: 10 * u + s,
          height: h,
          clipPath: slantPoly(10 * u + s, h, s),
          backgroundColor: accent,
        }}
      />
      {/* Chữ: Oswald đậm, giữ chữ thường (không in hoa câu dài). */}
      <div
        style={{
          position: "absolute",
          left: bar.capL + s + bar.padX,
          top: 0,
          width: bar.textW,
          height: h,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          key={index}
          style={{
            fontFamily: COND,
            fontWeight: 600,
            fontSize: size,
            lineHeight: LINE_HEIGHT,
            color: "#ffffff",
            opacity: swap,
            translate: `0px ${(1 - swap) * 0.6 * size}px`,
            textWrap: "balance",
          }}
        >
          {parts.map((p, i) =>
            p.hit ? (
              <span key={i} style={{ color: accent, fontWeight: 700 }}>
                {p.t}
              </span>
            ) : (
              <span key={i}>{p.t}</span>
            ),
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------
export const Ticker: React.FC<{ L: SportLayout; items: string[]; accent: string; enter: number }> = ({ L, items, accent, enter }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, bar, ticker } = L;
  const open = ramp(frame, enter + 4, 12, EASE_OUT);
  if (open <= 0 || items.length === 0) return null;
  const size = 24 * u;
  const label = "ĐIỂM TIN";
  const labelW = 150 * u;
  const text = items.map((t) => upper(t)).join("   •   ") + "   •   ";
  const speed = 3.2 * u;
  // Lặp chuỗi đủ dài cho cả video (ước bề rộng thấp tay để không bao giờ hụt chữ).
  const estW = Math.max(1, [...text].length * size * 0.36);
  const repeats = Math.max(2, Math.ceil((durationInFrames * speed + bar.w) / estW) + 1);
  const shift = Math.max(0, frame - enter) * speed;
  return (
    <div
      style={{
        position: "absolute",
        left: bar.x + bar.slant * 0.2,
        top: ticker.y + 4 * u,
        width: (bar.w - bar.slant * 0.4) * open,
        height: ticker.h - 4 * u,
        backgroundColor: withAlpha("#ffffff", 0.94),
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div style={{ position: "absolute", left: labelW, top: 0, bottom: 0, right: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 16 * u,
            top: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            translate: `${-shift}px 0px`,
            fontFamily: COND,
            fontWeight: 500,
            fontSize: size,
            lineHeight: 1.2,
            color: INK,
          }}
        >
          {text.repeat(repeats)}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: labelW,
          height: "100%",
          backgroundColor: accent,
          clipPath: `polygon(0 0, 100% 0, calc(100% - ${12 * u}px) 100%, 0 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: COND,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.2,
          color: inkOn(accent),
        }}
      >
        {label}
      </div>
    </div>
  );
};
