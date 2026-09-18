import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FONTS } from "../../src/styles/shared";
import { fontGroups, fontInfo, type FontId } from "../../src/fonts/catalog";

/**
 * Chỗ đặt danh sách: position fixed theo nút bấm để không bị khung cuộn (bảng thuộc tính) cắt mất;
 * phía dưới không đủ chỗ thì lật lên trên. Trang phụ đề (subs.js) dùng cùng cách tính.
 */
export const fontListPlacement = (button: DOMRect): React.CSSProperties => {
  const gap = 4;
  const below = window.innerHeight - button.bottom - gap - 8;
  const above = button.top - gap - 8;
  const up = below < 260 && above > below;
  const maxHeight = Math.min(420, up ? above : below);
  return {
    position: "fixed",
    left: Math.min(button.left, window.innerWidth - Math.max(240, button.width) - 8),
    width: Math.max(240, button.width),
    maxHeight,
    ...(up ? { bottom: window.innerHeight - button.top + gap, top: "auto" } : { top: button.bottom + gap }),
  };
};

type Props = {
  value: FontId;
  onChange: (font: FontId) => void;
  /** Chữ mẫu hiện bên cạnh tên font — mặc định có dấu để thấy font có đủ dấu tiếng Việt không. */
  sample?: string;
};

/**
 * Ô chọn font: mỗi dòng viết bằng chính font đó, chia theo nhóm (có sẵn trên máy / không chân / tròn / …).
 * <select> gốc không vẽ được font riêng cho từng dòng trên macOS nên phải tự làm.
 * Font đóng gói hiện được là nhờ public/fonts/fonts.css (link trong editor.html) — chỉ tải font nào đang hiện.
 */
export const FontPicker: React.FC<Props> = ({ value, onChange, sample = "Ảnh đẹp" }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Vị trí danh sách đang mở; null = đóng. */
  const [place, setPlace] = useState<React.CSSProperties | null>(null);
  const open = place !== null;
  const setOpen = (show: boolean) => {
    const button = rootRef.current?.querySelector(".fp-btn");
    setPlace(show && button ? fontListPlacement(button.getBoundingClientRect()) : null);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    // Danh sách đứng yên theo màn hình: cuộn khung bên ngoài hay đổi cỡ cửa sổ thì đóng lại.
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) setPlace(null);
    };
    const onResize = () => setPlace(null);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    // Mở ra là thấy ngay font đang dùng.
    listRef.current?.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const current = fontInfo(value);
  return (
    <div className="fp" ref={rootRef}>
      <button type="button" className="fp-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span style={{ fontFamily: FONTS[value] }}>{current.label}</span>
        <i aria-hidden><ChevronDown size={14} aria-hidden /></i>
      </button>
      {open ? (
        <div className="fp-list" role="listbox" ref={listRef} style={place ?? undefined}>
          {fontGroups().map(([group, ids]) => (
            <div key={group} role="group" aria-label={group}>
              <h5>{group}</h5>
              {ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={id === value}
                  className={id === value ? "on" : ""}
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                >
                  <span style={{ fontFamily: FONTS[id] }}>{fontInfo(id).label}</span>
                  <small style={{ fontFamily: FONTS[id] }}>{sample}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
