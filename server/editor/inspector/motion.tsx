import { Crop, Maximize, RotateCcw, Search } from "lucide-react";
import type { MediaOverlay, Scene } from "../../../src/compositions/Short/schema";
import { overlayTransformAt } from "../../../src/compositions/Short/overlayMotion";
import { fmt, mediaAspect } from "../api";
import * as ops from "../ops";
import { Field, Slider } from "./controls";
import type { InspectorProps } from "./types";

// ---------- chuyển động: dùng chung cho cảnh và mọi video trên timeline ----------

type MotionBase = Pick<InspectorProps, "props" | "onChange"> & {
  sel: ops.MotionSel;
  item: Scene | MediaOverlay;
  /** Tên tab trong bảng thuộc tính (Panel đọc). */
  "data-tab"?: string;
};

/**
 * Mục "Vị trí & thu phóng". Các ô ghi qua ops.transformItem nên khi đã có mốc chuyển động thì sửa
 * đúng mốc tại đầu phát (chưa có thì tạo), y như kéo trên khung xem trước.
 */
export const MotionFrameSection: React.FC<MotionBase & Pick<InspectorProps, "timeMs" | "onRun">> = ({
  props, onChange, sel, item, timeMs, onRun, "data-tab": tab,
}) => {
  const at = overlayTransformAt(item, timeMs);
  const keys = ops.overlayKeyframesOf(item);
  const key = (name: string) => `motion-${sel.type}-${sel.index}-${name}`;
  const move = (patch: Partial<typeof at>, name: string) =>
    onChange(ops.transformItem(props, sel, patch, timeMs), key(name));
  const overlay = sel.type === "overlay" ? (item as MediaOverlay) : null;
  const setOverlay = (patch: Partial<MediaOverlay>, name?: string) =>
    onChange(ops.updateOverlay(props, sel.index, patch), name ? key(name) : undefined);
  const frameAspect = ops.videoMeta(props).width / ops.videoMeta(props).height;

  return (
    <section className="in-sec" data-tab={tab}>
      <h3><Search size={16} aria-hidden /> Vị trí & thu phóng</h3>
      <small className="in-hint">
        Kéo thẳng trên khung xem trước cũng được: kéo thân để dời, tay nắm góc để thu phóng, tay nắm trên để xoay.
        {sel.type === "scene" ? " Khung của cảnh hiện khi cảnh đang được chọn." : ""}
      </small>
      {keys.length > 0 ? (
        <p className="in-note">◆ Đang có {keys.length} mốc chuyển động — sửa các ô dưới đây sẽ ghi vào mốc tại đầu phát.</p>
      ) : null}
      <Field label={sel.type === "scene" ? "Thu phóng" : "Bề rộng khối"} hint="% chiều rộng khung hình (100% = đúng khung)">
        <Slider value={at.width} min={3} max={300} step={0.5} format={(v) => `${Math.round(v)}%`} onChange={(v) => move({ width: v }, "w")} />
      </Field>
      <div className="in-2">
        <Field label="Ngang (%)">
          <Slider value={at.x} min={-50} max={150} step={0.5} format={(v) => `${Math.round(v)}%`} onChange={(v) => move({ x: v }, "x")} />
        </Field>
        <Field label="Dọc (%)">
          <Slider value={at.y} min={-50} max={150} step={0.5} format={(v) => `${Math.round(v)}%`} onChange={(v) => move({ y: v }, "y")} />
        </Field>
      </div>
      <Field label="Xoay">
        <Slider value={at.rotate} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => move({ rotate: v }, "rot")} />
      </Field>
      <Field label="Độ mờ">
        <Slider value={at.opacity} max={1} onChange={(v) => move({ opacity: v }, "op")} />
      </Field>
      {overlay ? (
        <>
          <Field label="Bo góc" hint="% cạnh ngắn của khối">
            <Slider value={overlay.radius} max={50} step={1} format={(v) => `${Math.round(v)}%`} onChange={(v) => setOverlay({ radius: v }, "rad")} />
          </Field>
          <Field label="Hiện dần / mất dần" hint="Mỗi đầu">
            <Slider value={overlay.fadeMs} max={2000} step={50} format={(v) => `${(v / 1000).toFixed(2)}s`} onChange={(v) => setOverlay({ fadeMs: v }, "fade")} />
          </Field>
          <Field label="Hình trong khối">
            <div className="in-seg">
              <button className={overlay.fit === "cover" ? "on" : ""} onClick={() => setOverlay({ fit: "cover" })}>Lấp đầy</button>
              <button className={overlay.fit === "contain" ? "on" : ""} onClick={() => setOverlay({ fit: "contain" })}>Vừa khối</button>
            </div>
          </Field>
        </>
      ) : null}
      <div className="in-actions">
        {overlay ? (
          <button
            title="Phủ kín khung hình — như một cảnh thường"
            onClick={() => setOverlay({ x: 50, y: 50, width: 100, rotate: 0, aspect: Math.round(frameAspect * 1000) / 1000, fit: "cover", keyframes: [] })}
          >
            <Maximize size={16} aria-hidden /> Phủ kín khung
          </button>
        ) : null}
        <button onClick={() => move({ x: 50, y: 50 }, "center")}>⊕ Về giữa khung</button>
        <button disabled={at.rotate === 0} onClick={() => move({ rotate: 0 }, "rot0")}><RotateCcw size={16} aria-hidden /> Bỏ xoay</button>
        <button onClick={() => onRun(ops.resetMotion(props, sel))}><RotateCcw size={16} aria-hidden /> Về đúng khung</button>
      </div>
    </section>
  );
};

