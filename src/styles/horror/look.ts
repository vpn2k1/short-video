/**
 * Hằng số và phép tính thuần của phong cách "Truyện ma": bảng màu, nhịp chập chờn của đèn,
 * cửa sổ thời gian của cú hù (punch), vị trí câu nhấn trong phụ đề.
 * Mọi ngẫu nhiên đều qua seeded() — cùng frame cùng hình, render song song không lệch.
 */
import { Easing, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene } from "../../compositions/Short/schema";
import { seeded } from "../shared";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Chậm, rón rén — không lò xo, không nảy. */
export const EASE = Easing.bezier(0.33, 0, 0.2, 1);

export const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Trắng ngà nhợt của chữ — không trắng tinh. */
export const BONE = "#e6e2d6";
/** Đỏ máu: câu nhấn, dòng phụ tiêu đề, chấm REC. */
export const BLOOD = "#c8141c";
export const BLOOD_GLOW = "rgba(200,20,28,0.55)";
/** Đen lạnh ngả lục của phòng tối. */
export const NIGHT = "#040706";

/** Khung ngang (16:9, 2:1) dùng bố cục ngang. */
export const isWide = (width: number, height: number) => width / height > 1.2;

/** In hoa an toàn cho tiếng Việt — KHÔNG dùng CSS text-transform. */
export const upperVi = (text: string) => text.normalize("NFC").toLocaleUpperCase("vi");

/** Tách theo ký tự hiển thị (NFC) để gõ chữ không cắt đôi dấu tiếng Việt. */
export const glyphs = (text: string) => Array.from(text.normalize("NFC"));

/**
 * Chỉnh màu "đêm khuya": rút màu, tối, tương phản cao. Filter TĨNH (không đổi theo frame)
 * để Chrome không phải tính lại chuỗi filter; ám lục lạnh do lớp màu phủ trong Footage lo.
 */
export const GRADE = "saturate(0.26) contrast(1.22) brightness(0.62)";

/** Nửa độ dài nhúng đen quanh điểm cắt cảnh (frame). */
export const SCENE_IN = 14;
export const SCENE_OUT = 10;

/** Frame nội dung của cảnh được phép hiện (cảnh đầu có title thì đợi title tắt). */
export const sceneAppear = (index: number, startFrame: number, showTitle: boolean, delay: number) =>
  index === 0 && showTitle ? TITLE_FRAMES + delay : startFrame + delay;

/* ------------------------------------------------------------ đèn chập chờn */

/**
 * Mức tối thêm do đèn chập chờn tại frame (0 = bình thường, ~0.6 = gần tắt).
 * Mỗi khối 54 frame có ~55% một lần chập 2–4 frame ở vị trí bốc thăm, cộng dao động rất nhẹ
 * liên tục. Chỉ làm TỐI đi, không bao giờ loé sáng — tránh nhấp nháy gây khó chịu.
 */
export const flickerAt = (frame: number) => {
  const block = Math.floor(frame / 54);
  let dip = 0;
  if (seeded(`hz-flk-${block}`) < 0.55) {
    const at = block * 54 + Math.floor(seeded(`hz-flk-at-${block}`, 6, 44));
    const len = Math.floor(seeded(`hz-flk-len-${block}`, 2, 5));
    if (frame >= at && frame < at + len) {
      // Nhịp tắt–sáng–tắt trong vài frame, như bóng đèn sợi đốt sắp cháy.
      dip = (frame - at) % 2 === 0 ? seeded(`hz-flk-d-${block}`, 0.38, 0.62) : 0.18;
    }
  }
  const hum = 0.04 * (0.5 + 0.5 * Math.sin(frame * 0.31)) * (0.5 + 0.5 * Math.sin(frame * 0.071 + 1.3));
  return Math.min(0.7, dip + hum);
};

/** Rung máy cầm tay rất nhẹ (px) — tổng vài sóng sin lệch pha, mượt, không giật. */
export const driftAt = (frame: number, seed: number, unit: number) => {
  const p = seeded(`hz-drift-${seed}`, 0, Math.PI * 2);
  const x = Math.sin(frame * 0.021 + p) * 9 + Math.sin(frame * 0.067 + p * 2) * 3.5 + Math.sin(frame * 0.19 + p) * 1;
  const y = Math.cos(frame * 0.017 + p) * 7 + Math.sin(frame * 0.083 + p * 3) * 2.5 + Math.cos(frame * 0.23 + p) * 0.8;
  const rot = Math.sin(frame * 0.013 + p) * 0.35;
  return { x: x * unit, y: y * unit, rot };
};

/* ------------------------------------------------------------------ cú hù */

/** Cú hù: chớp tối 3 frame, rung + tách màu 9 frame, rồi yên. */
export const SCARE_FLASH = 3;
export const SCARE_SHAKE = 9;
/** Câu nhấn không nằm trong phụ đề nào: hiện riêng giữa khung chừng này frame. */
export const SCARE_HOLD = 42;

/** Cảnh có punch đang ở trong cửa sổ cú hù — trả về frame tương đối (0…) hoặc null. */
export const scareAt = (scenes: Scene[], frame: number) => {
  for (let i = 0; i < scenes.length; i++) {
    const punch = scenes[i].punch;
    if (!punch) continue;
    const at = msToFrames(punch.atMs);
    if (frame >= at && frame < at + SCARE_SHAKE) return { t: frame - at, index: i };
  }
  return null;
};

/** Độ rung và độ tách màu của cú hù tại frame (0 khi không có). */
export const scareShake = (scenes: Scene[], frame: number, unit: number) => {
  const s = scareAt(scenes, frame);
  if (!s) return { x: 0, y: 0, split: 0, dark: 0 };
  const decay = 1 - s.t / SCARE_SHAKE;
  const x = seeded(`hz-sx-${s.index}-${s.t}`, -1, 1) * 22 * unit * decay;
  const y = seeded(`hz-sy-${s.index}-${s.t}`, -1, 1) * 14 * unit * decay;
  const split = 10 * unit * decay;
  // Chớp tối một lần duy nhất ở đầu cú hù, tắt dần trong 3 frame.
  const dark = s.t < SCARE_FLASH ? interpolate(s.t, [0, SCARE_FLASH], [0.88, 0.2], clamp) : 0;
  return { x, y, split, dark };
};

/* -------------------------------------------------- câu nhấn trong phụ đề */

const norm = (text: string) => text.normalize("NFC").toLocaleLowerCase("vi");

/** Vị trí câu nhấn trong một câu phụ đề (không phân biệt hoa thường), -1 nếu không có. */
export const punchOffset = (caption: string, punch: string) => {
  const needle = norm(punch).trim();
  if (!needle) return -1;
  return norm(caption).indexOf(needle);
};

/**
 * Cảnh chứa câu nhấn có câu phụ đề nào chứa nguyên văn cụm từ không. Không có (hoặc phụ đề
 * do composition tự vẽ, captions rỗng) thì câu nhấn hiện riêng giữa khung.
 */
export const punchInCaptions = (scene: Scene, captions: Caption[]) => {
  if (!scene.punch) return false;
  const text = scene.punch.text;
  return captions.some(
    (c) => c.startMs < scene.endMs + 200 && c.endMs > scene.startMs - 200 && punchOffset(c.text, text) >= 0,
  );
};
