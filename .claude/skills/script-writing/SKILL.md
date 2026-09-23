---
name: script-writing
description: Viết và sửa kịch bản video (videos/<slug>/script.json) — cấu trúc cảnh, độ dài câu, đặc thù tiếng Việt. Dùng khi soạn nội dung, sửa lời, hoặc soát lại phụ đề sau phiên âm.
---

# Script Writing

## File nào là nguồn sự thật

```
videos/<slug>/script.json   nội dung — SỬA Ở ĐÂY
videos/<slug>/props.json    sinh ra từ script, đã có timing + đường dẫn audio
```

Sửa `script.json` rồi `npm run prompt-to-video -- --name <slug>` → **không gọi API**.
Với video từ audio có sẵn thì ngược lại: sửa thẳng `props.json` rồi `npm run render-all`,
vì timing đến từ phiên âm chứ không sinh lại được.

## Cấu trúc

```json
{
  "title": "Hook ngắn, tối đa 6 từ, không dấu chấm cuối",
  "subtitle": "Một dòng làm rõ lợi ích",
  "accent": "#e8590c",
  "background": "#12100e",
  "scenes": [
    {
      "image": "images/<slug>/buoc-1.jpg",
      "visual": { "type": "stat", "text": "7-9", "caption": "giờ ngủ mỗi đêm" },
      "lines": ["Câu một.", "Câu hai."]
    }
  ]
}
```

Kịch bản cũ chỉ có `lines` phẳng vẫn đọc được — `parseScript()` biến thành một cảnh.

## Luật viết câu

- **Một ý trọn vẹn mỗi câu.** Người xem đọc trên điện thoại trong 1-4 giây.
- **Tối đa 42 ký tự hiển thị một dòng.** Câu dài hơn sẽ bị `group-captions` ngắt — ngắt
  máy móc thì xấu, tự viết ngắn thì đẹp.
- **Câu cuối là call-to-action.**
- **Short-form: 5-8 câu, 2-4 cảnh.** Dài hơn chỉ khi người dùng yêu cầu rõ.
- **Không emoji trong `lines`.**

## Tiếng Việt: soát lại sau phiên âm

ASR **luôn** sai hai thứ, đã gặp thật:

**Tên riêng.** "Dế Mèn" → "dế men", "Dế Choắt" → "Dế Choách". Video kể chuyện mà sai tên
nhân vật thì hỏng.

**Ký tự vỡ.** whisper.cpp 1.5.5 xuất ra `U+FFFD` cho một số ký tự: `"Dư<?>i"`, `"c<?>"`,
`"ch<?>ng"`. Kiểm tra JSON thô cho thấy hỏng ngay từ output của whisper — **không sửa
được bằng code**, chỉ sửa tay. Bật hay tắt `tokenLevelTimestamps` đều vỡ như nhau.

Kiểm nhanh còn ký tự vỡ không:

```bash
grep -c '�' videos/<slug>/props.json
```

## Màu

`accent` dùng cho nền phụ đề và thanh tiến độ; chữ trắng đè lên. Chọn màu đủ tối để chữ
trắng đọc được — chữ lớn cần tỉ lệ tương phản ≥ 3:1. `background` phải tối.

Không nối chuỗi vào màu ở bất kỳ đâu trong code.
