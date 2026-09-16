import { useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { useCaptionClock } from "../shared";
import { Sparkles } from "./Gold";
import { CAPTION_LH, type RankLayout } from "./layout";
import { backOut, EASE_IN, FONT, GOLD_GRADIENT, GOLD_LIGHT, INK, measure, ramp, WHITE } from "./theme";

/** Dải trắng bo tròn chứa câu đang đọc — đáy ở `captionBottom` hoặc giữa khung. */
export const CaptionStrip: React.FC<{ L: RankLayout; captions: Caption[]; accent: string }> = ({ L, captions, accent }) => {
  const frame = useCurrentFrame();
  const { index, caption, localFrame } = useCaptionClock(captions);
  if (!caption || frame < L.introEnd) return null;
  const fitted = L.fittedCaptions[index];
  if (!fitted || fitted.lines.length === 0) return null;
  const { unit: u } = L;
  const C = L.caption;

  const lineH = fitted.size * CAPTION_LH;
  const textW = Math.max(...fitted.lines.map((l) => measure(l, fitted.size, 800)));
  const w = Math.min(C.w, textW * 1.05 + C.padX * 2);
  const h = fitted.lines.length * lineH + C.padY * 2;
  const top = C.centered ? C.centerY - h / 2 : C.bottom - h;
  // Câu mở đầu ngay lúc phần mở đầu vừa xong cũng bật vào như câu mới.
  const pop = ramp(Math.min(localFrame, frame - L.introEnd), 0, 7, (t) => t);

  return (
    <div
      style={{
        position: "absolute",
        left: C.centerX - w / 2,
        top,
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: Math.min(h / 2, 34 * u),
        backgroundColor: WHITE,
        borderBottom: `${6 * u}px solid ${accent}`,
        boxShadow: `0 ${14 * u}px ${34 * u}px rgba(0,0,0,0.5)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: pop,
        transform: `translateY(${(1 - pop) * 16 * u}px) scale(${0.94 + 0.06 * backOut(pop, 1.8)})`,
      }}
    >
      {fitted.lines.map((line, i) => (
        <div
          key={`c-${i}`}
          style={{ fontFamily: FONT, fontWeight: 800, fontSize: fitted.size, lineHeight: CAPTION_LH, color: INK, whiteSpace: "nowrap" }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

/** Giữ viên câu nhấn tối đa ~2,3 giây (hoặc tới hết cảnh). */
const PUNCH_HOLD = 70;

/**
 * Viên vàng chứa câu nhấn in hoa, bật lên đúng `atMs` kèm vệt sáng quét qua.
 * Dọc: nằm ngay trên phụ đề. Ngang/vuông: đè lên đáy ảnh, ngay trên thanh tên.
 */
export const PunchPill: React.FC<{ L: RankLayout; scenes: Scene[] }> = ({ L, scenes }) => {
  const frame = useCurrentFrame();
  const { unit: u, strip } = L;
  const C = L.caption;
  const P = L.punch;

  let active: { scene: Scene; index: number; at: number; until: number } | null = null;
  scenes.forEach((scene, index) => {
    if (!scene.punch) return;
    const at = Math.max(msToFrames(scene.punch.atMs), L.enters[index] + 6, L.introEnd);
    const nextEnter = L.enters[index + 1];
    const until = Math.min(at + PUNCH_HOLD, nextEnter === undefined ? Infinity : nextEnter - 6);
    if (until > at && frame >= at && frame < until + 6) active = { scene, index, at, until };
  });
  if (!active) return null;
  const { scene, index, at, until } = active as { scene: Scene; index: number; at: number; until: number };

  const fitted = L.fitPunch(scene.punch!.text);
  if (fitted.lines.length === 0) return null;
  const line = fitted.lines[0];
  const textW = measure(line, fitted.size, 900) * 1.05;
  const w = textW + P.padX * 2;
  const h = fitted.size * 1.3 + 22 * u;

  const capTop = C.centered ? C.centerY - C.maxH / 2 : C.bottom - C.maxH;
  const bottom = !strip && !C.centered ? L.bar.y - P.gap : capTop - P.gap;
  const centerX = strip ? L.width / 2 : L.card.x + L.card.w / 2;

  const inP = ramp(frame, at, 9, (t) => t);
  const outP = ramp(frame, until, 6, EASE_IN);
  const scale = (0.3 + 0.7 * backOut(inP, 2.6)) * (1 - outP * 0.6);
  const shine = ramp(frame, at + 5, 13, (t) => t);
  const gold = L.items[index]?.rank === 1;

  return (
    <div
      style={{
        position: "absolute",
        left: centerX - w / 2,
        top: bottom - h,
        width: w,
        height: h,
        opacity: Math.min(1, inP * 3) * (1 - outP),
        transform: `scale(${scale}) rotate(${-2 + outP * 4}deg)`,
      }}
    >
      {gold ? <Sparkles seed={`rk-punch-${index}`} count={8} width={w} height={h} unit={u} from={at + 4} /> : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: h / 2,
          backgroundImage: GOLD_GRADIENT,
          border: `${4 * u}px solid ${GOLD_LIGHT}`,
          boxShadow: `0 ${12 * u}px ${30 * u}px rgba(0,0,0,0.5), 0 0 ${40 * u}px rgba(255,201,60,0.45)`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: fitted.size, lineHeight: 1.3, color: INK, whiteSpace: "nowrap" }}>
          {line}
        </div>
        {shine > 0 && shine < 1 ? (
          <div
            style={{
              position: "absolute",
              top: -h * 0.2,
              left: `${-40 + shine * 170}%`,
              width: h * 0.9,
              height: h * 1.4,
              transform: "skewX(-24deg)",
              backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 100%)",
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
