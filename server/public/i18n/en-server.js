/* English UI — text the SERVER sends to the main UI: Settings fields (server/keys.ts), style / art-style / aspect /
 * voice / hook / script-provider / video-model / translate-language catalogs from /api/state, and the chat replies,
 * progress lines and common errors produced while a video is made (server/chat.ts and the scripts it calls).
 * Keys: exact Vietnamese text as rendered (see server/public/i18n.js). Wrapped in an IIFE so helper names do not
 * collide with the other dictionary scripts (classic scripts share one global scope). */
(() => {
  /** Translate a nested fragment with the same dictionary (runs at display time, after every file has loaded). */
  const tr = (s) => (window.I18N && typeof window.I18N.t === "function" ? window.I18N.t(s) : s);
  const what = (w) => (w === "ảnh" ? "image" : w);
  const kw = (s) => s.replace(/khớp (\d+)\/(\d+) từ khoá/g, "matched $1/$2 keywords");
  const credit = (s) => s.replace(/^Ảnh: /, "Photo: ").replace(/^Nhạc: /, "Music: ").replace(/^Âm thanh: /, "Sound: ");
  /** "Groq (đã thử a, b)", "Gemini vẽ ảnh", "Ollama (trên máy)" → English. */
  const prov = (s) => s
    .replace(/^Ollama \(trên máy\)$/, "Ollama (local)")
    .replace(/^AI có sẵn trong app/, "Built-in AI")
    .replace(/ vẽ ảnh\b/, " image generation")
    .replace(/\(đã thử /, "(tried ");
  const lenTr = (s) => s
    .replace(/^bằng phần trước \((\d+) câu\)$/, "same as the previous part ($1 lines)")
    .replace(/ \(ô chọn\)$/, " (picked)")
    .replace(/ \(theo prompt\)$/, " (from the prompt)")
    .replace(/^không giới hạn/, "unlimited")
    .replace(/^ngắn 15–30 giây/, "short, 15–30 seconds")
    .replace(/(\d+) phút/g, "$1 min")
    .replace(/(\d+) giây/g, "$1 sec");
  /** Imagen source names used in the image notes. */
  const SOURCES = { "kho ảnh miễn phí": "the free photo library", "kho clip miễn phí": "the free clip library", "AI vẽ": "AI drawing" };
  const source = (s) => SOURCES[s] ?? s;
  /** Suggested alternatives appended by scripts/provider-error.ts. */
  const ALTERNATIVES = {
    "hoặc thêm key nhà cung cấp khác trong ⚙ Cài đặt": "or add another provider's key in ⚙ Settings",
    "hoặc chọn giọng miễn phí có sẵn trong máy": "or pick a free built-in voice",
    "hoặc chọn giọng miễn phí có sẵn trong app": "or pick a free built-in voice",
    "hoặc chọn model video khác": "or pick another video model",
    "hoặc chọn nguồn hình khác (Pexels, thư viện)": "or pick another image source (Pexels, Library)",
    "hoặc chọn nguồn hình khác (ảnh/clip miễn phí, thư viện)": "or pick another image source (free photos/clips, Library)",
    "hoặc chọn nguồn hình khác": "or pick another image source",
    "hoặc chọn nguồn khác": "or pick another source",
    "hoặc dùng Pexels trong lúc chờ": "or use Pexels in the meantime",
    "hoặc chọn model dịch khác": "or pick another translation model",
  };
  const alt = (s) => ALTERNATIVES[s] ?? s;
  const detail = (s) => s.replace(/^\(chi tiết: lỗi — /, "(details: error — ").replace(/^\(chi tiết: /, "(details: ");

  // ---------------------------------------------------------------- styles (src/styles/meta.ts)
  // [label, summary, bestFor] — label shows as "emoji label", summary as menu sub-text, bestFor as tooltip.
  const STYLES = [
    ["Phụ đề nổi bật", "Bold captions",
      "Ảnh nền, phụ đề to từng câu kiểu TikTok.", "Background image with big line-by-line captions, TikTok style.",
      "mẹo nhanh, lời khuyên, nội dung đọc thẳng vào camera, video bán hàng ngắn", "quick tips, advice, talking-to-camera content, short sales videos"],
    ["Cắt dán tài liệu", "Document collage",
      "Ảnh cắt dán trên giấy kẻ ô, nhãn highlight vàng, kiểu Vox.", "Cut-out images on grid paper with yellow highlighter labels, Vox style.",
      "giải thích sự kiện, lịch sử, kinh tế, vì sao X xảy ra, câu chuyện có nhân vật/đồ vật cụ thể", "explaining events, history, economics, why X happened, stories about specific people/objects"],
    ["Chữ động", "Kinetic text",
      "Chữ lớn bật theo nhịp đọc, nền màu mạnh, không cần ảnh.", "Big text popping to the rhythm of the voice on bold colors, no images needed.",
      "câu nói truyền cảm hứng, tuyên ngôn, hook mạnh, quảng cáo ngắn, nội dung ít hình ảnh", "inspirational quotes, manifestos, strong hooks, short ads, content with few visuals"],
    ["Phim tài liệu", "Documentary",
      "Ảnh toàn khung chuyển động chậm, hạt phim, chú thích địa điểm.", "Slow-moving full-frame images, film grain, location captions.",
      "kể chuyện nghiêm túc, du lịch, địa danh, con người, điều tra, hồi ký", "serious storytelling, travel, landmarks, people, investigations, memoirs"],
    ["Bảng trắng", "Whiteboard",
      "Giấy sổ tay, chữ bút dạ, gạch chân và khoanh tròn vẽ tay.", "Notebook paper, marker lettering, hand-drawn underlines and circles.",
      "dạy học, hướng dẫn từng bước, giải thích khái niệm, công thức, học tập", "teaching, step-by-step guides, explaining concepts, formulas, studying"],
    ["Công nghệ tối giản", "Minimal tech",
      "Nền tối, thẻ kính mờ, con số chạy, ánh sáng neon.", "Dark background, frosted glass cards, counting numbers, neon glow.",
      "công nghệ, sản phẩm số, số liệu, so sánh, AI, tài chính, startup", "technology, digital products, data, comparisons, AI, finance, startups"],
    ["Video gốc", "Source video",
      "Giữ nguyên ảnh/video, cắt cảnh gọn, không hiệu ứng — để sửa clip có sẵn.", "Keeps your images/videos as they are, clean cuts, no effects — for editing existing clips.",
      "video quay sẵn người dùng tải lên, vlog, ghép clip, khi hình đã đẹp và không cần đồ hoạ", "footage you upload, vlogs, clip compilations — when the visuals already look good and need no graphics"],
    ["Phụ đề từng từ", "Word-by-word captions",
      "Chữ in hoa rất đậm viền đen, bật từng cụm 2–4 từ, từ đang đọc tô vàng — kiểu Hormozi.", "Heavy all-caps text with a black outline, popping in 2–4 word chunks, the spoken word in yellow — Hormozi style.",
      "nói thẳng vào camera, bài học kinh doanh, động lực, lời khuyên gắt, bán hàng, podcast cắt ngắn", "talking to camera, business lessons, motivation, blunt advice, sales, podcast clips"],
    ["Tin nhắn", "Text messages",
      "Kể chuyện bằng giao diện nhắn tin: bong bóng hai phía, đang gõ…, mốc thời gian.", "Storytelling in a messaging app: two-sided bubbles, typing…, timestamps.",
      "kể chuyện, drama, tình huống dở khóc dở cười, hội thoại, chuyện tình cảm, tin nhắn lừa đảo", "stories, drama, tragicomic situations, conversations, relationships, scam messages"],
    ["Bản tin nóng", "Breaking news",
      "Nhãn TRỰC TIẾP, dải tiêu đề dưới màn hình, chữ chạy ở đáy — kiểu bản tin truyền hình.", "LIVE badge, lower-third headline bar, bottom ticker — TV news style.",
      "tin tức, cập nhật, sự kiện vừa xảy ra, thông báo chính thức, tóm tắt tin trong ngày", "news, updates, breaking events, official announcements, daily news recaps"],
    ["Băng VHS", "VHS tape",
      "Hình như băng video cũ: nhoè màu, vạch quét, nhiễu, chữ PLAY/REC và ngày giờ máy quay.", "Looks like an old videotape: color bleed, scanlines, noise, PLAY/REC and a camcorder date stamp.",
      "hoài niệm, chuyện ngày xưa, ký ức tuổi thơ, meme, kể chuyện bí ẩn, thập niên 80–2000", "nostalgia, the old days, childhood memories, memes, mystery stories, the 80s–2000s"],
    ["Điện ảnh", "Cinematic",
      "Viền đen điện ảnh, chỉnh màu phim, phụ đề chữ có chân, câu nhấn hiện như tiêu đề trailer.", "Cinema black bars, film color grade, serif captions, punchlines shown like trailer titles.",
      "kể chuyện cảm xúc, trailer, du lịch, thương hiệu, chân dung con người, câu chuyện giàu không khí", "emotional storytelling, trailers, travel, brands, portraits, atmospheric stories"],
    ["Truyện tranh", "Comic book",
      "Ảnh trong khung truyện viền đậm, chấm halftone, hộp lời dẫn vàng, câu nhấn nổ kiểu BÙM!", "Images in bold-outlined comic panels, halftone dots, yellow caption boxes, punchlines that burst like BOOM!",
      "chuyện hài, tình huống đời thường phóng đại, siêu anh hùng, trẻ em, meme, kể chuyện vui có nhân vật", "comedy, exaggerated everyday situations, superheroes, kids, memes, fun character stories"],
    ["Bài đăng MXH", "Social post",
      "Thẻ bài đăng kiểu Reddit/X trên nền mờ, chữ hiện dần theo giọng đọc, lượt thích nhảy số.", "A Reddit/X-style post card on a blurred background, text revealed with the voice, likes ticking up.",
      "Reddit story, tâm sự ẩn danh, drama công sở, câu hỏi gây tranh luận, thú nhận, chuyện kể ngôi thứ nhất", "Reddit stories, anonymous confessions, office drama, debate questions, confessions, first-person stories"],
    ["Câu đố", "Quiz",
      "Mỗi cảnh một câu hỏi, đồng hồ đếm ngược, lật đáp án xanh — kéo người xem bình luận.", "One question per scene, a countdown timer, a green answer flip — gets viewers commenting.",
      "đố vui, kiểm tra kiến thức, bạn có biết, thử thách, trắc nghiệm, học từ vựng, kêu gọi bình luận", "trivia, knowledge checks, did-you-know, challenges, multiple choice, vocabulary, calls to comment"],
    ["Top xếp hạng", "Top ranking",
      "Đếm ngược #5 → #1, số hạng khổng lồ, bảng xếp hạng lấp dần theo từng cảnh.", "Countdown #5 → #1, giant rank numbers, a leaderboard that fills up scene by scene.",
      "top list, xếp hạng, so sánh nhiều thứ, món ăn, địa điểm, sản phẩm, kỷ lục, đếm ngược", "top lists, rankings, comparing many things, food, places, products, records, countdowns"],
    ["Mở sách", "Open book",
      "Cuốn sách bìa da mở ra trên bàn gỗ, mỗi cảnh một trang in có tranh minh hoạ, lật trang 3D.", "A leather-bound book opens on a wooden desk, each scene an illustrated printed page, 3D page turns.",
      "tóm tắt sách, bài học từ một cuốn sách, lịch sử, truyền thuyết, danh nhân, kể chuyện có chương hồi, trích dẫn hay", "book summaries, lessons from a book, history, legends, famous people, stories with chapters, great quotes"],
    ["Sách truyện", "Storybook",
      "Sách tranh thiếu nhi: tranh minh hoạ khung bo tròn, chữ to, từ đang đọc sáng lên, lật trang cuộn góc.", "A children's picture book: rounded illustration frames, big text, the spoken word lights up, curling page turns.",
      "truyện cổ tích, truyện thiếu nhi, kể chuyện trước giờ ngủ, bài học đạo đức cho bé, ngụ ngôn, chuyện con vật", "fairy tales, children's stories, bedtime stories, moral lessons for kids, fables, animal stories"],
    ["Thư tay", "Handwritten letter",
      "Tờ thư trên bàn gỗ, bút máy viết từng chữ bằng mực, câu nhấn đổi màu mực và gạch chân lượn sóng.", "A letter on a wooden desk, a fountain pen writing word by word in ink, punchlines in another ink color with a wavy underline.",
      "lá thư gửi ai đó, tâm sự, nhật ký, lời cảm ơn, kỷ niệm, lời khuyên chân thành, kể chuyện ngôi thứ nhất", "letters to someone, heartfelt thoughts, diaries, thank-you notes, memories, sincere advice, first-person stories"],
    ["Đêm neon", "Neon night",
      "Phố đêm tím xanh, chữ ống neon bật chập chờn, câu nhấn thành biển hiệu phát sáng.", "A purple-blue night street, flickering neon-tube text, punchlines as glowing signs.",
      "đời sống về đêm, âm nhạc, gaming, thành phố, động lực đêm khuya, K-pop, tiệc tùng", "nightlife, music, gaming, cities, late-night motivation, K-pop, parties"],
    ["Album kỷ niệm", "Scrapbook",
      "Bảng bần treo tường, mỗi cảnh một tấm polaroid dán băng keo washi, lời viết tay trên thẻ ghi chú, giấy note vàng cho câu nhấn.", "A corkboard on the wall, each scene a polaroid stuck on with washi tape, handwritten note cards, yellow sticky notes for punchlines.",
      "du lịch, kỷ niệm, gia đình, bạn bè, kỷ niệm yêu nhau, tổng kết năm, \"một năm nhìn lại\"", "travel, memories, family, friends, couple memories, year-end recaps, \"a year in review\""],
    ["Tạp chí", "Magazine",
      "Mỗi cảnh là một trang bìa tạp chí thời trang: ảnh tràn trang, tên tạp chí chữ có chân cực đậm, tít bìa khối màu, tem MỚI!, mã vạch.", "Each scene is a fashion magazine cover: full-bleed photo, an ultra-bold serif masthead, color-block cover lines, a NEW! stamp, a barcode.",
      "thời trang, làm đẹp, người nổi tiếng, phong cách sống, xu hướng mùa mới, giới thiệu sản phẩm, bí quyết phối đồ/chăm da", "fashion, beauty, celebrities, lifestyle, new-season trends, product showcases, styling/skincare tips"],
    ["Dòng thời gian", "Timeline",
      "Trục thời gian cuộn qua từng mốc, năm ghi thật lớn, ảnh trong thẻ gắn vào mốc.", "A timeline scrolling through each milestone, huge year numbers, image cards pinned to milestones.",
      "lịch sử, tiểu sử, lịch sử công ty/thương hiệu, sự tiến hoá của một thứ, \"từ năm … đến nay\", trình tự các giai đoạn", "history, biographies, company/brand history, how something evolved, \"from … to today\", sequences of stages"],
    ["Công thức nấu ăn", "Recipe",
      "Thẻ công thức trên bàn bếp: mỗi cảnh một bước có số to, ảnh món bo góc, chấm tiến độ tích dần và giấy nhớ mẹo.", "A recipe card on the kitchen counter: one step per scene with a big number, a rounded dish photo, progress dots and tip notes.",
      "nấu ăn, công thức món, pha chế đồ uống, làm bánh, DIY, đồ thủ công, hướng dẫn từng bước, chu trình skincare", "cooking, recipes, drinks, baking, DIY, crafts, step-by-step guides, skincare routines"],
    ["Màn hình code", "Code screen",
      "Cửa sổ terminal gõ từng câu sau dấu nhắc $, ảnh bật ra trong cửa sổ preview, số liệu thành thanh tiến độ ASCII.", "A terminal window typing each line after the $ prompt, images popping up in a preview window, numbers as ASCII progress bars.",
      "lập trình, mẹo công nghệ, AI, an ninh mạng, sự thật về hacker, hướng dẫn phần mềm", "programming, tech tips, AI, cybersecurity, hacker facts, software tutorials"],
    ["Game 8-bit", "8-bit game",
      "Màn hình game RPG cổ điển: ảnh điểm ảnh hoá trong cửa sổ game, hộp thoại gõ chữ, thanh XP, xu và popup CRITICAL!.", "A classic RPG game screen: pixelated images in a game window, a typing dialog box, XP bar, coins and CRITICAL! popups.",
      "gaming, thử thách, học mà chơi, sự thật thú vị, \"level up\" bản thân, thói quen tốt, nội dung cho trẻ em", "gaming, challenges, learning through play, fun facts, self \"level up\", good habits, kids' content"],
    ["So sánh đối đầu", "Versus",
      "Chia đôi màn hình hai phe, huy hiệu VS ở giữa, bảng điểm và con dấu phán quyết.", "A split screen with two sides, a VS badge in the middle, a scoreboard and a verdict stamp.",
      "so sánh hai lựa chọn, cái này vs cái kia, lầm tưởng vs sự thật, trước/sau, rẻ vs đắt, \"nên chọn cái nào\"", "comparing two options, this vs that, myth vs fact, before/after, cheap vs expensive, \"which one to pick\""],
    ["Tối giản sang trọng", "Minimal luxury",
      "Trang giấy ngà: ảnh đặt như bản in phòng tranh, chữ có chân hiện từng dòng giữa hai gạch vàng mảnh, hoà tan chậm rãi.", "Ivory paper: images placed like gallery prints, serif text appearing line by line between two thin gold rules, slow dissolves.",
      "trích dẫn, bất động sản, spa và wellness, trang sức, thời trang, câu chuyện thương hiệu, cưới hỏi, giới thiệu sản phẩm cao cấp, nội dung chậm và suy ngẫm", "quotes, real estate, spa and wellness, jewelry, fashion, brand stories, weddings, premium products, slow reflective content"],
    ["Truyện ma", "Ghost story",
      "Không khí nửa đêm rợn người: ảnh ám lục lạnh, sương trôi, đèn chập chờn, phụ đề chữ có chân run nhẹ và cú hù chữ đỏ máu.", "A creepy midnight mood: cold green-tinted images, drifting fog, flickering lights, trembling serif captions and blood-red jump scares.",
      "truyện ma, chuyện rùng rợn, bí ẩn chưa lời giải, truyền thuyết đô thị, chuyện lạ có thật, kể chuyện hồi hộp", "ghost stories, creepy tales, unsolved mysteries, urban legends, strange true stories, suspenseful storytelling"],
    ["Anime", "Anime",
      "Năng lượng opening anime: ảnh tươi có loé sáng, chém chéo đổi cảnh, phụ đề trắng viền màu bật nảy, câu nhấn thành khung impact có tia tốc độ và rung.", "Anime-opening energy: vivid images with light flares, diagonal slash transitions, bouncy white captions with colored outlines, punchlines as impact frames with speed lines and shake.",
      "kể chuyện kịch tính, giới thiệu nhân vật, fan anime/game, giới trẻ, câu chuyện \"hành trình trưởng thành\" truyền động lực", "dramatic storytelling, character intros, anime/game fans, young audiences, motivational \"coming-of-age\" stories"],
    ["Podcast", "Podcast",
      "Clip podcast trong phòng thu tối ấm: thẻ tập có ảnh khách mời, sóng âm nhảy theo lời đọc, thanh tiến độ và thẻ trích dẫn sáng dần từng từ.", "A podcast clip in a warm, dark studio: an episode card with the guest's photo, a waveform moving with the voice, a progress bar and a quote card lighting up word by word.",
      "clip podcast, phỏng vấn, talkshow, câu nói đáng nhớ, bình luận, chia sẻ quan điểm, nội dung giọng nói là chính", "podcast clips, interviews, talk shows, memorable quotes, commentary, opinions, voice-first content"],
    ["Bản đồ hành trình", "Journey map",
      "Bản đồ minh hoạ vẽ tay: máy bay kéo đường gạch nối từng điểm dừng, ghim cắm xuống có nhãn địa danh, ảnh thành bưu thiếp có tem, con số quãng đường gắn vào chặng.", "A hand-drawn illustrated map: a plane drawing a dashed route between stops, pins dropping with place labels, images as stamped postcards, distances pinned to each leg.",
      "lịch trình du lịch, phượt, road trip, food tour theo vùng, sự thật địa lý, hành trình lịch sử, đi từ A đến B", "travel itineraries, backpacking, road trips, regional food tours, geography facts, historical journeys, getting from A to B"],
    ["Thể thao", "Sports",
      "Giao diện truyền hình thể thao: bảng tỉ số LIVE, dải phụ đề chéo, bảng tên cầu thủ, thống kê trận và cú nổ \"GOAL!\" khi tới pha đỉnh.", "A sports broadcast look: LIVE scoreboard, diagonal caption bar, player name plates, match stats and a \"GOAL!\" burst at the peak moment.",
      "tin bóng đá, highlight trận đấu, thử thách thể hình, chuyện vận động viên, kỷ lục và thành tích, dự đoán tỉ số", "football news, match highlights, fitness challenges, athlete stories, records and achievements, score predictions"],
    ["Biểu đồ tài chính", "Finance chart",
      "Màn hình giao dịch nền tối: biểu đồ giá tự vẽ suốt video, ảnh trong thẻ tin, con số trong phụ đề tự tô xanh/đỏ, câu nhấn thành cú vọt giá có bong bóng chú thích.", "A dark trading screen: a price chart drawing itself through the video, images in news cards, numbers in captions auto-colored green/red, punchlines as price spikes with callout bubbles.",
      "chứng khoán, crypto, tài chính cá nhân, tin kinh tế – doanh nghiệp, báo cáo lợi nhuận, số liệu tăng giảm", "stocks, crypto, personal finance, business and economic news, earnings reports, rising and falling figures"],
    ["Tranh màu nước", "Watercolor",
      "Mỗi cảnh là một bức tranh màu nước loang trên giấy vẽ, phụ đề viết tay hiện từng từ như mực thấm.", "Each scene is a watercolor painting bleeding across paper, handwritten captions appearing word by word like soaking ink.",
      "thơ, trích dẫn, lời hay ý đẹp, suy ngẫm cảm xúc, kỷ niệm du lịch, nghệ thuật – văn hoá, kể chuyện nhẹ nhàng", "poetry, quotes, beautiful sayings, emotional reflections, travel memories, art and culture, gentle storytelling"],
    ["Story điện thoại", "Phone story",
      "Mỗi cảnh là một khung story trên điện thoại: thanh tiến độ chia đoạn, avatar vòng gradient, phụ đề là nhãn chữ trên khối màu, câu hỏi thành nhãn bình chọn Có/Không.", "Each scene is a phone story frame: a segmented progress bar, a gradient-ring avatar, captions as text stickers on color blocks, questions as Yes/No poll stickers.",
      "hậu trường, một ngày của tôi, cập nhật cá nhân, khoe sản phẩm kiểu đời thường, hỏi ý kiến/bình chọn, phong cách sống", "behind the scenes, a day in my life, personal updates, casual product showcases, asking opinions/polls, lifestyle"],
    ["Bản vẽ kỹ thuật", "Blueprint",
      "Tờ giấy can xanh có khung tên, ảnh thành ảnh tham chiếu có đường kích thước tự vẽ, lời đọc là ghi chú đánh số gõ từng dòng, câu nhấn được khoanh đám mây sửa đổi màu cam.", "Blue tracing paper with a title block, images as reference photos with self-drawing dimension lines, narration as numbered notes typed line by line, punchlines circled with orange revision clouds.",
      "giải thích cách mọi thứ hoạt động, kỹ thuật, kiến trúc, phát minh, DIY/xây dựng, khoa học, giải phẫu sản phẩm", "explaining how things work, engineering, architecture, inventions, DIY/construction, science, product teardowns"],
    ["Lễ hội Tết", "Lunar New Year",
      "Nền đỏ son viền vàng, lồng đèn đung đưa, hoa mai đào rơi, phụ đề trên dải lụa đỏ, câu nhấn bắn pháo hoa và mưa lì xì.", "A vermilion background with a gold border, swaying lanterns, falling apricot and peach blossoms, captions on a red silk banner, punchlines with fireworks and raining red envelopes.",
      "chúc Tết, lời chúc ngày lễ, thông báo sự kiện/lễ hội, khuyến mãi Tết, chào năm mới, chuyện đoàn viên gia đình", "New Year greetings, holiday wishes, event/festival announcements, Tet promotions, welcoming the new year, family reunion stories"],
    ["Livestream bán hàng", "Live shopping",
      "Màn hình phiên live bán hàng: nhãn LIVE, người xem tăng dần, bình luận trôi, tim bay, lời người dẫn ghim, thẻ sản phẩm và thẻ FLASH SALE giá lăn xuống.", "A live-selling stream screen: LIVE badge, a rising viewer count, scrolling comments, floating hearts, the host's pinned message, a product card and a FLASH SALE card with a rolling-down price.",
      "bán hàng online, giới thiệu sản phẩm, flash sale, mỹ phẩm, thời trang, đồ gia dụng, review nhanh kèm giá, chốt đơn", "online selling, product showcases, flash sales, cosmetics, fashion, home goods, quick reviews with prices, closing orders"],
    ["Karaoke", "Karaoke",
      "Màn hình karaoke: hai dòng lời xen kẽ trái – phải, chữ đổi màu chạy theo tiếng hát, chấm đếm ngược trước câu, nền MV hoặc sân khấu đèn nhún theo nhạc.", "A karaoke screen: two lyric lines alternating left and right, text changing color along with the singing, countdown dots before each line, an MV background or a stage with lights pulsing to the music.",
      "video bài hát có lời, cover, hát karaoke, nhạc thiếu nhi, nhạc Việt, đoạn điệp khúc cần người xem hát theo", "song videos with lyrics, covers, karaoke, kids' songs, Vietnamese music, choruses for viewers to sing along"],
    ["Lời nhạc cuộn", "Scrolling lyrics",
      "Lời bài hát đồng bộ kiểu app nghe nhạc: nền ảnh bìa nhoè đậm màu, câu đang hát sáng dần từng từ, danh sách lời cuộn lên theo nhạc, trình phát nhỏ ở trên.", "Synced lyrics like a music app: a heavily blurred cover-art background, the sung line lighting up word by word, lyrics scrolling with the music, a mini player on top.",
      "lyric video, lời bài hát, cover, nhạc chill, ballad, nhạc buồn, đoạn nhạc hay cần chia sẻ, thơ phổ nhạc", "lyric videos, song lyrics, covers, chill music, ballads, sad songs, great music snippets to share, poems set to music"],
    ["Đĩa than", "Vinyl record",
      "Đĩa than quay với ảnh bìa trên nhãn đĩa, vòng phổ nhạc nhảy theo từng nhịp quanh đĩa, lời hiện từng từ bên dưới, mở đầu bằng đĩa trượt ra khỏi bìa.", "A spinning vinyl record with the cover art on its label, a spectrum ring pulsing to each beat around the record, lyrics appearing word by word below, opening with the record sliding out of its sleeve.",
      "nhạc lofi, chill, R&B, nhạc xưa, playlist, giới thiệu bài hát mới, đoạn beat, trích một câu hát hay, nhạc không lời có vài câu", "lofi, chill, R&B, oldies, playlists, new song intros, beat snippets, quoting a great lyric, instrumentals with a few lines"],
    ["Không gian 3D", "3D space",
      "Ảnh/clip thành tấm kính dày bay trong khoảng không có sàn lưới và sao, camera lao qua khi đổi cảnh, chữ khối nổi, tag là khối lập phương xoay.", "Images/clips become thick glass panels flying through space over a grid floor and stars, the camera flies through them on scene changes, extruded 3D text, tags as spinning cubes.",
      "công nghệ, AI, khoa học, vũ trụ, tương lai, sản phẩm số, game, sự thật thú vị, giới thiệu dự án/sản phẩm, nội dung cần cảm giác \"wow\"", "technology, AI, science, space, the future, digital products, games, fun facts, project/product intros, content that needs a \"wow\" feel"],
    ["Cảnh 3D thật", "Real 3D scene",
      "Studio 3D dựng bằng Three.js: ảnh dán lên tấm dày cạnh kim loại xoay bay tới, khối crôm và sơn bóng trôi quanh, đèn màu và bóng đổ thật, chữ crôm trên kính mờ.", "A 3D studio built with Three.js: images on thick metal-edged panels spinning in, chrome and glossy shapes floating around, colored lights and real shadows, chrome text on frosted glass.",
      "ra mắt sản phẩm, công nghệ, xe, đồ điện tử, thương hiệu, bất động sản, sự kiện, giới thiệu app/startup, nội dung cần vẻ cao cấp hiện đại", "product launches, technology, cars, electronics, brands, real estate, events, app/startup intros, content that needs a premium modern look"],
  ];
  const styleEntries = {};
  for (const [label, labelEn, summary, summaryEn, bestFor, bestForEn] of STYLES) {
    styleEntries[label] = labelEn;
    styleEntries[summary] = summaryEn;
    styleEntries[bestFor] = bestForEn;
  }
  I18N.add(styleEntries);

  // ---------------------------------------------------------------- hooks (scripts/hook-library.ts)
  // Menu group heading is "label — hint" (or just label); option title = formula, sub = example.
  const HOOK_GROUPS = [
    ["Gây tò mò", "Curiosity", "kiến thức, khám phá, bí ẩn, sự thật thú vị", "knowledge, discovery, mysteries, fun facts"],
    ["Bất ngờ, ngược kỳ vọng", "Surprise, against expectations", "đi ngược điều người xem đang nghĩ", "goes against what viewers expect"],
    ["Vấn đề & lợi ích", "Problem & benefit", "nói trúng vấn đề hoặc hứa một lợi ích rõ", "names the problem or promises a clear benefit"],
    ["Thử thách & tương tác", "Challenge & engagement", "rủ người xem thử, đoán, chọn, bình luận", "invites viewers to try, guess, choose, comment"],
    ["Mẫu dùng ngay", "Ready to use", "câu mở đã thành hình, hợp nhiều loại nội dung", "finished openers that fit many kinds of content"],
    ["Cho câu đố, kiểm tra kiến thức", "For quizzes and knowledge checks", "", ""],
    ["Cho kiến thức, khoa học, tự nhiên", "For knowledge, science, nature", "", ""],
    ["Cho kể chuyện, chuyện hài", "For storytelling and comedy", "", ""],
  ];
  const hookEntries = {};
  for (const [label, labelEn, hint, hintEn] of HOOK_GROUPS) {
    hookEntries[label] = labelEn;
    if (hint) {
      hookEntries[hint] = hintEn;
      hookEntries[`${label} — ${hint}`] = `${labelEn} — ${hintEn}`;
    }
  }
  Object.assign(hookEntries, {
    // A. Curiosity
    "Bạn có biết…?": "Did you know…?",
    "Bạn có biết loài vật này sống được cả năm không cần uống nước?": "Did you know this animal can live a whole year without drinking water?",
    "Sự thật ít người biết": "A little-known fact",
    "Có một sự thật về đại dương mà rất ít người biết.": "There's a fact about the ocean that very few people know.",
    "Điều gì xảy ra nếu…?": "What happens if…?",
    "Điều gì xảy ra nếu Trái Đất ngừng quay trong 5 giây?": "What would happen if the Earth stopped spinning for 5 seconds?",
    "Bạn sẽ không tin…": "You won't believe…",
    "Bạn sẽ không tin thứ đang sống bên trong quả chuối này.": "You won't believe what's living inside this banana.",
    "Bí mật đằng sau…": "The secret behind…",
    "Đây là bí mật đằng sau thứ bạn dùng mỗi ngày.": "Here's the secret behind something you use every day.",
    // B. Surprise
    "Bạn đang hiểu sai về…": "You've got it wrong about…",
    "Bạn đang hiểu sai về loài cá mập này.": "You've got this shark all wrong.",
    "Nhìn bình thường, nhưng…": "Looks normal, but…",
    "Quả chuối này trông bình thường, nhưng hãy nhìn bên trong.": "This banana looks normal, but look inside.",
    "Thứ bạn tưởng là X hoá ra là Y": "What you thought was X is actually Y",
    "Thứ bạn tưởng là hòn đá hoá ra là một sinh vật sống.": "What you thought was a rock is actually a living creature.",
    "Đừng bao giờ làm điều này…": "Never do this…",
    "Đừng bao giờ làm điều này khi điện thoại rơi xuống nước.": "Never do this when your phone falls in water.",
    "Nghe vô lý nhưng…": "Sounds crazy, but…",
    "Nghe vô lý, nhưng loài vật này sống lại sau khi đông cứng.": "Sounds crazy, but this animal comes back to life after freezing solid.",
    // C. Problem & benefit
    "Nếu bạn đang…, xem cái này": "If you're…, watch this",
    "Nếu bạn đang học tiếng Anh, 5 từ này rất dễ nhầm.": "If you're learning English, these 5 words are easy to mix up.",
    "3 điều bạn cần biết trước khi…": "3 things you need to know before…",
    "3 điều nên biết trước khi mua chiếc điện thoại này.": "3 things to know before buying this phone.",
    "Đây là cách để…": "Here's how to…",
    "Đây là cách nhớ 10 từ tiếng Anh mà không cần học thuộc.": "Here's how to remember 10 English words without memorizing.",
    "Sai lầm nhiều người mắc phải": "The mistake most people make",
    "Đây là sai lầm khiến nhiều người học mãi không tiến bộ.": "This is the mistake that keeps so many learners from improving.",
    "Giá như tôi biết điều này sớm hơn": "I wish I'd known this sooner",
    "Giá như tôi biết mẹo này trước khi bắt đầu làm Reels.": "I wish I'd known this trick before I started making Reels.",
    // D. Challenge & engagement
    "Rất ít người nhận ra…": "Very few people notice…",
    "Rất ít người nhận ra điểm khác biệt trong bức ảnh này.": "Very few people spot the difference in this picture.",
    "Đoán xem đây là gì": "Guess what this is",
    "Bạn có 3 giây để đoán đây là loài vật nào.": "You have 3 seconds to guess which animal this is.",
    "Chỉ người tinh mắt mới thấy…": "Only sharp eyes will spot…",
    "Chỉ người tinh mắt mới nhận ra chi tiết bất thường này.": "Only sharp eyes will notice this odd detail.",
    "Bạn chọn A hay B?": "Would you pick A or B?",
    "Nếu chỉ được chọn một, bạn sẽ sống ở đâu?": "If you could only pick one, where would you live?",
    "Xem đến cuối để…": "Watch till the end to…",
    "Xem đến cuối để biết bạn trả lời đúng mấy câu.": "Watch till the end to see how many you got right.",
    // Ready to use
    "Khoan lướt! Bạn cần xem cái này": "Stop scrolling! You need to see this",
    "Khoan lướt đã, hiện tượng này chỉ xuất hiện vài giây.": "Don't scroll yet — this only lasts a few seconds.",
    "Tôi cá bạn chưa từng biết điều này": "I bet you never knew this",
    "Tôi cá bạn chưa từng biết cơ thể mình làm được điều này.": "I bet you never knew your body could do this.",
    "Đừng chớp mắt, bạn sẽ bỏ lỡ": "Don't blink or you'll miss it",
    "Đừng chớp mắt, thay đổi này diễn ra trong một giây.": "Don't blink — this change happens in one second.",
    "Dễ hơn bạn nghĩ… hay không?": "Easier than you think… or is it?",
    "Câu này dễ hơn bạn nghĩ, hay không?": "This one's easier than you think — or is it?",
    "Tất cả bắt đầu từ một quyết định ngu ngốc": "It all started with one stupid decision",
    "Mọi chuyện bắt đầu từ một quyết định ngu ngốc lúc 2 giờ sáng.": "It all started with a stupid decision at 2 a.m.",
    "Sao không ai nói cho chúng ta biết điều này?": "Why did nobody tell us this?",
    "Sao không ai nói cho chúng ta biết mẹo này sớm hơn?": "Why did nobody tell us this trick sooner?",
    "Tôi đã thử điều này trong 7 ngày": "I tried this for 7 days",
    "Tôi đã thử dậy lúc 5 giờ sáng suốt 7 ngày.": "I tried waking up at 5 a.m. for 7 days.",
    "Nhìn kỹ nhé, có gì đó không đúng": "Look closely, something's off",
    "Nhìn kỹ bức ảnh này, có gì đó không đúng.": "Look closely at this picture — something's off.",
    "Thứ khiến tôi thay đổi suy nghĩ hoàn toàn": "The thing that completely changed my mind",
    "Đây là thứ khiến tôi bỏ hẳn thói quen mười năm.": "This is what made me quit a ten-year habit.",
    "Bạn sẽ làm gì nếu chuyện này xảy ra?": "What would you do if this happened?",
    "Bạn sẽ làm gì nếu mở cửa ra và thấy cảnh này?": "What would you do if you opened the door and saw this?",
    // Quiz
    "Người giỏi cũng sai câu này": "Even experts get this one wrong",
    "Người giỏi tiếng Anh cũng có thể sai câu này.": "Even people good at English can get this one wrong.",
    "Bạn có 5 giây để chọn đáp án": "You have 5 seconds to pick an answer",
    "Bạn có 5 giây để chọn đáp án đúng.": "You have 5 seconds to pick the right answer.",
    "Đừng trả lời vội, câu này có bẫy": "Don't rush — this one's a trap",
    "Đừng trả lời vội, câu này có bẫy.": "Don't rush — this one's a trap.",
    "Bạn được mấy điểm trên 5?": "How many out of 5 can you get?",
    "Xem bạn được mấy điểm trên 5 nhé.": "Let's see how many out of 5 you get.",
    "Đừng đoán theo mặt chữ": "Don't guess from how it looks",
    "Từ này nghĩa là gì? Đừng đoán theo mặt chữ.": "What does this word mean? Don't guess from how it looks.",
    // Science
    "Trông như ngoài hành tinh, nhưng có thật": "Looks alien, but it's real",
    "Sinh vật này trông như ngoài hành tinh, nhưng nó có thật.": "This creature looks alien, but it's real.",
    "Nếu gặp thứ này, bạn sẽ làm gì?": "If you ran into this, what would you do?",
    "Nếu thấy thứ này dưới biển, bạn sẽ làm gì?": "If you saw this in the sea, what would you do?",
    "Thứ đáng sợ nhất không phải là…": "The scariest thing isn't…",
    "Thứ đáng sợ nhất ở đại dương không phải cá mập.": "The scariest thing in the ocean isn't the shark.",
    "Bạn sẽ không tin cơ thể làm được điều này": "You won't believe the body can do this",
    "Bạn sẽ không tin cơ thể người chịu được mức này.": "You won't believe the human body can withstand this.",
    "Đây là lý do hiện tượng này xảy ra": "Here's why this happens",
    "Đây là lý do bầu trời chuyển màu đỏ trước bão.": "Here's why the sky turns red before a storm.",
    // Story
    "Từ nhỏ tôi đã là người rất…": "Ever since I was little, I've been really…",
    "Từ nhỏ tôi đã là một người cực kỳ thiếu may mắn.": "Ever since I was little, I've been incredibly unlucky.",
    "Đến giờ tôi vẫn không hiểu sao mình…": "To this day I don't understand how I…",
    "Đến giờ tôi vẫn không hiểu sao mình còn sống.": "To this day I don't understand how I'm still alive.",
    "Một quyết định đổi đời… theo hướng rất tệ": "A life-changing decision… for the worse",
    "Tôi từng có quyết định đổi đời, theo hướng rất tệ.": "I once made a life-changing decision — for the worse.",
    "Nếu đời tôi là phim, đây là cảnh bị cắt": "If my life were a movie, this would be the deleted scene",
    "Nếu cuộc đời tôi là một bộ phim, đây chắc chắn là cảnh bị cắt.": "If my life were a movie, this would definitely be the deleted scene.",
    "Tôi không thất bại, tôi chỉ…": "I don't fail, I just…",
    "Tôi không phải người thất bại. Tôi chỉ rất giỏi việc thất bại.": "I'm not a failure. I'm just really good at failing.",
  });
  I18N.add(hookEntries);

  // ---------------------------------------------------------------- Settings (server/keys.ts) + catalogs
  I18N.add({
    // groups
    "Chung · General": "General",
    "🆓 Miễn phí · Viết lời & giọng đọc": "🆓 Free · Script & voice",
    "Miễn phí · Viết lời & giọng đọc": "Free · Script & voice",
    "🆓 Miễn phí · Ảnh, clip & nhạc": "🆓 Free · Images, clips & music",
    "Miễn phí · Ảnh, clip & nhạc": "Free · Images, clips & music",
    "💳 Trả phí · Viết lời & giọng đọc": "💳 Paid · Script & voice",
    "Trả phí · Viết lời & giọng đọc": "Paid · Script & voice",
    "💳 Trả phí · Tạo video bằng AI": "💳 Paid · AI video generation",
    "Trả phí · Tạo video bằng AI": "Paid · AI video generation",
    "Viết lời & giọng đọc": "Script & voice",
    "Ảnh, clip & nhạc": "Images, clips & music",
    "Tạo video bằng AI": "AI video generation",
    "Chi phí": "Costs",
    "Giọng đọc": "Voice",
    "Dịch phụ đề": "Subtitle translation",

    // APP_LANGUAGE
    "🌐 Ngôn ngữ giao diện · Language": "🌐 Interface language",
    "Ngôn ngữ giao diện · Language": "Interface language",
    "Ngôn ngữ của nút, menu và thông báo trong app. Video mới mặc định làm theo ngôn ngữ này — đổi riêng từng video ở nút Ngôn ngữ khi tạo.":
      "Language of the app's buttons, menus and messages. New videos use this language by default — change it per video with the Language button when creating.",
    "Tiếng Việt": "Vietnamese",
    // FREE_MODE
    "💚 Chế độ Miễn phí": "💚 Free mode",
    "Chế độ Miễn phí": "Free mode",
    "Bật: chỉ dùng AI chạy trên máy và các gói miễn phí (Gemini, Groq, OpenRouter, Pexels, Pixabay, Freesound…). Không gọi Claude, ChatGPT, video AI hay vẽ ảnh tính tiền. Hết lượt miễn phí thì tự lùi sang lựa chọn trên máy (ví dụ giọng Gemini → giọng có sẵn trong app) và báo rõ.":
      "On: only use AI that runs on this computer and free plans (Gemini, Groq, OpenRouter, Pexels, Pixabay, Freesound…). Never calls Claude, ChatGPT, AI video or paid image generation. When a free quota runs out, it falls back to an on-device option (e.g. Gemini voice → built-in voice) and tells you.",
    "Tắt — dùng mọi dịch vụ đã có key": "Off — use every service you have a key for",
    "Bật — chỉ miễn phí": "On — free only",
    // budgets
    "Hạn mức video AI mỗi ngày (USD)": "Daily AI video budget (USD)",
    "Tạo clip mà tổng ước tính trong ngày vượt số này thì bị từ chối — cả trong trình chỉnh sửa, chat và hàng loạt. Tính theo bảng giá của model (Veo trên Google Gemini); đã đặt hạn mức thì model chưa có giá bị chặn. Để trống = không giới hạn, 0 = tắt hẳn video AI tính tiền.":
      "Clips whose estimated total for the day would exceed this amount are refused — in the Editor, chat and Batch. Based on each model's price list (Veo on Google Gemini); once a budget is set, models without a known price are blocked. Empty = no limit, 0 = turn paid AI video off completely.",
    "Hạn mức video AI mỗi tháng (USD)": "Monthly AI video budget (USD)",
    "Như trên, cộng dồn từ ngày 1 của tháng (theo giờ máy). Để trống = không giới hạn.":
      "Same as above, summed from the 1st of the month (computer time). Empty = no limit.",
    // free keys
    "Nên điền đầu tiên — một key cho cả AI viết kịch bản lẫn giọng đọc AI tự nhiên, miễn phí (có giới hạn lượt). Riêng vẽ ảnh AI và video Veo KHÔNG có gói miễn phí (giới hạn free = 0) — cần bật thanh toán cho dự án Google của key.":
      "Fill this in first — one key for both AI script writing and natural AI voices, free (with usage limits). AI image generation and Veo video have NO free tier (free limit = 0) — you need to enable billing on the key's Google project.",
    "AI viết kịch bản nhanh, dự phòng khi Gemini hết lượt. Gói miễn phí không cần thẻ, giới hạn theo phút/ngày.":
      "Fast AI script writing, a backup when Gemini runs out of quota. The free plan needs no card and is limited per minute/day.",
    "Một key dùng nhiều model; model miễn phí giới hạn khoảng 200 lượt/ngày.":
      "One key for many models; free models are limited to about 200 requests/day.",
    "Ảnh và clip video thật cho cảnh (mục 🆓 Kho miễn phí trong trình chỉnh sửa, hoặc Hình ảnh › Ảnh/Clip miễn phí).":
      "Real photos and video clips for scenes (🆓 Free stock in the Editor, or Images › Free photos/clips).",
    "Thêm nguồn ảnh và clip video (dùng cùng hoặc thay Pexels). Đăng nhập Pixabay rồi lấy key ở trang API.":
      "Another source of photos and video clips (use alongside or instead of Pexels). Sign in to Pixabay, then get a key on the API page.",
    "Nhạc nền và hiệu ứng âm thanh. App chỉ lấy file giấy phép CC0 hoặc CC-BY (được dùng thương mại, tự ghi nguồn). Tạo key ở trang \"API credentials\" sau khi đăng nhập.":
      "Background music and sound effects. The app only takes CC0 or CC-BY files (commercial use allowed, credits added automatically). Create a key on the \"API credentials\" page after signing in.",
    "Cloudflare — Account ID (vẽ ảnh AI)": "Cloudflare — Account ID (AI images)",
    "Vẽ ảnh AI bằng FLUX.1 schnell trên Cloudflare Workers AI: 10.000 neuron miễn phí mỗi ngày ≈ 100 ảnh (mỗi ảnh 96 neuron), đặt lại lúc 7h sáng giờ Việt Nam. Có key thì 🎨 AI vẽ ảnh dùng FLUX thay Gemini (tính tiền). Account ID là chuỗi 32 ký tự ở trang Workers AI › Use REST API.":
      "AI images with FLUX.1 schnell on Cloudflare Workers AI: 10,000 free neurons a day ≈ 100 images (96 neurons each), reset at 7 a.m. Vietnam time. With a key, 🎨 AI images use FLUX instead of Gemini (paid). The Account ID is the 32-character string on the Workers AI › Use REST API page.",
    "32 ký tự a-f, 0-9": "32 characters a-f, 0-9",
    "Tạo token có quyền \"Workers AI\" ở cùng trang (Use REST API › Create a Workers AI API Token).":
      "Create a token with the \"Workers AI\" permission on the same page (Use REST API › Create a Workers AI API Token).",
    // script provider
    "AI viết kịch bản": "Script-writing AI",
    "Không bắt buộc key: app có sẵn một AI nhỏ chạy trên máy (không cần mạng) — viết được video đơn giản, sửa kịch bản chưa chính xác. Muốn viết/sửa tốt hơn thì điền MỘT key. Tự động: Claude → ChatGPT → Gemini → Groq → OpenRouter → Ollama → AI có sẵn, lấy cái đầu tiên dùng được. Gemini, Groq, OpenRouter có gói miễn phí.":
      "No key required: the app has a small built-in AI that runs on this computer (no internet needed) — it can write simple videos but edits scripts less accurately. For better writing/editing, fill in ONE key. Auto: Claude → ChatGPT → Gemini → Groq → OpenRouter → Ollama → built-in AI, using the first one that works. Gemini, Groq and OpenRouter have free plans.",
    "Tự động": "Auto",
    "Gemini (Google) — miễn phí": "Gemini (Google) — free",
    "Groq — miễn phí": "Groq — free",
    "OpenRouter — model miễn phí": "OpenRouter — free models",
    "Ollama — chạy trên máy, không cần mạng": "Ollama — runs on this computer, no internet needed",
    "AI có sẵn trong app — trên máy, không cần key": "Built-in AI — on this computer, no key needed",
    "Claude (Anthropic) — trả phí": "Claude (Anthropic) — paid",
    "ChatGPT (OpenAI) — trả phí": "ChatGPT (OpenAI) — paid",
    "Model Gemini": "Gemini model",
    "Model Groq": "Groq model",
    "Model dùng trước. Model đó lỗi (quá tải, hết lượt, viết JSON hỏng) thì app tự chuyển sang model Groq còn lại.":
      "The model to try first. If it fails (overloaded, out of quota, broken JSON), the app switches to the other Groq models.",
    "GPT-OSS 120B — viết tốt nhất": "GPT-OSS 120B — best writing",
    "Qwen 3.8 27B — ổn định, nhanh": "Qwen 3.8 27B — stable, fast",
    "GPT-OSS 20B — nhanh nhất, nhẹ": "GPT-OSS 20B — fastest, lightweight",
    "Model OpenRouter": "OpenRouter model",
    "Model Ollama (trên máy)": "Ollama model (local)",
    "Địa chỉ Ollama": "Ollama address",
    "Model giọng đọc Gemini": "Gemini voice model",
    "Cách đọc (Gemini)": "Reading style (Gemini)",
    "Mô tả giọng đọc bằng lời, ví dụ: \"Giọng kể chuyện ấm áp, nhịp chậm, nhấn vào con số\". Bỏ trống: giọng dẫn video tự nhiên, nhịp vừa phải.":
      "Describe the voice in words, e.g. \"Warm storytelling voice, slow pace, stress the numbers\". Empty: a natural presenter voice at a moderate pace.",
    "Giọng tự nhiên, rõ ràng, nhịp vừa phải": "Natural, clear voice, moderate pace",
    // paid keys
    "Viết và sửa kịch bản bằng Claude.": "Write and edit scripts with Claude.",
    "Viết và sửa kịch bản bằng ChatGPT — dùng thay cho Claude.": "Write and edit scripts with ChatGPT — instead of Claude.",
    "Model ChatGPT": "ChatGPT model",
    "Giọng đọc AI chất lượng cao; gói miễn phí rất ít ký tự mỗi tháng. Không có thì dùng giọng Gemini, hoặc giọng miễn phí có sẵn trong máy (macOS: giọng Linh; Windows: giọng nói của Windows, cần cài gói tiếng Việt).":
      "High-quality AI voices; the free plan has very few characters a month. Without it, use Gemini voices or the free voices built into your computer (macOS: the Linh voice; Windows: Windows voices, the Vietnamese language pack is required).",
    "Model tạo video": "Video model",
    "Model mặc định khi bấm ✨ AI trong trình chỉnh sửa. Tự động: model rẻ nhất có key. Chọn model thiếu key thì tự dùng model khác.":
      "Default model when you press ✨ AI in the Editor. Auto: the cheapest model you have a key for. If the chosen model has no key, another one is used.",
    "Một key dùng Seedance, Kling, Wan, Veo. Tài khoản mới thường được tặng credit dùng thử.":
      "One key for Seedance, Kling, Wan, Veo. New accounts usually get free trial credit.",
    "Một token dùng Veo, Seedance, Kling, Wan. Trả trước theo lượt chạy.":
      "One token for Veo, Seedance, Kling, Wan. Prepaid per run.",
    "Model dịch trên máy (Ollama)": "Local translation model (Ollama)",
    // watermark
    "Bật để in chữ watermark lên mọi video và ảnh khi xuất — kể cả video làm từ trước. Trình chỉnh sửa xem trước được.":
      "Turn on to stamp the watermark text on every video and image you export — including videos made earlier. Previewed in the Editor.",
    "Tắt": "Off",
    "Bật": "On",
    "Chữ watermark": "Watermark text",
    "Tên kênh hoặc website": "Channel name or website",
    "Vị trí watermark": "Watermark position",
    "Video dọc: cạnh dưới và cạnh phải dễ bị mô tả, nút like/share của TikTok/Reels che. Chọn Tuỳ chỉnh hoặc kéo chữ trong khung bên dưới để đặt ở chỗ bất kỳ.":
      "Vertical video: the bottom and right edges are often covered by the caption and TikTok/Reels like/share buttons. Choose Custom or drag the text in the frame below to place it anywhere.",
    "Trên": "Top",
    "Dưới": "Bottom",
    "Trái": "Left",
    "Phải": "Right",
    "Tuỳ chỉnh (kéo thả)": "Custom (drag and drop)",
    "Xem trước vị trí": "Position preview",
    "Kéo chữ tới chỗ muốn đặt — vị trí tự chuyển sang Tuỳ chỉnh. Vùng mờ là nơi nút và chữ của nền tảng thường che.":
      "Drag the text where you want it — the position switches to Custom. Shaded areas are where platform buttons and text usually cover.",
    // save errors (server/keys.ts)
    "Dữ liệu không hợp lệ": "Invalid data",
    "Đã bật watermark — nhập chữ watermark, hoặc chọn Tắt.": "Watermark is on — enter the watermark text, or choose Off.",

    // script providers / translate engines / languages
    "Ollama (trên máy)": "Ollama (local)",
    "AI có sẵn trong app": "Built-in AI",
    "Ollama — trên máy, không cần mạng": "Ollama — on this computer, no internet needed",
    "AI có sẵn trong app (Qwen2.5 1.5B) — không cần mạng": "Built-in AI (Qwen2.5 1.5B) — no internet needed",
    "Tiếng Anh": "English",
    "Tiếng Trung (giản thể)": "Chinese (Simplified)",
    "Tiếng Nhật": "Japanese",
    "Tiếng Hàn": "Korean",
    "Tiếng Thái": "Thai",
    "Tiếng Indonesia": "Indonesian",
    "Tiếng Tây Ban Nha": "Spanish",
    "Tiếng Pháp": "French",
    "Tiếng Đức": "German",

    // art styles (scripts/image-prompts.ts)
    "Ảnh thật": "Real photo",
    "Ảnh chụp thật, đúng màu ngoài đời": "Real photos with true-to-life colors",
    "Hoạt hình 3D kiểu phim chiếu rạp, khối mềm, ánh sáng dịu": "Feature-film 3D animation, soft shapes, gentle lighting",
    "2D phẳng": "Flat 2D",
    "Minh hoạ vector phẳng, hình khối gọn, màu trơn": "Flat vector illustration, clean shapes, solid colors",
    "Hoạt hình": "Cartoon",
    "Tranh hoạt hình viền đậm, màu tươi, dáng vui nhộn": "Bold-outlined cartoon art, bright colors, playful poses",
    "Tranh anime Nhật, nét sạch, tô bóng phẳng, nền vẽ kỹ": "Japanese anime art, clean lines, flat shading, detailed backgrounds",
    "Màu nước": "Watercolor",
    "Tranh màu nước mềm, loang nhẹ trên giấy": "Soft watercolor painting, gently bleeding on paper",
    "Đất sét": "Clay",
    "Mô hình đất sét nặn tay kiểu phim stop-motion": "Hand-sculpted clay models, stop-motion style",
    "Đồ hoạ điểm ảnh kiểu game 16-bit": "16-bit game-style pixel graphics",

    // aspects (src/aspects.ts)
    "3:4 — Instagram feed dọc": "3:4 — Instagram portrait feed",
    "1:1 — vuông": "1:1 — square",
    "16:9 — YouTube / ngang": "16:9 — YouTube / landscape",
    "2:1 — điện ảnh": "2:1 — cinematic",
    "Instagram feed dọc": "Instagram portrait feed",
    "vuông": "square",
    "YouTube / ngang": "YouTube / landscape",
    "điện ảnh": "cinematic",

    // voices (engine labels, voice menu sub-text)
    "miễn phí": "free",
    "có sẵn trong app": "built-in",
  });

  // ---------------------------------------------------------------- chat replies, progress lines, errors
  const ERRORS = {
    // assertSettingsUsable / free mode
    "💚 Chế độ Miễn phí đang bật — video AI tính tiền nên đã tắt. Đổi chip Hình về 🖼 Ảnh, hoặc tắt chế độ này trong ⚙ Cài đặt.":
      "💚 Free mode is on — AI video costs money, so it's disabled. Switch the Images chip back to 🖼 Photos, or turn this mode off in ⚙ Settings.",
    "💚 Chế độ Miễn phí đang bật — AI vẽ ảnh bằng Gemini tính tiền. Thêm key Cloudflare (FLUX miễn phí ~100 ảnh/ngày) trong ⚙ Cài đặt, hoặc chọn ảnh/clip miễn phí.":
      "💚 Free mode is on — Gemini AI images cost money. Add a Cloudflare key (free FLUX, ~100 images/day) in ⚙ Settings, or choose free photos/clips.",
    "Chọn hình Video AI nhưng chưa có key tạo video. Thêm key Gemini, fal.ai hoặc Replicate trong Cài đặt, hoặc đổi chip Hình về 🖼 Ảnh.":
      "AI video is selected but there's no video key yet. Add a Gemini, fal.ai or Replicate key in Settings, or switch the Images chip back to 🖼 Photos.",
    "Chọn ảnh/clip miễn phí nhưng chưa có key Pexels hoặc Pixabay. Lấy key miễn phí rồi điền vào ⚙ Cài đặt › 🆓 Miễn phí · Ảnh, clip & nhạc, hoặc đổi nút Hình ảnh sang 🖼 Ảnh của tôi / 🚫 Không hình.":
      "Free photos/clips are selected but there's no Pexels or Pixabay key yet. Get a free key and enter it in ⚙ Settings › 🆓 Free · Images, clips & music, or switch the Images button to 🖼 My images / 🚫 No images.",
    "Chọn AI vẽ ảnh nhưng chưa có key Gemini. Điền GEMINI_API_KEY trong ⚙ Cài đặt, hoặc đổi nút Hình ảnh sang 🔍 Tìm ảnh Pexels / 🖼 Ảnh của tôi.":
      "AI images are selected but there's no Gemini key yet. Enter GEMINI_API_KEY in ⚙ Settings, or switch the Images button to 🔍 Search Pexels / 🖼 My images.",
    "Chưa có AI viết kịch bản. Điền key trong Cài đặt (Gemini, Groq, OpenRouter có gói miễn phí), chọn Ollama để chạy AI ngay trên máy không cần key, hoặc chọn 📝 Lời có sẵn để dán kịch bản.":
      "No script-writing AI yet. Enter a key in Settings (Gemini, Groq and OpenRouter have free plans), choose Ollama to run AI on this computer without a key, or choose 📝 Your own script to paste a script.",
    "Chưa có API key viết kịch bản — điền Claude, ChatGPT hoặc một key miễn phí (Gemini, Groq, OpenRouter) trong Cài đặt.":
      "No script-writing API key yet — enter Claude, ChatGPT or a free key (Gemini, Groq, OpenRouter) in Settings.",
    "Chưa có key tạo video. Thêm GEMINI_API_KEY, FAL_KEY hoặc REPLICATE_API_TOKEN trong ⚙ Cài đặt.":
      "No video generation key yet. Add GEMINI_API_KEY, FAL_KEY or REPLICATE_API_TOKEN in ⚙ Settings.",
    // jobs / inputs
    "Video này đang được xử lý — đợi xong đã.": "This video is being processed — wait until it's done.",
    "Video này đang được xử lý — đợi lượt trước xong đã.": "This video is being processed — wait for the previous run to finish.",
    "Video này đang được xử lý — đợi xong rồi làm tiếp.": "This video is being processed — wait until it's done, then continue.",
    "Nhập nội dung trước đã.": "Enter some content first.",
    "Tên video không hợp lệ.": "Invalid video name.",
    "Bản nháp quá lớn.": "The draft is too large.",
    "Tối đa 50 file mỗi lần.": "Up to 50 files at a time.",
    "Bản dịch lệch số câu so với bản gốc — bấm Chạy lại để dịch lại.": "The translation has a different number of lines than the original — press Re-run to translate again.",
    "Không nghe ra câu nào trong file này — kiểm tra lại file có tiếng nói không.": "Couldn't hear any speech in this file — check that it contains spoken audio.",
    "File âm thanh chỉ dựng được video — đổi Tạo ra sang Video.": "Audio files can only make videos — switch Create to Video.",
    "Video nhiều cảnh không sửa bằng prompt — bấm “Sửa cảnh” để mở lại tab 🎬 Nhiều cảnh, hoặc dùng trình chỉnh sửa.":
      "Multi-scene videos can't be edited with a prompt — press “Edit scenes” to reopen the 🎬 Multi-scene tab, or use the Editor.",
    "Video này dựng từ file audio, không có kịch bản nên chưa sửa bằng prompt được.":
      "This video was built from an audio file and has no script, so it can't be edited with a prompt.",
    "Không còn kịch bản của phần trước (video đó đã bị xoá?) nên không viết tiếp được.":
      "The previous part's script is gone (was that video deleted?), so it can't be continued.",
    "Video này không có kịch bản (dựng từ audio, nhiều cảnh hoặc trình chỉnh sửa) nên chưa làm tiếp được.":
      "This video has no script (built from audio, multi-scene or the Editor), so it can't be continued yet.",
    "Video này chưa được dựng — tạo video trước rồi mới chỉnh sửa được.": "This video hasn't been rendered — create the video first, then edit it.",
    "Thêm ít nhất một cảnh.": "Add at least one scene.",
    "Không thấy video nhiều cảnh này.": "Couldn't find this multi-scene video.",
    "Danh sách video cần xoá không hợp lệ.": "Invalid list of videos to delete.",
    // voices / subtitles
    "Chọn một giọng đọc hợp lệ.": "Choose a valid voice.",
    "Chưa có câu phụ đề nào để đọc.": "There are no subtitle lines to read yet.",
    "Câu cần đọc không tồn tại hoặc đang trống.": "The line to read doesn't exist or is empty.",
    "Chọn model dịch.": "Choose a translation model.",
    "Chọn một cảnh là video để tạo phụ đề.": "Choose a video scene to create subtitles.",
    "Đoạn âm thanh không tồn tại.": "The audio clip doesn't exist.",
    "Không có video còn tiếng hoặc âm thanh nào để phiên âm. Chọn riêng một cảnh/đoạn âm thanh rồi thử lại.":
      "There's no video with sound or audio clip to transcribe. Select a specific scene/audio clip and try again.",
    "Giọng Gemini cần tên giọng (ví dụ Kore) — chọn một giọng Gemini trong danh sách.": "Gemini voices need a voice name (e.g. Kore) — pick a Gemini voice from the list.",
    "Gemini TTS trả về audio im lặng — thử lại, hoặc chọn giọng khác.": "Gemini TTS returned silent audio — try again, or pick another voice.",
    "Không có giọng này.": "This voice doesn't exist.",
    "Giọng này cần gói ElevenLabs trả phí.": "This voice needs a paid ElevenLabs plan.",
    // script AI
    "Claude không trả về JSON hợp lệ theo schema. Thử diễn đạt lại prompt.": "Claude didn't return valid JSON for the schema. Try rephrasing the prompt.",
    "AI có sẵn trong app không trả về JSON hợp lệ. Thử lại, hoặc dùng AI trên mạng (Gemini, Groq miễn phí).":
      "The built-in AI didn't return valid JSON. Try again, or use an online AI (Gemini, Groq — free).",
    "AI có sẵn trong app viết quá dài và bị cắt — model nhỏ đang lặp lại. Gửi lại, rút gọn yêu cầu, hoặc dùng AI trên mạng (Gemini, Groq miễn phí).":
      "The built-in AI wrote too much and was cut off — the small model is repeating itself. Send again, shorten the request, or use an online AI (Gemini, Groq — free).",
    "lỗi không rõ": "unknown error",
  };
  const errorEntries = { ...ERRORS };
  // en-app.js turns "Không làm được: …" into "Couldn't do it: …" without translating the rest — add the prefixed
  // fixed errors as exact keys so the whole node still translates (exact keys win over patterns).
  for (const [vi, en] of Object.entries(ERRORS)) errorEntries[`Không làm được: ${vi}`] = `Couldn't do it: ${en}`;
  I18N.add(errorEntries);

  I18N.add({
    // progress lines (exact)
    "Dựng từ kịch bản bạn dán vào — không dùng AI…": "Building from the script you pasted — no AI…",
    "Đang soát lời: dữ kiện, cặp hỏi–đáp, câu chữ…": "Reviewing the script: facts, question–answer pairs, wording…",
    "Soát xong: không thấy lỗi.": "Review done: no problems found.",
    "Bản sửa đổi khung kịch bản — giữ bản viết đầu.": "The fix changed the script's structure — keeping the first draft.",
    "Không giới hạn độ dài — AI lập dàn ý chương trước rồi viết từng chương.": "No length limit — the AI outlines chapters first, then writes them one by one.",
    "Đang lập dàn ý chương…": "Outlining chapters…",
    "Không dùng giọng đọc.": "No voiceover.",
    "Không dùng giọng đọc — chỉ hiện phụ đề.": "No voiceover — subtitles only.",
    "Không có lời đọc.": "No narration.",
    "Không dùng hình — video chỉ có chữ.": "No images — text-only video.",
    "🚫 Không dùng hình — video chỉ có chữ.": "🚫 No images — text-only video.",
    "🎲 Không lấy được nhạc ngẫu nhiên — video không có nhạc nền.": "🎲 Couldn't get random music — the video has no background music.",
    "Không có model dịch — tìm Pexels bằng nguyên văn, kết quả có thể kém.": "No translation model — searching Pexels with the original text, results may be poor.",
    "Dùng lại clip AI đã tạo.": "Reusing an AI clip made earlier.",
    "Tải video về…": "Downloading the video…",
    "Đọc kịch bản dạng JSON.": "Read the script as JSON.",
    "Không có dòng tiêu đề — lấy câu đầu làm tiêu đề.": "No title line — using the first line as the title.",
    "Lời lấy từ file nên yêu cầu bằng chữ không đổi được lời — đổi phong cách, hình, khung, nhạc ở các chip rồi gửi; sửa chữ phụ đề trong trình chỉnh sửa.":
      "The words come from the file, so a text request can't change them — change the style, images, aspect ratio or music with the chips and send; edit subtitle text in the Editor.",
    // summary pieces
    "🔇 không giọng đọc": "🔇 no voice",
    "không nhạc nền": "no background music",
  });

  I18N.patterns([
    // ---- errors with variables (also used inside "Không làm được: …")
    [/^Không làm được: ([\s\S]+)$/, (_, inner) => {
      let out = tr(inner);
      // Several providers failed in turn (joined by "\n", collapsed to spaces here): translate each report.
      if (out === inner) out = inner.split(/\s+(?=[⏳📅💳🔑🔥📏])/u).map((part) => tr(part)).join("\n");
      return `Couldn't do it: ${out}`;
    }],
    [/^💚 Chế độ Miễn phí đang bật — (.+) tính tiền\. Chọn AI "Tự động" \(dùng Gemini, Groq, OpenRouter, AI trên máy\) hoặc tắt chế độ này trong ⚙ Cài đặt\.$/,
      (_, p) => `💚 Free mode is on — ${prov(p)} costs money. Choose AI "Auto" (uses Gemini, Groq, OpenRouter, on-device AI) or turn this mode off in ⚙ Settings.`],
    [/^Chưa có key cho (.+) — điền trong Cài đặt, hoặc chọn AI khác ở ô tuỳ chọn\.$/,
      (_, p) => `No key for ${prov(p)} yet — enter it in Settings, or pick another AI in the options.`],
    [/^Giọng "(.+)" không còn trong app — chọn giọng khác ở mục Giọng đọc rồi thử lại\.$/, 'Voice "$1" is no longer in the app — pick another voice under Voice and try again.'],
    [/^Giọng này cần API key (.+) — điền trong Cài đặt, hoặc chọn giọng miễn phí có sẵn trong máy\.$/, "This voice needs a $1 API key — enter it in Settings, or pick a free built-in voice."],
    [/^Thiếu (\S+)\. Điền trong Cài đặt, hoặc chạy với --tts say để dùng giọng macOS\.$/, "Missing $1. Enter it in Settings, or run with --tts say to use a macOS voice."],
    [/^Chưa có key (\S+) để dịch — điền trong ⚙ Cài đặt, hoặc chọn model dịch khác\.$/, "No $1 key for translation — enter it in ⚙ Settings, or pick another translation model."],
    [/^Không thấy file: (.+)$/, "File not found: $1"],
    [/^Không thấy file đính kèm: (.+)$/, "Attachment not found: $1"],
    [/^File đính kèm không hợp lệ: (.+)$/, "Invalid attachment: $1"],
    [/^File không hợp lệ: (.+)$/, "Invalid file: $1"],
    [/^Tối đa (\d+) cảnh mỗi video\.$/, "Up to $1 scenes per video."],
    [/^Cảnh (\d+): nhập prompt cho model video\.$/, "Scene $1: enter a prompt for the video model."],
    [/^Cảnh (\d+) đang trống — chọn model, thêm lời đọc hoặc tải ảnh\/video lên\.$/, "Scene $1 is empty — choose a model, add narration or upload an image/video."],
    [/^Cảnh (\d+): file không hợp lệ\.$/, "Scene $1: invalid file."],
    [/^Bản (\d+) không còn dữ liệu để chỉnh sửa \(video làm trước khi app lưu riêng từng bản\)\.$/, "Version $1 has no editable data left (the video was made before the app saved each version separately)."],
    [/^(.+) viết kịch bản bị cắt giữa chừng hoặc sai cấu trúc — bấm thử lại, hoặc chọn AI khác \/ đổi model trong ⚙ Cài đặt\.$/,
      (_, p) => `${prov(p)} was cut off mid-script or returned the wrong structure — retry, or pick another AI / change the model in ⚙ Settings.`],
    [/^(.+) không trả về JSON hợp lệ\. Thử lại, hoặc đổi model trong Cài đặt\.$/, (_, p) => `${prov(p)} didn't return valid JSON. Try again, or change the model in Settings.`],
    [/^Ollama \((.+)\) không trả về JSON hợp lệ\. Thử lại, hoặc dùng model lớn hơn \((\S+)\)\.$/, "Ollama ($1) didn't return valid JSON. Try again, or use a bigger model ($2)."],
    [/^Ollama \((.+)\) viết quá dài và bị cắt — model nhỏ đang lặp lại\. Gửi lại, rút gọn yêu cầu, hoặc dùng model lớn hơn \((\S+)\)\.$/,
      "Ollama ($1) wrote too much and was cut off — the small model is repeating itself. Send again, shorten the request, or use a bigger model ($2)."],
    [/^Ollama \((.+)\) chạy quá (\d+) phút — thử lại với yêu cầu ngắn hơn\.$/, "Ollama ($1) ran for over $2 minutes — try again with a shorter request."],
    [/^Không kết nối được Ollama ở (\S+) — mở app Ollama \(hoặc chạy "ollama serve"\) rồi thử lại\.$/, 'Couldn\'t connect to Ollama at $1 — open the Ollama app (or run "ollama serve") and try again.'],
    [/^Máy chưa có model (\S+) — chạy "ollama pull (\S+)" rồi thử lại\.$/, 'Model $1 isn\'t installed — run "ollama pull $2" and try again.'],
    [/^Ollama \((.+)\) báo lỗi(?: (\d+))?: (.*)$/, (_, m, s, msg) => `Ollama (${m}) error${s ? ` ${s}` : ""}: ${msg}`],
    [/^(.+) từ chối yêu cầu này: (.*)$/, (_, p, why) => `${prov(p)} refused this request: ${why === "không rõ lý do" ? "no reason given" : why}`],
    [/^Kịch bản AI trả về không đúng định dạng: (.*)$/, "The AI's script has the wrong format: $1"],
    [/^(.+): chưa có model nào để gọi\.$/, "$1: no model available to call."],
    [/^(.+): quá 15 phút chưa xong — thử lại sau\.$/, "$1: not done after 15 minutes — try again later."],
    // provider errors (scripts/provider-error.ts)
    [/^⏳ (.+?): hết hạn mức token\/lượt gọi trong một phút của gói\. Đợi khoảng (?:(\d+) giây|1 phút) rồi thử lại, (.+?)\. (\(chi tiết: .*\))$/,
      (_, p, s, a, d) => `⏳ ${prov(p)}: the plan's per-minute token/request limit is used up. Wait about ${s ? `${s} seconds` : "1 minute"} and try again, ${alt(a)}. ${detail(d)}`],
    [/^📅 (.+?): đã dùng hết lượt miễn phí trong ngày \(hoặc gói chưa được dùng tính năng này\)\. Thử lại vào ngày mai, nâng cấp gói, (.+?)\. (\(chi tiết: .*\))$/,
      (_, p, a, d) => `📅 ${prov(p)}: today's free quota is used up (or your plan can't use this feature). Try again tomorrow, upgrade your plan, ${alt(a)}. ${detail(d)}`],
    [/^💳 (.+?): tài khoản hết tiền\/credit\. Nạp thêm trên trang của nhà cung cấp, (.+?)\. (\(chi tiết: .*\))$/,
      (_, p, a, d) => `💳 ${prov(p)}: the account is out of money/credit. Top up on the provider's site, ${alt(a)}. ${detail(d)}`],
    [/^🔑 (.+?): key sai, đã hết hạn hoặc bị từ chối quyền — kiểm tra lại key trong ⚙ Cài đặt\. (\(chi tiết: .*\))$/,
      (_, p, d) => `🔑 ${prov(p)}: the key is wrong, expired or lacks permission — check the key in ⚙ Settings. ${detail(d)}`],
    [/^🔥 (.+?): máy chủ đang quá tải tạm thời — thử lại sau ít phút, (.+?)\. (\(chi tiết: .*\))$/,
      (_, p, a, d) => `🔥 ${prov(p)}: the server is temporarily overloaded — try again in a few minutes, ${alt(a)}. ${detail(d)}`],
    [/^📏 (.+?): yêu cầu vượt hạn mức token của gói — rút ngắn nội dung, chọn sẵn một phong cách thay vì Tự động, (.+?)\. (\(chi tiết: .*\))$/,
      (_, p, a, d) => `📏 ${prov(p)}: the request exceeds the plan's token limit — shorten the content, pick a specific style instead of Auto, ${alt(a)}. ${detail(d)}`],
    [/^(.+?) báo lỗi ?(\d*): (.*)$/, (_, p, s, msg) => `${prov(p)} error${s ? ` ${s}` : ""}: ${msg}`],
    [/^Voice (\S+) là library voice — gói Free của ElevenLabs không gọi được qua API\. Dùng một giọng premade, hoặc nâng cấp gói\.$/,
      "Voice $1 is a library voice — ElevenLabs' Free plan can't use it through the API. Use a premade voice, or upgrade your plan."],
    // Settings save errors (label is translated too)
    [/^(.+): lựa chọn không hợp lệ$/, (_, l) => `${tr(l)}: invalid choice`],
    [/^(.+): toạ độ không hợp lệ\.$/, (_, l) => `${tr(l)}: invalid coordinates.`],
    [/^(.+): nhập số USD, ví dụ 5 hoặc 2\.5 — để trống nếu không giới hạn\.$/, (_, l) => `${tr(l)}: enter a USD amount, e.g. 5 or 2.5 — leave empty for no limit.`],
    [/^(.+) không được xuống dòng hay chứa ký tự điều khiển\.$/, (_, l) => `${tr(l)} can't contain line breaks or control characters.`],
    [/^(.+) dài quá (\d+) ký tự\.$/, (_, l, n) => `${tr(l)} is longer than ${n} characters.`],
    [/^(.+) chứa ký tự không hợp lệ — dán lại cho đúng\.$/, (_, l) => `${tr(l)} contains invalid characters — paste it again correctly.`],
    [/^Không nhận mục lạ: (.+)$/, "Unknown setting: $1"],
    [/^(\S+) phải là chuỗi$/, "$1 must be a string"],

    // ---- Settings help texts with model names filled in (server/keys.ts)
    [/^Dùng key Google Gemini ở mục đầu\. Bỏ trống để dùng (\S+) — bản Flash mới nhất, có gói miễn phí\.$/,
      "Uses the Google Gemini key at the top. Leave empty to use $1 — the latest Flash model, with a free plan."],
    [/^Bỏ trống để dùng (\S+) \(tự chọn một model miễn phí\)\. Muốn cố định thì điền id có đuôi ":free"\.$/,
      'Leave empty to use $1 (picks a free model automatically). To pin one, enter an id ending in ":free".'],
    [/^Cài Ollama \(ollama\.com\/download — có bản Windows, macOS, Linux\), mở Terminal hoặc PowerShell chạy "ollama pull (\S+)"\. Điền tên model là bật Ollama; bỏ trống mà chọn Ollama ở trên thì dùng (\S+)\. Mặc định nhẹ \(~1 GB, máy 8 GB RAM chạy được\)\. Máy khoẻ hơn điền qwen2\.5:3b \(~1,9 GB\) để viết tiếng Việt tốt hơn\.$/,
      'Install Ollama (ollama.com/download — Windows, macOS and Linux), open Terminal or PowerShell and run "ollama pull $1". Entering a model name turns Ollama on; leave empty with Ollama selected above to use $2. The default is light (~1 GB, runs on 8 GB RAM). On a stronger machine enter qwen2.5:3b (~1.9 GB) for better Vietnamese writing.'],
    [/^Bỏ trống để dùng (\S+) \(Ollama trên chính máy này\)\.$/, "Leave empty to use $1 (Ollama on this computer)."],
    [/^Dùng key Google Gemini ở mục đầu\. Bỏ trống để dùng (\S+), lỗi thì tự lùi về (\S+)\. Có gói miễn phí nhưng giới hạn số lượt mỗi phút\/ngày — app đọc cả kịch bản trong một lượt để tiết kiệm\.$/,
      "Uses the Google Gemini key at the top. Leave empty to use $1, falling back to $2 on errors. There's a free plan with per-minute/day limits — the app reads the whole script in one request to save quota."],
    [/^Bỏ trống để dùng (\S+)\. Model phải hỗ trợ structured output\.$/, "Leave empty to use $1. The model must support structured output."],
    [/^Dùng khi chọn Ollama ở mục "Dịch phụ đề sang" lúc tạo phụ đề\. Bỏ trống để dùng (\S+) \(~3,3 GB, máy 8 GB RAM chạy được\)\. Máy 16 GB RAM trở lên: translategemma:12b \(~8,1 GB\) dịch tốt hơn\. Tải bằng lệnh "ollama pull <tên model>"\. Dịch trên mạng không cần ô này — dùng lại key Gemini, Groq, OpenRouter, ChatGPT hoặc Claude đã điền\.$/,
      'Used when you choose Ollama under "Translate subtitles to" while creating subtitles. Leave empty to use $1 (~3.3 GB, runs on 8 GB RAM). With 16 GB RAM or more, translategemma:12b (~8.1 GB) translates better. Download with "ollama pull <model name>". Online translation doesn\'t need this — it reuses the Gemini, Groq, OpenRouter, ChatGPT or Claude key you entered.'],
    [/^Tên kênh, @tên hoặc website — tối đa (\d+) ký tự\. Đây là chỗ duy nhất tên kênh hiện trong video\.$/,
      "Channel name, @handle or website — up to $1 characters. This is the only place the channel name appears in the video."],
    [/^Tự động — (\S+), lỗi thì đổi model$/, "Auto — $1, switches model on errors"],
    // "~$0.05/giây" (video model price), "ước tính $0.40"
    [/^([\d.,]+)\/giây$/, "$1/sec"],
    [/^ước tính \$([\d.]+)$/, "estimated $$$1"],

    // ---- voices: "nữ, vi" sub-text and "key — nữ, vi" labels
    [/^nữ, (vi|en)$/, "female, $1"],
    [/^nam, (vi|en)$/, "male, $1"],
    [/^khác, (vi|en)$/, "other, $1"],
    [/^(\S+) — nữ, (vi|en)$/, "$1 — female, $2"],
    [/^(\S+) — nam, (vi|en)$/, "$1 — male, $2"],
    [/^(\S+) — khác, (vi|en)$/, "$1 — other, $2"],

    // ---- chat reply summary (split on " · " and "\n")
    [/^Đã tạo "([\s\S]*)"$/, 'Created "$1"'],
    [/^Đã sửa "([\s\S]*)"$/, 'Edited "$1"'],
    [/^Đã tạo "([\s\S]*)" từ âm thanh$/, 'Created "$1" from audio'],
    [/^Đã dựng lại "([\s\S]*)" từ âm thanh$/, 'Rebuilt "$1" from audio'],
    [/^Đã tạo (\d+) ảnh "([\s\S]*)"$/, 'Created $1 images "$2"'],
    [/^Đã sửa (\d+) ảnh "([\s\S]*)"$/, 'Edited $1 images "$2"'],
    [/^(\d+) cảnh$/, "$1 scenes"],
    [/^giọng ([a-z0-9-]+)$/, "voice $1"],
    [/^🎵 (.+) \(ngẫu nhiên\)$/, "🎵 $1 (random)"],
    // Style values after "Phong cách: " (en-app2.js translates the prefix and passes the value through t()).
    [/^(.+) \(AI chọn\)$/, (_, s) => `${tr(s)} (AI's pick)`],
    [/^(.+) \(tự chọn theo lời\)$/, (_, s) => `${tr(s)} (picked from the words)`],
    [/^(.+) \(ngẫu nhiên\)$/, (_, s) => `${tr(s)} (random)`],
    [/^🎙 tiếng trong file (.+) \(không đọc giọng\)$/, "🎙 audio from file $1 (no voiceover)"],
    [/^🎙 Giọng (\S+) chỉ đọc tiếng Việt — video tiếng Anh dùng giọng (\S+)\.$/, "🎙 Voice $1 only reads Vietnamese — the English video uses voice $2."],
    [/^Giọng (\S+) chỉ đọc tiếng Việt — video tiếng Anh dùng giọng (\S+)$/, "Voice $1 only reads Vietnamese — the English video uses voice $2"],
    // Gemini voice fell back to a free voice (scripts/tts.ts)
    [/^(?:↪ )?Giọng Gemini (.+?) — đã đọc bằng (.+?)\. Chi tiết trong ⚙ Cài đặt › 📊 Hôm nay(\.?)$/, (all, why, voice, dot) => {
      const reason = {
        "hết lượt theo phút": "hit the per-minute limit", "hết lượt miễn phí trong ngày": "used up today's free quota",
        "hết tiền/credit": "ran out of money/credit", "key bị từ chối": "key was rejected", "máy chủ quá tải": "server is overloaded",
        "yêu cầu quá lớn": "request was too large", "lỗi": "failed",
      }[why] ?? why;
      const used = voice
        .replace(/^giọng (.+) có sẵn trong app$/, "the built-in voice $1")
        .replace(/^giọng (\S+) của macOS$/, "the macOS voice $1")
        .replace(/^giọng đọc của Windows$/, "the Windows voice");
      return `${all.startsWith("↪") ? "↪ " : ""}Gemini voice ${reason} — read with ${used} instead. Details in ⚙ Settings › 📊 Today${dot}`;
    }],
    // image notes
    [/^(\d+)\/(\d+) cảnh có hình từ (.+)$/, (_, a, b, s) => `${a}/${b} scenes have images from ${source(s)}`],
    [/^(\d+) cảnh không có ảnh$/, "$1 scenes without an image"],
    [/^ghi nguồn trong (.+)$/, "credits in $1"],
    [/^(cảnh|các cảnh) ([\d, ]+) chỉ có ảnh cùng chủ đề, không đúng thứ đang nói — xem lại trong Chỉnh sửa$/,
      (_, one, n) => `${one === "cảnh" ? "scene" : "scenes"} ${n} only have on-topic images, not the exact thing mentioned — review them in Edit`],
    [/^kho không có hình đúng cho (cảnh|các cảnh) ([\d, ]+) — để nền trơn, tự chọn hình trong Chỉnh sửa( hoặc đổi nút Hình ảnh sang AI vẽ)?$/,
      (_, one, n, draw) => `the library has no matching image for ${one === "cảnh" ? "scene" : "scenes"} ${n} — left as a plain background, pick images yourself in Edit${draw ? " or switch the Images button to AI drawing" : ""}`],
    [/^Không lấy được ảnh nào từ (.+) — các cảnh dùng nền trơn(\.?)$/, (_, s, dot) => `Couldn't get any images from ${source(s)} — scenes use a plain background${dot}`],
    [/^Dừng tạo video AI ở cảnh (\d+) — các cảnh chưa có clip dùng ảnh\. ([\s\S]*)$/, (_, n, err) => `Stopped making AI video at scene ${n} — scenes without a clip use images. ${tr(err)}`],

    // ---- progress lines (server/chat.ts and the scripts it calls)
    [/^Đang sửa kịch bản theo yêu cầu \((.+) viết\)…$/, (_, p) => `Editing the script as requested (written by ${prov(p)})…`],
    [/^Đang viết phần (\d+), nối tiếp “([\s\S]*)” \((.+) viết\)…$/, (_, n, t, p) => `Writing part ${n}, continuing “${t}” (written by ${prov(p)})…`],
    [/^Đang viết kịch bản bằng (.+)…$/, (_, p) => `Writing the script with ${prov(p)}…`],
    [/^Kịch bản: (\d+) cảnh, (\d+) câu$/, "Script: $1 scenes, $2 lines"],
    [/^Xong: (\d+) cảnh, (\d+) câu$/, "Done: $1 scenes, $2 lines"],
    [/^Phong cách ngẫu nhiên: (.+)$/, (_, s) => `Random style: ${tr(s)}`],
    [/^Phong cách: (.+?)( \(AI chọn\)| \(ngẫu nhiên\)| \(tự chọn theo lời\))?$/, (_, s, how) => `Style: ${tr(s)}${
      how === " (AI chọn)" ? " (AI's pick)" : how === " (ngẫu nhiên)" ? " (random)" : how ? " (picked from the words)" : ""}`],
    [/^Độ dài: (.+)$/, (_, s) => `Length: ${lenTr(s)}`],
    [/^Soát thấy (\d+) lỗi: ([\s\S]*)$/, "Review found $1 problems: $2"],
    [/^Đã sửa (\d+) câu theo bản soát\.$/, "Fixed $1 lines from the review."],
    [/^Bỏ qua bước soát lời \(([\s\S]*)\)\.$/, "Skipped the review step ($1)."],
    [/^Không sửa được theo bản soát \(([\s\S]*)\) — giữ bản viết đầu\.$/, "Couldn't apply the review ($1) — keeping the first draft."],
    [/^AI đang giới hạn lượt theo phút — đợi (\d+)s rồi soát tiếp…$/, "The AI is rate-limited per minute — waiting $1s before continuing the review…"],
    [/^AI đang giới hạn lượt — đợi (\d+)s rồi thử lại \((\d+)\/3\)…$/, "The AI is rate-limited — waiting $1s before retrying ($2/3)…"],
    [/^Video dài: ~(\d+) câu, (\d+) cảnh — AI viết theo (\d+) chương\.$/, "Long video: ~$1 lines, $2 scenes — the AI writes it in $3 chapters."],
    [/^Dàn ý: (\d+) chương — ([\s\S]*)$/, (_, n, list) => `Outline: ${n} chapters — ${list.replace(/Chương (\d+)/g, "Chapter $1")}`],
    [/^Đang viết chương (\d+)\/(\d+): ([\s\S]*)…$/, "Writing chapter $1/$2: $3…"],
    [/^Xong chương (\d+) \((\d+)\/(\d+)\)\.$/, "Finished chapter $1 ($2/$3)."],
    [/^Ghép (\d+) chương: (\d+) cảnh, (\d+) câu\.$/, "Joined $1 chapters: $2 scenes, $3 lines."],
    [/^Kéo dài kịch bản lên (.+) — viết lại theo chương\.$/, (_, s) => `Extending the script to ${lenTr(s)} — rewriting by chapter.`],
    [/^Đang đọc bằng giọng (.+)…$/, "Reading with voice $1…"],
    [/^Đang đọc (\d+) câu bằng giọng (.+)…$/, "Reading $1 lines with voice $2…"],
    [/^Xong: (\d+) câu\.$/, "Done: $1 lines."],
    [/^Gemini TTS đọc (\d+) câu trong một lượt…$/, "Gemini TTS reading $1 lines in one request…"],
    [/^Gemini TTS đọc (\d+) câu \(lượt (\d+)\/(\d+)\)…$/, "Gemini TTS reading $1 lines (request $2/$3)…"],
    [/^Gemini TTS hết hạn mức theo phút — tự đợi (\d+) giây rồi đọc tiếp…$/, "Gemini TTS hit its per-minute limit — waiting $1 seconds, then continuing…"],
    [/^(\S+) hết lượt — thử (\S+)…$/, "$1 is out of quota — trying $2…"],
    [/^Chỉ thấy (\d+)\/(\d+) chỗ ngừng giữa các câu — tách theo ước lượng, nên soát lại phụ đề(\.?)$/,
      "Only found $1/$2 pauses between lines — split by estimate, check the subtitles$3"],
    [/^🎲 Nhạc ngẫu nhiên \(thư viện\): (.+)$/, "🎲 Random music (library): $1"],
    [/^🎲 Nhạc ngẫu nhiên: “(.+)” — (.+) \(Freesound, (.+)\)$/, "🎲 Random music: “$1” — $2 (Freesound, $3)"],
    [/^Không lấy được nhạc Freesound \(“(.+)”\): ([\s\S]*)$/, "Couldn't get Freesound music (“$1”): $2"],
    [/^Đang tìm (\d+) (ảnh|clip) miễn phí \(Pexels, Pixabay\)…$/, (_, n, w) => `Searching ${n} free ${w === "ảnh" ? "images" : "clips"} (Pexels, Pixabay)…`],
    [/^Đang để (.+) vẽ (\d+) ảnh…$/, (_, who, n) => `Having ${who.replace("miễn phí", "free")} draw ${n} images…`],
    [/^Tìm hình cho (\d+) cảnh cùng lúc…$/, "Searching images for $1 scenes at once…"],
    [/^Từ khoá tìm hình \((.+?)\): ([\s\S]*)$/, (_, p, list) => `Image search keywords (${prov(p)}): ${list.replace(/cảnh (\d+)/g, "scene $1")}`],
    [/^Không chọn được từ khoá tìm hình(?: cho cảnh (\d+)–(\d+))? \(([\s\S]*)\) — tìm theo bản dịch lời đọc\.$/,
      (_, a, b, err) => `Couldn't pick image search keywords${a ? ` for scenes ${a}–${b}` : ""} (${err}) — searching with the translated narration.`],
    [/^\[(ảnh|clip)\] cảnh (\d+) \(([\s\S]*?)\)( · ảnh cùng chủ đề, không đúng chủ thể)?: ([\s\S]*)$/,
      (_, w, n, q, similar, c) => `[${what(w)}] scene ${n} (${kw(q)})${similar ? " · on-topic image, not the exact subject" : ""}: ${credit(c)}`],
    [/^\[(ảnh|clip)\] cảnh (\d+): kho không có (?:ảnh|clip) đúng "([\s\S]*)"( · khớp \d+\/\d+ từ khoá)? — bỏ qua\.$/,
      (_, w, n, q, fit) => `[${what(w)}] scene ${n}: the library has no ${what(w)} matching "${q}"${fit ? kw(fit) : ""} — skipped.`],
    [/^Không lấy được (ảnh|clip) cho "([\s\S]*)": ([\s\S]*)$/, (_, w, q, err) => `Couldn't get an ${what(w)} for "${q}": ${err}`],
    [/^Không tải được (ảnh|clip) cho cảnh (\d+): ([\s\S]*?)( — thử hình khác\.)?$/,
      (_, w, n, err, retry) => `Couldn't download the ${what(w)} for scene ${n}: ${err}${retry ? " — trying another image." : ""}`],
    [/^Mô tả hình cho (\d+) cảnh \((.+?)\) — (.+)$/, (_, n, p, how) => `Describing images for ${n} scenes (${prov(p)}) — ${how
      .replace(/^kiểu vẽ (.+)$/, (m, a) => `art style ${tr(a)}`)
      .replace(/^ảnh chụp thật theo phong cách (.+)$/, (m, s) => `real photos in the ${tr(s)} style`)
      .replace(/^tranh vẽ theo phong cách (.+)$/, (m, s) => `illustrations in the ${tr(s)} style`)}`],
    [/^Không viết được mô tả hình \(([\s\S]*)\) — vẽ theo bản dịch lời đọc\.$/, "Couldn't write image descriptions ($1) — drawing from the translated narration."],
    [/^Không dịch được truy vấn \(([\s\S]*)\) — tìm bằng nguyên văn\.$/, "Couldn't translate the search query ($1) — searching with the original text."],
    [/^Đang dựng ảnh (\d+)\/(\d+)…$/, "Rendering image $1/$2…"],
    [/^Đang dựng video… (\d+)%$/, "Rendering video… $1%"],
    [/^Cảnh (\d+)\/(\d+): video AI…$/, "Scene $1/$2: AI video…"],
    [/^Cảnh (\d+)\/(\d+): giữ file bạn tải lên\.$/, "Scene $1/$2: keeping your uploaded file."],
    [/^Không tạo được video AI ở cảnh (\d+): ([\s\S]*)$/, (_, n, err) => `Couldn't make the AI video for scene ${n}: ${tr(err)}`],
    [/^Không tạo được video AI: ([\s\S]*)$/, (_, err) => `Couldn't make the AI video: ${tr(err)}`],
    [/^(.+): đang tạo… (\d+)s$/, "$1: generating… $2s"],
    [/^Model đã chọn thiếu key — dùng (.+)\.$/, "The chosen model has no key — using $1."],
    [/^Đã lưu (\S+\/\S+)$/, "Saved $1"],
    [/^Hình mở đầu: (.+?)( — tách câu hook thành cảnh riêng)?$/, (_, m, split) => `Opening image: ${m}${split ? " — hook line split into its own scene" : ""}`],
    [/^Không thấy hình mở đầu (.+) — bỏ qua, cảnh đầu lấy hình như các cảnh khác(\.?)$/, "Opening image $1 not found — skipped, the first scene gets an image like the others$2"],
    // audio / subtitle flows
    [/^Chia video thành (\d+) cảnh theo lời\.$/, "Split the video into $1 scenes by the words."],
    [/^Chia lời thành (\d+) cảnh để gắn hình\.$/, "Split the words into $1 scenes for images."],
    [/^Dùng (\d+) ảnh\/clip bạn đính kèm cho (mọi|các) cảnh đầu\.$/, (_, n, all) => `Using the ${n} images/clips you attached for ${all === "mọi" ? "all scenes" : "the first scenes"}.`],
    [/^Phụ đề theo (\d+) dòng lời bạn dán — khớp mốc thời gian với tiếng trong file\.$/, "Subtitles follow the $1 lines you pasted — timed to the audio in the file."],
    [/^Dùng lại bản phiên âm của (.+)\.$/, "Reusing the transcript of $1."],
    [/^Đang phiên âm (.+) \((\d+)\/(\d+), model (.+)\)…$/, "Transcribing $1 ($2/$3, model $4)…"],
    [/^(.+): không có tiếng, bỏ qua$/, "$1: no speech, skipped"],
    [/^Đang dịch (\d+) câu sang (.+) bằng (.+)…$/, (_, n, lang, eng) => `Translating ${n} lines to ${tr(lang)} with ${tr(eng)}…`],
    [/^Xong: (\d+) câu phụ đề ở hàng Phụ đề (\d+)\.$/, "Done: $1 subtitle lines on Subtitles track $2."],
    // pasted-script notes (scripts/text-script.ts)
    [/^Không có dòng trống — tự chia mỗi (\d+) câu một cảnh\.$/, "No blank lines — splitting every $1 lines into a scene."],
    [/^Tách (\d+) câu dài hơn (\d+) ký tự\.$/, "Split $1 lines longer than $2 characters."],
    [/^Có (\d+) file đính kèm nhưng chỉ (\d+) cảnh — file thừa không dùng\.$/, "$1 files attached but only $2 scenes — extra files aren't used."],
    [/^Tự chọn phong cách "(.+)" theo từ khoá — đổi ở chip phong cách nếu chưa hợp\.$/, 'Picked the "$1" style from keywords — change it with the style chip if it doesn\'t fit.'],
  ]);
})();
