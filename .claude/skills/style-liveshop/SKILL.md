---
name: style-liveshop
description: Phong cách "Livestream bán hàng" — màn hình phiên live bán hàng trên điện thoại (giao diện chung chung, không nhái logo nền tảng nào): ảnh/clip là máy quay live rung tay nhẹ, thanh chủ phòng có nút "Theo dõi" + nhãn LIVE đỏ nháy + người xem tăng dần, thanh hành động mép phải với tim bay lên và giỏ hàng, bình luận người xem trôi liên tục và hỏi lại theo lời người dẫn, câu đang nói là lời ghim của chủ phòng, tag là thẻ sản phẩm "Còn n sản phẩm" giảm dần, số liệu là sao nổ "-50%" hoặc viên "Đã bán 12.000", câu nhấn là thẻ FLASH SALE đập xuống giữa màn hình có đồng hồ đếm ngược, giá cũ gạch ngang, giá mới lăn xuống và nút MUA NGAY — kèm chat dồn "Chốt đơn!" và tim bay dày; mở đầu bằng màn chờ "Bắt đầu sau 3·2·1 → LIVE". Dùng cho bán hàng online, giới thiệu sản phẩm, flash sale, mỹ phẩm, thời trang, đồ gia dụng, review nhanh kèm giá, chốt đơn.
---

# Livestream bán hàng

## Nhận diện hình ảnh

- Toàn khung là "máy quay live": ảnh/clip của cảnh phủ kín, phóng chậm 1.06 → 1.12, rung tay bằng hai sóng sin lệch pha,
  hơi tươi màu (saturate 1.12). Hai dải tối trên/dưới để chữ giao diện luôn đọc được. Đổi cảnh hoà rất nhanh (6 frame) —
  một máy quay liền.
- Cảnh không ảnh → **phông chụp sản phẩm**: tường sáng ngả accent, vòng đèn tròn thở chậm, bokeh, bục tròn với bóng
  chai + hộp chờ ảnh.
- Chữ: **Be Vietnam Pro** 500–900 cho mọi chữ giao diện; **Montserrat** 900 cho giá tiền, đồng hồ, số đếm lùi.
  Cả hai đóng gói sẵn, đủ dấu, nạp bằng `ensureFonts`; đo chữ bằng canvas sau `useFontReady("bevietnam")`.
- Màu nhấn (accent): ảnh đại diện, nút "Theo dõi", nhãn "Chủ phòng", vạch trái lời ghim, nút "Mua"/"MUA NGAY",
  số trên giỏ hàng. Đỏ LIVE `#FE2C55`, đỏ sale `#FF1F44`, cam `#FF6A13`, vàng `#FFD84A` **cố định** — khoảnh khắc
  sale luôn nóng dù accent là màu gì. Chữ trên accent tự chọn trắng/đen theo độ sáng.
- Icon tự vẽ SVG (tim, bình luận, chia sẻ, giỏ, mắt, ghim, tia sét, lửa) — kiểu chung, không logo nền tảng.

## Bố cục

- **Dọc 9:16**: thanh chủ phòng trên trái (ảnh đại diện biểu tượng giỏ hàng, lượt thích, "+ Theo dõi") → nhãn
  LIVE → số người xem. Dưới nó: thẻ sản phẩm (trái) và huy hiệu số liệu (phải). Mép phải: tim · bình luận · chia sẻ ·
  giỏ hàng. Đáy: lời ghim rộng gần hết khung, khung chat 6 dòng ngay trên lời ghim (đáy chat bám mép trên thẻ ghim, co
  giãn theo số dòng).
- **Vuông 1:1**: như dọc nhưng chat 3 dòng, nút nhỏ hơn, thẻ sale bỏ chữ "Kết thúc sau".
- **Ngang 16:9**: lời ghim chiếm nửa trái đáy, chat là cột trái phía trên nó, thanh hành động xuống sát đáy phải,
  thẻ flash sale dời sang phải giữa (60% bề ngang).

## Dữ liệu được dùng thế nào

