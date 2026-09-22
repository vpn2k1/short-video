import { FileText } from "lucide-react";
import { useState } from "react";
import type { SubtitleOptions, TranslateEngine } from "../api";
import { useTranslateEngines } from "../query";
import { Field } from "./controls";
import { loadTranslateChoice, TRANSLATE_STORE, type TranslateChoice } from "./helpers";
import { TranslateSettings } from "./TranslateSettings";

/**
 * Tuỳ chọn phụ đề tự động (ngôn ngữ, chế độ, dịch) — giữ ở Inspector nên đổi mục đang chọn vẫn nhớ lựa chọn.
 * Dùng chung cho tab Phụ đề AI của dự án, cảnh video và đoạn âm thanh.
 */
export const useSubtitleAi = () => {
  const [subLanguage, setSubLanguage] = useState<SubtitleOptions["language"]>("vi");
  const [subQuality, setSubQuality] = useState<SubtitleOptions["quality"]>("accurate");
  const [subReplace, setSubReplace] = useState(true);
  const [translateChoice, setTranslateChoice] = useState(loadTranslateChoice);
  // Công cụ dịch đổi khi cài Ollama / điền key — nút "Kiểm tra lại" gọi refetch.
  const translateQuery = useTranslateEngines();
  const translateCatalog = translateQuery.data ?? null;
  const checkingTranslate = translateQuery.isFetching;
  const refreshTranslate = () => { void translateQuery.refetch(); };
  const changeTranslate = (next: TranslateChoice) => {
    setTranslateChoice(next);
    try {
      localStorage.setItem(TRANSLATE_STORE, JSON.stringify(next));
    } catch {
      // không lưu được — chỉ mất lựa chọn khi tải lại trang
    }
  };
  // Model đã chọn còn dùng được thì giữ; không thì lấy model đầu tiên dùng được (key trên mạng, rồi AI có sẵn
  // trong app); không có gì → Ollama (hiện hướng dẫn cài).
  const translateEngine: TranslateEngine = (() => {
    const engines = translateCatalog?.engines ?? [];
    const saved = engines.find((e) => e.id === translateChoice.engine);
    if (saved && (saved.ready || saved.id === "ollama")) return saved.id;
    return engines.find((e) => e.ready)?.id ?? "ollama";
  })();
  const translateBlocked = Boolean(translateChoice.to) && !translateCatalog?.engines.find((e) => e.id === translateEngine)?.ready;
  const subtitleOptions = (source: SubtitleOptions["source"], index?: number): SubtitleOptions => ({
    source, index, language: subLanguage, quality: subQuality, replace: subReplace,
    translate: translateChoice.to ? { to: translateChoice.to, engine: translateEngine, keepOriginal: translateChoice.keepOriginal } : null,
  });
  return {
    subLanguage, setSubLanguage, subQuality, setSubQuality, subReplace, setSubReplace,
    translateChoice, changeTranslate, translateEngine, translateCatalog, checkingTranslate, refreshTranslate,
    translateBlocked, subtitleOptions,
  };
};

export type SubtitleAi = ReturnType<typeof useSubtitleAi>;

const SubtitleSettings: React.FC<{ sub: SubtitleAi }> = ({ sub }) => (
  <>
    <div className="in-2">
      <Field label="Ngôn ngữ lời nói">
        <select value={sub.subLanguage} onChange={(e) => sub.setSubLanguage(e.target.value as SubtitleOptions["language"])}>
          <option value="vi">Tiếng Việt</option>
          <option value="en">Tiếng Anh</option>
          <option value="auto">Tự nhận</option>
        </select>
      </Field>
      <Field label="Chế độ">
        <select value={sub.subQuality} onChange={(e) => sub.setSubQuality(e.target.value as SubtitleOptions["quality"])}>
          <option value="accurate">Chính xác</option>
          <option value="fast">Nhanh</option>
        </select>
      </Field>
    </div>
    <label className="in-check">
      <input type="checkbox" checked={sub.subReplace} onChange={(e) => sub.setSubReplace(e.target.checked)} />
      Xoá phụ đề cũ trùng đoạn được phiên âm (mọi hàng)
    </label>
    <TranslateSettings
      choice={sub.translateChoice}
      engine={sub.translateEngine}
      catalog={sub.translateCatalog}
      checking={sub.checkingTranslate}
      onChange={sub.changeTranslate}
      onRefresh={sub.refreshTranslate}
    />
    <small className="in-hint">Phụ đề tạo ra nằm ở một hàng phụ đề mới (Phụ đề 2, 3…) — kéo lên/xuống trên timeline để đổi hàng.</small>
  </>
);

/** Mục "Phụ đề tự động": tuỳ chọn + nút tạo phụ đề cho phần đang chọn (cả video / cảnh / đoạn âm thanh). */
export const SubtitleAiSection: React.FC<{
  sub: SubtitleAi;
  /** Chữ trên nút tạo phụ đề. */
  action: string;
  onCreate: () => void;
  note?: string;
  hint?: string;
  /** Tên tab trong bảng thuộc tính (Panel đọc). */
  "data-tab"?: string;
}> = ({ sub, action, onCreate, note, hint, "data-tab": tab }) => (
  <section className="in-sec" data-tab={tab}>
    <h3><FileText size={16} aria-hidden /> Phụ đề tự động</h3>
    {note ? <p className="in-note">{note}</p> : null}
    <SubtitleSettings sub={sub} />
    <div className="in-actions">
      <button disabled={sub.translateBlocked} onClick={onCreate}><FileText size={16} aria-hidden /> {action}</button>
    </div>
    {hint ? <small className="in-hint">{hint}</small> : null}
  </section>
);
