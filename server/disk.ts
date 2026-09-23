/**
 * Ổ đĩa: đọc chỗ trống, nhận ra lỗi đầy ổ (ENOSPC) và đổi thành lời dễ hiểu thay cho lỗi hệ thống thô
 * ("ENOSPC: no space left on device, write"). Ổ đầy thì lưu dự án, xuất video, tải file đều hỏng cùng lúc —
 * báo một câu chung, kèm chỗ dọn.
 */
import fs from "fs";

export const DISK_FULL_MESSAGE =
  "Ổ đĩa đã đầy — cần giải phóng dung lượng rồi thử lại (Thư viện › Dọn dung lượng, hoặc xoá bớt file trên máy).";

/** Lỗi do thiếu chỗ trống — tự tạo khi kiểm tra trước (assertDiskSpace), giữ nguyên lời báo có số liệu. */
class DiskSpaceError extends Error {
  code = "ENOSPC";
}

export const isDiskFull = (error: unknown) => {
  if (error instanceof DiskSpaceError) return true;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  // Tiến trình con (Remotion, ffmpeg) chỉ để lại chữ trong thông báo lỗi.
  return code === "ENOSPC" || /ENOSPC|no space left on device/i.test(message);
};

/** Lời báo lỗi cho người dùng: đầy ổ thì báo rõ, còn lại giữ nguyên. */
export const errorText = (error: unknown) => {
  if (error instanceof DiskSpaceError) return error.message;
  if (isDiskFull(error)) return DISK_FULL_MESSAGE;
  return error instanceof Error ? error.message : String(error);
};

/** Body JSON khi API lỗi — `code: "ENOSPC"` để giao diện biết là đầy ổ (trình chỉnh sửa tự thử lưu lại). */
export const errorBody = (error: unknown) =>
  isDiskFull(error) ? { error: errorText(error), code: "ENOSPC" } : { error: errorText(error) };

/** Chỗ trống / dung lượng của ổ chứa thư mục làm việc; null nếu hệ điều hành không cho đọc. */
export const diskSpace = (dir = process.cwd()) => {
  try {
    const stat = fs.statfsSync(dir);
    return { free: stat.bavail * stat.bsize, total: stat.blocks * stat.bsize };
  } catch {
    return null;
  }
};

export const GB = 1024 ** 3;

/** Chỗ trống tối thiểu để xuất một video: file mp4, bản đóng gói Remotion và file tạm của ffmpeg. */
export const RENDER_MIN_FREE = 1 * GB;

const fmtBytes = (bytes: number) =>
  bytes >= GB ? `${(bytes / GB).toFixed(1)} GB` : `${Math.max(0, Math.round(bytes / 1024 ** 2))} MB`;

/** Trước việc ghi nhiều (xuất video): còn dưới `minBytes` thì báo ngay, không để dựng gần xong mới lỗi. */
export const assertDiskSpace = (minBytes: number, what: string) => {
  const space = diskSpace();
  if (space && space.free < minBytes) {
    throw new DiskSpaceError(
      `Ổ đĩa chỉ còn ${fmtBytes(space.free)} trống — cần ít nhất ${fmtBytes(minBytes)} để ${what}. ` +
        "Giải phóng dung lượng (Thư viện › Dọn dung lượng, hoặc xoá bớt file trên máy) rồi thử lại.",
    );
  }
};
