#!/usr/bin/env bash
# Chuẩn bị "giọng đọc có sẵn trong app": VieNeu-TTS v3 Turbo (tiếng Việt, 25 giọng, 48 kHz) chạy offline.
#
#   bash desktop/fetch-vieneu.sh mac-arm64            → ./vendor (chạy từ mã nguồn, build macOS)
#   bash desktop/fetch-vieneu.sh win-x64 release/win-stage
#
# Kết quả:  <đích>/vendor/vieneu/<nền tảng>/python/   Python 3.11 độc lập (python-build-standalone), đã bỏ phần thừa
#           <đích>/vendor/vieneu/<nền tảng>/site/     vieneu + onnxruntime + numpy + sea-g2p + tokenizers, đã bỏ phần thừa
#           <đích>/vendor/models/vieneu-v3-turbo/     model ONNX — chỉ phần đọc giọng có sẵn
#
# Gói Python `vieneu` kéo theo gradio, librosa, huggingface_hub (~780 MB) — ở đây chỉ cài đúng thư viện mà
# đường đọc ONNX/CPU dùng tới, scripts/vieneu-worker.py thay huggingface_hub bằng module rỗng.
# Bỏ phần nhái giọng (speaker_encoder, codec encoder) và khử nhiễu — app chỉ dùng giọng có sẵn.
#
# Model theo nền tảng (đo 2026-09-17, whisper nghe lại 5 câu mẫu):
#   mac-arm64 → int8 (~200 MB): đúng 100% chữ, không méo, nhanh hơn fp32 (RTF 0,23 so với 0,35).
#   win/linux → fp32 (~500 MB): tác giả VieNeu cảnh báo int8 méo tiếng trên CPU x86 không có VNNI (Intel/AMD đời cũ),
#               chưa thử được trên máy như vậy nên giữ fp32.
#
# Cần python3 có pip trên máy build (chỉ để tải wheel đúng nền tảng, không chạy gì).
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM=${1:?"Thiếu nền tảng: mac-arm64 | win-x64 | linux-x64"}
DEST=${2:-.}

# Ghim phiên bản — đổi bản vieneu hoặc model thì chạy thử đọc giọng trên máy trước khi phát hành.
PY_BUILD=20260901
PY_VERSION=3.11.16
PACKAGES="vieneu==3.8.1 sea-g2p==0.9.1 onnxruntime==1.30.0 numpy==2.4.6 tokenizers==0.23.2 packaging==26.3 typing-extensions==4.16.0"
TURBO_REPO=pnnbao-ump/VieNeu-TTS-v3-Turbo
TURBO_REV=5f2a3e93092efaba9153253ff5f2e6a8e810e4f2
CODEC_REPO=OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX
CODEC_REV=ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae
MODEL=vieneu-v3-turbo

case "$PLATFORM" in
  mac-arm64)
    PY_TRIPLE=aarch64-apple-darwin
    PY_SHA256=768f05cf200273bbdda9a5955a5a6892a4b22f2a0b1e4b0a9160f5c7fce86816
    # macosx_14 trước: wheel numpy/onnxruntime bản đó dùng Accelerate của Apple — bản macosx_11 chậm gấp đôi (đã đo).
    PIP_PLATFORMS="macosx_14_0_arm64 macosx_13_0_arm64 macosx_11_0_arm64"
    PY_EXE=python/bin/python3.11
    PRECISION=int8 ;;
  win-x64)
    PY_TRIPLE=x86_64-pc-windows-msvc
    PY_SHA256=06cbe479e039f5b9cb5640c286d790074d63f549f92a32d599a3748293bd4510
    PIP_PLATFORMS="win_amd64"
    PY_EXE=python/python.exe
    PRECISION=fp32 ;;
  linux-x64)
    PY_TRIPLE=x86_64-unknown-linux-gnu
    PY_SHA256=64427febea27864d136db46c8efe968eb6fa5ca2813ce1dca4bb95aec31cb2e4
    PIP_PLATFORMS="manylinux_2_28_x86_64 manylinux_2_27_x86_64 manylinux_2_17_x86_64 manylinux2014_x86_64"
    PY_EXE=python/bin/python3.11
    PRECISION=fp32 ;;
  *) echo "Nền tảng không hỗ trợ: $PLATFORM" >&2; exit 1 ;;
esac

CACHE=release/cache
mkdir -p "$CACHE" "$DEST"
DEST=$(cd "$DEST" && pwd)

# fetch <url> <file> <sha256>: tải một lần vào cache, kiểm SHA-256 mỗi lần dùng.
fetch() {
  if [ ! -f "$2" ]; then
    mkdir -p "$(dirname "$2")"
    curl -fL --progress-bar -C - --retry 3 -o "$2.part" "$1"
    mv "$2.part" "$2"
  fi
  if [ "$(shasum -a 256 "$2" | cut -d" " -f1)" != "$3" ]; then
    echo "$2 bị hỏng (SHA-256 không khớp) — xoá file rồi chạy lại." >&2
    exit 1
  fi
}

