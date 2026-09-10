import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames, SAFE } from "../constants";
import type { Scene } from "../compositions/Short/schema";

const SHOW_SECONDS = 2.2;

/**
 * Nhãn "Chương N" hiện ngắn ở đầu mỗi cảnh. Với video dài, người xem cần biết
 * mình đang ở đâu trong cấu trúc — short-form không cần thứ này.
 */
export const ChapterMarker: React.FC<{ scenes: Scene[]; accent: string }> = ({
  scenes,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const showFrames = Math.round(fps * SHOW_SECONDS);

  const index = scenes.findIndex((scene, i) => {
    const start = msToFrames(scene.startMs);
    // Cảnh đầu bắt đầu ở frame 0 nên vẫn hiện được nhãn.
    return i === 0
      ? frame < showFrames
      : frame >= start && frame < start + showFrames;
  });

  if (index === -1) {
    return null;
  }

  const start = index === 0 ? 0 : msToFrames(scenes[index].startMs);
  const enter = spring({ frame: frame - start, fps, config: { damping: 16 } });
  const exit = interpolate(
    frame,
    [start + showFrames - 10, start + showFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      className="absolute inset-x-0 flex justify-center"
      style={{ top: SAFE.top + 40, opacity: Math.min(enter, exit) }}
    >
      <span
        className="rounded-lg px-8 py-3 text-3xl font-bold uppercase tracking-[0.2em] text-white"
        style={{
          backgroundColor: accent,
          transform: `translateY(${(1 - enter) * -20}px)`,
        }}
      >
        {`Chương ${index + 1}`}
      </span>
    </div>
  );
};
