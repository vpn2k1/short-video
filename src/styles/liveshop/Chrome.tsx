import { interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import { CartIcon, CloseIcon, CommentIcon, EyeIcon, HeartIcon, LikeIcon, PlusIcon, ShareIcon } from "./Icons";
import {
  alpha, clamp, formatCount, formatViewers, GOLD, inkOn, LIVE_RED, POP, shade, UI, viewerNames, viewersAt, type Geo,
} from "./live";
import { useVideoLanguage, useVt } from "../../i18n/video";

/** Ảnh đại diện chủ phòng: vòng tròn gradient accent, biểu tượng giỏ hàng, viền trắng. */
export const Avatar: React.FC<{ accent: string; size: number; ring?: number }> = ({ accent, size, ring = 3 }) => (
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
    <CartIcon size={size * 0.52} color={inkOn(accent)} />
  </div>
);

/**
 * Thanh chủ phòng góc trái trên: viên thuốc tối trong suốt (ảnh đại diện, lượt thích, nút "Theo dõi"),
 * nhãn LIVE đỏ có chấm nháy. Người xem nằm ở góc phải trên (ViewerBar) như live thật.
 */
export const TopBar: React.FC<{ geo: Geo; accent: string; appear: number; title: string }> = ({
  geo,
  accent,
  appear,
  title,
}) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const language = useVideoLanguage();
  const { u, side, top, topBarH, wide } = geo;
  const t = interpolate(frame, [appear, appear + 14], [0, 1], { ...clamp, easing: POP });
  const h = topBarH;
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
        <Avatar accent={accent} size={h - 14 * u} ring={3 * u} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 250 * u }}>
          <div style={{ fontWeight: 700, fontSize: small, lineHeight: 1.25, color: "#fff", whiteSpace: "nowrap" }}>
            {vt("{n} lượt thích", { n: formatCount(likes, language) })}
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
          {vt("Theo dõi")}
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
    </div>
  );
};

/** Mỗi bao lâu hàng avatar người xem đổi một người (frame). */
const VIEWER_SWAP = 70;

/**
 * Góc phải trên như live thật: hàng 3 avatar người xem (thỉnh thoảng có người mới vào thay chỗ, nảy lên), viên
 * đếm người xem có mắt — số đủ chữ số nhảy dần từ một số ngẫu nhiên — và nút đóng.
 */
