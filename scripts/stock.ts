/**
 * Kho media miễn phí: ảnh + video (Pexels, Pixabay), nhạc nền + hiệu ứng âm thanh (Freesound).
 * Cả ba đều cho key miễn phí và cho dùng thương mại — Freesound chỉ lấy CC0 và CC-BY (có ghi nguồn),
 * bỏ các giấy phép "phi thương mại".
 *
 * An toàn: trình duyệt chỉ gửi (nhà cung cấp, loại, id). Server tự hỏi lại nhà cung cấp theo id để lấy
 * link tải — không tải link bất kỳ do trình duyệt gửi lên.
 *
 * Tiết kiệm lượt gọi: kết quả tìm kiếm nhớ 24 giờ (Pixabay yêu cầu), file đã tải thì dùng lại.
 * Mỗi file tải về có ghi nguồn cạnh nó (<file>.json) và trong CREDITS.txt của thư mục.
 */
import fs from "fs";
import path from "path";
import { providerError } from "./provider-error";
import { writeCredits } from "./pexels";
import { recordCall } from "./usage";

export type StockKind = "image" | "video" | "music" | "sfx";
export type StockProvider = "pexels" | "pixabay" | "freesound";

export type StockItem = {
  provider: StockProvider;
  id: string;
  kind: StockKind;
  title: string;
  author: string;
  pageUrl: string;
  /** Ảnh nhỏ (ảnh/video) hoặc mp3 nghe thử (nhạc/hiệu ứng). */
  preview: string;
  width?: number;
  height?: number;
  /** Giây — video và âm thanh. */
  duration?: number;
  license: string;
};

const KEYS: Record<StockProvider, string> = {
  pexels: "PEXELS_API_KEY",
  pixabay: "PIXABAY_API_KEY",
  freesound: "FREESOUND_API_KEY",
};
const LABELS: Record<StockProvider, string> = { pexels: "Pexels", pixabay: "Pixabay", freesound: "Freesound" };

/** Nhà cung cấp nào có loại media nào. */
const SUPPORTS: Record<StockProvider, StockKind[]> = {
  pexels: ["image", "video"],
  pixabay: ["image", "video"],
  freesound: ["music", "sfx"],
};

const hasKey = (provider: StockProvider) => Boolean(process.env[KEYS[provider]]);

export const stockProviders = () =>
  (Object.keys(KEYS) as StockProvider[]).map((id) => ({
    id, label: LABELS[id], kinds: SUPPORTS[id], available: hasKey(id), env: KEYS[id],
  }));

// ---------- gọi API có nhớ tạm ----------

const CACHE_MS = 24 * 3600_000;
const cache = new Map<string, { at: number; body: unknown }>();
const UA = "AI-Video-Studio/1.0 (+desktop app)";
/** Pixabay đặt chống bot phía trước API: gọi dồn dập là bị trả trang "Just a moment…" (429). */
const MIN_GAP_MS: Record<StockProvider, number> = { pexels: 0, pixabay: 1200, freesound: 300 };
const lastCall: Record<StockProvider, number> = { pexels: 0, pixabay: 0, freesound: 0 };

const getJson = async <T>(provider: StockProvider, url: string, headers: Record<string, string> = {}): Promise<T> => {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body as T;
  const wait = lastCall[provider] + MIN_GAP_MS[provider] - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall[provider] = Date.now();
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers }, signal: AbortSignal.timeout(20_000) });
  recordCall(LABELS[provider], response.ok);
  if (!response.ok) {
    const text = (await response.text()).slice(0, 400);
    if (/just a moment|cf-chl|challenge/i.test(text)) {
      throw providerError(LABELS[provider], 429,
        "Too many requests — try again in 60s (bị lớp chống bot tạm chặn vì gọi dồn dập)", "hoặc dùng Pexels trong lúc chờ");
    }
    throw providerError(LABELS[provider], response.status, text, "hoặc chọn nguồn khác");
  }
  const body = (await response.json()) as T;
  if (cache.size > 500) cache.clear();
  cache.set(url, { at: Date.now(), body });
  return body;
};

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();

export type Orientation = "portrait" | "landscape" | "square" | "any";

// ---------- Pexels ----------

type PexelsPhoto = {
  id: number; width: number; height: number; url: string; alt?: string; photographer: string;
  src: Record<string, string>;
};
type PexelsVideo = {
  id: number; width: number; height: number; url: string; duration: number; image: string;
  user: { name: string; url: string };
  video_files: { quality: string | null; file_type: string; width: number | null; height: number | null; link: string }[];
};

