/**
 * Vẽ từng dòng của phiên terminal: lệnh đang gõ, chú thích, output, câu nhấn nhiễu, thanh tiến độ ASCII, tiêu đề lớn.
 * Mọi dòng đều là khối chữ tự xuống dòng — cột lịch sử neo đáy nên dòng mới đẩy dòng cũ lên như terminal thật.
 */
import { interpolate } from "remotion";
import type { SceneVisual } from "../../compositions/Short/schema";
import { seeded } from "../shared";
import type { Entry } from "./session";
import { brightAccent, C, chars, clamp, DISPLAY, inkOn, ramp, withAlpha } from "./theme";

type Ctx = { frame: number; font: number; unit: number; accent: string; innerW: number };

/** Con trỏ khối. Đang gõ thì sáng liên tục, đứng chờ thì nhấp nháy nửa giây một lần. */
export const Cursor: React.FC<{ frame: number; solid: boolean }> = ({ frame, solid }) => (
  <span
    style={{
      display: "inline-block",
      width: "0.6em",
      height: "1.1em",
      marginLeft: "0.08em",
      verticalAlign: "-0.2em",
      backgroundColor: C.text,
      opacity: solid || Math.floor(frame / 15) % 2 === 0 ? 0.9 : 0,
    }}
  />
);

const Prompt: React.FC = () => <span style={{ color: C.green, fontWeight: 700 }}>$ </span>;

/** Dòng có dấu nhắc: thụt treo 2 ký tự để dòng xuống hàng thẳng cột với chữ, không thẳng với "$". */
const promptLine = { paddingLeft: "1.2em", textIndent: "-1.2em" } as const;

/**
 * Tô màu cú pháp cho câu lệnh: cụm punch → accent đậm, con số → vàng hổ phách, "trong ngoặc kép" → xanh lá.
 * Trả về các đoạn đã cắt tới `count` ký tự (phần đã gõ).
 */
