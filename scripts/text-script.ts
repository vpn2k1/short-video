/**
 * Kịch bản người dùng dán vào → VideoScript. KHÔNG gọi AI, không cần API key.
 *
 * Cú pháp (tất cả đều tuỳ chọn — văn bản trơn cũng chạy):
 *
 *   # Tiêu đề                    dòng tiêu đề (hoặc một dòng ngắn đứng riêng ở đầu)
 *   > Dòng phụ                   phụ đề của title card
 *   (dòng trống)                 sang cảnh mới
 *   [Mẹo 1]                      nhãn của cảnh (tag)
 *   Bật **chế độ tiết kiệm pin**  cụm trong ** ** là câu nhấn (punch)
 *   ! 80% | mức pin nên giữ      con số lớn (visual stat) + chú thích
 *
 * Câu dài hơn 90 ký tự được tách ở dấu câu. Dán nguyên JSON của script.json cũng được.
 */
import { MAX_SCRIPT_SCENES, parseScript, type ScriptScene, type VideoScript } from "../src/compositions/Short/script";
import type { StyleId } from "../src/styles/meta";

export const MAX_LINE = 90;
const MAX_LINES_PER_SCENE = 12;
export const MAX_SCENES = MAX_SCRIPT_SCENES;
/** Văn bản không có dòng trống: tự chia mỗi chừng này câu một cảnh. */
const AUTO_SCENE_SIZE = 3;

export type TextScriptOptions = {
  style: StyleId | "auto";
  /** Ảnh/video đính kèm — gán lần lượt cho từng cảnh. */
  uploads?: string[];
  /** Dán lại kịch bản cho video đã có: giữ ảnh cũ theo thứ tự cảnh. */
  previousImages?: (string | null)[];
  /** Phong cách hiện tại của video — "auto" thì giữ, không đoán lại. */
  previousStyle?: StyleId;
};

/** Cắt ở ranh giới từ — nhãn hay tiêu đề đứt giữa chữ trông như lỗi. */
const clipWords = (text: string, max: number) => {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.5 ? cut.slice(0, space) : t.slice(0, max)).trim();
};

