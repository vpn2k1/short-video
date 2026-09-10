import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
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
