import { Clapperboard, Gift, Repeat, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { MediaItem } from "../api";
import type { LibrarySection } from "../MediaPanel";

/**
 * Thay thế hình của khối đang chọn: chọn file từ máy (bấm hoặc kéo thả vào), chọn trong thư viện,
 * hoặc mở Kho free / Video AI — kết quả ở đó bấm "Dùng" cũng thay đúng khối này. Không phải xoá rồi thêm lại.
 */
export const ReplaceMedia: React.FC<{
  current: string;
  media: MediaItem[];
  uploading: boolean;
  onPick: (item: MediaItem) => void;
  onFile: (file: File) => void;
  onOpenLibrary: (section: LibrarySection) => void;
  /** Cảnh chưa có hình thì đây là "chọn", không phải "thay". */
  title?: string;
  note?: string;
  /** Panel gom khối theo prop này của phần tử con — đặt ở đây để mục có tab riêng. */
  "data-tab"?: string;
}> = ({ current, media, uploading, onPick, onFile, onOpenLibrary, title, note, "data-tab": tab }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const search = useForm<{ query: string; filter: "all" | "image" | "video" }>({ defaultValues: { query: "", filter: "all" } });
  const { query, filter } = search.watch();
  const [dragging, setDragging] = useState(false);
  const q = query.trim().toLowerCase();
  const items = media
    .filter((m) => m.kind !== "audio" && (filter === "all" || m.kind === filter))
    .filter((m) => !q || m.name.toLowerCase().includes(q) || m.path.toLowerCase().includes(q));
  const firstFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };
  return (
    <section
      className={`in-sec in-replace ${dragging ? "drop" : ""}`}
      data-tab={tab}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        firstFile(e.dataTransfer.files);
      }}
    >
      <h3><Repeat size={16} aria-hidden /> {title ?? "Thay ảnh/video"}</h3>
      <p className="in-note">{note ?? "Giữ nguyên chỗ trên timeline, vị trí, thu phóng và chuyển động — chỉ đổi hình."}</p>
      <input ref={fileRef} type="file" hidden accept="image/*,video/*" onChange={(e) => {
        firstFile(e.target.files);
        e.target.value = "";
      }} />
      <div className="in-actions">
        <button className="primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Đang tải lên…" : <><Upload size={16} aria-hidden /> Chọn từ máy</>}
        </button>
        <button onClick={() => onOpenLibrary("stock")} title="Tìm ảnh/video miễn phí — bấm Dùng để thay khối này"><Gift size={16} aria-hidden /> Kho free</button>
        <button onClick={() => onOpenLibrary("ai")} title="Tạo video AI — bật “gán vào mục đang chọn” để thay khối này"><Sparkles size={16} aria-hidden /> Video AI</button>
      </div>
      <small className="in-hint">Hoặc kéo file từ máy thả vào đây.</small>

      <div className="in-replace-bar">
        <input type="search" placeholder="Tìm trong thư viện…" {...search.register("query")} />
        <div className="md-filter">
          {(["all", "image", "video"] as const).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => search.setValue("filter", f)}>
              {f === "all" ? "Tất cả" : f === "image" ? "Ảnh" : "Video"}
            </button>
          ))}
        </div>
      </div>
      <div className="in-replace-grid">
        {items.map((m) => (
          <button
            key={m.path}
            className={m.path === current ? "on" : ""}
            onClick={() => onPick(m)}
            title={m.path === current ? `${m.name} (đang dùng)` : `Thay bằng ${m.name}`}
          >
            {m.kind === "video"
              ? <video src={`/public/${m.path}#t=0.5`} muted playsInline preload="metadata" />
              : <img src={`/public/${m.path}`} alt="" loading="lazy" />}
            {m.kind === "video" ? <i><Clapperboard size={14} aria-hidden /></i> : null}
            <span>{m.name}</span>
          </button>
        ))}
        {items.length === 0 ? <p className="in-note">{q ? `Không có file khớp “${query}”.` : "Thư viện chưa có ảnh/video — chọn từ máy."}</p> : null}
      </div>
    </section>
  );
};
