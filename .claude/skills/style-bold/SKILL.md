---
name: style-bold
description: Phong cách "Phụ đề từng từ" kiểu Hormozi — ảnh/video toàn khung, chữ in hoa cực đậm viền đen bật từng cụm 2–4 từ, từ đang đọc tô vàng, từ nhấn xanh lá, nền giật phóng mỗi cụm. Dùng cho nói thẳng vào camera, bài học kinh doanh, động lực, lời khuyên gắt, bán hàng, podcast cắt ngắn.
---

# Phong cách: Phụ đề từng từ (bold / Hormozi)

`style: "bold"` trong props. Code: `src/styles/bold/`.

## Nhận diện hình ảnh

- Ảnh/video của cảnh phủ toàn khung (dùng chung `Scenes` + `Scrim`: cross-fade, Ken Burns, crop, video tắt tiếng).
  Cảnh không có ảnh → nền tối (`background` nếu đủ tối, không thì gần đen) với quầng `accent` mờ.
- Mỗi lúc CHỈ MỘT cụm 2–4 từ trên màn hình. Chữ in hoa bằng JS (`normalize("NFC").toLocaleUpperCase("vi")`),
  `FONTS.sans` đậm 900, trắng, viền đen dày (24 lớp `text-shadow` quanh chữ) + bóng đổ mềm.
- Từ đang được đọc tô vàng `#FFD93D`; từ thuộc `punch` của cảnh tô xanh lá `#22C55E` và to hơn 10%.
- Cỡ chữ lớn nhất vừa bề ngang vùng an toàn (tối đa ~112u ở khung dọc, 100u ở khung ngang), ưu tiên cả cụm
  một dòng (co tới 72%), không được thì tối đa 2 dòng.
- Vị trí: nửa dưới, trên dải UI của nền tảng (`captionBottom` + đệm), hoặc chính giữa khi `captionPosition: "center"`.
- Thanh tiến độ mảnh màu vàng ở mép trên vùng an toàn; tag là pill trắng chữ đen ngay dưới nó.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu tách từ, gom cụm 2–4 từ (ngắt sau dấu câu, cụm ≲ 16 ký tự). Từ thứ k hiện ở `startMs + offset/len × 85% thời lượng`; cụm đổi khi từ đầu cụm mới tới lượt |
| `punch` | các từ trùng `punch.text` trong câu (không phân biệt hoa thường) → xanh lá, to 110%. Cảnh nào có `atMs` gần giữa câu nhất thắng |
| `tag` | pill trắng chữ đen in hoa ở `safe.top`, bật vào đầu cảnh |
| `visual` stat | số vàng khổng lồ viền đen ở một phần ba trên, đếm lên (giữ tiền tố/hậu tố: `80%`, `+30K`, `1.200`, `2,5 triệu`); `caption` in hoa nhỏ bên dưới |
| `visual` badge | pill vàng viền đen chữ đen, nghiêng nhẹ, ở một phần ba trên; `caption` bên dưới |
| `image` | nền toàn khung; `null` → nền tối + quầng accent |
| `title`/`subtitle`/`handle` | title card 70 frame: tiêu đề in hoa bật từng từ, thanh vàng quét sau từ cuối, phụ đề trượt lên (bỏ nếu trùng tiêu đề), handle ở đáy |
| `captionPosition` | `bottom` = nửa dưới, `center` = giữa khung |
| `showTitle` | bật title card; phụ đề, tag, visual bị ẩn tới hết frame 70 |

Không có caption nào → tiêu đề làm chữ chính (tối đa 3 dòng, từ cuối vàng). Âm thanh, watermark, chữ tự do do
composition `Short` vẽ — phong cách này không đụng tới.

## Chuyển động

- Mỗi từ bật: scale 0.6 → 1.08 → 1 trong 6 frame (ease-out cubic rồi in-out quad), opacity 0 → 1 trong 1 frame.
  Chỉ các từ đã tới lượt được xếp, nên cụm lớn dần từ giữa; cỡ chữ tính trên cả cụm nên không co giãn.
