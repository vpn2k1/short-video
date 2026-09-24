/**
 * Gợi ý bài đăng: AI viết tiêu đề, caption, hashtag riêng cho TikTok, YouTube, Facebook, Instagram
 * từ lời của video đã làm xong (scripts/post-copy.ts). Mỗi ô có nút chép.
 *
 * Chọn được AI viết ngay trong hộp thoại (nhớ cho lần sau, dùng luôn cho nút "Viết bài đăng" của cả loạt).
 *
 * Nạp sau app.js, dùng chung $, api, postJson, escapeHtml, flashNote, opts, state, scriptProviders,
 * providerChipLabel của nó.
 */

let postCopySlug = null;
let postCopyData = null;
let postCopyTab = "tiktok";
/** Slug đang được viết — đóng hộp thoại mở video khác giữa chừng thì kết quả cũ không đè lên. */
let postCopyBusy = null;

const POST_COPY_AI_KEY = "postCopyProvider";
/** AI người dùng chọn trong hộp thoại; null = chưa chọn, theo AI đang chọn ở khung chat. */
let postCopyProvider = null;
try { postCopyProvider = localStorage.getItem(POST_COPY_AI_KEY); } catch { /* bỏ qua */ }

/** AI sẽ viết gợi ý: lựa chọn đã lưu nếu vẫn còn key, không thì theo AI ở khung chat. */
function postCopyProviderChoice() {
  const saved = postCopyProvider;
  if (saved === "auto" || scriptProviders().some((p) => p.id === saved && p.available)) return saved;
  return opts.provider;
}

/** Ô chọn AI: "Tự động" rồi các AI đã có key (kèm model), AI chưa dùng được thì làm mờ. */
function renderPostCopyAi() {
  const value = postCopyProviderChoice();
  const groups = new Map();
  for (const p of scriptProviders()) {
    const group = p.available ? "Đã có key" : state?.freeMode && p.paid ? "Tắt trong chế độ Miễn phí" : "Chưa có key — điền trong Cài đặt";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(p);
  }
  const option = (p) => `<option value="${escapeHtml(p.id)}"${p.id === value ? " selected" : ""}${p.available ? "" : " disabled"}>${
    escapeHtml(`${p.label} · ${p.model}`)}</option>`;
  // Đã có key đứng trước, giữ thứ tự thử của "Tự động".
  const order = [...groups.keys()].sort((a, b) => (b === "Đã có key") - (a === "Đã có key"));
  $("postCopyAi").innerHTML =
    `<option value="auto"${value === "auto" ? " selected" : ""}>${escapeHtml(providerChipLabel("auto"))}</option>` +
    order.map((g) => `<optgroup label="${escapeHtml(g)}">${groups.get(g).map(option).join("")}</optgroup>`).join("");
}

/** Nút viết + ô chọn AI: khoá khi video đang mở đang được viết. */
function paintPostCopyGen() {
  const busy = postCopyBusy !== null && postCopyBusy === postCopySlug;
  $("postCopyAi").disabled = busy;
  $("postCopyRegen").disabled = busy;
  $("postCopyRegen").innerHTML = busy ? `${icon("loader-circle", "spin")} Đang viết…`
    : postCopyData?.copy ? `${icon("rotate-cw")} Viết lại` : `${icon("sparkles")} Viết gợi ý`;
}

const POST_TABS = [
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
];

async function openPostCopy(slug) {
  postCopySlug = slug;
  postCopyData = null;
  $("postCopyBody").innerHTML = `<p class="muted">Đang tải…</p>`;
  $("postCopyGen").hidden = true;
  setPostCopyHint("");
  if (!$("postCopyDlg").open) $("postCopyDlg").showModal();
  try {
    const result = await api(`/api/post-copy/${encodeURIComponent(slug)}`);
    if (slug !== postCopySlug) return;
    if (!result.hasText) {
      renderPostCopyEmpty("Video này chưa có lời hay phụ đề nào để AI đọc — thêm phụ đề trong Chỉnh sửa trước.");
      return;
    }
    postCopyData = result;
    renderPostCopyAi();
    paintPostCopyGen();
    $("postCopyGen").hidden = false;
    // Chưa có gợi ý nào thì viết luôn — người dùng bấm nút là để lấy gợi ý.
    if (!result.copy) await generatePostCopy();
    else renderPostCopy();
  } catch (e) {
    renderPostCopyEmpty(e.message, true);
  }
}

function setPostCopyHint(text, isError = false) {
  $("postCopyHint").textContent = text;
  $("postCopyHint").classList.toggle("err", isError);
}

