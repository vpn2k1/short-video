/**
 * Kiểm tra bản đóng gói NGAY sau khi electron-builder chép file (desktop/after-pack.cjs gọi), trước khi tạo bộ cài.
 * Thiếu gì thì dựng thất bại với danh sách cụ thể — thay vì để người dùng gặp lỗi trên máy họ.
 *
 * Những lỗi này đã lọt ra bộ cài thật:
 *  - electron-builder tự bỏ thư mục `examples`/`test`… ở gốc mỗi gói trong node_modules, kể cả khi gói khai báo nó
 *    trong "exports" → webpack của Remotion không bundle được, mọi lượt render đều lỗi (three/examples/jsm/…).
 *  - Bước dọn Python xoá nhầm Lib/threading.py → mọi giọng VieNeu chết ngay khi khởi động.
 *
 * Việc làm:
 *  1. Chép lại các thư mục electron-builder bỏ mà gói vẫn khai trong "exports".
 *  2. Mọi import trong code của bản đóng gói phải trỏ tới file có thật — dò theo đúng cách nơi dùng nạp nó.
 *  3. Đủ file chạy: Chrome dựng video, ffmpeg, ffprobe, font, Python + model giọng đọc, llama-server + model, yt-dlp,
 *     và file nhị phân của esbuild / tailwind / lightningcss (trình chỉnh sửa đóng gói giao diện lúc chạy).
 *  4. Giọng đọc chạy được: cùng nền tảng thì đọc thử hẳn một câu bằng chính Python + worker + model trong bản đóng
 *     gói; dựng chéo thì đọc thử bằng Python của máy dựng, ghi lại mọi file thư viện chuẩn đã nạp, rồi đối chiếu với
 *     Python của bản sắp đóng gói.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { packageOf, runtimeImports } from "./check-deps.mjs";

/** Tên thư mục electron-builder bỏ ở gốc mỗi gói (app-builder-lib/out/util/NodeModuleCopyHelper.js). */
const DROPPED_DIRS = ["example", "examples", "test", "tests", "__tests__", "powered-test"];

/** Nền tảng của máy đang chạy, theo tên dùng trong vendor/ (scripts/setup-local.ts). */
export const HOST_PLATFORM = `${process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux"}-${process.arch}`;

const exists = (p) => fs.existsSync(p);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** Mọi gói trong node_modules (kể cả gói có scope @x/y) — chỉ cấp gốc, đủ cho các gói code import thẳng. */
const packagesIn = (nodeModules) => {
  const out = [];
  if (!exists(nodeModules)) return out;
  for (const name of fs.readdirSync(nodeModules)) {
    if (name.startsWith(".")) continue;
    if (name.startsWith("@")) {
      for (const sub of fs.readdirSync(path.join(nodeModules, name))) out.push(`${name}/${sub}`);
    } else {
      out.push(name);
    }
  }
  return out;
};

/** 1. Chép lại thư mục bị electron-builder bỏ mà "exports" của gói vẫn trỏ tới. */
const restoreDroppedDirs = (projectDir, appDir) => {
  const restored = [];
  const appModules = path.join(appDir, "node_modules");
  for (const name of packagesIn(appModules)) {
    const pkgFile = path.join(appModules, name, "package.json");
    if (!exists(pkgFile)) continue;
    const exportsText = JSON.stringify(readJson(pkgFile).exports ?? "");
    for (const dir of DROPPED_DIRS) {
      if (!exportsText.includes(`./${dir}/`) && !exportsText.includes(`"./${dir}"`)) continue;
      const target = path.join(appModules, name, dir);
      const source = path.join(projectDir, "node_modules", name, dir);
      if (exists(target) || !exists(source)) continue;
      fs.cpSync(source, target, { recursive: true });
      restored.push(`${name}/${dir}`);
    }
  }
  return restored;
};

/**
 * Điều kiện "exports" theo nơi dùng. server/ và scripts/ chạy bằng tsx dưới dạng CommonJS (package.json không có
 * "type": "module") nên Node chọn nhánh "require"; src/ (webpack của Remotion) và server/editor/ (esbuild, giao diện
 * trình duyệt) chọn nhánh import/browser. Như Node: duyệt khoá theo thứ tự trong package.json, lấy khoá đầu tiên có
 * trong tập điều kiện.
 */
