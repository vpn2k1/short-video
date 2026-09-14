import type { SceneCrop } from "../compositions/Short/schema";

export type MediaCrop = Extract<SceneCrop, { w: number }>;
type LegacyCrop = Extract<SceneCrop, { size: number }>;

export const isMediaCrop = (crop: SceneCrop | null | undefined): crop is MediaCrop =>
  Boolean(crop && "w" in crop);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Số đưa vào CSS — không để dạng 1e-7 mà trình duyệt không hiểu. */
const css = (v: number) => Number(v.toFixed(6));

/** Crop đời đầu: phóng vùng vuông của khung chứa cho đầy khung. */
const LegacyCropBox: React.FC<{ crop: LegacyCrop; children: React.ReactNode }> = ({ crop, children }) => {
  if (crop.size >= 0.999) {
    return <>{children}</>;
  }
  const size = clamp(crop.size, 0.05, 1);
  const x = clamp(crop.x, 0, 1 - size);
  const y = clamp(crop.y, 0, 1 - size);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          // translate chạy trước (theo % kích thước khung), scale sau: điểm x·W về 0, (x+size)·W về W.
          transform: `scale(${1 / size}) translate(${-x * 100}%, ${-y * 100}%)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Chỉ lấy một vùng của ảnh/video, xoay/lật, rồi đặt vào khung chứa — như Crop của CapCut.
 *
 * `children` phải phủ kín phần tử cha (width/height 100%). Hộp chứa children luôn có đúng
 * tỉ lệ của file gốc, nên objectFit "cover" hay "contain" bên trong đều không méo.
 *
 * Kích thước vùng tính bằng đơn vị container (cqw/cqh) nên không cần biết tỉ lệ khung
 * chứa: cùng một crop dùng được cho khung video lẫn khung ảnh polaroid của phong cách.
 * Chạy với mọi phần tử — <img>, <video>, cả <canvas> mà @remotion/media vẽ ra.
 */
export const CropBox: React.FC<{ crop?: SceneCrop | null; children: React.ReactNode }> = ({ crop, children }) => {
  if (!crop) {
    return <>{children}</>;
  }
  if (!isMediaCrop(crop)) {
    return <LegacyCropBox crop={crop}>{children}</LegacyCropBox>;
  }

  const w = clamp(crop.w, 0.02, 1);
  const h = clamp(crop.h, 0.02, 1);
  const x = clamp(crop.x, 0, 1 - w);
  const y = clamp(crop.y, 0, 1 - h);
  // Tỉ lệ rộng/cao của vùng crop tính theo pixel thật của file.
  const ratio = (w * crop.mediaAspect) / h;
  const rad = (crop.rotate * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  // Lấp đầy: vùng đã xoay phải phủ kín khung → rộng ≥ W·cos + H·sin và cao ≥ W·sin + H·cos.
  // Vừa khung: hộp bao của vùng đã xoay nằm gọn trong khung.
  const width = crop.fit === "cover"
    ? `max(calc(100cqw * ${css(cos)} + 100cqh * ${css(sin)}), calc((100cqw * ${css(sin)} + 100cqh * ${css(cos)}) * ${css(ratio)}))`
    : `min(calc(100cqw / ${css(cos + sin / ratio)}), calc(100cqh / ${css(sin + cos / ratio)}))`;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", containerType: "size" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width,
          height: `calc(${width} / ${css(ratio)})`,
          overflow: "hidden",
          transform: `translate(-50%, -50%) rotate(${css(crop.rotate)}deg) scale(${crop.flipH ? -1 : 1}, ${crop.flipV ? -1 : 1})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${css((-x / w) * 100)}%`,
            top: `${css((-y / h) * 100)}%`,
            width: `${css(100 / w)}%`,
            height: `${css(100 / h)}%`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
