/**
 * Phong cách "Podcast" — clip podcast / audiogram. Xem skill `.claude/skills/style-podcast/SKILL.md`.
 *
 * Phòng thu tối ấm. Thẻ tập bo góc: đầu thẻ (micro, tên chương trình = handle, "TẬP n", "● ĐANG PHÁT"),
 * ảnh/clip của cảnh trong khung lớn, hàng sóng âm nhảy theo lời đọc (cao khi đang nói, êm ở khoảng lặng),
 * thanh tiến độ có thời gian đã phát. Dưới (dọc) hoặc bên phải (ngang/vuông) là thẻ trích dẫn: dấu ngoặc kép
 * lớn, mỗi lúc một câu, từ sáng dần theo nhịp đọc ước lượng. `tag` là bảng tên khách mời / chương,
 * `punch` được tô bút dạ màu nhấn và thẻ trích dẫn nảy lên kèm nhãn "Câu đáng nhớ", `visual` là thẻ con số.
 *
 * Thứ tự lớp: nền phòng thu → thẻ tập (đầu thẻ, ảnh, bảng tên, thẻ số, sóng, tiến độ) → thẻ trích dẫn → màn tiêu đề.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { AbsoluteFill, Easing, interpolate, interpolateColors, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Caption, Scene, ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { useCaptionClock, useLayout, useSceneClock } from "../shared";
import { BubbleIcon, Header, MediaFrame, Scrubber, StatCard, Studio, TagPlate, Waveform } from "./parts";
import {
  alpha, captionFrames, clamp, CREAM, EMPTY_SCENE, episodeNumber, geometry, MUTED, PODCAST_FONTS, punchRange, SANS, SERIF,
  showName, speechLevel, wordTimes, type Rect,
} from "./podcast";
import { PodcastTitle } from "./TitleIntro";

const DIM = "rgba(255, 244, 234, 0.3)";

/** Cỡ chữ lớn nhất để câu vừa khung w × h (ước lượng bề rộng ký tự Be Vietnam Pro đậm ≈ 0.56em). */
const fitQuote = (text: string, w: number, h: number, base: number, min: number) => {
  const chars = Math.max(1, [...text].length);
  const byArea = Math.sqrt((w * h) / (chars * 0.58 * 1.36)) * 0.9;
  return Math.max(min, Math.min(base, byArea));
};

