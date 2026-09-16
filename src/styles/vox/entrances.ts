/**
 * Các kiểu xuất hiện của "sticker" chính. Hàm thuần: nhận frame cục bộ (tính từ lúc
 * bắt đầu vào), trả transform + opacity. Mọi giá trị suy từ frame — không timer.
 */
import { Easing, interpolate, spring } from "remotion";
import { seeded } from "../shared";

export const ENTRANCES = [
  "rise",
  "grow",
  "slam",
  "flip",
  "peel",
  "spiral",
  "wobbleDrop",
  "zoomThrough",
] as const;

export type EntranceId = (typeof ENTRANCES)[number];

/** Số frame để entrance coi như đã yên — sau mốc này bắt đầu nhún nhẹ (idle). */
export const ENTRANCE_SETTLE = 22;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Chọn kiểu vào cho cảnh. Bước nhảy 3 nguyên tố cùng nhau với 8 nên hai cảnh liền
 * nhau KHÔNG BAO GIỜ trùng kiểu; salt theo tiêu đề để mỗi video mở đầu khác nhau.
 */
export const pickEntrance = (index: number, salt: string): EntranceId => {
  const offset = Math.floor(seeded(`vox-entrance-${salt}`, 0, ENTRANCES.length));
  return ENTRANCES[(index * 3 + offset) % ENTRANCES.length];
};

export type EntranceStyle = {
  transform: string;
  opacity: number;
  transformOrigin: string;
};

export const entranceStyle = (
  id: EntranceId,
  f: number,
  fps: number,
  unit: number,
): EntranceStyle => {
  const center = "50% 50%";
  if (f < 0) {
    return { transform: "scale(0)", opacity: 0, transformOrigin: center };
  }
  const fadeIn = (frames: number) => interpolate(f, [0, frames], [0, 1], clamp);

  switch (id) {
    case "rise": {
      const s = spring({ frame: f, fps, config: { damping: 11, stiffness: 110 } });
      return {
        transform: `translateY(${(1 - s) * 620 * unit}px) rotate(${(1 - s) * 9}deg)`,
        opacity: fadeIn(5),
        transformOrigin: center,
      };
    }
    case "grow": {
      const s = spring({ frame: f, fps, config: { damping: 8, stiffness: 120 } });
      return {
        transform: `scale(${Math.max(0, s)}) rotate(${(1 - s) * -14}deg)`,
        opacity: fadeIn(3),
        transformOrigin: center,
      };
    }
    case "slam": {
      // Rơi từ trên "màn hình" xuống bàn: to → dẹp nhẹ → nảy → yên.
      const scale = interpolate(f, [0, 5, 9, 14], [2.6, 0.9, 1.05, 1], clamp);
      const rot = interpolate(f, [0, 5, 9, 14], [-9, 2.5, -1, 0], clamp);
      const shake = f > 4 && f < 12 ? Math.sin(f * 2.4) * 6 * unit : 0;
      return {
        transform: `translate(${shake}px, ${-shake * 0.5}px) scale(${scale}) rotate(${rot}deg)`,
        opacity: fadeIn(3),
        transformOrigin: center,
      };
    }
    case "flip": {
      const s = spring({ frame: f, fps, config: { damping: 10, stiffness: 100 } });
      return {
        transform: `perspective(${2200 * unit}px) rotateY(${(1 - s) * -110}deg) scale(${0.85 + 0.15 * s})`,
        opacity: fadeIn(4),
        transformOrigin: center,
      };
    }
    case "peel": {
      // Dán sticker từ góc trên-trái xuống, như bóc lớp đế ra.
      const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 90 } });
      return {
        transform: `perspective(${1800 * unit}px) rotateX(${(1 - s) * 78}deg) rotate(${(1 - s) * -24}deg)`,
        opacity: fadeIn(4),
        transformOrigin: "6% 4%",
      };
    }
    case "spiral": {
      const s = spring({ frame: f, fps, config: { damping: 14, stiffness: 80 } });
      return {
        transform: `rotate(${(1 - s) * -420}deg) scale(${Math.max(0, s)})`,
        opacity: fadeIn(4),
        transformOrigin: center,
      };
    }
    case "wobbleDrop": {
      const s = spring({ frame: f, fps, config: { damping: 7, stiffness: 140, mass: 0.8 } });
      const wobble = Math.sin(f * 0.55) * 13 * Math.exp(-f / 9);
      return {
        transform: `translateY(${(1 - s) * -1150 * unit}px) rotate(${wobble}deg)`,
        opacity: fadeIn(3),
        transformOrigin: "50% 0%",
      };
    }
    case "zoomThrough": {
      // Lao từ phía máy quay vào bàn giấy.
      const scale = interpolate(f, [0, 10, 16], [3.4, 0.95, 1], {
        ...clamp,
        easing: [Easing.out(Easing.cubic), Easing.inOut(Easing.quad)],
      });
      const rot = interpolate(f, [0, 16], [14, 0], clamp);
      return {
        transform: `scale(${scale}) rotate(${rot}deg)`,
        opacity: fadeIn(6),
        transformOrigin: center,
      };
    }
  }
};

/**
 * Nhún/lắc/thở liên tục sau khi vào xong, lệch pha theo cảnh để không bao giờ đứng hình.
 * Biên độ tăng dần từ lúc gần yên để không giật.
 */
export const idleTransform = (
  frame: number,
  localFrame: number,
  fps: number,
  unit: number,
  key: string,
  strength = 1,
) => {
  const amp = interpolate(localFrame, [ENTRANCE_SETTLE - 8, ENTRANCE_SETTLE + 14], [0, 1], clamp) * strength;
  const phase = seeded(`vox-phase-${key}`, 0, 200);
  const t = frame + phase;
  const bob = Math.sin((t / (fps * 3.1)) * Math.PI * 2) * 9 * unit * amp;
  const sway = Math.sin((t / (fps * 4.6)) * Math.PI * 2) * 1.1 * amp;
  const breathe = 1 + Math.sin((t / (fps * 2.5)) * Math.PI * 2) * 0.008 * amp;
  return `translateY(${bob}px) rotate(${sway}deg) scale(${breathe})`;
};
