/**
 * 🔤 Thêm phụ đề cho nhiều video.
 *
 * Màn này chỉ là cách nhập gọn cho một loạt "subs" của Hàng loạt: thả video, chọn ngôn ngữ, chỉnh kiểu
 * phụ đề. Chạy, theo dõi, duyệt, tải zip đều dùng lại màn theo dõi loạt (#/batch/<id>). Ở đó nút
 * "🔤 Kiểu phụ đề" mở lại đúng trình chỉnh kiểu này để đổi một lần cho mọi video.
 *
 * Nạp sau app.js, dùng chung các hàm $, api, postJson, escapeHtml, flashNote, openSettings… của nó.
 */

/** Lấy một lần từ /api/subs/options: ngôn ngữ, mẫu nhanh, nhãn font/preset, kiểu mặc định. */
let subsOptions = null;
/** Video đã tải lên: [{ path, name, url, width, height, duration }] */
let subsFiles = [];
let subsUploading = 0;
let subsSpoken = "vi";
let subsLangs = [""];
let subsModel = "medium";
let subsLook = null;
let subsEditor = null;

/** Giống FONTS trong src/styles/shared.tsx — để khung xem trước khớp chữ trong video. */
const LK_FONTS = {
  sans: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  rounded: '"Avenir Next", -apple-system, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SF Mono", Menlo, "Courier New", monospace',
  condensed: '"Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
};

const LK_SAMPLE = "Đây là phụ đề mẫu của bạn";

const lkRing = (width, color) =>
  Array.from({ length: 16 }, (_, k) => {
    const angle = (k / 16) * Math.PI * 2;
    return `${(Math.cos(angle) * width).toFixed(3)}em ${(Math.sin(angle) * width).toFixed(3)}em 0 ${color}`;
  }).join(", ");

/** Bản JS của captionTextStyle (src/components/CustomCaptions.tsx) — sửa bên đó thì sửa cả đây. */
function lkTextStyle(look, fontSize) {
  const base = {
    fontFamily: LK_FONTS[look.font] ?? LK_FONTS.sans,
    fontSize: `${fontSize}px`,
    fontWeight: look.weight,
    fontStyle: look.italic ? "italic" : "normal",
    color: look.color,
    lineHeight: "1.25",
    textShadow: "", backgroundColor: "", padding: "", borderRadius: "", boxDecorationBreak: "", webkitBoxDecorationBreak: "",
  };
  const a = look.accent;
  switch (look.preset) {
    case "shadow": return { ...base, textShadow: "0 0.06em 0.3em rgba(0,0,0,0.75), 0 0 0.06em rgba(0,0,0,0.9)" };
    case "outline": return { ...base, textShadow: lkRing(0.07, a) };
    case "box": return { ...base, backgroundColor: a, padding: "0.14em 0.5em", borderRadius: "0.22em" };
    case "highlight": return { ...base, backgroundColor: a, padding: "0.04em 0.3em", borderRadius: "0.16em",
      boxDecorationBreak: "clone", webkitBoxDecorationBreak: "clone" };
    case "neon": return { ...base, textShadow: `0 0 0.06em ${a}, 0 0 0.22em ${a}, 0 0 0.55em ${a}` };
    case "pop3d": return { ...base, textShadow: `0.04em 0.04em 0 ${a}, 0.08em 0.08em 0 ${a}, 0.12em 0.12em 0.2em rgba(0,0,0,0.45)` };
    default: return base;
  }
}

const lkUpper = (text, look) => (look.uppercase ? text.normalize("NFC").toLocaleUpperCase("vi") : text);

async function loadSubsOptions() {
  if (!subsOptions) subsOptions = await api("/api/subs/options");
  return subsOptions;
}

/**
 * Trình chỉnh kiểu phụ đề: khung xem trước (kéo chữ để đặt vị trí) + mẫu nhanh + font, cỡ, màu, bề rộng.
 * Chỉ vẽ lại phần xem trước khi chỉnh — không vẽ lại cả bảng, để kéo thanh trượt không bị ngắt.
 *
 * media: { url, video, width, height } | null · sample: câu mẫu · onChange(look)
 */
