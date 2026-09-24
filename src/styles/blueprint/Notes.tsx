/**
 * Phụ đề của phong cách "Bản vẽ kỹ thuật" = mục "GHI CHÚ" trên bản vẽ: mỗi câu một dòng đánh số tròn ①②③ (khớp
 * với số chỉ dẫn trên ảnh), gõ ra từng ký tự có gạch chân mảnh như chữ kẻ tay. Cụm `punch` đổi màu nhấn và được
 * khoanh đám mây sửa đổi (revision cloud) tự vẽ, kèm tam giác "!" như dấu sửa đổi trên bản vẽ thật.
 */
import { interpolate } from "remotion";
import { seeded } from "../shared";
import { C, chars, clamp, estimateLines, LABEL, MONO, NOTE, POP, ramp, withAlpha } from "./theme";
import type { Box } from "./Drawing";
import { useVt } from "../../i18n/video";

export type NoteItem = { text: string; start: number; end: number };

/** Bề rộng trung bình một ký tự Roboto 500 tính theo cỡ chữ (hơi rộng tay cho an toàn). */
const CHAR_W = 0.53;
const LINE_H = 1.46;

/** Vị trí cụm nhấn trong câu, tính theo chỉ số ký tự (code point); null nếu câu không chứa nguyên văn cụm đó. */
export const punchRange = (text: string, punch: string): [number, number] | null => {
  const hay = text.normalize("NFC").toLocaleLowerCase("vi");
  const needle = punch.normalize("NFC").trim().toLocaleLowerCase("vi");
  if (!needle) return null;
  const at = hay.indexOf(needle);
  if (at < 0) return null;
  const from = Array.from(hay.slice(0, at)).length;
  return [from, from + Array.from(needle).length];
};

/** Số frame gõ xong một câu: nhanh hơn giọng đọc nhưng không quá 70% thời lượng câu. */
export const typeFrames = (item: NoteItem) => {
  const n = chars(item.text).length;
  return Math.max(6, Math.min(n * 0.8, Math.max(6, (item.end - item.start) * 0.7)));
};

