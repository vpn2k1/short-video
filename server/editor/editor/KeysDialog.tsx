import { Keyboard, X } from "lucide-react";
import { MOD } from "./constants";

/** Bảng phím tắt — hiện trong hộp Phím tắt (phím ? hoặc ⌘/), menu Trợ giúp của app desktop mở cùng hộp này. */
const SHORTCUTS: [string, [string[], string][]][] = [
  ["Phát", [
    [["Space"], "Phát / dừng"],
    [["K"], "Phát / dừng"],
    [["J"], "Lùi 5 giây"],
    [["L"], "Tới 5 giây"],
    [["←", "→"], "Lùi / tới 1 khung hình"],
    [["Shift", "← →"], "Lùi / tới 1 giây"],
    [["↑", "↓"], "Về đầu video trước / video sau"],
    [["Home", "End"], "Về đầu / cuối video"],
    [["F"], "Xem toàn màn hình"],
  ]],
  ["Khung xem trước", [
    [[MOD, "="], "Phóng to khung xem trước"],
    [[MOD, "−"], "Thu nhỏ khung xem trước"],
    [[MOD, "0"], "Vừa khung"],
    [[MOD, "lăn chuột"], "Phóng to / thu nhỏ tại con trỏ (chụm 2 ngón trên trackpad)"],
    [["Chuột giữa", "kéo"], "Di chuyển khi đang phóng to — hoặc kéo trên nền tối"],
  ]],
  ["Chỉnh sửa", [
    [["S"], "Tách tại đầu phát"],
    [[MOD, "B"], "Tách tại đầu phát"],
    [["Q"], "Cắt trái — xoá từ đầu tới đầu phát"],
    [["W"], "Cắt phải — xoá từ đầu phát tới hết"],
    [["Delete"], "Xoá mục đang chọn"],
    [["T"], "Thêm văn bản"],
    [["C"], "Thêm phụ đề"],
    [["P"], "Cắt ảnh từ video tại đầu phát"],
    [[MOD, "D"], "Nhân đôi văn bản"],
    [[MOD, "C / V"], "Sao chép / dán văn bản"],
    [[MOD, "Z"], "Hoàn tác"],
    [[MOD, "Shift", "Z"], "Làm lại"],
    [["Esc"], "Bỏ chọn"],
  ]],
  ["Timeline & thư viện", [
    [["=", "−"], "Phóng to / thu nhỏ timeline"],
    [["Shift", "Z"], "Vừa khung — thấy cả video"],
    [["Alt", "1…6"], "Ảnh/Video · Âm thanh · Văn bản · Phụ đề · Video AI · Kho free"],
  ]],
  ["Dự án", [
    [[MOD, "S"], "Lưu ngay"],
    [[MOD, "I"], "Nhập ảnh / video / âm thanh"],
    [[MOD, "E"], "Xuất video"],
    [["?"], "Mở bảng phím tắt"],
    [[MOD, "/"], "Mở bảng phím tắt"],
  ]],
];

/** Hộp Phím tắt — bấm nền tối hoặc nút ✕ để đóng. */
export const KeysDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Phím tắt" onClick={onClose}>
    <div className="ed-card ed-keys" onClick={(e) => e.stopPropagation()}>
      <div className="ed-keys-head">
        <h3><Keyboard size={18} aria-hidden /> Phím tắt</h3>
        <button className="ed-icon" onClick={onClose} aria-label="Đóng"><X size={16} aria-hidden /></button>
      </div>
      <div className="ed-keys-grid">
        {SHORTCUTS.map(([group, items]) => (
          <section key={group}>
            <h4>{group}</h4>
            <ul>
              {items.map(([keys, label]) => (
                <li key={`${keys.join("+")}-${label}`}>
                  <span>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
                  {label}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="muted">Phím một chữ cái không chạy khi đang gõ trong ô nhập — bấm Esc để thoát ô nhập.</p>
    </div>
  </div>
);
