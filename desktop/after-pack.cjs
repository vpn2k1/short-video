/**
 * electron-builder chỉ chép các package trong node_modules, bỏ qua
 * node_modules/.remotion — nơi Remotion để Chrome Headless Shell dùng khi render.
 * Chép vào bản đóng gói để máy người dùng không phải tải lại (và không cần ghi vào .app).
 */
const fs = require("fs");
const path = require("path");

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
};
