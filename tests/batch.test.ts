/**
 * Kiểm thử các hàm thuần của chế độ hàng loạt (server/batch.ts). Chạy: npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorGroup, icsFold, icsText, parseStat } from "../server/batch";

describe("parseStat — số dán từ trang thống kê", () => {
  const cases: [string, number | null][] = [
    ["12.345", 12345], ["12,345", 12345], ["1.234.567", 1234567],
    ["45,5", 45.5], ["45.5", 45.5], ["38%", 38], ["900", 900],
    ["12,3K", 12300], ["1.2M", 1_200_000], ["1,5 tr", 1_500_000], ["2 triệu", 2_000_000],
    ["", null], ["abc", null], ["-3", null],
  ];
  for (const [input, want] of cases) {
    it(JSON.stringify(input), () => {
      const got = parseStat(input);
      if (want === null) assert.equal(got, null);
      else assert.ok(got !== null && Math.abs(got - want) < 1e-6, `${input} → ${got}, cần ${want}`);
    });
  }
});

describe("errorGroup — gom lỗi theo nguyên nhân", () => {
  const cases: [string, string][] = [
    ["⏳ Groq: hết hạn mức token/lượt gọi trong một phút của gói. Đợi khoảng 9 giây", "wait"],
    ["Lỗi: ⏳ Gemini: hết hạn mức", "wait"],
    ["🔥 Gemini: máy chủ đang quá tải tạm thời", "wait"],
    ["fetch failed", "wait"],
    ["📅 Gemini: đã dùng hết lượt miễn phí trong ngày", "quota"],
    ["💳 OpenAI: tài khoản hết tiền/credit.", "quota"],
    ["🔑 ElevenLabs: key sai, đã hết hạn", "key"],
    ["Chưa có AI nào để viết kịch bản. Điền key trong Cài đặt", "key"],
    ["Không thấy file: uploads/abc.mp4", "missing"],
    ["Video gốc “x” không còn kịch bản.", "missing"],
    ["📏 Groq: yêu cầu vượt hạn mức token của gói", "content"],
    ["Groq trả về sai cấu trúc — cần {\"hooks\":[…]}.", "content"],
    ["Render thất bại: Remotion crashed", "other"],
  ];
  for (const [message, want] of cases) {
    it(message.slice(0, 50), () => assert.equal(errorGroup(message), want));
  }
});

describe("file lịch .ics", () => {
  it("thoát dấu phẩy, chấm phẩy, gạch chéo, xuống dòng", () => {
    assert.equal(icsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  });
  it("gấp dòng ≤ 75 byte và không cắt giữa ký tự tiếng Việt", () => {
    const line = `DESCRIPTION:${"Đăng video mẹo vặt tiết kiệm điện mùa hè cực hay ".repeat(6)}`;
    const folded = icsFold(line);
    const parts = folded.split("\r\n");
    assert.ok(parts.length > 1);
    for (const part of parts) assert.ok(Buffer.byteLength(part, "utf8") <= 75, `${Buffer.byteLength(part)} byte`);
    // Bỏ khoảng trắng đầu dòng tiếp nối là ra lại đúng dòng gốc, không vỡ chữ.
    assert.equal(parts.map((p, i) => (i ? p.slice(1) : p)).join(""), line);
    assert.ok(!folded.includes("�"));
  });
});
