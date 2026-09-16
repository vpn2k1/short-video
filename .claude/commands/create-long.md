---
description: Tạo video dài hơn 60 giây, nhiều chương
---

Tạo video dài cho: $ARGUMENTS

Nạp skill `long-video` trước — đọc kỹ mục "Chọn độ dài" và "Vì sao dài không chỉ là thêm câu".

1. **Chốt độ dài trước khi viết.** Người dùng nêu số giây/phút thì dùng đúng số đó; không nêu thì hỏi.
   "Không giới hạn" nghĩa là viết đủ ý rồi dừng.
2. Sinh kịch bản bằng đường có sẵn — AI tự viết theo chương khi quá 30 câu:
   `npx tsx scripts/prompt-to-video.ts "<chủ đề>" --name <slug> --length <giây|free> --script-only`
   Hoặc trên web: chip **Độ dài** trong ô nhập.
3. Đọc lại `videos/<slug>/script.json`: các chương có lặp ý không, call-to-action chỉ ở cuối không.
4. Mỗi cảnh cần hình riêng, một hình nền không giữ quá ~15 giây (skill `storyboard`).
5. Nhiều chương thì cân nhắc render bằng composition `LongVideo` để có nhãn chương — giao diện web
   không chọn được, phải qua `/api/stage/render` hoặc Remotion CLI.
6. Ước lượng thời gian render và báo trước nếu video quá 2 phút (~1,1× realtime).
