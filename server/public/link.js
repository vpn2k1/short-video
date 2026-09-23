/**
 * Lấy video từ link: dán link (YouTube, TikTok, Facebook…) → xem thông tin → xác nhận có quyền dùng → tải về
 * (server: scripts/video-link.ts) → mở trình chỉnh sửa hoặc đưa sang trang Phụ đề.
 *
 * Mở từ: thẻ "Từ link video" ở trang chủ, nút "Dán link video" ở trang Phụ đề (tải xong tự thêm vào danh sách), hoặc
 * dán một link vào ô tạo video đang trống.
 *
 * Nạp sau app.js và subs.js, dùng chung $, icon, escapeHtml, postJson, setSelecting… và addSubsPath của subs.js.
 */

const link = { info: null, result: null, forSubs: false, busy: false };

/** "1:30" → 90, "90" → 90, trống → null. */
const linkClock = (text) => {
  const value = String(text ?? "").trim();
  if (!value) return null;
  const parts = value.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((sum, n) => sum * 60 + n, 0);
};
const linkDuration = (s) => (s ? `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ""}${
  String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

const setLinkHint = (text, isError = false) => {
  $("linkHint").textContent = text;
  $("linkHint").classList.toggle("err", isError);
};

/** Nút theo từng bước: chưa có thông tin → Xem video; có thông tin → Tải về; tải xong → Chỉnh sửa / Phụ đề. */
function syncLinkButtons() {
  const done = Boolean(link.result);
  $("linkFetch").disabled = link.busy;
  $("linkGo").hidden = !link.info || done;
  $("linkGo").disabled = link.busy || !$("linkConfirm").checked;
  $("linkEdit").hidden = !done || link.forSubs;
  $("linkSubs").hidden = !done || link.forSubs;
  $("linkOpts").hidden = !link.info || done;
}

function openLinkDialog({ url = "", forSubs = false } = {}) {
  Object.assign(link, { info: null, result: null, forSubs, busy: false });
  $("linkUrl").value = url;
  $("linkInfo").hidden = true;
  $("linkVideo").hidden = true;
  $("linkVideo").removeAttribute("src");
  $("linkStart").value = "";
  $("linkEnd").value = "";
  $("linkConfirm").checked = false;
  setLinkHint(forSubs ? "Tải xong, video tự vào danh sách thêm phụ đề." : "");
  syncLinkButtons();
  $("linkDlg").showModal();
  if (url) fetchLinkInfo();
  else $("linkUrl").focus();
}

async function fetchLinkInfo() {
  const url = $("linkUrl").value.trim();
  if (!url) return $("linkUrl").focus();
  link.busy = true;
  link.info = null;
  link.result = null;
  $("linkInfo").hidden = true;
  $("linkVideo").hidden = true;
  setLinkHint("Đang đọc thông tin video…");
  syncLinkButtons();
  try {
    const info = await postJson("/api/link/info", { url });
    link.info = info;
    $("linkThumb").src = info.thumbnail ?? "";
    $("linkThumb").hidden = !info.thumbnail;
    $("linkTitle").textContent = info.title;
    $("linkMeta").textContent = [info.site, info.uploader, linkDuration(info.duration)].filter(Boolean).join(" · ");
    $("linkInfo").hidden = false;
    setLinkHint(info.duration > 2 * 3600 ? "Video dài quá 2 giờ — chọn một đoạn ở ô Từ/Đến." : "");
  } catch (e) {
    setLinkHint(e.message, true);
  } finally {
    link.busy = false;
    syncLinkButtons();
  }
}

async function downloadFromLink() {
  if (!link.info || link.busy) return;
  if (!$("linkConfirm").checked) return setLinkHint("Đánh dấu ô xác nhận quyền dùng video trước đã.", true);
  const start = linkClock($("linkStart").value);
  const end = linkClock($("linkEnd").value);
  if (Number.isNaN(start) || Number.isNaN(end)) return setLinkHint("Ô Từ/Đến ghi phút:giây, ví dụ 1:30.", true);
  if (start !== null && end !== null && end <= start) return setLinkHint("Mốc Đến phải sau mốc Từ.", true);
  link.busy = true;
  syncLinkButtons();
  setLinkHint("Đang gửi yêu cầu…");
  try {
    const { jobId } = await postJson("/api/link/download", {
      url: link.info.url, start, end, maxHeight: Number($("linkHeight").value), confirmed: true,
    });
    const result = await new Promise((resolve, reject) => {
      const source = new EventSource(`/api/job/${jobId}`);
      source.onmessage = (event) => {
        const { line, status, result: value, error } = JSON.parse(event.data);
        if (line === "__END__") {
          source.close();
          return status === "done" ? resolve(value) : reject(new Error(error ?? "Tải thất bại."));
        }
        if (!line.startsWith("__")) setLinkHint(line);
      };
      source.onerror = () => { source.close(); reject(new Error("Mất kết nối tới app trong lúc tải — thử lại.")); };
    });
    link.result = result;
    if (link.forSubs) {
      await addSubsPath(result.path, result.title);
      $("linkDlg").close();
      return;
    }
    $("linkVideo").src = `/public/${result.path}`;
    $("linkVideo").hidden = false;
    setLinkHint("Đã tải xong — video cũng có trong 📁 Thư viện › Tài nguyên.");
  } catch (e) {
    setLinkHint(e.message, true);
  } finally {
    link.busy = false;
    syncLinkButtons();
  }
}

/** Khung dự án theo hướng của video: dọc → 9:16, ngang → 16:9, gần vuông → 1:1. */
const linkAspect = (width, height) => {
  const ratio = width && height ? width / height : 9 / 16;
  return ratio >= 1.2 ? "16:9" : ratio <= 0.85 ? "9:16" : "1:1";
};

/** Dự án mới trong trình chỉnh sửa với video vừa tải làm video đầu tiên. */
async function linkToEditor() {
  const { result } = link;
  if (!result) return;
  $("linkEdit").disabled = true;
  try {
    const video = $("linkVideo");
    if (!video.duration) await new Promise((resolve) => { video.onloadedmetadata = resolve; video.onerror = resolve; });
    const { slug } = await postJson("/api/editor/new", {
      title: result.title.slice(0, 60),
      aspect: linkAspect(video.videoWidth || result.width, video.videoHeight || result.height),
      media: [{ path: result.path, durationMs: Math.round((video.duration || 5) * 1000) }],
    });
    location.href = `/editor.html#${encodeURIComponent(slug)}`;
  } catch (e) {
    setLinkHint(e.message, true);
    $("linkEdit").disabled = false;
  }
}