// ---------------------------------------------------------------------------
// Thẻ trích dẫn
// ---------------------------------------------------------------------------
const Quote: React.FC<{
  rect: Rect; pad: number; captions: Caption[]; scene: Scene; title: string; handle: string; showTitle: boolean; accent: string; unit: number; stacked: boolean;
}> = ({ rect, pad, captions, scene, title, handle, showTitle, accent, unit, stacked }) => {
  const frame = useCurrentFrame();
  const { caption, startFrame, index } = useCaptionClock(captions);
  const titleEnd = showTitle ? TITLE_FRAMES - 6 : 0;

  // Câu hiện tại; trước câu đầu tiên thì hiện tiêu đề mờ làm lời dẫn.
  const text = caption ? caption.text.normalize("NFC").trim() : title.normalize("NFC").trim();
  const frames = caption ? captionFrames(caption) : { start: 0, end: 1 };
  const words = caption ? wordTimes(text, frames.start, frames.end) : [];
  const enterAt = Math.max(caption ? startFrame : 0, titleEnd);
  const enter = interpolate(frame, [enterAt, enterAt + 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  // Câu nhấn của cảnh: chỉ tính khi câu đang hiện nằm trong cảnh này.
  const punch = scene.punch;
  const punchAt = punch ? msToFrames(punch.atMs) : Number.POSITIVE_INFINITY;
  const inScene = caption ? caption.startMs >= scene.startMs - 50 && caption.startMs < scene.endMs : false;
  const punchOn = Boolean(punch) && frame >= punchAt && frame < msToFrames(scene.endMs) + 10;
  const range = punch && inScene ? punchRange(words, punch.text) : null;
  const bump = punchOn ? interpolate(frame, [punchAt, punchAt + 6, punchAt + 18], [0, 1, 0], clamp) : 0;
  const labelT = punchOn ? interpolate(frame, [punchAt, punchAt + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) }) : 0;
  const sweep = range ? interpolate(frame, [punchAt, punchAt + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }) : 0;

  /** Các từ [from, to): mờ lúc chưa đọc tới, sáng dần khi giọng đọc đi qua; trong vệt bút dạ thì trắng hẳn. */
  const renderWords = (from: number, to: number, onMarker = false) =>
    words.slice(from, to).map((w, k) => {
      const lit = interpolate(frame, [w.at - 1, w.at + 4], [0, 1], clamp);
      return (
        <span key={from + k}>
          <span style={{ color: onMarker ? "#ffffff" : interpolateColors(lit, [0, 1], [DIM, CREAM]) }}>{w.text}</span>
          {from + k < to - 1 ? " " : ""}
        </span>
      );
    });

  const narrow = rect.w < 560 * unit;
  const markSize = (stacked ? 250 : narrow ? 170 : 220) * unit;
  const top = markSize * 0.3;
  const labelH = 54 * unit;
  const areaW = rect.w - pad * 2;
  const footH = 84 * unit;
  const areaH = rect.h - top - footH - (stacked ? 0 : labelH);
  const fontSize = fitQuote(text, areaW, areaH, (stacked ? 74 : narrow ? 60 : 88) * unit, 30 * unit);

  // Cụm nhấn không có nguyên văn trong câu → hiện luôn cụm đó trong nhãn.
  const labelBase = narrow ? "Đáng nhớ" : "Câu đáng nhớ";
  const labelText = punch && !range ? `${labelBase}: ${punch.text.normalize("NFC").trim()}` : labelBase;
  // Lời trích của ai: tên trong tag "Khách mời: …" nếu có, không thì tên chương trình.
  const tagName = scene.tag?.normalize("NFC").match(/^[^:]{1,18}:\s*(.+)$/)?.[1]?.trim();
  const speaker = tagName || showName(handle);

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: 38 * unit,
        backgroundColor: punchOn ? alpha(accent, 9) : "rgba(255, 244, 234, 0.045)",
        border: `${2 * unit}px solid ${punchOn ? alpha(accent, 55) : "rgba(255, 244, 234, 0.1)"}`,
        boxShadow: punchOn ? `0 0 ${(30 + bump * 40) * unit}px ${alpha(accent, 22 + bump * 25)}` : `0 ${16 * unit}px ${40 * unit}px rgba(0,0,0,0.3)`,
        scale: String(1 + bump * 0.035),
      }}
    >
      {/* Dấu ngoặc kép lớn trồi khỏi mép trên thẻ. */}
      <div
        style={{
          position: "absolute",
          left: pad - 10 * unit,
          top: -markSize * 0.24,
          fontFamily: SERIF,
          fontWeight: 900,
          fontSize: markSize,
          lineHeight: 1,
          color: accent,
          textShadow: `0 ${6 * unit}px ${20 * unit}px rgba(0,0,0,0.4)`,
          scale: String(1 + bump * 0.12),
        }}
      >
        “
      </div>
      {/* Nhãn "Câu đáng nhớ". */}
      {punch && labelT > 0 ? (
        <div
          style={{
            position: "absolute",
            right: pad - 16 * unit,
            top: -labelH / 2,
            maxWidth: rect.w - pad - markSize * 0.7,
            height: labelH,
            display: "flex",
            alignItems: "center",
            gap: 10 * unit,
            padding: `0 ${22 * unit}px 0 ${16 * unit}px`,
            borderRadius: 999,
            backgroundColor: accent,
            boxShadow: `0 ${8 * unit}px ${22 * unit}px rgba(0,0,0,0.4)`,
            scale: String(labelT),
            transformOrigin: "right center",
          }}
        >
          <BubbleIcon size={28 * unit} color="#ffffff" />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24 * unit, lineHeight: 1.2, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {labelText}
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: pad,
          right: pad,
          top,
          bottom: footH,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          key={index}
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize,
            lineHeight: 1.36,
            letterSpacing: -fontSize * 0.005,
            color: caption ? CREAM : MUTED,
            opacity: enter,
            translate: `0 ${((1 - enter) * 22 * unit).toFixed(1)}px`,
            textWrap: "pretty",
          }}
        >
          {caption ? (
            range ? (
              <>
                {renderWords(0, range[0])}
                {range[0] > 0 ? " " : ""}
                {/* Cụm nhấn: một vệt bút dạ màu nhấn quét liền từ trái sang phải qua cả cụm. */}
                <span
                  style={{
                    backgroundImage: `linear-gradient(${accent}, ${accent})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `${(sweep * 100).toFixed(1)}% 100%`,
                    borderRadius: 10 * unit,
                    padding: "0.02em 0.14em",
                    margin: "0 -0.08em",
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                  }}
                >
                  {renderWords(range[0], range[1] + 1, sweep > 0.3)}
                </span>
                {range[1] < words.length - 1 ? " " : ""}
                {renderWords(range[1] + 1, words.length)}
              </>
            ) : (
              renderWords(0, words.length)
            )
          ) : (
            text
          )}
        </div>
      </div>
      {/* Ký tên người nói ở chân thẻ. */}
      <div
        style={{
          position: "absolute",
          left: pad,
          right: pad,
          bottom: 34 * unit,
          display: "flex",
          alignItems: "center",
          gap: 14 * unit,
          opacity: caption ? 1 : 0,
        }}
      >
        <div style={{ width: 36 * unit, height: 3 * unit, borderRadius: 3 * unit, backgroundColor: accent, flexShrink: 0 }} />
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26 * unit, lineHeight: 1.3, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {speaker}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phong cách
// ---------------------------------------------------------------------------
export const PodcastStyle: React.FC<ShortProps> = ({ title, subtitle, handle, accent, captions, scenes, showTitle }) => {
  ensureFonts(PODCAST_FONTS);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { width, height, safe, unit } = useLayout();
  const clock = useSceneClock(scenes);
  const g = geometry(width, height, safe, unit);
  const episode = episodeNumber(title, subtitle);

  const scene = clock.scene ?? scenes[0] ?? EMPTY_SCENE;
  const prev = clock.index > 0 ? scenes[clock.index - 1] : null;
  const localFrame = clock.scene ? clock.localFrame : frame;
  const level = speechLevelSafe(captions, frame);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  // Không có màn tiêu đề: thẻ trượt nhẹ lên trong 12 frame đầu.
  const rise = showTitle ? 1 : interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cover = scenes.find((s) => s.image)?.image ?? null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#140e0b" }}>
      <Studio accent={accent} level={level} glowAt={{ x: g.media.x + g.media.w / 2, y: g.media.y + g.media.h / 2 }} />
      <AbsoluteFill style={{ opacity: rise, translate: `0 ${((1 - rise) * 30 * unit).toFixed(1)}px` }}>
        {/* Thẻ tập. */}
        <div
          style={{
            position: "absolute",
            left: g.card.x,
            top: g.card.y,
            width: g.card.w,
            height: g.card.h,
            borderRadius: 48 * unit,
            backgroundImage: "linear-gradient(180deg, rgba(255, 236, 220, 0.085), rgba(255, 236, 220, 0.035))",
            border: `${2 * unit}px solid rgba(255, 236, 220, 0.1)`,
            boxShadow: `0 ${30 * unit}px ${80 * unit}px rgba(0,0,0,0.5), inset 0 ${1.5 * unit}px 0 rgba(255,255,255,0.06)`,
          }}
        />
        <Header rect={g.header} handle={handle} episode={episode} accent={accent} unit={unit} compact={g.header.w < 620 * unit} />
        <MediaFrame
          rect={g.media}
          scene={scene}
          prev={prev}
          localFrame={localFrame}
          durationFrames={clock.durationFrames}
          handle={handle}
          accent={accent}
          level={level}
          unit={unit}
        />
        {scene.tag ? <TagPlate key={`tag-${clock.index}`} media={g.media} tag={scene.tag} localFrame={localFrame} accent={accent} unit={unit} /> : null}
        {scene.visual ? <StatCard media={g.media} visual={scene.visual} localFrame={localFrame} accent={accent} unit={unit} /> : null}
        <Waveform rect={g.wave} level={level} progress={progress} accent={accent} unit={unit} />
        <Scrubber rect={g.scrub} frame={frame} accent={accent} unit={unit} />
        <Quote
          rect={g.quote}
          pad={g.quotePad}
          captions={captions}
          scene={scene}
          title={title}
          handle={handle}
          showTitle={showTitle}
          accent={accent}
          unit={unit}
          stacked={g.stacked}
        />
      </AbsoluteFill>
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <PodcastTitle title={title} subtitle={subtitle} handle={handle} accent={accent} coverImage={cover} episode={episode} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

/** Mức đang nói, có chặn NaN phòng khi dữ liệu câu hỏng. */
const speechLevelSafe = (captions: Caption[], frame: number) => {
  const v = speechLevel(captions, frame);
  return Number.isFinite(v) ? v : 0;
};