| Trường | Cách vẽ |
|---|---|
| `image` | Máy quay live toàn khung (video: phát, lặp, theo `volume`). Cũng là ảnh thu nhỏ trong thẻ sản phẩm và thẻ flash sale (tắt tiếng). `null` → phông chụp sản phẩm với bóng chai/hộp. |
| `captions` | **Lời ghim của chủ phòng**: thẻ trắng, dòng đầu "📌 · ảnh đại diện · [Chủ phòng]", lời in đậm 800 tối đa 3 dòng (tự co tới 30px). Đổi câu: thẻ co/giãn chiều cao 6 frame, chữ mới trượt lên. |
| Bình luận | Tự sinh, xác định theo tiêu đề (render song song không lệch): tên người xem màu pastel riêng, nhịp 16–30 frame một dòng; 12–60 frame sau mỗi câu người dẫn, người xem **hỏi lại theo nội dung câu** (có giá → "Giá bao nhiêu shop?", có "ship" → "Freeship luôn hả shop?", có "size/màu", "chính hãng", "da/kem/son"…); xen "đã tham gia" và dòng cam "🛒 vừa đặt hàng". |
| `tag` | **Thẻ sản phẩm đang bán**: ảnh nhỏ có số thứ tự cảnh, tên sản phẩm (tối đa 2 dòng), "Còn 23 sản phẩm" giảm dần (nhanh gấp 4 sau câu nhấn, không dưới 2) + thanh tồn kho, nút "Mua". Cảnh liền nhau cùng `tag` thì thẻ đứng yên, không trượt lại. Số trên giỏ hàng = số `tag` khác nhau. |
| `visual` stat | Chữ có `%` hoặc bắt đầu bằng `-`/`x` → **sao nổ** vàng viền đỏ xoay chậm, số đỏ, chú thích trong nhãn đỏ bên dưới. Còn lại → **viên cam có lửa** "Đã bán 12.000" (chú thích thay chữ "Đã bán"). Góc phải trên, nảy vào 10 frame sau đầu cảnh. |
| `visual` badge | Viên vàng có lửa, chữ in hoa ("FREESHIP"), chú thích nhỏ bên dưới. |
| `punch` | **Thẻ đập giữa màn hình** trong 96 frame: chớp trắng, phóng 1.45 → 1 + lắc, tia nắng vàng xoay sau thẻ, nền tối nhẹ, thẻ sản phẩm/huy hiệu/chat lùi mờ. Câu nhấn **có giá** ("199k", "199.000đ", "1,5 triệu", "từ 399k còn 199k", "giảm 30% còn 350k") → **FLASH SALE**: đầu thẻ đỏ-cam + tia sét + đồng hồ "00:04:59" đếm ngược, ảnh sản phẩm có chip "-50%", tên (`tag`), giá cũ gạch ngang, giá mới Montserrat đỏ lăn từ giá cũ xuống, thanh "Đã bán 62→91% · Sắp hết", nút MUA NGAY phập phồng. Không có giá → **ĐIỂM NỔI BẬT**: câu nhấn in hoa đỏ cỡ lớn quét dạ quang (nút MUA NGAY chỉ khi cảnh có `tag`). Cùng lúc cụm đó trong lời ghim đỏ + quét vàng, chat dồn "Chốt đơn!" 6–11 frame một dòng, tim bay dày gấp 3. |
| Giá cũ | Lấy số lớn hơn đứng trước trong câu nhấn ("từ **399k** còn 199k"); không có thì suy từ `%` trong câu nhấn; không có nữa thì coi như giảm 50%. |
| `title`/`subtitle` | Khi `showTitle`: **màn chờ live** — nền tối ngả accent đè cảnh đầu, ảnh đại diện có hai vòng đỏ toả ra + nhãn "SẮP LIVE", tiêu đề chữ 900 (≤ 3 dòng), dòng phụ tách theo `·`/`|` thành tối đa 3 viên, "Bắt đầu sau 3 · 2 · 1" rồi nhãn LIVE đập xuống. |

## Chuyển động

- Frame 0–70 (màn chờ): ảnh đại diện nảy vào, tiêu đề trượt lên, viên phụ hiện; số 3-2-1 mỗi số 11 frame (phóng 1.7 → 1);
  frame 55 LIVE đập xuống; 8 frame cuối cả màn phóng nhẹ và mờ để lộ giao diện live. Thanh chủ phòng, thanh hành động,
  chat, lời ghim hiện từ frame 62. Không `showTitle` → giao diện có ngay từ frame 0.
- Liên tục: người xem tăng mỗi 10 frame, lượt thích/tim/bình luận tăng dần, chấm LIVE nháy, nút tim đập, tim bay lên đung đưa.
- Chat: mỗi dòng mới đẩy cả khung lên một hàng trong 7 frame, dòng trên cùng mờ dần.
- Thẻ sản phẩm trượt vào từ trái 6 frame sau đầu cảnh, rút ra 8 frame cuối cảnh nếu cảnh sau đổi `tag`.

