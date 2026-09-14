/**
 * Thao tác trên timeline — hàm thuần: nhận props cũ, trả props mới.
 * Không đụng React nên test được bằng tsx và dùng thẳng cho hoàn tác/làm lại.
 *
 * Mọi mốc thời gian là ms tuyệt đối trên timeline, giống props.json.
 */
import type { AudioClip, Caption, Scene, ShortProps, TextOverlay } from "../../src/compositions/Short/schema";
import { ASPECTS, DEFAULT_ASPECT, type AspectId } from "../../src/aspects";
import { FPS, msToFrames, OUTRO_FRAMES, TITLE_FRAMES } from "../../src/constants";

export type Selection =
  | { type: "scene" | "caption" | "clip" | "text"; index: number }
  | { type: "music" }
  | null;

export type Result = { props: ShortProps; selection?: Selection; message?: string };

/** Khối ngắn nhất cho phép khi kéo mép. */
export const MIN_MS = 300;

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
export const isVideo = (src: string | null | undefined) => Boolean(src && VIDEO_EXT.test(src));

const r = (ms: number) => Math.max(0, Math.round(ms));

/** Giống calculateShortMetadata trong src/compositions/Short — giữ hai chỗ khớp nhau. */
export const videoMeta = (p: ShortProps) => {
  const lastEndMs = Math.max(
    p.captions.reduce((m, c) => Math.max(m, c.endMs), 0),
    p.scenes.reduce((m, s) => Math.max(m, s.endMs), 0),
    p.audioClips.reduce((m, c) => Math.max(m, c.startMs + c.durationMs), 0),
    p.texts.reduce((m, t) => Math.max(m, t.endMs), 0),
  );
  const aspect = ASPECTS[p.aspect as AspectId] ?? ASPECTS[DEFAULT_ASPECT];
  const durationInFrames = Math.max(TITLE_FRAMES, msToFrames(lastEndMs) + OUTRO_FRAMES);
  return {
    durationInFrames,
    width: aspect.width,
    height: aspect.height,
    fps: FPS,
    durationMs: (durationInFrames / FPS) * 1000,
  };
};

/**
 * Sắp xếp phụ đề và âm thanh theo thời gian (Captions chọn câu theo thứ tự mảng)
 * và giữ lựa chọn trỏ đúng vào mục vừa sửa sau khi đổi chỗ.
 */
export const normalize = (p: ShortProps, sel: Selection): { props: ShortProps; selection: Selection } => {
  const pick = <T>(arr: T[], type: string): T | undefined =>
    sel && "index" in sel && sel.type === type ? arr[sel.index] : undefined;
  const selectedCaption = pick(p.captions, "caption");
  const selectedClip = pick(p.audioClips, "clip");
  const selectedText = pick(p.texts, "text");

  const captions = [...p.captions].sort((a, b) => a.startMs - b.startMs);
  const audioClips = [...p.audioClips].sort((a, b) => a.startMs - b.startMs);
  const texts = [...p.texts].sort((a, b) => a.startMs - b.startMs);

  let selection = sel;
  if (selectedCaption) selection = { type: "caption", index: captions.indexOf(selectedCaption) };
  else if (sel && "index" in sel && sel.type === "caption") selection = null;
  if (selectedClip) selection = { type: "clip", index: audioClips.indexOf(selectedClip) };
  else if (sel && "index" in sel && sel.type === "clip") selection = null;
  if (selectedText) selection = { type: "text", index: texts.indexOf(selectedText) };
  else if (sel && "index" in sel && sel.type === "text") selection = null;
  if (sel && "index" in sel && sel.type === "scene" && sel.index >= p.scenes.length) selection = null;

  return { props: { ...p, captions, audioClips, texts }, selection };
};

const clampPunch = (s: Scene): Scene =>
  s.punch
    ? { ...s, punch: { ...s.punch, atMs: Math.min(Math.max(s.punch.atMs, s.startMs), Math.max(s.startMs, s.endMs - 200)) } }
    : s;

export const sceneIndexAt = (p: ShortProps, ms: number) => {
  let index = 0;
  p.scenes.forEach((s, k) => {
    if (ms >= s.startMs) index = k;
  });
  return index;
};

// ---------- phụ đề ----------

