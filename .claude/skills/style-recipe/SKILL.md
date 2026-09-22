---
name: style-recipe
description: Phong cách "Công thức nấu ăn" — tấm thẻ công thức trên bàn gỗ trong bếp, mỗi cảnh một bước có huy hiệu "BƯỚC n" to, tên bước, hàng chấm tiến độ tích dần, ảnh món bo góc phóng chậm, lời hướng dẫn chữ tròn, viên nhãn có đồng hồ/cân cho con số, giấy nhớ "Mẹo:" kèm mũi tên vẽ tay, cảnh không ảnh thành danh sách nguyên liệu tích từng dòng, thẻ tiêu đề có đĩa món và chip "4 người ăn · 30 phút". Dùng cho nấu ăn, công thức, pha chế đồ uống, làm bánh, DIY, thủ công, hướng dẫn từng bước, chu trình skincare.
---

# Công thức nấu ăn

## Nhận diện hình ảnh

- Mặt bàn gỗ ván dọc có vân (SVG feTurbulence), khăn caro màu nhấn lộ một góc, vài lá húng ở mép, ánh đèn bếp ấm.
- Thẻ công thức giấy kem `#fffaf0` bo góc 30px, dải màu nhấn trên đầu thẻ, bóng đổ xuống bàn, hơi nghiêng ±1°.
- Chữ: **Baloo 2** cho huy hiệu, tên bước, tiêu đề; **Nunito** 800 cho lời hướng dẫn; **Patrick Hand** cho giấy nhớ và handle.
  Cả ba đóng gói sẵn, đủ dấu tiếng Việt, nạp bằng `ensureFonts`.
- Dọc (≥ 1.2): đầu thẻ (huy hiệu + tên bước + chấm tiến độ) → vạch gạch đứt → ảnh (~58% thân thẻ) → lời hướng dẫn.
  Ngang/vuông: ảnh bên trái nửa thẻ, cột phải là đầu thẻ + lời hướng dẫn.
- Màu nhấn: huy hiệu, dải đầu thẻ, chấm đã xong, vạch bút dạ của câu nhấn, vòng biểu tượng của viên số, khăn caro.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Ảnh bo góc 32px, bóng nhẹ, phóng chậm 1.02 → 1.12 suốt cảnh. Video: phát trong khung, tắt tiếng, lặp. `null` → **danh sách nguyên liệu**: mỗi câu của cảnh là một dòng có ô tích, dòng hiện khi được đọc và tích khi giọng đọc sang dòng sau. |
| Thứ tự cảnh | Huy hiệu "BƯỚC n" tự đánh số theo cảnh. Cảnh đầu có `tag` kiểu "Nguyên liệu/Chuẩn bị" → huy hiệu "CHUẨN BỊ" có rổ, không tính số; cảnh cuối có `tag` kiểu "Thành phẩm/Thưởng thức" → huy hiệu "XONG!". |
| Hàng chấm tiến độ | Một chấm mỗi cảnh, số trong chấm trùng số trên huy hiệu; cảnh chuẩn bị / thành phẩm là chấm nhỏ có rổ / cờ, không mang số. Đã xong đặc màu nhấn có dấu tích (dấu của bước vừa xong vẽ dần khi thẻ mới chạm bàn), hiện tại viền đậm phập phồng, bước sau mờ gạch đứt. |
| `tag` | Tên bước cạnh huy hiệu, Baloo đậm to, dài thì co và xuống tối đa 2 dòng. Không có → chỉ còn chấm tiến độ. |
| `captions` | **Mỗi lúc một câu** của cảnh, căn giữa vùng chữ, câu dài tự co chữ (tối thiểu 34px). |
| `punch` | Giấy nhớ vàng dán băng keo: "Mẹo:" màu nhấn + câu nhấn viết tay, mũi tên vẽ dần chỉ vào ảnh (hoặc chỉ lên danh sách khi không ảnh). Có nguyên văn trong câu: các từ đó còn được bút dạ màu nhấn quét lần lượt lúc `atMs`. |
| `visual` stat/badge | Viên nhãn trắng: vòng màu nhấn có biểu tượng tự chọn theo chữ — "phút/giờ" đồng hồ (kim quay), "g/kg" cái cân, "muỗng/ml/chén" cái muỗng, "độ/lửa" ngọn lửa, "người/phần" hai người, còn lại muỗng (stat) hoặc dấu tích (badge) — + con số + chú thích nhỏ. Dọc: đè mép dưới trái ảnh. Ngang: góc dưới trái trong ảnh. Không ảnh: ngay dưới đầu thẻ bên phải. |
| `title`/`subtitle`/`handle` | Khi `showTitle`: thẻ tiêu đề có dĩa · "CÔNG THỨC" · muỗng · phới, đĩa tròn chứa ảnh của cảnh đầu tiên có ảnh, tên món to, đường lượn màu nhấn, dòng phụ tách theo `·`/`|` thành chip có biểu tượng (người, đồng hồ, lửa, lá), handle viết tay. |

