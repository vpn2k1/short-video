/**
 * Tìm và tải tư liệu trên Bilibili — CHỈ những video tác giả ghi rõ cho phép dùng.
 *
 * Bilibili không có bộ lọc giấy phép, nên quyền dùng đọc từ chính lời tác giả:
 *   1. Tìm kiếm → giữ video có câu cho phép trong mô tả/tiêu đề (xem PERMIT) và không có câu cấm (DENY).
 *   2. Kiểm tra chi tiết từng video: phải là video tự làm (copyright = 1, không phải "转载"),
 *      không thu phí/độc quyền hội viên. Server kiểm tra lại lần nữa ngay trước khi tải.
 *   3. Lưu bằng chứng (câu cho phép, mô tả gốc, link, ngày tải) cạnh file để ghi nguồn khi đăng.
 *
 * Luật chữ chỉ lọc sơ bộ — người dùng vẫn phải đọc câu cho phép và xác nhận trước khi tải.
 *
 * API web của Bilibili chặn request "lạ" (lỗi -412 / trả trang HTML): cần cookie buvid3 lấy từ trang chủ,
 * ký WBI, và gọi thưa — mọi request đi qua một hàng đợi cách nhau REQUEST_GAP_MS.
 */
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { ProviderChoice } from "./generate-script";
import { askJson, parseJson } from "./llm-json";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const REQUEST_GAP_MS = 700;
const SESSION_TTL_MS = 60 * 60_000;

/** Câu tác giả cho phép dùng nội dung của chính video này. */
const PERMIT: [RegExp, string][] = [
  [/(全部|均|都|免费|可以|可)商用/, "được dùng thương mại"],
  [/(免费|随便|随意|自由|放心)(使用|用)|拿去用|欢迎(使用|取用|下载使用)/, "được dùng miễn phí"],
  [/(无需|不需要|不用)(授权|署名|联系)/, "không cần xin phép"],
  [/(欢迎|允许|可以|可)(转载|搬运)/, "cho phép đăng lại"],
  [/(欢迎|允许|可以|可)二创/, "cho phép làm lại (二创)"],
  [/\bCC0\b|\bCC[ -]?BY\b(?![ -]?NC)|知识共享/i, "giấy phép Creative Commons"],
];

/** Câu cấm, hoặc dấu hiệu người đăng không phải chủ nội dung ("侵删", "版权归原作者", "作者: Kippert"). */
const DENY =
  /转自|搬运自|来源[:：]|原作者|作者\s*[:：]|禁止(转载|搬运|商用|二次|二创|使用)|(请勿|谢绝|不得|严禁)(转载|搬运|商用|二次)|(不可|不能|不允许)商用|非商用|非商业|\bNC\b|未经(授权|允许|许可|同意)|侵删|侵权(请)?(联系)?删|如有侵权|仅供(学习|参考|个人|欣赏)|仅限个人|版权(归|属于)(原|其)|充电专属/i;

/**
 * Tiêu đề nói VỀ tư liệu của nơi khác, không phải cho phép dùng video này: "推荐 10 个免费可商用素材网站",
 * "千万别再乱用剪映可商用素材", quảng cáo kho trả phí ("正版可商用【新片场】" = mua bản quyền mới được dùng).
 * Chỉ xét tiêu đề: mô tả của kênh tư liệu thật cũng hay nhắc "某些网站" khi so sánh.
 */
const ABOUT_OTHERS =
  /网站|网址|素材站|平台|哪里找|怎么找|如何找|教程|推荐|\d+\s*(个|款)|字体|乱用|别再|侵权吗|会不会侵权|安全吗|正版|新片场|光厂|包图|摄图|千图|视觉中国|图虫|剪映|必剪/;

export type Permission = {
  /** Nhãn tiếng Việt cho từng loại cho phép tìm thấy. */
  labels: string[];
  /** Câu gốc chứa lời cho phép — hiện cho người dùng đọc. */
  quote: string;
};

