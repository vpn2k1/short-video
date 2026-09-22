import { useCallback, useRef, useState } from "react";

/** Thông báo ngắn ở góc màn hình — tự ẩn sau 3,8 giây, thông báo mới thay thông báo cũ. */
export const useToast = () => {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  return { toast, flash };
};
