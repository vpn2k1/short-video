/**
 * Màn mở đầu kiểu mở màn chương trình thể thao (70 frame): nền sân vận động, ba tấm chéo (accent → trắng → tối)
 * quét vào từ hai phía, tiêu đề là dòng tít trận đấu trên tấm tối, dòng "● TRỰC TIẾP · <dòng phụ>".
 * Lúc kết thúc, vệt sọc chéo đổi cảnh (StripeWipes ở index.tsx) quét qua che đường cắt sang cảnh 1.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useLayout } from "../shared";
import { Stadium } from "./Backdrop";
import { COND, DISPLAY, EASE_OUT, fitText, INK, LIVE_RED, ramp, upper } from "./theme";
import { useVt } from "../../i18n/video";

export const TitleIntro: React.FC<{ title: string; subtitle: string; accent: string }> = ({ title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const { width: W, height: H, unit: u, portrait, safe } = useLayout();
  const left = portrait ? 56 * u : safe.side;
  const contentW = portrait ? W - left - 56 * u : Math.min(W * 0.66, 1200 * u);
  const s = 30 * u; // độ xiên của các tấm

  const titleFit = fitText(title, (portrait ? 104 : 96) * u, contentW - 80 * u, 3, 0.46, 54 * u);
  const titleH = titleFit.lines * titleFit.size * 1.22 + 56 * u;
  const cy = H * (portrait ? 0.42 : 0.44);
  const panelTop = cy - titleH / 2;

  // Nhịp: tấm accent 0→12, tấm trắng 3→15, tấm tối 5→17, chữ tiêu đề 10→22, dòng TRỰC TIẾP 16→28.
  const pA = ramp(frame, 0, 12, EASE_OUT);
  const pW = ramp(frame, 3, 12, EASE_OUT);
  const pD = ramp(frame, 5, 12, EASE_OUT);
  const pT = ramp(frame, 10, 12, EASE_OUT);
  const pL = ramp(frame, 16, 12, EASE_OUT);
  const flare = 1 - ramp(frame, 0, 10);
  const blink = Math.floor(frame / 12) % 2 === 0;
  const drift = frame * 0.6 * u; // các tấm trôi chậm sau khi vào, cho khung không đứng hình

  const slab = (x: number, y: number, w: number, h: number, fill: string, key: string, extra?: React.CSSProperties) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: fill,
        clipPath: `polygon(${s}px 0, 100% 0, calc(100% - ${s}px) 100%, 0 100%)`,
        ...extra,
      }}
    />
  );

  const subText = subtitle.trim();
  const subFit = fitText(subText || " ", 34 * u, contentW - 260 * u, 2, 0.46, 24 * u);

  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      <Stadium accent={accent} id="title" push={frame / 70} />
      <AbsoluteFill style={{ backgroundColor: "rgba(4,6,12,0.35)" }} />
      {/* Ba tấm chéo quét vào: accent từ trái, trắng từ phải, tấm tối (nền tiêu đề) từ trái. */}
      {slab(-W + pA * (W + left - 40 * u) + drift, panelTop - 26 * u, contentW + 120 * u, titleH + 52 * u, accent, "a")}
      {slab(W - pW * (W - left - contentW + 30 * u) - drift, panelTop + titleH - 4 * u, 220 * u, 18 * u, "#ffffff", "w")}
      {slab(-W + pD * (W + left), panelTop, contentW, titleH, INK, "d", { boxShadow: "0 0 0 transparent" })}
      {/* Vạch accent mảnh chạy dài xuyên khung phía trên tấm tiêu đề. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: panelTop - 60 * u,
          width: W * pA,
          height: 6 * u,
          background: `linear-gradient(90deg, transparent, ${accent} 30%, ${accent})`,
        }}
      />
      {/* Tiêu đề trận đấu. */}
      <div
        style={{
          position: "absolute",
          left: left + 44 * u,
          top: panelTop,
          width: contentW - 88 * u,
          height: titleH,
          display: "flex",
          alignItems: "center",
          clipPath: `inset(0px ${(1 - pT) * 100}% 0px 0px)`,
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: titleFit.size,
            lineHeight: 1.22,
            paddingTop: titleFit.size * 0.05,
            color: "#ffffff",
            translate: `${(1 - pT) * 60 * u}px 0px`,
            textWrap: "balance",
          }}
        >
          {title}
        </div>
      </div>
      {/* ● TRỰC TIẾP · dòng phụ */}
      <div
        style={{
          position: "absolute",
          left: left + 20 * u,
          top: panelTop + titleH + 34 * u,
          width: contentW,
          display: "flex",
          alignItems: "stretch",
          opacity: pL,
          translate: `${(1 - pL) * -50 * u}px 0px`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10 * u,
            backgroundColor: LIVE_RED,
            padding: `${10 * u}px ${22 * u}px`,
            clipPath: `polygon(${12 * u}px 0, 100% 0, calc(100% - ${12 * u}px) 100%, 0 100%)`,
            flexShrink: 0,
          }}
        >
          <div style={{ width: 14 * u, height: 14 * u, borderRadius: 99, backgroundColor: "#fff", opacity: blink ? 1 : 0.4 }} />
          <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 32 * u, lineHeight: 1.25, color: "#fff" }}>{vt("TRỰC TIẾP")}</div>
        </div>
        {subText ? (
          <div
            style={{
              marginLeft: -6 * u,
              backgroundColor: "rgba(255,255,255,0.95)",
              padding: `${10 * u}px ${28 * u}px ${10 * u}px ${24 * u}px`,
              clipPath: `polygon(${12 * u}px 0, 100% 0, calc(100% - ${12 * u}px) 100%, 0 100%)`,
              display: "flex",
              alignItems: "center",
              fontFamily: COND,
              fontWeight: 600,
              fontSize: subFit.size,
              lineHeight: 1.3,
              color: INK,
              maxWidth: contentW - 230 * u,
            }}
          >
            {subText}
          </div>
        ) : null}
      </div>
      {/* Nhãn lớn chìm phía trên: "TRẬN CẦU TÂM ĐIỂM" kiểu mở màn. */}
      <div
        style={{
          position: "absolute",
          left: left + 20 * u,
          top: panelTop - 60 * u - 58 * u,
          fontFamily: COND,
          fontWeight: 700,
          fontSize: 34 * u,
          lineHeight: 1.3,
          color: "#fff",
          opacity: pA,
          translate: `${(1 - pA) * -40 * u}px 0px`,
        }}
      >
        {upper(vt("Tâm điểm"))}
      </div>
      {/* Loé đèn pha lúc mở. */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: 0.55 * flare }} />
    </AbsoluteFill>
  );
};
