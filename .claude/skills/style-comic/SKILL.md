---
name: style-comic
description: Phong cách "Truyện tranh" — ảnh trong khung truyện viền mực đậm trên trang giấy chấm halftone, hộp lời dẫn vàng in hoa, câu nhấn nổ trong hình BÙM! có tia tốc độ, nhãn dán góc khung, bìa truyện "SỐ 01" mở đầu. Dùng cho chuyện hài, tình huống đời thường phóng đại, siêu anh hùng, trẻ em, meme, kể chuyện vui có nhân vật.
---

# Phong cách: Truyện tranh (comic)

`style: "comic"` trong props. Code: `src/styles/comic/`.

## Nhận diện hình ảnh

- Trang giấy ngà `#FFF4DA`, hai lớp chấm halftone lưới chéo 45° tô theo `accent` (một lớp màu accent dày ở
  góc trên-trái, một lớp màu bù ở góc dưới-phải, thưa dần), vài nét hành động chéo -32°.
- Mỗi cảnh là MỘT khung truyện lớn: viền mực 10px × unit, lề trắng 12px, bóng khối cứng lệch xuống phải,
  nghiêng ngẫu nhiên ±2° cố định theo cảnh. Ảnh được "in lại": tương phản + bão hoà cao (filter tĩnh), chấm
  halftone đổ bóng ở góc dưới-phải, phóng chậm 3% → 10% suốt cảnh.
- Lời dẫn: hộp vàng `#FFE14D` viền đen, bóng khối, chữ `FONTS.sans` 800 IN HOA (bằng JS), ngắt dòng cân
  (`textWrap: balance`), nghiêng ±1.6°. Mọi chữ của phong cách dùng `FONTS.sans` 800/900.
- Câu nhấn: hình nổ răng cưa màu nóng (theo accent) lõi vàng, chữ trắng khổng lồ viền đen + bóng khối, tia tốc độ đen.
- Không ảnh: tia tốc độ toả tròn xen accent / vàng (cảnh chẵn) hoặc accent / màu bù nhạt (cảnh lẻ), tâm trắng.
- Tất cả bằng CSS gradient + SVG tĩnh — không feTurbulence, không blur.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | ảnh/video trong khung truyện, tôn trọng `crop`; video (`.mp4/.mov/.webm`) qua `ClipVideo` với `trimStartMs`, `volume`, phát từ đầu cảnh. `null` → tia tốc độ |
| `captions` | câu hiện tại trong hộp lời dẫn vàng, in hoa, tối đa ~3 dòng (cỡ chữ tự co); bật nhẹ mỗi lần đổi câu |
| `captionPosition` | `bottom`: khung dọc — hộp treo dưới mép khung (khung chừa 190px × unit, hộp 3 dòng lấn nhẹ vào safe.bottom); khung vuông/ngang — hộp đè lên mép dưới khung. `center`: khung kín vùng nội dung, hộp ở giữa khung |
| `punch` | đúng `atMs` (kẹp vào trong cảnh): hình nổ bật quá đà + xoay + rung, tia tốc độ bắn ra, khung giật theo; giữ ~1 s, tổng 42 frame rồi phồng lên tan |
| `tag` | nhãn vàng nghiêng dán góc trên-trái khung, in hoa, suốt cảnh, bật ra 6 frame sau khung |
| `visual` stat | huy hiệu nổ tròn màu bù lõi trắng ở góc trên-phải khung: số lớn màu nóng viền đen, `caption` in hoa bên dưới; xoay vào |
| `visual` badge | băng rôn màu nóng hai đuôi gập ở góc trên-phải khung, chữ trắng viền đen; `caption` trong ô trắng nhỏ bên dưới |
| visual khi không ảnh | đặt giữa khung, phóng 1.6× |
| `title`/`subtitle` | khi `showTitle`: bìa truyện 70 frame — nền tia nắng accent + halftone, măng-sét vàng chứa tít in hoa, ô "SỐ 01", ảnh cảnh đầu trong khung lớn có nhãn "MỚI!", `subtitle` là dải tagline trắng |
| `accent` | màu nóng (nổ, băng rôn, số liệu, chấm nền); màu bù suy ra để đối lập |
| `background` | không dùng — trang giấy cố định |

## Chuyển động

- Đổi cảnh = đập trang: khung mới vào từ 1.35× → 0.95 → 1.025 → 1 trong 13 frame, xoay từ ±7° về góc gốc,
  cả lớp khung rung 10 frame; khung cũ nằm dưới thêm 8 frame rồi mờ đi. Nét hành động nền vụt vào 14 frame.
  Không TransitionSeries — timeline tuyệt đối.
- Cảnh đầu khi có bìa: đập xuống ở frame 62, lúc bìa đang lật văng sang trái (frame 59–70).
- Bìa: măng-sét rơi từ trên (spring), khung ảnh đập (5–18), tagline trượt từ trái (13), "SỐ 01" (19), "MỚI!" (24).
- Chấm halftone trôi chậm; mọi ngẫu nhiên qua `seeded()`; mọi chuyển động từ `useCurrentFrame()`.

