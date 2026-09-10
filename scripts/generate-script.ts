import Anthropic from "@anthropic-ai/sdk";
import { listImagesFor } from "./images";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { videoScriptSchema, type VideoScript } from "../src/compositions/Short/script";

const SYSTEM = `Bạn là copywriter chuyên viết kịch bản video ngắn dọc (TikTok/Reels/Shorts).

Quy tắc:
- Viết bằng ngôn ngữ của prompt người dùng. Nếu prompt tiếng Việt, viết tiếng Việt.
- "title": hook ngắn, tối đa 6 từ, đọc là muốn xem tiếp. Không dùng dấu chấm cuối câu.
- "subtitle": một dòng làm rõ lợi ích cho người xem.
- "scenes": chia nội dung thành cảnh. Mỗi cảnh là một ý lớn, dùng chung một hình nền.
  Video short-form nên có 2-4 cảnh; mỗi cảnh 2-3 câu.
- "scenes[].lines": các câu phụ đề, mỗi câu là MỘT ý trọn vẹn dài 4-12 từ.
  Tổng 5-8 câu cho video 15-30 giây. Chỉ dài hơn khi người dùng yêu cầu rõ.
- "scenes[].image": chọn từ DANH SÁCH ẢNH bên dưới, hoặc null nếu không ảnh nào hợp.
  Chỉ dùng đúng tên trong danh sách, KHÔNG tự bịa tên file.
- "scenes[].visual": hình vẽ bằng code, bạn TỰ TẠO được, không cần file ảnh.
  Dùng nó khi cảnh có một con số hoặc một bước đáng làm nổi bật:
    { "type": "stat",  "text": "7-9",     "caption": "giờ ngủ mỗi đêm" }
    { "type": "badge", "text": "Bước 1",  "caption": "Cố định giờ đi ngủ" }
  "text" tối đa 16 ký tự, ngắn và đập vào mắt. "caption" giải thích, có thể null.
  Đặt null nếu cảnh không có con số hay bước nào đáng nêu — đừng nhồi cho đủ.
  Người xem đọc câu này trên màn hình điện thoại trong khoảng 1-4 giây,
  nên câu dài quá sẽ bị đọc không kịp. Câu cuối là call-to-action.
- "accent": màu nhấn nổi bật trên nền tối, dùng cho chữ phụ đề và thanh tiến độ.
- "background": màu nền tối (độ sáng thấp) để chữ trắng đọc rõ.
- "handle": tên kênh dạng @tenkenh, suy ra từ chủ đề nếu người dùng không nêu.

Không giải thích, không thêm emoji vào "lines".`;

export const generateScript = async (
  prompt: string,
  /** Video slug — quyết định thư mục ảnh nào được đưa cho model chọn. */
  slug?: string,
  model = "claude-opus-5",
): Promise<VideoScript> => {
  const client = new Anthropic();

  const images = listImagesFor(slug);
  const imageSection =
    images.length === 0
      ? '\n\nDANH SÁCH ẢNH: (trống) — đặt "image" là null cho mọi cảnh.'
      : `\n\nDANH SÁCH ẢNH có thể dùng:\n${images.map((i) => `- ${i}`).join("\n")}`;

  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM + imageSection,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(videoScriptSchema),
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude từ chối yêu cầu này: ${response.stop_details?.explanation ?? "không rõ lý do"}`,
    );
  }

  if (!response.parsed_output) {
    throw new Error(
      "Claude không trả về JSON hợp lệ theo schema. Thử diễn đạt lại prompt.",
    );
  }

  return response.parsed_output;
};
