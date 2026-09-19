/**
 * Cắt video dài thành nhiều video ngắn: từ bản phiên âm (câu + mốc giờ), AI chọn những đoạn đứng riêng được,
 * mở đầu bằng câu gây tò mò — mỗi đoạn thành một video dọc.
 *
 *   await pickClips(captions, { count: 5, minSeconds: 20, maxSeconds: 60 })
 *     → [{ start: 83.4, end: 131.0, title: "…", reason: "…", firstLine: "…" }]
 *
 * AI chỉ trả số thứ tự câu đầu/cuối; mốc giờ lấy lại từ bản phiên âm nên cắt luôn đúng mép câu. normalizeClips
 * sửa những gì model hay làm sai: đoạn quá dài/ngắn, chồng lên nhau, số câu ngoài phạm vi.
 */
import { askJson, parseJson, type JsonReply } from "./llm-json";
import type { ProviderChoice } from "./generate-script";

export type TimedLine = { text: string; startMs: number; endMs: number };
export type ClipPick = { start: number; end: number; title: string; reason: string; firstLine: string };
type RawPick = { start_line?: unknown; end_line?: unknown; title?: unknown; reason?: unknown };

/** Bản phiên âm dài hơn thế thì cắt bớt đuôi — model nhỏ tràn ngữ cảnh (~1 giờ nói). */
const MAX_TRANSCRIPT_CHARS = 60_000;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const SYSTEM = (count: number, minSeconds: number, maxSeconds: number) =>
  `Bạn là biên tập viên cắt video ngắn (TikTok/Reels/Shorts) từ một video dài (podcast, bài nói, phỏng vấn, livestream).
Nhận bản phiên âm, mỗi dòng: [số câu] mốc giờ lời nói. Chọn ${count} đoạn hay nhất để đăng thành video riêng.

Luật:
- Mỗi đoạn dài ${minSeconds}–${maxSeconds} giây, gồm các câu LIÊN TIẾP (start_line tới end_line, tính cả hai).
- Đoạn phải đứng riêng được: người xem không cần xem phần trước vẫn hiểu. Không bắt đầu giữa ý, không kết thúc lửng.
- Câu đầu của đoạn phải giữ chân người xem: một nhận định bất ngờ, câu hỏi, con số, chuyện có xung đột.
  Nếu ý hay nằm sau một câu dẫn nhạt, bắt đầu từ câu hay đó.
- Ưu tiên: lời khuyên cụ thể, câu chuyện có kết, quan điểm gây tranh luận, khoảnh khắc hài hoặc cảm xúc.
- Các đoạn KHÔNG chồng lên nhau, ưu tiên rải khắp video.
- "title": câu hook ngắn cho video, tối đa 60 ký tự, viết bằng ngôn ngữ của lời nói, đúng nội dung đoạn — không giật tít sai.
- "reason": một câu ngắn vì sao đoạn này hay.
Chỉ trả về MỘT object JSON: {"clips":[{"start_line":0,"end_line":0,"title":"","reason":""}]}`;

const readPicks = (reply: JsonReply): RawPick[] => {
  const parsed = parseJson<unknown>(reply);
  const list = Array.isArray(parsed) ? parsed : (parsed as { clips?: unknown })?.clips;
  if (!Array.isArray(list)) throw new Error(`${reply.who} trả về sai cấu trúc — cần {"clips":[…]}.`);
  return list as RawPick[];
};

/**
 * Sửa lựa chọn của model cho dùng được: số câu trong phạm vi, đoạn quá dài thì bỏ bớt câu cuối, quá ngắn thì nối
 * thêm câu sau (tới giới hạn), bỏ đoạn chồng lên đoạn đã nhận, xếp theo thứ tự trong video.
 */
export const normalizeClips = (
  raw: RawPick[],
  lines: TimedLine[],
  { count, minSeconds, maxSeconds }: { count: number; minSeconds: number; maxSeconds: number },
): ClipPick[] => {
  const last = lines.length - 1;
  const out: (ClipPick & { a: number; b: number })[] = [];
  const dur = (a: number, b: number) => (lines[b].endMs - lines[a].startMs) / 1000;
  for (const pick of raw) {
    let a = Math.round(Number(pick.start_line));
    let b = Math.round(Number(pick.end_line));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    a = Math.max(0, Math.min(last, a));
    b = Math.max(a, Math.min(last, b));
    while (b > a && dur(a, b) > maxSeconds) b--;
    while (b < last && dur(a, b) < minSeconds && dur(a, b + 1) <= maxSeconds) b++;
    // Ngắn hơn một nửa mức tối thiểu thì không đủ thành một video.
    if (dur(a, b) < minSeconds * 0.5) continue;
    if (out.some((c) => a <= c.b && b >= c.a)) continue;
    const title = String(pick.title ?? "").replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "").trim().slice(0, 60);
    out.push({
      a, b,
      start: lines[a].startMs / 1000,
      end: lines[b].endMs / 1000,
      title: title || lines[a].text.slice(0, 60),
      reason: String(pick.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
      firstLine: lines[a].text,
    });
    if (out.length >= count) break;
  }
  return out.sort((x, y) => x.a - y.a).map((c) => ({ start: c.start, end: c.end, title: c.title, reason: c.reason, firstLine: c.firstLine }));
};

export const pickClips = async (
  lines: TimedLine[],
  opts: { count: number; minSeconds: number; maxSeconds: number; provider?: ProviderChoice },
): Promise<ClipPick[]> => {
  if (lines.length === 0) throw new Error("Không nghe ra câu nào trong file này.");
  let transcript = "";
  for (const [i, line] of lines.entries()) {
    const row = `[${i}] ${clock(line.startMs)} ${line.text}\n`;
    if (transcript.length + row.length > MAX_TRANSCRIPT_CHARS) break;
    transcript += row;
  }
  const { value } = await askJson(
    opts.provider ?? "auto",
    {
      system: SYSTEM(opts.count, opts.minSeconds, opts.maxSeconds),
      user: `Tổng thời lượng: ${clock(lines[lines.length - 1].endMs)}\n\nBẢN PHIÊN ÂM:\n${transcript}`,
      schema: {
        type: "object",
        properties: {
          clips: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start_line: { type: "integer" }, end_line: { type: "integer" },
                title: { type: "string" }, reason: { type: "string" },
              },
              required: ["start_line", "end_line", "title", "reason"],
            },
          },
        },
        required: ["clips"],
      },
      temperature: 0.4,
      maxTokens: 3000,
      slowHint: "thử video ngắn hơn hoặc ít đoạn hơn",
    },
    readPicks,
    "Chọn đoạn hay cần AI — điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí).",
  );
  const clips = normalizeClips(value, lines, opts);
  if (clips.length === 0) throw new Error("AI không chọn được đoạn nào đủ dài — thử độ dài mỗi đoạn ngắn hơn.");
  return clips;
};
