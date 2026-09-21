import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowLeft, ArrowLeftRight, Check, ChevronLeft, CircleCheck, Download, Keyboard, LoaderCircle, Maximize, Minimize2, Minus, Pause,
  Play, Plus, TriangleAlert, Upload, X,
} from "lucide-react";
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
import { usePanelWidths, useStageZoom } from "./layout";
import { MediaPanel, type LibrarySection } from "./MediaPanel";
import * as ops from "./ops";
import { StageOverlay } from "./StageOverlay";
import { Timeline, type DropTarget, type EditPhase } from "./Timeline";

type SaveState = "saved" | "dirty" | "saving" | "error";
type JobState =
  | { status: "idle" }
  | { status: "running"; title: string; percent: number | null; line: string }
  | { status: "error"; title: string; message: string };

/**
 * Xuất video — tách khỏi JobState: đóng hộp tiến độ thì xuất vẫn chạy dưới nền (server dựng xong vẫn thành bản mới),
 * người dùng sửa tiếp; các việc khác (đổi giọng, phụ đề…) vẫn chặn màn hình vì chúng sửa thẳng dữ liệu đang chỉnh.
 * `editedSince`: đã sửa thêm sau lúc bấm xuất — những thay đổi đó KHÔNG có trong video vừa xuất.
 */
type ExportState =
  | { status: "idle" }
  | { status: "running"; percent: number; line: string }
  | { status: "exported"; mp4: string; version: number | null; editedSince: boolean }
  | { status: "error"; message: string };

const FPS = 30;
const same = (a: ShortProps, b: ShortProps) => JSON.stringify(a) === JSON.stringify(b);

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
/** Độ dài cảnh ảnh sinh ra từ nút Cắt ảnh — đổi được bằng cách kéo mép cảnh. */
const FREEZE_MS = 2000;
const LIB_SECTIONS: LibrarySection[] = ["visual", "audio", "text", "captions", "ai", "stock"];

