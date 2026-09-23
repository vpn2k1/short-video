---
name: style-ranking
description: Phong cách "Top xếp hạng" — đếm ngược #5 → #1, số hạng khổng lồ đập vào rồi thu về góc thẻ ảnh, thanh tên món, bảng xếp hạng lấp dần "???" → tên theo từng cảnh, cảnh #1 mạ vàng có vương miện và lấp lánh, câu nhấn trong viên vàng có vệt sáng. Dùng cho top list, xếp hạng, so sánh nhiều thứ, món ăn, địa điểm, sản phẩm, kỷ lục, đếm ngược.
---

# Phong cách: Top xếp hạng (countdown)

`style: "ranking"` trong props. Code: `src/styles/ranking/`.

## Nhận diện hình ảnh

- Sân khấu tối `#07080E`: đèn rọi từ trên nhuộm màu `accent`, hai luồng sáng đung đưa, sàn hắt sáng, lưới chấm mờ,
  vignette, hạt tĩnh. Cảnh #1 chuyển toàn bộ ánh đèn sang vàng.
- Mỗi cảnh = một hạng. Ảnh/video nằm trong thẻ bo góc lớn (Ken Burns chậm + lia nhẹ), không phủ toàn khung.
- Số hạng "#N" khổng lồ (dấu # nhỏ nâng lên, số trắng đổ bóng cứng màu `accent`) đập vào giữa thẻ rồi thu về
  ô hạng ở góc trái trên. Thanh tên in hoa (màu `accent`, chữ trắng hoặc đen tuỳ độ sáng) gối lên mép dưới ảnh.
- Bảng xếp hạng luôn hiện, xếp từ #1: hạng đã qua hiện tên, hạng chưa tới hiện "???" viền nét đứt, hạng đang chiếu
  tô màu và phát sáng.
  Dọc 9:16 / 3:4: dải ô ngang trên cùng (trong `safe.top`). Ngang 16:9 và vuông 1:1: cột phải có tiêu đề "🏆 BẢNG XẾP HẠNG".
- Hạng #1: số gradient vàng, vương miện SVG, viền thẻ vàng phát sáng, thanh tên vàng chữ đen, ô hạng đen viền vàng,
  lấp lánh 4 cánh rải theo seed.
- Phụ đề: dải trắng bo tròn, chữ đen `FONTS.sans` 800, gạch chân `accent`, tối đa 2 dòng đã cân dòng.
- Chữ in hoa (tên món, câu nhấn, nhãn) in hoa bằng JS `normalize("NFC").toLocaleUpperCase("vi")`, không giãn chữ.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `scenes` | mỗi cảnh một hạng, một thẻ. Số cảnh = N của "TOP N" và số ô bảng xếp hạng |
| `tag` | có số ở đầu (`#3 Bánh mì`, `3. Phở`, `Top 3: Phở`) → hạng 3, tên "Bánh mì". Không có số → đếm ngược theo thứ tự cảnh (cảnh đầu = N, cảnh cuối = #1). Tên trống → dùng chữ của `punch` |
| `captions` | câu đang đọc trong dải trắng; bật nhẹ mỗi câu mới. Ẩn trong phần mở đầu |
| `captionPosition` | `bottom`: đáy dải ở `captionBottom`; `center`: giữa khung nhưng luôn nằm trên thanh tên |
| `punch` | đúng `atMs` (không sớm hơn lúc thẻ vào): viên vàng in hoa bật lên kèm vệt sáng quét; giữ ≤ 70 frame. Dọc: ngay trên phụ đề. Ngang/vuông: đè đáy ảnh, trên thanh tên. Cảnh #1 có lấp lánh quanh viên |
| `visual` stat | ô điểm kính tối góc phải trên thẻ: ngôi sao vàng + số lớn (`9,5/10`, `4,8★`, `2 triệu`) + `caption` nhỏ |
| `visual` badge | nhãn dán hồng đỏ viền trắng nghiêng 6° góc phải trên (`BẤT NGỜ`, `ĐÁNG THỬ`), in hoa bằng JS |
| `image` | ảnh/video trong thẻ; video dùng `ClipVideo` (tôn trọng `crop`, `trimStartMs`, `volume`); ảnh qua `CropBox`. `null` → nền gradient màu accent có sọc chéo |
| `title` / `subtitle` | phần mở đầu 70 frame: "TOP" + số N cuộn, hàng ô N…1, tiêu đề 3 dòng, phụ đề vàng |
| `accent` | đèn rọi, bóng số hạng, ô hạng, thanh tên, hàng đang chiếu, gạch chân phụ đề, vệt gió |
| `showTitle` | tắt → thẻ đầu vào ngay frame 0, không có "TOP N" |
| `background` | không dùng — sân khấu luôn tối |

## Chuyển động

- Mở đầu (0–70): "TOP" rơi xuống nảy; số N cuộn dọc 1 → N (frame 6–28, ease-out) rồi phồng nhẹ khi dừng; ô #N…#1 rơi
  xuống lần lượt cách 4 frame (ô #1 vàng đội vương miện); tiêu đề từng dòng trượt lên từ frame 24, phụ đề 36;
  frame 59–68 cả cụm văng sang trái + nghiêng.
- Đổi cảnh (whip trên timeline tuyệt đối, không TransitionSeries): thẻ cũ văng trái từ 5 frame trước điểm vào (8 frame,
  ease-in, nghiêng), thẻ mới văng từ phải vào 10 frame (ease-out); 9 vệt gió trắng/accent quét ngang quanh điểm cắt.
- Nhịp cục bộ mỗi cảnh (frame tính từ lúc thẻ vào, xem `BEAT` trong `layout.ts`):
  - 2–11: "#N" đập vào — scale 2.2 → 1 có nảy quá (back-out), ảnh tối 50%, 3 bản sao mờ phóng to dần giả nhoè chuyển động
    (không dùng CSS blur); 7–19 vòng xung kích + rung ngang.
  - #1: vương miện rơi xuống đậu trên số từ frame 8, lấp lánh từ frame 8.
  - 20–32: số thu về góc (ease-in-out), đế ô hạng bật ra khi số gần tới; ảnh sáng lại.
  - 24–36: thanh tên gạt từ trái sang (clip-path), từng dòng tên trượt vào.
  - 28–40: ô bảng xếp hạng của cảnh lật "???" → tên (rotateX); ô đang chiếu phồng 8% lúc thẻ vào.
  - 34: ô số liệu / nhãn dán bật ra (back-out), nhãn dán lắc nhẹ.
- Câu nhấn: bật 9 frame (0.3 → 1 nảy quá, xoay −2°), vệt sáng chéo quét qua frame +5…+18, thu nhỏ mờ đi 6 frame.
- Mọi thứ suy từ `useCurrentFrame()`; ngẫu nhiên (lấp lánh, vệt gió, hướng lia ảnh) dùng `seeded()`.

## Lỗi cần tránh

- Đừng dùng CSS `text-transform`, `letter-spacing` hay `FONTS.condensed` cho tên món/câu nhấn in hoa: móc Ư/Ơ tách rời.
  Kiểm bằng still có "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" (đã kiểm ở viên câu nhấn, 9:16 và 16:9).
- Hạng lấy từ số ĐẦU tag. Tag kiểu "2 triệu lượt xem" không bị hiểu là hạng 2 (số phải kèm `#`, dấu câu, "Top",
  hoặc tag chỉ có số) — nhưng "#2 triệu" thì có. Đừng viết tag bắt đầu bằng số nếu không phải hạng.
- Đừng để hai cảnh cùng hạng hoặc thiếu #1: bảng vẫn vẽ nhưng mất ý nghĩa, và không cảnh nào được mạ vàng.
- Phần mở đầu: thẻ đầu vào ở `TITLE_FRAMES - 2`. Đổi mốc này mà không dời cú văng ra của mở đầu thì "#N" đè lên "TOP N".
- Bố cục tính từ TOÀN BỘ dữ liệu (chiều cao ảnh chừa sẵn chỗ cho phụ đề 2 dòng + viên câu nhấn) — đừng tính theo câu
  hiện tại, thẻ sẽ nhảy.
- Canvas và DOM đo lệch vài phần trăm: `fitText` chừa 6%, chữ render theo dòng đã chia sẵn + `nowrap`.
- Dải 9:16 có 5 ô: mỗi ô ~180px, tên dài > 14 ký tự co nhỏ 2 dòng. 6+ cảnh thì ô rất chật — giữ 3–5 hạng.
- Tên > 20 ký tự: thanh tên xuống 2 dòng chữ nhỏ. Câu nhấn > ~22 ký tự: viên co chữ, dài nữa cắt "…".
- Gradient chữ vàng dùng `background-clip: text` + `filter: drop-shadow` — đừng thêm `text-shadow` (bóng lộ qua chữ trong suốt).
- Ảnh rất tối (như ảnh dưới nước) vẫn đọc được vì chữ nằm trên khối màu, nhưng cảnh #1 nên có ảnh sáng, rõ chủ thể.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Video là danh sách đếm ngược: 3–5 cảnh, mỗi cảnh đúng MỘT hạng, xếp từ hạng thấp nhất lên #1 (cảnh cuối là #1).
  Không cần cảnh giới thiệu riêng — `title` đã có phần mở đầu "TOP N".
- Câu đầu tiên là hook gắn với #1: "Số 1 sẽ khiến bạn bất ngờ", "Đa số đoán sai số 1".
- Mỗi cảnh 2–3 câu, mỗi câu ≤ 50 ký tự: câu 1 gọi tên hạng ("Hạng 3: bánh mì Hội An."), câu sau nêu lý do đáng nhớ nhất.
- Câu kết (thuộc cảnh #1) hỏi người xem: "Số 1 của bạn là gì? Bình luận nhé!".
- `tag`: BẮT BUỘC dạng "#3 Tên món", tổng ≤ 20 ký tự, viết hoa đầu câu (không IN HOA cả tag): "#5 Phở bò", "#1 Bánh mì".
  Số trong tag phải khớp thứ tự đếm ngược và khớp lời đọc.
- `title`: "Top N …" ≤ 50 ký tự, N bằng số cảnh ("Top 5 món ăn vỉa hè Hà Nội"). `subtitle`: câu nhử ngắn, khác title.
- `punch`: cụm đắt nhất của cảnh (lý do món đó lọt top), 2–4 từ, PHẢI chép nguyên văn từ một câu của cảnh; mỗi cảnh tối đa một punch, nên có ở cảnh #1.
- `visual` stat cho điểm/số đo của hạng: "9,5/10", "4,8★", "2 triệu", "120 năm", caption ngắn ("điểm", "lượt bán").
  Badge cho nhãn đặc biệt: "BẤT NGỜ", "ĐÁNG THỬ", "RẺ NHẤT". Không cảnh nào có cả hai; không lạm dụng mọi cảnh.
- `image`: ảnh THẬT, rõ chủ thể của đúng món/địa điểm/sản phẩm được xếp hạng (không ảnh minh hoạ chung chung, không chữ trong ảnh).
  Ảnh ngang hoặc vuông hợp thẻ nhất; video ngắn quay món đó cũng tốt.
- Không bịa số liệu xếp hạng; nếu là ý kiến chủ quan thì nói rõ trong lời đọc ("theo mình", "theo bình chọn của…").
<!-- /ai-guide -->

## File

- `src/styles/ranking/index.tsx` — ghép lớp theo thứ tự, title intro trong `<Sequence>`
- `src/styles/ranking/layout.ts` — bố cục theo tỉ lệ khung + dữ liệu (thẻ, dải/cột bảng xếp hạng, phụ đề, cỡ chữ đã fit), nhịp `BEAT`, mốc vào thẻ, hệ số whip
- `src/styles/ranking/theme.ts` — màu, easing, back-out, in hoa, đo chữ canvas + chia/cân dòng, tách hạng từ tag
- `src/styles/ranking/Stage.tsx` — sân khấu đèn rọi, chuyển vàng ở #1, vệt gió đổi cảnh
- `src/styles/ranking/Card.tsx` — thẻ ảnh/video, số hạng đập + thu về góc, vương miện, thanh tên, ô số liệu / nhãn dán
- `src/styles/ranking/Board.tsx` — bảng xếp hạng dải ngang / cột dọc, lật "???" → tên
- `src/styles/ranking/Captions.tsx` — dải phụ đề trắng, viên câu nhấn vàng
- `src/styles/ranking/Gold.tsx` — vương miện, lấp lánh, cúp
- `src/styles/ranking/TitleIntro.tsx` — mở đầu "TOP N"
