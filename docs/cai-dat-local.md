# Cài và chạy từ mã nguồn — Windows, macOS, Linux

Tài liệu này dành cho người chạy app bằng `npm start` từ mã nguồn, không dùng bộ cài desktop. Bộ cài
desktop đã kèm sẵn mọi thứ dưới đây, cài xong là dùng được.

Tóm tắt: cài **Node.js** và **Git**, rồi chạy `npm install`. Lệnh này tự tải những phần cần để chạy
offline: giọng đọc tiếng Việt, AI viết kịch bản và yt-dlp. Chỉ riêng macOS cần thêm ffmpeg từ Homebrew.

---

## 1. Thành phần nào tự cài, thành phần nào phải cài tay

| Thành phần | Dùng cho | Windows x64 | macOS Apple Silicon | Linux x64 |
|---|---|---|---|---|
| Node.js ≥ 20.12 | Chạy server | cài tay | cài tay | cài tay |
| Git | Tải mã nguồn | cài tay | có sẵn (Xcode CLT) | cài tay |
| ffmpeg | Đổi định dạng audio, giọng Gemini, ghép video | **tự có** (`ffmpeg-static`) | **tự có** (`ffmpeg-static`) | **tự có** (`ffmpeg-static`) |
| ffprobe | Đo độ dài audio/video | **tự có** (kèm Remotion) | **cài tay**: `brew install ffmpeg` | **tự có** (kèm Remotion) |
| Giọng VieNeu (`voice`) | 25 giọng Việt đọc offline | tự tải lúc `npm install` | tự tải | tự tải |
| AI có sẵn (`ai`) | Viết/sửa kịch bản offline (llama.cpp + Qwen2.5 1.5B) | tự tải | tự tải | tự tải |
| yt-dlp (`yt-dlp`) | Mục 📺 Bilibili trong trình chỉnh sửa | tự tải | tự tải | tự tải |
| whisper.cpp | Phiên âm, căn phụ đề | tự tải lúc dùng lần đầu | tự **biên dịch** lúc dùng lần đầu (cần Xcode CLT) | tự **biên dịch** lúc dùng lần đầu (cần `build-essential`) |
| Chrome Headless Shell | Render video | tự tải lúc render lần đầu | tự tải | tự tải (cần vài thư viện hệ thống, xem mục Linux) |

Khi máy đã cài ffmpeg/ffprobe riêng thì app ưu tiên dùng bản đó. Bản đi kèm `node_modules` chỉ được
dùng khi máy chưa có (`scripts/tool-path.ts`).

Máy không nằm trong ba loại trên (Mac chip Intel, Windows ARM) vẫn chạy được app, nhưng không có giọng
đọc và AI offline. Khi đó dùng giọng/AI trên mạng (Gemini, ElevenLabs…) bằng cách điền key trong
**⚙️ Cài đặt**.

### Dung lượng

| Phần | Windows / Linux | macOS |
|---|---|---|
| `voice` | ~650 MB (model fp32) | ~350 MB (model int8) |
| `ai` | ~1,2 GB | ~1,1 GB |
| `yt-dlp` | ~20–35 MB | ~35 MB |
| whisper.cpp + model | ~1,5–2 GB | ~1,5–2 GB |

File tải về được giữ trong `release/cache/` nên lần cài sau không phải tải lại. Cần lấy lại ổ đĩa
thì xoá thư mục này sau khi cài xong. Trên Windows/Linux, thư mục này chiếm thêm khoảng 500 MB vì chứa
một bản sao model giọng đọc.

---

## 2. Windows 10 / 11 (x64)

Cần Windows 10 bản 1803 trở lên: lệnh cài dùng `tar.exe` có sẵn của Windows để giải nén.

### Cài công cụ

