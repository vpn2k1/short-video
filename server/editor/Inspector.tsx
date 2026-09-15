import { Children, isValidElement, useState } from "react";
import { CAPTION_FONTS, CAPTION_PRESETS, type CaptionLook, type ShortProps } from "../../src/compositions/Short/schema";
import { ASPECT_IDS, ASPECTS } from "../../src/aspects";
import { STYLE_IDS, STYLES } from "../../src/styles/meta";
import {
  CAPTION_FONT_LABELS, CAPTION_PRESET_LABELS, CAPTION_TEMPLATES, canCustomizeCaptions, resolveCaptionLook, textLook, usesCustomCaptions,
} from "../../src/components/captionLook";
import { captionTextStyle } from "../../src/components/CustomCaptions";
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
            {v.key} — {v.label.split("—")[1]?.trim()} · {v.engineLabel}{v.paidPlan ? " (trả phí)" : ""}
          </option>
        ))}
      </optgroup>
    ))}
  </select>
);

const hexOr = (value: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);

const SPEED_PRESETS = [0.5, 1, 1.5, 2, 3];
const formatSpeed = (v: number) => `${Number(v.toFixed(2))}x`;

/**
 * Tốc độ phát kiểu CapCut: nút nhanh + thanh kéo 0.25–4x. Không bọc trong <label> (Field) — bấm vào chữ nhãn
 * sẽ kích hoạt nút đầu tiên bên trong.
 */
const SpeedControl: React.FC<{ speed: number; lengthMs: number; onChange: (speed: number, mergeKey?: string) => void }> = ({
  speed, lengthMs, onChange,
}) => (
  <div className="in-field">
    <span className="in-label">Tốc độ</span>
    <div className="in-seg" role="radiogroup" aria-label="Tốc độ">
      {SPEED_PRESETS.map((value) => (
        <button key={value} role="radio" aria-checked={Math.abs(speed - value) < 0.001} className={Math.abs(speed - value) < 0.001 ? "on" : ""} onClick={() => onChange(value)}>
          {formatSpeed(value)}
        </button>
      ))}
    </div>
    <Slider value={speed} min={ops.SPEED_MIN} max={ops.SPEED_MAX} step={0.05} format={formatSpeed} onChange={(v) => onChange(v, "speed")} />
    <small className="in-hint">
      Dài {(lengthMs / 1000).toFixed(1)}s trên timeline — đổi tốc độ thì dài/ngắn lại theo, đoạn file dùng giữ nguyên.
    </small>
  </div>
);

type LookScope = "all" | "selected" | "checked";

/**
 * Bảng chỉnh kiểu chữ kiểu CapCut, dùng chung cho phụ đề và văn bản tự do: phạm vi áp dụng (tất cả / mục đang
 * chọn / các mục tích chọn), mẫu nhanh, kiểu chữ, font, màu, cỡ chữ, căn chữ, khung bọc chữ, vị trí.
 * Chọn mục khác trên timeline vẫn giữ phạm vi và dấu tích.
 */