const CONDITIONS = {
  node: new Set(["require", "node", "node-addons", "default"]),
  bundled: new Set(["browser", "import", "module", "webpack", "development", "production", "default"]),
};

/** Đích trong "exports" cho một tập điều kiện; null = không có nhánh khớp, EXCLUDED = gói chặn đường này. */
const EXCLUDED = Symbol("excluded");
const pickTarget = (value, conditions) => {
  if (value === null) return EXCLUDED;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = pickTarget(item, conditions);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value)) {
    if (conditions.has(key)) return pickTarget(item, conditions);
  }
  return null;
};

/** Như Node: khớp đúng khoá trước, rồi khoá có "*" với phần trước "*" dài nhất. */
const resolveExports = (exportsField, subpath, conditions) => {
  const map = typeof exportsField === "string" || Array.isArray(exportsField) || !Object.keys(exportsField).some((k) => k.startsWith("."))
    ? { ".": exportsField }
    : exportsField;
  if (Object.hasOwn(map, subpath)) return pickTarget(map[subpath], conditions);
  let best = null;
  for (const key of Object.keys(map)) {
    const star = key.indexOf("*");
    if (star < 0) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix) || subpath.length < prefix.length + suffix.length) continue;
    if (!best || prefix.length > best.prefix.length) best = { key, prefix, suffix };
  }
  if (!best) return null;
  const target = pickTarget(map[best.key], conditions);
  if (typeof target !== "string") return target;
  return target.split("*").join(subpath.slice(best.prefix.length, subpath.length - best.suffix.length));
};

const FILE_CANDIDATES = ["", ".js", ".mjs", ".cjs", ".json", "/index.js", "/index.mjs", "/index.cjs"];
const isFile = (base) => FILE_CANDIDATES.some((ext) => exists(base + ext) && fs.statSync(base + ext).isFile());

/** File được bundle (webpack/esbuild) — còn lại chạy bằng Node. */
const BUNDLED = [path.join("server", "editor") + path.sep, "src" + path.sep];
const kindsOf = (users) => {
  const bundled = users.some((file) => BUNDLED.some((dir) => file.startsWith(dir)));
  const node = users.some((file) => !BUNDLED.some((dir) => file.startsWith(dir)));
  return [...(node ? ["node"] : []), ...(bundled ? ["bundled"] : [])];
};

/** Lỗi khi dò một import trong bản đóng gói, null nếu tìm thấy file. `users`: các file import nó. */
const resolveProblem = (appDir, spec, users) => {
  const name = packageOf(spec);
  const dir = path.join(appDir, "node_modules", name);
  const pkgFile = path.join(dir, "package.json");
  if (!exists(pkgFile)) return `thiếu cả gói ${name}`;
  const pkg = readJson(pkgFile);
  const sub = spec.slice(name.length);
  for (const kind of kindsOf(users)) {
    const label = kind === "node" ? "Node dùng" : "bundle dùng";
    if (pkg.exports !== undefined) {
      const target = resolveExports(pkg.exports, `.${sub}`, CONDITIONS[kind]);
      // Không có nhánh khớp / bị chặn: chuyện của code (lỗi đó cũng xảy ra trên máy dev), không phải của bản đóng gói.
      if (typeof target !== "string") continue;
      if (!exists(path.join(dir, target))) return `${spec} → ${name}/${target.replace(/^\.\//, "")} (${label}) không có trong bản đóng gói`;
      continue;
    }
    if (sub) {
      if (!isFile(path.join(dir, sub))) return `${spec} → không thấy file trong bản đóng gói`;
      continue;
    }
    // Không có "exports": Node đọc "main"; webpack/esbuild thử "browser" → "module" → "main", trường nào trỏ tới file
    // không có thì thử trường sau. Cấu hình đóng gói cố ý bỏ bớt (vd. lucide bỏ bản esm — chỉ server dùng qua Node).
    const fields = kind === "node"
      ? [pkg.main ?? "index.js"]
      : [typeof pkg.browser === "string" ? pkg.browser : null, pkg.module, pkg.main ?? "index.js"].filter(Boolean);
    if (!fields.some((entry) => isFile(path.join(dir, entry)))) {
      return `${spec} → ${fields.map((f) => `${name}/${f}`).join(" / ")} (${label}) không có trong bản đóng gói`;
    }
  }
  return null;
};

