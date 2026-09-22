import type { TranslateCatalog, TranslateEngine } from "../api";
import { Field } from "./controls";
import type { TranslateChoice } from "./helpers";
import { OllamaGuide } from "./OllamaGuide";

/** Chọn ngôn ngữ đích và model dịch cho phụ đề tự động. */
export const TranslateSettings: React.FC<{
  choice: TranslateChoice;
  engine: TranslateEngine;
  catalog: TranslateCatalog | null;
  checking: boolean;
  onChange: (next: TranslateChoice) => void;
  onRefresh: () => void;
}> = ({ choice, engine, catalog, checking, onChange, onRefresh }) => {
  const cloud = catalog?.engines.filter((e) => e.id !== "ollama" && e.id !== "local") ?? [];
  const builtIn = catalog?.engines.find((e) => e.id === "local");
  const local = catalog?.engines.find((e) => e.id === "ollama");
  const localNote = !local?.ollama
    ? ""
    : local.ready ? ` · ${local.ollama.model}` : local.ollama.status === "no-model" ? " (chưa tải model)" : " (chưa cài hoặc chưa mở)";
  return (
    <>
      <Field label="Dịch phụ đề sang">
        <select value={choice.to} onChange={(e) => onChange({ ...choice, to: e.target.value })}>
          <option value="">Không dịch</option>
          {catalog?.languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </Field>
      {choice.to ? (
        <>
          {catalog ? (
            <Field label="Model dịch">
              <select value={engine} onChange={(e) => onChange({ ...choice, engine: e.target.value as TranslateEngine })}>
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
            </Field>
          ) : (
            <small className="in-hint">Đang kiểm tra model dịch…</small>
          )}
          {engine === "ollama" && local?.ollama && !local.ready ? (
            <OllamaGuide info={local.ollama} platform={catalog?.platform ?? ""} checking={checking} onRefresh={onRefresh} />
          ) : null}
          <label className="in-check">
            <input type="checkbox" checked={choice.keepOriginal} onChange={(e) => onChange({ ...choice, keepOriginal: e.target.checked })} />
            Giữ phụ đề gốc ở một hàng riêng (song ngữ)
          </label>
        </>
      ) : null}
    </>
  );
};
