// Một màn hình tạo/sửa video kiểu chat. Tuỳ chọn là các chip bấm mở menu,
// thư viện và cài đặt ở thanh nav.

const $ = (id) => document.getElementById(id);

const api = async (path, options) => {
  const res = await fetch(path, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
};

const postJson = (path, data) =>
  api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Bỏ dấu + chữ thường để gõ "ngu" vẫn tìm ra "Ngủ đủ giấc". */
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const matches = (p, q) => !q || fold(p.title).includes(q) || p.slug.includes(q);

/**
 * Bấm Enter hoặc nút Tạo/Chạy: bỏ focus ô đang gõ — bàn phím điện thoại cụp xuống, phím tắt một chữ
 * của app dùng lại được, và không lỡ tay gõ thêm vào ô trong lúc đang tạo.
 */
const blurTyping = () => {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable]")) el.blur();
};

const isVideoFile = (p) => /\.(mp4|mov|webm)(\?|$)/i.test(p);
const ratioCss = (aspect) => (aspect || "9:16").replace(":", " / ");
const isWide = (aspect) => { const [w, h] = (aspect || "9:16").split(":").map(Number); return w / h > 1; };
const CARET = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`;

const IDEAS = [
  "5 mẹo tiết kiệm pin iPhone",
  "Vì sao Nokia sụp đổ?",
  "Cách nấu phở bò tại nhà trong 60 giây",
  "Giới thiệu quán cà phê của tôi từ ảnh tải lên",
];

/** Gợi ý sửa nhanh dưới kết quả — chỉ điền sẵn vào ô nhập, người dùng tự bấm gửi. */
const QUICK_EDITS = [
  { label: `${icon("scissors")} Ngắn hơn`, prompt: "Rút gọn còn khoảng 15 giây, giữ ý chính." },
  { label: `${icon("smile")} Vui hơn`, prompt: "Viết lại với giọng vui, gần gũi hơn." },
  { label: `${icon("repeat")} Phiên bản khác`, prompt: "Làm một phiên bản khác cùng chủ đề, với hook mới." },
];

// Ô nhập nhiều dòng — placeholder kèm luôn một ví dụ để người mới biết gõ gì.
const PLACEHOLDER = {
  new: { video: "Gõ ý tưởng video — ví dụ: 5 mẹo giữ pin iPhone bền lâu", image: "Gõ ý tưởng bộ ảnh — ví dụ: 7 món ăn sáng Hà Nội" },
  edit: { video: "Muốn sửa gì? Ví dụ: ngắn hơn, đổi giọng nữ, thêm nhạc vui…", image: "Muốn sửa gì? Ví dụ: thêm 2 ảnh, đổi màu tươi hơn…" },
};
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const TEXT_PLACEHOLDER = {
  new: "Dán lời video vào đây — mỗi dòng một câu, dòng trống để sang cảnh mới",
  edit: "Dán lời mới vào đây để dựng lại video",
};

const DEFAULT_OPTS = { kind: "video", style: "auto", mode: "ai", aspect: "9:16", voice: "linh", music: "", video: "", provider: "auto", images: "library", art: "auto", length: "auto" };
const AUTO_STYLE = { id: "auto", emoji: "✨", label: "Tự động", summary: "AI đọc nội dung và chọn phong cách hợp nhất." };

// ---------- trạng thái ----------
let state = null;          // /api/state
let aspects = [];
let current = null;        // slug đang mở, null = cuộc mới
let project = null;        // thông tin từ /api/projects của video đang mở
let messages = [];
let pending = [];          // [{ id, name, path|null, url, video }]
let busy = false;
let sending = false;       // đang gọi /api/chat — chặn bấm Gửi lần nữa
let stream = null;
let timer = null;
const opts = { ...DEFAULT_OPTS };
let historyItems = [];
let historyPoll = null;

const styleMeta = (id) => (id === "auto" ? AUTO_STYLE : state?.styles?.find((s) => s.id === id)) ?? AUTO_STYLE;
/** Server báo đã có key của MỘT nhà cung cấp viết kịch bản (Claude, ChatGPT, Gemini, Groq, OpenRouter). */
const hasScriptKey = () => Boolean(state?.keys.script);

// ---------- khởi động ----------
async function boot() {
  [state, { aspects }] = await Promise.all([api("/api/state"), api("/api/aspects")]);
  // Mặc định an toàn: có key Pexels thì tự tìm ảnh — không để video mới ra chỉ có chữ.
  if (state.keys.pexels) DEFAULT_OPTS.images = "pexels";
  Object.assign(opts, DEFAULT_OPTS);

  defaultScript = $("syntaxExample").textContent;
  $("ideas").innerHTML = IDEAS.map((t) => `<button type="button">${escapeHtml(t)}</button>`).join("");
  $("ideas").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => prefill(b.textContent)));
  // Hai thẻ đầu chọn cách có lời (AI viết / dán sẵn); hai thẻ sau là link sang màn khác.
  document.querySelectorAll("[data-start]").forEach((b) =>
    b.addEventListener("click", () => { setOpt("mode", b.dataset.start); $("input").focus(); }));

  bindComposer();
  bindShortcuts();
  bindMenu();
  bindSettings();
  bindHistory();
  bindMulti();
  bindBatch();
  bindSubs();
  bindBili();
  loadHistory();
  renderKeyNotice();
  window.addEventListener("hashchange", route);
  route();
}

function renderKeyNotice() {
  // Chế độ nguyên văn không cần key — chỉ nhắc khi đang ở chế độ AI mà thiếu key.
  $("keyNotice").hidden = hasScriptKey() || opts.mode === "text";
  $("settingsWarn").hidden = hasScriptKey();
}

// ---------- điều hướng ----------
function route() {
  closeMenu();
  closeHistoryDrawer();
  stopBatchPoll();
  // Tiến độ loạt hiện trên tiêu đề tab; rời màn đó thì trả lại tên app.
  document.title = BASE_TITLE;
  renderHistory();
  // Màn Bilibili nằm ở bili.js — các màn khác không biết tới nó, nên ẩn ở đây.
  $("view-bili").hidden = true;
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash === "library") return showLibrary("videos");
  if (hash === "library/media") return showLibrary("media");
  if (hash === "library/trash") return showLibrary("trash");
  if (hash === "subs") return showSubs();
  if (hash === "bili") return showBili();
  if (hash === "batch") return showBatch(null);
  const batchMatch = hash.match(/^batch\/([a-z0-9-]+)$/);
  if (batchMatch) return showBatch(batchMatch[1]);
  if (hash === "multi") return showMulti(null);
  const multiMatch = hash.match(/^multi\/([a-z0-9-]+)$/);
  if (multiMatch) return showMulti(multiMatch[1]);
  const m = hash.match(/^v\/([a-z0-9-]+)$/);
  showChat(m ? m[1] : null);
}

function setNav(which) {
  $("nav-new").classList.toggle("on", which === "new");
  $("nav-lib").classList.toggle("on", which === "lib");
  $("nav-batch").classList.toggle("on", which === "batch");
  $("nav-subs").classList.toggle("on", which === "subs");
  $("nav-bili").classList.toggle("on", which === "bili");
}

async function showChat(slug) {
  $("view-library").hidden = true;
  $("view-multi").hidden = true;
  $("view-batch").hidden = true;
  $("view-subs").hidden = true;
  $("view-chat").hidden = false;
  setNav(slug ? "" : "new");
  stopFollowing();

  flushChatDraft();
  // Ô nhập thuộc về một video: rời video đó (hoặc từ video sang tạo mới) thì dọn ô, lời gõ dở đã được lưu.
  const switching = composerOwner !== (slug ?? null);
  if (switching) {
    if (composerOwner !== null || slug) {
      $("input").value = ""; autosize();
      pending = []; renderPending();
    }
    if (!slug) newDraftSlug = null;
  }
  composerOwner = slug ?? null;
  current = slug;
  project = null;
  messages = [];
  busy = false;
  setHint("");
  // Không tự focus: vào màn nào ô nhập cũng gọn, bấm vào mới mở tuỳ chọn.
  if ($("composerWrap").contains(document.activeElement)) document.activeElement.blur();
  setComposerOpen(false);

  if (!slug) {
    // Chưa có key thì mặc định dán kịch bản — vẫn làm được video ngay.
    Object.assign(opts, DEFAULT_OPTS, { mode: hasScriptKey() ? "ai" : "text" });
    renderProjectBar();
    renderComposer();
    renderThread();
    loadRecent();
    return;
  }

  try {
    const [chat, { projects }] = await Promise.all([api(`/api/chat/${slug}`), api("/api/projects")]);
    if (current !== slug) return;   // đã chuyển trang trong lúc chờ
    messages = chat.messages;
    Object.assign(opts, {
      kind: chat.settings.kind ?? "video",
      style: chat.settings.style ?? "auto",
      mode: chat.settings.mode === "text" || !hasScriptKey() ? "text" : "ai",
      aspect: chat.settings.aspect ?? "9:16",
      voice: chat.settings.voice ?? "",
      music: chat.settings.music ?? "",
      video: chat.settings.video ?? "",
      provider: chat.settings.provider ?? "auto",
      images: chat.settings.images ?? "library",
      art: chat.settings.art ?? "auto",
      length: chat.settings.length ?? "auto",
    });
    project = projects.find((p) => p.slug === slug) ?? null;
    if (switching && chat.draft) restoreChatDraft(chat.draft);
    renderProjectBar();
    renderComposer();
    renderThread();
    if (chat.jobId) follow(chat.jobId, opts.kind);
  } catch (e) {
    setHint(e.message, true);
  }
}

async function showLibrary(tab = "videos") {
  stopFollowing();
  $("view-chat").hidden = true;
  $("view-multi").hidden = true;
  $("view-batch").hidden = true;
  $("view-subs").hidden = true;
  $("view-library").hidden = false;
  setNav("lib");

  // Đổi tab: thoát chế độ chọn, bỏ mọi lựa chọn cũ.
  libTab = tab;
  selecting = false;
  selectedSlugs.clear();
  selectedMedia.clear();
  selectedTrash.clear();
  $("libSelect").hidden = false;
  $("trashEmpty").hidden = true;
  $("libSelectBar").hidden = true;
  document.querySelectorAll("[data-libtab]").forEach((b) => {
    b.classList.toggle("on", b.dataset.libtab === tab);
    b.setAttribute("aria-selected", String(b.dataset.libtab === tab));
  });
  $("grid").hidden = tab !== "videos";
  $("mediaGrid").hidden = tab !== "media";
  $("trashGrid").hidden = tab !== "trash";
  $("libFilter").hidden = tab !== "media";
  $("search").placeholder = { media: "Tìm tài nguyên…", trash: "Tìm trong thùng rác…" }[tab] ?? "Tìm video…";
  $("libSelect").innerHTML = `${icon("square-check")} ${tab === "media" ? "Chọn để dọn" : "Chọn nhiều"}`;

  const target = { media: $("mediaGrid"), trash: $("trashGrid") }[tab] ?? $("grid");
  target.innerHTML = `<p class="empty-lib">Đang tải…</p>`;
  // Số mục trong thùng rác hiện trên tab — cập nhật mỗi lần mở Thư viện.
  if (tab !== "trash") loadTrash().catch(() => {});
  try {
    if (tab === "trash") {
      await loadTrash();
      renderTrash();
    } else if (tab === "media") {
      mediaItems = (await api("/api/library/media")).items;
      renderMedia();
    } else {
      libraryItems = (await api("/api/projects")).projects;
      renderLibrary();
    }
  } catch (e) {
    target.innerHTML = `<p class="empty-lib">Lỗi: ${escapeHtml(e.message)}</p>`;
  }
}

// ---------- thanh tiêu đề video ----------
function renderProjectBar() {
  $("projectBar").hidden = !current;
  if (!current) return;
  const style = styleMeta(project?.style ?? opts.style);
  $("projectTitle").textContent = project?.title ?? messages.find((m) => m.role === "user")?.text ?? current;
  $("projectMeta").textContent =
    `${style.emoji} ${style.label} · ${opts.aspect} · ${opts.kind === "image" ? "Ảnh" : "Video"}`;
  const lastVideo = [...messages].reverse().find((m) => m.mp4)?.mp4;
  $("projectDownload").hidden = !lastVideo;
  $("projectDownload").onclick = () => lastVideo && download(lastVideo);
  $("projectPostCopy").hidden = !lastVideo || busy;
  $("projectPostCopy").onclick = () => openPostCopy(current);
  $("projectMulti").hidden = !project?.multi;
  $("projectMulti").href = `#/multi/${current}`;
  // Trình chỉnh sửa cần props.json — có kết quả (video hoặc ảnh) là có.
  const editable = Boolean(lastVideo) || messages.some((m) => m.images?.length) || Boolean(project?.editable);
  $("projectEdit").hidden = !editable;
  // Không ghi số bản: trình chỉnh sửa tự mở bản mới nhất. Bản cũ mở từ nút "Chỉnh sửa bản n" dưới từng video.
  $("projectEdit").href = `/editor.html#${encodeURIComponent(current)}`;
  $("projectDelete").hidden = busy;
  $("projectDelete").onclick = () => deleteProjects([current]);
}

// ---------- lịch sử ----------
const narrowScreen = () => window.matchMedia("(max-width: 900px)").matches;

function bindHistory() {
  // Trạng thái thu gọn chỉ là tiện ích cho người xem — lỗi storage thì bỏ qua.
  try {
    if (localStorage.getItem("historyCollapsed") === "1") document.body.classList.add("history-collapsed");
  } catch { /* storage bị chặn */ }
  syncHistoryToggle();

  $("historyToggle").addEventListener("click", () => {
    if (narrowScreen()) {
      const open = !document.body.classList.contains("history-open");
      document.body.classList.toggle("history-open", open);
      $("historyBackdrop").hidden = !open;
      if (open) $("historySearch").focus();
    } else {
      const collapsed = document.body.classList.toggle("history-collapsed");
      try { localStorage.setItem("historyCollapsed", collapsed ? "1" : "0"); } catch { /* bỏ qua */ }
    }
    syncHistoryToggle();
  });
  $("historyBackdrop").addEventListener("click", closeHistoryDrawer);
  $("historySearch").addEventListener("input", renderHistory);
  $("historyList").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-del]");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    deleteProjects([btn.dataset.del]);
  });
  window.addEventListener("resize", syncHistoryToggle);
}

function syncHistoryToggle() {
  const visible = narrowScreen()
    ? document.body.classList.contains("history-open")
    : !document.body.classList.contains("history-collapsed");
  $("historyToggle").setAttribute("aria-expanded", String(visible));
}

function closeHistoryDrawer() {
  document.body.classList.remove("history-open");
  $("historyBackdrop").hidden = true;
  syncHistoryToggle();
}

async function loadHistory() {
  clearTimeout(historyPoll);
  try {
    historyItems = (await api("/api/projects")).projects;
    renderHistory();
  } catch { /* giữ danh sách cũ */ }
  // Còn video đang dựng (kể cả ở tab khác) thì hỏi lại để trạng thái tự cập nhật.
  if (historyItems.some((p) => p.status === "running")) {
    historyPoll = setTimeout(loadHistory, 4000);
  }
}

const HISTORY_GROUPS = [
  [0, "Hôm nay"], [1, "Hôm qua"], [7, "7 ngày qua"], [30, "30 ngày qua"], [Infinity, "Cũ hơn"],
];

function historyGroup(time) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysAgo = time >= today ? 0 : Math.ceil((today - time) / 86_400_000);
  return HISTORY_GROUPS.find(([max]) => daysAgo <= max)[1];
}

