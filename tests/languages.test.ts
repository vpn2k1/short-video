/**
 * Kiểm thử tách chữ cho phong cách bật từng từ (src/styles/tokens.ts) và đoán ngôn ngữ nguồn (scripts/translate.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wordTokens } from "../src/styles/tokens";
import { guessLanguage } from "../scripts/translate";

const texts = (s: string) => wordTokens(s).map((t) => t.text);

describe("wordTokens", () => {
  it("chữ có dấu cách tách như cũ, giữ dấu câu trong từ", () => {
    assert.deepEqual(texts("Mẹo ngủ ngon, dễ lắm!"), ["Mẹo", "ngủ", "ngon,", "dễ", "lắm!"]);
    assert.deepEqual(texts("좋은 아침 습관"), ["좋은", "아침", "습관"]);
  });
  it("tiếng Nhật cắt thành cụm, trợ từ và dấu câu dính vào từ trước", () => {
    const words = texts("朝の水分補給のコツ");
    assert.ok(words.length >= 3, JSON.stringify(words));
    assert.equal(words.join(""), "朝の水分補給のコツ");
    assert.ok(!words.includes("の"), "trợ từ の không đứng một mình");
    assert.ok(texts("体がすっきりと目覚めます。").at(-1)!.endsWith("。"));
  });
  it("tiếng Trung cắt thành từ, không mất chữ", () => {
    const words = texts("早上喝一杯温水，身体更清醒。");
    assert.ok(words.length > 3);
    assert.equal(words.join(""), "早上喝一杯温水，身体更清醒。");
  });
  it("offset trỏ đúng vị trí trong chuỗi gốc", () => {
    const source = "Uống 白湯を 1杯";
    for (const t of wordTokens(source)) assert.equal(source.slice(t.offset, t.offset + t.text.length), t.text);
  });
});

describe("guessLanguage", () => {
  const cases: [string, string | undefined][] = [
    ["Mẹo uống nước buổi sáng", "vi"], ["Đi đâu đó", "vi"],
    ["Morning water tips", undefined], ["Un château pour être heureux", undefined],
    ["朝の水分補給のコツ", "ja"], ["早上喝一杯温水", "zh-Hans"], ["좋은 아침", "ko"], ["สวัสดีตอนเช้า", "th"],
  ];
  for (const [text, want] of cases) it(text, () => assert.equal(guessLanguage(text), want));
});
