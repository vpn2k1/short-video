/**
 * Màn hình tiêu đề game: phong cảnh pixel ban đêm, logo tiêu đề chữ khối rơi xuống nảy theo nấc, dòng phụ,
 * "▶ NHẤN START" nháy, "© handle" dưới đáy. Đặt trong <Sequence durationInFrames={TITLE_FRAMES}>;
 * màn tan điểm ảnh sang game nằm ở index.tsx.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useLayout } from "../shared";
import { Landscape, Sparkle } from "./parts";
import { BLOCK, clamp, GOLD, hardOutline, INK, onTwos, pixelOf, snap, TEXT, upperVi, WHITE } from "./pixel";

export const TitleScreen: React.FC<{ title: string; subtitle: string; handle: string; accent: string }> = ({ title, subtitle, handle, accent }) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit } = useLayout();
  const P = pixelOf(unit);
  const wide = width / height > 1.2;
  const maxW = wide ? width * 0.7 : width - safe.side * 1.4;

  const label = upperVi(title);
  const chars = [...label].length;
  // Bungee ~0.8em mỗi ký tự; tối đa 3 dòng.
  let size = (wide ? 120 : 128) * unit;
  while (Math.ceil((chars * size * 0.8) / maxW) > 3 && size > 48 * unit) size *= 0.92;

  const f = onTwos(frame);
  const drop = snap(interpolate(f, [2, 12, 16, 20], [-height * 0.5, P * 4, -P * 2, 0], clamp), P);
  const subIn = f >= 20;
  const startOn = frame >= 26 && Math.floor(frame / 8) % 2 === 0;
  const showSub = subtitle && subtitle.normalize("NFC") !== title.normalize("NFC");

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Landscape w={width} h={height} variant={2} frame={frame} seed="px-title" unit={unit} starMax={wide ? 0.16 : 0.2} />
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(180deg, rgba(5,6,15,0.55) 0%, rgba(5,6,15,0.15) 55%, rgba(5,6,15,0.5) 100%)" }} />
      {[0, 1, 2, 3].map((i) => {
        const on = (Math.floor(frame / 6) + i) % 3 !== 0 && frame > 14;
        const sz = snap((i % 2 ? 36 : 54) * unit, P);
        const x = width * [0.16, 0.82, 0.24, 0.76][i];
        const y = height * (wide ? [0.2, 0.26, 0.62, 0.58] : [0.26, 0.3, 0.55, 0.52])[i];
        return on ? <Sparkle key={i} size={sz} color={i % 2 ? GOLD : accent} style={{ position: "absolute", left: x - sz / 2, top: y - sz / 2 }} /> : null;
      })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: height * 0.08 }}>
        <div
          style={{
            translate: `0 ${drop}px`,
            maxWidth: maxW,
            fontFamily: BLOCK,
            fontSize: size,
            // Bungee in hoa chồng dấu cao (Ể, Ắ): dòng thưa để dấu dòng dưới không lọt vào chân chữ dòng trên.
            lineHeight: 1.5,
            color: GOLD,
            textAlign: "center",
            textWrap: "balance",
            textShadow: `${hardOutline(P, INK, 0)}, ${P * 2}px ${P * 2}px 0 ${accent}, ${P * 3}px ${P * 3}px 0 ${accent}, ${P * 4}px ${P * 4}px 0 ${INK}`,
          }}
        >
          {label}
        </div>
        {showSub ? (
          <div
            style={{
              marginTop: P * 6,
              maxWidth: maxW,
              fontFamily: TEXT,
              fontWeight: 700,
              fontSize: 44 * unit,
              lineHeight: 1.3,
              color: WHITE,
              textAlign: "center",
              textWrap: "balance",
              padding: `${P * 1.5}px ${P * 3}px`,
              backgroundColor: "rgba(5,6,15,0.72)",
              opacity: subIn ? 1 : 0,
            }}
          >
            {subtitle.normalize("NFC")}
          </div>
        ) : null}
        <div
          style={{
            marginTop: P * 10,
            fontFamily: BLOCK,
            fontSize: 46 * unit,
            lineHeight: 1.3,
            color: WHITE,
            textShadow: hardOutline(Math.max(2, P * 0.6), INK, 1.5),
            opacity: startOn ? 1 : 0,
          }}
        >
          ▶ NHẤN START
        </div>
      </AbsoluteFill>
      {handle ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: safe.bottom + (wide ? 0 : 20 * unit),
            textAlign: "center",
            fontFamily: BLOCK,
            fontSize: 30 * unit,
            color: WHITE,
            textShadow: hardOutline(Math.max(2, P * 0.5), INK, 1),
            opacity: subIn ? 0.9 : 0,
          }}
        >
          © {upperVi(handle)}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
