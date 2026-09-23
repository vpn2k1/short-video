/**
 * Cài phần chạy offline cho app: giọng đọc VieNeu, AI có sẵn (llama-server + Qwen), yt-dlp.
 * Chỉ cần Node — không cần bash, curl hay python, nên chạy được cả trên Windows.
 *
 *   npm run setup                         cài phần còn thiếu cho máy này (npm i tự gọi qua postinstall)
 *   npm run setup -- --only voice         chỉ một phần: voice | ai | yt-dlp (nhiều phần: voice,ai)
 *   npm run setup -- --force              cài lại dù đã có
 *   npx tsx scripts/setup-local.ts --platform win-x64 --dest release/win-stage --force   (desktop/build-*.sh)
 *
 * Kết quả:  <đích>/vendor/llama/<nền tảng>/llama-server[.exe] + thư viện đi kèm
 *           <đích>/vendor/models/qwen2.5-1.5b-instruct-q4_k_m.gguf
 *           <đích>/vendor/vieneu/<nền tảng>/python/   Python 3.11 độc lập (python-build-standalone), đã bỏ phần thừa
 *           <đích>/vendor/vieneu/<nền tảng>/site/     vieneu + onnxruntime + numpy + sea-g2p + tokenizers, đã bỏ phần thừa
 *           <đích>/vendor/models/vieneu-v3-turbo/     model ONNX — chỉ phần đọc giọng có sẵn
 *           <đích>/vendor/yt-dlp/<nền tảng>/yt-dlp[.exe]
 * File tải về nằm trong release/cache (kiểm SHA-256), model GGUF trong ./vendor/models — cài lại không tải lại.
 *
 * Bỏ qua bước tự cài lúc npm i: đặt SKIP_LOCAL_SETUP=1 (máy CI cũng tự bỏ qua).
 */
import { spawnSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "release", "cache");

const PLATFORMS = ["mac-arm64", "win-x64", "linux-x64"] as const;
type Platform = (typeof PLATFORMS)[number];
const PARTS = ["voice", "ai", "yt-dlp"] as const;
type Part = (typeof PARTS)[number];

const HOST = `${process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux"}-${process.arch}`;

// ---------- tiện ích ----------

const log = (line: string) => console.log(line);

const run = (cmd: string, args: string[], cwd?: string) => {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", windowsHide: true });
  if (result.error) throw new Error(`Không chạy được ${cmd}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} thoát mã ${result.status}`);
};

const works = (cmd: string, args: string[]) => {
  const result = spawnSync(cmd, args, { stdio: "ignore", windowsHide: true });
  return !result.error && result.status === 0;
};

const rm = (...paths: string[]) => {
  for (const p of paths) fs.rmSync(p, { recursive: true, force: true });
};

