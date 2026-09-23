import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { Board } from "./Board";
import { CaptionStrip, PunchPill } from "./Captions";
import { Cards } from "./Card";
import { useRankLayout } from "./layout";
import { Stage } from "./Stage";
import { FONT, STAGE } from "./theme";
import { TitleIntro } from "./TitleIntro";

/**
 * Phong cách "Top xếp hạng" — xem skill style-ranking.
 *
 * Mỗi cảnh là một hạng. Lớp từ dưới lên: sân khấu đèn rọi (+ vệt gió đổi cảnh) → thẻ ảnh
 * (số hạng đập vào rồi thu về góc, thanh tên, số liệu/nhãn) → bảng xếp hạng → viên câu nhấn
 * → phụ đề → mở đầu "TOP N". Chữ tự do, watermark và âm thanh do composition Short lo.
 */
export const RankingStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  const L = useRankLayout(scenes, captions, captionPosition, showTitle);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: STAGE, overflow: "hidden" }}>
      <Stage L={L} accent={accent} />
      <Cards L={L} accent={accent} />
      <Board L={L} accent={accent} />
      <PunchPill L={L} scenes={scenes} />
      <CaptionStrip L={L} captions={captions} accent={accent} />
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <TitleIntro L={L} title={title} subtitle={subtitle} accent={accent} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
