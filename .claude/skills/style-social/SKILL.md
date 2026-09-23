---
name: style-social
description: Phong cách "Bài đăng MXH" — thẻ bài đăng kiểu diễn đàn/mạng xã hội trên nền ảnh mờ tối: avatar, tích xác minh, chip cộng đồng "r/…", chữ hiện dần theo giọng đọc, thẻ cao dần, bút dạ quét câu twist, tim đỏ và lượt thích nhảy số. Dùng cho Reddit story, tâm sự ẩn danh, drama công sở, câu hỏi gây tranh luận, thú nhận, chuyện kể ngôi thứ nhất.
---

# Phong cách: Bài đăng MXH (social / Reddit story)

`style: "social"` trong props. Code: `src/styles/social/`.

## Nhận diện hình ảnh

- Nền: ảnh của cảnh toàn khung, blur tĩnh 16px × unit, phóng 1.12, phủ vignette tối. Cảnh video KHÔNG blur
  (đắt) — chỉ phóng 1.06 + lớp tối. Không có ảnh: gradient tối ám màu `accent`.
- Giữa khung: thẻ bài đăng trắng bo góc 44px × unit, bóng đổ sâu. 9:16: rộng 88% khung (≤ 960 × unit);
  16:9 / 1:1: rộng tới 1150 × unit trong vùng an toàn.
- Header: avatar tròn gradient `accent` với chữ "Ẩ", tên người đăng luôn là "Ẩn danh" (tên kênh chỉ hiện qua watermark
  trong Cài đặt), tích xác minh hoa thị vẽ bằng SVG, "· N giờ" xám (N suy từ `seeded(title)`), chip cộng đồng
  `r/<tag>` dưới tên, nút ⋯ bên phải.
- Thân bài: `FONTS.sans` 500, chữ đen #0f1419 trên trắng; câu đã qua mờ về xám #6e7a86.
- Footer: tim / bình luận / chia sẻ + đánh dấu, icon SVG chung chung (không logo thật), số kiểu Việt `1,2K`, `12K`, `1,5 Tr`.
- Không in hoa bằng CSS, không letter-spacing. Nhãn badge in hoa bằng `toLocaleUpperCase("vi")`.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | mọi caption có `startMs` trong cảnh nối thành MỘT đoạn thân bài; từ hiện dần (mờ + trượt lên 5 frame) theo vị trí ký tự trên 70% thời lượng câu; câu cũ mờ xám khi câu sau bắt đầu |
| `scenes` | mỗi cảnh = một thẻ ("một phần"). Không có cảnh → cả video là một thẻ |
| `title` | tiêu đề đậm của thẻ cảnh 1 (≤ 2 dòng) và tiêu đề lớn của thẻ intro; seed cho số tương tác và "N giờ" |
| `subtitle` | dòng xám dưới tiêu đề, chỉ trong intro |
| `tag` | chip cộng đồng: chữ thường (`vi`), khoảng trắng → `-`, thêm `r/` ("Tâm sự công sở" → `r/tâm-sự-công-sở`) |
| `punch` | tìm nguyên văn (không phân biệt hoa thường) trong thân bài: đúng `atMs` bút dạ vàng quét qua cụm, chữ đậm, nảy 1.09; tim footer chuyển đỏ + nảy. Không tìm thấy → chip trích dẫn đậm “…” viền trái `accent` mở ra dưới thân bài |
| `visual` stat | pill `accent` phía trên thẻ: tim trắng đập nhịp + `text` đậm + `caption` ("♥ 12K người đồng cảm") |
| `visual` badge | nhãn dán `accent` in hoa, nghiêng 3°, ghim mép trên bên phải thẻ ("CẬP NHẬT", "PHẦN 2") |
| `image` | nền cảnh; video tôn trọng `trimStartMs`, `volume`, `crop` (qua `ClipVideo`); ảnh tôn trọng `crop` (qua `CropBox`) |
| `accent` | avatar, chip cộng đồng, pill stat, badge, gradient nền khi không có ảnh |
| `captionPosition` | thẻ luôn canh giữa vùng an toàn; `bottom` (mặc định) hạ tâm nhóm xuống 53% vùng an toàn, `center` đúng 50% |
| `showTitle` | thẻ intro 70 frame trong `<Sequence durationInFrames={TITLE_FRAMES}>` |
| `background` | không dùng (nền lấy từ ảnh / `accent`) |

## Chuyển động

- Chiều cao thẻ tính bằng số: chữ được chia dòng bằng canvas trước, mỗi dòng mở ra trong 7 frame ngay trước
  chữ đầu dòng — thẻ cao dần mượt, luôn canh giữa, footer trôi xuống theo.
- Cỡ chữ thân bài chọn MỘT lần cho cả cảnh (54 → 30px × unit, bước 2) sao cho toàn bộ câu của cảnh + tiêu đề
  + chip + pill vừa vùng an toàn — chữ không nhảy cỡ giữa chừng và không bao giờ tràn.
