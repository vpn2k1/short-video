---
name: style-quiz
description: Phong cách "Câu đố" — nền game show rực theo accent, mỗi cảnh một câu hỏi trên thẻ trắng, đồng hồ đếm ngược 3·2·1, thẻ lật xanh hiện đáp án kèm pháo giấy, chấm tiến độ từng câu, dải kêu gọi bình luận số câu đúng. Dùng cho đố vui, kiểm tra kiến thức, "bạn có biết", thử thách, trắc nghiệm, học từ vựng, kêu gọi bình luận.
---

# Phong cách: Câu đố (quiz)

`style: "quiz"` trong props. Code: `src/styles/quiz/`.

## Nhận diện hình ảnh

- Nền game show: gradient chéo 3 tông suy từ `accent` (ép bão hoà ≥ 70%), tia sáng
  `repeating-conic-gradient` xoay chậm, lưới chấm trắng trôi chéo, vignette đậm ở mép.
  Tông ấm (cam/vàng/lục) đậm dần về phía đỏ, tông lạnh về phía tím — lệch sai chiều thì cam ra vàng rêu.
- Bảng màu cố định ngoài accent: chữ tím than `#1d1740`, xanh đúng `#22c55e`, hổ phách `#f59e0b`,
  đỏ `#ef4444`, vàng `#ffd43b`. Prop `background` KHÔNG dùng.
- Chữ: `FONTS.rounded` (Avenir Next) 700–900 cho mọi thứ. In hoa chỉ bằng
  `text.normalize("NFC").toLocaleUpperCase("vi")` (hàm `upper()` trong `theme.ts`).
- Bố cục:
  - Dọc (9:16, 3:4): chấm tiến độ → khung ảnh viền trắng nghiêng nhẹ (co giãn) → thẻ câu hỏi trắng
    đè mép dưới ảnh → đĩa đồng hồ vắt mép dưới thẻ → dải phụ đề → dải "Bình luận số câu bạn đúng 👇".
  - Ngang và vuông (16:9, 2:1, 1:1): khung ảnh cột trái cao hết vùng an toàn (1:1 hẹp hơn: 40%);
    cột phải xếp chấm tiến độ, thẻ, đĩa, phụ đề — khối thẻ + phụ đề căn giữa dọc.
- Chiều cao thẻ (câu hỏi dài nhất / đáp án cao nhất) và dải phụ đề tính trước từ toàn bộ dữ liệu
  nên bố cục không nhảy giữa các câu.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `scenes[i]` | một câu hỏi. Caption của cảnh được tách thành: [dòng mở] [câu hỏi] [dòng chờ] [câu đáp án] [dòng kết] (`analyzeScenes` trong `theme.ts`) |
| câu hỏi | khối caption liền nhau kết thúc ở câu có `?` cuối cùng trước đáp án (dòng trước không kết thúc bằng `.` `!` `…` được ghép vào). Hiện trên thẻ, nảy vào đúng lúc câu bắt đầu được đọc. Cỡ `fitFontSize`, tự co cho ≤ 4 dòng |
| dòng chờ | caption ngay trước câu đáp án nếu khớp "suy nghĩ / đoán / giây / 3-2-1…" hoặc không có `?` |
| `punch` | đáp án. Tại `atMs`: đĩa đồng hồ thành đĩa xanh ✓ nảy, thẻ lật `rotateY` 14 frame sang mặt xanh "ĐÁP ÁN" + chữ in hoa cỡ lớn (ưu tiên vừa một dòng), chớp sáng 9 frame, 32 hạt pháo giấy. `null` → chỉ có câu hỏi, đĩa hiện "?" suốt cảnh |
| đồng hồ | tối đa 3 s trước `punch.atMs`, không bắt đầu trước lúc cảnh hiện + 0.8 s; cửa sổ ngắn thì đếm từ 2 hoặc 1; ngắn hơn 12 frame thì bỏ. Vòng SVG cạn dần (`stroke-dashoffset`), hổ phách → cam → đỏ, số phóng mỗi lần đổi, số 1 đỏ và rung |
| `tag` | viên thuốc vắt qua mép trên thẻ ("CÂU 1", "CÂU KHÓ"), in hoa bằng JS. `null` → "CÂU n/N" |
| `captions` | câu hỏi và câu đáp án KHÔNG hiện ở dải phụ đề (câu đáp án ẩn để không lộ trước lúc lật). Dòng mở/chờ/kết hiện trong viên tối |
| `captionPosition` | `bottom`: dải phụ đề dưới đĩa đồng hồ; `center`: đè giữa khung ảnh |
| `visual` stat | sticker trắng nghiêng góc phải trên khung ảnh: số đỏ đếm lên, thanh meter (hậu tố `%` dừng đúng tỉ lệ), chú thích (`caption`, mặc định "người trả lời sai") |
| `visual` badge | ruy băng đỏ chéo góc trái trên khung ảnh, chữ in hoa + 🔥 (nếu chữ chưa có emoji), `caption` nhỏ bên dưới |
| `image` | khung ảnh bo góc viền trắng dày, Ken Burns 1.04→1.12. Video (.mp4/.mov/.webm) qua `ClipVideo` trong `<Sequence from={đầu cảnh}>`; ảnh qua `CropBox`. Tôn trọng `crop`, `trimStartMs`, `volume`. `null` → ô sọc chéo với dấu "?" khổng lồ lắc lư |
| `title`/`subtitle` | title card 70 frame (khi `showTitle`): bong bóng "?" vàng nhịp đập, tiêu đề in hoa trắng bóng đổ, subtitle trong viên trắng; phóng to + mờ ra ở cuối |
| chấm tiến độ | mỗi câu một chấm; câu đã lật → chấm trắng đặc có ✓, câu hiện tại → vòng trắng nhịp đập |
| cuối video | sau lần lật cuối 40 frame: dải vàng "Bình luận số câu bạn đúng 👇" nảy nhẹ (không có punch nào → 2.5 s cuối cảnh cuối) |
| `accent` | sinh toàn bộ gradient nền, viên tag, viền đĩa |

