import { Music, Trash2 } from "lucide-react";
import type { MediaItem } from "../api";
import { Field, Slider } from "./controls";
import { Panel } from "./Panel";
import type { InspectorProps } from "./types";

/** Mục "Nhạc nền" — ở bảng Nhạc nền và tab Nhạc nền của dự án. */
export const MusicSection: React.FC<Pick<InspectorProps, "props" | "onChange"> & {
  media: MediaItem[];
  /** Tên tab trong bảng thuộc tính (Panel đọc). */
  "data-tab"?: string;
}> = ({ props, onChange, media, "data-tab": tab }) => {
  const audio = media.filter((m) => m.kind === "audio");
  return (
    <section className="in-sec" data-tab={tab}>
      <h3><Music size={16} aria-hidden /> Nhạc nền</h3>
      <Field label="File nhạc">
        <select value={props.music ?? ""} onChange={(e) => onChange({ ...props, music: e.target.value || null })}>
          <option value="">Không nhạc</option>
          {props.music && !audio.some((a) => a.path === props.music) ? <option value={props.music}>{props.music}</option> : null}
          {audio.map((a) => <option key={a.path} value={a.path}>{a.path}</option>)}
        </select>
      </Field>
      <Field label="Âm lượng nhạc" hint="Tự hạ nhỏ khi có giọng đọc">
        <Slider value={props.musicVolume} max={1} onChange={(v) => onChange({ ...props, musicVolume: v }, "musicVolume")} />
      </Field>
    </section>
  );
};

export const MusicPanel: React.FC<Pick<InspectorProps, "props" | "onChange" | "onSelect" | "onDelete" | "media">> = ({
  props, onChange, onSelect, onDelete, media,
}) => (
  <Panel key="music" icon={<Music size={14} aria-hidden />} title="Nhạc nền" onClose={() => onSelect(null)}>
    <MusicSection data-tab="Nhạc nền" props={props} onChange={onChange} media={media} />
    {props.music ? (
      <section className="in-sec in-foot"><div className="in-actions"><button className="danger" onClick={onDelete}><Trash2 size={16} aria-hidden /> Bỏ nhạc</button></div></section>
    ) : null}
  </Panel>
);
