import { interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import { CartIcon, CommentIcon, EyeIcon, HeartIcon, PlusIcon, ShareIcon } from "./Icons";
import {
  alpha, clamp, formatCount, GOLD, handleName, initialOf, inkOn, LIVE_RED, POP, shade, UI, viewersAt, type Geo,
} from "./live";

/** Ảnh đại diện chủ phòng: vòng tròn gradient accent, chữ cái đầu của handle, viền trắng. */
export const Avatar: React.FC<{ handle: string; accent: string; size: number; ring?: number }> = ({ handle, accent, size, ring = 3 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `linear-gradient(145deg, ${shade(accent, 0.25)} 0%, ${accent} 55%, ${shade(accent, -0.35)} 100%)`,
      border: `${ring}px solid #ffffff`,
      boxSizing: "border-box",
      fontFamily: UI,
      fontWeight: 800,
      fontSize: size * 0.46,
      lineHeight: 1,
      color: inkOn(accent),
    }}
  >
    {initialOf(handle)}
  </div>
);

/**
 * Thanh chủ phòng góc trái trên: viên thuốc tối trong suốt (ảnh đại diện, tên, lượt thích, nút "Theo dõi"),
 * nhãn LIVE đỏ có chấm nháy, số người xem tăng dần.
 */
export const TopBar: React.FC<{ geo: Geo; handle: string; accent: string; appear: number; title: string }> = ({
  geo,
  handle,
  accent,
  appear,
  title,
}) => {
  const frame = useCurrentFrame();
  const { u, side, top, topBarH, wide } = geo;
  const t = interpolate(frame, [appear, appear + 14], [0, 1], { ...clamp, easing: POP });
  const h = topBarH;
  const name = handleName(handle);
  const likes = 25_600 + Math.floor(seeded(`${title}-likes`, 0, 9000)) + Math.max(0, frame) * 3;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 9));
  const small = (wide ? 22 : 24) * u;
  return (
    <div
      style={{
        position: "absolute",
        left: side,
        top,
        display: "flex",
        alignItems: "center",
        gap: 14 * u,
        opacity: t,
        translate: `${(1 - t) * -40 * u}px 0px`,
        fontFamily: UI,
      }}
    >
      <div
        style={{
          height: h,
          display: "flex",
          alignItems: "center",
          gap: 14 * u,
          padding: `0 ${8 * u}px 0 ${7 * u}px`,
          borderRadius: h / 2,
          backgroundColor: "rgba(0,0,0,0.38)",
        }}
      >
        <Avatar handle={handle} accent={accent} size={h - 14 * u} ring={3 * u} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 250 * u }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: (wide ? 26 : 29) * u,
              lineHeight: 1.25,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div style={{ fontWeight: 500, fontSize: small * 0.9, lineHeight: 1.25, color: "rgba(255,255,255,0.78)", whiteSpace: "nowrap" }}>
            {formatCount(likes)} lượt thích
          </div>
        </div>
        <div
          style={{
            height: h - 26 * u,
            padding: `0 ${20 * u}px`,
            borderRadius: (h - 26 * u) / 2,
            display: "flex",
            alignItems: "center",
            gap: 6 * u,
            backgroundColor: accent,
            color: inkOn(accent),
            fontWeight: 700,
            fontSize: small,
            whiteSpace: "nowrap",
          }}
        >
          <PlusIcon size={small * 0.9} color={inkOn(accent)} />
          Theo dõi
        </div>
      </div>
      <div
        style={{
          height: h * 0.52,
          padding: `0 ${14 * u}px`,
          borderRadius: 10 * u,
          display: "flex",
          alignItems: "center",
          gap: 8 * u,
          background: `linear-gradient(90deg, ${LIVE_RED}, #ff5a3c)`,
          color: "#fff",
          fontWeight: 800,
          fontSize: small,
          letterSpacing: 1 * u,
          boxShadow: `0 ${4 * u}px ${14 * u}px ${alpha(LIVE_RED, 0.45)}`,
        }}
      >
        <div style={{ width: 11 * u, height: 11 * u, borderRadius: "50%", backgroundColor: "#fff", opacity: pulse }} />
        LIVE
      </div>
      <div
        style={{
          height: h * 0.52,
          padding: `0 ${14 * u}px`,
          borderRadius: 10 * u,
          display: "flex",
          alignItems: "center",
          gap: 8 * u,
          backgroundColor: "rgba(0,0,0,0.42)",
          color: "#fff",
          fontWeight: 700,
          fontSize: small,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <EyeIcon size={small * 1.1} color="#fff" />
        {formatCount(viewersAt(frame, title))}
      </div>
    </div>
  );
};

