import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, CaptionPosition, Scene } from "../../compositions/Short/schema";
import { fitFontSize, FONTS, seeded, useCaptionClock, useLayout, useSceneClock } from "../shared";
import {
  BLOOD,
  BLOOD_GLOW,
  BONE,
  clamp,
  EASE,
  glyphs,
  isWide,
  punchInCaptions,
  punchOffset,
  SCARE_HOLD,
  SCARE_SHAKE,
  SCENE_OUT,
  sceneAppear,
  upperVi,
} from "./look";

const shadow = (unit: number) =>
  `0 ${2 * unit}px ${4 * unit}px rgba(0,0,0,0.95), 0 0 ${22 * unit}px rgba(0,0,0,0.8), 0 0 ${3 * unit}px rgba(0,0,0,0.9)`;

/** Rung lẩy bẩy lúc chữ vừa hiện: vài frame lệch ngẫu nhiên nhỏ dần rồi đứng yên. */
const jitter = (key: string, t: number, frames: number, amount: number) => {
  if (t < 0 || t >= frames) return { x: 0, y: 0 };
  const k = 1 - t / frames;
  return { x: seeded(`${key}-x-${t}`, -1, 1) * amount * k, y: seeded(`${key}-y-${t}`, -1, 1) * amount * k };
};

/* -------------------------------------------------------------- phụ đề */

/**
 * Một câu một lúc ở 1/3 dưới: chữ có chân Lora trắng ngà, bóng tối mờ, run nhẹ lúc hiện.
 * Câu chứa câu nhấn: tới đúng `atMs` thì cụm từ chuyển đỏ máu, giật vài frame rồi đứng.
 */
export const HorrorCaptions: React.FC<{
  captions: Caption[];
  scenes: Scene[];
  position: CaptionPosition;
  showTitle: boolean;
}> = ({ captions, scenes, position, showTitle }) => {
  const frame = useCurrentFrame();
  const { caption, index, localFrame, durationFrames } = useCaptionClock(captions);
  const { unit, width, height, safe, captionBottom } = useLayout();
  if (!caption) return null;
  if (showTitle && frame < TITLE_FRAMES - 4) return null;

  const wide = isWide(width, height);
  const isLast = index === captions.length - 1;
  const text = caption.text.normalize("NFC");
  // Hiện dần qua vài nhịp chập chờn — không hiện "bụp" một cái.
  const rise = interpolate(localFrame, [0, 12], [0, 1], { ...clamp, easing: EASE });
  const stutter = localFrame > 0 && localFrame < 9 && seeded(`hz-cap-${index}-${localFrame}`) < 0.35 ? 0.45 : 1;
  const fadeOut = isLast ? interpolate(localFrame, [durationFrames + 6, durationFrames + 20], [1, 0], clamp) : 1;
  const shake = jitter(`hz-cap-${index}`, localFrame, 9, 4 * unit);

  // Câu nhấn nằm trong câu này?
  let punchStart = -1;
  let punchLen = 0;
  let punchAt = 0;
  for (const scene of scenes) {
    if (!scene.punch) continue;
    if (caption.startMs >= scene.endMs + 200 || caption.endMs <= scene.startMs - 200) continue;
    const off = punchOffset(text, scene.punch.text);
    if (off < 0) continue;
    punchStart = off;
    punchLen = scene.punch.text.normalize("NFC").trim().length;
    punchAt = msToFrames(scene.punch.atMs);
    break;
  }
  const hit = punchStart >= 0 && frame >= punchAt;
  const hitT = frame - punchAt;
  const hitShake = hit ? jitter(`hz-hit-${index}`, hitT, SCARE_SHAKE, 7 * unit) : { x: 0, y: 0 };

  const fontSize = Math.round(Math.max(wide ? 42 : 48, fitFontSize(text, wide ? 58 : 64, 0.72)) * unit);
  const maxWidth = wide ? Math.min(width * 0.66, width - safe.side * 2) : width - safe.side * 2;

  const body =
    punchStart < 0 ? (
      text
    ) : (
      <>
        {text.slice(0, punchStart)}
        <span
          style={{
            position: "relative",
            left: hitShake.x,
            top: hitShake.y,
            color: hit ? BLOOD : BONE,
            fontWeight: hit ? 700 : 500,
            textShadow: hit ? `${shadow(unit)}, 0 0 ${18 * unit}px ${BLOOD_GLOW}` : shadow(unit),
          }}
        >
          {text.slice(punchStart, punchStart + punchLen)}
        </span>
        {text.slice(punchStart + punchLen)}
      </>
    );

  const block = (
    <div
      style={{
        width: maxWidth,
        fontFamily: FONTS.lora,
        fontWeight: 500,
        fontSize,
        lineHeight: 1.32,
        color: BONE,
        textAlign: "center",
        textWrap: "balance",
        textShadow: shadow(unit),
        opacity: rise * stutter * fadeOut,
        translate: `${shake.x}px ${shake.y + (1 - rise) * 10 * unit}px`,
      }}
    >
      {body}
    </div>
  );

  if (position === "center") {
    return <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>{block}</AbsoluteFill>;
  }
  return <div style={{ position: "absolute", left: (width - maxWidth) / 2, bottom: captionBottom }}>{block}</div>;
};

