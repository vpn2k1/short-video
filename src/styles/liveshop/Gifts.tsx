import { interpolate, useCurrentFrame } from "remotion";
import { alpha, clamp, GOLD, NUM, POP, SMOOTH, UI, type Geo, type GiftEvent } from "./live";

/** Một dải quà hiện bao lâu (frame) — đủ để số combo đếm hết rồi đứng lại một chút. */
const GIFT_LIFE = 96;
/** Số dải quà xếp chồng cùng lúc. */
const MAX_STACK = 2;
/** Combo nhảy một số mỗi chừng này frame. */
const COMBO_STEP = 5;

/**
 * Dải tặng quà như live thật: trượt vào từ mép trái ngay trên khung chat — avatar, tên người tặng, "đã tặng Hoa
 * hồng", emoji món quà to và số combo "x5" nảy lên mỗi lần tăng. Tối đa hai dải chồng nhau, dải cũ bị đẩy lên rồi mờ.
 */
export const GiftBanners: React.FC<{ geo: Geo; gifts: GiftEvent[]; bottom: number; appear: number; dim: number }> = ({
  geo,
  gifts,
  bottom,
  appear,
  dim,
}) => {
  const frame = useCurrentFrame();
  const { u, side, wide, square } = geo;
  const h = (wide ? 74 : square ? 70 : 84) * u;
  const gap = 14 * u;
  const live = gifts.filter((g) => g.at >= appear && frame >= g.at && frame < g.at + GIFT_LIFE).slice(-MAX_STACK);
  return (
    <div style={{ opacity: 1 - dim * 0.75 }}>
      {live.map((g, idx) => {
        const age = frame - g.at;
        const slot = live.length - 1 - idx;
        const enter = interpolate(age, [0, 10], [0, 1], { ...clamp, easing: SMOOTH });
        const fade = interpolate(age, [GIFT_LIFE - 12, GIFT_LIFE], [1, 0], clamp);
        const combo = Math.min(g.combo, 1 + Math.floor(Math.max(0, age - 8) / COMBO_STEP));
        const sinceBump = Math.max(0, age - 8) % COMBO_STEP;
        const bump = combo > 1 && combo <= g.combo && age < 8 + g.combo * COMBO_STEP
          ? interpolate(sinceBump, [0, 2, 5], [1.45, 1.1, 1], clamp)
          : 1;
        const face = h - 14 * u;
        return (
          <div
            key={`${g.at}-${g.name}`}
            style={{
              position: "absolute",
              left: side,
              top: bottom - h - slot * (h + gap),
              height: h,
              display: "flex",
              alignItems: "center",
              gap: 10 * u,
              opacity: enter * fade,
              translate: `${(1 - enter) * -260 * u}px 0px`,
              fontFamily: UI,
            }}
          >
            <div
              style={{
                height: h,
                display: "flex",
                alignItems: "center",
                gap: 12 * u,
                padding: `0 ${h * 1.02}px 0 ${7 * u}px`,
                borderRadius: h / 2,
                background: `linear-gradient(90deg, ${alpha("#ff3d7f", 0.85)} 0%, ${alpha("#ff8a3d", 0.55)} 70%, rgba(255,138,61,0) 100%)`,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: face,
                  height: face,
                  borderRadius: "50%",
                  border: `${2.5 * u}px solid #fff`,
                  boxSizing: "border-box",
                  background: `linear-gradient(145deg, hsl(${g.hue}, 80%, 68%), hsl(${(g.hue + 40) % 360}, 70%, 48%))`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: face * 0.44,
                  flexShrink: 0,
                }}
              >
                {[...g.name.normalize("NFC")][0]?.toLocaleUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1.2 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: h * 0.3, whiteSpace: "nowrap" }}>{g.name}</div>
                <div style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600, fontSize: h * 0.25, whiteSpace: "nowrap" }}>
                  {g.verb} {g.gift.name}
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  right: h * 0.02,
                  fontSize: h * 0.92,
                  lineHeight: 1,
                  filter: `drop-shadow(0 ${3 * u}px ${6 * u}px rgba(0,0,0,0.35))`,
                  scale: String(interpolate(age, [2, 12], [0.3, 1], { ...clamp, easing: POP })),
                }}
              >
                {g.gift.emoji}
              </div>
            </div>
            <div
              style={{
                marginLeft: h * 0.2,
                fontFamily: NUM,
                fontStyle: "italic",
                fontWeight: 900,
                fontSize: h * 0.62,
                color: GOLD,
                WebkitTextStroke: `${2 * u}px #7a3b00`,
                textShadow: `0 ${3 * u}px ${8 * u}px rgba(0,0,0,0.45)`,
                scale: String(bump),
                transformOrigin: "left center",
                whiteSpace: "nowrap",
              }}
            >
              x{combo}
            </div>
          </div>
        );
      })}
    </div>
  );
};
