/**
 * Kiểm thử phần sửa lựa chọn đoạn của AI (scripts/clip-picker.ts › normalizeClips).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeClips } from "../scripts/clip-picker";

// 40 câu, mỗi câu 4 giây liền nhau: câu i chạy từ 4i tới 4i+4 giây.
const lines = Array.from({ length: 40 }, (_, i) => ({ text: `Câu ${i}`, startMs: i * 4000, endMs: i * 4000 + 4000 }));
const opts = { count: 5, minSeconds: 20, maxSeconds: 40 };

describe("normalizeClips", () => {
  it("giữ đoạn hợp lệ, lấy mốc giờ từ bản phiên âm", () => {
    const [clip] = normalizeClips([{ start_line: 2, end_line: 8, title: "Hook", reason: "hay" }], lines, opts);
    assert.deepEqual([clip.start, clip.end, clip.title, clip.firstLine], [8, 36, "Hook", "Câu 2"]);
  });
  it("đoạn quá dài bị bớt câu cuối cho vừa tối đa", () => {
    const [clip] = normalizeClips([{ start_line: 0, end_line: 30, title: "x" }], lines, opts);
    assert.ok(clip.end - clip.start <= 40);
  });
  it("đoạn quá ngắn được nối thêm câu sau cho đủ tối thiểu", () => {
    const [clip] = normalizeClips([{ start_line: 10, end_line: 11, title: "x" }], lines, opts);
    assert.ok(clip.end - clip.start >= 20);
  });
  it("bỏ đoạn chồng lên đoạn trước, xếp theo thứ tự trong video", () => {
    const clips = normalizeClips([
      { start_line: 20, end_line: 26, title: "sau" },
      { start_line: 22, end_line: 28, title: "chồng" },
      { start_line: 0, end_line: 6, title: "đầu" },
    ], lines, opts);
    assert.deepEqual(clips.map((c) => c.title), ["đầu", "sau"]);
  });
  it("số câu ngoài phạm vi hoặc không phải số thì kẹp lại / bỏ qua", () => {
    const clips = normalizeClips([{ start_line: 35, end_line: 999, title: "cuối" }, { start_line: "x", end_line: 3 }], lines, opts);
    assert.equal(clips.length, 1);
    assert.equal(clips[0].end, 160);
  });
  it("không vượt số đoạn yêu cầu", () => {
    const raw = Array.from({ length: 8 }, (_, k) => ({ start_line: k * 5, end_line: k * 5 + 5, title: `${k}` }));
    assert.equal(normalizeClips(raw, lines, { ...opts, count: 3 }).length, 3);
  });
});
