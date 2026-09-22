---
name: style-podcast
description: Phong cách "Podcast" — clip podcast / audiogram trong phòng thu tối ấm: thẻ tập bo góc có micro, tên chương trình (handle), "TẬP n", chấm đỏ "ĐANG PHÁT", ảnh/clip khách mời trong khung lớn, hàng sóng âm nhảy theo lời đọc (cao khi đang nói, êm ở khoảng lặng), thanh tiến độ có thời gian đã phát; thẻ trích dẫn dấu ngoặc kép lớn, mỗi lúc một câu, từ sáng dần theo nhịp đọc; tag là bảng tên khách mời/chương, câu nhấn tô bút dạ + nhãn "Câu đáng nhớ", số liệu là thẻ số lớn, mở đầu bằng ô bìa podcast có nút "Nghe ngay". Dùng cho clip podcast, phỏng vấn, talkshow, câu nói đáng nhớ, bình luận/quan điểm, nội dung giọng nói là chính.
---

# Phong cách: Podcast (podcast)

`style: "podcast"` trong props. Code: `src/styles/podcast/`.

## Nhận diện hình ảnh

- Nền phòng thu tối ấm `#140e0b`: gradient nâu ấm từ trên xuống, quầng màu nhấn mờ sau khung ảnh (sáng thêm khi
  đang nói), vệt đèn chéo rất nhẹ, vignette, hạt nhiễu `Grain`.
- **Thẻ tập** bo góc 48px, nền kem trong suốt 4–8%, viền mảnh, bóng sâu. Trong thẻ từ trên xuống:
  đầu thẻ (ô micro gradient màu nhấn · handle đậm · "TẬP n · PODCAST" · viên "● ĐANG PHÁT" đỏ, chấm nhấp nháy) →
  khung ảnh bo 34px → hàng sóng âm → thanh tiến độ "0:07 ━━━●──── 0:15".
- **Thẻ trích dẫn**: dấu “ Playfair Display 900 màu nhấn trồi khỏi mép trên, lời trích Be Vietnam Pro 700 cỡ lớn,
  gạch màu nhấn + tên người nói ở chân thẻ.
- Chữ: **Be Vietnam Pro** (giao diện + lời trích) và **Playfair Display** (dấu ngoặc kép) — đều đóng gói, đủ dấu,
  nạp bằng `ensureFonts`. In hoa bằng `toLocaleUpperCase("vi")`, line-height 1.36 cho chữ hoa có dấu chồng.
- Dọc (cao/rộng ≥ 1.2): thẻ tập ở trên, thẻ trích dẫn ở dưới, cả hai nằm trên vùng an toàn đáy.
  Ngang/vuông: thẻ tập bên trái (vuông thì hẹp lại), thẻ trích dẫn cao bằng thẻ tập bên phải; khi hẹp đầu thẻ rút
  gọn còn "TẬP n" + "● LIVE", nhãn còn "Đáng nhớ".
- Số tập: lấy "Tập 12"/"Ep 12"/"#12" nếu tiêu đề hoặc dòng phụ có ghi; không thì suy cố định từ tiêu đề.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Ảnh/clip trong khung bo góc, phóng chậm 1.03 → 1.10 suốt cảnh, tối dần ở đáy. Video phát trong khung, tắt tiếng, lặp. Sang cảnh ảnh mới hoà đè lên ảnh cũ 12 frame. `null` → ảnh đại diện tròn màu nhấn có **chữ viết tắt từ handle** ("@kienthucbien" → "KI"), ba vòng sóng lan ra to hơn khi đang nói. |
| `captions` | Mỗi lúc **một câu** trong thẻ trích dẫn; chữ co theo độ dài để vừa thẻ (tối thiểu 30px). Thời điểm từng từ ước lượng theo độ dài từ trên thời lượng câu: từ chưa đọc mờ, đọc tới thì sáng lên. Câu mới trượt lên + hiện dần 9 frame. Trước câu đầu tiên (hoặc khi không có câu nào) thẻ hiện tiêu đề màu mờ. |
| Sóng âm | Không đọc audio: mức "đang nói" suy từ caption — trong câu cao và nảy ở mỗi từ mới, ngoài câu tắt dần về gợn nhỏ. Cột đã phát (theo tiến độ video) màu nhấn, cột chưa phát kem mờ. |
| `tag` | Bảng tên ở góc dưới trái khung ảnh, vạch màu nhấn bên trái. Dạng "Nhãn: Tên" ("Khách mời: BS. Minh Anh") tách thành nhãn in hoa nhỏ + tên lớn, và tên đó thành chữ ký dưới lời trích; không có dấu ":" ("Phần 2") thì một dòng. Không có tag → chữ ký là handle. |
| `punch` | Lúc `atMs`: một vệt bút dạ màu nhấn quét liền qua cụm nhấn (chữ trắng), thẻ trích dẫn nảy lên 3.5%, viền + quầng màu nhấn suốt phần còn lại của cảnh, nhãn "💬 Câu đáng nhớ" bật ở góc trên phải thẻ. Cụm không có nguyên văn trong câu đang hiện → nhãn ghi "Câu đáng nhớ: <cụm>". |
| `visual` stat | Thẻ số tối ở góc trên phải khung ảnh: số lớn màu nhấn + chú thích, bật vào kiểu nảy ở frame 8–22 của cảnh. `badge` → viên nhãn màu nhấn in hoa + chú thích nhỏ. |
| `title`/`subtitle`/`handle` | Khi `showTitle`: ô bìa podcast vuông (ảnh cảnh đầu tiên có ảnh, ám màu nhấn; không có thì gradient) với "PODCAST · TẬP n", vòng sóng đồng tâm, tiêu đề lớn, dòng phụ, handle; dưới bìa nút "▶ Nghe ngay" + hàng sóng nhỏ. `handle` còn là tên chương trình ở đầu thẻ. |

