/**
 * Ảnh + clip xem trước cho khung chọn phong cách: dựng đúng lời mẫu (`exampleScript` trong meta.ts) của từng
 * phong cách, gắn ảnh kho miễn phí hợp nội dung, rồi render một khung tĩnh (lúc câu nhấn bật lên) và một clip
 * 4 giây quanh khung đó. File ra ở server/public/style-previews/<id>.jpg|.mp4 — đóng gói cùng app.
 *
 *   npx tsx scripts/style-previews.ts            # mọi phong cách
 *   npx tsx scripts/style-previews.ts neon quiz  # vài phong cách
 *
 * Cần key Pexels/Pixabay (ảnh) và một AI viết lời (từ khoá tìm ảnh) trong Cài đặt. Sửa lời mẫu hay giao diện
 * một phong cách thì chạy lại cho phong cách đó.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import fs from "fs";
import path from "path";
import { STYLE_IDS, STYLES, isStyleId, type StyleId } from "../src/styles/meta";
import { scriptToProps } from "../src/compositions/Short/script";
import { TITLE_FRAMES, msToFrames } from "../src/constants";
import { textToScript } from "./text-script";
import { writeStockQueries } from "./image-prompts";
import { stockForScene } from "./stock";
import { loadKeys } from "../server/keys";

const OUT_DIR = path.join(process.cwd(), "server", "public", "style-previews");
/** Chiều dài clip xem trước (frame, 30fps) và phần trước khung chính. */
const CLIP_FRAMES = 120;
const CLIP_LEAD = 75;
/** Phong cách không vẽ ảnh của cảnh — khỏi tải ảnh kho. */
const NO_IMAGES = new Set<StyleId>(["kinetic"]);

const withImages = async (id: StyleId) => {
  const { script } = textToScript(STYLES[id].exampleScript, { style: id });
  if (NO_IMAGES.has(id)) return script;
  const indexes = script.scenes.map((_, i) => i);
  let plans: ({ queries: string[]; keywords: string[] } | string)[];
  try {
    plans = (await writeStockQueries({ title: script.title, subtitle: script.subtitle, scenes: script.scenes }, indexes, { provider: "auto" })).plans;
  } catch (error) {
    console.warn(`  ${id}: AI không viết được từ khoá (${error instanceof Error ? error.message : error}) — tìm theo tiêu đề`);
    plans = indexes.map(() => script.title);
  }
  const used = new Set<string>();
  for (const [i, scene] of script.scenes.entries()) {
    const found = await stockForScene("image", plans[i] ?? script.title, 5, used).catch(() => null);
    scene.image = found?.found ? found.path : null;
  }
  return script;
};

/** Khung "đặc trưng": lúc câu nhấn đầu tiên vừa bật lên; không có thì giữa cảnh thứ hai. */
const heroFrame = (props: ReturnType<typeof scriptToProps>, total: number) => {
  const punched = props.scenes.find((s) => s.punch);
  const target = punched?.punch
    ? msToFrames(punched.punch.atMs) + 20
    : (() => {
        const s = props.scenes[Math.min(1, props.scenes.length - 1)];
        return msToFrames((s.startMs + s.endMs) / 2);
      })();
  return Math.max(TITLE_FRAMES + 10, Math.min(total - 1, target));
};

const main = async () => {
  loadKeys();
  const wanted = process.argv.slice(2);
  const ids = wanted.length ? wanted.filter(isStyleId) : [...STYLE_IDS];
  if (wanted.length && ids.length !== wanted.length) throw new Error(`Không biết phong cách: ${wanted.filter((w) => !isStyleId(w)).join(", ")}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Đang đóng gói Remotion…");
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: enableTailwind, symlinkPublicDir: process.platform !== "win32" });

  for (const id of ids) {
    console.log(`${STYLES[id].emoji} ${STYLES[id].label} (${id})`);
    const script = await withImages(id);
    const inputProps = scriptToProps(script, { startAtFrame: TITLE_FRAMES, aspect: "9:16", style: id });
    const composition = await selectComposition({ serveUrl, id: "Short", inputProps });
    const frame = heroFrame(inputProps, composition.durationInFrames);

    await renderStill({
      composition, serveUrl, inputProps, frame,
      output: path.join(OUT_DIR, `${id}.jpg`),
      imageFormat: "jpeg", jpegQuality: 82, scale: 1 / 3,
    });
    const start = Math.max(0, frame - CLIP_LEAD);
    const end = Math.min(composition.durationInFrames - 1, start + CLIP_FRAMES - 1);
    await renderMedia({
      composition, serveUrl, inputProps,
      codec: "h264", crf: 30, muted: true, scale: 0.25,
      frameRange: [start, end],
      outputLocation: path.join(OUT_DIR, `${id}.mp4`),
    });
    const kb = (f: string) => Math.round(fs.statSync(path.join(OUT_DIR, f)).size / 1024);
    console.log(`  khung ${frame} · ${id}.jpg ${kb(`${id}.jpg`)} KB · ${id}.mp4 ${kb(`${id}.mp4`)} KB`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
