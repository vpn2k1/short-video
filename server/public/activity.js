// Ô "Tiến trình" góc dưới phải: mọi việc đang chạy nền (tạo video, xuất từ trình chỉnh sửa, đọc giọng, phụ đề,
// làm hàng loạt) kèm bước và phần trăm — làm nhiều video một lúc vẫn theo dõi được, không chỉ video đang mở.
// Việc xong thì bật thông báo; bấm vào mở đúng video đó, nút Tải được làm nổi lên.
// Dữ liệu: GET /api/activity (server/activity.ts). File tự chứa — dùng cả ở trang chính lẫn trình chỉnh sửa.
(() => {
  const POLL_BUSY_MS = 2000;
  const POLL_IDLE_MS = 4000;
  const TOAST_MS = 15000;
  /** Việc xong trong chừng này trước lần hỏi đầu tiên vẫn báo (vừa chuyển trang / tải lại lúc nó xong). */
  const LATE_TOAST_MS = 2 * 60_000;
  const SEEN_KEY = "activitySeen";

  const KIND = {
    turn: "Tạo video",
    multi: "Video nhiều cảnh",
    render: "Xuất video",
    subtitles: "Phụ đề tự động",
    voice: "Đọc giọng",
  };
  const STEP = { script: "Viết kịch bản", voice: "Đọc giọng", images: "Tìm hình", image: "Tạo ảnh", render: "Dựng video" };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clock = (ms) => new Date(ms).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const elapsed = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? `${s} giây` : `${Math.floor(s / 60)} phút ${String(s % 60).padStart(2, "0")} giây`;
  };

  // Trạng thái "đã báo" lưu trong localStorage để chuyển trang không báo lại — lỗi storage thì chỉ nhớ trong trang.
  const seen = new Set();
  try {
    for (const id of JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")) seen.add(id);
  } catch { /* bỏ qua */ }
  const remember = (id) => {
    seen.add(id);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)));
    } catch { /* bỏ qua */ }
  };

  /** Việc đọc giọng / phụ đề áp vào trình chỉnh sửa; còn lại kết quả nằm trong trang video (có nút Tải). */
  const targetOf = (item) => item.kind === "voice" || item.kind === "subtitles"
    ? `/editor.html#${encodeURIComponent(item.slug)}`
    : `/#/v/${encodeURIComponent(item.slug)}`;

  /** Mở đúng video; ở trang chính thì chờ nút Tải hiện rồi làm nó nổi lên. */
  const open = (item) => {
    const url = targetOf(item);
    const onMain = location.pathname === "/" || location.pathname.endsWith("/index.html");
    if (onMain && url.startsWith("/#")) {
      if (location.hash === url.slice(1)) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = url.slice(1);
      if (item.status === "done") pulseDownload();
    } else {
      location.href = url;
    }
    setPanel(false);
  };

  const pulseDownload = () => {
    const started = Date.now();
    const tick = () => {
      const button = document.getElementById("projectDownload");
      if (button && !button.hidden) {
        button.classList.add("act-pulse");
        button.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setTimeout(() => button.classList.remove("act-pulse"), 4000);
      } else if (Date.now() - started < 6000) {
        setTimeout(tick, 200);
      }
    };
    setTimeout(tick, 200);
  };

  // ---------- giao diện ----------
  const style = document.createElement("style");
  style.textContent = `
    .act-dock { position: fixed; right: 16px; bottom: 16px; z-index: 48; display: flex; flex-direction: column;
      align-items: flex-end; gap: 10px; font-family: var(--ui-font, system-ui, sans-serif); pointer-events: none; }
    .act-dock > * { pointer-events: auto; }
    .act-pill { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px;
      border: 1px solid var(--line-2, #323845); background: rgba(24, 27, 34, .94); color: var(--text, #eef0f5);
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-2, 0 8px 24px rgba(0,0,0,.5));
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .act-pill:hover { background: var(--panel-3, #242833); }
    .act-pill:focus-visible, .act-panel button:focus-visible, .act-toast button:focus-visible { outline: none; box-shadow: var(--ring, 0 0 0 3px rgba(255,122,26,.28)); }
    .act-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.2);
      border-top-color: var(--accent, #ff7a1a); animation: act-spin .9s linear infinite; }
    @keyframes act-spin { to { transform: rotate(360deg); } }
    .act-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok, #3ecf8e); }
    .act-panel { width: min(360px, calc(100vw - 32px)); max-height: min(60vh, 520px); overflow: auto; border-radius: 14px;
      border: 1px solid var(--line-2, #323845); background: rgba(19, 21, 27, .97); color: var(--text, #eef0f5);
      box-shadow: var(--shadow-3, 0 24px 64px rgba(0,0,0,.7)); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    .act-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; font-size: 13px; font-weight: 700; }
    .act-head button { border: 0; background: none; color: var(--muted, #8d95a7); cursor: pointer; font: inherit; font-size: 12px; padding: 4px 6px; border-radius: 6px; }
    .act-head button:hover { color: var(--text, #eef0f5); background: var(--panel-3, #242833); }
    .act-list { list-style: none; margin: 0; padding: 0 8px 8px; display: grid; gap: 4px; }
    .act-row { display: grid; gap: 6px; padding: 10px; border-radius: 10px; background: var(--panel-2, #1b1e26); }
    .act-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; min-width: 0; }
    .act-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .act-meta { font-size: 12px; color: var(--muted, #8d95a7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .act-bar { height: 4px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
    .act-bar i { display: block; height: 100%; border-radius: inherit; background: var(--accent, #ff7a1a); transition: width .4s var(--ease, ease); }
    .act-bar.indet i { width: 35% !important; animation: act-slide 1.3s ease-in-out infinite; }
    @keyframes act-slide { from { transform: translateX(-100%); } to { transform: translateX(290%); } }
    .act-actions { display: flex; gap: 6px; }
    .act-btn { border: 1px solid var(--line-2, #323845); background: var(--panel-3, #242833); color: var(--text, #eef0f5);
      font: inherit; font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 8px; cursor: pointer; }
    .act-btn.primary { background: var(--grad-accent, #ff7a1a); border-color: transparent; color: var(--accent-ink, #1c0e00); }
    .act-btn:hover { filter: brightness(1.1); }
    .act-ok { color: var(--ok, #3ecf8e); }
    .act-err { color: var(--err, #ff6b6b); }
    .act-empty { padding: 4px 14px 14px; font-size: 12px; color: var(--muted, #8d95a7); }
    .act-toasts { display: grid; gap: 8px; justify-items: end; }
    .act-toast { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 10px; align-items: start; width: min(340px, calc(100vw - 32px));
      padding: 12px 12px 12px 14px; border-radius: 12px; border: 1px solid var(--line-2, #323845); background: rgba(24, 27, 34, .97);
      color: var(--text, #eef0f5); box-shadow: var(--shadow-3, 0 24px 64px rgba(0,0,0,.7)); animation: act-in .25s var(--ease, ease); }
    .act-toast .t { font-size: 13px; font-weight: 700; }
    .act-toast .m { grid-column: 2; font-size: 12px; color: var(--muted, #8d95a7); overflow: hidden; text-overflow: ellipsis; }
    .act-toast .act-actions { grid-column: 2; margin-top: 6px; }
    .act-toast .x { border: 0; background: none; color: var(--muted, #8d95a7); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 6px; }
    .act-toast .x:hover { color: var(--text, #eef0f5); }
    @keyframes act-in { from { opacity: 0; transform: translateY(8px); } }
    .act-pulse { animation: act-pulse 1s ease-in-out 3; }
    @keyframes act-pulse { 50% { box-shadow: 0 0 0 6px rgba(62, 207, 142, .45); transform: scale(1.04); } }
    @media (prefers-reduced-motion: reduce) {
      .act-spin, .act-bar.indet i, .act-toast, .act-pulse { animation: none; }
    }
    @media (max-width: 600px) { .act-dock { right: 12px; left: 12px; bottom: 12px; align-items: stretch; } .act-pill { align-self: flex-end; } }
  `;
  document.head.appendChild(style);

  const dock = document.createElement("div");
  dock.className = "act-dock";
  dock.innerHTML = `<div class="act-toasts" aria-live="polite"></div>
    <section class="act-panel" id="activityPanel" hidden aria-label="Tiến trình"></section>
    <button type="button" class="act-pill" id="activityPill" hidden aria-expanded="false" aria-controls="activityPanel"></button>`;
  const mount = () => document.body.appendChild(dock);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
  const toasts = dock.querySelector(".act-toasts");
  const panel = dock.querySelector("#activityPanel");
  const pill = dock.querySelector("#activityPill");

  let data = { items: [], batches: [] };
  let panelOpen = false;
  const setPanel = (openIt) => {
    panelOpen = openIt;
    panel.hidden = !openIt;
    pill.setAttribute("aria-expanded", String(openIt));
    if (openIt) renderPanel();
  };
  pill.addEventListener("click", () => setPanel(!panelOpen));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) setPanel(false); });

  const runningLine = (item) => {
    const step = STEP[item.step] ?? (item.step ? item.step : "Đang bắt đầu");
    const pct = item.percent != null ? ` · ${item.percent}%` : "";
    return `${KIND[item.kind] ?? "Đang xử lý"} · ${step}${pct} · ${elapsed(Date.now() - item.startedAt)}`;
  };

  const renderPanel = () => {
    const running = data.items.filter((i) => i.status === "running");
    const finished = data.items.filter((i) => i.status !== "running");
    const rows = [
      ...data.batches.map((b) => {
        const pct = b.total ? Math.round(((b.done + b.error) / b.total) * 100) : 0;
        return `<li class="act-row">
          <div class="act-title"><div class="act-spin" aria-hidden="true"></div><span>Loạt: ${esc(b.name)}</span></div>
          <div class="act-meta">Làm hàng loạt · ${b.done}/${b.total} video xong${b.error ? ` · ${b.error} lỗi` : ""}</div>
          <div class="act-bar"><i style="width:${pct}%"></i></div>
          <div class="act-actions"><button type="button" class="act-btn" data-batch="${esc(b.id)}">Xem loạt</button></div>
        </li>`;
      }),
      ...running.map((item) => {
        const determinate = item.step === "render" && item.percent != null;
        return `<li class="act-row">
          <div class="act-title"><div class="act-spin" aria-hidden="true"></div><span data-no-i18n>${esc(item.title)}</span></div>
          <div class="act-meta" title="${esc(item.last)}">${esc(runningLine(item))}</div>
          <div class="act-bar ${determinate ? "" : "indet"}"><i style="width:${determinate ? item.percent : 35}%"></i></div>
          <div class="act-actions"><button type="button" class="act-btn" data-open="${esc(item.id)}">Xem</button></div>
        </li>`;
      }),
      ...finished.map((item) => item.status === "done"
        ? `<li class="act-row">
            <div class="act-title"><span class="act-ok" aria-hidden="true">✓</span><span data-no-i18n>${esc(item.title)}</span></div>
            <div class="act-meta">${esc(KIND[item.kind] ?? "Việc")} xong lúc ${clock(item.finishedAt)}</div>
            <div class="act-actions"><button type="button" class="act-btn primary" data-open="${esc(item.id)}">${item.kind === "voice" || item.kind === "subtitles" ? "Mở chỉnh sửa" : "Mở để tải"}</button></div>
          </li>`
        : `<li class="act-row">
            <div class="act-title"><span class="act-err" aria-hidden="true">✗</span><span data-no-i18n>${esc(item.title)}</span></div>
            <div class="act-meta" title="${esc(item.error)}">Lỗi: ${esc(item.error)}</div>
            <div class="act-actions"><button type="button" class="act-btn" data-open="${esc(item.id)}">Xem</button></div>
          </li>`),
    ];
    const canNotify = "Notification" in window && Notification.permission === "default";
    panel.innerHTML = `<div class="act-head">Tiến trình
        <span>${canNotify ? `<button type="button" data-notify title="Báo khi video xong kể cả lúc đang ở tab hoặc ứng dụng khác">Bật thông báo máy</button>` : ""}
        <button type="button" data-close aria-label="Đóng">✕</button></span></div>
      ${rows.length ? `<ul class="act-list">${rows.join("")}</ul>` : `<p class="act-empty">Không có việc nào đang chạy.</p>`}`;
  };

  panel.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-close")) return setPanel(false);
    if (target.hasAttribute("data-notify")) {
      Notification.requestPermission().then(renderPanel).catch(() => undefined);
      return;
    }
    if (target.dataset.batch) {
      const url = `/#/batch/${encodeURIComponent(target.dataset.batch)}`;
      if (location.pathname === "/") location.hash = url.slice(1);
      else location.href = url;
      return setPanel(false);
    }
    const item = data.items.find((i) => i.id === target.dataset.open);
    if (item) open(item);
  });

  const renderPill = () => {
    const running = data.items.filter((i) => i.status === "running").length + data.batches.length;
    const finished = data.items.filter((i) => i.status !== "running").length;
    // Trình chỉnh sửa: góc dưới phải là timeline — chỉ hiện ô khi có việc đang chạy (xong/lỗi vẫn báo bằng thông báo).
    pill.hidden = running === 0 && (finished === 0 || location.pathname.startsWith("/editor"));
    pill.innerHTML = running
      ? `<div class="act-spin" aria-hidden="true"></div>${running} việc đang chạy`
      : `<span class="act-dot" aria-hidden="true"></span>Tiến trình`;
  };

  const toast = (item) => {
    const ok = item.status === "done";
    const el = document.createElement("div");
    el.className = "act-toast";
    el.setAttribute("role", "status");
    const label = ok
      ? (item.kind === "voice" || item.kind === "subtitles" ? "Mở chỉnh sửa" : "Mở để tải")
      : "Xem lỗi";
    el.innerHTML = `<span class="${ok ? "act-ok" : "act-err"}" aria-hidden="true">${ok ? "✓" : "✗"}</span>
      <div class="t">${ok ? `${esc(KIND[item.kind] ?? "Việc")} xong` : `${esc(KIND[item.kind] ?? "Việc")} bị lỗi`}</div>
      <button type="button" class="x" aria-label="Đóng">✕</button>
      <div class="m" data-no-i18n>${esc(item.title)}</div>
      <div class="act-actions"><button type="button" class="act-btn ${ok ? "primary" : ""}" data-go>${label}</button></div>`;
    const close = () => el.remove();
    el.querySelector(".x").addEventListener("click", close);
    el.querySelector("[data-go]").addEventListener("click", () => { close(); open(item); });
    toasts.prepend(el);
    setTimeout(close, TOAST_MS);
    // Đang ở tab/ứng dụng khác mà người dùng đã cho phép: báo bằng thông báo của máy, bấm vào quay lại đúng video.
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(ok ? "Video đã xong" : "Video bị lỗi", { body: item.title, tag: item.id });
        n.onclick = () => { window.focus(); open(item); n.close(); };
      } catch { /* một số trình duyệt chặn Notification ngoài service worker */ }
    }
  };

  let first = true;
  let timer = null;
  let inFlight = false;
  /** Một bộ hẹn giờ duy nhất — hỏi sớm (đổi trang) thì huỷ lượt hẹn cũ, không sinh thêm vòng hỏi song song. */
  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  };
  const poll = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        data = await res.json();
        for (const item of data.items) {
          if (item.status === "running" || seen.has(item.id)) continue;
          // Lần hỏi đầu: việc xong đã lâu coi như đã biết; vừa xong (lúc chuyển trang) thì vẫn báo.
          const fresh = !first || Date.now() - item.finishedAt < LATE_TOAST_MS;
          // Đang mở đúng video đó thì trang đã tự hiện kết quả — khỏi báo trùng.
          const watching = !document.hidden && location.hash === `#/v/${item.slug}` && item.kind !== "voice" && item.kind !== "subtitles";
          if (fresh && !watching) toast(item);
          remember(item.id);
        }
        first = false;
        renderPill();
        if (panelOpen) renderPanel();
      }
    } catch {
      // server đang khởi động lại / mất kết nối — lần sau hỏi lại
    } finally {
      inFlight = false;
    }
    const busy = data.items.some((i) => i.status === "running") || data.batches.length > 0;
    schedule(busy ? POLL_BUSY_MS : POLL_IDLE_MS);
  };
  poll();
  // Vừa tạo video (trang chuyển sang video mới): hỏi sớm để ô hiện ngay, không đợi lượt hỏi thưa.
  window.addEventListener("hashchange", () => schedule(300));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(200); });
})();
