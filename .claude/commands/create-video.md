---
description: Pipeline dựng video đầy đủ — ý tưởng, tiếng, hình, dựng, render
---

Dựng video: $ARGUMENTS

Phỏng theo `/create-video` của [remotion-superpowers](https://github.com/DojoCodingLabs/remotion-superpowers)
(MIT). Sáu pha, **tiếng trước hình** — vì tiếng quyết định timing.

Nạp `video-director` trước; chọn `short-video` hay `long-video` theo độ dài.

## 1. Ý tưởng

Chốt: độ dài · khổ hình · số cảnh · có voiceover không · nhạc nền · nguồn ảnh.
Trình bày ra rồi mới làm, đừng đoán.

## 2. Tiếng (làm TRƯỚC)

| Cần | Lệnh |
|---|---|
| Voiceover từ chữ | `npm run prompt-to-video -- --name <slug> --voice <tên>` |
| Từ file thu sẵn | `npm run audio-to-video -- <file> --name <slug>` |
| Nhạc nền + sfx | có sẵn `public/music/`, `public/sfx/` (`npm run audio-assets` để sinh lại) |

Không có model sinh nhạc — `placeholder.mp3` là hợp âm sine tổng hợp để test phần trộn,
**thay bằng nhạc thật trước khi đăng**.

## 3. Hình

```bash
npm run fetch-images -- --name <slug> "query 1" "query 2"
npm run images                              # kiểm ảnh nào gắn cảnh nào
```

Ưu tiên: **pexels** → gemini. Canva gọi qua MCP trong hội thoại. Cảnh không cần ảnh thì
dùng `visual` (code vẽ, miễn phí). Xem skill `storyboard`.

## 4. Dựng

Ba composition dùng chung một schema:

| Composition | Thêm gì |
|---|---|
| `Short` | bản gốc |
| `LongVideo` | nhãn "CHƯƠNG N" đầu mỗi cảnh |
| `Explainer` | dãy chấm chỉ bước |

Sửa component thì đọc skill `remotion` trước — **đừng viết API Remotion từ trí nhớ**.

## 5. Xem trước

```bash
npm run dev
npx remotion studio --props=videos/<slug>/props.json
```

Studio ghi ngược thay đổi vào code, nên chỉnh tinh (màu, chữ, vị trí) làm ở đó nhanh hơn prompt.

## 6. Render

```bash
npm run render-all
```

27 frame/s ở 1080×1920 — ước lượng thời gian trước khi chạy. Xong thì chạy `/review-video`.
