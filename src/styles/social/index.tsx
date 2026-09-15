import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { Scene, SceneVisual, ShortProps } from "../../compositions/Short/schema";
import { activeIndexAt, useLayout } from "../shared";
import { Backdrop } from "./Backdrop";
import { BellIcon, HeartIcon } from "./Icons";
import {
  captionsOfScene,
  communityOf,
  countsAt,
  displayNameOf,
  fitBody,
  HEADLINE_WEIGHT,
  hoursAgo,
  SOCIAL_FONT,
  tokenize,
  wrapText,
} from "./model";
import { CARD, chromeHeight, postHeight, PostCard, type PostSpec, type TextBlock } from "./PostCard";

/**
 * Phong cách "Bài đăng MXH" — xem skill style-social.
 *
 * Mỗi cảnh là một thẻ bài đăng sáng giữa khung trên nền ảnh mờ tối. Mọi caption của cảnh
 * nối thành thân bài, từ hiện dần theo lời đọc; thẻ cao dần theo dòng. Đổi cảnh: thẻ cũ bay
 * lên, thẻ mới trượt từ dưới (timeline tuyệt đối, không TransitionSeries).
 * `tag` → chip cộng đồng "r/…", `punch` → bút dạ quét + tim đỏ, `visual` stat → pill tương tác
 * trên thẻ, badge → nhãn dán ở mép trên thẻ. `captionPosition` "bottom" hạ nhóm thẻ xuống 3%.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EXIT_FRAMES = 11;
const ENTER_DELAY = 4;

const STAT_H = 92;
const STAT_GAP = 30;
const BADGE_RESERVE = 34;

const reserveFor = (visual: SceneVisual | null) =>
  (visual?.type === "stat" ? STAT_H + STAT_GAP : 0) + (visual?.type === "badge" ? BADGE_RESERVE : 0);

const block = (text: string, base: number, min: number, weight: number, maxWidth: number, maxLines: number, ratio: number): TextBlock | null => {
  if (!text.trim()) return null;
  let size = base;
  let lines = wrapText(text, size, weight, maxWidth);
  while (size > min && lines.length > maxLines) {
    size -= 2;
    lines = wrapText(text, size, weight, maxWidth);
  }
  return { lines, fontSize: size, lineH: Math.round(size * ratio) };
};

const StatPill: React.FC<{ visual: SceneVisual; u: number; accent: string; frame: number; enterFrame: number }> = ({
  visual,
  u,
  accent,
  frame,
  enterFrame,
}) => {
  const t = frame - enterFrame - 10;
  const s = interpolate(t, [0, 6, 12], [0, 1.12, 1], clamp);
  const beat = interpolate((Math.max(0, t) % 36), [0, 5, 12, 36], [1, 1.22, 1, 1], clamp);
  return (
    <div style={{ height: STAT_H * u, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          height: STAT_H * u,
          padding: `0 ${40 * u}px 0 ${30 * u}px`,
          borderRadius: 999,
          backgroundColor: accent,
          display: "flex",
          alignItems: "center",
          gap: 16 * u,
          color: "#fff",
          whiteSpace: "nowrap",
          boxShadow: `0 ${14 * u}px ${36 * u}px rgba(0,0,0,0.4)`,
          transform: `scale(${s})`,
        }}
      >
        <div style={{ display: "flex", transform: `scale(${beat})` }}>
          <HeartIcon size={48 * u} color="#fff" fill="#fff" stroke={1} />
        </div>
        <span style={{ fontSize: 50 * u, fontWeight: 850, fontVariantNumeric: "tabular-nums" }}>{visual.text}</span>
        {visual.caption ? <span style={{ fontSize: 34 * u, fontWeight: 600, opacity: 0.92 }}>{visual.caption}</span> : null}
      </div>
    </div>
  );
};

export const SocialStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  captions,
  scenes: rawScenes,
  showTitle,
  captionPosition,
}) => {
  const { width, height, safe, unit, fps, portrait } = useLayout();
  // Không có cảnh → cả video là một thẻ.
  const scenes: Scene[] = rawScenes.length
    ? rawScenes
    : [
        {
          image: null,
          visual: null,
          tag: null,
          punch: null,
          trimStartMs: 0,
          volume: 0,
          crop: null,
          startMs: 0,
          endMs: captions.reduce((m, c) => Math.max(m, c.endMs), 0),
        },
      ];
  const frame = useCurrentFrame();
  const index = Math.max(0, activeIndexAt(scenes, frame));

  const u = unit;
  const cardW = portrait ? Math.min(width * 0.88, 960 * u) : Math.min(width - safe.side * 2, 1150 * u);
  const bodyW = cardW - CARD.padX * 2 * u;
  const contentH = height - safe.top - safe.bottom;
  const centerY = safe.top + contentH * (captionPosition === "bottom" ? 0.53 : 0.5);
  const name = displayNameOf(handle);
  const introEnd = showTitle ? TITLE_FRAMES : 0;

  const enterOf = (i: number) => (i === 0 ? (showTitle ? TITLE_FRAMES - 8 : 0) : msToFrames(scenes[i].startMs));

  const specFor = (i: number): PostSpec => {
    const scene = scenes[i];
    const enter = enterOf(i);
    const minAppear = Math.max(enter + 6, i === 0 ? introEnd : 0);
    const caps = captionsOfScene(captions, scenes, i);
    const atFrame = scene.punch ? Math.max(minAppear, msToFrames(scene.punch.atMs)) : null;
    const { words, match } = tokenize(caps, scene.punch?.text ?? null, minAppear);
    if (match && atFrame !== null) {
      for (const w of words) if (w.punch) w.appear = Math.min(w.appear, atFrame);
    }
    const headline = i === 0 ? block(title, 46 * u, 36 * u, HEADLINE_WEIGHT, bodyW, 2, 1.24) : null;
    const chip =
      scene.punch && !match ? block(`“${scene.punch.text.normalize("NFC").trim()}”`, 42 * u, 32 * u, 800, bodyW - 64 * u, 2, 1.25) : null;

    const maxCardH = contentH - reserveFor(scene.visual) * u;
    let fixed = chromeHeight(u);
    if (headline) fixed += headline.lines.length * headline.lineH + CARD.afterHeadline * u;
    if (chip) fixed += chip.lines.length * chip.lineH + (CARD.chipPadY * 2 + CARD.chipGap) * u;
    const fit = fitBody(words, bodyW, maxCardH - fixed, 54 * u, 30 * u);

    const endF = i < scenes.length - 1 ? msToFrames(scenes[i + 1].startMs) : Math.max(enter + 1, msToFrames(scene.endMs));
    return {
      cardW,
      u,
      accent,
      name,
      community: communityOf(scene.tag),
      timeLabel: `${hoursAgo(title)} giờ`,
      headline,
      subtitle: null,
      body: {
        lines: fit.lines,
        fontSize: fit.fontSize,
        lineH: fit.lineH,
        captionStarts: caps.map((c) => Math.max(minAppear, msToFrames(c.startMs))),
        match,
      },
      punch: atFrame !== null ? { atFrame, chip } : null,
      counts: countsAt(title, i, scenes.length, (frame - enter) / Math.max(1, endF - enter)),
      likeAt: atFrame,
      badge: scene.visual?.type === "badge" ? scene.visual.text : null,
    };
  };

  // Thẻ đang hiện: thẻ hiện tại + thẻ trước còn đang bay ra.
  const visible: number[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const enter = enterOf(i);
    const exit = i < scenes.length - 1 ? msToFrames(scenes[i + 1].startMs) : Infinity;
    if (frame >= enter && frame < exit + EXIT_FRAMES) visible.push(i);
  }

  return (
    <AbsoluteFill style={{ fontFamily: SOCIAL_FONT }}>
      <Backdrop scenes={scenes} index={index} frame={frame} accent={accent} unit={unit} />

      {/* Vẽ thẻ mới trước, thẻ đang bay ra sau → thẻ cũ nằm trên, lướt qua thẻ mới. */}
      {[...visible].reverse().map((i) => {
        const scene = scenes[i];
        const spec = specFor(i);
        const enter = enterOf(i);
        const exit = i < scenes.length - 1 ? msToFrames(scenes[i + 1].startMs) : Infinity;
        const cardH = postHeight(spec, frame);
        const reserve = reserveFor(scene.visual) * u;
        const groupH = reserve + cardH;
        const top = Math.max(safe.top, Math.min(centerY - groupH / 2, safe.top + contentH - groupH));

        // Thẻ sau chờ vài frame cho thẻ trước kịp bay lên rồi mới trượt vào.
        const delay = i > 0 ? ENTER_DELAY : 0;
        const s = spring({ frame: frame - enter - delay, fps, config: { damping: 17, stiffness: 120, mass: 0.8 } });
        const inY = (1 - s) * height * 0.75;
        const inOpacity = interpolate(frame - enter - delay, [0, 5], [0, 1], clamp);
        const e = Number.isFinite(exit) ? interpolate(frame - exit, [0, EXIT_FRAMES], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;
        const outY = -e * (top + groupH + 80 * u);
        const outOpacity = 1 - interpolate(e, [0.55, 1], [0, 1], clamp);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (width - cardW) / 2,
              top,
              width: cardW,
              transform: `translateY(${inY + outY}px) rotate(${-5 * e + (1 - s) * 3}deg) scale(${0.96 + 0.04 * s})`,
              opacity: inOpacity * outOpacity,
            }}
          >
            {scene.visual?.type === "stat" ? (
              <div style={{ marginBottom: STAT_GAP * u }}>
                <StatPill visual={scene.visual} u={u} accent={accent} frame={frame} enterFrame={enter} />
              </div>
            ) : null}
            {scene.visual?.type === "badge" ? <div style={{ height: BADGE_RESERVE * u }} /> : null}
            <PostCard spec={spec} frame={frame} enterFrame={enter} />
          </div>
        );
      })}

      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES} layout="none">
          <TitleIntro
            title={title}
            subtitle={subtitle}
            name={name}
            accent={accent}
            community={communityOf(scenes[0]?.tag ?? null)}
            cardW={cardW}
            bodyW={bodyW}
            u={u}
            centerY={centerY}
            frame={frame}
            fps={fps}
          />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

