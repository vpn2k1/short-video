---
name: style-pixel
description: Phong cách "Game 8-bit" — màn hình game RPG cổ điển: HUD tim + thanh XP đầy dần theo tiến độ video + bộ đếm xu, ảnh/clip điểm ảnh hoá trong cửa sổ game viền pixel dày (không ảnh thì phong cảnh pixel), phụ đề là hộp thoại RPG gõ chữ có ▼ nháy, nhãn "MÀN n: TAG", câu nhấn nảy như popup arcade "CRITICAL! +100 XP", số liệu là "ITEM GET!" kèm rương báu, đổi cảnh bằng tan điểm ảnh, màn tiêu đề "NHẤN START". Dùng cho gaming, thử thách, học mà chơi, sự thật thú vị, "level up" bản thân, nội dung cho trẻ em.
---

# Phong cách: Game 8-bit (pixel)

`style: "pixel"` trong props. Code: `src/styles/pixel/`.

## Nhận diện hình ảnh

- Nền ngoài màn chơi xanh đêm `#0d0f24` rải chấm lưới pixel. Mọi khung là **khung pixel góc bậc thang**
  (`clip-path` một nấc, không bo tròn), viền nhiều lớp dày đúng 1 "điểm ảnh" P = 6px × unit.
- **HUD** trên cùng (từ `safe.top`): 3 tim pixel, chữ `XP`, thanh 12 nấc xanh lá đầy dần theo tiến độ
  video (mỗi nấc lấp theo bước 25%), đồng xu + `×0120` bên phải.
- **Cửa sổ game**: ảnh/clip qua bộ lọc SVG `#px-pixelate` (lấy mẫu 1 điểm mỗi ô ~7px rồi nở ra cả ô,
  giảm còn 7 mức màu mỗi kênh) + scanline CRT rất mờ. Phóng chậm 1.04 → 1.12, lưới ô đứng yên nên hình
  "trôi dưới lưới" như game thật. Cảnh không ảnh: **phong cảnh pixel** vẽ bằng `<rect>` (trời phân dải,
  mặt trời/trăng, mây trôi từng ô, hai lớp đồi, cỏ) — luân phiên ngày / hoàng hôn / đêm theo cảnh.
- **Hộp thoại RPG**: nền xanh `#141a4a`, viền đôi (đen–trắng–xanh–tím nhạt), chữ Lexend 600 trắng bóng
  cứng.
- Font: **Bungee** (khối vuông, đủ dấu) cho HUD, nhãn màn, tiêu đề, popup — luôn in hoa bằng
  `toLocaleUpperCase("vi")`; **Lexend** cho lời thoại. Bóng chữ là bóng cứng lệch đúng bội số P, không blur.
- Bố cục: khung dọc (cao/rộng ≥ 1.3) — HUD → cửa sổ → hộp thoại tách riêng bên dưới (đáy ở
  `height − safe.bottom`). Khung vuông/ngang — cửa sổ phủ gần kín, hộp thoại đè lên đáy cửa sổ như JRPG,
  rộng tối đa 1300px × unit; bảng vật phẩm và popup chỉ đặt trong phần cửa sổ còn nhìn thấy.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu hiện tại trong hộp thoại, gõ từng ký tự NFC (≥ 1.2 ký tự/frame, xong trong 70% thời lượng câu); ký tự chưa gõ vẫn chiếm chỗ (trong suốt) nên dòng không nhảy; gõ xong thì ▼ vàng nháy + nhún ở góc phải dưới. Cỡ chữ 56px × unit, co dần tới vừa hộp. Rỗng (phụ đề tuỳ chỉnh) → không vẽ hộp |
| `captionPosition` | `bottom`: như trên; `center`: hộp thoại nằm giữa cửa sổ game, cửa sổ kéo dài xuống đáy |
| `tag` | nhãn `MÀN n` (màu accent) + khối tối chứa tag in hoa, đè mép trên trái cửa sổ, trượt vào theo nấc mỗi cảnh. Không tag → chỉ `MÀN n` |
| `punch` | đúng `atMs`: popup giữa cửa sổ ~1.6 s — `★ CRITICAL! ★` trên khối đen, cụm từ in hoa Bungee trắng viền đen bóng accent, nảy vọt theo nấc, 10 sao pixel bắn ra, `+100 XP` vàng bay lên, 8 frame cuối nháy tắt. Trong hộp thoại cụm đó đổi vàng khi gõ tới. HUD +100 xu |
| `visual` stat | bảng `ITEM GET!` + rương báu mở nắp (ánh vàng) + số lớn Bungee + chú thích |
| `visual` badge | bảng `NHIỆM VỤ` + nhãn màu accent + chú thích |
| (vị trí bảng) | có ảnh: bảng nhỏ góc phải trên cửa sổ; không ảnh: bảng to giữa cửa sổ (khung ngang: bên phải, popup câu nhấn dời sang trái) |
| `image` | ảnh hoặc clip (`SceneMedia`, tôn trọng `crop`, `trimStartMs`, `speed`, `volume`), qua bộ lọc điểm ảnh; `null` → phong cảnh pixel |
| `title`/`subtitle` | màn tiêu đề 70 frame trên phong cảnh đêm: tiêu đề in hoa vàng viền đen bóng accent rơi xuống nảy, dòng phụ trên dải tối, `▶ NHẤN START` nháy; HUD và hộp thoại vào sau |
| `accent` | nhãn MÀN, bóng chữ popup/tiêu đề, một nửa số sao |
| `background` | không dùng — bảng màu game cố định |