const ENTITIES: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " " };
const stripHtml = (text: string) =>
  text
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) =>
      code[0] !== "#" ? ENTITIES[code.toLowerCase()] ?? whole
        : String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1))));

/** Tìm lời cho phép trong tiêu đề + mô tả; có câu cấm ở bất kỳ đâu thì coi như không cho phép. */
export const findPermission = (title: string, desc: string): Permission | null => {
  const text = `${title}\n${desc}`;
  if (DENY.test(text) || ABOUT_OTHERS.test(title)) return null;
  const labels = PERMIT.filter(([re]) => re.test(text)).map(([, label]) => label);
  if (labels.length === 0) return null;
  // Câu chứa lời cho phép — ưu tiên mô tả (lời tác giả) hơn tiêu đề; cắt theo dấu câu và xuống dòng.
  const sentences = `${desc}\n${title}`.split(/(?<=[。！!？?；;\n])/).map((s) => s.trim()).filter(Boolean);
  const quote = sentences.find((s) => PERMIT.some(([re]) => re.test(s))) ?? title;
  return { labels, quote: quote.slice(0, 240) };
};

// ---------- phiên làm việc với API ----------

let queue: Promise<unknown> = Promise.resolve();
/** Gọi API thưa ra — Bilibili chặn IP gọi dồn dập vài phút. */
const throttled = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, REQUEST_GAP_MS)),
    () => new Promise((r) => setTimeout(r, REQUEST_GAP_MS)),
  );
  return run;
};

const MIXIN_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41,
  13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34,
  44, 52,
];

type Session = { cookie: string; mixinKey: string; at: number };
let session: Session | null = null;

const blocked = () =>
  new Error("Bilibili đang tạm chặn vì gọi quá nhiều — đợi vài phút rồi thử lại.");

const readApi = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text.startsWith("{")) throw blocked();
  const body = JSON.parse(text) as { code: number; message: string; data: T };
  if (body.code === -412 || body.code === -352) throw blocked();
  if (body.code !== 0) throw new Error(`Bilibili báo lỗi ${body.code}: ${body.message}`);
  return body.data;
};

const getSession = async (): Promise<Session> => {
  if (session && Date.now() - session.at < SESSION_TTL_MS) return session;
  const home = await fetch("https://www.bilibili.com/", { headers: { "User-Agent": UA } });
  const cookie = home.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  if (!cookie.includes("buvid3=")) throw new Error("Không kết nối được Bilibili — kiểm tra mạng.");
  const nav = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/", Cookie: cookie },
  });
  // nav trả code -101 (chưa đăng nhập) nhưng vẫn kèm khoá WBI.
  const text = await nav.text();
  if (!text.startsWith("{")) throw blocked();
  const wbi = (JSON.parse(text) as { data?: { wbi_img?: { img_url: string; sub_url: string } } }).data?.wbi_img;
  if (!wbi) throw new Error("Bilibili đổi cách ký request — cập nhật app.");
  const key = (url: string) => url.split("/").pop()!.split(".")[0];
  const raw = key(wbi.img_url) + key(wbi.sub_url);
  session = { cookie, mixinKey: MIXIN_TABLE.map((i) => raw[i]).join("").slice(0, 32), at: Date.now() };
  return session;
};

