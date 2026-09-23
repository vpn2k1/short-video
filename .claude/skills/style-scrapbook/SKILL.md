---
name: style-scrapbook
description: Phong cách "Album kỷ niệm" — bảng bần treo tường, mỗi cảnh một tấm polaroid rơi xuống dán băng keo washi hoặc ghim đinh, ảnh cũ lùi ra mép bảng nên bảng đầy dần, lời viết tay trên thẻ ghi chú kẻ dòng, giấy note vàng cho câu nhấn, nhãn tròn cho con số, vé kỷ niệm khi không có ảnh, bìa album vải mở đầu. Dùng cho du lịch, kỷ niệm, gia đình, bạn bè, kỷ niệm yêu nhau, tổng kết năm, "một năm nhìn lại".
---

# Album kỷ niệm

## Nhận diện hình ảnh

- Nền bảng bần nâu ấm (hạt li ti + mảng loang bằng SVG turbulence, tĩnh), viền tối dần.
- Ảnh là **polaroid** viền trắng dày, dải đáy lớn có một hình vẽ tay nhỏ (tim / sao / xoắn) màu nhấn; nghiêng nhẹ theo seed, xen kẽ trái/phải.
- Giữ ảnh bằng: băng keo washi có chữ (khi có `tag`), hai mẩu băng keo góc, hoặc đinh ghim màu nhấn — chọn theo seed.
- Lời nằm trên **thẻ ghi chú kẻ dòng** (dòng đỏ đầu thẻ, dòng xanh nhạt), chữ **Patrick Hand** màu mực `#2b2733`, dán băng keo vàng.
  Dọc/vuông: thẻ ở dưới, đè nhẹ lên dải trắng của ảnh. Ngang: ảnh bên trái, thẻ bên phải.
- Ảnh các cảnh đã qua lùi ra 6 chỗ quanh mép bảng, thu còn ~50%, tối và nhạt đi — bảng đầy dần theo video.
- Font: Patrick Hand (lời, nhãn, note), Dancing Script (tiêu đề bìa, vé), Baloo 2 (nhãn tròn) — đều đóng gói, đủ dấu tiếng Việt.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Ảnh trong polaroid (ảnh hơi ấm, quầng tối nhẹ, zoom chậm). Video: phát trong khung, tắt tiếng, lặp. |
| `image: null` | **Vé kỷ niệm** thay polaroid: cuống vé màu nhấn "Nº 03", đường răng cưa có khấc tròn, dòng "VÉ KỶ NIỆM", dòng chữ ký lớn = `tag` (không có thì `title`). |
| `tag` | Chữ viết tay trên băng keo washi dán ngang mép trên polaroid ("Đà Lạt · 2019"). Cảnh không ảnh thì thành dòng chữ lớn trên vé. |
| `captions` | Câu đang đọc trên thẻ ghi chú, viết dần trái→phải. Một cỡ chữ chung cho mọi câu (vừa ≤3 dòng khi dọc, ≤4 khi ngang) nên thẻ không co giãn. |
| `punch` | Giấy note vàng đập xuống góc phải ảnh lúc `atMs` (nảy, nghiêng). Nếu có nguyên văn trong câu thì các chữ đó trên thẻ còn được **tô bút dạ vàng**. |
| `visual` stat | Nhãn dán tròn màu nhấn viền trắng (sticker bế) ở góc trên trái ảnh: số lớn Baloo, `caption` viết tay bên dưới. |
| `visual` badge | Như trên nhưng hình hoa hồng răng cưa, vòng chỉ đứt. |
| `title`/`subtitle` | Khi `showTitle`: bìa album vải bố màu nhấn sẫm, gáy trái, chỉ khâu, bọc góc đồng, ảnh cảnh đầu cài hờ góc bìa, nhãn giấy giữa bìa có tiêu đề Dancing Script + tim vẽ tay + dòng phụ. Frame ~58–82 bìa lật mở sang trái. |

## Chuyển động

