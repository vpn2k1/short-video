#!/usr/bin/env node
/**
 * Thư viện mà code chạy trong app import phải nằm ở `dependencies` của package.json.
 *
 *   node desktop/check-deps.mjs          lỗi thì thoát mã 1 (desktop/build.mjs gọi trước khi đóng gói)
 *   node desktop/check-deps.mjs --warn   chỉ cảnh báo (npm i gọi qua postinstall — không bao giờ làm hỏng npm i)
 *
 * Vì sao: bản đóng gói chỉ chép `dependencies` (bản Windows/Linux dựng chéo còn `npm ci --omit=dev`). Thư viện nằm ở
 * devDependencies, hoặc chưa khai mà chỉ "tình cờ có" trong node_modules vì gói khác kéo theo, vẫn chạy được trên máy
 * dev nhưng thiếu trên máy người dùng — lỗi "Cannot find module" chỉ lộ ra sau khi đã gửi bộ cài.
 *
 * Chỉ dùng module có sẵn của Node: chạy được lúc postinstall của lần clone đầu, và trong thư mục stage của bản dựng
 * chéo (node_modules ở đó là bản của nền tảng khác).
 */
import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Thư mục chứa code chạy trong app (desktop/main.cjs chép đúng các thư mục này vào thư mục làm việc). */
export const RUNTIME_DIRS = ["src", "server", "scripts"];
/** File code ở gốc dự án cũng được đóng gói và chạy. */
const RUNTIME_FILES = ["remotion.config.ts"];
/** Trong RUNTIME_DIRS nhưng không phải code Node/webpack: file tĩnh gửi thẳng cho trình duyệt. */
const SKIP_DIRS = [path.join("server", "public")];
const CODE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
/** Tên gói npm hợp lệ (có thể kèm đường dẫn con) — loại các chuỗi trông như import trong template string. */
const PACKAGE_SPEC = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(\/[\w.@\-/]*)?$/i;

/**
 * Bỏ chú thích, giữ nguyên chuỗi — đọc từng ký tự để "/*" trong một chuỗi ("image/*", glob) không bị hiểu là mở
 * chú thích. Nội dung template string được thay bằng khoảng trắng: chữ trong đó không phải import thật.
 */
const stripComments = (text) => {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] === "\n") out += "\n";
        i++;
      }
      i++;
    } else if (c === '"' || c === "'") {
      out += c;
      for (i++; i < text.length && text[i] !== c && text[i] !== "\n"; i++) {
        out += text[i];
        if (text[i] === "\\") out += text[++i] ?? "";
      }
      out += text[i] ?? "";
    } else if (c === "`") {
      out += " ";
      for (i++; i < text.length && text[i] !== "`"; i++) {
        if (text[i] === "\\") i++;
        out += text[i] === "\n" ? "\n" : " ";
      }
      out += " ";
    } else {
      out += c;
    }
  }
  return out;
};

/** Đoạn giữa từ khoá import/export và chữ "from": không vắt qua một câu import/export khác. */
const BETWEEN = String.raw`(?:(?!\n\s*(?:import|export)\b)[^;'"])*?`;
const FROM_RE = new RegExp(String.raw`(?:^|[\n;}])\s*(import|export)\s+(type\s+)?${BETWEEN}\sfrom\s*["']([^"'\n]+)["']`, "g");
const SIDE_EFFECT_RE = /(?:^|[\n;}])\s*import\s*["']([^"'\n]+)["']/g;
const DYNAMIC_RE = /(typeof\s+)?\b(?:import|require)\(\s*["']([^"'\n]+)["']\s*\)/g;

