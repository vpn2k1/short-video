import { Audio } from "@remotion/media";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { msToFrames } from "../constants";
import { musicVolumeAt, SFX_LEVEL, voiceWindowsOf } from "./mix";
import type { AudioClip, Caption } from "../compositions/Short/schema";

const WHOOSH = "sfx/whoosh.mp3";

type Props = {
  captions: Caption[];
  voiceoverTrack: string | null;
  music: string | null;
  sfx: boolean;
  musicVolume?: number;
  voiceVolume?: number;
  audioClips?: AudioClip[];
};

/**
 * Every audio track in the video: one voiceover clip per line, a ducked music
 * bed, a whoosh on each caption change, and clips added in the editor.
 * Mix maths live in ./mix.ts.
 */
export const Soundtrack: React.FC<Props> = ({
  captions,
  voiceoverTrack,
  music,
  sfx,
  musicVolume,
  voiceVolume = 1,
  audioClips = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const windows = voiceWindowsOf(captions);

  return (
    <>
      {/* Bản thu sẵn: một track chạy suốt video, bắt đầu từ frame 0. */}
      {!voiceoverTrack ? null : (
        <Audio src={staticFile(voiceoverTrack)} volume={voiceVolume} />
      )}

      {!music ? null : (
        <Audio
          src={staticFile(music)}
          loop
          loopVolumeCurveBehavior="extend"
          volume={(frame) =>
            musicVolumeAt({ frame, windows, fps, durationInFrames, level: musicVolume })
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
            <Audio src={staticFile(caption.audio)} volume={voiceVolume} />
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

      {/* Âm thanh thêm tay: Sequence giới hạn thời lượng trên timeline, trimBefore cắt đầu file (thời gian
          gốc), playbackRate là tốc độ — đoạn file dùng = durationMs × tốc độ. */}
      {audioClips.map((clip, index) => (
        <Sequence
          key={`clip-${index}`}
          name={clip.label ?? `Âm thanh ${index + 1}`}
          from={msToFrames(clip.startMs)}
          durationInFrames={Math.max(1, msToFrames(clip.durationMs))}
        >
          <Audio
            src={staticFile(clip.src)}
            trimBefore={clip.trimStartMs > 0 ? msToFrames(clip.trimStartMs) : undefined}
            playbackRate={clip.speed ?? 1}
            volume={() => clip.volume}
          />
        </Sequence>
      ))}
    </>
  );
};
