let state = null;
let current = null;   // { slug, script, props }

const $ = (id) => document.getElementById(id);
const api = async (path, options) => {
  const res = await fetch(path, options);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
};

// ---------- khởi động ----------
async function boot() {
  state = await api("/api/state");
  renderKeys();
  renderVideos();

  $("composition").innerHTML = state.compositions
    .map((c) => `<option value="${c}">${c}</option>`).join("");

  const groups = { vi: [], en: [] };
  for (const v of state.voices.catalog) groups[v.lang].push(v);
  $("voice").innerHTML =
    `<option value="">Không có giọng</option>` +
    Object.entries(groups).map(([lang, list]) =>
      `<optgroup label="${lang === "vi" ? "Tiếng Việt" : "Tiếng Anh"}">` +
      list.map((v) => `<option value="${v.key}"${v.paidPlan ? " disabled" : ""}>` +
        `${v.label}${v.paidPlan ? " (cần gói trả phí)" : ""}</option>`).join("") +
      `</optgroup>`).join("");
  $("voice").value = "linh";

  fillMusicSelect();
  $("createNote").textContent = state.keys.anthropic
    ? "Có ANTHROPIC_API_KEY — sinh kịch bản tự động được."
    : "Chưa có ANTHROPIC_API_KEY: nút này sẽ lỗi. Tạo video mới rồi tự viết cảnh ở tab Sửa kịch bản.";
  $("hint").textContent = `${state.videos.length} video`;
}

function renderKeys() {
  const label = { anthropic: "Claude", elevenlabs: "ElevenLabs", pexels: "Pexels", gemini: "Gemini" };
  // Chỉ kiểm tra key CÓ TỒN TẠI trong .env, không gọi API để thử quyền —
  // gọi thử mỗi lần mở trang thì chậm và tốn quota. Ghi rõ điều đó ở tooltip
  // để dấu ✓ không bị hiểu nhầm là "dịch vụ chạy được".
  $("keys").innerHTML = Object.entries(state.keys)
    .map(([k, on]) => `<span class="key ${on ? "on" : "off"}" title="${
      on ? "Key có trong .env — chưa kiểm tra quyền thật" : "Chưa có key trong .env"
    }">${label[k]} ${on ? "✓" : "✗"}</span>`)
    .join("");
}

