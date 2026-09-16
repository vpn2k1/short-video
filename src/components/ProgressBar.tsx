import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { layoutFor } from "../aspects";

export const ProgressBar: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const { safe } = layoutFor(width, height);

  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="absolute left-0 h-3 w-full bg-white/15"
      style={{ top: safe.top }}
    >
      <div
        className="h-full"
        style={{ width: `${progress}%`, backgroundColor: accent }}
      />
    </div>
  );
};
