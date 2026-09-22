---
name: style-watercolor
description: Phong cách "Tranh màu nước" — giấy vẽ cold-press trắng ngà có vân nổi, mỗi cảnh là một bức tranh màu nước loang ra từ các vệt cọ (mép răng cưa mềm, viền màu đậm như nước đọng khi khô, ảnh nhạt màu mơ màng phủ lớp màu nhấn pha nước), đốm vẩy màu và vết loang tròn ở góc, phụ đề viết tay canh giữa trên nền giấy hiện từng từ như mực thấm, nhãn là một vệt cọ ngang, câu nhấn đổi màu nhấn với nét cọ gạch chân vẽ dần, con số nằm trong vết loang tròn, sang cảnh tranh cũ bị rửa trôi trong khi tranh mới loang lên, cảnh không ảnh là mảng loang trừu tượng + cành lá vẽ tay. Dùng cho thơ, trích dẫn, lời hay ý đẹp, suy ngẫm cảm xúc, kỷ niệm du lịch, nghệ thuật – văn hoá, kể chuyện nhẹ nhàng.
---

# Tranh màu nước

## Nhận diện hình ảnh

- Nền giấy vẽ trắng ngà `#f6f1e6`. Vân giấy cold-press (nhiễu fractal chiếu sáng xiên) + thớ sợi rất nhạt được **nhân
  (multiply) lên mọi lớp** — ảnh cũng ăn vân giấy như màu vẽ thật. Viền tối ấm rất nhẹ ở mép khung.
- **Dọc** (9:16, 3:4, 1:1): bức tranh chiếm phần trên (~63% ở 9:16), nhãn + phụ đề trên nền giấy phía dưới.
  **Ngang** (16:9, 2:1): tranh bên trái (~56% bề ngang), cột chữ bên phải gom giữa chiều cao.
- Bức tranh: mặt nạ SVG gồm một mảng lớn + 9 vệt vệ tinh (tròn to nhỏ xen vệt dài như một lần quét cọ), hai lượt
  nhiễu turbulence (uốn lớn + xơ mịn) nên mép như giấy thấm. Sau ảnh là một lớp loang màu rộng hơn một chút có viền
  đậm ở mép (bộ lọc arithmetic 1.7·hình − 0.95·hình_mờ) — thành vành màu loang ra ngoài ảnh.
- Ảnh hơi nhạt màu (`saturate 0.7`, sáng lên), phủ màu nhấn pha nước (multiply 20%) và sương giấy ở mép — mơ màng.
- Chữ: **Dancing Script** 600 (đóng gói, đủ dấu) cho phụ đề ngắn, tiêu đề, nhãn, con số; câu dài co tới 54px mà vẫn
  tràn thì chuyển sang **Lora** 500 cho dễ đọc. Mực chữ `#3a3244`. Không in hoa bằng CSS.
- Bảng màu suy từ `accent`: màu loang = accent pha trắng 32%; màu chữ nhấn = accent pha đậm (accent càng sáng pha càng
  đậm để đọc được trên giấy); màu phụ xoay vòng theo cảnh: xanh lam `#86a9c6`, vàng đất `#e0ad73`, hồng `#d9929f`,
  xanh lá mạ `#93b28c`. `background` của video bị bỏ qua (luôn là giấy).
- Mọi họa tiết (vị trí vệt, đốm, màu) lấy từ `seeded()` theo chỉ số cảnh + ảnh — cùng props cùng hình.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Tranh màu nước: ảnh loang ra qua mặt nạ vệt cọ trong ~26 frame, phóng 1.02 → 1.09 suốt cảnh. Video: phát trong mặt nạ, tắt tiếng, lặp (`SceneMedia`). |
| `image: null` | Mảng loang trừu tượng nhiều màu (cùng hình loang), cành cây mảnh vẽ dần với lá màu nước ở góc dưới trái, một bông hoa năm cánh góc trên phải. |
| `tag` | Nhãn vệt cọ: một nét cọ ngang màu loang vẽ từ trái sang, chữ viết tay đậm ở giữa; nằm trên cùng vùng chữ (ngay trên phụ đề). |
| `captions` | Từng câu, canh giữa trên giấy, cân dòng (không để một từ mồ côi), tối đa 3 dòng chữ viết tay / 6 dòng Lora. Mỗi từ thấm ra: mờ nhoè → rõ, màu loang → màu mực, cách nhau 2–7 frame tuỳ độ dài câu. Câu cũ nhoè và phai trong 9 frame. |
| `punch` | Có nguyên văn trong câu: cụm từ đổi sang màu nhấn đậm (Dancing 700) và nét cọ gạch chân màu nhấn vẽ dần từ trái sang lúc `atMs` (không sớm hơn lúc từ cuối của cụm hiện). Không khớp câu nào của cảnh → thêm một dòng viết tay màu nhấn có gạch chân dưới câu đang đọc lúc `atMs`. |
| `visual` stat/badge | Vết loang tròn (lót giấy + hai lớp màu, viền đậm) nở ra, con số viết tay màu nhấn + chú thích Lora nghiêng. Có ảnh: đè góc dưới phải bức tranh (đốm màu dời lên hai góc trên). Không ảnh: lớn, giữa mảng loang. |
| `title`/`subtitle`/`handle` | Khi `showTitle`: nét cọ lớn màu loang (thêm một nét phụ màu khác lệch dưới) quét ra, tiêu đề viết tay hiện dần từ trái sang từng dòng, năm bông hoa nở quanh nét cọ, dòng phụ Lora nghiêng, `~ handle ~` màu nhấn. Tan (mờ + nhoè) ở frame 54–70 trong khi tranh cảnh đầu loang lên bên dưới. |

