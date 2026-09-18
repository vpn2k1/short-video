/**
 * Đọc file phụ đề người dùng nhập vào tab Phụ đề thành danh sách câu.
 *
 * Nhận 4 kiểu, tự nhận dạng theo NỘI DUNG (không tin đuôi file, vì .srt hay bị đổi tên thành .txt):
 *
 *   SRT      1                                  VTT   WEBVTT
 *            00:00:01,000 --> 00:00:03,500            00:01.000 --> 00:03.500 align:center
 *            Xin chào các bạn                         Xin chào các bạn
 *
 *   JSON     [{ "text": "…", "startMs": 1000, "endMs": 3500 }]   (cũng nhận start/end tính bằng giây)
 *
 *   TXT      Xin chào các bạn                    ← mỗi dòng là MỘT câu phụ đề, không cần mốc giờ
 *            Hôm nay mình kể chuyện này
 *
 * Không có mốc giờ vẫn nhập được: thời gian để null, trình chỉnh sửa rải các câu nối tiếp nhau
 * theo độ dài chữ rồi người dùng kéo lại trên timeline.
 *
 * Hàm thuần, không đụng React — chạy được bằng tsx để test.
 */

/** Một câu đọc được từ file. startMs/endMs null = file không ghi giờ cho câu này. */
export type Cue = { text: string; startMs: number | null; endMs: number | null };

export type SubtitleFormat = "srt" | "vtt" | "json" | "txt-time" | "txt";

export type ParsedSubtitles = {
  cues: Cue[];
  format: SubtitleFormat;
  /** Điều đáng nói với người dùng (dòng bỏ qua, file quá dài…) — hiện ngay dưới nút nhập. */
  notes: string[];
};

export const FORMAT_LABELS: Record<SubtitleFormat, string> = {
  srt: "SRT (có mốc giờ)",
  vtt: "WebVTT (có mốc giờ)",
  json: "JSON (có mốc giờ)",
  "txt-time": "Văn bản có mốc giờ",
  txt: "Văn bản thường (mỗi dòng một câu)",
};

/** Cho thuộc tính accept của <input type="file">. */
export const SUBTITLE_ACCEPT = ".srt,.vtt,.txt,.json,.md,text/plain,application/json";

/** File nhìn như file phụ đề (để kéo thả vào tab Phụ đề thay vì tải lên như media). */
export const looksLikeSubtitleFile = (file: File) =>
  /\.(srt|vtt|txt|json|md)$/i.test(file.name) || file.type === "text/plain" || file.type === "application/json";

/** Quá số này thì cắt bớt — file dài bất thường làm treo danh sách phụ đề. */
const MAX_CUES = 800;

/** Mốc giờ: 00:01:02,500 · 01:02.500 · 1:02 — nhóm là giờ, phút, giây, mili giây. */
const TIME = /(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?/;
/** Dòng mốc giờ của SRT/VTT: "… --> …" (VTT cho phép thêm cài đặt phía sau). */
const CUE_LINE = new RegExp(`^\\s*${TIME.source}\\s*-->\\s*${TIME.source}(.*)$`);
/** Dòng văn bản mở đầu bằng mốc giờ: "00:03 Xin chào", "[0:03] Xin chào", "0:03 - 0:06 | Xin chào". */
const TXT_TIME_LINE = new RegExp(
  `^\\[?\\s*${TIME.source}\\s*\\]?` +                       // mốc bắt đầu
  `(?:\\s*(?:-{1,2}>?|–|→|đến)\\s*\\[?\\s*${TIME.source}\\s*\\]?)?` + // mốc kết thúc (tuỳ chọn)
  `\\s*[|:\\-–\\t]?\\s+(\\S.*)$`,                            // dấu ngăn rồi tới lời
);

const msOf = (h: string | undefined, m: string, s: string, frac: string | undefined) => {
  const milli = frac ? Number(frac.padEnd(3, "0")) : 0;
  return ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(s)) * 1000 + milli;
};

