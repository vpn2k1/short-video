---
name: style-tech
description: Phong cách "Công nghệ tối giản" — nền navy tối, thẻ kính nổi phát sáng, con số chạy, câu nhấn gradient neon. Dùng cho công nghệ, sản phẩm số, số liệu, so sánh, AI, tài chính, startup.
---

# Công nghệ tối giản (tech)

## Nhận diện hình ảnh

- Nền navy gần đen (radial-gradient), ma trận chấm trôi chậm, sàn lưới phối cảnh ở nửa dưới,
  hai quầng sáng: một theo `accent`, một cyan/tím. Hạt nhiễu rất nhẹ (`<Grain opacity={0.05}/>`).
- Bảng màu cố định ngoài `accent`: cyan `#22d3ee`, tím `#8b5cf6`, chữ `#eaf2ff`.
  Prop `background` KHÔNG dùng — phong cách luôn tối.
- Chữ: `FONTS.sans` cho phụ đề (600) và câu nhấn (800); `FONTS.mono` cho tag, số cảnh, chú thích stat.
- Bố cục:
  - Dọc (9:16, 3:4): thanh tiến độ → hàng tag → thẻ kính → câu nhấn → phụ đề.
  - Ngang/vuông (16:9, 2:1, 1:1): thanh tiến độ trên cùng; cột trái (tag, tiêu đề mờ, câu nhấn,
    phụ đề), thẻ kính bên phải.
- Chiều cao vùng câu nhấn và phụ đề tính trước từ toàn bộ dữ liệu (`estimateLines`) nên bố cục
  không nhảy giữa các câu.

## Dữ liệu được dùng thế nào

- `image`: nằm trong thẻ kính bo góc, viền 1px, highlight chéo, quầng sáng màu phía sau.
  Video (.mp4/.mov/.webm) phát muted + loop trong `<Sequence from={start}>`.
  `null` → màn hình trừu tượng (lưới mảnh, vòng tròn lan, số cảnh mờ).
- `tag`: chip mono có chấm accent nhấp nháy, góc trên trái vùng an toàn. `null` → không vẽ.
- `punch`: chữ gradient accent → cyan có quầng sáng, hiện đúng frame `atMs` (sớm nhất 6 frame sau
  khi cảnh vào), giữ tới hết cảnh, có vệt sáng quét qua một lần.
- `visual`:
  - `stat`: panel kính với bộ đếm (tách số đầu tiên, hiểu `2,5` / `2.5` là thập phân,
    `1.000.000` là hàng nghìn, giữ nguyên tiền tố/hậu tố `%`, `x`, `K`, `triệu`, `₫`) và vòng
    tiến độ — hậu tố `%` thì vòng dừng ở đúng tỉ lệ, còn lại chạy đủ vòng.
  - `badge`: viên viền neon chữ mono in hoa.
  - Dọc: panel đè lên mép dưới thẻ; ngang: đè góc dưới trái thẻ.
- `captions`: viên kính; chữ sáng dần theo tiến độ đọc (ước theo số ký tự), từ đang đọc ánh
  cyan, vạch mảnh ở đáy chạy theo thời lượng câu. Tối đa 4 dòng giữ chỗ.
- `title/subtitle` (khi `showTitle`): dòng `> intro` gõ kiểu terminal, tiêu đề gradient, vạch sáng
  nở, subtitle mờ vào; biến mất ở frame ~56–70. Khung ngang còn in `title` mờ dưới tag.
- `captionPosition` bị bỏ qua — vị trí phụ đề do bố cục quyết định.

## Chuyển động

- Chuyển cảnh: trượt ngang 90u + fade + scale 0.94→1, vào 16 frame (ease-out), ra 12 frame
  (ease-in) chồng lên cảnh sau. Không dùng TransitionSeries (sẽ rút ngắn timeline).
- Thẻ nghiêng 3D nhẹ (rotateX ±2.6°, rotateY ±3.4°) theo sin của frame; ảnh dịch ngược chiều
  (parallax) + phóng chậm 2→7%.
- Bộ đếm stat chạy 42 frame, bắt đầu ~16 frame sau khi cảnh vào.
- Nền: chấm và lưới trôi tuyến tính, quầng sáng lượn chậm.

## Lỗi cần tránh

- Không `backdrop-filter`, không blur lớn trên lớp toàn khung — kính là fill bán trong suốt.
  Blur duy nhất là quầng sáng sau chữ câu nhấn (phần tử nhỏ).
- `interpolate` luôn qua `ramp(frame, from, length)` — mốc tăng nghiêm ngặt, đã kẹp.
- Cảnh cuối không có lối ra; cảnh đầu vào sau title card nếu `showTitle`.
- Stat có chữ quá dài (≤16 ký tự theo schema) sẽ tự co cỡ số theo bề rộng panel.
- Khung 1:1 cột chữ hẹp: phụ đề nhỏ (~30px) — câu nên ngắn.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Mỗi cảnh 1–3 câu ngắn, rõ ràng, có dữ kiện: con số, tên tính năng, so sánh trước/sau. Tránh câu kể lể cảm xúc.
- `tag` là nhãn trạng thái/chỉ số kiểu giao diện, ≤18 ký tự: "Pin 50%", "Bước 2/5", "iOS 18", "Chi phí -30%".
- `punch` PHẢI chép nguyên văn từ một câu thoại của chính cảnh đó, 2–5 từ, là cụm đắt nhất (tên tính năng, kết luận, con số kèm đơn vị).
- Dùng `visual` kiểu `stat` thật nhiều khi có số cụ thể: "80%", "2,5x", "120K", "3 triệu", "1.000.000₫" — bộ đếm chạy là điểm nhấn của phong cách. Thêm `caption` ngắn giải thích con số.
- `badge` cho nhãn bước hoặc phiên bản ("Mẹo 1", "PRO", "Mới").
- Ảnh: sản phẩm, màn hình app, thiết bị, dashboard, cận cảnh công nghệ; tối màu hoặc nền gọn là đẹp nhất. Không có ảnh phù hợp thì để `image: null` — thẻ trừu tượng vẫn đẹp.
- Giọng tự tin, hiện đại, đi thẳng vào giá trị; câu phụ đề ≤ 90 ký tự.
<!-- /ai-guide -->

## File

- `src/styles/tech/index.tsx` — `TechStyle`, bố cục dọc/ngang, ghép các lớp.
- `src/styles/tech/theme.ts` — màu, easing, `ramp`, `sceneWindow`/`sceneTransition`, `parseStat`, `estimateLines`.
- `src/styles/tech/Background.tsx` — nền, lưới, quầng sáng.
- `src/styles/tech/SceneCard.tsx` — thẻ kính ảnh/video, màn hình trống.
- `src/styles/tech/Overlays.tsx` — thanh tiến độ, chip tag, câu nhấn, panel stat/badge.
- `src/styles/tech/Caption.tsx` — phụ đề trong viên kính.
- `src/styles/tech/TitleIntro.tsx` — title card.