function renderVideos() {
  $("videos").innerHTML = state.videos.map((v) => `
    <div class="video-item ${current?.slug === v.slug ? "active" : ""}" onclick="openVideo('${v.slug}')">
      <div class="t">${escapeHtml(v.title)}</div>
      <div class="m">${v.slug} · ${v.scenes} cảnh · ${v.captions} câu${v.mp4 ? " · ✓ mp4" : ""}</div>
    </div>`).join("") || `<p class="muted">Chưa có video nào.</p>`;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- tabs ----------
function tab(name) {
  if (name === "join") renderJoinList();
  if (name === "voice") renderVoiceStage();
  if (name === "audio") renderAudio();
  for (const t of ["create", "edit", "voice", "assets", "audio", "join"]) {
    $(`pane-${t}`).classList.toggle("hidden", t !== name);
    $(`tab-${t}`).classList.toggle("on", t === name);
  }
}

function toggleDrawer() { $("main").classList.toggle("drawer"); }

// ---------- flow ----------
let stages = [];
const STAGE_TAB = { script: "edit", voice: "voice", images: "assets", audio: "audio", render: null };

async function refreshFlow() {
  if (!current?.slug) { $("flow").innerHTML = ""; return; }
  try {
    const data = await api(`/api/pipeline/${current.slug}`);
    stages = data.stages;
  } catch { stages = []; return; }

  $("flow").innerHTML = stages.map((st, i) => `
    ${i > 0 ? '<div class="arrow">→</div>' : ""}
    <div class="node" id="node-${st.id}" onclick="openStage('${st.id}')">
      <div class="n-top"><i class="dot s-${st.state}"></i><span class="n-label">${st.label}</span></div>
      <div class="n-detail">${escapeHtml(st.detail)}</div>
      ${st.runnable && (st.id === "voice" || st.id === "render")
        ? `<button class="n-run" onclick="event.stopPropagation();runStage('${st.id}')">Chạy bước này</button>`
        : ""}
    </div>`).join("");
}

function openStage(id) {
  document.querySelectorAll(".node").forEach((n) => n.classList.remove("sel"));
  $(`node-${id}`)?.classList.add("sel");
  const t = STAGE_TAB[id];
  if (t) tab(t);
  else $("main").classList.add("drawer");   // render → mở panel bên phải
}

function renderVoiceStage() {
  const fill = (sel, from) => { const cur = $(sel).value; $(sel).innerHTML = from; $(sel).value = cur; };
  fill("voiceStage", $("voice").innerHTML);
  fill("musicStage", `<option value="">Không</option>` +
    state.audio.music.map((m) => `<option value="${m.path}">${m.name}</option>`).join(""));
  if (current?.props) {
    $("subPosStage").value = current.props.captionPosition ?? "bottom";
    $("musicStage").value = current.props.music ?? "";
    $("sfxStage").checked = Boolean(current.props.sfx);
  }
  if (!$("voiceStage").value) $("voiceStage").value = $("voice").value || "linh";
}

async function runStage(id) {
  if (!current?.slug) return log("Chọn video trước.");
  $("log").textContent = ""; $("bar").style.width = "0";
  $("main").classList.add("drawer");

  // Chốt chặn: select rỗng (chưa mở tab Giọng đọc) thì lấy lại từ props đang có,
  // nếu không sẽ âm thầm xoá giọng và nhạc của video.
  const p = current.props;
  const currentVoice = $("voiceStage").value || $("voice").value || undefined;
  const currentMusic = $("musicStage").value || p?.music || null;
  const body = id === "voice"
    ? { slug: current.slug, voice: currentVoice, music: currentMusic,
        sfx: $("sfxStage").checked || Boolean(p?.sfx),
        captionPosition: $("subPosStage").value || p?.captionPosition || "bottom" }
    : { slug: current.slug, composition: $("composition").value };

  if (id === "voice") {
    log(`Giọng: ${currentVoice ?? "không"} · Nhạc: ${currentMusic ?? "không"}`);
  }

  try {
    const { jobId } = await api(`/api/stage/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (id === "render") $("renderBtn").disabled = true;
    follow(jobId, async (result, status) => {
      state = await api("/api/state");
      current = await api(`/api/video/${current.slug}`);
      renderVideos(); await refreshFlow();
      if (status === "done" && result?.mp4) {
        $("preview").innerHTML = `<video src="${result.mp4}?t=${Date.now()}" controls autoplay muted></video>
          <a href="${result.mp4}" download style="display:block;margin-top:8px">
            <button>Tải mp4 xuống</button></a>`;
      }
    });
  } catch (e) { log(`Lỗi: ${e.message}`); $("renderBtn").disabled = false; }
}

// ---------- nhạc & tiếng ----------
function fillMusicSelect() {
  const cur = $("music").value;
  $("music").innerHTML = `<option value="">Không</option>` +
    state.audio.music.map((m) => `<option value="${m.path}">${m.name}</option>`).join("");
  $("music").value = cur;
}

function renderAudio() {
  $("musicMood").innerHTML = state.audio.moods
    .map((m) => `<option value="${m}">${m}</option>`).join("");
  $("sfxKind").innerHTML = state.audio.sfxKinds
    .map((k) => `<option value="${k}">${k}</option>`).join("");
  const list = (items, dir) => items.map((it) =>
    `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
       <span style="flex:0 0 130px">${escapeHtml(it.name)}</span>
       <audio controls preload="none" src="/public/${it.path}" style="height:30px;flex:1"></audio>
     </div>`).join("") || `<span class="muted">chưa có file nào</span>`;
  $("musicList").innerHTML = list(state.audio.music, "music");
  $("sfxList").innerHTML = list(state.audio.sfx, "sfx");
  $("elevenNote").textContent = state.keys.elevenlabs
    ? "Cần key có quyền music_generation / sound_generation. Key mặc định KHÔNG có — sửa quyền trong dashboard ElevenLabs."
    : "Chưa có ELEVENLABS_API_KEY.";
}

async function genAudio(kind, engine) {
  $("log").textContent = ""; $("main").classList.add("drawer");
  const payload = { kind, engine };
  if (engine === "local") {
    payload.which = kind === "music" ? $("musicMood").value : $("sfxKind").value;
    payload.seconds = kind === "music" ? Number($("musicSecs").value) : 2;
  } else {
    payload.prompt = $("aiPrompt").value.trim();
    payload.name = $("aiName").value.trim();
    payload.seconds = Number($("aiSecs").value);
    if (!payload.prompt) return log("Nhập mô tả ngữ cảnh đã.");
  }
  try {
    const { jobId } = await api("/api/audio/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    follow(jobId, (result, status) => {
      if (status === "done" && result?.audio) {
        state.audio = result.audio;
        renderAudio(); fillMusicSelect();
        if (result.path?.startsWith("music/")) $("music").value = result.path;
      }
    });
  } catch (e) { log(`Lỗi: ${e.message}`); }
}

// ---------- ghép video ----------
let joinOrder = [];
function renderJoinList() {
  joinOrder = joinOrder.filter((s) => state.videos.some((v) => v.slug === s && v.mp4));
  $("joinList").innerHTML = state.videos.map((v) => {
    const i = joinOrder.indexOf(v.slug);
    return `<div class="video-item ${i >= 0 ? "active" : ""}" onclick="toggleJoin('${v.slug}')">
      <div class="t">${i >= 0 ? `${i + 1}. ` : ""}${escapeHtml(v.title)}</div>
      <div class="m">${v.slug}${v.mp4 ? "" : " · chưa render, không ghép được"}</div>
    </div>`;
  }).join("");
}
function toggleJoin(slug) {
  const v = state.videos.find((x) => x.slug === slug);
  if (!v?.mp4) return log(`${slug} chưa render.`);
  const i = joinOrder.indexOf(slug);
  if (i >= 0) joinOrder.splice(i, 1); else joinOrder.push(slug);
  renderJoinList();
}
async function joinVideos() {
  if (joinOrder.length < 2) return log("Chọn ít nhất 2 video.");
  $("log").textContent = ""; $("main").classList.add("drawer");
  const { jobId } = await api("/api/concat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slugs: joinOrder, name: $("joinName").value.trim() || "ghep" }),
  });
  follow(jobId, (result, status) => {
    if (status === "done" && result?.mp4) {
      $("preview").innerHTML = `<video src="${result.mp4}?t=${Date.now()}" controls></video>
        <a href="${result.mp4}" download style="display:block;margin-top:8px">
          <button>Tải mp4 xuống</button></a>`;
    }
  });
}

// ---------- video ----------
async function openVideo(slug) {
  current = await api(`/api/video/${slug}`);
  renderVideos();
  renderScript();
  renderVoiceStage();   // đổ sẵn select — nút "Chạy bước này" trên node dùng được ngay
  await refreshFlow();
  tab("edit");
  const v = state.videos.find((x) => x.slug === slug);
  $("preview").innerHTML = v?.mp4
    ? `<video src="${v.mp4}?t=${Date.now()}" controls></video>
       <a href="${v.mp4}" download style="display:block;margin-top:8px">
         <button>Tải mp4 xuống</button></a>` : "";
  if (current.props) {
    $("subPos").value = current.props.captionPosition ?? "bottom";
    $("music").value = current.props.music ?? "";
    $("sfx").checked = Boolean(current.props.sfx);
  }
}

function newVideo() {
  current = { slug: "", script: { title: "Video mới", subtitle: "", handle: "@kenh",
    accent: "#e8590c", background: "#0b0b12",
    scenes: [{ image: null, visual: null, lines: ["Câu đầu tiên.", "Câu thứ hai.", "Lưu lại nhé!"] }] }, props: null };
  renderScript();
  $("flow").innerHTML = "";
  tab("edit");
}

function renderScript() {
  const s = current?.script;
  if (!s) { $("scenes").innerHTML = `<p class="muted">Video này chưa có script.json (có thể dựng từ audio).</p>`;
            $("scriptMeta").innerHTML = ""; return; }
  $("scriptMeta").innerHTML = `
    <div class="row">
      <div><label>Tên thư mục</label><input id="f-slug" value="${escapeHtml(current.slug)}" /></div>
      <div><label>Handle</label><input id="f-handle" value="${escapeHtml(s.handle)}" /></div>
    </div>
    <label>Tiêu đề</label><input id="f-title" value="${escapeHtml(s.title)}" />
    <label>Phụ đề tiêu đề</label><input id="f-subtitle" value="${escapeHtml(s.subtitle)}" />
    <div class="row">
      <div><label>Màu nhấn</label><input id="f-accent" value="${escapeHtml(s.accent)}" /></div>
      <div><label>Màu nền</label><input id="f-background" value="${escapeHtml(s.background)}" /></div>
    </div>`;
  $("scenes").innerHTML = s.scenes.map((sc, i) => {
    const v = sc.visual ?? null;
    return `
    <div class="scene" data-index="${i}">
      <h3>Cảnh ${i + 1}</h3>
      <div class="grid">
        <div>
          <label>Ảnh nền (đường dẫn từ public/)</label>
          <input class="sc-image" value="${escapeHtml(sc.image ?? "")}" placeholder="bỏ trống = chỉ gradient" />
          <div class="row" style="margin-top:6px">
            <input class="sc-query" placeholder="tìm ảnh Pexels (tiếng Anh)" />
            <button style="flex:0 0 auto;width:auto" onclick="searchImages(${i})">Tìm</button>
          </div>
          <div class="picker hidden" id="picker-${i}"></div>

          <label>Hình vẽ bằng code</label>
          <select class="sc-vtype">
            <option value=""${!v ? " selected" : ""}>Không có</option>
            <option value="stat"${v?.type === "stat" ? " selected" : ""}>stat — con số lớn</option>
            <option value="badge"${v?.type === "badge" ? " selected" : ""}>badge — nhãn bước</option>
          </select>
          <input class="sc-vtext" style="margin-top:6px" value="${escapeHtml(v?.text ?? "")}" placeholder="7-9 (≤16 ký tự)" />
          <input class="sc-vcaption" style="margin-top:6px" value="${escapeHtml(v?.caption ?? "")}" placeholder="chú thích (bỏ trống được)" />
        </div>
        <div>
          <label>Câu phụ đề — mỗi dòng một câu, tối đa 42 ký tự</label>
          <textarea class="sc-lines">${escapeHtml(sc.lines.join("\n"))}</textarea>
          <button style="margin-top:8px" onclick="removeScene(${i})">Xoá cảnh</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ---------- chọn ảnh Pexels ----------
const lastQuery = {};
async function searchImages(index) {
  const scene = document.querySelector(`.scene[data-index="${index}"]`);
  const query = scene.querySelector(".sc-query").value.trim();
  if (!query) return log("Nhập từ khoá tiếng Anh để tìm.");
  const box = $(`picker-${index}`);
  box.classList.remove("hidden");
  box.innerHTML = `<span class="muted">đang tìm…</span>`;
  try {
    const { photos } = await api(`/api/pexels/search?q=${encodeURIComponent(query)}`);
    lastQuery[index] = query;
    box.innerHTML = photos.length
      ? `<span class="muted">${photos.length} kết quả — bấm để chọn</span>
         <div class="thumbs">${photos.map((p) =>
           `<img src="${p.thumb}" title="${escapeHtml(p.photographer)}"
                 onclick="pickImage(${index}, ${p.id})" />`).join("")}</div>`
      : `<span class="muted">Không có kết quả.</span>`;
  } catch (e) {
    box.innerHTML = `<span class="warn">Lỗi: ${escapeHtml(e.message)}</span>`;
  }
}

async function pickImage(index, id) {
  if (!current?.slug) return log("Lưu kịch bản trước để có tên thư mục.");
  const box = $(`picker-${index}`);
  box.innerHTML = `<span class="muted">đang tải ảnh…</span>`;
  try {
    const result = await api("/api/pexels/pick", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: current.slug, query: lastQuery[index], id }),
    });
    document.querySelector(`.scene[data-index="${index}"] .sc-image`).value = result.image;
    box.innerHTML = `<span class="muted">Đã gán: ${escapeHtml(result.image)}<br>${escapeHtml(result.credit)}</span>`;
    log(`Cảnh ${index + 1}: ${result.credit}`);
  } catch (e) {
    box.innerHTML = `<span class="warn">Lỗi: ${escapeHtml(e.message)}</span>`;
  }
}

function collectScript() {
  const scenes = [...document.querySelectorAll(".scene")].map((el) => {
    // Đọc lại visual từ form. Trước đây chỗ này gán cứng null nên mở một video
    // có visual rồi bấm Lưu là xoá sạch — mất dữ liệu mà không báo gì.
    const type = el.querySelector(".sc-vtype").value;
    const text = el.querySelector(".sc-vtext").value.trim();
    const caption = el.querySelector(".sc-vcaption").value.trim();
    return {
      image: el.querySelector(".sc-image").value.trim() || null,
      visual: type && text ? { type, text, caption: caption || null } : null,
      lines: el.querySelector(".sc-lines").value.split("\n").map((l) => l.trim()).filter(Boolean),
    };
  }).filter((s) => s.lines.length > 0);
  return {
    slug: $("f-slug").value.trim(),
    script: {
      title: $("f-title").value, subtitle: $("f-subtitle").value,
      handle: $("f-handle").value, accent: $("f-accent").value,
      background: $("f-background").value, scenes,
    },
  };
}

function addScene() {
  const { script } = collectScript();
  script.scenes.push({ image: null, visual: null, lines: ["Câu mới."] });
  current.script = script; renderScript();
}
function removeScene(i) {
  const { script } = collectScript();
  script.scenes.splice(i, 1);
  current.script = script; renderScript();
}

async function saveScript() {
  const { slug, script } = collectScript();
  if (!slug) return log("Cần tên thư mục.");
  try {
    await api(`/api/video/${slug}/script`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(script),
    });
    log(`Đã lưu videos/${slug}/script.json`);
    state = await api("/api/state");
    current.slug = slug; renderVideos(); await refreshFlow();
  } catch (e) { log(`Lỗi: ${e.message}`); }
}

