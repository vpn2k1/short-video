/**
 * Phong cách "Album kỷ niệm": bảng bần treo tường, mỗi cảnh là một tấm polaroid (hoặc vé kỷ niệm khi không có ảnh)
 * rơi xuống giữa bảng, được dán băng keo washi / ghim đinh; sang cảnh mới thì tấm cũ lùi ra mép bảng, nhỏ lại và
 * tối đi — bảng đầy dần theo video. Lời nằm trên thẻ ghi chú kẻ dòng ghim phía dưới (bên phải khi khung ngang).
 * Xem skill `.claude/skills/style-scrapbook/SKILL.md`.
 *
 * Thứ tự lớp: bảng bần → các kỷ niệm (cũ dưới, mới trên) → thẻ ghi chú → bìa album → nhiễu giấy.
 */
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrames, TITLE_FRAMES } from "../../constants";
import type { ShortProps } from "../../compositions/Short/schema";
import { useFontReady } from "../../fonts/load";
import { activeIndexAt, Grain, seeded, useCaptionClock, useLayout } from "../shared";
import { AlbumCover, COVER_OPEN_END } from "./Cover";
import { buildBoard } from "./layout";
import { Memory } from "./Memory";
import { NoteCard } from "./NoteCard";
import { Cork } from "./paper";
import { HAND } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Rơi xuống bảng: vượt quá một chút rồi nảy về. */
const DROP = Easing.spring({ damping: 12, stiffness: 140 });
const DROP_FRAMES = 22;
/** Số frame ảnh cũ lùi ra mép bảng. */
const MOVE_FRAMES = 18;
/** Số chỗ trống quanh mép — ảnh thứ i+SLOTS nằm đè ảnh thứ i nên ảnh i được bỏ khỏi cây render. */
const SLOTS = 6;

export const ScrapbookStyle: React.FC<ShortProps> = ({ title, subtitle, accent, captions, scenes, showTitle }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const { unit } = layout;
  // Đo chữ bằng canvas cần font thật — đợi cả hai font viết tay.
  const handReady = useFontReady("patrick");
  const scriptReady = useFontReady("dancing");
  useFontReady("baloo");
  const board = buildBoard(layout, captions, handReady);
  const { caption, index: captionIndex } = useCaptionClock(captions);
  const active = activeIndexAt(scenes, frame);

  // Ảnh đầu tiên rơi xuống khi bìa album đang lật mở.
  const titleEnd = showTitle ? TITLE_FRAMES - 6 : 0;
  const appearOf = (i: number) => (i === 0 ? Math.max(msToFrames(scenes[0].startMs), titleEnd) : msToFrames(scenes[i].startMs));
  const heroCx = board.hero.x + board.hero.w / 2;
  const heroCy = board.hero.y + board.hero.h / 2;

  // Thẻ ghi chú được ghim lên cùng câu đầu tiên (không sớm hơn lúc bìa mở xong).
  const cardAppear = captions.length > 0 ? Math.max(msToFrames(captions[0].startMs), showTitle ? COVER_OPEN_END - 8 : 0) : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: HAND, backgroundColor: "#b88752" }}>
      <Cork />

      {scenes.map((scene, i) => {
        const appear = appearOf(i);
        if (frame < appear) return null;
        const reused = i + SLOTS < scenes.length ? msToFrames(scenes[i + SLOTS].startMs) + MOVE_FRAMES : Infinity;
        if (frame >= reused) return null;

        // Vé kỷ niệm (không ảnh) thấp hơn polaroid, nằm giữa vùng ảnh.
        const ticket = !scene.image;
        const w = board.hero.w;
        const h = ticket ? Math.min(board.hero.h * 0.8, w * 0.8) : board.hero.h;
        const rot = (i % 2 ? 1 : -1) * seeded(`sb-rot-${i}`, 1.2, 3.8);

        // Rơi xuống.
        const drop = interpolate(frame, [appear, appear + DROP_FRAMES], [0, 1], { ...clamp, easing: DROP });
        const lift = 1 - Math.min(1, drop);
        // Lùi ra mép khi cảnh sau bắt đầu.
        const next = i + 1 < scenes.length ? msToFrames(scenes[i + 1].startMs) : Infinity;
        const m = next === Infinity ? 0 : interpolate(frame, [next, next + MOVE_FRAMES], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1) });
        const base = board.slots[i % SLOTS];
        const slot = {
          x: base.x + seeded(`sb-sx-${i}`, -0.03, 0.03) * layout.width,
          y: base.y + seeded(`sb-sy-${i}`, -0.02, 0.02) * layout.height,
          rot: base.rot + seeded(`sb-srot-${i}`, -3, 3),
        };
        const dx = (slot.x - heroCx) * m;
        const dy = (slot.y - heroCy) * m - lift * 90 * unit;
        const scale = (1 + lift * 0.28) * (1 - (1 - board.oldScale) * m);
        const angle = rot + lift * 9 + (slot.rot - rot) * m;
        const dim = 1 - 0.2 * m;

        return (
          <div
            key={`memory-${i}`}
            style={{
              position: "absolute",
              left: heroCx - w / 2,
              top: heroCy - h / 2,
              width: w,
              height: h,
              transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
              opacity: interpolate(frame, [appear, appear + 4], [0, 1], clamp),
              // Bóng lớn và mờ khi còn đang nhấc lên, sát và rõ khi đã nằm trên bảng.
              filter: [
                `drop-shadow(0 ${((6 + lift * 40) * unit).toFixed(1)}px ${((8 + lift * 34) * unit).toFixed(1)}px rgba(35, 16, 0, ${(0.45 - lift * 0.15).toFixed(2)}))`,
                m > 0 ? `brightness(${dim.toFixed(3)}) saturate(${(1 - 0.25 * m).toFixed(3)})` : "",
              ].join(" "),
            }}
          >
            <Memory
              scene={scene}
              index={i}
              w={w}
              h={h}
              border={board.border}
              strip={board.strip}
              appear={appear}
              frame={frame}
              unit={unit}
              accent={accent}
              title={title}
            />
          </div>
        );
      })}

      {board.card ? (
        <NoteCard
          card={board.card}
          caption={caption}
          captionIndex={captionIndex}
          scene={active >= 0 ? scenes[active] : null}
          appear={cardAppear}
          frame={frame}
          unit={unit}
          ready={handReady}
        />
      ) : null}

      {showTitle && frame < COVER_OPEN_END ? (
        <AlbumCover
          title={title}
          subtitle={subtitle}
          accent={accent}
          firstScene={scenes[0] ?? null}
          frame={frame}
          layout={layout}
          ready={scriptReady}
        />
      ) : null}

      <Grain opacity={0.06} animated={false} baseFrequency={0.85} />
    </AbsoluteFill>
  );
};
