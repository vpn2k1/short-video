import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  title: string;
  subtitle: string;
  accent: string;
};

export const TitleCard: React.FC<Props> = ({ title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade the whole card out over the last 12 frames of its sequence.
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const words = title.split(" ");

  const subtitleIn = spring({
    frame: frame - 10 - words.length * 3,
    fps,
    config: { damping: 200 },
  });

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center px-24 text-center"
      style={{ opacity: exit }}
    >
      <h1 className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-8xl font-black leading-tight text-white">
        {words.map((word, i) => {
          const enter = spring({
            frame: frame - i * 3,
            fps,
            config: { damping: 14, mass: 0.6 },
          });
          return (
            <span
              key={`${word}-${i}`}
              style={{
                display: "inline-block",
                opacity: enter,
                transform: `translateY(${(1 - enter) * 60}px) scale(${0.85 + enter * 0.15})`,
              }}
            >
              {word}
            </span>
          );
        })}
      </h1>

      <div
        className="mt-10 h-2 rounded-full"
        style={{
          width: `${subtitleIn * 220}px`,
          backgroundColor: accent,
        }}
      />

      <p
        className="mt-10 text-5xl font-medium text-white/75"
        style={{
          opacity: subtitleIn,
          transform: `translateY(${(1 - subtitleIn) * 30}px)`,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};
