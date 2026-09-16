---
name: style-caption
description: Phong cách "Phụ đề nổi bật" — ảnh nền toàn khung, phụ đề to từng câu kiểu TikTok. Dùng cho mẹo nhanh, lời khuyên, video bán hàng ngắn, nội dung đọc thẳng.
---

# Phong cách: Phụ đề nổi bật

Phong cách gốc của project. `style: "caption"` trong props. Code: `src/styles/caption/index.tsx`
(ghép từ `src/scenes/*`, `src/captions/Captions.tsx`, `src/components/TitleCard.tsx`).

## Nhận diện hình ảnh

- Ảnh (hoặc video) của cảnh phủ kín khung, Ken Burns chậm, cross-fade 0.5s giữa cảnh.
- Lớp tối (Scrim) phủ trên ảnh để chữ trắng luôn đọc được.
- Phụ đề: khối bo góc màu `accent`, chữ trắng đậm, bật lò xo mỗi câu.
- Nền dự phòng khi không có ảnh: màu `background` + hai vệt sáng trôi chậm.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | nền toàn khung; video thì tắt tiếng, lặp |
| `visual` | badge (nhãn bước) hoặc stat (con số lớn) ở phần trên màn hình |
| `tag`, `punch` | **không dùng** — phong cách này để phụ đề làm chính |
| `captions` | mỗi lúc một câu, đáy hoặc giữa màn hình (`captionPosition`) |
| `title` | title card 70 frame đầu, chữ bật từng từ |

## Chuyển động

Lò xo `damping 12–14`, không overshoot quá tay. Không có hiệu ứng chuyển cảnh ngoài cross-fade.

## Lỗi cần tránh

- Câu dài hơn 42 ký tự bị xuống 3 dòng, che ảnh — xem skill `short-video`.
- Ảnh sáng mà thiếu Scrim → chữ trắng chìm.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 2–4 cảnh, mỗi cảnh 2–3 câu; tổng 5–8 câu cho 15–30 giây.
- Mỗi câu là một ý trọn vẹn, ngắn (tối đa ~42 ký tự) vì phụ đề là thứ người xem đọc chính.
- Câu đầu là hook gây tò mò, câu cuối là call-to-action.
- Mỗi cảnh nên có một ảnh nền hợp nội dung nếu danh sách ảnh có.
- Dùng `visual` khi cảnh có con số hoặc bước đáng làm nổi bật.
- `tag` và `punch` không hiện ở phong cách này — đặt null.
<!-- /ai-guide -->

## File

- `src/styles/caption/index.tsx`
- Thành phần dùng lại: `src/scenes/Background.tsx`, `src/scenes/Scenes.tsx`, `src/scenes/SceneVisual.tsx`,
  `src/captions/Captions.tsx`, `src/components/TitleCard.tsx`, `src/components/ProgressBar.tsx`
