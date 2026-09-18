import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play, Square } from "lucide-react";
import { postJson } from "./api";

/**
 * Nút nghe thử một giọng trước khi chọn (giống nút ▶ trong menu giọng ở trang chính, xem app.js voicePreviewButton).
 * Server đọc một câu mẫu bằng đúng giọng đó (POST /api/voice/sample); lần đầu giọng trong app mất vài giây,
 * lần sau phát ngay. Cả trang chỉ một giọng phát cùng lúc.
 */
let stopCurrent: (() => void) | null = null;

type State = "idle" | "loading" | "playing";

type Props = {
  voice: string;
  /** Tên dịch vụ trên mạng sẽ bị gọi (câu mẫu chưa có trong bộ nhớ) — nút ghi "tốn 1 lượt". null = miễn phí. */
  costs?: string | null;
  /** Đã có câu mẫu (vừa nghe xong lần đầu) — để bỏ ghi chú "tốn 1 lượt". */
  onSampled?: () => void;
  onError?: (message: string | null) => void;
};

export const VoicePreviewButton: React.FC<Props> = ({ voice, costs = null, onSampled, onError }) => {
  const [state, setState] = useState<State>("idle");
  /** Lượt phát đang chạy của nút này; null = không phát. Tăng `token` là huỷ lượt đang chờ server. */
  const run = useRef<{ token: number; audio: HTMLAudioElement | null }>({ token: 0, audio: null });

  const stop = useRef(() => {
    run.current = { token: run.current.token + 1, audio: (run.current.audio?.pause(), null) };
    if (stopCurrent === stop.current) stopCurrent = null;
    setState("idle");
  });

  // Đổi giọng khác trong ô chọn hoặc đóng bảng thì dừng.
  useEffect(() => () => stop.current(), [voice]);

  const toggle = async () => {
    if (state !== "idle") return stop.current();
    stopCurrent?.();
    stopCurrent = stop.current;
    const token = run.current.token + 1;
    run.current = { token, audio: null };
    setState("loading");
    onError?.(null);
    try {
      const { url } = await postJson<{ url: string }>("/api/voice/sample", { voice });
      onSampled?.();
      if (run.current.token !== token) return;
      const audio = new Audio(url);
      run.current.audio = audio;
      audio.addEventListener("ended", () => { if (run.current.token === token) stop.current(); });
      await audio.play();
      if (run.current.token === token) setState("playing");
    } catch (e) {
      if (run.current.token !== token) return;
      stop.current();
      onError?.(`Không nghe thử được: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const showCost = state === "idle" && Boolean(costs);
  const label = state !== "idle" ? "Dừng nghe thử"
    : `Nghe thử giọng ${voice}${costs ? ` — lần đầu gọi ${costs}, tốn 1 lượt; nghe lại sau đó miễn phí` : ""}`;
  return (
    <button type="button" className={`voice-play ${state === "loading" ? "busy" : state === "playing" ? "playing" : ""}${showCost ? " costs" : ""}`}
      onClick={toggle} disabled={!voice} title={label} aria-label={label}>
      {state === "loading" ? <LoaderCircle size={15} className="spin" aria-hidden />
        : state === "playing" ? <Square size={13} fill="currentColor" aria-hidden />
          : <Play size={15} fill="currentColor" aria-hidden />}
      {showCost ? <span>tốn 1 lượt</span> : null}
    </button>
  );
};
