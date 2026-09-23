---
name: style-three
description: Phong cách "Cảnh 3D thật" — studio 3D dựng bằng Three.js (@remotion/three): ánh sáng môi trường phản chiếu, đèn màu nhấn, sương, sàn tối nhận bóng đổ; ảnh của cảnh dán lên một tấm dày cạnh kim loại, xoay gần nửa vòng bay tới rồi văng lộn ra ngoài khi đổi cảnh; khối crôm và sơn bóng (cầu, bát diện, nhị thập diện, xuyến, hộp) trôi quanh; cảnh không ảnh và màn tiêu đề là nút xoắn crôm; chữ HTML — phụ đề trên kính mờ, câu nhấn và số liệu là chữ crôm có vệt sáng quét. Dùng cho ra mắt sản phẩm, công nghệ, xe, đồ điện tử, thương hiệu, bất động sản, sự kiện, app/startup — nội dung cần vẻ cao cấp hiện đại.
---

# Phong cách: Cảnh 3D thật (three)

`style: "three"` trong props. Code: `src/styles/three/`. Theo luật của `remotion-markup/3d.md`: mọi thứ trong
`<ThreeCanvas>` có `width`/`height`, chuyển động chỉ từ `useCurrentFrame()`, không dùng `useFrame()`.

## Cần WebGL lúc render

- Chrome của Remotion không có WebGL ở chế độ mặc định. `scripts/render.ts › withGl` bật `gl: "angle"` (GPU) cho
  các phong cách trong `WEBGL_STYLES` (`src/styles/meta.ts`). Đo trên Mac M-series: 634 khung 1080×1920 mất ~20 giây.
- Máy không có GPU (máy ảo, server): tạo WebGL context lỗi → tự render lại bằng `gl: "swangle"` (dựng bằng phần mềm,
  chạy mọi nơi nhưng chậm hàng chục lần — đo cùng video 634 khung: chạy hơn 9 phút chưa xong).
- Xem trước trong trình chỉnh sửa / Studio dùng WebGL sẵn của trình duyệt.
- "Ngẫu nhiên" không bốc phong cách này — chỉ dùng khi người dùng chọn hẳn.
- Render tay bằng CLI: thêm `--gl=angle` (`npx remotion render Short out.mp4 --gl=angle --props=…`).

## Nhận diện hình ảnh

- Nền DOM gradient tròn tối ngả màu nhấn phía sau canvas trong suốt; sương cùng tông (`fog` 11 → 26) để vật ở xa tan
  vào nền. Môi trường phản chiếu `RoomEnvironment` → PMREM (dựng bằng code, không cần file HDR).
- Đèn: ambient 0.25, directional (3, 6, 7) có bóng đổ, point màu nhấn bên trái trước, point màu phụ phía sau phải.
- Màu suy từ `accent`: `key` (cạnh tấm ảnh, nút xoắn, chữ nhấn) sắc độ accent, bão hoà 85%; `second` lệch 150°
  (khối phụ). Accent xám/trắng/đen → xanh 220°.
- Camera cố định (0, 0, 10), FOV 35°. Tấm ảnh đặt đúng khung `usePanelBox` của phong cách `depth` (quy đổi pixel →
  đơn vị thế giới bằng `pxPerUnit`) nên phụ đề/câu nhấn/số liệu dùng chung bố cục.
- Tấm ảnh: `boxGeometry` dày 0.14 — mặt trước `meshBasicMaterial` + ảnh, `toneMapped={false}` (giữ đúng màu ảnh; đèn
  làm ảnh cháy sáng); 4 cạnh kim loại màu `key`; lưng kim loại tối cùng sắc màu nhấn. Ảnh phủ kín (cover), tôn trọng
  vùng crop, phóng chậm 1.02 → 1.12.
- Sàn `meshLambertMaterial` tối — vật liệu PBR ở góc nhìn xiên phản chiếu phòng studio sáng làm nửa dưới khung xám bạc.
- Chữ là HTML đè lên canvas (font 3D của Three.js không đủ dấu tiếng Việt): Lexend (`ensureFonts(["lexend"])`).

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `captions` | câu hiện tại, Lexend 600 trắng trên kính mờ bo tròn (`backdrop-filter` làm nhoè cảnh 3D), nổi lên từ nhoè; cụm nhấn đổi màu `key` |
| `captionPosition` | `bottom`: sát trên `captionBottom`; `center`: giữa khung (punch dời lên 28%, hoặc 72% nếu có visual) |
| `punch` | đúng `atMs`: chữ crôm in hoa Lexend 900 lao ra từ scale 1.7, vệt sáng quét qua, nghiêng 3D nhẹ theo nhịp; mờ 8 frame cuối cảnh |
| `tag` | viên kính mờ góc trái trên, chấm cầu sáng màu nhấn, chữ in hoa — trượt vào 12 frame sau khi tấm ảnh tới |
| `visual` stat | số crôm cỡ lớn đếm lên 30 frame, chú thích trên viên kính; dọc: phía trên tấm ảnh, ngang: cột trái (tấm ảnh dời phải) |
| `visual` badge | chữ in hoa trắng trên viên kính viền màu nhấn |
| `image` ảnh | dán thẳng lên tấm WebGL (crop chỉ cắt vùng kiểu cover) |
| `image` video, hoặc crop xoay/lật/contain | mặt trước DOM (`SceneMedia` — giữ cắt đầu, tốc độ, tiếng, crop) trong khung CSS `perspective` = tiêu cự camera, cùng tư thế → trùng khít tấm 3D (tấm để mặt trước tối). Chỉ "bật" khi tấm đã tới gần và tấm cảnh trước đã văng đi — DOM luôn vẽ trên canvas |
| `image` null | nút xoắn crôm màu `key` xoay liên tục thay tấm ảnh |
| `title`/`subtitle` | 70 frame: nút xoắn crôm lớn nở ra phía trên; tiêu đề crôm hiện từng từ (trồi từ nhoè), từ cuối màu nhấn, vệt sáng quét khi đủ chữ; dòng phụ trên viên kính; 12 frame cuối chữ mờ, nút xoắn lùi vào sâu khi tấm ảnh đầu xoay tới |
| `background` | không dùng |

