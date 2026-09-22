---
name: style-neon
description: Phong cách "Đêm neon" — phố đêm: ảnh/video tối đi ngả xanh đêm – tím hồng (không ảnh thì tường gạch), phụ đề là chữ ống neon lõi trắng nóng bật chập chờn từng câu, câu nhấn là biển hiệu chữ viết liền màu ống phụ rè lên, tag là biển "OPEN" nhỏ ở góc, số liệu neon cỡ lớn, tiêu đề thắp từng chữ. Dùng cho đời sống về đêm, âm nhạc, gaming, thành phố, động lực đêm khuya, K-pop, tiệc tùng.
---

# Phong cách: Đêm neon (neon)

`style: "neon"` trong props. Code: `src/styles/neon/`.

## Nhận diện hình ảnh

- Ảnh/video toàn khung, `brightness(0.62) contrast(1.15) saturate(1.25)`, nhân xanh đêm `#3a3fb8` (multiply 75%)
  rồi phủ gradient màu ống chính → ống phụ (screen). Đẩy máy rất chậm 1.04 → 1.12 suốt cảnh.
- Cảnh không ảnh (và màn hình tiêu đề): tường gạch SVG pattern hai hàng so le, mạch vữa tối, hạt tĩnh,
  ánh neon hắt lên tường (quầng màu chính phía trên, màu phụ loang dưới), vignette.
- Hai màu ống suy từ `accent`: **ống chính** = sắc độ của accent, bão hoà 100% (phụ đề, tag, số liệu, tiêu đề);
  **ống phụ** chỉ là cyan (188°) hoặc hồng cánh sen (318–328°) tuỳ accent (câu nhấn, khung tiêu đề, chấm đèn
  tag, gạch dưới số liệu). Accent xám/trắng/đen → hồng cánh sen + cyan.
- Chữ ống neon: màu lõi `hsl(h,100%,95%)` (trắng nóng) + 5 lớp `text-shadow` từ viền sáng tới quầng rộng,
  bán kính tỉ lệ cỡ chữ. Dưới chữ sáng luôn có bản "ống tắt" (thuỷ tinh mờ) để lúc chập chờn vẫn thấy hình chữ.
- Font: `comfortaa` 700 (chữ tròn nét đều như ống uốn) cho mọi chữ; `pacifico` (viết liền) chỉ cho câu nhấn.
  Cả hai đóng gói sẵn, nạp bằng `ensureFonts`.
- Không khí: sương mù màu hai góc trôi chậm, vệt phản chiếu chéo quét qua khung mỗi 150 frame, hạt `Grain`, vignette.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu hiện tại, chữ ống neon màu chính, giữ hoa thường; mảng tối mềm phía sau để đọc được; bật chập chờn 10 frame mỗi câu |
| `captionPosition` | `bottom`: sát trên `captionBottom`; `center`: giữa khung (punch dời lên 1/3 trên, hoặc xuống 73% nếu cảnh có visual) |
| `punch` | đúng `atMs`: biển hiệu chữ viết liền màu ống phụ, khung ống bo tròn, nghiêng ±3°, rè 16 frame rồi sáng đều tới hết cảnh (ít nhất 40 frame), chớp tắt 4 frame cuối; cụm đó trong phụ đề cũng đổi sang màu ống phụ |
| `tag` | biển "OPEN" nhỏ góc trái trên: ống viên thuốc màu chính, chấm đèn màu phụ, chữ in hoa bằng JS |
| `visual` stat | con số neon lớn đếm lên 30 frame (giữ `80%`, `+30K`, `1.200`, `2,5 triệu`), gạch ống màu phụ, chú thích trắng |
| `visual` badge | chữ in hoa trong khung ống bo góc màu chính, chú thích bên dưới |
| `image` | ảnh hoặc video (qua `SceneMedia`: tôn trọng `crop`, `trimStartMs`, `speed`, `volume`); null → tường gạch |
| `title`/`subtitle`/`handle` | 70 frame trên tường gạch: khung ống màu phụ rè lên, tiêu đề thắp từng chữ (≤ 2 frame/chữ), dòng phụ màu phụ bật sau, handle trắng mờ ở đáy; 9 frame cuối mờ dần lộ cảnh đầu |
| `accent` | màu ống chính (và quyết định ống phụ) |
| `background` | không dùng — nền luôn là đêm `#07060d` |

Bố cục: dọc/vuông — tag góc trái trên, visual giữa phía trên (dưới tag), punch giữa khung (40%, hoặc 50% khi có
visual), phụ đề dưới. Ngang — visual cột trái, punch dời sang phải (62%) khi có visual.

