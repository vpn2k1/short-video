---
name: long-video
description: Video dài hơn 60 giây — chia chương, đổi bố cục, giữ nhịp. Dùng khi làm explainer, kể chuyện dài, hoặc video nhiều phần.
---

# Long Video

## Trạng thái thật

Project hiện có **một** composition `Short` (1080×1920). Chưa có composition riêng cho
video dài. Video dài nhất đã dựng và kiểm chứng: **75.8s**, render hết 84.1s.

Đừng hứa điều chưa có. Nếu người dùng cần định dạng khác (16:9, nhiều chương có
chuyển bố cục), đó là việc phải viết composition mới — nói rõ thay vì gán ép vào `Short`.

## Vì sao dài không chỉ là thêm câu

`Short` thiết kế cho short-form: một câu phụ đề, nền tĩnh, không chuyển bố cục. Kéo dài
nó ra 3 phút thì người xem thấy y hệt nhau suốt — đó là thất bại về nhịp, không phải về
kỹ thuật.

Video dài cần **thay đổi cấu trúc thị giác**, không phải thêm dòng:

| Cần | Làm bằng | Skill |
|---|---|---|
| Chia chương | nhiều cảnh, mỗi chương một hình nền | `storyboard` |
| Đổi bố cục giữa các phần | composition mới hoặc biến thể layout | `remotion-markup/multi-scene-video.md` |
| Chuyển cảnh có hiệu ứng | `TransitionSeries` — **cẩn thận, xem dưới** | `remotion-markup/transitions.md` |
| Hình minh hoạ từng ý | ảnh theo cảnh | `image-generation` |

## Bẫy: TransitionSeries và timeline

`<TransitionSeries>` **rút ngắn timeline** mỗi khi có transition. Toàn bộ phụ đề và
voiceover của project neo theo frame tuyệt đối lấy từ độ dài audio thật — dùng nó là
chữ lệch khỏi tiếng.

Muốn dùng thật thì phải tính bù: cộng lại `transition.getDurationInFrames({fps})` vào
mọi mốc caption sau điểm chuyển. Hoặc giữ cách hiện tại — cross-fade bằng `opacity`,
timeline không đổi một frame.

## Chi phí render

27 frame/s ở 1080×1920. Tuyến tính theo số frame:

| Độ dài video | Thời gian render |
|---|---|
| 30s | ~33s |
| 1 phút | ~66s |
| 3 phút | ~3.3 phút |
