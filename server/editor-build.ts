/**
 * Đóng gói trình chỉnh sửa (React + @remotion/player + composition thật trong src/)
 * cho trình duyệt, ngay lúc chạy — không có bước build riêng.
 *
 * - JS: esbuild bundle server/editor/main.tsx.
 * - CSS: Tailwind v4 cho các class mà composition dùng (Captions, TitleCard…).
 *   Trang editor là trang riêng nên preflight của Tailwind không đụng giao diện chat.
 *
 * Kết quả giữ trong bộ nhớ; sửa file trong src/ hoặc server/editor/ thì lần tải sau
 * tự build lại.
 */
import fs from "fs";
import path from "path";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const root = () => process.cwd();
const WATCH_DIRS = ["src", "server/editor"];

/** js: trình chỉnh sửa; cropJs: riêng công cụ crop cho trang không dùng React (server/editor/crop-entry.tsx). */
type Assets = { js: string; cropJs: string; css: string; builtAt: number };
let cache: Assets | null = null;
let building: Promise<Assets> | null = null;

const newestMtime = () => {
  let newest = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  };
  for (const dir of WATCH_DIRS) walk(path.join(root(), dir));
  return newest;
};

const buildCss = async () => {
  const compiler = await compile('@import "tailwindcss";', {
    base: root(),
    onDependency: () => {},
  });
  const scanner = new Scanner({
    sources: WATCH_DIRS.map((dir) => ({ base: path.join(root(), dir), pattern: "**/*", negated: false })),
  });
  return compiler.build(scanner.scan());
};

const bundle = async (entry: string) => {
  const result = await build({
    entryPoints: [path.join(root(), entry)],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2020",
    jsx: "automatic",
    minify: true,
    legalComments: "none",
    // Composition không import CSS, nhưng phòng khi có: bỏ qua, CSS đã build riêng.
    loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
};

const buildAssets = async (): Promise<Assets> => {
  const startedAt = Date.now();
  const [js, cropJs, css] = await Promise.all([
    bundle("server/editor/main.tsx"),
    bundle("server/editor/crop-entry.tsx"),
    buildCss(),
  ]);
  cache = { js, cropJs, css, builtAt: startedAt };
  return cache;
};

export const getEditorAssets = async () => {
  if (cache && cache.builtAt >= newestMtime()) return cache;
  if (!building) {
    building = buildAssets().finally(() => {
      building = null;
    });
  }
  return building;
};