## Chuyển động

- Vào cảnh: khung ảnh rơi xuống + phóng 0.85→1 (ease back), thẻ trồi từ dưới lên sau 4 frame;
  cảnh cũ văng sang trái + xoay −8° trong 10 frame đầu cảnh mới. Cảnh cuối không có lối ra.
- Lật thẻ: chỉ vẽ một mặt mỗi frame (0→90° mặt trước, −90→0° mặt sau) — không cần `backface-visibility`;
  thẻ nhún lên 26u và có vệt sáng chéo khi đang lật.
- Pháo giấy: vị trí tính thẳng từ số frame đã trôi (vận tốc có cản + trọng lực), góc/tốc độ/màu/hình theo
  `seeded()`, sống 54 frame.
- Nền: tia sáng xoay 0.12°/frame, chấm trôi 0.6u/frame.
- Mọi chuyển động từ `useCurrentFrame()`; `ramp()` luôn có length ≥ 1 nên mốc interpolate tăng nghiêm ngặt.

## Lỗi cần tránh

- Đừng dùng CSS `text-transform` / `letter-spacing` cho chữ Việt.
- Chỉ dùng `FONTS.sans`, KHÔNG `FONTS.rounded` (Avenir Next): bản đậm 800–900 tách móc Ư/Ơ —
  "THƯỜNG" thành "THƯ ỜNG", "NHỮNG" thành "NHỮ NG" (đã render thử). Kiểm still với "ĐỪNG THƯỜNG ƯU ƠN NHỮNG".
- Punch không nằm trong caption nào của cảnh → vẫn lật đúng `atMs`, nhưng câu đáp án không bị ẩn khỏi dải
  phụ đề và có thể lộ trước. Luôn chép punch nguyên văn.
- Punch quá dài (cả câu) → chữ đáp án co nhỏ, xuống 2–3 dòng, mất lực. Giữ 1–4 từ.
- Cảnh không có dấu `?` → câu hỏi đoán bằng các dòng trước đáp án; dữ liệu kể chuyện thường (không phải câu đố)
  vẫn render nhưng thẻ hiện câu đầu cảnh, không đẹp.
- Đồng hồ đếm trong khoảng LẶNG trước câu đáp án: `scriptToProps` chừa `QUIZ_THINK_MS` (3 s) trước câu chứa
  punch, `analyzeScenes` đếm 3·2·1 đúng 3 giây thật trong đó rồi lật thẻ lúc giọng bắt đầu đọc đáp án.
  Props cũ (các câu dính liền, lặng < 2 s) thì đếm kiểu cũ tới `punch.atMs`, đè lên lời đọc; < 0.4 s thì không có đồng hồ.
- Không blur/backdrop-filter; lớp toàn khung chỉ là gradient CSS. Chớp sáng chỉ 9 frame.
- Emoji màu vàng trên nền vàng bị chìm — 👇 ở dải kết nằm trong đĩa tối riêng.
- Câu hỏi > 4 dòng ở khung 1:1 co tới ~30px — giữ câu hỏi ≤ 60 ký tự.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 3–5 câu hỏi; MỖI CẢNH ĐÚNG MỘT CÂU HỎI. Kiến thức phải chính xác, phổ biến, kiểm chứng được — không số liệu bịa.
- Đố mẹo: chỉ dùng câu đố mẹo quen thuộc, có lời giải là chơi chữ hoặc lý lẽ khớp với câu hỏi (hợp lý: "Con gì mang nhà đi khắp nơi? → con ốc sên"). Không chắc đáp án hợp lý thì đổi sang câu hỏi kiến thức.
  Câu đố mẹo quen thuộc đã kiểm chứng — ưu tiên chọn những câu hợp chủ đề (không cần dùng hết); câu tự nghĩ phải có lời giải rõ:
  "Con gì đầu dê mình ốc?" → con dốc · "Bệnh gì bác sĩ bó tay?" → gãy tay · "Con gì đập thì sống, không đập thì chết?" → con tim ·
  "Cái gì có răng mà không cắn?" → cái lược · "Cái gì càng lấy đi càng lớn?" → cái hố · "Cái gì có cổ mà không có đầu?" → cái áo ·
  "Tháng nào có 28 ngày?" → tháng nào cũng có · "Cái gì chặt không đứt, bứt không rời, phơi không khô, đốt không cháy?" → nước ·
  "Con gì ăn lửa với nước than?" → tàu hoả · "Cái gì của bạn mà người khác dùng nhiều hơn bạn?" → tên của bạn ·
  "Cái gì bạn vẫn giữ sau khi đã trao cho người khác?" → lời hứa.
