import { useEffect, useRef, useState } from "react";
import type { Caption, TextOverlay } from "../../src/compositions/Short/schema";
import { api, fmt, followJob, postJson, type MediaItem } from "./api";
import type * as ops from "./ops";
import { MEDIA_DRAG_TYPE } from "./Timeline";

/** Kéo một file từ thư viện — timeline nhận kiểu dữ liệu riêng, không nhầm với kéo file từ máy. */
const dragMedia = (path: string) => (e: React.DragEvent) => {
  e.dataTransfer.setData(MEDIA_DRAG_TYPE, path);
  e.dataTransfer.effectAllowed = "copy";
};

type Section = "visual" | "ai" | "audio" | "text" | "captions";
export type LibrarySection = Section;

type Props = {
  /** Phím Alt+1…5 yêu cầu chuyển tab — `at` đổi mỗi lần bấm để bấm lại cùng tab vẫn chạy. */
  sectionRequest: { section: Section; at: number } | null;
  media: MediaItem[];
  /** Tỉ lệ khung của video — clip AI được tạo theo tỉ lệ gần nhất model hỗ trợ. */
  aspect: string;
  /** Clip AI vừa tạo xong: làm mới thư viện, gán cho cảnh nếu người dùng chọn. */
  onAiVideo: (path: string, assign: boolean) => void;
  selection: ops.Selection;
  uploading: boolean;
  currentMusic: string | null;
  onUse: (item: MediaItem) => void;
  onUpload: (files: File[]) => void;
  onAddText: (preset: Partial<TextOverlay>, label: string) => void;
  onSetMusic: (path: string) => void;
  /** Nối file thành cảnh mới ở cuối video. */
  onAppendScene: (item: MediaItem) => void;
  /** Tách âm thanh của video thành file mp3 trong thư viện. */
  onExtractAudio: (item: MediaItem) => void;
  /** Cảnh đang chọn là video → chỉ số cảnh; không thì null. Hiện nút tách âm thanh ngay trong mục Ảnh & video. */
  selectedVideoScene: number | null;
  /** Tách âm thanh của cảnh ra track riêng (tắt tiếng gốc của cảnh). */
  onDetachSceneAudio: (index: number) => void;
  /** Mục 💬 Phụ đề: danh sách câu, mỗi câu một dòng sửa được. */
  captions: Caption[];
  timeMs: number;
  selectedCaption: number | null;
  onSelectCaption: (index: number) => void;
  onCaptionText: (index: number, text: string) => void;
  /** index null = thêm sau câu cuối. */
  onInsertCaption: (index: number | null) => void;
  onDeleteCaption: (index: number) => void;
  onAddCaptionLines: (lines: string[]) => void;
};

const TEXT_PRESETS: { label: string; preview: React.CSSProperties; patch: Partial<TextOverlay> }[] = [
  { label: "Tiêu đề lớn", preview: { fontSize: 22, fontWeight: 900 }, patch: { text: "Tiêu đề lớn", size: 120, weight: 900, y: 18 } },
  { label: "Chữ giữa màn hình", preview: { fontSize: 17, fontWeight: 800 }, patch: { text: "Chữ giữa màn hình", size: 80, weight: 800, y: 50 } },
  { label: "Nhãn có nền", preview: { fontSize: 14, fontWeight: 800, background: "#ff6b2c", color: "#1a0d00", padding: "2px 8px", borderRadius: 4 }, patch: { text: "NHÃN", size: 60, weight: 800, background: "#ff6b2c", color: "#1a0d00", shadow: false, x: 25, y: 14 } },
  { label: "Hai dòng", preview: { fontSize: 14, fontWeight: 700, whiteSpace: "pre-line" }, patch: { text: "Dòng thứ nhất\nDòng thứ hai", size: 72, weight: 700, y: 50 } },
  { label: "Chữ gõ từng ký tự", preview: { fontSize: 14, fontWeight: 600, fontFamily: "ui-monospace, Menlo, monospace" }, patch: { text: "Đang gõ chữ…", size: 64, weight: 600, animation: "typewriter", y: 50 } },
  { label: "Chú thích nhỏ", preview: { fontSize: 12, fontWeight: 500, opacity: 0.85 }, patch: { text: "Chú thích nhỏ", size: 40, weight: 500, y: 90, animation: "fade" } },
];

