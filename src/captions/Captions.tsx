import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_BOTTOM, msToFrames } from "../constants";
import type { Caption, CaptionPosition } from "../compositions/Short/schema";

type Props = {
  captions: Caption[];
  accent: string;
  position: CaptionPosition;
};

/**
 * Renders the caption track. `endMs` is not used for visibility here — it only
 * sets the video's total length via calculateShortMetadata.
 */
export const Captions: React.FC<Props> = ({ captions, accent, position }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hold each caption until the next one starts — so the track never blinks
  // out between lines, and the closing line stays up through the outro.
  let activeIndex = -1;
  for (let i = 0; i < captions.length; i++) {
    if (frame >= msToFrames(captions[i].startMs)) {
      activeIndex = i;
    }
  }

  if (activeIndex === -1) {
    return null;
  }

  const active = captions[activeIndex];
  const pop = spring({
    frame: frame - msToFrames(active.startMs),
    fps,
    config: { damping: 12, mass: 0.4 },
  });

  return (
    <div
      className={
        position === "center"
          ? "absolute inset-0 flex items-center justify-center px-20"
          : "absolute inset-x-0 flex justify-center px-20"
      }
      style={position === "center" ? undefined : { bottom: CAPTION_BOTTOM }}
    >
      <span
        className="rounded-3xl px-10 py-6 text-center text-6xl font-extrabold leading-snug text-white"
        style={{
          backgroundColor: accent,
          transform: `scale(${0.9 + pop * 0.1})`,
          opacity: Math.min(1, pop * 1.6),
          textShadow: "0 4px 24px rgba(0,0,0,0.45)",
        }}
      >
        {active.text}
      </span>
    </div>
  );
};