function historyTime(time) {
  const d = new Date(time);
  return historyGroup(time) === "Hôm nay"
    ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function renderHistory() {
  const list = $("historyList");
  if (!list) return;
  const activeSlug = location.hash.match(/^#\/v\/([a-z0-9-]+)$/)?.[1] ?? null;
  const q = fold($("historySearch").value.trim());
  const items = historyItems.filter((p) => matches(p, q));

  if (items.length === 0) {
    list.innerHTML = `<p class="h-empty">${q ? "Không tìm thấy." : "Chưa có video nào.<br>Bắt đầu bằng nút Tạo mới."}</p>`;
    return;
  }

  let group = "";
  list.innerHTML = items.map((p) => {
    const g = historyGroup(p.updated);
    const heading = g !== group ? `<div class="h-group">${g}</div>` : "";
    group = g;
    const style = styleMeta(p.style);
    const img = p.kind === "image" ? p.cover : p.thumb;
    const status = {
      running: `<span class="h-status running">Đang dựng…</span>`,
      interrupted: `<span class="h-status error">${icon("triangle-alert")} Bị gián đoạn</span> · ${historyTime(p.updated)}`,
      error: `<span class="h-status error">Lỗi</span> · ${historyTime(p.updated)}`,
      draft: `${p.hasDraft || (p.multi && p.edits === 0) ? `${icon("pencil")} Bản nháp` : "Chưa có kết quả"} · ${historyTime(p.updated)}`,
      done: `${style.emoji} ${p.kind === "image" ? `${p.images} ảnh` : "Video"} · ${historyTime(p.updated)}`,
    }[p.status] ?? historyTime(p.updated);
    return `${heading}
      <a class="h-item ${p.slug === activeSlug ? "on" : ""}" href="${p.multi && p.edits === 0 ? `#/multi/${p.slug}` : `#/v/${p.slug}`}"
         ${p.slug === activeSlug ? 'aria-current="page"' : ""} title="${escapeHtml(p.title)}">
        <span class="h-thumb">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" />` : style.emoji}</span>
        <span class="h-text"><b>${escapeHtml(p.title)}</b><small>${status}</small></span>
        ${p.running ? "" : `<button type="button" class="h-del" data-del="${p.slug}" title="Xoá video này" aria-label="Xoá ${escapeHtml(p.title)}">${icon("trash-2")}</button>`}
      </a>`;
  }).join("");
}

// ---------- gần đây & thư viện ----------
let libraryItems = [];

async function loadRecent() {
  try {
    const { projects } = await api("/api/projects");
    if (current) return;
    const recent = projects.slice(0, 4);
    $("recentWrap").hidden = recent.length === 0;
    $("recent").innerHTML = recent.map(projectCard).join("");
    bindCards($("recent"));
  } catch {
    $("recentWrap").hidden = true;
  }
}

function projectCard(p, selectable = false) {
  const style = styleMeta(p.style);
  const picked = selectable && selectedSlugs.has(p.slug);
  let cover = `<div class="none">Chưa có kết quả</div>`;
  if (p.kind === "image" && p.cover) cover = `<img src="${escapeHtml(p.cover)}" alt="" loading="lazy" />`;
  else if (p.thumb) cover = `<img src="${escapeHtml(p.thumb)}" alt="" loading="lazy" />`;
  else if (p.mp4) cover = `<video src="${escapeHtml(p.mp4)}#t=3" muted playsinline preload="metadata"></video>`;
  const badge = `${style.emoji} ${p.kind === "image" ? `${p.images} ảnh` : "Video"} · ${p.aspect}`;
  return `
    <a class="card${selectable ? " selectable" : ""}${picked ? " picked" : ""}${selectable && p.running ? " locked" : ""}"
       href="#/v/${p.slug}" data-slug="${p.slug}"
       ${!selectable && p.kind === "video" && p.mp4 ? `data-video="${escapeHtml(p.mp4)}"` : ""}
       ${selectable ? `role="checkbox" aria-checked="${picked}"` : ""}>
      <div class="thumb">
        ${cover}
        <span class="badge">${escapeHtml(badge)}</span>
        ${p.running ? `<span class="badge live">Đang xử lý…</span>` : ""}
        ${selectable ? `<span class="check" aria-hidden="true">${picked ? icon("check") : ""}</span>` : ""}
      </div>
      <div class="meta">
        <div class="t" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div>
        <div class="m"><span>${new Date(p.updated).toLocaleDateString("vi-VN")}${selectable ? ` · ${fmtBytes(p.bytes)}` : ""}</span>
          ${!selectable && p.kind === "video" && p.mp4 ? `<button type="button" data-dl="${escapeHtml(p.mp4)}">${icon("download")} Tải</button>` : ""}</div>
      </div>
    </a>`;
}

/** Rê chuột lên thẻ video thì phát thử, nút tải không mở trang video. */
function bindCards(container) {
  container.querySelectorAll(".card[data-video]").forEach((card) => {
    const thumb = card.querySelector(".thumb");
    let video = thumb.querySelector("video");
    card.addEventListener("mouseenter", () => {
      if (!video) {
        video = document.createElement("video");
        Object.assign(video, { src: card.dataset.video, muted: true, loop: true, playsInline: true });
        thumb.insertBefore(video, thumb.querySelector(".badge"));
      }
      video.hidden = false;
      video.play().catch(() => {});
    });
    card.addEventListener("mouseleave", () => {
      if (!video) return;
      video.pause();
      if (thumb.querySelector("img")) video.hidden = true;
    });
  });
  container.querySelectorAll("[data-dl]").forEach((b) =>
    b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); download(b.dataset.dl); }));
}

function renderLibrary() {
  const q = fold($("search").value.trim());
  const items = libraryItems.filter((p) => matches(p, q));
  const newCard = q || selecting ? "" : `<a class="card new" href="#/"><div><b>${icon("plus")}</b>Tạo video mới</div></a>`;
  $("grid").innerHTML = newCard + items.map((p) => projectCard(p, selecting)).join("") +
    (q && items.length === 0 ? `<p class="empty-lib">Không tìm thấy video nào.</p>` : "");
  bindCards($("grid"));
  renderSelectBar();
}

function download(url) {
  const a = document.createElement("a");
  a.href = url.split("?")[0];
  a.download = "";
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------- xoá video cũ ----------
let selecting = false;
const selectedSlugs = new Set();

// ---------- thư viện: tab Tài nguyên ----------
let libTab = "videos";     // "videos" | "media"
let mediaItems = [];       // /api/library/media
let mediaFilter = "all";   // all | image | video | audio | voices | unused
const selectedMedia = new Set();
/** Tab Thùng rác, chế độ chọn: id các mục đã chọn. */
const selectedTrash = new Set();

const MEDIA_GROUPS = [
  ["uploads", `${icon("upload")} Tải lên`],
  ["images", `${icon("image")} Ảnh`],
  ["videos", `${icon("film")} Clip video`],
  ["music", `${icon("music")} Nhạc nền`],
  ["sfx", `${icon("volume-2")} Hiệu ứng âm thanh`],
  ["voices", `${icon("mic")} Giọng đọc`],
];

const renderCurrentLib = () => (libTab === "media" ? renderMedia() : libTab === "trash" ? renderTrash() : renderLibrary());

// ---------- thư viện: tab Thùng rác ----------
let trashItems = [];   // /api/trash
let trashDays = 30;

async function loadTrash() {
  const data = await api("/api/trash");
  trashItems = data.items;
  trashDays = data.days;
  $("trashCount").textContent = trashItems.length ? String(trashItems.length) : "";
}

function trashCard(t) {
  const trashIcon = t.kind === "video" ? icon("clapperboard")
    : { image: icon("image"), video: icon("film"), audio: icon("music") }[t.mediaKind] ?? icon("file");
  let cover = "";
  if (t.preview?.video) cover = `<video src="${escapeHtml(t.preview.url)}#t=1" muted playsinline preload="metadata"></video>`;
  else if (t.preview) cover = `<img src="${escapeHtml(t.preview.url)}" alt="" loading="lazy" />`;
  const daysLeft = Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 86_400_000));
  const picked = selecting && selectedTrash.has(t.id);
  return `
    <div class="card trash-card${selecting ? " selectable" : ""}${picked ? " picked" : ""}" data-trash="${escapeHtml(t.id)}"
      ${selecting ? `role="checkbox" aria-checked="${picked}" tabindex="0"` : ""}>
      <div class="thumb">
        <div class="none">${trashIcon}</div>
        ${cover}
        ${selecting ? `<span class="check" aria-hidden="true">${picked ? icon("check") : ""}</span>` : ""}
        <span class="badge">${t.kind === "video" ? `${icon("clapperboard")} Video` : `${trashIcon} Tài nguyên`}</span>
        <span class="badge days${daysLeft <= 3 ? " soon" : ""}" title="Tự xoá sau ${trashDays} ngày">còn ${daysLeft} ngày</span>
      </div>
      <div class="meta">
        <div class="t" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
        <div class="m"><span>Xoá ${new Date(t.deletedAt).toLocaleDateString("vi-VN")} · ${fmtBytes(t.bytes)}</span></div>
        ${t.conflict ? `<span class="m warn" title="Chỗ cũ đã có file khác — khôi phục sẽ bị bỏ qua để không ghi đè">${icon("triangle-alert")} Đã có mục cùng tên</span>` : ""}
        ${selecting ? "" : `<div class="trash-actions">
          <button type="button" class="btn primary" data-restore="${escapeHtml(t.id)}">${icon("undo-2")} Khôi phục</button>
          <button type="button" class="btn danger" data-forever="${escapeHtml(t.id)}" title="Xoá vĩnh viễn" aria-label="Xoá vĩnh viễn ${escapeHtml(t.title)}">${icon("trash-2")}</button>
        </div>`}
      </div>
    </div>`;
}

function visibleTrash() {
  const q = fold($("search").value.trim());
  return trashItems.filter((t) => !q || fold(t.title).includes(q));
}

function renderTrash() {
  const items = visibleTrash();
  // Mục đã khôi phục/xoá ở chỗ khác thì bỏ khỏi lựa chọn.
  for (const id of [...selectedTrash]) if (!trashItems.some((t) => t.id === id)) selectedTrash.delete(id);
  $("trashEmpty").hidden = trashItems.length === 0 || selecting;
  $("libSelect").hidden = selecting || trashItems.length === 0;
  const total = fmtBytes(trashItems.reduce((sum, t) => sum + t.bytes, 0));
  $("trashGrid").innerHTML = trashItems.length === 0
    ? `<p class="empty-lib">${icon("trash-2")} Thùng rác trống.<br>Video và tài nguyên bạn xoá sẽ nằm ở đây ${trashDays} ngày, khôi phục được bất cứ lúc nào.</p>`
    : `<p class="trash-note">${trashItems.length} mục · ${total}. Mục ở đây tự xoá sau ${trashDays} ngày — bấm <b>${icon("undo-2")} Khôi phục</b> để trả về chỗ cũ.</p>` +
      (items.length ? items.map(trashCard).join("") : `<p class="empty-lib">Không có mục nào khớp.</p>`);
  // Ảnh bìa đã bị xoá theo cách khác: bỏ ảnh hỏng, để lộ biểu tượng bên dưới.
  $("trashGrid").querySelectorAll("img").forEach((img) => img.addEventListener("error", () => img.remove(), { once: true }));
  renderSelectBar();
}

/** Thêm/bớt mục trong thùng rác: cập nhật số đếm, lịch sử và tab Thư viện đang mở. */
async function refreshAfterTrashChange() {
  try { await loadTrash(); } catch { /* giữ số cũ */ }
  loadHistory();
  if ($("view-library").hidden) {
    if (!current && !$("view-chat").hidden) loadRecent();
    return;
  }
  try {
    if (libTab === "trash") renderTrash();
    else if (libTab === "media") { mediaItems = (await api("/api/library/media")).items; renderMedia(); }
    else { libraryItems = (await api("/api/projects")).projects; renderLibrary(); }
  } catch { /* giữ danh sách cũ */ }
}

async function restoreTrash(ids) {
  try {
    const result = await postJson("/api/trash/restore", { ids });
    const reasons = [...new Set(result.skipped.map((s) => s.reason))].slice(0, 2).join("; ");
    const skipped = result.skipped.length ? ` · bỏ qua ${result.skipped.length} (${reasons})` : "";
    const one = result.restored.length === 1 ? `“${result.restored[0].title}”` : `${result.restored.length} mục`;
    flashNote(result.restored.length ? `Đã khôi phục ${one}${skipped}.` : `Không khôi phục được${skipped}.`, result.restored.length === 0);
    await refreshAfterTrashChange();
    return result.restored.length > 0;
  } catch (e) {
    flashNote(`Không khôi phục được: ${e.message}`, true);
    return false;
  }
}

/** ids = "all" để dọn sạch. */
async function deleteTrashForever(ids) {
  const picked = ids === "all" ? trashItems : trashItems.filter((t) => ids.includes(t.id));
  if (picked.length === 0) return false;
  const bytes = picked.reduce((sum, t) => sum + t.bytes, 0);
  const ok = await confirmDialog({
    title: ids === "all" ? `Dọn sạch thùng rác (${picked.length} mục)?` : `Xoá vĩnh viễn ${picked.length === 1 ? "mục này" : `${picked.length} mục`}?`,
    message: `${fmtBytes(bytes)} sẽ bị xoá khỏi app, không khôi phục trong Thư viện được nữa. ` +
      "File được chuyển sang Thùng rác của máy — dọn Thùng rác của máy mới thật sự giải phóng dung lượng.",
    items: picked.slice(0, 8).map((t) => t.title).concat(picked.length > 8 ? [`…và ${picked.length - 8} mục khác`] : []),
    okText: ids === "all" ? `${icon("eraser")} Dọn sạch` : `${icon("trash-2")} Xoá vĩnh viễn`,
  });
  if (!ok) return false;
  try {
    const result = await postJson("/api/trash/delete", ids === "all" ? { all: true } : { ids });
    const reasons = [...new Set(result.skipped.map((s) => s.reason))].slice(0, 2).join("; ");
    const skipped = result.skipped.length ? ` · bỏ qua ${result.skipped.length} (${reasons})` : "";
    flashNote(`Đã xoá vĩnh viễn ${result.deleted.length} mục (${fmtBytes(result.freedBytes)})${skipped}.`, result.deleted.length === 0);
    await refreshAfterTrashChange();
    return result.deleted.length > 0;
  } catch (e) {
    flashNote(`Không xoá được: ${e.message}`, true);
    return false;
  }
}

function bindTrash() {
  $("trashEmpty").addEventListener("click", () => deleteTrashForever("all"));
  $("trashGrid").addEventListener("click", (ev) => {
    if (selecting) {
      const card = ev.target.closest(".trash-card[data-trash]");
      if (!card) return;
      const id = card.dataset.trash;
      if (selectedTrash.has(id)) selectedTrash.delete(id); else selectedTrash.add(id);
      renderTrash();
      return;
    }
    const restore = ev.target.closest("[data-restore]");
    if (restore) { restore.disabled = true; restoreTrash([restore.dataset.restore]); return; }
    const forever = ev.target.closest("[data-forever]");
    if (forever) deleteTrashForever([forever.dataset.forever]);
  });
}

function visibleMedia() {
  const q = fold($("search").value.trim());
  return mediaItems.filter((m) => {
    if (q && !fold(m.path).includes(q)) return false;
    if (mediaFilter === "all") return true;
    if (mediaFilter === "unused") return m.usedBy.length === 0;
    if (mediaFilter === "voices") return m.root === "voices";
    return m.kind === mediaFilter && m.root !== "voices";
  });
}

function mediaCard(m) {
  const url = `/public/${m.path.split("/").map(encodeURIComponent).join("/")}`;
  const used = m.usedBy.length;
  const locked = selecting && m.builtIn;
  const picked = selecting && !m.builtIn && selectedMedia.has(m.path);
  let cover = `<div class="none audio">${m.root === "voices" ? icon("mic") : icon("music")}</div>`;
  if (m.kind === "image") cover = `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`;
  else if (m.kind === "video") cover = `<video src="${escapeHtml(url)}#t=1" muted playsinline preload="metadata"></video>`;
  const thumb = `
      <div class="thumb">
        ${cover}
        ${m.builtIn
          ? `<span class="badge builtin">${icon("lock")} Mặc định của app</span>`
          : `<span class="badge ${used ? "used" : "unused"}">${used ? `Dùng trong ${used} video` : "Chưa dùng"}</span>`}
        ${selecting && !m.builtIn ? `<span class="check" aria-hidden="true">${picked ? icon("check") : ""}</span>` : ""}
      </div>`;
  const sub = m.folder !== m.root ? `${m.folder.slice(m.root.length + 1)} · ` : "";
  const users = m.usedBy.map((v) => v.title).join(", ");
  return `
    <div class="card media-card${selecting ? " selectable" : ""}${picked ? " picked" : ""}${locked ? " locked" : ""}"
         data-path="${escapeHtml(m.path)}" title="${escapeHtml(m.path)}"
         ${selecting ? `role="checkbox" aria-checked="${picked}"` : ""}>
      ${selecting ? thumb : `<a class="thumb-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${thumb}</a>`}
      ${m.kind === "audio" && !selecting ? `<audio src="${escapeHtml(url)}" controls preload="none"></audio>` : ""}
      <div class="meta">
        <div class="t">${escapeHtml(m.name)}</div>
        <div class="m"><span>${escapeHtml(sub)}${fmtBytes(m.bytes)}</span></div>
        ${used ? `<span class="m used-by" title="${escapeHtml(users)}">${icon("clapperboard")} ${escapeHtml(users)}</span>` : ""}
      </div>
    </div>`;
}

function renderMedia() {
  $("libFilter").querySelectorAll("[data-mfilter]").forEach((b) => b.classList.toggle("on", b.dataset.mfilter === mediaFilter));
  const items = visibleMedia();
  const groups = MEDIA_GROUPS
    .map(([root, label]) => [label, items.filter((m) => m.root === root)])
    .filter(([, list]) => list.length > 0);
  $("mediaGrid").innerHTML = groups.length === 0
    ? `<p class="empty-lib">${mediaItems.length ? "Không có tài nguyên nào khớp." : "Chưa có tài nguyên nào."}</p>`
    : groups.map(([label, list]) =>
      `<h2 class="media-group">${label} <span>${list.length} file · ${fmtBytes(list.reduce((s, m) => s + m.bytes, 0))}</span></h2>` +
      list.map(mediaCard).join("")).join("");
  renderSelectBar();
}

/**
 * Hộp xác nhận vẽ trong app. KHÔNG dùng window.confirm: trình duyệt nhúng (khung Browser của app,
 * webview) và Chrome sau khi người dùng tick "chặn hộp thoại" trả false ngay lập tức mà không hiện gì —
 * bấm Xoá trông như không có gì xảy ra.
 */
/** okText là HTML (để kèm icon) — chỉ truyền chuỗi cố định, không đưa dữ liệu người dùng vào. */
/** Hỏi một dòng chữ (window.prompt không chạy trong bản desktop). Huỷ hoặc để trống → null. */
function askText({ title, message = "", value = "", placeholder = "", okText = "Lưu" }) {
  const dlg = $("textDlg");
  $("textTitle").textContent = title;
  $("textMessage").textContent = message;
  $("textMessage").hidden = !message;
  $("textInput").value = value;
  $("textInput").placeholder = placeholder;
  $("textOk").innerHTML = okText;
  return new Promise((resolve) => {
    dlg.returnValue = "";
    dlg.addEventListener("close", () => {
      const text = $("textInput").value.trim();
      resolve(dlg.returnValue === "ok" && text ? text : null);
    }, { once: true });
    $("textCancel").onclick = () => dlg.close("cancel");
    // Tự đóng với "ok" khi gửi form (bấm Lưu hoặc Enter) — không trông vào nút submit mặc định của form.
    $("textForm").onsubmit = (e) => { e.preventDefault(); dlg.close("ok"); };
    $("textInput").onkeydown = (e) => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); dlg.close("ok"); }
    };
    dlg.showModal();
    $("textInput").select();
  });
}

function confirmDialog({ title, message, items = [], okText = "Xoá" }) {
  const dlg = $("confirmDlg");
  $("confirmTitle").textContent = title;
  $("confirmMessage").textContent = message;
  $("confirmList").innerHTML = items.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  $("confirmList").hidden = items.length === 0;
  $("confirmOk").innerHTML = okText;
  return new Promise((resolve) => {
    dlg.returnValue = "";
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok"), { once: true });
    dlg.showModal();
    $("confirmOk").focus();
  });
}

/**
 * Hỏi lại rồi xoá hẳn tài nguyên. Có file đang dùng trong video thì cảnh báo rõ video nào bị ảnh
 * hưởng; người dùng vẫn đồng ý thì mới gửi `force` để server xoá cả những file đó.
 */
async function deleteMedia(paths) {
  if (paths.length === 0) return false;
  const picked = mediaItems.filter((m) => paths.includes(m.path));
  const bytes = picked.reduce((sum, m) => sum + m.bytes, 0);
  const inUse = picked.filter((m) => m.usedBy.length > 0);
  const hurt = [...new Set(inUse.flatMap((m) => m.usedBy.map((v) => v.title)))];
  const warning = inUse.length
    ? ` Chú ý: ${inUse.length} file đang dùng trong: ${hurt.slice(0, 4).join(", ")}${hurt.length > 4 ? ` và ${hurt.length - 4} video khác` : ""}. ` +
      "Các video này sẽ thiếu hình/tiếng khi xem trước hoặc dựng lại — bản mp4 đã render thì vẫn giữ nguyên."
    : "";
  const ok = await confirmDialog({
    title: `Chuyển ${picked.length} tài nguyên vào Thùng rác?`,
    message: `${fmtBytes(bytes)} sẽ vào Thư viện › Thùng rác — khôi phục được trong ${trashDays} ngày.${warning}`,
    items: picked.slice(0, 8).map((m) => `${m.path}${m.usedBy.length ? " — đang dùng" : ""}`)
      .concat(picked.length > 8 ? [`…và ${picked.length - 8} file khác`] : []),
    okText: inUse.length ? `${icon("trash-2")} Vẫn chuyển ${picked.length} tài nguyên` : `${icon("trash-2")} Chuyển vào Thùng rác`,
  });
  if (!ok) return false;
  try {
    const result = await postJson("/api/media/delete", { paths, force: inUse.length > 0 });
    const gone = new Set(result.deleted);
    mediaItems = mediaItems.filter((m) => !gone.has(m.path));
    selectedMedia.clear();
    renderMedia();
    const reasons = [...new Set(result.skipped.map((s) => s.reason))].slice(0, 2).join("; ");
    const skipped = result.skipped.length ? ` · giữ lại ${result.skipped.length} (${reasons})` : "";
    flashNote(`Đã chuyển ${result.deleted.length} tài nguyên vào Thùng rác${skipped}.`, result.deleted.length === 0,
      result.trashIds?.length ? { label: "Hoàn tác", onClick: () => restoreTrash(result.trashIds) } : null);
    loadTrash().catch(() => {});
    return result.deleted.length > 0;
  } catch (e) {
    flashNote(`Không xoá được: ${e.message}`, true);
    return false;
  }
}

const fmtBytes = (n) => {
  if (!n) return "0 MB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
};

/** Thông báo nhỏ ở đáy màn hình; `action` = { label, onClick } thêm một nút (vd "Hoàn tác"). */
function flashNote(text, isError = false, action = null) {
  let el = $("flashNote");
  if (!el) {
    el = document.createElement("div");
    el.id = "flashNote";
    el.className = "flash-note";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  const message = document.createElement("span");
  message.textContent = text;
  el.replaceChildren(message);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = action.label;
    button.addEventListener("click", () => { el.hidden = true; action.onClick(); }, { once: true });
    el.append(button);
  }
  el.classList.toggle("err", isError);
  el.hidden = false;
  clearTimeout(el._timer);
  // Có nút thì để lâu hơn cho kịp bấm.
  el._timer = setTimeout(() => { el.hidden = true; }, action ? 8000 : 3500);
}

function setSelecting(on) {
  selecting = on;
  selectedSlugs.clear();
  selectedMedia.clear();
  selectedTrash.clear();
  $("libSelect").hidden = on;
  renderCurrentLib();
}

function renderSelectBar() {
  const bar = $("libSelectBar");
  bar.hidden = !selecting;
  $("libRestore").hidden = libTab !== "trash";
  $("libBulkEdit").hidden = libTab !== "videos";
  if (!selecting) return;
  if (libTab === "trash") {
    const chosen = trashItems.filter((t) => selectedTrash.has(t.id));
    const size = chosen.reduce((sum, t) => sum + t.bytes, 0);
    $("libSelectCount").textContent = chosen.length
      ? `Đã chọn ${chosen.length} mục · ${fmtBytes(size)}`
      : "Bấm vào mục để chọn, hoặc chọn nhanh:";
    $("libRestore").disabled = chosen.length === 0;
    $("libRestore").innerHTML = `${icon("undo-2")} ${chosen.length ? `Khôi phục ${chosen.length} mục` : "Khôi phục"}`;
    $("libDelete").disabled = chosen.length === 0;
    $("libDelete").innerHTML = `${icon("trash-2")} ${chosen.length ? `Xoá vĩnh viễn ${chosen.length} mục` : "Xoá vĩnh viễn"}`;
    return;
  }
  if (libTab === "media") {
    const chosen = mediaItems.filter((m) => selectedMedia.has(m.path));
    const size = chosen.reduce((sum, m) => sum + m.bytes, 0);
    $("libSelectCount").textContent = chosen.length
      ? `Đã chọn ${chosen.length} tài nguyên · ${fmtBytes(size)}`
      : "Bấm vào tài nguyên để chọn, hoặc chọn nhanh (chỉ lấy file chưa dùng):";
    $("libDelete").disabled = chosen.length === 0;
    $("libDelete").innerHTML = `${icon("trash-2")} ${chosen.length ? `Xoá ${chosen.length} tài nguyên` : "Xoá"}`;
    return;
  }
  const picked = libraryItems.filter((p) => selectedSlugs.has(p.slug));
  const bytes = picked.reduce((sum, p) => sum + (p.bytes || 0), 0);
  $("libSelectCount").textContent = picked.length
    ? `Đã chọn ${picked.length} video · ${fmtBytes(bytes)}`
    : "Bấm vào video để chọn, hoặc chọn nhanh:";
  $("libDelete").disabled = picked.length === 0;
  $("libDelete").innerHTML = `${icon("trash-2")} ${picked.length ? `Xoá ${picked.length} video` : "Xoá"}`;
  // Sửa hàng loạt chỉ áp cho video đã dựng (bộ ảnh tĩnh không có nhạc, giọng để đổi).
  const editable = picked.filter((p) => p.kind === "video" && p.editable && !p.running);
  $("libBulkEdit").disabled = editable.length === 0;
  $("libBulkEdit").innerHTML = `${icon("wand-sparkles")} ${editable.length ? `Sửa ${editable.length} video` : "Sửa hàng loạt"}`;
}

/** Chọn nhanh: video không mở/sửa từ N ngày trước (Infinity = tất cả). */
function selectOlderThan(days) {
  const cutoff = Date.now() - days * 86_400_000;
  if (libTab === "trash") {
    // Trong thùng rác, "cũ" tính theo ngày bị xoá.
    selectedTrash.clear();
    visibleTrash()
      .filter((t) => days === Infinity || t.deletedAt < cutoff)
      .forEach((t) => selectedTrash.add(t.id));
    renderTrash();
    if (selectedTrash.size === 0) {
      flashNote(days === Infinity ? "Thùng rác không có mục nào để chọn." : `Không có mục nào bị xoá cách đây hơn ${days} ngày.`);
    }
    return;
  }
  if (libTab === "media") {
    // Chỉ chọn file chưa video nào dùng — file đang dùng server cũng không xoá.
    selectedMedia.clear();
    visibleMedia()
      .filter((m) => !m.builtIn && m.usedBy.length === 0 && (days === Infinity || m.at < cutoff))
      .forEach((m) => selectedMedia.add(m.path));
    renderMedia();
    if (selectedMedia.size === 0) {
      flashNote(days === Infinity ? "Không có tài nguyên chưa dùng nào để chọn." : `Không có tài nguyên chưa dùng nào cũ hơn ${days} ngày.`);
    }
    return;
  }
  selectedSlugs.clear();
  const q = fold($("search").value.trim());
  libraryItems
    .filter((p) => !p.running && matches(p, q) && (days === Infinity || p.updated < cutoff))
    .forEach((p) => selectedSlugs.add(p.slug));
  renderLibrary();
  if (selectedSlugs.size === 0) flashNote(days === Infinity ? "Không có video nào để chọn." : `Không có video nào cũ hơn ${days} ngày.`);
}

function bindLibrarySelect() {
  bindTrash();
  $("libSelect").addEventListener("click", () => setSelecting(true));
  $("libSelectDone").addEventListener("click", () => setSelecting(false));
  $("libSelectBar").querySelectorAll("[data-older]").forEach((b) =>
    b.addEventListener("click", () => selectOlderThan(b.dataset.older === "all" ? Infinity : Number(b.dataset.older))));
  $("libSelectNone").addEventListener("click", () => { selectedSlugs.clear(); selectedMedia.clear(); renderCurrentLib(); });
  $("libBulkEdit").addEventListener("click", () =>
    openBulkEdit(libraryItems.filter((p) => selectedSlugs.has(p.slug) && p.kind === "video" && p.editable && !p.running)));
  $("libDelete").addEventListener("click", async () => {
    const done = libTab === "trash"
      ? await deleteTrashForever([...selectedTrash])
      : libTab === "media"
        ? await deleteMedia([...selectedMedia])
        : await deleteProjects([...selectedSlugs]);
    if (done) setSelecting(false);
  });
  $("libRestore").addEventListener("click", async () => {
    if (libTab !== "trash" || selectedTrash.size === 0) return;
    $("libRestore").disabled = true;
    if (await restoreTrash([...selectedTrash])) setSelecting(false);
    else renderSelectBar();
  });
  document.querySelectorAll("[data-libtab]").forEach((b) =>
    b.addEventListener("click", () => {
      location.hash = { media: "#/library/media", trash: "#/library/trash" }[b.dataset.libtab] ?? "#/library";
    }));
  $("libFilter").querySelectorAll("[data-mfilter]").forEach((b) =>
    b.addEventListener("click", () => { mediaFilter = b.dataset.mfilter; renderMedia(); }));
  // Tab Tài nguyên, chế độ chọn: bấm thẻ là chọn/bỏ chọn. File đang dùng vẫn chọn được —
  // hộp xác nhận sẽ cảnh báo video nào bị ảnh hưởng trước khi xoá.
  $("mediaGrid").addEventListener("click", (ev) => {
    if (!selecting) return;
    const card = ev.target.closest(".media-card[data-path]");
    if (!card) return;
    ev.preventDefault();
    if (card.classList.contains("locked")) {
      flashNote("Nhạc nền và hiệu ứng mặc định của app được khoá, không xoá được.");
      return;
    }
    const p = card.dataset.path;
    if (selectedMedia.has(p)) selectedMedia.delete(p); else selectedMedia.add(p);
    renderMedia();
  });
  // Chế độ chọn: bấm thẻ là chọn/bỏ chọn, không mở video.
  $("grid").addEventListener("click", (ev) => {
    if (!selecting) return;
    const card = ev.target.closest(".card[data-slug]");
    if (!card) return;
    ev.preventDefault();
    if (card.classList.contains("locked")) {
      flashNote("Video đang dựng — đợi xong mới xoá được.");
      return;
    }
    const slug = card.dataset.slug;
    if (selectedSlugs.has(slug)) selectedSlugs.delete(slug); else selectedSlugs.add(slug);
    renderLibrary();
  });
}

/** Hỏi lại rồi xoá hẳn. Trả về true nếu đã xoá. */
async function deleteProjects(slugs) {
  if (slugs.length === 0) return false;
  const known = [...libraryItems, ...historyItems];
  const info = slugs.map((s) => known.find((p) => p.slug === s) ?? { slug: s, title: s, bytes: 0 });
  const bytes = info.reduce((sum, p) => sum + (p.bytes || 0), 0);
  const ok = await confirmDialog({
    title: `Chuyển ${info.length === 1 ? "video này" : `${info.length} video`} vào Thùng rác?`,
    message: `Bản render, ảnh cảnh, giọng đọc và lịch sử chat (${fmtBytes(bytes)}) sẽ vào Thư viện › Thùng rác — ` +
      `khôi phục được trong ${trashDays} ngày. File bạn tải lên vẫn giữ trong thư viện.`,
    items: info.slice(0, 8).map((p) => p.title).concat(info.length > 8 ? [`…và ${info.length - 8} video khác`] : []),
    okText: `${icon("trash-2")} ${info.length === 1 ? "Chuyển vào Thùng rác" : `Chuyển ${info.length} video vào Thùng rác`}`,
  });
  if (!ok) return false;
  try {
    const result = await postJson("/api/projects/delete", { slugs });
    const gone = new Set(result.deleted);
    libraryItems = libraryItems.filter((p) => !gone.has(p.slug));
    historyItems = historyItems.filter((p) => !gone.has(p.slug));
    renderHistory();
    renderLibrary();
    const skipped = result.skipped.length ? ` · bỏ qua ${result.skipped.length} (${result.skipped.map((s) => s.reason).join(", ")})` : "";
    flashNote(`Đã chuyển ${result.deleted.length} video vào Thùng rác${skipped}.`, result.deleted.length === 0,
      result.trashIds?.length ? { label: "Hoàn tác", onClick: () => restoreTrash(result.trashIds) } : null);
    loadTrash().catch(() => {});
    if (current && gone.has(current)) location.hash = "#/";
    else if (!current && $("view-library").hidden) loadRecent();
    return result.deleted.length > 0;
  } catch (e) {
    flashNote(`Không xoá được: ${e.message}`, true);
    return false;
  }
}

// ---------- hội thoại ----------
function renderThread() {
  const empty = messages.length === 0 && !busy;
  $("hero").hidden = !empty;
  $("scroll").hidden = empty;
  $("bottomDock").hidden = empty;
  (empty ? $("heroDock") : $("bottomDock")).appendChild($("composerWrap"));

  const lastBot = messages.map((m, i) => (m.role === "assistant" ? i : -1)).filter((i) => i >= 0).pop();
  $("thread").innerHTML = messages.map((m, i) => renderMessage(m, i === lastBot && !busy)).join("") +
    (busy ? workingCard() : "");
  bindMessageActions();
  updateSend();
  scrollToEnd();
}

function renderMessage(m, isLatest) {
  if (m.role === "user") {
    const atts = (m.attachments ?? []).map((p) => isVideoFile(p)
      ? `<video src="/public/${escapeHtml(p)}" muted playsinline preload="metadata"></video>`
      : `<img src="/public/${escapeHtml(p)}" alt="" />`).join("");
    return `<div class="msg-user">${atts ? `<div class="atts">${atts}</div>` : ""}
      <div class="bubble">${escapeHtml(m.text)}</div></div>`;
  }
  if (m.interrupted) {
    const retry = m.interruptedKind === "multi"
      ? `<a class="btn" href="#/multi/${current}">${icon("clapperboard")} Sửa cảnh và tạo lại</a>`
      : m.interruptedKind === "render"
        ? `<a class="btn" href="/editor.html#${encodeURIComponent(current)}">${icon("scissors")} Mở chỉnh sửa</a>`
        : `<button type="button" class="btn" data-retry>${icon("rotate-cw")} Thử lại</button>`;
    return `<div class="msg-bot error"><div class="text">${icon("triangle-alert")} ${escapeHtml(m.text)}</div>
      ${isLatest ? `<div class="actions">${retry}</div>` : ""}
    </div>`;
  }
  if (m.error) {
    return `<div class="msg-bot error"><div class="text">Không làm được: ${escapeHtml(m.text)}</div>
      ${isLatest ? `<div class="actions"><button type="button" class="btn" data-retry>${icon("rotate-cw")} Thử lại</button>
        ${/API key|Cài đặt/i.test(m.text) ? `<button type="button" class="btn" data-open-settings>${icon("settings")} Mở cài đặt</button>` : ""}</div>` : ""}
    </div>`;
  }
  const scenes = m.scenes?.length
    ? `<details class="script"><summary>Xem kịch bản</summary><ol>${
        m.scenes.map((s) => `<li>${s.lines.map(escapeHtml).join("<br>")}</li>`).join("")}</ol></details>`
    : "";

  let result = "";
  if (m.images?.length) {
    result = `
    <div class="shots ${isWide(m.aspect) ? "wide" : ""}">${m.images.map((src, i) => `
      <div class="shot" style="aspect-ratio:${ratioCss(m.aspect)}">
        <img src="${escapeHtml(src)}" alt="Ảnh ${i + 1}" loading="lazy" data-zoom="${escapeHtml(src)}" />
        <button type="button" data-dl="${escapeHtml(src)}" aria-label="Tải ảnh ${i + 1}">${icon("download")}</button>
      </div>`).join("")}
    </div>
    ${m.images.length > 1 ? `<div class="actions">
      <button type="button" class="btn" data-dl-all="${escapeHtml(m.images.join("|"))}">${icon("download")} Tải cả ${m.images.length} ảnh</button></div>` : ""}`;
  } else if (m.mp4 && m.stale) {
    // Video làm trước khi app lưu riêng từng bản: file đã bị bản sau ghi đè.
    result = `<p class="version-stale">Bản ${m.version ?? ""} · video đã bị bản sau ghi đè (làm trước khi app lưu riêng từng bản).</p>`;
  } else if (m.mp4) {
    // Mỗi kết quả là một bản riêng (server/versions.ts): xem, tải, sửa đúng bản đó.
    const label = m.version
      ? `<div class="version-tag">Bản ${m.version}${m.edited ? ` · chỉnh tay${m.from ? ` từ bản ${m.from}` : ""}` : ""}</div>`
      : "";
    result = `${label}
    <div class="player" style="aspect-ratio:${ratioCss(m.aspect)};width:${playerWidth(m.aspect)}">
      <video src="${escapeHtml(m.mp4)}" controls playsinline preload="metadata"></video>
    </div>
    <div class="actions">
      ${isLatest ? "" : `<button type="button" class="btn" data-dl="${escapeHtml(m.mp4)}">${icon("download")} Tải bản này</button>`}
      ${m.version ? `<a class="btn" href="/editor.html#${encodeURIComponent(current)}/v${m.version}"
        title="Mở đúng bản ${m.version} trong trình chỉnh sửa — xuất ra thành bản mới, bản ${m.version} giữ nguyên">${icon("scissors")} Chỉnh sửa bản ${m.version}</a>` : ""}
    </div>`;
  }
  // Sửa nhanh bằng câu lệnh cần AI — ở chế độ nguyên văn thì không hiện.
  const hasResult = isLatest && (m.mp4 || m.images?.length);
  const aiEdit = opts.mode === "ai" && hasScriptKey();
  const quick = hasResult && aiEdit ? `
    <div class="quick">
      <button type="button" data-quick-style>${icon("palette")} Đổi phong cách</button>
      ${QUICK_EDITS.map((q, i) => `<button type="button" data-quick="${i}">${q.label}</button>`).join("")}
    </div>` : "";
  // Video xong: mời AI viết sẵn nội dung bài đăng.
  const postCopy = isLatest && m.mp4 && hasScriptKey() ? `
    <div class="post-copy-cta">
      <button type="button" class="btn" data-post-copy>${icon("pen-line")} Gợi ý bài đăng</button>
      <span>Tiêu đề, caption, hashtag cho TikTok, YouTube, Facebook, Instagram</span>
    </div>` : "";
  const tip = hasResult
    ? `<p class="result-tip">${aiEdit
      ? "Muốn sửa? Bấm một gợi ý ở trên hoặc gõ yêu cầu vào ô bên dưới."
      : "Muốn sửa? Dán lời mới vào ô bên dưới để dựng lại, hoặc bấm Chỉnh sửa ở thanh trên cùng."}</p>`
    : "";
  return `<div class="msg-bot"><div class="text">${escapeHtml(m.text)}</div>${result}${postCopy}${quick}${tip}${scenes}</div>`;
}

/** Video dọc không nên rộng hết khung chat — sẽ cao quá màn hình. */
function playerWidth(aspect) {
  const [w, h] = (aspect || "9:16").split(":").map(Number);
  return w / h < 1 ? `min(100%, ${Math.round(360 * (w / h) / (9 / 16))}px)` : "100%";
}

const STEPS = {
  video: [["script", "Viết kịch bản"], ["voice", "Giọng đọc"], ["render", "Dựng video"]],
  image: [["script", "Viết kịch bản"], ["render", "Dựng ảnh"]],
};
let progress = { kind: "video", step: "script", percent: 0, last: "Đang bắt đầu…", startedAt: 0 };

const formatElapsed = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function workingCard() {
  const steps = STEPS[progress.kind];
  const idx = steps.findIndex(([id]) => id === progress.step);
  return `<div class="msg-bot"><div class="working">
    <div class="steps">${steps.map(([id, label], i) =>
      `<span class="step ${i < idx ? "done" : i === idx ? "active" : ""}">${label}</span>`).join("")}
      <span class="elapsed" id="elapsed">${formatElapsed(Date.now() - progress.startedAt)}</span></div>
    <div class="progress"><div id="bar" style="width:${progress.step === "render" ? progress.percent : 0}%"></div></div>
    <div class="lastlog" id="lastlog">${escapeHtml(progress.last)}</div>
    <div class="note">Thường mất 1–3 phút. Bạn có thể sang trang khác, việc dựng vẫn chạy tiếp.</div>
  </div></div>`;
}

function bindMessageActions() {
  const thread = $("thread");
  thread.querySelectorAll("[data-dl]").forEach((b) =>
    b.addEventListener("click", () => download(b.dataset.dl)));
  thread.querySelectorAll("[data-dl-all]").forEach((b) =>
    b.addEventListener("click", async () => {
      // Trình duyệt chặn nhiều lượt tải dồn cùng lúc — giãn ra một chút.
      for (const src of b.dataset.dlAll.split("|")) {
        download(src);
        await new Promise((r) => setTimeout(r, 350));
      }
    }));
  thread.querySelectorAll("[data-zoom]").forEach((img) =>
    img.addEventListener("click", () => {
      const box = document.createElement("div");
      box.className = "lightbox";
      box.innerHTML = `<img src="${escapeHtml(img.dataset.zoom)}" alt="" />`;
      box.addEventListener("click", () => box.remove());
      document.body.appendChild(box);
    }));
  thread.querySelectorAll("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => prefill(QUICK_EDITS[Number(b.dataset.quick)].prompt)));
  thread.querySelector("[data-quick-style]")?.addEventListener("click", (e) =>
    openMenu(e.currentTarget, styleMenu((value) => {
      setOpt("style", value);
      prefill(`Đổi sang phong cách ${styleMeta(value).label}.`);
    })));
  thread.querySelector("[data-retry]")?.addEventListener("click", () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) prefill(lastUser.text);
  });
  thread.querySelector("[data-open-settings]")?.addEventListener("click", openSettings);
  thread.querySelector("[data-post-copy]")?.addEventListener("click", () => openPostCopy(current));
}

function scrollToEnd() {
  requestAnimationFrame(() => { $("scroll").scrollTop = $("scroll").scrollHeight; });
}

function prefill(text) {
  const input = $("input");
  input.value = text;
  autosize();
  updateSend();
  schedulePreview();
  syncNormalize();
  input.focus();
  input.setSelectionRange(text.length, text.length);
}

// ---------- gửi & theo dõi ----------
async function send() {
  blurTyping();
  const prompt = $("input").value.trim();
  // sending: chặn bấm/Enter liên tục trong lúc chờ server trả lời — nếu không sẽ tạo trùng nhiều video.
  if (!prompt || busy || sending || pending.some((f) => !f.path)) return;
  if (!(await keyTipsBeforeFirstVideo({ needsScript: opts.mode === "ai" }))) return;
  if (opts.mode === "ai" && !hasScriptKey()) {
    openSettings();
    return;
  }
  setHint("");
  closeMenu();

  // Bản mới nhất có chỉnh tay: AI viết lại từ kịch bản nên phần chỉnh tay không được giữ — báo trước.
  const latestResult = [...messages].reverse().find((m) => m.role === "assistant" && m.mp4 && !m.error);
  if (current && opts.mode === "ai" && latestResult?.edited) {
    const ok = await confirmDialog({
      title: "Sửa bằng AI từ kịch bản?",
      message: `Bản ${latestResult.version ?? "mới nhất"} có chỉnh tay trong trình chỉnh sửa. AI sẽ dựng lại từ kịch bản — ` +
        "phần chỉnh tay (cắt, chữ, crop, phụ đề sửa tay…) không có trong bản mới. Bản cũ vẫn được giữ để xem hoặc sửa tiếp.",
      okText: "Vẫn sửa bằng AI",
    });
    if (!ok) return;
  }

  const attachments = pending.map((f) => f.path);
  sending = true;
  updateSend();
  clearTimeout(chatDraftTimer);
  try {
    await chatDraftSaving;
    const { slug, jobId } = await postJson("/api/chat", {
      // Lời gõ ở màn tạo mới đã thành một video nháp — gửi vào đúng video đó, không tạo thêm.
      slug: current ?? newDraftSlug ?? undefined,
      prompt,
      attachments,
      settings: { ...opts, music: opts.music || null },
    });

    newDraftSlug = null;
    composerOwner = slug;
    messages.push({ role: "user", text: prompt, attachments, at: Date.now() });
    $("input").value = ""; autosize();
    beforeNormalize = null; syncNormalize();
    $("textPreview").hidden = true;
    pending = []; renderPending();

    if (current !== slug) {
      current = slug;
      // Đổi URL mà không kích hoạt route() — nếu không sẽ tải lại và mất tin vừa gửi.
      history.replaceState(null, "", `#/v/${slug}`);
      setNav("");
      renderComposer();
    }
    renderProjectBar();
    follow(jobId, opts.kind);
    loadHistory();
  } catch (e) {
    setHint(e.message, true);
  } finally {
    sending = false;
    updateSend();
  }
}

function follow(jobId, jobKind) {
  stopFollowing();
  busy = true;
  progress = { kind: jobKind === "image" ? "image" : "video", step: "script", percent: 0,
               last: "Đang bắt đầu…", startedAt: Date.now() };
  renderThread();
  timer = setInterval(() => {
    if ($("elapsed")) $("elapsed").textContent = formatElapsed(Date.now() - progress.startedAt);
  }, 1000);

  const slug = current;
  stream = new EventSource(`/api/job/${jobId}`);
  stream.onmessage = async (event) => {
    const { line, status, error } = JSON.parse(event.data);
    if (line === "__END__") {
      stopFollowing();
      if (slug !== current) return;
      try {
        const [chat, { projects }] = await Promise.all([api(`/api/chat/${slug}`), api("/api/projects")]);
        messages = chat.messages;
        project = projects.find((p) => p.slug === slug) ?? project;
      } catch { /* giữ tin nhắn cũ */ }
      busy = false;
      if (status === "error" && !messages.at(-1)?.error) {
        messages.push({ role: "assistant", error: true, text: error ?? "lỗi không rõ" });
      }
      renderProjectBar();
      renderThread();
      loadHistory();
      return;
    }
    if (line === "__DONE__" || line.startsWith("__ERROR__")) return;
    if (line.startsWith("__STEP__")) {
      progress.step = line.split(" ")[1];
      renderThread();
      return;
    }
    if (line.startsWith("__PROGRESS__")) {
      progress.percent = Number(line.split(" ")[1]);
      if (progress.kind === "video") progress.last = `Đang dựng video… ${progress.percent}%`;
    } else {
      progress.last = line;
    }
    if ($("bar")) $("bar").style.width = `${progress.step === "render" ? progress.percent : 0}%`;
    if ($("lastlog")) $("lastlog").textContent = progress.last;
  };
  stream.onerror = () => {
    // Server tắt giữa chừng: EventSource tự nối lại, nhưng job đã mất theo tiến trình.
    if (stream?.readyState === EventSource.CLOSED) { stopFollowing(); busy = false; renderThread(); }
  };
}

function stopFollowing() {
  stream?.close();
  stream = null;
  clearInterval(timer);
  timer = null;
}

// ---------- chip tuỳ chọn ----------
function setOpt(key, value) {
  opts[key] = value;
  renderComposer();
  renderProjectBar();
  // Màn Hàng loạt dùng chung bộ tuỳ chọn này — đang mở thì vẽ lại cho khớp
  // (đổi "Lời" cũng đổi cách đếm dòng và chữ hướng dẫn, không chỉ mỗi chip).
  if (!$("view-batch").hidden && !$("batchNew").hidden) renderBatchNew();
}

function renderComposer() {
  const style = styleMeta(opts.style);
  const voice = state.voices.catalog.find((v) => v.key === opts.voice);
  const textMode = opts.mode === "text";
  // [khoá, nhãn, giá trị đang chọn, tooltip] — mọi tuỳ chọn hiện sẵn, không giấu sau nút nào.
  const chips = [];
  // AI nào viết lời — chỉ hiện khi đang để AI viết.
  if (!textMode) chips.push(["provider", "AI", providerChipLabel(), "Chọn AI viết lời trong số key đã cài", providerIcon(opts.provider)]);
  // Độ dài chỉ có nghĩa khi AI viết lời — lời dán vào thì dài đúng bằng lời đó.
  if (!textMode) chips.push(["length", "Độ dài", lengthChipLabel(), "Độ dài video AI viết. Tự động = theo câu prompt (\"video 5 phút\"), không nêu thì video ngắn", lengthIcon(opts.length)]);
  chips.push(
    ["kind", "Tạo ra", opts.kind === "image" ? "Bộ ảnh" : "Video", "Làm video hay bộ ảnh", kindIcon(opts.kind)],
    ["style", "Phong cách", `${style.emoji} ${style.label}`, "Kiểu hình ảnh và chữ của video"],
    ["aspect", "Khung", `▭ ${opts.aspect}`, "Tỉ lệ khung hình — 9:16 cho TikTok, Reels, Shorts"],
  );
  chips.push(["images", "Hình ảnh", imageChipLabel(), "Hình cho từng cảnh: không hình, ảnh của bạn, Pexels, AI vẽ hay clip video AI", imagesIcon(opts.images, opts.video)]);
  if (aiDraws()) chips.push(["art", "Kiểu vẽ", artChipLabel(), "Kiểu hình AI vẽ: ảnh thật, 3D, 2D, hoạt hình, anime… — ghép với phong cách nào cũng được", artIcon(opts.art)]);
  // Ảnh tĩnh không có tiếng — ẩn giọng và nhạc.
  if (opts.kind === "video") {
    chips.push(["voice", "Giọng", voice ? voice.key : "Không giọng", "Giọng đọc", voiceIcon(voice?.key)]);
    chips.push(["music", "Nhạc", musicLabel(opts.music), "Nhạc nền", musicIcon(opts.music)]);
  }
  $("chips").innerHTML = chips.map(([key, name, label, title, ic]) =>
    `<button type="button" class="chip" data-chip="${key}" title="${title}" aria-haspopup="listbox" aria-expanded="false">` +
    `<span class="chip-k">${name}:</span><span class="chip-v">${ic ? `${ic} ` : ""}${escapeHtml(label)}</span>${CARET}</button>`).join("");
  $("chips").querySelectorAll("[data-chip]").forEach((b) =>
    b.addEventListener("click", () => openMenu(b, menuFor(b.dataset.chip))));
  renderPresets();
  renderPlan();

  document.querySelectorAll("[data-start]").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.start === opts.mode));
  });
  $("ideas").hidden = textMode;
  $("kbdHint").textContent = textMode ? `${IS_MAC ? "⌘" : "Ctrl"}+Enter để gửi` : "Enter để gửi · Shift+Enter xuống dòng";

  // Ví dụ dành cho video mới; đang mở một video thì gửi là sửa video đó nên ẩn đi.
  const example = examplePrompt();
  $("exampleBtn").hidden = Boolean(current) || (!textMode && !example);
  $("exampleBtn").innerHTML = textMode ? `${icon("book-open")} Điền lời mẫu` : `${icon("sparkles")} Điền ví dụ`;
  $("exampleBtn").title = textMode
    ? styleMeta(opts.style).exampleScript
      ? `Điền lời mẫu viết theo đúng kiểu ${style.label}`
      : "Điền một lời mẫu (mỗi lần bấm một phong cách khác)"
    : styleMeta(opts.style).examplePrompt
      ? `Điền ví dụ cho ${style.label}: ${example}`
      : "Điền một ý tưởng mẫu (mỗi lần bấm một chủ đề khác)";

  syncNormalize();

  $("input").placeholder = textMode
    ? TEXT_PLACEHOLDER[current ? "edit" : "new"]
    : PLACEHOLDER[current ? "edit" : "new"][opts.kind];
  $("composer").classList.toggle("text-mode", textMode);
  $("syntaxHelp").hidden = !textMode;
  if (!textMode) {
    $("textPreview").hidden = true;
  } else {
    syncSyntaxExample();
    // Đang để nguyên lời mẫu của phong cách cũ → thay bằng mẫu của phong cách vừa chọn.
    const next = exampleScript();
    if (filledExample && next !== filledExample && $("input").value.trim() === filledExample.trim()) {
      fillExample(next);
    }
    schedulePreview();
  }
  renderKeyNotice();
}

// ---------- xem trước kịch bản dán vào ----------
let previewTimer = null;
let previewSeq = 0;

