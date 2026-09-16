/**
 * Thẻ bài đăng: header (avatar, tên, tích, giờ, cộng đồng), tiêu đề, thân bài hiện dần,
 * chip trích dẫn, hàng tương tác. Chiều cao tính bằng số — `postHeight` dùng chung cho
 * bố cục ngoài (canh giữa nhóm) và cho chính thẻ, nên hai bên luôn khớp nhau.
 */
import React from "react";
import { Easing, interpolate, interpolateColors } from "remotion";
import { BookmarkIcon, CommentIcon, HeartIcon, MoreIcon, ShareIcon, VerifiedIcon } from "./Icons";
import {
  BODY_WEIGHT,
  formatCount,
  HEADLINE_WEIGHT,
  initialOf,
  PUNCH_WEIGHT,
  SOCIAL_FONT,
  type Counts,
  type Line,
  type PunchMatch,
  type Word,
} from "./model";

export const INK = "#0f1419";
export const MUTED = "#6e7a86";
export const GREY = "#7b8794";
export const HAIRLINE = "#e6e9ec";
export const LIKE = "#f4245e";
export const MARKER = "#ffd53d";

export type TextBlock = { lines: string[]; fontSize: number; lineH: number };

export type PostSpec = {
  cardW: number;
  u: number;
  accent: string;
  name: string;
  community: string | null;
  timeLabel: string;
  headline: TextBlock | null;
  subtitle: TextBlock | null;
  body: {
    lines: Line[];
    fontSize: number;
    lineH: number;
    /** Frame bắt đầu của từng caption trong cảnh (để làm mờ câu cũ). */
    captionStarts: number[];
    match: PunchMatch;
  } | null;
  punch: { atFrame: number; chip: TextBlock | null } | null;
  counts: Counts;
  /** Frame tim được bấm (thường là lúc punch); null = không bấm. */
  likeAt: number | null;
  badge: string | null;
};

const clamp01 = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

/** Kích thước cố định của thẻ, × u. */
export const CARD = {
  padX: 48,
  padTop: 40,
  header: 96,
  afterHeader: 30,
  afterHeadline: 18,
  afterSubtitle: 10,
  chipGap: 26,
  chipPadY: 20,
  footerGap: 30,
  footer: 88,
  padBottom: 14,
};

/** Phần khung không phụ thuộc chữ. */
export const chromeHeight = (u: number) =>
  (CARD.padTop + CARD.header + CARD.afterHeader + CARD.footerGap + CARD.footer + CARD.padBottom) * u;

const blockH = (b: TextBlock | null) => (b ? b.lines.length * b.lineH : 0);

/** Chiều cao thân bài đã hiện ở frame — mỗi dòng mở ra trong 7 frame ngay trước chữ đầu dòng. */
const bodyHeightAt = (spec: PostSpec, frame: number) => {
  if (!spec.body) return 0;
  const { lines, lineH } = spec.body;
  let h = 0;
  for (const line of lines) {
    h += lineH * interpolate(frame, [line.appear - 4, line.appear + 3], [0, 1], { ...clamp01, easing: easeOut });
  }
  return h;
};

const chipHeightAt = (spec: PostSpec, frame: number) => {
  const chip = spec.punch?.chip;
  if (!chip || !spec.punch) return 0;
  const full = blockH(chip) + (CARD.chipPadY * 2 + CARD.chipGap) * spec.u;
  return full * interpolate(frame, [spec.punch.atFrame - 6, spec.punch.atFrame + 2], [0, 1], { ...clamp01, easing: easeOut });
};

export const postHeight = (spec: PostSpec, frame: number) => {
  const { u } = spec;
  let h = chromeHeight(u);
  if (spec.headline) h += blockH(spec.headline);
  if (spec.subtitle) h += CARD.afterSubtitle * u + blockH(spec.subtitle);
  const body = bodyHeightAt(spec, frame);
  if (spec.headline && spec.body) {
    h += CARD.afterHeadline * u * Math.min(1, body / Math.max(1, spec.body.lineH));
  }
  return h + body + chipHeightAt(spec, frame);
};

