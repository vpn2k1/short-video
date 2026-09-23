---
name: style-cinematic
description: Phong cách "Điện ảnh" — viền đen điện ảnh trượt vào, chỉnh màu teal–cam, dolly chậm, phụ đề chữ có chân, câu nhấn hiện như tiêu đề trailer giữa màn hình tối. Dùng cho kể chuyện cảm xúc, trailer, du lịch, thương hiệu, chân dung con người, câu chuyện giàu không khí.
---

# Phong cách: Điện ảnh

`style: "cinematic"` trong props. Tinh thần trailer phim: khung hình hẹp, màu phim, chữ ít mà sang,
nhịp chậm và có khoảng lặng. Code: `src/styles/cinematic/`.

## Nhận diện hình ảnh

- Hai dải viền đen trượt vào trong 20 frame đầu và nằm trên mọi lớp. Dọc 9:16: mỗi dải 10% chiều cao;
  3:4/1:1: 8%; ngang 16:9/2:1: ép khung hình về 2.39:1. Chữ luôn nằm TRONG vùng hình, không đè lên viền.
- Ảnh/video phủ kín khung, dolly đẩy vào (đôi khi lùi ra) và lia rất nhẹ theo seed từng cảnh.
- Chỉnh màu tĩnh: bộ lọc SVG `feComponentTransfer` kéo vùng tối về xanh lục lam, vùng sáng về cam,
  cộng `contrast/saturate` nhẹ. Không blur, không đổi theo frame. Thêm ám lạnh `soft-light`, vignette mờ,
  gradient tối dưới cho phụ đề, `<Grain/>` 10%.
- Vệt sáng anamorphic: một đường ngang mảnh xanh–trắng loé lên ~1 s khi vào cảnh mới (và lúc title tắt).
- Chữ: chỉ `FONTS.serif` (Georgia) — phụ đề, tag, tiêu đề trailer, con số. Màu ngà trắng `#f5f1e8`, bóng mềm.
- Cảnh không ảnh: nền gần đen, hai vầng sáng cam/teal trôi chậm.
- `accent` không dùng. `background` chỉ pha 18% vào nền cảnh không ảnh.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | nền toàn khung đã chỉnh màu + dolly; video qua `ClipVideo` (tôn trọng `crop`, `trimStartMs`, `volume`), ảnh qua `CropBox`; null → nền tối có vầng sáng trôi |
| `captions` | mỗi lúc một câu, serif hoa thường tự nhiên, cỡ vừa (66 → tối thiểu 50 × unit, ngang 58 → 44), fade + nhích lên 16px; ẩn trong lúc title và lúc tiêu đề trailer đang giữ |
| `captionPosition` | `bottom`: đáy khối ở `max(captionBottom, viền + 44u)` — ngay trên viền dưới, ngoài vùng UI nền tảng; `center`: giữa khung, visual dời lên dưới tag |
| `tag` | góc trên-trái trong vùng hình, dưới viền: vạch mảnh + chữ serif in hoa (JS) kiểu `— HỘI AN, 2026`; hiện 14 frame sau đầu cảnh (cảnh đầu có title thì sau title), trượt nhẹ từ trái |
| `punch` | đúng `atMs`: hình tối 62%, cụm từ in hoa (JS) serif lớn giữa khung giữa hai vạch mảnh, thu 1.04 → 1, vào 9 frame, giữ 36 frame (~1.2 s), tắt 12 frame. Tag/visual/phụ đề nhường chỗ lúc này |
| `visual` stat | con số serif cỡ rất lớn (9:16: 300u, 1:1: 200u, ngang: 250u) + chú thích nghiêng giữa hai vạch; giữa khung phần trên, hiện 20 frame sau đầu cảnh, giữ tới cuối cảnh |
| `visual` badge | thẻ chương giữa khung: `— CHƯƠNG II —` in hoa serif + chú thích nghiêng, hình tối 35%, hiện ~2.5 s đầu cảnh rồi lui |
| `title`/`subtitle` | 70 frame: màn đen, tít serif hiện dần (thu 1.03 → 1), vạch mảnh, subtitle nghiêng; chữ tắt trước, màn đen mở dần vào cảnh đầu |

## Chuyển động

- Chậm và êm: easing `bezier(0.22, 1, 0.36, 1)`, không lò xo, không rung.
- Chuyển cảnh: cảnh sau hoà vào trong ±6 frame quanh mốc cắt, đồng thời nhúng đen (đỉnh 88%) trong ±12 frame.
  Tag/visual của cảnh cũ mờ đi 12 frame trước mốc cắt.
