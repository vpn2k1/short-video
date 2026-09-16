/**
 * Thao tác trên timeline — hàm thuần: nhận props cũ, trả props mới.
 * Không đụng React nên test được bằng tsx và dùng thẳng cho hoàn tác/làm lại.
 *
 * Mọi mốc thời gian là ms tuyệt đối trên timeline, giống props.json.
 */
import { overlayKeyframes, overlayTransformAt, type MotionTarget, type OverlayTransform } from "../../src/compositions/Short/overlayMotion";
import { noMotion, type AudioClip, type Caption, type CaptionLook, type MediaOverlay, type OverlayKeyframe, type Scene, type ShortProps, type TextOverlay } from "../../src/compositions/Short/schema";
import { textPatch } from "../../src/components/captionLook";
import { ASPECTS, DEFAULT_ASPECT, type AspectId } from "../../src/aspects";
import { FPS, msToFrames, OUTRO_FRAMES, TITLE_FRAMES } from "../../src/constants";

export type Selection =
  | { type: "scene" | "caption" | "clip" | "text" | "overlay"; index: number }
  | { type: "music" }
  | null;

export type Result = { props: ShortProps; selection?: Selection; message?: string };

/** Khối ngắn nhất cho phép khi kéo mép. */
export const MIN_MS = 300;

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
export const isVideo = (src: string | null | undefined) => Boolean(src && VIDEO_EXT.test(src));

const r = (ms: number) => Math.max(0, Math.round(ms));

/** props.json lưu trước khi có nhiều hàng video thì không có trường này. */
export const overlaysOf = (p: ShortProps): MediaOverlay[] => p.overlays ?? [];

/** Mốc chuyển động của một lớp, đã xếp theo thời gian. */
export const overlayKeyframesOf = overlayKeyframes;

