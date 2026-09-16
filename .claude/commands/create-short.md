---
description: Tạo video ngắn dọc 9:16 cho TikTok/Reels/Shorts
---

Tạo video ngắn: $ARGUMENTS

Phỏng theo `/create-short` của [remotion-superpowers](https://github.com/DojoCodingLabs/remotion-superpowers)
(MIT), ghép vào stack miễn phí của project này.

Nạp skill `video-director` → `short-video` → `script-writing`.

## Phase 1 — Chốt ý tưởng

Trình bày kế hoạch rồi mới làm:

```
Nền tảng:   TikTok / Reels / Shorts
Khổ:        1080×1920, 30fps
Độ dài:     15-60s (ngọt nhất 30s)

Cấu trúc:
  Hook (0-3s):   [câu mở — hỏi, tuyên bố mạnh, hoặc gây tò mò]
  Thân (3-Xs):   [2-4 cảnh, mỗi cảnh 1 ý]
  CTA (3-5s cuối): [lưu lại / theo dõi / bình luận]

Giọng:      [--voice linh (Việt, miễn phí) | ElevenLabs]
Nhạc nền:   [có/không]
Nguồn ảnh:  [pexels (mặc định) | gemini | canva | tự bỏ vào]
```

**Một ý một video.** Hai ý là chia đôi sự chú ý — làm thành hai video.

## Phase 2 — Kịch bản

`videos/<slug>/script.json`. Câu ngắn, tối đa 42 ký tự hiển thị một dòng, câu cuối là CTA.
Xem skill `script-writing`.

## Phase 3 — Ảnh

```bash
npm run fetch-images -- --name <slug> "truy vấn cảnh 1" "truy vấn cảnh 2"
```

Mặc định Pexels (ảnh chụp thật, free). Truy vấn viết **bằng tiếng Anh** — thư viện
Pexels đánh index tiếng Anh. Xem skill `image-generation` cho các nguồn khác.

**Nhìn từng ảnh sau khi tải.** Ảnh sáng quá thì chữ trắng không đọc được.

## Phase 4 — Giọng + render

```bash
npm run prompt-to-video -- --name <slug> --voice linh
```

Voiceover quyết định timing: độ dài audio thật thành `startMs`/`endMs` của phụ đề.

## Phase 5 — Soát

Chạy `/review-video` trước khi báo xong. Không nói "trông ổn" nếu chưa đo.

## Luật short-form

- Hook chết là video chết — 2 giây đầu quyết định.
- Phụ đề bắt buộc: 85% người xem tắt tiếng.
- Đổi hình mỗi 2-4 giây, đừng để đoạn giữa phẳng lặng.
- Chữ nằm trong hộp giữa 900×1400; chừa 320px đáy và 120px đỉnh.
- Kết bằng CTA, và cân nhắc làm frame cuối nối được vào frame đầu.
