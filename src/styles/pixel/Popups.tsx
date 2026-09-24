/**
 * Popup kiểu máy arcade trong cửa sổ game: câu nhấn nảy vào kèm "CRITICAL!" và "+100 XP",
 * bảng "ITEM GET!" có rương báu cho số liệu, bảng "NHIỆM VỤ" cho nhãn bước.
 */
import { interpolate } from "remotion";
import type { Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import { Chest, PixelBox, Sparkle } from "./parts";
import { BLOCK, BOX, clamp, GOLD, hardOutline, INK, onTwos, snap, TEXT, upperVi, WHITE, type Rect } from "./pixel";
import { useVt } from "../../i18n/video";

/** Độ nảy kiểu sprite: vọt quá rồi dội lại, bước theo 2 frame. */
const bounce = (local: number) => {
  const f = onTwos(local);
  return interpolate(f, [0, 4, 8, 12], [0.2, 1.22, 0.92, 1], clamp);
};

/** Câu nhấn: bật lên giữa cửa sổ ~1.6 s, sao pixel bắn ra, nháy tắt ở cuối. */
export const PunchPopup: React.FC<{
  text: string;
  local: number;
  area: Rect;
  cy: number;
  /** Tâm ngang; mặc định giữa cửa sổ. */
  cx?: number;
  /** Bề rộng tối đa của chữ, tỉ lệ theo bề rộng cửa sổ. */
  span?: number;
  P: number;
  unit: number;
  accent: string;
}> = ({ text, local, area, cy, cx = area.w / 2, span = 0.86, P, unit, accent }) => {
  const LIFE = 48;
  if (local < 0 || local >= LIFE) return null;
  // 8 frame cuối nháy tắt như vật phẩm sắp biến mất.
  if (local >= LIFE - 8 && Math.floor(local / 2) % 2 === 1) return null;
  const s = bounce(local);
  const label = upperVi(text);
  const chars = [...label].length;
  const maxW = area.w * span;
  // Bungee ~0.78em mỗi ký tự; tối đa 2 dòng.
  let size = 96 * unit;
  while (Math.ceil((chars * size * 0.78) / maxW) > 2 && size > 40 * unit) size *= 0.92;
  size = Math.min(size, (maxW / Math.max(4, chars)) * 1.35);
  const rise = snap(interpolate(local, [6, LIFE], [0, -80 * unit], clamp), P);
  const burst = interpolate(local, [0, 22], [0, 1], clamp);

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: area.w, height: area.h, pointerEvents: "none" }}>
      {burst < 1
        ? Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 10 + seeded(`pxp-${i}`, -0.2, 0.2);
          const r = snap((120 + burst * maxW * 0.5) * (0.8 + (i % 3) * 0.12), P);
          const sz = snap((i % 2 ? 36 : 54) * unit, P);
          return (
            <Sparkle
              key={i}
              size={sz}
              color={i % 2 ? GOLD : accent}
              style={{ position: "absolute", left: cx + Math.cos(a) * r - sz / 2, top: cy + Math.sin(a) * r * 0.7 - sz / 2 }}
            />
          );
        })
        : null}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: maxW,
          translate: "-50% -50%",
          scale: s.toFixed(3),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: BLOCK,
            fontSize: 34 * unit,
            lineHeight: 1.3,
            color: GOLD,
            padding: `${P}px ${P * 2}px`,
            backgroundColor: INK,
            marginBottom: P * 2,
          }}
        >
          ★ CRITICAL! ★
        </div>
        <div
          style={{
            fontFamily: BLOCK,
            fontSize: size,
            lineHeight: 1.5,
            color: WHITE,
            textShadow: `${hardOutline(P, INK, 0)}, ${P * 2}px ${P * 2}px 0 ${accent}, ${P * 3}px ${P * 3}px 0 ${INK}`,
            textWrap: "balance",
          }}
        >
          {label}
        </div>
      </div>
      {local >= 8 ? (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy + size * 1.1 + rise + 40 * unit,
            translate: "-50% 0",
            fontFamily: BLOCK,
            fontSize: 44 * unit,
            color: GOLD,
            textShadow: hardOutline(Math.max(2, P * 0.6), INK, 1.5),
            whiteSpace: "nowrap",
            opacity: interpolate(local, [LIFE - 14, LIFE - 4], [1, 0], clamp),
          }}
        >
          +100 XP
        </div>
      ) : null}
    </div>
  );
};

