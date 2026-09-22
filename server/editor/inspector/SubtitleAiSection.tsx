import { FileText } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import type { SubtitleOptions, TranslateEngine } from "../api";
import { useTranslateEngines } from "../query";
import { Field } from "./controls";
import { loadTranslateChoice, saveTranslateChoice, type SubtitleFields } from "./helpers";
import { TranslateSettings } from "./TranslateSettings";

/**
 * Tuỳ chọn phụ đề tự động (ngôn ngữ, chế độ, dịch) — form giữ ở Inspector nên đổi mục đang chọn vẫn nhớ lựa chọn.
 * Dùng chung cho tab Phụ đề AI của dự án, cảnh video và đoạn âm thanh.
 */
export const useSubtitleAi = () => {
  const defaultValues = useMemo<SubtitleFields>(
    () => ({ language: "vi", quality: "accurate", replace: true, translate: loadTranslateChoice() }),
    [],
  );
  const form = useForm<SubtitleFields>({ defaultValues });
  // Đổi ô nào trong nhóm dịch cũng lưu lại lựa chọn dịch.
  useEffect(() => {
    const { unsubscribe } = form.watch((_, { name }) => {
      if (name?.startsWith("translate")) saveTranslateChoice(form.getValues("translate"));
    });
    return unsubscribe;
  }, [form]);
  // Công cụ dịch đổi khi cài Ollama / điền key — nút "Kiểm tra lại" gọi refetch.
  const translateQuery = useTranslateEngines();
  const translateCatalog = translateQuery.data ?? null;
  const checkingTranslate = translateQuery.isFetching;
  const refreshTranslate = () => { void translateQuery.refetch(); };
  const translateChoice = form.watch("translate");
  // Model đã chọn còn dùng được thì giữ; không thì lấy model đầu tiên dùng được (key trên mạng, rồi AI có sẵn
  // trong app); không có gì → Ollama (hiện hướng dẫn cài).
  const translateEngine: TranslateEngine = (() => {
    const engines = translateCatalog?.engines ?? [];
    const saved = engines.find((e) => e.id === translateChoice.engine);
    if (saved && (saved.ready || saved.id === "ollama")) return saved.id;
    return engines.find((e) => e.ready)?.id ?? "ollama";
  })();
  const translateBlocked = Boolean(translateChoice.to) && !translateCatalog?.engines.find((e) => e.id === translateEngine)?.ready;
  const subtitleOptions = (source: SubtitleOptions["source"], index?: number): SubtitleOptions => {
    const { language, quality, replace, translate } = form.getValues();
    return {
      source, index, language, quality, replace,
      translate: translate.to ? { to: translate.to, engine: translateEngine, keepOriginal: translate.keepOriginal } : null,
    };
  };
  return { form, translateEngine, translateCatalog, checkingTranslate, refreshTranslate, translateBlocked, subtitleOptions };
};

export type SubtitleAi = ReturnType<typeof useSubtitleAi>;

const SubtitleSettings: React.FC<{ sub: SubtitleAi }> = ({ sub }) => (
  <>
    <div className="in-2">
      <Field label="Ngôn ngữ lời nói">
        <select {...sub.form.register("language")}>
          <option value="vi">Tiếng Việt</option>
          <option value="en">Tiếng Anh</option>
          <option value="auto">Tự nhận</option>
        </select>
      </Field>
      <Field label="Chế độ">
        <select {...sub.form.register("quality")}>
          <option value="accurate">Chính xác</option>
          <option value="fast">Nhanh</option>
        </select>
      </Field>
    </div>
    <label className="in-check">
      <input type="checkbox" {...sub.form.register("replace")} />
      Xoá phụ đề cũ trùng đoạn được phiên âm (mọi hàng)
    </label>
    <TranslateSettings
      form={sub.form}
      engine={sub.translateEngine}
      catalog={sub.translateCatalog}
      checking={sub.checkingTranslate}
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
