import { Player, type PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Short } from "../../src/compositions/Short";
import type { SceneCrop, ShortProps, TextOverlay } from "../../src/compositions/Short/schema";
import { isMediaCrop } from "../../src/scenes/CropBox";
import {
  api, fmt, followJob, mediaDurationMs, postJson, uploadFile,
  type MediaItem, type SubtitleOptions, type VoiceOption,
} from "./api";
import { CropOverlay } from "./CropOverlay";
import { Inspector } from "./Inspector";
import { MediaPanel, type LibrarySection } from "./MediaPanel";
import * as ops from "./ops";
import { StageOverlay } from "./StageOverlay";
import { Timeline, type EditPhase } from "./Timeline";

type SaveState = "saved" | "dirty" | "saving" | "error";
type JobState =
  | { status: "idle" }
  | { status: "running"; title: string; percent: number | null; line: string }
  | { status: "exported"; mp4: string }
  | { status: "error"; title: string; message: string };

const FPS = 30;
const same = (a: ShortProps, b: ShortProps) => JSON.stringify(a) === JSON.stringify(b);

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
const LIB_SECTIONS: LibrarySection[] = ["visual", "audio", "text", "captions", "ai"];

/** Bảng phím tắt — hiện trong hộp ⌨ (phím ? hoặc ⌘/), menu Trợ giúp của app desktop mở cùng hộp này. */
const SHORTCUTS: [string, [string[], string][]][] = [
  ["Phát", [
    [["Space"], "Phát / dừng"],
    [["K"], "Phát / dừng"],
    [["J"], "Lùi 5 giây"],
    [["L"], "Tới 5 giây"],
    [["←", "→"], "Lùi / tới 1 khung hình"],
    [["Shift", "← →"], "Lùi / tới 1 giây"],
    [["↑", "↓"], "Về cảnh trước / cảnh sau"],
    [["Home", "End"], "Về đầu / cuối video"],
    [["F"], "Xem toàn màn hình"],
  ]],
  ["Chỉnh sửa", [
    [["S"], "Tách tại đầu phát"],
    [[MOD, "B"], "Tách tại đầu phát"],
    [["Q"], "Cắt trái — xoá từ đầu tới đầu phát"],
    [["W"], "Cắt phải — xoá từ đầu phát tới hết"],
    [["Delete"], "Xoá mục đang chọn"],
    [["T"], "Thêm văn bản"],
    [["C"], "Thêm phụ đề"],
    [[MOD, "D"], "Nhân đôi văn bản"],
    [[MOD, "C / V"], "Sao chép / dán văn bản"],
    [[MOD, "Z"], "Hoàn tác"],
    [[MOD, "Shift", "Z"], "Làm lại"],
    [["Esc"], "Bỏ chọn"],
  ]],
  ["Timeline & thư viện", [
    [["=", "−"], "Phóng to / thu nhỏ timeline"],
    [["Shift", "Z"], "Vừa khung — thấy cả video"],
    [["Alt", "1…5"], "Ảnh/Video · Âm thanh · Văn bản · Phụ đề · Video AI"],
  ]],
  ["Dự án", [
    [[MOD, "S"], "Lưu ngay"],
    [[MOD, "I"], "Nhập ảnh / video / âm thanh"],
    [[MOD, "E"], "Xuất video"],
    [["?"], "Mở bảng phím tắt"],
    [[MOD, "/"], "Mở bảng phím tắt"],
  ]],
];

/**
 * Trình chỉnh sửa kiểu CapCut cho một video: xem trước bằng Remotion Player (chính
 * composition dùng để render, nên thấy gì xuất ra nấy), timeline nhiều track,
 * bảng thuộc tính, thư viện media. Mọi thay đổi ghi thẳng vào props.json.
 */
