/**
 * electron-builder chỉ chép các package trong node_modules, bỏ qua
 * node_modules/.remotion — nơi Remotion để Chrome Headless Shell dùng khi render.
 * Chép vào bản đóng gói để máy người dùng không phải tải lại (và không cần ghi vào .app).
 *
 * Sau đó kiểm tra cả bản đóng gói (desktop/verify-app.mjs): chép lại thư mục electron-builder bỏ sót, mọi import có
 * file thật, đủ Chrome/ffmpeg/giọng đọc/AI, Python kèm app nạp được giọng đọc. Thiếu gì thì dựng thất bại ở đây —
 * không tạo bộ cài hỏng để gửi đi.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

exports.default = async (context) => {
  const from = path.join(context.packager.projectDir, "node_modules", ".remotion");
  if (!fs.existsSync(from)) {
    throw new Error("Thiếu node_modules/.remotion — chạy `npx remotion browser ensure` trước khi đóng gói.");
  }
  const appName = context.packager.appInfo.productFilename;
  const resources =
    context.electronPlatformName === "darwin"
      ? path.join(context.appOutDir, `${appName}.app`, "Contents", "Resources")
      : path.join(context.appOutDir, "resources");
  fs.cpSync(from, path.join(resources, "app", "node_modules", ".remotion"), { recursive: true, verbatimSymlinks: true });

  const platform = { darwin: "mac-arm64", win32: "win-x64", linux: "linux-x64" }[context.electronPlatformName];
  const { verifyApp } = await import(pathToFileURL(path.join(__dirname, "verify-app.mjs")).href);
  console.log(`  • Kiểm tra bản đóng gói (${platform})…`);
  const { problems } = verifyApp({
    appDir: path.join(resources, "app"),
    projectDir: context.packager.projectDir,
    platform,
    // Dựng chéo (release/<os>-stage): desktop/build.mjs truyền gốc dự án thật để đối chiếu Python của máy dựng.
    sourceRoot: process.env.AVS_SOURCE_ROOT || context.packager.projectDir,
  });
  if (problems.length) {
    throw new Error(`Bản đóng gói ${platform} sẽ lỗi trên máy người dùng:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
  }
  console.log("  ✓ Bản đóng gói đủ file chạy");
};