Xu: +10 mỗi câu thoại bắt đầu, +100 mỗi câu nhấn; đồng xu nảy lên mỗi lần cộng.

## Chuyển động

- Mọi thứ "nhảy ô": vị trí làm tròn theo lưới P, thời gian bước theo 2 frame (`onTwos`) — không trượt mượt.
- Vào game: HUD rơi xuống theo nấc (10 frame), hộp thoại mở dọc (6 frame), nhãn màn trượt vào từ trái.
- Đổi cảnh: **tan điểm ảnh** trong cửa sổ — lưới 12 cột ô tối phủ dần 9 frame trước điểm cắt rồi lộ dần
  9 frame sau, thứ tự ô = đường chéo 55% + ngẫu nhiên có seed 30% + xen kẽ bàn cờ 15%. Rời màn tiêu đề:
  cùng hiệu ứng toàn khung (14 cột) quanh `TITLE_FRAMES`.
- Popup / bảng vật phẩm: nảy 0.2 → 1.22 → 0.92 → 1 theo nấc 2 frame.
- Mây trôi 1 ô mỗi 10 frame, sao nháy theo nhịp 12 frame; mọi ngẫu nhiên qua `seeded()`.

## Lỗi cần tránh

- **Bungee in hoa chồng dấu rất cao** (Ể, Ắ, Ầ): dòng sát nhau thì dấu dòng dưới lọt vào chân chữ dòng
  trên, trông như dấu nặng ("SẠI"). Tiêu đề và popup dùng `lineHeight` 1.5 — đừng hạ. Sao nền màn tiêu đề
  chỉ rải ở dải trên cùng (`starMax`) để không nằm ngay dưới chữ.
- Không dùng font pixel thật (Press Start 2P, VT323…) — thiếu dấu tiếng Việt. Không `text-transform`,
  không `letter-spacing` cho Bungee; in hoa bằng `upperVi()`. Kiểm still "ĐỪNG THƯỜNG ƯU ƠN NHỮNG".
- Đừng làm mờ/`image-rendering` bằng cách thu nhỏ rồi `scale` — Chrome vẽ lại ở độ phân giải thật, không
  ra điểm ảnh. Điểm ảnh hoá phải qua filter SVG tĩnh; đừng đổi tham số filter theo frame (render chậm hẳn).
- Ảnh quá sáng/nhạt (trời trắng) sau khi giảm màu trông bệt — chọn ảnh tương phản, màu rõ.
- Popup câu nhấn dài quá 4–5 từ sẽ xuống 2 dòng và nhỏ đi; stat quá 6 ký tự co chữ.
- `interpolate` luôn qua `onTwos(frame)` với dãy mốc tăng nghiêm ngặt; cảnh ngắn hơn 18 frame thì hai màn
  tan điểm ảnh chồng nhau (chấp nhận).

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng như người dẫn game: hào hứng, vui, xưng "bạn" như người chơi. Mở bằng hook kiểu nhiệm vụ:
  "Nhiệm vụ hôm nay…", "Bạn đang ở level mấy?", "Thử thách: …".
- Mỗi cảnh là một MÀN chơi: 3–5 cảnh, mỗi cảnh 1–3 câu; mỗi câu ≤ 70 ký tự (hộp thoại gõ chữ, dài quá chữ nhỏ lại).
- Giữ hoa thường tự nhiên, không viết IN HOA cả câu.
- `tag`: tên màn ngắn ≤ 14 ký tự — "Khởi động", "Boss cuối", "Bí kíp 1", "Level 2", "Phần thưởng".
- `punch`: cụm 2–4 từ đắt nhất, như chiêu chí mạng — PHẢI chép nguyên văn từ một câu của cảnh; tối đa một punch mỗi cảnh, không phải cảnh nào cũng có.
- `visual` stat cho con số đáng "nhặt" như vật phẩm ("+30%", "21 ngày", "3 lần", "100 điểm"); badge cho nhãn nhiệm vụ ("BƯỚC 1", "MẸO 2"). Không cảnh nào cũng có.
- `image`: ảnh màu tươi, tương phản rõ, chủ thể to ở giữa (sẽ bị điểm ảnh hoá — chi tiết nhỏ sẽ mất); cảnh không ảnh
  thành phong cảnh pixel rất hợp cho cảnh mở/kết hoặc cảnh chỉ có con số.
- Kết bằng câu "qua màn" / kêu gọi: "Bạn đã lên level chưa? Bình luận điểm của bạn!".
<!-- /ai-guide -->

## File

- `src/styles/pixel/index.tsx` — ghép lớp, xu/tiến độ, tan điểm ảnh rời màn tiêu đề
- `src/styles/pixel/pixel.ts` — bảng màu, font, lưới P, `onTwos`, viền chữ cứng, góc bậc thang, tìm cụm nhấn, đếm xu, bố cục `useStage`
- `src/styles/pixel/parts.tsx` — khung pixel, sprite (sao, xu, tim, rương), phong cảnh pixel, tan điểm ảnh
- `src/styles/pixel/Viewport.tsx` — cửa sổ game, bộ lọc điểm ảnh hoá, nhãn MÀN
- `src/styles/pixel/Hud.tsx` — tim, thanh XP, bộ đếm xu
- `src/styles/pixel/Dialog.tsx` — hộp thoại gõ chữ, ▼
- `src/styles/pixel/Popups.tsx` — popup CRITICAL!, bảng ITEM GET! / NHIỆM VỤ
- `src/styles/pixel/Title.tsx` — màn tiêu đề NHẤN START
