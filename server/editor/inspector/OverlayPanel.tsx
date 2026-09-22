import { ArrowDown, ArrowUp, Clapperboard, Image as ImageIcon, Scissors, Trash2 } from "lucide-react";
import * as ops from "../ops";
import { Field, Seconds, Slider, SpeedControl } from "./controls";
import { CropSection, MotionFrameSection, MotionKeySection } from "./motion";
import { Panel } from "./Panel";
import { ReplaceMedia } from "./ReplaceMedia";
import type { InspectorProps, PanelBase } from "./types";

// ---------- một video trên timeline ----------
export const OverlayPanel: React.FC<PanelBase & Pick<InspectorProps,
  "media" | "onDelete" | "onSplit" | "onStartCrop" | "timeMs" | "onSeek" | "onRun" | "uploading" | "onReplaceMedia" | "onReplaceFile" | "onOpenLibrary"
> & {
  fitError: string | null;
  setFitError: (error: string | null) => void;
}> = ({
  props, index: i, onChange, onSelect, media, onDelete, onSplit, onStartCrop, timeMs, onSeek, onRun,
  uploading, onReplaceMedia, onReplaceFile, onOpenLibrary, fitError, setFitError,
}) => {
  const overlays = ops.overlaysOf(props);
  const o = overlays[i];
  if (!o) return null;
  const video = ops.isVideo(o.src);
  const set = (patch: Parameters<typeof ops.updateOverlay>[2], key?: string) => onChange(ops.updateOverlay(props, i, patch), key);
  const overlaySel: ops.MotionSel = { type: "overlay", index: i };
  return (
    <Panel key="overlay" icon={video ? <Clapperboard size={14} aria-hidden /> : <ImageIcon size={14} aria-hidden />} title={ops.overlayName(o)} onClose={() => onSelect(null)}>
      <section className="in-sec" data-tab="Cơ bản">
        <h3>{video ? <Clapperboard size={16} aria-hidden /> : <ImageIcon size={16} aria-hidden />} {ops.overlayName(o)} trên timeline</h3>
        <div className="in-media">
          {video
            ? <video src={`/public/${o.src}`} muted playsInline preload="metadata" />
            : <img src={`/public/${o.src}`} alt="" />}
        </div>
        <p className="in-note">
          {o.src} · {((o.endMs - o.startMs) / 1000).toFixed(1)}s · hàng {ops.overlayName(o)}
        </p>
        <div className="in-2">
          <Field label="Bắt đầu (giây)">
            <Seconds value={o.startMs} onChange={(ms) => set({ startMs: ms, endMs: ms + (o.endMs - o.startMs) }, `overlay-start-${i}`)} />
          </Field>
          <Field label="Độ dài (giây)">
            <Seconds value={o.endMs - o.startMs} min={ops.MIN_MS} onChange={(ms) => set({ endMs: o.startMs + ms }, `overlay-len-${i}`)} />
          </Field>
        </div>
        <div className="in-actions">
          <button onClick={() => set({ track: o.track + 1 })} title="Hàng cao hơn vẽ trên khi hai video đè nhau"><ArrowUp size={16} aria-hidden /> Lên hàng Video {o.track + 2}</button>
          <button disabled={o.track === 0} onClick={() => set({ track: o.track - 1 })}><ArrowDown size={16} aria-hidden /> Xuống hàng Video {o.track}</button>
        </div>
        <small className="in-hint">Kéo khối lên/xuống trên timeline cũng đổi hàng. Hàng cao vẽ trên hàng thấp.</small>
      </section>

      <ReplaceMedia
        data-tab="Thay thế"
        current={o.src}
        media={media}
        uploading={uploading}
        onPick={(item) => onReplaceMedia(i, item)}
        onFile={(file) => onReplaceFile(i, file)}
        onOpenLibrary={onOpenLibrary}
      />

      <MotionKeySection data-tab="Chuyển động" props={props} sel={overlaySel} item={o} timeMs={timeMs} onSeek={onSeek} onRun={onRun} />

      <MotionFrameSection data-tab="Khung hình" props={props} onChange={onChange} sel={overlaySel} item={o} timeMs={timeMs} onRun={onRun} />

      <CropSection data-tab="Khung hình" props={props} onChange={onChange} sel={overlaySel} item={o} onStartCrop={onStartCrop}
        fitError={fitError} setFitError={setFitError} />

      {video ? (
        <section className="in-sec" data-tab="Âm thanh & tốc độ">
          <h3><Scissors size={16} aria-hidden /> Clip video</h3>
          <Field label="Lấy từ giây" hint="Mốc trong clip gốc">
            <Seconds value={o.trimStartMs} onChange={(ms) => set({ trimStartMs: ms }, `overlay-trim-${i}`)} />
          </Field>
          <Field label="Tiếng gốc của clip" hint="0% = tắt tiếng">
            <Slider value={o.volume} max={1} onChange={(v) => set({ volume: v }, `overlay-vol-${i}`)} />
          </Field>
          <SpeedControl
            speed={ops.clipSpeed(o)}
            lengthMs={o.endMs - o.startMs}
            onChange={(v, key) => onChange(ops.setOverlaySpeed(props, i, v), key ? `overlay-speed-${i}` : undefined)}
          />
        </section>
      ) : null}

      <section className="in-sec in-foot">
        <div className="in-actions">
          <button onClick={onSplit}><Scissors size={16} aria-hidden /> Tách tại đầu phát</button>
          <button className="danger" onClick={onDelete}><Trash2 size={16} aria-hidden /> Xoá video này</button>
        </div>
      </section>
    </Panel>
  );
};
