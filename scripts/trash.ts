/**
 * Chuyển file/thư mục vào Thùng rác của hệ điều hành thay vì xoá hẳn — người dùng lấy lại được.
 *
 * Không thêm thư viện, mỗi hệ điều hành một cách:
 *  - macOS: dời vào ~/.Trash (cùng ổ thì rename, khác ổ thì chép rồi xoá bản gốc).
 *  - Windows: Recycle Bin qua PowerShell (Microsoft.VisualBasic.FileIO.FileSystem). Đường dẫn đi qua
 *    biến môi trường để khỏi phải escape trong lệnh PowerShell — cùng cách với giọng đọc SAPI.
 *  - Linux: `gio trash`; máy không có gio (server, WSL) thì tự dời theo chuẩn freedesktop.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Tên chưa có trong thư mục đích: trùng thì gắn giờ phút giây, như Finder làm. */
const freeName = (dir: string, name: string) => {
  if (!fs.existsSync(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, ".");
  for (let i = 0; ; i++) {
    const candidate = `${base} ${stamp}${i ? ` ${i}` : ""}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
};

/** rename trong cùng ổ; khác ổ (EXDEV) thì chép rồi xoá bản gốc. */
const move = (from: string, to: string) => {
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
};

const trashMac = (target: string) => {
  const dir = path.join(os.homedir(), ".Trash");
  fs.mkdirSync(dir, { recursive: true });
  move(target, path.join(dir, freeName(dir, path.basename(target))));
};

const trashWindows = (target: string) => {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName Microsoft.VisualBasic",
    "$fs = [Microsoft.VisualBasic.FileIO.FileSystem]",
    "if (Test-Path -LiteralPath $env:TRASH_PATH -PathType Container) {",
    "  $fs::DeleteDirectory($env:TRASH_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin')",
    "} else {",
    "  $fs::DeleteFile($env:TRASH_PATH, 'OnlyErrorDialogs', 'SendToRecycleBin')",
    "}",
  ].join("\n");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, TRASH_PATH: target },
    stdio: "pipe",
    windowsHide: true,
  });
};

const trashLinux = (target: string) => {
  try {
    execFileSync("gio", ["trash", target], { stdio: "pipe" });
    return;
  } catch {
    // không có gio — tự làm theo chuẩn freedesktop bên dưới
  }
  const root = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "Trash");
  const files = path.join(root, "files");
  const info = path.join(root, "info");
  fs.mkdirSync(files, { recursive: true });
  fs.mkdirSync(info, { recursive: true });
  const name = freeName(files, path.basename(target));
  fs.writeFileSync(
    path.join(info, `${name}.trashinfo`),
    `[Trash Info]\nPath=${encodeURI(target)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`,
  );
  move(target, path.join(files, name));
};

/** Chuyển `target` (file hoặc thư mục) vào Thùng rác. Không tồn tại thì bỏ qua. Lỗi thì ném ra. */
export const moveToTrash = (target: string) => {
  if (!fs.existsSync(target)) return;
  if (process.platform === "darwin") trashMac(target);
  else if (process.platform === "win32") trashWindows(target);
  else trashLinux(target);
};
