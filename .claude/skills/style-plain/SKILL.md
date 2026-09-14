---
name: style-plain
description: Phong cách "Video gốc" — giữ nguyên ảnh/video người dùng tải lên, vừa khung, cắt cảnh gọn, không hiệu ứng. Dùng khi chỉnh sửa clip quay sẵn, vlog, ghép nhiều clip, hoặc tạo dự án trong trình chỉnh sửa (✂️ Edit video).
---

# Phong cách: Video gốc

`style: "plain"`. Code: `src/styles/plain/index.tsx`. Là phong cách mặc định của dự án tạo
bằng **✂️ Edit video** (`/editor.html#new`).

## Nhận diện hình ảnh

- Ảnh/video của cảnh vừa khung (`objectFit: contain`) trên nền đen — không cắt xén clip dọc/ngang.
- Không lớp tối, không Ken Burns, không chuyển cảnh: cảnh nối nhau bằng cú cắt gọn.
- Phụ đề trắng chữ đậm có bóng, không khối nền; **tắt đúng lúc hết câu** (các phong cách khác giữ
  câu tới khi câu sau bắt đầu).
- Title card chỉ hiện khi bật `showTitle` (mặc định tắt cho dự án tạo trong trình chỉnh sửa).

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` (video) | `ClipVideo` — `trimStartMs` cắt đầu clip, `volume` là tiếng gốc (dự án mới mặc định 100%) |
| `image` (ảnh) | ảnh tĩnh vừa khung |
| `captions` | phụ đề đơn giản, đáy hoặc giữa (`captionPosition`) |
| `tag`, `punch`, `visual` | **không dùng** — thêm chữ bằng lớp Văn bản trong trình chỉnh sửa |
| `texts`, `audioClips` | vẽ/phát như mọi phong cách (lớp chung của composition) |

## Lỗi cần tránh

- Tách âm thanh ra track riêng mà quên tắt tiếng gốc → tiếng bị đôi. Thao tác "Tách âm thanh" của
  trình chỉnh sửa tự đặt `volume` cảnh về 0.
- Clip ngắn hơn cảnh sẽ lặp lại hình (ClipVideo loop) nhưng track âm thanh tách ra thì không lặp —
  kéo độ dài cảnh khớp clip.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Chọn phong cách này khi người dùng tải video quay sẵn lên và muốn giữ nguyên hình, hoặc nội dung là vlog/clip thực tế.
- Mỗi file video/ảnh đính kèm là một cảnh; giữ thứ tự người dùng gửi.
- Phụ đề ngắn, bám lời nói trong clip hoặc mô tả ngắn cảnh; 1–2 câu mỗi cảnh là đủ.
- `tag`, `punch`, `visual` không hiện ở phong cách này — đặt null.
- Không bịa ảnh minh hoạ: cảnh nào không có file thì để image null.
<!-- /ai-guide -->

## File

- `src/styles/plain/index.tsx`
- Dùng lại: `src/scenes/ClipVideo.tsx`, `src/components/TitleCard.tsx`, `src/styles/shared.tsx`
