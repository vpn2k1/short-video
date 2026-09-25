/**
 * Phong cách "Story điện thoại" — xem skill `.claude/skills/style-story/SKILL.md`.
 *
 * Mỗi cảnh là một khung story trên điện thoại (chung chung, không logo/thương hiệu thật): thanh tiến độ chia
 * đoạn trên cùng, đầu story có avatar vòng gradient, ảnh/clip tràn màn hình, phụ đề là nhãn chữ trên khối màu,
 * `tag` là nhãn vị trí / nhắc tên, `punch` là nhãn thăm dò hoặc nhãn GIF + mưa emoji, `visual` là nhãn đếm
 * ngược, đáy là thanh "Gửi tin nhắn" có tim bay. 9:16 → story toàn màn hình; 16:9, 1:1, 3:4 → điện thoại
 * đứng giữa nền mờ của chính ảnh cảnh.
 *
 * Thứ tự lớp trong màn hình: khung ảnh → lớp tối trên/dưới → tiến độ + đầu story → tag → visual → punch →
 * phụ đề → nhãn tiêu đề → thanh trả lời + tim bay. Màn mở đầu: khay story, chạm avatar, story nở ra thành
 * vòng tròn. Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import { noMotion, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { useLayout } from "../shared";
import { FloatingHearts, Header, ProgressBars, ReplyBar, Scrims, StatusBar } from "./Chrome";
import { Frames, NeighborCards, PhoneBackdrop, StoryTray, trayCenter } from "./Frames";
import { CaptionSticker, PunchSticker, TagSticker, TitleStickers, VisualSticker } from "./Stickers";
import { clamp, GeoContext, safeAccent, STORY_FONTS, VIDEO_EXT, VW, type Geo } from "./theme";

/** Frame story bắt đầu nở ra từ avatar, và frame nở xong (hết khay story). */
const OPEN_FROM = 18;
const OPEN_TO = 34;

export const StoryStyle: React.FC<ShortProps> = ({ title, subtitle, accent: rawAccent, captions, scenes: rawScenes, showTitle, avatar }) => {
  ensureFonts(STORY_FONTS);
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { width, height, safe } = useLayout();
  const accent = safeAccent(rawAccent);

  // Không có cảnh → cả video là một khung "Tạo".
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
          ...noMotion(),
          startMs: 0,
          endMs: Math.max((durationInFrames / fps) * 1000, captions.reduce((m, c) => Math.max(m, c.endMs), 0)),
        },
      ];

  // 9:16 (và dọc hơn) → story toàn màn hình; còn lại → điện thoại giữa khung.
  const tall = height / width >= 1.6;
  let geo: Geo;
  let scale: number;
  let phoneBox: { left: number; top: number; w: number; h: number; bezel: number } | null = null;
  if (tall) {
    scale = width / VW;
    geo = {
      vh: height / scale,
      top: Math.max(40, (safe.top / scale) * 0.92),
      bottom: Math.max(40, (safe.bottom / scale) * 0.52),
      phone: false,
    };
  } else {
    const margin = Math.max(30, safe.top * 0.6);
    const bodyH = height - margin * 2;
    const bezel = Math.round(bodyH * 0.017);
    const screenH = bodyH - bezel * 2;
    const screenW = (screenH * 9) / 16;
    scale = screenW / VW;
    geo = { vh: 1920, top: 96, bottom: 46, phone: true };
    phoneBox = { left: (width - screenW) / 2 - bezel, top: margin, w: screenW + bezel * 2, h: bodyH, bezel };
  }

  const firstStill = scenes.find((s) => s.image && !VIDEO_EXT.test(s.image)) ?? null;
  const opening = showTitle && frame < OPEN_TO;
  const open = showTitle ? interpolate(frame, [OPEN_FROM, OPEN_TO], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }) : 1;
  const c = trayCenter(geo.vh);
  const clipPath = open < 1 ? `circle(${(140 + open * 2200).toFixed(1)}px at ${c.x}px ${c.y.toFixed(1)}px)` : undefined;
  // Không màn mở đầu: khung đầu hiện mờ dần trong 8 frame.
  const fadeIn = showTitle ? 1 : interpolate(frame, [0, 8], [0, 1], clamp);

  const screen = (
    <GeoContext.Provider value={geo}>
      <div style={{ position: "absolute", left: 0, top: 0, width: VW, height: geo.vh, transformOrigin: "0 0", scale: String(scale), overflow: "hidden" }}>
        {opening ? <StoryTray vh={geo.vh} avatar={avatar ?? null} accent={accent} firstImage={firstStill} /> : null}
        {showTitle && frame < OPEN_FROM ? null : (
          <AbsoluteFill style={{ clipPath, WebkitClipPath: clipPath, opacity: fadeIn }}>
            <Frames scenes={scenes} accent={accent} />
            <Scrims />
            {geo.phone ? <StatusBar /> : null}
            <ProgressBars scenes={scenes} />
            <Header avatar={avatar ?? null} accent={accent} />
            <FloatingHearts scenes={scenes} showTitle={showTitle} accent={accent} />
            <TagSticker scenes={scenes} showTitle={showTitle} accent={accent} />
            <VisualSticker scenes={scenes} showTitle={showTitle} accent={accent} />
            <PunchSticker scenes={scenes} showTitle={showTitle} accent={accent} />
            <CaptionSticker captions={captions} scenes={scenes} showTitle={showTitle} accent={accent} />
            {showTitle && frame < TITLE_FRAMES ? <TitleStickers title={title} subtitle={subtitle} accent={accent} /> : null}
            <ReplyBar scenes={scenes} showTitle={showTitle} />
          </AbsoluteFill>
        )}
        {geo.phone ? (
          // Lỗ camera tròn giữa mép trên màn hình.
          <div style={{ position: "absolute", left: VW / 2 - 22, top: 28, width: 44, height: 44, borderRadius: "50%", background: "#050507" }} />
        ) : null}
      </div>
    </GeoContext.Provider>
  );

  if (!phoneBox) {
    return <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>{screen}</AbsoluteFill>;
  }

  const radius = phoneBox.w * 0.13;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b10" }}>
      <PhoneBackdrop scenes={scenes} accent={accent} />
      {width / height > 1.2 ? (
        <NeighborCards
          scenes={scenes}
          accent={accent}
          avatar={avatar ?? null}
          cx={width / 2}
          cy={height / 2}
          half={phoneBox.w / 2}
          cardH={phoneBox.h * 0.46}
        />
      ) : null}
      {/* Thân máy: viền kim loại mảnh, mặt kính đen, bóng đổ xuống nền. */}
      <div
        style={{
          position: "absolute",
          left: phoneBox.left,
          top: phoneBox.top,
          width: phoneBox.w,
          height: phoneBox.h,
          borderRadius: radius,
          background: "#0c0c0f",
          boxShadow: [
            "0 0 0 2px #3a3a42",
            "0 0 0 4px #15151a",
            `0 ${height * 0.03}px ${height * 0.08}px rgba(0,0,0,0.6)`,
          ].join(", "),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: phoneBox.bezel,
            borderRadius: radius - phoneBox.bezel,
            overflow: "hidden",
            backgroundColor: "#000",
          }}
        >
          {screen}
        </div>
      </div>
    </AbsoluteFill>
  );
};