const signedQuery = (params: Record<string, string | number>, mixinKey: string) => {
  const all: Record<string, string | number> = { ...params, wts: Math.round(Date.now() / 1000) };
  const query = Object.keys(all)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(all[k]).replace(/[!'()*]/g, ""))}`)
    .join("&");
  return `${query}&w_rid=${crypto.createHash("md5").update(query + mixinKey).digest("hex")}`;
};

const callWbi = <T>(endpoint: string, params: Record<string, string | number>, referer: string) =>
  throttled(async () => {
    const s = await getSession();
    const response = await fetch(`https://api.bilibili.com${endpoint}?${signedQuery(params, s.mixinKey)}`, {
      headers: { "User-Agent": UA, Referer: referer, Cookie: s.cookie, Accept: "application/json" },
    });
    try {
      return await readApi<T>(response);
    } catch (error) {
      // Phiên cũ có thể bị đánh dấu — lần sau lấy cookie mới.
      session = null;
      throw error;
    }
  });

// ---------- tìm kiếm ----------

export const BILI_ORDERS = ["totalrank", "click", "pubdate", "stow"] as const;
export type BiliOrder = (typeof BILI_ORDERS)[number];

export type BiliResult = {
  bvid: string;
  title: string;
  author: string;
  mid: number;
  cover: string;
  /** Giây. */
  duration: number;
  plays: number;
  pubdate: number;
  permission: Permission;
};

type RawSearchItem = {
  type: string;
  bvid: string;
  title: string;
  author: string;
  mid: number;
  pic: string;
  duration: string;
  play: number;
  pubdate: number;
  description: string;
  is_pay?: number;
  is_charge_video?: number;
};

/** "32:57" / "1:05:03" → giây. */
const parseDuration = (text: string) =>
  text.split(":").reduce((total, part) => total * 60 + (Number(part) || 0), 0);

const httpsUrl = (url: string) => (url.startsWith("//") ? `https:${url}` : url.replace(/^http:/, "https:"));

export const searchBilibili = async (keyword: string, page = 1, order: BiliOrder = "totalrank") => {
  const query = keyword.trim().slice(0, 100);
  if (!query) throw new Error("Nhập từ khoá cần tìm.");
  const data = await callWbi<{ numPages?: number; numResults?: number; result?: RawSearchItem[] }>(
    "/x/web-interface/wbi/search/type",
    { search_type: "video", keyword: query, page: Math.max(1, Math.min(50, Math.round(page))), order },
    "https://search.bilibili.com/all",
  );
  const raw = (data.result ?? []).filter((item) => item.type === "video" && !item.is_pay && !item.is_charge_video);
  const results: BiliResult[] = [];
  for (const item of raw) {
    const title = stripHtml(item.title);
    const permission = findPermission(title, stripHtml(item.description ?? ""));
    if (!permission) continue;
    results.push({
      bvid: item.bvid,
      title,
      author: item.author,
      mid: item.mid,
      cover: httpsUrl(item.pic),
      duration: parseDuration(item.duration),
      plays: item.play,
      pubdate: item.pubdate,
      permission,
    });
  }
  return { results, scanned: raw.length, page, pages: data.numPages ?? 1 };
};

/** Có chữ Hán → coi như người dùng đã gõ từ khoá tiếng Trung. */
const hasHan = (text: string) => /[\u4e00-\u9fff]/.test(text);

export type ChineseKeywords = {
  /** Chủ đề tiếng Trung giản thể để tìm, ví dụ "海豚" hay "越南河粉 制作". */
  keywords: string;
  /** Từ bắt buộc có trong tiêu đề/mô tả để coi là đúng chủ đề (danh từ chính + từ đồng nghĩa). */
  terms: string[];
  /** Nhóm rộng hơn khi không có clip đúng chủ đề, ví dụ 海豚 → 海洋. Rỗng nếu không có nhóm hợp. */
  broader: string[];
};

const TRANSLATE_SYSTEM = `Bạn giúp tìm video tư liệu (b-roll) trên Bilibili. Người dùng gõ CHỦ ĐỀ bằng tiếng Việt (có khi tiếng Anh).
Dịch sang tiếng Trung giản thể đúng nghĩa, kiểu người Trung Quốc gõ vào ô tìm kiếm.

Luật:
- "keywords": 1-4 từ, cách nhau bằng dấu cách, chỉ nội dung hình ảnh (con vật, cảnh, món ăn, hoạt động). Không thêm 素材/可商用/免费.
- "terms": 1-4 từ tiếng Trung NGẮN mà một video đúng chủ đề chắc chắn có trong tiêu đề: danh từ chính và từ đồng nghĩa phổ biến.
- "broader": 1-2 từ tiếng Trung cho bối cảnh/nhóm rộng hơn, dùng khi không có clip đúng chủ đề (cá heo → 海洋; mèo con → 宠物).
- Dịch đúng loài/vật cụ thể, không đổi sang thứ gần giống. Tên riêng Việt Nam giữ đúng cách Trung Quốc gọi.

Ví dụ:
"cá heo" → {"keywords":"海豚","terms":["海豚"],"broader":["海洋"]}
"phong cảnh thiên nhiên" → {"keywords":"自然风光","terms":["自然","风光","风景"],"broader":[]}
"nấu phở bò" → {"keywords":"越南河粉 制作","terms":["河粉","米粉"],"broader":["美食","烹饪"]}
"thành phố về đêm" → {"keywords":"城市夜景","terms":["夜景","城市"],"broader":["城市"]}
"mèo con" → {"keywords":"小猫","terms":["猫"],"broader":["宠物"]}

Chỉ trả về MỘT object JSON: {"keywords":"...","terms":["..."],"broader":["..."]}`;

const keywordCache = new Map<string, ChineseKeywords>();

/** Nhà cung cấp dự phòng khi cái đang chọn lỗi — việc nhẹ, gói miễn phí trước. */
const FALLBACK_PROVIDERS: ProviderChoice[] = ["gemini", "groq", "openrouter", "openai", "anthropic"];

/** Chủ đề tiếng Việt → từ khoá + từ chủ đề tiếng Trung: tìm bằng tiếng Việt trên Bilibili gần như không ra gì. */
export const toChineseKeywords = async (text: string, provider: ProviderChoice = "auto"): Promise<ChineseKeywords> => {
  const input = text.trim().slice(0, 200);
  if (!input) throw new Error("Nhập chủ đề cần tìm.");
  const cached = keywordCache.get(input.toLowerCase());
  if (cached) return cached;

  const ask = (choice: ProviderChoice) => askJson(
    choice,
    {
      system: TRANSLATE_SYSTEM,
      user: input,
      temperature: 0.1,
      maxTokens: 150,
      schema: {
        type: "object",
        properties: {
          keywords: { type: "string" },
          terms: { type: "array", items: { type: "string" } },
          broader: { type: "array", items: { type: "string" } },
        },
        required: ["keywords", "terms", "broader"],
      },
    },
    (reply) => {
      const body = parseJson<{ keywords?: unknown; terms?: unknown; broader?: unknown }>(reply);
      const keywords = String(body.keywords ?? "").trim().slice(0, 60);
      if (!hasHan(keywords)) throw new Error(`${reply.who} không dịch ra tiếng Trung.`);
      const terms = (Array.isArray(body.terms) ? body.terms : [])
        .map((t) => String(t).trim())
        .filter((t) => hasHan(t) && t.length <= 8)
        .slice(0, 4);
      const broader = (Array.isArray(body.broader) ? body.broader : [])
        .map((t) => String(t).trim())
        .filter((t) => hasHan(t) && t.length <= 8 && !terms.includes(t))
        .slice(0, 2);
      return { keywords, terms: terms.length ? terms : keywords.split(/\s+/).filter(hasHan), broader };
    },
    "Chưa có AI để dịch chủ đề — điền key trong Cài đặt (Gemini, Groq có gói miễn phí), hoặc tự gõ từ khoá tiếng Trung.",
  );

  const failures: string[] = [];
  for (const choice of [provider, ...FALLBACK_PROVIDERS.filter((p) => p !== provider)]) {
    try {
      const { value } = await ask(choice);
      keywordCache.set(input.toLowerCase(), value);
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (choice === provider || !/Chưa có key|Chưa có AI/.test(message)) failures.push(message);
    }
  }
  throw new Error(failures.join(" · "));
};

/**
 * Tìm theo chủ đề: video tác giả cho phép dùng gần như không bao giờ lọt vào kết quả của từ khoá trần ("海豚": 0/20 —
 * đo 2026-09-17), còn ghép thêm chữ mà kênh tư liệu hay ghi thì ra nhiều ("海豚 空镜 素材", "自然风光 素材 可商用": 13/20).
 * Nên tìm vài biến thể rồi gộp, bỏ trùng, bỏ video lạc đề (tiêu đề/mô tả không có từ chủ đề) và tuyển tập nhạc nền.
 */
const TOPIC_VARIANTS = ["素材 可商用", "空镜 素材", "无版权素材"];
/** Video chỉ có nhạc/âm thanh (tìm "海豚 无版权素材" ra cả tuyển tập BGM) — mục này cần hình. */
const AUDIO_ONLY = /BGM|背景音乐|纯音乐|音乐|音效|配乐|歌曲|歌单|无损|伴奏|铃声/i;
/** Người dùng tự gõ kiểu từ khoá tư liệu thì tìm nguyên văn, không ghép thêm. */
const ALREADY_STOCK = /素材|商用|版权|CC0|二创|空镜/i;

export const searchBilibiliTopic = async (text: string, page = 1, order: BiliOrder = "totalrank", provider: ProviderChoice = "auto") => {
  const input = text.trim().slice(0, 100);
  if (!input) throw new Error("Nhập chủ đề cần tìm.");
  const translated = hasHan(input) ? null : await toChineseKeywords(input, provider);
  const keywords = translated?.keywords ?? input;
  const terms = translated?.terms ?? [];
  const queries = ALREADY_STOCK.test(keywords) ? [keywords] : TOPIC_VARIANTS.map((v) => `${keywords} ${v}`);

  const seen = new Set<string>();
  const broader = translated?.broader ?? [];
  let scanned = 0;
  let pages = 1;
  let offTopic = 0;
  const errors: string[] = [];

  /** Chạy các truy vấn, giữ video không trùng, không phải tuyển tập nhạc, có ít nhất một từ trong `words`. */
  const collect = async (list: string[], words: string[]) => {
    const kept: BiliResult[] = [];
    for (const query of list) {
      try {
        const found = await searchBilibili(query, page, order);
        scanned += found.scanned;
        pages = Math.max(pages, found.pages);
        for (const item of found.results) {
          if (seen.has(item.bvid)) continue;
          seen.add(item.bvid);
          const onTopic = !words.length || words.some((t) => item.title.includes(t) || item.permission.quote.includes(t));
          if (AUDIO_ONLY.test(item.title) || !onTopic) {
            offTopic++;
            continue;
          }
          kept.push(item);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return kept;
  };

  let results = await collect(queries, terms);
  // Không có clip đúng chủ đề (clip cá heo cho phép dùng rất hiếm): tìm thêm theo bối cảnh rộng hơn (海洋 = biển),
  // đánh dấu `relaxed` để giao diện nói rõ đây là tư liệu gần chủ đề.
  let relaxed = false;
  if (results.length === 0 && broader.length) {
    results = await collect(TOPIC_VARIANTS.map((v) => `${broader[0]} ${v}`), broader);
    relaxed = results.length > 0;
  }
  if (results.length === 0 && errors.length > 0 && scanned === 0) throw new Error(errors[0]);
  return { results, relaxed, scanned, page, pages, keywords, terms, broader, queries, offTopic };
};

// ---------- chi tiết + kiểm tra quyền ----------

export type BiliPart = { page: number; cid: number; title: string; duration: number };

export type BiliDetail = {
  bvid: string;
  title: string;
  author: string;
  mid: number;
  cover: string;
  desc: string;
  pubdate: number;
  url: string;
  height: number;
  parts: BiliPart[];
  /** null = không được dùng; `reason` giải thích vì sao. */
  permission: Permission | null;
  reason: string | null;
  /** Tác giả bật "未经作者授权禁止转载" (Bilibili bật sẵn khi đăng video tự làm). */
  noReprintFlag: boolean;
};

type RawView = {
  bvid: string;
  title: string;
  desc: string;
  desc_v2?: { raw_text: string }[] | null;
  pic: string;
  pubdate: number;
  copyright: number;
  owner: { mid: number; name: string };
  dimension?: { height: number; width: number; rotate: number };
  rights?: { no_reprint?: number; pay?: number; ugc_pay?: number; arc_pay?: number };
  is_upower_exclusive?: boolean;
  pages: { page: number; cid: number; part: string; duration: number }[];
};

export const isBvid = (value: unknown): value is string => typeof value === "string" && /^BV[0-9A-Za-z]{10}$/.test(value);

const DETAIL_TTL_MS = 10 * 60_000;
const detailCache = new Map<string, { at: number; detail: BiliDetail }>();

/** `fresh`: bỏ qua bộ nhớ đệm — dùng ngay trước khi tải, phòng tác giả vừa sửa mô tả. */
export const bilibiliDetail = async (bvid: string, fresh = false): Promise<BiliDetail> => {
  if (!isBvid(bvid)) throw new Error("Mã video Bilibili không hợp lệ.");
  const cached = detailCache.get(bvid);
  if (!fresh && cached && Date.now() - cached.at < DETAIL_TTL_MS) return cached.detail;
  const v = await callWbi<RawView>("/x/web-interface/wbi/view", { bvid }, `https://www.bilibili.com/video/${bvid}`);
  const desc = [v.desc, ...(v.desc_v2 ?? []).map((d) => d.raw_text)].filter(Boolean).join("\n");

  let reason: string | null = null;
  let permission: Permission | null = null;
  if (v.copyright !== 1) {
    reason = "Video được đánh dấu là đăng lại (转载) — người đăng không phải chủ nội dung nên không cho phép thay được.";
  } else if (v.rights?.pay || v.rights?.ugc_pay || v.rights?.arc_pay || v.is_upower_exclusive) {
    reason = "Video trả phí hoặc dành riêng cho hội viên.";
  } else {
    permission = findPermission(v.title, desc);
    if (!permission) reason = "Không tìm thấy lời cho phép rõ ràng của tác giả, hoặc mô tả có câu cấm dùng.";
  }

  const height = v.dimension ? (v.dimension.rotate ? v.dimension.width : v.dimension.height) : 0;
  const detail: BiliDetail = {
    bvid: v.bvid,
    title: v.title,
    author: v.owner.name,
    mid: v.owner.mid,
    cover: httpsUrl(v.pic),
    desc,
    pubdate: v.pubdate,
    url: `https://www.bilibili.com/video/${v.bvid}`,
    height,
    parts: v.pages.map((p) => ({ page: p.page, cid: p.cid, title: p.part, duration: p.duration })),
    permission,
    reason,
    noReprintFlag: v.rights?.no_reprint === 1,
  };
  detailCache.set(bvid, { at: Date.now(), detail });
  return detail;
};

// ---------- yt-dlp ----------

const PLATFORM_DIR = `${process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux"}-${process.arch}`;
const EXE = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

/** Bản đã cập nhật trong data/ (ghi được) → bản đóng gói trong app → yt-dlp trên máy. */
const ytDlpCandidates = () => [
  path.join(process.cwd(), "data", "bin", EXE),
  path.join(process.env.LOCAL_AI_DIR || path.join(process.cwd(), "vendor"), "yt-dlp", PLATFORM_DIR, EXE),
];

export const ytDlpPath = () => ytDlpCandidates().find((p) => fs.existsSync(p)) ?? "yt-dlp";

export const runTool = (bin: string, args: string[], onLine: (line: string) => void) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const tail: string[] = [];
    const read = (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/[\r\n]+/)) {
        if (!line.trim()) continue;
        tail.push(line);
        if (tail.length > 12) tail.shift();
        onLine(line);
      }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(error.code === "ENOENT" ? new Error("Thiếu yt-dlp — bản cài đặt bị thiếu file, hoặc chạy từ mã nguồn thì cài bằng \"brew install yt-dlp\".") : error),
    );
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(tail.filter((l) => /error/i.test(l)).join("\n") || tail.join("\n"))),
    );
  });