export const moveCaption = (p: ShortProps, i: number, deltaMs: number): ShortProps => {
  const c = p.captions[i];
  const d = Math.max(-c.startMs, deltaMs);
  return {
    ...p,
    captions: p.captions.map((x, k) => (k === i ? { ...x, startMs: r(x.startMs + d), endMs: r(x.endMs + d) } : x)),
  };
};

export const resizeCaption = (p: ShortProps, i: number, edge: "l" | "r", deltaMs: number): ShortProps => {
  const c = p.captions[i];
  const next: Caption =
    edge === "l"
      ? { ...c, startMs: r(Math.min(c.startMs + deltaMs, c.endMs - MIN_MS)) }
      : { ...c, endMs: r(Math.max(c.endMs + deltaMs, c.startMs + MIN_MS)) };
  return { ...p, captions: p.captions.map((x, k) => (k === i ? next : x)) };
};

export const updateCaption = (p: ShortProps, i: number, patch: Partial<Caption>): ShortProps => ({
  ...p,
  captions: p.captions.map((x, k) => (k === i ? { ...x, ...patch } : x)),
});

export const addCaption = (p: ShortProps, atMs: number): Result => ({
  props: { ...p, captions: [...p.captions, { text: "Chữ mới", startMs: r(atMs), endMs: r(atMs + 2000), audio: null }] },
  selection: { type: "caption", index: p.captions.length },
});

// ---------- cảnh ----------

/** Kéo mép phải cảnh i: cảnh kế tiếp bắt đầu theo — các cảnh luôn nối liền nhau. */
export const moveSceneEdge = (p: ShortProps, i: number, deltaMs: number): ShortProps => {
  const scenes = p.scenes.map((s) => ({ ...s }));
  const scene = scenes[i];
  const next = scenes[i + 1];
  const min = scene.startMs + MIN_MS;
  const max = next ? next.endMs - MIN_MS : Number.POSITIVE_INFINITY;
  const end = r(Math.min(max, Math.max(min, scene.endMs + deltaMs)));
  scene.endMs = end;
  if (next) next.startMs = end;
  return { ...p, scenes: scenes.map(clampPunch) };
};

/**
 * Đổi thứ tự cảnh: cả đoạn thời gian của cảnh chuyển đi, kéo theo phụ đề (và giọng đọc),
 * văn bản, âm thanh bắt đầu trong đoạn đó — nội dung không bị tách khỏi hình.
 */
export const reorderScene = (p: ShortProps, from: number, to: number): Result => {
  const count = p.scenes.length;
  if (from === to || from < 0 || from >= count || to < 0 || to >= count) return { props: p };

  const order = p.scenes.map((_, k) => k);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);

  const newStart: number[] = [];
  let cursor = 0;
  for (const k of order) {
    newStart[k] = cursor;
    cursor += p.scenes[k].endMs - p.scenes[k].startMs;
  }
  const delta = p.scenes.map((s, k) => newStart[k] - s.startMs);
  // Mốc nằm sau cảnh cuối (đuôi video) thuộc về cảnh cuối.
  const segmentOf = (t: number) => {
    let index = 0;
    p.scenes.forEach((s, k) => {
      if (t >= s.startMs) index = k;
    });
    return index;
  };

  const scenes = order.map((k) => {
    const s = p.scenes[k];
    return clampPunch({
      ...s,
      startMs: newStart[k],
      endMs: newStart[k] + (s.endMs - s.startMs),
      punch: s.punch ? { ...s.punch, atMs: r(s.punch.atMs + delta[k]) } : null,
    });
  });

  return {
    props: {
      ...p,
      scenes,
      captions: p.captions.map((c) => {
        const d = delta[segmentOf(c.startMs)];
        return { ...c, startMs: r(c.startMs + d), endMs: r(c.endMs + d) };
      }),
      texts: p.texts.map((t) => {
        const d = delta[segmentOf(t.startMs)];
        return { ...t, startMs: r(t.startMs + d), endMs: r(t.endMs + d) };
      }),
      audioClips: p.audioClips.map((c) => ({ ...c, startMs: r(c.startMs + delta[segmentOf(c.startMs)]) })),
    },
    selection: { type: "scene", index: to },
    message: `Đã chuyển cảnh ${from + 1} sang vị trí ${to + 1}.`,
  };
};

