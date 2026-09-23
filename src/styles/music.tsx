/**
 * Bộ máy chung của các phong cách nhạc (Karaoke, Lời nhạc cuộn, Đĩa than).
 *
 *  - musicSourceOf: file nhạc của video — bản thu cả bài (voiceoverTrack, bài hát đưa vào bằng
 *    audio-to-video / Làm hàng loạt từ file), bài thêm tay trong trình chỉnh sửa, rồi mới tới nhạc nền.
 *  - MusicLevels + useLevels: mức bass/mid/treble, phổ và nhịp trống (kick) ĐO TỪ CHÍNH FILE ĐÓ bằng
 *    @remotion/media-utils. Video không có file nhạc (giọng TTS từng câu) hoặc file chưa tải xong trong
 *    trình chỉnh sửa → nhịp suy từ lời: trong câu thì cao và nảy ở mỗi từ, ngoài câu lặng.
 *  - timedWords: thời điểm từng từ trong câu hát — phụ đề chỉ có mốc đầu/cuối câu nên chia theo độ dài
 *    từ, từ cuối câu ngân dài hơn.
 *
 * Mức đo được tính MỘT lần ở gốc phong cách rồi đưa xuống qua context — con nằm trong <Sequence> có
 * frame lệch không tự đo lại (xem remotion-markup/audio-visualization.md).
 */
import { useWindowedAudioData, visualizeAudio, type MediaUtilsAudioData } from "@remotion/media-utils";
import { createContext, useContext } from "react";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../constants";
import type { Caption, ShortProps } from "../compositions/Short/schema";
import { wordTokens } from "./tokens";
import { seeded } from "./shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ------------------------------------------------------------ nguồn nhạc */

export type MusicSource = {
  /** staticFile() path. */
  src: string;
  /** Mốc bắt đầu phát trên timeline (ms). */
  startMs: number;
  /** Bỏ qua bao nhiêu ms đầu file. */
  trimStartMs: number;
  /** Phát trong bao lâu trên timeline; null = tới hết video. */
  durationMs: number | null;
  speed: number;
};

type MusicProps = Pick<ShortProps, "voiceoverTrack" | "audioClips" | "music" | "captions">;

/**
 * File nhạc để đo nhịp. Bản thu cả bài thắng; không có thì lấy đoạn âm thanh thêm tay dài nhất (trừ hiệu
 * ứng sfx/) — thường là bài hát người dùng kéo vào trình chỉnh sửa; cuối cùng mới tới nhạc nền.
 * Nhạc nền phát lặp: chỉ đo được vòng đầu, sau đó nhịp suy từ lời.
 */
export const musicSourceOf = (props: Pick<ShortProps, "voiceoverTrack" | "audioClips" | "music">): MusicSource | null => {
  if (props.voiceoverTrack) return { src: props.voiceoverTrack, startMs: 0, trimStartMs: 0, durationMs: null, speed: 1 };
  const clip = (props.audioClips ?? [])
    .filter((c) => !c.src.startsWith("sfx/"))
    .reduce<ShortProps["audioClips"][number] | null>((best, c) => (!best || c.durationMs > best.durationMs ? c : best), null);
  if (clip) {
    return { src: clip.src, startMs: clip.startMs, trimStartMs: clip.trimStartMs, durationMs: clip.durationMs, speed: clip.speed ?? 1 };
  }
  return props.music ? { src: props.music, startMs: 0, trimStartMs: 0, durationMs: null, speed: 1 } : null;
};

/** Câu hát chính: phụ đề hàng đầu. Hàng sau (bản dịch song ngữ) các phong cách nhạc không vẽ. */
export const mainLines = (captions: Caption[]) => captions.filter((c) => !c.track);

/* ------------------------------------------------------------ mức nhạc */

/** Số dải phổ các phong cách nhận — bass ở đầu mảng, treble ở cuối. */
export const BANDS = 32;

export type Levels = {
  /** true = đo từ file nhạc thật; false = suy từ lời. */
  live: boolean;
  /** 0..1 */
  bass: number;
  mid: number;
  high: number;
  /** Độ lớn chung 0..1. */
  energy: number;
  /** Cú trống vừa đánh 0..1 — bass vọt lên so với vài frame trước, tắt nhanh. */
  kick: number;
  /** BANDS dải phổ 0..1, chia theo thang log để dải cao không bị lép. */
  bands: number[];
};

const SILENT: Levels = { live: false, bass: 0, mid: 0, high: 0, energy: 0, kick: 0, bands: new Array(BANDS).fill(0) };

