---
name: style-map
description: Phong cách "Bản đồ hành trình" — tấm bản đồ minh hoạ vẽ tay (biển xanh xám, đất màu giấy có vòng sóng quanh bờ, lưới kinh vĩ tuyến, la bàn chữ "B", khung viền, nếp gấp giấy), mỗi cảnh một điểm dừng: máy bay kéo đường gạch từ ghim trước sang, camera bay theo rồi sà vào, ghim cắm xuống có số thứ tự, nhãn địa danh bật ra, ảnh/clip thành bưu thiếp có tem, con số thành viên "1.700 km" gắn vào chặng, câu nhấn là con dấu "ĐÃ ĐẾN" + vòng khoanh quanh ghim, bảng phụ đề giấy "CHẶNG 02 / 05" dưới đáy, mở đầu bản đồ mở ra với khung cartouche. Dùng cho lịch trình du lịch, phượt, road trip, food tour theo vùng, sự thật địa lý, hành trình lịch sử, "đi từ A đến B".
---

# Bản đồ hành trình

## Nhận diện hình ảnh

- Bản đồ vẽ hoàn toàn bằng SVG, không tile, không mạng: biển `#cfdcd3`, đất giấy kem `#f3e7c9`, bờ biển nét nâu mực,
  ba vòng sóng mảnh quanh mọi bờ (kiểu bản đồ cổ), lưới kinh vĩ tuyến gạch đứt, núi tam giác gạch bóng, nét sóng "〰"
  trên biển. Đất liền là các mảng méo bằng tổng sóng sin có seed theo `title` — cùng video cùng bản đồ.
- Khung viền bản đồ nét đôi + dải chia độ, góc vuông nhỏ; la bàn 8 cánh chữ "B" (Bắc), cánh bắc màu nhấn;
  viền tối mép giấy, nếp gấp giấy mờ (dọc 1/3, 2/3, ngang 1/2), nhiễu giấy nhẹ.
- Chữ: **Be Vietnam Pro** cho địa danh, lời đọc, nhãn; **Playfair Display** cho tiêu đề trong cartouche.
  Cả hai đóng gói sẵn, đủ dấu, nạp bằng `ensureFonts`.
- Màu nhấn: ghim đang đứng, đường chặng (trộn mực), tem thư, con dấu, vòng khoanh, bút dạ câu nhấn, dải mép bảng phụ đề.
- Bố cục: dọc — bưu thiếp trên, ghim giữa (nhãn bên phải), bảng phụ đề dưới; ngang — bản đồ + bảng phụ đề bên trái,
  bưu thiếp bên phải; vuông — bưu thiếp góc trên phải, ghim trái (nhãn dưới ghim), bảng phụ đề ngang đáy.
- Hành trình luôn đi về hướng đông-bắc có lượn, nên ghim trước nằm dưới-trái ghim hiện tại và chặng vừa đi không bị
  bưu thiếp che. Đây là bản đồ tượng trưng — vị trí KHÔNG khớp địa lý thật.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| Thứ tự cảnh | Mỗi cảnh là một điểm dừng, ghim đánh số 1, 2, 3…; điểm dự kiến phía trước là vòng rỗng nối bằng chấm mờ. |
| `image` | Bưu thiếp viền trắng bo góc, nghiêng ±1.5–3.5°, tem răng cưa màu nhấn mang số chặng + dấu bưu điện, ảnh phóng chậm 1.03 → 1.12. Video: phát trong bưu thiếp, tắt tiếng, lặp. Bưu thiếp bật ra từ ghim, sang chặng sau thì thu về ghim cũ. `null` → **chỉ bản đồ**: camera phóng gần hơn, ghim to hơn, nhãn địa danh to canh giữa dưới ghim. |
| `tag` | Nhãn địa danh của ghim: thẻ giấy viền mực, phần trước dấu `·` là tên (đậm, to), phần sau là dòng phụ màu nhấn ("Đà Lạt · Ngày 2"). Ghim đã qua giữ nhãn nhỏ chỉ có tên. Không có → chỉ ghim. |
| `captions` | Bảng giấy dưới đáy, mỗi lúc một câu, co chữ nếu dài (tối thiểu 28px); đầu bảng "CHẶNG n / tổng" + hàng chấm hành trình (≤ 12 chấm, nhiều hơn thành thanh). |
| `punch` | Các từ khớp nguyên văn trong câu được bút dạ màu nhấn quét lúc `atMs`; đồng thời con dấu cao su nghiêng đập xuống (góc dưới trái bưu thiếp, hoặc phía trên ghim khi không ảnh): dòng nhỏ "ĐÃ ĐẾN · CHẶNG 02" + câu nhấn in hoa (câu nhấn > 24 ký tự thì chữ lớn là "ĐÃ ĐẾN!"); vòng khoanh tay vẽ dần quanh ghim. |
| `visual` stat/badge | Viên mực đậm có vòng màu nhấn + biểu tượng (thước cho km/m, đồng hồ cho ngày/giờ/phút, cờ cho còn lại) + con số + chú thích; nối bằng dây chấm tới giữa chặng vừa đi (cảnh đầu: tới ghim). Tự chọn chỗ trống quanh điểm neo, tránh nhãn, ghim, bưu thiếp, bảng phụ đề. |
| `title`/`subtitle` | Khi `showTitle`: bản đồ mở ra (ngang rồi dọc, nếp gấp đậm), camera nhìn toàn hành trình dự kiến, khung cartouche giấy có hoa văn góc: "✦ HÀNH TRÌNH ✦", tiêu đề Playfair, gạch đứt có hình thoi màu nhấn, dòng phụ. |

