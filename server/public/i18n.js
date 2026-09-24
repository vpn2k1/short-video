/**
 * Ngôn ngữ giao diện (⚙ Cài đặt › Ngôn ngữ giao diện). Server gắn <html lang="en"> khi chọn English.
 *
 * Cách dịch: code và HTML vẫn viết tiếng Việt; bảng dịch (server/public/i18n/en-*.js) lấy CHÍNH câu tiếng Việt làm
 * khoá. Tiếng Anh thì một bộ theo dõi DOM dịch mọi đoạn chữ và thuộc tính (placeholder, title, aria-label…) khớp
 * nguyên văn một khoá — kể cả chữ app.js vẽ ra sau. Nhờ vậy không phải sửa từng chỗ trong ~12.000 dòng giao diện.
 *
 * - Khớp sau khi gộp khoảng trắng. Không khớp nguyên văn thì thử bỏ emoji/ký hiệu ở đầu-cuối ("🎬 Tạo video" → "Tạo video").
 * - Chữ có số/biến: I18N.patterns([[/^(\d+) cảnh$/, "$1 scenes"]]) — biểu thức phải khớp trọn đoạn chữ.
 * - Trong JS: t("Đã lưu") / t("Còn {n} cảnh", { n }) trả bản dịch (tiếng Việt thì trả nguyên văn, đã điền biến).
 * - Vùng không được dịch (lời người dùng, tiêu đề video…): gắn data-no-i18n hoặc translate="no".
 */
