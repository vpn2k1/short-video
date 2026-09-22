---
name: style-finance
description: Phong cách "Biểu đồ tài chính" — màn hình giao dịch kiểu Bloomberg rút gọn trên nền navy đen kẻ lưới mảnh: biểu đồ giá (đường + vùng tô + cột khối lượng) tự vẽ từ trái sang phải suốt video, xu hướng bám câu chuyện; thanh đầu LIVE + đồng hồ phiên + mã + giá + % xanh/đỏ; bảng Mở/Cao/Thấp/KL chạy theo giá; ảnh/clip trong thẻ "TIN THỊ TRƯỜNG" bo góc viền màu nhấn; phụ đề trong ô "BẢN TIN" với con số tự tô xanh/đỏ; tag là chip mã "◆ VN-INDEX"; câu nhấn là cú vọt giá + bong bóng chú thích + loé xanh; số liệu đếm nhảy kèm ▲/▼ và sparkline; dải mã chạy dưới đáy; mở đầu bằng màn "PHIÊN MỞ CỬA". Dùng cho chứng khoán, crypto, tài chính cá nhân, tin kinh tế/doanh nghiệp, báo cáo lợi nhuận, số liệu tăng giảm.
---

# Phong cách: Biểu đồ tài chính

`style: "finance"` trong props. Tinh thần màn hình giao dịch / bảng điện: nền tối, lưới mảnh, chữ số canh đều,
xanh = tăng, đỏ = giảm. Biểu đồ là nhân vật chính và chạy suốt video. Code: `src/styles/finance/`.

## Nhận diện hình ảnh

- Nền `#060a12` kẻ lưới 48 đơn vị, quầng xanh đêm góc trên-phải. Font dữ liệu Roboto (số `tabular-nums`), chữ
  đọc Lexend. Màu cố định: tăng `#16c784`, giảm `#ea3943`, tham chiếu vàng chấm. `accent` chỉ tô khung: viền thẻ
  ảnh, vạch chip mã, vạch trái khung phụ đề, viền dải mã chạy, gạch dưới tiêu đề.
- **Biểu đồ giá**: bước ngẫu nhiên có seed (`title|handle`), 60–160 điểm trải đều cả video; đầu đường nằm ở
  `frame / thời lượng` nên vẽ từ mép trái tới trục giá bên phải đúng lúc hết video. Đường sáng có quầng, vùng tô
  gradient, cột khối lượng xanh/đỏ, 5 vạch mốc giá, đường tham chiếu (giá mở cửa), vạch đứt từ đầu đường tới nhãn
  giá hiện tại trên trục, chấm đầu nhấp nháy. Màu đường theo giá so với tham chiếu (trễ ±0,35% để không nháy).
- **Xu hướng theo cảnh**: câu nhấn/số liệu có từ "giảm, lỗ, sụt, mất, rớt, bán tháo…" hoặc số âm → đi xuống;
  có câu nhấn hoặc stat → đi lên; lời trong cảnh có "giảm…" → xuống, có "tăng, vượt, lãi, kỷ lục, mua ròng…" → lên;
  còn lại nhích xuống nhẹ.
- **Thanh đầu**: chip "● LIVE" nháy + đồng hồ phiên (09:15:00 cộng thời gian video), mã chính cỡ lớn — từ đầu tiên
  của title nếu đã giống mã ("VN-Index" → `VN-INDEX`, "BTC"), không thì chữ cái đầu các từ bỏ dấu; bên phải giá
  hiện tại + ô % thay đổi (đổi thành khối đặc lúc câu nhấn loé).
- **Bảng giá** Mở cửa / Cao nhất / Thấp nhất / Khối lượng cập nhật theo đầu đường: 9:16 là cột dọc bên trái thẻ
  ảnh, 16:9 là hàng 4 ô dưới thẻ ảnh, 1:1 là lưới 2×2.
- **Thẻ tin**: ảnh/clip trong thẻ bo góc góc trên-phải, dải đầu "● TIN THỊ TRƯỜNG · 01/04", viền màu nhấn + quầng,
  phóng chậm 1.03 → 1.13 suốt cảnh. Không ảnh → không có thẻ, biểu đồ chiếm trọn khung.
