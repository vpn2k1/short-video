/**
 * Dữ liệu và công cụ của phong cách "Livestream bán hàng": font, màu, đo chữ, đọc giá trong câu nhấn,
 * đếm người xem, sinh bình luận. Không dùng API vẽ — chỉ hàm thuần, cùng đầu vào cùng kết quả.
 * Mọi "ngẫu nhiên" đi qua seeded() để render song song không lệch nhau.
 */
import { Easing } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { FONT_CATALOG } from "../../fonts/catalog";
import { seeded, useLayout } from "../shared";
import type { VideoLanguage } from "../../i18n/video";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const POP = Easing.spring({ damping: 12, stiffness: 170 });
export const SLAM = Easing.spring({ damping: 9, stiffness: 220 });
export const SMOOTH = Easing.bezier(0.2, 0.8, 0.2, 1);

/** "image" của cảnh có thể là video người dùng tải lên. */
export const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Be Vietnam Pro — chữ giao diện app, đủ dấu, có 500–900. Dùng cho gần như mọi chữ. */
export const UI = FONT_CATALOG.bevietnam.stack;
/** Montserrat 900 — số giá tiền, đồng hồ đếm ngược, số đếm lùi 3-2-1. */
export const NUM = FONT_CATALOG.montserrat.stack;
export const LIVE_FONTS = ["bevietnam", "montserrat"];

/** Đỏ "LIVE" và đỏ giá sale — cố định, không theo accent, để khoảnh khắc sale luôn nóng. */
export const LIVE_RED = "#FE2C55";
export const SALE_RED = "#FF1F44";
export const SALE_ORANGE = "#FF6A13";
export const GOLD = "#FFD84A";
export const INK = "#17161c";

export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/* ------------------------------------------------------------ màu */

const rgbOf = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

