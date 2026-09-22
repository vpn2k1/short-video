import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { ShortProps, Scene } from "../../compositions/Short/schema";
import { useFontReady } from "../../fonts/load";
import { SceneMedia } from "../media";
import { Grain, seeded, useLayout } from "../shared";
import { IdlePrompt, Line } from "./Lines";
import { buildSession, sceneAppear, type Entry } from "./session";
import { C, clamp, MONO, POP, ramp, withAlpha } from "./theme";

/**
 * Phong cách "Màn hình code" — xem skill style-terminal.
 *
 * Màn hình desktop tối: một cửa sổ terminal gõ từng câu phụ đề sau dấu nhắc "$", câu cũ trôi lên thành lịch sử mờ;
 * ảnh/clip của cảnh bật ra trong cửa sổ thứ hai ("preview_01.png" / "demo_01.mp4").
 *  - Dọc / vuông: cửa sổ ảnh ở trên, terminal bên dưới chồng mép. Cảnh không ảnh → terminal kéo cao lấp chỗ.
 *  - Ngang (≥ 1.3): terminal cột trái, cửa sổ ảnh bên phải. Cảnh không ảnh → terminal trượt ra giữa.
 * Terminal chỉ đổi vị trí/chiều cao chứ không đổi bề ngang, nên chữ không phải xuống dòng lại giữa chừng.
 */

type Box = { x: number; y: number; w: number; h: number };

const VIDEO = /\.(mp4|mov|webm)$/i;
/** Số frame terminal đổi chỗ khi cảnh chuyển giữa có ảnh / không ảnh. */
const MOVE_FRAMES = 14;
/** Chỉ vẽ ngần này dòng cuối — dòng xa hơn đã trôi khỏi khung. */
const MAX_LINES = 40;
/** Độ sáng còn lại của dòng lịch sử. */
const DIM = 0.42;

const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

const Desktop: React.FC<{ accent: string; unit: number }> = ({
  accent,
  unit,
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: C.desk,
      backgroundImage: [
        `radial-gradient(circle, rgba(255,255,255,0.055) ${(1.6 * unit).toFixed(2)}px, transparent ${(1.8 * unit).toFixed(2)}px)`,
        `radial-gradient(ellipse at 12% 8%, ${withAlpha(accent, 0.22)} 0%, transparent 55%)`,
        `radial-gradient(ellipse at 92% 95%, rgba(88, 166, 255, 0.16) 0%, transparent 55%)`,
      ].join(", "),
      backgroundSize: `${(38 * unit).toFixed(1)}px ${(38 * unit).toFixed(1)}px, 100% 100%, 100% 100%`,
    }}
  />
);

