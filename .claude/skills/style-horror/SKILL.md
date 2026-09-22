---
name: style-horror
description: Phong cách "Truyện ma" — kể chuyện ma lúc nửa đêm (rợn, không máu me): ảnh rút màu ám lục lạnh, vignette nặng, đẩy máy chậm rung tay nhẹ, đèn chập chờn, sương trôi, bụi, hạt phim; phụ đề chữ có chân trắng ngà run nhẹ; nhãn giờ/nơi chốn gõ chữ kèm chấm đỏ nháy; câu nhấn thành cú hù chữ đỏ máu + chớp tối + rung; số liệu là con dấu khắc xước. Dùng cho truyện ma, chuyện rùng rợn, bí ẩn chưa lời giải, truyền thuyết đô thị, "chuyện lạ có thật", kể chuyện hồi hộp.
---

# Phong cách: Truyện ma (horror)

`style: "horror"` trong props. Code: `src/styles/horror/`.

## Nhận diện hình ảnh

- Ảnh/video toàn khung như cảnh quay lúc 3 giờ sáng: rút màu (`saturate 0.26`), tối, tương phản cao, rồi
  nhân màu xám lục + nâng vùng đen lên lục thẫm. Vignette nặng, đáy tối dần để phụ đề luôn đọc được.
- Sương: một lớp `feTurbulence` tần số thấp (seed cố định) đung đưa ngang thật chậm, dồn về đáy bằng mask,
  cộng hai mảng sương gradient trôi ngược chiều. Bụi: 34 chấm nhợt trôi lên chéo, chập chờn. `Grain` 0.2.
- Đèn chập chờn: chỉ làm TỐI đi (không loé sáng), mỗi khối 54 frame ~55% có một nhịp tắt–sáng–tắt 2–4 frame.
- Phụ đề: Lora 500 trắng ngà `#e6e2d6`, bóng tối mềm, hoa thường tự nhiên, một câu một lúc ở 1/3 dưới.
- Màu nhấn duy nhất: đỏ máu `#c8141c` (câu nhấn, dòng phụ tiêu đề, chấm REC). `accent`/`background` không dùng.
- Cảnh không ảnh: phòng tối đen vẽ SVG — cảnh chẵn là cửa sổ vòm hắt ánh trăng lạnh có bóng cành khô,
  cảnh lẻ là cánh cửa hé một khe sáng; vệt sáng loe xuống sàn.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu hiện tại, Lora, co theo độ dài (`fitFontSize`); hiện dần 12 frame kèm vài nhịp chập + run lệch nhỏ dần 9 frame |
| `captionPosition` | `bottom`: đáy khối chữ ở `captionBottom`; `center`: giữa khung (con dấu dời lên sát dưới tag) |
| `punch` | cú hù đúng `atMs`: cụm từ trong phụ đề chuyển đỏ máu đậm + ánh đỏ, giật 9 frame; cả khung chớp tối MỘT lần 3 frame, rung + tách màu đỏ/lục-lam 9 frame rồi yên. Không tìm thấy cụm từ trong phụ đề nào của cảnh (hoặc phụ đề do trình chỉnh sửa vẽ) → hiện riêng giữa khung, Playfair đỏ in hoa, ~1.4 s |
| `tag` | nhãn băng camera góc trên-trái: chấm đỏ nháy (16 frame) + chữ in hoa (JS) gõ từng ký tự, Be Vietnam Pro |
| `visual` stat | con dấu khắc: khung viền kép nghiêng 1–3°, số Playfair 800 lõm, vết xước cắt ngang, hiện chập chờn; `caption` nghiêng bên dưới |
| `visual` badge | cùng con dấu, chữ nhỏ hơn in hoa ("HỒ SƠ 07") |
| `image` | ảnh hoặc video qua `SceneMedia` (tôn trọng `crop`, `trimStartMs`, `speed`, `volume`); `null` → phòng tối SVG |
| `title`/`subtitle`/`handle` | 70 frame: bóng tối có sương, "— Chuyện có thật? —" mờ, tiêu đề Playfair hiện dần khỏi bóng tối (nhoè → nét, vài nhịp chập), dòng phụ đỏ máu nghiêng, handle; tan vào cảnh đầu |

## Chuyển động

