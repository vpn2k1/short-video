/**
 * Thêm phụ đề cho nhiều video.
 *
 * Màn này chỉ là cách nhập gọn cho một loạt "subs" của Hàng loạt: thả video, chọn ngôn ngữ, chỉnh kiểu
 * phụ đề. Chạy, theo dõi, duyệt, tải zip đều dùng lại màn theo dõi loạt (#/batch/<id>). Ở đó nút
 * "Kiểu phụ đề" mở lại đúng trình chỉnh kiểu này để đổi một lần cho mọi video.
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
/**
 * Chọn nhiều ngôn ngữ: "stack" = các hàng phụ đề trong CÙNG một video (mỗi hàng kiểu/vị trí riêng),
 * "separate" = mỗi ngôn ngữ ra một video riêng như trước.
 */
let subsLayout = "stack";
/** Kiểu của hàng thứ 2 trở đi, theo mã ngôn ngữ — bỏ chọn rồi chọn lại vẫn giữ. Hàng đầu dùng subsLook. */
let subsTrackLooks = {};

const subsStacked = () => subsLayout === "stack" && subsLangs.length > 1;

/** Tên hàng: "" = giữ nguyên tiếng đang nói. */
const subsLangLabel = (code, spoken = subsSpoken) => code
  ? subsOptions.languages.find((l) => l.code === code)?.label ?? code
  : `${subsOptions.spoken.find((l) => l.code === spoken && l.code !== "auto")?.label ?? "Tiếng gốc"} (gốc)`;

/** Câu mẫu theo ngôn ngữ, để thấy ngay hàng nào là hàng nào trên khung xem trước. */
const LK_SAMPLES = {
  vi: "Đây là phụ đề mẫu của bạn", en: "This is your sample subtitle", "zh-Hans": "这是您的示例字幕",
  ja: "これは字幕のサンプルです", ko: "자막 예시입니다", th: "นี่คือคำบรรยายตัวอย่าง", id: "Ini contoh subtitle Anda",
  es: "Este es tu subtítulo de ejemplo", fr: "Voici votre sous-titre d'exemple", de: "Das ist dein Beispiel-Untertitel",
};
const subsSampleFor = (code, spoken = subsSpoken) => LK_SAMPLES[code || spoken] ?? LK_SAMPLE;

/** Kiểu mặc định cho hàng k chưa chỉnh: như hàng đầu nhưng nhỏ hơn chút và đặt cao dần để khỏi đè nhau. */
const subsDefaultRowLook = (base, k) => ({
  ...base,
  y: Math.max(3, Math.round((base.y ?? 80) - k * 14)),
  size: Math.max(24, Math.round(((base.size ?? 64) * 0.85) / 2) * 2),
});

const subsRowLook = (code, k) => (k === 0 ? subsLook : subsTrackLooks[code] ?? subsDefaultRowLook(subsLook, k));
/**
 * Cắt khung chung: chọn bằng đúng khung crop của trình chỉnh sửa (/editor/crop.js ← server/editor/CropOverlay.tsx)
 * trên video mẫu (video đầu tiên). subsCrop = MediaCrop của video mẫu, null = không cắt.
 * Server áp cho mọi video, tự tính lại vùng cho video khác tỉ lệ (server/batch.ts, subsCropFor).
 */
let subsCrop = null;
/** "original" = giữ khung gốc của từng video; còn lại là mã tỉ lệ của src/aspects.ts. */
let subsFrame = "original";
const SUBS_FRAMES = [["original", "Giữ khung gốc"], ["9:16", "9:16 dọc"], ["3:4", "3:4"], ["1:1", "1:1"], ["16:9", "16:9 ngang"]];
/** Giống ASPECTS trong src/aspects.ts. */
const SUBS_ASPECTS = { "9:16": 9 / 16, "3:4": 3 / 4, "1:1": 1, "16:9": 16 / 9, "2:1": 2 };
let subsCropTool = null;
let subsCropPreview = null;

