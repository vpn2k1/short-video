/**
 * Phong cách "Livestream bán hàng" — xem skill `.claude/skills/style-liveshop/SKILL.md`.
 *
 * Giả lập màn hình phiên live bán hàng trên điện thoại (giao diện chung chung, không nhái logo nền tảng nào):
 * ảnh/video cảnh là máy quay live rung tay nhẹ; thanh chủ phòng + LIVE + người xem tăng dần; thanh hành động
 * mép phải có tim bay lên; bình luận người xem trôi liên tục và "hỏi lại" theo lời người dẫn; câu đang nói là lời
 * ghim của chủ phòng; `tag` là thẻ sản phẩm "Còn n sản phẩm"; `visual` là sao nổ giảm giá / viên "Đã bán";
 * `punch` là thẻ FLASH SALE đập xuống giữa màn hình (có giá thì giá lăn xuống), chat dồn "Chốt đơn!", tim bay dày.
 *
 * Thứ tự lớp: máy quay → tim bay → thanh hành động → thanh chủ phòng → thẻ sản phẩm → huy hiệu số liệu → chat →
 * lời ghim → flash sale → màn chờ live. Âm thanh, chữ tự do, watermark do composition Short vẽ.
 */
import { useMemo } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts, useFontReady } from "../../fonts/load";
import { activeIndexAt } from "../shared";
import { bannerLayout, HostBanner, ProductCard, VisualBadge } from "./Cards";
import { Chat } from "./Chat";
import { FloatingHearts, Rail, TopBar } from "./Chrome";
import { Feed } from "./Feed";
import { FlashSale, saleLevel } from "./FlashSale";
import { buildChat, clamp, LIVE_FONTS, SMOOTH, useGeo } from "./live";
import { LiveTitle } from "./Title";
import { useVideoLanguage } from "../../i18n/video";

export const LiveshopStyle: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, showTitle }) => {
  ensureFonts(LIVE_FONTS);
  const ready = useFontReady("bevietnam");
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const geo = useGeo();
  const language = useVideoLanguage();
  const { u, bannerBottom } = geo;
  // Giao diện live hiện khi màn chờ sắp rút; không có màn chờ thì hiện ngay.
  const appear = showTitle ? TITLE_FRAMES - 8 : 0;

  const chat = useMemo(
    () => buildChat(captions, scenes, 0, durationInFrames, title || "live", language),
    [captions, scenes, durationInFrames, title, language],
  );
  const products = useMemo(() => new Set(scenes.map((s) => s.tag?.trim()).filter(Boolean)).size, [scenes]);

  // Đáy khung chat bám mép trên lời ghim — co giãn cùng thẻ khi câu đổi số dòng.
  const capIndex = activeIndexAt(captions, frame);
  let bannerH = 0;
  if (capIndex >= 0 && captions[capIndex].text.trim()) {
    const cur = bannerLayout(captions[capIndex].text, geo, ready).height;
    const prevCap = capIndex > 0 ? captions[capIndex - 1] : null;
    const prev = prevCap?.text.trim() ? bannerLayout(prevCap.text, geo, ready).height : cur;
    const start = msToFrames(captions[capIndex].startMs);
    bannerH = interpolate(frame, [start, start + 6], [prev, cur], { ...clamp, easing: SMOOTH });
  }
  const chatBottom = bannerBottom - bannerH - (bannerH ? 16 : 0) * u;
  const sale = saleLevel(scenes, frame);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Feed scenes={scenes} accent={accent} />
      <FloatingHearts geo={geo} scenes={scenes} appear={appear} accent={accent} />
      <Rail geo={geo} accent={accent} appear={appear} title={title} products={products} />
      <TopBar geo={geo} accent={accent} appear={appear} title={title} />
      <AbsoluteFill style={{ opacity: 1 - sale * 0.75 }}>
        <ProductCard geo={geo} scenes={scenes} accent={accent} appear={appear} />
        <VisualBadge geo={geo} scenes={scenes} appear={appear} />
      </AbsoluteFill>
      <Chat geo={geo} lines={chat} bottom={chatBottom} appear={appear} dim={sale} />
      <HostBanner
        geo={geo}
        captions={captions}
        scenes={scenes}
        bottom={bannerBottom}
        ready={ready}
        accent={accent}
        appear={appear}
      />
      <FlashSale geo={geo} scenes={scenes} accent={accent} ready={ready} />
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <LiveTitle geo={geo} title={title} subtitle={subtitle} accent={accent} ready={ready} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