const TitleIntro: React.FC<{
  title: string;
  subtitle: string;
  name: string;
  accent: string;
  community: string | null;
  cardW: number;
  bodyW: number;
  u: number;
  centerY: number;
  frame: number;
  fps: number;
}> = ({ title, subtitle, name, accent, community, cardW, bodyW, u, centerY, frame, fps }) => {
  const { width } = useLayout();
  const spec: PostSpec = {
    cardW,
    u,
    accent,
    name,
    community,
    timeLabel: "vừa xong",
    headline: block(title, 64 * u, 40 * u, HEADLINE_WEIGHT, bodyW, 3, 1.2),
    subtitle: block(subtitle, 40 * u, 32 * u, 500, bodyW, 2, 1.3),
    body: null,
    punch: null,
    counts: countsAt(title, -1, 1, frame / TITLE_FRAMES),
    likeAt: null,
    badge: null,
  };
  const pillH = 70 * u;
  const gap = 26 * u;
  const cardH = postHeight(spec, frame);
  const top = centerY - (cardH + pillH + gap) / 2;

  const s = spring({ frame, fps, config: { damping: 12, stiffness: 150, mass: 0.7 } });
  const pill = spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 170, mass: 0.6 } });
  const e = interpolate(frame, [TITLE_FRAMES - 12, TITLE_FRAMES - 1], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const ring = interpolate(frame, [4, 10, 16, 22, 28], [0, 18, -14, 8, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: (width - cardW) / 2,
        top,
        width: cardW,
        opacity: interpolate(frame, [0, 4], [0, 1], clamp) * (1 - interpolate(e, [0.5, 1], [0, 1], clamp)),
        transform: `translateY(${(1 - s) * -180 * u - e * (top + cardH + 200 * u)}px) scale(${0.86 + 0.14 * s}) rotate(${-4 * e}deg)`,
      }}
    >
      <div style={{ height: pillH, marginBottom: gap, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            height: pillH,
            padding: `0 ${30 * u}px 0 ${22 * u}px`,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.16)",
            border: `${Math.max(1, 2 * u)}px solid rgba(255,255,255,0.28)`,
            display: "flex",
            alignItems: "center",
            gap: 14 * u,
            color: "#fff",
            fontSize: 32 * u,
            fontWeight: 650,
            whiteSpace: "nowrap",
            transform: `scale(${pill})`,
          }}
        >
          <div
            style={{
              width: 46 * u,
              height: 46 * u,
              borderRadius: "50%",
              backgroundColor: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `rotate(${ring}deg)`,
            }}
          >
            <BellIcon size={28 * u} color="#fff" />
          </div>
          Bài đăng mới
        </div>
      </div>
      <PostCard spec={spec} frame={frame} enterFrame={0} />
    </div>
  );
};