/* ------------------------------------------------------------------- tag */

/**
 * Nhãn giờ/nơi chốn kiểu băng camera tìm thấy: chấm đỏ nháy + "3:00 SÁNG · NHÀ SỐ 13" gõ từng
 * ký tự ở góc trên-trái. In hoa bằng JS; phần chưa gõ vẫn giữ chỗ (trong suốt) để dòng không nhảy.
 */
export const EvidenceTag: React.FC<{ scenes: Scene[]; showTitle: boolean }> = ({ scenes, showTitle }) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  if (!scene?.tag) return null;
  const appear = sceneAppear(index, startFrame, showTitle, 10);
  if (frame < appear) return null;

  const wide = isWide(width, height);
  const chars = glyphs(upperVi(scene.tag));
  const typed = Math.min(chars.length, Math.floor((frame - appear) / 1.4) + 1);
  const outStart = Math.max(appear + 1, endFrame - SCENE_OUT);
  const opacity = interpolate(frame, [outStart, outStart + SCENE_OUT], [1, 0], clamp);
  const dotOn = Math.floor((frame - appear) / 16) % 2 === 0;
  const size = (wide ? 28 : 32) * unit;

  return (
    <div
      style={{
        position: "absolute",
        left: safe.side,
        top: safe.top + 12 * unit,
        maxWidth: width - safe.side * 2,
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 16 * unit,
        fontFamily: FONTS.bevietnam,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.2,
        color: "rgba(230,226,214,0.9)",
        textShadow: shadow(unit),
      }}
    >
      <div
        style={{
          flex: "none",
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: "50%",
          backgroundColor: BLOOD,
          opacity: dotOn ? 1 : 0.12,
          boxShadow: dotOn ? `0 0 ${12 * unit}px ${BLOOD_GLOW}` : "none",
        }}
      />
      <span>
        {chars.slice(0, typed).join("")}
        <span style={{ opacity: 0 }}>{chars.slice(typed).join("")}</span>
      </span>
    </div>
  );
};

/* ---------------------------------------------------------------- visual */

