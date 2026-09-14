---
name: style-retro
description: Phong cách "Băng VHS" — footage máy quay thập niên 80–90: màu nhạt ấm, lệch màu đỏ/xanh, scanline, OSD REC/pin/ngày giờ, phụ đề TV cũ, giật tín hiệu cho câu nhấn, màn hình xanh "▶ PLAY" mở đầu. Dùng cho hoài niệm, kể chuyện tuổi thơ, "ngày xưa vs bây giờ", ký ức gia đình, lịch sử đời thường, đồ vật cũ.
---

# Phong cách: Băng VHS (retro)

`style: "retro"` trong props. Code: `src/styles/retro/`.

## Nhận diện hình ảnh

- Ảnh/video toàn khung như băng quay máy cầm tay: bớt bão hoà, ngả ấm, tương phản thấp, đen được nâng
  lên tím xanh (không có đen tuyền), nhoè tĩnh 0.6px × unit. Lệch màu đỏ/lục-lam vài px, phóng 6% để
  rung ngang không lộ mép.
- Lớp băng từ phủ trên cùng (cả chữ): scanline 1px/3px × unit, dải tracking sáng rè trôi từ trên xuống
  (chu kỳ 10 s), hạt `Grain`, vignette + bo góc màn hình CRT.
- OSD máy quay: `● REC` đỏ nháy (trái trên), pin 3 vạch + `SP` (phải trên), `CH 03 · <TAG>` dưới REC,
  giờ `21:04:37` chạy theo thời gian video + ngày `12 THG 08 1998` (trái dưới, dọc 2 dòng / ngang 1 dòng).
  Ngày và giờ bắt đầu suy từ `seeded(title)` — cùng video luôn cùng ngày.
- Phụ đề TV cũ: chữ vàng `FONTS.sans` đậm trên hộp đen 66%, bóng lệch đỏ/xanh, giữ nguyên hoa thường.
- Cảnh không ảnh: nền băng xanh đen, tuyết nhiễu 10%.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu hiện tại trong hộp đen; hộp mở như dòng quét (3 frame) rồi chữ gõ vào (≤ 12 frame) |
| `captionPosition` | `bottom`: đáy hộp ở `captionBottom`; `center`: giữa khung (punch dời lên 1/3 trên) |
| `punch` | đúng `atMs`: chớp nhiễu 3 frame, cụm từ cỡ lớn giữa khung, bóng đỏ/xanh lệch 18→5px, rung + xiên, ~1 s |
| `tag` | `CH 0n · TAG` (in hoa bằng JS) dưới REC, suốt cảnh |
| `visual` stat | bộ đếm băng: nhãn `▶▶ COUNTER`, số lớn mono đếm lên 36 frame (giữ `80%`, `+30K`, `1.200`, `2,5 triệu`), chú thích bên dưới |
| `visual` badge | hộp xanh viền trắng kiểu `VIDEO 1` ở phải trên, dưới pin; `caption` nhỏ bên dưới |
| `image` | ảnh: 2 bản kênh màu; video: 1 bản + filter SVG (xem dưới). Tôn trọng `crop`, `trimStartMs`, `volume` |
| `title`/`subtitle`/`handle` | màn hình xanh `#1a2fbf` 70 frame: `▶ PLAY` nháy, tiêu đề gõ chữ, bộ đếm `0:00:0x`; ẩn phụ đề và OSD |
| `accent`/`background` | không dùng — bảng màu cố định của băng VHS |

## Chuyển động

- Rung ngang: mỗi 3 frame bốc thăm theo seed, ~55% số lần rung ±2.5px × unit, thỉnh thoảng ×3.
- Giật hình: mỗi khối 42 frame có ~50% một cú giật 1–2 frame — hình dời 11–22px, lệch màu 9px, 3 thanh màu ngang.
- Đổi cảnh (và cuối title): nhiễu trắng 6 frame quanh điểm cắt — tuyết tương phản cao + dải sáng + ám hồng/lục.
  Chỉ vẽ cảnh hiện tại; cú nhiễu che điểm cắt, không cross-fade.
- Mọi ngẫu nhiên qua `seeded()`; mọi chuyển động từ `useCurrentFrame()`.

## Lỗi cần tránh

