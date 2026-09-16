import { useVideoConfig } from "remotion";
import { layoutFor } from "../aspects";

/** Đặt ngay trên dải đáy mà nền tảng chiếm dụng, không nằm trong đó. */
export const Watermark: React.FC<{ handle: string }> = ({ handle }) => {
  const { width, height } = useVideoConfig();
  const { watermarkBottom } = layoutFor(width, height);
  return (
    <div
      className="absolute inset-x-0 flex justify-center"
      style={{ bottom: watermarkBottom }}
    >
      <span className="rounded-full bg-white/10 px-8 py-4 text-4xl font-semibold tracking-wide text-white/80">
        {handle}
      </span>
    </div>
  );
};
