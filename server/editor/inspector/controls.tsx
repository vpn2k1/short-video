import { useState } from "react";
import { Controller, type Control } from "react-hook-form";
import type { VoiceOption } from "../api";
import * as ops from "../ops";
import { VoicePreviewButton } from "../VoicePreview";

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="in-field">
    <span className="in-label">{label}</span>
    {children}
    {hint ? <small className="in-hint">{hint}</small> : null}
  </label>
);

/** Ô nhập giây (hiển thị) ↔ ms (dữ liệu). */
export const Seconds: React.FC<{ value: number; onChange: (ms: number) => void; min?: number }> = ({ value, onChange, min = 0 }) => (
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

export const Slider: React.FC<{ value: number; min?: number; max: number; step?: number; format?: (v: number) => string; onChange: (v: number) => void }> = ({
  value, min = 0, max, step = 0.05, format = (v) => `${Math.round(v * 100)}%`, onChange,
}) => (
  <div className="in-range">
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    <b>{format(value)}</b>
  </div>
);

/** Ô chọn giọng + nút ▶ nghe thử giọng đang chọn (VoicePreview.tsx). */
export const VoiceSelect: React.FC<{ voices: VoiceOption[]; value: string; onChange: (key: string) => void }> = ({ voices, value, onChange }) => {
  const [error, setError] = useState<string | null>(null);
  /** Giọng vừa nghe thử xong lần đầu trong phiên này — danh sách giọng từ server chưa biết. */
  const [sampled, setSampled] = useState<Set<string>>(() => new Set());
  const current = voices.find((v) => v.key === value);
  const costs = current?.online && !current.sampled && !sampled.has(value) ? current.engineLabel : null;
  return (
    <>
      <div className="voice-pick">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {(["vi", "en"] as const).map((lang) => (
            <optgroup key={lang} label={lang === "vi" ? "Tiếng Việt" : "Tiếng Anh"}>
              {voices.filter((v) => v.lang === lang).map((v) => (
                <option key={v.key} value={v.key} disabled={v.paidPlan || v.usable === false}>
                  {v.key} — {v.label.split("—")[1]?.trim()} · {v.engineLabel}
                  {v.paidPlan ? " (trả phí)" : v.usable === false ? " (máy này không có)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <VoicePreviewButton voice={value} costs={costs} onError={setError}
          onSampled={() => setSampled((s) => (s.has(value) ? s : new Set(s).add(value)))} />
      </div>
      {error ? <p className="voice-err">{error}</p> : null}
    </>
  );
};

/** Form giọng đọc — Inspector giữ để bảng phụ đề và tab Giọng đọc của dự án dùng chung một lựa chọn. */
export type VoiceFields = { voice: string };

/** VoiceSelect gắn vào ô `voice` của form giọng đọc. */
export const VoiceField: React.FC<{ control: Control<VoiceFields>; voices: VoiceOption[] }> = ({ control, voices }) => (
  <Controller
    control={control}
    name="voice"
    render={({ field }) => <VoiceSelect voices={voices} value={field.value} onChange={field.onChange} />}
  />
);

const SPEED_PRESETS = [0.5, 1, 1.5, 2, 3];
const formatSpeed = (v: number) => `${Number(v.toFixed(2))}x`;

/**
 * Tốc độ phát kiểu CapCut: nút nhanh + thanh kéo 0.25–4x. Không bọc trong <label> (Field) — bấm vào chữ nhãn
 * sẽ kích hoạt nút đầu tiên bên trong.
 */
export const SpeedControl: React.FC<{ speed: number; lengthMs: number; onChange: (speed: number, mergeKey?: string) => void }> = ({
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
