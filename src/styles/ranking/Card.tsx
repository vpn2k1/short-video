import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import { seeded } from "../shared";
import { Crown, Sparkles } from "./Gold";
import { BEAT, NAME_LH, WHIP_IN_FROM, whipOffset, type RankLayout } from "./layout";
import {
  backOut,
  EASE_IN,
  EASE_INOUT,
  EASE_OUT,
  FONT,
  GOLD,
  GOLD_GRADIENT,
  GOLD_LIGHT,
  INK,
  ramp,
  type RankItem,
  STAGE,
  textOn,
  upper,
  VIDEO_EXT,
  WHITE,
  withAlpha,
} from "./theme";

/** Chữ "#N": dấu # nhỏ nâng lên, số khổng lồ. #1 tô gradient vàng. */
export const RankGlyph: React.FC<{
  rank: number;
  size: number;
  gold: boolean;
  shadow: string;
  style?: React.CSSProperties;
}> = ({ rank, size, gold, shadow, style }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums",
      ...(gold
        ? {
            backgroundImage: GOLD_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }
        : { color: WHITE }),
      filter: shadow,
      ...style,
    }}
  >
    <span style={{ fontSize: "0.46em", marginTop: "0.16em", marginRight: "0.03em" }}>#</span>
    <span>{rank}</span>
  </div>
);

/** Mọi thẻ cảnh — chỉ vẽ thẻ đang trên sân khấu hoặc đang văng vào/ra. */
export const Cards: React.FC<{ L: RankLayout; accent: string }> = ({ L, accent }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {L.items.map((item, i) => {
        const w = whipOffset(L, i, frame);
        if (!w.visible) return null;
        return <ItemCard key={`card-${i}`} L={L} item={item} accent={accent} inP={w.inP} outP={w.outP} />;
      })}
    </AbsoluteFill>
  );
};

