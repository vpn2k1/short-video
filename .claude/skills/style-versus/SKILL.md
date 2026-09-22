---
name: style-versus
description: Phong cách "So sánh đối đầu" — khung chia đôi hai phe (trên/dưới ở 9:16, trái/phải ở 16:9 và 1:1) bằng đường nối răng cưa phát sáng, huy hiệu VS ở giữa; cảnh lẻ vào phe A (màu nhấn), cảnh chẵn vào phe B (màu đối bù), phe kia giữ ảnh cũ tối đi; bảng tên phe, bảng điểm, con dấu phán quyết đập xuống có rung. Dùng cho so sánh, cái này vs cái kia, lầm tưởng vs sự thật, trước/sau, rẻ vs đắt, "nên chọn cái nào".
---

# Phong cách: So sánh đối đầu (versus)

`style: "versus"` trong props. Code: `src/styles/versus/`.

## Nhận diện hình ảnh

- Khung chia hai phe bằng đường nối chéo có răng cưa (9 răng ở khung dọc, 11 ở khung ngang), nét trắng
  giữa hai viền màu phe + quầng sáng mờ. Dọc (9:16, 3:4): A trên, B dưới. Ngang/vuông: A trái, B phải.
- Màu phe: A = `accent`; B = màu đối bù (xoay hue 180°, ép bão hoà ≥ 72%, sáng 56%). Accent xám → B là
  xanh lam `#2f8cff`. Prop `background` không dùng.
- Huy hiệu VS tròn ở tâm đường nối: vòng chia chéo hai màu phe, lõi đen, chữ "VS" Anton nghiêng có bóng lệch
  hai màu, sáng nhịp theo mỗi lần đổi cảnh. Có ≥ 2 cặp cảnh thì chip "VÒNG n/m" vắt qua mép dưới huy hiệu.
- Mỗi phe có quầng màu phe hắt từ đường nối vào (phe đang nói đậm hơn). Phe đang chờ phủ tối 62%.
- Chữ: Anton (bảng tên, con dấu, số, chữ VS, tên phe cỡ lớn) — luôn in hoa bằng JS; Be Vietnam Pro 800/900
  cho phụ đề và tiêu đề. Cả hai là font đóng gói (`ensureFonts(["anton", "bevietnam"])`).
- Bố cục:
  - Dọc: bảng tên hai phe ôm huy hiệu kiểu game đối kháng — A bên trái phía trên đường nối, B bên phải
    phía dưới. Phụ đề ở mép ngoài phe đang nói (A: đỉnh vùng an toàn, B: đáy vùng an toàn). Con dấu nằm ở
    nửa đối diện bảng tên (A: phải, B: trái).
  - Ngang/vuông: bảng tên ở đỉnh mỗi phe, dạt về phía đường nối; phụ đề ở đáy phe; con dấu ở giữa phe.
  - Cảnh kết luận: bảng tên giữa đỉnh, con dấu chính giữa, phụ đề giữa đáy.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `scenes` | cảnh 1, 3, 5… vào phe A; 2, 4, 6… vào phe B. Phe kia giữ ảnh cảnh trước (tối). Lúc cảnh 1 chạy, phe B xem trước cảnh 2 (tối) |
| số cảnh lẻ | cảnh cuối là KẾT LUẬN: đường nối bị đẩy ra khỏi khung trong 18 frame, phe A phủ toàn màn hình, huy hiệu thu nhỏ biến mất. Chỉ 1 cảnh → toàn khung ngay khi title card rút |
| `image` | ảnh/clip phủ kín khung bao của phe (chủ thể nằm giữa phe), phóng chậm 3→9%. Clip qua `SceneMedia` (tôn trọng `crop`, `trimStartMs`, `speed`, `volume`) |
| `image: null` | nền màu phe sọc chéo + vignette, tên phe (`tag`, không có thì "A"/"B") Anton cỡ lớn in chìm 40% |
| `tag` | bảng tên hình bình hành màu phe viền trắng, bóng đen đặc lệch; hiện ở CẢ hai phe (phe chờ mờ 72%, thu 90%) |
| `visual` stat | bảng điểm tối viền đáy màu phe, số Anton trắng phát sáng đếm lên 32 frame (hiểu `80%`, `2,5`, `1.000.000₫`), chú thích nhỏ bên dưới; dính liền bảng tên nên hai phe so điểm được |
| `visual` badge | viên tối viền màu phe, chữ in hoa + chú thích nhỏ, cùng chỗ với bảng điểm |
| `punch` | con dấu phán quyết: khung tối viền đôi màu phe, chữ Anton in hoa, rơi từ 2.4× xuống trong 7 frame, vòng sóng chấn động, cả khung rung 12 frame. Hiện từ `atMs` (sớm nhất 6 frame sau khi cảnh vào) tới khi lượt chuyển sang phe kia |
| `captions` | hộp tối viền trên màu phe, Be Vietnam Pro 800 căn giữa, co chữ để ≤ 4 dòng; nằm ở phe của cảnh đang chạy lúc câu bắt đầu; cụm `punch` trong câu tô màu phe |
| `title`/`subtitle`/`handle` | 70 frame: hai nửa màu phe lao vào từ hai phía, đập nhau ở frame 12 (chớp trắng + rung), VS đập xuống, tiêu đề in hoa trên dải tối phía trên huy hiệu, dòng phụ + handle phía dưới; tên hai phe (`tag` của cảnh 1 và 2) cỡ lớn trên hai nửa. Cuối title hai nửa màu mờ đi lộ ảnh bên dưới |
| `accent` | màu phe A; phe B suy ra từ nó |
| `captionPosition`, `background` | bỏ qua — vị trí do bố cục phe quyết định |

