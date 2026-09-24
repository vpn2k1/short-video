import { TITLE_FRAMES } from "../../constants";
import type { Scene } from "../../compositions/Short/schema";
import { FONTS, useLayout, useSceneClock } from "../shared";
import { OSD_WHITE, osdFont, REC_RED, tapeClock, upperVi } from "./vhs";
import { useVideoLanguage } from "../../i18n/video";

/** Bóng chữ OSD: quầng sáng trắng + bóng đen cứng để đọc được trên mọi nền. */
export const osdShadow = (unit: number) =>
  `0 0 ${6 * unit}px rgba(255,255,255,0.5), ${2 * unit}px ${2 * unit}px 0 rgba(0,0,0,0.8), 0 0 ${10 * unit}px rgba(0,0,0,0.55)`;

/** Kích thước chữ OSD dùng chung (title card cũng dùng). */
export const osdSize = (unit: number) => 42 * unit;

const Battery: React.FC<{ unit: number; frame: number; fps: number }> = ({ unit, frame, fps }) => {
  // Pin tụt dần mỗi 20 giây, còn 1 vạch thì nháy.
  const bars = Math.max(1, 3 - Math.floor(frame / (fps * 20)));
  const visible = bars > 1 || Math.floor(frame / 12) % 2 === 0;
  const border = Math.max(2, Math.round(3 * unit));
  return (
    <div style={{ display: "flex", alignItems: "center", filter: `drop-shadow(${2 * unit}px ${2 * unit}px 0 rgba(0,0,0,0.75))` }}>
      <div
        style={{
          width: 62 * unit,
          height: 30 * unit,
          border: `${border}px solid ${OSD_WHITE}`,
          borderRadius: 3 * unit,
          padding: 3 * unit,
          display: "flex",
          gap: 3 * unit,
          boxSizing: "border-box",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ flex: 1, backgroundColor: OSD_WHITE, opacity: visible && i < bars ? 1 : 0 }}
          />
        ))}
      </div>
      <div style={{ width: 5 * unit, height: 12 * unit, backgroundColor: OSD_WHITE }} />
    </div>
  );
};

/**
 * Màn hình hiển thị của máy quay: ● REC nháy, pin + SP, kênh + nhãn cảnh,
 * ngày/giờ chạy theo thời gian video. Mọi thứ nằm trong vùng an toàn.
 */
export const Osd: React.FC<{ scenes: Scene[]; title: string; showTitle: boolean }> = ({ scenes, title, showTitle }) => {
  const { frame, scene, index } = useSceneClock(scenes);
  const { unit, safe, fps, width, height } = useLayout();
  const language = useVideoLanguage();
  if (showTitle && frame < TITLE_FRAMES) return null;

  const wide = width / height > 1.2;
  const size = osdSize(unit);
  const pad = 14 * unit;
  const top = safe.top + pad;
  const side = safe.side;
  const recOn = frame % 30 < 20;
  const { date, time } = tapeClock(title, frame, fps, language);
  const base: React.CSSProperties = {
    position: "absolute",
    fontFamily: FONTS.mono,
    fontSize: size,
    lineHeight: 1.15,
    color: OSD_WHITE,
    textShadow: osdShadow(unit),
    whiteSpace: "nowrap",
  };

  const tag = scene?.tag ? upperVi(scene.tag) : null;
  const channel = `CH ${String(Math.max(0, index) + 1).padStart(2, "0")}`;

  return (
    <>
      <div style={{ ...base, left: side, top, display: "flex", alignItems: "center", gap: 14 * unit }}>
        <span
          style={{
            display: "inline-block",
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: "50%",
            backgroundColor: REC_RED,
            boxShadow: `0 0 ${10 * unit}px rgba(255,45,61,0.9)`,
            opacity: recOn ? 1 : 0,
          }}
        />
        <span>REC</span>
      </div>

      <div style={{ ...base, right: side, top, display: "flex", alignItems: "center", gap: 18 * unit }}>
        <Battery unit={unit} frame={frame} fps={fps} />
        <span>SP</span>
      </div>

      {tag ? (
        <div
          style={{
            ...base,
            left: side,
            top: top + size * 1.45,
            fontSize: size * 0.82,
            maxWidth: width - side * 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span>{channel} · </span>
          <span style={{ fontFamily: osdFont(tag), fontWeight: 600 }}>{tag}</span>
        </div>
      ) : null}

      <div
        style={{
          ...base,
          left: side,
          bottom: safe.bottom + pad,
          fontSize: size * 0.9,
          display: "flex",
          flexDirection: wide ? "row" : "column",
          gap: wide ? 28 * unit : 0,
        }}
      >
        <span>{time}</span>
        <span>{date}</span>
      </div>
    </>
  );
};