/** Giống calculateShortMetadata trong src/compositions/Short — giữ hai chỗ khớp nhau. */
export const videoMeta = (p: ShortProps) => {
  const lastEndMs = Math.max(
    p.captions.reduce((m, c) => Math.max(m, c.endMs), 0),
    p.scenes.reduce((m, s) => Math.max(m, s.endMs), 0),
    p.audioClips.reduce((m, c) => Math.max(m, c.startMs + c.durationMs), 0),
    p.texts.reduce((m, t) => Math.max(m, t.endMs), 0),
    overlaysOf(p).reduce((m, o) => Math.max(m, o.endMs), 0),
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
  const selectedOverlay = pick(overlaysOf(p), "overlay");

  const captions = [...p.captions].sort((a, b) => a.startMs - b.startMs);
  const audioClips = [...p.audioClips].sort((a, b) => a.startMs - b.startMs);
  const texts = [...p.texts].sort((a, b) => a.startMs - b.startMs);
  const overlays = [...overlaysOf(p)].sort((a, b) => a.track - b.track || a.startMs - b.startMs);

  let selection = sel;
  if (selectedCaption) selection = { type: "caption", index: captions.indexOf(selectedCaption) };
  else if (sel && "index" in sel && sel.type === "caption") selection = null;
  if (selectedClip) selection = { type: "clip", index: audioClips.indexOf(selectedClip) };
  else if (sel && "index" in sel && sel.type === "clip") selection = null;
  if (selectedText) selection = { type: "text", index: texts.indexOf(selectedText) };
  else if (sel && "index" in sel && sel.type === "text") selection = null;
  if (selectedOverlay) selection = { type: "overlay", index: overlays.indexOf(selectedOverlay) };
  else if (sel && "index" in sel && sel.type === "overlay") selection = null;
  if (sel && "index" in sel && sel.type === "scene" && sel.index >= p.scenes.length) selection = null;

  return { props: { ...p, captions, audioClips, texts, overlays }, selection };
};

/** Dời mọi mốc chuyển động thêm `deltaMs` (mốc là thời gian tuyệt đối trên timeline). */
const shiftKeys = (keys: OverlayKeyframe[] | undefined, deltaMs: number): OverlayKeyframe[] =>
  (keys ?? []).map((k) => ({ ...k, atMs: Math.max(0, r(k.atMs + deltaMs)) }));

/** Đưa mốc chuyển động qua một phép biến đổi thời gian (chèn thêm / cắt bỏ thời lượng). */
const mapKeys = (keys: OverlayKeyframe[] | undefined, map: (ms: number) => number): OverlayKeyframe[] =>
  (keys ?? []).map((k) => ({ ...k, atMs: Math.max(0, r(map(k.atMs))) }));

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

/** Dời câu theo thời gian; `track` có thì đổi luôn hàng phụ đề (kéo lên/xuống trên timeline). */
export const moveCaption = (p: ShortProps, i: number, deltaMs: number, track?: number): ShortProps => {
  const c = p.captions[i];
  const d = Math.max(-c.startMs, deltaMs);
  const nextTrack = track === undefined ? c.track : Math.max(0, Math.round(track));
  return {
    ...p,
    captions: p.captions.map((x, k) =>
      k === i ? { ...x, startMs: r(x.startMs + d), endMs: r(x.endMs + d), track: nextTrack ? nextTrack : undefined } : x),
  };
};

/** Số hàng phụ đề đang có (ít nhất 1). */
export const captionTrackCount = (p: ShortProps) => p.captions.reduce((max, c) => Math.max(max, (c.track ?? 0) + 1), 1);

/** Hàng cho câu mới tạo bằng nút: chưa có câu nào thì hàng 1, có rồi thì thêm một hàng mới. */
const newCaptionTrack = (p: ShortProps) => (p.captions.length === 0 ? 0 : captionTrackCount(p));

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

/** Nút "＋ Phụ đề": câu mới tại đầu phát, ở một hàng phụ đề mới (Phụ đề 2, 3…). */
export const addCaption = (p: ShortProps, atMs: number): Result => {
  const track = newCaptionTrack(p);
  return {
    props: {
      ...p,
      captions: [...p.captions, { text: "Chữ mới", startMs: r(atMs), endMs: r(atMs + 2000), audio: null, track: track || undefined }],
    },
    selection: { type: "caption", index: p.captions.length },
    message: `Đã thêm câu ở hàng Phụ đề ${track + 1}.`,
  };
};

/** Độ dài mặc định của một câu gõ tay: đủ đọc (~15 ký tự/giây), trong khoảng 1,2–6 giây. */
const readingMs = (text: string) => Math.min(6000, Math.max(1200, [...text].length * 65));

/** Xếp phụ đề theo thời gian và trả về vị trí mới của một câu (theo tham chiếu). */
const sortedWith = (captions: Caption[], target: Caption) => {
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  return { captions: sorted, index: sorted.indexOf(target) };
};

/**
 * Thêm một câu trống. `index` có (Enter trong danh sách): ngay sau câu đó, CÙNG hàng — bắt đầu đúng lúc câu
 * trước kết thúc, dài 2 giây nhưng không lấn sang câu kế tiếp của hàng đó nếu còn chỗ.
 * `index` null (nút ＋ Thêm phụ đề): tại đầu phát, ở một hàng phụ đề MỚI.
 */
export const insertCaptionAfter = (p: ShortProps, index: number | null, atMs: number): Result => {
  const previous = index !== null ? p.captions[index] : null;
  const track = previous ? previous.track ?? 0 : newCaptionTrack(p);
  const startMs = r(previous ? previous.endMs : atMs);
  const nextStart = p.captions
    .filter((c) => c !== previous && (c.track ?? 0) === track && c.startMs >= startMs)
    .reduce((min, c) => Math.min(min, c.startMs), Number.POSITIVE_INFINITY);
  const room = nextStart - startMs;
  // Còn khe tới câu kế tiếp thì vừa khe (tối đa 2s) để không đè; hết chỗ hẳn thì 2s — kéo lại trên timeline.
  const endMs = r(startMs + (room >= MIN_MS ? Math.min(2000, room) : 2000));
  const created: Caption = { text: "", startMs, endMs, audio: null, style: previous?.style ?? null, track: track || undefined };
  const { captions, index: at } = sortedWith([...p.captions, created], created);
  return { props: { ...p, captions }, selection: { type: "caption", index: at } };
};

/**
 * Dán nhiều dòng: mỗi dòng thành một câu phụ đề, nối tiếp nhau từ đầu phát trên một hàng phụ đề mới,
 * độ dài mỗi câu ước theo số chữ. Chỉnh lại thời gian trên timeline sau.
 */
export const addCaptionLines = (p: ShortProps, lines: string[], atMs: number): Result => {
  const texts = lines.map((line) => line.trim()).filter(Boolean);
  if (texts.length === 0) return { props: p, message: "Chưa có dòng nào để thêm." };
  const track = newCaptionTrack(p);
  let cursor = r(atMs);
  const created: Caption[] = texts.map((text) => {
    const caption: Caption = { text, startMs: cursor, endMs: r(cursor + readingMs(text)), audio: null, track: track || undefined };
    cursor = caption.endMs;
    return caption;
  });
  const { captions, index } = sortedWith([...p.captions, ...created], created[created.length - 1]);
  return {
    props: { ...p, captions },
    selection: { type: "caption", index },
    message: `Đã thêm ${created.length} câu ở hàng Phụ đề ${track + 1} — kéo trên timeline để chỉnh thời gian.`,
  };
};

/**
 * Nhập phụ đề từ file (SRT, VTT, JSON hoặc văn bản thường — xem server/editor/subtitle-import.ts).
 *
 * - Câu CÓ mốc giờ: giữ đúng thời gian trong file; `shiftToPlayhead` thì dời cả cụm về đầu phát.
 * - Câu KHÔNG có mốc giờ: nối tiếp câu trước, độ dài ước theo số chữ — người dùng kéo lại trên timeline.
 * - `replace`: thay toàn bộ phụ đề đang có; không thì thêm vào một hàng phụ đề mới cho khỏi đè hàng cũ.
 */
export const importCaptions = (
  p: ShortProps,
  cues: { text: string; startMs: number | null; endMs: number | null }[],
  atMs: number,
  opts: { replace?: boolean; shiftToPlayhead?: boolean } = {},
): Result => {
  const rows = cues
    .map((c) => ({ ...c, text: c.text.trim() }))
    .filter((c) => c.text);
  if (rows.length === 0) return { props: p, message: "File không có câu nào để nhập." };

  const firstTimed = rows.find((c) => c.startMs !== null)?.startMs ?? null;
  const offset = opts.shiftToPlayhead && firstTimed !== null ? r(atMs) - firstTimed : 0;
  const track = opts.replace ? 0 : newCaptionTrack(p);

  let cursor = r(atMs);
  const created: Caption[] = rows.map((c) => {
    const startMs = c.startMs === null ? cursor : r(c.startMs + offset);
    // Thiếu mốc kết thúc, hoặc mốc kết thúc ngược/quá sát: ước theo số chữ.
    const endMs = c.endMs === null || c.endMs + offset < startMs + MIN_MS
      ? r(startMs + readingMs(c.text))
      : r(c.endMs + offset);
    cursor = endMs;
    return { text: c.text, startMs, endMs, audio: null, track: track || undefined };
  });
  created.sort((a, b) => a.startMs - b.startMs);
  // File xuất từ nơi khác hay chồng nhau vài mili giây — cắt câu trước cho khỏi đè câu sau.
  for (let i = 0; i < created.length - 1; i++) {
    if (created[i].endMs > created[i + 1].startMs) {
      created[i].endMs = Math.max(created[i].startMs + MIN_MS, created[i + 1].startMs);
    }
  }

  const beforeMs = videoMeta(p).durationMs;
  const next: ShortProps = {
    ...p,
    captions: [...(opts.replace ? [] : p.captions), ...created].sort((a, b) => a.startMs - b.startMs),
  };
  const grewMs = videoMeta(next).durationMs - beforeMs;
  const untimed = rows.filter((c) => c.startMs === null).length;

  const parts = [
    `Đã nhập ${created.length} câu`,
    opts.replace ? " (thay toàn bộ phụ đề cũ)" : ` vào hàng Phụ đề ${track + 1}`,
    untimed === rows.length
      ? " — file không có mốc giờ nên thời gian rải theo độ dài câu, kéo trên timeline để chỉnh."
      : untimed > 0
        ? ` — ${untimed} câu không có mốc giờ, đã rải nối tiếp nhau.`
        : ".",
    grewMs > 500 ? ` Video dài thêm ${(grewMs / 1000).toFixed(1)}s vì phụ đề kéo tới đó.` : "",
  ];
  return {
    props: next,
    selection: { type: "caption", index: next.captions.indexOf(created[0]) },
    message: parts.join(""),
  };
};

/** Xoá một câu phụ đề. */
export const deleteCaption = (p: ShortProps, index: number): Result => ({
  props: { ...p, captions: p.captions.filter((_, k) => k !== index) },
  selection: null,
});

/** Gỡ các khoá cho trước khỏi kiểu riêng của một câu; hết khoá thì về null (theo kiểu chung). */
const withoutLookKeys = (style: Caption["style"], keys: string[]): Caption["style"] => {
  if (!style) return null;
  const rest = Object.fromEntries(Object.entries(style).filter(([key]) => !keys.includes(key)));
  return Object.keys(rest).length > 0 ? (rest as Caption["style"]) : null;
};

/**
 * Đổi kiểu phụ đề (kiểu CapCut). `indices` null = tất cả: ghi vào kiểu chung của video và gỡ đúng các
 * khoá đó khỏi kiểu riêng từng câu, để câu nào cũng theo giá trị mới. Có danh sách = chỉ ghi đè các câu đó.
 */
export const applyCaptionLook = (p: ShortProps, indices: number[] | null, patch: Partial<CaptionLook>): ShortProps => {
  if (indices === null) {
    const keys = Object.keys(patch);
    return {
      ...p,
      captionLook: { ...(p.captionLook ?? {}), ...patch },
      captions: p.captions.map((c) => ({ ...c, style: withoutLookKeys(c.style, keys) })),
    };
  }
  const chosen = new Set(indices);
  return {
    ...p,
    captions: p.captions.map((c, k) => (chosen.has(k) ? { ...c, style: { ...(c.style ?? {}), ...patch } } : c)),
  };
};

/**
 * Đổi kiểu văn bản tự do bằng cùng bảng chỉnh với phụ đề. `indices` null = tất cả văn bản; khi áp cho tất
 * cả thì bỏ vị trí (x/y) khỏi patch — dời mọi văn bản về cùng một chỗ là chồng chúng lên nhau.
 */
export const applyTextLook = (p: ShortProps, indices: number[] | null, patch: Partial<CaptionLook>): ShortProps => {
  const { x, y, ...rest } = patch;
  const change = textPatch(indices === null ? rest : { ...rest, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) });
  const chosen = indices === null ? null : new Set(indices);
  return { ...p, texts: p.texts.map((t, k) => (chosen === null || chosen.has(k) ? { ...t, ...change } : t)) };
};

