# AI Video Studio

Làm video ngắn dọc 9:16 (TikTok / Reels / Shorts) và video ngang từ một ý tưởng, một đoạn lời
hay một file thu âm: AI viết kịch bản, đọc giọng tiếng Việt, tìm ảnh, ghép nhạc, xuất ra mp4.

Ưu tiên **miễn phí và chạy offline**: giọng đọc tiếng Việt, AI viết kịch bản, phiên âm, nhạc nền
và tiếng động đều chạy ngay trên máy, không cần API key.

---

## Tải app

<p>
  <a href="https://github.com/vpn2k1/short-video/releases/latest/download/AI-Video-Studio-mac-arm64.dmg"><img alt="Tải cho macOS" src="https://img.shields.io/badge/T%E1%BA%A3i%20cho%20macOS-Apple%20Silicon-000000?style=for-the-badge&logo=apple&logoColor=white"></a>
  &nbsp;
  <a href="https://github.com/vpn2k1/short-video/releases/latest/download/AI-Video-Studio-windows-x64-setup.exe"><img alt="Tải cho Windows" src="https://img.shields.io/badge/T%E1%BA%A3i%20cho%20Windows-10%20%2F%2011%20x64-0078D4?style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTAgMGgxMS40djExLjRIMHpNMTIuNiAwSDI0djExLjRIMTIuNnpNMCAxMi42aDExLjRWMjRIMHpNMTIuNiAxMi42SDI0VjI0SDEyLjZ6Ii8%2BPC9zdmc%2B"></a>
</p>

| Máy | File | Cần |
|---|---|---|
| macOS | `AI-Video-Studio-mac-arm64.dmg` | Mac chip Apple (M1 trở lên) |
| Windows | `AI-Video-Studio-windows-x64-setup.exe` | Windows 10/11 64-bit |