- Đổi cụm là cắt thẳng (không fade) — đúng chất "jump-cut".
- Nền (ảnh + nền tối) phóng xen kẽ 1.00 / 1.05 theo chỉ số cụm toàn video, tức thì, tâm phóng lệch nhẹ theo `seeded()`.
- Title card: mỗi từ bật cách nhau ≤ 3 frame, thanh vàng quét ngang 6 frame, 10 frame cuối co 12% và mờ hẳn.
- Stat đếm lên trong ~24 frame; tag/badge nảy 0.5 → 1.08/1.1 → 1.

## Lỗi cần tránh

- Punch không chép nguyên văn từ lời đọc → không khớp, không có chữ xanh.
- Punch dài cả câu → cả cụm xanh, mất điểm nhấn.
- Câu quá dài không dấu câu → cụm cắt theo số ký tự, có thể tách đôi cụm từ có nghĩa. Đặt dấu phẩy chỗ muốn ngắt.
- Đừng dùng `FONTS.condensed`, CSS `text-transform: uppercase` hay `letter-spacing` cho chữ in hoa: móc Ư/Ơ bị
  tách rời. Đổi font/viền là phải render still kiểm "ĐỪNG THƯỜNG ƯU ƠN NHỮNG".
- Không đặt `overflow: hidden` quanh khối chữ — cắt mất dấu của dòng trên và viền.
- Không thêm blur/filter động toàn khung; cú phóng nền là `scale` tức thì, không animate.
- Stat quá 16 ký tự bị schema chặn; số dài chữ sẽ nhỏ lại.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- 3–6 cảnh, mỗi cảnh 1–3 câu; tổng 6–12 câu. Giọng nói thẳng vào người xem như đang nói trước camera.
- Câu ngắn, rõ nhịp: 5–12 từ (tối đa ~60 ký tự). Phụ đề hiện từng cụm 2–4 từ nên câu phải đọc trôi khi bị chặt nhỏ;
  đặt dấu phẩy ở chỗ muốn ngắt cụm. Tránh câu dài nhiều mệnh đề, tránh ngoặc đơn và ký hiệu lạ.
- Câu đầu là hook gắt (phủ định, con số, lời thách: "Đừng làm việc chăm chỉ nữa."); câu cuối là call-to-action ngắn.
- `punch`: 1–3 từ đắt nhất của cảnh, PHẢI chép nguyên văn từ một câu của chính cảnh đó (đúng dấu, đúng thứ tự);
  mỗi cảnh tối đa một punch; `atMs` là lúc từ đó được đọc. Không chọn hư từ ("là", "của", "thì").
- `tag`: nhãn ≤ 16 ký tự cho ngữ cảnh ("Sai lầm #1", "Bài học 3", "Sự thật") — không lặp lời đọc; không bắt buộc mọi cảnh.
- `visual` stat khi cảnh có một con số đáng nhớ ("80%", "+30K", "2,5 triệu"); badge cho nhãn bước ("Bước 1").
  Dùng cho 1–2 cảnh, không phải cảnh nào cũng có.
- `image`: nên có ảnh/video thật (người nói, sản phẩm, bối cảnh) cho phần lớn cảnh vì nền là toàn khung;
  `null` cho cảnh thuần ý tưởng hoặc cảnh có stat — nền tối giúp số nổi bật.
- Tránh câu rào đón, tránh giọng văn viết; nói như người thật, dứt khoát, có động từ mạnh.
<!-- /ai-guide -->

## File

- `src/styles/bold/index.tsx` — ghép lớp, chọn cụm và từ đang đọc, cú phóng nền theo cụm, vị trí phụ đề
- `src/styles/bold/Words.tsx` — vẽ một cụm: chữ trắng viền đen, màu vàng/xanh, bật từng từ
- `src/styles/bold/Overlays.tsx` — nền tối không ảnh, thanh tiến độ, tag, stat/badge
- `src/styles/bold/TitleIntro.tsx` — title card với thanh highlight vàng
- `src/styles/bold/text.ts` — in hoa, tách từ, dò punch, gom cụm, đo và co cỡ chữ, viền, đọc/format con số
