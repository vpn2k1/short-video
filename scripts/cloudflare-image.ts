/**
 * Vẽ ảnh AI miễn phí bằng FLUX.1 [schnell] trên Cloudflare Workers AI.
 *
 * Tài khoản Cloudflare (kể cả gói Free) có 10.000 neuron miễn phí mỗi ngày, reset lúc 0h UTC.
 * Một ảnh 1024×1024 (4 ô 512×512): tiền bước tính theo từng ô — 4×4,8 + 4 ô×STEPS×9,6 neuron (header cf-ai-neurons,
 * đo 2026-09-17: 4 bước = 172,8, 2 bước = 96). Dùng 2 bước → khoảng 104 ảnh/ngày không tốn tiền; ảnh mềm hơn 4 bước
 * một chút, vẫn đúng nội dung. Gói Free hết neuron thì
 * Cloudflare từ chối (không tự tính tiền) — app báo "hết lượt trong ngày".
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { HEIGHT, WIDTH } from "../src/constants";
import { providerError } from "./provider-error";
import { recordCall } from "./usage";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
/** 2 bước: 96 neuron/ảnh (~104 ảnh/ngày miễn phí). 4 bước nét hơn nhưng 172,8 neuron (~57 ảnh/ngày). */
const STEPS = 2;

export const cloudflareImageAvailable = () =>
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

/** Bộ lọc NSFW của Cloudflare chặn nhầm cả mô tả vô hại (hay gặp khi có trẻ em + tuổi) và không ổn định: gửi lại y
 * nguyên có khi qua. Thử lại một lần, rồi một lần nữa với lời đã bỏ tuổi / chữ "alone". */
const NSFW = /nsfw/i;
const softenPrompt = (prompt: string) =>
  prompt.replace(/\b\d+[-\s]year[-\s]old\b/gi, "young").replace(/\b(alone|lonely|naked|bare)\b/gi, "").replace(/\s{2,}/g, " ");

export const generateFluxImage = async (prompt: string, destination: string) => {
  const attempts = [prompt, prompt, softenPrompt(prompt)];
  for (let k = 0; ; k++) {
    try {
      return await generateFluxOnce(attempts[k], destination);
    } catch (error) {
      if (k === attempts.length - 1 || !NSFW.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
};

const generateFluxOnce = async (prompt: string, destination: string) => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!account || !/^[a-f0-9]{32}$/i.test(account)) {
    throw new Error("Account ID Cloudflare không hợp lệ — 32 ký tự, xem ở trang Workers AI của Cloudflare.");
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: STEPS }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let body: { success?: boolean; result?: { image?: string }; errors?: { code?: number; message?: string }[] } = {};
  try {
    body = JSON.parse(text);
  } catch {
    // lỗi dạng HTML — báo nguyên văn
  }
  recordCall("Cloudflare FLUX", response.ok && Boolean(body.result?.image));
  if (!response.ok || !body.result?.image) {
    const message = body.errors?.map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim()).join("; ") || text.slice(0, 300);
    // Hết neuron miễn phí trong ngày: Cloudflare trả 429 hoặc thông báo "daily free allocation".
    const status = /neuron|allocation|daily/i.test(message) && response.status !== 401 ? 429 : response.status;
    throw providerError("Cloudflare FLUX", status, /allocation|neuron/i.test(message) ? `${message} per day` : message,
      "hoặc chọn nguồn hình khác (ảnh/clip miễn phí, thư viện)");
  }

  const temp = `${destination}.raw.jpg`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(temp, Buffer.from(body.result.image, "base64"));
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", temp,
    "-vf", `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
    destination,
  ]);
  fs.unlinkSync(temp);
  return { file: destination, model: "FLUX.1 schnell (Cloudflare)" };
};
