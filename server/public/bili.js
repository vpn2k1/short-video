/**
 * 📺 Tư liệu Bilibili — tìm, xem trước và tải đoạn video mà TÁC GIẢ GHI RÕ CHO PHÉP DÙNG.
 *
 * Server lọc theo lời tác giả, kiểm tra lại khi mở chi tiết và ngay trước khi tải (scripts/bilibili.ts).
 * Clip tải về nằm ở public/uploads/bilibili/ kèm file bằng chứng — dùng trong Thư viện, trình chỉnh sửa,
 * hoặc bấm "Dựng video từ clip" để mở luôn một dự án mới.
 *
 * Nạp sau app.js, dùng chung các hàm $, api, postJson, escapeHtml, download, setNav, stopFollowing… của nó.
 */

const BILI_KEYWORDS = ["免费商用 视频素材", "空镜头 可商用", "航拍 免费素材", "CC0 素材", "欢迎二创"];
const BILI_ORDERS = [["totalrank", "Phù hợp nhất"], ["click", "Nhiều lượt xem"], ["pubdate", "Mới nhất"], ["stow", "Nhiều lượt lưu"]];

const bili = {
  query: "",
  order: "totalrank",
  results: [],
  stats: null,
  busy: null,
  /** bvid đã kiểm tra chi tiết (tự làm, không trả phí, mô tả đầy đủ vẫn cho phép). */
  verified: new Set(),
  rejected: 0,
  checking: null,
  open: null,
  detail: null,
  /** Clip đã tải trong phiên này: [{ path, credit, title }] */
  downloads: [],
  job: null,
  tool: null,
};