- Bố cục: 9:16 xếp dọc (thanh đầu → cột trái + thẻ ảnh → vùng biểu đồ → khung phụ đề → dải mã chạy); 16:9/1:1
  biểu đồ bên trái, thẻ ảnh + bảng giá cột phải, khung phụ đề trải ngang dưới cùng.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | ảnh/clip trong thẻ "TIN THỊ TRƯỜNG" góc trên-phải (clip qua `SceneMedia`, tắt tiếng, lặp), trượt vào từ phải, mờ ra khi sang cảnh; null → chỉ biểu đồ |
| `tag` | chip mã kiểu bảng điện "◆ VN-INDEX" in hoa, vạch màu nhấn trái, góc trên-trái vùng nội dung; tự co chữ khi dài, quá bề rộng cột thì cắt "…" |
| `punch` | đúng `atMs`: đường giá vọt ~3% trong 8 frame (rồi hồi lại 40%), loé xanh quanh đầu đường, ô % trên thanh đầu đổi khối đặc; bong bóng chú thích màu tăng (giảm nếu cảnh đi xuống) nảy lên, **ghim vào đỉnh cú vọt** có mũi nhọn + hình thoi + vạch dọc đánh dấu, giữ tới hết cảnh; cụm đó trong câu phụ đề được tô nền xanh |
| `visual` stat | ô số liệu: "▲ TĂNG TRƯỞNG" / "▼ SỤT GIẢM", số cực lớn đếm từ 0 (giữ tiền tố/hậu tố và kiểu dấu "1.250" / "2,35"), sparkline tự vẽ, chú thích dưới; 9:16 nằm dưới thẻ ảnh bên trái, ngang nằm dưới chip mã |
| `visual` badge | ô khuyến nghị: nhãn chữ in hoa trong viền màu nhấn ("MUA", "NẮM GIỮ") + chú thích, bật lên |
| `captions` | khung "■ BẢN TIN · 09:15:05 … 02/04" ở một phần ba dưới, Lexend 600, cao cố định theo câu dài nhất (≤ 4 dòng), chữ căn giữa theo chiều dọc; số + đơn vị theo sau ("25 điểm", "30 tỷ", "15%") tô xanh, số đứng trong 3 từ sau "giảm/lỗ/mất…" hoặc có dấu trừ tô đỏ |
| `title` | 70 frame đầu: màn "PHIÊN MỞ CỬA" — thẻ tối viền xanh trên cùng, chip nháy, `title` Lexend 800, gạch màu nhấn chạy ra, `subtitle`, dòng `handle · PHIÊN SÁNG · 09:15 · MÃ ▲`; biểu đồ bắt đầu vẽ phía sau |
| `subtitle` / `title` | từ bỏ dấu làm mã cho dải chạy dưới đáy (3–4 chữ, giá và % seed — rõ là minh hoạ) |
| `captionPosition` | "center" đặt khung phụ đề quanh 58% chiều cao |

## Chuyển động

- Easing `bezier(0.16, 1, 0.3, 1)` cho mọi thứ hiện ra; bong bóng câu nhấn và ô khuyến nghị dùng `back(1.8)`.
- Biểu đồ chạy liên tục, không bao giờ dừng; đầu đường nội suy giữa các điểm nên trượt mượt từng frame.
- Đổi cảnh: thẻ ảnh/chip/ô số liệu cũ mờ trong 12 frame, cái mới trượt vào 14–16 frame. Cảnh đầu có title thì đợi
  màn mở phiên xong. Mỗi câu phụ đề mới trượt lên + hiện trong 9 frame.
- Dải mã chạy 3,2 đơn vị/frame, mỗi mục rộng cố định nên lặp liền không cần đo chữ.

## Lỗi cần tránh

- `punch` và `visual` trong CÙNG một cảnh ở 9:16 dễ chồng nhau (bong bóng ở trên đỉnh đường, ô số liệu ngay dưới
  thẻ ảnh) — tách ra hai cảnh.
