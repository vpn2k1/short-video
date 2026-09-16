import { randomUUID } from "crypto";

export type JobStatus = "running" | "done" | "error";

export type Job = {
  id: string;
  status: JobStatus;
  lines: string[];
  result?: unknown;
  error?: string;
  listeners: Set<(line: string) => void>;
};

const jobs = new Map<string, Job>();

/** Chạy việc dài trong nền, log từng dòng để UI theo dõi qua SSE. */
export const startJob = (
  run: (log: (line: string) => void) => Promise<unknown>,
) => {
  const job: Job = {
    id: randomUUID(),
    status: "running",
    lines: [],
    listeners: new Set(),
  };
  jobs.set(job.id, job);

  const log = (line: string) => {
    job.lines.push(line);
    for (const listener of job.listeners) {
      listener(line);
    }
  };

  run(log)
    .then((result) => {
      job.result = result;
      job.status = "done";
      log("__DONE__");
    })
    .catch((error) => {
      job.error = error instanceof Error ? error.message : String(error);
      job.status = "error";
      log(`__ERROR__ ${job.error}`);
    });

  return job;
};

export const getJob = (id: string) => jobs.get(id);