/** Độ sáng tương đối — chọn chữ trắng hay đen trên nền accent. */
export const luminance = (hex: string) => {
  const rgb = rgbOf(hex);
  if (!rgb) return 0.3;
  const [r, g, b] = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const inkOn = (hex: string) => (luminance(hex) > 0.42 ? INK : "#ffffff");

/** Màu hex với độ trong suốt. */
export const alpha = (hex: string, a: number) => {
  const rgb = rgbOf(hex);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : hex;
};

/** Pha màu với đen (amount < 0) hoặc trắng (amount > 0). */
export const shade = (hex: string, amount: number) => {
  const rgb = rgbOf(hex);
  if (!rgb) return hex;
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  return `#${rgb.map((c) => Math.round(c + (target - c) * k).toString(16).padStart(2, "0")).join("")}`;
};

/* ------------------------------------------------------------ đo chữ */

let canvas: HTMLCanvasElement | null = null;
const widthCache = new Map<string, number>();

/** Bề rộng (px) của chữ — đo bằng canvas; `ready` nằm trong khoá để đo lại khi font thật về. */
export const measure = (text: string, size: number, font: string, weight: number, ready: boolean) => {
  if (!text) return 0;
  const key = `${ready ? 1 : 0}|${font}|${weight}|${size.toFixed(2)}|${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  let width = [...text].length * size * 0.56;
  if (typeof document !== "undefined") {
    canvas ??= document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = `${weight} ${size}px ${font}`;
      width = ctx.measureText(text).width;
    }
  }
  widthCache.set(key, width);
  return width;
};

/** Số dòng khi ngắt theo từ cho vừa `maxWidth`. */
export const lineCount = (text: string, size: number, maxWidth: number, font: string, weight: number, ready: boolean) => {
  const words = text.normalize("NFC").split(/\s+/).filter(Boolean);
  let lines = 0;
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next, size, font, weight, ready) > maxWidth) {
      lines += 1;
      current = word;
    } else {
      current = next;
    }
  }
  return lines + (current ? 1 : 0);
};

/** Cỡ lớn nhất (≤ base) để chữ nằm gọn trong `maxLines` dòng; không co dưới `min`. */
export const fitLines = (
  text: string, base: number, min: number, maxWidth: number, maxLines: number, font: string, weight: number, ready: boolean,
) => {
  let size = base;
  while (size > min && lineCount(text, size, maxWidth, font, weight, ready) > maxLines) size *= 0.94;
  size = Math.max(min, size);
  return { size, lines: lineCount(text, size, maxWidth, font, weight, ready) };
};

/** Cụm nhấn nằm ở đâu trong câu (vị trí trong chuỗi NFC), hoặc null nếu không có nguyên văn. */
export const punchSpan = (text: string, punch: string): [number, number] | null => {
  const hay = text.normalize("NFC");
  const needle = punch.normalize("NFC").trim();
  if (!needle) return null;
  const at = hay.toLowerCase().indexOf(needle.toLowerCase());
  return at < 0 ? null : [at, at + needle.length];
};

/* ------------------------------------------------------------ số đếm */

/** 12400 → "12,4K", 1250000 → "1,3Tr" — kiểu đếm của app, dấu phẩy thập phân. */
export const formatCount = (n: number, language?: VideoLanguage) => {
  const en = language === "en";
  const v = Math.max(0, Math.floor(n));
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = Math.floor(v / 100) / 10;
    return `${k >= 100 ? Math.floor(k) : en ? String(k) : String(k).replace(".", ",")}K`;
  }
  const m = Math.floor(v / 100_000) / 10;
  return en ? `${m}M` : `${String(m).replace(".", ",")}Tr`;
};

/**
 * Số người xem lúc bắt đầu live — ngẫu nhiên theo từng video (theo tiêu đề, nên render lại vẫn y nguyên):
 * phần đông phiên nhỏ vài trăm tới vài nghìn, ít phiên đông vài chục nghìn.
 */
export const viewerStart = (key: string) => {
  const tier = seeded(`${key}-vtier`);
  const [min, max] = tier < 0.35 ? [240, 1900] : tier < 0.82 ? [2000, 12_000] : [12_000, 46_000];
  return Math.round(seeded(`${key}-v0`, min, max));
};

/** Một bước đếm người xem (frame) — số đổi đủ nhanh để thấy đang tăng, không nhảy từng frame gây rối mắt. */
const VIEWER_STEP = 6;

/**
 * Người xem tăng dần không đều như live thật: mỗi bước thêm vài người (phiên càng đông thêm càng nhiều), thỉnh
 * thoảng một đợt vào dồn; 3 giây sau câu nhấn (flash sale) tăng gấp ba. Luôn tăng, không nhảy lùi.
 */
export const viewersAt = (frame: number, key: string, bursts: number[] = []) => {
  const start = viewerStart(key);
  const scale = Math.max(1, start / 900);
  const steps = Math.floor(Math.max(0, frame) / VIEWER_STEP);
  let n = start;
  for (let i = 1; i <= steps; i++) {
    const r = seeded(`${key}-vs-${i}`);
    let add = r * r * 4 * scale;
    if (seeded(`${key}-vw-${i}`) < 0.05) add += seeded(`${key}-vx-${i}`, 6, 22) * scale;
    const at = i * VIEWER_STEP;
    if (bursts.some((b) => at >= b && at < b + 90)) add *= 3;
    n += add;
  }
  return Math.round(n);
};

/** Số người xem hiện đủ chữ số tới 99.999 ("12.483") để thấy nhảy từng người; lớn hơn thì rút gọn như formatCount. */
export const formatViewers = (n: number, language?: VideoLanguage) =>
  n < 100_000
    ? String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, language === "en" ? "," : ".")
    : formatCount(n, language);

/* ------------------------------------------------------------ giá */

export type Price = { now: number; old: number; discount: number };

const NUMBER = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu|đ|₫|vnđ|vnd)?(?![\p{L}\d])/giu;

/**
 * Đọc giá trong câu nhấn: "chỉ 199k", "199.000đ", "từ 399k còn 199k", "1,5 triệu", "giảm 30% còn 350k".
 * Chỉ tính là giá khi có đơn vị hoặc có dấu tách hàng nghìn. Không có giá → null (câu nhấn thành chữ lớn).
 */
export const parsePrice = (text: string): Price | null => {
  const src = text.normalize("NFC");
  const prices: number[] = [];
  for (const m of src.matchAll(NUMBER)) {
    const raw = m[1];
    const unit = (m[2] ?? "").toLowerCase();
    const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw);
    if (!unit && !grouped) continue;
    const value = grouped ? Number(raw.replace(/[.,]/g, "")) : Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) continue;
    const mul = unit === "k" || unit === "nghìn" || unit === "ngàn" ? 1000 : unit === "tr" || unit === "triệu" ? 1_000_000 : 1;
    const vnd = Math.round(value * mul);
    if (vnd >= 1000) prices.push(vnd);
  }
  if (!prices.length) return null;
  const now = prices[prices.length - 1];
  const pct = /(\d{1,2})\s*%/.exec(src);
  let old = prices.length > 1 && prices[0] > now ? prices[0] : 0;
  if (!old) {
    const d = pct ? Number(pct[1]) / 100 : 0.5;
    old = Math.round(now / (1 - Math.min(0.9, Math.max(0.05, d))) / 1000) * 1000;
  }
  return { now, old, discount: Math.max(1, Math.round((1 - now / old) * 100)) };
};

/** 199000 → "199.000đ". */
export const formatVnd = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;

/* ------------------------------------------------------------ người dẫn */

/* ------------------------------------------------------------ bình luận */

export type ChatKind = "chat" | "join" | "buy";
export type ChatLine = { at: number; name: string; text: string; kind: ChatKind; hue: number };

const NAMES = [
  "Linh", "Tuấn", "Hương", "Minh Anh", "Thảo", "Nam", "Vy", "Quân", "Trang", "Phúc", "Ngọc Hân", "Hải",
  "Mai", "Dũng", "Hà My", "Khoa", "Yến", "Long", "Nhi", "Bảo", "Mẹ Bắp", "Thu Hà", "Đức", "Tâm",
];

const GENERIC = [
  "Hàng đẹp quá shop ơi", "Shop cho xem gần hơn với", "Mới vào, đang bán gì vậy shop?", "Có freeship không shop?",
  "Ship về Đà Nẵng mấy ngày ạ?", "Chất lượng ổn không shop?", "Mua lần trước rồi, xài ok lắm", "Có màu khác không ạ?",
  "Shop nói dễ thương quá", "Cho mình xin link với", "Hóng deal nãy giờ", "Có đổi trả không shop?", "Đẹp thật sự luôn",
  "Để dành 1 cái nha shop", "Giá bao nhiêu shop?", "Xem lại cái lúc nãy đi shop", "Có bảo hành không ạ?", "Shop uy tín lắm",
];

const BURST = [
  "Chốt đơn!", "Chốt 2 cái!", "Mua ngay!", "Lên đơn rồi nha", "Chốt 1 nha shop", "Kịp không shop ơi", "Đặt được rồi!",
  "Rẻ quá trời", "Chốt chốt chốt", "Còn không shop?",
];

/** Phản ứng theo nội dung lời người dẫn — người xem "nghe" và hỏi lại. */
const REACTIONS: [RegExp, string[]][] = [
  [/giá|bao nhiêu|\d+\s*(k|đ|nghìn|ngàn|triệu)/i, ["Giá bao nhiêu shop?", "Giá vậy rẻ quá!", "Giá tốt ghê"]],
  [/freeship|miễn phí|ship|giao/i, ["Freeship luôn hả shop?", "Giao nhanh không ạ?"]],
  [/tặng|quà|kèm/i, ["Có quà tặng thật hả?", "Quà xịn vậy"]],
  [/sale|giảm|flash|deal|ưu đãi|khuyến mãi/i, ["Chốt đơn!", "Đợi deal này mãi", "Săn sale thôi"]],
  [/size|màu|mẫu/i, ["Còn size L không shop?", "Màu đen còn không ạ?"]],
  [/chính hãng|auth|bảo hành|xịn|chất lượng/i, ["Có bảo hành không shop?", "Hàng chính hãng hả shop?"]],
  [/da|dưỡng|kem|son|serum/i, ["Da dầu dùng được không shop?", "Da nhạy cảm dùng ổn không ạ?"]],
  [/\?/, ["Muốn biết quá", "Có ạ!"]],
  [/còn|hết|số lượng|ít/i, ["Còn không shop ơi", "Để lại 1 cái nha"]],
];

const FALLBACK = ["Công nhận luôn", "Đúng rồi đó shop", "Nghe hợp lý ghê"];

/* Bộ bình luận cho video tiếng Anh — cùng vai trò với các bộ tiếng Việt ở trên. */
const NAMES_EN = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Mia", "Lucas", "Sophie", "Ethan", "Chloe", "Jake", "Lily",
  "Grace", "Ryan", "Zoe", "Mason", "Ella", "Leo", "Nora", "Ben", "Kate", "Sam", "Ruby", "Max",
];

const GENERIC_EN = [
  "Looks so good!", "Can you show it closer?", "Just joined, what are we selling?", "Is shipping free?",
  "How long does shipping take?", "Is the quality good?", "Bought it last time, love it", "Other colors?",
  "You're so fun to watch", "Link please!", "Been waiting for this deal", "Can I return it?", "Honestly gorgeous",
  "Save one for me!", "How much is it?", "Show the last one again?", "Any warranty?", "Love this shop",
];

const BURST_EN = [
  "Sold!", "I'll take 2!", "Buying now!", "Just ordered", "One for me please", "Am I in time?", "Got it!",
  "So cheap!", "Take my money", "Still in stock?",
];

const REACTIONS_EN: [RegExp, string[]][] = [
  [/price|how much|cost|\$\s*\d|\d+\s*(k|dollars?|bucks)\b/i, ["How much is it?", "That price is crazy!", "Great price"]],
  [/free shipping|shipping|ship|deliver/i, ["Free shipping too?", "Is delivery fast?"]],
  [/gift|free|bonus|bundle/i, ["A free gift, really?", "Nice gift"]],
  [/sale|off|flash|deal|discount|promo/i, ["Sold!", "Waited all day for this", "Sale time!"]],
  [/size|colou?r|style/i, ["Size L in stock?", "Is black still available?"]],
  [/authentic|genuine|warranty|original|quality/i, ["Does it have a warranty?", "Is it authentic?"]],
  [/skin|cream|serum|lipstick|moistur/i, ["Good for oily skin?", "Okay for sensitive skin?"]],
  [/\?/, ["Want to know too", "Yes!"]],
  [/left|stock|sold out|limited|only/i, ["Any left?", "Save one for me"]],
];

const FALLBACK_EN = ["So true", "Exactly!", "Makes sense"];

const CHAT_SETS = {
  vi: { names: NAMES, generic: GENERIC, burst: BURST, reactions: REACTIONS, fallback: FALLBACK, buy: "vừa đặt hàng", join: "đã tham gia" },
  en: { names: NAMES_EN, generic: GENERIC_EN, burst: BURST_EN, reactions: REACTIONS_EN, fallback: FALLBACK_EN, buy: "just ordered", join: "joined" },
};

/** Tên người xem theo ngôn ngữ video — hàng avatar người xem, dải quà tặng dùng chung với khung chat. */
export const viewerNames = (language: VideoLanguage = "vi") => CHAT_SETS[language].names;

/* ------------------------------------------------------------ quà tặng */

export type Gift = { emoji: string; name: string };

const GIFT_SETS: Record<VideoLanguage, { verb: string; gifts: Gift[] }> = {
  vi: {
    verb: "đã tặng",
    gifts: [
      { emoji: "🌹", name: "Hoa hồng" }, { emoji: "🍦", name: "Kem ốc quế" }, { emoji: "🎁", name: "Hộp quà" },
      { emoji: "💎", name: "Kim cương" }, { emoji: "🚀", name: "Tên lửa" }, { emoji: "🧸", name: "Gấu bông" },
      { emoji: "💖", name: "Trái tim" }, { emoji: "👑", name: "Vương miện" }, { emoji: "🍩", name: "Bánh donut" },
    ],
  },
  en: {
    verb: "sent",
    gifts: [
      { emoji: "🌹", name: "Rose" }, { emoji: "🍦", name: "Ice cream" }, { emoji: "🎁", name: "Gift box" },
      { emoji: "💎", name: "Diamond" }, { emoji: "🚀", name: "Rocket" }, { emoji: "🧸", name: "Teddy bear" },
      { emoji: "💖", name: "Heart" }, { emoji: "👑", name: "Crown" }, { emoji: "🍩", name: "Donut" },
    ],
  },
};

export type GiftEvent = { at: number; name: string; hue: number; gift: Gift; verb: string; combo: number };

/**
 * Lượt tặng quà của cả video: cứ 3,5–7 giây một lượt (sau câu nhấn dồn hơn), mỗi lượt một người tặng một món, số
 * combo 1–12 đếm dần lúc dải quà đang hiện. Tính một lần theo timeline tuyệt đối như buildChat.
 */
export const buildGifts = (
  scenes: Scene[],
  startFrame: number,
  endFrame: number,
  key: string,
  language: VideoLanguage = "vi",
): GiftEvent[] => {
  const { verb, gifts } = GIFT_SETS[language];
  const names = CHAT_SETS[language].names;
  const bursts = scenes.filter((s) => s.punch).map((s) => msToFrames(s.punch!.atMs));
  const out: GiftEvent[] = [];
  let t = startFrame + seeded(`${key}-g0`, 20, 60);
  for (let i = 0; t < endFrame && i < 400; i++) {
    const name = names[Math.floor(seeded(`${key}-gn-${i}`, 0, names.length))];
    const r = seeded(`${key}-gc-${i}`);
    out.push({
      at: Math.round(t),
      name,
      hue: Math.floor(seeded(`${key}-h-${name}`, 0, 360)),
      gift: gifts[Math.floor(seeded(`${key}-gg-${i}`, 0, gifts.length))],
      verb,
      combo: r < 0.45 ? 1 + Math.floor(r * 6) : 3 + Math.floor(r * 10),
    });
    const hot = bursts.some((b) => t >= b - 30 && t < b + 120);
    t += hot ? seeded(`${key}-gt-${i}`, 45, 80) : seeded(`${key}-gt-${i}`, 105, 210);
  }
  return out;
};

const reactionsFor = (text: string, set: (typeof CHAT_SETS)[VideoLanguage]) => {
  const out: string[] = [];
  for (const [re, list] of set.reactions) if (re.test(text)) out.push(...list);
  return out.length ? out : set.fallback;
};

/**
 * Dòng bình luận của cả video, tính một lần theo timeline tuyệt đối. Nhịp thường 16–30 frame một dòng;
 * ngay sau lời người dẫn thì người xem hỏi lại theo nội dung câu; 3 giây sau câu nhấn thì dồn dập "Chốt đơn!".
 * Vài dòng bắt đầu ở thời điểm âm để khung chat không trống khi vừa vào.
 */
export const buildChat = (
  captions: Caption[],
  scenes: Scene[],
  startFrame: number,
  endFrame: number,
  key: string,
  language: VideoLanguage = "vi",
): ChatLine[] => {
  const { names: NAMES, generic: GENERIC, burst: BURST, buy: BUY, join: JOIN } = CHAT_SETS[language];
  const bursts = scenes.filter((s) => s.punch).map((s) => msToFrames(s.punch!.atMs));
  const capStarts = captions.map((c) => ({ at: msToFrames(c.startMs), list: reactionsFor(c.text, CHAT_SETS[language]) }));
  const lines: ChatLine[] = [];
  let t = startFrame - 90;
  let i = 0;
  while (t < endFrame && i < 2000) {
    const burst = bursts.find((b) => t >= b && t < b + 90);
    const recent = capStarts.filter((c) => t >= c.at + 12 && t < c.at + 60).pop();
    const r = seeded(`${key}-c-${i}`);
    const nameIdx = Math.floor(seeded(`${key}-n-${i}`, 0, NAMES.length));
    const name = NAMES[nameIdx];
    const hue = Math.floor(seeded(`${key}-h-${name}`, 0, 360));
    let kind: ChatKind = "chat";
    let text: string;
    if (burst !== undefined) {
      if (r < 0.3) {
        kind = "buy";
        text = BUY;
      } else {
        text = BURST[Math.floor(seeded(`${key}-b-${i}`, 0, BURST.length))];
      }
    } else if (recent && r < 0.65) {
      text = recent.list[Math.floor(seeded(`${key}-r-${i}`, 0, recent.list.length))];
    } else if (r > 0.9) {
      kind = "join";
      text = JOIN;
    } else if (r > 0.84 && t > startFrame) {
      kind = "buy";
      text = BUY;
    } else {
      text = GENERIC[Math.floor(seeded(`${key}-g-${i}`, 0, GENERIC.length))];
    }
    // Không lặp y hệt dòng ngay trước.
    const prev = lines[lines.length - 1];
    if (prev && prev.text === text && prev.kind === kind) text = GENERIC[(i * 7) % GENERIC.length];
    lines.push({ at: Math.round(t), name, text, kind, hue });
    t += burst !== undefined ? seeded(`${key}-dt-${i}`, 6, 11) : seeded(`${key}-dt-${i}`, 16, 30);
    i += 1;
  }
  return lines;
};

/* ------------------------------------------------------------ bố cục */

/**
 * Bố cục theo tỉ lệ khung hình. Dọc: thanh chủ phòng trên trái, thẻ sản phẩm dưới nó, huy hiệu số liệu góc phải
 * trên, thanh hành động mép phải, chat + lời ghim của chủ phòng ở dưới. Ngang: chat thành cột trái phía dưới,
 * lời ghim đặt dưới cột chat, thẻ flash sale dời sang phải giữa.
 */
export const useGeo = () => {
  const L = useLayout();
  const { width, height, safe, unit: u } = L;
  const wide = width / height > 1.2;
  const square = !wide && height / width < 1.45;
  const side = wide ? Math.max(48 * u, safe.side * 0.6) : Math.max(40 * u, safe.side * 0.42);
  const top = wide ? Math.max(34 * u, safe.top * 0.75) : Math.max(36 * u, safe.top * 0.8);
  const bannerBottom = height - (wide ? safe.bottom * 0.75 : square ? safe.bottom * 0.5 : safe.bottom * 0.85);
  const bannerW = wide ? Math.min(1000 * u, width * 0.5) : width - side * 2;
  const railIcon = (wide ? 66 : square ? 60 : 76) * u;
  const railGap = (wide ? 118 : square ? 100 : 136) * u;
  const railRight = wide ? safe.side * 0.45 : Math.max(22 * u, safe.side * 0.22);
  // Dọc/vuông: thanh hành động đứng trên lời ghim; ngang: lời ghim chỉ chiếm nửa trái nên thanh xuống sát đáy.
  const railBottom = wide ? bannerBottom : bannerBottom - (square ? 212 : 270) * u;
  const topBarH = (wide ? 76 : 84) * u;
  return {
    ...L,
    u,
    wide,
    square,
    side,
    top,
    topBarH,
    /** Mép trên của hàng thẻ dưới thanh chủ phòng. */
    below: top + topBarH + (square ? 18 : 26) * u,
    bannerBottom,
    bannerW,
    bannerBase: (wide ? 38 : square ? 38 : 46) * u,
    bannerMin: (wide ? 28 : 30) * u,
    railIcon,
    railGap,
    railRight,
    railBottom,
    chatW: wide ? 560 * u : Math.min(700 * u, width - side - railRight - railIcon - 70 * u),
    chatRows: wide ? 6 : square ? 3 : 6,
    chatRowH: (wide ? 54 : square ? 54 : 62) * u,
    chatFont: (wide ? 27 : square ? 27 : 31) * u,
    /** Tâm thẻ flash sale. */
    saleCx: wide ? width * 0.6 : width / 2,
    saleCy: wide ? height * 0.43 : square ? height * 0.44 : height * 0.43,
    saleW: (wide ? 820 : square ? 700 : 820) * u,
  };
};

export type Geo = ReturnType<typeof useGeo>;
