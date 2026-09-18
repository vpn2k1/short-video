/**
 * Nạp font đóng gói (src/fonts/catalog.ts) cho composition: FontFace + delayRender để Remotion đợi font
 * xong mới chụp khung hình — nạp bằng CSS thì khung đầu có thể ra font dự phòng.
 *
 * Mỗi font chỉ nạp một lần cho cả trang (Player trong trình chỉnh sửa, hoặc mỗi tab lúc render).
 * Lỗi nạp thì vẫn cho render tiếp bằng font dự phòng, không làm hỏng cả video.
 */
import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import type { ShortProps } from "../compositions/Short/schema";
import { fontInfo } from "./catalog";

/** Font đang nạp / đã nạp xong (lỗi cũng tính là xong — vẽ bằng font dự phòng). */
const loading = new Map<string, Promise<void>>();
const loaded = new Set<string>();

const loadFont = (id: string): Promise<void> => {
  const existing = loading.get(id);
  if (existing) return existing;
  const info = fontInfo(id);
  const promise = !info.family || !info.faces?.length
    ? Promise.resolve()
    : Promise.all(info.faces.map(async (face) => {
      const font = new FontFace(info.family!, `url("${staticFile(face.file)}") format("woff2")`, {
        weight: face.weight,
        style: "normal",
        unicodeRange: face.unicodeRange,
      });
      // unicode-range chỉ quyết định file nào được dùng cho ký tự nào; load() tải ngay cả ba bộ (vài chục KB).
      document.fonts.add(await font.load());
    }))
      .then(() => undefined)
      .catch((error) => console.warn(`Không nạp được font ${info.label}:`, error));
  const done = promise.finally(() => loaded.add(id));
  loading.set(id, done);
  return done;
};

export const ensureFonts = (ids: Iterable<string>) => {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  for (const id of ids) {
    if (loading.has(id)) continue;
    const info = fontInfo(id);
    if (!info.family || !info.faces?.length) continue;
    const handle = delayRender(`Nạp font ${info.label}`);
    loadFont(id).finally(() => continueRender(handle));
  }
};

/**
 * Font đã nạp xong chưa — cho phong cách tự đo chữ bằng canvas (đo lúc font chưa về là ra bề rộng của font dự
 * phòng). Chưa xong thì giữ delayRender tới khi component vẽ lại với font thật, nên khung hình chụp ra luôn đúng.
 */
export const useFontReady = (id: string) => {
  const browser = typeof document !== "undefined" && typeof FontFace !== "undefined";
  const [ready, setReady] = useState(() => !browser || loaded.has(id));
  const [handle] = useState(() => (ready ? null : delayRender(`Đợi font ${fontInfo(id).label}`)));
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void loadFont(id).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [id, ready]);
  const [released] = useState(() => ({ done: handle === null }));
  const release = () => {
    if (released.done || handle === null) return;
    released.done = true;
    continueRender(handle);
  };
  useEffect(() => {
    if (ready) release();
  });
  // Bị gỡ trước khi font về (đổi phong cách trong trình chỉnh sửa): vẫn nhả, kẻo render treo tới hết giờ chờ.
  useEffect(() => release, []);
  return ready;
};

/** Mọi font video này dùng: kiểu phụ đề chung, kiểu riêng từng câu, văn bản tự do. */
export const fontsUsedBy = (props: Pick<ShortProps, "captionLook" | "captions" | "texts">) => {
  const ids = new Set<string>();
  if (props.captionLook?.font) ids.add(props.captionLook.font);
  for (const caption of props.captions) if (caption.style?.font) ids.add(caption.style.font);
  for (const text of props.texts ?? []) if (text.font) ids.add(text.font);
  return ids;
};