/** 3. File chạy cần có cho từng nền tảng (đường dẫn trong thư mục app). */
const requiredFiles = (platform) => {
  const win = platform === "win-x64";
  const exe = (name) => (win ? `${name}.exe` : name);
  const chrome = { "mac-arm64": "mac-arm64", "win-x64": "win64", "linux-x64": "linux64" }[platform];
  const triple = { "mac-arm64": "darwin-arm64", "win-x64": "win32-x64-msvc", "linux-x64": "linux-x64-gnu" }[platform];
  const node = { "mac-arm64": "darwin-arm64", "win-x64": "win32-x64", "linux-x64": "linux-x64" }[platform];
  return {
    "Chrome dựng video": `node_modules/.remotion/chrome-headless-shell/${chrome}`,
    ffmpeg: `node_modules/ffmpeg-static/${exe("ffmpeg")}`,
    ffprobe: `node_modules/@remotion/compositor-${triple}/${exe("ffprobe")}`,
    "esbuild (đóng gói trình chỉnh sửa)": `node_modules/@esbuild/${node}/${win ? "esbuild.exe" : "bin/esbuild"}`,
    "tailwind oxide (CSS trình chỉnh sửa)": `node_modules/@tailwindcss/oxide-${triple}`,
    "lightningcss (CSS trình chỉnh sửa)": `node_modules/lightningcss-${triple}`,
    "font đóng gói (chữ tiếng Việt trong video)": "public/fonts/fonts.css",
    "Python giọng đọc": `vendor/vieneu/${platform}/python/${win ? "python.exe" : "bin/python3.11"}`,
    "thư viện giọng đọc": `vendor/vieneu/${platform}/site/vieneu`,
    "model giọng đọc": "vendor/models/vieneu-v3-turbo/onnx/vieneu_backbone_shared.data",
    "AI có sẵn (llama-server)": `vendor/llama/${platform}/${exe("llama-server")}`,
    "model AI có sẵn": "vendor/models/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    "yt-dlp": `vendor/yt-dlp/${platform}/${exe("yt-dlp")}`,
  };
};

/**
 * Chạy đúng scripts/vieneu-worker.py như app (cùng cờ, cùng stdin), đọc một câu ra WAV; lúc thoát ghi mọi file .py của
 * thư viện chuẩn đã nạp (kể cả nạp muộn lúc đọc, như zipfile khi mở model .npz) vào file `report`.
 */
const PY_RUNNER = `
import atexit, os, runpy, sys
worker, site, model, report = sys.argv[1:5]
def dump():
    import threading
    std = os.path.dirname(os.path.realpath(threading.__file__))
    out = set()
    for module in list(sys.modules.values()):
        f = getattr(module, "__file__", None)
        if f and f.endswith(".py"):
            rf = os.path.realpath(f)
            if rf.startswith(std + os.sep) and "site-packages" not in rf:
                out.add(os.path.relpath(rf, std).replace(os.sep, "/"))
    with open(report, "w", encoding="utf-8") as fh:
        fh.write("\\n".join(sorted(out)))
atexit.register(dump)
sys.argv = [worker, site, model]
runpy.run_path(worker, run_name="__main__")
`;

/** File thư viện chuẩn chỉ có trên nền tảng của máy dựng — bản của nền tảng khác không có là đúng. */
const HOST_ONLY_STDLIB = [/^_sysconfigdata_/, /^_osx_support\.py$/, /^_aix_support\.py$/];

const vendorPaths = (root, platform) => {
  const win = platform === "win-x64";
  const base = path.join(root, "vendor", "vieneu", platform);
  return {
    python: path.join(base, "python", ...(win ? ["python.exe"] : ["bin", "python3.11"])),
    stdlib: path.join(base, "python", ...(win ? ["Lib"] : ["lib", "python3.11"])),
    site: path.join(base, "site"),
    model: path.join(root, "vendor", "models", "vieneu-v3-turbo"),
    worker: path.join(root, "scripts", "vieneu-worker.py"),
  };
};

