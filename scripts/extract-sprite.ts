/**
 * CLI: Bóc tách sprite sheet thành các frame riêng lẻ.
 * Dùng: npm run extract-sprite -- --input="sprite.png" --cols=4 --rows=3 --output="extracted/"
 */

import { extractSpriteSheet } from "./template-utils";

const args = process.argv.slice(2).reduce((acc: Record<string, string>, arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=");
  acc[key] = value;
  return acc;
}, {});

const inputPath = args.input;
const cols = parseInt(args.cols || "4");
const rows = parseInt(args.rows || "3");
const outputDir = args.output || "extracted-frames";

if (!inputPath) {
  console.log("Usage: npm run extract-sprite -- --input=sprite.png --cols=4 --rows=3 --output=frames/");
  console.log("\nExample:");
  console.log("npm run extract-sprite -- --input=public/templates/characters/stick-frames.png --cols=4 --rows=3 --output=public/templates/characters/stick-frames-extracted/");
  process.exit(1);
}

extractSpriteSheet(inputPath, cols, rows, outputDir).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