(() => {
  const lang = document.documentElement.lang === "en" ? "en" : "vi";
  const dict = new Map();
  const patterns = [];
  const norm = (text) => text.replace(/\s+/g, " ").trim();
  const fill = (text, vars) =>
    vars ? text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all)) : text;
  /** Có chữ cái tiếng Việt có dấu hoặc là khoá có sẵn — lọc nhanh, khỏi tra bảng cho số, tên file, chữ Anh. */
  const VI_CHAR = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

  /** Số chữ cái có dấu tiếng Việt còn sót — so hai cách dịch một câu ghép. */
  const viCount = (text) => (text.match(new RegExp(VI_CHAR.source, "gi")) ?? []).length;

  const lookup = (core) => {
    if (dict.has(core)) return dict.get(core);
    for (const [re, rep] of patterns) {
      if (re.test(core)) return core.replace(re, rep);
    }
    return null;
  };

  /** Tra một đoạn đã gộp khoảng trắng; không khớp nguyên văn thì bỏ emoji/ký hiệu đầu-cuối rồi tra phần lõi. */
  const lookupWrapped = (n) => {
    const out = lookup(n);
    if (out != null) return out;
    // "🎬 Tạo video", "Tạo video →", "(3 cảnh)" — tách phần bao quanh không phải chữ/số rồi tra phần lõi.
    const m = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u.exec(n);
    if (m && m[2] && (m[1] || m[3])) {
      // Bỏ riêng phần đầu trước ("🎙 Câu … xong." giữ dấu chấm cuối cho mẫu), rồi mới bỏ cả hai đầu.
      const keepTail = m[1] ? lookup(m[2] + m[3]) : null;
      if (keepTail != null) return m[1] + keepTail;
      const core = lookup(m[2]);
      if (core != null) return m[1] + core + m[3];
    }
    return null;
  };

  /** Bản dịch của một đoạn chữ, null nếu không có. Giữ khoảng trắng và emoji/ký hiệu bao quanh. */
  const translate = (text) => {
    if (!text.trim()) return null;
    let out = lookupWrapped(norm(text));
    // Câu ghép từ nhiều mẩu ("Đã tạo … · 8 cảnh · 130s\n🎙 giọng …"): dịch từng mẩu, mẩu nào không có bản dịch giữ nguyên.
    // Một mẫu "(.+)" có thể nuốt cả câu mà để nửa sau tiếng Việt — dịch cả hai cách, lấy bản còn ít chữ Việt hơn.
    if (/\n| · /.test(text) && !dict.has(norm(text))) {
      let hit = false;
      const pieces = text.trim().split("\n").map((line) => line.split(" · ").map((part) => {
        const done = part.trim() ? lookupWrapped(norm(part)) : null;
        if (done == null) return part;
        hit = true;
        return done;
      }).join(" · ")).join("\n");
      if (hit && (out == null || viCount(pieces) < viCount(out))) out = pieces;
    }
    if (out == null) return null;
    const lead = /^\s*/.exec(text)[0];
    const trail = /\s*$/.exec(text)[0];
    return lead + out + trail;
  };

  const t = (vi, vars) => {
    const text = String(vi ?? "");
    if (lang !== "en") return fill(text, vars);
    const out = translate(text);
    return fill(out ?? text, vars);
  };

  window.I18N = {
    lang,
    /** Thêm bảng dịch { "câu tiếng Việt": "English" }. */
    add(entries) {
      for (const [vi, en] of Object.entries(entries)) dict.set(norm(vi), en);
      if (lang === "en" && document.body) translateTree(document.body);
    },
    /** Thêm mẫu dịch cho chữ có biến: [[/^Còn (\d+) cảnh$/, "$1 scenes left"], …]. */
    patterns(list) {
      for (const [re, rep] of list) patterns.push([re, rep]);
      if (lang === "en" && document.body) translateTree(document.body);
    },
    t,
  };
  window.t = t;

  // Nút VI/EN trên thanh điều hướng: lưu vào Cài đặt (server nhớ, vì mỗi lần mở app là một cổng/origin mới) rồi tải lại.
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("langToggle");
    const label = document.getElementById("langToggleLabel");
    if (!button) return;
    const next = lang === "en" ? "vi" : "en";
    if (label) label.textContent = next.toUpperCase();
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const response = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ APP_LANGUAGE: next }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || response.statusText);
        location.reload();
      } catch (error) {
        button.disabled = false;
        alert(`${t("Không đổi được ngôn ngữ")}: ${error instanceof Error ? error.message : error}`);
      }
    });
  });

  if (lang !== "en") return;

  // Bảng dịch chỉ nạp khi dùng tiếng Anh — người dùng tiếng Việt không tải thêm gì.
  for (const part of ["index", "app", "app2", "misc", "server"]) {
    document.write(`<script src="/i18n/en-${part}.js"></script>`);
  }

  const ATTRS = ["placeholder", "title", "aria-label", "alt", "label", "data-tip", "data-title", "data-placeholder"];
  // <pre>/<code> vẫn dịch: kịch bản mẫu (#syntaxExample) cần ra tiếng Anh — chỉ đoạn khớp nguyên văn bảng dịch mới đổi.
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT"]);
  /** Đoạn chữ đã dịch → chính bản dịch; nhờ vậy lần theo dõi sau thấy "đã là bản dịch" thì bỏ qua. */
  const done = new WeakMap();

  const skipped = (el) => {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (SKIP_TAGS.has(node.tagName)) return true;
      if (node.isContentEditable) return true;
      if (node.hasAttribute("data-no-i18n") || node.getAttribute("translate") === "no") return true;
    }
    return false;
  };

  /** Lọc nhanh trước khi tra: có chữ Việt có dấu, hoặc (bỏ ký hiệu đầu-cuối) là một khoá không dấu như "Khung:". */
  const worthTrying = (value) => {
    if (VI_CHAR.test(value)) return true;
    const n = norm(value);
    return dict.has(n) || dict.has(n.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""));
  };

  const translateText = (node) => {
    const value = node.nodeValue;
    if (!value || done.get(node) === value) return;
    if (!worthTrying(value)) return;
    if (skipped(node.parentElement)) return;
    const out = translate(value);
    if (out != null && out !== value) {
      done.set(node, out);
      node.nodeValue = out;
    }
  };

  const translateAttrs = (el) => {
    for (const name of ATTRS) {
      const value = el.getAttribute(name);
      if (!value || !worthTrying(value)) continue;
      const out = translate(value);
      if (out != null && out !== value) el.setAttribute(name, out);
    }
    // Nút <input type="button" value="…">
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && VI_CHAR.test(el.value)) {
      const out = translate(el.value);
      if (out != null) el.value = out;
    }
  };

  function translateTree(root) {
    if (root.nodeType === 3) return translateText(root);
    if (root.nodeType !== 1 || skipped(root)) return;
    translateAttrs(root);
    for (const el of root.querySelectorAll("*")) {
      if (el.attributes.length) translateAttrs(el);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) translateText(node);
  }

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") translateText(m.target);
      else if (m.type === "attributes") translateAttrs(m.target);
      else for (const node of m.addedNodes) translateTree(node);
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });

  document.addEventListener("DOMContentLoaded", () => {
    translateTree(document.body);
    if (VI_CHAR.test(document.title)) document.title = t(document.title);
  });

  // Hộp thoại của trình duyệt.
  for (const name of ["alert", "confirm", "prompt"]) {
    const original = window[name].bind(window);
    window[name] = (message, ...rest) => original(t(String(message ?? "")), ...rest);
  }
})();
