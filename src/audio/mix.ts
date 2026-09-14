import { interpolate } from "remotion";
import { msToFrames } from "../constants";
import type { Caption } from "../compositions/Short/schema";

export const MUSIC_LEVEL = 0.5;
export const MUSIC_DUCKED = 0.12;
export const SFX_LEVEL = 0.35;

export type VoiceWindow = { start: number; end: number };

export const voiceWindowsOf = (captions: Caption[]): VoiceWindow[] =>
  captions
    .filter((caption) => Boolean(caption.audio))
    .map((caption) => ({
      start: msToFrames(caption.startMs),
      end: msToFrames(caption.endMs),
    }));

/**
 * Music volume at a given frame: ducked under any voiceover, ramped over
 * `rampFrames` so it dips instead of stepping, and faded in/out at the edges.
 * Pure so the mix can be checked without rendering.
 */
export const musicVolumeAt = ({
  frame,
  windows,
  fps,
  durationInFrames,
  level = MUSIC_LEVEL,
}: {
  frame: number;
  windows: VoiceWindow[];
  fps: number;
  durationInFrames: number;
  /** Âm lượng nền chỉnh trong trình chỉnh sửa; mức hạ khi có giọng giữ đúng tỉ lệ. */
  level?: number;
}) => {
  const rampFrames = Math.max(1, Math.round(fps * 0.25));

  let insideness = 0;
  for (const window of windows) {
    const distance =
      frame < window.start
        ? window.start - frame
        : frame > window.end
          ? frame - window.end
          : 0;
    insideness = Math.max(insideness, 1 - Math.min(1, distance / rampFrames));
  }

  const ducked = interpolate(insideness, [0, 1], [level, level * (MUSIC_DUCKED / MUSIC_LEVEL)]);

  const fade = interpolate(
    frame,
    [0, fps, durationInFrames - fps, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return ducked * fade;
};
