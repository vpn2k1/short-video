/**
 * Soát kịch bản AI vừa viết, hai nhịp:
 *   1. Biên tập viên AI liệt kê lỗi — dữ kiện sai, cặp hỏi–đáp không khớp, số liệu bịa, câu lủng củng — từng lỗi kèm
 *      cách sửa, CHƯA viết lại gì.
 *   2. Có lỗi thì sửa đúng các lỗi đó bằng editScript (phần còn lại giữ nguyên từng chữ).
 * Gộp "tìm lỗi" và "viết lại cả kịch bản" vào một lượt thì model hay bỏ sót (đã thử với Gemini Flash: sửa đáp án thành
 * "con dốc" mà giữ câu hỏi "đầu dê mặt ngựa"; lượt sau lại để nguyên "con cua có bốn chân"). Bắt model xét từng cặp
 * trước rồi mới sửa thì bắt được nhiều hơn hẳn.
 *
 * Bước này không bao giờ làm hỏng lượt tạo video: soát lỗi, hết lượt, hay bản sửa đổi khung kịch bản thì giữ bản đầu.
 */
import { allLines, type VideoScript } from "../src/compositions/Short/script";
import { editScript, scriptProviders, type ProviderChoice } from "./generate-script";
import { askJson, parseJson, type JsonReply } from "./llm-json";
import { styleGuide } from "./style-guides";
import { scriptToText } from "./text-script";

type Problem = { line: string; problem: string; fix: string };

/** Kịch bản dài hơn thế thì bỏ qua — lượt sửa phải trả lại cả kịch bản JSON, model miễn phí dễ cắt ngang. */
const MAX_REVIEW_LINES = 40;
const MAX_PROBLEMS = 8;

const CRITIC = `Bạn là biên tập viên khó tính soát kịch bản video tiếng Việt trước khi lên sóng. Việc của bạn là TÌM LỖI,
không viết lại kịch bản.

Kịch bản viết theo cú pháp: "# tiêu đề", "> dòng phụ", "[nhãn]" đầu cảnh, "! con số hoặc nhãn chữ | chú thích" (chú
thích có thể không có, ví dụ "! Câu khó"), **câu nhấn**, dòng trống sang cảnh mới, còn lại mỗi dòng là một câu đọc.
Cú pháp này đúng — KHÔNG nêu lỗi cú pháp, định dạng hay dấu ** **; chỉ xét nội dung.

Xét lần lượt:
1. Mỗi dữ kiện: có đúng và kiểm chứng được không?
2. Mỗi cặp hỏi–đáp (câu đố, đố mẹo, "bạn có biết"): đáp án có trả lời đúng CHÍNH câu hỏi đó không? Đố mẹo: lời giải
   chơi chữ hay lý lẽ có khớp với từng chữ của câu hỏi không? Tự giải thích thầm; không giải thích được là lỗi.
3. Số liệu, phần trăm, nghiên cứu, "x% người…": có thật không, hay bịa cho giật gân?
4. Câu văn: có câu vô nghĩa, lặp chữ, ghép chữ lộn xộn, văn dịch máy, sai ngữ pháp rõ ràng không?
5. Hook — câu đọc đầu tiên của cảnh đầu: có khiến người xem muốn xem tiếp không (gây tò mò, bất ngờ, ngược thường thức,
   câu hỏi chạm vấn đề, mở giữa câu chuyện, thách thức, hậu quả)? Mở bằng lời chào, "hôm nay mình sẽ", "Bạn có biết…?",
   câu chung chung, dài quá 12 từ, lặp ý câu thứ hai, hay dựa trên thông tin sai là lỗi — "fix" là một câu hook mới ĐÚNG
   sự thật, tối đa 12 từ, cụ thể, hợp nội dung.

Chỉ nêu lỗi THẬT thuộc 5 loại trên; văn phong đã ổn thì đừng bới. Tối đa ${MAX_PROBLEMS} lỗi, nặng nhất trước.
Với mỗi lỗi, "fix" phải cụ thể: câu thay thế nguyên văn, hoặc cặp hỏi–đáp mới thay cho cặp sai. Bỏ một con số không
chắc thì câu thay thế nêu chi tiết cụ thể chắc chắn đúng (cách làm, tình huống), KHÔNG dùng chữ mơ hồ "đáng kể", "rất nhiều".
Cặp đố mẹo sai: "fix" là MỘT cặp chép nguyên văn từ danh sách câu đố mẹo đã kiểm chứng trong HƯỚNG DẪN PHONG CÁCH bên
dưới (chưa dùng trong kịch bản) — KHÔNG tự nghĩ câu đố mẹo mới, câu tự nghĩ hay vô lý. Không có danh sách thì đổi thành
một câu hỏi kiến thức có đáp án rõ, cùng chủ đề.

Trả JSON: {"problems":[{"line":"<câu có lỗi, chép nguyên văn>","problem":"<lỗi gì, vì sao>","fix":"<sửa thế nào>"}]}.
Không có lỗi thì {"problems":[]}.`;

