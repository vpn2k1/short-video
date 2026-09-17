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

type Section = "visual" | "ai" | "audio" | "text" | "captions" | "stock";
export type LibrarySection = Section;

type Props = {
  /** Phím Alt+1…6 yêu cầu chuyển tab — `at` đổi mỗi lần bấm để bấm lại cùng tab vẫn chạy. */
  sectionRequest: { section: Section; at: number } | null;
  media: MediaItem[];
  /** Tỉ lệ khung của video — clip AI được tạo theo tỉ lệ gần nhất model hỗ trợ. */
  aspect: string;
  /** Clip AI vừa tạo xong: làm mới thư viện, gán cho cảnh nếu người dùng chọn. */
  onAiVideo: (path: string, assign: boolean) => void;
  /** Media vừa tải từ 🆓 Kho miễn phí: "use" = dùng ngay (thay mục đang chọn / thêm tại đầu phát), "music" = nhạc nền, "save" = chỉ lưu. */
  onStock: (path: string, kind: StockKind, action: "use" | "music" | "save", credit: string) => void;
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
  sectionRequest, media, aspect, selection, uploading, currentMusic, onUse, onUpload, onAddText, onSetMusic, onAppendOverlay, onExtractAudio, onAiVideo, onStock,
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
    { id: "stock", icon: "🆓", label: "Kho free" },
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
        {section === "stock" ? <StockPanel aspect={aspect} target={target} onStock={onStock} /> : null}

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
  const [freeMode, setFreeMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [prompt, setPrompt] = useState("");
  const [assign, setAssign] = useState(true);
  const [state, setState] = useState<AiState>({ status: "idle" });
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api<{ models: VideoModelOption[]; defaultModel: string | null; freeMode?: boolean }>("/api/ai-video/models")
      .then((d) => {
        setModels(d.models);
        setFreeMode(Boolean(d.freeMode));
        setModel(d.defaultModel ?? "");
      })
      .catch((e: Error) => setLoadError(e.message));
    return () => stopRef.current?.();
  }, []);

  if (loadError) return <p className="ai-note err" style={{ padding: "0 10px" }}>{loadError}</p>;
  if (!models) return <p className="md-hint">Đang tải danh sách model…</p>;

  const available = models.filter((m) => m.available);
  if (freeMode) {
    return (
      <div className="ai">
        <p className="ai-note">
          💚 <b>Chế độ Miễn phí</b> đang bật — video AI tính tiền theo clip nên đã tắt. Dùng ảnh/clip miễn phí trong thư viện,
          hoặc tắt chế độ này ở trang chính › ⚙ Cài đặt.
        </p>
      </div>
    );
  }
  if (available.length === 0) {
    return (
      <div className="ai">
        <p className="ai-note">
          Chưa có key tạo video. Về trang chính › ⚙ Cài đặt, dán một trong các key:
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

type StockKind = import("../../scripts/stock").StockKind;
type StockItem = import("../../scripts/stock").StockItem;
type StockProviderInfo = { id: string; label: string; kinds: StockKind[]; available: boolean; env: string };

const STOCK_KINDS: { id: StockKind; label: string }[] = [
  { id: "video", label: "Video" },
  { id: "image", label: "Ảnh" },
  { id: "music", label: "Nhạc" },
  { id: "sfx", label: "Hiệu ứng" },
];

const stockOrientation = (aspect: string) => {
  const [w, h] = aspect.split(":").map(Number);
  return !w || !h ? "any" : w === h ? "square" : w < h ? "portrait" : "landscape";
};

/**
 * 🆓 Kho miễn phí: ảnh, video (Pexels, Pixabay), nhạc và hiệu ứng (Freesound CC0/CC-BY).
 * Tải về thư viện kèm ghi nguồn — server chỉ nhận (nhà cung cấp, loại, id) rồi tự hỏi lại link tải.
 */
const StockPanel: React.FC<{
  aspect: string;
  target: string;
  onStock: (path: string, kind: StockKind, action: "use" | "music" | "save", credit: string) => void;
}> = ({ aspect, target, onStock }) => {
  const [kind, setKind] = useState<StockKind>("video");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [providers, setProviders] = useState<StockProviderInfo[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    api<{ providers: StockProviderInfo[] }>("/api/stock/providers").then((d) => setProviders(d.providers)).catch(() => setProviders([]));
  }, []);

  const usable = providers?.filter((p) => p.kinds.includes(kind)) ?? [];
  const ready = usable.filter((p) => p.available);

  const search = async (nextPage: number) => {
    if (!query.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const d = await api<{ items: StockItem[]; errors: string[] }>(`/api/stock/search?${new URLSearchParams({
        kind, q: query, page: String(nextPage), orientation: kind === "image" || kind === "video" ? stockOrientation(aspect) : "any",
      })}`);
      setItems((prev) => (nextPage === 1 ? d.items : [...prev, ...d.items]));
      setPage(nextPage);
      if (d.errors.length) setNote({ text: d.errors.join("\n"), error: true });
      else if (d.items.length === 0 && nextPage === 1) setNote({ text: "Không có kết quả — thử từ khoá tiếng Anh, ngắn hơn." });
    } catch (e) {
      setNote({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const take = async (item: StockItem, action: "use" | "music" | "save") => {
    const key = `${item.provider}-${item.id}`;
    setWorking(key);
    setNote({ text: "Đang tải về thư viện…" });
    try {
      const d = await postJson<{ path: string; credit: string; reused: boolean }>("/api/stock/download", {
        provider: item.provider, kind: item.kind, id: item.id,
      });
      onStock(d.path, item.kind, action, d.credit);
      setNote({ text: `${d.reused ? "Đã có sẵn trong thư viện" : "Đã tải"} · ${d.credit}` });
    } catch (e) {
      setNote({ text: (e as Error).message, error: true });
    } finally {
      setWorking(null);
    }
  };

  const preview = (item: StockItem) => {
    const el = audioRef.current;
    if (!el) return;
    const key = `${item.provider}-${item.id}`;
    if (playing === key) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = item.preview;
    el.play().catch(() => setPlaying(null));
    setPlaying(key);
  };

  const visual = kind === "image" || kind === "video";
  return (
    <div className="ai stock">
      <div className="md-filter">
        {STOCK_KINDS.map((k) => (
          <button key={k.id} className={kind === k.id ? "on" : ""} onClick={() => { setKind(k.id); setItems([]); setNote(null); }}>{k.label}</button>
        ))}
      </div>
      {providers && ready.length === 0 ? (
        <p className="ai-note">
          Chưa có key {usable.map((p) => p.label).join(" hoặc ")} — lấy key <b>miễn phí</b> rồi điền ở trang chính › ⚙ Cài đặt ›
          Miễn phí · Ảnh, clip & nhạc.
        </p>
      ) : (
        <>
          <form className="stock-search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); void search(1); }}>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} disabled={busy}
              placeholder={visual ? "vd: city night, coffee pour" : kind === "music" ? "vd: lofi, upbeat, cinematic" : "vd: whoosh, click, pop"} />
            <button type="submit" className="ai-go" disabled={busy || !query.trim()}>{busy ? "…" : "Tìm"}</button>
          </form>
          <p className="ai-note">
            {ready.map((p) => p.label).join(" + ")} · miễn phí, dùng thương mại được{kind === "music" || kind === "sfx" ? " (CC0/CC-BY)" : ""} ·
            tự ghi nguồn. Tìm bằng tiếng Anh cho nhiều kết quả hơn.
          </p>
        </>
      )}
      {note ? <p className={`ai-note ${note.error ? "err" : ""}`}>{note.text}</p> : null}

      {visual ? (
        <div className="md-grid">
          {items.map((item) => {
            const key = `${item.provider}-${item.id}`;
            return (
              <div key={key} className="md-tile" title={`${item.title} — ${item.author} (${item.provider})`}>
                <button className="md-tile-main" onClick={() => take(item, "use")} disabled={working !== null} aria-label={`Dùng cho ${target}`}>
                  <img src={item.preview} alt="" loading="lazy" draggable={false} />
                  {item.kind === "video" ? <i>🎬 {item.duration}s</i> : null}
                  <span>{working === key ? "Đang tải…" : `${item.provider} · ${item.author}`}</span>
                </button>
                <button className="md-tile-add" onClick={() => take(item, "save")} disabled={working !== null} title="Chỉ lưu vào thư viện">⬇</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="md-list">
          {items.map((item) => {
            const key = `${item.provider}-${item.id}`;
            return (
              <div key={key} className="md-row" title={`${item.title} — ${item.author} (${item.license})`}>
                <button className="md-play" onClick={() => preview(item)} aria-label="Nghe thử">{playing === key ? "⏸" : "▶"}</button>
                <span><b>{item.title}</b><small>{item.duration}s · {item.author} · {item.license}</small></span>
                {item.kind === "music" ? (
                  <button className="md-bg" onClick={() => take(item, "music")} disabled={working !== null} title="Tải và đặt làm nhạc nền">♪</button>
                ) : null}
                <button className="md-add" onClick={() => take(item, "use")} disabled={working !== null} title="Tải và thêm tại đầu phát">
                  {working === key ? "…" : "＋"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {items.length > 0 && !busy ? (
        <button className="btn-more" onClick={() => void search(page + 1)}>Xem thêm</button>
      ) : null}
      <p className="ai-note">
        {visual ? `Bấm ô: dùng cho ${target} · ⬇ chỉ lưu vào thư viện.` : "▶ nghe thử · ♪ đặt làm nhạc nền · ＋ thêm tại đầu phát."}
      </p>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} hidden />
    </div>
  );
};