// ---------- job + SSE ----------
function log(line) {
  const el = $("log");
  el.textContent += (el.textContent ? "\n" : "") + line;
  el.scrollTop = el.scrollHeight;
}

function follow(jobId, onDone) {
  const src = new EventSource(`/api/job/${jobId}`);
  src.onmessage = (event) => {
    const { line, status, result, error } = JSON.parse(event.data);
    if (line === "__END__") {
      src.close();
      $("renderBtn").disabled = false;
      if (status === "error") log(`LỖI: ${error}`);
      onDone?.(result, status);
      return;
    }
    // Marker nội bộ — __END__ đã báo lỗi rồi, in thêm là trùng lặp.
    if (line === "__DONE__" || line.startsWith("__ERROR__")) return;
    if (line.startsWith("__PROGRESS__")) {
      $("bar").style.width = line.split(" ")[1] + "%";
      return;
    }
    log(line);
  };
}

// ---------- hành động ----------
async function createVideo() {
  const prompt = $("prompt").value.trim();
  if (!prompt) return log("Nhập prompt đã.");
  $("log").textContent = "";
  try {
    const { jobId } = await api("/api/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, name: $("newName").value.trim() || undefined }),
    });
    follow(jobId, async (result) => {
      if (result?.slug) { state = await api("/api/state"); await openVideo(result.slug); }
    });
  } catch (e) { log(`Lỗi: ${e.message}`); }
}

