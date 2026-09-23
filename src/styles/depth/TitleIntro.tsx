import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { glyphs } from "../neon/neon";
import { useLayout } from "../shared";
import { BODY, clamp, extrude, HEAVY, rim, type Palette } from "./depth";
import { Space } from "./Space";
import { useShape } from "./Stage";

/**
 * Màn hình tiêu đề: khoảng không có sàn lưới và khối khung dây lớn; tiêu đề bay tới TỪNG CHỮ từ sâu -1400,
 * mỗi chữ xoay một góc rồi về thẳng; dòng phụ trượt lên, handle mờ ở đáy. 14 frame cuối cả khối lao qua camera
 * (sao và sàn tăng tốc) — đúng lúc tấm kính cảnh đầu bay tới.
 */
export const DepthTitle: React.FC<{ title: string; subtitle: string; handle: string; palette: Palette }> = ({
  title,
  subtitle,
  handle,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { unit, width, height, safe, fps } = useLayout();
  const { wide, square } = useShape();

  const words = title.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  const letterCount = Math.max(1, words.join("").length);
  const step = Math.min(1.6, 22 / letterCount);
  const length = [...title.trim()].length;
  const base = (wide ? 116 : square ? 110 : 132) * unit;
  const titleSize = Math.round(base * (length <= 14 ? 1 : Math.max(0.55, Math.sqrt(14 / length))));
  const subSize = (wide ? 40 : 44) * unit;
  const lettersDone = 6 + letterCount * step + 12;
  const sub = spring({ frame: frame - lettersDone, fps, config: { damping: 15 } });
  const dive = interpolate(frame, [TITLE_FRAMES - 14, TITLE_FRAMES], [0, 1], clamp);
  const rush = 1 + 5 * dive * dive;
  const boxWidth = wide ? width * 0.7 : width - safe.side * 2 + 40 * unit;

  let order = 0;
  return (
    <AbsoluteFill style={{ opacity: interpolate(dive, [0.6, 1], [1, 0], clamp) }}>
      <Space palette={palette} rush={rush} cubes="big" />
      <AbsoluteFill style={{ perspective: 1000 * unit, perspectiveOrigin: `50% ${height * 0.45}px` }}>
        <div
          style={{
            position: "absolute",
            left: (width - boxWidth) / 2,
            width: boxWidth,
            top: height * 0.45,
            translate: "0 -50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30 * unit,
            transformStyle: "preserve-3d",
            transform: `translateZ(${dive * dive * 900 * unit}px)`,
          }}
        >
          <div
            style={{
              fontFamily: HEAVY,
              fontWeight: 900,
              fontSize: titleSize,
              lineHeight: 1.12,
              textAlign: "center",
              color: "#ffffff",
              transformStyle: "preserve-3d",
            }}
          >
            {words.map((word, w) => (
              <span key={w} style={{ display: "inline-block", whiteSpace: "nowrap", transformStyle: "preserve-3d" }}>
                {glyphs(word).map((ch, c) => {
                  const at = 6 + Math.floor(order * step);
                  const i = order;
                  order += 1;
                  const fly = spring({ frame: frame - at, fps, config: { damping: 13, mass: 0.7 } });
                  const color = w === words.length - 1 ? palette.key : "#ffffff";
                  return (
                    <span
                      key={c}
                      style={{
                        display: "inline-block",
                        color,
                        WebkitTextStroke: rim(titleSize),
                        textShadow: extrude(palette.side, titleSize, 10, 0.7),
                        transform: `translateZ(${interpolate(fly, [0, 1], [-1400 * unit, 0])}px) rotateY(${interpolate(fly, [0, 1], [i % 2 ? 80 : -80, 0])}deg)`,
                        opacity: interpolate(fly, [0, 0.2], [0, 1], clamp),
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
                {w < words.length - 1 ? <span style={{ display: "inline-block", width: "0.28em" }} /> : null}
              </span>
            ))}
          </div>
          {subtitle.trim() ? (
            <div
              style={{
                fontFamily: BODY,
                fontWeight: 700,
                fontSize: subSize,
                lineHeight: 1.3,
                textAlign: "center",
                textWrap: "balance",
                color: "#dfe4ff",
                padding: `${10 * unit}px ${28 * unit}px`,
                borderRadius: 999,
                border: `${2 * unit}px solid ${palette.glow(0.7)}`,
                backgroundColor: "rgba(6,8,24,0.6)",
                boxShadow: `0 0 ${30 * unit}px ${palette.glow(0.35)}`,
                opacity: sub,
                translate: `0 ${interpolate(sub, [0, 1], [30 * unit, 0])}px`,
              }}
            >
              {subtitle.normalize("NFC").trim()}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      {handle.trim() ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: safe.bottom * 0.6,
            textAlign: "center",
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: 30 * unit,
            color: "rgba(230,235,255,0.8)",
            opacity: interpolate(frame, [lettersDone + 4, lettersDone + 14], [0, 1], clamp),
          }}
        >
          {handle.trim()}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