export const updateScene = (p: ShortProps, i: number, patch: Partial<Scene>): ShortProps => ({
  ...p,
  scenes: p.scenes.map((x, k) => (k === i ? clampPunch({ ...x, ...patch }) : x)),
});

export const setSceneMedia = (p: ShortProps, i: number, src: string | null): ShortProps =>
  updateScene(p, i, { image: src, trimStartMs: 0 });

/**
 * Đặt độ dài cảnh (lấy đoạn clip). Dài ra: mọi thứ phía sau lùi theo. Ngắn đi: cắt bỏ
 * phần đuôi cảnh và dồn phần sau lên (ripple) — timeline không bị hở.
 */
export const setSceneLength = (p: ShortProps, i: number, lengthMs: number): ShortProps => {
  const s = p.scenes[i];
  if (!s) return p;
  const current = s.endMs - s.startMs;
  const next = r(Math.max(MIN_MS, lengthMs));
  if (next === current) return p;
  if (next > current) return shiftAfter(p, s.endMs, next - current);
  return rippleDelete(p, s.startMs + next, s.endMs).props;
};

/** Nối một ảnh/video thành cảnh mới ở cuối video — video dài đúng thời lượng clip. */
export const appendScene = (p: ShortProps, src: string, durationMs: number): Result => {
  const last = p.scenes[p.scenes.length - 1];
  const startMs = last ? last.endMs : 0;
  const video = isVideo(src);
  const scene: Scene = {
    image: src,
    visual: null,
    tag: null,
    punch: null,
    trimStartMs: 0,
    // Clip thêm tay thường là video quay sẵn — giữ tiếng gốc. Ảnh thì không có tiếng.
    volume: video ? 1 : 0,
    crop: null,
    startMs,
    endMs: r(startMs + Math.max(MIN_MS, durationMs)),
  };
  return {
    props: { ...p, scenes: [...p.scenes, scene] },
    selection: { type: "scene", index: p.scenes.length },
    message: `Đã thêm cảnh ${p.scenes.length + 1} (${(Math.max(MIN_MS, durationMs) / 1000).toFixed(1)}s) ở cuối video.`,
  };
};

/**
 * Tách âm thanh của cảnh video ra track riêng: thêm đoạn âm thanh (file đã tách bằng
 * ffmpeg) đúng mốc và đúng phần cắt đầu của clip, rồi tắt tiếng gốc của cảnh để khỏi đôi tiếng.
 */
export const detachAudio = (p: ShortProps, i: number, audioSrc: string, sourceMs: number): Result => {
  const s = p.scenes[i];
  if (!s || !isVideo(s.image)) return { props: p, message: "Chọn một cảnh là video để tách âm thanh." };
  const sceneLength = s.endMs - s.startMs;
  const available = sourceMs > 0 ? Math.max(MIN_MS, sourceMs - s.trimStartMs) : sceneLength;
  const clip: AudioClip = {
    src: audioSrc,
    startMs: s.startMs,
    trimStartMs: s.trimStartMs,
    durationMs: r(Math.min(sceneLength, available)),
    volume: s.volume > 0 ? s.volume : 1,
    label: `Âm thanh cảnh ${i + 1}`,
  };
  const muted = updateScene(p, i, { volume: 0 });
  return {
    props: { ...muted, audioClips: [...muted.audioClips, clip] },
    selection: { type: "clip", index: p.audioClips.length },
    message: `Đã tách âm thanh cảnh ${i + 1} ra track riêng — video đã tắt tiếng gốc.`,
  };
};

// ---------- âm thanh ----------

const withClip = (p: ShortProps, i: number, clip: AudioClip): ShortProps => ({
  ...p,
  audioClips: p.audioClips.map((x, k) => (k === i ? clip : x)),
});

export const moveClip = (p: ShortProps, i: number, deltaMs: number): ShortProps => {
  const c = p.audioClips[i];
  return withClip(p, i, { ...c, startMs: r(c.startMs + Math.max(-c.startMs, deltaMs)) });
};

