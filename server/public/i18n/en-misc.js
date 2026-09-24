/* English UI — subs.js, bili.js, hook-media.js, post-copy.js, hook-tool.js, batch-sheet.js, activity.js, bulk-edit.js, link.js.
   Keys: exact Vietnamese text as rendered (see server/public/i18n.js). */
(() => {
  /** Chuỗi cố định → RegExp khớp nguyên văn (dùng để ghép mẫu có phần cố định dài). */
  const lit = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /** "1 video" / "3 videos". */
  const pl = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

  // ---------- activity.js: loại việc & bước ----------
  const KIND = {
    "Tạo video": "Create video",
    "Video nhiều cảnh": "Multi-scene video",
    "Xuất video": "Export video",
    "Phụ đề tự động": "Auto subtitles",
    "Đọc giọng": "Voiceover",
    "Việc": "Task",
  };

  // ---------- bulk-edit.js: mô tả hai cách sửa ----------
  const BE_REBUILD_VI =
    "Dựng lại từ kịch bản: đọc lại giọng, dựng lại hình. Chỉnh sửa tay trong trình chỉnh sửa không mang sang bản mới — bản cũ vẫn còn trong lịch sử của từng video.";
  const BE_REBUILD_EN =
    "Rebuild from the script: re-records the voice and re-renders the images. Manual edits made in the Editor don't carry over — the old version stays in each video's history.";

  // ---------- batch-sheet.js: câu báo sau khi nạp bảng tính (các câu nối bằng dấu cách thành một đoạn) ----------
  const sheetProblems = (text) =>
    text
      .replace(/dòng (\d+), cột “([^”]*)”: không hiểu “([^”]*)”/g, "row $1, column “$2”: couldn't read “$3”")
      .replace(/; và (\d+) ô khác$/, (m, k) => `; and ${k} more ${Number(k) === 1 ? "cell" : "cells"}`);
  const sheetLoaded = (all, n, file, own, rest) => {
    let out = `Loaded ${pl(n, "video")} from ${file}${own ? ` (${own} with their own settings)` : ""}.`;
    let tail = rest || "";
    tail = tail
      .replace(" Bảng có cột cài đặt nên chuyển sang “Mỗi video một ô”.",
        " The sheet has settings columns, so it switched to “One cell per video”.")
      .replace(/ Một loạt tối đa 50 video — bỏ (\d+) dòng cuối\./, (m, k) => ` A batch holds at most 50 videos — dropped the last ${pl(k, "row")}.`)
      .replace(/ Bỏ (\d+) dòng trống nội dung\./, (m, k) => ` Skipped ${pl(k, "row")} with no content.`)
      .replace(/ Ô không hiểu nên để theo cài đặt chung — (.+)\.$/,
        (m, list) => ` Unreadable cells use the general settings — ${sheetProblems(list)}.`);
    return out + tail;
  };

  I18N.add({
    // ===== subs.js — Thêm phụ đề =====
    "Giữ khung gốc": "Keep original frame",
    "9:16 dọc": "9:16 portrait",
    "16:9 ngang": "16:9 landscape",
    "Không tải được công cụ crop — kiểm tra server còn chạy không.":
      "Couldn't load the crop tool — check that the server is still running.",
    "Server đang chạy bản cũ, chưa có công cụ crop — khởi động lại server (Ctrl+C rồi npm start, hoặc mở lại app) rồi tải lại trang.":
      "The server is running an old version without the crop tool — restart it (Ctrl+C then npm start, or reopen the app) and reload the page.",
    "Thêm video để chỉnh vùng cắt trên video đầu tiên.": "Add videos to adjust the crop on the first one.",
    "Đã cắt: tỉ lệ": "Cropped: ratio",
    "tự do": "free",
    "theo khung": "match frame",
    "gốc": "original",
    "lấp đầy": "fill",
    "vừa khung": "fit",
    "lật ngang": "flipped horizontally",
    "lật dọc": "flipped vertically",
    "lật ngang, lật dọc": "flipped horizontally and vertically",
    "Chưa cắt — giữ nguyên khung của từng video.": "Not cropped — each video keeps its own frame.",
    "Chưa chỉnh vùng cắt — lấy phần giữa video cho vừa khung.": "Crop not adjusted — the center of the video is used to fill the frame.",
    "Ảnh đẹp": "Nice shot",
    "Kéo từng hàng chữ trên khung để đặt vị trí": "Drag each text row on the frame to position it",
    "Kéo chữ trên khung để đặt vị trí": "Drag the text on the frame to position it",
    "Đang chỉnh hàng": "Editing row",
    "Font, cỡ, màu, hiệu ứng của hàng này áp cho các hàng khác — vị trí mỗi hàng giữ nguyên":
      "Apply this row's font, size, colors and effect to the other rows — each row keeps its position",
    "Dùng kiểu hàng này cho mọi hàng": "Use this row's style for all rows",
    "Mẫu nhanh": "Quick presets",
    "Vị trí": "Position",
    "Trên": "Top",
    "Giữa": "Middle",
    "Dưới": "Bottom",
    "Vị trí dọc": "Vertical position",
    "Cỡ chữ": "Font size",
    "Bề rộng tối đa": "Max width",
    "Hiệu ứng chữ": "Text effect",
    "Độ đậm": "Weight",
    "Thường": "Regular",
    "Hơi đậm": "Semibold",
    "Đậm vừa": "Bold",
    "Đậm": "Extra bold",
    "Rất đậm": "Black",
    "Màu chữ · màu viền/nền": "Text color · outline/background color",
    "Màu chữ": "Text color",
    "màu viền/nền": "outline/background color",
    "Màu viền hoặc nền": "Outline or background color",
    "IN HOA": "UPPERCASE",
    "Tiếng gốc": "Original language",
    "Tiếng gốc (gốc)": "Original language",
    "Bỏ qua file không phải video/audio.": "Skipped files that aren't video/audio.",
    "Giữ nguyên (không dịch)": "Keep as spoken (no translation)",
    // Tên ngôn ngữ (server gửi) — hiện ở nút chọn ngôn ngữ và nhãn hàng phụ đề.
    "Tự nhận": "Auto-detect",
    "Tiếng Việt": "Vietnamese",
    "Tiếng Anh": "English",
    "Tiếng Trung": "Chinese",
    "Tiếng Trung (giản thể)": "Chinese (Simplified)",
    "Tiếng Nhật": "Japanese",
    "Tiếng Hàn": "Korean",
    "Tiếng Thái": "Thai",
    "Tiếng Indonesia": "Indonesian",
    "Tiếng Tây Ban Nha": "Spanish",
    "Tiếng Pháp": "French",
    "Tiếng Đức": "German",
    "Tiếng Việt (gốc)": "Vietnamese (original)",
    "Tiếng Anh (gốc)": "English (original)",
    "Tiếng Trung (gốc)": "Chinese (original)",
    "Tiếng Nhật (gốc)": "Japanese (original)",
    "Tiếng Hàn (gốc)": "Korean (original)",
    "Tiếng Thái (gốc)": "Thai (original)",
    "Tiếng Indonesia (gốc)": "Indonesian (original)",
    "Tiếng Tây Ban Nha (gốc)": "Spanish (original)",
    "Tiếng Pháp (gốc)": "French (original)",
    "Tiếng Đức (gốc)": "German (original)",
    "Chọn ít nhất một ngôn ngữ phụ đề.": "Pick at least one subtitle language.",
    "Dịch phụ đề cần model dịch — điền key Gemini, Groq hoặc OpenRouter (có gói miễn phí) trong":
      "Translating subtitles needs a translation model — add a Gemini, Groq or OpenRouter API key (free tiers available) in",
    "Cài đặt": "Settings",
    "Nghe lời một lần, rồi dịch sang từng ngôn ngữ đã chọn.": "Transcribes once, then translates into each selected language.",
    "Tự nhận đôi khi đoán nhầm với video ngắn — biết tiếng thì chọn luôn cho chắc.":
      "Auto-detect can guess wrong on short videos — if you know the language, pick it to be safe.",
    "Nghe nhanh": "Fast transcription",
    "Nghe chuẩn": "Accurate transcription",
    "dừng cho tôi đọc lại": "pause so I can review",
    "chạy thẳng tới video": "go straight to video",
    "áp dụng cho tất cả video": "applies to all videos",
    "Đợi tải file lên xong đã.": "Wait for the uploads to finish first.",
    "đang chạy": "running",
    "xong": "done",
    "tạm dừng": "paused",
    "chưa chạy": "not started",
    "Áp dụng cho tất cả": "Apply to all",
    "Đã đổi kiểu phụ đề — các video còn lại sẽ dựng theo kiểu mới.":
      "Subtitle style changed — the remaining videos will render with the new style.",

    // ===== bili.js — Tư liệu Bilibili =====
    "cảnh biển": "seascapes",
    "thiên nhiên": "nature",
    "thành phố về đêm": "city at night",
    "đồ ăn": "food",
    "động vật": "animals",
    "công nghệ": "technology",
    "người làm việc": "people working",
    "Phù hợp nhất": "Most relevant",
    "Nhiều lượt xem": "Most viewed",
    "Mới nhất": "Newest",
    "Nhiều lượt lưu": "Most saved",
    "Đang tìm…": "Searching…",
    "Tìm": "Search",
    "Tìm trang sau": "Search next page",
    "Đã tìm bằng": "Searched for",
    "Đang dịch chủ đề và tìm vài kiểu từ khoá tư liệu… (khoảng 5–10 giây)":
      "Translating the topic and trying a few footage keywords… (about 5–10 seconds)",
    "đang kiểm tra…": "checking…",
    "Chưa thấy video nào tác giả cho phép dùng cho chủ đề này. Thử chủ đề rộng hơn (ví dụ “cảnh biển” thay vì “cá heo”) hoặc tìm trang sau.":
      "No videos cleared for reuse by their creators on this topic yet. Try a broader topic (e.g. “seascapes” instead of “dolphins”) or search the next page.",
    "Chọn một video bên trái": "Pick a video on the left",
    "Xem trước, đọc lời cho phép của tác giả, chọn đoạn cần dùng rồi tải vào thư viện.":
      "Preview it, read the creator's permission note, choose the part you need, then save it to your library.",
    "Đang kiểm tra quyền sử dụng…": "Checking usage rights…",
    "Phần": "Part",
    "Mở trên Bilibili": "Open on Bilibili",
    "Đọc toàn bộ mô tả của tác giả": "Read the creator's full description",
    "Dùng đúng điều kiện tác giả nêu (ví dụ “不得用于售卖” = không được bán lại chính tư liệu).":
      "Follow the creator's conditions exactly (e.g. “不得用于售卖” = don't resell the footage itself).",
    "Dùng đúng điều kiện tác giả nêu (ví dụ “不得用于售卖” = không được bán lại chính tư liệu). Video có bật dấu “cấm đăng lại khi chưa được phép” mặc định của Bilibili — lời cho phép trên là sự cho phép của tác giả; dùng làm tư liệu trong video của bạn, không đăng lại nguyên bản.":
      "Follow the creator's conditions exactly (e.g. “不得用于售卖” = don't resell the footage itself). This video has Bilibili's default “no reposting without permission” flag — the note above is the creator's own permission; use it as footage in your video, don't repost the original.",
    "Từ": "From",
    "Đến": "To",
    "Chất lượng": "Quality",
    "Tôi đã đọc lời cho phép và sẽ dùng đúng điều kiện của tác giả, có ghi nguồn":
      "I've read the permission note and will follow the creator's conditions, with credit",
    "Tải vào thư viện": "Save to library",
    "Đang tải…": "Loading…",
    "Đang gửi yêu cầu…": "Sending request…",
    "Đã tải xong — clip ở danh sách bên dưới và trong 📁 Thư viện › Tài nguyên.":
      "Download complete — the clip is in the list below and in 📁 Library › Assets.",
    "Tải thất bại.": "Download failed.",
    "Giờ gõ dạng phút:giây, ví dụ 1:05.": "Enter times as minutes:seconds, e.g. 1:05.",
    "Điểm cuối phải sau điểm bắt đầu.": "The end must be after the start.",
    "Dựng video từ clip": "Make a video from this clip",
    "Chép ghi nguồn": "Copy credit",
    "Tải về máy": "Download",
    "Đã chép": "Copied",
    "Cập nhật": "Update",
    "Đang cập nhật…": "Updating…",
    "tải lỗi sau khi Bilibili đổi trang thì bấm Cập nhật": "if downloads fail after Bilibili changes its site, click Update",
    "Cập nhật yt-dlp thất bại.": "yt-dlp update failed.",

    // ===== hook-media.js — Hình mở đầu =====
    "Kho miễn phí": "Free stock",
    "Ảnh/clip của tôi": "My images/clips",
    "Đang dùng làm hình mở đầu": "Currently used as the opening visual",
    "Bỏ hình mở đầu": "Remove opening visual",
    "Chưa chọn — cảnh đầu lấy hình như các cảnh khác.": "None chosen — the first scene gets images like the other scenes.",
    "Ảnh": "Image",
    "Gõ từ khoá rồi bấm Tìm. Từ khoá tiếng Anh cho nhiều kết quả hơn.": "Type a keyword and click Search. English keywords give more results.",
    "Chưa có ảnh hay clip nào trong thư viện — bấm Tải lên.": "No images or clips in your library yet — click Upload.",
    "Không có kết quả — thử từ khoá tiếng Anh, ngắn hơn.": "No results — try a shorter English keyword.",
    "Đang tải về thư viện…": "Downloading to library…",

    // ===== post-copy.js — Gợi ý bài đăng =====
    "Đã có key": "API key added",
    "Tắt trong chế độ Miễn phí": "Off in Free mode",
    "Chưa có key — điền trong Cài đặt": "No API key — add one in Settings",
    "Đang viết…": "Writing…",
    "Viết lại": "Rewrite",
    "Viết gợi ý": "Write suggestions",
    "Video này chưa có lời hay phụ đề nào để AI đọc — thêm phụ đề trong Chỉnh sửa trước.":
      "This video has no script or subtitles for the AI to read — add subtitles in Edit first.",
    "AI đang đọc lời video và viết gợi ý…": "AI is reading the video's script and writing suggestions…",
    "Chép": "Copy",
    "Tiêu đề": "Title",
    "Mô tả": "Description",
    "Lời video đã đổi sau lần gợi ý này — bấm Viết lại để cập nhật.":
      "The video's script changed after these suggestions — click Rewrite to update.",
    "Không chép được — bôi đen chữ rồi Ctrl/⌘+C.": "Couldn't copy — select the text and press Ctrl/⌘+C.",

    // ===== hook-tool.js — Công cụ Hook =====
    "Tất cả": "All",
    "Chưa chọn công thức nào — bấm vào thẻ bên dưới hoặc Gợi ý ngẫu nhiên.":
      "No formulas picked — click a card below or Random picks.",
    "Viết hook": "Write hooks",
    "AI đang đọc lời video và viết câu mở đầu…": "AI is reading the video's script and writing opening lines…",
    "sửa trực tiếp nếu muốn, rồi bấm Dùng câu này": "edit them directly if you like, then click Use this line",
    "Dùng câu này": "Use this line",
    "Đã điền yêu cầu vào ô chat — bấm gửi để dựng lại video với câu mở đầu mới.":
      "The request is in the chat box — send it to re-render the video with the new opening line.",

    // ===== activity.js — ô Tiến trình =====
    ...KIND,
    "Viết kịch bản": "Write script",
    "Tìm hình": "Find images",
    "Tạo ảnh": "Create images",
    "Dựng video": "Render video",
    "Đang bắt đầu": "Starting",
    "Đang xử lý": "Processing",
    "Làm hàng loạt": "Batch",
    "Xem loạt": "View batch",
    "Xem": "View",
    "Mở chỉnh sửa": "Open in Editor",
    "Mở để tải": "Open to download",
    "Xem lỗi": "View error",
    "Tiến trình": "Progress",
    "Bật thông báo máy": "Turn on desktop notifications",
    "Báo khi video xong kể cả lúc đang ở tab hoặc ứng dụng khác": "Notify me when a video is done, even while I'm in another tab or app",
    "Đóng": "Close",
    "Không có việc nào đang chạy.": "Nothing is running.",

    // ===== bulk-edit.js — Sửa hàng loạt =====
    "Nhanh, không gọi AI. Giữ nguyên lời, giọng đã đọc và mọi chỉnh sửa trong trình chỉnh sửa — chỉ render lại với nhạc, màu mới.":
      "Fast, no AI calls. Keeps the script, the recorded voice and every edit made in the Editor — just re-renders with the new music and color.",
    [BE_REBUILD_VI]: BE_REBUILD_EN,
    "Giữ như từng video": "Keep each video's setting",
    "Tự động — AI chọn theo nội dung": "Auto — AI picks based on content",
    "Ngẫu nhiên — mỗi video một phong cách": "Random — a different style per video",
    "Không giọng": "No voice",
    "Không nhạc": "No music",
    "🎲 Nhạc ngẫu nhiên (mỗi video một bản)": "🎲 Random music (a different track per video)",
    "Chữ cũ": "Old text",
    "Chữ cần thay": "Text to replace",
    "Chữ mới (để trống = xoá)": "New text (leave empty to delete)",
    "Thay bằng": "Replace with",
    "Bỏ cặp này": "Remove this pair",
    "Chưa đổi gì — chọn ít nhất một thay đổi.": "Nothing changed — pick at least one change.",
    "Không video nào đã chọn có kịch bản để dựng lại — dùng cách “Giữ chỉnh sửa”.":
      "None of the selected videos has a script to rebuild from — use “Keep edits” instead.",

    // ===== link.js — Lấy video từ link =====
    "Tải xong, video tự vào danh sách thêm phụ đề.": "Once downloaded, the video is added to the subtitle list automatically.",
    "Đang đọc thông tin video…": "Reading video info…",
    "Video dài quá 2 giờ — chọn một đoạn ở ô Từ/Đến.": "The video is longer than 2 hours — choose a section in From/To.",
    "Đánh dấu ô xác nhận quyền dùng video trước đã.": "Tick the box confirming you have the right to use this video first.",
    "Ô Từ/Đến ghi phút:giây, ví dụ 1:30.": "Enter From/To as minutes:seconds, e.g. 1:30.",
    "Mốc Đến phải sau mốc Từ.": "To must be after From.",
    "Mất kết nối tới app trong lúc tải — thử lại.": "Lost connection to the app during the download — retry.",
    "Đã tải xong — video cũng có trong 📁 Thư viện › Tài nguyên.": "Download complete — the video is also in 📁 Library › Assets.",
  });

  I18N.patterns([
    // ===== subs.js =====
    [/^Không đóng gói được công cụ crop: (.+)$/, "Couldn't bundle the crop tool: $1"],
    [/^xoay (-?\d+)°$/, "rotated $1°"],
    [/^Video khác kích thước \((.+)\) giữ cùng vị trí và độ lớn tương đối\.$/,
      "Videos of other sizes ($1) keep the same relative position and size."],
    [/^Không tải lên được: (.+)$/, "Upload failed: $1"],
    [/^Không tải lên được (.+?): (.+)$/, "Couldn't upload $1: $2"],
    [/^Đang tải lên (\d+) file…$/, "Uploading $1 file(s)…"],
    [/^Đang tải lên (.+)…$/, "Uploading $1…"],
    [/^Bỏ (.+\.(?:mp4|mov|webm|mp3|wav|m4a|aac|ogg))$/i, "Remove $1"],
    [/^(\d+) video · mỗi video (\d+) hàng phụ đề \(tối đa 50\)$/, (a, n, k) => `${pl(n, "video")} · ${pl(k, "subtitle row")} each (max 50)`],
    [/^(\d+) video · mỗi video (\d+) hàng phụ đề$/, (a, n, k) => `${pl(n, "video")} · ${pl(k, "subtitle row")} each`],
    [/^(\d+) video × (\d+) ngôn ngữ = (\d+) video \(tối đa 50\)$/, "$1 videos × $2 languages = $3 videos (max 50)"],
    [/^(\d+) video × (\d+) ngôn ngữ = (\d+) video$/, "$1 videos × $2 languages = $3 videos"],
    [/^(\d+) hàng, kéo từng hàng để đặt vị trí$/, "$1 rows, drag each row to position it"],
    [/^(\d+)\/(\d+) xong · (\d+) lỗi$/, (a, d, n, e) => `${d}/${n} done · ${pl(e, "error")}`],
    [/^(\d+)\/(\d+) xong$/, "$1/$2 done"],
    [/^(\d+) lỗi$/, (a, n) => pl(n, "error")],
    [/^Áp dụng & dựng lại (\d+) video$/, (a, n) => `Apply & re-render ${pl(n, "video")}`],
    [/^Đã đổi kiểu phụ đề — đang dựng lại (\d+) video\.$/, (a, n) => `Subtitle style changed — re-rendering ${pl(n, "video")}.`],

    // ===== bili.js =====
    [/^(\d+) video tác giả cho phép dùng \(xem (\d+)(\)?)$/, "$1 videos cleared for reuse by the creator (of $2 checked$3"],
    [/^loại thêm (\d+) sau khi kiểm tra kỹ$/, "removed $1 more after a closer check"],
    [/^trang (\d+)\/(\d+)$/, "page $1/$2"],
    [/^Không có clip đúng “(.+)” được phép dùng — đang hiện tư liệu gần chủ đề$/,
      "No reusable clips for “$1” — showing footage on related topics"],
    [/^(\d+)\.(\d) vạn lượt xem$/, "$1$2K views"],
    [/^(\d+) vạn lượt xem$/, (all, n) => `${n}0K views`],
    [/^(\d+) lượt xem$/, "$1 views"],
    [/^Không dùng được video này: (.+)$/, "Can't use this video: $1"],
    [/^Phần này chỉ dài ([\d:]+)\.$/, "This part is only $1 long."],
    [/^Để trống là tải cả phần ([\d:]+) — chỉ lấy đoạn cần dùng cho nhẹ\.$/,
      "Leave empty to download the whole $1 part — grab only the section you need to keep it light."],
    [/^Bộ tải: yt-dlp chưa có( ·)?$/, "Downloader: yt-dlp not installed$1"],
    [/^Bộ tải: yt-dlp (\S+)( ·)?$/, "Downloader: yt-dlp $1$2"],

    // ===== hook-media.js =====
    [/^Hình mở đầu: (.+)$/, "Opening visual: $1"],
    [/^Bỏ qua (.+) — chỉ nhận ảnh hoặc video\.$/, "Skipped $1 — only images or videos are accepted."],

    // ===== post-copy.js =====
    [/^Viết bởi (.+)$/, "Written by $1"],
    [/^Chép tất cả cho (.+)$/, "Copy all for $1"],

    // ===== hook-tool.js =====
    [/^Không có công thức nào khớp “(.*)”\.$/, "No formulas match “$1”."],
    [/^(\d+) công thức$/, (a, n) => pl(n, "formula")],
    [/^(\d+) câu mở đầu · sửa trực tiếp nếu muốn, rồi bấm Dùng câu này$/,
      "$1 opening lines · edit them directly if you like, then click Use this line"],
    [/^(\d+) câu mở đầu$/, (a, n) => pl(n, "opening line")],
    [/^(\d+) từ$/, (a, n) => pl(n, "word")],
    [/^Câu hook (\d+)$/, "Hook line $1"],
    [/^AI viết được (\d+) câu \(bỏ câu trùng nhau hoặc trùng câu gốc\)\.$/,
      "AI wrote $1 lines (dropped duplicates and lines matching the original)."],

    // ===== batch-sheet.js =====
    [/^(.+) không có dòng nào\.$/, "$1 has no rows."],
    [/^Không tìm thấy nội dung video nào trong (.+)\.$/, "No video content found in $1."],
    [/^Đã nạp (\d+) dòng từ (.+)\.$/, (a, n, f) => `Loaded ${pl(n, "line")} from ${f}.`],
    [/^Đã nạp (\d+) video từ (.+?)(?: \((\d+) video có cài đặt riêng\))?\.((?: .+)?)$/, sheetLoaded],

    // ===== activity.js =====
    ...Object.entries(KIND).flatMap(([vi, en]) => [
      [new RegExp(`^${lit(vi)} xong lúc (\\d{1,2}:\\d{2})$`), `${en} finished at $1`],
      [new RegExp(`^${lit(vi)} xong$`), `${en} done`],
      [new RegExp(`^${lit(vi)} bị lỗi$`), `${en} failed`],
    ]),
    [/^(\d+) giây$/, "$1s"],
    [/^(\d+) phút (\d+) giây$/, "$1m $2s"],
    [/^Loạt: (.+)$/, "Batch: $1"],
    [/^(\d+)\/(\d+) video xong$/, (a, d, n) => `${d}/${pl(n, "video")} done`],
    [/^(\d+) việc đang chạy$/, "$1 running"],
    [/^Lỗi: (.+)$/, "Error: $1"],

    // ===== bulk-edit.js =====
    [new RegExp(`^${lit(BE_REBUILD_VI)} (\\d+)/(\\d+) video không có kịch bản \\(dựng từ file thu sẵn hoặc nhiều cảnh\\) sẽ được bỏ ra\\.$`),
      `${BE_REBUILD_EN} $1/$2 videos without a script (made from a recording or multi-scene) will be skipped.`],
    [/^Sửa (\d+) video$/, (a, n) => `Edit ${pl(n, "video")}`],
  ]);
})();