const LookPanel: React.FC<{
  title: string;
  /** "phụ đề" | "văn bản" — dùng trong nhãn. */
  noun: string;
  items: string[];
  selected: number;
  defaultScope: LookScope;
  /** Kiểu hiển thị trên các ô chỉnh: index null = kiểu chung (áp cho tất cả). */
  lookAt: (index: number | null) => CaptionLook;
  apply: (indices: number[] | null, patch: Partial<CaptionLook>, mergeKey?: string) => void;
  /** Áp cho tất cả có đổi vị trí không — phụ đề dùng chung vị trí; văn bản thì mỗi cái một chỗ. */
  positionForAll: boolean;
  /** Mục có kiểu riêng (đánh dấu ● trong danh sách tích chọn). */
  hasOwnStyle?: (index: number) => boolean;
  /** Tô viền kiểu chữ đang dùng. */
  markPreset?: boolean;
  intro?: React.ReactNode;
  footer?: React.ReactNode;
  /** Tên tab trong bảng thuộc tính (Panel đọc). */
  "data-tab"?: string;
}> = ({ title, noun, items, selected, defaultScope, lookAt, apply, positionForAll, hasOwnStyle, markPreset = true, intro, footer }) => {
  const [scope, setScope] = useState<LookScope>(defaultScope);
  const [checked, setChecked] = useState<Set<number>>(() => new Set([selected]));

  // Xoá/tách làm số mục đổi — bỏ các dấu tích không còn hợp lệ.
  const picked = [...checked].filter((k) => k < items.length).sort((a, b) => a - b);
  const indices = scope === "all" ? null : scope === "selected" ? [selected] : picked;
  const look = lookAt(scope === "all" ? null : indices?.[0] ?? selected);
  const disabled = scope === "checked" && picked.length === 0;
  const positionLocked = scope === "all" && !positionForAll;

  const set = (patch: Partial<CaptionLook>, key?: string) => {
    if (disabled) return;
    apply(indices, patch, key ? `look-${noun}-${key}-${scope}-${picked.join(".")}` : undefined);
  };
  const toggle = (k: number) =>
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const sample = (patch: Partial<CaptionLook>) => captionTextStyle({ ...look, ...patch, uppercase: false }, 15);
  const accentLabel =
    look.preset === "box" || look.preset === "highlight" ? "Màu nền"
      : look.preset === "neon" ? "Màu phát sáng"
        : look.preset === "pop3d" ? "Màu bóng 3D"
          : "Màu viền";
  const one = noun === "phụ đề" ? `Câu ${selected + 1}` : `Văn bản ${selected + 1}`;

  return (
    <section className="in-sec">
      <h3>{title}</h3>
      {intro}

      <span className="in-label">Áp dụng cho</span>
      <div className="in-scope" role="radiogroup" aria-label="Áp dụng cho">
        {([
          ["selected", one],
          ["all", `Tất cả ${noun} (${items.length})`],
          ["checked", `Đã tích (${picked.length})`],
        ] as const).map(([value, label]) => (
          <button key={value} role="radio" aria-checked={scope === value} className={scope === value ? "on" : ""} onClick={() => setScope(value)}>
            {label}
          </button>
        ))}
      </div>

      {scope === "checked" ? (
        <div className="cap-pick">
          <div className="cap-pick-bar">
            <button onClick={() => setChecked(new Set(items.map((_, k) => k)))}>Tích tất cả</button>
            <button onClick={() => setChecked(new Set())}>Bỏ tích</button>
          </div>
          <div className="cap-list">
            {items.map((text, k) => (
              <label key={k} className={`cap-item ${k === selected ? "current" : ""}`}>
                <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} />
                <b>{k + 1}</b>
                <span title={text}>{text.replace(/\n/g, " ⏎ ") || "(trống)"}</span>
                {hasOwnStyle?.(k) ? <i title="Có kiểu riêng">●</i> : null}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <fieldset className="cap-controls" disabled={disabled}>
        <span className="in-label">Mẫu nhanh</span>
        <div className="cap-templates">
          {CAPTION_TEMPLATES.map((template) => (
            <button key={template.label} onClick={() => set(template.look)} title={template.label}>
              <span style={sample(template.look)}>Aa</span>
              <small>{template.label}</small>
            </button>
          ))}
        </div>

        <span className="in-label">Kiểu chữ</span>
        <div className="cap-presets">
          {CAPTION_PRESETS.map((preset) => (
            <button key={preset} className={markPreset && look.preset === preset ? "on" : ""} onClick={() => set({ preset })}>
              <span style={sample({ preset })}>Aa</span>
              <small>{CAPTION_PRESET_LABELS[preset]}</small>
            </button>
          ))}
        </div>

        <Field label="Font chữ">
          <select value={look.font} onChange={(e) => set({ font: e.target.value as CaptionLook["font"] })}>
            {CAPTION_FONTS.map((font) => (
              <option key={font} value={font}>{CAPTION_FONT_LABELS[font]}</option>
            ))}
          </select>
        </Field>
        <Field label="Cỡ chữ (px, tính ở khung 1080)">
          <div className="in-size">
            <input type="range" min={16} max={240} step={1} value={look.size} onChange={(e) => set({ size: Number(e.target.value) }, "size")} />
            <input
              type="number"
              min={16}
              max={240}
              step={1}
              value={Math.round(look.size)}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value > 0) set({ size: Math.min(240, Math.max(16, Math.round(value))) }, "size");
              }}
            />
          </div>
        </Field>
        <div className="in-2">
          <Field label="Màu chữ">
            <input type="color" value={hexOr(look.color, "#ffffff")} onChange={(e) => set({ color: e.target.value }, "color")} />
          </Field>
          <Field label={accentLabel}>
            <input
              type="color"
              value={hexOr(look.accent, "#000000")}
              disabled={look.preset === "plain" || look.preset === "shadow"}
              onChange={(e) => set({ accent: e.target.value }, "accent")}
            />
          </Field>
        </div>
        <div className="in-2">
          <Field label="Độ đậm">
            <select value={look.weight} onChange={(e) => set({ weight: Number(e.target.value) })}>
              <option value={400}>Thường</option>
              <option value={600}>Vừa</option>
              <option value={800}>Đậm</option>
              <option value={900}>Rất đậm</option>
            </select>
          </Field>
          <div>
            <label className="in-check">
              <input type="checkbox" checked={look.uppercase} onChange={(e) => set({ uppercase: e.target.checked })} />
              In hoa
            </label>
            <label className="in-check">
              <input type="checkbox" checked={look.italic} onChange={(e) => set({ italic: e.target.checked })} />
              Nghiêng
            </label>
          </div>
        </div>

        <span className="in-label">Căn chữ</span>
        <div className="in-seg" role="radiogroup" aria-label="Căn chữ">
          {([["left", "⇤ Trái"], ["center", "↔ Giữa"], ["right", "Phải ⇥"]] as const).map(([value, label]) => (
            <button key={value} role="radio" aria-checked={look.align === value} className={look.align === value ? "on" : ""} onClick={() => set({ align: value })}>
              {label}
            </button>
          ))}
        </div>
        <Field label="Khung chữ — dài hơn thì tự xuống dòng" hint="Hoặc kéo tay nắm hai bên khung chữ trên khung xem trước.">
          <Slider value={look.width} min={10} max={100} step={1} format={(v) => `${Math.round(v)}%`} onChange={(v) => set({ width: v }, "width")} />
        </Field>

        <span className="in-label">Vị trí</span>
        {positionLocked ? (
          <p className="in-note">Mỗi {noun} một vị trí — chọn “{one}” hoặc kéo trên khung xem trước để dời.</p>
        ) : (
          <>
            <div className="in-presets">
              <button onClick={() => set({ x: 50, y: 14 })}>Trên</button>
              <button onClick={() => set({ x: 50, y: 50 })}>Giữa</button>
              <button onClick={() => set({ x: 50, y: 80 })}>Dưới</button>
            </div>
            <Field label="Ngang">
              <Slider value={look.x} max={100} step={0.5} format={(v) => `${Math.round(v)}%`} onChange={(v) => set({ x: v }, "x")} />
            </Field>
            <Field label="Dọc" hint={noun === "phụ đề" ? "Hoặc kéo phụ đề trên khung xem trước — giữ Alt (Option) khi kéo để chỉ dời một câu." : "Hoặc kéo khung chữ trên khung xem trước."}>
              <Slider value={look.y} max={100} step={0.5} format={(v) => `${Math.round(v)}%`} onChange={(v) => set({ y: v }, "y")} />
            </Field>
          </>
        )}
      </fieldset>

      {footer}
    </section>
  );
};

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
        <h3>🎨 Kiểu phụ đề</h3>
        <p className="in-note">
          Phong cách “{STYLES[props.style as keyof typeof STYLES]?.label ?? props.style}” dùng phụ đề làm nội dung
          (bong bóng, thẻ bài đăng, câu hỏi, bảng xếp hạng) nên không đổi kiểu chữ được.
        </p>
      </section>
    );
  }
  const custom = usesCustomCaptions(props);
  return (
    <LookPanel
      title="🎨 Kiểu phụ đề"
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
            <button onClick={() => onChange(ops.clearCaptionLooks(props))}>↺ Về kiểu của phong cách</button>
          </div>
        ) : null
      }
    />
  );
};

