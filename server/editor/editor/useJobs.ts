import { useRef, useState } from "react";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { fmt, followJob, postJson, type SubtitleOptions } from "../api";
import * as ops from "../ops";
import { refreshMedia } from "../query";
import { FREEZE_MS, type JobState } from "./constants";

type JobsDeps = {
  slug: string;
  versionQuery: React.RefObject<string>;
  propsRef: React.RefObject<ShortProps | null>;
  selectionRef: React.RefObject<ops.Selection>;
  saveNow: (next: ShortProps) => Promise<void>;
  cancelSave: () => void;
  commit: (next: ShortProps, base: ShortProps, nextSelection: ops.Selection, mergeKey?: string) => void;
  withProps: (fn: (current: ShortProps) => ops.Result) => void;
  flash: (message: string) => void;
  nowMs: () => number;
  setVideoVoice: (voice: string) => void;
};

/**
 * Việc chạy trên server có hộp tiến độ chặn màn hình (phụ đề tự động, tách âm thanh, cắt ảnh, đổi giọng) —
 * chúng sửa thẳng dữ liệu đang chỉnh nên không cho sửa song song. Xuất video tách riêng (useExport).
 */
export const useJobs = ({
  slug, versionQuery, propsRef, selectionRef, saveNow, cancelSave, commit, withProps, flash, nowMs, setVideoVoice,
}: JobsDeps) => {
  const [job, setJob] = useState<JobState>({ status: "idle" });
  const jobRef = useRef(job);
  jobRef.current = job;

  /** Phụ đề tự động bằng whisper.cpp trên server. */
  const autoSubtitles = async (options: SubtitleOptions) => {
    const current = propsRef.current;
    if (!current) return;
    const title = "Đang tạo phụ đề từ âm thanh";
    setJob({ status: "running", title, percent: null, line: "Đang lưu thay đổi…" });
    try {
      cancelSave();
      await saveNow(current);
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/subtitles${versionQuery.current}`, options);
      setJob({ status: "running", title, percent: null, line: "Đang chuẩn bị phiên âm… (lần đầu có thể lâu hơn)" });
      followJob(
        jobId,
        (line) => {
          if (!line.startsWith("__")) setJob((s) => (s.status === "running" ? { ...s, line } : s));
        },
        (status, result, error) => {
          if (status === "done") {
            const { props: next, count, track, originalTrack, translatedTo } = result as {
              props: ShortProps; count: number; track?: number; originalTrack?: number; translatedTo?: string;
            };
            commit(next, current, null);
            setJob({ status: "idle" });
            flash(count === 0
              ? "Không nhận ra lời nói nào trong đoạn đã chọn."
              : translatedTo
                ? `Đã tạo ${count} câu dịch sang ${translatedTo} ở hàng Phụ đề ${(track ?? 0) + 1}` +
                  `${originalTrack !== undefined ? `, bản gốc ở hàng Phụ đề ${originalTrack + 1}` : ""} — soát lại câu dịch trong mục Phụ đề.`
                : `Đã tạo ${count} câu ở hàng Phụ đề ${(track ?? 0) + 1} — sửa chữ trong mục Phụ đề nếu nghe nhầm.`);
          } else {
            setJob({ status: "error", title: "Không tạo được phụ đề", message: error ?? "Lỗi không rõ." });
          }
        },
      );
    } catch (e) {
      setJob({ status: "error", title: "Không tạo được phụ đề", message: (e as Error).message });
    }
  };

  /** Tách âm thanh video bằng ffmpeg trên server. sceneIndex có → gắn ngay thành track của cảnh đó. */
  const extractAudio = async (src: string, sceneIndex?: number) => {
    setJob({ status: "running", title: "Đang tách âm thanh", percent: null, line: src.split("/").pop() ?? src });
    try {
      cancelSave();
      const current = propsRef.current;
      if (current) await saveNow(current);
      const result = await postJson<{ path: string; durationMs: number }>("/api/media/extract-audio", { src });
      refreshMedia();
      setJob({ status: "idle" });
      if (sceneIndex === undefined) {
        flash("Đã tách âm thanh — xem ở Âm thanh › Đã tải lên.");
      } else {
        withProps((p) => ops.detachAudio(p, sceneIndex, result.path, result.durationMs));
      }
    } catch (e) {
      setJob({ status: "error", title: "Không tách được âm thanh", message: (e as Error).message });
    }
  };

  /**
   * Cắt ảnh tại đầu phát: lấy đúng khung hình đang xem của cảnh (hoặc lớp) video, lưu vào thư viện
   * rồi chèn thành cảnh ảnh mới ngay sau cảnh đó — kiểu "đóng băng khung hình" của CapCut.
   */
  const freezeFrame = async () => {
    const current = propsRef.current;
    if (!current) return;
    const now = nowMs();
    const sel = selectionRef.current;

    // Đang chọn một video thì cắt khung của video đó; không chọn gì thì lấy video đang thấy dưới đầu phát
    // (hàng cao nhất), còn không có nữa mới xét cảnh.
    const picked = sel?.type === "overlay" ? ops.overlaysOf(current)[sel.index] : undefined;
    const overlay = picked && ops.isVideo(picked.src) && now >= picked.startMs && now < picked.endMs
      ? picked
      : ops.overlaysOf(current)[ops.overlayIndexAt(current, now, true)];
    const fromOverlay = Boolean(overlay);
    const sceneIndex = ops.sceneIndexAt(current, now);
    const scene = current.scenes[sceneIndex];
    const src = fromOverlay ? overlay!.src : scene?.image;
    if (!src || !ops.isVideo(src)) {
      flash("Đầu phát không nằm trên video nào — dời đầu phát vào một video rồi bấm lại.");
      return;
    }

    // Mốc trong file gốc: cộng phần đã cắt đầu và nhân tốc độ phát.
    const base = fromOverlay ? overlay! : scene;
    const sourceMs = base.trimStartMs + (now - base.startMs) * ops.clipSpeed(base);
    setJob({ status: "running", title: "Đang cắt ảnh từ video", percent: null, line: src.split("/").pop() ?? src });
    try {
      const { path: file } = await postJson<{ path: string }>("/api/media/capture-frame", { src, atMs: Math.round(sourceMs) });
      refreshMedia();
      setJob({ status: "idle" });
      withProps((p) => {
        // Cắt từ một video trên timeline (hoặc dự án không dùng hàng Cảnh): ảnh thành một video mới
        // ngay tại đầu phát, để mọi thứ trên timeline vẫn cùng một loại. Cắt từ cảnh thì chèn thành cảnh.
        if (fromOverlay || !ops.hasSceneMedia(p)) {
          const added = ops.addOverlay(p, file, now, FREEZE_MS);
          return { ...added, message: `Đã cắt ảnh ở ${fmt(now)} — thêm vào thư viện và đặt thành một video tại đầu phát.` };
        }
        return {
          ...ops.insertSceneAfter(p, sceneIndex, file, FREEZE_MS),
          message: `Đã cắt ảnh ở ${fmt(now)} — thêm vào thư viện và chèn thành cảnh ${sceneIndex + 2}.`,
        };
      });
    } catch (e) {
      setJob({ status: "error", title: "Không cắt được ảnh", message: (e as Error).message });
    }
  };

  /** Tách âm thanh của cảnh video ra track riêng — dùng chung cho timeline, bảng thuộc tính, thư viện. */
  const detachSceneAudio = (index: number) => {
    const src = propsRef.current?.scenes[index]?.image;
    if (src) extractAudio(src, index);
  };

  /** Giọng đọc: đổi toàn bộ (index bỏ trống) hoặc đọc lại một câu. Chạy trên server. */
  const changeVoice = async (voice: string, index?: number) => {
    const current = propsRef.current;
    if (!current) return;
    const title = index === undefined ? `Đang đọc lại mọi câu bằng giọng ${voice}` : `Đang đọc lại câu ${index + 1}`;
    setJob({ status: "running", title, percent: null, line: "Đang lưu thay đổi…" });
    try {
      cancelSave();
      await saveNow(current);
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/voice${versionQuery.current}`, { voice, index });
      setJob({ status: "running", title, percent: null, line: "Đang tạo giọng đọc…" });
      followJob(
        jobId,
        (line) => {
          if (!line.startsWith("__")) setJob((s) => (s.status === "running" ? { ...s, line } : s));
        },
        (status, result, error) => {
          if (status === "done") {
            const next = (result as { props: ShortProps }).props;
            commit(next, current, selectionRef.current);
            setJob({ status: "idle" });
            if (index === undefined) setVideoVoice(voice);
            flash(index === undefined ? `Đã đổi sang giọng ${voice}.` : `Đã đọc lại câu ${index + 1}.`);
          } else {
            setJob({ status: "error", title: "Không tạo được giọng đọc", message: error ?? "Lỗi không rõ." });
          }
        },
      );
    } catch (e) {
      setJob({ status: "error", title: "Không tạo được giọng đọc", message: (e as Error).message });
    }
  };

  return { job, setJob, jobRef, autoSubtitles, extractAudio, freezeFrame, detachSceneAudio, changeVoice };
};
