---
name: style-blueprint
description: Phong cách "Bản vẽ kỹ thuật" — tờ giấy can xanh có lưới ô, nếp gấp, khung viền chia ô và khung tên góc dưới phải (tên bản vẽ, BẢN VẼ SỐ 01, TỈ LỆ 1:1, NGƯỜI VẼ, TỜ n/m); ảnh/clip đặt như ảnh tham chiếu trong khung nét trắng đổi tông xanh–trắng, dấu canh góc, đường kích thước có mũi tên tự vẽ; phụ đề là mục GHI CHÚ đánh số tròn gõ từng dòng có gạch chân, số chỉ dẫn tương ứng bật trên ảnh; tag là ký hiệu "MẶT CẮT A-A"; câu nhấn đổi màu cam an toàn và được khoanh đám mây sửa đổi kèm tam giác "!"; số liệu là đường kích thước lớn |←— 120 m —→|; không ảnh thì sơ đồ bánh răng/khối lập phương/mặt bích vẽ bằng nét; sang cảnh bằng vạch quét. Dùng cho giải thích cách mọi thứ hoạt động, kỹ thuật, kiến trúc, phát minh, DIY/xây dựng, khoa học, giải phẫu sản phẩm.
---

# Phong cách: Bản vẽ kỹ thuật (blueprint)

`style: "blueprint"` trong props. Code: `src/styles/blueprint/`.

## Nhận diện hình ảnh

- Giấy can xanh `#0d3d7c` (giữa sáng hơn, góc tối), lưới ô phụ 27px + ô chính 135px trắng mờ, nếp gấp giấy (một vệt tối cạnh một vệt sáng), nhiễu giấy nhẹ.
- Khung bản vẽ: viền ngoài mảnh + viền trong đậm, giữa hai viền là số cột 1 2 3… và chữ hàng A B C… như bản vẽ thật.
- Khung tên góc dưới phải: TÊN BẢN VẼ (tiêu đề in hoa), BẢN VẼ SỐ 01 (màu nhấn), NGƯỜI VẼ (handle), TỈ LỆ 1:1, TỜ 02 / 05 (đổi theo cảnh).
  Dọc/vuông có thêm thước tỉ lệ đen trắng bên trái khung tên.
- Ảnh/clip = "ảnh tham chiếu": xám hoá tăng tương phản, bóng tối thành xanh đậm, vùng sáng thành trắng xanh (screen + multiply),
  lưới mảnh in chồng; khung nét trắng đôi, dấu canh góc (vòng tròn chữ thập) chéo ra bốn góc, đường kích thước ngang phía trên và dọc
  bên phải với số đo "mm" suy từ kích thước khung, chú thích "HÌNH 01 — ẢNH THAM CHIẾU" / "VIDEO THAM CHIẾU" / "SƠ ĐỒ NGUYÊN LÝ".
- Chữ: **Lexend** (nhãn, tiêu đề, khung tên, số lớn — in hoa bằng `toLocaleUpperCase("vi")`), **Roboto** 500 (ghi chú),
  stack mono hệ thống `Menlo, Consolas, …, "Lexend"` cho số đo và nhãn nhỏ. Lexend/Roboto đóng gói, nạp bằng `ensureFonts`.
- Màu nhấn = cam/vàng an toàn: `accent` chỉ được giữ nếu là cam–vàng (hue 18°–60°, đủ đậm); đỏ, xanh, tím, xám… tự đổi sang `#ffa62b`.
- Dọc (≥ 1.2) và vuông: ký hiệu mặt cắt → khung ảnh (~54% / 48% vùng giữa) → số liệu → GHI CHÚ → khung tên.
  Ngang (≥ 1.3): khung ảnh cột trái (≤ 50% bề ngang); cột phải là số liệu, GHI CHÚ, khung tên.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | mục GHI CHÚ: mỗi câu một dòng có số tròn ①②③, gõ từng ký tự (≤ 0,8 frame/ký tự, xong trong ≤ 70% thời lượng câu) có con trỏ mảnh và gạch chân; câu cũ mờ còn 62%; cảnh nhiều chữ thì câu cũ nhất trôi mất; cỡ chữ chọn một lần cho cả cảnh |
| — | mỗi câu cũng bật một số chỉ dẫn (bóng tròn + đường dẫn tới chấm) trên ảnh, cùng số với ghi chú |
| `image` | ảnh/clip tham chiếu tông xanh–trắng trong khung (trim/speed/crop/volume của trình chỉnh sửa vẫn áp dụng), lộ dần sau vạch quét ngang |
| `image: null` | sơ đồ kỹ thuật vẽ bằng nét, xoay vòng theo cảnh: cặp bánh răng · khối lập phương trục đo có cạnh khuất · mặt bích 6 lỗ bu lông |
| `tag` | ký hiệu mặt cắt: vòng tròn chia đôi (chữ A/B/C… theo cảnh + số tờ) có mũi tên màu nhấn, nhãn nhỏ `MẶT CẮT A-A` và tag in hoa gạch chân |
| `punch` | cụm từ trong ghi chú đổi màu nhấn đậm, đám mây sửa đổi tự vẽ quanh cụm + tam giác "!" bật ra; không khớp câu nào → dòng `GHI CHÚ ⚠` riêng dưới danh sách |
| `visual` stat | đường kích thước lớn: số Lexend 700 ở giữa, hai nửa đường màu nhấn chạy ra hai đầu có mũi tên + vạch gióng, `caption` in hoa mono bên dưới |
| `visual` badge | nhãn chi tiết khung đôi, chữ in hoa màu nhấn ("CHI TIẾT 3"), bên cạnh `CHI TIẾT` + caption |
| `title` / `subtitle` / `handle` | màn mở đầu 70 frame: khung tiêu đề tự vẽ có đường kích thước "TỈ LỆ 1:1", dấu tâm hai bên, dòng "BẢN VẼ KỸ THUẬT · SỐ 01", tiêu đề in hoa lớn lộ từ trái sang, dòng phụ, "NGƯỜI VẼ: @handle"; tiêu đề + handle cũng nằm trong khung tên suốt video |
| `accent` | chỉ khi là cam/vàng (xem trên) |
| `background`, `captionPosition` | không dùng |

