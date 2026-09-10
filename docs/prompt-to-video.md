# Prompt → Video

Hai chế độ, dùng chung một bộ component Remotion:

| | Chế độ dev-time | Pipeline tự động |
|---|---|---|
| Ai viết code | Claude, theo prompt của bạn | Không ai — code đã cố định |
| LLM sinh ra gì | **Code React** (component, animation mới) | **Dữ liệu JSON** (chữ, màu, timing) |
| Cần API key | Không | Có |
| Dùng khi | Thay đổi *hình thức* video | Thay đổi *nội dung* video |

Nguyên tắc phân biệt: **cần một kiểu animation mới → dev-time; cần 100 video cùng
kiểu, khác nội dung → pipeline.**

---

# Phần 1 — Claude hoạt động với Remotion thế nào

## 1.1 Cơ chế: Agent Skills

Project này có `.claude/skills/` (symlink tới `.agents/skills/`) chứa bộ skill chính
thức từ repo `remotion-dev/skills`, khoá phiên bản trong `skills-lock.json`.

Skill là các file markdown. Claude **không** tự nhớ API Remotion — mà đọc file khi cần:

```
remotion-best-practices/SKILL.md      ← router, luôn đọc đầu tiên
├── remotion-create/                  ← tạo video/composition mới
├── remotion-markup/                  ← 30+ file: audio, transitions, 3D, fonts,
│                                        sequencing, calculate-metadata, effects…
├── remotion-captions/                ← transcribe, hiển thị, import SRT
├── remotion-render/                  ← render nâng cao, video trong suốt
├── remotion-studio/                  ← chạy Studio, CLI flags
├── remotion-interactivity/           ← viết markup để Studio sửa được bằng chuột
├── remotion-multimedia/              ← trim/crop/metadata trong browser
├── remotion-saas/                    ← Player, render trên Lambda/Vercel/Cloudflare
├── remotion-maps/                    ← bản đồ, route animation
├── remotion-docs/                    ← tra cứu docs online
└── remotion-upgrade/                 ← nâng cấp Remotion + chính bộ skill này
```

Vì sao quan trọng: Remotion phát hành rất nhanh (bản này là 4.0.523). Không có skill,
Claude sẽ viết theo trí nhớ và dễ dùng API đã đổi. Có skill, Claude đọc tài liệu đúng
với phiên bản đang cài.

Nâng cấp cả Remotion lẫn skill:

```bash
npx remotion upgrade
```

## 1.1b Skill về phong cách video

Ngoài 12 skill của Remotion (kỹ thuật), project có thêm 2 skill về **nghề làm video**:

| Skill | Nguồn | Dạy gì |
|---|---|---|
| `short-form-video` | `iart-ai/tiktok-video-skills` | Hook trong 1 giây, đường cong retention, pattern interrupt mỗi 2-4s, vùng an toàn 9:16, kỹ thuật loop |
| `motion-design` | `lottiefiles/motion-design-skill` | Nguyên tắc Disney, timing/easing, choreography nhiều phần tử, motion personality |

Khác biệt quan trọng: skill Remotion trả lời *"viết code thế nào"*, hai skill này trả lời
*"video thế nào thì giữ được người xem"*. Chúng độc lập với công cụ.

Cài thêm skill khác:

```bash
npx skills find "từ khoá"
npx skills add <owner>/<repo>@<skill>
```

**Đọc skill trước khi tin.** Skill là văn bản Claude sẽ làm theo, cài từ nguồn lạ là mở
một đường cho chỉ thị lạ. Hai skill trên đã được kiểm: không có `curl`, API key, URL
ngoài, `eval`, hay `base64` nào trong toàn bộ nội dung.

## 1.2 Vòng lặp làm việc

```
bạn prompt  →  Claude đọc skill  →  sửa file trong src/  →  render kiểm chứng  →  xem ảnh
     ↑                                                                              │
     └──────────────────────── bạn phản hồi ────────────────────────────────────────┘
```

Điểm cốt lõi: **Claude tự nhìn được kết quả.** Render một frame ra PNG rồi đọc lại
chính file ảnh đó, nên bắt được lỗi bố cục mà không cần bạn mô tả:

```bash
npx remotion still Short out/check.png --frame=230
```

Vì vậy prompt nên nói **kết quả mong muốn**, đừng chỉ định cách làm:

- Tốt: "phụ đề đang che mất watermark, đẩy lên cao hơn"
- Tốt: "làm title nảy vào mạnh hơn, hiện tại quá hiền"
- Kém: "sửa `bottom-[22%]` thành `bottom-[28%]` trong Captions.tsx"

