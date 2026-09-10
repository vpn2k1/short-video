import { Audio } from "@remotion/media";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { msToFrames } from "../constants";
import { musicVolumeAt, SFX_LEVEL, voiceWindowsOf } from "./mix";
import type { Caption } from "../compositions/Short/schema";

const WHOOSH = "sfx/whoosh.mp3";

type Props = {
  captions: Caption[];
  voiceoverTrack: string | null;
  music: string | null;
  sfx: boolean;
};

/**
 * Every audio track in the video: one voiceover clip per line, a ducked music
 * bed, and a whoosh on each caption change. Mix maths live in ./mix.ts.
 */
export const Soundtrack: React.FC<Props> = ({
  captions,
  voiceoverTrack,
  music,
  sfx,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const windows = voiceWindowsOf(captions);

  return (
    <>
      {/* Bản thu sẵn: một track chạy suốt video, bắt đầu từ frame 0. */}
      {!voiceoverTrack ? null : (
        <Audio src={staticFile(voiceoverTrack)} />
      )}

      {!music ? null : (
        <Audio
          src={staticFile(music)}
          loop
          loopVolumeCurveBehavior="extend"
          volume={(frame) =>
            musicVolumeAt({ frame, windows, fps, durationInFrames })
          }
        />
      )}

      {captions.map((caption, index) =>
        !caption.audio ? null : (
          <Sequence
            key={`vo-${index}`}
            name={`Voiceover ${index + 1}`}
            from={msToFrames(caption.startMs)}
          >
            <Audio src={staticFile(caption.audio)} />
          </Sequence>
        ),
      )}

      {!sfx
        ? null
        : captions.map((caption, index) => (
            <Sequence
              key={`sfx-${index}`}
              name={`Whoosh ${index + 1}`}
              from={Math.max(0, msToFrames(caption.startMs) - 3)}
            >
              <Audio src={staticFile(WHOOSH)} volume={SFX_LEVEL} />
            </Sequence>
          ))}
    </>
  );
};
