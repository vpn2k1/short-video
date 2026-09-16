---
name: long-video
description: Video dài hơn 60 giây — chọn độ dài, AI viết theo chương, chia cảnh, giữ nhịp. Dùng khi làm explainer, kể chuyện dài, video nhiều phần, hoặc khi người dùng yêu cầu một độ dài cụ thể.
---

# Long Video

## Trạng thái thật

Project có **ba** composition dùng chung một schema (`src/Root.tsx`):

| Composition | Khác gì `Short` | Dùng khi |
|---|---|---|
| `Short` | — | mặc định, mọi đường tạo video của web đều render cái này |
| `LongVideo` | thêm nhãn "Chương N" 2,2s ở đầu mỗi cảnh (`src/components/ChapterMarker.tsx`) | video nhiều chương, người xem cần biết đang ở đâu |
| `Explainer` | thêm dãy chấm chỉ bước hiện tại (`src/components/StepTracker.tsx`) | hướng dẫn từng bước |

Cả ba nhận đúng một `props.json` và dùng chung `calculateShortMetadata` — đổi composition
không làm lệch timing một frame nào.

**Bản thân composition không giới hạn độ dài.** `calculateShortMetadata`
([index.tsx:33](../../../src/compositions/Short/index.tsx)) lấy mốc kết thúc muộn nhất của
captions / scenes / audioClips / texts / overlays rồi cộng 1 giây outro. Dài bao nhiêu cũng
render được — chỉ tốn thời gian. `shortSchema.scenes` và `shortSchema.captions` là mảng
**không có `.max()`**.

Video dài nhất đã dựng và kiểm chứng (16/09/2026): **287,1s** — prompt "Tạo video kiến thức dài 5 phút
về hệ Mặt Trời", Groq viết theo 5 chương (~2 phút, gồm thời gian đợi giới hạn lượt), 25 cảnh, 100 câu,
giọng `linh`, không hình. Dựng mất 445s (giọng đọc + render).

Nhịp ~3s/câu đúng khi **có giọng đọc** (đo: 2,69s + 0,15s nghỉ). Không giọng thì thời lượng mỗi câu
tính theo số từ (`lineDurationMs`) và dài hơn ~25% — 100 câu ra ~6 phút.

## Chọn độ dài — thứ tự ưu tiên

Code ở `scripts/video-length.ts` (`resolveLength`). Dừng ở mục đầu tiên có giá trị:

1. **Chip "Độ dài" trong ô nhập của web** (`settings.length`: `15 | 30 | 60 | 180 | 300 | 600 | free`)
   — thắng cả câu prompt mâu thuẫn: prompt "ngắn thôi" mà chip để 5 phút thì làm 5 phút.
2. Chip để **"✨ Tự động"** (`auto`) → `lengthFromPrompt` đọc độ dài trong câu prompt: "5 phút", "5p",
   "tầm 90s", "1 phút 30", "nửa phút", "không giới hạn", "dài bao nhiêu cũng được".
   Chỉ nhận con số đứng sau chữ ngữ cảnh (video, dài, khoảng, tầm, trong…) — "tập 3 phút mỗi ngày",
   "top 5", "5 phần" không bị hiểu nhầm là độ dài.
3. **Không nguồn nào nói gì** → video ngắn 15–30 giây như trước.

CLI: `npx tsx scripts/prompt-to-video.ts "..." --length 300`.

"Không giới hạn" (`free`) = không nhắm số giây nào: AI lập dàn ý 3–10 chương tuỳ chủ đề rồi viết
đủ ý từng chương. Không phải "viết dài nhất có thể".

### Quy độ dài ra số cảnh, số câu

`planFor(seconds)`: **~3 giây một câu**, trừ ~3s title card + outro.

| Độ dài | Số câu | Cảnh | Câu/cảnh | AI viết |
|---|---|---|---|---|
| 15s | 4 | 2 | 2 | 1 lượt |
| 30s | 9 | 5 | 2 | 1 lượt |
| 1 phút | 19 | 7 | 3 | 1 lượt |
| 3 phút | 59 | 15 | 4 | 3 chương |
| 5 phút | 99 | 25 | 4 | 5 chương |
| 10 phút | 199 | 50 | 4 | 10 chương |

Video dài mỗi hình giữ ~4 câu (~12s) — quá 15s một hình là đơn điệu.

Hướng dẫn `ai-guide` của cả 16 phong cách ghi số cảnh cho video ngắn ("3–5 cảnh"…). Prompt độ dài
ghi rõ nó **thắng** các con số đó (`OVERRIDE_NOTE`): giữ giọng văn và nhịp câu của phong cách, chỉ
đổi số lượng. Đừng sửa từng skill phong cách để thêm luật video dài.

## AI viết video dài thế nào

Một lượt gọi AI mà đòi 100 câu JSON thì hỏng — đã đo: Groq (`gpt-oss-120b`) trả 400 "Failed to
generate JSON" và nội dung thật là lời từ chối; Gemini chỉ viết được ~1/3. Nên quá 30 câu thì
`generateLong` trong `scripts/generate-script.ts` chia làm nhiều lượt:

1. **Dàn ý** — cùng schema kịch bản, nhưng mỗi phần tử `scenes` là một chương (`OUTLINE_RULES`).
   Lượt này quyết định title, subtitle, màu, phong cách cho cả video.
2. **Từng chương** — ≤ 20 câu một lượt (`CHAPTER_LINES`), kèm cả dàn ý và 2 câu cuối chương trước để
   nối mạch; phong cách khoá theo dàn ý (`CHAPTER_RULES`).
