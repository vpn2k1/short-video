import { AbsoluteFill, Sequence } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { Dust, Fog, Shade } from "./Atmos";
import { Footage } from "./Footage";
import { EtchedStamp, EvidenceTag, HorrorCaptions, LoosePunch } from "./Text";
import { HorrorTitle } from "./TitleIntro";

/**
 * Phong cách "Truyện ma" — xem skill style-horror.
 *
 * Không khí kể chuyện ma lúc nửa đêm (rợn, KHÔNG máu me): ảnh rút màu ám lục lạnh, đẩy máy chậm +
 * rung tay rất nhẹ, đèn chập chờn, sương trôi, bụi lơ lửng, hạt phim, vignette nặng. Phụ đề chữ có
 * chân trắng ngà ở 1/3 dưới; tag là nhãn giờ/nơi chốn gõ chữ + chấm đỏ; punch là cú hù (chữ đỏ máu,
 * chớp tối 1 lần + rung + tách màu vài frame); visual là con dấu khắc xước.
 * Thứ tự lớp: footage → sương → bụi → vignette/chập chờn/hạt/chớp tối → con dấu → tag → phụ đề → punch lẻ → title.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
export const HorrorStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  captions,
  scenes,
  captionPosition,
  showTitle,
}) => {
  ensureFonts(["lora", "playfair", "bevietnam"]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Footage scenes={scenes} />
      <Fog />
      <Dust />
      <Shade scenes={scenes} />
      <EtchedStamp scenes={scenes} showTitle={showTitle} position={captionPosition} />
      <EvidenceTag scenes={scenes} showTitle={showTitle} />
      <HorrorCaptions captions={captions} scenes={scenes} position={captionPosition} showTitle={showTitle} />
      <LoosePunch scenes={scenes} captions={captions} />
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <HorrorTitle title={title} subtitle={subtitle} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
