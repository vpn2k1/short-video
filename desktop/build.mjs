#!/usr/bin/env node
/**
 * Đóng gói app desktop. Chỉ cần Node — chạy được trên cả macOS và Windows.
 *
 *   node desktop/build.mjs mac | win | linux | all
 *
 * Đúng nền tảng của máy đang chạy → build trực tiếp, vì node_modules sẵn có đã đúng nền tảng.
 * Khác nền tảng → build chéo qua desktop/build-<os>.sh, cần bash + curl + unzip nên chỉ làm được
 * từ macOS/Linux. Trên Windows, `bash` là lối vào WSL (không có WSL thì báo lỗi ngay), vì vậy
 * `dist:all` ở Windows chỉ dựng bản Windows rồi nói rõ phần bỏ qua.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux";
const TARGETS = ["mac", "win", "linux"];

// Gọi thẳng file JS của từng CLI thay vì npx: trên Windows, Node không spawn được .cmd mà không qua shell.
const BIN = {
  remotion: "node_modules/@remotion/cli/remotion-cli.js",
  tsx: "node_modules/tsx/dist/cli.mjs",
  "electron-builder": "node_modules/electron-builder/cli.js",
};

// Khớp với build.mac / build.win / build.linux trong package.json.
const BUILDER_FLAGS = { mac: ["--mac", "--arm64"], win: ["--win", "--x64"], linux: ["--linux", "AppImage", "--x64"] };
const SETUP_PLATFORM = { mac: "mac-arm64", win: "win-x64", linux: "linux-x64" };

const exec = (label, cmd, args) => {
  console.log(`\n→ ${label}`);
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", windowsHide: true });
  if (result.error) throw new Error(`Không chạy được ${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} thoát mã ${result.status}`);
};

const node = (bin, args) => exec(`${bin} ${args.join(" ")}`, process.execPath, [path.join(ROOT, BIN[bin]), ...args]);

const buildNative = (target) => {
  node("remotion", ["browser", "ensure"]); // Chrome Headless Shell vào node_modules/.remotion (after-pack chép vào app)
  node("tsx", ["scripts/setup-local.ts", "--platform", SETUP_PLATFORM[target]]);
  node("electron-builder", BUILDER_FLAGS[target]);
};

const buildCross = (target) => exec(`bash desktop/build-${target}.sh`, "bash", [`desktop/build-${target}.sh`]);

/** Cách build được bản `target` trên máy này, hoặc lý do không build được. */
const plan = (target) => {
  if (target === HOST) return { mode: "native" };
  if (target === "mac") return { skip: "bản .dmg chỉ đóng gói được trên macOS" };
  if (HOST === "win") return { skip: `build chéo bản ${target} cần bash + curl + unzip — chạy trên macOS/Linux, hoặc trong WSL/Docker` };
  return { mode: "cross" };
};

const requested = process.argv[2];
if (!requested || ![...TARGETS, "all"].includes(requested)) {
  console.error(`Dùng: node desktop/build.mjs ${[...TARGETS, "all"].join(" | ")}`);
  process.exit(1);
}

const skipped = [];
try {
  for (const target of requested === "all" ? TARGETS : [requested]) {
    const step = plan(target);
    if (step.skip) {
      // Chọn đúng một nền tảng thì báo lỗi; "all" thì bỏ qua rồi liệt kê ở cuối.
      if (requested !== "all") throw new Error(`Không build được bản ${target} trên ${HOST}: ${step.skip}.`);
      skipped.push(`${target} — ${step.skip}`);
      continue;
    }
    console.log(`\n=== Bản ${target}: build ${step.mode === "native" ? "trực tiếp trên máy này" : `chéo từ ${HOST}`} ===`);
    (step.mode === "native" ? buildNative : buildCross)(target);
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}

if (skipped.length) console.log(`\nBỏ qua:\n${skipped.map((line) => `  • ${line}`).join("\n")}`);