## Chuyển động

- Màu nước lan nhanh rồi chậm dần (`Easing.bezier(0.22, 0.61, 0.36, 1)`), không spring, không nảy.
- Vào cảnh: các vệt loang lần lượt (mỗi vệt trễ 6–45% tiến độ) trong 26 frame; đốm vẩy + vết loang góc nở frame 4–40;
  nhãn vẽ frame 8–26; vết loang con số nở frame 14–40; cành lá (cảnh không ảnh) mọc frame 8–56.
- Sang cảnh: tranh cũ bị rửa trôi trong 24 frame — các vệt co còn 60%, nhiễu uốn mạnh hơn, nhoè 7px, phai; tranh mới
  loang lên trên cùng lúc. Mốc cảnh/phụ đề giữ nguyên frame tuyệt đối (không TransitionSeries).
- Clip video bắt đầu phát ở `startMs` thật của cảnh; cảnh đầu loang từ frame `TITLE_FRAMES - 18` nếu có trang tiêu đề.

## Lỗi cần tránh

- Mặt nạ ảnh là data-URI SVG trong `-webkit-mask-image` (vẽ nửa độ phân giải). Đừng đổi sang `mask: url(#id)` trỏ vào
  `<mask>` inline — Chrome không mask phần tử HTML/video đáng tin cậy bằng cách đó.
- id của `<filter>` inline phải duy nhất theo cảnh (`wc0-…`, `wc1-…`) vì hai cảnh cùng hiện lúc chuyển.
- Đo chữ bằng canvas để ngắt dòng — phải đợi `useFontReady("dancing")` và `useFontReady("lora")`.
- Dancing Script in hoa cả câu vẫn đủ dấu (móc Ư/Ơ đúng chỗ) nhưng khó đọc hơn — hạn chế câu IN HOA dài.
- Câu > ~90 ký tự sẽ chuyển sang Lora và nhỏ dần (tối thiểu 28px) — nên tách câu để giữ chất viết tay.
- `tag` dài hơn ~24 ký tự bị co chữ cho vừa vùng chữ; `visual.caption` quá 2 dòng bị cắt.
- Nhiều bộ lọc SVG (turbulence, displacement) mỗi frame — render chậm hơn các phong cách phẳng một chút.
- Phụ đề là nội dung trang (vùng chữ riêng trên giấy, căn theo bức tranh) nên phong cách này **không** nhận kiểu phụ đề
  tuỳ chỉnh.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng thơ, dịu dàng, chậm rãi như lời tự sự hay một đoạn tuỳ bút. Câu ngắn, giàu hình ảnh (gió, lá, mưa, nắng chiều, phố cũ, mùa). Không hô hào, không chấm than dồn dập, không từ lóng, không emoji.
- Viết thường như câu văn (không IN HOA cả câu); mỗi cảnh 1–2 câu, mỗi câu tốt nhất dưới ~60 ký tự để giữ chữ viết tay to (câu dài hơn sẽ đổi sang chữ in nhỏ hơn).
- `tag`: nhãn 1–4 từ, tối đa 22 ký tự, như dòng đề của bức tranh — "Hà Nội, tháng Mười", "Lời hay ý đẹp", "Mùa thu", "Gửi em", "Hội An".
- `punch`: chép NGUYÊN VĂN 2–5 từ trong một câu của chính cảnh đó — cụm từ đọng lại nhất ("nhẹ như một cánh lá", "sống chậm lại"); sẽ đổi màu và có nét cọ gạch chân.
- `visual` stat cho một con số mang cảm xúc ("365", "10 năm", "1 lần", "3 giờ sáng") kèm caption ngắn thơ ("ngày thương nhớ"); badge cho một chữ ngắn ("Lời nhắn"). Dùng tiết kiệm, 1–2 lần mỗi video.
- Nên để một cảnh không ảnh cho câu trích dẫn/đúc kết — sẽ thành mảng màu loang trừu tượng với cành lá vẽ tay.
- Ảnh: phong cảnh, ánh sáng dịu, tông pastel, nhiều khoảng trống, chủ thể rõ (hoa, lá, phố cổ, biển, người nhìn xa) — hợp nhất với tranh màu nước hoặc ảnh chụp mềm.
- Kết bằng một câu lắng đọng, một lời chúc hay lời nhắn nhủ nhẹ nhàng.
<!-- /ai-guide -->

## File

- `src/styles/watercolor/index.tsx` — bố cục dọc/ngang, bức tranh mỗi cảnh (mặt nạ loang, vành màu, đốm góc, cành lá),
  nhãn vệt cọ, vết loang con số, phụ đề thấm từng từ + gạch chân câu nhấn, trang tiêu đề.
- `src/styles/watercolor/paint.tsx` — bảng màu, bộ lọc loang mép, sinh vệt + mặt nạ data-URI, nét cọ, đốm vẩy, hoa,
  cành lá, vân giấy.
- `src/styles/watercolor/text.ts` — đo chữ bằng canvas, ngắt dòng, co cỡ, cân dòng, in hoa tiếng Việt.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
