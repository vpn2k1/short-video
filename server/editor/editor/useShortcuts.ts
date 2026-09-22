import type { PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import type { ShortProps, TextOverlay } from "../../../src/compositions/Short/schema";
import type { LibrarySection } from "../MediaPanel";
import * as ops from "../ops";
import { FPS, LIB_SECTIONS, MOD, type ExportState, type JobState } from "./constants";

type ShortcutDeps = {
  playerRef: React.RefObject<PlayerRef | null>;
  propsRef: React.RefObject<ShortProps | null>;
  selectionRef: React.RefObject<ops.Selection>;
  select: (next: ops.Selection) => void;
  withProps: (fn: (current: ShortProps) => ops.Result) => void;
  nowMs: () => number;
  seek: (ms: number) => void;
  flash: (message: string) => void;
  split: () => void;
  del: () => void;
  undo: () => void;
  redo: () => void;
  addText: () => void;
  freezeFrame: () => void;
  trimHead: () => void;
  trimTail: () => void;
  duplicateText: () => void;
  saveNow: (next: ShortProps) => Promise<void>;
  cancelSave: () => void;
  exportVideo: () => void;
  importRef: React.RefObject<HTMLInputElement | null>;
  setFitRequest: React.Dispatch<React.SetStateAction<number>>;
  setLibRequest: (request: { section: LibrarySection; at: number }) => void;
  stageRef: React.RefObject<{ zoomBy: (factor: number) => void; zoomTo: (zoom: number) => void }>;
  setPxPerSec: React.Dispatch<React.SetStateAction<number>>;
  jobRef: React.RefObject<JobState>;
  expRef: React.RefObject<ExportState>;
  expOpenRef: React.RefObject<boolean>;
  setExpOpen: (open: boolean) => void;
  setExp: (state: ExportState) => void;
  cropRef: React.RefObject<ops.MotionSel | null>;
  setCropTarget: (target: ops.MotionSel | null) => void;
};

/**
 * Phím tắt của trình chỉnh sửa (bảng đầy đủ ở KeysDialog) và hộp Phím tắt.
 * Các thao tác dựng lại mỗi lần vẽ và giữ trong ref — listener gắn một lần vẫn gọi đúng bản mới nhất.
 */
export const useShortcuts = (d: ShortcutDeps) => {
  const [showKeys, setShowKeys] = useState(false);
  /** Văn bản đã sao chép bằng ⌘C — dán lại tại đầu phát, giữ nguyên kiểu chữ. */
  const clipboard = useRef<TextOverlay | null>(null);
  const { playerRef, propsRef, selectionRef, select, withProps, nowMs, seek, flash } = d;

  // ---------- phím tắt ----------
  const buildHandlers = () => ({
    togglePlay: () => playerRef.current?.toggle(),
    split: d.split,
    del: d.del,
    undo: d.undo,
    redo: d.redo,
    addText: d.addText,
    addCaption: () => withProps((p) => ops.addCaption(p, nowMs())),
    freezeFrame: d.freezeFrame,
    trimHead: d.trimHead,
    trimTail: d.trimTail,
    duplicate: () => {
      if (selectionRef.current?.type === "text") d.duplicateText();
      else flash("Chọn một văn bản trên timeline để nhân đôi.");
    },
    /** Trả về true nếu đã xử lý — không thì để ⌘C sao chép chữ bình thường. */
    copy: () => {
      const sel = selectionRef.current;
      const text = sel?.type === "text" ? propsRef.current?.texts[sel.index] : undefined;
      if (!text) return false;
      clipboard.current = { ...text };
      flash(`Đã sao chép văn bản — ${MOD}+V để dán tại đầu phát.`);
      return true;
    },
    paste: () => {
      const copied = clipboard.current;
      if (!copied) return false;
      const look: Partial<TextOverlay> = { ...copied };
      delete look.track;
      delete look.startMs;
      delete look.endMs;
      const at = nowMs();
      withProps((p) => {
        const added = ops.addText(p, at, look);
        const index = added.props.texts.length - 1;
        return {
          props: ops.updateText(added.props, index, { endMs: at + Math.max(ops.MIN_MS, copied.endMs - copied.startMs) }),
          selection: { type: "text", index },
          message: "Đã dán văn bản tại đầu phát.",
        };
      });
      return true;
    },
    escape: () => {
      if (showKeys) setShowKeys(false);
      else select(null);
    },
    toggleKeys: () => setShowKeys((v) => !v),
    save: () => {
      const current = propsRef.current;
      if (!current) return;
      d.cancelSave();
      d.saveNow(current).then(() => flash("Đã lưu."), () => undefined);
    },
    exportVideo: d.exportVideo,
    importFiles: () => d.importRef.current?.click(),
    fullscreen: () => playerRef.current?.requestFullscreen(),
    fit: () => d.setFitRequest((n) => n + 1),
    library: (n: number) => d.setLibRequest({ section: LIB_SECTIONS[n] ?? "visual", at: Date.now() }),
    stageZoom: (factor: number) => d.stageRef.current.zoomBy(factor),
    stageFit: () => d.stageRef.current.zoomTo(1),
    zoom: (factor: number) => d.setPxPerSec((v) => Math.min(320, Math.max(20, Math.round(v * factor)))),
    nudge: (direction: number, big: boolean) => seek(nowMs() + direction * (big ? 1000 : 1000 / FPS)),
    jump: (ms: number) => seek(nowMs() + ms),
    seekTo: (ms: number) => seek(ms),
    /** Nhảy tới mép khối gần nhất phía trước/phía sau đầu phát: đầu/cuối mỗi video (và ranh giới cảnh nếu hàng Cảnh còn hiện). */
    jumpScene: (direction: number) => {
      const p = propsRef.current;
      if (!p) return;
      const now = nowMs();
      const marks = [
        0,
        ...(ops.sceneRowVisible(p) ? p.scenes.map((s) => s.startMs) : []),
        ...ops.overlaysOf(p).flatMap((o) => [o.startMs, o.endMs]),
        ops.videoMeta(p).durationMs,
      ].sort((a, b) => a - b);
      const target = direction > 0 ? marks.find((m) => m > now + 20) : [...marks].reverse().find((m) => m < now - 20);
      if (target !== undefined) seek(target);
    },
    durationMs: () => (propsRef.current ? ops.videoMeta(propsRef.current).durationMs : 0),
  });
  const handlers = useRef<ReturnType<typeof buildHandlers> | null>(null);
  handlers.current = buildHandlers();

  const { jobRef, expRef, expOpenRef, setExpOpen, setExp, cropRef, setCropTarget } = d;

  // Menu Trợ giúp › Phím tắt của app desktop gửi sự kiện này vào trang.
  useEffect(() => {
    const open = () => setShowKeys(true);
    window.addEventListener("app:shortcuts", open);
    return () => window.removeEventListener("app:shortcuts", open);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (jobRef.current.status === "running") return;
      // Hộp xuất đang mở: Esc = đóng (đang chạy thì chạy dưới nền), phím khác không đụng timeline phía sau.
      if (expOpenRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          setExpOpen(false);
          if (expRef.current.status !== "running") setExp({ status: "idle" });
        }
        return;
      }
      // Chế độ crop: chỉ nhận Esc để huỷ, phím khác không được đụng timeline.
      if (cropRef.current !== null) {
        if (e.key === "Escape") setCropTarget(null);
        return;
      }
      const h = handlers.current;
      if (!h || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Lưu, xuất, nhập, bảng phím tắt: dùng được cả khi đang gõ trong ô nhập.
      if (mod && !e.altKey && !e.shiftKey) {
        const global: Record<string, () => void> = { s: h.save, e: h.exportVideo, i: h.importFiles, "/": h.toggleKeys };
        if (global[key]) {
          e.preventDefault();
          global[key]();
          return;
        }
      }

      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) {
        if (e.key === "Escape") el.blur();
        return;
      }

      // Alt+1…6: tab thư viện. e.code vì Option+số trên macOS ra ký tự khác.
      if (e.altKey && !mod) {
        const digit = /^Digit([1-6])$/.exec(e.code);
        if (digit) {
          e.preventDefault();
          h.library(Number(digit[1]) - 1);
        }
        return;
      }

      if (mod) {
        // Thu phóng khung xem trước. e.code: bàn phím không phải US vẫn đúng phím; e.key dự phòng khi không có code.
        if (!e.altKey && (e.code === "Equal" || e.code === "NumpadAdd" || e.key === "=" || e.key === "+")) { e.preventDefault(); h.stageZoom(1.25); }
        else if (!e.altKey && (e.code === "Minus" || e.code === "NumpadSubtract" || e.key === "-" || e.key === "_")) { e.preventDefault(); h.stageZoom(0.8); }
        else if (!e.altKey && (e.code === "Digit0" || e.code === "Numpad0" || e.key === "0")) { e.preventDefault(); h.stageFit(); }
        else if (key === "z") { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); }
        else if (key === "y") { e.preventDefault(); h.redo(); }
        else if (key === "b") { e.preventDefault(); h.split(); }
        else if (key === "d") { e.preventDefault(); h.duplicate(); }
        else if (key === "c" && !e.shiftKey) { if (h.copy()) e.preventDefault(); }
        else if (key === "v" && !e.shiftKey) { if (h.paste()) e.preventDefault(); }
        return;
      }

      const run = (fn: () => void) => { e.preventDefault(); fn(); };
      if (e.code === "Space" || key === "k") run(h.togglePlay);
      else if (e.key === "Escape") h.escape();
      else if (e.key === "?") run(h.toggleKeys);
      else if (e.shiftKey && key === "z") run(h.fit);
      else if (key === "j") run(() => h.jump(-5000));
      else if (key === "l") run(() => h.jump(5000));
      else if (key === "s") run(h.split);
      else if (key === "q") run(h.trimHead);
      else if (key === "w") run(h.trimTail);
      else if (key === "t") run(h.addText);
      else if (key === "c") run(h.addCaption);
      else if (key === "f") run(h.fullscreen);
      else if (key === "p") run(h.freezeFrame);
      else if (e.key === "Delete" || e.key === "Backspace") run(h.del);
      else if (e.key === "=" || e.key === "+") run(() => h.zoom(1.25));
      else if (e.key === "-" || e.key === "_") run(() => h.zoom(0.8));
      else if (e.key === "Home") run(() => h.seekTo(0));
      else if (e.key === "End") run(() => h.seekTo(h.durationMs()));
      else if (e.key === "ArrowUp" || e.key === "Up") run(() => h.jumpScene(-1));
      else if (e.key === "ArrowDown" || e.key === "Down") run(() => h.jumpScene(1));
      // "Left"/"Right" là tên phím ở một số trình duyệt/công cụ tự động cũ.
      else if (["ArrowLeft", "ArrowRight", "Left", "Right"].includes(e.key)) run(() => h.nudge(e.key.endsWith("Left") ? -1 : 1, e.shiftKey));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { showKeys, setShowKeys };
};