const LevelsContext = createContext<Levels>(SILENT);

/** Mức nhạc ở frame hiện tại — chỉ dùng bên trong <MusicLevels>. */
export const useLevels = () => useContext(LevelsContext);

const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const toDb = (v: number) => 20 * Math.log10(Math.max(v, 1e-7));

/** Số mẫu FFT: 256 → mỗi ô ~86 Hz ở 44,1 kHz, đủ tách bass (dưới ~250 Hz) khỏi phần còn lại. */
const FFT_SAMPLES = 256;
/** Ô FFT dùng cho phổ: tới ~14 kHz, trên đó nhạc gần như trống. */
const FFT_USED = 160;

/**
 * Mép các dải phổ: thang log trên [1, FFT_USED) nhưng mỗi dải ít nhất một ô riêng — ở dải trầm một ô FFT
 * đã rộng 86 Hz, chia log thuần thì mười dải đầu trùng nhau và nhảy y hệt nhau.
 */
const BAND_EDGES = Array.from({ length: BANDS + 1 }, (_, i) => Math.round(Math.pow(FFT_USED, i / BANDS))).reduce<number[]>(
  (edges, e) => [...edges, edges.length ? Math.max(edges[edges.length - 1] + 1, e) : e],
  [],
);

/**
 * Mức điển hình (dB) của từng ô FFT theo tần số — phổ nhạc dốc xuống khoảng 40 dB từ bass tới treble.
 * Đo trên nhạc nền trong public/music/: [ô FFT, dB]. Nội suy theo log tần số.
 */
const REFERENCE_DB: [number, number][] = [[1, -20], [3, -17], [5, -20], [8, -30], [15, -42], [30, -48], [60, -54], [137, -61]];
/**
 * visualizeAudio chia phổ cho ĐỈNH của đoạn đã tải, nên cái quyết định cột cao hay thấp là RMS so với đỉnh:
 * bài master to (nén mạnh) có RMS sát đỉnh hơn nhạc nền mẫu. Mức đo của nhạc mẫu: ~-10,4 dB dưới đỉnh.
 */
export const REFERENCE_RMS_DB = -10.4;

const referenceAt = (bin: number) => {
  const x = Math.log10(Math.max(1, bin));
  for (let k = 1; k < REFERENCE_DB.length; k++) {
    const [b1, d1] = REFERENCE_DB[k];
    if (bin <= b1 || k === REFERENCE_DB.length - 1) {
      const [b0, d0] = REFERENCE_DB[k - 1];
      const t = (x - Math.log10(b0)) / (Math.log10(b1) - Math.log10(b0));
      return d0 + (d1 - d0) * Math.max(0, Math.min(1, t));
    }
  }
  return REFERENCE_DB[0][1];
};
const REFERENCE = Array.from({ length: FFT_USED }, (_, bin) => referenceAt(bin));

/** Mức một ô so với mức điển hình của nó: thấp hơn 10 dB → 0, cao hơn 6 dB → 1. */
const binLevel = (v: number, bin: number, gainDb: number) => clamp01((toDb(v) + gainDb - (REFERENCE[bin] - 10)) / 16);

/**
 * RMS so với đỉnh (dB, ≤ 0) của đoạn nhạc đã tải — vài chục giây quanh chỗ đang phát. Bài nén mạnh hơn nhạc mẫu
 * thì bù xuống cho cột không dính trần, mà đoạn êm vẫn thấp hơn đoạn sôi. Nhớ theo resultId (đổi khi tải cửa sổ mới).
 */
const loudnessCache = new Map<string, number>();
export const loudnessDb = (audioData: MediaUtilsAudioData) => {
  const hit = loudnessCache.get(audioData.resultId);
  if (hit !== undefined) return hit;
  const data = audioData.channelWaveforms[0];
  let sum = 0;
  let peak = 0;
  let n = 0;
  for (let k = 0; k < data.length; k++) {
    const v = Math.abs(data[k]);
    if (v > peak) peak = v;
    // RMS lấy mẫu thưa cho nhanh; đỉnh phải quét hết — visualizeAudio chia cho đúng đỉnh đó.
    if (k % 16 === 0) {
      sum += v * v;
      n++;
    }
  }
  const db = peak > 0 ? toDb(Math.sqrt(sum / Math.max(1, n))) - toDb(peak) : REFERENCE_RMS_DB;
  loudnessCache.set(audioData.resultId, db);
  return db;
};

