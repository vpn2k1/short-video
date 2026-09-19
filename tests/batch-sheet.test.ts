/**
 * Kiểm thử phần đọc bảng tính của màn Hàng loạt (server/public/batch-sheet.js — chạy trong trình duyệt).
 * Nạp file vào một vm context với vài biến giả thay cho app.js.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";

const context = vm.createContext({
  state: {
    styles: [{ id: "cinematic", label: "Điện ảnh" }, { id: "documentary", label: "Phim tài liệu" }],
    voices: { catalog: [{ key: "linh" }, { key: "laura" }] },
    audio: { music: [{ path: "music/calm.mp3", name: "calm.mp3" }] },
  },
  aspects: [{ id: "9:16" }, { id: "16:9" }, { id: "1:1" }],
  IMAGE_SOURCES: { none: "Không hình", library: "Ảnh của tôi", pexels: "Ảnh miễn phí", ai: "AI vẽ ảnh" },
  RANDOM_MUSIC: "random",
  videoModels: () => [],
  newBatchCard: () => ({ id: "x", text: "", settings: {}, open: false }),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../server/public/batch-sheet.js"), "utf8"), context);
const call = (name: string, ...args: unknown[]) => (context[name] as (...a: unknown[]) => unknown)(...args);
// Kết quả từ vm context có prototype khác — so bằng JSON cho khỏi vấp deepEqual.
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("parseSheet — tách CSV", () => {
  it("ô trong ngoặc kép chứa dấu phẩy, xuống dòng và \"\"", () => {
    assert.deepEqual(plain(call("parseSheet", 'a,"b, c","dòng 1\ndòng 2","nói ""chào"""\n1,2,3,4')),
      [["a", "b, c", "dòng 1\ndòng 2", 'nói "chào"'], ["1", "2", "3", "4"]]);
  });
  it("tự nhận chấm phẩy (Excel tiếng Việt) và tab (Google Sheets)", () => {
    assert.deepEqual(plain(call("parseSheet", "a;b\n1;2")), [["a", "b"], ["1", "2"]]);
    assert.deepEqual(plain(call("parseSheet", "a\tb\n1\t2")), [["a", "b"], ["1", "2"]]);
  });
  it("bỏ BOM và dòng trống", () => {
    assert.deepEqual(plain(call("parseSheet", "﻿a,b\n\n1,2\n")), [["a", "b"], ["1", "2"]]);
  });
});

describe("sheetToCards — cột thành cài đặt riêng", () => {
  it("khớp tên hiển thị, không dấu, và báo ô không hiểu", () => {
    const rows = call("parseSheet", "Nội dung;Phong cách;Khung;Giọng;Nhạc\nMẹo 1;Điện ảnh;dọc;linh;không\nMẹo 2;hoat hinh;4:5;;calm") as string[][];
    const { cards, problems } = plain(call("sheetToCards", rows));
    assert.equal(cards.length, 2);
    assert.deepEqual(cards[0].settings, { style: "cinematic", aspect: "9:16", voice: "linh", music: "none" });
    assert.deepEqual(cards[1].settings, { music: "music/calm.mp3" });
    assert.equal(problems.length, 2);
    assert.match(problems[0], /dòng 3, cột “Phong cách”/);
  });
  it("không có dòng tiêu đề thì cột đầu là nội dung", () => {
    const { cards, settingCols } = plain(call("sheetToCards", [["Ý tưởng A"], ["Ý tưởng B"]]));
    assert.equal(settingCols.length, 0);
    assert.deepEqual(cards.map((c: { text: string }) => c.text), ["Ý tưởng A", "Ý tưởng B"]);
  });
});