function schedulePreview() {
  clearTimeout(previewTimer);
  if (opts.mode !== "text") return;
  previewTimer = setTimeout(async () => {
    const text = $("input").value.trim();
    const box = $("textPreview");
    if (!text) { box.hidden = true; return; }
    const seq = ++previewSeq;
    try {
      const p = await postJson("/api/script-preview", { text, style: opts.style });
      if (seq !== previewSeq) return;   // đã gõ tiếp — bỏ kết quả cũ
      const style = styleMeta(p.style);
      box.className = "text-preview ok";
      box.innerHTML = `<b>${icon("check")}</b> «${escapeHtml(p.title)}» · ${p.scenes} cảnh · ${p.lines} câu` +
        (p.punches ? ` · ${p.punches} câu nhấn` : "") + ` · ${style.emoji} ${escapeHtml(style.label)}` +
        (p.notes.length ? `<br>${p.notes.map(escapeHtml).join(" · ")}` : "");
    } catch (e) {
      if (seq !== previewSeq) return;
      box.className = "text-preview err";
      box.textContent = e.message;
    }
    box.hidden = false;
  }, 350);
}

/** Ô độ dài: giá trị gửi lên server (scripts/video-length.ts) → nhãn. */
const LENGTHS = [
  { value: "auto", icon: icon("sparkles"), title: "Tự động", sub: "Theo câu prompt (\"video 5 phút\", \"tầm 90 giây\"). Không nêu thì video ngắn 15–30 giây" },
  { value: "15", icon: icon("timer"), title: "15 giây", sub: "~4 câu · short" },
  { value: "30", icon: icon("timer"), title: "30 giây", sub: "~9 câu · short" },
  { value: "60", icon: icon("timer"), title: "1 phút", sub: "~19 câu" },
  { value: "180", icon: icon("timer"), title: "3 phút", sub: "~60 câu · AI viết theo 3 chương" },
  { value: "300", icon: icon("timer"), title: "5 phút", sub: "~100 câu · AI viết theo 5 chương, render ~6 phút" },
  { value: "600", icon: icon("timer"), title: "10 phút", sub: "~200 câu · AI viết theo 10 chương, render ~11 phút" },
  { value: "free", icon: icon("infinity"), title: "Không giới hạn", sub: "AI lập dàn ý rồi viết đủ ý từng chương, không nhắm số giây nào" },
];

function lengthChipLabel() {
  return LENGTHS.find((l) => l.value === opts.length)?.title ?? "Tự động";
}

/**
 * Icon trước nhãn của từng lựa chọn (chip, ô cài đặt, menu). Tên icon luôn viết cố định —
 * server quét mã nguồn tìm icon("…") để chỉ gửi những icon được dùng.
 */
const lengthIcon = (value) => (value === "free" ? icon("infinity") : !value || value === "auto" ? icon("sparkles") : icon("timer"));
const providerIcon = (id) => (id === "auto" ? icon("sparkles") : icon("bot"));
const kindIcon = (kind) => (kind === "image" ? icon("image") : icon("clapperboard"));
const modeIcon = (mode) => (mode === "text" ? icon("file-text") : icon("bot"));
const voiceIcon = (voice) => (voice && voice !== "none" ? icon("mic") : icon("volume-x"));
const musicIcon = (music) => (music === RANDOM_MUSIC ? icon("dices") : icon("music"));
/** Nguồn hình: có clip video AI thì icon phim, còn lại theo nguồn ảnh tĩnh. */
const imagesIcon = (images, video) => (video ? icon("clapperboard")
  : { none: icon("ban"), pexels: icon("search"), "stock-video": icon("film"), ai: icon("palette") }[images] ?? icon("image"));

const scriptProviders = () => state?.scriptProviders ?? [];

function providerChipLabel(value = opts.provider) {
  if (value === "auto") {
    return state?.keys.scriptLabel ? `Tự động · ${state.keys.scriptLabel}` : "Tự động";
  }
  const provider = scriptProviders().find((p) => p.id === value);
  return provider ? provider.label : "AI";
}

/**
 * Chọn AI viết lời (hoặc AI nghĩ ý tưởng): chỉ những nhà cung cấp đã có key mới bấm được.
 * AI đã có key đứng trước (giữ thứ tự thử của "Tự động"), để mỗi nhóm chỉ có một tiêu đề.
 * `styleNote`: ghi chú về prompt gọn — chỉ có nghĩa khi viết lời (đoán phong cách), không phải khi nghĩ ý tưởng.
 */
function providerMenu(onPick, value = opts.provider, title = "AI viết lời cho video này", styleNote = true) {
  const all = scriptProviders();
  const ready = all.filter((p) => p.available);
  const list = [...ready, ...all.filter((p) => !p.available)];
  return {
    id: "provider", title, value, onPick,
    options: [
      {
        value: "auto",
        icon: icon("sparkles"),
        title: "Tự động",
        // Cài đặt có thể đang ghim một nhà cung cấp — khi đó "Tự động" nghĩa là dùng đúng cái đó.
        sub: state?.keys.scriptSetting !== "auto"
          ? `Theo Cài đặt: chỉ dùng ${state?.keys.scriptLabel ?? "?"}`
          : ready.length === 0
            ? "Chưa có key nào — điền trong Cài đặt"
            : ready.length === 1
              ? `Dùng ${ready[0].label} — key duy nhất đang có`
              : `Dùng ${ready[0].label} trước; hết lượt thì chuyển sang ${ready.slice(1).map((p) => p.label).join(", ")}`,
      },
      ...list.map((p) => ({
        value: p.id,
        group: p.available ? "Đã có key" : state?.freeMode && p.paid ? "Tắt trong chế độ Miễn phí" : "Chưa có key — điền trong Cài đặt",
        icon: icon("bot"),
        title: p.label,
        sub: `${p.model}${styleNote && p.smallPrompt ? " · prompt gọn: phong cách Tự động đoán bằng từ khoá" : ""}`,
        disabled: !p.available,
      })),
    ],
  };
}

const videoModels = () => state?.videoModels ?? [];

/**
 * Ba cách làm nhanh — một cú bấm đặt hình + giọng + nhạc. Bấm xong vẫn sửa từng nút bên dưới được.
 * `ready` cho biết preset có dùng được với key hiện có; không thì làm mờ kèm lý do.
 */
const PRESETS = [
  {
    id: "fast", label: `${icon("zap")} Nhanh`, hint: "chỉ chữ",
    title: "Video chỉ có chữ trên nền màu, giọng máy — miễn phí, nhanh nhất",
    apply: () => ({ images: "none", video: "", voice: "linh", music: "" }),
    ready: () => true,
  },
  {
    id: "photo", label: `${icon("image")} Có ảnh thật`, hint: "miễn phí",
    title: "Tự tìm ảnh thật (Pexels, Pixabay) cho từng cảnh, có giọng đọc và nhạc nền",
    apply: () => ({ images: "pexels", video: "", voice: "linh", music: state?.keys.freesound ? RANDOM_MUSIC : state?.audio.music[0]?.path ?? "" }),
    ready: () => Boolean(state?.keys.pexels),
    why: "Cần key Pexels hoặc Pixabay — lấy miễn phí rồi điền trong Cài đặt",
  },
  {
    id: "stock-clip", label: `${icon("film")} Có clip thật`, hint: "miễn phí",
    title: "Tự tìm clip video thật (Pexels, Pixabay) cho từng cảnh, có giọng đọc và nhạc nền",
    apply: () => ({ images: "stock-video", video: "", voice: "linh", music: state?.keys.freesound ? RANDOM_MUSIC : state?.audio.music[0]?.path ?? "" }),
    ready: () => Boolean(state?.keys.pexels),
    why: "Cần key Pexels hoặc Pixabay — lấy miễn phí rồi điền trong Cài đặt",
  },
  {
    id: "clip", label: `${icon("clapperboard")} Có clip AI`, hint: "tốn phí",
    title: "Mỗi cảnh một clip video do AI tạo — tính tiền theo clip",
    apply: () => ({ images: "library", video: "auto", voice: "linh", music: state?.keys.freesound ? RANDOM_MUSIC : state?.audio.music[0]?.path ?? "" }),
    ready: () => Boolean(state?.videoDefault),
    why: "Cần key tạo video: Gemini đã bật thanh toán, fal.ai hoặc Replicate",
  },
];

/** Preset nào đang khớp với các lựa chọn hiện tại (để tô sáng). */
const currentPreset = () =>
  PRESETS.find((preset) => {
    const want = preset.apply();
    return Object.entries(want).every(([key, value]) => opts[key] === value);
  })?.id ?? null;

function renderPresets() {
  const active = currentPreset();
  $("presets").innerHTML = PRESETS.map((preset) => {
    const ok = preset.ready();
    return `<button type="button" class="preset ${preset.id === active ? "on" : ""}" data-preset="${preset.id}"
      title="${escapeHtml(ok ? preset.title : preset.why)}" ${ok ? "" : "disabled"}>${preset.label} <small>${preset.hint}</small></button>`;
  }).join("");
  $("presets").querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      Object.assign(opts, PRESETS.find((p) => p.id === b.dataset.preset).apply());
      renderComposer();
      renderProjectBar();
      $("input").focus();
    }));
}

/** Một dòng cho biết video sẽ ra thế nào — để lỗi/thiếu hình lộ ra trước khi bấm Tạo. */
function renderPlan() {
  const parts = [];
  const warn = [];
  parts.push(opts.kind === "image" ? "bộ ảnh" : `video ${opts.aspect}`);
  if (opts.mode !== "text" && opts.length && opts.length !== "auto") {
    parts.push(opts.length === "free" ? "dài không giới hạn" : `dài ${lengthChipLabel()}`);
    if (Number(opts.length) >= 180 && opts.video) warn.push("video dài + clip AI = rất nhiều clip tính tiền");
  }
  if (aiDraws() && opts.art && opts.art !== "auto") parts.push(`kiểu vẽ ${artChipLabel()}`);
  if (opts.video) {
    parts.push("clip AI cho từng cảnh");
    warn.push("clip AI tính tiền theo clip");
  } else if (opts.images === "pexels") parts.push("ảnh thật miễn phí (Pexels, Pixabay)");
  else if (opts.images === "stock-video") parts.push("clip thật miễn phí (Pexels, Pixabay)");
  else if (opts.images === "ai") {
    parts.push(state?.keys.flux ? "ảnh do FLUX vẽ (miễn phí)" : "ảnh do AI vẽ");
    if (!state?.keys.flux) warn.push("AI vẽ ảnh tính tiền theo ảnh");
  } else if (opts.images === "none") parts.push("chỉ chữ, không hình");
  else {
    parts.push("ảnh của bạn");
    if (pending.length === 0) {
      warn.push(state?.keys.pexels
        ? "chưa đính kèm ảnh nào — video sẽ chỉ có chữ; chọn Hình ảnh › Ảnh miễn phí hoặc Clip miễn phí để tự lấy hình"
        : "chưa đính kèm ảnh nào — video sẽ chỉ có chữ");
    }
  }
  if (opts.kind === "video") {
    const voice = state?.voices.catalog.find((v) => v.key === opts.voice);
    parts.push(voice ? `giọng ${voice.key}` : "không giọng đọc");
    if (voice && voice.lang !== "vi") warn.push(`giọng ${voice.key} là giọng ${voice.lang === "en" ? "tiếng Anh" : voice.lang}`);
  }
  $("plan").innerHTML = `Sẽ tạo: <b>${escapeHtml(parts.join(" · "))}</b>` +
    (warn.length ? `<br><span class="warn">${icon("triangle-alert")} ${warn.map(escapeHtml).join(" · ")}</span>` : "");
}

const IMAGE_SOURCES = {
  none: "Không hình",
  library: "Ảnh của tôi",
  pexels: "Ảnh miễn phí",
  "stock-video": "Clip miễn phí",
  ai: "AI vẽ ảnh",
};

/** AI tự vẽ hình (ảnh AI hoặc clip AI) — chỉ khi đó mới chọn được kiểu vẽ; ảnh Pexels hay ảnh của bạn thì giữ nguyên. */
const aiDraws = () => Boolean(opts.video) || opts.images === "ai";

const artIcon = (art) => (!art || art === "auto" ? icon("sparkles") : art === "photo" ? icon("camera") : icon("paintbrush"));

function artChipLabel() {
  if (!opts.art || opts.art === "auto") return "Theo phong cách";
  return state?.artStyles?.find((a) => a.id === opts.art)?.label ?? opts.art;
}

/** Kiểu vẽ cho ảnh/clip AI: thắng kiểu ảnh cố định của phong cách (hiệu ứng dựng của phong cách vẫn giữ). */
function artMenu(onPick) {
  const style = styleMeta(opts.style);
  return {
    id: "art", title: "Kiểu vẽ cho ảnh/clip AI", layout: "grid", value: opts.art || "auto", onPick,
    options: [
      {
        value: "auto", icon: icon("sparkles"), title: "Theo phong cách",
        sub: opts.style === "auto" ? "Mỗi phong cách một kiểu — đa số là ảnh chụp thật" : `Kiểu ảnh của ${style.label}`,
      },
      ...(state?.artStyles ?? []).map((a) => ({ value: a.id, icon: artIcon(a.id), title: a.label, sub: a.summary })),
    ],
  };
}

function imageChipLabel() {
  // Chọn clip video AI thì nhãn hiện model đó; còn lại hiện nguồn ảnh tĩnh.
  if (opts.video) {
    if (opts.video === "auto") return "Video AI: tự động";
    const model = videoModels().find((m) => m.key === opts.video);
    return model ? model.label : "Video AI";
  }
  return IMAGE_SOURCES[opts.images] ?? IMAGE_SOURCES.library;
}

/**
 * Một nút cho mọi nguồn hình. Giá trị "video:<model>" là clip AI (ghi vào opts.video),
 * còn lại là nguồn ảnh tĩnh (ghi vào opts.images) — hai thứ loại trừ nhau.
 */
function imageMenu() {
  const models = videoModels();
  const anyVideoKey = models.some((m) => m.available);
  const onPick = (value) => {
    if (value.startsWith("video:")) {
      opts.video = value.slice(6);
      if (opts.images === "none") opts.images = "library";
    } else {
      opts.video = "";
      opts.images = value;
    }
    renderComposer();
    renderProjectBar();
  };
  const current = opts.video ? `video:${opts.video}` : opts.images;
  const videoOptions = opts.kind === "image" ? [] : [
    {
      value: "video:auto", group: "Clip video AI — mỗi cảnh một clip, tính tiền theo clip",
      icon: icon("clapperboard"), title: "Tự động", sub: anyVideoKey ? "Model rẻ nhất có key (đổi trong Cài đặt)"
        : state?.freeMode ? "Tắt trong chế độ Miễn phí" : "Cần key Gemini (đã bật thanh toán), fal.ai hoặc Replicate",
      disabled: !anyVideoKey,
    },
    ...models.map((m) => ({
      value: `video:${m.key}`,
      group: m.providerLabel,
      icon: icon("clapperboard"),
      title: m.label,
      sub: m.available
        ? `${m.durations[0]}–${m.durations.at(-1)}s/clip${m.usdPerSecond ? ` · ~$${m.usdPerSecond}/giây` : ""}`
        : state?.freeMode ? "Tắt trong chế độ Miễn phí" : `Cần ${m.env} — điền trong Cài đặt`,
      disabled: !m.available,
    })),
  ];
  return {
    id: "images", title: "Hình cho từng cảnh", value: current, onPick,
    options: [
      { value: "none", icon: icon("ban"), title: IMAGE_SOURCES.none, sub: "Video chỉ có chữ trên nền màu — miễn phí, nhanh nhất" },
      { value: "library", icon: icon("image"), title: IMAGE_SOURCES.library, sub: "Ảnh/video bạn đính kèm hoặc đã có trong thư viện — miễn phí" },
      {
        value: "pexels", group: "Tự lấy hình cho cảnh chưa có ảnh",
        icon: icon("search"),
        title: IMAGE_SOURCES.pexels,
        sub: state?.keys.pexels
          ? "Ảnh thật từ Pexels, Pixabay — miễn phí, tự ghi nguồn"
          : "Cần key Pexels hoặc Pixabay (miễn phí) — điền trong Cài đặt",
        disabled: !state?.keys.pexels,
      },
      {
        value: "stock-video",
        icon: icon("film"),
        title: IMAGE_SOURCES["stock-video"],
        sub: state?.keys.pexels
          ? "Clip video thật cho từng cảnh từ Pexels, Pixabay — miễn phí, không lặp clip"
          : "Cần key Pexels hoặc Pixabay (miễn phí) — điền trong Cài đặt",
        disabled: !state?.keys.pexels,
      },
      {
        value: "ai",
        icon: icon("palette"),
        title: IMAGE_SOURCES.ai,
        sub: state?.keys.flux
          ? "FLUX vẽ ảnh qua Cloudflare — miễn phí khoảng 100 ảnh/ngày"
          : state?.freeMode
            ? "Gemini vẽ ảnh tính tiền — thêm key Cloudflare để vẽ FLUX miễn phí"
            : state?.keys.gemini
              ? "Gemini vẽ ảnh theo nội dung từng cảnh — tính tiền theo ảnh (thêm key Cloudflare để vẽ miễn phí)"
              : "Cần key Cloudflare (miễn phí) hoặc Gemini — điền trong Cài đặt",
        disabled: !state?.keys.flux && (!state?.keys.gemini || state?.freeMode),
      },
      ...videoOptions,
    ],
  };
}

function styleMenu(onPick) {
  return {
    id: "style", title: "Phong cách hình ảnh", layout: "grid", value: opts.style, onPick,
    options: [AUTO_STYLE, ...state.styles].map((s) => ({
      value: s.id, title: `${s.emoji} ${s.label}`, sub: s.summary,
      hint: s.examplePrompt ? `VD: ${s.examplePrompt}` : "",
    })),
  };
}

// ---------- nút "Prompt mẫu" cạnh nút + ----------
let exampleTurn = 0;   // "Tự động" không có mẫu riêng — mỗi lần bấm lấy mẫu của một phong cách khác

function examplePrompt() {
  const own = styleMeta(opts.style).examplePrompt;
  if (own) return own;
  const all = (state?.styles ?? []).map((s) => s.examplePrompt).filter(Boolean);
  return all.length ? all[exampleTurn % all.length] : "";
}

/** Mẫu tĩnh trong index.html — dùng khi chưa tải xong danh sách phong cách. */
let defaultScript = "";
/** Lời mẫu vừa điền vào ô nhập — đổi phong cách thì đổi mẫu theo, nếu người dùng chưa sửa gì. */
let filledExample = "";

/** Lời mẫu của phong cách đang chọn; "Tự động" thì mỗi lần bấm lấy mẫu của một phong cách khác. */
function exampleScript() {
  const own = styleMeta(opts.style).exampleScript;
  if (own) return own;
  const all = (state?.styles ?? []).map((s) => s.exampleScript).filter(Boolean);
  return all.length ? all[exampleTurn % all.length] : defaultScript;
}

/** Khung "Xem cách viết lời" luôn hiện đúng mẫu của phong cách đang chọn. */
function syncSyntaxExample() {
  $("syntaxExample").textContent = exampleScript();
}

function fillExample(text) {
  filledExample = text;
  prefill(text);
}

function useExample() {
  if (opts.mode === "text") {
    fillExample(exampleScript());
    // "Tự động": bấm lần nữa để xem mẫu của phong cách khác.
    if (!styleMeta(opts.style).exampleScript) { exampleTurn++; syncSyntaxExample(); }
    return;
  }
  const text = examplePrompt();
  if (!text) return;
  prefill(text);
  if (!styleMeta(opts.style).examplePrompt) exampleTurn++;
}

// ---------- chuẩn hoá lời bằng AI ----------
/** Đoạn ngay trước lần chuẩn hoá gần nhất — giữ để bấm "Hoàn tác" lấy lại. */
let beforeNormalize = null;
let normalizing = false;

const providerName = (id) => scriptProviders().find((p) => p.id === id)?.label ?? "AI";

/** Nút chỉ có nghĩa ở chế độ "Lời có sẵn"; thiếu key thì vẫn hiện để biết là có tính năng này. */
function syncNormalize() {
  const textMode = opts.mode === "text";
  const btn = $("normalizeBtn");
  btn.hidden = !textMode;
  $("undoNormalize").hidden = !textMode || beforeNormalize === null;
  if (!textMode) return;
  const empty = !$("input").value.trim();
  const ready = hasScriptKey();
  btn.disabled = normalizing || (empty && ready);
  btn.classList.toggle("working", normalizing);
  btn.innerHTML = normalizing ? `${icon("wand-sparkles")} Đang chuẩn hoá…` : ready ? `${icon("wand-sparkles")} Chuẩn hoá lời` : `${icon("key-round")} Chuẩn hoá lời`;
  btn.title = !ready
    ? "Cần 1 API key viết lời (Gemini, Groq, OpenRouter có gói miễn phí) — bấm để mở Cài đặt"
    : empty
      ? "Dán lời vào ô trên trước đã"
      : `Nhờ ${state?.keys.scriptLabel ?? "AI"} sửa đoạn trên cho đúng mẫu: tiêu đề, chia cảnh, câu ngắn, câu nhấn — không thêm ý mới`;
}

async function normalizeText() {
  if (normalizing) return;
  if (!hasScriptKey()) {
    setHint("Chuẩn hoá lời cần 1 API key viết lời — Gemini, Groq, OpenRouter có gói miễn phí, hoặc chọn Ollama chạy trên máy.", true);
    openSettings();
    return;
  }
  const text = $("input").value.trim();
  if (!text) { setHint("Dán lời vào ô nhập trước đã.", true); return; }

  normalizing = true;
  syncNormalize();
  setHint(`Đang nhờ ${state?.keys.scriptLabel ?? "AI"} chuẩn hoá lời…`);
  try {
    const res = await postJson("/api/script-normalize", { text, style: opts.style, provider: opts.provider });
    if (res.text.trim() === text) {
      setHint("Lời đã đúng mẫu — không phải sửa gì.");
    } else {
      beforeNormalize = $("input").value;
      prefill(res.text);
      const notes = res.notes?.length ? ` · ${res.notes.join(" · ")}` : "";
      setHint(`Đã chuẩn hoá bằng ${providerName(res.provider)} — không ưng thì bấm Hoàn tác.${notes}`);
    }
  } catch (e) {
    setHint(e.message, true);
  } finally {
    normalizing = false;
    syncNormalize();
  }
}

function undoNormalize() {
  if (beforeNormalize === null) return;
  const text = beforeNormalize;
  beforeNormalize = null;
  prefill(text);
  setHint("Đã trả lại đoạn trước khi chuẩn hoá.");
  syncNormalize();
}

/** Nhạc nền "Nhạc ngẫu nhiên": server bốc một bản trên Freesound mỗi lần dựng video (server/chat.ts, resolveMusicChoice). */
const RANDOM_MUSIC = "random";

/** Nhãn hiển thị của một lựa chọn nhạc nền. */
function musicLabel(value) {
  if (!value || value === "none") return "Không nhạc";
  if (value === RANDOM_MUSIC) return "Nhạc ngẫu nhiên";
  const track = state?.audio.music.find((m) => m.path === value);
  return track ? track.name.replace(/\.\w+$/, "") : value;
}

/** Lựa chọn "Nhạc ngẫu nhiên" — chỉ hiện khi đã có key Freesound. */
function randomMusicOption() {
  return state?.keys.freesound
    ? [{ value: RANDOM_MUSIC, icon: icon("dices"), title: "Nhạc ngẫu nhiên", sub: "Mỗi lần dựng bốc một bản nhạc nền khác trên Freesound (CC0/CC-BY, tự ghi nguồn)" }]
    : [];
}

function menuFor(key) {
  const pick = (value) => setOpt(key, value);
  if (key === "style") return styleMenu(pick);
  if (key === "images") return imageMenu();
  if (key === "art") return artMenu(pick);
  if (key === "provider") return providerMenu(pick);
  if (key === "length") {
    return {
      id: "length", title: "Độ dài video — ô này thắng độ dài ghi trong prompt", value: opts.length, onPick: pick,
      options: LENGTHS,
    };
  }
  if (key === "mode") {
    return {
      id: "mode", title: "Lời video lấy từ đâu", value: opts.mode,
      onPick: (value) => { setOpt("mode", value); $("input").focus(); },
      options: [
        {
          value: "ai", icon: icon("bot"), title: "AI viết lời",
          sub: hasScriptKey()
            ? `Gõ yêu cầu, ${state.keys.scriptLabel ?? "AI"} viết lại nội dung.`
            : "Cần thêm 1 API key (Gemini, Groq, OpenRouter có gói miễn phí)",
        },
        { value: "text", icon: icon("file-text"), title: "Lời có sẵn", sub: "Dán kịch bản của bạn, dựng đúng từng câu. Không cần API key." },
      ],
    };
  }
  if (key === "kind") {
    return {
      id: "kind", title: "Tạo ra", value: opts.kind, onPick: pick,
      options: [
        { value: "video", icon: icon("clapperboard"), title: "Video", sub: "Có giọng đọc và nhạc, xuất file mp4" },
        { value: "image", icon: icon("image"), title: "Bộ ảnh", sub: "Mỗi cảnh một ảnh PNG, hợp làm carousel" },
      ],
    };
  }
  if (key === "aspect") {
    return {
      id: "aspect", title: "Tỉ lệ khung hình", value: opts.aspect, onPick: pick,
      options: aspects.map((a) => ({
        value: a.id, title: a.id, sub: `${a.label.split("—")[1]?.trim() ?? ""} · ${a.width}×${a.height}`,
      })),
    };
  }
  if (key === "voice") {
    const langs = { vi: "Tiếng Việt", en: "Tiếng Anh" };
    return {
      id: "voice", title: "Giọng đọc", value: opts.voice, onPick: pick,
      options: [
        { value: "", icon: icon("volume-x"), title: "Không giọng", sub: "Chỉ có chữ, thời lượng tính theo độ dài câu" },
        ...state.voices.catalog.map((v) => ({
          value: v.key, group: langs[v.lang] ?? v.lang,
          icon: icon("mic"),
          title: v.key,
          sub: `${v.label.split("—")[1]?.trim() ?? ""} · ${v.engineLabel}${v.paidPlan ? " · cần gói trả phí" : ""}`,
          disabled: v.paidPlan,
          preview: v.key,
        })),
      ],
    };
  }
  return {
    id: "music", title: "Nhạc nền", value: opts.music, onPick: pick,
    options: [
      { value: "", title: "Không nhạc" },
      ...randomMusicOption(),
      ...state.audio.music.map((m) => ({ value: m.path, icon: icon("music"), title: m.name.replace(/\.\w+$/, "") })),
    ],
  };
}

// ---------- phím tắt ----------
const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";
const ALT_KEY = IS_MAC ? "⌥" : "Alt";
const SHORTCUTS = [
  ["Đi tới", [
    [[ALT_KEY, "N"], "Tạo video mới"],
    [[ALT_KEY, "M"], "Tạo video từng cảnh"],
    [[ALT_KEY, "B"], "Làm nhiều video một lượt"],
    [[ALT_KEY, "C"], "Trình chỉnh sửa (video đang mở, hoặc dự án mới)"],
    [[ALT_KEY, "L"], "Thư viện"],
    [[MOD_KEY, ","], "Cài đặt API key"],
  ]],
  ["Tạo & sửa", [
    [["/"], "Đưa con trỏ vào ô nhập / ô tìm"],
    [["Enter"], "Gửi (chế độ AI viết lời)"],
    [[MOD_KEY, "Enter"], "Gửi (chế độ lời có sẵn)"],
    [["↑"], "Ô nhập trống: điền lại tin vừa gửi"],
    [[ALT_KEY, "U"], "Thêm ảnh / video"],
    [[ALT_KEY, "D"], "Tải video đang mở"],
    [["Esc"], "Thoát ô nhập, đóng menu"],
  ]],
  ["Lịch sử & thư viện", [
    [[MOD_KEY, "K"], "Tìm trong lịch sử"],
    [[MOD_KEY, "B"], "Ẩn / hiện lịch sử"],
    [["Delete"], "Xoá các mục đã chọn (khi đang chọn để xoá)"],
    [["Esc"], "Thoát chế độ chọn"],
  ]],
  ["Chung", [
    [["?"], "Mở bảng phím tắt"],
    [[MOD_KEY, "/"], "Mở bảng phím tắt"],
  ]],
];

function toggleShortcuts() {
  const dlg = $("keysDlg");
  if (dlg.open) { dlg.close(); return; }
  closeMenu();
  $("keysList").innerHTML = SHORTCUTS.map(([group, items]) => `<section><h3>${group}</h3><ul>${
    items.map(([keys, label]) => `<li><span>${keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join("")}</span>${escapeHtml(label)}</li>`).join("")
  }</ul></section>`).join("");
  dlg.showModal();
}

function focusHistorySearch() {
  const hidden = narrowScreen()
    ? !document.body.classList.contains("history-open")
    : document.body.classList.contains("history-collapsed");
  if (hidden) $("historyToggle").click();
  $("historySearch").focus();
  $("historySearch").select();
}

function bindShortcuts() {
  $("openShortcuts").addEventListener("click", toggleShortcuts);
  // Menu Trợ giúp › Phím tắt của app desktop gửi sự kiện này vào trang.
  window.addEventListener("app:shortcuts", () => { if (!$("keysDlg").open) toggleShortcuts(); });

  document.addEventListener("keydown", (e) => {
    if (e.isComposing || e.defaultPrevented) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    // Tổ hợp ⌘/Ctrl: chạy cả khi đang gõ. Tránh ⌘N/T/W/L — trình duyệt không cho trang giành.
    if (mod && !e.altKey && !e.shiftKey) {
      const global = { ",": openSettings, "/": toggleShortcuts, k: focusHistorySearch, b: () => $("historyToggle").click() };
      if (global[key]) { e.preventDefault(); global[key](); return; }
    }
    if (document.querySelector("dialog[open]")) return;

    // Alt/Option + chữ: dùng e.code vì Option+chữ trên macOS ra ký tự đặc biệt.
    if (e.altKey && !mod && !e.shiftKey) {
      const chatOpen = !$("view-chat").hidden;
      const actions = {
        KeyN: () => { location.hash = "#/"; },
        KeyM: () => { location.hash = "#/multi"; },
        KeyB: () => { location.hash = "#/batch"; },
        KeyL: () => { location.hash = "#/library"; },
        KeyC: () => { location.href = current && chatOpen && !$("projectEdit").hidden ? $("projectEdit").href : "/editor.html#new"; },
        KeyD: chatOpen && !$("projectDownload").hidden ? () => $("projectDownload").click() : null,
        KeyU: chatOpen ? () => $("fileInput").click() : null,
      };
      if (actions[e.code]) { e.preventDefault(); actions[e.code](); }
      return;
    }

    const typing = e.target.closest?.("input, textarea, select, [contenteditable='true']");
    if (typing) {
      if (e.key === "Escape" && $("menu").hidden) e.target.blur();
      return;
    }
    if (mod) return;

    if (e.key === "?") { e.preventDefault(); toggleShortcuts(); }
    else if (e.key === "/") {
      e.preventDefault();
      const target = !$("view-library").hidden ? $("search")
        : !$("view-chat").hidden ? $("input")
        : !$("view-batch").hidden ? $("batchText")
        : $("multiTitle");
      target.focus();
    } else if (!$("view-library").hidden && selecting) {
      if (e.key === "Escape") { e.preventDefault(); setSelecting(false); }
      else if ((e.key === "Delete" || e.key === "Backspace") && !$("libDelete").disabled) { e.preventDefault(); $("libDelete").click(); }
    }
  });
}

// ---------- menu dùng chung ----------
let menuAnchor = null;
/** Menu đang mở — nút nghe thử giọng chọn luôn giọng qua onPick của nó. */
let menuOpen = null;

// ---------- nghe thử giọng ----------
/**
 * Nút ▶ nghe thử một giọng — dùng trong menu chọn giọng (trang chính, Hàng loạt). Bấm lần đầu thì server đọc
 * một câu mẫu (POST /api/voice/sample, giọng trong app lần đầu mất vài giây), lần sau phát ngay.
 * Một trình phát cho cả trang: bấm giọng khác thì dừng giọng đang phát, bấm lại chính nó thì dừng.
 */
const voicePreviewButton = (key, name) => {
  const label = voicePlayLabel(key, name);
  return `<button type="button" class="voice-play${voicePreviewCost(key) ? " costs" : ""}" data-voice-play="${escapeHtml(key)}"
    data-voice-name="${escapeHtml(name)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${voicePlayFace(key)}</button>`;
};

const voicePlayLabel = (key, name) => {
  const note = voicePreviewCost(key);
  return `Nghe thử giọng ${name}${note ? ` — lần đầu gọi ${note}, tốn 1 lượt; nghe lại sau đó miễn phí` : ""}`;
};

/** Giọng trên mạng (Gemini, ElevenLabs) chưa có câu mẫu trong bộ nhớ → tên dịch vụ sẽ bị gọi; còn lại null (miễn phí). */
const voicePreviewCost = (key) => {
  const v = state?.voices.catalog.find((x) => x.key === key);
  return v?.online && !v.sampled ? v.engineLabel : null;
};

/** Mặt nút lúc nghỉ: ▶, kèm "tốn 1 lượt" nếu lần nghe này sẽ gọi dịch vụ trên mạng. */
const voicePlayFace = (key) => `${icon("play")}${voicePreviewCost(key) ? `<span>tốn 1 lượt</span>` : ""}`;

let voicePreview = { key: null, audio: null, button: null, token: 0 };

function paintVoiceButton(button, mode) {
  if (!button) return;
  const key = button.dataset.voicePlay;
  button.classList.toggle("busy", mode === "loading");
  button.classList.toggle("playing", mode === "playing");
  button.classList.toggle("costs", mode === "idle" && Boolean(voicePreviewCost(key)));
  button.innerHTML = mode === "loading" ? icon("loader-circle", "spin") : mode === "playing" ? icon("square") : voicePlayFace(key);
  const label = mode === "idle" ? voicePlayLabel(key, button.dataset.voiceName ?? key) : "Dừng nghe thử";
  button.title = label;
  button.setAttribute("aria-label", label);
}

function stopVoicePreview() {
  voicePreview.token += 1;
  voicePreview.audio?.pause();
  paintVoiceButton(voicePreview.button, "idle");
  voicePreview = { key: null, audio: null, button: null, token: voicePreview.token };
}