/** Phổ FFT của một frame → mức 0..1 (tách riêng để kiểm bằng Node). */
export const levelsFromSpectrum = (spectrum: number[], previous: number[] | null, gainDb: number): Levels => {
  const level = (values: number[], from: number, to: number) => {
    const out: number[] = [];
    for (let bin = from; bin < to; bin++) out.push(binLevel(values[bin], bin, gainDb));
    return out;
  };
  const all = level(spectrum, 0, FFT_USED);
  const bands = Array.from({ length: BANDS }, (_, i) => {
    const from = Math.min(BAND_EDGES[i], FFT_USED - 1);
    const to = Math.min(FFT_USED, Math.max(from + 1, BAND_EDGES[i + 1]));
    return Math.max(...all.slice(from, to));
  });
  const bass = avg(all.slice(1, 4));
  const mid = avg(all.slice(4, 25));
  const high = avg(all.slice(25, 140));
  const before = previous ? avg(level(previous, 1, 4)) : bass;
  return {
    live: true,
    bass,
    mid,
    high,
    energy: clamp01(bass * 0.45 + mid * 0.4 + high * 0.15),
    kick: clamp01((bass - before) * 3),
    bands,
  };
};

/* ------------------------------------------------------------ thời điểm từng từ */

export type TimedWord = { text: string; offset: number; startMs: number; endMs: number };

/**
 * Chia thời lượng câu hát cho từng từ theo độ dài từ; từ cuối câu thường ngân nên nặng gấp rưỡi.
 * Đây là ước lượng — phụ đề không có mốc từng từ.
 */