const sha256 = async (file: string) => {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
};

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(0)} MB`;

/** Tải về file (nếu chưa có). File .part dở dang lần trước được tải tiếp chứ không tải lại từ đầu. */
const download = async (url: string, file: string) => {
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  for (let attempt = 1; ; attempt++) {
    try {
      const have = fs.existsSync(part) ? fs.statSync(part).size : 0;
      const response = await fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {} });
      if (response.status === 416) break; // .part đã đủ
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const resumed = response.status === 206;
      const total = Number(response.headers.get("content-length") ?? 0) + (resumed ? have : 0);
      let done = resumed ? have : 0;
      let shown = -1;
      const body = Readable.fromWeb(response.body as import("stream/web").ReadableStream);
      body.on("data", (chunk: Buffer) => {
        done += chunk.length;
        const percent = total ? Math.floor((done / total) * 10) * 10 : -1;
        if (percent > shown) {
          shown = percent;
          if (total) process.stdout.write(`     ${path.basename(file)}: ${percent}% / ${mb(total)}\n`);
        }
      });
      await pipeline(body, fs.createWriteStream(part, { flags: resumed ? "a" : "w" }));
      break;
    } catch (error) {
      if (attempt >= 3) throw new Error(`Tải ${url} thất bại: ${(error as Error).message}`);
      log(`     lỗi mạng (${(error as Error).message}) — thử lại…`);
    }
  }
  fs.renameSync(part, file);
};

/** Tải + kiểm SHA-256. File hỏng thì xoá để lần sau tải lại. */
const fetchChecked = async (url: string, file: string, sha: string) => {
  await download(url, file);
  if ((await sha256(file)) !== sha) {
    rm(file);
    throw new Error(`${file} bị hỏng (SHA-256 không khớp) — đã xoá, chạy lại để tải lại.`);
  }
};

/** Giải nén .tar.gz / .zip. Windows 10+ có sẵn tar.exe (bsdtar, đọc được cả zip) — gọi thẳng, tránh tar của Git Bash. */
const extract = (archive: string, dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
  if (process.platform === "win32") {
    run(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe"), ["-xf", archive, "-C", dir]);
  } else if (archive.endsWith(".zip") || archive.endsWith(".whl")) {
    run("unzip", ["-q", "-o", archive, "-d", dir]);
  } else {
    run("tar", ["-xzf", archive, "-C", dir]);
  }
};

/** Chép file — ổ APFS/Btrfs thì là bản sao không tốn thêm dung lượng. */
const copyFile = (from: string, to: string) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to, fs.constants.COPYFILE_FICLONE);
};

const copyDir = (from: string, to: string) => {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else copyFile(src, dst);
  }
};

const walk = (dir: string, visit: (full: string, entry: fs.Dirent) => boolean | void) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    // visit trả về true = đã xử lý (xoá) thư mục này, không đi vào trong.
    if (visit(full, entry) === true) continue;
    if (entry.isDirectory() && !entry.isSymbolicLink() && fs.existsSync(full)) walk(full, visit);
  }
};

/** Mẫu tên kiểu shell, chỉ hỗ trợ `*`. So khớp phân biệt hoa thường — không phụ thuộc ổ đĩa có phân biệt hay không. */
const glob = (pattern: string) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

/** Xoá các mục trong dir khớp một trong các mẫu (mẫu có thể có thư mục con: "lib/tcl*"). */
const rmMatching = (dir: string, patterns: string[]) => {
  for (const pattern of patterns) {
    const parent = path.join(dir, path.dirname(pattern));
    // Đọc thư mục theo đúng tên (ổ macOS/Windows không phân biệt hoa thường: "lib" mở được cả "Lib").
    const parentName = path.basename(parent);
    if (!fs.existsSync(parent) || !fs.readdirSync(path.dirname(parent)).includes(parentName)) continue;
    const re = glob(path.basename(pattern));
    for (const name of fs.readdirSync(parent)) if (re.test(name)) rm(path.join(parent, name));
  }
};

// ---------- AI có sẵn: llama-server + Qwen ----------

// Ghim phiên bản — đổi bản llama.cpp thì chạy thử lại phần AI trên máy trước khi phát hành.
const LLAMA_BUILD = "b10995";
const QWEN_FILE = "qwen2.5-1.5b-instruct-q4_k_m.gguf";
const QWEN_URL = `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/${QWEN_FILE}`;
const QWEN_SHA256 = "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e";

const LLAMA_ASSETS: Record<Platform, string> = {
  "mac-arm64": `llama-${LLAMA_BUILD}-bin-macos-arm64.tar.gz`,
  // Bản Vulkan chạy được cả GPU AMD/Intel/NVIDIA; máy không có Vulkan thì tự lùi về CPU.
  "win-x64": `llama-${LLAMA_BUILD}-bin-win-vulkan-x64.zip`,
  "linux-x64": `llama-${LLAMA_BUILD}-bin-ubuntu-vulkan-x64.tar.gz`,
};
/** Chỉ giữ llama-server và thư viện nó cần — bỏ ~20 công cụ dòng lệnh khác. */
const LLAMA_KEEP = [
  "LICENSE*", "llama-server", "llama-server.exe", "*llama-server-impl.*", "libggml*", "ggml*.dll", "libllama.*",
  "llama.dll", "libllama-common*", "llama-common.dll", "libmtmd*", "mtmd.dll", "libomp.dll",
].map(glob);

const llamaServer = (dest: string, platform: Platform) =>
  path.join(dest, "vendor", "llama", platform, platform === "win-x64" ? "llama-server.exe" : "llama-server");

const aiInstalled = (dest: string, platform: Platform) =>
  fs.existsSync(llamaServer(dest, platform)) && fs.existsSync(path.join(dest, "vendor", "models", QWEN_FILE));

const installAi = async (dest: string, platform: Platform) => {
  log(`→ llama.cpp ${LLAMA_BUILD} (${platform})`);
  const asset = LLAMA_ASSETS[platform];
  await download(`https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_BUILD}/${asset}`, path.join(CACHE, asset));

  const unpack = fs.mkdtempSync(path.join(os.tmpdir(), "llama-"));
  try {
    extract(path.join(CACHE, asset), unpack);
    // Bản tar.gz có thư mục gốc, bản zip thì không — tìm thư mục chứa llama-server.
    let source = "";
    walk(unpack, (full, entry) => {
      if (!source && /^llama-server(\.exe)?$/.test(entry.name)) source = path.dirname(full);
    });
    if (!source) throw new Error(`Không thấy llama-server trong ${asset}`);

    const out = path.dirname(llamaServer(dest, platform));
    rm(out);
    fs.mkdirSync(out, { recursive: true });
    for (const name of fs.readdirSync(source)) {
      if (!LLAMA_KEEP.some((re) => re.test(name))) continue;
      const from = path.join(source, name);
      if (fs.lstatSync(from).isSymbolicLink()) {
        // Thư viện được nạp theo soname (macOS: libX.0.dylib, Linux: libX.so.0) — giữ file thật dưới đúng tên soname.
        // Bỏ symlink: electron-builder chép chuỗi symlink song song và hỏng ("ENOENT ensureSymlink").
        if (/\.\d\.dylib$|\.so\.\d$/.test(name)) copyFile(fs.realpathSync(from), path.join(out, name));
      } else if (!/\.\d\.\d+\.\d+\.dylib$|\.so\.\d\.\d+\.\d+$/.test(name)) {
        // Bản đầy đủ phiên bản (libX.0.24.0.dylib) không ai trỏ tới sau khi đã chép dưới tên soname.
        copyFile(from, path.join(out, name));
      }
    }
    if (platform !== "win-x64") fs.chmodSync(llamaServer(dest, platform), 0o755);
  } finally {
    rm(unpack);
  }

  log(`→ Model ${QWEN_FILE} (~1,1 GB)`);
  const model = path.join(ROOT, "vendor", "models", QWEN_FILE);
  await fetchChecked(QWEN_URL, model, QWEN_SHA256);
  const target = path.join(dest, "vendor", "models", QWEN_FILE);
  if (path.resolve(target) !== model) copyFile(model, target);
};

// ---------- Giọng đọc VieNeu-TTS v3 Turbo ----------
//
// Gói Python `vieneu` kéo theo gradio, librosa, huggingface_hub (~780 MB) — ở đây chỉ cài đúng thư viện mà
// đường đọc ONNX/CPU dùng tới, scripts/vieneu-worker.py thay huggingface_hub bằng module rỗng.
// Bỏ phần nhái giọng (speaker_encoder, codec encoder) và khử nhiễu — app chỉ dùng giọng có sẵn.
//
// Model theo nền tảng (đo 2026-09-17, whisper nghe lại 5 câu mẫu):
//   mac-arm64 → int8 (~200 MB): đúng 100% chữ, không méo, nhanh hơn fp32 (RTF 0,23 so với 0,35).
//   win/linux → fp32 (~500 MB): tác giả VieNeu cảnh báo int8 méo tiếng trên CPU x86 không có VNNI (Intel/AMD đời cũ),
//               chưa thử được trên máy như vậy nên giữ fp32.

// Ghim phiên bản — đổi bản vieneu hoặc model thì chạy thử đọc giọng trên máy trước khi phát hành.
const PY_BUILD = "20260901";
const PY_VERSION = "3.11.16";
const PY_PACKAGES = [
  "vieneu==3.8.1", "sea-g2p==0.9.1", "onnxruntime==1.30.0", "numpy==2.4.6", "tokenizers==0.23.2",
  "packaging==26.3", "typing-extensions==4.16.0",
];
const TURBO_REPO = "pnnbao-ump/VieNeu-TTS-v3-Turbo";
const TURBO_REV = "5f2a3e93092efaba9153253ff5f2e6a8e810e4f2";
const CODEC_REPO = "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX";
const CODEC_REV = "ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae";
const VOICE_MODEL = "vieneu-v3-turbo";
const MSVC_VERSION = "14.44.35112";
const MSVC_SHA256 = "aba7fbe71897d25ed53fbb7f391e9f50289378a8a9ae218ba18530c663448391";

const PYTHON: Record<Platform, { triple: string; sha: string; pip: string[]; exe: string; precision: "int8" | "fp32" }> = {
  "mac-arm64": {
    triple: "aarch64-apple-darwin",
    sha: "768f05cf200273bbdda9a5955a5a6892a4b22f2a0b1e4b0a9160f5c7fce86816",
    // macosx_14 trước: wheel numpy/onnxruntime bản đó dùng Accelerate của Apple — bản macosx_11 chậm gấp đôi (đã đo).
    pip: ["macosx_14_0_arm64", "macosx_13_0_arm64", "macosx_11_0_arm64"],
    exe: "python/bin/python3.11",
    precision: "int8",
  },
  "win-x64": {
    triple: "x86_64-pc-windows-msvc",
    sha: "06cbe479e039f5b9cb5640c286d790074d63f549f92a32d599a3748293bd4510",
    pip: ["win_amd64"],
    exe: "python/python.exe",
    precision: "fp32",
  },
  "linux-x64": {
    triple: "x86_64-unknown-linux-gnu",
    sha: "64427febea27864d136db46c8efe968eb6fa5ca2813ce1dca4bb95aec31cb2e4",
    pip: ["manylinux_2_28_x86_64", "manylinux_2_27_x86_64", "manylinux_2_17_x86_64", "manylinux2014_x86_64"],
    exe: "python/bin/python3.11",
    precision: "fp32",
  },
};

const ONNX_SUMS = {
  int8: {
    subfolder: "onnx_int8",
    files: {
      "config.json": "a9f8d9c4b4736448ab355d1a98cfe48f5e39aecf2916c37b0806c228612e9a2d",
      "tokenizer.json": "6cc6bcbe380b8c37bd9f2514e37c5dfa3e00e122c6e3125dae5c4afe48e39158",
      "vieneu_acoustic_cached.onnx": "f631e3387c788c3d8b9a5ac5df94952af5bc4c4d1049ff8a751e76a246fff2d4",
      "vieneu_backbone_shared.data": "bb683925f7c8d826fadca4f8a0252ae4d5fc5b7837c14f6857e18f4c6666588d",
      "vieneu_decode_step.onnx": "2c5b30bd8ccb751c58d651f44c074df10c4113efd08719adaa8e3dec6a6ce2ca",
      "vieneu_prefill.onnx": "c6a80dabf67c820de798f8deb7d4e0f37d81b5d76e33fbe20ab5a67f2d371f4e",
      "vieneu_v3_heads.npz": "fb22484baa424bbb775133a6e5f0d00d6299b2b256fbe3312a864b85b9aed01e",
    },
  },
  fp32: {
    subfolder: "onnx_update",
    files: {
      "config.json": "17d89d414ee302a82db7b330bf57b4cdf8541569392119c81f552178cafcb79b",
      "tokenizer.json": "6cc6bcbe380b8c37bd9f2514e37c5dfa3e00e122c6e3125dae5c4afe48e39158",
      "vieneu_acoustic_cached.onnx": "f631e3387c788c3d8b9a5ac5df94952af5bc4c4d1049ff8a751e76a246fff2d4",
      "vieneu_backbone_shared.data": "c7c072193db33d0542457e2612c7272c44c4279d1cafaf0aa4c379964911db2f",
      "vieneu_decode_step.onnx": "bedc379cea61ea5d616312750d95ad3924e055856662d19187a889a5edc24ceb",
      "vieneu_prefill.onnx": "27f8b064f6b57b5448e95d095f1959588c005d614678045c2b97ecccf3b7a0f7",
      "vieneu_v3_heads.npz": "fb22484baa424bbb775133a6e5f0d00d6299b2b256fbe3312a864b85b9aed01e",
    },
  },
};
const CODEC_SUMS = {
  "codec_browser_onnx_meta.json": "3e291c883bb7d11ff2fe8e964e3e495519760358859f35c951254c7741592731",
  "moss_audio_tokenizer_decode_full.onnx": "0fbbafe3fd4afa2a019af5c5ced204af6e2d1db044fa40f021525d2aee95b4ac",
  "moss_audio_tokenizer_decode_shared.data": "e69d52e0f4e84ca27850557ee54face46632d3a5a16c89bd246c7c408466dcad",
  "moss_audio_tokenizer_decode_step.onnx": "9527c86a29e1837edec1f74db57d5eeaadb3a715af3382703566460afed25855",
};

const voiceInstalled = (dest: string, platform: Platform) => {
  const runtime = path.join(dest, "vendor", "vieneu", platform);
  return (
    fs.existsSync(path.join(runtime, PYTHON[platform].exe)) &&
    fs.existsSync(path.join(runtime, "site", "onnxruntime")) &&
    fs.existsSync(path.join(dest, "vendor", "models", VOICE_MODEL, "onnx", "vieneu_backbone_shared.data"))
  );
};

/** Python có pip để tải wheel: cùng nền tảng thì dùng luôn Python độc lập vừa tải, khác nền tảng thì dùng Python của máy. */
const pipPython = (bundled: string, platform: Platform) => {
  if (platform === HOST && works(bundled, ["-m", "pip", "--version"])) return [bundled];
  const candidates = process.platform === "win32" ? [["py", "-3"], ["python"], ["python3"]] : [["python3"], ["python"]];
  const found = candidates.find(([cmd, ...args]) => works(cmd, [...args, "-m", "pip", "--version"]));
  if (!found) throw new Error("Cần Python 3 có pip trên máy để tải thư viện cho nền tảng khác.");
  return found;
};

const installVoice = async (dest: string, platform: Platform) => {
  const py = PYTHON[platform];
  const out = path.join(dest, "vendor", "vieneu", platform);
  rm(out);
  fs.mkdirSync(out, { recursive: true });

  log(`→ Python ${PY_VERSION} độc lập (${platform})`);
  const pyAsset = `cpython-${PY_VERSION}+${PY_BUILD}-${py.triple}-install_only_stripped.tar.gz`;
  await fetchChecked(
    `https://github.com/astral-sh/python-build-standalone/releases/download/${PY_BUILD}/${pyAsset.replace("+", "%2B")}`,
    path.join(CACHE, pyAsset),
    py.sha,
  );
  extract(path.join(CACHE, pyAsset), out);
  const pythonExe = path.join(out, py.exe);
  if (!fs.existsSync(pythonExe)) throw new Error(`Thiếu ${pythonExe}`);

  log(`→ Thư viện Python cho ${platform}`);
  // Chọn trình tải trước khi dọn Python độc lập — bước dọn bỏ luôn pip của nó.
  const [pipCmd, ...pipArgs] = pipPython(pythonExe, platform);
  const pipFlags = [
    "--disable-pip-version-check", "--no-deps", "--only-binary=:all:", "--implementation", "cp", "--python-version", "3.11",
    ...py.pip.flatMap((tag) => ["--platform", tag]),
  ];
  run(pipCmd, [...pipArgs, "-m", "pip", "install", "--quiet", ...pipFlags, "--target", path.join(out, "site"), ...PY_PACKAGES]);

  if (platform === "win-x64") {
    // onnxruntime cần MSVCP140.dll + MSVCP140_1.dll (objdump), Python độc lập chỉ kèm vcruntime140 — máy chưa cài
    // Visual C++ Redistributable sẽ không nạp được. Lấy từ gói msvc-runtime (DLL redist của Microsoft), đặt cạnh
    // python.exe: Windows tìm DLL phụ thuộc trong thư mục của chương trình trước.
    const wheel = path.join(CACHE, `msvc_runtime-${MSVC_VERSION}-cp311-cp311-win_amd64.whl`);
    if (!fs.existsSync(wheel)) {
      run(pipCmd, [...pipArgs, "-m", "pip", "download", "--quiet", ...pipFlags, "-d", CACHE, `msvc-runtime==${MSVC_VERSION}`]);
    }
    if ((await sha256(wheel)) !== MSVC_SHA256) throw new Error(`${wheel} bị hỏng (SHA-256 không khớp) — xoá file rồi chạy lại.`);
    const unpack = fs.mkdtempSync(path.join(os.tmpdir(), "msvc-"));
    try {
      extract(wheel, unpack);
      for (const dll of ["msvcp140.dll", "msvcp140_1.dll"]) {
        copyFile(path.join(unpack, `msvc_runtime-${MSVC_VERSION}.data`, "data", dll), path.join(out, "python", dll));
      }
    } finally {
      rm(unpack);
    }
  }

  prunePython(path.join(out, "python"), platform);
  pruneSite(path.join(out, "site"));

  log(`→ Model ${VOICE_MODEL} (${py.precision})`);
  // Tải vào cache theo từng bản (int8/fp32), rồi chép sang đích — vendor/models chỉ chứa đúng bản của nền tảng.
  const onnx = ONNX_SUMS[py.precision];
  const modelCache = path.join(CACHE, `${VOICE_MODEL}-${py.precision}`);
  for (const [file, sha] of Object.entries(onnx.files)) {
    await fetchChecked(
      `https://huggingface.co/${TURBO_REPO}/resolve/${TURBO_REV}/${onnx.subfolder}/${file}`,
      path.join(modelCache, "onnx", file),
      sha,
    );
  }
  for (const [file, sha] of Object.entries(CODEC_SUMS)) {
    await fetchChecked(`https://huggingface.co/${CODEC_REPO}/resolve/${CODEC_REV}/${file}`, path.join(modelCache, "codec", file), sha);
  }
  const model = path.join(dest, "vendor", "models", VOICE_MODEL);
  rm(model);
  copyDir(modelCache, model);

  // Chạy thử trên máy này: bắt lỗi thiếu DLL / thiếu module chuẩn ngay lúc cài, không đợi tới lúc đọc giọng.
  if (platform === HOST) {
    log("→ Chạy thử Python + onnxruntime");
    run(pythonExe, ["-I", "-B", "-c", "import sys; sys.path.insert(0, sys.argv[1]); import threading, numpy, onnxruntime", path.join(out, "site")]);
  }
};

