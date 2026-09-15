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
import {
  createEditorProject, deleteProjects, isSlug, listProjects, readChat, readEditorProps, readMulti, startAutoSubtitles, startEditorRender,
  startMultiScene, startTurn,
  startVoiceChange,
} from "./chat";
import { getEditorAssets } from "./editor-build";
import { deleteLibraryMedia, extractAudio, listLibraryMedia, listMedia } from "./media";
import { deleteTrash, listTrash, restoreTrash, trashFilesDir } from "./app-trash";
import { keyStatus, loadKeys, saveKeys } from "./keys";
import { isStyleId, STYLE_IDS, STYLES } from "../src/styles/meta";
import { textToScript } from "../scripts/text-script";
import { providerLabel, scriptProvider } from "../scripts/generate-script";
import { TRANSLATE_LANGUAGES, translateEngines } from "../scripts/translate";
import { generateAiVideo, videoModelCatalog } from "../scripts/ai-video";
import { watermarkFromSettings } from "../scripts/watermark";
import { ASPECT_IDS, ASPECTS, type AspectId } from "../src/aspects";
import { getJob, startJob } from "./jobs";
import { pipelineStatus, runRenderStage, runVoiceStage } from "./pipeline";
import { slugify } from "../scripts/slug";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // .env không bắt buộc
}
// API key lấy từ ô Cài đặt (data/api-keys.json), không lấy từ .env.
loadKeys();

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
  ".avif": "image/avif",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
};

