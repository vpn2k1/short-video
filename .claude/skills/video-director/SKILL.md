---
name: video-director
description: Router cho mọi việc làm video trong project này. Dùng khi người dùng muốn tạo/sửa/render video, chọn định dạng, hoặc chưa rõ nên bắt đầu từ đâu. Đọc skill này TRƯỚC khi đọc các skill video khác.
---

# Video Director

Router. Xác định việc thuộc loại nào rồi nạp đúng skill, đừng đọc hết.

## Stack

```
Claude Code
 ├── Remotion         dựng + animation + phụ đề + render
 ├── Pexels           ảnh/video stock  — FREE, 25k req/tháng, MẶC ĐỊNH cho ảnh
 ├── ElevenLabs Free  giọng đọc        — 10k ký tự/tháng, KHÔNG có giọng Việt
 ├── macOS say        giọng Việt Linh  — FREE, offline, KHÔNG giới hạn
 ├── whisper.cpp      phụ đề từ audio  — FREE, offline
 ├── Canva MCP        minh hoạ vector  — FREE, đã xác thực
 └── Gemini           ảnh AI           — key hiện 403, chưa dùng được
```

Nguyên tắc: **ưu tiên thứ miễn phí và chạy offline**. Chỉ chạm dịch vụ trả phí khi thứ
miễn phí không làm được việc đó.

## Giao diện web

```bash
npm start    # http://localhost:5177
```

Làm được cả pipeline bằng chuột: sửa kịch bản, tìm/chọn ảnh Pexels theo thumbnail, tải
file lên, render có thanh tiến độ, ghép nhiều video thành một.

Server `node:http` + một file HTML, không framework, không build step. Code ở `server/`.

## Chọn đường

| Người dùng muốn | Nạp skill | Lệnh |
|---|---|---|
| Video ngắn 9:16 từ một prompt | `short-video`, `script-writing` | `/create-short` |
| Video dài, nhiều chương | `long-video` | `/create-long` |
| Video từ file audio có sẵn | `voice-generation` (mục phiên âm) | `npm run audio-to-video` |
| Viết/sửa nội dung kịch bản | `script-writing` | — |
| Chia cảnh, chọn hình cho từng cảnh | `storyboard` | — |
| Cần ảnh nền | `image-generation` | `/generate-assets` |
| Cần giọng đọc | `voice-generation` | `/generate-assets` |
| Sửa animation, timing, API Remotion | `remotion` | — |
| Render lại, xuất file | `remotion` (mục render) | `/render` |
| Soát lại video đã dựng | — | `/review` |

## Luật bất biến của project

Bốn điều này đã trả giá để học, đừng phá:

1. **Timeline là frame tuyệt đối.** Phụ đề và voiceover neo theo `startMs`/`endMs` lấy từ
   độ dài audio thật. Không dùng `<TransitionSeries>` — nó rút ngắn timeline khi có
   transition, làm chữ lệch khỏi tiếng. Chuyển cảnh bằng `opacity` (`src/scenes/Scenes.tsx`).

2. **Vùng an toàn 9:16.** `SAFE` trong `src/constants.ts`: chừa 120px đỉnh, 320px đáy,
   120px hai bên. Nền tảng vẽ UI của họ đè lên đó. Kiểm bằng pixel, không tin CSS:
   dải đáy phải tối (YMAX thấp).

3. **LLM viết chữ, code tính giờ.** Model không được đặt `startMs`/`endMs`. Timing suy ra
   từ độ dài audio thật, hoặc từ số ký tự nếu chưa có audio.

4. **Không nối chuỗi màu.** `` `${accent}80` `` vỡ với `rgb()` và hex 3 ký tự. Giảm độ
   đậm bằng `opacity` trên layer.

## Trước khi báo xong

Render still ra PNG rồi **đọc lại chính file ảnh đó**. Lỗi bố cục chỉ lộ khi nhìn:

```bash
npx remotion still Short out/check.png --frame=200 --props=videos/<slug>/props.json
```
