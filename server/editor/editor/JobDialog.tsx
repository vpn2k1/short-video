import type { JobState } from "./constants";

/** Hộp tiến độ / lỗi của việc đang chạy trên server (useJobs) — chặn màn hình tới khi xong. */
export const JobDialog: React.FC<{ job: Exclude<JobState, { status: "idle" }>; onClose: () => void }> = ({ job, onClose }) => (
  <div className="ed-modal" role="dialog" aria-modal="true">
    <div className="ed-card">
      {job.status === "running" ? (
        <>
          <h3>{job.title}</h3>
          <div className={`ed-progress ${job.percent === null ? "busy" : ""}`}>
            <div style={{ width: job.percent === null ? "35%" : `${job.percent}%` }} />
          </div>
          <p className="muted">{job.line}</p>
        </>
      ) : (
        <>
          <h3>{job.title}</h3>
          <p className="err">{job.message}</p>
          <div className="ed-actions">
            <button className="ed-btn" onClick={onClose}>Đóng</button>
          </div>
        </>
      )}
    </div>
  </div>
);