async function linkToSubs() {
  const { result } = link;
  if (!result) return;
  $("linkDlg").close();
  location.hash = "#/subs";
  await addSubsPath(result.path, result.title);
}

(function bindLink() {
  $("linkForm").addEventListener("submit", (e) => { e.preventDefault(); fetchLinkInfo(); });
  $("linkUrl").addEventListener("input", () => {
    // Đổi link thì thông tin cũ không còn đúng.
    if (link.info && $("linkUrl").value.trim() !== link.info.url) {
      link.info = null;
      link.result = null;
      $("linkInfo").hidden = true;
      $("linkVideo").hidden = true;
      syncLinkButtons();
    }
  });
  $("linkConfirm").addEventListener("change", syncLinkButtons);
  $("linkGo").addEventListener("click", downloadFromLink);
  $("linkEdit").addEventListener("click", linkToEditor);
  $("linkSubs").addEventListener("click", linkToSubs);
  $("linkDlg").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("linkDlg").close()));

  $("fromLink").addEventListener("click", (e) => { e.preventDefault(); openLinkDialog(); });
  $("subsFromLink").addEventListener("click", () => openLinkDialog({ forSubs: true }));

  // Dán đúng một link vào ô tạo video đang trống → mở hộp lấy video luôn (một link trần không phải ý tưởng video).
  $("input").addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text")?.trim() ?? "";
    if ($("input").value.trim() || e.clipboardData?.files?.length || !/^https?:\/\/\S+$/i.test(text)) return;
    e.preventDefault();
    openLinkDialog({ url: text });
  });
})();
