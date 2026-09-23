---
name: style-documentary
description: Phong cách "Phim tài liệu" — ảnh toàn khung chuyển động chậm, hạt phim, nhãn địa điểm gõ máy chữ, mẩu báo cắt cho câu nhấn. Dùng cho kể chuyện nghiêm túc, du lịch, địa danh, con người, điều tra, hồi ký.
---

# Phong cách: Phim tài liệu

`style: "documentary"` trong props. Tinh thần explainer kiểu phóng sự ảnh: chất liệu, hạt phim,
ảnh tư liệu, nhãn máy chữ, mẩu báo cắt. Code: `src/styles/documentary/`.

## Nhận diện hình ảnh

- Ảnh/video của cảnh phủ kín khung, Ken Burns chậm: chiều zoom (vào/ra) và hướng pan theo seed từng cảnh.
- Chỉnh màu điện ảnh bằng filter tĩnh: bớt bão hoà, ngả sepia nhẹ, tăng tương phản; tint nâu ấm `soft-light`.
- Vignette, rò sáng cam mềm (gradient `screen`, sáng lên ở điểm cắt), nhấp nháy máy chiếu ±5%, `<Grain/>` động.
- Ngang (16:9, 2:1): hai dải letterbox đen 5% chiều cao. Dọc/vuông: gradient tối trên và dưới.
- Chữ: serif Georgia cho tít/phụ đề/con số, mono cho nhãn máy chữ. Không dùng `accent` — bảng màu cố định ngà/nâu/đỏ mực.
- Không ảnh: gradient nâu tối như giấy ảnh cũ + hạt dày, dùng màu `background`.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | nền toàn khung đã chỉnh màu; video tắt tiếng, lặp, zoom nhẹ; null → giấy tối |
| `tag` | góc trên-trái trong vùng an toàn: chấm đỏ + vạch mảnh + chữ mono IN HOA gõ từng ký tự, hiện ~0.3s sau đầu cảnh (cảnh đầu có title thì đợi title tắt) |
| `punch` | mẩu báo cắt: giấy ngà, mép xé (clip-path), tít serif đậm, nghiêng 1.5–3°, rơi xuống đúng `atMs`, giữ tới cuối cảnh. Dọc: giữa màn hình (~40% chiều cao); ngang: bên phải phía trên. Nếu cụm có nguyên văn trong phụ đề đang hiện thì cụm đó còn được in nghiêng màu ngà ấm |
| `visual` stat | con số serif rất lớn + vạch vàng mảnh + chú thích small caps; dọc: dưới tag, ngang: bên trái |
| `visual` badge | nhãn đóng dấu mực đỏ viền đôi, nghiêng, góc trên-phải |
| `captions` | phụ đề serif trắng, bóng mềm, một vạch vàng ngắn phía trên; mỗi lúc một câu, fade + trượt nhẹ |
| `title` | 70 frame đầu: làm tối ảnh đầu, dòng máy chữ `phim tài liệu`, tít serif hiện lên, vạch mảnh, `subtitle` small caps giãn chữ |

## Chuyển động

- Chậm và điềm tĩnh: easing `bezier(0.16, 1, 0.3, 1)`, không lò xo nảy.
- Chuyển cảnh: cảnh sau fade vào trong 16 frame trước mốc cắt + nhúng tối (đỉnh 55%) + rò sáng bùng lên.
- Overlay của cảnh (tag, punch, visual) mờ đi cùng lúc cross-fade bắt đầu.
- Không dùng TransitionSeries (rút ngắn timeline, lệch phụ đề). Không có thanh tiến độ.

## Lỗi cần tránh

- Ảnh sáng, phẳng hoặc đồ hoạ vector: filter sepia làm bẩn màu — ưu tiên ảnh chụp thật.
- `punch` quá dài (> 6 từ) → tít co nhỏ, mẩu báo mất lực; cụm không có trong câu đọc thì không được in nghiêng.
- Cảnh vừa có `visual` stat vừa có `punch` ở 9:16 là vừa khít; thêm câu phụ đề 3 dòng sẽ sát mẩu báo.
- Tag dài hơn ~18 ký tự tràn ngang ở 9:16 (không xuống dòng).
- Nhúng tối cần cảnh dài ≥ 1 giây, cảnh quá ngắn nhìn như chớp.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 2–5 cảnh, mỗi cảnh 2–3 câu. Giọng kể chuyện điềm tĩnh, câu trần thuật trọn vẹn (tối đa ~50 ký tự), không hô hào hay dùng dấu chấm than.
- Mạch như phóng sự: bối cảnh → sự việc → hệ quả/ý nghĩa. Câu đầu mở ra một chi tiết cụ thể gây tò mò.
- `tag` là địa điểm, mốc thời gian hoặc tên người (≤ 18 ký tự), ví dụ "Hà Nội · 1986", "Cupertino, 2007". Mỗi cảnh nên có tag.
- `punch` PHẢI chép nguyên văn từ một câu của chính cảnh đó, 2–6 từ, đọc lên như tít báo (ví dụ "mất trắng 40 năm"). Mỗi cảnh tối đa một punch; không có cụm đắt thì để null.
- Mỗi cảnh nên có một ảnh chụp thật mạnh (người, nơi chốn, đồ vật) nếu danh sách ảnh có; tránh ảnh minh hoạ/đồ hoạ.
- `visual` dùng dè sẻn: chỉ một con số then chốt cả video (stat), badge hầu như không cần.
- Giữ tông nghiêm túc, tôn trọng sự thật; không bịa số liệu, ngày tháng hay tên riêng.
<!-- /ai-guide -->

## File

- `src/styles/documentary/index.tsx` — ghép lớp
- `src/styles/documentary/Footage.tsx` — ảnh/video, Ken Burns, chỉnh màu, lớp phim, letterbox
- `src/styles/documentary/Overlays.tsx` — tag, phụ đề, mẩu báo, visual, title