/** Gỡ thẻ <i>, <v Tên>, {\an8}, và mã HTML hay gặp trong file xuất từ YouTube. */
const cleanText = (raw: string) =>
  raw
    .replace(/<[^>]*>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const clip = (cues: Cue[], notes: string[]) => {
  if (cues.length <= MAX_CUES) return cues;
  notes.push(`File có ${cues.length} câu — chỉ lấy ${MAX_CUES} câu đầu.`);
  return cues.slice(0, MAX_CUES);
};

/**
 * SRT và VTT đọc chung một vòng: gặp dòng "-->" là mở câu mới, các dòng chữ phía sau là lời.
 * Không dựa vào dòng trống nên file thiếu dòng trống hay thừa khoảng trắng vẫn đọc được.
 */
const parseCueFile = (lines: string[], notes: string[]): Cue[] => {
  const cues: Cue[] = [];
  let open: { startMs: number; endMs: number; parts: string[] } | null = null;
  const close = () => {
    if (!open) return;
    const text = cleanText(open.parts.join(" "));
    if (text) cues.push({ text, startMs: open.startMs, endMs: open.endMs });
    open = null;
  };

  lines.forEach((line, i) => {
    const cue = line.match(CUE_LINE);
    if (cue) {
      close();
      const [, h1, m1, s1, f1, h2, m2, s2, f2] = cue;
      open = { startMs: msOf(h1, m1, s1, f1), endMs: msOf(h2, m2, s2, f2), parts: [] };
      return;
    }
    const text = line.trim();
    if (!text) { close(); return; }
    // Khối đầu file (WEBVTT, NOTE, STYLE) và số thứ tự SRT ngay trước dòng mốc giờ — không phải lời.
    if (!open) return;
    if (/^\d+$/.test(text) && CUE_LINE.test(lines[i + 1] ?? "")) return;
    open.parts.push(text);
  });
  close();

  if (cues.length === 0) notes.push("Không đọc được câu nào — kiểm tra lại mốc giờ trong file.");
  return cues;
};

/** JSON: mảng câu, hoặc { captions: [...] } lấy thẳng từ props.json. */
const parseJson = (raw: string, notes: string[]): Cue[] | null => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { captions?: unknown })?.captions)
      ? (data as { captions: unknown[] }).captions
      : null;
  if (!list) return null;

  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  /** start/end kiểu whisper hay Remotion tính bằng giây. */
  const seconds = (value: unknown) => {
    const n = num(value);
    return n === null ? null : Math.round(n * 1000);
  };
  const cues: Cue[] = [];
  let skipped = 0;
  for (const item of list) {
    if (typeof item === "string") {
      const text = cleanText(item);
      if (text) cues.push({ text, startMs: null, endMs: null });
      continue;
    }
    const row = item as Record<string, unknown>;
    const text = cleanText(String(row.text ?? row.line ?? row.content ?? ""));
    if (!text) { skipped++; continue; }
    // Khoá có đuôi Ms tính bằng mili giây; start/end tính bằng giây.
    const startMs = num(row.startMs) ?? num(row.start_ms) ?? seconds(row.start) ?? seconds(row.startInSeconds) ?? seconds(row.from);
    const endMs = num(row.endMs) ?? num(row.end_ms) ?? seconds(row.end) ?? seconds(row.endInSeconds) ?? seconds(row.to);
    cues.push({ text, startMs, endMs });
  }
  if (skipped) notes.push(`Bỏ qua ${skipped} mục không có chữ.`);
  return cues.length ? cues : null;
};

