---
name: voice-generation
description: Giọng đọc cho video — TTS ElevenLabs, EverAI, giọng macOS miễn phí, và phiên âm audio có sẵn bằng whisper.cpp. Dùng khi cần voiceover, chọn giọng, hoặc làm video từ file thu sẵn.
---

# Voice Generation

Hai chiều ngược nhau: **chữ → giọng** (TTS) và **giọng → chữ** (phiên âm).

## Chọn giọng

```bash
npm run prompt-to-video -- --name x --voice linh     # tiếng Việt, macOS, miễn phí
npm run prompt-to-video -- --name x --voice laura    # ElevenLabs
npm run prompt-to-video -- --name x --voice <voice_id>   # bất kỳ giọng ElevenLabs nào
npm run prompt-to-video -- --name x --voice kieu-nhi     # EverAI, tiếng Việt bản xứ
npm run prompt-to-video -- --name x --voice vi_female_kieunhi_mn   # bất kỳ voice_code EverAI nào
npm run prompt-to-video -- --list-voices             # catalog tĩnh
npm run prompt-to-video -- --list-voices --live      # đọc /v1/voices — nguồn chính xác
```

Giọng quyết định luôn engine, không phải khai báo cả `--tts` lẫn voice id.

## EverAI (tiếng Việt bản xứ)

Key `EVERAI_API_KEY` (tạo ở https://everai.vn/api), model `EVERAI_MODEL_ID` (mặc định
`everai-v1.6`). API bất đồng bộ: `POST /api/v1/tts` → hỏi `GET /api/v1/tts/{request_id}`
mỗi giây tới `status: "done"` → tải `audio_link`. Giọng trong catalog: `kieu-nhi`,
`thuy-trang`, `le-hoang` (vi, ~1000 credit/1k ký tự), `ever-nova`, `ever-echo` (en).
Code ở `scripts/tts.ts` (`everAiToFile`) — **chưa chạy thử với key thật**.

## Giới hạn tài khoản ElevenLabs (đo thật)

Tài khoản gói **free**:

- **21/23 giọng dùng được** — toàn bộ giọng `premade`, đều là giọng tiếng Anh.
- **0 giọng tiếng Việt** dùng được. Mọi giọng `professional` (library voice) trả
  `402 paid_plan_required`. **Thêm giọng từ thư viện vào tài khoản KHÔNG gỡ được** —
  đã thử 6 giọng Việt (Giang, Đô Trịnh, Tuyết, Thúy Tiên, Chi, Khánh Lâm), tất cả 402.
  Giới hạn nằm ở tầng API.
- Voice cloning tắt (`can_use_instant_voice_cloning: false`).
- Quota 10.000 ký tự/tháng ≈ 45 video ngắn.

**→ Muốn tiếng Việt bản xứ mà không nâng gói: `--voice linh`** (macOS, offline, miễn phí).
Đây hiện là giọng Việt duy nhất chạy được.

## Model TTS: đừng dùng multilingual_v2 cho tiếng Việt

`/v1/models` cho thấy chỉ 4 model hỗ trợ `vi`:
`eleven_v3`, `eleven_v3_conversational`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`.

`eleven_multilingual_v2` **không có** tiếng Việt trong danh sách — nó vẫn phát ra âm
nên nghe qua tưởng chạy được, nhưng không được huấn luyện cho ngôn ngữ này. Mặc định
project đã đổi sang `eleven_v3`.

## Quyền cần cho API key

Pipeline chỉ cần **Text to Speech**. `Voices → Read` chỉ cần khi không pin
`ELEVENLABS_VOICE_ID`. Models/User/History đều không cần.

## Phiên âm audio có sẵn

```bash
npm run audio-to-video -- ~/Downloads/giong.mp3 --name bai-noi
```

whisper.cpp chạy **local, offline, không API key**. Tải model một lần.

| Model | Dung lượng | Kết quả trên tiếng Việt |
|---|---|---|
| `small` | 466MB | Sai nhiều, một câu hỏng hẳn |
| `medium` | 1.5GB | **Mặc định.** Đúng phần lớn, còn sai tên riêng |
| `large-v3-turbo` | 1.3GB | **Không dùng được** |

`large-v3-turbo` chết với `unknown DTW preset 'large.v3.turbo'` — whisper.cpp 1.5.5 chưa
biết preset đó. Nâng `installWhisperCpp` lên 1.7.4 thì `make` fail (exit 2): bản mới chỉ
ủy thác sang `cmake`, mà package vẫn gọi Makefile cũ. Máy chưa có `cmake` —
`brew install cmake` là điều kiện để mở đường này.

**Phụ đề sau phiên âm LUÔN phải soát tay.** Xem skill `script-writing`.

## Nhạc nền và tiếng động

Hai đường, chọn theo tình huống:

### ffmpeg — offline, miễn phí, chạy được ngay

```bash
npx tsx scripts/make-audio.ts music calm 30
npx tsx scripts/make-audio.ts sfx whoosh
```

5 mood nhạc, khác nhau thật (đo trọng tâm phổ): `tense` 183 Hz (tối nhất) ·
`dramatic` 194 · `warm` 226 · `calm` 297 · `upbeat` 340 Hz (sáng nhất).
5 loại sfx: `whoosh` `pop` `ding` `riser` `thud`.

**Đây là nhạc TỔNG HỢP** — hợp âm giữ dài + tremolo, không phải nhạc thu. Đủ làm nền
dưới lời nói, nhưng nghe kỹ vẫn ra chất máy. Thay bằng track thật khi làm bản đăng.

### ElevenLabs — theo mô tả ngữ cảnh, CẦN CẤP THÊM QUYỀN

```
POST /v1/music            → 401 thiếu quyền "music_generation"
POST /v1/sound-generation → 401 thiếu quyền "sound_generation"
```

Đây là lỗi **quyền của key**, không phải giới hạn gói. Vào dashboard ElevenLabs sửa
quyền của API key hiện tại là dùng được — không cần tạo key mới. Code đã sẵn trong
`server/api.ts` (`makeAudioElevenLabs`), **chưa verify được** cho tới khi quyền được cấp.

## Trộn tiếng

`src/audio/mix.ts` — hàm thuần, kiểm chứng được không cần render:

| Lớp | Mức |
|---|---|
| Voiceover | 1.0 |
| Nhạc nền | 0.5, ducking xuống 0.12 khi có tiếng nói |
| Whoosh | 0.35 |

Ducking dốc dần trong 0.25s hai đầu mỗi câu, không nhảy bậc. Envelope đã đo:
frame 0 → 0.000 (fade in) · intro → 0.500 · trong câu → 0.120 · khe giữa câu → 0.215 ·
frame cuối → 0.017.

Kiểm chéo trên file mp4 bằng `volumedetect` theo đúng mốc trong `props.json` — **đừng
dùng mốc của video khác**, timing đổi theo giọng.
