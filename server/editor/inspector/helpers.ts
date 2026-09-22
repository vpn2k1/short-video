import type { TranslateEngine } from "../api";

/** Lựa chọn dịch phụ đề — nhớ trong trình duyệt. `to` rỗng = không dịch; `engine` rỗng = tự chọn model đã có key. */
export type TranslateChoice = { to: string; engine: TranslateEngine | ""; keepOriginal: boolean };
export const TRANSLATE_STORE = "editor.subtitleTranslate";

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

export const hexOr = (value: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
