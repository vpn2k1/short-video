import { AbsoluteFill, interpolate } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { useLayout, useSceneClock } from "../shared";
import { MediaBubble, NameLabel, Narration, Pill, StatBubble, TextBubble, TypingBubble } from "./Bubbles";
import { Backdrop, Composer, Header, LockScreen } from "./Chrome";
import { buildConversation, metricsFor, slotHeight } from "./model";
import { CHAT_FONT, themeFor } from "./theme";
import { useVideoLanguage } from "../../i18n/video";

/**
 * Phong cách "Tin nhắn" — xem skill style-chat.
 *
 * Mỗi caption "Tên: lời nhắn" là một bong bóng; "tôi/mình/tui…" bên phải (xanh), người kia
 * bên trái. Danh sách neo đáy, cuộn lên bằng translateY tính từ chiều cao đo trước bằng canvas.
 * Cảnh: `tag` → mốc thời gian, `image` → tin nhắn ảnh/video, `visual` → số lớn / nhãn hệ thống,
 * `punch` → chữ đậm gạch chân + thả cảm xúc. Khung ngang/vuông: cột điện thoại ở giữa.
 */
export const ChatStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  background,
  captions,
  scenes,
  showTitle,
}) => {
  const { frame, scene } = useSceneClock(scenes);
  const { width, height, safe, fps } = useLayout();
  const theme = themeFor(background);

  const contentH = height - safe.top - safe.bottom;
  const cardW = Math.min(width - safe.side * 2, height * 0.62, contentH * 0.72);
  const cardH = contentH;
  const cardLeft = (width - cardW) / 2;
  const u = cardW / 840;
  const headerH = 150 * u;
  const composerH = 126 * u;
  const listPadX = 26 * u;
  const listW = cardW - listPadX * 2;
  const viewportH = cardH - headerH - composerH;
  const bottomPad = 20 * u;
  const m = metricsFor(u, listW);

  const introEnd = showTitle ? TITLE_FRAMES : 0;
  const language = useVideoLanguage();
  const { items, contact, group } = buildConversation(captions, scenes, title, introEnd, m, language);

  const slots = items.map((it) => slotHeight(it, frame, m));
  const total = slots.reduce((a, b) => a + b, 0);
  let cursor = viewportH - bottomPad - total;

  // Người "tôi" đang gõ → chữ hiện dần trong ô soạn tin.
  const typingMe = items.find(
    (it) => it.kind === "text" && it.side === "right" && it.typingStart !== null && frame >= it.typingStart && frame < it.appear,
  );
  let typed: string | null = null;
  if (typingMe && typingMe.kind === "text" && typingMe.typingStart !== null) {
    const chars = [...typingMe.plain];
    const p = (frame - typingMe.typingStart + 1) / Math.max(1, typingMe.appear - typingMe.typingStart);
    typed = chars.slice(0, Math.max(1, Math.ceil(chars.length * Math.min(1, p)))).join("");
  }

  const firstClock = scenes.map((s) => s.tag?.match(/\b\d{1,2}:\d{2}\b/)?.[0]).find(Boolean) ?? "9:41";
  const chatIn = showTitle
    ? interpolate(frame, [TITLE_FRAMES - 16, TITLE_FRAMES - 2], [0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const common = { frame, fps, m, theme };

  return (
    <AbsoluteFill style={{ fontFamily: CHAT_FONT }}>
      <Backdrop scene={scene} background={background} accent={accent} theme={theme} />

      <div
        style={{
          position: "absolute",
          left: cardLeft,
          top: safe.top,
          width: cardW,
          height: cardH,
          borderRadius: 56 * u,
          overflow: "hidden",
          backgroundColor: theme.screen,
          boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.45), 0 0 0 ${Math.max(1, 2 * u)}px ${theme.dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"}`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `scale(${chatIn})` }}>
          <div
            style={{
              position: "absolute",
              left: listPadX,
              top: headerH,
              width: listW,
              height: viewportH,
              overflow: "hidden",
            }}
          >
            {items.map((it, i) => {
              const slot = slots[i];
              const top = cursor + it.gapBefore;
              cursor += slot;
              const typing = it.typingStart !== null && frame >= it.typingStart && frame < it.appear + 3;
              if (slot <= 0 && !typing) return null;
              const tall = Math.max(it.height, m.typingH + m.nameH);
              if (top + tall < -40 * u || top > viewportH) return null;
              const side = it.side === "right" ? "right" : "left";
              return (
                <div key={it.key} style={{ position: "absolute", left: 0, top, width: listW, height: it.height }}>
                  {typing && it.typingStart !== null ? (
                    <div style={{ position: "absolute", left: 0, top: 0, width: listW }}>
                      {it.kind === "text" && it.showName && it.speaker && frame < it.appear ? (
                        <NameLabel name={it.speaker} m={m} theme={theme} />
                      ) : null}
                      <div style={{ marginTop: it.kind === "text" && it.showName && frame >= it.appear ? m.nameH : 0 }}>
                        <TypingBubble {...common} side={side} start={it.typingStart} appear={it.appear} />
                      </div>
                    </div>
                  ) : null}
                  {frame >= it.appear ? (
                    <div style={{ position: "absolute", left: 0, top: 0, width: listW }}>
                      {it.kind === "text" ? <TextBubble {...common} item={it} /> : null}
                      {it.kind === "media" ? <MediaBubble {...common} item={it} /> : null}
                      {it.kind === "stat" ? <StatBubble {...common} item={it} accent={accent} /> : null}
                      {it.kind === "divider" || it.kind === "badge" ? <Pill {...common} item={it} accent={accent} /> : null}
                      {it.kind === "narration" ? <Narration {...common} item={it} /> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <Header m={m} theme={theme} accent={accent} contact={contact} group={group} height={headerH} />
          <Composer m={m} theme={theme} height={composerH} typed={typed} frame={frame} />
        </div>

        {showTitle && frame < TITLE_FRAMES ? (
          <LockScreen
            frame={frame}
            fps={fps}
            m={m}
            theme={theme}
            title={title}
            subtitle={subtitle}
            clock={firstClock}
            scene={scenes[0] ?? null}
            background={background}
            accent={accent}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