const biliClock = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s % 60).padStart(2, "0")}`;
};

/** "1:23" / "83" / "1:02:03" → giây; trống → null; sai → NaN. */
const biliParseClock = (text) => {
  const value = String(text ?? "").trim();
  if (!value) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) return NaN;
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
};

const biliCount = (n) => (n >= 10_000 ? `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)} vạn` : String(n));

function showBili() {
  stopFollowing();
  for (const id of ["view-chat", "view-library", "view-multi", "view-batch", "view-subs"]) $(id).hidden = true;
  $("view-bili").hidden = false;
  setNav("bili");
  current = null;
  renderBili();
  if (!bili.tool) {
    api("/api/bilibili/tool").then((d) => { bili.tool = { version: d.version, updating: null }; renderBiliTool(); }).catch(() => {});
  }
}

function setBiliHint(text, isError = false) {
  $("biliHint").textContent = text;
  $("biliHint").classList.toggle("err", isError);
}

function renderBili() {
  $("biliQuery").value = bili.query;
  $("biliOrder").innerHTML = BILI_ORDERS.map(([v, l]) => `<option value="${v}"${v === bili.order ? " selected" : ""}>${l}</option>`).join("");
  $("biliChips").innerHTML = BILI_KEYWORDS.map((k) => `<button type="button" class="bl-chip" data-kw="${escapeHtml(k)}">${escapeHtml(k)}</button>`).join("");
  renderBiliSearchButtons();
  renderBiliResults();
  renderBiliDetail();
  renderBiliDownloads();
  renderBiliTool();
}

function renderBiliSearchButtons() {
  const q = $("biliQuery").value.trim();
  $("biliSearch").disabled = bili.busy !== null || !q;
  $("biliSearch").textContent = bili.busy === "search" ? "Đang tìm…" : "Tìm";
  $("biliTranslate").hidden = !q || /[一-鿿]/.test(q);
  $("biliTranslate").disabled = bili.busy !== null;
  $("biliTranslate").textContent = bili.busy === "translate" ? "Đang dịch…" : "文 Dịch sang tiếng Trung";
}

function renderBiliResults() {
  const s = bili.stats;
  $("biliStats").textContent = s
    ? `${s.kept - bili.rejected}/${s.scanned} video có lời cho phép${bili.rejected ? ` · loại thêm ${bili.rejected} sau khi kiểm tra kỹ` : ""} · trang ${s.page}/${s.pages}`
    : "";
  $("biliResults").innerHTML = bili.results.map((r) => `
    <button type="button" class="bl-card ${bili.open === r.bvid ? "on" : ""}" data-bvid="${r.bvid}" title="${escapeHtml(r.permission.quote)}">
      <span class="bl-cover"><img src="${escapeHtml(r.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" /><i>${biliClock(r.duration)}</i></span>
      <span class="bl-meta">
        <b>${escapeHtml(r.title)}</b>
        <small>${escapeHtml(r.author)} · ${biliCount(r.plays)} lượt xem</small>
        <span class="bl-tags">${r.permission.labels.map((l) => `<em>✓ ${escapeHtml(l)}</em>`).join("")}${
          bili.verified.has(r.bvid) ? "" : `<em class="pending">đang kiểm tra…</em>`}</span>
      </span>
    </button>`).join("") ||
    (s && bili.busy === null ? `<p class="muted bl-empty">Chưa thấy video nào tác giả cho phép dùng. Thêm “免费商用” hoặc “素材” vào từ khoá, hoặc tìm trang sau.</p>` : "");
  $("biliMore").hidden = !s || s.page >= s.pages;
  $("biliMore").disabled = bili.busy !== null;
  $("biliMore").textContent = bili.busy === "search" ? "Đang tìm…" : "Tìm trang sau";
}

async function biliSearch(page) {
  blurTyping();
  const q = $("biliQuery").value.trim();
  if (!q) return;
  bili.query = q;
  bili.busy = "search";
  setBiliHint("");
  renderBiliSearchButtons();
  renderBiliResults();
  try {
    const d = await api(`/api/bilibili/search?${new URLSearchParams({ q, page: String(page), order: bili.order })}`);
    if (page === 1) {
      bili.results = [];
      bili.rejected = 0;
    }
    const seen = new Set(bili.results.map((r) => r.bvid));
    bili.results.push(...d.results.filter((r) => !seen.has(r.bvid)));
    bili.stats = {
      page: d.page, pages: d.pages,
      scanned: (page === 1 ? 0 : bili.stats?.scanned ?? 0) + d.scanned,
      kept: (page === 1 ? 0 : bili.stats?.kept ?? 0) + d.results.length,
    };
  } catch (e) {
    setBiliHint(e.message, true);
  } finally {
    bili.busy = null;
    renderBiliSearchButtons();
    renderBiliResults();
    biliVerifyNext();
  }
}

/** Kiểm tra lần lượt từng kết quả ở nền (server gọi Bilibili thưa ra). Không qua thì bỏ khỏi danh sách. */
async function biliVerifyNext() {
  if (bili.checking) return;
  const next = bili.results.find((r) => !bili.verified.has(r.bvid));
  if (!next) return;
  bili.checking = next.bvid;
  try {
    const d = await api(`/api/bilibili/detail/${next.bvid}`);
    if (!d.permission) {
      bili.results = bili.results.filter((r) => r.bvid !== next.bvid);
      bili.rejected++;
    }
  } catch {
    // lỗi mạng: giữ lại, mở chi tiết sẽ kiểm tra lại
  }
  bili.verified.add(next.bvid);
  bili.checking = null;
  if (!$("view-bili").hidden) renderBiliResults();
  biliVerifyNext();
}

async function biliOpen(bvid) {
  bili.open = bvid;
  bili.detail = null;
  bili.job = null;
  renderBiliResults();
  renderBiliDetail();
  try {
    const d = await api(`/api/bilibili/detail/${bvid}`);
    if (bili.open !== bvid) return;
    bili.detail = d;
  } catch (e) {
    if (bili.open !== bvid) return;
    bili.detail = { error: e.message };
  }
  renderBiliDetail();
}

function renderBiliDetail() {
  const box = $("biliDetail");
  const d = bili.detail;
  if (!bili.open) {
    box.innerHTML = `<div class="bl-placeholder">
      <b>Chọn một video bên trái</b>
      <p class="muted">Xem trước, đọc lời cho phép của tác giả, chọn đoạn cần dùng rồi tải vào thư viện.</p>
    </div>`;
    return;
  }
  if (!d) {
    box.innerHTML = `<p class="muted">Đang kiểm tra quyền sử dụng…</p>`;
    return;
  }
  if (d.error) {
    box.innerHTML = `<p class="hint err">${escapeHtml(d.error)}</p>`;
    return;
  }
  const running = bili.job?.status === "running";
  const parts = d.parts.length > 1 ? `
    <label class="bl-field">Phần
      <select id="biliPart" ${running ? "disabled" : ""}>${d.parts.map((p) =>
        `<option value="${p.page}">P${p.page} · ${escapeHtml(p.title)} (${biliClock(p.duration)})</option>`).join("")}</select>
    </label>` : "";
  box.innerHTML = `
    <div class="bl-player">
      <iframe src="https://player.bilibili.com/player.html?${new URLSearchParams({ bvid: d.bvid, p: "1", autoplay: "0", danmaku: "0" })}"
        title="${escapeHtml(d.title)}" allow="fullscreen; picture-in-picture" referrerpolicy="no-referrer"></iframe>
    </div>
    <h2 class="bl-title">${escapeHtml(d.title)}</h2>
    <p class="muted">${escapeHtml(d.author)} · <a href="${escapeHtml(d.url)}" target="_blank" rel="noreferrer">Mở trên Bilibili ↗</a></p>
    ${d.permission ? `
      <div class="bl-permit">
        <span class="bl-tags">${d.permission.labels.map((l) => `<em>✓ ${escapeHtml(l)}</em>`).join("")}</span>
        <blockquote>${escapeHtml(d.permission.quote)}</blockquote>
        <details><summary>Đọc toàn bộ mô tả của tác giả</summary><p>${escapeHtml(d.desc || "(trống)")}</p></details>
        <p class="muted">Dùng đúng điều kiện tác giả nêu (ví dụ “不得用于售卖” = không được bán lại chính tư liệu).${d.noReprintFlag
          ? " Video có bật dấu “cấm đăng lại khi chưa được phép” mặc định của Bilibili — lời cho phép trên là sự cho phép của tác giả; dùng làm tư liệu trong video của bạn, không đăng lại nguyên bản."
          : ""}</p>
      </div>
      ${parts}
      <div class="bl-range">
        <label class="bl-field">Từ<input id="biliStart" placeholder="0:00" ${running ? "disabled" : ""} /></label>
        <label class="bl-field">Đến<input id="biliEnd" placeholder="${biliClock(d.parts[0].duration)}" ${running ? "disabled" : ""} /></label>
        <label class="bl-field">Chất lượng<select id="biliHeight" ${running ? "disabled" : ""}><option value="1080">1080p</option><option value="720">720p</option></select></label>
      </div>
      <p class="muted" id="biliRangeNote"></p>
      <label class="bl-check"><input type="checkbox" id="biliConfirm" ${running ? "disabled" : ""} />
        Tôi đã đọc lời cho phép và sẽ dùng đúng điều kiện của tác giả, có ghi nguồn</label>
      <button type="button" class="send" id="biliDownload" disabled>⬇ Tải vào thư viện</button>
    ` : `<p class="hint err">Không dùng được video này: ${escapeHtml(d.reason)}</p>`}
    <p class="hint ${bili.job?.status === "error" ? "err" : ""}" id="biliJob">${escapeHtml(bili.job?.line ?? "")}</p>`;
  if (d.permission) syncBiliForm();
}

function biliCurrentPart() {
  const d = bili.detail;
  const page = Number($("biliPart")?.value ?? 1);
  return d.parts.find((p) => p.page === page) ?? d.parts[0];
}

function syncBiliForm() {
  const part = biliCurrentPart();
  const start = biliParseClock($("biliStart").value);
  const end = biliParseClock($("biliEnd").value);
  const error = Number.isNaN(start) || Number.isNaN(end)
    ? "Giờ gõ dạng phút:giây, ví dụ 1:05."
    : (start ?? 0) >= (end ?? part.duration)
      ? "Điểm cuối phải sau điểm bắt đầu."
      : (end ?? 0) > part.duration ? `Phần này chỉ dài ${biliClock(part.duration)}.` : null;
  $("biliEnd").placeholder = biliClock(part.duration);
  $("biliRangeNote").textContent = error ?? `Để trống là tải cả phần ${biliClock(part.duration)} — chỉ lấy đoạn cần dùng cho nhẹ.`;
  $("biliRangeNote").classList.toggle("err", Boolean(error));
  $("biliDownload").disabled = Boolean(error) || !$("biliConfirm").checked || bili.job?.status === "running";
  $("biliDownload").textContent = bili.job?.status === "running" ? "Đang tải…" : "⬇ Tải vào thư viện";
}

async function biliDownload() {
  const d = bili.detail;
  const part = biliCurrentPart();
  const body = {
    bvid: d.bvid,
    part: part.page,
    start: biliParseClock($("biliStart").value),
    end: biliParseClock($("biliEnd").value),
    maxHeight: Number($("biliHeight").value),
    confirmed: $("biliConfirm").checked,
  };
  const setLine = (line, status = "running") => {
    bili.job = { status, line };
    const el = $("biliJob");
    if (el) {
      el.textContent = line;
      el.classList.toggle("err", status === "error");
    }
    if ($("biliDownload")) syncBiliForm();
  };
  setLine("Đang gửi yêu cầu…");
  try {
    const { jobId } = await postJson("/api/bilibili/download", body);
    const source = new EventSource(`/api/job/${jobId}`);
    source.onmessage = (event) => {
      const { line, status, result, error } = JSON.parse(event.data);
      if (line === "__END__") {
        source.close();
        if (status === "done") {
          bili.downloads.unshift({ ...result, title: d.title });
          setLine("Đã tải xong — clip ở danh sách bên dưới và trong 📁 Thư viện › Tài nguyên.", "done");
          renderBiliDownloads();
        } else {
          setLine(error ?? "Tải thất bại.", "error");
        }
        return;
      }
      if (!line.startsWith("__")) setLine(line);
    };
  } catch (e) {
    setLine(e.message, "error");
  }
}

function renderBiliDownloads() {
  $("biliDownloads").hidden = bili.downloads.length === 0;
  $("biliDownloadList").innerHTML = bili.downloads.map((item, k) => `
    <div class="bl-dl">
      <video src="/public/${escapeHtml(item.path)}" controls muted playsinline preload="metadata"></video>
      <div class="bl-dl-body">
        <b>${escapeHtml(item.title)}</b>
        <small>${escapeHtml(item.credit)}</small>
        <div class="actions">
          <button type="button" class="btn primary" data-bl-edit="${k}">✂️ Dựng video từ clip</button>
          <button type="button" class="btn" data-bl-credit="${k}">Chép ghi nguồn</button>
          <button type="button" class="btn" data-bl-save="${k}">⬇ Tải về máy</button>
        </div>
      </div>
    </div>`).join("");
}

/** Mở dự án mới trong trình chỉnh sửa với clip này làm video đầu tiên. */
async function biliEdit(item, button) {
  button.disabled = true;
  try {
    const durationMs = await new Promise((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => resolve(Math.round(probe.duration * 1000));
      probe.onerror = () => resolve(5000);
      probe.src = `/public/${item.path}`;
    });
    const { slug } = await postJson("/api/editor/new", {
      // Tiêu đề chữ Hán không ra tên thư mục đọc được — đặt mã video lên trước.
      title: `${item.path.split("/").pop().split("-")[0]} ${item.title}`.slice(0, 60),
      aspect: "9:16",
      media: [{ path: item.path, durationMs }],
    });
    location.href = `/editor.html#${encodeURIComponent(slug)}`;
  } catch (e) {
    setBiliHint(e.message, true);
    button.disabled = false;
  }
}