const colorize = (text: string, punch: string | null, accent: string, count: number) => {
  const list = chars(text);
  const colors: (string | null)[] = list.map(() => null);
  const bold: boolean[] = list.map(() => false);
  const joined = list.join("");
  const mark = (re: RegExp, color: string, strong = false) => {
    for (const m of joined.matchAll(re)) {
      // matchAll trả chỉ số theo UTF-16; tiếng Việt NFC đều nằm trong BMP nên trùng chỉ số ký tự.
      const from = m.index ?? 0;
      for (let k = from; k < from + m[0].length && k < list.length; k++) {
        colors[k] = color;
        bold[k] = strong;
      }
    }
  };
  mark(/\d[\d.,]*\s?%?/g, C.amber);
  mark(/["“][^"”]+["”]/g, C.green);
  if (punch) {
    const at = joined.toLowerCase().indexOf(punch.normalize("NFC").toLowerCase());
    if (at >= 0) {
      for (let k = at; k < at + chars(punch).length; k++) {
        colors[k] = brightAccent(accent);
        bold[k] = true;
      }
    }
  }
  const parts: { text: string; color: string | null; bold: boolean }[] = [];
  list.slice(0, count).forEach((ch, k) => {
    const last = parts[parts.length - 1];
    if (last && last.color === colors[k] && last.bold === bold[k]) last.text += ch;
    else parts.push({ text: ch, color: colors[k], bold: bold[k] });
  });
  return parts;
};

const CmdLine: React.FC<{ entry: Extract<Entry, { kind: "cmd" }>; ctx: Ctx; cursor: boolean }> = ({ entry, ctx, cursor }) => {
  const total = chars(entry.text).length;
  const count = Math.round(interpolate(ctx.frame, [entry.start, Math.max(entry.start + 1, entry.typeEnd)], [0, total], clamp));
  const parts = colorize(entry.text, entry.punch, ctx.accent, count);
  return (
    <div style={promptLine}>
      <Prompt />
      {parts.map((p, k) => (
        <span key={k} style={{ color: p.color ?? C.text, fontWeight: p.bold ? 700 : 400 }}>
          {p.text}
        </span>
      ))}
      {cursor ? <Cursor frame={ctx.frame} solid={ctx.frame < entry.typeEnd + 4} /> : null}
    </div>
  );
};

/** Hiệu ứng nhiễu ngắn lúc một dòng vừa bật ra: rung ngang, lệch kênh đỏ/xanh, cắt lát. */
const glitch = (frame: number, start: number, unit: number, key: string, length = 9) => {
  const g = frame - start;
  if (g < 0 || g >= length) return {};
  const power = 1 - g / length;
  const dx = seeded(`${key}-dx-${g}`, -1, 1) * 14 * unit * power;
  const top = seeded(`${key}-t-${g}`, 0, 45);
  const bottom = seeded(`${key}-b-${g}`, 0, 45);
  return {
    transform: `translateX(${dx.toFixed(1)}px)`,
    textShadow: `${(-4 * unit * power).toFixed(1)}px 0 rgba(255, 0, 90, 0.85), ${(4 * unit * power).toFixed(1)}px 0 rgba(0, 235, 255, 0.85)`,
    clipPath: g % 3 === 1 ? `inset(${top.toFixed(0)}% 0 ${bottom.toFixed(0)}% 0)` : undefined,
  };
};

const PunchLine: React.FC<{ entry: Extract<Entry, { kind: "punch" }>; ctx: Ctx }> = ({ entry, ctx }) => {
  const g = ctx.frame - entry.start;
  // Chớp sáng hai frame đầu rồi dịu về nền accent.
  const flash = interpolate(g, [0, 2, 8], [1, 1, 0], clamp);
  return (
    <div style={{ paddingTop: 0.15 * ctx.font, paddingBottom: 0.15 * ctx.font }}>
      <span
        style={{
          display: "inline",
          backgroundColor: ctx.accent,
          color: inkOn(ctx.accent),
          fontWeight: 700,
          padding: `0.08em 0.35em`,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          lineHeight: 1.55,
          boxShadow: `0 0 ${(28 * ctx.unit).toFixed(1)}px ${withAlpha(ctx.accent, 0.35 + flash * 0.4)}`,
          filter: flash > 0 ? `brightness(${(1 + flash * 0.6).toFixed(2)})` : undefined,
          ...glitch(ctx.frame, entry.start, ctx.unit, `punch-${entry.start}`),
        }}
      >
        ✔ {entry.text}
      </span>
    </div>
  );
};

const PERCENT = /^\s*(\d+(?:[.,]\d+)?)\s*%\s*$/;
const BAR_CELLS = 10;

const VisualLine: React.FC<{ visual: SceneVisual; start: number; ctx: Ctx }> = ({ visual, start, ctx }) => {
  const t = ramp(ctx.frame, start, 20);
  const note = visual.caption ? (
    <div style={{ color: C.dim, fontSize: ctx.font * 0.85, paddingLeft: "1.2em", textIndent: "-1.2em", marginTop: 0.1 * ctx.font }}>{`↳ ${visual.caption}`}</div>
  ) : null;
  const accent = brightAccent(ctx.accent);

  if (visual.type === "badge") {
    return (
      <div style={{ paddingTop: 0.2 * ctx.font, paddingBottom: 0.1 * ctx.font }}>
        <span
          style={{
            backgroundColor: C.green,
            color: "#0b0e13",
            fontWeight: 700,
            padding: "0.1em 0.45em",
            opacity: ramp(ctx.frame, start, 4),
            ...glitch(ctx.frame, start, ctx.unit, `badge-${start}`, 6),
          }}
        >
          {`[ ${visual.text.normalize("NFC").toLocaleUpperCase("vi")} ]`}
        </span>
        {note}
      </div>
    );
  }

  const pct = visual.text.match(PERCENT);
  if (pct) {
    // Thanh tiến độ ASCII chạy tới đúng phần trăm, con số đếm theo.
    const target = Math.max(0, Math.min(100, parseFloat(pct[1].replace(",", "."))));
    const value = target * t;
    const filled = Math.round((value / 100) * BAR_CELLS);
    const shown = pct[1].includes(".") || pct[1].includes(",") ? value.toFixed(1).replace(".", pct[1].includes(",") ? "," : ".") : Math.round(value).toString();
    return (
      <div style={{ paddingTop: 0.2 * ctx.font, paddingBottom: 0.1 * ctx.font }}>
        <div style={{ fontSize: ctx.font * 1.25, fontWeight: 700, whiteSpace: "nowrap" }}>
          <span style={{ color: C.dim }}>[</span>
          <span style={{ color: accent, textShadow: `0 0 ${(14 * ctx.unit).toFixed(1)}px ${withAlpha(ctx.accent, 0.6)}` }}>{"█".repeat(filled)}</span>
          <span style={{ color: "rgba(255,255,255,0.18)" }}>{"░".repeat(BAR_CELLS - filled)}</span>
          <span style={{ color: C.dim }}>]</span>
          <span style={{ color: C.text }}>{` ${shown}%`}</span>
        </div>
        {note}
      </div>
    );
  }

  // Số lớn: chữ mono cỡ to, co cho vừa bề ngang terminal.
  const text = visual.text.normalize("NFC");
  const size = Math.min(ctx.font * 2.6, ctx.innerW / (chars(text).length * 0.62 + 0.5));
  const shownChars = Math.round(chars(text).length * ramp(ctx.frame, start, 8));
  return (
    <div style={{ paddingTop: 0.1 * ctx.font }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.25,
          color: accent,
          whiteSpace: "nowrap",
          textShadow: `0 0 ${(22 * ctx.unit).toFixed(1)}px ${withAlpha(ctx.accent, 0.55)}`,
        }}
      >
        {chars(text).slice(0, shownChars).join("")}
      </div>
      {note}
    </div>
  );
};

/** Tiêu đề mở đầu: chữ đậm in hoa, bóng khối lệch như chữ ASCII art, gạch "═" bên dưới. */
const TitleBlock: React.FC<{ text: string; start: number; ctx: Ctx }> = ({ text, start, ctx }) => {
  const upper = text.normalize("NFC").toLocaleUpperCase("vi");
  const len = chars(upper).length;
  // Ước lượng 2–3 dòng: chữ ngắn thì to, chữ dài co lại (hệ số bề rộng ~0.68 em cho chữ in hoa đậm).
  const lines = len <= 12 ? 1 : len <= 30 ? 2 : 3;
  const size = Math.min(ctx.font * 2.3, (ctx.innerW * lines) / (len * 0.7 + 1));
  const accent = brightAccent(ctx.accent);
  const d = Math.max(2, 4 * ctx.unit);
  const rule = Math.floor(ctx.innerW / (ctx.font * 0.6));
  const reveal = ramp(ctx.frame, start + 4, 10);
  return (
    <div style={{ paddingTop: 0.35 * ctx.font, paddingBottom: 0.2 * ctx.font }}>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.22,
          color: accent,
          textShadow: `${d}px ${d}px 0 ${withAlpha(ctx.accent, 0.35)}, ${d * 2}px ${d * 2}px 0 rgba(255,255,255,0.06)`,
          ...glitch(ctx.frame, start, ctx.unit, `title-${start}`, 8),
        }}
      >
        {upper}
      </div>
      <div style={{ color: C.dim, whiteSpace: "nowrap", overflow: "hidden", marginTop: 0.2 * ctx.font, width: `${(reveal * 100).toFixed(1)}%` }}>
        {"═".repeat(rule)}
      </div>
    </div>
  );
};