const packGreedy = (pieces: string[]) => {
  const out: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const candidate = current ? `${current} ${piece}` : piece;
    if (candidate.length <= MAX_LINE) {
      current = candidate;
    } else {
      if (current) out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
};

/** Câu dài: tách ở dấu chấm/hỏi/than, rồi dấu phẩy, cuối cùng ở khoảng trắng. */
const splitLong = (line: string): string[] => {
  if (line.length <= MAX_LINE) return [line];
  return line.split(/(?<=[.!?…;:])\s+/).flatMap((sentence) => {
    if (sentence.length <= MAX_LINE) return [sentence];
    return packGreedy(sentence.split(/(?<=,)\s+/)).flatMap((chunk) =>
      chunk.length <= MAX_LINE ? [chunk] : packGreedy(chunk.split(/\s+/)).map((c) => c.slice(0, MAX_LINE)),
    );
  });
};

const TAG_LINE = /^\[(.+)\]$/;
const STAT_LINE = /^!\s*([^|]+?)\s*(?:\|\s*(.+))?$/;
const PUNCH_MARK = /\*\*(.+?)\*\*|\*(.+?)\*/;

/**
 * Đoán phong cách theo từ khoá khi người dùng để "Tự động" mà không có AI.
 * Đơn giản có chủ đích — sai thì người dùng chọn lại ở chip phong cách.
 */
const guessStyle = (all: string, scenes: ScriptScene[]): StyleId => {
  const lines = scenes.flatMap((s) => s.lines);
  // Hội thoại "Tên: lời nói" chiếm phần lớn kịch bản → giao diện tin nhắn.
  // "Bước 1:", "Mẹo:", "Lưu ý:" là nhãn mục chứ không phải tên người.
  const LABEL = /\d|^(bước|step|mẹo|tip|lưu ý|chú ý|ghi chú|kết luận|ví dụ|câu hỏi|đáp án|lý do|sai lầm|cách|phần|tập|chương)\b/i;
  const spoken = lines.filter((l) => {
    const m = l.match(/^([^:\s][^:]{0,15}):\s+\S/);
    return Boolean(m && !LABEL.test(m[1]));
  }).length;
  if (lines.length >= 3 && spoken / lines.length >= 0.6) return "chat";
  if (/đố vui|câu đố|trắc nghiệm|đáp án là|bạn có đoán|câu hỏi\s*\d/i.test(all)) return "quiz";
  if (/\btop\s*\d+\b|xếp hạng|đếm ngược|(^|\s)#\d\b/i.test(all)) return "ranking";
  if (/reddit|ẩn danh|bài đăng|tâm sự|thú nhận|confession/i.test(all)) return "social";
  if (/truyện tranh|siêu anh hùng|comic|manga/i.test(all)) return "comic";
  if (/ngày xửa ngày xưa|cổ tích|truyện thiếu nhi|trước giờ ngủ|kể chuyện cho bé|ngụ ngôn/i.test(all)) return "storybook";
  if (/lá thư|bức thư|thư gửi|thân gửi|thân ái|nhật ký|gửi (em|anh|mẹ|bố|con|cậu|bạn|tôi)(?=[\s,.!?]|$)/im.test(all)) return "pen";
  if (/cuốn sách|trang sách|tóm tắt sách|review sách|bài học từ sách|chương\s*\d|truyền thuyết/i.test(all)) return "book";
  if (/trailer|điện ảnh|thước phim/i.test(all)) return "cinematic";
  if (/tin nóng|bản tin|vừa xảy ra|mới nhất|cập nhật|chính thức|công bố|thông báo khẩn/i.test(all)) return "news";
  if (/ngày xưa|thập niên|thời thơ ấu|tuổi thơ|hoài niệm|thế hệ 8x|thế hệ 9x|\b(19[89]\d)s?\b/i.test(all)) return "retro";
  if (/\b(bước|step)\s*\d/i.test(all) || /hướng dẫn|công thức|cách làm/i.test(all)) return "whiteboard";
  if (/\b(năm|vào|từ)\s+(1[5-9]\d\d|20\d\d)\b/i.test(all) ||
      scenes.some((s) => s.tag && /\b(1[5-9]\d\d|20\d\d)\b/.test(s.tag))) return "documentary";
  // Vài con số lẻ tẻ (50%, 0%) chưa đủ để coi là nội dung số liệu.
  if ((all.match(/\d+([.,]\d+)?\s*(%|x\b|k\b|triệu|tỷ|gb|mb)/gi) ?? []).length >= 3) return "tech";
  const avg = lines.reduce((n, l) => n + l.length, 0) / Math.max(1, lines.length);
  if (lines.length <= 8 && avg <= 32) return "kinetic";
  return "caption";
};

export const textToScript = (
  input: string,
  options: TextScriptOptions,
): { script: VideoScript; notes: string[] } => {
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text) throw new Error("Chưa có nội dung kịch bản.");
  const notes: string[] = [];

  // ---- JSON của script.json ----
  if (text.startsWith("{")) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = undefined;   // không phải JSON — đọc như văn bản thường
    }
    if (raw !== undefined) {
      const script = parseScript(raw);
      notes.push("Đọc kịch bản dạng JSON.");
      return { script: options.style === "auto" ? script : { ...script, style: options.style }, notes };
    }
  }

  let blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((block) => block.length > 0);

  // ---- tiêu đề & dòng phụ ----
  let title: string | null = null;
  let subtitle: string | null = null;
  const head = blocks[0];
  if (head[0].startsWith("#")) {
    title = head.shift()!.replace(/^#+\s*/, "");
  } else if (blocks.length > 1 && head.length === 1 && head[0].length <= 60 &&
             // Dòng kết thúc bằng dấu chấm/than là lời thoại, không phải tiêu đề.
             // Câu hỏi thì vẫn nhận làm tiêu đề — hook hay có dạng "Vì sao…?".
             !/[.!…]$/.test(head[0]) &&
             !TAG_LINE.test(head[0]) && !head[0].startsWith("!")) {
    title = head.shift()!;
  }
  if (head[0]?.startsWith(">")) subtitle = head.shift()!.replace(/^>\s*/, "");
  if (head.length === 0) blocks.shift();
  if (!subtitle && blocks[0]?.length === 1 && blocks[0][0].startsWith(">")) {
    subtitle = blocks.shift()![0].replace(/^>\s*/, "");
  }
  if (blocks.length === 0) {
    throw new Error("Kịch bản mới có tiêu đề — thêm ít nhất một câu lời thoại.");
  }

  // ---- một khối liền không dòng trống: tự tách câu rồi chia cảnh ----
  if (blocks.length === 1) {
    const sentences = blocks[0].flatMap((line) =>
      TAG_LINE.test(line) || STAT_LINE.test(line) ? [line] : line.split(/(?<=[.!?…])\s+/));
    const spoken = sentences.filter((l) => !TAG_LINE.test(l) && !STAT_LINE.test(l));
    if (spoken.length > AUTO_SCENE_SIZE + 1 && !sentences.some((l) => TAG_LINE.test(l))) {
      blocks = [];
      for (let i = 0; i < sentences.length; i += AUTO_SCENE_SIZE) {
        blocks.push(sentences.slice(i, i + AUTO_SCENE_SIZE));
      }
      notes.push(`Không có dòng trống — tự chia mỗi ${AUTO_SCENE_SIZE} câu một cảnh.`);
    } else {
      blocks = [sentences];
    }
  }

  // ---- từng cảnh ----
  const scenes: ScriptScene[] = [];
  let pendingTag: string | null = null;
  let splitCount = 0;

  for (const block of blocks) {
    let tag: string | null = pendingTag;
    pendingTag = null;
    let visual: ScriptScene["visual"] = null;
    let punch: string | null = null;
    const lines: string[] = [];

    for (const raw of block) {
      const tagMatch = raw.match(TAG_LINE);
      if (tagMatch) { tag = clipWords(tagMatch[1], 18); continue; }

      const statMatch = raw.match(STAT_LINE);
      if (statMatch) {
        visual = {
          type: "stat",
          text: statMatch[1].trim().slice(0, 16),
          caption: statMatch[2] ? clipWords(statMatch[2], 40) : null,
        };
        continue;
      }

      const marked = raw.match(PUNCH_MARK);
      if (marked && !punch) punch = clipWords((marked[1] ?? marked[2]).trim(), 48);
      const clean = raw
        .replace(/\*\*(.+?)\*\*|\*(.+?)\*/g, (_m, a, b) => a ?? b)
        .replace(/^[-•–]\s+/, "")
        .trim();
      if (!clean) continue;
      const parts = splitLong(clean);
      if (parts.length > 1) splitCount += 1;
      lines.push(...parts);
    }

    // Khối chỉ có nhãn: dùng nhãn đó cho cảnh kế tiếp.
    if (lines.length === 0) { pendingTag = tag; continue; }

    for (let k = 0; k < lines.length; k += MAX_LINES_PER_SCENE) {
      const chunk = lines.slice(k, k + MAX_LINES_PER_SCENE);
      const needle = punch?.toLocaleLowerCase("vi");
      scenes.push({
        lines: chunk,
        tag,
        image: null,
        visual: k === 0 ? visual : null,
        punch: needle && chunk.some((l) => l.toLocaleLowerCase("vi").includes(needle)) ? punch : null,
      });
    }
  }

  if (scenes.length === 0) throw new Error("Không tìm thấy câu lời thoại nào.");
  if (scenes.length > MAX_SCENES) {
    throw new Error(`Kịch bản có ${scenes.length} cảnh — tối đa ${MAX_SCENES}. Bớt dòng trống để gộp cảnh.`);
  }
  if (splitCount > 0) notes.push(`Tách ${splitCount} câu dài hơn ${MAX_LINE} ký tự.`);

  // ---- ảnh ----
  const uploads = options.uploads ?? [];
  scenes.forEach((scene, i) => {
    scene.image = uploads[i] ?? options.previousImages?.[i] ?? null;
  });
  if (uploads.length > scenes.length) {
    notes.push(`Có ${uploads.length} file đính kèm nhưng chỉ ${scenes.length} cảnh — file thừa không dùng.`);
  }

  // ---- tiêu đề, phong cách ----
  const firstLine = scenes[0].lines[0];
  if (!title) {
    title = clipWords(firstLine.replace(/[.!…]+$/, ""), 60);
    notes.push("Không có dòng tiêu đề — lấy câu đầu làm tiêu đề.");
  }
  if (!subtitle) {
    const allLines = scenes.flatMap((s) => s.lines);
    subtitle = allLines.find((l) => !l.startsWith(title!.slice(0, 20))) ?? title;
  }

  const all = [title, subtitle, ...scenes.flatMap((s) => [s.tag ?? "", ...s.lines])].join("\n");
  let style: StyleId;
  if (options.style !== "auto") {
    style = options.style;
  } else if (options.previousStyle) {
    style = options.previousStyle;
  } else {
    style = guessStyle(all, scenes);
    notes.push(`Tự chọn phong cách "${style}" theo từ khoá — đổi ở chip phong cách nếu chưa hợp.`);
  }

  try {
    const script = parseScript({
      style,
      title: clipWords(title, 60),
      subtitle: clipWords(subtitle, 90) || clipWords(title, 90),
      handle: "@kenh",
      accent: "#ff6b2c",
      background: "#0f1115",
      scenes,
    });
    return { script, notes };
  } catch (error) {
    throw new Error(`Kịch bản chưa hợp lệ: ${error instanceof Error ? error.message.slice(0, 200) : error}`);
  }
};