- Đẩy máy chậm: phóng 1.08 → 1.18 suốt cảnh; rung tay = tổng 3 sóng sin lệch pha (±~13px × unit, xoay ±0.35°).
- Đổi cảnh: nhúng đen — tối dần 10 frame cuối cảnh, sáng dần 14 frame đầu cảnh sau. Chỉ vẽ cảnh hiện tại.
- Cú hù: chớp tối 0.88 → 0.2 trong 3 frame, rung ±22px × unit tắt dần + tách màu 10px × unit trong 9 frame.
- Mọi ngẫu nhiên qua `seeded()`; mọi chuyển động từ `useCurrentFrame()`.

## Lỗi cần tránh

- KHÔNG thêm chớp sáng/nhấp nháy trắng: chỉ làm tối, tối đa một chớp mỗi punch (an toàn cho người nhạy cảm ánh sáng).
- Cụm từ nhấn trong phụ đề là `<span>` inline với `position: relative` để giật — đừng đổi sang `inline-block` + `scale`:
  đã render thử, khoảng trắng trước cụm từ bị nuốt và chữ phóng to đè lên từ bên cạnh.
- Tách màu dùng MỘT filter SVG (feColorMatrix → feOffset → feBlend) trên khung hình đã giải mã, chỉ bật trong 9 frame
  cú hù — không nhân bản ảnh/clip.
- `feTurbulence` toàn khung đắt: chỉ sương (seed cố định) và `Grain` chạy mọi frame. Đừng thêm blur động toàn khung.
- Đừng dùng CSS `text-transform` cho tag/badge/punch — in hoa bằng `toLocaleUpperCase("vi")`; kiểm still với "ĐỪNG THƯỜNG ƯU ƠN NHỮNG".
- Ảnh gốc rất sáng (tường trắng, trời trưa) vẫn hơi xám sau khi chỉnh màu — chọn ảnh tối, cảnh đêm, hành lang, rừng, nhà hoang.
- Font Lora/Playfair/Be Vietnam Pro nạp bằng `ensureFonts` trong `index.tsx` — đừng bỏ, kẻo khung đầu ra font dự phòng.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng kể chậm, thì thầm, ngôi thứ nhất hoặc "người ta kể rằng…". Mở bằng hook gợi tò mò/rợn: "Chưa ai ở quá ba đêm…",
  "Đây là chuyện có thật ở…". Rợn bằng không khí và chi tiết lạ — KHÔNG máu me, không bạo lực chi tiết.
- 4–6 cảnh, mỗi cảnh 1–3 câu ngắn; mỗi câu ≤ 60 ký tự. Câu cuối để lửng hoặc hỏi người xem ("Bạn có dám ở không?").
- Giữ hoa thường tự nhiên, không viết IN HOA cả câu.
- `tag`: mốc giờ/nơi chốn như nhãn băng camera, ≤ 22 ký tự: "3:00 SÁNG · Nhà số 13", "Đêm thứ ba", "Phòng 404", "Rừng U Minh, 1998".
- `punch`: cú hù — 2–4 từ đắt nhất (chi tiết rợn hoặc cú twist), PHẢI chép nguyên văn từ một câu của cảnh; tối đa một
  punch mỗi cảnh và chỉ 1–2 punch cả video, để dành cho cao trào.
- `visual` stat cho con số ám ảnh ("13", "3 đêm", "1998"), badge cho nhãn hồ sơ ("HỒ SƠ 07", "VỤ ÁN 2"). Không cảnh nào cũng có.
- `image`: ảnh tối, vắng người — hành lang, cửa, cửa sổ, nhà hoang, rừng đêm, con đường có đèn vàng, búp bê cũ; tránh ảnh
  sáng rực, đồ hoạ phẳng, ảnh máu me. Cảnh để `null` (phòng tối có cửa sổ/cửa hé) rất hợp cho khoảnh khắc hồi hộp.
<!-- /ai-guide -->

## File

- `src/styles/horror/index.tsx` — ghép lớp theo thứ tự, nạp font
- `src/styles/horror/Footage.tsx` — ảnh/video, chỉnh màu lục lạnh, đẩy máy + rung tay, rung/tách màu cú hù, phòng tối SVG
- `src/styles/horror/Atmos.tsx` — sương, bụi, vignette, đèn chập chờn, hạt phim, chớp tối
- `src/styles/horror/Text.tsx` — phụ đề + câu nhấn đỏ, nhãn gõ chữ chấm đỏ, con dấu khắc xước, punch lẻ giữa khung
- `src/styles/horror/TitleIntro.tsx` — tiêu đề hiện ra khỏi bóng tối
- `src/styles/horror/look.ts` — bảng màu, nhịp chập chờn, rung tay, cửa sổ cú hù, tìm câu nhấn trong phụ đề