## Chuyển động

- Tấm tới (`poseAt`): spring 34 frame từ z = -14, xoay quanh trục đứng `±0.95π` (hướng xen kẽ) về `∓0.14`, nghiêng
  z 0.25 → 0. Trong cảnh: đẩy máy tới 0.7 đơn vị, lắc, bồng bềnh.
- Đi: khi cảnh sau tới, tấm cũ văng lên chéo ra ngoài khung (x ∓7, y +2.2, z +2.5) và xoay lộn trong 22 frame.
- Khối trôi theo quỹ đạo dẹt lệch ra sau (z tâm -2) quanh tấm ảnh, tự xoay.
- Tag hiện sau 12 frame, visual sau 16 frame kể từ lúc tấm tới.

## Lỗi cần tránh

- Đừng dùng `useFrame()` hay animation tự chạy của Three.js — nhấp nháy khi render. Mọi giá trị từ `useCurrentFrame()`.
- Đừng dựng video thành texture (`useOffthreadVideoTexture`): mất cắt đầu/lặp/tốc độ/tiếng gốc — dùng mặt DOM trùng khít.
- Góc CSS ngược chiều Three.js ở trục X và Z (CSS trục y hướng xuống): `rotateX(-rx) rotateY(ry) rotateZ(-rz)`,
  `translateY(-y)`. Gốc phối cảnh CSS phải ở giữa khung (camera nhìn thẳng tâm).
- Ảnh tải bằng `useLoader(TextureLoader)` cho TẤT CẢ ảnh cùng lúc ở đầu — tải từng tấm khi đổi cảnh làm cả canvas
  trống một khung (Suspense).
- Chữ in hoa bằng `toLocaleUpperCase("vi")`. Đã render thử "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" với Lexend 900 crôm — móc Ư/Ơ đúng chỗ.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng tự tin, gọn, cao cấp — như video ra mắt sản phẩm: câu ngắn, mỗi câu một ý đắt. Mở bằng một khẳng định mạnh
  hoặc câu hỏi: "Đây là chiếc … đáng tiền nhất năm.", "Bạn đã thấy … thế này chưa?".
- 3–5 cảnh, mỗi cảnh 1–3 câu; mỗi câu ≤ 55 ký tự (phụ đề nằm trên kính mờ, dài quá thành 3 dòng).
- Giữ hoa thường tự nhiên, không viết IN HOA cả câu.
- `tag`: tên tính năng/chương ngắn ≤ 14 ký tự: "CHỐNG ỒN", "PIN", "CAMERA", "GIÁ".
- `punch`: 1–4 từ đắt nhất, PHẢI chép nguyên văn từ một câu của cảnh — thành chữ crôm lớn giữa khung. Tối đa một
  punch mỗi cảnh, không phải cảnh nào cũng cần.
- `visual` stat cho thông số ấn tượng ("40 giờ", "120Hz", "5G", "-30%"); badge cho nhãn ("MỚI", "BẢN PRO"). Tối đa 1–2 cảnh.
- `image`: ẢNH TĨNH một chủ thể rõ — sản phẩm, xe, thiết bị, toà nhà, người dùng sản phẩm — ảnh được dán thật lên
  tấm 3D. Clip video vẫn dùng được. Cảnh không ảnh thành nút xoắn crôm, đừng quá nửa số cảnh.
- Kết bằng lời kêu gọi ngắn: "Bạn sẽ chọn màu nào?", "Đặt trước ngay hôm nay."
<!-- /ai-guide -->

## File

- `src/styles/three/index.tsx` — ghép lớp: nền DOM, canvas, mặt video DOM, chữ
- `src/styles/three/World.tsx` — `ThreeCanvas`: môi trường, đèn, sương, sàn, khối trôi, tấm ảnh, nút xoắn, tải ảnh
- `src/styles/three/Media.tsx` — mặt trước DOM cho clip video trùng khít tấm 3D
- `src/styles/three/Overlays.tsx` — phụ đề kính mờ, câu nhấn crôm, tag, số liệu/nhãn
- `src/styles/three/TitleIntro.tsx` — chữ màn tiêu đề
- `src/styles/three/three.ts` — bảng màu, camera, quy đổi pixel ↔ đơn vị thế giới, tư thế tấm ảnh (`poseAt`)
