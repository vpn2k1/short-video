/** Gọi API server và tiện ích nhỏ cho trình chỉnh sửa. */

export type MediaItem = {
  path: string;
  name: string;
  kind: "image" | "video" | "audio";
  bytes: number;
  at: number;
};

/** Tuỳ chọn tạo phụ đề tự động (whisper.cpp trên server). */
export type SubtitleOptions = {
  source: "all" | "scene" | "clip";
  index?: number;
  language: "vi" | "en" | "auto";
  quality: "fast" | "accurate";
  replace: boolean;
};

/** Giọng trong /api/state → voices.catalog. */
export type VoiceOption = {
  key: string;
  label: string;
  engine: "say" | "elevenlabs" | "everai";
  /** "miễn phí" / "ElevenLabs" / "EverAI". */
  engineLabel: string;
  lang: "vi" | "en";
  paidPlan: boolean;
};

export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
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