/** Giống aspectFor (src/aspects.ts): khung gần nhất với tỉ lệ video. */
const subsNearestAspect = (ratio) =>
  Object.entries(SUBS_ASPECTS).reduce((best, cur) => (Math.abs(cur[1] - ratio) < Math.abs(best[1] - ratio) ? cur : best))[1];

const subsSample = () => subsFiles.find((f) => f.video && f.width && f.height) ?? null;

/** Tỉ lệ khung video ra của video mẫu. */
const subsFrameAspect = (sample) =>
  subsFrame === "original" ? subsNearestAspect(sample.width / sample.height) : SUBS_ASPECTS[subsFrame];

/** Nạp bundle crop của trình chỉnh sửa khi cần lần đầu (React ~ vài trăm KB). */
let cropToolLoading = null;
const loadCropTool = () => {
  if (window.CropTool) return Promise.resolve(window.CropTool);
  cropToolLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/editor/crop.js";
    script.onload = () => resolve(window.CropTool);
    script.onerror = async () => {
      cropToolLoading = null;
      // Hỏi lại để báo đúng nguyên nhân: 404 = server bật từ trước khi có công cụ này (server không tự nạp code mới);
      // 500 = đóng gói lỗi (server gửi kèm lý do).
      let reason = "Không tải được công cụ crop — kiểm tra server còn chạy không.";
      try {
        const res = await fetch("/editor/crop.js", { method: "GET", cache: "no-store" });
        if (res.status === 404) {
          reason = "Server đang chạy bản cũ, chưa có công cụ crop — khởi động lại server (Ctrl+C rồi npm start, hoặc mở lại app) rồi tải lại trang.";
        } else if (!res.ok) {
          reason = `Không đóng gói được công cụ crop: ${(await res.json().catch(() => ({}))).error ?? res.statusText}`;
        }
      } catch {
        // mất kết nối — giữ câu chung
      }
      reject(new Error(reason));
    };
    document.head.append(script);
  });
  return cropToolLoading;
};

function renderSubsCrop() {
  $("subsCropFrame").innerHTML = SUBS_FRAMES.map(([id, label]) =>
    `<button type="button" role="radio" data-frame="${id}" aria-checked="${subsFrame === id}">${label}</button>`).join("");
  const sample = subsSample();
  $("subsCropEdit").disabled = !sample;
  $("subsCropClear").hidden = !subsCrop;
  const sizes = [...new Set(subsFiles.filter((f) => f.video && f.width).map((f) => `${f.width}×${f.height}`))];
  const rotate = subsCrop?.rotate ? ` · xoay ${subsCrop.rotate}°` : "";
  const flips = [subsCrop?.flipH ? "lật ngang" : "", subsCrop?.flipV ? "lật dọc" : ""].filter(Boolean).join(", ");
  $("subsCropNote").innerHTML = !sample
    ? "Thêm video để chỉnh vùng cắt trên video đầu tiên."
    : [
      subsCrop
        ? `Đã cắt: tỉ lệ <b>${subsCrop.ratio === "free" ? "tự do" : subsCrop.ratio === "frame" ? "theo khung" : subsCrop.ratio === "original" ? "gốc" : subsCrop.ratio}</b>`
          + ` · ${subsCrop.fit === "cover" ? "lấp đầy" : "vừa khung"}${rotate}${flips ? ` · ${flips}` : ""}.`
        : subsFrame === "original" ? "Chưa cắt — giữ nguyên khung của từng video." : "Chưa chỉnh vùng cắt — lấy phần giữa video cho vừa khung.",
      sizes.length > 1 ? `Video khác kích thước (${sizes.slice(0, 3).join(", ")}) giữ cùng vị trí và độ lớn tương đối.` : "",
    ].filter(Boolean).join("<br>");

  subsCropPreview?.close();
  subsCropPreview = null;
  $("subsCropPreview").innerHTML = "";
  if (!sample) return;
  loadCropTool().then((tool) => {
    subsCropPreview?.close();
    subsCropPreview = tool.preview($("subsCropPreview"), { src: sample.path, crop: subsEffectiveCrop(), frameAspect: subsFrameAspect(sample) });
  }).catch((e) => showSubsCropError(e.message));
}