## 1.3 Studio là kênh phản hồi hai chiều

```bash
npm run dev
```

Studio không chỉ để xem trước. Nhờ zod schema trong [`schema.ts`](../src/video/Short/schema.ts),
mọi prop hiện thành ô nhập có kiểu — kể cả color picker cho `accent`/`background`.
Bạn chỉnh bằng chuột, bấm save, **Studio ghi ngược giá trị vào code**. Claude đọc
lại file đó ở lượt sau.

Nghĩa là: chỉnh tinh (màu, chữ, vị trí) làm trong Studio nhanh hơn prompt. Prompt để
dành cho việc thêm hành vi mới.

## 1.4 Quy ước giữ cho Claude sửa an toàn

- **Timing suy ra từ dữ liệu, không hardcode.** `calculateShortMetadata` trong
  [`index.tsx`](../src/video/Short/index.tsx) tính `durationInFrames` từ caption cuối.
  Thêm câu → video tự dài ra.
- **Một component một việc.** `Captions` chỉ biết phụ đề, `Background` chỉ biết nền.
  Sửa cái này không vỡ cái kia.
- **Style viết inline.** Studio chỉ chỉnh được style dạng object literal; tách ra hằng
  số hay `useMemo` là Studio làm xám ô nhập.
- **Không nối chuỗi màu.** `` `${accent}80` `` vỡ ngay khi màu là `rgb()` hoặc hex 3 ký
  tự. Muốn giảm độ đậm thì đặt `opacity` lên layer.
- **Tôn trọng vùng an toàn 9:16.** `SAFE` trong [`constants.ts`](../src/video/constants.ts)
  giữ 120px đỉnh, 320px đáy, 120px hai bên. Nền tảng vẽ UI của họ đè lên các dải đó:
  đỉnh là avatar/nhạc, đáy là caption tự động + nút like/share + thanh audio. Watermark
  từng nằm ở 96px từ đáy — tức bị che hoàn toàn trên máy thật, dù xem trong Studio thì đẹp.
  Kiểm bằng pixel chứ đừng tin CSS:

  ```bash
  ffmpeg -v error -i still.png -vf "crop=1080:320:0:1600,format=gray" -f rawvideo - \
    | python3 -c "import sys;d=sys.stdin.buffer.read();print('YMAX',max(d))"
  ```

  Dải đáy phải tối (YMAX thấp). Có chữ trong đó là chữ sẽ bị nuốt.
- **Phụ đề giữ đến câu kế tiếp.** `Captions` chọn câu cuối cùng đã `startMs <= frame`,
  không dùng khoảng `[startMs, endMs)`. Nhờ vậy phụ đề không chớp tắt ở khoảng hở giữa
  hai câu, và câu CTA còn nguyên trên màn hình ở frame cuối — frame quan trọng nhất của
  video ngắn vì nó là thứ đọng lại khi loop quay vòng. `endMs` vẫn quyết định độ dài video.

---

# Phần 2 — Pipeline prompt → video tự động

## 2.1 Luồng

```
       prompt: "5 mẹo tiết kiệm pin iPhone"
                        │
                        ▼
   ┌────────────────────────────────────────┐
   │ scripts/generate-script.ts             │
   │   Claude API + structured outputs      │  ← tốn tiền
   │   trả về VideoScript (title, lines…)   │
   └────────────────────────────────────────┘
                        │  out/script.json
                        ▼
   ┌────────────────────────────────────────┐
   │ scripts/tts.ts                         │
   │   ElevenLabs (hoặc macOS `say`)        │  ← tốn tiền
   │   → public/voiceover/<slug>/line-NN.mp3│
   │   → ffprobe đo độ dài THẬT từng file   │
   └────────────────────────────────────────┘
                        │  VoiceoverClip[] { src, durationMs }
                        ▼
   ┌────────────────────────────────────────┐
   │ src/video/Short/script.ts              │
   │   scriptToProps() — thuần, tất định    │
   │   caption dài đúng bằng clip audio     │
   └────────────────────────────────────────┘
                        │  out/props.json
                        ▼
   ┌────────────────────────────────────────┐
   │ scripts/render.ts                      │
   │   bundle() + selectComposition()       │
   │   + renderMedia()                      │
   └────────────────────────────────────────┘
                        │
                        ▼
                 out/short.mp4  (H.264 + AAC)
```

