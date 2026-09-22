import type { PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { FPS } from "./constants";

/**
 * Đồng bộ Remotion Player với trình chỉnh sửa: khung hình đang xem, đang phát hay dừng, và tua.
 * `meta`: thông số video hiện tại (null khi chưa tải xong).
 */
export const usePlayerSync = (meta: { durationInFrames: number } | null) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const frameRef = useRef(0);
  frameRef.current = frame;

  // ---------- Player ----------
  const ready = Boolean(meta);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [ready]);

  // Video ngắn lại mà đầu phát đang ở phần vừa bị cắt: kéo đầu phát về cuối.
  useEffect(() => {
    if (meta && frameRef.current > meta.durationInFrames - 1) {
      const last = meta.durationInFrames - 1;
      playerRef.current?.seekTo(last);
      setFrame(last);
    }
  }, [meta]);

  const seek = (ms: number) => {
    const max = (meta?.durationInFrames ?? 1) - 1;
    const target = Math.max(0, Math.min(max, Math.round((ms / 1000) * FPS)));
    playerRef.current?.seekTo(target);
    setFrame(target);
  };

  /** Mốc đầu phát (ms) — đọc ref nên đúng cả khi gọi từ callback cũ. */
  const nowMs = () => (frameRef.current / FPS) * 1000;

  return { frame, playing, playerRef, seek, nowMs };
};