- Polaroid mới rơi xuống: phóng 1.28 → 1, từ trên cao 90u, xoay thêm 9°, `Easing.spring` damping 12 nên nảy nhẹ; bóng đổ to/mờ khi còn nhấc lên, sát lại khi nằm xuống.
- Băng keo / đinh ghim đập vào ở frame +8, nhãn tròn +14, hình vẽ tay ở dải trắng tự vẽ nét ở +18.
- Sang cảnh: ảnh cũ trượt ra chỗ ở mép bảng trong 18 frame (mang theo note và nhãn dán của nó), ảnh mới rơi xuống đè lên.
  Ảnh thứ i+6 nằm đúng chỗ ảnh thứ i nên ảnh i được bỏ khỏi cây render.
- Thẻ ghi chú trượt lên cùng câu đầu tiên (sau khi bìa mở), mỗi câu mới viết dần bằng mask mép mềm.
- Bìa: frame 0 đã có đủ tiêu đề (làm ảnh đại diện được); dòng phụ, ảnh cài góc hiện dần; cuối phần tiêu đề bìa xoay 3D quanh gáy.
- `useFontReady("patrick")`/`("dancing")` giữ `delayRender` tới khi font về — đo chữ bằng canvas lúc font chưa nạp sẽ sai số dòng.

## Lỗi cần tránh

- Câu > ~75 ký tự làm cả thẻ co chữ (cỡ chung cho mọi câu) — giữ câu ngắn.
- `punch` dài quá 5–6 từ thì chữ trên giấy note nhỏ; 1–4 từ là đẹp nhất.
- `tag` dài hơn ~24 ký tự làm băng keo tràn rộng hơn ảnh.
- Ảnh cũ ở mép phải có thể nằm dưới nút like/share của nền tảng — chỉ là trang trí, không đặt chữ quan trọng ở đó.
- Phụ đề tuỳ chỉnh (captionLook): thẻ ghi chú biến mất, composition vẽ phụ đề riêng; bảng vẫn đúng bố cục.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng kể kỷ niệm ấm áp, ngôi thứ nhất số nhiều ("nhà mình", "tụi mình", "hai đứa"), như đang lật album cùng người xem.
- Mở bằng hook gợi tò mò về khoảnh khắc: "Tấm ảnh này suýt nữa không tồn tại.", "12 tháng, 5 thành phố, 1 lời hứa."
  Kết bằng một câu đọng lại hoặc lời hẹn ("Hẹn năm sau, vẫn đủ cả nhà nhé.").
- Mỗi cảnh là MỘT khoảnh khắc / một tấm ảnh: 1–3 câu, mỗi câu ≤ 70 ký tự. 4–8 cảnh, đi theo thời gian (tháng, chuyến đi, cột mốc).
- `tag`: nơi chốn · thời điểm, tối đa 24 ký tự — "Đà Lạt · 2019", "Tháng 3 · Hội An", "Sinh nhật con". Nên có ở hầu hết cảnh.
- `punch`: chép NGUYÊN VĂN 1–4 từ đắt nhất trong một câu của cảnh — thành giấy note vàng và được tô dạ trên thẻ.
- `visual` stat cho con số kỷ niệm ("12 năm", "5 thành phố", "365 ngày") kèm caption ngắn; badge cho cột mốc ("Lần đầu", "Kỷ niệm 1").
- Ảnh: ảnh đời thường có người, nơi chốn, đồ vật kỷ niệm — sẽ thành polaroid. Cảnh không có ảnh sẽ là vé kỷ niệm ghi `tag`.
<!-- /ai-guide -->

## File

- `src/styles/scrapbook/index.tsx` — ghép lớp, rơi xuống / lùi ra mép bảng, thời điểm thẻ và bìa.
- `src/styles/scrapbook/layout.ts` — bố cục polaroid, thẻ ghi chú, các chỗ ảnh cũ theo khung hình.
- `src/styles/scrapbook/Memory.tsx` — polaroid, vé kỷ niệm, băng keo/đinh ghim, nhãn tròn, giấy note.
- `src/styles/scrapbook/NoteCard.tsx` — thẻ ghi chú kẻ dòng, chữ viết dần, tô dạ câu nhấn.
- `src/styles/scrapbook/Cover.tsx` — bìa album và cú lật mở.
- `src/styles/scrapbook/paper.tsx` — nền bần, băng keo washi, đinh ghim, hình vẽ tay.
- `src/styles/scrapbook/text.ts` — font, màu, đo chữ bằng canvas, tìm cụm nhấn, màu chữ trên nền nhấn.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
