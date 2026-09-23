---
name: style-festive
description: Phong cách "Lễ hội Tết" — nền đỏ son có mây vàng (tường vân) mờ, viền lá vàng đôi có hoa văn góc, hai lồng đèn đỏ đung đưa ở góc trên, cánh mai vàng / đào hồng rơi, ánh kim lấp lánh; ảnh trong khung vàng bo tròn viền đôi phóng chậm, phụ đề chữ tròn trắng ngà trên dải lụa đỏ có hai trục cuộn vàng, nhãn là con dấu đỏ chữ vàng, câu nhấn bắn pháo hoa + chữ vàng phát sáng + mưa xu vàng và bao lì xì, số liệu nằm trong bao lì xì hoặc đồng xu vàng, cảnh không ảnh thành tấm thiệp chúc có cành mai/đào, màn mở đầu cuộn thư đỏ giữa pháo hoa. Dùng cho chúc Tết, lời chúc ngày lễ, thông báo sự kiện/lễ hội, khuyến mãi Tết, đếm ngược năm mới, chuyện đoàn viên gia đình.
---

# Lễ hội Tết

## Nhận diện hình ảnh

- Nền đỏ son sáng giữa, thẫm ra mép; hoạ tiết mây tường vân vàng mờ (13%) rải lệch hàng, trôi ngang rất chậm.
  Viền lá vàng đôi sát mép khung, hoa văn xoắn vuông ở bốn góc.
- Hai lồng đèn đỏ (SVG) treo ở hai góc trên: thả xuống đầu video có nảy, rồi đung đưa lệch nhịp, quầng sáng thở nhẹ.
- Cánh mai vàng + đào hồng rơi lả tả suốt video (bông nguyên và cánh lẻ lật), ánh kim bốn cánh chợt loé rải rác.
- **Dọc** (9:16, 3:4, 1:1): khung ảnh trên, dải lụa phụ đề ở phần ba dưới. **Ngang** (16:9, 2:1): khung ảnh bên trái,
  dải lụa ở cột phải, cành đào rủ trên và cành mai vươn dưới kẹp dải lụa.
- Khung ảnh: dải lá vàng ngoài → rãnh đỏ → chỉ vàng trong, bo tròn, quầng sáng vàng, hoa thị vàng ở bốn góc.
- Chữ: **Baloo 2** 700–800 (đóng gói) cho phụ đề, con dấu, chú thích; **Playfair Display** 700–800 cho tiêu đề,
  lời chúc trên thiệp, con số. In hoa bằng JS `toLocaleUpperCase("vi")`, không dùng CSS text-transform.
- Bảng màu cố định đỏ `#b3121b` / đỏ thẫm `#6f0710` / vàng `#f2c14e` / trắng ngà `#fff5e0`. **`accent` và
  `background` của video bị bỏ qua** — đỏ vàng luôn là chủ đạo.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Trong khung vàng, phóng 1 → 1.08 suốt cảnh, hơi ấm màu và tối mép trong. Video: phát trong khung, tắt tiếng, lặp. |
| `image: null` | Tấm thiệp chúc: khung vàng lớn gộp cả vùng phụ đề, nền đỏ thẫm có mây, cành mai (dưới trái) và cành đào (trên phải) vẽ dần rồi nở hoa; phụ đề thành lời chúc Playfair cỡ lớn giữa thiệp, kẹp giữa hai gạch vàng có hình thoi. |
| `tag` | Con dấu đỏ chữ vàng viền vàng đôi, đóng xuống giữa mép trên khung ảnh / thiệp (phóng từ to xuống, xoay nhẹ). ≤ 3 ký tự ("TẾT", "LỘC") là dấu vuông, dài hơn là dấu chữ nhật. |
| `captions` | Cảnh có ảnh: dải lụa đỏ thẫm viền vàng, hai trục cuộn vàng — trải ra từ giữa ở câu đầu của chuỗi cảnh có ảnh, các câu sau chỉ đổi chữ (hiện dần + trôi lên). Chữ co theo độ dài. Cảnh không ảnh: lời chúc trên thiệp. |
| `punch` | Có nguyên văn trong câu: lúc `atMs` cụm từ chuyển vàng phát sáng và nảy lên; ba chùm pháo hoa nổ quanh dải lụa (hoặc hai bên lời chúc); mưa xu vàng lỗ vuông + bao lì xì rơi ~3 giây. Không khớp câu nào của cảnh → thêm viên vàng chữ đỏ trên dải lụa (hoặc dòng vàng dưới lời chúc). |
| `visual` stat | Bao lì xì đỏ: nắp chữ V viền vàng, khuy vàng, con số Playfair vàng lớn, chú thích trắng ngà. Có ảnh: dán góc dưới phải khung ảnh, nghiêng 6°; thiệp: giữa phần trên thiệp. |
| `visual` badge | Đồng xu mạ vàng vành răng cưa, lòng đỏ chữ vàng in hoa, chú thích trong viên đỏ viền vàng bên dưới. |
| `title`/`subtitle` | Khi `showTitle`: pháo hoa nổ năm chùm, hai lồng đèn nhỏ thả xuống, cuộn thư đỏ có hai trục vàng mở ra từ giữa, tiêu đề Playfair vàng, dòng phụ trắng ngà; tan dần ở frame 56–70. |

