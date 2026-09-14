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

Một ô chat kiểu Google Flow: gõ prompt (kèm ảnh/video tải lên) → AI viết kịch bản → giọng
đọc → render. Nhắn tiếp để sửa. Chọn Video/Ảnh, phong cách, tỉ lệ, giọng, nhạc ngay trong ô
nhập. Thư viện ở thanh nav, API key điền trong Cài đặt (lưu `data/api-keys.json`).

Server `node:http` + một file HTML, không framework, không build step. Code ở `server/`
(`chat.ts` là pipeline của ô chat, `keys.ts` là cài đặt key).

### Trình chỉnh sửa timeline

`/editor.html#<slug>` (nút ✂️ Chỉnh sửa trong chat). Kiểu CapCut: Remotion Player xem trước
chính composition `Short`, timeline 5 track (cảnh, chữ, giọng, nhạc, âm thanh), bảng thuộc tính,
thư viện media. Ghi thẳng vào `props.json`; nút Xuất video render lại mp4.

- Code React ở `server/editor/`, server đóng gói bằng esbuild + Tailwind lúc chạy
  (`server/editor-build.ts`) — sửa `src/` hay `server/editor/` là lần tải sau tự build lại.
- Thao tác timeline là hàm thuần trong `server/editor/ops.ts` (tách, cắt đầu/đuôi kiểu ripple,
  kéo mép, xoá) — test bằng tsx được, không cần trình duyệt.
- Dữ liệu mới trong schema: `scene.trimStartMs`, `scene.volume` (clip video), `musicVolume`,
  `voiceVolume`, `audioClips[]` (âm thanh thêm tay). Video trong cảnh phải đi qua
  `src/scenes/ClipVideo.tsx` để cắt đầu clip và âm lượng có tác dụng ở mọi phong cách.
- Sửa bằng chat sau khi đã chỉnh tay: AI sinh lại `props.json` từ kịch bản → mất chỉnh tay.

## Phong cách hình ảnh

Cùng một `props.json`, đổi `style` là ra video khác hẳn — timing và audio không đổi.
Danh sách ở `src/styles/meta.ts`, bản vẽ ở `src/styles/<id>/`, luật từng phong cách ở skill:

| `style` | Skill | Hợp với |
|---|---|---|
| `caption` | `style-caption` | mẹo nhanh, bán hàng, đọc thẳng |
| `vox` | `style-vox` | giải thích sự kiện, lịch sử, kinh tế |
| `kinetic` | `style-kinetic` | câu nói mạnh, tuyên ngôn, ít hình |
| `documentary` | `style-documentary` | kể chuyện nghiêm túc, địa danh, con người |
| `whiteboard` | `style-whiteboard` | dạy học, từng bước, khái niệm |
| `tech` | `style-tech` | công nghệ, số liệu, sản phẩm số |
| `plain` | `style-plain` | clip quay sẵn, vlog, ghép clip |
| `bold` | `style-bold` | nói thẳng vào camera, bài học, động lực, bán hàng |
| `chat` | `style-chat` | kể chuyện bằng tin nhắn, drama, hội thoại |
| `news` | `style-news` | tin tức, cập nhật, sự kiện vừa xảy ra |
| `retro` | `style-retro` | hoài niệm, chuyện ngày xưa, meme |

Đoạn `<!-- ai-guide -->` trong mỗi skill được server đưa thẳng vào prompt viết kịch bản
(`scripts/style-guides.ts`) — sửa skill là AI viết khác theo. Thêm phong cách mới: id trong
`meta.ts`, component trong `src/styles/<id>/`, một dòng trong `registry.tsx`, và skill
`style-<id>` có đoạn ai-guide.

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
| Chọn/sửa phong cách hình ảnh của video | `style-<id>` tương ứng | đổi `style` trong props |
| Tạo phong cách mới | `remotion`, một skill `style-*` làm mẫu | — |
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