1. **Node.js LTS**: tải từ [nodejs.org](https://nodejs.org), hoặc chạy trong PowerShell:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

2. **Git**:

   ```powershell
   winget install Git.Git
   ```

3. Đóng PowerShell rồi mở cửa sổ mới, sau đó kiểm tra:

   ```powershell
   node -v
   git --version
   ```

Không cần cài ffmpeg, Python hay Git Bash.

### Tải mã nguồn và cài

```powershell
git clone https://github.com/vpn2k1/short-video.git
cd short-video
npm install
```

Cuối bước `npm install` sẽ có phần cài giọng đọc/AI offline. Lần đầu mất khoảng 5–15 phút tuỳ tốc độ
mạng, tiến độ hiện theo từng file:

```
■ Giọng đọc VieNeu (~700 MB)
→ Python 3.11.16 độc lập (win-x64)
→ Thư viện Python cho win-x64
→ Model vieneu-v3-turbo (fp32)
→ Chạy thử Python + onnxruntime
✓ Giọng đọc VieNeu (~700 MB) — xong
```

### Chạy

```powershell
npm start
```

Mở **http://localhost:5177** trong trình duyệt.

### Lưu ý riêng cho Windows

- **PowerShell báo `npm.ps1 cannot be loaded because running scripts is disabled`**: gõ `npm.cmd`
  thay cho `npm` (ví dụ `npm.cmd install`), hoặc cho phép chạy script của người dùng hiện tại:

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```

- **Phần mềm diệt virus / SmartScreen xoá `llama-server.exe` hoặc `yt-dlp.exe`**: thêm thư mục
  `short-video\vendor` vào danh sách loại trừ, rồi chạy lại `npm run setup`.
- **Đặt biến môi trường trong PowerShell** khác với bash, ví dụ:

  ```powershell
  $env:PORT=8080; npm start
  ```

- Giọng Windows có sẵn (dự phòng khi chưa có VieNeu) cần gói giọng tiếng Việt:
  **Settings › Time & Language › Speech › Add voices › Tiếng Việt**.

---

## 3. macOS (Apple Silicon M1 trở lên)

### Cài công cụ

1. **Xcode Command Line Tools** (có Git, và trình biên dịch để whisper.cpp tự build):

   ```bash
   xcode-select --install
   ```

2. **Homebrew** (nếu chưa có): xem [brew.sh](https://brew.sh).
3. **Node.js** và **ffmpeg** (ffmpeg cài qua Homebrew để có ffprobe):

   ```bash
   brew install node ffmpeg
   ```

4. Kiểm tra:

   ```bash
   node -v
   ffprobe -version
   ```

### Tải mã nguồn, cài và chạy

```bash
git clone https://github.com/vpn2k1/short-video.git
cd short-video
npm install
npm start
```

Mở **http://localhost:5177**.

### Lưu ý riêng cho macOS

- Mac dùng model giọng **int8**: nhỏ hơn và nhanh hơn fp32, đã kiểm tra không méo tiếng trên chip Apple.
- Chưa có VieNeu thì app dùng giọng `Linh` có sẵn của macOS (lệnh `say`).
- Mac chip Intel: chưa có bản offline. Dùng giọng/AI trên mạng.

---

## 4. Linux (x64)

Cần glibc ≥ 2.28 (Ubuntu 20.04+, Debian 10+, Fedora 29+): thư viện Python của giọng đọc dùng wheel
`manylinux_2_28`.

### Cài công cụ (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y git curl build-essential
```

Node.js ≥ 20.12: bản trong `apt` thường quá cũ, nên cài bản LTS qua [nodejs.org](https://nodejs.org)
hoặc [nvm](https://github.com/nvm-sh/nvm).

Chrome Headless Shell (dùng để render video) cần một số thư viện hệ thống. Nếu render báo thiếu
`lib*.so`, cài thêm:

```bash
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

(Ubuntu 24.04 đổi tên gói `libasound2` thành `libasound2t64`.)

### Tải mã nguồn, cài và chạy

```bash
git clone https://github.com/vpn2k1/short-video.git
cd short-video
npm install
npm start
```

### Lưu ý riêng cho Linux

- AI có sẵn dùng bản llama.cpp Vulkan: dùng được GPU khi máy có driver Vulkan, không có thì tự chạy
  bằng CPU.
- Giọng đọc dùng model fp32 giống Windows.

---

## 5. Lệnh `npm run setup`

`npm install` tự gọi lệnh này và chỉ tải phần còn thiếu. Có thể gọi tay khi muốn cài lại, cài riêng
một phần, hoặc sau khi lần cài tự động bị lỗi.

```bash
npm run setup
```

| Tham số | Tác dụng |
|---|---|
| `--only voice` | Chỉ cài một phần: `voice`, `ai`, `yt-dlp`. Nhiều phần thì cách nhau bằng dấu phẩy: `--only voice,ai` |
| `--force` | Cài lại dù đã có (khi nghi file hỏng) |
| `--platform win-x64` | Cài cho nền tảng khác máy đang chạy (dùng khi build bộ cài) |
| `--dest <thư mục>` | Cài vào thư mục khác, mặc định là thư mục project |

Ví dụ: cài lại giọng đọc:

```bash
npm run setup -- --only voice --force
```

Dấu `--` đứng sau `npm run setup` là bắt buộc để npm chuyển tham số cho script.

**Không muốn `npm install` tự tải** (máy yếu, mạng chậm, chỉ dùng giọng/AI trên mạng): đặt biến
`SKIP_LOCAL_SETUP=1`. Máy CI (có biến `CI`) cũng tự bỏ qua bước này.

```bash
SKIP_LOCAL_SETUP=1 npm install
```

```powershell
$env:SKIP_LOCAL_SETUP=1; npm install
```

Nếu một phần cài lỗi (mạng rớt, bị chặn huggingface.co hay github.com), `npm install` vẫn chạy xong
và các phần còn lại vẫn được cài. Lần sau chạy `npm run setup`, file đang tải dở sẽ được tải tiếp chứ
không tải lại từ đầu.

### Cài xong nằm ở đâu

```
vendor/
  vieneu/<nền tảng>/python/      Python 3.11 độc lập (không đụng tới Python của máy)
  vieneu/<nền tảng>/site/        onnxruntime, numpy, vieneu…
  models/vieneu-v3-turbo/        model giọng đọc
  llama/<nền tảng>/              llama-server
  models/qwen2.5-1.5b-instruct-q4_k_m.gguf
  yt-dlp/<nền tảng>/
release/cache/                   file tải về (xoá được sau khi cài)
```

`<nền tảng>` là `win-x64`, `mac-arm64` hoặc `linux-x64`. Git bỏ qua cả `vendor/` và `release/`, nên
**mỗi máy phải tự cài**, không commit hay chép các thư mục này qua lại giữa Windows và Mac.

---

## 6. Cập nhật sau `git pull`

```bash
git pull
npm install
npm start
```

Nếu bản mới đổi phiên bản model, `npm install` không tự nhận ra vì file cũ vẫn còn. Khi ghi chú phát
hành có nhắc đổi model, chạy thêm:

```bash
npm run setup -- --force
```

---

## 7. Kiểm tra đã cài đúng

```bash
npm run setup
```

Nếu cài đủ, lệnh này in ra ba dòng `✓ … — đã có` và không tải gì thêm.

Trong app: tạo một video ngắn, chọn một giọng VieNeu (ví dụ **Ngọc Huyền**) rồi bấm đọc thử.

---

## 8. Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `Chưa có giọng đọc trong app (thiếu vendor/vieneu/…)` | Chưa cài giọng VieNeu, hoặc lần cài tự động bị lỗi | `npm run setup -- --only voice` |
| Giọng Gemini lỗi `spawnSync ffmpeg ENOENT` | Server không tìm thấy ffmpeg | Chạy lại `npm install` để có `node_modules/ffmpeg-static`; nhớ khởi động bằng `npm start`, không chạy file khác |
| `ffprobe ENOENT` trên macOS | Mac chưa có ffprobe | `brew install ffmpeg` |
| `Bản cài này không kèm AI có sẵn trong app` | Chưa cài phần `ai` | `npm run setup -- --only ai` |
| `… bị hỏng (SHA-256 không khớp)` | File tải về bị lỗi giữa chừng | Script đã tự xoá file hỏng, chỉ cần chạy lại `npm run setup` |
| `Giọng đọc trong app thoát mã …` trên Windows, kèm lỗi DLL | Thư mục `vendor` được chép từ máy khác, hoặc cài chưa xong | `npm run setup -- --only voice --force` |
| `Chưa có bản giọng đọc/AI offline cho mac-x64` (hoặc `win-arm64`) | Máy không được hỗ trợ | Dùng giọng/AI trên mạng (điền key trong ⚙️ Cài đặt) |
| Phiên âm lỗi `make: command not found` (macOS/Linux) | whisper.cpp cần biên dịch | macOS `xcode-select --install` · Linux `sudo apt install build-essential` |
| `npm.ps1 cannot be loaded` (Windows) | PowerShell chặn script | Dùng `npm.cmd`, hoặc `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

---

## 9. Dành cho người phát hành

- `npm run dist:mac` / `dist:win` / `dist:linux` gọi `scripts/setup-local.ts --platform <nền tảng>`
  để chuẩn bị `vendor/` cho bộ cài. Khi build **chéo** (ví dụ build bản Windows trên Mac), máy build
  cần `python3` có `pip`: pip chỉ dùng để tải wheel đúng nền tảng, không chạy thư viện nào. Khi cài cho
  chính máy đang chạy thì dùng pip của Python độc lập vừa tải về.
- Mọi phiên bản (llama.cpp, Qwen, Python, thư viện VieNeu, model ONNX, yt-dlp) và mã SHA-256 đều ghim
  ở đầu từng mục trong `scripts/setup-local.ts`. Đổi phiên bản thì chạy thử đọc giọng và AI trên máy
  trước khi phát hành, rồi ghi chú trong bản phát hành để người chạy từ mã nguồn biết mà chạy
  `npm run setup -- --force`.
- Chi tiết về AI có sẵn: [ai-tren-may.md](ai-tren-may.md).
