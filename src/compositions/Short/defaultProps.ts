import type { ShortProps } from "./schema";

// Captions start after the intro title card (70 frames ≈ 2.33s).
export const defaultShortProps: ShortProps = {
  title: "3 mẹo dựng video ngắn",
  subtitle: "mà không cần biết After Effects",
  handle: "@shortvideo",
  accent: "#ff2e63",
  background: "#0b0b12",
  aspect: "9:16",
  style: "caption",
  captionPosition: "bottom",
  showTitle: true,
  scenes: [{ image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, startMs: 0, endMs: 15400 }],
  musicVolume: 0.5,
  voiceVolume: 1,
  audioClips: [],
  texts: [],
  watermark: null,
  voiceoverTrack: null,
  music: "music/placeholder.mp3",
  sfx: true,
  captions: [
    { text: "Đây là 3 mẹo", startMs: 2500, endMs: 3900, audio: null },
    { text: "giúp video ngắn giữ chân người xem.", startMs: 3900, endMs: 6000, audio: null },
    { text: "Một: hook trong 2 giây đầu.", startMs: 6200, endMs: 8600, audio: null },
    { text: "Hai: phụ đề luôn bật.", startMs: 8800, endMs: 10800, audio: null },
    { text: "Ba: cắt cảnh mỗi 3 giây.", startMs: 11000, endMs: 13200, audio: null },
    { text: "Lưu lại để dùng nhé!", startMs: 13400, endMs: 15400, audio: null },
  ],
};