// ---------------------------------------------------------------- phần tử

const WordSpan: React.FC<{ word: Word; frame: number; captionStarts: number[]; bold?: boolean }> = ({
  word,
  frame,
  captionStarts,
  bold,
}) => {
  const o = interpolate(frame, [word.appear, word.appear + 5], [0, 1], clamp01);
  const next = captionStarts[word.caption + 1];
  const mute = next === undefined ? 0 : interpolate(frame, [next, next + 8], [0, 1], clamp01);
  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        opacity: o,
        transform: `translateY(${(1 - o) * 0.28}em)`,
        color: interpolateColors(mute, [0, 1], [INK, MUTED]),
        fontWeight: bold ? PUNCH_WEIGHT : BODY_WEIGHT,
      }}
    >
      {word.text}
    </span>
  );
};

const PunchSegment: React.FC<{
  words: Word[];
  frame: number;
  captionStarts: number[];
  match: NonNullable<PunchMatch>;
  atFrame: number;
}> = ({ words, frame, captionStarts, match, atFrame }) => {
  const a = Math.max(match.start, words[0].start);
  const b = Math.min(match.end, words[words.length - 1].end);
  const sweepAt = match.start + (match.end - match.start) * interpolate(frame, [atFrame, atFrame + 11], [0, 1], { ...clamp01, easing: Easing.inOut(Easing.quad) });
  const fill = b > a ? Math.min(1, Math.max(0, (sweepAt - a) / (b - a))) : 0;
  const pop = interpolate(frame, [atFrame, atFrame + 5, atFrame + 13], [1, 1.09, 1], clamp01);
  return (
    <span style={{ display: "inline-block", position: "relative", transform: `scale(${pop})`, transformOrigin: "50% 60%" }}>
      <span
        style={{
          position: "absolute",
          left: "-0.12em",
          right: "-0.12em",
          top: "0.16em",
          bottom: "0.1em",
          borderRadius: "0.2em",
          backgroundColor: MARKER,
          transform: `scaleX(${fill}) skewX(-6deg)`,
          transformOrigin: "0 50%",
        }}
      />
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 ? " " : null}
          <WordSpan word={w} frame={frame} captionStarts={captionStarts} bold />
        </React.Fragment>
      ))}
    </span>
  );
};