const pexelsHeaders = () => ({ Authorization: process.env.PEXELS_API_KEY as string });

const pexelsPhotoItem = (p: PexelsPhoto): StockItem => ({
  provider: "pexels", id: String(p.id), kind: "image", title: p.alt || `Ảnh Pexels ${p.id}`, author: p.photographer,
  pageUrl: p.url, preview: p.src.medium ?? p.src.small, width: p.width, height: p.height, license: "Pexels License",
});
const pexelsVideoItem = (v: PexelsVideo): StockItem => ({
  provider: "pexels", id: String(v.id), kind: "video",
  // Pexels không trả mô tả video — lấy từ đường dẫn trang: /video/adding-fresh-herbs-to-soup-6645806/
  title: v.url.match(/\/video\/(.+?)-\d+\/?$/)?.[1]?.replace(/-/g, " ") || `Video Pexels ${v.id}`, author: v.user.name,
  pageUrl: v.url, preview: v.image, width: v.width, height: v.height, duration: v.duration, license: "Pexels License",
});

const searchPexels = async (kind: "image" | "video", query: string, orientation: Orientation, page: number) => {
  const params = qs({ query, per_page: 20, page, orientation: orientation === "any" ? undefined : orientation });
  if (kind === "image") {
    const body = await getJson<{ photos?: PexelsPhoto[] }>("pexels", `https://api.pexels.com/v1/search?${params}`, pexelsHeaders());
    return (body.photos ?? []).map(pexelsPhotoItem);
  }
  const body = await getJson<{ videos?: PexelsVideo[] }>("pexels", `https://api.pexels.com/videos/search?${params}`, pexelsHeaders());
  return (body.videos ?? []).map(pexelsVideoItem);
};

// ---------- Pixabay ----------

type PixabayImage = {
  id: number; pageURL: string; tags: string; user: string; imageWidth: number; imageHeight: number;
  webformatURL: string; largeImageURL: string; previewURL: string;
};
type PixabayVideoFile = { url: string; width: number; height: number; size: number; thumbnail?: string };
type PixabayVideo = {
  id: number; pageURL: string; tags: string; user: string; duration: number;
  videos: Record<"large" | "medium" | "small" | "tiny", PixabayVideoFile>;
};

const PIXABAY_ORIENTATION: Record<Orientation, string | undefined> = {
  portrait: "vertical", landscape: "horizontal", square: undefined, any: undefined,
};

/** Kết quả Pixabay vừa tìm (lấy từ chính API Pixabay, không phải từ trình duyệt) — tải về khỏi gọi API lần nữa. */
const pixabaySeen = new Map<string, { at: number; hit: PixabayImage | PixabayVideo }>();
const seePixabay = <H extends PixabayImage | PixabayVideo>(kind: "image" | "video", hits: H[]) => {
  if (pixabaySeen.size > 2000) pixabaySeen.clear();
  for (const hit of hits) pixabaySeen.set(`${kind}-${hit.id}`, { at: Date.now(), hit });
  return hits;
};
const seenPixabay = <H>(kind: "image" | "video", id: string) => {
  const entry = pixabaySeen.get(`${kind}-${id}`);
  return entry && Date.now() - entry.at < CACHE_MS ? (entry.hit as H) : undefined;
};

const pixabayImageItem = (h: PixabayImage): StockItem => ({
  provider: "pixabay", id: String(h.id), kind: "image", title: h.tags, author: h.user, pageUrl: h.pageURL,
  preview: h.webformatURL, width: h.imageWidth, height: h.imageHeight, license: "Pixabay Content License",
});
const pixabayVideoItem = (h: PixabayVideo): StockItem => {
  const file = h.videos.medium?.url ? h.videos.medium : h.videos.small;
  return {
    provider: "pixabay", id: String(h.id), kind: "video", title: h.tags, author: h.user, pageUrl: h.pageURL,
    preview: file?.thumbnail ?? h.videos.tiny?.thumbnail ?? "", width: file?.width, height: file?.height,
    duration: h.duration, license: "Pixabay Content License",
  };
};

