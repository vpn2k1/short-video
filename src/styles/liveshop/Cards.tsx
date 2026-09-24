import { interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Caption, Scene, SceneVisual } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { activeIndexAt, seeded } from "../shared";
import { Avatar } from "./Chrome";
import { CartIcon, FlameIcon, PinIcon, ProductSilhouette } from "./Icons";
import {
  alpha, clamp, fitLines, GOLD, INK, inkOn, NUM, POP, punchSpan, SALE_ORANGE, SALE_RED, shade, SMOOTH, UI, upper,
  type Geo,
} from "./live";
import { useVt } from "../../i18n/video";

/* ------------------------------------------------------------ lời ghim của chủ phòng */

const BANNER_LH = 1.32;
const BANNER_WEIGHT = 800;

/** Cỡ chữ, số dòng và chiều cao thẻ lời ghim cho một câu — đo bằng canvas nên chiều cao khớp chữ thật. */
export const bannerLayout = (text: string, geo: Geo, ready: boolean) => {
  const { u, bannerW, bannerBase, bannerMin } = geo;
  const padX = 30 * u;
  const header = 38 * u;
  const { size, lines } = fitLines(text.normalize("NFC"), bannerBase, bannerMin, bannerW - padX * 2, 3, UI, BANNER_WEIGHT, ready);
  const height = 20 * u + header + 8 * u + Math.max(1, lines) * size * BANNER_LH + 24 * u;
  return { size, lines, height, padX, header };
};

/**
 * Câu người dẫn đang nói = bình luận được ghim của chủ phòng: thẻ trắng bo góc có vạch accent bên trái,
 * dòng đầu "📌 (ảnh đại diện) Chủ phòng", lời in đậm màu mực. Đổi câu: thẻ co/giãn chiều cao theo số dòng mới trong
 * 6 frame, chữ mới trượt lên. Cụm câu nhấn (khi tới lúc) đỏ, quét dạ quang vàng.
 */
