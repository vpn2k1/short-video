import type { ShortProps } from "../../../src/compositions/Short/schema";
import type { MediaItem, SubtitleOptions, VoiceOption } from "../api";
import type { LibrarySection } from "../MediaPanel";
import type * as ops from "../ops";

export type InspectorProps = {
  props: ShortProps;
  selection: ops.Selection;
  media: MediaItem[];
  voices: VoiceOption[];
  /** Giọng video đang dùng (null = chưa biết) — giá trị ban đầu của ô chọn giọng. */
  videoVoice: string | null;
  onChange: (next: ShortProps, mergeKey?: string) => void;
  onSelect: (selection: ops.Selection) => void;
  onDelete: () => void;
  onSplit: () => void;
  onDuplicateText: () => void;
  /** index bỏ trống = đổi giọng toàn bộ. */
  onVoice: (voice: string, index?: number) => void;
  onRemoveAllVoice: () => void;
  /** Tách âm thanh của cảnh video ra track riêng. */
  onDetachAudio: (sceneIndex: number) => void;
  /** Mở khung chọn vùng crop trên khung xem trước — cho cảnh hoặc video trên timeline. */
  onStartCrop: (sel: ops.MotionSel) => void;
  /** Tách hình của cảnh thành một video riêng trên timeline. */
  onLiftScene: (sceneIndex: number) => void;
  onAutoSubtitles: (options: SubtitleOptions) => void;
  /** Đầu phát hiện tại — mốc chuyển động (keyframe) ghim theo mốc này. */
  timeMs: number;
  onSeek: (ms: number) => void;
  /** Chạy một thao tác ops (giữ nguyên thông báo và lựa chọn nó trả về). */
  onRun: (result: ops.Result) => void;
  /** Đang tải file lên thư viện. */
  uploading: boolean;
  /** Thay ảnh/video của khối video `index` bằng một mục trong thư viện — giữ nguyên chỗ trên timeline. */
  onReplaceMedia: (index: number, item: MediaItem) => void;
  /** Thay bằng file chọn từ máy (tải lên thư viện rồi thay). */
  onReplaceFile: (index: number, file: File) => void;
  /** Gán ảnh/video cho cảnh `index` — cảnh trống hoặc đổi hình. */
  onSceneMedia: (index: number, item: MediaItem) => void;
  /** Gán cho cảnh bằng file chọn từ máy (tải lên thư viện rồi gán). */
  onSceneFile: (index: number, file: File) => void;
  /** Mở một mục của thư viện bên cạnh (Kho free, Video AI…). */
  onOpenLibrary: (section: LibrarySection) => void;
};

/** Props chung của các bảng theo mục đang chọn — `index` là vị trí mục trong mảng tương ứng. */
export type PanelBase = Pick<InspectorProps, "props" | "onChange" | "onSelect"> & { index: number };
