import { useCurrentFrame } from "remotion";
import { Crown, Trophy } from "./Gold";
import { BEAT, currentAt, NAME_LH, type RankLayout } from "./layout";
import { EASE_INOUT, FONT, GOLD, GOLD_GRADIENT, INK, ramp, type RankItem, textOn, upper, WHITE, withAlpha } from "./theme";
import { useVt } from "../../i18n/video";

type RowState = { current: boolean; reveal: number; revealed: boolean };

/**
 * Bảng xếp hạng: mọi hạng xếp từ #1. Hạng đã qua hiện tên, chưa tới hiện "???",
 * hạng đang chiếu tô màu (vàng nếu #1) và lật tên khi thanh tên của thẻ vào xong.
 * Dọc: dải ngang trên cùng. Ngang/vuông: cột phải có tiêu đề.
 */
export const Board: React.FC<{ L: RankLayout; accent: string }> = ({ L, accent }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  if (L.items.length === 0 || frame < L.introEnd - 1) return null;
  const current = currentAt(L, frame);
  const sorted = [...L.items].sort((a, b) => a.rank - b.rank || a.index - b.index);
  const { board, unit: u, strip } = L;

  const stateOf = (item: RankItem): RowState => {
    if (item.index < current) return { current: false, reveal: 1, revealed: true };
    if (item.index > current) return { current: false, reveal: 0, revealed: false };
    const reveal = ramp(frame, L.enters[item.index] + BEAT.reveal, 12, EASE_INOUT);
    return { current: true, reveal, revealed: reveal >= 0.5 };
  };

  const headerP = ramp(frame, L.introEnd, 10);

  return (
    <>
      {!strip ? (
        <div
          style={{
            position: "absolute",
            left: board.x,
            top: board.y,
            width: board.w,
            height: board.headerH,
            display: "flex",
            alignItems: "center",
            gap: 14 * u,
            opacity: headerP,
            transform: `translateY(${(1 - headerP) * -20 * u}px)`,
          }}
        >
          <Trophy size={44 * u} />
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 34 * u, lineHeight: 1.3, color: WHITE, whiteSpace: "nowrap" }}>
            {upper(vt("Bảng xếp hạng"))}
          </div>
        </div>
      ) : null}
      {sorted.map((item, k) => {
        const st = stateOf(item);
        // Hàng trượt vào lần lượt khi phần mở đầu vừa xong; hàng dưới/bên phải vào sau.
        const inP = ramp(frame, L.introEnd + 2 + k * 2, 10);
        const left = strip ? board.x + k * (board.rowW + board.rowGap) : board.x;
        const top = strip ? board.y : board.y + board.headerH + k * (board.rowH + board.rowGap);
        return (
          <Row
            key={`row-${item.index}`}
            L={L}
            item={item}
            state={st}
            accent={accent}
            left={left}
            top={top}
            enterP={inP}
            pulse={st.current ? 1 - ramp(frame, L.enters[item.index], 14) : 0}
          />
        );
      })}
    </>
  );
};

const Row: React.FC<{
  L: RankLayout;
  item: RankItem;
  state: RowState;
  accent: string;
  left: number;
  top: number;
  enterP: number;
  pulse: number;
}> = ({ L, item, state, accent, left, top, enterP, pulse }) => {
  const { board, unit: u, strip } = L;
  const gold = item.rank === 1;
  const w = board.rowW;
  const h = board.rowH;
  const radius = (strip ? 22 : 24) * u;

  const bg = state.current
    ? gold
      ? GOLD_GRADIENT
      : `linear-gradient(135deg, ${accent} 0%, ${withAlpha(accent, 0.8)} 100%)`
    : state.revealed
      ? "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)"
      : "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)";
  const ink = state.current ? (gold ? INK : textOn(accent)) : WHITE;
  const rankColor = state.current ? ink : gold ? GOLD : state.revealed ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)";
  const border = state.current
    ? `${3 * u}px solid ${gold ? "#FFF1B8" : "rgba(255,255,255,0.75)"}`
    : state.revealed
      ? `${2 * u}px solid rgba(255,255,255,0.18)`
      : `${2 * u}px dashed rgba(255,255,255,0.18)`;

  // Lật tên: nửa đầu "???" xoay đi, nửa sau tên xoay vào.
  const flip = state.reveal;
  const showName = flip >= 0.5;
  const rot = showName ? (flip - 1) * 180 : flip * 180;
  const fitted = L.fittedRows[item.index];

  const nameBlock = showName ? (
    fitted.lines.map((line, i) => (
      <div
        key={`l-${i}`}
        style={{ fontFamily: FONT, fontWeight: 800, fontSize: fitted.size, lineHeight: NAME_LH, color: ink, whiteSpace: "nowrap" }}
      >
        {line}
      </div>
    ))
  ) : (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: (strip ? 30 : 36) * u,
        lineHeight: NAME_LH,
        color: state.current ? ink : "rgba(255,255,255,0.35)",
        whiteSpace: "nowrap",
      }}
    >
      ???
    </div>
  );

  const rankFont = strip ? 30 * u : h * 0.4;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: radius,
        backgroundImage: bg,
        border,
        boxShadow: state.current
          ? `0 0 ${34 * u}px ${withAlpha(gold ? GOLD : accent, 0.65)}, 0 ${10 * u}px ${20 * u}px rgba(0,0,0,0.4)`
          : `0 ${8 * u}px ${16 * u}px rgba(0,0,0,0.3)`,
        opacity: enterP,
        transform: `translate(${strip ? 0 : (1 - enterP) * 60 * u}px, ${strip ? (1 - enterP) * -40 * u : 0}px) scale(${1 + pulse * 0.08})`,
        display: "flex",
        flexDirection: strip ? "column" : "row",
        alignItems: strip ? "stretch" : "center",
        overflow: "hidden",
      }}
    >
      {/* Hạng */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: strip ? "flex-start" : "center",
          gap: 6 * u,
          flexShrink: 0,
          width: strip ? undefined : board.rowRankW,
          height: strip ? rankFont * 1.3 + 10 * u : "100%",
          paddingLeft: strip ? board.rowPadX : 0,
          paddingTop: strip ? 8 * u : 0,
          backgroundColor: strip ? "transparent" : state.current ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: rankFont,
            lineHeight: 1,
            color: rankColor,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ fontSize: "0.62em" }}>#</span>
          {item.rank}
        </div>
        {gold && strip ? <Crown width={30 * u} id={`rk-row-crown-${item.index}`} /> : null}
      </div>
      {/* Tên / ??? */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingLeft: board.rowPadX + (strip ? 0 : 6 * u),
          paddingRight: board.rowPadX,
          paddingBottom: strip ? 8 * u : 0,
          transform: `perspective(${600 * u}px) rotateX(${rot}deg)`,
        }}
      >
        {nameBlock}
      </div>
    </div>
  );
};