## Chuyển động

- Mở đầu: biểu tượng, đĩa món xoay vào, tên món bật lên, chip bật lần lượt. Frame 54–70 thẻ tiêu đề bị nhấc lên
  khỏi khung (trượt lên + xoay), lộ thẻ bước 1 bên dưới; huy hiệu bước 1 bật vào, tên bước trượt vào.
- Sang cảnh: thẻ mới (đầu thẻ + ảnh in sẵn) trượt từ phải vào đè lên thẻ cũ trong 18 frame, xoay từ 9° về độ nghiêng
  riêng; thẻ cũ tối nhẹ. Khi chạm bàn huy hiệu nảy như đóng dấu, dấu tích bước trước vẽ ra, viên số bật vào.
- Câu hướng dẫn hiện mờ dần + trượt lên 9 frame; giấy nhớ bật vào kiểu nảy rồi mũi tên vẽ dần.
- Không `showTitle`: thẻ đầu trượt nhẹ lên trong 10 frame đầu.

## Lỗi cần tránh

- Câu hướng dẫn dài hơn ~90 ký tự làm chữ co nhỏ — tách thành nhiều câu ngắn, mỗi câu một thao tác.
- `tag` dài hơn ~22 ký tự bị co và xuống 2 dòng; trên 2 dòng bị cắt.
- `punch` dài hơn ~35 ký tự làm giấy nhớ cao, đè nhiều lên ảnh.
- Cảnh không ảnh dùng MỌI câu của cảnh làm dòng danh sách — hơn 6 câu thì chữ nhỏ; chia cảnh.
- `visual.text` chỉ nên là con số + đơn vị ("15 phút", "200g") để chọn đúng biểu tượng.
- Phụ đề là nội dung thẻ nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng hướng dẫn thân thiện, như người trong bếp chỉ cho bạn: câu mệnh lệnh ngắn, động từ đầu câu ("Phi thơm tỏi", "Cho bột vào").
- Tiêu đề là tên món/thành phẩm; dòng phụ ghi khẩu phần và thời gian, ngăn bằng " · " — "4 người ăn · 30 phút · Dễ làm".
- Cảnh đầu nên là nguyên liệu: `tag` "Nguyên liệu" (hoặc "Chuẩn bị"), KHÔNG ảnh, mỗi câu một món kèm định lượng
  ("300g bột gạo, 1 lon nước cốt dừa.") — sẽ thành danh sách tích từng dòng. 2–5 câu.
- Mỗi cảnh sau là MỘT bước: 1–3 câu, mỗi câu dưới 70 ký tự, một thao tác cụ thể có chi tiết (lửa, màu, thời gian).
- `tag`: tên bước 1–3 từ, tối đa 20 ký tự — "Sơ chế", "Pha bột", "Xào thơm", "Đổ bánh". Không ghi "Bước 1" (đã tự đánh số).
- Cảnh cuối: `tag` "Thành phẩm" hoặc "Thưởng thức" (hiện huy hiệu "XONG!"), mô tả cách ăn/bảo quản + lời mời thử.
- `punch`: chép NGUYÊN VĂN 2–5 từ trong một câu của cảnh — bí quyết dễ sai nhất ("ít nhất 30 phút", "lửa vừa"); sẽ thành giấy nhớ "Mẹo: …".
- `visual` stat: thời gian, định lượng hoặc nhiệt độ của bước — "15 phút", "200g", "180 độ", "2 muỗng" — kèm caption ngắn ("cho bột nghỉ").
- Ảnh: ảnh chụp món/nguyên liệu từ trên xuống, ánh sáng tự nhiên, đúng thao tác của bước.
<!-- /ai-guide -->

## File

- `src/styles/recipe/index.tsx` — bố cục thẻ, huy hiệu bước, chấm tiến độ, ảnh, viên số, giấy nhớ, lời hướng dẫn, danh sách nguyên liệu, thẻ tiêu đề.
- `src/styles/recipe/kitchen.tsx` — mặt bàn gỗ, khăn caro, lá húng, biểu tượng bếp và luật chọn biểu tượng theo chữ.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