/** Mục "Crop khung hình" — dùng chung cho cảnh và video trên timeline. */
export const CropSection: React.FC<MotionBase & Pick<InspectorProps, "onStartCrop"> & {
  /** Lỗi khi đổi Lấp đầy/Vừa khung của cảnh (không đọc được kích thước file) — state nằm ở Inspector. */
  fitError: string | null;
  setFitError: (error: string | null) => void;
}> = ({ props, onChange, sel, item, onStartCrop, fitError, setFitError, "data-tab": tab }) => {
  const crop = item.crop;
  const clear = () =>
    onChange(sel.type === "scene"
      ? ops.updateScene(props, sel.index, { crop: null })
      : ops.updateOverlay(props, sel.index, { crop: null }));
  // Cảnh: lấp đầy / vừa khung ô ảnh của phong cách (lớp video đã có nút riêng ở mục Vị trí & thu phóng).
  // Chưa crop thì tạo crop "toàn bộ ảnh"; lấp đầy toàn bộ ảnh giống hệt không crop nên lưu null cho gọn.
  const fit = crop && "w" in crop ? crop.fit : "cover";
  const setFit = async (next: "cover" | "contain") => {
    if (sel.type !== "scene" || next === fit) return;
    if (crop && !("w" in crop)) return onStartCrop(sel); // crop kiểu cũ: mở khung crop để chuyển sang kiểu mới
    const src = ops.mediaSrcOf(item);
    if (!src) return;
    try {
      const base = crop && "w" in crop ? crop : {
        x: 0, y: 0, w: 1, h: 1, ratio: "original", rotate: 0, flipH: false, flipV: false,
        mediaAspect: Math.round((await mediaAspect(`/public/${src}`, ops.isVideo(src) ? "video" : "image")) * 10000) / 10000,
      };
      const whole = base.x === 0 && base.y === 0 && base.w === 1 && base.h === 1 && !base.rotate && !base.flipH && !base.flipV;
      onChange(ops.updateScene(props, sel.index, { crop: next === "cover" && whole ? null : { ...base, fit: next } }));
      setFitError(null);
    } catch (e) {
      setFitError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section className="in-sec" data-tab={tab}>
      <h3><Crop size={16} aria-hidden /> Crop khung hình</h3>
      {sel.type === "scene" ? (
        <div className="in-seg" role="radiogroup" aria-label="Cách đặt ảnh vào khung">
          <button role="radio" aria-checked={fit === "cover"} className={fit === "cover" ? "on" : ""} onClick={() => setFit("cover")}
            title="Phủ kín ô ảnh của phong cách, cắt bớt phần thừa">Lấp đầy</button>
          <button role="radio" aria-checked={fit === "contain"} className={fit === "contain" ? "on" : ""} onClick={() => setFit("contain")}
            title="Thấy trọn ảnh trong ô ảnh của phong cách">Vừa khung</button>
        </div>
      ) : null}
      {fitError ? <p className="voice-err">{fitError}</p> : null}
      <p className="in-note">
        {!crop
          ? "Chưa crop — đang dùng toàn bộ ảnh/video."
          : "w" in crop
            ? `Lấy ${Math.round(crop.w * 100)}% × ${Math.round(crop.h * 100)}% ảnh gốc · ${crop.fit === "cover" ? "lấp đầy" : "vừa khung"}` +
              `${crop.rotate ? ` · xoay ${crop.rotate}°` : ""}${crop.flipH ? " · lật ngang" : ""}${crop.flipV ? " · lật dọc" : ""}.`
            : `Crop kiểu cũ: lấy ${Math.round(crop.size * 100)}% khung. Mở khung crop để chỉnh theo kiểu mới.`}
      </p>
      <div className="in-actions">
        <button onClick={() => onStartCrop(sel)}><Crop size={16} aria-hidden /> Mở khung crop</button>
        {crop ? <button onClick={clear}>Bỏ crop</button> : null}
      </div>
      <small className="in-hint">Giống CapCut: chọn tỉ lệ, kéo 8 điểm, xoay, lật, lấp đầy hoặc vừa khung.</small>
    </section>
  );
};

/** Mục "Chuyển động (keyframe)" — dùng chung cho cảnh và lớp. Nơi gọi truyền data-tab="Chuyển động". */
export const MotionKeySection: React.FC<Omit<MotionBase, "onChange"> & Pick<InspectorProps, "timeMs" | "onSeek" | "onRun">> = ({
  props, sel, item, timeMs, onSeek, onRun, "data-tab": tab,
}) => {
  const keys = ops.overlayKeyframesOf(item);
  const what = sel.type === "scene" ? "Cảnh" : "Video";
  return (
    <section className="in-sec" data-tab={tab}>
      <h3>◆ Chuyển động (keyframe)</h3>
      {keys.length === 0 ? (
        <p className="in-note">
          {what} đang đứng yên. Cách làm: dời đầu phát tới chỗ bắt đầu → bấm <b>Ghim mốc</b> (hoặc nút ◆ trên thanh
          timeline) → dời đầu phát tới chỗ khác → kéo/thu phóng trên khung xem trước → ghim mốc nữa.
          Hình sẽ tự chạy mượt giữa các mốc.
        </p>
      ) : (
        <p className="in-note">
          {keys.length} mốc. Kéo trên khung xem trước sẽ sửa mốc tại đầu phát (chỗ đó chưa có mốc thì tạo mốc mới).
          Trước mốc đầu và sau mốc cuối, hình đứng yên.
        </p>
      )}
      <div className="in-actions">
        <button onClick={() => onRun(ops.setKeyframe(props, sel, timeMs))}>◆ Ghim mốc tại đầu phát</button>
        {keys.length > 0 ? (
          <>
            <button onClick={() => onRun(ops.deleteKeyframe(props, sel, timeMs))}>Xoá mốc ở đây</button>
            <button className="danger" onClick={() => onRun(ops.clearKeyframes(props, sel, timeMs))}>Bỏ chuyển động</button>
          </>
        ) : null}
      </div>
      {keys.length > 0 ? (
        <div className="kf-list">
          {keys.map((k) => (
            <button
              key={k.atMs}
              className={`kf-row ${Math.abs(k.atMs - timeMs) <= ops.KEYFRAME_SNAP_MS ? "on" : ""}`}
              onClick={() => onSeek(k.atMs)}
              title="Bấm để tua tới mốc này"
            >
              <b>◆ {fmt(k.atMs)}</b>
              <span>
                {Math.round(k.x)}% · {Math.round(k.y)}% · rộng {Math.round(k.width)}%
                {k.rotate ? ` · ${Math.round(k.rotate)}°` : ""}{k.opacity < 1 ? ` · mờ ${Math.round(k.opacity * 100)}%` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
