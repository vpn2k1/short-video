---
description: Soát video đã render — bố cục, vùng an toàn, phụ đề, mức âm, rồi cho điểm
---

Soát video: $ARGUMENTS

Phỏng theo `/review-video` của [remotion-superpowers](https://github.com/DojoCodingLabs/remotion-superpowers)
(MIT). Bản gốc dùng TwelveLabs để AI "xem" video — dịch vụ đó project này không có.
Thay bằng cách miễn phí và chính xác hơn: **render still ra PNG rồi đọc lại chính file
ảnh đó**, cộng số đo từ ffprobe.

**Bốn bước, làm đủ. Đừng chỉ đọc code.**

## 1. Nhìn thật

Xuất still ở hook, giữa bài, và frame cuối — rồi Read từng file ảnh:

```bash
npx remotion still Short out/f<N>.png --frame=<N> --props=videos/<slug>/props.json
```

Frame cuối quan trọng nhất: nó là thứ đọng lại khi loop quay vòng.

Nhìn gì: chữ có bị ảnh nuốt không · phần tử có đè nhau không · ảnh có bị crop hỏng không ·
cảnh có đổi đúng lúc không.

## 2. Vùng an toàn — đo bằng pixel

```bash
ffmpeg -v error -i out/f<N>.png -vf "crop=1080:320:0:1600,format=gray" -f rawvideo - \
  | python3 -c "import sys;d=sys.stdin.buffer.read();print('day YMAX',max(d))"
ffmpeg -v error -i out/f<N>.png -vf "crop=1080:120:0:0,format=gray" -f rawvideo - \
  | python3 -c "import sys;d=sys.stdin.buffer.read();print('dinh YMAX',max(d))"
```

Cả hai dải phải tối. YMAX cao = có chữ trong vùng nền tảng che.

## 3. Phụ đề

```bash
grep -c '�' videos/<slug>/props.json          # phải là 0
python3 -c "
import json;c=json.load(open('videos/<slug>/props.json'))['captions']
print('dòng dài nhất:',max(len(x['text']) for x in c))
for x in c:
    if len(x['text'])>42: print('  QUÁ DÀI:',x['text'])
"
```

Đọc qua toàn bộ text: tên riêng đúng chưa · dòng nào cắt giữa cụm từ.

## 4. Mức âm

Lấy mốc từ **chính `props.json` của video đó** — timing đổi theo giọng, dùng mốc video
khác là đo nhầm chỗ (đã mắc lỗi này một lần).

```bash
ffprobe -v error -show_entries stream=codec_type -of csv=p=0 out/<slug>.mp4
ffmpeg -v info -ss <t> -t <d> -i out/<slug>.mp4 -af volumedetect -f null - 2>&1 | grep mean_volume
```

Phải có cả stream `video` và `audio`. Intro chỉ nhạc < đoạn có tiếng nói. Khe giữa câu
là chỗ nhỏ nhất.

## Báo cáo

```
Điểm: [n/10]

Đạt:
  - [kèm số đo]

Chưa đạt:
  - [vấn đề] → [sửa cụ thể ở file nào]

Ưu tiên sửa:
  1. [tác động lớn nhất]
```

Mỗi kết luận phải kèm số đo hoặc một frame đã nhìn. **Không có số đo thì không kết luận.**
