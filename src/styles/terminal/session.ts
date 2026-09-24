/**
 * Dựng "phiên terminal" từ dữ liệu video: danh sách dòng theo thứ tự hiện, mỗi dòng biết frame bắt đầu.
 * Hàm thuần — tính một lần cho cả video, component chỉ việc lọc dòng đã tới giờ.
 *
 * Quy tắc xếp hàng giống terminal thật: dòng sau chỉ hiện khi dòng trước đã xong (lệnh gõ xong mới có output),
 * nên mốc thật = max(mốc mong muốn, lúc dòng trước xong). Câu bị dồn trễ thì gõ nhanh hơn để kịp lời đọc.
 */
import { TITLE_FRAMES, msToFrames } from "../../constants";
import type { Caption, Scene, SceneVisual } from "../../compositions/Short/schema";
import { activeIndexAt } from "../shared";
import { chars, slugify } from "./theme";
import { translateVideoText, type VideoLanguage } from "../../i18n/video";

export type Entry =
  /** Dòng lệnh gõ sau dấu nhắc — mỗi câu phụ đề là một lệnh. */
  | { kind: "cmd"; text: string; start: number; typeEnd: number; punch: string | null; scene: number }
  | { kind: "out"; text: string; start: number; scene: number; ok?: boolean }
  /** `# tag` — dòng chú thích mờ đầu cảnh; `// subtitle` ở màn mở đầu. */
  | { kind: "comment"; text: string; start: number; scene: number; mark: string }
  | { kind: "title"; text: string; start: number; scene: number }
  | { kind: "punch"; text: string; start: number; scene: number }
  | { kind: "visual"; visual: SceneVisual; start: number; scene: number };

type Draft = { entry: Entry; desired: number; order: number; seq: number; endFrame?: number };

/** Khoảng cách tối thiểu giữa hai dòng output liên tiếp. */
const STAGGER = 3;

/** Mốc cảnh bắt đầu hiện trên màn hình (cảnh đầu đợi màn mở đầu xong). */
export const sceneAppear = (scenes: Scene[], index: number, introEnd: number) => {
  return Math.max(msToFrames(scenes[index].startMs), introEnd);
};

export const buildSession = ({
  title,
  subtitle,
  captions,
  scenes,
  showTitle,
  language,
}: {
  title: string;
  subtitle: string;
  captions: Caption[];
  scenes: Scene[];
  showTitle: boolean;
  language?: VideoLanguage;
}) => {
  const drafts: Draft[] = [];
  let seq = 0;
  const push = (entry: Entry, desired: number, order: number, endFrame?: number) =>
    drafts.push({ entry, desired, order, seq: seq++, endFrame });

  // Màn mở đầu: gõ "npm run <slug>", vài dòng build, rồi tiêu đề chữ lớn và phụ đề dạng chú thích.
  const introEnd = showTitle ? TITLE_FRAMES : 0;
  if (showTitle) {
    const slug = slugify(title);
    push({ kind: "cmd", text: `npm run ${slug}`, start: 0, typeEnd: 0, punch: null, scene: -1 }, 6, 0, 26);
    push({ kind: "out", text: `> ${slug}@1.0.0 start`, start: 0, scene: -1 }, 6, 1);
    push({ kind: "out", text: translateVideoText(language, "✔ build xong · {n} cảnh", { n: scenes.length }), start: 0, scene: -1, ok: true }, 6, 1);
    if (title.trim()) push({ kind: "title", text: title.trim(), start: 0, scene: -1 }, 34, 2);
    if (subtitle.trim()) push({ kind: "comment", text: subtitle.trim(), start: 0, scene: -1, mark: "//" }, 46, 3);
  }

  const sceneOf = (ms: number) => (scenes.length ? Math.max(0, activeIndexAt(scenes, msToFrames(ms))) : -1);
  const firstCaptionOf = new Map<number, number>();
  captions.forEach((c, i) => {
    const s = sceneOf(c.startMs);
    if (!firstCaptionOf.has(s)) firstCaptionOf.set(s, i);
  });

  scenes.forEach((scene, i) => {
    const appear = sceneAppear(scenes, i, introEnd);
    if (scene.tag?.trim()) push({ kind: "comment", text: scene.tag.trim(), start: 0, scene: i, mark: "#" }, appear, 10);
    if (scene.visual) {
      const first = firstCaptionOf.get(i);
      // Số liệu hiện ngay sau câu đầu tiên của cảnh — lúc giọng đọc đang nói tới nó.
      const desired = first !== undefined ? Math.max(appear, msToFrames(captions[first].startMs)) + 1 : appear + 8;
      push({ kind: "visual", visual: scene.visual, start: 0, scene: i }, desired, 30);
    }
  });

  const punched = new Set<number>();
  captions.forEach((c) => {
    const s = sceneOf(c.startMs);
    const punch = s >= 0 && !punched.has(s) ? scenes[s].punch : null;
    const hit = punch && c.text.normalize("NFC").toLowerCase().includes(punch.text.normalize("NFC").toLowerCase());
    const start = Math.max(msToFrames(c.startMs), introEnd);
    push(
      { kind: "cmd", text: c.text, start: 0, typeEnd: 0, punch: hit && punch ? punch.text : null, scene: s },
      start,
      20,
      Math.max(start + 8, msToFrames(c.endMs)),
    );
    if (hit && punch) {
      punched.add(s);
      push({ kind: "punch", text: punch.text, start: 0, scene: s }, Math.max(msToFrames(punch.atMs), start + 1), 25);
    }
  });

  // Punch không khớp câu nào: vẫn hiện như output ở đúng atMs.
  scenes.forEach((scene, i) => {
    if (!scene.punch) return;
    if (!punched.has(i)) {
      push({ kind: "punch", text: scene.punch.text, start: 0, scene: i }, Math.max(msToFrames(scene.punch.atMs), sceneAppear(scenes, i, introEnd) + 1), 25);
    }
  });

  drafts.sort((a, b) => a.desired - b.desired || a.order - b.order || a.seq - b.seq);

  const entries: Entry[] = [];
  let ready = 0;
  for (const d of drafts) {
    const start = Math.max(d.desired, ready);
    if (d.entry.kind === "cmd") {
      const n = chars(d.entry.text).length;
      const end = d.endFrame ?? start + n;
      // Gõ tối đa 1 frame/ký tự, xong trong ~70% thời lượng câu; bị dồn trễ thì gõ nhanh hơn cho kịp.
      const room = Math.max(4, end - start - 4);
      const typeFrames = Math.max(4, Math.min(n, Math.max(8, (end - start) * 0.7), room));
      const typeEnd = Math.round(start + typeFrames);
      entries.push({ ...d.entry, start, typeEnd });
      ready = typeEnd + 2;
    } else {
      entries.push({ ...d.entry, start });
      ready = start + STAGGER;
    }
  }
  return { entries, introEnd };
};