/** Bỏ mọi kiểu tuỳ chỉnh — phụ đề về lại kiểu của phong cách. */
export const clearCaptionLooks = (p: ShortProps): ShortProps => ({
  ...p,
  captionLook: null,
  captions: p.captions.map((c) => ({ ...c, style: null })),
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
      // Mốc chuyển động là mốc tuyệt đối — dời cùng cảnh để hình chạy y như trước khi đổi chỗ.
      keyframes: shiftKeys(s.keyframes, delta[k]),
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
      // Lớp chồng cũng đi theo đoạn thời gian của cảnh — đang đè lên cảnh nào thì vẫn đè cảnh đó.
      overlays: overlaysOf(p).map((o) => {
        const d = delta[segmentOf(o.startMs)];
        return { ...o, startMs: r(o.startMs + d), endMs: r(o.endMs + d) };
      }),
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
  updateScene(p, i, { image: src, trimStartMs: 0, speed: undefined });

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

/** Chèn một ảnh/video thành cảnh mới ngay sau cảnh `index` — các cảnh sau tự lùi lại. */
export const insertSceneAfter = (p: ShortProps, index: number, src: string, durationMs: number): Result => {
  const at = Math.max(0, Math.min(p.scenes.length - 1, index));
  const previous = p.scenes[at];
  const startMs = previous ? previous.endMs : 0;
  const length = Math.max(MIN_MS, durationMs);
  const scene: Scene = {
    image: src,
    visual: null,
    tag: null,
    punch: null,
    trimStartMs: 0,
    volume: isVideo(src) ? 1 : 0,
    crop: null,
    ...noMotion(),
    startMs,
    endMs: r(startMs + length),
  };
  const after = p.scenes.slice(at + 1).map((s) => ({ ...s, startMs: r(s.startMs + length), endMs: r(s.endMs + length) }));
  return {
    props: { ...p, scenes: [...p.scenes.slice(0, at + 1), scene, ...after] },
    selection: { type: "scene", index: at + 1 },
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
  // Phần file còn lại sau điểm cắt, quy ra thời gian trên timeline theo tốc độ của cảnh.
  const available = sourceMs > 0 ? Math.max(MIN_MS, (sourceMs - s.trimStartMs) / clipSpeed(s)) : sceneLength;
  const clip: AudioClip = {
    src: audioSrc,
    startMs: s.startMs,
    trimStartMs: s.trimStartMs,
    durationMs: r(Math.min(sceneLength, available)),
    volume: s.volume > 0 ? s.volume : 1,
    speed: s.speed,
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
    // d tính trên timeline; phần cắt đầu tính theo file gốc nên nhân tốc độ.
    const speed = clipSpeed(c);
    const d = Math.min(c.durationMs - MIN_MS, Math.max(deltaMs, -c.trimStartMs / speed, -c.startMs));
    return withClip(p, i, {
      ...c,
      startMs: r(c.startMs + d),
      trimStartMs: r(c.trimStartMs + d * speed),
      durationMs: r(c.durationMs - d),
    });
  }
  return withClip(p, i, { ...c, durationMs: r(Math.max(MIN_MS, c.durationMs + deltaMs)) });
};

export const updateClip = (p: ShortProps, i: number, patch: Partial<AudioClip>): ShortProps =>
  withClip(p, i, { ...p.audioClips[i], ...patch });

// ---------- tốc độ ----------

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

/** Tốc độ phát của cảnh video / đoạn âm thanh; không có = 1. */
export const clipSpeed = (item: { speed?: number }) => item.speed ?? 1;

const clampSpeed = (speed: number) => Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed)) * 100) / 100;

