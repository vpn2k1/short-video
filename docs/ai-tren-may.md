# AI viết kịch bản chạy trên máy

Viết và sửa kịch bản bằng một model AI chạy ngay trên máy — không cần API key, không gửi dữ liệu
ra ngoài, không cần mạng khi chạy. Tài liệu này ghi lại cách nó hoạt động, cách cài, và **kết quả đo
thật** để biết nên kỳ vọng tới đâu.

Có hai cách:

- **AI có sẵn trong app** — bộ cài desktop kèm luôn runtime và model, cài xong dùng được ngay. Xem
  [mục 0](#0-ai-có-sẵn-trong-app).
- **Ollama** — người dùng tự cài, chọn được model lớn hơn. Các mục 1–10 bên dưới.

---

## 0. AI có sẵn trong app

| | |
|---|---|
| Runtime | `llama-server` của [llama.cpp](https://github.com/ggml-org/llama.cpp), bản `b10995` (MIT) — macOS dùng Metal, Windows/Linux dùng Vulkan, không có GPU thì chạy CPU |
| Model | `qwen2.5-1.5b-instruct-q4_k_m.gguf` (Qwen2.5 1.5B, Apache 2.0) — cùng model mặc định của Ollama ở dưới, nên chất lượng như số đo mục 7 |
| Bộ cài nặng thêm | ~1,1 GB (model ~1,07 GB + runtime 25 MB trên macOS, ~80 MB trên Windows/Linux) |
| RAM khi chạy | ~1,5 GB; tự tắt sau 5 phút không dùng để nhường RAM cho lúc render |
| Dùng cho | Viết/sửa kịch bản, 🪄 Chuẩn hoá lời, nghĩ ý tưởng hàng loạt, dịch phụ đề (trình chỉnh sửa → Model dịch → "Trên máy") |

### Cách dùng

Không cần làm gì. Chưa điền key nào thì "Tự động" tự dùng AI có sẵn (nó đứng cuối hàng thử, sau mọi
key và Ollama). Muốn chỉ dùng nó: **⚙️ Cài đặt → AI viết kịch bản → AI có sẵn trong app**, hoặc chọn ở
chip 🤖 của từng video.

### Đóng gói

`npm run dist:mac` / `dist:win` / `dist:linux` tự gọi `scripts/setup-local.ts --platform <nền tảng>`:

1. Tải bản llama.cpp đã ghim vào `release/cache`, chỉ giữ `llama-server` và thư viện nó cần.
2. Tải model một lần vào `vendor/models` (kiểm SHA-256), bản Windows/Linux chép sang thư mục stage.
3. electron-builder đưa `vendor/llama/<os>-<arch>` và `vendor/models` vào app.

Chạy từ mã nguồn (`npm start`) thì `npm install` tự tải; tải lại riêng phần này:

```bash
npm run setup -- --only ai
```

Thư mục `vendor/` nằm trong `.gitignore`. Code: `scripts/local-ai.ts`.

### Cách chạy

- App đóng gói truyền `LOCAL_AI_DIR` trỏ vào `vendor` bên trong app — model không bị chép sang thư
  mục dữ liệu người dùng.
- Lần gọi đầu tiên bật `llama-server` ở một cổng trống của `127.0.0.1` (`--ctx-size 16384 --parallel 1`),
  chờ `/health` báo sẵn sàng (nạp model ~1–2 giây trên Apple M2), rồi gọi `/v1/chat/completions` có
  `response_format: json_schema` để ép đúng cấu trúc kịch bản.
- Tắt server Node (đóng app) thì `llama-server` tắt theo. Windows: app tắt cả cây tiến trình bằng
  `taskkill /T`.

### Số đo (16/09/2026, Apple M2 16 GB, trong app)

| Bài thử | Thời gian | Kết quả |
|---|---|---|
| Tạo "5 mẹo ngủ ngon", Phụ đề nổi bật | 5,6 s (gồm bật model) | ⚠️ Hợp lệ, nội dung nhạt; lọt chữ "Call-to-action:" vào câu cuối |
| Sửa "thêm câu cuối kêu gọi bình luận" | 4,3 s | ✅ Giữ nguyên câu cũ, thêm đúng câu mới |
| Sửa "đổi câu đầu thành câu hỏi" | 3,2 s | ❌ Thêm dấu "?" vào cả 5 câu |
| Dịch 3 câu Việt → Anh | 2,7 s | ✅ Đúng nghĩa, tự nhiên |
| 🪄 Chuẩn hoá lời (4 câu) | 2,2 s | ✅ Giữ nguyên lời |

Kết luận giống mục 8: đủ để làm video đơn giản và dịch câu ngắn khi không có mạng; **sửa kịch bản
theo câu lệnh vẫn chưa tin cậy** — cần chính xác thì dùng key miễn phí (Gemini, Groq).

> Ollama có bản cho **Windows, macOS và Linux** — hướng dẫn dưới đây ghi cách làm cho cả ba.
> Số liệu đo ngày 15/09/2026 trên một máy Apple M2, 16 GB RAM, Ollama 0.34.0; máy khác sẽ nhanh/chậm hơn
> tuỳ RAM, GPU.

## Mục lục

1. [Tóm tắt nhanh](#1-tóm-tắt-nhanh)
2. [Chuyện gì xảy ra khi gõ vào ô "Muốn sửa gì?"](#2-chuyện-gì-xảy-ra-khi-gõ-vào-ô-muốn-sửa-gì)
3. [Khi chưa có API key](#3-khi-chưa-có-api-key)
4. [Cài Ollama và bật trong app](#4-cài-ollama-và-bật-trong-app)
5. [Chọn model](#5-chọn-model)
6. [Cách tích hợp hoạt động](#6-cách-tích-hợp-hoạt-động)
7. [Kết quả chạy thử thật](#7-kết-quả-chạy-thử-thật)
8. [Giới hạn và khuyến nghị](#8-giới-hạn-và-khuyến-nghị)
9. [Xử lý sự cố](#9-xử-lý-sự-cố)
10. [Hướng tiếp theo](#10-hướng-tiếp-theo)

---

## 1. Tóm tắt nhanh

| | |
|---|---|
| Model mặc định | `qwen2.5:1.5b` (~1 GB, máy 8 GB RAM chạy được) |
| Tốc độ | 6–16 giây mỗi lần AI viết/sửa (đo trên Apple M2) |
| Tạo kịch bản ngắn, đơn giản | ⚠️ Dùng được, nội dung nhạt |
| Sửa theo câu lệnh | ❌ Chưa tin cậy — hay làm thừa hoặc sửa sai chỗ |
| Phong cách phức tạp (Câu đố, Top xếp hạng) | ❌ Kém |
| Khi nào nên dùng | Không có mạng/không có key, video đơn giản, hoặc làm dự phòng khi AI trên mạng hết lượt |

Muốn sửa kịch bản chính xác: dùng một key miễn phí (Gemini, Groq, OpenRouter) hoặc thử model lớn
hơn `qwen2.5:3b` — xem [mục 10](#10-hướng-tiếp-theo).

---

## 2. Chuyện gì xảy ra khi gõ vào ô "Muốn sửa gì?"

Tuỳ chip **Kịch bản** đang chọn ở cột bên phải khung chat:

| Chế độ | Nội dung bạn gõ được hiểu là |
|---|---|
| 🤖 **AI viết** | **Câu lệnh sửa.** AI đọc kịch bản hiện tại + câu lệnh, trả về kịch bản mới |
| 📝 **Nguyên văn** | **Chính kịch bản mới**, từng chữ. Không có AI. Gõ "sửa lại hay hơn" thì video chỉ còn đúng câu đó |
| ✂️ Trình chỉnh sửa (Edit video) | Sửa chữ phụ đề chỉ đổi chữ trên màn hình — **giọng đọc vẫn nói câu cũ** |

### Luồng xử lý ở chế độ 🤖 AI viết

```
câu lệnh ─┐
          ├─► AI (Claude / Gemini / … / Ollama) ─► script.json mới
script.json hiện tại ─┘                                   │
                                                          ▼
                              đọc lại TOÀN BỘ giọng (voices/<video>/line-NN.mp3)
                                                          ▼
                              dựng lại props.json từ đầu ─► render mp4 mới
```

Code: `runPipeline` trong `server/chat.ts`, `editScript` trong `scripts/generate-script.ts`.

Chip phong cách, giọng, khung hình, nhạc được áp lại mỗi lần gửi. Đổi phong cách trước khi gửi thì AI
được báo để chỉnh nhịp câu, tag, câu nhấn cho hợp.

### AI thấy gì, không thấy gì

| AI **thấy** | AI **không thấy** |
|---|---|
| Chữ từng câu, theo thứ tự cảnh | Hình ảnh thật — chỉ biết tên file |
| Tên file ảnh của từng cảnh | Video đã render, giọng đọc |
| Tag, câu nhấn, số liệu, phong cách | Chỉnh tay trong ✂️ Edit video |

> ⚠️ Vì `props.json` được dựng lại từ kịch bản, **mọi chỉnh tay trong trình chỉnh sửa sẽ mất** khi sửa
> bằng ô chat: crop, chữ tự do, âm thanh thêm tay, thời gian đã kéo. Sửa nội dung bằng chat trước,
> chỉnh tay sau cùng.

### Viết câu lệnh để AI hiểu đúng

AI được dặn cách hiểu các từ này (luật `EDIT_RULES`):

- **"câu"** = một dòng lời đọc, đánh số liên tục qua mọi cảnh. "câu đầu" = câu đầu của cảnh 1.
- **"cảnh 2"** = cảnh thứ hai.
- **"tiêu đề"** = `title`, **"dòng mô tả"** = `subtitle`. Không nhắc tới thì không đổi.

| ❌ Mơ hồ | ✅ Rõ ràng |
|---|---|
| sửa lại hay hơn | Viết lại câu đầu thành câu hỏi gây tò mò, giữ nguyên các câu còn lại |
| ngắn thôi | Rút còn 3 cảnh, bỏ cảnh 2, tổng khoảng 15 giây |
| đổi số liệu | Cảnh 3: đổi "7 giờ" thành "7–9 giờ", số liệu lớn cũng đổi theo |
| thêm kết | Thêm câu cuối: "Bạn ngủ mấy tiếng mỗi đêm?" |
| ảnh không hợp | Cảnh 1 dùng ảnh tôi vừa tải lên, cảnh 4 bỏ ảnh |

Mẹo: mỗi lần một nhóm thay đổi; muốn giữ chữ thì nói "giữ nguyên từng chữ các câu khác".

---

## 3. Khi chưa có API key

- Chế độ 🤖 AI viết bị khoá, khung chat tự chuyển sang 📝 Nguyên văn.
- Gửi ở chế độ AI mà chưa có AI nào → server báo *"Chưa có AI viết kịch bản…"* kèm gợi ý key miễn phí,
  Ollama, hoặc Nguyên văn.
- Có Ollama thì không cần key nào: làm theo mục 4.

---

## 4. Cài Ollama và bật trong app

### 4.1. Cài Ollama

| Hệ điều hành | Cách cài | Chạy nền |
|---|---|---|
| **Windows 10/11** | Tải `OllamaSetup.exe` ở https://ollama.com/download rồi cài như app thường | Tự chạy nền (biểu tượng ở khay hệ thống) |
| **macOS** | Tải app ở https://ollama.com/download, kéo vào Applications. Hoặc Homebrew: `brew install ollama` | App: tự chạy nền. Bản Homebrew: chạy `ollama serve` |
| **Linux** | `curl -fsSL https://ollama.com/install.sh \| sh` | Cài sẵn dịch vụ systemd, tự chạy |

Windows không có GPU rời vẫn chạy được `qwen2.5:1.5b` bằng CPU, chỉ chậm hơn.

### 4.2. Tải model

Mở **PowerShell** (Windows) hoặc **Terminal** (macOS/Linux):

```bash
ollama pull qwen2.5:1.5b
```

Chỉ khi Ollama chưa chạy nền (thường là bản Homebrew hoặc chạy tay):

```bash
ollama serve
```

### 4.3. Kiểm tra Ollama đã chạy

Mở trình duyệt vào http://127.0.0.1:11434/api/version — thấy dạng `{"version":"0.34.0"}` là được.
Cách này giống nhau trên mọi hệ điều hành. Kiểm tra model đã tải:

```bash
ollama list
```

### 4.4. Bật trong app

Mở **⚙️ Cài đặt → Viết kịch bản**:

| Ô | Giá trị | Ghi chú |
|---|---|---|
| AI viết kịch bản | **Ollama — chạy trên máy, không cần mạng** | Chọn cái này để chỉ dùng Ollama |
| Model Ollama (trên máy) | `qwen2.5:1.5b` | Điền tên model là bật Ollama. Bỏ trống + chọn Ollama ở trên → dùng mặc định |
| Địa chỉ Ollama | bỏ trống | Mặc định `http://127.0.0.1:11434` |

Lưu vào `data/api-keys.json` (không commit), có hiệu lực ngay, không cần khởi động lại.

### 4.5. Thứ tự khi để "Tự động"

```
Claude → ChatGPT → Gemini → Groq → OpenRouter → Ollama
```

Lấy cái đầu tiên có key. Nhà cung cấp trên mạng hết lượt/hết tiền/quá tải thì tự chuyển sang cái sau —
nên **điền tên model Ollama + để Tự động** = dùng AI trên mạng, tới lúc hỏng thì rơi về Ollama.

---

## 5. Chọn model

Dung lượng tra trên thư viện Ollama ngày 15/09/2026 (bản lượng tử hoá mặc định).

| Model | Dung lượng | Máy tối thiểu | Nhận xét |
|---|---|---|---|
| **`qwen2.5:1.5b`** ✅ mặc định | ~986 MB | 8 GB RAM | Không bật "suy nghĩ", nhanh, bám JSON schema. Đủ cho kịch bản ngắn |
| `qwen2.5:3b` | ~1,9 GB | 8–16 GB RAM | Viết tiếng Việt tốt hơn rõ — **chưa đo trong project** |
| `qwen2.5:0.5b` | ~398 MB | máy rất yếu | Dễ sai cấu trúc — không khuyên dùng |
| `gemma3:1b` | ~815 MB | 8 GB RAM | Nhẹ, thường yếu tiếng Việt hơn Qwen |
| `qwen3:1.7b` | ~1,4 GB | 8 GB RAM | Bật "suy nghĩ" mặc định → chậm hơn nhiều cho việc này |
| `qwen3.5:0.8b` | ~1,0 GB | 8 GB RAM | Mới, đa phương thức — chưa đo |

Qwen2.5 bản 0.5B/1.5B/3B dùng giấy phép cho phép dùng thương mại; kiểm tra lại giấy phép của model
cụ thể trước khi phát hành kèm sản phẩm.

---

## 6. Cách tích hợp hoạt động

Toàn bộ nằm trong `scripts/generate-script.ts` (hàm `callOllama`), cấu hình trong `server/keys.ts`.

### 6.1. Gọi model

| Thiết lập | Giá trị | Vì sao |
|---|---|---|
| API | `POST /api/chat` (API gốc của Ollama) | Chỉ API gốc đặt được `num_ctx` |
| `stream` | `true` | Không stream mà sinh lâu quá 5 phút thì `fetch` của Node tự cắt (headersTimeout) — trông y như mất kết nối |
| `format` | JSON Schema của kịch bản | Ép model trả đúng cấu trúc `script.json` |
| `num_ctx` | 16 384 token | Mặc định Ollama chỉ ~4K và **cắt âm thầm** — prompt sửa kịch bản dài hơn thế, bị cắt là model quên luật |
| `num_predict` | 4 096 token | Kịch bản thật chỉ ~600–1 500 token; vượt là model đang lặp lại |
| `temperature` | 0,4 | Ổn định hơn cho việc bám cấu trúc |
| Thời gian chờ tối đa | 10 phút | Máy cá nhân chậm hơn API nhiều |

### 6.2. Rút gọn prompt cho model nhỏ

Ở chế độ **Tự động**, prompt gửi AI trên mạng kèm hướng dẫn của **cả 16 phong cách** (~19 000 ký tự).
Model 1.5B nhận prompt đó thì vượt ngữ cảnh và rối. Với Ollama, app **đoán phong cách bằng từ khoá
trước** (cùng bộ đoán của chế độ Nguyên văn — `textToScript`) rồi chỉ gửi hướng dẫn của phong cách đó
(~600 ký tự với Phụ đề nổi bật).

### 6.3. Sửa nhẹ kết quả thay vì bỏ cả lượt (`tidyScript`, áp cho mọi nhà cung cấp)

| Lỗi model hay mắc | App xử lý |
|---|---|
| Mã màu `#FFF`, `#ff2e63ff`, `red` | Đổi về `#rrggbb`, sai hẳn thì dùng màu mặc định |
| Lặp nguyên một cảnh nhiều lần | Bỏ cảnh trùng hệt lời với cảnh đã có |
| Câu/tag/tiêu đề dài quá giới hạn | Cắt bớt (tag cắt ở ranh giới từ) |
| Bịa tên file ảnh | Đặt ảnh = không có |
| Câu nhấn không có nguyên văn trong câu | Bỏ câu nhấn |

### 6.4. Thông báo lỗi

| Tình huống | App báo |
|---|---|
| Ollama chưa chạy | *Không kết nối được Ollama ở … — mở app Ollama (hoặc chạy "ollama serve")* |
| Chưa tải model | *Máy chưa có model X — chạy "ollama pull X"* |
| Model viết quá dài (đang lặp) | *… viết quá dài và bị cắt — gửi lại, rút gọn yêu cầu, hoặc dùng model lớn hơn* |
| Chạy quá 10 phút | *… chạy quá 10 phút — thử lại với yêu cầu ngắn hơn* |
| Trả về không phải JSON | *… không trả về JSON hợp lệ — thử lại hoặc dùng model lớn hơn* |

---

## 7. Kết quả chạy thử thật

### 7.1. Lần thử đầu — lộ lỗi tích hợp (đã sửa)

| Bài thử | Kết quả | Nguyên nhân → cách sửa |
|---|---|---|
| Tạo, phong cách Tự động | Báo nhầm "không kết nối được" | Prompt 16 phong cách vượt ngữ cảnh, model sinh >11 000 token, request quá 5 phút bị Node cắt → stream + giới hạn token + rút gọn prompt |
| Tạo, Phụ đề nổi bật | 5 cảnh giống hệt nhau, câu vô lý | Model lặp → giới hạn token + bỏ cảnh trùng |
| Sửa "câu đầu thành câu hỏi" | Đổi tiêu đề thay vì câu đầu | Model hiểu "câu đầu" là tiêu đề → luật gọi tên trong `EDIT_RULES` |
| Tạo, Tự động (lần 2) | Hỏng cả kịch bản vì 1 mã màu sai | → tự sửa mã màu |

### 7.2. Sau khi sửa — chạy bằng script

| Bài thử | Thời gian | Kết quả |
|---|---|---|
| Tạo "5 mẹo ngủ ngon", Phụ đề nổi bật | 14 s | ✅ Hợp lệ, dùng tạm được (1 cảnh, 5 mẹo đánh số) |
| Tạo "Top 5 món ăn đường phố", Tự động | 10 s | ⚠️ Chọn đúng Top xếp hạng nhưng 1 cảnh liệt kê 5 món, có món bịa |
| Sửa "câu đầu thành câu hỏi" | 9 s | ❌ Vẫn không đổi câu đầu |

### 7.3. Demo trong giao diện web

**Tạo:** *"Video 20 giây: 5 mẹo ngủ ngon hơn mà không cần thuốc."* — Phụ đề nổi bật, giọng linh.

- AI viết 15,5 s; cả luồng tới mp4 dưới 50 s; video 19,7 s, 1 cảnh, 6 câu.
- Phụ đề khớp giọng đọc 6/6 câu.

```
Bạn đang gặp khó khăn trong việc ngủ ngon? Hãy thử 5 mẹo sau!
1. Cố định giờ đi ngủ
2. Ngủ trong môi trường tối
3. Ngủ với nhiệt độ thấp
4. Ngủ với ánh sáng yếu        ← gần trùng mẹo 2
5. Ngủ trong môi trường yên tĩnh
```

**Sửa:** *"Thêm một câu cuối kêu gọi bình luận: 'Bạn sẽ thử mẹo nào trước? Bình luận nhé!'. Giữ nguyên
các câu khác."*

- AI trả lời ~6 s. Giữ nguyên chữ 6/6 câu cũ, có thêm đúng câu mới, phụ đề khớp giọng 12/12.
- ❌ Nhưng model tạo **cảnh 2**, đặt câu mới lên đầu rồi **chép lại cả 5 mẹo** → video 34 s đọc 5 mẹo
  hai lần. Bộ lọc cảnh trùng không bắt được vì cảnh 2 có thêm một câu khác.

---

## 8. Giới hạn và khuyến nghị

- **Model 1.5B không thay được AI trên mạng cho việc sửa.** Dùng nó để tạo video đơn giản, hoặc làm
  dự phòng khi Gemini/Groq hết lượt.
- **Soát kịch bản trước khi đăng**: model nhỏ hay viết ý trùng, bịa tên riêng, sai sự thật.
- **Phong cách đơn giản hợp hơn**: Phụ đề nổi bật, Chữ động, Phụ đề từng từ. Tránh Câu đố, Top xếp
  hạng, Tin nhắn với model nhỏ.
- **RAM**: model chạy cùng Chrome render video làm máy dùng swap (Windows: pagefile) nhiều. Trên máy
  16 GB đã thấy swap lên 9–12 GB, làm dung lượng ổ đĩa trống dao động hàng GB. Khởi động lại máy để giải
  phóng. Máy 8 GB RAM: đóng bớt app khác khi dựng video.
- **Máy Windows không GPU rời**: chạy bằng CPU, chậm hơn số đo trên Apple M2 nhiều lần — ưu tiên
  `qwen2.5:1.5b`, tránh model lớn.
- **Ổ đĩa**: cần ~1 GB cho model + chỗ trống cho swap. Ổ gần đầy thì tải model hỏng giữa chừng
  (`no space left on device`).

---

## 9. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| "Không kết nối được Ollama" | Mở app Ollama (Windows/macOS) hoặc chạy `ollama serve`; mở http://127.0.0.1:11434/api/version trong trình duyệt để kiểm tra |
| "Máy chưa có model …" | `ollama pull <tên model>` — tên phải khớp ô Model Ollama trong Cài đặt |
| `ollama pull` báo hết dung lượng (`no space left on device`) | Dọn ổ đĩa (xem dưới), xoá file tải dở `*-partial` trong thư mục model (bảng dưới), tải lại |
| Windows: Ollama chạy nhưng app báo không kết nối | Tường lửa/antivirus chặn cổng 11434 — cho phép Ollama, hoặc điền đúng địa chỉ trong ô "Địa chỉ Ollama" |

Thư mục chứa model:

| Hệ điều hành | Đường dẫn |
|---|---|
| Windows | `%USERPROFILE%\.ollama\models` |
| macOS | `~/.ollama/models` |
| Linux (dịch vụ systemd) | `/usr/share/ollama/.ollama/models` |
| Kịch bản lặp cảnh / quá dài | Gửi lại; viết câu lệnh ngắn, một thay đổi mỗi lần; hoặc dùng `qwen2.5:3b` |
| Sửa sai chỗ | Gọi tên chính xác: "cảnh 1, câu 2", "tiêu đề"; hoặc dùng AI trên mạng cho việc sửa |
| Chip "AI viết" vẫn bị khoá | Cài đặt chưa có tên model và chưa chọn Ollama — điền một trong hai |
| Tiếng đọc không khớp chữ phụ đề | Đã sửa: render cũ chép `public/` vào bundle nên phát file giọng cũ. Nếu video làm trước bản sửa bị lệch, gửi lại một yêu cầu sửa để render lại. Còn nếu vừa sửa chữ trong ✂️ Edit video thì giọng không tự đọc lại |

### Dọn ổ đĩa an toàn

Trong app: **Thư viện → 🗂 Tài nguyên → 🗑 Dọn tài nguyên** (ảnh, clip, nhạc, giọng đọc) và
**Thư viện → 🎬 Video → 🗑 Xoá bản cũ** (video kèm bản render, giọng đọc). Cả hai **chuyển vào Thùng rác
của hệ điều hành** (macOS: Thùng rác, Windows: Recycle Bin, Linux: Trash) — lấy lại được; **dọn Thùng rác
mới thật sự giải phóng dung lượng**. Nhạc nền và hiệu ứng mặc định của app được khoá, không xoá được.

Ngoài app, các mục tải/tạo lại được (mọi hệ điều hành): `node_modules/.cache` của project, gói Remotion cũ
trong thư mục tạm (`remotion-webpack-bundle-*` — Windows: `%TEMP%`, macOS/Linux: `$TMPDIR` hoặc `/tmp`),
`npm cache clean --force`, cache Gradle/Flutter/CocoaPods của các project khác. macOS thêm `brew cleanup`;
Windows thêm Disk Cleanup (Dọn dẹp ổ đĩa). Không xoá `videos/`, `out/`, `public/` nếu chưa chắc.

Máy dùng swap/pagefile nhiều (RAM đầy khi vừa chạy model vừa dựng video) thì dung lượng trống dao động —
khởi động lại máy để giải phóng.

---

## 10. Hướng tiếp theo

### 10.1. Thử `qwen2.5:3b`

```bash
ollama pull qwen2.5:3b
```

Điền `qwen2.5:3b` vào ô Model Ollama, chạy lại đúng hai bài demo ở mục 7.3 để so sánh. Lớn gấp đôi,
thường làm theo câu lệnh sửa tốt hơn rõ; chậm hơn và cần ~1,9 GB.

### 10.2. Tinh chỉnh (fine-tune) một model nhỏ riêng

Huấn luyện **từ đầu** không khả thi (dữ liệu và GPU ở quy mô rất lớn). **Tinh chỉnh LoRA** model
`Qwen2.5-0.5B/1.5B` cho đúng một việc (yêu cầu → `script.json`) thì làm được:

| Bước | Nội dung |
|---|---|
| 1. Dữ liệu | 500–2 000 cặp mẫu (tạo mới + sửa), rải đều 16 phong cách. Project hiện chỉ có ~10 kịch bản. Sinh thêm bằng model mã nguồn mở lớn — **không dùng kết quả của Claude/ChatGPT/Gemini để huấn luyện model khác** (điều khoản hạn chế) |
| 2. Lọc | Kiểm từng mẫu bằng schema của app (JSON đúng, câu không quá dài, câu nhấn nguyên văn) |
| 3. Huấn luyện | Apple Silicon: MLX (`mlx_lm`). Windows/Linux có GPU NVIDIA: PEFT/Unsloth. Không có GPU: thuê GPU theo giờ. Ước tính chưa đo: <1 giờ với 0.5B, vài giờ với 1.5B cho ~1 000 mẫu |
| 4. Đánh giá | ~100 yêu cầu chưa dạy; đo tỉ lệ kịch bản hợp lệ và sửa đúng chỗ, so với model chưa tinh chỉnh |
| 5. Đóng gói | Xuất GGUF → `ollama create short-video-vi` → điền tên vào Cài đặt |

Lợi ích: model nhỏ mà bám đúng định dạng, không cần gửi kèm luật dài mỗi lần nên nhanh hơn. Giới hạn:
câu chữ vẫn không hay bằng model lớn. Cần ~6–10 GB ổ đĩa trống để làm.

**Nên làm theo thứ tự**: thử `qwen2.5:3b` → nếu vẫn sai nhiều thì dựng bộ công cụ dữ liệu + đánh giá
→ đủ dữ liệu sạch mới huấn luyện.

### 10.3. Kèm model trong app desktop

Đã làm — xem [mục 0](#0-ai-có-sẵn-trong-app). Bước tiếp: cho chọn model lớn hơn (ví dụ Qwen3 4B
Instruct 2507, Apache 2.0, ~2,5 GB) tải thêm lúc cần, vì kèm sẵn sẽ làm bộ cài Windows vượt giới hạn
~2 GB của NSIS.
