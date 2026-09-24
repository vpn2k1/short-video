import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { BoltIcon, CartIcon, FlameIcon, ProductSilhouette } from "./Icons";
import {
  alpha, clamp, fitLines, formatVnd, GOLD, INK, inkOn, NUM, parsePrice, SALE_ORANGE, SALE_RED, shade, SLAM, SMOOTH, UI, upper,
  type Geo,
} from "./live";
import { useVt } from "../../i18n/video";

/** Thẻ flash sale đứng bao lâu sau câu nhấn — khớp 90 frame chat dồn "Chốt đơn!" và tim bay dày. */
export const SALE_FRAMES = 96;
const EXIT_FRAMES = 10;

type Sale = { scene: Scene; index: number; at: number };

/** Câu nhấn đang hiện (lúc nhấn là frame tuyệt đối `at`) và cảnh của nó; null nếu không có. */
export const activeSale = (scenes: Scene[], frame: number): Sale | null => {
  let best: Sale | null = null;
  scenes.forEach((scene, index) => {
    if (!scene.punch?.text.trim()) return;
    const at = msToFrames(scene.punch.atMs);
    if (frame >= at && frame < at + SALE_FRAMES) best = { scene, index, at };
  });
  return best;
};

/** Mức hiện của thẻ (0–1) — lớp khác dùng để lùi lại khi thẻ đang đứng giữa màn hình. */
export const saleLevel = (scenes: Scene[], frame: number) => {
  const sale = activeSale(scenes, frame);
  if (!sale) return 0;
  const age = frame - sale.at;
  return Math.min(interpolate(age, [0, 6], [0, 1], clamp), interpolate(age, [SALE_FRAMES - EXIT_FRAMES, SALE_FRAMES], [1, 0], clamp));
};

const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, "0");

/** Ô số của đồng hồ đếm ngược: nền đen, số trắng Montserrat. */
const TimeBox: React.FC<{ value: string; size: number; u: number }> = ({ value, size, u }) => (
  <div
    style={{
      minWidth: size * 1.45,
      height: size * 1.4,
      borderRadius: 8 * u,
      backgroundColor: INK,
      color: "#fff",
      fontFamily: NUM,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontVariantNumeric: "tabular-nums",
    }}
  >
    {value}
  </div>
);

/** Tia nắng xoay chậm sau thẻ — 16 tia vàng trong suốt, tâm ở (0,0) của khung chứa. */
const Rays: React.FC<{ size: number; frame: number; opacity: number }> = ({ size, frame, opacity }) => (
  <svg
    width={size}
    height={size}
    viewBox="-50 -50 100 100"
    style={{
      position: "absolute",
      left: -size / 2,
      top: -size / 2,
      rotate: `${frame * 0.5}deg`,
      opacity,
      maskImage: "radial-gradient(circle, #000 0%, #000 30%, transparent 68%)",
      WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 30%, transparent 68%)",
    }}
  >
    {Array.from({ length: 16 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 16;
      const b = a + Math.PI / 22;
      return (
        <polygon
          key={i}
          points={`0,0 ${(50 * Math.cos(a)).toFixed(2)},${(50 * Math.sin(a)).toFixed(2)} ${(50 * Math.cos(b)).toFixed(2)},${(50 * Math.sin(b)).toFixed(2)}`}
          fill={alpha(GOLD, i % 2 ? 0.2 : 0.38)}
        />
      );
    })}
  </svg>
);

/**
 * `punch` = khoảnh khắc chốt deal: chớp trắng, thẻ đập xuống giữa màn hình (phóng 1.45 → 1, lắc) trên nền tia nắng.
 * Câu nhấn có giá ("chỉ 199k", "từ 399k còn 199k") → thẻ FLASH SALE: đầu thẻ đỏ-cam có tia sét và đồng hồ đếm ngược,
 * ảnh sản phẩm có chip "-50%", giá cũ gạch ngang, giá mới lăn từ giá cũ xuống, thanh "Đã bán" và nút MUA NGAY phập phồng.
 * Không có giá → thẻ "ĐIỂM NỔI BẬT": câu nhấn in hoa cỡ lớn quét dạ quang.
 */
