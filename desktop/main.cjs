/**
 * Vỏ desktop cho AI Video Studio.
 *
 * Không viết lại gì: chạy nguyên server/index.ts bằng Node đi kèm Electron
 * (ELECTRON_RUN_AS_NODE), rồi mở cửa sổ trỏ vào nó.
 *
 * Server, Remotion và whisper đều đọc/ghi theo process.cwd() (src/, public/, videos/,
 * out/, data/). Bản đóng gói nằm trong .app không nên ghi vào, nên khi đóng gói ta
 * chạy server trong một thư mục làm việc ở Application Support: code được chép sang
 * mỗi khi đổi phiên bản, node_modules là symlink về app, dữ liệu người dùng giữ nguyên.
 */
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { pathToFileURL } = require("url");

const appRoot = app.getAppPath();
const workspace = app.isPackaged ? path.join(app.getPath("userData"), "workspace") : appRoot;
const logPath = path.join(app.getPath("logs"), "server.log");

/** Chép lại mỗi lần đổi bản — người dùng không sửa những thứ này. */
const CODE = ["package.json", "tsconfig.json", "remotion.config.ts", "src", "server", "scripts", ".claude/skills"];
/** Chỉ chép file còn thiếu — không đè nhạc/ảnh người dùng đã thêm. */
const SEED = ["public/images", "public/music", "public/sfx"];
const DATA_DIRS = ["videos", "out", "data", "public/uploads", "public/voices", "public/videos"];

/** Tên gói @remotion/compositor-* (chứa ffprobe) theo nền tảng. */
const COMPOSITOR = {
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "win32-x64": "win32-x64-msvc",
  "linux-x64": "linux-x64-gnu",
  "linux-arm64": "linux-arm64-gnu",
};
/** App mở từ Finder chỉ có PATH tối thiểu. */
const MAC_BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

let serverProcess = null;
let quitting = false;

const prepareWorkspace = () => {
  if (!app.isPackaged) return;
  fs.mkdirSync(workspace, { recursive: true });

  const stampPath = path.join(workspace, ".app-build");
  const stamp = `${app.getVersion()}-${fs.statSync(path.join(appRoot, "package.json")).mtimeMs}`;
  const current = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, "utf8") : "";
  if (current !== stamp) {
    for (const entry of CODE) {
      const target = path.join(workspace, entry);
      fs.rmSync(target, { recursive: true, force: true });
      if (fs.existsSync(path.join(appRoot, entry))) {
        fs.cpSync(path.join(appRoot, entry), target, { recursive: true });
      }
    }
    fs.writeFileSync(stampPath, stamp);
  }

  for (const entry of SEED) {
    const from = path.join(appRoot, entry);
    if (fs.existsSync(from)) {
      fs.cpSync(from, path.join(workspace, entry), { recursive: true, force: false, errorOnExist: false });
    }
  }
  for (const dir of DATA_DIRS) fs.mkdirSync(path.join(workspace, dir), { recursive: true });

  // App có thể bị kéo sang chỗ khác (DMG → Applications) — trỏ lại mỗi lần mở.
  const link = path.join(workspace, "node_modules");
  const wanted = path.join(appRoot, "node_modules");
  let existing = null;
  try { existing = fs.readlinkSync(link); } catch { /* chưa có */ }
  if (existing !== wanted) {
    fs.rmSync(link, { recursive: true, force: true });
    // Junction trên Windows không cần quyền admin như symlink.
    fs.symlinkSync(wanted, link, process.platform === "win32" ? "junction" : "dir");
  }
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const startServer = (port) => {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = fs.createWriteStream(logPath, { flags: "w" });

  // App mở từ Finder chỉ có PATH tối thiểu, máy người dùng cũng chưa chắc có ffmpeg.
  // ffmpeg: bản đầy đủ từ ffmpeg-static — bản Remotion kèm sẵn bị rút gọn, không đọc
  // được AIFF của `say` hay ảnh tải về không có đuôi. ffprobe: bản Remotion là đủ.
  const ffmpegStatic = path.join(appRoot, "node_modules", "ffmpeg-static");
  const compositor = path.join(appRoot, "node_modules", "@remotion", `compositor-${COMPOSITOR[`${process.platform}-${process.arch}`]}`);

  // AI có sẵn (llama-server + model ~1 GB) đọc thẳng trong app — không chép sang workspace.
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(port), LOCAL_AI_DIR: path.join(appRoot, "vendor") };
  // Windows gọi biến là "Path" — gom mọi biến thể về một khoá PATH duy nhất.
  const inheritedPath = Object.entries(env).find(([key]) => key.toUpperCase() === "PATH")?.[1];
  for (const key of Object.keys(env)) if (key.toUpperCase() === "PATH") delete env[key];
  env.PATH = [ffmpegStatic, compositor, ...(process.platform === "darwin" ? MAC_BIN_DIRS : []), inheritedPath]
    .filter(Boolean)
    .join(path.delimiter);
  // ffmpeg của Remotion link libav*.dylib theo tên trần — cần chỉ chỗ cho dyld.
  // Trên Windows, DLL nằm cạnh .exe nên tự tìm được.
  if (process.platform === "darwin") env.DYLD_LIBRARY_PATH = compositor;

  const tsxLoader = pathToFileURL(path.join(appRoot, "node_modules", "tsx", "dist", "loader.mjs")).href;
  serverProcess = spawn(process.execPath, ["--import", tsxLoader, path.join("server", "index.ts")], {
    cwd: workspace,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [serverProcess.stdout, serverProcess.stderr]) {
    stream.on("data", (chunk) => {
      log.write(chunk);
      if (!app.isPackaged) process.stdout.write(chunk);
    });
  }
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (quitting) return;
    dialog.showErrorBox("Server đã dừng", `Mã thoát ${code}. Xem log tại:\n${logPath}`);
    app.quit();
  });
};

