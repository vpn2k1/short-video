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
const { spawn } = require("child_process");
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
    fs.symlinkSync(wanted, link, "dir");
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
  const compositor = path.join(appRoot, "node_modules", "@remotion", `compositor-${process.platform}-${process.arch}`);
  const PATH = [ffmpegStatic, compositor, "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin", process.env.PATH]
    .filter(Boolean)
    .join(path.delimiter);

  const tsxLoader = pathToFileURL(path.join(appRoot, "node_modules", "tsx", "dist", "loader.mjs")).href;
  serverProcess = spawn(process.execPath, ["--import", tsxLoader, path.join("server", "index.ts")], {
    cwd: workspace,
    // ffmpeg của Remotion link libav*.dylib theo tên trần — cần chỉ chỗ cho dyld.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(port), PATH, DYLD_LIBRARY_PATH: compositor },
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
  win.loadURL(`${origin}/`);
};

const buildMenu = () => {
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      label: "Thư mục",
      submenu: [
        { label: "Mở thư mục dữ liệu", click: () => shell.openPath(workspace) },
        { label: "Mở video đã render", click: () => shell.openPath(path.join(workspace, "out")) },
        { label: "Mở log server", click: () => shell.openPath(logPath) },
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
    buildMenu();
    createWindow();
  });

  // Một server cho cả app — đóng cửa sổ là thoát hẳn, kể cả trên macOS.
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    quitting = true;
    serverProcess?.kill();
  });
}