/** File người dùng được tải lên để dùng trong video. */
const UPLOAD_EXT = /\.(jpe?g|png|webp|avif|mp4|mov|webm|mp3|wav|m4a|aac|ogg)$/i;
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

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
  const target = path.resolve(base, "." + decodeURIComponent(rel));
  // So kèm dấu phân cách — "/public" không được khớp nhầm "/publicX".
  if (!target.startsWith(path.resolve(base) + path.sep)) {
    return send(res, 403, { error: "forbidden" });
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return send(res, 404, { error: "not found" });
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(target)
    .on("error", () => res.destroy())
    .pipe(res);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const route = url.pathname;

  // Chặn trang web khác gửi request ngầm tới server local (ghi đè API key, tốn quota).
  // Trình duyệt luôn gửi Origin cho POST cross-site; curl/CLI không gửi thì cho qua.
  const origin = req.headers.origin;
  if (req.method !== "GET" && origin) {
    let sameHost = false;
    try { sameHost = new URL(origin).host === req.headers.host; } catch { /* Origin hỏng */ }
    if (!sameHost) {
      return send(res, 403, { error: "forbidden origin" });
    }
  }

  try {
    // ---- file tĩnh ----
    if (route === "/" || route === "/index.html") {
      return serveFile(res, publicDir, "/index.html");
    }
    // Trình chỉnh sửa: JS + CSS đóng gói lúc chạy (xem editor-build.ts).
    if (route === "/editor/app.js" || route === "/editor/tailwind.css") {
      try {
        const assets = await getEditorAssets();
        const isJs = route.endsWith(".js");
        res.writeHead(200, {
          "Content-Type": MIME[isJs ? ".js" : ".css"],
          "Cache-Control": "no-store",
        });
        return res.end(isJs ? assets.js : assets.css);
      } catch (error) {
        return send(res, 500, {
          error: `Không đóng gói được trình chỉnh sửa: ${error instanceof Error ? error.message : error}`,
        });
      }
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
        styles: STYLE_IDS.map((id) => STYLES[id]),
        ...(({ models, defaultModel }) => ({ videoModels: models, videoDefault: defaultModel }))(videoModelCatalog()),
        /** Watermark theo Cài đặt — trình chỉnh sửa gắn vào khung xem trước. */
        watermark: watermarkFromSettings(),
        keys: {
          /** Có key của một nhà cung cấp viết kịch bản nào đó (kể cả gói miễn phí). */
          script: Boolean(scriptProvider()),
          scriptLabel: ((p) => (p ? providerLabel(p) : null))(scriptProvider()),
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
          groq: Boolean(process.env.GROQ_API_KEY),
          openrouter: Boolean(process.env.OPENROUTER_API_KEY),
          elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
          pexels: Boolean(process.env.PEXELS_API_KEY),
          gemini: Boolean(process.env.GEMINI_API_KEY),
          fal: Boolean(process.env.FAL_KEY),
          replicate: Boolean(process.env.REPLICATE_API_TOKEN),
        },
      });
    }

    /** Model dịch phụ đề dùng được — hỏi thật Ollama, nên gọi lại khi người dùng bấm "Kiểm tra lại". */
    if (route === "/api/translate/engines") {
      return send(res, 200, { engines: await translateEngines(), languages: TRANSLATE_LANGUAGES, platform: process.platform });
    }

    // ---- cài đặt API key ----
    if (route === "/api/keys") {
      if (req.method === "POST") {
        try {
          return send(res, 200, saveKeys(await readJson(req)));
        } catch (error) {
          return send(res, 400, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return send(res, 200, keyStatus());
    }

    // Xem trước kịch bản dán vào sẽ được tách thế nào — không gọi AI, không ghi gì.
    if (route === "/api/script-preview" && req.method === "POST") {
      try {
        const body = await readJson<{ text?: string; style?: string }>(req);
        const style = body.style === "auto" || isStyleId(body.style) ? body.style : "auto";
        const { script, notes } = textToScript(String(body.text ?? ""), { style });
        return send(res, 200, {
          title: script.title,
          style: script.style,
          scenes: script.scenes.length,
          lines: script.scenes.reduce((n, s) => n + s.lines.length, 0),
          punches: script.scenes.filter((s) => s.punch).length,
          notes,
        });
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // ---- chat: một ô prompt tạo và sửa video ----
    if (route === "/api/projects") {
      return send(res, 200, { projects: listProjects() });
    }
    if (route === "/api/projects/delete" && req.method === "POST") {
      try {
        const body = (await readJson(req)) as { slugs?: unknown } | null;
        return send(res, 200, deleteProjects(body?.slugs));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (route.startsWith("/api/chat/") && req.method === "GET") {
      const slug = route.split("/")[3];
      if (!isSlug(slug)) {
        return send(res, 400, { error: "Tên video không hợp lệ" });
      }
      return send(res, 200, readChat(slug));
    }

    if (route === "/api/chat" && req.method === "POST") {
      try {
        return send(res, 200, startTurn(await readJson(req)));
      } catch (error) {
        return send(res, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ---- trình chỉnh sửa ----
    if (route === "/api/media") {
      return send(res, 200, listMedia());
    }

    // ---- thư viện: tab 🗂 Tài nguyên ----
    if (route === "/api/library/media") {
      return send(res, 200, listLibraryMedia());
    }
    if (route === "/api/media/delete" && req.method === "POST") {
      try {
        const body = await readJson<{ paths?: unknown; force?: unknown }>(req);
        return send(res, 200, deleteLibraryMedia(body?.paths, body?.force === true));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // ---- thư viện: tab 🗑 Thùng rác ----
    if (route === "/api/trash") {
      return send(res, 200, listTrash());
    }
    if (route === "/api/trash/restore" && req.method === "POST") {
      try {
        const body = await readJson<{ ids?: unknown }>(req);
        return send(res, 200, restoreTrash(body?.ids));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (route === "/api/trash/delete" && req.method === "POST") {
      try {
        const body = await readJson<{ ids?: unknown; all?: unknown }>(req);
        return send(res, 200, deleteTrash(body?.all === true ? "all" : body?.ids));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    // Ảnh/video xem trước của mục trong thùng rác: /api/trash/file/<id>/<tên file>
    if (route.startsWith("/api/trash/file/") && req.method === "GET") {
      const [id, ...rest] = route.slice("/api/trash/file/".length).split("/");
      const dir = trashFilesDir(id);
      if (!dir || rest.length !== 1) return send(res, 404, { error: "not found" });
      return serveFile(res, dir, `/${rest[0]}`);
    }

    if (route === "/api/media/extract-audio" && req.method === "POST") {
      try {
        const body = await readJson<{ src?: unknown }>(req);
        return send(res, 200, await extractAudio(body.src));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // ---- video nhiều cảnh: mỗi cảnh một prompt ----
    if (route === "/api/multi" && req.method === "POST") {
      try {
        return send(res, 200, startMultiScene(await readJson(req)));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (route.startsWith("/api/multi/") && req.method === "GET") {
      const slug = route.split("/")[3];
      if (!isSlug(slug)) {
        return send(res, 400, { error: "Tên video không hợp lệ" });
      }
      const multi = readMulti(slug);
      return multi
        ? send(res, 200, { slug, ...multi })
        : send(res, 404, { error: "Không thấy video nhiều cảnh này" });
    }

    // ---- tạo video clip bằng AI ----
    if (route === "/api/ai-video/models") {
      return send(res, 200, videoModelCatalog());
    }

    if (route === "/api/ai-video" && req.method === "POST") {
      const body = await readJson<{ prompt?: string; model?: string; seconds?: number; aspect?: string }>(req);
      if (!body.prompt?.trim()) {
        return send(res, 400, { error: "Thiếu mô tả video" });
      }
      const aspect = ASPECTS[ASPECT_IDS.includes(body.aspect as AspectId) ? (body.aspect as AspectId) : "9:16"];
      const job = startJob((log) =>
        generateAiVideo(
          {
            prompt: body.prompt as string,
            model: body.model,
            seconds: Number(body.seconds) || undefined,
            width: aspect.width,
            height: aspect.height,
          },
          log,
        ),
      );
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/editor/new" && req.method === "POST") {
      try {
        return send(res, 200, createEditorProject(await readJson(req)));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (route.startsWith("/api/editor/")) {
      const [, , , slug, action] = route.split("/");
      if (!isSlug(slug)) {
        return send(res, 400, { error: "Tên video không hợp lệ" });
      }
      try {
        if (action === "render" && req.method === "POST") {
          return send(res, 200, startEditorRender(slug));
        }
        if (action === "voice" && req.method === "POST") {
          return send(res, 200, startVoiceChange(slug, await readJson(req)));
        }
        if (action === "subtitles" && req.method === "POST") {
          return send(res, 200, startAutoSubtitles(slug, await readJson(req)));
        }
        if (!action && req.method === "GET") {
          return send(res, 200, readEditorProps(slug));
        }
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return send(res, 404, { error: "unknown action" });
    }

    if (route.startsWith("/api/video/") && req.method === "GET") {
      const slug = route.split("/")[3];
      if (!isSlug(slug)) {
        return send(res, 400, { error: "Tên video không hợp lệ" });
      }
      return send(res, 200, readVideo(slug));
    }

    if (route.startsWith("/api/video/") && req.method === "POST") {
      const [, , , slug, what] = route.split("/");
      if (!isSlug(slug)) {
        return send(res, 400, { error: "Tên video không hợp lệ" });
      }
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

    // Tải ảnh/video lên public/uploads/: body thô + tên file ở query, không cần
    // parser multipart. Tên được làm sạch và gắn thời gian nên không ghi đè nhau.
    if (route === "/api/upload" && req.method === "POST") {
      const name = url.searchParams.get("name") ?? "";
      const ext = path.extname(name).toLowerCase();
      if (!UPLOAD_EXT.test(ext)) {
        return send(res, 400, { error: "Chỉ nhận ảnh (jpg, png, webp, avif), video (mp4, mov, webm) hoặc âm thanh (mp3, wav, m4a, aac, ogg)" });
      }
      if (Number(req.headers["content-length"] ?? 0) > MAX_UPLOAD_BYTES) {
        return send(res, 413, { error: "File lớn quá 500 MB" });
      }
      const file = `${Date.now()}-${slugify(path.basename(name, ext), 40)}${ext}`;
      const target = path.join(process.cwd(), "public", "uploads", file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await readBody(req));
      return send(res, 200, {
        path: `uploads/${file}`,
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

// Chỉ nghe trên máy này — server không có đăng nhập, mở ra LAN là ai cũng dùng được.
server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`\n  AI Video Studio → http://localhost:${PORT}\n\n`);
});
