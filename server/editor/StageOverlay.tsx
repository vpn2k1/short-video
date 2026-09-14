import { useEffect, useRef, useState } from "react";
import type { ShortProps } from "../../src/compositions/Short/schema";
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

type Drag = { index: number; x0: number; y0: number; base: ShortProps; latest: ShortProps };

/**
 * Lớp trong suốt trên Player: khung viền cho từng văn bản đang hiện, kéo để đặt vị trí.
 * Chữ thật vẫn do composition vẽ — lớp này chỉ để bắt chuột, cùng cỡ chữ nên khung khớp chữ.
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

  const begin = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* môi trường không cho bắt con trỏ — vẫn kéo được trong khung */
    }
    onSelect({ type: "text", index });
    drag.current = { index, x0: e.clientX, y0: e.clientY, base: props, latest: props };
    onEdit(props, "start");
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const t = d.base.texts[d.index];
    let x = Math.min(100, Math.max(0, t.x + ((e.clientX - d.x0) / rect.width) * 100));
    let y = Math.min(100, Math.max(0, t.y + ((e.clientY - d.y0) / rect.height) * 100));
    // Hít vào đường giữa khung — căn giữa là thao tác hay dùng nhất.
    const snapX = Math.abs(x - 50) < 1.5;
    const snapY = Math.abs(y - 50) < 1.5;
    if (snapX) x = 50;
    if (snapY) y = 50;
    setGuides({ x: snapX, y: snapY });
    d.latest = ops.updateText(d.base, d.index, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    onEdit(d.latest, "live");
  };

  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setGuides({ x: false, y: false });
    onEdit(d.latest, "end");
  };

  const selectedIndex = selection?.type === "text" ? selection.index : -1;

  return (
    <div className="stage-overlay" ref={boxRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {guides.x ? <i className="guide v" /> : null}
      {guides.y ? <i className="guide h" /> : null}
      {boxWidth > 0
        ? props.texts.map((t, i) =>
            timeMs >= t.startMs && timeMs < t.endMs && t.text.trim() ? (
              <div
                key={`st-${i}`}
                className={`stage-text ${i === selectedIndex ? "on" : ""}`}
                title="Kéo để đặt vị trí"
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  maxWidth: `${t.maxWidth}%`,
                  fontSize: t.size * unit * scale,
                  fontWeight: t.weight,
                  textAlign: t.align,
                  padding: t.background ? "0.2em 0.45em" : 0,
                }}
                onPointerDown={(e) => begin(e, i)}
              >
                {t.text}
              </div>
            ) : null,
          )
        : null}
    </div>
  );
};
