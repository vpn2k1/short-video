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
};

export const STYLES: Record<StyleId, StyleMeta> = {
  caption: {
    id: "caption",
    label: "Phụ đề nổi bật",
    emoji: "💬",
    summary: "Ảnh nền, phụ đề to từng câu kiểu TikTok.",
    bestFor: "mẹo nhanh, lời khuyên, nội dung đọc thẳng vào camera, video bán hàng ngắn",
  },
  vox: {
    id: "vox",
    label: "Cắt dán tài liệu",
    emoji: "✂️",
    summary: "Ảnh cắt dán trên giấy kẻ ô, nhãn highlight vàng, kiểu Vox.",
    bestFor: "giải thích sự kiện, lịch sử, kinh tế, vì sao X xảy ra, câu chuyện có nhân vật/đồ vật cụ thể",
  },
  kinetic: {
    id: "kinetic",
    label: "Chữ động",
    emoji: "🔠",
    summary: "Chữ lớn bật theo nhịp đọc, nền màu mạnh, không cần ảnh.",
    bestFor: "câu nói truyền cảm hứng, tuyên ngôn, hook mạnh, quảng cáo ngắn, nội dung ít hình ảnh",
  },
  documentary: {
    id: "documentary",
    label: "Phim tài liệu",
    emoji: "🎞️",
    summary: "Ảnh toàn khung chuyển động chậm, hạt phim, chú thích địa điểm.",
    bestFor: "kể chuyện nghiêm túc, du lịch, địa danh, con người, điều tra, hồi ký",
  },
  whiteboard: {
    id: "whiteboard",
    label: "Bảng trắng",
    emoji: "✏️",
    summary: "Giấy sổ tay, chữ bút dạ, gạch chân và khoanh tròn vẽ tay.",
    bestFor: "dạy học, hướng dẫn từng bước, giải thích khái niệm, công thức, học tập",
  },
  tech: {
    id: "tech",
    label: "Công nghệ tối giản",
    emoji: "💠",
    summary: "Nền tối, thẻ kính mờ, con số chạy, ánh sáng neon.",
    bestFor: "công nghệ, sản phẩm số, số liệu, so sánh, AI, tài chính, startup",
  },
  plain: {
    id: "plain",
    label: "Video gốc",
    emoji: "🎬",
    summary: "Giữ nguyên ảnh/video, cắt cảnh gọn, không hiệu ứng — để sửa clip có sẵn.",
    bestFor: "video quay sẵn người dùng tải lên, vlog, ghép clip, khi hình đã đẹp và không cần đồ hoạ",
  },
  bold: {
    id: "bold",
    label: "Phụ đề từng từ",
    emoji: "🟨",
    summary: "Chữ in hoa rất đậm viền đen, bật từng cụm 2–4 từ, từ đang đọc tô vàng — kiểu Hormozi.",
    bestFor: "nói thẳng vào camera, bài học kinh doanh, động lực, lời khuyên gắt, bán hàng, podcast cắt ngắn",
  },
  chat: {
    id: "chat",
    label: "Tin nhắn",
    emoji: "💬",
    summary: "Kể chuyện bằng giao diện nhắn tin: bong bóng hai phía, đang gõ…, mốc thời gian.",
    bestFor: "kể chuyện, drama, tình huống dở khóc dở cười, hội thoại, chuyện tình cảm, tin nhắn lừa đảo",
  },
  news: {
    id: "news",
    label: "Bản tin nóng",
    emoji: "📺",
    summary: "Nhãn TRỰC TIẾP, dải tiêu đề dưới màn hình, chữ chạy ở đáy — kiểu bản tin truyền hình.",
    bestFor: "tin tức, cập nhật, sự kiện vừa xảy ra, thông báo chính thức, tóm tắt tin trong ngày",
  },
  retro: {
    id: "retro",
    label: "Băng VHS",
    emoji: "📼",
    summary: "Hình như băng video cũ: nhoè màu, vạch quét, nhiễu, chữ PLAY/REC và ngày giờ máy quay.",
    bestFor: "hoài niệm, chuyện ngày xưa, ký ức tuổi thơ, meme, kể chuyện bí ẩn, thập niên 80–2000",
  },
};

export const isStyleId = (value: unknown): value is StyleId =>
  typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