const waitForServer = (url, timeoutMs = 90_000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (!serverProcess) return reject(new Error("Server thoát trước khi sẵn sàng"));
          if (Date.now() - started > timeoutMs) return reject(new Error("Server khởi động quá lâu"));
          setTimeout(attempt, 300);
        });
    };
    attempt();
  });

const LOADING_HTML = `<body style="margin:0;display:grid;place-items:center;height:100vh;font:15px -apple-system,system-ui;background:#111;color:#bbb">Đang khởi động AI Video Studio…</body>`;

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: "AI Video Studio",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#111111",
  });
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  startServer(port);
  try {
    await waitForServer(`${origin}/`);
  } catch (error) {
    dialog.showErrorBox("Không mở được AI Video Studio", `${error.message}\n\nLog: ${logPath}`);
    app.quit();
    return;
  }

  // Trang trong app mở cửa sổ con; link ngoài (lấy API key…) mở bằng trình duyệt.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  // Menu Xem không giữ phím zoom (xem buildMenu): ngoài trình chỉnh sửa thì tự zoom cả cửa sổ.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !(input.meta || input.control) || input.alt) return;
    if (new URL(win.webContents.getURL()).pathname === "/editor.html") return;
    const wc = win.webContents;
    if (input.code === "Equal" || input.code === "NumpadAdd") wc.setZoomLevel(Math.min(5, wc.getZoomLevel() + 0.5));
    else if (input.code === "Minus" || input.code === "NumpadSubtract") wc.setZoomLevel(Math.max(-5, wc.getZoomLevel() - 0.5));
    else if (input.code === "Digit0" || input.code === "Numpad0") wc.setZoomLevel(0);
    else return;
    event.preventDefault();
  });
  win.loadURL(`${origin}/`);
};

const buildMenu = () => {
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      // Như viewMenu mặc định, nhưng ⌘+ / ⌘− / ⌘0 không đăng ký với hệ thống: trong trình chỉnh
      // sửa các phím này thu phóng khung xem trước (trang tự bắt). Trang khác zoom cả cửa sổ —
      // xem before-input-event trong createWindow.
      label: "Xem",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom", registerAccelerator: false },
        { role: "zoomIn", registerAccelerator: false },
        { role: "zoomOut", registerAccelerator: false },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      label: "Thư mục",
      submenu: [
        { label: "Mở thư mục dữ liệu", click: () => shell.openPath(workspace) },
        { label: "Mở video đã render", click: () => shell.openPath(path.join(workspace, "out")) },
        { label: "Mở log server", click: () => shell.openPath(logPath) },
      ],
    },
    {
      role: "help",
      label: "Trợ giúp",
      submenu: [
        {
          // Không gắn accelerator: phím ⌘/ do trang tự bắt (chạy giống nhau trên web và app),
          // gắn vào menu nữa thì một lần bấm sẽ mở rồi đóng hộp ngay.
          label: `Phím tắt (${process.platform === "darwin" ? "⌘" : "Ctrl"}+/)`,
          click: (_item, win) => {
            win?.webContents.executeJavaScript('window.dispatchEvent(new Event("app:shortcuts"))').catch(() => {});
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      prepareWorkspace();
    } catch (error) {
      dialog.showErrorBox("Không tạo được thư mục làm việc", String(error));
      app.quit();
      return;
    }
    // Bản đóng gói lấy icon từ .icns; khi chạy dev Dock vẫn là icon Electron nên đặt tay.
    if (!app.isPackaged && process.platform === "darwin") app.dock.setIcon(path.join(__dirname, "icon.png"));
    buildMenu();
    createWindow();
  });

  // Một server cho cả app — đóng cửa sổ là thoát hẳn, kể cả trên macOS.
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    quitting = true;
    if (serverProcess && process.platform === "win32") {
      // Windows không có SIGTERM: kill() cắt ngang server, để llama-server (AI có sẵn) mồ côi giữ RAM.
      // Tắt cả cây tiến trình.
      spawnSync("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"], { windowsHide: true });
    } else {
      serverProcess?.kill();
    }
  });
}
