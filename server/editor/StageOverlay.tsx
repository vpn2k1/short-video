import { useEffect, useRef, useState } from "react";
import type { CaptionLook, ShortProps } from "../../src/compositions/Short/schema";
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

type Kind = "text" | "caption";
type Mode = "move" | "resize-l" | "resize-r";

type Drag = {
  kind: Kind;
  mode: Mode;
  index: number;
  x0: number;
  y0: number;
  /** Vị trí (%) và bề rộng khung chữ (%) lúc bắt đầu kéo. */
  startX: number;
  startY: number;
  startW: number;
  /** Phụ đề: chỉ đổi câu này (giữ Alt, hoặc câu đã có vị trí/khung riêng) thay vì tất cả. */
  onlyThis: boolean;
  base: ShortProps;
  latest: ShortProps;
};

const MIN_WIDTH = 10;

/**
 * Lớp trong suốt trên Player: khung cho văn bản và phụ đề đang hiện — kéo thân để đặt vị trí, kéo tay nắm
 * hai bên để đổi bề rộng khung chữ (chữ dài hơn khung tự xuống dòng). Chữ thật vẫn do composition vẽ; lớp
 * này dùng cùng font, cỡ, bề rộng tối đa nên khung khớp chữ.
 * Phụ đề chỉ kéo được khi đang dùng kiểu phụ đề tuỳ chỉnh (vị trí phụ đề của phong cách do phong cách quyết định).
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

  const lookOf = (kind: Kind, index: number): CaptionLook =>
    kind === "text" ? textLook(props.texts[index]) : resolveCaptionLook(props, props.captions[index]);

  const begin = (e: React.PointerEvent<HTMLElement>, kind: Kind, index: number, mode: Mode) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* môi trường không cho bắt con trỏ — vẫn kéo được trong khung */
    }
    onSelect({ type: kind, index });
    const look = lookOf(kind, index);
    const own = kind === "caption" ? props.captions[index].style : null;
    const onlyThis = kind === "caption" && (
      e.altKey || (mode === "move" ? own?.x !== undefined || own?.y !== undefined : own?.width !== undefined)
    );
    drag.current = {
      kind, mode, index, x0: e.clientX, y0: e.clientY,
      startX: look.x, startY: look.y, startW: look.width, onlyThis, base: props, latest: props,
    };
    onEdit(props, "start");
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = ((e.clientX - d.x0) / rect.width) * 100;

    let patch: Partial<CaptionLook>;
    if (d.mode === "move") {
      let x = Math.min(100, Math.max(0, d.startX + dx));
      let y = Math.min(100, Math.max(0, d.startY + ((e.clientY - d.y0) / rect.height) * 100));
      // Hít vào đường giữa khung — căn giữa là thao tác hay dùng nhất.
      const snapX = Math.abs(x - 50) < 1.5;
      const snapY = Math.abs(y - 50) < 1.5;
      if (snapX) x = 50;
      if (snapY) y = 50;
      setGuides({ x: snapX, y: snapY });
      patch = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    } else {
      // Khung đặt tâm ở x nên kéo một mép là giãn đều hai bên — tâm chữ đứng yên.
      const grow = d.mode === "resize-r" ? dx : -dx;
      const width = Math.min(100, Math.max(MIN_WIDTH, d.startW + grow * 2));
      patch = { width: Math.round(width * 10) / 10 };
    }

    d.latest = d.kind === "text"
      ? ops.updateText(d.base, d.index, patch.width !== undefined ? { maxWidth: patch.width } : patch)
      : ops.applyCaptionLook(d.base, d.onlyThis ? [d.index] : null, patch);
    onEdit(d.latest, "live");
  };

  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setGuides({ x: false, y: false });
    onEdit(d.latest, "end");
  };

  /** Khung kéo: cùng font/cỡ/bề rộng tối đa với chữ thật; mục đang chọn có khung bọc chữ và tay nắm. */
  const box = (kind: Kind, index: number, text: string, look: CaptionLook, selected: boolean, title: string) => (
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

  // Phụ đề đang hiện tại đầu phát, mỗi hàng một câu — cùng quy tắc với CustomCaptions: hiện trong [startMs, endMs).
  const captionIndices = usesCustomCaptions(props)
    ? activeCaptionIndices(props.captions, (c) => timeMs >= c.startMs && timeMs < c.endMs)
    : [];

  return (
    <div className="stage-overlay" ref={boxRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {guides.x ? <i className="guide v" /> : null}
      {guides.y ? <i className="guide h" /> : null}
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
