# short-video

Remotion project cho video dọc 9:16 (TikTok / Reels / Shorts) — 1080×1920, 30fps.

## Commands

```console
npm start      # MỞ GIAO DIỆN → http://localhost:5177
npm i          # cài dependencies
npm run dev    # mở Remotion Studio để xem trước & sửa props trực tiếp
npm run render # xuất out/short.mp4
npm run still  # xuất out/thumbnail.png (frame 45)
npm run lint   # eslint + tsc
npm run audio-assets  # sinh lại whoosh + nhạc nền tạm (cần ffmpeg)
npm run render-all    # render lại mọi video trong videos/
npm run images        # ảnh nào đang dùng cho video nào, cảnh nào
```

Video từ file audio có sẵn (giọng thật, phiên âm offline bằng whisper.cpp):

```console
npm run audio-to-video -- ~/Downloads/giong.mp3 --name bai-noi --model large-v3-turbo
```

Mỗi video một thư mục trong `videos/<slug>/`, không đè lên nhau:

```console
npm run prompt-to-video -- "Cách nấu phở bò" --name nau-pho-bo
npm run prompt-to-video -- --name nau-pho-bo    # render lại, không gọi API
npm run prompt-to-video -- --name nau-pho-bo --voice linh   # đổi giọng
npm run prompt-to-video -- --list-voices --live             # giọng có trong tài khoản
npm run prompt-to-video -- --name nau-pho-bo --sub center   # phụ đề giữa màn hình
```

Sinh video từ một câu prompt (cần `ANTHROPIC_API_KEY`):

```console
npm run prompt-to-video -- "5 mẹo tiết kiệm pin iPhone"
```

Xem [docs/prompt-to-video.md](docs/prompt-to-video.md) — luồng đầy đủ và cách Claude
làm việc với Remotion qua bộ skill trong `.claude/skills/`.

Render một composition khác hoặc đổi tham số:

```console
npx remotion render Short out/short.mp4 --props='{"title":"Tiêu đề khác"}'
```

## Cấu trúc

```
.claude/
  skills/          9 skill riêng của project + 14 skill cài từ registry
  commands/        create-short, create-long, generate-assets, render, review
src/
  constants.ts     FPS, WIDTH, HEIGHT, SAFE, TITLE_FRAMES
  Root.tsx         đăng ký 3 composition
  compositions/
    Short/         component + schema + defaultProps + script (LLM schema, timing)
    LongVideo/     Short + nhãn chương mỗi cảnh
    Explainer/     Short + dãy chấm chỉ bước
  scenes/          Background, Scenes (ảnh + cross-fade), Scrim, SceneVisual
  captions/        Captions
  audio/           Soundtrack, mix.ts (hàm thuần tính volume)
  components/      TitleCard, Watermark, ProgressBar, ChapterMarker, StepTracker
public/
  images/<slug>/   ảnh riêng từng video
  images/shared/   ảnh dùng chung
  videos/          clip (chưa dùng)
  voices/<slug>/   voiceover sinh ra (gitignored)
  music/  sfx/     nhạc nền + tiếng động
scripts/
  prompt-to-video  CLI: prompt → mp4
  audio-to-video   CLI: file audio → mp4
  generate-script  prompt → VideoScript (Claude API)
  tts / voices     TTS + catalog giọng
  transcribe / group-captions   whisper.cpp + gom dòng phụ đề
  images / list-images          quy ước ảnh + kiểm tra
  pexels / gemini-image         nguồn ảnh
  fetch-images                  resolver ưu tiên pexels → gemini
  render / render-all           render
videos/<slug>/     script.json (nội dung) + props.json (đã có timing)
data/  out/
```

## Giao diện

```console
npm start
```

Mở http://localhost:5177. Làm được toàn bộ pipeline bằng chuột:

- **Tạo** — nhập prompt sinh kịch bản
- **Sửa kịch bản** — sửa từng cảnh 2 cột: bên trái ảnh + hình vẽ code, bên phải câu phụ đề.
  Mỗi cảnh có ô **tìm ảnh Pexels**: gõ từ khoá tiếng Anh → hiện lưới thumbnail → bấm chọn
  → tự tải về đúng khổ 1080×1920, tự điền đường dẫn, tự ghi công tác giả
- **Ảnh & file** — lấy ảnh hàng loạt, hoặc tải lên ảnh/nhạc/sfx/video clip
- **Nhạc & tiếng** — sinh nhạc nền theo 5 mood và 5 loại tiếng động bằng ffmpeg
  (offline, miễn phí), nghe thử ngay trong trang; hoặc sinh theo mô tả ngữ cảnh bằng
  ElevenLabs (cần key có quyền `music_generation` / `sound_generation`)
- **Ghép video** — bấm chọn nhiều video theo thứ tự rồi nối thành một file
- Panel **Dựng & render** (bật/tắt được) — chọn composition, giọng, vị trí phụ đề, nhạc nền;
  render kèm thanh tiến độ; xem trước và tải mp4 ngay trong trang

Badge key ở góc phải chỉ cho biết key **có trong `.env`** — không kiểm tra quyền thật.

Không dùng framework và không có bước build: server là `node:http`, UI là một file HTML.

## Stack

```
Claude Code
 ├── Remotion         dựng + animation + phụ đề + render
 ├── Pexels           ảnh stock — FREE, 25k req/tháng, MẶC ĐỊNH
 ├── ElevenLabs Free  giọng đọc — 10k ký tự/tháng, không có giọng Việt
 ├── macOS say        giọng Việt Linh — FREE, offline, không giới hạn
 ├── whisper.cpp      phụ đề từ audio — FREE, offline
 ├── Canva MCP        minh hoạ vector — FREE
 └── Gemini           ảnh AI — key hiện 403, chưa dùng được
```

```console
npm run fetch-images -- --name <slug> "query tiếng Anh" "query 2"
npm run fetch-images -- --name <slug> --source gemini "mô tả"
```

## Agent Skills

14 skill trong `.claude/skills/` (khoá phiên bản ở `skills-lock.json`):

- 12 skill Remotion từ `remotion-dev/skills` — kỹ thuật: markup, captions, render, studio…
- `short-form-video` — hook, retention, pattern interrupt, vùng an toàn 9:16
- `motion-design` — nguyên tắc Disney, timing/easing, choreography

```console
npx skills find "từ khoá"     # tìm skill mới
npx remotion upgrade          # nâng Remotion + skill Remotion
```

## Docs

- [Fundamentals](https://www.remotion.dev/docs/the-fundamentals)
- [Config options](https://remotion.dev/docs/config)

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
