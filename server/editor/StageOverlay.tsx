import { useEffect, useRef, useState } from "react";
import type { CaptionLook, MediaOverlay, Scene, ShortProps } from "../../src/compositions/Short/schema";
import { overlayKeyframes, overlayTransformAt } from "../../src/compositions/Short/overlayMotion";
import { activeCaptionIndices, captionDisplayText, resolveCaptionLook, textLook, usesCustomCaptions } from "../../src/components/captionLook";
import { FONTS } from "../../src/styles/shared";
import * as ops from "./ops";
import type { EditPhase } from "./Timeline";

type Props = {
  props: ShortProps;
  compositionWidth: number;
  compositionHeight: number;
  timeMs: number;
  selection: ops.Selection;
  onSelect: (selection: ops.Selection) => void;
  onEdit: (next: ShortProps, phase: EditPhase) => void;
};

type Kind = "text" | "caption" | "overlay" | "scene";
type Mode = "move" | "resize-l" | "resize-r" | "scale" | "rotate";
const CORNERS = ["nw", "ne", "se", "sw"] as const;

type Drag = {
  kind: Kind;
  mode: Mode;
  index: number;
  x0: number;
  y0: number;
  /** Vị trí (%) và bề rộng khung (%) lúc bắt đầu kéo. */
  startX: number;
  startY: number;
  startW: number;
  /** Cảnh / lớp: góc xoay lúc bắt đầu, và tâm khối tính bằng px trên màn hình. */
  startRotate: number;
  centerX: number;
  centerY: number;
  /** Phụ đề: chỉ đổi câu này (giữ Alt, hoặc câu đã có vị trí/khung riêng) thay vì tất cả. */
  onlyThis: boolean;
  base: ShortProps;
  latest: ShortProps;
};

const MIN_WIDTH = 10;
const PIP_MIN_WIDTH = 3;
const PIP_MAX_WIDTH = 400;
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Lớp trong suốt trên Player: khung cho văn bản, phụ đề và các video đang hiện.
 *
 * - Văn bản / phụ đề: kéo thân để đặt vị trí, kéo tay nắm hai bên để đổi bề rộng khung chữ (chữ dài
 *   hơn khung tự xuống dòng). Chữ thật vẫn do composition vẽ; lớp này dùng cùng font, cỡ, bề rộng
 *   tối đa nên khung khớp chữ. Phụ đề chỉ kéo được khi đang dùng kiểu phụ đề tuỳ chỉnh.
 * - Cảnh và mọi video trên timeline: kéo thân để dời khối, kéo tay nắm góc để thu phóng
 *   (giữ nguyên tỉ lệ), kéo tay nắm trên để xoay — cùng một bộ tay nắm cho cả hai. Đã có mốc chuyển
 *   động thì kéo sẽ ghi vào mốc tại đầu phát. Khung của cảnh chỉ hiện khi cảnh đang được chọn, để
 *   bấm vào khung xem trước vẫn phát/dừng như cũ.
 */
