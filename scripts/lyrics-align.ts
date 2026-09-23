/**
 * Khớp lời người dùng dán (lời bài hát, lời thoại đúng chính tả) với tiếng trong file: chữ lấy từ lời dán, thời gian
 * lấy từ bản phiên âm của whisper.
 *
 * Whisper nghe bài hát hay sai chữ ("giấc mông" thay "giấc mộng", "nhẹ quần" thay "nhẹ nhàng") nhưng mốc thời gian
 * của nó vẫn bám đúng lúc hát. Nên so hai chuỗi theo từng ký tự (bỏ dấu, bỏ khoảng trắng — sai dấu hay dính chữ vẫn
 * khớp), mỗi ký tự của lời dán mượn thời gian của ký tự tương ứng trong bản phiên âm, rồi mỗi dòng lời lấy mốc từ ký
 * tự đầu và cuối của nó. Dòng không khớp chữ nào (whisper bỏ sót) nằm vào khoảng giữa hai dòng kề.
 */
import type { Caption } from "../src/compositions/Short/schema";
import { splitText } from "./subtitle-align";

/** Dòng tách từ ô nhập: bỏ dòng trống, nhãn đoạn ("[ĐK]", "(x2)") và chữ "ĐK:" / "Điệp khúc:" đầu dòng. */
export const lyricLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(đk|dk|điệp khúc|diep khuc|verse\s*\d*|chorus|bridge|intro|outro)\s*[:.\-–]\s*/i, "").trim())
    .filter((line) => line && !/^[[(].*[\])]$/.test(line));

/** Gõ kèm file âm thanh từ chừng này dòng trở lên thì coi là lời để khớp; ít hơn là tiêu đề. */
export const LYRICS_MIN_LINES = 3;

/** Chữ thường, bỏ dấu (đ → d), chỉ giữ chữ và số. */
const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Trần ô bảng so khớp (≈ byte bộ nhớ) — quá thì chia đều thời gian theo số chữ thay vì so từng ký tự. */
const MAX_CELLS = 40_000_000;
const MIN_LINE_MS = 700;
/** Dòng hiện thêm chừng này sau chữ cuối (nếu chưa tới dòng sau) — chữ cuối của câu hát thường ngân dài. */
const HOLD_MS = 400;

/**
 * lyrics: lời dán, mỗi dòng một câu. transcript: phụ đề whisper (hàng chính). Trả phụ đề mới — chữ của lời dán,
 * mốc của bản phiên âm. Dòng dài hơn `maxChars` chia nhỏ như phụ đề thường.
 */
export const alignLyrics = (lyrics: string[], transcript: Caption[], durationMs: number, maxChars = 42): Caption[] => {
  const rows = transcript.filter((caption) => !caption.track && caption.text.trim()).sort((a, b) => a.startMs - b.startMs);
  const lines = lyrics.flatMap((line) => splitText(line, maxChars));
  if (lines.length === 0) return [];
  const speechStart = rows[0]?.startMs ?? 0;
  const speechEnd = rows[rows.length - 1]?.endMs ?? durationMs;

  // Ký tự của bản phiên âm, mỗi ký tự một mốc (rải đều trong dòng phụ đề chứa nó).
  const heard: string[] = [];
  const heardMs: number[] = [];
  for (const row of rows) {
    const chars = fold(row.text);
    for (let k = 0; k < chars.length; k++) {
      heard.push(chars[k]);
      heardMs.push(row.startMs + ((k + 0.5) / chars.length) * (row.endMs - row.startMs));
    }
  }
  // Ký tự của lời dán, nhớ thuộc dòng nào.
  const want: string[] = [];
  const lineOf: number[] = [];
  lines.forEach((line, index) => {
    for (const char of fold(line)) {
      want.push(char);
      lineOf.push(index);
    }
  });

  const n = want.length;
  const m = heard.length;
  /** Mốc của từng ký tự lời dán; NaN = không khớp ký tự nào. */
  const at = new Float64Array(n).fill(NaN);
  if (n > 0 && m > 0 && (n + 1) * (m + 1) <= MAX_CELLS) {
    // So khớp bán toàn cục: bỏ qua đầu/cuối bản phiên âm không tốn gì (nhạc dạo whisper nghe nhầm thành chữ, hay
    // đoạn lời dán không có), còn mỗi ký tự của lời dán phải khớp, bị thay, hoặc tính là thiếu.
    const width = m + 1;
    const moves = new Uint8Array((n + 1) * width); // 0 chéo · 1 lên (ký tự lời dán không có tiếng) · 2 trái (bỏ ký tự nghe được)
    let prev = new Uint32Array(width);
    let cur = new Uint32Array(width);
    for (let i = 1; i <= n; i++) {
      cur[0] = i;
      moves[i * width] = 1;
      for (let j = 1; j <= m; j++) {
        const diag = prev[j - 1] + (want[i - 1] === heard[j - 1] ? 0 : 1);
        const up = prev[j] + 1;
        const left = cur[j - 1] + 1;
        if (diag <= up && diag <= left) { cur[j] = diag; moves[i * width + j] = 0; }
        else if (up <= left) { cur[j] = up; moves[i * width + j] = 1; }
        else { cur[j] = left; moves[i * width + j] = 2; }
      }
      [prev, cur] = [cur, prev];
    }
    let j = 0;
    for (let k = 1; k <= m; k++) if (prev[k] < prev[j]) j = k;
    let i = n;
    while (i > 0) {
      const move = j === 0 ? 1 : moves[i * width + j];
      if (move === 0) {
        at[i - 1] = heardMs[j - 1];
        i--; j--;
      } else if (move === 1) {
        i--;
      } else {
        j--;
      }
    }
  }

  // Mốc từng dòng: ký tự khớp đầu và cuối của dòng.
  const starts: number[] = lines.map(() => NaN);
  const ends: number[] = lines.map(() => NaN);
  for (let k = 0; k < n; k++) {
    if (Number.isNaN(at[k])) continue;
    const line = lineOf[k];
    if (Number.isNaN(starts[line])) starts[line] = at[k];
    ends[line] = at[k];
  }
  // Dòng không khớp chữ nào: chia đều khoảng trống giữa hai dòng khớp kề nó (hay đầu/cuối phần có tiếng).
  for (let a = 0; a < lines.length; a++) {
    if (!Number.isNaN(starts[a])) continue;
    let b = a;
    while (b < lines.length && Number.isNaN(starts[b])) b++;
    const from = a > 0 ? ends[a - 1] : speechStart;
    const to = b < lines.length ? starts[b] : speechEnd;
    const step = Math.max(0, to - from) / (b - a);
    for (let k = a; k < b; k++) {
      starts[k] = from + step * (k - a);
      ends[k] = from + step * (k - a + 1);
    }
    a = b - 1;
  }

  const captions: Caption[] = lines.map((text, k) => ({ text, startMs: Math.round(starts[k]), endMs: Math.round(ends[k]), audio: null }));
  for (let k = 0; k < captions.length; k++) {
    const next = k < captions.length - 1 ? captions[k + 1].startMs : durationMs;
    const caption = captions[k];
    caption.startMs = Math.max(caption.startMs, k > 0 ? captions[k - 1].endMs : 0);
    caption.endMs = Math.min(Math.max(caption.endMs + HOLD_MS, caption.startMs + MIN_LINE_MS), Math.max(next, caption.startMs), durationMs);
  }
  return captions.filter((caption) => caption.endMs > caption.startMs);
};