/** Đường viền đám mây sửa đổi quanh hình chữ nhật w×h: các cung lồi ra ngoài, hơi so le như vẽ tay. */
const cloudPath = (w: number, h: number, bump: number, seed: string) => {
  const pts: [number, number][] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / bump));
    for (let i = 0; i < n; i++) {
      const k = i / n;
      pts.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]);
    }
  };
  edge(0, 0, w, 0);
  edge(w, 0, w, h);
  edge(w, h, 0, h);
  edge(0, h, 0, 0);
  const jit = (i: number) => seeded(`${seed}-${i}`, -0.12, 0.12) * bump;
  const p = pts.map(([x, y], i) => [x + jit(i), y + jit(i + 99)] as [number, number]);
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 1; i <= p.length; i++) {
    const [x, y] = p[i % p.length];
    const r = (bump * seeded(`${seed}-r${i}`, 0.55, 0.7)).toFixed(1);
    d += ` A${r},${r} 0 0,1 ${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
};

/** Cụm nhấn: chữ đổi màu nhấn, đám mây tự vẽ quanh, tam giác "!" bật ra ở góc trên phải. */
const PunchSpan: React.FC<{
  shown: string;
  hidden: string;
  full: string;
  t: number;
  size: number;
  accent: string;
  seed: string;
  decoration: React.CSSProperties;
}> = ({ shown, hidden, full, t, size, accent, seed, decoration }) => {
  const estW = chars(full).length * size * CHAR_W + size * 0.3;
  const estH = size * 1.25;
  const padX = size * 0.28;
  const padY = size * 0.2;
  const cloud = cloudPath(estW + padX * 2, estH + padY * 2, size * 0.42, seed);
  const draw = Math.min(1, t / 0.7);
  const tri = POP(Math.max(0, Math.min(1, (t - 0.6) / 0.4)));
  const color = t > 0 ? accent : C.ink;
  return (
    <span style={{ position: "relative", display: "inline-block", padding: `0 ${(size * 0.1).toFixed(1)}px`, margin: `0 ${(size * 0.18).toFixed(1)}px 0 ${(size * 0.1).toFixed(1)}px` }}>
      <span style={{ color, fontWeight: 700, ...decoration, textDecorationColor: withAlpha(accent, 0.7) }}>{shown}</span>
      <span style={{ opacity: 0, fontWeight: 700 }}>{hidden}</span>
      {t > 0 ? (
        <svg
          viewBox={`${-padX * 0.2} ${-padY * 0.2} ${estW + padX * 2.4} ${estH + padY * 2.4}`}
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: -padX * 0.6,
            // Vừa khít chiều cao dòng (line-height 1.46): không lấn chữ dòng trên/dưới.
            top: size * 0.1,
            width: `calc(100% + ${(padX * 1.2).toFixed(1)}px)`,
            height: size * 1.34,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <path
            d={cloud}
            fill="none"
            stroke={accent}
            strokeWidth={Math.max(1.5, size * 0.06)}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - draw}
          />
        </svg>
      ) : null}
      {tri > 0 ? (
        <svg
          width={size * 0.64}
          height={size * 0.58}
          viewBox="0 0 40 36"
          style={{ position: "absolute", right: -size * 0.62, top: -size * 0.18, scale: String(tri), overflow: "visible" }}
        >
          <path d="M20,2 L38,34 L2,34 Z" fill={C.paperDeep} stroke={accent} strokeWidth={3.2} strokeLinejoin="round" />
          <text x={20} y={27} fill={accent} fontFamily={LABEL} fontWeight={800} fontSize={22} textAnchor="middle">
            !
          </text>
        </svg>
      ) : null}
    </span>
  );
};

/** Một câu ghi chú đang gõ: số tròn + chữ; chữ chưa gõ vẫn giữ chỗ (trong suốt) nên dòng không nhảy khi gõ. */
const NoteRow: React.FC<{
  n: number;
  item: NoteItem;
  frame: number;
  size: number;
  unit: number;
  dim: number;
  accent: string;
  punch: { range: [number, number]; at: number } | null;
  seed: string;
}> = ({ n, item, frame, size, unit, dim, accent, punch, seed }) => {
  const list = chars(item.text);
  const dur = typeFrames(item);
  const count = Math.floor(interpolate(frame, [item.start, item.start + dur], [0, list.length], clamp));
  const typing = count < list.length;
  const inT = ramp(frame, item.start, 8);
  const decoration: React.CSSProperties = {
    textDecorationLine: "underline",
    textDecorationThickness: Math.max(1, 1.4 * unit),
    textUnderlineOffset: "0.3em",
    textDecorationColor: C.faint,
  };
  const seg = (from: number, to: number) => {
    const shown = list.slice(from, Math.max(from, Math.min(to, count))).join("");
    const hidden = list.slice(Math.max(from, Math.min(to, count)), to).join("");
    return { shown, hidden, full: list.slice(from, to).join("") };
  };
  const parts = punch ? [seg(0, punch.range[0]), seg(punch.range[0], punch.range[1]), seg(punch.range[1], list.length)] : [seg(0, list.length)];
  // Cụm nhấn hiện khi đã gõ tới hết cụm và giọng đọc tới `atMs`.
  const punchStart = punch
    ? Math.max(punch.at, item.start + (dur * punch.range[1]) / Math.max(1, list.length))
    : Infinity;
  const punchT = punch ? interpolate(frame, [punchStart, punchStart + 20], [0, 1], clamp) : 0;
  const circle = size * 1.02;
  const caret = typing ? (
    <span
      style={{
        display: "inline-block",
        width: Math.max(2, 3 * unit),
        height: size * 1.05,
        // Lề âm bằng bề rộng: con trỏ không chiếm chỗ nên dòng không xuống dòng lại khi nó biến mất.
        marginRight: -Math.max(2, 3 * unit),
        verticalAlign: "-0.18em",
        backgroundColor: C.ink,
      }}
    />
  ) : null;
  const plain = (p: { shown: string; hidden: string }, key: string, withCaret: boolean) => (
    <span key={key}>
      <span style={decoration}>{p.shown}</span>
      {withCaret ? caret : null}
      <span style={{ opacity: 0 }}>{p.hidden}</span>
    </span>
  );
  // Con trỏ nằm ở đoạn đang được gõ.
  const bounds = punch ? [punch.range[0], punch.range[1], list.length] : [list.length];
  const caretIn = bounds.findIndex((b) => count < b || (b === list.length && count <= b));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: size * 0.45,
        opacity: inT * dim,
        translate: `0 ${((1 - inT) * 10 * unit).toFixed(1)}px`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: circle,
          height: circle,
          marginTop: (size * LINE_H - circle) / 2,
          borderRadius: circle,
          border: `${Math.max(1, 2 * unit)}px solid ${C.ink}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: LABEL,
          fontWeight: 700,
          fontSize: size * 0.56,
          color: C.ink,
          scale: String(Math.min(1.1, POP(inT))),
        }}
      >
        {n}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: NOTE,
          fontWeight: 500,
          fontSize: size,
          lineHeight: LINE_H,
          color: C.ink,
          letterSpacing: "0.012em",
          overflowWrap: "anywhere",
        }}
      >
        {parts.map((p, i) =>
          punch && i === 1 ? (
            <PunchSpan
              key={i}
              shown={p.shown}
              hidden={p.hidden}
              full={p.full}
              t={punchT}
              size={size}
              accent={accent}
              seed={seed}
              decoration={decoration}
            />
          ) : (
            plain(p, String(i), caretIn === i)
          ),
        )}
      </div>
    </div>
  );
};

