/**
 * Tạo video theo mẫu nhân vật (người que, hoạt hình…): chọn 1 mẫu, dán lời — server tự chọn
 * hành động/biểu cảm theo từ khoá trong từng câu (xem server/template-video.ts). Không cần API key.
 *
 * Nạp sau app.js, dùng chung $, api, postJson, escapeHtml, aspects, state… của nó.
 */

let tplList = [];
let tplSelected = null;
let tplStream = null;

async function showTemplate() {
  stopFollowing();
  $("view-chat").hidden = true;
  $("view-library").hidden = true;
  $("view-multi").hidden = true;
  $("view-batch").hidden = true;
  $("view-subs").hidden = true;
  $("view-template").hidden = false;
  setNav("");
  current = null;
  $("tplHint").textContent = "";
  $("tplProgress").hidden = true;
  $("tplResult").hidden = true;

  $("tplAspect").innerHTML = aspects.map((a) => `<option value="${a.id}">${escapeHtml(a.label)}</option>`).join("");
  $("tplVoice").innerHTML = `<option value="">Không giọng — chỉ phụ đề</option>` +
    state.voices.catalog.map((v) =>
      `<option value="${v.key}"${v.paidPlan ? " disabled" : ""}>${escapeHtml(v.label)}</option>`).join("");
  $("tplMusic").innerHTML = `<option value="">Không nhạc</option>` +
    state.audio.music.map((m) =>
      `<option value="${escapeHtml(m.path)}">${escapeHtml(m.name.replace(/\.\w+$/, ""))}</option>`).join("");

  if (tplList.length === 0) {
    $("tplGrid").innerHTML = `<p class="muted">Đang tải mẫu…</p>`;
    try {
      tplList = (await api("/api/templates")).templates;
      tplSelected ??= tplList[0]?.id ?? null;
    } catch (e) {
      $("tplGrid").innerHTML = `<p class="hint err">${escapeHtml(e.message)}</p>`;
      return;
    }
  }
  renderTplGrid();
}

function renderTplGrid() {
  $("tplGrid").innerHTML = tplList.length
    ? tplList.map((t) => `<button type="button" class="hm-card" data-tpl="${escapeHtml(t.id)}" aria-pressed="${t.id === tplSelected}" title="${escapeHtml(t.description)}">
        <img src="/public/${escapeHtml(t.image)}" alt="" loading="lazy" />
        <span class="hm-note">${escapeHtml(t.name)}</span>
      </button>`).join("")
    : `<p class="muted">Chưa có mẫu nào — thêm ảnh nhân vật vào public/templates/characters/ rồi đăng ký trong server/template-video.ts.</p>`;
}

function bindTemplate() {
  $("tplGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tpl]");
    if (!btn) return;
    tplSelected = btn.dataset.tpl;
    renderTplGrid();
  });
  $("tplSubmit").addEventListener("click", submitTemplate);
}

async function submitTemplate() {
  blurTyping();
  $("tplHint").textContent = "";
  if (!tplSelected) { $("tplHint").textContent = "Chọn 1 mẫu nhân vật trước đã."; return; }
  if (!$("tplText").value.trim()) { $("tplHint").textContent = "Dán lời cho video trước đã."; return; }
  $("tplSubmit").disabled = true;
  $("tplResult").hidden = true;
  try {
    const { jobId } = await postJson("/api/template", {
      templateId: tplSelected,
      title: $("tplTitle").value.trim(),
      text: $("tplText").value,
      voice: $("tplVoice").value,
      music: $("tplMusic").value,
      aspect: $("tplAspect").value,
    });
    followTemplateJob(jobId);
  } catch (e) {
    $("tplHint").textContent = e.message;
    $("tplSubmit").disabled = false;
  }
}

function followTemplateJob(jobId) {
  $("tplProgress").hidden = false;
  $("tplBar").style.width = "0%";
  $("tplLog").textContent = "Đang bắt đầu…";
  tplStream?.close();
  tplStream = new EventSource(`/api/job/${jobId}`);
  tplStream.onmessage = (event) => {
    const { line, status, error, result } = JSON.parse(event.data);
    if (line === "__END__") {
      tplStream.close();
      tplStream = null;
      $("tplSubmit").disabled = false;
      $("tplProgress").hidden = true;
      if (status === "error") {
        $("tplHint").textContent = error ?? "Lỗi không rõ.";
      } else {
        $("tplResult").hidden = false;
        $("tplResult").innerHTML = `<div class="player"><video src="${escapeHtml(result.mp4)}" controls playsinline></video></div>
          <div class="actions"><a class="btn primary" href="${escapeHtml(result.mp4)}" download>${icon("download")} Tải video</a></div>`;
        loadHistory();
      }
      return;
    }
    if (line.startsWith("__PROGRESS__")) {
      const percent = Number(line.split(" ")[1]);
      $("tplBar").style.width = `${percent}%`;
      $("tplLog").textContent = `Đang dựng video… ${percent}%`;
    } else if (line !== "__DONE__" && !line.startsWith("__ERROR__")) {
      $("tplLog").textContent = line;
    }
  };
}
