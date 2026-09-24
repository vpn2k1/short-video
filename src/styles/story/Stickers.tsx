/**
 * Nhãn dán của story: phụ đề là nhãn chữ trên khối màu bo góc (nghiêng nhẹ, bật lên từng câu), tiêu đề là
 * nhãn chữ đầu tiên, `tag` là nhãn vị trí / nhắc tên, `visual` là nhãn đếm ngược / nhãn "thêm của bạn",
 * `punch` là nhãn thăm dò ý kiến (câu kết bằng "?") hoặc nhãn GIF kèm mưa emoji.
 * Mọi kích thước tính bằng px của canvas ảo (xem theme.ts).
 */
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene, SceneVisual } from "../../compositions/Short/schema";
import { parseStat } from "../retro/vhs";
import { activeIndexAt, seeded, useCaptionClock } from "../shared";
import { CUBE_FRAMES } from "./Frames";
import {
  appearAt,
  clamp,
  GIF,
  headerBottom,
  inkOn,
  isPoll,
  punchFrame,
  reactionEmoji,
  shrink,
  textGradient,
  UI,
  upperVi,
  useGeo,
  VW,
} from "./theme";
import { useVideoLanguage, useVt, videoLocale } from "../../i18n/video";

/** Độ bật (0 → ~1.1 → 1) của nhãn dán tính từ frame xuất hiện. */
const usePop = (t: number) => {
  const { fps } = useVideoConfig();
  if (t < 0) return 0;
  return spring({ frame: t, fps, config: { damping: 11, stiffness: 210, mass: 0.7 } });
};

/** Khối chữ kiểu nhãn story: mỗi dòng một khối màu bo góc (box-decoration-break: clone). */
const TextBlock: React.FC<{ text: string; size: number; bg: string; ink: string; weight?: number }> = ({
  text,
  size,
  bg,
  ink,
  weight = 800,
}) => (
  <span
    style={{
      background: bg,
      color: ink,
      fontFamily: UI,
      fontWeight: weight,
      fontSize: size,
      padding: "0.1em 0.4em",
      borderRadius: "0.3em",
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
    }}
  >
    {text}
  </span>
);

/** Phần còn lại của câu khi bỏ cụm nhấn — ngắn thì nhãn thăm dò đã đủ nói thay câu đó. */
const remainderLength = (text: string, punch: string) => {
  const hay = text.normalize("NFC").toLocaleLowerCase("vi");
  const needle = punch.normalize("NFC").trim().toLocaleLowerCase("vi");
  const rest = needle && hay.includes(needle) ? hay.replace(needle, "") : hay;
  return (rest.match(/[\p{L}\p{N}]/gu) ?? []).length;
};

/* ------------------------------------------------------------ phụ đề */

/**
 * Mỗi câu phụ đề là một nhãn chữ giữa màn hình: câu chẵn chữ trên khối màu nhấn, câu lẻ chữ đen trên khối
 * trắng; nghiêng ±3.5° và lệch nhẹ theo seed. Có câu nhấn thì nhãn nhích lên chừa chỗ. Cảnh không ảnh (chế độ
 * "Tạo"): chữ trắng to không khối, giữa nền gradient.
 */