/** Một nút trên thanh hành động: icon có bóng đổ, số đếm bên dưới. */
const RailButton: React.FC<{ icon: React.ReactNode; label: string; size: number; u: number; badge?: string; badgeColor?: string }> = ({
  icon,
  label,
  size,
  u,
  badge,
  badgeColor,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 * u, position: "relative" }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        filter: `drop-shadow(0 ${2 * u}px ${6 * u}px rgba(0,0,0,0.35))`,
      }}
    >
      {icon}
    </div>
    {badge ? (
      <div
        style={{
          position: "absolute",
          right: -6 * u,
          top: -6 * u,
          minWidth: 30 * u,
          height: 30 * u,
          borderRadius: 15 * u,
          padding: `0 ${7 * u}px`,
          boxSizing: "border-box",
          backgroundColor: badgeColor,
          color: inkOn(badgeColor ?? "#000"),
          fontFamily: UI,
          fontWeight: 800,
          fontSize: 19 * u,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `${2 * u}px solid #fff`,
        }}
      >
        {badge}
      </div>
    ) : null}
    <div
      style={{
        fontFamily: UI,
        fontWeight: 700,
        fontSize: size * 0.3,
        lineHeight: 1.2,
        color: "#fff",
        textShadow: `0 ${1 * u}px ${4 * u}px rgba(0,0,0,0.6)`,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

/** Toạ độ tâm nút tim trên thanh hành động — tim bay lên từ đây. */
export const heartOrigin = (geo: Geo) => ({
  x: geo.width - geo.railRight - geo.railIcon / 2,
  y: geo.railBottom - geo.railGap * 4 + (geo.railGap - geo.railIcon) * 0.2 + geo.railIcon / 2,
});

/** Thanh hành động mép phải: tim (đếm tăng), bình luận, chia sẻ, giỏ hàng có số sản phẩm. */
export const Rail: React.FC<{ geo: Geo; accent: string; appear: number; title: string; products: number }> = ({
  geo,
  accent,
  appear,
  title,
  products,
}) => {
  const frame = useCurrentFrame();
  const { u, railIcon, railGap, railRight, railBottom } = geo;
  const t = interpolate(frame, [appear + 4, appear + 18], [0, 1], { ...clamp, easing: POP });
  const hearts = 48_300 + Math.floor(seeded(`${title}-hearts`, 0, 20_000)) + Math.max(0, frame) * 11;
  const comments = 1_200 + Math.floor(seeded(`${title}-cmt`, 0, 900)) + Math.floor(Math.max(0, frame) / 4);
  const beat = interpolate(frame % 24, [0, 5, 12], [1, 1.14, 1], clamp);
  const glyph = railIcon * 0.56;
  return (
    <div
      style={{
        position: "absolute",
        right: railRight,
        top: railBottom - railGap * 4 + (railGap - railIcon) * 0.2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: railIcon,
        height: railGap * 4,
        justifyContent: "space-between",
        opacity: t,
        translate: `${(1 - t) * 50 * u}px 0px`,
      }}
    >
      <RailButton
        u={u}
        size={railIcon}
        label={formatCount(hearts)}
        icon={<div style={{ scale: String(beat), display: "flex" }}><HeartIcon size={glyph} color={LIVE_RED} /></div>}
      />
      <RailButton u={u} size={railIcon} label={formatCount(comments)} icon={<CommentIcon size={glyph} color="#fff" />} />
      <RailButton u={u} size={railIcon} label="Chia sẻ" icon={<ShareIcon size={glyph} color="#fff" />} />
      <RailButton
        u={u}
        size={railIcon}
        label="Giỏ hàng"
        badge={String(Math.max(1, products))}
        badgeColor={accent}
        icon={<CartIcon size={glyph} color={GOLD} />}
      />
    </div>
  );
};

const HEART_COLORS = [LIVE_RED, "#ff7eb3", GOLD, "#ff4d8d", "#ffffff", "#8a7dff"];
/** Số frame một trái tim bay. */
const HEART_LIFE = 72;

/**
 * Tim bay lên từ nút tim: bình thường 6 frame một tim, 90 frame sau câu nhấn dồn 2 frame một tim.
 * Mỗi tim đung đưa theo sin lệch pha, phóng ra rồi mờ dần ở đoạn cuối.
 */
export const FloatingHearts: React.FC<{ geo: Geo; scenes: Scene[]; appear: number; accent: string }> = ({ geo, scenes, appear, accent }) => {
  const frame = useCurrentFrame();
  const { u } = geo;
  const origin = heartOrigin(geo);
  const bursts = scenes.filter((s) => s.punch).map((s) => msToFrames(s.punch!.atMs));
  const items: React.ReactNode[] = [];
  for (let born = Math.max(appear, frame - HEART_LIFE); born <= frame; born++) {
    const inBurst = bursts.some((b) => born >= b && born < b + 90);
    if (born % (inBurst ? 2 : 6) !== 0) continue;
    const age = frame - born;
    const p = age / HEART_LIFE;
    const size = seeded(`hs-${born}`, 34, 60) * u;
    const sway = Math.sin(age / 9 + seeded(`hp-${born}`, 0, 6.28)) * seeded(`ha-${born}`, 14, 34) * u;
    const drift = seeded(`hd-${born}`, -70, 20) * u * p;
    const color = born % 7 === 0 ? accent : HEART_COLORS[Math.floor(seeded(`hc-${born}`, 0, HEART_COLORS.length))];
    items.push(
      <div
        key={born}
        style={{
          position: "absolute",
          left: origin.x - size / 2 + sway + drift,
          top: origin.y - size / 2 - p * (geo.wide ? 420 : geo.square ? 380 : 560) * u,
          opacity: interpolate(p, [0, 0.08, 0.65, 1], [0, 1, 0.9, 0]),
          scale: String(interpolate(age, [0, 8], [0.3, 1], { ...clamp, easing: POP })),
          rotate: `${Math.sin(age / 14 + born) * 14}deg`,
          filter: `drop-shadow(0 ${2 * u}px ${4 * u}px rgba(0,0,0,0.25))`,
        }}
      >
        <HeartIcon size={size} color={color} />
      </div>,
    );
  }
  return <>{items}</>;
};
