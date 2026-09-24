/**
 * Phong cách "Biểu đồ tài chính": màn hình giao dịch kiểu Bloomberg rút gọn trên nền navy đen kẻ lưới mảnh.
 * Biểu đồ giá tự vẽ từ trái sang phải suốt video (bước ngẫu nhiên có seed, xu hướng bám câu chuyện), ảnh cảnh nằm
 * trong thẻ "tin" bo góc góc trên-phải, phụ đề trong ô dữ liệu ở một phần ba dưới với con số tự tô xanh/đỏ,
 * dải mã chạy dưới đáy. Câu nhấn = cú vọt giá + bong bóng chú thích + loé xanh. Xem skill style-finance.
 *
 * Thứ tự lớp: nền lưới → biểu đồ → thanh đầu → cột trái (chip mã, bảng giá) → thẻ ảnh → ô số liệu → bong bóng
 * câu nhấn → loé sáng → khung phụ đề → dải mã chạy → màn mở phiên.
 */
import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { SceneMedia } from "../media";
import { activeIndexAt, useCaptionClock, useLayout } from "../shared";
import { PriceChart, type Plot, trendUp, xOf, yOf } from "./Chart";
import {
  BG, buildSeries, clamp, clockAt, DOWN, fmtPrice, INK, isDownText, LINE, MUTED, priceOf, sceneMoods, SPIKE_RISE,
  splitCaption, symbolOf, tickerItems, UP, upper, valueAt,
} from "./market";
import {
  BadgePanel, CaptionPanel, DATA, Header, Ohlc, OUT, POP, PunchBubble, StatPanel, TagChip, TEXT, Ticker,
} from "./Panels";
import { useVideoLanguage, useVt, videoLocale } from "../../i18n/video";

/** Ước lượng số dòng của câu ở cỡ chữ cho trước (Lexend 600 ~0,56 em mỗi ký tự). */
const linesOf = (text: string, size: number, w: number) => Math.max(1, Math.ceil(([...text].length * size * 0.56) / w));

