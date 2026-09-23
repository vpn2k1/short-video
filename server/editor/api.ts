/** Gọi API server và tiện ích nhỏ cho trình chỉnh sửa. */

export type MediaItem = {
  path: string;
  name: string;
  kind: "image" | "video" | "audio";
  bytes: number;
  at: number;
};

import type { TranslateEngine, TranslateEngineInfo } from "../../scripts/translate";

export type { TranslateEngine, TranslateEngineInfo };

/** Tuỳ chọn tạo phụ đề tự động (whisper.cpp trên server). */
export type SubtitleOptions = {
  source: "all" | "scene" | "clip";
  index?: number;
  language: "vi" | "en" | "auto";
  quality: "fast" | "accurate";
  replace: boolean;
  /** Dịch sau khi phiên âm; null = giữ nguyên ngôn ngữ lời nói. */
  translate: { to: string; engine: TranslateEngine; keepOriginal: boolean } | null;
};

/** GET /api/translate/engines */
export type TranslateCatalog = {
  engines: TranslateEngineInfo[];
  languages: { code: string; label: string }[];
  /** process.platform của server — app chạy trên chính máy người dùng. */
  platform: string;
};

/** Giọng trong /api/state → voices.catalog. */
export type VoiceOption = {
  key: string;
  label: string;
  engine: "say" | "elevenlabs" | "gemini" | "local";
  /** "miễn phí" / "ElevenLabs" / "Gemini". */
  engineLabel: string;
  lang: "vi" | "en";
  paidPlan: boolean;
  /** Giọng gọi dịch vụ trên mạng (Gemini, ElevenLabs). */
  online?: boolean;
  /** Câu nghe thử đã có trong bộ nhớ — nghe lại không tốn lượt. */
  sampled?: boolean;
};

/** Lỗi server trả về; `code` = "ENOSPC" khi ổ đĩa đầy (server/disk.ts › errorBody). */
export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export const isDiskFullError = (error: unknown) => error instanceof ApiError && error.code === "ENOSPC";

export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!res.ok) throw new ApiError(body.error || res.statusText, typeof body.code === "string" ? body.code : undefined);
  return body as T;
};

export const postJson = <T>(path: string, data: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

/** Đọc thời lượng file âm thanh/video bằng thẻ media của trình duyệt (ms). */
export const mediaDurationMs = (src: string, kind: "audio" | "video") =>
  new Promise<number>((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration * 1000 : 5000);
    el.onerror = () => resolve(5000);
    el.src = src;
  });

/** Tỉ lệ rộng/cao của ảnh hoặc video gốc — cần khi tạo crop "toàn bộ ảnh" (mediaCropSchema.mediaAspect). */
export const mediaAspect = (src: string, kind: "image" | "video") =>
  new Promise<number>((resolve, reject) => {
    const fail = () => reject(new Error("Không đọc được kích thước ảnh/video."));
    if (kind === "image") {
      const img = new Image();
      img.onload = () => (img.naturalWidth && img.naturalHeight ? resolve(img.naturalWidth / img.naturalHeight) : fail());
      img.onerror = fail;
      img.src = src;
      return;
    }
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => (el.videoWidth && el.videoHeight ? resolve(el.videoWidth / el.videoHeight) : fail());
    el.onerror = fail;
    el.src = src;
  });

export const uploadFile = async (file: File) => {
  const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body as { path: string; bytes: number };
};

/** 00:03.2 */
export const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};

/** Theo dõi job render qua SSE. */
export const followJob = (
  jobId: string,
  onLine: (line: string) => void,
  onEnd: (status: string, result: unknown, error?: string) => void,
) => {
  const source = new EventSource(`/api/job/${jobId}`);
  source.onmessage = (event) => {
    const { line, status, result, error } = JSON.parse(event.data);
    if (line === "__END__") {
      source.close();
      onEnd(status, result, error);
      return;
    }
    if (line === "__DONE__" || line.startsWith("__ERROR__")) return;
    onLine(line);
  };
  return () => source.close();
};
