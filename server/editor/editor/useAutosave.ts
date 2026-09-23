import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { ApiError, isDiskFullError, postJson } from "../api";
import type { SaveState } from "./constants";

/** Chờ trước mỗi lần tự thử lưu lại: 5s, 10s, 20s rồi cứ 30s một lần. */
const RETRY_MS = [5_000, 10_000, 20_000, 30_000];

/**
 * Tự lưu: mỗi thay đổi hẹn lưu sau 600ms (thay đổi mới huỷ hẹn cũ), còn thay đổi chưa lưu thì cảnh báo khi rời trang.
 * `versionQuery`: "?version=n" của bản đang sửa — mọi lần lưu gắn đúng bản đó.
 *
 * Lưu hỏng vì ổ đĩa đầy hoặc mất kết nối tới server: báo một lần rồi tự thử lại bản mới nhất, tới khi lưu được —
 * người dùng dọn ổ xong là thay đổi được lưu, không phải sửa gì thêm. Lỗi khác (dữ liệu bị từ chối) thì không thử lại.
 */
export const useAutosave = (
  slug: string,
  versionQuery: React.RefObject<string>,
  flash: (message: string) => void,
) => {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saveTimer = useRef<number | undefined>(undefined);
  /** Bản cần lưu gần nhất — lần thử lại luôn lưu bản này, không phải bản lúc lỗi. */
  const latest = useRef<ShortProps | null>(null);
  /** Số lần thử lại liên tiếp; 0 = không đang thử lại. */
  const retries = useRef(0);

  // ---------- lưu ----------
  const saveNow = useCallback(async (next: ShortProps) => {
    latest.current = next;
    window.clearTimeout(saveTimer.current);
    setSaveState("saving");
    try {
      await postJson(`/api/editor/${slug}/save${versionQuery.current}`, next);
      if (retries.current > 0) flash("Đã lưu lại được các thay đổi.");
      retries.current = 0;
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      // Ổ đầy / mất kết nối (fetch hỏng không có ApiError): tự thử lại, chỉ báo ở lần hỏng đầu.
      const transient = isDiskFullError(e) || !(e instanceof ApiError);
      if (transient) {
        const reason = isDiskFullError(e) ? (e as Error).message : "Không kết nối được tới server.";
        if (retries.current === 0) flash(`${reason} Thay đổi vẫn còn — sẽ tự thử lưu lại.`);
        const wait = RETRY_MS[Math.min(retries.current, RETRY_MS.length - 1)];
        retries.current += 1;
        saveTimer.current = window.setTimeout(() => {
          if (latest.current) saveNow(latest.current).catch(() => undefined);
        }, wait);
      } else {
        retries.current = 0;
        flash(`Lưu thất bại: ${(e as Error).message}`);
      }
      throw e;
    }
  }, [slug, flash]);

  const scheduleSave = useCallback((next: ShortProps) => {
    latest.current = next;
    setSaveState("dirty");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveNow(next).catch(() => undefined);
    }, 600);
  }, [saveNow]);

  /** Huỷ lần lưu đang hẹn (cả lần tự thử lại) — trước khi lưu ngay / gửi việc lên server. */
  const cancelSave = useCallback(() => window.clearTimeout(saveTimer.current), []);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  return { saveState, setSaveState, saveNow, scheduleSave, cancelSave };
};
