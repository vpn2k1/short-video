/**
 * Bìa truyện mở đầu (chỉ khi showTitle, nằm trong Sequence dài TITLE_FRAMES):
 * nền tia nắng accent + halftone, măng-sét vàng chứa tên video, ô "SỐ 01", ảnh cảnh đầu
 * trong khung lớn, dải tagline là subtitle, handle là nhà phát hành. Cuối bìa lật văng sang trái.
 */
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { useLayout } from "../shared";
import { BurstShape, HEAVY } from "./Bits";
import { panelFrame, PanelArt, SpeedRays } from "./Panel";
import { clamp, comicPalette, fitBlock, INK, outline, upperVi, WHITE, YELLOW } from "./palette";

export const Cover: React.FC<{
  title: string;
  subtitle: string;
  handle: string;
  accent: string;
  firstScene: Scene | null;
}> = ({ title, subtitle, handle, accent, firstScene }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const { width: W, height: H, unit: u, fps, safe } = L;
  const stacked = W / H < 0.8;
  const pal = comicPalette(accent, 0);

  const exit = interpolate(frame, [TITLE_FRAMES - 11, TITLE_FRAMES], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });

  // Khung bố cục.
  const side = stacked ? Math.max(56 * u, safe.side * 0.55) : safe.side;
  const top = safe.top + (stacked ? 30 * u : 20 * u);
  const bottom = stacked ? H - safe.bottom + 60 * u : H - safe.bottom;

  const mastW = stacked ? W - 2 * side : (W - 2 * side) * 0.54;
  const titleText = upperVi(title || "Truyện mới");
  const titleSize = fitBlock(titleText, {
    maxWidth: mastW - 80 * u,
    maxHeight: stacked ? 3 * 150 * u : 4 * 130 * u,
    base: 150 * u,
    charW: 0.7,
    lineH: 1.12,
    min: 50 * u,
  });
  const subText = upperVi(subtitle || "");

  const mastS = spring({ frame, fps, config: { damping: 10, stiffness: 140 } });
  const panelPop = interpolate(frame, [5, 10, 14, 18], [1.5, 0.95, 1.03, 1], clamp);
  const panelIn = interpolate(frame, [5, 7], [0, 1], clamp);
  const tagS = spring({ frame: frame - 13, fps, config: { damping: 12, stiffness: 160 } });
  const issueS = spring({ frame: frame - 19, fps, config: { damping: 8, stiffness: 200 } });
  const newS = spring({ frame: frame - 24, fps, config: { damping: 7, stiffness: 180 } });
  const handleT = interpolate(frame, [28, 36], [0, 1], clamp);

  const masthead = (
    <div
      style={{
        position: "relative",
        width: mastW,
        boxSizing: "border-box",
        backgroundColor: YELLOW,
        border: `${10 * u}px solid ${INK}`,
        boxShadow: `${16 * u}px ${18 * u}px 0 ${INK}`,
        padding: `${56 * u}px ${36 * u}px ${34 * u}px`,
        transform: `translateY(${(1 - mastS) * -500 * u}px) rotate(${-2 + (1 - mastS) * -8}deg)`,
      }}
    >
      <div
        style={{
          ...HEAVY,
          fontSize: titleSize,
          // Dấu chồng tiếng Việt (Ộ, Ạ) cần khoảng dòng rộng hơn Latin.
          lineHeight: 1.12,
          color: pal.hot,
          textAlign: stacked ? "center" : "left",
          textShadow: outline(Math.max(3, titleSize * 0.05), INK, titleSize * 0.065),
        }}
      >
        {titleText}
      </div>
      {/* Ô số kỳ ở góc */}
      <div
        style={{
          position: "absolute",
          top: -52 * u,
          right: -26 * u,
          width: 150 * u,
          backgroundColor: WHITE,
          border: `${7 * u}px solid ${INK}`,
          boxShadow: `${8 * u}px ${8 * u}px 0 ${INK}`,
          textAlign: "center",
          color: INK,
          padding: `${6 * u}px 0 ${8 * u}px`,
          transform: `scale(${Math.max(0, issueS)}) rotate(8deg)`,
        }}
      >
        <div style={{ ...HEAVY, fontSize: 30 * u, lineHeight: 1.1 }}>{upperVi("Số")}</div>
        <div style={{ ...HEAVY, fontSize: 70 * u, lineHeight: 0.95 }}>01</div>
      </div>
    </div>
  );

  const tagline = subText ? (
    <div
      style={{
        backgroundColor: WHITE,
        border: `${7 * u}px solid ${INK}`,
        boxShadow: `${10 * u}px ${10 * u}px 0 ${INK}`,
        padding: `${14 * u}px ${30 * u}px`,
        ...HEAVY,
        fontWeight: 800,
        fontSize: fitBlock(subText, { maxWidth: (stacked ? W - 2 * side : mastW) - 120 * u, maxHeight: 2 * 56 * u * 1.15, base: 56 * u, charW: 0.65, lineH: 1.15, min: 30 * u }),
        lineHeight: 1.15,
        color: INK,
        textAlign: "center",
        transform: `translateX(${(1 - tagS) * -W}px) rotate(-2deg)`,
      }}
    >
      {subText}
    </div>
  ) : null;

  const handleRow = handle ? (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14 * u,
        backgroundColor: INK,
        color: WHITE,
        padding: `${10 * u}px ${26 * u}px`,
        border: `${4 * u}px solid ${WHITE}`,
        ...HEAVY,
        fontWeight: 800,
        fontSize: 36 * u,
        lineHeight: 1.1,
        opacity: handleT,
        transform: `translateY(${(1 - handleT) * 30 * u}px) rotate(1deg)`,
      }}
    >
      <span style={{ color: YELLOW }}>★</span>
      <span style={{ fontSize: 24 * u, opacity: 0.8 }}>{upperVi("Phát hành")}</span>
      <span>{handle}</span>
    </div>
  ) : null;

  const newBurst = (
    <div
      style={{
        position: "absolute",
        left: -60 * u,
        top: -70 * u,
        width: 230 * u,
        height: 230 * u,
        transform: `scale(${Math.max(0, newS)}) rotate(${-14 + (1 - newS) * -60}deg)`,
      }}
    >
      <BurstShape seedKey="comic-cover-new" spikes={14} outer={50} inner={36} jitter={4} fill={pal.hot} stroke={6 * u} shadow={3} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...HEAVY,
          fontSize: 62 * u,
          color: YELLOW,
          textShadow: outline(4 * u, INK, 5 * u),
        }}
      >
        {upperVi("Mới!")}
      </div>
    </div>
  );

  const artPanel = (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        width: "100%",
        transform: `scale(${panelPop}) rotate(1.5deg)`,
        opacity: panelIn,
      }}
    >
      <div style={{ position: "absolute", inset: 0, ...panelFrame(u) }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <PanelArt
            image={firstScene?.image ?? null}
            crop={firstScene?.crop ?? null}
            trimStartMs={firstScene?.trimStartMs ?? 0} speed={firstScene?.speed}
            volume={0}
            sceneStart={0}
            progress={frame / TITLE_FRAMES}
            frame={frame}
            rayA={pal.hot}
            rayB={YELLOW}
            unit={u}
          />
        </div>
      </div>
      {newBurst}
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        transform: `translateX(${-exit * W * 1.15}px) rotate(${-exit * 12}deg)`,
        transformOrigin: "0% 100%",
      }}
    >
      <SpeedRays a={pal.hot} b={pal.hotLight} frame={frame} />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(20,18,16,0.22) 0 ${7 * u}px, transparent ${8 * u}px)`,
          backgroundSize: `${24 * u}px ${24 * u}px`,
        }}
      />
      {stacked ? (
        <div
          style={{
            position: "absolute",
            left: side,
            right: side,
            top,
            bottom: H - bottom,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 56 * u,
          }}
        >
          {masthead}
          <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column" }}>
            {artPanel}
            {tagline ? (
              <div style={{ position: "absolute", left: -10 * u, right: 30 * u, bottom: -40 * u, display: "flex", justifyContent: "center" }}>
                {tagline}
              </div>
            ) : null}
          </div>
          <div style={{ marginTop: 10 * u }}>{handleRow}</div>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            left: side,
            right: side,
            top,
            bottom: H - bottom,
            display: "flex",
            gap: 70 * u,
            alignItems: "stretch",
          }}
        >
          <div style={{ width: mastW, display: "flex", flexDirection: "column", justifyContent: "center", gap: 50 * u, paddingTop: 40 * u }}>
            {masthead}
            {tagline}
            <div>{handleRow}</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: `${40 * u}px ${20 * u}px ${20 * u}px` }}>{artPanel}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
