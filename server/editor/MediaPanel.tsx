import { useEffect, useRef, useState } from "react";
import type { Caption, TextOverlay } from "../../src/compositions/Short/schema";
import { api, fmt, followJob, postJson, type MediaItem } from "./api";
import type * as ops from "./ops";
import { MEDIA_DRAG_TYPE } from "./Timeline";
import {
  cuesDurationMs, EXAMPLE_SRT, EXAMPLE_TXT, EXAMPLE_TXT_TIME, FORMAT_LABELS, looksLikeSubtitleFile,
  parseSubtitleFile, SUBTITLE_ACCEPT, type Cue, type ParsedSubtitles,
} from "./subtitle-import";

/** Kéo một file từ thư viện — timeline nhận kiểu dữ liệu riêng, không nhầm với kéo file từ máy. */
const dragMedia = (path: string) => (e: React.DragEvent) => {
  e.dataTransfer.setData(MEDIA_DRAG_TYPE, path);
  e.dataTransfer.effectAllowed = "copy";
};

/** Tải một file mẫu về máy để người dùng sửa nội dung rồi nhập lại. */
const downloadSample = (name: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

type Section = "visual" | "ai" | "audio" | "text" | "captions" | "bili";
export type LibrarySection = Section;

type Props = {
  /** Phím Alt+1…6 yêu cầu chuyển tab — `at` đổi mỗi lần bấm để bấm lại cùng tab vẫn chạy. */
  sectionRequest: { section: Section; at: number } | null;
  media: MediaItem[];
  /** Tỉ lệ khung của video — clip AI được tạo theo tỉ lệ gần nhất model hỗ trợ. */
  aspect: string;
  /** Clip AI vừa tạo xong: làm mới thư viện, gán cho cảnh nếu người dùng chọn. */
  onAiVideo: (path: string, assign: boolean) => void;
  /** Clip tư liệu Bilibili vừa tải xong: làm mới thư viện, gán cho cảnh nếu người dùng chọn. */
  onBiliVideo: (path: string, assign: boolean) => void;
  selection: ops.Selection;
  uploading: boolean;
  currentMusic: string | null;
  onUse: (item: MediaItem) => void;
  onUpload: (files: File[]) => void;
  onAddText: (preset: Partial<TextOverlay>, label: string) => void;
  onSetMusic: (path: string) => void;
  /** Nối file thành một video mới ở cuối hàng Video 1. */
  onAppendOverlay: (item: MediaItem) => void;
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
  /** Nhập phụ đề từ file — file đã được đọc và bóc tách ngay trong trình duyệt. */
  onImportCaptions: (cues: Cue[], opts: { replace: boolean; shiftToPlayhead: boolean }) => void;
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
  sectionRequest, media, aspect, selection, uploading, currentMusic, onUse, onUpload, onAddText, onSetMusic, onAppendOverlay, onExtractAudio, onAiVideo, onBiliVideo,
  selectedVideoScene, onDetachSceneAudio,
  captions, timeMs, selectedCaption, onSelectCaption, onCaptionText, onInsertCaption, onDeleteCaption, onAddCaptionLines, onImportCaptions,
}) => {
  const [section, setSection] = useState<Section>("visual");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /** File phụ đề vừa thả vào khi đang ở tab 💬 Phụ đề — chuyển xuống danh sách phụ đề để đọc. */
  const [droppedSubtitle, setDroppedSubtitle] = useState<File | null>(null);
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

  // Bấm một ô trong thư viện: đang chọn video/cảnh nào thì thay hình của nó, không chọn gì thì thêm video mới.
  const target = selection?.type === "overlay"
    ? "thay video đang chọn"
    : selection?.type === "scene" ? `thay Cảnh ${selection.index + 1}` : "thêm video tại đầu phát";
  const rail: { id: Section; icon: string; label: string }[] = [
    { id: "visual", icon: "🖼", label: "Ảnh/Video" },
    { id: "audio", icon: "🎵", label: "Âm thanh" },
    { id: "text", icon: "T", label: "Văn bản" },
    { id: "captions", icon: "💬", label: "Phụ đề" },
    { id: "ai", icon: "✨", label: "Video AI" },
    { id: "bili", icon: "📺", label: "Bilibili" },
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
        const files = [...e.dataTransfer.files];
        // Đang ở tab Phụ đề mà thả file .srt/.txt: nhập thành phụ đề thay vì tải lên thư viện.
        const subtitle = section === "captions" ? files.find(looksLikeSubtitleFile) : undefined;
        if (subtitle) setDroppedSubtitle(subtitle);
        else onUpload(files);
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
        {dragOver ? (
          <div className="md-dropzone">
            {section === "captions" ? "Thả file phụ đề (.srt, .vtt, .txt) vào đây" : "Thả file vào đây để tải lên"}
          </div>
        ) : null}

        {section === "ai" ? <AiVideoForm aspect={aspect} target={target} onDone={onAiVideo} /> : null}
        {section === "bili" ? <BilibiliPanel target={target} onDone={onBiliVideo} /> : null}

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
            <p className="md-hint">
              Kéo xuống timeline để đặt đúng chỗ · bấm ảnh để {target} · <b>＋</b> nối vào cuối.
            </p>
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
                  <button
                    className="md-tile-add"
                    onClick={() => onAppendOverlay(m)}
                    title="Nối vào cuối hàng Video 1"
                    aria-label={`Nối ${m.name} vào cuối video`}
                  >
                    ＋
                  </button>
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
            onImport={onImportCaptions}
            dropped={droppedSubtitle}
            onDroppedHandled={() => setDroppedSubtitle(null)}
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
  onImport: (cues: Cue[], opts: { replace: boolean; shiftToPlayhead: boolean }) => void;
  /** File phụ đề người dùng thả vào panel. */
  dropped: File | null;
  onDroppedHandled: () => void;
}> = ({ captions, timeMs, selected, onSelect, onText, onInsert, onDelete, onAddLines, onImport, dropped, onDroppedHandled }) => {
  const listRef = useRef<HTMLDivElement>(null);
  /** Vừa thêm câu bằng Enter / nút ＋ — chờ danh sách vẽ lại rồi đưa con trỏ vào câu mới. */
  const focusNew = useRef(false);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const pasteLines = pasteText.split("\n").map((line) => line.trim()).filter(Boolean);
  const fileRef = useRef<HTMLInputElement>(null);
  /** File đã đọc xong, đang chờ người dùng xác nhận. */
  const [pending, setPending] = useState<{ name: string; parsed: ParsedSubtitles } | null>(null);
  const [replace, setReplace] = useState(false);
  const [shift, setShift] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readSubtitleFile = async (file: File) => {
    setError(null);
    try {
      const parsed = parseSubtitleFile(await file.text());
      if (parsed.cues.length === 0) {
        setPending(null);
        setError(`Không đọc được câu nào trong ${file.name}. Xem ví dụ bên dưới để biết cách viết file.`);
        return;
      }
      setPasting(false);
      setReplace(false);
      setShift(false);
      setPending({ name: file.name, parsed });
    } catch {
      setPending(null);
      setError(`Không đọc được ${file.name} — file phải là văn bản (.srt, .vtt, .txt, .json).`);
    }
  };

  // Thả file vào panel khi đang ở tab Phụ đề.
  useEffect(() => {
    if (!dropped) return;
    void readSubtitleFile(dropped);
    onDroppedHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped]);

  const range = pending ? cuesDurationMs(pending.parsed.cues) : null;

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
        <button
          className={pending ? "on" : ""}
          onClick={() => fileRef.current?.click()}
          title="Nhập file .srt, .vtt, .txt hoặc .json — kéo thả file vào đây cũng được"
        >
          📂 Nhập file
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={SUBTITLE_ACCEPT}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readSubtitleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error ? <p className="cl-err">{error}</p> : null}

      {pending ? (
        <div className="cl-import">
          <p className="cl-import-head">
            <b>📄 {pending.name}</b>
            <small>
              {FORMAT_LABELS[pending.parsed.format]} · {pending.parsed.cues.length} câu
              {range ? ` · ${fmt(range.fromMs)} → ${fmt(range.toMs)}` : ""}
            </small>
          </p>
          {pending.parsed.notes.map((note) => <small key={note} className="cl-note">{note}</small>)}
          <label>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Thay toàn bộ {captions.length} câu đang có
          </label>
          {range ? (
            <label>
              <input type="checkbox" checked={shift} onChange={(e) => setShift(e.target.checked)} />
              Dời cả cụm về đầu phát ({fmt(timeMs)})
            </label>
          ) : null}
          <div className="cl-import-foot">
            <button className="ghost" onClick={() => setPending(null)}>Huỷ</button>
            <button
              onClick={() => {
                onImport(pending.parsed.cues, { replace, shiftToPlayhead: shift });
                setPending(null);
              }}
            >
              Thêm {pending.parsed.cues.length} câu
            </button>
          </div>
        </div>
      ) : null}

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

      <details className="cl-help">
        <summary>📖 File phụ đề viết thế nào? (có file mẫu)</summary>
        <div className="cl-help-body">
          <p><b>Cách dễ nhất — file .txt, mỗi dòng một câu.</b> Không cần mốc giờ: các câu được rải nối tiếp nhau theo độ dài chữ, kéo trên timeline để chỉnh lại.</p>
          <pre>{EXAMPLE_TXT}</pre>
          <button onClick={() => downloadSample("phu-de-mau.txt", EXAMPLE_TXT)}>⬇ Tải mẫu .txt</button>

          <p><b>Có sẵn thời gian — file .srt hoặc .vtt</b> (xuất từ CapCut, YouTube, Premiere…). Giờ trong file được giữ nguyên.</p>
          <pre>{EXAMPLE_SRT}</pre>
          <button onClick={() => downloadSample("phu-de-mau.srt", EXAMPLE_SRT)}>⬇ Tải mẫu .srt</button>

          <p><b>Gõ tay kèm mốc giờ</b> cũng được — mỗi dòng bắt đầu bằng phút:giây.</p>
          <pre>{EXAMPLE_TXT_TIME}</pre>
          <p className="cl-note">Ngoài ra nhận .json dạng [{"{ \"text\": \"…\", \"startMs\": 0, \"endMs\": 2400 }"}]. Kéo thả file vào panel này cũng nhập được.</p>
        </div>
      </details>

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

/** Kiểu dữ liệu của scripts/bilibili.ts — chỉ import kiểu, không kéo code server vào trình duyệt. */
type BiliResult = import("../../scripts/bilibili").BiliResult;
type BiliDetail = import("../../scripts/bilibili").BiliDetail;

const BILI_KEYWORDS = ["免费商用 视频素材", "空镜头 可商用", "航拍 免费素材", "CC0 素材", "欢迎二创"];

const BILI_ORDER_LABELS: [string, string][] = [
  ["totalrank", "Phù hợp nhất"],
  ["click", "Nhiều lượt xem"],
  ["pubdate", "Mới nhất"],
  ["stow", "Nhiều lượt lưu"],
];

const clockText = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s % 60).padStart(2, "0")}`;
};

/** "1:23" / "83" / "1:02:03" → giây; ô trống → null; gõ sai → NaN. */
const parseClock = (text: string): number | null => {
  const value = text.trim();
  if (!value) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) return Number.NaN;
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
};

const compactCount = (n: number) => (n >= 10_000 ? `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)} vạn` : String(n));

/**
 * Tìm tư liệu trên Bilibili — chỉ hiện video tác giả ghi rõ cho phép dùng. Server lọc theo lời tác giả,
 * kiểm tra lại khi mở chi tiết và ngay trước khi tải; người dùng đọc câu cho phép rồi xác nhận mới tải được.
 */
const BilibiliPanel: React.FC<{
  target: string;
  onDone: (path: string, assign: boolean) => void;
}> = ({ target, onDone }) => {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState("totalrank");
  const [results, setResults] = useState<BiliResult[]>([]);
  const [stats, setStats] = useState<{ page: number; pages: number; scanned: number; kept: number } | null>(null);
  const [busy, setBusy] = useState<"search" | "translate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tool, setTool] = useState<{ version: string | null; updating: string | null }>({ version: null, updating: null });
  /** Kết quả đã qua kiểm tra chi tiết (video tự làm, không trả phí, mô tả đầy đủ vẫn cho phép). */
  const [verified, setVerified] = useState<Set<string>>(() => new Set());
  const [rejected, setRejected] = useState(0);
  const checking = useRef<string | null>(null);

  useEffect(() => {
    api<{ version: string | null }>("/api/bilibili/tool").then((d) => setTool((t) => ({ ...t, version: d.version }))).catch(() => {});
  }, []);

  // Kiểm tra lần lượt từng kết quả ở nền — server gọi Bilibili thưa ra nên không bị chặn.
  // Kết quả nào không qua thì bỏ khỏi danh sách; kiểm tra lỗi mạng thì giữ lại, mở chi tiết sẽ kiểm tra lại.
  useEffect(() => {
    if (checking.current) return;
    const next = results.find((r) => !verified.has(r.bvid));
    if (!next) return;
    checking.current = next.bvid;
    api<BiliDetail>(`/api/bilibili/detail/${next.bvid}`)
      .then((d) => {
        if (d.permission) return;
        setResults((prev) => prev.filter((r) => r.bvid !== next.bvid));
        setRejected((n) => n + 1);
      })
      .catch(() => {})
      .finally(() => {
        checking.current = null;
        setVerified((prev) => new Set(prev).add(next.bvid));
      });
  }, [results, verified]);

  const search = async (page: number, keyword = query) => {
    if (!keyword.trim()) return;
    setBusy("search");
    setError(null);
    try {
      const d = await api<{ results: BiliResult[]; scanned: number; page: number; pages: number }>(
        `/api/bilibili/search?${new URLSearchParams({ q: keyword, page: String(page), order })}`,
      );
      if (page === 1) setRejected(0);
      setResults((prev) => {
        const base = page === 1 ? [] : prev;
        const seen = new Set(base.map((r) => r.bvid));
        return [...base, ...d.results.filter((r) => !seen.has(r.bvid))];
      });
      setStats((prev) => ({
        page: d.page,
        pages: d.pages,
        scanned: (page === 1 ? 0 : prev?.scanned ?? 0) + d.scanned,
        kept: (page === 1 ? 0 : prev?.kept ?? 0) + d.results.length,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const translate = async () => {
    setBusy("translate");
    setError(null);
    try {
      const { keywords } = await postJson<{ keywords: string }>("/api/bilibili/translate", { text: query });
      setQuery(keywords);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const updateTool = async () => {
    setTool((t) => ({ ...t, updating: "Đang cập nhật…" }));
    try {
      const { jobId } = await postJson<{ jobId: string }>("/api/bilibili/tool/update", {});
      followJob(jobId, (line) => setTool((t) => ({ ...t, updating: line })), (status, result, err) => {
        setTool((t) => ({
          version: status === "done" ? (result as { version: string | null }).version : t.version,
          updating: null,
        }));
        if (status !== "done") setError(err ?? "Cập nhật yt-dlp thất bại.");
      });
    } catch (e) {
      setTool((t) => ({ ...t, updating: null }));
      setError((e as Error).message);
    }
  };

  if (open) return <BilibiliDetailView bvid={open} target={target} onBack={() => setOpen(null)} onDone={onDone} />;

  const hasCjk = /[一-鿿]/.test(query);
  return (
    <div className="ai bl">
      <p className="ai-note">
        Chỉ hiện video <b>tác giả ghi rõ cho phép dùng</b> (可商用, 免费使用, CC0…). Video đăng lại, trả phí hay có câu cấm đều bị loại.
        Tìm bằng tiếng Trung cho nhiều kết quả hơn.
      </p>
      <form className="bl-search" onSubmit={(e) => { e.preventDefault(); void search(1); }}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="航拍 城市 免费商用" disabled={busy !== null} />
        {query.trim() && !hasCjk ? (
          <button type="button" onClick={translate} disabled={busy !== null} title="Dịch từ khoá sang tiếng Trung bằng AI trong Cài đặt">
            {busy === "translate" ? "…" : "文 Dịch"}
          </button>
        ) : null}
        <button type="submit" className="ai-go" disabled={busy !== null || !query.trim()}>{busy === "search" ? "…" : "Tìm"}</button>
      </form>
      <div className="bl-chips">
        {BILI_KEYWORDS.map((k) => (
          <button key={k} type="button" disabled={busy !== null} onClick={() => { setQuery(k); void search(1, k); }}>{k}</button>
        ))}
      </div>
      <label>
        Sắp xếp
        <select value={order} onChange={(e) => setOrder(e.target.value)} disabled={busy !== null}>
          {BILI_ORDER_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      {error ? <p className="ai-note err">{error}</p> : null}
      {stats ? (
        <p className="ai-note">
          {stats.kept - rejected}/{stats.scanned} video có lời cho phép
          {rejected ? ` · loại thêm ${rejected} sau khi kiểm tra kỹ` : ""} · trang {stats.page}/{stats.pages}
        </p>
      ) : null}

      <div className="bl-list">
        {results.map((r) => (
          <button key={r.bvid} className="bl-item" onClick={() => setOpen(r.bvid)} title={r.permission.quote}>
            <span className="bl-cover">
              <img src={r.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <i>{clockText(r.duration)}</i>
            </span>
            <span className="bl-meta">
              <b>{r.title}</b>
              <small>{r.author} · {compactCount(r.plays)} lượt xem</small>
              <span className="bl-tags">
                {r.permission.labels.map((l) => <em key={l}>✓ {l}</em>)}
                {verified.has(r.bvid) ? null : <em className="pending">đang kiểm tra…</em>}
              </span>
            </span>
          </button>
        ))}
        {stats && results.length === 0 && busy === null ? (
          <p className="md-empty">Chưa thấy video nào tác giả cho phép dùng. Thử thêm “免费商用” hoặc “素材” vào từ khoá, hoặc tìm trang sau.</p>
        ) : null}
      </div>
      {stats && stats.page < stats.pages ? (
        <button type="button" className="bl-more" disabled={busy !== null} onClick={() => void search(stats.page + 1)}>
          {busy === "search" ? "Đang tìm…" : "Tìm trang sau"}
        </button>
      ) : null}

      <p className="ai-note bl-tool">
        Bộ tải: yt-dlp {tool.version ?? "chưa có"} ·{" "}
        <button type="button" onClick={updateTool} disabled={tool.updating !== null}>{tool.updating ?? "Cập nhật"}</button>
        <br />Tải lỗi sau khi Bilibili đổi trang thì bấm Cập nhật.
      </p>
    </div>
  );
};

type BiliDownloadState =
  | { status: "idle" }
  | { status: "running"; line: string }
  | { status: "done"; path: string; credit: string }
  | { status: "error"; message: string };

const BilibiliDetailView: React.FC<{
  bvid: string;
  target: string;
  onBack: () => void;
  onDone: (path: string, assign: boolean) => void;
}> = ({ bvid, target, onBack, onDone }) => {
  const [detail, setDetail] = useState<BiliDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [part, setPart] = useState(1);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [height, setHeight] = useState(1080);
  const [confirmed, setConfirmed] = useState(false);
  const [assign, setAssign] = useState(true);
  const [state, setState] = useState<BiliDownloadState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api<BiliDetail>(`/api/bilibili/detail/${bvid}`).then(setDetail).catch((e: Error) => setLoadError(e.message));
    return () => stopRef.current?.();
  }, [bvid]);

  const back = <button type="button" className="bl-back" onClick={onBack}>‹ Kết quả tìm kiếm</button>;
  if (loadError) return <div className="ai bl">{back}<p className="ai-note err">{loadError}</p></div>;
  if (!detail) return <div className="ai bl">{back}<p className="md-hint">Đang kiểm tra quyền sử dụng…</p></div>;

  const current = detail.parts.find((p) => p.page === part) ?? detail.parts[0];
  const startSec = parseClock(start);
  const endSec = parseClock(end);
  const rangeError =
    Number.isNaN(startSec) || Number.isNaN(endSec)
      ? "Giờ gõ dạng phút:giây, ví dụ 1:05."
      : (startSec ?? 0) >= (endSec ?? current.duration)
        ? "Điểm cuối phải sau điểm bắt đầu."
        : (endSec ?? 0) > current.duration
          ? `Phần này chỉ dài ${clockText(current.duration)}.`
          : null;
  const running = state.status === "running";

  const download = async () => {
    setState({ status: "running", line: "Đang gửi yêu cầu…" });
    try {
      const { jobId } = await postJson<{ jobId: string }>("/api/bilibili/download", {
        bvid, part: current.page, start: startSec, end: endSec, maxHeight: height, confirmed,
      });
      stopRef.current = followJob(
        jobId,
        (line) => setState({ status: "running", line }),
        (status, result, error) => {
          stopRef.current = null;
          if (status === "done") {
            const r = result as { path: string; credit: string };
            setState({ status: "done", ...r });
            onDone(r.path, assign);
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
    <div className="ai bl">
      {back}
      <div className="bl-player">
        <iframe
          src={`https://player.bilibili.com/player.html?${new URLSearchParams({ bvid, p: String(current.page), autoplay: "0", danmaku: "0" })}`}
          title={detail.title}
          allow="fullscreen; picture-in-picture"
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="bl-title"><b>{detail.title}</b><small>{detail.author} · <a href={detail.url} target="_blank" rel="noreferrer">Mở trên Bilibili ↗</a></small></p>

      {detail.permission ? (
        <div className="bl-permit">
          <span className="bl-tags">{detail.permission.labels.map((l) => <em key={l}>✓ {l}</em>)}</span>
          <blockquote>{detail.permission.quote}</blockquote>
          <details>
            <summary>Đọc toàn bộ mô tả của tác giả</summary>
            <p>{detail.desc || "(trống)"}</p>
          </details>
          <p className="ai-note">
            Dùng đúng điều kiện tác giả nêu (ví dụ “不得用于售卖” = không được bán lại chính tư liệu).
            {detail.noReprintFlag ? " Video có bật dấu “cấm đăng lại khi chưa được phép” mặc định của Bilibili — lời cho phép trên chính là sự cho phép của tác giả; nên dùng làm tư liệu trong video của bạn, không đăng lại nguyên bản." : ""}
          </p>
        </div>
      ) : (
        <p className="ai-note err">Không dùng được video này: {detail.reason}</p>
      )}

      {detail.permission ? (
        <>
          {detail.parts.length > 1 ? (
            <label>
              Phần
              <select value={current.page} onChange={(e) => setPart(Number(e.target.value))} disabled={running}>
                {detail.parts.map((p) => <option key={p.page} value={p.page}>P{p.page} · {p.title} ({clockText(p.duration)})</option>)}
              </select>
            </label>
          ) : null}
          <div className="bl-range">
            <label>Từ<input value={start} onChange={(e) => setStart(e.target.value)} placeholder="0:00" disabled={running} /></label>
            <label>Đến<input value={end} onChange={(e) => setEnd(e.target.value)} placeholder={clockText(current.duration)} disabled={running} /></label>
            <label>
              Chất lượng
              <select value={height} onChange={(e) => setHeight(Number(e.target.value))} disabled={running}>
                <option value={1080}>1080p</option>
                <option value={720}>720p</option>
              </select>
            </label>
          </div>
          <p className="ai-note">Để trống là tải cả phần {clockText(current.duration)} — chỉ lấy đoạn cần dùng cho nhẹ.</p>
          {rangeError ? <p className="ai-note err">{rangeError}</p> : null}
          <label className="ai-check">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={running} />
            Tôi đã đọc lời cho phép và sẽ dùng đúng điều kiện của tác giả, có ghi nguồn
          </label>
          <label className="ai-check">
            <input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} disabled={running} />
            Xong thì gán cho {target}
          </label>
          <button className="ai-go" onClick={download} disabled={running || !confirmed || rangeError !== null}>
            {running ? "Đang tải…" : "⬇ Tải vào dự án"}
          </button>
        </>
      ) : null}

      {state.status === "running" ? <p className="ai-note">{state.line}</p> : null}
      {state.status === "error" ? <p className="ai-note err">{state.message}</p> : null}
      {state.status === "done" ? (
        <>
          <p className="ai-note">Đã lưu vào thư viện 🖼 Ảnh › Video, kèm bằng chứng cho phép ({state.path.replace(/\.mp4$/, ".json")}).</p>
          <div className="bl-credit">
            <span>{state.credit}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(state.credit).then(() => setCopied(true), () => {})}
            >
              {copied ? "Đã chép" : "Chép ghi nguồn"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};