/** Phần không dùng tới khi đọc giọng (đã chạy thử sau khi bỏ). */
const prunePython = (dir: string, platform: Platform) => {
  // Windows để thư viện chuẩn trong "Lib", mac/linux trong "lib/python3.11" — hai nơi khác nhau, không dùng chung
  // mẫu xoá: ổ macOS/Windows không phân biệt hoa thường nên "lib/thread*" sẽ khớp nhầm Lib/threading.py.
  const win = platform === "win-x64";
  const lib = win ? "Lib" : "lib/python3.11";
  // pip/setuptools, IDLE, tkinter + Tcl/Tk, sqlite, unittest, distutils, tài liệu pydoc, header C.
  rmMatching(dir, [
    "include", "share", "libs", "Scripts", "tcl",
    ...["site-packages", "idlelib", "tkinter", "turtledemo", "ensurepip", "lib2to3", "distutils", "pydoc_data", "unittest",
      "test", "sqlite3", "dbm", "curses", "xmlrpc", "wsgiref", "venv", "turtle.py", "pydoc.py", "config-3.11-*"].map((name) => `${lib}/${name}`),
  ]);
  if (win) {
    rmMatching(dir, [
      "_tkinter", "_sqlite3", "_testcapi", "_testbuffer", "_testimportmultiple", "_testmultiphase", "_testinternalcapi",
      "_testconsole", "_testsinglephase", "_testclinic", "xxlimited", "xxlimited_35",
    ].map((name) => `DLLs/${name}.pyd`));
    rmMatching(dir, ["DLLs/tcl86t.dll", "DLLs/tk86t.dll", "DLLs/sqlite3.dll"]);
  } else {
    // Thư viện libpython (python3.11 trên mac/linux đã link tĩnh).
    rmMatching(dir, ["lib/tcl*", "lib/tk*", "lib/libtcl*", "lib/libtk*", "lib/itcl*", "lib/thread*", "lib/tdbc*", "lib/pkgconfig", "lib/libpython3.11.*"]);
    rmMatching(dir, [
      ...["_tkinter", "_sqlite3", "_curses", "_curses_panel", "_dbm", "_gdbm", "readline", "xxlimited", "xxlimited_35"].map(
        (name) => `${lib}/lib-dynload/${name}.*`,
      ),
      `${lib}/lib-dynload/_test*`,
    ]);
  }
  fs.mkdirSync(path.join(dir, lib, "site-packages"), { recursive: true });
  // Bỏ symlink (python3 → python3.11…): electron-builder chép chuỗi symlink bị lỗi, app gọi thẳng python3.11.
  // Bỏ __pycache__ do chính Python này sinh ra lúc chạy pip.
  walk(dir, (full, entry) => {
    if (entry.isSymbolicLink()) fs.unlinkSync(full);
    else if (entry.name === "__pycache__") rm(full);
    else return;
    return true;
  });
};

