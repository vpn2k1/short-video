---
name: style-vox
description: Phong cách "Cắt dán tài liệu" kiểu Vox — ảnh dán như sticker trên giấy kẻ ô, nhãn highlighter vàng, câu nhấn quét bút dạ. Dùng cho video giải thích sự kiện, lịch sử, kinh tế, "vì sao X xảy ra", chuyện có nhân vật/đồ vật cụ thể.
---

# Cắt dán tài liệu (vox)

## Nhận diện hình ảnh

- Nền giấy ngà ấm, lưới kẻ ô mảnh, hai vệt màu loang (một màu bám `accent`, một màu bù lệch
  ngẫu nhiên — đổi theo từng cảnh), vài cụm chấm halftone, hạt giấy nhẹ. Toàn bộ vẽ bằng CSS.
- Mỗi cảnh có MỘT "sticker" lớn (~70% cạnh ngắn), nghiêng nhẹ ngẫu nhiên cố định theo cảnh.
- Nhãn vàng `#FFE14D` chữ đen đậm, bóng khối cứng; câu nhấn in hoa đen, highlighter vàng quét sau.
- Giấy nhớ màu pastel (stat) hoặc con dấu viền đôi (badge) dán chồng lên góc sticker.
- Lời đọc chỉ là một dòng nhỏ trên dải giấy ở đáy — KHÔNG phải phụ đề to từng chữ.
- Năng lượng thủ công, hơi lệch: góc nghiêng, spring có nảy, không mượt kiểu corporate.

## Dữ liệu được dùng thế nào

- **image**
  - `.png` → coi là ảnh đã cắt nền. Không khung; viền sticker trắng bám theo silhouette bằng
    4 `drop-shadow` trắng + 1 bóng tối mềm.
  - `.jpg/.webp` → ảnh chụp viền trắng dày, bóng mềm, băng dính trên đỉnh.
  - `.mp4/.mov/.webm` → như ảnh chụp, video tắt tiếng, lặp, phát từ đầu cảnh.
  - `null` → mẩu báo xé mép: tên video làm măng-sét, số cảnh to, dòng chữ giả.
- **tag** — nhãn vàng ở góc trên-trái sticker, suốt cảnh, bật ra ~7 frame sau sticker.
- **punch** — hiện đúng `punch.atMs`, bật + quét highlighter, giữ tới hết cảnh.
  - Khung dọc: nằm dưới sticker. Khung vuông/ngang: nằm ở cột phải.
  - Cảnh không có punch thì sticker ra giữa vùng nội dung.
- **visual**
  - `stat` → giấy nhớ ở góc trên-phải sticker; `caption` viết nghiêng bên dưới.
  - `badge` → con dấu ở góc dưới-phải sticker.
- **captions** — câu đang đọc, một dòng nhỏ ở đáy trên `safe.bottom`. Câu rất dài mới xuống dòng.
- **title/subtitle/handle** — khi `showTitle`: tờ báo trắng với tít serif, highlighter vàng,
  handle trên thanh măng-sét. Tờ báo văng lên ở frame 60–70; cảnh đầu vào lúc đó.

## Chuyển động

- 8 kiểu vào: `rise`, `grow`, `slam`, `flip`, `peel`, `spiral`, `wobbleDrop`, `zoomThrough`.
  - Chọn theo `(index*3 + salt) % 8`, nên hai cảnh liền nhau không bao giờ trùng kiểu.
  - `salt` lấy từ tiêu đề, nên mỗi video mở đầu khác nhau.
- Sau khoảng 22 frame: nhún, lắc, thở liên tục, biên độ nhỏ, lệch pha theo cảnh.
- Hết cảnh: cả cụm trượt xuống, nghiêng, mờ trong 10 frame, chồng lên lúc cảnh sau đang vào.
  Không dùng TransitionSeries vì nó làm lệch timeline.
- Vệt màu nền cross-fade 15 frame giữa hai cảnh.

## Lỗi cần tránh

- Punch dùng `FONTS.sans` 900 + `fontStretch: condensed`. Avenir Next Condensed ghép dấu móc
  (Ừ, Ở) bị hở — đừng đổi lại.
- Không đưa `filter: blur` lên lớp toàn khung: vệt màu mềm nhờ `radial-gradient`, render nhanh.
- PNG không thật sự trong suốt sẽ thành hình chữ nhật viền trắng. Nếu cần cắt nền thì chạy
  công cụ tách nền trước; project chưa cài `rembg`.
- PNG cắt nền còn nhiều vùng trong suốt nên tag/visual được kéo vào trong khung.
- Mốc `punch.atMs` nằm ngoài cảnh bị kẹp lại vào trong cảnh. Punch sai giờ thì sửa dữ liệu,
  đừng sửa code.
- Mọi `interpolate` vào/ra là hai lời gọi riêng, để cảnh ngắn không sinh dãy mốc trùng nhau.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 3–6 cảnh, mỗi cảnh 1–3 câu đọc. Mỗi cảnh là một ý hoặc một mốc của câu chuyện.
- `tag`: nhãn ngắn ≤18 ký tự, dạng dữ kiện — năm ("1997"), con số ("50%"), địa danh, tên nhân vật, "Bước 2". Không viết cả câu.
- `punch`: 2–6 từ, BẮT BUỘC chép nguyên văn từ một câu đọc trong cảnh (đúng chính tả, dấu). Chọn cụm đắt nhất: nguyên nhân, con số, lời kết luận. Mỗi cảnh tối đa một punch.
- Ảnh: một chủ thể rõ ràng (người, đồ vật, tòa nhà, tài liệu) — chủ thể đơn trên nền trơn là tốt nhất; PNG đã tách nền càng đẹp. Tránh ảnh phong cảnh rộng không có tâm điểm.
- `visual`: dùng `stat` khi cảnh có một con số cần nhớ (text ngắn như "80%", caption giải thích); `badge` cho nhãn bước/phân loại. Không cảnh nào cũng dùng.
- Giọng: người giải thích tò mò, rõ ràng — đặt câu hỏi "vì sao", đưa bằng chứng, chốt ý. Câu ngắn, cụ thể, tránh sáo rỗng.
<!-- /ai-guide -->

## File

- `src/styles/vox/index.tsx` — bố cục theo tỉ lệ khung hình, vòng đời mỗi cảnh, trang tít, dòng lời đọc.
- `src/styles/vox/Paper.tsx` — nền giấy kẻ ô, vệt màu, halftone, hạt.
- `src/styles/vox/Hero.tsx` — sticker: ảnh cắt nền, ảnh chụp/video viền trắng, mẩu báo khi không có ảnh.
- `src/styles/vox/Bits.tsx` — Tag, Punch, VisualBit (giấy nhớ/con dấu), CaptionLine, TitlePage.
- `src/styles/vox/entrances.ts` — 8 kiểu vào + idle.
- `src/styles/vox/palette.ts` — màu giấy, highlighter, cặp màu theo cảnh.
