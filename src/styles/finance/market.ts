/**
 * Dữ liệu "thị trường" giả của phong cách Biểu đồ tài chính — hàm thuần, không đụng API vẽ.
 *
 * Đường giá là bước ngẫu nhiên có seed (theo title) nên cùng props luôn ra cùng một biểu đồ. Xu hướng bám theo
 * câu chuyện: cảnh có câu nhấn / con số tăng thì đi lên, cảnh có từ "giảm, lỗ, sụt…" thì đi xuống, còn lại nhích
 * xuống nhẹ; đúng mốc câu nhấn có một cú vọt giá (rồi hồi lại một phần) để gắn bong bóng chú thích.
 */
import { random } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";

export const UP = "#16c784";
export const DOWN = "#ea3943";
export const BG = "#060a12";
export const PANEL = "rgba(10, 16, 28, 0.9)";
export const LINE = "rgba(130, 160, 210, 0.16)";
export const INK = "#e8eef8";
export const MUTED = "#7f8ca6";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** In hoa bằng JS theo tiếng Việt — không dùng CSS text-transform (móc Ư/Ơ dễ lệch). */
export const upper = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Bỏ dấu để làm mã chứng khoán giả: "Sai lầm" → "SAI LAM". */
export const plain = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

/** Từ báo hiệu chiều giảm — đổi màu đỏ, đường giá đi xuống. */
export const DOWN_WORDS = /(^|[^\p{L}])(giảm|lỗ|sụt|rớt|mất|âm|bán tháo|lao dốc|thua lỗ|đỏ sàn|bốc hơi|tụt)(?=$|[^\p{L}])/iu;

/** Từ báo hiệu chiều tăng — cảnh có chúng thì đường giá đi lên. */
export const UP_WORDS = /(^|[^\p{L}])(tăng|vượt|lãi|bứt phá|phục hồi|kỷ lục|đỉnh|mua ròng|tích cực|lợi nhuận|gấp)(?=$|[^\p{L}])/iu;

export const isDownText = (text: string | null | undefined) =>
  !!text && (DOWN_WORDS.test(text) || /^\s*[-−▼]/.test(text));

export type Mood = "up" | "down" | "flat";

/** Xu hướng của từng cảnh, suy từ câu nhấn, con số, nhãn và lời trong cảnh. */
export const sceneMoods = (scenes: Scene[], captions: Caption[]): Mood[] =>
  scenes.map((s) => {
    const start = s.startMs;
    const end = s.endMs;
    const words = captions.filter((c) => c.startMs >= start && c.startMs < end).map((c) => c.text).join(" ");
    const hot = [s.punch?.text, s.visual?.type === "stat" ? `${s.visual.text} ${s.visual.caption ?? ""}` : null, s.tag]
      .filter(Boolean)
      .join(" ");
    if (isDownText(hot)) return "down";
    if (s.punch || s.visual?.type === "stat") return "up";
    if (isDownText(words)) return "down";
    if (UP_WORDS.test(words)) return "up";
    return "flat";
  });

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Frame đỉnh cú vọt sau mốc câu nhấn. */
export const SPIKE_RISE = 8;

export type Series = {
  /** Giá trị % so với giá mở cửa, cách đều nhau theo thời gian. */
  values: number[];
  /** Frame ứng với mỗi điểm. */
  step: number;
  min: number;
  max: number;
  /** Giá mở cửa (đơn vị tiền giả). */
  base: number;
  volumes: number[];
};

