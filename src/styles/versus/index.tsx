/**
 * Phong cách "So sánh đối đầu": khung chia hai phe bằng đường nối răng cưa phát sáng, huy hiệu VS ở giữa.
 * Xem skill `.claude/skills/style-versus/SKILL.md`.
 *
 * Luật lượt:
 *  - Cảnh lẻ (1, 3, 5… — chỉ số 0, 2, 4) vào phe A (màu accent), cảnh chẵn vào phe B (màu đối bù).
 *  - Phe còn lại giữ ảnh cảnh trước, tối đi — hai "đối thủ" luôn cùng hiện. Cảnh 1 đang chạy thì phe B
 *    xem trước cảnh 2 (tối) để ngay từ đầu đã thấy đủ hai bên.
 *  - Số cảnh lẻ: cảnh cuối là KẾT LUẬN — đường nối bị đẩy khỏi khung, phe A phủ toàn màn hình.
 *
 * Thứ tự lớp: hai phe (ảnh/nền màu, lớp tối, quầng màu, chớp) → hai nửa title card → đường nối → huy hiệu
 * → bảng tên + bảng điểm → con dấu → phụ đề → chữ title card. Cả khung rung khi con dấu đập xuống.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { activeIndexAt, seeded, useCaptionClock, useLayout } from "../shared";
import { sideLayout, type SideLayout } from "./layout";
import { CaptionBox, captionFit, PlateStack, scoreHeight, Stamp } from "./Overlays";
import { Emblem, Seam, SideMedia, SolidSide } from "./Stage";
import { CLASH_FRAME, IntroPanels, IntroText } from "./TitleIntro";
import {
  DIM_FRAMES,
  EASE_OUT,
  ENTER_FRAMES,
  makeGeo,
  ramp,
  SLAM,
  sideBounds,
  sideClip,
  sideColors,
  VERDICT_FRAMES,
  verdictOffset,
} from "./theme";

type SideKey = 0 | 1 | "verdict";

export const VersusStyle: React.FC<ShortProps> = ({ title, subtitle, handle, accent, captions, scenes, showTitle }) => {
  ensureFonts(["anton", "bevietnam"]);
  const frame = useCurrentFrame();
  const { width: W, height: H, safe, unit: u } = useLayout();
  const g = makeGeo(W, H, u);
  const { a: colorA, b: colorB } = sideColors(accent);
  const colors: [string, string] = [colorA, colorB];

  const n = scenes.length;
  const verdictIndex = n % 2 === 1 ? n - 1 : -1;
  const sideKeyOf = (i: number): SideKey => (i === verdictIndex ? "verdict" : ((i % 2) as 0 | 1));
  const starts = scenes.map((s) => msToFrames(s.startMs));
  const ends = scenes.map((s) => msToFrames(s.endMs));
  // Frame cảnh "vào sân". Cảnh 1 nằm sẵn dưới title card nên coi như đã vào; chữ của nó hiện khi title rút.
  const enterOf = (i: number) => (i === 0 ? (showTitle ? -ENTER_FRAMES : starts[0]) : starts[i]);
  const textEnterOf = (i: number) => (i === 0 && showTitle ? Math.max(starts[0], TITLE_FRAMES - 14) : starts[i]);
  const k = n > 0 ? Math.max(0, activeIndexAt(scenes, frame)) : -1;
  const activeSide: 0 | 1 = k < 0 || k === verdictIndex ? 0 : ((k % 2) as 0 | 1);
  const kEnter = k >= 0 ? textEnterOf(k) : 0;

  // Cảnh kết luận: đẩy đường nối ra khỏi khung. Chỉ 1 cảnh thì đẩy ngay khi title card rút.
  const vp = verdictIndex >= 0 ? ramp(frame, textEnterOf(verdictIndex), VERDICT_FRAMES, EASE_OUT) : 0;
  const offset = vp * verdictOffset(g);

  const introFade = showTitle ? ramp(frame, TITLE_FRAMES - 12, 12) : 1;

  // --- Giữ chỗ: phụ đề cao nhất và bảng điểm cao nhất của từng phe (hai lượt vì bề rộng phụ đề phụ thuộc bố cục).
  const captionSide = captions.map((c) => {
    const i = activeIndexAt(scenes, msToFrames(c.startMs));
    return n === 0 ? (0 as SideKey) : sideKeyOf(Math.max(0, i));
  });
  const keys: SideKey[] = [0, 1, "verdict"];
  const layouts = {} as Record<string, SideLayout>;
  for (const key of keys) {
    let lay = sideLayout(g, safe, key, { caption: 0, score: 0 });
    for (let pass = 0; pass < 2; pass++) {
      const boxW = lay.caption.right - lay.caption.left;
      const cap = captions.reduce(
        (m, c, i) => (captionSide[i] === key ? Math.max(m, captionFit(c.text, boxW, u, g.portrait).height) : m),
        0,
      );
      const score = scenes.reduce(
        (m, s, i) => (s.visual && sideKeyOf(i) === key ? Math.max(m, scoreHeight(s.visual, lay.plate.maxW, u)) : m),
        0,
      );
      lay = sideLayout(g, safe, key, { caption: cap, score });
    }
    layouts[String(key)] = lay;
  }

  // --- Ai đang đứng ở phe nào.
  const occupant = (s: 0 | 1) => {
    if (k < 0) return -1;
    const j = k % 2 === s ? k : k - 1;
    if (j >= 0) return j;
    return n > 1 ? 1 : -1; // cảnh 1 đang chạy: phe B xem trước cảnh 2
  };
  const previousOf = (j: number) => (j >= 2 ? j - 2 : j === 1 ? 1 : -1);

  // --- Rung khung: lúc hai nửa title card đập nhau và mỗi lần con dấu chạm.
  const impacts: number[] = [];
  if (showTitle) impacts.push(CLASH_FRAME);
  const stampAt = (i: number) => {
    const p = scenes[i].punch;
    return p ? Math.max(msToFrames(p.atMs), textEnterOf(i) + 6) : Infinity;
  };
  scenes.forEach((_, i) => {
    if (scenes[i].punch) impacts.push(stampAt(i) + 7);
  });
  let shake = 0;
  for (const t of impacts) {
    if (frame >= t && frame < t + 12) shake = Math.max(shake, 1 - (frame - t) / 12);
  }
  const shakeX = shake * 16 * u * seeded(`vx${frame}`, -1, 1);
  const shakeY = shake * 12 * u * seeded(`vy${frame}`, -1, 1);

  // --- Vẽ một phe.
  const renderSide = (s: 0 | 1) => {
    if (s === 1 && vp >= 1) return null;
    const rect = sideBounds(g, s, s === 0 ? offset : 0);
    const j = occupant(s);
    const color = colors[s];
    const isActive = s === activeSide;
    const layers: React.ReactNode[] = [];
    const media = (idx: number, shiftX: number, dim: number, key: string) => {
      const sc = scenes[idx];
      const life = Math.max(1, ends[idx] - starts[idx] + 60);
      const zoom = 1.03 + 0.06 * Math.min(1, Math.max(0, (frame - starts[idx]) / life));
      return (
        <AbsoluteFill key={key}>
          <SideMedia scene={sc} from={starts[idx]} rect={rect} color={color} side={s} u={u} zoom={zoom} shiftX={shiftX} />
          {dim > 0.001 ? (
            <div style={{ position: "absolute", left: rect.x + shiftX, top: rect.y, width: rect.w, height: rect.h, backgroundColor: `rgba(6,6,12,${0.62 * dim})` }} />
          ) : null}
        </AbsoluteFill>
      );
    };
    if (j >= 0) {
      const enter = enterOf(j);
      const p = j === k || j === 1 ? ramp(frame, enter, ENTER_FRAMES, EASE_OUT) : 1;
      // Cảnh 2 đang được xem trước (chưa tới lượt) thì đứng yên, không trượt.
      const inP = j > k ? 1 : p;
      const prev = previousOf(j);
      if (inP < 1 && prev >= 0) layers.push(media(prev, 0, 1, "prev"));
      const dim = j > k ? 1 : isActive ? 0 : ramp(frame, kEnter, DIM_FRAMES);
      const travel = s === 0 ? -(rect.x + rect.w) : W - rect.x;
      layers.push(media(j, (1 - inP) * travel, dim, "cur"));
      // Chớp sáng lúc ảnh mới chạm đường nối.
      const hit = enter + ENTER_FRAMES - 3;
      if (j <= k && frame >= hit && frame < hit + 10) {
        layers.push(<AbsoluteFill key="flash" style={{ backgroundColor: "#ffffff", opacity: 0.4 * (1 - ramp(frame, hit, 10)) }} />);
      }
    } else {
      // Chưa có cảnh nào cho phe này: nền màu phe, không chữ.
      layers.push(
        <div key="empty" style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
          <SolidSide color={color} label="" u={u} w={rect.w} h={rect.h} side={s} />
        </div>,
      );
    }
    // Quầng màu phe hắt từ đường nối vào, mạnh hơn ở phe đang nói.
    const toward = g.portrait ? (s === 0 ? "to top" : "to bottom") : s === 0 ? "to left" : "to right";
    const glow = isActive ? 0.42 : 0.22;
    layers.push(
      <div
        key="tint"
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          backgroundImage: `linear-gradient(${toward}, color-mix(in srgb, ${color} ${Math.round(glow * 100)}%, transparent) 0%, transparent 38%)`,
          opacity: 1 - vp * (s === 0 ? 1 : 0),
        }}
      />,
    );
    return (
      <AbsoluteFill key={`side${s}`} style={{ clipPath: sideClip(g, s, offset) }}>
        {layers}
      </AbsoluteFill>
    );
  };

  // --- Bảng tên, bảng điểm, con dấu của từng phe.
  const renderSideText = (s: 0 | 1) => {
    const j = occupant(s);
    if (j < 0) return null;
    const scene = scenes[j];
    const key = sideKeyOf(j);
    const lay = layouts[String(key)];
    const color = colors[s];
    const isActive = s === activeSide;
    const fadeB = s === 1 ? 1 - vp : 1;
    const active = j > k ? 0 : isActive ? 1 : 1 - ramp(frame, kEnter, 8);
    const out: React.ReactNode[] = [
      <PlateStack
        key={`plate${s}-${j}`}
        spot={lay.plate}
        W={W}
        H={H}
        u={u}
        frame={frame}
        tag={scene.tag}
        visual={scene.visual}
        color={color}
        enter={j > k ? textEnterOf(0) : textEnterOf(j)}
        active={active}
        opacity={introFade * fadeB}
        from={s === 0 ? -1 : 1}
      />,
    ];
    if (scene.punch && j <= k) {
      const stampOpacity = isActive ? 1 : 1 - ramp(frame, kEnter, 8);
      out.push(
        <Stamp
          key={`stamp${s}-${j}`}
          text={scene.punch.text}
          cx={lay.stamp.cx}
          cy={lay.stamp.cy}
          maxW={lay.stamp.maxW}
          maxH={lay.stamp.maxH}
          u={u}
          frame={frame}
          at={stampAt(j)}
          color={color}
          tilt={key === "verdict" ? -5 : s === 0 ? -7 : 6}
          opacity={stampOpacity * introFade}
        />,
      );
    }
    return out;
  };

  // --- Phụ đề: câu nằm ở phe của cảnh đang chạy lúc câu bắt đầu.
  const cap = useCaptionClock(captions);
  let captionNode: React.ReactNode = null;
  if (cap.caption && cap.index >= 0 && !(showTitle && frame < TITLE_FRAMES - 8)) {
    const key = captionSide[cap.index];
    const lay = layouts[String(key)];
    const sceneIdx = n > 0 ? Math.max(0, activeIndexAt(scenes, cap.startFrame)) : -1;
    const color = key === "verdict" ? colorA : colors[key];
    captionNode = (
      <CaptionBox
        key={`cap${cap.index}`}
        text={cap.caption.text}
        spot={lay.caption}
        H={H}
        u={u}
        portrait={g.portrait}
        frame={frame}
        start={Math.max(cap.startFrame, showTitle ? TITLE_FRAMES - 8 : 0)}
        color={color}
        punch={sceneIdx >= 0 ? (scenes[sceneIdx].punch?.text ?? null) : null}
        from={lay.caption.anchor === "top" ? -1 : 1}
      />
    );
  }

  // --- Huy hiệu VS.
  const emblemCx = g.portrait ? W / 2 : W / 2 + offset;
  const emblemCy = g.portrait ? H / 2 + offset : H / 2;
  const emblemIn = showTitle ? ramp(frame, CLASH_FRAME + 1, 10, SLAM) : 1;
  const pulse = Math.max(k >= 0 ? 1 - ramp(frame, kEnter, 18) : 0, 0.3 + 0.3 * Math.sin(frame / 9));
  const pairs = Math.floor(n / 2);
  const round = pairs >= 2 && k >= 0 && k !== verdictIndex ? `VÒNG ${Math.floor(k / 2) + 1}/${pairs}` : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#07070c", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px) scale(${1 + 0.025 * shake})` }}>
        {renderSide(0)}
        {renderSide(1)}
        {showTitle ? <IntroPanels g={g} frame={frame} safe={safe} colors={colors} labels={[scenes[0]?.tag ?? "", scenes[1]?.tag ?? ""]} /> : null}
        {vp < 1 ? (
          <Seam g={g} offset={offset} colorA={colorA} colorB={colorB} glow={0.6 + 0.4 * pulse} opacity={showTitle ? ramp(frame, CLASH_FRAME - 1, 3) : 1} />
        ) : null}
        <Emblem
          cx={emblemCx}
          cy={emblemCy}
          r={g.emblemR}
          u={u}
          colorA={colorA}
          colorB={colorB}
          scale={emblemIn * (1 - vp)}
          pulse={pulse}
          opacity={1 - vp}
          round={introFade >= 1 ? round : null}
        />
        {renderSideText(0)}
        {renderSideText(1)}
        {captionNode}
        {showTitle ? (
          <IntroText g={g} frame={frame} safe={safe} cx={emblemCx} cy={emblemCy} title={title} subtitle={subtitle} handle={handle} />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
