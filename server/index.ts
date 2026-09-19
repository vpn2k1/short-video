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
  voiceSample,
  writeProps,
  writeScript,
} from "./api";
import {
  createEditorProject, deleteProjects, discardEditorDraft, isSlug, writeEditorProps, listProjects, readChat, readEditorProps, readMulti, startAutoSubtitles, startEditorRender,
  saveChatDraft, saveMultiDraft, startMultiScene, startTurn,
  startVoiceChange,
} from "./chat";
import {
  approveItems, batchCsv, batchExportInfo, batchZip, createBatch, deleteBatch, editItem,
  listBatches, pauseBatch, readBatch, readItemScript, removeItems, restyleSubs, retryItems, saveItemScript, skipItems, startBatch,
  batchCheckStatus, batchCoversStatus, batchBrandStatus, batchExportsStatus, readBatchPostCopy, startBatchBrand, startBatchCovers, startBatchExports, SPOKEN_LANGUAGES, startBatchCheck, startBatchPostCopy,
} from "./batch";
import { deletePreset, listPresets, savePreset } from "./batch-presets";
import {
  CAPTION_FONT_LABELS, CAPTION_PRESET_LABELS, CAPTION_TEMPLATES, DEFAULT_CAPTION_LOOK,
} from "../src/components/captionLook";
import { generateIdeas, generateSeries } from "../scripts/ideas";
import { generatePostCopy, getPostCopy } from "../scripts/post-copy";
import { normalizeScript } from "../scripts/normalize-script";
import { getEditorAssets } from "./editor-build";
import { getIconsJs } from "./icons";
import { FONT_CATALOG, fontGroups } from "../src/fonts/catalog";
import { captureFrame, deleteLibraryMedia, extractAudio, listLibraryMedia, listMedia } from "./media";
import { deleteTrash, listTrash, restoreTrash, trashFilesDir } from "./app-trash";
import { keyStatus, keyTipsSeen, loadKeys, markKeyTipsSeen, saveKeys } from "./keys";
import { isStyleId, STYLE_IDS, STYLES } from "../src/styles/meta";
import { textToScript } from "../scripts/text-script";
import { isScriptProvider, providerLabel, scriptProvider, scriptProviderCatalog } from "../scripts/generate-script";
import { TRANSLATE_LANGUAGES, translateEngines } from "../scripts/translate";
import { generateAiVideo, videoModelCatalog } from "../scripts/ai-video";
import { artStyleCatalog } from "../scripts/image-prompts";
import {
  BILI_ORDERS, bilibiliDetail, downloadBilibili, isBvid, searchBilibiliTopic, toChineseKeywords, updateYtDlp, ytDlpVersion,
  type BiliOrder,
} from "../scripts/bilibili";
import { watermarkFromSettings } from "../scripts/watermark";
import { ASPECT_IDS, ASPECTS, type AspectId } from "../src/aspects";
import { getJob, startJob } from "./jobs";
import { parseVersion } from "./versions";
import { freeMode, usageSummary } from "../scripts/usage";
import { downloadStock, isStockKind, isStockProvider, searchStock, stockProviders, type Orientation } from "../scripts/stock";
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
  ".woff2": "font/woff2",
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

/**
 * Chỉ cho phép đọc file bên trong thư mục cho trước — chặn ../
 * `media`: ảnh/video/âm thanh của video — hỗ trợ Range (trình duyệt và @remotion/media
 * đọc video từng đoạn khi tua) và ETag để lần sau chỉ hỏi lại 304 thay vì tải lại cả file.
 * Không có Range, mỗi thẻ <video> kéo nguyên file và giữ kết nối — trình duyệt chỉ mở
 * 6 kết nối/host nên các request sau xếp hàng, xem trước bị đứng.
 */