const searchPixabay = async (kind: "image" | "video", query: string, orientation: Orientation, page: number) => {
  const base = { key: process.env.PIXABAY_API_KEY, q: query.slice(0, 100), safesearch: "true", per_page: 20, page };
  if (kind === "image") {
    const body = await getJson<{ hits?: PixabayImage[] }>("pixabay",
      `https://pixabay.com/api/?${qs({ ...base, image_type: "photo", orientation: PIXABAY_ORIENTATION[orientation] })}`);
    return seePixabay("image", body.hits ?? []).map(pixabayImageItem);
  }
  const body = await getJson<{ hits?: PixabayVideo[] }>("pixabay", `https://pixabay.com/api/videos/?${qs({ ...base, video_type: "film" })}`);
  const items = seePixabay("video", body.hits ?? []).map(pixabayVideoItem);
  // API video của Pixabay không lọc được hướng khung — tự lọc.
  return orientation === "portrait" ? items.filter((i) => (i.height ?? 0) >= (i.width ?? 0)).concat(items.filter((i) => (i.height ?? 0) < (i.width ?? 0)))
    : items;
};

// ---------- Freesound ----------

type FreesoundSound = {
  id: number; name: string; username: string; license: string; duration: number; url: string;
  previews: Record<string, string>;
};

/** Chỉ giấy phép dùng thương mại được: CC0 và CC-BY (phải ghi nguồn). */
const FREESOUND_LICENSES = '("Creative Commons 0" OR "Attribution")';
const licenseName = (url: string) =>
  /publicdomain\/zero/i.test(url) ? "CC0" : /by\/\d/i.test(url) ? "CC-BY" : url;

const freesoundItem = (kind: StockKind) => (s: FreesoundSound): StockItem => ({
  provider: "freesound", id: String(s.id), kind, title: s.name, author: s.username, pageUrl: s.url,
  preview: s.previews["preview-hq-mp3"] ?? s.previews["preview-lq-mp3"], duration: Math.round(s.duration),
  license: licenseName(s.license),
});

const FREESOUND_FIELDS = "id,name,username,license,duration,url,previews";

const searchFreesound = async (kind: "music" | "sfx", query: string, page: number) => {
  const filter = kind === "music"
    ? `license:${FREESOUND_LICENSES} duration:[20 TO 600]`
    : `license:${FREESOUND_LICENSES} duration:[0 TO 15]`;
  const body = await getJson<{ results?: FreesoundSound[] }>("freesound", `https://freesound.org/apiv2/search/text/?${qs({
    query: kind === "music" && !/music|nhạc/i.test(query) ? `${query} music` : query,
    filter, fields: FREESOUND_FIELDS, page_size: 20, page, sort: "rating_desc",
    token: process.env.FREESOUND_API_KEY,
  })}`);
  return (body.results ?? []).map(freesoundItem(kind));
};

// ---------- tìm ----------

export const isStockKind = (value: unknown): value is StockKind =>
  value === "image" || value === "video" || value === "music" || value === "sfx";
export const isStockProvider = (value: unknown): value is StockProvider =>
  value === "pexels" || value === "pixabay" || value === "freesound";

/** Tìm ở mọi nhà cung cấp có key cho loại này, xen kẽ kết quả. Một nhà cung cấp lỗi thì vẫn trả phần còn lại. */
export const searchStock = async (kind: StockKind, query: string, orientation: Orientation = "portrait", page = 1) => {
  const q = query.trim().slice(0, 100);
  if (!q) throw new Error("Nhập từ khoá cần tìm.");
  const providers = (Object.keys(SUPPORTS) as StockProvider[]).filter((p) => SUPPORTS[p].includes(kind));
  const usable = providers.filter(hasKey);
  if (usable.length === 0) {
    throw new Error(`Chưa có key ${providers.map((p) => LABELS[p]).join(" hoặc ")} — lấy key miễn phí rồi điền trong ⚙ Cài đặt.`);
  }
  const settled = await Promise.allSettled(usable.map((provider) =>
    provider === "pexels" ? searchPexels(kind as "image" | "video", q, orientation, page)
      : provider === "pixabay" ? searchPixabay(kind as "image" | "video", q, orientation, page)
        : searchFreesound(kind as "music" | "sfx", q, page)));
  const lists = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  const errors = settled.flatMap((r) => (r.status === "rejected" ? [(r.reason as Error).message] : []));
  if (lists.every((l) => l.length === 0) && errors.length > 0) throw new Error(errors.join("\n"));
  const items: StockItem[] = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) {
    for (const list of lists) if (list[i]) items.push(list[i]);
  }
  return { items, errors };
};

// ---------- tải về ----------