OUT="$DEST/vendor/vieneu/$PLATFORM"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "→ Python $PY_VERSION độc lập ($PLATFORM)"
PY_ASSET=cpython-$PY_VERSION+$PY_BUILD-$PY_TRIPLE-install_only_stripped.tar.gz
fetch "https://github.com/astral-sh/python-build-standalone/releases/download/$PY_BUILD/${PY_ASSET/+/%2B}" "$CACHE/$PY_ASSET" "$PY_SHA256"
tar xzf "$CACHE/$PY_ASSET" -C "$OUT"
(
  cd "$OUT/python"
  # Theo file python.exe chứ không theo thư mục "Lib": ổ macOS không phân biệt hoa thường, "Lib" khớp cả "lib".
  if [ "$PLATFORM" = win-x64 ]; then LIB=Lib; else LIB=lib/python3.11; fi
  # Phần không dùng tới khi đọc giọng (đã chạy thử sau khi bỏ): pip/setuptools, IDLE, tkinter + Tcl/Tk, sqlite,
  # unittest, distutils, tài liệu pydoc, header C, thư viện libpython (python3.11 trên mac/linux đã link tĩnh).
  rm -rf include share libs Scripts tcl \
    "$LIB"/site-packages "$LIB"/{idlelib,tkinter,turtledemo,ensurepip,lib2to3,distutils,pydoc_data,unittest,test,sqlite3,dbm,curses,xmlrpc,wsgiref,venv} \
    "$LIB"/turtle.py "$LIB"/pydoc.py "$LIB"/config-3.11-* \
    lib/tcl* lib/tk* lib/libtcl* lib/libtk* lib/itcl* lib/thread* lib/tdbc* lib/pkgconfig lib/libpython3.11.*
  rm -f "$LIB"/lib-dynload/{_tkinter,_sqlite3,_curses,_curses_panel,_dbm,_gdbm,readline,xxlimited,xxlimited_35}.* "$LIB"/lib-dynload/_test* \
    DLLs/{_tkinter,_sqlite3,_testcapi,_testbuffer,_testimportmultiple,_testmultiphase,_testinternalcapi,_testconsole,_testsinglephase,_testclinic,xxlimited,xxlimited_35}.pyd \
    DLLs/{tcl86t,tk86t,sqlite3}.dll
  mkdir -p "$LIB/site-packages"
  # Bỏ symlink (python3 → python3.11…): electron-builder chép chuỗi symlink bị lỗi, app gọi thẳng python3.11.
  find . -type l -delete
)
[ -f "$OUT/$PY_EXE" ] || { echo "Thiếu $OUT/$PY_EXE" >&2; exit 1; }

echo "→ Thư viện Python cho $PLATFORM"
command -v python3 >/dev/null || { echo "Cần python3 (có pip) trên máy build để tải wheel." >&2; exit 1; }
PLATFORM_FLAGS=""
for tag in $PIP_PLATFORMS; do PLATFORM_FLAGS="$PLATFORM_FLAGS --platform $tag"; done
# shellcheck disable=SC2086
python3 -m pip install --quiet --disable-pip-version-check --no-deps --only-binary=:all: \
  --implementation cp --python-version 3.11 $PLATFORM_FLAGS --target "$OUT/site" $PACKAGES
(
  cd "$OUT/site"
  rm -rf bin apps examples
  # onnxruntime: công cụ tối ưu/lượng tử hoá model, và thư viện C dùng chung — module Python đã link tĩnh, không nạp nó
  # (kiểm bằng objdump: onnxruntime_pybind11_state không phụ thuộc libonnxruntime / onnxruntime.dll).
  rm -rf onnxruntime/{transformers,quantization,tools,backend,datasets} \
    onnxruntime/capi/libonnxruntime.*.dylib onnxruntime/capi/libonnxruntime.so.* onnxruntime/capi/onnxruntime.dll
  # numpy: test, f2py, stub kiểu, header C.
  find numpy -type d \( -name tests -o -name testing -o -name f2py -o -name distutils -o -name typing -o -name _pyinstaller -o -name include \) -prune -exec rm -rf {} +
  # vieneu: chế độ khác (GPU, server, API, Nano…), audio mẫu, danh sách giọng của model khác.
  rm -rf vieneu/assets/samples vieneu/assets/voices_v3_nano.json vieneu/assets/voices.json vieneu/v3_turbo_serve \
    vieneu/{serve,remote,standard,fast,turbo,core_xpu,v3nano,utils}.py vieneu_utils/url_extract.py
  find . -name __pycache__ -type d -prune -exec rm -rf {} +
)
if [ "$PLATFORM" = win-x64 ]; then
  # onnxruntime cần MSVCP140.dll + MSVCP140_1.dll (objdump), Python độc lập chỉ kèm vcruntime140 — máy chưa cài
  # Visual C++ Redistributable sẽ không nạp được. Lấy từ gói msvc-runtime (DLL redist của Microsoft), đặt cạnh
  # python.exe: Windows tìm DLL phụ thuộc trong thư mục của chương trình trước.
  MSVC_WHEEL=msvc_runtime-14.44.35112-cp311-cp311-win_amd64.whl
  if [ ! -f "$CACHE/$MSVC_WHEEL" ]; then
    python3 -m pip download --quiet --disable-pip-version-check --no-deps --only-binary=:all: \
      --implementation cp --python-version 3.11 --platform win_amd64 -d "$CACHE" msvc-runtime==14.44.35112
  fi
  fetch "" "$CACHE/$MSVC_WHEEL" aba7fbe71897d25ed53fbb7f391e9f50289378a8a9ae218ba18530c663448391
  unzip -q -o -j "$CACHE/$MSVC_WHEEL" "msvc_runtime-14.44.35112.data/data/msvcp140.dll" \
    "msvc_runtime-14.44.35112.data/data/msvcp140_1.dll" -d "$OUT/python"