export const FinanceStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  showTitle,
  captionPosition,
}) => {
  ensureFonts(["roboto", "lexend"]);
  const { durationInFrames } = useVideoConfig();
  const { width, height, safe, unit, fps } = useLayout();
  const frame = useCurrentFrame();
  const vt = useVt();
  const language = useVideoLanguage();
  const cap = useCaptionClock(captions);
  const wide = width >= height * 0.95;
  const side = safe.side;
  const contentW = width - side * 2;
  const introEnd = showTitle ? TITLE_FRAMES : 0;

  // ---- Bố cục ----
  const headerY = safe.top;
  const headerH = 104 * unit;
  const headerBottom = headerY + headerH;
  const cardW = wide ? contentW * (width / height > 1.4 ? 0.36 : 0.44) : contentW * 0.64;
  const cardH = cardW * (wide ? 0.62 : 0.72);
  const cardX = width - side - cardW;
  const cardY = headerBottom + 30 * unit;
  const colGap = 32 * unit;
  const leftW = wide ? cardX - side - colGap * 1.5 : contentW - cardW - colGap;

  const captionFont = Math.round((wide ? 46 : 52) * unit);
  const panelW = contentW;
  const textW = panelW - 66 * unit;
  const maxLines = Math.min(4, captions.reduce((m, c) => Math.max(m, linesOf(c.text, captionFont, textW)), 1));
  const panelH = 18 * unit + 40 * unit + maxLines * captionFont * 1.36 + 24 * unit;
  const panelBottom = captionPosition === "center" ? height * 0.58 + panelH / 2 : height - safe.bottom;
  const panelTop = panelBottom - panelH;

  const axisFont = Math.round((wide ? 22 : 24) * unit);
  const axisW = axisFont * 5.4;
  const plotRight = wide ? cardX - colGap : width - side * 0.3;
  const ohlcY = wide ? cardY + cardH + 26 * unit : cardY + 92 * unit;
  const plot: Plot = {
    x0: wide ? side * 0.5 : width * 0.04,
    x1: plotRight - axisW,
    yTop: wide ? headerBottom + 210 * unit : cardY + cardH + 240 * unit,
    yBot: panelTop - 96 * unit,
    volTop: panelTop - 76 * unit,
    volBot: panelTop - 14 * unit,
    duration: durationInFrames,
  };
  if (plot.yBot - plot.yTop < 160 * unit) plot.yTop = plot.yBot - 160 * unit;

  // ---- Dữ liệu thị trường (xác định theo props) ----
  const seed = title;
  const moods = useMemo(() => sceneMoods(scenes, captions), [scenes, captions]);
  const series = useMemo(
    () => buildSeries(seed, scenes, moods, durationInFrames, Math.round(Math.min(160, Math.max(60, (plot.x1 - plot.x0) / (7 * unit))))),
    [seed, scenes, moods, durationInFrames, plot.x1, plot.x0, unit],
  );
  const ticker = useMemo(() => tickerItems(title, subtitle, seed), [title, subtitle, seed]);
  const symbol = symbolOf(title);

  const head = Math.min(frame, durationInFrames - 1);
  const hv = valueAt(series, head);
  const lineUp = trendUp(series, head);
  const lineColor = lineUp ? UP : DOWN;
  const lastIdx = Math.min(series.values.length - 1, Math.floor(head / series.step));
  let hi = hv;
  let lo = hv;
  let vol = 0;
  for (let i = 0; i <= lastIdx; i++) {
    hi = Math.max(hi, series.values[i]);
    lo = Math.min(lo, series.values[i]);
    vol += series.volumes[i];
  }
  const volText = `${(vol * 0.137).toLocaleString(videoLocale(language), { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${vt("Tr")}`;

  // Loé sáng của câu nhấn gần nhất.
  let flash = 0;
  let flashUp = true;
  scenes.forEach((s, i) => {
    if (!s.punch) return;
    const pf = msToFrames(s.punch.atMs);
    const f = interpolate(frame, [pf, pf + 3, pf + 18], [0, 1, 0], clamp);
    if (f > flash) {
      flash = f;
      flashUp = moods[i] !== "down";
    }
  });

  // ---- Cảnh: cửa sổ hiện của từng cảnh (vào / ra) ----
  const windowOf = (i: number) => {
    const start = i === 0 ? Math.max(0, introEnd - 6) : Math.max(msToFrames(scenes[i].startMs), introEnd - 6);
    const next = i < scenes.length - 1 ? msToFrames(scenes[i + 1].startMs) : Infinity;
    return { start, next };
  };
  const stateOf = (i: number, inFrames = 14) => {
    const { start, next } = windowOf(i);
    if (frame < start || frame >= next + 12) return null;
    const enter = interpolate(frame, [start, start + inFrames], [0, 1], { ...clamp, easing: OUT });
    const exit = next === Infinity ? 0 : interpolate(frame, [next, next + 12], [0, 1], clamp);
    return { enter, exit, local: frame - start, start, next };
  };

  // ---- Phụ đề ----
  const showCaptions = frame >= introEnd - 10 && cap.caption !== null;
  const capScene = cap.caption ? activeIndexAt(scenes, msToFrames(cap.caption.startMs)) : -1;
  const capPunch = capScene >= 0 ? scenes[capScene].punch : null;
  const pieces = cap.caption ? splitCaption(cap.caption.text, capPunch?.text ?? null) : [];
  const punchOn = capPunch ? interpolate(frame, [msToFrames(capPunch.atMs), msToFrames(capPunch.atMs) + 6], [0, 1], clamp) : 0;
  const capFont = cap.caption
    ? Math.round(captionFont * Math.max(0.74, Math.min(1, (maxLines * textW) / ([...cap.caption.text].length * captionFont * 0.56 + 1) ) ))
    : captionFont;
  const capEnter = interpolate(cap.localFrame, [0, 9], [0, 1], { ...clamp, easing: OUT });
  const firstCapFrame = captions.length ? Math.max(introEnd - 10, msToFrames(captions[0].startMs)) : 0;
  const panelIn = interpolate(frame, [firstCapFrame, firstCapFrame + 12], [0, 1], { ...clamp, easing: OUT });

  // ---- Màn mở phiên ----
  const introOut = showTitle ? interpolate(frame, [TITLE_FRAMES - 16, TITLE_FRAMES], [0, 1], clamp) : 1;
  const chromeIn = showTitle ? interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES + 4], [0, 1], { ...clamp, easing: OUT }) : 1;
  const titleSize = Math.round(Math.min(wide ? 92 : 100, Math.max(58, (wide ? 1500 : 1100) / Math.max(10, [...title].length))) * unit);

  const tickerH = 60 * unit;
  const tickerY = Math.min(height - tickerH, height - safe.bottom + (wide ? 18 : 26) * unit);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: "hidden", fontFamily: DATA }}>
      {/* Nền: lưới mảnh + quầng sáng */}
      <AbsoluteFill
        style={{
          backgroundImage: [
            `radial-gradient(ellipse at 70% 30%, rgba(40, 80, 150, 0.22), rgba(0,0,0,0) 60%)`,
            `linear-gradient(rgba(120,150,200,0.055) 1px, transparent 1px)`,
            `linear-gradient(90deg, rgba(120,150,200,0.055) 1px, transparent 1px)`,
          ].join(", "),
          backgroundSize: `100% 100%, ${48 * unit}px ${48 * unit}px, ${48 * unit}px ${48 * unit}px`,
        }}
      />

      <PriceChart series={series} plot={plot} frame={frame} color={lineColor} unit={unit} width={width} height={height} axisFont={axisFont} />

      <Header
        unit={unit}
        x={side}
        y={headerY}
        w={contentW}
        h={headerH}
        symbol={symbol}
        clock={clockAt(frame, fps)}
        price={fmtPrice(priceOf(series, hv), language)}
        pct={hv}
        frame={frame}
        flash={flash}
      />

      {/* Cột trái: chip mã của cảnh + bảng giá */}
      {scenes.map((s, i) => {
        const st = s.tag ? stateOf(i, 12) : null;
        if (!st || !s.tag) return null;
        return (
          <TagChip
            key={`tag-${i}`}
            unit={unit}
            x={side}
            y={cardY}
            maxW={wide ? leftW : leftW}
            text={s.tag}
            accent={accent}
            t={st.enter * (1 - st.exit)}
          />
        );
      })}
      <Ohlc
        unit={unit}
        x={wide ? cardX : side}
        y={ohlcY}
        w={wide ? cardW : leftW}
        row={wide}
        opacity={chromeIn}
        items={[
          { label: vt("Mở cửa"), value: fmtPrice(series.base, language) },
          { label: vt("Cao nhất"), value: fmtPrice(priceOf(series, hi), language), color: UP },
          { label: vt("Thấp nhất"), value: fmtPrice(priceOf(series, lo), language), color: DOWN },
          { label: vt("Khối lượng"), value: volText },
        ]}
      />

      {/* Thẻ tin có ảnh/clip của cảnh */}
      {scenes.map((s, i) => {
        if (!s.image) return null;
        const st = stateOf(i, 16);
        if (!st) return null;
        const t = st.enter * (1 - st.exit);
        const span = Math.max(1, (st.next === Infinity ? durationInFrames : st.next) - st.start);
        const zoom = interpolate(frame, [st.start, st.start + span], [1.03, 1.13], clamp);
        const stripH = 46 * unit;
        return (
          <div
            key={`card-${i}`}
            style={{
              position: "absolute",
              left: cardX,
              top: cardY,
              width: cardW,
              height: cardH,
              borderRadius: 18 * unit,
              overflow: "hidden",
              border: `${2.5 * unit}px solid ${accent}`,
              backgroundColor: "#0b1220",
              boxShadow: `0 ${24 * unit}px ${60 * unit}px rgba(0,0,0,0.6), 0 0 ${36 * unit}px ${accent}40`,
              opacity: t,
              transform: `translateX(${((1 - st.enter) * 70 * unit).toFixed(1)}px) scale(${(0.97 + 0.03 * st.enter).toFixed(4)})`,
            }}
          >
            <div style={{ position: "absolute", left: 0, top: stripH, right: 0, bottom: 0, overflow: "hidden" }}>
              <SceneMedia scene={s} from={msToFrames(s.startMs)} zoom={zoom} />
              <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(6,10,18,0) 55%, rgba(6,10,18,0.55))" }} />
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                right: 0,
                height: stripH,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: `0 ${18 * unit}px`,
                backgroundColor: "rgba(8, 13, 24, 0.96)",
                borderBottom: `${1.5 * unit}px solid ${LINE}`,
                fontFamily: DATA,
                fontSize: 20 * unit,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: MUTED,
              }}
            >
              <span>
                <span style={{ color: accent }}>●</span> {vt("TIN THỊ TRƯỜNG")}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {String(i + 1).padStart(2, "0")}/{String(scenes.length).padStart(2, "0")}
              </span>
            </div>
          </div>
        );
      })}

      {/* Ô số liệu / khuyến nghị */}
      {scenes.map((s, i) => {
        if (!s.visual) return null;
        const st = stateOf(i, 16);
        if (!st) return null;
        const x = side;
        const y = wide ? cardY + 86 * unit : cardY + cardH + 60 * unit;
        const maxW = wide ? leftW : contentW * 0.86;
        const opacity = 1 - st.exit;
        return s.visual.type === "stat" ? (
          <StatPanel
            key={`vis-${i}`}
            unit={unit}
            x={x}
            y={y}
            maxW={maxW}
            text={s.visual.text}
            caption={s.visual.caption}
            up={!isDownText(`${s.visual.text} ${s.visual.caption ?? ""}`) && moods[i] !== "down"}
            local={st.local}
            opacity={opacity}
            seed={`${seed}-spark-${i}`}
          />
        ) : (
          <BadgePanel
            key={`vis-${i}`}
            unit={unit}
            x={x}
            y={y}
            maxW={maxW}
            text={s.visual.text}
            caption={s.visual.caption}
            accent={accent}
            local={st.local}
            opacity={opacity}
          />
        );
      })}

      {/* Câu nhấn: bong bóng chú thích ghim vào đỉnh cú vọt */}
      {scenes.map((s, i) => {
        if (!s.punch) return null;
        const pf = msToFrames(s.punch.atMs);
        const next = i < scenes.length - 1 ? msToFrames(scenes[i + 1].startMs) : Infinity;
        const end = Math.max(pf + 20, next);
        if (frame < pf || frame >= end + 12) return null;
        const peak = pf + SPIKE_RISE;
        const px = xOf(plot, peak);
        const py = yOf(plot, series, valueAt(series, peak));
        const size = Math.round(Math.max(30, Math.min(46, 46 - Math.max(0, [...s.punch.text].length - 18) * 0.8)) * unit);
        const maxW = Math.min(wide ? plotRight - side : contentW * 0.82, 760 * unit);
        const estW = Math.min(maxW, [...s.punch.text].length * size * 0.58 + size * 1.6 + 52 * unit);
        // khung ngang: bong bóng không được lấn sang cột thẻ ảnh bên phải
        const rightEdge = wide ? plotRight : width - side;
        const anchorX = Math.max(side + estW / 2, Math.min(px, rightEdge - estW / 2));
        const t = interpolate(frame, [pf + 2, pf + 14], [0, 1], { ...clamp, easing: POP });
        const opacity = interpolate(frame, [pf + 2, pf + 6], [0, 1], clamp) * (end === Infinity ? 1 : interpolate(frame, [end, end + 12], [1, 0], clamp));
        return (
          <PunchBubble
            key={`punch-${i}`}
            unit={unit}
            px={px}
            py={py}
            anchorX={anchorX}
            maxW={maxW}
            text={s.punch.text}
            up={moods[i] !== "down"}
            t={t}
            opacity={opacity}
            size={size}
          />
        );
      })}

      {/* Loé xanh (đỏ) khi giá vọt */}
      {flash > 0.001 ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            backgroundImage: `radial-gradient(circle at ${((xOf(plot, head) / width) * 100).toFixed(1)}% ${((yOf(plot, series, hv) / height) * 100).toFixed(1)}%, ${flashUp ? UP : DOWN}66, ${flashUp ? UP : DOWN}00 60%)`,
            opacity: flash,
            mixBlendMode: "screen",
          }}
        />
      ) : null}

      {/* Khung phụ đề */}
      {showCaptions && cap.caption ? (
        <CaptionPanel
          unit={unit}
          x={side}
          bottom={panelBottom}
          w={panelW}
          minH={panelH}
          pieces={pieces}
          punchOn={punchOn}
          fontSize={capFont}
          clock={clockAt(cap.startFrame, fps)}
          counter={`${String(cap.index + 1).padStart(2, "0")}/${String(captions.length).padStart(2, "0")}`}
          enter={capEnter}
          panelIn={panelIn}
          accent={accent}
        />
      ) : null}

      <Ticker unit={unit} y={tickerY} width={width} h={tickerH} items={ticker} frame={frame} accent={accent} />

      {/* Màn mở phiên */}
      {showTitle && introOut < 1 ? (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(6, 10, 18, ${(0.5 * (1 - introOut)).toFixed(3)})`,
            alignItems: "center",
            justifyContent: "center",
            opacity: 1 - introOut,
          }}
        >
          {(() => {
            const rise = (d: number) => {
              const t = interpolate(frame, [d, d + 16], [0, 1], { ...clamp, easing: OUT });
              return { opacity: t, transform: `translateY(${((1 - t) * 34 * unit).toFixed(1)}px)` };
            };
            const bar = interpolate(frame, [14, 44], [0, 1], { ...clamp, easing: OUT });
            const blink = Math.floor(frame / 12) % 2 === 0;
            return (
              <div
                style={{
                  width: wide ? contentW * 0.62 : contentW,
                  boxSizing: "border-box",
                  padding: `${48 * unit}px ${40 * unit}px`,
                  backgroundColor: "rgba(8, 13, 24, 0.94)",
                  border: `${1.5 * unit}px solid ${LINE}`,
                  borderTop: `${5 * unit}px solid ${UP}`,
                  borderRadius: 20 * unit,
                  boxShadow: `0 ${30 * unit}px ${80 * unit}px rgba(0,0,0,0.6)`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 26 * unit,
                  marginTop: wide ? -60 * unit : -240 * unit,
                  opacity: interpolate(frame, [0, 8], [0, 1], clamp),
                  transform: `scale(${(1 + introOut * 0.04).toFixed(4)})`,
                }}
              >
                <div
                  style={{
                    ...rise(2),
                    display: "flex",
                    alignItems: "center",
                    gap: 12 * unit,
                    padding: `${10 * unit}px ${22 * unit}px`,
                    borderRadius: 999,
                    border: `${2 * unit}px solid ${UP}`,
                    backgroundColor: "rgba(22, 199, 132, 0.12)",
                    color: UP,
                    fontFamily: DATA,
                    fontWeight: 800,
                    fontSize: 26 * unit,
                    letterSpacing: "0.1em",
                  }}
                >
                  <span style={{ width: 14 * unit, height: 14 * unit, borderRadius: 99, backgroundColor: UP, opacity: blink ? 1 : 0.3 }} />
                  {vt("PHIÊN MỞ CỬA")}
                </div>
                <div style={{ ...rise(8), fontFamily: TEXT, fontWeight: 800, fontSize: titleSize, lineHeight: 1.22, color: INK, textWrap: "balance" }}>
                  {title}
                </div>
                <div style={{ width: `${(bar * 38).toFixed(1)}%`, height: 5 * unit, borderRadius: 9, backgroundColor: accent }} />
                {subtitle ? (
                  <div style={{ ...rise(16), fontFamily: TEXT, fontWeight: 400, fontSize: 40 * unit, lineHeight: 1.4, color: "#b9c4d8", textWrap: "balance" }}>
                    {subtitle}
                  </div>
                ) : null}
                <div
                  style={{
                    ...rise(24),
                    display: "flex",
                    gap: 18 * unit,
                    alignItems: "center",
                    fontFamily: DATA,
                    fontSize: 26 * unit,
                    color: MUTED,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span>{upper(vt("Phiên sáng"))} · 09:15</span>
                  <span>·</span>
                  <span style={{ color: UP }}>{symbol} ▲</span>
                </div>
              </div>
            );
          })()}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
