/**
 * Điểm vào trình chỉnh sửa. /editor.html#<slug> mở một video; /editor.html#new tạo dự án mới.
 * Được server đóng gói bằng esbuild lúc chạy — xem server/editor-build.ts.
 */
import { createRoot } from "react-dom/client";
import { Editor } from "./Editor";
import { NewProject } from "./NewProject";

// staticFile() trong composition trỏ vào /public của server, giống lúc render.
(window as unknown as { remotion_staticBase: string }).remotion_staticBase = "/public";

const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(slug === "new" ? <NewProject /> : <Editor slug={slug} />);
}

// Đổi hash (ví dụ từ màn hình tạo mới sang dự án vừa tạo) → nạp lại đúng màn hình.
window.addEventListener("hashchange", () => location.reload());