const pruneSite = (dir: string) => {
  rmMatching(dir, ["bin", "apps", "examples"]);
  // onnxruntime: công cụ tối ưu/lượng tử hoá model, và thư viện C dùng chung — module Python đã link tĩnh, không nạp nó
  // (kiểm bằng objdump: onnxruntime_pybind11_state không phụ thuộc libonnxruntime / onnxruntime.dll).
  rmMatching(dir, [
    "onnxruntime/transformers", "onnxruntime/quantization", "onnxruntime/tools", "onnxruntime/backend", "onnxruntime/datasets",
    "onnxruntime/capi/libonnxruntime.*.dylib", "onnxruntime/capi/libonnxruntime.so.*", "onnxruntime/capi/onnxruntime.dll",
  ]);
  // numpy: test, f2py, stub kiểu, header C.
  const numpyJunk = new Set(["tests", "testing", "f2py", "distutils", "typing", "_pyinstaller", "include"]);
  walk(path.join(dir, "numpy"), (full, entry) => {
    if (!entry.isDirectory() || !numpyJunk.has(entry.name)) return;
    rm(full);
    return true;
  });
  // vieneu: chế độ khác (GPU, server, API, Nano…), audio mẫu, danh sách giọng của model khác.
  rmMatching(dir, [
    "vieneu/assets/samples", "vieneu/assets/voices_v3_nano.json", "vieneu/assets/voices.json", "vieneu/v3_turbo_serve",
    ...["serve", "remote", "standard", "fast", "turbo", "core_xpu", "v3nano", "utils"].map((name) => `vieneu/${name}.py`),
    "vieneu_utils/url_extract.py",
  ]);
  walk(dir, (full, entry) => {
    if (entry.name !== "__pycache__") return;
    rm(full);
    return true;
  });
};