/**
 * Đổi tốc độ cảnh video kiểu CapCut: giữ nguyên đoạn clip đang dùng, độ dài cảnh trên timeline đổi theo
 * (2x → ngắn một nửa) và các cảnh sau dời theo. Tốc độ 1 thì bỏ trường cho gọn props.json.
 */
export const setSceneSpeed = (p: ShortProps, i: number, speed: number): ShortProps => {
  const s = p.scenes[i];
  if (!s) return p;
  const next = clampSpeed(speed);
  const lengthMs = Math.max(MIN_MS, ((s.endMs - s.startMs) * clipSpeed(s)) / next);
  return setSceneLength(updateScene(p, i, { speed: next === 1 ? undefined : next }), i, lengthMs);
};

/** Đổi tốc độ đoạn âm thanh: giữ nguyên đoạn file đang dùng, độ dài trên timeline đổi theo. */
export const setClipSpeed = (p: ShortProps, i: number, speed: number): ShortProps => {
  const c = p.audioClips[i];
  if (!c) return p;
  const next = clampSpeed(speed);
  return withClip(p, i, {
    ...c,
    speed: next === 1 ? undefined : next,
    durationMs: r(Math.max(MIN_MS, (c.durationMs * clipSpeed(c)) / next)),
  });
};

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

// ---------- lớp video chồng (nhiều thanh video đè nhau) ----------

const withOverlay = (p: ShortProps, i: number, overlay: MediaOverlay): ShortProps => ({
  ...p,
  overlays: overlaysOf(p).map((x, k) => (k === i ? overlay : x)),
});

/** Tên hàng của một video trên timeline: hàng dưới cùng là "Video 1". */
export const overlayName = (o: MediaOverlay | undefined) => `Video ${(o?.track ?? 0) + 1}`;

/** Dự án có cảnh nào mang hình không. */
export const hasSceneMedia = (p: ShortProps) => p.scenes.some((s) => Boolean(s.image));

/**
 * Timeline có cần hiện hàng Cảnh không. Không cần khi cảnh đã gộp hết vào các hàng Video và chỉ còn
 * MỘT cảnh rỗng làm nền đen — lúc đó mọi thứ trên timeline là video, không còn hai loại.
 * Vẫn hiện khi còn nhiều cảnh rỗng, vì nhãn / câu nhấn / hình vẽ của phong cách gắn theo từng cảnh.
 */
export const sceneRowVisible = (p: ShortProps) => hasSceneMedia(p) || p.scenes.length > 1;

/** Số hàng video chồng đang có (0 = chưa có lớp nào). */
export const overlayTrackCount = (p: ShortProps) => overlaysOf(p).reduce((m, o) => Math.max(m, o.track + 1), 0);

/** Hàng thấp nhất còn trống trong khoảng [start, end] — lớp mới không đè lớp cũ trên timeline. */
export const overlayFreeTrack = (p: ShortProps, startMs: number, endMs: number, ignore = -1) => {
  for (let track = 0; ; track++) {
    const busy = overlaysOf(p).some((o, k) => k !== ignore && o.track === track && o.startMs < endMs && o.endMs > startMs);
    if (!busy) return track;
  }
};

/** Dời lớp theo thời gian; `track` có thì đổi luôn hàng (kéo lên/xuống trên timeline). */
export const moveOverlay = (p: ShortProps, i: number, deltaMs: number, track?: number): ShortProps => {
  const o = overlaysOf(p)[i];
  if (!o) return p;
  const d = Math.max(-o.startMs, deltaMs);
  return withOverlay(p, i, {
    ...o,
    startMs: r(o.startMs + d),
    endMs: r(o.endMs + d),
    // Mốc chuyển động đi theo lớp, nếu không thì dời lớp một cái là chuyển động lệch hết.
    keyframes: overlayKeyframes(o).map((k) => ({ ...k, atMs: Math.max(0, r(k.atMs + d)) })),
    track: track === undefined ? o.track : Math.max(0, Math.round(track)),
  });
};

/**
 * Mép trái = lớp bắt đầu muộn hơn (video thì cắt luôn phần đầu file); mép phải = đổi độ dài.
 * Khác cảnh: lớp không phải nối liền lớp bên cạnh nên kéo mép không đụng lớp nào khác.
 */
export const resizeOverlay = (p: ShortProps, i: number, edge: "l" | "r", deltaMs: number): ShortProps => {
  const o = overlaysOf(p)[i];
  if (!o) return p;
  if (edge === "r") return withOverlay(p, i, { ...o, endMs: r(Math.max(o.startMs + MIN_MS, o.endMs + deltaMs)) });
  const speed = clipSpeed(o);
  const video = isVideo(o.src);
  // deltaMs tính trên timeline; phần cắt đầu tính theo file gốc nên nhân tốc độ.
  const floor = video ? Math.max(-o.startMs, -o.trimStartMs / speed) : -o.startMs;
  const d = Math.min(o.endMs - o.startMs - MIN_MS, Math.max(deltaMs, floor));
  return withOverlay(p, i, {
    ...o,
    startMs: r(o.startMs + d),
    trimStartMs: video ? r(o.trimStartMs + d * speed) : o.trimStartMs,
  });
};

