---
name: style-magazine
description: Phong cách "Tạp chí" — mỗi cảnh là một trang bìa tạp chí thời trang bóng láng: ảnh/video tràn trang đẩy vào chậm, măng-sét chữ có chân cực đậm căng ngang đầu trang, dòng "SỐ 01 · ẤN BẢN ĐẶC BIỆT", hộp chuyên mục màu nhấn, tít phụ đề chữ có chân lớn ở chân trang, câu nhấn thành dòng tít trong khối màu, con số bìa "5 bí quyết", tem tròn "MỚI!", mã vạch + giá, lật trang trượt ngang có vệt bóng giấy. Dùng cho thời trang, làm đẹp, người nổi tiếng, phong cách sống, xu hướng, giới thiệu sản phẩm.
---

# Phong cách: Tạp chí

`style: "magazine"` trong props. Tinh thần bìa tạp chí thời trang/phong cách sống ở sạp báo: ảnh chủ thể
tràn trang, chữ có chân tương phản cao, dòng tít bìa, tem, mã vạch. Code: `src/styles/magazine/`.

## Nhận diện hình ảnh

- Mỗi cảnh = một trang. Ảnh/clip phủ kín trang, đẩy vào chậm 1.04 → 1.14 suốt cảnh, tăng nhẹ tương phản/bão hoà
  cho cảm giác giấy láng. Lớp tối trên (cho măng-sét) và dưới (cho tít); ngang thêm tối nhẹ bên trái.
- **Măng-sét**: vài chữ đầu của `title` (≤ 12 ký tự), in hoa bằng JS, Playfair Display 900, đo bằng canvas để căng
  ~86% bề ngang (tối đa 230 đơn vị ở 9:16, 180 ở 1:1/3:4, 150 ở 16:9).
- Dưới măng-sét: dòng số báo Be Vietnam Pro 700 giãn chữ `SỐ 01 · ẤN BẢN ĐẶC BIỆT ——— 02/05` (trang/tổng).
- Góc dưới-phải: thẻ trắng mã vạch (vạch theo seed) + `SỐ 01  35.000₫`.
- Chữ trắng trên ảnh, mực `#141414` trên giấy. `accent` tô hộp chuyên mục, khối câu nhấn, vạch kicker, gạch chân.
  Tem tròn luôn vàng `#ffd60a` để tách khỏi màu nhấn.
- **Không ảnh** → trang chữ trên giấy ngà `#f3eee6`: số trang in chìm khổng lồ, hạt giấy nhẹ, phụ đề thành
  **trích dẫn** — dấu “ lớn màu nhấn, kicker "TRÍCH DẪN", chữ có chân mực đen to hơn 6%.
- Bố cục: 9:16 xếp dọc (cột giữa bên trái ở 30% chiều cao, tem bên phải). 16:9 và 1:1/3:4 dàn hai bên: tít
  dưới-trái, cột giữa dạt phải; tem ở trái trên tít (16:9) hoặc phải dưới dòng số báo (vuông, đẩy cột giữa xuống).

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | ảnh/clip tràn trang đẩy vào chậm (clip qua `SceneMedia`, tắt tiếng, lặp); null → trang chữ giấy ngà với trích dẫn |
| `tag` | hộp chuyên mục màu nhấn chữ trắng in hoa ("LÀM ĐẸP", "XU HƯỚNG") ngay dưới dòng số báo, mở ra từ trái khi trang đậu xong |
| `punch` | dòng tít bìa: khối màu nhấn nghiêng −2.5°, chữ trắng in hoa Be Vietnam Pro 900, bóng khối, nảy lên đúng `atMs`, giữ tới hết trang; cụm có nguyên văn trong câu đang hiện thì còn được in nghiêng + gạch chân màu nhấn |
| `visual` stat | con số bìa Playfair 900 rất lớn + chú thích in hoa đậm có vạch màu nhấn phía trên ("5 · BÍ QUYẾT GIỮ DA CĂNG BÓNG"); trên giấy số tô màu nhấn |
| `visual` badge | tem tròn răng cưa vàng, chữ in hoa + chú thích nhỏ, xoay vào như dán lên bìa rồi lắc rất nhẹ |
| `captions` | tít chân trang: vạch màu nhấn + kicker nhỏ ("CÂU CHUYỆN TRANG BÌA" / "TRANG 02" / "TRÍCH DẪN") + câu đang đọc Playfair 700, căn trái, co theo độ dài (104 → 60 đơn vị ở 9:16). Câu thuộc trang nó bắt đầu, trượt đi cùng trang |
| `title` | 70 frame đầu: bìa tự dựng — măng-sét rơi xuống, dòng số báo hiện, hộp "TRANG BÌA", `title` chữ có chân lớn trượt vào, `subtitle` kèm vạch màu nhấn, tem "MỚI!", vệt bóng quét chéo; rồi tít bìa rút sang trái nhường chỗ phụ đề |

