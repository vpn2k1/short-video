export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Frames of tail padding after the last caption ends. */
export const OUTRO_FRAMES = 30;

/** Length of the intro title card. Lives here, not in the component tree, so
 *  Node-side scripts can import it without pulling in browser-only packages. */
export const TITLE_FRAMES = 70;

export const msToFrames = (ms: number) => Math.round((ms / 1000) * FPS);

/**
 * Vùng an toàn 9:16 (px trên khung 1080×1920), theo skill short-form-video.
 * Nền tảng vẽ UI của họ đè lên các dải này: đỉnh là avatar/nhạc, đáy là caption
 * tự động + nút like/share + thanh audio. Mọi thứ mang thông tin phải nằm ngoài.
 */
export const SAFE = {
  top: 120,
  bottom: 320,
  side: 120,
} as const;

/**
 * Xếp chỗ theo chiều dọc, tính từ đáy khung, để watermark và phụ đề không đè nhau:
 *   0    – 320   dải nền tảng chiếm dụng
 *   360  – ~450  watermark
 *   500  – ...   phụ đề (khi đặt ở đáy)
 */
export const WATERMARK_BOTTOM = SAFE.bottom + 40;
export const CAPTION_BOTTOM = SAFE.bottom + 180;