Bản cũ hơn và bản Linux (`.AppImage`): [trang Releases](https://github.com/vpn2k1/short-video/releases).

App đã kèm sẵn Node, ffmpeg, Chrome dựng video, giọng đọc tiếng Việt và AI viết kịch bản — cài xong
là dùng, không cần cài thêm gì. Bộ cài khá nặng vì những thứ chạy offline này nằm luôn trong đó.

### Mở app lần đầu

App chưa ký với Apple/Microsoft nên hệ điều hành sẽ cảnh báo ở lần mở đầu tiên.

**macOS**

1. Mở file `.dmg`, kéo **AI Video Studio** vào **Applications**.
2. Mở app. macOS báo không mở được → vào **Cài đặt hệ thống › Quyền riêng tư & Bảo mật**, kéo xuống
   dưới, bấm **Vẫn mở** (Open Anyway) rồi nhập mật khẩu máy. Chỉ cần làm một lần.
   macOS 14 trở về trước: chuột phải vào app › **Mở**.
3. Nếu macOS báo app "bị hỏng" và đòi chuyển vào Thùng rác, mở Terminal chạy lệnh dưới rồi mở lại:

   ```bash
   xattr -cr "/Applications/AI Video Studio.app"
   ```

**Windows**

1. Chạy file `.exe`. SmartScreen báo *"Windows đã bảo vệ PC của bạn"* → bấm **Thông tin thêm**
   (More info) › **Vẫn chạy** (Run anyway).
2. Làm theo trình cài đặt, chọn thư mục cài nếu muốn.

Dữ liệu của bạn (video, ảnh, key) nằm ở:

| Máy | Thư mục |
|---|---|
| macOS | `~/Library/Application Support/AI Video Studio/workspace` |
| Windows | `%APPDATA%\AI Video Studio\workspace` |

Cài bản mới đè lên bản cũ không mất dữ liệu.

---

## Chạy từ mã nguồn

Dành cho ai muốn chạy bản mới nhất trên nhánh chính hoặc sửa code. Không cần dựng app — chỉ cần
`npm start`.

Hướng dẫn chi tiết từng hệ điều hành (Windows, macOS, Linux) và cách xử lý lỗi thường gặp:
[docs/cai-dat-local.md](docs/cai-dat-local.md).

### 1. Cài công cụ

| | Cần | Cài |
|---|---|---|
| Node.js | **≥ 20.12** (đã kiểm chứng với 20.19.6) | [nodejs.org](https://nodejs.org) — bản LTS |
| ffmpeg + ffprobe | chỉ macOS cần cài | macOS `brew install ffmpeg` · Windows/Linux: đã kèm trong `node_modules`, không cần cài |
| Git | | [git-scm.com](https://git-scm.com) |

Kiểm tra (macOS/Linux dùng Terminal, Windows dùng PowerShell — cài xong nhớ mở cửa sổ mới):

```bash
node -v
git --version
```

### 2. Tải mã nguồn và chạy

```bash
git clone https://github.com/vpn2k1/short-video.git
cd short-video
npm install
npm start
```

Mở **http://localhost:5177** trong trình duyệt. Tắt server: bấm `Ctrl+C` trong cửa sổ đang chạy.

### 3. Cập nhật bản mới

Trong thư mục `short-video`:

```bash
git pull
npm install
npm start
```

Luôn chạy lại `npm install` sau khi `git pull` — bản mới có thể thêm hoặc nâng thư viện. Video, ảnh
và key bạn đã tạo (`videos/`, `public/`, `data/`) không bị ghi đè.

### 4. Tuỳ chọn: giọng đọc và AI chạy trên máy

Bản cài desktop đã kèm sẵn. Chạy từ mã nguồn thì `npm install` tự tải phần còn thiếu cho máy đang
chạy (cần mạng, ~2 GB lần đầu; không cần bash hay python — chạy được thẳng trong PowerShell/cmd). Tải
lại hoặc cài riêng từng phần:

```bash
npm run setup
```

```bash
npm run setup -- --only voice
```

`--only` nhận `voice`, `ai`, `yt-dlp` (nhiều phần: `voice,ai`); thêm `--force` để cài lại. Không muốn
`npm install` tự tải: đặt `SKIP_LOCAL_SETUP=1`.

| Phần | Có gì | Không tải thì |
|---|---|---|
| `voice` | Giọng VieNeu-TTS — 25 giọng Việt (nam/nữ, Bắc/Trung/Nam) | macOS dùng giọng `Linh` có sẵn của máy; Windows dùng giọng Windows (cần cài gói giọng tiếng Việt: Settings › Time & Language › Speech) |
| `ai` | AI viết kịch bản trên máy (llama.cpp + Qwen2.5 1.5B) | Điền một key AI miễn phí (bên dưới) hoặc dùng [Ollama](docs/ai-tren-may.md) |
| `yt-dlp` | Tải video Bilibili trong trình chỉnh sửa | Mục 📺 Bilibili không dùng được |

ffmpeg/ffprobe: `npm start` tự dùng bản đi kèm `node_modules` khi máy chưa cài.

Đổi cổng khi `5177` đã bị chiếm:

```bash
PORT=8080 npm start
```

PowerShell: `$env:PORT=8080; npm start`.

---

## Dùng lần đầu

1. Mở app (hoặc http://localhost:5177).
2. Màn **Tạo video**: gõ ý tưởng, ví dụ *"5 mẹo tiết kiệm pin điện thoại"*, rồi bấm **Tạo video**.
   AI viết kịch bản, đọc giọng, tìm ảnh, ghép nhạc và dựng thành mp4. Đã có sẵn lời thì chọn
   **Lời có sẵn** và dán vào — app dựng đúng từng câu của bạn.
3. Chưa ưng thì nhắn tiếp để sửa (đổi lời, đổi giọng, đổi ảnh…), hoặc bấm **Chỉnh sửa** để mở trình
   chỉnh sửa theo dòng thời gian.
4. Bấm **Tải video** để lấy file mp4. **Bài đăng** gợi ý tiêu đề, caption, hashtag để đăng.

Các màn khác trên thanh trên cùng: **Hàng loạt** (nhiều video một lượt), **Phụ đề** (thêm phụ đề cho
nhiều video có sẵn), **Thư viện** (mọi video đã làm). Chi tiết từng màn:
[docs/huong-dan-chi-tiet.md](docs/huong-dan-chi-tiet.md).

---

## API key (không bắt buộc)

Không có key nào app vẫn làm được video trọn vẹn. Key chỉ mở thêm lựa chọn: AI viết lời mạnh hơn,
ảnh/clip thật, giọng đọc khác.

Bấm **⚙️ Cài đặt** góc phải trên (`Ctrl/⌘ + ,`) để điền. Key lưu trên máy bạn (`data/api-keys.json`),
không gửi đi đâu ngoài chính dịch vụ đó.

| Nhóm | Dịch vụ |
|---|---|
| 🆓 Miễn phí · Viết lời & giọng đọc | Google Gemini, Groq, OpenRouter |
| 🆓 Miễn phí · Ảnh, clip & nhạc | Pexels, Pixabay, Freesound, Cloudflare (vẽ ảnh AI) |
| 💳 Trả phí · Viết lời & giọng đọc | Anthropic (Claude), OpenAI (ChatGPT), ElevenLabs |
| 💳 Trả phí · Tạo video bằng AI | fal.ai, Replicate |

Mỗi ô trong Cài đặt có link lấy key. Bật **💚 Chế độ Miễn phí** để app không bao giờ gọi dịch vụ tính
tiền.

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `npm install` / `npm start` lỗi ngay từ đầu | Node cũ hơn 20.12 | `node -v` để kiểm tra; cài Node LTS mới rồi mở cửa sổ Terminal mới |
| `EADDRINUSE … 5177` | Đã có một bản đang chạy, hoặc app khác dùng cổng 5177 | Tắt bản kia, hoặc đổi cổng (`PORT=8080 npm start`) |
| Lỗi khi dựng/render nhắc tới `ffmpeg` / `ffprobe` | Chưa cài ffmpeg, hoặc cài xong chưa mở cửa sổ mới | Cài theo bảng ở trên rồi mở Terminal mới |
| `npm install` lỗi sau `git pull` | Thư viện cũ lệch với bản mới | Xoá thư mục `node_modules` rồi chạy lại `npm install` |
| macOS không cho mở app | App chưa ký với Apple | Xem [Mở app lần đầu](#mở-app-lần-đầu) |
| Chạy từ mã nguồn trên Windows, giọng máy không đọc được tiếng Việt | Thiếu gói giọng tiếng Việt | Settings › Time & Language › Speech, hoặc tải giọng VieNeu (mục 4 ở trên) |

Lỗi sâu hơn (render, phụ đề, API): [docs/huong-dan-chi-tiet.md#6-xử-lý-sự-cố](docs/huong-dan-chi-tiet.md#6-xử-lý-sự-cố).

---

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/huong-dan-chi-tiet.md](docs/huong-dan-chi-tiet.md) | Từng màn hình, dòng lệnh (`prompt-to-video`, `audio-to-video`…), cách pipeline hoạt động, cấu trúc thư mục, giới hạn đã đo |
| [docs/ai-tren-may.md](docs/ai-tren-may.md) | AI viết kịch bản chạy trên máy (có sẵn trong app, hoặc Ollama) |
| [docs/prompt-to-video.md](docs/prompt-to-video.md) | Chi tiết pipeline prompt → mp4 |
| [docs/bao-tri-du-an.md](docs/bao-tri-du-an.md) | Đọc code, sửa code, phát hành bản desktop |

---

## License

Remotion yêu cầu license cho một số tổ chức —
[đọc điều khoản](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

Ảnh từ Pexels bắt buộc ghi công tác giả; app tự ghi vào `public/images/<slug>/CREDITS.txt`, nhớ đưa
vào phần mô tả khi đăng.
