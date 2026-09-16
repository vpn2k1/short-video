import type { OverlayTransform } from "../compositions/Short/overlayMotion";

/** Số đưa vào CSS — không để lọt dạng 1e-7 mà trình duyệt không hiểu. */
const css = (v: number) => Number(v.toFixed(4));

/** Giá trị mặc định = vẽ y như khi chưa có chuyển động, nên khỏi thêm phần tử bọc vô ích. */
const isIdentity = (t: OverlayTransform) =>
  t.x === 50 && t.y === 50 && t.width === 100 && t.rotate === 0 && t.opacity === 1;

/**
 * Pan / thu phóng / xoay / làm mờ hình của MỘT CẢNH trong khung chứa của nó.
 *
 * Cùng ý nghĩa toạ độ với lớp đè (xem MediaOverlays): (x, y) là tâm hình tính theo % khung chứa,
 * `width` là mức thu phóng (100 = đúng khung như cũ). Khác lớp đè ở chỗ hình vẫn lấp khung chứa
 * rồi mới biến đổi, nên phong cách nào cũng dùng được — kể cả khi phong cách đặt cảnh trong một
 * khung riêng (ảnh polaroid, ô truyện tranh…): lúc đó pan/zoom chạy trong đúng khung đó.
 *
 * `children` phải phủ kín phần tử cha (width/height 100%), như ClipVideo và <Img> của cảnh.
 */
export const MediaMotion: React.FC<{ transform: OverlayTransform; children: React.ReactNode }> = ({
  transform: t,
  children,
}) => {
  if (isIdentity(t)) return <>{children}</>;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: t.opacity,
          // translate tính theo kích thước khung chứa (phần tử phủ kín khung), scale/rotate quanh tâm.
          transform: `translate(${css(t.x - 50)}%, ${css(t.y - 50)}%) scale(${css(t.width / 100)}) rotate(${css(t.rotate)}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
