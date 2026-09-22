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
  "book",
  "storybook",
  "pen",
  "neon",
  "scrapbook",
  "magazine",
  "timeline",
  "recipe",
  "terminal",
  "pixel",
  "versus",
  "luxury",
  "horror",
  "anime",
  "podcast",
  "map",
  "sport",
  "finance",
  "watercolor",
  "story",
  "blueprint",
  "festive",
  "liveshop",
  "karaoke",
  "lyrics",
  "vinyl",
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

export const DEFAULT_STYLE: StyleId = "caption";

/**
 * Phong cách nhạc: dựng cho bài hát có lời (bản thu cả bài làm voiceoverTrack) — đo nhịp từ file nhạc, chữ chạy
 * theo tiếng hát. Xem src/styles/music.tsx.
 */
export const MUSIC_STYLES = new Set<StyleId>(["karaoke", "lyrics", "vinyl"]);

/**
 * Lựa chọn "Ngẫu nhiên": mỗi video MỚI bốc thăm một phong cách (sửa lời, làm tiếp phần sau thì giữ phong cách đang có).
 * Không bốc "Video gốc" — dành cho clip quay sẵn — và phong cách nhạc — dành cho bài hát, bốc trúng cho video đọc
 * lời thường thì lạc. Lời dán sẵn (không có AI viết lại) còn bỏ các phong cách cần lời theo khuôn riêng: hội thoại
 * "Tên: lời", câu đố có đáp án, top đếm ngược, cặp A/B, bài đăng, bước nấu, mốc năm.
 */
export const RANDOM_STYLE = "random";
const NEEDS_OWN_SCRIPT = new Set<StyleId>(["chat", "quiz", "ranking", "versus", "social", "recipe", "timeline"]);

export const randomStyle = (pastedText = false): StyleId => {
  const pool = STYLE_IDS.filter((id) => id !== "plain" && !MUSIC_STYLES.has(id) && !(pastedText && NEEDS_OWN_SCRIPT.has(id)));
  return pool[Math.floor(Math.random() * pool.length)];
};

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
  /**
   * Kịch bản mẫu riêng của phong cách, viết bằng cú pháp dán lời (# tiêu đề, > dòng phụ,
   * dòng trống = cảnh mới, [nhãn], **câu nhấn**, ! số | chú thích).
   * Nút "📖 Điền lời mẫu" và khung "Xem cách viết lời" dùng đúng mẫu của phong cách đang chọn,
   * nên mỗi phong cách phải có một mẫu khác nhau, đúng luật viết của chính nó.
   */
  exampleScript: string;
};