## Lỗi cần tránh

- In hoa CHỈ bằng `upperVi()` (`normalize("NFC").toLocaleUpperCase("vi")`). Không CSS `text-transform`,
  `letter-spacing`, `scaleX`, không `FONTS.condensed` — móc Ư/Ơ bị tách.
- KHÔNG dùng `FONTS.rounded` (Avenir Next) cho chữ đậm: đã render thử, bản Bold/Heavy tách móc Ư/Ơ thành
  "CHƯ ƠNG", "MƠ I!". `LETTER`/`HEAVY` trong `Bits.tsx` dùng `FONTS.sans` (SF) — kiểm "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" nếu đổi.
- Chữ có dấu chồng (Ộ, Ạ, Ẩ) cần `lineHeight` ≥ 1.1 cho tít bìa và punch; 1.02 làm dấu dòng dưới chạm dòng trên.
- Số liệu stat dài (> 5 ký tự) sẽ co nhỏ để vừa lõi trắng của huy hiệu — giữ số ngắn ("80%", "2/3", "x10").
- Viền chữ dùng vòng `text-shadow` (`outline()`), không `-webkit-text-stroke`: stroke vẽ cả đường nối bên trong
  glyph có dấu ghép.
- Hình nổ dùng SVG `preserveAspectRatio="none"` để giãn ngang ở khung 16:9; nét viền phải giữ
  `vectorEffect="non-scaling-stroke"`, nếu không viền dày mỏng lệch.
- Punch cả câu dài → chữ co nhỏ, mất cú nổ. Giữ 1–4 từ.
- Punch quá sát cuối cảnh bị kéo sớm lên để kịp nổ hết 42 frame trước khi lật trang — sai giờ thì sửa dữ liệu.
- Hai cảnh quá ngắn (< 1.5 s) liên tiếp làm cú đập trang dồn dập; gộp cảnh.
- Ảnh quá tối (chụp dưới nước, ban đêm) vẫn tối trong khung dù đã tăng sáng nhẹ — chọn ảnh sáng, màu tươi.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng vui, phóng đại, kể như truyện tranh: mọi chuyện nhỏ thành "sự kiện chấn động". Hook mở bằng tình huống
  cường điệu hoặc câu hỏi bất ngờ ("Chuyện gì xảy ra khi…", "Một ngày nọ, deadline tấn công!").
- 4–6 cảnh, mỗi cảnh 1–3 câu; mỗi câu ≤ 55 ký tự (hộp lời dẫn in hoa, dài quá thành 3–4 dòng). Câu ngắn, có nhịp.
- Mỗi cảnh là một "khung truyện": một hành động hoặc một khoảnh khắc rõ ràng, có diễn biến tăng dần tới cao trào.
- `tag`: nhãn bối cảnh ≤ 18 ký tự kiểu lời dẫn góc khung: "LÚC 5 GIỜ CHIỀU", "TRONG KHI ĐÓ…", "3 PHÚT SAU", "TẦNG 12".
- `punch`: 1–4 từ, BẮT BUỘC chép nguyên văn từ một câu đọc trong cảnh đó (đúng chính tả, dấu). Chọn khoảnh khắc
  "BÙM!": từ tượng thanh, cú twist, hành động mạnh ("sập nguồn", "bùm", "cháy máy", "ngừng đập"). Tối đa một punch
  mỗi cảnh; nên có punch ở ít nhất một nửa số cảnh, luôn có ở cảnh cao trào.
- `visual` stat cho con số gây sốc ("99%", "3 GIỜ", "x10") với caption ngắn; badge cho chương/hồi ("CHƯƠNG 1",
  "HIỆP 2", "PHẦN KẾT"). Tối đa 2 cảnh có visual.
- `image`: ảnh có nhân vật hoặc biểu cảm/hành động rõ, màu tươi, chủ thể lớn giữa khung; minh hoạ hoạt hình rất
  hợp. Tránh ảnh tối, phong cảnh rộng không tâm điểm. Cảnh không ảnh (tia tốc độ) chỉ dùng cho khoảnh khắc nổ/cao trào.
- Kết bằng một câu chốt hài hoặc "Hẹn gặp ở số sau!" gợi theo dõi.
<!-- /ai-guide -->

## File

- `src/styles/comic/index.tsx` — bố cục theo tỉ lệ khung hình, vòng đời mỗi cảnh (đập trang), punch, hộp lời dẫn, bìa
- `src/styles/comic/Page.tsx` — trang giấy, chấm halftone, nét hành động
- `src/styles/comic/Panel.tsx` — viền khung truyện, ảnh/video "in lại", tia tốc độ
- `src/styles/comic/Bits.tsx` — NarrationBox, TagLabel, VisualBit (huy hiệu nổ / băng rôn), BurstShape, PunchBurst
- `src/styles/comic/Cover.tsx` — bìa truyện mở đầu
- `src/styles/comic/palette.ts` — màu, `upperVi`, `outline`, `fitBlock`, đa giác hình nổ
