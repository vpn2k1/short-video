/**
 * Hộp thoại RPG: viền pixel đôi, nền xanh đậm, bảng tên người nói (handle) đè mép trên trái,
 * chữ gõ từng ký tự, cụm nhấn đổi vàng khi gõ tới, ▼ nháy ở góc phải dưới khi câu đã hiện đủ.
 */
import { interpolate } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption } from "../../compositions/Short/schema";
import { activeIndexAt } from "../shared";
import { PixelBox } from "./parts";
import { BLOCK, BOX, BOX_EDGE, clamp, GOLD, glyphs, INK, onTwos, punchSpan, TEXT, WHITE, type Rect } from "./pixel";

export const Dialog: React.FC<{
  captions: Caption[];
  punches: string[];
  frame: number;
  appear: number;
  rect: Rect;
  P: number;
  unit: number;
  accent: string;
  speaker: string;
}> = ({ captions, punches, frame, appear, rect, P, unit, accent, speaker }) => {
  if (frame < appear) return null;
  const active = activeIndexAt(captions, frame);
  const caption = active >= 0 ? captions[active] : null;

  // Hộp mở theo chiều dọc từng nấc lúc vào game.
  const open = interpolate(onTwos(frame - appear), [0, 6], [0.15, 1], clamp);
  const rings = [INK, WHITE, BOX, BOX_EDGE];
  const pad = P * 3;
  const innerW = rect.w - rings.length * P * 2 - pad * 2;
  const innerH = rect.h - rings.length * P * 2 - pad * 2 - P * 2;

  const chars = caption ? glyphs(caption.text) : [];
  const start = caption ? Math.max(appear, msToFrames(caption.startMs)) : 0;
  const end = caption ? Math.max(start + 1, msToFrames(caption.endMs)) : 1;
  const rate = Math.max(1.2, chars.length / Math.max(8, (end - start) * 0.7));
  const typed = caption ? Math.min(chars.length, Math.max(0, Math.floor((frame - start) * rate))) : 0;
  const done = caption !== null && typed >= chars.length;
  const span = caption ? punches.map((p) => punchSpan(caption.text, p)).find((s) => s) ?? null : null;

  // Cỡ chữ: câu dài nhỏ dần cho vừa hộp (Lexend 600 ~0.58em mỗi ký tự).
  const lineHeight = 1.32;
  let size = 56 * unit;
  while (Math.ceil((chars.length * size * 0.58 * 1.12) / innerW) * size * lineHeight > innerH && size > 26 * unit) size *= 0.94;

  const blinkOn = Math.floor(frame / 8) % 2 === 0;
  const plateSize = 28 * unit;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <PixelBox
        rect={rect}
        P={P}
        rings={rings}
        fill={BOX}
        style={{ scale: `1 ${open.toFixed(3)}` }}
        innerStyle={{
          padding: pad,
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.18))`,
        }}
      >
        {caption && open >= 1 ? (
          <div
            style={{
              fontFamily: TEXT,
              fontWeight: 600,
              fontSize: size,
              lineHeight,
              color: WHITE,
              textShadow: `${Math.max(2, P / 2)}px ${Math.max(2, P / 2)}px 0 ${INK}`,
            }}
          >
            {chars.map((ch, i) => {
              const inPunch = span !== null && i >= span[0] && i < span[1];
              return (
                <span key={i} style={i < typed ? (inPunch ? { color: GOLD } : undefined) : { color: "transparent", textShadow: "none" }}>
                  {ch}
                </span>
              );
            })}
          </div>
        ) : null}
        {done && blinkOn ? (
          <div
            style={{
              position: "absolute",
              right: pad,
              bottom: pad * 0.6 + (Math.floor(frame / 8) % 4 === 0 ? P : 0),
              fontFamily: BLOCK,
              fontSize: 30 * unit,
              lineHeight: 1,
              color: GOLD,
            }}
          >
            ▼
          </div>
        ) : null}
      </PixelBox>
      {speaker && open >= 1 ? (
        <div
          style={{
            position: "absolute",
            left: rect.x + P * 5,
            top: rect.y,
            translate: "0 -62%",
            fontFamily: BLOCK,
            fontSize: plateSize,
            lineHeight: 1.35,
            padding: `${P}px ${P * 2.5}px`,
            color: WHITE,
            backgroundColor: accent,
            border: `${P}px solid ${INK}`,
            boxShadow: `inset 0 ${-P}px 0 rgba(0,0,0,0.25)`,
            textShadow: `${P * 0.5}px ${P * 0.5}px 0 ${INK}`,
            whiteSpace: "nowrap",
          }}
        >
          {speaker}
        </div>
      ) : null}
    </div>
  );
};