/** Mép trái = cắt đầu file (clip bắt đầu muộn hơn); mép phải = độ dài phát. */
export const resizeClip = (p: ShortProps, i: number, edge: "l" | "r", deltaMs: number): ShortProps => {
  const c = p.audioClips[i];
  if (edge === "l") {
    const d = Math.min(c.durationMs - MIN_MS, Math.max(deltaMs, -c.trimStartMs, -c.startMs));
    return withClip(p, i, {
      ...c,
      startMs: r(c.startMs + d),
      trimStartMs: r(c.trimStartMs + d),
      durationMs: r(c.durationMs - d),
    });
  }
  return withClip(p, i, { ...c, durationMs: r(Math.max(MIN_MS, c.durationMs + deltaMs)) });
};

export const updateClip = (p: ShortProps, i: number, patch: Partial<AudioClip>): ShortProps =>
  withClip(p, i, { ...p.audioClips[i], ...patch });

export const addClip = (p: ShortProps, src: string, atMs: number, durationMs: number, label: string | null): Result => ({
  props: {
    ...p,
    audioClips: [
      ...p.audioClips,
      { src, startMs: r(atMs), trimStartMs: 0, durationMs: r(Math.max(MIN_MS, durationMs)), volume: 1, label },
    ],
  },
  selection: { type: "clip", index: p.audioClips.length },
});

// ---------- chữ tự do ----------

const withText = (p: ShortProps, i: number, text: TextOverlay): ShortProps => ({
  ...p,
  texts: p.texts.map((x, k) => (k === i ? text : x)),
});

/** Hàng thấp nhất còn trống trong khoảng [start, end] — chữ mới không đè lên chữ cũ trên timeline. */
export const freeTrack = (p: ShortProps, startMs: number, endMs: number, ignore = -1) => {
  for (let track = 0; ; track++) {
    const busy = p.texts.some((t, k) => k !== ignore && t.track === track && t.startMs < endMs && t.endMs > startMs);
    if (!busy) return track;
  }
};

export const textTrackCount = (p: ShortProps) => p.texts.reduce((m, t) => Math.max(m, t.track + 1), 0);

export const moveText = (p: ShortProps, i: number, deltaMs: number, track?: number): ShortProps => {
  const t = p.texts[i];
  const d = Math.max(-t.startMs, deltaMs);
  return withText(p, i, {
    ...t,
    startMs: r(t.startMs + d),
    endMs: r(t.endMs + d),
    track: track === undefined ? t.track : Math.max(0, Math.round(track)),
  });
};

export const resizeText = (p: ShortProps, i: number, edge: "l" | "r", deltaMs: number): ShortProps => {
  const t = p.texts[i];
  return withText(
    p,
    i,
    edge === "l"
      ? { ...t, startMs: r(Math.min(t.startMs + deltaMs, t.endMs - MIN_MS)) }
      : { ...t, endMs: r(Math.max(t.endMs + deltaMs, t.startMs + MIN_MS)) },
  );
};

export const updateText = (p: ShortProps, i: number, patch: Partial<TextOverlay>): ShortProps =>
  withText(p, i, { ...p.texts[i], ...patch });

const TEXT_DEFAULTS: Omit<TextOverlay, "text" | "startMs" | "endMs" | "track"> = {
  x: 50, y: 30, size: 72, color: "#ffffff", background: null, weight: 800,
  align: "center", maxWidth: 80, shadow: true, animation: "pop",
};

export const addText = (p: ShortProps, atMs: number, patch: Partial<TextOverlay> = {}): Result => {
  const startMs = r(atMs);
  const endMs = r(atMs + 2500);
  const text: TextOverlay = {
    ...TEXT_DEFAULTS,
    text: "Văn bản mới",
    startMs,
    endMs,
    track: freeTrack(p, startMs, endMs),
    ...patch,
  };
  return { props: { ...p, texts: [...p.texts, text] }, selection: { type: "text", index: p.texts.length } };
};

export const duplicateText = (p: ShortProps, i: number): Result => {
  const t = p.texts[i];
  // Bản sao lệch xuống một chút để thấy ngay trên khung hình, cùng thời gian, hàng khác.
  const copy: TextOverlay = { ...t, y: Math.min(95, t.y + 8), track: freeTrack(p, t.startMs, t.endMs) };
  return {
    props: { ...p, texts: [...p.texts, copy] },
    selection: { type: "text", index: p.texts.length },
    message: "Đã nhân đôi văn bản.",
  };
};

// ---------- giọng đọc ----------

