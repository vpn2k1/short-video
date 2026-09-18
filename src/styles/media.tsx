/**
 * Ảnh hoặc clip của một cảnh, phủ kín khung chứa — dùng chung cho các phong cách đặt ảnh trong khung riêng
 * (trang sách, tấm ảnh kẹp thư…). Clip phát từ `from` (frame tuyệt đối), tắt tiếng theo `volume`, lặp nếu ngắn;
 * cắt đầu / tốc độ / crop chỉnh trong trình chỉnh sửa đều có tác dụng.
 */
import { Img, Sequence, staticFile } from "remotion";
import type { Scene } from "../compositions/Short/schema";
import { ClipVideo } from "../scenes/ClipVideo";
import { CropBox } from "../scenes/CropBox";

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

export const SceneMedia: React.FC<{
  scene: Scene;
  /** Frame tuyệt đối clip bắt đầu phát. */
  from: number;
  /** Phóng to ảnh tĩnh (Ken Burns nhẹ) — 1 = vừa khung. */
  zoom?: number;
}> = ({ scene, from, zoom = 1 }) => {
  if (!scene.image) return null;
  return VIDEO_EXT.test(scene.image) ? (
    <Sequence from={from} layout="none">
      <ClipVideo src={scene.image} trimStartMs={scene.trimStartMs} speed={scene.speed} volume={scene.volume} crop={scene.crop} />
    </Sequence>
  ) : (
    <div style={{ width: "100%", height: "100%", scale: String(zoom) }}>
      <CropBox crop={scene.crop}>
        <Img src={staticFile(scene.image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </CropBox>
    </div>
  );
};
