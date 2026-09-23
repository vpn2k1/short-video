---
name: style-vinyl
description: Phong cách "Đĩa than" — đĩa than quay 33⅓ vòng/phút, nhãn đĩa là ảnh/clip của cảnh (không ảnh thì nhãn in màu có tên bài), quanh đĩa là vòng 64 cột phổ nhạc nhảy theo tần số đo từ chính file nhạc (bass ở đỉnh) cùng cung mảnh báo tiến độ bài, cần đọc đĩa tựa rãnh ngoài rung theo cú trống; lời hiện từng câu dưới đĩa — từ chưa hát mờ, từ đang hát to lên màu nhấn; câu nhấn bắn vòng sóng từ mép đĩa; mở đầu bằng bìa đĩa có tên bài, đĩa ló ra rồi trượt vào giữa. Dùng cho nhạc lofi, chill, R&B, nhạc xưa, playlist, giới thiệu bài mới, đoạn beat, trích một câu hát hay.
---

# Phong cách: Đĩa than (vinyl)

`style: "vinyl"` trong props. Code: `src/styles/vinyl/`, bộ máy nhạc chung `src/styles/music.tsx`.

## Đưa bài hát vào

Như Karaoke (xem skill `style-karaoke`, mục "Đưa bài hát vào"): **Làm hàng loạt → Từ file** chọn Phong cách = 💿 Đĩa
than, hoặc `npx tsx scripts/audio-to-video.ts bai-hat.mp3 --name x --style vinyl --title "Tên bài"`. Vòng phổ đo từ
`voiceoverTrack` → đoạn âm thanh dài nhất → nhạc nền; không có file nào thì cột nhảy theo lời (trong câu cao, ngoài
câu gợn nhỏ). Nhạc không lời cũng hợp: vài câu phụ đề ngắn hoặc để trống.

## Nhận diện hình ảnh

- **Nền** tối theo màu nhấn (accent xám → hồng 330°); có ảnh cảnh thì ảnh nhoè 60px, tối 0.32 làm nền; quầng màu
  nhấn sau đĩa sáng theo bass, phồng theo cú trống; bụi trắng bay chậm; vignette; hạt nhiễu.
- **Đĩa** bán kính 30% bề rộng (dọc) / 30% chiều cao (ngang): rãnh đĩa, viền, bóng đổ; **quay** 33⅓ vòng/phút; vệt
  bóng loáng đứng yên phía trên (chỉ đĩa quay); nhãn tròn 72% đường kính; lỗ giữa.
- **Vòng phổ**: 64 cột bo tròn toả ra từ mép đĩa, đối xứng trái/phải, bass ở đỉnh, treble ở đáy, gradient màu nhấn →
  màu nhấn lệch 55°. Cung trắng mảnh sát mép đĩa là tiến độ bài.
- **Cần đọc đĩa** góc trên phải, đầu kim tựa rãnh ngoài, rung nhẹ theo cú trống.
- **Thanh trên**: viên "● ĐANG PHÁT" (chấm màu nhấn nhấp nháy) + tên bài.
- Chữ: Be Vietnam Pro 800. Dọc: đĩa trên, lời canh giữa dưới đĩa. Ngang/vuông: đĩa bên trái, lời canh trái bên phải.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | Một câu mỗi lúc. Từ chưa hát mờ 26%, tới lượt thì nảy 0.8 → 1 trong 6 frame; từ đang hát to 1.07, màu nhấn, quầng, nhún theo cú trống. Câu mới trượt lên 8 frame. Chỉ vẽ hàng phụ đề đầu. |
| Nhạc dạo | Câu dứt mà câu sau còn xa hơn 2,5 giây → lời tắt; còn dưới 2,5 giây → hiện sẵn câu sau, mờ. Trước câu đầu hiện sẵn câu đầu. |
| `image` | Nhãn đĩa (quay cùng đĩa) và nền nhoè. `null` → nhãn in màu có tên bài ở nửa trên (tránh lỗ giữa). |
| `tag` | Viên viền màu nhấn "♪ ĐIỆP KHÚC" trên câu hát. |
| `punch` | Lúc `atMs`: vòng sóng màu phụ lan ra từ mép đĩa (22 frame); cụm từ đổi màu phụ khi hát tới. |
| `visual` | Viên số liệu viền màu nhấn ở góc trên phải. |
| `title` | Bìa đĩa màn mở đầu, nhãn đĩa khi không ảnh, thanh trên. `subtitle` không dùng. |

## Chuyển động

- Mở đầu (khi `showTitle`, hoặc suốt đoạn dạo đầu ≥ ~2,5 giây của bài hát đưa từ file): bìa đĩa vuông (ảnh cảnh đầu
  tiên có ảnh, tên bài lớn ở chân bìa) che bên trái, đĩa ló ra bên phải và đã quay; 20 frame cuối bìa rút
  sang trái, đĩa trượt vào giữa, cần đĩa + thanh trên + lời hiện lên.
- Liên tục: đĩa quay, vòng phổ, quầng sáng, bụi, chấm "ĐANG PHÁT".

## Lỗi cần tránh

- Câu hát dài hơn ~40 ký tự sẽ co nhỏ hoặc xuống hai hàng — tách câu theo nhịp hát.
- Ảnh cảnh bị cắt tròn trên nhãn đĩa: chọn ảnh có chủ thể ở giữa.
- Phụ đề là nội dung nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Viết như lời một bài lofi / chill / R&B: câu ngắn, thư thái (5–9 chữ, tối đa ~40 ký tự), hình ảnh đời thường về đêm, cà phê, mưa, thành phố.
- Mỗi cảnh một đoạn 3–4 câu; tiêu đề là tên bài; dòng phụ kiểu "Lofi · Side A" hoặc tên người hát.
- `tag`: "Side A", "Side B", "Điệp khúc", "Outro".
- `punch`: chép NGUYÊN VĂN 2–5 chữ đắt nhất của đoạn điệp khúc; 1–2 punch cả bài.
- Không dùng `visual` stat trừ khi có con số thật (năm, BPM).
- Ảnh: ảnh vuông kiểu bìa album, chủ thể ở GIỮA (ảnh bị cắt tròn trên nhãn đĩa), tông ấm, không khí lofi.
<!-- /ai-guide -->

## File

- `src/styles/vinyl/index.tsx` — bố cục theo tỉ lệ khung, lời từng từ, thanh "ĐANG PHÁT", viên số liệu, màn mở đầu.
- `src/styles/vinyl/parts.tsx` — nền, đĩa + nhãn, vòng phổ + cung tiến độ, vòng sóng, cần đọc đĩa, bìa đĩa.
- `src/styles/music.tsx` — nguồn nhạc, đo nhịp từ file, thời điểm từng từ.
