import type { ShortProps } from "../../../src/compositions/Short/schema";
import type { LibrarySection } from "../MediaPanel";

export type SaveState = "saved" | "dirty" | "saving" | "error";
export type JobState =
  | { status: "idle" }
  | { status: "running"; title: string; percent: number | null; line: string }
  | { status: "error"; title: string; message: string };

/**
 * Xuất video — tách khỏi JobState: đóng hộp tiến độ thì xuất vẫn chạy dưới nền (server dựng xong vẫn thành bản mới),
 * người dùng sửa tiếp; các việc khác (đổi giọng, phụ đề…) vẫn chặn màn hình vì chúng sửa thẳng dữ liệu đang chỉnh.
 * `editedSince`: đã sửa thêm sau lúc bấm xuất — những thay đổi đó KHÔNG có trong video vừa xuất.
 */
export type ExportState =
  | { status: "idle" }
  | { status: "running"; percent: number; line: string }
  | { status: "exported"; mp4: string; version: number | null; editedSince: boolean }
  | { status: "error"; message: string };

/** Bản đang sửa (server đã quy "mới nhất" ra số); null = dự án chưa từng xuất. */
export type VersionInfo = { version: number | null; latest: number | null; hasDraft: boolean };

export const FPS = 30;
export const same = (a: ShortProps, b: ShortProps) => JSON.stringify(a) === JSON.stringify(b);

export const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
/** Độ dài cảnh ảnh sinh ra từ nút Cắt ảnh — đổi được bằng cách kéo mép cảnh. */
export const FREEZE_MS = 2000;
export const LIB_SECTIONS: LibrarySection[] = ["visual", "audio", "text", "captions", "ai", "stock"];