function renderBiliTool() {
  const t = bili.tool;
  $("biliTool").innerHTML = t
    ? `Bộ tải: yt-dlp ${escapeHtml(t.version ?? "chưa có")} · <button type="button" class="bl-link" id="biliUpdate" ${t.updating ? "disabled" : ""}>${
        escapeHtml(t.updating ?? "Cập nhật")}</button> — tải lỗi sau khi Bilibili đổi trang thì bấm Cập nhật.`
    : "";
}

async function biliUpdateTool() {
  bili.tool.updating = "Đang cập nhật…";
  renderBiliTool();
  try {
    const { jobId } = await postJson("/api/bilibili/tool/update", {});
    const source = new EventSource(`/api/job/${jobId}`);
    source.onmessage = (event) => {
      const { line, status, result, error } = JSON.parse(event.data);
      if (line === "__END__") {
        source.close();
        bili.tool = { version: status === "done" ? result.version : bili.tool.version, updating: null };
        if (status !== "done") setBiliHint(error ?? "Cập nhật yt-dlp thất bại.", true);
        renderBiliTool();
        return;
      }
      if (!line.startsWith("__")) { bili.tool.updating = line.slice(0, 60); renderBiliTool(); }
    };
  } catch (e) {
    bili.tool.updating = null;
    setBiliHint(e.message, true);
    renderBiliTool();
  }
}