export const Line: React.FC<{ entry: Entry; ctx: Ctx; cursor: boolean }> = ({ entry, ctx, cursor }) => {
  switch (entry.kind) {
    case "cmd":
      return <CmdLine entry={entry} ctx={ctx} cursor={cursor} />;
    case "out":
      return <div style={{ color: entry.ok ? C.green : C.dim }}>{entry.text}</div>;
    case "comment":
      return (
        <div style={{ color: C.dim, ...promptLine, paddingTop: entry.mark === "#" ? 0.25 * ctx.font : 0 }}>
          <span style={{ color: withAlpha("#8b949e", 0.8) }}>{`${entry.mark} `}</span>
          <span style={{ fontStyle: "italic" }}>{entry.text}</span>
        </div>
      );
    case "title":
      return <TitleBlock text={entry.text} start={entry.start} ctx={ctx} />;
    case "punch":
      return <PunchLine entry={entry} ctx={ctx} />;
    case "visual":
      return <VisualLine visual={entry.visual} start={entry.start} ctx={ctx} />;
  }
};

/** Dòng nhắc trống chờ lệnh tiếp theo. */
export const IdlePrompt: React.FC<{ frame: number }> = ({ frame }) => (
  <div>
    <Prompt />
    <Cursor frame={frame} solid={false} />
  </div>
);
