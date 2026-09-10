---
name: video-generation
description: Đưa video/b-roll vào cảnh. Dùng khi người dùng muốn clip động thay vì ảnh tĩnh, hoặc hỏi về sinh video bằng AI.
---

# Video Generation

## Trạng thái thật: CHƯA CÓ

Project chưa dùng video clip nào trong cảnh, và phiên này không có công cụ sinh video AI.
Nói thẳng điều đó, đừng vòng vo.

Hiện `src/scenes/Scenes.tsx` chỉ render `<Img>`. Ảnh tĩnh có Ken Burns (phóng chậm 8%)
để đỡ chết cứng — với nhiều nội dung thế là đủ.

## Ba đường nếu người dùng thật sự cần

| Đường | Cần gì | Đánh giá |
|---|---|---|
| **Người dùng tự quay/tải clip** | file vào `public/videos/` | Rẻ nhất, chất lượng cao nhất, làm được ngay |
| **Stock footage (Pexels)** | API key free | Có b-roll thật, không tốn tiền |
| **Sinh video AI** | Replicate / KIE / RunComfy — đều trả phí | Đắt, chất lượng khó đoán |

## Làm gì khi có file video

Đổi `<Img>` sang `<OffthreadVideo>` (render) trong `Scenes.tsx`. Đọc
`remotion-markup/embedding-videos.md` trước — **đừng viết từ trí nhớ**, API video của
Remotion có nhiều lựa chọn (`<Video>`, `<OffthreadVideo>`, `@remotion/media`) với đánh
đổi khác nhau về tốc độ và độ chính xác frame.

Vài điểm cần tính trước:

- Clip phải phủ đủ độ dài cảnh, hoặc phải loop / trim (`trimBefore`, `trimAfter`).
- Video có tiếng riêng — nhớ tắt hoặc trộn, nếu không nó đè lên voiceover.
- Render chậm hơn hẳn so với ảnh tĩnh. Đo lại throughput trước khi hứa thời gian.

## Đừng làm

Đừng bịa URL video. Đừng cài skill sinh video AI khi chưa có key — cài rồi không chạy
được chỉ làm nhiễu.
