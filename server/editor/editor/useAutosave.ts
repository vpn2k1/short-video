import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { postJson } from "../api";
import type { SaveState } from "./constants";

/**
 * Tự lưu: mỗi thay đổi hẹn lưu sau 600ms (thay đổi mới huỷ hẹn cũ), còn thay đổi chưa lưu thì cảnh báo khi rời trang.
 * `versionQuery`: "?version=n" của bản đang sửa — mọi lần lưu gắn đúng bản đó.
 */
export const useAutosave = (
  slug: string,
  versionQuery: React.RefObject<string>,
  flash: (message: string) => void,
) => {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saveTimer = useRef<number | undefined>(undefined);

  // ---------- lưu ----------
  const saveNow = useCallback(async (next: ShortProps) => {
    setSaveState("saving");
    try {
      await postJson(`/api/editor/${slug}/save${versionQuery.current}`, next);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      flash(`Lưu thất bại: ${(e as Error).message}`);
      throw e;
    }
  }, [slug, flash]);

  const scheduleSave = useCallback((next: ShortProps) => {
    setSaveState("dirty");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveNow(next).catch(() => undefined);
    }, 600);
  }, [saveNow]);

  /** Huỷ lần lưu đang hẹn — trước khi lưu ngay / gửi việc lên server. */
  const cancelSave = useCallback(() => window.clearTimeout(saveTimer.current), []);

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
