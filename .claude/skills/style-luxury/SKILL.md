---
name: style-luxury
description: Phong cách "Tối giản sang trọng" — trang tạp chí trên giấy ngà, lề rộng, ảnh đặt như bản in phòng tranh (viền chỉ mảnh, passe-partout, phóng vào rất chậm), phụ đề chữ có chân canh giữa hiện từng dòng giữa hai gạch vàng mảnh, câu nhấn nghiêng vàng gạch chân, kicker in hoa giãn chữ, monogram trong vòng tròn, hoà tan dài giữa các cảnh. Dùng cho trích dẫn, bất động sản, spa/wellness, trang sức, thời trang, câu chuyện thương hiệu, cưới hỏi, giới thiệu sản phẩm cao cấp, nội dung chậm và suy ngẫm.
---

# Tối giản sang trọng

## Nhận diện hình ảnh

- Nền giấy ngà `#f4efe6`, sáng ở giữa ngả ấm ra mép, hạt giấy tĩnh rất nhẹ. Lề rộng, nhiều khoảng trống.
- **Dọc** (9:16, 3:4, 1:1): monogram nhỏ trên cùng → bản in (ảnh) → kicker (`tag`) → phụ đề. **Ngang** (16:9, 2:1):
  bản in dọc bên trái, cột chữ bên phải (monogram, kicker, phụ đề).
- Bản in: viền chỉ mảnh, lớp passe-partout sáng hơn giấy, viền trong mảnh, bóng đổ rất mềm; ảnh hơi giảm bão hoà.
- Chữ: **Playfair Display** 400 (đóng gói, đủ dấu) cho phụ đề, tiêu đề, con số; **Montserrat** 500 in hoa giãn chữ
  0.3em cho kicker. In hoa bằng JS `toLocaleUpperCase("vi")`, không dùng CSS text-transform.
- Bảng màu cố định: mực `#2a2520`, vàng đồng `#b08d57`, nâu nhạt `#8c7f6d`. **`accent` và `background` của video
  bị bỏ qua** — màu nhấn sặc sỡ phá không khí sang trọng.
- Monogram: chữ cái đầu của `handle` (bỏ `@`), không có thì của `title`, trong vòng tròn chỉ vàng.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Bản in phòng tranh, phóng 1 → 1.07 suốt cảnh. Video: phát trong khung, tắt tiếng, lặp. |
| `image: null` | Dọc: trang chữ thuần — dấu ngoặc kép lớn màu vàng, kicker, phụ đề to hơn ngay bên dưới. Ngang: bản in thay bằng tấm giấy có dấu ngoặc kép (hoặc con số). |
| `tag` | Kicker in hoa giãn chữ màu vàng, giữa, ngay dưới bản in (ngang: đầu cột chữ). |
| `captions` | Từng câu một, canh giữa, cỡ co theo độ dài (tối đa 4 dòng; trang chữ 6 dòng). Mỗi dòng hiện dần và trôi nhẹ lên, cách nhau 6 frame. Hai gạch vàng mảnh trên/dưới khối chữ, dời êm theo chiều cao câu mới. |
| `punch` | Có nguyên văn trong câu: in nghiêng, chuyển sang vàng và gạch chân mảnh kéo dần lúc `atMs`. Không khớp câu nào của cảnh → thêm một dòng nghiêng vàng dưới câu đang đọc lúc `atMs`. |
| `visual` stat/badge | Có ảnh: nhãn phòng tranh nền kem dán ở đáy bản in — con số chữ có chân lớn + chú thích kicker. Không ảnh: con số lớn thay chỗ dấu ngoặc kép. |
| `title`/`subtitle`/`handle` | Khi `showTitle`: trang tiêu đề — vòng tròn monogram tự vẽ, tiêu đề chữ có chân lớn hiện từng dòng, gạch vàng kéo ra, dòng phụ kiểu kicker, handle nhỏ phía dưới; tan dần vào cảnh đầu ở frame 50–70. |

## Chuyển động

- Mọi thứ chậm và êm (`Easing.bezier(0.25, 0.1, 0.25, 1)`), không spring, không nảy, không vượt đích.
- Sang cảnh: cả trang của cảnh mới hoà tan lên trên cảnh cũ trong 26 frame; kicker hiện sau 10 frame, nhãn con số sau 20.
- Đổi câu: câu cũ mờ đi và trôi lên trong 10 frame, câu mới hiện từng dòng từ frame 6.
- Monogram góc trên tự vẽ vòng tròn khi trang tiêu đề tan.
- Không dùng TransitionSeries — mốc cảnh/phụ đề giữ nguyên frame tuyệt đối.

## Lỗi cần tránh

- Playfair không có file nghiêng thật — chữ nghiêng là nghiêng giả của trình duyệt; đã chừa thêm khoảng sau cụm nhấn.
- Đo chữ bằng canvas để ngắt dòng — phải đợi font (`useFontReady("playfair")`), nếu không dòng bị ngắt theo font dự phòng.
- Câu quá dài (> ~120 ký tự) co còn 30px và khó đọc trên điện thoại — tách thành hai câu.
- `tag` dài hơn ~26 ký tự tràn một dòng kicker (không xuống dòng). `visual.caption` cũng vậy.
- Phụ đề là nội dung trang (canh giữa giữa hai gạch vàng) nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng điềm tĩnh, tiết chế, câu ngắn và trọn ý như lời dẫn tạp chí cao cấp. Không hô hào, không chấm than, không từ lóng, không emoji.
- Viết thường như câu văn (không IN HOA cả câu); để nhiều khoảng lặng — mỗi cảnh 1–2 câu, mỗi câu tối đa ~90 ký tự.
- `tag`: kicker 1–3 từ, tối đa 22 ký tự — "Buổi sáng", "Chất liệu", "Lời nhắn", "Chương II", "Tầng 32".
- `punch`: chép NGUYÊN VĂN 2–5 từ trong một câu của chính cảnh đó — cụm từ gợi cảm xúc nhất ("sống chậm lại", "tinh tế nằm ở chi tiết"); sẽ in nghiêng vàng.
- `visual` stat cho một con số đắt giá ("18K", "120 m²", "1 viên", "92%") kèm caption ngắn; dùng tiết kiệm, 1–2 lần mỗi video.
- Có thể để một cảnh không ảnh cho câu trích dẫn/tuyên ngôn — sẽ thành trang chữ thuần có dấu ngoặc kép lớn.
- Ảnh: tĩnh lặng, ánh sáng tự nhiên dịu, tông kem–be–nâu, nhiều khoảng trống, chủ thể rõ (chất liệu, đồ vật, không gian, chân dung lặng).
- Kết bằng một câu đọng lại như lời ký tên của thương hiệu, không kêu gọi mua gắt.
<!-- /ai-guide -->

## File

- `src/styles/luxury/index.tsx` — bố cục dọc/ngang, bản in, trang chữ, nhãn con số, phụ đề + gạch vàng, monogram, trang tiêu đề.
- `src/styles/luxury/text.ts` — đo chữ bằng canvas, ngắt dòng, co cỡ chữ, in hoa tiếng Việt.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
