---
name: video-generation
description: Đưa video/b-roll vào cảnh. Dùng khi người dùng muốn clip động thay vì ảnh tĩnh, hoặc hỏi về sinh video bằng AI.
---

# Video Generation

## Đã có gì

- **Cảnh dùng video:** trường `image` của cảnh nhận cả `.mp4/.mov/.webm`. `src/scenes/ClipVideo.tsx`
  phát clip (lặp nếu ngắn hơn cảnh, `trimStartMs` cắt đầu, `volume` mặc định 0 để giọng đọc là chính).
- **Sinh clip bằng AI:** `scripts/ai-video.ts`, clip lưu ở `public/videos/ai/`, tự hiện trong thư viện. Hai lối vào:
  - Trình chỉnh sửa › ✨ AI → `POST /api/ai-video`: tạo một clip, chọn model và độ dài.
  - Ô tạo video ở trang chính › chip **Hình** (`ChatSettings.video`): "" = ảnh, "auto"/key model =
    `addAiClips` trong `server/chat.ts` tạo clip cho từng cảnh sau bước giọng đọc (độ dài phủ cảnh),
    nhớ clip đã tạo trong `videos/<slug>/ai-clips.json`, bỏ qua cảnh dùng file `uploads/`.
    Chọn "🚫 Không dùng model" để giữ ảnh như cũ.
  - Tab **🎬 Nhiều cảnh** (`#/multi`) → `POST /api/multi` (`startMultiScene` trong `server/chat.ts`):
    mỗi cảnh một prompt, một model ("" = không dùng model), số giây, lời đọc tuỳ chọn, file dự phòng.
    Dựng thẳng `props.json` (style `plain`, không có script.json) và lưu đầu vào ở `videos/<slug>/multi.json`
    để mở lại bằng nút "Sửa cảnh" (`#/multi/<slug>`). Cảnh dài = max(số giây, lời đọc).

## Nhà cung cấp và key (ô ⚙ Cài đặt, nhóm "Tạo video bằng AI")

| Provider | Key | Model |
|---|---|---|
| Google Gemini | `GEMINI_API_KEY` | Veo 3.1 Lite / Fast / Standard — **không có gói miễn phí**, cần bật billing |
| fal.ai | `FAL_KEY` | Seedance 2.0 Fast, Kling 2.5 Turbo / 3 Pro, Wan 2.5, Veo 3.1 Fast |
| Replicate | `REPLICATE_API_TOKEN` | Veo 3.1 Lite / Fast, Seedance 2.0 Fast, Kling 3, Wan 2.5 Fast |

`AI_VIDEO_MODEL` chọn model mặc định; "Tự động" = model đầu tiên trong `VIDEO_MODELS` có key.

## Khi thêm model mới

Lấy tham số từ schema chính thức, **đừng viết từ trí nhớ** — mỗi model đặt tên và kiểu khác nhau
(Veo trên fal nhận `duration: "8s"`, Kling nhận `"5"`, Replicate nhận số nguyên, Wan dùng `size`):

- fal: `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<model id>`
- Replicate: `https://replicate.com/<owner>/<name>/api/schema`
- Gemini: https://ai.google.dev/gemini-api/docs/veo

Chỉ ghi `usdPerSecond` khi đã đối chiếu bảng giá chính thức. Bỏ qua model không cho chọn
tỉ lệ khung (vd. Hailuo text-to-video trả 16:9 cố định).

## Giới hạn cần nói trước với người dùng

- Mỗi lần tạo là một lượt tính tiền; clip 4–15 giây tuỳ model — cảnh dài hơn thì clip lặp.
- Mất 1–5 phút mỗi clip. Link tải của Veo hết hạn sau 2 ngày — code tải về ngay.
- Credit miễn phí hằng ngày của Kling/Hailuo/PixVerse chỉ dùng trên web của họ, không dùng qua API.
- Render video chậm hơn ảnh tĩnh. Đo lại throughput trước khi hứa thời gian.

## Đừng làm

Đừng bịa URL video hay model id. Đừng bấm tạo thử khi người dùng chưa đồng ý tốn tiền.