## Lỗi cần tránh

- Lời ghim tối đa 3 dòng — câu trên ~90 ký tự bị co nhỏ và có thể tràn; mỗi câu một ý.
- `tag` tối đa 18 ký tự (schema cắt); để trống thì không có thẻ sản phẩm và thẻ flash sale mất dòng tên.
- Câu nhấn có giá nhưng thiếu đơn vị ("199") không được hiểu là giá — ghi "199k" hoặc "199.000đ".
- Nhiều câu nhấn cách nhau dưới ~3,5 giây thì thẻ sau thay thẻ trước ngay — mỗi cảnh tối đa một câu nhấn, nên chỉ 1–2 câu nhấn cả video.
- `visual.text` sao nổ chỉ vừa ~5 ký tự ("-50%", "x2", "1+1").
- Phụ đề là lời ghim nên phong cách này **không** nhận kiểu phụ đề tuỳ chỉnh và bỏ qua vị trí phụ đề.

## Viết nội dung cho phong cách này

<!-- ai-guide -->
- Giọng người dẫn live đang bán hàng: xưng "shop", gọi "cả nhà", câu ngắn, vui, gấp gáp vừa phải, có từ đệm tự nhiên
  ("nha", "luôn", "thôi"). Mỗi câu dưới 70 ký tự, một ý.
- Tiêu đề là tên sản phẩm/deal ("Serum Vitamin C sáng da"); dòng phụ là 2–3 ưu đãi ngăn bằng " · "
  ("Chỉ trong phiên live · Freeship toàn quốc").
- Nhịp: chào + giới thiệu sản phẩm → điểm mạnh/bằng chứng (đã bán, chất liệu, ai dùng được) → **tung giá** → quà tặng,
  số lượng có hạn, kêu gọi bấm giỏ hàng / theo dõi. 3–5 cảnh, mỗi cảnh 2 câu.
- `tag`: tên sản phẩm đang bán, tối đa 18 ký tự ("Serum Vitamin C", "Áo thun cotton"); lặp lại cùng tên ở các cảnh của
  cùng sản phẩm; đổi tên khi sang sản phẩm/quà khác.
- `punch`: chép NGUYÊN VĂN cụm có GIÁ kèm đơn vị trong một câu — tốt nhất có cả giá cũ và giá mới: "từ 399k còn 199k",
  "chỉ còn 149.000đ", "giảm 30% còn 350k". Chỉ 1 (tối đa 2) câu nhấn cả video, đặt ở cảnh tung giá. Không có giá thì
  chọn lợi ích đắt nhất 2–4 từ ("thấm nhanh không bết").
- `visual` stat: "-50%" / "x2" / "1+1" cho mức giảm (thành sao nổ, caption "Chỉ hôm nay"); hoặc số lượng đã bán
  "12.000" với caption "Đã bán". `visual` badge: "FREESHIP", "QUÀ TẶNG", "CHÍNH HÃNG".
- Ảnh: ảnh sản phẩm sáng, nền sạch, hoặc người đang cầm/dùng sản phẩm hướng về máy quay; clip quay dọc cầm tay càng tốt.
<!-- /ai-guide -->

## File

- `src/styles/liveshop/index.tsx` — ghép lớp, tính đáy chat theo chiều cao lời ghim, mức lùi khi flash sale.
- `src/styles/liveshop/live.ts` — font, màu, đo chữ, đọc giá trong câu nhấn, đếm người xem, sinh bình luận, bố cục theo tỉ lệ.
- `src/styles/liveshop/Feed.tsx` — máy quay live (rung tay, hoà cảnh) và phông chụp sản phẩm khi không ảnh.
- `src/styles/liveshop/Chrome.tsx` — thanh chủ phòng, nhãn LIVE, người xem, thanh hành động, tim bay.
- `src/styles/liveshop/Chat.tsx` — khung bình luận trôi.
- `src/styles/liveshop/Cards.tsx` — lời ghim của chủ phòng, thẻ sản phẩm (`tag`), huy hiệu số liệu (`visual`).
- `src/styles/liveshop/FlashSale.tsx` — thẻ FLASH SALE / ĐIỂM NỔI BẬT của câu nhấn.
- `src/styles/liveshop/Title.tsx` — màn chờ live 3·2·1.
- `src/styles/liveshop/Icons.tsx` — icon SVG và bóng sản phẩm.
