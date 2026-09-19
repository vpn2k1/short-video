/**
 * Sửa hàng loạt video có sẵn: chọn nhiều video trong Thư viện → một hộp thoại chọn thay đổi → tạo một loạt
 * nguồn "edit" (server/batch.ts) và mở màn theo dõi loạt đó. Mỗi video ra một bản mới, bản cũ vẫn giữ.
 *
 * Hai cách sửa, khác nhau ở chỗ giữ được gì:
 *   - Giữ chỉnh sửa: chỉ đổi nhạc, tên kênh, màu rồi render lại — cắt cảnh, phụ đề sửa tay vẫn nguyên.
 *   - Dựng lại từ kịch bản: đổi được phong cách, giọng, khung, thay chữ; chỉnh sửa tay không mang sang bản mới.
 *
 * Nạp sau app.js, dùng chung $, state, aspects, icon, escapeHtml, postJson, loadHistory, setSelecting,
 * musicLabel, styleMeta, RANDOM_MUSIC của nó.
 */

let bulkEditVideos = [];
let bulkEditKind = "props";

/** Giá trị "giữ nguyên" của các ô chọn — khác mọi giá trị thật (kể cả "" = không giọng). */
const BE_KEEP = "__keep__";

const BE_DESC = {
  props: "Nhanh, không gọi AI. Giữ nguyên lời, giọng đã đọc và mọi chỉnh sửa trong trình chỉnh sửa — chỉ render lại với nhạc, tên kênh, màu mới.",
  rebuild: "Dựng lại từ kịch bản: đọc lại giọng, dựng lại hình. Chỉnh sửa tay trong trình chỉnh sửa không mang sang bản mới — bản cũ vẫn còn trong lịch sử của từng video.",
};

function openBulkEdit(videos) {
  if (!videos.length) return;
  bulkEditVideos = videos;
  fillBulkEditOptions();
  $("beHandle").value = "";
  $("beAccentOn").checked = false;
  $("beAccent").disabled = true;
  $("beReview").checked = false;
  $("beReplace").innerHTML = "";
  addReplacePair();
  // Có video không có kịch bản (dựng từ file thu sẵn, nhiều cảnh) thì mặc định cách giữ chỉnh sửa.
  setBulkEditKind("props");
  $("beHint").textContent = "";
  $("beHint").classList.remove("err");
  $("bulkEditDlg").showModal();
}

function fillBulkEditOptions() {
  const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  const keep = option(BE_KEEP, "Giữ như từng video");
  $("beStyle").innerHTML = keep + option("auto", "✨ Tự động — AI chọn theo nội dung") +
    (state?.styles ?? []).map((s) => option(s.id, `${s.emoji} ${s.label}`)).join("");
  $("beVoice").innerHTML = keep + option("", "Không giọng") +
    (state?.voices.catalog ?? []).filter((v) => !v.paidPlan).map((v) => option(v.key, v.label)).join("");
  $("beAspect").innerHTML = keep + aspects.map((a) => option(a.id, a.label)).join("");
  $("beMusic").innerHTML = keep + option("none", "Không nhạc") +
    (state?.keys.freesound ? option(RANDOM_MUSIC, "🎲 Nhạc ngẫu nhiên (mỗi video một bản)") : "") +
    (state?.audio.music ?? []).filter((m) => !/placeholder/i.test(m.name)).map((m) => option(m.path, musicLabel(m.path))).join("");
}

function setBulkEditKind(kind) {
  bulkEditKind = kind;
  document.querySelectorAll("[data-be-kind]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.beKind === kind)));
  document.querySelectorAll("[data-be-only]").forEach((el) => { el.hidden = el.dataset.beOnly !== kind; });
  const n = bulkEditVideos.length;
  const unscripted = bulkEditVideos.filter((v) => !v.scripted).length;
  let desc = BE_DESC[kind];
  if (kind === "rebuild" && unscripted) {
    desc += ` ${unscripted}/${n} video không có kịch bản (dựng từ file thu sẵn hoặc nhiều cảnh) sẽ được bỏ ra.`;
  }
  $("beDesc").textContent = desc;
  $("beTitle").textContent = `Sửa ${n} video`;
}

function addReplacePair() {
  const row = document.createElement("div");
  row.className = "be-pair";
  row.innerHTML = `<input data-find placeholder="Chữ cũ" aria-label="Chữ cần thay" />
    <span class="muted">→</span>
    <input data-to placeholder="Chữ mới (để trống = xoá)" aria-label="Thay bằng" />
    <button type="button" class="icon-btn" aria-label="Bỏ cặp này">${icon("x")}</button>`;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    if (!$("beReplace").children.length) addReplacePair();
  });
  $("beReplace").append(row);
}

/** Đọc hộp thoại thành EditPlan gửi lên server; chỉ gửi ô người dùng đã đổi. */
function bulkEditPlan() {
  const plan = { kind: bulkEditKind };
  const music = $("beMusic").value;
  if (music !== BE_KEEP) plan.music = music === "none" ? null : music;
  if ($("beHandle").value.trim()) plan.handle = $("beHandle").value.trim();
  if ($("beAccentOn").checked) plan.accent = $("beAccent").value;
  if (bulkEditKind === "rebuild") {
    for (const [key, id] of [["style", "beStyle"], ["voice", "beVoice"], ["aspect", "beAspect"]]) {
      if ($(id).value !== BE_KEEP) plan[key] = $(id).value;
    }
    const replace = [...$("beReplace").querySelectorAll(".be-pair")]
      .map((row) => ({ find: row.querySelector("[data-find]").value, to: row.querySelector("[data-to]").value }))
      .filter((pair) => pair.find.trim());
    if (replace.length) plan.replace = replace;
  }
  return plan;
}

async function submitBulkEdit(e) {
  e.preventDefault();
  const plan = bulkEditPlan();
  const hint = $("beHint");
  const { kind, ...changes } = plan;
  if (Object.keys(changes).length === 0) {
    hint.textContent = "Chưa đổi gì — chọn ít nhất một thay đổi.";
    hint.classList.add("err");
    return;
  }
  const videos = kind === "rebuild" ? bulkEditVideos.filter((v) => v.scripted) : bulkEditVideos;
  if (videos.length === 0) {
    hint.textContent = "Không video nào đã chọn có kịch bản để dựng lại — dùng cách “Giữ chỉnh sửa”.";
    hint.classList.add("err");
    return;
  }
  $("beGo").disabled = true;
  hint.textContent = "";
  try {
    const batch = await postJson("/api/batch", {
      source: "edit",
      items: videos.map((v) => v.slug),
      edit: plan,
      review: kind === "rebuild" && $("beReview").checked,
      start: true,
    });
    $("bulkEditDlg").close();
    setSelecting(false);
    loadHistory();
    location.hash = `#/batch/${batch.id}`;
  } catch (err) {
    hint.textContent = err.message;
    hint.classList.add("err");
  } finally {
    $("beGo").disabled = false;
  }
}

(function bindBulkEdit() {
  document.querySelectorAll("[data-be-kind]").forEach((b) =>
    b.addEventListener("click", () => setBulkEditKind(b.dataset.beKind)));
  $("beAccentOn").addEventListener("change", () => { $("beAccent").disabled = !$("beAccentOn").checked; });
  $("beReplaceAdd").addEventListener("click", addReplacePair);
  $("bulkEditForm").addEventListener("submit", submitBulkEdit);
  $("bulkEditDlg").querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $("bulkEditDlg").close()));
})();