## 2.2 Chạy

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run prompt-to-video -- "5 mẹo tiết kiệm pin iPhone"
```

Xem kịch bản trước khi tốn thời gian render:

```bash
npm run prompt-to-video -- "5 mẹo tiết kiệm pin iPhone" --script-only
```

Rồi mở Studio với đúng props vừa sinh:

```bash
npx remotion studio --props=out/props.json
```

Đổi nơi lưu:

```bash
npm run prompt-to-video -- "chủ đề khác" --out out/pin.mp4
```

Kịch bản luôn được ghi ra `out/script.json`. Sửa tay file đó rồi render lại **không
tốn thêm lượt gọi API**:

```bash
npm run prompt-to-video -- --script out/script.json --out out/pin.mp4
```

Đây cũng là cách dựng video khi chưa có API key: tự viết `out/script.json` theo đúng
`videoScriptSchema` rồi chạy lệnh trên.

## 2.3 Âm thanh

Ba lớp tiếng, tất cả nằm trong [`Soundtrack.tsx`](../src/video/Short/Soundtrack.tsx):

| Lớp | Nguồn | Mức |
|---|---|---|
| Voiceover | ElevenLabs hoặc macOS `say`, một file mỗi câu | 1.0 |
| Nhạc nền | `public/music/*.mp3`, loop, tự ducking | 0.5 → 0.12 khi có tiếng nói |
| Whoosh | `public/sfx/whoosh.mp3`, phát trước mỗi câu 3 frame | 0.35 |

### Voiceover quyết định timing

Đây là thay đổi lớn nhất so với bản không tiếng. Trước đây độ dài mỗi câu là **ước
lượng** 150 từ/phút. Giờ `scripts/tts.ts` chạy `ffprobe` trên từng file audio và đưa
độ dài **thật** vào `scriptToProps()`. Chữ trên màn hình và tiếng đang đọc không thể
lệch nhau, dù giọng đọc nhanh hay chậm.

```bash
export ELEVENLABS_API_KEY=...
npm run prompt-to-video -- "5 mẹo tiết kiệm pin iPhone"
```

Biến môi trường: `ELEVENLABS_API_KEY` (bắt buộc), `ELEVENLABS_VOICE_ID` (không đặt
thì lấy voice đầu tiên trong tài khoản — script sẽ in ra tên giọng đã dùng),
`ELEVENLABS_MODEL_ID` (mặc định `eleven_multilingual_v2`).

Đặt key vào `.env` (đã gitignore) rồi nạp trước khi chạy:

```bash
set -a && . ./.env && set +a
npm run prompt-to-video -- "..."
```

### Chọn giọng bằng `--voice`

Giọng quyết định luôn engine — không phải khai báo cả `--tts` lẫn voice id:

```bash
npm run prompt-to-video -- --name pin-iphone --voice linh    # tiếng Việt, macOS, miễn phí
npm run prompt-to-video -- --name pin-iphone --voice laura   # tiếng Anh, ElevenLabs
npm run prompt-to-video -- --name pin-iphone --voice cgSgspJ2msm6clMCkdW9   # voice_id thẳng
```

Ba cách nhận diện, theo thứ tự:

1. **Tên trong catalog** (`linh`, `laura`, `mac-samantha`…) — xem bằng `--list-voices`
2. **voice_id ElevenLabs** (20 ký tự chữ-số) — dùng được bất kỳ giọng nào, kể cả giọng
   vừa thêm vào tài khoản mà catalog chưa có
3. Không khớp cả hai → báo lỗi kèm cách xem danh sách

```bash
npm run prompt-to-video -- --list-voices          # catalog tĩnh, offline
npm run prompt-to-video -- --list-voices --live   # giọng THẬT trong tài khoản ElevenLabs
```

`--live` là nguồn chính xác: nó đọc `/v1/voices` nên phản ánh cả giọng bạn mới thêm và
cả thay đổi khi nâng gói. Cột cuối đánh dấu `[cần gói trả phí]` cho voice `professional`.

### Giọng tiếng Việt và giới hạn gói Free

`eleven_multilingual_v2` đọc được tiếng Việt — đã kiểm chứng thật. Nhưng **gói Free
không gọi được library voice qua API**:

```
402 paid_plan_required
"Free users cannot use library voices via the API."
```

Nghĩa là **mọi** giọng Việt bị chặn ở gói Free. Thêm giọng từ thư viện vào tài khoản
cũng không gỡ được — đã thử: `Tuyết`, `Khánh Lâm`, `Chi`, `Giang`, `Đô Trịnh`,
`Thúy Tiên` đều trả 402 dù đã nằm trong `/v1/voices` của tài khoản. Giới hạn nằm ở
tầng API, không phải ở chỗ giọng đã được thêm hay chưa.

Chỉ dùng được giọng `premade` — đều là giọng tiếng Anh nên đọc tiếng Việt sẽ có accent.
Muốn tiếng Việt bản xứ mà không nâng gói: `--voice linh` (macOS, miễn phí, offline).

Giọng premade dùng được (`voice_id | tên | giới tính`):

```
EXAVITQu4vr4xnSDxMaL | Sarah   | nữ, trẻ
Xb7hH8MSUJpSbSDYk0k2 | Alice   | nữ, trung niên, informative
FGY2WhTYpPnrIDTdsKH5 | Laura   | nữ, trẻ, social media
JBFqnCBsd6RMkjVDRZzb | George  | nam, trung niên, kể chuyện
```

Muốn giọng Việt bản xứ: nâng gói ElevenLabs, hoặc thu giọng thật rồi dùng
`@remotion/install-whisper-cpp` lấy timing (xem 2.6).

Dựng thử không tốn tiền, dùng giọng `Linh` có sẵn của macOS:

```bash
npm run prompt-to-video -- --script out/script.json --tts say
```

Đổi giọng macOS bằng `SAY_VOICE`; xem danh sách bằng `say -v '?'`.

### Nhạc nền và ducking

```bash
npm run prompt-to-video -- "..." --music music/bai-hat.mp3   # file trong public/
npm run prompt-to-video -- "..." --music none                # tắt nhạc
npm run prompt-to-video -- "..." --no-sfx                    # tắt whoosh
npm run prompt-to-video -- "..." --tts none                  # không voiceover
```

Ducking không nhảy bậc: `musicVolumeAt()` trong [`mix.ts`](../src/video/Short/mix.ts)
dốc dần trong ~0.25s hai đầu mỗi câu. Envelope đo được trên video mẫu:

```
frame   time   music
    0   0.00s  0.000   fade in
   30   1.00s  0.500   intro, chưa có tiếng nói
   74   2.47s  0.120   câu 1 bắt đầu — ducked
  168   5.60s  0.215   khe giữa câu 1 và 2, nhạc hồi lên một nhịp
  634  21.13s  0.017   fade out
```

Hàm này tách khỏi component chính vì thế: kiểm chứng được mà không cần render.

### Asset audio là file sinh ra

`public/sfx/whoosh.mp3` và `public/music/placeholder.mp3` do ffmpeg tổng hợp:

```bash
npm run audio-assets
```

**`placeholder.mp3` là hợp âm sine tổng hợp, không phải nhạc thật** — nó chỉ tồn tại
để kiểm tra phần trộn tiếng. Thay bằng track có bản quyền hợp lệ trước khi đăng.

`public/voiceover/` bị gitignore vì sinh lại được từ `script.json`.

## 2.4 Nhiều video trong một project

Một project chứa bao nhiêu video cũng được. Mỗi video là một thư mục:

```
videos/
  pin-iphone/
    script.json      # kịch bản — nguồn sự thật, sửa tay được
    props.json       # đã có timing + đường dẫn audio, sinh ra từ script
  nau-pho-bo/
    script.json
    props.json
out/
  pin-iphone.mp4
  nau-pho-bo.mp4
public/voiceover/
  pin-iphone-a3f2c1d0/    # gắn theo slug + hash nội dung
  nau-pho-bo-317e9c57/
```

Tên thư mục (slug) suy từ prompt, bỏ dấu tiếng Việt: `"5 mẹo tiết kiệm pin iPhone"`
→ `5-meo-tiet-kiem-pin-iphone`. Đặt tên khác bằng `--name`.

```bash
# Video mới — tự tạo videos/<slug>/
npm run prompt-to-video -- "5 mẹo tiết kiệm pin iPhone"
npm run prompt-to-video -- "Cách nấu phở bò" --name nau-pho-bo

# Render lại video đã có, KHÔNG gọi API lần nào
npm run prompt-to-video -- --name pin-iphone

# Render lại tất cả (bundle một lần dùng cho mọi video)
npm run render-all
```

Sửa nội dung thì mở `videos/<slug>/script.json`, đổi chữ, rồi chạy lại
`--name <slug>`. Voiceover gắn hash nội dung nên sửa chữ là sinh lại tiếng, không
dùng nhầm file cũ.

Xem trước một video cụ thể trong Studio:

```bash
npx remotion studio --props=videos/pin-iphone/props.json
```

Chỉ có **một** composition `Short` cho tất cả — đó là cách làm của Remotion cho video
theo dữ liệu: một template, N bộ props. Muốn kiểu video khác hẳn thì mới thêm
composition mới vào [`Root.tsx`](../src/Root.tsx).

## 2.5 Cảnh, hình ảnh, vị trí phụ đề

### Cảnh

Kịch bản chia thành cảnh; mỗi cảnh gom vài câu và dùng chung một hình nền:

```json
{
  "title": "Ba bước làm video",
  "scenes": [
    { "image": "images/scene-1.jpg", "lines": ["Câu một.", "Câu hai."] },
    { "image": "images/scene-2.jpg", "lines": ["Câu ba.", "Câu bốn."] },
    { "image": null,                 "lines": ["Cảnh này chỉ dùng nền gradient."] }
  ]
}
```

Kịch bản kiểu cũ chỉ có `lines` phẳng vẫn chạy — `parseScript()` đọc thành một cảnh
không ảnh, không cần sửa file.

**Cảnh KHÔNG dùng `<TransitionSeries>`.** Đó là quyết định có chủ ý:
`TransitionSeries` rút ngắn timeline mỗi khi có transition, mà phụ đề và voiceover
của ta neo theo frame tuyệt đối lấy từ độ dài audio thật (mục 2.3). Dùng nó là chữ
và tiếng lệch nhau — phá đúng thứ đã xây. Thay vào đó [`Scenes.tsx`](../src/video/Short/Scenes.tsx)
chồng các ảnh lên nhau và cross-fade bằng `opacity` trong 0.5s; timeline không đổi
một frame nào.

Ảnh có hiệu ứng Ken Burns: phóng chậm 8% suốt cảnh, cho ảnh tĩnh đỡ chết cứng.

### Hai loại hình cho cảnh

| | `image` | `visual` |
|---|---|---|
| Nguồn | file bạn bỏ vào `public/images/` | Claude tự sinh từ dữ liệu |
| Là gì | ảnh chụp, đồ hoạ có sẵn | chữ + hình vẽ bằng CSS |
| Cần chuẩn bị | có | không |

Một cảnh dùng được cả hai (visual chồng lên ảnh), một trong hai, hoặc không cái nào —
lúc đó chỉ còn nền gradient.

### `visual` — cảnh Claude tự tạo

Không cần file nào. Hai kiểu:

```json
{ "type": "stat",  "text": "7-9",    "caption": "giờ ngủ mỗi đêm" }
{ "type": "badge", "text": "Bước 1", "caption": "Cố định giờ đi ngủ" }
```

`stat` là con số cỡ lớn màu accent; `badge` là nhãn bước dạng viên thuốc. Cả hai nằm ở
18% từ đỉnh, spring-in theo cảnh, không đụng phụ đề dù đặt ở đáy hay ở giữa. `text` tối
đa 16 ký tự — nó phải đọc được trong một cái liếc.

Video `canh-code` trong repo là ví dụ: **không dùng file ảnh nào**, ba cảnh đều do code vẽ.

### Lấy ảnh từ Canva

Connector Canva trong phiên này **đã xác thực** — Claude gọi được trực tiếp. Luồng:

```
generate-design (design_type: your_story = 1080×1920)
  → create-design-from-candidate   (chọn 1 trong 4 phương án)
  → get-export-formats             (xác nhận PNG được hỗ trợ)
  → export-design                  (trả về URL tải)
  → curl về public/images/<slug>/
```

**Hai cái bẫy đã gặp thật:**

1. **Đừng truyền `width`/`height` vào `export-design`.** Có tham số kích thước thì nó
   trả `Not allowed to access design` — thông báo sai lệch, nghe như lỗi quyền nhưng
   thực ra là tham số. Bỏ đi thì export ra đúng 1080×1920 luôn, vì design vốn đã là
   khổ đó.

2. **Canva sinh *design có chữ*, không phải ảnh nền trơn.** 2 trong 3 ảnh thử nghiệm
   có chữ tiếng Anh chèn sẵn ("Nighttime Routine", "Keeping a Fixed Bedtime") dù prompt
   ghi rõ *no text, no words, no letters*. Nó là công cụ làm design hoàn chỉnh, yêu cầu
   "nền trơn" đi ngược thiết kế của nó.

   Cách xử lý: sinh vài phương án rồi **nhìn từng cái**, chỉ giữ cái sạch chữ. Hoặc mở
   design trong Canva, xoá text box, export lại.

Prompt cho kết quả dùng được: mô tả *khung cảnh* thay vì *chủ đề*, và nói rõ chừa vùng
tối phía dưới cho phụ đề. Ví dụ đã cho ra ảnh sạch:

> "vertical 9:16 background, dark navy night sky, soft crescent moon and scattered
> faint stars in the upper area, minimal abstract illustration, smooth gradient.
> No text, no words, no letters, no logos anywhere. Keep the lower half mostly empty
> and dark so white subtitle text stays readable."

### `image` — bạn tự bỏ vào

**Claude không sinh được ảnh chụp** — phiên làm việc không có công cụ tạo ảnh nào. Ảnh
mẫu trong repo là gradient tổng hợp bằng ffmpeg để kiểm thử. Cần ảnh thật thì bạn cung
cấp; cần hình đơn giản thì dùng `visual` ở trên.

Quy ước thư mục:

```
public/images/<slug>/    ảnh riêng của video đó       →  "images/pin-iphone/buoc-1.jpg"
public/images/shared/    ảnh dùng chung nhiều video   →  "images/shared/logo.jpg"
public/images/           để lẫn ở gốc — vẫn chạy, nhưng nhiều video là rối
```

Đường dẫn trong `script.json` tính từ `public/`, không có dấu `/` đầu.

Xem ảnh nào đang dùng cho video nào, cảnh nào, khoảng thời gian nào:

```bash
npm run images
```

```
thu-canh
  cảnh 1  0.0s–6.6s      images/thu-canh/buoc-1.jpg
  cảnh 2  6.6s–11.3s     images/thu-canh/buoc-2.jpg
  cảnh 3  11.3s–15.2s    images/shared/ket-thuc.jpg

3 ảnh trong public/images/, 0 chưa dùng:
```

Lệnh này cũng đánh dấu `← THIẾU FILE` cho ảnh được tham chiếu mà không tồn tại, và
liệt kê ảnh có trong thư mục nhưng chưa video nào dùng.

**Ảnh thiếu bị chặn trước khi render.** `assertImagesExist()` chạy trước bước bundle:

```
Lỗi: Thiếu 1 ảnh (đường dẫn tính từ public/):
  cảnh 1: images/khong-co-that.jpg
Ảnh đang có:
  images/thu-canh/buoc-1.jpg
  ...
```

Không có bước chặn này thì Remotion vẫn báo lỗi, nhưng chỉ sau khi bundle xong và
retry tải ảnh vài giây — chậm và thông báo khó đọc.

Khi sinh kịch bản bằng prompt, [`generate-script.ts`](../scripts/generate-script.ts)
đưa vào system prompt danh sách ảnh của **đúng video đó** (`public/images/<slug>/`)
cộng `shared/` và ảnh ở gốc, kèm lệnh cấm bịa tên file. Không có ảnh nào thì model
đặt `image: null` cho mọi cảnh.

Nghĩa là thứ tự làm việc thuận nhất khi muốn có ảnh:

```bash
mkdir -p public/images/pin-iphone
# chép ảnh của bạn vào đó
npm run prompt-to-video -- "5 mẹo tiết kiệm pin iPhone" --name pin-iphone
```

Đặt tên file gợi nội dung (`sac-dem.jpg`, chứ không phải `IMG_2831.jpg`) — model chọn
ảnh dựa trên tên, đó là thứ duy nhất nó thấy được.

Ba lớp xếp chồng, thứ tự cố định trong [`index.tsx`](../src/video/Short/index.tsx):

```
Background  màu nền + hai vệt sáng trôi
Scenes      ảnh của cảnh, cross-fade
Scrim       lớp tối để chữ trắng luôn đọc được
Captions / Watermark / ProgressBar
```

Thứ tự này quan trọng: đặt `Background` sau `Scenes` là nó che sạch ảnh, vì
`AbsoluteFill` có `backgroundColor` đục.

### Vị trí phụ đề

```bash
npm run prompt-to-video -- --name x --sub bottom   # mặc định, 22% từ đáy
npm run prompt-to-video -- --name x --sub center   # giữa màn hình
```

`bottom` hợp khi có ảnh — chừa chỗ cho hình. `center` hợp video không ảnh, hoặc khi
muốn chữ là trọng tâm.

## 2.6 Video từ audio có sẵn (giọng thật)

Ngược chiều với pipeline TTS: thay vì sinh giọng từ chữ, ta lấy chữ từ giọng.

```bash
npm run audio-to-video -- ~/Downloads/giong.mp3 --name bai-noi
npm run audio-to-video -- giong.mp3 --name x --title "Hook" --sub center --model large-v3-turbo
```

```
file audio
   │
   ▼  scripts/transcribe.ts — whisper.cpp chạy LOCAL, offline, không API key
timestamp từng từ
   │
   ▼  scripts/group-captions.ts — gom 4-7 từ/dòng, ngắt ở dấu câu và khoảng lặng
dòng phụ đề khớp đúng lời nói
   │
   ▼  audio chuẩn hoá vào public/voiceover/<slug>/track.mp3
   ▼  render
out/<slug>.mp4
```

Ưu điểm so với TTS: giọng thật của bạn, khớp môi tuyệt đối, **không tốn phí theo ký tự**,
và chạy được cả khi mất mạng.

### Chọn model — mặc định `medium`

Whisper tải model một lần rồi chạy offline. Đo thật trên 41 giây kể chuyện tiếng Việt:

| Model | Dung lượng | Kết quả |
|---|---|---|
| `small` | ~466MB | Sai nhiều: "đôi can" (đôi càng), "giế chuất" (Dế Choắt), "sơ xài" (sơ sài), "người hàng sống" (hàng xóm), một câu hỏng hẳn |
| `medium` | ~1.5GB | **Mặc định.** Đúng "đôi càng", "quanh xóm", "hàng xóm". Còn sai tên riêng: "dế men" (Dế Mèn), "Dế Choách" (Dế Choắt) |
| `large-v3-turbo` | ~1.3GB | **Không dùng được** — xem dưới |

`large-v3-turbo` tải về được nhưng `transcribe()` chết với
`unknown DTW preset 'large.v3.turbo'`: whisper.cpp 1.5.5 chưa biết preset đó. Nâng
`installWhisperCpp` lên 1.7.4 thì `make` fail (exit 2) — bản mới chỉ ủy thác sang
`cmake`, mà package vẫn gọi Makefile cũ. Máy này chưa có `cmake`; cài nó
(`brew install cmake`) là điều kiện để mở đường turbo.

### Phụ đề LUÔN phải soát lại

Hai lý do, cả hai đã gặp thật:

**1. Tên riêng.** ASR không biết "Dế Mèn", "Dế Choắt" — nó nghe ra "dế men", "Dế Choách".
Video kể chuyện mà sai tên nhân vật thì hỏng.

**2. whisper.cpp 1.5.5 làm vỡ UTF-8 tiếng Việt.** Một số ký tự ra `U+FFFD`:
`"Dư<?>i"`, `"c<?>"`, `"ch<?>ng"`. Kiểm tra JSON thô cho thấy **ký tự đã hỏng ngay từ
output của whisper**, không phải do khâu xử lý sau — nên không sửa được bằng code, chỉ
sửa được bằng tay. Bật/tắt `tokenLevelTimestamps` đều vỡ như nhau.

Quy trình đúng: chạy `audio-to-video` một lần, mở `videos/<slug>/props.json`, sửa chữ
trong `captions[].text`, rồi `npm run render-all` — **không phiên âm lại**.

### Ngắt dòng theo ký tự, không theo từ

`group-captions.ts` giới hạn **42 ký tự mỗi dòng**, không phải "4-7 từ" như skill
short-form-video khuyến nghị. Lý do: tiếng Việt mỗi âm tiết tính là một từ, nên 7 từ
chỉ bằng ~3 từ tiếng Anh — dòng ngắn cụt và cắt giữa cụm
("…tưởng như bình" / "thường…"). 42 ký tự là chuẩn phụ đề quốc tế và đúng cho mọi
ngôn ngữ. Dòng vẫn ưu tiên ngắt ở dấu câu và khoảng lặng dài trước khi chạm trần.

### Một track cho cả video

Khác pipeline TTS (mỗi câu một file audio), ở đây là **một file chạy suốt**. Schema có
`voiceoverTrack` riêng cho việc này, và `calculateShortMetadata` xét cả mốc kết thúc của
cảnh — nếu chỉ nhìn caption cuối thì khoảng lặng ở đuôi audio sẽ bị cắt mất.

Thêm ảnh/cảnh sau: sửa `videos/<slug>/props.json`, thêm `scenes[].image`, rồi
`npm run render-all`.

## 2.7 Ba quyết định thiết kế đáng chú ý

**LLM viết chữ, code tính giờ.** `videoScriptSchema` chỉ nhận `lines: string[]` —
model không được đặt `startMs`/`endMs`. Timing do `lineDurationMs()` suy ra từ số từ
ở tốc độ 150 từ/phút, kẹp trong 1.2–4.5 giây. Lý do: model đặt timing rất hay lệch,
mà timing sai thì phụ đề chồng nhau hoặc nhấp nháy. Số từ thì luôn đúng.

**Hai schema, không phải một.** `videoScriptSchema` (zod thuần) là hợp đồng với API;
`shortSchema` (dùng `zColor()`) là hợp đồng với Studio. Tách ra vì `zColor()` sinh
JSON Schema mà API không hiểu, còn `z.string().regex()` thì không cho Studio color
picker. `scriptToProps()` là cầu nối giữa hai bên.

**Structured outputs, không phải "trả JSON giúp tôi".** `client.messages.parse()` với
`zodOutputFormat()` ép response khớp schema; kết quả nằm ở `response.parsed_output` đã
có kiểu TypeScript. Không cần bóc markdown fence hay `JSON.parse` thủ công.

Lưu ý: SDK hạ `minLength`/`maxLength`/`regex` xuống thành *description* trong JSON
Schema chứ không thành ràng buộc cứng. Nên các giới hạn đó là **gợi ý cho model**, không
phải đảm bảo — code phía sau phải chịu được giá trị lệch chuẩn (đó là lý do không nối
chuỗi màu ở mục 1.4).

## 2.8 Video dài được bao nhiêu

Remotion **không đặt giới hạn thời lượng**: `durationInFrames` là số nguyên, video dài
bao nhiêu là do bạn. Giới hạn thật nằm ở bốn chỗ khác, đo được trên máy này:

| Chỗ nghẽn | Con số thật | Ghi chú |
|---|---|---|
| Tốc độ render | **27 frame/s** ở 1080×1920 | ≈ 1.1× realtime — video 1 phút render ~66s |
| Số câu tối đa | 60 câu ≈ 3 phút | Bound trong `videoScriptSchema`, sửa được |
| Quota ElevenLabs (Free) | 10.000 ký tự/tháng | ~45 video ngắn, hoặc ~8 video 3 phút |
| macOS `say` | không giới hạn | miễn phí, offline |

Đo thật: video **75.8s (2275 frame)** render hết **84.1s** khi bundle đã cache, 91.5s
nếu tính cả bundle. Tuyến tính theo số frame, nên ước lượng được: video 3 phút ≈ 3.3 phút render.

Nhạc nền `placeholder.mp3` chỉ dài 30s nhưng `<Audio loop>` lặp lại, đã kiểm chứng trên
video 75.8s — mức âm ở khe giữa các câu tại 5s / 28s / 35s / 62s / 70s đều quanh
-32 dB, không có khoảng câm nào sau mốc 30s.

**Nhưng nên làm ngắn.** Template này thiết kế cho short-form: một câu phụ đề giữa màn
hình, không chuyển cảnh, không b-roll. Quá 60 giây thì bố cục đó bắt đầu đơn điệu —
lúc đó cần thêm cảnh, hình minh hoạ, chuyển cảnh (xem 2.7), chứ không phải chỉ thêm câu.

## 2.9 Chi phí & thời gian

| Bước | Thời gian | Chi phí |
|---|---|---|
| Sinh kịch bản (Claude Opus 5) | ~10–30s | vài cent/video |
| Voiceover ElevenLabs | ~1–3s/câu | theo ký tự, xem bảng giá ElevenLabs |
| Voiceover macOS `say` | ~0.5s/câu | 0 |
| Bundle | ~2s, cache lại trong cùng process | 0 |
| Render 16s video @1080×1920 | ~30–60s trên máy này | 0 |

`renderShort()` cache bundle, nên render N video trong một lần chạy chỉ bundle một lần.

Đổi model rẻ hơn khi làm hàng loạt:

```ts
await generateScript(prompt, "claude-sonnet-5");
```

## 2.10 Mở rộng tiếp

- **Caption từng từ** — hiện mỗi câu hiện trọn một lần. Dùng `@remotion/captions` +
  Whisper trên chính file voiceover để lấy timing từng từ, làm hiệu ứng karaoke.
  Xem skill `remotion-captions/`.
- **B-roll** — thêm `<OffthreadVideo>` vào `Background`, cho model chọn từ danh sách
  clip có sẵn (đừng để model tự bịa URL).
- **Render trên cloud** — `@remotion/lambda` để render song song. Xem skill
  `remotion-saas/`.
- **Chạy hàng loạt** — `renderShort()` đã tách riêng, gọi trong vòng lặp là được.
