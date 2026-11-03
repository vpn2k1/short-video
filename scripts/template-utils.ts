import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Bóc tách sprite sheet thành các frame riêng lẻ.
 * VD: 4 cột × 3 hàng = 12 frame
 */
export async function extractSpriteSheet(
  sourcePath: string,
  cols: number,
  rows: number,
  outputDir: string
): Promise<void> {
  const image = sharp(sourcePath);
  const { width, height } = await image.metadata();

  if (!width || !height) throw new Error("Cannot read image dimensions");

  const frameWidth = Math.floor(width / cols);
  const frameHeight = Math.floor(height / rows);

  fs.mkdirSync(outputDir, { recursive: true });

  let frameNum = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * frameWidth;
      const top = row * frameHeight;

      await sharp(sourcePath)
        .extract({ left, top, width: frameWidth, height: frameHeight })
        .toFile(path.join(outputDir, `frame-${String(frameNum).padStart(3, "0")}.png`));

      frameNum++;
    }
  }

  console.log(`✓ Extracted ${frameNum} frames to ${outputDir}`);
}
