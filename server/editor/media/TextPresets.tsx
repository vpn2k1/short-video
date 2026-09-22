import type { TextOverlay } from "../../../src/compositions/Short/schema";
import { TEXT_PRESETS } from "./helpers";

/** Mục Văn bản: nút thêm chữ trống và các mẫu chữ có sẵn. */
export const TextPresets: React.FC<{
  onAddText: (preset: Partial<TextOverlay>, label: string) => void;
}> = ({ onAddText }) => (
  <div className="md-list">
    <button className="md-import row" onClick={() => onAddText({}, "Văn bản")}>
      <b>＋</b>
      <span>Thêm văn bản</span>
    </button>
    <p className="md-hint">Hoặc bấm một mẫu bên dưới. Thêm xong kéo chữ trên khung xem để đặt vị trí.</p>
    <div className="tx-presets">
      {TEXT_PRESETS.map((preset) => (
        <button key={preset.label} className="tx-preset" onClick={() => onAddText(preset.patch, preset.label)}>
          <span style={preset.preview}>{preset.patch.text}</span>
          <small>{preset.label}</small>
        </button>
      ))}
    </div>
  </div>
);
