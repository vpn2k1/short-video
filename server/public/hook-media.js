/**
 * Hình mở đầu (hook bằng hình): chọn một ảnh hoặc clip cho 1–3 giây đầu video — khung hình đầu tiên là thứ
 * quyết định người xem dừng lướt hay không.
 *
 * Ba nguồn: kho miễn phí (Pexels, Pixabay), file tải lên, và ảnh/clip đã có trong thư viện.
 * Chọn xong chỉ ghi vào tuỳ chọn `opts.hookMedia`; server ghim nó vào câu hook lúc dựng (server/chat.ts, withHookMedia).
 *
 * Nạp sau app.js, dùng chung $, api, postJson, escapeHtml, icon, setOpt, opts của nó.
 */

let hookMediaTab = "stock";
let hookMediaKind = "image";
let hookStockItems = [];
let hookLibraryItems = [];
let hookMediaBusy = false;

const HOOK_MEDIA_TABS = [
  { id: "stock", label: "Kho miễn phí" },
  { id: "library", label: "Ảnh/clip của tôi" },
];

const publicUrl = (p) => `/public/${p.split("/").map(encodeURIComponent).join("/")}`;

function openHookMedia() {
  hookStockItems = [];
  setHookMediaNote("");
  if (!$("hookMediaDlg").open) $("hookMediaDlg").showModal();
  renderHookMedia();
  if (hookMediaTab === "library") loadHookLibrary();
}

function setHookMediaNote(text, isError = false) {
  $("hookMediaNote").textContent = text;
  $("hookMediaNote").classList.toggle("err", isError);
}

/** Ghi lựa chọn vào tuỳ chọn video rồi đóng — `path` rỗng = bỏ hình mở đầu. */
function pickHookMedia(path) {
  setOpt("hookMedia", path);
  $("hookMediaDlg").close();
}

function hookMediaCard(path, label, isVideo, note = "") {
  const url = publicUrl(path);
  return `<button type="button" class="hm-card" data-hm-pick="${escapeHtml(path)}" title="${escapeHtml(label)}">
    ${isVideo
      ? `<video src="${escapeHtml(url)}#t=0.5" muted playsinline preload="metadata"></video><span class="hm-tag">${icon("film")}</span>`
      : `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`}
    ${note ? `<span class="hm-note">${escapeHtml(note)}</span>` : ""}
  </button>`;
}

function renderHookMedia() {
  const current = opts.hookMedia;
  $("hookMediaCurrent").innerHTML = current
    ? `<div class="hm-current">${hookMediaCard(current, current, /\.(mp4|mov|webm)$/i.test(current))}
       <div><b>Đang dùng làm hình mở đầu</b><div class="muted">${escapeHtml(current)}</div>
       <button type="button" class="btn" data-hm-clear>${icon("x")} Bỏ hình mở đầu</button></div></div>`
    : `<p class="muted">Chưa chọn — cảnh đầu lấy hình như các cảnh khác.</p>`;

  $("hookMediaTabs").innerHTML = HOOK_MEDIA_TABS.map((t) =>
    `<button type="button" role="tab" aria-selected="${t.id === hookMediaTab}" data-hm-tab="${t.id}">${t.label}</button>`).join("");

  if (hookMediaTab === "stock") {
    $("hookMediaSearch").hidden = false;
    $("hookMediaKind").innerHTML = [["image", "Ảnh"], ["video", "Clip"]].map(([id, label]) =>
      `<button type="button" data-hm-kind="${id}" aria-pressed="${id === hookMediaKind}">${escapeHtml(label)}</button>`).join("");
    $("hookMediaGrid").innerHTML = hookStockItems.length
      ? hookStockItems.map((item) => `<button type="button" class="hm-card" data-hm-stock="${escapeHtml(item.provider)}|${escapeHtml(item.id)}|${escapeHtml(item.kind)}"
          title="${escapeHtml(`${item.title} — ${item.author}`)}">
          <img src="${escapeHtml(item.preview)}" alt="" loading="lazy" />
          ${item.kind === "video" ? `<span class="hm-tag">${icon("film")}${item.duration ? ` ${Math.round(item.duration)}s` : ""}</span>` : ""}
          <span class="hm-note">${escapeHtml(item.author)}</span>
        </button>`).join("")
      : `<p class="muted">Gõ từ khoá rồi bấm Tìm. Từ khoá tiếng Anh cho nhiều kết quả hơn.</p>`;
  } else {
    $("hookMediaSearch").hidden = true;
    $("hookMediaGrid").innerHTML = hookLibraryItems.length
      ? hookLibraryItems.map((m) => hookMediaCard(m.path, m.path, m.kind === "video")).join("")
      : `<p class="muted">Chưa có ảnh hay clip nào trong thư viện — bấm Tải lên.</p>`;
  }
  bindHookMediaCards();
}

