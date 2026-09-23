---
name: style-chat
description: Phong cách "Tin nhắn" — kể chuyện bằng giao diện nhắn tin điện thoại: bong bóng hai phía, "đang gõ…", mốc thời gian, ảnh gửi trong chat, thả cảm xúc ở câu twist. Dùng cho kể chuyện, drama, tình huống dở khóc dở cười, hội thoại, chuyện tình cảm, tin nhắn lừa đảo.
---

# Phong cách: Tin nhắn (chat story)

`style: "chat"` trong props. Code: `src/styles/chat/`.

## Nhận diện hình ảnh

- Một màn hình nhắn tin kiểu iOS: thanh tiêu đề (nút quay lại, avatar tròn chữ cái đầu màu `accent`,
  tên liên hệ, chấm xanh "đang hoạt động", icon gọi/video), danh sách tin neo đáy, thanh soạn tin giả.
- 9:16: màn hình bo góc lấp vùng an toàn. 16:9 / 1:1: cột điện thoại ở giữa (≈ min(rộng, cao × 0.62)),
  hai bên là ảnh cảnh hiện tại làm mờ tĩnh + tối đi, không có ảnh thì gradient từ `background`/`accent`.
- Theme theo độ sáng `background`: nền tối → chế độ tối (nền đen, bong bóng đến #262628, đi #0A84FF);
  nền sáng → chế độ sáng (nền trắng, đến #E9E9EB chữ đen, đi #0B84FE chữ trắng).
- Font `FONTS.sans` (SF), chữ thường — không in hoa, dấu tiếng Việt giữ nguyên.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | mỗi câu một bong bóng hiện đúng `startMs`; tiền tố `Tên:` bị bỏ khỏi bong bóng (xem quy ước bên dưới) |
| `tag` | pill mốc thời gian ở giữa danh sách lúc cảnh bắt đầu ("Hôm qua 23:14"); giờ `hh:mm` đầu tiên còn làm đồng hồ màn hình khoá |
| `image` | tin nhắn ảnh/video (khung 4:5, rộng 56%, `cover`, crop/trim/volume của trình chỉnh sửa vẫn áp dụng) do người nói câu đầu cảnh gửi |
| `punch` | trong bong bóng chứa cụm punch: các từ đó đậm + gạch chân; đúng `atMs` bật huy hiệu cảm xúc (‼️ / 😱) ở góc bong bóng |
| `visual` stat | tin nhắn "số khổng lồ" như emoji lớn, `caption` chữ xám nhỏ bên dưới |
| `visual` badge | pill hệ thống viền màu `accent` giữa danh sách |
| `title` / `subtitle` | màn hình khoá 70 frame: thông báo "Tin nhắn" trượt xuống, `title` là người gửi, `subtitle` là nội dung xem trước |
| `accent` | avatar, pill badge |
| `background` | chọn theme tối/sáng + màu nền ngoài điện thoại |
| `captionPosition` | không dùng |

## Quy ước người nói

- `Tên: lời nhắn` (tên 1–16 ký tự, tối đa 3 từ, không phải số) → tin của "Tên". Giờ `23:14` và URL không bị nhận nhầm.
- Caption chỉ có `Tên:` (do `splitLong` tách câu dài ngay sau dấu hai chấm) → gán tên đó cho caption kế tiếp.
- **Bên phải (xanh, "tôi")**: `Tôi`, `Mình`, `Tui`, `Tớ`, `Tao`, `Tau`, `Me`, `I`, `Bản thân` — không phân biệt hoa thường.
  `Em`/`Anh` cố ý KHÔNG tính là "tôi". Nếu không có tên nào trong danh sách: người nói thứ hai bên phải, còn lại bên trái.
- Câu không có tiền tố: tiếp tục người nói trước. Là lời dẫn (chữ xám nhỏ ở giữa) khi chưa có ai nói, hoặc khi
  nó là câu đầu tiên của một cảnh mới (sau cảnh 1) — "Sáng hôm sau…".
- 3 người nói trở lên = chat nhóm: tên người gửi hiện trên bong bóng đầu mỗi lượt bên trái; tiêu đề thanh trên là `title`.
  Có đúng một người bên trái thì tiêu đề là tên người đó.

## Chuyển động

- Bong bóng bật từ góc dưới phía người gửi (spring, scale 0.35 → 1, có nảy nhẹ).
- Trước mỗi tin, tối đa 18 frame (không sớm hơn tin trước) hiện bong bóng "đang gõ" ba chấm nhún. Bên "tôi"
  thì chữ còn gõ dần trong ô soạn tin, nút gửi xanh hiện ra.
- Danh sách cuộn lên mượt: chiều cao từng mục tính trước bằng canvas (chữ tự xuống dòng trong code, mỗi dòng
  `nowrap`), nên translateY chính xác và bong bóng không bao giờ chồng nhau. Tin cũ trôi khuất dưới thanh tiêu đề.
- Mục cùng lúc (mốc thời gian, ảnh, số) cách nhau tối thiểu 6 frame; câu có thể trễ vài frame so với audio khi dồn.
- Màn hình khoá: đồng hồ hiện dần, thông báo rơi xuống (frame 12), nhấn nhẹ (frame 44–54), mờ đi và cuộc trò
  chuyện phóng nhẹ vào ở cuối 70 frame. Tin nhắn chỉ bắt đầu sau intro.
- Không blur động — chỉ ảnh nền hai bên được blur tĩnh.

## Lỗi cần tránh

- **TTS đọc cả tiền tố "Tên:"** — tên dài làm lời đọc lê thê. Giữ tên 1 từ ngắn (Linh, Mẹ, Sếp, Tôi).
- Quên tiền tố ở câu đầu mỗi cảnh → câu đó thành lời dẫn xám ở giữa chứ không phải bong bóng.
- Đặt tên "Em"/"Anh" cho nhân vật chính mà muốn nó bên phải → dùng "Tôi"/"Mình" thay vì thế.
- Tin nhắn dài > ~120 ký tự: bong bóng 4–5 dòng chiếm nửa màn hình, mất cảm giác nhắn tin. Chia thành nhiều tin.
- Punch không chép nguyên văn từ một câu trong cảnh → không có chữ đậm (huy hiệu cảm xúc vẫn hiện ở tin gần `atMs`).
- Ảnh cho mọi cảnh → khung 4:5 đẩy chữ khuất nhanh. Chỉ dùng ảnh khi nhân vật thực sự "gửi ảnh".
- Nhiều người nói (> 4) → chat nhóm rối, khó theo.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- MỌI câu tin nhắn phải có dạng `Tên: nội dung` — tên ngắn một từ (TTS đọc cả tên). Nhân vật chính xưng "Tôi" hoặc "Mình" để nằm bên phải.
- Tin nhắn ngắn như chat thật: 2–12 từ mỗi câu, văn nói, có thể viết tắt nhẹ, emoji vừa phải. Ý dài thì tách thành 2–3 tin liên tiếp cùng tên.
- 2 nhân vật chính (tối đa 3–4 nếu cố ý là chat nhóm). Tổng 8–20 câu.
- Câu đầu tiên là hook: một tin nhắn gây tò mò/sốc ngay ("Mày đang ở đâu? Đừng về nhà.").
- Cảnh = bước nhảy thời gian. `tag` của cảnh là mốc giờ kiểu điện thoại ≤ 18 ký tự ("Hôm qua 23:14", "Sáng hôm sau", "3 ngày sau").
- Lời dẫn không có tiền tố dùng rất ít, chỉ ở đầu cảnh để chuyển thời gian ("Sáng hôm sau, cả lớp đều biết.").
- `punch`: 1–4 từ của cú twist, PHẢI chép nguyên văn từ một tin trong cảnh đó; mỗi cảnh tối đa một punch, thường ở cảnh cuối.
- Kết thúc bằng twist hoặc tin nhắn cuối gây bất ngờ/buồn cười; có thể để một tin "…" hoặc "Đã xem" làm dư âm.
- `image` chỉ khi nhân vật gửi ảnh (ảnh chụp màn hình, ảnh bằng chứng); còn lại để null.
- `visual` stat cho con số gây sốc ("47" | "cuộc gọi nhỡ"); badge cho tên nhóm hoặc sự kiện hệ thống ("Nhóm lớp 12A"). Dùng tiết chế.
<!-- /ai-guide -->

## File

- `src/styles/chat/index.tsx` — bố cục khung điện thoại, cuộn danh sách, ô soạn tin gõ chữ, ghép intro
- `src/styles/chat/model.ts` — tách người nói, chia bên, dựng dòng thời gian (mốc, ảnh, số, lời dẫn, punch), đo chữ bằng canvas, chiều cao & cuộn
- `src/styles/chat/Bubbles.tsx` — bong bóng chữ, đang gõ, ảnh/video, số lớn, pill, lời dẫn, huy hiệu cảm xúc
- `src/styles/chat/Chrome.tsx` — nền ngoài điện thoại, thanh tiêu đề, thanh soạn tin, màn hình khoá + thông báo
- `src/styles/chat/theme.ts` — theme tối/sáng theo độ sáng `background`, tiện ích màu
