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
  { label: "✂️ Ngắn hơn", prompt: "Rút gọn còn khoảng 15 giây, giữ ý chính." },
  { label: "😄 Vui hơn", prompt: "Viết lại với giọng vui, gần gũi hơn." },
  { label: "🔁 Phiên bản khác", prompt: "Làm một phiên bản khác cùng chủ đề, với hook mới." },
];

// Ngắn để không bị xuống dòng trên điện thoại — ví dụ cụ thể đã có ở các nút gợi ý.
const PLACEHOLDER = {
  new: { video: "Mô tả video…", image: "Mô tả bộ ảnh…" },
  edit: { video: "Muốn sửa gì?", image: "Muốn sửa gì?" },
};
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const TEXT_PLACEHOLDER = {
  new: `Dán kịch bản — mỗi dòng một câu, dòng trống để sang cảnh (${IS_MAC ? "⌘" : "Ctrl"}+Enter để gửi)`,
  edit: `Dán kịch bản mới để dựng lại (${IS_MAC ? "⌘" : "Ctrl"}+Enter để gửi)`,
};

const DEFAULT_OPTS = { kind: "video", style: "auto", mode: "ai", aspect: "9:16", voice: "linh", music: "", video: "" };
const AUTO_STYLE = { id: "auto", emoji: "✨", label: "Tự động", summary: "AI đọc nội dung và chọn phong cách hợp nhất." };

// ---------- trạng thái ----------
let state = null;          // /api/state
let aspects = [];
let current = null;        // slug đang mở, null = cuộc mới
let project = null;        // thông tin từ /api/projects của video đang mở
let messages = [];
let pending = [];          // [{ id, name, path|null, url, video }]
let busy = false;
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

  $("ideas").innerHTML = IDEAS.map((t) => `<button type="button">${escapeHtml(t)}</button>`).join("");
  $("ideas").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => prefill(b.textContent)));

  bindComposer();
  bindMenu();
  bindSettings();
  bindHistory();
  bindMulti();
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
  renderHistory();
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash === "library") return showLibrary();
  if (hash === "multi") return showMulti(null);
  const multiMatch = hash.match(/^multi\/([a-z0-9-]+)$/);
  if (multiMatch) return showMulti(multiMatch[1]);
  const m = hash.match(/^v\/([a-z0-9-]+)$/);
  showChat(m ? m[1] : null);
}

function setNav(which) {
  $("nav-new").classList.toggle("on", which === "new");
  $("nav-lib").classList.toggle("on", which === "lib");
  $("nav-multi").classList.toggle("on", which === "multi");
}

async function showChat(slug) {
  $("view-library").hidden = true;
  $("view-multi").hidden = true;
  $("view-chat").hidden = false;
  setNav(slug ? "" : "new");
  stopFollowing();

  current = slug;
  project = null;
  messages = [];
  busy = false;
  setHint("");

  if (!slug) {
    // Chưa có key thì mặc định dán kịch bản — vẫn làm được video ngay.
    Object.assign(opts, DEFAULT_OPTS, { mode: hasScriptKey() ? "ai" : "text" });
    renderProjectBar();
    renderComposer();
    renderThread();
    loadRecent();
    $("input").focus();
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
    });
    project = projects.find((p) => p.slug === slug) ?? null;
    renderProjectBar();
    renderComposer();
    renderThread();
    if (chat.jobId) follow(chat.jobId, opts.kind);
  } catch (e) {
    setHint(e.message, true);
  }
}