/** Khung cửa sổ kiểu macOS: thanh tiêu đề ba chấm màu, tên cửa sổ ở giữa. */
const WindowFrame: React.FC<{
  box: Box;
  title: string;
  unit: number;
  barH: number;
  accent?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ box, title, unit, barH, style, children }) => {
  const dot = 17 * unit;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: 20 * unit,
        overflow: "hidden",
        backgroundColor: C.body,
        border: `${Math.max(1, 1.5 * unit)}px solid ${C.line}`,
        boxShadow: `0 ${30 * unit}px ${80 * unit}px rgba(0,0,0,0.6), 0 0 0 ${Math.max(1, unit)}px rgba(0,0,0,0.5)`,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          height: barH,
          flexShrink: 0,
          backgroundColor: C.bar,
          borderBottom: `${Math.max(1, unit)}px solid ${C.line}`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 22 * unit,
            display: "flex",
            gap: 11 * unit,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{
                width: dot,
                height: dot,
                borderRadius: dot,
                backgroundColor: c,
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 23 * unit,
            color: C.dim,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "58%",
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
};

/** Cửa sổ xem ảnh/clip của một cảnh: bật ra (scale có vượt nhẹ), cảnh sau mở thì thu nhỏ mờ đi. */
const PreviewWindow: React.FC<{
  scene: Scene;
  index: number;
  appear: number;
  leave: number;
  box: Box;
  origin: string;
  unit: number;
  barH: number;
}> = ({ scene, index, appear, leave, box, origin, unit, barH }) => {
  const frame = useCurrentFrame();
  const inT = interpolate(frame, [appear, appear + 14], [0, 1], {
    ...clamp,
    easing: POP,
  });
  const outT = Number.isFinite(leave) ? ramp(frame, leave, 7) : 0;
  const opacity = ramp(frame, appear, 5) * (1 - outT);
  const scale = (0.78 + 0.22 * inT) * (1 - 0.06 * outT);
  // Mỗi cửa sổ mới lệch một chút như vừa được mở ra ở chỗ khác.
  const dx = seeded(`term-win-x-${index}`, -1, 1) * 14 * unit;
  const dy = seeded(`term-win-y-${index}`, -1, 1) * 10 * unit;
  const num = String(index + 1).padStart(2, "0");
  const name =
    scene.image && VIDEO.test(scene.image)
      ? `demo_${num}.mp4`
      : `preview_${num}.png`;
  return (
    <WindowFrame
      box={{ ...box, x: box.x + dx, y: box.y + dy }}
      title={name}
      unit={unit}
      barH={barH}
      style={{
        opacity,
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: origin,
        backgroundColor: "#000",
      }}
    >
      <AbsoluteFill>
        <SceneMedia
          scene={scene}
          from={appear}
          zoom={interpolate(frame, [appear, appear + 300], [1.02, 1.1], clamp)}
        />
      </AbsoluteFill>
    </WindowFrame>
  );
};

/** Frame một dòng bắt đầu mờ đi thành lịch sử: khi lệnh kế tiếp bắt đầu (số liệu thì giữ sáng tới hết cảnh). */
const dimFrames = (entries: Entry[]) =>
  entries.map((entry, i) => {
    for (let k = i + 1; k < entries.length; k++) {
      const next = entries[k];
      if (next.kind !== "cmd") continue;
      if (entry.kind === "visual" && next.scene === entry.scene) continue;
      return next.start;
    }
    return Infinity;
  });

export const TerminalStyle: React.FC<ShortProps> = ({
  title,
  subtitle,
  handle,
  accent,
  captions,
  scenes,
  showTitle,
}) => {
  const frame = useCurrentFrame();
  const { width, height, safe, unit } = useLayout();
  // Be Vietnam Pro: tiêu đề lớn + chữ dự phòng cho ký tự có dấu mà font mono của máy thiếu.
  useFontReady("bevietnam");

  const { entries, introEnd } = buildSession({
    title,
    subtitle,
    captions,
    scenes,
    showTitle,
  });
  const dimAt = dimFrames(entries);

  const wide = width / height >= 1.3;
  const barH = 58 * unit;
  const font = (wide ? 44 : 48) * unit;
  const pad = { x: 34 * unit, y: 26 * unit };

  // --- Hình học hai cửa sổ ---------------------------------------------------------------
  const margin = wide ? safe.side : Math.min(safe.side, 64 * unit);
  const top = safe.top;
  const bottom = height - safe.bottom;
  const areaH = bottom - top;
  let termWith: Box;
  let termAlone: Box;
  let preview: Box;
  let origin: string;
  if (wide) {
    const areaW = width - margin * 2;
    const termW = areaW * 0.56;
    termWith = { x: margin, y: top, w: termW, h: areaH };
    termAlone = { x: (width - termW) / 2, y: top, w: termW, h: areaH };
    const px = margin + termW - 24 * unit;
    const pw = width - margin - px;
    const ph = Math.min(areaH * 0.78, pw * 0.8);
    preview = { x: px, y: top + (areaH - ph) * 0.42, w: pw, h: ph };
    origin = "0% 60%";
  } else {
    const termW = width - margin * 2;
    const ph = areaH * 0.42;
    preview = { x: margin + 36 * unit, y: top, w: termW - 36 * unit, h: ph };
    termWith = {
      x: margin,
      y: top + ph + 22 * unit,
      w: termW,
      h: areaH - ph - 22 * unit,
    };
    termAlone = {
      x: margin,
      y: top + 10 * unit,
      w: termW,
      h: areaH - 10 * unit,
    };
    origin = "30% 100%";
  }

  // Mốc đổi bố cục: màn mở đầu (không ảnh) rồi từng cảnh.
  const modes = [
    { from: 0, image: false },
    ...scenes.map((s, i) => ({
      from: sceneAppear(scenes, i, introEnd),
      image: !!s.image,
    })),
  ];
  let modeIdx = 0;
  modes.forEach((m, i) => {
    if (frame >= m.from) modeIdx = i;
  });
  const cur = modes[Math.max(0, modeIdx)];
  const prev = modes[Math.max(0, modeIdx - 1)];
  const boxOf = (m: { image: boolean }) => (m.image ? termWith : termAlone);
  const term =
    modeIdx > 0
      ? lerpBox(boxOf(prev), boxOf(cur), ramp(frame, cur.from, MOVE_FRAMES))
      : boxOf(cur);

  // --- Dòng đang hiện -------------------------------------------------------------------
  const visible = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.start <= frame)
    .slice(-MAX_LINES);
  const last = visible[visible.length - 1]?.e;
  const idle =
    !last ||
    (last.kind !== "cmd" &&
      (last.scene >= 0 ? frame >= last.start + 6 : frame >= introEnd));
  const innerW = term.w - pad.x * 2;
  const ctx = { frame, font, unit, accent, innerW };

  const termTitle = handle
    ? `~/${handle.replace(/^@/, "")} — zsh`
    : "~/project — zsh";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: MONO }}>
      <Desktop accent={accent} unit={unit} />

      <WindowFrame box={term} title={termTitle} unit={unit} barH={barH}>
        {/* Scanline rất nhẹ cho cảm giác màn hình, không làm nhoè chữ. */}
        <AbsoluteFill
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, transparent 1px, transparent ${(4 * unit).toFixed(1)}px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: pad.x,
            right: pad.x,
            top: 0,
            bottom: pad.y,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            overflow: "hidden",
            fontSize: font,
            lineHeight: 1.42,
            color: C.text,
            overflowWrap: "anywhere",
            textShadow: `0 0 ${(10 * unit).toFixed(1)}px rgba(230, 237, 243, 0.16)`,
            // Dòng cũ tan dần ở mép trên thay vì bị cắt ngang.
            maskImage: `linear-gradient(to bottom, transparent 0px, black ${(font * 1.1).toFixed(0)}px)`,
            WebkitMaskImage: `linear-gradient(to bottom, transparent 0px, black ${(font * 1.1).toFixed(0)}px)`,
          }}
        >
          {/* Như terminal thật: chữ chạy từ trên xuống, đầy khung thì khối này cao hơn khung và neo đáy — dòng cũ trôi lên. */}
          <div
            style={{
              minHeight: "100%",
              flexShrink: 0,
              paddingTop: 0.8 * font,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {visible.map(({ e, i }) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  marginTop: e.kind === "cmd" ? 0.3 * font : 0,
                  opacity: 1 - (1 - DIM) * (Number.isFinite(dimAt[i]) ? ramp(frame, dimAt[i], 6) : 0),
                }}
              >
                <Line entry={e} ctx={ctx} cursor={e === last && !idle} />
              </div>
            ))}
            {idle ? (
              <div style={{ flexShrink: 0, marginTop: 0.3 * font }}>
                <IdlePrompt frame={frame} />
              </div>
            ) : null}
          </div>
        </div>
      </WindowFrame>

      {scenes.map((scene, i) => {
        if (!scene.image) return null;
        const appear = sceneAppear(scenes, i, introEnd);
        const leave =
          i < scenes.length - 1
            ? sceneAppear(scenes, i + 1, introEnd)
            : Infinity;
        if (frame < appear || frame >= leave + 8) return null;
        return (
          <PreviewWindow
            key={i}
            scene={scene}
            index={i}
            appear={appear}
            leave={leave}
            box={preview}
            origin={origin}
            unit={unit}
            barH={barH}
          />
        );
      })}

      <Grain opacity={0.05} animated={false} />
    </AbsoluteFill>
  );
};