async function toggleVoicePreview(button) {
  const key = button.dataset.voicePlay;
  const again = voicePreview.key === key;
  stopVoicePreview();
  if (again) return;
  const token = voicePreview.token;
  voicePreview = { key, audio: null, button, token };
  paintVoiceButton(button, "loading");
  try {
    const { url } = await postJson("/api/voice/sample", { voice: key });
    // Đã có câu mẫu trong bộ nhớ: mọi nút của giọng này thôi ghi "tốn 1 lượt".
    const entry = state.voices.catalog.find((v) => v.key === key);
    if (entry && !entry.sampled) {
      entry.sampled = true;
      document.querySelectorAll(`[data-voice-play="${CSS.escape(key)}"]`).forEach((b) => {
        if (b !== button) paintVoiceButton(b, "idle");
      });
    }
    if (voicePreview.token !== token) return; // đã bấm giọng khác trong lúc chờ
    const audio = new Audio(url);
    voicePreview.audio = audio;
    audio.addEventListener("ended", () => { if (voicePreview.token === token) stopVoicePreview(); });
    await audio.play();
    paintVoiceButton(button, "playing");
  } catch (e) {
    if (voicePreview.token !== token) return;
    stopVoicePreview();
    // "not found": server bật từ trước khi có tính năng này — server không tự nạp code mới.
    flashNote(e.message === "not found"
      ? "Server đang chạy bản cũ chưa có nghe thử giọng — tắt rồi mở lại app (hoặc chạy lại npm start)."
      : `Không nghe thử được giọng ${key}: ${e.message}`, true);
  }
}

// Bắt ở document: nút nằm trong menu vẽ lại bằng innerHTML. stopPropagation để menu không đóng.
document.addEventListener("click", (e) => {
  const button = e.target.closest?.("[data-voice-play]");
  if (!button) return;
  e.preventDefault();
  e.stopPropagation();
  toggleVoicePreview(button);
  // Nghe thử giọng nào thì chọn luôn giọng đó, menu vẫn mở để nghe tiếp giọng khác. Trước đây nghe thử không chọn:
  // người dùng nghe Anh Khôi rồi đóng menu, tưởng đã chọn, video vẫn đọc bằng giọng cũ.
  const row = button.closest(".opt-wrap")?.querySelector(".opt[data-value]");
  if (!row || row.disabled || !menuOpen || row.dataset.value === menuOpen.value) return;
  menuOpen.value = row.dataset.value;
  $("menu").querySelectorAll(".opt").forEach((o) => {
    o.classList.toggle("on", o === row);
    o.setAttribute("aria-selected", String(o === row));
  });
  menuOpen.onPick(row.dataset.value);
}, true);

function openMenu(anchor, menu) {
  const el = $("menu");
  if (!el.hidden && menuAnchor === anchor) { closeMenu(); return; }
  closeMenu();
  menuAnchor = anchor;
  menuOpen = menu;
  anchor.setAttribute("aria-expanded", "true");

  let group = null;
  el.className = `menu ${menu.layout ?? "list"}`;
  el.setAttribute("aria-label", menu.title);
  el.innerHTML = `<div class="menu-title">${escapeHtml(menu.title)}</div>` + menu.options.map((o) => {
    const heading = o.group && o.group !== group ? `<div class="menu-group">${escapeHtml(o.group)}</div>` : "";
    group = o.group ?? group;
    const on = o.value === menu.value;
    const opt = `<button type="button" class="opt ${on ? "on" : ""}" role="option" aria-selected="${on}"
      data-value="${escapeHtml(o.value)}" ${o.disabled ? "disabled" : ""}>
      <b>${o.icon ? `${o.icon} ` : ""}${escapeHtml(o.title)}</b>${o.sub ? `<span>${escapeHtml(o.sub)}</span>` : ""}${
      o.hint ? `<i class="opt-hint">${escapeHtml(o.hint)}</i>` : ""}</button>`;
    // o.preview: mã giọng — thêm nút nghe thử cạnh dòng (bấm là nghe và chọn luôn giọng đó, không đóng menu).
    return heading + (o.preview && !o.disabled ? `<div class="opt-wrap">${opt}${voicePreviewButton(o.preview, o.title)}</div>` : opt);
  }).join("");
  el.hidden = false;
  el.querySelectorAll(".opt").forEach((b) =>
    b.addEventListener("click", () => { stopVoicePreview(); closeMenu(); menu.onPick(b.dataset.value); }));

  positionMenu(el, anchor, menu.layout === "grid" ? 720 : 340, menu.layout === "grid");
  (el.querySelector(".opt.on:not(:disabled)") ?? el.querySelector(".opt:not(:disabled)"))?.focus({ preventScroll: true });
}

/** Ưu tiên mở phía trên nút, thiếu chỗ thì mở xuống, cả hai thiếu thì bám mép trên và cuộn. */
function positionMenu(el, anchor, maxWidth, tall = false) {
  const gap = 8, margin = 12;
  const vw = window.innerWidth, vh = window.innerHeight;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(maxWidth, vw - margin * 2);
  el.style.width = `${width}px`;
  el.style.maxHeight = "";
  el.style.left = `${Math.max(margin, Math.min(rect.left, vw - width - margin))}px`;
  const height = el.scrollHeight;
  const above = rect.top - gap - margin;
  const below = vh - rect.bottom - gap - margin;
  if (height <= above) el.style.top = `${rect.top - gap - height}px`;
  else if (height <= below) el.style.top = `${rect.bottom + gap}px`;
  // Menu lưới dài (phong cách): dùng gần hết chiều cao màn hình, được đè lên nút,
  // thay vì nhét vào khe hẹp trên/dưới nút rồi phải cuộn mãi.
  else if (tall) { el.style.top = `${margin}px`; el.style.maxHeight = `${vh - margin * 2}px`; }
  else if (above >= below) { el.style.top = `${margin}px`; el.style.maxHeight = `${rect.top - gap - margin}px`; }
  else { el.style.top = `${rect.bottom + gap}px`; el.style.maxHeight = `${below}px`; }
}

function closeMenu() {
  if (!$("menu").hidden) stopVoicePreview();
  $("menu").hidden = true;
  menuAnchor?.setAttribute("aria-expanded", "false");
  menuAnchor = null;
  menuOpen = null;
}

function bindMenu() {
  document.addEventListener("click", (e) => {
    if (!$("menu").hidden && !e.target.closest("#menu") && e.target.closest("button") !== menuAnchor) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if ($("menu").hidden) return;
    if (e.key === "Escape") { const a = menuAnchor; closeMenu(); a?.focus(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...$("menu").querySelectorAll(".opt:not(:disabled)")];
      const i = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      items[next]?.focus();
    }
  });
  // Menu định vị cố định — cuộn hay đổi kích thước thì đóng cho khỏi lệch nút.
  window.addEventListener("resize", closeMenu);
  $("scroll").addEventListener("scroll", closeMenu);
  $("hero").addEventListener("scroll", closeMenu);
}

// ---------- ô nhập & đính kèm ----------
/** Ô nhập thu gọn khi không dùng: chỉ ô chữ + nút gửi. Focus vào thì mở phong cách, giọng, nhạc… */
function setComposerOpen(open) {
  const wrap = $("composerWrap");
  if (wrap.classList.contains("collapsed") !== open) return;
  wrap.classList.toggle("collapsed", !open);
  // Thu gọn: nút gửi nằm cạnh ô chữ. Mở rộng: xuống cuối, sau các tuỳ chọn — đọc từ trên xuống là tới nút Tạo.
  (open ? $("composerFoot") : $("composerMain")).appendChild($("send"));
  if (open) autosize();
  else closeMenu();
}

function bindComposerCollapse() {
  const wrap = $("composerWrap");
  // Các phần nằm ngoài ô nhưng vẫn thuộc về nó: menu của chip, hộp thoại (Cài đặt mở từ ô nhập).
  const belongs = (el) => wrap.contains(el) || el.closest?.("#menu, dialog, .lightbox");
  document.addEventListener("focusin", (e) => {
    // Nút gửi: mở rộng ngay lúc nhấn chuột sẽ làm nút dịch chỗ và cú bấm trượt mất.
    if (e.target.id !== "send") setComposerOpen(belongs(e.target));
  });
  $("input").addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("menu").hidden) setComposerOpen(false);
  });
  document.addEventListener("pointerdown", (e) => {
    if (belongs(e.target)) return;
    // Đang có file chờ tải lên hay đang gửi thì vẫn thu được — nút gửi luôn hiện.
    setComposerOpen(false);
  });
  // Bấm vào vùng trống của ô thu gọn cũng mở và đặt con trỏ vào ô chữ.
  $("composer").addEventListener("pointerdown", (e) => {
    if (!wrap.classList.contains("collapsed") || e.target.closest("button, textarea")) return;
    e.preventDefault();
    $("input").focus();
  });
}

function bindComposer() {
  bindComposerCollapse();
  const input = $("input");
  input.addEventListener("input", () => { autosize(); updateSend(); schedulePreview(); syncNormalize(); scheduleChatDraft(); });
  input.addEventListener("keydown", (e) => {
    // Ô trống + ↑: điền lại tin vừa gửi để sửa rồi gửi lại, như các app chat.
    if (e.key === "ArrowUp" && !e.isComposing && !input.value) {
      const last = [...messages].reverse().find((m) => m.role === "user");
      if (last) { e.preventDefault(); prefill(last.text); }
      return;
    }
    if (e.key !== "Enter" || e.isComposing) return;
    // Kịch bản nhiều dòng: Enter xuống dòng, ⌘/Ctrl+Enter mới gửi. Chế độ AI: Enter gửi.
    const sendNow = opts.mode === "text" ? e.metaKey || e.ctrlKey : !e.shiftKey;
    if (sendNow) { e.preventDefault(); send(); }
  });
  $("useExample").addEventListener("click", () => fillExample($("syntaxExample").textContent));
  $("composer").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  $("noticeSettings").addEventListener("click", openSettings);
  $("noticeText").addEventListener("click", () => { setOpt("mode", "text"); $("input").focus(); });

  $("attachBtn").addEventListener("click", () => $("fileInput").click());
  $("exampleBtn").addEventListener("click", useExample);
  $("normalizeBtn").addEventListener("click", normalizeText);
  $("undoNormalize").addEventListener("click", undoNormalize);
  $("fileInput").addEventListener("change", () => {
    addFiles([...$("fileInput").files]);
    $("fileInput").value = "";
  });

  input.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });

  // Kéo thả file vào bất kỳ đâu trong màn hình tạo video.
  const chat = $("view-chat");
  chat.addEventListener("dragover", (e) => { e.preventDefault(); $("composer").classList.add("drag"); });
  chat.addEventListener("dragleave", (e) => {
    if (!chat.contains(e.relatedTarget)) $("composer").classList.remove("drag");
  });
  chat.addEventListener("drop", (e) => {
    e.preventDefault();
    $("composer").classList.remove("drag");
    addFiles([...(e.dataTransfer?.files ?? [])]);
  });

  $("search").addEventListener("input", renderCurrentLib);
  bindLibrarySelect();
}

function addFiles(files) {
  for (const file of files) {
    if (!/^(image|video)\//.test(file.type)) {
      setHint(`Bỏ qua ${file.name} — chỉ nhận ảnh hoặc video.`, true);
      continue;
    }
    const item = {
      id: Math.random().toString(36).slice(2),
      name: file.name, path: null,
      url: URL.createObjectURL(file),
      video: file.type.startsWith("video/"),
    };
    pending.push(item);
    upload(file, item);
  }
  renderPending();
}

async function upload(file, item) {
  try {
    const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    item.path = body.path;
    scheduleChatDraft();
  } catch (e) {
    pending = pending.filter((f) => f !== item);
    setHint(`Không tải lên được ${file.name}: ${e.message}`, true);
  }
  renderPending();
}

function renderPending() {
  $("pending").innerHTML = pending.map((f) => `
    <div class="chip-file ${f.path ? "" : "loading"}" title="${escapeHtml(f.name)}">
      ${f.video ? `<video src="${f.url}" muted></video><span class="tag">video</span>` : `<img src="${f.url}" alt="" />`}
      <button type="button" data-rm="${f.id}" aria-label="Bỏ ${escapeHtml(f.name)}">${icon("x")}</button>
    </div>`).join("");
  renderPlan();
  $("pending").querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      pending = pending.filter((f) => f.id !== b.dataset.rm);
      renderPending();
      scheduleChatDraft();
    }));
  updateSend();
}

// ---------- bản nháp: lời gõ dở và danh sách cảnh được lưu lên server ----------
// Mất điện, tắt app hay mất kết nối vẫn còn — hiện trong lịch sử là "Bản nháp".

/** Video mà ô nhập đang thuộc về: slug, hoặc null = màn tạo mới. */
let composerOwner = null;
/** Màn tạo mới: video nháp server đã tạo cho lời đang gõ. */
let newDraftSlug = null;
let chatDraftTimer = null;
let chatDraftSaving = Promise.resolve();
const DRAFT_DELAY_MS = 800;

function chatDraftPayload() {
  return {
    slug: composerOwner ?? newDraftSlug ?? undefined,
    text: $("input").value,
    // File chưa tải lên xong thì chưa có đường dẫn — lần lưu sau (khi tải xong) sẽ có.
    attachments: pending.filter((f) => f.path).map((f) => f.path),
    settings: { ...opts, music: opts.music || null },
  };
}

function scheduleChatDraft() {
  if (sending) return;
  clearTimeout(chatDraftTimer);
  chatDraftTimer = setTimeout(saveChatDraft, DRAFT_DELAY_MS);
}

function saveChatDraft() {
  clearTimeout(chatDraftTimer);
  chatDraftTimer = null;
  // Chụp nội dung NGAY LÚC NÀY — đợi tới lượt gửi thì người dùng có thể đã sang video khác.
  const owner = composerOwner;
  const payload = chatDraftPayload();
  // Nối tiếp: lần lưu đầu ở màn tạo mới tạo video nháp, các lần sau phải đợi có slug đó.
  chatDraftSaving = chatDraftSaving.then(async () => {
    if (owner === null) payload.slug = newDraftSlug ?? undefined;
    if (!payload.slug && !payload.text.trim() && payload.attachments.length === 0) return;
    try {
      const { slug } = await postJson("/api/chat/draft", payload);
      // Chỉ nhận slug khi ô nhập vẫn là màn tạo mới đó — đã sang video khác thì bản nháp nằm trong lịch sử.
      if (owner === null && composerOwner === null) newDraftSlug = slug;
      // Vừa tạo hoặc vừa xoá video nháp: lịch sử đổi.
      if (payload.slug !== (slug ?? undefined)) loadHistory();
      // Đang mở đúng video nháp mà xoá hết lời thì video đó không còn — về màn tạo mới.
      if (owner !== null && !slug && composerOwner === owner) {
        composerOwner = null;
        location.hash = "#/";
      }
    } catch {
      // lưu nháp hỏng không chặn việc gõ — lần gõ sau thử lại
    }
  });
  return chatDraftSaving;
}

/** Rời màn hình / đóng tab: gửi ngay phần chưa lưu, không đợi hẹn giờ. */
function flushChatDraft() {
  if (!chatDraftTimer) return;
  clearTimeout(chatDraftTimer);
  chatDraftTimer = null;
  saveChatDraft();
}

function restoreChatDraft(draft) {
  $("input").value = draft.text ?? "";
  autosize();
  pending = (draft.attachments ?? []).map((p) => ({
    id: Math.random().toString(36).slice(2),
    name: p.split("/").pop(), path: p, url: `/public/${p}`,
    video: isVideoFile(p),
  }));
  renderPending();
  updateSend();
  syncNormalize();
}

let multiDraftTimer = null;

function scheduleMultiDraft() {
  if (!multi) return;
  clearTimeout(multiDraftTimer);
  multiDraftTimer = setTimeout(saveMultiDraft, DRAFT_DELAY_MS);
}

async function saveMultiDraft() {
  clearTimeout(multiDraftTimer);
  multiDraftTimer = null;
  const draft = multi;
  if (!draft) return;
  const { draftSlug, ...data } = draft;
  try {
    const { slug } = await postJson("/api/multi/draft", { ...data, slug: draft.slug ?? draftSlug ?? undefined });
    if (!draft.slug) {
      if (!draftSlug && slug) loadHistory();
      draft.draftSlug = slug ?? undefined;
      if (!slug) loadHistory();
    }
  } catch {
    // như bản nháp chat: không chặn việc soạn
  }
}

function sendDraftBeacon() {
  // Tab đóng/ẩn: fetch thường có thể bị huỷ, sendBeacon thì trình duyệt gửi nốt.
  if (chatDraftTimer) {
    clearTimeout(chatDraftTimer);
    chatDraftTimer = null;
    const payload = chatDraftPayload();
    if (payload.slug || payload.text.trim()) {
      navigator.sendBeacon("/api/chat/draft", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    }
  }
  if (multiDraftTimer && multi) {
    clearTimeout(multiDraftTimer);
    multiDraftTimer = null;
    const { draftSlug, ...data } = multi;
    navigator.sendBeacon("/api/multi/draft",
      new Blob([JSON.stringify({ ...data, slug: multi.slug ?? draftSlug ?? undefined })], { type: "application/json" }));
  }
}
window.addEventListener("pagehide", sendDraftBeacon);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sendDraftBeacon(); });

function autosize() {
  const el = $("input");
  el.style.height = "auto";
  // Kịch bản dán vào dài — cho ô cao hơn ở chế độ nguyên văn.
  const max = opts.mode === "text" ? Math.max(220, window.innerHeight * 0.45) : 220;
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}

function updateSend() {
  const btn = $("send");
  const uploading = pending.some((f) => !f.path);
  btn.disabled = busy || sending || !$("input").value.trim() || uploading;
  btn.classList.toggle("sending", sending);
  $("sendLabel").textContent = sending ? "Đang gửi…"
    : current ? "Gửi" : opts.kind === "image" ? "Tạo bộ ảnh" : "Tạo video";
  btn.title = sending ? "Đang gửi — đợi một chút"
    : busy ? "Đang dựng — đợi xong đã"
    : uploading ? "Đợi tải file lên xong"
    : !$("input").value.trim() ? "Gõ nội dung vào ô trên trước" : "";
}

function setHint(text, isError = false) {
  $("hint").textContent = text;
  $("hint").classList.toggle("err", isError);
}

// ---------- cài đặt API key ----------
/** Key người dùng bấm Xoá (chờ Lưu mới thật sự xoá). */
let removals = new Set();

function bindSettings() {
  $("openSettings").addEventListener("click", openSettings);
  $("settingsDlg").querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $("settingsDlg").close()));
  $("settingsForm").addEventListener("submit", saveSettings);
}

const LIMIT_LABELS = {
  rate_limit: `${icon("hourglass")} hết lượt theo phút`, daily_quota: `${icon("calendar")} hết lượt trong ngày`,
  credit: `${icon("credit-card")} hết tiền/credit`, auth: `${icon("key-round")} key bị từ chối`,
  overloaded: `${icon("flame")} quá tải`, too_large: `${icon("ruler")} yêu cầu quá lớn`,
};

/** Lượt gọi AI hôm nay + lần gần nhất bị chặn vì hạn mức (scripts/usage.ts). */
async function renderUsage() {
  const box = $("usageBox");
  try {
    const u = await api("/api/usage");
    const rows = u.today.map((r) => `<li><b>${escapeHtml(r.provider)}</b> ${r.calls} lượt${r.errors ? ` · ${r.errors} lỗi` : ""}</li>`).join("");
    const limits = u.limits.map((l) => `<li class="limit"><b>${escapeHtml(l.provider)}</b> ${LIMIT_LABELS[l.kind] ?? escapeHtml(l.kind)} lúc ${
      new Date(l.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</li>`).join("");
    box.innerHTML = `<div class="usage-head">${icon("chart-column")} Hôm nay${u.freeMode ? ` · <span class="free-on">${icon("leaf")} Chế độ Miễn phí đang bật</span>` : ""}</div>
      ${rows || limits ? `<ul>${limits}${rows}</ul>` : `<p class="muted">Chưa gọi dịch vụ AI nào hôm nay.</p>`}`;
  } catch {
    box.innerHTML = "";
  }
}

