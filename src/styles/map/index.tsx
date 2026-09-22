/**
 * Phong cách "Bản đồ hành trình": tấm bản đồ minh hoạ vẽ tay bằng SVG (không tile, không mạng) — biển xanh xám,
 * đất màu giấy có vòng sóng quanh bờ, lưới kinh vĩ tuyến, la bàn, khung viền. Mỗi cảnh là một điểm dừng: máy bay kéo
 * đường gạch từ ghim trước sang, camera bay theo (lùi ra giữa đường rồi sà vào), ghim cắm xuống, nhãn địa danh bật ra,
 * ảnh của cảnh thành tấm bưu thiếp. Phụ đề trong bảng giấy dưới đáy. Xem skill `.claude/skills/style-map/SKILL.md`.
 *
 * Thứ tự lớp: biển → bản đồ (theo camera) → ghim/nhãn/viên số/máy bay → bưu thiếp → con dấu → la bàn, khung viền
 * → bảng phụ đề → khung tiêu đề → nhiễu giấy.
 */
import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import { noMotion, type Scene, type ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { activeIndexAt, Grain, useLayout } from "../shared";
import {
  bezierAngle, bezierAt, blendCamera, buildWorld, chars, clamp, deep, FLY, MAP, mix, OUT, pad2, POP, toScreen, type Camera, type Pt,
} from "./geo";
import { CaptionPanel, TitleCartouche } from "./Panel";
import {
  CircleMark, Compass, FoldCreases, Neatline, PaperVignette, Pin, pinHead, PlaceLabel, Plane, Postcard, RubberStamp, SmallLabel, splitTag,
  StatBadge, statSize, type Rect,
} from "./parts";
import { Terrain } from "./Terrain";

const FALLBACK_SCENE: Scene = {
  image: null, visual: null, tag: null, punch: null, trimStartMs: 0, volume: 0, crop: null, ...noMotion(),
  startMs: 0, endMs: Number.MAX_SAFE_INTEGER,
};

type Mode = "tall" | "wide" | "square";

type MapLayout = {
  mode: Mode;
  panel: Rect;
  card: Rect;
  /** Điểm neo trên màn của ghim đang đứng: cảnh có ảnh / cảnh chỉ có bản đồ. */
  focusImg: Pt;
  focusMap: Pt;
  /** Zoom camera (px màn trên một đơn vị bản đồ) khi đứng ở một điểm dừng có ảnh. */
  zoom: number;
  pin: number;
  labelSize: number;
  captionSize: number;
  compass: { x: number; y: number; r: number };
};

/**
 * Bố cục theo tỉ lệ khung:
 *  - dọc: bưu thiếp trên, ghim giữa (nhãn bên phải), bảng phụ đề dưới;
 *  - ngang: bản đồ + bảng phụ đề bên trái, bưu thiếp cao bên phải;
 *  - vuông: bưu thiếp góc trên phải, ghim bên trái (nhãn bên dưới), bảng phụ đề ngang đáy.
 */
const useMapLayout = (): MapLayout => {
  const { width: w, height: h, safe, unit } = useLayout();
  const mode: Mode = h / w >= 1.2 ? "tall" : w / h >= 1.2 ? "wide" : "square";
  if (mode === "tall") {
    const panelH = Math.min(300 * unit, h * 0.19);
    const mx = Math.max(48 * unit, safe.side * 0.45);
    const panel = { x: mx, y: h - safe.bottom - panelH, w: w - mx * 2, h: panelH };
    const top0 = safe.top + 24 * unit;
    const region = panel.y - top0;
    const cardH = region * 0.52;
    const cardW = Math.min(w - 2 * Math.max(60 * unit, safe.side * 0.55), cardH * 1.42);
    return {
      mode,
      panel,
      card: { x: (w - cardW) / 2, y: top0, w: cardW, h: cardH },
      focusImg: { x: w * 0.47, y: top0 + region * 0.71 },
      focusMap: { x: w * 0.5, y: top0 + region * 0.44 },
      zoom: 0.72 * unit,
      pin: 34 * unit,
      labelSize: 50 * unit,
      captionSize: 54 * unit,
      compass: { x: w - mx - 66 * unit, y: panel.y - 96 * unit, r: 58 * unit },
    };
  }
  if (mode === "wide") {
    const panelH = Math.min(250 * unit, h * 0.26);
    const mx = safe.side * 0.6;
    const panel = { x: mx, y: h - safe.bottom - panelH, w: w * 0.53, h: panelH };
    const cardX = w * 0.585;
    const cardW = w - mx - cardX;
    const avail = h - safe.bottom - (safe.top + 10 * unit);
    const cardH = Math.min(avail, cardW * 0.98);
    return {
      mode,
      panel,
      card: { x: cardX, y: safe.top + 10 * unit + (avail - cardH) / 2, w: cardW, h: cardH },
      focusImg: { x: w * 0.3, y: h * 0.3 },
      focusMap: { x: w * 0.58, y: h * 0.32 },
      zoom: 0.8 * unit,
      pin: 28 * unit,
      labelSize: 44 * unit,
      captionSize: 46 * unit,
      compass: { x: mx + 90 * unit, y: safe.top + 90 * unit, r: 56 * unit },
    };
  }
  const panelH = Math.min(220 * unit, h * 0.22);
  const mx = Math.max(48 * unit, safe.side * 0.55);
  const panel = { x: mx, y: h - safe.bottom - panelH, w: w - mx * 2, h: panelH };
  const cardX = w * 0.52;
  const cardY = safe.top + 10 * unit;
  return {
    mode,
    panel,
    card: { x: cardX, y: cardY, w: w - mx - cardX, h: panel.y - 30 * unit - cardY },
    focusImg: { x: w * 0.3, y: h * 0.3 },
    focusMap: { x: w * 0.55, y: h * 0.3 },
    zoom: 0.5 * unit,
    pin: 26 * unit,
    labelSize: 40 * unit,
    captionSize: 44 * unit,
    compass: { x: mx + 70 * unit, y: safe.top + 80 * unit, r: 48 * unit },
  };
};

export const MapStyle: React.FC<ShortProps> = ({ title, subtitle, handle, accent, captions, scenes, showTitle }) => {
  ensureFonts(["bevietnam", "playfair"]);
  const frame = useCurrentFrame();
  const { width, height, unit, safe } = useLayout();
  const L = useMapLayout();
  const stops = scenes.length > 0 ? scenes : [FALLBACK_SCENE];
  const n = stops.length;
  const world = useMemo(() => buildWorld(n, `map-${title}`), [n, title]);

  // ---- Nhịp từng điểm dừng -------------------------------------------------
  const titleEnd = showTitle ? TITLE_FRAMES : 0;
  const lastScene = stops[n - 1].endMs === Number.MAX_SAFE_INTEGER ? 0 : msToFrames(stops[n - 1].endMs);
  const lastEnd = Math.max(lastScene, titleEnd + 1);
  /** Frame bắt đầu cảnh i (không sớm hơn lúc hết phần mở đầu, luôn tăng dần). */
  const starts: number[] = [];
  stops.forEach((s, i) => {
    const raw = i === 0 ? 0 : Math.max(msToFrames(s.startMs), titleEnd);
    starts.push(i === 0 ? 0 : Math.max(raw, starts[i - 1] + 2));
  });
  const endOf = (i: number) => (i + 1 < n ? starts[i + 1] : Math.max(starts[i] + 1, lastEnd));
  /** Lúc bay bắt đầu và lúc ghim cắm xuống. */
  const flyFrom = (i: number) => (i === 0 ? (showTitle ? TITLE_FRAMES - 22 : 0) : starts[i]);
  const arriveAt = (i: number) => {
    if (i === 0) return showTitle ? TITLE_FRAMES - 4 : 6;
    const dur = endOf(i) - starts[i];
    return starts[i] + Math.max(10, Math.min(36, Math.round(dur * 0.42)));
  };
  let active = 0;
  for (let i = 0; i < n; i++) if (frame >= starts[i]) active = i;

  // ---- Camera --------------------------------------------------------------
  const hasImg = (i: number) => Boolean(stops[i].image);
  const baseCam = (i: number): Camera => ({
    c: world.pins[i],
    z: L.zoom * (hasImg(i) ? 1 : 1.18),
    f: hasImg(i) ? L.focusImg : L.focusMap,
  });
  /** Camera đứng ở điểm i, phóng rất chậm suốt thời gian dừng. */
  const restCam = (i: number, f: number): Camera => {
    const cam = baseCam(i);
    const a = arriveAt(i);
    const e = Math.max(a + 1, endOf(i));
    return { ...cam, z: cam.z * (1 + 0.04 * interpolate(f, [a, e], [0, 1], clamp)) };
  };
  const { bounds } = world;
  const bw = Math.max(bounds.maxX - bounds.minX, 500);
  const bh = Math.max(bounds.maxY - bounds.minY, 500);
  const overview: Camera = {
    c: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    z: Math.min((width * 0.72) / bw, (height * 0.5) / bh, L.zoom * 0.85),
    f: { x: width / 2, y: height * (L.mode === "tall" ? 0.6 : 0.55) },
  };
  let cam: Camera;
  let flyT = 1;
  if (active === 0) {
    if (showTitle && frame < arriveAt(0)) {
      const t = interpolate(frame, [flyFrom(0), arriveAt(0)], [0, 1], clamp);
      cam = blendCamera(overview, baseCam(0), FLY(t), 0);
    } else {
      cam = restCam(0, frame);
    }
  } else if (frame < arriveAt(active)) {
    flyT = FLY(interpolate(frame, [starts[active], arriveAt(active)], [0, 1], clamp));
    cam = blendCamera(restCam(active - 1, starts[active]), baseCam(active), flyT);
  } else {
    cam = restCam(active, frame);
  }
  const S = (p: Pt) => toScreen(cam, p);

  // ---- Mở bản đồ (phần tiêu đề) ---------------------------------------------
  const unfoldX = showTitle ? interpolate(frame, [0, 12], [0.06, 1], { ...clamp, easing: OUT }) : 1;
  const unfoldY = showTitle ? interpolate(frame, [6, 18], [0.35, 1], { ...clamp, easing: OUT }) : 1;
  const crease = showTitle ? interpolate(frame, [0, 20, 40], [1, 0.9, 0.35], clamp) : 0.35;
  const plan = showTitle ? interpolate(frame, [18, 30, TITLE_FRAMES, TITLE_FRAMES + 20], [0, 1, 1, 0.55], clamp) : 0.55;

  // ---- Các mốc của điểm đang đứng ------------------------------------------
  const scene = stops[active];
  const arrive = arriveAt(active);
  const drop = interpolate(frame, [arrive - 8, arrive + 2], [0, 1], { ...clamp, easing: Easing.bounce });
  const ripple = interpolate(frame, [arrive + 1, arrive + 22], [0, 1], clamp);
  const labelT = interpolate(frame, [arrive + 2, arrive + 12], [0, 1], { ...clamp, easing: POP });
  const cardT = interpolate(frame, [arrive + 3, arrive + 17], [0, 1], { ...clamp, easing: POP });
  const statT = interpolate(frame, [arrive + 10, arrive + 24], [0, 1], { ...clamp, easing: OUT });
  const punchAt = scene.punch ? Math.max(arrive + 8, msToFrames(scene.punch.atMs)) : 0;
  const stampT = scene.punch ? interpolate(frame, [punchAt, punchAt + 10], [0, 1], clamp) : 0;
  const circleT = scene.punch ? interpolate(frame, [punchAt + 2, punchAt + 18], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const shrink = active > 0 ? interpolate(frame, [starts[active], starts[active] + 10], [0, 1], clamp) : 1;

  const imgMode = hasImg(active);
  const pinSize = L.pin * (imgMode ? 1 : 1.25);
  const small = 17 * unit;
  const pinPos = S(world.pins[active]);
  // Nhãn: bên phải ghim (dọc, ngang có ảnh) hoặc canh giữa dưới ghim (vuông, cảnh chỉ bản đồ).
  const labelBelow = !imgMode || L.mode === "square";
  const labelSize = imgMode ? L.labelSize : L.labelSize * 1.45;
  const labelMaxW = labelBelow
    ? Math.min(width - 2 * safe.side * 0.5, imgMode ? 2 * Math.min(pinPos.x - 30 * unit, L.card.x - 20 * unit - pinPos.x) : width * 0.8)
    : Math.max(200 * unit, (L.mode === "wide" ? L.card.x - 24 * unit : width - Math.max(48 * unit, safe.side * 0.45)) - (pinPos.x + pinSize * 1.3));
  const labelAt = labelBelow ? { x: pinPos.x, y: pinPos.y + 20 * unit } : { x: pinPos.x + pinSize * 1.3, y: pinPos.y - pinHead(pinSize) };
  // Khung ước lượng của nhãn — để viên số tránh.
  const tagMain = scene.tag ? splitTag(scene.tag).main : "";
  const estW = Math.min(labelMaxW, chars(tagMain) * labelSize * 0.6 + labelSize);
  const estH = labelSize * (scene.tag && splitTag(scene.tag).sub ? 2.1 : 1.5);
  const labelRect: Rect = labelBelow
    ? { x: labelAt.x - estW / 2, y: labelAt.y, w: estW, h: estH }
    : { x: labelAt.x, y: labelAt.y - estH / 2, w: estW, h: estH };

  // Viên số: gắn vào giữa chặng vừa đi (cảnh đầu: gắn vào ghim), chọn chỗ trống quanh đó theo camera lúc đã dừng.
  let stat: { box: Rect; anchor: Pt } | null = null;
  if (scene.visual) {
    const size = statSize(scene.visual, unit);
    const rest = baseCam(active);
    const leg = world.legs[active];
    const anchorWorld = leg ? bezierAt(leg, 0.5) : world.pins[active];
    const a0 = toScreen(rest, anchorWorld);
    const g = 34 * unit;
    const cands: Pt[] = leg
      ? [
        { x: a0.x - size.w * 0.75, y: a0.y - size.h - g },
        { x: a0.x - size.w * 0.25, y: a0.y + g },
        { x: a0.x - size.w - g, y: a0.y - size.h / 2 },
        { x: a0.x + g, y: a0.y + g },
        { x: a0.x - size.w * 0.5, y: a0.y - size.h - g * 2.5 },
        { x: a0.x + g, y: a0.y - size.h / 2 },
        { x: a0.x + g, y: a0.y - size.h - g },
        { x: a0.x - size.w - g, y: a0.y - size.h - g * 2 },
        { x: a0.x - size.w - g, y: a0.y + g },
      ]
      : [
        { x: a0.x - size.w - pinSize * 1.4, y: a0.y - pinHead(pinSize) - size.h / 2 },
        { x: a0.x - size.w / 2, y: a0.y + 30 * unit + estH },
        { x: a0.x - size.w - pinSize, y: a0.y + g },
        { x: a0.x + pinSize * 1.4, y: a0.y + g },
      ];
    const pinRect: Rect = { x: a0.x - pinSize * 1.3, y: a0.y - pinSize * 3.4, w: pinSize * 2.6, h: pinSize * 3.6 };
    const restPin = toScreen(rest, world.pins[active]);
    const labelRest: Rect = { ...labelRect, x: labelRect.x + restPin.x - pinPos.x, y: labelRect.y + restPin.y - pinPos.y };
    const pinRest: Rect = { ...pinRect, x: restPin.x - pinSize * 1.3, y: restPin.y - pinSize * 3.4 };
    const blockers: Rect[] = [L.panel, pinRest, ...(scene.tag ? [labelRest] : []), ...(imgMode ? [L.card] : [])];
    const minX = Math.max(40 * unit, safe.side * 0.4);
    const inside = (r: Rect) => r.x >= minX && r.x + r.w <= width - minX && r.y >= safe.top * 0.7 && r.y + r.h <= height - safe.bottom;
    // Chọn chỗ ít đè nhất: ưu tiên theo thứ tự, phạt phần đè lên bảng phụ đề / nhãn / ghim / bưu thiếp và phần tràn khung.
    const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const cost = (r: Rect) => blockers.reduce((sum, b) => sum + area(r, b), 0) + (inside(r) ? 0 : size.w * size.h * 0.5);
    const scored = cands.map((c, k) => ({ r: { x: c.x, y: c.y, w: size.w, h: size.h }, c: cost({ x: c.x, y: c.y, w: size.w, h: size.h }) + k }));
    const box = scored.reduce((best, cur) => (cur.c < best.c ? cur : best)).r;
    box.x = Math.min(Math.max(minX, box.x), width - minX - size.w);
    box.y = Math.min(Math.max(safe.top * 0.7, box.y), height - safe.bottom - size.h);
    // Camera còn phóng chậm sau khi dừng: dời viên số theo cùng độ lệch của điểm neo cho dây nối không trôi.
    const a1 = S(anchorWorld);
    stat = { box: { ...box, x: box.x + a1.x - a0.x, y: box.y + a1.y - a0.y }, anchor: a1 };
  }

  // Máy bay trên chặng đang đi.
  const leg = world.legs[active];
  const planeT = active > 0 ? interpolate(frame, [starts[active], arriveAt(active)], [0, 1], clamp) : 1;
  const planeOpacity = leg && planeT < 1 ? interpolate(planeT, [0, 0.08, 0.86, 1], [0, 1, 1, 0], clamp) : 0;
  const planeP = leg ? S(bezierAt(leg, flyT)) : pinPos;

  // Phụ đề: câu đang đọc và cảnh chứa nó.
  const ci = activeIndexAt(captions, frame);
  const caption = ci >= 0 ? captions[ci] : null;
  const captionScene = caption ? stops[Math.max(0, activeIndexAt(stops, msToFrames(caption.startMs)))] : null;
  const panelShow = captions.length === 0 ? 0 : showTitle ? interpolate(frame, [TITLE_FRAMES - 10, TITLE_FRAMES + 4], [0, 1], { ...clamp, easing: OUT }) : interpolate(frame, [0, 8], [0, 1], clamp);

  const pinColor = accent;
  const pastColor = mix(accent, MAP.ink, 0.35);
  const cardZoom = (i: number) => interpolate(frame, [starts[i], Math.max(starts[i] + 1, endOf(i))], [1.03, 1.12], clamp);
  const stampText = scene.punch ? (chars(scene.punch.text) <= 24 ? scene.punch.text : "Đã đến!") : "";
  const stampTop = scene.punch && chars(scene.punch.text) <= 24 ? `Đã đến · chặng ${pad2(active + 1)}` : `★ chặng ${pad2(active + 1)} ★`;
  const stampW = imgMode ? Math.min(L.card.w * 0.62, 460 * unit) : Math.min(width * 0.6, 480 * unit);
  const stampAt = imgMode
    ? { x: L.card.x + stampW * 0.5 + 10 * unit, y: L.card.y + L.card.h - 70 * unit }
    : { x: pinPos.x + 30 * unit, y: pinPos.y - pinHead(pinSize) - 190 * unit };

  return (
    <AbsoluteFill style={{ backgroundColor: MAP.sea, overflow: "hidden" }}>
      {/* Bản đồ mở ra: ngang trước, dọc sau, nếp gấp còn in mờ trên giấy. */}
      <AbsoluteFill style={{ scale: `${unfoldX.toFixed(4)} ${unfoldY.toFixed(4)}` }}>
        <Terrain world={world} cam={cam} accent={accent} active={active} draw={active > 0 ? flyT : 1} plan={plan} reached={frame >= arrive - 4 ? active : active - 1} />
        <FoldCreases strength={crease} />
      </AbsoluteFill>

      {/* Ghim đã qua: nhỏ lại, giữ nhãn tên. Ghim vừa rời thu nhỏ dần trong 10 frame đầu chặng mới. */}
      {world.pins.slice(0, active).map((p, i) => {
        const q = S(p);
        if (q.x < -200 || q.x > width + 200 || q.y < -200 || q.y > height + 200) return null;
        const leaving = i === active - 1;
        const size = leaving ? interpolate(shrink, [0, 1], [L.pin * (hasImg(i) ? 1 : 1.25), small]) : small;
        const tag = stops[i].tag;
        return (
          <div key={`past-${i}`}>
            <Pin x={q.x} y={q.y} size={size} color={leaving ? mix(pinColor, pastColor, shrink) : pastColor} n={i + 1} drop={1} ripple={0} />
            {tag ? <SmallLabel tag={tag} x={q.x + size * 1.3} y={q.y - pinHead(size)} unit={unit} opacity={leaving ? shrink : 0.95} /> : null}
          </div>
        );
      })}

      <CircleMark x={pinPos.x} y={pinPos.y - pinHead(pinSize) * 0.75} r={pinSize * 1.9} draw={circleT} color={deep(accent, 0.1)} unit={unit} seed={`map-circle-${active}`} />
      <Pin x={pinPos.x} y={pinPos.y} size={pinSize} color={pinColor} n={active + 1} drop={drop} ripple={ripple} />
      {scene.tag ? (
        <PlaceLabel tag={scene.tag} x={labelAt.x} y={labelAt.y} anchor={labelBelow ? "center" : "left"} maxW={labelMaxW} size={labelSize} accent={accent} t={labelT} unit={unit} />
      ) : null}
      {stat && scene.visual ? <StatBadge visual={scene.visual} box={stat.box} anchor={stat.anchor} t={statT} accent={accent} unit={unit} /> : null}
      {leg ? <Plane x={planeP.x} y={planeP.y} angle={bezierAngle(leg, flyT)} size={58 * unit} color={deep(accent, 0.3)} opacity={planeOpacity} lift={Math.sin(Math.PI * flyT)} /> : null}

      {/* Bưu thiếp: tấm của điểm trước thu về ghim cũ, tấm mới bật ra từ ghim mới. */}
      {active > 0 && hasImg(active - 1) && shrink < 1 ? (
        <Postcard rect={L.card} scene={stops[active - 1]} index={active - 1} from={starts[active - 1]} zoom={cardZoom(active - 1)} t={1} exit={shrink} origin={S(world.pins[active - 1])} accent={accent} unit={unit} />
      ) : null}
      {imgMode ? (
        <Postcard rect={L.card} scene={scene} index={active} from={starts[active]} zoom={cardZoom(active)} t={cardT} exit={0} origin={pinPos} accent={accent} unit={unit} />
      ) : null}
      {scene.punch ? <RubberStamp text={stampText} top={stampTop} x={stampAt.x} y={stampAt.y} width={stampW} t={stampT} accent={accent} unit={unit} /> : null}

      <Compass x={L.compass.x} y={L.compass.y} r={L.compass.r} frame={frame} accent={accent} opacity={0.9 * unfoldY} />
      <PaperVignette />
      <Neatline width={width} height={height} unit={unit} />

      <CaptionPanel
        rect={L.panel}
        caption={caption}
        scene={captionScene}
        stop={active + 1}
        total={n}
        frame={frame}
        base={L.captionSize}
        accent={accent}
        unit={unit}
        show={panelShow}
      />

      {showTitle && frame < TITLE_FRAMES ? (
        <TitleCartouche
          title={title}
          subtitle={subtitle}
          handle={handle}
          accent={accent}
          frame={frame}
          width={L.mode === "wide" ? width * 0.52 : L.mode === "square" ? width * 0.78 : width - 2 * Math.max(70 * unit, safe.side * 0.6)}
          cx={width / 2}
          cy={L.mode === "tall" ? height * 0.33 : height * 0.42}
          unit={unit}
          tall={L.mode === "tall"}
        />
      ) : null}
      <Grain opacity={0.07} animated={false} baseFrequency={0.75} />
    </AbsoluteFill>
  );
};