/**
 * Dời mọi thứ bắt đầu từ mốc `atMs` về sau thêm `deltaMs` (chèn thêm thời gian).
 * Cảnh đang chứa mốc đó dài ra; phụ đề/chữ/âm thanh phía sau lùi theo.
 */
export const shiftAfter = (p: ShortProps, atMs: number, deltaMs: number): ShortProps => {
  if (deltaMs <= 0) return p;
  const map = (t: number) => (t >= atMs ? t + deltaMs : t);
  return {
    ...p,
    captions: p.captions.map((c) => ({ ...c, startMs: map(c.startMs), endMs: map(c.endMs) })),
    scenes: p.scenes.map((s) =>
      clampPunch({
        ...s,
        startMs: map(s.startMs),
        endMs: map(s.endMs),
        punch: s.punch ? { ...s.punch, atMs: map(s.punch.atMs) } : null,
      })),
    audioClips: p.audioClips.map((c) => ({ ...c, startMs: map(c.startMs) })),
    texts: p.texts.map((t) => ({ ...t, startMs: map(t.startMs), endMs: map(t.endMs) })),
  };
};

const VOICE_GAP_MS = 150;

/**
 * Gắn clip giọng mới cho các câu `indexes` (theo thứ tự). Câu dài ra theo độ dài giọng;
 * nếu lấn sang câu kế tiếp thì mọi thứ phía sau lùi lại cho khỏi chồng. Câu ngắn đi thì
 * giữ nguyên chỗ trống — không kéo phần sau lên để khỏi phá bố cục đã chỉnh tay.
 */
export const applyVoice = (
  p: ShortProps,
  indexes: number[],
  clips: { src: string; durationMs: number }[],
): ShortProps => {
  // Làm từ câu muộn nhất về trước: dời phần sau không làm lệch vị trí các câu chưa xử lý.
  const order = indexes.map((index, k) => ({ index, clip: clips[k] }))
    .filter((x) => x.clip && p.captions[x.index])
    .sort((a, b) => p.captions[b.index].startMs - p.captions[a.index].startMs);

  let result = p;
  for (const { index, clip } of order) {
    const caption = result.captions[index];
    const newEnd = r(caption.startMs + clip.durationMs);
    const nextStart = result.captions
      .filter((c, k) => k !== index && c.startMs > caption.startMs)
      .reduce((m, c) => Math.min(m, c.startMs), Number.POSITIVE_INFINITY);
    const overflow = Number.isFinite(nextStart) ? newEnd + VOICE_GAP_MS - nextStart : 0;
    if (overflow > 0) result = shiftAfter(result, caption.startMs + 1, overflow);
    result = updateCaption(result, index, { audio: clip.src, endMs: newEnd });
  }
  return result;
};

export const removeAllVoice = (p: ShortProps): Result => {
  const count = p.captions.filter((c) => c.audio).length + (p.voiceoverTrack ? 1 : 0);
  if (count === 0) return { props: p, message: "Video này không có giọng đọc." };
  return {
    props: { ...p, voiceoverTrack: null, captions: p.captions.map((c) => ({ ...c, audio: null })) },
    message: "Đã bỏ toàn bộ giọng đọc — phụ đề vẫn giữ nguyên.",
  };
};

// ---------- tách, xoá, cắt ----------

