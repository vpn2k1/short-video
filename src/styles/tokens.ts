/**
 * Tách lời thành "từ" cho các phong cách bật từng từ (Chữ động, Phụ đề từng từ).
 *
 * Tách theo khoảng trắng là đủ cho tiếng Việt, Anh, Hàn… nhưng tiếng Nhật và Trung không có dấu cách: cả câu thành
 * một "từ" khổng lồ, phong cách phải thu nhỏ nó lại cho vừa khung. Cụm chữ Hán/Kana nên được cắt bằng Intl.Segmenter
 * (có sẵn trong Chrome — trình render của Remotion); dấu câu dính vào từ đứng trước để không đứng lẻ một khối.
 *
 *   wordTokens("朝の水分補給のコツ")  →  [{ text: "朝", offset: 0 }, { text: "の", offset: 1 }, { text: "水分", offset: 2 }…]
 */
export type Token = { text: string; offset: number };

/** Chữ Hán, Hiragana, Katakana (kể cả dạng nửa độ rộng) — những chữ viết liền không cách. */
const CJK = /[぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/u;

/** 1–2 chữ hiragana: trợ từ, đuôi chia động từ — gộp vào từ trước. */
const HIRAGANA_TAIL = /^[\u3040-\u309f]{1,2}$/u;

type Segment = { segment: string; index: number; isWordLike?: boolean };
type SegmenterLike = { segment: (text: string) => Iterable<Segment> };

const segmenter = (): SegmenterLike | null => {
  const Ctor = (Intl as unknown as { Segmenter?: new (locale: string, opts: { granularity: "word" }) => SegmenterLike }).Segmenter;
  return Ctor ? new Ctor("ja", { granularity: "word" }) : null;
};

export const wordTokens = (source: string): Token[] => {
  const out: Token[] = [];
  const seg = CJK.test(source) ? segmenter() : null;
  const re = /\S+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const chunk = m[0];
    if (!seg || !CJK.test(chunk)) {
      out.push({ text: chunk, offset: m.index });
      continue;
    }
    for (const s of seg.segment(chunk)) {
      const text = s.segment.trim();
      if (!text) continue;
      const prev = out[out.length - 1];
      const touching = prev && prev.offset + prev.text.length === m.index + s.index && CJK.test(prev.text);
      // Dấu câu (。、！？「」…) và hiragana ngắn (trợ từ の が を に…, đuôi động từ き て…) không đứng một mình:
      // dính vào từ liền trước — "起" "き" "て" thành "起きて", "水分" "の" thành "水分の".
      if (touching && (!s.isWordLike || HIRAGANA_TAIL.test(text))) {
        prev.text += text;
        continue;
      }
      out.push({ text, offset: m.index + s.index });
    }
  }
  return out;
};
