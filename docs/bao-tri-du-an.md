# Hướng dẫn đọc và bảo trì dự án

Dành cho người mới vào code hoặc người sửa/phát hành AI Video Studio. README trả lời *dùng thế nào*;
tài liệu này trả lời *code nằm đâu, đọc theo thứ tự nào, sửa một thứ thì phải đụng những chỗ nào*.

Tài liệu liên quan:

| Tài liệu | Nội dung |
|---|---|
| [README.md](../README.md) | Cài đặt, cách dùng, luồng dữ liệu, cấu trúc thư mục, giới hạn đã đo |
| [docs/prompt-to-video.md](prompt-to-video.md) | Chi tiết pipeline prompt → mp4 |
| [docs/ai-tren-may.md](ai-tren-may.md) | AI chạy trên máy (có sẵn trong app, Ollama), số đo thật |
| `.claude/skills/*/SKILL.md` | Luật làm video và luật từng phong cách — **cũng là prompt** của app (mục 5) |

## Mục lục

1. [Bức tranh tổng thể](#1-bức-tranh-tổng-thể)
2. [Đọc code theo thứ tự nào](#2-đọc-code-theo-thứ-tự-nào)
3. [Dữ liệu trên đĩa](#3-dữ-liệu-trên-đĩa)
4. [Các luồng chính](#4-các-luồng-chính)
5. [Quy ước code](#5-quy-ước-code)
6. [Công thức cho các thay đổi thường gặp](#6-công-thức-cho-các-thay-đổi-thường-gặp)
7. [Kiểm tra trước khi commit](#7-kiểm-tra-trước-khi-commit)
8. [Phát hành bản desktop](#8-phát-hành-bản-desktop)
9. [Những cái bẫy đã gặp](#9-những-cái-bẫy-đã-gặp)
10. [Gỡ lỗi](#10-gỡ-lỗi)

---

## 1. Bức tranh tổng thể

Bốn lớp, lớp trên gọi lớp dưới, không có chiều ngược lại:

```
┌─ desktop/ ──────────── Electron: mở cửa sổ, chạy server bằng Node đi kèm, chuẩn bị thư mục làm việc
│
├─ server/ ───────────── node:http + SSE, không framework
│    public/             giao diện chính: index.html + app.js (JS thuần, không build)
│    editor/             trình chỉnh sửa timeline: React + @remotion/player, esbuild bundle lúc chạy
│    index.ts            toàn bộ route  →  chat.ts, batch.ts, api.ts, pipeline.ts, media.ts…
│
├─ scripts/ ──────────── logic Node dùng chung cho server VÀ dòng lệnh
│    generate-script, llm-json, local-ai   AI viết lời
│    tts, voices, transcribe, subtitle-align   giọng, phiên âm
│    render                                     gọi Remotion
│
└─ src/ ──────────────── Remotion: composition, phong cách, cảnh, phụ đề, âm thanh
                          chỉ nhận props.json, không biết server tồn tại
```

Một video đi qua ba dạng dữ liệu:

```
prompt / lời dán / file audio
        │  AI hoặc text-script.ts
        ▼
videos/<slug>/script.json   nội dung (câu, cảnh, phong cách) — KHÔNG có thời gian
        │  tts.ts đo độ dài giọng thật, script.ts → scriptToProps
        ▼
videos/<slug>/props.json    đủ để render: mốc ms, đường dẫn audio, crop, chữ thêm tay…
        │  scripts/render.ts → Remotion
        ▼
out/<slug>.mp4
```

Trình chỉnh sửa sửa thẳng `props.json`. Gửi yêu cầu sửa qua chat thì `props.json` được **dựng lại từ
`script.json`** — chỉnh tay trong trình chỉnh sửa mất. Đây là hành vi có chủ đích (xem ai-tren-may.md
mục 2), đừng "sửa" nó mà không đổi cả luồng.

---

## 2. Đọc code theo thứ tự nào

Mỗi file lớn đều mở đầu bằng một khối chú thích giải thích *vì sao* — đọc khối đó trước khi đọc thân hàm.

| Bước | Đọc | Để hiểu |
|---|---|---|
| 1 | `src/compositions/Short/schema.ts` | Hình dạng `props.json` — mọi thứ khác xoay quanh nó |
| 2 | `src/compositions/Short/script.ts` | Hình dạng `script.json` (thứ AI viết) và `scriptToProps` tính thời gian |
| 3 | `src/compositions/Short/index.tsx`, `src/styles/registry.tsx`, `src/styles/shared.tsx` | Một phong cách nhận nguyên props và tự vẽ mọi lớp hình |
| 4 | Một phong cách đơn giản: `src/styles/caption/` rồi một cái phức tạp: `src/styles/news/` | Cách chia component trong phong cách |
| 5 | `scripts/render.ts` | Bundle Remotion, cache, render cả video / từng cảnh |
| 6 | `server/index.ts` (lướt danh sách route) → `server/chat.ts` (`startTurn`, `runPipeline`) | Một lượt "gõ prompt → mp4" |
| 7 | `scripts/generate-script.ts`, `scripts/llm-json.ts` | Chọn nhà cung cấp AI, thử lần lượt, sửa nhẹ kết quả (`tidyScript`) |
| 8 | `server/public/app.js` (`boot`, `route`, `send`, `follow`) | Giao diện chính: hash route, gọi API, theo dõi job qua SSE |
| 9 | `server/editor-build.ts` → `server/editor/main.tsx` → `Editor.tsx` → `ops.ts` | Trình chỉnh sửa; `ops.ts` là hàm thuần, đọc riêng được |
| 10 | `server/batch.ts` | Làm hàng loạt: hàng đợi, biến thể, phụ đề nhiều video |
| 11 | `desktop/main.cjs` | Bản desktop chạy server thế nào, thư mục làm việc ở đâu |

Tra nhanh "cái này nằm đâu":

| Tìm | Ở |
|---|---|
| Một route `/api/...` | `server/index.ts` (tìm đúng chuỗi route) |
| Ô trong ⚙️ Cài đặt | `KEY_FIELDS` trong `server/keys.ts` |
| Danh sách phong cách, nhãn, emoji | `src/styles/meta.ts` |
| Luật viết nội dung của phong cách | `.claude/skills/style-<id>/SKILL.md`, đoạn giữa hai dấu `<!-- ai-guide -->` |
| Tỉ lệ khung, vùng an toàn | `src/aspects.ts`, `src/constants.ts` |
| Font, kiểu phụ đề kiểu CapCut | `src/compositions/Short/schema.ts`, `src/styles/shared.tsx`, `src/components/CustomCaptions.tsx` |
| Giọng đọc | `scripts/voices.ts` (danh mục), `scripts/tts.ts` (gọi dịch vụ) |
| Prompt viết kịch bản | `SYSTEM`, `EDIT_RULES` trong `scripts/generate-script.ts` + `scripts/style-guides.ts` |

---

## 3. Dữ liệu trên đĩa

Tất cả đường dẫn tính từ **thư mục làm việc** (`process.cwd()`): gốc repo khi chạy `npm start`,
`<userData>/workspace` khi chạy bản desktop (mục 8).

| Đường dẫn | Ai ghi | Ghi chú | Git |
|---|---|---|---|
| `videos/<slug>/script.json` | chat, batch, CLI | Nguồn sự thật của **nội dung** | theo dõi (tuỳ bạn) |
| `videos/<slug>/props.json` | pipeline, trình chỉnh sửa | Nguồn sự thật để **render** | theo dõi |
| `videos/<slug>/chat.json` | `server/chat.ts` | Lịch sử tin nhắn + lựa chọn của video | theo dõi |
| `videos/<slug>/multi.json` | tab 🎬 Nhiều cảnh | Danh sách prompt từng cảnh | theo dõi |
| `videos/<slug>/post-copy.json` | `scripts/post-copy.ts` | Gợi ý bài đăng, kèm vân tay lời video | theo dõi |
| `out/<slug>.mp4`, `out/scenes/` | `scripts/render.ts` | Sinh lại được | bỏ qua |
| `public/voices/<slug>/` | `scripts/tts.ts` | Giọng đọc, sinh lại được | bỏ qua |
| `public/images/<slug>/`, `shared/` | người dùng, Pexels, Gemini | Ảnh cảnh | theo dõi |
| `public/uploads/`, `public/videos/` | tải lên, AI video | File người dùng | bỏ qua |
| `public/music/`, `public/sfx/` | `scripts/make-audio*.{ts,sh}` | Nhạc/tiếng động mặc định, khoá không cho xoá | theo dõi |
| `data/api-keys.json` | `server/keys.ts` | **Key bí mật**, quyền 600 | bỏ qua |
| `data/batches/` | `server/batch.ts` | Trạng thái từng loạt | bỏ qua |
| `.trash/` | `server/app-trash.ts` | Thùng rác của app | bỏ qua |
| `vendor/` | `desktop/fetch-*.sh` | llama-server, model GGUF, yt-dlp | bỏ qua |
| `whisper.cpp/` | `@remotion/install-whisper-cpp` | Phiên âm, tải lần đầu (~1,5 GB) | bỏ qua |

Đổi hình dạng một file trong `videos/` là đụng dữ liệu người dùng đã có — xem mục 6.4.

---

## 4. Các luồng chính

### 4.1. Chat: một lượt tạo/sửa video

```
app.js send() ─POST /api/chat─► chat.ts startTurn()  → trả jobId ngay
                                  └─ startJob(runPipeline)  (server/jobs.ts)
app.js follow(jobId) ─GET /api/job/<id> (SSE)─► từng dòng log, cuối cùng "__END__" + result

runPipeline:
  1. kịch bản   generateScript / editScript (AI) hoặc textToScript (lời dán) → script.json
  2. giọng      generateVoiceover → public/voices/<slug>/line-NN.mp3
  3. props      scriptToProps (mốc ms từ độ dài giọng thật) → props.json
  4. render     renderShort → out/<slug>.mp4
```

Log là chuỗi thường, cộng mấy dòng đánh dấu cho giao diện: `__STEP__ <script|voice|render>` đổi bước,
`__PROGRESS__ <0-100>` đổi phần trăm, `__DONE__` / `__ERROR__ <lỗi>` kết thúc. Thêm bước mới vào
pipeline thì thêm cả vào `STEPS` và `follow` trong `app.js`.

### 4.2. Trình chỉnh sửa

- `/editor.html#<slug>` tải `/editor/app.js`, do `server/editor-build.ts` bundle bằng esbuild **lúc
  chạy** (có cache) — không có bước build. Tailwind cũng dựng lúc chạy cho các class composition dùng.
- Xem trước bằng `@remotion/player` với **đúng composition trong `src/`** → xem trước khớp bản render.
- Mọi thao tác timeline là hàm thuần trong `ops.ts` (props cũ → props mới); hoàn tác/làm lại chỉ là
  giữ danh sách props.
- Lưu và render qua các route `/api/editor/...`.

### 4.3. Hàng loạt và phụ đề nhiều video

`server/batch.ts` giữ hàng đợi trong `data/batches/<id>.json`, chạy từng video bằng đúng các bước của
chat; bật "chốt duyệt" thì cả loạt dừng sau bước chuẩn bị lời để người duyệt rồi mới dựng. Màn 🔤 Phụ đề (`server/public/subs.js`) chỉ là cách nhập
gọn cho một loạt kiểu `subs`: phiên âm bằng whisper.cpp (`scripts/transcribe.ts`), khớp mép câu với
khoảng lặng thật (`scripts/subtitle-align.ts`), dịch tuỳ chọn (`scripts/translate.ts`).

### 4.4. AI viết lời

```
scriptProviders(choice)  →  danh sách nhà cung cấp có key, theo PROVIDER_ORDER
  thử lần lượt; lỗi hết lượt/quá tải (ProviderUnavailable) → sang cái sau
  kết quả → tidyScript (cắt độ dài, sửa màu, bỏ tên ảnh bịa, bỏ cảnh trùng) → zod
```

Việc nhỏ (ý tưởng, chuẩn hoá lời, gợi ý bài đăng) dùng `askJson` trong `scripts/llm-json.ts` — cùng
danh sách nhà cung cấp, không cần structured output nặng.

---

## 5. Quy ước code

- **Không framework, không bước build cho server và giao diện chính.** `node:http`, JS thuần. Đừng
  thêm Express/React vào `server/public` chỉ để tiện — lý do là app phải chạy được trong bản desktop
  không có bước build.
- **Chú thích bằng tiếng Việt và giải thích *vì sao*,** nhất là khi code trông kỳ lạ vì một lỗi đã gặp
  (vd. dùng `text-shadow` thay `-webkit-text-stroke`). Không xoá những chú thích đó khi refactor.
- **Đọc `process.env` lúc gọi, không lúc import.** Người dùng lưu key trong Cài đặt là dùng được ngay,
  không khởi động lại.
- **Key bí mật không bao giờ về trình duyệt** — `keyStatus()` chỉ trả "đã có" + 4 ký tự cuối.
- **Một nguồn cho luật phong cách:** prompt đọc thẳng từ `SKILL.md` (`scripts/style-guides.ts`). Sửa
  cách AI viết cho một phong cách = sửa skill, không chép luật vào code.
- **AI viết chữ, code tính giờ.** Model không bao giờ đặt `startMs`/`endMs`.
- **Hàm thuần cho logic khó:** `server/editor/ops.ts`, `src/audio/mix.ts`, `scripts/group-captions.ts`
  test được bằng `tsx` không cần render.
- **Không xoá hẳn file người dùng:** dời vào `.trash` (`server/app-trash.ts`), hết hạn thì chuyển vào
  Thùng rác hệ điều hành (`scripts/trash.ts`).
- **Thông báo lỗi cho người dùng bằng tiếng Việt, nói cách sửa**, không chỉ nói lỗi gì.
- **Số đo thật đi kèm quyết định:** khi chọn model/giới hạn dựa trên đo đạc, ghi số đo và ngày vào
  chú thích hoặc `docs/`.
- Định dạng: Prettier (`.prettierrc`: 2 dấu cách), ESLint config của Remotion cho `src/`.

---

## 6. Công thức cho các thay đổi thường gặp

### 6.1. Thêm một phong cách hình ảnh

1. `src/styles/meta.ts`: thêm id vào `STYLE_IDS` và mục mô tả trong `STYLES` (nhãn, emoji, mô tả…).
2. `src/styles/<id>/index.tsx`: component nhận `ShortProps`, tự vẽ mọi lớp. Chép khung từ phong cách
   gần giống nhất, dùng tiện ích trong `src/styles/shared.tsx`. Giữ đúng thứ tự lớp (README mục 7).
3. `src/styles/registry.tsx`: thêm một dòng vào `STYLE_COMPONENTS` (TypeScript báo lỗi nếu quên).
4. `.claude/skills/style-<id>/SKILL.md`: luật hình ảnh + đoạn `<!-- ai-guide -->…<!-- ai-guide -->`
   hướng dẫn AI viết nội dung. Thiếu đoạn này AI viết không đúng nhịp phong cách.
5. Bản desktop tự nhận (`.claude/skills/style-*` đã có trong danh sách đóng gói).
6. Kiểm: `npm run dev` (Remotion Studio) đổi `style` trong props; tạo một video thật bằng giao diện;
   soi vùng an toàn 9:16 và một khung 16:9.

### 6.2. Thêm nhà cung cấp AI viết kịch bản

Trong `scripts/generate-script.ts`:

- Dịch vụ có API kiểu OpenAI: chỉ thêm mục vào `COMPAT_PROVIDERS` + id vào `ScriptProvider` và
  `PROVIDER_ORDER`. `callCompatible` lo phần còn lại.
- Dịch vụ khác: viết `callXxx(system, content)`, trả object JSON; ném `ProviderUnavailable` khi hết
  lượt/quá tải để "Tự động" thử tiếp; thêm nhánh trong `callModel`, `hasScriptKey`, `providerModel`,
  `providerLabel`.
- Prompt nhỏ (ngữ cảnh hẹp hoặc hạn mức token thấp): thêm vào `SMALL_PROMPT`.

Rồi: nhánh tương ứng trong `scripts/llm-json.ts` (`askJson`), ô key + lựa chọn trong
`server/keys.ts`, và nếu dùng để dịch thì `scripts/translate.ts`. Giao diện tự hiện nhà cung cấp mới
qua `scriptProviderCatalog()`.

### 6.3. Thêm một ô trong ⚙️ Cài đặt

Thêm mục vào `KEY_FIELDS` (`server/keys.ts`): `secret` (key), `text`, hoặc `select`; `showIf` để ẩn
theo ô khác. Giao diện tự vẽ; giá trị có trong `process.env.<NAME>` ngay sau khi lưu. Ô chữ tự do
(có dấu cách, tiếng Việt) cần `freeText: true`, không thì bị chặn như key.

### 6.4. Thêm/đổi trường trong props.json hoặc script.json

1. Sửa zod trong `schema.ts` (props) hoặc `script.ts` (script). **Trường mới phải tuỳ chọn hoặc có
   mặc định** — các `props.json` cũ của người dùng vẫn phải đọc được.
2. Nếu là thứ AI viết: thêm vào `videoScriptSchema`, cập nhật `SYSTEM` prompt và `tidyScript`.
   Nhớ `openAISchema()` bỏ ràng buộc độ dài — giới hạn được áp lại bằng `tidyScript`.
3. Nếu tính từ script: `scriptToProps`.
4. Nếu chỉnh được trong trình chỉnh sửa: hàm trong `ops.ts` + điều khiển trong `Inspector.tsx`.
5. `defaultProps.ts` để Remotion Studio mở được.
6. Kiểm với một video cũ trong `videos/`: mở trình chỉnh sửa, render lại.

### 6.5. Thêm route API và giao diện

1. `server/index.ts`: thêm khối `if (route === "/api/...")` gần các route cùng nhóm; lỗi nhập liệu trả
   400 kèm `{ error }` tiếng Việt. Việc lâu > vài giây: `startJob` rồi trả `{ jobId }`, giao diện theo
   dõi qua `/api/job/<id>`.
2. Logic đặt trong `scripts/` (nếu CLI cũng dùng) hoặc một module `server/*.ts`, không viết dài trong
   `index.ts`.
3. Giao diện chính: tính năng nhỏ sửa trong `app.js`; tính năng có hộp thoại riêng thì tách file như
   `subs.js`, `post-copy.js` — nạp sau `app.js` trong `index.html`, dùng chung `$`, `api`, `postJson`,
   `escapeHtml`, `flashNote`. Luôn `escapeHtml` mọi chuỗi từ server/người dùng khi ghép HTML.
4. CSS nằm trong `<style>` của `index.html`; dùng biến màu `--panel`, `--line`, `--accent`… Đặt tên
   class có tiền tố riêng — tên chung như `.multi` đã có sẵn và sẽ đè kiểu.

### 6.6. Thêm file hoặc thư mục cấp gốc mới

Bản desktop chỉ mang theo những gì được liệt kê. Thêm thư mục mã nguồn mới (vd. `lib/`) phải sửa **cả
ba** chỗ:

| Chỗ | Để làm gì |
|---|---|
| `build.files` trong `package.json` | electron-builder đóng gói |
| `CODE` trong `desktop/main.cjs` | chép sang thư mục làm việc mỗi lần đổi phiên bản |
| dòng `cp -R` trong `desktop/build-win.sh` và `build-linux.sh` | bản build Windows/Linux dựng trong thư mục stage |

Tài nguyên người dùng sửa được (ảnh, nhạc mặc định) thì thêm vào `SEED` thay vì `CODE` — `SEED` chỉ
chép file còn thiếu, không đè.

### 6.7. Nâng Remotion

```bash
npx remotion upgrade
```

Mọi gói `remotion`/`@remotion/*` phải cùng phiên bản. Sau khi nâng: `npm run lint`, render thử một
video mỗi phong cách hay dùng, mở trình chỉnh sửa (Player và composition phải cùng bản). Chrome
Headless Shell đổi phiên bản theo Remotion — `build-win.sh`/`build-linux.sh` đọc `TESTED_VERSION` tự
động.

### 6.8. Nâng llama.cpp hoặc đổi model AI có sẵn

`desktop/fetch-local-ai.sh`: đổi `LLAMA_BUILD`, hoặc `MODEL_FILE` + `MODEL_URL` + `MODEL_SHA256` (lấy
SHA-256 từ trang file trên Hugging Face). Đổi model thì đổi `LOCAL_MODEL_FILE`, `LOCAL_MODEL_NAME` trong
`scripts/local-ai.ts`. Chạy lại các bài đo trong `docs/ai-tren-may.md` mục 0 và ghi số mới. Kiểm
**giấy phép** model trước khi đóng gói (Qwen2.5 3B không dùng thương mại được). Model > ~900 MB thêm nữa
có thể làm bộ cài Windows vượt giới hạn ~2 GB của NSIS.

---

## 7. Kiểm tra trước khi commit

Dự án không có bộ test tự động. Tối thiểu:

```bash
npm run lint
```

(`eslint src && tsc` — `tsc` kiểm cả `server/`, `scripts/`.)

Sau đó tuỳ phần đã sửa:

| Sửa | Kiểm thêm |
|---|---|
| `src/` (hình) | `npm run dev` mở Remotion Studio; render một video thật; soi 9:16 và 16:9 |
| `server/`, `scripts/` | `npm start`, làm trọn một video từ giao diện; xem log server |
| `server/public/` | Tải lại trang, mở Console xem lỗi; thử trên màn hẹp (< 900px) |
| `server/editor/` | Mở một video cũ trong trình chỉnh sửa, thao tác vài lần, hoàn tác, render |
| Logic thuần (`ops.ts`, `mix.ts`…) | Viết nhanh một file `tsx` gọi hàm, so kết quả |
| `desktop/` | `npm run desktop` (chạy Electron trên mã nguồn) |
| AI / prompt | Chạy ít nhất một nhà cung cấp mạnh (Gemini) và AI có sẵn trong app; đọc kết quả, không chỉ xem JSON hợp lệ |

Chạy `tsx` với file `.mts` hoặc `import` ESM từ ngoài repo có thể nạp **hai bản** của cùng một module
(CJS và ESM) — biến trạng thái trong module (vd. tiến trình llama-server) không dùng chung. Viết file
thử dạng `.ts` rồi gọi trong hàm `async` để tránh.

---

## 8. Phát hành bản desktop

```bash
npm run dist:mac      # .dmg Apple Silicon
npm run dist:win      # .exe NSIS x64 — build ngay trên macOS
npm run dist:linux    # .AppImage x64
```

Mỗi lệnh tự tải Chrome Headless Shell, llama-server + model, yt-dlp cho đúng nền tảng (cache ở
`release/cache`, model ở `vendor/models`). Cần mạng lần đầu và **ổ trống vài GB** mỗi bản (model ~1 GB
bị chép vào app và vào bộ cài).

Bản đóng gói chạy thế nào (`desktop/main.cjs`):

- `asar: false`; mã nguồn TypeScript chạy trực tiếp bằng `tsx` qua Node của Electron
  (`ELECTRON_RUN_AS_NODE`).
- Thư mục làm việc: `<userData>/workspace` — macOS `~/Library/Application Support/AI Video Studio/workspace`,
  Windows `%APPDATA%\AI Video Studio\workspace`. `CODE` chép lại khi đổi phiên bản, `node_modules` là
  symlink/junction về app, dữ liệu người dùng giữ nguyên.
- Binary đi kèm (`vendor/`) đọc thẳng trong app qua `LOCAL_AI_DIR`, không chép.
- PATH được dựng lại: ffmpeg từ `ffmpeg-static` (bản của Remotion bị rút gọn), ffprobe từ
  `@remotion/compositor-*`.

Trước khi phát hành:

1. Tăng `version` trong `package.json` (thư mục làm việc chỉ chép code mới khi phiên bản/mtime đổi).
2. `npm run lint`, làm một video bằng `npm run desktop`.
3. Build, cài bản vừa build lên máy sạch nếu được; mở app, tạo một video không cần key (AI có sẵn +
   giọng máy), render xong.
4. macOS chưa ký (`identity: null`): người dùng phải chuột phải › Open lần đầu.

---

## 9. Những cái bẫy đã gặp

Mỗi dòng dưới đây đã từng gây lỗi thật; code tương ứng có chú thích.

| Bẫy | Hậu quả | Chỗ xử lý |
|---|---|---|
| `bundle()` của Remotion **chép** `public/` lúc bundle | Giọng tạo lại cùng tên → render phát giọng cũ | `scripts/render.ts`: symlink `public/`; Windows bundle lại khi `public/` đổi |
| `<TransitionSeries>` rút ngắn timeline | Phụ đề lệch tiếng | Chuyển cảnh bằng opacity trong `src/scenes/Scenes.tsx` |
| Đặt `Background` sau `Scenes` | Nền đục che hết ảnh | Giữ thứ tự lớp (README mục 7) |
| `-webkit-text-stroke` | Viền ăn vào nét, dính dấu tiếng Việt | Viền bằng vòng `text-shadow` (`CustomCaptions.tsx`) |
| Ngắt dòng phụ đề theo số từ | Dòng tiếng Việt cụt, cắt giữa cụm | Theo 42 ký tự (`scripts/group-captions.ts`) |
| `eleven_multilingual_v2` | Không hỗ trợ tiếng Việt | Mặc định `eleven_v3` |
| `fetch` của Node chờ header quá 5 phút | Model chạy lâu trông như mất kết nối | Luôn `stream: true` với AI trên máy |
| Ollama mặc định ~4K token ngữ cảnh, cắt âm thầm | Model quên luật | `num_ctx` 16K; llama-server `--ctx-size 16384` |
| `SIGTERM` với llama-server | Chờ kết nối keep-alive đóng, không thoát | `SIGKILL` (`scripts/local-ai.ts`) |
| Windows: `kill()` cắt ngang server Node | llama-server mồ côi giữ RAM | `taskkill /T` cả cây (`desktop/main.cjs`) |
| App mở từ Finder | PATH tối thiểu, không thấy ffmpeg/Homebrew | Dựng PATH trong `main.cjs` |
| Windows gọi biến là `Path` | Thêm thư mục vào PATH không ăn | Gom mọi biến thể về `PATH` |
| Key còn trong `.env` và trong Cài đặt | Hai nguồn đánh nhau | `loadKeys()` chuyển sang `data/api-keys.json` rồi bỏ qua `.env` |
| Model nhỏ trả màu `#FFF`, lặp cảnh, bịa tên ảnh | Hỏng cả lượt tạo video | `tidyScript` sửa nhẹ thay vì báo lỗi |
| Class CSS tên chung trong `index.html` | Kiểu của phần khác đè vào hộp thoại mới | Tiền tố riêng cho class mới |

---

## 10. Gỡ lỗi

| Cần | Ở đâu |
|---|---|
| Log server khi chạy `npm start` | Terminal |
| Log server bản desktop | Menu **Thư mục › Mở log server** — macOS `~/Library/Logs/AI Video Studio/server.log` |
| Dữ liệu bản desktop | Menu **Thư mục › Mở thư mục dữ liệu** |
| Lỗi giao diện | DevTools (bản desktop: menu View › Toggle Developer Tools) → Console, Network |
| Log một job đang chạy | `GET /api/job/<id>` (SSE) — mở thẳng trong trình duyệt |
| Pipeline từng bước có cũ không | `server/pipeline.ts` so mtime `script.json` → `props.json` → mp4 |
| Render một video không qua giao diện | `npx tsx scripts/render-all.ts` hoặc `npx remotion render Short out/x.mp4 --props=videos/<slug>/props.json` |
| Composition trông sai | `npm run dev`, dán `props.json` của video vào Remotion Studio |

Khi sửa xong một lỗi khó thấy: thêm chú thích *vì sao* ngay tại chỗ sửa, và nếu nó là bẫy có thể lặp
lại thì thêm một dòng vào bảng mục 9.
