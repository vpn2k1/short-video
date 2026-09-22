import { Clapperboard, Film, Music } from "lucide-react";
import type { MediaItem } from "../api";
import { dragMedia } from "./helpers";

export type VisualFilter = "all" | "image" | "video";

/** Mục Ảnh/Video của thư viện: lọc loại, nút tách âm thanh cảnh, lưới ô kéo được xuống timeline. */
export const VisualLibrary: React.FC<{
  visual: MediaItem[];
  filter: VisualFilter;
  onFilter: (f: VisualFilter) => void;
  /** Từ khoá tìm đã chuẩn hoá (q) và nguyên văn (query) — để báo “không có file khớp”. */
  q: string;
  query: string;
  target: string;
  uploading: boolean;
  onImportClick: () => void;
  onUse: (item: MediaItem) => void;
  onAppendOverlay: (item: MediaItem) => void;
  onExtractAudio: (item: MediaItem) => void;
  selectedVideoScene: number | null;
  onDetachSceneAudio: (index: number) => void;
}> = ({
  visual, filter, onFilter, q, query, target, uploading, onImportClick, onUse, onAppendOverlay, onExtractAudio, selectedVideoScene, onDetachSceneAudio,
}) => (
  <>
    <div className="md-filter">
      {(["all", "image", "video"] as const).map((f) => (
        <button key={f} className={filter === f ? "on" : ""} onClick={() => onFilter(f)}>
          {f === "all" ? "Tất cả" : f === "image" ? "Ảnh" : "Video"}
        </button>
      ))}
    </div>
    {selectedVideoScene !== null ? (
      <div className="md-scene-action">
        <span><Film size={14} aria-hidden /> Cảnh {selectedVideoScene + 1} là video</span>
        <button
          onClick={() => onDetachSceneAudio(selectedVideoScene)}
          title="Âm thanh của cảnh thành một đoạn riêng trên track Âm thanh — cắt, dời, chỉnh độc lập với hình; video tắt tiếng gốc"
        >
          <Music size={16} aria-hidden /> Tách âm thanh cảnh
        </button>
      </div>
    ) : null}
    <p className="md-hint">
      Kéo xuống timeline để đặt đúng chỗ · bấm ảnh để {target} · <b>＋</b> nối vào cuối.
    </p>
    <div className="md-grid">
      <button className="md-import" onClick={onImportClick} disabled={uploading} title="Nhập ảnh/video — hoặc kéo thả file vào panel">
        <b>{uploading ? "…" : "＋"}</b>
        <span>{uploading ? "Đang tải lên…" : "Nhập ảnh/video"}</span>
      </button>
      {visual.map((m) => (
        <div key={m.path} className="md-tile" title={m.path} draggable onDragStart={dragMedia(m.path)}>
          <button className="md-tile-main" onClick={() => onUse(m)} aria-label={`Thay ${target} bằng ${m.name}`}>
            {m.kind === "video"
              ? <video src={`/public/${m.path}#t=0.5`} muted playsInline preload="metadata" />
              : <img src={`/public/${m.path}`} alt="" loading="lazy" draggable={false} />}
            {m.kind === "video" ? <i><Clapperboard size={14} aria-hidden /></i> : null}
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
              <button onClick={() => onExtractAudio(m)} title="Tách âm thanh của video thành file riêng" aria-label="Tách âm thanh của video thành file riêng"><Music size={14} aria-hidden /></button>
            </div>
          ) : null}
        </div>
      ))}
      {visual.length === 0 && q ? <p className="md-empty">Không có file khớp “{query}”.</p> : null}
    </div>
  </>
);