function bindBili() {
  $("biliForm").addEventListener("submit", (e) => { e.preventDefault(); biliSearch(1); });
  $("biliQuery").addEventListener("input", renderBiliSearchButtons);
  $("biliOrder").addEventListener("change", (e) => { bili.order = e.target.value; });
  $("biliMore").addEventListener("click", () => biliSearch((bili.stats?.page ?? 0) + 1));
  $("biliTranslate").addEventListener("click", async () => {
    bili.busy = "translate";
    renderBiliSearchButtons();
    try {
      const { keywords } = await postJson("/api/bilibili/translate", { text: $("biliQuery").value });
      $("biliQuery").value = keywords;
    } catch (e) {
      setBiliHint(e.message, true);
    } finally {
      bili.busy = null;
      renderBiliSearchButtons();
    }
  });
  $("biliChips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-kw]");
    if (!chip || bili.busy) return;
    $("biliQuery").value = chip.dataset.kw;
    biliSearch(1);
  });
  $("biliResults").addEventListener("click", (e) => {
    const card = e.target.closest("[data-bvid]");
    if (card) biliOpen(card.dataset.bvid);
  });
  $("biliDetail").addEventListener("input", (e) => { if (e.target.closest("input")) syncBiliForm(); });
  $("biliDetail").addEventListener("change", (e) => {
    if (e.target.id === "biliPart") {
      const frame = $("biliDetail").querySelector("iframe");
      if (frame) frame.src = frame.src.replace(/([?&]p=)\d+/, `$1${e.target.value}`);
    }
    if (e.target.closest("select, input")) syncBiliForm();
  });
  $("biliDetail").addEventListener("click", (e) => { if (e.target.id === "biliDownload") biliDownload(); });
  $("biliDownloadList").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-bl-edit]");
    const credit = e.target.closest("[data-bl-credit]");
    const save = e.target.closest("[data-bl-save]");
    if (edit) biliEdit(bili.downloads[Number(edit.dataset.blEdit)], edit);
    if (credit) {
      navigator.clipboard.writeText(bili.downloads[Number(credit.dataset.blCredit)].credit)
        .then(() => { credit.textContent = "Đã chép"; }, () => {});
    }
    if (save) download(`/public/${bili.downloads[Number(save.dataset.blSave)].path}`);
  });
  $("biliTool").addEventListener("click", (e) => { if (e.target.id === "biliUpdate") biliUpdateTool(); });
}