/** Bảng phím tắt — hiện trong hộp Phím tắt (phím ? hoặc ⌘/), menu Trợ giúp của app desktop mở cùng hộp này. */
const SHORTCUTS: [string, [string[], string][]][] = [
  ["Phát", [
    [["Space"], "Phát / dừng"],
    [["K"], "Phát / dừng"],
    [["J"], "Lùi 5 giây"],
    [["L"], "Tới 5 giây"],
    [["←", "→"], "Lùi / tới 1 khung hình"],
    [["Shift", "← →"], "Lùi / tới 1 giây"],
    [["↑", "↓"], "Về đầu video trước / video sau"],
    [["Home", "End"], "Về đầu / cuối video"],
    [["F"], "Xem toàn màn hình"],
  ]],
  ["Khung xem trước", [
    [[MOD, "="], "Phóng to khung xem trước"],
    [[MOD, "−"], "Thu nhỏ khung xem trước"],
    [[MOD, "0"], "Vừa khung"],
    [[MOD, "lăn chuột"], "Phóng to / thu nhỏ tại con trỏ (chụm 2 ngón trên trackpad)"],
    [["Chuột giữa", "kéo"], "Di chuyển khi đang phóng to — hoặc kéo trên nền tối"],
  ]],
  ["Chỉnh sửa", [
    [["S"], "Tách tại đầu phát"],
    [[MOD, "B"], "Tách tại đầu phát"],
    [["Q"], "Cắt trái — xoá từ đầu tới đầu phát"],
    [["W"], "Cắt phải — xoá từ đầu phát tới hết"],
    [["Delete"], "Xoá mục đang chọn"],
    [["T"], "Thêm văn bản"],
    [["C"], "Thêm phụ đề"],
    [["P"], "Cắt ảnh từ video tại đầu phát"],
    [[MOD, "D"], "Nhân đôi văn bản"],
    [[MOD, "C / V"], "Sao chép / dán văn bản"],
    [[MOD, "Z"], "Hoàn tác"],
    [[MOD, "Shift", "Z"], "Làm lại"],
    [["Esc"], "Bỏ chọn"],
  ]],
  ["Timeline & thư viện", [
    [["=", "−"], "Phóng to / thu nhỏ timeline"],
    [["Shift", "Z"], "Vừa khung — thấy cả video"],
    [["Alt", "1…6"], "Ảnh/Video · Âm thanh · Văn bản · Phụ đề · Video AI · Kho free"],
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
 * bảng thuộc tính, thư viện media. Mở đúng MỘT bản của video (server/versions.ts): thay đổi lưu vào
 * bản nháp của bản đó, xuất ra thành bản mới — bản gốc giữ nguyên.
 */
export const Editor: React.FC<{ slug: string; version: number | null }> = ({ slug, version: requestedVersion }) => {
  const [props, setProps] = useState<ShortProps | null>(null);
  /** Bản đang sửa (server đã quy "mới nhất" ra số); null = dự án chưa từng xuất. */
  const [versionInfo, setVersionInfo] = useState<{ version: number | null; latest: number | null; hasDraft: boolean } | null>(null);
  /** Giọng video đang dùng — ô chọn giọng mở ra đúng giọng này thay vì mặc định. */
  const [videoVoice, setVideoVoice] = useState<string | null>(null);
  const versionQuery = useRef("");
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
  const [exp, setExp] = useState<ExportState>({ status: "idle" });
  /** Hộp tiến độ/kết quả xuất đang mở. Đóng lúc đang chạy = chạy dưới nền; nút Xuất video hiện tiến độ. */
  const [expOpen, setExpOpen] = useState(false);
  const expRef = useRef(exp);
  expRef.current = exp;
  const expOpenRef = useRef(expOpen);
  expOpenRef.current = expOpen;
  /** Props lúc bấm xuất — so với lúc xuất xong để biết người dùng đã sửa thêm trong lúc chạy nền chưa. */
  const exportSnapshot = useRef<string | null>(null);
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const [showKeys, setShowKeys] = useState(false);
  /** Tăng lên để timeline tự thu phóng vừa khung (Shift+Z). */
  const [fitRequest, setFitRequest] = useState(0);
  /** Phím Alt+1…6: chuyển tab thư viện. */
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
  /** Mục đang mở khung crop (cảnh hay video trên timeline), null = không ở chế độ crop. */
  const [cropTarget, setCropTarget] = useState<ops.MotionSel | null>(null);
  const cropRef = useRef<ops.MotionSel | null>(null);
  cropRef.current = cropTarget;
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

  const meta = useMemo(() => (props ? ops.videoMeta(props) : null), [props]);
  // Kéo thanh chia để đổi độ rộng thư viện / bảng thuộc tính; thu phóng khung xem trước.
  const mainRef = useRef<HTMLDivElement>(null);
  const panels = usePanelWidths(mainRef, Boolean(meta));
  const stage = useStageZoom(meta ? meta.width / meta.height : 9 / 16, Boolean(meta));
  const stageRef = useRef(stage);
  stageRef.current = stage;
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
      await postJson(`/api/editor/${slug}/save${versionQuery.current}`, next);
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

  // ---------- tải dữ liệu ----------
  useEffect(() => {
    if (!slug) {
      setLoadError("Thiếu tên video trong đường dẫn.");
      return;
    }
    api<{ props: ShortProps; title: string; version: number | null; latest: number | null; hasDraft: boolean; voice: string | null }>(
      `/api/editor/${slug}${requestedVersion !== null ? `?version=${requestedVersion}` : ""}`,
    )
      .then((d) => {
        // Mọi lần lưu/xuất sau đó gắn đúng bản này — kể cả khi trong lúc sửa có bản mới hơn ra đời.
        versionQuery.current = d.version !== null ? `?version=${d.version}` : "";
        setVersionInfo({ version: d.version, latest: d.latest, hasDraft: d.hasDraft });
        setVideoVoice(d.voice);
        // "Video gốc" vẽ cảnh y như một khối video nên gộp hàng Cảnh vào các hàng Video — mọi clip chỉnh như
        // nhau. Phong cách khác GIỮ hàng Cảnh: ảnh nằm trong khung trang trí của phong cách (ô truyện tranh,
        // polaroid, ảnh dán, Ken Burns…); gộp thì khung đó mất hẳn. Cần chỉnh tự do thì tách từng cảnh
        // thành video bằng nút "Tách thành video riêng" (liftSceneToOverlay).
        const unified = d.props.style === "plain" && ops.hasSceneMedia(d.props) ? ops.unifyScenes(d.props) : null;
        setProps(unified ? unified.props : d.props);
        setTitle(d.title);
        document.title = `Chỉnh sửa · ${d.title}`;
        if (unified) {
          scheduleSave(unified.props);
          flash("Đã gộp các cảnh thành video trên timeline — giờ mọi clip chỉnh như nhau.");
        }
      })
      .catch((e: Error) => setLoadError(e.message));
    api<{ voices: { catalog: VoiceOption[] }; watermark?: ShortProps["watermark"] }>("/api/state")
      .then((d) => {
        setVoices(d.voices.catalog);
        setWatermark(d.watermark ?? null);
      })
      .catch(() => undefined);
    refreshMedia();
  }, [slug, requestedVersion, refreshMedia, scheduleSave, flash]);


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

  /** Độ dài một mục thư viện trên timeline: video lấy đúng độ dài file, ảnh mặc định 3 giây. */
  const itemDurationMs = (item: MediaItem) =>
    item.kind === "video" ? mediaDurationMs(`/public/${item.path}`, "video") : Promise.resolve(3000);

  /**
   * Thêm một ảnh/video thành MỘT VIDEO trên timeline. Mọi video thêm vào đều như nhau: phủ kín khung,
   * không cắt hình, đặt tự do trên timeline và thu nhỏ/đè lên nhau được.
   * track bỏ trống = tự chọn hàng còn trống.
   */
  const addOverlay = async (item: MediaItem, atMs: number, track?: number) => {
    if (item.kind === "audio") return;
    const duration = await itemDurationMs(item);
    withProps((p) => ops.addOverlay(p, item.path, atMs, duration, track));
  };

  /** Thay ảnh/video của khối `index` trên timeline, giữ nguyên chỗ (xem ops.replaceOverlayMedia). */
  const replaceOverlay = async (index: number, item: MediaItem) => {
    if (item.kind === "audio") {
      flash("Khối video chỉ thay được bằng ảnh hoặc video.");
      return;
    }
    const duration = item.kind === "video" ? await mediaDurationMs(`/public/${item.path}`, "video") : undefined;
    withProps((p) => ops.replaceOverlayMedia(p, index, item.path, duration));
  };

  /** Chọn file từ máy để thay khối `index`: tải lên thư viện rồi thay luôn. */
  const replaceOverlayFromFile = async (index: number, file: File) => {
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
    if (!kind) {
      flash("Chỉ thay được bằng ảnh hoặc video.");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadFile(file);
      refreshMedia();
      await replaceOverlay(index, { path, name: file.name, kind, bytes: file.size, at: Date.now() });
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** Nối vào cuối hàng Video 1 — dựng tuần tự clip này rồi clip kia. */
  const appendOverlay = async (item: MediaItem) => {
    if (item.kind === "audio") return;
    const duration = await itemDurationMs(item);
    withProps((p) => ops.appendOverlay(p, item.path, duration));
  };

  /** Nút ◆ trên thanh timeline: ghim / xoá mốc chuyển động cho cảnh hoặc lớp đang chọn. */
  const setKeyframe = (sel: ops.MotionSel) => withProps((p) => ops.setKeyframe(p, sel, nowMs()));
  const deleteKeyframe = (sel: ops.MotionSel) => withProps((p) => ops.deleteKeyframe(p, sel, nowMs()));

  /** Kéo khối cảnh lên hàng lớp chồng, hoặc nút trong bảng thuộc tính. */
  const liftScene = (index: number, track?: number) => {
    dragBase.current = null;
    withProps((p) => ops.liftSceneToOverlay(p, index, track));
  };

  /** Khung crop dùng chung cho cảnh và mọi video trên timeline. */
  const startCrop = (sel: ops.MotionSel) => {
    const current = propsRef.current;
    const item = current ? ops.motionItem(current, sel) : null;
    const src = item ? ops.mediaSrcOf(item) : null;
    if (!item || !src) {
      flash("Mục này chưa có ảnh/video để crop.");
      return;
    }
    playerRef.current?.pause();
    const t = nowMs();
    // Crop đọc khung hình của clip tại điểm cắt đầu — đưa đầu phát vào trong mục cho khớp.
    if (t < item.startMs || t >= item.endMs) seek(item.startMs + Math.min(500, (item.endMs - item.startMs) / 2));
    select(sel);
    setCropTarget(sel);
  };

  const applyCrop = (crop: SceneCrop | null) => {
    const sel = cropRef.current;
    setCropTarget(null);
    if (!sel) return;
    withProps((p) => {
      const name = ops.motionLabel(p, sel);
      return {
        props: sel.type === "scene" ? ops.updateScene(p, sel.index, { crop }) : ops.updateOverlay(p, sel.index, { crop }),
        selection: sel,
        message: !crop
          ? `Đã bỏ crop ${name}.`
          : isMediaCrop(crop)
            ? `Đã crop ${name} — lấy ${Math.round(crop.w * 100)}% × ${Math.round(crop.h * 100)}% ảnh gốc${crop.rotate ? `, xoay ${crop.rotate}°` : ""}.`
            : `Đã crop ${name}.`,
      };
    });
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
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/subtitles${versionQuery.current}`, options);
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
                  `${originalTrack !== undefined ? `, bản gốc ở hàng Phụ đề ${originalTrack + 1}` : ""} — soát lại câu dịch trong mục Phụ đề.`
                : `Đã tạo ${count} câu ở hàng Phụ đề ${(track ?? 0) + 1} — sửa chữ trong mục Phụ đề nếu nghe nhầm.`);
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
        flash("Đã tách âm thanh — xem ở Âm thanh › Đã tải lên.");
      } else {
        withProps((p) => ops.detachAudio(p, sceneIndex, result.path, result.durationMs));
      }
    } catch (e) {
      setJob({ status: "error", title: "Không tách được âm thanh", message: (e as Error).message });
    }
  };

  /**
   * Cắt ảnh tại đầu phát: lấy đúng khung hình đang xem của cảnh (hoặc lớp) video, lưu vào thư viện
   * rồi chèn thành cảnh ảnh mới ngay sau cảnh đó — kiểu "đóng băng khung hình" của CapCut.
   */
  const freezeFrame = async () => {
    const current = propsRef.current;
    if (!current) return;
    const now = nowMs();
    const sel = selectionRef.current;

    // Đang chọn một video thì cắt khung của video đó; không chọn gì thì lấy video đang thấy dưới đầu phát
    // (hàng cao nhất), còn không có nữa mới xét cảnh.
    const picked = sel?.type === "overlay" ? ops.overlaysOf(current)[sel.index] : undefined;
    const overlay = picked && ops.isVideo(picked.src) && now >= picked.startMs && now < picked.endMs
      ? picked
      : ops.overlaysOf(current)[ops.overlayIndexAt(current, now, true)];
    const fromOverlay = Boolean(overlay);
    const sceneIndex = ops.sceneIndexAt(current, now);
    const scene = current.scenes[sceneIndex];
    const src = fromOverlay ? overlay!.src : scene?.image;
    if (!src || !ops.isVideo(src)) {
      flash("Đầu phát không nằm trên video nào — dời đầu phát vào một video rồi bấm lại.");
      return;
    }

    // Mốc trong file gốc: cộng phần đã cắt đầu và nhân tốc độ phát.
    const base = fromOverlay ? overlay! : scene;
    const sourceMs = base.trimStartMs + (now - base.startMs) * ops.clipSpeed(base);
    setJob({ status: "running", title: "Đang cắt ảnh từ video", percent: null, line: src.split("/").pop() ?? src });
    try {
      const { path: file } = await postJson<{ path: string }>("/api/media/capture-frame", { src, atMs: Math.round(sourceMs) });
      refreshMedia();
      setJob({ status: "idle" });
      withProps((p) => {
        // Cắt từ một video trên timeline (hoặc dự án không dùng hàng Cảnh): ảnh thành một video mới
        // ngay tại đầu phát, để mọi thứ trên timeline vẫn cùng một loại. Cắt từ cảnh thì chèn thành cảnh.
        if (fromOverlay || !ops.hasSceneMedia(p)) {
          const added = ops.addOverlay(p, file, now, FREEZE_MS);
          return { ...added, message: `Đã cắt ảnh ở ${fmt(now)} — thêm vào thư viện và đặt thành một video tại đầu phát.` };
        }
        return {
          ...ops.insertSceneAfter(p, sceneIndex, file, FREEZE_MS),
          message: `Đã cắt ảnh ở ${fmt(now)} — thêm vào thư viện và chèn thành cảnh ${sceneIndex + 2}.`,
        };
      });
    } catch (e) {
      setJob({ status: "error", title: "Không cắt được ảnh", message: (e as Error).message });
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
    const sel = selectionRef.current;
    // Đang chọn một video/cảnh thì bấm ảnh là THAY hình của mục đó; không chọn gì thì thêm video mới.
    if (sel?.type === "overlay") {
      await replaceOverlay(sel.index, item);
      return;
    }
    if (sel?.type === "scene") {
      const index = sel.index;
      withProps((p) => ({
        props: ops.setSceneMedia(p, index, item.path),
        selection: { type: "scene", index },
        message: `Đã gán ${item.kind === "video" ? "video" : "ảnh"} cho cảnh ${index + 1}.`,
      }));
      return;
    }
    await addOverlay(item, nowMs());
  };

  /** Gán ảnh/video cho một cảnh từ bảng thuộc tính — cảnh trống hay đổi hình đều đi đường này. */
  const sceneMedia = (index: number, item: MediaItem) => {
    if (item.kind === "audio") {
      flash("Cảnh chỉ nhận ảnh hoặc video.");
      return;
    }
    withProps((p) => ({
      props: ops.setSceneMedia(p, index, item.path),
      selection: { type: "scene", index },
      message: `Đã gán ${item.kind === "video" ? "video" : "ảnh"} cho cảnh ${index + 1}.`,
    }));
  };

  /** Chọn file từ máy cho một cảnh: tải lên thư viện rồi gán luôn. */
  const sceneMediaFromFile = async (index: number, file: File) => {
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
    if (!kind) {
      flash("Cảnh chỉ nhận ảnh hoặc video.");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadFile(file);
      refreshMedia();
      sceneMedia(index, { path, name: file.name, kind, bytes: file.size, at: Date.now() });
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** Kéo file từ thư viện thả xuống timeline — giống CapCut. */
  const onDropMedia = async (path: string, atMs: number, target: DropTarget) => {
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
    if (target.kind === "overlay") {
      await addOverlay(item, atMs, target.track);
      return;
    }
    if (target.kind === "replace") {
      await replaceOverlay(target.index, item);
      return;
    }
    if (target.kind === "end") {
      await appendOverlay(item);
      return;
    }
    withProps((p) => ({
      props: ops.setSceneMedia(p, target.index, item.path),
      selection: { type: "scene", index: target.index },
      message: `Đã thay hình cảnh ${target.index + 1}.`,
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
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/voice${versionQuery.current}`, { voice, index });
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
            if (index === undefined) setVideoVoice(voice);
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

  /** Bỏ bản nháp: nạp lại đúng bản đã xuất. */
  const discardDraft = async () => {
    if (!versionInfo?.hasDraft || !window.confirm(`Bỏ mọi thay đổi chưa xuất và quay về đúng bản ${versionInfo.version}?`)) return;
    window.clearTimeout(saveTimer.current);
    try {
      await postJson(`/api/editor/${slug}/discard${versionQuery.current}`, {});
      setSaveState("saved");
      // Tải lại trang: lịch sử hoàn tác đang chứa thay đổi vừa bỏ.
      window.location.reload();
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const exportVideo = async () => {
    const current = propsRef.current;
    if (!current) return;
    // Đang xuất, hoặc đã xong dưới nền mà chưa xem: mở lại hộp, không xuất chồng.
    if (expRef.current.status !== "idle") {
      setExpOpen(true);
      return;
    }
    exportSnapshot.current = JSON.stringify(current);
    setExp({ status: "running", percent: 0, line: "Đang lưu thay đổi…" });
    setExpOpen(true);
    try {
      window.clearTimeout(saveTimer.current);
      await saveNow(current);
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/render${versionQuery.current}`, {});
      setExp({ status: "running", percent: 0, line: "Đang chuẩn bị dựng…" });
      followJob(
        jobId,
        (line) => {
          if (line.startsWith("__PROGRESS__")) {
            const percent = Number(line.split(" ")[1]);
            setExp({ status: "running", percent, line: `Đang dựng video… ${percent}%` });
          } else if (!line.startsWith("__STEP__")) {
            setExp((s) => (s.status === "running" ? { ...s, line } : s));
          }
        },
        (status, result, error) => {
          const background = !expOpenRef.current;
          if (status === "done") {
            const message = result as { mp4?: string; version?: number } | null;
            const now = propsRef.current ? JSON.stringify(propsRef.current) : exportSnapshot.current;
            setExp({
              status: "exported", mp4: message?.mp4 ?? `/out/${slug}.mp4`, version: message?.version ?? null,
              editedSince: now !== exportSnapshot.current,
            });
            if (background) flash(`Xuất xong${message?.version ? ` bản ${message.version}` : ""} — bấm “Xuất xong · Xem” trên cùng để xem.`);
          } else {
            setExp({ status: "error", message: error ?? "Xuất video thất bại." });
            if (background) flash("Xuất video không thành công — bấm nút trên cùng để xem lỗi.");
          }
        },
      );
    } catch (e) {
      setExp({ status: "error", message: (e as Error).message });
    }
  };

  /** Đóng hộp xuất: đang chạy thì chạy tiếp dưới nền; đã xong/lỗi thì xoá kết quả để lần sau xuất mới. */
  const closeExport = () => {
    setExpOpen(false);
    if (expRef.current.status !== "running") setExp({ status: "idle" });
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
    freezeFrame,
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
    stageZoom: (factor: number) => stageRef.current.zoomBy(factor),
    stageFit: () => stageRef.current.zoomTo(1),
    zoom: (factor: number) => setPxPerSec((v) => Math.min(320, Math.max(20, Math.round(v * factor)))),
    nudge: (direction: number, big: boolean) => seek(nowMs() + direction * (big ? 1000 : 1000 / FPS)),
    jump: (ms: number) => seek(nowMs() + ms),
    seekTo: (ms: number) => seek(ms),
    /** Nhảy tới mép khối gần nhất phía trước/phía sau đầu phát: đầu/cuối mỗi video (và ranh giới cảnh nếu hàng Cảnh còn hiện). */
    jumpScene: (direction: number) => {
      const p = propsRef.current;
      if (!p) return;
      const now = nowMs();
      const marks = [
        0,
        ...(ops.sceneRowVisible(p) ? p.scenes.map((s) => s.startMs) : []),
        ...ops.overlaysOf(p).flatMap((o) => [o.startMs, o.endMs]),
        ops.videoMeta(p).durationMs,
      ].sort((a, b) => a - b);
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
      // Hộp xuất đang mở: Esc = đóng (đang chạy thì chạy dưới nền), phím khác không đụng timeline phía sau.
      if (expOpenRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          setExpOpen(false);
          if (expRef.current.status !== "running") setExp({ status: "idle" });
        }
        return;
      }
      // Chế độ crop: chỉ nhận Esc để huỷ, phím khác không được đụng timeline.
      if (cropRef.current !== null) {
        if (e.key === "Escape") setCropTarget(null);
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

      // Alt+1…6: tab thư viện. e.code vì Option+số trên macOS ra ký tự khác.
      if (e.altKey && !mod) {
        const digit = /^Digit([1-6])$/.exec(e.code);
        if (digit) {
          e.preventDefault();
          h.library(Number(digit[1]) - 1);
        }
        return;
      }

      if (mod) {
        // Thu phóng khung xem trước. e.code: bàn phím không phải US vẫn đúng phím; e.key dự phòng khi không có code.
        if (!e.altKey && (e.code === "Equal" || e.code === "NumpadAdd" || e.key === "=" || e.key === "+")) { e.preventDefault(); h.stageZoom(1.25); }
        else if (!e.altKey && (e.code === "Minus" || e.code === "NumpadSubtract" || e.key === "-" || e.key === "_")) { e.preventDefault(); h.stageZoom(0.8); }
        else if (!e.altKey && (e.code === "Digit0" || e.code === "Numpad0" || e.key === "0")) { e.preventDefault(); h.stageFit(); }
        else if (key === "z") { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); }
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
      else if (key === "p") run(h.freezeFrame);
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
        <a className="ed-btn" href={slug ? `/#/v/${slug}` : "/"}><ArrowLeft size={16} aria-hidden /> Quay lại</a>
      </div>
    );
  }
  if (!props || !meta) {
    return <div className="ed-center"><p>Đang mở trình chỉnh sửa…</p></div>;
  }

  // Mục đang crop (cảnh hay lớp) — chỉ mở khung crop khi mục đó thật sự có ảnh/video.
  const cropItem = cropTarget ? ops.motionItem(props, cropTarget) : null;

  const saveLabel = {
    saved: <><Check size={14} aria-hidden /> Đã lưu</>,
    dirty: "Chưa lưu…",
    saving: "Đang lưu…",
    error: <><TriangleAlert size={14} aria-hidden /> Lỗi lưu</>,
  }[saveState];

  return (
    <div className="ed">
      <header className="ed-top">
        <div className="ed-top-l">
          <a className="ed-btn ghost" href={`/#/v/${slug}`} title="Về trang video"><ChevronLeft size={16} aria-hidden /> Quay lại</a>
        </div>
        <div className="ed-title">
          <b title={title}>{title}</b>
          {versionInfo?.version != null ? (
            <span
              className={`ed-version ${versionInfo.version !== versionInfo.latest ? "old" : ""}`}
              title={versionInfo.version !== versionInfo.latest
                ? `Đang sửa bản ${versionInfo.version} (bản mới nhất là ${versionInfo.latest}). Xuất ra sẽ thành bản mới, bản ${versionInfo.version} giữ nguyên.`
                : "Xuất ra sẽ thành bản mới, bản đang mở giữ nguyên."}
            >
              Bản {versionInfo.version}{versionInfo.version !== versionInfo.latest ? " · bản cũ" : ""}
            </span>
          ) : null}
          <span className={`save ${saveState}`}>{saveLabel}</span>
          {versionInfo?.hasDraft ? (
            <button className="ed-link" onClick={discardDraft} disabled={job.status === "running" || exp.status === "running"} title="Bỏ mọi thay đổi chưa xuất, quay về đúng bản đã xuất">
              Bỏ thay đổi
            </button>
          ) : null}
        </div>
        <div className="ed-top-r">
          <button className="ed-icon" onClick={() => setShowKeys((v) => !v)} title={`Phím tắt (? hoặc ${MOD}+/)`} aria-label="Phím tắt" aria-expanded={showKeys}><Keyboard size={16} aria-hidden /></button>
          <input
            ref={importRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,audio/*"
            onChange={(e) => { onUpload([...(e.target.files ?? [])]); e.target.value = ""; }}
          />
          <button className="ed-icon" onClick={toggleLibSide} title={`Đưa thư viện sang bên ${libSide === "left" ? "phải" : "trái"}`} aria-label={`Đưa thư viện sang bên ${libSide === "left" ? "phải" : "trái"}`}><ArrowLeftRight size={16} aria-hidden /></button>
          <button
            className={`ed-btn primary ed-export ${exp.status !== "idle" && !expOpen ? `bg ${exp.status}` : ""}`}
            onClick={exportVideo}
            disabled={job.status === "running"}
            title={exp.status === "running" ? "Đang xuất dưới nền — bấm để xem tiến độ" : `Xuất video (${MOD}+E)`}
          >
            {exp.status === "running" ? (
              <>
                <span className="ed-export-fill" style={{ width: `${exp.percent}%` }} aria-hidden />
                <LoaderCircle size={16} className="spin" aria-hidden /> Đang xuất {exp.percent}%
              </>
            ) : exp.status === "exported" && !expOpen ? (
              <><CircleCheck size={16} aria-hidden /> Xuất xong · Xem</>
            ) : exp.status === "error" && !expOpen ? (
              <><TriangleAlert size={16} aria-hidden /> Xuất lỗi · Xem</>
            ) : (
              <><Upload size={16} aria-hidden /> Xuất video</>
            )}
          </button>
        </div>
      </header>

      <div
        ref={mainRef}
        className={`ed-main ${libSide === "right" ? "lib-right" : ""}`}
        style={{
          "--left-w": `${libSide === "left" ? panels.widths.lib : panels.widths.insp}px`,
          "--right-w": `${libSide === "left" ? panels.widths.insp : panels.widths.lib}px`,
        } as React.CSSProperties}
      >
        {(["left", "right"] as const).map((side) => {
          const panel = (side === "left") === (libSide === "left") ? "lib" : "insp";
          return (
            <div
              key={side}
              className={`ed-split ${side}`}
              role="separator"
              aria-orientation="vertical"
              title={`Kéo để đổi độ rộng ${panel === "lib" ? "thư viện" : "bảng thuộc tính"} — nhấp đúp về mặc định`}
              onPointerDown={panels.startDrag(panel, side)}
              onDoubleClick={() => panels.reset(panel)}
            />
          );
        })}
        <MediaPanel
          sectionRequest={libRequest}
          media={media}
          aspect={props.aspect}
          onAiVideo={(path, assign) => {
            refreshMedia();
            if (assign) {
              onUseMedia({ path, name: path.split("/").pop() ?? path, kind: "video", bytes: 0, at: Date.now() });
            } else {
              flash("Đã tạo video — xem ở Ảnh › Video.");
            }
          }}
          onStock={(path, kind, action, credit) => {
            refreshMedia();
            const name = path.split("/").pop() ?? path;
            if (action === "music") {
              withProps((p) => ({ props: { ...p, music: path }, selection: { type: "music" }, message: `Nhạc nền: ${name} — ${credit}` }));
            } else if (action === "use") {
              void onUseMedia({ path, name, kind: kind === "image" ? "image" : kind === "video" ? "video" : "audio", bytes: 0, at: Date.now() });
            } else {
              flash(`Đã lưu vào thư viện — ${credit}`);
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
          onAppendOverlay={appendOverlay}
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
          onImportCaptions={(cues, opts) => withProps((p) => ops.importCaptions(p, cues, nowMs(), opts))}
        />

        <section className="ed-stage">
          <div ref={stage.viewRef} className={`ed-view ${stage.zoom > 1 ? "zoomed" : ""}`} onPointerDown={(e) => stage.beginPan(e, () => select(null))}>
          <div
            ref={stage.playerBoxRef}
            className="ed-player"
            style={stage.playerSize
              ? { width: stage.playerSize.width, height: stage.playerSize.height }
              : { aspectRatio: `${meta.width} / ${meta.height}` }}
          >
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
            {cropTarget === null ? (
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
                <Pause size={18} fill="currentColor" aria-hidden />
              ) : (
                <Play size={18} fill="currentColor" aria-hidden />
              )}
            </button>
            <span className="ed-pbar-r">
              <span className="ed-zoom" role="group" aria-label="Thu phóng khung xem trước">
                <button onClick={() => stage.zoomBy(0.8)} title={`Thu nhỏ khung xem trước (${MOD} −)`} aria-label="Thu nhỏ"><Minus size={16} aria-hidden /></button>
                <button className="ed-zoom-v" onClick={() => stage.zoomTo(1)} title={`Vừa khung (${MOD} 0) — ${MOD} + lăn chuột để phóng tại con trỏ`}>
                  {stage.zoom === 1 ? "Vừa" : `${Math.round(stage.zoom * 100)}%`}
                </button>
                <button onClick={() => stage.zoomBy(1.25)} title={`Phóng to khung xem trước (${MOD} =)`} aria-label="Phóng to"><Plus size={16} aria-hidden /></button>
              </span>
              <span className="ed-ratio">{props.aspect}</span>
              <button className="ed-icon" onClick={() => playerRef.current?.requestFullscreen()} title="Xem toàn màn hình" aria-label="Xem toàn màn hình"><Maximize size={16} aria-hidden /></button>
            </span>
          </div>
          {cropItem ? (
            <CropOverlay
              key={`${cropTarget?.type}-${cropTarget?.index}`}
              src={ops.mediaSrcOf(cropItem) ?? ""}
              trimStartMs={cropItem.trimStartMs}
              frameAspect={meta.width / meta.height}
              defaultFit={props.style === "plain" ? "contain" : "cover"}
              initial={cropItem.crop}
              onApply={applyCrop}
              onCancel={() => setCropTarget(null)}
            />
          ) : null}
        </section>

        <aside className="ed-insp">
          <Inspector
            props={props}
            selection={selection}
            media={media}
            voices={voices}
            videoVoice={videoVoice}
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
            onLiftScene={liftScene}
            onAutoSubtitles={autoSubtitles}
            timeMs={timeMs}
            onSeek={seek}
            onRun={run}
            uploading={uploading}
            onReplaceMedia={replaceOverlay}
            onReplaceFile={replaceOverlayFromFile}
            onSceneMedia={sceneMedia}
            onSceneFile={sceneMediaFromFile}
            onOpenLibrary={(section) => setLibRequest({ section, at: Date.now() })}
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
        onFreezeFrame={freezeFrame}
        onDropMedia={onDropMedia}
        onLiftScene={liftScene}
        onSetKeyframe={setKeyframe}
        onDeleteKeyframe={deleteKeyframe}
        fitRequest={fitRequest}
      />

      {showKeys ? (
        <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Phím tắt" onClick={() => setShowKeys(false)}>
          <div className="ed-card ed-keys" onClick={(e) => e.stopPropagation()}>
            <div className="ed-keys-head">
              <h3><Keyboard size={18} aria-hidden /> Phím tắt</h3>
              <button className="ed-icon" onClick={() => setShowKeys(false)} aria-label="Đóng"><X size={16} aria-hidden /></button>
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

      {expOpen && exp.status !== "idle" && job.status === "idle" ? (
        <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Xuất video">
          <div className="ed-card">
            {exp.status === "running" ? (
              <>
                <h3>Đang xuất video</h3>
                <div className="ed-progress"><div style={{ width: `${exp.percent}%` }} /></div>
                <p className="muted">{exp.line}</p>
                <p className="muted ed-note">
                  Chạy dưới nền để sửa tiếp trong lúc chờ — thay đổi sau lúc bấm xuất không có trong video này.
                  Rời trang cũng được: video vẫn xuất xong và hiện trong chat.
                </p>
                <div className="ed-actions">
                  <button className="ed-btn primary" onClick={() => setExpOpen(false)} autoFocus>
                    <Minimize2 size={16} aria-hidden /> Chạy dưới nền
                  </button>
                </div>
              </>
            ) : exp.status === "exported" ? (
              <>
                <h3><CircleCheck size={20} aria-hidden /> Xuất xong{exp.version !== null ? ` · bản ${exp.version}` : ""}</h3>
                <video className="ed-result" src={exp.mp4} controls playsInline />
                {exp.editedSince ? (
                  <p className="muted ed-note">
                    Bạn đã sửa thêm sau lúc bấm xuất — những thay đổi đó chưa có trong video này, vẫn nằm ở bản đang mở.
                    Bấm Xuất video lần nữa để có chúng.
                  </p>
                ) : null}
                <div className="ed-actions">
                  <a className="ed-btn primary" href={exp.mp4.split("?")[0]} download><Download size={18} aria-hidden /> Tải xuống</a>
                  <a className="ed-btn" href={`/#/v/${slug}`}>Mở trong chat</a>
                  {exp.version !== null && !exp.editedSince ? (
                    <a className="ed-btn ghost" href={`/editor.html#${slug}/v${exp.version}`} title="Mở bản vừa xuất để sửa tiếp">Sửa tiếp bản {exp.version}</a>
                  ) : (
                    <button className="ed-btn ghost" onClick={closeExport}>Tiếp tục sửa</button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3>Không xuất được</h3>
                <p className="err">{exp.message}</p>
                <div className="ed-actions">
                  <button className="ed-btn" onClick={closeExport}>Đóng</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
