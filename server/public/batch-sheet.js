/**
 * Nhập loạt từ bảng tính: mỗi dòng một video, mỗi cột một cài đặt riêng (phong cách, khung, giọng, hình, nhạc,
 * kiểu lời). Có cột cài đặt thì đổ thẳng vào nguồn "Mỗi video một ô" (batchCards); chỉ có một cột nội dung thì
 * vẫn là danh sách ý tưởng như trước.
 *
 * Giá trị trong ô được khớp lỏng: bỏ dấu, không phân biệt hoa thường, nhận cả mã lẫn tên hiển thị
 * ("cinematic" hay "Điện ảnh", "9:16" hay "dọc"). Ô để trống = theo cài đặt chung. Ô không hiểu được thì
 * bỏ qua và báo lại đúng dòng, cột — không chặn cả file vì một chữ gõ sai.
 *
 * Nạp sau app.js, dùng chung $, state, aspects, opts, IMAGE_SOURCES, BT_CARD_KEYS, batchCards, newBatchCard,
 * setBatchHint, renderBatch* của nó.
 */

/** "Phong cách " → "phong cach": so khớp không dấu, không hoa thường, gộp khoảng trắng. */
const sheetKey = (value) =>
  String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[_\-–—]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Tách CSV đúng chuẩn: ô trong ngoặc kép được chứa dấu phẩy, xuống dòng và "" (ngoặc kép thoát).
 * Tự nhận dấu phân cách: tab (dán từ Google Sheets / file .tsv), chấm phẩy (Excel bản tiếng Việt), hay phẩy.
 */
