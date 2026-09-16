/**
 * ✍️ Gợi ý bài đăng: AI viết tiêu đề, caption, hashtag riêng cho TikTok, YouTube, Facebook, Instagram
 * từ lời của video đã làm xong (scripts/post-copy.ts). Mỗi ô có nút chép.
 *
 * Nạp sau app.js, dùng chung $, api, postJson, escapeHtml, flashNote, scriptProviders của nó.
 */

let postCopySlug = null;
let postCopyData = null;
let postCopyTab = "tiktok";
let postCopyBusy = false;

const POST_TABS = [
  { id: "tiktok", label: "🎵 TikTok" },
  { id: "youtube", label: "▶️ YouTube" },
  { id: "facebook", label: "📘 Facebook" },
  { id: "instagram", label: "📸 Instagram" },
];

async function openPostCopy(slug) {
  postCopySlug = slug;
  postCopyData = null;
  $("postCopyBody").innerHTML = `<p class="muted">Đang tải…</p>`;
  setPostCopyHint("");
  if (!$("postCopyDlg").open) $("postCopyDlg").showModal();
  try {
    const result = await api(`/api/post-copy/${encodeURIComponent(slug)}`);
    if (!result.hasText) {
      renderPostCopyEmpty("Video này chưa có lời hay phụ đề nào để AI đọc — thêm phụ đề trong ✂️ Chỉnh sửa trước.");
      return;
    }
    postCopyData = result;
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
  $("postCopyRegen").hidden = true;
}

async function generatePostCopy() {
  if (postCopyBusy || !postCopySlug) return;
  postCopyBusy = true;
  $("postCopyRegen").disabled = true;
  $("postCopyRegen").textContent = "Đang viết…";
  if (!postCopyData?.copy) $("postCopyBody").innerHTML = `<p class="muted">AI đang đọc lời video và viết gợi ý…</p>`;
  setPostCopyHint("");
  try {
    postCopyData = await postJson(`/api/post-copy/${encodeURIComponent(postCopySlug)}`, { provider: opts.provider });
    renderPostCopy();
  } catch (e) {
    if (postCopyData?.copy) renderPostCopy();
    else $("postCopyBody").innerHTML = "";
    setPostCopyHint(e.message, true);
  } finally {
    postCopyBusy = false;
    $("postCopyRegen").disabled = false;
    $("postCopyRegen").textContent = "↻ Viết lại";
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
    <div class="pc-top"><span>${label}</span><button type="button" class="btn" data-pc-copy="${key}">📋 Chép</button></div>
    <div class="pc-text${multiline ? " pc-multi" : ""}">${escapeHtml(value)}</div>
  </div>`;
}

function renderPostCopy() {
  const saved = postCopyData?.copy;
  if (!saved) return;
  $("postCopyRegen").hidden = false;
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
      <span class="muted">Viết bởi ${escapeHtml(saved.providerLabel)} · ${new Date(saved.generatedAt).toLocaleString("vi-VN")}</span>
      <button type="button" class="btn primary" data-pc-copy="all">📋 Chép tất cả cho ${POST_TABS.find((t) => t.id === postCopyTab).label.split(" ")[1]}</button>
    </div>
    ${postCopyData.stale ? `<p class="hint err">Lời video đã đổi sau lần gợi ý này — bấm ↻ Viết lại để cập nhật.</p>` : ""}`;

  $("postCopyBody").querySelectorAll("[data-pc-tab]").forEach((b) =>
    b.addEventListener("click", () => { postCopyTab = b.dataset.pcTab; renderPostCopy(); }));
  $("postCopyBody").querySelectorAll("[data-pc-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      const key = b.dataset.pcCopy;
      const text = key === "all" ? postFullText(postCopyTab, part)
        : key === "hashtags" ? part.hashtags.join(" ") : part[key];
      try {
        await copyText(text);
        const old = b.textContent;
        b.textContent = "✓ Đã chép";
        setTimeout(() => { b.textContent = old; }, 1500);
      } catch {
        flashNote("Không chép được — bôi đen chữ rồi Ctrl/⌘+C.", true);
      }
    }));
}

(function bindPostCopyDialog() {
  $("postCopyRegen").addEventListener("click", generatePostCopy);
  $("postCopyDlg").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("postCopyDlg").close()));
})();