/** Vết xước khắc ngang qua con dấu — nét tối cắt vào chữ, vài nét sáng như sơn bong. */
const Scratches: React.FC<{ seed: string; w: number; h: number; unit: number }> = ({ seed, w, h, unit }) => (
  <svg
    width={w}
    height={h}
    viewBox={`0 0 ${w} ${h}`}
    style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    xmlns="http://www.w3.org/2000/svg"
  >
    {Array.from({ length: 11 }, (_, i) => {
      const x1 = seeded(`${seed}-x1-${i}`, -0.1, 1) * w;
      const y1 = seeded(`${seed}-y1-${i}`) * h;
      const len = seeded(`${seed}-l-${i}`, 0.12, 0.45) * w;
      const ang = seeded(`${seed}-a-${i}`, -0.5, 0.25);
      const light = i % 5 === 0;
      return (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x1 + Math.cos(ang) * len}
          y2={y1 + Math.sin(ang) * len}
          stroke={light ? "rgba(230,226,214,0.3)" : "rgba(6,10,9,0.75)"}
          strokeWidth={seeded(`${seed}-w-${i}`, 1, 2.6) * unit}
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

/**
 * stat/badge: con dấu khắc xước — khung viền kép nghiêng nhẹ, chữ có chân trắng ngà lõm (bóng tối
 * lệch xuống), vết xước cắt ngang. Hiện chập chờn như bóng đèn vừa bật, 1/3 trên khung.
 */
export const EtchedStamp: React.FC<{ scenes: Scene[]; showTitle: boolean; position: CaptionPosition }> = ({
  scenes,
  showTitle,
  position,
}) => {
  const { frame, scene, index, startFrame, endFrame } = useSceneClock(scenes);
  const { unit, width, height, safe } = useLayout();
  if (!scene?.visual) return null;
  const visual = scene.visual;
  const appear = sceneAppear(index, startFrame, showTitle, 16);
  if (frame < appear) return null;

  const wide = isWide(width, height);
  const t = frame - appear;
  const flick = t < 10 ? (seeded(`hz-st-${index}-${t}`) < 0.45 ? 0.15 : interpolate(t, [0, 10], [0.4, 1], clamp)) : 1;
  const outStart = Math.max(appear + 1, endFrame - SCENE_OUT);
  const opacity = flick * interpolate(frame, [outStart, outStart + SCENE_OUT], [1, 0], clamp);
  const scale = interpolate(t, [0, 14], [1.08, 1], { ...clamp, easing: EASE });

  const isStat = visual.type === "stat";
  const text = isStat ? visual.text.normalize("NFC") : upperVi(visual.text);
  const fontSize = isStat
    ? fitFontSize(text, (wide ? 132 : 150) * unit, 0.5)
    : fitFontSize(text, (wide ? 62 : 68) * unit, 0.6);
  const boxW = Math.min(width - safe.side * 2, (wide ? 0.42 : 0.72) * width);
  const boxH = isStat ? fontSize * 1.35 + 40 * unit : fontSize * 1.4 + 36 * unit;
  // Phụ đề giữa khung thì con dấu dời lên sát dưới tag.
  const top = position === "center" || wide ? safe.top + 110 * unit : Math.max(safe.top + 120 * unit, height * 0.2);
  const rot = seeded(`hz-rot-${index}`, -3.2, -1.2);

  return (
    <div
      style={{
        position: "absolute",
        left: (width - boxW) / 2,
        top,
        width: boxW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "relative",
          minWidth: boxW * 0.55,
          maxWidth: boxW,
          height: boxH,
          padding: `0 ${34 * unit}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          rotate: `${rot}deg`,
          scale: `${scale}`,
          overflow: "hidden",
          border: `${3 * unit}px solid rgba(230,226,214,0.78)`,
          outline: `${1.5 * unit}px solid rgba(230,226,214,0.4)`,
          outlineOffset: `${7 * unit}px`,
          backgroundColor: "rgba(4,8,7,0.42)",
          boxShadow: `0 0 ${40 * unit}px rgba(0,0,0,0.6)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.playfair,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.1,
            color: "rgba(226,222,208,0.92)",
            whiteSpace: "nowrap",
            textShadow: `0 ${-2 * unit}px 0 rgba(0,0,0,0.85), 0 ${2 * unit}px 0 rgba(255,255,255,0.12), 0 0 ${16 * unit}px rgba(0,0,0,0.7)`,
          }}
        >
          {text}
        </div>
        <Scratches seed={`hz-scr-${index}`} w={boxW} h={boxH} unit={unit} />
      </div>
      {visual.caption ? (
        <div
          style={{
            marginTop: 34 * unit,
            maxWidth: boxW,
            fontFamily: FONTS.lora,
            fontStyle: "italic",
            fontSize: (wide ? 32 : 36) * unit,
            lineHeight: 1.3,
            textAlign: "center",
            textWrap: "balance",
            color: "rgba(230,226,214,0.85)",
            textShadow: shadow(unit),
          }}
        >
          {visual.caption.normalize("NFC")}
        </div>
      ) : null}
    </div>
  );
};

/* ----------------------------------------------------------------- punch */

/**
 * Câu nhấn KHÔNG nằm trong phụ đề nào của cảnh (hoặc phụ đề do trình chỉnh sửa tự vẽ): hiện riêng
 * giữa khung, chữ đỏ máu cỡ lớn, giật vài frame rồi mờ đi sau ~1.4 s.
 */
export const LoosePunch: React.FC<{ scenes: Scene[]; captions: Caption[] }> = ({ scenes, captions }) => {
  const frame = useCurrentFrame();
  const { unit, width, height, safe } = useLayout();
  const wide = isWide(width, height);
  const index = scenes.findIndex((scene) => {
    if (!scene.punch) return false;
    const at = msToFrames(scene.punch.atMs);
    return frame >= at && frame < at + SCARE_HOLD && !punchInCaptions(scene, captions);
  });
  if (index < 0) return null;
  const punch = scenes[index].punch!;
  const t = frame - msToFrames(punch.atMs);
  const shake = jitter(`hz-lp-${index}`, t, SCARE_SHAKE, 10 * unit);
  const opacity = interpolate(t, [0, 2, SCARE_HOLD - 10, SCARE_HOLD], [0, 1, 1, 0], clamp);
  const scale = interpolate(t, [0, 4, 14], [1.18, 1.05, 1], clamp);
  const text = upperVi(punch.text);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity }}>
      <div
        style={{
          maxWidth: wide ? width * 0.7 : width - safe.side * 2,
          fontFamily: FONTS.playfair,
          fontWeight: 800,
          fontSize: fitFontSize(text, (wide ? 120 : 112) * unit, 0.5),
          lineHeight: 1.2,
          color: BLOOD,
          textAlign: "center",
          textWrap: "balance",
          translate: `${shake.x}px ${shake.y}px`,
          scale: `${scale}`,
          textShadow: `${shadow(unit)}, 0 0 ${30 * unit}px ${BLOOD_GLOW}`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
