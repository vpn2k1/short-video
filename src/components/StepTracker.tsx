import { msToFrames, SAFE } from "../constants";
import { useCurrentFrame } from "remotion";
import type { Scene } from "../compositions/Short/schema";

/**
 * Dãy chấm cho biết đang ở bước mấy trên tổng số. Nội dung dạng hướng dẫn cần
 * người xem thấy còn bao nhiêu bước nữa — đó là lý do họ ở lại.
 */
export const StepTracker: React.FC<{ scenes: Scene[]; accent: string }> = ({
  scenes,
  accent,
}) => {
  const frame = useCurrentFrame();

  if (scenes.length < 2) {
    return null;
  }

  let current = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (frame >= msToFrames(scenes[i].startMs)) {
      current = i;
    }
  }

  return (
    <div
      className="absolute inset-x-0 flex items-center justify-center gap-4"
      style={{ top: SAFE.top + 40 }}
    >
      {scenes.map((_, index) => (
        <div
          key={`step-${index}`}
          style={{
            width: index === current ? 56 : 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: index <= current ? accent : "rgba(255,255,255,0.25)",
          }}
        />
      ))}
    </div>
  );
};
