---
name: style-lyrics
description: Phong cách "Lời nhạc cuộn" — lời bài hát đồng bộ kiểu app nghe nhạc: nền là ảnh/clip của cảnh phóng to nhoè đậm màu (không ảnh thì các mảng màu trôi, phồng theo bass đo từ file nhạc), trình phát nhỏ ở trên (ảnh bìa, tên bài, handle, thanh tiến độ, cột nhạc), lời xếp thành danh sách chữ lớn canh trái cuộn lên theo câu đang hát — câu đang hát sáng dần từng từ, câu khác mờ và nhoè theo khoảng cách, đoạn nhạc dạo dài hiện "• • •" sáng dần; khung dọc mở đầu bằng màn "Đang phát" cỡ lớn rồi ảnh bìa thu về góc. Dùng cho lyric video, lời bài hát, cover, ballad, nhạc chill, thơ phổ nhạc, chia sẻ đoạn nhạc hay.
---

# Phong cách: Lời nhạc cuộn (lyrics)

`style: "lyrics"` trong props. Code: `src/styles/lyrics/`, bộ máy nhạc chung `src/styles/music.tsx`.

## Đưa bài hát vào

Như Karaoke (xem skill `style-karaoke`, mục "Đưa bài hát vào"): **Làm hàng loạt → Từ file** chọn Phong cách = 🎵 Lời
nhạc cuộn, hoặc `npx tsx scripts/audio-to-video.ts bai-hat.mp3 --name x --style lyrics --title "Tên bài"`. Nhịp nền đo
từ `voiceoverTrack` → đoạn âm thanh dài nhất → nhạc nền; không có file nào thì suy từ lời.

## Nhận diện hình ảnh

- **Nền**: ảnh/clip của cảnh phóng 1.6×, nhoè 70px, bão hoà 1.8, tối 0.62, xoay rất chậm ±8°, phồng theo bass. Không
  ảnh → bốn mảng màu (suy từ màu nhấn, accent xám → tím 265°) trôi theo quỹ đạo chậm. Hoà cảnh 20 frame. Lớp tối nhẹ
  hai đầu, hạt nhiễu.
- **Chữ lời**: Be Vietnam Pro 800 trắng, 70px dọc / 58px ngang / 50px vuông, line-height 1.22, canh trái. Câu tự ngắt
  dòng bằng số đo canvas (mỗi dòng nowrap) để chiều cao hàng luôn khớp danh sách.
- **Danh sách lời** trong vùng lời có mép trên/dưới mờ dần; hàng đang hát đứng ở ~26% vùng lời (khung dọc).
- **Trình phát nhỏ** (dọc): ảnh bìa 124px bo 16px, tên bài đậm + handle mờ, cột nhạc 3 cột ở góc phải, thanh tiến độ
  với thời gian đã phát / "-còn lại". Khung ngang/vuông: ảnh bìa lớn bên trái, tên + tiến độ dưới ảnh, lời bên phải.
- **Màn "Đang phát"** (chỉ khung dọc, trong đoạn dạo đầu): ảnh bìa lớn giữa khung, tên bài 56px, handle, tiến độ,
  hàng nút ⏮ ⏸ ⏭; 20 frame cuối ảnh bìa bay về góc trên, danh sách lời hiện lên.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | Mỗi câu một hàng. Câu vào thì cả danh sách cuộn (easeOut ~0,56 giây), hàng bên dưới cuộn trễ thêm 45 ms mỗi hàng. Câu đang hát: từ chưa tới mờ 40%, hát tới đâu sáng tới đó và nhích lên; câu khác mờ 30%, thu 95,5%, nhoè theo khoảng cách. Chỉ vẽ hàng phụ đề đầu. |
| Nhạc dạo | Khoảng lặng ≥ 4 giây giữa hai câu → hàng "• • •": thành hàng đang hát 0,6 giây sau khi câu trước dứt, ba chấm sáng dần theo thời gian còn lại, thở nhẹ và nảy theo cú trống. |
| `image` | Nền nhoè và ảnh bìa trong trình phát (đổi theo cảnh). `null` → mảng màu; ảnh bìa là mảng màu + chữ viết tắt của handle. |
| `tag` | Nhãn đoạn chữ in hoa nhỏ màu nhấn, chèn ngay trên câu đầu của cảnh ("ĐIỆP KHÚC"). |
| `punch` | Cụm từ đổi màu nhấn sáng + quầng khi hát tới. |
| `visual` | Viên số liệu góc phải, ngay trên vùng lời. |
| `title`/`handle` | Tên bài và người hát trong trình phát. `subtitle` không dùng. |

## Lỗi cần tránh

- Câu dài hơn ~45 ký tự chiếm 2–3 dòng làm danh sách thưa — tách câu theo nhịp hát.
- Khoảng lặng giữa hai câu dưới 4 giây không có "• • •" — câu trước giữ sáng tới khi câu sau vào.
- Phụ đề là nội dung nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.
- Luôn render still kiểm "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" ở cả 9:16 và 16:9 khi sửa cỡ chữ.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Viết như LỜI BÀI HÁT hoặc thơ phổ nhạc: câu ngắn theo nhịp (6–10 chữ, tối đa ~45 ký tự), giàu hình ảnh, có vần nhẹ, cảm xúc tăng dần tới điệp khúc.
- Mỗi cảnh là một đoạn nhạc 4 câu; tiêu đề là tên bài, `handle`/dòng phụ là tên người hát.
- `tag`: tên đoạn — "Phiên khúc", "Điệp khúc", "Cầu nối", "Kết". Chỉ đặt ở cảnh mở một đoạn mới.
- `punch`: chép NGUYÊN VĂN 2–5 chữ là câu móc của điệp khúc; 1–2 punch cả bài.
- Không dùng `visual` stat trừ khi có con số thật (năm phát hành, lượt nghe).
- Ảnh: ảnh kiểu bìa album — một chủ thể rõ, màu đậm, ánh sáng có tâm trạng (ảnh sẽ bị nhoè làm nền và thu nhỏ làm ảnh bìa).
<!-- /ai-guide -->

## File

- `src/styles/lyrics/index.tsx` — bố cục theo tỉ lệ khung, hàng lời (sáng từng từ), hàng "• • •", trình phát nhỏ/lớn, viên số liệu.
- `src/styles/lyrics/layout.ts` — màu, tự ngắt dòng (`wrapWords`), danh sách hàng (`buildRows`), nhịp cuộn (`scrollAt`).
- `src/styles/lyrics/parts.tsx` — nền ảnh bìa nhoè / mảng màu, ô ảnh bìa, cột nhạc, thanh tiến độ, nút điều khiển.
- `src/styles/music.tsx` — nguồn nhạc, đo nhịp từ file, thời điểm từng từ.