/**
 * Bảng vật phẩm. stat → "ITEM GET!" + rương mở + con số lớn; badge → "NHIỆM VỤ" + nhãn.
 * `hero` (cảnh không ảnh): bảng to giữa cửa sổ; có ảnh: bảng nhỏ góc phải trên.
 */
export const ItemPanel: React.FC<{
  visual: NonNullable<Scene["visual"]>;
  local: number;
  area: Rect;
  hero: boolean;
  P: number;
  unit: number;
  accent: string;
}> = ({ visual, local, area, hero, P, unit, accent }) => {
  const vt = useVt();
  if (local < 0) return null;
  const s = bounce(local);
  const isStat = visual.type === "stat";
  // Cửa sổ ngang (thấp): bảng to đứng bên phải, chừa nửa trái cho popup câu nhấn.
  const wideArea = area.w > area.h * 1.4;
  const w = snap(hero ? Math.min(area.w * (wideArea ? 0.44 : 0.8), 620 * unit) : Math.min(area.w * 0.5, 420 * unit), P);
  const scale = hero ? Math.min(1.12, w / (440 * unit)) : 1;
  const main = upperVi(visual.text);
  const mainSize = Math.min((isStat ? 92 : 56) * unit * scale, ((w - P * 12) / Math.max(3, [...main].length)) * 1.3);
  const open = interpolate(onTwos(local), [10, 18], [0, 1], clamp);
  const h = snap(
    (hero ? 64 : 50) * unit + // tiêu đề
      mainSize * 1.35 +
      (visual.caption ? 40 * unit * scale : 0) +
      (isStat ? 120 * unit * scale : 0) +
      P * 14,
    P,
  );
  const x = hero ? snap((wideArea ? area.w - w / 2 - area.w * 0.04 : area.w / 2) - w / 2, P) : snap(area.w - w - 30 * unit, P);
  const y = hero
    ? snap(wideArea ? area.h / 2 - h / 2 + 20 * unit : Math.min(area.h * 0.6, area.h - h / 2 - 40 * unit) - h / 2, P)
    : snap(70 * unit, P);
  const blinkHeader = local < 30 && Math.floor(local / 4) % 2 === 1;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: area.w, height: area.h, pointerEvents: "none" }}>
      <PixelBox
        rect={{ x, y, w, h }}
        P={P}
        rings={[INK, WHITE, BOX]}
        fill={BOX}
        style={{ scale: s.toFixed(3), transformOrigin: hero ? "50% 50%" : "100% 0%" }}
        innerStyle={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: P * 1.5, padding: P * 2 }}
      >
        <div
          style={{
            fontFamily: BLOCK,
            fontSize: (hero ? 40 : 30) * unit,
            lineHeight: 1.3,
            color: blinkHeader ? WHITE : GOLD,
            whiteSpace: "nowrap",
          }}
        >
          {isStat ? "ITEM GET!" : vt("NHIỆM VỤ")}
        </div>
        {isStat ? <Chest size={snap(112 * unit * scale, P)} open={open} /> : null}
        <div
          style={{
            fontFamily: BLOCK,
            fontSize: mainSize,
            lineHeight: 1.3,
            color: isStat ? WHITE : accent,
            textShadow: `${P}px ${P}px 0 ${INK}`,
            whiteSpace: "nowrap",
            opacity: isStat ? interpolate(local, [12, 13], [0, 1], clamp) : 1,
          }}
        >
          {main}
        </div>
        {visual.caption ? (
          <div
            style={{
              fontFamily: TEXT,
              fontWeight: 600,
              fontSize: Math.min(32 * unit * scale, ((w - P * 10) / Math.max(8, [...visual.caption].length)) * 1.9),
              lineHeight: 1.25,
              color: "#dfe5ff",
              textAlign: "center",
            }}
          >
            {visual.caption.normalize("NFC")}
          </div>
        ) : null}
      </PixelBox>
    </div>
  );
};