## Chuyển động

- Bật ống (`flicker`): frame 0 luôn tối, sau đó mỗi frame bốc thăm theo seed với xác suất sáng tăng dần,
  hết `length` frame thì sáng hẳn. Phụ đề 10, tag/visual 12, punch 16, mỗi chữ tiêu đề 5.
- Ống đã sáng (`hum`): dao động ±5%, mỗi khối 120 frame có ~50% một frame sụt sáng — mỗi ống seed riêng.
- Đổi cảnh: hoà 10 frame (cảnh cũ vẫn vẽ bên dưới); tag/visual của cảnh mới bật lại sau 4/8 frame.
- Câu cuối tắt (chớp) 18 frame sau `endMs`. Phần tử của cảnh đầu đợi màn hình tiêu đề tắt mới bật.
- Mọi ngẫu nhiên qua `seeded()`; mọi chuyển động từ `useCurrentFrame()`.

## Lỗi cần tránh

- Đừng thắp từng chữ cho `pacifico`: tách span làm gãy nét nối chữ viết liền. Chỉ tiêu đề (comfortaa) mới tách từng ký tự
  (`glyphs()` theo NFC để không cắt đôi dấu).
- In hoa bằng `toLocaleUpperCase("vi")`, không dùng `text-transform`/`letter-spacing`. Đã render thử
  "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" với comfortaa 700 — móc Ư/Ơ đúng chỗ.
- Đừng lấy màu bù thẳng cho ống phụ: đỏ → xanh lá trông như đèn Giáng sinh. Giữ cyan/hồng cánh sen.
- `text-shadow` 5 lớp khá nặng — đừng áp cho khối chữ dài (đoạn văn) hay nhân thêm lớp; câu dài co cỡ chữ (tối thiểu 66%).
- Quầng sáng dựa trên nền tối: đừng bỏ lớp nhân xanh đêm của ảnh, ảnh sáng sẽ nuốt mất glow.
- Punch dài cả câu → chữ viết liền nhỏ và khó đọc. Stat quá 6–7 ký tự → số co nhỏ.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Không khí về đêm, nhịp nhanh, hơi "cool": nói như DJ, streamer hay người bạn rủ đi chơi đêm. Mở bằng hook ngắn
  gợi cảm giác đêm: "Ba giờ sáng…", "Khi cả thành phố đã ngủ…", "Đêm nay…".
- 3–5 cảnh, mỗi cảnh 1–3 câu; mỗi câu ≤ 50 ký tự (chữ neon to, dài quá thành 3 dòng và co nhỏ).
- Giữ hoa thường tự nhiên, không viết IN HOA cả câu.
- `tag`: như biển hiệu nhỏ ≤ 14 ký tự — địa điểm, giờ, tên bài/màn: "QUẬN 1", "2 GIỜ SÁNG", "LIVE", "ROUND 2", "OPEN".
- `punch`: 1–4 từ đắt nhất, PHẢI chép nguyên văn từ một câu của cảnh — nó thành biển hiệu chữ viết liền, càng ngắn càng đẹp.
  Tối đa một punch mỗi cảnh, không phải cảnh nào cũng cần.
- `visual` stat cho con số gây ấn tượng ("24/7", "3AM", "120 BPM", "1 triệu"); badge cho nhãn chương ("LEVEL 1", "TRACK 2"). Tối đa 1–2 cảnh.
- `image`: ảnh/video đêm thật — phố đèn, biển hiệu, quán đêm, sân khấu, phòng game RGB, mưa phản chiếu đèn.
  Tránh ảnh ban ngày chói, nền trắng. Cảnh không ảnh vẫn đẹp (tường gạch) nhưng đừng quá nửa số cảnh.
- Kết bằng một câu gọi chung vui hoặc thả tim: "Hẹn bạn ở ca đêm sau.", "Đêm nay bạn đang ở đâu?".
<!-- /ai-guide -->

## File

- `src/styles/neon/index.tsx` — ghép lớp theo thứ tự, nạp font
- `src/styles/neon/Backdrop.tsx` — cảnh (ảnh/video chỉnh màu đêm, hoà cảnh), tường gạch, sương mù, vệt phản chiếu
- `src/styles/neon/Signs.tsx` — phụ đề neon, biển câu nhấn, biển tag, số liệu/nhãn
- `src/styles/neon/TitleIntro.tsx` — màn hình tiêu đề thắp từng chữ
- `src/styles/neon/neon.ts` — bảng màu từ accent, quầng sáng chữ/ống, nhịp nhấp nháy, tìm cụm nhấn