export const CaptionSticker: React.FC<{ captions: Caption[]; scenes: Scene[]; showTitle: boolean; accent: string }> = ({
  captions,
  scenes,
  showTitle,
  accent,
}) => {
  const frame = useCurrentFrame();
  const geo = useGeo();
  const { caption, index, startFrame } = useCaptionClock(captions);
  const on = showTitle ? Math.max(startFrame, TITLE_FRAMES) : startFrame;
  const pop = usePop(frame - on);
  const text = caption?.text.normalize("NFC").trim() ?? "";
  if (!caption || !text || frame < on) return null;

  const sceneIndex = activeIndexAt(scenes, frame);
  const scene = sceneIndex >= 0 ? scenes[sceneIndex] : null;
  const pf = scene ? punchFrame(scene, sceneIndex, showTitle) : null;
  const punchOn = pf !== null && frame >= pf;
  // Nhãn thăm dò đã chứa câu hỏi: câu phụ đề gần như trùng thì nhường chỗ.
  if (punchOn && scene?.punch && isPoll(scene.punch.text) && remainderLength(text, scene.punch.text) < 14) return null;

  const create = Boolean(scene && !scene.image);
  const y = geo.vh * (punchOn ? 0.39 : 0.47 + (create ? 0 : seeded(`story-cap-y-${index}`, -0.03, 0.03)));
  const x = create ? 0 : seeded(`story-cap-x-${index}`, -28, 28);
  const rotate = create ? 0 : seeded(`story-cap-r-${index}`, -3.5, 3.5);
  const light = index % 2 === 1;
  const scale = 0.5 + 0.5 * pop;
  const opacity = interpolate(frame - on, [0, 3], [0, 1], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: VW,
        top: y,
        display: "flex",
        justifyContent: "center",
        translate: `${x}px -50%`,
      }}
    >
      <div
        style={{
          maxWidth: create ? 900 : 880,
          textAlign: "center",
          lineHeight: create ? 1.32 : 1.52,
          rotate: `${rotate}deg`,
          scale: String(scale),
          opacity,
        }}
      >
        {create ? (
          <span
            style={{
              fontFamily: UI,
              fontWeight: 800,
              fontSize: shrink(text, 100, 20, 0.52),
              color: "#fff",
              textShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}
          >
            {text}
          </span>
        ) : (
          <TextBlock
            text={text}
            size={shrink(text, 72, 26, 0.62)}
            bg={light ? "#fff" : accent}
            ink={light ? "#111" : inkOn(accent)}
          />
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ tiêu đề */

/** Tiêu đề là nhãn chữ đầu tiên của story (khối màu nhấn), dòng phụ là nhãn trắng nhỏ bên dưới. */
export const TitleStickers: React.FC<{ title: string; subtitle: string; accent: string }> = ({ title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const geo = useGeo();
  const popTitle = usePop(frame - 26);
  const popSub = usePop(frame - 34);
  const exit = interpolate(frame, [TITLE_FRAMES - 9, TITLE_FRAMES - 1], [1, 0], clamp);
  const t = title.normalize("NFC").trim();
  const s = subtitle.normalize("NFC").trim();
  if (frame < 26 || (!t && !s)) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: VW,
        top: geo.vh * 0.45,
        translate: "0 -50%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
        opacity: exit,
        scale: String(0.7 + 0.3 * exit),
      }}
    >
      {t ? (
        <div style={{ maxWidth: 900, textAlign: "center", lineHeight: 1.5, rotate: "-2.5deg", scale: String(0.4 + 0.6 * popTitle) }}>
          <TextBlock text={t} size={shrink(t, 100, 16, 0.56)} bg={accent} ink={inkOn(accent)} />
        </div>
      ) : null}
      {s && frame >= 34 ? (
        <div style={{ maxWidth: 820, textAlign: "center", lineHeight: 1.5, rotate: "2deg", scale: String(0.4 + 0.6 * popSub) }}>
          <TextBlock text={s} size={shrink(s, 50, 26, 0.7)} bg="#fff" ink="#111" weight={700} />
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------ tag */

const PinIcon: React.FC<{ size: number; id: string; accent: string }> = ({ size, id, accent }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={accent} />
        <stop offset="0.6" stopColor="#ff3d7f" />
        <stop offset="1" stopColor="#a93dff" />
      </linearGradient>
    </defs>
    <path d="M12 2.2c-4 0-7.2 3.1-7.2 7 0 5.2 7.2 12.6 7.2 12.6s7.2-7.4 7.2-12.6c0-3.9-3.2-7-7.2-7zm0 9.8a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z" fill={`url(#${id})`} />
  </svg>
);

/**
 * `tag` là nhãn trắng góc trên trái: "@tên" → nhãn nhắc tên, "#…" → nhãn hashtag, còn lại → nhãn vị trí có ghim.
 * Chữ gradient in hoa, nghiêng -4°, bật vào sau cú xoay cảnh.
 */
export const TagSticker: React.FC<{ scenes: Scene[]; showTitle: boolean; accent: string }> = ({ scenes, showTitle, accent }) => {
  const frame = useCurrentFrame();
  const geo = useGeo();
  const index = activeIndexAt(scenes, frame);
  const scene = index >= 0 ? scenes[index] : null;
  const start = scene ? msToFrames(scene.startMs) : 0;
  const on = appearAt(index, start, showTitle) + (index > 0 ? CUBE_FRAMES : 4);
  const pop = usePop(frame - on);
  const raw = scene?.tag?.normalize("NFC").trim() ?? "";
  if (!scene || !raw || frame < on) return null;
  const mention = raw.startsWith("@");
  const hashtag = raw.startsWith("#");
  const text = upperVi(raw);
  const maxWidth = scene.visual ? VW - 56 * 2 - 390 - 24 : 760;
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        top: headerBottom(geo) + 40,
        maxWidth,
        transformOrigin: "left center",
        rotate: "-4deg",
        scale: String(0.4 + 0.6 * pop),
        opacity: interpolate(frame - on, [0, 3], [0, 1], clamp),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 28px 14px 20px",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
        }}
      >
        {mention || hashtag ? null : <PinIcon size={50} id={`story-pin-${index}`} accent={accent} />}
        <span
          style={{
            fontFamily: UI,
            fontWeight: 800,
            fontSize: shrink(raw, 46, 14, 0.62),
            lineHeight: 1.35,
            background: textGradient(accent),
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            paddingLeft: mention || hashtag ? 8 : 0,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ visual */

const BellIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#333">
    <path d="M12 2.5c-3.6 0-6.2 2.8-6.2 6.4v3.6L4 15.6v1.2h16v-1.2l-1.8-3.1V8.9c0-3.6-2.6-6.4-6.2-6.4zM9.6 18.2a2.4 2.4 0 0 0 4.8 0H9.6z" />
  </svg>
);

/** Số chạy từ 0 tới giá trị thật, giữ đủ chữ số như đồng hồ đếm ("00" → "80"). */
const runningNumber = (raw: string, t: number) => {
  const stat = parseStat(raw);
  if (!stat) return { text: raw.normalize("NFC"), digits: null as string | null, prefix: "", suffix: "" };
  const final = stat.format(stat.value);
  let now = stat.format(stat.value * t);
  const plain = /^\d+$/.test(final);
  if (plain) now = now.padStart(final.length, "0");
  return { text: `${stat.prefix}${now}${stat.suffix}`, digits: plain && final.length <= 4 ? now : null, prefix: stat.prefix, suffix: stat.suffix };
};

/**
 * `visual` stat → nhãn đếm ngược: thẻ trắng, dòng chú thích in hoa, con số trong các ô chữ số (chạy từ 0),
 * nút "Nhắc tôi". `visual` badge → nhãn "thêm của bạn": viên gradient mang chữ + chú thích bên dưới.
 * Góc trên phải, nghiêng 4°.
 */
export const VisualSticker: React.FC<{ scenes: Scene[]; showTitle: boolean; accent: string }> = ({ scenes, showTitle, accent }) => {
  const frame = useCurrentFrame();
  const geo = useGeo();
  const index = activeIndexAt(scenes, frame);
  const scene = index >= 0 ? scenes[index] : null;
  const start = scene ? msToFrames(scene.startMs) : 0;
  const on = appearAt(index, start, showTitle) + (index > 0 ? CUBE_FRAMES + 6 : 10);
  const pop = usePop(frame - on);
  const visual: SceneVisual | null = scene?.visual ?? null;
  if (!scene || !visual || frame < on) return null;
  const t = interpolate(frame - on, [4, 34], [0, 1], { ...clamp, easing: (x) => 1 - (1 - x) ** 3 });
  return (
    <div
      style={{
        position: "absolute",
        right: 56,
        top: headerBottom(geo) + 26,
        width: 390,
        transformOrigin: "right top",
        rotate: "4deg",
        scale: String(0.4 + 0.6 * pop),
        opacity: interpolate(frame - on, [0, 3], [0, 1], clamp),
        fontFamily: UI,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 36,
          padding: "26px 26px 24px",
          boxShadow: "0 14px 36px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        {visual.type === "stat" ? <StatBody visual={visual} t={t} accent={accent} /> : <BadgeBody visual={visual} accent={accent} />}
      </div>
    </div>
  );
};

const StatBody: React.FC<{ visual: SceneVisual; t: number; accent: string }> = ({ visual, t, accent }) => {
  const vt = useVt();
  const label = upperVi(visual.caption?.trim() || vt("Đếm ngược"));
  const n = runningNumber(visual.text, t);
  const gradientText: React.CSSProperties = {
    background: textGradient(accent),
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
  return (
    <>
      <div style={{ fontSize: shrink(label, 30, 16, 0.75), fontWeight: 800, color: "#1a1a1a", textAlign: "center", lineHeight: 1.35 }}>
        {label}
      </div>
      {n.digits ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {n.prefix ? <span style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.2, ...gradientText }}>{n.prefix}</span> : null}
          {Array.from(n.digits).map((d, i) => (
            <div
              key={i}
              style={{
                width: n.digits!.length > 3 ? 66 : 78,
                height: 108,
                borderRadius: 16,
                background: "#e9e9f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 78,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.2,
              }}
            >
              <span style={{ ...gradientText }}>{d}</span>
            </div>
          ))}
          {n.suffix.trim() ? (
            <span style={{ fontSize: shrink(n.suffix.trim(), 66, 3, 0.5), fontWeight: 800, lineHeight: 1.2, ...gradientText }}>{n.suffix.trim()}</span>
          ) : null}
        </div>
      ) : (
        <div style={{ fontSize: shrink(n.text, 84, 6, 0.5), fontWeight: 800, lineHeight: 1.2, textAlign: "center", ...gradientText }}>{n.text}</div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 24px",
          borderRadius: 999,
          background: "#f0f0f5",
          fontSize: 28,
          fontWeight: 700,
          color: "#333",
        }}
      >
        <BellIcon size={30} />
        {vt("Nhắc tôi")}
      </div>
    </>
  );
};

const BadgeBody: React.FC<{ visual: SceneVisual; accent: string }> = ({ visual, accent }) => {
  const vt = useVt();
  return (
    <>
      <div
        style={{
          padding: "12px 30px",
          borderRadius: 999,
          background: `linear-gradient(95deg, ${accent}, #ff3d7f)`,
          color: "#fff",
          fontSize: shrink(visual.text, 44, 10, 0.65),
          fontWeight: 800,
          lineHeight: 1.3,
          textAlign: "center",
        }}
      >
        {visual.text.normalize("NFC")}
      </div>
      {visual.caption ? (
        <div style={{ fontSize: shrink(visual.caption, 34, 18, 0.72), fontWeight: 700, color: "#1a1a1a", textAlign: "center", lineHeight: 1.35 }}>
          {visual.caption.normalize("NFC")}
        </div>
      ) : null}
      <div style={{ fontSize: 26, fontWeight: 600, color: "#888" }}>{vt("Thêm của bạn ›")}</div>
    </>
  );
};

/* ------------------------------------------------------------ punch */

/**
 * Câu nhấn của cảnh, hiện đúng `atMs` tới hết cảnh, ở khoảng 2/3 màn hình:
 * kết bằng "?" → nhãn thăm dò "Có 👍 / Không 👎" (bấm chọn rồi thanh phần trăm chạy); còn lại → nhãn GIF
 * chữ tròn viền màu nhấn lắc theo nhịp giật, kèm chùm emoji bung ra.
 */
export const PunchSticker: React.FC<{ scenes: Scene[]; showTitle: boolean; accent: string }> = ({ scenes, showTitle, accent }) => {
  const frame = useCurrentFrame();
  const index = activeIndexAt(scenes, frame);
  const scene = index >= 0 ? scenes[index] : null;
  const pf = scene ? punchFrame(scene, index, showTitle) : null;
  const pop = usePop(pf === null ? -1 : frame - pf);
  if (!scene?.punch || pf === null || frame < pf) return null;
  const text = scene.punch.text.normalize("NFC").trim();
  if (!text) return null;
  return isPoll(text) ? (
    <Poll text={text} t={frame - pf} pop={pop} accent={accent} />
  ) : (
    <GifSticker text={text} t={frame - pf} pop={pop} accent={accent} />
  );
};

const VOTE_AT = 22;

const Poll: React.FC<{ text: string; t: number; pop: number; accent: string }> = ({ text, t, pop, accent }) => {
  const geo = useGeo();
  const yes = Math.round(seeded(`story-poll-${text}`, 58, 84));
  const reveal = interpolate(t, [VOTE_AT, VOTE_AT + 20], [0, 1], { ...clamp, easing: (x) => 1 - (1 - x) ** 3 });
  const press = interpolate(t, [VOTE_AT - 4, VOTE_AT, VOTE_AT + 5], [1, 0.95, 1], clamp);
  const ink = inkOn(accent);
  const vt = useVt();
  const language = useVideoLanguage();
  const options = [
    { label: vt("Có 👍"), pct: yes, win: true },
    { label: vt("Không 👎"), pct: 100 - yes, win: false },
  ];
  return (
    <div style={{ position: "absolute", left: 0, width: VW, top: geo.vh * 0.655, translate: "0 -50%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 780,
          background: "#fff",
          borderRadius: 44,
          padding: "36px 34px 34px",
          boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
          rotate: "-2deg",
          scale: String(0.4 + 0.6 * pop),
          opacity: interpolate(t, [0, 3], [0, 1], clamp),
          fontFamily: UI,
        }}
      >
        <div style={{ fontSize: shrink(text, 54, 24, 0.66), fontWeight: 800, color: "#111", textAlign: "center", lineHeight: 1.35, marginBottom: 26 }}>
          {text}
        </div>
        {options.map((o, i) => (
          <div
            key={o.label}
            style={{
              position: "relative",
              height: 100,
              borderRadius: 50,
              background: "#efeff4",
              overflow: "hidden",
              marginTop: i ? 16 : 0,
              scale: o.win ? String(press) : undefined,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${o.pct * reveal}%`,
                background: o.win ? `linear-gradient(95deg, ${accent}, #ff3d7f)` : "#d6d6e0",
                borderRadius: 50,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 38px",
                fontSize: 42,
                fontWeight: 800,
                color: o.win && reveal > 0.35 ? ink : "#111",
              }}
            >
              <span>{o.label}</span>
              <span style={{ opacity: reveal, fontVariantNumeric: "tabular-nums", color: o.win && o.pct > 88 ? ink : "#111" }}>
                {Math.round(o.pct * reveal)}%
              </span>
            </div>
          </div>
        ))}
        <div style={{ textAlign: "center", fontSize: 28, fontWeight: 600, color: "#8a8a95", marginTop: 20, opacity: reveal }}>
          {vt("{n} lượt bình chọn", { n: Math.round(1200 + seeded(`story-votes-${text}`, 0, 3800)).toLocaleString(videoLocale(language)) })}
        </div>
      </div>
    </div>
  );
};

/** Viền chữ bằng nhiều lớp bóng — ổn định hơn -webkit-text-stroke với chữ có dấu. */
const outline = (color: string, r: number) =>
  Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * r).toFixed(1)}px ${(Math.sin(a) * r).toFixed(1)}px 0 ${color}`;
  }).join(", ");

const GifSticker: React.FC<{ text: string; t: number; pop: number; accent: string }> = ({ text, t, pop, accent }) => {
  const geo = useGeo();
  const emojis = reactionEmoji(text);
  // Nhịp GIF: đổi tư thế mỗi 4 frame, không chuyển mượt.
  const step = Math.floor(t / 4);
  const wobble = seeded(`story-gif-${step}`, -4.5, 4.5);
  const bump = step % 2 === 0 ? 1 : 1.045;
  const fill = inkOn(accent) === "#fff" ? "#fff" : "#111";
  const stroke = fill === "#fff" ? accent : "#fff";
  const upper = upperVi(text);
  const size = shrink(upper, 108, 12, 0.5);
  const cy = geo.vh * 0.66;
  return (
    <>
      {Array.from({ length: 10 }, (_, k) => {
        const life = t - k * 1.5;
        if (life < 0 || life > 48) return null;
        const p = life / 48;
        const angle = seeded(`story-em-a-${text}-${k}`, -Math.PI, Math.PI);
        const dist = (1 - (1 - Math.min(1, p * 1.6)) ** 3) * seeded(`story-em-d-${text}-${k}`, 230, 400);
        const x = VW / 2 + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist * 0.8 - p * 160;
        const s = seeded(`story-em-s-${text}-${k}`, 70, 118);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: x - s / 2,
              top: y - s / 2,
              fontSize: s,
              lineHeight: 1,
              opacity: interpolate(p, [0, 0.08, 0.6, 1], [0, 1, 1, 0], clamp),
              scale: String(interpolate(p, [0, 0.15, 1], [0.3, 1.15, 0.9], clamp)),
              rotate: `${seeded(`story-em-r-${text}-${k}`, -30, 30)}deg`,
            }}
          >
            {emojis[k % emojis.length]}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, width: VW, top: cy, translate: "0 -50%", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", maxWidth: 860, rotate: `${wobble}deg`, scale: String((0.3 + 0.7 * pop) * bump) }}>
          <div
            style={{
              fontFamily: GIF,
              fontWeight: 800,
              fontSize: size,
              lineHeight: 1.22,
              color: fill,
              textAlign: "center",
              padding: "0.12em 0.3em 0",
              textShadow: `${outline(stroke, size * 0.075)}, 0 ${size * 0.12}px 0 rgba(0,0,0,0.28)`,
            }}
          >
            {upper}
          </div>
          <div
            style={{
              position: "absolute",
              left: -size * 0.85,
              top: -size * 1.0,
              fontSize: size * 0.95,
              lineHeight: 1,
              rotate: `${step % 2 === 0 ? -14 : -4}deg`,
              filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.3))",
            }}
          >
            {emojis[0]}
          </div>
        </div>
      </div>
    </>
  );
};
