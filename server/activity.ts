/**
 * Ô "Tiến trình" (server/public/activity.js): mọi việc đang chạy nền và vừa xong, để người dùng làm nhiều video
 * một lúc vẫn theo dõi được — không chỉ video đang mở. GET /api/activity, trình duyệt hỏi lại vài giây một lần.
 *
 *   { items: [{ id, slug, kind, title, status: "running" | "done" | "error", step, percent, last, startedAt, finishedAt?, error? }],
 *     batches: [{ id, name, done, error, total }] }   ← chỉ loạt đang chạy
 */
import fs from "fs";
import path from "path";
import { listBatches } from "./batch";
import { runActivity } from "./chat";
import { getJob } from "./jobs";

const readJson = (file: string) => {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  } catch {
    return null;
  }
};

/** Tên hiện trong ô: tiêu đề kịch bản → tiêu đề props → lời người dùng gửi → slug. */
const titleOf = (slug: string) => {
  const dir = path.join(process.cwd(), "videos", slug);
  const script = readJson(path.join(dir, "script.json"));
  const props = readJson(path.join(dir, "props.json"));
  const chat = readJson(path.join(dir, "chat.json")) as { messages?: { role: string; text?: string }[] } | null;
  const firstUser = chat?.messages?.find((m) => m.role === "user")?.text;
  const title = script?.title ?? props?.title ?? firstUser?.replace(/\s+/g, " ").trim().slice(0, 60);
  return typeof title === "string" && title.trim() ? title.trim() : slug;
};

/** Bước, phần trăm và dòng log cuối của job — cùng các dấu __STEP__/__PROGRESS__ mà trang video đọc qua SSE. */
const progressOf = (jobId: string) => {
  const job = getJob(jobId);
  let step: string | null = null;
  let percent: number | null = null;
  let last = "";
  for (const line of job?.lines ?? []) {
    if (line.startsWith("__STEP__")) {
      step = line.split(" ")[1] ?? null;
      percent = null;
    } else if (line.startsWith("__PROGRESS__")) {
      percent = Number(line.split(" ")[1]) || 0;
    } else if (!line.startsWith("__")) {
      last = line;
    }
  }
  return { job, step, percent, last: last.trim().slice(0, 140) };
};

export const activity = () => {
  const { running, finished } = runActivity();
  const items = [
    ...running.map((run) => {
      const { step, percent, last } = progressOf(run.jobId);
      return { id: run.jobId, slug: run.slug, kind: run.kind, title: titleOf(run.slug), status: "running" as const, step, percent, last, startedAt: run.startedAt };
    }),
    ...finished.map((run) => {
      const { job } = progressOf(run.jobId);
      // Job hết trong bộ nhớ (hiếm) coi như xong — lượt lỗi vẫn hiện lỗi ngay trong video.
      const status = job?.status === "error" ? ("error" as const) : ("done" as const);
      return {
        id: run.jobId, slug: run.slug, kind: run.kind, title: titleOf(run.slug), status,
        step: null, percent: null, last: "", startedAt: run.startedAt, finishedAt: run.finishedAt,
        ...(status === "error" ? { error: job?.error ?? "lỗi không rõ" } : {}),
      };
    }),
  ];
  const batches = listBatches().batches
    .filter((b) => b.state === "running")
    .map((b) => ({ id: b.id, name: b.name, done: b.counts.done, error: b.counts.error, total: b.counts.total - b.counts.skipped }));
  return { items, batches };
};