/**
 * Sau khi thả một lớp vừa kéo: nếu nó đè lên lớp khác TRÊN CÙNG MỘT HÀNG thì đẩy lên hàng trống
 * gần nhất. Hai lớp vẫn đè nhau trên khung hình được — chỉ là mỗi hàng timeline giữ một khối ở
 * mỗi mốc thời gian, nên không có khối nào bị khối khác che mất.
 */
export const settleOverlay = (p: ShortProps, i: number): ShortProps => {
  const list = overlaysOf(p);
  const o = list[i];
  if (!o) return p;
  const clash = (track: number) =>
    list.some((x, k) => k !== i && x.track === track && x.startMs < o.endMs && x.endMs > o.startMs);
  if (!clash(o.track)) return p;
  let track = o.track + 1;
  while (clash(track)) track += 1;
  return withOverlay(p, i, { ...o, track });
};

export const updateOverlay = (p: ShortProps, i: number, patch: Partial<MediaOverlay>): ShortProps => {
  const o = overlaysOf(p)[i];
  return o ? withOverlay(p, i, { ...o, ...patch }) : p;
};

/** Đổi tốc độ lớp: giữ nguyên đoạn file đang dùng, độ dài trên timeline đổi theo (2x → ngắn một nửa). */
/** Dung sai khi tìm mốc tại đầu phát: bấm ghim hai lần gần nhau thì sửa mốc cũ, không tạo mốc trùng. */
export const KEYFRAME_SNAP_MS = 60;

/** Đầu phát đang đứng đúng một mốc chuyển động của lớp? Dùng để nút ◆ biết ghim hay bỏ mốc. */
export const overlayKeyframeAt = (o: MotionTarget, atMs: number) =>
  overlayKeyframes(o).find((k) => Math.abs(k.atMs - atMs) <= KEYFRAME_SNAP_MS) ?? null;

/** Mục có chuyển động: một cảnh của phong cách, hay một video trên timeline. Hai loại chỉnh y như nhau. */
export type MotionSel = { type: "scene" | "overlay"; index: number };

/** Lọc một Selection xuống mục có chuyển động; không phải cảnh/lớp thì null. */
export const motionSelOf = (sel: Selection): MotionSel | null =>
  sel && "index" in sel && (sel.type === "scene" || sel.type === "overlay")
    ? { type: sel.type, index: sel.index }
    : null;

/** File ảnh/video của một cảnh (`image`) hay một lớp (`src`) — hai tên khác nhau, cùng ý nghĩa. */
export const mediaSrcOf = (item: Scene | MediaOverlay) => ("src" in item ? item.src : item.image);

export const motionItem = (p: ShortProps, sel: MotionSel): Scene | MediaOverlay | null =>
  (sel.type === "scene" ? p.scenes[sel.index] : overlaysOf(p)[sel.index]) ?? null;

/** Tên gọi trong thông báo: "Cảnh 2" (hàng Cảnh của phong cách) hay "Video 3" (một video trên timeline). */
export const motionLabel = (p: ShortProps, sel: MotionSel) =>
  sel.type === "scene" ? `Cảnh ${sel.index + 1}` : overlayName(overlaysOf(p)[sel.index]);

type MotionPatch = Partial<OverlayTransform> & { keyframes?: OverlayKeyframe[] };

const withMotion = (p: ShortProps, sel: MotionSel, patch: MotionPatch): ShortProps =>
  sel.type === "scene" ? updateScene(p, sel.index, patch) : updateOverlay(p, sel.index, patch);

/**
 * Ghim một mốc chuyển động cho cảnh/lớp tại `atMs`: chụp lại vị trí/cỡ/góc/độ mờ đang thấy.
 * Mốc đầu tiên ghim cả giá trị tĩnh hiện tại nên hình không nhảy khi bắt đầu có keyframe.
 */
export const setKeyframe = (p: ShortProps, sel: MotionSel, atMs: number, patch?: Partial<OverlayTransform>): Result => {
  const item = motionItem(p, sel);
  if (!item) return { props: p };
  const at = Math.max(0, r(atMs));
  const value = { ...overlayTransformAt(item, at), ...patch };
  const keys = overlayKeyframes(item).filter((k) => Math.abs(k.atMs - at) > KEYFRAME_SNAP_MS);
  const keyframes = [...keys, { atMs: at, ...value }].sort((a, b) => a.atMs - b.atMs);
  return {
    props: withMotion(p, sel, { keyframes }),
    selection: sel,
    message: `Đã ghim mốc ${(at / 1000).toFixed(1)}s cho ${motionLabel(p, sel)} (${keyframes.length} mốc) — dời đầu phát, kéo hình rồi ghim tiếp để nó chạy.`,
  };
};

/** Xoá mốc gần `atMs` nhất (trong dung sai) — không có mốc nào ở đó thì báo lại. */
export const deleteKeyframe = (p: ShortProps, sel: MotionSel, atMs: number): Result => {
  const item = motionItem(p, sel);
  if (!item) return { props: p };
  const keys = overlayKeyframes(item);
  const found = keys.find((k) => Math.abs(k.atMs - atMs) <= KEYFRAME_SNAP_MS);
  if (!found) return { props: p, message: "Đầu phát không nằm ở mốc nào — dời tới đúng mốc ◆ rồi xoá." };
  return {
    props: withMotion(p, sel, { keyframes: keys.filter((k) => k !== found) }),
    selection: sel,
    message: `Đã xoá mốc ${(found.atMs / 1000).toFixed(1)}s.`,
  };
};