/** Mỗi dòng một câu; dòng mở đầu bằng mốc giờ thì lấy luôn giờ. */
const parseLines = (lines: string[], notes: string[]): { cues: Cue[]; format: SubtitleFormat } => {
  const texts = lines.map((l) => l.trim()).filter(Boolean);
  const timed = texts.map((line) => line.match(TXT_TIME_LINE));
  // Chỉ coi là "văn bản có mốc giờ" khi phần lớn dòng đều có — tránh nuốt câu kiểu "12:30 trưa nay…".
  const useTime = texts.length > 0 && timed.filter(Boolean).length >= Math.max(2, texts.length * 0.6);

  if (!useTime) {
    const cues = texts.map((text) => ({ text: cleanText(text), startMs: null, endMs: null })).filter((c) => c.text);
    notes.push("File không có mốc giờ — mỗi dòng thành một câu, thời gian rải nối tiếp nhau.");
    return { cues, format: "txt" };
  }

  const cues: Cue[] = [];
  let skipped = 0;
  timed.forEach((match, i) => {
    if (!match) {
      // Dòng lạc giữa file có giờ: nối vào câu ngay trước cho khỏi mất chữ.
      const text = cleanText(texts[i]);
      if (!text) return;
      if (cues.length) cues[cues.length - 1].text = `${cues[cues.length - 1].text} ${text}`;
      else skipped++;
      return;
    }
    const [, h1, m1, s1, f1, h2, m2, s2, f2, body] = match;
    const text = cleanText(body);
    if (!text) return;
    cues.push({
      text,
      startMs: msOf(h1, m1, s1, f1),
      endMs: m2 !== undefined ? msOf(h2, m2, s2, f2) : null,
    });
  });
  if (skipped) notes.push(`Bỏ qua ${skipped} dòng không đọc được mốc giờ.`);
  return { cues, format: "txt-time" };
};

/** Đọc nội dung file phụ đề. Luôn trả về danh sách câu — không đọc được thì cues rỗng. */
export const parseSubtitleFile = (raw: string): ParsedSubtitles => {
  const notes: string[] = [];
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!text) return { cues: [], format: "txt", notes: ["File rỗng."] };

  if (text.startsWith("{") || text.startsWith("[")) {
    const cues = parseJson(text, notes);
    if (cues) return { cues: clip(cues, notes), format: "json", notes };
    notes.push("Không đọc được JSON — thử đọc như văn bản thường.");
  }

  const lines = text.split("\n");
  if (lines.some((line) => CUE_LINE.test(line))) {
    const vtt = /^WEBVTT/i.test(text);
    return { cues: clip(parseCueFile(lines, notes), notes), format: vtt ? "vtt" : "srt", notes };
  }

  const { cues, format } = parseLines(lines, notes);
  return { cues: clip(cues, notes), format, notes };
};

/** Thời lượng file (câu cuối kết thúc lúc nào) — null khi file không có mốc giờ. */
export const cuesDurationMs = (cues: Cue[]): { fromMs: number; toMs: number } | null => {
  const timed = cues.filter((c) => c.startMs !== null);
  if (timed.length === 0) return null;
  return {
    fromMs: Math.min(...timed.map((c) => c.startMs as number)),
    toMs: Math.max(...timed.map((c) => (c.endMs ?? c.startMs) as number)),
  };
};

/** Mẫu cho người dùng xem và tải về — cũng là tài liệu sống của định dạng nhận vào. */
export const EXAMPLE_TXT = `Ba mẹo giúp bạn ngủ ngon hơn
Tắt đèn trắng trước khi ngủ một tiếng
Để điện thoại xa tầm với
Dậy đúng giờ kể cả cuối tuần`;

export const EXAMPLE_SRT = `1
00:00:00,000 --> 00:00:02,400
Ba mẹo giúp bạn ngủ ngon hơn

2
00:00:02,400 --> 00:00:05,000
Tắt đèn trắng trước khi ngủ một tiếng

3
00:00:05,000 --> 00:00:07,200
Để điện thoại xa tầm với`;

export const EXAMPLE_TXT_TIME = `00:00 Ba mẹo giúp bạn ngủ ngon hơn
00:02 Tắt đèn trắng trước khi ngủ một tiếng
00:05 Để điện thoại xa tầm với`;