const serveFile = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  base: string,
  rel: string,
  media = false,
) => {
  let target: string;
  try {
    target = path.resolve(base, "." + decodeURIComponent(rel));
  } catch {
    return send(res, 400, { error: "bad path" });
  }
  // So kèm dấu phân cách — "/public" không được khớp nhầm "/publicX".
  if (!target.startsWith(path.resolve(base) + path.sep)) {
    return send(res, 403, { error: "forbidden" });
  }
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    return send(res, 404, { error: "not found" });
  }

  const size = stat.size;
  // File sinh lại cùng tên (ảnh, giọng đọc) đổi mtime/size nên ETag đổi theo — không dính bản cũ.
  const etag = `"${size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers: Record<string, string | number> = {
    "Content-Type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": media ? "no-cache" : "no-store",
    "Accept-Ranges": "bytes",
    ...(media ? { ETag: etag, "Last-Modified": stat.mtime.toUTCString() } : {}),
  };

  if (media && req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), size - 1);
    } else {
      // "bytes=-N": N byte cuối file.
      start = Math.max(0, size - Number(range[2]));
    }
    if (start > end || start >= size) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
      return res.end();
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = size === 0 ? 0 : end - start + 1;

  res.writeHead(status, headers);
  if (req.method === "HEAD" || size === 0) return res.end();
  const stream = fs.createReadStream(target, { start, end });
  // Trình duyệt huỷ request khi tua/đổi video — đóng file ngay, không đọc tiếp vô ích.
  res.on("close", () => stream.destroy());
  stream.on("error", () => res.destroy()).pipe(res);
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
      return serveFile(req, res, publicDir, "/index.html");
    }
    // Trình chỉnh sửa: JS + CSS đóng gói lúc chạy (xem editor-build.ts).
    if (route === "/editor/app.js" || route === "/editor/crop.js" || route === "/editor/tailwind.css") {
      try {
        const assets = await getEditorAssets();
        const isJs = route.endsWith(".js");
        res.writeHead(200, {
          "Content-Type": MIME[isJs ? ".js" : ".css"],
          "Cache-Control": "no-store",
        });
        return res.end(route === "/editor/crop.js" ? assets.cropJs : isJs ? assets.js : assets.css);
      } catch (error) {
        return send(res, 500, {
          error: `Không đóng gói được trình chỉnh sửa: ${error instanceof Error ? error.message : error}`,
        });
      }
    }
    // Icon Lucide cho các trang không dùng React — chỉ gồm icon trang thật sự dùng (server/icons.ts).
    if (route === "/icons.js") {
      res.writeHead(200, { "Content-Type": MIME[".js"], "Cache-Control": "no-store" });
      return res.end(getIconsJs());
    }
    // Mọi file khác trong server/public (app.js, css…)
    if (!route.startsWith("/api/") && !route.startsWith("/out/") &&
        !route.startsWith("/public/") &&
        fs.existsSync(path.join(publicDir, "." + route))) {
      return serveFile(req, res, publicDir, route);
    }
    if (route.startsWith("/out/")) {
      return serveFile(req, res, path.join(process.cwd(), "out"), route.slice(4), true);
    }
    if (route.startsWith("/public/")) {
      return serveFile(req, res, path.join(process.cwd(), "public"), route.slice(7), true);
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
        /** Kiểu vẽ khi AI vẽ ảnh / tạo clip (3D, hoạt hình…) — ghép với mọi phong cách. */
        artStyles: artStyleCatalog(),
        ...(({ models, defaultModel }) => ({ videoModels: models, videoDefault: defaultModel }))(videoModelCatalog()),
        /** AI viết kịch bản chọn được cho từng video (nhà cung cấp + model theo Cài đặt). */
        scriptProviders: scriptProviderCatalog(),
        /** 💚 Chế độ Miễn phí: giao diện khoá các lựa chọn tính tiền. */
        freeMode: freeMode(),
        /** Watermark theo Cài đặt — trình chỉnh sửa gắn vào khung xem trước. */
        watermark: watermarkFromSettings(),
        /** Đã hiện popup gợi ý key lúc tạo video lần đầu. */
        keyTipsSeen: keyTipsSeen(),
        keys: {
          /** Có key của một nhà cung cấp viết kịch bản nào đó (kể cả gói miễn phí). */
          script: Boolean(scriptProvider()),
          scriptLabel: ((p) => (p ? providerLabel(p) : null))(scriptProvider()),
          /** Cài đặt AI viết kịch bản: "auto" (thử lần lượt) hay đã ghim một nhà cung cấp. */
          scriptSetting: isScriptProvider(process.env.SCRIPT_PROVIDER) ? process.env.SCRIPT_PROVIDER : "auto",
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
          groq: Boolean(process.env.GROQ_API_KEY),
          openrouter: Boolean(process.env.OPENROUTER_API_KEY),
          elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
          /** Có nguồn ảnh/clip miễn phí (Pexels hoặc Pixabay) — giữ tên cũ cho các chỗ đang kiểm tra. */
          pexels: Boolean(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY),
          pixabay: Boolean(process.env.PIXABAY_API_KEY),
          freesound: Boolean(process.env.FREESOUND_API_KEY),
          /** Vẽ ảnh FLUX miễn phí qua Cloudflare — dùng cả khi bật chế độ Miễn phí. */
          flux: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
          gemini: Boolean(process.env.GEMINI_API_KEY),
          fal: Boolean(process.env.FAL_KEY),
          replicate: Boolean(process.env.REPLICATE_API_TOKEN),
        },
      });
    }

    /** Lượt gọi AI hôm nay + lần gần nhất bị chặn vì hạn mức — hiện trong ⚙ Cài đặt. */
    if (route === "/api/usage") {
      return send(res, 200, { ...usageSummary(), freeMode: freeMode() });
    }

    /** Model dịch phụ đề dùng được — hỏi thật Ollama, nên gọi lại khi người dùng bấm "Kiểm tra lại". */
    if (route === "/api/translate/engines") {
      return send(res, 200, { engines: await translateEngines(), languages: TRANSLATE_LANGUAGES, platform: process.platform });
    }

    // ---- cài đặt API key ----
    if (route === "/api/key-tips/seen" && req.method === "POST") {
      markKeyTipsSeen();
      return send(res, 200, { ok: true });
    }
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

    // Nhờ AI sửa đoạn dán vào cho đúng cú pháp kịch bản — cần 1 API key, không ghi gì ra đĩa.
    if (route === "/api/script-normalize" && req.method === "POST") {
      try {
        const body = await readJson<{ text?: string; style?: string; provider?: string }>(req);
        const style = body.style === "auto" || isStyleId(body.style) ? body.style : "auto";
        return send(res, 200, await normalizeScript(String(body.text ?? ""), {
          style,
          provider: isScriptProvider(body.provider) ? body.provider : "auto",
        }));
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
      return serveFile(req, res, dir, `/${rest[0]}`, true);
    }

    // Cắt khung hình đang xem thành ảnh (nút 📷 trên timeline).
    if (route === "/api/media/capture-frame" && req.method === "POST") {
      try {
        const body = await readJson<{ src?: unknown; atMs?: unknown }>(req);
        return send(res, 200, await captureFrame(body?.src, body?.atMs));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
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
    // Bản nháp chưa gửi (ô chat, danh sách cảnh) — lưu liên tục để tắt app/mất điện không mất.
    if ((route === "/api/chat/draft" || route === "/api/multi/draft") && req.method === "POST") {
      try {
        const body = await readJson(req);
        return send(res, 200, route === "/api/chat/draft" ? saveChatDraft(body) : saveMultiDraft(body));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

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
      // ?version=n: bản đang mở trong trình chỉnh sửa (bỏ trống = bản mới nhất). Xem server/versions.ts.
      const version = parseVersion(url.searchParams.get("version"));
      try {
        if (action === "render" && req.method === "POST") {
          return send(res, 200, startEditorRender(slug, version));
        }
        if (action === "voice" && req.method === "POST") {
          return send(res, 200, startVoiceChange(slug, await readJson(req), version));
        }
        if (action === "subtitles" && req.method === "POST") {
          return send(res, 200, startAutoSubtitles(slug, await readJson(req), version));
        }
        if (action === "save" && req.method === "POST") {
          return send(res, 200, writeEditorProps(slug, version, await readJson(req)));
        }
        if (action === "discard" && req.method === "POST") {
          return send(res, 200, discardEditorDraft(slug, version));
        }
        if (!action && req.method === "GET") {
          return send(res, 200, readEditorProps(slug, version));
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

    // ---- thêm phụ đề hàng loạt: lựa chọn cho màn 🔤 Phụ đề ----
    if (route === "/api/subs/options") {
      const engines = await translateEngines();
      return send(res, 200, {
        spoken: SPOKEN_LANGUAGES,
        languages: TRANSLATE_LANGUAGES,
        canTranslate: engines.some((engine) => engine.ready),
        look: DEFAULT_CAPTION_LOOK,
        templates: CAPTION_TEMPLATES,
        fonts: CAPTION_FONT_LABELS,
        // Ô chọn font của trang phụ đề: font-family từng font và thứ tự nhóm (src/fonts/catalog.ts).
        fontStacks: Object.fromEntries(Object.entries(FONT_CATALOG).map(([id, info]) => [id, info.stack])),
        singleWeight: Object.entries(FONT_CATALOG).filter(([, info]) => "singleWeight" in info).map(([id]) => id),
        fontGroups: fontGroups().map(([label, ids]) => ({ label, ids })),
        presets: CAPTION_PRESET_LABELS,
      });
    }

    // ---- làm nhiều video một lượt ----
    if (route === "/api/batch-presets") {
      if (req.method !== "POST") return send(res, 200, listPresets());
      try {
        const body = await readJson<{ delete?: unknown }>(req);
        return send(res, 200, body.delete ? deletePreset(body.delete) : savePreset(body));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (route === "/api/batches") {
      return send(res, 200, listBatches());
    }

    // AI nghĩ danh sách ý tưởng từ một chủ đề — đặt trước /api/batch/<id> để không bị nuốt.
    if (route === "/api/batch/ideas" && req.method === "POST") {
      try {
        const body = await readJson<{ topic?: string; count?: number; provider?: string; avoid?: unknown; series?: unknown }>(req);
        if (!body.topic?.trim()) {
          return send(res, 400, { error: "Nhập chủ đề trước đã." });
        }
        // Loạt nhiều tập: AI lên dàn ý cả loạt một lượt, mỗi tập một dòng ý tưởng.
        if (body.series === true) {
          return send(res, 200, await generateSeries(
            body.topic.trim(), Number(body.count) || 5, isScriptProvider(body.provider) ? body.provider : "auto",
          ));
        }
        return send(res, 200, await generateIdeas(
          body.topic.trim(),
          Number(body.count) || 10,
          isScriptProvider(body.provider) ? body.provider : "auto",
          Array.isArray(body.avoid) ? body.avoid.filter((line): line is string => typeof line === "string").map((line) => line.slice(0, 300)) : [],
        ));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Gợi ý tiêu đề, caption, hashtag để đăng video lên từng nền tảng.
    if (route.startsWith("/api/post-copy/")) {
      const slug = route.split("/")[3];
      if (!isSlug(slug)) return send(res, 400, { error: "Tên video không hợp lệ" });
      if (req.method === "POST") {
        try {
          const body = await readJson<{ provider?: unknown }>(req);
          return send(res, 200, await generatePostCopy(slug, isScriptProvider(body.provider) ? body.provider : "auto"));
        } catch (error) {
          return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      }
      return send(res, 200, getPostCopy(slug));
    }

    if (route === "/api/batch" && req.method === "POST") {
      try {
        return send(res, 200, createBatch(await readJson(req)));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (route.startsWith("/api/batch/")) {
      const [, , , id, action] = route.split("/");
      try {
        if (!action && req.method === "GET") {
          return send(res, 200, readBatch(id));
        }
        // Tải cả loạt: zip ghi thẳng ra response, mỗi lúc chỉ giữ một video trong bộ nhớ.
        if (action === "zip" && req.method === "GET") {
          const info = batchExportInfo(id);
          res.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${info.name}"`,
            "Cache-Control": "no-store",
          });
          for (const chunk of batchZip(id)) {
            if (!res.write(chunk)) {
              await new Promise((resolve) => res.once("drain", resolve));
            }
          }
          return res.end();
        }
        // Toàn bộ lời của một mục — ô "Sửa lời" trên bảng theo dõi.
        if (action === "script" && req.method === "GET") {
          return send(res, 200, readItemScript(id, url.searchParams.get("item")));
        }
        if (action === "brand" && req.method === "GET") {
          return send(res, 200, batchBrandStatus(id));
        }
        if (action === "exports" && req.method === "GET") {
          return send(res, 200, batchExportsStatus(id));
        }
        if (action === "covers" && req.method === "GET") {
          return send(res, 200, batchCoversStatus(id));
        }
        if (action === "check" && req.method === "GET") {
          return send(res, 200, batchCheckStatus(id));
        }
        if (action === "post-copy" && req.method === "GET") {
          return send(res, 200, readBatchPostCopy(id));
        }
        if (action === "csv" && req.method === "GET") {
          return send(res, 200, batchCsv(id), {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${id}.csv"`,
          });
        }
        if (req.method === "POST") {
          const body = await readJson<{ ids?: unknown; alsoVideo?: boolean; look?: unknown; looks?: unknown; provider?: unknown; force?: unknown }>(req);
          if (action === "check") return send(res, 200, startBatchCheck(id));
          if (action === "covers") return send(res, 200, startBatchCovers(id, (body as { force?: unknown }).force === true));
          if (action === "exports") return send(res, 200, startBatchExports(id, (body as { aspects?: unknown }).aspects));
          if (action === "brand") return send(res, 200, startBatchBrand(id, body));
          if (action === "post-copy") {
            return send(res, 200, startBatchPostCopy(id, isScriptProvider(body.provider) ? body.provider : "auto", body.force === true));
          }
          if (action === "restyle") return send(res, 200, restyleSubs(id, body.look, body.looks));
          if (action === "edit") return send(res, 200, editItem(id, body));
          if (action === "script") return send(res, 200, saveItemScript(id, body));
          if (action === "start") return send(res, 200, startBatch(id));
          if (action === "pause") return send(res, 200, pauseBatch(id));
          if (action === "approve") return send(res, 200, approveItems(id, body.ids));
          if (action === "retry") return send(res, 200, retryItems(id, body.ids));
          if (action === "skip") return send(res, 200, skipItems(id, body.ids));
          if (action === "remove") return send(res, 200, removeItems(id, body.ids, body.alsoVideo === true));
          if (action === "delete") return send(res, 200, deleteBatch(id));
        }
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
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

    // Nghe thử giọng trước khi chọn: { voice } → { url, durationMs }. Xem voiceSample trong server/api.ts.
    if (route === "/api/voice/sample" && req.method === "POST") {
      try {
        const { voice } = await readJson<{ voice?: unknown }>(req);
        return send(res, 200, await voiceSample(String(voice ?? "")));
      } catch (error) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
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

    // ---- 🆓 kho ảnh, video, nhạc miễn phí (scripts/stock.ts) ----
    if (route === "/api/stock/providers") {
      return send(res, 200, { providers: stockProviders() });
    }

    if (route === "/api/stock/search") {
      const kind = url.searchParams.get("kind");
      const orientation = url.searchParams.get("orientation");
      if (!isStockKind(kind)) return send(res, 400, { error: "Loại media không hợp lệ" });
      return send(res, 200, await searchStock(
        kind,
        url.searchParams.get("q") ?? "",
        (["portrait", "landscape", "square", "any"] as const).includes(orientation as Orientation) ? orientation as Orientation : "any",
        Math.max(1, Math.min(20, Number(url.searchParams.get("page")) || 1)),
      ));
    }

    if (route === "/api/stock/download" && req.method === "POST") {
      const body = await readJson<{ provider?: string; kind?: string; id?: string }>(req);
      if (!isStockProvider(body.provider) || !isStockKind(body.kind) || typeof body.id !== "string") {
        return send(res, 400, { error: "Media không hợp lệ" });
      }
      return send(res, 200, await downloadStock(body.provider, body.kind, body.id));
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

    // ---- tư liệu Bilibili: chỉ video tác giả ghi rõ cho phép dùng (xem scripts/bilibili.ts) ----
    if (route === "/api/bilibili/search") {
      const order = url.searchParams.get("order");
      // Gõ chủ đề tiếng Việt: tự dịch, tìm vài biến thể từ khoá tư liệu, lọc đúng chủ đề (scripts/bilibili.ts).
      return send(res, 200, await searchBilibiliTopic(
        url.searchParams.get("q") ?? "",
        Number(url.searchParams.get("page")) || 1,
        BILI_ORDERS.includes(order as BiliOrder) ? (order as BiliOrder) : "totalrank",
      ));
    }

    if (route.startsWith("/api/bilibili/detail/")) {
      const bvid = route.split("/")[4];
      if (!isBvid(bvid)) return send(res, 400, { error: "Mã video không hợp lệ" });
      return send(res, 200, await bilibiliDetail(bvid));
    }

    if (route === "/api/bilibili/translate" && req.method === "POST") {
      const body = await readJson<{ text?: string }>(req);
      return send(res, 200, await toChineseKeywords(body.text ?? ""));
    }

    if (route === "/api/bilibili/download" && req.method === "POST") {
      const body = await readJson<{
        bvid?: string; part?: number; start?: number | null; end?: number | null; maxHeight?: number; confirmed?: boolean;
      }>(req);
      if (!isBvid(body.bvid)) return send(res, 400, { error: "Mã video không hợp lệ" });
      const seconds = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
      const job = startJob((log) =>
        downloadBilibili(
          {
            bvid: body.bvid as string,
            part: Math.max(1, Math.round(Number(body.part) || 1)),
            start: seconds(body.start),
            end: seconds(body.end),
            maxHeight: body.maxHeight === 720 ? 720 : 1080,
            confirmed: body.confirmed === true,
          },
          log,
        ),
      );
      return send(res, 200, { jobId: job.id });
    }

    if (route === "/api/bilibili/tool") {
      return send(res, 200, { version: await ytDlpVersion() });
    }

    if (route === "/api/bilibili/tool/update" && req.method === "POST") {
      const job = startJob((log) => updateYtDlp(log));
      return send(res, 200, { jobId: job.id });
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
