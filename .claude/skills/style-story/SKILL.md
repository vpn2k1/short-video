---
name: style-story
description: Phong cách "Story điện thoại" — mỗi cảnh là một khung story trên điện thoại (chung chung, không logo thật): thanh tiến độ chia đoạn chạy theo cảnh, đầu story có avatar vòng gradient + tên + "2 giờ" + ⋯ ✕, ảnh/clip tràn màn hình, phụ đề là nhãn chữ đậm trên khối màu bo góc nghiêng nhẹ bật từng câu, tag là nhãn vị trí 📍 / nhắc tên @, câu hỏi thành nhãn thăm dò "Có 👍 / Không 👎" có phần trăm chạy, câu nhấn khác thành nhãn GIF + mưa emoji, số liệu là nhãn đếm ngược, thanh "Gửi tin nhắn" có tim bay, cảnh không ảnh là nền gradient chế độ "Tạo", mở đầu bằng chạm avatar mở story. Dùng cho hậu trường, một ngày của tôi, cập nhật cá nhân, khoe sản phẩm kiểu đời thường, hỏi ý kiến/bình chọn, phong cách sống.
---

# Story điện thoại

## Nhận diện hình ảnh

- 9:16: story toàn màn hình. 16:9, 1:1, 3:4: điện thoại viền kim loại mảnh (lỗ camera tròn, thanh trạng thái "20:26")
  đứng giữa bản mờ của ảnh cảnh; khung ngang còn có các story trước/sau là thẻ nhỏ mờ hai bên như trình xem trên máy tính.
- Mọi thứ trong màn hình vẽ trên canvas ảo rộng 1080px rồi thu phóng cả khối — nhãn dán giữ đúng tỉ lệ ở mọi khung.
- Chữ: **Be Vietnam Pro** (giao diện, nhãn chữ, nhãn thăm dò), **Baloo 2** 800 (nhãn GIF). Đóng gói sẵn, đủ dấu, nạp bằng `ensureFonts`.
- Trên cùng: thanh tiến độ trắng mỗi cảnh một đoạn; đầu story: avatar tròn (chữ cái đầu của handle trên nền màu nhấn, vòng
  gradient màu nhấn → cam → hồng → tím), tên (bỏ "@"), "2 giờ", ⋯ và ✕. Đáy: ô "Gửi tin nhắn" viền trắng, tim, máy bay giấy.
- Lớp tối mờ trên/dưới để giao diện trắng đọc được trên mọi ảnh. Biểu tượng vẽ SVG kiểu chung chung.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Ảnh/clip tràn màn hình, ảnh phóng chậm 1.0 → 1.08. Clip phát tắt tiếng, lặp. `null` → **chế độ "Tạo"**: gradient chéo xoay sắc độ theo số cảnh, phụ đề thành chữ trắng to không khối. |
| Thứ tự cảnh | Mỗi cảnh một đoạn trên thanh tiến độ: đã qua đầy, đang xem chạy dần tới lúc cảnh sau bắt đầu, sau đó mờ. |
| `captions` | Mỗi lúc một câu, là nhãn chữ giữa màn hình: câu chẵn chữ trắng (hoặc đen nếu accent sáng) trên khối màu nhấn, câu lẻ chữ đen trên khối trắng; mỗi dòng một khối bo góc, nghiêng ±3.5° và lệch nhẹ theo seed; câu dài tự co (tối thiểu ~62%). |
| `tag` | Nhãn trắng góc trên trái, chữ gradient in hoa, nghiêng -4°: bắt đầu bằng "@" → nhãn nhắc tên, "#" → hashtag, còn lại → nhãn vị trí có ghim. |
| `punch` | Hiện từ `atMs` tới hết cảnh ở ~2/3 màn hình. **Kết bằng "?"** → nhãn thăm dò: câu hỏi + hai hàng "Có 👍 / Không 👎", bấm chọn rồi thanh phần trăm chạy (tỉ lệ cố định theo seed của câu) + "… lượt bình chọn"; câu phụ đề gần như trùng câu hỏi thì nhường chỗ. **Còn lại** → nhãn GIF: chữ tròn in hoa viền màu nhấn, lắc giật mỗi 4 frame, emoji góc + chùm emoji bung ra (chọn theo nghĩa: cười 😂, yêu/đẹp 😍, sốc 😱, ngon 🤤, buồn 🥲, mặc định 🔥👏). Kèm chùm tim bay. Phụ đề nhích lên chừa chỗ. |
| `visual` stat | Nhãn đếm ngược góc trên phải: chú thích in hoa, con số chạy từ 0 trong các ô chữ số (giữ số 0 đầu như đồng hồ, tối đa 4 chữ số; dài hơn thì in liền), nút "Nhắc tôi". |
| `visual` badge | Nhãn "thêm của bạn": viên gradient mang chữ + chú thích + "Thêm của bạn ›". |
| `title`/`subtitle`/`handle` | Khi `showTitle`: khay story (avatar lớn vòng đang xoay, tên, "Tin mới · 2 giờ trước"), chạm avatar, story nở ra thành vòng tròn từ avatar; tiêu đề là nhãn chữ đầu tiên (khối màu nhấn), dòng phụ là nhãn trắng dưới. |
| `captionPosition` | Không dùng — vị trí nhãn do phong cách quyết định. |

