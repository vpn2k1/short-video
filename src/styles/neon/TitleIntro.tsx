import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { useLayout } from "../shared";
import { BrickWall } from "./Backdrop";
import { clamp, core, deadTube, flicker, glyphs, hum, textGlow, TUBE, tubeBorder, type Palette } from "./neon";

/**
 * Màn hình tiêu đề: tường gạch tối, khung ống màu phụ rè lên trước, rồi tiêu đề thắp TỪNG CHỮ
 * (mỗi chữ chập chờn 5 frame), dòng phụ bật sau cùng. Cuối title cả biển mờ dần để lộ cảnh
 * đầu phía dưới.
 */
export const NeonTitle: React.FC<{ title: string; subtitle: string; palette: Palette }> = ({
  title,
  subtitle,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { unit, width, height, safe } = useLayout();
  const wide = width / height > 1.2;
  const square = !wide && height / width < 1.45;

  const chars = glyphs(title.trim());
  const visibleCount = Math.max(1, chars.filter((c) => c.trim()).length);
  // Thắp hết chữ trong ~26 frame, tối đa 2 frame mỗi chữ.
  const step = Math.min(2, 26 / visibleCount);
  const letterStart = 10;
  const lettersDone = letterStart + visibleCount * step + 5;

  const border = flicker(frame - 2, "neon-title-border", 9) * hum(frame, "neon-title-border");
  const subOn = Math.min(lettersDone + 2, TITLE_FRAMES - 22);
  const sub = flicker(frame - subOn, "neon-title-sub", 8) * hum(frame, "neon-title-sub");
  const out = interpolate(frame, [TITLE_FRAMES - 9, TITLE_FRAMES], [1, 0], clamp);

  const length = chars.length;
  const base = (wide ? 104 : square ? 96 : 112) * unit;
  const titleSize = Math.round(base * (length <= 14 ? 1 : Math.max(0.55, Math.sqrt(14 / length))));
  const subSize = (wide ? 42 : 44) * unit;
  const signWidth = wide ? width * 0.62 : width - safe.side * 2 + 40 * unit;
  const tH = palette.primary;
  const sH = palette.secondary;

  // Từng chữ có mốc bật riêng; khoảng trắng không cần thắp.
  let order = 0;
  const letters = chars.map((ch, i) => {
    if (!ch.trim()) return { ch, lit: 1, i };
    const at = letterStart + Math.floor(order * step);
    order += 1;
    return { ch, lit: flicker(frame - at, `neon-title-${i}`, 5) * hum(frame, "neon-title"), i };
  });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <BrickWall palette={palette} id="title" spill={0.25 + 0.75 * border} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: signWidth,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26 * unit,
            padding: `${46 * unit}px ${40 * unit}px ${52 * unit}px`,
            borderRadius: 48 * unit,
            backgroundColor: "rgba(8,4,18,0.45)",
            ...tubeBorder(sH, unit, 5, border),
          }}
        >
          <div
            style={{
              fontFamily: TUBE,
              fontWeight: 700,
              fontSize: titleSize,
              lineHeight: 1.28,
              textAlign: "center",
              textWrap: "balance",
            }}
          >
            {letters.map(({ ch, lit, i }) => (
              <span
                key={i}
                style={{
                  color: lit > 0.3 ? core(tH) : deadTube(tH),
                  textShadow: lit > 0.3 ? textGlow(tH, titleSize, lit) : "none",
                }}
              >
                {ch}
              </span>
            ))}
          </div>
          {subtitle.trim() ? (
            <div
              style={{
                fontFamily: TUBE,
                fontWeight: 700,
                fontSize: subSize,
                lineHeight: 1.3,
                textAlign: "center",
                textWrap: "balance",
                color: sub > 0.3 ? core(sH) : deadTube(sH),
                textShadow: sub > 0.3 ? textGlow(sH, subSize, sub) : "none",
              }}
            >
              {subtitle.normalize("NFC")}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