- Không dùng TransitionSeries (rút ngắn timeline, lệch phụ đề). Không có thanh tiến độ.
- Âm thanh, chữ tự do và watermark do composition Short vẽ — style không đụng tới.

## Lỗi cần tránh

- KHÔNG dùng CSS `letter-spacing`, `text-transform` hay `font-variant: small-caps` — móc Ư/Ơ bị tách.
  In hoa bằng `upperVi()` (`normalize("NFC").toLocaleUpperCase("vi")`). Đã render kiểm
  "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" ở cả phụ đề và tiêu đề trailer với Georgia: dấu đúng, không chồng dòng.
- Georgia không có nét mảnh (thin): con số "mảnh" nhờ cỡ lớn + màu hơi trong. Đừng đổi sang font khác
  chưa kiểm dấu tiếng Việt.
- Punch dài (> 5 từ) xuống 2–3 dòng, cỡ co về 50% — mất chất tiêu đề trailer.
- Punch rơi trong ~2.5 s đầu cảnh có badge: thẻ chương bị nhường chỗ, gần như không ai kịp đọc.
- Hai punch cách nhau < 2 s: thẻ sau cắt ngang thẻ trước.
- Tag dài hơn ~24 ký tự tràn ngang ở 9:16 (không xuống dòng).
- Ảnh sáng, phẳng, đồ hoạ vector: bảng teal–cam làm bẩn màu; ảnh tối vừa, có nguồn sáng rõ đẹp nhất.
- Cảnh ngắn dưới ~1 s: nhúng đen và dolly nhìn như chớp.
- 1:1 + `captionPosition: "center"`: con số tự nhỏ còn 150u để nằm trên phụ đề; stat dài (> 5 ký tự) sẽ sát phụ đề.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 3–5 cảnh, mỗi cảnh 2–3 câu. Giọng kể chậm, giàu hình ảnh, như lời dẫn trailer; câu trần thuật ngắn,
  mỗi câu ≤ 55 ký tự (phụ đề tối đa 2 dòng). Được dùng câu lửng, không dùng dấu chấm than, không viết IN HOA cả câu.
- Hook: câu đầu là một hình ảnh cụ thể hoặc một khoảnh khắc lặng ("Năm giờ sáng, bến sông vẫn chưa có ai.").
- Mạch: bối cảnh → nhân vật/khoảnh khắc → bước ngoặt → dư âm. Kết bằng một câu lắng đọng hoặc gợi mở,
  ngắn hơn các câu khác (ví dụ "Và nghề vẫn còn đó.").
- `tag`: địa điểm, mốc thời gian hoặc tên chương, ≤ 24 ký tự, dạng "Hội An, 2026", "Bình minh", "Ba mươi năm sau".
  Không cần dấu gạch đầu — style tự thêm. Nên có ở hầu hết các cảnh.
- `punch`: 2–5 từ, PHẢI chép nguyên văn từ một câu của chính cảnh đó, đọc lên như tiêu đề trailer
  ("người cuối cùng", "không bao giờ quay lại"). `atMs` nằm trong khoảng thời gian của câu chứa cụm đó.
  Mỗi cảnh tối đa một punch; cả video 2–3 punch là đẹp nhất, các punch cách nhau ≥ 3 giây.
- `visual` dùng dè sẻn: tối đa một stat cả video cho con số then chốt ("30 năm", "1 người", "4.000 km");
  badge chỉ khi video chia chương ("Chương I", "Phần hai"), đặt ở cảnh mở chương và đừng cho punch rơi vào 3 giây đầu cảnh đó.
- `image`: ảnh chụp thật, có ánh sáng và chiều sâu — người, gương mặt, phong cảnh, hoàng hôn, đường phố đêm;
  video quay chậm rất hợp. Tránh ảnh studio nền trắng, ảnh chụp màn hình, đồ hoạ phẳng. Cảnh không ảnh chỉ nên dùng cho cảnh kết.
- Tôn trọng sự thật: không bịa tên người, số liệu, ngày tháng.
<!-- /ai-guide -->

## File

- `src/styles/cinematic/index.tsx` — ghép lớp theo thứ tự
- `src/styles/cinematic/cine.ts` — hằng số nhịp, chiều cao viền đen, cửa sổ tiêu đề trailer, `upperVi`
- `src/styles/cinematic/Footage.tsx` — ảnh/video, dolly, chỉnh màu teal–cam, lớp ống kính (vignette, hạt, nhúng đen, vệt sáng), viền đen
- `src/styles/cinematic/Text.tsx` — phụ đề, tag, tiêu đề trailer, stat/badge, title mở đầu
