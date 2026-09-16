/** Icon vẽ bằng SVG — kiểu chung chung, không mô phỏng logo mạng xã hội nào. */

type IconProps = { size: number; color: string; fill?: string; stroke?: number };

export const HeartIcon: React.FC<IconProps> = ({ size, color, fill = "none", stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinejoin="round">
    <path d="M12 20.3s-7.6-4.6-9.5-9.3C1.1 7.5 3.4 4 7 4c2.1 0 3.6 1.1 5 2.9C13.4 5.1 14.9 4 17 4c3.6 0 5.9 3.5 4.5 7-1.9 4.7-9.5 9.3-9.5 9.3z" />
  </svg>
);

export const CommentIcon: React.FC<IconProps> = ({ size, color, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
    <path d="M20.5 11.6c0 4.3-3.8 7.7-8.5 7.7-1.3 0-2.5-.2-3.6-.7L3.5 20l1.3-3.9c-.9-1.3-1.3-2.8-1.3-4.5C3.5 7.3 7.3 4 12 4s8.5 3.3 8.5 7.6z" />
  </svg>
);

export const ShareIcon: React.FC<IconProps> = ({ size, color, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
    <path d="M14 4.5l6.5 6.2-6.5 6.2v-3.7c-4.6 0-7.8 1.5-10.2 5 1-5.2 3.9-9.3 10.2-10.2V4.5z" />
  </svg>
);

export const BookmarkIcon: React.FC<IconProps> = ({ size, color, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round">
    <path d="M6.5 3.8h11v16.4L12 16.3l-5.5 3.9V3.8z" />
  </svg>
);

export const MoreIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

export const BellIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2.5c-3.6 0-6.2 2.8-6.2 6.4v3.6L4 15.6v1.2h16v-1.2l-1.8-3.1V8.9c0-3.6-2.6-6.4-6.2-6.4zM9.6 18.2a2.4 2.4 0 0 0 4.8 0H9.6z" />
  </svg>
);

/** Tích xác minh: hoa thị 12 cánh + dấu check, điểm tính sẵn nên luôn giống nhau. */
const ROSETTE = (() => {
  const pts: string[] = [];
  const n = 12;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 11 : 9.2;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

export const VerifiedIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <polygon points={ROSETTE} fill={color} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M7.6 12.2l3 3 5.8-6" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
