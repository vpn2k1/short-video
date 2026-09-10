/**
 * Lấy ảnh nền cho từng cảnh của một video.
 *
 *   npx tsx scripts/fetch-images.ts --name <slug> "truy vấn cảnh 1" "truy vấn cảnh 2"
 *   npx tsx scripts/fetch-images.ts --name x --source gemini "mô tả cảnh"
 *
 * Thứ tự ưu tiên mặc định: pexels → gemini. Canva không tự động được vì nó là
 * MCP tool, Claude gọi trực tiếp trong hội thoại (xem skill image-generation).
 */
import fs from "fs";
import path from "path";
import { generateImage } from "./gemini-image";
import { downloadPhoto, searchPhotos, writeCredits } from "./pexels";
import { slugify } from "./slug";

export type ImageSource = "pexels" | "gemini";

try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // .env không bắt buộc
}

const args = process.argv.slice(2);
const queries: string[] = [];
let name: string | undefined;
let sources: ImageSource[] = ["pexels", "gemini"];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name") {
    name = slugify(args[++i] ?? "");
  } else if (args[i] === "--source") {
    const value = args[++i];
    const parsed = (value ?? "").split(",").filter(Boolean) as ImageSource[];
    const bad = parsed.filter((s) => s !== "pexels" && s !== "gemini");
    if (parsed.length === 0 || bad.length > 0) {
      console.error("--source chỉ nhận: pexels | gemini (ngăn cách bằng dấu phẩy)");
      process.exit(1);
    }
    sources = parsed;
  } else if (args[i].startsWith("--")) {
    console.error(`Không hiểu flag: ${args[i]}`);
    process.exit(1);
  } else {
    queries.push(args[i]);
  }
}

if (!name || queries.length === 0) {
  console.error(
    'Cần --name và ít nhất một truy vấn.\n' +
      '  npx tsx scripts/fetch-images.ts --name pin-iphone "phone charging at night"',
  );
  process.exit(1);
}

const outDir = path.resolve(process.cwd(), "public/images", name);

/** Thử lần lượt theo thứ tự ưu tiên, nguồn nào ra ảnh trước thì dùng. */
const fetchOne = async (query: string, index: number) => {
  const base = `${String(index + 1).padStart(2, "0")}-${slugify(query, 32)}`;
  const errors: string[] = [];

  for (const source of sources) {
    try {
      if (source === "pexels") {
        const photos = await searchPhotos(query, 5);
        if (photos.length === 0) {
          errors.push("pexels: không có kết quả");
          continue;
        }
        const result = await downloadPhoto(
          photos[0],
          path.join(outDir, `${base}.jpg`),
        );
        return { source, ...result };
      }

      const result = await generateImage(
        `${query}. Vertical 9:16 background image for a short-form video. ` +
          "No text, no words, no letters, no logos. " +
          "Keep the lower half darker and free of detail so white subtitle text stays readable.",
        path.join(outDir, `${base}.png`),
      );
      return { source, ...result, credit: undefined };
    } catch (error) {
      errors.push(
        `${source}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(`Không lấy được ảnh cho "${query}"\n  ${errors.join("\n  ")}`);
};

const main = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\nƯu tiên nguồn: ${sources.join(" → ")}\n`);

  const credits: string[] = [];
  for (let i = 0; i < queries.length; i++) {
    const result = await fetchOne(queries[i], i);
    const rel = path.relative(path.resolve(process.cwd(), "public"), result.file);
    console.log(`  [${result.source}] ${rel}`);
    if ("credit" in result && result.credit) {
      credits.push(result.credit);
      console.log(`            ${result.credit}`);
    }
  }

  const file = writeCredits(outDir, credits);
  if (file) {
    console.log(`\nGhi công: ${path.relative(process.cwd(), file)}`);
  }
  console.log(`\nDùng trong script.json:  "image": "images/${name}/<tên file>"\n`);
};

main().catch((error) => {
  console.error(`\nLỗi: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