## Chuyển động

- Vào nhanh, dừng êm (`Easing.bezier(0.16, 1, 0.3, 1)`); con dấu, con số, lồng đèn, viên câu nhấn dùng
  `Easing.spring({ damping: 11, stiffness: 170 })` cho cú nảy vui.
- Sang cảnh: cảnh mới hiện lên trên cảnh cũ trong 14 frame (mờ → rõ, 0.97 → 1); con dấu đóng xuống sau 4 frame,
  con số bật lên sau 12 frame.
- Pháo hoa: mỗi chùm 38 frame — tia toả tròn có vệt, rơi nhẹ theo trọng lực rồi tắt; ba chùm cách nhau 7 frame.
- Mọi ngẫu nhiên (cánh hoa, ánh kim, pháo hoa, mưa xu) qua `seeded()` — cùng frame cùng hình.
- Không dùng TransitionSeries — mốc cảnh/phụ đề giữ nguyên frame tuyệt đối.

## Lỗi cần tránh

- Câu quá dài (> ~110 ký tự) co chữ còn ~38px trên dải lụa — tách thành hai câu.
- Lời chúc trên thiệp dài hơn ~80 ký tự co còn nửa cỡ; thiệp 1:1 có con số lại thấp — giữ lời chúc ngắn.
- `tag` dài hơn ~18 ký tự làm con dấu dài, che mép khung. `visual.text` tối đa ~5 ký tự thì con số mới to.
- Đừng dùng chữ Hán cho tag/lời chúc — dùng chữ Việt ("TẾT", "XUÂN", "LỘC", "PHÚC").
- Phụ đề tuỳ chỉnh (captionLook) thay dải lụa bằng phụ đề chung — phong cách vẫn vẽ nền, khung, con dấu, pháo hoa.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng vui, ấm áp, sum vầy, chúc tụng; câu ngắn gọn dễ đọc to, có thể dùng thành ngữ chúc Tết quen thuộc ("an khang thịnh vượng", "vạn sự như ý", "tiền vào như nước").
- Mỗi cảnh 1–2 câu, mỗi câu tối đa ~80 ký tự; viết thường như câu văn, không IN HOA cả câu, không emoji.
- `tag`: 1–3 từ tiếng Việt, tối đa 14 ký tự, như chữ trên con dấu — "Tết", "Xuân", "Lộc", "Mùng 1", "Ưu đãi Tết", "Đêm giao thừa". Không dùng chữ Hán.
- `punch`: chép NGUYÊN VĂN 2–5 từ trong một câu của chính cảnh đó — lời chúc hoặc ý đắt nhất ("an khang thịnh vượng", "cả nhà sum vầy", "giảm 50%"); sẽ nổ pháo hoa và chuyển vàng.
- `visual` stat cho con số đáng nhớ: số ngày đếm ngược, mức giảm giá, năm mới, số món quà ("7 ngày", "-50%", "2026", "100K") kèm caption ngắn; badge cho nhãn chữ ngắn ("Lì xì", "Quà Tết").
- Nên để 1–2 cảnh không ảnh cho lời chúc chính / câu kết — sẽ thành tấm thiệp có cành mai đào.
- Ảnh: sắc đỏ vàng ấm, không khí Tết — mâm ngũ quả, hoa mai hoa đào, bánh chưng, phố treo đèn lồng, gia đình quây quần, pháo hoa, quà Tết, sản phẩm gói quà.
- Kết bằng lời chúc năm mới hoặc lời mời (ghé cửa hàng, nhận lì xì, gọi về cho gia đình).
<!-- /ai-guide -->

## File

- `src/styles/festive/index.tsx` — bố cục dọc/ngang, khung ảnh vàng, tấm thiệp, con dấu, dải lụa phụ đề + câu nhấn, pháo hoa câu nhấn, màn tiêu đề cuộn thư.
- `src/styles/festive/Decor.tsx` — nền đỏ + mây + viền vàng, lồng đèn, hoa mai/đào, cánh hoa rơi, ánh kim, pháo hoa, mưa xu + lì xì, bao lì xì và đồng xu cho con số.
- `src/styles/festive/palette.ts` — bảng màu đỏ vàng, font, in hoa tiếng Việt, co cỡ chữ.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
