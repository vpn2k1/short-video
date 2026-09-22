import { useState } from "react";
import type { ShortProps } from "../../../src/compositions/Short/schema";
import { mediaDurationMs, uploadFile, type MediaItem } from "../api";
import * as ops from "../ops";
import { refreshMedia } from "../query";
import type { DropTarget } from "../Timeline";

type MediaActionsDeps = {
  media: MediaItem[];
  selectionRef: React.RefObject<ops.Selection>;
  withProps: (fn: (current: ShortProps) => ops.Result) => void;
  flash: (message: string) => void;
  nowMs: () => number;
};

/** Đưa ảnh/video/âm thanh vào dự án: từ thư viện, kéo thả xuống timeline, tải file từ máy. */
export const useMediaActions = ({ media, selectionRef, withProps, flash, nowMs }: MediaActionsDeps) => {
  const [uploading, setUploading] = useState(false);

  /** Độ dài một mục thư viện trên timeline: video lấy đúng độ dài file, ảnh mặc định 3 giây. */
  const itemDurationMs = (item: MediaItem) =>
    item.kind === "video" ? mediaDurationMs(`/public/${item.path}`, "video") : Promise.resolve(3000);

  /**
   * Thêm một ảnh/video thành MỘT VIDEO trên timeline. Mọi video thêm vào đều như nhau: phủ kín khung,
   * không cắt hình, đặt tự do trên timeline và thu nhỏ/đè lên nhau được.
   * track bỏ trống = tự chọn hàng còn trống.
   */
  const addOverlay = async (item: MediaItem, atMs: number, track?: number) => {
    if (item.kind === "audio") return;
    const duration = await itemDurationMs(item);
    withProps((p) => ops.addOverlay(p, item.path, atMs, duration, track));
  };

  /** Thay ảnh/video của khối `index` trên timeline, giữ nguyên chỗ (xem ops.replaceOverlayMedia). */
  const replaceOverlay = async (index: number, item: MediaItem) => {
    if (item.kind === "audio") {
      flash("Khối video chỉ thay được bằng ảnh hoặc video.");
      return;
    }
    const duration = item.kind === "video" ? await mediaDurationMs(`/public/${item.path}`, "video") : undefined;
    withProps((p) => ops.replaceOverlayMedia(p, index, item.path, duration));
  };

  /** Chọn file từ máy để thay khối `index`: tải lên thư viện rồi thay luôn. */
  const replaceOverlayFromFile = async (index: number, file: File) => {
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
    if (!kind) {
      flash("Chỉ thay được bằng ảnh hoặc video.");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadFile(file);
      refreshMedia();
      await replaceOverlay(index, { path, name: file.name, kind, bytes: file.size, at: Date.now() });
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** Nối vào cuối hàng Video 1 — dựng tuần tự clip này rồi clip kia. */
  const appendOverlay = async (item: MediaItem) => {
    if (item.kind === "audio") return;
    const duration = await itemDurationMs(item);
    withProps((p) => ops.appendOverlay(p, item.path, duration));
  };

  const onUseMedia = async (item: MediaItem) => {
    if (item.kind === "audio") {
      const duration = await mediaDurationMs(`/public/${item.path}`, "audio");
      withProps((p) => ({
        ...ops.addClip(p, item.path, nowMs(), duration, item.name.replace(/\.\w+$/, "")),
        message: `Đã thêm “${item.name}” tại ${(nowMs() / 1000).toFixed(1)}s.`,
      }));
      return;
    }
    const sel = selectionRef.current;
    // Đang chọn một video/cảnh thì bấm ảnh là THAY hình của mục đó; không chọn gì thì thêm video mới.
    if (sel?.type === "overlay") {
      await replaceOverlay(sel.index, item);
      return;
    }
    if (sel?.type === "scene") {
      const index = sel.index;
      withProps((p) => ({
        props: ops.setSceneMedia(p, index, item.path),
        selection: { type: "scene", index },
        message: `Đã gán ${item.kind === "video" ? "video" : "ảnh"} cho cảnh ${index + 1}.`,
      }));
      return;
    }
    await addOverlay(item, nowMs());
  };

  /** Gán ảnh/video cho một cảnh từ bảng thuộc tính — cảnh trống hay đổi hình đều đi đường này. */
  const sceneMedia = (index: number, item: MediaItem) => {
    if (item.kind === "audio") {
      flash("Cảnh chỉ nhận ảnh hoặc video.");
      return;
    }
    withProps((p) => ({
      props: ops.setSceneMedia(p, index, item.path),
      selection: { type: "scene", index },
      message: `Đã gán ${item.kind === "video" ? "video" : "ảnh"} cho cảnh ${index + 1}.`,
    }));
  };

  /** Chọn file từ máy cho một cảnh: tải lên thư viện rồi gán luôn. */
  const sceneMediaFromFile = async (index: number, file: File) => {
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
    if (!kind) {
      flash("Cảnh chỉ nhận ảnh hoặc video.");
      return;
    }
    setUploading(true);
    try {
      const { path } = await uploadFile(file);
      refreshMedia();
      sceneMedia(index, { path, name: file.name, kind, bytes: file.size, at: Date.now() });
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** Kéo file từ thư viện thả xuống timeline — giống CapCut. */
  const onDropMedia = async (path: string, atMs: number, target: DropTarget) => {
    const item = media.find((m) => m.path === path);
    if (!item) return;
    if (item.kind === "audio") {
      const duration = await mediaDurationMs(`/public/${item.path}`, "audio");
      withProps((p) => ({
        ...ops.addClip(p, item.path, atMs, duration, item.name.replace(/\.\w+$/, "")),
        message: `Đã thêm “${item.name}” tại ${(atMs / 1000).toFixed(1)}s.`,
      }));
      return;
    }
    if (target.kind === "overlay") {
      await addOverlay(item, atMs, target.track);
      return;
    }
    if (target.kind === "replace") {
      await replaceOverlay(target.index, item);
      return;
    }
    if (target.kind === "end") {
      await appendOverlay(item);
      return;
    }
    withProps((p) => ({
      props: ops.setSceneMedia(p, target.index, item.path),
      selection: { type: "scene", index: target.index },
      message: `Đã thay hình cảnh ${target.index + 1}.`,
    }));
  };

  const onUpload = async (files: File[]) => {
    const accepted = files.filter((f) => /^(image|video|audio)\//.test(f.type));
    if (accepted.length === 0) {
      flash("Chỉ nhận ảnh, video hoặc âm thanh.");
      return;
    }
    setUploading(true);
    try {
      for (const file of accepted) await uploadFile(file);
      flash(`Đã tải lên ${accepted.length} file.`);
      refreshMedia();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading, addOverlay, replaceOverlay, replaceOverlayFromFile, appendOverlay,
    onUseMedia, sceneMedia, sceneMediaFromFile, onDropMedia, onUpload,
  };
};
