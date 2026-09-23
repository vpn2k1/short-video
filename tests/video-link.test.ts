/**
 * Lấy video từ link (scripts/video-link.ts): chỉ nhận link http(s) một dòng — phần đọc/tải cần mạng nên không thử ở đây.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isVideoLink } from "../scripts/video-link";

describe("isVideoLink", () => {
  it("nhận link http(s) của video", () => {
    assert.ok(isVideoLink("https://www.youtube.com/watch?v=aqz-KE-bpKQ"));
    assert.ok(isVideoLink("https://vt.tiktok.com/ZSabc123/"));
    assert.ok(isVideoLink("  http://example.com/video.mp4  "));
  });

  it("từ chối chữ thường, lệnh, link có khoảng trắng hay giao thức khác", () => {
    for (const bad of ["xin chào", "file:///etc/passwd", "ftp://x.com/a.mp4", "https://a.com/x y", "--exec rm", "", null, 42]) {
      assert.equal(isVideoLink(bad), false, String(bad));
    }
    assert.equal(isVideoLink(`https://a.com/${"x".repeat(2100)}`), false);
  });
});
