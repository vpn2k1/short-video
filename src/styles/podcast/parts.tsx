/**
 * Các mảnh của thẻ tập podcast: nền phòng thu, biểu tượng, đầu thẻ, khung ảnh, sóng âm, thanh tiến độ,
 * bảng tên khách mời (tag) và thẻ con số (visual).
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { Grain } from "../shared";
import {
  alpha, barHeight, clamp, clock, CREAM, FAINT, LIVE_RED, mix, MUTED, SANS, STUDIO, upper, type Rect,
} from "./podcast";
import { useVt } from "../../i18n/video";

const POP = Easing.out(Easing.back(1.7));

// ---------------------------------------------------------------------------
// Nền phòng thu: gradient ấm, quầng màu nhấn phía sau thẻ, vệt đèn mờ, hạt nhiễu
// ---------------------------------------------------------------------------
export const Studio: React.FC<{ accent: string; level: number; glowAt: { x: number; y: number } }> = ({ accent, level, glowAt }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = Math.sin(frame / 90) * 3;
  return (
    <AbsoluteFill style={{ backgroundColor: STUDIO }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(ellipse 90% 60% at ${50 + drift}% 0%, #3a2418 0%, transparent 70%), linear-gradient(180deg, #221710 0%, ${STUDIO} 55%, #0d0907 100%)`,
        }}
      />
      {/* Quầng màu nhấn sau thẻ tập — sáng lên một chút khi đang nói. */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at ${(glowAt.x / width) * 100}% ${(glowAt.y / height) * 100}%, ${alpha(accent, 20 + level * 10)} 0%, transparent 55%)`,
        }}
      />
      {/* Vệt đèn phòng thu chéo từ góc trên. */}
      <AbsoluteFill
        style={{
          backgroundImage: "linear-gradient(115deg, transparent 30%, rgba(255, 210, 160, 0.05) 42%, transparent 56%)",
        }}
      />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <Grain opacity={0.1} baseFrequency={0.85} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Biểu tượng
// ---------------------------------------------------------------------------
export const MicIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
    <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill={color} />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const PlayIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill={color} />
  </svg>
);

export const BubbleIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" fill={color} />
  </svg>
);

// ---------------------------------------------------------------------------
// Đầu thẻ: ô micro + "PODCAST · TẬP 12" + "● ĐANG PHÁT"
// ---------------------------------------------------------------------------
export const Header: React.FC<{ rect: Rect; episode: number; accent: string; unit: number; compact: boolean }> = ({
  rect, episode, accent, unit, compact,
}) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const icon = rect.h * 0.86;
  // Chấm đỏ nhấp nháy mềm theo nhịp ~1 giây.
  const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos((frame / 30) * Math.PI * 2));
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "center", gap: 20 * unit }}>
      <div
        style={{
          width: icon,
          height: icon,
          flexShrink: 0,
          borderRadius: 22 * unit,
          backgroundImage: `linear-gradient(145deg, ${accent}, ${mix(accent, 55)})`,
          boxShadow: `0 ${6 * unit}px ${18 * unit}px ${alpha(accent, 35)}, inset 0 ${1.5 * unit}px 0 rgba(255,255,255,0.25)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MicIcon size={icon * 0.56} color="#ffffff" />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 800, fontSize: (compact ? 28 : 32) * unit, lineHeight: 1.2, color: CREAM, letterSpacing: 2 * unit, whiteSpace: "nowrap" }}>
        {compact ? null : upper("Podcast")}
        {compact ? null : <span style={{ color: alpha(accent, 90) }}> · </span>}
        {upper(vt("Tập {n}", { n: episode }))}
      </div>
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10 * unit,
          padding: compact ? `${8 * unit}px ${14 * unit}px` : `${10 * unit}px ${18 * unit}px`,
          borderRadius: 999,
          backgroundColor: "rgba(255, 59, 48, 0.12)",
          border: `${1.5 * unit}px solid rgba(255, 59, 48, 0.45)`,
        }}
      >
        <div
          style={{
            width: 14 * unit,
            height: 14 * unit,
            borderRadius: "50%",
            backgroundColor: LIVE_RED,
            opacity: blink,
            boxShadow: `0 0 ${10 * unit * blink}px ${LIVE_RED}`,
          }}
        />
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: (compact ? 19 : 22) * unit, lineHeight: 1.2, color: "#ffd9d6", letterSpacing: 1.5 * unit, whiteSpace: "nowrap" }}>
          {upper(compact ? "Live" : vt("Đang phát"))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Khung ảnh: ảnh/clip bo góc, phóng chậm; cảnh mới hoà vào đè cảnh cũ. Không ảnh → ảnh đại diện tròn có micro.
// ---------------------------------------------------------------------------
const AvatarPlaceholder: React.FC<{ rect: Rect; accent: string; level: number; unit: number }> = ({ rect, accent, level, unit }) => {
  const frame = useCurrentFrame();
  const d = Math.min(rect.w, rect.h) * 0.52;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle at 50% 45%, ${mix(accent, 32)} 0%, ${mix(accent, 12, "#1c130e")} 55%, #120c09 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Ba vòng sóng lan ra từ ảnh đại diện, to hơn khi đang nói. */}
      {[0, 1, 2].map((k) => {
        const t = ((frame + k * 20) % 60) / 60;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              width: d,
              height: d,
              borderRadius: "50%",
              border: `${3 * unit}px solid ${alpha(accent, 70)}`,
              scale: String(1 + t * (0.35 + level * 0.45)),
              opacity: (1 - t) * (0.15 + level * 0.6),
            }}
          />
        );
      })}
      <div
        style={{
          width: d,
          height: d,
          borderRadius: "50%",
          backgroundImage: `linear-gradient(145deg, ${accent}, ${mix(accent, 50)})`,
          boxShadow: `0 0 0 ${8 * unit}px rgba(255,244,234,0.08), 0 ${20 * unit}px ${50 * unit}px rgba(0,0,0,0.45)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: String(1 + level * 0.035),
        }}
      >
        <MicIcon size={d * 0.46} color="#ffffff" />
      </div>
    </div>
  );
};

const MediaLayer: React.FC<{ scene: Scene; rect: Rect; accent: string; level: number; unit: number; opacity: number; zoom: number }> = ({
  scene, rect, accent, level, unit, opacity, zoom,
}) => (
  <div style={{ position: "absolute", inset: 0, opacity }}>
    {scene.image ? (
      <SceneMedia scene={scene} from={msToFrames(scene.startMs)} zoom={zoom} />
    ) : (
      <AvatarPlaceholder rect={rect} accent={accent} level={level} unit={unit} />
    )}
  </div>
);

export const MediaFrame: React.FC<{
  rect: Rect; scene: Scene; prev: Scene | null; localFrame: number; durationFrames: number; accent: string; level: number; unit: number;
}> = ({ rect, scene, prev, localFrame, durationFrames, accent, level, unit }) => {
  const fade = prev ? interpolate(localFrame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const zoom = interpolate(localFrame, [0, Math.max(2, durationFrames)], [1.03, 1.1], clamp) + (1 - fade) * 0.04;
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: 34 * unit,
        overflow: "hidden",
        backgroundColor: "#1a120d",
        boxShadow: `0 ${14 * unit}px ${36 * unit}px rgba(0,0,0,0.45)`,
      }}
    >
      {prev && fade < 1 ? (
        <MediaLayer scene={prev} rect={rect} accent={accent} level={level} unit={unit} opacity={1} zoom={1.1} />
      ) : null}
      <MediaLayer scene={scene} rect={rect} accent={accent} level={level} unit={unit} opacity={fade} zoom={zoom} />
      {/* Ánh ấm + tối dần xuống đáy để bảng tên đọc rõ. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(180deg, rgba(20,14,11,0) 55%, rgba(20,14,11,0.7) 100%), linear-gradient(0deg, rgba(255,150,80,0.06), rgba(255,150,80,0.06))",
        }}
      />
      <div style={{ position: "absolute", inset: 0, borderRadius: 34 * unit, boxShadow: `inset 0 0 0 ${2 * unit}px rgba(255,244,234,0.1)` }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sóng âm: hàng cột đối xứng; cột đã phát (theo tiến độ video) màu nhấn, cột chưa phát kem mờ.
// ---------------------------------------------------------------------------
export const Waveform: React.FC<{ rect: Rect; level: number; progress: number; accent: string; unit: number }> = ({ rect, level, progress, accent, unit }) => {
  const frame = useCurrentFrame();
  const barW = 9 * unit;
  const n = Math.max(12, Math.floor((rect.w + barW * 0.9) / (barW * 1.9)));
  const step = (rect.w - barW) / (n - 1);
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      {Array.from({ length: n }, (_, i) => {
        const h = Math.max(barW, barHeight(i, n, frame, level) * rect.h);
        const played = (i + 0.5) / n <= progress;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * step,
              top: (rect.h - h) / 2,
              width: barW,
              height: h,
              borderRadius: barW,
              backgroundColor: played ? accent : "rgba(255, 236, 220, 0.3)",
              boxShadow: played && level > 0.3 ? `0 0 ${10 * unit}px ${alpha(accent, 45)}` : "none",
            }}
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thanh tiến độ: thời gian đã phát · thanh có nút kéo · tổng thời lượng
// ---------------------------------------------------------------------------
export const Scrubber: React.FC<{ rect: Rect; frame: number; accent: string; unit: number }> = ({ rect, frame, accent, unit }) => {
  const { durationInFrames, fps } = useVideoConfig();
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
  const timeSize = 24 * unit;
  const labelW = 74 * unit;
  const trackW = rect.w - labelW * 2 - 24 * unit;
  const knob = 22 * unit;
  const timeStyle = {
    width: labelW,
    fontFamily: SANS,
    fontWeight: 600,
    fontSize: timeSize,
    lineHeight: 1.2,
    color: MUTED,
    fontVariantNumeric: "tabular-nums",
  } as const;
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, display: "flex", alignItems: "center", gap: 12 * unit }}>
      <div style={{ ...timeStyle, textAlign: "left", color: CREAM }}>{clock(frame, fps)}</div>
      <div style={{ position: "relative", width: trackW, height: 8 * unit, borderRadius: 8 * unit, backgroundColor: FAINT }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: trackW * progress, borderRadius: 8 * unit, backgroundColor: accent }} />
        <div
          style={{
            position: "absolute",
            left: trackW * progress - knob / 2,
            top: 4 * unit - knob / 2,
            width: knob,
            height: knob,
            borderRadius: "50%",
            backgroundColor: CREAM,
            boxShadow: `0 0 0 ${5 * unit}px ${alpha(accent, 35)}, 0 ${3 * unit}px ${8 * unit}px rgba(0,0,0,0.4)`,
          }}
        />
      </div>
      <div style={{ ...timeStyle, textAlign: "right" }}>{clock(durationInFrames, fps)}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bảng tên (tag): "Khách mời: …" tách thành nhãn nhỏ + tên lớn; "Phần 2" thành một dòng chương.
// ---------------------------------------------------------------------------
export const TagPlate: React.FC<{ media: Rect; tag: string; localFrame: number; accent: string; unit: number }> = ({ media, tag, localFrame, accent, unit }) => {
  const text = tag.normalize("NFC").trim();
  const m = text.match(/^([^:]{1,18}):\s*(.+)$/);
  const label = m ? m[1].trim() : null;
  const name = m ? m[2].trim() : text;
  const t = interpolate(localFrame, [4, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const maxW = media.w - 56 * unit;
  const nameSize = Math.max(26 * unit, Math.min(40 * unit, (maxW - 60 * unit) / Math.max(6, [...name].length * 0.6)));
  return (
    <div
      style={{
        position: "absolute",
        left: media.x + 28 * unit,
        top: media.y + media.h - 28 * unit,
        translate: `${((1 - t) * -40 * unit).toFixed(1)}px -100%`,
        opacity: t,
        maxWidth: maxW,
        display: "flex",
        alignItems: "stretch",
        borderRadius: 18 * unit,
        overflow: "hidden",
        backgroundColor: "rgba(20, 14, 11, 0.78)",
        boxShadow: `0 ${8 * unit}px ${24 * unit}px rgba(0,0,0,0.4)`,
        border: `${1.5 * unit}px solid rgba(255,244,234,0.12)`,
      }}
    >
      <div style={{ width: 10 * unit, flexShrink: 0, backgroundColor: accent }} />
      <div style={{ padding: `${14 * unit}px ${24 * unit}px ${14 * unit}px ${20 * unit}px`, display: "flex", flexDirection: "column", gap: 4 * unit, minWidth: 0 }}>
        {label ? (
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 21 * unit, lineHeight: 1.25, color: mix(accent, 55, CREAM), letterSpacing: 1.5 * unit }}>
            {upper(label)}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: nameSize,
            lineHeight: 1.25,
            color: CREAM,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thẻ con số (visual): stat = số lớn màu nhấn + chú thích; badge = viên nhãn màu nhấn.
// ---------------------------------------------------------------------------
export const StatCard: React.FC<{ media: Rect; visual: NonNullable<Scene["visual"]>; localFrame: number; accent: string; unit: number }> = ({
  media, visual, localFrame, accent, unit,
}) => {
  const t = interpolate(localFrame, [8, 22], [0, 1], { ...clamp, easing: POP });
  const text = visual.text.normalize("NFC");
  const cap = visual.caption?.normalize("NFC") ?? null;
  const right = media.x + media.w - 24 * unit;
  const top = media.y + 24 * unit;
  if (visual.type === "badge") {
    return (
      <div
        style={{
          position: "absolute",
          left: right,
          top,
          translate: "-100% 0",
          scale: String(t),
          transformOrigin: "top right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8 * unit,
          maxWidth: media.w * 0.6,
        }}
      >
        <div
          style={{
            padding: `${12 * unit}px ${24 * unit}px`,
            borderRadius: 999,
            backgroundColor: accent,
            color: "#ffffff",
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 30 * unit,
            lineHeight: 1.25,
            boxShadow: `0 ${8 * unit}px ${22 * unit}px rgba(0,0,0,0.4)`,
            whiteSpace: "nowrap",
          }}
        >
          {upper(text)}
        </div>
        {cap ? (
          <div style={{ padding: `${8 * unit}px ${16 * unit}px`, borderRadius: 12 * unit, backgroundColor: "rgba(20,14,11,0.78)", color: CREAM, fontFamily: SANS, fontWeight: 600, fontSize: 22 * unit, lineHeight: 1.3, textAlign: "right" }}>
            {cap}
          </div>
        ) : null}
      </div>
    );
  }
  const numSize = Math.min(92 * unit, (media.w * 0.42) / Math.max(2, [...text].length * 0.6));
  return (
    <div
      style={{
        position: "absolute",
        left: right,
        top,
        translate: "-100% 0",
        scale: String(t),
        transformOrigin: "top right",
        minWidth: 200 * unit,
        maxWidth: media.w * 0.5,
        padding: `${18 * unit}px ${26 * unit}px ${20 * unit}px`,
        borderRadius: 26 * unit,
        backgroundColor: "rgba(20, 14, 11, 0.8)",
        border: `${1.5 * unit}px solid ${alpha(accent, 45)}`,
        boxShadow: `0 ${12 * unit}px ${30 * unit}px rgba(0,0,0,0.45)`,
        display: "flex",
        flexDirection: "column",
        gap: 4 * unit,
      }}
    >
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: numSize, lineHeight: 1.1, color: accent, letterSpacing: -numSize * 0.02, whiteSpace: "nowrap" }}>{text}</div>
      {cap ? (
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26 * unit, lineHeight: 1.3, color: "rgba(255, 236, 220, 0.75)" }}>{cap}</div>
      ) : null}
    </div>
  );
};