function createLookEditor(root, { look, media, sample, onChange }) {
  const o = subsOptions;
  let current = { ...o.look, ...look };
  const width = media?.width || 1080;
  const height = media?.height || 1920;
  const wide = width > height;

  const opt = (map, value) => Object.entries(map).map(([k, label]) =>
    `<option value="${k}"${k === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");

  root.innerHTML = `
    <div class="lk">
      <div class="lk-stage-wrap">
        <div>
          <div class="lk-stage ${wide ? "wide" : ""}" style="--ar:${width} / ${height}">
            ${media ? media.video
              ? `<video src="${escapeHtml(media.url)}#t=1" muted playsinline preload="metadata"></video>`
              : `<img src="${escapeHtml(media.url)}" alt="" />` : ""}
            <i class="lk-guide"></i>
            <div class="lk-cap"><span></span></div>
          </div>
          <p class="lk-tip">Kéo chữ trên khung để đặt vị trí</p>
        </div>
      </div>
      <div class="lk-panel">
        <div class="lk-f wide"><span>Mẫu nhanh</span><div class="lk-templates">${o.templates.map((t, i) =>
          `<button type="button" data-tpl="${i}" title="${escapeHtml(t.label)}">Aa</button>`).join("")}</div></div>
        <div class="lk-grid" style="margin-top:12px">
          <div class="lk-f wide"><span>Vị trí</span>
            <div class="lk-inline">
              <div class="seg" data-pos>
                <button type="button" data-y="14">Trên</button>
                <button type="button" data-y="50">Giữa</button>
                <button type="button" data-y="80">Dưới</button>
              </div>
              <input type="range" min="3" max="97" step="1" data-k="y" style="flex:1;min-width:100px" aria-label="Vị trí dọc" />
            </div>
          </div>
          <label class="lk-f"><span>Cỡ chữ</span>
            <span class="lk-inline"><input type="range" min="24" max="160" step="2" data-k="size" style="flex:1" /><b data-show="size"></b></span></label>
          <label class="lk-f"><span>Bề rộng tối đa</span>
            <span class="lk-inline"><input type="range" min="30" max="100" step="1" data-k="width" style="flex:1" /><b data-show="width"></b></span></label>
          <label class="lk-f"><span>Font</span><select data-k="font">${opt(o.fonts, current.font)}</select></label>
          <label class="lk-f"><span>Hiệu ứng chữ</span><select data-k="preset">${opt(o.presets, current.preset)}</select></label>
          <label class="lk-f"><span>Độ đậm</span><select data-k="weight">${opt({ 400: "Thường", 600: "Hơi đậm", 700: "Đậm vừa", 800: "Đậm", 900: "Rất đậm" }, String(current.weight))}</select></label>
          <div class="lk-f"><span>Màu chữ · màu viền/nền</span>
            <span class="lk-inline"><input type="color" data-k="color" aria-label="Màu chữ" /><input type="color" data-k="accent" aria-label="Màu viền hoặc nền" />
              <label class="lk-inline" style="margin-left:6px"><input type="checkbox" data-k="uppercase" /> IN HOA</label></span></div>
        </div>
      </div>
    </div>`;

  const stage = root.querySelector(".lk-stage");
  const cap = root.querySelector(".lk-cap");
  const span = cap.querySelector("span");
  const guide = root.querySelector(".lk-guide");

  // Nút mẫu nhanh tự vẽ đúng kiểu của mẫu đó — nhìn là biết chọn gì.
  root.querySelectorAll("[data-tpl]").forEach((b) => {
    const t = o.templates[Number(b.dataset.tpl)];
    const style = lkTextStyle({ ...current, ...t.look, font: "sans" }, 14);
    Object.assign(b.style, { color: style.color, textShadow: style.textShadow, fontWeight: String(t.look.weight ?? 800) });
    if (style.backgroundColor) b.style.background = style.backgroundColor;
  });

  function paint() {
    const rect = stage.getBoundingClientRect();
    const unit = Math.min(rect.width, rect.height) / 1080 || 0.3;
    const fontSize = current.size * unit;
    const style = lkTextStyle(current, fontSize);
    const perLine = current.preset === "highlight";
    span.textContent = lkUpper(sample || LK_SAMPLE, current);
    Object.assign(cap.style, {
      left: `${current.x}%`, top: `${current.y}%`, maxWidth: `${current.width}%`, textAlign: current.align,
    });
    // Reset kiểu cũ ở cả hai lớp rồi mới gán — đổi preset qua lại không để sót bóng/nền.
    const blank = lkTextStyle({ ...current, preset: "plain" }, fontSize);
    Object.assign(cap.style, blank, perLine ? { fontSize: `${fontSize}px`, lineHeight: "1.5", color: current.color } : style);
    Object.assign(span.style, { textShadow: "", backgroundColor: "", padding: "", borderRadius: "", boxDecorationBreak: "", webkitBoxDecorationBreak: "" },
      perLine ? style : {});

    root.querySelectorAll("[data-k]").forEach((el) => {
      const key = el.dataset.k;
      if (el.type === "checkbox") el.checked = Boolean(current[key]);
      else if (document.activeElement !== el) el.value = String(current[key]);
    });
    root.querySelectorAll("[data-show]").forEach((el) => {
      el.textContent = el.dataset.show === "width" ? `${current.width}%` : String(current.size);
    });
    root.querySelectorAll("[data-pos] [data-y]").forEach((b) =>
      b.setAttribute("aria-pressed", String(Math.abs(Number(b.dataset.y) - current.y) < 4)));
    root.querySelectorAll("[data-tpl]").forEach((b) => {
      const t = o.templates[Number(b.dataset.tpl)].look;
      b.classList.toggle("on", Object.entries(t).every(([k, v]) => current[k] === v));
    });
  }

  function set(patch) {
    current = { ...current, ...patch };
    paint();
    onChange?.(current);
  }

  root.addEventListener("input", (e) => {
    const key = e.target.dataset?.k;
    if (!key) return;
    const el = e.target;
    const value = el.type === "checkbox" ? el.checked
      : el.type === "range" || key === "weight" ? Number(el.value) : el.value;
    set({ [key]: value });
  });
  root.addEventListener("click", (e) => {
    const tpl = e.target.closest("[data-tpl]");
    if (tpl) return set(o.templates[Number(tpl.dataset.tpl)].look);
    const pos = e.target.closest("[data-y]");
    if (pos) set({ y: Number(pos.dataset.y), x: 50 });
  });

  // Kéo chữ: tâm khối chữ theo con trỏ, hút về giữa ngang khi lệch dưới 3%.
  cap.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cap.setPointerCapture(e.pointerId);
    cap.classList.add("drag");
    const rect = stage.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, x: current.x, y: current.y };
    const move = (ev) => {
      let x = start.x + ((ev.clientX - start.px) / rect.width) * 100;
      const y = start.y + ((ev.clientY - start.py) / rect.height) * 100;
      const snap = Math.abs(x - 50) < 3;
      if (snap) x = 50;
      guide.classList.toggle("on", snap);
      set({ x: Math.round(Math.min(97, Math.max(3, x))), y: Math.round(Math.min(97, Math.max(3, y))) });
    };
    const up = () => {
      cap.classList.remove("drag");
      guide.classList.remove("on");
      cap.removeEventListener("pointermove", move);
      cap.removeEventListener("pointerup", up);
      cap.removeEventListener("pointercancel", up);
    };
    cap.addEventListener("pointermove", move);
    cap.addEventListener("pointerup", up);
    cap.addEventListener("pointercancel", up);
  });

  const observer = new ResizeObserver(paint);
  observer.observe(stage);
  paint();
  return { get look() { return current; }, destroy: () => observer.disconnect() };
}

// ---------- màn 🔤 Phụ đề ----------

function bindSubs() {
  $("subsDrop").addEventListener("click", () => $("subsFileInput").click());
  $("subsFileInput").addEventListener("change", (e) => {
    addSubsFiles([...(e.target.files ?? [])]);
    e.target.value = "";
  });
  const block = $("subsDrop").parentElement;
  block.addEventListener("dragover", (e) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    $("subsDrop").classList.add("drag");
  });
  block.addEventListener("dragleave", (e) => {
    if (!block.contains(e.relatedTarget)) $("subsDrop").classList.remove("drag");
  });
  block.addEventListener("drop", (e) => {
    e.preventDefault();
    $("subsDrop").classList.remove("drag");
    addSubsFiles([...(e.dataTransfer?.files ?? [])]);
  });
  $("subsFiles").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-subs-rm]");
    if (!rm) return;
    subsFiles.splice(Number(rm.dataset.subsRm), 1);
    renderSubsFiles();
    renderSubsEditor();
  });
  $("subsSpoken").addEventListener("change", (e) => { subsSpoken = e.target.value; renderSubsLangs(); });
  $("subsLangs").addEventListener("click", (e) => {
    const pick = e.target.closest("[data-lang]");
    if (!pick) return;
    const code = pick.dataset.lang;
    subsLangs = subsLangs.includes(code) ? subsLangs.filter((c) => c !== code) : [...subsLangs, code];
    renderSubsLangs();
  });
  $("subsModel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-model]");
    if (!b) return;
    subsModel = b.dataset.model;
    renderSubsAdvanced();
  });
  $("subsReview").addEventListener("change", renderSubsAdvanced);
  $("subsStart").addEventListener("click", createSubsBatch);

  $("batchSubsLook").addEventListener("click", openBatchLookDialog);
  $("subsLookApply").addEventListener("click", applyBatchLook);
  $("subsLookDlg").addEventListener("close", () => { batchLookEditor?.destroy(); batchLookEditor = null; });
}

async function showSubs() {
  stopFollowing();
  for (const id of ["view-chat", "view-library", "view-multi", "view-batch"]) $(id).hidden = true;
  $("view-subs").hidden = false;
  setNav("subs");
  current = null;
  try {
    await loadSubsOptions();
  } catch (e) {
    setSubsHint(e.message, true);
    return;
  }
  if (!subsLook) subsLook = { ...subsOptions.look };
  $("subsSpoken").innerHTML = subsOptions.spoken.map((l) =>
    `<option value="${l.code}"${l.code === subsSpoken ? " selected" : ""}>${escapeHtml(l.label)}</option>`).join("");
  renderSubsFiles();
  renderSubsLangs();
  renderSubsAdvanced();
  renderSubsEditor();
  loadSubsRecent();
}

const setSubsHint = (text, isError = false) => {
  $("subsHint").textContent = text;
  $("subsHint").classList.toggle("err", isError);
};

/** Kích thước + thời lượng đọc ngay trên máy, để khung xem trước đúng tỉ lệ video mà khỏi hỏi server. */
const readMediaInfo = (url, video) => new Promise((resolve) => {
  const el = document.createElement(video ? "video" : "audio");
  el.preload = "metadata";
  el.onloadedmetadata = () => resolve({ width: el.videoWidth || 0, height: el.videoHeight || 0, duration: el.duration || 0 });
  el.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
  el.src = url;
});

async function addSubsFiles(files) {
  const accepted = files.filter((f) => /^(video|audio)\//.test(f.type) || /\.(mp4|mov|webm|mp3|wav|m4a|aac|ogg)$/i.test(f.name));
  if (accepted.length < files.length) setSubsHint("Bỏ qua file không phải video/audio.", true);
  else setSubsHint("");
  for (const file of accepted) {
    subsUploading += 1;
    renderSubsFiles();
    try {
      const video = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
      const local = URL.createObjectURL(file);
      const [info, res] = await Promise.all([
        readMediaInfo(local, video),
        fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file }),
      ]);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      subsFiles.push({ path: body.path, name: file.name, url: local, video, ...info });
      if (subsFiles.length === 1) renderSubsEditor();
    } catch (err) {
      setSubsHint(`Không tải lên được ${file.name}: ${err.message}`, true);
    } finally {
      subsUploading -= 1;
      renderSubsFiles();
    }
  }
}

const fmtDuration = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

function renderSubsFiles() {
  $("subsFiles").innerHTML = subsFiles.map((f, i) =>
    `<li><span>${f.video ? "🎬" : "🎙"} ${escapeHtml(f.name)}</span>
      <span class="sb-file-meta">${[f.width && f.height ? `${f.width}×${f.height}` : "", fmtDuration(f.duration)].filter(Boolean).join(" · ")}</span>
      <button type="button" class="icon-btn" data-subs-rm="${i}" aria-label="Bỏ ${escapeHtml(f.name)}">✕</button></li>`).join("") +
    (subsUploading ? `<li><span class="muted">Đang tải lên ${subsUploading} file…</span></li>` : "");
  renderSubsSummary();
}

function renderSubsLangs() {
  const langs = [{ code: "", label: "Giữ nguyên (không dịch)" },
    ...subsOptions.languages.filter((l) => l.code !== subsSpoken)];
  // Đổi tiếng đang nói trùng với một bản dịch đã chọn → bản đó chính là "giữ nguyên".
  subsLangs = [...new Set(subsLangs.map((c) => (c === subsSpoken ? "" : c)))];
  $("subsLangs").innerHTML = langs.map((l) =>
    `<button type="button" class="bt-pick ${subsLangs.includes(l.code) ? "on" : ""}" data-lang="${l.code}"
      aria-pressed="${subsLangs.includes(l.code)}">${subsLangs.includes(l.code) ? "✓ " : ""}${escapeHtml(l.label)}</button>`).join("");

  const translating = subsLangs.some(Boolean);
  const notes = [];
  if (subsLangs.length === 0) notes.push(`<span class="warn">⚠ Chọn ít nhất một ngôn ngữ phụ đề.</span>`);
  if (translating && !subsOptions.canTranslate) {
    notes.push(`<span class="warn">⚠ Dịch phụ đề cần model dịch — điền key Gemini, Groq hoặc OpenRouter (có gói miễn phí) trong <a href="#" data-open-settings>⚙ Cài đặt</a>.</span>`);
  } else if (translating) {
    notes.push("Nghe lời một lần, rồi dịch sang từng ngôn ngữ đã chọn.");
  }
  if (subsSpoken === "auto") notes.push("Tự nhận đôi khi đoán nhầm với video ngắn — biết tiếng thì chọn luôn cho chắc.");
  $("subsLangNote").innerHTML = notes.join("<br>");
  $("subsLangNote").querySelector("[data-open-settings]")?.addEventListener("click", (e) => { e.preventDefault(); openSettings(); });
  renderSubsSummary();
}

function renderSubsAdvanced() {
  $("subsModel").querySelectorAll("[data-model]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.model === subsModel)));
  $("subsAdvSum").textContent = `${subsModel === "small" ? "⚡ Nghe nhanh" : "🎯 Nghe chuẩn"} · ${
    $("subsReview").checked ? "dừng cho tôi đọc lại" : "chạy thẳng tới video"}`;
}

function renderSubsSummary() {
  const total = subsFiles.length * subsLangs.length;
  $("subsSummary").textContent = subsFiles.length === 0 ? ""
    : subsLangs.length > 1
      ? `${subsFiles.length} video × ${subsLangs.length} ngôn ngữ = ${total} video${total > 50 ? " (tối đa 50)" : ""}`
      : `${subsFiles.length} video`;
  $("subsStart").disabled = subsUploading > 0 || subsFiles.length === 0 || subsLangs.length === 0;
}

function renderSubsEditor() {
  subsEditor?.destroy();
  const first = subsFiles.find((f) => f.video) ?? null;
  subsEditor = createLookEditor($("subsLookEditor"), {
    look: subsLook,
    media: first ? { url: first.url, video: true, width: first.width, height: first.height } : null,
    sample: LK_SAMPLE,
    onChange: (look) => { subsLook = look; },
  });
}

async function createSubsBatch() {
  if (subsUploading > 0) return setSubsHint("Đợi tải file lên xong đã.", true);
  $("subsStart").disabled = true;
  setSubsHint("");
  try {
    if (window.Notification && Notification.permission === "default") Notification.requestPermission();
  } catch {
    // trình duyệt nhúng không có Notification
  }
  try {
    const batch = await postJson("/api/batch", {
      source: "subs",
      name: $("subsName").value,
      review: $("subsReview").checked,
      mediaModel: subsModel,
      settings: { ...opts, music: null },
      items: subsFiles.map((f) => f.path),
      subs: { spoken: subsSpoken, languages: subsLangs, look: subsLook },
      start: true,
    });
    subsFiles = [];
    $("subsName").value = "";
    loadHistory();
    location.hash = `#/batch/${batch.id}`;
  } catch (e) {
    setSubsHint(e.message, true);
    renderSubsSummary();
  }
}