/** focusName: ô cần đưa con trỏ vào (gợi ý key gọi); bấm nút thì tham số là Event — bỏ qua. */
async function openSettings(focusName) {
  closeMenu();
  removals = new Set();
  $("settingsHint").textContent = "";
  $("keyFields").innerHTML = `<p class="muted">Đang tải…</p>`;
  if (!$("settingsDlg").open) $("settingsDlg").showModal();
  renderUsage();
  try {
    const { keys } = await api("/api/keys");
    let group = "";
    $("keyFields").innerHTML = keys.map((k) => {
      const heading = k.group !== group ? `<h3 class="group">${escapeHtml(k.group)}</h3>` : "";
      group = k.group;
      const link = k.url ? ` <a href="${k.url}" target="_blank" rel="noopener">Lấy key ${icon("external-link")}</a>` : "";
      let control;
      let status = "";
      if (k.type === "select") {
        control = `<select id="key-${k.name}" name="${k.name}" data-type="select">${
          k.options.map((o) => `<option value="${o.value}"${(k.value || k.options[0].value) === o.value ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("")
        }</select>`;
      } else if (k.type === "text") {
        control = `<input id="key-${k.name}" name="${k.name}" data-type="text" type="text" spellcheck="false"${k.maxLength ? ` maxlength="${k.maxLength}"` : ""}
                          value="${escapeHtml(k.value)}" placeholder="${escapeHtml(k.placeholder ?? "")}" />`;
      } else {
        status = `<span class="state ${k.set ? "on" : ""}">${k.set ? `${icon("check")} đã có ${escapeHtml(k.preview)}` : "chưa có"}</span>`;
        control = `<input id="key-${k.name}" name="${k.name}" data-type="secret" type="password" spellcheck="false"${k.set ? "" : " data-empty"}
                          placeholder="${k.set ? "Dán key mới để thay" : "Dán key vào đây"}" />
          ${k.set ? `<button type="button" class="btn" data-remove="${k.name}">Xoá</button>` : ""}`;
      }
      return `${heading}
      <div class="field" data-name="${k.name}"${k.showIf ? ` data-show-if="${k.showIf.name}=${k.showIf.value}"` : ""}>
        <div class="field-top"><label for="key-${k.name}">${escapeHtml(k.label)}</label>${status}</div>
        <div class="row">${control}</div>
        <div class="help">${escapeHtml(k.help)}${link}</div>
      </div>`;
    }).join("");
    // Ô phụ thuộc (vd. chữ watermark) chỉ hiện khi ô điều khiển chọn đúng giá trị.
    const applyShowIf = () => $("keyFields").querySelectorAll("[data-show-if]").forEach((field) => {
      const [name, value] = field.dataset.showIf.split("=");
      field.hidden = $(`key-${name}`)?.value !== value;
    });
    $("keyFields").querySelectorAll("select").forEach((select) =>
      select.addEventListener("change", () => {
        applyShowIf();
        // Vừa bật: đưa con trỏ vào ô đầu tiên vừa hiện ra mà còn trống.
        $("keyFields").querySelector(`[data-show-if="${select.name}=${select.value}"] input:placeholder-shown`)?.focus();
      }));
    applyShowIf();
    $("keyFields").querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", () => {
        const name = b.dataset.remove;
        const field = b.closest(".field");
        if (removals.has(name)) {
          removals.delete(name); b.textContent = "Xoá"; field.classList.remove("removing");
        } else {
          removals.add(name); b.textContent = "Hoàn tác"; field.classList.add("removing");
        }
      }));
    // Con trỏ vào ô được nhờ, không thì ô key đầu tiên còn trống — key miễn phí xếp đầu nên người mới điền chúng trước.
    ((typeof focusName === "string" && $(`key-${focusName}`))
      || $("keyFields").querySelector('[data-type="secret"][data-empty]')
      || $("keyFields").querySelector('[data-type="secret"]'))?.focus();
  } catch (e) {
    $("keyFields").innerHTML = `<p class="hint err">Lỗi: ${escapeHtml(e.message)}</p>`;
  }
}

// ---------- gợi ý key lúc tạo video lần đầu ----------
/**
 * Key miễn phí làm video đẹp hơn, xếp theo mức đáng có. `links`: chữ trên link → tên ô trong Cài đặt
 * (lấy url và trạng thái từ /api/keys). `needs`: phải có đủ các ô này mới tính là có (mặc định: một trong `links`).
 */
const KEY_TIPS = [
  { icon: icon("pen-line"), title: "Google Gemini", what: "AI viết lời hay hơn và giọng đọc AI tự nhiên — một key dùng cho cả hai.",
    links: { "Lấy key": "GEMINI_API_KEY" } },
  { icon: icon("image"), title: "Pexels hoặc Pixabay", what: "Ảnh và clip quay thật cho từng cảnh, thay cho nền trơn.",
    links: { Pexels: "PEXELS_API_KEY", Pixabay: "PIXABAY_API_KEY" } },
  { icon: icon("music"), title: "Freesound", what: "Nhạc nền và hiệu ứng âm thanh được phép dùng.",
    links: { "Lấy key": "FREESOUND_API_KEY" } },
  { icon: icon("palette"), title: "Cloudflare Workers AI", what: "AI vẽ ảnh minh hoạ, khoảng 100 ảnh mỗi ngày.",
    links: { "Lấy key": "CLOUDFLARE_ACCOUNT_ID" }, needs: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
  { icon: icon("zap"), title: "Groq hoặc OpenRouter", what: "AI viết lời dự phòng khi Gemini hết lượt trong ngày.",
    links: { Groq: "GROQ_API_KEY", OpenRouter: "OPENROUTER_API_KEY" } },
];

/**
 * Người mới (chưa có video nào render xong) bấm tạo video lần đầu: gợi ý các key miễn phí còn thiếu.
 * Hiện một lần duy nhất. needsScript: lần tạo này cần AI viết lời — thiếu key thì không cho "tạo luôn".
 * true = tạo tiếp; false = người dùng đóng hoặc đi điền key (lời đang gõ vẫn giữ nguyên).
 */
async function keyTipsBeforeFirstVideo({ needsScript = false } = {}) {
  if (state.keyTipsSeen || state.videos.some((v) => v.mp4)) return true;
  // Kiểm tra một lần mỗi phiên — đủ key rồi thì khỏi hỏi lại server ở lần bấm sau.
  state.keyTipsSeen = true;
  let fields;
  try {
    fields = Object.fromEntries((await api("/api/keys")).keys.map((k) => [k.name, k]));
  } catch {
    return true; // không đọc được trạng thái key: bỏ qua gợi ý, đừng chặn tạo video
  }
  const has = (tip) => tip.needs
    ? tip.needs.every((name) => fields[name]?.set)
    : Object.values(tip.links).some((name) => fields[name]?.set);
  const missing = KEY_TIPS.filter((tip) => !has(tip));
  if (missing.length === 0) return true;
  postJson("/api/key-tips/seen", {}).catch(() => {});

  $("keyTipsList").innerHTML = KEY_TIPS.map((tip) => {
    const done = has(tip);
    const links = Object.entries(tip.links)
      .filter(([, name]) => fields[name]?.url)
      .map(([text, name]) => `<a href="${escapeHtml(fields[name].url)}" target="_blank" rel="noopener">${escapeHtml(text)} ${icon("external-link")}</a>`)
      .join(" · ");
    return `<li${done ? ` class="done"` : ""}>
      <span class="tip-icon" aria-hidden="true">${tip.icon}</span>
      <div class="tip-body"><b>${escapeHtml(tip.title)}</b><span class="muted">${escapeHtml(tip.what)}</span></div>
      <span class="tip-act">${done ? `<span class="tip-on">${icon("check")} đã có</span>` : links}</span>
    </li>`;
  }).join("");
  $("keyTipsPaid").hidden = Boolean(state.freeMode);
  const blocked = needsScript && !hasScriptKey();
  $("keyTipsNeed").hidden = !blocked;
  $("keyTipsLater").hidden = blocked;

  const dlg = $("keyTipsDlg");
  const choice = await new Promise((resolve) => {
    dlg.returnValue = "";
    dlg.addEventListener("close", () => resolve(dlg.returnValue), { once: true });
    dlg.showModal();
    $("keyTipsSettings").focus();
  });
  if (choice === "settings") openSettings(Object.values(missing[0].links)[0]);
  return choice === "later";
}

async function saveSettings(event) {
  event.preventDefault();
  const patch = {};
  $("keyFields").querySelectorAll("input, select").forEach((input) => {
    const value = input.value.trim();
    // Ô bí mật để trống = giữ key cũ. Ô thường/ô chọn luôn gửi, rỗng = về mặc định.
    if (input.dataset.type !== "secret") patch[input.name] = value;
    else if (value) patch[input.name] = value;
  });
  for (const name of removals) {
    if (!(name in patch)) patch[name] = null;
  }
  $("saveKeys").disabled = true;
  try {
    await postJson("/api/keys", patch);
    state = await api("/api/state");
    renderKeyNotice();
    // Vừa thêm/xoá key tạo video: cập nhật model dùng được trong danh sách cảnh.
    if (multi && !$("view-multi").hidden) renderMultiScenes();
    $("settingsDlg").close();
  } catch (e) {
    $("settingsHint").textContent = e.message;
    $("settingsHint").classList.add("err");
  } finally {
    $("saveKeys").disabled = false;
  }
}

// ---------- video nhiều cảnh: mỗi cảnh một prompt ----------
const MAX_MULTI_SCENES = 100;
/** Độ dài chọn được khi cảnh không dùng model. */
const FREE_DURATIONS = [2, 3, 4, 5, 6, 8, 10, 12, 15];

/** Bản nháp đang soạn (slug null) hoặc video nhiều cảnh đang mở lại để sửa. */
let multi = null;
let multiUploads = 0;
let multiFileTarget = null;

/** Model thật sẽ chạy cho một lựa chọn: "auto" = model mặc định trong Cài đặt. */
const resolveVideoModel = (choice) =>
  videoModels().find((m) => m.key === (choice === "auto" ? state?.videoDefault : choice));

// Mặc định dùng ảnh/video của người dùng — miễn phí, không bất ngờ bị tính tiền clip AI.
const newMultiScene = () => ({
  prompt: "",
  narration: "",
  model: "",
  seconds: 5,
  media: null,
});

/** Độ dài ngắn nhất phủ đủ số giây muốn; không có thì lấy dài nhất — giống server. */
const fitSeconds = (durations, seconds) => {
  const sorted = [...durations].sort((a, b) => a - b);
  return sorted.find((d) => d >= seconds) ?? sorted.at(-1);
};

const multiDurations = (scene) =>
  scene.model ? resolveVideoModel(scene.model)?.durations ?? [4, 6, 8] : FREE_DURATIONS;

function setMultiHint(text, isError = false) {
  $("multiHint").textContent = text;
  $("multiHint").classList.toggle("err", isError);
}

async function showMulti(slug) {
  stopFollowing();
  // Chuyển sang danh sách cảnh khác: lưu ngay bản đang soạn trước khi thay `multi`.
  if (multiDraftTimer) saveMultiDraft();
  $("view-chat").hidden = true;
  $("view-library").hidden = true;
  $("view-batch").hidden = true;
  $("view-subs").hidden = true;
  $("view-multi").hidden = false;
  setNav(slug ? "" : "multi");
  current = slug;
  setMultiHint("");

  if (slug) {
    $("multiScenes").innerHTML = `<p class="muted">Đang tải…</p>`;
    try {
      const data = await api(`/api/multi/${slug}`);
      if (current !== slug) return;
      multi = { ...data, music: data.music ?? "" };
    } catch (e) {
      multi = null;
      $("multiScenes").innerHTML = `<p class="hint err">${escapeHtml(e.message)}</p>`;
      return;
    }
  } else if (!multi || multi.slug) {
    // Giữ bản nháp đang soạn khi chuyển tab rồi quay lại.
    multi = {
      slug: null, title: "", aspect: "9:16", voice: DEFAULT_OPTS.voice, music: "",
      scenes: [newMultiScene(), newMultiScene()],
    };
  }
  renderMulti();
}

function renderMulti() {
  $("multiHeading").textContent = multi.slug ? "Sửa video từng cảnh" : "Tạo video từng cảnh";
  $("multiTitle").value = multi.title;
  $("multiAspect").innerHTML = aspects.map((a) =>
    `<option value="${a.id}"${a.id === multi.aspect ? " selected" : ""}>${escapeHtml(a.label)}</option>`).join("");
  $("multiVoice").innerHTML = `<option value="">Không giọng — chỉ phụ đề</option>` +
    state.voices.catalog.map((v) =>
      `<option value="${v.key}"${v.key === multi.voice ? " selected" : ""}${v.paidPlan ? " disabled" : ""}>${escapeHtml(v.label)}</option>`).join("");
  renderMultiVoicePlay();
  $("multiMusic").innerHTML = `<option value="">Không nhạc</option>` +
    (state.keys.freesound ? `<option value="${RANDOM_MUSIC}"${multi.music === RANDOM_MUSIC ? " selected" : ""}>Nhạc ngẫu nhiên (Freesound)</option>` : "") +
    state.audio.music.map((m) =>
      `<option value="${escapeHtml(m.path)}"${m.path === multi.music ? " selected" : ""}>${escapeHtml(m.name.replace(/\.\w+$/, ""))}</option>`).join("");
  renderMultiScenes();
}

/** Nút nghe thử cạnh ô giọng của màn Dựng từng cảnh — đọc thử đúng giọng đang chọn. */
function renderMultiVoicePlay() {
  $("multiVoicePlay").innerHTML = multi.voice ? voicePreviewButton(multi.voice, multi.voice) : "";
}

function modelOptions(value) {
  const anyKey = Boolean(state?.videoDefault);
  const auto = resolveVideoModel("auto");
  const groups = new Map();
  for (const m of videoModels()) {
    if (!groups.has(m.providerLabel)) groups.set(m.providerLabel, []);
    groups.get(m.providerLabel).push(m);
  }
  return `<option value=""${value === "" ? " selected" : ""}>Không dùng model</option>` +
    `<option value="auto"${value === "auto" ? " selected" : ""}${anyKey ? "" : " disabled"}>Tự động${auto ? ` (${escapeHtml(auto.label)})` : " — chưa có key"}</option>` +
    [...groups].map(([label, models]) => `<optgroup label="${escapeHtml(label)}">${models.map((m) =>
      `<option value="${m.key}"${m.key === value ? " selected" : ""}${m.available ? "" : " disabled"}>${escapeHtml(m.label)}${m.available ? "" : ` — cần ${m.env}`}</option>`).join("")}</optgroup>`).join("");
}

function sceneCard(scene, i, total) {
  const durations = multiDurations(scene);
  const media = scene.media
    ? isVideoFile(scene.media)
      ? `<video src="/public/${escapeHtml(scene.media)}#t=0.5" muted playsinline preload="metadata"></video>`
      : `<img src="/public/${escapeHtml(scene.media)}" alt="" />`
    : "";
  const ai = Boolean(scene.model);
  const fileName = scene.media ? escapeHtml(scene.media.split("/").pop()) : "";
  const upload = `<div class="ms-drop">
      ${media ? `<div class="ms-thumb">${media}</div>` : ""}
      <span class="muted">${fileName || (ai ? "Không bắt buộc — dùng khi AI lỗi" : "Chưa có — cảnh sẽ là nền trơn")}</span>
      <button type="button" class="btn${!scene.media && !ai ? " primary" : ""}" data-act="file">${scene.media ? "Đổi file" : `${icon("upload")} Chọn ảnh/video`}</button>
      ${scene.media ? `<button type="button" class="btn" data-act="clear">Bỏ</button>` : ""}
    </div>`;
  const seconds = `<label class="ms-field"><span>Độ dài cảnh</span><select data-f="seconds">${durations.map((d) =>
    `<option value="${d}"${d === scene.seconds ? " selected" : ""}>${d} giây</option>`).join("")}</select></label>`;
  return `<article class="ms-card" data-i="${i}">
    <header class="ms-card-head">
      <b>Cảnh ${i + 1}</b>
      <span class="spacer"></span>
      <button type="button" data-act="up" title="Đưa lên" aria-label="Đưa cảnh ${i + 1} lên"${i === 0 ? " disabled" : ""}>${icon("arrow-up")}</button>
      <button type="button" data-act="down" title="Đưa xuống" aria-label="Đưa cảnh ${i + 1} xuống"${i === total - 1 ? " disabled" : ""}>${icon("arrow-down")}</button>
      <button type="button" data-act="dup" title="Nhân đôi cảnh" aria-label="Nhân đôi cảnh ${i + 1}"${total >= MAX_MULTI_SCENES ? " disabled" : ""}>${icon("copy")}</button>
      <button type="button" data-act="del" title="Xoá cảnh" aria-label="Xoá cảnh ${i + 1}"${total === 1 ? " disabled" : ""}>${icon("x")}</button>
    </header>
    <div class="ms-grid">
      <label class="ms-field ms-wide"><span>Lời đọc</span>
        <textarea data-f="narration" rows="2" placeholder="Mỗi dòng một câu phụ đề — để trống nếu cảnh không có lời">${escapeHtml(scene.narration)}</textarea></label>
      <div class="ms-field ms-wide"><span>Hình</span>
        <div class="ms-src-row">
          <div class="seg">
            <button type="button" data-act="src-own" aria-pressed="${!ai}" title="Dùng ảnh/video bạn tải lên — miễn phí">${icon("image")} Của tôi</button>
            <button type="button" data-act="src-ai" aria-pressed="${ai}" title="${
              state?.videoDefault ? "Mô tả cảnh, AI dựng clip — tính phí theo clip" : "Cần thêm key video AI trong Cài đặt"}">${icon("sparkles")} AI tạo clip</button>
          </div>
          <span class="muted">${ai ? "tính phí theo clip" : "miễn phí"}</span>
        </div>
      </div>
      ${ai ? `
      <label class="ms-field ms-wide"><span>Mô tả cảnh cho AI <i class="muted">— viết tiếng Anh cho kết quả tốt nhất</i></span>
        <textarea data-f="prompt" rows="3" placeholder="Slow aerial shot over Ha Long Bay at sunrise, mist on the water, cinematic">${escapeHtml(scene.prompt)}</textarea></label>
      <label class="ms-field"><span>Model AI</span><select data-f="model">${modelOptions(scene.model)}</select></label>
      ${seconds}
      <div class="ms-field ms-wide"><span>Ảnh/video dự phòng</span>${upload}</div>` : `
      <div class="ms-field"><span>Ảnh hoặc video</span>${upload}</div>
      ${seconds}`}
    </div>
  </article>`;
}

function renderMultiScenes() {
  for (const scene of multi.scenes) {
    // Model vừa bị tắt key: về không dùng model thay vì gửi lựa chọn không chạy được.
    if (scene.model && !resolveVideoModel(scene.model)?.available) scene.model = "";
    scene.seconds = fitSeconds(multiDurations(scene), scene.seconds);
  }
  $("multiScenes").innerHTML = multi.scenes.map((s, i) => sceneCard(s, i, multi.scenes.length)).join("");
  renderMultiFoot();
}

function renderMultiFoot() {
  const total = multi.scenes.length;
  const ai = multi.scenes.filter((s) => s.model);
  let usd = 0;
  let unpriced = 0;
  for (const scene of ai) {
    const model = resolveVideoModel(scene.model);
    if (model?.usdPerSecond) usd += model.usdPerSecond * scene.seconds;
    else unpriced += 1;
  }
  const cost = ai.length === 0
    ? " · miễn phí"
    : ` · ${ai.length} clip AI` +
      (usd ? ` · ước tính ~$${usd.toFixed(2)}` : "") +
      (unpriced ? ` · ${unpriced} clip giá theo nhà cung cấp` : "");
  $("multiSummary").textContent = `${total} cảnh${cost}`;
  $("multiAdd").disabled = total >= MAX_MULTI_SCENES;
  $("multiSubmit").innerHTML = `${icon("clapperboard")} ${multi.slug ? "Dựng lại video" : "Tạo video"}`;
}

function bindMulti() {
  $("multiTitle").addEventListener("input", (e) => { if (multi) multi.title = e.target.value; });
  $("multiAspect").addEventListener("change", (e) => { multi.aspect = e.target.value; });
  $("multiVoice").addEventListener("change", (e) => { multi.voice = e.target.value; stopVoicePreview(); renderMultiVoicePlay(); });
  $("multiMusic").addEventListener("change", (e) => { multi.music = e.target.value; });
  $("multiAdd").addEventListener("click", () => {
    if (multi.scenes.length >= MAX_MULTI_SCENES) return;
    multi.scenes.push(newMultiScene());
    renderMultiScenes();
    $("multiScenes").lastElementChild?.querySelector("textarea")?.focus();
  });
  $("multiSubmit").addEventListener("click", submitMulti);
  // Mọi thay đổi trong màn Nhiều cảnh (gõ, chọn, thêm/xoá/đổi chỗ cảnh) đều lưu nháp.
  for (const type of ["input", "change", "click"]) {
    $("view-multi").addEventListener(type, (e) => {
      if (e.target.closest?.("#multiSubmit")) return;
      scheduleMultiDraft();
    });
  }

  const box = $("multiScenes");
  // Ô chữ: chỉ ghi vào state, không vẽ lại — vẽ lại sẽ làm mất con trỏ đang gõ.
  box.addEventListener("input", (e) => {
    const card = e.target.closest("[data-i]");
    if (!card || !e.target.dataset.f || e.target.tagName === "SELECT") return;
    multi.scenes[Number(card.dataset.i)][e.target.dataset.f] = e.target.value;
  });
  box.addEventListener("change", (e) => {
    const card = e.target.closest("[data-i]");
    if (!card || !e.target.dataset.f || e.target.tagName !== "SELECT") return;
    const scene = multi.scenes[Number(card.dataset.i)];
    scene[e.target.dataset.f] = e.target.dataset.f === "seconds" ? Number(e.target.value) : e.target.value;
    renderMultiScenes();
  });
  box.addEventListener("click", (e) => {
    const button = e.target.closest("[data-act]");
    const card = e.target.closest("[data-i]");
    if (!button || !card) return;
    const i = Number(card.dataset.i);
    const list = multi.scenes;
    const act = button.dataset.act;
    if (act === "file") {
      multiFileTarget = list[i];
      $("multiFile").click();
      return;
    }
    if (act === "src-ai" && !list[i].model) {
      if (!state?.videoDefault) {
        flashNote("Cần thêm key video AI (Gemini, fal.ai hoặc Replicate) — đã mở Cài đặt.");
        openSettings();
        return;
      }
      list[i].model = "auto";
    }
    if (act === "src-own") list[i].model = "";
    if (act === "up" && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    else if (act === "down" && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    else if (act === "dup" && list.length < MAX_MULTI_SCENES) list.splice(i + 1, 0, { ...list[i] });
    else if (act === "del" && list.length > 1) list.splice(i, 1);
    else if (act === "clear") list[i].media = null;
    renderMultiScenes();
  });

  $("multiFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const scene = multiFileTarget;
    if (!file || !scene) return;
    if (!/^(image|video)\//.test(file.type)) {
      setMultiHint(`Bỏ qua ${file.name} — chỉ nhận ảnh hoặc video.`, true);
      return;
    }
    multiUploads += 1;
    setMultiHint(`Đang tải lên ${file.name}…`);
    try {
      const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      scene.media = body.path;
      setMultiHint("");
      scheduleMultiDraft();
    } catch (err) {
      setMultiHint(`Không tải lên được ${file.name}: ${err.message}`, true);
    } finally {
      multiUploads -= 1;
      if (multi?.scenes.includes(scene)) renderMultiScenes();
    }
  });
}

async function submitMulti() {
  blurTyping();
  if (multiUploads > 0) {
    setMultiHint("Đợi tải file lên xong đã.", true);
    return;
  }
  if (!(await keyTipsBeforeFirstVideo())) return;
  setMultiHint("");
  $("multiSubmit").disabled = true;
  try {
    clearTimeout(multiDraftTimer);
    multiDraftTimer = null;
    const { draftSlug, ...data } = multi;
    const { slug } = await postJson("/api/multi", {
      ...data,
      // Danh sách đang soạn đã lưu thành video nháp — tạo vào đúng video đó.
      slug: multi.slug ?? draftSlug ?? undefined,
      music: multi.music || null,
    });
    multi = null;
    loadHistory();
    // Màn hình chat theo dõi tiến độ và hiện video khi xong.
    location.hash = `#/v/${slug}`;
  } catch (e) {
    setMultiHint(e.message, true);
  } finally {
    $("multiSubmit").disabled = false;
  }
}

// ---------- làm nhiều video một lượt ----------
/**
 * Một loạt = một danh sách đầu vào + một bộ cài đặt dùng chung.
 *
 * Màn soạn đi theo đúng nhịp của màn tạo video thường: 1 · chọn nguồn → 2 · mỗi cài đặt một
 * ô riêng (bấm mở đúng menu của cài đặt đó) → 3 · ô nhập to nhất nằm dưới cùng. Cài đặt dùng
 * chung `opts` với ô soạn chat nên học một lần là dùng được cả hai chỗ.
 */
let batchSource = "ideas";
let batchReview = true;     // chốt duyệt lời trước khi render
/** AI nghĩ ý tưởng — chọn riêng, không đổi "AI viết lời" của cả loạt. */
let batchIdeaProvider = "auto";
/**
 * Lượt nghĩ ý tưởng gần nhất. `lines`: các dòng AI đã điền — lượt sau thay đúng các dòng này, dòng người dùng
 * tự gõ hoặc đã sửa thì giữ. `undo`: ô danh sách ngay trước lượt đó, cho nút Hoàn tác.
 */
let batchIdea = { topic: "", lines: [], undo: null, busy: false };
/** Phụ đề nhiều ngôn ngữ lúc tạo: mã ngôn ngữ đã chọn, và có lồng tiếng không. */
let batchSubLangs = [];
let batchDub = false;
/** Bật "Nối tiếp thành tập": AI lên dàn ý một loạt nhiều tập thay vì các ý tưởng rời. */
let batchIdeaSeries = false;
/** Nguồn "mỗi video một ô": [{ id, text, settings }] — settings trống = theo cài đặt chung. */
let batchCards = [];
let batchMediaModel = "medium";
let batchMedia = [];        // file thu sẵn đã tải lên: [{ path, name }]
let batchUploading = 0;
/** hooks: tổng số bản thử A/B câu mở đầu, tính cả bản gốc — 0 = không thử. */
let batchVariant = { from: "", aspects: [], voices: [], langs: [], hooks: 0 };
let batchLangs = null;      // ngôn ngữ dịch được — lấy một lần từ /api/translate/engines
let batchProjects = null;   // video có kịch bản, để chọn làm gốc nhân bản
let batchCur = null;        // loạt đang mở ở màn theo dõi
let batchPoll = null;
let batchDoneSeen = -1;     // số video đã xong ở lần vẽ trước — đổi thì làm mới thanh lịch sử
/** Ô đang mở để sửa ở màn theo dõi: { itemId, text, settings } — null = không sửa ô nào. */
let batchEdit = null;
/** Lần vẽ trước loạt có đang chạy không — để biết lúc nào nó vừa xong mà báo. */
let batchWasRunning = false;

/** Icon trạng thái của từng mục (chỉ dùng trong innerHTML). */
const BT_BADGE = {
  queued: icon("hourglass"), preparing: icon("pen-line"), review: icon("eye"), ready: icon("hourglass"),
  building: icon("clapperboard"), done: icon("circle-check"), error: icon("triangle-alert"), skipped: icon("skip-forward"),
};
const BT_LABEL = {
  queued: "Chờ tới lượt", preparing: "Đang chuẩn bị", review: "Chờ bạn duyệt",
  ready: "Đã duyệt · chờ dựng", building: "Đang dựng", done: "Xong", error: "Lỗi", skipped: "Đã bỏ qua",
};
const BT_STEP = { script: "viết lời", voice: "giọng đọc", images: "tìm hình", render: "render", check: "tự soát" };
/** Ô đang mở danh sách lỗi tự soát — giữ qua các lần vẽ lại lưới. */
const batchQaOpen = new Set();
/** Dưới điểm này thì tính là "cần xem lại". */
const QA_GOOD = 8;
const BT_SOURCE_LABEL = {
  ideas: "Ý tưởng", custom: "Từng ô", media: "File thu sẵn", variants: "Biến thể", subs: "Phụ đề", edit: "Sửa hàng loạt",
};
const BT_SOURCE_ICON = {
  ideas: icon("lightbulb"), custom: icon("puzzle"), media: icon("mic"), variants: icon("repeat"), subs: icon("captions"),
  edit: icon("wand-sparkles"),
};
const BT_SOURCE_DESC = {
  ideas: "Mỗi dòng một video. Gõ tay, tải file .txt/.csv, hoặc để AI nghĩ ý tưởng giúp.",
  custom: "Tự nhập từng video. Ô nào muốn khác thì đặt riêng phong cách, khung, giọng.",
  media: "Kéo thả nhiều file audio/video — tự phiên âm, gắn phụ đề rồi render.",
  variants: "Nhân một video có sẵn ra nhiều tỉ lệ khung, giọng đọc, ngôn ngữ.",
};
/** Cài đặt đặt riêng được cho từng ô; còn lại theo cài đặt chung của loạt. */
const BT_CARD_KEYS = ["mode", "style", "aspect", "voice", "images", "music"];
const BT_CARD_LABEL = {
  mode: "Lời", style: "Phong cách", aspect: "Khung", voice: "Giọng", images: "Hình", music: "Nhạc",
};
const BT_BUSY = ["queued", "preparing", "ready", "building"];
const BASE_TITLE = document.title;

function bindBatch() {
  // Tải tất cả: còn video sửa dở chưa xuất thì hỏi trước — gói chỉ có bản đã xuất.
  $("batchZip").addEventListener("click", async (e) => {
    const pending = (batchCur?.items ?? []).filter((it) => it.status === "done" && it.draft);
    if (pending.length === 0) return;
    e.preventDefault();
    const ok = await confirmDialog({
      title: `${pending.length} video còn chỉnh sửa chưa xuất`,
      message: "Gói tải về chỉ có bản đã xuất gần nhất của các video này. Mở Chỉnh sửa và bấm Xuất video nếu muốn tải bản mới.",
      items: pending.map((it) => it.title || it.input),
      okText: `${icon("download")} Vẫn tải bản đã xuất`,
    });
    if (ok) location.href = $("batchZip").href;
  });
  // Quay lại tab loạt sau khi sửa ở tab trình chỉnh sửa: nạp lại để thấy bản mới, nhãn đã sửa/chưa xuất.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && batchCur && !$("view-batch").hidden) loadBatch(batchCur.id);
  });

  document.querySelectorAll("[data-source]").forEach((b) =>
    b.addEventListener("click", () => {
      batchSource = b.dataset.source;
      renderBatchNew();
      if (batchSource === "variants") loadBatchVariantData();
    }));

  // Mỗi ô cài đặt mở menu của đúng cài đặt đó.
  $("batchFields").addEventListener("click", (e) => {
    const field = e.target.closest("[data-field]");
    if (field) openMenu(field, batchMenuFor(field.dataset.field));
  });

  $("batchText").addEventListener("input", () => { renderBatchCount(); renderBatchPlan(); });
  $("batchImport").addEventListener("click", () => $("batchFile").click());
  $("batchFile").addEventListener("change", importBatchFile);
  $("batchSheetImport").addEventListener("click", () => $("batchFile").click());
  $("batchSheetTemplate").addEventListener("click", downloadBatchTemplate);
  $("batchSheetTemplate2").addEventListener("click", downloadBatchTemplate);
  $("batchTopicToggle").addEventListener("click", () => {
    const box = $("batchIdeaGen");
    box.hidden = !box.hidden;
    if (!box.hidden) $("batchTopic").focus();
  });
  $("batchTopicGo").addEventListener("click", () => askForIdeas());
  $("batchIdeaSeries").addEventListener("click", () => {
    batchIdeaSeries = !batchIdeaSeries;
    $("batchIdeaSeries").setAttribute("aria-pressed", String(batchIdeaSeries));
    // Loạt nhiều tập tối đa 12 tập (scripts/ideas.ts, MAX_EPISODES) — 5 tập là cỡ hay dùng.
    const count = $("batchTopicCount");
    count.max = batchIdeaSeries ? "12" : "50";
    if (batchIdeaSeries && Number(count.value) > 12) count.value = "5";
    $("batchTopicGo").textContent = batchIdeaSeries ? "Lên dàn ý các tập" : "Nghĩ ý tưởng";
    $("batchTopic").placeholder = batchIdeaSeries ? "ví dụ: học chơi guitar từ số 0" : "ví dụ: mẹo tiết kiệm điện trong nhà";
  });
  $("batchTopic").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); askForIdeas(); }
  });
  $("batchIdeaAgain").addEventListener("click", () => askForIdeas(true));
  $("batchIdeaUndo").addEventListener("click", undoIdeas);
  $("batchIdeaAi").addEventListener("click", (e) => openMenu(e.currentTarget, providerMenu((value) => {
    batchIdeaProvider = value;
    paintIdeaGen();
  }, batchIdeaProvider, "AI nghĩ ý tưởng", false)));

  $("batchCards").addEventListener("click", (e) => {
    const remove = e.target.closest("[data-card-rm]");
    if (remove) {
      batchCards = batchCards.filter((c) => c.id !== remove.dataset.cardRm);
      if (batchCards.length === 0) batchCards.push(newBatchCard());
      renderBatchCustom();
      renderBatchPlan();
      return;
    }
    const chip = e.target.closest("[data-card-chip]");
    if (chip) {
      const card = batchCards.find((c) => c.id === chip.dataset.cardId);
      if (card) openMenu(chip, cardMenuFor(chip.dataset.cardChip, card, () => {
        renderBatchCustom();
        renderBatchPlan();
      }));
      return;
    }
    const close = e.target.closest("[data-card-close]");
    if (close) return setCardOpen(close.dataset.cardClose, false);
    const open = e.target.closest("[data-card-open]");
    if (open) return setCardOpen(open.dataset.cardOpen, true);
    if (e.target.closest("#batchAddCard")) addBatchCard();
  });
  // Ô đóng là một khối bấm được — bàn phím cũng phải mở được nó.
  $("batchCards").addEventListener("keydown", (e) => {
    const card = e.target.closest?.("[data-card-open]");
    if (card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setCardOpen(card.dataset.cardOpen, true);
    }
  });

  $("batchDrop").addEventListener("click", () => $("batchMediaFile").click());
  $("batchMediaFile").addEventListener("change", (e) => {
    addBatchMedia([...(e.target.files ?? [])]);
    e.target.value = "";
  });
  bindBatchDrop();

  $("batchStart").addEventListener("click", createBatch);
  $("batchLangPicks").addEventListener("click", (e) => {
    const code = e.target.closest("[data-sublang]")?.dataset.sublang;
    if (!code) return;
    const i = batchSubLangs.indexOf(code);
    if (i >= 0) batchSubLangs.splice(i, 1); else batchSubLangs.push(code);
    renderBatchLangs();
    renderBatchCount();
    renderBatchCardsCount();
    renderBatchPlan();
  });
  $("batchDub").addEventListener("change", () => { batchDub = $("batchDub").checked; renderBatchPlan(); });
  $("batchSchedule").addEventListener("click", () => {
    const input = $("batchStartAt");
    input.hidden = !input.hidden;
    if (!input.hidden && !input.value) {
      // Gợi ý mặc định: 23:00 tối nay (hoặc mai nếu đã quá giờ đó).
      const at = new Date();
      at.setHours(23, 0, 0, 0);
      if (at.getTime() < Date.now() + 60_000) at.setDate(at.getDate() + 1);
      const pad = (v) => String(v).padStart(2, "0");
      input.value = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
    }
    if (input.hidden) input.value = "";
    paintBatchStart();
  });
  $("batchStartAt").addEventListener("input", paintBatchStart);
  $("batchUnschedule").addEventListener("click", () => batchAction("pause"));
  $("batchPause").addEventListener("click", toggleBatchRun);
  $("batchApproveAll").addEventListener("click", () => batchAction("approve"));
  $("batchRetryAll").addEventListener("click", () => batchAction("retry"));
  $("batchPostCopy").addEventListener("click", startBatchPostCopy);
  $("batchCheck").addEventListener("click", startBatchCheck);
  // Menu Công cụ: bấm một mục thì đóng menu (trừ Xuất thêm khung — mở menu con ngay cạnh nút của nó).
  const toolsPanel = $("batchToolsPanel");
  const setTools = (open) => {
    toolsPanel.hidden = !open;
    $("batchToolsBtn").setAttribute("aria-expanded", String(open));
  };
  $("batchToolsBtn").addEventListener("click", (e) => { e.stopPropagation(); setTools(toolsPanel.hidden); });
  toolsPanel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && b.id !== "batchExports") setTools(false);
  });
  document.addEventListener("click", (e) => {
    if (!toolsPanel.hidden && !e.target.closest(".bt-tools") && !e.target.closest("#menu")) setTools(false);
  });
  $("batchFix").addEventListener("click", () =>
    runBatchJob("fix", $("batchFix"), (run) => `Đang sửa ${run.done + run.failed}/${run.total}…`));
  $("batchCovers").addEventListener("click", startBatchCovers);
  $("batchExports").addEventListener("click", openBatchExportMenu);
  $("batchBrand").addEventListener("click", openBrandDialog);
  $("batchPlan2").addEventListener("click", openPlanDialog);
  $("batchClone").addEventListener("click", openCloneDialog);
  $("batchResults").addEventListener("click", openResultsDialog);
  $("resultsForm").addEventListener("submit", saveResultsDialog);
  $("resultsTable").addEventListener("input", renderResultsSummary);
  $("resultsTable").addEventListener("paste", pasteResults);
  $("resultsTabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-rs-platform]");
    if (!tab) return;
    resultsPlatform = tab.dataset.rsPlatform;
    renderResultsTable();
  });
  $("resultsDlg").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("resultsDlg").close()));
  $("cloneForm").addEventListener("submit", submitClone);
  $("cloneVoice").addEventListener("change", renderCloneDialog);
  $("cloneDlg").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("cloneDlg").close()));
  $("cloneDlg").addEventListener("click", (e) => {
    const lang = e.target.closest("[data-clone-lang]")?.dataset.cloneLang;
    const aspect = e.target.closest("[data-clone-aspect]")?.dataset.cloneAspect;
    const toggle = (list, v) => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); };
    if (lang) toggle(clonePick.langs, lang);
    if (aspect) toggle(clonePick.aspects, aspect);
    if (lang || aspect) renderCloneDialog();
  });
  ["planStart", "planTimes", "planWeekends"].forEach((id) => $(id).addEventListener("input", renderPlanPreview));
  $("planWeekends").addEventListener("change", renderPlanPreview);
  $("planForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const { slots, times } = planSlots();
    if (!times.length || !Object.keys(slots).length) {
      $("planHint").textContent = "Chưa có mốc nào — kiểm tra giờ đăng và ngày bắt đầu.";
      $("planHint").classList.add("err");
      return;
    }
    savePlan(slots);
  });
  $("planClear").addEventListener("click", () => savePlan({}));
  $("planDlg").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("planDlg").close()));
  $("brandForm").addEventListener("submit", submitBrand);
  $("brandFile").addEventListener("change", uploadBrandFile);
  $("brandDlg").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("brandDlg").close()));
  $("brandDlg").querySelectorAll("[data-brand-upload]").forEach((b) => b.addEventListener("click", () => {
    brandUploadTarget = b.dataset.brandUpload;
    $("brandFile").click();
  }));
  $("batchErrGroups").addEventListener("click", onBatchErrGroupClick);
  $("batchDelete").addEventListener("click", deleteBatchRun);
  // Cuộn tới đâu thì gắn video của những ô vừa hiện ra tới đó.
  let mounting = false;
  $("view-batch").addEventListener("scroll", () => {
    if (mounting) return;
    mounting = true;
    requestAnimationFrame(() => { mounting = false; mountBatchVideos(); });
  }, { passive: true });

  $("batchItems").addEventListener("click", onBatchItemClick);
  $("batchItems").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const poster = e.target.closest?.("[data-play]");
    if (poster) {
      e.preventDefault();
      return playBatchVideo(poster);
    }
    const tile = e.target.closest?.("[data-item-open]");
    if (tile) {
      e.preventDefault();
      openBatchEdit(tile.dataset.itemOpen);
    }
  });
}

/** Kéo thả file vào ô lớn — cùng đường với nút Chọn file. */
function bindBatchDrop() {
  const box = $("batchMediaBox");
  const drop = $("batchDrop");
  box.addEventListener("dragover", (e) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    drop.classList.add("drag");
  });
  box.addEventListener("dragleave", (e) => {
    if (e.target === box || !box.contains(e.relatedTarget)) drop.classList.remove("drag");
  });
  box.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    addBatchMedia([...(e.dataTransfer?.files ?? [])]);
  });
}

async function showBatch(id) {
  stopFollowing();
  $("view-chat").hidden = true;
  $("view-library").hidden = true;
  $("view-multi").hidden = true;
  $("view-subs").hidden = true;
  $("view-batch").hidden = false;
  // Loạt thêm phụ đề mở từ màn Phụ đề — giữ nút đó sáng.
  setNav(id && batchCur?.source === "subs" ? "subs" : "batch");
  current = null;

  if (id) {
    $("batchNew").hidden = true;
    $("batchRun").hidden = false;
    $("batchRunHint").textContent = "";
    if (batchCur?.id !== id) {
      batchCur = null;
      batchDoneSeen = -1;
      batchEdit = null;
      batchWasRunning = false;
      $("batchItems").innerHTML = `<p class="muted">Đang tải…</p>`;
    }
    return loadBatch(id);
  }

  batchCur = null;
  batchEdit = null;
  $("batchRun").hidden = true;
  $("batchNew").hidden = false;
  setBatchHint("");
  renderBatchNew();
  if (batchSource === "variants") loadBatchVariantData();
  loadBatchList();
}

const setBatchHint = (text, isError = false) => {
  $("batchHint").textContent = text;
  $("batchHint").classList.toggle("err", isError);
};

// ---------- màn soạn loạt mới ----------