const Header: React.FC<{ spec: PostSpec }> = ({ spec }) => {
  const { u, accent } = spec;
  const avatar = 92 * u;
  return (
    <div style={{ height: CARD.header * u, display: "flex", alignItems: "center", gap: 22 * u }}>
      <div
        style={{
          width: avatar,
          height: avatar,
          flexShrink: 0,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${accent}, ${interpolateColors(0.35, [0, 1], [accent, "#1b1f24"])})`,
          color: "#fff",
          fontSize: 44 * u,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initialOf(spec.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 * u }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 * u, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 36 * u, fontWeight: 750, color: INK, overflow: "hidden", textOverflow: "ellipsis" }}>{spec.name}</span>
          <VerifiedIcon size={34 * u} color="#1d8cf0" />
          <span style={{ fontSize: 32 * u, fontWeight: 500, color: GREY, flexShrink: 0 }}>· {spec.timeLabel}</span>
        </div>
        {spec.community ? (
          <div style={{ display: "flex" }}>
            <span
              style={{
                fontSize: 27 * u,
                fontWeight: 650,
                color: interpolateColors(0.25, [0, 1], [accent, "#000000"]),
                backgroundColor: interpolateColors(0.88, [0, 1], [accent, "#ffffff"]),
                borderRadius: 999,
                padding: `${4 * u}px ${16 * u}px`,
                whiteSpace: "nowrap",
                maxWidth: spec.cardW * 0.55,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {spec.community}
            </span>
          </div>
        ) : null}
      </div>
      <MoreIcon size={40 * u} color={GREY} />
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; value: number; u: number; color?: string }> = ({ icon, value, u, color = GREY }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 * u }}>
    {icon}
    <span style={{ fontSize: 31 * u, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{formatCount(value)}</span>
  </div>
);

const Footer: React.FC<{ spec: PostSpec; frame: number }> = ({ spec, frame }) => {
  const { u, counts, likeAt } = spec;
  const liked = likeAt !== null && frame >= likeAt;
  const pop = likeAt === null ? 1 : interpolate(frame, [likeAt, likeAt + 4, likeAt + 11], [1, 1.45, 1], clamp01);
  const bump = liked ? 1 + 0.02 * interpolate(frame, [likeAt, likeAt + 10], [0, 1], clamp01) : 1;
  const icon = 42 * u;
  const stroke = 2.1;
  return (
    <div
      style={{
        height: CARD.footer * u,
        borderTop: `${Math.max(1, 2 * u)}px solid ${HAIRLINE}`,
        display: "flex",
        alignItems: "center",
        gap: 64 * u,
        paddingTop: 6 * u,
        boxSizing: "border-box",
      }}
    >
      <Stat
        u={u}
        value={counts.likes * bump}
        color={liked ? LIKE : GREY}
        icon={
          <div style={{ transform: `scale(${pop})`, display: "flex" }}>
            <HeartIcon size={icon} color={liked ? LIKE : GREY} fill={liked ? LIKE : "none"} stroke={stroke} />
          </div>
        }
      />
      <Stat u={u} value={counts.comments} icon={<CommentIcon size={icon} color={GREY} stroke={stroke} />} />
      <Stat u={u} value={counts.shares} icon={<ShareIcon size={icon} color={GREY} stroke={stroke} />} />
      <div style={{ flex: 1 }} />
      <BookmarkIcon size={icon * 0.92} color={GREY} stroke={stroke} />
    </div>
  );
};

const Badge: React.FC<{ text: string; spec: PostSpec; frame: number; enterFrame: number }> = ({ text, spec, frame, enterFrame }) => {
  const { u, accent } = spec;
  const s = interpolate(frame, [enterFrame + 8, enterFrame + 14, enterFrame + 20], [0, 1.15, 1], clamp01);
  return (
    <div
      style={{
        position: "absolute",
        right: 40 * u,
        top: -30 * u,
        height: 60 * u,
        padding: `0 ${26 * u}px`,
        borderRadius: 999,
        backgroundColor: accent,
        color: "#fff",
        fontSize: 30 * u,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        boxShadow: `0 ${8 * u}px ${20 * u}px rgba(0,0,0,0.28)`,
        transform: `rotate(3deg) scale(${s})`,
        zIndex: 2,
      }}
    >
      {text.normalize("NFC").toLocaleUpperCase("vi")}
    </div>
  );
};

// ---------------------------------------------------------------- thẻ

export const PostCard: React.FC<{ spec: PostSpec; frame: number; enterFrame: number }> = ({ spec, frame, enterFrame }) => {
  const { u, cardW } = spec;
  const height = postHeight(spec, frame);
  const body = spec.body;
  const bodyH = bodyHeightAt(spec, frame);
  return (
    <div style={{ position: "relative", width: cardW, height, fontFamily: SOCIAL_FONT }}>
      {spec.badge ? <Badge text={spec.badge} spec={spec} frame={frame} enterFrame={enterFrame} /> : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 44 * u,
          backgroundColor: "#ffffff",
          overflow: "hidden",
          boxShadow: `0 ${28 * u}px ${70 * u}px rgba(0,0,0,0.42), 0 ${4 * u}px ${12 * u}px rgba(0,0,0,0.18)`,
          padding: `${CARD.padTop * u}px ${CARD.padX * u}px 0`,
          boxSizing: "border-box",
        }}
      >
        <Header spec={spec} />
        <div style={{ height: CARD.afterHeader * u }} />
        {spec.headline ? (
          <div style={{ color: INK, fontWeight: HEADLINE_WEIGHT, fontSize: spec.headline.fontSize }}>
            {spec.headline.lines.map((l, i) => (
              <div key={i} style={{ height: spec.headline!.lineH, lineHeight: `${spec.headline!.lineH}px`, whiteSpace: "pre" }}>
                {l}
              </div>
            ))}
          </div>
        ) : null}
        {spec.subtitle ? (
          <div style={{ marginTop: CARD.afterSubtitle * u, color: GREY, fontWeight: 500, fontSize: spec.subtitle.fontSize }}>
            {spec.subtitle.lines.map((l, i) => (
              <div key={i} style={{ height: spec.subtitle!.lineH, lineHeight: `${spec.subtitle!.lineH}px`, whiteSpace: "pre" }}>
                {l}
              </div>
            ))}
          </div>
        ) : null}
        {body ? (
          <>
            {spec.headline ? <div style={{ height: CARD.afterHeadline * u * Math.min(1, bodyH / Math.max(1, body.lineH)) }} /> : null}
            <div style={{ position: "relative", height: bodyH, fontSize: body.fontSize, color: INK }}>
              {body.lines.map((line, li) => {
                const segs: Word[][] = [];
                for (const w of line.words) {
                  const last = segs[segs.length - 1];
                  if (last && last[0].punch === w.punch) last.push(w);
                  else segs.push([w]);
                }
                return (
                  <div
                    key={li}
                    style={{ position: "absolute", left: 0, top: li * body.lineH, height: body.lineH, lineHeight: `${body.lineH}px`, whiteSpace: "pre" }}
                  >
                    {segs.map((seg, si) => (
                      <React.Fragment key={si}>
                        {si > 0 ? " " : null}
                        {seg[0].punch && body.match && spec.punch ? (
                          <PunchSegment words={seg} frame={frame} captionStarts={body.captionStarts} match={body.match} atFrame={spec.punch.atFrame} />
                        ) : (
                          seg.map((w, wi) => (
                            <React.Fragment key={wi}>
                              {wi > 0 ? " " : null}
                              <WordSpan word={w} frame={frame} captionStarts={body.captionStarts} />
                            </React.Fragment>
                          ))
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
        {spec.punch?.chip ? <QuoteChip spec={spec} frame={frame} /> : null}
        <div style={{ position: "absolute", left: CARD.padX * u, right: CARD.padX * u, bottom: CARD.padBottom * u }}>
          <Footer spec={spec} frame={frame} />
        </div>
      </div>
    </div>
  );
};

/** Punch không có trong thân bài → chip trích dẫn đậm dưới thân bài. */
const QuoteChip: React.FC<{ spec: PostSpec; frame: number }> = ({ spec, frame }) => {
  const { u, accent } = spec;
  const chip = spec.punch!.chip!;
  const at = spec.punch!.atFrame;
  const o = interpolate(frame, [at - 2, at + 6], [0, 1], clamp01);
  const s = interpolate(frame, [at - 2, at + 5, at + 12], [0.85, 1.05, 1], clamp01);
  const full = blockH(chip) + CARD.chipPadY * 2 * u;
  return (
    <div style={{ height: chipHeightAt(spec, frame), position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CARD.chipGap * u,
          height: full,
          boxSizing: "border-box",
          padding: `${CARD.chipPadY * u}px ${28 * u}px`,
          borderRadius: 24 * u,
          backgroundColor: interpolateColors(0.9, [0, 1], [accent, "#ffffff"]),
          borderLeft: `${8 * u}px solid ${accent}`,
          opacity: o,
          transform: `scale(${s})`,
          transformOrigin: "0 50%",
          color: INK,
          fontWeight: 800,
          fontSize: chip.fontSize,
        }}
      >
        {chip.lines.map((l, i) => (
          <div key={i} style={{ height: chip.lineH, lineHeight: `${chip.lineH}px`, whiteSpace: "pre" }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};