/** Lỗi của công cụ crop hiện ngay dưới nút, không ở cuối trang. */
function showSubsCropError(message) {
  const note = $("subsCropNote");
  note.querySelector(".warn")?.remove();
  note.insertAdjacentHTML("beforeend", `<br><span class="warn">${icon("triangle-alert")} ${escapeHtml(message)}</span>`);
}

async function openSubsCrop() {
  const sample = subsSample();
  if (!sample) return;
  let tool;
  try {
    tool = await loadCropTool();
  } catch (e) {
    showSubsCropError(e.message);
    return;
  }
  const close = () => { subsCropTool?.close(); subsCropTool = null; };
  // Esc huỷ như trong trình chỉnh sửa (CropOverlay tự xử lý Enter = áp dụng).
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); done(); } };
  const done = () => { window.removeEventListener("keydown", onKey); close(); };
  window.addEventListener("keydown", onKey);
  close();
  // Gắn thẳng vào body: khối cha có hiệu ứng CSS làm "position: fixed" của khung crop bị giam trong khối, không phủ kín màn hình.
  let mountEl = document.getElementById("subsCropLayer");
  if (!mountEl) {
    mountEl = document.createElement("div");
    mountEl.id = "subsCropLayer";
    document.body.append(mountEl);
  }
  subsCropTool = tool.open(mountEl, {
    src: sample.path,
    frameAspect: subsFrameAspect(sample),
    initial: subsEffectiveCrop(),
    onApply: (crop) => { subsCrop = crop; done(); renderSubsCrop(); renderSubsEditor(); },
    onCancel: done,
  });
}

function bindSubsCrop() {
  $("subsCropFrame").addEventListener("click", (e) => {
    const b = e.target.closest("[data-frame]");
    if (!b) return;
    subsFrame = b.dataset.frame;
    renderSubsCrop();
    renderSubsEditor();
  });
  $("subsCropEdit").addEventListener("click", openSubsCrop);
  $("subsCropClear").addEventListener("click", () => { subsCrop = null; renderSubsCrop(); renderSubsEditor(); });
}

/** font-family của từng font — lấy từ /api/subs/options (src/fonts/catalog.ts), để xem trước khớp chữ trong video. */
const lkFontStack = (font) => subsOptions?.fontStacks?.[font] ?? subsOptions?.fontStacks?.sans ?? "sans-serif";

/**
 * Ô chọn font kiểu trình chỉnh sửa (server/editor/FontPicker.tsx, CSS dùng chung /fontpicker.css): mỗi dòng viết
 * bằng chính font đó, chia nhóm. Font đóng gói hiện được nhờ /public/fonts/fonts.css — chỉ tải font nào đang hiện.
 */
function lkFontPicker(el, { value, onPick }) {
  const o = subsOptions;
  let current = value;
  let open = false;
  /** Giống fontListPlacement trong server/editor/FontPicker.tsx: fixed theo nút, thiếu chỗ thì lật lên. */
  const placement = () => {
    const b = el.querySelector(".fp-btn")?.getBoundingClientRect();
    if (!b) return "";
    const below = innerHeight - b.bottom - 12;
    const above = b.top - 12;
    const up = below < 260 && above > below;
    const width = Math.max(240, b.width);
    const left = Math.min(b.left, innerWidth - width - 8);
    return `position:fixed;left:${left}px;width:${width}px;max-height:${Math.min(420, up ? above : below)}px;${
      up ? `top:auto;bottom:${innerHeight - b.top + 4}px` : `top:${b.bottom + 4}px`}`;
  };
  const paint = () => {
    el.innerHTML = `
      <button type="button" class="fp-btn" aria-haspopup="listbox" aria-expanded="${open}">
        <span style='font-family:${escapeHtml(lkFontStack(current))}'>${escapeHtml(o.fonts[current] ?? current)}</span><i aria-hidden="true">▾</i>
      </button>
      ${open ? `<div class="fp-list" role="listbox" style="${placement()}">${o.fontGroups.map((g) => `
        <div role="group" aria-label="${escapeHtml(g.label)}"><h5>${escapeHtml(g.label)}</h5>${g.ids.map((id) => `
          <button type="button" role="option" data-font="${id}" aria-selected="${id === current}" class="${id === current ? "on" : ""}">
            <span style='font-family:${escapeHtml(lkFontStack(id))}'>${escapeHtml(o.fonts[id] ?? id)}</span>
            <small style='font-family:${escapeHtml(lkFontStack(id))}'>Ảnh đẹp</small>
          </button>`).join("")}</div>`).join("")}</div>` : ""}`;
    if (open) el.querySelector(".fp-list .on")?.scrollIntoView({ block: "nearest" });
  };
  const close = () => { if (open) { open = false; paint(); } };
  const onDown = (e) => { if (!el.contains(e.target)) close(); };
  const onKey = (e) => { if (open && e.key === "Escape") { e.stopPropagation(); close(); } };
  const onScroll = (e) => { if (open && !el.querySelector(".fp-list")?.contains(e.target)) close(); };
  el.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-font]");
    if (pick) {
      current = pick.dataset.font;
      open = false;
      paint();
      onPick(current);
    } else if (e.target.closest(".fp-btn")) {
      open = !open;
      paint();
    }
  });
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", close);
  paint();
  return {
    set(value) { if (value !== current) { current = value; paint(); } },
    destroy() {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    },
  };
}