/** Link file tốt nhất, hỏi lại nhà cung cấp theo id. */
const resolveDownload = async (provider: StockProvider, kind: StockKind, id: string) => {
  if (!/^\d{1,12}$/.test(id)) throw new Error("Mã media không hợp lệ.");
  if (!hasKey(provider)) throw new Error(`Chưa có key ${LABELS[provider]} — điền trong ⚙ Cài đặt.`);

  if (provider === "pexels" && kind === "image") {
    const p = await getJson<PexelsPhoto>("pexels", `https://api.pexels.com/v1/photos/${id}`, pexelsHeaders());
    return { item: pexelsPhotoItem(p), url: p.src.large2x ?? p.src.original, ext: "jpg" };
  }
  if (provider === "pexels" && kind === "video") {
    const v = await getJson<PexelsVideo>("pexels", `https://api.pexels.com/videos/videos/${id}`, pexelsHeaders());
    // File mp4 có cạnh ngắn gần 1080 nhất (không lấy 4K cho nhẹ, không lấy bản quá mờ).
    const files = v.video_files.filter((f) => f.file_type === "video/mp4" && f.width && f.height);
    const short = (f: (typeof files)[number]) => Math.min(f.width as number, f.height as number);
    const best = [...files].sort((a, b) => Math.abs(short(a) - 1080) - Math.abs(short(b) - 1080))[0];
    if (!best) throw new Error("Video Pexels này không có file mp4.");
    return { item: pexelsVideoItem(v), url: best.link, ext: "mp4" };
  }
  if (provider === "pixabay" && kind === "image") {
    const h = seenPixabay<PixabayImage>("image", id)
      ?? (await getJson<{ hits?: PixabayImage[] }>("pixabay", `https://pixabay.com/api/?${qs({ key: process.env.PIXABAY_API_KEY, id })}`)).hits?.[0];
    if (!h) throw new Error("Không tìm lại được ảnh Pixabay này.");
    return { item: pixabayImageItem(h), url: h.largeImageURL, ext: "jpg" };
  }
  if (provider === "pixabay" && kind === "video") {
    const h = seenPixabay<PixabayVideo>("video", id)
      ?? (await getJson<{ hits?: PixabayVideo[] }>("pixabay", `https://pixabay.com/api/videos/?${qs({ key: process.env.PIXABAY_API_KEY, id })}`)).hits?.[0];
    if (!h) throw new Error("Không tìm lại được video Pixabay này.");
    const file = [h.videos.large, h.videos.medium, h.videos.small].find((f) => f?.url && Math.min(f.width, f.height) <= 1080)
      ?? h.videos.medium ?? h.videos.small;
    return { item: pixabayVideoItem(h), url: file.url, ext: "mp4" };
  }
  if (provider === "freesound" && (kind === "music" || kind === "sfx")) {
    const s = await getJson<FreesoundSound>("freesound",
      `https://freesound.org/apiv2/sounds/${id}/?${qs({ fields: FREESOUND_FIELDS, token: process.env.FREESOUND_API_KEY })}`);
    const item = freesoundItem(kind)(s);
    if (item.license !== "CC0" && item.license !== "CC-BY") throw new Error("Âm thanh này không có giấy phép dùng thương mại.");
    // Bản nghe thử chất lượng cao (mp3 ~128 kbps) — tải bản gốc cần đăng nhập OAuth.
    return { item, url: item.preview, ext: "mp3" };
  }
  throw new Error(`${LABELS[provider]} không có loại media này.`);
};

/** Chỉ tải từ đúng máy chủ file của nhà cung cấp. */
const ALLOWED_HOSTS = /(^|\.)(pexels\.com|pixabay\.com|freesound\.org|cdn\.pixabay\.com|videos\.pexels\.com|images\.pexels\.com)$/i;

const FOLDERS: Record<StockKind, string> = {
  image: "uploads/stock", video: "uploads/stock", music: "music/stock", sfx: "sfx/stock",
};

