import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import type { TranslateCatalog, TranslateEngine } from "../api";
import { Field } from "./controls";
import type { SubtitleFields } from "./helpers";
import { OllamaGuide } from "./OllamaGuide";

/** Chọn ngôn ngữ đích và model dịch cho phụ đề tự động — các ô nhóm `translate` của form phụ đề. */
export const TranslateSettings: React.FC<{
  form: UseFormReturn<SubtitleFields>;
  /** Model dịch sẽ dùng (model đã chọn, hoặc model tự chọn khi model đó chưa dùng được). */
  engine: TranslateEngine;
  catalog: TranslateCatalog | null;
  checking: boolean;
  onRefresh: () => void;
}> = ({ form, engine, catalog, checking, onRefresh }) => {
  const to = useWatch({ control: form.control, name: "translate.to" });
  const cloud = catalog?.engines.filter((e) => e.id !== "ollama" && e.id !== "local") ?? [];
  const builtIn = catalog?.engines.find((e) => e.id === "local");
  const local = catalog?.engines.find((e) => e.id === "ollama");
  const localNote = !local?.ollama
    ? ""
    : local.ready ? ` · ${local.ollama.model}` : local.ollama.status === "no-model" ? " (chưa tải model)" : " (chưa cài hoặc chưa mở)";
  return (
    <>
      <Field label="Dịch phụ đề sang">
        {/* Controller, không register: danh sách ngôn ngữ tải sau nên <select> phải nhận lại giá trị khi có option. */}
        <Controller control={form.control} name="translate.to" render={({ field }) => (
          <select {...field}>
            <option value="">Không dịch</option>
            {catalog?.languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        )} />
      </Field>
      {to ? (
        <>
          {catalog ? (
            <Field label="Model dịch">
              <Controller control={form.control} name="translate.engine" render={({ field }) => (
                <select {...field} value={engine}>
                  <optgroup label="Trên mạng — dùng key trong Cài đặt">
                    {cloud.map((e) => (
                      <option key={e.id} value={e.id} disabled={!e.ready}>{e.label}{e.ready ? "" : " (chưa có key)"}</option>
                    ))}
                  </optgroup>
                  {builtIn || local ? (
                    <optgroup label="Trên máy">
                      {builtIn ? (
                        <option value="local" disabled={!builtIn.ready}>{builtIn.label}{builtIn.ready ? "" : " (bản cài không kèm)"}</option>
                      ) : null}
                      {local ? <option value="ollama">{local.label}{localNote}</option> : null}
                    </optgroup>
                  ) : null}
                </select>
              )} />
            </Field>
          ) : (
            <small className="in-hint">Đang kiểm tra model dịch…</small>
          )}
          {engine === "ollama" && local?.ollama && !local.ready ? (
            <OllamaGuide info={local.ollama} platform={catalog?.platform ?? ""} checking={checking} onRefresh={onRefresh} />
          ) : null}
          <label className="in-check">
            <input type="checkbox" {...form.register("translate.keepOriginal")} />
            Giữ phụ đề gốc ở một hàng riêng (song ngữ)
          </label>
        </>
      ) : null}
    </>
  );
};
