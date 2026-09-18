/**
 * Icon Lucide cho các trang không dùng React (index.html, app.js, subs.js, bili.js). Trình chỉnh sửa (React)
 * dùng thẳng lucide-react.
 *
 * Cách dùng trong trang:
 *   - HTML tĩnh hoặc chuỗi innerHTML: <i data-icon="scissors"></i> — tự thay bằng <svg class="i">.
 *   - Trong chuỗi template JS: ${icon("scissors")} — trả về chuỗi <svg>, không cần chờ.
 * Tên icon là tên kebab-case trên lucide.dev/icons. Luôn viết tên dạng chuỗi cố định (kể cả khi có điều kiện:
 * `ok ? icon("check") : icon("x")`), vì server quét mã nguồn để chỉ gửi đúng các icon được dùng.
 *
 * /icons.js sinh lúc chạy, giữ trong bộ nhớ. Sửa file trong server/public/ thì lần tải sau tự sinh lại.
 */
import fs from "fs";
import path from "path";
import { icons } from "lucide";

type IconNode = [string, Record<string, string | number>][];

const kebab = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();

let byName: Map<string, IconNode> | null = null;
const iconMap = () => {
  byName ??= new Map(Object.entries(icons).map(([name, node]) => [kebab(name), node as unknown as IconNode]));
  return byName;
};

const SOURCES = () => {
  const dir = path.join(process.cwd(), "server", "public");
  return fs.readdirSync(dir).filter((f) => /\.(html|js)$/.test(f) && f !== "icons.js").map((f) => path.join(dir, f));
};
const USE = /data-icon="([a-z0-9-]+)"|icon\(\s*["']([a-z0-9-]+)["']/g;

/** Chạy trong trình duyệt: `ICONS` được chèn vào đầu. */
const RUNTIME = `
const attrs = (o) => Object.entries(o).map(([k, v]) => k + '="' + v + '"').join(" ");
const icon = (name, cls) => {
  const node = ICONS[name];
  if (!node) { console.warn("Thiếu icon:", name, "— thêm bằng data-icon/icon() với tên cố định"); return ""; }
  return '<svg xmlns="http://www.w3.org/2000/svg" class="i i-' + name + (cls ? " " + cls : "") +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
    ' stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    node.map(([tag, a]) => "<" + tag + " " + attrs(a) + "/>").join("") + "</svg>";
};
window.icon = icon;
const swapOne = (el) => {
  const html = icon(el.dataset.icon, el.className);
  if (html && el.parentNode) el.outerHTML = html;
};
const swap = (root) => {
  if (root.nodeType !== 1 && root.nodeType !== 9) return;
  if (root.matches && root.matches("i[data-icon]")) return swapOne(root);
  root.querySelectorAll("i[data-icon]").forEach(swapOne);
};
new MutationObserver((records) => {
  for (const r of records) for (const n of r.addedNodes) swap(n);
}).observe(document.documentElement, { childList: true, subtree: true });
swap(document);
`;

let cache: { js: string; builtAt: number } | null = null;

export const getIconsJs = () => {
  const files = SOURCES();
  const newest = Math.max(...files.map((f) => fs.statSync(f).mtimeMs));
  if (cache && cache.builtAt >= newest) return cache.js;

  const used = new Set<string>();
  for (const file of files) {
    for (const m of fs.readFileSync(file, "utf8").matchAll(USE)) used.add(m[1] ?? m[2]);
  }
  const map = iconMap();
  const picked: Record<string, IconNode> = {};
  for (const name of [...used].sort()) {
    const node = map.get(name);
    if (node) picked[name] = node;
    else console.warn(`[icons] Không có icon Lucide tên "${name}"`);
  }
  const js = `(() => {\nconst ICONS = ${JSON.stringify(picked)};\n${RUNTIME}\n})();\n`;
  cache = { js, builtAt: Date.now() };
  return js;
};