/** Bỏ toàn bộ chuyển động: hình đứng yên tại chỗ đang thấy (giữ đúng hình hiện tại làm giá trị tĩnh). */
export const clearKeyframes = (p: ShortProps, sel: MotionSel, atMs: number): Result => {
  const item = motionItem(p, sel);
  if (!item || overlayKeyframes(item).length === 0) return { props: p };
  return {
    props: withMotion(p, sel, { ...overlayTransformAt(item, atMs), keyframes: [] }),
    selection: sel,
    message: "Đã bỏ chuyển động — hình đứng yên.",
  };
};

/**
 * Kéo/thu phóng cảnh hoặc lớp trên khung xem trước. Đã có mốc chuyển động thì ghi vào mốc tại đầu phát
 * (tạo mốc mới nếu chỗ đó chưa có) — như các trình chỉnh sửa khác; chưa có mốc thì sửa giá trị tĩnh.
 */
export const transformItem = (p: ShortProps, sel: MotionSel, patch: Partial<OverlayTransform>, atMs: number): ShortProps => {
  const item = motionItem(p, sel);
  if (!item) return p;
  if (overlayKeyframes(item).length === 0) return withMotion(p, sel, patch);
  return setKeyframe(p, sel, atMs, patch).props;
};

/** Đặt lại hình về đúng khung, không xoay, không mờ — và bỏ luôn chuyển động. */
export const resetMotion = (p: ShortProps, sel: MotionSel): Result => ({
  props: withMotion(p, sel, { x: 50, y: 50, width: 100, rotate: 0, opacity: 1, keyframes: [] }),
  selection: sel,
  message: `Đã đưa ${motionLabel(p, sel)} về đúng khung.`,
});

// Tên cũ dành riêng cho lớp đè — giữ lại để chỗ nào đang gọi vẫn chạy.
export const setOverlayKeyframe = (p: ShortProps, i: number, atMs: number, patch?: Partial<OverlayTransform>) =>
  setKeyframe(p, { type: "overlay", index: i }, atMs, patch);
export const deleteOverlayKeyframe = (p: ShortProps, i: number, atMs: number) =>
  deleteKeyframe(p, { type: "overlay", index: i }, atMs);
export const clearOverlayKeyframes = (p: ShortProps, i: number, atMs: number) =>
  clearKeyframes(p, { type: "overlay", index: i }, atMs);
export const transformOverlay = (p: ShortProps, i: number, patch: Partial<OverlayTransform>, atMs: number) =>
  transformItem(p, { type: "overlay", index: i }, patch, atMs);

export const setOverlaySpeed = (p: ShortProps, i: number, speed: number): ShortProps => {
  const o = overlaysOf(p)[i];
  if (!o) return p;
  const next = clampSpeed(speed);
  const lengthMs = Math.max(MIN_MS, ((o.endMs - o.startMs) * clipSpeed(o)) / next);
  return withOverlay(p, i, { ...o, speed: next === 1 ? undefined : next, endMs: r(o.startMs + lengthMs) });
};

/**
 * Thêm một lớp video/ảnh chồng tại mốc `atMs`. `track` bỏ trống thì tự chọn hàng còn trống
 * để lớp mới không đè lớp cũ trên timeline (trên khung hình thì vẫn đè nhau được).
 */
export const addOverlay = (
  p: ShortProps,
  src: string,
  atMs: number,
  durationMs: number,
  track?: number,
): Result => {
  const startMs = r(atMs);
  const endMs = r(startMs + Math.max(MIN_MS, durationMs));
  const meta = videoMeta(p);
  const overlay: MediaOverlay = {
    src,
    startMs,
    endMs,
    trimStartMs: 0,
    // Clip thêm tay thường là video quay sẵn — giữ tiếng gốc. Ảnh thì không có tiếng.
    volume: isVideo(src) ? 1 : 0,
    track: track === undefined ? overlayFreeTrack(p, startMs, endMs) : Math.max(0, Math.round(track)),
    // Mặc định phủ kín khung và KHÔNG cắt hình: thấy trọn video, chỗ trống là nền đen của khung đã chọn.
    // Muốn video nhỏ lại (kiểu PiP) thì kéo tay nắm góc trên khung xem trước.
    x: 50,
    y: 50,
    width: 100,
    aspect: Math.round((meta.width / meta.height) * 1000) / 1000,
    rotate: 0,
    opacity: 1,
    radius: 0,
    fit: "contain",
    crop: null,
    fadeMs: 0,
    keyframes: [],
  };
  return {
    props: { ...p, overlays: [...overlaysOf(p), overlay] },
    selection: { type: "overlay", index: overlaysOf(p).length },
    message: `Đã thêm ${overlayName(overlay)} tại ${(startMs / 1000).toFixed(1)}s — kéo trên khung xem trước để đặt vị trí, kéo tay nắm góc để thu phóng.`,
  };
};

/**
 * Nối một video/ảnh vào CUỐI hàng Video 1 (sau clip cuối cùng trên hàng đó) — cách dựng tuần tự
 * "clip này rồi clip kia". Video dài thêm đúng độ dài clip.
 */
export const appendOverlay = (p: ShortProps, src: string, durationMs: number): Result => {
  const onTrack0 = overlaysOf(p).filter((o) => o.track === 0);
  const startMs = onTrack0.reduce((m, o) => Math.max(m, o.endMs), 0);
  const added = addOverlay(p, src, startMs, durationMs, 0);
  return {
    ...added,
    message: `Đã nối “${src.split("/").pop()}” vào cuối Video 1 tại ${(startMs / 1000).toFixed(1)}s.`,
  };
};

/**
 * Gộp hàng Cảnh vào các hàng Video: mỗi cảnh có hình thành MỘT VIDEO trên timeline, đúng mốc thời
 * gian cũ và mang theo cắt đầu / tốc độ / âm lượng / crop / chuyển động. Các video đang có dời lên
 * một hàng để giữ đúng thứ tự vẽ (cảnh vốn nằm dưới mọi video).
 *
 * Phong cách "Video gốc" (phong cách của trình chỉnh sửa) vẽ cảnh đúng bằng cách này nên hình không
 * đổi gì; phong cách khác thì mất phần khung trang trí của nó (ô truyện tranh, ảnh polaroid, Ken
 * Burns…) — bù lại mọi clip chỉnh y như nhau. Nhãn / câu nhấn / hình vẽ của cảnh vẫn giữ nguyên.
 */