export const ViewerBar: React.FC<{ geo: Geo; appear: number; title: string; bursts: number[] }> = ({
  geo,
  appear,
  title,
  bursts,
}) => {
  const frame = useCurrentFrame();
  const language = useVideoLanguage();
  const { u, side, top, topBarH, wide } = geo;
  const t = interpolate(frame, [appear + 2, appear + 16], [0, 1], { ...clamp, easing: POP });
  const h = topBarH * 0.52;
  const small = (wide ? 22 : 24) * u;
  const names = viewerNames(language);
  const key = title || "live";
  const slot = Math.floor(Math.max(0, frame) / VIEWER_SWAP);
  const since = Math.max(0, frame) - slot * VIEWER_SWAP;
  const count = viewersAt(frame, key, bursts);
  // Số vừa nhích lên thì viên đếm nảy nhẹ một nhịp.
  const bump = interpolate(Math.max(0, frame) % 6, [0, 2, 5], [1.06, 1, 1], clamp);
  const face = h * 1.08;
  return (
    <div
      style={{
        position: "absolute",
        right: side,
        top: top + (topBarH - h) / 2,
        height: h,
        display: "flex",
        alignItems: "center",
        gap: 12 * u,
        opacity: t,
        translate: `${(1 - t) * 40 * u}px 0px`,
        fontFamily: UI,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {[0, 1, 2].map((k) => {
          const name = names[Math.floor(seeded(`${key}-va-${slot + k}`, 0, names.length))];
          const hue = Math.floor(seeded(`${key}-h-${name}`, 0, 360));
          // Chỗ đầu tiên là người vừa vào: nảy lên mỗi lần hàng avatar đổi người.
          const pop = k === 0 ? interpolate(since, [0, 9], [0.2, 1], { ...clamp, easing: POP }) : 1;
          return (
            <div
              key={k}
              style={{
                width: face,
                height: face,
                marginLeft: k === 0 ? 0 : -face * 0.32,
                borderRadius: "50%",
                border: `${2.5 * u}px solid #fff`,
                boxSizing: "border-box",
                background: `linear-gradient(145deg, hsl(${hue}, 80%, 68%), hsl(${(hue + 40) % 360}, 70%, 48%))`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: face * 0.44,
                zIndex: 3 - k,
                scale: String(pop),
              }}
            >
              {[...name.normalize("NFC")][0]?.toLocaleUpperCase(language)}
            </div>
          );
        })}
      </div>
      <div
        style={{
          height: h,
          padding: `0 ${14 * u}px`,
          borderRadius: h / 2,
          display: "flex",
          alignItems: "center",
          gap: 8 * u,
          backgroundColor: "rgba(0,0,0,0.42)",
          color: "#fff",
          fontWeight: 700,
          fontSize: small,
          fontVariantNumeric: "tabular-nums",
          scale: String(bump),
        }}
      >
        <EyeIcon size={small * 1.1} color="#fff" />
        {formatViewers(count, language)}
      </div>
      <div style={{ display: "flex", filter: `drop-shadow(0 ${2 * u}px ${4 * u}px rgba(0,0,0,0.45))` }}>
        <CloseIcon size={h * 0.95} color="#fff" />
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
  const vt = useVt();
  const language = useVideoLanguage();
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
        label={formatCount(hearts, language)}
        icon={<div style={{ scale: String(beat), display: "flex" }}><HeartIcon size={glyph} color={LIVE_RED} /></div>}
      />
      <RailButton u={u} size={railIcon} label={formatCount(comments, language)} icon={<CommentIcon size={glyph} color="#fff" />} />
      <RailButton u={u} size={railIcon} label={vt("Chia sẻ")} icon={<ShareIcon size={glyph} color="#fff" />} />
      <RailButton
        u={u}
        size={railIcon}
        label={vt("Giỏ hàng")}
        badge={String(Math.max(1, products))}
        badgeColor={accent}
        icon={<CartIcon size={glyph} color={GOLD} />}
      />
    </div>
  );
};

const HEART_COLORS = [LIVE_RED, "#ff7eb3", GOLD, "#ff4d8d", "#ffffff", "#8a7dff"];
/** Emoji người xem thả kèm tim — như bảng cảm xúc của live thật. */
const EMOJIS = ["😍", "🔥", "👏", "🎉", "💯", "🥰", "😂", "🤩"];
/** Số frame một biểu tượng bay. */
const HEART_LIFE = 72;

/** Biểu tượng bay thứ `born`: phần lớn là tim, xen lượt thích (ngón cái) và emoji. */
const Reaction: React.FC<{ born: number; size: number; accent: string }> = ({ born, size, accent }) => {
  const r = seeded(`hk-${born}`);
  if (r < 0.12) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "linear-gradient(145deg, #4aa3ff, #1f6bff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `${size * 0.06}px solid #fff`,
          boxSizing: "border-box",
        }}
      >
        <LikeIcon size={size * 0.56} color="#fff" />
      </div>
    );
  }
  if (r < 0.3) {
    return <div style={{ fontSize: size * 0.9, lineHeight: 1 }}>{EMOJIS[Math.floor(seeded(`he-${born}`, 0, EMOJIS.length))]}</div>;
  }
  const color = born % 7 === 0 ? accent : HEART_COLORS[Math.floor(seeded(`hc-${born}`, 0, HEART_COLORS.length))];
  return <HeartIcon size={size} color={color} />;
};

/**
 * Tim, lượt thích và emoji bay lên từ nút tim: bình thường 5 frame một cái, 90 frame sau câu nhấn dồn 2 frame một
 * cái. Mỗi cái đung đưa theo sin lệch pha, phóng ra rồi mờ dần ở đoạn cuối.
 */
