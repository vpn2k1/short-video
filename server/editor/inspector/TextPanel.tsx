import { Palette, Scissors, Sparkles, Trash2, Type } from "lucide-react";
import { textLook } from "../../../src/components/captionLook";
import * as ops from "../ops";
import { Field, Seconds } from "./controls";
import { LookPanel } from "./LookPanel";
import { Panel } from "./Panel";
import type { InspectorProps, PanelBase } from "./types";

// ---------- văn bản tự do ----------
export const TextPanel: React.FC<PanelBase & Pick<InspectorProps, "onDelete" | "onSplit" | "onDuplicateText">> = ({
  props, index: i, onChange, onSelect, onDelete, onSplit, onDuplicateText,
}) => {
  const t = props.texts[i];
  if (!t) return null;
  const set = (patch: Parameters<typeof ops.updateText>[2], key?: string) => onChange(ops.updateText(props, i, patch), key);
  return (
    <Panel key="text" icon={<Type size={14} aria-hidden />} title={`Văn bản ${i + 1}`} onClose={() => onSelect(null)}>
      <section className="in-sec" data-tab="Nội dung">
        <h3><Type size={16} aria-hidden /> Văn bản</h3>
        <Field label="Nội dung" hint="Enter để xuống dòng">
          <textarea rows={3} value={t.text} onChange={(e) => set({ text: e.target.value }, `text-content-${i}`)} />
        </Field>
        <div className="in-2">
          <Field label="Hiện từ (giây)">
            <Seconds value={t.startMs} onChange={(ms) => set({ startMs: Math.min(ms, t.endMs - ops.MIN_MS) }, `text-start-${i}`)} />
          </Field>
          <Field label="Đến (giây)">
            <Seconds value={t.endMs} onChange={(ms) => set({ endMs: Math.max(ms, t.startMs + ops.MIN_MS) }, `text-end-${i}`)} />
          </Field>
        </div>
      </section>

      <LookPanel
        key="text-style"
        data-tab="Kiểu chữ"
        title={<><Palette size={16} aria-hidden /> Kiểu chữ</>}
        noun="văn bản"
        items={props.texts.map((x) => x.text)}
        selected={i}
        defaultScope="selected"
        lookAt={(index) => textLook(props.texts[index ?? i] ?? t)}
        apply={(indices, patch, key) => onChange(ops.applyTextLook(props, indices, patch), key)}
        positionForAll={false}
        hasOwnStyle={(k) => Boolean(props.texts[k]?.preset)}
      />

      <section className="in-sec" data-tab="Hiệu ứng">
        <h3><Sparkles size={16} aria-hidden /> Hiệu ứng</h3>
        <Field label="Hiệu ứng hiện">
          <select value={t.animation} onChange={(e) => set({ animation: e.target.value as typeof t.animation })}>
            <option value="pop">Bật lên</option>
            <option value="fade">Mờ dần</option>
            <option value="slide">Trượt lên</option>
            <option value="typewriter">Gõ chữ</option>
            <option value="none">Không</option>
          </select>
        </Field>
      </section>

      <section className="in-sec in-foot">
        <div className="in-actions">
          <button onClick={onDuplicateText}>⧉ Nhân đôi</button>
          <button onClick={onSplit}><Scissors size={16} aria-hidden /> Tách</button>
          <button className="danger" onClick={onDelete}><Trash2 size={16} aria-hidden /> Xoá</button>
        </div>
      </section>
    </Panel>
  );
};
