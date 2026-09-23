/**
 * Kiểm thử tên phần khi "Làm tiếp" một video (scripts/generate-script.ts: seriesBaseTitle, partTitle).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partTitle, seriesBaseTitle } from "../scripts/generate-script";
import type { VideoScript } from "../src/compositions/Short/script";

const script = (title: string, line: string): VideoScript => ({
  style: "caption", title, subtitle: "s", accent: "#e8590c", background: "#000000",
  scenes: [{ lines: [line], image: null, visual: null, tag: null, punch: null }],
});

describe("seriesBaseTitle", () => {
  it("bỏ số phần ở cuối, giữ tên loạt", () => {
    assert.equal(seriesBaseTitle("Đố chữ cười ngất (Phần 2)"), "Đố chữ cười ngất");
    assert.equal(seriesBaseTitle("Chuyện ma - Phần 3"), "Chuyện ma");
    assert.equal(seriesBaseTitle("Học guitar tập 4"), "Học guitar");
    assert.equal(seriesBaseTitle("Night shift (Part 12)"), "Night shift");
  });

  it("tiêu đề không có số phần thì giữ nguyên", () => {
    assert.equal(seriesBaseTitle("Vì sao Nokia sụp đổ"), "Vì sao Nokia sụp đổ");
    assert.equal(seriesBaseTitle("Phần 2"), "Phần 2");
  });
});

describe("partTitle", () => {
  it("thêm số phần theo ngôn ngữ của lời", () => {
    assert.equal(partTitle(script("Đố chữ cười ngất", "Con gì đập thì sống?"), 2), "Đố chữ cười ngất (Phần 2)");
    assert.equal(partTitle(script("Night shift", "She pressed send."), 3), "Night shift (Part 3)");
  });

  it("làm tiếp từ phần 2 thì thay số, không cộng dồn", () => {
    assert.equal(partTitle(script("Đố chữ cười ngất (Phần 2)", "Câu đố mới nè"), 3), "Đố chữ cười ngất (Phần 3)");
  });

  it("vừa giới hạn 60 ký tự của tiêu đề", () => {
    const title = partTitle(script("Một tiêu đề rất dài ".repeat(5).trim(), "Lời tiếng Việt có dấu"), 10);
    assert.ok(title.length <= 60, title);
    assert.ok(title.endsWith("(Phần 10)"));
  });
});
