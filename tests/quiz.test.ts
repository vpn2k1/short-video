import { test } from "node:test";
import assert from "node:assert/strict";
import { textToScript } from "../scripts/text-script";
import { scriptToProps } from "../src/compositions/Short/script";
import { analyzeScenes } from "../src/styles/quiz/theme";

const TEXT = `# BẠN TRẢ LỜI ĐƯỢC MẤY CÂU?

> 2 câu tiếng Anh giao tiếp

[CÂU 1]
Bạn bị đau đầu và muốn mua thuốc.
Từ nào có nghĩa là “đau đầu”?

A. Fever
B. Headache
C. Cough

Đáp án là **B. Headache**.

[CÂU 2]
Bạn đến khách sạn và muốn xác nhận việc đặt phòng.
Bạn hỏi câu nào?

A. Do you have a reservation?
B. Do you have a passport?

Đáp án là **A. Do you have a reservation?**

Bạn đúng được bao nhiêu câu?

**2 câu:** Excellent! 🌟
**0–1 câu:** Keep practicing! 💪

Bạn đúng mấy câu? Bình luận nhé!`;

test("câu đố dán vào: lựa chọn và đáp án gộp vào cảnh câu hỏi, bảng xếp loại thành một cảnh", () => {
  const { script } = textToScript(TEXT, { style: "auto" });
  assert.equal(script.style, "quiz");
  assert.equal(script.scenes.length, 3);
  assert.deepEqual(script.scenes[0].lines.slice(2), ["A. Fever", "B. Headache", "C. Cough", "Đáp án là B. Headache."]);
  assert.equal(script.scenes[0].punch, "B. Headache");
  assert.equal(script.scenes[2].punch, null);
  assert.equal(script.scenes[2].lines.length, 4);
});

test("trắc nghiệm: đồng hồ đếm sau lựa chọn cuối, đáp án đúng theo chữ cái, bảng xếp loại không tính là câu", () => {
  const { script } = textToScript(TEXT, { style: "quiz" });
  const props = scriptToProps(script, { startAtFrame: 70, style: "quiz" });
  const infos = analyzeScenes(props.scenes, props.captions, true);

  const [q1, q2, score] = infos;
  assert.equal(q1.context, "Bạn bị đau đầu và muốn mua thuốc.");
  assert.equal(q1.question, "Từ nào có nghĩa là “đau đầu”?");
  assert.deepEqual(q1.options.map((o) => [o.letter, o.correct]), [["A", false], ["B", true], ["C", false]]);
  // Lựa chọn có "?" không bị nhầm là câu hỏi.
  assert.equal(q2.question, "Bạn hỏi câu nào?");
  assert.equal(q2.options[0].correct, true);
  // Khoảng lặng 3 s nằm giữa lựa chọn cuối và câu đáp án, không phải trước lựa chọn A.
  const lastOption = props.captions.find((c) => c.text === "C. Cough")!;
  const answer = props.captions.find((c) => c.text.startsWith("Đáp án là B"))!;
  assert.ok(answer.startMs - lastOption.endMs >= 2900);
  assert.ok(q1.countdown && q1.revealFrame! > q1.options[2].frame);

  assert.equal(score.scores.length, 2);
  assert.equal(score.label, "KẾT QUẢ");
  assert.equal(q2.label, "CÂU 2");
});
