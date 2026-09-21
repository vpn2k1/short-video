/**
 * Kiểm thử thư viện hook (scripts/hook-library.ts): dữ liệu mẫu và đoạn prompt gửi cho AI.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOOK_GROUPS, HOOK_TEMPLATES, HOOK_TYPES, hookCatalog, hookLabel, hookSection, hookTemplate, isHookChoice,
} from "../scripts/hook-library";

describe("dữ liệu thư viện hook", () => {
  it("id không trùng và nhóm nào cũng có thật", () => {
    const ids = HOOK_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    const groups = new Set(HOOK_GROUPS.map((g) => g.id));
    for (const t of HOOK_TEMPLATES) assert.ok(groups.has(t.group), `nhóm lạ: ${t.group}`);
  });

  it("mẫu nào cũng có công thức và câu ví dụ", () => {
    for (const t of HOOK_TEMPLATES) {
      assert.ok(t.formula.trim(), t.id);
      assert.ok(t.example.trim(), t.id);
    }
  });

  it("catalog cho giao diện đủ nhóm, không nhóm rỗng", () => {
    const catalog = hookCatalog();
    assert.ok(catalog.length >= 4);
    for (const group of catalog) assert.ok(group.templates.length > 0, group.id);
    assert.equal(catalog.flatMap((g) => g.templates).length, HOOK_TEMPLATES.length);
  });
});

describe("isHookChoice", () => {
  it("nhận 'auto' và id có thật, loại giá trị lạ", () => {
    assert.ok(isHookChoice("auto"));
    assert.ok(isHookChoice(HOOK_TEMPLATES[0].id));
    assert.ok(!isHookChoice("khong-co-that"));
    assert.ok(!isHookChoice(undefined));
    assert.ok(!isHookChoice(3));
  });
});

describe("hookSection", () => {
  it("chọn mẫu: prompt có công thức, có câu ví dụ và ghi rõ thắng luật chung", () => {
    const template = hookTemplate("dont-do")!;
    const text = hookSection("dont-do", "mẹo giữ pin");
    assert.match(text, new RegExp(template.formula.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(text.includes(template.example));
    assert.match(text, /thắng các luật hook chung/);
  });

  it("'auto' hoặc id lạ: quay về gợi ý kiểu hook như trước", () => {
    for (const choice of ["auto", undefined, "khong-co-that"]) {
      const text = hookSection(choice, "mẹo giữ pin điện thoại");
      assert.match(text, /KIỂU HOOK GỢI Ý/);
      assert.ok(HOOK_TYPES.some((type) => text.includes(type)), text);
    }
  });

  it("'auto': cùng prompt ra cùng kiểu, prompt khác nhau không dồn hết vào một kiểu", () => {
    assert.equal(hookSection("auto", "mẹo giữ pin"), hookSection("auto", "mẹo giữ pin"));
    const kinds = new Set(["pin", "nấu phở", "Nokia sụp đổ", "học tiếng Anh", "đố mẹo", "cá mập", "tiết kiệm điện"]
      .map((prompt) => HOOK_TYPES.find((type) => hookSection("auto", prompt).includes(type))));
    assert.ok(kinds.size > 1, [...kinds].join(", "));
  });
});

describe("hookLabel", () => {
  it("nhãn chip: công thức của mẫu, còn lại là Tự động", () => {
    assert.equal(hookLabel("a-or-b"), hookTemplate("a-or-b")!.formula);
    assert.equal(hookLabel("auto"), "Tự động");
    assert.equal(hookLabel(undefined), "Tự động");
    assert.equal(hookLabel("khong-co-that"), "Tự động");
  });
});
