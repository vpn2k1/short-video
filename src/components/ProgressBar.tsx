import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SAFE } from "../constants";

export const ProgressBar: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="absolute left-0 h-3 w-full bg-white/15"
      style={{ top: SAFE.top }}
    >
      <div
        className="h-full"
        style={{ width: `${progress}%`, backgroundColor: accent }}
      />
    </div>
  );
};
