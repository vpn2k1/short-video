---
name: style-depth
description: Phong cách "Không gian 3D" — khoảng không tối có chiều sâu thật dựng bằng CSS 3D (không cần WebGL, render nhanh trên mọi máy): sàn lưới phối cảnh trôi về phía camera, sao bay tới, khối lập phương khung dây xoay; ảnh/clip là tấm kính có độ dày bay tới từ xa, lắc lư nhẹ rồi lao qua camera khi đổi cảnh; phụ đề chữ khối trắng lật lên, câu nhấn là khối chữ in hoa màu nhấn lật vào, tag là khối lập phương nhỏ xoay cạnh chữ, số liệu là con số khối đếm lên; màn tiêu đề chữ bay tới từng chữ. Dùng cho công nghệ, AI, khoa học, vũ trụ, tương lai, sản phẩm số, game, sự thật thú vị, giới thiệu dự án.
---

# Phong cách: Không gian 3D (depth)

`style: "depth"` trong props. Code: `src/styles/depth/`. Chỉ dùng CSS 3D (`perspective`, `preserve-3d`, `translateZ`,
`rotateX/Y`) — render như mọi phong cách khác, không cần GPU. Muốn vật 3D thật (ánh sáng, phản chiếu, bóng đổ) thì
dùng phong cách `three` (skill `style-three`).

## Nhận diện hình ảnh

- Nền: trời gradient tối ngả màu nhấn (đỉnh lệch +25°), quầng sáng ở chân trời (60% chiều cao), dưới chân trời là
  sàn lưới — mặt phẳng rất rộng `rotateX(76deg)` kẻ bằng `repeating-linear-gradient` màu nhấn, trôi về phía camera,
  mờ dần về chân trời (`mask-image`). 70 hạt sao bay tới từ tâm (chiếu phối cảnh, càng gần càng to), 3 khối lập
  phương khung dây trôi ở rìa, hạt `Grain`, vignette.
- Màu suy từ `accent`: `key` (mặt chữ nhấn, viền, lưới) = sắc độ accent, bão hoà 95%, sáng 64%; `side` (thành khối)
  cùng sắc độ, sáng 24%. Accent xám/trắng/đen → tím điện 265°.
- Tấm kính: khung `usePanelBox` (dọc 78% bề ngang, cao ≤ 50% khung, tâm ở 40%; vuông 62%; ngang 46%, có số liệu thì
  42% và dời sang phải 62%). Mặt ảnh bo 30u, viền trắng 55%, quầng màu nhấn; 6 lớp thành `translateZ` lùi sau làm
  độ dày; vệt bóng kính chéo trượt theo góc xoay; ánh hắt xuống sàn.
- Chữ khối (`extrude`): 5–12 lớp `text-shadow` màu `side` xếp chéo xuống phải + bóng mềm rơi xuống, cộng viền tối
  mảnh (`-webkit-text-stroke`) để đọc được trên ảnh sáng.
- Font: `montserrat` 900 cho chữ khối (tiêu đề, câu nhấn, tag, số liệu); `bevietnam` 800 cho phụ đề. Nạp bằng `ensureFonts`.

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu hiện tại, chữ khối trắng Be Vietnam Pro 800, giữ hoa thường; mỗi câu lật lên từ dưới (`rotateX -75° → 0`, spring) |
| `captionPosition` | `bottom`: sát trên `captionBottom`; `center`: giữa khung (punch dời lên 28%, hoặc xuống 72% nếu có visual) |
| `punch` | đúng `atMs`: chữ in hoa màu `key` Montserrat 900 trên bảng kính tối viền màu nhấn, lật từ nằm ngang và lao từ sâu -900 ra trước tấm kính, nảy rồi xoay qua lại ±6°; mờ 8 frame cuối cảnh; cụm đó trong phụ đề đổi sang màu `key` |
| `tag` | góc trái trên: khối lập phương kính nhỏ xoay liên tục + chữ khối in hoa trượt ra từ sau khối (in hoa bằng JS) |
| `visual` stat | con số khối màu `key` lật vào (`rotateX -80° → 0`), đếm lên 30 frame (giữ `80%`, `+30K`, `1.200`), chú thích bên dưới; dọc: phía trên tấm kính, ngang: cột trái |
| `visual` badge | chữ in hoa trắng trên tấm màu nhấn gradient có cạnh dày, nghiêng qua lại |
| `image` | ảnh hoặc video trên tấm kính (qua `SceneMedia`: tôn trọng `crop`, `trimStartMs`, `speed`, `volume`); null → khối lập phương kính lớn xoay chậm |
| `title`/`subtitle`/`handle` | 70 frame: không gian có khối khung dây lớn; tiêu đề bay tới TỪNG CHỮ từ sâu -1400 (mỗi chữ xoay ±80° về 0), từ cuối màu `key`; dòng phụ trên viên kính viền màu nhấn; handle ở đáy; 14 frame cuối cả khối lao qua camera, sao và sàn tăng tốc |
| `accent` | mọi màu (xem trên) |
| `background` | không dùng — nền luôn là khoảng không `#04050d` |

