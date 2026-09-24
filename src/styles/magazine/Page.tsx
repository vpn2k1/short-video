/**
 * Một trang tạp chí = một cảnh. Ảnh/clip tràn trang đẩy vào chậm, măng-sét trên đầu, dòng số báo, chuyên mục,
 * con số bìa, dòng tít nhấn, tem tròn, mã vạch, và tít phụ đề in ở chân trang. Không có ảnh thì là trang chữ
 * trên giấy ngà với trích dẫn lớn. Mọi thứ in TRÊN trang nên trượt theo trang khi lật.
 */
import { AbsoluteFill, interpolate } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { Grain, useLayout } from "../shared";
import {
  Barcode,
  Burst,
  clamp,
  EASE_OUT,
  headlineSize,
  INK,
  IssueLine,
  Masthead,
  mastheadHeight,
  pad2,
  PAPER,
  POP,
  PunchLine,
  SANS,
  SERIF,
  splitPunch,
  StatLine,
  TagBox,
  upper,
} from "./Bits";
import { useVt } from "../../i18n/video";

/** Độ dài lật trang (frame) — index.tsx dùng cùng hằng số để trượt trang. */
export const TURN = 16;

export type PageCaption = { text: string; startFrame: number };

type Props = {
  scene: Scene;
  index: number;
  total: number;
  /** Frame bắt đầu trang (trang đầu = 0) và frame kết thúc cảnh. */
  start: number;
  end: number;
  frame: number;
  brand: string;
  accent: string;
  captions: PageCaption[];
  /** Trang đầu có title: bìa tự dựng (măng-sét rơi, tít bìa trượt vào). */
  intro: boolean;
  title: string;
  subtitle: string;
  ready: boolean;
  captionPosition: "bottom" | "center";
};

