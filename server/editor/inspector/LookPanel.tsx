import { ArrowLeftToLine, ArrowRightToLine, MoveHorizontal } from "lucide-react";
import { useState } from "react";
import { CAPTION_PRESETS, type CaptionLook } from "../../../src/compositions/Short/schema";
import { CAPTION_PRESET_LABELS, CAPTION_TEMPLATES } from "../../../src/components/captionLook";
import { captionTextStyle } from "../../../src/components/CustomCaptions";
import { FontPicker } from "../FontPicker";
import { Field, Slider } from "./controls";
import { hexOr } from "./helpers";

export type LookScope = "all" | "selected" | "checked";

/**
 * Bảng chỉnh kiểu chữ kiểu CapCut, dùng chung cho phụ đề và văn bản tự do: phạm vi áp dụng (tất cả / mục đang
 * chọn / các mục tích chọn), mẫu nhanh, kiểu chữ, font, màu, cỡ chữ, căn chữ, khung bọc chữ, vị trí.
 * Chọn mục khác trên timeline vẫn giữ phạm vi và dấu tích.
 */
export const LookPanel: React.FC<{
  title: React.ReactNode;
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
          <FontPicker value={look.font} onChange={(font) => set({ font })} />
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
          {([
            ["left", <><ArrowLeftToLine size={16} aria-hidden /> Trái</>],
            ["center", <><MoveHorizontal size={16} aria-hidden /> Giữa</>],
            ["right", <>Phải <ArrowRightToLine size={16} aria-hidden /></>],
          ] as const).map(([value, label]) => (
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