function renderBatchNew() {
  document.querySelectorAll("[data-source]").forEach((b) => {
    const on = b.dataset.source === batchSource;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  $("batchIdeasBox").hidden = batchSource !== "ideas";
  $("batchCustomBox").hidden = batchSource !== "custom";
  $("batchMediaBox").hidden = batchSource !== "media";
  $("batchVariantBox").hidden = batchSource !== "variants";
  $("batchLangsBox").hidden = !langSource();
  renderBatchLangs();
  $("batchSourceDesc").textContent = BT_SOURCE_DESC[batchSource];
  // Biến thể chưa chọn video gốc: mở sẵn phần cài đặt, vì ô chọn video gốc nằm trong đó.
  if (batchSource === "variants" && !batchVariant.from) $("batchSettings").open = true;

  const textMode = opts.mode === "text";
  $("batchText").placeholder = textMode
    ? 'Lời video 1 — mỗi dòng một câu, dòng trống để sang cảnh mới\n\n---\n\nLời video 2…'
    : "5 mẹo tiết kiệm pin iPhone\nVì sao Nokia sụp đổ?\nCách pha cà phê muối";
  $("batchIdeasBox").classList.toggle("text-mode", textMode);
  // Không có key viết lời thì cũng không nghĩ ý tưởng được.
  $("batchTopicToggle").hidden = textMode || !hasScriptKey();
  if ($("batchTopicToggle").hidden) $("batchIdeaGen").hidden = true;
  paintIdeaGen();

  renderBatchFields();
  renderBatchCount();
  renderBatchPlan();
  renderBatchCustom();
  renderBatchMedia();
  renderBatchVariant();
}

/** Cài đặt cho cả loạt: mỗi cài đặt một ô. Ô nào cũng mở một menu, y như chip ở màn tạo video. */
function renderBatchFields() {
  if (!state) return;
  const style = styleMeta(opts.style);
  const voice = state.voices.catalog.find((v) => v.key === opts.voice);
  const fields = [];

  // Nguồn "mỗi video một ô" dùng chung bộ cài đặt này làm MẶC ĐỊNH — ô nào đặt riêng thì thắng.
  const byCard = batchSource === "custom";
  const def = (label) => (byCard || batchSource === "variants" ? `${label} mặc định` : label);
  if (batchSource === "ideas" || byCard) {
    fields.push(["mode", def("Lời video"), opts.mode === "text" ? "Có sẵn" : "AI viết", modeIcon(opts.mode)]);
    if (opts.mode !== "text") fields.push(["provider", "AI viết lời", providerChipLabel(), providerIcon(opts.provider)]);
    fields.push(
      ["kind", "Tạo ra", opts.kind === "image" ? "Bộ ảnh" : "Video", kindIcon(opts.kind)],
      ["style", def("Phong cách"), `${style.emoji} ${style.label}`],
    );
  }
  if (batchSource === "variants") {
    const from = batchProjects?.find((p) => p.slug === batchVariant.from);
    fields.push(["variantFrom", "Video gốc", from ? from.title : batchProjects ? "Chọn video…" : "Đang tải…"]);
  }
  if (batchSource === "media") {
    fields.push(["mediaModel", "Độ chính xác", batchMediaModel === "small" ? "Nhanh (small)" : "Chuẩn (medium)",
      batchMediaModel === "small" ? icon("zap") : icon("target")]);
  }

  fields.push(["aspect", def("Khung hình"), `▭ ${opts.aspect}`]);
  if (batchSource !== "media") fields.push(["images", "Hình ảnh", imageChipLabel(), imagesIcon(opts.images, opts.video)]);
  if (batchSource !== "media" && aiDraws()) fields.push(["art", "Kiểu vẽ", artChipLabel(), artIcon(opts.art)]);
  if (opts.kind === "video" && batchSource !== "media") {
    fields.push(["voice", def("Giọng đọc"), voice ? voice.key : "Không giọng", voiceIcon(voice?.key)]);
  }
  if (opts.kind === "video") {
    fields.push(["music", "Nhạc nền", musicLabel(opts.music), musicIcon(opts.music)]);
  }
  fields.push(["review", "Duyệt lời", batchReview ? "Dừng cho tôi đọc" : "Chạy thẳng", batchReview ? icon("check") : icon("fast-forward")]);
  // Mẫu đứng đầu: chọn mẫu là đổi cả các ô phía sau.
  const preset = batchPresets.find((p) => p.id === batchPresetId);
  fields.unshift(["preset", "Mẫu cài đặt", preset ? `${preset.name}${presetChanged(preset) ? " (đã đổi)" : ""}` : "Không dùng mẫu",
    icon("bookmark")]);

  // Dòng tóm tắt khi thu gọn: giá trị của vài cài đặt chính.
  const SUM_KEYS = { preset: "Mẫu", variantFrom: "Gốc", style: "Phong cách", aspect: "Khung", voice: "Giọng", images: "Hình", review: "Duyệt" };
  $("batchSettingsSum").textContent = fields.filter(([key]) => SUM_KEYS[key])
    .map(([key, , value]) => `${SUM_KEYS[key]}: ${value}`).join(" · ");
  $("batchFields").innerHTML = fields.map(([key, label, value, ic]) =>
    `<button type="button" class="bt-field ${key === "review" && batchReview ? "on" : ""}" data-field="${key}"
       aria-haspopup="listbox" aria-expanded="false">
      <span>${escapeHtml(label)}</span><b><i>${ic ? `${ic} ` : ""}${escapeHtml(value)}</i>${CARET}</b>
    </button>`).join("");
}

// ---- mẫu loạt (server/batch-presets.ts) ----
let batchPresets = [];
let batchPresetId = null;
/** Các ô cài đặt một mẫu lưu lại — cũng là những ô so để biết mẫu "đã đổi" chưa. */
const PRESET_KEYS = ["kind", "style", "mode", "aspect", "voice", "music", "video", "provider", "images", "art", "length"];

async function loadBatchPresets() {
  try {
    batchPresets = (await api("/api/batch-presets")).presets;
    if (!$("view-batch").hidden && !$("batchNew").hidden) renderBatchFields();
  } catch {
    // không đọc được thì coi như chưa có mẫu nào
  }
}

const presetChanged = (preset) =>
  batchReview !== preset.review || PRESET_KEYS.some((k) => (opts[k] || null) !== (preset.settings[k] || null));

const presetSummary = (p) => [
  `${styleMeta(p.settings.style).emoji} ${styleMeta(p.settings.style).label}`,
  p.settings.aspect,
  p.settings.voice || "không giọng",
  IMAGE_SOURCES[p.settings.images] ?? p.settings.images,
  p.review ? "duyệt lời" : "chạy thẳng",
].join(" · ");

function applyBatchPreset(preset) {
  for (const k of PRESET_KEYS) if (k in preset.settings) opts[k] = preset.settings[k] ?? "";
  batchReview = preset.review;
  batchPresetId = preset.id;
  renderComposer();
  renderProjectBar();
  renderBatchNew();
  setBatchHint(`Đã dùng mẫu “${preset.name}”.`);
}

async function saveBatchPreset() {
  const current = batchPresets.find((p) => p.id === batchPresetId);
  const name = await askText({
    title: "Lưu cài đặt làm mẫu",
    message: "Lưu phong cách, khung, giọng, hình, nhạc và cách duyệt lời hiện tại. Trùng tên mẫu cũ thì cập nhật mẫu đó.",
    value: current?.name ?? "",
    placeholder: "ví dụ: Kênh mẹo vặt — dọc, giọng Linh",
  });
  if (!name) return;
  try {
    const res = await postJson("/api/batch-presets", { name, settings: { ...opts, music: opts.music || null }, review: batchReview });
    batchPresets = res.presets;
    batchPresetId = res.preset.id;
    renderBatchNew();
    setBatchHint(res.replaced ? `Đã cập nhật mẫu “${res.preset.name}”.` : `Đã lưu mẫu “${res.preset.name}”.`);
  } catch (e) {
    setBatchHint(e.message, true);
  }
}

async function deleteBatchPreset() {
  const preset = batchPresets.find((p) => p.id === batchPresetId);
  if (!preset) return;
  const ok = await confirmDialog({ title: `Xoá mẫu “${preset.name}”?`, message: "Cài đặt đang chọn vẫn giữ nguyên, chỉ mẫu bị xoá.", okText: "Xoá mẫu" });
  if (!ok) return;
  batchPresets = (await postJson("/api/batch-presets", { delete: preset.id })).presets;
  batchPresetId = null;
  renderBatchNew();
}

/** Menu cho một ô cài đặt: phần lớn dùng chung với ô soạn chat, ba ô riêng của màn này. */
function batchMenuFor(key) {
  if (key === "preset") {
    return {
      id: "preset", title: "Mẫu cài đặt", value: batchPresetId ?? "",
      onPick: (value) => {
        if (value === "__save") return saveBatchPreset();
        if (value === "__delete") return deleteBatchPreset();
        const preset = batchPresets.find((p) => p.id === value);
        if (preset) applyBatchPreset(preset);
      },
      options: [
        ...batchPresets.map((p) => ({ value: p.id, group: "Mẫu đã lưu", icon: icon("bookmark"), title: p.name, sub: presetSummary(p) })),
        { value: "__save", group: "Quản lý", icon: icon("bookmark-plus"), title: "Lưu cài đặt hiện tại làm mẫu…",
          sub: batchPresets.length ? "Đặt tên mới, hoặc trùng tên mẫu cũ để cập nhật" : "Lần sau chọn lại một lần là đủ" },
        ...(batchPresetId ? [{ value: "__delete", group: "Quản lý", icon: icon("trash-2"), title: "Xoá mẫu đang dùng" }] : []),
      ],
    };
  }
  if (key === "review") {
    return {
      id: "review", title: "Duyệt lời trước khi render", value: batchReview ? "yes" : "no",
      onPick: (value) => { batchReview = value === "yes"; renderBatchNew(); },
      options: [
        { value: "yes", icon: icon("check"), title: "Dừng cho tôi đọc",
          sub: "Viết lời cả loạt xong thì dừng. Đọc lại, sửa cái nào cần, rồi bấm Duyệt để render." },
        { value: "no", icon: icon("fast-forward"), title: "Chạy thẳng",
          sub: "Viết lời xong render luôn, không hỏi lại. Nhanh nhất, nhưng lời sai thì phải làm lại cả video." },
      ],
    };
  }
  if (key === "mediaModel") {
    return {
      id: "mediaModel", title: "Độ chính xác khi phiên âm", value: batchMediaModel,
      onPick: (value) => { batchMediaModel = value; renderBatchNew(); },
      options: [
        { value: "medium", icon: icon("target"), title: "Chuẩn (medium)", sub: "Đúng hơn với tiếng Việt. Đo thật: audio 41 giây → ~15 giây." },
        { value: "small", icon: icon("zap"), title: "Nhanh (small)", sub: "Nhanh hơn nhiều, nhưng sai tên riêng và từ ghép nhiều hơn." },
      ],
    };
  }
  if (key === "variantFrom") {
    const list = batchProjects ?? [];
    return {
      id: "variantFrom", title: "Nhân bản từ video nào", value: batchVariant.from,
      onPick: (value) => { batchVariant.from = value; renderBatchNew(); },
      options: list.length === 0
        ? [{ value: "", title: "Chưa có video nào có kịch bản", sub: "Tạo một video bằng AI hoặc lời có sẵn trước đã.", disabled: true }]
        : list.map((p) => ({
            value: p.slug,
            title: p.title,
            sub: `▭ ${p.aspect} · ${styleMeta(p.style).emoji} ${styleMeta(p.style).label}`,
          })),
    };
  }
  return menuFor(key);
}

/** Nguồn cho chọn phụ đề nhiều ngôn ngữ: những nguồn viết lời mới (ý tưởng, từng ô). */
const langSource = () => batchSource === "ideas" || batchSource === "custom";

async function renderBatchLangs() {
  if (!langSource()) return;
  if (!batchLangs) {
    $("batchLangPicks").innerHTML = `<span class="muted">Đang tải danh sách ngôn ngữ…</span>`;
    try { batchLangs = (await api("/api/translate/engines")).languages; } catch { batchLangs = []; }
  }
  $("batchLangPicks").innerHTML = pickChips((batchLangs ?? []).map((l) => ({ value: l.code, label: l.label })), batchSubLangs, "sublang");
  $("batchDub").checked = batchDub;
}

/** Số video của mỗi ý tưởng: bản gốc + một bản mỗi ngôn ngữ. */
const perIdea = () => (langSource() ? 1 + batchSubLangs.length : 1);

/** Số video sẽ tạo, theo nguồn đang chọn. */
function batchTotal() {
  return Math.min(50, batchBaseTotal() * perIdea());
}

function batchBaseTotal() {
  if (batchSource === "custom") return batchCards.filter((c) => c.text.trim()).length;
  if (batchSource === "media") return batchMedia.length;
  if (batchSource === "variants") {
    if (!batchVariant.from) return 0;
    return Math.min(50, Math.max(1, batchVariant.aspects.length || 1) *
      Math.max(1, batchVariant.voices.length || 1) *
      Math.max(1, batchVariant.langs.length || 1) *
      Math.max(1, batchVariant.hooks));
  }
  return batchLines().length;
}

/** Mỗi dòng một video, hoặc mỗi khối "---" một video khi dùng lời có sẵn. */
const batchLines = () => {
  const text = $("batchText").value;
  if (opts.mode === "text") {
    return text.split(/\n\s*(?:-{3,}|={3,})\s*\n|\n{3,}/).map((b) => b.trim()).filter(Boolean);
  }
  return [...new Set(text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean))];
};

function renderBatchCount() {
  const n = batchLines().length;
  const per = perIdea();
  $("batchCount").textContent = n === 0 ? "" : n > 50 ? `${n} dòng — chỉ lấy 50 dòng đầu`
    : per > 1 ? `${n} ý tưởng · ${Math.min(50, n * per)} video` : `${n} video`;
}

/**
 * Ước tính thô trước khi chạy — để biết loạt này tốn gì trước khi bấm, nhất là những thứ tính tiền.
 * Số theo một video ngắn điển hình (~6 cảnh, ~700 ký tự lời, render ~1,1× thời lượng); chỉ để định cỡ.
 */
function batchEstimate(n, needsAi, voice) {
  const out = [];
  if (batchSource === "media") {
    out.push(`phiên âm trên máy, ~${Math.max(1, Math.round(n * (batchMediaModel === "small" ? 0.5 : 1)))} phút`);
  } else {
    const originals = Math.ceil(n / perIdea());
    const translated = n - originals;
    if (needsAi) out.push(`~${originals * 2} lượt AI viết lời (viết + soát)`);
    if (translated > 0) out.push(`~${translated} lượt AI dịch`);
    if (opts.kind === "video" && voice) {
      // Bản chỉ dịch phụ đề đọc lại đúng lời gốc — giọng có bộ nhớ nên không tốn thêm.
      const voiced = batchDub ? n : originals;
      out.push(voice.engine === "elevenlabs" ? `~${(voiced * 700).toLocaleString("vi-VN")} ký tự ElevenLabs (tính theo ký tự)`
        : voice.engine === "gemini" ? `~${voiced * 8} lượt Gemini TTS`
          : "giọng chạy trên máy, miễn phí");
    }
    // Bản ngôn ngữ dùng chung hình với bản gốc.
    if (opts.video) out.push(`~${originals * 6} clip video AI (tính tiền theo clip)`);
    else if (opts.images === "ai") out.push(`~${originals * 6} ảnh AI${state?.keys.flux ? " (FLUX miễn phí ~100 ảnh/ngày)" : " (Gemini tính tiền theo ảnh)"}`);
    else if (opts.images === "pexels" || opts.images === "stock-video") out.push(`~${originals * 6} lượt tìm ảnh/clip miễn phí`);
  }
  if (batchSource !== "media") out.push(`máy chạy ~${Math.max(1, Math.round(n * (opts.video ? 4 : 1.5)))} phút`);
  return out;
}

/** Một dòng cho biết loạt sẽ chạy ra thế nào — để thiếu key hay thiếu nội dung lộ ra trước khi bấm. */
function renderBatchPlan() {
  const n = batchTotal();
  const voice = state?.voices.catalog.find((v) => v.key === opts.voice);
  const unit = opts.kind === "image" && batchSource !== "media" ? "bộ ảnh" : "video";
  const parts = [`Sẽ tạo <b>${n} ${unit}</b>`, `khung <b>${opts.aspect}</b>`];
  if (batchSource === "media") {
    parts.push(`phiên âm bằng <b>${batchMediaModel}</b>`);
  } else {
    if (opts.kind === "video") {
      parts.push(voice ? `giọng <b>${escapeHtml(voice.key)}</b>` : "không giọng");
    }
    parts.push(escapeHtml(imageChipLabel()));
  }
  if (batchSource === "custom") {
    const own = batchCards.filter((c) => c.text.trim() && Object.values(c.settings).some(Boolean)).length;
    if (own > 0) parts.push(`<b>${own} ô</b> theo cài đặt riêng của ô`);
  }
  if (langSource() && batchSubLangs.length) {
    const names = batchSubLangs.map((code) => batchLangs?.find((l) => l.code === code)?.label ?? code);
    parts.push(`mỗi video thêm bản <b>${escapeHtml(names.join(", "))}</b> (${batchDub ? "lồng tiếng" : "phụ đề, giữ giọng gốc"})`);
    if (batchBaseTotal() * perIdea() > 50) parts.push(`<b>tối đa 50 video</b> — bớt ý tưởng hoặc ngôn ngữ`);
  }
  parts.push(batchReview ? "<b>dừng cho bạn duyệt lời</b> trước khi render" : "chạy thẳng tới mp4");

  const warn = [];
  if (n === 0) {
    warn.push(batchSource === "media" ? "Thêm file audio/video ở trên trước đã."
      : batchSource === "variants" ? "Chọn video gốc và tích ít nhất một biến thể."
      : batchSource === "custom" ? "Nhập nội dung vào ít nhất một ô."
      : "Thêm ít nhất một dòng ý tưởng.");
  }
  const needsAi = batchSource === "ideas"
    ? opts.mode === "ai"
    : batchSource === "custom" &&
      batchCards.some((c) => c.text.trim() && (c.settings.mode ?? opts.mode) === "ai");
  if (needsAi && !hasScriptKey()) {
    warn.push("Chưa có AI viết lời — đổi ô “Lời video” sang Có sẵn, hoặc thêm key trong Cài đặt.");
  }
  if (batchSource !== "media" && (opts.images === "pexels" || opts.images === "stock-video") && !state?.keys.pexels) {
    warn.push("Chưa có key Pexels/Pixabay — đổi ô “Hình ảnh” sang Không hình hoặc Ảnh của tôi.");
  }
  if (batchSource !== "media" && opts.images === "ai" && !state?.keys.gemini && !state?.keys.flux) {
    warn.push("Chưa có key Gemini để vẽ ảnh — đổi ô “Hình ảnh”.");
  }
  // Cảnh báo về cài đặt (thiếu key…): mở phần cài đặt để thấy ngay ô cần đổi.
  if (warn.length > (n === 0 ? 1 : 0)) $("batchSettings").open = true;
  const est = n > 0 ? batchEstimate(n, needsAi, voice) : [];
  $("batchPlan").innerHTML = `${parts.join(" · ")}. Máy dựng lần lượt từng ${unit}.` +
    (est.length ? `<br><span class="est">${icon("calculator")} Ước tính: ${est.map(escapeHtml).join(" · ")}</span>` : "") +
    warn.map((w) => `<br><span class="warn">${icon("triangle-alert")} ${escapeHtml(w)}</span>`).join("");
}

async function importBatchFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  // Bảng tính: đọc đủ các cột (batch-sheet.js) — có cột phong cách/giọng… thì mỗi dòng thành một ô riêng.
  if (/\.(csv|tsv)$/i.test(file.name)) return importBatchSheet(file);
  const lines = (await file.text()).split(/\r?\n/);
  const current = $("batchText").value.trim();
  $("batchText").value = (current ? `${current}\n` : "") + lines.join("\n").trim();
  renderBatchCount();
  renderBatchPlan();
  setBatchHint(`Đã nạp ${file.name}.`);
}

/** Hàng "AI nghĩ ý tưởng": nhãn nút chọn AI, trạng thái bận, dòng kết quả. `note` = chữ cho dòng kết quả. */
function paintIdeaGen(note, isError = false) {
  const { busy, topic, undo } = batchIdea;
  $("batchIdeaAi").innerHTML = `${providerIcon(batchIdeaProvider)}<span>${escapeHtml(providerChipLabel(batchIdeaProvider))}</span>`;
  $("batchIdeaAi").title = "Chọn AI nghĩ ý tưởng — chỉ AI đã có key trong Cài đặt";
  $("batchIdeaAi").disabled = busy;
  $("batchTopicGo").disabled = busy;
  $("batchTopicGo").textContent = busy ? "Đang nghĩ…" : batchIdeaSeries ? "Lên dàn ý các tập" : "Nghĩ ý tưởng";
  if (note === undefined) return;
  const status = $("batchIdeaStatus");
  status.hidden = !note;
  status.classList.toggle("err", isError);
  $("batchIdeaInfo").innerHTML = note;
  $("batchIdeaAgain").hidden = !topic;
  $("batchIdeaAgain").disabled = busy;
  $("batchIdeaUndo").hidden = busy || !undo;
}

/**
 * AI nghĩ danh sách ý tưởng. Bấm "Nghĩ ý tưởng" thì lấy chủ đề trong ô rồi xoá ô; `again` (nút Đổi ý tưởng)
 * nghĩ lại đúng chủ đề vừa rồi, dặn AI tránh các ý đã đưa. Kết quả THAY các dòng lượt trước AI điền,
 * không nối thêm — dòng người dùng tự gõ hoặc đã sửa thì giữ ở đầu danh sách.
 */
async function askForIdeas(again = false) {
  if (batchIdea.busy) return;
  blurTyping();
  const input = $("batchTopic");
  const topic = again ? batchIdea.topic : input.value.trim();
  if (!topic) {
    paintIdeaGen("Gõ chủ đề trước đã.", true);
    input.focus();
    return;
  }
  const series = batchIdeaSeries;
  const count = Math.max(series ? 2 : 1, Math.min(series ? 12 : 50, Number($("batchTopicCount").value) || (series ? 5 : 10)));
  if (!again) input.value = "";
  batchIdea.busy = true;
  paintIdeaGen(series
    ? `Đang lên dàn ý loạt ${count} tập ${again ? "khác " : ""}cho <b>“${escapeHtml(topic)}”</b>…`
    : `Đang nghĩ ${count} ý tưởng ${again ? "khác " : ""}cho <b>“${escapeHtml(topic)}”</b>…`);
  try {
    const { ideas, provider } = await postJson("/api/batch/ideas", {
      topic, count, provider: batchIdeaProvider, avoid: again ? batchIdea.lines : [], series,
    });
    const before = $("batchText").value;
    const fromAi = new Set(batchIdea.lines);
    const kept = before.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !fromAi.has(line));
    const keptSet = new Set(kept);
    const fresh = ideas.filter((idea) => !keptSet.has(idea));
    $("batchText").value = [...kept, ...fresh].join("\n");
    batchIdea = {
      topic, lines: fresh, busy: false,
      undo: before.trim() ? { text: before, lines: batchIdea.lines, topic: batchIdea.topic } : null,
    };
    renderBatchCount();
    renderBatchPlan();
    const who = scriptProviders().find((p) => p.id === provider)?.label ?? "AI";
    paintIdeaGen(`${icon("check")} ${escapeHtml(who)} ${series ? `lên dàn ý ${fresh.length} tập` : `nghĩ ${fresh.length} ý tưởng`} cho <b>“${escapeHtml(topic)}”</b>${
      kept.length ? ` · giữ ${kept.length} dòng bạn tự gõ/sửa` : ""}`);
  } catch (err) {
    batchIdea.busy = false;
    // Lỗi thì trả chủ đề về ô (nếu người dùng chưa gõ chủ đề khác) để bấm lại ngay.
    if (!again && !input.value.trim()) input.value = topic;
    paintIdeaGen(escapeHtml(err.message), true);
  }
}

/** Trả ô danh sách về như trước lượt nghĩ ý tưởng vừa rồi. */
function undoIdeas() {
  const { undo } = batchIdea;
  if (!undo || batchIdea.busy) return;
  $("batchText").value = undo.text;
  batchIdea = { topic: undo.topic, lines: undo.lines, undo: null, busy: false };
  renderBatchCount();
  renderBatchPlan();
  paintIdeaGen(undo.topic ? `Đã trả lại danh sách trước — ý tưởng cho <b>“${escapeHtml(undo.topic)}”</b>` : "Đã trả lại danh sách trước.");
}

// ---------- nguồn: mỗi video một ô ----------

/**
 * Mỗi video là một ô chữ nhật. Ô đóng chỉ hiện nội dung đã gõ (hoặc lời mời gõ);
 * bấm vào mới mở ô nhập + chip cài đặt riêng. Cùng kiểu ô này được dùng lại ở màn
 * theo dõi: xong thì chính ô đó hiện video, bấm vào lại ra ô nhập để sửa.
 */
function newBatchCard(open = false) {
  return { id: Math.random().toString(36).slice(2, 8), text: "", settings: {}, open };
}

function addBatchCard() {
  if (batchCards.length >= 50) { setBatchHint("Một loạt tối đa 50 video.", true); return; }
  // Bấm ＋ là muốn gõ ngay — mở sẵn ô mới, các ô khác giữ nguyên.
  batchCards.push(newBatchCard(true));
  renderBatchCustom();
  renderBatchPlan();
  $("batchCards").querySelector(".bt-card:nth-last-of-type(1) textarea")?.focus();
}

/** Nhãn hiện trên chip của một ô: chưa đặt riêng thì ghi "Theo chung". */
function cardChipLabel(settings, key) {
  if (key === "images") {
    if (settings.video) {
      const model = videoModels().find((m) => m.key === settings.video);
      return settings.video === "auto" ? "Video AI" : model?.label ?? "Video AI";
    }
    return settings.images ? IMAGE_SOURCES[settings.images] ?? settings.images : "Theo chung";
  }
  const value = settings[key];
  if (!value) return "Theo chung";
  if (key === "mode") return value === "text" ? "Có sẵn" : "AI viết";
  if (key === "style") return `${styleMeta(value).emoji} ${styleMeta(value).label}`;
  if (key === "aspect") return `▭ ${value}`;
  if (key === "music") return musicLabel(value);
  return value === "none" ? "Không giọng" : value;
}

/** Icon trước nhãn chip của ô; chưa đặt riêng ("Theo chung") thì không có icon. */
function cardChipIcon(settings, key) {
  if (key === "images") return settings.video || settings.images ? imagesIcon(settings.images, settings.video) : "";
  const value = settings[key];
  if (!value) return "";
  if (key === "mode") return modeIcon(value);
  if (key === "voice") return voiceIcon(value);
  if (key === "music") return musicIcon(value);
  return "";
}

/** Hàng chip cài đặt riêng của một ô (dùng chung cho màn soạn và ô đang sửa ở màn theo dõi). */
const cardChipsHtml = (id, settings) => `<div class="chips">${BT_CARD_KEYS.map((key) => `
  <button type="button" class="chip ${settings[key] ? "own" : ""}" data-card-chip="${key}" data-card-id="${id}"
    aria-haspopup="listbox" aria-expanded="false" title="${escapeHtml(BT_CARD_LABEL[key])} riêng cho video này">
    <span class="chip-k">${BT_CARD_LABEL[key]}:</span>
    <span class="chip-v">${cardChipIcon(settings, key)}${cardChipIcon(settings, key) ? " " : ""}${escapeHtml(cardChipLabel(settings, key))}</span>${CARET}</button>`).join("")}</div>`;

function renderBatchCustom() {
  if (batchSource !== "custom") return;
  if (batchCards.length === 0) batchCards = [newBatchCard()];

  const textMode = (card) => (card.settings.mode ?? opts.mode) === "text";
  $("batchCards").innerHTML = batchCards.map((card, i) => {
    const head = `<div class="bt-card-head">
        <span>Video ${i + 1}</span><span class="spacer"></span>
        ${card.open ? `<button type="button" class="icon-btn" data-card-close="${card.id}" aria-label="Thu gọn ô ${i + 1}">${icon("chevron-up")}</button>` : ""}
        <button type="button" class="icon-btn" data-card-rm="${card.id}" aria-label="Bỏ ô ${i + 1}">${icon("x")}</button>
      </div>`;
    if (!card.open) {
      const own = BT_CARD_KEYS.filter((k) => card.settings[k]).map((k) => cardChipLabel(card.settings, k));
      return `<div class="bt-card closed" data-card-open="${card.id}" role="button" tabindex="0">
        ${head}
        <p class="bt-card-preview ${card.text.trim() ? "" : "empty"}">${
          card.text.trim() ? escapeHtml(shorten(card.text, 120)) : "Bấm để nhập nội dung video này"}</p>
        ${own.length ? `<p class="bt-card-own">${own.map(escapeHtml).join(" · ")}</p>` : ""}
      </div>`;
    }
    return `<div class="bt-card">
      ${head}
      <textarea data-card-text="${card.id}" spellcheck="false" aria-label="Nội dung video ${i + 1}"
        placeholder="${textMode(card)
          ? "Dán lời video này — mỗi dòng một câu"
          : "Ý tưởng cho video này — ví dụ: 3 mẹo pha cà phê ngon"}"></textarea>
      ${cardChipsHtml(card.id, card.settings)}
    </div>`;
  }).join("") + `
    <button type="button" class="bt-add-card" id="batchAddCard"><b>${icon("plus")}</b>Thêm ô</button>`;

  // Gán value bằng JS (khỏi lo escape), và gõ thì chỉ cập nhật state — không vẽ lại kẻo mất con trỏ.
  $("batchCards").querySelectorAll("[data-card-text]").forEach((el) => {
    const card = batchCards.find((c) => c.id === el.dataset.cardText);
    el.value = card?.text ?? "";
    el.addEventListener("input", () => {
      card.text = el.value;
      renderBatchCardsCount();
      renderBatchPlan();
    });
  });
  renderBatchCardsCount();
}

/** Mở hoặc thu gọn một ô; mở thì con trỏ nhảy thẳng vào ô nhập. */
function setCardOpen(id, open) {
  const card = batchCards.find((c) => c.id === id);
  if (!card) return;
  card.open = open;
  renderBatchCustom();
  if (open) $("batchCards").querySelector(`[data-card-text="${id}"]`)?.focus();
}

function renderBatchCardsCount() {
  const n = batchCards.filter((c) => c.text.trim()).length;
  const own = batchCards.filter((c) => c.text.trim() && Object.values(c.settings).some(Boolean)).length;
  $("batchCardsCount").textContent = n === 0 ? ""
    : `${perIdea() > 1 ? `${n} ô · ${Math.min(50, n * perIdea())} video` : `${n} video`}${own ? ` · ${own} ô đặt riêng` : ""}`;
}

/**
 * Menu của một chip trong ô: luôn có lựa chọn đầu là "theo cài đặt chung".
 * `target` là ô đang sửa (ô soạn hoặc bản nháp ở màn theo dõi), `onChange` vẽ lại đúng màn đó.
 */
function cardMenuFor(key, target, onChange) {
  const pick = (value) => {
    target.settings[key] = value;
    onChange();
  };
  const shared = {
    mode: opts.mode === "text" ? "Lời có sẵn" : "AI viết lời",
    style: `${styleMeta(opts.style).emoji} ${styleMeta(opts.style).label}`,
    aspect: opts.aspect,
    voice: opts.voice || "Không giọng",
    images: imageChipLabel(),
    music: musicLabel(opts.music),
  }[key];
  const inherit = { value: "", icon: icon("undo-2"), title: "Theo cài đặt chung", sub: `Đang là ${shared}` };

  if (key === "mode") {
    return {
      id: "cardMode", title: "Lời của video này", value: target.settings.mode ?? "", onPick: pick,
      options: [inherit,
        { value: "ai", icon: icon("bot"), title: "AI viết lời", sub: "Gõ ý tưởng, AI viết nội dung cho riêng video này." },
        { value: "text", icon: icon("file-text"), title: "Lời có sẵn", sub: "Dán lời của bạn, dựng đúng từng câu. Không cần key." }],
    };
  }
  if (key === "style") {
    return {
      id: "cardStyle", title: "Phong cách của video này", value: target.settings.style ?? "", onPick: pick,
      options: [inherit,
        { value: "auto", icon: icon("sparkles"), title: "Tự động", sub: "AI đọc nội dung và chọn phong cách hợp nhất." },
        ...(state?.styles ?? []).map((st) => ({
          value: st.id, title: `${st.emoji} ${st.label}`, sub: st.summary,
        }))],
    };
  }
  if (key === "aspect") {
    return {
      id: "cardAspect", title: "Khung hình của video này", value: target.settings.aspect ?? "", onPick: pick,
      options: [inherit, ...aspects.map((a) => ({
        value: a.id, title: a.id, sub: `${a.label.split("—")[1]?.trim() ?? ""} · ${a.width}×${a.height}`,
      }))],
    };
  }
  if (key === "images") {
    const models = videoModels();
    const anyVideoKey = models.some((m) => m.available);
    return {
      id: "cardImages", title: "Hình cho các cảnh của video này",
      value: target.settings.video ? `video:${target.settings.video}` : target.settings.images ?? "",
      onPick: (value) => {
        if (!value) {
          delete target.settings.images;
          delete target.settings.video;
        } else if (value.startsWith("video:")) {
          target.settings.video = value.slice(6);
          target.settings.images = "library";
        } else {
          target.settings.video = "";
          target.settings.images = value;
        }
        onChange();
      },
      options: [inherit,
        { value: "none", icon: icon("ban"), title: IMAGE_SOURCES.none, sub: "Chỉ có chữ trên nền màu" },
        { value: "library", icon: icon("image"), title: IMAGE_SOURCES.library, sub: "Ảnh đã có trong thư viện" },
        { value: "pexels", icon: icon("search"), title: IMAGE_SOURCES.pexels, sub: state?.keys.pexels ? "Ảnh thật, miễn phí" : "Cần key Pexels/Pixabay", disabled: !state?.keys.pexels },
        { value: "stock-video", icon: icon("film"), title: IMAGE_SOURCES["stock-video"], sub: state?.keys.pexels ? "Clip thật, miễn phí" : "Cần key Pexels/Pixabay", disabled: !state?.keys.pexels },
        { value: "ai", icon: icon("palette"), title: IMAGE_SOURCES.ai, sub: state?.keys.flux ? "FLUX miễn phí (Cloudflare)" : state?.freeMode ? "Cần key Cloudflare" : state?.keys.gemini ? "Gemini vẽ từng cảnh" : "Cần key Cloudflare/Gemini", disabled: !state?.keys.flux && (!state?.keys.gemini || state?.freeMode) },
        { value: "video:auto", group: "Clip video AI — tính tiền theo clip", icon: icon("clapperboard"), title: "Tự động",
          sub: anyVideoKey ? "Model rẻ nhất đang có key" : "Chưa có key tạo video", disabled: !anyVideoKey },
        ...models.map((m) => ({
          value: `video:${m.key}`, group: m.providerLabel, icon: icon("clapperboard"), title: m.label,
          sub: m.available ? `${m.durations[0]}–${m.durations.at(-1)}s/clip` : `Cần ${m.env}`,
          disabled: !m.available,
        }))],
    };
  }
  if (key === "music") {
    return {
      id: "cardMusic", title: "Nhạc nền của video này", value: target.settings.music ?? "", onPick: pick,
      options: [inherit,
        { value: "none", icon: icon("music"), title: "Không nhạc" },
        ...randomMusicOption(),
        ...(state?.audio.music ?? []).map((m) => ({
          value: m.path, icon: icon("music"), title: m.name.replace(/\.\w+$/, ""),
        }))],
    };
  }
  const langs = { vi: "Tiếng Việt", en: "Tiếng Anh" };
  return {
    id: "cardVoice", title: "Giọng đọc của video này", value: target.settings.voice ?? "", onPick: pick,
    options: [inherit,
      { value: "none", icon: icon("volume-x"), title: "Không giọng", sub: "Chỉ có chữ, thời lượng tính theo độ dài câu" },
      ...state.voices.catalog.map((v) => ({
        value: v.key, group: langs[v.lang] ?? v.lang, icon: icon("mic"), title: v.key,
        sub: `${v.label.split("—")[1]?.trim() ?? ""} · ${v.engineLabel}${v.paidPlan ? " · cần gói trả phí" : ""}`,
        disabled: v.paidPlan,
        preview: v.key,
      }))],
  };
}

/** Chỉ gửi lên những cài đặt ô tự đặt; giọng "none" nghĩa là không giọng. */
function cardSettings(card) {
  const settings = {};
  for (const key of BT_CARD_KEYS) {
    const value = card.settings[key];
    if (!value) continue;
    if (key === "music") {
      // Không nhạc phải gửi null; chuỗi rỗng bị server coi là "không nói gì" và giữ nhạc chung.
      settings.music = value === "none" ? null : value;
    } else if (key === "images") {
      settings.images = value;
      settings.video = card.settings.video ?? "";
    } else {
      settings[key] = value === "none" ? "" : value;
    }
  }
  return settings;
}

// ---------- nguồn: file thu sẵn ----------

async function addBatchMedia(files) {
  if (files.length === 0) return;
  setBatchHint("");
  for (const file of files) {
    batchUploading += 1;
    renderBatchMedia();
    try {
      const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      batchMedia.push({ path: body.path, name: file.name });
    } catch (err) {
      setBatchHint(`Không tải lên được ${file.name}: ${err.message}`, true);
    } finally {
      batchUploading -= 1;
      renderBatchMedia();
      renderBatchPlan();
    }
  }
}

function renderBatchMedia() {
  if (batchSource !== "media") return;
  $("batchMediaCount").textContent = batchUploading > 0
    ? `Đang tải lên ${batchUploading} file…`
    : batchMedia.length ? `${batchMedia.length} video` : "";
  $("batchMediaList").innerHTML = batchMedia.map((f, i) =>
    `<li><span>${escapeHtml(f.name)}</span>
      <button type="button" class="icon-btn" data-media="${i}" aria-label="Bỏ ${escapeHtml(f.name)}">${icon("x")}</button></li>`).join("");
  $("batchMediaList").querySelectorAll("[data-media]").forEach((b) =>
    b.addEventListener("click", () => {
      batchMedia.splice(Number(b.dataset.media), 1);
      renderBatchMedia();
      renderBatchPlan();
    }));
}

// ---------- nguồn: biến thể ----------

async function loadBatchVariantData() {
  try {
    if (!batchProjects) {
      batchProjects = (await api("/api/projects")).projects.filter((p) => p.scripted);
      if (!batchVariant.from) batchVariant.from = batchProjects[0]?.slug ?? "";
    }
    if (!batchLangs) {
      batchLangs = (await api("/api/translate/engines")).languages;
    }
  } catch (e) {
    setBatchHint(e.message, true);
  }
  renderBatchNew();
}

const pickChips = (items, selected, attr) => items.map((item) =>
  `<button type="button" class="bt-pick ${selected.includes(item.value) ? "on" : ""}"
    data-${attr}="${escapeHtml(item.value)}">${item.icon ? `${item.icon} ` : ""}${escapeHtml(item.label)}</button>`).join("");

function renderBatchVariant() {
  if (batchSource !== "variants") return;
  $("batchVariantAspects").innerHTML = pickChips(
    aspects.map((a) => ({ value: a.id, label: a.id })), batchVariant.aspects, "aspect");
  // Giọng: mỗi chip kèm nút nghe thử ngay bên cạnh (nút riêng — bấm nghe không bật/tắt chip).
  $("batchVariantVoices").innerHTML = pickChips([{ value: "", icon: icon("volume-x"), label: "Không giọng" }], batchVariant.voices, "voice") +
    state.voices.catalog.filter((v) => !v.paidPlan).map((v) =>
      `<span class="pick-wrap">${pickChips([{ value: v.key, icon: icon("mic"), label: v.key }], batchVariant.voices, "voice")}${
        voicePreviewButton(v.key, v.key)}</span>`).join("");
  $("batchVariantLangs").innerHTML = pickChips(
    (batchLangs ?? []).map((l) => ({ value: l.code, label: l.label })), batchVariant.langs, "lang");
  // Thử hook: chọn MỘT số (không phải bật/tắt nhiều), nên dùng chip đơn chọn.
  $("batchVariantHooks").innerHTML = pickChips([
    { value: "0", label: "Không thử" },
    ...[2, 3, 4, 5].map((n) => ({ value: String(n), icon: icon("flask-conical"), label: `${n} bản` })),
  ], [String(batchVariant.hooks)], "hooks");

  const toggle = (list, value) => {
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else list.push(value);
    renderBatchVariant();
    renderBatchPlan();
  };
  $("batchVariantAspects").querySelectorAll("[data-aspect]").forEach((b) =>
    b.addEventListener("click", () => toggle(batchVariant.aspects, b.dataset.aspect)));
  $("batchVariantVoices").querySelectorAll("[data-voice]").forEach((b) =>
    b.addEventListener("click", () => toggle(batchVariant.voices, b.dataset.voice)));
  $("batchVariantLangs").querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => toggle(batchVariant.langs, b.dataset.lang)));
  $("batchVariantHooks").querySelectorAll("[data-hooks]").forEach((b) =>
    b.addEventListener("click", () => {
      batchVariant.hooks = Number(b.dataset.hooks);
      // Thử hook: bật sẵn chốt duyệt để đọc câu AI viết trước khi dựng (người dùng vẫn tắt được).
      if (batchVariant.hooks > 1) batchReview = true;
      renderBatchNew();
    }));

  $("batchVariantCount").textContent = batchVariant.from ? `${batchTotal()} video` : "Chọn video gốc trong Cài đặt cho cả loạt";
}

