/**
 * Render lại MỌI video trong videos/ — dùng props.json đã có, không gọi API.
 *
 *   npx tsx scripts/render-all.ts
 *
 * Bundle được cache trong renderShort() nên N video chỉ bundle một lần.
 */
import fs from "fs";
import path from "path";
import { renderShort } from "./render";
import { shortSchema } from "../src/compositions/Short/schema";

const videosDir = path.resolve(process.cwd(), "videos");

const main = async () => {
  if (!fs.existsSync(videosDir)) {
    console.error("Chưa có thư mục videos/. Tạo video đầu tiên bằng prompt-to-video.");
    process.exit(1);
  }

  const slugs = fs
    .readdirSync(videosDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(videosDir, slug, "props.json")))
    .sort();

  if (slugs.length === 0) {
    console.error("Không thấy videos/*/props.json nào. Chạy prompt-to-video trước.");
    process.exit(1);
  }

  console.log(`Render ${slugs.length} video\n`);
  fs.mkdirSync(path.resolve(process.cwd(), "out"), { recursive: true });

  for (const slug of slugs) {
    const props = shortSchema.parse(
      JSON.parse(
        fs.readFileSync(path.join(videosDir, slug, "props.json"), "utf8"),
      ),
    );
    const output = path.resolve(process.cwd(), `out/${slug}.mp4`);
    const { durationInFrames } = await renderShort(props, output);
    console.log(`  ${slug}  →  out/${slug}.mp4  (${(durationInFrames / 30).toFixed(1)}s)\n`);
  }
};

main().catch((error) => {
  console.error(`\nLỗi: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