export const buildSeries = (
  seed: string,
  scenes: Scene[],
  moods: Mood[],
  durationFrames: number,
  points: number,
): Series => {
  const n = Math.max(12, points);
  const step = Math.max(1, durationFrames - 1) / (n - 1);
  const sceneStart = scenes.map((s) => msToFrames(s.startMs));
  const moodAt = (f: number): Mood => {
    let m: Mood = "flat";
    for (let i = 0; i < scenes.length; i++) if (f >= sceneStart[i]) m = moods[i];
    return m;
  };
  const spikes = scenes
    .map((s, i) => (s.punch ? { at: msToFrames(s.punch.atMs), dir: moods[i] === "down" ? -1 : 1 } : null))
    .filter((x): x is { at: number; dir: number } => x !== null);
  const spikeAt = (f: number) =>
    spikes.reduce((sum, s) => sum + s.dir * 3.2 * (smooth(s.at, s.at + SPIKE_RISE, f) - 0.4 * smooth(s.at + SPIKE_RISE, s.at + 60, f)), 0);

  const phase = random(`${seed}-phase`) * 6;
  const walk: number[] = [0];
  for (let i = 1; i < n; i++) {
    const f = i * step;
    const mood = moodAt(f);
    const drift = mood === "up" ? 0.11 : mood === "down" ? -0.11 : -0.02;
    const noise = (random(`${seed}-n-${i}`) - 0.5) * 0.62 + Math.sin(i * 0.41 + phase) * 0.12;
    walk.push(walk[i - 1] + drift + noise);
  }
  const values = walk.map((w, i) => w + spikeAt(i * step));
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const pad = Math.max(0.6, (max - min) * 0.1);
  const volumes = values.map((v, i) => {
    const jump = i > 0 ? Math.abs(v - values[i - 1]) : 0;
    return 0.25 + random(`${seed}-v-${i}`) * 0.45 + Math.min(1, jump * 0.9);
  });
  return {
    values,
    step,
    min: min - pad,
    max: max + pad,
    base: Math.round((18 + random(`${seed}-base`) * 160) * 100) / 100,
    volumes,
  };
};

/** Giá trị nội suy tại frame bất kỳ. */
export const valueAt = (s: Series, frame: number) => {
  const x = Math.min(s.values.length - 1, Math.max(0, frame / s.step));
  const i = Math.floor(x);
  const j = Math.min(s.values.length - 1, i + 1);
  return s.values[i] + (s.values[j] - s.values[i]) * (x - i);
};

const VI2 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Giá kiểu Việt Nam: 1.285,43 */
export const fmtPrice = (n: number) => VI2.format(n);
export const priceOf = (s: Series, v: number) => s.base * (1 + v / 100);
export const fmtPct = (v: number) => `${v >= 0 ? "+" : "−"}${VI2.format(Math.abs(v))}%`;

/** Đồng hồ phiên: 09:15:00 cộng thời gian video. */
export const clockAt = (frame: number, fps: number) => {
  const total = 9 * 3600 + 15 * 60 + Math.floor(frame / fps);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return [hh, mm, ss].map((x) => String(x).padStart(2, "0")).join(":");
};

/** Mã chính của video: chữ cái đầu các từ trong title, 3–4 ký tự. */
export const symbolOf = (title: string) => {
  // Từ đầu đã giống mã ("VN-Index", "BTC", "S&P") thì dùng luôn.
  const first = plain(title.trim().split(/\s+/)[0] ?? "");
  if (/[A-Z]{2}/.test(first) && first.length <= 9) return first.toUpperCase();
  const words = plain(title).toUpperCase().split(/[^A-Z0-9]+/).filter((w) => /[A-Z]/.test(w));
  const initials = words.map((w) => w[0]).join("").slice(0, 4);
  if (initials.length >= 3) return initials;
  return (words.join("") || "MKT").slice(0, 4);
};

export type TickerItem = { sym: string; price: number; pct: number };

/** Mã chạy ở dải bảng điện: từ trong title/subtitle bỏ dấu, 3–4 chữ, số liệu seed — rõ ràng là minh hoạ. */
export const tickerItems = (title: string, subtitle: string, seed: string): TickerItem[] => {
  const words = plain(`${title} ${subtitle}`).toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length >= 2 && /[A-Z]/.test(w));
  const seen = new Set<string>();
  const syms: string[] = [];
  for (const w of words) {
    const sym = w.slice(0, 4);
    if (seen.has(sym)) continue;
    seen.add(sym);
    syms.push(sym);
  }
  for (const extra of ["VNX", "IDX", "MKT", "FIN", "CAP", "TOP"]) {
    if (syms.length >= 8) break;
    if (!seen.has(extra)) syms.push(extra);
  }
  return syms.slice(0, 12).map((sym, i) => {
    const r = random(`${seed}-t-${i}`);
    const pct = Math.round((r - 0.38) * 12 * 100) / 100 || 0.12;
    return { sym, price: 5 + random(`${seed}-tp-${i}`) * 120, pct };
  });
};

/**
 * Tách câu thành đoạn thường / đoạn số (có đơn vị theo sau) / đoạn câu nhấn — để tô màu con số và cụm nhấn.
 * Số đứng sau từ "giảm, lỗ…" tô đỏ, còn lại tô xanh.
 */
