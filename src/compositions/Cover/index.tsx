/**
 * Ảnh bìa cho một video — MỘT khung hình tĩnh để đăng làm thumbnail (TikTok, Reels, Shorts, YouTube).
 *
 * Khác thẻ tiêu đề đầu video (TitleCard): thẻ đó có chuyển động và mỗi phong cách vẽ một kiểu, cắt từ video ra
 * thì có cái đẹp có cái đang viết dở chữ, có cái không có chữ. Bìa này luôn cùng một bố cục cho mọi phong cách:
 * ảnh cảnh đầu phủ kín, lớp tối dần từ dưới lên, tiêu đề to nằm trong vùng an toàn, vạch màu nhấn.
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
  accent: z.string(),
  background: z.string(),
  /** Ảnh nền (đường dẫn trong public/); null = nền màu. */
  image: z.string().nullable(),
  aspect: z.string(),
  /** Bố cục: "bottom" tiêu đề dưới ảnh phủ kín · "center" tiêu đề giữa trên dải màu · "band" ảnh + khối màu. */
  layout: z.enum(["bottom", "center", "band"]).default("bottom"),
});

export type CoverProps = z.infer<typeof coverSchema>;

export const defaultCoverProps: CoverProps = {
  title: "Ba mẹo tiết kiệm điện mùa hè",
  subtitle: "Cái thứ ba ít ai để ý",
  accent: "#e8590c",
  background: "#0b0b12",
  image: null,
  aspect: DEFAULT_ASPECT,
  layout: "bottom",
};

const aspectOf = (id: string) => ASPECTS[id as AspectId] ?? ASPECTS[DEFAULT_ASPECT];

export const calculateCoverMetadata: CalculateMetadataFunction<CoverProps> = ({ props }) => {
  const { width, height } = aspectOf(props.aspect);
  return { width, height, durationInFrames: 1 };
};

/** Nền ảnh (phủ kín) hoặc nền màu có quầng màu nhấn khi video không có ảnh. */
const Backdrop: React.FC<{ image: string | null; accent: string; background: string; style?: React.CSSProperties }> = ({ image, accent, background, style }) =>
  image ? (
    <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />
  ) : (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, ${accent}66, transparent 60%), ${background}`, ...style }} />
  );

/** Chữ đen hay trắng thì đọc rõ trên nền màu `hex`. */
const inkOn = (hex: string) => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
};

export const Cover: React.FC<CoverProps> = ({ title, subtitle, accent, background, image, aspect, layout }) => {
  useFontReady("bevietnam");
  const { width, height, safe } = aspectOf(aspect);
  const wide = width > height;
  // Cỡ chữ theo cạnh ngắn, và nhỏ lại khi tiêu đề dài — tiêu đề 60 ký tự vẫn nằm gọn trong 3–4 dòng.
  const base = Math.min(width, height);
  const titleSize = Math.round(base * (title.length > 40 ? 0.095 : title.length > 24 ? 0.115 : 0.135));
  const family = fontInfo("bevietnam").stack;
  const pad = `${safe.top}px ${safe.side}px ${safe.bottom}px`;

  // Giữa: ảnh tối hẳn, tiêu đề in hoa ở giữa, mỗi dòng một dải màu nhấn phía sau như nhãn dán.
  if (layout === "center") {
    const ink = inkOn(accent);
    return (
      <AbsoluteFill style={{ backgroundColor: background, fontFamily: family }}>
        <Backdrop image={image} accent={accent} background={background} />
        <AbsoluteFill style={{ background: "rgba(0,0,0,0.55)" }} />
        <AbsoluteFill style={{ padding: pad, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: Math.round(base * 0.04), textAlign: "center" }}>
          <div style={{ fontSize: Math.round(titleSize * 0.92), fontWeight: 700, lineHeight: 1.35, textTransform: "uppercase", maxWidth: "100%" }}>
            <span style={{ background: accent, color: ink, padding: `0 ${Math.round(base * 0.02)}px`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", borderRadius: Math.round(base * 0.012) }}>
              {title}
            </span>
          </div>
          {subtitle ? <div style={{ fontSize: Math.round(base * 0.045), fontWeight: 500, color: "rgba(255,255,255,0.9)", maxWidth: "90%" }}>{subtitle}</div> : null}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // Dải: ảnh phía trên (hoặc bên trái nếu khung ngang), khối màu nhấn chứa tiêu đề phía còn lại.
  if (layout === "band") {
    const ink = inkOn(accent);
    const split = wide ? { width: "55%", height: "100%" } : { width: "100%", height: "58%" };
    return (
      <AbsoluteFill style={{ backgroundColor: accent, fontFamily: family, flexDirection: wide ? "row" : "column" }}>
        <div style={{ position: "relative", overflow: "hidden", flex: "none", ...split }}>
          <Backdrop image={image} accent={accent} background={background} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(base * 0.03),
          padding: wide ? `${safe.top}px ${safe.side}px` : `${Math.round(base * 0.06)}px ${safe.side}px ${safe.bottom}px`, color: ink }}>
          <div style={{ fontSize: Math.round(titleSize * (wide ? 0.8 : 0.9)), fontWeight: 700, lineHeight: 1.12, textWrap: "balance" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: Math.round(base * 0.042), fontWeight: 500, opacity: 0.85 }}>{subtitle}</div> : null}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: background, fontFamily: family }}>
      <Backdrop image={image} accent={accent} background={background} />
      <AbsoluteFill
        style={{
          background: wide
            ? "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 80%)"
            : "linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 42%, rgba(0,0,0,0.05) 75%)",
        }}
      />
      <AbsoluteFill
        style={{
          padding: pad,
          display: "flex",
          flexDirection: "column",
          justifyContent: wide ? "center" : "flex-end",
          alignItems: "flex-start",
          maxWidth: wide ? width * 0.62 : undefined,
        }}
      >
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
          <div style={{ fontSize: Math.round(base * 0.045), fontWeight: 500, lineHeight: 1.3, color: "rgba(255,255,255,0.85)" }}>
            {subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
