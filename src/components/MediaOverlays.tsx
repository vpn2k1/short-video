import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FPS, msToFrames } from "../constants";
import type { MediaOverlay } from "../compositions/Short/schema";
import { overlayTransformAt } from "../compositions/Short/overlayMotion";
import { ClipVideo } from "../scenes/ClipVideo";
import { CropBox } from "../scenes/CropBox";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** Số làm tròn cho CSS — không để lọt dạng 1e-7 mà trình duyệt không hiểu. */
const css = (v: number) => Number(v.toFixed(4));

/**
 * Các lớp video/ảnh chồng lên hình của phong cách (picture-in-picture kiểu CapCut).
 *
 * Mỗi lớp là một khối riêng trên khung hình: tâm ở (x, y) tính theo % khung, rộng `width`%
 * khung, cao suy ra từ `aspect` của khối. Nhiều lớp đè nhau được — vẽ theo `track` tăng dần
 * nên hàng cao nằm trên. Lớp nằm dưới phụ đề và chữ tự do (hai lớp đó vẽ sau trong Short).
 */
export const MediaOverlays: React.FC<{ overlays: MediaOverlay[] }> = ({ overlays }) => {
  const frame = useCurrentFrame();
  // Giữ chỉ số gốc để key ổn định, xếp theo hàng: hàng cao vẽ sau nên nằm trên.
  const ordered = overlays
    .map((overlay, index) => ({ overlay, index }))
    .sort((a, b) => a.overlay.track - b.overlay.track || a.index - b.index);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {ordered.map(({ overlay: o, index }) => {
        const start = msToFrames(o.startMs);
        const end = Math.max(start + 1, msToFrames(o.endMs));
        if (frame < start || frame >= end) return null;

        // Keyframe: vị trí/cỡ/góc/độ mờ tại đúng khung hình đang vẽ.
        const at = overlayTransformAt(o, (frame / FPS) * 1000);

        // Fade không dài quá nửa lớp — interpolate đòi dãy mốc tăng nghiêm ngặt.
        const fade = Math.min(msToFrames(o.fadeMs), Math.floor((end - start) / 2));
        const opacity = at.opacity * (fade > 0
          ? interpolate(frame, [start, start + fade, end - fade, end], [0, 1, 1, 0], clamp)
          : 1);
        if (opacity <= 0) return null;

        const video = VIDEO_EXT.test(o.src);
        return (
          <div
            key={`overlay-${index}`}
            style={{
              position: "absolute",
              left: `${css(at.x)}%`,
              top: `${css(at.y)}%`,
              width: `${css(at.width)}%`,
              aspectRatio: css(o.aspect),
              transform: `translate(-50%, -50%) rotate(${css(at.rotate)}deg)`,
              opacity,
              overflow: "hidden",
              borderRadius: `${css(o.radius)}%`,
            }}
          >
            <Sequence from={start} durationInFrames={end - start} layout="none">
              {video ? (
                <ClipVideo
                  src={o.src}
                  trimStartMs={o.trimStartMs}
                  speed={o.speed}
                  volume={o.volume}
                  crop={o.crop}
                  objectFit={o.fit}
                />
              ) : (
                <CropBox crop={o.crop}>
                  <Img src={staticFile(o.src)} style={{ width: "100%", height: "100%", objectFit: o.fit }} />
                </CropBox>
              )}
            </Sequence>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