/** Các chuỗi import thật sự chạy lúc runtime trong một file — bỏ `import type` / `export type` / `typeof import()`. */
const importsIn = (text) => {
  const code = stripComments(text);
  const found = [];
  for (const m of code.matchAll(FROM_RE)) if (!m[2]) found.push(m[3]);
  for (const m of code.matchAll(SIDE_EFFECT_RE)) found.push(m[1]);
  for (const m of code.matchAll(DYNAMIC_RE)) {
    // `type X = import("pkg").Y` / `typeof import("pkg")` chỉ là kiểu — không chạy.
    const lineStart = code.lastIndexOf("\n", m.index) + 1;
    const line = code.slice(lineStart, m.index);
    if (!m[1] && !/^\s*(export\s+)?type\s/.test(line) && !/:\s*$/.test(line)) found.push(m[2]);
  }
  return found;
};

const isBare = (spec) => !spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("node:")
  && !builtinModules.includes(spec.split("/")[0]) && PACKAGE_SPEC.test(spec);

/** "@remotion/renderer/client" → "@remotion/renderer"; "three/examples/jsm/x.js" → "three". */
export const packageOf = (spec) => (spec.startsWith("@") ? spec.split("/").slice(0, 2) : spec.split("/").slice(0, 1)).join("/");

const walk = (root, dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || SKIP_DIRS.includes(path.relative(root, full))) continue;
      walk(root, full, out);
    } else if (entry.isFile() && CODE_EXT.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
};

/**
 * Mọi import ngoài (không tương đối, không phải module có sẵn của Node) trong code của `root`.
 * Trả về Map: chuỗi import → các file dùng nó (đường dẫn tương đối, dấu phân cách của hệ điều hành).
 */
export const runtimeImports = (root = ROOT) => {
  const result = new Map();
  const files = [
    ...RUNTIME_DIRS.map((dir) => path.join(root, dir)).filter((dir) => fs.existsSync(dir)).flatMap((dir) => walk(root, dir)),
    ...RUNTIME_FILES.map((file) => path.join(root, file)).filter((file) => fs.existsSync(file)),
  ];
  for (const file of files) {
    for (const spec of importsIn(fs.readFileSync(file, "utf8"))) {
      if (!isBare(spec)) continue;
      const users = result.get(spec) ?? [];
      users.push(path.relative(root, file));
      result.set(spec, users);
    }
  }
  return result;
};

/** Danh sách lỗi: thư viện import nhưng nằm ở devDependencies hoặc chưa khai. */
export const checkDeps = (root = ROOT) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const deps = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {})]);
  const dev = new Set(Object.keys(pkg.devDependencies ?? {}));
  const byPackage = new Map();
  for (const [spec, files] of runtimeImports(root)) {
    const name = packageOf(spec);
    if (deps.has(name)) continue;
    const users = byPackage.get(name) ?? new Set();
    files.forEach((f) => users.add(f));
    byPackage.set(name, users);
  }
  return [...byPackage].map(([name, users]) => {
    const where = [...users].slice(0, 3).join(", ") + (users.size > 3 ? ` và ${users.size - 3} file khác` : "");
    return dev.has(name)
      ? `${name} đang ở devDependencies nhưng code chạy trong app có dùng (${where}) — chuyển sang dependencies`
      : `${name} được dùng (${where}) nhưng chưa khai trong package.json — thêm vào dependencies`;
  });
};

/** Chạy trực tiếp (không phải bị import): so đường dẫn thật — gọi qua symlink/junction/ổ subst vẫn nhận ra. */
const isMain = () => {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isMain()) {
  const warnOnly = process.argv.includes("--warn");
  try {
    const problems = checkDeps();
    if (problems.length === 0) {
      console.log("✓ Thư viện code dùng đều nằm trong dependencies");
    } else {
      console.error(`${warnOnly ? "⚠" : "✗"} Bản đóng gói sẽ thiếu thư viện:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
      if (!warnOnly) process.exitCode = 1;
    }
  } catch (error) {
    // Lúc npm i chỉ cảnh báo — một file đọc lỗi không được làm hỏng cả npm i (và bỏ qua bước cài giọng đọc phía sau).
    console.error(`${warnOnly ? "⚠" : "✗"} Không kiểm tra được thư viện: ${error instanceof Error ? error.message : error}`);
    if (!warnOnly) process.exitCode = 1;
  }
}