/** Dòng ghi chú sửa đổi riêng khi cụm nhấn không khớp nguyên văn câu nào của cảnh. */
const RevisionNote: React.FC<{ text: string; at: number; frame: number; size: number; unit: number; accent: string; seed: string }> = ({
  text,
  at,
  frame,
  size,
  unit,
  accent,
  seed,
}) => {
  const vt = useVt();
  const t = interpolate(frame, [at, at + 20], [0, 1], clamp);
  if (t <= 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: size * 0.4, opacity: Math.min(1, t * 3), paddingTop: size * 0.4 }}>
      <span style={{ fontFamily: MONO, fontSize: size * 0.5, color: accent, letterSpacing: "0.1em", flexShrink: 0 }}>{vt("GHI CHÚ")} ⚠</span>
      <span style={{ fontFamily: NOTE, fontSize: size, lineHeight: LINE_H, color: C.ink }}>
        <PunchSpan shown={text} hidden="" full={text} t={t} size={size} accent={accent} seed={seed} decoration={{}} />
      </span>
      <span style={{ width: 20 * unit }} />
    </div>
  );
};

/**
 * Khối ghi chú của một cảnh. Cỡ chữ chọn một lần cho cả cảnh (theo mọi câu của cảnh) để chữ không co giãn giữa chừng;
 * cảnh quá nhiều chữ thì chỉ giữ các câu mới nhất, câu cũ trôi khỏi đầu khối.
 */
export const NotesBlock: React.FC<{
  items: NoteItem[];
  box: Box;
  frame: number;
  unit: number;
  base: number;
  accent: string;
  punch: { text: string; at: number } | null;
  sceneIndex: number;
  opacity: number;
}> = ({ items, box, frame, unit, base, accent, punch, sceneIndex, opacity }) => {
  const vt = useVt();
  const header = 34 * unit;
  const textW = (size: number) => box.w - size * 1.5;
  const linesOf = (list: NoteItem[], size: number) =>
    list.reduce((sum, it) => sum + estimateLines(it.text, size, textW(size), CHAR_W), 0);
  const heightOf = (list: NoteItem[], size: number) => linesOf(list, size) * size * LINE_H + Math.max(0, list.length - 1) * size * 0.5;
  const avail = box.h - header - (punch ? base * 0.4 : 0);
  const min = 30 * unit;
  let size = base;
  while (size > min && heightOf(items, size) > avail) size *= 0.95;
  size = Math.max(min, size);

  const matched = punch ? items.findIndex((it) => punchRange(it.text, punch.text)) : -1;
  const visible = items.map((it, i) => ({ it, i })).filter(({ it }) => it.start <= frame);
  // Không vừa: bỏ dần câu cũ nhất (chỉ trong các câu đang hiện).
  let shown = visible;
  while (shown.length > 1 && heightOf(shown.map((s) => s.it), size) > avail) shown = shown.slice(1);
  const current = visible.length - 1;
  const fallback = punch && matched < 0 ? punch : null;

  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 17 * unit,
          letterSpacing: "0.14em",
          color: C.soft,
          height: header,
          display: "flex",
          alignItems: "flex-start",
          gap: 12 * unit,
        }}
      >
        <span>{vt("GHI CHÚ")}</span>
        <span style={{ flex: 1, borderTop: `${Math.max(1, unit)}px dashed ${C.faint}`, marginTop: 11 * unit }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: size * 0.5 }}>
        {shown.map(({ it, i }) => (
          <NoteRow
            key={i}
            n={i + 1}
            item={it}
            frame={frame}
            size={size}
            unit={unit}
            dim={i === visible[current]?.i ? 1 : 0.62 + 0.38 * (1 - ramp(frame, visible[visible.findIndex((v) => v.i === i) + 1]?.it.start ?? Infinity, 8))}
            accent={accent}
            punch={punch && i === matched ? { range: punchRange(it.text, punch.text)!, at: punch.at } : null}
            seed={`bp-cloud-${sceneIndex}-${i}`}
          />
        ))}
      </div>
      {fallback ? <RevisionNote text={fallback.text} at={fallback.at} frame={frame} size={size} unit={unit} accent={accent} seed={`bp-rev-${sceneIndex}`} /> : null}
    </div>
  );
};
