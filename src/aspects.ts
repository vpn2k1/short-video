/**
 * Tỉ lệ khung hình và vùng an toàn tương ứng.
 *
 * Vùng an toàn KHÔNG giống nhau giữa các tỉ lệ. 9:16 phải chừa nhiều vì nền tảng
 * short-form vẽ caption tự động, nút like/share và thanh audio đè lên. 16:9 xem
 * trên YouTube/desktop thì gần như không bị che, chỉ cần lề cho dễ nhìn.
 */
export type AspectId = "9:16" | "3:4" | "1:1" | "16:9" | "2:1";

export type Aspect = {
  id: AspectId;
  label: string;
  width: number;
  height: number;
  safe: { top: number; bottom: number; side: number };
};

export const ASPECTS: Record<AspectId, Aspect> = {
  "9:16": {
    id: "9:16", label: "9:16 — TikTok / Reels / Shorts",
    width: 1080, height: 1920,
    // Nền tảng chiếm dụng: đỉnh avatar/nhạc, đáy caption + nút + thanh audio.
    safe: { top: 120, bottom: 320, side: 120 },
  },
  "3:4": {
    id: "3:4", label: "3:4 — Instagram feed dọc",
    width: 1080, height: 1440,
    safe: { top: 90, bottom: 200, side: 90 },
  },
  "1:1": {
    id: "1:1", label: "1:1 — vuông",
    width: 1080, height: 1080,
    safe: { top: 80, bottom: 160, side: 80 },
  },
  "16:9": {
    id: "16:9", label: "16:9 — YouTube / ngang",
    width: 1920, height: 1080,
    safe: { top: 60, bottom: 100, side: 90 },
  },
  "2:1": {
    id: "2:1", label: "2:1 — điện ảnh",
    width: 1920, height: 960,
    safe: { top: 50, bottom: 90, side: 90 },
  },
};

export const ASPECT_IDS = Object.keys(ASPECTS) as AspectId[];

export const DEFAULT_ASPECT: AspectId = "9:16";

/**
 * Tìm lại aspect từ kích thước thật lúc render.
 * Component chỉ có `useVideoConfig()` nên phải suy ngược từ width/height;
 * so theo tỉ lệ chứ không so pixel, để đổi độ phân giải vẫn nhận ra.
 */
export const aspectFor = (width: number, height: number): Aspect => {
  const ratio = width / height;
  let best = ASPECTS[DEFAULT_ASPECT];
  let bestDiff = Infinity;
  for (const aspect of Object.values(ASPECTS)) {
    const diff = Math.abs(aspect.width / aspect.height - ratio);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = aspect;
    }
  }
  return best;
};

/** Chỗ đặt watermark và phụ đề, tính từ đáy — luôn nằm ngoài dải nền tảng chiếm. */
export const layoutFor = (width: number, height: number) => {
  const { safe } = aspectFor(width, height);
  return {
    safe,
    watermarkBottom: safe.bottom + Math.round(height * 0.021),
    captionBottom: safe.bottom + Math.round(height * 0.094),
  };
};
