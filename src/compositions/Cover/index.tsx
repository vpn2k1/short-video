/**
 * Ảnh bìa cho một video — MỘT khung hình tĩnh để đăng làm thumbnail (TikTok, Reels, Shorts, YouTube).
 *
 * Khác thẻ tiêu đề đầu video (TitleCard): thẻ đó có chuyển động và mỗi phong cách vẽ một kiểu, cắt từ video ra
 * thì có cái đẹp có cái đang viết dở chữ, có cái không có chữ. Bìa này luôn cùng một bố cục cho mọi phong cách:
 * ảnh cảnh đầu phủ kín, lớp tối dần từ dưới lên, tiêu đề to nằm trong vùng an toàn, vạch màu nhấn, tên kênh.
 *
 * Server render bằng renderStill (scripts/render.ts › renderCover) — không có chuyển động nên chỉ 1 frame.
 */
import { AbsoluteFill, Img, staticFile, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { ASPECTS, DEFAULT_ASPECT, type AspectId } from "../../aspects";
import { useFontReady } from "../../fonts/load";
import { fontInfo } from "../../fonts/catalog";

export const coverSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  handle: z.string(),
  accent: z.string(),
  background: z.string(),
  /** Ảnh nền (đường dẫn trong public/); null = nền màu. */
  image: z.string().nullable(),
  aspect: z.string(),
});

export type CoverProps = z.infer<typeof coverSchema>;

export const defaultCoverProps: CoverProps = {
  title: "Ba mẹo tiết kiệm điện mùa hè",
  subtitle: "Cái thứ ba ít ai để ý",
  handle: "@kenh",
  accent: "#e8590c",
  background: "#0b0b12",
  image: null,
  aspect: DEFAULT_ASPECT,
};

const aspectOf = (id: string) => ASPECTS[id as AspectId] ?? ASPECTS[DEFAULT_ASPECT];

export const calculateCoverMetadata: CalculateMetadataFunction<CoverProps> = ({ props }) => {
  const { width, height } = aspectOf(props.aspect);
  return { width, height, durationInFrames: 1 };
};

export const Cover: React.FC<CoverProps> = ({ title, subtitle, handle, accent, background, image, aspect }) => {
  useFontReady("bevietnam");
  const { width, height, safe } = aspectOf(aspect);
  const wide = width > height;
  // Cỡ chữ theo cạnh ngắn, và nhỏ lại khi tiêu đề dài — tiêu đề 60 ký tự vẫn nằm gọn trong 3–4 dòng.
  const base = Math.min(width, height);
  const titleSize = Math.round(base * (title.length > 40 ? 0.095 : title.length > 24 ? 0.115 : 0.135));
  const family = fontInfo("bevietnam").stack;

  return (
    <AbsoluteFill style={{ backgroundColor: background, fontFamily: family }}>
      {image ? (
        <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <AbsoluteFill
          style={{ background: `radial-gradient(circle at 30% 20%, ${accent}66, transparent 60%), ${background}` }}
        />
      )}
      <AbsoluteFill
        style={{
          background: wide
            ? "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 80%)"
            : "linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 42%, rgba(0,0,0,0.05) 75%)",
        }}
      />
      <AbsoluteFill
        style={{
          padding: `${safe.top}px ${safe.side}px ${safe.bottom}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: wide ? "center" : "flex-end",
          alignItems: "flex-start",
          maxWidth: wide ? width * 0.62 : undefined,
        }}
      >
        {handle ? (
          <div
            style={{
              fontSize: Math.round(base * 0.034),
              fontWeight: 600,
              color: "#fff",
              background: "rgba(255,255,255,0.16)",
              borderRadius: 999,
              padding: `${Math.round(base * 0.01)}px ${Math.round(base * 0.026)}px`,
              marginBottom: Math.round(base * 0.03),
            }}
          >
            {handle}
          </div>
        ) : null}
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.12,
            color: "#fff",
            letterSpacing: "-0.01em",
            textShadow: "0 4px 24px rgba(0,0,0,0.45)",
            textWrap: "balance",
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: Math.round(base * 0.2),
            height: Math.round(base * 0.014),
            borderRadius: 999,
            backgroundColor: accent,
            margin: `${Math.round(base * 0.035)}px 0`,
          }}
        />
        {subtitle ? (
          <div
            style={{
              fontSize: Math.round(base * 0.045),
              fontWeight: 500,
              lineHeight: 1.3,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
