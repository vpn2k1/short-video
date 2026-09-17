"""
Tiến trình con đọc giọng VieNeu-TTS v3 Turbo — scripts/vieneu-tts.ts gọi, không chạy tay.

Chạy bằng Python độc lập kèm trong app (desktop/fetch-vieneu.sh), đọc model từ thư mục cục bộ:
không mạng, không huggingface_hub, không torch.

    python -I -B vieneu-worker.py <site-packages> <thư mục model>
    stdin:  {"voice": "Ngọc Huyền", "items": [{"text": "...", "out": "/abs/line-01.mp3.wav"}]}
    stdout: một dòng "ok <out>" cho mỗi câu đọc xong. Lỗi: dòng "Error: ..." ra stderr, mã thoát 1.
"""
import json
import os
import sys
import types
import wave

SITE, MODEL = sys.argv[1], sys.argv[2]
sys.path.insert(0, SITE)

# vieneu/base.py import huggingface_hub ngay đầu file chỉ để tải model — model có sẵn trên máy nên thay bằng
# module rỗng, khỏi kèm huggingface_hub cùng ~10 thư viện mạng của nó. Chỗ nào còn gọi tới thì báo "không có file".
hub = types.ModuleType("huggingface_hub")


def _offline(*_args, **_kwargs):
    raise FileNotFoundError("VieNeu chạy offline — không tải model")


hub.hf_hub_download = _offline
sys.modules["huggingface_hub"] = hub

from vieneu._v3_turbo_engine import onnx_runtime_lite  # noqa: E402

_engine_init = onnx_runtime_lite.OnnxV3LiteEngine.__init__


def _local_init(self, *args, **kwargs):
    # Vieneu(mode="v3turbo") không cho truyền codec_dir — chèn thẳng đường dẫn model cục bộ vào engine ONNX.
    kwargs.update(onnx_dir=os.path.join(MODEL, "onnx"), codec_dir=os.path.join(MODEL, "codec"))
    _engine_init(self, *args, **kwargs)


onnx_runtime_lite.OnnxV3LiteEngine.__init__ = _local_init

import numpy as np  # noqa: E402
from vieneu import Vieneu  # noqa: E402


def write_wav(path, audio, sample_rate):
    # Tự ghi WAV bằng thư viện chuẩn: soundfile trên Linux cần libsndfile của hệ thống, máy người dùng chưa chắc có.
    pcm = (np.clip(np.asarray(audio, dtype=np.float32), -1.0, 1.0) * 32767).astype("<i2")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(sample_rate)
        out.writeframes(pcm.tobytes())


def main():
    request = json.loads(sys.stdin.read())
    tts = Vieneu(mode="v3turbo", backbone_repo=MODEL, backend="onnx")
    voice = request.get("voice") or None
    for item in request["items"]:
        audio = tts.infer(item["text"], voice=voice)
        if audio is None or len(audio) == 0:
            raise RuntimeError(f"Không đọc được câu: {item['text']}")
        write_wav(item["out"], audio, tts.sample_rate)
        print(f"ok {item['out']}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # báo gọn một dòng cho Node, chi tiết ở trên
        import traceback

        traceback.print_exc()
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