## Chuyển động

- Easing `bezier(0.16, 1, 0.3, 1)` cho mọi thứ hiện ra; tem và dòng tít nhấn dùng `back(1.7)` nảy nhẹ.
- **Lật trang** 16 frame từ mốc đầu cảnh: trang mới trượt vào từ phải (xoay nhẹ quanh gáy trái, bóng đổ ở mép),
  trang cũ lùi 28% sang trái và tối đi; khi trang đậu có vệt bóng giấy láng quét chéo (`screen`).
- Mảnh của trang (chuyên mục, con số, tem) in sau khi lật xong; cảnh đầu có title thì đợi bìa xong.
- Mỗi câu mới: trượt lên + mở từ dưới 12 frame. Không dùng TransitionSeries (lệch mốc phụ đề).

## Lỗi cần tránh

- `title` mở đầu bằng một từ quá dài → măng-sét co nhỏ, mất khí chất bìa. Tiêu đề mở bằng cụm ngắn kiểu thương hiệu đẹp nhất.
- `punch` > 5 từ → khối tít xuống hai ba dòng, đè ảnh chủ thể; cụm không có trong câu đọc thì không được gạch chân.
- Trang giấy (image null) + stat + punch + câu dài 3 dòng ở 9:16 là sát nhau — trang chữ nên để trống visual.
- Tag dài hơn ~16 ký tự không xuống dòng.
- Ảnh có chủ thể nằm sát mép dưới sẽ bị tít che; ảnh chân dung/sản phẩm đặt giữa hoặc trên là hợp nhất.
- Phụ đề tuỳ chỉnh (`captionLook`) thay tít chân trang bằng lớp phụ đề chung — trang vẫn vẽ bình thường.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 3–6 cảnh, mỗi cảnh 1–2 câu ngắn, giọng biên tập viên tạp chí: sành điệu, chắc chắn, gợi cảm hứng (tối đa ~45 ký tự mỗi câu, không hô hào hay chấm than dồn dập).
- Câu viết như tít bìa: cụ thể, có chi tiết thị giác (màu, chất liệu, món đồ, tên xu hướng). Mạch: mở bìa bằng một nhận định "mùa này ai cũng…" → từng bí quyết/xu hướng → câu kết đọng lại.
- `title` như tít bìa chính (≤ 40 ký tự, ví dụ "5 xu hướng làm đẹp mùa thu"); `subtitle` như dòng phụ bìa.
- `tag` là chuyên mục tạp chí, 1–2 từ (≤ 16 ký tự): "XU HƯỚNG", "LÀM ĐẸP", "THỜI TRANG", "PHONG CÁCH", "BÍ QUYẾT", "SĂN ĐỒ". Nên có ở hầu hết các cảnh.
- `punch` PHẢI chép nguyên văn từ một câu của chính cảnh đó, 2–5 từ, đọc như dòng tít bìa đắt nhất ("da căng bóng", "tự tin là đẹp nhất"). Tối đa một punch mỗi cảnh.
- `visual` stat cho con số bìa kiểu "5 | bí quyết giữ da căng bóng", "3 | món nên có"; badge cho tem ngắn "MỚI!", "HOT", "BÍ MẬT" (≤ 8 ký tự). Mỗi cảnh tối đa một visual, cả video 1–2 cái.
- Mỗi cảnh nên có một ảnh chân dung, người mẫu, trang phục hoặc sản phẩm rõ nét, chủ thể ở giữa/trên khung. Muốn một trang trích dẫn thì để một cảnh không ảnh với câu đáng trích.
<!-- /ai-guide -->

## File

- `src/styles/magazine/index.tsx` — ghép trang, lật trang trượt ngang, tên măng-sét, chia câu theo trang
- `src/styles/magazine/Page.tsx` — một trang: ảnh/giấy, lớp tối, bố cục mọi mảnh, bìa mở đầu, tít chân trang, vệt bóng
- `src/styles/magazine/Bits.tsx` — măng-sét (đo canvas), dòng số báo, hộp chuyên mục, con số bìa, dòng tít nhấn, tem tròn, mã vạch