/** Đọc thử một câu; trả { files } (file thư viện chuẩn đã nạp) hoặc { error }. */
const speakOnce = (paths) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "avs-voice-"));
  try {
    const report = path.join(tmp, "stdlib.txt");
    const request = JSON.stringify({ items: [{ text: "Xin chào, đây là câu đọc thử.", out: path.join(tmp, "probe.wav") }] });
    const result = spawnSync(
      paths.python,
      ["-X", "utf8", "-I", "-B", "-c", PY_RUNNER, paths.worker, paths.site, paths.model, report],
      { input: Buffer.from(request, "utf8"), encoding: "utf8", timeout: 300_000, windowsHide: true },
    );
    if (result.error) return { error: result.error.message };
    if (result.status !== 0) {
      const lines = (result.stderr || "").trim().split("\n").map((l) => l.trim()).filter(Boolean);
      const tagged = [...lines].reverse().find((l) => l.startsWith("Error: "));
      return { error: tagged?.slice(7) ?? lines[lines.length - 1] ?? `thoát mã ${result.status}` };
    }
    if (!exists(path.join(tmp, "probe.wav"))) return { error: "không ra file âm thanh" };
    return { files: exists(report) ? fs.readFileSync(report, "utf8").split("\n").filter(Boolean) : [] };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

/** 4. Giọng đọc của bản đóng gói chạy được. */
const checkVoice = (appDir, platform, sourceRoots) => {
  if (platform === HOST_PLATFORM) {
    const run = speakOnce(vendorPaths(appDir, platform));
    return run.error ? [`Giọng đọc trong app không đọc được câu thử: ${run.error}`] : [];
  }
  // Dựng chéo: Python của nền tảng khác không chạy được ở đây — đọc thử bằng Python cùng phiên bản của máy dựng để
  // biết cần những file thư viện chuẩn nào, rồi đối chiếu với Python của bản sắp đóng gói.
  const host = sourceRoots.map((root) => vendorPaths(root, HOST_PLATFORM)).find((p) => exists(p.python) && exists(p.model));
  let needed;
  if (host) {
    const run = speakOnce(host);
    if (run.error) return [`Giọng đọc của máy dựng (${HOST_PLATFORM}) không chạy được để đối chiếu: ${run.error}`];
    needed = run.files.filter((rel) => !HOST_ONLY_STDLIB.some((re) => re.test(rel)));
  } else {
    console.warn(`  ⚠ Máy dựng chưa có giọng đọc (${HOST_PLATFORM}) — chỉ kiểm tra vài module chuẩn chính. Chạy npm run setup để kiểm tra đủ.`);
    needed = ["threading.py", "json/__init__.py", "wave.py", "queue.py", "zipfile.py", "concurrent/futures/__init__.py", "ctypes/__init__.py", "logging/__init__.py"];
  }
  const { stdlib } = vendorPaths(appDir, platform);
  const missing = needed.filter((rel) => !exists(path.join(stdlib, rel)));
  return missing.length
    ? [`Python giọng đọc (${platform}) thiếu thư viện chuẩn: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ` và ${missing.length - 8} file khác` : ""}`]
    : [];
};

/**
 * Chạy toàn bộ kiểm tra. `appDir`: thư mục app trong bản đóng gói (resources/app). `projectDir`: thư mục electron-builder
 * đóng gói từ đó (gốc dự án, hoặc release/<os>-stage khi dựng chéo). `sourceRoot`: gốc dự án thật — nơi có giọng đọc
 * của máy dựng để đối chiếu khi dựng chéo (thiếu thì thử thư mục cha của stage).
 */
export const verifyApp = ({ appDir, projectDir, platform, sourceRoot = projectDir }) => {
  const problems = [];

  const restored = restoreDroppedDirs(projectDir, appDir);
  if (restored.length) console.log(`  ↺ Chép lại thư mục electron-builder bỏ sót: ${restored.join(", ")}`);

  for (const [spec, users] of runtimeImports(appDir)) {
    const problem = resolveProblem(appDir, spec, users);
    if (problem) problems.push(`Import ${problem}`);
  }

  const missingFiles = Object.entries(requiredFiles(platform)).filter(([, rel]) => !exists(path.join(appDir, rel)));
  for (const [label, rel] of missingFiles) problems.push(`Thiếu ${label}: ${rel}`);

  const voiceParts = ["Python giọng đọc", "thư viện giọng đọc", "model giọng đọc"];
  if (!missingFiles.some(([label]) => voiceParts.includes(label))) {
    problems.push(...checkVoice(appDir, platform, [...new Set([sourceRoot, path.resolve(projectDir, "..", "..")])]));
  }
  return { restored, problems };
};
