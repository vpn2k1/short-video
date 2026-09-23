---
name: style-timeline
description: Phong cách "Dòng thời gian" — trục thời gian chạy suốt video (dọc ở 9:16, ngang ở 16:9/1:1), mỗi cảnh là một mốc có năm ghi thật lớn, camera cuộn tới mốc đang đọc, mốc cũ mờ đi nhưng giữ năm, vạch màu nhấn chạy dài theo tiến độ, ảnh trong thẻ bo góc gắn vào mốc, câu nhấn quét bút dạ kèm tia sáng ở mốc. Dùng cho lịch sử, tiểu sử, lịch sử công ty/thương hiệu, sự tiến hoá của một thứ, "từ năm … đến nay", trình tự các giai đoạn.
---

# Dòng thời gian (timeline)

## Nhận diện hình ảnh

- Nền giấy ngà (khi `background` sáng) hoặc bảng đá xám tối (khi `background` tối), lưới kẻ ô mảnh
  trôi chậm hơn trục khi cuộn, vầng màu nhấn nhạt góc trên, hạt giấy nhẹ.
- Một trục thời gian duy nhất: khung dọc là trục dọc sát lề trái, khung ngang/vuông là trục ngang phía trên.
  Vạch nền xám, vạch màu nhấn (có quầng sáng) chạy từ đầu trục tới "đầu bút" — chấm sáng nhỏ đang chạy.
- Mốc đang xem: chấm màu nhấn to có quầng, năm Montserrat 800 cỡ rất lớn cạnh mốc (dọc) hoặc trên mốc (ngang).
  Mốc đã qua: chấm nhỏ, năm nhỏ màu mờ. Mốc sắp tới: vòng rỗng mờ, KHÔNG hiện năm (không lộ trước).
- Thẻ bo góc có bóng mềm gắn vào mốc bằng một gạch nối màu nhấn: ảnh/clip bo góc phóng chậm, dòng
  "MỐC 03 / 05" màu nhấn, lời đọc chữ có chân Lora (giọng sách sử).
- Tông trầm tĩnh, gọn, biên tập — không nảy, không rung.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `tag` | Nhãn năm của mốc ("1945", "Thế kỷ 19", "Hôm nay") — to khi đang xem, nhỏ và mờ khi đã qua. Không có tag → số thứ tự "01", "02"… Tag đầu và cuối ghép thành dòng "1857 — Hôm nay" trên trang tiêu đề. |
| `image` | Ảnh/clip trong thẻ, phủ kín khung bo góc, phóng 1.02→1.1 suốt cảnh. Clip phát từ đầu cảnh qua `SceneMedia` (cắt đầu, tốc độ, crop đều có tác dụng). |
| `image: null` | Khung ảnh thành "mốc chữ": nền màu nhấn nhạt kẻ ô, năm của mốc cỡ khổng lồ màu nhấn có bóng lệch. |
| `punch` | Trong câu thoại chứa nguyên văn cụm đó: cụm in đậm, bút dạ màu nhấn quét qua trong 14 frame đúng `punch.atMs`; cùng lúc mốc nảy lên và bật 8 tia sáng + vòng lan. Không có phụ đề (đang dùng kiểu phụ đề tuỳ chỉnh) → thẻ hiện chính câu nhấn. |
| `visual` stat | Con số Montserrat 900 màu nhấn, đếm từ 0 (số nguyên, "1.800"), chú thích bên dưới. Khung dọc: ô nổi góc dưới-trái ảnh. Khung ngang/vuông: chân cột chữ, có vạch ngăn. Không ảnh: giữa tấm mốc chữ. |
| `visual` badge | Nhãn màu nhấn góc trên-trái ảnh, chữ in hoa bằng JS. |
| `captions` | Câu đang đọc của cảnh nằm trong thẻ (dưới ảnh ở khung dọc, cột phải ở khung ngang). Cỡ chữ tính trước từ câu dài nhất (tối đa 4 dòng ở khung dọc) nên thẻ không nhảy. Câu thuộc cảnh đang chạy lúc câu bắt đầu. |
| `title/subtitle` | Trang tiêu đề khi `showTitle`: trục vẽ dần, mốc lớn bật ra ngang dòng đầu, khoảng năm, tiêu đề, gạch màu nhấn, dòng phụ. |

## Chuyển động

