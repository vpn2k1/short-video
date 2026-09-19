/**
 * Kiểm thử phần đo vùng an toàn của tự soát (scripts/qa-video.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unsafePlacements } from "../scripts/qa-video";

const caption = (text: string, style?: { y?: number; size?: number; width?: number }) => ({ text, startMs: 0, endMs: 2000, style });

describe("unsafePlacements — chữ lấn vùng TikTok/Reels che", () => {
  it("vị trí mặc định (y 80%) không bị báo", () => {
    assert.deepEqual(unsafePlacements({ aspect: "9:16", captionLook: { y: 80, size: 64, width: 86 }, captions: [caption("Câu phụ đề vừa phải dài chừng này")] }), []);
  });
  it("không chỉnh vị trí thì không soát", () => {
    assert.deepEqual(unsafePlacements({ aspect: "9:16", captions: [caption("Một câu")] }), []);
  });
  it("phụ đề kéo xuống sát đáy bị báo quá thấp", () => {
    const found = unsafePlacements({ aspect: "9:16", captionLook: { y: 93, size: 70, width: 71 }, captions: [caption("Có quán cà phê nào gần đây không?")] });
    assert.equal(found.length, 1);
    assert.match(found[0], /quá thấp/);
  });
  it("chữ tự do sát đỉnh bị báo", () => {
    const found = unsafePlacements({ aspect: "9:16", texts: [{ text: "THEO DÕI NGAY", y: 2, size: 80 }] });
    assert.equal(found.length, 1);
    assert.match(found[0], /chữ tự do/);
  });
  it("câu có vị trí riêng lấn vùng che được đếm", () => {
    const found = unsafePlacements({ aspect: "9:16", captions: [caption("Hàng phụ đề dịch", { y: 92, size: 60 }), caption("Câu ổn")] });
    assert.match(found[0], /^1 câu phụ đề/);
  });
});