const LK_SAMPLE = "Đây là phụ đề mẫu của bạn";

const lkRing = (width, color) =>
  Array.from({ length: 16 }, (_, k) => {
    const angle = (k / 16) * Math.PI * 2;
    return `${(Math.cos(angle) * width).toFixed(3)}em ${(Math.sin(angle) * width).toFixed(3)}em 0 ${color}`;
  }).join(", ");

/** Bản JS của captionTextStyle (src/components/CustomCaptions.tsx) — sửa bên đó thì sửa cả đây. */
function lkTextStyle(look, fontSize) {
  const base = {
    fontFamily: lkFontStack(look.font),
    // Font một độ đậm: không làm đậm giả (giống captionTextStyle).
    fontSynthesis: subsOptions?.singleWeight?.includes(look.font) ? "none" : "",
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
 * Nhiều hàng phụ đề (nhiều ngôn ngữ cùng một video): mỗi hàng một khối chữ trên khung, kiểu và vị trí riêng.
 * Bấm/kéo khối chữ hoặc chip "Hàng n" để chọn hàng đang chỉnh; bảng bên dưới chỉ đổi hàng đó.
 *
 * tracks: [{ label, look, sample }] — hoặc truyền `look` + `sample` cho một hàng như trước.
 * media: { url, video, width, height, path?, crop?, frameAspect? } | null · onChange(looks[], activeIndex)
 * Có `crop` + `frameAspect` (loạt có cắt khung): khung xem trước theo khung video ra và vẽ hình ĐÃ CẮT bằng đúng
 * CropBox lúc dựng video (/editor/crop.js) — vị trí, cỡ chữ xem trước khớp video thật.
 */
function createLookEditor(root, { tracks, look, media, sample, onChange }) {
  const o = subsOptions;
  const rows = tracks?.length ? tracks : [{ label: "", look, sample }];
  const looks = rows.map((t) => ({ ...o.look, ...t.look }));
  const multi = rows.length > 1;
  let active = 0;
  const cropped = Boolean(media?.crop && media?.frameAspect && media?.path);
  const width = cropped ? 1080 * Math.min(1, media.frameAspect) : media?.width || 1080;
  const height = cropped ? 1080 / Math.max(1, media.frameAspect) : media?.height || 1920;
  const wide = width > height;
  let cropLayer = null;

  const opt = (map, value) => Object.entries(map).map(([k, label]) =>
    `<option value="${k}"${k === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");

  root.innerHTML = `
    <div class="lk ${multi ? "multi" : ""}">
      <div class="lk-stage-wrap">
        <div>
          <div class="lk-stage ${wide ? "wide" : ""}" style="--ar:${width} / ${height}">
            ${cropped ? `<div class="lk-media"></div>` : media ? media.video
              ? `<video src="${escapeHtml(media.url)}#t=1" muted playsinline preload="metadata"></video>`
              : `<img src="${escapeHtml(media.url)}" alt="" />` : ""}
            <i class="lk-guide"></i>
            ${rows.map((_, k) => `<div class="lk-cap" data-track="${k}"><span></span>${multi ? `<b class="lk-cap-n">${k + 1}</b>` : ""}</div>`).join("")}
          </div>
          <p class="lk-tip">${multi ? "Kéo từng hàng chữ trên khung để đặt vị trí" : "Kéo chữ trên khung để đặt vị trí"}</p>
        </div>
      </div>
      <div class="lk-panel">
        ${multi ? `<div class="lk-f wide"><span>Đang chỉnh hàng</span>
          <div class="lk-rows" role="tablist">${rows.map((t, k) =>
            `<button type="button" role="tab" data-row="${k}"><b>${k + 1}</b> ${escapeHtml(t.label)}</button>`).join("")}</div>
          <button type="button" class="lk-copy" data-copy-style title="Font, cỡ, màu, hiệu ứng của hàng này áp cho các hàng khác — vị trí mỗi hàng giữ nguyên">Dùng kiểu hàng này cho mọi hàng</button>
        </div>` : ""}
        <div class="lk-f wide" ${multi ? 'style="margin-top:12px"' : ""}><span>Mẫu nhanh</span><div class="lk-templates">${o.templates.map((t, i) =>
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
          <div class="lk-f"><span>Font</span><div class="fp" data-font-picker></div></div>
          <label class="lk-f"><span>Hiệu ứng chữ</span><select data-k="preset">${opt(o.presets, looks[0].preset)}</select></label>
          <label class="lk-f"><span>Độ đậm</span><select data-k="weight">${opt({ 400: "Thường", 600: "Hơi đậm", 700: "Đậm vừa", 800: "Đậm", 900: "Rất đậm" }, String(looks[0].weight))}</select></label>
          <div class="lk-f"><span>Màu chữ · màu viền/nền</span>
            <span class="lk-inline"><input type="color" data-k="color" aria-label="Màu chữ" /><input type="color" data-k="accent" aria-label="Màu viền hoặc nền" />
              <label class="lk-inline" style="margin-left:6px"><input type="checkbox" data-k="uppercase" /> IN HOA</label></span></div>
        </div>
      </div>
    </div>`;

  const stage = root.querySelector(".lk-stage");
  const caps = [...root.querySelectorAll(".lk-cap")];
  const fontPicker = lkFontPicker(root.querySelector("[data-font-picker]"), {
    value: looks[0].font,
    onPick: (font) => set({ font }),
  });
  const guide = root.querySelector(".lk-guide");

  // Nút mẫu nhanh tự vẽ đúng kiểu của mẫu đó — nhìn là biết chọn gì.
  root.querySelectorAll("[data-tpl]").forEach((b) => {
    const t = o.templates[Number(b.dataset.tpl)];
    const style = lkTextStyle({ ...looks[0], ...t.look, font: "sans" }, 14);
    Object.assign(b.style, { color: style.color, textShadow: style.textShadow, fontWeight: String(t.look.weight ?? 800) });
    if (style.backgroundColor) b.style.background = style.backgroundColor;
  });

  function paintCap(cap, current, text, unit) {
    const span = cap.querySelector("span");
    const fontSize = current.size * unit;
    const style = lkTextStyle(current, fontSize);
    const perLine = current.preset === "highlight";
    span.textContent = lkUpper(text || LK_SAMPLE, current);
    Object.assign(cap.style, {
      left: `${current.x}%`, top: `${current.y}%`, maxWidth: `${current.width}%`, textAlign: current.align,
    });
    // Reset kiểu cũ ở cả hai lớp rồi mới gán — đổi preset qua lại không để sót bóng/nền.
    const blank = lkTextStyle({ ...current, preset: "plain" }, fontSize);
    Object.assign(cap.style, blank, perLine ? { fontSize: `${fontSize}px`, lineHeight: "1.5", color: current.color } : style);
    Object.assign(span.style, { textShadow: "", backgroundColor: "", padding: "", borderRadius: "", boxDecorationBreak: "", webkitBoxDecorationBreak: "" },
      perLine ? style : {});
  }

  function paint() {
    const rect = stage.getBoundingClientRect();
    const unit = Math.min(rect.width, rect.height) / 1080 || 0.3;
    caps.forEach((cap, k) => {
      paintCap(cap, looks[k], rows[k].sample, unit);
      cap.classList.toggle("on", multi && k === active);
    });
    const current = looks[active];

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
    root.querySelectorAll("[data-row]").forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.row) === active)));
    fontPicker.set(current.font);
  }

  const emit = () => onChange?.(looks.map((l) => ({ ...l })), active);

  function set(patch) {
    looks[active] = { ...looks[active], ...patch };
    paint();
    emit();
  }

  function selectRow(k) {
    if (k === active) return;
    active = k;
    // <select> không tự đổi theo paint() khi đang focus — bỏ focus để hiện đúng giá trị của hàng mới.
    if (root.contains(document.activeElement)) document.activeElement.blur();
    paint();
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
    const row = e.target.closest("[data-row]");
    if (row) return selectRow(Number(row.dataset.row));
    if (e.target.closest("[data-copy-style]")) {
      const { x, y, ...style } = looks[active];
      looks.forEach((l, k) => { looks[k] = { ...l, ...style }; });
      paint();
      return emit();
    }
    const tpl = e.target.closest("[data-tpl]");
    if (tpl) return set(o.templates[Number(tpl.dataset.tpl)].look);
    const pos = e.target.closest("[data-y]");
    if (pos) set({ y: Number(pos.dataset.y), x: 50 });
  });

  // Kéo chữ: tâm khối chữ theo con trỏ, hút về giữa ngang khi lệch dưới 3%. Kéo hàng nào thì chọn hàng đó.
  caps.forEach((cap, k) => cap.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    selectRow(k);
    cap.setPointerCapture(e.pointerId);
    cap.classList.add("drag");
    const rect = stage.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, x: looks[k].x, y: looks[k].y };
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
  }));

  const observer = new ResizeObserver(paint);
  observer.observe(stage);
  paint();
  if (cropped) {
    loadCropTool()
      .then((tool) => {
        const el = root.querySelector(".lk-media");
        if (el) cropLayer = tool.preview(el, { src: media.path, crop: media.crop, frameAspect: media.frameAspect });
      })
      .catch(() => {
        // Không có công cụ crop (server cũ): vẫn hiện video gốc để chỉnh chữ được.
        const el = root.querySelector(".lk-media");
        if (el) el.innerHTML = media.video ? `<video src="${escapeHtml(media.url)}#t=1" muted playsinline preload="metadata"></video>` : "";
      });
  }

  return {
    get look() { return looks[0]; },
    get looks() { return looks.map((l) => ({ ...l })); },
    destroy: () => { observer.disconnect(); fontPicker.destroy(); cropLayer?.close(); },
  };
}

// ---------- màn Phụ đề ----------

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
    renderSubsCrop();
  });
  $("subsSpoken").addEventListener("change", (e) => { subsSpoken = e.target.value; renderSubsLangs(); });
  $("subsLayout").addEventListener("click", (e) => {
    const b = e.target.closest("[data-layout]");
    if (!b) return;
    subsLayout = b.dataset.layout;
    renderSubsLangs();
  });
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
  bindSubsCrop();

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
  renderSubsLangs(); // vẽ luôn trình chỉnh kiểu theo các hàng ngôn ngữ
  renderSubsAdvanced();
  renderSubsCrop();
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
      renderSubsCrop();
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
    `<li><span>${f.video ? icon("clapperboard") : icon("mic")} ${escapeHtml(f.name)}</span>
      <span class="sb-file-meta">${[f.width && f.height ? `${f.width}×${f.height}` : "", fmtDuration(f.duration)].filter(Boolean).join(" · ")}</span>
      <button type="button" class="icon-btn" data-subs-rm="${i}" aria-label="Bỏ ${escapeHtml(f.name)}">${icon("x")}</button></li>`).join("") +
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
      aria-pressed="${subsLangs.includes(l.code)}">${subsLangs.includes(l.code) ? `${icon("check")} ` : ""}${escapeHtml(l.label)}</button>`).join("");

  const layout = $("subsLayout");
  layout.hidden = subsLangs.length < 2;
  layout.querySelectorAll("[data-layout]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layout === subsLayout)));

  const translating = subsLangs.some(Boolean);
  const notes = [];
  if (subsLangs.length === 0) notes.push(`<span class="warn">${icon("triangle-alert")} Chọn ít nhất một ngôn ngữ phụ đề.</span>`);
  if (translating && !subsOptions.canTranslate) {
    notes.push(`<span class="warn">${icon("triangle-alert")} Dịch phụ đề cần model dịch — điền key Gemini, Groq hoặc OpenRouter (có gói miễn phí) trong <a href="#" data-open-settings>Cài đặt</a>.</span>`);
  } else if (translating) {
    notes.push("Nghe lời một lần, rồi dịch sang từng ngôn ngữ đã chọn.");
  }
  if (subsSpoken === "auto") notes.push("Tự nhận đôi khi đoán nhầm với video ngắn — biết tiếng thì chọn luôn cho chắc.");
  $("subsLangNote").innerHTML = notes.join("<br>");
  $("subsLangNote").querySelector("[data-open-settings]")?.addEventListener("click", (e) => { e.preventDefault(); openSettings(); });
  renderSubsSummary();
  renderSubsEditor();
}

function renderSubsAdvanced() {
  $("subsModel").querySelectorAll("[data-model]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.model === subsModel)));
  $("subsAdvSum").textContent = `${subsModel === "small" ? "Nghe nhanh" : "Nghe chuẩn"} · ${
    $("subsReview").checked ? "dừng cho tôi đọc lại" : "chạy thẳng tới video"}`;
}

function renderSubsSummary() {
  const total = subsFiles.length * subsLangs.length;
  $("subsSummary").textContent = subsFiles.length === 0 ? ""
    : subsStacked() ? `${subsFiles.length} video · mỗi video ${subsLangs.length} hàng phụ đề${subsFiles.length > 50 ? " (tối đa 50)" : ""}`
    : subsLangs.length > 1
      ? `${subsFiles.length} video × ${subsLangs.length} ngôn ngữ = ${total} video${total > 50 ? " (tối đa 50)" : ""}`
      : `${subsFiles.length} video`;
  $("subsStart").disabled = subsUploading > 0 || subsFiles.length === 0 || subsLangs.length === 0;
}

function renderSubsEditor() {
  if (!subsOptions || !subsLook) return;
  subsEditor?.destroy();
  const first = subsFiles.find((f) => f.video) ?? null;
  const crop = first ? subsEffectiveCrop() : null;
  const stacked = subsStacked();
  const langs = stacked ? subsLangs : [subsLangs[0] ?? ""];
  $("subsLookTitleNote").textContent = stacked
    ? `— ${subsLangs.length} hàng, kéo từng hàng để đặt vị trí`
    : "— áp dụng cho tất cả video";
  subsEditor = createLookEditor($("subsLookEditor"), {
    tracks: langs.map((code, k) => ({
      label: subsLangLabel(code),
      look: stacked ? subsRowLook(code, k) : subsLook,
      sample: subsSampleFor(code),
    })),
    media: first ? {
      url: first.url, video: true, width: first.width, height: first.height,
      ...(crop && first === subsSample() ? { path: first.path, crop, frameAspect: subsFrameAspect(first) } : {}),
    } : null,
    onChange: (looks) => {
      subsLook = looks[0];
      if (stacked) langs.forEach((code, k) => { if (k > 0) subsTrackLooks[code] = looks[k]; });
    },
  });
}

/**
 * Cắt khung gửi lên server. Chọn khung ra mà chưa chỉnh vùng thì dùng vùng giữa đúng tỉ lệ khung — giống mở khung crop
 * rồi bấm Áp dụng ngay. Không có video nào (chỉ file tiếng) thì không cắt.
 */
function subsCropPayload() {
  const crop = subsEffectiveCrop();
  return crop ? { crop: { frame: subsFrame, crop } } : {};
}

/** Vùng cắt sẽ dùng thật: đã chỉnh thì lấy vùng đó; chọn khung ra mà chưa chỉnh thì vùng giữa lớn nhất vừa khung. */
function subsEffectiveCrop() {
  const sample = subsSample();
  if (!sample || (!subsCrop && subsFrame === "original")) return null;
  if (subsCrop) return subsCrop;
  const media = sample.width / sample.height;
  const frame = subsFrameAspect(sample);
  let w = 1;
  let h = media / frame;
  if (h > 1) { w = 1 / h; h = 1; }
  const r4 = (n) => Math.round(n * 10000) / 10000;
  return { x: r4((1 - w) / 2), y: r4((1 - h) / 2), w: r4(w), h: r4(h), mediaAspect: r4(media),
    ratio: "frame", rotate: 0, flipH: false, flipV: false, fit: "cover" };
}

async function createSubsBatch() {
  blurTyping();
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
      subs: {
        spoken: subsSpoken, languages: subsLangs, look: subsLook, ...subsCropPayload(),
        ...(subsStacked()
          ? { layout: "stack", tracks: subsLangs.map((lang, k) => ({ lang, look: subsRowLook(lang, k) })) }
          : { layout: "separate" }),
      },
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
          <span class="muted">${b.state === "running" ? `${icon("refresh-cw")} đang chạy` : b.state === "done" ? `${icon("circle-check")} xong` : b.state === "paused" ? `${icon("pause")} tạm dừng` : `${icon("circle")} chưa chạy`}</span></span>
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
    // Loạt có cắt khung: xem trước trên hình đã cắt, theo khung video ra. Vùng lưu theo video mẫu lúc tạo loạt —
    // video này khác tỉ lệ thì xem trước lấy vùng giữa đúng khung (video thật server tự tính lại, xem subsCropFor).
    const cut = b.subs.crop;
    if (cut && info.width && info.height) {
      const mediaAspect = info.width / info.height;
      const frameAspect = cut.frame === "original" ? subsNearestAspect(mediaAspect) : SUBS_ASPECTS[cut.frame];
      let crop = cut.crop;
      if (Math.abs(crop.mediaAspect - mediaAspect) >= 0.01) {
        let w = 1;
        let h = mediaAspect / frameAspect;
        if (h > 1) { w = 1 / h; h = 1; }
        crop = { ...crop, x: (1 - w) / 2, y: (1 - h) / 2, w, h, mediaAspect };
      }
      media = { ...media, path: withFile.file, crop, frameAspect };
    }
  }
  const firstLine = b.items.find((i) => i.lines?.length)?.lines[0];
  // Loạt nhiều hàng: chỉnh từng hàng; hàng đầu lấy câu thật của video làm mẫu.
  const rows = b.subs.tracks?.length
    ? b.subs.tracks.map((t, k) => ({
      label: subsLangLabel(t.lang, b.subs.spoken), look: t.look,
      sample: k === 0 && firstLine ? firstLine : subsSampleFor(t.lang, b.subs.spoken),
    }))
    : [{ label: "", look: b.subs.look, sample: firstLine ?? LK_SAMPLE }];
  $("subsLookDlgHint").textContent = "";
  const done = b.items.filter((i) => i.status === "done" || i.status === "error").length;
  $("subsLookApply").textContent = done > 0 ? `Áp dụng & dựng lại ${done} video` : "Áp dụng cho tất cả";
  $("subsLookApply").disabled = false;
  $("subsLookDlg").showModal();
  batchLookEditor = createLookEditor($("subsLookDlgBody"), { tracks: rows, media });
}

async function applyBatchLook() {
  if (!batchCur || !batchLookEditor) return;
  $("subsLookApply").disabled = true;
  try {
    const result = await postJson(`/api/batch/${batchCur.id}/restyle`, { look: batchLookEditor.look, looks: batchLookEditor.looks });
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
