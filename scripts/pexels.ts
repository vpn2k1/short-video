import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { HEIGHT, WIDTH } from "../src/constants";
import { describeProviderError } from "./provider-error";

const API = "https://api.pexels.com";

export type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  url: string;
  src: Record<string, string>;
};

const apiKey = () => {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    throw new Error(
      "Thiếu PEXELS_API_KEY. Lấy free ở https://www.pexels.com/api/ rồi đặt vào .env",
    );
  }
  return key;
};

/** Ảnh dọc, sắp theo độ phù hợp của Pexels. */
export const searchPhotos = async (query: string, perPage = 10) => {
  const url = `${API}/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait&size=large`;
  const response = await fetch(url, { headers: { Authorization: apiKey() } });
  if (!response.ok) {
    throw new Error(describeProviderError("Pexels", response.status, await response.text(), "hoặc chọn nguồn hình khác"));
  }
  const body = (await response.json()) as { photos?: PexelsPhoto[] };
  return body.photos ?? [];
};

/**
 * Tải ảnh về và ép đúng khổ 1080×1920.
 *
 * Ảnh Pexels có đủ tỉ lệ; `src.portrait` đã crop sẵn nhưng chỉ 800×1200 — thiếu
 * độ phân giải cho khung 1080×1920. Nên tải `src.original` rồi tự scale + crop:
 * phủ kín khung, cắt phần thừa ở giữa.
 */
export const downloadPhoto = async (
  photo: PexelsPhoto,
  destination: string,
) => {
  const source = photo.src.original ?? photo.src.large2x ?? photo.src.large;
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Tải ảnh thất bại: ${response.status}`);
  }

  const temp = `${destination}.download`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(temp, Buffer.from(await response.arrayBuffer()));

  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", temp,
    "-vf",
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
    "-q:v", "3",
    destination,
  ]);
  fs.unlinkSync(temp);

  return {
    file: destination,
    credit: `Ảnh: ${photo.photographer} — Pexels (${photo.url})`,
  };
};

/**
 * Pexels yêu cầu ghi công tác giả. Ghi vào file cạnh ảnh để không quên khi đăng.
 */
export const writeCredits = (dir: string, credits: string[]) => {
  if (credits.length === 0) {
    return;
  }
  const file = path.join(dir, "CREDITS.txt");
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = new Set(
    [...existing.split("\n"), ...credits].map((l) => l.trim()).filter(Boolean),
  );
  fs.writeFileSync(file, [...lines].join("\n") + "\n");
  return file;
};
