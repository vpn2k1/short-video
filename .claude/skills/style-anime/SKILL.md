---
name: style-anime
description: Phong cách "Anime" — năng lượng opening anime / key visual: ảnh/video toàn khung màu tươi đẩy máy chậm có loé sáng mềm, đổi cảnh bằng nhát chém chéo có tia tốc độ và chớp trắng, phụ đề trắng viền màu dày bật scale-pop ở 1/3 dưới, tag là thẻ tên nhân vật/chương trên dải chéo lao vào từ bên, câu nhấn là khung impact (tia tốc độ toả tròn + khối màu nghiêng + rung + lấp lánh), số liệu là đồng hồ "chỉ số sức mạnh", cánh hoa anh đào trôi, không ảnh thì bầu trời mây vẽ tay, thẻ tiêu đề chữ đập từng chữ. Dùng cho kể chuyện kịch tính, giới thiệu nhân vật, fan anime/game, giới trẻ, câu chuyện "hành trình trưởng thành" truyền động lực.
---

# Phong cách: Anime (anime)

`style: "anime"` trong props. Code: `src/styles/anime/`.

## Nhận diện hình ảnh

- Ảnh/video toàn khung, `saturate(1.22) contrast(1.06) brightness(1.03)` + lớp "cel" soft-light (vùng tối ngả
  xanh tím, vùng sáng ửng ấm). Đẩy máy chậm 1.06 → 1.16 suốt cảnh. Loé sáng mềm (light-leak) hai quầng ấm ở góc
  trên phải/dưới trái trôi và "thở" chậm, pha screen. Đáy tối dần nhẹ để phụ đề trắng luôn đọc được.
- Không ảnh (và nền thẻ tiêu đề): bầu trời xanh sâu → trắng xanh → ửng nắng, mặt trời loé góc trên phải, tia nắng
  `repeating-conic-gradient` quay rất chậm, mây SVG (các hình tròn chồng trên đáy phẳng, gradient chung userSpaceOnUse)
  trôi ngang; mỗi cảnh không ảnh một bố cục mây riêng theo seed.
- Bảng màu suy từ `accent`: `main` = sắc độ accent, bão hoà ≥ 70%, sáng 48% (luôn đủ tối để chữ trắng nổi, accent
  vàng/pastel vẫn ổn); `deep` 26% (bóng khối, viền chữ trên khối màu); `light` 78% (quầng, tia). Accent xám/trắng/đen
  → đỏ hồng anh đào 345°. Màu phụ cố định: xanh trời `#3fa9ff` (dải lệch phía sau), vàng nắng `#ffe45c` (cụm nhấn
  trong phụ đề, lấp lánh), hồng anh đào (cánh hoa).
- Chữ: `montserrat` 900 cho mọi chữ (đóng gói sẵn, nạp bằng `ensureFonts`). Chữ trắng viền màu:
  `-webkit-text-stroke` 0.2em + `paint-order: stroke fill` (viền nằm dưới phần tô nên nét không bị ăn mỏng) + bóng
  mực cứng `#141026` lệch xuống.
- Khối màu (tag, câu nhấn, nhãn, ruy băng tiêu đề) đều `skewX(-12…-18deg)`, viền trắng, có một khối xanh trời lệch
  phía sau — ngôn ngữ thẻ tiêu đề anime.