export type Piece = { text: string; kind: "plain" | "up" | "down"; punch: boolean };

const UNIT = /^(%|tỷ|tỉ|triệu|nghìn|ngàn|k|usd|đồng|đ|₫|lần|điểm|năm|tháng|ngày|người|cổ phiếu|btc)[.,!?;:]*$/iu;
const BIG_WORD = /^(tỷ|tỉ|triệu)[.,!?;:]*$/iu;

export const splitCaption = (text: string, punch: string | null): Piece[] => {
  const src = text.normalize("NFC");
  const tokens = src.split(/(\s+)/);
  const kinds: Piece["kind"][] = tokens.map(() => "plain");
  // số đứng trong vòng 3 từ sau từ chỉ chiều giảm thì tô đỏ ("giảm còn 30%")
  let words = 0;
  let downAt = -99;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.trim()) continue;
    words += 1;
    if (/\d/.test(t) || BIG_WORD.test(t)) {
      kinds[i] = words - downAt <= 3 || /^[-−]/.test(t) ? "down" : "up";
      // đơn vị ngay sau số ("30 tỷ", "5 %")
      if (i + 2 < tokens.length && UNIT.test(tokens[i + 2]) && /\d/.test(t)) kinds[i + 2] = kinds[i];
    }
    if (kinds[i] === "plain" && DOWN_WORDS.test(` ${t} `)) downAt = words;
  }
  // vị trí cụm nhấn trong câu
  const pStart = punch ? src.toLocaleLowerCase("vi").indexOf(punch.normalize("NFC").toLocaleLowerCase("vi")) : -1;
  const pEnd = pStart >= 0 && punch ? pStart + punch.normalize("NFC").length : -1;
  const out: Piece[] = [];
  let pos = 0;
  tokens.forEach((t, i) => {
    // cắt token theo ranh giới cụm nhấn
    const cuts = [0, t.length];
    if (pStart > pos && pStart < pos + t.length) cuts.push(pStart - pos);
    if (pEnd > pos && pEnd < pos + t.length) cuts.push(pEnd - pos);
    cuts.sort((a, b) => a - b);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k];
      const b = cuts[k + 1];
      if (b <= a) continue;
      const abs = pos + a;
      const piece: Piece = { text: t.slice(a, b), kind: kinds[i], punch: pStart >= 0 && abs >= pStart && abs < pEnd };
      const prev = out[out.length - 1];
      if (prev && prev.kind === piece.kind && prev.punch === piece.punch) prev.text += piece.text;
      else out.push(piece);
    }
    pos += t.length;
  });
  return out;
};

/**
 * Con số của visual stat, tách phần số để đếm: "+1.250 tỷ" → { prefix "+", value 1250, suffix " tỷ" }.
 * Giữ nguyên kiểu dấu phân cách của người viết (VN: "." nghìn, "," thập phân).
 */
export const parseStat = (text: string) => {
  const m = text.match(/^(.*?)(\d+(?:[.,]\d+)*)(.*)$/);
  if (!m) return null;
  const [, prefix, raw, suffix] = m;
  const seps = raw.match(/[.,]/g) ?? [];
  let decimalChar: "." | "," | null = null;
  let decimals = 0;
  if (seps.length) {
    const last = raw.lastIndexOf(seps[seps.length - 1]);
    const tail = raw.slice(last + 1);
    const mixed = new Set(seps).size > 1;
    if (mixed || tail.length !== 3 || seps.length === 1 && raw.slice(0, last).length > 3) {
      decimalChar = raw[last] as "." | ",";
      decimals = tail.length;
    }
  }
  const thousandChar = decimalChar === "." ? "," : ".";
  const normalized = decimalChar
    ? raw.split(decimalChar).map((p, i, arr) => (i === arr.length - 1 ? p : p.replace(/[.,]/g, ""))).join(".")
    : raw.replace(/[.,]/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const grouped = seps.some((s) => s === thousandChar);
  const format = (v: number) => {
    const [int, dec] = v.toFixed(decimals).split(".");
    const intOut = grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, thousandChar) : int;
    return dec ? `${intOut}${decimalChar}${dec}` : intOut;
  };
  return { prefix, value, suffix, format };
};
