import { useState } from "react";
import type { ShortProps } from "../../src/compositions/Short/schema";
import { ASPECT_IDS, ASPECTS } from "../../src/aspects";
import { STYLE_IDS, STYLES } from "../../src/styles/meta";
import type { MediaItem, SubtitleOptions, VoiceOption } from "./api";
import * as ops from "./ops";

type Props = {
  props: ShortProps;
  selection: ops.Selection;
  media: MediaItem[];
  voices: VoiceOption[];
  onChange: (next: ShortProps, mergeKey?: string) => void;
  onSelect: (selection: ops.Selection) => void;
  onDelete: () => void;
  onSplit: () => void;
  onDuplicateText: () => void;
  /** index bỏ trống = đổi giọng toàn bộ. */
  onVoice: (voice: string, index?: number) => void;
  onRemoveAllVoice: () => void;
  /** Tách âm thanh của cảnh video ra track riêng. */
  onDetachAudio: (sceneIndex: number) => void;
  /** Mở khung chọn vùng crop trên khung xem trước. */
  onStartCrop: (sceneIndex: number) => void;
  onAutoSubtitles: (options: SubtitleOptions) => void;
};

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="in-field">
    <span className="in-label">{label}</span>
    {children}
    {hint ? <small className="in-hint">{hint}</small> : null}
  </label>
);

/** Ô nhập giây (hiển thị) ↔ ms (dữ liệu). */
const Seconds: React.FC<{ value: number; onChange: (ms: number) => void; min?: number }> = ({ value, onChange, min = 0 }) => (
  <input
    type="number"
    step={0.1}
    min={min / 1000}
    value={(value / 1000).toFixed(2)}
    onChange={(e) => {
      const seconds = Number(e.target.value);
      if (Number.isFinite(seconds)) onChange(Math.max(min, Math.round(seconds * 1000)));
    }}
  />
);

const Slider: React.FC<{ value: number; min?: number; max: number; step?: number; format?: (v: number) => string; onChange: (v: number) => void }> = ({
  value, min = 0, max, step = 0.05, format = (v) => `${Math.round(v * 100)}%`, onChange,
}) => (
  <div className="in-range">
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    <b>{format(value)}</b>
  </div>
);

