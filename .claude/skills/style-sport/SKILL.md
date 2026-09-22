---
name: style-sport
description: Phong cách "Thể thao" — giao diện truyền hình thể thao: ảnh/clip toàn khung tăng tương phản, đẩy máy nhanh đầu cảnh, đổi cảnh bằng vệt sọc chéo accent + tối quét ngang; bảng tỉ số góc trên trái (tên kênh viết tắt, đồng hồ trận chạy, chấm LIVE, HIỆP 1/2, vạch tiến độ), dải phụ đề nắp chéo hai đầu + ticker "ĐIỂM TIN", bảng tên cầu thủ có khối số áo "#10 · Quang Hải", bảng thống kê kiểu "72% kiểm soát bóng" có thanh so sánh, câu nhấn nổ kiểu "GOAL!" (sao nổ, vệt tốc độ, chớp trắng, rung 6 frame, khung "▶ PHÁT LẠI"); không ảnh thì sân vận động đêm vẽ SVG; màn mở đầu kiểu mở màn chương trình "● TRỰC TIẾP". Dùng cho tin bóng đá, highlight trận đấu, thử thách thể hình, chuyện vận động viên, kỷ lục và thành tích, dự đoán tỉ số.
---

# Phong cách: Thể thao (sport)

`style: "sport"` trong props. Code: `src/styles/sport/`.

## Nhận diện hình ảnh

- Ảnh/clip toàn khung, `contrast(1.16) saturate(1.2)`, lớp tối nhẹ phía trên (bảng tỉ số) và đậm phía dưới (dải phụ đề).
- Chữ: Anton (số, bảng tên, câu nhấn, tiêu đề) và Oswald 500–700 (phụ đề, ticker, nhãn). Cả hai là font đóng gói
  (`ensureFonts(["anton", "oswald"])`). Chỉ nhãn ngắn (tag, câu nhấn, chú thích số liệu, ticker) in hoa bằng JS; phụ đề
  và tiêu đề giữ chữ thường.
- Màu: `accent` cho mọi khối nhấn (bảng tỉ số, nắp trái dải phụ đề, khối số áo, vệt sọc, sao nổ); nền bảng xanh đen
  `#0a0e17`/`#121826`; đỏ LIVE `#ff2d3d` cố định. Chữ trên accent tự đổi đen/trắng theo độ sáng (`inkOn`).
- Bố cục:
  - Dọc (9:16, 3:4): bảng tỉ số góc trên trái; khối đáy chồng từ dưới lên: ticker → dải phụ đề → bảng tên → bảng số liệu;
    câu nhấn ở giữa-trên; chip "▶ PHÁT LẠI" góc trên phải.
  - Ngang/vuông: bảng tỉ số trên trái, bảng số liệu trên phải (tạm ẩn trong lúc câu nhấn hiện, nhường góc cho chip PHÁT LẠI),
    câu nhấn giữa, bảng tên + dải phụ đề (rộng tối đa 1240u) + ticker ở đáy trái.