fi

echo "→ Model $MODEL ($PRECISION)"
# Tải vào cache theo từng bản (int8/fp32), rồi chép sang đích — ./vendor/models chỉ chứa đúng bản của nền tảng.
MODEL_CACHE=$CACHE/$MODEL-$PRECISION
if [ "$PRECISION" = int8 ]; then
  ONNX_SUBFOLDER=onnx_int8
  ONNX_SUMS="a9f8d9c4b4736448ab355d1a98cfe48f5e39aecf2916c37b0806c228612e9a2d onnx/config.json
6cc6bcbe380b8c37bd9f2514e37c5dfa3e00e122c6e3125dae5c4afe48e39158 onnx/tokenizer.json
f631e3387c788c3d8b9a5ac5df94952af5bc4c4d1049ff8a751e76a246fff2d4 onnx/vieneu_acoustic_cached.onnx
bb683925f7c8d826fadca4f8a0252ae4d5fc5b7837c14f6857e18f4c6666588d onnx/vieneu_backbone_shared.data
2c5b30bd8ccb751c58d651f44c074df10c4113efd08719adaa8e3dec6a6ce2ca onnx/vieneu_decode_step.onnx
c6a80dabf67c820de798f8deb7d4e0f37d81b5d76e33fbe20ab5a67f2d371f4e onnx/vieneu_prefill.onnx
fb22484baa424bbb775133a6e5f0d00d6299b2b256fbe3312a864b85b9aed01e onnx/vieneu_v3_heads.npz"
else
  ONNX_SUBFOLDER=onnx_update
  ONNX_SUMS="17d89d414ee302a82db7b330bf57b4cdf8541569392119c81f552178cafcb79b onnx/config.json
6cc6bcbe380b8c37bd9f2514e37c5dfa3e00e122c6e3125dae5c4afe48e39158 onnx/tokenizer.json
f631e3387c788c3d8b9a5ac5df94952af5bc4c4d1049ff8a751e76a246fff2d4 onnx/vieneu_acoustic_cached.onnx
c7c072193db33d0542457e2612c7272c44c4279d1cafaf0aa4c379964911db2f onnx/vieneu_backbone_shared.data
bedc379cea61ea5d616312750d95ad3924e055856662d19187a889a5edc24ceb onnx/vieneu_decode_step.onnx
27f8b064f6b57b5448e95d095f1959588c005d614678045c2b97ecccf3b7a0f7 onnx/vieneu_prefill.onnx
fb22484baa424bbb775133a6e5f0d00d6299b2b256fbe3312a864b85b9aed01e onnx/vieneu_v3_heads.npz"
fi
CODEC_SUMS="3e291c883bb7d11ff2fe8e964e3e495519760358859f35c951254c7741592731 codec/codec_browser_onnx_meta.json
0fbbafe3fd4afa2a019af5c5ced204af6e2d1db044fa40f021525d2aee95b4ac codec/moss_audio_tokenizer_decode_full.onnx
e69d52e0f4e84ca27850557ee54face46632d3a5a16c89bd246c7c408466dcad codec/moss_audio_tokenizer_decode_shared.data
9527c86a29e1837edec1f74db57d5eeaadb3a715af3382703566460afed25855 codec/moss_audio_tokenizer_decode_step.onnx"
while read -r sha file; do
  case "$file" in
    onnx/*) url="https://huggingface.co/$TURBO_REPO/resolve/$TURBO_REV/$ONNX_SUBFOLDER/${file#onnx/}" ;;
    codec/*) url="https://huggingface.co/$CODEC_REPO/resolve/$CODEC_REV/${file#codec/}" ;;
  esac
  fetch "$url" "$MODEL_CACHE/$file" "$sha"
done <<<"$ONNX_SUMS
$CODEC_SUMS"
mkdir -p "$DEST/vendor/models"
rm -rf "$DEST/vendor/models/$MODEL"
# -c: bản sao APFS, không tốn thêm ổ đĩa; ổ khác không hỗ trợ thì chép thường.
cp -Rc "$MODEL_CACHE" "$DEST/vendor/models/$MODEL" 2>/dev/null || cp -R "$MODEL_CACHE" "$DEST/vendor/models/$MODEL"

du -sh "$OUT/python" "$OUT/site" "$DEST/vendor/models/$MODEL"