## Chuyển động

- Mở đầu (70 frame): 0–12 khay story hiện, frame 12–20 ngón tay chạm avatar, 18–34 story nở ra từ avatar, 26/34 nhãn tiêu đề
  và dòng phụ bật vào, 61–69 thu nhỏ biến mất. Phụ đề, tag, số liệu của cảnh đầu đợi hết màn mở đầu.
- Sang cảnh: xoay khối lập phương 12 frame (khung cũ xoay quanh mép phải trượt đi, khung mới xoay quanh mép trái vào); thẻ story
  hai bên (khung ngang) trượt một nấc. Tag bật vào khi xoay xong, số liệu sau 6 frame.
- Mọi nhãn bật bằng spring (nảy nhẹ). Nhãn GIF lắc theo nhịp 4 frame như ảnh GIF. Tim bay giữa mỗi cảnh và thành chùm lúc câu nhấn.
- Không `showTitle`: khung đầu hiện mờ dần 8 frame.

## Lỗi cần tránh

- Câu phụ đề dài hơn ~70 ký tự thành 3–4 dòng khối màu, che nhiều ảnh — tách câu ngắn như người ta gõ story.
- `tag` dài hơn ~20 ký tự bị co nhỏ; khi cảnh có cả `visual` thì tag chỉ còn nửa trái màn hình.
- `punch` muốn thành nhãn thăm dò phải KẾT BẰNG "?" và chép nguyên văn từ câu phụ đề; câu hỏi dài hơn ~60 ký tự làm thẻ cao.
- `visual.text` nên là con số ngắn ("3", "80%", "12") — dài hơn 4 chữ số thì mất ô đếm ngược.
- Handle rỗng → avatar lấy chữ cái đầu của tiêu đề, tên hiện "tin_cua_ban".
- Nhãn chữ là phần của khung story nhưng vẫn là phụ đề thường: phong cách này **nhận** kiểu phụ đề tuỳ chỉnh (khi đó composition vẽ phụ đề thay).

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng ngôi thứ nhất, thân mật như đang đăng story cho bạn bè xem: "Sáng nay mình…", "Cả nhà ơi…", câu ngắn, có cảm xúc.
- Mỗi cảnh là MỘT khung story: 1–2 câu, mỗi câu dưới 60 ký tự (sẽ thành nhãn chữ trên khối màu).
- Tiêu đề kiểu story: "Một ngày làm barista của mình", "Hậu trường buổi chụp hôm nay"; dòng phụ ngắn như lời mời xem.
- `tag`: nơi chốn ("Đà Lạt", "Quán quen", "Văn phòng") hoặc nhắc tên bắt đầu bằng "@" ("@ban_than", "@team_marketing"), tối đa 20 ký tự.
- `punch`: chép NGUYÊN VĂN 2–6 từ trong câu của cảnh. Muốn hỏi ý kiến người xem thì viết câu hỏi có/không và cho `punch`
  là cả câu hỏi KẾT BẰNG "?" ("Có nên mua thêm không?") → thành nhãn bình chọn Có/Không. Nên có đúng 1 câu hỏi như vậy, thường ở cảnh cuối.
  Câu nhấn không có "?" (cảm thán: "ngon xỉu luôn", "đẹp quá trời") → thành nhãn GIF có mưa emoji.
- `visual` stat: con số ngắn của khoảnh khắc — giờ, số ngày còn lại, số ly đã pha ("5", "12", "3 ngày") kèm caption ngắn ("ly cà phê sáng nay").
- Cảnh không ảnh thành khung chữ trên nền gradient — dùng cho câu tâm sự/nhận xét không cần hình.
- Ảnh: ảnh dọc chụp điện thoại, góc nhìn cá nhân (POV), đời thường, ánh sáng tự nhiên — không phải ảnh studio.
<!-- /ai-guide -->

## File

- `src/styles/story/index.tsx` — ghép lớp, hình học màn hình (toàn màn hình / điện thoại), màn mở đầu nở từ avatar.
- `src/styles/story/theme.ts` — font, màu (vòng gradient, chữ trắng/đen trên accent, nền "Tạo"), canvas ảo, mốc thời gian, chọn emoji.
- `src/styles/story/Chrome.tsx` — thanh tiến độ, đầu story, avatar, thanh "Gửi tin nhắn", tim bay, thanh trạng thái.
- `src/styles/story/Frames.tsx` — khung ảnh/clip + xoay lập phương, nền "Tạo", nền mờ sau điện thoại, khay story, thẻ story hai bên.
- `src/styles/story/Stickers.tsx` — nhãn phụ đề, nhãn tiêu đề, tag, đếm ngược / thêm của bạn, thăm dò, GIF + emoji.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
