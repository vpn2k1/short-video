---
description: Tạo video dài hơn 60 giây, nhiều chương
---

Tạo video dài cho: $ARGUMENTS

Nạp skill `long-video` trước — đọc kỹ mục "Vì sao dài không chỉ là thêm câu".

Nói rõ với người dùng trước khi làm: project hiện chỉ có composition `Short`.
Video dài nhất đã kiểm chứng là 75.8s. Nếu yêu cầu cần định dạng khác (16:9, đổi bố cục
giữa các chương) thì đó là việc viết composition mới — hỏi trước, đừng gán ép vào `Short`.

Nếu vẫn dùng `Short`:

1. Chia thành nhiều cảnh, mỗi chương một hình nền (skill `storyboard`).
2. Mỗi cảnh cần hình riêng, nếu không video sẽ đơn điệu.
3. Ước lượng thời gian render trước khi chạy: 27 frame/s, tức ~1.1× realtime.
