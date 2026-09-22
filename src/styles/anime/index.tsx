/**
 * Phong cách "Anime" — xem skill `.claude/skills/style-anime/SKILL.md`.
 *
 * Năng lượng opening anime / key visual: ảnh toàn khung màu tươi, đẩy máy chậm, loé sáng mềm; đổi cảnh bằng
 * nhát chém chéo có tia tốc độ và chớp trắng. Phụ đề trắng viền màu nhấn dày bật scale-pop; tag là thẻ tên
 * nhân vật/chương trên dải chéo lao vào từ trái; câu nhấn là khung impact (tia tốc độ toả tròn + khối màu
 * nghiêng + rung + lấp lánh); số liệu là đồng hồ "chỉ số sức mạnh". Cánh hoa anh đào trôi suốt video;
 * không ảnh thì bầu trời mây vẽ tay.
 *
 * Thứ tự lớp: nền (cảnh + nhát chém) → cánh hoa → câu nhấn → số liệu → tag → phụ đề → màn hình tiêu đề.
 * Mọi lớp trừ màn hình tiêu đề cùng rung khi câu nhấn đập xuống.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { useLayout, useSceneClock } from "../shared";
import { ANIME_FONTS, paletteFor, punchFrame, shakeAt } from "./anime";
import { Backdrop } from "./Backdrop";
import { AnimeCaptions, AnimePunch, AnimeTag, AnimeVisual } from "./Overlays";
import { Petals } from "./Sky";
import { AnimeTitle } from "./TitleIntro";

export const AnimeStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  ensureFonts(ANIME_FONTS);
  const palette = paletteFor(accent);
  const { frame, scene, index } = useSceneClock(scenes);
  const { unit } = useLayout();
  const [dx, dy] = scene?.punch ? shakeAt(frame, punchFrame(scene, showTitle), `anime-shake-${index}`) : [0, 0];
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1330", overflow: "hidden" }}>
      <AbsoluteFill style={{ translate: `${dx * unit}px ${dy * unit}px` }}>
        {/* Nền phóng sẵn 4% để lúc rung không lộ mép. */}
        <AbsoluteFill style={{ scale: "1.04" }}>
          <Backdrop scenes={scenes} palette={palette} />
        </AbsoluteFill>
        <Petals count={10} opacity={0.8} />
        <AnimePunch scenes={scenes} captionPosition={captionPosition} showTitle={showTitle} palette={palette} />
        <AnimeVisual scenes={scenes} captionPosition={captionPosition} showTitle={showTitle} palette={palette} />
        <AnimeTag scenes={scenes} showTitle={showTitle} palette={palette} />
        <AnimeCaptions captions={captions} scenes={scenes} position={captionPosition} showTitle={showTitle} palette={palette} />
      </AbsoluteFill>
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <AnimeTitle title={title} subtitle={subtitle} handle={handle} palette={palette} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
