import { useEffect, useRef, useState } from "react";
import type { TextOverlay } from "../../src/compositions/Short/schema";
import { api, followJob, postJson, type MediaItem } from "./api";
import type * as ops from "./ops";

type Section = "visual" | "ai" | "audio" | "text";

type Props = {
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
  media, aspect, selection, uploading, currentMusic, onUse, onUpload, onAddText, onSetMusic, onAppendScene, onExtractAudio, onAiVideo,
}) => {
  const [section, setSection] = useState<Section>("visual");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement>(null);

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
    { id: "visual", icon: "🖼", label: "Ảnh" },
    { id: "ai", icon: "✨", label: "AI" },
    { id: "audio", icon: "🔊", label: "Âm thanh" },
    { id: "text", icon: "🅣", label: "Văn bản" },
  ];

  const uploadButton = section === "visual" || section === "audio" ? (
    <>
      <button className="md-upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? "Đang tải…" : "⬆ Tải lên"}
      </button>
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
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onUpload([...e.dataTransfer.files]);
      }}
    >
      <nav className="md-rail" aria-label="Thư viện">
        {rail.map((r) => (
          <button key={r.id} className={section === r.id ? "on" : ""} onClick={() => setSection(r.id)} aria-pressed={section === r.id}>
            <span>{r.icon}</span>
            {r.label}
          </button>
        ))}
      </nav>

      <div className="md-body">
        <div className="md-head">
          <b>{{ visual: "Ảnh & video", ai: "Tạo video bằng AI", audio: "Âm thanh", text: "Văn bản" }[section]}</b>
          {uploadButton}
        </div>

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
            <p className="md-hint">Bấm để gán cho {target} · ＋ thêm thành cảnh mới ở cuối · 🎵 tách âm thanh của video.</p>
            <div className="md-grid">
              {visual.map((m) => (
                <div key={m.path} className="md-tile" title={m.path}>
                  <button className="md-tile-main" onClick={() => onUse(m)} aria-label={`Gán ${m.name} cho ${target}`}>
                    {m.kind === "video"
                      ? <video src={`/public/${m.path}#t=0.5`} muted playsInline preload="metadata" />
                      : <img src={`/public/${m.path}`} alt="" loading="lazy" />}
                    {m.kind === "video" ? <i>🎬</i> : null}
                    <span>{m.name}</span>
                  </button>
                  <div className="md-tile-actions">
                    <button onClick={() => onAppendScene(m)} title="Thêm thành cảnh mới ở cuối video">＋</button>
                    {m.kind === "video" ? (
                      <button onClick={() => onExtractAudio(m)} title="Tách âm thanh của video thành file riêng">🎵</button>
                    ) : null}
                  </div>
                </div>
              ))}
              {visual.length === 0 ? <p className="md-empty">Chưa có file phù hợp. Tải lên để bắt đầu.</p> : null}
            </div>
          </>
        ) : null}

        {section === "audio" ? (
          <div className="md-list">
            <p className="md-hint">▶ nghe thử · ＋ thêm vào timeline tại đầu phát · ♪ đặt làm nhạc nền.</p>
            {AUDIO_GROUPS.map((group) => {
              const items = audio.filter((m) => m.path.split("/")[0] === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="md-group">
                  <h4>{group.title}</h4>
                  {items.map((m) => (
                    <div key={m.path} className={`md-row ${currentMusic === m.path ? "current" : ""}`} title={m.path}>
                      <button className="md-play" onClick={() => togglePreview(m.path)} aria-label="Nghe thử">{playing === m.path ? "⏸" : "▶"}</button>
                      <span><b>{m.name.replace(/\.\w+$/, "")}</b><small>{currentMusic === m.path ? "đang là nhạc nền" : m.path.split("/")[0]}</small></span>
                      <button className="md-bg" onClick={() => onSetMusic(m.path)} title="Đặt làm nhạc nền">♪</button>
                      <button className="md-add" onClick={() => onUse(m)} title="Thêm vào timeline tại đầu phát">＋</button>
                    </div>
                  ))}
                </div>
              );
            })}
            {audio.length === 0 ? <p className="md-empty">Chưa có file âm thanh. Tải lên mp3/wav/m4a.</p> : null}
          </div>
        ) : null}

        {section === "text" ? (
          <div className="md-list">
            <p className="md-hint">Bấm một mẫu để thêm tại đầu phát, rồi kéo trên khung xem trước để đặt vị trí.</p>
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