- Cụm `punch` không có nguyên văn trong câu thì vẫn có bong bóng nhưng câu không được tô.
- `punch` dài > 6 từ → bong bóng hai dòng, che bớt biểu đồ.
- Stat quá dài (> 8 ký tự, "1.250.000 tỷ") → số co nhỏ, sparkline sát mép. Viết gọn "1,25 triệu tỷ" thành "1,25" + chú thích.
- Nội dung đi xuống nhưng câu nhấn không có từ giảm → đường vẫn vọt lên xanh. Muốn đỏ thì câu nhấn/stat phải có
  "giảm, lỗ, mất, sụt…" hoặc số âm.
- Tag dài hơn ~14 ký tự bị cắt "…" ở cột trái 9:16.
- Đây là hình minh hoạ: mã, giá, khối lượng, dải mã chạy đều bịa theo seed — không dùng làm dữ liệu thật.
- Phụ đề tuỳ chỉnh (`captionLook`) thay khung "BẢN TIN" bằng lớp phụ đề chung; biểu đồ vẫn vẽ như thường.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 4–6 cảnh, mỗi cảnh 1–2 câu ngắn giọng bản tin tài chính: rõ ràng, có số liệu, bình tĩnh (tối đa ~70 ký tự mỗi câu). Mạch: diễn biến chính → nguyên nhân → con số đáng chú ý → điều nhà đầu tư/người xem nên làm.
- Đưa con số vào câu nói ("tăng 25 điểm", "lãi 1.200 tỷ", "giảm 15%") — số và đơn vị được tô màu tự động (xanh; đứng sau "giảm, lỗ, mất" thì đỏ). Viết số theo kiểu Việt Nam: "1.200" (nghìn), "2,5" (thập phân).
- Từ chỉ chiều quyết định màu và hướng biểu đồ: dùng "tăng, vượt, lãi, kỷ lục, mua ròng" cho tin tốt; "giảm, lỗ, sụt, bán tháo, mất" cho tin xấu.
- `title` như tít tin kinh tế có mã/đối tượng ở đầu (≤ 40 ký tự, ví dụ "VN-Index vượt 1.300 điểm", "Bitcoin lập đỉnh mới") — từ đầu tiên viết hoa kiểu mã sẽ thành mã trên thanh đầu; `subtitle` là câu hỏi/gợi ý hành động.
- `tag` là mã hoặc mốc thời gian kiểu bảng điện, ≤ 12 ký tự: "VN-INDEX", "BITCOIN", "VÀNG SJC", "Q3/2025", "LÃI SUẤT", "USD/VND". Nên có ở hầu hết cảnh.
- `punch` PHẢI chép nguyên văn từ một câu của chính cảnh đó, 2–5 từ, là nhận định đắt nhất ("lập đỉnh mới", "tín hiệu tích cực", "bán tháo mạnh"). Tối đa một punch mỗi cảnh, cả video 1–3 cái; KHÔNG đặt punch cùng cảnh với visual.
- `visual` stat cho một con số chủ chốt ≤ 8 ký tự kèm chú thích: "+2,35% | tăng mạnh nhất 3 tháng", "1.200 tỷ | khối ngoại mua ròng", "-15% | cổ phiếu ngân hàng". Badge cho khuyến nghị ngắn "MUA", "NẮM GIỮ", "THẬN TRỌNG". Cả video 1–2 visual.
- Ảnh: sàn giao dịch, bảng điện, toà nhà ngân hàng, đồng tiền/vàng, logo chung chung, người làm việc với màn hình — chủ thể rõ, không chữ. Có thể để 1–2 cảnh không ảnh để biểu đồ chiếm trọn khung (hợp với cảnh có stat).
<!-- /ai-guide -->

## File

- `src/styles/finance/index.tsx` — bố cục theo tỉ lệ khung, ghép mọi lớp, thẻ ảnh, cửa sổ vào/ra của cảnh, câu nhấn, màn mở phiên
- `src/styles/finance/Chart.tsx` — biểu đồ SVG: lưới mốc giá, tham chiếu, khối lượng, đường + vùng tô, nhãn giá trên trục, màu theo xu hướng
- `src/styles/finance/Panels.tsx` — thanh đầu, bảng giá, chip mã, ô số liệu + sparkline, ô khuyến nghị, bong bóng câu nhấn, khung phụ đề, dải mã chạy
- `src/styles/finance/market.ts` — hàm thuần: chuỗi giá seed + xu hướng theo cảnh, định dạng giá/%, mã chứng khoán giả, tách câu để tô số, đọc con số stat
