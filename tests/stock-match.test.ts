/**
 * Kiểm thử chấm điểm và ngưỡng khớp của kho ảnh miễn phí (scripts/stock.ts): mô tả dài của Pixabay không được
 * ăn điểm oan so với câu mô tả của Pexels, và kết quả lệch hẳn chủ đề phải bị loại.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWeakMatch, stockRelevance } from "../scripts/stock";
import type { StockItem } from "../scripts/stock";

const item = (provider: "pexels" | "pixabay", title: string): StockItem => ({
  provider, id: "1", kind: "image", title, author: "ai đó", pageUrl: "", preview: "", license: "",
} as StockItem);

/** Thẻ Pixabay thật của một ảnh sứa: vài thẻ đầu là chủ thể, đuôi toàn thẻ chung chung. */
const PIXABAY_TAGS = "jellyfish, aquatic life, sea creature, swimming, swim, under water, aquarium, sea, life, " +
  "aquatic, ocean, water, underwater, marine, creature, fish, animal, wildlife, nature, tropical, blue, deep, exotic";
const OCEAN = ["creature", "deep", "sea", "ocean", "underwater"];

describe("stockRelevance", () => {
  it("chỉ xét phần đầu mô tả — dãy thẻ dài không khớp hết từ khoá", () => {
    const long = stockRelevance(item("pixabay", PIXABAY_TAGS), OCEAN);
    assert.equal(long.total, 5);
    assert.ok(long.matched < 5, `dãy thẻ dài vẫn khớp ${long.matched}/5`);
  });

  it("từ khoá ở đuôi thẻ không tính, ở đầu thì tính", () => {
    const tail = stockRelevance(item("pixabay", ["cat", "dog", "tree", "car", "house", "road", "sky", "city",
      "street", "light", "night", "people", "ocean"].join(", ")), ["ocean"]);
    assert.equal(tail.matched, 0);
    const head = stockRelevance(item("pixabay", "ocean, wave, blue"), ["ocean"]);
    assert.equal(head.matched, 1);
  });

  it("từ khoá đầu (chủ thể chính) nặng hơn các từ sau", () => {
    const subject = stockRelevance(item("pexels", "A vampire squid in the deep"), ["squid", "ocean", "deep"]);
    const rest = stockRelevance(item("pexels", "A calm ocean at deep blue hour"), ["squid", "ocean", "deep"]);
    assert.ok(subject.score > rest.score, `${subject.score} phải lớn hơn ${rest.score}`);
  });

  it("cụm hai từ liền nhau được cộng điểm hơn là rải rác", () => {
    const phrase = stockRelevance(item("pexels", "Bowl of fish sauce on a table"), ["fish", "sauce"], ["fish sauce"]);
    const apart = stockRelevance(item("pexels", "Fish sticks served with sauce"), ["fish", "sauce"], ["fish sauce"]);
    assert.ok(phrase.score > apart.score, `${phrase.score} phải lớn hơn ${apart.score}`);
  });
});

describe("nhận ra ảnh có đúng chủ thể không", () => {
  // stockForScene đánh dấu "ảnh cùng chủ đề" khi mô tả ảnh không nhắc tới từ khoá chủ thể (từ khoá đầu).
  const showsSubject = (title: string, subject: string) =>
    stockRelevance(item("pexels", title), [subject]).matched > 0;

  it("mô tả có tên chủ thể thì tính là đúng chủ thể", () => {
    assert.ok(showsSubject("Fresh Vietnamese Banh Mi sandwich with herbs", "sandwich"));
    assert.ok(showsSubject("A steaming coffee cup on a table", "coffee"));
    // Số nhiều cũng nhận ra: "jellyfishes" → "jellyfish".
    assert.ok(showsSubject("Two jellyfishes in the dark", "jellyfish"));
  });

  it("ảnh đúng bối cảnh nhưng sai loài thì không tính", () => {
    assert.ok(!showsSubject("A captivating underwater shot of a giant grouper fish", "blobfish"));
    assert.ok(!showsSubject("Orca whale swimming in dark water", "dragonfish"));
    assert.ok(!showsSubject("Close-up of fresh squid in a metal bowl", "jellyfish"));
  });
});

describe("isWeakMatch", () => {
  it("dưới 1/3 số từ khoá là lệch chủ đề", () => {
    assert.ok(isWeakMatch({ matched: 1, total: 5 }));
    assert.ok(isWeakMatch({ matched: 0, total: 3 }));
    assert.ok(isWeakMatch({ matched: 1, total: 4 }));
  });

  it("từ 1/3 trở lên thì nhận", () => {
    assert.ok(!isWeakMatch({ matched: 2, total: 5 }));
    assert.ok(!isWeakMatch({ matched: 1, total: 3 }));
    assert.ok(!isWeakMatch({ matched: 5, total: 5 }));
  });

  it("không có từ khoá nào để chấm thì không loại", () => {
    assert.ok(!isWeakMatch({ matched: 0, total: 0 }));
  });
});
