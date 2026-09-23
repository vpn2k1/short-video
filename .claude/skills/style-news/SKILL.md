---
name: style-news
description: Phong cách "Bản tin nóng" — nhãn TRỰC TIẾP, đồng hồ, dải tiêu đề dưới màn hình kiểu truyền hình, thanh NÓNG đỏ cho câu nhấn, chữ chạy ở đáy. Dùng cho tin tức, cập nhật, sự kiện vừa xảy ra, thông báo chính thức, tóm tắt tin trong ngày.
---

# Phong cách: Bản tin nóng (TV breaking news)

`style: "news"` trong props. Code: `src/styles/news/`.

## Nhận diện hình ảnh

- Ảnh/video của cảnh phủ toàn khung (dùng chung `Scenes`: Ken Burns, cross-fade, crop), gradient tối trên/dưới
  để đồ hoạ đọc được. Cảnh không có ảnh → trường quay ảo navy (`#0B1B3F`): lưới mảnh trôi, vệt sáng chéo, vòng tròn nét đứt.
- Góc trên trái: khối logo màu `accent` chữ "TIN" + nhãn đỏ `#D71920` "● TRỰC TIẾP", chấm nhấp nháy.
  Góc trên phải: đồng hồ mono `HH:MM`, bắt đầu 07:30 và chạy theo thời gian video.
- Dải dưới (lower third): nhãn chuyên mục đỏ (tag cảnh) → thanh tiêu đề navy viền `accent` (title) → dải trắng chữ đen (phụ đề).
  Dọc 9:16: xếp chồng, chữ to. Ngang 16:9 và vuông 1:1: nhãn chuyên mục nằm bên trái thanh tiêu đề như TV.
- Ticker ở đáy vùng nội dung: nhãn vàng "MỚI" + chữ chạy (tiêu đề • phụ đề • các tag) lặp liền mạch.
- Chữ in hoa (nhãn, NÓNG, câu nhấn) in hoa bằng JS `normalize("NFC").toLocaleUpperCase("vi")`, font `FONTS.sans` đậm, không giãn chữ.
- Toàn bộ dải dưới + ticker nằm TRÊN vùng nền tảng chiếm (`safe.bottom`); chữ nằm trong `safe.side`, nền dải được tràn mép.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu đang đọc trong dải trắng, tối đa 2 dòng, cỡ chữ đo bằng canvas cho vừa; câu quá dài thì cắt "…". Mỗi câu mới gạt ngang vào (7 frame) |
| `title` | thanh tiêu đề dải dưới (cố định suốt video), tối đa 2 dòng; ngang ưu tiên 1 dòng. Cũng là tít lớn của phần mở đầu |
| `subtitle` | dải trắng trong phần mở đầu; chữ chạy ticker; hiện ở dải phụ đề khi chưa có câu nào |
| `tag` | nhãn chuyên mục đỏ của cảnh (trống → "TIN NÓNG"), gạt lại khi đổi cảnh; cũng chạy trong ticker |
| `punch` | đúng `atMs`: thanh đỏ toàn khung "NÓNG" + câu nhấn in hoa đập vào ngay trên dải dưới, giữ ~1,5 giây |
| `visual` stat | hộp số liệu góc trên phải: nhãn "SỐ LIỆU", số lớn đếm lên giữ tiền tố/hậu tố (`80%`, `+30K`, `1.200`, `2,5 triệu`), gạch accent, chú thích |
| `visual` badge | chip chuyên mục màu accent góc trên phải, `caption` trong dải navy bên dưới |
| `image` | ảnh/video toàn khung; `null` → trường quay navy |
| `accent` | khối logo, viền thanh tiêu đề, viền ticker, vệt chuyển cảnh |
| `showTitle` | mở đầu 70 frame; dải dưới chỉ vào khi phần mở đầu kết thúc |
| `captionPosition` | không dùng — phụ đề luôn nằm trong dải dưới |

## Chuyển động

- Mở đầu: khối "TIN NÓNG" đập vào (scale 1.7 → 1, rung nhẹ) kèm 7 vệt gió quét ngang; thanh tiêu đề gạt ra từ frame 10,
  từng dòng tít trượt vào lệch 5 frame; dải phụ đề gạt vào frame 28; frame 58–70 cả cụm trượt xuống mờ đi.