// ---------- tạo loạt ----------

/** Nút chạy đổi thành "Hẹn chạy lúc …" khi đã chọn giờ. */
function paintBatchStart() {
  const value = $("batchStartAt").hidden ? "" : $("batchStartAt").value;
  $("batchSchedule").setAttribute("aria-pressed", String(Boolean(value)));
  const at = value ? new Date(value) : null;
  $("batchStart").innerHTML = at
    ? `${icon("alarm-clock")} Hẹn chạy ${at.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`
    : `${icon("rocket")} Chạy loạt`;
}

async function createBatch() {
  blurTyping();
  if (batchUploading > 0) { setBatchHint("Đợi tải file lên xong đã.", true); return; }
  if (!(await keyTipsBeforeFirstVideo())) return;
  const body = {
    source: batchSource,
    name: $("batchName").value,
    review: batchReview,
    settings: { ...opts, music: opts.music || null },
    start: true,
  };
  const at = $("batchStartAt").hidden ? "" : $("batchStartAt").value;
  if (at) body.startAt = new Date(at).getTime();
  if (batchSource === "ideas") body.items = $("batchText").value;
  if (langSource() && batchSubLangs.length) {
    body.languages = batchSubLangs;
    body.dub = batchDub;
  }
  if (batchSource === "custom") {
    // "" trong settings nghĩa là theo cài đặt chung nên đừng gửi lên; giọng "none" = không giọng.
    body.items = batchCards
      .filter((card) => card.text.trim())
      .map((card) => ({ text: card.text.trim(), settings: cardSettings(card) }));
  }
  if (batchSource === "media") {
    body.items = batchMedia.map((f) => f.path);
    body.mediaModel = batchMediaModel;
  }
  if (batchSource === "variants") {
    body.variants = {
      from: batchVariant.from,
      aspects: batchVariant.aspects,
      voices: batchVariant.voices,
      languages: batchVariant.langs,
      hooks: batchVariant.hooks,
    };
  }
  $("batchStart").disabled = true;
  setBatchHint("");
  // Xin quyền báo ngay lúc bấm chạy — đúng lúc người dùng vừa tương tác nên trình duyệt mới cho hỏi.
  try {
    if (window.Notification && Notification.permission === "default") Notification.requestPermission();
  } catch {
    // trình duyệt nhúng không có Notification — bỏ qua
  }
  try {
    const batch = await postJson("/api/batch", body);
    $("batchText").value = "";
    batchCards = [];
    batchMedia = [];
    // Loạt đã chạy: lượt nghĩ ý tưởng cũ không còn gì để thay hay hoàn tác.
    batchIdea = { topic: "", lines: [], undo: null, busy: false };
    paintIdeaGen("");
    $("batchName").value = "";
    $("batchStartAt").value = "";
    $("batchStartAt").hidden = true;
    paintBatchStart();
    loadHistory();
    location.hash = `#/batch/${batch.id}`;
  } catch (e) {
    setBatchHint(e.message, true);
  } finally {
    $("batchStart").disabled = false;
  }
}

async function loadBatchList() {
  if (!batchPresets.length) loadBatchPresets();
  try {
    const { batches } = await api("/api/batches");
    $("batchRecent").hidden = batches.length === 0;
    $("batchRecentList").innerHTML = batches.slice(0, 12).map((b) => {
      const c = b.counts;
      const state = b.state === "running" ? `${icon("refresh-cw")} đang chạy` : b.state === "paused" ? `${icon("pause")} tạm dừng`
        : b.state === "done" ? `${icon("circle-check")} xong` : `${icon("circle")} chưa chạy`;
      const pct = c.total === 0 ? 0 : Math.round(((c.done + c.skipped) / c.total) * 100);
      return `<a href="#/batch/${b.id}">
        <span class="row"><b>${escapeHtml(b.name)}</b><span class="spacer"></span>
          <span class="muted">${state}</span></span>
        <span class="mini"><i style="width:${pct}%"></i></span>
        <span class="muted">${BT_SOURCE_ICON[b.source] ?? ""} ${BT_SOURCE_LABEL[b.source] ?? ""} · ${c.done}/${c.total} xong${
          c.error ? ` · ${c.error} lỗi` : ""}${c.review ? ` · ${c.review} chờ duyệt` : ""}</span>
      </a>`;
    }).join("");
  } catch {
    $("batchRecent").hidden = true;
  }
}

// ---------- màn theo dõi ----------

function stopBatchPoll() {
  clearTimeout(batchPoll);
  batchPoll = null;
}

async function loadBatch(id) {
  try {
    const batch = await api(`/api/batch/${id}`);
    if ($("view-batch").hidden || !location.hash.includes(id)) return;
    batchCur = batch;
    renderBatchRun();
    scheduleBatchPoll();
  } catch (e) {
    $("batchItems").innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
  }
}

/** Chỉ hỏi lại server khi máy đang làm việc — chờ duyệt thì không có gì để đợi. */
function scheduleBatchPoll() {
  stopBatchPoll();
  // Loạt hẹn giờ: hỏi lại ngay sau giờ hẹn (server xét mỗi 30 giây) để thấy nó bắt đầu chạy.
  if (batchCur?.state === "idle" && batchCur.startAt) {
    const wait = Math.max(5_000, batchCur.startAt - Date.now() + 35_000);
    if (wait < 2 ** 31 - 1) batchPoll = setTimeout(() => loadBatch(batchCur.id), wait);
    return;
  }
  if (!batchCur || batchCur.state !== "running") return;
  if (!batchCur.items.some((i) => BT_BUSY.includes(i.status))) return;
  batchPoll = setTimeout(() => loadBatch(batchCur.id), 1500);
}

/** "giọng linh · nhạc calm · “A” → “B”" — dòng mô tả thay đổi của loạt sửa hàng loạt. */
function editPlanText(plan) {
  const parts = [];
  if (plan.style) parts.push(`${styleMeta(plan.style).emoji} ${styleMeta(plan.style).label}`);
  if (plan.voice !== undefined) parts.push(plan.voice ? `giọng ${plan.voice}` : "không giọng");
  if (plan.aspect) parts.push(`▭ ${plan.aspect}`);
  if (plan.music !== undefined) parts.push(plan.music === null ? "không nhạc" : musicLabel(plan.music));
  if (plan.handle) parts.push(plan.handle);
  if (plan.accent) parts.push(`màu ${plan.accent}`);
  for (const r of plan.replace ?? []) parts.push(`“${r.find}” → “${r.to}”`);
  return parts.join(" · ");
}

function renderBatchRun() {
  const b = batchCur;
  if (!b) return;
  const c = b.counts;
  $("batchRunName").textContent = b.name;
  const subs = b.source === "subs";
  $("batchRunMeta").textContent = (subs ? [
    BT_SOURCE_LABEL.subs,
    `${c.total} video`,
    b.review ? "dừng cho bạn đọc lại phụ đề" : "chạy thẳng",
    "giữ khung của video gốc",
    b.subs?.tracks?.length > 1 ? `${b.subs.tracks.length} hàng phụ đề mỗi video` : "",
  ].filter(Boolean) : [
    BT_SOURCE_LABEL[b.source] ?? b.source,
    `${c.total} video`,
    b.review ? "có chốt duyệt lời" : "chạy thẳng",
    `▭ ${b.settings.aspect}`,
    b.settings.voice ? `giọng ${b.settings.voice}` : "không giọng",
  ]).join(" · ");
  // Sửa hàng loạt: cài đặt chung của loạt không có nghĩa gì — ghi những thay đổi đang áp.
  if (b.source === "edit" && b.edit) {
    $("batchRunMeta").textContent = [
      BT_SOURCE_LABEL.edit, `${c.total} video`,
      b.edit.kind === "props" ? "giữ chỉnh sửa" : "dựng lại từ kịch bản",
      editPlanText(b.edit),
    ].filter(Boolean).join(" · ");
  }
  $("batchSubsLook").hidden = !subs;
  setNav(subs ? "subs" : "batch");

  // Thanh tiến độ tổng: mục đã xong + phần trăm của mục đang chạy, để nó nhích đều chứ không giật.
  const partial = b.items
    .filter((i) => i.status === "preparing" || i.status === "building")
    .reduce((sum, i) => sum + Math.min(1, (i.progress || 0) / 100), 0);
  const ratio = c.total === 0 ? 0 : Math.min(1, (c.done + c.skipped + partial) / c.total);
  $("batchProgressBar").style.width = `${Math.round(ratio * 100)}%`;

  // Video đã xong mà tự soát dưới mức tốt — nên mở xem trước khi đăng.
  const doneItems = b.items.filter((it) => it.status === "done");
  const needLook = doneItems.filter((it) => it.qa && it.qa.score < QA_GOOD).length;
  const unchecked = doneItems.filter((it) => !it.qa).length;
  const stat = (cls, label, value, show = true) =>
    show ? `<span class="bt-stat ${cls}">${label} <b>${value}</b></span>` : "";
  $("batchStats").innerHTML = [
    stat("done", `${icon("circle-check")} Xong`, `${c.done}/${c.total}`),
    stat("run", `${icon("refresh-cw")} Đang chạy`, c.running, c.running > 0),
    stat("review", `${icon("eye")} Chờ duyệt`, c.review, c.review > 0),
    stat("", `${icon("hourglass")} Chờ`, c.waiting, c.waiting > 0),
    stat("err", `${icon("triangle-alert")} Lỗi`, c.error, c.error > 0),
    stat("review", `${icon("scan-search")} Cần xem lại`, needLook, needLook > 0),
    stat("", `${icon("skip-forward")} Bỏ qua`, c.skipped, c.skipped > 0),
  ].join("");
  $("batchEta").textContent = batchEta(b);

  const pause = $("batchPause");
  const scheduled = b.state === "idle" && b.startAt;
  pause.hidden = c.waiting === 0 && c.running === 0 && c.review === 0;
  pause.innerHTML = b.state === "running" ? `${icon("pause")} Tạm dừng` : scheduled ? `${icon("play")} Chạy ngay` : `${icon("play")} Chạy tiếp`;
  $("batchUnschedule").hidden = !scheduled;
  if (scheduled) {
    const when = new Date(b.startAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", weekday: "short", day: "2-digit", month: "2-digit" });
    $("batchRunMeta").textContent = `⏰ Hẹn chạy lúc ${when} — để app mở tới lúc đó · ${$("batchRunMeta").textContent}`;
  }
  $("batchApproveAll").hidden = c.review === 0;
  $("batchApproveAll").innerHTML = `${icon("check")} Duyệt tất cả (${c.review})`;
  renderBatchErrGroups(b);
  $("batchRetryAll").hidden = c.error === 0;
  $("batchRetryAll").innerHTML = `${icon("rotate-cw")} Chạy lại ${c.error} lỗi`;
  $("batchZip").hidden = c.done === 0;
  $("batchZip").href = `/api/batch/${b.id}/zip`;
  $("batchZip").innerHTML = `${icon("download")} ${subs ? `Tải tất cả (${c.done} video + .srt)` : `Tải tất cả (${c.done})`}`;
  $("batchCsv").hidden = c.total === 0;
  $("batchCsv").href = `/api/batch/${b.id}/csv`;
  renderBatchPostCopy(b.postCopy);
  if (!batchJobBusy.has("batchFix")) {
    const fixable = doneItems.filter((it) => it.qa?.issues.some((x) => x.fix)).length;
    $("batchFix").hidden = fixable === 0;
    $("batchFix").disabled = c.running > 0;
    $("batchFix").innerHTML = `${icon("wand-sparkles")} Sửa tự động (${fixable})`;
  }
  if (!batchJobBusy.has("batchCheck")) {
    $("batchCheck").hidden = unchecked === 0;
    $("batchCheck").disabled = false;
    $("batchCheck").innerHTML = `${icon("scan-search")} Soát ${unchecked} video`;
  }
  const planned = b.postPlan ? Object.keys(b.postPlan.slots).length : 0;
  $("batchPlan2").hidden = doneItems.length === 0;
  $("batchResults").hidden = doneItems.length === 0;
  // Nguồn file thu sẵn / phụ đề không có kịch bản để nhân.
  $("batchClone").hidden = doneItems.length === 0 || b.source === "media" || b.source === "subs";
  $("batchPlan2").innerHTML = `${icon("calendar-days")} ${planned ? `Lịch đăng (${planned})` : "Lịch đăng"}`;
  if (!batchJobBusy.has("batchBrand")) {
    const branded = doneItems.filter((it) => it.branded).length;
    $("batchBrand").hidden = doneItems.length === 0;
    $("batchBrand").disabled = false;
    $("batchBrand").innerHTML = `${icon("clapperboard")} ${branded ? `Mở đầu / kết thúc ${branded}/${doneItems.length}` : "Mở đầu / kết thúc"}`;
  }
  if (!batchJobBusy.has("batchExports")) {
    $("batchExports").hidden = doneItems.length === 0;
    $("batchExports").disabled = c.running > 0;
    $("batchExports").title = c.running > 0 ? "Đợi loạt dựng xong rồi xuất thêm khung" : "Render thêm bản khác khung (1:1, 16:9…) cho mọi video đã xong";
    $("batchExports").innerHTML = `${icon("ratio")} Xuất thêm khung`;
  }
  if (!batchJobBusy.has("batchCovers")) {
    const covered = doneItems.filter((it) => it.cover).length;
    const all = doneItems.length > 0 && covered === doneItems.length;
    $("batchCovers").hidden = doneItems.length === 0;
    $("batchCovers").disabled = false;
    $("batchCovers").dataset.force = all ? "1" : "";
    $("batchCovers").innerHTML = all
      ? `${icon("image")} Ảnh bìa đủ ${covered}/${doneItems.length}`
      : `${icon("image")} Tạo ảnh bìa (${doneItems.length - covered})`;
  }

  // Nút Công cụ: ẩn khi mọi mục bên trong đều ẩn; có việc nền đang chạy thì quay; có video cần sửa thì báo số.
  const toolIds = [...$("batchToolsPanel").querySelectorAll("button")];
  $("batchToolsBtn").hidden = toolIds.every((b) => b.hidden);
  $("batchToolsPanel").querySelectorAll(".bt-tools-group").forEach((g) => {
    let el = g.nextElementSibling;
    let any = false;
    while (el && !el.classList.contains("bt-tools-group")) { if (!el.hidden) any = true; el = el.nextElementSibling; }
    g.hidden = !any;
  });
  const busyJobs = [...batchJobBusy].filter((id) => $("batchToolsPanel").contains($(id))).length;
  const toFix = (b.items ?? []).filter((it) => it.status === "done" && it.qa?.issues.some((x) => x.fix)).length;
  $("batchToolsLabel").textContent = busyJobs ? "Công cụ · đang chạy" : toFix ? `Công cụ · ${toFix} cần sửa` : "Công cụ";

  // Cả loạt vừa xong → báo một lần, vì người dùng thường để chạy rồi đi làm việc khác.
  if (batchWasRunning && b.state === "done") notifyBatchDone(b);
  batchWasRunning = b.state === "running";

  // Đang chạy thì tiêu đề tab báo tiến độ — người dùng hay chuyển tab đi chỗ khác chờ.
  document.title = b.state === "running" && c.running + c.waiting > 0
    ? `(${c.done}/${c.total}) ${b.name} · ${BASE_TITLE}`
    : BASE_TITLE;

  // Đang mở ô nhập để sửa thì đừng vẽ lại lưới — vẽ lại là mất chữ đang gõ.
  if (batchEdit === null) {
    $("batchItems").innerHTML = b.items.map(batchItemTile).join("");
    bindBatchTiles();
    mountBatchVideos();
  }

  // Có video vừa xong → thanh lịch sử bên trái hiện luôn, khỏi phải tải lại trang.
  if (c.done !== batchDoneSeen) {
    if (batchDoneSeen !== -1) loadHistory();
    batchDoneSeen = c.done;
  }
}

/**
 * Còn bao lâu nữa — tính từ chính những video đã xong trong loạt này, không đoán mò.
 * Hàng đợi chạy lần lượt nên thời gian còn lại ≈ trung bình một video × số video còn lại.
 */
function batchEta(b) {
  const done = b.items.filter((i) => i.status === "done" && i.startedAt && i.finishedAt);
  const left = b.items.filter((i) => BT_BUSY.includes(i.status)).length;
  if (done.length === 0 || left === 0 || b.state !== "running") return "";
  const avg = done.reduce((sum, i) => sum + (i.finishedAt - i.startedAt), 0) / done.length;
  const seconds = Math.round((avg * left) / 1000);
  const rough = seconds < 90 ? `${Math.max(5, Math.round(seconds / 5) * 5)} giây` : `${Math.ceil(seconds / 60)} phút`;
  return `≈ còn ${rough} (theo ${done.length} video đã xong)`;
}

/**
 * Video chỉ được gắn khi ô nằm trong tầm nhìn. Một loạt 50 video mà gắn hết cùng lúc là
 * 50 kết nối tải metadata — trang khựng hẳn vài giây.
 *
 * Kiểm bằng vị trí thật chứ không dùng IntersectionObserver: trong khung xem nhúng (và ở tab
 * chạy nền) observer có lúc không bắn callback lần nào, ô sẽ đứng im mãi ở chỗ giữ khung.
 */
function mountBatchVideos() {
  const frames = [...$("batchItems").querySelectorAll(".bt-frame[data-video]")];
  if (frames.length === 0) return;
  const height = window.innerHeight || 800;
  for (const frame of frames) {
    const box = frame.getBoundingClientRect();
    // Khung chưa có kích thước = màn đang ẩn; đợi lần vẽ hoặc lần cuộn sau.
    if (box.width === 0 && box.height === 0) continue;
    if (box.top > height + 400 || box.bottom < -400) continue;
    const src = frame.dataset.video;
    delete frame.dataset.video;
    frame.classList.remove("bt-lazy");
    frame.innerHTML = `<video src="${escapeHtml(src)}" controls preload="metadata" playsinline></video>`;
  }
}

/** Thay ảnh bìa bằng video thật và phát luôn — chỉ nạp đúng video người dùng muốn xem. */
function playBatchVideo(frame) {
  const src = frame.dataset.play;
  if (!src) return;
  delete frame.dataset.play;
  frame.removeAttribute("role");
  frame.removeAttribute("tabindex");
  frame.innerHTML = `<video src="${escapeHtml(src)}" controls autoplay playsinline></video>`;
}

/** Tỉ lệ khung của một mục — để khung video không bị viền đen và lưới không nhảy. */
function itemAspect(it) {
  const id = it.override?.aspect ?? batchCur?.settings.aspect ?? "9:16";
  const known = aspects.find((a) => a.id === id);
  const [w, h] = known ? [known.width, known.height] : id.split(":").map(Number);
  return { w: w || 9, h: h || 16 };
}

/** Cắt cho vừa một dòng — ô dán cả kịch bản vào thì `input` dài cả đoạn. */
const shorten = (text, max = 90) => {
  const one = String(text ?? "").replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
};

/**
 * Một mục = một ô chữ nhật giống hệt ô lúc soạn. Xong thì chính ô đó hiện video;
 * bấm vào ô (hoặc nút Sửa) là ra lại ô nhập để sửa nội dung rồi làm lại.
 */
/** Điểm tự soát trên ô video: bấm để mở/đóng danh sách điểm cần xem. */
function qaBadge(it) {
  const qa = it.qa;
  if (!qa) return `<p class="bt-qa none">${icon("scan-search")} Chưa soát</p>`;
  const cls = qa.issues.some((x) => x.level === "error") || qa.score < 6 ? "bad" : qa.score < QA_GOOD ? "warn" : "good";
  const open = batchQaOpen.has(it.id);
  const stats = [
    `${qa.stats.seconds}s`,
    qa.stats.lufs === null ? "" : `${qa.stats.lufs} LUFS`,
  ].filter(Boolean).join(" · ");
  const head = qa.issues.length
    ? `<button type="button" class="bt-qa ${cls}" data-act="qa" data-id="${it.id}" aria-expanded="${open}">
        ${icon(cls === "good" ? "circle-check" : "triangle-alert")} Tự soát ${qa.score}/10 · ${qa.issues.length} điểm cần xem ${icon(open ? "chevron-up" : "chevron-down")}</button>`
    : `<p class="bt-qa good">${icon("circle-check")} Tự soát ${qa.score}/10 · ${escapeHtml(stats)}</p>`;
  const fixable = qa.issues.some((x) => x.fix);
  const list = open && qa.issues.length
    ? `<ul class="bt-qa-list">${qa.issues.map((x) => `<li class="${x.level}">${escapeHtml(x.text)}${
      x.fix ? ` <span class="bt-qa-fixable">sửa được</span>` : ""}</li>`).join("")}</ul>${
      fixable ? `<button type="button" class="btn bt-qa-fix" id="qafix-${it.id}" data-act="qa-fix" data-id="${it.id}"
        title="Chuẩn hoá âm lượng, kéo chữ vào vùng an toàn — lưu thành bản mới">${icon("wand-sparkles")} Sửa tự động</button>` : ""}`
    : "";
  return head + list;
}

function batchItemTile(it, i) {
  if (batchEdit?.itemId === it.id) return batchEditTile(it, i);

  const busy = it.status === "preparing" || it.status === "building";
  const title = shorten(it.title || it.input);
  const bits = [];
  if (busy && it.step) bits.push(`bước ${BT_STEP[it.step] ?? it.step}`);
  if (it.scenes) bits.push(`${it.scenes} cảnh`);
  if (it.title && it.input && it.input !== it.title) bits.push(shorten(it.input, 60));
  if (it.edited) bits.push("đã chỉnh sửa");
  if (it.exports?.length) bits.push(`có thêm ${it.exports.join(", ")}`);
  if (it.branded) bits.push("có bản mở đầu/kết thúc");
  const slot = batchCur?.postPlan?.slots[it.id];
  if (slot) bits.push(`đăng ${fmtSlot(slot)}`);

  const btn = (act, label, cls = "") =>
    `<button type="button" class="btn ${cls}" data-act="${act}" data-id="${it.id}">${label}</button>`;
  // Mục dựng từ file thu sẵn hoặc từ video gốc không có "nội dung đã gõ" để sửa lại.
  const editable = !it.file && !it.variant && !it.edit && !busy;
  // Có kịch bản (script.json) thì sửa được cả lời — kể cả biến thể; file thu sẵn thì không có kịch bản.
  // Sửa hàng loạt kiểu giữ chỉnh sửa: lời không đổi, sửa lời thì mở trình chỉnh sửa.
  const scriptEditable = !it.file && it.edit !== "props" && !busy && Boolean(it.slug);

  const actions = [];
  if (it.status === "review") {
    actions.push(btn("approve", `${icon("check")} Duyệt`, "primary"));
    if (it.slug) actions.push(btn("edit", `${icon("pencil")} Sửa lời`));
    actions.push(btn("skip", `${icon("skip-forward")} Bỏ`));
  } else if (it.status === "error") {
    actions.push(btn("retry", `${icon("rotate-cw")} Thử lại`));
    if (editable || (scriptEditable && it.slug)) actions.push(btn("edit", `${icon("pen-line")} Sửa nội dung`));
    actions.push(`<button type="button" class="btn" data-act="remove" data-id="${it.id}" title="Bỏ khỏi loạt" aria-label="Bỏ khỏi loạt">${icon("trash-2")}</button>`);
  } else if (it.status === "done") {
    if (it.slug) actions.push(`<a class="btn" href="#/v/${it.slug}">${icon("play")} Mở</a>`);
    // Sửa từng video rồi mới tải cả loạt: mở tab mới để bảng theo dõi vẫn còn; bấm "Xuất video" là gói tải về lấy bản đã sửa.
    if (it.slug) {
      actions.push(`<a class="btn" href="/editor.html#${encodeURIComponent(it.slug)}" target="_blank" rel="noopener"
        title="Mở trình chỉnh sửa ở tab mới — sửa xong bấm Xuất video, gói Tải tất cả sẽ lấy bản đã sửa">${icon("scissors")} Chỉnh sửa</a>`);
    }
    if (it.mp4) actions.push(`<a class="btn" href="${escapeHtml(it.mp4)}" download>${icon("download")} Tải</a>`);
    if (it.cover) actions.push(`<a class="btn" href="${escapeHtml(it.cover)}" target="_blank" rel="noopener" title="Xem ảnh bìa — tải cả loạt thì có file .jpg cạnh mỗi video">${icon("image")} Ảnh bìa</a>`);
    if (it.slug) actions.push(`<button type="button" class="btn" data-act="post-copy" data-slug="${escapeHtml(it.slug)}" title="Tiêu đề, caption, hashtag để đăng video này">${icon("megaphone")} Bài đăng</button>`);
    if (scriptEditable) actions.push(btn("edit", `${icon("pen-line")} Sửa lời`));
    else actions.push(btn("retry", `${icon("rotate-cw")} Làm lại`));
  } else if (it.status === "skipped") {
    actions.push(btn("retry", `${icon("undo-2")} Đưa lại`));
  } else if (!busy) {
    actions.push(btn("skip", `${icon("skip-forward")} Bỏ`));
  }

  // Thân ô: video khi xong, khung chờ + tiến độ khi đang chạy, lời để duyệt khi chờ duyệt.
  const { w, h } = itemAspect(it);
  const frame = (inner, cls = "") =>
    `<div class="bt-frame ${cls}" style="aspect-ratio:${w}/${h};--arn:${(w / h).toFixed(4)}"${inner}></div>`;
  let body = "";
  if (it.status === "done" && it.mp4) {
    // Ảnh bìa nhẹ hơn thẻ video rất nhiều; bấm vào mới nạp video thật (xem playBatchVideo).
    body = it.poster
      ? `<div class="bt-frame" style="aspect-ratio:${w}/${h};--arn:${(w / h).toFixed(4)}"
           data-play="${escapeHtml(it.mp4)}" role="button" tabindex="0" title="Bấm để xem">
           <img src="/public/${escapeHtml(it.poster)}?t=${escapeHtml(it.mp4.split("?t=")[1] ?? "")}" alt="" loading="lazy" /><span class="bt-play">${icon("play")}</span></div>`
      : frame(` data-video="${escapeHtml(it.mp4)}"`, "bt-lazy");
  } else if (it.status === "done" && it.images?.length) {
    body = `<div class="bt-frame" style="aspect-ratio:${w}/${h};--arn:${(w / h).toFixed(4)}">
      <img src="/out/scenes/${escapeHtml(it.images[0].split("/").pop())}" alt="" loading="lazy" /></div>`;
  } else if (busy) {
    body = frame("", "blank") +
      `<div class="bt-bar"><i style="width:${Math.max(3, it.progress || 0)}%"></i></div>` +
      (it.log?.length ? `<p class="bt-log">${escapeHtml(it.log[it.log.length - 1])}</p>` : "");
  } else if (it.status === "review" && it.lines?.length) {
    body = `<div class="bt-lines"><p>${it.lines.slice(0, 8).map(escapeHtml).join("<br>")}${
      it.lines.length > 8 ? `<br><span class="muted">… còn ${it.lines.length - 8} câu</span>` : ""}</p></div>`;
  }

  const stateCls = { done: "done", error: "err", review: "review", preparing: "run", building: "run" }[it.status] ?? "";
  return `<div class="bt-card tile ${busy ? "on" : ""} ${it.status === "error" ? "err" : ""}"
      ${editable || scriptEditable ? `data-item-open="${it.id}" role="button" tabindex="0"` : ""}>
    <div class="bt-card-head">
      <span>Video ${i + 1}</span><span class="spacer"></span>
      <span class="bt-state ${stateCls}">${BT_BADGE[it.status] ?? "•"} ${BT_LABEL[it.status] ?? it.status}</span>
    </div>
    ${body}
    <p class="bt-card-preview">${escapeHtml(title)}</p>
    ${bits.length ? `<p class="bt-card-own">${escapeHtml(bits.join(" · "))}</p>` : ""}
    ${it.error ? `<p class="bt-err">${escapeHtml(it.error)}</p>` : ""}
    ${it.status === "done" ? qaBadge(it) : ""}
    ${it.draft ? `<p class="bt-err" title="Gói Tải tất cả dùng bản đã xuất gần nhất">${icon("triangle-alert")} Có chỉnh sửa chưa xuất — mở Chỉnh sửa, bấm Xuất video để tải bản mới.</p>` : ""}
    <div class="bt-actions">${actions.join("")}</div>
  </div>`;
}

/**
 * Ô đang mở để sửa. Hai kiểu:
 * - "script": toàn bộ lời đã viết (tiêu đề, cảnh, nhãn, câu nhấn) — sửa hoặc dán đè, lưu là dựng lại từ đúng
 *   lời đó, không gọi AI. Mục đang chờ duyệt thì Lưu & duyệt.
 * - "idea": nội dung đã gõ lúc tạo loạt (thường là một câu ý tưởng) — lưu là AI viết lại lời từ đầu.
 */
function batchEditTile(it, i) {
  const btnAct = (act, label, cls = "") =>
    `<button type="button" class="btn ${cls}" data-act="${act}" data-id="${it.id}">${label}</button>`;
  const script = batchEdit.kind === "script";
  const actions = script
    ? [
      it.status === "review"
        ? btnAct("save-approve", `${icon("check")} Lưu &amp; duyệt`, "primary") + btnAct("save-script", `${icon("save")} Lưu lời`)
        : btnAct("save-script", `${icon("save")} Lưu &amp; dựng lại`, "primary"),
      btnAct("cancel", "Huỷ"),
      `<span class="spacer"></span>`,
      it.variant ? "" : btnAct("edit-idea", `${icon("wand-sparkles")} Viết lại từ ý tưởng (AI)`),
    ]
    : [btnAct("save", `${icon("save")} Lưu &amp; làm lại`, "primary"), btnAct("cancel", "Huỷ")];
  const help = script
    ? `<p class="bt-edit-help">Toàn bộ lời của video — sửa thẳng hoặc dán đè lời mới. Mỗi dòng một câu, dòng trống sang cảnh mới,
        <code>[nhãn]</code> ở đầu cảnh, <code>**câu nhấn**</code>, <code>! con số | chú thích</code>.
        ${it.status === "review" ? "" : "Lưu là dựng lại từ đúng lời này, không gọi AI viết lại; ảnh các cảnh cũ được giữ."}
        ${it.edited ? " Chỉnh sửa trong trình chỉnh sửa sẽ không áp vào bản dựng lại (bản cũ vẫn còn trong lịch sử video)." : ""}</p>`
    : `<p class="bt-edit-help">${it.slug ? "Đổi nội dung rồi lưu: AI viết lại lời từ đầu cho video này." : "Sửa nội dung rồi lưu để làm lại video này."}</p>`;
  return `<div class="bt-card editing${script ? " script" : ""}">
    <div class="bt-card-head">
      <span>Video ${i + 1} · ${script ? "Sửa lời" : "Sửa nội dung"}</span><span class="spacer"></span>
      <button type="button" class="icon-btn" data-act="cancel" data-id="${it.id}" aria-label="Đóng">${icon("x")}</button>
    </div>
    ${help}
    <textarea data-edit-text spellcheck="false" aria-label="${script ? "Lời" : "Nội dung"} video ${i + 1}"></textarea>
    ${cardChipsHtml(it.id, batchEdit.settings)}
    ${batchEdit.error ? `<p class="bt-err">${escapeHtml(batchEdit.error)}</p>` : ""}
    <div class="bt-actions">${actions.join("")}</div>
  </div>`;
}

/** Sau mỗi lần vẽ lưới: đổ chữ vào ô đang sửa và nhớ những gì người dùng gõ. */
function bindBatchTiles() {
  const box = $("batchItems").querySelector("[data-edit-text]");
  if (!box || !batchEdit) return;
  box.value = batchEdit.text;
  box.addEventListener("input", () => { batchEdit.text = box.value; });
  box.focus({ preventScroll: true });
  // Cả kịch bản thì đặt con trỏ ở đầu để đọc từ tiêu đề; một câu ý tưởng thì đặt cuối để gõ tiếp.
  const at = batchEdit.kind === "script" ? 0 : box.value.length;
  box.setSelectionRange(at, at);
  box.closest(".bt-card")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/**
 * Báo cả loạt đã xong: thông báo hệ điều hành (nếu người dùng cho phép) + một tiếng "ting"
 * tự tổng hợp bằng WebAudio, khỏi kèm file âm thanh.
 */
function notifyBatchDone(b) {
  const c = b.counts;
  const text = `${c.done}/${c.total} video xong${c.error ? ` · ${c.error} lỗi` : ""}`;
  try {
    if (window.Notification && Notification.permission === "granted") {
      new Notification(`Xong loạt “${b.name}”`, { body: text, tag: `batch-${b.id}` });
    }
  } catch {
    // Trình duyệt nhúng có thể chặn — không sao, vẫn còn tiếng chuông và tiêu đề tab.
  }
  try {
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const now = audio.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.3);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.32);
    }
    setTimeout(() => audio.close(), 1200);
  } catch {
    // Chưa có tương tác với trang thì trình duyệt chặn âm thanh — bỏ qua.
  }
}

/** Cài đặt riêng của một mục, so với cài đặt chung của loạt — để chip hiện "Theo chung" cho đúng. */
function ownSettings(it) {
  const shared = batchCur?.settings ?? {};
  const own = {};
  for (const key of BT_CARD_KEYS) {
    const value = it.override?.[key];
    if (value === undefined || value === shared[key]) continue;
    if (key === "music") own.music = value === null ? "none" : value;
    else if (key === "voice") own.voice = value === "" ? "none" : value;
    else own[key] = value;
  }
  // Clip video AI đi kèm nguồn hình — giữ cả hai để chip hiện đúng.
  if (it.override?.video && it.override.video !== shared.video) own.video = it.override.video;
  return own;
}

/**
 * Mở ô sửa của một mục. Mục đã có kịch bản thì hiện TOÀN BỘ lời để sửa/thay; chưa có (lỗi trước bước viết lời)
 * hoặc `kind` = "idea" thì hiện nội dung đã gõ lúc tạo loạt.
 */