export const timedWords = (caption: Caption): TimedWord[] => {
  const tokens = wordTokens(caption.text.normalize("NFC"));
  if (tokens.length === 0) return [];
  const weights = tokens.map((t, i) => {
    const w = [...t.text].length + 2;
    return i === tokens.length - 1 && tokens.length > 1 ? w * 1.6 : w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  const span = Math.max(1, caption.endMs - caption.startMs);
  let at = caption.startMs;
  return tokens.map((t, i) => {
    const startMs = at;
    at += (weights[i] / total) * span;
    return { text: t.text, offset: t.offset, startMs, endMs: at };
  });
};

/** Phần đã hát của một từ, 0..1. */
export const sungPart = (word: TimedWord, ms: number) =>
  clamp01((ms - word.startMs) / Math.max(1, word.endMs - word.startMs));

/** Từ nào thuộc cụm nhấn (so không phân biệt hoa thường, bỏ dấu câu cuối cụm). */
export const punchMask = (text: string, words: TimedWord[], punch: string | null | undefined) => {
  if (!punch) return words.map(() => false);
  const lower = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi");
  const needle = lower(punch).trim().replace(/[.,!?;:…]+$/u, "");
  const at = needle ? lower(text).indexOf(needle) : -1;
  if (at < 0) return words.map(() => false);
  const end = at + needle.length;
  return words.map((w) => w.offset < end && w.offset + w.text.length > at);
};

/* ------------------------------------------------------------ nhịp suy từ lời */

/**
 * Không có file nhạc để đo: trong câu hát mức cao và nảy ở đầu mỗi từ (tắt dần ~0,2 giây), ngoài câu
 * chỉ còn gợn nhỏ. Phổ dựng từ mức đó + dao động xác định theo frame.
 */
const syntheticLevels = (captions: Caption[], frame: number, fps: number): Levels => {
  const ms = (frame / fps) * 1000;
  const line = captions.find((c) => ms >= c.startMs && ms < c.endMs);
  let pulse = 0;
  if (line) {
    const words = timedWords(line);
    const current = [...words].reverse().find((w) => w.startMs <= ms);
    if (current) pulse = Math.exp(-(ms - current.startMs) / 190);
  }
  const energy = line ? 0.5 + pulse * 0.35 : 0.08 + 0.04 * Math.sin(frame * 0.12);
  const bands = Array.from({ length: BANDS }, (_, i) => {
    const tilt = Math.pow(1 - i / BANDS, 0.7);
    const wobble = 0.6 + 0.4 * Math.sin(frame * 0.33 + i * 1.7 + seeded(`band-${i}`, 0, 6));
    return clamp01(energy * tilt * wobble + pulse * 0.25 * tilt);
  });
  return {
    live: false,
    bass: clamp01(energy * 0.9 + pulse * 0.2),
    mid: clamp01(energy * 0.8),
    high: clamp01(energy * 0.5),
    energy,
    kick: pulse,
    bands,
  };
};

/* ------------------------------------------------------------ provider */

const SyntheticLevels: React.FC<{ captions: Caption[]; children: React.ReactNode }> = ({ captions, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <LevelsContext.Provider value={syntheticLevels(captions, frame, fps)}>{children}</LevelsContext.Provider>;
};

/** Frame cách nhau khi dò cú trống. */
const KICK_LOOKBACK = 3;

const AudioLevels: React.FC<{ source: MusicSource; captions: Caption[]; children: React.ReactNode }> = ({
  source,
  captions,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const inClip = ms >= source.startMs && (source.durationMs === null || ms < source.startMs + source.durationMs);
  // Thời điểm trong FILE nhạc: tính cả mốc bắt đầu, phần cắt đầu và tốc độ của đoạn âm thanh.
  const fileSeconds = ((ms - source.startMs) / 1000) * source.speed + source.trimStartMs / 1000;
  const fileFrame = Math.max(0, Math.round(fileSeconds * fps));
  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src: staticFile(source.src),
    frame: fileFrame,
    fps,
    windowInSeconds: 10,
  });

  let levels: Levels;
  if (!audioData) {
    // Trình chỉnh sửa đang tải file — tạm suy từ lời. Lúc render Remotion đợi tải xong (delayRender).
    levels = syntheticLevels(captions, frame, fps);
  } else if (!inClip || fileSeconds < 0 || fileSeconds >= audioData.durationInSeconds - 0.05) {
    levels = { ...SILENT, live: true };
  } else {
    const measure = (f: number) =>
      visualizeAudio({ fps, frame: f, audioData, numberOfSamples: FFT_SAMPLES, optimizeFor: "speed", dataOffsetInSeconds });
    const previous = fileFrame >= KICK_LOOKBACK ? measure(fileFrame - KICK_LOOKBACK) : null;
    const gainDb = Math.max(-12, Math.min(12, REFERENCE_RMS_DB - loudnessDb(audioData)));
    levels = levelsFromSpectrum(measure(fileFrame), previous, gainDb);
  }
  return <LevelsContext.Provider value={levels}>{children}</LevelsContext.Provider>;
};

/** Bọc gốc phong cách nhạc: con đọc mức nhạc bằng useLevels(). */
export const MusicLevels: React.FC<{ props: MusicProps; children: React.ReactNode }> = ({ props, children }) => {
  const source = musicSourceOf(props);
  const captions = mainLines(props.captions);
  return source ? (
    <AudioLevels source={source} captions={captions}>
      {children}
    </AudioLevels>
  ) : (
    <SyntheticLevels captions={captions}>{children}</SyntheticLevels>
  );
};

/* ------------------------------------------------------------ tiện ích */

/**
 * Frame kết thúc màn tên bài. Có showTitle → hết thẻ tiêu đề chuẩn (câu đầu bắt đầu sau đó). Không có
 * (bài hát đưa vào từ file, nhạc chạy ngay từ giây 0) → hiện suốt đoạn dạo đầu, dứt trước câu hát đầu
 * `leadMs` để lời kịp hiện; đoạn dạo ngắn hơn 2 giây thì bỏ. 0 = không có màn tên bài.
 */
export const introEndFrame = (captions: Caption[], showTitle: boolean, fps: number, leadMs = 300) => {
  if (showTitle) return TITLE_FRAMES;
  if (!captions[0]) return 0;
  const end = msToFrames(captions[0].startMs - leadMs);
  return end >= fps * 2 ? end : 0;
};

/** 83000 → "1:23". */
export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Sắc độ (0–360) và độ bão hoà (0–1) của một màu hex; null nếu không đọc được. */
export const hueOf = (hex: string): { h: number; s: number } | null => {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s };
};

/** Sắc độ màu nhấn; màu xám/trắng/đen không có sắc độ → `fallback`. */
export const accentHue = (accent: string, fallback: number) => {
  const c = hueOf(accent);
  return !c || c.s < 0.15 ? fallback : Math.round(c.h);
};

/** Chữ viết tắt (tối đa 2 chữ) cho ô bìa không ảnh: "Nơi này có anh" → "NN", "Lofi" → "L"; rỗng → "♪". */
export const initialsOf = (text: string) => {
  // Chỉ lấy từ bắt đầu bằng chữ/số — "Lofi · Side A" không ra "L·".
  const words = text.trim().split(/[\s._-]+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => [...w][0]) : [...(words[0] ?? "♪")].slice(0, 1);
  return letters.join("").normalize("NFC").toLocaleUpperCase("vi");
};