export const splitAt = (p: ShortProps, atMs: number, sel: Selection): Result => {
  const t = r(atMs);
  const tooClose = (start: number, end: number) => t <= start + MIN_MS / 2 || t >= end - MIN_MS / 2;

  if (sel && "index" in sel && sel.type === "caption") {
    const c = p.captions[sel.index];
    if (!c || tooClose(c.startMs, c.endMs)) return { props: p, message: "Đưa đầu phát vào giữa câu cần tách." };
    const words = c.text.split(/\s+/).filter(Boolean);
    if (words.length < 2) return { props: p, message: "Câu chỉ có một từ — không tách được." };
    const ratio = (t - c.startMs) / (c.endMs - c.startMs);
    const k = Math.min(words.length - 1, Math.max(1, Math.round(words.length * ratio)));
    const first: Caption = { ...c, text: words.slice(0, k).join(" "), endMs: t };
    const second: Caption = { text: words.slice(k).join(" "), startMs: t, endMs: c.endMs, audio: null };
    const captions = [...p.captions];
    captions.splice(sel.index, 1, first, second);
    return {
      props: { ...p, captions },
      selection: { type: "caption", index: sel.index + 1 },
      message: c.audio ? "Đã tách. Giọng đọc ở lại phần đầu — phần sau không có giọng." : "Đã tách câu.",
    };
  }

  if (sel && "index" in sel && sel.type === "text") {
    const tx = p.texts[sel.index];
    if (!tx || tooClose(tx.startMs, tx.endMs)) return { props: p, message: "Đưa đầu phát vào giữa khối văn bản." };
    const texts = [...p.texts];
    texts.splice(sel.index, 1, { ...tx, endMs: t }, { ...tx, startMs: t });
    return { props: { ...p, texts }, selection: { type: "text", index: sel.index + 1 }, message: "Đã tách văn bản thành hai đoạn." };
  }

  if (sel && "index" in sel && sel.type === "clip") {
    const c = p.audioClips[sel.index];
    if (!c || tooClose(c.startMs, c.startMs + c.durationMs)) return { props: p, message: "Đưa đầu phát vào giữa đoạn âm thanh." };
    const offset = t - c.startMs;
    const first: AudioClip = { ...c, durationMs: offset };
    const second: AudioClip = { ...c, startMs: t, trimStartMs: c.trimStartMs + offset, durationMs: c.durationMs - offset };
    const audioClips = [...p.audioClips];
    audioClips.splice(sel.index, 1, first, second);
    return { props: { ...p, audioClips }, selection: { type: "clip", index: sel.index + 1 }, message: "Đã tách âm thanh." };
  }

  const i = sel && "index" in sel && sel.type === "scene" ? sel.index : sceneIndexAt(p, t);
  const s = p.scenes[i];
  if (!s || tooClose(s.startMs, s.endMs)) return { props: p, message: "Đưa đầu phát vào giữa cảnh cần tách." };
  const first: Scene = clampPunch({ ...s, endMs: t, punch: s.punch && s.punch.atMs < t ? s.punch : null });
  const second: Scene = clampPunch({
    ...s,
    startMs: t,
    trimStartMs: isVideo(s.image) ? s.trimStartMs + (t - s.startMs) : s.trimStartMs,
    punch: s.punch && s.punch.atMs >= t ? s.punch : null,
  });
  const scenes = [...p.scenes];
  scenes.splice(i, 1, first, second);
  return { props: { ...p, scenes }, selection: { type: "scene", index: i + 1 }, message: `Đã tách cảnh ${i + 1}.` };
};

export const deleteSelection = (p: ShortProps, sel: Selection): Result => {
  if (!sel) return { props: p, message: "Chọn một mục trên timeline trước." };
  if (sel.type === "music") return { props: { ...p, music: null }, selection: null, message: "Đã bỏ nhạc nền." };
  if (sel.type === "caption") {
    return { props: { ...p, captions: p.captions.filter((_, k) => k !== sel.index) }, selection: null };
  }
  if (sel.type === "clip") {
    return { props: { ...p, audioClips: p.audioClips.filter((_, k) => k !== sel.index) }, selection: null };
  }
  if (sel.type === "text") {
    return { props: { ...p, texts: p.texts.filter((_, k) => k !== sel.index) }, selection: null };
  }
  if (p.scenes.length <= 1) return { props: p, message: "Video cần ít nhất một cảnh." };
  const scenes = p.scenes.map((s) => ({ ...s }));
  const removed = scenes[sel.index];
  // Thời gian của cảnh bị xoá nhập vào cảnh bên cạnh — timeline không bị hở.
  if (sel.index > 0) scenes[sel.index - 1].endMs = removed.endMs;
  else scenes[1].startMs = 0;
  scenes.splice(sel.index, 1);
  return { props: { ...p, scenes: scenes.map(clampPunch) }, selection: null, message: `Đã xoá cảnh ${sel.index + 1}.` };
};

/**
 * Cắt bỏ đoạn [from, to] và dồn mọi thứ phía sau lên (ripple delete).
 * Cắt đầu video = rippleDelete(0, t); cắt đuôi = rippleDelete(t, hết).
 */