function renderPostCopyEmpty(text, isError = false) {
  $("postCopyBody").innerHTML = "";
  setPostCopyHint(text, isError);
  $("postCopyGen").hidden = true;
}

async function generatePostCopy() {
  const slug = postCopySlug;
  if (!slug || postCopyBusy === slug) return;
  postCopyBusy = slug;
  paintPostCopyGen();
  if (!postCopyData?.copy) $("postCopyBody").innerHTML = `<p class="muted">AI đang đọc lời video và viết gợi ý…</p>`;
  setPostCopyHint("");
  try {
    const result = await postJson(`/api/post-copy/${encodeURIComponent(slug)}`, { provider: postCopyProviderChoice() });
    if (slug !== postCopySlug) return;
    postCopyData = result;
    renderPostCopy();
  } catch (e) {
    if (slug !== postCopySlug) return;
    // Lỗi lần viết đầu vẫn để lại nút + ô chọn AI — đổi sang AI khác rồi thử lại được.
    if (postCopyData?.copy) renderPostCopy();
    else $("postCopyBody").innerHTML = "";
    setPostCopyHint(e.message, true);
  } finally {
    if (postCopyBusy === slug) postCopyBusy = null;
    paintPostCopyGen();
  }
}

/** Nội dung dán thẳng lên nền tảng: caption + dòng hashtag. */
function postFullText(platform, part) {
  const tags = part.hashtags.join(" ");
  if (platform === "youtube") return `${part.title}\n\n${part.description}${tags ? `\n\n${tags}` : ""}`;
  return `${part.caption}${tags ? `\n\n${tags}` : ""}`;
}

/** Clipboard API cần trang đang được focus; không được thì chép kiểu cũ qua một ô ẩn. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    box.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    $("postCopyDlg").appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    if (!ok) throw new Error("copy failed");
  }
}

function copyField(label, value, key, multiline = false) {
  return `<div class="pc-field">
    <div class="pc-top"><span>${label}</span><button type="button" class="btn" data-pc-copy="${key}">${icon("copy")} Chép</button></div>
    <div class="pc-text${multiline ? " pc-multi" : ""}" data-no-i18n>${escapeHtml(value)}</div>
  </div>`;
}

function renderPostCopy() {
  const saved = postCopyData?.copy;
  if (!saved) return;
  const part = saved[postCopyTab];
  const fields = postCopyTab === "youtube"
    ? copyField("Tiêu đề", part.title, "title") + copyField("Mô tả", part.description, "description", true)
    : copyField("Caption", part.caption, "caption", true);
  $("postCopyBody").innerHTML = `
    <div class="pc-tabs" role="tablist">${POST_TABS.map((t) =>
      `<button type="button" role="tab" aria-selected="${t.id === postCopyTab}" data-pc-tab="${t.id}">${t.label}</button>`).join("")}</div>
    ${fields}
    ${copyField("Hashtag", part.hashtags.join(" "), "hashtags")}
    <div class="pc-foot">
      <span class="muted">Viết bởi ${escapeHtml(saved.writtenBy ?? saved.providerLabel)} · ${new Date(saved.generatedAt).toLocaleString("vi-VN")}</span>
      <button type="button" class="btn primary" data-pc-copy="all">${icon("copy")} Chép tất cả cho ${POST_TABS.find((t) => t.id === postCopyTab).label}</button>
    </div>
    ${postCopyData.stale ? `<p class="hint err">Lời video đã đổi sau lần gợi ý này — bấm Viết lại để cập nhật.</p>` : ""}`;

  $("postCopyBody").querySelectorAll("[data-pc-tab]").forEach((b) =>
    b.addEventListener("click", () => { postCopyTab = b.dataset.pcTab; renderPostCopy(); }));
  $("postCopyBody").querySelectorAll("[data-pc-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      const key = b.dataset.pcCopy;
      const text = key === "all" ? postFullText(postCopyTab, part)
        : key === "hashtags" ? part.hashtags.join(" ") : part[key];
      try {
        await copyText(text);
        const old = b.innerHTML;
        b.innerHTML = `${icon("check")} Đã chép`;
        setTimeout(() => { b.innerHTML = old; }, 1500);
      } catch {
        flashNote("Không chép được — bôi đen chữ rồi Ctrl/⌘+C.", true);
      }
    }));
}

(function bindPostCopyDialog() {
  $("postCopyRegen").addEventListener("click", generatePostCopy);
  $("postCopyAi").addEventListener("change", (e) => {
    postCopyProvider = e.target.value;
    try { localStorage.setItem(POST_COPY_AI_KEY, postCopyProvider); } catch { /* bỏ qua */ }
  });
  $("postCopyDlg").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("postCopyDlg").close()));
})();
