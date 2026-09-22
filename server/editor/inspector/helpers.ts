import type { SubtitleOptions, TranslateEngine } from "../api";

/** Lựa chọn dịch phụ đề — nhớ trong trình duyệt. `to` rỗng = không dịch; `engine` rỗng = tự chọn model đã có key. */
export type TranslateChoice = { to: string; engine: TranslateEngine | ""; keepOriginal: boolean };
export const TRANSLATE_STORE = "editor.subtitleTranslate";

/** Form tuỳ chọn phụ đề tự động (SubtitleAiSection) — nhóm `translate` nhớ trong trình duyệt. */
export type SubtitleFields = {
  language: SubtitleOptions["language"];
  quality: SubtitleOptions["quality"];
  replace: boolean;
  translate: TranslateChoice;
};

export const loadTranslateChoice = (): TranslateChoice => {
  try {
    const saved = JSON.parse(localStorage.getItem(TRANSLATE_STORE) ?? "null");
    if (saved && typeof saved === "object") {
      return {
        to: typeof saved.to === "string" ? saved.to : "",
        engine: typeof saved.engine === "string" ? saved.engine : "",
        keepOriginal: saved.keepOriginal === true,
      };
    }
  } catch {
    // trình duyệt chặn lưu — dùng mặc định
  }
  return { to: "", engine: "", keepOriginal: false };
};

export const saveTranslateChoice = (choice: TranslateChoice) => {
  try {
    localStorage.setItem(TRANSLATE_STORE, JSON.stringify(choice));
  } catch {
    // không lưu được — chỉ mất lựa chọn khi tải lại trang
  }
};

export const hexOr = (value: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