## Chuyển động

- Mở đầu (70 frame): bìa phóng vào + trượt lên 18 frame, nút "Nghe ngay" bật ở frame 16–28, frame 44–54 nút bị
  "bấm" lún rồi nảy và hàng sóng nhỏ bắt đầu chạy; 12 frame cuối bìa phóng nhẹ ra và mờ để lộ thẻ tập.
- Không `showTitle`: toàn bộ thẻ trượt nhẹ lên + hiện dần 12 frame đầu.
- Liên tục: sóng âm, chấm đỏ nhấp nháy ~1 giây, nút kéo trên thanh tiến độ chạy theo frame, ảnh phóng chậm,
  quầng sau khung ảnh sáng theo mức nói.
- Bảng tên trượt từ trái vào frame 4–18 của cảnh; thẻ số nảy vào frame 8–22.

## Lỗi cần tránh

- Câu phụ đề dài hơn ~110 ký tự làm chữ co nhỏ (nhất là 1:1) — tách thành câu ngắn, mỗi câu một ý.
- `tag` dạng "Nhãn: Tên" — phần nhãn tối đa ~18 ký tự; tên quá dài bị cắt "…".
- `punch` phải là nguyên văn trong một câu của cảnh, không thì chỉ còn nhãn chứ không có vệt bút dạ.
- `visual.text` tối đa ~6 ký tự để số to ("70%", "3 giờ", "1/3").
- Handle dài hơn ~16 ký tự bị cắt "…" ở 1:1.
- Phụ đề là nội dung thẻ trích dẫn nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.
- Luôn render still kiểm "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" ở cả 9:16 và 16:9 khi sửa cỡ chữ/line-height.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Viết như một đoạn cắt từ podcast/phỏng vấn: giọng nói tự nhiên, ngôi thứ nhất ("Tôi từng…", "Điều mình học được là…"), có quan điểm rõ.
- Tiêu đề là câu hỏi hoặc chủ đề của tập ("Vì sao người trẻ hay kiệt sức?"); dòng phụ ghi khách mời hoặc số tập — "Tập 12 · cùng chuyên gia tâm lý".
- Mỗi cảnh 1–3 câu, mỗi câu dưới 90 ký tự, mỗi câu là một ý trọn vẹn đọc được như một lời trích.
- `tag`: bảng tên người nói hoặc chương — "Khách mời: <tên ngắn>", "Host: <tên>", "Phần 2", "Câu hỏi khán giả". Cảnh đầu nên giới thiệu khách mời.
- `punch`: chép NGUYÊN VĂN 2–6 từ đắt nhất trong một câu của cảnh — câu nói đáng trích dẫn nhất ("đừng so sánh bản thân"); 1–3 cảnh có punch là đủ.
- `visual` stat: một con số làm dẫn chứng cho lời nói — "70%", "3 năm", "1/3" — kèm caption ngắn.
- Ảnh: chân dung người nói nhìn nghiêng/nói chuyện, micro phòng thu, bối cảnh talkshow; cảnh không ảnh sẽ thành ảnh đại diện chữ viết tắt + sóng âm (hợp với đoạn chỉ có giọng).
- Cảnh cuối: câu chốt quan điểm + lời mời nghe tập đầy đủ / theo dõi kênh.
<!-- /ai-guide -->

## File

- `src/styles/podcast/index.tsx` — ghép lớp, thẻ trích dẫn (sáng từng từ, bút dạ câu nhấn, nhãn "Câu đáng nhớ", chữ ký).
- `src/styles/podcast/parts.tsx` — nền phòng thu, biểu tượng, đầu thẻ, khung ảnh + ảnh đại diện giữ chỗ, sóng âm, thanh tiến độ, bảng tên, thẻ số.
- `src/styles/podcast/TitleIntro.tsx` — ô bìa podcast + nút "Nghe ngay".
- `src/styles/podcast/podcast.ts` — màu, font, tách từ + thời điểm từ, mức đang nói, chiều cao cột sóng, bố cục theo tỉ lệ khung.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