export const FloatingHearts: React.FC<{ geo: Geo; scenes: Scene[]; appear: number; accent: string }> = ({ geo, scenes, appear, accent }) => {
  const frame = useCurrentFrame();
  const { u } = geo;
  const origin = heartOrigin(geo);
  const bursts = scenes.filter((s) => s.punch).map((s) => msToFrames(s.punch!.atMs));
  const items: React.ReactNode[] = [];
  for (let born = Math.max(appear, frame - HEART_LIFE); born <= frame; born++) {
    const inBurst = bursts.some((b) => born >= b && born < b + 90);
    if (born % (inBurst ? 2 : 5) !== 0) continue;
    const age = frame - born;
    const p = age / HEART_LIFE;
    const size = seeded(`hs-${born}`, 34, 60) * u;
    const sway = Math.sin(age / 9 + seeded(`hp-${born}`, 0, 6.28)) * seeded(`ha-${born}`, 14, 34) * u;
    const drift = seeded(`hd-${born}`, -70, 20) * u * p;
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
        <Reaction born={born} size={size} accent={accent} />
      </div>,
    );
  }
  return <>{items}</>;
};

/** Một lượt chạm màn hình thả tim kéo dài bao lâu (frame). */
const TAP_LIFE = 34;

/**
 * Người xem chạm đúp màn hình: cứ 2–4 giây (sau câu nhấn dày hơn) một chùm 5–7 tim nảy ra từ một điểm ngẫu nhiên
 * giữa khung hình rồi bay tản lên, như live thật.
 */
export const TapHearts: React.FC<{ geo: Geo; scenes: Scene[]; appear: number; accent: string; title: string }> = ({
  geo,
  scenes,
  appear,
  accent,
  title,
}) => {
  const frame = useCurrentFrame();
  const { u, width, height } = geo;
  const bursts = scenes.filter((s) => s.punch).map((s) => msToFrames(s.punch!.atMs));
  const key = title || "live";
  // Mốc các lượt chạm tính dồn từ lúc giao diện live hiện — chỉ cần những lượt còn đang bay.
  const taps: number[] = [];
  let at = appear + Math.round(seeded(`${key}-tap0`, 20, 50));
  for (let i = 0; at <= frame && i < 2000; i++) {
    if (at > frame - TAP_LIFE) taps.push(at);
    const hot = bursts.some((b) => at >= b && at < b + 120);
    at += Math.round(hot ? seeded(`${key}-tapd-${i}`, 18, 34) : seeded(`${key}-tapd-${i}`, 60, 120));
  }
  return (
    <>
      {taps.map((born) => {
        const age = frame - born;
        const cx = seeded(`${key}-tx-${born}`, 0.28, 0.72) * width;
        const cy = seeded(`${key}-ty-${born}`, 0.3, 0.55) * height;
        const count = 5 + Math.floor(seeded(`${key}-tn-${born}`, 0, 3));
        return Array.from({ length: count }, (_, k) => {
          const angle = -Math.PI / 2 + (k - (count - 1) / 2) * 0.42 + seeded(`${key}-ta-${born}-${k}`, -0.15, 0.15);
          const dist = interpolate(age, [0, TAP_LIFE], [0, seeded(`${key}-td-${born}-${k}`, 90, 170) * u], { easing: POP });
          const size = (k === Math.floor(count / 2) ? 74 : seeded(`${key}-ts-${born}-${k}`, 38, 56)) * u;
          const color = k % 3 === 0 ? accent : HEART_COLORS[(born + k) % HEART_COLORS.length];
          return (
            <div
              key={`${born}-${k}`}
              style={{
                position: "absolute",
                left: cx + Math.cos(angle) * dist - size / 2,
                top: cy + Math.sin(angle) * dist - size / 2 - age * 1.2 * u,
                opacity: interpolate(age, [0, 3, TAP_LIFE * 0.6, TAP_LIFE], [0, 1, 1, 0], clamp),
                scale: String(interpolate(age, [0, 6, 10], [0.2, 1.25, 1], clamp)),
                rotate: `${(k - count / 2) * 9}deg`,
                filter: `drop-shadow(0 ${2 * u}px ${5 * u}px rgba(0,0,0,0.3))`,
              }}
            >
              <HeartIcon size={size} color={color} />
            </div>
          );
        });
      })}
    </>
  );
};