async function openBatchEdit(itemId, kind = "script") {
  const batchId = batchCur?.id;
  const it = batchCur?.items.find((item) => item.id === itemId);
  if (!it || it.file) return;
  let text = null;
  if (kind === "script" && it.slug) {
    try {
      ({ text } = await api(`/api/batch/${batchId}/script?item=${encodeURIComponent(itemId)}`));
    } catch {
      text = null;
    }
    if (batchCur?.id !== batchId) return;   // đã sang loạt khác trong lúc chờ
  }
  if (text == null && it.variant) {
    $("batchRunHint").textContent = "Video này chưa có lời để sửa — bấm Thử lại.";
    return;
  }
  batchEdit = text != null
    ? { itemId, kind: "script", text, settings: ownSettings(it) }
    : { itemId, kind: "idea", text: it.input, settings: ownSettings(it) };
  $("batchItems").innerHTML = batchCur.items.map(batchItemTile).join("");
  bindBatchTiles();
}

/** Lưu lời đã sửa. Lỗi (cú pháp, đang chạy…) thì ô vẫn mở, giữ nguyên chữ để sửa tiếp. */
async function saveBatchScript(itemId, approve) {
  if (!batchEdit || !batchCur || batchEdit.kind !== "script") return;
  const edit = batchEdit;
  const text = edit.text.trim();
  const redraw = () => {
    $("batchItems").innerHTML = batchCur.items.map(batchItemTile).join("");
    bindBatchTiles();
  };
  if (!text) { edit.error = "Lời đang trống — dán hoặc gõ lời trước đã."; return redraw(); }
  try {
    await postJson(`/api/batch/${batchCur.id}/script`, { itemId, text, settings: cardSettings(edit), approve });
    if (batchEdit === edit) batchEdit = null;
    await loadBatch(batchCur.id);
  } catch (e) {
    edit.error = e.message;
    if (batchEdit === edit) redraw();
  }
}

function closeBatchEdit() {
  batchEdit = null;
  renderBatchRun();
}

async function saveBatchEdit(itemId) {
  if (!batchEdit || !batchCur) return;
  const text = batchEdit.text.trim();
  if (!text) { $("batchRunHint").textContent = "Nhập nội dung trước đã."; return; }
  const body = { itemId, text, settings: cardSettings(batchEdit) };
  batchEdit = null;
  try {
    await postJson(`/api/batch/${batchCur.id}/edit`, body);
    await loadBatch(batchCur.id);
  } catch (e) {
    $("batchRunHint").textContent = e.message;
    $("batchRunHint").classList.add("err");
  }
}

async function onBatchItemClick(e) {
  if (!batchCur) return;

  // Chip cài đặt riêng của ô đang sửa.
  const chip = e.target.closest("[data-card-chip]");
  if (chip && batchEdit) {
    return openMenu(chip, cardMenuFor(chip.dataset.cardChip, batchEdit, () => {
      $("batchItems").innerHTML = batchCur.items.map(batchItemTile).join("");
      bindBatchTiles();
    }));
  }

  // Bấm ảnh bìa = xem video, không phải sửa.
  const poster = e.target.closest("[data-play]");
  if (poster) return playBatchVideo(poster);

  const button = e.target.closest("[data-act]");
  if (!button) {
    // Bấm vào chính ô (không phải nút, link hay video) thì mở ô nhập để sửa.
    const tile = e.target.closest("[data-item-open]");
    if (tile && !e.target.closest("button, a, video, .bt-frame, .bt-lines")) {
      openBatchEdit(tile.dataset.itemOpen);
    }
    return;
  }
  const { act, id } = button.dataset;
  if (act === "post-copy") return openPostCopy(button.dataset.slug);
  if (act === "qa-fix") {
    return runBatchJob("fix", button, (run) => (run.running ? "Đang sửa…" : "Xong"), { ids: [id] });
  }
  if (act === "qa") {
    if (batchQaOpen.has(id)) batchQaOpen.delete(id); else batchQaOpen.add(id);
    return renderBatchRun();
  }
  if (act === "edit") return openBatchEdit(id);
  if (act === "edit-idea") return openBatchEdit(id, "idea");
  if (act === "save-script") return saveBatchScript(id, false);
  if (act === "save-approve") return saveBatchScript(id, true);
  if (act === "cancel") return closeBatchEdit();
  if (act === "save") return saveBatchEdit(id);
  if (act === "remove") {
    const ok = await confirmDialog({
      title: "Bỏ mục này khỏi loạt?",
      message: "Video đã tạo (nếu có) vẫn giữ trong Thư viện.",
      okText: "Bỏ khỏi loạt",
    });
    if (!ok) return;
  }
  button.disabled = true;
  await batchAction(act, [id]);
}

async function batchAction(act, ids) {
  if (!batchCur) return;
  $("batchRunHint").textContent = "";
  try {
    await postJson(`/api/batch/${batchCur.id}/${act}`, ids ? { ids } : {});
    await loadBatch(batchCur.id);
  } catch (e) {
    $("batchRunHint").textContent = e.message;
    $("batchRunHint").classList.add("err");
  }
}

// ---- lỗi gom theo nguyên nhân (server/batch.ts, errorGroup) ----
const BT_ERR_GROUPS = {
  wait: { icon: "hourglass", title: "Lỗi tạm thời", hint: "AI hết lượt trong phút, máy chủ quá tải hoặc mạng chập chờn — đợi một chút rồi chạy lại là được.", actions: ["retry"] },
  quota: { icon: "calendar-x", title: "Hết lượt trong ngày / hết tiền", hint: "Thêm key nhà cung cấp khác (Gemini, Groq, OpenRouter có gói miễn phí) rồi chạy lại, hoặc đợi sang ngày mai.", actions: ["settings", "retry"] },
  key: { icon: "key-round", title: "Thiếu key hoặc key sai", hint: "Kiểm tra key trong Cài đặt rồi chạy lại.", actions: ["settings", "retry"] },
  content: { icon: "file-warning", title: "Lỗi nội dung", hint: "AI trả sai định dạng hoặc lời quá dài — chạy lại thường qua; vẫn lỗi thì bấm vào ô để sửa nội dung.", actions: ["retry"] },
  missing: { icon: "file-x", title: "Thiếu file", hint: "File gốc hoặc kịch bản không còn — chạy lại cũng không được, bỏ các mục này khỏi loạt.", actions: ["remove"] },
  other: { icon: "circle-alert", title: "Lỗi khác", hint: "Bấm vào từng ô để xem chi tiết.", actions: ["retry"] },
};

/** Mỗi nhóm lỗi một dòng: số mục, cách xử lý, nút làm cho cả nhóm. Chỉ một loại lỗi thì vẫn hiện — dòng gợi ý có ích. */
function renderBatchErrGroups(b) {
  const groups = {};
  for (const it of b.items) {
    if (it.status !== "error") continue;
    (groups[it.errorGroup ?? "other"] ??= []).push(it.id);
  }
  const keys = Object.keys(BT_ERR_GROUPS).filter((k) => groups[k]);
  $("batchErrGroups").hidden = keys.length === 0;
  $("batchErrGroups").innerHTML = keys.map((k) => {
    const g = BT_ERR_GROUPS[k];
    const ids = groups[k].join(",");
    const buttons = g.actions.map((act) => act === "settings"
      ? `<button type="button" class="btn" data-errgroup-act="settings">${icon("settings")} Mở Cài đặt</button>`
      : act === "remove"
        ? `<button type="button" class="btn" data-errgroup-act="remove" data-ids="${ids}">${icon("trash-2")} Bỏ ${groups[k].length} mục</button>`
        : `<button type="button" class="btn" data-errgroup-act="retry" data-ids="${ids}">${icon("rotate-cw")} Chạy lại ${groups[k].length}</button>`).join("");
    return `<div class="bt-errgroup">${icon(g.icon)} <b>${g.title} · ${groups[k].length}</b><span class="muted">${g.hint}</span>${buttons}</div>`;
  }).join("");
}

async function onBatchErrGroupClick(e) {
  const button = e.target.closest("[data-errgroup-act]");
  if (!button) return;
  const act = button.dataset.errgroupAct;
  if (act === "settings") return openSettings();
  const ids = button.dataset.ids.split(",");
  if (act === "remove") {
    const ok = await confirmDialog({
      title: `Bỏ ${ids.length} mục khỏi loạt?`,
      message: "Chỉ bỏ khỏi loạt — video đã tạo (nếu có) vẫn còn trong Thư viện.",
      okText: "Bỏ khỏi loạt",
    });
    if (!ok) return;
  }
  button.disabled = true;
  await batchAction(act, ids);
}

// ---- việc chạy nền cho cả loạt (tự soát, ảnh bìa): server chạy, ở đây chỉ hỏi tiến độ ----
/** Nút đang chờ việc nền — lúc đó lần vẽ lại loạt không đè nhãn tiến độ của nó. */
const batchJobBusy = new Set();

/**
 * POST /api/batch/<id>/<action> rồi hỏi GET cùng đường dẫn tới khi xong; xong thì nạp lại loạt.
 * `label(run)` = nhãn nút trong lúc chạy.
 */
async function runBatchJob(action, button, label, body = {}) {
  if (!batchCur) return;
  const id = batchCur.id;
  button.disabled = true;
  batchJobBusy.add(button.id);
  $("batchRunHint").textContent = "";
  $("batchRunHint").classList.remove("err");
  const finish = (run) => {
    batchJobBusy.delete(button.id);
    if (run?.failed) {
      $("batchRunHint").textContent = `${run.failed} video lỗi: ${run.error ?? ""}`;
      $("batchRunHint").classList.add("err");
    }
    if (batchCur?.id === id) loadBatch(id);
  };
  try {
    let { run } = await postJson(`/api/batch/${id}/${action}`, body);
    const tick = () => {
      button.innerHTML = `${icon("loader-circle", "spin")} ${label(run)}`;
      // Nút nằm trong menu Công cụ (thường đang đóng): hiện tiến độ ngay trên nút Công cụ.
      if ($("batchToolsPanel").contains(button)) $("batchToolsLabel").textContent = `Công cụ · ${label(run)}`;
      if (!run.running) return finish(run);
      setTimeout(async () => {
        try { ({ run } = await api(`/api/batch/${id}/${action}`)); } catch { /* thử lại ở nhịp sau */ }
        tick();
      }, 1200);
    };
    tick();
  } catch (e) {
    finish(null);
    $("batchRunHint").textContent = e.message;
    $("batchRunHint").classList.add("err");
  }
}

/** Menu xuất thêm khung: một khung, hoặc mọi khung khác khung gốc. Chạy lại được để thêm khung khác. */
function openBatchExportMenu() {
  const own = new Set((batchCur?.items ?? []).filter((it) => it.status === "done").map((it) => it.override?.aspect ?? batchCur.settings.aspect));
  const others = aspects.filter((a) => !own.has(a.id) || own.size > 1);
  openMenu($("batchExports"), {
    id: "batchExports", title: "Xuất thêm khung cho cả loạt", value: "",
    onPick: (value) => {
      const list = value === "all" ? others.map((a) => a.id) : [value];
      runBatchJob("exports", $("batchExports"), (run) => `Đang xuất ${run.done + run.failed}/${run.total}…`, { aspects: list });
    },
    options: [
      ...others.map((a) => ({ value: a.id, icon: icon("ratio"), title: a.id, sub: `${a.label.split("—")[1]?.trim() ?? ""} · ${a.width}×${a.height}` })),
      { value: "all", icon: icon("layers"), title: "Tất cả khung trên", sub: "Render mỗi video thêm một bản cho từng khung — lâu bằng ngần ấy lần dựng" },
    ],
  });
}

// ---- kết quả sau khi đăng (server/batch.ts › saveResults) ----
const RS_PLATFORMS = [["tiktok", "TikTok"], ["youtube", "YouTube"], ["facebook", "Facebook"], ["instagram", "Instagram"]];
const RS_COLS = [["views", "Lượt xem"], ["watch", "% xem hết"], ["likes", "Thích"], ["comments", "Bình luận"], ["shares", "Chia sẻ"]];
const HOOK_LETTERS = "ABCDE";
let resultsPlatform = "tiktok";

const resultRows = () => (batchCur?.items ?? []).filter((it) => it.status === "done");
const fmtNum = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(Math.round(n)));

/** Đọc số giống server (parseStat) để phần tóm tắt tính ngay khi gõ, chưa cần lưu. */
function parseStatInput(raw) {
  let text = String(raw ?? "").trim().toLowerCase().replace(/%$/, "").trim();
  if (!text) return null;
  const unit = /(k|n|nghìn|ngàn|m|tr|triệu|b|tỷ)$/.exec(text)?.[1];
  if (unit) text = text.slice(0, -unit.length).trim();
  text = text.replace(/\s/g, "").replace(/[.,](?=\d{3}(?:[.,]|$))/g, "").replace(",", ".");
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return n * (!unit ? 1 : /^(k|n|nghìn|ngàn)$/.test(unit) ? 1e3 : /^(m|tr|triệu)$/.test(unit) ? 1e6 : 1e9);
}

function readResultInputs() {
  const rows = {};
  $("resultsTable").querySelectorAll("tr[data-id]").forEach((tr) => {
    const row = {};
    tr.querySelectorAll("input[data-k]").forEach((input) => { row[input.dataset.k] = input.value.trim(); });
    rows[tr.dataset.id] = row;
  });
  return rows;
}

function renderResultsTable() {
  $("resultsTabs").innerHTML = RS_PLATFORMS.map(([id, label]) =>
    `<button type="button" role="tab" data-rs-platform="${id}" aria-selected="${id === resultsPlatform}">${label}${
      batchCur.results?.[id] ? ` · ${Object.keys(batchCur.results[id]).length}` : ""}</button>`).join("");
  const saved = batchCur.results?.[resultsPlatform] ?? {};
  $("resultsTable").innerHTML = `<thead><tr><th>#</th><th>Video</th>${RS_COLS.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${
    resultRows().map((it) => {
      const i = batchCur.items.indexOf(it);
      const hook = it.variant?.hook;
      return `<tr data-id="${it.id}"><td>${i + 1}</td><td class="t">${hook === undefined ? "" : `<span class="hook">Hook ${HOOK_LETTERS[hook]}</span>`}${escapeHtml(shorten(it.title || it.input, 60))}</td>${
        RS_COLS.map(([k]) => `<td><input data-k="${k}" inputmode="decimal" value="${saved[it.id]?.[k] ?? ""}" aria-label="${k}" /></td>`).join("")}</tr>`;
    }).join("")}</tbody>`;
  renderResultsSummary();
}

/** Video nhiều lượt xem nhất, giữ chân tốt nhất; loạt thử hook thì so trung bình từng hook với bản gốc A. */
function renderResultsSummary() {
  const rows = readResultInputs();
  const data = resultRows().map((it) => ({
    it,
    views: parseStatInput(rows[it.id]?.views),
    watch: parseStatInput(rows[it.id]?.watch),
  }));
  const withViews = data.filter((d) => d.views !== null);
  const lines = [];
  if (withViews.length === 0) {
    $("resultsSummary").innerHTML = `<span class="muted">Nhập lượt xem của vài video để thấy video nào tốt nhất.</span>`;
    return;
  }
  const best = [...withViews].sort((a, b) => b.views - a.views)[0];
  lines.push(`${icon("trophy")} Nhiều lượt xem nhất: <b>${escapeHtml(shorten(best.it.title || best.it.input, 50))}</b> — ${fmtNum(best.views)} lượt`);
  const withWatch = data.filter((d) => d.watch !== null);
  if (withWatch.length) {
    const keep = [...withWatch].sort((a, b) => b.watch - a.watch)[0];
    lines.push(`${icon("timer")} Giữ chân tốt nhất: <b>${escapeHtml(shorten(keep.it.title || keep.it.input, 50))}</b> — ${keep.watch}% xem hết`);
  }
  // Loạt thử hook: gom theo hook (một hook có thể có nhiều bản khác khung/giọng) rồi lấy trung bình.
  const byHook = new Map();
  for (const d of data) {
    const hook = d.it.variant?.hook;
    if (hook === undefined || (d.views === null && d.watch === null)) continue;
    const g = byHook.get(hook) ?? { views: [], watch: [] };
    if (d.views !== null) g.views.push(d.views);
    if (d.watch !== null) g.watch.push(d.watch);
    byHook.set(hook, g);
  }
  if (byHook.size > 1) {
    const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
    const hooks = [...byHook.entries()].map(([hook, g]) => ({ hook, views: avg(g.views), watch: avg(g.watch) }));
    // Hook quyết định người xem có ở lại — so theo % xem hết nếu có, không thì theo lượt xem.
    const metric = hooks.every((h) => h.watch !== null) ? "watch" : "views";
    const win = [...hooks].sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1))[0];
    const base = hooks.find((h) => h.hook === 0);
    const diff = base && base[metric] ? Math.round(((win[metric] - base[metric]) / base[metric]) * 100) : null;
    lines.push(`${icon("flask-conical")} Hook thắng: <b>Hook ${HOOK_LETTERS[win.hook]}</b> — ${
      metric === "watch" ? `${win.watch.toFixed(1)}% xem hết` : `${fmtNum(win.views)} lượt xem`} trung bình${
      win.hook !== 0 && diff !== null ? ` (${diff >= 0 ? "+" : ""}${diff}% so với hook gốc A)` : win.hook === 0 ? " — hook gốc vẫn tốt nhất" : ""}. ` +
      `<span class="muted">${hooks.sort((a, b) => a.hook - b.hook).map((h) => `${HOOK_LETTERS[h.hook]}: ${
        metric === "watch" ? `${h.watch.toFixed(1)}%` : fmtNum(h.views)}`).join(" · ")}</span>`);
  }
  $("resultsSummary").innerHTML = lines.map((line) => `<div>${line}</div>`).join("");
}

function openResultsDialog() {
  if (!batchCur) return;
  // Mở ở nền tảng đã có số gần nhất, không thì TikTok.
  resultsPlatform = RS_PLATFORMS.map(([id]) => id).find((id) => batchCur.results?.[id]) ?? "tiktok";
  $("resultsHint").textContent = "";
  renderResultsTable();
  $("resultsDlg").showModal();
}

/** Dán một khối (tab/xuống dòng) vào một ô: rải sang phải và xuống dưới, như dán vào bảng tính. */
function pasteResults(e) {
  const input = e.target.closest("input[data-k]");
  const text = e.clipboardData?.getData("text") ?? "";
  if (!input || !/[\t\n]/.test(text.trim())) return;
  e.preventDefault();
  const trs = [...$("resultsTable").querySelectorAll("tr[data-id]")];
  const r0 = trs.indexOf(input.closest("tr"));
  const c0 = RS_COLS.findIndex(([k]) => k === input.dataset.k);
  text.replace(/\r/g, "").split("\n").filter((line, i, all) => line || i < all.length - 1).forEach((line, r) => {
    line.split("\t").forEach((cell, c) => {
      const target = trs[r0 + r]?.querySelectorAll("input[data-k]")[c0 + c];
      if (target) target.value = cell.trim();
    });
  });
  renderResultsSummary();
}

async function saveResultsDialog(e) {
  e.preventDefault();
  try {
    const { results } = await postJson(`/api/batch/${batchCur.id}/results`, { platform: resultsPlatform, rows: readResultInputs() });
    batchCur.results = results;
    $("resultsHint").textContent = "Đã lưu — có cả trong file CSV.";
    $("resultsHint").classList.remove("err");
    renderResultsTable();
  } catch (err) {
    $("resultsHint").textContent = err.message;
    $("resultsHint").classList.add("err");
  }
}

// ---- nhân cả loạt: loạt "variants" mới với mọi video đã xong làm gốc ----
let clonePick = { langs: [], aspects: [] };

const cloneSources = () => (batchCur?.items ?? []).filter((it) => it.status === "done" && it.slug);

function renderCloneDialog() {
  const chip = (list, value, label, attr) =>
    `<button type="button" class="bt-pick ${list.includes(value) ? "on" : ""}" data-${attr}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  $("cloneLangs").innerHTML = (batchLangs ?? []).map((l) => chip(clonePick.langs, l.code, l.label, "clone-lang")).join("") ||
    `<span class="muted">Đang tải…</span>`;
  $("cloneAspects").innerHTML = aspects.map((a) => chip(clonePick.aspects, a.id, a.id, "clone-aspect")).join("");
  const per = Math.max(1, clonePick.langs.length) * Math.max(1, clonePick.aspects.length);
  const n = cloneSources().length;
  const total = Math.min(50, n * per);
  const changes = clonePick.langs.length || clonePick.aspects.length || $("cloneVoice").value !== "__keep__";
  $("clonePreview").textContent = changes
    ? `${n} video × ${per} bản = ${total} video mới${n * per > 50 ? " (một loạt tối đa 50 — phần dư bị bỏ)" : ""} · dừng cho bạn duyệt lời trước khi dựng`
    : "Chọn ít nhất một ngôn ngữ, một khung, hoặc đổi giọng.";
  // Dịch mà giữ giọng cũ = giọng tiếng Việt đọc lời tiếng Anh. Nhắc chọn giọng đúng ngôn ngữ.
  const voice = state.voices.catalog.find((v) => v.key === $("cloneVoice").value);
  const langs = clonePick.langs.filter((code) => code !== "vi");
  if (langs.length && (!voice || !langs.includes(voice.lang))) {
    $("clonePreview").textContent += langs.length > 1
      ? " · ⚠ Dịch nhiều ngôn ngữ một lượt thì mọi bản dùng chung một giọng — nên nhân từng ngôn ngữ với giọng của ngôn ngữ đó."
      : ` · ⚠ Nên chọn giọng ${batchLangs?.find((l) => l.code === langs[0])?.label ?? langs[0]} — giọng hiện tại đọc lời đã dịch sẽ lơ lớ.`;
  }
  $("cloneGo").disabled = !changes;
}

async function openCloneDialog() {
  if (!batchCur) return;
  clonePick = { langs: [], aspects: [] };
  $("cloneVoice").innerHTML = `<option value="__keep__">Giữ giọng của từng video</option><option value="">Không giọng</option>` +
    state.voices.catalog.filter((v) => !v.paidPlan).map((v) => `<option value="${escapeHtml(v.key)}">${escapeHtml(v.label)}</option>`).join("");
  $("cloneHint").textContent = "";
  $("cloneHint").classList.remove("err");
  renderCloneDialog();
  $("cloneDlg").showModal();
  if (!batchLangs) {
    try { batchLangs = (await api("/api/translate/engines")).languages; } catch { batchLangs = []; }
    renderCloneDialog();
  }
}

async function submitClone(e) {
  e.preventDefault();
  const voice = $("cloneVoice").value;
  const labels = [
    ...clonePick.langs.map((code) => batchLangs?.find((l) => l.code === code)?.label ?? code),
    ...clonePick.aspects,
    ...(voice === "__keep__" ? [] : [voice ? `giọng ${voice}` : "không giọng"]),
  ];
  $("cloneGo").disabled = true;
  try {
    const batch = await postJson("/api/batch", {
      source: "variants",
      name: `${batchCur.name.slice(0, 36)} — ${labels.join(", ")}`.slice(0, 60),
      settings: { ...opts, music: opts.music || null },
      review: true,
      start: true,
      variants: {
        from: cloneSources().map((it) => it.slug),
        languages: clonePick.langs,
        aspects: clonePick.aspects,
        voices: voice === "__keep__" ? [] : [voice],
      },
    });
    $("cloneDlg").close();
    loadHistory();
    location.hash = `#/batch/${batch.id}`;
  } catch (err) {
    $("cloneHint").textContent = err.message;
    $("cloneHint").classList.add("err");
    $("cloneGo").disabled = false;
  }
}

// ---- lịch đăng (server/batch.ts › savePostPlan, batchCalendar) ----
const pad2 = (v) => String(v).padStart(2, "0");
const dateInputValue = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtSlot = (ms) => new Date(ms).toLocaleString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "11:30, 7h, 19:30" → [[11,30],[7,0],[19,30]] theo thứ tự trong ngày; bỏ giờ viết sai. */
function parsePlanTimes(text) {
  const times = String(text).split(/[,;\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean).map((t) => {
    const m = /^(\d{1,2})(?:[:h.](\d{2})?)?$/.exec(t);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    return h < 24 && min < 60 ? [h, min] : null;
  }).filter(Boolean);
  return [...new Map(times.map((t) => [t[0] * 60 + t[1], t])).values()].sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
}

/** Mốc đăng cho các video đã xong, theo thứ tự trong loạt. Bỏ giờ đã qua và (nếu chọn) cuối tuần. */
function planSlots() {
  const done = (batchCur?.items ?? []).filter((it) => it.status === "done");
  const times = parsePlanTimes($("planTimes").value);
  const [y, mo, d] = ($("planStart").value || dateInputValue(new Date())).split("-").map(Number);
  const slots = {};
  if (!times.length) return { slots, done, times };
  const day = new Date(y, mo - 1, d);
  let i = 0;
  for (let guard = 0; i < done.length && guard < 400; guard++) {
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    if (!($("planWeekends").checked && weekend)) {
      for (const [h, min] of times) {
        if (i >= done.length) break;
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min).getTime();
        if (at < Date.now()) continue;
        slots[done[i++].id] = at;
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return { slots, done, times };
}

function renderPlanPreview() {
  const { slots, done, times } = planSlots();
  const at = Object.values(slots);
  $("planPreview").textContent = !times.length ? "Nhập ít nhất một giờ đăng."
    : done.length === 0 ? "Chưa có video nào xong để lên lịch."
      : `${done.length} video · từ ${fmtSlot(Math.min(...at))} tới ${fmtSlot(Math.max(...at))}`;
}

function openPlanDialog() {
  if (!batchCur) return;
  const plan = batchCur.postPlan;
  const first = plan ? Math.min(...Object.values(plan.slots)) : null;
  const tomorrow = new Date(Date.now() + 86_400_000);
  $("planStart").value = dateInputValue(first ? new Date(first) : tomorrow);
  if (!$("planTimes").value) $("planTimes").value = "11:30, 19:30";
  $("planDlg").querySelectorAll(".plan-platforms input").forEach((c) => {
    c.checked = plan ? plan.platforms.includes(c.value) : c.value === "tiktok";
  });
  $("planIcs").hidden = !plan;
  $("planIcs").href = `/api/batch/${batchCur.id}/calendar`;
  $("planClear").hidden = !plan;
  $("planHint").textContent = "";
  $("planHint").classList.remove("err");
  renderPlanPreview();
  $("planDlg").showModal();
}

async function savePlan(slots) {
  const platforms = [...$("planDlg").querySelectorAll(".plan-platforms input:checked")].map((c) => c.value);
  try {
    const { postPlan } = await postJson(`/api/batch/${batchCur.id}/plan`, { slots, platforms });
    batchCur.postPlan = postPlan;
    $("planIcs").hidden = !postPlan;
    $("planClear").hidden = !postPlan;
    $("planHint").textContent = postPlan
      ? `Đã lưu lịch ${Object.keys(postPlan.slots).length} video — bấm Tải file .ics để thêm vào lịch.`
      : "Đã xoá lịch đăng.";
    $("planHint").classList.remove("err");
    renderBatchRun();
  } catch (e) {
    $("planHint").textContent = e.message;
    $("planHint").classList.add("err");
  }
}

// ---- mở đầu / kết thúc chung (server/batch.ts › startBatchBrand) ----
let brandUploadTarget = null;

async function openBrandDialog() {
  if (!batchCur) return;
  const hint = $("brandHint");
  hint.textContent = "Đang tải thư viện…";
  hint.classList.remove("err");
  $("brandDlg").showModal();
  try {
    const { items } = await api("/api/library/media");
    // Chỉ ảnh/video người dùng có — bỏ giọng đọc, ảnh bìa sinh tự động.
    const media = items.filter((m) => (m.kind === "image" || m.kind === "video") && !["voices", "thumbs"].includes(m.root))
      .sort((a, b) => b.at - a.at).slice(0, 80);
    const fill = (id, current) => {
      $(id).innerHTML = `<option value="">Không có</option>` + media.map((m) =>
        `<option value="${escapeHtml(m.path)}">${m.kind === "video" ? "🎬" : "🖼"} ${escapeHtml(m.name)}</option>`).join("");
      if (current && !media.some((m) => m.path === current)) {
        $(id).insertAdjacentHTML("beforeend", `<option value="${escapeHtml(current)}">${escapeHtml(current.split("/").pop())}</option>`);
      }
      $(id).value = current ?? "";
    };
    fill("brandIntro", batchCur.brand?.intro);
    fill("brandOutro", batchCur.brand?.outro);
    const n = batchCur.items.filter((it) => it.status === "done").length;
    $("brandGo").innerHTML = `${icon("play")} Ghép cho ${n} video`;
    hint.textContent = "";
  } catch (e) {
    hint.textContent = e.message;
    hint.classList.add("err");
  }
}

async function uploadBrandFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !brandUploadTarget) return;
  const hint = $("brandHint");
  hint.textContent = `Đang tải ${file.name}…`;
  try {
    const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    const select = $(brandUploadTarget);
    select.insertAdjacentHTML("afterbegin", `<option value="${escapeHtml(body.path)}">${file.type.startsWith("video") ? "🎬" : "🖼"} ${escapeHtml(file.name)}</option>`);
    select.value = body.path;
    hint.textContent = "";
  } catch (err) {
    hint.textContent = `Không tải lên được: ${err.message}`;
    hint.classList.add("err");
  }
}

function submitBrand(e) {
  e.preventDefault();
  const intro = $("brandIntro").value;
  const outro = $("brandOutro").value;
  if (!intro && !outro) {
    $("brandHint").textContent = "Chọn ít nhất một đoạn mở đầu hoặc kết thúc.";
    $("brandHint").classList.add("err");
    return;
  }
  $("brandDlg").close();
  runBatchJob("brand", $("batchBrand"), (run) => `Đang ghép ${run.done + run.failed}/${run.total}…`, { intro, outro });
}

const startBatchCheck = () =>
  runBatchJob("check", $("batchCheck"), (run) => `Đang soát ${run.done}/${run.total}…`);

async function startBatchCovers() {
  // Mọi video đã có bìa mới: bấm là làm lại tất cả (sau khi đổi tên kênh, màu…) — hỏi trước.
  const force = $("batchCovers").dataset.force === "1";
  if (force && !(await confirmDialog({
    title: "Làm lại ảnh bìa cho cả loạt?",
    message: "Mọi video đã có ảnh bìa. Làm lại sẽ thay các ảnh hiện có.",
    okText: "Làm lại tất cả",
  }))) return;
  runBatchJob("covers", $("batchCovers"), (run) => `Đang làm ảnh bìa ${run.done + run.failed}/${run.total}…`, { force });
}

// ---- bài đăng cho cả loạt: chạy nền trên server, ở đây chỉ hỏi tiến độ ----
let batchPostCopyPoll = null;

/** Nút "Viết bài đăng": số video còn thiếu, tiến độ khi đang viết, hay "viết lại" khi đã đủ. */
function renderBatchPostCopy(pc) {
  const button = $("batchPostCopy");
  button.hidden = !pc || pc.videos === 0;
  if (button.hidden) return;
  const run = pc.run;
  button.disabled = Boolean(run?.running);
  if (run?.running) {
    button.innerHTML = run.waiting
      ? `${icon("hourglass")} AI hết lượt, đợi ${run.waiting}s… (${run.done + run.failed}/${run.total})`
      : `${icon("loader-circle", "spin")} Đang viết bài đăng ${run.done + run.failed}/${run.total}…`;
    if (!batchPostCopyPoll) pollBatchPostCopy();
  } else if (pc.ready >= pc.videos) {
    button.innerHTML = `${icon("megaphone")} Bài đăng đủ ${pc.ready}/${pc.videos}`;
    button.dataset.force = "1";
  } else {
    button.innerHTML = `${icon("megaphone")} Viết bài đăng (${pc.videos - pc.ready})`;
    delete button.dataset.force;
  }
}

async function startBatchPostCopy() {
  if (!batchCur) return;
  const force = $("batchPostCopy").dataset.force === "1";
  if (force) {
    const ok = await confirmDialog({
      title: "Viết lại bài đăng cho cả loạt?",
      message: "Mọi video đã có gợi ý rồi. Viết lại sẽ thay toàn bộ tiêu đề, caption, hashtag hiện có.",
      okText: "Viết lại tất cả",
    });
    if (!ok) return;
  }
  $("batchRunHint").textContent = "";
  $("batchRunHint").classList.remove("err");
  try {
    renderBatchPostCopy(await postJson(`/api/batch/${batchCur.id}/post-copy`, { provider: opts.provider, force }));
  } catch (e) {
    $("batchRunHint").textContent = e.message;
    $("batchRunHint").classList.add("err");
  }
}

function pollBatchPostCopy() {
  const id = batchCur?.id;
  batchPostCopyPoll = setTimeout(async () => {
    batchPostCopyPoll = null;
    // Người dùng đã sang loạt khác hoặc rời màn này thì thôi hỏi.
    if (!batchCur || batchCur.id !== id || $("batchRun").hidden) return;
    try {
      const pc = await api(`/api/batch/${id}/post-copy`);
      batchCur.postCopy = pc;
      renderBatchPostCopy(pc);
      if (pc.run && !pc.run.running) {
        const { done, failed, error } = pc.run;
        $("batchRunHint").textContent = failed
          ? `Viết xong ${done} bài đăng, ${failed} video lỗi: ${error}`
          : `Đã viết bài đăng cho ${done} video — có trong CSV và file .txt khi tải cả loạt.`;
        $("batchRunHint").classList.toggle("err", failed > 0);
      }
    } catch {
      // Mạng chập chờn: lần vẽ lại sau của loạt sẽ hỏi tiếp.
    }
  }, 2000);
}

async function toggleBatchRun() {
  if (!batchCur) return;
  await batchAction(batchCur.state === "running" ? "pause" : "start");
}

async function deleteBatchRun() {
  if (!batchCur) return;
  const ok = await confirmDialog({
    title: `Xoá loạt “${batchCur.name}”?`,
    message: "Chỉ xoá bảng theo dõi này. Các video đã tạo vẫn nằm trong Thư viện.",
    okText: "Xoá loạt",
  });
  if (!ok) return;
  try {
    await postJson(`/api/batch/${batchCur.id}/delete`, {});
    batchCur = null;
    location.hash = "#/batch";
  } catch (e) {
    $("batchRunHint").textContent = e.message;
  }
}

boot().catch((e) => setHint(`Lỗi khởi động: ${e.message}`, true));