export const unifyScenes = (p: ShortProps): Result => {
  const count = p.scenes.filter((s) => s.image).length;
  if (count === 0) return { props: p };
  const meta = videoMeta(p);
  const aspect = Math.round((meta.width / meta.height) * 1000) / 1000;
  // "Video gốc" đặt hình vừa khung (không cắt); phong cách khác lấp đầy khung.
  const fit = p.style === "plain" ? ("contain" as const) : ("cover" as const);

  const fromScenes: MediaOverlay[] = p.scenes
    .filter((s) => s.image)
    .map((s) => ({
      src: s.image as string,
      startMs: s.startMs,
      endMs: s.endMs,
      trimStartMs: s.trimStartMs,
      volume: s.volume,
      speed: s.speed,
      track: 0,
      x: s.x, y: s.y, width: s.width, aspect,
      rotate: s.rotate, opacity: s.opacity,
      radius: 0, fit, crop: s.crop, fadeMs: 0,
      keyframes: s.keyframes,
    }));
  // Video đang có vốn vẽ TRÊN cảnh — đẩy lên một hàng để thứ tự đè không đổi.
  const lifted = overlaysOf(p).map((o) => ({ ...o, track: o.track + 1 }));

  const emptied = p.scenes.map((s) => ({
    ...s, image: null, trimStartMs: 0, volume: 0, speed: undefined, crop: null, ...noMotion(),
  }));
  // Phong cách "Video gốc" không vẽ gì theo cảnh: gộp luôn thành một cảnh rỗng trải dài cả video
  // để timeline sạch (hàng Cảnh ẩn hẳn). Phong cách khác giữ từng cảnh cho nhãn / câu nhấn.
  const scenes = p.style === "plain"
    ? [{ ...emptied[0], startMs: 0, endMs: Math.max(1000, ...emptied.map((s) => s.endMs)), tag: null, punch: null, visual: null }]
    : emptied;

  return {
    props: { ...p, scenes, overlays: [...fromScenes, ...lifted] },
    selection: null,
    message: `Đã gộp ${count} cảnh thành ${count} video trên timeline — giờ mọi clip chỉnh như nhau.`,
  };
};

/**
 * Đưa hình của một cảnh lên lớp chồng riêng: lớp mới phủ kín khung đúng khoảng thời gian cũ,
 * cảnh trên hàng Cảnh để trống chỗ đó. Giữ nguyên mọi mốc thời gian nên phụ đề, giọng đọc và
 * các cảnh khác không lệch — chỉ khác là hình giờ kéo/thu phóng/đè lên lớp khác được.
 */