/** Tải một media về thư viện. Đã tải trước đó thì dùng lại, không gọi mạng. */
export const downloadStock = async (provider: StockProvider, kind: StockKind, id: string) => {
  const folder = FOLDERS[kind];
  const dir = path.join(process.cwd(), "public", folder);
  const existing = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => f.startsWith(`${provider}-${kind}-${id}.`) && !f.endsWith(".json") && !f.endsWith(".part"))
    : undefined;
  if (existing) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, `${provider}-${kind}-${id}.json`), "utf8")) as { credit: string };
    return { path: `${folder}/${existing}`, credit: meta.credit, reused: true };
  }

  const { item, url, ext } = await resolveDownload(provider, kind, id);
  if (!url || !ALLOWED_HOSTS.test(new URL(url).hostname)) throw new Error("Link tải không thuộc nhà cung cấp — bỏ qua.");
  const response = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`Tải file từ ${LABELS[provider]} thất bại (${response.status}).`);
  const bytes = Number(response.headers.get("content-length") ?? 0);
  if (bytes > 300 * 1024 * 1024) throw new Error("File lớn quá 300 MB.");

  fs.mkdirSync(dir, { recursive: true });
  const name = `${provider}-${kind}-${id}.${ext}`;
  const target = path.join(dir, name);
  fs.writeFileSync(`${target}.part`, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(`${target}.part`, target);

  const credit = `${item.kind === "music" ? "Nhạc" : item.kind === "sfx" ? "Âm thanh" : item.kind === "video" ? "Video" : "Ảnh"}: ` +
    `${item.title.slice(0, 60)} — ${item.author} — ${LABELS[provider]} (${item.license}) ${item.pageUrl}`;
  fs.writeFileSync(path.join(dir, `${provider}-${kind}-${id}.json`), JSON.stringify({ ...item, credit, downloadedAt: new Date().toISOString() }, null, 2));
  writeCredits(dir, [credit]);
  return { path: `${folder}/${name}`, credit, reused: false };
};

/**
 * Hình cho cảnh trong pipeline: tìm theo truy vấn (tiếng Anh), lấy kết quả đầu tiên chưa dùng trong video này.
 * `kind` video: ưu tiên clip dài ít nhất bằng cảnh (ngắn hơn thì ClipVideo tự lặp). Hết cách thì trả null.
 */
export const stockForScene = async (
  kind: "image" | "video",
  query: string,
  minSeconds: number,
  used: Set<string>,
) => {
  const { items } = await searchStock(kind, query, "portrait");
  const fresh = items.filter((i) => !used.has(`${i.provider}-${i.id}`));
  const pick = kind === "video"
    ? fresh.find((i) => (i.duration ?? 0) >= minSeconds) ?? fresh[0]
    : fresh[0];
  if (!pick) return null;
  used.add(`${pick.provider}-${pick.id}`);
  return downloadStock(pick.provider, pick.kind, pick.id);
};

/** Giá trị nhạc nền "🎲 Nhạc ngẫu nhiên" — mỗi lần dựng video chọn một bản khác (xem resolveMusicChoice ở server/chat.ts). */
export const RANDOM_MUSIC = "random";

/**
 * Kiểu nhạc nền hợp video ngắn để bốc ngẫu nhiên — nhạc không lời, nhịp vừa, không nặng nề.
 * Tìm bằng tiếng Anh vì thẻ trên Freesound chủ yếu là tiếng Anh.
 */
const RANDOM_MUSIC_QUERIES = [
  "upbeat background music", "happy ukulele background", "calm ambient background music", "lofi chill beat",
  "acoustic guitar background music", "corporate inspiring background", "cinematic soft piano background",
  "light electronic background music", "positive motivational background", "chill hip hop instrumental",
];

/**
 * Bốc ngẫu nhiên một bản nhạc nền từ Freesound (CC0/CC-BY), tải vào public/music/stock kèm ghi nguồn.
 * Chọn bản 30 giây – 4 phút: ngắn hơn thì lặp nghe rõ chỗ nối, dài hơn thì tải lâu. Không lấy được thì trả null.
 */
export const randomFreesoundMusic = async (log: (line: string) => void = () => {}) => {
  if (!hasKey("freesound")) return null;
  const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  const tried = new Set<string>();
  for (let attempt = 0; attempt < 3; attempt++) {
    const query = pick(RANDOM_MUSIC_QUERIES.filter((q) => !tried.has(q)));
    tried.add(query);
    try {
      // Chỉ trang đầu (20 bản xếp theo đánh giá): truy vấn hẹp không có trang 2–3, Freesound trả 404 (đã gặp).
      const { items } = await searchStock("music", query, "any", 1);
      const fits = items.filter((i) => (i.duration ?? 0) >= 30 && (i.duration ?? 0) <= 240);
      if (fits.length === 0) continue;
      const item = pick(fits);
      const saved = await downloadStock("freesound", "music", item.id);
      log(`🎲 Nhạc ngẫu nhiên: “${item.title}” — ${item.author} (Freesound, ${item.license})`);
      return saved;
    } catch (error) {
      log(`Không lấy được nhạc Freesound (“${query}”): ${error instanceof Error ? error.message : error}`);
    }
  }
  return null;
};
