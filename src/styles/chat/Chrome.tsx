import { AbsoluteFill, Img, interpolate, spring, staticFile } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import type { Metrics } from "./model";
import { CHAT_FONT, withAlpha, type ChatTheme } from "./theme";

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

const initialOf = (name: string) => ([...name.normalize("NFC").trim()][0] ?? "?").toLocaleUpperCase("vi");

/** Nền ngoài điện thoại: ảnh của cảnh làm mờ tĩnh + tối đi, hoặc gradient từ background/accent. */
export const Backdrop: React.FC<{ scene: Scene | null; background: string; accent: string; theme: ChatTheme }> = ({
  scene,
  background,
  accent,
  theme,
}) => {
  const image = scene?.image && !VIDEO_EXT.test(scene.image) ? scene.image : null;
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(70% 55% at 20% 15%, ${withAlpha(accent, 0.35)} 0%, transparent 70%), radial-gradient(60% 50% at 85% 90%, ${withAlpha(theme.outgoing, 0.3)} 0%, transparent 70%)`,
        }}
      />
      {image ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={staticFile(image)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: `blur(40px) brightness(${theme.dark ? 0.5 : 0.8})`,
              transform: "scale(1.2)",
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const Icon: React.FC<{ size: number; color: string; children: React.ReactNode; stroke?: number }> = ({
  size,
  color,
  children,
  stroke = 2,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const Header: React.FC<{
  m: Metrics;
  theme: ChatTheme;
  accent: string;
  contact: string;
  group: boolean;
  height: number;
}> = ({ m, theme, accent, contact, group, height }) => {
  const avatar = 84 * m.u;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height,
        backgroundColor: theme.bar,
        borderBottom: `${Math.max(1, 1.5 * m.u)}px solid ${theme.hairline}`,
        display: "flex",
        alignItems: "center",
        padding: `0 ${22 * m.u}px`,
        gap: 18 * m.u,
        boxSizing: "border-box",
      }}
    >
      <Icon size={54 * m.u} color={theme.link} stroke={2.6}>
        <path d="M15 4 L7 12 L15 20" />
      </Icon>
      <div
        style={{
          width: avatar,
          height: avatar,
          borderRadius: "50%",
          flexShrink: 0,
          backgroundImage: `linear-gradient(160deg, ${withAlpha(accent, 0.85)}, ${accent})`,
          color: "#FFFFFF",
          fontSize: avatar * 0.46,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initialOf(contact)}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 * m.u }}>
        <div
          style={{
            fontSize: 36 * m.u,
            fontWeight: 700,
            color: theme.primaryText,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.25,
          }}
        >
          {contact}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 * m.u, fontSize: 25 * m.u, color: theme.secondary }}>
          <div style={{ width: 14 * m.u, height: 14 * m.u, borderRadius: "50%", backgroundColor: "#31D158" }} />
          {group ? "nhóm · đang hoạt động" : "đang hoạt động"}
        </div>
      </div>
      <Icon size={50 * m.u} color={theme.link}>
        <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
      </Icon>
      <Icon size={54 * m.u} color={theme.link}>
        <rect x="2" y="6" width="14" height="12" rx="3" />
        <path d="M16 10.5 L22 7 V17 L16 13.5" />
      </Icon>
    </div>
  );
};

export const Composer: React.FC<{ m: Metrics; theme: ChatTheme; height: number; typed: string | null; frame: number }> = ({
  m,
  theme,
  height,
  typed,
  frame,
}) => {
  const fieldH = 76 * m.u;
  const caret = Math.floor(frame / 8) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height,
        backgroundColor: theme.bar,
        borderTop: `${Math.max(1, 1.5 * m.u)}px solid ${theme.hairline}`,
        display: "flex",
        alignItems: "center",
        padding: `0 ${22 * m.u}px`,
        gap: 18 * m.u,
        boxSizing: "border-box",
      }}
    >
      <Icon size={58 * m.u} color={theme.secondary}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7v10M7 12h10" />
      </Icon>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: fieldH,
          borderRadius: fieldH / 2,
          backgroundColor: theme.field,
          border: `${Math.max(1, 2 * m.u)}px solid ${theme.fieldBorder}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: typed ? "flex-end" : "flex-start",
          padding: `0 ${26 * m.u}px`,
          fontSize: 32 * m.u,
          color: typed ? theme.primaryText : theme.secondary,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {typed ? (
          <span>
            {typed}
            <span style={{ color: theme.link, opacity: caret ? 1 : 0 }}>|</span>
          </span>
        ) : (
          "Tin nhắn"
        )}
      </div>
      {typed ? (
        <div
          style={{
            width: 62 * m.u,
            height: 62 * m.u,
            borderRadius: "50%",
            backgroundColor: theme.outgoing,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={40 * m.u} color="#FFFFFF" stroke={2.8}>
            <path d="M12 19V5M6 11l6-6 6 6" />
          </Icon>
        </div>
      ) : (
        <Icon size={56 * m.u} color={theme.secondary}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </Icon>
      )}
    </div>
  );
};

/** Title card: màn hình khoá, thông báo "Tin nhắn" trượt xuống, rồi mở vào cuộc trò chuyện. */
export const LockScreen: React.FC<{
  frame: number;
  fps: number;
  m: Metrics;
  theme: ChatTheme;
  title: string;
  subtitle: string;
  clock: string;
  scene: Scene | null;
  background: string;
  accent: string;
}> = ({ frame, fps, m, theme, title, subtitle, clock, scene, background, accent }) => {
  const out = interpolate(frame, [TITLE_FRAMES - 16, TITLE_FRAMES - 3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (out <= 0) return null;
  const drop = spring({ frame: frame - 12, fps, config: { damping: 16, stiffness: 140 } });
  const press = interpolate(frame, [44, 49, 54], [1, 0.965, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clockIn = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glass = theme.dark ? "rgba(44,44,48,0.88)" : "rgba(250,250,252,0.9)";
  const icon = 78 * m.u;
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: CHAT_FONT }}>
      <Backdrop scene={scene} background={background} accent={accent} theme={{ ...theme, dark: true }} />
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.25)" }} />
      <div
        style={{
          position: "absolute",
          top: 150 * m.u,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#FFFFFF",
          opacity: clockIn,
        }}
      >
        <div style={{ fontSize: 190 * m.u, fontWeight: 600, lineHeight: 1.1, letterSpacing: -4 * m.u }}>{clock}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 30 * m.u,
          right: 30 * m.u,
          top: 470 * m.u,
          padding: `${26 * m.u}px ${28 * m.u}px`,
          borderRadius: 44 * m.u,
          backgroundColor: glass,
          boxShadow: `0 ${20 * m.u}px ${50 * m.u}px rgba(0,0,0,0.35)`,
          display: "flex",
          gap: 24 * m.u,
          alignItems: "flex-start",
          opacity: interpolate(drop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${(1 - drop) * -420 * m.u}px) scale(${press})`,
        }}
      >
        <div
          style={{
            width: icon,
            height: icon,
            flexShrink: 0,
            borderRadius: icon * 0.24,
            backgroundImage: "linear-gradient(180deg, #5DF777 0%, #0ABD2C 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={icon * 0.62} height={icon * 0.62} viewBox="0 0 24 24">
            <path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.5 3.4 6L4.5 21l4.2-2.3c1 .3 2.1.4 3.3.4 5.5 0 10-3.6 10-8S17.5 3 12 3z" fill="#FFFFFF" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 * m.u, color: theme.secondary, lineHeight: 1.3 }}>
            <span>Tin nhắn</span>
            <span>bây giờ</span>
          </div>
          <div
            style={{
              fontSize: 36 * m.u,
              fontWeight: 700,
              color: theme.primaryText,
              lineHeight: 1.3,
              marginTop: 4 * m.u,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          {subtitle && subtitle !== title ? (
            <div
              style={{
                fontSize: 32 * m.u,
                color: theme.primaryText,
                opacity: 0.85,
                lineHeight: 1.32,
                marginTop: 2 * m.u,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