async function loadSubsRecent() {
  try {
    const { batches } = await api("/api/batches");
    const list = batches.filter((b) => b.source === "subs").slice(0, 8);
    $("subsRecent").hidden = list.length === 0;
    $("subsRecentList").innerHTML = list.map((b) => {
      const c = b.counts;
      const pct = c.total === 0 ? 0 : Math.round(((c.done + c.skipped) / c.total) * 100);
      return `<a href="#/batch/${b.id}">
        <span class="row"><b>${escapeHtml(b.name)}</b><span class="spacer"></span>
          <span class="muted">${b.state === "running" ? "🔄 đang chạy" : b.state === "done" ? "✅ xong" : b.state === "paused" ? "⏸ tạm dừng" : "○ chưa chạy"}</span></span>
        <span class="mini"><i style="width:${pct}%"></i></span>
        <span class="muted">${c.done}/${c.total} xong${c.error ? ` · ${c.error} lỗi` : ""}</span>
      </a>`;
    }).join("");
  } catch {
    $("subsRecent").hidden = true;
  }
}

// ---------- đổi kiểu phụ đề cho cả loạt (màn theo dõi) ----------

let batchLookEditor = null;

async function openBatchLookDialog() {
  const b = batchCur;
  if (!b?.subs) return;
  try {
    await loadSubsOptions();
  } catch (e) {
    flashNote(e.message, true);
    return;
  }
  // Xem trước trên video GỐC (chưa có phụ đề) — dùng video đã dựng thì thấy hai lớp chữ chồng nhau.
  const withFile = b.items.find((i) => i.file && /\.(mp4|mov|webm)$/i.test(i.file));
  let media = null;
  if (withFile) {
    const url = `/public/${withFile.file}`;
    const info = await readMediaInfo(url, true);
    media = { url, video: true, width: info.width, height: info.height };
  }
  const sample = b.items.find((i) => i.lines?.length)?.lines[0] ?? LK_SAMPLE;
  $("subsLookDlgHint").textContent = "";
  const done = b.items.filter((i) => i.status === "done" || i.status === "error").length;
  $("subsLookApply").textContent = done > 0 ? `Áp dụng & dựng lại ${done} video` : "Áp dụng cho tất cả";
  $("subsLookApply").disabled = false;
  $("subsLookDlg").showModal();
  batchLookEditor = createLookEditor($("subsLookDlgBody"), { look: b.subs.look, media, sample });
}

async function applyBatchLook() {
  if (!batchCur || !batchLookEditor) return;
  $("subsLookApply").disabled = true;
  try {
    const result = await postJson(`/api/batch/${batchCur.id}/restyle`, { look: batchLookEditor.look });
    $("subsLookDlg").close();
    flashNote(result.rerender > 0
      ? `Đã đổi kiểu phụ đề — đang dựng lại ${result.rerender} video.`
      : "Đã đổi kiểu phụ đề — các video còn lại sẽ dựng theo kiểu mới.");
    loadBatch(batchCur.id);
  } catch (e) {
    $("subsLookDlgHint").textContent = e.message;
    $("subsLookDlgHint").classList.add("err");
    $("subsLookApply").disabled = false;
  }
}
