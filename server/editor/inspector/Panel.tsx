import { X } from "lucide-react";
import { Children, isValidElement, useState } from "react";

type TabChild = React.ReactElement<{ "data-tab"?: string; className?: string }>;

/**
 * Khung bảng thuộc tính kiểu CapCut: tiêu đề mục đang chọn, hàng tab, nội dung tab, nút thao tác dính đáy.
 * Con có `data-tab` mở một tab mới (trùng tên thì gộp vào tab đó); con không có thì thuộc tab ngay trước;
 * con có class `in-foot` nằm ở đáy, luôn thấy.
 */
export const Panel: React.FC<{ icon: React.ReactNode; title: string; onClose?: () => void; children: React.ReactNode }> = ({
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
        {onClose ? <button className="in-close" onClick={onClose} title="Bỏ chọn (Esc)" aria-label="Bỏ chọn"><X size={16} aria-hidden /></button> : null}
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
