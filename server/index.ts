/**
 * Giao diện web cho toàn bộ pipeline. Chạy: npm start
 *
 * Không dùng framework và không có bước build — UI là một file HTML tĩnh, server
 * là `node:http`. Đây là công cụ chạy local, không phải dịch vụ public.
 */
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildAndRender,
  concatVideos,
  createFromPrompt,
  fetchSceneImages,
  gallery,
  listAudio,
  makeAudioElevenLabs,
  makeAudioLocal,
  pickPexels,
  readSettings,
  renderOneScene,
  searchPexels,
  updateSettings,
  listVideos,
  readVideo,
  voiceCatalog,
  writeProps,
  writeScript,
} from "./api";
import { getJob, startJob } from "./jobs";
import { pipelineStatus, runRenderStage, runVoiceStage } from "./pipeline";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // .env không bắt buộc
}

const PORT = Number(process.env.PORT ?? 5177);
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const send = (
  res: http.ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(payload);
};

const readBody = (req: http.IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const readJson = async <T>(req: http.IncomingMessage): Promise<T> =>
  JSON.parse((await readBody(req)).toString("utf8") || "{}") as T;

/** Chỉ cho phép đọc file bên trong thư mục cho trước — chặn ../ */
const serveFile = (res: http.ServerResponse, base: string, rel: string) => {
  const target = path.resolve(base, "." + rel);
  if (!target.startsWith(path.resolve(base))) {
    return send(res, 403, { error: "forbidden" });
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return send(res, 404, { error: "not found" });
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(target).pipe(res);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const route = url.pathname;

  try {
    // ---- file tĩnh ----
    if (route === "/" || route === "/index.html") {
      return serveFile(res, publicDir, "/index.html");
    }
    // Mọi file khác trong server/public (app.js, css…)
    if (!route.startsWith("/api/") && !route.startsWith("/out/") &&
        !route.startsWith("/public/") &&
        fs.existsSync(path.join(publicDir, "." + route))) {
      return serveFile(res, publicDir, route);
    }
    if (route.startsWith("/out/")) {
      return serveFile(res, path.join(process.cwd(), "out"), route.slice(4));
    }
    if (route.startsWith("/public/")) {
      return serveFile(res, path.join(process.cwd(), "public"), route.slice(7));
    }

    // ---- API ----
    if (route === "/api/state") {
      const live = url.searchParams.get("live") === "1";
      return send(res, 200, {
        videos: listVideos(),
        voices: await voiceCatalog(live),
        audio: listAudio(),
        compositions: ["Short", "LongVideo", "Explainer"],
        keys: {
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
          pexels: Boolean(process.env.PEXELS_API_KEY),
          gemini: Boolean(process.env.GEMINI_API_KEY),
        },
      });
    }

    if (route.startsWith("/api/video/") && req.method === "GET") {
      return send(res, 200, readVideo(route.split("/")[3]));
    }

    if (route.startsWith("/api/video/") && req.method === "POST") {
      const [, , , slug, what] = route.split("/");
      const body = await readJson<Record<string, unknown>>(req);
      if (what === "script") {
        return send(res, 200, { script: writeScript(slug, body) });
      }
      if (what === "props") {
        return send(res, 200, { props: writeProps(slug, body) });
      }
      return send(res, 404, { error: "unknown action" });
    }

    if (route === "/api/create" && req.method === "POST") {
      const body = await readJson<{ prompt: string; name?: string }>(req);
      if (!body.prompt?.trim()) {
        return send(res, 400, { error: "Thiếu prompt" });
      }
      const job = startJob((log) => createFromPrompt(body.prompt, body.name, log));
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/images" && req.method === "POST") {
      const body = await readJson<{
        slug: string;
        queries: string[];
        sources?: ("pexels" | "gemini")[];
      }>(req);
      const job = startJob((log) =>
        fetchSceneImages(
          body.slug,
          body.queries.filter((q) => q.trim()),
          body.sources?.length ? body.sources : ["pexels", "gemini"],
          log,
        ),
      );
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/gallery") {
      return send(res, 200, { items: gallery() });
    }

    if (route === "/api/aspects") {
      const { ASPECTS, ASPECT_IDS } = await import("../src/aspects");
      return send(res, 200, {
        aspects: ASPECT_IDS.map((id) => ASPECTS[id]),
      });
    }

    if (route.startsWith("/api/settings/")) {
      const slug = route.split("/")[3];
      if (req.method === "POST") {
        const body = await readJson<{ aspect?: string; kind?: "image" | "video" }>(req);
        return send(res, 200, updateSettings(slug, body));
      }
      return send(res, 200, readSettings(slug));
    }

    if (route === "/api/stage/scene" && req.method === "POST") {
      const body = await readJson<{
        slug: string; index: number; kind?: "image" | "video";
      }>(req);
      const job = startJob((log) =>
        renderOneScene(body.slug, body.index, body.kind ?? "video", log),
      );
      return send(res, 200, { jobId: job.id });
    }

    if (route.startsWith("/api/pipeline/")) {
      return send(res, 200, { stages: pipelineStatus(route.split("/")[3]) });
    }

    if (route === "/api/stage/voice" && req.method === "POST") {
      const body = await readJson<{
        slug: string; voice?: string; music?: string | null;
        sfx?: boolean; captionPosition?: "bottom" | "center";
      }>(req);
      const job = startJob((log) => runVoiceStage(body.slug, body, log));
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/stage/render" && req.method === "POST") {
      const body = await readJson<{ slug: string; composition?: string }>(req);
      const job = startJob((log) =>
        runRenderStage(body.slug, body.composition, log),
      );
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/audio") {
      return send(res, 200, listAudio());
    }

    if (route === "/api/audio/generate" && req.method === "POST") {
      const body = await readJson<{
        kind: "music" | "sfx";
        engine: "local" | "elevenlabs";
        which?: string;
        prompt?: string;
        name?: string;
        seconds?: number;
      }>(req);
      const seconds = body.seconds ?? (body.kind === "music" ? 30 : 2);
      const job = startJob(async (log) => {
        const result =
          body.engine === "elevenlabs"
            ? await makeAudioElevenLabs(body.kind, body.prompt ?? "", seconds,
                body.name ?? body.prompt ?? "audio", log)
            : makeAudioLocal(body.kind, body.which ?? "", seconds, log);
        return { ...result, audio: listAudio() };
      });
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/pexels/search") {
      const query = url.searchParams.get("q") ?? "";
      if (!query.trim()) {
        return send(res, 400, { error: "Thiếu truy vấn" });
      }
      return send(res, 200, { photos: await searchPexels(query) });
    }

    if (route === "/api/pexels/pick" && req.method === "POST") {
      const body = await readJson<{ slug: string; query: string; id: number }>(req);
      return send(res, 200, await pickPexels(body.slug, body.query, body.id));
    }

    if (route === "/api/concat" && req.method === "POST") {
      const body = await readJson<{ slugs: string[]; name: string }>(req);
      const job = startJob((log) =>
        concatVideos(body.slugs, body.name || "ghep", log),
      );
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/render" && req.method === "POST") {
      const body = await readJson<{
        slug: string;
        voice?: string;
        music?: string | null;
        sfx?: boolean;
        captionPosition?: "bottom" | "center";
        composition?: string;
        regenerateVoice?: boolean;
      }>(req);
      const job = startJob((log) =>
        buildAndRender(
          body.slug,
          {
            voice: body.voice,
            music: body.music ?? null,
            sfx: body.sfx ?? false,
            captionPosition: body.captionPosition ?? "bottom",
            composition: body.composition,
            regenerateVoice: body.regenerateVoice ?? false,
          },
          log,
        ),
      );
      return send(res, 200, { jobId: job.id });
    }

    // Tải file lên: body thô + tên file ở header, không cần parser multipart.
    if (route === "/api/upload" && req.method === "POST") {
      const dir = url.searchParams.get("dir") ?? "";
      const name = url.searchParams.get("name") ?? "";
      if (!/^[\w./-]+$/.test(dir) || !/^[\w. -]+$/.test(name)) {
        return send(res, 400, { error: "Tên thư mục hoặc file không hợp lệ" });
      }
      const target = path.resolve(process.cwd(), "public", dir, name);
      if (!target.startsWith(path.resolve(process.cwd(), "public"))) {
        return send(res, 403, { error: "forbidden" });
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await readBody(req));
      return send(res, 200, {
        path: path.posix.join(dir, name),
        bytes: fs.statSync(target).size,
      });
    }

    // Tiến độ job qua SSE.
    if (route.startsWith("/api/job/")) {
      const job = getJob(route.split("/")[3]);
      if (!job) {
        return send(res, 404, { error: "job not found" });
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const write = (line: string) =>
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
      for (const line of job.lines) {
        write(line);
      }
      if (job.status !== "running") {
        res.write(
          `data: ${JSON.stringify({ line: "__END__", status: job.status, result: job.result, error: job.error })}\n\n`,
        );
        return res.end();
      }
      const listener = (line: string) => {
        write(line);
        if (line === "__DONE__" || line.startsWith("__ERROR__")) {
          res.write(
            `data: ${JSON.stringify({ line: "__END__", status: job.status, result: job.result, error: job.error })}\n\n`,
          );
          job.listeners.delete(listener);
          res.end();
        }
      };
      job.listeners.add(listener);
      req.on("close", () => job.listeners.delete(listener));
      return;
    }

    return send(res, 404, { error: "not found" });
  } catch (error) {
    return send(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  process.stdout.write(`\n  AI Video Studio → http://localhost:${PORT}\n\n`);
});
