/**
 * Ngôn ngữ của NỘI DUNG video — chữ in sẵn trong khung phong cách (huy hiệu "TRỰC TIẾP", "BƯỚC 2", "Gửi tin nhắn"…).
 * Khác ngôn ngữ giao diện app (server/public/i18n.js): video tiếng Anh vẫn làm được khi app đang để tiếng Việt.
 *
 * Code phong cách viết chữ tiếng Việt như cũ và bọc qua `vt()`; video tiếng Anh thì tra bảng VIDEO_EN bên dưới.
 * Chữ có biến dùng chỗ giữ `{tên}`: vt("CÂU {n}/{total}", { n: 2, total: 5 }).
 */
import React, { createContext, useContext } from "react";

export const VIDEO_LANGUAGES = ["vi", "en"] as const;
export type VideoLanguage = (typeof VIDEO_LANGUAGES)[number];

export const isVideoLanguage = (value: unknown): value is VideoLanguage =>
  typeof value === "string" && (VIDEO_LANGUAGES as readonly string[]).includes(value);

/** Chữ tiếng Việt → tiếng Anh. Khoá phải giống hệt chuỗi truyền vào vt() (kể cả chỗ giữ `{n}`). */
export const VIDEO_EN: Record<string, string> = {
  "Chương {n}": "Chapter {n}",
  // news
  "TIN NÓNG": "BREAKING",
  "NÓNG": "HOT",
  "TIN": "NEWS",
  "TRỰC TIẾP": "LIVE",
  "MỚI": "NEW",
  "SỐ LIỆU": "DATA",
  // story
  "2 giờ": "2h",
  "Gửi tin nhắn": "Send message",
  "Tin mới": "New story",
  "2 giờ trước": "2 hours ago",
  "Đếm ngược": "Countdown",
  "Nhắc tôi": "Remind me",
  "Thêm của bạn ›": "Add yours ›",
  "Có 👍": "Yes 👍",
  "Không 👎": "No 👎",
  "{n} lượt bình chọn": "{n} votes",
  // recipe
  "BƯỚC": "STEP",
  "chuẩn bị": "prep",
  "XONG!": "DONE!",
  "Mẹo: ": "Tip: ",
  "công thức": "recipe",
  // quiz
  "CÂU {n}/{total}": "Q {n}/{total}",
  "người trả lời sai": "got it wrong",
  "Bình luận số câu bạn đúng": "Comment your score",
  "ĐÁP ÁN": "ANSWER",
  // liveshop
  "{n} lượt thích": "{n} likes",
  "Theo dõi": "Follow",
  "Chia sẻ": "Share",
  "Giỏ hàng": "Cart",
  "Đã bán {n}% · Sắp hết": "{n}% sold · Almost gone",
  "MUA NGAY": "BUY NOW",
  "ĐIỂM NỔI BẬT": "HIGHLIGHT",
  "Kết thúc sau": "Ends in",
  "SẮP LIVE": "SOON",
  "Bắt đầu sau": "Starts in",
  "Chủ phòng": "Host",
  "Còn {n} sản phẩm": "{n} left",
  "Mua": "Buy",
  "Đã bán": "Sold",
  // finance
  "BẢN TIN": "NEWS",
  "TĂNG TRƯỞNG": "GROWTH",
  "SỤT GIẢM": "DECLINE",
  "Tr": "M",
  "Mở cửa": "Open",
  "Cao nhất": "High",
  "Thấp nhất": "Low",
  "Khối lượng": "Volume",
  "TIN THỊ TRƯỜNG": "MARKET NEWS",
  "PHIÊN MỞ CỬA": "MARKET OPEN",
  "Phiên sáng": "Morning session",
  // blueprint
  "HÌNH {n}": "FIG. {n}",
  "VIDEO THAM CHIẾU": "REFERENCE VIDEO",
  "ẢNH THAM CHIẾU": "REFERENCE PHOTO",
  "SƠ ĐỒ NGUYÊN LÝ": "SCHEMATIC",
  "MẶT CẮT {x}-{x}": "SECTION {x}-{x}",
  "CHI TIẾT": "DETAIL",
  "BẢN VẼ": "DRAWING",
  "TÊN BẢN VẼ": "DRAWING TITLE",
  "BẢN VẼ SỐ": "DRAWING NO.",
  "TỈ LỆ": "SCALE",
  "TỜ": "SHEET",
  "THƯỚC TỈ LỆ (m)": "SCALE BAR (m)",
  "GHI CHÚ": "NOTES",
  "BẢN VẼ KỸ THUẬT · SỐ 01": "TECHNICAL DRAWING · NO. 01",
  // magazine
  "Tạp chí": "Magazine",
  "SỐ {n} · ẤN BẢN ĐẶC BIỆT": "NO. {n} · SPECIAL EDITION",
  "Mới!": "New!",
  "SỐ {n}": "NO. {n}",
  "Trang bìa": "Cover",
  "Trích dẫn": "Quote",
  "Câu chuyện trang bìa": "Cover story",
  "Trang {n}": "Page {n}",
  "35.000₫": "$4.99",
  // podcast
  "Đáng nhớ": "Memorable",
  "Câu đáng nhớ": "Memorable quote",
  "Tập {n}": "Ep {n}",
  "Đang phát": "Now playing",
  "Podcast · Tập {n}": "Podcast · Ep {n}",
  "Nghe ngay": "Listen now",
  "Tập mới · Mời bạn nghe": "New episode · Tune in",
  // sport
  "HIỆP 1": "1ST HALF",
  "HIỆP 2": "2ND HALF",
  "ĐIỂM TIN": "UPDATES",
  "THỐNG KÊ": "STATS",
  "PHÁT LẠI": "REPLAY",
  "Tâm điểm": "Spotlight",
  // chat
  "Tin nhắn": "Messages",
  "nhóm · đang hoạt động": "group · active now",
  "đang hoạt động": "active now",
  "bây giờ": "now",
  // map
  "Đã đến!": "Arrived!",
  "Đã đến · chặng {n}": "Arrived · stop {n}",
  "★ chặng {n} ★": "★ stop {n} ★",
  "chặng": "stop",
  "hành trình": "journey",
  "B": "N",
  // comic, pixel
  "Truyện mới": "New story",
  "Số": "No.",
  "NHIỆM VỤ": "QUEST",
  "▶ NHẤN START": "▶ PRESS START",
  "MÀN {n}": "STAGE {n}",
  // vox, ranking
  "Hồ sơ": "File",
  "Giải thích": "Explainer",
  "Bảng xếp hạng": "Leaderboard",
  "Hạng {n}": "Rank {n}",
  // documentary, horror, scrapbook, storybook, terminal
  "phim tài liệu": "documentary",
  "— Chuyện có thật? —": "— A true story? —",
  "Vé kỷ niệm": "Keepsake ticket",
  "Ngày xửa ngày xưa…": "Once upon a time…",
  "✔ build xong · {n} cảnh": "✔ build done · {n} scenes",
  // timeline, versus, vinyl
  "Mốc {n} / {total}": "Milestone {n} / {total}",
  "VÒNG {n}/{total}": "ROUND {n}/{total}",
  "ĐANG PHÁT": "NOW PLAYING",
  // social
  "{n} giờ": "{n}h",
  "vừa xong": "just now",
  "Bài đăng mới": "New post",
  "Ẩn danh": "Anonymous",
};

