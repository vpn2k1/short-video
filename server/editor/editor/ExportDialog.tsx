import { CircleCheck, Download, Minimize2 } from "lucide-react";
import type { ExportState } from "./constants";

type Props = {
  slug: string;
  exp: Exclude<ExportState, { status: "idle" }>;
  /** Đóng hộp, xuất chạy tiếp dưới nền. */
  onBackground: () => void;
  /** Đóng hộp và xoá kết quả (useExport.closeExport). */
  onClose: () => void;
};

/** Hộp tiến độ / kết quả xuất video. */
export const ExportDialog: React.FC<Props> = ({ slug, exp, onBackground, onClose }) => (
  <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Xuất video">
    <div className="ed-card">
      {exp.status === "running" ? (
        <>
          <h3>Đang xuất video</h3>
          <div className="ed-progress"><div style={{ width: `${exp.percent}%` }} /></div>
          <p className="muted">{exp.line}</p>
          <p className="muted ed-note">
            Chạy dưới nền để sửa tiếp trong lúc chờ — thay đổi sau lúc bấm xuất không có trong video này.
            Rời trang cũng được: video vẫn xuất xong và hiện trong chat.
          </p>
          <div className="ed-actions">
            <button className="ed-btn primary" onClick={onBackground} autoFocus>
              <Minimize2 size={16} aria-hidden /> Chạy dưới nền
            </button>
          </div>
        </>
      ) : exp.status === "exported" ? (
        <>
          <h3><CircleCheck size={20} aria-hidden /> Xuất xong{exp.version !== null ? ` · bản ${exp.version}` : ""}</h3>
          <video className="ed-result" src={exp.mp4} controls playsInline />
          {exp.editedSince ? (
            <p className="muted ed-note">
              Bạn đã sửa thêm sau lúc bấm xuất — những thay đổi đó chưa có trong video này, vẫn nằm ở bản đang mở.
              Bấm Xuất video lần nữa để có chúng.
            </p>
          ) : null}
          <div className="ed-actions">
            <a className="ed-btn primary" href={exp.mp4.split("?")[0]} download><Download size={18} aria-hidden /> Tải xuống</a>
            <a className="ed-btn" href={`/#/v/${slug}`}>Mở trong chat</a>
            {exp.version !== null && !exp.editedSince ? (
              <a className="ed-btn ghost" href={`/editor.html#${slug}/v${exp.version}`} title="Mở bản vừa xuất để sửa tiếp">Sửa tiếp bản {exp.version}</a>
            ) : (
              <button className="ed-btn ghost" onClick={onClose}>Tiếp tục sửa</button>
            )}
          </div>
        </>
      ) : (
        <>
          <h3>Không xuất được</h3>
          <p className="err">{exp.message}</p>
          <div className="ed-actions">
            <button className="ed-btn" onClick={onClose}>Đóng</button>
          </div>
        </>
      )}
    </div>
  </div>
);
