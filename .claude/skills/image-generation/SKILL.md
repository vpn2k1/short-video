---
name: image-generation
description: Lấy ảnh nền cho cảnh — Canva connector, ảnh người dùng tự bỏ vào, hoặc hình vẽ bằng code. Dùng khi cần hình cho video và chưa có file sẵn.
---

# Image Generation

## Thứ tự ưu tiên

```bash
npm run fetch-images -- --name <slug> "query bằng tiếng Anh" "query 2"
npm run fetch-images -- --name <slug> --source gemini "mô tả"
```

Mặc định **pexels → gemini**. Truy vấn viết bằng **tiếng Anh** — Pexels đánh index tiếng Anh.

| Nguồn | Trạng thái | Được gì | Chi phí |
|---|---|---|---|
| **Pexels** (mặc định) | ✅ đã kiểm chứng | **ảnh chụp thật**, 25k request/tháng | free |
| Canva | ✅ đã kiểm chứng | minh hoạ vector đẹp | free (connector đã auth) |
| Gemini | ⚠️ key 403 | ảnh AI theo mô tả | free tier |
| `visual` code vẽ | ✅ | con số, nhãn bước | 0 |
| Bạn tự bỏ vào | ✅ | bất cứ gì | 0 |

Ảnh mọi nguồn đều được ffmpeg ép về đúng 1080×1920 (scale phủ kín rồi crop giữa).

## Pexels — mặc định

Ưu điểm quyết định: **ảnh chụp thật**, thứ Canva và `visual` không làm được.

`downloadPhoto` tải `src.original` chứ không dùng `src.portrait` — bản portrait Pexels
crop sẵn nhưng chỉ 800×1200, thiếu độ phân giải cho khung 1080×1920.

**Pexels yêu cầu ghi công tác giả.** Script tự ghi vào `public/images/<slug>/CREDITS.txt`.
Nhớ đưa vào phần mô tả khi đăng.

## Gemini — chưa dùng được

Key hiện tại **list model được nhưng generate thì không**:

```
gemini-2.5-flash         404 NOT_FOUND
gemini-2.5-flash-image   403 PERMISSION_DENIED
gemini-3-pro-image       403 PERMISSION_DENIED
```

"Your project has been denied access." Project Google Cloud chưa được cấp quyền sinh nội
dung. Cần bật API/billing cho project đó, hoặc dùng key AI Studio (tiền tố `AIza…`) thay
cho key hiện tại (tiền tố `AQ.`).

Code trong `scripts/gemini-image.ts` đã viết xong nhưng **chưa verify được** — đừng
khẳng định nó chạy cho tới khi key thông.

## Claude KHÔNG sinh được ảnh trực tiếp

## 1. `visual` — code vẽ, miễn phí, tức thì

Không cần file, không dịch vụ. Hợp con số và nhãn bước. Xem skill `storyboard`.

## 2. Canva connector — đã xác thực, dùng được ngay

```
generate-design (design_type: "your_story" = 1080×1920)
  → create-design-from-candidate    (chọn 1 trong 4 phương án)
  → get-export-formats              (xác nhận PNG)
  → export-design                   (trả URL tải)
  → curl về public/images/<slug>/
```

### Hai bẫy đã gặp thật

**Đừng truyền `width`/`height` vào `export-design`.** Có tham số kích thước thì nó trả
`Not allowed to access design` — thông báo nghe như lỗi quyền nhưng thực ra là tham số.
Bỏ đi thì export ra đúng 1080×1920, vì `your_story` vốn đã là khổ đó.

**Canva sinh *design có chữ*, không phải ảnh nền trơn.** 2/3 ảnh thử có chữ tiếng Anh
chèn sẵn ("Nighttime Routine", "Keeping a Fixed Bedtime") dù prompt ghi rõ *no text, no
words, no letters*. Nó là công cụ làm design hoàn chỉnh; yêu cầu "nền trơn" đi ngược
thiết kế của nó.

→ Sinh vài phương án rồi **tải về nhìn từng cái**, chỉ giữ cái sạch chữ. Thumbnail
trong response cần đăng nhập nên `curl` không xem được — phải export rồi mới xem.

### Prompt cho kết quả dùng được

Mô tả **khung cảnh**, không mô tả chủ đề. Nói rõ chừa vùng tối phía dưới. Ví dụ đã cho
ảnh sạch:

> "vertical 9:16 background, dark navy night sky, soft crescent moon and scattered faint
> stars in the upper area, minimal abstract illustration, smooth gradient. No text, no
> words, no letters, no logos anywhere. Keep the lower half mostly empty and dark so
> white subtitle text stays readable."

## 3. Người dùng tự bỏ ảnh vào

`public/images/<slug>/`. Xem skill `storyboard` cho quy ước thư mục.

## Chưa có

Sinh ảnh bằng AI (Gemini/nano-banana, Replicate) — cần API key người dùng chưa cấp.
Skill `intellectronica/agent-skills@nano-banana-pro` gọi thẳng Google với
`GEMINI_API_KEY`. Đừng cài trước khi có key.

## Sau khi có ảnh

Ảnh sáng thì chữ trắng khó đọc. Lớp `Scrim` (`src/scenes/Scenes.tsx`) phủ tối sẵn, nhưng
với ảnh rất sáng vẫn nên chọn ảnh khác thay vì tăng scrim — tăng scrim là dìm luôn ảnh.
