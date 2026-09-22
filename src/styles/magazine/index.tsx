import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import { noMotion, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { ensureFonts, useFontReady } from "../../fonts/load";
import { activeIndexAt, useLayout } from "../shared";
import { clamp, upper } from "./Bits";
import { Page, TURN, type PageCaption } from "./Page";

/** Không có cảnh nào: một trang chữ duy nhất suốt video. */
const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

/** Lật trang: nhanh ở giữa, đậu êm. */
const TURN_EASE = Easing.bezier(0.65, 0, 0.2, 1);

/**
 * Tên tạp chí trên măng-sét: handle bỏ "@" (giống tên thương hiệu), không có thì vài chữ đầu của title.
 * In hoa bằng JS để giữ dấu tiếng Việt.
 */
const brandOf = (handle: string, title: string) => {
  const h = handle.replace(/^@/, "").trim();
  if (h) return upper(h);
  const words = title.trim().split(/\s+/).filter(Boolean);
  let out = "";
  for (const w of words) {
    if (out && [...`${out} ${w}`].length > 12) break;
    out = out ? `${out} ${w}` : w;
  }
  return upper(out || "Tạp chí");
};

/**
 * Phong cách "Tạp chí": mỗi cảnh là một trang tạp chí thời trang/phong cách sống — ảnh tràn trang, măng-sét
 * chữ có chân đậm, dòng số báo, hộp chuyên mục, dòng tít bìa, tem "MỚI!", mã vạch. Xem skill style-magazine.
 * Trang sau trượt vào từ phải như lật trang (có bóng mép giấy), trang trước lùi sang trái và tối đi.
 */
export const MagazineStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  captions,
  scenes,
  showTitle,
  captionPosition,
}) => {
  ensureFonts(["bevietnam"]);
  // Măng-sét đo chữ bằng canvas để căng vừa khổ — phải đợi Playfair nạp xong.
  const ready = useFontReady("playfair");
  const frame = useCurrentFrame();
  const { width, unit } = useLayout();
  const pages = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const brand = brandOf(handle, title);

  // Câu thuộc trang mà nó bắt đầu trong đó.
  const byPage: PageCaption[][] = pages.map(() => []);
  for (const c of captions) {
    const startFrame = msToFrames(c.startMs);
    byPage[Math.max(0, activeIndexAt(pages, startFrame))].push({ text: c.text, startFrame });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0c0c", overflow: "hidden" }}>
      {pages.map((scene, index) => {
        const start = index === 0 ? 0 : msToFrames(scene.startMs);
        const end = Math.max(start + 1, msToFrames(scene.endMs));
        const nextStart = index < pages.length - 1 ? msToFrames(pages[index + 1].startMs) : Infinity;
        // Trang sau đã lật xong phủ kín thì bỏ trang này khỏi cây render.
        if (frame < start || frame >= nextStart + TURN) return null;

        const turnIn = index === 0 ? 1 : interpolate(frame, [start, start + TURN], [0, 1], { ...clamp, easing: TURN_EASE });
        const turnOut =
          nextStart === Infinity ? 0 : interpolate(frame, [nextStart, nextStart + TURN], [0, 1], { ...clamp, easing: TURN_EASE });
        const x = (1 - turnIn) * width - turnOut * width * 0.28;

        return (
          <AbsoluteFill
            key={`mag-page-${index}`}
            style={{
              transform: `perspective(${2400 * unit}px) translateX(${x.toFixed(1)}px) rotateY(${((1 - turnIn) * -14).toFixed(2)}deg)`,
              transformOrigin: "0% 50%",
              boxShadow: turnIn < 1 ? `${-40 * unit}px 0 ${70 * unit}px rgba(0,0,0,${(0.6 * (1 - turnIn * 0.6)).toFixed(3)})` : "none",
            }}
          >
            <Page
              scene={scene}
              index={index}
              total={pages.length}
              start={start}
              end={end}
              frame={frame}
              brand={brand}
              accent={accent}
              captions={byPage[index]}
              intro={index === 0 && showTitle}
              title={title}
              subtitle={subtitle}
              ready={ready}
              captionPosition={captionPosition}
            />
            {/* Mép gáy: bóng mờ dọc mép trái của trang đang lật vào. */}
            {turnIn < 1 ? (
              <AbsoluteFill
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(0,0,0,${(0.45 * (1 - turnIn)).toFixed(3)}) 0%, rgba(0,0,0,0) 18%)`,
                }}
              />
            ) : null}
            {turnOut > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${(turnOut * 0.5).toFixed(3)})` }} /> : null}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
