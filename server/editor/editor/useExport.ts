import { useRef, useState } from "react";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { followJob, postJson } from "../api";
import type { ExportState } from "./constants";

type ExportDeps = {
  slug: string;
  versionQuery: React.RefObject<string>;
  propsRef: React.RefObject<ShortProps | null>;
  saveNow: (next: ShortProps) => Promise<void>;
  cancelSave: () => void;
  flash: (message: string) => void;
};

/** Xuất video trên server — chạy được dưới nền trong lúc người dùng sửa tiếp (xem ExportState). */
export const useExport = ({ slug, versionQuery, propsRef, saveNow, cancelSave, flash }: ExportDeps) => {
  const [exp, setExp] = useState<ExportState>({ status: "idle" });
  /** Hộp tiến độ/kết quả xuất đang mở. Đóng lúc đang chạy = chạy dưới nền; nút Xuất video hiện tiến độ. */
  const [expOpen, setExpOpen] = useState(false);
  const expRef = useRef(exp);
  expRef.current = exp;
  const expOpenRef = useRef(expOpen);
  expOpenRef.current = expOpen;
  /** Props lúc bấm xuất — so với lúc xuất xong để biết người dùng đã sửa thêm trong lúc chạy nền chưa. */
  const exportSnapshot = useRef<string | null>(null);

  const exportVideo = async () => {
    const current = propsRef.current;
    if (!current) return;
    // Đang xuất, hoặc đã xong dưới nền mà chưa xem: mở lại hộp, không xuất chồng.
    if (expRef.current.status !== "idle") {
      setExpOpen(true);
      return;
    }
    exportSnapshot.current = JSON.stringify(current);
    setExp({ status: "running", percent: 0, line: "Đang lưu thay đổi…" });
    setExpOpen(true);
    try {
      cancelSave();
      await saveNow(current);
      const { jobId } = await postJson<{ jobId: string }>(`/api/editor/${slug}/render${versionQuery.current}`, {});
      setExp({ status: "running", percent: 0, line: "Đang chuẩn bị dựng…" });
      followJob(
        jobId,
        (line) => {
          if (line.startsWith("__PROGRESS__")) {
            const percent = Number(line.split(" ")[1]);
            setExp({ status: "running", percent, line: `Đang dựng video… ${percent}%` });
          } else if (!line.startsWith("__STEP__")) {
            setExp((s) => (s.status === "running" ? { ...s, line } : s));
          }
        },
        (status, result, error) => {
          const background = !expOpenRef.current;
          if (status === "done") {
            const message = result as { mp4?: string; version?: number } | null;
            const now = propsRef.current ? JSON.stringify(propsRef.current) : exportSnapshot.current;
            setExp({
              status: "exported", mp4: message?.mp4 ?? `/out/${slug}.mp4`, version: message?.version ?? null,
              editedSince: now !== exportSnapshot.current,
            });
            if (background) flash(`Xuất xong${message?.version ? ` bản ${message.version}` : ""} — bấm “Xuất xong · Xem” trên cùng để xem.`);
          } else {
            setExp({ status: "error", message: error ?? "Xuất video thất bại." });
            if (background) flash("Xuất video không thành công — bấm nút trên cùng để xem lỗi.");
          }
        },
      );
    } catch (e) {
      setExp({ status: "error", message: (e as Error).message });
    }
  };

  /** Đóng hộp xuất: đang chạy thì chạy tiếp dưới nền; đã xong/lỗi thì xoá kết quả để lần sau xuất mới. */
  const closeExport = () => {
    setExpOpen(false);
    if (expRef.current.status !== "running") setExp({ status: "idle" });
  };

  return { exp, setExp, expOpen, setExpOpen, expRef, expOpenRef, exportVideo, closeExport };
};
