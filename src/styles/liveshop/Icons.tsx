/** Icon vẽ bằng SVG — kiểu chung chung, không mô phỏng logo nền tảng livestream nào. */

type Fill = { size: number; color: string };

export const HeartIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 21s-7.9-4.8-9.9-9.7C.6 7.6 3 4 6.8 4c2.2 0 3.8 1.2 5.2 3 1.4-1.8 3-3 5.2-3 3.8 0 6.2 3.6 4.7 7.3C19.9 16.2 12 21 12 21z" />
  </svg>
);

export const CommentIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 3.5c5 0 9 3.5 9 7.9s-4 7.9-9 7.9c-1.2 0-2.4-.2-3.5-.6L4 20.5l1.3-3.8C3.9 15.3 3 13.4 3 11.4 3 7 7 3.5 12 3.5z" />
    <circle cx="8" cy="11.4" r="1.3" fill="rgba(0,0,0,0.35)" />
    <circle cx="12" cy="11.4" r="1.3" fill="rgba(0,0,0,0.35)" />
    <circle cx="16" cy="11.4" r="1.3" fill="rgba(0,0,0,0.35)" />
  </svg>
);

export const ShareIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13.5 3.8l8 7.3-8 7.3v-4.2c-5.3 0-8.6 1.6-11 5.5.9-5.8 4-10.3 11-11.3V3.8z" />
  </svg>
);

export const CartIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5h2.6l2.4 11.2h10.6l2.2-8H6.3" />
    <circle cx="9.3" cy="19.2" r="1.5" fill={color} />
    <circle cx="17" cy="19.2" r="1.5" fill={color} />
  </svg>
);

export const EyeIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round">
    <path d="M1.8 12S5.6 5.2 12 5.2 22.2 12 22.2 12 18.4 18.8 12 18.8 1.8 12 1.8 12z" />
    <circle cx="12" cy="12" r="3.2" fill={color} />
  </svg>
);

export const PinIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M14.8 2.6l6.6 6.6-2 .7-3.4 3.4.4 4.6-1.8 1.8-4-4-5.3 5.3-1.2.3.3-1.2 5.3-5.3-4-4 1.8-1.8 4.6.4 3.4-3.4.7-2z" />
  </svg>
);

export const BoltIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13.6 1.8L4.2 13.6h6.4l-1.4 8.6 9.6-12.2h-6.5l1.3-8.2z" />
  </svg>
);

export const FlameIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12.4 1.8c.6 3.6 4.9 5.6 4.9 11 0 4.6-3.2 8.4-5.6 8.4-3.3 0-6-3-6-6.6 0-3 1.8-4.8 3-6.2.2 1.7.9 3 2.3 3.6-.5-4.3.4-7.6 1.4-10.2z" />
  </svg>
);

export const PlusIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Bóng sản phẩm chờ ảnh: chai có vòi xịt + hộp vuông đứng trên bục tròn. Vẽ trong khung 200×200,
 * `tone` là màu bóng (nhạt hơn nền một chút), `rim` là viền sáng.
 */
export const ProductSilhouette: React.FC<{ size: number; tone: string; rim: string }> = ({ size, tone, rim }) => (
  <svg width={size} height={size} viewBox="0 0 200 200">
    <ellipse cx="100" cy="176" rx="82" ry="14" fill="rgba(0,0,0,0.18)" />
    <path d="M22 160 Q22 150 100 150 Q178 150 178 160 L178 172 Q178 182 100 182 Q22 182 22 172 Z" fill={tone} opacity={0.9} />
    <ellipse cx="100" cy="158" rx="78" ry="9" fill={rim} opacity={0.55} />
    {/* Hộp */}
    <rect x="108" y="92" width="52" height="64" rx="5" fill={tone} />
    <rect x="108" y="92" width="52" height="10" rx="4" fill={rim} opacity={0.4} />
    {/* Chai */}
    <rect x="52" y="64" width="46" height="92" rx="14" fill={tone} />
    <rect x="66" y="44" width="18" height="22" rx="3" fill={tone} />
    <rect x="62" y="34" width="30" height="12" rx="4" fill={tone} />
    <rect x="89" y="37" width="14" height="5" rx="2" fill={tone} />
    <rect x="58" y="74" width="7" height="60" rx="3.5" fill={rim} opacity={0.5} />
  </svg>
);

/** Ngón cái giơ lên — lượt thích bay lên cùng tim. */
export const LikeIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M2.5 10.5h3.8v10H2.5zM8 20.5V10.3l4.6-6.6c.5-.7 1.6-.8 2.2-.2.4.4.6 1 .5 1.6l-.8 4.4h5.3c1.4 0 2.4 1.3 2 2.7l-2 6.8c-.3 1-1.2 1.5-2.2 1.5H8z" />
  </svg>
);

/** Nút đóng phiên live góc phải trên. */
export const CloseIcon: React.FC<Fill> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