/**
 * VideoScript → văn bản theo đúng cú pháp ở đầu file, để người dùng đọc và sửa cả kịch bản rồi dán lại
 * (textToScript đọc ra đúng các cảnh, nhãn, câu nhấn, con số như cũ). Câu nhấn được đánh ** ** ở lần xuất
 * hiện đầu tiên trong lời của cảnh; không tìm thấy trong lời thì bỏ — schema bắt câu nhấn phải nằm trong lời.
 */
export const scriptToText = (script: VideoScript): string => {
  const head = [`# ${script.title}`];
  if (script.subtitle && script.subtitle !== script.title) head.push(`> ${script.subtitle}`);
  const scenes = script.scenes.map((scene) => {
    const out: string[] = [];
    if (scene.tag) out.push(`[${scene.tag}]`);
    if (scene.visual) out.push(`! ${scene.visual.text}${scene.visual.caption ? ` | ${scene.visual.caption}` : ""}`);
    const needle = scene.punch?.toLocaleLowerCase("vi");
    let marked = !needle;
    for (const line of scene.lines) {
      const at = marked ? -1 : line.toLocaleLowerCase("vi").indexOf(needle!);
      if (at < 0) { out.push(line); continue; }
      marked = true;
      const end = at + scene.punch!.length;
      out.push(`${line.slice(0, at)}**${line.slice(at, end)}**${line.slice(end)}`);
    }
    return out.join("\n");
  });
  return [head.join("\n"), ...scenes].join("\n\n");
};
