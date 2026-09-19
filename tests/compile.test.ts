/**
 * Kiểm thử mốc chương của video tổng hợp (scripts/compile.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chapterClock } from "../scripts/compile";

describe("chapterClock — mốc chương YouTube", () => {
  it("dưới một giờ: mm:ss, chương đầu 00:00", () => {
    assert.equal(chapterClock(0), "00:00");
    assert.equal(chapterClock(24.9), "00:24");
    assert.equal(chapterClock(72), "01:12");
  });
  it("từ một giờ: h:mm:ss", () => assert.equal(chapterClock(3723), "1:02:03"));
});