/** yt-dlp phải theo kịp khi Bilibili đổi API — chép bản đóng gói ra data/bin (ghi được) rồi tự cập nhật. */
export const updateYtDlp = async (log: (line: string) => void) => {
  const target = ytDlpCandidates()[0];
  if (!fs.existsSync(target)) {
    const bundled = ytDlpCandidates().slice(1).find((p) => fs.existsSync(p));
    if (!bundled) {
      await runTool("yt-dlp", ["-U"], log);
      return { version: await ytDlpVersion() };
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(bundled, target);
    fs.chmodSync(target, 0o755);
  }
  await runTool(target, ["-U"], log);
  return { version: await ytDlpVersion() };
};

export const ytDlpVersion = async () => {
  let version = "";
  try {
    await runTool(ytDlpPath(), ["--version"], (line) => (version = line.trim()));
  } catch {
    return null;
  }
  return version || null;
};

/**
 * Tải một video (hoặc một đoạn) bằng yt-dlp về `dir/base.mp4`; có sẵn thì dùng lại. Ưu tiên H.264 ≤ `height`,
 * tự thử lại khi mạng chập chờn, báo tiến độ qua `log`. Dùng chung cho Bilibili và "Lấy video từ link".
 */
export const ytDlpDownload = async (input: {
  url: string;
  dir: string;
  base: string;
  height: number;
  /** Giây, null = từ đầu / tới hết. */
  start: number | null;
  end: number | null;
  /** Độ dài cả video (giây) — mốc cuối khi chỉ cắt từ `start`. */
  duration: number;
  /** "cả video", "đoạn 0:10–0:40"… cho dòng tiến độ. */
  what: string;
  /** Tên trang cho lời báo lỗi mạng. */
  site: string;
  log: (line: string) => void;
}) => {
  const { url, dir, base, height, start, end, duration, what, site, log } = input;
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${base}.mp4`);
  if (fs.existsSync(target)) {
    log("Đoạn này đã tải trước đó — dùng lại.");
    return target;
  }
  log(`Đang tải ${what} (tối đa ${height}p)…`);
  const args = [
    "--no-playlist", "--newline", "--no-warnings", "--no-part",
    // Mạng từ Việt Nam tới Bilibili hay chập chờn ("Read timed out" khi đọc trang video — gặp 2026-09-17):
    // chờ lâu hơn mặc định 20 giây và tự thử lại, có nghỉ tăng dần giữa các lần.
    "--socket-timeout", "45", "--retries", "10", "--fragment-retries", "10", "--extractor-retries", "5",
    "--retry-sleep", "exp=1:15",
    // Ưu tiên H.264: trình duyệt và Remotion đọc chắc chắn; HEVC/AV1 dễ lỗi khi xem trước/render.
    "-f", `bv*[vcodec^=avc][height<=${height}]+ba/bv*[height<=${height}]+ba/b`,
    "--merge-output-format", "mp4",
    "--progress-template", "download:TIẾN ĐỘ %(progress._percent_str)s",
    "-o", path.join(dir, `${base}.download.%(ext)s`),
  ];
  if (start !== null || end !== null) {
    args.push("--download-sections", `*${start ?? 0}-${end ?? duration}`, "--force-keyframes-at-cuts");
  }
  args.push(url);

  let lastPercent = "";
  // Tải một đoạn thì ffmpeg làm việc, yt-dlp không báo phần trăm — báo thời gian để người dùng biết vẫn đang chạy.
  const began = Date.now();
  const heartbeat = setInterval(() => {
    if (!lastPercent) log(`Đang tải và cắt đoạn… ${Math.round((Date.now() - began) / 1000)} giây (thường dưới 1 phút)`);
  }, 5000);
  const onLine = (line: string) => {
    const percent = /TIẾN ĐỘ\s+([\d.]+%)/.exec(line)?.[1];
    if (percent && percent !== lastPercent) {
      lastPercent = percent;
      log(`Đang tải… ${percent}`);
    } else if (/^\[(Merger|FixupM3u8|VideoConvertor|ModifyChapters)\]/.test(line)) {
      log("Đang ghép hình và tiếng…");
    }
  };
  const clearPartial = () => {
    for (const f of fs.readdirSync(dir)) if (f.startsWith(`${base}.download.`)) fs.rmSync(path.join(dir, f), { force: true });
  };
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await runTool(ytDlpPath(), args, onLine);
        break;
      } catch (error) {
        // Lỗi mạng sau khi yt-dlp đã tự thử lại: chạy lại cả lượt một lần nữa trước khi báo lỗi.
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= 2 || !/timed out|timeout|Connection|reset|Temporary failure|HTTP Error 5\d\d/i.test(message)) throw error;
        clearPartial();
        lastPercent = "";
        log(`Mạng tới ${site} chập chờn — thử tải lại…`);
      }
    }
  } catch (error) {
    clearPartial();
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out|timeout|Connection|reset|Temporary failure/i.test(message)) {
      throw new Error(`Không kết nối ổn định được tới ${site} (hết thời gian chờ) — kiểm tra mạng rồi bấm tải lại.`);
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
  const produced = fs.readdirSync(dir).find((f) => f.startsWith(`${base}.download.`));
  if (!produced) throw new Error("yt-dlp chạy xong nhưng không thấy file video.");
  fs.renameSync(path.join(dir, produced), target);
  return target;
};

export type BiliDownload = {
  bvid: string;
  part: number;
  /** Giây, null = từ đầu / tới hết. */
  start: number | null;
  end: number | null;
  maxHeight: 720 | 1080;
  /** Người dùng xác nhận đã đọc lời cho phép của tác giả. */
  confirmed: boolean;
};

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Kiểm tra lại quyền ngay trước khi tải, rồi lưu clip + bằng chứng vào public/uploads/bilibili/. */
export const downloadBilibili = async (input: BiliDownload, log: (line: string) => void) => {
  if (!input.confirmed) throw new Error("Cần xác nhận đã đọc lời cho phép của tác giả.");
  log("Kiểm tra lại quyền sử dụng…");
  const detail = await bilibiliDetail(input.bvid, true);
  if (!detail.permission) throw new Error(`Không tải: ${detail.reason}`);

  const part = detail.parts.find((p) => p.page === input.part);
  if (!part) throw new Error("Không có phần video này.");
  const start = input.start !== null && input.start > 0 ? Math.min(input.start, part.duration) : null;
  const end = input.end !== null && input.end < part.duration ? input.end : null;
  if (start !== null && end !== null && end - start < 1) throw new Error("Đoạn cần tải phải dài ít nhất 1 giây.");
  const height = input.maxHeight === 720 ? 720 : 1080;

  const range = start !== null || end !== null ? `-${Math.round(start ?? 0)}-${Math.round(end ?? part.duration)}` : "";
  const base = `${detail.bvid}-p${part.page}${range}`;
  const dir = path.join(process.cwd(), "public", "uploads", "bilibili");
  const what = `${detail.parts.length > 1 ? `P${part.page} ` : ""}${start !== null || end !== null ? `đoạn ${clock(start ?? 0)}–${clock(end ?? part.duration)}` : "cả video"}`;
  await ytDlpDownload({
    url: `${detail.url}?p=${part.page}`, dir, base, height, start, end, duration: part.duration, what, site: "Bilibili", log,
  });

  const credit = `Tư liệu: ${detail.author} — Bilibili (${detail.url})`;
  const evidence = {
    source: "bilibili",
    url: `${detail.url}?p=${part.page}`,
    bvid: detail.bvid,
    title: detail.title,
    part: { page: part.page, title: part.title },
    author: { name: detail.author, mid: detail.mid, url: `https://space.bilibili.com/${detail.mid}` },
    range: { start: start ?? 0, end: end ?? part.duration },
    permission: detail.permission,
    noReprintFlag: detail.noReprintFlag,
    /** Mô tả đúng lúc tải — tác giả sửa mô tả về sau thì vẫn còn bằng chứng. */
    descriptionSnapshot: detail.desc,
    confirmedByUserAt: new Date().toISOString(),
    credit,
  };
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(evidence, null, 2));
  log("Xong.");
  return { path: `uploads/bilibili/${base}.mp4`, credit };
};
