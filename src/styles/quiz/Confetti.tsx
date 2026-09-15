import { useCurrentFrame } from "remotion";
import { seeded, useLayout } from "../shared";
import { CONFETTI } from "./theme";

const COUNT = 32;
const LIFE = 54;

/**
 * Pháo giấy nổ từ một điểm tại `at`. Mỗi hạt có vận tốc/góc/màu/hình theo seed, vật lý
 * tính thẳng từ số frame đã trôi (không tích luỹ state): x = vx·t, y = vy·t + g·t²/2.
 */
export const Confetti: React.FC<{ x: number; y: number; at: number; seedKey: string }> = ({ x, y, at, seedKey }) => {
  const frame = useCurrentFrame();
  const { unit } = useLayout();
  const t = frame - at;
  if (t < 0 || t > LIFE) return null;
  const gravity = 1.5 * unit;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      {Array.from({ length: COUNT }, (_, i) => {
        const k = `${seedKey}-${i}`;
        // Góc lệch lên trên: -160°…-20° cộng vài hạt văng ngang.
        const angle = (seeded(`${k}-a`, -172, -8) * Math.PI) / 180;
        const speed = seeded(`${k}-s`, 16, 42) * unit;
        const drag = 0.965;
        // Quãng đường có cản: v·(1-dragᵗ)/(1-drag).
        const travel = (1 - Math.pow(drag, t)) / (1 - drag);
        const px = Math.cos(angle) * speed * travel + Math.sin(t / 5 + i) * 6 * unit;
        const py = Math.sin(angle) * speed * travel + (gravity * t * t) / 2;
        const spin = seeded(`${k}-r`, -18, 18) * t;
        const w = seeded(`${k}-w`, 14, 26) * unit;
        const round = seeded(`${k}-shape`) < 0.3;
        const h = round ? w : w * seeded(`${k}-h`, 0.4, 0.7);
        const color = CONFETTI[Math.floor(seeded(`${k}-c`) * CONFETTI.length) % CONFETTI.length];
        const fade = t > LIFE - 14 ? (LIFE - t) / 14 : 1;
        const pop = Math.min(1, t / 3);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + px - w / 2,
              top: y + py - h / 2,
              width: w,
              height: h,
              borderRadius: round ? "50%" : 3 * unit,
              backgroundColor: color,
              opacity: fade,
              // Lật 3D giả bằng scaleY dao động — nhìn như giấy xoay.
              transform: `rotate(${spin}deg) scale(${pop}) scaleY(${Math.cos(t / 3 + i)})`,
              boxShadow: "0 1px 0 rgba(0,0,0,0.15)",
            }}
          />
        );
      })}
    </div>
  );
};
