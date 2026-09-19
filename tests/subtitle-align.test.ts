/**
 * Kiểm thử khớp phụ đề tự động (scripts/subtitle-align.ts) và mốc DTW từng từ (scripts/transcribe.ts).
 * Số liệu lấy từ một video hội thoại có tiếng xe và nhạc nền thật: whisper medium, ffmpeg silencedetect,
 * lúc bắt đầu nói đọc từ đường năng lượng của file. Chạy: npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignCaptions, type Segment, type Span } from "../scripts/subtitle-align";
import { dtwMarks } from "../scripts/transcribe";

const seg = (text: string, startMs: number, endMs: number, marks: [number, number][]): Segment => ({
  text, startMs, endMs, marks: marks.map(([at, ms]) => ({ at, ms })),
});
const plain = (segments: Segment[]) => segments.map((segment) => ({ ...segment, marks: undefined }));
const find = (captions: { text: string; startMs: number; endMs: number }[], text: string) => {
  const caption = captions.find((c) => c.text === text);
  assert.ok(caption, `thiếu dòng "${text}" trong ${JSON.stringify(captions.map((c) => c.text))}`);
  return caption;
};
const near = (got: number, want: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(got - want) <= tolerance, `${label}: ${got}ms, cần ${want}±${tolerance}ms`);

// Mép đoạn của whisper tròn giây, đoạn sau bắt đầu đúng lúc đoạn trước dứt dù giữa là 8 giây tiếng xe.
const bus = [
  seg("Is the bus coming soon?", 0, 2800, [[0, 1600], [3, 1740], [7, 1880], [11, 2140], [18, 2500]]),
  seg("I think so. It should be here in a few minutes.", 2800, 5000, [[0, 2900], [2, 3100], [8, 3460], [12, 3760], [15, 3900], [22, 4100], [25, 4220], [30, 4360], [33, 4460], [35, 4560], [39, 5980]]),
  seg("Two tickets, please.", 5000, 15000, [[0, 13760], [4, 13980], [13, 14560]]),
  seg("Sure, that's 20,000 dong.", 15000, 17000, [[0, 15760], [6, 16060], [13, 16360], [20, 16920]]),
  seg("Quick quiz. What do you call the person who drives the bus?", 17000, 23000, [[0, 21280], [6, 21560], [12, 21740], [17, 21900], [20, 21900], [24, 22000], [29, 22140], [33, 22360], [40, 22560], [44, 22700], [51, 22880], [55, 23280]]),
  seg("The answer is B.", 23000, 29000, [[0, 27520], [4, 27820], [11, 28100], [14, 28420]]),
  seg("(eerie music)", 29000, 29840, [[0, 29820], [7, 29820]]),
];
// Từ 17s có nhạc nền: silencedetect không thấy chỗ lặng nào nữa.
const busSilences: Span[] = [
  { startMs: 0, endMs: 1491 }, { startMs: 2437, endMs: 2790 }, { startMs: 3336, endMs: 3640 },
  { startMs: 4931, endMs: 6218 }, { startMs: 14954, endMs: 15402 }, { startMs: 16826, endMs: 17151 },
];

describe("alignCaptions với mốc DTW", () => {
  const captions = alignCaptions(bus, busSilences, 30016);

  it("câu nói sau quãng ồn dài hiện đúng lúc nói, không từ lúc câu trước dứt", () => {
    const line = find(captions, "Two tickets, please.");
    near(line.startMs, 13550, 300, "Two tickets");
    assert.ok(line.endMs <= 15000, `hết lúc ${line.endMs}ms`);
  });

  it("nhạc nền không có chỗ lặng: từng dòng theo mốc của chữ đầu dòng", () => {
    near(find(captions, "Quick quiz.").startMs, 21050, 300, "Quick quiz");
    near(find(captions, "What do you call the person").startMs, 21550, 300, "What do you call");
    near(find(captions, "The answer is B.").startMs, 27400, 300, "The answer");
    assert.ok(find(captions, "The answer is B.").endMs <= 29000);
  });

  it("chỗ có khoảng lặng thật vẫn khớp theo khoảng lặng", () => {
    const first = find(captions, "Is the bus coming soon?");
    assert.equal(first.startMs, 1491);
    assert.equal(first.endMs, 2437);
    // Mốc DTW của "minutes" rơi vào khoảng lặng phía sau — câu vẫn tắt khi ngừng nói.
    assert.equal(find(captions, "It should be here in a few minutes.").endMs, 4931);
  });

  it("thứ tự và chữ giữ nguyên, bỏ chú thích âm thanh", () => {
    assert.deepEqual(captions.map((c) => c.text), [
      "Is the bus coming soon?", "I think so.", "It should be here in a few minutes.", "Two tickets, please.",
      "Sure, that's 20,000 dong.", "Quick quiz.", "What do you call the person", "who drives the bus?", "The answer is B.",
    ]);
    for (let i = 1; i < captions.length; i++) assert.ok(captions[i].startMs >= captions[i - 1].endMs);
  });

  it("không có mốc DTW thì vẫn chạy như cũ theo mép whisper", () => {
    const old = alignCaptions(plain(bus), busSilences, 30016);
    assert.equal(old.length, captions.length);
    assert.equal(find(old, "Is the bus coming soon?").startMs, 1491);
  });

  it("từ đầu đoạn bị kéo về đầu quãng nhạc dạo thì tính ngược từ từ kế", () => {
    const [line] = alignCaptions([seg("Is the bus coming soon?", 0, 4000, [[0, 80], [3, 2820], [7, 3000], [11, 3280], [18, 3680]])], [], 30000);
    near(line.startMs, 2500, 300, "Is the bus");
  });

  it("gạch mở lượt thoại không có tiếng — lấy mốc của chữ đầu tiên", () => {
    const [line] = alignCaptions([seg("- Do you need help with those weights?", 7760, 16240, [[0, 11960], [2, 13840], [5, 13960], [9, 14080], [14, 14240], [19, 14400], [24, 14580], [30, 14920]])], [], 30000);
    near(line.startMs, 13700, 300, "Do you need help");
  });

  it("dòng tắt sau chữ cuối, không đợi qua quãng nhạc tới dòng sau", () => {
    const lines = alignCaptions([seg("Our flight is boarding soon. Quick quiz.", 16240, 20920, [[0, 16520], [4, 16680], [11, 16880], [14, 17060], [23, 17520], [29, 20460], [35, 20860]])], [], 30000);
    assert.ok(find(lines, "Our flight is boarding soon.").endMs < 18200);
    near(find(lines, "Quick quiz.").startMs, 20200, 300, "Quick quiz");
  });

  it("câu whisper tự bịa trong tiếng ồn (mọi từ dồn một mốc) bị bỏ", () => {
    const text = "Hãy đăng ký kênh để xem những video mới nhất.";
    const marks = [...text.matchAll(/\S+/g)].map((m): [number, number] => [m.index!, 15960]);
    const lines = alignCaptions([seg("Được rồi!", 11900, 14900, [[0, 13740], [5, 14260]]), seg(text, 14900, 16000, marks)], [], 16000);
    assert.deepEqual(lines.map((l) => l.text), ["Được rồi!"]);
  });
});

describe("dtwMarks", () => {
  const tok = (text: string, t: number) => ({ text, t_dtw: t });

  it("mỗi từ một mốc, bỏ token đặc biệt", () => {
    assert.deepEqual(
      dtwMarks("Two tickets, please.", [tok("[_BEG_]", -1), tok(" Two", 1376), tok(" tickets", 1398), tok(",", 1412), tok(" please", 1456), tok(".", 1552), tok("[_TT_750]", -1)]),
      [{ at: 0, ms: 13760 }, { at: 4, ms: 13980 }, { at: 13, ms: 14560 }],
    );
  });

  it("token cắt giữa chữ có dấu (vỡ thành U+FFFD) vẫn ra đúng đầu từ", () => {
    assert.deepEqual(
      dtwMarks("Chào mọi người,", [tok(" Ch", 164), tok("\uFFFD", 170), tok("\uFFFDo", 176), tok(" m", 212), tok("\uFFFD\uFFFD", 220), tok(" ng", 258), tok("\uFFFD\uFFFD", 262), tok("i", 266), tok(",", 270)]),
      [{ at: 0, ms: 1640 }, { at: 5, ms: 2120 }, { at: 9, ms: 2580 }],
    );
  });

  it("chữ không có dấu cách (tiếng Trung) thì mốc theo vị trí token", () => {
    assert.deepEqual(
      dtwMarks("早上喝一杯温水", [tok(" 早上", 100), tok("喝", 150), tok("一杯", 180), tok("温水", 230)]),
      [{ at: 0, ms: 1000 }, { at: 2, ms: 1500 }, { at: 3, ms: 1800 }, { at: 5, ms: 2300 }],
    );
  });
});