const VoiceSelect: React.FC<{ voices: VoiceOption[]; value: string; onChange: (key: string) => void }> = ({ voices, value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>
    {(["vi", "en"] as const).map((lang) => (
      <optgroup key={lang} label={lang === "vi" ? "Tiếng Việt" : "Tiếng Anh"}>
        {voices.filter((v) => v.lang === lang).map((v) => (
          <option key={v.key} value={v.key} disabled={v.paidPlan}>
            {v.key} — {v.label.split("—")[1]?.trim()} · {v.engine === "say" ? "miễn phí" : "ElevenLabs"}{v.paidPlan ? " (trả phí)" : ""}
          </option>
        ))}
      </optgroup>
    ))}
  </select>
);

/** Bảng thuộc tính bên phải — nội dung đổi theo mục đang chọn trên timeline. */
export const Inspector: React.FC<Props> = ({
  props, selection, media, voices, onChange, onSelect, onDelete, onSplit, onDuplicateText, onVoice, onRemoveAllVoice, onDetachAudio,
  onStartCrop, onAutoSubtitles,
}) => {
  const [voice, setVoice] = useState("linh");
  const [subLanguage, setSubLanguage] = useState<SubtitleOptions["language"]>("vi");
  const [subQuality, setSubQuality] = useState<SubtitleOptions["quality"]>("accurate");
  const [subReplace, setSubReplace] = useState(true);
  const subtitleOptions = (source: SubtitleOptions["source"], index?: number): SubtitleOptions => ({
    source, index, language: subLanguage, quality: subQuality, replace: subReplace,
  });
  const subtitleSettings = (
    <>
      <div className="in-2">
        <Field label="Ngôn ngữ lời nói">
          <select value={subLanguage} onChange={(e) => setSubLanguage(e.target.value as SubtitleOptions["language"])}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">Tiếng Anh</option>
            <option value="auto">Tự nhận</option>
          </select>
        </Field>
        <Field label="Chế độ">
          <select value={subQuality} onChange={(e) => setSubQuality(e.target.value as SubtitleOptions["quality"])}>
            <option value="accurate">Chính xác</option>
            <option value="fast">Nhanh</option>
          </select>
        </Field>
      </div>
      <label className="in-check">
        <input type="checkbox" checked={subReplace} onChange={(e) => setSubReplace(e.target.checked)} />
        Thay phụ đề cũ trong đoạn được phiên âm
      </label>
    </>
  );
  const audio = media.filter((m) => m.kind === "audio");
  const voiceCount = props.captions.filter((c) => c.audio).length;

  const musicSection = (
    <section className="in-sec">
      <h3>♪ Nhạc nền</h3>
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

  // ---------- văn bản tự do ----------
  if (selection?.type === "text") {
    const t = props.texts[selection.index];
    if (!t) return null;
    const i = selection.index;
    const set = (patch: Parameters<typeof ops.updateText>[2], key?: string) => onChange(ops.updateText(props, i, patch), key);
    return (
      <div className="in">
        <section className="in-sec">
          <h3>🅣 Văn bản</h3>
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

        <section className="in-sec">
          <h3>📍 Vị trí</h3>
          <div className="in-presets">
            <button onClick={() => set({ x: 50, y: 12 })}>Trên</button>
            <button onClick={() => set({ x: 50, y: 50 })}>Giữa</button>
            <button onClick={() => set({ x: 50, y: 80 })}>Dưới</button>
            <button onClick={() => set({ x: 22, y: t.y, align: "left" })}>Trái</button>
            <button onClick={() => set({ x: 78, y: t.y, align: "right" })}>Phải</button>
          </div>
          <Field label="Ngang">
            <Slider value={t.x} max={100} step={0.5} format={(v) => `${Math.round(v)}%`} onChange={(v) => set({ x: v }, `text-x-${i}`)} />
          </Field>
          <Field label="Dọc" hint="Hoặc kéo khung chữ ngay trên khung xem trước">
            <Slider value={t.y} max={100} step={0.5} format={(v) => `${Math.round(v)}%`} onChange={(v) => set({ y: v }, `text-y-${i}`)} />
          </Field>
          <Field label="Bề rộng tối đa">
            <Slider value={t.maxWidth} min={10} max={100} step={1} format={(v) => `${Math.round(v)}%`} onChange={(v) => set({ maxWidth: v }, `text-w-${i}`)} />
          </Field>
        </section>

        <section className="in-sec">
          <h3>🎨 Kiểu chữ</h3>
          <Field label="Cỡ chữ">
            <Slider value={t.size} min={16} max={240} step={1} format={(v) => `${Math.round(v)}`} onChange={(v) => set({ size: v }, `text-size-${i}`)} />
          </Field>
          <div className="in-2">
            <Field label="Màu chữ">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#ffffff"} onChange={(e) => set({ color: e.target.value }, `text-color-${i}`)} />
            </Field>
            <Field label="Độ đậm">
              <select value={t.weight} onChange={(e) => set({ weight: Number(e.target.value) })}>
                <option value={400}>Thường</option>
                <option value={600}>Vừa</option>
                <option value={800}>Đậm</option>
                <option value={900}>Rất đậm</option>
              </select>
            </Field>
          </div>
          <label className="in-check">
            <input type="checkbox" checked={t.background !== null} onChange={(e) => set({ background: e.target.checked ? "#000000" : null })} />
            Khối nền sau chữ
          </label>
          {t.background !== null ? (
            <Field label="Màu khối nền">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(t.background) ? t.background : "#000000"} onChange={(e) => set({ background: e.target.value }, `text-bg-${i}`)} />
            </Field>
          ) : (
            <label className="in-check">
              <input type="checkbox" checked={t.shadow} onChange={(e) => set({ shadow: e.target.checked })} />
              Bóng đổ cho dễ đọc
            </label>
          )}
          <div className="in-2">
            <Field label="Căn lề">
              <select value={t.align} onChange={(e) => set({ align: e.target.value as "left" | "center" | "right" })}>
                <option value="left">Trái</option>
                <option value="center">Giữa</option>
                <option value="right">Phải</option>
              </select>
            </Field>
            <Field label="Hiệu ứng hiện">
              <select value={t.animation} onChange={(e) => set({ animation: e.target.value as typeof t.animation })}>
                <option value="pop">Bật lên</option>
                <option value="fade">Mờ dần</option>
                <option value="slide">Trượt lên</option>
                <option value="typewriter">Gõ chữ</option>
                <option value="none">Không</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="in-sec">
          <div className="in-actions">
            <button onClick={onDuplicateText}>⧉ Nhân đôi</button>
            <button onClick={onSplit}>✂️ Tách tại đầu phát</button>
            <button className="danger" onClick={onDelete}>🗑 Xoá</button>
          </div>
        </section>
      </div>
    );
  }

  // ---------- phụ đề ----------
  if (selection?.type === "caption") {
    const c = props.captions[selection.index];
    if (!c) return null;
    const i = selection.index;
    return (
      <div className="in">
        <section className="in-sec">
          <h3>💬 Phụ đề {i + 1}</h3>
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
            <button onClick={onSplit}>✂️ Tách tại đầu phát</button>
            <button className="danger" onClick={onDelete}>🗑 Xoá</button>
          </div>
        </section>

        <section className="in-sec">
          <h3>🎙 Giọng đọc của câu</h3>
          <p className="in-note">
            {c.audio ? "Câu này có giọng đọc — dời phụ đề thì giọng dời theo. Sửa chữ xong nên đọc lại cho khớp." : "Câu này chưa có giọng đọc."}
          </p>
          {c.audio ? <audio controls preload="none" src={`/public/${c.audio}`} /> : null}
          <Field label="Giọng">
            <VoiceSelect voices={voices} value={voice} onChange={setVoice} />
          </Field>
          <div className="in-actions">
            <button onClick={() => onVoice(voice, i)} disabled={!c.text.trim()}>🎙 {c.audio ? "Đọc lại câu này" : "Tạo giọng cho câu này"}</button>
            {c.audio ? <button onClick={() => onChange(ops.updateCaption(props, i, { audio: null }))}>🔇 Bỏ giọng câu này</button> : null}
          </div>
        </section>
      </div>
    );
  }

  // ---------- cảnh ----------
  if (selection?.type === "scene") {
    const s = props.scenes[selection.index];
    if (!s) return null;
    const i = selection.index;
    const video = ops.isVideo(s.image);
    return (
      <div className="in">
        <section className="in-sec">
          <h3>🎞 Cảnh {i + 1}</h3>
          <div className="in-media">
            {s.image ? (
              video ? <video src={`/public/${s.image}`} muted playsInline preload="metadata" /> : <img src={`/public/${s.image}`} alt="" />
            ) : (
              <span>Chưa có ảnh — bấm một ảnh/video ở thư viện bên trái để gán.</span>
            )}
          </div>
          <p className="in-note">
            {((s.endMs - s.startMs) / 1000).toFixed(1)}s · kéo mép phải khối cảnh trên timeline để đổi độ dài.
          </p>
          {s.image ? (
            <div className="in-actions">
              <button onClick={() => onChange(ops.setSceneMedia(props, i, null))}>Bỏ ảnh</button>
            </div>
          ) : null}
        </section>

        {video ? (
          <section className="in-sec">
            <h3>✂️ Clip video</h3>
            <div className="in-2">
              <Field label="Lấy từ giây" hint="Mốc trong clip gốc">
                <Seconds value={s.trimStartMs} onChange={(ms) => onChange(ops.updateScene(props, i, { trimStartMs: ms }), `scene-trim-${i}`)} />
              </Field>
              <Field label="Đến giây" hint="Dài ra thì phần sau lùi">
                <Seconds
                  value={s.trimStartMs + (s.endMs - s.startMs)}
                  onChange={(ms) => onChange(ops.setSceneLength(props, i, ms - s.trimStartMs), `scene-to-${i}`)}
                />
              </Field>
            </div>
            <Field label="Tiếng gốc của clip" hint="0% = tắt tiếng">
              <Slider value={s.volume} max={1} onChange={(v) => onChange(ops.updateScene(props, i, { volume: v }), `scene-vol-${i}`)} />
            </Field>
            <div className="in-actions">
              <button onClick={() => onDetachAudio(i)} title="Âm thanh thành một đoạn riêng trên track Âm thanh — cắt, dời, chỉnh, xoá độc lập với hình">
                🎵 Tách âm thanh ra track riêng
              </button>
            </div>
          </section>
        ) : null}

        {s.image ? (
          <section className="in-sec">
            <h3>🔲 Crop khung hình</h3>
            <p className="in-note">
              {!s.crop
                ? "Chưa crop — đang dùng toàn bộ ảnh/video."
                : "w" in s.crop
                  ? `Lấy ${Math.round(s.crop.w * 100)}% × ${Math.round(s.crop.h * 100)}% ảnh gốc · ${s.crop.fit === "cover" ? "lấp đầy" : "vừa khung"}` +
                    `${s.crop.rotate ? ` · xoay ${s.crop.rotate}°` : ""}${s.crop.flipH ? " · lật ngang" : ""}${s.crop.flipV ? " · lật dọc" : ""}.`
                  : `Crop kiểu cũ: lấy ${Math.round(s.crop.size * 100)}% khung. Mở khung crop để chỉnh theo kiểu mới.`}
            </p>
            <div className="in-actions">
              <button onClick={() => onStartCrop(i)}>🔲 Mở khung crop</button>
              {s.crop ? <button onClick={() => onChange(ops.updateScene(props, i, { crop: null }))}>Bỏ crop</button> : null}
            </div>
            <small className="in-hint">Giống CapCut: chọn tỉ lệ, kéo 8 điểm, xoay, lật, lấp đầy hoặc vừa khung.</small>
          </section>
        ) : null}

        {video ? (
          <section className="in-sec">
            <h3>📝 Phụ đề tự động</h3>
            {subtitleSettings}
            <div className="in-actions">
              <button onClick={() => onAutoSubtitles(subtitleOptions("scene", i))}>📝 Tạo phụ đề từ tiếng của cảnh này</button>
            </div>
          </section>
        ) : null}

        <section className="in-sec">
          <h3>🏷 Chữ của phong cách</h3>
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

        <section className="in-sec">
          <div className="in-actions">
            <button onClick={onSplit}>✂️ Tách cảnh tại đầu phát</button>
            <button className="danger" onClick={onDelete} disabled={props.scenes.length <= 1}>🗑 Xoá cảnh</button>
          </div>
        </section>
      </div>
    );
  }

  // ---------- âm thanh thêm tay ----------
  if (selection?.type === "clip") {
    const c = props.audioClips[selection.index];
    if (!c) return null;
    const i = selection.index;
    return (
      <div className="in">
        <section className="in-sec">
          <h3>🔊 Âm thanh</h3>
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
          <div className="in-actions">
            <button onClick={onSplit}>✂️ Tách tại đầu phát</button>
            <button className="danger" onClick={onDelete}>🗑 Xoá âm thanh</button>
          </div>
        </section>
        <section className="in-sec">
          <h3>📝 Phụ đề tự động</h3>
          {subtitleSettings}
          <div className="in-actions">
            <button onClick={() => onAutoSubtitles(subtitleOptions("clip", i))}>📝 Tạo phụ đề từ đoạn âm thanh này</button>
          </div>
        </section>
      </div>
    );
  }

  if (selection?.type === "music") {
    return (
      <div className="in">
        {musicSection}
        {props.music ? (
          <section className="in-sec"><div className="in-actions"><button className="danger" onClick={onDelete}>🗑 Bỏ nhạc</button></div></section>
        ) : null}
      </div>
    );
  }

  // ---------- không chọn gì: cài đặt chung ----------
  return (
    <div className="in">
      <section className="in-sec">
        <h3>🎬 Video</h3>
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

      <section className="in-sec">
        <h3>🎙 Giọng đọc</h3>
        <p className="in-note">{voiceCount > 0 ? `${voiceCount}/${props.captions.length} câu có giọng đọc.` : "Video chưa có giọng đọc."}</p>
        <Field label="Âm lượng giọng" hint="0% = tắt tiếng giọng mà vẫn giữ file">
          <Slider value={props.voiceVolume} max={2} onChange={(v) => onChange({ ...props, voiceVolume: v }, "voiceVolume")} />
        </Field>
        <Field label="Đổi sang giọng" hint="Đọc lại mọi câu; câu dài hơn thì phần phía sau tự lùi lại">
          <VoiceSelect voices={voices} value={voice} onChange={setVoice} />
        </Field>
        <div className="in-actions">
          <button onClick={() => onVoice(voice)} disabled={props.captions.length === 0}>🎙 {voiceCount > 0 ? "Đổi giọng toàn bộ" : "Tạo giọng cho mọi câu"}</button>
          <button className="danger" onClick={onRemoveAllVoice} disabled={voiceCount === 0 && !props.voiceoverTrack}>🔇 Bỏ toàn bộ giọng</button>
        </div>
        <label className="in-check">
          <input type="checkbox" checked={props.sfx} onChange={(e) => onChange({ ...props, sfx: e.target.checked })} />
          Tiếng “whoosh” mỗi lần đổi câu
        </label>
      </section>

      <section className="in-sec">
        <h3>📝 Phụ đề tự động</h3>
        <p className="in-note">
          Nghe tiếng trong video (cảnh còn tiếng gốc) và âm thanh tải lên, tạo phụ đề khớp thời gian. Chạy trên máy, không cần API key.
        </p>
        {subtitleSettings}
        <div className="in-actions">
          <button onClick={() => onAutoSubtitles(subtitleOptions("all"))}>📝 Tạo phụ đề cho cả video</button>
        </div>
        <small className="in-hint">Mất khoảng ⅓–1 lần thời lượng video. Chọn riêng một cảnh hoặc đoạn âm thanh để tạo phụ đề cho phần đó.</small>
      </section>

      {musicSection}

      <p className="in-tip">
        Bấm một khối trên timeline để sửa riêng. Phím tắt: <kbd>Space</kbd> phát, <kbd>S</kbd> tách,
        <kbd>T</kbd> thêm văn bản, <kbd>Delete</kbd> xoá, <kbd>⌘Z</kbd> hoàn tác.
      </p>
      <button className="in-link" onClick={() => onSelect({ type: "music" })}>Chỉnh nhạc nền →</button>
    </div>
  );
};