export const rippleDelete = (p: ShortProps, from: number, to: number): Result => {
  const a = r(Math.min(from, to));
  const b = r(Math.max(from, to));
  const len = b - a;
  if (len < 100) return { props: p, message: "Đoạn cần cắt quá ngắn." };
  const map = (t: number) => (t <= a ? t : t >= b ? t - len : a);

  let voiceDropped = 0;
  const captions = p.captions.flatMap((c) => {
    if (c.startMs >= a && c.endMs <= b) return [];
    const startMs = map(c.startMs);
    const endMs = map(c.endMs);
    if (endMs - startMs < 200) return [];
    // Đầu câu bị cắt: clip giọng vẫn phát từ đầu nên sẽ lệch chữ — bỏ giọng câu đó.
    const headCut = c.startMs >= a && c.startMs < b;
    if (headCut && c.audio) voiceDropped += 1;
    return [{ ...c, startMs, endMs, audio: headCut ? null : c.audio }];
  });

  const scenes = p.scenes.flatMap((s) => {
    const startMs = map(s.startMs);
    const endMs = map(s.endMs);
    if (endMs - startMs < 100) return [];
    const headCut = s.startMs >= a && s.startMs < b;
    const punch = !s.punch || (s.punch.atMs >= a && s.punch.atMs < b) ? null : { ...s.punch, atMs: map(s.punch.atMs) };
    return [{
      ...s,
      startMs,
      endMs,
      trimStartMs: headCut && isVideo(s.image) ? s.trimStartMs + (b - s.startMs) : s.trimStartMs,
      punch,
    }];
  });
  if (scenes.length === 0) return { props: p, message: "Không thể cắt hết mọi cảnh." };
  scenes[0] = { ...scenes[0], startMs: 0 };
  for (let k = 1; k < scenes.length; k++) scenes[k] = { ...scenes[k], startMs: scenes[k - 1].endMs };

  const audioClips = p.audioClips.flatMap((c) => {
    const end = c.startMs + c.durationMs;
    if (c.startMs >= a && end <= b) return [];
    const startMs = map(c.startMs);
    const newEnd = map(end);
    if (newEnd - startMs < 100) return [];
    const headCut = c.startMs >= a && c.startMs < b;
    return [{ ...c, startMs, durationMs: newEnd - startMs, trimStartMs: headCut ? c.trimStartMs + (b - c.startMs) : c.trimStartMs }];
  });

  const texts = p.texts.flatMap((t) => {
    if (t.startMs >= a && t.endMs <= b) return [];
    const startMs = map(t.startMs);
    const endMs = map(t.endMs);
    return endMs - startMs < 100 ? [] : [{ ...t, startMs, endMs }];
  });

  const notes = [`Đã cắt bỏ ${(len / 1000).toFixed(1)}s.`];
  if (voiceDropped) notes.push(`${voiceDropped} câu bị cắt mất đầu nên bỏ giọng đọc của câu đó.`);
  if (a === 0 && p.showTitle) notes.push("Đã tắt title card vì phần đầu video bị cắt.");

  return {
    props: { ...p, captions, scenes: scenes.map(clampPunch), audioClips, texts, showTitle: a === 0 ? false : p.showTitle },
    selection: null,
    message: notes.join(" "),
  };
};

/** Các mốc để hít vào khi kéo: mép phụ đề, ranh giới cảnh, mép âm thanh, đầu phát. */
export const snapEdges = (p: ShortProps, excludeKey: string, playheadMs: number) => {
  const edges = [0, playheadMs];
  p.captions.forEach((c, k) => {
    if (`caption-${k}` !== excludeKey) edges.push(c.startMs, c.endMs);
  });
  p.scenes.forEach((s, k) => {
    if (`scene-${k}` !== excludeKey) edges.push(s.endMs);
  });
  p.audioClips.forEach((c, k) => {
    if (`clip-${k}` !== excludeKey) edges.push(c.startMs, c.startMs + c.durationMs);
  });
  p.texts.forEach((t, k) => {
    if (`text-${k}` !== excludeKey) edges.push(t.startMs, t.endMs);
  });
  return edges;
};

export const snapTo = (target: number, edges: number[], toleranceMs: number) => {
  let best = target;
  let dist = toleranceMs;
  for (const edge of edges) {
    const d = Math.abs(edge - target);
    if (d < dist) {
      dist = d;
      best = edge;
    }
  }
  return best === target ? Math.round(target / 50) * 50 : best;
};