export const Editor: React.FC<{ slug: string }> = ({ slug }) => {
  const [props, setProps] = useState<ShortProps | null>(null);
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<ops.Selection>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(80);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [toast, setToast] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  /** Watermark theo Cài đặt — không nằm trong props.json, chỉ gắn vào khung xem trước. */
  const [watermark, setWatermark] = useState<ShortProps["watermark"]>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobState>({ status: "idle" });
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const [showKeys, setShowKeys] = useState(false);
  /** Tăng lên để timeline tự thu phóng vừa khung (Shift+Z). */
  const [fitRequest, setFitRequest] = useState(0);
  /** Phím Alt+1…5: chuyển tab thư viện. */
  const [libRequest, setLibRequest] = useState<{ section: LibrarySection; at: number } | null>(null);
  /** Văn bản đã sao chép bằng ⌘C — dán lại tại đầu phát, giữ nguyên kiểu chữ. */
  const clipboard = useRef<TextOverlay | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  // Thư viện bên trái hay phải — tiện ích cho từng người, lỗi storage thì mặc định bên trái.
  const [libSide, setLibSide] = useState<"left" | "right">(() => {
    try {
      return localStorage.getItem("editorLibSide") === "right" ? "right" : "left";
    } catch {
      return "left";
    }
  });
  /** Cảnh đang chọn vùng crop (null = không ở chế độ crop). */
  const [cropScene, setCropScene] = useState<number | null>(null);
  const cropRef = useRef<number | null>(null);
  cropRef.current = cropScene;
  const toggleLibSide = () => {
    setLibSide((side) => {
      const next = side === "left" ? "right" : "left";
      try {
        localStorage.setItem("editorLibSide", next);
      } catch {
        /* bỏ qua */
      }
      return next;
    });
  };

  const playerRef = useRef<PlayerRef>(null);
  const propsRef = useRef<ShortProps | null>(null);
  propsRef.current = props;
  const selectionRef = useRef<ops.Selection>(null);
  selectionRef.current = selection;
  // Cập nhật ref ngay lập tức: nhấn rồi thả chuột nhanh thì bước "thả" (commit)
  // chạy trước khi React vẽ lại — đọc ref cũ sẽ xoá mất lựa chọn vừa bấm.
  const select = useCallback((next: ops.Selection) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);
  const frameRef = useRef(0);
  frameRef.current = frame;
  const jobRef = useRef(job);
  jobRef.current = job;
  const history = useRef({ past: [] as ShortProps[], future: [] as ShortProps[], lastKey: null as string | null, lastAt: 0 });
  const dragBase = useRef<ShortProps | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  const refreshMedia = useCallback(() => {
    api<{ items: MediaItem[] }>("/api/media").then((d) => setMedia(d.items)).catch(() => undefined);
  }, []);

  // ---------- tải dữ liệu ----------
  useEffect(() => {
    if (!slug) {
      setLoadError("Thiếu tên video trong đường dẫn.");
      return;
    }
    api<{ props: ShortProps; title: string }>(`/api/editor/${slug}`)
      .then((d) => {
        setProps(d.props);
        setTitle(d.title);
        document.title = `Chỉnh sửa · ${d.title}`;
      })
      .catch((e: Error) => setLoadError(e.message));
    api<{ voices: { catalog: VoiceOption[] }; watermark?: ShortProps["watermark"] }>("/api/state")
      .then((d) => {
        setVoices(d.voices.catalog);
        setWatermark(d.watermark ?? null);
      })
      .catch(() => undefined);
    refreshMedia();
  }, [slug, refreshMedia]);

  const meta = useMemo(() => (props ? ops.videoMeta(props) : null), [props]);
  // Đang chọn vùng crop: xem trước cảnh đó ở dạng chưa crop để thấy toàn bộ khung.
  // Khung crop phủ cả khu xem trước và tự hiện toàn bộ file gốc — Player không cần bỏ crop.
  const previewProps = useMemo(() => (props ? { ...props, watermark } : props), [props, watermark]);
  const timeMs = (frame / FPS) * 1000;

  // ---------- Player ----------
  const ready = Boolean(meta);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [ready]);

  // Video ngắn lại mà đầu phát đang ở phần vừa bị cắt: kéo đầu phát về cuối.
  useEffect(() => {
    if (meta && frameRef.current > meta.durationInFrames - 1) {
      const last = meta.durationInFrames - 1;
      playerRef.current?.seekTo(last);
      setFrame(last);
    }
  }, [meta]);

  const seek = (ms: number) => {
    const max = (meta?.durationInFrames ?? 1) - 1;
    const target = Math.max(0, Math.min(max, Math.round((ms / 1000) * FPS)));
    playerRef.current?.seekTo(target);
    setFrame(target);
  };

  // ---------- lưu ----------
  const saveNow = useCallback(async (next: ShortProps) => {
    setSaveState("saving");
    try {
      await postJson(`/api/video/${slug}/props`, next);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      flash(`Lưu thất bại: ${(e as Error).message}`);
      throw e;
    }
  }, [slug, flash]);

  const scheduleSave = useCallback((next: ShortProps) => {
    setSaveState("dirty");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveNow(next).catch(() => undefined);
    }, 600);
  }, [saveNow]);

  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // ---------- lịch sử ----------
  const commit = useCallback((next: ShortProps, base: ShortProps, nextSelection: ops.Selection, mergeKey?: string) => {
    const normalized = ops.normalize(next, nextSelection);
    select(normalized.selection);
    setProps(normalized.props);
    if (same(base, normalized.props)) return;
    const h = history.current;
    const now = Date.now();
    // Gõ liên tục vào cùng một ô chỉ tính một bước hoàn tác.
    const merge = Boolean(mergeKey) && h.lastKey === mergeKey && now - h.lastAt < 1500;
    if (!merge) {
      h.past.push(base);
      if (h.past.length > 100) h.past.shift();
    }
    h.future = [];
    h.lastKey = mergeKey ?? null;
    h.lastAt = now;
    setHistorySize({ past: h.past.length, future: 0 });
    scheduleSave(normalized.props);
  }, [scheduleSave, select]);

  const run = (result: ops.Result) => {
    const current = propsRef.current;
    if (!current) return;
    if (result.message) flash(result.message);
    if (result.props === current) return;
    commit(result.props, current, result.selection !== undefined ? result.selection : selectionRef.current);
  };

  const undo = () => {
    const h = history.current;
    const current = propsRef.current;
    const previous = h.past.pop();
    if (!previous || !current) return;
    h.future.push(current);
    h.lastKey = null;
    setHistorySize({ past: h.past.length, future: h.future.length });
    select(null);
    setProps(previous);
    scheduleSave(previous);
  };

  const redo = () => {
    const h = history.current;
    const current = propsRef.current;
    const next = h.future.pop();
    if (!next || !current) return;
    h.past.push(current);
    h.lastKey = null;
    setHistorySize({ past: h.past.length, future: h.future.length });
    select(null);
    setProps(next);
    scheduleSave(next);
  };

  // ---------- thao tác ----------
  const nowMs = () => (frameRef.current / FPS) * 1000;
  const withProps = (fn: (current: ShortProps) => ops.Result) => {
    const current = propsRef.current;
    if (current) run(fn(current));
  };
  const split = () => withProps((p) => ops.splitAt(p, nowMs(), selectionRef.current));
  const del = () => withProps((p) => ops.deleteSelection(p, selectionRef.current));
  const trimHead = () => withProps((p) => ops.rippleDelete(p, 0, nowMs()));
  const trimTail = () => withProps((p) => ops.rippleDelete(p, nowMs(), ops.videoMeta(p).durationMs));
  const addText = () => withProps((p) => ({ ...ops.addText(p, nowMs()), message: "Đã thêm văn bản — kéo trên khung xem trước để đặt vị trí." }));
  const duplicateText = () => withProps((p) => {
    const sel = selectionRef.current;
    return sel?.type === "text" ? ops.duplicateText(p, sel.index) : { props: p, message: "Chọn một văn bản trước." };
  });
  const removeAllVoice = () => withProps((p) => ops.removeAllVoice(p));

  const appendScene = async (item: MediaItem) => {
    const duration = item.kind === "video" ? await mediaDurationMs(`/public/${item.path}`, "video") : 3000;
    withProps((p) => ops.appendScene(p, item.path, duration));
  };

  const startCrop = (index: number) => {
    const s = propsRef.current?.scenes[index];
    if (!s?.image) {
      flash("Cảnh này chưa có ảnh/video để crop.");
      return;
    }
    playerRef.current?.pause();
    const t = nowMs();
    if (t < s.startMs || t >= s.endMs) seek(s.startMs + Math.min(500, (s.endMs - s.startMs) / 2));
    select({ type: "scene", index });
    setCropScene(index);
  };

  const applyCrop = (crop: SceneCrop | null) => {
    const index = cropRef.current;
    setCropScene(null);
    if (index === null) return;
    withProps((p) => ({
      props: ops.updateScene(p, index, { crop }),
      selection: { type: "scene", index },
      message: !crop
        ? `Đã bỏ crop cảnh ${index + 1}.`
        : isMediaCrop(crop)
          ? `Đã crop cảnh ${index + 1} — lấy ${Math.round(crop.w * 100)}% × ${Math.round(crop.h * 100)}% ảnh gốc${crop.rotate ? `, xoay ${crop.rotate}°` : ""}.`
          : `Đã crop cảnh ${index + 1}.`,
    }));
  };

  /** Phụ đề tự động bằng whisper.cpp trên server. */
  const autoSubtitles = async (options: SubtitleOptions) => {
    const current = propsRef.current;
    if (!current) return;
    const title = "Đang tạo phụ đề từ âm thanh";
    setJob({ status: "running", title, percent: null, line: "Đang lưu thay đổi…" });
    try {
      window.clearTimeout(saveTimer.current);
      await saveNow(current);
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/subtitles`, options);
      setJob({ status: "running", title, percent: null, line: "Đang chuẩn bị phiên âm… (lần đầu có thể lâu hơn)" });
      followJob(
        jobId,
        (line) => {
          if (!line.startsWith("__")) setJob((s) => (s.status === "running" ? { ...s, line } : s));
        },
        (status, result, error) => {
          if (status === "done") {
            const { props: next, count, track, originalTrack, translatedTo } = result as {
              props: ShortProps; count: number; track?: number; originalTrack?: number; translatedTo?: string;
            };
            commit(next, current, null);
            setJob({ status: "idle" });
            flash(count === 0
              ? "Không nhận ra lời nói nào trong đoạn đã chọn."
              : translatedTo
                ? `Đã tạo ${count} câu dịch sang ${translatedTo} ở hàng Phụ đề ${(track ?? 0) + 1}` +
                  `${originalTrack !== undefined ? `, bản gốc ở hàng Phụ đề ${originalTrack + 1}` : ""} — soát lại câu dịch trong mục 💬 Phụ đề.`
                : `Đã tạo ${count} câu ở hàng Phụ đề ${(track ?? 0) + 1} — sửa chữ trong mục 💬 Phụ đề nếu nghe nhầm.`);
          } else {
            setJob({ status: "error", title: "Không tạo được phụ đề", message: error ?? "Lỗi không rõ." });
          }
        },
      );
    } catch (e) {
      setJob({ status: "error", title: "Không tạo được phụ đề", message: (e as Error).message });
    }
  };

  /** Tách âm thanh video bằng ffmpeg trên server. sceneIndex có → gắn ngay thành track của cảnh đó. */
  const extractAudio = async (src: string, sceneIndex?: number) => {
    setJob({ status: "running", title: "Đang tách âm thanh", percent: null, line: src.split("/").pop() ?? src });
    try {
      window.clearTimeout(saveTimer.current);
      const current = propsRef.current;
      if (current) await saveNow(current);
      const result = await postJson<{ path: string; durationMs: number }>("/api/media/extract-audio", { src });
      refreshMedia();
      setJob({ status: "idle" });
      if (sceneIndex === undefined) {
        flash("Đã tách âm thanh — xem ở 🔊 Âm thanh › Đã tải lên.");
      } else {
        withProps((p) => ops.detachAudio(p, sceneIndex, result.path, result.durationMs));
      }
    } catch (e) {
      setJob({ status: "error", title: "Không tách được âm thanh", message: (e as Error).message });
    }
  };

  /** Tách âm thanh của cảnh video ra track riêng — dùng chung cho timeline, bảng thuộc tính, thư viện. */
  const detachSceneAudio = (index: number) => {
    const src = propsRef.current?.scenes[index]?.image;
    if (src) extractAudio(src, index);
  };

  const onTimelineEdit = (next: ShortProps, phase: EditPhase) => {
    if (phase === "start") {
      dragBase.current = propsRef.current;
      return;
    }
    if (phase === "live") {
      setProps(next);
      return;
    }
    const base = dragBase.current ?? next;
    dragBase.current = null;
    commit(next, base, selectionRef.current);
  };

  const onUseMedia = async (item: MediaItem) => {
    if (item.kind === "audio") {
      const duration = await mediaDurationMs(`/public/${item.path}`, "audio");
      withProps((p) => ({
        ...ops.addClip(p, item.path, nowMs(), duration, item.name.replace(/\.\w+$/, "")),
        message: `Đã thêm “${item.name}” tại ${(nowMs() / 1000).toFixed(1)}s.`,
      }));
      return;
    }
    withProps((p) => {
      const sel = selectionRef.current;
      const index = sel && "index" in sel && sel.type === "scene" ? sel.index : ops.sceneIndexAt(p, nowMs());
      return {
        props: ops.setSceneMedia(p, index, item.path),
        selection: { type: "scene", index },
        message: `Đã gán ${item.kind === "video" ? "video" : "ảnh"} cho cảnh ${index + 1}.`,
      };
    });
  };

  /** Kéo file từ thư viện thả xuống timeline — giống CapCut. */
  const onDropMedia = async (path: string, atMs: number, sceneIndex: number | null) => {
    const item = media.find((m) => m.path === path);
    if (!item) return;
    if (item.kind === "audio") {
      const duration = await mediaDurationMs(`/public/${item.path}`, "audio");
      withProps((p) => ({
        ...ops.addClip(p, item.path, atMs, duration, item.name.replace(/\.\w+$/, "")),
        message: `Đã thêm “${item.name}” tại ${(atMs / 1000).toFixed(1)}s.`,
      }));
      return;
    }
    if (sceneIndex === null) {
      await appendScene(item);
      flash(`Đã thêm “${item.name}” thành cảnh mới ở cuối video.`);
      return;
    }
    withProps((p) => ({
      props: ops.setSceneMedia(p, sceneIndex, item.path),
      selection: { type: "scene", index: sceneIndex },
      message: `Đã thay hình cảnh ${sceneIndex + 1}.`,
    }));
  };

  const onUpload = async (files: File[]) => {
    const accepted = files.filter((f) => /^(image|video|audio)\//.test(f.type));
    if (accepted.length === 0) {
      flash("Chỉ nhận ảnh, video hoặc âm thanh.");
      return;
    }
    setUploading(true);
    try {
      for (const file of accepted) await uploadFile(file);
      flash(`Đã tải lên ${accepted.length} file.`);
      refreshMedia();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** Giọng đọc: đổi toàn bộ (index bỏ trống) hoặc đọc lại một câu. Chạy trên server. */
  const changeVoice = async (voice: string, index?: number) => {
    const current = propsRef.current;
    if (!current) return;
    const title = index === undefined ? `Đang đọc lại mọi câu bằng giọng ${voice}` : `Đang đọc lại câu ${index + 1}`;
    setJob({ status: "running", title, percent: null, line: "Đang lưu thay đổi…" });
    try {
      window.clearTimeout(saveTimer.current);
      await saveNow(current);
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/voice`, { voice, index });
      setJob({ status: "running", title, percent: null, line: "Đang tạo giọng đọc…" });
      followJob(
        jobId,
        (line) => {
          if (!line.startsWith("__")) setJob((s) => (s.status === "running" ? { ...s, line } : s));
        },
        (status, result, error) => {
          if (status === "done") {
            const next = (result as { props: ShortProps }).props;
            commit(next, current, selectionRef.current);
            setJob({ status: "idle" });
            flash(index === undefined ? `Đã đổi sang giọng ${voice}.` : `Đã đọc lại câu ${index + 1}.`);
          } else {
            setJob({ status: "error", title: "Không tạo được giọng đọc", message: error ?? "Lỗi không rõ." });
          }
        },
      );
    } catch (e) {
      setJob({ status: "error", title: "Không tạo được giọng đọc", message: (e as Error).message });
    }
  };

  const exportVideo = async () => {
    const current = propsRef.current;
    if (!current) return;
    setJob({ status: "running", title: "Đang xuất video", percent: 0, line: "Đang lưu thay đổi…" });
    try {
      window.clearTimeout(saveTimer.current);
      await saveNow(current);
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/render`, {});
      setJob({ status: "running", title: "Đang xuất video", percent: 0, line: "Đang chuẩn bị dựng…" });
      followJob(
        jobId,
        (line) => {
          if (line.startsWith("__PROGRESS__")) {
            const percent = Number(line.split(" ")[1]);
            setJob({ status: "running", title: "Đang xuất video", percent, line: `Đang dựng video… ${percent}%` });
          } else if (!line.startsWith("__STEP__")) {
            setJob((s) => (s.status === "running" ? { ...s, line } : s));
          }
        },
        (status, result, error) => {
          if (status === "done") {
            setJob({ status: "exported", mp4: (result as { mp4?: string } | null)?.mp4 ?? `/out/${slug}.mp4` });
          } else {
            setJob({ status: "error", title: "Không xuất được", message: error ?? "Xuất video thất bại." });
          }
        },
      );
    } catch (e) {
      setJob({ status: "error", title: "Không xuất được", message: (e as Error).message });
    }
  };

  // ---------- phím tắt ----------
  const buildHandlers = () => ({
    togglePlay: () => playerRef.current?.toggle(),
    split,
    del,
    undo,
    redo,
    addText,
    addCaption: () => withProps((p) => ops.addCaption(p, nowMs())),
    trimHead,
    trimTail,
    duplicate: () => {
      if (selectionRef.current?.type === "text") duplicateText();
      else flash("Chọn một văn bản trên timeline để nhân đôi.");
    },
    /** Trả về true nếu đã xử lý — không thì để ⌘C sao chép chữ bình thường. */
    copy: () => {
      const sel = selectionRef.current;
      const text = sel?.type === "text" ? propsRef.current?.texts[sel.index] : undefined;
      if (!text) return false;
      clipboard.current = { ...text };
      flash(`Đã sao chép văn bản — ${MOD}+V để dán tại đầu phát.`);
      return true;
    },
    paste: () => {
      const copied = clipboard.current;
      if (!copied) return false;
      const look: Partial<TextOverlay> = { ...copied };
      delete look.track;
      delete look.startMs;
      delete look.endMs;
      const at = nowMs();
      withProps((p) => {
        const added = ops.addText(p, at, look);
        const index = added.props.texts.length - 1;
        return {
          props: ops.updateText(added.props, index, { endMs: at + Math.max(ops.MIN_MS, copied.endMs - copied.startMs) }),
          selection: { type: "text", index },
          message: "Đã dán văn bản tại đầu phát.",
        };
      });
      return true;
    },
    escape: () => {
      if (showKeys) setShowKeys(false);
      else select(null);
    },
    toggleKeys: () => setShowKeys((v) => !v),
    save: () => {
      const current = propsRef.current;
      if (!current) return;
      window.clearTimeout(saveTimer.current);
      saveNow(current).then(() => flash("Đã lưu."), () => undefined);
    },
    exportVideo,
    importFiles: () => importRef.current?.click(),
    fullscreen: () => playerRef.current?.requestFullscreen(),
    fit: () => setFitRequest((n) => n + 1),
    library: (n: number) => setLibRequest({ section: LIB_SECTIONS[n] ?? "visual", at: Date.now() }),
    zoom: (factor: number) => setPxPerSec((v) => Math.min(320, Math.max(20, Math.round(v * factor)))),
    nudge: (direction: number, big: boolean) => seek(nowMs() + direction * (big ? 1000 : 1000 / FPS)),
    jump: (ms: number) => seek(nowMs() + ms),
    seekTo: (ms: number) => seek(ms),
    /** Nhảy tới ranh giới cảnh gần nhất phía trước/phía sau đầu phát. */
    jumpScene: (direction: number) => {
      const p = propsRef.current;
      if (!p) return;
      const now = nowMs();
      const marks = [...p.scenes.map((s) => s.startMs), ops.videoMeta(p).durationMs];
      const target = direction > 0 ? marks.find((m) => m > now + 20) : [...marks].reverse().find((m) => m < now - 20);
      if (target !== undefined) seek(target);
    },
    durationMs: () => (propsRef.current ? ops.videoMeta(propsRef.current).durationMs : 0),
  });
  const handlers = useRef<ReturnType<typeof buildHandlers> | null>(null);
  handlers.current = buildHandlers();

  // Menu Trợ giúp › Phím tắt của app desktop gửi sự kiện này vào trang.
  useEffect(() => {
    const open = () => setShowKeys(true);
    window.addEventListener("app:shortcuts", open);
    return () => window.removeEventListener("app:shortcuts", open);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (jobRef.current.status === "running") return;
      // Chế độ crop: chỉ nhận Esc để huỷ, phím khác không được đụng timeline.
      if (cropRef.current !== null) {
        if (e.key === "Escape") setCropScene(null);
        return;
      }
      const h = handlers.current;
      if (!h || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Lưu, xuất, nhập, bảng phím tắt: dùng được cả khi đang gõ trong ô nhập.
      if (mod && !e.altKey && !e.shiftKey) {
        const global: Record<string, () => void> = { s: h.save, e: h.exportVideo, i: h.importFiles, "/": h.toggleKeys };
        if (global[key]) {
          e.preventDefault();
          global[key]();
          return;
        }
      }

      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) {
        if (e.key === "Escape") el.blur();
        return;
      }

      // Alt+1…5: tab thư viện. e.code vì Option+số trên macOS ra ký tự khác.
      if (e.altKey && !mod) {
        const digit = /^Digit([1-5])$/.exec(e.code);
        if (digit) {
          e.preventDefault();
          h.library(Number(digit[1]) - 1);
        }
        return;
      }

      if (mod) {
        if (key === "z") { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); }
        else if (key === "y") { e.preventDefault(); h.redo(); }
        else if (key === "b") { e.preventDefault(); h.split(); }
        else if (key === "d") { e.preventDefault(); h.duplicate(); }
        else if (key === "c" && !e.shiftKey) { if (h.copy()) e.preventDefault(); }
        else if (key === "v" && !e.shiftKey) { if (h.paste()) e.preventDefault(); }
        return;
      }

      const run = (fn: () => void) => { e.preventDefault(); fn(); };
      if (e.code === "Space" || key === "k") run(h.togglePlay);
      else if (e.key === "Escape") h.escape();
      else if (e.key === "?") run(h.toggleKeys);
      else if (e.shiftKey && key === "z") run(h.fit);
      else if (key === "j") run(() => h.jump(-5000));
      else if (key === "l") run(() => h.jump(5000));
      else if (key === "s") run(h.split);
      else if (key === "q") run(h.trimHead);
      else if (key === "w") run(h.trimTail);
      else if (key === "t") run(h.addText);
      else if (key === "c") run(h.addCaption);
      else if (key === "f") run(h.fullscreen);
      else if (e.key === "Delete" || e.key === "Backspace") run(h.del);
      else if (e.key === "=" || e.key === "+") run(() => h.zoom(1.25));
      else if (e.key === "-" || e.key === "_") run(() => h.zoom(0.8));
      else if (e.key === "Home") run(() => h.seekTo(0));
      else if (e.key === "End") run(() => h.seekTo(h.durationMs()));
      else if (e.key === "ArrowUp" || e.key === "Up") run(() => h.jumpScene(-1));
      else if (e.key === "ArrowDown" || e.key === "Down") run(() => h.jumpScene(1));
      // "Left"/"Right" là tên phím ở một số trình duyệt/công cụ tự động cũ.
      else if (["ArrowLeft", "ArrowRight", "Left", "Right"].includes(e.key)) run(() => h.nudge(e.key.endsWith("Left") ? -1 : 1, e.shiftKey));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- giao diện ----------
  if (loadError) {
    return (
      <div className="ed-center">
        <p>{loadError}</p>
        <a className="ed-btn" href={slug ? `/#/v/${slug}` : "/"}>← Quay lại</a>
      </div>
    );
  }
  if (!props || !meta) {
    return <div className="ed-center"><p>Đang mở trình chỉnh sửa…</p></div>;
  }

  const saveLabel = { saved: "✓ Đã lưu", dirty: "Chưa lưu…", saving: "Đang lưu…", error: "⚠ Lỗi lưu" }[saveState];

  return (
    <div className="ed">
      <header className="ed-top">
        <div className="ed-top-l">
          <a className="ed-btn ghost" href={`/#/v/${slug}`} title="Về trang video">‹ Quay lại</a>
        </div>
        <div className="ed-title">
          <b title={title}>{title}</b>
          <span className={`save ${saveState}`}>{saveLabel}</span>
        </div>
        <div className="ed-top-r">
          <button className="ed-icon" onClick={() => setShowKeys((v) => !v)} title={`Phím tắt (? hoặc ${MOD}+/)`} aria-expanded={showKeys}>⌨</button>
          <input
            ref={importRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,audio/*"
            onChange={(e) => { onUpload([...(e.target.files ?? [])]); e.target.value = ""; }}
          />
          <button className="ed-icon" onClick={toggleLibSide} title={`Đưa thư viện sang bên ${libSide === "left" ? "phải" : "trái"}`}>⇄</button>
          <button className="ed-btn primary ed-export" onClick={exportVideo} disabled={job.status === "running"} title={`Xuất video (${MOD}+E)`}>
            ⬆ Xuất video
          </button>
        </div>
      </header>

      <div className={`ed-main ${libSide === "right" ? "lib-right" : ""}`}>
        <MediaPanel
          sectionRequest={libRequest}
          media={media}
          aspect={props.aspect}
          onAiVideo={(path, assign) => {
            refreshMedia();
            if (assign) {
              onUseMedia({ path, name: path.split("/").pop() ?? path, kind: "video", bytes: 0, at: Date.now() });
            } else {
              flash("Đã tạo video — xem ở 🖼 Ảnh › Video.");
            }
          }}
          selection={selection}
          uploading={uploading}
          currentMusic={props.music}
          onUse={onUseMedia}
          onUpload={onUpload}
          onAddText={(preset, label) =>
            withProps((p) => ({ ...ops.addText(p, nowMs(), preset), message: `Đã thêm “${label}” — kéo trên khung xem trước để đặt vị trí.` }))}
          onSetMusic={(path) =>
            withProps((p) => ({ props: { ...p, music: path }, selection: { type: "music" }, message: `Nhạc nền: ${path.split("/").pop()}` }))}
          onAppendScene={appendScene}
          onExtractAudio={(item) => extractAudio(item.path)}
          selectedVideoScene={
            selection?.type === "scene" && ops.isVideo(props.scenes[selection.index]?.image) ? selection.index : null
          }
          onDetachSceneAudio={detachSceneAudio}
          captions={props.captions}
          timeMs={timeMs}
          selectedCaption={selection?.type === "caption" ? selection.index : null}
          onSelectCaption={(index) => {
            select({ type: "caption", index });
            const caption = propsRef.current?.captions[index];
            if (caption) seek(caption.startMs);
          }}
          onCaptionText={(index, text) => {
            const current = propsRef.current;
            // Cùng khoá gộp với ô Nội dung trong bảng thuộc tính — gõ liên tục là một bước hoàn tác.
            if (current) commit(ops.updateCaption(current, index, { text }), current, selectionRef.current, `caption-text-${index}`);
          }}
          onInsertCaption={(index) => {
            const current = propsRef.current;
            if (!current) return;
            const result = ops.insertCaptionAfter(current, index, nowMs());
            run(result);
            const at = result.selection && "index" in result.selection ? result.props.captions[result.selection.index] : null;
            if (at) seek(at.startMs);
          }}
          onDeleteCaption={(index) => withProps((p) => ops.deleteCaption(p, index))}
          onAddCaptionLines={(lines) => withProps((p) => ops.addCaptionLines(p, lines, nowMs()))}
        />

        <section className="ed-stage">
          <div className="ed-view" onPointerDown={(e) => { if (e.target === e.currentTarget) select(null); }}>
          <div className="ed-player" style={{ aspectRatio: `${meta.width} / ${meta.height}` }}>
            <Player
              ref={playerRef}
              component={Short}
              inputProps={previewProps ?? props}
              durationInFrames={meta.durationInFrames}
              compositionWidth={meta.width}
              compositionHeight={meta.height}
              fps={FPS}
              controls={false}
              clickToPlay
              doubleClickToFullscreen
              spaceKeyToPlayOrPause={false}
              acknowledgeRemotionLicense
              style={{ width: "100%", height: "100%" }}
            />
            {cropScene === null ? (
              <StageOverlay
                props={props}
                compositionWidth={meta.width}
                compositionHeight={meta.height}
                timeMs={timeMs}
                selection={selection}
                onSelect={select}
                onEdit={onTimelineEdit}
              />
            ) : null}
          </div>
          </div>
          <div className="ed-pbar">
            <span className="ed-tc"><b>{fmt(timeMs)}</b> / {fmt(meta.durationMs)}</span>
            <button className="ed-play" onClick={() => playerRef.current?.toggle()} title="Phát / dừng (Space)" aria-label={playing ? "Dừng" : "Phát"}>
              {playing ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
              )}
            </button>
            <span className="ed-pbar-r">
              <span className="ed-ratio">{props.aspect}</span>
              <button className="ed-icon" onClick={() => playerRef.current?.requestFullscreen()} title="Xem toàn màn hình" aria-label="Xem toàn màn hình">⛶</button>
            </span>
          </div>
          {cropScene !== null && props.scenes[cropScene]?.image ? (
            <CropOverlay
              key={cropScene}
              src={props.scenes[cropScene].image ?? ""}
              trimStartMs={props.scenes[cropScene].trimStartMs}
              frameAspect={meta.width / meta.height}
              defaultFit={props.style === "plain" ? "contain" : "cover"}
              initial={props.scenes[cropScene].crop}
              onApply={applyCrop}
              onCancel={() => setCropScene(null)}
            />
          ) : null}
        </section>

        <aside className="ed-insp">
          <Inspector
            props={props}
            selection={selection}
            media={media}
            voices={voices}
            onChange={(next, key) => {
              const current = propsRef.current;
              if (current) commit(next, current, selectionRef.current, key);
            }}
            onSelect={select}
            onDelete={del}
            onSplit={split}
            onDuplicateText={duplicateText}
            onVoice={changeVoice}
            onRemoveAllVoice={removeAllVoice}
            onDetachAudio={detachSceneAudio}
            onStartCrop={startCrop}
            onAutoSubtitles={autoSubtitles}
          />
        </aside>
      </div>

      <Timeline
        props={props}
        durationMs={meta.durationMs}
        timeMs={timeMs}
        pxPerSec={pxPerSec}
        selection={selection}
        canUndo={historySize.past > 0}
        canRedo={historySize.future > 0}
        onSelect={select}
        onSeek={seek}
        onEdit={onTimelineEdit}
        onSplit={split}
        onDelete={del}
        onUndo={undo}
        onRedo={redo}
        onAddText={addText}
        onTrimHead={trimHead}
        onTrimTail={trimTail}
        onZoom={setPxPerSec}
        onDetachAudio={detachSceneAudio}
        onDropMedia={onDropMedia}
        fitRequest={fitRequest}
      />

      {showKeys ? (
        <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Phím tắt" onClick={() => setShowKeys(false)}>
          <div className="ed-card ed-keys" onClick={(e) => e.stopPropagation()}>
            <div className="ed-keys-head">
              <h3>⌨ Phím tắt</h3>
              <button className="ed-icon" onClick={() => setShowKeys(false)} aria-label="Đóng">✕</button>
            </div>
            <div className="ed-keys-grid">
              {SHORTCUTS.map(([group, items]) => (
                <section key={group}>
                  <h4>{group}</h4>
                  <ul>
                    {items.map(([keys, label]) => (
                      <li key={`${keys.join("+")}-${label}`}>
                        <span>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <p className="muted">Phím một chữ cái không chạy khi đang gõ trong ô nhập — bấm Esc để thoát ô nhập.</p>
          </div>
        </div>
      ) : null}

      {toast ? <div className="ed-toast" role="status">{toast}</div> : null}

      {job.status !== "idle" ? (
        <div className="ed-modal" role="dialog" aria-modal="true">
          <div className="ed-card">
            {job.status === "running" ? (
              <>
                <h3>{job.title}</h3>
                <div className={`ed-progress ${job.percent === null ? "busy" : ""}`}>
                  <div style={{ width: job.percent === null ? "35%" : `${job.percent}%` }} />
                </div>
                <p className="muted">{job.line}</p>
              </>
            ) : job.status === "exported" ? (
              <>
                <h3>✅ Xuất xong</h3>
                <video className="ed-result" src={job.mp4} controls playsInline />
                <div className="ed-actions">
                  <a className="ed-btn primary" href={job.mp4.split("?")[0]} download>⬇ Tải xuống</a>
                  <a className="ed-btn" href={`/#/v/${slug}`}>Mở trong chat</a>
                  <button className="ed-btn ghost" onClick={() => setJob({ status: "idle" })}>Tiếp tục sửa</button>
                </div>
              </>
            ) : (
              <>
                <h3>{job.title}</h3>
                <p className="err">{job.message}</p>
                <div className="ed-actions">
                  <button className="ed-btn" onClick={() => setJob({ status: "idle" })}>Đóng</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
