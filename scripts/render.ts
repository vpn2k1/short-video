import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import fs from "fs";
import path from "path";
import type { ShortProps } from "../src/compositions/Short/schema";
import { watermarkFromSettings } from "./watermark";

export const COMPOSITION_ID = "Short";

let cachedBundle: Promise<string> | null = null;
let cachedStamp = "";

/** Số file + mtime mới nhất trong public/ — đổi là bản chép trong bundle đã cũ. */
const publicStamp = () => {
  let count = 0;
  let latest = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        count++;
        latest = Math.max(latest, fs.statSync(abs).mtimeMs);
      }
    }
  };
  walk(path.resolve(process.cwd(), "public"));
  return `${count}:${latest}`;
};

/**
 * Bundling is the slow part — reuse it across renders in the same process.
 *
 * Mặc định bundle() CHÉP public/ tại thời điểm bundle. Server chạy lâu mà giọng đọc được
 * tạo lại với cùng tên (voices/<slug>/line-01.mp3) thì render vẫn phát bản chép cũ —
 * phụ đề đúng kịch bản mới nhưng tiếng là kịch bản trước. Nên symlink public/ vào bundle.
 * Windows không symlink được: bundle lại khi public/ có thay đổi.
 */
const getBundle = () => {
  const symlink = process.platform !== "win32";
  if (!symlink) {
    const stamp = publicStamp();
    if (stamp !== cachedStamp) cachedBundle = null;
    cachedStamp = stamp;
  }
  if (!cachedBundle) {
    cachedBundle = bundle({
      entryPoint: path.resolve(process.cwd(), "src/index.ts"),
      webpackOverride: enableTailwind,
      symlinkPublicDir: symlink,
      onProgress: (percent) => {
        if (percent === 100) {
          process.stdout.write("  bundle xong\n");
        }
      },
    });
  }
  return cachedBundle;
};

export const renderShort = async (
  props: ShortProps,
  outputLocation: string,
  /** "Short" | "LongVideo" | "Explainer". Mặc định Short. */
  compositionId: string = COMPOSITION_ID,
  /** Nhận phần trăm 0-100; server dùng để đẩy tiến độ về UI. */
  onProgressPercent?: (percent: number) => void,
) => {
  // Watermark theo Cài đặt lúc render, không theo props.json đã lưu.
  const inputProps: ShortProps = { ...props, watermark: watermarkFromSettings() };
  const serveUrl = await getBundle();

  // selectComposition chạy calculateMetadata với chính props này, nên độ dài
  // đến từ caption track đã sinh, không phải giá trị fallback.
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
  });

  let lastLogged = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 100);
      if (percent > lastLogged) {
        lastLogged = percent;
        onProgressPercent?.(percent);
      }
      if (percent >= lastLogged && percent % 20 === 0 && !onProgressPercent) {
        process.stdout.write(`  render ${percent}%\n`);
      }
    },
  });

  return { outputLocation, durationInFrames: composition.durationInFrames };
};

/**
 * Render MỘT cảnh thành file riêng.
 *
 * Cắt props xuống còn đúng cảnh đó và dời mốc thời gian về 0, thay vì render cả
 * video rồi cắt — làm vậy nhanh hơn nhiều và cho phép chạy song song nhiều cảnh.
 */
export const renderScene = async (
  inputProps: ShortProps,
  sceneIndex: number,
  kind: "video" | "image",
  outputLocation: string,
  onProgressPercent?: (percent: number) => void,
) => {
  const scene = inputProps.scenes[sceneIndex];
  if (!scene) {
    throw new Error(`Không có cảnh ${sceneIndex + 1}`);
  }

  const shift = scene.startMs;
  const captions = inputProps.captions
    .filter((c) => c.startMs >= scene.startMs && c.startMs < scene.endMs)
    .map((c) => ({ ...c, startMs: c.startMs - shift, endMs: c.endMs - shift }));

  const sceneProps: ShortProps = {
    ...inputProps,
    captions,
    scenes: [{
      ...scene,
      startMs: 0,
      endMs: scene.endMs - shift,
      punch: scene.punch ? { ...scene.punch, atMs: Math.max(0, scene.punch.atMs - shift) } : null,
    }],
    // Âm thanh thêm tay giao với cảnh: dời về mốc 0, phần trước cảnh thì cắt đầu.
    audioClips: (inputProps.audioClips ?? [])
      .filter((clip) => clip.startMs < scene.endMs && clip.startMs + clip.durationMs > scene.startMs)
      .map((clip) => {
        const cut = Math.max(0, scene.startMs - clip.startMs);
        return {
          ...clip,
          startMs: Math.max(0, clip.startMs - shift),
          trimStartMs: clip.trimStartMs + cut,
          durationMs: clip.durationMs - cut,
        };
      }),
    // Chữ tự do giao với cảnh: dời về mốc 0 như phụ đề.
    texts: (inputProps.texts ?? [])
      .filter((t) => t.startMs < scene.endMs && t.endMs > scene.startMs)
      .map((t) => ({ ...t, startMs: Math.max(0, t.startMs - shift), endMs: t.endMs - shift })),
    // Title card thuộc về đầu video, không lặp lại ở từng cảnh.
    showTitle: false,
    // Voiceover là một track cho cả video — cắt theo cảnh sẽ lệch, nên bỏ.
    voiceoverTrack: null,
    watermark: watermarkFromSettings(),
  };

  const serveUrl = await getBundle();
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps: sceneProps,
  });

  if (kind === "image") {
    await renderStill({
      composition,
      serveUrl,
      output: outputLocation,
      inputProps: sceneProps,
      // Giữa cảnh: qua phần spring-in, chữ đã hiện đủ.
      frame: Math.floor(composition.durationInFrames / 2),
    });
    return { outputLocation, durationInFrames: 1 };
  }

  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps: sceneProps,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 100);
      if (percent > last) {
        last = percent;
        onProgressPercent?.(percent);
      }
    },
  });

  return { outputLocation, durationInFrames: composition.durationInFrames };
};