## Chuyển động

- Tấm kính tới: spring từ `z = -2400u`, xoay `55°` quanh trục đứng (hướng xen kẽ theo chỉ số cảnh) về `-9°`, nảy nhẹ.
  Trong cảnh: đẩy máy 160u suốt cảnh, lắc ±4°, bồng bềnh ±9u. Cảnh đầu (có tiêu đề) tới lúc `TITLE_FRAMES - 14`.
- Đổi cảnh: tấm cũ lao qua camera (z +1500u, trượt ngang 75% khung ngược hướng, xoay 45°, mờ dần) trong 18 frame, tấm
  mới bay tới cùng lúc; sao và sàn chạy nhanh gấp 4 lúc tấm mới đang tới.
- Tag hiện sau 10 frame, visual sau 14 frame tính từ lúc tấm kính tới. Phụ đề cảnh đầu đợi màn tiêu đề xong.
- Mọi ngẫu nhiên qua `seeded()`; mọi chuyển động từ `useCurrentFrame()`.

## Lỗi cần tránh

- Chữ in hoa bằng `toLocaleUpperCase("vi")`, không `text-transform`/`letter-spacing`. Đã render thử
  "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" với Montserrat 900 + extrude — móc Ư/Ơ đúng chỗ.
- Tiêu đề tách TỪNG CHỮ bằng `glyphs()` (NFC) để không cắt đôi dấu; mỗi từ là một `inline-block nowrap` để không
  xuống dòng giữa từ.
- `extrude` nhiều lớp khá nặng — đừng áp cho đoạn văn dài; câu dài tự co cỡ chữ (tối thiểu 66%).
- Tấm cũ và tấm mới phải nằm trong CÙNG một khung `perspective` (Stage) — tách hai khung là mất cảm giác cùng không gian.
- Punch dài cả câu → chữ khối nhỏ, khó đọc. Stat quá 6–7 ký tự → số co nhỏ.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng hào hứng, "wow", hướng tới tương lai: như người dẫn chương trình khoa học/công nghệ. Mở bằng câu hỏi hoặc
  khẳng định gây tò mò: "10 năm nữa…", "Bạn có biết…", "Thứ này sắp thay đổi…".
- 3–5 cảnh, mỗi cảnh 1–3 câu; mỗi câu ≤ 55 ký tự (chữ khối to, dài quá thành 3 dòng và co nhỏ).
- Giữ hoa thường tự nhiên, không viết IN HOA cả câu.
- `tag`: nhãn chủ đề ngắn ≤ 14 ký tự, hiện cạnh khối lập phương xoay: "AI", "XE TỰ LÁI", "BƯỚC 1", "SAO HOẢ".
- `punch`: 1–4 từ đắt nhất, PHẢI chép nguyên văn từ một câu của cảnh — nó thành khối chữ in hoa lớn lật vào giữa
  khung. Tối đa một punch mỗi cảnh, không phải cảnh nào cũng cần.
- `visual` stat cho con số gây choáng ("90%", "1 tỷ", "2035", "10x"); badge cho nhãn chương ("PHẦN 1", "LEVEL 2").
  Tối đa 1–2 cảnh.
- `image`: ảnh/video một chủ thể rõ — sản phẩm, thiết bị, phòng lab, vũ trụ, thành phố tương lai, màn hình. Cảnh không
  ảnh thành khối lập phương kính xoay — đẹp nhưng đừng quá nửa số cảnh.
- Kết bằng câu hỏi hoặc lời hẹn: "Bạn đã sẵn sàng chưa?", "Theo dõi để xem phần tiếp theo."
<!-- /ai-guide -->

## File

- `src/styles/depth/index.tsx` — ghép lớp theo thứ tự, nạp font, tăng tốc không gian lúc chuyển cảnh
- `src/styles/depth/Space.tsx` — trời, sàn lưới phối cảnh, sao bay tới, khối khung dây, component `Cube`
- `src/styles/depth/Stage.tsx` — khung tấm kính (`usePanelBox`), tư thế tới/đi của từng cảnh, tấm kính dày, khối kính khi không ảnh
- `src/styles/depth/Text.tsx` — phụ đề chữ khối, câu nhấn lật vào, tag khối xoay, số liệu/nhãn
- `src/styles/depth/TitleIntro.tsx` — màn tiêu đề chữ bay tới từng chữ rồi lao qua camera
- `src/styles/depth/depth.ts` — bảng màu từ accent, chữ khối `extrude`, font, hằng số nhịp
