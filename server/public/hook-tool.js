/**
 * Công cụ Hook: chọn vài công thức câu mở đầu (scripts/hook-library.ts), AI viết mỗi công thức vài câu cho đúng
 * video đang mở (scripts/hooks.ts, generateTemplateHooks), đặt cạnh nhau để so — sửa tay nếu muốn — rồi chọn
 * một câu: điền sẵn yêu cầu thay câu đầu vào ô chat, người dùng bấm gửi để dựng lại.
 *
 * Nạp sau app.js, dùng chung $, postJson, escapeHtml, icon, opts, state, setOpt, prefill, flashNote, hookGroups
 * của nó; copyText của post-copy.js.
 */

/** Khớp MAX_TOOL_TEMPLATES / MAX_PER_TEMPLATE ở scripts/hooks.ts. */
const HT_MAX_TEMPLATES = 6;
const HT_MAX_PER = 3;
/** Luật hook trong prompt: tối đa 12 từ — quá thì nhắc, không chặn. */
const HT_MAX_WORDS = 12;

let htSlug = null;
let htSelected = new Set();
let htPer = 2;
/** Nhóm đang xem ("all" = tất cả) và chữ đang tìm. */
let htGroup = "all";
let htQuery = "";
/** Kết quả theo từng video — đóng hộp thoại mở lại vẫn còn. */
const htResults = new Map();
/** Slug đang được viết — mở video khác giữa chừng thì kết quả cũ không đè lên. */
let htBusy = null;

const htTemplates = () => hookGroups().flatMap((g) => g.templates);

/**
 * Icon + màu riêng từng nhóm để lướt nhanh bằng mắt. Tên icon viết cố định — server quét icon("…") để gửi đúng icon.
 * Nhóm mới chưa có ở đây thì dùng icon tia sét, màu cam.
 */
const HT_GROUP_LOOK = {
  curiosity: { icon: icon("circle-help"), hue: "#5b9dff" },
  surprise: { icon: icon("zap"), hue: "#ffb020" },
  benefit: { icon: icon("target"), hue: "#34c38f" },
  challenge: { icon: icon("trophy"), hue: "#ff6b6b" },
  ready: { icon: icon("rocket"), hue: "#ff7a1a" },
  quiz: { icon: icon("brain"), hue: "#b57bff" },
  science: { icon: icon("flask-conical"), hue: "#2ec5d3" },
  story: { icon: icon("book-open"), hue: "#ff5e9c" },
};
const htLook = (groupId) => HT_GROUP_LOOK[groupId] ?? { icon: icon("zap"), hue: "#ff7a1a" };
const htGroupOf = (templateId) => hookGroups().find((g) => g.templates.some((t) => t.id === templateId));

/** Bỏ dấu để tìm "ban co biet" vẫn ra "Bạn có biết…". */
const htFold = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Gợi ý 3 công thức ở 3 nhóm khác nhau — để lần đầu mở ra bấm Viết được ngay. */
function htSuggest() {
  const groups = [...hookGroups()].sort(() => Math.random() - 0.5).slice(0, 3);
  htSelected = new Set(groups.map((g) => g.templates[Math.floor(Math.random() * g.templates.length)].id));
}

function openHookTool(slug) {
  htSlug = slug;
  if (htSelected.size === 0) htSuggest();
  setHookToolHint("");
  renderHookTool();
  if (!$("hookToolDlg").open) $("hookToolDlg").showModal();
}

function setHookToolHint(text, isError = false) {
  $("hookToolHint").textContent = text;
  $("hookToolHint").classList.toggle("err", isError);
}

const htWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

function renderHookTool() {
  renderHookToolTabs();
  renderHookToolGrid();
  renderHookToolTray();
  $("hookToolPer").querySelectorAll("[data-ht-per]").forEach((b) =>
    b.setAttribute("aria-checked", String(Number(b.dataset.htPer) === htPer)));
  paintHookToolGen();
  renderHookToolResults();
}

/** Tab nhóm: Tất cả + từng nhóm, kèm số công thức đang chọn trong nhóm. */
function renderHookToolTabs() {
  const picked = (g) => g.templates.filter((t) => htSelected.has(t.id)).length;
  const tab = (id, label, look, count) => `<button type="button" role="tab" data-ht-group="${escapeHtml(id)}"
    aria-selected="${htGroup === id}" style="--ht-hue:${look.hue}">${look.icon}<span>${escapeHtml(label)}</span>${
      count ? `<b class="ht-tab-count">${count}</b>` : ""}</button>`;
  $("hookToolTabs").innerHTML =
    tab("all", "Tất cả", { icon: icon("layout-grid"), hue: "var(--accent)" }, htSelected.size) +
    hookGroups().map((g) => tab(g.id, g.label.replace(/^Cho /, ""), htLook(g.id), picked(g))).join("");
}