## Chuyển động

- Mỗi cảnh vẽ lại từ đầu: khung ảnh tự vẽ (16 frame) → ảnh lộ dần sau vạch quét → dấu canh góc xoay vào → đường gióng, đường kích thước
  chạy từ giữa ra, mũi tên, số đo → ký hiệu mặt cắt → số liệu/badge (frame 18–44 của cảnh) → ghi chú.
- Sang cảnh: một vạch trắng sáng có quầng quét dọc từ trái sang phải trong 16 frame — bên phải vạch còn tờ cũ, bên trái là tờ mới đang được vẽ.
- Sơ đồ khi không ảnh vẽ dần từng nét trong ~50 frame; đường tâm/đường khuất (nét đứt) hiện mờ dần.
- Câu nhấn: sau khi gõ tới hết cụm và giọng đọc tới `atMs`, đám mây vẽ quanh trong ~14 frame rồi tam giác "!" nảy ra.
- Màn tiêu đề nhạt đi và trôi lên 12 frame cuối; cảnh đầu bắt đầu vẽ ngay sau đó.

## Lỗi cần tránh

- Câu ghi chú quá dài (> ~90 ký tự): 3 dòng trở lên, đẩy các câu trước khỏi khối (nhất là 1:1). Tách câu.
- Punch không chép nguyên văn từ một câu trong cảnh → không có đám mây trong câu, chỉ có dòng `GHI CHÚ ⚠` riêng.
- Punch dài > ~4 từ: đám mây không bẻ dòng được (khối liền), có thể tràn mép phải.
- Stat dài > ~8 ký tự: số co nhỏ, mất vẻ "kích thước". Ghi ngắn có đơn vị: "120 m", "3,5 tấn", "0,2 mm".
- Tag dài > ~22 ký tự bị cắt "…".
- Đừng dùng CSS text-transform — in hoa bằng JS để giữ dấu Ư/Ơ. Tiêu đề dài > ~45 ký tự bị cắt trong khung tên.
- Ảnh quá sáng/ít chi tiết (bầu trời trống) thành mảng xanh nhạt phẳng — chọn ảnh có cấu trúc, đường nét rõ (máy móc, công trình, linh kiện).

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng một kỹ sư giải thích dễ hiểu: mỗi câu là một "ghi chú" trên bản vẽ, 8–16 từ (≤ 90 ký tự), nói về một bộ phận, một lực, một bước hoạt động.
- Câu đầu là hook dạng câu hỏi "vì sao/nhờ đâu" hoặc sự thật bất ngờ về cách một thứ hoạt động ("Cầu treo không đứng nhờ mặt cầu.").
- Mỗi cảnh = một bộ phận hoặc một giai đoạn của cơ chế. 4–7 cảnh, 1–3 câu mỗi cảnh.
- `tag` là tên bộ phận/mặt cắt ngắn ≤ 22 ký tự ("Cáp chủ", "Trụ tháp", "Buồng đốt") — sẽ hiện thành ký hiệu "MẶT CẮT A-A".
- `punch`: 2–4 từ là bộ phận/nguyên lý then chốt của cảnh, chép NGUYÊN VĂN từ một câu trong cảnh đó ("hai sợi cáp chủ"); tối đa một punch mỗi cảnh, không phải cảnh nào cũng cần.
- `visual` stat là một kích thước/thông số kỹ thuật có đơn vị, ngắn ≤ 8 ký tự ("120 m", "3,5 tấn", "900 °C") kèm chú thích ("chiều cao trụ tháp"); badge cho chi tiết/bước ("CHI TIẾT 3" | "Liên kết chịu lực").
- Dùng số liệu và thuật ngữ thật nhưng giải thích ngay bằng lời thường; tránh cảm thán, tránh giọng bán hàng.
- `image`: ảnh chụp công trình, máy móc, linh kiện, mặt cắt, sản phẩm tháo rời — ảnh có đường nét rõ; cảnh chỉ nói nguyên lý thì để null — sẽ thành sơ đồ vẽ bằng nét.
- Kết bằng một câu gợi quan sát hoặc ứng dụng ("Lần tới qua cầu, hãy nhìn lên hai sợi cáp ấy.").
<!-- /ai-guide -->

## File

- `src/styles/blueprint/index.tsx` — bố cục theo tỉ lệ khung, gán câu cho cảnh, vạch quét đổi cảnh, màn tiêu đề, ghép các lớp
- `src/styles/blueprint/Sheet.tsx` — giấy can (lưới, nếp gấp, tối góc), khung viền chia ô, khung tên, thước tỉ lệ
- `src/styles/blueprint/Drawing.tsx` — nét tự vẽ, đường kích thước, khung ảnh tham chiếu + lọc tông xanh, dấu canh góc, số chỉ dẫn, sơ đồ khi không ảnh, ký hiệu mặt cắt, số liệu kích thước, nhãn chi tiết
- `src/styles/blueprint/Notes.tsx` — mục GHI CHÚ gõ từng ký tự, chọn cỡ chữ, đám mây sửa đổi cho câu nhấn
- `src/styles/blueprint/theme.ts` — bảng màu, font, easing, chọn màu nhấn cam an toàn, ước lượng số dòng
