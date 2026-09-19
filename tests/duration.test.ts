/**
 * Kiểm thử độ dài video theo các món trên timeline (src/compositions/Short/duration.ts, videoMeta).
 * Chạy: npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lastItemEndMs, videoDurationInFrames } from "../src/compositions/Short/duration";
import { shortSchema } from "../src/compositions/Short/schema";
import * as ops from "../server/editor/ops";

const scene = (startMs: number, endMs: number, image: string | null = null) =>
  ({ image, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, startMs, endMs });
const overlay = (startMs: number, endMs: number) => ({
  src: "uploads/clip.mp4", startMs, endMs, trimStartMs: 0, volume: 0, track: 0,
  x: 50, y: 50, width: 100, aspect: 0.5625, rotate: 0, opacity: 1, radius: 0, fit: "contain" as const,
  crop: null, fadeMs: 0, keyframes: [],
});
const project = (extra: Record<string, unknown>) =>
  shortSchema.parse({
    title: "t", subtitle: "", handle: "@kenh", accent: "#e8590c", background: "#000000",
    captions: [], aspect: "9:16", style: "plain", scenes: [scene(0, 30016)],
    captionPosition: "bottom", showTitle: false, voiceoverTrack: null, music: null, sfx: false,
    ...extra,
  });

describe("độ dài video theo timeline", () => {
  it("thu ngắn video trên timeline thì video ngắn lại — cảnh nền rỗng bị ẩn không giữ độ dài cũ", () => {
    const p = project({
      overlays: [overlay(0, 24933)],
      captions: [{ text: "What do you call the person", startMs: 21440, endMs: 24933, audio: null }],
    });
    assert.equal(lastItemEndMs(p), 24933);
    // Dừng đúng ở mép video (24,933s = 748 frame) — không còn đoạn đen ở cuối.
    assert.equal(ops.videoMeta(p).durationInFrames, 748);
    assert.equal(videoDurationInFrames(p), 748);
  });

  it("frame cuối vẫn còn hình: khối video phủ tới frame cuối cùng", () => {
    for (const endMs of [20000, 20017, 20020, 20033, 24933]) {
      const frames = videoDurationInFrames(project({ overlays: [overlay(0, endMs)] }));
      assert.ok(((frames - 1) / 30) * 1000 < endMs, `${endMs}ms → ${frames} frame`);
    }
  });

  it("video dựng tự động (chưa có khối video) vẫn giữ 1 giây đuôi sau câu cuối", () => {
    const p = project({ scenes: [scene(0, 20150, "uploads/a.jpg")], captions: [{ text: "a", startMs: 0, endMs: 20000, audio: null }] });
    assert.equal(videoDurationInFrames(p), 605 + 30);
  });

  it("gộp cảnh thành video rồi kéo mép phải video: độ dài đi theo", () => {
    const opened = ops.unifyScenes(project({ scenes: [scene(0, 30016, "uploads/clip.mp4")] })).props;
    assert.equal(lastItemEndMs(opened), 30016);
    const trimmed = ops.resizeOverlay(opened, 0, "r", -10016);
    assert.equal(lastItemEndMs(trimmed), 20000);
  });

  it("phụ đề, chữ, âm thanh dài hơn video thì video vẫn dài theo chúng", () => {
    const p = project({
      overlays: [overlay(0, 10000)],
      captions: [{ text: "a", startMs: 9000, endMs: 12000, audio: null }],
      audioClips: [{ src: "uploads/a.mp3", startMs: 11000, durationMs: 4000 }],
    });
    assert.equal(lastItemEndMs(p), 15000);
  });

  it("chưa có lớp video (bản thu sẵn chỉ có tiếng): cảnh vẫn giữ đuôi audio sau câu cuối", () => {
    const p = project({ captions: [{ text: "a", startMs: 500, endMs: 26000, audio: null }], voiceoverTrack: "voices/x/track.mp3" });
    assert.equal(lastItemEndMs(p), 30016);
  });

  it("cảnh có hình vẫn tính dù có lớp chồng ngắn hơn", () => {
    const p = project({ scenes: [scene(0, 20000, "uploads/a.jpg")], overlays: [overlay(0, 3000)] });
    assert.equal(lastItemEndMs(p), 20000);
  });
});
