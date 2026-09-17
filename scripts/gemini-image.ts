import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { HEIGHT, WIDTH } from "../src/constants";
import { describeProviderError } from "./provider-error";
import { freeMode, recordCall } from "./usage";
import { cloudflareImageAvailable, generateFluxImage } from "./cloudflare-image";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Model ảnh mặc định. Đổi bằng GEMINI_IMAGE_MODEL nếu cần bản khác. */
const defaultModel = () =>
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

/**
 * Sinh một ảnh bằng Gemini rồi ép về đúng khổ 1080×1920.
 * Model trả ảnh dạng inline base64 trong parts của response.
 */
export const generateImage = async (prompt: string, destination: string) => {
  // Có key Cloudflare thì vẽ bằng FLUX (miễn phí ~100 ảnh/ngày) thay cho Gemini (tính tiền theo ảnh).
  if (cloudflareImageAvailable()) return generateFluxImage(prompt, destination);
  if (freeMode()) {
    throw new Error("💚 Chế độ Miễn phí đang bật — Gemini vẽ ảnh tính tiền nên đã tắt. Thêm key Cloudflare (vẽ ảnh FLUX miễn phí) trong ⚙ Cài đặt, hoặc chọn ảnh/clip miễn phí.");
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Thiếu GEMINI_API_KEY trong .env");
  }

  const model = defaultModel();
  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  recordCall("Gemini vẽ ảnh", response.ok);
  if (!response.ok) {
    throw new Error(describeProviderError("Gemini vẽ ảnh", response.status, (await response.text()).slice(0, 600),
      "hoặc chọn nguồn hình khác (Pexels, thư viện)"));
  }

  const body = (await response.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { data?: string } }[] };
    }[];
  };

  const inline = body.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
  )?.inlineData?.data;

  if (!inline) {
    throw new Error(
      `Gemini không trả về ảnh. Model ${model} có thể không hỗ trợ sinh ảnh, ` +
        "hoặc prompt bị từ chối.",
    );
  }

  const temp = `${destination}.raw`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(temp, Buffer.from(inline, "base64"));

  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", temp,
    "-vf",
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
    destination,
  ]);
  fs.unlinkSync(temp);

  return { file: destination, model };
};