export const HostBanner: React.FC<{
  geo: Geo;
  captions: Caption[];
  scenes: Scene[];
  bottom: number;
  ready: boolean;
  accent: string;
  appear: number;
}> = ({ geo, captions, scenes, bottom, ready, accent, appear }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const { u, side, bannerW } = geo;
  const index = activeIndexAt(captions, frame);
  if (index < 0) return null;
  const caption = captions[index];
  const text = caption.text.normalize("NFC").trim();
  if (!text) return null;
  const start = msToFrames(caption.startMs);
  const cur = bannerLayout(text, geo, ready);
  const prev = index > 0 ? bannerLayout(captions[index - 1].text, geo, ready) : null;
  const height = prev ? interpolate(frame, [start, start + 6], [prev.height, cur.height], { ...clamp, easing: SMOOTH }) : cur.height;
  const enterAt = Math.max(start, appear);
  const cardIn = index === 0 || frame < appear + 10 ? interpolate(frame, [enterAt, enterAt + 10], [0, 1], { ...clamp, easing: POP }) : 1;
  const textIn = interpolate(frame, [start, start + 7], [0, 1], { ...clamp, easing: SMOOTH });

  // Câu nhấn của cảnh chứa câu này, chỉ tô khi giọng đọc đã tới.
  const scene = scenes[activeIndexAt(scenes, start)] ?? null;
  const punchAt = scene?.punch ? msToFrames(scene.punch.atMs) : Infinity;
  const span = scene?.punch && frame >= punchAt ? punchSpan(text, scene.punch.text) : null;
  const mark = Number.isFinite(punchAt) ? interpolate(frame, [punchAt, punchAt + 9], [0, 100], clamp) : 0;
  const small = 23 * u;

  return (
    <div
      style={{
        position: "absolute",
        left: side,
        top: bottom - height,
        width: bannerW,
        height,
        boxSizing: "border-box",
        borderRadius: 26 * u,
        backgroundColor: "rgba(255,255,255,0.96)",
        boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.3)`,
        overflow: "hidden",
        opacity: cardIn,
        translate: `0px ${(1 - cardIn) * 30 * u}px`,
        scale: String(0.96 + 0.04 * cardIn),
        fontFamily: UI,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 9 * u, backgroundColor: accent }} />
      <div
        style={{
          position: "absolute",
          left: cur.padX,
          right: cur.padX,
          top: 20 * u,
          height: cur.header,
          display: "flex",
          alignItems: "center",
          gap: 10 * u,
          fontSize: small,
          lineHeight: 1.3,
          whiteSpace: "nowrap",
        }}
      >
        <PinIcon size={small * 1.05} color={SALE_RED} />
        <Avatar accent={accent} size={cur.header * 0.9} ring={2 * u} />
        <span
          style={{
            flexShrink: 0,
            fontWeight: 700,
            fontSize: small * 0.85,
            padding: `${2 * u}px ${12 * u}px`,
            borderRadius: 8 * u,
            backgroundColor: accent,
            color: inkOn(accent),
          }}
        >
          {vt("Chủ phòng")}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: cur.padX,
          right: cur.padX,
          top: 20 * u + cur.header + 8 * u,
          fontWeight: BANNER_WEIGHT,
          fontSize: cur.size,
          lineHeight: BANNER_LH,
          color: INK,
          opacity: textIn,
          translate: `0px ${(1 - textIn) * 14 * u}px`,
        }}
      >
        {span ? (
          <>
            {text.slice(0, span[0])}
            <span
              style={{
                color: SALE_RED,
                backgroundImage: `linear-gradient(${GOLD}, ${GOLD})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${mark}% 44%`,
                backgroundPosition: "0 88%",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }}
            >
              {text.slice(span[0], span[1])}
            </span>
            {text.slice(span[1])}
          </>
        ) : (
          text
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ thẻ sản phẩm (tag) */

/** Ảnh thu nhỏ của sản phẩm = ảnh cảnh (tắt tiếng nếu là clip); không ảnh thì bóng sản phẩm chờ. */
const Thumb: React.FC<{ scene: Scene; size: number; accent: string; from: number }> = ({ scene, size, accent, from }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.16,
      overflow: "hidden",
      flexShrink: 0,
      position: "relative",
      backgroundColor: shade(accent, 0.85),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {scene.image ? (
      <SceneMedia scene={{ ...scene, volume: 0 }} from={from} />
    ) : (
      <ProductSilhouette size={size * 0.92} tone={shade(accent, 0.55)} rim="#ffffff" />
    )}
  </div>
);

/**
 * `tag` = thẻ sản phẩm đang bán, góc trái dưới thanh chủ phòng: ảnh nhỏ có số thứ tự, tên sản phẩm, "Còn 23 sản
 * phẩm" giảm dần (nhanh hơn sau câu nhấn) kèm thanh tồn kho, nút "Mua". Trượt vào từ trái đầu cảnh.
 */
export const ProductCard: React.FC<{ geo: Geo; scenes: Scene[]; accent: string; appear: number }> = ({ geo, scenes, accent, appear }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const index = activeIndexAt(scenes, frame);
  const scene = index >= 0 ? scenes[index] : null;
  if (!scene?.tag?.trim()) return null;
  const { u, side, below, wide, square } = geo;
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  const next = scenes[index + 1];
  const sameTag = (s: Scene | undefined) => s?.tag?.trim() === scene.tag?.trim();
  const inAt = Math.max(appear, start + 6);
  const enter = sameTag(scenes[index - 1]) && start > appear ? 1 : interpolate(frame, [inAt, inAt + 14], [0, 1], { ...clamp, easing: POP });
  const exit = next && !sameTag(next) ? interpolate(frame, [end - 8, end], [0, 1], clamp) : 0;
  const t = enter * (1 - exit);

  const total = index === 0 ? 23 : Math.floor(seeded(`stock-${index}`, 12, 38));
  const punchAt = scene.punch ? msToFrames(scene.punch.atMs) : Infinity;
  const normal = Math.floor(Math.max(0, frame - start) / 50);
  const rush = frame > punchAt ? Math.floor((frame - punchAt) / 12) : 0;
  const stock = Math.max(2, total - normal - rush);
  const w = (wide ? 460 : square ? 440 : 520) * u;
  const thumb = (wide ? 100 : square ? 96 : 112) * u;
  const nameSize = (wide ? 26 : 28) * u;
  return (
    <div
      style={{
        position: "absolute",
        left: side,
        top: below,
        width: w,
        padding: 12 * u,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 16 * u,
        borderRadius: 22 * u,
        backgroundColor: "rgba(255,255,255,0.96)",
        boxShadow: `0 ${8 * u}px ${26 * u}px rgba(0,0,0,0.28)`,
        opacity: t,
        translate: `${(1 - t) * -60 * u}px 0px`,
        fontFamily: UI,
      }}
    >
      <div style={{ position: "relative" }}>
        <Thumb scene={scene} size={thumb} accent={accent} from={start} />
        <div
          style={{
            position: "absolute",
            left: -4 * u,
            top: -4 * u,
            minWidth: 36 * u,
            height: 36 * u,
            borderRadius: `${12 * u}px 0 ${12 * u}px 0`,
            backgroundColor: SALE_ORANGE,
            color: "#fff",
            fontWeight: 800,
            fontSize: 22 * u,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {index + 1}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 * u }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: nameSize,
            lineHeight: 1.3,
            color: INK,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {scene.tag.normalize("NFC").trim()}
        </div>
        <div style={{ fontWeight: 700, fontSize: nameSize * 0.78, lineHeight: 1.3, color: SALE_RED, fontVariantNumeric: "tabular-nums" }}>
          {vt("Còn {n} sản phẩm", { n: stock })}
        </div>
        <div style={{ height: 8 * u, borderRadius: 4 * u, backgroundColor: alpha(SALE_RED, 0.15), overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(100, (stock / (total + 8)) * 100)}%`,
              height: "100%",
              borderRadius: 4 * u,
              background: `linear-gradient(90deg, ${SALE_ORANGE}, ${SALE_RED})`,
            }}
          />
        </div>
      </div>
      <div
        style={{
          alignSelf: "center",
          padding: `${12 * u}px ${16 * u}px`,
          borderRadius: 16 * u,
          backgroundColor: accent,
          color: inkOn(accent),
          fontWeight: 800,
          fontSize: nameSize * 0.8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2 * u,
          flexShrink: 0,
        }}
      >
        <CartIcon size={nameSize} color={inkOn(accent)} />
        {vt("Mua")}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ số liệu (visual) */

/** Hình sao nổ 18 cánh trong khung 100×100, tính sẵn. */
const BURST_POINTS = (() => {
  const pts: string[] = [];
  const n = 18;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 49 : 41;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

/** Số liệu kiểu giảm giá ("-30%", "50%", "x2") vẽ thành sao nổ; còn lại thành viên "Đã bán …". */
const isDiscount = (visual: SceneVisual) => /%|^[-−–x×]/i.test(visual.text.trim());

/**
 * `visual` góc phải trên: stat giảm giá → sao nổ vàng chữ đỏ xoay chậm; stat khác → viên cam có ngọn lửa
 * "Đã bán 1,2K" (chú thích thay chữ "Đã bán"); badge → nhãn accent in hoa. Nảy vào 10 frame sau đầu cảnh.
 */
export const VisualBadge: React.FC<{ geo: Geo; scenes: Scene[]; appear: number }> = ({ geo, scenes, appear }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const index = activeIndexAt(scenes, frame);
  const scene = index >= 0 ? scenes[index] : null;
  const visual = scene?.visual;
  if (!scene || !visual) return null;
  const { u, side, below, wide, square } = geo;
  const start = msToFrames(scene.startMs);
  const end = Math.max(start + 1, msToFrames(scene.endMs));
  const inAt = Math.max(appear + 6, start + 10);
  const pop = interpolate(frame, [inAt, inAt + 14], [0, 1], { ...clamp, easing: POP });
  const exit = index < scenes.length - 1 ? interpolate(frame, [end - 6, end], [1, 0], clamp) : 1;
  const text = visual.text.normalize("NFC").trim();
  const caption = visual.caption?.normalize("NFC").trim() ?? "";

  if (visual.type === "stat" && isDiscount(visual)) {
    const size = (wide ? 190 : square ? 180 : 220) * u;
    const len = [...text].length;
    const fs = size * (len <= 3 ? 0.36 : len <= 4 ? 0.3 : Math.max(0.16, 1.15 / len));
    return (
      <div
        style={{
          position: "absolute",
          right: side + (wide ? 0 : 6 * u),
          top: below - 10 * u,
          width: size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8 * u,
          opacity: exit,
          scale: String(pop),
          rotate: `${interpolate(pop, [0, 1], [-40, -10])}deg`,
        }}
      >
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, rotate: `${frame * 0.4}deg` }}>
            <polygon points={BURST_POINTS} fill={GOLD} stroke={SALE_RED} strokeWidth={2.4} strokeLinejoin="round" />
            <circle cx="50" cy="50" r="33" fill="none" stroke={SALE_RED} strokeWidth={1.2} strokeDasharray="3 3" />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: NUM,
              fontWeight: 900,
              fontSize: fs,
              lineHeight: 1,
              color: SALE_RED,
            }}
          >
            {text}
          </div>
        </div>
        {caption ? (
          <div
            style={{
              rotate: "10deg",
              padding: `${6 * u}px ${16 * u}px`,
              borderRadius: 12 * u,
              backgroundColor: SALE_RED,
              color: "#fff",
              fontFamily: UI,
              fontWeight: 800,
              fontSize: 24 * u,
              lineHeight: 1.3,
              textAlign: "center",
              maxWidth: size * 1.3,
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    );
  }

  const isStat = visual.type === "stat";
  const fs = (wide ? 30 : 32) * u;
  const label = isStat ? caption || vt("Đã bán") : upper(text);
  return (
    <div
      style={{
        position: "absolute",
        right: side,
        top: below + 8 * u,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8 * u,
        opacity: exit * Math.min(1, pop * 1.5),
        scale: String(0.6 + 0.4 * pop),
        transformOrigin: "right top",
        fontFamily: UI,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10 * u,
          padding: `${12 * u}px ${24 * u}px ${12 * u}px ${18 * u}px`,
          borderRadius: 999,
          background: isStat ? `linear-gradient(90deg, ${SALE_ORANGE}, ${SALE_RED})` : `linear-gradient(90deg, ${GOLD}, #ffb020)`,
          color: isStat ? "#fff" : INK,
          boxShadow: `0 ${6 * u}px ${18 * u}px rgba(0,0,0,0.3)`,
          border: `${3 * u}px solid rgba(255,255,255,0.9)`,
          whiteSpace: "nowrap",
        }}
      >
        <FlameIcon size={fs * 1.1} color={isStat ? GOLD : SALE_RED} />
        <span style={{ fontWeight: 700, fontSize: fs * 0.85, lineHeight: 1.3 }}>{label}</span>
        {isStat ? <span style={{ fontFamily: NUM, fontWeight: 900, fontSize: fs * 1.1, lineHeight: 1.2 }}>{text}</span> : null}
      </div>
      {!isStat && caption ? (
        <div
          style={{
            padding: `${4 * u}px ${14 * u}px`,
            borderRadius: 10 * u,
            backgroundColor: "rgba(0,0,0,0.45)",
            color: "#fff",
            fontWeight: 600,
            fontSize: fs * 0.72,
            lineHeight: 1.35,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};