async function showLibrary() {
  stopFollowing();
  $("view-chat").hidden = true;
  $("view-multi").hidden = true;
  $("view-library").hidden = false;
  setNav("lib");
  $("grid").innerHTML = `<p class="empty-lib">Đang tải…</p>`;
  try {
    libraryItems = (await api("/api/projects")).projects;
    renderLibrary();
  } catch (e) {
    $("grid").innerHTML = `<p class="empty-lib">Lỗi: ${escapeHtml(e.message)}</p>`;
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
  $("projectMulti").hidden = !project?.multi;
  $("projectMulti").href = `#/multi/${current}`;
  // Trình chỉnh sửa cần props.json — có kết quả (video hoặc ảnh) là có.
  const editable = Boolean(lastVideo) || messages.some((m) => m.images?.length) || Boolean(project?.editable);
  $("projectEdit").hidden = !editable;
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
      error: `<span class="h-status error">Lỗi</span> · ${historyTime(p.updated)}`,
      draft: `Chưa có kết quả · ${historyTime(p.updated)}`,
      done: `${style.emoji} ${p.kind === "image" ? `${p.images} ảnh` : "Video"} · ${historyTime(p.updated)}`,
    }[p.status] ?? historyTime(p.updated);
    return `${heading}
      <a class="h-item ${p.slug === activeSlug ? "on" : ""}" href="#/v/${p.slug}"
         ${p.slug === activeSlug ? 'aria-current="page"' : ""} title="${escapeHtml(p.title)}">
        <span class="h-thumb">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" />` : style.emoji}</span>
        <span class="h-text"><b>${escapeHtml(p.title)}</b><small>${status}</small></span>
        ${p.running ? "" : `<button type="button" class="h-del" data-del="${p.slug}" title="Xoá video này" aria-label="Xoá ${escapeHtml(p.title)}">🗑</button>`}
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
        ${selectable ? `<span class="check" aria-hidden="true">${picked ? "✓" : ""}</span>` : ""}
      </div>
      <div class="meta">
        <div class="t" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div>
        <div class="m"><span>${new Date(p.updated).toLocaleDateString("vi-VN")}${selectable ? ` · ${fmtBytes(p.bytes)}` : ""}</span>
          ${!selectable && p.kind === "video" && p.mp4 ? `<button type="button" data-dl="${escapeHtml(p.mp4)}">⬇ Tải</button>` : ""}</div>
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
  const newCard = q || selecting ? "" : `<a class="card new" href="#/"><div><b>＋</b>Tạo video mới</div></a>`;
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

const fmtBytes = (n) => {
  if (!n) return "0 MB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
};

function flashNote(text, isError = false) {
  let el = $("flashNote");
  if (!el) {
    el = document.createElement("div");
    el.id = "flashNote";
    el.className = "flash-note";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.toggle("err", isError);
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 3500);
}

function setSelecting(on) {
  selecting = on;
  selectedSlugs.clear();
  $("libSelect").hidden = on;
  renderLibrary();
}

function renderSelectBar() {
  const bar = $("libSelectBar");
  bar.hidden = !selecting;
  if (!selecting) return;
  const picked = libraryItems.filter((p) => selectedSlugs.has(p.slug));
  const bytes = picked.reduce((sum, p) => sum + (p.bytes || 0), 0);
  $("libSelectCount").textContent = picked.length
    ? `Đã chọn ${picked.length} video · giải phóng ${fmtBytes(bytes)}`
    : "Bấm vào video để chọn, hoặc chọn nhanh:";
  $("libDelete").disabled = picked.length === 0;
  $("libDelete").textContent = picked.length ? `🗑 Xoá ${picked.length} video` : "🗑 Xoá";
}

/** Chọn nhanh: video không mở/sửa từ N ngày trước (Infinity = tất cả). */
function selectOlderThan(days) {
  const cutoff = Date.now() - days * 86_400_000;
  selectedSlugs.clear();
  const q = fold($("search").value.trim());
  libraryItems
    .filter((p) => !p.running && matches(p, q) && (days === Infinity || p.updated < cutoff))
    .forEach((p) => selectedSlugs.add(p.slug));
  renderLibrary();
  if (selectedSlugs.size === 0) flashNote(days === Infinity ? "Không có video nào để chọn." : `Không có video nào cũ hơn ${days} ngày.`);
}