export const STYLES: Record<StyleId, StyleMeta> = {
  caption: {
    id: "caption",
    label: "Phụ đề nổi bật",
    emoji: "💬",
    summary: "Ảnh nền, phụ đề to từng câu kiểu TikTok.",
    bestFor: "mẹo nhanh, lời khuyên, nội dung đọc thẳng vào camera, video bán hàng ngắn",
    examplePrompt: "Video 20 giây: 5 mẹo ngủ ngon hơn mà không cần thuốc.",
    exampleScript: `# Ngủ ngon hơn sau 3 đêm
> 5 mẹo không cần thuốc

Bạn trằn trọc tới 2 giờ sáng?
Ba thói quen nhỏ đổi được giấc ngủ.
Thử ngay tối nay nhé.

! 22h | giờ nên tắt đèn trắng
Tắt đèn lớn trước khi ngủ một tiếng.
Điện thoại để xa tầm với.

Phòng mát 26 độ là dễ ngủ nhất.
Dậy đúng giờ, kể cả cuối tuần.
Lưu lại để làm theo 3 đêm nhé!`,
  },
  vox: {
    id: "vox",
    label: "Cắt dán tài liệu",
    emoji: "✂️",
    summary: "Ảnh cắt dán trên giấy kẻ ô, nhãn highlight vàng, kiểu Vox.",
    bestFor: "giải thích sự kiện, lịch sử, kinh tế, vì sao X xảy ra, câu chuyện có nhân vật/đồ vật cụ thể",
    examplePrompt: "Vì sao Việt Nam trở thành nước xuất khẩu cà phê lớn thứ hai thế giới?",
    exampleScript: `# Vì sao cà phê Việt có mặt khắp nơi?
> Câu chuyện bắt đầu ở Tây Nguyên

[1857]
Người Pháp mang cây cà phê đầu tiên tới Việt Nam.
Đất bazan Tây Nguyên hợp giống robusta đến bất ngờ.

[Sau 1986]
Đổi mới cho nông dân tự trồng, tự bán.
Diện tích cà phê **tăng gấp nhiều lần** chỉ trong hai mươi năm.

[Hôm nay]
! 2 | thứ hạng xuất khẩu cà phê thế giới
Robusta Việt Nam nằm trong phần lớn ly cà phê hoà tan.
Rẻ, đậm, và đi được rất xa.`,
  },
  kinetic: {
    id: "kinetic",
    label: "Chữ động",
    emoji: "🔠",
    summary: "Chữ lớn bật theo nhịp đọc, nền màu mạnh, không cần ảnh.",
    bestFor: "câu nói truyền cảm hứng, tuyên ngôn, hook mạnh, quảng cáo ngắn, nội dung ít hình ảnh",
    examplePrompt: "Đoạn truyền cảm hứng 15 giây: kỷ luật luôn thắng động lực.",
    exampleScript: `# Kỷ luật thắng động lực
> 15 giây thôi

[Sự thật]
Động lực đến rồi đi.
**Kỷ luật ở lại.**

[Mỗi ngày]
Bạn không cần thấy hứng.
Bạn chỉ cần bắt đầu.

[Một năm sau]
! 1% | tốt hơn mỗi ngày
Một phần trăm mỗi ngày.
Bạn sẽ khác hẳn.

[Ngay bây giờ]
Đừng đợi thứ Hai.
Làm việc đầu tiên đi.`,
  },
  documentary: {
    id: "documentary",
    label: "Phim tài liệu",
    emoji: "🎞️",
    summary: "Ảnh toàn khung chuyển động chậm, hạt phim, chú thích địa điểm.",
    bestFor: "kể chuyện nghiêm túc, du lịch, địa danh, con người, điều tra, hồi ký",
    examplePrompt: "Kể chuyện hang Sơn Đoòng — hang động lớn nhất thế giới được phát hiện thế nào.",
    exampleScript: `# Hang Sơn Đoòng
> Nơi lớn nhất mà con người từng bước vào

[Quảng Bình · 1991]
Một người đi rừng trú mưa trước cửa hang lạ.
Tiếng gió hút từ trong sâu khiến anh không dám vào.

[2009]
Đoàn thám hiểm quay lại cùng chính người dẫn đường ấy.
Bên trong là dòng sông ngầm và **một khu rừng tự mọc**.

[Hôm nay]
! 200m | chiều cao trần hang
Sơn Đoòng chứa lọt cả một toà nhà bốn mươi tầng.
Mỗi năm chỉ vài trăm người được vào.`,
  },
  whiteboard: {
    id: "whiteboard",
    label: "Bảng trắng",
    emoji: "✏️",
    summary: "Giấy sổ tay, chữ bút dạ, gạch chân và khoanh tròn vẽ tay.",
    bestFor: "dạy học, hướng dẫn từng bước, giải thích khái niệm, công thức, học tập",
    examplePrompt: "Giải thích lãi kép bằng ví dụ gửi 1 triệu mỗi tháng trong 10 năm.",
    exampleScript: `# Lãi kép hoạt động thế nào?
> Hiểu trong 30 giây

[Bước 1]
Gửi 10 triệu, lãi 8% một năm.
Năm đầu bạn có thêm 800 nghìn.

[Bước 2]
Năm sau, lãi tính trên **cả gốc lẫn lãi**.
Tiền bắt đầu tự sinh ra tiền.

[Lãi kép]
! 21,6 triệu | sau 10 năm, không gửi thêm
Càng để lâu, đường cong càng dốc.
Lưu lại công thức này để ôn nhé.`,
  },
  tech: {
    id: "tech",
    label: "Công nghệ tối giản",
    emoji: "💠",
    summary: "Nền tối, thẻ kính mờ, con số chạy, ánh sáng neon.",
    bestFor: "công nghệ, sản phẩm số, số liệu, so sánh, AI, tài chính, startup",
    examplePrompt: "ChatGPT, Claude, Gemini: mỗi AI giỏi nhất ở việc gì?",
    exampleScript: `# Pin điện thoại tụt nhanh?
> Bốn chỉnh sửa trong 2 phút

[Nền 30%]
Ứng dụng chạy nền ăn pin nhiều nhất.
Tắt làm mới nền cho app ít dùng.
! 30% | pin tiết kiệm được mỗi ngày

[Màn hình]
Giảm độ sáng tự động và bật nền tối.
Màn OLED tắt hẳn điểm ảnh màu đen.

[Sạc 20–80%]
Giữ pin trong khoảng **20 đến 80 phần trăm**.
Sau hai năm, pin chai chậm hơn hẳn.`,
  },
  plain: {
    id: "plain",
    label: "Video gốc",
    emoji: "🎬",
    summary: "Giữ nguyên ảnh/video, cắt cảnh gọn, không hiệu ứng — để sửa clip có sẵn.",
    bestFor: "video quay sẵn người dùng tải lên, vlog, ghép clip, khi hình đã đẹp và không cần đồ hoạ",
    examplePrompt: "Ghép các clip tôi vừa tải lên thành vlog 30 giây, cắt gọn và thêm phụ đề.",
    exampleScript: `# Một ngày ở xưởng gốm
> Clip tự quay, chỉ cắt gọn

Sáng sớm, lò vẫn còn ấm từ đêm qua.
Mẻ men mới pha trước khi trời nắng.

Bàn xoay chạy, đất lên hình trong ba phút.
Tay ướt, nhịp đều, không vội.

Chiều nay ra lò mười hai chiếc.
Hỏng hai, còn mười.`,
  },
  bold: {
    id: "bold",
    label: "Phụ đề từng từ",
    emoji: "🟨",
    summary: "Chữ in hoa rất đậm viền đen, bật từng cụm 2–4 từ, từ đang đọc tô vàng — kiểu Hormozi.",
    bestFor: "nói thẳng vào camera, bài học kinh doanh, động lực, lời khuyên gắt, bán hàng, podcast cắt ngắn",
    examplePrompt: "3 sai lầm khiến bạn mãi không tiết kiệm được tiền — nói thẳng, gắt.",
    exampleScript: `# Đừng chăm chỉ hơn
> Hãy chọn đúng việc

[Sự thật]
Bạn không thiếu thời gian.
Bạn thiếu **một việc quan trọng nhất**.

[Sai lầm số 1]
Làm mười việc nhỏ cho thấy mình bận.
Không việc nào đủ lớn để đổi đời.

[Bài học]
! 80% | kết quả đến từ 20% việc
Chọn một việc, làm đến cùng.
Chín việc kia để sau.

[Làm ngay]
Tối nay viết ra việc đó.
Sáng mai làm nó đầu tiên.`,
  },
  chat: {
    id: "chat",
    label: "Tin nhắn",
    emoji: "💬",
    summary: "Kể chuyện bằng giao diện nhắn tin: bong bóng hai phía, đang gõ…, mốc thời gian.",
    bestFor: "kể chuyện, drama, tình huống dở khóc dở cười, hội thoại, chuyện tình cảm, tin nhắn lừa đảo",
    examplePrompt: "Kể chuyện qua tin nhắn: mẹ nhắn nhầm lời khen con vào nhóm Zalo của lớp.",
    exampleScript: `# Tin nhắn lúc nửa đêm
> Hú hồn chưa từng có

[Hôm qua 23:14]
Linh: Mày còn thức không?
Tôi: Còn, sao thế?
Linh: Đừng về nhà tối nay.
Tôi: Đùa à?

[0:02]
Linh: Tao vừa thấy xe bố mày ở bệnh viện.
Tôi: Bố tao đi công tác mà.
Linh: Vậy người ngồi ghế lái là ai?

[Sáng hôm sau]
Tôi: Tao gọi cho bố rồi.
Tôi: Ông ấy **về từ tối qua**.
Linh: Vậy cái xe đó…
Tôi: Là của chú tao. Hú hồn.`,
  },
  news: {
    id: "news",
    label: "Bản tin nóng",
    emoji: "📺",
    summary: "Nhãn TRỰC TIẾP, dải tiêu đề dưới màn hình, chữ chạy ở đáy — kiểu bản tin truyền hình.",
    bestFor: "tin tức, cập nhật, sự kiện vừa xảy ra, thông báo chính thức, tóm tắt tin trong ngày",
    examplePrompt: "Bản tin 30 giây: mẹo giữ nhà mát trong đợt nắng nóng đầu hè.",
    exampleScript: `# Giá xăng giảm lần thứ ba liên tiếp
> Bản tin kinh tế chiều nay

[KINH TẾ]
Chiều nay, liên bộ Công Thương - Tài chính công bố giá bán lẻ mới.
Xăng RON 95 giảm **420 đồng một lít**.

[SỐ LIỆU]
! 3 | kỳ điều hành giảm liên tiếp
Dầu diesel giảm 300 đồng một lít.
Quỹ bình ổn không trích thêm trong kỳ này.

[TIẾP THEO]
Kỳ điều hành kế tiếp diễn ra sau một tuần.
Doanh nghiệp vận tải cho biết sẽ xem xét giảm cước.`,
  },
  retro: {
    id: "retro",
    label: "Băng VHS",
    emoji: "📼",
    summary: "Hình như băng video cũ: nhoè màu, vạch quét, nhiễu, chữ PLAY/REC và ngày giờ máy quay.",
    bestFor: "hoài niệm, chuyện ngày xưa, ký ức tuổi thơ, meme, kể chuyện bí ẩn, thập niên 80–2000",
    examplePrompt: "Bạn còn nhớ tuổi thơ 9x: băng cát-xét, tem xe và phim hoạt hình 5 giờ chiều?",
    exampleScript: `# Cuộn băng của nhà mình
> Hồi đó Tết nào cũng quay

[NĂM 1998]
Hồi đó nhà nào có máy quay là cả xóm kéo sang.
Băng sáu mươi phút, quay hụt là mất luôn.

[TẾT 2001]
Mẹ quay cảnh gói bánh, tay run nên hình rung.
Cả nhà **cười vào ống kính** mà không ai biết đang bị quay.

[HÔM NAY]
! 30 năm | cuộn băng vẫn chạy được
Tôi số hoá lại cuộn băng cuối tuần trước.
Bạn còn giữ cuộn băng nào không?`,
  },
  cinematic: {
    id: "cinematic",
    label: "Điện ảnh",
    emoji: "🎥",
    summary: "Viền đen điện ảnh, chỉnh màu phim, phụ đề chữ có chân, câu nhấn hiện như tiêu đề trailer.",
    bestFor: "kể chuyện cảm xúc, trailer, du lịch, thương hiệu, chân dung con người, câu chuyện giàu không khí",
    examplePrompt: "Một ngày của người thợ đóng thuyền cuối cùng ở Hội An — kể như trailer phim.",
    exampleScript: `# Người cuối cùng giữ lửa
> Một làng nghề bên sông

[Hội An, 5 giờ sáng]
Bến sông chưa có ai, chỉ có khói từ lò gốm.
Ông Tư nhóm lửa như ba mươi năm trước.

[Ba mươi năm sau]
Lò bên cạnh đóng cửa từ lâu, học trò cũ đã lên phố.
Ông là **người cuối cùng** còn giữ một mẻ mỗi tuần.

[Cuối ngày]
! 30 năm | một mình giữ lò
Lửa tắt, tro còn ấm tới sáng hôm sau.
Và nghề vẫn còn đó.`,
  },
  comic: {
    id: "comic",
    label: "Truyện tranh",
    emoji: "💥",
    summary: "Ảnh trong khung truyện viền đậm, chấm halftone, hộp lời dẫn vàng, câu nhấn nổ kiểu BÙM!",
    bestFor: "chuyện hài, tình huống đời thường phóng đại, siêu anh hùng, trẻ em, meme, kể chuyện vui có nhân vật",
    examplePrompt: "Siêu anh hùng văn phòng: một mình cứu deadline lúc 5 giờ chiều thứ Sáu.",
    exampleScript: `# Deadline tấn công!
> Một ngày ở văn phòng

[LÚC 4 GIỜ CHIỀU]
Mọi thứ đang yên bình.
Cà phê còn nóng, file còn nguyên.

[4 GIỜ 01 PHÚT]
Sếp nhắn: sáng mai họp nhé.
Tim ngừng một nhịp.

[TRONG KHI ĐÓ…]
! 12% | pin laptop còn lại
Máy kêu một tiếng rồi **sập nguồn**.
Không ai kịp bấm lưu.

[3 PHÚT SAU]
File tự phục hồi từ bản nháp.
Anh hùng thầm lặng tên là tự động lưu.`,
  },
  social: {
    id: "social",
    label: "Bài đăng MXH",
    emoji: "🐦",
    summary: "Thẻ bài đăng kiểu Reddit/X trên nền mờ, chữ hiện dần theo giọng đọc, lượt thích nhảy số.",
    bestFor: "Reddit story, tâm sự ẩn danh, drama công sở, câu hỏi gây tranh luận, thú nhận, chuyện kể ngôi thứ nhất",
    examplePrompt: "Tâm sự ẩn danh: tôi phát hiện đồng nghiệp làm ít hơn nhưng lương cao gấp đôi.",
    exampleScript: `# Tôi đọc trộm nhóm chat của nhân viên
> Và thấy biệt danh họ đặt cho mình

[tâm sự công sở]
Tôi 34 tuổi, quản lý một nhóm sáu người.
Hôm qua một bạn để quên máy, cửa sổ chat vẫn mở.

[tâm sự công sở]
! 6 | người trong nhóm chat
Họ gọi tôi là **cái máy in deadline**.
Tôi ngồi đọc hết hai trăm tin rồi tắt máy.

[tâm sự công sở]
Sáng nay tôi huỷ buổi họp 7 giờ sáng hàng tuần.
Không ai hỏi vì sao.
Nếu là bạn, bạn có nói ra không?`,
  },
  quiz: {
    id: "quiz",
    label: "Câu đố",
    emoji: "🧠",
    summary: "Mỗi cảnh một câu hỏi, đồng hồ đếm ngược, lật đáp án xanh — kéo người xem bình luận.",
    bestFor: "đố vui, kiểm tra kiến thức, bạn có biết, thử thách, trắc nghiệm, học từ vựng, kêu gọi bình luận",
    examplePrompt: "Đố vui 4 câu về địa lý Việt Nam, mỗi câu 3 giây suy nghĩ rồi hiện đáp án.",
    exampleScript: `# Bạn trả lời được mấy câu?
> 3 câu về Việt Nam

[CÂU 1]
Câu cuối khó nhất!
Cố đô cuối cùng của Việt Nam là thành phố nào?
Suy nghĩ 3 giây nhé…
Đáp án là **Huế**.

[CÂU 2]
Đỉnh núi cao nhất Việt Nam tên là gì?
Đoán nhanh nào…
Đáp án là **Fansipan**.

[CÂU KHÓ]
Sông nào chảy qua trung tâm Hà Nội?
Đáp án của bạn là gì?
Đáp án là **sông Hồng**.
Bạn đúng mấy câu? Bình luận nhé!`,
  },
  ranking: {
    id: "ranking",
    label: "Top xếp hạng",
    emoji: "🏆",
    summary: "Đếm ngược #5 → #1, số hạng khổng lồ, bảng xếp hạng lấp dần theo từng cảnh.",
    bestFor: "top list, xếp hạng, so sánh nhiều thứ, món ăn, địa điểm, sản phẩm, kỷ lục, đếm ngược",
    examplePrompt: "Top 5 món ăn đường phố Việt Nam du khách mê nhất, đếm ngược từ 5 về 1.",
    exampleScript: `# Top 3 món vỉa hè Hà Nội
> Số 1 gây tranh cãi nhất

[#3 Bánh cuốn]
Hạng 3: bánh cuốn Thanh Trì.
Tráng mỏng như tờ giấy, ăn nóng mới ngon.
! 25K | một suất đầy đủ

[#2 Bún chả]
Hạng 2: bún chả than hoa.
Khói thịt nướng **dẫn đường từ đầu ngõ**.

[#1 Phở bò]
Hạng 1: phở bò gánh sáng sớm.
Nước dùng ninh từ đêm, thơm mùi quế hồi.
Số 1 của bạn là gì? Bình luận nhé!`,
  },
  book: {
    id: "book",
    label: "Mở sách",
    emoji: "📖",
    summary: "Cuốn sách bìa da mở ra trên bàn gỗ, mỗi cảnh một trang in có tranh minh hoạ, lật trang 3D.",
    bestFor: "tóm tắt sách, bài học từ một cuốn sách, lịch sử, truyền thuyết, danh nhân, kể chuyện có chương hồi, trích dẫn hay",
    examplePrompt: "Tóm tắt 3 bài học đắt giá nhất trong cuốn Nhà giả kim.",
    exampleScript: `# Nhà giả kim
> 3 bài học trong 60 giây

[Chương 1 · Giấc mơ]
Cậu bé chăn cừu mơ thấy kho báu dưới chân kim tự tháp.
Cậu bán cả đàn cừu để lên đường.

[Chương 2 · Dấu hiệu]
Suốt hành trình, cuộc đời gửi cho cậu những dấu hiệu nhỏ.
Chỉ ai **chịu lắng nghe** mới nhận ra.

[Chương 3 · Kho báu]
! 1 câu | đáng nhớ nhất cuốn sách
Kho báu hoá ra nằm ngay nơi cậu bắt đầu.
Nhưng không có chuyến đi, cậu sẽ chẳng bao giờ biết.`,
  },
  storybook: {
    id: "storybook",
    label: "Sách truyện",
    emoji: "🧸",
    summary: "Sách tranh thiếu nhi: tranh minh hoạ khung bo tròn, chữ to, từ đang đọc sáng lên, lật trang cuộn góc.",
    bestFor: "truyện cổ tích, truyện thiếu nhi, kể chuyện trước giờ ngủ, bài học đạo đức cho bé, ngụ ngôn, chuyện con vật",
    examplePrompt: "Kể chuyện cổ tích ngắn cho bé: chú thỏ con học cách chia sẻ.",
    exampleScript: `# Thỏ con biết chia sẻ
> Truyện kể trước giờ ngủ

[Ngày xửa ngày xưa]
Trong khu rừng nhỏ có một chú thỏ con.
Thỏ có một giỏ cà rốt thật to.

[Một buổi sáng]
Bạn sóc đói bụng đi ngang qua.
Thỏ ngập ngừng, rồi **chìa ra một củ**.

[Từ hôm đó]
Cả khu rừng chơi với thỏ vui hơn.
Chia sẻ làm niềm vui lớn gấp đôi.
Chúc bé ngủ ngon nhé!`,
  },
  pen: {
    id: "pen",
    label: "Thư tay",
    emoji: "✒️",
    summary: "Tờ thư trên bàn gỗ, bút máy viết từng chữ bằng mực, câu nhấn đổi màu mực và gạch chân lượn sóng.",
    bestFor: "lá thư gửi ai đó, tâm sự, nhật ký, lời cảm ơn, kỷ niệm, lời khuyên chân thành, kể chuyện ngôi thứ nhất",
    examplePrompt: "Lá thư gửi bản thân 10 năm trước: những điều ước gì mình biết sớm hơn.",
    exampleScript: `# Gửi tôi của 10 năm trước
> Những điều ước gì mình biết sớm hơn

[Hà Nội, một tối mưa]
Chào cậu, mình là cậu của mười năm sau.
Có vài điều mình muốn kể.

[Điều thứ nhất]
Đừng sợ bắt đầu từ con số không.
Ai cũng từng **vụng về lúc đầu**.

[Điều thứ hai]
! 10 phút | đọc sách mỗi tối
Nghe thì ít, nhưng mười năm là cả một thư viện.

[Thân ái]
Cảm ơn cậu đã không bỏ cuộc.
Hẹn gặp ở phía trước nhé.`,
  },
  neon: {
    id: "neon",
    label: "Đêm neon",
    emoji: "🌃",
    summary: "Phố đêm tím xanh, chữ ống neon bật chập chờn, câu nhấn thành biển hiệu phát sáng.",
    bestFor: "đời sống về đêm, âm nhạc, gaming, thành phố, động lực đêm khuya, K-pop, tiệc tùng",
    examplePrompt: "Sài Gòn lúc 2 giờ sáng: những góc phố chỉ dân cú đêm mới biết.",
    exampleScript: `# Sài Gòn lúc nửa đêm
> Những điều chỉ dân cú đêm mới biết

[QUẬN 1]
! 24/7 | thành phố không tắt đèn
Sài Gòn không ngủ, chỉ đổi ca thôi.

[2 GIỜ SÁNG]
Đừng xem thường những **con phố vắng** sau nửa đêm.
Quán ốc vẫn đông, nhạc vẫn còn lớn.

[OPEN]
Đây là lúc thành phố **thật sự sống**.
Đêm nay bạn đang ở đâu?`,
  },
  scrapbook: {
    id: "scrapbook",
    label: "Album kỷ niệm",
    emoji: "📸",
    summary: "Bảng bần treo tường, mỗi cảnh một tấm polaroid dán băng keo washi, lời viết tay trên thẻ ghi chú, giấy note vàng cho câu nhấn.",
    bestFor: "du lịch, kỷ niệm, gia đình, bạn bè, kỷ niệm yêu nhau, tổng kết năm, \"một năm nhìn lại\"",
    examplePrompt: "Một năm nhìn lại của nhà mình: những chuyến đi và khoảnh khắc đáng nhớ nhất.",
    exampleScript: `# Một năm nhìn lại của nhà mình
> 12 tháng, 5 thành phố, 1 lời hứa

[Tháng 1 · Hà Nội]
Tấm ảnh này suýt nữa không tồn tại.
Cả nhà dậy từ 4 giờ sáng chỉ để ngắm **bình minh** Hồ Tây.

[Tháng 4 · Đà Lạt]
Lần đầu con thấy sương mù dày đến thế.
Con bảo: "Mây rơi xuống đất rồi mẹ ơi!"

[Tháng 7 · Phú Quốc]
! 5 | thành phố đã đi qua
Mùa hè ấy, bố học bơi cùng con.
Và **không ai bị sặc nước** cả.

[Tháng 12 · Ở nhà]
Có những buổi tối chẳng kịp chụp tấm nào.
Hẹn năm sau, vẫn **đủ cả nhà** nhé.`,
  },
  magazine: {
    id: "magazine",
    label: "Tạp chí",
    emoji: "📰",
    summary: "Mỗi cảnh là một trang bìa tạp chí thời trang: ảnh tràn trang, tên tạp chí chữ có chân cực đậm, tít bìa khối màu, tem MỚI!, mã vạch.",
    bestFor: "thời trang, làm đẹp, người nổi tiếng, phong cách sống, xu hướng mùa mới, giới thiệu sản phẩm, bí quyết phối đồ/chăm da",
    examplePrompt: "Video 25 giây: 5 xu hướng làm đẹp mùa thu năm nay, giọng biên tập viên tạp chí.",
    exampleScript: `# 5 xu hướng làm đẹp mùa thu
> Bí quyết từ các chuyên gia trang điểm

[Xu hướng]
Mùa thu này, cả phố đều mê lớp nền mỏng nhẹ.

[Làm đẹp]
! 5 | bí quyết giữ da căng bóng
Dưỡng ẩm hai lớp cho **da căng bóng** cả ngày.

Đừng chạy theo món đắt tiền, hãy chọn món hợp da.

[Thời trang]
Son màu gạch cháy đang dẫn đầu mọi sàn diễn.

[Phong cách]
Và nhớ rằng **tự tin là đẹp nhất**.`,
  },
  timeline: {
    id: "timeline",
    label: "Dòng thời gian",
    emoji: "🕰️",
    summary: "Trục thời gian cuộn qua từng mốc, năm ghi thật lớn, ảnh trong thẻ gắn vào mốc.",
    bestFor: "lịch sử, tiểu sử, lịch sử công ty/thương hiệu, sự tiến hoá của một thứ, \"từ năm … đến nay\", trình tự các giai đoạn",
    examplePrompt: "Hành trình của chiếc điện thoại di động: từ cục gạch 1983 đến smartphone hôm nay.",
    exampleScript: `# Điện thoại đã thay đổi thế nào?
> Bốn mươi năm, bốn cột mốc

[1983]
Chiếc điện thoại di động đầu tiên nặng gần một ký.
Sạc mười tiếng chỉ để gọi ba mươi phút.

[Thập niên 90]
Điện thoại nhỏ lại vừa lòng bàn tay.
Tin nhắn SMS ra đời và **thay đổi cách ta trò chuyện**.

[2007]
Màn hình cảm ứng xoá sạch bàn phím vật lý.
Internet bắt đầu nằm gọn trong túi áo.

[Hôm nay]
! 6,8 tỷ | người đang dùng smartphone
Điện thoại là máy ảnh, ví tiền và bản đồ.
Bạn đang cầm cả bốn mươi năm trên tay.`,
  },
  recipe: {
    id: "recipe",
    label: "Công thức nấu ăn",
    emoji: "🍳",
    summary: "Thẻ công thức trên bàn bếp: mỗi cảnh một bước có số to, ảnh món bo góc, chấm tiến độ tích dần và giấy nhớ mẹo.",
    bestFor: "nấu ăn, công thức món, pha chế đồ uống, làm bánh, DIY, đồ thủ công, hướng dẫn từng bước, chu trình skincare",
    examplePrompt: "Hướng dẫn làm bánh xèo miền Tây giòn rụm tại nhà trong 60 giây.",
    exampleScript: `# Bánh xèo miền Tây
> 4 người ăn · 30 phút · Dễ làm

[Nguyên liệu]
300g bột gạo, 1 lon nước cốt dừa.
Nửa muỗng bột nghệ, hành lá, tôm, thịt ba chỉ.
Giá đỗ và rau sống ăn kèm.

[Pha bột]
! 30 phút | cho bột nghỉ
Pha bột với nước cốt dừa và bột nghệ.
Để bột nghỉ **ít nhất 30 phút** cho bột nở.

[Đổ bánh]
! 200g | tôm tươi
Làm nóng chảo thật kỹ rồi mới đổ bột.
Đậy nắp, giữ **lửa vừa** cho bánh tự giòn.

[Thưởng thức]
Cuốn bánh với rau sống, chấm nước mắm chua ngọt.
Làm thử cuối tuần này nhé!`,
  },
  terminal: {
    id: "terminal",
    label: "Màn hình code",
    emoji: "💻",
    summary: "Cửa sổ terminal gõ từng câu sau dấu nhắc $, ảnh bật ra trong cửa sổ preview, số liệu thành thanh tiến độ ASCII.",
    bestFor: "lập trình, mẹo công nghệ, AI, an ninh mạng, sự thật về hacker, hướng dẫn phần mềm",
    examplePrompt: "Video 30 giây cảnh báo 4 lỗi bảo mật tài khoản mà ai cũng mắc, kèm cách sửa nhanh.",
    exampleScript: `# 4 lỗi bảo mật ai cũng mắc
> Lỗi số 3 mất tài khoản trong 1 phút

[lỗi #1: mật khẩu yếu]
Mật khẩu 8 ký tự bị bẻ khoá trong chưa tới 1 giờ.
Hacker không đoán, máy của họ thử hàng tỷ lần mỗi giây.

! 81% | vụ rò rỉ do mật khẩu yếu
81% vụ rò rỉ dữ liệu bắt đầu từ mật khẩu yếu.
Vậy mà ta vẫn dùng một mật khẩu cho mọi tài khoản.

[cách sửa]
Cách sửa rất đơn giản:
**Bật xác thực hai lớp** ngay hôm nay.

[bước 2]
! 12 tỷ | mật khẩu đã bị lộ
Dùng trình quản lý mật khẩu, mỗi nơi một mật khẩu riêng.
Lưu lại để làm ngay tối nay.`,
  },
  pixel: {
    id: "pixel",
    label: "Game 8-bit",
    emoji: "👾",
    summary: "Màn hình game RPG cổ điển: ảnh điểm ảnh hoá trong cửa sổ game, hộp thoại gõ chữ, thanh XP, xu và popup CRITICAL!.",
    bestFor: "gaming, thử thách, học mà chơi, sự thật thú vị, \"level up\" bản thân, thói quen tốt, nội dung cho trẻ em",
    examplePrompt: "Thử thách 21 ngày level up bản thân: 3 thói quen nhỏ ai cũng làm được.",
    exampleScript: `# Level up bản thân
> Thử thách 21 ngày

[Khởi động]
Nhiệm vụ hôm nay: nâng cấp chính bạn.
Mỗi thói quen là một màn chơi.

[Level 1]
! 5 phút | dọn giường mỗi sáng
Việc nhỏ đầu ngày mở khoá cả ngày dài.

[Level 2]
Uống một cốc nước ngay khi thức dậy.
Cơ thể bạn sẽ **hồi đầy năng lượng**.

[Boss cuối]
! 21 ngày | để thói quen thành tự động
Kiên trì đủ lâu là thắng.
Bạn đang ở level mấy? Bình luận nhé!`,
  },
  versus: {
    id: "versus",
    label: "So sánh đối đầu",
    emoji: "⚔️",
    summary: "Chia đôi màn hình hai phe, huy hiệu VS ở giữa, bảng điểm và con dấu phán quyết.",
    bestFor: "so sánh hai lựa chọn, cái này vs cái kia, lầm tưởng vs sự thật, trước/sau, rẻ vs đắt, \"nên chọn cái nào\"",
    examplePrompt: "So sánh thuê nhà và mua nhà trả góp cho người trẻ: nên chọn cái nào?",
    exampleScript: `# Thuê nhà hay mua trả góp?
> Người trẻ nên chọn bên nào

[Thuê nhà]
! 6 triệu | tiền nhà mỗi tháng
Về chi phí, thuê nhà chỉ tốn sáu triệu mỗi tháng.

[Mua trả góp]
! 15 triệu | tiền góp mỗi tháng
Mua trả góp phải gánh mười lăm triệu, **gấp hơn hai lần**.

[Thuê nhà]
Về tự do, thuê nhà muốn chuyển là chuyển.
Đổi việc, đổi thành phố **không vướng bận**.

[Mua trả góp]
Nhưng tiền thuê trả đi là mất hẳn.
Tiền góp thì dần thành **tài sản của bạn**.

[Kết luận]
Chưa ổn định thì thuê, để dành tiền.
Thu nhập vững rồi, **mua mới là thắng**.`,
  },
  luxury: {
    id: "luxury",
    label: "Tối giản sang trọng",
    emoji: "🤍",
    summary: "Trang giấy ngà: ảnh đặt như bản in phòng tranh, chữ có chân hiện từng dòng giữa hai gạch vàng mảnh, hoà tan chậm rãi.",
    bestFor: "trích dẫn, bất động sản, spa và wellness, trang sức, thời trang, câu chuyện thương hiệu, cưới hỏi, giới thiệu sản phẩm cao cấp, nội dung chậm và suy ngẫm",
    examplePrompt: "Giới thiệu bộ sưu tập trang sức ngọc trai mới theo tinh thần sống chậm, sang trọng tối giản.",
    exampleScript: `# Ngọc trai của biển lặng
> Bộ sưu tập Thu 2026

[Chất liệu]
Mỗi viên ngọc cần ba năm để thành hình trong làn nước yên tĩnh.
Không vội vàng, không khuôn mẫu.

[Tay nghề]
! 18K | vàng hồng chế tác thủ công
Người thợ chỉ giữ lại những viên **sáng nhất dưới nắng sớm**.

[Lời nhắn]
Sang trọng không nằm ở vẻ phô trương.
Mà ở **sự tĩnh lặng** bạn mang theo mỗi ngày.

[Dành cho bạn]
Một món quà nhỏ cho những khoảnh khắc đáng nhớ.
Hẹn bạn tại cửa hàng, vào một buổi sáng chậm.`,
  },
  horror: {
    id: "horror",
    label: "Truyện ma",
    emoji: "👻",
    summary: "Không khí nửa đêm rợn người: ảnh ám lục lạnh, sương trôi, đèn chập chờn, phụ đề chữ có chân run nhẹ và cú hù chữ đỏ máu.",
    bestFor: "truyện ma, chuyện rùng rợn, bí ẩn chưa lời giải, truyền thuyết đô thị, chuyện lạ có thật, kể chuyện hồi hộp",
    examplePrompt: "Kể chuyện căn hộ số 13 không ai dám thuê — người thuê cuối cùng chỉ ở được ba đêm.",
    exampleScript: `# Căn hộ số 13 không ai dám thuê
> Người thuê cuối cùng chỉ ở được ba đêm

[3:00 SÁNG · Nhà số 13]
Căn hộ số 13 bỏ trống suốt mười năm nay.
Hàng xóm dặn: đừng bao giờ gõ cửa phòng đó.

[Đêm thứ ba]
Cô nghe tiếng gõ cửa đúng ba giờ sáng.
Nhưng ngoài hành lang **không có ai cả**.

! 13 | dấu tay trên kính
Sáng hôm sau, cô đếm được mười ba dấu tay.
Và chúng in từ **phía bên trong**.

[Hôm nay]
Căn hộ vẫn để trống. Bạn có dám ở không?`,
  },

  anime: {
    id: "anime",
    label: "Anime",
    emoji: "🌸",
    summary: "Năng lượng opening anime: ảnh tươi có loé sáng, chém chéo đổi cảnh, phụ đề trắng viền màu bật nảy, câu nhấn thành khung impact có tia tốc độ và rung.",
    bestFor: "kể chuyện kịch tính, giới thiệu nhân vật, fan anime/game, giới trẻ, câu chuyện \"hành trình trưởng thành\" truyền động lực",
    examplePrompt: "Hành trình của nhân vật chính: từ kẻ thua trắng ngày đầu đến nhà vô địch.",
    exampleScript: `# Từ kẻ thua cuộc đến nhà vô địch
> Arc 1: Hành trình của nhân vật chính

[Tập 1 · Khởi đầu]
Không ai tin cậu ấy làm được.
Ngày đầu tiên, Minh thua trắng cả ba trận.

[Arc 2 · Khổ luyện]
! 9.000 | giờ khổ luyện mỗi năm
Mỗi sáng năm giờ, cậu ấy lại ra sân một mình.

[Trận chung kết]
Bị dẫn trước, nhưng Minh **không bỏ cuộc**.
Và rồi cậu ấy lật ngược thế cờ.

Hành trình của bạn bắt đầu từ hôm nay.
To be continued...`,
  },
  podcast: {
    id: "podcast",
    label: "Podcast",
    emoji: "🎙️",
    summary: "Clip podcast trong phòng thu tối ấm: thẻ tập có ảnh khách mời, sóng âm nhảy theo lời đọc, thanh tiến độ và thẻ trích dẫn sáng dần từng từ.",
    bestFor: "clip podcast, phỏng vấn, talkshow, câu nói đáng nhớ, bình luận, chia sẻ quan điểm, nội dung giọng nói là chính",
    examplePrompt: "Cắt một đoạn podcast 45 giây: chuyên gia tâm lý giải thích vì sao người trẻ hay kiệt sức.",
    exampleScript: `# Vì sao người trẻ hay kiệt sức?
> Tập 12 · Trò chuyện cùng chuyên gia tâm lý

[Khách mời: ThS. Lan Anh]
Tôi gặp rất nhiều bạn trẻ kiệt sức mà không hiểu vì sao.
Họ làm việc chăm chỉ, nhưng lúc nào cũng thấy mình chưa đủ.

[Phần 1]
! 1/3 | người trẻ từng kiệt sức
Cứ ba người trẻ thì có một người từng kiệt sức.
Nguyên nhân lớn nhất là **so sánh bản thân** với người khác.

[Phần 2]
Mạng xã hội chỉ cho bạn thấy phần đẹp nhất của người ta.
Hãy **nghỉ ngơi trước khi kiệt sức**, đừng đợi cơ thể lên tiếng.

[Lời kết]
Bạn không cần giỏi hơn ai, chỉ cần tốt hơn hôm qua.
Nghe trọn tập 12 và theo dõi kênh để không bỏ lỡ tập sau nhé.`,
  },
  map: {
    id: "map",
    label: "Bản đồ hành trình",
    emoji: "🗺️",
    summary: "Bản đồ minh hoạ vẽ tay: máy bay kéo đường gạch nối từng điểm dừng, ghim cắm xuống có nhãn địa danh, ảnh thành bưu thiếp có tem, con số quãng đường gắn vào chặng.",
    bestFor: "lịch trình du lịch, phượt, road trip, food tour theo vùng, sự thật địa lý, hành trình lịch sử, đi từ A đến B",
    examplePrompt: "Kể lại chuyến food tour 3 miền trong 7 ngày: Hà Nội, Hội An, Cần Thơ — mỗi nơi một món phải thử.",
    exampleScript: `# Food tour 3 miền trong 7 ngày
> Hà Nội · Hội An · Cần Thơ

[Hà Nội · Ngày 1]
Sáng đầu tiên, bát phở bò nóng hổi ở phố cổ.
Chiều ra Tạ Hiện làm đĩa nem chua rán.

[Hội An · Ngày 3]
! 800 km | bay chưa tới 2 tiếng
Bay vào Đà Nẵng rồi chạy xe ra phố Hội.
Tô cao lầu ở đây **chỉ 35 nghìn**.

[Đèo Hải Vân]
Dừng chân giữa đèo, mây trôi ngang mặt.

[Cần Thơ · Ngày 6]
! 900 km | xe khách giường nằm
Năm giờ sáng đã ra chợ nổi Cái Răng.
Bún riêu ăn ngay **trên ghe**.

[Về nhà · Ngày 7]
! 1.700 km | tổng quãng đường
Bảy ngày, ba miền, mười hai món. Bạn muốn đi chặng nào?`,
  },
  sport: {
    id: "sport",
    label: "Thể thao",
    emoji: "🏆",
    summary: "Giao diện truyền hình thể thao: bảng tỉ số LIVE, dải phụ đề chéo, bảng tên cầu thủ, thống kê trận và cú nổ \"GOAL!\" khi tới pha đỉnh.",
    bestFor: "tin bóng đá, highlight trận đấu, thử thách thể hình, chuyện vận động viên, kỷ lục và thành tích, dự đoán tỉ số",
    examplePrompt: "Kể lại pha ghi bàn phút bù giờ giúp tuyển Việt Nam thắng Thái Lan ở vòng loại, giọng bình luận viên sôi nổi.",
    exampleScript: `# Siêu phẩm phút bù giờ ở Mỹ Đình
> Việt Nam gặp Thái Lan · Vòng loại

[PHÚT 90+2]
Tỉ số vẫn là một đều khi trận đấu sắp khép lại.
Cả sân Mỹ Đình nín thở chờ một phép màu.

[#10 · Quang Hải]
! 25m | khoảng cách cú sút
Quang Hải nhận bóng, xoay người và tung cú sút xa.
Bóng găm thẳng góc chết, **vào rồi**!

[Việt Nam]
! 72% | kiểm soát bóng
Cả hiệp hai, Việt Nam kiểm soát bóng áp đảo.
Ba điểm này là **xứng đáng**.

[VÒNG 3]
Việt Nam vươn lên dẫn đầu bảng sau ba lượt trận.
Trận tới gặp Indonesia, bạn dự đoán tỉ số bao nhiêu?`,
  },
  finance: {
    id: "finance",
    label: "Biểu đồ tài chính",
    emoji: "📈",
    summary: "Màn hình giao dịch nền tối: biểu đồ giá tự vẽ suốt video, ảnh trong thẻ tin, con số trong phụ đề tự tô xanh/đỏ, câu nhấn thành cú vọt giá có bong bóng chú thích.",
    bestFor: "chứng khoán, crypto, tài chính cá nhân, tin kinh tế – doanh nghiệp, báo cáo lợi nhuận, số liệu tăng giảm",
    examplePrompt: "Video 30 giây tóm tắt phiên VN-Index vượt 1.300 điểm: khối ngoại mua ròng, nhóm ngân hàng dẫn dắt, bất động sản vẫn giảm.",
    exampleScript: `# VN-Index vượt 1.300 điểm
> Nhà đầu tư nên làm gì lúc này?

[VN-INDEX]
Phiên sáng nay VN-Index tăng 25 điểm, thanh khoản đạt 30 nghìn tỷ.
Đây là mức cao nhất kể từ đầu năm.

[KHỐI NGOẠI]
Khối ngoại quay lại mua ròng 1.200 tỷ đồng sau ba tháng bán liên tục.
! 1.200 tỷ | khối ngoại mua ròng

[NGÂN HÀNG]
Nhóm ngân hàng dẫn dắt, nhiều mã **lập đỉnh mới** trong phiên.

[CẢNH BÁO]
Nhưng cổ phiếu bất động sản vẫn giảm 8% trong tuần.
! -8% | bất động sản trong tuần

[CHIẾN LƯỢC]
Đừng mua đuổi, hãy chia nhỏ vốn và **giữ kỷ luật** với điểm cắt lỗ.`,
  },
  watercolor: {
    id: "watercolor",
    label: "Tranh màu nước",
    emoji: "🎨",
    summary: "Mỗi cảnh là một bức tranh màu nước loang trên giấy vẽ, phụ đề viết tay hiện từng từ như mực thấm.",
    bestFor: "thơ, trích dẫn, lời hay ý đẹp, suy ngẫm cảm xúc, kỷ niệm du lịch, nghệ thuật – văn hoá, kể chuyện nhẹ nhàng",
    examplePrompt: "Video 25 giây: vài dòng tản văn về mùa thu Hà Nội và lời nhắn hãy sống chậm lại.",
    exampleScript: `# Mùa thu về trên phố cũ
> Vài dòng gửi những ngày bình yên

[Hà Nội, tháng Mười]
Có những buổi chiều rất lặng.
Gió đi qua phố, **nhẹ như một cánh lá**.

! 365 | ngày thương nhớ
Ta đi qua bao mùa lá đổ.
Mỗi mùa để lại một điều dịu dàng.

[Lời hay ý đẹp]
Đừng vội buồn vì những điều đã cũ.
Hãy **sống chậm lại**, và thương mình hơn.`,
  },
  story: {
    id: "story",
    label: "Story điện thoại",
    emoji: "📱",
    summary: "Mỗi cảnh là một khung story trên điện thoại: thanh tiến độ chia đoạn, avatar vòng gradient, phụ đề là nhãn chữ trên khối màu, câu hỏi thành nhãn bình chọn Có/Không.",
    bestFor: "hậu trường, một ngày của tôi, cập nhật cá nhân, khoe sản phẩm kiểu đời thường, hỏi ý kiến/bình chọn, phong cách sống",
    examplePrompt: "Story hậu trường một ngày làm barista ở quán cà phê nhỏ, cuối video hỏi người xem có nên thêm món mới không.",
    exampleScript: `# Hậu trường một ngày làm barista
> Theo mình ra quán từ 6 giờ sáng nha

[Quán quen]
! 6 | giờ sáng mở cửa
Cả nhà ơi, 6 giờ sáng mình đã có mặt ở quán rồi.
Việc đầu tiên là xay mẻ cà phê cho cả ngày.

[@ban_than]
Hôm nay có bạn thân ghé phụ một tay.
Mẻ latte đầu tiên **đẹp quá trời luôn**.

! 42 | ly bán được sáng nay
Tới trưa là tay mỏi rã rời.
Nhưng nhìn khách cười là thấy vui liền.

[Góc pha chế]
Mình đang thử món mới: cà phê muối kem trứng.
**Có nên bán thêm món này không?**`,
  },
  blueprint: {
    id: "blueprint",
    label: "Bản vẽ kỹ thuật",
    emoji: "📐",
    summary: "Tờ giấy can xanh có khung tên, ảnh thành ảnh tham chiếu có đường kích thước tự vẽ, lời đọc là ghi chú đánh số gõ từng dòng, câu nhấn được khoanh đám mây sửa đổi màu cam.",
    bestFor: "giải thích cách mọi thứ hoạt động, kỹ thuật, kiến trúc, phát minh, DIY/xây dựng, khoa học, giải phẫu sản phẩm",
    examplePrompt: "Video 30 giây giải thích vì sao cầu treo đứng vững: cáp chủ, trụ tháp, dây treo và khối neo.",
    exampleScript: `# Cầu treo đứng vững nhờ đâu?
> Giải phẫu kết cấu một cây cầu dây võng

[Cáp chủ]
Cầu treo không đứng nhờ mặt cầu.
Toàn bộ sức nặng treo trên **hai sợi cáp chủ**.

[Trụ tháp]
! 120 m | chiều cao trụ tháp
Hai trụ tháp cao 120 mét gánh lực căng của cáp.
Cáp vắt qua đỉnh tháp rồi kéo xuống hai đầu cầu.

[Dây treo]
Mặt cầu treo vào cáp chủ bằng hàng trăm dây đứng.
Mỗi dây chỉ chịu một phần nhỏ, nên cả hệ rất nhẹ.

[Khối neo]
! 7 m | độ sâu khối neo
Hai đầu cáp chôn vào **khối neo bê tông** dưới đất.
Lần tới qua cầu, hãy nhìn lên hai sợi cáp ấy.`,
  },
  festive: {
    id: "festive",
    label: "Lễ hội Tết",
    emoji: "🧧",
    summary: "Nền đỏ son viền vàng, lồng đèn đung đưa, hoa mai đào rơi, phụ đề trên dải lụa đỏ, câu nhấn bắn pháo hoa và mưa lì xì.",
    bestFor: "chúc Tết, lời chúc ngày lễ, thông báo sự kiện/lễ hội, khuyến mãi Tết, chào năm mới, chuyện đoàn viên gia đình",
    examplePrompt: "Video 20 giây chúc Tết năm mới 2026 gửi cả nhà, ấm áp và rộn ràng.",
    exampleScript: `# Chúc mừng năm mới 2026
> Lời chúc Tết gửi cả nhà

[Tết]
Một năm cũ khép lại, mùa xuân gõ cửa từng nhà.
Cả nhà quây quần bên mâm cơm chiều ba mươi.

[Giao thừa]
Khoảnh khắc giao thừa, pháo hoa rực sáng bầu trời.
Chúc cả nhà năm mới **an khang thịnh vượng**.

! 2026 | năm Bính Ngọ rực rỡ
Lì xì đầu năm, lộc đến đầy nhà.

Tết này nhớ gọi về cho gia đình nhé!
**Vạn sự như ý**, hẹn gặp lại mùa xuân sau.`,
  },
  liveshop: {
    id: "liveshop",
    label: "Livestream bán hàng",
    emoji: "🛍️",
    summary: "Màn hình phiên live bán hàng: nhãn LIVE, người xem tăng dần, bình luận trôi, tim bay, lời người dẫn ghim, thẻ sản phẩm và thẻ FLASH SALE giá lăn xuống.",
    bestFor: "bán hàng online, giới thiệu sản phẩm, flash sale, mỹ phẩm, thời trang, đồ gia dụng, review nhanh kèm giá, chốt đơn",
    examplePrompt: "Video 30 giây kiểu livestream chốt đơn serum vitamin C, giảm từ 399k còn 199k, tặng kèm sữa rửa mặt.",
    exampleScript: `# Serum Vitamin C sáng da
> Chỉ trong phiên live · Freeship toàn quốc

[Serum Vitamin C]
Chào cả nhà, hôm nay shop mở deal serum sáng da nha.
Chai 30ml dùng hơn hai tháng, thấm nhanh không bết.

[Serum Vitamin C]
! 12.000 | Đã bán
Tháng rồi shop bán hơn mười hai nghìn chai rồi đó.
Da dầu, da nhạy cảm dùng đều ổn nha cả nhà.

[Serum Vitamin C]
! -50% | Chỉ hôm nay
Trong live serum giảm **từ 399k còn 199k** thôi.
Tặng kèm sữa rửa mặt mini, bấm giỏ hàng chốt liền nha!

[Quà tặng kèm]
Chỉ còn ba mươi suất quà, hết là thôi nha.
Theo dõi shop để không lỡ phiên live tối mai!`,
  },
  karaoke: {
    id: "karaoke",
    label: "Karaoke",
    emoji: "🎤",
    summary: "Màn hình karaoke: hai dòng lời xen kẽ trái – phải, chữ đổi màu chạy theo tiếng hát, chấm đếm ngược trước câu, nền MV hoặc sân khấu đèn nhún theo nhạc.",
    bestFor: "video bài hát có lời, cover, hát karaoke, nhạc thiếu nhi, nhạc Việt, đoạn điệp khúc cần người xem hát theo",
    examplePrompt: "Làm video karaoke cho đoạn điệp khúc một bài hát vui về mùa hè, có chấm đếm ngược trước câu đầu.",
    exampleScript: `# Mùa hè năm ấy
> Nhạc & lời: Minh Khang

[Phiên khúc]
Nắng vàng rơi trên con đường nhỏ
Gió mang theo tiếng cười của em
Mình đạp xe qua hàng phượng đỏ
Đếm từng ngày hè trôi rất êm

[Điệp khúc]
Mùa hè năm ấy mình **hứa sẽ bên nhau**
Dù mai kia có đi thật xa
Mỗi khi nghe tiếng ve ngân rất lâu
Là nhớ em, nhớ cả mùa hoa`,
  },
  lyrics: {
    id: "lyrics",
    label: "Lời nhạc cuộn",
    emoji: "🎵",
    summary: "Lời bài hát đồng bộ kiểu app nghe nhạc: nền ảnh bìa nhoè đậm màu, câu đang hát sáng dần từng từ, danh sách lời cuộn lên theo nhạc, trình phát nhỏ ở trên.",
    bestFor: "lyric video, lời bài hát, cover, nhạc chill, ballad, nhạc buồn, đoạn nhạc hay cần chia sẻ, thơ phổ nhạc",
    examplePrompt: "Làm video lời bài hát cho một bản ballad nhẹ nhàng về nỗi nhớ nhà, chữ cuộn theo nhạc.",
    exampleScript: `# Về nhà
> Hà Anh

[Phiên khúc]
Chiều nay phố đã lên đèn
Con đường quen bỗng thấy dài hơn
Tin nhắn mẹ vẫn chờ trong máy
"Bao giờ con về, cơm vẫn còn ấm"

[Điệp khúc]
Về nhà thôi, **về nơi có mẹ**
Nơi mái hiên nghe mưa rất khẽ
Bao ồn ào ngoài kia cũng lặng
Chỉ cần một bữa cơm chiều`,
  },
  vinyl: {
    id: "vinyl",
    label: "Đĩa than",
    emoji: "💿",
    summary: "Đĩa than quay với ảnh bìa trên nhãn đĩa, vòng phổ nhạc nhảy theo từng nhịp quanh đĩa, lời hiện từng từ bên dưới, mở đầu bằng đĩa trượt ra khỏi bìa.",
    bestFor: "nhạc lofi, chill, R&B, nhạc xưa, playlist, giới thiệu bài hát mới, đoạn beat, trích một câu hát hay, nhạc không lời có vài câu",
    examplePrompt: "Làm video đĩa than cho một đoạn nhạc lofi buổi tối, lời ngắn về thành phố lúc về đêm.",
    exampleScript: `# Phố đêm
> Lofi · Side A

[Side A]
Đèn đường vàng như mật ong
Xe qua rồi, phố lại trống không
Mình ngồi đây, ly cà phê nguội
Nghe thành phố thở rất chậm

[Điệp khúc]
Cứ để **đêm trôi thật chậm**
Chẳng cần vội, chẳng cần nói nhiều
Một bài hát, một góc phố
Là đủ cho một buổi chiều`,
  },
};

export const isStyleId = (value: unknown): value is StyleId =>
  typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