function parseSheet(text) {
  const body = text.replace(/^\uFEFF/, "");
  const firstLine = body.split(/\r?\n/, 1)[0];
  const count = (ch) => firstLine.split(ch).length - 1;
  const sep = count("\t") > 0 ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

/** Tên cột nhận được (đã bỏ dấu) → khoá. "text" là nội dung video; còn lại là khoá trong BT_CARD_KEYS. */
const SHEET_COLUMNS = {
  text: ["noi dung", "y tuong", "loi", "loi video", "loi doc", "kich ban", "chu de", "tieu de", "idea", "prompt", "text", "topic", "title", "content", "script"],
  mode: ["kieu loi", "cach viet", "viet loi", "nguon loi", "mode"],
  style: ["phong cach", "style"],
  aspect: ["khung", "khung hinh", "ti le", "ty le", "ti le khung", "aspect", "ratio"],
  voice: ["giong", "giong doc", "voice"],
  images: ["hinh", "hinh anh", "anh", "images", "image", "visual"],
  music: ["nhac", "nhac nen", "music"],
};

const columnFor = (header) => {
  const key = sheetKey(header);
  return Object.keys(SHEET_COLUMNS).find((col) => SHEET_COLUMNS[col].includes(key)) ?? null;
};

/** Chữ biểu thị "không có" trong các cột giọng, hình, nhạc. */
const NONE_WORDS = ["khong", "none", "no", "tat", "off", "khong co"];

/**
 * Khớp một ô vào giá trị cài đặt của ô video. Trả về { settings } (một phần của card.settings)
 * hoặc null nếu không hiểu. Ô trống không gọi tới hàm này.
 */
function sheetValue(col, raw) {
  const v = sheetKey(raw);
  if (col === "mode") {
    if (["ai", "ai viet", "tu dong", "auto"].includes(v)) return { mode: "ai" };
    if (["co san", "san", "loi co san", "text", "tu viet", "giu nguyen"].includes(v)) return { mode: "text" };
    return null;
  }
  if (col === "style") {
    if (["auto", "tu dong", "tu chon"].includes(v)) return { style: "auto" };
    const found = (state?.styles ?? []).find((s) => sheetKey(s.id) === v || sheetKey(s.label) === v);
    return found ? { style: found.id } : null;
  }
  if (col === "aspect") {
    const words = { doc: "9:16", "video doc": "9:16", ngang: "16:9", "video ngang": "16:9", vuong: "1:1" };
    const id = words[v] ?? v.replace(/\s*[x/×]\s*/, ":").replace(/\s+/g, "");
    return aspects.some((a) => a.id === id) ? { aspect: id } : null;
  }
  if (col === "voice") {
    if (NONE_WORDS.includes(v) || v === "khong giong") return { voice: "none" };
    const found = (state?.voices.catalog ?? []).find((x) => sheetKey(x.key) === v);
    return found ? { voice: found.key } : null;
  }
  if (col === "images") {
    if (NONE_WORDS.includes(v) || v === "khong hinh") return { images: "none", video: "" };
    if (["video ai", "clip ai", "video"].includes(v)) return { images: "library", video: "auto" };
    const model = videoModels().find((m) => sheetKey(m.key) === v || sheetKey(m.label) === v);
    if (model) return { images: "library", video: model.key };
    const key = Object.keys(IMAGE_SOURCES).find((k) => sheetKey(k) === v || sheetKey(IMAGE_SOURCES[k]) === v);
    return key ? { images: key, video: "" } : null;
  }
  if (col === "music") {
    if (NONE_WORDS.includes(v) || v === "khong nhac") return { music: "none" };
    if (["ngau nhien", "random", "nhac ngau nhien"].includes(v)) return { music: RANDOM_MUSIC };
    const track = (state?.audio.music ?? []).find((m) =>
      sheetKey(m.path) === v || sheetKey(m.name) === v || sheetKey(m.name.replace(/\.\w+$/, "")) === v);
    return track ? { music: track.path } : null;
  }
  return null;
}

/**
 * Bảng → các ô video. Dòng đầu là tiêu đề nếu nó có ít nhất một tên cột nhận ra được; không thì coi
 * cả bảng là dữ liệu và cột đầu là nội dung. Trả về { cards, settingCols, problems, skipped }.
 */
function sheetToCards(rows) {
  const headerCols = rows[0]?.map(columnFor) ?? [];
  const hasHeader = headerCols.some(Boolean);
  const cols = hasHeader ? headerCols : [];
  // Có tiêu đề mà không cột nào là nội dung: lấy cột đầu tiên không phải cột cài đặt.
  let textAt = cols.indexOf("text");
  if (textAt === -1) textAt = Math.max(0, cols.findIndex((c) => !c));
  const settingCols = cols.map((c, i) => (c && c !== "text" ? i : -1)).filter((i) => i !== -1);
  const problems = [];
  let skipped = 0;
  const cards = [];
  for (const [r, row] of rows.slice(hasHeader ? 1 : 0).entries()) {
    const text = row[textAt] ?? "";
    if (!text) { skipped++; continue; }
    const card = newBatchCard();
    card.text = text;
    for (const i of settingCols) {
      const raw = row[i];
      if (!raw) continue;
      const value = sheetValue(cols[i], raw);
      if (value) Object.assign(card.settings, value);
      // Số dòng như người dùng thấy trong Excel: tính cả dòng tiêu đề.
      else problems.push(`dòng ${r + (hasHeader ? 2 : 1)}, cột “${rows[0][i]}”: không hiểu “${raw}”`);
    }
    cards.push(card);
  }
  return { cards, settingCols, problems, skipped };
}

/**
 * Nạp file .csv/.tsv. Bảng có cột cài đặt → sang nguồn "Mỗi video một ô", thay các ô trống và thêm vào sau
 * các ô đã gõ. Chỉ có cột nội dung → nối vào danh sách ý tưởng như cách cũ.
 */
async function importBatchSheet(file) {
  const rows = parseSheet(await file.text());
  if (rows.length === 0) { setBatchHint(`${file.name} không có dòng nào.`, true); return; }
  const { cards, settingCols, problems, skipped } = sheetToCards(rows);
  if (cards.length === 0) { setBatchHint(`Không tìm thấy nội dung video nào trong ${file.name}.`, true); return; }

  if (settingCols.length === 0 && batchSource !== "custom") {
    // Ý tưởng viết sẵn nhiều dòng (lời có sẵn) thì ngăn cách bằng ---, đúng cú pháp của ô danh sách.
    const multi = cards.some((c) => c.text.includes("\n"));
    const current = $("batchText").value.trim();
    $("batchText").value = (current ? `${current}\n${multi ? "\n---\n\n" : ""}` : "") +
      cards.map((c) => c.text).join(multi ? "\n\n---\n\n" : "\n");
    renderBatchCount();
    renderBatchPlan();
    setBatchHint(`Đã nạp ${cards.length} dòng từ ${file.name}.`);
    return;
  }

  const kept = batchCards.filter((c) => c.text.trim());
  const room = Math.max(0, 50 - kept.length);
  batchCards = [...kept, ...cards.slice(0, room)];
  const switched = batchSource !== "custom";
  batchSource = "custom";
  renderBatchNew();

  const own = cards.filter((c) => Object.keys(c.settings).length).length;
  const notes = [
    `Đã nạp ${Math.min(cards.length, room)} video từ ${file.name}${own ? ` (${own} video có cài đặt riêng)` : ""}.`,
    switched ? "Bảng có cột cài đặt nên chuyển sang “Mỗi video một ô”." : "",
    cards.length > room ? `Một loạt tối đa 50 video — bỏ ${cards.length - room} dòng cuối.` : "",
    skipped ? `Bỏ ${skipped} dòng trống nội dung.` : "",
  ];
  if (problems.length) {
    const shown = problems.slice(0, 4).join("; ");
    notes.push(`Ô không hiểu nên để theo cài đặt chung — ${shown}${problems.length > 4 ? `; và ${problems.length - 4} ô khác` : ""}.`);
  }
  setBatchHint(notes.filter(Boolean).join(" "), problems.length > 0);
}

/** File mẫu: đủ các cột, hai dòng ví dụ dùng tên hiển thị để người dùng thấy gõ kiểu gì cũng được. */
function downloadBatchTemplate() {
  const styles = state?.styles ?? [];
  const voices = state?.voices.catalog ?? [];
  const rows = [
    ["Nội dung", "Kiểu lời", "Phong cách", "Khung", "Giọng", "Hình", "Nhạc"],
    ["3 mẹo pha cà phê muối ngon như ngoài quán", "AI viết", styles[0]?.label ?? "Tự động", "9:16", voices[0]?.key ?? "", "Ảnh miễn phí", "Nhạc ngẫu nhiên"],
    ["Vì sao Nokia sụp đổ?", "AI viết", styles.find((s) => s.id === "documentary")?.label ?? "Tự động", "16:9", "", "AI vẽ ảnh", ""],
    ["Câu đầu tiên của lời có sẵn.\nMỗi dòng một câu.", "Có sẵn", "Tự động", "1:1", "không", "không", "không"],
  ];
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  // BOM để Excel mở đúng tiếng Việt.
  const csv = `\uFEFF${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "mau-hang-loat.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