- Dải dưới vào bằng clip-path gạt trái → phải (nhãn, thanh tiêu đề, dải trắng lệch nhau vài frame). Đổi câu: gạt chữ + mép vàng chạy theo.
- Thanh NÓNG: trượt từ trái vào 7 frame + chớp trắng 5 frame, sọc chéo chạy; 8 frame cuối trượt ra phải.
- Chuyển cảnh: vệt chéo accent + đỏ + viền trắng quét ngang ~10 frame, tâm đúng điểm cắt (không có ở cảnh đầu).
- Ticker chạy trái đều 3,4 px/frame (theo `unit`) từ frame 0; mỗi vòng là một ô rộng bằng số đo canvas nên lặp không giật.
- Chấm TRỰC TIẾP nhấp nháy chu kỳ 30 frame; dấu hai chấm đồng hồ nhấp nháy mỗi giây.
- Mọi thứ suy từ `useCurrentFrame()`; ngẫu nhiên dùng `seeded()`; không blur động toàn khung.

## Lỗi cần tránh

- Đừng dùng CSS `text-transform: uppercase`, `FONTS.condensed` hay `letter-spacing` cho chữ in hoa: móc Ư/Ơ tách rời.
  Kiểm bằng still với câu "ĐỪNG THƯỜNG ƯU ƠN NHỮNG".
- Đừng đặt dải dưới theo `captionBottom` cộng thêm — thứ tự xếp là `safe.bottom` → ticker → dải dưới → thanh NÓNG;
  đổi chiều cao ticker thì cả khối tự dời.
- Chiều cao dải phụ đề/thanh NÓNG tính trước từ TOÀN BỘ câu — đừng tính theo câu hiện tại, bố cục sẽ nhảy.
- Canvas và DOM đo lệch vài phần trăm: `fitText` đã chừa 5%; chữ render theo từng dòng đã chia sẵn và `nowrap`.
- `tag` dài (> 18 ký tự) bị co chữ trong nhãn; title > 60 ký tự ở 16:9 sẽ xuống 2 dòng và thanh tiêu đề cao lên.
- Punch dài cả câu → thanh NÓNG hai dòng chữ nhỏ, mất lực.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng bản tin trung lập, rõ ràng, khách quan: nêu sự việc, nguồn, con số; không cảm thán, không giật tít.
- 3–5 cảnh, mỗi cảnh 1–3 câu; câu ngắn gọn (tối đa ~90 ký tự) vì phụ đề chỉ có 2 dòng.
- Câu đầu tiên nêu ngay tin chính: ai / cái gì / khi nào ("Sáng 14/9, Bộ Y tế công bố…").
- `title`: tít tin ngắn ≤ 60 ký tự, dạng câu tin khẳng định, viết hoa đầu câu ("Giá xăng giảm lần thứ ba liên tiếp").
- `subtitle`: dòng phụ ngắn (chuyên mục, thời điểm, nguồn) — khác `title`.
- `tag`: chuyên mục ngắn ≤ 18 ký tự cho từng cảnh, ví dụ "KINH TẾ", "CẬP NHẬT", "CẢNH BÁO", "THỜI TIẾT", "Ý KIẾN CHUYÊN GIA".
- `punch`: con số hoặc cụm từ quan trọng nhất của cảnh, 2–6 từ, PHẢI chép nguyên văn từ một câu của cảnh; tối đa một punch mỗi cảnh, không cần mọi cảnh có.
- `visual` stat cho số liệu chính ("2,5 triệu", "80%", "+30K") kèm caption giải thích ngắn; badge cho mốc/bước ("BƯỚC 1", "HÔM NAY"). Không dùng cho mọi cảnh.
- `image`: ảnh/video thật, liên quan trực tiếp đến tin (hiện trường, nhân vật, sản phẩm, địa điểm); `null` khi không có hình phù hợp (hiện trường quay navy).
- Không đưa thông tin chưa kiểm chứng, tin đồn hay lời khẳng định giật gân; số liệu ghi rõ nguồn trong lời đọc.
<!-- /ai-guide -->

## File

- `src/styles/news/index.tsx` — ghép lớp theo thứ tự, title intro, vệt chuyển cảnh
- `src/styles/news/layout.ts` — bố cục theo tỉ lệ khung + dữ liệu (chiều cao dải, cỡ chữ đã fit), chuỗi ticker
- `src/styles/news/theme.ts` — màu, easing, in hoa, đo chữ canvas + chia dòng/fit, tách số liệu
- `src/styles/news/Backdrop.tsx` — ảnh/video cảnh + trường quay navy + gradient
- `src/styles/news/Chrome.tsx` — logo + TRỰC TIẾP, đồng hồ, ticker
- `src/styles/news/LowerThird.tsx` — nhãn chuyên mục, thanh tiêu đề, dải phụ đề, thanh NÓNG
- `src/styles/news/Graphics.tsx` — hộp số liệu / chip, vệt gạt chuyển cảnh
- `src/styles/news/TitleIntro.tsx` — phần mở đầu "TIN NÓNG"
