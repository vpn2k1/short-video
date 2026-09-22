import { ArrowLeftRight, Check, ChevronLeft, CircleCheck, Keyboard, LoaderCircle, TriangleAlert, Upload } from "lucide-react";
import { MOD, type ExportState, type SaveState, type VersionInfo } from "./constants";

type Props = {
  slug: string;
  title: string;
  versionInfo: VersionInfo | null;
  saveState: SaveState;
  onDiscardDraft: () => void;
  /** Đang chạy việc chặn màn hình (useJobs). */
  jobRunning: boolean;
  showKeys: boolean;
  onToggleKeys: () => void;
  importRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (files: File[]) => void;
  libSide: "left" | "right";
  onToggleLibSide: () => void;
  exp: ExportState;
  expOpen: boolean;
  onExport: () => void;
};

/** Thanh trên cùng: quay lại, tên video + bản đang sửa + trạng thái lưu, phím tắt, đổi bên thư viện, Xuất video. */
export const TopBar: React.FC<Props> = ({
  slug, title, versionInfo, saveState, onDiscardDraft, jobRunning, showKeys, onToggleKeys,
  importRef, onUpload, libSide, onToggleLibSide, exp, expOpen, onExport,
}) => {
  const saveLabel = {
    saved: <><Check size={14} aria-hidden /> Đã lưu</>,
    dirty: "Chưa lưu…",
    saving: "Đang lưu…",
    error: <><TriangleAlert size={14} aria-hidden /> Lỗi lưu</>,
  }[saveState];

  return (
    <header className="ed-top">
      <div className="ed-top-l">
        <a className="ed-btn ghost" href={`/#/v/${slug}`} title="Về trang video"><ChevronLeft size={16} aria-hidden /> Quay lại</a>
      </div>
      <div className="ed-title">
        <b title={title}>{title}</b>
        {versionInfo?.version != null ? (
          <span
            className={`ed-version ${versionInfo.version !== versionInfo.latest ? "old" : ""}`}
            title={versionInfo.version !== versionInfo.latest
              ? `Đang sửa bản ${versionInfo.version} (bản mới nhất là ${versionInfo.latest}). Xuất ra sẽ thành bản mới, bản ${versionInfo.version} giữ nguyên.`
              : "Xuất ra sẽ thành bản mới, bản đang mở giữ nguyên."}
          >
            Bản {versionInfo.version}{versionInfo.version !== versionInfo.latest ? " · bản cũ" : ""}
          </span>
        ) : null}
        <span className={`save ${saveState}`}>{saveLabel}</span>
        {versionInfo?.hasDraft ? (
          <button className="ed-link" onClick={onDiscardDraft} disabled={jobRunning || exp.status === "running"} title="Bỏ mọi thay đổi chưa xuất, quay về đúng bản đã xuất">
            Bỏ thay đổi
          </button>
        ) : null}
      </div>
      <div className="ed-top-r">
        <button className="ed-icon" onClick={onToggleKeys} title={`Phím tắt (? hoặc ${MOD}+/)`} aria-label="Phím tắt" aria-expanded={showKeys}><Keyboard size={16} aria-hidden /></button>
        <input
          ref={importRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,audio/*"
          onChange={(e) => { onUpload([...(e.target.files ?? [])]); e.target.value = ""; }}
        />
        <button className="ed-icon" onClick={onToggleLibSide} title={`Đưa thư viện sang bên ${libSide === "left" ? "phải" : "trái"}`} aria-label={`Đưa thư viện sang bên ${libSide === "left" ? "phải" : "trái"}`}><ArrowLeftRight size={16} aria-hidden /></button>
        <button
          className={`ed-btn primary ed-export ${exp.status !== "idle" && !expOpen ? `bg ${exp.status}` : ""}`}
          onClick={onExport}
          disabled={jobRunning}
          title={exp.status === "running" ? "Đang xuất dưới nền — bấm để xem tiến độ" : `Xuất video (${MOD}+E)`}
        >
          {exp.status === "running" ? (
            <>
              <span className="ed-export-fill" style={{ width: `${exp.percent}%` }} aria-hidden />
              <LoaderCircle size={16} className="spin" aria-hidden /> Đang xuất {exp.percent}%
            </>
          ) : exp.status === "exported" && !expOpen ? (
            <><CircleCheck size={16} aria-hidden /> Xuất xong · Xem</>
          ) : exp.status === "error" && !expOpen ? (
            <><TriangleAlert size={16} aria-hidden /> Xuất lỗi · Xem</>
          ) : (
            <><Upload size={16} aria-hidden /> Xuất video</>
          )}
        </button>
      </div>
    </header>
  );
};