## Chuyển động

- Cảnh mới trượt vào phe của nó từ ngoài khung (A từ trái, B từ phải) trong 14 frame, đè lên ảnh cũ của phe
  đó; chạm đường nối thì chớp trắng 40% trong 10 frame. Phe kia tối dần trong 10 frame.
- Bảng tên/bảng điểm trượt vào 80u sau khi cảnh vào 3 frame; phe mất lượt thì bảng mờ và thu nhẹ.
- Huy hiệu sáng mạnh khi đổi cảnh rồi thở nhẹ theo sin.
- Rung khung (±16u ngang, ±12u dọc, tắt dần 12 frame, phóng 2.5% để không lộ mép) chỉ lúc hai nửa title
  đập nhau và lúc con dấu chạm. Ngẫu nhiên qua `seeded()`.

## Lỗi cần tránh

- Anton hẹp: KHÔNG dùng CSS `text-transform`/`letter-spacing` — in hoa bằng `upper()` (`toLocaleUpperCase("vi")`).
  Đã render thử "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" ở bảng tên, con dấu, chữ nền — móc Ư/Ơ đúng. `lineHeight` 1.15 +
  `paddingTop` 6% để dấu chồng (Ờ, Ể) không chạm mép bảng.
- Ba phe bố cục (A, B, kết luận) giữ chỗ phụ đề và bảng điểm từ TOÀN BỘ dữ liệu → con dấu không nhảy giữa các
  câu, nhưng một câu rất dài ở phe B khung dọc sẽ bóp nhỏ con dấu (cỡ chữ con dấu co theo vùng trống, tối thiểu 36u).
- Đường nối và cả hai phe dùng CHUNG `offset` khi đẩy kết luận — phe B phải co theo, nếu không nó đè lên phe A.
- Clip-path là đa giác px tính mỗi frame; không dùng `backdrop-filter` hay blur toàn khung. Blur duy nhất là
  quầng sáng của đường nối (SVG, nét mảnh).
- `interpolate` luôn qua `ramp(frame, from, length)` — mốc tăng nghiêm ngặt, đã kẹp.
- Khung 1:1 mỗi phe chỉ rộng ~540px: phụ đề nhỏ (~34px) và 3–4 dòng — câu nên ngắn.
- Tag dài (> 14 ký tự) làm bảng tên co chữ; bảng tên khung dọc chỉ rộng ~300px (kẹp giữa lề và huy hiệu).

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Kịch bản là một cuộc đối đầu giữa HAI bên cố định: A vs B (iPhone vs Samsung, lầm tưởng vs sự thật, trước vs sau, rẻ vs đắt, thuê vs mua).
- Viết theo CẶP cảnh: cảnh 1 nói về A, cảnh 2 nói về B cùng một tiêu chí; cảnh 3 lại là A, cảnh 4 là B ở tiêu chí tiếp theo… Nên có 2–3 cặp (4–6 cảnh).
- Muốn chốt kết luận thì thêm MỘT cảnh cuối (tổng số cảnh lẻ): cảnh đó phủ toàn khung — nói bên nào thắng hoặc nên chọn gì.
- `tag` là TÊN PHE, ngắn ≤ 12 ký tự, giữ nguyên cho mọi cảnh của cùng một phe: "iPhone" / "Samsung", "Lầm tưởng" / "Sự thật", "Trước" / "Sau". Cảnh kết luận dùng tag "Kết luận" hoặc tên bên thắng.
- Mỗi cảnh 1–2 câu, mỗi câu ≤ 70 ký tự; câu đầu cảnh nói rõ đang so tiêu chí gì ("Về pin…", "Giá bán…").
- `punch` là lời phán ngắn 1–3 từ, PHẢI chép nguyên văn từ một câu của chính cảnh đó: "thắng áp đảo", "sai hoàn toàn", "rẻ hơn một nửa". Không phải cảnh nào cũng có — dành cho tiêu chí có bên hơn rõ.
- `visual` stat là ĐIỂM SỐ của phe ở tiêu chí đó, cả hai cảnh trong cặp nên cùng có để so: "5000 mAh" vs "4400 mAh", "12 triệu" vs "25 triệu", caption ngắn là tên tiêu chí ("dung lượng pin").
- Ảnh: mỗi phe một chủ thể rõ, chụp chính diện, nền gọn (sản phẩm, người, món ăn, cảnh trước/sau). Không có ảnh thì để `image: null` — phe thành nền màu kèm tên phe cỡ lớn.
- Giọng dứt khoát, công bằng, như bình luận viên trận đấu; tránh kết luận mơ hồ.
<!-- /ai-guide -->

## File

- `src/styles/versus/index.tsx` — `VersusStyle`: luật lượt (ai đứng phe nào), trượt/tối, kết luận, rung, ghép lớp.
- `src/styles/versus/theme.ts` — font, màu phe (`sideColors`, `inkOn`), easing, `ramp`, hình học đường nối (`seamAt`, `seamPoints`, `sideClip`, `sideBounds`, `verdictOffset`), đo chữ (`fitText`).
- `src/styles/versus/layout.ts` — chỗ bảng tên, hộp phụ đề, vùng con dấu của phe A / B / kết luận theo khung dọc/ngang.
- `src/styles/versus/Stage.tsx` — ảnh/clip/nền màu của phe, đường nối phát sáng, huy hiệu VS + chip vòng.
- `src/styles/versus/Overlays.tsx` — bảng tên + bảng điểm/badge, con dấu phán quyết, hộp phụ đề.
- `src/styles/versus/TitleIntro.tsx` — title card hai nửa đập nhau.
