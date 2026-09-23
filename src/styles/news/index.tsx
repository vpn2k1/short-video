import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { Backdrop } from "./Backdrop";
import { Clock, StationBug, Ticker } from "./Chrome";
import { SceneGraphic, SceneWipes } from "./Graphics";
import { tickerItems, useNewsLayout } from "./layout";
import { LowerThird, PunchFlash } from "./LowerThird";
import { FONT, NAVY_DEEP } from "./theme";
import { TitleIntro } from "./TitleIntro";

/**
 * Phong cách "Bản tin nóng" — xem skill style-news.
 *
 * Lớp từ dưới lên: footage/trường quay → số liệu/chip → dải dưới (chuyên mục, tiêu đề,
 * phụ đề) → thanh NÓNG → ticker → logo + TRỰC TIẾP + đồng hồ → mở đầu → vệt gạt chuyển cảnh.
 * Chữ tự do, watermark và âm thanh do composition Short lo — không vẽ ở đây.
 */
export const NewsStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  showTitle,
}) => {
  const L = useNewsLayout(title, captions, scenes);
  // Dải dưới vào khi phần mở đầu bắt đầu trượt đi.
  const enterFrame = showTitle ? TITLE_FRAMES - 4 : 0;
  const items = tickerItems(title, subtitle, scenes);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: NAVY_DEEP, overflow: "hidden" }}>
      <Backdrop scenes={scenes} accent={accent} />
      <SceneGraphic L={L} scenes={scenes} accent={accent} enterFrame={enterFrame} />
      <LowerThird
        L={L}
        title={title}
        subtitle={subtitle}
        captions={captions}
        scenes={scenes}
        accent={accent}
        enterFrame={enterFrame}
      />
      <PunchFlash L={L} scenes={scenes} enterFrame={enterFrame} />
      <Ticker L={L} items={items} accent={accent} />
      <StationBug L={L} accent={accent} />
      <Clock L={L} />
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <TitleIntro L={L} title={title} subtitle={subtitle} accent={accent} />
        </Sequence>
      ) : null}
      <SceneWipes L={L} scenes={scenes} accent={accent} />
    </AbsoluteFill>
  );
};