- Dải phụ đề giữ chỗ bằng câu cao nhất của cả video → bảng tên và bảng số không nhảy giữa các câu.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `scenes` | mỗi cảnh một cú máy; đổi cảnh bằng vệt sọc chéo 18° (vạch trắng, khối accent, lõi tối có vân chéo, ba vệt accent mờ dần phía sau) quét trái → phải trong 16 frame, lõi che kín khung đúng frame cắt |
| `image` | ảnh/clip toàn khung qua `SceneMedia` (tôn trọng `crop`, `trimStartMs`, `speed`, `volume`); đẩy máy 1.00 → 1.08 trong 14 frame đầu rồi trườn tới 1.13 |
| `image: null` | sân vận động đêm SVG: khán đài lấm tấm đèn flash, hai cột đèn pha rọi chùm sáng lắc nhẹ, biển quảng cáo accent, sân cỏ cắt sọc phối cảnh, vạch giữa sân + vòng tròn trung tâm |
| `tag` | bảng tên: khối accent nghiêng bật lên + tấm trắng trượt ra, tên in hoa Anton, vạch accent đáy. `#10 · Quang Hải` → khối hiện "#10", tấm hiện "QUANG HẢI"; không có `#số` ("VÒNG 3", "Man City") → khối hiện biểu tượng quả bóng |
| `visual` stat | bảng thống kê: viền trên accent, chú thích in hoa, số Anton đếm lên 30 frame. Số có `%` (≤ 100) → thêm số phía đối thủ (100 − x, mờ) và thanh so sánh hai màu; số khác → gạch accent chạy dài |
| `visual` badge | khối accent nghiêng chữ in hoa + dải tối chú thích bên dưới, cùng chỗ với bảng thống kê |
| `punch` | cú nổ "GOAL!": chữ in hoa Anton nghiêng (xoay −6°, skew −12°) viền tối, bóng accent + tối lệch, lao từ 2.3× xuống trong 6 frame kèm bóng nhoè; sao nổ accent 18 cánh, vệt tốc độ bay ra hai bên; chớp trắng 70% + rung khung 6 frame lúc chạm; viền accent quanh khung + chip "▶ PHÁT LẠI". Hiện từ `atMs` (sớm nhất 4 frame sau khi cảnh vào sóng), giữ tối đa 66 frame. Cụm từ này trong phụ đề tô accent |
| `captions` | dải phụ đề tối nắp chéo hai đầu (trái accent chớp trắng khi đổi câu, phải trắng + vạch accent), Oswald 600 chữ thường, co chữ để ≤ 3 dòng; câu mới trồi lên từ dưới |
| `title`/`subtitle`/`handle` | 70 frame mở màn: nền sân vận động, tấm accent + tấm trắng + tấm tối quét vào từ hai phía, nhãn "TÂM ĐIỂM", tiêu đề là dòng tít trận đấu trên tấm tối, dòng "● TRỰC TIẾP" đỏ + dòng phụ trên tấm trắng, khối tên kênh viết tắt + handle. Hết màn, vệt sọc quét sang cảnh 1 |
| `handle` | tên kênh viết tắt trên bảng tỉ số: có dấu ngăn thì lấy chữ cái đầu (`@bong.da_24h` → "BĐ2"), không thì 3 chữ đầu; cũng chạy trong ticker |
| `accent` | màu nhấn của mọi đồ hoạ |
| `captionPosition`, `background` | bỏ qua — vị trí do bố cục truyền hình quyết định |

## Chuyển động

- Đồ hoạ "lên sóng" khi màn mở đầu rút (frame 70; tắt màn mở đầu thì từ frame 0): bảng tỉ số trượt vào từ trái,
  dải phụ đề mở từ trái sang (clip-path), ticker duỗi ra.
- Đồng hồ trận chạy theo thời gian thật từ một phút cố định theo tiêu đề (12–74 phút), qua 45:00 thì đổi "HIỆP 2";
  vạch dưới bảng là tiến độ video. Chấm LIVE nháy mỗi 15 frame.
- Ticker chạy 3.2u/frame, chuỗi lặp đủ dài cho cả video.
- Bảng tên vào 4 frame sau khi cảnh vào, bảng số 10 frame; rời ở 8 frame cuối cảnh (cảnh cuối giữ tới hết).
- Rung (±22u ngang, ±16u dọc, tắt dần 6 frame, phóng 3%) chỉ áp cho lớp hình + bảng theo cảnh; bảng tỉ số, dải phụ
  đề, ticker đứng yên như đồ hoạ truyền hình thật. Ngẫu nhiên qua `seeded()`.

## Lỗi cần tránh

- Anton/Oswald hẹp: KHÔNG dùng CSS `text-transform`/`letter-spacing` — in hoa bằng `upper()` (`toLocaleUpperCase("vi")`).
  Đã render "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" trong dải phụ đề, "QUANG HẢI", "BÀN THẮNG TUYỆT ĐẸP" — móc Ư/Ơ và dấu chồng đúng.
  `lineHeight` ≥ 1.18 + `paddingTop` ~6% để dấu chồng (Ắ, Ể) không chạm mép bảng.