export const liftSceneToOverlay = (p: ShortProps, i: number, track?: number): Result => {
  const s = p.scenes[i];
  if (!s?.image) return { props: p, message: "Cảnh này chưa có ảnh/video để đưa lên lớp riêng." };
  const meta = videoMeta(p);
  const overlay: MediaOverlay = {
    src: s.image,
    startMs: s.startMs,
    endMs: s.endMs,
    trimStartMs: s.trimStartMs,
    volume: s.volume,
    speed: s.speed,
    track: track === undefined ? overlayFreeTrack(p, s.startMs, s.endMs) : Math.max(0, Math.round(track)),
    // Cảnh và lớp dùng cùng hệ toạ độ (x/y/width tính theo % khung) nên chuyển lên là giữ y nguyên hình.
    x: s.x,
    y: s.y,
    width: s.width,
    aspect: Math.round((meta.width / meta.height) * 1000) / 1000,
    rotate: s.rotate,
    opacity: s.opacity,
    radius: 0,
    // "Video gốc" để hình vừa khung; các phong cách khác lấp đầy khung — giữ đúng như cảnh đang vẽ.
    fit: p.style === "plain" ? "contain" : "cover",
    crop: s.crop,
    fadeMs: 0,
    keyframes: s.keyframes,
  };
  const emptied = updateScene(p, i, {
    image: null, trimStartMs: 0, volume: 0, speed: undefined, crop: null, ...noMotion(),
  });
  return {
    props: { ...emptied, overlays: [...overlaysOf(p), overlay] },
    selection: { type: "overlay", index: overlaysOf(p).length },
    message: `Đã đưa hình cảnh ${i + 1} thành ${overlayName(overlay)} — chỗ cũ trên hàng Cảnh để trống.`,
  };
};

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
        keyframes: mapKeys(s.keyframes, map),
      })),
    audioClips: p.audioClips.map((c) => ({ ...c, startMs: map(c.startMs) })),
    texts: p.texts.map((t) => ({ ...t, startMs: map(t.startMs), endMs: map(t.endMs) })),
    overlays: overlaysOf(p).map((o) => ({ ...o, startMs: map(o.startMs), endMs: map(o.endMs) })),
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
    // Nửa sau giữ kiểu chữ riêng của câu gốc, nhưng không mang giọng đọc.
    const second: Caption = { text: words.slice(k).join(" "), startMs: t, endMs: c.endMs, audio: null, style: c.style ?? null, track: c.track };
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
    const second: AudioClip = { ...c, startMs: t, trimStartMs: r(c.trimStartMs + offset * clipSpeed(c)), durationMs: c.durationMs - offset };
    const audioClips = [...p.audioClips];
    audioClips.splice(sel.index, 1, first, second);
    return { props: { ...p, audioClips }, selection: { type: "clip", index: sel.index + 1 }, message: "Đã tách âm thanh." };
  }

  if (sel && "index" in sel && sel.type === "overlay") {
    const o = overlaysOf(p)[sel.index];
    if (!o || tooClose(o.startMs, o.endMs)) return { props: p, message: "Đưa đầu phát vào giữa lớp video cần tách." };
    const offset = t - o.startMs;
    // Mốc chuyển động về đúng nửa chứa nó; nửa không còn mốc nào thì chốt lại hình đang thấy.
    const keysBefore = (o.keyframes ?? []).filter((k) => k.atMs < t);
    const keysAfter = (o.keyframes ?? []).filter((k) => k.atMs >= t);
    const at = overlayTransformAt(o, t);
    const first: MediaOverlay = {
      ...o,
      endMs: t,
      keyframes: keysBefore,
      ...(keysAfter.length && !keysBefore.length ? at : {}),
    };
    const second: MediaOverlay = {
      ...o,
      startMs: t,
      trimStartMs: isVideo(o.src) ? r(o.trimStartMs + offset * clipSpeed(o)) : o.trimStartMs,
      keyframes: keysAfter,
      ...(keysBefore.length && !keysAfter.length ? at : {}),
    };
    const overlays = [...overlaysOf(p)];
    overlays.splice(sel.index, 1, first, second);
    return { props: { ...p, overlays }, selection: { type: "overlay", index: sel.index + 1 }, message: "Đã tách lớp video thành hai." };
  }

  const i = sel && "index" in sel && sel.type === "scene" ? sel.index : sceneIndexAt(p, t);
  const s = p.scenes[i];
  if (!s || tooClose(s.startMs, s.endMs)) return { props: p, message: "Đưa đầu phát vào giữa cảnh cần tách." };
  // Mốc chuyển động về đúng nửa chứa nó; nửa nào không còn mốc nào thì chốt lại hình đang thấy.
  const keysBefore = (s.keyframes ?? []).filter((k) => k.atMs < t);
  const keysAfter = (s.keyframes ?? []).filter((k) => k.atMs >= t);
  const at = overlayTransformAt(s, t);
  const first: Scene = clampPunch({
    ...s,
    endMs: t,
    punch: s.punch && s.punch.atMs < t ? s.punch : null,
    keyframes: keysBefore,
    ...(keysAfter.length && !keysBefore.length ? at : {}),
  });
  const second: Scene = clampPunch({
    ...s,
    startMs: t,
    trimStartMs: isVideo(s.image) ? r(s.trimStartMs + (t - s.startMs) * clipSpeed(s)) : s.trimStartMs,
    punch: s.punch && s.punch.atMs >= t ? s.punch : null,
    keyframes: keysAfter,
    ...(keysBefore.length && !keysAfter.length ? at : {}),
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
  if (sel.type === "overlay") {
    return {
      props: { ...p, overlays: overlaysOf(p).filter((_, k) => k !== sel.index) },
      selection: null,
      message: "Đã xoá video khỏi timeline.",
    };
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
      trimStartMs: headCut && isVideo(s.image) ? r(s.trimStartMs + (b - s.startMs) * clipSpeed(s)) : s.trimStartMs,
      punch,
      // Mốc nằm trong đoạn bị cắt thì bỏ; mốc còn lại dời theo như mọi mốc thời gian khác.
      keyframes: (s.keyframes ?? []).filter((k) => k.atMs < a || k.atMs >= b).map((k) => ({ ...k, atMs: map(k.atMs) })),
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
    return [{ ...c, startMs, durationMs: newEnd - startMs, trimStartMs: headCut ? r(c.trimStartMs + (b - c.startMs) * clipSpeed(c)) : c.trimStartMs }];
  });

  const texts = p.texts.flatMap((t) => {
    if (t.startMs >= a && t.endMs <= b) return [];
    const startMs = map(t.startMs);
    const endMs = map(t.endMs);
    return endMs - startMs < 100 ? [] : [{ ...t, startMs, endMs }];
  });

  // Lớp video chồng: nằm hoàn toàn trong đoạn cắt thì mất; bị cắt mất đầu thì cắt thêm phần đầu file.
  const overlays = overlaysOf(p).flatMap((o) => {
    if (o.startMs >= a && o.endMs <= b) return [];
    const startMs = map(o.startMs);
    const endMs = map(o.endMs);
    if (endMs - startMs < 100) return [];
    const headCut = o.startMs >= a && o.startMs < b;
    return [{
      ...o,
      startMs,
      endMs,
      trimStartMs: headCut && isVideo(o.src) ? r(o.trimStartMs + (b - o.startMs) * clipSpeed(o)) : o.trimStartMs,
      keyframes: (o.keyframes ?? []).filter((k) => k.atMs < a || k.atMs >= b).map((k) => ({ ...k, atMs: map(k.atMs) })),
    }];
  });

  const notes = [`Đã cắt bỏ ${(len / 1000).toFixed(1)}s.`];
  if (voiceDropped) notes.push(`${voiceDropped} câu bị cắt mất đầu nên bỏ giọng đọc của câu đó.`);
  if (a === 0 && p.showTitle) notes.push("Đã tắt title card vì phần đầu video bị cắt.");

  return {
    props: { ...p, captions, scenes: scenes.map(clampPunch), audioClips, texts, overlays, showTitle: a === 0 ? false : p.showTitle },
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
  overlaysOf(p).forEach((o, k) => {
    if (`overlay-${k}` !== excludeKey) edges.push(o.startMs, o.endMs);
  });
  return edges;
};

/** Một khung hình dài bao nhiêu ms — mốc nhỏ nhất có nghĩa khi kéo (video không có "giữa hai frame"). */
const MS_PER_FRAME = 1000 / FPS;

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
  // Không hít vào mốc nào thì làm tròn về khung hình gần nhất: kéo mượt ở mọi mức thu phóng
  // (bước 50ms cũ ở mức phóng to là nhảy 16px một lần).
  return best === target ? Math.round(target / MS_PER_FRAME) * MS_PER_FRAME : best;
};
