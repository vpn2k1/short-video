import { Clapperboard, Film, Image as ImageIcon, Music, Scissors, Tag, Trash2, Upload } from "lucide-react";
import * as ops from "../ops";
import { Field, Seconds, Slider, SpeedControl } from "./controls";
import { CropSection, MotionFrameSection, MotionKeySection } from "./motion";
import { Panel } from "./Panel";
import { ReplaceMedia } from "./ReplaceMedia";
import { SubtitleAiSection, type SubtitleAi } from "./SubtitleAiSection";
import type { InspectorProps, PanelBase } from "./types";

// ---------- cảnh ----------
export const ScenePanel: React.FC<PanelBase & Pick<InspectorProps,
  | "media" | "onDelete" | "onSplit" | "onDetachAudio" | "onStartCrop" | "onLiftScene" | "onAutoSubtitles" | "timeMs" | "onSeek" | "onRun"
  | "uploading" | "onSceneMedia" | "onSceneFile" | "onOpenLibrary"
> & {
  sub: SubtitleAi;
  fitError: string | null;
  setFitError: (error: string | null) => void;
}> = ({
  props, index: i, onChange, onSelect, media, onDelete, onSplit, onDetachAudio, onStartCrop, onLiftScene, onAutoSubtitles, timeMs, onSeek, onRun,
  uploading, onSceneMedia, onSceneFile, onOpenLibrary, sub, fitError, setFitError,
}) => {
  const s = props.scenes[i];
  if (!s) return null;
  const sceneSel: ops.MotionSel = { type: "scene", index: i };
  const video = ops.isVideo(s.image);
  return (
    <Panel key="scene" icon={video ? <Clapperboard size={14} aria-hidden /> : <ImageIcon size={14} aria-hidden />} title={`Cảnh ${i + 1}`} onClose={() => onSelect(null)}>
      <section className="in-sec" data-tab="Cơ bản">
        <h3><Film size={16} aria-hidden /> Cảnh {i + 1}</h3>
        <div className="in-media">
          {s.image ? (
            video ? <video src={`/public/${s.image}`} muted playsInline preload="metadata" /> : <img src={`/public/${s.image}`} alt="" />
          ) : (
            <span>Chưa có ảnh — chọn ở mục ngay bên dưới, hoặc kéo một ảnh/video từ thư viện thả vào cảnh này trên timeline.</span>
          )}
        </div>
        <p className="in-note">
          {((s.endMs - s.startMs) / 1000).toFixed(1)}s · kéo mép phải khối cảnh trên timeline để đổi độ dài.
        </p>
        {s.image ? (
          <div className="in-actions">
            <button
              onClick={() => onLiftScene(i)}
              title="Hình của cảnh thành một video riêng trên timeline — kéo, thu phóng, xoay và đè lên video khác được; chỗ cũ trên hàng Cảnh để trống"
            >
              <Upload size={16} aria-hidden /> Tách thành video riêng
            </button>
            <button onClick={() => onChange(ops.setSceneMedia(props, i, null))}>Bỏ ảnh</button>
          </div>
        ) : null}
      </section>

      <ReplaceMedia
        // Luôn ở tab Cơ bản: chọn hình là việc hay làm nhất với một cảnh, và gán xong mục này không nhảy đi đâu.
        data-tab="Cơ bản"
        title={s.image ? "Thay ảnh/video" : "Chọn ảnh/video cho cảnh"}
        note={s.image
          ? "Giữ nguyên chỗ trên timeline và độ dài cảnh — chỉ đổi hình."
          : "Cảnh đang để nền trơn. Chọn file từ máy, lấy trong thư viện, hay tìm ảnh/clip miễn phí ở Kho free (Pexels, Pixabay)."}
        current={s.image ?? ""}
        media={media}
        uploading={uploading}
        onPick={(item) => onSceneMedia(i, item)}
        onFile={(file) => onSceneFile(i, file)}
        onOpenLibrary={onOpenLibrary}
      />

      {video ? (
        <section className="in-sec" data-tab="Âm thanh & tốc độ">
          <h3><Scissors size={16} aria-hidden /> Clip video</h3>
          <div className="in-2">
            <Field label="Lấy từ giây" hint="Mốc trong clip gốc">
              <Seconds value={s.trimStartMs} onChange={(ms) => onChange(ops.updateScene(props, i, { trimStartMs: ms }), `scene-trim-${i}`)} />
            </Field>
            <Field label="Đến giây" hint="Dài ra thì phần sau lùi">
              <Seconds
                value={s.trimStartMs + (s.endMs - s.startMs) * ops.clipSpeed(s)}
                onChange={(ms) => onChange(ops.setSceneLength(props, i, (ms - s.trimStartMs) / ops.clipSpeed(s)), `scene-to-${i}`)}
              />
            </Field>
          </div>
          <Field label="Tiếng gốc của clip" hint="0% = tắt tiếng">
            <Slider value={s.volume} max={1} onChange={(v) => onChange(ops.updateScene(props, i, { volume: v }), `scene-vol-${i}`)} />
          </Field>
          <SpeedControl
            speed={ops.clipSpeed(s)}
            lengthMs={s.endMs - s.startMs}
            onChange={(v, key) => onChange(ops.setSceneSpeed(props, i, v), key ? `scene-speed-${i}` : undefined)}
          />
          <div className="in-actions">
            <button onClick={() => onDetachAudio(i)} title="Âm thanh thành một đoạn riêng trên track Âm thanh — cắt, dời, chỉnh, xoá độc lập với hình">
              <Music size={16} aria-hidden /> Tách âm thanh ra track riêng
            </button>
          </div>
        </section>
      ) : null}

      {s.image ? (
        <MotionFrameSection data-tab="Khung hình" props={props} onChange={onChange} sel={sceneSel} item={s} timeMs={timeMs} onRun={onRun} />
      ) : null}
      {s.image ? (
        <MotionKeySection data-tab="Chuyển động" props={props} sel={sceneSel} item={s} timeMs={timeMs} onSeek={onSeek} onRun={onRun} />
      ) : null}

      {s.image ? (
        <CropSection data-tab="Khung hình" props={props} onChange={onChange} sel={sceneSel} item={s} onStartCrop={onStartCrop}
          fitError={fitError} setFitError={setFitError} />
      ) : null}

      {video ? (
        <SubtitleAiSection
          data-tab="Phụ đề AI"
          sub={sub}
          action="Tạo phụ đề từ tiếng của cảnh này"
          onCreate={() => onAutoSubtitles(sub.subtitleOptions("scene", i))}
        />
      ) : null}

      <section className="in-sec" data-tab="Chữ trên cảnh">
        <h3><Tag size={16} aria-hidden /> Chữ của phong cách</h3>
        <Field label="Nhãn (tag)" hint="Hiện suốt cảnh — năm, con số, “Bước 1”…">
          <input
            value={s.tag ?? ""}
            maxLength={18}
            onChange={(e) => onChange(ops.updateScene(props, i, { tag: e.target.value || null }), `scene-tag-${i}`)}
          />
        </Field>
        <Field label="Câu nhấn (punch)">
          <input
            value={s.punch?.text ?? ""}
            maxLength={48}
            onChange={(e) => {
              const text = e.target.value;
              const atMs = s.punch?.atMs ?? Math.round(s.startMs + (s.endMs - s.startMs) * 0.3);
              onChange(ops.updateScene(props, i, { punch: text ? { text, atMs } : null }), `scene-punch-${i}`);
            }}
          />
        </Field>
        {s.punch ? (
          <Field label="Câu nhấn hiện lúc (giây)">
            <Seconds
              value={s.punch.atMs}
              onChange={(ms) => onChange(ops.updateScene(props, i, { punch: { text: s.punch!.text, atMs: ms } }), `scene-punchat-${i}`)}
            />
          </Field>
        ) : null}
        <Field label="Hình vẽ">
          <select
            value={s.visual?.type ?? ""}
            onChange={(e) => {
              const type = e.target.value as "" | "stat" | "badge";
              onChange(ops.updateScene(props, i, {
                visual: type ? { type, text: s.visual?.text ?? (type === "stat" ? "80%" : "Bước 1"), caption: s.visual?.caption ?? null } : null,
              }));
            }}
          >
            <option value="">Không</option>
            <option value="stat">Con số lớn</option>
            <option value="badge">Nhãn bước</option>
          </select>
        </Field>
        {s.visual ? (
          <div className="in-2">
            <Field label="Chữ">
              <input
                value={s.visual.text}
                maxLength={16}
                onChange={(e) => onChange(ops.updateScene(props, i, { visual: { ...s.visual!, text: e.target.value || " " } }), `scene-vtext-${i}`)}
              />
            </Field>
            <Field label="Chú thích">
              <input
                value={s.visual.caption ?? ""}
                maxLength={40}
                onChange={(e) => onChange(ops.updateScene(props, i, { visual: { ...s.visual!, caption: e.target.value || null } }), `scene-vcap-${i}`)}
              />
            </Field>
          </div>
        ) : null}
      </section>

      <section className="in-sec in-foot">
        <div className="in-actions">
          <button onClick={onSplit}><Scissors size={16} aria-hidden /> Tách tại đầu phát</button>
          <button className="danger" onClick={onDelete} disabled={props.scenes.length <= 1}><Trash2 size={16} aria-hidden /> Xoá cảnh</button>
        </div>
      </section>
    </Panel>
  );
};
