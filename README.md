# AI Video Studio

Dựng video ngắn dọc 9:16 (TikTok / Reels / Shorts) bằng Remotion, có giao diện web
và pipeline chạy được từ một câu prompt hoặc từ file audio thu sẵn.

Thiết kế theo hướng **ưu tiên thứ miễn phí và chạy offline**: giọng đọc tiếng Việt,
phiên âm, nhạc nền và tiếng động đều không cần API key. Chỉ chạm dịch vụ trả phí khi
thứ miễn phí không làm được việc đó.

---

## Mục lục

1. [Yêu cầu](#1-yêu-cầu)
2. [Cài đặt](#2-cài-đặt)
3. [Bắt đầu nhanh](#3-bắt-đầu-nhanh)
4. [Cấu hình API key](#4-cấu-hình-api-key)
5. [Giao diện web](#5-giao-diện-web)
6. [Dòng lệnh](#6-dòng-lệnh)
7. [Cách hoạt động](#7-cách-hoạt-động)
8. [Cấu trúc thư mục](#8-cấu-trúc-thư-mục)
9. [Giới hạn đã đo](#9-giới-hạn-đã-đo)
10. [Xử lý sự cố](#10-xử-lý-sự-cố)
11. [Agent Skills](#11-agent-skills)

---

## 1. Yêu cầu

> **Dùng app desktop** (bộ cài `.dmg` cho macOS, `.exe` cho Windows): không cần cài gì thêm —
> app đã kèm Node, ffmpeg và Chrome dựng video. Phần dưới dành cho chạy từ mã nguồn.

| | Bản đã kiểm chứng | Bắt buộc |
|---|---|---|
| Node.js | v20.19.6 | ✅ (cần ≥ 20.12 cho `process.loadEnvFile`) |
| ffmpeg + ffprobe | 9.0.1 | ✅ — dùng cho mọi khâu audio và ảnh |
| Hệ điều hành | macOS 26 (Darwin 25.6) | macOS, Windows, Linux đều chạy được — khác nhau ở giọng đọc miễn phí (bảng dưới) |

Giọng đọc miễn phí, offline theo hệ điều hành:

| Hệ điều hành | Giọng miễn phí | Ghi chú |
|---|---|---|
| macOS | `say` — giọng Việt `Linh` | Có sẵn |
| Windows | Giọng nói Windows (SAPI) | Cần cài gói giọng tiếng Việt: Settings → Time & Language → Speech |
| Linux | Chưa hỗ trợ | Dùng ElevenLabs/EverAI hoặc audio thu sẵn |

Kiểm tra nhanh (macOS/Linux dùng Terminal, Windows dùng PowerShell):

```bash
node -v
```

```bash
ffmpeg -version
```

Chưa có ffmpeg:

| Hệ điều hành | Lệnh cài |
|---|---|
| macOS | `brew install ffmpeg` |
| Windows | `winget install Gyan.FFmpeg` (mở lại PowerShell sau khi cài) |
| Ubuntu/Debian | `sudo apt install ffmpeg` |

---

## 2. Cài đặt

```bash
npm install
```

Không cần API key nào để bắt đầu — xem [Bắt đầu nhanh](#3-bắt-đầu-nhanh).

---

## 3. Bắt đầu nhanh

### Cách 1 — Giao diện web (dễ nhất)

```bash
npm start
```

Mở **http://localhost:5177**. Làm được toàn bộ quy trình bằng chuột.

### Cách 2 — Từ một câu prompt

Cần `ANTHROPIC_API_KEY`.

```bash
npm run prompt-to-video -- "5 mẹo tiết kiệm pin iPhone" --voice linh
```

### Cách 3 — Không cần key nào

Tự viết kịch bản rồi dựng bằng giọng tiếng Việt của macOS:

```bash
mkdir -p videos/thu-nghiem
cat > videos/thu-nghiem/script.json <<'EOF'
{
  "title": "Ngủ đủ giấc",
  "subtitle": "ba con số đáng nhớ",
  "handle": "@kenh",
  "accent": "#38bdf8",
  "background": "#0a1220",
  "scenes": [
    {
      "image": null,
      "visual": { "type": "stat", "text": "7-9", "caption": "giờ ngủ mỗi đêm" },
      "lines": ["Người lớn cần bảy đến chín giờ.", "Ngủ ít hơn là nợ, không phải tiết kiệm."]
    }
  ]
}
EOF
npm run prompt-to-video -- --name thu-nghiem --voice linh
```

Kết quả ở `out/thu-nghiem.mp4`.

### Cách 4 — Từ file audio thu sẵn

Giọng thật của bạn, phụ đề tự khớp lời nói. Lần đầu sẽ tải whisper.cpp + model
(~1.5GB), sau đó chạy hoàn toàn offline.

```bash
npm run audio-to-video -- ~/Downloads/giong.mp3 --name bai-noi
```

---

## 4. Cấu hình API key

Copy `.env.example` thành `.env` rồi điền. **Không key nào bắt buộc** — thiếu cái nào
thì chỉ mất chức năng tương ứng.

```bash
cp .env.example .env
```

| Biến | Dùng cho | Thiếu thì sao | Lấy ở đâu |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Sinh kịch bản từ prompt | Tự viết `script.json` | [console.anthropic.com](https://console.anthropic.com) |
| `ELEVENLABS_API_KEY` | Giọng đọc, nhạc/sfx AI | Dùng giọng miễn phí của máy (`--voice linh` trên macOS) | [elevenlabs.io](https://elevenlabs.io) |
| `PEXELS_API_KEY` | Ảnh chụp thật | Dùng `visual` hoặc tự bỏ ảnh vào | [pexels.com/api](https://www.pexels.com/api/) — free 25k req/tháng |
| `GEMINI_API_KEY` | Sinh ảnh AI | Dùng Pexels | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — **sinh ảnh cần bật billing** |

Biến tuỳ chọn: `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `SAY_VOICE`, `PORT`.

**Không có key nào vẫn viết kịch bản bằng AI được:** bộ cài desktop kèm sẵn một AI nhỏ chạy trên máy
(llama.cpp + Qwen2.5 1.5B, không cần mạng, không cần cài thêm). Chạy từ mã nguồn thì tải nó bằng
`bash desktop/fetch-local-ai.sh mac-arm64`, hoặc cài Ollama và chọn "Ollama" trong ⚙️ Cài đặt.
Cách hoạt động, chọn model và kết quả đo thật: [docs/ai-tren-may.md](docs/ai-tren-may.md).

> `.env` đã nằm trong `.gitignore`. Đừng commit nó.

---

## 5. Giao diện web

```bash
npm start   # http://localhost:5177
```

Server là `node:http`, UI là một file HTML tĩnh — **không framework, không bước build**.

### Flow — màn hình chính

Trên cùng là dãy 5 node theo đúng thứ tự pipeline:

```
Kịch bản → Giọng đọc → Ảnh → Nhạc nền → Render
```

Mỗi node có chấm màu cho biết trạng thái:

| Màu | Nghĩa |
|---|---|
| 🟢 xanh | xong |
| 🟡 vàng | **cũ** — dữ liệu đã đổi sau bước này |
| 🔴 đỏ | thiếu |
| ⚫ xám | không dùng |

"Cũ" tính bằng thời gian sửa file: `script.json` mới hơn `props.json` nghĩa là giọng
đã cũ; `props.json` mới hơn `.mp4` nghĩa là bản render đã cũ. Đây là thứ khó thấy nhất
khi làm thủ công — sửa chữ xong quên render lại là chuyện thường.

Bấm node để mở đúng tab tương ứng. Node **Giọng đọc** và **Render** có nút
**"Chạy bước này"** — chạy riêng một bước, không đụng các bước khác.

> Chạy riêng bước Giọng đọc sẽ **không** render. Xong rồi bấm node Render.
> Ngược lại, Render đọc thẳng `props.json` nên **không** đụng tới giọng —
> giữ nguyên phụ đề bạn đã sửa tay.

### Tab Cảnh — nơi làm việc chính

Thanh cài đặt trên cùng: **loại đầu ra** (video / ảnh), **tỉ lệ**, **nhạc nền**.

5 tỉ lệ, mỗi tỉ lệ có vùng an toàn riêng — 9:16 phải chừa nhiều vì nền tảng
short-form vẽ UI đè lên, 16:9 xem trên desktop gần như không bị che:

| Tỉ lệ | Kích thước | Chừa đỉnh/đáy/hai bên |
|---|---|---|
| 9:16 | 1080×1920 | 120 / 320 / 120 |
| 3:4 | 1080×1440 | 90 / 200 / 90 |
| 1:1 | 1080×1080 | 80 / 160 / 80 |
| 16:9 | 1920×1080 | 60 / 100 / 90 |
| 2:1 | 1920×960 | 50 / 90 / 90 |

Bên dưới là **thẻ từng cảnh**, mỗi thẻ có: ô prompt multiline (mỗi dòng một câu phụ đề),
ô ảnh nền + tìm ảnh Pexels, hình vẽ bằng code, và **khung kết quả bên phải** hiện
ảnh/video của riêng cảnh đó kèm nút tải xuống.

Nút **Tạo** trên mỗi thẻ render **riêng cảnh đó** ra `out/scenes/<slug>-<N>.mp4`
(hoặc `.png` nếu chọn loại Ảnh) — nhanh hơn render cả video, và nhiều cảnh chạy
song song được. Giọng chỉ sinh lại khi kịch bản đã đổi.

**+ Thêm cảnh** để thêm, **Gộp các cảnh thành 1 video** để nối lại.

### 🏭 Hàng loạt — làm nhiều video một lượt

Nút **🏭 Hàng loạt** trên thanh trên (hoặc `#/batch`). Đưa vào một danh sách, đặt cài đặt
một lần, rồi để máy chạy lần lượt.

Ba nguồn đầu vào, chung một hàng đợi:

| Nguồn | Đưa vào | Mỗi video là |
|---|---|---|
| 💡 **Danh sách ý tưởng** | mỗi dòng một ý tưởng — gõ tay, dán từ Sheets, tải `.txt`/`.csv` lên, hoặc bấm **Nghĩ ý tưởng** để AI đẻ ra N ý từ một chủ đề | một dòng |
| 🧩 **Mỗi video một ô** | một ô chữ nhật — **bấm vào ô mới hiện ô nhập**; bấm **＋ Thêm ô** để thêm ô nữa. Mỗi ô đặt riêng được **Lời · Phong cách · Khung · Giọng · Hình · Nhạc** | một ô |
| 🎙 **File thu sẵn** | nhiều file audio/video | một file — phiên âm bằng whisper.cpp **chạy trên máy**, không cần key |
| 🔁 **Biến thể của 1 video** | một video đã có kịch bản + tích tỉ lệ / giọng / ngôn ngữ | một tổ hợp — đổi ngôn ngữ thì dịch lại toàn bộ lời |

Màn soạn đi theo ba bước như màn tạo video thường: **1 ·** chọn nguồn → **2 ·** mỗi cài đặt
một ô riêng (bấm vào ô nào mở đúng menu của cài đặt đó: lời, AI, phong cách, khung, hình,
giọng, nhạc, duyệt lời) → **3 ·** ô nhập to nhất ở dưới cùng. Với nguồn 🧩 **Mỗi video một ô**,
cài đặt ở bước 2 là **mặc định** — ô nào đặt riêng thì ô đó thắng, chip của nó sáng lên; nên
một loạt trộn được nhiều phong cách, nhiều khung hình, nhiều giọng. Một dòng ngay dưới bước 2 nói
trước loạt sẽ chạy ra thế nào và thiếu key gì. Chọn **📝 Lời có sẵn** thì mỗi video là một
khối, ngăn nhau bằng dòng `---`; nguồn file thu sẵn thì kéo thả thẳng vào ô lớn.

**Chốt duyệt lời** (bật sẵn): cả loạt viết kịch bản xong thì dừng lại. Bạn đọc ngay trên
bảng, bấm ✏️ Sửa lời để mở video đó ra chỉnh, rồi **✓ Duyệt** từng cái hoặc **Duyệt tất cả**.
Lý do: viết kịch bản mất vài giây và gần như miễn phí, còn render mất cả phút mỗi video —
duyệt trước thì không đốt thời gian render nội dung hỏng. Tắt công tắc này là chạy một mạch.

Bảng theo dõi cũng là lưới ô đó: đang chạy thì ô hiện thanh tiến độ, xong thì ô hiện **ảnh
bìa** (ffmpeg cắt một khung, lưu ở `public/thumbs/`) — bấm ảnh mới nạp và phát video. Làm vậy
vì một loạt 50 video mà mỗi ô gắn sẵn một thẻ `<video>` là 50 lần tải metadata, cuộn tới đâu
khựng tới đó. **Bấm vào ô (chỗ khác ảnh) là ra lại ô nhập** để sửa nội dung rồi làm lại — sửa
xong dựng đè lên đúng video cũ, không đẻ thêm video rác trong Thư viện.

Trên đầu bảng có thanh tiến độ cả loạt, ước tính **còn bao lâu** (tính từ chính những video đã
xong trong loạt, không đoán mò), và tiến độ hiện luôn ở **tiêu đề tab** để bạn chuyển tab đi
làm việc khác. Xong cả loạt thì có thông báo + một tiếng chuông.

Xong rồi thì **⬇ Tải tất cả** gói mọi mp4 thành một file zip (đánh số theo đúng thứ tự trong
loạt: `01-…mp4`, `02-…mp4`), và **📄 CSV** xuất bảng tiêu đề · lời đọc · tên file · khung ·
phong cách để dán khi đăng bài.

Lỗi một mục **không** làm dừng cả loạt: mục đó chuyển sang ⚠️, bấm ⟳ Thử lại riêng nó. Mục
đã có kịch bản thì thử lại chạy thẳng từ bước dựng, không gọi AI viết lại lời.

**Chạy cùng lúc bao nhiêu:** render và phiên âm ăn trọn CPU nên chỉ **một** việc nặng chạy
một lúc — hai bản render song song chỉ làm cả hai cùng chậm. Riêng khâu gọi AI viết lời là
chờ mạng nên cho 2 cái song song.

Loạt lưu ở `data/batches/<id>.json` nên tắt app mở lại vẫn còn: mục đang chạy dở quay về
hàng đợi, loạt về ⏸ tạm dừng, bấm ▶ Chạy tiếp là đi tiếp. Xoá loạt chỉ xoá bảng theo dõi —
video đã tạo vẫn nằm trong Thư viện.

Mỗi video xong là một video bình thường trong `videos/<slug>/` kèm `chat.json`: mở lại, nhắn
sửa tiếp, mở trình chỉnh sửa hay xoá đều giống hệt video làm tay.

### Tab Thư viện
Tất cả ảnh và video đã tạo từ **mọi cuộc**, kèm dung lượng và nút tải.

### Tab Tạo
Nhập prompt → sinh `videos/<slug>/script.json`. Cần `ANTHROPIC_API_KEY`.

### Tab Sửa kịch bản
Sửa tiêu đề, handle, màu, và từng cảnh. Mỗi cảnh chia 2 cột:

- **Trái**: đường dẫn ảnh · ô **tìm ảnh Pexels** (gõ từ khoá tiếng Anh → lưới thumbnail
  → bấm chọn → tự tải về đúng 1080×1920, tự điền đường dẫn, tự ghi công tác giả) ·
  hình vẽ bằng code (`stat` con số lớn / `badge` nhãn bước)
- **Phải**: các câu phụ đề, mỗi dòng một câu

### Tab Ảnh & file
Lấy ảnh hàng loạt theo nhiều truy vấn, hoặc tải file lên (ảnh / nhạc / sfx / video clip).

### Tab Nhạc & tiếng
- **Sinh bằng ffmpeg** — 5 mood nhạc (`calm` `upbeat` `dramatic` `warm` `tense`),
  5 loại tiếng động (`whoosh` `pop` `ding` `riser` `thud`). Offline, miễn phí,
  nghe thử ngay trong trang.
- **Sinh bằng ElevenLabs theo mô tả ngữ cảnh** — cần key có quyền `music_generation`
  và `sound_generation`.

### Tab Ghép video
Bấm chọn nhiều video **theo thứ tự** (số 1, 2, 3 hiện lên) rồi nối thành một file.

### Panel Dựng & render
Bật/tắt bằng nút trên header. Chọn composition, giọng, vị trí phụ đề, nhạc nền;
render kèm thanh tiến độ; xem trước và tải mp4 ngay trong trang.

> **Checkbox "Sinh lại giọng"** là thứ quan trọng nhất ở đây. Bỏ chọn = render lại từ
> `props.json` có sẵn, **không gọi API**, giữ nguyên phụ đề bạn đã sửa tay. Đây đúng là
> quy trình cần dùng sau khi soát lại transcript.

> Badge key ở góc phải chỉ kiểm tra key **có trong `.env`** — không gọi API thử quyền.
> Dấu ✓ không có nghĩa là dịch vụ chạy được.

---

## 6. Dòng lệnh

| Lệnh | Việc |
|---|---|
| `npm start` | Mở giao diện web |
| `npm run dev` | Remotion Studio (xem trước, sửa props bằng chuột) |
| `npm run prompt-to-video -- …` | prompt hoặc kịch bản → mp4 |
| `npm run audio-to-video -- <file> …` | file audio → mp4 |
| `npm run render-all` | Render lại mọi video trong `videos/`, không gọi API |
| `npm run fetch-images -- …` | Tải ảnh từ Pexels/Gemini |
| `npm run images` | Bảng ảnh ↔ video ↔ cảnh, báo ảnh thiếu file |
| `npm run lint` | eslint + tsc |

### `prompt-to-video`

```bash
npm run prompt-to-video -- "chủ đề"                    # sinh kịch bản mới
npm run prompt-to-video -- --name <slug>               # render lại, KHÔNG gọi API
npm run prompt-to-video -- --name <slug> --voice linh  # đổi giọng
npm run prompt-to-video -- --list-voices               # catalog giọng
npm run prompt-to-video -- --list-voices --live        # giọng thật trong tài khoản
```

| Flag | Giá trị | Mặc định |
|---|---|---|
| `--name` | tên thư mục | suy từ prompt (bỏ dấu tiếng Việt) |
| `--voice` | tên trong catalog hoặc `voice_id` ElevenLabs | `elevenlabs` |
| `--sub` | `bottom` \| `center` | `bottom` |
| `--music` | đường dẫn từ `public/`, hoặc `none` | `music/placeholder.mp3` |
| `--no-sfx` | tắt tiếng chuyển cảnh | bật |
| `--tts` | `elevenlabs` \| `say` \| `none` | theo `--voice` |
| `--script-only` | chỉ sinh kịch bản, không render | — |

### `audio-to-video`

```bash
npm run audio-to-video -- giong.mp3 --name bai-noi --model medium --sub center
```

| Flag | Giá trị | Mặc định |
|---|---|---|
| `--model` | `small` \| `medium` (đã test) · `large-v3` (chưa test) · `large-v3-turbo` **hỏng** | `medium` |
| `--lang` | mã ngôn ngữ | `vi` |
| `--title` `--subtitle` `--handle` `--accent` `--background` | metadata | có sẵn |

### `fetch-images`

```bash
npm run fetch-images -- --name <slug> "query tiếng Anh" "query 2"
npm run fetch-images -- --name <slug> --source gemini "mô tả"
```

Truy vấn phải viết **tiếng Anh** — Pexels đánh index tiếng Anh.

### Sinh nhạc và tiếng động

```bash
npx tsx scripts/make-audio.ts music calm 30
npx tsx scripts/make-audio.ts sfx whoosh
```

---

## 7. Cách hoạt động

### Luồng dữ liệu

```
prompt ──► script.json ──► [TTS] ──► props.json ──► render ──► out/<slug>.mp4
             nội dung                 timing thật
             (sửa ở đây)              + đường dẫn audio

audio ─────────────────► [whisper] ──► props.json ──► render
                          timestamp thật
```

`script.json` là **nguồn sự thật của nội dung**. `props.json` là kết quả tính toán —
sửa được nhưng sẽ bị ghi đè khi sinh lại giọng.

### Bốn quyết định thiết kế

**1. LLM viết chữ, code tính giờ.** Model không bao giờ đặt `startMs`/`endMs`. Timing
lấy từ độ dài audio thật (đo bằng `ffprobe`), hoặc suy từ số ký tự khi chưa có audio.
Model đặt timing rất hay lệch, mà timing sai thì phụ đề chồng nhau.

**2. Không dùng `<TransitionSeries>`.** Nó rút ngắn timeline mỗi khi có transition, làm
chữ lệch khỏi tiếng — phá đúng thứ điểm 1 vừa bảo đảm. Chuyển cảnh làm bằng `opacity`
trong `src/scenes/Scenes.tsx`, timeline không đổi một frame.

**3. Vùng an toàn 9:16.** `SAFE` trong `src/constants.ts` chừa 120px đỉnh, 320px đáy,
120px hai bên — nền tảng vẽ UI của họ đè lên đó. Kiểm bằng pixel, không tin CSS:

```bash
ffmpeg -v error -i still.png -vf "crop=1080:320:0:1600,format=gray" -f rawvideo - \
  | python3 -c "import sys;d=sys.stdin.buffer.read();print('YMAX',max(d))"
```

Dải đáy YMAX thấp = sạch. Có chữ trong đó là chữ sẽ bị nuốt.

**4. Ngắt dòng phụ đề theo KÝ TỰ (42), không theo số từ.** Tiếng Việt mỗi âm tiết tính
là một từ nên "7 từ" chỉ bằng ~3 từ tiếng Anh, dòng ngắn cụt và cắt giữa cụm. 42 ký tự
là chuẩn phụ đề quốc tế, đúng cho mọi ngôn ngữ.

### Ba composition

Dùng chung một schema, khác nhau ở lớp phủ — sửa `Short` là cả ba cùng được:

| | Thêm gì |
|---|---|
| `Short` | bản gốc |
| `LongVideo` | nhãn "CHƯƠNG N" đầu mỗi cảnh |
| `Explainer` | dãy chấm chỉ bước hiện tại |

### Thứ tự lớp — đảo là hỏng

```
Background → Scenes → Scrim → SceneVisual → TitleCard → Captions → Soundtrack → ProgressBar
```

`Background` là `AbsoluteFill` có `backgroundColor` đục. Đặt nó **sau** `Scenes` là che sạch ảnh.

---

## 8. Cấu trúc thư mục

```
.claude/
  skills/            9 skill riêng + 14 skill cài từ registry
  commands/          create-short, create-video, create-long, generate-assets, review-video
server/
  index.ts           HTTP server + SSE
  api.ts             logic, dùng lại module trong scripts/
  chat.ts            một video = một cuộc chat; pipeline tách 2 bước (kịch bản / dựng)
  batch.ts           làm nhiều video một lượt: hàng đợi, chốt duyệt, biến thể
  jobs.ts            job chạy nền
  public/            index.html + app.js  (UI)
src/
  constants.ts       FPS, WIDTH, HEIGHT, SAFE, TITLE_FRAMES, msToFrames
  Root.tsx           đăng ký 3 composition
  compositions/
    Short/           index.tsx (component + calculateMetadata), schema.ts,
                     script.ts (schema cho LLM + tính timing), defaultProps.ts
    LongVideo/  Explainer/
  scenes/            Background, Scenes (ảnh + cross-fade + Ken Burns), Scrim, SceneVisual
  captions/          Captions
  audio/             Soundtrack, mix.ts (hàm thuần tính volume — kiểm chứng không cần render)
  components/        TitleCard, Watermark, ProgressBar, ChapterMarker, StepTracker
scripts/
  prompt-to-video    CLI: prompt → mp4
  audio-to-video     CLI: audio → mp4
  generate-script    prompt → VideoScript (Claude API)
  tts / voices       TTS + catalog giọng
  transcribe         whisper.cpp
  group-captions     token → từ → dòng 42 ký tự
  pexels / gemini-image / fetch-images    nguồn ảnh
  images / list-images                    quy ước ảnh + kiểm tra
  ideas              chủ đề → danh sách ý tưởng (cho chế độ hàng loạt)
  make-audio         sinh nhạc theo mood + sfx
  render / render-all
public/
  images/<slug>/     ảnh riêng từng video
  images/shared/     ảnh dùng chung
  music/  sfx/       nhạc nền + tiếng động (ffmpeg sinh ra)
  voices/<slug>/     voiceover sinh ra — gitignored
  videos/            clip (chưa dùng)
videos/<slug>/       script.json (nội dung) + props.json (timing) + chat.json (lịch sử)
data/batches/        mỗi loạt một file json — trạng thái từng video trong loạt
docs/                tài liệu chi tiết
out/                 mp4 xuất ra — gitignored
```

---

## 9. Giới hạn đã đo

Số đo trên máy phát triển (Apple Silicon, Node 20.19.6, ffmpeg 9.0.1).

### Tốc độ

| | Số đo |
|---|---|
| Render | **27 frame/s** ở 1080×1920 (~1.1× realtime) |
| Video 75.8s (2275 frame) | 84.1s (bundle đã cache) · 91.5s (tính cả bundle) |
| Bundle | ~2s, cache lại trong cùng process — N video chỉ bundle một lần |
| Phiên âm `medium`, audio 41.6s | ~15s |

### Trạng thái từng dịch vụ

| Dịch vụ | Trạng thái | Ghi chú |
|---|---|---|
| Remotion | ✅ | 4.0.523 |
| whisper.cpp | ✅ | offline, model `medium` |
| macOS `say` | ✅ | giọng Việt `Linh`, không giới hạn |
| ffmpeg (nhạc/sfx) | ✅ | 5 mood, 5 sfx |
| Pexels | ✅ | 25.000 req/tháng |
| Canva MCP | ✅ | sinh design **có chữ**, phải lọc bằng mắt |
| ElevenLabs TTS | ⚠️ | 21/23 giọng dùng được, **0 giọng tiếng Việt** |
| ElevenLabs nhạc/sfx | ❌ | key thiếu quyền `music_generation`/`sound_generation` |
| Gemini ảnh | ❌ | 403 — sinh ảnh **không có free tier**, cần bật billing |

### Những chỗ KHÔNG chạy được, kèm nguyên nhân

**`large-v3-turbo` không dùng được.** `transcribe()` chết với
`unknown DTW preset 'large.v3.turbo'` — whisper.cpp 1.5.5 chưa biết preset đó. Nâng
`installWhisperCpp` lên 1.7.4 thì `make` fail (exit 2): bản mới chỉ ủy thác sang
`cmake`, mà package vẫn gọi Makefile cũ. `brew install cmake` là điều kiện để mở đường này.

**whisper.cpp 1.5.5 làm vỡ UTF-8 tiếng Việt.** Một số ký tự ra `U+FFFD`: `"Dư<?>i"`,
`"c<?>"`, `"ch<?>ng"`. Kiểm tra JSON thô cho thấy ký tự đã hỏng **ngay trong output của
whisper** — không sửa được bằng code. Bật hay tắt `tokenLevelTimestamps` đều vỡ như nhau.

**ElevenLabs gói free chặn mọi giọng tiếng Việt.** Cả 6 giọng Việt trong tài khoản
(Giang, Đô Trịnh, Tuyết, Thúy Tiên, Chi, Khánh Lâm) đều trả `402 paid_plan_required`.
**Thêm giọng từ thư viện vào tài khoản không gỡ được** — giới hạn nằm ở tầng API.

**`eleven_multilingual_v2` KHÔNG hỗ trợ tiếng Việt.** `/v1/models` chỉ liệt kê `vi` cho
`eleven_v3`, `eleven_v3_conversational`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`.
Model kia vẫn phát ra âm nên nghe qua tưởng chạy được.

**Gemini sinh ảnh không có free tier.** Cả ba model ảnh đều ghi "Not available" ở cột
Free Tier. Phải bật billing cho project Google Cloud.

### Phụ đề LUÔN phải soát tay

Hai lý do, cả hai đã gặp thật: ASR không biết tên riêng ("Dế Mèn" → "dế men"), và
whisper làm vỡ UTF-8. Quy trình: chạy một lần → sửa `videos/<slug>/props.json` →
`npm run render-all` (**không phiên âm lại**).

```bash
grep -c '�' videos/<slug>/props.json   # phải là 0
```

---

## 10. Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `ENOENT: … bundle.js` khi render | `Config.setRspack(true)` bundle xong không emit JS | Đã tắt trong `remotion.config.ts`, đừng bật lại |
| `Not allowed to access design` (Canva) | Truyền `width`/`height` vào `export-design` | Bỏ hai tham số đó — design vốn đã 1080×1920 |
| `402 paid_plan_required` (ElevenLabs) | Giọng là library voice, gói free chặn | Dùng giọng `premade`, hoặc `--voice linh` |
| `401 missing permission …` | Key thiếu quyền | Sửa quyền key trong dashboard, không cần tạo key mới |
| Ảnh không hiện trong video | `Background` render sau `Scenes` | Giữ đúng thứ tự lớp ở mục 7 |
| `inputRange must be strictly monotonically increasing` | Hai mốc `interpolate` bằng nhau | Tách nhánh cho cảnh đầu/cuối |
| Video thiếu stream audio | Kiểm bằng `ffprobe` | `ffprobe -v error -show_entries stream=codec_type -of csv=p=0 out/x.mp4` |
| Watermark bị che khi đăng | Nằm trong dải đáy 320px | Dùng `WATERMARK_BOTTOM` trong `constants.ts` |
| Ảnh thiếu file | Đường dẫn sai trong `script.json` | `npm run images` để xem chỗ nào `← THIẾU FILE` |

---

## 11. Agent Skills

23 skill trong `.claude/skills/` (khoá phiên bản ở `skills-lock.json`).

**9 skill riêng của project** — viết từ những gì đã kiểm chứng, kèm số đo thật và cả
những thứ không làm được:

`video-director` (router) · `short-video` · `long-video` · `script-writing` ·
`storyboard` · `image-generation` · `video-generation` · `voice-generation` · `remotion`

**14 skill cài từ registry:**

- 12 skill Remotion chính thức (`remotion-dev/skills`) — kỹ thuật
- `short-form-video` — hook, retention, vùng an toàn 9:16
- `motion-design` — nguyên tắc Disney, timing/easing

**5 slash command:** `/create-short` `/create-video` `/create-long` `/generate-assets`
`/review-video` — ba cái đầu và cuối phỏng theo
[DojoCodingLabs/remotion-superpowers](https://github.com/DojoCodingLabs/remotion-superpowers) (MIT).

```bash
npx skills find "từ khoá"    # tìm skill mới
npx remotion upgrade         # nâng Remotion + skill Remotion cùng lúc
```

Tài liệu chi tiết hơn về pipeline: [docs/prompt-to-video.md](docs/prompt-to-video.md).
AI viết kịch bản chạy trên máy (có sẵn trong app, hoặc Ollama): [docs/ai-tren-may.md](docs/ai-tren-may.md).
Video xong bấm **✍️ Gợi ý bài đăng**: AI viết tiêu đề, caption, hashtag cho TikTok, YouTube, Facebook, Instagram
từ lời trong video (`scripts/post-copy.ts`, lưu ở `videos/<slug>/post-copy.json`).

---

## License

Remotion yêu cầu license cho một số tổ chức —
[đọc điều khoản](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

Ảnh từ Pexels bắt buộc ghi công tác giả; script tự ghi vào
`public/images/<slug>/CREDITS.txt`, nhớ đưa vào phần mô tả khi đăng.
