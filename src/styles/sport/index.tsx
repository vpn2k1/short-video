/**
 * Phong cách "Thể thao" — xem skill `.claude/skills/style-sport/SKILL.md`.
 *
 * Giao diện truyền hình thể thao: ảnh/clip toàn khung tăng tương phản, đẩy máy nhanh đầu cảnh; đổi cảnh bằng vệt
 * sọc chéo accent + tối quét ngang. Đồ hoạ: bảng tỉ số góc trên trái (đồng hồ trận, LIVE),
 * dải phụ đề nắp chéo hai đầu + ticker, bảng tên cầu thủ/vòng đấu (tag), bảng thống kê (visual), câu nhấn nổ kiểu
 * "GOAL!" có vệt tốc độ, chớp trắng và rung 6 frame (punch). Không ảnh → sân vận động ban đêm vẽ SVG.
 *
 * Thứ tự lớp: [rung: nền cảnh → bảng số → bảng tên → câu nhấn] → màn mở đầu → vệt sọc đổi cảnh
 * → khung PHÁT LẠI → bảng tỉ số → ticker → dải phụ đề → chớp trắng.
 * Âm thanh, chữ tự do, watermark do composition Short vẽ — không vẽ ở đây.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { ensureFonts } from "../../fonts/load";
import { activeIndexAt, seeded, useCaptionClock, useLayout } from "../shared";
import { Backdrop, StripeWipes } from "./Backdrop";
import { LowerThird, ScoreBug, Ticker } from "./Chrome";
import { Nameplate, PunchBurst, ReplayFrame, StatGraphic } from "./Graphics";
import { makeLayout } from "./layout";
import { PUNCH_HOLD, ramp, SHAKE_FRAMES, SPORT_FONTS } from "./theme";
import { TitleIntro } from "./TitleIntro";

export const SportStyle: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, showTitle }) => {
  ensureFonts(SPORT_FONTS);
  const frame = useCurrentFrame();
  const { width: W, height: H, unit: u, safe } = useLayout();
  const L = makeLayout(W, H, u, safe, captions, scenes);

  // Đồ hoạ lên sóng khi màn mở đầu bị vệt sọc quét đi (hoặc ngay từ đầu nếu tắt màn mở đầu).
  const onAir = showTitle ? TITLE_FRAMES : 0;
  const starts = scenes.map((s) => msToFrames(s.startMs));
  /** Frame cảnh "vào sóng": cảnh 1 nằm dưới màn mở đầu nên tính từ lúc màn mở đầu rút. */
  const enterOf = (i: number) => (i === 0 ? Math.max(starts[0], onAir) : starts[i]);
  /** Frame cảnh rời sóng: đầu cảnh sau; cảnh cuối giữ tới hết video (số lớn hữu hạn — interpolate không nhận Infinity). */
  const NEVER = 1e7;
  const exitOf = (i: number) => (i + 1 < scenes.length ? starts[i + 1] : NEVER);

  // Mốc cắt có vệt sọc: đầu mỗi cảnh (trừ cảnh 1) + lúc màn mở đầu rút.
  const cuts = starts.filter((f, i) => i > 0 && f > onAir + 4);
  if (showTitle) cuts.unshift(TITLE_FRAMES);

  const k = scenes.length ? Math.max(0, activeIndexAt(scenes, frame)) : -1;
  const scene = k >= 0 ? scenes[k] : null;

  // Câu nhấn của cảnh đang chạy: nổ lúc atMs (sớm nhất 4 frame sau khi cảnh vào sóng), giữ tối đa PUNCH_HOLD.
  const punchAt = (i: number) => {
    const p = scenes[i].punch;
    return p ? Math.max(msToFrames(p.atMs), enterOf(i) + 4) : NEVER;
  };
  const punchUntil = (i: number) => Math.min(punchAt(i) + PUNCH_HOLD, exitOf(i) - 6);
  const pAt = scene?.punch ? punchAt(k) : NEVER;
  const pUntil = scene?.punch ? Math.max(pAt + 12, punchUntil(k)) : NEVER;
  // Chạm: chữ đáp xuống ở frame thứ 5 → chớp trắng + rung 6 frame.
  const hit = pAt + 5;
  const shake = frame >= hit && frame < hit + SHAKE_FRAMES ? 1 - (frame - hit) / SHAKE_FRAMES : 0;
  const shakeX = shake * 22 * u * seeded(`spx${frame}`, -1, 1);
  const shakeY = shake * 16 * u * seeded(`spy${frame}`, -1, 1);
  const flash = frame >= hit ? 0.7 * (1 - ramp(frame, hit, 7)) : 0;

  // Phụ đề: dải dưới lên sóng cùng đồ hoạ; câu nhấn của cảnh chứa câu đó tô màu accent.
  const cap = useCaptionClock(captions);
  const capScene = cap.caption && scenes.length ? Math.max(0, activeIndexAt(scenes, cap.startFrame)) : -1;

  const tickerItems = [title, subtitle].map((t) => t.trim()).filter(Boolean);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0e17", overflow: "hidden" }}>
      <AbsoluteFill style={{ translate: `${shakeX}px ${shakeY}px`, scale: String(1 + 0.03 * shake) }}>
        <Backdrop scenes={scenes} accent={accent} firstEnter={onAir} />
        {scene?.visual ? (
          <StatGraphic
            key={`st${k}`}
            L={L}
            visual={scene.visual}
            accent={accent}
            enter={enterOf(k) + 10}
            exit={exitOf(k)}
            yieldFrom={L.portrait ? NEVER : pAt}
            yieldUntil={L.portrait ? NEVER + 1 : pUntil}
          />
        ) : null}
        {scene?.tag ? <Nameplate key={`tg${k}`} L={L} tag={scene.tag} accent={accent} enter={enterOf(k) + 4} exit={exitOf(k)} /> : null}
        {scene?.punch ? <PunchBurst key={`pb${k}`} L={L} text={scene.punch.text} accent={accent} at={pAt} until={pUntil} /> : null}
      </AbsoluteFill>
      {showTitle ? (
        <Sequence durationInFrames={TITLE_FRAMES}>
          <TitleIntro title={title} subtitle={subtitle} accent={accent} />
        </Sequence>
      ) : null}
      <StripeWipes cuts={cuts} accent={accent} />
      {scene?.punch ? <ReplayFrame L={L} accent={accent} at={pAt} until={pUntil} safeTop={safe.top} /> : null}
      <ScoreBug L={L} title={title} accent={accent} enter={onAir + 6} />
      <Ticker L={L} items={tickerItems} accent={accent} enter={onAir + 8} />
      <LowerThird
        L={L}
        caption={cap.caption}
        index={cap.index}
        startFrame={cap.startFrame}
        enter={onAir + 6}
        accent={accent}
        punch={capScene >= 0 ? (scenes[capScene].punch?.text ?? null) : null}
      />
      {flash > 0 ? <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};
