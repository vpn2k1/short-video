import { Captions, Mic, Palette, RotateCcw, Scissors, Trash2, VolumeX } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { STYLES } from "../../../src/styles/meta";
import { canCustomizeCaptions, resolveCaptionLook, usesCustomCaptions } from "../../../src/components/captionLook";
import * as ops from "../ops";
import { Field, Seconds, VoiceField, type VoiceFields } from "./controls";
import { LookPanel } from "./LookPanel";
import { Panel } from "./Panel";
import type { InspectorProps, PanelBase } from "./types";

/** Kiểu phụ đề: bọc LookPanel; phong cách dùng phụ đề làm nội dung thì chỉ ghi chú. */
const CaptionLookSection: React.FC<{
  props: ShortProps;
  selected: number;
  onChange: (next: ShortProps, mergeKey?: string) => void;
  "data-tab"?: string;
}> = ({ props, selected, onChange }) => {
  if (!canCustomizeCaptions(props.style)) {
    return (
      <section className="in-sec">
        <h3><Palette size={16} aria-hidden /> Kiểu phụ đề</h3>
        <p className="in-note">
          Phong cách “{STYLES[props.style as keyof typeof STYLES]?.label ?? props.style}” dùng phụ đề làm nội dung
          (bong bóng, thẻ bài đăng, câu hỏi, bảng xếp hạng, trang sách, lá thư) nên không đổi kiểu chữ được.
        </p>
      </section>
    );
  }
  const custom = usesCustomCaptions(props);
  return (
    <LookPanel
      title={<><Palette size={16} aria-hidden /> Kiểu phụ đề</>}
      noun="phụ đề"
      items={props.captions.map((c) => c.text)}
      selected={selected}
      defaultScope="all"
      lookAt={(index) => resolveCaptionLook(props, index === null ? null : props.captions[index] ?? null)}
      apply={(indices, patch, key) => onChange(ops.applyCaptionLook(props, indices, patch), key)}
      positionForAll
      hasOwnStyle={(k) => Boolean(props.captions[k]?.style)}
      markPreset={custom}
      intro={
        !custom ? (
          <p className="in-note">
            Đang dùng phụ đề của phong cách. Chọn một mẫu hoặc đổi bất kỳ tuỳ chọn nào để chỉnh font, màu, kiểu chữ và
            kéo vị trí, khung chữ trên khung xem trước.
          </p>
        ) : null
      }
      footer={
        custom ? (
          <div className="in-actions">
            <button onClick={() => onChange(ops.clearCaptionLooks(props))}><RotateCcw size={16} aria-hidden /> Về kiểu của phong cách</button>
          </div>
        ) : null
      }
    />
  );
};

// ---------- phụ đề ----------
export const CaptionPanel: React.FC<PanelBase & Pick<InspectorProps, "voices" | "onDelete" | "onSplit" | "onVoice"> & {
  /** Form ô chọn giọng — nằm ở Inspector, dùng chung với tab Giọng đọc của dự án. */
  voiceForm: UseFormReturn<VoiceFields>;
}> = ({ props, index: i, onChange, onSelect, voices, onDelete, onSplit, onVoice, voiceForm }) => {
  const c = props.captions[i];
  if (!c) return null;
  return (
    <Panel key="caption" icon={<Captions size={14} aria-hidden />} title={`Phụ đề ${i + 1}`} onClose={() => onSelect(null)}>
      <section className="in-sec" data-tab="Nội dung">
        <h3><Captions size={16} aria-hidden /> Phụ đề {i + 1}</h3>
        <Field label="Nội dung">
          <textarea
            rows={3}
            value={c.text}
            onChange={(e) => onChange(ops.updateCaption(props, i, { text: e.target.value }), `caption-text-${i}`)}
          />
        </Field>
        <div className="in-2">
          <Field label="Bắt đầu (giây)">
            <Seconds value={c.startMs} onChange={(ms) => onChange(ops.updateCaption(props, i, { startMs: Math.min(ms, c.endMs - ops.MIN_MS) }), `caption-start-${i}`)} />
          </Field>
          <Field label="Kết thúc (giây)">
            <Seconds value={c.endMs} onChange={(ms) => onChange(ops.updateCaption(props, i, { endMs: Math.max(ms, c.startMs + ops.MIN_MS) }), `caption-end-${i}`)} />
          </Field>
        </div>
        <div className="in-actions">
          <button onClick={onSplit}><Scissors size={16} aria-hidden /> Tách tại đầu phát</button>
          <button className="danger" onClick={onDelete}><Trash2 size={16} aria-hidden /> Xoá</button>
        </div>
      </section>

      <CaptionLookSection key="caption-style" data-tab="Kiểu chữ" props={props} selected={i} onChange={onChange} />

      <section className="in-sec" data-tab="Giọng đọc">
        <h3><Mic size={16} aria-hidden /> Giọng đọc của câu</h3>
        <p className="in-note">
          {c.audio ? "Câu này có giọng đọc — dời phụ đề thì giọng dời theo. Sửa chữ xong nên đọc lại cho khớp." : "Câu này chưa có giọng đọc."}
        </p>
        {c.audio ? <audio controls preload="none" src={`/public/${c.audio}`} /> : null}
        <Field label="Giọng">
          <VoiceField control={voiceForm.control} voices={voices} />
        </Field>
        <div className="in-actions">
          <button onClick={voiceForm.handleSubmit(({ voice }) => onVoice(voice, i))} disabled={!c.text.trim()}><Mic size={16} aria-hidden /> {c.audio ? "Đọc lại câu này" : "Tạo giọng cho câu này"}</button>
          {c.audio ? <button onClick={() => onChange(ops.updateCaption(props, i, { audio: null }))}><VolumeX size={16} aria-hidden /> Bỏ giọng câu này</button> : null}
        </div>
      </section>
    </Panel>
  );
};
