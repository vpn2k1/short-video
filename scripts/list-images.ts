/**
 * Ảnh nào đang dùng cho video nào, cảnh nào.
 *
 *   npx tsx scripts/list-images.ts
 */
import fs from "fs";
import path from "path";
import { imageUsage, listAllImages } from "./images";
import { shortSchema } from "../src/compositions/Short/schema";

const videosDir = path.resolve(process.cwd(), "videos");

const slugs = fs.existsSync(videosDir)
  ? fs
      .readdirSync(videosDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((slug) => fs.existsSync(path.join(videosDir, slug, "props.json")))
      .sort()
  : [];

const used = new Set<string>();

for (const slug of slugs) {
  const props = shortSchema.parse(
    JSON.parse(fs.readFileSync(path.join(videosDir, slug, "props.json"), "utf8")),
  );
  const rows = imageUsage(props);

  console.log(`\n${slug}`);
  if (rows.length === 0) {
    console.log("  (không dùng ảnh — chỉ nền gradient)");
    continue;
  }
  for (const row of rows) {
    used.add(row.image as string);
    const time = `${(row.startMs / 1000).toFixed(1)}s–${(row.endMs / 1000).toFixed(1)}s`;
    console.log(
      `  ${row.scene.padEnd(9)} ${time.padEnd(14)} ${row.image}${row.exists ? "" : "   ← THIẾU FILE"}`,
    );
  }
}

const all = listAllImages();
const unused = all.filter((image) => !used.has(image));

console.log(`\n${all.length} ảnh trong public/images/, ${unused.length} chưa dùng:`);
for (const image of unused) {
  console.log(`  ${image}`);
}
console.log(
  "\nQuy ước:  public/images/<slug>/  ảnh riêng của video" +
    "\n          public/images/shared/  ảnh dùng chung\n",
);
