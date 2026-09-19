/**
 * Kiểm thử phần đo vùng an toàn của tự soát (scripts/qa-video.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixPlacements, unsafePlacements } from "../scripts/qa-video";

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

describe("fixPlacements — kéo chữ vào vùng an toàn", () => {
  it("phụ đề nhiều hàng dời cả cụm, giữ khoảng cách giữa các hàng", () => {
    const props = {
      aspect: "9:16",
      captionLook: { y: 81, size: 70, width: 71 },
      captions: [
        caption("Yes, there is one nearby."),
        { ...caption("Có, có một quán ở gần đây.", { y: 92, size: 60, width: 71 }), track: 1 },
      ],
    };
    const gapBefore = 92 - 81;
    assert.ok(fixPlacements(props) > 0);
    const second = props.captions[1].style!.y!;
    assert.equal(Math.round((second - props.captionLook.y) * 10) / 10, gapBefore);
    assert.deepEqual(unsafePlacements(props), []);
  });
  it("chữ tự do dời riêng và hết bị báo", () => {
    const props = { aspect: "9:16", texts: [{ text: "THEO DÕI NGAY", y: 2, size: 80 }] };
    assert.equal(fixPlacements(props), 1);
    assert.ok(props.texts[0].y > 2);
    assert.deepEqual(unsafePlacements(props), []);
  });
  it("không có gì lấn thì không đụng", () => {
    const props = { aspect: "9:16", captionLook: { y: 80, size: 64, width: 86 }, captions: [caption("Câu ổn")] };
    assert.equal(fixPlacements(props), 0);
    assert.equal(props.captionLook.y, 80);
  });
});