- Đổi cảnh (timeline tuyệt đối): thẻ cũ bay lên + xoay −5° + mờ trong 13 frame (ease-in); thẻ mới trượt từ
  dưới lên bằng spring (damping 17), nghiêng 3° về 0. Nền ảnh→ảnh hoà 10 frame; có video thì cắt thẳng.
- Intro: pill "Bài đăng mới" với chuông lắc bật ra, thẻ rơi từ trên xuống kiểu thông báo (spring nảy), số
  tương tác đếm từ 0; 12 frame cuối bay lên, thẻ cảnh 1 trượt vào từ frame 62. Chữ cảnh 1 không hiện trước frame 70.
- Số tương tác đếm lên liên tục xuyên video (ease-out mỗi cảnh), xác định theo `title`.
- Pill stat bật ra 10 frame sau khi thẻ vào, tim đập mỗi 36 frame; badge bật 8 frame sau khi thẻ vào.

## Lỗi cần tránh

- Punch không chép nguyên văn → không có bút dạ trong câu, chỉ hiện chip trích dẫn (vẫn đẹp nhưng mất cú "quét").
- Cảnh quá dài (> ~260 ký tự ở 9:16, > ~180 ở 1:1): chữ co về 30px, khó đọc trên điện thoại. Chia thêm cảnh.
- `atMs` trước khi cụm punch được đọc: từ punch bị ép hiện sớm hơn lời đọc — đặt `atMs` trong khoảng câu chứa nó.
- Đừng dùng CSS `text-transform`/`letter-spacing` cho badge/chip; kiểm still với "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" khi đổi font.
- Không thêm blur động hay blur lên video nền — render chậm hẳn. Blur ảnh là tĩnh, đừng animate transform của lớp blur.
- Font thân bài phải trùng font đo canvas (`SOCIAL_FONT`, weight 500/700) — đổi một bên là chia dòng sai, chữ tràn.
- Stat quá dài (> 8 ký tự) + caption dài làm pill rộng hơn thẻ ở 1:1.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng ngôi thứ nhất, thú nhận/tâm sự như đăng ẩn danh lên diễn đàn: "Tôi…", "Mình…", văn nói tự nhiên, cụ thể (tuổi, nghề, số tiền, thời gian).
- `title` là tiêu đề bài đăng ≤ 60 ký tự, gây tò mò, ngôi thứ nhất ("Tôi đọc trộm nhóm chat của nhân viên"). `subtitle` ≤ 50 ký tự, gợi thêm ("và phát hiện biệt danh họ đặt cho mình").
- Câu đầu tiên của cảnh 1 là hook — dòng đầu bài đăng, nói ngay tình huống gây sốc; không chào hỏi, không "Hôm nay mình kể…".
- 3–5 cảnh; mỗi cảnh = một thẻ = một "phần" của câu chuyện (bối cảnh → biến cố → twist → kết). 2–3 câu mỗi cảnh, mỗi câu ≤ 70 ký tự, tổng ≤ 200 ký tự mỗi cảnh để thẻ vừa khung với chữ to.
- `tag`: tên cộng đồng ngắn ≤ 20 ký tự, chữ thường tự nhiên ("tâm sự công sở", "hôn nhân", "thú nhận", "hỏi thật"); có thể giữ cùng tag cho mọi cảnh hoặc null.
- `punch`: 2–5 từ đắt nhất (cú twist, biệt danh, con số), PHẢI chép nguyên văn từ một câu trong CHÍNH cảnh đó, `atMs` nằm trong thời gian câu chứa nó; tối đa một punch mỗi cảnh.
- `visual` stat dùng 1 lần, thường cảnh 1, như số tương tác/đồng cảm ("12K" | "người đồng cảm", "3.000" | "bình luận"); badge ≤ 12 ký tự cho nhãn phần ("CẬP NHẬT", "PHẦN 2", "KẾT"). Không cảnh nào cũng có.
- `image`: ảnh không khí gợi bối cảnh (văn phòng, phòng trọ, điện thoại, quán cà phê) — nó chỉ làm nền mờ nên không cần chi tiết; tránh ảnh có chữ. null vẫn ổn (nền gradient).
- Câu cuối cùng là câu hỏi mời bình luận, đứng riêng ("Nếu là bạn, bạn có tha thứ không?", "Tôi sai hay họ sai?").
<!-- /ai-guide -->

## File

- `src/styles/social/index.tsx` — dựng thẻ từng cảnh, bố cục canh giữa, vào/ra cảnh, pill stat, intro "Bài đăng mới"
- `src/styles/social/PostCard.tsx` — thẻ: header, tiêu đề, thân bài từng từ, bút dạ punch, chip trích dẫn, footer, badge; `postHeight`
- `src/styles/social/model.ts` — tách từ + frame xuất hiện, tìm punch, đo canvas & chia dòng, chọn cỡ chữ, số tương tác, `r/…`
- `src/styles/social/Backdrop.tsx` — nền ảnh blur tĩnh / video tối / gradient, hoà ảnh khi đổi cảnh
- `src/styles/social/Icons.tsx` — tim, bình luận, chia sẻ, đánh dấu, ⋯, chuông, tích xác minh