const ItemCard: React.FC<{ L: RankLayout; item: RankItem; accent: string; inP: number; outP: number }> = ({
  L,
  item,
  accent,
  inP,
  outP,
}) => {
  const frame = useCurrentFrame();
  const { unit: u, card, bar, badge, width, strip } = L;
  const { scene, index, rank } = item;
  const enter = L.enters[index];
  const lf = frame - enter;
  const gold = rank === 1;
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));

  /* ---------- văng vào / ra */
  const inE = EASE_OUT(inP);
  const outE = EASE_IN(outP);
  const travel = width * 1.15;
  const x = (1 - inE) * travel - outE * travel;
  const skew = (1 - inE) * -9 + outE * 9;

  /* ---------- số hạng: đập vào rồi thu về góc */
  const slamT = ramp(lf, BEAT.slam, BEAT.slamLen, (t) => t);
  const slamScale = 2.2 - 1.2 * backOut(slamT, 2.2);
  const slamOpacity = ramp(lf, BEAT.slam, 2, (t) => t);
  const blur = 1 - ramp(lf, BEAT.slam + 1, 6, (t) => t);
  const dock = ramp(lf, BEAT.dock, BEAT.dockLen, EASE_INOUT);
  const badgeFont = badge.size * 0.6;
  const numberScale = slamScale * (1 + (badgeFont / L.bigFont - 1) * dock);
  const cx0 = card.w / 2;
  const cy0 = card.imgH / 2;
  const cx1 = badge.inset + badge.size / 2;
  const cy1 = badge.inset + badge.size / 2;
  const cx = cx0 + (cx1 - cx0) * dock;
  const cy = cy0 + (cy1 - cy0) * dock;
  const plateP = ramp(lf, BEAT.dock + BEAT.dockLen * 0.55, 9, (t) => t);
  const plateScale = backOut(plateP, 2);
  const dim = 0.5 * (1 - dock);
  const numberShadow = gold
    ? `drop-shadow(0 ${14 * u * (1 - dock * 0.8)}px 0 #7A4A00) drop-shadow(0 0 ${30 * u}px ${withAlpha(GOLD, 0.55)})`
    : `drop-shadow(0 ${14 * u * (1 - dock * 0.8)}px 0 ${accent}) drop-shadow(0 ${18 * u}px ${24 * u}px rgba(0,0,0,0.55))`;

  /* ---------- sóng xung kích lúc đập */
  const shock = ramp(lf, BEAT.slam + 5, 12);
  const shake = lf >= BEAT.slam + 5 && lf < BEAT.slam + 12 ? Math.sin(lf * 3.1) * 9 * u * (1 - (lf - BEAT.slam - 5) / 7) : 0;

  /* ---------- thanh tên */
  const barP = ramp(lf, BEAT.bar, BEAT.barLen);
  const name = L.fittedNames[index];
  const barBg = gold ? GOLD_GRADIENT : `linear-gradient(100deg, ${accent} 0%, ${withAlpha(accent, 0.86)} 100%)`;
  const barInk = gold ? INK : textOn(accent);

  /* ---------- Ken Burns */
  const kb = ramp(frame, start, end - start + 20, (t) => t);
  const panDir = seeded(`rk-pan-${index}`) > 0.5 ? 1 : -1;
  const isVideo = scene.image ? VIDEO_EXT.test(scene.image) : false;

  const totalH = bar.y - card.y + bar.h;
  const statScale = strip ? 1 : 0.78;

  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: card.w,
        height: totalH,
        transform: `translate(${x + shake}px, 0px) skewX(${skew}deg)`,
      }}
    >
      {/* Ảnh / video */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: card.w,
          height: card.imgH,
          borderRadius: card.radius,
          overflow: "hidden",
          backgroundColor: "#1a1c28",
          boxShadow: gold
            ? `0 0 0 ${5 * u}px ${GOLD}, 0 0 ${70 * u}px ${withAlpha(GOLD, 0.55)}, 0 ${30 * u}px ${60 * u}px rgba(0,0,0,0.6)`
            : `0 0 0 ${3 * u}px rgba(255,255,255,0.14), 0 ${30 * u}px ${60 * u}px rgba(0,0,0,0.6)`,
        }}
      >
        {scene.image ? (
          isVideo ? (
            <Sequence from={Math.min(start, enter + WHIP_IN_FROM)} layout="none">
              <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} />
            </Sequence>
          ) : (
            <CropBox crop={scene.crop}>
              <Img
                src={staticFile(scene.image)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${1.05 + kb * 0.1}) translateX(${panDir * (kb - 0.5) * 2.4}%)`,
                }}
              />
            </CropBox>
          )
        ) : (
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(80% 70% at 30% 20%, ${withAlpha(gold ? GOLD : accent, 0.55)} 0%, ${STAGE} 80%), repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 ${14 * u}px, transparent ${14 * u}px ${34 * u}px)`,
            }}
          />
        )}
        {/* Tối dần xuống đáy cho thanh tên, tối cả khung lúc số hạng đập vào */}
        <AbsoluteFill
          style={{
            backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <AbsoluteFill style={{ backgroundColor: `rgba(4,5,10,${dim})` }} />
        {/* Vòng xung kích */}
        {shock > 0 && shock < 1 ? (
          <div
            style={{
              position: "absolute",
              left: cx0 - L.bigFont * 0.9,
              top: cy0 - L.bigFont * 0.9,
              width: L.bigFont * 1.8,
              height: L.bigFont * 1.8,
              borderRadius: "50%",
              border: `${(1 - shock) * 26 * u}px solid ${gold ? GOLD : WHITE}`,
              opacity: (1 - shock) * 0.7,
              transform: `scale(${0.4 + shock * 1.1})`,
            }}
          />
        ) : null}
      </div>

      {gold ? (
        <Sparkles seed={`rk-card-spark-${index}`} count={16} width={card.w} height={card.imgH} unit={u} from={enter + BEAT.slam + 6} />
      ) : null}

      {/* Nhãn số liệu + nhãn đặc biệt ở góc phải trên */}
      <SceneVisual L={L} item={item} lf={lf} scale={statScale} />

      {/* Đế ô hạng ở góc */}
      {plateP > 0 ? (
        <div
          style={{
            position: "absolute",
            left: badge.inset,
            top: badge.inset,
            width: badge.size,
            height: badge.size,
            borderRadius: badge.size * 0.3,
            backgroundImage: gold ? `linear-gradient(160deg, #2a2110 0%, ${INK} 100%)` : `linear-gradient(160deg, ${accent} 0%, ${withAlpha(accent, 0.8)} 100%)`,
            border: `${4 * u}px solid ${gold ? GOLD : "rgba(255,255,255,0.9)"}`,
            boxShadow: `0 ${12 * u}px ${26 * u}px rgba(0,0,0,0.5)`,
            transform: `scale(${plateScale})`,
          }}
        />
      ) : null}

      {/* Số hạng + bóng mờ chuyển động (các bản sao trong suốt, không blur CSS) */}
      {slamOpacity > 0
        ? [3, 2, 1, 0].map((k) => {
            if (k > 0 && blur <= 0.02) return null;
            const s = numberScale * (1 + 0.16 * k * blur);
            return (
              <div
                key={`num-${k}`}
                style={{
                  position: "absolute",
                  left: cx,
                  top: cy,
                  transform: `translate(-50%, -46%) scale(${s})`,
                  opacity: k === 0 ? slamOpacity : (0.26 / k) * blur * slamOpacity,
                }}
              >
                {k === 0 && gold ? <FirstCrown lf={lf} size={L.bigFont} dock={dock} /> : null}
                <RankGlyph
                  rank={rank}
                  size={L.bigFont}
                  gold={gold}
                  shadow={k === 0 ? numberShadow : "none"}
                  style={k === 0 && textOn(accent) === INK && !gold && dock > 0.5 ? { color: INK, filter: "none" } : undefined}
                />
              </div>
            );
          })
        : null}

      {/* Thanh tên */}
      <div
        style={{
          position: "absolute",
          left: bar.x - card.x,
          top: bar.y - card.y,
          width: bar.w,
          height: bar.h,
          borderRadius: bar.h * 0.28,
          backgroundImage: barBg,
          boxShadow: `0 ${14 * u}px ${30 * u}px rgba(0,0,0,0.5), inset 0 ${3 * u}px 0 rgba(255,255,255,0.35)`,
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
          paddingLeft: bar.padX,
          paddingRight: bar.padX,
          gap: 18 * u,
          clipPath: `inset(-40% ${((1 - barP) * 100).toFixed(3)}% -40% 0 round ${bar.h * 0.28}px)`,
          transform: `translateX(${(1 - barP) * -60 * u}px)`,
          opacity: barP > 0 ? 1 : 0,
        }}
      >
        <div
          style={{
            width: bar.chip,
            height: bar.h * 0.56,
            borderRadius: bar.chip,
            backgroundColor: gold ? INK : barInk,
            opacity: 0.85,
            flexShrink: 0,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {name.lines.map((line, li) => {
            const lp = ramp(lf, BEAT.bar + 4 + li * 3, 10);
            return (
              <div
                key={`name-${li}`}
                style={{
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: name.size,
                  lineHeight: NAME_LH,
                  color: barInk,
                  whiteSpace: "nowrap",
                  opacity: lp,
                  transform: `translateX(${(1 - lp) * 40 * u}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Vương miện rơi xuống đậu trên số #1, nghiêng dần khi số thu về góc. */
const FirstCrown: React.FC<{ lf: number; size: number; dock: number }> = ({ lf, size, dock }) => {
  const p = ramp(lf, BEAT.slam + BEAT.slamLen - 3, 12, (t) => t);
  if (p <= 0) return null;
  const drop = backOut(p, 1.6);
  // Thu về góc: vương miện lớn dần (so với số) và nhô lên khỏi đế ô hạng.
  const w = size * (0.62 + dock * 0.3);
  return (
    <div
      style={{
        position: "absolute",
        left: `${50 + dock * 14}%`,
        bottom: `${82 + dock * 50}%`,
        transform: `translate(-50%, ${(1 - drop) * -size * 0.5}px) rotate(${-8 + dock * 22}deg)`,
        transformOrigin: "50% 100%",
        opacity: Math.min(1, p * 3),
        filter: `drop-shadow(0 ${size * 0.03}px ${size * 0.05}px rgba(0,0,0,0.5))`,
      }}
    >
      <Crown width={w} id="rk-crown-card" />
    </div>
  );
};

/** `visual` stat → ô điểm có ngôi sao; badge → nhãn dán nghiêng. Cả hai ở góc phải trên thẻ. */
const SceneVisual: React.FC<{ L: RankLayout; item: RankItem; lf: number; scale: number }> = ({ L, item, lf, scale }) => {
  const visual = item.scene.visual;
  if (!visual) return null;
  const { unit: u, card, badge } = L;
  const p = ramp(lf, BEAT.stat, 10, (t) => t);
  if (p <= 0) return null;
  const pop = backOut(p, 2.4);
  const s = scale * u;
  const right = badge.inset;
  const top = badge.inset;

  if (visual.type === "stat") {
    return (
      <div
        style={{
          position: "absolute",
          right: right,
          top,
          maxWidth: card.w * 0.5,
          padding: `${14 * s}px ${24 * s}px ${14 * s}px ${18 * s}px`,
          borderRadius: 26 * s,
          backgroundColor: "rgba(8,9,16,0.8)",
          border: `${2 * u}px solid rgba(255,255,255,0.2)`,
          boxShadow: `0 ${12 * s}px ${26 * s}px rgba(0,0,0,0.45)`,
          transform: `scale(${pop})`,
          transformOrigin: "100% 0%",
          display: "flex",
          alignItems: "center",
          gap: 14 * s,
        }}
      >
        <svg width={58 * s} height={58 * s} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path
            d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8 5.8 21.1l1.2-7L1.9 9.2l7-1z"
            fill={GOLD}
            stroke={GOLD_LIGHT}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 60 * s,
              lineHeight: 1.05,
              color: WHITE,
              whiteSpace: "nowrap",
            }}
          >
            {visual.text}
          </div>
          {visual.caption ? (
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 26 * s,
                lineHeight: 1.2,
                color: "rgba(255,255,255,0.72)",
                whiteSpace: "nowrap",
              }}
            >
              {visual.caption}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const wobble = Math.sin(lf / 9) * 1.5;
  return (
    <div
      style={{
        position: "absolute",
        right: right + 6 * s,
        top: top + 10 * s,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8 * s,
        transform: `scale(${pop}) rotate(${6 + wobble}deg)`,
        transformOrigin: "80% 20%",
      }}
    >
      <div
        style={{
          padding: `${12 * s}px ${26 * s}px`,
          borderRadius: 16 * s,
          backgroundColor: "#FF2E55",
          backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)",
          border: `${5 * s}px solid ${WHITE}`,
          boxShadow: `0 ${12 * s}px ${24 * s}px rgba(0,0,0,0.45)`,
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 44 * s,
          lineHeight: 1.25,
          color: WHITE,
          whiteSpace: "nowrap",
        }}
      >
        {upper(visual.text)}
      </div>
      {visual.caption ? (
        <div
          style={{
            padding: `${6 * s}px ${14 * s}px`,
            borderRadius: 10 * s,
            backgroundColor: "rgba(8,9,16,0.8)",
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 26 * s,
            lineHeight: 1.25,
            color: WHITE,
            whiteSpace: "nowrap",
          }}
        >
          {visual.caption}
        </div>
      ) : null}
    </div>
  );
};
