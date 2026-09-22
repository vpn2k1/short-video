import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { fitFontSize, useLayout } from "../shared";
import { MicIcon, PlayIcon } from "./parts";
import { alpha, barHeight, clamp, CREAM, mix, MUTED, SANS, showName, STUDIO, upper } from "./podcast";

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/**
 * Màn tiêu đề: ô bìa podcast vuông (ảnh cảnh đầu tiên ám màu nhấn, hoặc gradient có vòng sóng) với nhãn
 * "PODCAST · TẬP n", tiêu đề lớn, dòng phụ, handle; dưới bìa là nút "▶ Nghe ngay" và một hàng sóng nhỏ.
 * Bìa phóng vào, nút bật lên, frame ~46 nút bị "bấm" (lún xuống), rồi bìa lùi ra và mờ để lộ thẻ tập.
 */
export const PodcastTitle: React.FC<{
  title: string; subtitle: string; handle: string; accent: string; coverImage: string | null; episode: number;
}> = ({ title, subtitle, handle, accent, coverImage, episode }) => {
  const frame = useCurrentFrame();
  const { width, height, unit, safe } = useLayout();
  const wide = width / height > 1.2;
  const square = !wide && height / width < 1.2;

  const tile = wide || square
    ? Math.min(height - safe.top - safe.bottom - 170 * unit, width * 0.5)
    : Math.min(width - safe.side * 2 + 60 * unit, height * 0.46);
  const enter = interpolate(frame, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const button = interpolate(frame, [16, 28], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
  // Nút "bấm": lún xuống rồi nảy lại.
  const press = interpolate(frame, [44, 48, 54], [1, 0.9, 1], clamp);
  const out = interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES], [1, 0], clamp);
  const outScale = interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES], [1, 1.08], { ...clamp, easing: Easing.in(Easing.cubic) });

  const cleanTitle = title.normalize("NFC").trim();
  const titleSize = fitFontSize(cleanTitle, tile * 0.13, 0.5);
  const pad = tile * 0.08;
  const image = coverImage && !VIDEO_EXT.test(coverImage) ? coverImage : null;
  const name = showName(handle);
  const bars = 22;

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill
        style={{
          backgroundColor: STUDIO,
          backgroundImage: `radial-gradient(circle at 50% 42%, ${alpha(accent, 28)} 0%, transparent 60%), linear-gradient(180deg, #221710, ${STUDIO})`,
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 44 * unit, scale: String(outScale) }}>
        {/* Ô bìa podcast vuông. */}
        <div
          style={{
            position: "relative",
            width: tile,
            height: tile,
            borderRadius: tile * 0.07,
            overflow: "hidden",
            backgroundImage: `linear-gradient(150deg, ${accent} 0%, ${mix(accent, 45)} 70%, ${mix(accent, 20)} 100%)`,
            boxShadow: `0 ${30 * unit}px ${70 * unit}px rgba(0,0,0,0.55), 0 0 0 ${2 * unit}px rgba(255,244,234,0.08)`,
            scale: String(interpolate(enter, [0, 1], [0.86, 1])),
            translate: `0 ${((1 - enter) * 40 * unit).toFixed(1)}px`,
            opacity: enter,
          }}
        >
          {image ? (
            <>
              <Img
                src={staticFile(image)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.4) contrast(1.05)", scale: String(1.04 + frame * 0.0012) }}
              />
              <div style={{ position: "absolute", inset: 0, backgroundColor: accent, mixBlendMode: "multiply", opacity: 0.55 }} />
            </>
          ) : null}
          {/* Vòng sóng đồng tâm ở góc trên phải — hoạ tiết bìa podcast. */}
          <svg width={tile} height={tile} style={{ position: "absolute", inset: 0 }}>
            {[0.18, 0.3, 0.42, 0.54].map((r, i) => (
              <circle key={i} cx={tile * 0.86} cy={tile * 0.16} r={tile * r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={tile * 0.012} />
            ))}
          </svg>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(10,6,4,0.1) 30%, rgba(10,6,4,0.78) 100%)" }} />
          <div style={{ position: "absolute", left: pad, top: pad, display: "flex", alignItems: "center", gap: tile * 0.025 }}>
            <div style={{ width: tile * 0.1, height: tile * 0.1, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MicIcon size={tile * 0.058} color="#ffffff" />
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: tile * 0.04, lineHeight: 1.2, color: "#ffffff", letterSpacing: tile * 0.006 }}>
              {upper(`Podcast · Tập ${episode}`)}
            </div>
          </div>
          <div style={{ position: "absolute", left: pad, right: pad, bottom: pad, display: "flex", flexDirection: "column", gap: tile * 0.025 }}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: titleSize,
                lineHeight: 1.22,
                color: "#ffffff",
                textWrap: "balance",
                textShadow: `0 ${3 * unit}px ${16 * unit}px rgba(0,0,0,0.35)`,
                letterSpacing: -titleSize * 0.01,
              }}
            >
              {cleanTitle}
            </div>
            {subtitle.trim() ? (
              <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: tile * 0.045, lineHeight: 1.35, color: "rgba(255,255,255,0.86)" }}>
                {subtitle.normalize("NFC").trim()}
              </div>
            ) : null}
            <div style={{ width: tile * 0.14, height: tile * 0.008, borderRadius: 99, backgroundColor: "#ffffff", opacity: 0.7, marginTop: tile * 0.01 }} />
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: tile * 0.04, lineHeight: 1.25, color: "#ffffff", opacity: 0.9 }}>{name}</div>
          </div>
        </div>
        {/* Nút "Nghe ngay" + hàng sóng nhỏ. */}
        <div style={{ display: "flex", alignItems: "center", gap: 30 * unit, opacity: button, scale: String(0.7 + 0.3 * button) }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16 * unit,
              padding: `${20 * unit}px ${40 * unit}px ${20 * unit}px ${30 * unit}px`,
              borderRadius: 999,
              backgroundColor: accent,
              boxShadow: `0 ${12 * unit}px ${30 * unit}px ${alpha(accent, 45)}`,
              scale: String(press),
            }}
          >
            <div style={{ width: 52 * unit, height: 52 * unit, borderRadius: "50%", backgroundColor: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PlayIcon size={30 * unit} color={accent} />
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 38 * unit, lineHeight: 1.2, color: "#ffffff" }}>Nghe ngay</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 * unit, height: 70 * unit }}>
            {Array.from({ length: bars }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 6 * unit,
                  height: Math.max(6 * unit, barHeight(i, bars, frame, frame > 46 ? 0.9 : 0.25) * 70 * unit),
                  borderRadius: 6 * unit,
                  backgroundColor: i / bars < (frame - 46) / 30 ? accent : MUTED,
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24 * unit, color: CREAM, opacity: 0.5 * button, letterSpacing: 3 * unit, marginTop: -20 * unit }}>
          {upper("Tập mới · Nghe cùng")} {name}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