const read = (reply: JsonReply): Problem[] => {
  const body = parseJson<{ problems?: unknown }>(reply);
  if (!Array.isArray(body.problems)) throw new Error(`${reply.who} trả sai cấu trúc — cần {"problems":[…]}.`);
  return body.problems
    .map((raw) => {
      const p = (raw ?? {}) as Record<string, unknown>;
      const text = (key: string) => (typeof p[key] === "string" ? (p[key] as string).trim() : "");
      return { line: text("line"), problem: text("problem"), fix: text("fix") };
    })
    .filter((p) => p.problem && p.fix)
    .slice(0, MAX_PROBLEMS);
};

const short = (text: string, max = 60) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/**
 * Gói miễn phí giới hạn theo phút (Groq ~8.000 token/phút): viết + soát + sửa liền nhau hay chạm trần — đợi đúng số giây
 * nhà cung cấp báo rồi thử lại. Hết lượt trong ngày thì không đợi (describeProviderError phân biệt hai loại).
 */
const retryPerMinute = async <T>(run: () => Promise<T>, log: (line: string) => void): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const perMinute = message.includes("trong một phút") && !message.includes("trong ngày");
      if (attempt >= 3 || !perMinute) throw error;
      const wait = Math.min(65, Number(message.match(/Đợi khoảng (\d+) giây/)?.[1]) || 30) + 2;
      log(`AI đang giới hạn lượt theo phút — đợi ${wait}s rồi soát tiếp…`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    }
  }
};

/**
 * `request`: yêu cầu gốc của người dùng — để biên tập viên biết kịch bản phải nói về gì.
 * Model chạy trên máy (Ollama, AI có sẵn 1,5B) bỏ qua: soát kém, sửa thường làm hỏng thêm.
 */
export const reviewScript = async (
  script: VideoScript,
  request: string,
  options: { slug: string; provider: ProviderChoice; log?: (line: string) => void },
): Promise<VideoScript> => {
  const log = options.log ?? (() => {});
  const first = scriptProviders(options.provider)[0];
  if (!first || first === "local" || first === "ollama") return script;
  const lines = allLines(script);
  if (lines.length > MAX_REVIEW_LINES) return script;

  log("Đang soát lời: dữ kiện, cặp hỏi–đáp, câu chữ…");
  let problems: Problem[];
  try {
    ({ value: problems } = await retryPerMinute(() => askJson(
      options.provider,
      {
        system: `${CRITIC}\n\nHƯỚNG DẪN PHONG CÁCH "${script.style}" (để đối chiếu):\n${styleGuide(script.style)}`,
        user: `YÊU CẦU GỐC CỦA NGƯỜI DÙNG: ${request}\n\nKỊCH BẢN:\n${scriptToText(script)}`,
        temperature: 0.2,
        maxTokens: 1500,
        schema: {
          type: "object",
          properties: {
            problems: {
              type: "array",
              items: {
                type: "object",
                properties: { line: { type: "string" }, problem: { type: "string" }, fix: { type: "string" } },
                required: ["line", "problem", "fix"],
              },
            },
          },
          required: ["problems"],
        },
        slowHint: "tắt bớt việc khác rồi thử lại",
      },
      read,
      "Chưa có AI nào để soát lời.",
    ), log));
  } catch (error) {
    log(`Bỏ qua bước soát lời (${error instanceof Error ? error.message.split("\n")[0] : error}).`);
    return script;
  }
  if (problems.length === 0) {
    log("Soát xong: không thấy lỗi.");
    return script;
  }
  log(`Soát thấy ${problems.length} lỗi: ${problems.map((p) => `"${short(p.line, 40)}" — ${short(p.problem, 70)}`).join(" · ")}`);

  const instruction =
    "Sửa đúng các lỗi biên tập sau, phần còn lại giữ nguyên từng chữ:\n" +
    problems.map((p, i) => `${i + 1}. Câu "${p.line}": ${p.problem}. Cách sửa: ${p.fix}`).join("\n") +
    "\nThay một câu hỏi thì thay luôn câu đáp án và \"punch\" của cảnh đó cho khớp; cách sửa đưa sẵn câu hỏi–đáp án thì chép " +
    "NGUYÊN VĂN, không tự nghĩ câu khác. Bỏ con số thì bỏ cả \"visual\" chứa nó. " +
    "Không thêm số liệu mới. Giữ nguyên số cảnh và số câu mỗi cảnh.";
  try {
    const fixed = await retryPerMinute(
      () => editScript(script, instruction, options.slug, [], undefined, script.style, options.provider), log);
    const after = allLines(fixed);
    if (fixed.scenes.length !== script.scenes.length || Math.abs(after.length - lines.length) > Math.max(2, lines.length * 0.2)) {
      log("Bản sửa đổi khung kịch bản — giữ bản viết đầu.");
      return script;
    }
    const changed = after.filter((line) => !lines.includes(line)).length;
    log(`Đã sửa ${changed} câu theo bản soát.`);
    return {
      ...fixed,
      style: script.style, accent: script.accent, background: script.background,
      scenes: fixed.scenes.map((scene, i) => ({ ...scene, image: script.scenes[i].image })),
    };
  } catch (error) {
    log(`Không sửa được theo bản soát (${error instanceof Error ? error.message.split("\n")[0] : error}) — giữ bản viết đầu.`);
    return script;
  }
};
