/**
 * Khớp lời dán với bản phiên âm (scripts/lyrics-align.ts): chữ theo lời dán, mốc theo whisper — kể cả khi whisper
 * nghe sai chữ, sai dấu và cắt dòng lệch chỗ (hay gặp với bài hát có nhạc nền).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignLyrics, lyricLines } from "../scripts/lyrics-align";
import type { Caption } from "../src/compositions/Short/schema";

const cap = (startMs: number, endMs: number, text: string): Caption => ({ text, startMs, endMs, audio: null });

describe("lyricLines", () => {
  it("bỏ dòng trống, nhãn đoạn và chữ ĐK: đầu dòng", () => {
    assert.deepEqual(lyricLines("[Verse 1]\nAnh đang mơ\n\nĐK: Em ơi\n(x2)\n  Chorus: la la  "), ["Anh đang mơ", "Em ơi", "la la"]);
  });
});

describe("alignLyrics", () => {
  // whisper nghe sai ("giấc mông", "nhẹ quần"), mất dấu, và cắt dòng giữa câu.
  const heard = [
    cap(25_000, 28_000, "Anh không quên biết nhẹ quần Khóc lo phải"),
    cap(28_000, 31_500, "xoá xa Anh đang trông giấc mông đẹp mà Anh"),
    cap(31_500, 34_500, "từng mơ từ khi anh có tâm bé"),
  ];
  const lyrics = [
    "Anh không quên bước nhẹ nhàng",
    "Khó lo phải xoá xa",
    "Anh đang trong giấc mộng đẹp",
    "mà anh từng mơ từ khi anh còn thơ bé",
  ];

  it("chữ lấy đúng lời dán, mốc theo lúc hát", () => {
    const out = alignLyrics(lyrics, heard, 60_000);
    assert.deepEqual(out.map((c) => c.text), lyrics);
    // Dòng 1 hát trong 25–~27s, dòng 3 bắt đầu sau "xoá xa" (~28,6s), dòng 4 quanh 30,6–34,5s.
    assert.ok(Math.abs(out[0].startMs - 25_000) < 400, `dòng 1 bắt đầu ${out[0].startMs}`);
    assert.ok(out[1].startMs > 26_000 && out[1].startMs < 27_600, `dòng 2 bắt đầu ${out[1].startMs}`);
    assert.ok(out[2].startMs > 28_300 && out[2].startMs < 29_300, `dòng 3 bắt đầu ${out[2].startMs}`);
    assert.ok(out[3].startMs > 30_000 && out[3].startMs < 31_600, `dòng 4 bắt đầu ${out[3].startMs}`);
    for (let k = 1; k < out.length; k++) assert.ok(out[k].startMs >= out[k - 1].endMs, "không chồng nhau");
  });

  it("dòng whisper bỏ sót nằm giữa hai dòng kề", () => {
    const out = alignLyrics(["Anh không quên bước nhẹ nhàng", "la la la la la", "mà anh từng mơ từ khi anh còn thơ bé"], heard, 60_000);
    assert.equal(out.length, 3);
    assert.ok(out[1].startMs >= out[0].endMs && out[1].endMs <= out[2].startMs + 1, JSON.stringify(out));
  });

  it("không có bản phiên âm thì vẫn trả đủ dòng, không lỗi", () => {
    const out = alignLyrics(["một", "hai"], [], 10_000);
    assert.equal(out.length, 2);
  });
});