- Cảnh đầu mở bằng một câu hook TRƯỚC câu hỏi 1, kết thúc bằng dấu chấm than, KHÔNG bịa tỉ lệ: "Câu cuối khó nhất!",
  "Đúng hết 5 câu là cao thủ ẩm thực!".
- Thứ tự caption trong mỗi cảnh, mỗi dòng một caption:
  1. Câu hỏi ≤ 60 ký tự, kết thúc bằng "?" ("Cố đô cuối cùng của Việt Nam là thành phố nào?"). Câu dài thì tách 2 caption, caption đầu không kết thúc bằng dấu chấm.
  2. Một dòng chờ ngắn: "Suy nghĩ 3 giây nhé…", "Đoán nhanh nào…", "Đáp án của bạn là gì?". Sau dòng này app tự chừa 3 giây lặng cho đồng hồ đếm 3·2·1 — đừng viết thêm câu lấp chỗ trống.
  3. Câu đáp án bắt đầu bằng "Đáp án là …": "Đáp án là Huế."
- `punch.text` chép NGUYÊN VĂN cụm đáp án trong câu đáp án (1–4 từ, không kèm "Đáp án là"): "Huế", "màu xanh lam", "ba trái tim". `punch.atMs` = lúc giọng đọc tới cụm đó. Mọi cảnh câu hỏi đều phải có punch.
- `tag`: "CÂU 1", "CÂU 2"… theo thứ tự; câu khó nhất có thể dùng "CÂU KHÓ". Có thể để null (tự sinh "CÂU n/N").
- `visual`: tối đa 1–2 cảnh. `badge` đánh dấu câu khó: `{ "type": "badge", "text": "Câu khó", "caption": null }`. `stat` chỉ khi câu hỏi có một con số thật đáng nêu (không dùng cho tỉ lệ "người trả lời sai" — con số đó là bịa).
- Cảnh cuối, sau câu đáp án, thêm một dòng kết kêu gọi bình luận: "Bạn đúng mấy câu? Bình luận nhé!".
- `title` dạng thách thức ≤ 30 ký tự: "Bạn trả lời được mấy câu?", "Đố vui địa lý Việt Nam"; `subtitle` nói chủ đề + số câu: "4 câu về lịch sử".
- `image`: ảnh gợi ý chủ đề câu hỏi nhưng KHÔNG lộ đáp án (hỏi "thành phố nào" thì đừng dùng ảnh có biển tên thành phố). Không có ảnh phù hợp thì để null — ô "?" vẫn đẹp.
- Giọng hào hứng như MC game show, câu ngắn, xưng "bạn".
<!-- /ai-guide -->

## File

- `src/styles/quiz/index.tsx` — `QuizStyle`, tính bố cục bằng số (dọc / ngang / vuông), ghép các lớp, chuyển cảnh.
- `src/styles/quiz/theme.ts` — màu, easing, `ramp`, `upper`, `paletteFrom`, `analyzeScenes` (tách câu hỏi/dòng chờ/đáp án, cửa sổ đồng hồ), `answerFontSize`, `parseStat`, `estimateLines`.
- `src/styles/quiz/Background.tsx` — gradient, tia sáng xoay, lưới chấm, vignette.
- `src/styles/quiz/ImageFrame.tsx` — khung ảnh/video viền trắng, Ken Burns, ô "?" khi không có ảnh.
- `src/styles/quiz/QuestionCard.tsx` — thẻ câu hỏi, viên tag, lật sang mặt đáp án xanh.
- `src/styles/quiz/Countdown.tsx` — đĩa "?" / vòng đếm ngược 3·2·1 / đĩa ✓.
- `src/styles/quiz/Confetti.tsx` — pháo giấy xác định theo seed.
- `src/styles/quiz/Overlays.tsx` — chấm tiến độ, sticker stat, ruy băng badge, dải phụ đề, dải kêu gọi bình luận, chớp sáng.
- `src/styles/quiz/TitleIntro.tsx` — title card.
