/**
 * Giao diện story quanh nội dung: thanh tiến độ chia đoạn, đầu story (avatar có vòng gradient, tên, "2 giờ",
 * ⋯ và ✕), thanh "Gửi tin nhắn" có tim và nút chia sẻ, tim bay, thanh trạng thái khi nằm trong điện thoại.
 * Biểu tượng vẽ bằng SVG kiểu chung chung — không mô phỏng logo mạng xã hội nào.
 * Mọi kích thước tính bằng px của canvas ảo (xem theme.ts).
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import { clamp, initialOf, punchFrame, ringGradient, UI, useGeo, VW } from "./theme";

/* ------------------------------------------------------------ biểu tượng */

type IconProps = { size: number; color?: string };

export const HeartIcon: React.FC<IconProps & { fill?: string }> = ({ size, color = "#fff", fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinejoin="round">
    <path d="M12 20.3s-7.6-4.6-9.5-9.3C1.1 7.5 3.4 4 7 4c2.1 0 3.6 1.1 5 2.9C13.4 5.1 14.9 4 17 4c3.6 0 5.9 3.5 4.5 7-1.9 4.7-9.5 9.3-9.5 9.3z" />
  </svg>
);

const SendIcon: React.FC<IconProps> = ({ size, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
    <path d="M21 3.5L3.5 10.2l7 2.8 2.8 7L21 3.5z" />
    <path d="M10.5 13L21 3.5" />
  </svg>
);

const MoreIcon: React.FC<IconProps> = ({ size, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

const CloseIcon: React.FC<IconProps> = ({ size, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
  </svg>
);

/* ------------------------------------------------------------ avatar */

/**
 * Avatar tròn: chữ cái đầu của tiêu đề trên nền màu nhấn, viền đen mảnh rồi vòng gradient story.
 * `spin` xoay vòng (lúc "đang tải" ở màn mở đầu), `ring` 0..1 để tắt dần vòng.
 */
export const Avatar: React.FC<{
  size: number;
  title: string;
  accent: string;
  spin?: number;
  ring?: number;
}> = ({ size, title, accent, spin = 0, ring = 1 }) => {
  const pad = Math.max(3, size * 0.06);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ringGradient(accent, 210 + spin), opacity: ring }} />
      <div
        style={{
          position: "absolute",
          inset: pad,
          borderRadius: "50%",
          background: "#111",
          padding: pad * 0.8,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), transparent 60%), ${accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: UI,
            fontWeight: 800,
            fontSize: size * 0.42,
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {initialOf(title)}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ thanh tiến độ + đầu story */

/**
 * Một đoạn cho mỗi cảnh: đoạn đã qua đầy, đoạn đang xem chạy dần theo thời lượng cảnh (tính tới lúc cảnh sau
 * bắt đầu để thanh không đứng yên trong khoảng lặng giữa hai cảnh), đoạn sau mờ.
 */
export const ProgressBars: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const geo = useGeo();
  const n = Math.max(1, scenes.length);
  const gap = n > 12 ? 4 : 7;
  return (
    <div style={{ position: "absolute", left: 22, right: 22, top: geo.top, height: 7, display: "flex", gap }}>
      {Array.from({ length: n }, (_, i) => {
        const start = scenes[i] ? msToFrames(scenes[i].startMs) : 0;
        const next = i + 1 < scenes.length ? msToFrames(scenes[i + 1].startMs) : Math.max(durationInFrames, start + 1);
        const end = Math.max(start + 1, next);
        const fill = interpolate(frame, [start, end], [0, 1], clamp);
        return (
          <div key={i} style={{ flex: 1, height: "100%", borderRadius: 4, background: "rgba(255,255,255,0.38)", overflow: "hidden" }}>
            <div style={{ width: `${fill * 100}%`, height: "100%", background: "#fff", borderRadius: 4 }} />
          </div>
        );
      })}
    </div>
  );
};

export const Header: React.FC<{ title: string; accent: string }> = ({ title, accent }) => {
  const geo = useGeo();
  return (
    <div
      style={{
        position: "absolute",
        left: 30,
        right: 26,
        top: geo.top + 26,
        height: 96,
        display: "flex",
        alignItems: "center",
        gap: 20,
        fontFamily: UI,
        color: "#fff",
        textShadow: "0 2px 10px rgba(0,0,0,0.35)",
      }}
    >
      <Avatar size={92} title={title} accent={accent} />
      <div style={{ fontSize: 38, fontWeight: 500, opacity: 0.72, whiteSpace: "nowrap" }}>2 giờ</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 30, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}>
        <MoreIcon size={58} />
        <CloseIcon size={56} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ thanh trả lời + tim bay */

const BAR_H = 112;
/** Tâm biểu tượng tim ở thanh trả lời (px ảo tính từ trái / từ đáy canvas). */
const heartAnchor = (bottom: number) => ({ x: VW - 170, y: bottom + BAR_H / 2 });

/** Các lượt tim bay: mỗi cảnh một chiếc lúc giữa cảnh, câu nhấn thêm một chùm 6 chiếc. */
const heartEvents = (scenes: Scene[], showTitle: boolean) => {
  const out: { at: number; key: string }[] = [];
  scenes.forEach((scene, i) => {
    const start = msToFrames(scene.startMs);
    const end = msToFrames(scene.endMs);
    if (end - start > 60) out.push({ at: Math.round(start + (end - start) * 0.55), key: `s${i}` });
    const p = punchFrame(scene, i, showTitle);
    if (p !== null) for (let k = 0; k < 6; k++) out.push({ at: p + 4 + k * 4, key: `p${i}-${k}` });
  });
  return out;
};

const HEART_LIFE = 56;

export const ReplyBar: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const geo = useGeo();
  const events = heartEvents(scenes, showTitle);
  // Tim ở thanh đập nhẹ mỗi khi có tim bay ra.
  const lastTap = events.reduce((m, e) => (e.at <= frame && e.at > m ? e.at : m), -999);
  const beat = interpolate(frame - lastTap, [0, 4, 10], [1.28, 1.12, 1], clamp);
  const tapped = frame - lastTap < 10;
  return (
    <div
        style={{
          position: "absolute",
          left: 34,
          right: 34,
          bottom: geo.bottom,
          height: BAR_H,
          display: "flex",
          alignItems: "center",
          gap: 34,
          fontFamily: UI,
        }}
      >
        <div
          style={{
            flex: 1,
            height: "100%",
            borderRadius: BAR_H / 2,
            border: "3px solid rgba(255,255,255,0.75)",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            fontSize: 38,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            background: "rgba(0,0,0,0.12)",
            textShadow: "0 1px 6px rgba(0,0,0,0.3)",
          }}
        >
          Gửi tin nhắn
        </div>
        <div style={{ display: "flex", scale: String(beat), filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}>
          <HeartIcon size={70} color={tapped ? "#ff3358" : "#fff"} fill={tapped ? "#ff3358" : "none"} />
        </div>
        <div style={{ display: "flex", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}>
          <SendIcon size={66} />
        </div>
      </div>
  );
};

/**
 * Tim bay lên từ biểu tượng tim của thanh trả lời. Vẽ DƯỚI các nhãn dán để tim không che chữ của nhãn thăm dò.
 */
export const FloatingHearts: React.FC<{ scenes: Scene[]; showTitle: boolean; accent: string }> = ({ scenes, showTitle, accent }) => {
  const frame = useCurrentFrame();
  const geo = useGeo();
  const live = heartEvents(scenes, showTitle).filter((e) => frame >= e.at && frame < e.at + HEART_LIFE);
  const anchor = heartAnchor(geo.bottom);
  return (
    <>
      {live.map((e) => {
        const t = frame - e.at;
        const rise = interpolate(t, [0, HEART_LIFE], [0, 1], clamp);
        const sway = Math.sin(t / 6 + seeded(`${e.key}-ph`, 0, 6)) * seeded(`${e.key}-sw`, 18, 42);
        const drift = seeded(`${e.key}-dx`, -90, 30) * rise;
        const size = seeded(`${e.key}-sz`, 58, 92);
        const colors = ["#ff3358", "#ff5fa2", accent, "#ff8a3d"];
        const color = colors[Math.floor(seeded(`${e.key}-c`, 0, colors.length - 0.001))];
        return (
          <div
            key={e.key}
            style={{
              position: "absolute",
              left: anchor.x - size / 2 + sway + drift,
              bottom: anchor.y - size / 2 + rise * seeded(`${e.key}-h`, 520, 760),
              opacity: interpolate(t, [0, 4, HEART_LIFE * 0.55, HEART_LIFE], [0, 1, 0.95, 0], clamp),
              scale: String(interpolate(t, [0, 8, HEART_LIFE], [0.3, 1.1, 0.85], clamp)),
              rotate: `${sway * 0.3}deg`,
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.25))",
              display: "flex",
            }}
          >
            <HeartIcon size={size} color={color} fill={color} />
          </div>
        );
      })}
    </>
  );
};

/* ------------------------------------------------------------ thanh trạng thái (chỉ trong điện thoại) */

export const StatusBar: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 64,
      right: 56,
      top: 22,
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontFamily: UI,
      fontWeight: 700,
      fontSize: 38,
      color: "#fff",
      textShadow: "0 1px 6px rgba(0,0,0,0.3)",
    }}
  >
    <span>20:26</span>
    <svg width={150} height={40} viewBox="0 0 150 40" fill="#fff">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 11} y={26 - i * 7} width={7} height={10 + i * 7} rx={2} />
      ))}
      <path d="M68 18a22 22 0 0 1 30 0l-3.4 3.6a17 17 0 0 0-23.2 0zM74.8 25a12 12 0 0 1 16.4 0L83 33z" />
      <rect x={106} y={9} width={36} height={22} rx={6} fill="none" stroke="#fff" strokeWidth={2.5} opacity={0.8} />
      <rect x={110} y={13} width={24} height={14} rx={3} />
      <rect x={144} y={16} width={3.5} height={8} rx={1.5} opacity={0.8} />
    </svg>
  </div>
);

/** Lớp tối mờ trên và dưới để giao diện trắng đọc được trên mọi ảnh. */
export const Scrims: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.18) 13%, transparent 24%, transparent 74%, rgba(0,0,0,0.22) 86%, rgba(0,0,0,0.55) 100%)",
      pointerEvents: "none",
    }}
  />
);
