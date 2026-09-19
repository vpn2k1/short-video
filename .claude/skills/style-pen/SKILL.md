---
name: style-pen
description: Phong cách "Thư tay" — tờ giấy viết thư trên bàn gỗ, cây bút máy viết từng chữ bằng mực xanh đen, câu nhấn đổi màu mực và gạch chân lượn sóng, ảnh cũ kẹp ghim, dòng đề nơi chốn góc trên, trang tiêu đề ký tên. Dùng cho lá thư gửi ai đó, tâm sự, nhật ký, lời cảm ơn, kỷ niệm, lời khuyên chân thành, kể chuyện ngôi thứ nhất.
---

# Thư tay

## Nhận diện hình ảnh

- Mặt bàn gỗ nâu tối, tờ thư giấy kem `#f7f0e1` gần kín khung, nghiêng nhẹ, vết ố mờ theo seed, bóng đổ xuống bàn.
- Chữ **Dancing Script** 600 (đóng gói, đủ dấu tiếng Việt) màu mực `#1b2a5a`, mực hơi loang.
- Cây bút máy vẽ bằng SVG: ngòi vàng có khe, thân đen pha màu nhấn, khâu và kẹp mạ vàng — **ngòi bám đúng mép chữ đang viết**.
- Dọc: ảnh kẹp ghim phía trên, chữ bên dưới. Ngang: chữ bên trái, ảnh bên phải.
- Màu nhấn: mực của cụm punch và gạch chân, ghi chú bên lề, nét hoa mỹ dưới tiêu đề.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Ảnh cũ viền trắng (đáy dày hơn), hơi sepia, nghiêng, ghim giấy trên mép; rơi nhẹ xuống khi tờ thư đặt xong. Video: phát trong khung, tắt tiếng, lặp. |
| `tag` | Dòng đề góc trên phải (kiểu "Hà Nội, một tối mưa"), viết nhanh lúc tờ thư xuất hiện. |
| `captions` | Mỗi câu bắt đầu một dòng mới, bút viết dần trong 80% thời lượng câu. Câu đã viết **ở lại** trên tờ. Cỡ chữ tính cho vừa mọi câu của tờ; vẫn không vừa thì câu cũ nhất bị bỏ khỏi tờ. |
| `punch` | Có nguyên văn trong câu: các chữ đó chuyển sang mực màu nhấn và được gạch chân lượn sóng lúc `atMs`. Không khớp → thành ghi chú bên lề (khi cảnh không có `visual`). |
| `visual` stat/badge | Ghi chú bên lề: chữ lớn mực màu nhấn, nghiêng, `caption` mực xanh bên dưới. |
| `title`/`subtitle`/`handle` | Khi `showTitle`: bút viết tiêu đề giữa tờ, vẽ nét lượn hoa mỹ màu nhấn, viết dòng phụ, ký handle góc dưới phải. Frame 70 tờ tiêu đề trượt đi. |

## Chuyển động

- Chữ: tự ngắt dòng bằng canvas (`measure`/`wrap` trong `ink.tsx`), mỗi dòng lộ ra bằng `clip-path` theo đúng bề rộng
  đã đo — nên ngòi bút và mép chữ luôn trùng nhau. Chữ lộ theo ký tự, có phần lẻ nên nét chạy mượt.
- Bút: rung nhẹ khi viết; viết xong câu thì nhấc lên (bóng xa, mờ hơn); 4 frame trước câu mới thì bay tới đầu dòng mới.
- Sang cảnh: tờ mới trượt từ dưới lên đè tờ cũ trong 16 frame, xoay về góc nghiêng riêng; bút hiện dần khi tờ nằm yên.
- `useFontReady("dancing")` giữ `delayRender` tới khi font nạp xong và component vẽ lại — đo chữ lúc font chưa về sẽ ra bề rộng của font dự phòng.

## Lỗi cần tránh

- Font khác Dancing Script phải đổi cả `SCRIPT` trong `ink.tsx` (đo chữ dùng đúng font đó) và kiểm dấu `ắ ồ ữ ệ ỡ Ặ Ữ`.
- Câu dài hơn ~80 ký tự chiếm 3 dòng, tờ nhiều câu sẽ co chữ — giữ 2–3 câu mỗi cảnh.
- Cụm punch nằm vắt qua hai dòng vẫn tô màu được, gạch chân vẽ riêng từng đoạn.
- Phụ đề là nội dung tờ thư nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Viết như một lá thư tay hoặc trang nhật ký: ngôi thứ nhất, xưng hô thân mật ("mình – cậu", "con – mẹ", "anh – em"), chân thành, chậm rãi.
- Mở đầu bằng lời gọi GỘP với hook trong cùng câu đầu — lời gọi xong là vào ngay điều khiến người đọc muốn đọc tiếp:
  "Gửi mẹ, có một chuyện con giấu mẹ suốt mười năm.", "Chào cậu, mình là cậu của mười năm sau — và mình có tin xấu."
  Không để câu đầu chỉ là lời chào suông. Kết bằng lời chào/ký tên ("Thân ái", "Thương mẹ nhiều").
- Mỗi cảnh là một đoạn thư: 2–3 câu, mỗi câu dưới 70 ký tự.
- `tag`: dòng đề ngắn tối đa 24 ký tự — nơi chốn/thời điểm ("Hà Nội, một tối mưa"), hoặc "Điều thứ nhất", "Tái bút".
- `punch`: chép NGUYÊN VĂN 1–5 từ trong một câu của cảnh — điều muốn người đọc nhớ nhất, sẽ đổi màu mực và gạch chân.
- `visual` stat cho con số có ý nghĩa ("10 năm", "3 giờ sáng") kèm caption ngắn.
- Ảnh: ảnh kỷ niệm, khoảnh khắc đời thường, đồ vật gợi nhớ — sẽ thành tấm ảnh cũ kẹp vào thư.
<!-- /ai-guide -->

## File

- `src/styles/pen/index.tsx` — bố cục tờ thư, ảnh kẹp, ghi chú bên lề, trạng thái bút, tờ tiêu đề, chuyển tờ.
- `src/styles/pen/ink.tsx` — đo chữ, ngắt dòng, chữ viết dần, gạch chân lượn sóng, cây bút máy SVG.
- `src/fonts/load.ts` — `useFontReady` (đợi font trước khi đo chữ).
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
