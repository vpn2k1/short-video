import type { TextOverlay } from "../../../src/compositions/Short/schema";
import type { StockKind } from "../query";
import { MEDIA_DRAG_TYPE } from "../Timeline";

/** Kéo một file từ thư viện — timeline nhận kiểu dữ liệu riêng, không nhầm với kéo file từ máy. */
export const dragMedia = (path: string) => (e: React.DragEvent) => {
  e.dataTransfer.setData(MEDIA_DRAG_TYPE, path);
  e.dataTransfer.effectAllowed = "copy";
};

/** Tải một file mẫu về máy để người dùng sửa nội dung rồi nhập lại. */
export const downloadSample = (name: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const TEXT_PRESETS: { label: string; preview: React.CSSProperties; patch: Partial<TextOverlay> }[] = [
  { label: "Tiêu đề lớn", preview: { fontSize: 22, fontWeight: 900 }, patch: { text: "Tiêu đề lớn", size: 120, weight: 900, y: 18 } },
  { label: "Chữ giữa màn hình", preview: { fontSize: 17, fontWeight: 800 }, patch: { text: "Chữ giữa màn hình", size: 80, weight: 800, y: 50 } },
  { label: "Nhãn có nền", preview: { fontSize: 14, fontWeight: 800, background: "#ff6b2c", color: "#1a0d00", padding: "2px 8px", borderRadius: 4 }, patch: { text: "NHÃN", size: 60, weight: 800, background: "#ff6b2c", color: "#1a0d00", shadow: false, x: 25, y: 14 } },
  { label: "Hai dòng", preview: { fontSize: 14, fontWeight: 700, whiteSpace: "pre-line" }, patch: { text: "Dòng thứ nhất\nDòng thứ hai", size: 72, weight: 700, y: 50 } },
  { label: "Chữ gõ từng ký tự", preview: { fontSize: 14, fontWeight: 600, fontFamily: "ui-monospace, Menlo, monospace" }, patch: { text: "Đang gõ chữ…", size: 64, weight: 600, animation: "typewriter", y: 50 } },
  { label: "Chú thích nhỏ", preview: { fontSize: 12, fontWeight: 500, opacity: 0.85 }, patch: { text: "Chú thích nhỏ", size: 40, weight: 500, y: 90, animation: "fade" } },
];

export const AUDIO_GROUPS: { key: string; title: string }[] = [
  { key: "music", title: "Nhạc nền" },
  { key: "sfx", title: "Hiệu ứng âm thanh" },
  { key: "uploads", title: "Đã tải lên" },
];

export const STOCK_KINDS: { id: StockKind; label: string }[] = [
  { id: "video", label: "Video" },
  { id: "image", label: "Ảnh" },
  { id: "music", label: "Nhạc" },
  { id: "sfx", label: "Hiệu ứng" },
];

export const stockOrientation = (aspect: string) => {
  const [w, h] = aspect.split(":").map(Number);
  return !w || !h ? "any" : w === h ? "square" : w < h ? "portrait" : "landscape";
};
