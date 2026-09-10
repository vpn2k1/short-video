import type { Caption as WordToken } from "@remotion/captions";
import type { Caption } from "../src/compositions/Short/schema";

/**
 * Giới hạn theo SỐ KÝ TỰ, không theo số từ.
 *
 * Đếm từ là sai đơn vị cho tiếng Việt: mỗi âm tiết tính là một từ nên "7 từ"
 * chỉ bằng khoảng 3 từ tiếng Anh, dòng ngắn cụt và hay cắt giữa cụm
 * ("…tưởng như bình" / "thường…"). Chuẩn phụ đề quốc tế dùng 37-42 ký tự một
 * dòng — con số đó đúng cho mọi ngôn ngữ.
 */
const MAX_CHARS = 42;
/** Sàn tối thiểu để không đẻ ra dòng một chữ. */
const MIN_WORDS = 2;
/** Khoảng lặng đủ dài thì ngắt dòng, dù chưa đủ số từ. */
const PAUSE_MS = 700;

const endsSentence = (text: string) => /[.!?…:]["')\]]?\s*$/.test(text);
/** Dấu ngắt nhẹ — chỗ cắt dòng chấp nhận được. */
const endsClause = (text: string) => /[,;–—][")\]]?\s*$/.test(text);

type Word = { text: string; startMs: number; endMs: number };

/**
 * Ghép token BPE của whisper thành TỪ.
 *
 * Bắt buộc phải làm bước này trước khi gom dòng: token không phải là từ, và một
 * ký tự tiếng Việt nhiều byte có thể nằm vắt qua hai token. Cắt giữa token là
 * vỡ ký tự — phụ đề ra "Dư<?>i những ngọn c<?>". Token mới bắt đầu bằng khoảng
 * trắng là mốc sang từ mới (khoảng trắng luôn là ASCII nên nhận diện an toàn).
 */
export const tokensToWords = (tokens: WordToken[]): Word[] => {
  const words: Word[] = [];
  let current: Word | null = null;

  for (const token of tokens) {
    if (token.text === "") {
      continue;
    }
    const startsNewWord = /^\s/.test(token.text);

    if (current === null || startsNewWord) {
      if (current !== null && current.text.trim() !== "") {
        words.push({ ...current, text: current.text.trim() });
      }
      current = {
        text: token.text,
        startMs: token.startMs,
        endMs: token.endMs,
      };
    } else {
      current.text += token.text;
      current.endMs = token.endMs;
    }
  }

  if (current !== null && current.text.trim() !== "") {
    words.push({ ...current, text: current.text.trim() });
  }

  return words;
};

/**
 * Gom từ thành dòng phụ đề đọc được.
 * Ngắt ở dấu câu, ở khoảng lặng dài, hoặc khi chạm trần số từ — theo thứ tự ưu
 * tiên đó, để dòng cắt theo ý chứ không cắt máy móc.
 */
export const groupIntoLines = (tokens: WordToken[]): Caption[] => {
  const words = tokensToWords(tokens);
  const lines: Caption[] = [];
  let buffer: Word[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    lines.push({
      text: buffer.map((word) => word.text).join(" "),
      startMs: Math.round(buffer[0].startMs),
      endMs: Math.round(buffer[buffer.length - 1].endMs),
      audio: null,
    });
    buffer = [];
  };

  const bufferChars = () =>
    buffer.reduce((sum, word) => sum + word.text.length + 1, -1);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Thêm từ này có vượt trần ký tự không? Nếu có thì chốt dòng trước đã.
    const wouldExceed =
      buffer.length > 0 && bufferChars() + 1 + word.text.length > MAX_CHARS;
    if (wouldExceed && buffer.length >= MIN_WORDS) {
      flush();
    }

    buffer.push(word);

    const next = words[i + 1];
    const gapMs = next ? next.startMs - word.endMs : Infinity;

    const atSentenceEnd = endsSentence(word.text) && buffer.length >= MIN_WORDS;
    const atLongPause = gapMs >= PAUSE_MS && buffer.length >= MIN_WORDS;
    // Ngắt ở dấu phẩy khi dòng đã đủ dài — dòng cắt theo ý, không cắt máy móc.
    const atClause =
      endsClause(word.text) && bufferChars() >= MAX_CHARS * 0.6;

    if (atSentenceEnd || atLongPause || atClause) {
      flush();
    }
  }

  flush();
  return lines;
};