## Chuyển động

- Mở đầu (70 frame): 0–12 bản đồ mở ngang, 6–18 mở dọc; 12–26 cartouche cuộn mở, chữ hiện dần;
  48–66 cartouche bay lên mờ đi trong lúc camera sà từ toàn cảnh vào điểm 1; frame 58–68 ghim 1 cắm xuống (nảy), gợn tròn loang.
- Sang cảnh: trong ~42% thời lượng cảnh (10–36 frame) máy bay bay theo đường cong, đường gạch lộ dần phía sau, camera
  trượt theo và lùi ra ~22% giữa đường rồi sà vào; ghim cũ thu nhỏ đổi màu, bưu thiếp cũ thu về ghim cũ.
- Khi tới: ghim rơi nảy + gợn tròn, nhãn bật, bưu thiếp bật ra từ ghim (xoay về độ nghiêng riêng), viên số trượt ra
  theo dây nối; lúc dừng camera phóng thêm 4% rất chậm.
- Câu nhấn: con dấu phóng 2.2× → đập xuống nảy nhẹ; vòng khoanh vẽ dần 16 frame; bút dạ quét lần lượt từng từ trong 12 frame.
- Phụ đề mờ dần + trượt lên 8 frame mỗi câu. La bàn rung kim nhẹ.

## Lỗi cần tránh

- `tag` quá dài (> ~20 ký tự tên chính) làm nhãn co chữ, xuống 2 dòng; nhãn đã qua bị cắt sau 18 ký tự.
- Đừng ghi "Chặng 1" trong `tag` — số chặng đã có trên ghim, bảng phụ đề và con dấu.
- `punch` > 24 ký tự thì con dấu chỉ ghi "ĐÃ ĐẾN!" (câu vẫn được tô trong phụ đề); `punch` phải có nguyên văn trong câu.
- `visual.text` tối đa 16 ký tự, nên là quãng đường/thời gian ("1.700 km", "3 ngày") để chọn đúng biểu tượng.
- Cảnh quá ngắn (< 1.5 giây) gần như chỉ thấy máy bay bay — mỗi cảnh nên ≥ 3 giây.
- Hơn ~10 điểm dừng thì toàn cảnh mở đầu nhỏ và rối; chia video.
- Phụ đề nằm trong bảng giấy của bản đồ nhưng không phải nội dung trang — vẫn cho phép kiểu phụ đề tuỳ chỉnh (khi đó
  composition tự vẽ phụ đề đè lên, bảng giấy vẫn còn).

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Mỗi cảnh là MỘT điểm dừng theo đúng thứ tự đi: thành phố, địa danh, món ăn của vùng, mốc của chiến dịch lịch sử.
  4–7 cảnh là đẹp nhất; cảnh đầu là điểm xuất phát, cảnh cuối là đích đến + cảm nhận/lời kêu gọi.
- Tiêu đề nêu hành trình ("Xuyên Việt 5 ngày bằng xe máy", "Food tour 3 miền"); dòng phụ liệt kê các điểm ngăn bằng " · "
  ("Hà Nội · Huế · Đà Lạt · Sài Gòn").
- `tag` BẮT BUỘC cho mọi cảnh: tên địa điểm, có thể thêm " · " + ngày/mốc — "Hà Nội · Ngày 1", "Đèo Hải Vân", "Hội An · 1999".
  Tối đa ~20 ký tự cho tên. Không ghi "Chặng 1".
- 1–3 câu mỗi cảnh, mỗi câu dưới 70 ký tự, kể điều thấy/làm/ăn ở điểm đó, có chi tiết cụ thể (giờ, món, cảnh).
- `punch`: chép NGUYÊN VĂN 2–4 từ đắt nhất của cảnh (tối đa 24 ký tự) — sẽ thành con dấu "ĐÃ ĐẾN · CHẶNG n" trên bưu thiếp.
  Khoảng 1 cảnh / 2 cảnh có punch, không phải cảnh nào cũng có.
- `visual` stat: quãng đường hoặc thời gian của chặng vừa đi — "660 km", "12 giờ", "3 ngày", "1.700 km" — caption ngắn
  ("đi xe khách đêm", "tổng quãng đường"). Đặt ở cảnh thứ 2 trở đi (gắn vào đường nối từ điểm trước).
- Ảnh: phong cảnh/đặc sản/con người đúng địa điểm, ảnh ngang hoặc vuông. Cảnh chuyển tiếp (đèo, biên giới, vượt biển)
  có thể để không ảnh — chỉ bản đồ với nhãn to.
<!-- /ai-guide -->

## File

- `src/styles/map/index.tsx` — bố cục theo tỉ lệ khung, nhịp từng điểm dừng, camera, chọn chỗ cho viên số, ghép các lớp.
- `src/styles/map/geo.ts` — hành trình có seed, đường cong chặng, đất liền/núi/sóng, camera, màu và font.
- `src/styles/map/Terrain.tsx` — lớp bản đồ theo camera: lưới, vòng sóng, bờ biển, đất, núi, đường dự kiến, chặng đã/đang đi.
- `src/styles/map/parts.tsx` — ghim, nhãn, máy bay, bưu thiếp + tem, viên số, con dấu, vòng khoanh, la bàn, khung viền, nếp gấp.
- `src/styles/map/Panel.tsx` — bảng phụ đề "CHẶNG n / tổng" và khung tiêu đề cartouche.
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
