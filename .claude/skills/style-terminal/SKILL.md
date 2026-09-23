---
name: style-terminal
description: Phong cách "Màn hình code" — desktop tối của lập trình viên: cửa sổ terminal gõ từng câu phụ đề sau dấu nhắc "$" xanh lá với con trỏ khối nhấp nháy, câu cũ trôi lên thành lịch sử mờ, ảnh/clip bật ra trong cửa sổ "preview_01.png" / "demo_01.mp4", tag là dòng chú thích `# …`, câu nhấn là dòng output đảo màu "✔ …" có nhiễu, số liệu là thanh tiến độ ASCII [████░░] hoặc số mono cỡ lớn, mở đầu bằng "npm run <slug>" rồi tiêu đề chữ lớn. Dùng cho lập trình, mẹo công nghệ, AI, an ninh mạng, sự thật về hacker, hướng dẫn phần mềm.
---

# Phong cách: Màn hình code (terminal)

`style: "terminal"` trong props. Code: `src/styles/terminal/`.

## Nhận diện hình ảnh

- Nền desktop gần đen (#07090d), lưới chấm mờ, quầng sáng `accent` góc trên trái và xanh dương góc dưới phải.
- Cửa sổ terminal kiểu macOS: thanh tiêu đề ba chấm đỏ/vàng/xanh, tên `~/project — zsh`,
  thân tối trong mờ, scanline rất nhẹ, chữ có quầng sáng nhỏ nhưng vẫn sắc.
- Bảng màu kiểu GitHub Dark: chữ #e6edf3, dấu nhắc `$` xanh lá, con số vàng hổ phách, "ngoặc kép" xanh lá, chú thích xám nghiêng.
  `accent` chỉ dành cho cụm câu nhấn, số liệu và tiêu đề (accent quá tối tự được làm sáng để đọc được trên nền đen).
- Chữ mono: stack hệ thống `Menlo, Consolas, …, "Courier New", "Be Vietnam Pro"` — không có font mono đóng gói nào có dấu tiếng Việt;
  Menlo (macOS) và Consolas / Courier New (Windows) đều đủ dấu, ký tự nào máy thiếu thì mượn riêng từ Be Vietnam Pro đóng gói.
  Tiêu đề lớn dùng Be Vietnam Pro 800, in hoa bằng `toLocaleUpperCase("vi")`.
- 9:16 / 1:1: cửa sổ ảnh ở trên (≈ 42% vùng an toàn), terminal bên dưới. Cảnh không ảnh → terminal kéo cao lấp cả vùng.
- 16:9 (tỉ lệ ≥ 1.3): terminal cột trái (56%), cửa sổ ảnh bên phải chồng mép nhẹ. Cảnh không ảnh → terminal trượt ra giữa.
  Bề ngang terminal không bao giờ đổi, nên chữ không xuống dòng lại giữa chừng.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | mỗi câu một dòng lệnh `$ …` gõ từng ký tự từ `startMs` (≤ 1 frame/ký tự, xong trong ~70% thời lượng câu); câu trước mờ còn 42% |
| `image` | cửa sổ thứ hai `preview_0n.png` (ảnh, Ken Burns nhẹ) hoặc `demo_0n.mp4` (clip — trim/speed/crop/volume của trình chỉnh sửa vẫn áp dụng) |
| `image: null` | chỉ terminal, cao/rộng hơn |
| `tag` | dòng chú thích xám `# tag` đầu cảnh |
| `punch` | cụm từ trong câu lệnh tô accent đậm; gõ xong câu thì bật dòng output đảo màu `✔ punch` (nền accent) có chớp sáng + nhiễu lệch kênh ~9 frame |
| `visual` stat `%` | thanh tiến độ ASCII `[████████░░] 81%` chạy tới đúng số, kèm `↳ caption` |
| `visual` stat khác | số mono cỡ lớn màu accent (co vừa bề ngang), kèm `↳ caption` |
| `visual` badge | nhãn nền xanh lá `[ BƯỚC 2 ]` in hoa, kèm `↳ caption` |
| `title` / `subtitle` | màn mở đầu 70 frame: gõ `npm run <slug-tiêu-đề>`, hai dòng build, tiêu đề chữ lớn accent có bóng khối + gạch `═══`, `// subtitle` |
| `accent` | câu nhấn, số liệu, tiêu đề, quầng sáng nền |
| `background`, `captionPosition` | không dùng |

## Chuyển động

- Như terminal thật: chữ chạy từ trên xuống; đầy khung thì cả khối neo đáy, dòng cũ trôi lên và tan dần ở mép trên.
- Dòng sau chỉ hiện khi dòng trước đã xong (gõ xong mới có output); câu bị dồn trễ thì gõ nhanh hơn để kịp lời đọc.
- Con trỏ khối sáng liên tục khi đang gõ, nhấp nháy nửa giây khi chờ; sau một dòng output hiện dấu nhắc trống `$ █`.
- Cửa sổ ảnh bật ra (scale 0.78 → 1 có vượt nhẹ, 14 frame), lệch vị trí chút ít mỗi cảnh; cảnh sau mở thì cửa sổ cũ thu nhỏ mờ đi.
- Terminal đổi chỗ/chiều cao trong 14 frame khi cảnh chuyển giữa có ảnh và không ảnh.
- Số liệu: thanh `█` chạy + đếm số 20 frame; số lớn gõ ra 8 frame. Tiêu đề và badge nhiễu ngắn lúc bật.

## Lỗi cần tránh

- Câu phụ đề quá dài (> ~90 ký tự) chiếm 4 dòng terminal, đẩy lịch sử đi mất. Tách câu.
- Punch không chép nguyên văn từ một câu trong cảnh → không tô accent trong câu lệnh (dòng `✔` vẫn hiện ở `atMs`).
- Punch dài > ~35 ký tự: dòng đảo màu xuống 2 dòng, mất độ gọn.
- Stat `%` phải là số thuần + `%` ("81%", "99,9%") mới thành thanh tiến độ; "81 phần trăm" thành số lớn.
- Đừng dùng CSS text-transform cho tiêu đề hay badge — in hoa bằng JS để giữ dấu Ư/Ơ.
- Ảnh dọc bị cắt thành khung ngang ở 9:16 (cửa sổ ~ 950×620): chọn ảnh chủ thể ở giữa, ảnh chụp màn hình/giao diện là hợp nhất.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng một lập trình viên/chuyên gia công nghệ nói ngắn, chắc, có số liệu: mỗi câu 6–16 từ (≤ 90 ký tự) — mỗi câu là một dòng lệnh được gõ ra.
- Câu đầu là hook dạng cảnh báo hoặc sự thật gây sốc về công nghệ ("99% lập trình viên mới mắc lỗi này.").
- Mỗi cảnh một ý: một lỗi, một mẹo, một bước, một con số. 4–7 cảnh, 1–3 câu mỗi cảnh.
- `tag` như tên mục trong code, ngắn ≤ 24 ký tự, chữ thường ("lỗi #1: mật khẩu yếu", "bước 2", "mẹo nhanh") — sẽ hiện thành `# tag`.
- `punch`: 2–5 từ là "kết quả"/giải pháp của cảnh, chép NGUYÊN VĂN từ một câu trong cảnh đó ("bật xác thực hai lớp"); tối đa một punch mỗi cảnh, không phải cảnh nào cũng cần.
- `visual` stat dùng cho phần trăm ("81%" | "vụ rò rỉ do mật khẩu yếu" → thanh tiến độ ASCII) hoặc con số ngắn ("12 tỷ", "0,3 giây"); badge cho bước ("BƯỚC 2" | "Dùng trình quản lý mật khẩu").
- Thuật ngữ tiếng Anh quen thuộc (AI, Git, API, VPN, ChatGPT) giữ nguyên; tên lệnh/phím tắt có thể đặt trong "ngoặc kép" để được tô màu.
- `image`: ảnh chụp màn hình, giao diện phần mềm, thiết bị, clip thao tác; cảnh chỉ có số liệu hoặc lời khuyên thuần thì để null — terminal sẽ lấp khung.
- Kết bằng một câu hành động ("Lưu lại để làm ngay tối nay.") hoặc câu chốt kiểu output hoàn tất.
<!-- /ai-guide -->

## File

- `src/styles/terminal/index.tsx` — nền desktop, khung cửa sổ, hình học hai cửa sổ theo tỉ lệ khung, terminal đổi chỗ, cửa sổ ảnh/clip bật ra, cột lịch sử neo đáy
- `src/styles/terminal/session.ts` — dựng phiên terminal từ dữ liệu (màn mở đầu, tag, câu lệnh, punch, số liệu) và xếp hàng thời gian gõ
- `src/styles/terminal/Lines.tsx` — từng loại dòng: lệnh gõ + tô màu cú pháp, chú thích, output, câu nhấn nhiễu, thanh tiến độ ASCII, số lớn, badge, tiêu đề lớn, con trỏ
- `src/styles/terminal/theme.ts` — bảng màu, font stack mono có dự phòng tiếng Việt, easing, slugify, màu chữ trên nền accent
