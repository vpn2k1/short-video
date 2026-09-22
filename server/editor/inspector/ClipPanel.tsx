import { Scissors, Trash2, Volume2 } from "lucide-react";
import * as ops from "../ops";
import { Field, Seconds, Slider, SpeedControl } from "./controls";
import { Panel } from "./Panel";
import { SubtitleAiSection, type SubtitleAi } from "./SubtitleAiSection";
import type { InspectorProps, PanelBase } from "./types";

// ---------- âm thanh thêm tay ----------
export const ClipPanel: React.FC<PanelBase & Pick<InspectorProps, "onDelete" | "onSplit" | "onAutoSubtitles"> & { sub: SubtitleAi }> = ({
  props, index: i, onChange, onSelect, onDelete, onSplit, onAutoSubtitles, sub,
}) => {
  const c = props.audioClips[i];
  if (!c) return null;
  return (
    <Panel key="clip" icon={<Volume2 size={14} aria-hidden />} title={c.label ?? "Âm thanh"} onClose={() => onSelect(null)}>
      <section className="in-sec" data-tab="Cơ bản">
        <h3><Volume2 size={16} aria-hidden /> Âm thanh</h3>
        <Field label="Tên">
          <input value={c.label ?? ""} onChange={(e) => onChange(ops.updateClip(props, i, { label: e.target.value || null }), `clip-label-${i}`)} />
        </Field>
        <p className="in-note">{c.src}</p>
        <audio controls preload="none" src={`/public/${c.src}`} />
        <div className="in-2">
          <Field label="Bắt đầu (giây)">
            <Seconds value={c.startMs} onChange={(ms) => onChange(ops.updateClip(props, i, { startMs: ms }), `clip-start-${i}`)} />
          </Field>
          <Field label="Độ dài (giây)">
            <Seconds value={c.durationMs} min={ops.MIN_MS} onChange={(ms) => onChange(ops.updateClip(props, i, { durationMs: ms }), `clip-dur-${i}`)} />
          </Field>
        </div>
        <Field label="Bỏ qua đầu file (giây)" hint="Kéo mép trái khối trên timeline cũng được">
          <Seconds value={c.trimStartMs} onChange={(ms) => onChange(ops.updateClip(props, i, { trimStartMs: ms }), `clip-trim-${i}`)} />
        </Field>
        <Field label="Âm lượng" hint="0% = tắt tiếng mà vẫn giữ trên timeline">
          <Slider value={c.volume} max={2} onChange={(v) => onChange(ops.updateClip(props, i, { volume: v }), `clip-vol-${i}`)} />
        </Field>
        <SpeedControl
          speed={ops.clipSpeed(c)}
          lengthMs={c.durationMs}
          onChange={(v, key) => onChange(ops.setClipSpeed(props, i, v), key ? `clip-speed-${i}` : undefined)}
        />
        <div className="in-actions">
          <button onClick={onSplit}><Scissors size={16} aria-hidden /> Tách tại đầu phát</button>
          <button className="danger" onClick={onDelete}><Trash2 size={16} aria-hidden /> Xoá âm thanh</button>
        </div>
      </section>
      <SubtitleAiSection
        data-tab="Phụ đề AI"
        sub={sub}
        action="Tạo phụ đề từ đoạn âm thanh này"
        onCreate={() => onAutoSubtitles(sub.subtitleOptions("clip", i))}
      />
    </Panel>
  );
};
