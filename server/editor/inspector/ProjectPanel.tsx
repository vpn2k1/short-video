import { Clapperboard, Mic, Pointer, VolumeX } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { ASPECT_IDS, ASPECTS } from "../../../src/aspects";
import { STYLE_IDS, STYLES } from "../../../src/styles/meta";
import { Field, Slider, VoiceField, type VoiceFields } from "./controls";
import { MusicSection } from "./MusicPanel";
import { Panel } from "./Panel";
import { SubtitleAiSection, type SubtitleAi } from "./SubtitleAiSection";
import type { InspectorProps } from "./types";

// ---------- không chọn gì: cài đặt chung ----------
export const ProjectPanel: React.FC<Pick<InspectorProps,
  "props" | "onChange" | "media" | "voices" | "onVoice" | "onRemoveAllVoice" | "onAutoSubtitles"
> & {
  sub: SubtitleAi;
  /** Form ô chọn giọng — nằm ở Inspector, dùng chung với bảng phụ đề. */
  voiceForm: UseFormReturn<VoiceFields>;
}> = ({ props, onChange, media, voices, onVoice, onRemoveAllVoice, onAutoSubtitles, sub, voiceForm }) => {
  const voiceCount = props.captions.filter((c) => c.audio).length;
  return (
    <Panel key="project" icon={<Clapperboard size={14} aria-hidden />} title="Dự án">
      <p className="in-tip" data-tab="Dự án">
        <Pointer size={14} aria-hidden /> Bấm một khối trên timeline để sửa riêng khối đó. Kéo ảnh, video, nhạc từ thư viện thả xuống timeline.
      </p>
      <section className="in-sec">
        <h3><Clapperboard size={16} aria-hidden /> Video</h3>
        <Field label="Tiêu đề">
          <input value={props.title} onChange={(e) => onChange({ ...props, title: e.target.value }, "title")} />
        </Field>
        <Field label="Dòng phụ">
          <input value={props.subtitle} onChange={(e) => onChange({ ...props, subtitle: e.target.value }, "subtitle")} />
        </Field>
        <label className="in-check">
          <input type="checkbox" checked={props.showTitle} onChange={(e) => onChange({ ...props, showTitle: e.target.checked })} />
          Hiện title card ở đầu video
        </label>
        <div className="in-2">
          <Field label="Phong cách">
            <select value={props.style} onChange={(e) => onChange({ ...props, style: e.target.value as ShortProps["style"] })}>
              {STYLE_IDS.map((id) => <option key={id} value={id}>{STYLES[id].emoji} {STYLES[id].label}</option>)}
            </select>
          </Field>
          <Field label="Tỉ lệ">
            <select value={props.aspect} onChange={(e) => onChange({ ...props, aspect: e.target.value })}>
              {ASPECT_IDS.map((id) => <option key={id} value={id}>{id} · {ASPECTS[id].label.split("—")[1]?.trim()}</option>)}
            </select>
          </Field>
        </div>
        <div className="in-2">
          <Field label="Màu nhấn">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(props.accent) ? props.accent : "#ff6b2c"} onChange={(e) => onChange({ ...props, accent: e.target.value }, "accent")} />
          </Field>
          <Field label="Vị trí phụ đề">
            <select value={props.captionPosition} onChange={(e) => onChange({ ...props, captionPosition: e.target.value as "bottom" | "center" })}>
              <option value="bottom">Đáy</option>
              <option value="center">Giữa</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="in-sec" data-tab="Giọng đọc">
        <h3><Mic size={16} aria-hidden /> Giọng đọc</h3>
        <p className="in-note">{voiceCount > 0 ? `${voiceCount}/${props.captions.length} câu có giọng đọc.` : "Video chưa có giọng đọc."}</p>
        <Field label="Âm lượng giọng" hint="0% = tắt tiếng giọng mà vẫn giữ file">
          <Slider value={props.voiceVolume} max={2} onChange={(v) => onChange({ ...props, voiceVolume: v }, "voiceVolume")} />
        </Field>
        <Field label="Đổi sang giọng" hint="Đọc lại mọi câu; câu dài hơn thì phần phía sau tự lùi lại">
          <VoiceField control={voiceForm.control} voices={voices} />
        </Field>
        <div className="in-actions">
          <button onClick={voiceForm.handleSubmit(({ voice }) => onVoice(voice))} disabled={props.captions.length === 0}><Mic size={16} aria-hidden /> {voiceCount > 0 ? "Đổi giọng toàn bộ" : "Tạo giọng cho mọi câu"}</button>
          <button className="danger" onClick={onRemoveAllVoice} disabled={voiceCount === 0 && !props.voiceoverTrack}><VolumeX size={16} aria-hidden /> Bỏ toàn bộ giọng</button>
        </div>
        <label className="in-check">
          <input type="checkbox" checked={props.sfx} onChange={(e) => onChange({ ...props, sfx: e.target.checked })} />
          Tiếng “whoosh” mỗi lần đổi câu
        </label>
      </section>

      <SubtitleAiSection
        data-tab="Phụ đề AI"
        sub={sub}
        note="Nghe tiếng trong video (cảnh còn tiếng gốc) và âm thanh tải lên, tạo phụ đề khớp thời gian. Chạy trên máy, không cần API key."
        action="Tạo phụ đề cho cả video"
        onCreate={() => onAutoSubtitles(sub.subtitleOptions("all"))}
        hint="Mất khoảng ⅓–1 lần thời lượng video. Chọn riêng một cảnh hoặc đoạn âm thanh để tạo phụ đề cho phần đó."
      />

      <MusicSection data-tab="Nhạc nền" props={props} onChange={onChange} media={media} />
    </Panel>
  );
};
