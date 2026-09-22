/**
 * Cửa sổ game: khung pixel dày, bên trong là ảnh/clip của cảnh qua bộ lọc "điểm ảnh hoá" (hoặc phong cảnh pixel
 * khi cảnh không ảnh), scanline mờ, bảng vật phẩm, popup câu nhấn và màn tan điểm ảnh khi đổi cảnh.
 * Nhãn "MÀN n: TAG" đè lên mép trên khung.
 */
import { interpolate } from "remotion";
import { msToFrames } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { SceneMedia } from "../media";
import { Landscape, PixelBox, PixelDissolve } from "./parts";
import { BLOCK, clamp, HUD_BG, INK, onTwos, snap, upperVi, WHITE, type Rect } from "./pixel";
import { ItemPanel, PunchPopup } from "./Popups";

/** Nửa thời gian màn tan điểm ảnh: phủ 9 frame trước điểm cắt, lộ 9 frame sau. */
export const DISSOLVE = 9;

/**
 * Bộ lọc SVG điểm ảnh hoá: lấy mẫu 1 điểm mỗi ô b×b rồi nở ra cả ô, sau đó giảm còn 7 mức màu mỗi kênh.
 * Tĩnh (không đổi theo frame) và chỉ một lớp, nên clip video vẫn render nhanh.
 */
export const PixelateFilter: React.FC<{ block: number }> = ({ block }) => {
  const b = Math.max(2, Math.round(block));
  const levels = "0 0.17 0.33 0.5 0.67 0.83 1";
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <filter id="px-pixelate" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feFlood x={Math.floor(b / 2)} y={Math.floor(b / 2)} width={1} height={1} />
        <feComposite width={b} height={b} />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius={b / 2} result="blocks" />
        <feComponentTransfer in="blocks">
          <feFuncR type="discrete" tableValues={levels} />
          <feFuncG type="discrete" tableValues={levels} />
          <feFuncB type="discrete" tableValues={levels} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
};

/** Nhãn màn chơi đè lên mép trên cửa sổ: khối màu nhấn "MÀN n" + khối tối chứa tag. */
const StagePlate: React.FC<{ index: number; tag: string | null; x: number; y: number; local: number; P: number; unit: number; accent: string }> = ({
  index,
  tag,
  x,
  y,
  local,
  P,
  unit,
  accent,
}) => {
  // Trượt vào từ trái theo nấc 2 ô, 10 frame.
  const slide = snap(interpolate(onTwos(local), [0, 10], [-420 * unit, 0], clamp), P * 2);
  const size = 30 * unit;
  const label = tag ? upperVi(tag) : null;
  const cell: React.CSSProperties = {
    fontFamily: BLOCK,
    fontSize: size,
    lineHeight: 1.35,
    padding: `${P * 1.5}px ${P * 2.5}px`,
    whiteSpace: "nowrap",
    border: `${P}px solid ${INK}`,
  };
  return (
    <div style={{ position: "absolute", left: x + slide, top: y, display: "flex", translate: "0 -50%", opacity: local < 0 ? 0 : 1 }}>
      <div style={{ ...cell, backgroundColor: accent, color: WHITE, textShadow: `${P * 0.5}px ${P * 0.5}px 0 ${INK}` }}>MÀN {index + 1}</div>
      {label ? (
        <div style={{ ...cell, marginLeft: -P, backgroundColor: HUD_BG, color: WHITE, maxWidth: 640 * unit, overflow: "hidden" }}>{label}</div>
      ) : null}
    </div>
  );
};

export const Viewport: React.FC<{
  scenes: Scene[];
  scene: Scene | null;
  index: number;
  startFrame: number;
  frame: number;
  rect: Rect;
  P: number;
  unit: number;
  accent: string;
  /** Frame cảnh đầu thực sự hiện ra (sau màn tiêu đề). */
  firstAppear: number;
  /** Tâm popup câu nhấn theo chiều dọc, tính trong vùng trong của cửa sổ. */
  punchY: number;
  /** Chiều cao phần trong cửa sổ không bị hộp thoại che. */
  visibleH: number;
}> = ({ scenes, scene, index, startFrame, frame, rect, P, unit, accent, firstAppear, punchY, visibleH }) => {
  const rings = [INK, WHITE, "#c9d2ff", INK];
  const inner: Rect = { x: 0, y: 0, w: rect.w - rings.length * P * 2, h: rect.h - rings.length * P * 2 };
  const appear = index <= 0 ? firstAppear : startFrame;
  const local = frame - appear;

  // Màn tan điểm ảnh quanh điểm cắt gần nhất.
  let dissolve: { t: number; reveal: boolean } | null = null;
  for (let i = 1; i < scenes.length; i++) {
    const cut = msToFrames(scenes[i].startMs);
    if (frame >= cut - DISSOLVE && frame < cut) dissolve = { t: interpolate(onTwos(frame), [cut - DISSOLVE, cut - 1], [0.08, 1], clamp), reveal: false };
    else if (frame >= cut && frame < cut + DISSOLVE) dissolve = { t: interpolate(onTwos(frame), [cut, cut + DISSOLVE - 1], [0, 0.92], clamp), reveal: true };
  }

  const punchAt = scene?.punch ? Math.max(appear, msToFrames(scene.punch.atMs)) : 0;
  const hero = !scene?.image;
  // Bảng vật phẩm và popup chỉ đặt trong phần cửa sổ còn nhìn thấy (trên hộp thoại khi hộp đè lên).
  const seen: Rect = { ...inner, h: Math.min(inner.h, visibleH) };
  const wideArea = seen.w > seen.h * 1.4;
  const heroSide = hero && !!scene?.visual && wideArea;

  return (
    <>
      <PixelBox rect={rect} P={P} rings={rings} fill={HUD_BG}>
        {scene?.image ? (
          <div style={{ position: "absolute", inset: 0, filter: "url(#px-pixelate)" }}>
            <SceneMedia scene={scene} from={startFrame} zoom={interpolate(frame, [startFrame, startFrame + 360], [1.04, 1.12], clamp)} />
          </div>
        ) : (
          <Landscape w={inner.w} h={inner.h} variant={Math.max(0, index)} frame={frame} seed={`px-land-${index}`} unit={unit} />
        )}
        {/* scanline CRT rất mờ */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 ${Math.max(1, P / 3)}px, transparent ${Math.max(1, P / 3)}px ${P}px)`,
          }}
        />
        {scene?.visual ? (
          <ItemPanel visual={scene.visual} local={local - 10} area={seen} hero={hero} P={P} unit={unit} accent={accent} />
        ) : null}
        {scene?.punch ? (
          <PunchPopup
            text={scene.punch.text}
            local={frame - punchAt}
            area={seen}
            cy={heroSide ? seen.h * 0.45 : hero && scene.visual ? Math.min(punchY, seen.h * 0.17) : punchY}
            cx={heroSide ? seen.w * 0.27 : undefined}
            span={heroSide ? 0.46 : undefined}
            P={P}
            unit={unit}
            accent={accent}
          />
        ) : null}
        {dissolve ? <PixelDissolve w={inner.w} h={inner.h} t={dissolve.t} reveal={dissolve.reveal} color={INK} /> : null}
      </PixelBox>
      {scene ? (
        <StagePlate index={Math.max(0, index)} tag={scene.tag} x={rect.x + P * 4} y={rect.y} local={local} P={P} unit={unit} accent={accent} />
      ) : null}
    </>
  );
};