- Cánh hoa anh đào SVG (10 cái trong video, 16 cái ở thẻ tiêu đề) rơi chéo, lắc, lật (scaleX dao động).

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu hiện tại, chữ trắng viền `main` dày, giữ hoa thường; tối đa 3 dòng, cỡ chữ co theo độ dài (tối thiểu 58%); mỗi câu bật scale-pop 1.28 → 1 trong 6 frame |
| `captionPosition` | `bottom`: sát trên `captionBottom`; `center`: giữa khung — dọc/vuông có số liệu thì hạ xuống 56–58%, câu nhấn lên ~30% và số liệu nhường chỗ (mờ đi) khi câu nhấn đập xuống |
| `punch` | đúng `atMs` (kẹp sau thẻ tiêu đề): nền tối đi, 64 tia tốc độ toả tròn từ tâm khối (đổi nét mỗi 2 frame, tắt sau ~26 frame), khối `main` nghiêng ±4–5° đập xuống scale 2.2 → 1 chứa cụm nhấn IN HOA (≤ 2 dòng, > 22 ký tự thì 3), 6 lấp lánh nảy quanh, cả màn hình rung 14 frame; khối giữ tới hết cảnh (ít nhất 45 frame) rồi thu nhỏ mờ 6 frame. Cụm đó trong phụ đề đổi vàng nắng |
| `tag` | thẻ tên nhân vật/chương: dải `main` nghiêng lao vào từ trái (dải xanh trời lệch phía sau), vạch trắng đứng + chữ IN HOA trắng trượt theo, vệt sáng quét ngang; 10 frame cuối cảnh rút sang trái (cảnh cuối giữ nguyên) |
| `visual` stat | "chỉ số sức mạnh": số lớn nghiêng trắng viền `main`, quầng `light` thở, đếm lên 30 frame (giữ `90%`, `+30K`, `1.200`, `9.000`); thanh đo 12 vạch nghiêng sáng dần xanh trời → `main` → vàng (số có `%` dừng đúng tỉ lệ, số khác đầy vạch); chú thích trắng viền tối |
| `visual` badge | chữ IN HOA trắng trong khối `main` nghiêng viền trắng, bóng khối xanh trời, một lấp lánh vàng ở góc |
| `image` | ảnh hoặc video (qua `SceneMedia`: tôn trọng `crop`, `trimStartMs`, `speed`, `volume`); null → bầu trời mây |
| `title`/`subtitle`/`handle` | 70 frame: bầu trời + cánh hoa, chớp trắng mở màn, tiêu đề IN HOA đập xuống từng chữ (scale 2.6 → 1, ≤ 2 frame/chữ, cả dòng nghiêng -4°), rung khi chữ cuối chạm, lấp lánh bật; dòng phụ trên ruy băng `main` lao vào từ trái; handle nhỏ ở đáy; 9 frame cuối nhát chém chéo rút cả thẻ, lộ cảnh đầu |
| `accent` | bảng màu `main`/`deep`/`light` |
| `background` | không dùng — nền là ảnh hoặc bầu trời |

Bố cục: dọc/vuông — tag ~10% chiều cao bên trái, visual giữa phía trên (dưới tag), câu nhấn giữa khung (42%, hoặc
53% nhỏ hơn 20% khi có visual), phụ đề dưới. Ngang — visual cột trái, câu nhấn dời sang phải (63%) khi có visual.

## Chuyển động

- Đổi cảnh (`SLASH_FRAMES` = 10, ease-out): cảnh mới lộ ra sau đường chéo quét trái → phải (`clip-path` đa giác),
  mép là lưỡi trắng + viền `main`, 26 tia tốc độ ngang bay theo mép, chớp trắng tới 55% giữa nhát. Cảnh cũ vẫn vẽ
  bên dưới. Cảnh đầu không chém (thẻ tiêu đề tự chém rút).
- Rung khi câu nhấn: 14 frame, biên độ 16px × unit giảm dần, hướng bốc thăm `seeded()` từng frame. Nền phóng sẵn 4%
  nên rung không lộ mép. Thẻ tiêu đề không rung theo.
- Phụ đề pop 6 frame mỗi câu; tag vào 4 frame sau đầu cảnh, visual 8 frame. Phần tử của cảnh đầu đợi thẻ tiêu đề rút.
- Mọi ngẫu nhiên qua `seeded()`; mọi chuyển động từ `useCurrentFrame()`.

## Lỗi cần tránh

