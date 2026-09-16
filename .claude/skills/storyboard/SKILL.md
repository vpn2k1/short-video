---
name: storyboard
description: Chia nội dung thành cảnh và quyết định mỗi cảnh dùng hình gì. Dùng khi lên bố cục hình ảnh, gán ảnh cho cảnh, hoặc video đang đơn điệu.
---

# Storyboard

## Cảnh là gì trong project này

Một cảnh = một nhóm câu dùng chung một **hình nền**. Cảnh KHÔNG cắt timeline — nó chỉ
đổi lớp nền, cross-fade 0.5s bằng `opacity`. Phụ đề và tiếng chạy liên tục xuyên qua.

Nhịp: short-form nên **2-4 cảnh, mỗi cảnh 2-3 câu**. Skill `short-form-video` khuyến nghị
có thay đổi thị giác mỗi 2-4 giây; đổi cảnh là một loại thay đổi đó.

## Ba nguồn hình, chọn theo việc

| Nguồn | Cần chuẩn bị | Được gì | Không được gì |
|---|---|---|---|
| `visual` (code vẽ) | không | con số lớn, nhãn bước | ảnh chụp, cảnh vật |
| `image` từ Canva | connector (đã có) | minh hoạ vector đẹp | ảnh chụp thật, kiểm soát chính xác |
| `image` bạn tự bỏ vào | file của bạn | bất cứ gì | — |

Dùng được cả `image` lẫn `visual` cùng cảnh — visual chồng lên ảnh.

## Khi nào dùng `visual` thay vì ảnh

`visual` sinh được tức thì, không tốn gì, không lệ thuộc dịch vụ nào:

```json
{ "type": "stat",  "text": "7-9",    "caption": "giờ ngủ mỗi đêm" }
{ "type": "badge", "text": "Bước 1", "caption": "Cố định giờ đi ngủ" }
```

`text` tối đa 16 ký tự — phải đọc được trong một cái liếc.

**Đặt `null` nếu cảnh không có con số hay bước nào đáng nêu.** Mọi cảnh đều gắn badge
thì hết tác dụng nhấn mạnh.

## Quy ước thư mục ảnh

```
public/images/<slug>/    ảnh riêng video đó
public/images/shared/    ảnh dùng chung
```

Đường dẫn trong script tính từ `public/`, không có `/` đầu.

**Đặt tên file gợi nội dung** (`sac-dem.jpg`, không phải `IMG_2831.jpg`). Khi sinh kịch
bản bằng prompt, model chọn ảnh dựa trên tên file — đó là thứ duy nhất nó thấy được,
nó không nhìn được ảnh.

## Kiểm tra

```bash
npm run images    # ảnh nào cho video nào, cảnh nào, khoảng thời gian nào
```

Đánh dấu `← THIẾU FILE` cho ảnh tham chiếu sai, và liệt kê ảnh chưa video nào dùng.
Ảnh thiếu bị chặn TRƯỚC khi bundle (`assertImagesExist`), vì để tới lúc render thì
Remotion retry vài giây rồi mới chết, log đầy dòng 404.
