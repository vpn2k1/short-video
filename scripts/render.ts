import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import path from "path";
import type { ShortProps } from "../src/compositions/Short/schema";

export const COMPOSITION_ID = "Short";

let cachedBundle: Promise<string> | null = null;

/** Bundling is the slow part — reuse it across renders in the same process. */
const getBundle = () => {
  if (!cachedBundle) {
    cachedBundle = bundle({
      entryPoint: path.resolve(process.cwd(), "src/index.ts"),
      webpackOverride: enableTailwind,
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
  inputProps: ShortProps,
  outputLocation: string,
  /** "Short" | "LongVideo" | "Explainer". Mặc định Short. */
  compositionId: string = COMPOSITION_ID,
  /** Nhận phần trăm 0-100; server dùng để đẩy tiến độ về UI. */
  onProgressPercent?: (percent: number) => void,
) => {
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
    scenes: [{ ...scene, startMs: 0, endMs: scene.endMs - shift }],
    // Title card thuộc về đầu video, không lặp lại ở từng cảnh.
    showTitle: false,
    // Voiceover là một track cho cả video — cắt theo cảnh sẽ lệch, nên bỏ.
    voiceoverTrack: null,
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