function bindLibrarySelect() {
  $("libSelect").addEventListener("click", () => setSelecting(true));
  $("libSelectDone").addEventListener("click", () => setSelecting(false));
  $("libSelectBar").querySelectorAll("[data-older]").forEach((b) =>
    b.addEventListener("click", () => selectOlderThan(b.dataset.older === "all" ? Infinity : Number(b.dataset.older))));
  $("libSelectNone").addEventListener("click", () => { selectedSlugs.clear(); renderLibrary(); });
  $("libDelete").addEventListener("click", async () => {
    const done = await deleteProjects([...selectedSlugs]);
    if (done) setSelecting(false);
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
  const names = info.slice(0, 5).map((p) => `• ${p.title}`).join("\n") + (info.length > 5 ? `\n• …và ${info.length - 5} video khác` : "");
  const question = `Xoá hẳn ${info.length === 1 ? "video này" : `${info.length} video`}? (${fmtBytes(bytes)})\n\n${names}\n\n` +
    "Bản render, ảnh cảnh, giọng đọc và lịch sử chat sẽ mất, không khôi phục được. File bạn tải lên vẫn giữ trong thư viện.";
  if (!window.confirm(question)) return false;
  try {
    const result = await postJson("/api/projects/delete", { slugs });
    const gone = new Set(result.deleted);
    libraryItems = libraryItems.filter((p) => !gone.has(p.slug));
    historyItems = historyItems.filter((p) => !gone.has(p.slug));
    renderHistory();
    renderLibrary();
    const skipped = result.skipped.length ? ` · bỏ qua ${result.skipped.length} (${result.skipped.map((s) => s.reason).join(", ")})` : "";
    flashNote(`Đã xoá ${result.deleted.length} video, giải phóng ${fmtBytes(result.freedBytes)}${skipped}.`, result.deleted.length === 0);
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
  if (m.error) {
    return `<div class="msg-bot error"><div class="text">Không làm được: ${escapeHtml(m.text)}</div>
      ${isLatest ? `<div class="actions"><button type="button" class="btn" data-retry>↻ Thử lại</button>
        ${/API key/i.test(m.text) ? `<button type="button" class="btn" data-open-settings>🔑 Mở cài đặt</button>` : ""}</div>` : ""}
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
        <button type="button" data-dl="${escapeHtml(src)}" aria-label="Tải ảnh ${i + 1}">⬇</button>
      </div>`).join("")}
    </div>
    ${m.images.length > 1 ? `<div class="actions">
      <button type="button" class="btn" data-dl-all="${escapeHtml(m.images.join("|"))}">⬇ Tải cả ${m.images.length} ảnh</button></div>` : ""}`;
  } else if (m.mp4) {
    result = `
    <div class="player" style="aspect-ratio:${ratioCss(m.aspect)};width:${playerWidth(m.aspect)}">
      <video src="${escapeHtml(m.mp4)}" controls playsinline preload="metadata"></video>
    </div>
    <div class="actions">
      <button type="button" class="btn" data-dl="${escapeHtml(m.mp4)}">⬇ Tải xuống</button>
      ${current ? `<a class="btn" href="/editor.html#${encodeURIComponent(current)}">✂️ Chỉnh sửa (timeline)</a>` : ""}
    </div>`;
  }
  // Sửa nhanh bằng câu lệnh cần AI — ở chế độ nguyên văn thì không hiện.
  const quick = isLatest && (m.mp4 || m.images?.length) && opts.mode === "ai" && hasScriptKey() ? `
    <div class="quick">
      <button type="button" data-quick-style>🎨 Đổi phong cách</button>
      ${QUICK_EDITS.map((q, i) => `<button type="button" data-quick="${i}">${q.label}</button>`).join("")}
    </div>` : "";
  return `<div class="msg-bot"><div class="text">${escapeHtml(m.text)}</div>${result}${quick}${scenes}</div>`;
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
  input.focus();
  input.setSelectionRange(text.length, text.length);
}

// ---------- gửi & theo dõi ----------
async function send() {
  const prompt = $("input").value.trim();
  if (!prompt || busy || pending.some((f) => !f.path)) return;
  if (opts.mode === "ai" && !hasScriptKey()) {
    openSettings();
    return;
  }
  setHint("");
  closeMenu();

  const attachments = pending.map((f) => f.path);
  try {
    const { slug, jobId } = await postJson("/api/chat", {
      slug: current ?? undefined,
      prompt,
      attachments,
      settings: { ...opts, music: opts.music || null },
    });

    messages.push({ role: "user", text: prompt, attachments, at: Date.now() });
    $("input").value = ""; autosize();
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
}

function renderComposer() {
  const style = styleMeta(opts.style);
  const voice = state.voices.catalog.find((v) => v.key === opts.voice);
  const music = state.audio.music.find((m) => m.path === opts.music);
  const chips = [
    ["mode", opts.mode === "text" ? "📝 Nguyên văn" : "🤖 AI viết", "Cách có kịch bản"],
    ["kind", opts.kind === "image" ? "🖼 Ảnh" : "🎬 Video", "Loại kết quả"],
    ["style", `${style.emoji} ${style.label}`, "Phong cách hình ảnh"],
    ["aspect", `▭ ${opts.aspect}`, "Tỉ lệ khung hình"],
  ];
  // Ảnh tĩnh không có tiếng — ẩn giọng và nhạc cho đỡ rối.
  if (opts.kind === "video") {
    chips.push(["video", videoChipLabel(), "Hình của cảnh: ảnh hay video AI"]);
    chips.push(["voice", voice ? `🎙 ${voice.key}` : "🔇 Không giọng", "Giọng đọc"]);
    chips.push(["music", music ? `♪ ${music.name.replace(/\.\w+$/, "")}` : "♪ Không nhạc", "Nhạc nền"]);
  }
  $("chips").innerHTML = chips.map(([key, label, title]) =>
    `<button type="button" class="chip" data-chip="${key}" title="${title}" aria-haspopup="listbox" aria-expanded="false">${escapeHtml(label)}${CARET}</button>`).join("");
  $("chips").querySelectorAll("[data-chip]").forEach((b) =>
    b.addEventListener("click", () => openMenu(b, menuFor(b.dataset.chip))));

  const textMode = opts.mode === "text";
  $("input").placeholder = textMode
    ? TEXT_PLACEHOLDER[current ? "edit" : "new"]
    : PLACEHOLDER[current ? "edit" : "new"][opts.kind];
  $("composer").classList.toggle("text-mode", textMode);
  $("syntaxHelp").hidden = !textMode;
  if (!textMode) $("textPreview").hidden = true;
  else schedulePreview();
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
      box.innerHTML = `<b>✓</b> «${escapeHtml(p.title)}» · ${p.scenes} cảnh · ${p.lines} câu` +
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

const videoModels = () => state?.videoModels ?? [];

function videoChipLabel() {
  if (!opts.video) return "🚫 Không dùng model";
  if (opts.video === "auto") return "✨ Video AI: tự động";
  const model = videoModels().find((m) => m.key === opts.video);
  return model ? `✨ ${model.label}` : "✨ Video AI";
}

function videoMenu(onPick) {
  const models = videoModels();
  const anyKey = models.some((m) => m.available);
  const keyHint = "Thêm key Gemini, fal.ai hoặc Replicate trong Cài đặt";
  return {
    id: "video", title: "Hình của cảnh", value: opts.video, onPick,
    options: [
      { value: "", title: "🚫 Không dùng model", sub: "Dùng ảnh trong thư viện hoặc file bạn tải lên — miễn phí" },
      {
        value: "auto", group: "Video AI — mỗi cảnh một clip, tính tiền theo clip",
        title: "✨ Tự động", sub: anyKey ? "Model rẻ nhất có key (đổi trong Cài đặt)" : keyHint,
        disabled: !anyKey,
      },
      ...models.map((m) => ({
        value: m.key,
        group: m.providerLabel,
        title: `🎬 ${m.label}`,
        sub: m.available
          ? `${m.durations[0]}–${m.durations.at(-1)}s/clip${m.usdPerSecond ? ` · ~$${m.usdPerSecond}/giây` : ""}`
          : `Cần ${m.env} — điền trong Cài đặt`,
        disabled: !m.available,
      })),
    ],
  };
}

function styleMenu(onPick) {
  return {
    id: "style", title: "Phong cách hình ảnh", layout: "grid", value: opts.style, onPick,
    options: [AUTO_STYLE, ...state.styles].map((s) => ({
      value: s.id, title: `${s.emoji} ${s.label}`, sub: s.summary,
    })),
  };
}

function menuFor(key) {
  const pick = (value) => setOpt(key, value);
  if (key === "style") return styleMenu(pick);
  if (key === "video") return videoMenu(pick);
  if (key === "mode") {
    return {
      id: "mode", title: "Kịch bản lấy từ đâu", value: opts.mode,
      onPick: (value) => { setOpt("mode", value); $("input").focus(); },
      options: [
        {
          value: "ai", title: "🤖 AI viết kịch bản",
          sub: hasScriptKey()
            ? `Gõ ý tưởng, ${state.keys.scriptLabel ?? "AI"} viết nội dung. Sửa bằng câu lệnh.`
            : "Cần một API key viết kịch bản — Gemini, Groq, OpenRouter có gói miễn phí. Điền trong Cài đặt",
          disabled: !hasScriptKey(),
        },
        { value: "text", title: "📝 Dùng nguyên văn", sub: "Dán kịch bản có sẵn, dựng đúng từng câu. Không cần API key." },
      ],
    };
  }
  if (key === "kind") {
    return {
      id: "kind", title: "Tạo ra", value: opts.kind, onPick: pick,
      options: [
        { value: "video", title: "🎬 Video", sub: "Có giọng đọc và nhạc, xuất file mp4" },
        { value: "image", title: "🖼 Bộ ảnh", sub: "Mỗi cảnh một ảnh PNG, hợp làm carousel" },
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
        { value: "", title: "🔇 Không giọng", sub: "Chỉ có chữ, thời lượng tính theo độ dài câu" },
        ...state.voices.catalog.map((v) => ({
          value: v.key, group: langs[v.lang] ?? v.lang,
          title: `🎙 ${v.key}`,
          sub: `${v.label.split("—")[1]?.trim() ?? ""} · ${v.engine === "say" ? "miễn phí" : "ElevenLabs"}${v.paidPlan ? " · cần gói trả phí" : ""}`,
          disabled: v.paidPlan,
        })),
      ],
    };
  }
  return {
    id: "music", title: "Nhạc nền", value: opts.music, onPick: pick,
    options: [
      { value: "", title: "Không nhạc" },
      ...state.audio.music.map((m) => ({ value: m.path, title: `♪ ${m.name.replace(/\.\w+$/, "")}` })),
    ],
  };
}

// ---------- menu dùng chung ----------
let menuAnchor = null;

function openMenu(anchor, menu) {
  const el = $("menu");
  if (!el.hidden && menuAnchor === anchor) { closeMenu(); return; }
  closeMenu();
  menuAnchor = anchor;
  anchor.setAttribute("aria-expanded", "true");

  let group = null;
  el.className = `menu ${menu.layout ?? "list"}`;
  el.setAttribute("aria-label", menu.title);
  el.innerHTML = `<div class="menu-title">${escapeHtml(menu.title)}</div>` + menu.options.map((o) => {
    const heading = o.group && o.group !== group ? `<div class="menu-group">${escapeHtml(o.group)}</div>` : "";
    group = o.group ?? group;
    const on = o.value === menu.value;
    return `${heading}<button type="button" class="opt ${on ? "on" : ""}" role="option" aria-selected="${on}"
      data-value="${escapeHtml(o.value)}" ${o.disabled ? "disabled" : ""}>
      <b>${escapeHtml(o.title)}</b>${o.sub ? `<span>${escapeHtml(o.sub)}</span>` : ""}</button>`;
  }).join("");
  el.hidden = false;
  el.querySelectorAll(".opt").forEach((b) =>
    b.addEventListener("click", () => { closeMenu(); menu.onPick(b.dataset.value); }));

  positionMenu(el, anchor, menu.layout === "grid" ? 620 : 340);
  (el.querySelector(".opt.on:not(:disabled)") ?? el.querySelector(".opt:not(:disabled)"))?.focus({ preventScroll: true });
}

/** Ưu tiên mở phía trên nút, thiếu chỗ thì mở xuống, cả hai thiếu thì bám mép trên và cuộn. */
function positionMenu(el, anchor, maxWidth) {
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
  else if (above >= below) { el.style.top = `${margin}px`; el.style.maxHeight = `${rect.top - gap - margin}px`; }
  else { el.style.top = `${rect.bottom + gap}px`; el.style.maxHeight = `${below}px`; }
}

function closeMenu() {
  $("menu").hidden = true;
  menuAnchor?.setAttribute("aria-expanded", "false");
  menuAnchor = null;
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
function bindComposer() {
  const input = $("input");
  input.addEventListener("input", () => { autosize(); updateSend(); schedulePreview(); });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    // Kịch bản nhiều dòng: Enter xuống dòng, ⌘/Ctrl+Enter mới gửi. Chế độ AI: Enter gửi.
    const sendNow = opts.mode === "text" ? e.metaKey || e.ctrlKey : !e.shiftKey;
    if (sendNow) { e.preventDefault(); send(); }
  });
  $("useExample").addEventListener("click", () => prefill($("syntaxExample").textContent));
  $("composer").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  $("noticeSettings").addEventListener("click", openSettings);

  $("attachBtn").addEventListener("click", () => $("fileInput").click());
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

  $("search").addEventListener("input", renderLibrary);
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
      <button type="button" data-rm="${f.id}" aria-label="Bỏ ${escapeHtml(f.name)}">✕</button>
    </div>`).join("");
  $("pending").querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      pending = pending.filter((f) => f.id !== b.dataset.rm);
      renderPending();
    }));
  updateSend();
}