// ---------- yt-dlp (mục 📺 Bilibili trong trình chỉnh sửa) ----------
// Bilibili đổi trang thì yt-dlp cần bản mới — người dùng bấm "Cập nhật" trong app (chép ra data/bin rồi tự cập nhật),
// không phải build lại. Đổi YT_DLP_VERSION ở đây khi phát hành bản app mới.

const YT_DLP_VERSION = "2026.08.19";
const YT_DLP: Record<Platform, { asset: string; exe: string }> = {
  "mac-arm64": { asset: "yt-dlp_macos", exe: "yt-dlp" },
  "win-x64": { asset: "yt-dlp.exe", exe: "yt-dlp.exe" },
  "linux-x64": { asset: "yt-dlp_linux", exe: "yt-dlp" },
};

const ytDlpPath = (dest: string, platform: Platform) => path.join(dest, "vendor", "yt-dlp", platform, YT_DLP[platform].exe);

const installYtDlp = async (dest: string, platform: Platform) => {
  log(`→ yt-dlp ${YT_DLP_VERSION} (${platform})`);
  const { asset } = YT_DLP[platform];
  const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}`;
  const cache = path.join(CACHE, `yt-dlp-${YT_DLP_VERSION}`);
  await download(`${base}/SHA2-256SUMS`, path.join(cache, "SHA2-256SUMS"));
  const expected = fs
    .readFileSync(path.join(cache, "SHA2-256SUMS"), "utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find(([, file]) => file === asset)?.[0];
  if (!expected) throw new Error(`SHA2-256SUMS của yt-dlp không có ${asset}`);
  await fetchChecked(`${base}/${asset}`, path.join(cache, asset), expected);

  const target = ytDlpPath(dest, platform);
  rm(path.dirname(target));
  copyFile(path.join(cache, asset), target);
  fs.chmodSync(target, 0o755);
};

// ---------- chạy ----------

const COMPONENTS: Record<Part, { label: string; installed: typeof aiInstalled; install: typeof installAi }> = {
  voice: { label: "Giọng đọc VieNeu (~700 MB)", installed: voiceInstalled, install: installVoice },
  ai: { label: "AI có sẵn: llama.cpp + Qwen2.5 1.5B (~1,2 GB)", installed: aiInstalled, install: installAi },
  "yt-dlp": { label: "yt-dlp (~35 MB)", installed: (dest, platform) => fs.existsSync(ytDlpPath(dest, platform)), install: installYtDlp },
};

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const main = async () => {
  const postinstall = flag("postinstall");
  if (postinstall && (process.env.SKIP_LOCAL_SETUP === "1" || process.env.CI)) {
    log("Bỏ qua cài giọng đọc/AI offline (SKIP_LOCAL_SETUP hoặc CI). Cài sau bằng: npm run setup");
    return;
  }

  const platform = (arg("platform") ?? HOST) as Platform;
  if (!PLATFORMS.includes(platform)) {
    const message = `Chưa có bản giọng đọc/AI offline cho ${platform} (hỗ trợ: ${PLATFORMS.join(", ")}). App vẫn chạy được với giọng/AI trên mạng.`;
    if (postinstall) return log(message);
    throw new Error(message);
  }
  const dest = path.resolve(ROOT, arg("dest") ?? ".");
  const only = (arg("only")?.split(",") ?? PARTS) as Part[];
  const unknown = only.filter((part) => !PARTS.includes(part));
  if (unknown.length) throw new Error(`Không có phần "${unknown.join(", ")}" — chọn trong: ${PARTS.join(", ")}`);
  const force = flag("force");

  const failed: string[] = [];
  for (const part of only) {
    const component = COMPONENTS[part];
    if (!force && component.installed(dest, platform)) {
      log(`✓ ${component.label} — đã có`);
      continue;
    }
    log(`\n■ ${component.label}`);
    try {
      await component.install(dest, platform);
      log(`✓ ${component.label} — xong`);
    } catch (error) {
      // Một phần hỏng không chặn phần khác — ví dụ mạng chặn huggingface thì vẫn cài được yt-dlp.
      failed.push(part);
      console.error(`✗ ${component.label}: ${(error as Error).message}`);
    }
  }
  if (failed.length) throw new Error(`Chưa cài xong: ${failed.join(", ")}. Chạy lại: npm run setup -- --only ${failed.join(",")}`);
};

main().catch((error: Error) => {
  console.error(`\n${error.message}`);
  // npm i không được hỏng vì mạng chậm hay thiếu model — app vẫn chạy với giọng/AI trên mạng.
  if (flag("postinstall")) {
    console.error("npm i vẫn xong; giọng đọc/AI offline sẽ chưa dùng được cho tới khi chạy: npm run setup");
    return;
  }
  process.exitCode = 1;
});
