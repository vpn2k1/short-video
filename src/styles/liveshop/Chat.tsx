import { interpolate, useCurrentFrame } from "remotion";
import { CartIcon } from "./Icons";
import { clamp, GOLD, SMOOTH, UI, type ChatLine, type Geo } from "./live";

/** Số frame một dòng mới đẩy cả khung chat lên. */
const SCROLL_FRAMES = 7;

/** Màu tên người xem: pastel sáng theo sắc độ riêng của từng tên — đọc được trên nền tối. */
const nameColor = (hue: number) => `hsl(${hue}, 85%, 78%)`;

const Row: React.FC<{ line: ChatLine; geo: Geo }> = ({ line, geo }) => {
  const { u, chatFont } = geo;
  const buy = line.kind === "buy";
  const join = line.kind === "join";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10 * u,
        maxWidth: "100%",
        padding: `${7 * u}px ${18 * u}px`,
        borderRadius: 999,
        backgroundColor: buy ? "rgba(255,150,20,0.42)" : "rgba(0,0,0,0.32)",
        fontFamily: UI,
        fontSize: chatFont,
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {buy ? <CartIcon size={chatFont * 1.05} color={GOLD} /> : null}
      <span style={{ fontWeight: 700, color: buy ? GOLD : join ? "rgba(255,255,255,0.7)" : nameColor(line.hue), flexShrink: 0 }}>
        {line.name}
      </span>
      <span
        style={{
          fontWeight: join ? 500 : 600,
          color: buy ? "#fff5d6" : join ? "rgba(255,255,255,0.7)" : "#ffffff",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {line.text}
      </span>
    </div>
  );
};

/**
 * Khung bình luận góc trái dưới, đáy nằm ngay trên lời ghim của chủ phòng. Dòng mới nhất ở dưới cùng, mỗi dòng
 * mới đẩy cả khung lên một hàng trong SCROLL_FRAMES; hàng trên cùng mờ dần nhờ mask gradient.
 */
export const Chat: React.FC<{ geo: Geo; lines: ChatLine[]; bottom: number; appear: number; dim: number }> = ({
  geo,
  lines,
  bottom,
  appear,
  dim,
}) => {
  const frame = useCurrentFrame();
  const { u, side, chatW, chatRows, chatRowH } = geo;
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].at <= frame) last = i;
  if (last < 0) return null;
  const enter = interpolate(frame, [lines[last].at, lines[last].at + SCROLL_FRAMES], [0, 1], { ...clamp, easing: SMOOTH });
  const t = interpolate(frame, [appear, appear + 12], [0, 1], clamp);
  const boxH = chatRows * chatRowH;
  const rows: React.ReactNode[] = [];
  for (let slot = 0; slot <= chatRows; slot++) {
    const i = last - slot;
    if (i < 0) break;
    const y = boxH - (slot + 1) * chatRowH + (1 - enter) * chatRowH;
    rows.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: 0,
          top: y,
          height: chatRowH,
          width: chatW,
          display: "flex",
          alignItems: "center",
          opacity: slot === 0 ? enter : 1,
          translate: slot === 0 ? `${(1 - enter) * -24 * u}px 0px` : undefined,
        }}
      >
        <Row line={lines[i]} geo={geo} />
      </div>,
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: side,
        top: bottom - boxH,
        width: chatW,
        height: boxH,
        overflow: "hidden",
        opacity: t * (1 - dim * 0.55),
        maskImage: "linear-gradient(180deg, transparent 0%, #000 42%, #000 100%)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 42%, #000 100%)",
      }}
    >
      {rows}
    </div>
  );
};
