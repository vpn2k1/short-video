import { Img, interpolate, Sequence, spring, staticFile } from "remotion";
import { ClipVideo } from "../../scenes/ClipVideo";
import { CropBox } from "../../scenes/CropBox";
import type { Line, MediaItem, Metrics, NarrationItem, PillItem, StatItem, TextItem } from "./model";
import { CHAT_FONT, withAlpha, type ChatTheme } from "./theme";

/** "image" của cảnh có thể là video người dùng tải lên. */
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

type Common = { frame: number; fps: number; m: Metrics; theme: ChatTheme };

/** Bật ra từ phía người gửi: scale có nảy nhẹ + hiện nhanh. */
const pop = (frame: number, start: number, fps: number) => {
  const s = spring({ frame: frame - start, fps, config: { damping: 13, stiffness: 210, mass: 0.6 } });
  return {
    scale: 0.35 + 0.65 * s,
    opacity: interpolate(frame, [start, start + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  };
};

/** Bo góc kiểu Messenger: góc sát đuôi nhỏ lại ở bong bóng cuối lượt, góc nối nhỏ ở giữa lượt. */
const bubbleRadius = (side: "left" | "right" | "center", tail: boolean, m: Metrics) => {
  const r = m.radius;
  const t = tail ? m.tailRadius : r * 0.45;
  return side === "right" ? `${r}px ${r}px ${t}px ${r}px` : `${r}px ${r}px ${r}px ${t}px`;
};

const TextLines: React.FC<{ lines: Line[]; m: Metrics; color: string }> = ({ lines, m, color }) => (
  <>
    {lines.map((line, li) => (
      <div
        key={li}
        style={{ height: m.lineH, lineHeight: `${m.lineH}px`, whiteSpace: "nowrap", color }}
      >
        {line.words.map((word, wi) => {
          const nextBold = line.words[wi + 1]?.bold ?? false;
          const style: React.CSSProperties = word.bold
            ? { fontWeight: 700, textDecoration: "underline", textDecorationThickness: 3 * m.u, textUnderlineOffset: 6 * m.u }
            : {};
          return (
            <span key={wi}>
              <span style={style}>{word.text}</span>
              {wi < line.words.length - 1 ? <span style={word.bold && nextBold ? style : undefined}> </span> : null}
            </span>
          );
        })}
      </div>
    ))}
  </>
);

export const NameLabel: React.FC<{ name: string; m: Metrics; theme: ChatTheme }> = ({ name, m, theme }) => (
  <div
    style={{
      height: m.nameH,
      lineHeight: `${m.nameH}px`,
      paddingLeft: m.padX,
      fontSize: m.nameSize,
      fontWeight: 500,
      color: theme.secondary,
      whiteSpace: "nowrap",
    }}
  >
    {name}
  </div>
);

export const TypingBubble: React.FC<Common & { side: "left" | "right"; start: number; appear: number }> = ({
  frame,
  fps,
  m,
  theme,
  side,
  start,
  appear,
}) => {
  const { scale, opacity } = pop(frame, start, fps);
  const out = interpolate(frame, [appear, appear + 3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bg = side === "right" ? theme.outgoing : theme.incoming;
  const dot = side === "right" ? "rgba(255,255,255,0.95)" : theme.dark ? "#9A9AA0" : "#8E8E93";
  return (
    <div
      style={{
        width: m.typingW,
        height: m.typingH,
        borderRadius: m.typingH / 2,
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14 * m.u,
        opacity: opacity * out,
        transform: `scale(${scale})`,
        transformOrigin: side === "right" ? "bottom right" : "bottom left",
        marginLeft: side === "right" ? "auto" : 0,
      }}
    >
      {[0, 1, 2].map((d) => {
        const phase = Math.sin((frame - start) * 0.42 - d * 1.1);
        const lift = Math.max(0, phase);
        return (
          <div
            key={d}
            style={{
              width: 17 * m.u,
              height: 17 * m.u,
              borderRadius: "50%",
              backgroundColor: dot,
              opacity: 0.45 + 0.55 * lift,
              transform: `translateY(${-lift * 9 * m.u}px)`,
            }}
          />
        );
      })}
    </div>
  );
};

export const TextBubble: React.FC<Common & { item: TextItem }> = ({ frame, fps, m, theme, item }) => {
  const side = item.side === "right" ? "right" : "left";
  const { scale, opacity } = pop(frame, item.appear, fps);
  const bg = side === "right" ? theme.outgoing : theme.incoming;
  const color = side === "right" ? theme.outgoingText : theme.incomingText;
  const bubbleH = item.lines.length * m.lineH + m.padY * 2;
  const reaction = item.reaction;
  const rs = m.reactionSize;
  const rPop = reaction ? spring({ frame: frame - reaction.at, fps, config: { damping: 9, stiffness: 180, mass: 0.7 } }) : 0;
  return (
    <div style={{ width: "100%", opacity }}>
      {reaction ? <div style={{ height: m.reactionTop }} /> : null}
      {item.showName && item.speaker ? <NameLabel name={item.speaker} m={m} theme={theme} /> : null}
      <div
        style={{
          position: "relative",
          width: item.width,
          height: bubbleH,
          marginLeft: side === "right" ? "auto" : 0,
          transform: `scale(${scale})`,
          transformOrigin: side === "right" ? "bottom right" : "bottom left",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: bubbleRadius(side, item.tail, m),
            backgroundColor: bg,
            padding: `${m.padY}px ${m.padX}px`,
            fontSize: m.fontSize,
            fontFamily: CHAT_FONT,
            overflow: "hidden",
          }}
        >
          <TextLines lines={item.lines} m={m} color={color} />
        </div>
        {reaction && frame >= reaction.at ? (
          <div
            style={{
              position: "absolute",
              top: -rs * 0.62,
              ...(side === "left" ? { right: -rs * 0.28 } : { left: -rs * 0.28 }),
              width: rs,
              height: rs,
              borderRadius: "50%",
              backgroundColor: theme.dark ? "#3A3A3C" : "#E9E9EB",
              border: `${5 * m.u}px solid ${theme.screen}`,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: rs * 0.46,
              lineHeight: 1,
              transform: `scale(${rPop}) rotate(${(1 - rPop) * -30}deg)`,
            }}
          >
            {reaction.emoji}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const MediaBubble: React.FC<Common & { item: MediaItem }> = ({ frame, fps, m, theme, item }) => {
  const side = item.side === "right" ? "right" : "left";
  const { scale, opacity } = pop(frame, item.appear, fps);
  const src = item.scene.image as string;
  return (
    <div
      style={{
        position: "relative",
        width: item.width,
        height: item.height,
        marginLeft: side === "right" ? "auto" : 0,
        borderRadius: bubbleRadius(side, item.tail, m),
        overflow: "hidden",
        backgroundColor: theme.incoming,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: side === "right" ? "bottom right" : "bottom left",
      }}
    >
      {VIDEO_EXT.test(src) ? (
        <Sequence from={item.sceneStart}>
          <ClipVideo src={src} trimStartMs={item.scene.trimStartMs} speed={item.scene.speed} volume={item.scene.volume} crop={item.scene.crop} />
        </Sequence>
      ) : (
        <CropBox crop={item.scene.crop}>
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </CropBox>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          boxShadow: `inset 0 0 0 ${Math.max(1, 1.5 * m.u)}px ${theme.hairline}`,
        }}
      />
    </div>
  );
};

export const StatBubble: React.FC<Common & { item: StatItem; accent: string }> = ({ frame, fps, m, theme, item }) => {
  const side = item.side === "right" ? "right" : "left";
  const { scale, opacity } = pop(frame, item.appear, fps);
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: side === "right" ? "flex-end" : "flex-start",
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: side === "right" ? "bottom right" : "bottom left",
      }}
    >
      <div
        style={{
          fontSize: item.statSize,
          lineHeight: `${item.statSize * 1.08}px`,
          height: item.statSize * 1.08,
          fontWeight: 800,
          letterSpacing: -0.02 * item.statSize,
          whiteSpace: "nowrap",
          color: side === "right" ? theme.outgoing : theme.primaryText,
          padding: `0 ${m.padX * 0.4}px`,
        }}
      >
        {item.text}
      </div>
      {item.caption ? (
        <div
          style={{
            height: m.statCaptionH,
            lineHeight: `${m.statCaptionH}px`,
            fontSize: m.statCaptionSize,
            color: theme.secondary,
            whiteSpace: "nowrap",
            maxWidth: m.bubbleMaxW,
            overflow: "hidden",
            textOverflow: "ellipsis",
            padding: `0 ${m.padX * 0.5}px`,
          }}
        >
          {item.caption}
        </div>
      ) : null}
    </div>
  );
};

export const Pill: React.FC<Common & { item: PillItem; accent: string }> = ({ frame, m, theme, item, accent }) => {
  const opacity = interpolate(frame, [item.appear, item.appear + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badge = item.kind === "badge";
  const text = item.caption ? `${item.text} · ${item.caption}` : item.text;
  return (
    <div
      style={{
        height: item.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${(1 - opacity) * 10 * m.u}px)`,
      }}
    >
      <div
        style={{
          height: m.pillH * 0.78,
          lineHeight: `${m.pillH * 0.78}px`,
          padding: `0 ${24 * m.u}px`,
          borderRadius: m.pillH,
          maxWidth: m.listW * 0.9,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: m.pillSize,
          fontWeight: 600,
          color: badge ? accent : theme.secondary,
          backgroundColor: badge ? withAlpha(accent, theme.dark ? 0.16 : 0.12) : theme.pill,
          border: badge ? `${Math.max(1, 2 * m.u)}px solid ${withAlpha(accent, 0.55)}` : "none",
          boxSizing: "border-box",
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const Narration: React.FC<Common & { item: NarrationItem }> = ({ frame, m, theme, item }) => {
  const opacity = interpolate(frame, [item.appear, item.appear + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        height: item.height,
        paddingTop: 4 * m.u,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
        fontSize: m.narrationSize,
        fontWeight: 500,
        color: theme.secondary,
      }}
    >
      {item.lines.map((line, i) => (
        <div key={i} style={{ height: m.narrationLineH, lineHeight: `${m.narrationLineH}px`, whiteSpace: "nowrap" }}>
          {line.words.map((w) => w.text).join(" ")}
        </div>
      ))}
    </div>
  );
};
