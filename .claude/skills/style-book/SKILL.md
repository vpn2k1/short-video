---
name: style-book
description: Phong cách "Mở sách" — cuốn sách bìa da trên bàn dưới ánh đèn, bìa mở ra đầu video, mỗi cảnh một trang in có tranh minh hoạ khung đôi, chữ có chân canh đều, chữ cái đầu chương cỡ lớn, lật trang 3D. Dùng cho tóm tắt sách, bài học từ sách, lịch sử, truyền thuyết, danh nhân, chuyện có chương hồi.
---

# Mở sách

## Nhận diện hình ảnh

- Nền bàn gỗ tối, vệt sáng đèn phía trên, viền tối quanh khung, nhiễu giấy tĩnh.
- **Dọc** (9:16, 3:4, 1:1): nhìn gần trang phải — gáy sách ở mép trái, lấp ló mép trang trái bên kia gáy,
  mép các trang xếp chồng bên dưới. **Ngang** (16:9, 2:1): sách mở hai trang — tranh cả trang bên trái, chữ bên phải.
- Giấy ngà `#f3ead5`, bóng gáy sách, mép ngoài hơi ngả màu. Chữ **Lora** (có chân, đóng gói, đủ dấu), màu mực nâu
  đen, canh đều hai bên. Tiêu đề chương, chữ cái đầu chương và bìa dùng **Playfair Display**.
- Đầu mỗi trang: tên sách in nghiêng nhỏ (running header). Cuối trang: số trang `— 3 —`.
- Màu nhấn (`accent`): tiêu đề chương, chữ cái đầu chương, cụm punch, gạch trang trí; bìa sách là màu nhấn pha nâu da.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Tranh in trong trang, khung đôi mảnh, hơi ngả sepia, phóng rất chậm. Dọc: nằm trên chữ. Ngang: cả trang trái. Video: phát trong khung, tắt tiếng, lặp. |
| `tag` | Tiêu đề chương giữa đầu trang, có gạch mảnh bên dưới. Trang có `tag` (và trang đầu) có chữ cái đầu chương cỡ lớn. |
| `captions` | Mọi câu của trang xếp sẵn thành một đoạn văn (câu chưa đọc tàng hình) nên dòng không nhảy; từng từ "thấm" ra theo nhịp đọc trong nửa đầu câu. Câu cũ **ở lại** trên trang. |
| `punch` | Có nguyên văn trong câu: các từ đó in nghiêng, đổi màu nhấn, gạch chân kéo dần lúc `atMs`. Không khớp → in thành câu trích giữa trang (khi cảnh không có `visual`). |
| `visual` stat/badge | Câu trích giữa trang: chữ lớn in nghiêng màu nhấn giữa hai gạch, `caption` nghiêng nhạt bên dưới. |
| `title`/`subtitle` | Khi `showTitle`: bìa sách viền mạ vàng hai nét, tiêu đề vàng, dòng phụ nghiêng. Frame 64 bìa mở quanh gáy trong 24 frame. |

## Chuyển động

- Bìa: sách trượt vào (0–16), bìa mở 3D quanh gáy (64–88). Ngang: sách đóng nằm giữa, mở ra thì trượt về giữa gáy.
- Sang cảnh: tờ trên cùng lật 3D quanh gáy trong 20 frame (`rotateY` 0 → −180°, `backface-visibility`). Mặt
  trước tờ lật = trang chữ cảnh cũ; mặt sau = trang tranh của cảnh mới (ngang) hoặc giấy trơn (dọc).
- Trang mới lộ ra dưới tờ đang lật đã in sẵn tranh và tiêu đề chương; chữ bắt đầu hiện sau 12 frame.
- Không dùng TransitionSeries — mốc cảnh/phụ đề giữ nguyên frame tuyệt đối.

## Lỗi cần tránh

- Cỡ chữ ước theo số ký tự (Lora ~0.5em mỗi ký tự) — trang quá nhiều chữ sẽ co còn 26px. Giữ 2–3 câu mỗi cảnh.
- `tag` dài hơn một dòng (~24 ký tự) bị xuống dòng, đẩy chữ xuống.
- `color-mix()` cần Chrome 111+ (Remotion hiện dùng bản mới hơn).
- Phụ đề là nội dung trang nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh (`CONTENT_CAPTION_STYLES`).

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Viết như đang đọc to một cuốn sách: câu trọn ý, có nhịp kể, giọng trầm và chậm hơn video mạng xã hội.
- Mỗi cảnh là một trang/một chương: 2–3 câu, tổng cộng dưới 160 ký tự để chữ trên trang còn to.
- `tag`: tên chương ngắn, tối đa 22 ký tự — "Chương 1 · Giấc mơ", "Năm 1945", "Bài học thứ hai".
- `punch`: chép NGUYÊN VĂN 1–5 từ trong một câu của chính cảnh đó — ý đắt nhất của trang, sẽ in nghiêng màu nhấn.
- `visual` stat cho con số hoặc câu trích đáng nhớ ("1 câu", "1988", "7 năm") kèm caption ngắn.
- Ảnh: tranh minh hoạ hoặc ảnh tư liệu có chiều sâu, chủ thể rõ — sẽ in như tranh trong sách.
- Kết bằng một câu đọng lại như dòng cuối chương, hoặc lời mời đọc trọn cuốn sách.
<!-- /ai-guide -->

## File

- `src/styles/book/index.tsx` — bố cục dọc/ngang, giấy, chữ, tranh, câu trích, lật trang, bìa.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
