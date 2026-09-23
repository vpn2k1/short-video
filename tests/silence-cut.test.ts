/**
 * Cắt khoảng lặng trong trình chỉnh sửa (server/editor/ops.ts › silenceCuts, cutSilences) — hàm thuần, không gọi ffmpeg.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shortSchema, type ShortProps } from "../src/compositions/Short/schema";
import { cutSilences, silenceCuts, soundSourceRange, soundSpanOf } from "../server/editor/ops";

/** Một video 10s trên hàng Video 1 (giống dự án tạo trong trình chỉnh sửa) + một câu phụ đề ở giây 6–7. */
const project = (): ShortProps =>
  shortSchema.parse({
    title: "t", subtitle: "", accent: "#ff6b2c", background: "#000000",
    captions: [{ text: "xin chào", startMs: 6000, endMs: 7000 }],
    aspect: "9:16", style: "plain",
    scenes: [{ image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, startMs: 0, endMs: 10_000 }],
    overlays: [{
      src: "uploads/a.mp4", startMs: 0, endMs: 10_000, trimStartMs: 0, volume: 1, track: 0,
      x: 50, y: 50, width: 100, aspect: 0.5625, rotate: 0, opacity: 1, radius: 0, fit: "contain",
      crop: null, fadeMs: 0, keyframes: [],
    }],
    captionPosition: "bottom", showTitle: false, voiceoverTrack: null, music: null, sfx: false,
  });

describe("silenceCuts", () => {
  const span = { src: "uploads/a.mp4", startMs: 1000, endMs: 6000, trimStartMs: 2000, speed: 2 };

  it("đổi mốc file gốc sang timeline theo phần cắt đầu và tốc độ, chừa lề hai bên", () => {
    // File 4000–6000 → timeline 2000–3000; chừa 100ms mỗi bên.
    assert.deepEqual(silenceCuts(span, [{ startMs: 4000, endMs: 6000 }], 100), [{ startMs: 2100, endMs: 2900 }]);
  });

  it("lặng ngay đầu / cuối khối thì cắt sát mép, không chừa", () => {
    assert.deepEqual(silenceCuts(span, [{ startMs: 2000, endMs: 3000 }], 100), [{ startMs: 1000, endMs: 1400 }]);
    assert.deepEqual(silenceCuts(span, [{ startMs: 11_000, endMs: 12_000 }], 100), [{ startMs: 5600, endMs: 6000 }]);
  });

  it("bỏ đoạn quá ngắn sau khi chừa lề", () => {
    assert.deepEqual(silenceCuts(span, [{ startMs: 5000, endMs: 5600 }], 100), []);
  });

  it("phần file gửi lên server để dò", () => {
    assert.deepEqual(soundSourceRange(span), { startMs: 2000, endMs: 12_000 });
  });
});

describe("cutSilences", () => {
  it("cắt nhiều đoạn trong một video, phần sau và phụ đề dồn lên", () => {
    const result = cutSilences(project(), { type: "overlay", index: 0 }, [
      { startMs: 2000, endMs: 3000 },
      { startMs: 5000, endMs: 5500 },
    ]);
    const pieces = result.props.overlays!.map((o) => [o.startMs, o.endMs, o.trimStartMs]);
    assert.deepEqual(pieces, [[0, 2000, 0], [2000, 4000, 3000], [4000, 8500, 5500]]);
    assert.deepEqual([result.props.captions[0].startMs, result.props.captions[0].endMs], [4500, 5500]);
    assert.equal(result.props.scenes[0].endMs, 8500);
    assert.match(result.message ?? "", /Đã cắt 2 khoảng lặng — ngắn đi 1\.5s/);
    assert.deepEqual(result.selection, { type: "overlay", index: 0 });
  });

  it("lặng ở đầu video: cắt sát đầu, phần file bỏ qua được cộng vào trimStart", () => {
    const result = cutSilences(project(), { type: "overlay", index: 0 }, [{ startMs: 0, endMs: 1200 }]);
    assert.deepEqual(result.props.overlays!.map((o) => [o.startMs, o.endMs, o.trimStartMs]), [[0, 8800, 1200]]);
  });

  it("đoạn âm thanh: cắt giữa đoạn, phần sau nối tiếp đúng chỗ trong file", () => {
    const p = { ...project(), audioClips: [{ src: "uploads/v.mp3", startMs: 1000, durationMs: 8000, trimStartMs: 500, volume: 1, label: null }] } as ShortProps;
    const result = cutSilences(p, { type: "clip", index: 0 }, [{ startMs: 4000, endMs: 5000 }]);
    const clips = result.props.audioClips.map((c) => [c.startMs, c.durationMs, c.trimStartMs]);
    assert.deepEqual(clips, [[1000, 3000, 500], [4000, 4000, 4500]]);
  });

  it("không cắt khi gần như cả khối im lặng", () => {
    const p = project();
    const result = cutSilences(p, { type: "overlay", index: 0 }, [{ startMs: 0, endMs: 9900 }]);
    assert.equal(result.props, p);
    assert.match(result.message ?? "", /im lặng hoàn toàn/);
  });

  it("khối không có tiếng (cảnh không có video) thì báo, không đổi gì", () => {
    const p = project();
    assert.equal(soundSpanOf(p, { type: "scene", index: 0 }), null);
    assert.equal(cutSilences(p, { type: "scene", index: 0 }, [{ startMs: 1000, endMs: 2000 }]).props, p);
  });
});
