import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrames } from "../constants";
import type { Scene } from "../compositions/Short/schema";

type Props = {
  scenes: Scene[];
  accent: string;
};

/**
 * Hình vẽ bằng code cho cảnh đang chạy — nhãn bước hoặc con số lớn.
 * Không cần file ảnh: đây là thứ sinh được hoàn toàn từ dữ liệu kịch bản.
 * Đặt ở phần trên màn hình để không đụng phụ đề ở đáy hay ở giữa.
 */
export const SceneVisual: React.FC<Props> = ({ scenes, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = scenes.find(
    (scene) =>
      Boolean(scene.visual) &&
      frame >= msToFrames(scene.startMs) &&
      frame < msToFrames(scene.endMs),
  );

  if (!active || !active.visual) {
    return null;
  }

  const { type, text, caption } = active.visual;

  const enter = spring({
    frame: frame - msToFrames(active.startMs),
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  const style = {
    opacity: Math.min(1, enter * 1.4),
    transform: `translateY(${(1 - enter) * 40}px) scale(${0.9 + enter * 0.1})`,
  };

  return (
    <div className="absolute inset-x-0 top-[18%] flex flex-col items-center px-20">
      {type === "badge" ? (
        <span
          className="rounded-full px-12 py-5 text-5xl font-black uppercase tracking-widest text-white"
          style={{ ...style, backgroundColor: accent }}
        >
          {text}
        </span>
      ) : (
        <span
          className="text-[13rem] font-black leading-none"
          style={{
            ...style,
            color: accent,
            textShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </span>
      )}

      {caption === null ? null : (
        <span
          className="mt-6 text-center text-4xl font-semibold text-white/80"
          style={style}
        >
          {caption}
        </span>
      )}
    </div>
  );
};