- In hoa bằng `toLocaleUpperCase("vi")`, không `text-transform`. Đã render "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" với
  montserrat 900 + viền dày — móc Ư/Ơ và dấu chồng (Ể, Ỳ) đúng chỗ ở line-height 1.22–1.3; đừng hạ thấp hơn.
- Viền chữ phải có `paint-order: stroke fill`; bỏ đi thì stroke ăn vào nét, chữ mảnh và dấu nhoè.
- Thẻ tiêu đề tách từng chữ: bọc mỗi TỪ trong `inline-block nowrap` rồi mới tách chữ (`glyphs()` theo NFC) — tách
  thẳng thì trình duyệt ngắt dòng giữa từ.
- Đừng cho màu `main` sáng: accent vàng dùng thẳng làm viền thì chữ trắng chìm — `paletteFor` đã ép sáng 48%.
- Câu nhấn dài (> 22 ký tự) thành 3 dòng và khối rất to, dễ chạm phụ đề — giữ 1–4 từ.
- Tia tốc độ và cánh hoa là SVG nhiều hình — đừng tăng số lượng tuỳ tiện (render chậm, rối mắt).

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Kể như lời dẫn anime / một "arc" nhân vật: có nhân vật, có thử thách, có khoảnh khắc bùng nổ. Giọng hào hứng,
  kịch tính nhưng ngắn gọn. Mở bằng hook kiểu opening: "Không ai tin cậu ấy làm được…", "Ngày đầu tiên, tôi thua trắng."
- 3–5 cảnh, mỗi cảnh 1–3 câu; mỗi câu ≤ 55 ký tự (phụ đề to, viền dày). Giữ hoa thường tự nhiên, không viết IN HOA cả câu.
- `tag`: thẻ tên nhân vật hoặc chương ≤ 20 ký tự — "Tập 1 · Khởi đầu", "Minh — tân binh", "Arc 2: Thử thách",
  "Trận chung kết". Nên có ở cảnh đầu và mỗi lần đổi chương/nhân vật.
- `punch`: 1–4 từ bùng nổ nhất, PHẢI chép nguyên văn từ một câu của cảnh — nó thành khung impact có rung, dùng cho
  khoảnh khắc quyết định ("không bỏ cuộc", "lật ngược thế cờ", "vượt giới hạn"). Tối đa một punch mỗi cảnh, 2–3 cảnh là đủ.
- `visual` stat như chỉ số sức mạnh: "9.000", "100%", "x10", "+50 kg", "Lv 99"; badge cho mốc: "LEVEL UP", "RANK S",
  "TẬP 2". Tối đa 1–2 cảnh.
- `image`: ảnh/video tươi sáng, có người/nhân vật, trời xanh, sân tập, đường phố, sân khấu, tranh phong cách anime.
  Tránh ảnh tối, u ám. Cảnh không ảnh (bầu trời mây) đẹp cho câu mở đầu hoặc câu kết cảm hứng.
- Kết bằng câu "to be continued" hoặc gọi hành động: "Hành trình của bạn bắt đầu từ hôm nay.", "Hẹn gặp ở tập sau!".
<!-- /ai-guide -->

## File

- `src/styles/anime/index.tsx` — ghép lớp theo thứ tự, nạp font, rung khung khi câu nhấn
- `src/styles/anime/Backdrop.tsx` — cảnh (ảnh/video tông key visual, đẩy máy), nhát chém đổi cảnh, loé sáng, đáy tối
- `src/styles/anime/Sky.tsx` — bầu trời mây + tia nắng, light-leak, cánh hoa anh đào
- `src/styles/anime/Overlays.tsx` — phụ đề scale-pop, thẻ tên (tag), khung impact (punch), chỉ số sức mạnh/nhãn (visual), lấp lánh
- `src/styles/anime/TitleIntro.tsx` — thẻ tiêu đề opening: chữ đập từng chữ, ruy băng, nhát chém rút
- `src/styles/anime/anime.ts` — bảng màu từ accent, chữ viền, nhịp (chém, rung, mốc hiện), tìm cụm nhấn, ước cỡ chữ