async function fetchImages() {
  if (!current?.slug) return log("Chọn hoặc lưu video trước.");
  const queries = $("imgQueries").value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!queries.length) return log("Nhập ít nhất một truy vấn.");
  $("log").textContent = "";
  const { jobId } = await api("/api/images", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: current.slug, queries, sources: $("imgSource").value.split(",") }),
  });
  follow(jobId, (result) => {
    if (result?.files?.length) log(`\nGán vào cảnh:\n${result.files.join("\n")}`);
  });
}

async function uploadFile() {
  const file = $("upFile").files[0];
  if (!file) return log("Chọn file đã.");
  const kind = $("upKind").value;
  const dir = kind === "images" ? `images/${current?.slug ?? "shared"}` : kind;
  const res = await fetch(`/api/upload?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(file.name)}`,
    { method: "POST", body: file });
  const body = await res.json();
  $("upResult").textContent = res.ok
    ? `Đã lưu public/${body.path} (${(body.bytes / 1024).toFixed(0)} KB)`
    : `Lỗi: ${body.error}`;
}

async function render() {
  if (!current?.slug) return log("Chọn video trước.");
  $("log").textContent = ""; $("bar").style.width = "0";
  $("renderBtn").disabled = true;
  try {
    const { jobId } = await api("/api/render", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: current.slug, voice: $("voice").value || undefined,
        music: $("music").value || null, sfx: $("sfx").checked,
        captionPosition: $("subPos").value, composition: $("composition").value,
        regenerateVoice: $("regen").checked,
      }),
    });
    follow(jobId, async (result, status) => {
      if (status === "done" && result?.mp4) {
        state = await api("/api/state");
        renderVideos();
        $("preview").innerHTML = `<video src="${result.mp4}?t=${Date.now()}" controls autoplay muted></video>
          <a href="${result.mp4}" download style="display:block;margin-top:8px">
            <button>Tải mp4 xuống</button></a>`;
      }
    });
  } catch (e) { log(`Lỗi: ${e.message}`); $("renderBtn").disabled = false; }
}

boot().catch((e) => { $("hint").textContent = "lỗi: " + e.message; });