function bindHookMediaCards() {
  const body = $("hookMediaBody");
  body.querySelectorAll("[data-hm-tab]").forEach((b) => b.addEventListener("click", () => {
    hookMediaTab = b.dataset.hmTab;
    renderHookMedia();
    if (hookMediaTab === "library") loadHookLibrary();
  }));
  body.querySelectorAll("[data-hm-kind]").forEach((b) => b.addEventListener("click", () => {
    hookMediaKind = b.dataset.hmKind;
    renderHookMedia();
    if ($("hookMediaQuery").value.trim()) searchHookStock();
  }));
  body.querySelectorAll("[data-hm-pick]").forEach((b) =>
    b.addEventListener("click", () => pickHookMedia(b.dataset.hmPick)));
  body.querySelector("[data-hm-clear]")?.addEventListener("click", () => pickHookMedia(""));
  body.querySelectorAll("[data-hm-stock]").forEach((b) =>
    b.addEventListener("click", () => takeHookStock(...b.dataset.hmStock.split("|"))));
}

async function loadHookLibrary() {
  try {
    const { items } = await api("/api/library/media");
    hookLibraryItems = items.filter((m) => m.kind === "image" || m.kind === "video");
    if (hookMediaTab === "library") renderHookMedia();
  } catch (e) {
    setHookMediaNote(e.message, true);
  }
}

async function searchHookStock() {
  const query = $("hookMediaQuery").value.trim();
  if (!query || hookMediaBusy) return;
  hookMediaBusy = true;
  setHookMediaNote("Đang tìm…");
  try {
    const params = new URLSearchParams({ kind: hookMediaKind, q: query, page: "1", orientation: stockOrientation() });
    const data = await api(`/api/stock/search?${params}`);
    hookStockItems = data.items;
    renderHookMedia();
    setHookMediaNote(data.errors?.length ? data.errors.join(" · ")
      : data.items.length ? "" : "Không có kết quả — thử từ khoá tiếng Anh, ngắn hơn.", Boolean(data.errors?.length));
  } catch (e) {
    setHookMediaNote(e.message, true);
  } finally {
    hookMediaBusy = false;
  }
}

/** Khung dọc thì tìm ảnh dọc — ảnh ngang đặt vào 9:16 phải cắt mất hai bên. */
function stockOrientation() {
  const [w, h] = (opts.aspect || "9:16").split(":").map(Number);
  return w < h ? "portrait" : w > h ? "landscape" : "square";
}

/** Tải file kho về thư viện rồi dùng luôn làm hình mở đầu. */
async function takeHookStock(provider, id, kind) {
  if (hookMediaBusy) return;
  hookMediaBusy = true;
  setHookMediaNote("Đang tải về thư viện…");
  try {
    const { path, credit } = await postJson("/api/stock/download", { provider, kind, id });
    flashNote(`Hình mở đầu: ${credit}`);
    pickHookMedia(path);
  } catch (e) {
    setHookMediaNote(e.message, true);
  } finally {
    hookMediaBusy = false;
  }
}

async function uploadHookMedia(file) {
  if (!file) return;
  if (!/^(image|video)\//.test(file.type)) {
    setHookMediaNote(`Bỏ qua ${file.name} — chỉ nhận ảnh hoặc video.`, true);
    return;
  }
  setHookMediaNote(`Đang tải lên ${file.name}…`);
  try {
    const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    pickHookMedia(body.path);
  } catch (e) {
    setHookMediaNote(`Không tải lên được: ${e.message}`, true);
  }
}

(function bindHookMediaDialog() {
  $("hookMediaGo").addEventListener("click", searchHookStock);
  $("hookMediaQuery").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); searchHookStock(); }
  });
  $("hookMediaUpload").addEventListener("click", () => $("hookMediaFile").click());
  $("hookMediaFile").addEventListener("change", (e) => {
    uploadHookMedia(e.target.files[0]);
    e.target.value = "";
  });
  $("hookMediaDlg").querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $("hookMediaDlg").close()));
})();
