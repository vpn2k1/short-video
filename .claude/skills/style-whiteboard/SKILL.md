---
name: style-whiteboard
description: Phong cách "Bảng trắng" — trang sổ tay kẻ dòng, chữ bút dạ viết dần, gạch chân/khoanh tròn vẽ tay, ảnh polaroid dán băng keo. Dùng cho dạy học, hướng dẫn từng bước, giải thích khái niệm, công thức, con số cần nhớ.
---

# Bảng trắng

## Nhận diện hình ảnh

- Nền giấy kem có dòng kẻ xanh, lề đỏ hai nét, lỗ đục sổ bên trái, viền tối nhẹ và
  lớp nhiễu giấy tĩnh. Dải trên/dưới ngoài vùng an toàn có vài hình bút chì (sao,
  mũi tên, xoắn ốc, dấu tích) — seed theo trang nên mỗi trang hơi khác.
- Chữ viết tay bằng **Marker Felt** màu mực xanh đen `#1d2540`, rơi về `FONTS.rounded`
  nếu máy không có. Đã kiểm dấu tiếng Việt (ắ ồ ữ ệ ỡ, chữ hoa Ặ Ữ Ở).
- Màu nhấn (`accent`) chỉ dùng cho nét vẽ tay: khung nhãn, gạch chân, vòng khoanh, chữ punch.
- Mỗi cảnh là **một trang**. Số trang `1/3` viết bút chì góc trên phải.
- Bố cục: khung dọc (9:16, 3:4) xếp ảnh/hình vẽ trên, chữ dưới; vuông và ngang chia
  hai cột — chữ trái, ảnh phải. Trang không có ảnh lẫn hình vẽ thì chữ to, căn giữa dọc.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Ảnh polaroid khung trắng, hai mảnh băng keo, nghiêng nhẹ, rơi xuống rồi đung đưa. Video (.mp4/.mov/.webm) đặt trong cùng khung, tắt tiếng, lặp. `null` → không vẽ khung. |
| `tag` | Chữ viết trong khung chữ nhật vẽ tay màu nhấn, góc trên trái. Khung tự vẽ ra đầu trang. |
| `punch` | Nếu cụm có nguyên văn trong một câu của cảnh: các từ đó đổi sang màu nhấn và được gạch chân hai nét đúng lúc `atMs`; nét viết của câu được đẩy nhanh để tới cụm đúng lúc đó. Không khớp nguyên văn → viết riêng thành ghi chú màu nhấn trong vùng hình (chỉ khi cảnh không có `visual`). |
| `visual` stat | Con số lớn được khoanh tròn vẽ tay, `caption` viết bút chì bên dưới. Có ảnh cùng cảnh → đặt trên tấm thẻ giấy đè góc ảnh. |
| `visual` badge | Giấy note vàng nghiêng, có mảnh băng dính, chữ viết tay giữa note. |
| `captions` | Câu hiện tại viết dần từ trái sang phải (60% thời lượng câu). Câu trước **của cùng trang** còn lại phía trên, nhỏ và mờ, nếu đủ chỗ. Tối đa hai câu trên màn. |
| `title`/`subtitle`/`handle` | Khi `showTitle`: trang bìa riêng — tiêu đề viết ra, gạch chân kép màu nhấn, phụ đề và handle bên dưới; frame 70 lật trang sang cảnh đầu. |

## Chuyển động

- Chữ: mỗi từ lộ dần bằng `clip-path` theo thứ tự ký tự → xuống dòng tới đâu nét viết chạy tới đó.
- Nét vẽ tay: `pathLength=1` + `stroke-dashoffset`; đường có nhiễu seed (`seeded`) nên hơi méo nhưng cố định giữa các frame.
- Đầu trang: khung nhãn (0–16 frame), ảnh rơi (4–24), note/con số (6–30 hoặc 16–40 khi có ảnh).
- Sang cảnh: trang mới trượt từ phải đè lên trong 14 frame, nghiêng nhẹ, có bóng; trang cũ lùi trái và tối đi.
- Không dùng TransitionSeries — mốc cảnh/phụ đề giữ nguyên frame tuyệt đối.

## Lỗi cần tránh

- **Đừng đổi font sang Noteworthy (Bold mất dấu trăng chữ hoa) hay Chalkboard SE/Chalkduster (dấu chồng lệch).** Font mới phải render still kiểm `ắ ồ ữ ệ ỡ Ặ Ữ`.
- `punch` không có nguyên văn trong lời → mất hiệu ứng gạch chân trong câu, chỉ còn ghi chú rời (và mất hẳn nếu cảnh có `visual`).
- Cụm punch quá dài (> nửa dòng) sẽ bị đẩy xuống dòng riêng — giữ 1–5 từ.
- `tag` dài hơn 18 ký tự bị co chữ cho vừa 70% bề ngang.
- Câu > 90 ký tự vẫn vừa nhưng chữ co nhỏ và câu trước bị ẩn — tách câu.
- Clip video không có sẵn trong repo để test; nhánh video dùng cùng mẫu `Sequence` + `Video` muted loop như `src/scenes/Scenes.tsx`.
- Đo chữ bằng canvas trình duyệt (`textWidth` trong `sketch.ts`) — chỉ đúng với font hệ thống đã có sẵn.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Mỗi cảnh là một bước hoặc một khái niệm; 2–3 câu mỗi cảnh, mỗi câu 1 ý.
- Giọng thầy cô thân thiện: câu rõ, ngắn, có động từ hành động ("Bật…", "Nhớ rằng…").
- `tag`: "Bước 1", "Bước 2"… cho hướng dẫn; hoặc từ khoá khái niệm ("Lãi kép", "Định luật 1"), tối đa 18 ký tự.
- `punch`: chép NGUYÊN VĂN 1–5 từ từ một câu của chính cảnh đó — thuật ngữ hoặc con số người xem phải nhớ; `atMs` là lúc giọng đọc tới cụm.
- `visual` stat cho công thức, con số, tỉ lệ ("80%", "a² + b²") kèm caption ngắn giải thích; badge cho nhãn ngắn ("Mẹo", "Lưu ý").
- Ảnh không bắt buộc; nếu có, chọn đồ vật đơn giản, rõ nền (điện thoại, sách, biểu đồ) — sẽ thành ảnh polaroid nhỏ.
- Không cần ảnh cho mọi cảnh: trang chỉ có chữ vẫn đẹp, chữ sẽ to hơn.
- Kết bằng một câu tóm tắt hoặc lời nhắc lưu lại để ôn.
<!-- /ai-guide -->

## File

- `src/styles/whiteboard/index.tsx` — bố cục, lật trang, trang tiêu đề, khối phụ đề.
- `src/styles/whiteboard/written.tsx` — chữ viết dần, tìm cụm punch, gạch chân.
- `src/styles/whiteboard/pieces.tsx` — khung nhãn, polaroid, giấy note, con số khoanh tròn, ghi chú punch dự phòng.
- `src/styles/whiteboard/paper.tsx` — tờ giấy sổ tay và hình vẽ bút chì.
- `src/styles/whiteboard/sketch.ts` — màu, font, đo chữ, sinh đường vẽ tay.