- Camera cuộn: sang cảnh mới thì vị trí trục trượt đúng một mốc trong 22 frame (bezier 0.65,0,0.35,1).
  Các bước trượt cộng dồn nên cảnh ngắn hơn 22 frame vẫn không nhảy.
- Vạch màu nhấn chạy từ mốc hiện tại tới mốc sau đúng lúc hết cảnh; cảnh cuối chỉ chạy quá 0.6 bước.
- Thẻ cũ tắt trong nửa đầu cú cuộn (trôi theo hướng cuộn, thu nhỏ 5%), thẻ mới hiện trong nửa sau —
  hai thẻ không chồng mờ lên nhau.
- Năm của mốc phóng dần từ cỡ nhỏ lên cỡ lớn theo khoảng cách tới camera (liên tục, không cắt).
- Lời đọc: mỗi câu mới mờ vào + trượt lên 14px trong 10 frame.
- Trang tiêu đề: trục vẽ 0→30, mốc bật 6→18, chữ lần lượt 10/13/20/27; trôi đi ở frame 52–66,
  mốc và thẻ vào từ frame 56.

## Lỗi cần tránh

- Punch phải chép NGUYÊN VĂN từ một câu thoại của cảnh, nếu không chỉ còn tia sáng ở mốc, không có bút dạ.
- Tag dài (> 12 ký tự) bị co nhỏ để nằm một dòng — viết "Thế kỷ 19", đừng viết "Vào khoảng cuối thế kỷ 19".
- Mốc sắp tới cố ý không hiện năm; đừng "sửa" để hiện — sẽ lộ trước nội dung.
- Không dùng `fontStretch: condensed` hay CSS `text-transform` — in hoa bằng `toLocaleUpperCase("vi")`.
- Mọi `interpolate` có mốc tách riêng (`ramp` với length ≥ 1) để cảnh ngắn không sinh dãy mốc trùng.
- Lời đọc quá dài (> ~90 ký tự một câu) bị co chữ cho vừa 4 dòng ở khung dọc — chia câu thay vì để chữ bé.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 4–7 cảnh, mỗi cảnh là MỘT mốc thời gian theo đúng thứ tự trước → sau; 1–2 câu đọc mỗi cảnh.
- `tag`: BẮT BUỘC gần như mọi cảnh — mốc thời gian ngắn ≤12 ký tự: năm ("1945"), thập niên ("Thập niên 90"), "Thế kỷ 19", tuổi ("Năm 25 tuổi"), "Hôm nay", "2030?". Không viết cả câu, không lặp tag.
- Câu đầu mỗi cảnh nói điều gì xảy ra ở mốc đó (sự kiện cụ thể, tên người/nơi), câu sau nói hệ quả hoặc chi tiết đắt.
- `punch`: 2–5 từ, chép NGUYÊN VĂN từ một câu đọc trong cảnh — bước ngoặt, con số, kết quả. Tối đa 3 cảnh có punch.
- `visual`: `stat` cho con số đo được sự thay đổi ở mốc đó (text ngắn như "1.800", "3 triệu", caption giải thích); `badge` cho tên giai đoạn ("Giai đoạn 2"). Không lạm dụng.
- Ảnh: tư liệu hợp thời kỳ — ảnh cũ, chân dung nhân vật, sản phẩm đời đầu, địa điểm. Cảnh không có ảnh vẫn đẹp (năm hiện khổng lồ).
- Cảnh cuối nên là "Hôm nay" hoặc tương lai, chốt bằng ý nghĩa của cả hành trình.
- Giọng: người kể sử gọn gàng, chính xác, có nhịp tiến lên — câu ngắn, mốc rõ, tránh tính từ sáo rỗng.
<!-- /ai-guide -->

## File

- `src/styles/timeline/index.tsx` — hình học theo tỉ lệ khung, vị trí camera, tiến độ, gán câu cho cảnh, lớp nền, gạch nối, vòng đời thẻ.
- `src/styles/timeline/Axis.tsx` — vạch trục, vạch tiến độ, mốc, nhãn năm, tia sáng câu nhấn.
- `src/styles/timeline/Card.tsx` — thẻ mốc: ảnh/clip, tấm mốc chữ, stat, badge, lời đọc có bút dạ.
- `src/styles/timeline/TitleIntro.tsx` — trang tiêu đề.
- `src/styles/timeline/theme.ts` — màu giấy/đá, font, easing, `scrollPosition`, ước lượng dòng, tách câu nhấn.