/** Lưới thẻ công thức theo nhóm đang xem và chữ đang tìm. */
function renderHookToolGrid() {
  const full = htSelected.size >= HT_MAX_TEMPLATES;
  const q = htFold(htQuery.trim());
  const groups = hookGroups()
    .filter((g) => htGroup === "all" || g.id === htGroup)
    .map((g) => ({ ...g, templates: g.templates.filter((t) => !q || htFold(`${t.formula} ${t.example}`).includes(q)) }))
    .filter((g) => g.templates.length);
  if (!groups.length) {
    $("hookToolPick").innerHTML = `<p class="muted ht-empty">Không có công thức nào khớp “${escapeHtml(htQuery)}”.</p>`;
    return;
  }
  $("hookToolPick").innerHTML = groups.map((g) => {
    const look = htLook(g.id);
    return `<section class="ht-group" style="--ht-hue:${look.hue}">
      ${htGroup === "all" || g.hint ? `<div class="ht-group-label"><span class="ht-group-icon">${look.icon}</span>${escapeHtml(g.label)}${
        g.hint ? ` <span class="muted">· ${escapeHtml(g.hint)}</span>` : ""}</div>` : ""}
      <div class="ht-cards">${g.templates.map((t) => {
        const on = htSelected.has(t.id);
        return `<button type="button" class="ht-tpl" data-ht-pick="${escapeHtml(t.id)}" aria-pressed="${on}"${!on && full ? " disabled" : ""}>
          <span class="ht-tpl-check">${icon("check")}</span>
          <span class="ht-tpl-formula">${escapeHtml(t.formula)}</span>
          <span class="ht-tpl-example">${escapeHtml(t.example)}</span>
        </button>`;
      }).join("")}</div>
    </section>`;
  }).join("");
}

/** Khay công thức đã chọn — bấm × để bỏ, không phải tìm lại trong lưới. */
function renderHookToolTray() {
  const picked = htTemplates().filter((t) => htSelected.has(t.id));
  $("hookToolCount").innerHTML = `<b>${htSelected.size}</b>/${HT_MAX_TEMPLATES} công thức`;
  $("hookToolTray").innerHTML = picked.length
    ? picked.map((t) => `<span class="ht-pill" style="--ht-hue:${htLook(htGroupOf(t.id)?.id).hue}">${escapeHtml(t.formula)}
        <button type="button" data-ht-unpick="${escapeHtml(t.id)}" aria-label="Bỏ ${escapeHtml(t.formula)}">${icon("x")}</button></span>`).join("")
    : `<span class="muted">Chưa chọn công thức nào — bấm vào thẻ bên dưới hoặc Gợi ý ngẫu nhiên.</span>`;
}

function paintHookToolGen() {
  const busy = htBusy !== null && htBusy === htSlug;
  const btn = $("hookToolGen");
  btn.disabled = busy || htSelected.size === 0;
  btn.innerHTML = busy ? `${icon("loader-circle", "spin")} Đang viết…`
    : htResults.get(htSlug)?.length ? `${icon("rotate-cw")} Viết lại` : `${icon("sparkles")} Viết hook`;
}

function renderHookToolResults() {
  const box = $("hookToolResults");
  const busy = htBusy !== null && htBusy === htSlug;
  const hooks = htResults.get(htSlug) ?? [];
  if (!hooks.length) {
    box.innerHTML = busy ? `<p class="muted">AI đang đọc lời video và viết câu mở đầu…</p>` : "";
    return;
  }
  box.innerHTML = `<div class="ht-results-head">${hooks.length} câu mở đầu · sửa trực tiếp nếu muốn, rồi bấm Dùng câu này</div>` +
    hooks.map((h, i) => {
      const words = htWords(h.text);
      const group = htGroupOf(h.template);
      return `<div class="ht-card" style="--ht-hue:${htLook(group?.id).hue}">
        <div class="ht-card-top"><span class="ht-tag">${htLook(group?.id).icon} ${escapeHtml(h.formula)}</span>
          <span class="ht-words${words > HT_MAX_WORDS ? " err" : ""}" data-ht-words="${i}">${words} từ</span></div>
        <textarea class="ht-text" data-ht-text="${i}" rows="2" maxlength="90" aria-label="Câu hook ${i + 1}">${escapeHtml(h.text)}</textarea>
        ${h.why ? `<div class="ht-why" data-no-i18n>${escapeHtml(h.why)}</div>` : ""}
        <div class="ht-actions">
          <button type="button" class="btn" data-ht-copy="${i}">${icon("copy")} Chép</button>
          <button type="button" class="btn primary" data-ht-use="${i}">${icon("check")} Dùng câu này</button>
        </div>
      </div>`;
    }).join("");
}

