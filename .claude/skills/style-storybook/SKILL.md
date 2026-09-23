---
name: style-storybook
description: Phong cách "Sách truyện" — sách tranh thiếu nhi, tranh minh hoạ khung bo tròn viền trắng, ruy băng tên trang, chữ tròn to, từ đang đọc sáng màu nhấn và nảy lên, góc trang cuộn lên khi sang trang, bìa "Ngày xửa ngày xưa…". Dùng cho truyện cổ tích, truyện thiếu nhi, kể chuyện trước giờ ngủ, ngụ ngôn, bài học cho bé.
---

# Sách truyện

## Nhận diện hình ảnh

- Khung bìa pastel (màu nhấn pha trắng), trang giấy kem `#fff7e8` bo góc lớn, vài ngôi sao và chấm tròn nhấp nháy ở mép.
- Tranh minh hoạ trong khung bo tròn 44px, viền trắng dày, bóng mềm, trôi lên xuống rất nhẹ.
- Chữ **Baloo 2** (tròn, đóng gói, đủ dấu), đậm, căn giữa, màu nâu `#4a3426`. Câu mở bìa "Ngày xửa ngày xưa…" viết bằng Dancing Script.
- Dọc: tranh trên (~56% chiều cao), chữ dưới. Ngang: tranh trái, chữ phải.
- Màu nhấn: ruy băng, từ đang đọc, cụm punch, nhãn tròn răng cưa.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Tranh trong khung bo tròn, phóng chậm. Video: phát trong khung, tắt tiếng, lặp. `null` → trang chỉ có chữ (và nhãn nếu có). |
| `tag` | Ruy băng màu nhấn hai đuôi chữ V, đè lên mép trên của tranh (hoặc đầu trang nếu không có tranh). |
| `captions` | **Mỗi lúc một câu**, to, căn giữa vùng chữ. Từ đang đọc sáng màu nhấn, nảy lên; từ chưa đọc mờ 38%. Mốc từng từ chia 90% thời lượng câu theo độ dài từ. |
| `punch` | Có nguyên văn trong câu: các từ đó chuyển màu nhấn, lắc lư, sao bắn ra quanh câu lúc `atMs`. Không khớp → thành nhãn tròn (khi cảnh không có `visual`). |
| `visual` stat/badge | Nhãn tròn răng cưa màu nhấn, chữ trắng. Có tranh: đè góc dưới phải tranh. Không tranh: to, là hình chính của trang. |
| `title`/`subtitle` | Khi `showTitle`: bìa truyện có trăng khuyết, "Ngày xửa ngày xưa…", tiêu đề màu nhấn viền trắng, dòng phụ. Frame 66 góc bìa cuộn lên. |

## Chuyển động

- Sang cảnh: góc dưới phải trang cũ cuộn lên theo đường gập chéo, chạy về góc trên trái trong 22 frame; nếp gập
  là mặt sau tờ giấy (phản chiếu phần bị cắt qua đường gập), có bóng. Hình học phẳng (`curl.ts`): clip-path + SVG.
- Trang mới in sẵn tranh + ruy băng khi lộ ra; chữ bắt đầu sau 11 frame.
- Ruy băng, nhãn tròn bật vào kiểu nảy (`Easing.back`).

## Lỗi cần tránh

- Câu dài hơn ~70 ký tự làm chữ co nhỏ — trẻ nhỏ đọc kém. Tách câu.
- `tag` dài hơn ~20 ký tự làm ruy băng tràn ngang tranh.
- Không có mốc từng từ thật: từ sáng lên theo ước lượng độ dài — giọng đọc quá nhanh/chậm sẽ lệch nhẹ.
- Phụ đề là nội dung trang nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng kể chuyện cho trẻ nhỏ: câu ngắn, từ đơn giản, ấm áp, có nhân vật và tên gọi dễ thương ("chú thỏ con", "bạn sóc").
- Mỗi cảnh là một trang truyện: 2–3 câu, mỗi câu dưới 60 ký tự, một hành động rõ ràng.
- Cấu trúc truyện: mở đầu ("Ngày xửa ngày xưa…") → sự việc → bài học nhẹ nhàng ở trang cuối. Câu mở đầu gộp luôn điều
  kỳ lạ của truyện để bé tò mò: "Ngày xửa ngày xưa, có một chú rùa sợ nước." — không chỉ "Ngày xửa ngày xưa, có một khu rừng."
- `tag`: tên trang ngắn, tối đa 18 ký tự — "Ngày xửa ngày xưa", "Một buổi sáng", "Từ hôm đó".
- `punch`: chép NGUYÊN VĂN 1–4 từ trong một câu của cảnh — hành động hoặc cảm xúc chính, sẽ sáng màu và bắn sao.
- `visual` badge cho con số hay chữ ngắn vui ("3 củ", "Bùm!") kèm caption ngắn.
- Ảnh: tranh minh hoạ nhân vật dễ thương, màu ấm, bối cảnh đơn giản.
- Kết bằng bài học một câu hoặc lời chúc ngủ ngon.
<!-- /ai-guide -->

## File

- `src/styles/storybook/index.tsx` — trang giấy, tranh, ruy băng, nhãn tròn, chữ đọc theo, bìa truyện.
- `src/styles/storybook/curl.ts` — hình học lật trang cuộn góc (cắt nửa mặt phẳng, nếp gập phản chiếu).
- `src/styles/media.tsx` — ảnh/clip của cảnh trong khung (dùng chung).