type TabChild = React.ReactElement<{ "data-tab"?: string; className?: string }>;

/**
 * Khung bảng thuộc tính kiểu CapCut: tiêu đề mục đang chọn, hàng tab, nội dung tab, nút thao tác dính đáy.
 * Con có `data-tab` mở một tab mới (trùng tên thì gộp vào tab đó); con không có thì thuộc tab ngay trước;
 * con có class `in-foot` nằm ở đáy, luôn thấy.
 */
const Panel: React.FC<{ icon: string; title: string; onClose?: () => void; children: React.ReactNode }> = ({
  icon, title, onClose, children,
}) => {
  const [active, setActive] = useState<string | null>(null);
  const groups: { label: string; items: React.ReactNode[] }[] = [];
  const footer: React.ReactNode[] = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    const { className, "data-tab": label } = (child as TabChild).props;
    if (className?.split(" ").includes("in-foot")) {
      footer.push(child);
      return;
    }
    const existing = label ? groups.find((g) => g.label === label) : groups.at(-1);
    if (existing) existing.items.push(child);
    else groups.push({ label: label ?? "Cơ bản", items: [child] });
  });
  const current = groups.find((g) => g.label === active) ?? groups[0];

  return (
    <div className="in">
      <header className="in-head">
        <b><i>{icon}</i>{title}</b>
        {onClose ? <button className="in-close" onClick={onClose} title="Bỏ chọn (Esc)" aria-label="Bỏ chọn">✕</button> : null}
      </header>
      {groups.length > 1 ? (
        <nav className="in-tabs" role="tablist">
          {groups.map((g) => (
            <button key={g.label} role="tab" aria-selected={g === current} className={g === current ? "on" : ""} onClick={() => setActive(g.label)}>
              {g.label}
            </button>
          ))}
        </nav>
      ) : null}
      <div className="in-body">{current?.items}</div>
      {footer.length ? <div className="in-footer">{footer}</div> : null}
    </div>
  );
};

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
        Xoá phụ đề cũ trùng đoạn được phiên âm (mọi hàng)
      </label>
      <small className="in-hint">Phụ đề tạo ra nằm ở một hàng phụ đề mới (Phụ đề 2, 3…) — kéo lên/xuống trên timeline để đổi hàng.</small>
    </>
  );
  const audio = media.filter((m) => m.kind === "audio");
  const voiceCount = props.captions.filter((c) => c.audio).length;

  const musicSection = (
    <section className="in-sec" data-tab="Nhạc nền">
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
      <Panel key="text" icon="T" title={`Văn bản ${i + 1}`} onClose={() => onSelect(null)}>
        <section className="in-sec" data-tab="Nội dung">
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

        <LookPanel
          key="text-style"
          data-tab="Kiểu chữ"
          title="🎨 Kiểu chữ"
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
          <h3>✨ Hiệu ứng</h3>
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
            <button onClick={onSplit}>✂️ Tách</button>
            <button className="danger" onClick={onDelete}>🗑 Xoá</button>
          </div>
        </section>
      </Panel>
    );
  }

  // ---------- phụ đề ----------
  if (selection?.type === "caption") {
    const c = props.captions[selection.index];
    if (!c) return null;
    const i = selection.index;
    return (
      <Panel key="caption" icon="💬" title={`Phụ đề ${i + 1}`} onClose={() => onSelect(null)}>
        <section className="in-sec" data-tab="Nội dung">
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

        <CaptionLookSection key="caption-style" data-tab="Kiểu chữ" props={props} selected={i} onChange={onChange} />

        <section className="in-sec" data-tab="Giọng đọc">
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
      </Panel>
    );
  }

  // ---------- cảnh ----------
  if (selection?.type === "scene") {
    const s = props.scenes[selection.index];
    if (!s) return null;
    const i = selection.index;
    const video = ops.isVideo(s.image);
    return (
      <Panel key="scene" icon={video ? "🎬" : "🖼"} title={`Cảnh ${i + 1}`} onClose={() => onSelect(null)}>
        <section className="in-sec" data-tab="Cơ bản">
          <h3>🎞 Cảnh {i + 1}</h3>
          <div className="in-media">
            {s.image ? (
              video ? <video src={`/public/${s.image}`} muted playsInline preload="metadata" /> : <img src={`/public/${s.image}`} alt="" />
            ) : (
              <span>Chưa có ảnh — kéo một ảnh/video từ thư viện thả vào cảnh này trên timeline.</span>
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
          <section className="in-sec" data-tab="Âm thanh & tốc độ">
            <h3>✂️ Clip video</h3>
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
                🎵 Tách âm thanh ra track riêng
              </button>
            </div>
          </section>
        ) : null}

        {s.image ? (
          <section className="in-sec" data-tab="Cơ bản">
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
          <section className="in-sec" data-tab="Phụ đề AI">
            <h3>📝 Phụ đề tự động</h3>
            {subtitleSettings}
            <div className="in-actions">
              <button onClick={() => onAutoSubtitles(subtitleOptions("scene", i))}>📝 Tạo phụ đề từ tiếng của cảnh này</button>
            </div>
          </section>
        ) : null}

        <section className="in-sec" data-tab="Chữ trên cảnh">
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

        <section className="in-sec in-foot">
          <div className="in-actions">
            <button onClick={onSplit}>✂️ Tách tại đầu phát</button>
            <button className="danger" onClick={onDelete} disabled={props.scenes.length <= 1}>🗑 Xoá cảnh</button>
          </div>
        </section>
      </Panel>
    );
  }

  // ---------- âm thanh thêm tay ----------
  if (selection?.type === "clip") {
    const c = props.audioClips[selection.index];
    if (!c) return null;
    const i = selection.index;
    return (
      <Panel key="clip" icon="🔊" title={c.label ?? "Âm thanh"} onClose={() => onSelect(null)}>
        <section className="in-sec" data-tab="Cơ bản">
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
          <SpeedControl
            speed={ops.clipSpeed(c)}
            lengthMs={c.durationMs}
            onChange={(v, key) => onChange(ops.setClipSpeed(props, i, v), key ? `clip-speed-${i}` : undefined)}
          />
          <div className="in-actions">
            <button onClick={onSplit}>✂️ Tách tại đầu phát</button>
            <button className="danger" onClick={onDelete}>🗑 Xoá âm thanh</button>
          </div>
        </section>
        <section className="in-sec" data-tab="Phụ đề AI">
          <h3>📝 Phụ đề tự động</h3>
          {subtitleSettings}
          <div className="in-actions">
            <button onClick={() => onAutoSubtitles(subtitleOptions("clip", i))}>📝 Tạo phụ đề từ đoạn âm thanh này</button>
          </div>
        </section>
      </Panel>
    );
  }

  if (selection?.type === "music") {
    return (
      <Panel key="music" icon="♪" title="Nhạc nền" onClose={() => onSelect(null)}>
        {musicSection}
        {props.music ? (
          <section className="in-sec in-foot"><div className="in-actions"><button className="danger" onClick={onDelete}>🗑 Bỏ nhạc</button></div></section>
        ) : null}
      </Panel>
    );
  }

  // ---------- không chọn gì: cài đặt chung ----------
  return (
    <Panel key="project" icon="🎬" title="Dự án">
      <p className="in-tip" data-tab="Dự án">
        👆 Bấm một khối trên timeline để sửa riêng khối đó. Kéo ảnh, video, nhạc từ thư viện thả xuống timeline.
      </p>
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

      <section className="in-sec" data-tab="Giọng đọc">
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

      <section className="in-sec" data-tab="Phụ đề AI">
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
    </Panel>
  );
};
