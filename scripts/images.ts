import fs from "fs";
import path from "path";
import type { ShortProps } from "../src/compositions/Short/schema";

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

export const publicDir = () => path.resolve(process.cwd(), "public");

/**
 * Quy ước thư mục ảnh:
 *   public/images/<slug>/   ảnh riêng của video đó
 *   public/images/shared/   ảnh dùng chung nhiều video
 *   public/images/          ảnh để lẫn ở gốc (vẫn chạy, nhưng khó quản khi nhiều video)
 */
const listIn = (relDir: string) => {
  const abs = path.join(publicDir(), relDir);
  if (!fs.existsSync(abs)) {
    return [];
  }
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXT.test(entry.name))
    .map((entry) => path.posix.join(relDir, entry.name))
    .sort();
};

/** Ảnh mà video `slug` được phép dùng, theo thứ tự ưu tiên hiển thị. */
export const listImagesFor = (slug: string | undefined) => [
  ...(slug ? listIn(path.posix.join("images", slug)) : []),
  ...listIn("images/shared"),
  ...listIn("images"),
];

export const listAllImages = () => {
  const root = path.join(publicDir(), "images");
  if (!fs.existsSync(root)) {
    return [];
  }
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join("images", entry.name));
  return [...listIn("images"), ...dirs.flatMap(listIn)].sort();
};

/**
 * Ảnh/video nào đang được dùng ở đâu: các cảnh của phong cách và các video trên timeline.
 * Trả về cả những file không tìm thấy.
 */
export const imageUsage = (props: ShortProps) => {
  const exists = (file: string) => fs.existsSync(path.join(publicDir(), file));
  const scenes = props.scenes
    .map((scene, index) => ({
      scene: `cảnh ${index + 1}`,
      image: scene.image,
      exists: !scene.image ? true : exists(scene.image),
      startMs: scene.startMs,
      endMs: scene.endMs,
    }))
    .filter((row) => Boolean(row.image));
  const overlays = (props.overlays ?? []).map((o) => ({
    scene: `Video ${o.track + 1}`,
    image: o.src as string | null,
    exists: exists(o.src),
    startMs: o.startMs,
    endMs: o.endMs,
  }));
  return [...scenes, ...overlays];
};

/**
 * Ném lỗi nếu có ảnh được tham chiếu mà không có file. Gọi TRƯỚC khi bundle —
 * để tới lúc render thì Remotion retry vài giây rồi mới chết, chậm và khó đọc.
 */
export const assertImagesExist = (props: ShortProps) => {
  const missing = imageUsage(props).filter((row) => !row.exists);
  if (missing.length === 0) {
    return;
  }
  const lines = missing.map((row) => `  ${row.scene}: ${row.image}`);
  throw new Error(
    `Thiếu ${missing.length} ảnh (đường dẫn tính từ public/):\n${lines.join("\n")}\n` +
      `Ảnh đang có:\n${listAllImages().map((i) => `  ${i}`).join("\n") || "  (chưa có ảnh nào)"}`,
  );
};