- Cảnh cuối "rời sóng" dùng số lớn hữu hạn (`NEVER = 1e7`), không dùng `Infinity` — `interpolate` sẽ lỗi.
- Mọi nội suy qua `ramp(frame, from, length)` (mốc tăng nghiêm ngặt, đã kẹp).
- Vệt sọc là đa giác SVG px mỗi frame, không blur — "nhoè chuyển động" là các vệt accent mờ dần phía sau.
- Câu nhấn dài (> 3 từ) co nhỏ và xuống 2 dòng; khung ngang giới hạn cỡ chữ để không đè bảng tên.
- Câu phụ đề rất dài làm dải phụ đề cao → khối bảng tên/bảng số đẩy lên, câu nhấn ở khung dọc co lại.
- Tag dài (> 18 ký tự) làm tên co chữ.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng bình luận viên thể thao: nhanh, dứt khoát, nhiều động từ mạnh (sút, bứt tốc, lội ngược dòng, phá kỷ lục). Mở đầu bằng khoảnh khắc nóng nhất, không rào đón.
- Mỗi cảnh là một pha/diễn biến: 1–2 câu, mỗi câu ≤ 75 ký tự. 4–6 cảnh.
- `tag` là bảng tên ngắn ≤ 18 ký tự: cầu thủ kèm số áo "#10 · Quang Hải", đội "Việt Nam", vòng đấu/mốc "VÒNG 3", "PHÚT 90+2", thử thách "NGÀY 7". Số áo viết dạng "#số · Tên".
- `punch` là tiếng hô 1–3 từ như bình luận viên, PHẢI chép nguyên văn từ một câu của chính cảnh đó: "vào rồi", "siêu phẩm", "phá kỷ lục", "lội ngược dòng". Chỉ 1–3 cảnh có, dành cho pha cao trào.
- `visual` stat là con số thống kê kiểu truyền hình: tỉ lệ kiểm soát bóng "72%", "25m" khoảng cách sút, "3 bàn", "9,58 giây"; caption là tên chỉ số ngắn ("kiểm soát bóng", "tốc độ tối đa"). Số phần trăm sẽ thành thanh so sánh hai đội.
- Tiêu đề như dòng tít trận đấu ("Quang Hải lập siêu phẩm phút bù giờ"); dòng phụ là trận/địa điểm/giải ("Việt Nam gặp Thái Lan · Mỹ Đình").
- Ảnh: pha bóng, cầu thủ ăn mừng, khán đài, vận động viên đang tập — ảnh động, góc thấp, nhiều chuyển động. Không có ảnh thì để `image: null` — cảnh thành sân vận động đêm.
- Không bịa tỉ số, kết quả hay số liệu về người thật; nếu là dự đoán thì nói rõ là dự đoán.
<!-- /ai-guide -->

## File

- `src/styles/sport/index.tsx` — `SportStyle`: nhịp lên sóng, mốc cắt, câu nhấn (nổ/giữ/rung/chớp), ghép lớp.
- `src/styles/sport/theme.ts` — font, màu, easing, `ramp`, `upper`, `fitText`, `abbrOf` (tên kênh viết tắt), `splitTag` (số áo), `clockText`.
- `src/styles/sport/layout.ts` — bố cục dọc/ngang: bảng tỉ số, dải phụ đề (giữ chỗ câu cao nhất), ticker, bảng tên, bảng số, vùng câu nhấn.
- `src/styles/sport/Backdrop.tsx` — ảnh/clip cảnh + đẩy máy, sân vận động SVG (`Stadium`), vệt sọc đổi cảnh (`StripeWipes`).
- `src/styles/sport/Chrome.tsx` — bảng tỉ số, dải phụ đề nắp chéo, ticker.
- `src/styles/sport/Graphics.tsx` — bảng tên, bảng thống kê/badge, cú nổ câu nhấn, khung PHÁT LẠI.
- `src/styles/sport/TitleIntro.tsx` — màn mở đầu kiểu mở màn chương trình.
