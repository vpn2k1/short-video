---
name: short-video
description: Video dọc 9:16 cho TikTok/Reels/Shorts — vùng an toàn, hook, nhịp cắt, độ dài phụ đề. Dùng khi tạo hoặc sửa video ngắn dưới 60 giây.
---

# Short Video (9:16)

1080×1920, 30fps. Composition `Short`.

## Vùng an toàn — kiểm bằng pixel

`SAFE` trong `src/constants.ts`. Nền tảng vẽ UI của họ đè lên các dải này:

| Dải | Px | Bị gì che |
|---|---|---|
| Đỉnh | 120 | avatar, tên nhạc |
| Đáy | 320 | caption tự động, nút like/share, thanh audio |
| Hai bên | 120 | cột nút bên phải |

Xếp chỗ theo chiều dọc, tính từ đáy: `0–320` nền tảng chiếm · `360–450` watermark ·
`500+` phụ đề. Hằng số `WATERMARK_BOTTOM` và `CAPTION_BOTTOM` giữ hai thứ không đè nhau —
đã từng đè, chỉ lộ ra khi nhìn ảnh render.

Kiểm bằng pixel, không tin CSS:

```bash
ffmpeg -v error -i still.png -vf "crop=1080:320:0:1600,format=gray" -f rawvideo - \
  | python3 -c "import sys;d=sys.stdin.buffer.read();print('YMAX',max(d))"
```

Dải đáy YMAX thấp (~20) = sạch. Có chữ trong đó là chữ sẽ bị nuốt.

## Độ dài phụ đề: đếm KÝ TỰ, không đếm từ

**42 ký tự mỗi dòng.** Skill `short-form-video` khuyến nghị "4-7 từ" — con số đó cho
tiếng Anh. Tiếng Việt mỗi âm tiết tính là một từ nên 7 từ chỉ bằng ~3 từ tiếng Anh,
dòng ngắn cụt và cắt giữa cụm ("…tưởng như bình" / "thường…"). 42 ký tự là chuẩn phụ đề
quốc tế, đúng cho mọi ngôn ngữ. Xem `scripts/group-captions.ts`.

## Nhịp và hook

Nạp skill `short-form-video` cho phần này (hook grammar, retention arc, pattern interrupt).
Tóm tắt điều quan trọng nhất: **hook phải là chữ trên màn hình ở frame 1**, không fade-up.

Ba điểm template hiện CHƯA đạt, cân nhắc khi sửa:

- Title card chiếm 2.33s đầu trước khi có phụ đề — chậm hơn mức skill khuyến nghị.
  Tắt bằng `showTitle: false` khi audio nói ngay từ giây 0.
- Chưa có loop (frame cuối không khớp frame đầu).
- Nhịp cắt đều đặn; skill nói khoảng cách đều đọc ra sự nhàm chán.

## Độ dài

Trần kỹ thuật: không có. Trần thực dụng: **quá 60 giây thì bố cục một-câu-giữa-màn-hình
bắt đầu đơn điệu** — lúc đó cần thêm cảnh và hình, không phải thêm câu.

Schema cho tối đa 60 câu (≈3 phút) làm bound an toàn, không phải mục tiêu.