3. **Ghép** các cảnh lại, kiểm bằng `videoScriptSchema`.

Gói miễn phí giới hạn lượt/phút: `withRateLimitRetry` đợi theo gợi ý "try again in Xs" của nhà cung
cấp rồi thử lại (tối đa 3 lần). Video 5 phút bằng Groq mất ~2 phút viết, phần lớn là thời gian đợi.

Sửa video bằng chat (`editScript`) giữ nguyên độ dài, trừ khi câu sửa nêu độ dài hoặc chip lệch >30%
so với kịch bản hiện có. Kéo từ ngắn lên dài nhiều chương thì viết lại theo chương, lấy bản cũ làm gốc.

## Trần còn lại

| Đường tạo | Trần | Ở đâu |
|---|---|---|
| AI viết kịch bản | **200 cảnh** × 12 câu (trần an toàn, ~40 phút) | `MAX_SCRIPT_SCENES` — `src/compositions/Short/script.ts` |
| Dán kịch bản có sẵn | 200 cảnh | `MAX_SCENES` — `scripts/text-script.ts` (lấy từ trên) |
| Từng cảnh một (multi-scene) | **100 cảnh**, mỗi cảnh 2–15s (~25 phút) | `MAX_MULTI_SCENES` — `server/chat.ts` + `server/public/app.js` |
| Ghi thẳng `props.json` / trình chỉnh sửa | không có trần | `shortSchema` |
| Composition | không có trần | `calculateShortMetadata` |

Cần vượt cả 200 cảnh: làm nhiều video rồi nối bằng `/api/concat` (`concatVideos` trong
`server/api.ts`, ≥ 2 video, không trần trên, tự chèn im lặng cho đoạn không tiếng).

## Vì sao dài không chỉ là thêm câu

`Short` thiết kế cho short-form: một câu phụ đề, nền tĩnh, không chuyển bố cục. Kéo dài nó
ra 3 phút mà không đổi gì thì người xem thấy y hệt nhau suốt — thất bại về nhịp, không phải
về kỹ thuật.

Video dài cần **thay đổi cấu trúc thị giác**, không phải thêm dòng:

| Cần | Làm bằng | Skill |
|---|---|---|
| Chia chương | nhiều cảnh, mỗi chương một hình nền | `storyboard` |
| Nhãn chương cho người xem bám | render bằng composition `LongVideo` | — |
| Dãy chấm chỉ bước | render bằng composition `Explainer` | — |
| Hình minh hoạ từng ý | ảnh theo cảnh | `image-generation` |
| Đổi bố cục giữa các phần | composition mới, hoặc biến thể layout | `remotion-markup/multi-scene-video.md` |
| Chuyển cảnh có hiệu ứng | `TransitionSeries` — **cẩn thận, xem dưới** | `remotion-markup/transitions.md` |

Quy tắc thực dụng: **một hình nền không giữ quá ~15 giây**. Quá mức đó thì tách cảnh, đổi
ảnh, hoặc cho ảnh chuyển động (`src/components/MediaMotion.tsx`).

## Chọn composition khi render

Giao diện web **không có** chỗ chọn composition — chat và mọi nút Xuất video đều render
`Short` (`renderShort` gọi với `composition = undefined`). Hai đường dùng được `LongVideo`:

```bash
# API của server — render thẳng từ props.json đã có
curl -s localhost:5177/api/stage/render -X POST -H 'content-type: application/json' \
  -d '{"slug":"<slug>","composition":"LongVideo"}'

# hoặc Remotion CLI
npx remotion render LongVideo out/<slug>.mp4 --props=videos/<slug>/props.json
```

`/api/stage/render`, `/api/render` và `/api/concat` đều trả về `{jobId}` rồi chạy nền — theo
dõi tiến độ qua job đó, đừng tưởng lệnh trả về là xong.

`/api/state` đã trả về `compositions: ["Short","LongVideo","Explainer"]` — giao diện chỉ
thiếu phần hiển thị, không thiếu backend.

## Bẫy: TransitionSeries và timeline

`<TransitionSeries>` **rút ngắn timeline** mỗi khi có transition. Toàn bộ phụ đề và
voiceover của project neo theo frame tuyệt đối lấy từ độ dài audio thật — dùng nó là chữ
lệch khỏi tiếng, và video càng dài thì lệch càng dồn.

Muốn dùng thật thì phải cộng bù `transition.getDurationInFrames({fps})` vào mọi mốc caption
sau điểm chuyển. Hoặc giữ cách hiện tại — cross-fade bằng `opacity`
(`src/scenes/Scenes.tsx`), timeline không đổi một frame.

## Chi phí render

27 frame/s ở 1080×1920, tuyến tính theo số frame (~1,1× realtime):

| Độ dài video | Thời gian render |
|---|---|
| 30s | ~33s |
| 1 phút | ~66s |
| 3 phút | ~3,3 phút |
| 10 phút | ~11 phút |

Ước lượng và **nói trước cho người dùng** khi video quá 2 phút — đừng để họ ngồi chờ không
biết bao lâu. Nối bằng `/api/concat` còn tốn thêm một lượt mã hoá lại toàn bộ.

## Trước khi báo xong

Video dài thì lỗi bố cục ở chương 5 không lộ ra khi xem chương 1. Render still ở **vài mốc
rải đều**, rồi đọc lại chính các file ảnh đó:

```bash
npx remotion still Short out/check-1.png --frame=200  --props=videos/<slug>/props.json
npx remotion still Short out/check-2.png --frame=2000 --props=videos/<slug>/props.json
```