const fill = (text: string, vars?: Record<string, string | number>) =>
  vars ? text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all)) : text;

/** Dịch một chuỗi theo ngôn ngữ — dùng được ngoài component (hàm theme, layout). */
export const translateVideoText = (
  language: VideoLanguage | undefined,
  vi: string,
  vars?: Record<string, string | number>,
) => fill(language === "en" ? VIDEO_EN[vi] ?? vi : vi, vars);

/** Locale để định dạng số/ngày trong video. */
export const videoLocale = (language: VideoLanguage | undefined) => (language === "en" ? "en-US" : "vi-VN");

const VideoLanguageContext = createContext<VideoLanguage>("vi");

export const VideoLanguageProvider: React.FC<{ language?: VideoLanguage; children: React.ReactNode }> = ({
  language,
  children,
}) => <VideoLanguageContext.Provider value={language ?? "vi"}>{children}</VideoLanguageContext.Provider>;

export const useVideoLanguage = () => useContext(VideoLanguageContext);

/** `const vt = useVt(); vt("TRỰC TIẾP")` — chữ in sẵn trong video theo ngôn ngữ của video. */
export const useVt = () => {
  const language = useVideoLanguage();
  return (vi: string, vars?: Record<string, string | number>) => translateVideoText(language, vi, vars);
};