async function generateHookTool() {
  const slug = htSlug;
  if (!slug || htBusy === slug || htSelected.size === 0) return;
  htBusy = slug;
  setHookToolHint("");
  paintHookToolGen();
  renderHookToolResults();
  try {
    const { hooks } = await postJson(`/api/hook-tool/${encodeURIComponent(slug)}`,
      { templates: [...htSelected], per: htPer, provider: opts.provider });
    htResults.set(slug, hooks);
    if (slug === htSlug && hooks.length < htSelected.size * htPer) {
      setHookToolHint(`AI viết được ${hooks.length} câu (bỏ câu trùng nhau hoặc trùng câu gốc).`);
    }
  } catch (e) {
    if (slug === htSlug) setHookToolHint(e.message, true);
  } finally {
    if (htBusy === slug) htBusy = null;
    if (slug === htSlug) {
      paintHookToolGen();
      renderHookToolResults();
      // Kết quả nằm dưới danh sách công thức — cuộn tới để thấy ngay.
      $("hookToolResults").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

/** Chọn một câu: ghi công thức làm lựa chọn Hook, điền sẵn yêu cầu sửa — AI chỉ thay câu đầu. */
function useHookToolLine(i) {
  const hook = htResults.get(htSlug)?.[i];
  const text = hook?.text.trim();
  if (!text) return;
  setOpt("hook", hook.template);
  $("hookToolDlg").close();
  prefill(`Thay câu đầu tiên bằng đúng câu này, giữ nguyên từng chữ: "${text}". Giữ nguyên các câu còn lại.`);
  flashNote("Đã điền yêu cầu vào ô chat — bấm gửi để dựng lại video với câu mở đầu mới.");
}

(function bindHookToolDialog() {
  const dlg = $("hookToolDlg");
  dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
  $("hookToolGen").addEventListener("click", generateHookTool);
  $("hookToolShuffle").addEventListener("click", () => { htSuggest(); renderHookTool(); });
  $("hookToolClear").addEventListener("click", () => { htSelected.clear(); renderHookTool(); });
  $("hookToolPer").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ht-per]");
    if (!b) return;
    htPer = Math.min(HT_MAX_PER, Number(b.dataset.htPer));
    renderHookTool();
  });
  const toggle = (id) => {
    if (htSelected.has(id)) htSelected.delete(id);
    else if (htSelected.size < HT_MAX_TEMPLATES) htSelected.add(id);
    renderHookToolTabs();
    renderHookToolGrid();
    renderHookToolTray();
    paintHookToolGen();
  };
  $("hookToolPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ht-pick]");
    if (b) toggle(b.dataset.htPick);
  });
  $("hookToolTray").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ht-unpick]");
    if (b) toggle(b.dataset.htUnpick);
  });
  $("hookToolTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ht-group]");
    if (!b) return;
    htGroup = b.dataset.htGroup;
    renderHookToolTabs();
    renderHookToolGrid();
  });
  $("hookToolSearch").addEventListener("input", (e) => {
    htQuery = e.target.value;
    // Đang tìm thì xem mọi nhóm — kết quả nằm ở nhóm khác không bị giấu.
    if (htQuery.trim() && htGroup !== "all") { htGroup = "all"; renderHookToolTabs(); }
    renderHookToolGrid();
  });
  const results = $("hookToolResults");
  // Sửa tay: ghi lại vào kết quả để Chép / Dùng lấy đúng câu đã sửa.
  results.addEventListener("input", (e) => {
    const i = e.target.dataset?.htText;
    const hook = i === undefined ? null : htResults.get(htSlug)?.[Number(i)];
    if (!hook) return;
    hook.text = e.target.value;
    const words = htWords(hook.text);
    const badge = results.querySelector(`[data-ht-words="${i}"]`);
    badge.textContent = `${words} từ`;
    badge.classList.toggle("err", words > HT_MAX_WORDS);
  });
  results.addEventListener("click", async (e) => {
    const use = e.target.closest("[data-ht-use]");
    if (use) return useHookToolLine(Number(use.dataset.htUse));
    const copy = e.target.closest("[data-ht-copy]");
    if (!copy) return;
    const text = htResults.get(htSlug)?.[Number(copy.dataset.htCopy)]?.text ?? "";
    try {
      await copyText(text);
      const old = copy.innerHTML;
      copy.innerHTML = `${icon("check")} Đã chép`;
      setTimeout(() => { copy.innerHTML = old; }, 1500);
    } catch {
      flashNote("Không chép được — bôi đen chữ rồi Ctrl/⌘+C.", true);
    }
  });
})();