- `FONTS.mono` (SF Mono/Menlo) thiếu một số chữ Việt: dấu vẫn hiện nhưng Ư/Ơ lấy glyph từ font khác,
  đậm nhạt và bề rộng lệch hẳn so với chữ bên cạnh (đã render thử "ĐỪNG THƯỜNG ƯU ƠN").
  `osdFont()` chỉ dùng mono cho chuỗi ASCII; có dấu thì `FONTS.sans`. Đừng bỏ.
- Đừng dùng CSS `text-transform: uppercase` hay `letter-spacing` cho tag/badge — in hoa bằng
  `toLocaleUpperCase("vi")`. Kiểm still với "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" khi đổi font.
- Chi phí render cảnh video: KHÔNG giải mã clip 3 lần để tách kênh. Cảnh video dùng một `<ClipVideo>` và
  `filter: url(#retro-rgb-n)` (feColorMatrix → feOffset → feBlend). Đo trên máy này: still cảnh video
  720×1280 → 1080×1920 ~3 s, ngang cảnh ảnh (đã tính khởi động Chrome). Đừng thêm filter động nặng khác
  lên video (blur lớn, drop-shadow toàn khung).
- Nhoè chỉ 0.6px và cố định — blur động toàn khung làm render chậm hẳn.
- `feTurbulence` toàn khung đắt: chỉ `Grain` chạy mọi frame; tuyết toàn khung chỉ bật trong cú nhiễu 6 frame,
  chớp punch 3 frame và cảnh không ảnh.
- Punch dài cả câu → chữ nhỏ, mất cú giật. Stat quá 8 ký tự → số co nhỏ.
- Ảnh quá sáng (nền trắng/be) làm OSD trắng khó đọc — chọn ảnh tối vừa hoặc chấp nhận.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng hoài niệm, kể chuyện chậm rãi, gần gũi như lật lại cuộn băng gia đình. Mở bằng hook gợi ký ức:
  "Bạn còn nhớ…", "Hồi đó…", "Có ai từng…".
- 3–5 cảnh, mỗi cảnh 1–3 câu; mỗi câu ≤ 60 ký tự (phụ đề hộp đen, dài quá thành 3 dòng).
- Giữ hoa thường tự nhiên, không viết IN HOA cả câu.
- `tag`: nhãn kênh ngắn ≤ 16 ký tự kiểu băng dán nhãn: "NĂM 1998", "TẬP 1", "HÀ NỘI 1995", "TẾT 2001".
- `punch`: cụm hoài niệm hoặc cú twist đắt nhất (2–5 từ), PHẢI chép nguyên văn từ một câu của cảnh; tối đa một punch mỗi cảnh.
- `visual` stat cho năm, số lượng, số tiền ("1998", "2,5 triệu", "30 năm"); badge cho nhãn chương ("VIDEO 1", "PHẦN 2"). Không cảnh nào cũng có.
- `image`: ảnh thật, có không khí cũ — đồ vật, đường phố, gia đình, TV, máy cát-xét; tránh ảnh studio bóng bẩy
  hay đồ hoạ phẳng. Video quay tay rất hợp. Cảnh không ảnh vẫn ổn (nền băng xanh) nhưng đừng quá nửa số cảnh.
- Kết bằng một câu lắng đọng hoặc gợi chia sẻ ký ức ("Bạn còn giữ cuộn băng nào không?").
<!-- /ai-guide -->

## File

- `src/styles/retro/index.tsx` — ghép lớp theo thứ tự
- `src/styles/retro/Footage.tsx` — ảnh/video, chỉnh màu, lệch màu (2 bản cho ảnh, filter SVG cho video), rung/giật, nền không tín hiệu
- `src/styles/retro/Look.tsx` — scanline, dải tracking, hạt, vệt giật, nhiễu đổi cảnh, vignette bo góc
- `src/styles/retro/Osd.tsx` — REC, pin, SP, kênh + tag, ngày giờ
- `src/styles/retro/Text.tsx` — phụ đề TV, punch giật tín hiệu, bộ đếm số liệu, nhãn VIDEO
- `src/styles/retro/TitleIntro.tsx` — màn hình xanh ▶ PLAY
- `src/styles/retro/Noise.tsx` — tuyết nhiễu SVG
- `src/styles/retro/vhs.ts` — nhịp rung/giật/nhiễu, đồng hồ giả, tách số liệu, chọn font OSD
