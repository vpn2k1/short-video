/**
 * Danh sách phong cách hình ảnh. File thuần dữ liệu — server và script Node import
 * được mà không kéo theo React/Remotion.
 *
 * Luật chi tiết của từng phong cách (hình ảnh + cách viết nội dung) nằm trong
 * skill `.claude/skills/style-<id>/SKILL.md`. Server đọc đoạn giữa hai dấu
 * `<!-- ai-guide -->` trong skill đó để đưa vào prompt viết kịch bản.
 */
export const STYLE_IDS = [
  "caption",
  "vox",
  "kinetic",
  "documentary",
  "whiteboard",
  "tech",
  "plain",
  "bold",
  "chat",
  "news",
  "retro",
  "cinematic",
  "comic",
  "social",
  "quiz",
  "ranking",
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

export const DEFAULT_STYLE: StyleId = "caption";

export type StyleMeta = {
  id: StyleId;
  label: string;
  emoji: string;
  /** Một câu cho người dùng thấy trong khung chọn. */
  summary: string;
  /** Khi nào nên dùng — AI đọc để tự chọn phong cách ở chế độ "Tự động". */
  bestFor: string;
  /** Prompt mẫu hợp phong cách — hiện trong khung chọn, điền sẵn vào ô chat khi chọn. */
  examplePrompt: string;
};

export const STYLES: Record<StyleId, StyleMeta> = {
  caption: {
    id: "caption",
    label: "Phụ đề nổi bật",
    emoji: "💬",
    summary: "Ảnh nền, phụ đề to từng câu kiểu TikTok.",
    bestFor: "mẹo nhanh, lời khuyên, nội dung đọc thẳng vào camera, video bán hàng ngắn",
    examplePrompt: "Video 20 giây: 5 mẹo ngủ ngon hơn mà không cần thuốc.",
  },
  vox: {
    id: "vox",
    label: "Cắt dán tài liệu",
    emoji: "✂️",
    summary: "Ảnh cắt dán trên giấy kẻ ô, nhãn highlight vàng, kiểu Vox.",
    bestFor: "giải thích sự kiện, lịch sử, kinh tế, vì sao X xảy ra, câu chuyện có nhân vật/đồ vật cụ thể",
    examplePrompt: "Vì sao Việt Nam trở thành nước xuất khẩu cà phê lớn thứ hai thế giới?",
  },
  kinetic: {
    id: "kinetic",
    label: "Chữ động",
    emoji: "🔠",
    summary: "Chữ lớn bật theo nhịp đọc, nền màu mạnh, không cần ảnh.",
    bestFor: "câu nói truyền cảm hứng, tuyên ngôn, hook mạnh, quảng cáo ngắn, nội dung ít hình ảnh",
    examplePrompt: "Đoạn truyền cảm hứng 15 giây: kỷ luật luôn thắng động lực.",
  },
  documentary: {
    id: "documentary",
    label: "Phim tài liệu",
    emoji: "🎞️",
    summary: "Ảnh toàn khung chuyển động chậm, hạt phim, chú thích địa điểm.",
    bestFor: "kể chuyện nghiêm túc, du lịch, địa danh, con người, điều tra, hồi ký",
    examplePrompt: "Kể chuyện hang Sơn Đoòng — hang động lớn nhất thế giới được phát hiện thế nào.",
  },
  whiteboard: {
    id: "whiteboard",
    label: "Bảng trắng",
    emoji: "✏️",
    summary: "Giấy sổ tay, chữ bút dạ, gạch chân và khoanh tròn vẽ tay.",
    bestFor: "dạy học, hướng dẫn từng bước, giải thích khái niệm, công thức, học tập",
    examplePrompt: "Giải thích lãi kép bằng ví dụ gửi 1 triệu mỗi tháng trong 10 năm.",
  },
  tech: {
    id: "tech",
    label: "Công nghệ tối giản",
    emoji: "💠",
    summary: "Nền tối, thẻ kính mờ, con số chạy, ánh sáng neon.",
    bestFor: "công nghệ, sản phẩm số, số liệu, so sánh, AI, tài chính, startup",
    examplePrompt: "ChatGPT, Claude, Gemini: mỗi AI giỏi nhất ở việc gì?",
  },
  plain: {
    id: "plain",
    label: "Video gốc",
    emoji: "🎬",
    summary: "Giữ nguyên ảnh/video, cắt cảnh gọn, không hiệu ứng — để sửa clip có sẵn.",
    bestFor: "video quay sẵn người dùng tải lên, vlog, ghép clip, khi hình đã đẹp và không cần đồ hoạ",
    examplePrompt: "Ghép các clip tôi vừa tải lên thành vlog 30 giây, cắt gọn và thêm phụ đề.",
  },
  bold: {
    id: "bold",
    label: "Phụ đề từng từ",
    emoji: "🟨",
    summary: "Chữ in hoa rất đậm viền đen, bật từng cụm 2–4 từ, từ đang đọc tô vàng — kiểu Hormozi.",
    bestFor: "nói thẳng vào camera, bài học kinh doanh, động lực, lời khuyên gắt, bán hàng, podcast cắt ngắn",
    examplePrompt: "3 sai lầm khiến bạn mãi không tiết kiệm được tiền — nói thẳng, gắt.",
  },
  chat: {
    id: "chat",
    label: "Tin nhắn",
    emoji: "💬",
    summary: "Kể chuyện bằng giao diện nhắn tin: bong bóng hai phía, đang gõ…, mốc thời gian.",
    bestFor: "kể chuyện, drama, tình huống dở khóc dở cười, hội thoại, chuyện tình cảm, tin nhắn lừa đảo",
    examplePrompt: "Kể chuyện qua tin nhắn: mẹ nhắn nhầm lời khen con vào nhóm Zalo của lớp.",
  },
  news: {
    id: "news",
    label: "Bản tin nóng",
    emoji: "📺",
    summary: "Nhãn TRỰC TIẾP, dải tiêu đề dưới màn hình, chữ chạy ở đáy — kiểu bản tin truyền hình.",
    bestFor: "tin tức, cập nhật, sự kiện vừa xảy ra, thông báo chính thức, tóm tắt tin trong ngày",
    examplePrompt: "Bản tin 30 giây: mẹo giữ nhà mát trong đợt nắng nóng đầu hè.",
  },
  retro: {
    id: "retro",
    label: "Băng VHS",
    emoji: "📼",
    summary: "Hình như băng video cũ: nhoè màu, vạch quét, nhiễu, chữ PLAY/REC và ngày giờ máy quay.",
    bestFor: "hoài niệm, chuyện ngày xưa, ký ức tuổi thơ, meme, kể chuyện bí ẩn, thập niên 80–2000",
    examplePrompt: "Bạn còn nhớ tuổi thơ 9x: băng cát-xét, tem xe và phim hoạt hình 5 giờ chiều?",
  },
  cinematic: {
    id: "cinematic",
    label: "Điện ảnh",
    emoji: "🎥",
    summary: "Viền đen điện ảnh, chỉnh màu phim, phụ đề chữ có chân, câu nhấn hiện như tiêu đề trailer.",
    bestFor: "kể chuyện cảm xúc, trailer, du lịch, thương hiệu, chân dung con người, câu chuyện giàu không khí",
    examplePrompt: "Một ngày của người thợ đóng thuyền cuối cùng ở Hội An — kể như trailer phim.",
  },
  comic: {
    id: "comic",
    label: "Truyện tranh",
    emoji: "💥",
    summary: "Ảnh trong khung truyện viền đậm, chấm halftone, hộp lời dẫn vàng, câu nhấn nổ kiểu BÙM!",
    bestFor: "chuyện hài, tình huống đời thường phóng đại, siêu anh hùng, trẻ em, meme, kể chuyện vui có nhân vật",
    examplePrompt: "Siêu anh hùng văn phòng: một mình cứu deadline lúc 5 giờ chiều thứ Sáu.",
  },
  social: {
    id: "social",
    label: "Bài đăng MXH",
    emoji: "🐦",
    summary: "Thẻ bài đăng kiểu Reddit/X trên nền mờ, chữ hiện dần theo giọng đọc, lượt thích nhảy số.",
    bestFor: "Reddit story, tâm sự ẩn danh, drama công sở, câu hỏi gây tranh luận, thú nhận, chuyện kể ngôi thứ nhất",
    examplePrompt: "Tâm sự ẩn danh: tôi phát hiện đồng nghiệp làm ít hơn nhưng lương cao gấp đôi.",
  },
  quiz: {
    id: "quiz",
    label: "Câu đố",
    emoji: "🧠",
    summary: "Mỗi cảnh một câu hỏi, đồng hồ đếm ngược, lật đáp án xanh — kéo người xem bình luận.",
    bestFor: "đố vui, kiểm tra kiến thức, bạn có biết, thử thách, trắc nghiệm, học từ vựng, kêu gọi bình luận",
    examplePrompt: "Đố vui 4 câu về địa lý Việt Nam, mỗi câu 3 giây suy nghĩ rồi hiện đáp án.",
  },
  ranking: {
    id: "ranking",
    label: "Top xếp hạng",
    emoji: "🏆",
    summary: "Đếm ngược #5 → #1, số hạng khổng lồ, bảng xếp hạng lấp dần theo từng cảnh.",
    bestFor: "top list, xếp hạng, so sánh nhiều thứ, món ăn, địa điểm, sản phẩm, kỷ lục, đếm ngược",
    examplePrompt: "Top 5 món ăn đường phố Việt Nam du khách mê nhất, đếm ngược từ 5 về 1.",
  },
};

export const isStyleId = (value: unknown): value is StyleId =>
  typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