function autosize() {
  const el = $("input");
  el.style.height = "auto";
  // Kịch bản dán vào dài — cho ô cao hơn ở chế độ nguyên văn.
  const max = opts.mode === "text" ? Math.max(220, window.innerHeight * 0.45) : 220;
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}

function updateSend() {
  $("send").disabled = busy || !$("input").value.trim() || pending.some((f) => !f.path);
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

async function openSettings() {
  closeMenu();
  removals = new Set();
  $("settingsHint").textContent = "";
  $("keyFields").innerHTML = `<p class="muted">Đang tải…</p>`;
  if (!$("settingsDlg").open) $("settingsDlg").showModal();
  try {
    const { keys } = await api("/api/keys");
    let group = "";
    $("keyFields").innerHTML = keys.map((k) => {
      const heading = k.group !== group ? `<h3 class="group">${escapeHtml(k.group)}</h3>` : "";
      group = k.group;
      const link = k.url ? ` <a href="${k.url}" target="_blank" rel="noopener">Lấy key ↗</a>` : "";
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
        status = `<span class="state ${k.set ? "on" : ""}">${k.set ? `✓ đã có ${escapeHtml(k.preview)}` : "chưa có"}</span>`;
        control = `<input id="key-${k.name}" name="${k.name}" data-type="secret" type="password" spellcheck="false"
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
    // Chưa có key viết kịch bản thì đưa con trỏ thẳng vào ô key đầu tiên.
    ($("keyFields").querySelector('[data-type="secret"]'))?.focus();
  } catch (e) {
    $("keyFields").innerHTML = `<p class="hint err">Lỗi: ${escapeHtml(e.message)}</p>`;
  }
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
const MAX_MULTI_SCENES = 20;
/** Độ dài chọn được khi cảnh không dùng model. */
const FREE_DURATIONS = [2, 3, 4, 5, 6, 8, 10, 12, 15];

/** Bản nháp đang soạn (slug null) hoặc video nhiều cảnh đang mở lại để sửa. */
let multi = null;
let multiUploads = 0;
let multiFileTarget = null;

/** Model thật sẽ chạy cho một lựa chọn: "auto" = model mặc định trong Cài đặt. */
const resolveVideoModel = (choice) =>
  videoModels().find((m) => m.key === (choice === "auto" ? state?.videoDefault : choice));

const newMultiScene = () => ({
  prompt: "",
  narration: "",
  model: state?.videoDefault ? "auto" : "",
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
  $("view-chat").hidden = true;
  $("view-library").hidden = true;
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
  $("multiHeading").textContent = multi.slug ? "Sửa video nhiều cảnh" : "Tạo video nhiều cảnh";
  $("multiTitle").value = multi.title;
  $("multiAspect").innerHTML = aspects.map((a) =>
    `<option value="${a.id}"${a.id === multi.aspect ? " selected" : ""}>${escapeHtml(a.label)}</option>`).join("");
  $("multiVoice").innerHTML = `<option value="">🔇 Không giọng — chỉ phụ đề</option>` +
    state.voices.catalog.map((v) =>
      `<option value="${v.key}"${v.key === multi.voice ? " selected" : ""}${v.paidPlan ? " disabled" : ""}>🎙 ${escapeHtml(v.label)}</option>`).join("");
  $("multiMusic").innerHTML = `<option value="">Không nhạc</option>` +
    state.audio.music.map((m) =>
      `<option value="${escapeHtml(m.path)}"${m.path === multi.music ? " selected" : ""}>♪ ${escapeHtml(m.name.replace(/\.\w+$/, ""))}</option>`).join("");
  renderMultiScenes();
}

function modelOptions(value) {
  const anyKey = Boolean(state?.videoDefault);
  const auto = resolveVideoModel("auto");
  const groups = new Map();
  for (const m of videoModels()) {
    if (!groups.has(m.providerLabel)) groups.set(m.providerLabel, []);
    groups.get(m.providerLabel).push(m);
  }
  return `<option value=""${value === "" ? " selected" : ""}>🚫 Không dùng model</option>` +
    `<option value="auto"${value === "auto" ? " selected" : ""}${anyKey ? "" : " disabled"}>✨ Tự động${auto ? ` (${escapeHtml(auto.label)})` : " — chưa có key"}</option>` +
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
  const tag = scene.model ? "✨ video AI" : scene.media ? (isVideoFile(scene.media) ? "🎞 video của bạn" : "🖼 ảnh của bạn") : "nền trơn";
  return `<article class="ms-card" data-i="${i}">
    <header class="ms-card-head">
      <b>Cảnh ${i + 1}</b><span class="tag">${tag}</span>
      <span class="spacer"></span>
      <button type="button" data-act="up" title="Đưa lên" aria-label="Đưa cảnh ${i + 1} lên"${i === 0 ? " disabled" : ""}>↑</button>
      <button type="button" data-act="down" title="Đưa xuống" aria-label="Đưa cảnh ${i + 1} xuống"${i === total - 1 ? " disabled" : ""}>↓</button>
      <button type="button" data-act="dup" title="Nhân đôi cảnh" aria-label="Nhân đôi cảnh ${i + 1}"${total >= MAX_MULTI_SCENES ? " disabled" : ""}>⧉</button>
      <button type="button" data-act="del" title="Xoá cảnh" aria-label="Xoá cảnh ${i + 1}"${total === 1 ? " disabled" : ""}>✕</button>
    </header>
    <div class="ms-grid">
      <label class="ms-field ms-wide"><span>Prompt — mô tả hình cho model video${scene.model ? "" : " (chỉ dùng khi chọn model)"}</span>
        <textarea data-f="prompt" rows="3" placeholder="Slow aerial shot over Ha Long Bay at sunrise, mist on the water, cinematic">${escapeHtml(scene.prompt)}</textarea></label>
      <label class="ms-field"><span>Model</span><select data-f="model">${modelOptions(scene.model)}</select></label>
      <label class="ms-field"><span>Độ dài cảnh</span><select data-f="seconds">${durations.map((d) =>
        `<option value="${d}"${d === scene.seconds ? " selected" : ""}>${d} giây</option>`).join("")}</select></label>
      <label class="ms-field ms-wide"><span>Lời đọc / phụ đề — mỗi dòng một câu, để trống nếu không cần</span>
        <textarea data-f="narration" rows="2" placeholder="Hạ Long lúc bình minh đẹp đến nín thở.">${escapeHtml(scene.narration)}</textarea></label>
      <div class="ms-field ms-wide">
        <span>${scene.model ? "Ảnh/video dự phòng — dùng nếu tạo clip AI lỗi" : "Ảnh/video của bạn (tuỳ chọn — không có thì nền trơn)"}</span>
        <div class="ms-media-row">
          ${media ? `<div class="ms-thumb">${media}</div>` : ""}
          <button type="button" class="btn" data-act="file">${scene.media ? "Đổi file" : "⬆ Tải lên"}</button>
          ${scene.media ? `<button type="button" class="btn" data-act="clear">Bỏ file</button>` : ""}
        </div>
      </div>
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
    ? " · không dùng model, miễn phí"
    : ` · ${ai.length} clip AI` +
      (usd ? ` · ước tính ~$${usd.toFixed(2)}` : "") +
      (unpriced ? ` · ${unpriced} clip giá theo nhà cung cấp` : "");
  $("multiSummary").textContent = `${total} cảnh${cost}`;
  $("multiAdd").disabled = total >= MAX_MULTI_SCENES;
  $("multiSubmit").textContent = multi.slug ? "🎬 Dựng lại video" : "🎬 Tạo video";
}

function bindMulti() {
  $("multiTitle").addEventListener("input", (e) => { if (multi) multi.title = e.target.value; });
  $("multiAspect").addEventListener("change", (e) => { multi.aspect = e.target.value; });
  $("multiVoice").addEventListener("change", (e) => { multi.voice = e.target.value; });
  $("multiMusic").addEventListener("change", (e) => { multi.music = e.target.value; });
  $("multiAdd").addEventListener("click", () => {
    if (multi.scenes.length >= MAX_MULTI_SCENES) return;
    multi.scenes.push(newMultiScene());
    renderMultiScenes();
    $("multiScenes").lastElementChild?.querySelector("textarea")?.focus();
  });
  $("multiSubmit").addEventListener("click", submitMulti);

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
    } catch (err) {
      setMultiHint(`Không tải lên được ${file.name}: ${err.message}`, true);
    } finally {
      multiUploads -= 1;
      if (multi?.scenes.includes(scene)) renderMultiScenes();
    }
  });
}

async function submitMulti() {
  if (multiUploads > 0) {
    setMultiHint("Đợi tải file lên xong đã.", true);
    return;
  }
  setMultiHint("");
  $("multiSubmit").disabled = true;
  try {
    const { slug } = await postJson("/api/multi", {
      ...multi,
      slug: multi.slug ?? undefined,
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

boot().catch((e) => setHint(`Lỗi khởi động: ${e.message}`, true));