export const StageOverlay: React.FC<Props> = ({ props, compositionWidth, compositionHeight, timeMs, selection, onSelect, onEdit }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [guides, setGuides] = useState({ x: false, y: false });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBoxWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = boxWidth / compositionWidth;
  const unit = Math.min(compositionWidth, compositionHeight) / 1080;

  const lookOf = (kind: "text" | "caption", index: number): CaptionLook =>
    kind === "text" ? textLook(props.texts[index]) : resolveCaptionLook(props, props.captions[index]);

  /** Chuẩn bị kéo: bắt con trỏ, chọn mục, mở một bước hoàn tác. */
  const start = (e: React.PointerEvent<HTMLElement>, kind: Kind, index: number, mode: Mode, patch: Partial<Drag>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* môi trường không cho bắt con trỏ — vẫn kéo được trong khung */
    }
    onSelect({ type: kind, index });
    drag.current = {
      kind, mode, index, x0: e.clientX, y0: e.clientY,
      startX: 50, startY: 50, startW: 100, startRotate: 0, centerX: 0, centerY: 0,
      onlyThis: false, base: props, latest: props,
      ...patch,
    };
    onEdit(props, "start");
  };

  const begin = (e: React.PointerEvent<HTMLElement>, kind: "text" | "caption", index: number, mode: Mode) => {
    const look = lookOf(kind, index);
    const own = kind === "caption" ? props.captions[index].style : null;
    const onlyThis = kind === "caption" && (
      e.altKey || (mode === "move" ? own?.x !== undefined || own?.y !== undefined : own?.width !== undefined)
    );
    start(e, kind, index, mode, { startX: look.x, startY: look.y, startW: look.width, onlyThis });
  };

  const beginMotion = (e: React.PointerEvent<HTMLElement>, sel: ops.MotionSel, mode: Mode) => {
    const item = ops.motionItem(props, sel);
    const rect = boxRef.current?.getBoundingClientRect();
    if (!item || !rect) return;
    // Có keyframe thì khung đang ở vị trí đã nội suy — kéo phải bắt đầu từ chính vị trí đó.
    const at = overlayTransformAt(item, timeMs);
    start(e, sel.type, sel.index, mode, {
      startX: at.x,
      startY: at.y,
      startW: at.width,
      startRotate: at.rotate,
      centerX: rect.left + (at.x / 100) * rect.width,
      centerY: rect.top + (at.y / 100) * rect.height,
    });
  };

  /** Thu phóng và xoay cảnh/lớp — tính theo khoảng cách / góc so với tâm khối nên đúng cả khi khối đã xoay. */
  const moveMotion = (d: Drag, clientX: number, clientY: number, rect: DOMRect) => {
    const sel: ops.MotionSel = { type: d.kind === "scene" ? "scene" : "overlay", index: d.index };
    if (d.mode === "scale") {
      const before = Math.hypot(d.x0 - d.centerX, d.y0 - d.centerY);
      const after = Math.hypot(clientX - d.centerX, clientY - d.centerY);
      // Bắt đầu kéo ngay sát tâm thì tỉ lệ vô nghĩa — giữ nguyên bề rộng.
      const factor = before < 8 ? 1 : after / before;
      const width = Math.min(PIP_MAX_WIDTH, Math.max(PIP_MIN_WIDTH, d.startW * factor));
      return ops.transformItem(d.base, sel, { width: round1(width) }, timeMs);
    }
    if (d.mode === "rotate") {
      const from = Math.atan2(d.y0 - d.centerY, d.x0 - d.centerX);
      const to = Math.atan2(clientY - d.centerY, clientX - d.centerX);
      let deg = d.startRotate + ((to - from) * 180) / Math.PI;
      // Về khoảng [-180, 180] rồi hít vào mốc 15° — thẳng và nghiêng "đẹp" là thao tác hay dùng.
      deg = ((((deg + 180) % 360) + 360) % 360) - 180;
      const snapped = Math.round(deg / 15) * 15;
      return ops.transformItem(d.base, sel, { rotate: Math.abs(deg - snapped) < 3 ? snapped : Math.round(deg) }, timeMs);
    }
    let x = Math.min(150, Math.max(-50, d.startX + ((clientX - d.x0) / rect.width) * 100));
    let y = Math.min(150, Math.max(-50, d.startY + ((clientY - d.y0) / rect.height) * 100));
    const snapX = Math.abs(x - 50) < 1.5;
    const snapY = Math.abs(y - 50) < 1.5;
    if (snapX) x = 50;
    if (snapY) y = 50;
    setGuides({ x: snapX, y: snapY });
    return ops.transformItem(d.base, sel, { x: round1(x), y: round1(y) }, timeMs);
  };

  /**
   * Xử lý một vị trí con trỏ. Gọi qua `move` (một lần mỗi khung hình): pointermove bắn tới 120
   * lần/giây, mà mỗi lần lại vẽ lại cả khung xem trước.
   */
  const apply = (clientX: number, clientY: number) => {
    const d = drag.current;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!d || !rect) return;

    if (d.kind === "overlay" || d.kind === "scene") {
      d.latest = moveMotion(d, clientX, clientY, rect);
      onEdit(d.latest, "live");
      return;
    }

    const dx = ((clientX - d.x0) / rect.width) * 100;
    let patch: Partial<CaptionLook>;
    if (d.mode === "move") {
      let x = Math.min(100, Math.max(0, d.startX + dx));
      let y = Math.min(100, Math.max(0, d.startY + ((clientY - d.y0) / rect.height) * 100));
      // Hít vào đường giữa khung — căn giữa là thao tác hay dùng nhất.
      const snapX = Math.abs(x - 50) < 1.5;
      const snapY = Math.abs(y - 50) < 1.5;
      if (snapX) x = 50;
      if (snapY) y = 50;
      setGuides({ x: snapX, y: snapY });
      patch = { x: round1(x), y: round1(y) };
    } else {
      // Khung đặt tâm ở x nên kéo một mép là giãn đều hai bên — tâm chữ đứng yên.
      const grow = d.mode === "resize-r" ? dx : -dx;
      const width = Math.min(100, Math.max(MIN_WIDTH, d.startW + grow * 2));
      patch = { width: round1(width) };
    }

    d.latest = d.kind === "text"
      ? ops.updateText(d.base, d.index, patch.width !== undefined ? { maxWidth: patch.width } : patch)
      : ops.applyCaptionLook(d.base, d.onlyThis ? [d.index] : null, patch);
    onEdit(d.latest, "live");
  };

  /** Vị trí con trỏ mới nhất chờ xử lý ở khung hình tới. */
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frameRequest = useRef(0);

  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    pending.current = { x: e.clientX, y: e.clientY };
    if (frameRequest.current) return;
    frameRequest.current = requestAnimationFrame(() => {
      frameRequest.current = 0;
      const at = pending.current;
      pending.current = null;
      if (at) apply(at.x, at.y);
    });
  };

  const end = () => {
    // Xử lý nốt vị trí còn chờ để không mất đoạn kéo cuối.
    if (frameRequest.current) {
      cancelAnimationFrame(frameRequest.current);
      frameRequest.current = 0;
    }
    const at = pending.current;
    pending.current = null;
    if (at) apply(at.x, at.y);

    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setGuides({ x: false, y: false });
    onEdit(d.latest, "end");
  };

  /** Khung kéo: cùng font/cỡ/bề rộng tối đa với chữ thật; mục đang chọn có khung bọc chữ và tay nắm. */
  const box = (kind: "text" | "caption", index: number, text: string, look: CaptionLook, selected: boolean, title: string) => (
    <div
      key={`${kind}-${index}`}
      className={`stage-text ${kind === "caption" ? "stage-caption" : ""} ${selected ? "on" : ""}`}
      title={title}
      style={{
        left: `${look.x}%`,
        top: `${look.y}%`,
        maxWidth: `${look.width}%`,
        fontSize: look.size * unit * scale,
        fontFamily: FONTS[look.font],
        fontWeight: look.weight,
        fontStyle: look.italic ? "italic" : "normal",
        lineHeight: look.preset === "highlight" ? 1.5 : 1.25,
        textAlign: look.align,
        padding: look.preset === "box" ? "0.14em 0.5em" : 0,
      }}
      onPointerDown={(e) => begin(e, kind, index, "move")}
    >
      {captionDisplayText(text, look)}
      {selected ? (
        <span className="stage-wrap" style={{ width: (look.width / 100) * boxWidth }}>
          <i className="stage-handle l" title="Kéo để đổi bề rộng khung chữ" onPointerDown={(e) => begin(e, kind, index, "resize-l")} />
          <i className="stage-handle r" title="Kéo để đổi bề rộng khung chữ" onPointerDown={(e) => begin(e, kind, index, "resize-r")} />
        </span>
      ) : null}
    </div>
  );

  /**
   * Khung kéo của một CẢNH hoặc một LỚP: kéo thân để dời, 4 góc để thu phóng, tay nắm trên để xoay.
   * Cảnh và video trên timeline dùng chung khung này nên hàng nào cũng chỉnh y như nhau.
   */
  const motionBox = (
    sel: ops.MotionSel,
    item: Scene | MediaOverlay,
    aspect: number,
    radius: number,
    name: string,
    selected: boolean,
  ) => {
    const at = overlayTransformAt(item, timeMs);
    const keys = overlayKeyframes(item).length;
    return (
      <div
        key={`${sel.type}-${sel.index}`}
        className={`stage-pip ${sel.type === "scene" ? "stage-scene" : ""} ${selected ? "on" : ""} ${keys ? "moving" : ""}`}
        title={`${name}\n` +
          (keys
            ? `${keys} mốc chuyển động — kéo ở đây sẽ sửa mốc tại đầu phát`
            : "Kéo để dời · tay nắm góc để thu phóng · tay nắm trên để xoay")}
        style={{
          left: `${at.x}%`,
          top: `${at.y}%`,
          width: `${at.width}%`,
          aspectRatio: aspect,
          transform: `translate(-50%, -50%) rotate(${at.rotate}deg)`,
          borderRadius: `${radius}%`,
        }}
        onPointerDown={(e) => beginMotion(e, sel, "move")}
      >
        {selected ? (
          <>
            {CORNERS.map((corner) => (
              <i
                key={corner}
                className={`stage-pip-h ${corner}`}
                title="Kéo để thu phóng"
                onPointerDown={(e) => beginMotion(e, sel, "scale")}
              />
            ))}
            <i className="stage-pip-rot" title="Kéo để xoay" onPointerDown={(e) => beginMotion(e, sel, "rotate")} />
          </>
        ) : null}
      </div>
    );
  };

  // Phụ đề đang hiện tại đầu phát, mỗi hàng một câu — cùng quy tắc với CustomCaptions: hiện trong [startMs, endMs).
  const captionIndices = usesCustomCaptions(props)
    ? activeCaptionIndices(props.captions, (c) => timeMs >= c.startMs && timeMs < c.endMs)
    : [];
  // Lớp chồng: hàng cao vẽ trên, giống MediaOverlays — phần tử sau nằm trên phần tử trước.
  const pips = ops.overlaysOf(props)
    .map((overlay, index) => ({ overlay, index }))
    .filter(({ overlay: o }) => timeMs >= o.startMs && timeMs < o.endMs)
    .sort((a, b) => a.overlay.track - b.overlay.track || a.index - b.index);
  /**
   * Cảnh (hàng Cảnh): khung chỉ hiện khi cảnh đó ĐANG ĐƯỢC CHỌN (bấm khối trên timeline) và đầu
   * phát đang ở trong cảnh — hiện lúc nào cũng có thì khung phủ kín ảnh sẽ chặn bấm-để-phát.
   */
  const sceneBox =
    selection?.type === "scene" && props.scenes[selection.index]
      && timeMs >= props.scenes[selection.index].startMs && timeMs < props.scenes[selection.index].endMs
      ? selection.index
      : null;
  const frameAspect = compositionWidth / compositionHeight;

  return (
    <div className="stage-overlay" ref={boxRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {guides.x ? <i className="guide v" /> : null}
      {guides.y ? <i className="guide h" /> : null}
      {boxWidth > 0 && sceneBox !== null
        ? motionBox({ type: "scene", index: sceneBox }, props.scenes[sceneBox], frameAspect, 0, `Cảnh ${sceneBox + 1}`, true)
        : null}
      {boxWidth > 0
        ? pips.map(({ overlay, index }) =>
            motionBox(
              { type: "overlay", index },
              overlay,
              overlay.aspect,
              overlay.radius,
              `${ops.overlayName(overlay)} · ${overlay.src.split("/").pop()}`,
              selection?.type === "overlay" && selection.index === index,
            ),
          )
        : null}
      {boxWidth > 0
        ? captionIndices.map((captionIndex) =>
            box(
              "caption",
              captionIndex,
              props.captions[captionIndex].text,
              lookOf("caption", captionIndex),
              selection?.type === "caption" && selection.index === captionIndex,
              "Kéo để dời phụ đề — giữ Alt (Option) để chỉ dời câu này · kéo tay nắm hai bên để đổi khung chữ",
            ),
          )
        : null}
      {boxWidth > 0
        ? props.texts.map((t, i) =>
            timeMs >= t.startMs && timeMs < t.endMs && t.text.trim()
              ? box("text", i, t.text, textLook(t), selection?.type === "text" && selection.index === i, "Kéo để đặt vị trí · kéo tay nắm hai bên để đổi khung chữ")
              : null,
          )
        : null}
    </div>
  );
};
