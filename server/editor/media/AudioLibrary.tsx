import { Music, Pause, Play } from "lucide-react";
import type { MediaItem } from "../api";
import { AUDIO_GROUPS, dragMedia } from "./helpers";

/** Mục Âm thanh của thư viện: nhóm Nhạc nền / Hiệu ứng / Đã tải lên, nghe thử, đặt làm nhạc nền. */
export const AudioLibrary: React.FC<{
  audio: MediaItem[];
  q: string;
  query: string;
  uploading: boolean;
  currentMusic: string | null;
  /** File đang nghe thử (thẻ audio nằm ở vỏ panel). */
  playing: string | null;
  onTogglePreview: (path: string) => void;
  onImportClick: () => void;
  onUse: (item: MediaItem) => void;
  onSetMusic: (path: string) => void;
}> = ({ audio, q, query, uploading, currentMusic, playing, onTogglePreview, onImportClick, onUse, onSetMusic }) => (
  <div className="md-list">
    <button className="md-import row" onClick={onImportClick} disabled={uploading}>
      <b>{uploading ? "…" : "＋"}</b>
      <span>{uploading ? "Đang tải lên…" : "Nhập nhạc / âm thanh"}</span>
    </button>
    <p className="md-hint"><Play size={12} aria-hidden /> nghe thử · kéo xuống timeline hoặc <b>＋</b> thêm tại đầu phát · <Music size={12} aria-hidden /> đặt làm nhạc nền.</p>
    {AUDIO_GROUPS.map((group) => {
      const items = audio.filter((m) => m.path.split("/")[0] === group.key);
      if (items.length === 0) return null;
      return (
        <div key={group.key} className="md-group">
          <h4>{group.title}</h4>
          {items.map((m) => (
            <div key={m.path} className={`md-row ${currentMusic === m.path ? "current" : ""}`} title={m.path} draggable onDragStart={dragMedia(m.path)}>
              <button className="md-play" onClick={() => onTogglePreview(m.path)} aria-label="Nghe thử">{playing === m.path ? <Pause fill="currentColor" size={14} aria-hidden /> : <Play fill="currentColor" size={14} aria-hidden />}</button>
              <span><b>{m.name.replace(/\.\w+$/, "")}</b><small>{currentMusic === m.path ? "đang là nhạc nền" : m.path.split("/")[0]}</small></span>
              <button className="md-bg" onClick={() => onSetMusic(m.path)} title="Đặt làm nhạc nền" aria-label="Đặt làm nhạc nền"><Music size={14} aria-hidden /></button>
              <button className="md-add" onClick={() => onUse(m)} title="Thêm vào timeline tại đầu phát">＋</button>
            </div>
          ))}
        </div>
      );
    })}
    {audio.length === 0 ? <p className="md-empty">{q ? `Không có file khớp “${query}”.` : "Chưa có file âm thanh — nhập mp3, wav hoặc m4a."}</p> : null}
  </div>
);