const AUDIO_GROUPS: { key: string; title: string }[] = [
  { key: "music", title: "Nhạc nền" },
  { key: "sfx", title: "Hiệu ứng âm thanh" },
  { key: "uploads", title: "Đã tải lên" },
];

/**
 * Thư viện kiểu CapCut: thanh biểu tượng dọc chọn Ảnh/Video, Âm thanh, Văn bản.
 * Đặt bên trái hoặc bên phải trình chỉnh sửa (nút ⇄ trên thanh trên cùng).
 */
export const MediaPanel: React.FC<Props> = ({
  sectionRequest, media, aspect, selection, uploading, currentMusic, onUse, onUpload, onAddText, onSetMusic, onAppendScene, onExtractAudio, onAiVideo,
  selectedVideoScene, onDetachSceneAudio,
  captions, timeMs, selectedCaption, onSelectCaption, onCaptionText, onInsertCaption, onDeleteCaption, onAddCaptionLines,
}) => {
  const [section, setSection] = useState<Section>("visual");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (sectionRequest) setSection(sectionRequest.section);
  }, [sectionRequest]);

  const q = query.trim().toLowerCase();
  const matches = (m: MediaItem) => !q || m.path.toLowerCase().includes(q);
  const visual = media.filter((m) => m.kind !== "audio" && (filter === "all" || m.kind === filter) && matches(m));
  const audio = media.filter((m) => m.kind === "audio" && matches(m));

  const togglePreview = (path: string) => {
    const el = previewRef.current;
    if (!el) return;
    if (playing === path) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = `/public/${path}`;
    el.play().catch(() => setPlaying(null));
    setPlaying(path);
  };

  const target = selection?.type === "scene" ? `Cảnh ${selection.index + 1}` : "cảnh tại đầu phát";
  const rail: { id: Section; icon: string; label: string }[] = [
    { id: "visual", icon: "🖼", label: "Ảnh/Video" },
    { id: "audio", icon: "🎵", label: "Âm thanh" },
    { id: "text", icon: "T", label: "Văn bản" },
    { id: "captions", icon: "💬", label: "Phụ đề" },
    { id: "ai", icon: "✨", label: "Video AI" },
  ];

  const uploadButton = section === "visual" || section === "audio" ? (
    <>
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept={section === "visual" ? "image/*,video/*" : "audio/*"}
        onChange={(e) => {
          onUpload([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  ) : null;

  return (
    <aside
      className={`md ${dragOver ? "drag" : ""}`}
      onDragOver={(e) => {
        // Chỉ nhận file kéo từ máy — kéo ô trong thư viện xuống timeline không phải tải lên.
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(false);
        onUpload([...e.dataTransfer.files]);
      }}
    >
      <nav className="md-rail" aria-label="Thư viện">
        {rail.map((r, k) => (
          <button key={r.id} className={section === r.id ? "on" : ""} onClick={() => setSection(r.id)} aria-pressed={section === r.id} title={`${r.label} (Alt+${k + 1})`}>
            <span>{r.icon}</span>
            {r.label}
          </button>
        ))}
      </nav>

      <div className="md-body">
        {uploadButton}
        {dragOver ? <div className="md-dropzone">Thả file vào đây để tải lên</div> : null}

        {section === "ai" ? <AiVideoForm aspect={aspect} target={target} onDone={onAiVideo} /> : null}

        {section === "visual" || section === "audio" ? (
          <div className="md-tools">
            <input type="search" placeholder="Tìm file…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        ) : null}

        {section === "visual" ? (
          <>
            <div className="md-filter">
              {(["all", "image", "video"] as const).map((f) => (
                <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                  {f === "all" ? "Tất cả" : f === "image" ? "Ảnh" : "Video"}
                </button>
              ))}
            </div>
            {selectedVideoScene !== null ? (
              <div className="md-scene-action">
                <span>🎞 Cảnh {selectedVideoScene + 1} là video</span>
                <button
                  onClick={() => onDetachSceneAudio(selectedVideoScene)}
                  title="Âm thanh của cảnh thành một đoạn riêng trên track Âm thanh — cắt, dời, chỉnh độc lập với hình; video tắt tiếng gốc"
                >
                  🎵 Tách âm thanh cảnh
                </button>
              </div>
            ) : null}
            <p className="md-hint">Kéo xuống timeline · bấm ảnh để thay {target} · <b>＋</b> thêm vào cuối video.</p>
            <div className="md-grid">
              <button className="md-import" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <b>{uploading ? "…" : "＋"}</b>
                <span>{uploading ? "Đang tải lên…" : "Nhập ảnh/video"}</span>
                <small>hoặc kéo thả file vào</small>
              </button>
              {visual.map((m) => (
                <div key={m.path} className="md-tile" title={m.path} draggable onDragStart={dragMedia(m.path)}>
                  <button className="md-tile-main" onClick={() => onUse(m)} aria-label={`Thay ${target} bằng ${m.name}`}>
                    {m.kind === "video"
                      ? <video src={`/public/${m.path}#t=0.5`} muted playsInline preload="metadata" />
                      : <img src={`/public/${m.path}`} alt="" loading="lazy" draggable={false} />}
                    {m.kind === "video" ? <i>🎬</i> : null}
                    <span>{m.name}</span>
                  </button>
                  <button className="md-tile-add" onClick={() => onAppendScene(m)} title="Thêm thành cảnh mới ở cuối video" aria-label={`Thêm ${m.name} vào cuối video`}>＋</button>
                  {m.kind === "video" ? (
                    <div className="md-tile-actions">
                      <button onClick={() => onExtractAudio(m)} title="Tách âm thanh của video thành file riêng">🎵</button>
                    </div>
                  ) : null}
                </div>
              ))}
              {visual.length === 0 && q ? <p className="md-empty">Không có file khớp “{query}”.</p> : null}
            </div>
          </>
        ) : null}

        {section === "audio" ? (
          <div className="md-list">
            <button className="md-import row" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <b>{uploading ? "…" : "＋"}</b>
              <span>{uploading ? "Đang tải lên…" : "Nhập nhạc / âm thanh"}</span>
            </button>
            <p className="md-hint">▶ nghe thử · kéo xuống timeline hoặc <b>＋</b> thêm tại đầu phát · ♪ đặt làm nhạc nền.</p>
            {AUDIO_GROUPS.map((group) => {
              const items = audio.filter((m) => m.path.split("/")[0] === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="md-group">
                  <h4>{group.title}</h4>
                  {items.map((m) => (
                    <div key={m.path} className={`md-row ${currentMusic === m.path ? "current" : ""}`} title={m.path} draggable onDragStart={dragMedia(m.path)}>
                      <button className="md-play" onClick={() => togglePreview(m.path)} aria-label="Nghe thử">{playing === m.path ? "⏸" : "▶"}</button>
                      <span><b>{m.name.replace(/\.\w+$/, "")}</b><small>{currentMusic === m.path ? "đang là nhạc nền" : m.path.split("/")[0]}</small></span>
                      <button className="md-bg" onClick={() => onSetMusic(m.path)} title="Đặt làm nhạc nền">♪</button>
                      <button className="md-add" onClick={() => onUse(m)} title="Thêm vào timeline tại đầu phát">＋</button>
                    </div>
                  ))}
                </div>
              );
            })}
            {audio.length === 0 ? <p className="md-empty">{q ? `Không có file khớp “${query}”.` : "Chưa có file âm thanh — nhập mp3, wav hoặc m4a."}</p> : null}
          </div>
        ) : null}

        {section === "captions" ? (
          <CaptionList
            captions={captions}
            timeMs={timeMs}
            selected={selectedCaption}
            onSelect={onSelectCaption}
            onText={onCaptionText}
            onInsert={onInsertCaption}
            onDelete={onDeleteCaption}
            onAddLines={onAddCaptionLines}
          />
        ) : null}

        {section === "text" ? (
          <div className="md-list">
            <button className="md-import row" onClick={() => onAddText({}, "Văn bản")}>
              <b>＋</b>
              <span>Thêm văn bản</span>
            </button>
            <p className="md-hint">Hoặc bấm một mẫu bên dưới. Thêm xong kéo chữ trên khung xem để đặt vị trí.</p>
            <div className="tx-presets">
              {TEXT_PRESETS.map((preset) => (
                <button key={preset.label} className="tx-preset" onClick={() => onAddText(preset.patch, preset.label)}>
                  <span style={preset.preview}>{preset.patch.text}</span>
                  <small>{preset.label}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <audio ref={previewRef} onEnded={() => setPlaying(null)} hidden />
    </aside>
  );
};

/**
 * Danh sách phụ đề kiểu CapCut: mỗi câu một dòng — bấm giờ để tua tới, gõ thẳng vào ô để sửa, Enter thêm câu
 * mới ngay bên dưới, ô trống bấm Backspace/Delete để xoá. "Dán nhiều dòng" biến mỗi dòng thành một câu.
 */
const CaptionList: React.FC<{
  captions: Caption[];
  timeMs: number;
  selected: number | null;
  onSelect: (index: number) => void;
  onText: (index: number, text: string) => void;
  onInsert: (index: number | null) => void;
  onDelete: (index: number) => void;
  onAddLines: (lines: string[]) => void;
}> = ({ captions, timeMs, selected, onSelect, onText, onInsert, onDelete, onAddLines }) => {
  const listRef = useRef<HTMLDivElement>(null);
  /** Vừa thêm câu bằng Enter / nút ＋ — chờ danh sách vẽ lại rồi đưa con trỏ vào câu mới. */
  const focusNew = useRef(false);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const pasteLines = pasteText.split("\n").map((line) => line.trim()).filter(Boolean);

  useEffect(() => {
    if (selected === null) return;
    const input = listRef.current?.querySelector<HTMLInputElement>(`input[data-caption="${selected}"]`);
    if (!input) return;
    input.scrollIntoView({ block: "nearest" });
    if (focusNew.current) {
      focusNew.current = false;
      input.focus();
    }
  }, [selected, captions.length]);

  const insert = (index: number | null) => {
    focusNew.current = true;
    onInsert(index);
  };

  return (
    <div className="cl">
      <div className="cl-bar">
        <button className="cl-add" onClick={() => insert(null)} title="Thêm câu tại đầu phát, ở một hàng phụ đề mới">＋ Thêm phụ đề</button>
        <button className={pasting ? "on" : ""} onClick={() => setPasting(!pasting)}>📋 Dán nhiều dòng</button>
      </div>

      {pasting ? (
        <div className="cl-paste">
          <textarea
            rows={5}
            value={pasteText}
            placeholder={"Mỗi dòng là một câu phụ đề\nDòng thứ hai\nDòng thứ ba"}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button
            disabled={pasteLines.length === 0}
            onClick={() => {
              onAddLines(pasteLines);
              setPasteText("");
              setPasting(false);
            }}
          >
            Thêm {pasteLines.length} câu
          </button>
        </div>
      ) : null}

      <p className="md-hint">＋ Thêm phụ đề: tạo hàng phụ đề mới · Enter: câu tiếp theo cùng hàng · ô trống + Backspace: xoá câu · bấm giờ để tua tới.</p>

      <div className="cl-list" ref={listRef}>
        {captions.map((c, k) => {
          const playing = timeMs >= c.startMs && timeMs < c.endMs;
          return (
            <div key={k} className={`cl-row ${selected === k ? "on" : ""} ${playing ? "playing" : ""}`}>
              <button className="cl-time" onClick={() => onSelect(k)} title={`${fmt(c.startMs)} → ${fmt(c.endMs)} · bấm để tua tới`}>
                {fmt(c.startMs)}
              </button>
              <span className="cl-track" title={`Hàng Phụ đề ${(c.track ?? 0) + 1}`}>P{(c.track ?? 0) + 1}</span>
              <input
                data-caption={k}
                className="cl-text"
                value={c.text}
                placeholder="Nhập phụ đề…"
                onFocus={() => { if (selected !== k) onSelect(k); }}
                onChange={(e) => onText(k, e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return; // đang gõ bộ gõ tiếng Việt (IME) — để yên
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insert(k);
                  } else if ((e.key === "Backspace" || e.key === "Delete") && c.text === "") {
                    e.preventDefault();
                    onDelete(k);
                  }
                }}
              />
              <button className="cl-del" onClick={() => onDelete(k)} title="Xoá câu này" aria-label={`Xoá phụ đề ${k + 1}`}>✕</button>
            </div>
          );
        })}
        {captions.length === 0 ? <p className="md-empty">Chưa có phụ đề. Bấm “＋ Thêm phụ đề” hoặc dán nhiều dòng.</p> : null}
      </div>
    </div>
  );
};

/** /api/ai-video/models */
type VideoModelOption = {
  key: string;
  label: string;
  providerLabel: string;
  env: string;
  durations: number[];
  usdPerSecond: number | null;
  available: boolean;
};

type AiState =
  | { status: "idle" }
  | { status: "running"; line: string }
  | { status: "done"; path: string }
  | { status: "error"; message: string };

/**
 * Tạo clip từ mô tả. Chạy nền trên server (vài phút) — form vẫn dùng được phần
 * khác của trình chỉnh sửa trong lúc chờ, nên không dùng lớp phủ chặn màn hình.
 */
const AiVideoForm: React.FC<{
  aspect: string;
  target: string;
  onDone: (path: string, assign: boolean) => void;
}> = ({ aspect, target, onDone }) => {
  const [models, setModels] = useState<VideoModelOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [prompt, setPrompt] = useState("");
  const [assign, setAssign] = useState(true);
  const [state, setState] = useState<AiState>({ status: "idle" });
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api<{ models: VideoModelOption[]; defaultModel: string | null }>("/api/ai-video/models")
      .then((d) => {
        setModels(d.models);
        setModel(d.defaultModel ?? "");
      })
      .catch((e: Error) => setLoadError(e.message));
    return () => stopRef.current?.();
  }, []);

  if (loadError) return <p className="ai-note err" style={{ padding: "0 10px" }}>{loadError}</p>;
  if (!models) return <p className="md-hint">Đang tải danh sách model…</p>;

  const available = models.filter((m) => m.available);
  if (available.length === 0) {
    return (
      <div className="ai">
        <p className="ai-note">
          Chưa có key tạo video. Về trang chính › ⚙ Cài đặt › <b>Tạo video bằng AI</b>, dán một trong các key:
        </p>
        <ul className="ai-note" style={{ paddingLeft: 18 }}>
          {[...new Map(models.map((m) => [m.env, m.providerLabel])).entries()].map(([env, label]) => (
            <li key={env}>{label} — <code>{env}</code></li>
          ))}
        </ul>
      </div>
    );
  }

  const current = available.find((m) => m.key === model) ?? available[0];
  const duration = current.durations.includes(seconds)
    ? seconds
    : [...current.durations].sort((a, b) => Math.abs(a - seconds) - Math.abs(b - seconds))[0];
  const running = state.status === "running";

  const generate = async () => {
    setState({ status: "running", line: "Đang gửi yêu cầu…" });
    try {
      const { jobId } = await postJson<{ jobId: string }>("/api/ai-video", {
        prompt, model: current.key, seconds: duration, aspect,
      });
      stopRef.current = followJob(
        jobId,
        (line) => setState({ status: "running", line }),
        (status, result, error) => {
          stopRef.current = null;
          if (status === "done") {
            const path = (result as { path: string }).path;
            setState({ status: "done", path });
            onDone(path, assign);
          } else {
            setState({ status: "error", message: error ?? "Lỗi không rõ." });
          }
        },
      );
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="ai">
      <label>
        Mô tả cảnh (tiếng Anh cho kết quả tốt nhất)
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Slow dolly shot of a steaming bowl of pho on a wooden table, morning light, shallow depth of field"
          disabled={running}
        />
      </label>
      <div className="ai-row">
        <label>
          Model
          <select value={current.key} onChange={(e) => setModel(e.target.value)} disabled={running}>
            {models.map((m) => (
              <option key={m.key} value={m.key} disabled={!m.available}>
                {m.label} — {m.providerLabel}{m.available ? "" : " (thiếu key)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Độ dài
          <select value={duration} onChange={(e) => setSeconds(Number(e.target.value))} disabled={running}>
            {current.durations.map((d) => <option key={d} value={d}>{d}s</option>)}
          </select>
        </label>
      </div>
      <label className="ai-check">
        <input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} />
        Xong thì gán cho {target}
      </label>
      <p className="ai-note">
        Khung {aspect} · tiếng AI tắt khi model cho phép
        {current.usdPerSecond ? ` · ước tính $${(current.usdPerSecond * duration).toFixed(2)}` : " · giá theo bảng giá nhà cung cấp"}.
        Mỗi lần bấm là một lượt tính tiền.
      </p>
      <button className="ai-go" onClick={generate} disabled={running || !prompt.trim()}>
        {running ? "Đang tạo…" : "✨ Tạo video"}
      </button>
      {state.status === "running" ? <p className="ai-note">{state.line} — thường mất 1–5 phút.</p> : null}
      {state.status === "error" ? <p className="ai-note err">{state.message}</p> : null}
      {state.status === "done" ? (
        <>
          <p className="ai-note">Đã lưu vào thư viện 🖼 Ảnh › Video.</p>
          <div className="ai-result">
            <video src={`/public/${state.path}`} controls muted playsInline />
          </div>
        </>
      ) : null}
    </div>
  );
};
