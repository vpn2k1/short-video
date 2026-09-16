import { interpolate, useCurrentFrame } from "remotion";
import type { Caption, SceneVisual } from "../../compositions/Short/schema";
import { FONTS, useCaptionClock, useLayout } from "../shared";
import {
  EASE_BACK,
  EASE_OUT,
  GREEN,
  INK,
  hasEmoji,
  paletteFrom,
  parseStat,
  RED,
  ramp,
  upper,
  YELLOW,
  type SceneInfo,
} from "./theme";

/**
 * Hàng chấm tiến độ: mỗi câu một chấm, câu đã lật đáp án → chấm trắng đặc có ✓,
 * câu hiện tại → vòng trắng nhịp đập, câu sau → chấm mờ. Nối nhau bằng vạch mảnh.
 */
export const ProgressDots: React.FC<{
  infos: SceneInfo[];
  current: number;
  x: number;
  width: number;
  y: number;
  accent: string;
  opacity: number;
}> = ({ infos, current, x, width, y, accent, opacity }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const pal = paletteFrom(accent);
  const size = 38 * unit;
  const gap = 34 * unit;
  if (infos.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        width,
        top: y,
        height: size,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {infos.map((info, i) => {
        const answered =
          info.revealFrame !== null ? frame >= info.revealFrame : i < current;
        const fillP = info.revealFrame !== null ? ramp(frame, info.revealFrame, 10, EASE_BACK) : answered ? 1 : 0;
        const isCurrent = i === current && !answered;
        const pulse = isCurrent ? 1 + Math.sin(frame / 6) * 0.1 : 1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 ? (
              <div
                style={{
                  width: gap,
                  height: 5 * unit,
                  borderRadius: 5 * unit,
                  backgroundColor: i <= current ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                }}
              />
            ) : null}
            <div
              style={{
                position: "relative",
                width: size,
                height: size,
                borderRadius: "50%",
                boxSizing: "border-box",
                border: `${5 * unit}px solid ${i <= current ? "#ffffff" : "rgba(255,255,255,0.4)"}`,
                backgroundColor: i < current || isCurrent ? "rgba(255,255,255,0.18)" : "transparent",
                transform: `scale(${pulse})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: -5 * unit,
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  transform: `scale(${fillP})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 100 100">
                  <path d="M20 54 L42 74 L82 30" fill="none" stroke={pal.deep} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Sticker "% người trả lời sai": số lớn đỏ đếm lên, thanh meter, chú thích. Góc phải trên khung ảnh. */
export const StatSticker: React.FC<{ visual: SceneVisual; x: number; y: number; width: number; enter: number; opacity: number }> = ({
  visual,
  x,
  y,
  width,
  enter,
  opacity,
}) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const inP = ramp(frame, enter, 14, EASE_BACK);
  const count = ramp(frame, enter + 6, 36, EASE_OUT);
  const stat = parseStat(visual.text);
  const shown = stat ? `${stat.prefix}${stat.format(stat.value * count)}${stat.suffix}` : visual.text;
  const ratio = stat?.ratio ?? 1;
  const numSize = Math.min(96 * unit, (width - 50 * unit) / Math.max(2.2, [...visual.text].length * 0.62));
  const caption = visual.caption ?? "người trả lời sai";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        transform: `rotate(4deg) scale(${interpolate(inP, [0, 1], [0.3, 1])})`,
        transformOrigin: "80% 20%",
        opacity: Math.min(1, inP * 2) * opacity,
        backgroundColor: "#ffffff",
        borderRadius: 30 * unit,
        padding: `${16 * unit}px ${24 * unit}px ${20 * unit}px`,
        boxSizing: "border-box",
        boxShadow: `0 ${8 * unit}px 0 #d9d2f0, 0 ${24 * unit}px ${40 * unit}px -${14 * unit}px rgba(20,8,40,0.6)`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 900,
          fontSize: numSize,
          lineHeight: 1.05,
          color: RED,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {shown}
      </div>
      <div
        style={{
          marginTop: 10 * unit,
          height: 16 * unit,
          borderRadius: 16 * unit,
          backgroundColor: "rgba(34,197,94,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${ratio * count * 100}%`,
            height: "100%",
            borderRadius: 16 * unit,
            backgroundImage: `linear-gradient(90deg, #f97316, ${RED})`,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 10 * unit,
          fontFamily: FONTS.sans,
          fontWeight: 700,
          fontSize: 28 * unit,
          lineHeight: 1.2,
          color: INK,
        }}
      >
        {caption}
      </div>
    </div>
  );
};

/** Ruy băng "CÂU KHÓ 🔥" đỏ chéo ở góc trái trên khung ảnh; đuôi cắt chữ V. */
export const BadgeRibbon: React.FC<{ visual: SceneVisual; x: number; y: number; enter: number; opacity: number }> = ({
  visual,
  x,
  y,
  enter,
  opacity,
}) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const inP = ramp(frame, enter, 14, EASE_BACK);
  const text = upper(visual.text) + (hasEmoji(visual.text) ? "" : " 🔥");
  const h = 70 * unit;
  const wobble = Math.sin(frame / 10) * 1.5;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `rotate(${-7 + wobble}deg) translateX(${(1 - inP) * -120 * unit}px)`,
        opacity: Math.min(1, inP * 2) * opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", filter: `drop-shadow(0 ${10 * unit}px ${10 * unit}px rgba(40,0,10,0.4))` }}>
        <div
          style={{
            height: h,
            padding: `0 ${22 * unit}px 0 ${30 * unit}px`,
            display: "flex",
            alignItems: "center",
            backgroundImage: `linear-gradient(180deg, #ff6b6b 0%, ${RED} 55%, #c81e1e 100%)`,
            fontFamily: FONTS.sans,
            fontWeight: 900,
            fontSize: 36 * unit,
            color: "#ffffff",
            whiteSpace: "nowrap",
            textShadow: `0 ${3 * unit}px 0 rgba(120,0,0,0.35)`,
          }}
        >
          {text}
        </div>
        <svg width={h * 0.45} height={h} viewBox="0 0 45 100" preserveAspectRatio="none">
          <polygon points="0,0 45,0 12,50 45,100 0,100" fill="#dc2626" />
        </svg>
      </div>
      {visual.caption ? (
        <div
          style={{
            marginTop: 8 * unit,
            marginLeft: 14 * unit,
            padding: `${6 * unit}px ${16 * unit}px`,
            borderRadius: 14 * unit,
            backgroundColor: "rgba(20,8,40,0.7)",
            color: "#ffffff",
            fontFamily: FONTS.sans,
            fontWeight: 700,
            fontSize: 26 * unit,
          }}
        >
          {visual.caption}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Dải phụ đề cho các câu KHÔNG phải câu hỏi/đáp án (hook, dòng chờ, câu kết).
 * Câu đáp án bị ẩn để không lộ trước lúc lật thẻ.
 */
export const SubtitleStrip: React.FC<{
  captions: Caption[];
  hidden: Set<number>;
  cx: number;
  cy: number;
  maxWidth: number;
  fontSize: number;
  hideBefore: number;
}> = ({ captions, hidden, cx, cy, maxWidth, fontSize, hideBefore }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const { index, caption, localFrame } = useCaptionClock(captions);
  if (!caption || frame < hideBefore || hidden.has(index) || !caption.text.trim()) return null;
  const inP = ramp(localFrame, 0, 10, EASE_BACK);
  return (
    <div
      style={{
        position: "absolute",
        left: cx - maxWidth / 2,
        width: maxWidth,
        top: cy,
        transform: `translateY(-50%) scale(${interpolate(inP, [0, 1], [0.85, 1])})`,
        opacity: Math.min(1, inP * 2),
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        key={index}
        style={{
          maxWidth: "100%",
          boxSizing: "border-box",
          padding: `${16 * unit}px ${30 * unit}px`,
          borderRadius: 26 * unit,
          backgroundColor: "rgba(22,10,48,0.72)",
          border: `${3 * unit}px solid rgba(255,255,255,0.18)`,
          fontFamily: FONTS.sans,
          fontWeight: 700,
          fontSize,
          lineHeight: 1.28,
          color: "#ffffff",
          textAlign: "center",
          overflowWrap: "break-word",
        }}
      >
        {caption.text.trim()}
      </div>
    </div>
  );
};

/** Dải kêu gọi cuối video: "Bình luận số câu bạn đúng 👇" vàng, nảy nhẹ. */
export const EndStrip: React.FC<{ cx: number; cy: number; from: number; maxWidth: number }> = ({ cx, cy, from, maxWidth }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  if (frame < from) return null;
  const inP = ramp(frame, from, 16, EASE_BACK);
  const bounce = Math.abs(Math.sin((frame - from) / 7)) * 6 * unit;
  // Chữ không xuống dòng → co theo bề rộng được cấp (cột hẹp ở khung 1:1 từng tràn mép phải).
  const fontSize = Math.min(40 * unit, maxWidth / 17.5);
  return (
    <div
      style={{
        position: "absolute",
        left: cx - maxWidth / 2,
        width: maxWidth,
        top: cy,
        display: "flex",
        justifyContent: "center",
        transform: `translateY(calc(-50% + ${(1 - inP) * 60 * unit - bounce}px))`,
        opacity: Math.min(1, inP * 2),
      }}
    >
      <div
        style={{
          padding: `${14 * unit}px ${34 * unit}px`,
          borderRadius: 999,
          backgroundColor: YELLOW,
          boxShadow: `0 ${7 * unit}px 0 #c99a06, 0 ${20 * unit}px ${30 * unit}px -${10 * unit}px rgba(20,8,40,0.55)`,
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize,
          color: INK,
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: fontSize * 0.4,
        }}
      >
        Bình luận số câu bạn đúng
        {/* Emoji vàng trên nền vàng bị chìm — đặt trong đĩa tối riêng. */}
        <span
          style={{
            width: fontSize * 1.45,
            height: fontSize * 1.45,
            borderRadius: "50%",
            backgroundColor: INK,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fontSize * 0.85,
            transform: `translateY(${Math.sin((frame - from) / 4) * 3 * unit}px)`,
          }}
        >
          👇
        </span>
      </div>
    </div>
  );
};

/** Chớp sáng toàn khung lúc lật đáp án — ám xanh nhẹ, 9 frame. */
export const Flash: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 9) return null;
  const o = interpolate(t, [0, 2, 9], [0, 0.55, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle at 50% 55%, #ffffff 0%, rgba(255,255,255,0.85) 40%, ${GREEN} 140%)`,
        opacity: o,
      }}
    />
  );
};
