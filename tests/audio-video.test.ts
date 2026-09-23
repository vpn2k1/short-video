/**
 * Chia lời của file thu sẵn thành cảnh (server/audio-video.ts › captionScenes) — hàm thuần, không gọi whisper/ffmpeg.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captionScenes } from "../server/audio-video";
import type { Caption } from "../src/compositions/Short/schema";

const cap = (startMs: number, endMs: number, text = `câu ${startMs}`, track?: number): Caption =>
  ({ text, startMs, endMs, audio: null, ...(track ? { track } : {}) }) as Caption;

describe("captionScenes", () => {
  it("không có lời thì một cảnh phủ cả file", () => {
    assert.deepEqual(captionScenes([], 9000), [{ startMs: 0, endMs: 9000, lines: [] }]);
  });

  it("cảnh liền nhau từ 0 tới hết file, mỗi cảnh đủ dài, cắt ở chỗ ngừng nói", () => {
    // 10 câu 2 giây, nghỉ 1 giây sau câu thứ 4 (ở 8s → 9s), còn lại nói liền.
    const captions = [0, 2, 4, 6, 9, 11, 13, 15, 17, 19].map((s) => cap(s * 1000, s * 1000 + 2000));
    const scenes = captionScenes(captions, 22_000);
    assert.equal(scenes[0].startMs, 0);
    assert.equal(scenes[scenes.length - 1].endMs, 22_000);
    for (let k = 1; k < scenes.length; k++) assert.equal(scenes[k].startMs, scenes[k - 1].endMs, "không hở, không chồng");
    for (const scene of scenes.slice(0, -1)) assert.ok(scene.endMs - scene.startMs >= 5000, "cảnh không quá ngắn");
    // Chỗ ngừng 1 giây ở 8s–9s là chỗ cắt cảnh.
    assert.ok(scenes.some((scene) => scene.startMs === 9000), JSON.stringify(scenes.map((s) => s.startMs)));
    assert.equal(scenes.flatMap((s) => s.lines).length, 10, "mọi câu nằm trong một cảnh");
  });

  it("bỏ qua hàng dịch xếp chồng", () => {
    const captions = [cap(0, 2000, "gốc"), cap(0, 2000, "dịch", 1)];
    assert.deepEqual(captionScenes(captions, 3000)[0].lines, ["gốc"]);
  });

  it("file rất dài không vượt 200 cảnh", () => {
    const captions = Array.from({ length: 2000 }, (_, k) => cap(k * 1500, k * 1500 + 1200));
    const scenes = captionScenes(captions, 2000 * 1500);
    assert.ok(scenes.length <= 200, `${scenes.length} cảnh`);
  });
});
