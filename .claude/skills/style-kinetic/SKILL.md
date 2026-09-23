---
name: style-kinetic
description: Phong cách "Chữ động" — lời đọc in hoa cỡ lớn bật từng từ theo nhịp, nền màu phẳng đổi theo cảnh, không cần ảnh. Dùng cho hook mạnh, tuyên ngôn, câu truyền cảm hứng, quảng cáo ngắn, nội dung ít hình.
---

# Phong cách: Chữ động (kinetic typography)

`style: "kinetic"` trong props. Code: `src/styles/kinetic/`.

## Nhận diện hình ảnh

- Chữ LÀ hình: câu đang đọc in hoa (in hoa bằng JS, NFC + `toLocaleUpperCase("vi")`), font `FONTS.sans`
  (SF) đậm 900, canh trái, cỡ lớn nhất vừa hộp. Canvas đo chữ dùng đúng chuỗi font đó.
- Mỗi cảnh một nền phẳng, xoay vòng: mực (gần đen) → `accent` → giấy ngà → màu bổ túc của accent.
  Màu chữ, màu khối nhấn chọn theo tương phản WCAG với nền — accent sáng hay tối đều đọc được.
- Cụm punch: khối nền màu nhấn (chữ đảo màu), to hơn 14%.
- Ảnh chỉ là texture đen trắng rất mờ (16–20%), không tranh chỗ với chữ.
- Thanh tiến độ mảnh sát đáy khung.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | mỗi lúc một câu; tách từ, từ thứ k bật ở `startMs + offset/len × 70% thời lượng` |
| `punch` | từ trùng `punch.text` trong câu (không phân biệt hoa thường) → khối nền chạy ngang, nảy + rung đúng `atMs` |
| `tag` | nhãn in hoa đầu vùng an toàn, thanh màu nhấn + đường kẻ + số cảnh `01/03` |
| `visual` stat | số khổng lồ đếm lên (giữ tiền tố/hậu tố: `80%`, `+30K`, `1.200`, `2,5 triệu`) — trên chữ (dọc) hoặc cột trái (ngang) |
| `visual` badge | pill viền, đặt ngay trên câu; `caption` nhỏ bên cạnh |
| `image` | texture grayscale, `screen` trên nền tối / `multiply` trên nền sáng; video thì tắt tiếng, lặp. `null` là bình thường |
| `title`/`subtitle` | title card 70 frame trên nền accent: từ tiêu đề đập xuống, phụ đề gõ chữ, cả tấm cuốn lên |
| `captionPosition` | không dùng — chữ luôn chiếm giữa khung |

Không có caption nào → hiện `title` làm chữ chính.

## Chuyển động

- Kiểu bật từng từ chọn theo seed, có nhịp: từ đầu câu luôn *slam* (scale 2.3 → 1), còn lại *up* (trượt lên)
  hoặc *rotate* (xoay quanh góc dưới trái); không quá 2 từ liền cùng kiểu. 7 frame, bezier (0.16, 1, 0.3, 1).
- 4 frame trước câu mới, câu cũ bay lên và mờ đi. Cả khối phóng 3.5% chậm suốt câu.
- Đổi cảnh 14 frame, luân phiên: trượt lên từ đáy / vòng tròn nở / gạt chéo. Cảnh mới vẽ đè cảnh cũ
  bằng clip-path nên chữ đổi màu đúng theo mép chuyển. Chỉ vẽ 2 lớp trong lúc chuyển.
- Cỡ chữ đo bằng canvas (cache) và mô phỏng flex-wrap — không có `@remotion/layout-utils`.

## Lỗi cần tránh

- Punch không chép nguyên văn từ câu → không khớp, không có nhấn.
- Punch dài cả câu → khối màu phủ kín màn hình, mất tác dụng.
- Câu > 90 ký tự vẫn vừa nhưng chữ nhỏ dần, mất chất "chữ động" — chia câu.
- Một cảnh kéo quá dài (> 8 câu) → một màu nền mãi, đơn điệu.
- Đừng thêm blur/filter động toàn khung — render chậm.
- Đừng dùng `FONTS.condensed` (Avenir Next Condensed) hay CSS `text-transform: uppercase` cho chữ in hoa:
  móc của Ư/Ơ bị tách rời, "ĐỪNG", "THƯỜNG" giãn cách sai. Đã gặp và sửa — kiểm lại bằng still khi đổi font.
- Khối punch của các từ liền nhau phải chồng mép vài px, nếu không lộ khe mảnh giữa các từ.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 3–5 cảnh, mỗi cảnh 1–3 câu; tổng 6–10 câu. Mỗi cảnh là một màu nền nên đổi cảnh = đổi nhịp.
- Câu ngắn, đập: 3–8 từ (tối đa ~40 ký tự). Chữ càng ít càng to. Ưu tiên câu mệnh lệnh, tương phản, nhịp ba.
- Câu đầu là hook gây sốc/tò mò; câu cuối là call-to-action ngắn.
- `tag`: nhãn ngắn ≤ 18 ký tự cho ngữ cảnh cảnh đó ("Sai lầm #1", "Năm 2024", "Mẹo 3") — không lặp lại lời đọc.
- `punch`: 1–4 từ đắt nhất của cảnh, PHẢI chép nguyên văn từ một câu của cảnh; mỗi cảnh tối đa một punch.
- `image` gần như không cần — để null trừ khi có ảnh thật sự mang nghĩa (chỉ hiện làm texture mờ).
- `visual` stat khi cảnh có một con số đáng nhớ ("80%", "3 triệu"); badge cho nhãn bước. Không dùng cả hai cho mọi cảnh.
- Giọng mạnh, chắc, nói thẳng; tránh câu rào đón dài dòng.
<!-- /ai-guide -->

## File

- `src/styles/kinetic/index.tsx` — ghép lớp, chuyển cảnh, title card
- `src/styles/kinetic/Layer.tsx` — một cảnh: nền, texture, tag, visual, chữ, thanh tiến độ
- `src/styles/kinetic/Words.tsx` — câu tách từ, kiểu bật, punch
- `src/styles/kinetic/TitleIntro.tsx` — title card
- `src/styles/kinetic/text.ts` — tách từ, dò punch, đo và co cỡ chữ
- `src/styles/kinetic/palette.ts` — bảng màu theo accent/background, chọn màu theo tương phản