export const FlashSale: React.FC<{ geo: Geo; scenes: Scene[]; accent: string; ready: boolean }> = ({ geo, scenes, accent, ready }) => {
  const frame = useCurrentFrame();
  const vt = useVt();
  const sale = activeSale(scenes, frame);
  if (!sale) return null;
  const { scene, index, at } = sale;
  const { u, saleCx, saleCy, saleW, wide } = geo;
  const age = frame - at;
  const slam = interpolate(age, [0, 14], [0, 1], { ...clamp, easing: SLAM });
  const exit = interpolate(age, [SALE_FRAMES - EXIT_FRAMES, SALE_FRAMES], [0, 1], { ...clamp, easing: SMOOTH });
  const shake = age < 12 ? Math.sin(age * 2.6) * (12 - age) * 0.9 * u : 0;
  const flash = interpolate(age, [0, 2, 8], [0, 0.55, 0], clamp);
  const punch = scene.punch!.text.normalize("NFC").trim();
  const price = parsePrice(punch);
  const pulse = 1 + 0.05 * Math.max(0, Math.sin((age - 14) / 4));
  const headH = (wide ? 84 : 96) * u;
  const headFs = (wide ? 40 : 46) * u;
  const secondsLeft = 299 - Math.floor(Math.max(0, age) / 30);
  const button = (
    <div
      style={{
        marginTop: 22 * u,
        height: (wide ? 82 : 96) * u,
        borderRadius: 999,
        background: `linear-gradient(90deg, ${accent}, ${shade(accent, -0.18)})`,
        color: inkOn(accent),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14 * u,
        fontFamily: UI,
        fontWeight: 900,
        fontSize: (wide ? 36 : 42) * u,
        letterSpacing: 1 * u,
        scale: String(pulse),
        boxShadow: `0 ${8 * u}px ${22 * u}px ${alpha(accent, 0.45)}`,
      }}
    >
      <CartIcon size={(wide ? 40 : 46) * u} color={inkOn(accent)} />
      {vt("MUA NGAY")}
    </div>
  );

  let body: React.ReactNode;
  if (price) {
    const thumb = (wide ? 190 : 220) * u;
    const roll = interpolate(age, [8, 30], [0, 1], { ...clamp, easing: SMOOTH });
    const shown = Math.round((price.old - (price.old - price.now) * roll) / 1000) * 1000;
    const sold = interpolate(age, [10, 60], [62, 91], { ...clamp, easing: SMOOTH });
    const name = scene.tag?.normalize("NFC").trim() ?? "";
    const priceText = formatVnd(shown);
    body = (
      <>
        <div style={{ display: "flex", gap: 24 * u, alignItems: "center" }}>
          <div
            style={{
              width: thumb,
              height: thumb,
              borderRadius: 24 * u,
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
              <SceneMedia scene={{ ...scene, volume: 0 }} from={msToFrames(scene.startMs)} />
            ) : (
              <ProductSilhouette size={thumb * 0.92} tone={shade(accent, 0.55)} rim="#fff" />
            )}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                padding: `${6 * u}px ${14 * u}px`,
                borderRadius: `0 0 ${16 * u}px 0`,
                backgroundColor: SALE_RED,
                color: "#fff",
                fontFamily: NUM,
                fontWeight: 900,
                fontSize: 30 * u,
                lineHeight: 1.1,
              }}
            >
              -{price.discount}%
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 * u }}>
            {name ? (
              <div
                style={{
                  fontFamily: UI,
                  fontWeight: 800,
                  fontSize: 30 * u,
                  lineHeight: 1.3,
                  color: INK,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {name}
              </div>
            ) : null}
            <div
              style={{
                fontFamily: NUM,
                fontWeight: 600,
                fontSize: 32 * u,
                color: "#8d8a96",
                textDecoration: "line-through",
                textDecorationThickness: 3 * u,
                lineHeight: 1.2,
              }}
            >
              {formatVnd(price.old)}
            </div>
            <div
              style={{
                fontFamily: NUM,
                fontWeight: 900,
                fontSize: (priceText.length > 10 ? 62 : 76) * u * (wide ? 0.9 : 1),
                color: SALE_RED,
                lineHeight: 1.05,
                letterSpacing: -1 * u,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {priceText}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 20 * u,
            position: "relative",
            height: 40 * u,
            borderRadius: 20 * u,
            backgroundColor: alpha(SALE_RED, 0.14),
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${sold}%`, height: "100%", borderRadius: 20 * u, background: `linear-gradient(90deg, ${SALE_ORANGE}, ${SALE_RED})` }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8 * u,
              fontFamily: UI,
              fontWeight: 800,
              fontSize: 24 * u,
              color: "#fff",
              textShadow: `0 ${1 * u}px ${3 * u}px rgba(0,0,0,0.35)`,
            }}
          >
            <FlameIcon size={26 * u} color={GOLD} />
            {vt("Đã bán {n}% · Sắp hết", { n: Math.round(sold) })}
          </div>
        </div>
        {button}
      </>
    );
  } else {
    const text = upper(punch);
    const { size } = fitLines(text, (wide ? 76 : 88) * u, 44 * u, saleW - 72 * u, 3, UI, 900, ready);
    const mark = interpolate(age, [6, 18], [0, 100], clamp);
    body = (
      <>
        <div style={{ fontFamily: UI, fontWeight: 900, fontSize: size, lineHeight: 1.18, color: SALE_RED, textAlign: "center", textWrap: "balance" }}>
          <span
            style={{
              backgroundImage: `linear-gradient(${GOLD}, ${GOLD})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${mark}% 38%`,
              backgroundPosition: "0 90%",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {text}
          </span>
        </div>
        {scene.tag?.trim() ? button : null}
      </>
    );
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${0.32 * slam * (1 - exit)})` }} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
      <div style={{ position: "absolute", left: saleCx, top: saleCy }}>
        <Rays size={saleW * 1.9} frame={frame} opacity={slam * (1 - exit)} />
      </div>
      <div
        key={index}
        style={{
          position: "absolute",
          left: saleCx - saleW / 2,
          top: saleCy,
          width: saleW,
          translate: `${shake}px -50%`,
          scale: String(interpolate(slam, [0, 1], [1.45, 1]) * (1 - exit * 0.25)),
          rotate: `${interpolate(slam, [0, 1], [-5, -1.2])}deg`,
          opacity: Math.min(1, slam * 2) * (1 - exit),
          borderRadius: 34 * u,
          overflow: "hidden",
          backgroundColor: "#fff",
          boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,0.45), 0 0 0 ${6 * u}px ${GOLD}`,
        }}
      >
        <div
          style={{
            height: headH,
            padding: `0 ${28 * u}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: `linear-gradient(90deg, ${SALE_RED}, ${SALE_ORANGE})`,
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 * u }}>
            {price ? <BoltIcon size={headFs * 1.2} color={GOLD} /> : <FlameIcon size={headFs * 1.1} color={GOLD} />}
            <span style={{ fontFamily: UI, fontWeight: 900, fontStyle: "italic", fontSize: headFs, letterSpacing: 1 * u, whiteSpace: "nowrap" }}>
              {price ? "FLASH SALE" : vt("ĐIỂM NỔI BẬT")}
            </span>
          </div>
          {price ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 * u }}>
              {geo.square ? null : (
                <span style={{ fontFamily: UI, fontWeight: 600, fontSize: 21 * u, marginRight: 6 * u, whiteSpace: "nowrap" }}>{vt("Kết thúc sau")}</span>
              )}
              <TimeBox value="00" size={26 * u} u={u} />
              <span style={{ fontFamily: NUM, fontWeight: 900, fontSize: 26 * u }}>:</span>
              <TimeBox value={pad2(Math.floor(secondsLeft / 60))} size={26 * u} u={u} />
              <span style={{ fontFamily: NUM, fontWeight: 900, fontSize: 26 * u }}>:</span>
              <TimeBox value={pad2(secondsLeft % 60)} size={26 * u} u={u} />
            </div>
          ) : null}
        </div>
        <div style={{ padding: `${28 * u}px ${36 * u}px ${32 * u}px` }}>{body}</div>
      </div>
    </AbsoluteFill>
  );
};
