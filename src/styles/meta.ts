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
Chỉ 1 trong 10 người đúng hết!
Cố đô cuối cùng của Việt Nam là thành phố nào?
Suy nghĩ 3 giây nhé…
Đáp án là **Huế**.

[CÂU 2]
Đỉnh núi cao nhất Việt Nam tên là gì?
Đoán nhanh nào…
Đáp án là **Fansipan**.

[CÂU KHÓ]
! 73% | người trả lời sai câu này
Sông nào chảy qua trung tâm Hà Nội?
Bạn chọn gì?
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
};

export const isStyleId = (value: unknown): value is StyleId =>
  typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