export const Page: React.FC<Props> = ({
  scene,
  index,
  total,
  start,
  end,
  frame,
  brand,
  accent,
  captions,
  intro,
  title,
  subtitle,
  ready,
  captionPosition,
}) => {
  const vt = useVt();
  const { unit, width, height, safe, captionBottom } = useLayout();
  const wide = width / height > 1.2;
  // 1:1 và 3:4 thấp hơn 9:16 nhiều: không đủ chỗ xếp dọc cột giữa trên tít, nên dàn hai bên như khung ngang.
  const compact = !wide && height / width < 1.5;
  const split = wide || compact;
  // Lề trái chung cho dòng số báo, chuyên mục, cột giữa và tít — mọi thứ thẳng một mép như dàn trang.
  const side = wide ? safe.side : safe.side * 0.8;
  const paper = !scene.image;
  const ink = paper ? INK : "#ffffff";
  const shadow = !paper;

  // Mốc in các mảnh: trang đầu có bìa thì đợi bìa xong, trang sau đợi lật xong.
  const appear = intro ? TITLE_FRAMES + 2 : index === 0 ? 8 : start + TURN;
  const since = (at: number, len: number, easing = EASE_OUT) =>
    interpolate(frame, [at, at + len], [0, 1], { ...clamp, easing });

  // Ảnh đẩy vào chậm suốt trang (kể cả lúc đang lật đi).
  const push = interpolate(frame, [start, Math.max(start + 1, end + TURN)], [1.04, 1.14], clamp);

  // Măng-sét + dòng số báo.
  const mastMax = (wide ? 150 : compact ? 180 : 230) * unit;
  const mastTop = split ? safe.top * 0.7 : safe.top * 0.85;
  const mastH = mastheadHeight(brand, width, mastMax, ready);
  const drop = intro ? since(0, 18, POP) : 1;
  const issueTop = mastTop + mastH + 12 * unit;
  const issueOpacity = intro ? since(10, 10) : 1;
  const tagTop = issueTop + 50 * unit;

  // Cột giữa (con số bìa + dòng tít nhấn) và tem tròn bên phải.
  const colTop = height * 0.3;
  const colWidth = wide ? width * 0.42 : compact ? width * 0.4 : width - side * 2;
  const visual = scene.visual;
  const statAt = appear + 6;
  const punchAt = scene.punch ? Math.max(appear + 4, msToFrames(scene.punch.atMs)) : Infinity;
  const burstSize = (wide ? 210 : compact ? 180 : 240) * unit;
  // Tem: dọc ở phải (cột giữa bên trái); ngang ở trái trên tít (cột giữa bên phải); vuông ở phải ngay dưới
  // dòng số báo, đẩy cột giữa xuống dưới tem (bên trái đã có chuyên mục và tít).
  const burstPos: React.CSSProperties = wide
    ? { left: side + 20 * unit, top: tagTop + 90 * unit }
    : compact
      ? { right: safe.side * 0.7, top: tagTop }
      : { right: safe.side * 0.7, top: height * 0.25 };
  const colTopFinal = compact && visual?.type === "badge" ? Math.max(colTop, tagTop + burstSize + 16 * unit) : colTop;

  // Tít phụ đề: câu mới nhất của trang đã bắt đầu. Trang đang lật đi giữ câu cuối của nó.
  let current = -1;
  for (let i = 0; i < captions.length; i++) if (frame >= captions[i].startFrame) current = i;
  const titleHold = intro && frame < TITLE_FRAMES - 2;
  const caption = current >= 0 && !titleHold ? captions[current] : null;
  const capStart = caption ? Math.max(caption.startFrame, intro ? TITLE_FRAMES - 2 : 0) : 0;
  const capIn = caption ? since(capStart, 12) : 0;
  const capText = caption ? caption.text.normalize("NFC") : "";
  const punchLive = frame >= punchAt - 2;
  const parts = caption && punchLive ? splitPunch(capText, scene.punch?.text ?? null) : null;
  const capSize = headlineSize(capText, split) * unit * (paper ? 1.06 : 1);
  const blockWidth = wide ? Math.min(width * 0.58, width - side * 2) : compact ? width * 0.52 : width - side * 2;
  const blockBottom = captionPosition === "center" && !split ? captionBottom + height * 0.08 : captionBottom;
  const kickerIn = intro ? since(TITLE_FRAMES - 4, 12) : index === 0 ? since(4, 12) : 1;

  // Bìa: tít bìa và dòng phụ trượt vào rồi rút đi khi bìa xong.
  const coverOut = intro ? interpolate(frame, [TITLE_FRAMES - 10, TITLE_FRAMES], [0, 1], { ...clamp, easing: EASE_OUT }) : 1;

  // Vệt bóng giấy láng quét chéo khi trang đậu xuống (trang đầu: khi măng-sét rơi xong).
  const sheenAt = index === 0 ? (intro ? 14 : -100) : start + TURN - 6;
  const sheen = interpolate(frame, [sheenAt, sheenAt + 22], [-0.6, 1.2], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: paper ? PAPER : "#111", overflow: "hidden" }}>
      {paper ? (
        <>
          <AbsoluteFill
            style={{
              backgroundImage:
                "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(80,60,30,0.08) 100%)",
            }}
          />
          {/* Số trang in chìm cỡ khổng lồ — nét biên tập của trang chữ. */}
          <div
            style={{
              position: "absolute",
              right: -40 * unit,
              top: wide ? height * 0.12 : height * 0.2,
              fontFamily: SERIF,
              fontWeight: 900,
              fontSize: (wide ? 620 : 760) * unit,
              lineHeight: 1,
              color: "rgba(20,20,20,0.05)",
            }}
          >
            {pad2(index + 1)}
          </div>
          <Grain opacity={0.08} animated={false} baseFrequency={0.8} />
        </>
      ) : (
        <>
          <AbsoluteFill style={{ scale: push.toFixed(4), filter: "contrast(1.06) saturate(1.08)" }}>
            <SceneMedia scene={scene} from={start} />
          </AbsoluteFill>
          {/* Lớp tối trên/dưới để măng-sét và tít đọc được trên mọi ảnh. */}
          <AbsoluteFill
            style={{
              backgroundImage: wide
                ? "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 32%), linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 38%, rgba(0,0,0,0) 62%), linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 50%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 17%, rgba(0,0,0,0) 30%), linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 26%, rgba(0,0,0,0) 55%)",
            }}
          />
        </>
      )}

      <Masthead text={brand} top={mastTop} width={width} maxSize={mastMax} color={ink} unit={unit} ready={ready} drop={drop} />
      <IssueLine
        left={vt("SỐ {n} · ẤN BẢN ĐẶC BIỆT", { n: pad2(1) })}
        right={`${pad2(index + 1)}/${pad2(total)}`}
        top={issueTop}
        side={side}
        width={width}
        color={ink}
        unit={unit}
        opacity={issueOpacity}
      />

      {scene.tag && frame >= appear ? (
        <div style={{ position: "absolute", left: side, top: tagTop }}>
          <TagBox text={scene.tag} accent={accent} unit={unit} progress={since(appear, 12)} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          // Ngang: tít ở dưới-trái nên cột giữa dạt sang phải cho khỏi đè.
          ...(split ? { right: side } : { left: side }),
          top: colTopFinal,
          width: colWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: split ? "flex-end" : "flex-start",
          gap: 50 * unit,
        }}
      >
        {visual?.type === "stat" && frame >= statAt ? (
          <StatLine
            value={visual.text}
            caption={visual.caption}
            color={paper ? accent : "#ffffff"}
            accent={paper ? INK : accent}
            unit={unit}
            progress={since(statAt, 16)}
            maxWidth={colWidth}
            shadow={shadow}
            compact={compact}
          />
        ) : null}
        {scene.punch && frame >= punchAt ? (
          <PunchLine
            text={scene.punch.text}
            accent={accent}
            unit={unit}
            progress={since(punchAt, 12, POP)}
            maxWidth={split ? colWidth : colWidth * 0.92}
          />
        ) : null}
      </div>

      {visual?.type === "badge" && frame >= appear + 10 ? (
        <div style={{ position: "absolute", ...burstPos }}>
          <Burst text={visual.text} caption={visual.caption} size={burstSize} unit={unit} progress={since(appear + 10, 14, POP)} frame={frame} />
        </div>
      ) : null}

      {/* Tem "MỚI!" của bìa — chỉ lúc bìa dựng. */}
      {intro && frame < TITLE_FRAMES ? (
        <div style={{ position: "absolute", ...(compact ? burstPos : { right: safe.side * 0.7, top: height * 0.24 }), opacity: 1 - coverOut }}>
          <Burst text={vt("Mới!")} caption={null} size={burstSize * 0.85} unit={unit} progress={since(26, 14, POP)} frame={frame} />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          right: wide ? safe.side : safe.side * 0.7,
          bottom: wide ? safe.bottom * 0.7 : safe.bottom * 0.42,
        }}
      >
        <Barcode issue={vt("SỐ {n}", { n: pad2(1) })} unit={unit} opacity={intro ? since(22, 10) : 1} />
      </div>

      {/* Tít bìa: title + subtitle, dựng lúc mở đầu rồi nhường chỗ cho phụ đề. */}
      {intro && frame < TITLE_FRAMES ? (
        <div
          style={{
            position: "absolute",
            left: side,
            width: blockWidth,
            bottom: blockBottom,
            opacity: 1 - coverOut,
            translate: `${(-coverOut * 50 * unit).toFixed(1)}px 0px`,
          }}
        >
          <div style={{ marginBottom: 20 * unit }}>
            <TagBox text={vt("Trang bìa")} accent={accent} unit={unit * 0.85} progress={since(14, 12)} />
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 800,
              fontSize: headlineSize(title, split) * 1.12 * unit,
              lineHeight: 1.08,
              color: ink,
              textWrap: "balance",
              textShadow: shadow ? `0 ${3 * unit}px ${16 * unit}px rgba(0,0,0,0.5)` : "none",
              opacity: since(16, 10),
              translate: `${((1 - since(16, 16)) * -80 * unit).toFixed(1)}px 0px`,
            }}
          >
            {title.normalize("NFC")}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16 * unit,
                marginTop: 22 * unit,
                opacity: since(24, 10),
                translate: `${((1 - since(24, 16)) * -60 * unit).toFixed(1)}px 0px`,
              }}
            >
              <div style={{ width: 48 * unit, height: 5 * unit, backgroundColor: accent, flexShrink: 0 }} />
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: 36 * unit,
                  lineHeight: 1.3,
                  color: ink,
                  textShadow: shadow ? `0 ${2 * unit}px ${10 * unit}px rgba(0,0,0,0.6)` : "none",
                }}
              >
                {subtitle.normalize("NFC")}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Tít phụ đề ở chân trang: vạch màu nhấn + dòng kicker nhỏ + câu đang đọc bằng chữ có chân lớn. */}
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: side,
            width: blockWidth,
            bottom: blockBottom,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 * unit, marginBottom: 16 * unit, opacity: kickerIn }}>
            <div style={{ width: 56 * unit * kickerIn, height: 5 * unit, backgroundColor: accent }} />
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 22 * unit,
                letterSpacing: "0.16em",
                color: ink,
                opacity: 0.85,
                textShadow: shadow ? `0 ${2 * unit}px ${8 * unit}px rgba(0,0,0,0.6)` : "none",
              }}
            >
              {upper(paper ? vt("Trích dẫn") : index === 0 ? vt("Câu chuyện trang bìa") : vt("Trang {n}", { n: pad2(index + 1) }))}
            </div>
          </div>
          {paper ? (
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 200 * unit, lineHeight: 0.62, height: 92 * unit, color: accent }}>
              “
            </div>
          ) : null}
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: paper ? 600 : 700,
              fontSize: capSize,
              lineHeight: 1.18,
              color: ink,
              textWrap: "balance",
              textShadow: shadow ? `0 ${3 * unit}px ${14 * unit}px rgba(0,0,0,0.55)` : "none",
              opacity: capIn,
              translate: `0px ${((1 - capIn) * 26 * unit).toFixed(1)}px`,
              clipPath: `inset(-20% -5% ${((1 - capIn) * 60).toFixed(1)}% -5%)`,
            }}
          >
            {parts ? (
              <>
                {parts[0]}
                <span
                  style={{
                    fontStyle: "italic",
                    textDecorationLine: "underline",
                    textDecorationColor: accent,
                    textDecorationThickness: 7 * unit,
                    textUnderlineOffset: 10 * unit,
                    textDecorationSkipInk: "none",
                    // Nghiêng giả của Playfair ăn mất khoảng trắng sau cụm — chừa thêm chút lề phải.
                    paddingRight: "0.18em",
                  }}
                >
                  {parts[1]}
                </span>
                {parts[2]}
              </>
            ) : (
              capText
            )}
          </div>
        </div>
      ) : null}

      {sheen > -0.6 && sheen < 1.2 ? (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            backgroundImage: `linear-gradient(115deg, rgba(255,255,255,0) ${((sheen - 0.18) * 100).toFixed(1)}%, rgba(255,255,255,0.32) ${(sheen * 100).toFixed(1)}%, rgba(255,255,255,0) ${((sheen + 0.18) * 100).toFixed(1)}%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
