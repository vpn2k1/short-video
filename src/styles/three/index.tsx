/**
 * Phong cách "Cảnh 3D thật" — xem skill `.claude/skills/style-three/SKILL.md`.
 *
 * Studio 3D dựng bằng Three.js (@remotion/three): ánh sáng môi trường phản chiếu, đèn màu nhấn, sương, sàn bóng
 * đổ bóng thật. Ảnh của cảnh dán lên một tấm dày cạnh kim loại, xoay gần nửa vòng bay tới rồi văng lộn ra ngoài khi
 * sang cảnh; khối hình học kim loại/sơn bóng trôi quanh. Cảnh không ảnh và màn tiêu đề: nút xoắn crôm.
 * Clip video vẽ bằng DOM CSS 3D trùng khít tấm 3D (xem Media.tsx). Chữ là HTML (kính mờ, chữ crôm) — font 3D của
 * Three.js không có đủ dấu tiếng Việt.
 *
 * Cần WebGL lúc render: scripts/render.ts bật GL "angle" (GPU, tự lùi về phần mềm) cho phong cách này.
 *
 * Thứ tự lớp: nền DOM → canvas WebGL → mặt video DOM → số liệu → tag → câu nhấn → phụ đề → chữ màn tiêu đề.
 */
import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { Grain } from "../shared";
import { MediaFaces } from "./Media";
import { ThreeCaptions, ThreePunch, ThreeTag, ThreeVisual } from "./Overlays";
import { paletteFor, THREE_FONTS } from "./three";
import { ThreeTitle } from "./TitleIntro";
import { World } from "./World";

export const ThreeStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  accent,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  ensureFonts(THREE_FONTS);
  const palette = paletteFor(accent);
  return (
    <AbsoluteFill style={{ background: palette.backdrop }}>
      <World scenes={scenes} showTitle={showTitle} palette={palette} />
      <MediaFaces scenes={scenes} showTitle={showTitle} />
      <Grain opacity={0.06} baseFrequency={0.9} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 95% 85% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <ThreeVisual scenes={scenes} showTitle={showTitle} palette={palette} />
      <ThreeTag scenes={scenes} showTitle={showTitle} palette={palette} />
      <ThreePunch scenes={scenes} captionPosition={captionPosition} showTitle={showTitle} palette={palette} />
      <ThreeCaptions captions={captions} scenes={scenes} position={captionPosition} showTitle={showTitle} palette={palette} />
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <ThreeTitle title={title} subtitle={subtitle} palette={palette} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
