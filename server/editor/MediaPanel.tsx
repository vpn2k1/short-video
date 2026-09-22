import { Captions, Gift, Image as ImageIcon, Music, Sparkles, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Caption, TextOverlay } from "../../src/compositions/Short/schema";
import type { MediaItem } from "./api";
import type { StockKind } from "./query";
import type * as ops from "./ops";
import { looksLikeSubtitleFile, type Cue } from "./subtitle-import";
import { AiVideoForm } from "./media/AiVideoForm";
import { AudioLibrary } from "./media/AudioLibrary";
import { CaptionList } from "./media/CaptionList";
import { StockPanel } from "./media/StockPanel";
import { TextPresets } from "./media/TextPresets";
import { VisualLibrary, type VisualFilter } from "./media/VisualLibrary";

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
  /** Media vừa tải từ Kho miễn phí: "use" = dùng ngay (thay mục đang chọn / thêm tại đầu phát), "music" = nhạc nền, "save" = chỉ lưu. */
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
  /** Mục Phụ đề: danh sách câu, mỗi câu một dòng sửa được. */
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

/**
 * Thư viện kiểu CapCut: thanh biểu tượng dọc chọn Ảnh/Video, Âm thanh, Văn bản.
 * Đặt bên trái hoặc bên phải trình chỉnh sửa (nút đổi bên trên thanh trên cùng).
 */
export const MediaPanel: React.FC<Props> = ({
  sectionRequest, media, aspect, selection, uploading, currentMusic, onUse, onUpload, onAddText, onSetMusic, onAppendOverlay, onExtractAudio, onAiVideo, onStock,
  selectedVideoScene, onDetachSceneAudio,
  captions, timeMs, selectedCaption, onSelectCaption, onCaptionText, onInsertCaption, onDeleteCaption, onAddCaptionLines, onImportCaptions,
}) => {
  const [section, setSection] = useState<Section>("visual");
  const [filter, setFilter] = useState<VisualFilter>("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /** File phụ đề vừa thả vào khi đang ở tab Phụ đề — chuyển xuống danh sách phụ đề để đọc. */
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
  const rail: { id: Section; icon: React.ReactNode; label: string }[] = [
    { id: "visual", icon: <ImageIcon size={16} aria-hidden />, label: "Ảnh/Video" },
    { id: "audio", icon: <Music size={16} aria-hidden />, label: "Âm thanh" },
    { id: "text", icon: <Type size={16} aria-hidden />, label: "Văn bản" },
    { id: "captions", icon: <Captions size={16} aria-hidden />, label: "Phụ đề" },
    { id: "ai", icon: <Sparkles size={16} aria-hidden />, label: "Video AI" },
    { id: "stock", icon: <Gift size={16} aria-hidden />, label: "Kho free" },
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
          <VisualLibrary
            visual={visual}
            filter={filter}
            onFilter={setFilter}
            q={q}
            query={query}
            target={target}
            uploading={uploading}
            onImportClick={() => fileRef.current?.click()}
            onUse={onUse}
            onAppendOverlay={onAppendOverlay}
            onExtractAudio={onExtractAudio}
            selectedVideoScene={selectedVideoScene}
            onDetachSceneAudio={onDetachSceneAudio}
          />
        ) : null}

        {section === "audio" ? (
          <AudioLibrary
            audio={audio}
            q={q}
            query={query}
            uploading={uploading}
            currentMusic={currentMusic}
            playing={playing}
            onTogglePreview={togglePreview}
            onImportClick={() => fileRef.current?.click()}
            onUse={onUse}
            onSetMusic={onSetMusic}
          />
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

        {section === "text" ? <TextPresets onAddText={onAddText} /> : null}
      </div>
      <audio ref={previewRef} onEnded={() => setPlaying(null)} hidden />
    </aside>
  );
};
