#!/usr/bin/env bash
# Sinh các asset audio tĩnh vào public/. Chạy lại bất cứ lúc nào — chỉ cần ffmpeg.
#
#   bash scripts/make-audio-assets.sh
#
# public/music/placeholder.mp3 là nhạc TỔNG HỢP bằng sine, chỉ để kiểm tra phần
# trộn tiếng. Thay bằng nhạc thật trước khi đăng.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/sfx public/music

# Whoosh chuyển cảnh: burst pink noise, lọc dải, fade hai đầu.
ffmpeg -y -v error -f lavfi -i "anoisesrc=d=0.4:c=pink:a=0.9:r=48000" \
  -af "highpass=f=600,lowpass=f=6000,afade=t=in:st=0:d=0.12,afade=t=out:st=0.12:d=0.28,loudnorm=I=-16:TP=-2:LRA=11" \
  -ac 2 -ar 48000 public/sfx/whoosh.mp3

# Nhạc nền tạm: hợp âm Am9 giữ dài, tremolo nhẹ, 30s (component tự loop).
ffmpeg -y -v error \
  -f lavfi -i "sine=frequency=220:duration=30" \
  -f lavfi -i "sine=frequency=261.63:duration=30" \
  -f lavfi -i "sine=frequency=329.63:duration=30" \
  -f lavfi -i "sine=frequency=493.88:duration=30" \
  -filter_complex "[0]volume=0.30[a];[1]volume=0.20[b];[2]volume=0.16[c];[3]volume=0.10[d];[a][b][c][d]amix=inputs=4:normalize=0,tremolo=f=0.25:d=0.35,lowpass=f=2200,afade=t=in:st=0:d=2,loudnorm=I=-18:TP=-2:LRA=11[out]" \
  -map "[out]" -ac 2 -ar 48000 public/music/placeholder.mp3

echo "Đã sinh:"
for f in public/sfx/whoosh.mp3 public/music/placeholder.mp3; do
  printf "  %-32s %ss\n" "$f" \
    "$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")"
done
