---
name: style-karaoke
description: Phong cách "Karaoke" — màn hình băng karaoke cho bài hát có lời: ảnh/clip của cảnh làm nền MV (không ảnh thì sân khấu tối có ba luồng đèn quét và đốm bokeh nhún theo bass đo từ chính file nhạc), hai ô lời ở một phần ba dưới — câu chẵn ô trên canh trái, câu lẻ ô dưới canh phải; chữ trắng viền đậm, phần đã hát đổi sang màu nhấn chạy từ trái sang phải theo tiếng hát; 4 chấm đếm ngược trước câu đầu và sau đoạn nhạc dạo; nhãn đoạn "♪ ĐIỆP KHÚC", huy hiệu micro "KARAOKE", màn tên bài "♪ KARAOKE ♪" trong đoạn dạo đầu. Dùng cho video bài hát có lời, cover, hát karaoke, nhạc thiếu nhi, đoạn điệp khúc cần người xem hát theo.
---

# Phong cách: Karaoke (karaoke)

`style: "karaoke"` trong props. Code: `src/styles/karaoke/`, bộ máy nhạc chung `src/styles/music.tsx`.

## Đưa bài hát vào

Phong cách nhạc đọc nhịp từ **file nhạc của video** (`musicSourceOf` trong `src/styles/music.tsx`): bản thu cả bài
(`voiceoverTrack`) → đoạn âm thanh dài nhất thêm trong trình chỉnh sửa (trừ `sfx/`) → nhạc nền. Không có file nào thì
nhịp suy từ lời (trong câu nảy ở mỗi từ).

- Web: **Làm hàng loạt → Từ file**, thả file mp3/mp4 bài hát, chọn Phong cách = 🎤 Karaoke. Whisper phiên âm lời,
  bài hát thành `voiceoverTrack`, mỗi câu hát một dòng phụ đề. Sửa lời sai trong trình chỉnh sửa.
- Dòng lệnh: `npx tsx scripts/audio-to-video.ts bai-hat.mp3 --name ten-bai --style karaoke --title "Tên bài"`.
- Whisper nghe lời hát kém hơn lời nói (nhạc nền to, luyến láy) — luôn soát lời sau khi phiên âm.

## Nhận diện hình ảnh

- **Nền MV**: ảnh/clip cảnh phủ kín, sáng 0.8, phóng chậm 1.03 → 1.10 suốt cảnh, nhún thêm theo cú trống; tối dần
  từ giữa khung xuống đáy cho lời dễ đọc. Không ảnh → **sân khấu**: gradient tối theo màu nhấn, ba luồng đèn
  hình nón lắc chậm, 16 đốm bokeh trôi lên, sàn hắt sáng — độ sáng đèn/đốm theo bass. Hoà cảnh 12 frame.
- **Chữ lời**: Be Vietnam Pro 800, trắng, viền đậm màu mực (16 lớp bóng), line-height 1.34. Phần đã hát là màu
  nhấn bão hoà (accent xám/đen → xanh karaoke 205°), lộ dần từ trái sang phải trong từng từ.
- **Hai ô lời** ở một phần ba dưới (trên vùng an toàn đáy): ô trên canh trái, ô dưới canh phải. Mỗi ô cao đủ hai
  hàng ở cỡ gốc (76px dọc, 68px ngang); câu ưu tiên nằm một hàng (co tới 72%), dài hơn thì xuống hai hàng chia đều.
- **Thanh trên**: viên micro + chữ "KARAOKE" góc trái, 5 cột nhạc nhỏ theo phổ góc phải.
- **Màn tên bài**: "♪ KARAOKE ♪" màu nhấn, tên bài cỡ lớn viền đậm + quầng màu nhấn, dòng phụ.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | Mỗi câu một ô. Đang hát câu a thì ô kia hiện sẵn câu a+1; câu a+1 vào thì ô của câu a đổi sang a+2. Thời điểm từng từ ước lượng theo độ dài từ, từ cuối câu ngân dài gấp rưỡi. Chỉ vẽ hàng phụ đề đầu (hàng dịch song ngữ bỏ qua). |
| Nhạc dạo | Trước câu đầu và khi câu sau cách câu trước hơn 4 giây: cặp câu hiện trước 2,5 giây kèm **4 chấm đếm ngược** tắt dần từ trái sang phải, chấm cuối tắt đúng lúc câu bắt đầu. Giữa đoạn dạo dài thì dọn màn. |
| `image` | Nền MV của cảnh. `null` → sân khấu đèn. |
| `tag` | "♪ ĐIỆP KHÚC" — viên màu nhấn ở hàng đầu khối lời, cạnh chấm đếm ngược. |
| `punch` | Cụm từ nảy lên (spring) đúng lúc hát tới, đổi màu nhấn sáng hơn và có quầng. |
| `visual` | Viên số liệu ở góc trên phải ("2024 phát hành"). |
| `title`/`subtitle` | Màn tên bài: khi `showTitle`, hoặc suốt đoạn dạo đầu nếu câu hát đầu cách giây 0 ít nhất ~4,5 giây (bài hát đưa từ file). |

## Lỗi cần tránh

- Câu hát dài hơn ~40 ký tự sẽ xuống hai hàng hoặc co nhỏ — tách câu theo nhịp hát, mỗi câu một ý.
- Timing từng từ là ước lượng: câu có một từ ngân rất dài giữa câu sẽ lệch — tách câu ở chỗ ngân.
- Phụ đề là nội dung nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.
- Luôn render still kiểm "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" khi sửa cỡ chữ/viền.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Viết như LỜI BÀI HÁT, không phải bài đọc: câu ngắn theo nhịp hát (6–10 chữ, tối đa ~40 ký tự), có vần ở cuối câu chẵn, dễ hát theo.
- Mỗi cảnh là một đoạn nhạc 4 câu: [Phiên khúc] kể chuyện, [Điệp khúc] là câu chốt dễ nhớ — điệp khúc có thể lặp lại ở cuối.
- `tag`: tên đoạn nhạc — "Phiên khúc", "Điệp khúc", "Phiên khúc 2", "Cầu nối", "Kết".
- Tiêu đề là tên bài hát; dòng phụ ghi "Nhạc & lời: <tên>" hoặc tên người hát.
- `punch`: chép NGUYÊN VĂN 2–5 chữ là câu móc của điệp khúc ("hứa sẽ bên nhau"); chỉ 1–2 punch cả bài, đặt ở điệp khúc.
- Không dùng `visual` stat trừ khi có con số thật đáng nói (năm phát hành).
- Ảnh: khung cảnh MV hợp tâm trạng bài — con đường, bầu trời, sân khấu, cặp đôi, thành phố lúc hoàng hôn; chừa khoảng tối ở dưới cho lời.
<!-- /ai-guide -->

## File

- `src/styles/karaoke/index.tsx` — ghép lớp, một câu hai lớp chữ (trắng + màu nhấn lộ dần), chấm đếm ngược, hai ô lời.
- `src/styles/karaoke/karaoke.ts` — màu, viền chữ, cỡ chữ vừa ô, luật hai ô lời (`boardAt`).
- `src/styles/karaoke/parts.tsx` — nền MV / sân khấu đèn, thanh micro, cột nhạc nhỏ, nhãn đoạn, viên số liệu, màn tên bài.
- `src/styles/music.tsx` — nguồn nhạc, đo nhịp từ file (dùng chung ba phong cách nhạc), thời điểm từng từ.
