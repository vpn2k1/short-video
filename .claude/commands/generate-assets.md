---
description: Sinh ảnh nền và giọng đọc cho một video
---

Sinh asset cho video: $ARGUMENTS

## Ảnh

Nạp skill `image-generation`. Thứ tự ưu tiên:

1. `visual` code vẽ — miễn phí, tức thì, hợp con số và nhãn bước.
2. Canva connector — `generate-design` → `create-design-from-candidate` →
   `export-design` (KHÔNG truyền width/height) → curl về `public/images/<slug>/`.
   **Tải về nhìn từng ảnh**, Canva hay chèn chữ tiếng Anh dù prompt cấm.
3. Ảnh người dùng tự bỏ vào.

Sau đó `npm run images` để xác nhận ảnh nào gắn cảnh nào, không thiếu file.

## Giọng

Nạp skill `voice-generation`. `--voice linh` cho tiếng Việt miễn phí, hoặc
`--list-voices --live` để xem giọng thật trong tài khoản ElevenLabs.

Nhớ: gói free chặn mọi giọng tiếng Việt của ElevenLabs (402), thêm vào tài khoản cũng
không gỡ được.
