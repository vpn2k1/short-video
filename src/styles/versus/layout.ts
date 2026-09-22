/**
 * Bố cục từng phe: chỗ bảng tên (+ bảng điểm), hộp phụ đề, vùng con dấu phán quyết.
 *
 *  - Dọc: bảng tên hai phe ôm sát huy hiệu VS như game đối kháng — A bên trái PHÍA TRÊN đường nối, B bên phải
 *    PHÍA DƯỚI. Phụ đề nằm ở mép ngoài phe (A sát đỉnh vùng an toàn, B sát đáy), con dấu ở khoảng trống giữa.
 *  - Ngang / vuông: bảng tên ở đỉnh mỗi phe, dạt về phía đường nối; phụ đề ở đáy phe; con dấu ở giữa.
 *  - Cảnh kết luận (phe A phủ toàn khung): bảng tên giữa đỉnh, phụ đề giữa đáy, con dấu chính giữa.
 * Chiều cao hộp phụ đề và bảng điểm được giữ chỗ từ TOÀN BỘ dữ liệu nên con dấu không nhảy giữa các câu.
 */
import { seamAt, type Geo } from "./theme";

export type Safe = { top: number; bottom: number; side: number };

export type PlateSpot = {
  /** Mép neo theo chiều ngang: trái (align left) hoặc phải (align right). */
  x: number;
  align: "left" | "right" | "center";
  /** Mép neo theo chiều dọc; `grow` = "up" thì đây là đáy khối, "down" là đỉnh khối. */
  y: number;
  grow: "up" | "down";
  maxW: number;
};

export type CaptionSpot = { left: number; right: number; y: number; anchor: "top" | "bottom" };

export type SideLayout = {
  plate: PlateSpot;
  caption: CaptionSpot;
  /** Vùng trống cho con dấu: tâm và kích thước tối đa. */
  stamp: { cx: number; cy: number; maxW: number; maxH: number };
};

/** Chiều cao cố định của bảng tên và khoảng hở chung. */
export const plateHeight = (u: number) => 78 * u;
export const GAP = 22;

export const sideLayout = (
  g: Geo,
  safe: Safe,
  side: 0 | 1 | "verdict",
  reserve: { caption: number; score: number },
): SideLayout => {
  const { W, H, u, amp, emblemR } = g;
  const gap = GAP * u;
  const plateH = plateHeight(u);
  const stackH = plateH + (reserve.score > 0 ? reserve.score + gap * 0.6 : 0);

  if (side === "verdict") {
    const top = safe.top + gap;
    const capBottom = H - safe.bottom;
    const zoneTop = top + stackH + gap * 2;
    const zoneBottom = capBottom - reserve.caption - gap * 2;
    return {
      plate: { x: W / 2, align: "center", y: top, grow: "down", maxW: W - safe.side * 2 },
      caption: { left: safe.side, right: W - safe.side, y: capBottom, anchor: "bottom" },
      stamp: { cx: W / 2, cy: (zoneTop + zoneBottom) / 2, maxW: W - safe.side * 2, maxH: Math.max(120 * u, zoneBottom - zoneTop) },
    };
  }

  if (g.portrait) {
    const cx = W / 2;
    const inner = emblemR + gap * 1.4;
    if (side === 0) {
      // Bảng tên A: bên trái huy hiệu, đáy khối cách đường nối (điểm cao nhất trong đoạn) một khoảng hở.
      const plateRight = cx - inner;
      const bottom = seamAt(g, plateRight) - amp - gap * 1.2;
      const capTop = safe.top;
      // Con dấu A: nửa phải (bảng tên nằm bên trái), giữa phụ đề và đường nối / huy hiệu.
      const zoneLeft = plateRight + gap;
      const zoneRight = W - safe.side;
      const zoneTop = capTop + reserve.caption + gap;
      const zoneBottom = Math.min(seamAt(g, zoneRight) - amp, H / 2 - emblemR) - gap;
      return {
        plate: { x: safe.side, align: "left", y: bottom, grow: "up", maxW: plateRight - safe.side },
        caption: { left: safe.side, right: W - safe.side, y: capTop, anchor: "top" },
        stamp: { cx: (zoneLeft + zoneRight) / 2, cy: (zoneTop + zoneBottom) / 2, maxW: zoneRight - zoneLeft, maxH: Math.max(110 * u, zoneBottom - zoneTop) },
      };
    }
    const plateLeft = cx + inner;
    const top = seamAt(g, plateLeft) + amp + gap * 1.2;
    const capBottom = H - safe.bottom;
    // Con dấu B: nửa trái (bảng tên bên phải), dưới huy hiệu + chip vòng, trên phụ đề.
    const zoneLeft = safe.side;
    const zoneRight = plateLeft - gap;
    const zoneTop = Math.max(seamAt(g, zoneLeft) + amp, H / 2 + emblemR + 26 * u) + gap;
    const zoneBottom = capBottom - reserve.caption - gap;
    return {
      plate: { x: W - safe.side, align: "right", y: top, grow: "down", maxW: W - safe.side - plateLeft },
      caption: { left: safe.side, right: W - safe.side, y: capBottom, anchor: "bottom" },
      stamp: { cx: (zoneLeft + zoneRight) / 2, cy: (zoneTop + zoneBottom) / 2, maxW: zoneRight - zoneLeft, maxH: Math.max(110 * u, zoneBottom - zoneTop) },
    };
  }

  // Ngang / vuông.
  const top = safe.top + gap;
  const capBottom = H - safe.bottom;
  const capTop = capBottom - reserve.caption;
  const plateBottom = top + stackH;
  if (side === 0) {
    // Đường nối nghiêng: tại đỉnh lệch phải, tại đáy lệch trái → lấy điểm gần tâm nhất trong từng đoạn.
    const plateRight = seamAt(g, plateBottom) - amp - gap * 1.4;
    const capRight = seamAt(g, capBottom) - amp - gap * 1.4;
    const zoneRight = Math.min(seamAt(g, capTop) - amp, W / 2 - emblemR) - gap;
    return {
      plate: { x: plateRight, align: "right", y: top, grow: "down", maxW: plateRight - safe.side },
      caption: { left: safe.side, right: capRight, y: capBottom, anchor: "bottom" },
      stamp: {
        cx: (safe.side + zoneRight) / 2,
        cy: (plateBottom + capTop) / 2,
        maxW: zoneRight - safe.side,
        maxH: Math.max(110 * u, capTop - plateBottom - gap * 2),
      },
    };
  }
  const plateLeft = seamAt(g, 0) + amp + gap * 1.4;
  const capLeft = seamAt(g, capTop) + amp + gap * 1.4;
  const zoneLeft = Math.max(seamAt(g, plateBottom) + amp, W / 2 + emblemR) + gap;
  return {
    plate: { x: plateLeft, align: "left", y: top, grow: "down", maxW: W - safe.side - plateLeft },
    caption: { left: capLeft, right: W - safe.side, y: capBottom, anchor: "bottom" },
    stamp: {
      cx: (zoneLeft + W - safe.side) / 2,
      cy: (plateBottom + capTop) / 2,
      maxW: W - safe.side - zoneLeft,
      maxH: Math.max(110 * u, capTop - plateBottom - gap * 2),
    },
  };
};
